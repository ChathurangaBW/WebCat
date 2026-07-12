#!/usr/bin/env node
import { initialize } from "./init.js";
import { runTui } from "./tui.js";
import { WEB_SECURITY_PROFILES } from "@webcat/agent-profiles";
import { ApprovalService, EngagementStore, ScopeEngine, loadAppConfig, loadEngagement, loadSkills, parseDuration, writeReport } from "@webcat/core";
import { McpManager } from "@webcat/mcp-gateway";
import { SwarmOrchestrator } from "@webcat/agent-runtime";

const VERSION = "1.0.0";
const args: string[] = process.argv.slice(2);
const cwd = process.cwd();

function value(name: string): string | undefined { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; }
function has(name: string): boolean { return args.includes(name); }
function positional(start: number): string[] { return args.slice(start).filter((item: string, index: number, all: string[]) => !item.startsWith("--") && (index === 0 || !all[index - 1]?.startsWith("--"))); }
function printJson(data: unknown): void { console.log(JSON.stringify(data, null, 2)); }

function help(): void {
  console.log(`WebCat ${VERSION}\n\nTerminal-native AI swarm for authorized web application security assessment.\n\nUsage:\n  webcat init [--force]\n  webcat doctor\n  webcat tui\n  webcat run --objective "Assess authorization" [--resume session-id]\n  webcat profiles\n  webcat skills\n  webcat scope-check <url> [--operation passive|active|high|destructive]\n  webcat mcp list\n  webcat mcp tools [server]\n  webcat mcp call <server> <tool> --args '{"url":"https://target"}' [--approve]\n  webcat approvals list\n  webcat approvals grant [--risk active|high|destructive] [--server name] [--tool name] [--target pattern] --ttl 30m --reason "..."\n  webcat approvals revoke <id>\n  webcat hypotheses\n  webcat findings [--status candidate|validated|rejected|needs-more-evidence]\n  webcat evidence [--read id]\n  webcat sessions\n  webcat report [--format markdown|json]\n\nWebCat blocks external actions unless authorization, scope, capability, policy, and approvals pass.`);
}

async function context(): Promise<{ config: Awaited<ReturnType<typeof loadAppConfig>>; engagement: Awaited<ReturnType<typeof loadEngagement>>; store: EngagementStore }> {
  const config = await loadAppConfig(cwd);
  const engagement = await loadEngagement(cwd);
  return { config, engagement, store: new EngagementStore(cwd, config.security.redactSecrets, config.security.maxEvidenceBytes) };
}

async function main(): Promise<void> {
  const command = args[0] ?? "tui";
  if (["help", "--help", "-h"].includes(command)) { help(); return; }
  if (["version", "--version", "-v"].includes(command)) { console.log(VERSION); return; }
  if (command === "init") { const files = await initialize(cwd, has("--force")); console.log(files.length ? `Created:\n${files.join("\n")}` : "WebCat project files already exist."); return; }
  if (command === "profiles") { for (const profile of WEB_SECURITY_PROFILES) console.log(`${profile.name.padEnd(28)} ${profile.active ? "active" : "passive"}  ${profile.purpose}`); return; }
  if (command === "skills") { for (const skill of await loadSkills(cwd)) console.log(`${skill.name.padEnd(28)} ${skill.description}\n  ${skill.source}`); return; }

  const { config, engagement, store } = await context();
  if (command === "doctor") {
    const manager = await McpManager.load(cwd, config, engagement, store);
    await manager.discover(undefined, true);
    printJson({
      product: "WebCat", version: VERSION, node: process.version, cwd,
      engagement: { id: engagement.id, name: engagement.name, authorized: engagement.authorizationConfirmed, authorizationReference: engagement.authorizationReference ?? null, mode: engagement.mode, allowRules: engagement.allow.length, denyRules: engagement.deny.length },
      provider: { baseUrl: config.provider.baseUrl, model: config.provider.model, apiKeyEnv: config.provider.apiKeyEnv, credentialPresent: !config.provider.apiKeyEnv || Boolean(process.env[config.provider.apiKeyEnv]) },
      swarm: config.swarm,
      security: config.security,
      mcp: manager.statuses(),
      skills: (await loadSkills(cwd)).length
    });
    await manager.close();
    return;
  }

  if (command === "scope-check") {
    const target = args[1];
    if (!target) throw new Error("scope-check requires an absolute URL");
    printJson(new ScopeEngine(engagement).evaluate(target, (value("--operation") as any) ?? "active"));
    return;
  }

  if (command === "mcp") {
    const subcommand = args[1] ?? "list";
    const manager = await McpManager.load(cwd, config, engagement, store);
    try {
      if (subcommand === "list") { await manager.discover(undefined, true); printJson(manager.statuses()); }
      else if (subcommand === "tools") printJson(await manager.discover(args[2], true));
      else if (subcommand === "call") {
        const server = args[2], tool = args[3];
        if (!server || !tool) throw new Error("mcp call requires server and tool");
        printJson(await manager.call(server, tool, JSON.parse(value("--args") ?? "{}"), has("--approve")));
      } else throw new Error(`unknown mcp command: ${subcommand}`);
    } finally { await manager.close(); }
    return;
  }

  if (command === "approvals") {
    const service = new ApprovalService(store);
    const subcommand = args[1] ?? "list";
    if (subcommand === "list") printJson(await store.listApprovals());
    else if (subcommand === "grant") {
      const ttl = parseDuration(value("--ttl") ?? "15m");
      const reason = value("--reason");
      if (!reason) throw new Error("approval reason is required");
      const risk = (value("--risk") ?? "high") as any;
      printJson(await service.grant({
        expiresAt: new Date(Date.now() + ttl).toISOString(), createdBy: "operator", reason, risk,
        ...(value("--server") ? { server: value("--server")! } : {}),
        ...(value("--tool") ? { tool: value("--tool")! } : {}),
        ...(value("--target") ? { targetPattern: value("--target")! } : {})
      }));
    } else if (subcommand === "revoke") {
      if (!args[2]) throw new Error("approval id is required");
      printJson(await service.revoke(args[2]));
    } else throw new Error(`unknown approvals command: ${subcommand}`);
    return;
  }

  if (command === "run") {
    const objective = value("--objective") ?? positional(1).join(" ");
    if (!objective) throw new Error("run requires --objective");
    const manager = await McpManager.load(cwd, config, engagement, store);
    try {
      const resumeId = value("--resume");
      const results = await new SwarmOrchestrator(config, engagement, manager, store).run(objective, (event) => console.log(`[webcat] ${event}`), resumeId ? { resumeSessionId: resumeId } : {});
      printJson(results);
    } finally { await manager.close(); }
    return;
  }

  if (command === "hypotheses") { printJson(await store.listHypotheses()); return; }
  if (command === "findings") { const status = value("--status"); printJson((await store.listFindings()).filter((finding) => !status || finding.status === status)); return; }
  if (command === "evidence") { const id = value("--read"); printJson(id ? await store.readEvidence(id) : await store.listEvidence()); return; }
  if (command === "sessions") { printJson(await store.listSessions()); return; }
  if (command === "report") {
    const format = value("--format") === "json" ? "json" : "markdown";
    console.log(await writeReport(store.root, engagement, await store.listFindings(), await store.listHypotheses(), format));
    return;
  }
  if (command === "tui") { await runTui(cwd); return; }
  throw new Error(`unknown command: ${command}`);
}

main().catch((error: any) => { console.error(`webcat: ${error?.message ?? String(error)}`); process.exitCode = 1; });
