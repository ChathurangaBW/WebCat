import fs from "node:fs/promises";
import path from "node:path";
import { ApprovalService, webcatHome, type AppConfig, type Engagement, type EngagementStore } from "@webcat/core";
import { authorizeMcpCall } from "./guard.js";
import { McpClient } from "./client.js";
import type { McpConfig, McpServerStatus, McpTool } from "./types.js";

class ExecutionLimiter {
  private active = 0;
  private queue: Array<() => void> = [];
  private timestamps: number[] = [];
  public constructor(private readonly maxParallel: number, private readonly perSecond: number) {}
  public async acquire(): Promise<() => void> {
    while (this.active >= this.maxParallel) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
    while (true) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((time) => now - time < 1000);
      if (this.timestamps.length < this.perSecond) break;
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, 1000 - (now - this.timestamps[0]!))));
    }
    this.timestamps.push(Date.now());
    return () => { this.active -= 1; this.queue.shift()?.(); };
  }
}

function expandEnvironment(value: string): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_match, name: string) => process.env[name] ?? "");
}

export class McpManager {
  private readonly clients = new Map<string, McpClient>();
  private readonly tools = new Map<string, McpTool[]>();
  private readonly errors = new Map<string, string>();
  private readonly limiter: ExecutionLimiter;
  private readonly approvals: ApprovalService;

  public constructor(private readonly config: McpConfig, private readonly appConfig: AppConfig, private readonly engagement: Engagement, private readonly store: EngagementStore) {
    for (const [name, server] of Object.entries(config.servers ?? {})) if (server.enabled !== false) this.clients.set(name, new McpClient(name, server));
    this.limiter = new ExecutionLimiter(Math.max(1, engagement.maxParallelRequests), Math.max(1, engagement.maxRequestsPerSecond));
    this.approvals = new ApprovalService(store);
  }

  public static async load(cwd: string, appConfig: AppConfig, engagement: Engagement, store: EngagementStore): Promise<McpManager> {
    let config: McpConfig = { servers: {} };
    for (const file of [path.join(webcatHome(), "mcp.json"), path.join(cwd, ".webcat", "mcp.json")]) {
      try {
        const parsed = JSON.parse(await fs.readFile(file, "utf8")) as McpConfig;
        config = { servers: { ...config.servers, ...parsed.servers } };
      } catch {}
    }
    for (const server of Object.values(config.servers)) {
      if (server.env) for (const [key, value] of Object.entries(server.env)) server.env[key] = expandEnvironment(value);
      if (server.headers) for (const [key, value] of Object.entries(server.headers)) server.headers[key] = expandEnvironment(value);
    }
    return new McpManager(config, appConfig, engagement, store);
  }

  public serverNames(): string[] { return [...this.clients.keys()]; }

  public statuses(): McpServerStatus[] {
    return [...this.clients].map(([name]) => {
      const error = this.errors.get(name);
      return {
        name,
        transport: this.config.servers[name]!.transport,
        connected: this.tools.has(name),
        toolCount: this.tools.get(name)?.length ?? 0,
        ...(error ? { error } : {})
      };
    });
  }

  public async discover(name?: string, tolerateErrors = false): Promise<Record<string, McpTool[]>> {
    const output: Record<string, McpTool[]> = {};
    for (const [serverName, client] of this.clients) {
      if (name && serverName !== name) continue;
      try {
        const discovered = await client.listTools();
        const mappings = this.config.servers[serverName]?.capabilityMap ?? {};
        output[serverName] = discovered.map((tool) => {
          const mapping = mappings[tool.name];
          return mapping ? { ...tool, annotations: { ...tool.annotations, webcatCapability: mapping.name, webcatRisk: mapping.risk, webcatTrusted: true } } : tool;
        });
        this.tools.set(serverName, output[serverName]!);
        this.errors.delete(serverName);
        await this.store.appendAudit("mcp.discover", "system", "completed", { server: serverName, count: output[serverName]!.length });
      } catch (error) {
        const message = String(error);
        this.errors.set(serverName, message);
        await this.store.appendAudit("mcp.discover", "system", "failed", { server: serverName, error: message });
        if (!tolerateErrors) throw error;
      }
    }
    return output;
  }

  public async allTools(): Promise<Array<{ server: string; tool: McpTool }>> {
    if (!this.tools.size && this.clients.size) await this.discover(undefined, true);
    return [...this.tools].flatMap(([server, tools]) => tools.map((tool) => ({ server, tool })));
  }

  public async call(server: string, toolName: string, argumentsValue: Record<string, unknown>, operatorApproved = false, actor = "operator"): Promise<any> {
    const client = this.clients.get(server);
    if (!client) throw new Error(`unknown MCP server: ${server}`);
    if (!this.tools.has(server)) await this.discover(server);
    const tool = this.tools.get(server)?.find((candidate) => candidate.name === toolName);
    if (!tool) throw new Error(`unknown MCP tool: ${server}/${toolName}`);
    const decision = await authorizeMcpCall(this.engagement, this.appConfig, this.approvals, { server, tool, arguments: argumentsValue, operatorApproved });
    await this.store.appendAudit("mcp.call", actor, decision.allowed ? "allowed" : "blocked", { server, toolName, arguments: argumentsValue, decision });
    if (!decision.allowed) throw new Error(`MCP call blocked: ${decision.reason}`);
    const release = await this.limiter.acquire();
    try {
      const result = await client.callTool(toolName, argumentsValue);
      await this.store.addEvidence(actor, "response", `MCP ${server}/${toolName}`, { decision, result });
      return result;
    } catch (error) {
      await this.store.appendAudit("mcp.call", actor, "failed", { server, toolName, error: String(error) });
      throw error;
    } finally { release(); }
  }

  public async close(): Promise<void> { await Promise.all([...this.clients.values()].map((client) => client.close())); }
}
