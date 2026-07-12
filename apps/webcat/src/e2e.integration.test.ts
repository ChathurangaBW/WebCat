import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";

function execute(file: string, argumentsValue: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => execFile(file, argumentsValue, { cwd, env: process.env }, (error: Error | null, stdout: string, stderr: string) => error ? reject(Object.assign(error, { stdout, stderr })) : resolve({ stdout, stderr })));
}

test("compiled WebCat CLI completes a model-backed swarm session", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "webcat-e2e-"));
  const server = http.createServer((request: any, response: any) => {
    let body = "";
    request.on("data", (chunk: string) => { body += chunk; });
    request.on("end", () => {
      JSON.parse(body || "{}");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Lane completed. No candidate was created because no external evidence source was connected." } }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const cli = path.join(process.cwd(), "apps", "webcat", "dist", "main.js");
  try {
    await execute(process.execPath, [cli, "init"], cwd);
    await fs.writeFile(path.join(cwd, ".webcat", "config.toml"), `[provider]\ntype = "chat-completions"\nbaseUrl = "http://127.0.0.1:${port}/v1"\napiKeyEnv = ""\nmodel = "webcat-e2e"\ntimeoutMs = 5000\nmaxTokens = 1000\ntemperature = 0.1\n\n[swarm]\nmaxConcurrency = 3\nmaxAgentTurns = 3\nmaxRetries = 0\n\n[security]\nredactSecrets = true\nmaxEvidenceBytes = 1048576\nrequireApprovalForActive = false\n`);
    await fs.writeFile(path.join(cwd, ".webcat", "engagement.yaml"), `engagement:\n  id: e2e\n  name: WebCat End-to-End Validation\n  authorizationConfirmed: true\n  authorizationReference: LOCAL-E2E\n  mode: manual\n  maxRequestsPerSecond: 2\n  maxParallelRequests: 2\n  allowHighRisk: false\n  allowDestructive: false\n  allow:\n    - id: local\n      scheme: https\n      host: app.example.test\n      pathPrefix: /\n  deny: []\n`);
    const result = await execute(process.execPath, [cli, "run", "--objective", "Map the authorized API surface"], cwd);
    assert.match(result.stdout, /report written/);
    const session = JSON.parse(await fs.readFile(path.join(cwd, ".webcat", "state", "current.json"), "utf8"));
    assert.equal(session.state, "COMPLETED");
    assert.match(await fs.readFile(path.join(cwd, ".webcat", "reports", "report.md"), "utf8"), /WebCat Security Assessment/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(cwd, { recursive: true, force: true });
  }
});
