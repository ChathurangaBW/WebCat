import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ApprovalService } from "./approvals.js";
import { EngagementStore } from "./store.js";

test("store redacts evidence and resolves approvals", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "webcat-store-"));
  try {
    const store = new EngagementStore(cwd, true, 100_000);
    const evidence = await store.addEvidence("tester", "response", "token=topsecret", { authorization: "Bearer abc123", body: "safe" });
    const loaded = await store.readEvidence(evidence.id);
    assert.equal((loaded.data as any).authorization, "[REDACTED]");
    assert.match(loaded.summary, /REDACTED/);
    const approvals = new ApprovalService(store);
    const approval = await approvals.grant({ risk: "high", expiresAt: new Date(Date.now() + 60_000).toISOString(), createdBy: "operator", reason: "controlled scan", server: "proxy" });
    assert.equal((await approvals.findValid({ risk: "high", server: "proxy" }))?.id, approval.id);
    await approvals.revoke(approval.id);
    assert.equal(await approvals.findValid({ risk: "high", server: "proxy" }), undefined);
  } finally { await fs.rm(cwd, { recursive: true, force: true }); }
});
