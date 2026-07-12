import readline from "node:readline/promises";
import { loadEngagement, loadAppConfig, EngagementStore } from "@webcat/core";
import { executeCommand } from "./cli.js";

function splitCommandLine(input: string): string[] {
  const output: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  let escaped = false;
  for (const character of input) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = undefined;
      else current += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) output.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (current) output.push(current);
  return output;
}

async function banner(cwd: string): Promise<void> {
  const config = await loadAppConfig(cwd);
  const engagement = await loadEngagement(cwd);
  const store = new EngagementStore(cwd, config.security.redactSecrets, config.security.maxEvidenceBytes);
  const current = await store.loadSession();
  console.log(`
╭────────────────────────────────────────────────────────────╮
│ WebCat Terminal Security Swarm                             │
├────────────────────────────────────────────────────────────┤
│ Engagement : ${engagement.name.slice(0, 43).padEnd(43)} │
│ Mode       : ${engagement.mode.padEnd(43)} │
│ Authorized : ${String(engagement.authorizationConfirmed).padEnd(43)} │
│ Session    : ${(current?.state ?? "none").padEnd(43)} │
╰────────────────────────────────────────────────────────────╯
Authorized targets only. Type /help for commands.
`);
}

export async function runTui(cwd: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await banner(cwd);
  let running = true;
  while (running) {
    let line: string;
    try {
      line = (await rl.question("webcat> ")).trim();
    } catch {
      break;
    }
    if (!line) continue;
    const parsed = splitCommandLine(line);
    const command = parsed[0] ?? "";
    if (["/quit", "/exit", "quit", "exit"].includes(command)) {
      running = false;
      continue;
    }
    const aliases: Record<string, string[]> = {
      "/help": ["help"],
      "/status": ["doctor"],
      "/profiles": ["profiles"],
      "/skills": ["skills"],
      "/mcp": ["mcp", "status"],
      "/findings": ["findings", "list"],
      "/hypotheses": ["hypotheses", "list"],
      "/evidence": ["evidence", "list"],
      "/approvals": ["approvals", "list"],
      "/sessions": ["sessions", "list"],
      "/report": ["report"],
      "/resume": ["resume"],
      "/run": ["run", "--objective", parsed.slice(1).join(" ")]
    };
    const args = aliases[command] ?? parsed.map((item, index) => index === 0 && item.startsWith("/") ? item.slice(1) : item);
    try {
      await executeCommand(args, cwd);
    } catch (error) {
      console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  rl.close();
}
