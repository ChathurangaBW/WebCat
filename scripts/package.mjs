import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = process.cwd();
const releaseRoot = path.join(root, "release");
const packageRoot = path.join(releaseRoot, "webcat");

await fs.rm(releaseRoot, { recursive: true, force: true });
await fs.mkdir(path.join(packageRoot, "dist", "packages"), { recursive: true });

const packageNames = ["core", "mcp-gateway", "agent-profiles", "agent-runtime"];
await copyTree(path.join(root, "apps", "webcat", "dist"), path.join(packageRoot, "dist", "cli"));
for (const name of packageNames) await copyTree(path.join(root, "packages", name, "dist"), path.join(packageRoot, "dist", "packages", name));
await copyTree(path.join(root, "skills"), path.join(packageRoot, "skills"));
for (const file of ["README.md", "LICENSE", "SECURITY.md", "NOTICE.md"]) await fs.copyFile(path.join(root, file), path.join(packageRoot, file));

await rewriteImports(path.join(packageRoot, "dist", "cli"), {
  "@webcat/core": "../packages/core/index.js",
  "@webcat/mcp-gateway": "../packages/mcp-gateway/index.js",
  "@webcat/agent-profiles": "../packages/agent-profiles/index.js",
  "@webcat/agent-runtime": "../packages/agent-runtime/index.js"
});
await rewriteImports(path.join(packageRoot, "dist", "packages", "mcp-gateway"), { "@webcat/core": "../core/index.js" });
await rewriteImports(path.join(packageRoot, "dist", "packages", "agent-runtime"), {
  "@webcat/core": "../core/index.js",
  "@webcat/mcp-gateway": "../mcp-gateway/index.js",
  "@webcat/agent-profiles": "../agent-profiles/index.js"
});

await fs.writeFile(path.join(packageRoot, "package.json"), JSON.stringify({
  name: "webcat",
  version: "1.0.0",
  description: "Terminal-native AI swarm for authorized web application security assessment",
  license: "MIT",
  type: "module",
  bin: { webcat: "dist/cli/main.js" },
  engines: { node: ">=22.0.0" },
  files: ["dist", "skills", "README.md", "LICENSE", "SECURITY.md", "NOTICE.md"]
}, null, 2) + "\n");
await fs.chmod(path.join(packageRoot, "dist", "cli", "main.js"), 0o755);

const { stdout } = await exec("npm", ["pack", "--silent"], { cwd: packageRoot });
const archiveName = stdout.trim().split(/\r?\n/).at(-1);
if (!archiveName) throw new Error("npm pack did not return an archive name");
await fs.rename(path.join(packageRoot, archiveName), path.join(releaseRoot, "webcat-1.0.0.tgz"));
console.log(path.join(releaseRoot, "webcat-1.0.0.tgz"));

async function copyTree(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (/\.test\.|\.test$|\.map$|tsbuildinfo|mock-mcp/.test(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyTree(from, to); else await fs.copyFile(from, to);
  }
}

async function rewriteImports(directory, mappings) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await rewriteImports(file, mappings);
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts")) {
      let text = await fs.readFile(file, "utf8");
      for (const [from, to] of Object.entries(mappings)) text = text.replaceAll(`"${from}"`, `"${to}"`).replaceAll(`'${from}'`, `'${to}'`);
      await fs.writeFile(file, text);
    }
  }
}
