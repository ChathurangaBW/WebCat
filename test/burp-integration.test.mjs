import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BURP_SKILLS, listBurpPresets, resolveBurpPreset } from "../src/burp.mjs";
import { classifyTool, classifyToolCall, extractTargets, McpManager, stripPolicyMetadata } from "../src/mcp.mjs";
import { loadMcpConfig } from "../src/config.mjs";
import { createProvider, PROFILES } from "../src/swarm.mjs";

test("Burp presets cover official, BurpMCP, and bridge transports", () => {
  const names = listBurpPresets().map((item) => item.name);
  assert.deepEqual(names, ["portswigger-sse", "portswigger-stdio", "swgee-sse", "bridge-stdio", "bridge-http"]);
  const official = resolveBurpPreset({ preset: "portswigger", enabled: true });
  assert.equal(official.transport, "sse");
  assert.equal(official.url, "http://127.0.0.1:9876");
  assert.equal(official.enabled, true);
  assert.ok(official.disabledTools.includes("set_project_options"));
  assert.ok(BURP_SKILLS.some((item) => item.name === "access-control-comparison"));
});

test("known Burp tools receive trusted capability mappings", () => {
  const official = resolveBurpPreset({ preset: "portswigger-sse" });
  assert.deepEqual(classifyTool("burp", { name: "get_proxy_http_history" }, official), {
    capability: "proxy.read", risk: "passive", requiresTarget: false, trusted: true
  });
  assert.equal(classifyTool("burp", { name: "send_http1_request" }, official).risk, "active");
  const bridge = resolveBurpPreset({ preset: "bridge-http" });
  assert.equal(classifyTool("bridge", { name: "burp_scanner" }, bridge).risk, "high");
  assert.equal(classifyToolCall("bridge", { name: "burp_config" }, { action: "GET_CONFIG" }, bridge).risk, "passive");
  assert.equal(classifyToolCall("bridge", { name: "burp_config" }, { action: "RESET" }, bridge).risk, "destructive");
  assert.equal(classifyToolCall("bridge", { name: "burp_utilities" }, { action: "SHELL_EXECUTE" }, bridge).risk, "destructive");
});

test("target extraction supports official, BurpMCP, bridge, arrays, and policy hints", () => {
  assert.deepEqual(extractTargets({ targetHostname: "app.example.test", targetPort: 443, usesHttps: true, content: "GET /api HTTP/1.1\r\nHost: app.example.test\r\n\r\n" }), ["https://app.example.test/api"]);
  assert.deepEqual(extractTargets({ host: "app.example.test", port: 8443, secure: true, data: "POST /login HTTP/1.1\r\nHost: app.example.test:8443\r\n\r\n" }), ["https://app.example.test:8443/login"]);
  assert.deepEqual(extractTargets({ action: "SEND_REQUEST", request: "GET /users HTTP/1.1\r\nHost: app.example.test:443\r\n\r\n" }), ["https://app.example.test/users"]);
  assert.deepEqual(extractTargets({ urls: ["https://app.example.test/a", "https://api.example.test/b"] }), ["https://app.example.test/a", "https://api.example.test/b"]);
  assert.deepEqual(extractTargets({ id: 4, _webcat: { target: "https://app.example.test/saved" } }), ["https://app.example.test/saved"]);
  assert.deepEqual(stripPolicyMetadata({ id: 4, _webcat: { target: "https://app.example.test/saved" } }), { id: 4 });
});

test("legacy SSE transport negotiates endpoint and lists tools", async () => {
  let stream;
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/sse") {
      stream = res;
      res.writeHead(200, { "content-type": "text/event-stream", connection: "keep-alive", "cache-control": "no-cache" });
      res.write("event: endpoint\ndata: /message?sessionId=test\n\n");
      return;
    }
    if (req.method === "POST" && req.url.startsWith("/message")) {
      let body = "";
      for await (const chunk of req) body += chunk;
      const message = JSON.parse(body);
      res.writeHead(202).end();
      if (!Object.hasOwn(message, "id")) return;
      const result = message.method === "initialize"
        ? { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "mock-burp", version: "1" } }
        : message.method === "tools/list"
          ? { tools: [{ name: "get_proxy_http_history", description: "Displays proxy history", inputSchema: { type: "object" } }] }
          : {};
      setImmediate(() => stream.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n\n`));
      return;
    }
    res.writeHead(404).end();
  });
  server.on("connection", (socket) => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  const config = resolveBurpPreset({ preset: "portswigger-sse", url: `http://127.0.0.1:${port}`, enabled: true, timeoutMs: 2000 });
  const manager = new McpManager({ servers: { burp: config } });
  try {
    const tools = await manager.tools("burp");
    assert.equal(tools.length, 1);
    assert.equal(tools[0].classification.capability, "proxy.read");
    assert.equal(tools[0].classification.trusted, true);
  } finally {
    await manager.close();
    stream?.end();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("preset defaults are interpolated after expansion", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-burp-preset-"));
  try {
    const project = join(temp, "project");
    const home = join(temp, "home");
    await mkdir(join(project, ".webcat"), { recursive: true });
    await mkdir(home, { recursive: true });
    await writeFile(join(project, ".webcat", "mcp.json"), JSON.stringify({ servers: { burp: { preset: "portswigger-stdio", enabled: true } } }));
    const config = await loadMcpConfig(project, { userPaths: { userMcp: join(home, "mcp.json") }, env: { BURP_MCP_PROXY_JAR: "/tmp/proxy.jar", BURP_MCP_SSE_URL: "http://127.0.0.1:9876" } });
    assert.equal(config.servers.burp.args[1], "/tmp/proxy.jar");
    assert.equal(config.servers.burp.args[3], "http://127.0.0.1:9876");
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("Burp skill workflows are assigned to specialist profiles", () => {
  const access = PROFILES.find((item) => item.name === "access-control-analyst");
  const serverSide = PROFILES.find((item) => item.name === "server-side-analyst");
  assert.ok(access.skills.includes("access-control-comparison"));
  assert.ok(serverSide.capabilities.includes("collaborator.generate"));
});

test("OpenAI-compatible provider executes bounded MCP tool calls and returns final JSON", async () => {
  let requestCount = 0;
  let execution;
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    requestCount += 1;
    const message = requestCount === 1
      ? { role: "assistant", content: null, tool_calls: [{ id: "call-1", type: "function", function: { name: "mcp_0_burp_get_proxy_http_history", arguments: "{}" } }] }
      : { role: "assistant", content: JSON.stringify({ summary: "Reviewed one proxy item.", hypotheses: [], findings: [] }) };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message }] }));
    assert.equal(payload.model, "test-model");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  const previous = process.env.WEBCAT_TEST_MODEL_KEY;
  process.env.WEBCAT_TEST_MODEL_KEY = "test-key";
  try {
    const provider = createProvider({ provider: "openai-compatible", baseUrl: `http://127.0.0.1:${port}/v1`, apiKeyEnv: "WEBCAT_TEST_MODEL_KEY", model: "test-model", timeoutMs: 2000 });
    const binding = {
      modelName: "mcp_0_burp_get_proxy_http_history",
      server: "burp",
      tool: { name: "get_proxy_http_history", description: "Read proxy history", inputSchema: { type: "object" }, classification: { capability: "proxy.read", risk: "passive" } },
      description: "Read proxy history",
      inputSchema: { type: "object" }
    };
    const result = await provider.complete({
      role: "traffic-analyst",
      purpose: "Review traffic",
      objective: "Review authorized traffic",
      engagement: { id: "test", mode: "observe" },
      skillWorkflows: [],
      toolBindings: [binding],
      maxAgentTurns: 3,
      maxToolCalls: 1,
      executeTool: async (selected, args) => { execution = { selected, args }; return { result: { entries: [] }, evidence: { id: "evidence_1" } }; }
    });
    assert.equal(result.summary, "Reviewed one proxy item.");
    assert.equal(execution.selected.tool.name, "get_proxy_http_history");
    assert.deepEqual(execution.args, {});
    assert.equal(requestCount, 2);
  } finally {
    if (previous === undefined) delete process.env.WEBCAT_TEST_MODEL_KEY; else process.env.WEBCAT_TEST_MODEL_KEY = previous;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("target extraction recognizes saved Burp request response text", () => {
  const value = { content: [{ type: "text", text: "=== REQUEST DATA ===\nHost: app.example.test\nPort: 443\nProtocol: HTTPS\nGET /account HTTP/1.1\nHost: app.example.test\n\n" }] };
  assert.deepEqual(extractTargets(value), ["https://app.example.test/account"]);
});
