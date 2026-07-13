import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { AuditLog } from "../src/audit.mjs";

const root = resolve(process.cwd());

test("audit writes remain valid under concurrent append operations", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-audit-test-"));
  try {
    const audit = new AuditLog(join(temp, "audit.jsonl"));
    await Promise.all(Array.from({ length: 20 }, (_, index) => audit.append("test", "qa", { index })));
    assert.deepEqual(await audit.verify(), { valid: true, entries: 20, head: (await audit.read()).at(-1).hash });
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("CLI exposes WebCat command surface", () => {
  const help = run(["bin/webcat.mjs", "--help"]);
  const version = run(["bin/webcat.mjs", "--version"]);
  assert.match(help, /WebCat/);
  assert.match(help, /webcat doctor/);
  assert.equal(version.trim(), "1.1.0");
});

test("permanent branding verifier passes", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-webcat-branding.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

function run(args) {
  const tempHome = join(tmpdir(), `webcat-cli-${process.pid}-${Math.random().toString(16).slice(2)}`);
  const result = spawnSync(process.execPath, args, { cwd: root, env: { ...process.env, WEBCAT_HOME: tempHome }, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
