import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const temp = await mkdtemp(join(tmpdir(), "webcat-relocation-"));
const scenarios = [join(temp, "webcat-qa", "webcat"), join(temp, "random-parent-name", "project")];
try {
  for (const target of scenarios) {
    await mkdir(target, { recursive: true });
    await copyRelease(root, target);
    const env = { ...process.env, WEBCAT_HOME: join(target, ".qa-runtime") };
    run(process.execPath, ["bin/webcat.mjs", "--help"], target, env);
    run(process.execPath, ["bin/webcat.mjs", "--version"], target, env);
    run(process.execPath, ["scripts/build.mjs"], target, env);
    run(process.execPath, ["dist/webcat.mjs", "--help"], target, env);
  }
  const packDirectory = join(temp, "pack");
  await mkdir(packDirectory, { recursive: true });
  const pack = run("npm", ["pack", "--pack-destination", packDirectory, "--json"], scenarios[0], process.env);
  const filename = JSON.parse(pack)[0].filename;
  const prefix = join(temp, "installed");
  run("npm", ["install", "--prefix", prefix, join(packDirectory, filename), "--ignore-scripts", "--no-audit", "--no-fund"], temp, process.env);
  const executable = process.platform === "win32" ? join(prefix, "node_modules", ".bin", "webcat.cmd") : join(prefix, "node_modules", ".bin", "webcat");
  run(executable, ["--help"], temp, { ...process.env, WEBCAT_HOME: join(temp, "installed-runtime") });
  console.log("Relocation and installed-command regression passed.");
} finally {
  await rm(temp, { recursive: true, force: true });
}

async function copyRelease(source, target) {
  const ignored = new Set([".git", "node_modules", "dist", "build", "coverage", ".webcat"]);
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    await cp(join(source, entry.name), join(target, entry.name), { recursive: true, preserveTimestamps: true });
  }
}

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error(`Command failed in ${basename(cwd)}: ${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
