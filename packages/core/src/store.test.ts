import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EngagementStore } from "./store.js";

test("audit records form a verifiable hash chain", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "webcat-store-"));
  const store = new EngagementStore(directory);
  await store.appendAudit("one", "test", "completed", { token: "secret" });
  await store.appendAudit("two", "test", "completed", {});
  assert.deepEqual(await store.verifyAuditChain(), { valid: true });
});

test("evidence is redacted and hashed", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "webcat-evidence-"));
  const store = new EngagementStore(directory);
  const evidence = await store.addEvidence("agent", "observation", "secret", { cookie: "abc" });
  assert.equal((evidence.data as any).cookie, "[REDACTED]");
  assert.equal(evidence.sha256.length, 64);
});
