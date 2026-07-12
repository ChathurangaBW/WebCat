#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import process from "node:process";

const root = resolve(process.cwd());
const forbidden = [
  ["ki", "mi"].join(""),
  ["moon", "shot"].join(""),
];
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  ".pnpm-store",
  "coverage",
  ".cache",
]);
const binaryExtensions = new Set([
  ".7z", ".a", ".bin", ".bmp", ".class", ".dll", ".dylib", ".eot",
  ".exe", ".gif", ".gz", ".ico", ".jar", ".jpeg", ".jpg", ".lockb",
  ".mp3", ".mp4", ".o", ".otf", ".pdf", ".png", ".so", ".tar", ".ttf",
  ".wasm", ".webm", ".webp", ".woff", ".woff2", ".zip",
]);

const findings = [];

function normalized(path) {
  return relative(root, path).split(sep).join("/") || ".";
}

function inspectName(path) {
  const lower = normalized(path).toLowerCase();
  for (const term of forbidden) {
    if (lower.includes(term)) {
      findings.push(`${normalized(path)}: prohibited term in path`);
    }
  }
}

function isProbablyBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  return sample.includes(0);
}

async function inspectFile(path) {
  if (binaryExtensions.has(extname(path).toLowerCase())) return;
  const buffer = await readFile(path);
  if (isProbablyBinary(buffer)) return;

  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const lower = lines[index].toLowerCase();
    for (const term of forbidden) {
      if (lower.includes(term)) {
        findings.push(`${normalized(path)}:${index + 1}: prohibited legacy reference`);
      }
    }
  }
}

async function walk(path) {
  inspectName(path);
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const child = resolve(path, entry.name);
    if (entry.isSymbolicLink()) {
      inspectName(child);
      continue;
    }
    if (entry.isDirectory()) {
      await walk(child);
      continue;
    }
    if (entry.isFile()) {
      inspectName(child);
      await inspectFile(child);
    }
  }
}

try {
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) throw new Error("Repository root is not a directory");
  await walk(root);
} catch (error) {
  console.error(`Branding verification failed to run: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

if (findings.length > 0) {
  console.error("WebCat branding verification failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("WebCat branding verification passed: no prohibited legacy references found.");
