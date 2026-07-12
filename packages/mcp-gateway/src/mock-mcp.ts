import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line: string) => {
  const message = JSON.parse(line) as { id?: number; method: string; params?: Record<string, unknown> };
  if (message.id === undefined) return;
  let result: unknown;
  if (message.method === "initialize") {
    result = { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "webcat-test-mcp", version: "1" } };
  } else if (message.method === "tools/list") {
    result = {
      tools: [{
        name: "get_history",
        description: "Return mock in-scope and out-of-scope history",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true }
      }]
    };
  } else if (message.method === "tools/call") {
    result = {
      content: [{ type: "text", text: "https://app.test/api/users and https://outside.test/private" }],
      records: [
        { url: "https://app.test/api/users", status: 200 },
        { url: "https://outside.test/private", status: 200 }
      ]
    };
  } else {
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "method not found" } })}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n`);
});
