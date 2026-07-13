import { setTimeout as sleep } from "node:timers/promises";
import { evaluateScope, operationRequiresApproval } from "./scope.mjs";
import { redact } from "./redact.mjs";
import { burpCapability, classifyBurpCall } from "./burp.mjs";
import { createMcpClient } from "./mcp-transports.mjs";
import { extractTarget, extractTargets, filterOutOfScope, policyHintName, stripPolicyMetadata } from "./mcp-targets.mjs";

const PASSIVE_PATTERN = /(?:^(?:list|get|read|search|find|inspect|status|show|query|describe)(?:[_-]|$)|history|sitemap|scope|project|environment|cookie.*list)/i;
const DESTRUCTIVE_PATTERN = /(delete|remove|drop|destroy|purge|reset|clear|terminate|shell[_-]?execute)/i;
const HIGH_PATTERN = /(scan|workflow|automate|fuzz|race|intruder|brut|crawl|spider|interceptor)/i;
const ACTIVE_PATTERN = /(send|replay|request|execute|run|create|update|set|intercept|tamper|resend)/i;

export { extractTarget, extractTargets, stripPolicyMetadata };

export function classifyTool(serverName, tool, serverConfig = {}) {
  const mapped = serverConfig.capabilityMap?.[tool.name] ?? burpCapability(tool.name, serverConfig);
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
  return { capability: `${serverName}.${tool.name}`, risk, requiresTarget: risk !== "passive", trusted: false };
}

export function classifyToolCall(serverName, tool, args, serverConfig = {}) {
  return classifyBurpCall(tool.name, args, serverConfig, classifyTool(serverName, tool, serverConfig));
}

export class McpManager {
  constructor(config) { this.config = config; this.clients = new Map(); this.toolCache = new Map(); }
  servers() { return Object.entries(this.config.servers).map(([name, value]) => ({ name, ...value })); }

  async tools(serverName) {
    const server = this.#server(serverName);
    if (server.enabled === false) return [];
    if (this.toolCache.has(serverName)) return this.toolCache.get(serverName);
    const client = await this.#client(serverName, server);
    const result = await client.request("tools/list", {});
    const tools = (Array.isArray(result?.tools) ? result.tools : [])
      .filter((tool) => !server.enabledTools || server.enabledTools.includes(tool.name))
      .filter((tool) => !server.disabledTools?.includes(tool.name))
      .map((tool) => ({ ...tool, classification: classifyTool(serverName, tool, server) }));
    this.toolCache.set(serverName, tools);
    return tools;
  }

  async call(serverName, toolName, args) {
    const server = this.#server(serverName);
    if (server.enabled === false) throw new Error(`MCP server ${serverName} is disabled`);
    if (server.enabledTools && !server.enabledTools.includes(toolName)) throw new Error(`MCP tool ${toolName} is not enabled`);
    if (server.disabledTools?.includes(toolName)) throw new Error(`MCP tool ${toolName} is disabled`);
    const client = await this.#client(serverName, server);
    return client.request("tools/call", { name: toolName, arguments: stripPolicyMetadata(args) });
  }

  async close() {
    const clients = await Promise.allSettled([...this.clients.values()]);
    await Promise.all(clients.filter((item) => item.status === "fulfilled").map((item) => item.value.close?.()));
    this.clients.clear();
    this.toolCache.clear();
  }

  #server(name) {
    const server = this.config.servers[name];
    if (!server) throw new Error(`Unknown MCP server ${name}`);
    return server;
  }

  async #client(name, server) {
    if (this.clients.has(name)) return this.clients.get(name);
    const pending = (async () => {
      const client = createMcpClient(server);
      await client.initialize();
      return client;
    })();
    this.clients.set(name, pending);
    try { return await pending; }
    catch (error) { this.clients.delete(name); throw error; }
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
    const classification = classifyToolCall(serverName, tool, args, server);
    if (!classification.trusted && classification.risk !== "passive") throw new Error(`Active MCP tool ${tool.name} requires an explicit capabilityMap entry`);
    const targets = extractTargets(args);
    if (classification.requiresTarget && targets.length === 0) throw new Error(`MCP tool ${tool.name} requires an extractable absolute target URL or ${policyHintName}.target policy hint`);
    for (const target of targets) {
      const scope = evaluateScope(this.engagement, target, classification.risk, options.now ?? new Date());
      if (!scope.allowed) {
        await this.audit.append("mcp.blocked", "system", { serverName, tool: tool.name, target, targets, reason: scope.reason });
        throw new Error(scope.reason);
      }
    }
    if (operationRequiresApproval(this.engagement, classification.risk)) {
      const permitted = options.approve === true || await permitsEveryTarget(this.approvals, { risk: classification.risk, server: serverName, tool: tool.name, targets }, options.now ?? new Date());
      if (!permitted) throw new Error(`Operator approval is required for ${classification.risk} MCP operation`);
    }
    await this.#throttle();
    const maxParallel = this.engagement.rateLimit?.maxParallel ?? 2;
    if (this.#active >= maxParallel) throw new Error("MCP parallel request limit reached");
    this.#active += 1;
    try {
      await this.audit.append("mcp.call.started", "operator", { serverName, tool: tool.name, target: targets[0], targets, risk: classification.risk });
      const result = await this.manager.call(serverName, tool.name, args);
      const filtered = filterOutOfScope(result, this.engagement);
      const evidence = await this.evidence.add({ source: `mcp:${serverName}:${tool.name}`, target: targets[0], data: filtered });
      await this.audit.append("mcp.call.completed", "system", { serverName, tool: tool.name, target: targets[0], targets, evidenceId: evidence.id });
      return { result: redact(filtered), evidence, classification, targets };
    } finally { this.#active -= 1; }
  }

  async #throttle() {
    const perMinute = this.engagement.rateLimit?.requestsPerMinute ?? 30;
    const interval = Math.ceil(60_000 / perMinute);
    const wait = this.#lastRequest + interval - Date.now();
    if (wait > 0) await sleep(wait);
    this.#lastRequest = Date.now();
  }
}

async function permitsEveryTarget(approvals, input, now) {
  const targets = input.targets.length ? input.targets : ["*"];
  for (const target of targets) if (!await approvals.permits({ risk: input.risk, server: input.server, tool: input.tool, target }, now)) return false;
  return true;
}
