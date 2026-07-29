import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const temp = await mkdtemp(join(tmpdir(), "webcat-smoke-"));
const project = join(temp, "project");
const home = join(temp, "runtime");
await import("node:fs/promises").then(({ mkdir }) => mkdir(project, { recursive: true }));
const cli = resolve("bin/webcat.mjs");
const env = { ...process.env, WEBCAT_HOME: home };
try {
  run([cli, "init"], project, env);
  const engagementPath = join(project, ".webcat", "engagement.json");
  const engagement = JSON.parse(await readFile(engagementPath, "utf8"));
  engagement.authorizedBy = "QA authorizer";
  engagement.authorizationReference = "QA-123";
  engagement.startsAt = new Date(Date.now() - 60_000).toISOString();
  engagement.expiresAt = new Date(Date.now() + 3_600_000).toISOString();
  await writeFile(engagementPath, `${JSON.stringify(engagement, null, 2)}\n`);
  run([cli, "doctor"], project, env);
  run([cli, "scope-check", "https://app.example.test/health", "--operation", "passive"], project, env);
  run([cli, "run", "--objective", "Review the authorized application using the deterministic mock provider"], project, env);
  run([cli, "audit", "verify"], project, env);
  run([cli, "evidence", "verify"], project, env);
  run([cli, "report", "--format", "markdown"], project, env);

  // The product's core promise is refusal, so the happy path alone is not a sufficient gate.
  expectFailure([cli, "scope-check", "https://not-authorized.example/", "--operation", "passive"], project, env, "out-of-scope target");
  expectFailure([cli, "scope-check", "https://app.example.test/health", "--operation", "active"], project, env, "active operation in observe mode");
  expectFailure([cli, "scope-check", "https://app.example.test/health", "--oepration", "passive"], project, env, "mistyped option");
  // The '=' form must be honoured rather than silently ignored and evaluated as passive.
  expectFailure([cli, "scope-check", "https://app.example.test/health", "--operation=active"], project, env, "active operation via --operation=");
  run([cli, "audit", "verify"], project, env);
  const log = await readFile(join(home, "state", "logs", "webcat.log"), "utf8");
  if (!log.includes('"product":"WebCat"')) throw new Error("Smoke log did not contain WebCat identity");
  console.log("Smoke workflow passed.");
} finally {
  await rm(temp, { recursive: true, force: true });
}

function run(args, cwd, env) {
  const result = spawnSync(process.execPath, args, { cwd, env, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Command failed: node ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function expectFailure(args, cwd, env, label) {
  const result = spawnSync(process.execPath, args, { cwd, env, encoding: "utf8" });
  if (result.status === 0) throw new Error(`Expected refusal for ${label}, but the command succeeded:\n${result.stdout}`);
  return result;
}
