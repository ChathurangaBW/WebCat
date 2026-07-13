import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateScope, hostMatches, pathMatches } from "../src/scope.mjs";
import { ApprovalStore } from "../src/approvals.mjs";

function engagement(overrides = {}) {
  return {
    id: "test", name: "test", authorizedBy: "QA", authorizationReference: "QA-1",
    startsAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    mode: "manual",
    allow: [{ id: "allow", hosts: ["app.example.test", "*.allowed.example"], schemes: ["https"], paths: ["/**"], operations: ["passive", "active", "high", "destructive"] }],
    deny: [{ id: "deny", hosts: ["app.example.test"], paths: ["/admin/delete/**"], operations: ["active", "high", "destructive"] }],
    rateLimit: { requestsPerMinute: 60, maxParallel: 2 },
    riskPolicy: { allowHighRisk: false, allowDestructive: false, approvalTtlMinutes: 20 },
    ...overrides
  };
}

test("host and path matching are wildcard-safe", () => {
  assert.equal(hostMatches("*.allowed.example", "api.allowed.example"), true);
  assert.equal(hostMatches("*.allowed.example", "allowed.example"), false);
  assert.equal(hostMatches("*.allowed.example", "evilallowed.example"), false);
  assert.equal(pathMatches("/api/**", "/api/v1/users"), true);
  assert.equal(pathMatches("/api/*", "/api/v1/users"), false);
});

test("deny rules take precedence and out-of-scope targets are blocked", () => {
  assert.equal(evaluateScope(engagement(), "https://app.example.test/admin/delete/1", "active").allowed, false);
  assert.equal(evaluateScope(engagement(), "https://other.example.test/", "passive").allowed, false);
  assert.equal(evaluateScope(engagement(), "https://app.example.test/api", "passive").allowed, true);
});

test("observe mode blocks active operations and expired authorization blocks all operations", () => {
  assert.match(evaluateScope(engagement({ mode: "observe" }), "https://app.example.test/api", "active").reason, /Observe mode/);
  assert.match(evaluateScope(engagement({ expiresAt: new Date(Date.now() - 1).toISOString() }), "https://app.example.test/api", "passive").reason, /expired/);
});

test("approvals expire and revoke", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-approval-test-"));
  try {
    const store = new ApprovalStore(join(temp, "approvals.json"));
    const now = new Date("2026-01-01T00:00:00Z");
    const approval = await store.grant({ risk: "active", ttlMinutes: 20, reason: "QA", server: "proxy", tool: "send", target: "https://app.example.test/*" }, now);
    assert.equal(await store.permits({ risk: "active", server: "proxy", tool: "send", target: "https://app.example.test/api" }, new Date("2026-01-01T00:10:00Z")), true);
    assert.equal(await store.permits({ risk: "active", server: "proxy", tool: "send", target: "https://app.example.test/api" }, new Date("2026-01-01T00:21:00Z")), false);
    await store.revoke(approval.id, new Date("2026-01-01T00:05:00Z"));
    assert.equal(await store.permits({ risk: "active", server: "proxy", tool: "send", target: "https://app.example.test/api" }, new Date("2026-01-01T00:06:00Z")), false);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
