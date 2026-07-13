import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const roots = ["bin", "src", "scripts", "test"];
const files = [];
for (const root of roots) await collect(resolve(root));
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(1);
  }
}
console.log(`Syntax lint passed for ${files.length} JavaScript modules.`);

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (/\.(?:mjs|js|cjs)$/.test(entry.name)) files.push(path);
  }
}
