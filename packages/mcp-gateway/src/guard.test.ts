import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ApprovalService, DEFAULT_CONFIG, EngagementStore, type Engagement } from "@webcat/core";
import { authorizeMcpCall } from "./guard.js";

const engagement: Engagement = {
  id: "e", name: "e", authorizationConfirmed: true, authorizationReference: "AUTH-1", mode: "manual",
  allow: [{ id: "a", scheme: "https", host: "app.test", pathPrefix: "/" }], deny: [],
  maxRequestsPerSecond: 2, maxParallelRequests: 2, allowHighRisk: true, allowDestructive: false
};

test("guard requires approval for high-risk mapped tools", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "webcat-guard-"));
  try {
    const store = new EngagementStore(cwd);
    const approvals = new ApprovalService(store);
    const tool = { name: "custom_scan", annotations: { webcatCapability: "scanner.run", webcatRisk: "high", webcatTrusted: true } };
    const blocked = await authorizeMcpCall(engagement, DEFAULT_CONFIG, approvals, { server: "scanner", tool, arguments: { url: "https://app.test/" } });
    assert.equal(blocked.allowed, false);
    await approvals.grant({ risk: "high", server: "scanner", tool: "custom_scan", expiresAt: new Date(Date.now() + 60_000).toISOString(), createdBy: "operator", reason: "approved" });
    const allowed = await authorizeMcpCall(engagement, DEFAULT_CONFIG, approvals, { server: "scanner", tool, arguments: { url: "https://app.test/" } });
    assert.equal(allowed.allowed, true);
  } finally { await fs.rm(cwd, { recursive: true, force: true }); }
});
