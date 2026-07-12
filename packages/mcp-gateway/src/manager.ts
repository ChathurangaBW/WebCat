import fs from "node:fs/promises";
import path from "node:path";
import {
  ApprovalService,
  extractHttpUrls,
  webcatHome,
  type AppConfig,
  type Engagement,
  type EngagementStore
} from "@webcat/core";
import { McpClient } from "./client.js";
import { resolveCapability } from "./capabilities.js";
import { authorizeMcpCall, filterMcpResultToScope } from "./guard.js";
import type { Capability, McpConfig, McpServerStatus, McpTool } from "./types.js";

class ExecutionLimiter {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  private readonly timestamps: number[] = [];

  public constructor(private readonly maxParallel: number, private readonly perSecond: number) {}

  public async acquire(): Promise<() => void> {
    while (this.active >= this.maxParallel) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    while (true) {
      const now = Date.now();
      while (this.timestamps.length && now - this.timestamps[0]! >= 1000) this.timestamps.shift();
      if (this.timestamps.length < this.perSecond) break;
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, 1000 - (now - this.timestamps[0]!))));
    }
    this.active += 1;
    this.timestamps.push(Date.now());
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      this.waiters.shift()?.();
    };
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

  public constructor(
    private readonly config: McpConfig,
    private readonly appConfig: AppConfig,
    private readonly engagement: Engagement,
    private readonly store: EngagementStore
  ) {
    for (const [name, server] of Object.entries(config.servers ?? {})) {
      if (server.enabled !== false) this.clients.set(name, new McpClient(name, server));
    }
    this.limiter = new ExecutionLimiter(
      Math.max(1, engagement.maxParallelRequests),
      Math.max(1, engagement.maxRequestsPerSecond)
    );
    this.approvals = new ApprovalService(store);
  }

  public static async load(
    cwd: string,
    appConfig: AppConfig,
    engagement: Engagement,
    store: EngagementStore
  ): Promise<McpManager> {
    let config: McpConfig = { servers: {} };
    for (const file of [path.join(webcatHome(), "mcp.json"), path.join(cwd, ".webcat", "mcp.json")]) {
      try {
        const parsed = JSON.parse(await fs.readFile(file, "utf8")) as McpConfig;
        config = { servers: { ...config.servers, ...parsed.servers } };
      } catch {
        // Missing optional configuration is normal.
      }
    }
    for (const server of Object.values(config.servers)) {
      if (server.env) {
        for (const [key, value] of Object.entries(server.env)) server.env[key] = expandEnvironment(value);
      }
      if (server.headers) {
        for (const [key, value] of Object.entries(server.headers)) server.headers[key] = expandEnvironment(value);
      }
    }
    return new McpManager(config, appConfig, engagement, store);
  }

  public serverNames(): string[] {
    return [...this.clients.keys()];
  }

  public statuses(): McpServerStatus[] {
    return [...this.clients].map(([name]) => {
      const status: McpServerStatus = {
        name,
        transport: this.config.servers[name]!.transport,
        connected: this.tools.has(name),
        toolCount: this.tools.get(name)?.length ?? 0
      };
      const error = this.errors.get(name);
      if (error) status.error = error;
      return status;
    });
  }

  public async discover(name?: string, tolerateErrors = false): Promise<Record<string, McpTool[]>> {
    const output: Record<string, McpTool[]> = {};
    for (const [serverName, client] of this.clients) {
      if (name && serverName !== name) continue;
      try {
        output[serverName] = await client.listTools();
        this.tools.set(serverName, output[serverName]!);
        this.errors.delete(serverName);
        await this.store.appendAudit("mcp.discover", "system", "completed", {
          server: serverName,
          count: output[serverName]!.length
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
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

  public capabilityFor(server: string, tool: McpTool): Capability | undefined {
    return resolveCapability(tool.name, tool.annotations, this.config.servers[server]?.capabilities ?? {});
  }

  public async call(
    server: string,
    toolName: string,
    argumentsValue: Record<string, unknown>,
    operatorApproved = false,
    actor = "operator"
  ): Promise<unknown> {
    const client = this.clients.get(server);
    if (!client) throw new Error(`unknown MCP server: ${server}`);
    if (!this.tools.has(server)) await this.discover(server);
    const tool = this.tools.get(server)?.find((candidate) => candidate.name === toolName);
    if (!tool) throw new Error(`unknown MCP tool: ${server}/${toolName}`);
    const serverConfig = this.config.servers[server]!;
    const decision = await authorizeMcpCall(this.engagement, this.appConfig, this.approvals, {
      server,
      tool,
      arguments: argumentsValue,
      operatorApproved,
      customCapabilities: serverConfig.capabilities ?? {}
    });
    await this.store.appendAudit("mcp.call", actor, decision.allowed ? "allowed" : "blocked", {
      server,
      toolName,
      arguments: argumentsValue,
      decision
    });
    if (!decision.allowed) throw new Error(`MCP call blocked: ${decision.reason}`);

    const requestEvidence = await this.store.addEvidence(actor, "request", `MCP ${server}/${toolName} request`, {
      server,
      toolName,
      arguments: argumentsValue,
      decision
    });
    const release = await this.limiter.acquire();
    try {
      const raw = await client.callTool(toolName, argumentsValue);
      const result = this.appConfig.security.filterOutOfScopeMcpOutput
        ? filterMcpResultToScope(raw, this.engagement)
        : raw;
      await this.store.addEvidence(actor, "response", `MCP ${server}/${toolName} response`, {
        decision,
        result,
        observedUrls: extractHttpUrls(result)
      }, [requestEvidence.id]);
      return result;
    } catch (error) {
      await this.store.appendAudit("mcp.call", actor, "failed", {
        server,
        toolName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      release();
    }
  }

  public async close(): Promise<void> {
    await Promise.all([...this.clients.values()].map((client) => client.close()));
  }
}
