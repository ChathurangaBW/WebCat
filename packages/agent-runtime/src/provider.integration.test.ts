import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { ChatCompletionsProvider } from "./provider.js";

test("chat-completions provider parses tool calls", async () => {
  const server = http.createServer((req: any, res: any) => {
    let body = "";
    req.on("data", (chunk: string) => { body += chunk; });
    req.on("end", () => {
      const input = JSON.parse(body);
      assert.equal(input.model, "mock-model");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call_1",
              type: "function",
              function: { name: "webcat_record_observation", arguments: '{"summary":"ok"}' }
            }]
          }
        }]
      }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  process.env.WEBCAT_TEST_KEY = "test";
  try {
    const provider = new ChatCompletionsProvider({
      type: "chat-completions",
      baseUrl: `http://127.0.0.1:${port}/v1`,
      apiKeyEnv: "WEBCAT_TEST_KEY",
      model: "mock-model",
      timeoutMs: 5000,
      maxTokens: 1000,
      temperature: 0.1
    });
    const result = await provider.complete([{ role: "user", content: "test" }], [{ type: "function", function: { name: "webcat_record_observation", parameters: { type: "object" } } }]);
    assert.equal(result.toolCalls[0]?.name, "webcat_record_observation");
    assert.equal(result.toolCalls[0]?.arguments.summary, "ok");
  } finally {
    delete process.env.WEBCAT_TEST_KEY;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
