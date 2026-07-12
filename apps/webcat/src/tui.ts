import readline from "node:readline/promises";
import { WEB_SECURITY_PROFILES } from "@webcat/agent-profiles";
import { ApprovalService, EngagementStore, loadAppConfig, loadEngagement, loadSkills, parseDuration, writeReport } from "@webcat/core";
import { McpManager } from "@webcat/mcp-gateway";
import { SwarmOrchestrator } from "@webcat/agent-runtime";

function banner(): void {
  console.log("\n╭──────────────────────────────────────────────────────────────╮");
  console.log("│ WebCat 1.0 — Authorized Web Security Swarm                  │");
  console.log("│ Terminal workspace • MCP gateway • Evidence-first findings │");
  console.log("╰──────────────────────────────────────────────────────────────╯\n");
}

export async function runTui(cwd: string): Promise<void> {
  const readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
  banner();
  console.log("Type /help for commands. Active operations remain scope and approval gated.\n");
  let running = true;
  while (running) {
    const line = (await readlineInterface.question("webcat> ")).trim();
    const [command = "", ...rest] = line.split(/\s+/);
    try {
      const config = await loadAppConfig(cwd);
      const engagement = await loadEngagement(cwd);
      const store = new EngagementStore(cwd, config.security.redactSecrets, config.security.maxEvidenceBytes);
      switch (command) {
        case "/help": console.log("/status /profiles /skills /mcp /run <objective> /resume <session> /hypotheses /findings /evidence /approvals /approve <risk> <ttl> <reason> /report [json] /sessions /audit /quit"); break;
        case "/status": {
          const current = await store.loadSession();
          console.log(JSON.stringify({ engagement: engagement.name, authorized: engagement.authorizationConfirmed, mode: engagement.mode, allow: engagement.allow.length, deny: engagement.deny.length, currentSession: current ?? null }, null, 2));
          break;
        }
        case "/profiles": for (const profile of WEB_SECURITY_PROFILES) console.log(`${profile.name.padEnd(28)} ${profile.purpose}`); break;
        case "/skills": for (const skill of await loadSkills(cwd)) console.log(`${skill.name.padEnd(28)} ${skill.description}`); break;
        case "/mcp": {
          const manager = await McpManager.load(cwd, config, engagement, store);
          await manager.discover(undefined, true); console.log(JSON.stringify({ status: manager.statuses(), tools: await manager.allTools() }, null, 2)); await manager.close(); break;
        }
        case "/run": case "/resume": {
          const objective = command === "/run" ? rest.join(" ") : (await store.loadSession(rest[0] ?? "current"))?.objective;
          if (!objective) throw new Error(command === "/run" ? "objective required" : "session not found");
          const manager = await McpManager.load(cwd, config, engagement, store);
          try {
            const result = await new SwarmOrchestrator(config, engagement, manager, store).run(objective, (event) => console.log(`  • ${event}`), command === "/resume" ? { resumeSessionId: rest[0] ?? "current" } : {});
            console.log(JSON.stringify(result, null, 2));
          } finally { await manager.close(); }
          break;
        }
        case "/hypotheses": console.log(JSON.stringify(await store.listHypotheses(), null, 2)); break;
        case "/findings": console.log(JSON.stringify(await store.listFindings(), null, 2)); break;
        case "/evidence": console.log(JSON.stringify(await store.listEvidence(), null, 2)); break;
        case "/approvals": console.log(JSON.stringify(await store.listApprovals(), null, 2)); break;
        case "/approve": {
          const [risk = "high", ttl = "15m", ...reasonParts] = rest;
          const reason = reasonParts.join(" ");
          if (!reason) throw new Error("usage: /approve <active|high|destructive> <ttl> <reason>");
          console.log(JSON.stringify(await new ApprovalService(store).grant({ risk: risk as any, expiresAt: new Date(Date.now() + parseDuration(ttl)).toISOString(), createdBy: "operator", reason }), null, 2));
          break;
        }
        case "/report": console.log(await writeReport(store.root, engagement, await store.listFindings(), await store.listHypotheses(), rest[0] === "json" ? "json" : "markdown")); break;
        case "/sessions": console.log(JSON.stringify(await store.listSessions(), null, 2)); break;
        case "/audit": console.log(JSON.stringify((await store.listAudit()).slice(-50), null, 2)); break;
        case "/quit": case "/exit": running = false; break;
        case "": break;
        default: console.log("Unknown command. Type /help.");
      }
    } catch (error) { console.error(`error: ${String(error)}`); }
  }
  readlineInterface.close();
}
