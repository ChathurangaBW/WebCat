#!/usr/bin/env node
import { readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const root = resolve(process.cwd());
const builtOnly = process.argv.includes("--built-only");
const first = ["ki", "mi"].join("");
const second = ["moon", "shot"].join("");
const prohibited = new RegExp(`${first}|${second.replace("shot", "\\s*shot")}`, "i");
const ignoredDirectories = new Set([".git", "node_modules", "coverage", ".cache", ".tmp", "tmp"]);
const legalAllowlist = new Set(["THIRD_PARTY_NOTICES.md"]);
const textExtensions = new Set([
  ".cjs", ".css", ".d.ts", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".mts",
  ".ps1", ".sh", ".snap", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml"
]);
const extensionlessText = new Set(["LICENSE", "NOTICE", "README", ".gitignore"]);
const violations = [];

for (const base of builtOnly ? ["dist", "build"].filter(Boolean) : ["."]) {
  const absolute = resolve(root, base);
  try { await stat(absolute); } catch { continue; }
  await walk(absolute);
}

if (violations.length) {
  console.error("WebCat branding verification failed:");
  for (const violation of violations) console.error(`${violation.path}${violation.line ? `:${violation.line}` : ""}: ${violation.match}`);
  process.exitCode = 1;
} else {
  console.log(`WebCat branding verification passed (${builtOnly ? "built output" : "repository"}).`);
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    const rel = normalize(relative(root, absolute));
    if (entry.isDirectory()) {
      if (prohibited.test(entry.name)) violations.push({ path: rel, match: "prohibited directory name" });
      await walk(absolute);
      continue;
    }
    if (!entry.isFile()) continue;
    if (prohibited.test(entry.name)) violations.push({ path: rel, match: "prohibited filename" });
    if (!isText(entry.name)) continue;
    if (legalAllowlist.has(rel)) continue;
    const content = await readFile(absolute, "utf8");
    content.split(/\r?\n/).forEach((line, index) => {
      const match = line.match(prohibited);
      if (match) violations.push({ path: rel, line: index + 1, match: match[0] });
    });
  }
}

function isText(name) {
  if (extensionlessText.has(name)) return true;
  const lower = name.toLowerCase();
  return [...textExtensions].some((extension) => lower.endsWith(extension));
}
function normalize(value) { return value.split(sep).join("/") || "."; }
