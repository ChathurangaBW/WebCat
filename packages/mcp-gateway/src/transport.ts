import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import type { JsonRpcResponse, McpServerConfig } from "./types.js";

export interface McpTransport {
  start(): Promise<void>;
  request(method: string, params?: unknown): Promise<unknown>;
  notify(method: string, params?: unknown): Promise<void>;
  close(): Promise<void>;
}

export class StdioTransport extends EventEmitter implements McpTransport {
  private child: any;
  private sequence = 0;
  private readonly pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private buffer = "";
  private started = false;

  public constructor(private readonly config: McpServerConfig) {
    super();
  }

  public async start(): Promise<void> {
    if (this.started) return;
    if (!this.config.command) throw new Error("stdio MCP server requires command");
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("MCP process startup timed out"));
        }
      }, this.config.startupTimeoutMs ?? 10_000);

      this.child = spawn(this.config.command, this.config.args ?? [], {
        ...(this.config.cwd ? { cwd: this.config.cwd } : {}),
        env: { ...process.env, ...this.config.env },
        stdio: ["pipe", "pipe", "pipe"]
      });
      this.child.stdout.setEncoding("utf8");
      this.child.stdout.on("data", (chunk: string) => this.consume(chunk));
      this.child.stderr.setEncoding("utf8");
      this.child.stderr.on("data", (chunk: string) => this.emit("stderr", chunk));
      this.child.once("spawn", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.started = true;
          resolve();
        }
      });
      this.child.once("error", (error: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      });
      this.child.on("exit", (code: number | null) => {
        this.started = false;
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timer);
          pending.reject(new Error(`MCP process exited with code ${code}`));
        }
        this.pending.clear();
      });
    });
  }

  private consume(chunk: string): void {
    this.buffer += chunk;
    let newline: number;
    while ((newline = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      try {
        const message = JSON.parse(line) as JsonRpcResponse;
        const id = message.id === undefined ? undefined : Number(message.id);
        if (id !== undefined && this.pending.has(id)) {
          const pending = this.pending.get(id)!;
          this.pending.delete(id);
          clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(message.error.message));
          else pending.resolve(message.result);
        } else {
          this.emit("message", message);
        }
      } catch {
        this.emit("stderr", `Invalid MCP JSON received: ${line}\n`);
      }
    }
  }

  public request(method: string, params: unknown = {}): Promise<unknown> {
    if (!this.started) return Promise.reject(new Error("MCP transport is not started"));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, this.config.timeoutMs ?? 60_000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  public async notify(method: string, params: unknown = {}): Promise<void> {
    if (!this.started) throw new Error("MCP transport is not started");
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  public async close(): Promise<void> {
    if (!this.child || this.child.killed) return;
    this.child.kill("SIGTERM");
    this.started = false;
  }
}

export class HttpTransport implements McpTransport {
  private sequence = 0;
  private sessionId: string | undefined;
  private started = false;

  public constructor(private readonly config: McpServerConfig) {}

  public async start(): Promise<void> {
    if (!this.config.url) throw new Error("HTTP MCP server requires url");
    this.started = true;
  }

  private async send(payload: unknown): Promise<unknown> {
    if (!this.started || !this.config.url) throw new Error("MCP transport is not started");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 60_000);
    try {
      const response = await fetch(this.config.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json, text/event-stream",
          ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
          ...this.config.headers
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      this.sessionId = response.headers.get("mcp-session-id") ?? this.sessionId;
      if (!response.ok) throw new Error(`MCP HTTP request failed ${response.status}: ${await response.text()}`);
      if (response.status === 202 || response.status === 204) return undefined;
      const text = await response.text();
      if (!text) return undefined;
      const contentType = response.headers.get("content-type") ?? "";
      const message = contentType.includes("text/event-stream")
        ? JSON.parse(text.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).at(-1) ?? "{}")
        : JSON.parse(text);
      if (message.error) throw new Error(message.error.message);
      return message.result;
    } finally {
      clearTimeout(timer);
    }
  }

  public async request(method: string, params: unknown = {}): Promise<unknown> {
    return this.send({ jsonrpc: "2.0", id: ++this.sequence, method, params });
  }

  public async notify(method: string, params: unknown = {}): Promise<void> {
    await this.send({ jsonrpc: "2.0", method, params });
  }

  public async close(): Promise<void> {
    this.started = false;
  }
}
