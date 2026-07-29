import { mkdir, writeFile } from "node:fs/promises";
import { IDENTITY } from "./identity.mjs";
import { projectPaths } from "./paths.mjs";
import { loadConfig, loadEngagement, loadMcpConfig } from "./config.mjs";
import { evaluateScope } from "./scope.mjs";
import { ApprovalStore } from "./approvals.mjs";
import { PROFILES } from "./swarm.mjs";
import { BURP_SKILLS, listBurpPresets } from "./burp.mjs";
import { redact } from "./redact.mjs";
import { createRuntime, configTemplate, engagementTemplate, mcpTemplate } from "./commands-runtime.mjs";
import { assertKnownOptions, exists, flag, hasFlag, positionals, printJson, printTable } from "./cli-utils.mjs";

export async function initCommand(args, { cwd }) {
  assertKnownOptions(args, ["--force"]);
  const paths = projectPaths(cwd);
  const force = args.includes("--force");
  await mkdir(paths.project, { recursive: true, mode: 0o700 });
  const now = new Date();
  const expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const files = [[paths.config, configTemplate()], [paths.engagement, `${JSON.stringify(engagementTemplate(now, expiry), null, 2)}\n`], [paths.mcp, `${JSON.stringify(mcpTemplate(), null, 2)}\n`]];
  for (const [path, content] of files) { if (!force && await exists(path)) continue; await writeFile(path, content, { mode: 0o600 }); }
  console.log(`Initialized WebCat project configuration in ${paths.project}`);
  console.log("Replace authorization placeholders before running an engagement.");
  return 0;
}

export async function doctorCommand(args, context) {
  const json = args.includes("--json");
  const checks = [];
  checks.push({ name: "node", ok: Number(process.versions.node.split(".")[0]) >= 22, detail: process.version });
  checks.push({ name: "process", ok: process.title === IDENTITY.processName, detail: process.title });
  const paths = projectPaths(context.cwd);
  checks.push({ name: "project-root", ok: true, detail: paths.root });
  checks.push({ name: "runtime-log", ok: context.users.log.endsWith(IDENTITY.logFile), detail: context.users.log });
  try { await loadConfig(context.cwd, { userPaths: context.users }); checks.push({ name: "config", ok: true, detail: "loaded" }); } catch (error) { checks.push({ name: "config", ok: false, detail: error.message }); }
  try { const engagement = await loadEngagement(context.cwd); checks.push({ name: "engagement", ok: true, detail: engagement.id }); } catch (error) { checks.push({ name: "engagement", ok: false, detail: error.message }); }
  try { const mcp = await loadMcpConfig(context.cwd, { userPaths: context.users, env: context.env }); checks.push({ name: "mcp", ok: true, detail: `${Object.keys(mcp.servers).length} server(s)` }); } catch (error) { checks.push({ name: "mcp", ok: false, detail: error.message }); }
  await context.logger.info("doctor.completed", { checks });
  if (json) printJson(redact({ product: IDENTITY.productName, version: IDENTITY.version, checks })); else printTable(checks);
  return checks.every((item) => item.ok) ? 0 : 1;
}

export async function pathsCommand(args, context) { const payload = { user: context.users, project: projectPaths(context.cwd) }; if (args.includes("--json")) printJson(payload); else printTable(Object.entries(payload.user).map(([name, detail]) => ({ name, detail }))); return 0; }

export async function scopeCheckCommand(args, context) {
  assertKnownOptions(args, ["--operation"]);
  const [target] = positionals(args, ["--operation"]);
  if (!target) throw new Error("scope-check requires a target URL");
  const operation = flag(args, "--operation") ?? "passive";
  const engagement = await loadEngagement(context.cwd);
  const result = evaluateScope(engagement, target, operation);
  if (args.includes("--json")) printJson(result); else printTable([result]);
  return result.allowed ? 0 : 2;
}

export function profilesCommand(args) { if (args.includes("--json")) printJson(PROFILES); else printTable(PROFILES.map((item) => ({ name: item.name, capabilities: item.capabilities.join(", "), skills: item.skills?.join(", ") ?? "", purpose: item.purpose }))); return 0; }

export async function mcpCommand(args, context) {
  assertKnownOptions(args, ["--args", "--approve"]);
  const [action = "status", serverName, toolName] = positionals(args, ["--args"]);
  const runtime = await createRuntime(context);
  try {
    if (action === "status") {
      const rows = runtime.manager.servers().map((server) => ({ name: server.name, preset: server.preset ?? "", transport: server.transport, enabled: server.enabled !== false, endpoint: server.command ?? server.url }));
      if (args.includes("--json")) printJson(rows); else printTable(rows);
      return 0;
    }
    if (action === "refresh") {
      await runtime.manager.refresh(serverName);
      console.log(serverName ? `Refreshed MCP tool cache for ${serverName}.` : "Refreshed all MCP tool caches.");
      return 0;
    }
    if (action === "tools") {
      if (serverName) {
        const tools = await runtime.manager.tools(serverName);
        if (args.includes("--json")) printJson(tools); else printTable(tools.map((tool) => ({ name: tool.name, capability: tool.classification.capability, risk: tool.classification.risk, trusted: tool.classification.trusted })));
      } else {
        const rows = [];
        for (const server of runtime.manager.servers().filter((item) => item.enabled !== false)) for (const tool of await runtime.manager.tools(server.name)) rows.push({ server: server.name, name: tool.name, risk: tool.classification.risk, trusted: tool.classification.trusted });
        if (args.includes("--json")) printJson(rows); else printTable(rows);
      }
      return 0;
    }
    if (action === "call") {
      if (!serverName || !toolName) throw new Error("mcp call requires a server and tool");
      const tools = await runtime.manager.tools(serverName);
      const tool = tools.find((item) => item.name === toolName);
      if (!tool) throw new Error(`MCP tool ${toolName} was not discovered`);
      const input = JSON.parse(flag(args, "--args") ?? "{}");
      const result = await runtime.guard.call(serverName, tool, input, { approve: hasFlag(args, "--approve") });
      printJson(result);
      return 0;
    }
    throw new Error(`Unknown mcp action ${action}`);
  } finally { await runtime.manager.close(); }
}

export async function burpCommand(args, context) {
  const [action = "status", serverName] = positionals(args);
  const json = args.includes("--json");
  if (action === "presets") { const rows = listBurpPresets(); json ? printJson(rows) : printTable(rows); return 0; }
  if (action === "skills") { json ? printJson(BURP_SKILLS) : printTable(BURP_SKILLS.map((item) => ({ name: item.name, capabilities: item.capabilities.join(", "), purpose: item.purpose }))); return 0; }
  if (action === "tools") return mcpCommand(["tools", ...(serverName ? [serverName] : []), ...(json ? ["--json"] : [])], context);
  const runtime = await createRuntime(context);
  try {
    const servers = runtime.manager.servers().filter((server) => server.adapter === "burp" && (!serverName || server.name === serverName));
    if (action === "status") {
      const rows = servers.map((server) => ({ name: server.name, family: server.burpFamily, preset: server.preset, transport: server.transport, enabled: server.enabled !== false, endpoint: server.command ?? server.url, disabledTools: server.disabledTools?.length ?? 0 }));
      json ? printJson(rows) : printTable(rows);
      return rows.length ? 0 : 1;
    }
    if (action === "doctor") {
      const rows = [];
      for (const server of servers) {
        if (server.enabled === false) { rows.push({ name: server.name, ok: true, detail: "configured but disabled" }); continue; }
        try {
          const tools = await runtime.manager.tools(server.name);
          rows.push({ name: server.name, ok: true, detail: `${tools.length} enabled tool(s); ${tools.filter((tool) => tool.classification.trusted).length} trusted mapping(s)` });
        } catch (error) { rows.push({ name: server.name, ok: false, detail: error.message }); }
      }
      json ? printJson(rows) : printTable(rows);
      return rows.length > 0 && rows.every((row) => row.ok) ? 0 : 1;
    }
    throw new Error(`Unknown burp action ${action}`);
  } finally { await runtime.manager.close(); }
}

export async function approvalsCommand(args, context) {
  assertKnownOptions(args, ["--risk", "--ttl", "--reason", "--server", "--tool", "--target"]);
  const [action = "list", id] = positionals(args, ["--risk", "--ttl", "--reason", "--server", "--tool", "--target"]);
  const store = new ApprovalStore(projectPaths(context.cwd).approvals);
  if (action === "list") { const values = await store.list(); args.includes("--json") ? printJson(values) : printTable(values); return 0; }
  if (action === "grant") {
    const approval = await store.grant({ risk: flag(args, "--risk") ?? "active", ttlMinutes: Number(flag(args, "--ttl") ?? 20), reason: flag(args, "--reason"), server: flag(args, "--server"), tool: flag(args, "--tool"), target: flag(args, "--target") });
    printJson(approval); return 0;
  }
  if (action === "revoke") { if (!id) throw new Error("approvals revoke requires an ID"); printJson(await store.revoke(id)); return 0; }
  throw new Error(`Unknown approvals action ${action}`);
}
