import { setTimeout as sleep } from "node:timers/promises";
import { evaluateScope, operationRequiresApproval, riskAtLeast } from "./scope.mjs";
import { redact } from "./redact.mjs";
import { burpCapability, classifyBurpCall } from "./burp.mjs";
import { createMcpClient } from "./mcp-transports.mjs";
import { extractTarget, extractTargets, filterOutOfScope, policyHintName, stripPolicyMetadata } from "./mcp-targets.mjs";

// Matched against the tool NAME only. A server-supplied description is untrusted input and
// must never be able to talk a tool down into a lower risk class.
const PASSIVE_NAME_PATTERN = /^(?:list|get|read|search|find|inspect|status|show|query|describe|history|sitemap)(?:[_-]|$)/i;
const DESTRUCTIVE_PATTERN = /(delete|remove|drop|destroy|purge|reset|clear|terminate|shell[_-]?execute|exec|eval|spawn|command)/i;
const HIGH_PATTERN = /(scan|workflow|automate|fuzz|race|intruder|brut|crawl|spider|interceptor)/i;

export { extractTarget, extractTargets, stripPolicyMetadata };

export function classifyTool(serverName, tool, serverConfig = {}) {
  const mapped = serverConfig.capabilityMap?.[tool.name] ?? burpCapability(tool.name, serverConfig);
  if (mapped) return {
    capability: mapped.capability ?? `${serverName}.${tool.name}`,
    risk: mapped.risk ?? "active",
    requiresTarget: mapped.requiresTarget ?? mapped.risk !== "passive",
    trusted: true
  };
  const name = String(tool.name ?? "");
  // Unmapped tools default to active. Only an anchored, name-based passive match lowers that.
  let risk = "active";
  if (DESTRUCTIVE_PATTERN.test(name)) risk = "destructive";
  else if (HIGH_PATTERN.test(name)) risk = "high";
  else if (PASSIVE_NAME_PATTERN.test(name)) risk = "passive";
  // The description may only escalate the assessment, never reduce it.
  const description = String(tool.description ?? "");
  if (DESTRUCTIVE_PATTERN.test(description)) risk = maxRisk(risk, "destructive");
  else if (HIGH_PATTERN.test(description)) risk = maxRisk(risk, "high");
  return { capability: `${serverName}.${tool.name}`, risk, requiresTarget: risk !== "passive", trusted: false };
}

function maxRisk(a, b) { return riskAtLeast(a, b) ? a : b; }

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

  // Drops cached tool listings (and optionally live connections) so a long-running TUI session
  // picks up tools added after an extension reload without a restart.
  async refresh(serverName) {
    if (serverName) {
      this.toolCache.delete(serverName);
      const pending = this.clients.get(serverName);
      this.clients.delete(serverName);
      if (pending) await Promise.resolve(pending).then((client) => client.close?.()).catch(() => undefined);
      return;
    }
    await this.close();
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
  #nextSlot = 0;
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
    const targets = extractTargets(args);
    const context = { serverName, tool: tool.name, targets, risk: classification.risk };
    if (!classification.trusted && (classification.risk !== "passive" || server?.requireCapabilityMap === true)) {
      await this.#refuse("untrusted-tool", context, `MCP tool ${tool.name} requires an explicit capabilityMap entry before it can be executed`);
    }
    if (classification.requiresTarget && targets.length === 0) await this.#refuse("missing-target", context, `MCP tool ${tool.name} requires an extractable absolute target URL or ${policyHintName}.target policy hint`);
    for (const target of targets) {
      const scope = evaluateScope(this.engagement, target, classification.risk, options.now ?? new Date());
      if (!scope.allowed) await this.#refuse("scope", { ...context, target }, scope.reason);
    }
    if (operationRequiresApproval(this.engagement, classification.risk)) {
      const permitted = options.approve === true || await permitsEveryTarget(this.approvals, { risk: classification.risk, server: serverName, tool: tool.name, targets }, options.now ?? new Date());
      if (!permitted) await this.#refuse("approval", context, `Operator approval is required for ${classification.risk} MCP operation`);
    }
    await this.#throttle();
    const maxParallel = this.engagement.rateLimit?.maxParallel ?? 2;
    if (this.#active >= maxParallel) await this.#refuse("concurrency", context, "MCP parallel request limit reached");
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

  // Every deterministic refusal is recorded on the hash chain before the error is raised, so
  // the audit log is a complete record of what the gateway declined, not only scope failures.
  async #refuse(control, context, reason) {
    await this.audit.append("mcp.blocked", "system", { ...context, control, reason });
    throw new Error(reason);
  }

  // Each caller reserves its slot synchronously before awaiting, so concurrent callers queue
  // behind one another instead of all sleeping against the same stale timestamp.
  async #throttle() {
    const perMinute = this.engagement.rateLimit?.requestsPerMinute ?? 30;
    const interval = Math.ceil(60_000 / perMinute);
    const now = Date.now();
    const slot = Math.max(now, this.#nextSlot);
    this.#nextSlot = slot + interval;
    const wait = slot - now;
    if (wait > 0) await sleep(wait);
  }
}

async function permitsEveryTarget(approvals, input, now) {
  const targets = input.targets.length ? input.targets : ["*"];
  for (const target of targets) if (!await approvals.permits({ risk: input.risk, server: input.server, tool: input.tool, target }, now)) return false;
  return true;
}
