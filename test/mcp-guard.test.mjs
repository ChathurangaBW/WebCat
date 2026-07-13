import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyTool, extractTarget, McpGuard } from "../src/mcp.mjs";
import { ApprovalStore } from "../src/approvals.mjs";
import { AuditLog } from "../src/audit.mjs";
import { EvidenceStore } from "../src/evidence.mjs";

const engagement = {
  id: "test", name: "test", authorizedBy: "QA", authorizationReference: "QA-1",
  startsAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), mode: "manual",
  allow: [{ id: "allow", hosts: ["app.example.test"], schemes: ["https"], paths: ["/**"], operations: ["passive", "active"] }], deny: [],
  rateLimit: { requestsPerMinute: 100000, maxParallel: 2 }, riskPolicy: { allowHighRisk: false, allowDestructive: false }
};

test("tool classification is conservative and target extraction works", () => {
  assert.equal(classifyTool("proxy", { name: "list_requests" }, {}).risk, "passive");
  assert.equal(classifyTool("proxy", { name: "send_request" }, {}).trusted, false);
  assert.equal(extractTarget({ nested: { url: "https://app.example.test/api" } }), "https://app.example.test/api");
});

test("guard blocks untrusted active tools and out-of-scope targets", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-guard-test-"));
  try {
    const manager = { config: { servers: { proxy: {} } }, call: async () => ({ ok: true }) };
    const guard = new McpGuard({ engagement, manager, approvals: new ApprovalStore(join(temp, "approvals.json")), audit: new AuditLog(join(temp, "audit.jsonl")), evidence: new EvidenceStore(join(temp, "evidence")) });
    await assert.rejects(() => guard.call("proxy", { name: "send_request" }, { url: "https://app.example.test/api" }), /explicit capabilityMap/);
    manager.config.servers.proxy.capabilityMap = { send_request: { capability: "http.execute", risk: "active", requiresTarget: true } };
    await assert.rejects(() => guard.call("proxy", { name: "send_request" }, { url: "https://outside.example/api" }, { approve: true }), /outside/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("guard records redacted evidence for approved in-scope calls", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-guard-success-"));
  try {
    const manager = {
      config: { servers: { proxy: { capabilityMap: { send_request: { capability: "http.execute", risk: "active", requiresTarget: true } } } } },
      call: async () => ({ url: "https://app.example.test/api", authorization: "Bearer private", body: "ok" })
    };
    const evidence = new EvidenceStore(join(temp, "evidence"));
    const guard = new McpGuard({ engagement, manager, approvals: new ApprovalStore(join(temp, "approvals.json")), audit: new AuditLog(join(temp, "audit.jsonl")), evidence });
    const result = await guard.call("proxy", { name: "send_request" }, { url: "https://app.example.test/api" }, { approve: true });
    assert.equal(result.evidence.body.authorization, "[REDACTED]");
    assert.equal((await evidence.verify()).every((item) => item.valid), true);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
