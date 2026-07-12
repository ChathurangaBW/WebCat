#!/usr/bin/env node
import { executeCommand, VERSION } from "./cli.js";
import { runTui } from "./tui.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "tui";
  if (command === "tui") {
    await runTui(process.cwd());
    return;
  }
  await executeCommand(args, process.cwd());
}

main().catch((error: unknown) => {
  console.error(`webcat ${VERSION}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
