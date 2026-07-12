import fs from "node:fs/promises";
import path from "node:path";

async function walk(root) {
  for (const entry of await fs.readdir(root, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "dist") await fs.rm(full, { recursive: true, force: true });
      else await walk(full);
    } else if (entry.name.endsWith(".tsbuildinfo")) {
      await fs.rm(full, { force: true });
    }
  }
}
await walk("apps");
await walk("packages");
