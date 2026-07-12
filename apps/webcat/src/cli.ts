import {
  ApprovalService,
  EngagementStore,
  ScopeEngine,
  loadAppConfig,
  loadEngagement,
  loadSkills,
  parseDuration,
  writeReport,
  type FindingStatus,
  type HypothesisStatus,
  type OperationKind,
  type RiskClass
} from "@webcat/core";
import { WEB_SECURITY_PROFILES } from "@webcat/agent-profiles";
import { SwarmOrchestrator } from "@webcat/agent-runtime";
import { McpManager } from "@webcat/mcp-gateway";
import { initialize } from "./init.js";
import { printJson, printRows, truncate } from "./format.js";

export const VERSION = "1.0.0";

function has(args: string[], name: string): boolean {
  return args.includes(name);
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireValue(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function output(value: unknown, json: boolean): void {
  if (json || typeof value !== "string") printJson(value);
  else console.log(value);
}

async function context(cwd: string): Promise<{
  config: Awaited<ReturnType<typeof loadAppConfig>>;
  engagement: Awaited<ReturnType<typeof loadEngagement>>;
  store: EngagementStore;
}> {
  const config = await loadAppConfig(cwd);
  const engagement = await loadEngagement(cwd);
  const store = new EngagementStore(cwd, config.security.redactSecrets, config.security.maxEvidenceBytes);
  await store.init();
  return { config, engagement, store };
}

export function helpText(): string {
  return `WebCat ${VERSION}

Terminal-native AI swarm for authorized web application security assessment.

Usage:
  webcat init [--force]
  webcat doctor [--json]
  webcat tui
  webcat run --objective "Assess authorization" [--json]
  webcat resume [session-id]
  webcat profiles [--json]
  webcat skills [--json]
  webcat scope-check <url> [--operation passive|active|high|destructive]

  webcat mcp list|status|tools [server]
  webcat mcp call <server> <tool> --args '{"url":"https://target"}' [--approve]

  webcat approvals list
  webcat approvals grant --risk active|high|destructive --ttl 30m --reason "..." [--server name] [--tool name] [--target pattern]
  webcat approvals revoke <approval-id>

  webcat hypotheses list|show <id>|add|status <id> <status>
  webcat findings list|show <id>|status <id> <status>
  webcat evidence list|show <id>
  webcat audit list [--tail 25]|verify
  webcat sessions list|show <id>
  webcat report [--format markdown|json]

Modes:
  observe          Passive/read-only tool use
  manual           Active tool calls require operator approval
  authorized-auto  Active in-scope calls may run automatically; high/destructive still require approval
`;
}

export async function executeCommand(args: string[], cwd = process.cwd()): Promise<void> {
  const command = args[0] ?? "help";
  const json = has(args, "--json");

  if (["help", "--help", "-h"].includes(command)) {
    console.log(helpText());
    return;
  }
  if (["version", "--version", "-v"].includes(command)) {
    console.log(VERSION);
    return;
  }
  if (command === "init") {
    const created = await initialize(cwd, has(args, "--force"));
    console.log(created.length ? `Created:\n${created.join("\n")}` : "WebCat project files already exist.");
    return;
  }
  if (command === "profiles") {
    if (json) printJson(WEB_SECURITY_PROFILES);
    else printRows(WEB_SECURITY_PROFILES.map((profile) => ({
      name: profile.name,
      active: profile.mayUseActiveTools ? "yes" : "no",
      purpose: truncate(profile.purpose, 74)
    })), ["name", "active", "purpose"]);
    return;
  }
  if (command === "skills") {
    const skills = await loadSkills(cwd);
    if (json) printJson(skills);
    else printRows(skills.map((skill) => ({ name: skill.name, description: truncate(skill.description), source: skill.source })), ["name", "description", "source"]);
    return;
  }

  const { config, engagement, store } = await context(cwd);

  if (command === "doctor") {
    const manager = await McpManager.load(cwd, config, engagement, store);
    try {
      await manager.discover(undefined, true);
      const audit = await store.verifyAuditChain();
      const report = {
        version: VERSION,
        node: process.version,
        cwd,
        engagement: {
          id: engagement.id,
          name: engagement.name,
          authorized: engagement.authorizationConfirmed,
          authorizationReference: engagement.authorizationReference ?? null,
          mode: engagement.mode,
          allowRules: engagement.allow.length,
          denyRules: engagement.deny.length
        },
        provider: {
          baseUrl: config.provider.baseUrl,
          model: config.provider.model,
          apiKeyEnv: config.provider.apiKeyEnv,
          apiKeyRequired: config.provider.apiKeyRequired,
          configured: !config.provider.apiKeyRequired || Boolean(process.env[config.provider.apiKeyEnv])
        },
        mcp: manager.statuses(),
        auditChain: audit
      };
      output(report, true);
    } finally {
      await manager.close();
    }
    return;
  }

  if (command === "scope-check") {
    const target = requireValue(args[1], "scope-check requires an absolute URL");
    const operation = (flag(args, "--operation") ?? "active") as OperationKind;
    output(new ScopeEngine(engagement).evaluate(target, operation), true);
    return;
  }

  if (command === "mcp") {
    const subcommand = args[1] ?? "list";
    const manager = await McpManager.load(cwd, config, engagement, store);
    try {
      if (subcommand === "list") {
        const names = manager.serverNames();
        if (json) printJson(names);
        else console.log(names.join("\n") || "No enabled MCP servers configured.");
      } else if (subcommand === "status") {
        await manager.discover(undefined, true);
        output(manager.statuses(), true);
      } else if (subcommand === "tools") {
        output(await manager.discover(args[2], true), true);
      } else if (subcommand === "call") {
        const server = requireValue(args[2], "mcp call requires a server name");
        const tool = requireValue(args[3], "mcp call requires a tool name");
        const raw = flag(args, "--args") ?? "{}";
        output(await manager.call(server, tool, JSON.parse(raw) as Record<string, unknown>, has(args, "--approve")), true);
      } else {
        throw new Error(`unknown mcp command: ${subcommand}`);
      }
    } finally {
      await manager.close();
    }
    return;
  }

  if (command === "approvals") {
    const subcommand = args[1] ?? "list";
    const approvals = new ApprovalService(store);
    if (subcommand === "list") {
      const records = await store.listApprovals();
      if (json) printJson(records);
      else printRows(records.map((record) => ({
        id: record.id,
        status: record.status,
        risk: record.risk ?? "*",
        server: record.server ?? "*",
        tool: record.tool ?? "*",
        expires: record.expiresAt
      })), ["id", "status", "risk", "server", "tool", "expires"]);
    } else if (subcommand === "grant") {
      const ttl = parseDuration(requireValue(flag(args, "--ttl"), "approvals grant requires --ttl, for example 30m"));
      const reason = requireValue(flag(args, "--reason"), "approvals grant requires --reason");
      const risk = flag(args, "--risk") as RiskClass | undefined;
      const record = await approvals.grant({
        expiresAt: new Date(Date.now() + ttl).toISOString(),
        createdBy: "operator",
        reason,
        ...(risk ? { risk } : {}),
        ...(flag(args, "--server") ? { server: flag(args, "--server")! } : {}),
        ...(flag(args, "--tool") ? { tool: flag(args, "--tool")! } : {}),
        ...(flag(args, "--target") ? { targetPattern: flag(args, "--target")! } : {})
      });
      output(record, true);
    } else if (subcommand === "revoke") {
      output(await approvals.revoke(requireValue(args[2], "approvals revoke requires an id")), true);
    } else {
      throw new Error(`unknown approvals command: ${subcommand}`);
    }
    return;
  }

  if (command === "hypotheses") {
    const subcommand = args[1] ?? "list";
    if (subcommand === "list") {
      const records = await store.listHypotheses();
      if (json) printJson(records);
      else printRows(records.map((record) => ({ id: record.id, status: record.status, title: truncate(record.title), target: record.target ?? "" })), ["id", "status", "title", "target"]);
    } else if (subcommand === "show") {
      const id = requireValue(args[2], "hypotheses show requires an id");
      const record = (await store.listHypotheses()).find((item) => item.id === id);
      if (!record) throw new Error(`hypothesis not found: ${id}`);
      printJson(record);
    } else if (subcommand === "add") {
      const title = requireValue(flag(args, "--title"), "hypotheses add requires --title");
      const rationale = requireValue(flag(args, "--rationale"), "hypotheses add requires --rationale");
      output(await store.addHypothesis({
        title,
        rationale,
        ...(flag(args, "--target") ? { target: flag(args, "--target")! } : {}),
        ...(flag(args, "--expected") ? { expectedSecureBehavior: flag(args, "--expected")! } : {}),
        status: "open",
        evidenceIds: [],
        createdBy: "operator"
      }), true);
    } else if (subcommand === "status") {
      const id = requireValue(args[2], "hypotheses status requires an id");
      const status = requireValue(args[3], "hypotheses status requires a status") as HypothesisStatus;
      output(await store.updateHypothesis(id, { status }), true);
    } else {
      throw new Error(`unknown hypotheses command: ${subcommand}`);
    }
    return;
  }

  if (command === "findings") {
    const subcommand = args[1] ?? "list";
    if (subcommand === "list") {
      const records = await store.listFindings();
      if (json) printJson(records);
      else printRows(records.map((record) => ({
        id: record.id,
        severity: record.severity,
        status: record.status,
        title: truncate(record.title),
        target: record.target ?? ""
      })), ["id", "severity", "status", "title", "target"]);
    } else if (subcommand === "show") {
      const id = requireValue(args[2], "findings show requires an id");
      const record = (await store.listFindings()).find((item) => item.id === id);
      if (!record) throw new Error(`finding not found: ${id}`);
      printJson(record);
    } else if (subcommand === "status") {
      const id = requireValue(args[2], "findings status requires an id");
      const status = requireValue(args[3], "findings status requires a status") as FindingStatus;
      output(await store.updateFinding(id, {
        status,
        ...(flag(args, "--notes") ? { validationNotes: flag(args, "--notes")! } : {})
      }), true);
    } else {
      throw new Error(`unknown findings command: ${subcommand}`);
    }
    return;
  }

  if (command === "evidence") {
    const subcommand = args[1] ?? "list";
    if (subcommand === "list") {
      const records = await store.listEvidence();
      if (json) printJson(records);
      else printRows(records.map((record) => ({
        id: record.id,
        time: record.timestamp,
        agent: record.agent,
        kind: record.kind,
        summary: truncate(record.summary)
      })), ["id", "time", "agent", "kind", "summary"]);
    } else if (subcommand === "show") {
      printJson(await store.readEvidence(requireValue(args[2], "evidence show requires an id")));
    } else {
      throw new Error(`unknown evidence command: ${subcommand}`);
    }
    return;
  }

  if (command === "audit") {
    const subcommand = args[1] ?? "list";
    if (subcommand === "verify") {
      printJson(await store.verifyAuditChain());
    } else if (subcommand === "list") {
      const tail = Number(flag(args, "--tail") ?? 25);
      const records = (await store.listAudit()).slice(-Math.max(1, tail));
      if (json) printJson(records);
      else printRows(records.map((record) => ({
        time: record.timestamp,
        status: record.status,
        actor: record.actor,
        action: record.action,
        id: record.id
      })), ["time", "status", "actor", "action", "id"]);
    } else {
      throw new Error(`unknown audit command: ${subcommand}`);
    }
    return;
  }

  if (command === "sessions") {
    const subcommand = args[1] ?? "list";
    if (subcommand === "list") {
      const records = await store.listSessions();
      if (json) printJson(records);
      else printRows(records.map((record) => ({
        id: record.id,
        state: record.state,
        updated: record.updatedAt,
        objective: truncate(record.objective)
      })), ["id", "state", "updated", "objective"]);
    } else if (subcommand === "show") {
      const record = await store.loadSession(requireValue(args[2], "sessions show requires an id"));
      if (!record) throw new Error(`session not found: ${args[2]}`);
      printJson(record);
    } else {
      throw new Error(`unknown sessions command: ${subcommand}`);
    }
    return;
  }

  if (command === "report") {
    const format = (flag(args, "--format") ?? "markdown") as "markdown" | "json";
    if (!(["markdown", "json"] as const).includes(format)) throw new Error("report format must be markdown or json");
    const file = await writeReport(store.root, engagement, await store.listFindings(), await store.listHypotheses(), format);
    console.log(file);
    return;
  }

  if (command === "run" || command === "resume") {
    const manager = await McpManager.load(cwd, config, engagement, store);
    const controller = new AbortController();
    const interrupt = () => controller.abort();
    process.once("SIGINT", interrupt);
    try {
      const orchestrator = new SwarmOrchestrator(config, engagement, manager, store);
      const event = (text: string) => console.log(`[webcat] ${text}`);
      const result = command === "resume"
        ? await orchestrator.resume(args[1] ?? "current", event, controller.signal)
        : await orchestrator.run(requireValue(flag(args, "--objective") ?? args.slice(1).filter((item) => !item.startsWith("--")).join(" "), "run requires --objective"), event, controller.signal);
      output(result, json || true);
    } finally {
      process.removeListener("SIGINT", interrupt);
      await manager.close();
    }
    return;
  }

  throw new Error(`unknown command: ${command}`);
}
