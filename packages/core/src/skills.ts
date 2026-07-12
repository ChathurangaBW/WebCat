import fs from "node:fs/promises";
import path from "node:path";
import { webcatHome } from "./config.js";
import type { SkillDefinition } from "./types.js";

function parseFrontmatter(text: string): { metadata: Record<string, string>; body: string } {
  if (!text.startsWith("---")) return { metadata: {}, body: text.trim() };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { metadata: {}, body: text.trim() };
  const metadata: Record<string, string> = {};
  for (const line of text.slice(3, end).split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) metadata[match[1]!.trim()] = match[2]!.trim().replace(/^['"]|['"]$/g, "");
  }
  return { metadata, body: text.slice(end + 4).trim() };
}

async function walkSkillFiles(root: string): Promise<string[]> {
  const output: string[] = [];
  try {
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) output.push(...await walkSkillFiles(full));
      else if (entry.name === "SKILL.md") output.push(full);
    }
  } catch {
    // A missing optional skill directory is normal.
  }
  return output;
}

export async function loadSkills(cwd = process.cwd()): Promise<SkillDefinition[]> {
  const byName = new Map<string, SkillDefinition>();
  for (const root of [path.join(cwd, "skills"), path.join(webcatHome(), "skills"), path.join(cwd, ".webcat", "skills")]) {
    for (const file of await walkSkillFiles(root)) {
      const parsed = parseFrontmatter(await fs.readFile(file, "utf8"));
      const name = parsed.metadata.name || path.basename(path.dirname(file));
      byName.set(name, {
        name,
        description: parsed.metadata.description || "WebCat workflow skill",
        ...(parsed.metadata.whenToUse ? { whenToUse: parsed.metadata.whenToUse } : {}),
        body: parsed.body,
        source: file
      });
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
