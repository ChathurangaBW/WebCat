import { projectPaths } from "./paths.mjs";
import { loadConfig, loadEngagement, loadMcpConfig } from "./config.mjs";
import { ApprovalStore } from "./approvals.mjs";
import { AuditLog } from "./audit.mjs";
import { EvidenceStore } from "./evidence.mjs";
import { McpGuard, McpManager } from "./mcp.mjs";
import { SwarmOrchestrator, createProvider } from "./swarm.mjs";
import { RecordStore, SessionStore } from "./store.mjs";
import { writeReport } from "./report.mjs";
import { flag, positionals, printJson, printTable } from "./cli-utils.mjs";

export async function runCommand(args, context) {
  const objective = flag(args, "--objective");
  if (!objective) throw new Error("run requires --objective");
  const runtime = await createRuntime(context);
  try {
    const result = await runtime.orchestrator.run(objective);
    if (args.includes("--json")) printJson(result); else console.log(result.session.summary);
    return 0;
  } finally { await runtime.manager.close(); }
}

export async function resumeCommand(args, context) {
  const id = args.find((value) => !value.startsWith("--"));
  const runtime = await createRuntime(context);
  try {
    const result = await runtime.orchestrator.resume(id);
    if (args.includes("--json")) printJson(result); else console.log(result.session.summary ?? `Session ${result.session.id} is ${result.session.state}`);
    return 0;
  } finally { await runtime.manager.close(); }
}

export async function sessionsCommand(args, context) {
  const [action = "list", id] = args.filter((value) => !value.startsWith("--"));
  const store = new SessionStore(projectPaths(context.cwd).sessions);
  if (action === "list") { const values = await store.list(); args.includes("--json") ? printJson(values) : printTable(values.map((item) => ({ id: item.id, state: item.state, objective: item.objective, updatedAt: item.updatedAt }))); return 0; }
  if (action === "show") { const value = await store.get(id); if (!value) throw new Error(`Session ${id} not found`); printJson(value); return 0; }
  throw new Error(`Unknown sessions action ${action}`);
}

export async function recordsCommand(kind, args, context) {
  const [action = "list", id] = args.filter((value) => !value.startsWith("--"));
  const paths = projectPaths(context.cwd);
  const store = new RecordStore(kind === "findings" ? paths.findings : paths.hypotheses, kind === "findings" ? "finding" : "hypothesis");
  if (action === "list") { const values = await store.list(); args.includes("--json") ? printJson(values) : printTable(values); return 0; }
  if (action === "show") { const value = await store.get(id); if (!value) throw new Error(`${kind} record ${id} not found`); printJson(value); return 0; }
  throw new Error(`Unknown ${kind} action ${action}`);
}

export async function evidenceCommand(args, context) {
  const [action = "list"] = args.filter((value) => !value.startsWith("--"));
  const store = new EvidenceStore(projectPaths(context.cwd).evidence);
  if (action === "list") { const values = await store.list(); args.includes("--json") ? printJson(values) : printTable(values.map((item) => ({ id: item.id, source: item.source, target: item.target, sha256: item.sha256 }))); return 0; }
  if (action === "verify") { const values = await store.verify(); printJson(values); return values.every((item) => item.valid) ? 0 : 1; }
  throw new Error(`Unknown evidence action ${action}`);
}

export async function auditCommand(args, context) {
  const [action = "list"] = args.filter((value) => !value.startsWith("--"));
  const audit = new AuditLog(projectPaths(context.cwd).audit);
  if (action === "list") { const values = await audit.read(); args.includes("--json") ? printJson(values) : printTable(values); return 0; }
  if (action === "verify") { const result = await audit.verify(); printJson(result); return result.valid ? 0 : 1; }
  throw new Error(`Unknown audit action ${action}`);
}

export async function reportCommand(args, context) {
  const [sessionId] = positionals(args, ["--format"]);
  const format = flag(args, "--format") ?? "markdown";
  if (!["markdown", "json"].includes(format)) throw new Error("Report format must be markdown or json");
  const paths = projectPaths(context.cwd);
  const sessions = new SessionStore(paths.sessions);
  const session = sessionId ? await sessions.get(sessionId) : await sessions.latest();
  if (!session) throw new Error("No session is available for reporting");
  const findings = (await new RecordStore(paths.findings, "finding").list()).filter((item) => item.sessionId === session.id);
  const hypotheses = (await new RecordStore(paths.hypotheses, "hypothesis").list()).filter((item) => item.sessionId === session.id);
  const evidence = await new EvidenceStore(paths.evidence).verify();
  const path = await writeReport({ session, findings, hypotheses, evidence, directory: paths.reports, format });
  console.log(path); return 0;
}

export async function createRuntime(context) {
  const paths = projectPaths(context.cwd);
  const [config, engagement, mcpConfig] = await Promise.all([
    loadConfig(context.cwd, { userPaths: context.users }),
    loadEngagement(context.cwd),
    loadMcpConfig(context.cwd, { userPaths: context.users, env: context.env })
  ]);
  const approvals = new ApprovalStore(paths.approvals);
  const audit = new AuditLog(paths.audit);
  const evidence = new EvidenceStore(paths.evidence, config.evidence);
  const manager = new McpManager(mcpConfig);
  const guard = new McpGuard({ engagement, approvals, audit, evidence, manager });
  const sessions = new SessionStore(paths.sessions);
  const findings = new RecordStore(paths.findings, "finding");
  const hypotheses = new RecordStore(paths.hypotheses, "hypothesis");
  const provider = createProvider(config.model);
  const orchestrator = new SwarmOrchestrator({ engagement, config, approvals, audit, evidence, manager, guard, sessions, findings, hypotheses, provider });
  return { config, engagement, mcpConfig, approvals, audit, evidence, manager, guard, sessions, findings, hypotheses, provider, orchestrator };
}

export function configTemplate() {
  return `[model]\nprovider = "mock"\nbaseUrl = "http://127.0.0.1:11434/v1"\napiKeyEnv = "WEBCAT_MODEL_API_KEY"\nmodel = "webcat-local"\ntimeoutMs = 120000\n\n[swarm]\nmaxConcurrency = 3\nmaxAgentTurns = 6\nmaxToolCallsPerAgent = 8\n\n[logging]\nlevel = "info"\n\n[evidence]\nmaxBodyBytes = 262144\n`;
}

export function engagementTemplate(now, expiry) {
  return {
    schemaVersion: 1,
    id: "engagement_replace_me",
    name: "Authorized Web Application Assessment",
    authorizedBy: "REPLACE_WITH_AUTHORIZER",
    authorizationReference: "REPLACE_WITH_TICKET_OR_CONTRACT",
    startsAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    mode: "observe",
    allow: [{ id: "primary-target", hosts: ["app.example.test"], schemes: ["https"], paths: ["/**"], operations: ["passive"] }],
    deny: [{ id: "sensitive-actions", hosts: ["app.example.test"], paths: ["/logout", "/admin/delete/**"], operations: ["active", "high", "destructive"] }],
    rateLimit: { requestsPerMinute: 30, maxParallel: 2 },
    riskPolicy: { allowHighRisk: false, allowDestructive: false, approvalTtlMinutes: 20 }
  };
}

export function mcpTemplate() {
  return {
    schemaVersion: 1,
    servers: {
      caido: {
        transport: "stdio",
        command: "caido-mcp",
        args: ["serve"],
        enabled: false,
        timeoutMs: 60000,
        disabledTools: ["race_window_send"],
        capabilityMap: {
          list_requests: { capability: "proxy.read", risk: "passive", requiresTarget: false },
          get_request: { capability: "proxy.read", risk: "passive", requiresTarget: false },
          send_request: { capability: "http.execute", risk: "active", requiresTarget: true },
          run_workflow: { capability: "scanner.run", risk: "high", requiresTarget: true }
        }
      },
      burp: { preset: "portswigger-sse", enabled: false },
      burpmcp: { preset: "swgee-sse", enabled: false },
      burp_bridge: { preset: "bridge-stdio", enabled: false },
      generic_sse: { transport: "sse", url: "http://127.0.0.1:9000/mcp", enabled: false, timeoutMs: 60000 }
    }
  };
}
