#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";

const directory = new URL("../src/chunks/", import.meta.url);
const parts = (await readdir(directory)).filter((name) => name.endsWith(".txt")).sort();
const source = (await Promise.all(parts.map((name) => readFile(new URL(name, directory), "utf8")))).join("");
const runtime = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

runtime.main(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`webcat: ${message}`);
  if (process.env.WEBCAT_DEBUG === "1" && error instanceof Error) console.error(error.stack);
  process.exitCode = 1;
});
