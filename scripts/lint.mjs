import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";

// Dependency-free static checks. This is deliberately narrow: it verifies syntax, then applies
// a small set of rules that matter for a security tool where a silently swallowed promise or a
// stray debugging statement can mean a policy check never actually ran.
const roots = ["bin", "src", "scripts", "test"];
const files = [];
for (const root of roots) await collect(resolve(root));

// Built at runtime so this file does not match its own rule.
const DEBUG_STATEMENT = new RegExp(`\\b${["debug", "ger"].join("")}\\b`);
const problems = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(1);
  }
  await inspect(file);
}

if (problems.length) {
  console.error("Lint failed:");
  for (const problem of problems) console.error(`  ${problem.file}:${problem.line}: ${problem.message}`);
  process.exit(1);
}
console.log(`Lint passed for ${files.length} JavaScript modules (syntax, await/floating-promise, debug statements).`);

async function inspect(file) {
  const rel = relative(resolve("."), file);
  const isTest = rel.startsWith("test/") || rel.startsWith("scripts/");
  const lines = (await readFile(file, "utf8")).split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    const at = { file: rel, line: index + 1 };
    if (line.startsWith("//") || line.startsWith("*")) return;
    if (!isTest && /\bconsole\.(log|debug)\(/.test(line) && !rel.startsWith("src/cli") && !rel.startsWith("src/commands")) {
      problems.push({ ...at, message: "stray console.log/debug outside the CLI layer" });
    }
    if (DEBUG_STATEMENT.test(line)) problems.push({ ...at, message: "debug breakpoint statement" });
    // A bare call to a known-async policy/persistence method without await or an explicit
    // .then/.catch chain would let a refusal or an audit write race the caller.
    if (/^(?:this\.)?(?:audit|evidence|approvals|logger)\.[a-zA-Z]+\(/.test(line) && !/^await /.test(line)) {
      problems.push({ ...at, message: "floating promise on an audit/evidence/approval/logger call - add await" });
    }
    if (/catch\s*\(\s*\)\s*\{\s*\}/.test(line)) problems.push({ ...at, message: "empty catch block swallows an error" });
  });
}

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (/\.(?:mjs|js|cjs)$/.test(entry.name)) files.push(path);
  }
}
