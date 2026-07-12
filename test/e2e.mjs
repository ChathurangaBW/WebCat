import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const cli = resolve(import.meta.dirname, "..", "bin", "webcat.mjs");
const cwd = await mkdtemp(resolve(tmpdir(), "webcat-e2e-"));

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

run(["init"]);
const engagementPath = resolve(cwd, ".webcat", "engagement.json");
const engagement = JSON.parse(await readFile(engagementPath, "utf8"));
Object.assign(engagement, {
  id: "e2e",
  authorizedBy: "Internal Security",
  authorizationReference: "TEST-ONLY",
  startsAt: "2020-01-01T00:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  allow: [{ id: "target", hosts: ["app.example.test"], schemes: ["https"], paths: ["/**"], operations: ["passive"] }]
});
await writeFile(engagementPath, JSON.stringify(engagement, null, 2));

const configPath = resolve(cwd, ".webcat", "config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
config.model.provider = "mock";
config.swarm.maxConcurrency = 3;
await writeFile(configPath, JSON.stringify(config, null, 2));

run(["doctor"]);
const result = JSON.parse(run(["run", "--objective", "Map the authorized API"]));
if (result.state !== "COMPLETED") throw new Error(`Unexpected state ${result.state}`);

const audit = JSON.parse(run(["audit", "verify"]));
if (!audit.valid || audit.records < 1) throw new Error("Audit verification failed.");

const evidence = JSON.parse(run(["evidence", "verify"]));
if (!evidence.valid) throw new Error("Evidence verification failed.");

run(["report", "--format", "markdown", "--output", ".webcat/reports/report.md"]);
const report = await readFile(resolve(cwd, ".webcat", "reports", "report.md"), "utf8");
if (!report.includes("# WebCat Security Assessment Report")) throw new Error("Report generation failed.");

console.log("WebCat packaged end-to-end check passed.");
