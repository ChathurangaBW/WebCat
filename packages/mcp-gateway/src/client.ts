import { HttpTransport, StdioTransport, type McpTransport } from "./transport.js";
import type { McpServerConfig, McpTool } from "./types.js";

export class McpClient {
  private readonly transport: McpTransport;
  private initialized = false;

  public constructor(public readonly name: string, private readonly config: McpServerConfig) {
    this.transport = config.transport === "stdio" ? new StdioTransport(config) : new HttpTransport(config);
  }

  public async connect(): Promise<void> {
    if (this.initialized) return;
    await this.transport.start();
    await this.transport.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "webcat", version: "1.0.0" }
    });
    await this.transport.notify("notifications/initialized", {});
    this.initialized = true;
  }

  public async listTools(): Promise<McpTool[]> {
    if (!this.initialized) await this.connect();
    const output: McpTool[] = [];
    let cursor: string | undefined;
    do {
      const result = await this.transport.request("tools/list", cursor ? { cursor } : {}) as {
        tools?: McpTool[];
        nextCursor?: string;
      };
      output.push(...(result.tools ?? []));
      cursor = result.nextCursor;
    } while (cursor);
    const enabled = this.config.enabledTools ?? [];
    const disabled = new Set(this.config.disabledTools ?? []);
    return output.filter((tool) => !disabled.has(tool.name) && (!enabled.length || enabled.includes(tool.name)));
  }

  public async callTool(name: string, argumentsValue: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) await this.connect();
    return this.transport.request("tools/call", { name, arguments: argumentsValue });
  }

  public async close(): Promise<void> {
    await this.transport.close();
    this.initialized = false;
  }
}
