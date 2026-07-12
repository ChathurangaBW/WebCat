import fs from "node:fs/promises";
import path from "node:path";

const engagement = `engagement:
  id: local-assessment
  name: Local Authorized Assessment
  authorizationConfirmed: false
  authorizationReference: CHANGE-ME
  mode: observe
  maxRequestsPerSecond: 2
  maxParallelRequests: 4
  allowHighRisk: false
  allowDestructive: false
  allow:
    - id: primary
      scheme: https
      host: app.example.test
      pathPrefix: /
  deny:
    - id: destructive-admin
      host: app.example.test
      pathPrefix: /admin/reset
`;

const config = `[provider]
type = "chat-completions"
baseUrl = "http://127.0.0.1:11434/v1"
apiKeyEnv = "WEBCAT_MODEL_API_KEY"
apiKeyRequired = false
model = "local-security-model"
timeoutMs = 120000
maxTokens = 4096
temperature = 0.1

[swarm]
maxConcurrency = 4
maxAgentTurns = 10
maxRetries = 2

[security]
redactSecrets = true
maxEvidenceBytes = 1048576
requireApprovalForActive = false
filterOutOfScopeMcpOutput = true
`;

const mcp = JSON.stringify({
  servers: {
    caido: {
      transport: "stdio",
      command: "caido-mcp-server",
      args: ["serve"],
      enabled: false,
      timeoutMs: 60000,
      env: {
        CAIDO_URL: "http://127.0.0.1:8080",
        CAIDO_PAT: "${CAIDO_PAT}"
      }
    },
    generic_http: {
      transport: "http",
      url: "http://127.0.0.1:9000/mcp",
      enabled: false,
      timeoutMs: 60000,
      headers: {
        Authorization: "Bearer ${WEBCAT_MCP_TOKEN}"
      },
      capabilities: {
        custom_replay: { name: "proxy.request.replay", risk: "active", trusted: true }
      }
    }
  }
}, null, 2) + "\n";

export async function initialize(cwd: string, force = false): Promise<string[]> {
  const directory = path.join(cwd, ".webcat");
  await fs.mkdir(directory, { recursive: true });
  const created: string[] = [];
  for (const [name, body] of [["engagement.yaml", engagement], ["config.toml", config], ["mcp.json", mcp]] as const) {
    const file = path.join(directory, name);
    try {
      if (!force) await fs.access(file);
      else throw new Error("overwrite");
    } catch {
      await fs.writeFile(file, body, { mode: 0o600 });
      created.push(file);
    }
  }
  for (const child of ["state", "evidence", "reports", "skills"]) {
    await fs.mkdir(path.join(directory, child), { recursive: true });
  }
  return created;
}
