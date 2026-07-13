import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const dist = resolve(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(resolve(root, "src"), resolve(dist, "src"), { recursive: true });
await writeFile(resolve(dist, "webcat.mjs"), `#!/usr/bin/env node\nimport { main } from "./src/cli.mjs";\nprocess.title = "webcat";\nprocess.exitCode = await main(process.argv.slice(2));\n`, { mode: 0o755 });
console.log("Built dist/webcat.mjs");
