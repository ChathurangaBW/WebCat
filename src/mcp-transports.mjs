import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { IDENTITY } from "./identity.mjs";

export function createMcpClient(config) {
  if (config.transport === "stdio") return new StdioClient(config);
  if (config.transport === "sse") return new SseClient(config);
  return new HttpClient(config);
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
    this.child.once("error", (error) => rejectAll(this.pending, error));
    createInterface({ input: this.child.stdout }).on("line", (line) => this.#message(line));
    await this.request("initialize", initializeParams(this.config));
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
    settle(this.pending, message);
  }
}

class HttpClient {
  constructor(config) { this.config = config; this.sequence = 0; this.sessionId = undefined; }
  async initialize() {
    await this.request("initialize", initializeParams(this.config));
    await this.notify("notifications/initialized", {});
  }
  async request(method, params) { return this.#send({ jsonrpc: "2.0", id: ++this.sequence, method, params }, method); }
  async notify(method, params) { await this.#send({ jsonrpc: "2.0", method, params }, method, true); }
  async #send(payload, method, notification = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 60_000);
    try {
      const response = await fetch(this.config.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
          ...(this.config.headers ?? {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
      this.sessionId = response.headers.get("mcp-session-id") ?? this.sessionId;
      if (notification || response.status === 202 || response.status === 204) return {};
      const contentType = response.headers.get("content-type") ?? "";
      const text = await response.text();
      if (!text.trim()) return {};
      const message = contentType.includes("text/event-stream") ? parseSseMessage(text, payload.id) : JSON.parse(text);
      if (message.error) throw new Error(message.error.message ?? `MCP error: ${method}`);
      return message.result;
    } finally { clearTimeout(timer); }
  }
  async close() {}
}

class SseClient {
  constructor(config) {
    this.config = config;
    this.sequence = 0;
    this.pending = new Map();
    this.abort = new AbortController();
    this.endpointPromise = deferred();
  }
  async initialize() {
    const response = await connectSse(this.config, this.abort.signal);
    this.connectedUrl = response.url;
    this.#consume(response.body).catch((error) => rejectAll(this.pending, error));
    this.endpoint = await withTimeout(this.endpointPromise.promise, this.config.timeoutMs ?? 60_000, "MCP SSE endpoint announcement timed out");
    await this.request("initialize", initializeParams(this.config));
    await this.notify("notifications/initialized", {});
  }
  request(method, params) {
    const id = ++this.sequence;
    const timeoutMs = this.config.timeoutMs ?? 60_000;
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`MCP request timed out: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
    this.#post({ jsonrpc: "2.0", id, method, params }).catch((error) => {
      const pending = this.pending.get(id);
      if (pending) { clearTimeout(pending.timer); this.pending.delete(id); pending.reject(error); }
    });
    return promise;
  }
  async notify(method, params) { await this.#post({ jsonrpc: "2.0", method, params }); }
  async #post(payload) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(this.config.headers ?? {}) },
      body: JSON.stringify(payload),
      signal: this.abort.signal
    });
    if (!response.ok) throw new Error(`MCP SSE POST ${response.status}`);
  }
  async #consume(body) {
    if (!body) throw new Error("MCP SSE connection has no response body");
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = splitSseEvents(buffer);
      buffer = events.remainder;
      for (const event of events.values) this.#event(event);
    }
    throw new Error("MCP SSE stream closed");
  }
  #event(event) {
    const parsed = parseSseEvent(event);
    if (!parsed.data) return;
    if (parsed.event === "endpoint" || (!this.endpoint && looksLikeEndpoint(parsed.data))) {
      this.endpoint = new URL(parsed.data, this.connectedUrl).toString();
      this.endpointPromise.resolve(this.endpoint);
      return;
    }
    let message;
    try { message = JSON.parse(parsed.data); } catch { return; }
    settle(this.pending, message);
  }
  async close() { this.abort.abort(); rejectAll(this.pending, new Error("MCP SSE client closed")); }
}

function initializeParams(config) {
  return {
    protocolVersion: config.protocolVersion ?? "2025-03-26",
    capabilities: {},
    clientInfo: { name: IDENTITY.command, version: IDENTITY.version }
  };
}

async function connectSse(config, signal) {
  const base = new URL(config.url);
  const candidates = [base.toString()];
  if (!base.pathname.endsWith("/sse")) candidates.push(new URL(`${base.pathname.replace(/\/$/, "")}/sse`, base).toString());
  let lastError;
  for (const url of candidates) {
    try {
      const response = await fetch(url, { method: "GET", headers: { accept: "text/event-stream", ...(config.headers ?? {}) }, signal });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
        lastError = new Error(`MCP SSE endpoint ${url} returned ${response.status}`);
        continue;
      }
      return response;
    } catch (error) { lastError = error; }
  }
  throw lastError ?? new Error("Unable to connect to MCP SSE endpoint");
}

function parseSseMessage(text, expectedId) {
  const events = text.split(/\r?\n\r?\n/).map(parseSseEvent).filter((event) => event.data);
  const messages = events.map((event) => { try { return JSON.parse(event.data); } catch { return undefined; } }).filter(Boolean);
  return messages.find((message) => message.id === expectedId) ?? messages.at(-1) ?? {};
}

function splitSseEvents(buffer) {
  const parts = buffer.split(/\r?\n\r?\n/);
  return { values: parts.slice(0, -1), remainder: parts.at(-1) ?? "" };
}

function parseSseEvent(text) {
  let event = "message";
  const data = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return { event, data: data.join("\n") };
}

function looksLikeEndpoint(value) { try { new URL(value, "http://localhost"); return !value.trim().startsWith("{"); } catch { return false; } }

function settle(pendingMap, message) {
  if (!Object.hasOwn(message, "id")) return;
  const pending = pendingMap.get(message.id);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingMap.delete(message.id);
  if (message.error) pending.reject(new Error(message.error.message ?? "MCP error")); else pending.resolve(message.result);
}

function rejectAll(pendingMap, error) {
  for (const pending of pendingMap.values()) { clearTimeout(pending.timer); pending.reject(error); }
  pendingMap.clear();
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}
