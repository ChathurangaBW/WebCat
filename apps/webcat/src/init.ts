import fs from "node:fs/promises";
import path from "node:path";

const engagement = `engagement:\n  id: local-assessment\n  name: Local Authorized Assessment\n  authorizationConfirmed: false\n  authorizationReference: CHANGE-ME\n  mode: observe\n  maxRequestsPerSecond: 2\n  maxParallelRequests: 4\n  allowHighRisk: false\n  allowDestructive: false\n  allow:\n    - id: primary\n      scheme: https\n      host: app.example.test\n      port: 443\n      pathPrefix: /\n  deny:\n    - id: destructive-admin\n      host: app.example.test\n      pathPrefix: /admin/reset\n`;

const config = `[provider]\ntype = "chat-completions"\nbaseUrl = "http://127.0.0.1:11434/v1"\napiKeyEnv = "WEBCAT_MODEL_API_KEY"\nmodel = "webcat-model"\ntimeoutMs = 120000\nmaxTokens = 4096\ntemperature = 0.1\n\n[swarm]\nmaxConcurrency = 4\nmaxAgentTurns = 10\nmaxRetries = 2\n\n[security]\nredactSecrets = true\nmaxEvidenceBytes = 1048576\nrequireApprovalForActive = false\n`;

const mcp = `${JSON.stringify({ servers: { proxy: { transport: "stdio", command: "security-proxy-mcp", args: ["serve"], enabled: false, timeoutMs: 60000, enabledTools: [], disabledTools: [] } } }, null, 2)}\n`;

export async function initialize(cwd: string, force = false): Promise<string[]> {
  const directory = path.join(cwd, ".webcat");
  await fs.mkdir(directory, { recursive: true });
  const created: string[] = [];
  for (const [name, body] of [["engagement.yaml", engagement], ["config.toml", config], ["mcp.json", mcp]] as const) {
    const file = path.join(directory, name);
    let exists = false;
    try { await fs.access(file); exists = true; } catch {}
    if (!exists || force) { await fs.writeFile(file, body, { mode: 0o600 }); created.push(file); }
  }
  for (const subdirectory of ["state", "evidence", "reports", "skills"]) await fs.mkdir(path.join(directory, subdirectory), { recursive: true });
  return created;
}
