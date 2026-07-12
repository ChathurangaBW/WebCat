import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const cli = path.join(root, "apps", "webcat", "dist", "main.js");
const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "webcat-smoke-"));

async function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || `exit ${code}`)));
  });
}

assert.equal((await run(["--version"])).trim(), "1.0.0");
await run(["init"]);
const doctor = JSON.parse(await run(["doctor", "--json"]));
assert.equal(doctor.version, "1.0.0");
assert.equal(doctor.engagement.mode, "observe");
const scope = JSON.parse(await run(["scope-check", "https://app.example.test/api", "--operation", "passive"]));
assert.equal(scope.allowed, true);
console.log("WebCat smoke test passed.");
