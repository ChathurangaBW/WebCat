import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, loadMcpConfig } from "../src/config.mjs";
import { projectPaths, userPaths } from "../src/paths.mjs";

test("project configuration overrides user configuration", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-config-test-"));
  try {
    const project = join(temp, "project");
    const home = join(temp, "home");
    const users = userPaths({ platform: "linux", home, env: { WEBCAT_HOME: home } });
    await mkdir(users.config, { recursive: true });
    await mkdir(projectPaths(project).project, { recursive: true });
    await writeFile(users.userConfig, `[swarm]\nmaxConcurrency = 2\n[logging]\nlevel = "warn"\n`);
    await writeFile(projectPaths(project).config, `[swarm]\nmaxConcurrency = 5\n`);
    const config = await loadConfig(project, { userPaths: users });
    assert.equal(config.swarm.maxConcurrency, 5);
    assert.equal(config.logging.level, "warn");
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("MCP configuration supports stdio, HTTP, SSE, interpolation, and project override", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-mcp-test-"));
  try {
    const project = join(temp, "project");
    const home = join(temp, "home");
    const users = userPaths({ platform: "linux", home, env: { WEBCAT_HOME: home } });
    await mkdir(users.config, { recursive: true });
    await mkdir(projectPaths(project).project, { recursive: true });
    await writeFile(users.userMcp, JSON.stringify({ schemaVersion: 1, servers: {
      local: { transport: "stdio", command: "node", args: ["server.mjs"], enabled: true, enabledTools: ["read"] },
      remote: { transport: "http", url: "https://example.test/mcp", headers: { authorization: "Bearer ${TOKEN}" } }
    }}));
    await writeFile(projectPaths(project).mcp, JSON.stringify({ schemaVersion: 1, servers: {
      local: { transport: "stdio", command: "node", args: ["replacement.mjs"], enabled: false, disabledTools: ["write"], timeoutMs: 1000 },
      events: { transport: "sse", url: "https://events.example.test/mcp", enabled: false }
    }}));
    const config = await loadMcpConfig(project, { userPaths: users, env: { TOKEN: "redacted-token" } });
    assert.equal(config.servers.local.args[0], "replacement.mjs");
    assert.equal(config.servers.local.enabled, false);
    assert.equal(config.servers.remote.headers.authorization, "Bearer redacted-token");
    assert.equal(config.servers.events.transport, "sse");
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("invalid MCP configuration is rejected", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-invalid-mcp-"));
  try {
    const project = join(temp, "project");
    await mkdir(projectPaths(project).project, { recursive: true });
    await writeFile(projectPaths(project).mcp, JSON.stringify({ servers: { broken: { transport: "stdio" } } }));
    await assert.rejects(() => loadMcpConfig(project, { userPaths: userPaths({ platform: "linux", home: temp, env: { WEBCAT_HOME: join(temp, "home") } }) }), /requires command/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
