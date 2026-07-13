import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { setTimeout as sleep } from "node:timers/promises";
import { evaluateScope, operationRequiresApproval } from "./scope.mjs";
import { redact } from "./redact.mjs";

const PASSIVE_PATTERN = /(?:^(?:list|get|read|search|find|inspect|status|show|query|describe)(?:_|$)|history|sitemap|scope|project|environment|cookie.*list)/i;
const DESTRUCTIVE_PATTERN = /(delete|remove|drop|destroy|purge|reset|clear|terminate)/i;
const HIGH_PATTERN = /(scan|workflow|automate|fuzz|race|intruder|brut|crawl|spider)/i;
const ACTIVE_PATTERN = /(send|replay|request|execute|run|create|update|set|intercept|tamper)/i;

export function classifyTool(serverName, tool, serverConfig = {}) {
  const mapped = serverConfig.capabilityMap?.[tool.name];
  if (mapped) return {
    capability: mapped.capability ?? `${serverName}.${tool.name}`,
    risk: mapped.risk ?? "active",
    requiresTarget: mapped.requiresTarget ?? mapped.risk !== "passive",
    trusted: true
  };
  const text = `${tool.name} ${tool.description ?? ""}`;
  let risk = "active";
  if (DESTRUCTIVE_PATTERN.test(text)) risk = "destructive";
  else if (HIGH_PATTERN.test(text)) risk = "high";
  else if (PASSIVE_PATTERN.test(text)) risk = "passive";
  else if (ACTIVE_PATTERN.test(text)) risk = "active";
  return {
    capability: `${serverName}.${tool.name}`,
    risk,
    requiresTarget: risk !== "passive",
    trusted: false
  };
}

export function extractTarget(args) {
  const candidates = [];
  walk(args, (key, value) => {
    if (typeof value !== "string") return;
    if (/^(url|uri|target|endpoint|destination|request_url)$/i.test(key)) candidates.unshift(value);
    else if (/^https?:\/\//i.test(value)) candidates.push(value);
  });
  for (const candidate of candidates) {
    try { return new URL(candidate).toString(); } catch { /* continue */ }
  }
  return undefined;
}

export class McpManager {
  constructor(config) { this.config = config; this.clients = new Map(); }

  servers() {
    return Object.entries(this.config.servers).map(([name, value]) => ({ name, ...value }));
  }

  async tools(serverName) {
    const server = this.#server(serverName);
    if (server.enabled === false) return [];
    const client = await this.#client(serverName, server);
    const result = await client.request("tools/list", {});
    const tools = Array.isArray(result?.tools) ? result.tools : [];
    return tools
      .filter((tool) => !server.enabledTools || server.enabledTools.includes(tool.name))
      .filter((tool) => !server.disabledTools?.includes(tool.name))
      .map((tool) => ({ ...tool, classification: classifyTool(serverName, tool, server) }));
  }

  async call(serverName, toolName, args) {
    const server = this.#server(serverName);
    if (server.enabled === false) throw new Error(`MCP server ${serverName} is disabled`);
    if (server.enabledTools && !server.enabledTools.includes(toolName)) throw new Error(`MCP tool ${toolName} is not enabled`);
    if (server.disabledTools?.includes(toolName)) throw new Error(`MCP tool ${toolName} is disabled`);
    const client = await this.#client(serverName, server);
    return client.request("tools/call", { name: toolName, arguments: args });
  }

  async close() {
    await Promise.all([...this.clients.values()].map((client) => client.close?.()));
    this.clients.clear();
  }

  #server(name) {
    const server = this.config.servers[name];
    if (!server) throw new Error(`Unknown MCP server ${name}`);
    return server;
  }

  async #client(name, server) {
    if (this.clients.has(name)) return this.clients.get(name);
    const client = server.transport === "stdio" ? new StdioClient(server) : new HttpClient(server);
    await client.initialize();
    this.clients.set(name, client);
    return client;
  }
}

export class McpGuard {
  #active = 0;
  #lastRequest = 0;
  constructor(options) {
    this.engagement = options.engagement;
    this.approvals = options.approvals;
    this.audit = options.audit;
    this.evidence = options.evidence;
    this.manager = options.manager;
  }

  async call(serverName, tool, args, options = {}) {
    const server = this.manager.config.servers[serverName];
    const classification = classifyTool(serverName, tool, server);
    if (!classification.trusted && classification.risk !== "passive") {
      throw new Error(`Active MCP tool ${tool.name} requires an explicit capabilityMap entry`);
    }
    const target = extractTarget(args);
    if (classification.requiresTarget && !target) throw new Error(`MCP tool ${tool.name} requires an extractable absolute target URL`);
    if (target) {
      const scope = evaluateScope(this.engagement, target, classification.risk, options.now ?? new Date());
      if (!scope.allowed) {
        await this.audit.append("mcp.blocked", "system", { serverName, tool: tool.name, target, reason: scope.reason });
        throw new Error(scope.reason);
      }
    }
    if (operationRequiresApproval(this.engagement, classification.risk)) {
      const permitted = options.approve === true || await this.approvals.permits({
        risk: classification.risk,
        server: serverName,
        tool: tool.name,
        target: target ?? "*"
      }, options.now ?? new Date());
      if (!permitted) throw new Error(`Operator approval is required for ${classification.risk} MCP operation`);
    }
    await this.#throttle();
    const maxParallel = this.engagement.rateLimit?.maxParallel ?? 2;
    if (this.#active >= maxParallel) throw new Error("MCP parallel request limit reached");
    this.#active += 1;
    try {
      await this.audit.append("mcp.call.started", "operator", { serverName, tool: tool.name, target, risk: classification.risk });
      const result = await this.manager.call(serverName, tool.name, args);
      const filtered = target ? filterOutOfScope(result, this.engagement) : result;
      const evidence = await this.evidence.add({ source: `mcp:${serverName}:${tool.name}`, target, data: filtered });
      await this.audit.append("mcp.call.completed", "system", { serverName, tool: tool.name, target, evidenceId: evidence.id });
      return { result: redact(filtered), evidence, classification };
    } finally {
      this.#active -= 1;
    }
  }

  async #throttle() {
    const perMinute = this.engagement.rateLimit?.requestsPerMinute ?? 30;
    const interval = Math.ceil(60_000 / perMinute);
    const wait = this.#lastRequest + interval - Date.now();
    if (wait > 0) await sleep(wait);
    this.#lastRequest = Date.now();
  }
}

class StdioClient {
  constructor(config) { this.config = config; this.sequence = 0; this.pending = new Map(); }
  async initialize() {
    this.child = spawn(this.config.command, this.config.args ?? [], {
      cwd: this.config.cwd,
      env: { ...process.env, ...(this.config.env ?? {}) },
      stdio: ["pipe", "pipe", "inherit"],
      shell: false
    });
    this.child.once("error", (error) => this.#rejectAll(error));
    const lines = createInterface({ input: this.child.stdout });
    lines.on("line", (line) => this.#message(line));
    await this.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "webcat", version: "1.1.0" }
    });
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  }
  request(method, params) {
    const id = ++this.sequence;
    const timeoutMs = this.config.timeoutMs ?? 60_000;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`MCP request timed out: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }
  async close() { this.child?.kill(); }
  #message(line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (!Object.hasOwn(message, "id")) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer); this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message ?? "MCP error")); else pending.resolve(message.result);
  }
  #rejectAll(error) { for (const pending of this.pending.values()) pending.reject(error); this.pending.clear(); }
}

class HttpClient {
  constructor(config) { this.config = config; this.sequence = 0; }
  async initialize() {
    await this.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "webcat", version: "1.1.0" }
    });
  }
  async request(method, params) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 60_000);
    try {
      const response = await fetch(this.config.url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(this.config.headers ?? {}) },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++this.sequence, method, params }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      const text = await response.text();
      const payload = contentType.includes("text/event-stream") ? parseSse(text) : JSON.parse(text);
      if (payload.error) throw new Error(payload.error.message ?? "MCP error");
      return payload.result;
    } finally { clearTimeout(timer); }
  }
  async close() {}
}

function parseSse(text) {
  const data = text.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter(Boolean).at(-1);
  if (!data) throw new Error("MCP SSE response did not contain data");
  return JSON.parse(data);
}

function filterOutOfScope(value, engagement) {
  if (Array.isArray(value)) return value.map((entry) => filterOutOfScope(entry, engagement)).filter((entry) => entry !== undefined);
  if (value && typeof value === "object") {
    const target = extractTarget(value);
    if (target && !evaluateScope(engagement, target, "passive").allowed) return undefined;
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, filterOutOfScope(entry, engagement)]).filter(([, entry]) => entry !== undefined));
  }
  return value;
}

function walk(value, visitor, key = "") {
  if (Array.isArray(value)) return value.forEach((entry) => walk(entry, visitor, key));
  if (value && typeof value === "object") return Object.entries(value).forEach(([childKey, entry]) => { visitor(childKey, entry); walk(entry, visitor, childKey); });
  visitor(key, value);
}
