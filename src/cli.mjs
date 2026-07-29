import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { IDENTITY, banner } from "./identity.mjs";
import { userPaths } from "./paths.mjs";
import { Logger } from "./logger.mjs";
import { initCommand, doctorCommand, pathsCommand, scopeCheckCommand, profilesCommand, mcpCommand, burpCommand, approvalsCommand } from "./commands-core.mjs";
import { runCommand, resumeCommand, sessionsCommand, recordsCommand, evidenceCommand, auditCommand, reportCommand } from "./commands-runtime.mjs";
import { tokenize } from "./cli-utils.mjs";

export async function main(argv, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const users = userPaths({ env });
  const logger = new Logger({ paths: users, level: env[IDENTITY.environment.logLevel] });
  const [command = "tui", ...rest] = argv;
  try {
    await logger.info("command.started", { command, cwd });
    const result = await dispatch(command, rest, { cwd, env, users, logger });
    await logger.info("command.completed", { command, code: result });
    return result;
  } catch (error) {
    await logger.error("command.failed", { command, error: error.message });
    console.error(`WebCat error: ${error.message}`);
    return 1;
  }
}

async function dispatch(command, args, context) {
  if (["--help", "-h", "help"].includes(command)) { console.log(helpText()); return 0; }
  if (["--version", "-V", "version"].includes(command)) { console.log(IDENTITY.version); return 0; }
  switch (command) {
    case "init": return initCommand(args, context);
    case "doctor": return doctorCommand(args, context);
    case "paths": return pathsCommand(args, context);
    case "scope-check": return scopeCheckCommand(args, context);
    case "profiles": return profilesCommand(args);
    case "mcp": return mcpCommand(args, context);
    case "burp": return burpCommand(args, context);
    case "approvals": return approvalsCommand(args, context);
    case "run": return runCommand(args, context);
    case "resume": return resumeCommand(args, context);
    case "sessions": return sessionsCommand(args, context);
    case "findings": return recordsCommand("findings", args, context);
    case "hypotheses": return recordsCommand("hypotheses", args, context);
    case "evidence": return evidenceCommand(args, context);
    case "audit": return auditCommand(args, context);
    case "report": return reportCommand(args, context);
    case "tui": return tuiCommand(context);
    default: throw new Error(`Unknown command ${command}. Run webcat --help.`);
  }
}

export function helpText() {
  return `${banner()}

Usage:
  webcat init [--force]
  webcat doctor [--json]
  webcat paths [--json]
  webcat scope-check <url> [--operation passive|active|high|destructive] [--json]
  webcat profiles [--json]
  webcat mcp status|tools|refresh [server] [--json]
  webcat mcp call <server> <tool> --args '{"url":"https://target"}' [--approve]
  webcat burp status|doctor|tools [server] [--json]
  webcat burp presets|skills [--json]
  webcat approvals list|grant|revoke
  webcat run --objective "Authorized assessment objective" [--json]
  webcat resume [session-id] [--json]
  webcat sessions list|show [session-id]
  webcat findings list|show [finding-id]
  webcat hypotheses list|show [hypothesis-id]
  webcat evidence list|verify
  webcat audit list|verify
  webcat report [session-id] [--format markdown|json]
  webcat tui

Burp MCP:
  Presets support the official PortSwigger SSE/stdio server, BurpMCP SSE,
  and Burp MCP Bridge over stdio or streamable HTTP. Dangerous tools are disabled by default.

Configuration:
  Project: .webcat/config.toml, .webcat/engagement.json, .webcat/mcp.json
  User:    ${IDENTITY.environment.configHome} or the platform WebCat configuration directory
  Log:     ${IDENTITY.environment.logFile} or the platform WebCat state/log directory

Safety:
  External actions require current written authorization, an explicit in-scope target,
  permitted engagement mode and risk policy, and operator approval where required.`;
}

async function tuiCommand(context) {
  const terminal = createInterface({ input: stdin, output: stdout });
  process.stdout.write(`\u001b]0;${IDENTITY.productName}\u0007`);
  console.log(`\n${banner()}\nType /help for commands and /exit to close.\n`);
  try {
    // On EOF (closed or piped stdin) question() never settles, which would otherwise leave the
    // process hanging on an unsettled top-level await. Race it against the close event so the
    // TUI exits cleanly instead.
    let closed = false;
    terminal.once("close", () => { closed = true; });
    const endOfInput = Symbol("end-of-input");
    const nextLine = () => Promise.race([
      terminal.question("webcat> "),
      new Promise((resolve) => terminal.once("close", () => resolve(endOfInput)))
    ]);
    while (!closed) {
      let line;
      try { line = await nextLine(); }
      catch { break; }
      if (line === endOfInput) { console.log(); break; }
      line = String(line).trim();
      if (!line) continue;
      if (["/exit", "/quit"].includes(line)) break;
      const tokens = tokenize(line.startsWith("/") ? line.slice(1) : `run --objective ${JSON.stringify(line)}`);
      const code = await main(tokens, context);
      if (code !== 0) console.log(`Command exited with code ${code}.`);
    }
  } finally { terminal.close(); }
  return 0;
}
