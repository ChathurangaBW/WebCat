import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const cli = resolve(import.meta.dirname, "..", "bin", "webcat.mjs");

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });
}

test("version and profile catalog are available", () => {
  const version = run(["--version"], process.cwd());
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), "1.0.0");

  const profiles = run(["profiles", "--json"], process.cwd());
  assert.equal(profiles.status, 0, profiles.stderr);
  const parsed = JSON.parse(profiles.stdout);
  assert.ok(parsed.some((profile) => profile.name === "scope-guardian"));
  assert.ok(parsed.some((profile) => profile.name === "finding-validator"));
});

test("scope engine blocks lookalike domains and honors exact scope", async () => {
  const cwd = await mkdtemp(resolve(tmpdir(), "webcat-scope-"));
  assert.equal(run(["init"], cwd).status, 0);
  const path = resolve(cwd, ".webcat", "engagement.json");
  const engagement = JSON.parse(await readFile(path, "utf8"));
  Object.assign(engagement, {
    id: "test",
    authorizedBy: "Internal Security",
    authorizationReference: "TEST",
    startsAt: "2020-01-01T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    allow: [{ id: "target", hosts: ["*.example.test"], schemes: ["https"], paths: ["/**"], operations: ["passive"] }],
    deny: []
  });
  await writeFile(path, JSON.stringify(engagement, null, 2));

  assert.equal(run(["scope-check", "https://api.example.test/x", "--operation", "passive"], cwd).status, 0);
  assert.equal(run(["scope-check", "https://evil-example.test/x", "--operation", "passive"], cwd).status, 2);
});
