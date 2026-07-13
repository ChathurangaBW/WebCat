const mapping = (capability, risk, requiresTarget = risk !== "passive") => Object.freeze({ capability, risk, requiresTarget });

export const PORTSWIGGER_CAPABILITIES = Object.freeze({
  send_http1_request: mapping("http.execute", "active", true),
  send_http2_request: mapping("http.execute", "active", true),
  create_repeater_tab: mapping("burp.repeater.prepare", "active", true),
  create_repeater_tab_http2: mapping("burp.repeater.prepare", "active", true),
  send_to_intruder: mapping("burp.intruder.prepare", "high", true),
  url_encode: mapping("utility.local", "passive", false),
  url_decode: mapping("utility.local", "passive", false),
  base64_encode: mapping("utility.local", "passive", false),
  base64_decode: mapping("utility.local", "passive", false),
  generate_random_string: mapping("utility.local", "passive", false),
  output_project_options: mapping("burp.config.read", "passive", false),
  output_user_options: mapping("burp.config.read", "passive", false),
  set_project_options: mapping("burp.config.write", "destructive", false),
  set_user_options: mapping("burp.config.write", "destructive", false),
  get_scanner_issues: mapping("scanner.read", "passive", false),
  generate_collaborator_payload: mapping("collaborator.generate", "high", false),
  get_collaborator_interactions: mapping("collaborator.read", "passive", false),
  get_proxy_http_history: mapping("proxy.read", "passive", false),
  get_proxy_http_history_regex: mapping("proxy.read", "passive", false),
  get_organizer_items: mapping("proxy.read", "passive", false),
  get_organizer_items_regex: mapping("proxy.read", "passive", false),
  get_proxy_websocket_history: mapping("websocket.read", "passive", false),
  get_proxy_websocket_history_regex: mapping("websocket.read", "passive", false),
  set_task_execution_engine_state: mapping("burp.runtime.write", "high", false),
  set_proxy_intercept_state: mapping("burp.intercept.write", "high", false),
  get_active_editor_contents: mapping("burp.editor.read", "passive", false),
  set_active_editor_contents: mapping("burp.editor.write", "active", false)
});

export const SWGEE_CAPABILITIES = Object.freeze({
  "get-saved-request": mapping("proxy.read", "passive", false),
  "update-note": mapping("burp.annotation.write", "active", false),
  "http1-send": mapping("http.execute", "active", true),
  "http2-send": mapping("http.execute", "active", true),
  "http1-resend": mapping("http.execute", "active", true),
  "http2-resend": mapping("http.execute", "active", true),
  "save-http1-request": mapping("burp.request.save", "active", true),
  "save-http2-request": mapping("burp.request.save", "active", true),
  "generate-collaborator-payload": mapping("collaborator.generate", "high", false),
  "retrieve-collaborator-interactions": mapping("collaborator.read", "passive", false)
});

export const BRIDGE_CAPABILITIES = Object.freeze({
  burp_help: mapping("burp.help", "passive", false),
  burp_proxy_history: mapping("proxy.read", "passive", false),
  burp_repeater: mapping("burp.repeater.prepare", "active", true),
  burp_proxy_interceptor: mapping("burp.intercept.write", "high", false),
  burp_global_interceptor: mapping("burp.intercept.write", "high", false),
  burp_custom_http: mapping("http.execute", "active", true),
  burp_scanner: mapping("scanner.run", "high", true),
  burp_intruder: mapping("burp.intruder.prepare", "high", true),
  burp_add_issue: mapping("finding.write", "active", true),
  burp_session_management: mapping("burp.session.write", "high", false),
  burp_comparer: mapping("burp.comparer.write", "active", false),
  burp_collaborator: mapping("collaborator.generate", "high", false),
  burp_scope: mapping("burp.scope.write", "destructive", false),
  burp_config: mapping("burp.config.write", "destructive", false),
  burp_organizer: mapping("burp.organizer.write", "active", false),
  burp_annotate: mapping("burp.annotation.write", "active", false),
  burp_sitemap_analysis: mapping("sitemap.read", "passive", false),
  burp_bambda: mapping("burp.filter.write", "high", false),
  burp_logs: mapping("burp.logs.read", "passive", false),
  burp_websocket: mapping("websocket.execute", "high", true),
  burp_websocket_interceptor: mapping("burp.intercept.write", "high", false),
  burp_response_analyzer: mapping("response.analyze", "passive", false),
  burp_utilities: mapping("utility.local", "destructive", false),
  shell_execute: mapping("host.shell.execute", "destructive", false),
  shell_execute_dangerous: mapping("host.shell.execute", "destructive", false)
});

const DEFAULT_DANGEROUS = Object.freeze({
  portswigger: ["set_project_options", "set_user_options", "set_task_execution_engine_state", "set_proxy_intercept_state", "send_to_intruder"],
  swgee: [],
  bridge: ["burp_proxy_interceptor", "burp_global_interceptor", "burp_scanner", "burp_intruder", "burp_session_management", "burp_scope", "burp_config", "burp_bambda", "burp_websocket_interceptor", "burp_utilities", "shell_execute", "shell_execute_dangerous"]
});

export const BURP_PRESETS = Object.freeze({
  "portswigger-sse": Object.freeze({
    adapter: "burp",
    burpFamily: "portswigger",
    transport: "sse",
    url: "http://127.0.0.1:9876",
    protocolVersion: "2024-11-05",
    timeoutMs: 60000,
    enabled: false,
    disabledTools: DEFAULT_DANGEROUS.portswigger
  }),
  "portswigger-stdio": Object.freeze({
    adapter: "burp",
    burpFamily: "portswigger",
    transport: "stdio",
    command: "java",
    args: ["-jar", "${BURP_MCP_PROXY_JAR}", "--sse-url", "${BURP_MCP_SSE_URL}"],
    protocolVersion: "2024-11-05",
    timeoutMs: 60000,
    enabled: false,
    disabledTools: DEFAULT_DANGEROUS.portswigger
  }),
  "swgee-sse": Object.freeze({
    adapter: "burp",
    burpFamily: "swgee",
    transport: "sse",
    url: "http://127.0.0.1:8181/mcp/sse",
    protocolVersion: "2024-11-05",
    timeoutMs: 60000,
    enabled: false,
    disabledTools: DEFAULT_DANGEROUS.swgee
  }),
  "bridge-stdio": Object.freeze({
    adapter: "burp",
    burpFamily: "bridge",
    transport: "stdio",
    command: "burp-mcp-bridge",
    env: { BURP_MCP_SERVER_PORT: "8081", MCP_TRANSPORT_MODE: "stdio" },
    timeoutMs: 60000,
    enabled: false,
    disabledTools: DEFAULT_DANGEROUS.bridge
  }),
  "bridge-http": Object.freeze({
    adapter: "burp",
    burpFamily: "bridge",
    transport: "http",
    url: "http://127.0.0.1:3000/mcp",
    timeoutMs: 60000,
    enabled: false,
    disabledTools: DEFAULT_DANGEROUS.bridge
  })
});

const PRESET_ALIASES = Object.freeze({
  portswigger: "portswigger-sse",
  "portswigger-mcp": "portswigger-sse",
  burpmcp: "swgee-sse",
  "burp-mcp-bridge": "bridge-stdio"
});

export const BURP_SKILLS = Object.freeze([
  skill("passive-traffic-review", "Review only captured Burp traffic, map endpoints, and create evidence-backed hypotheses without sending requests.", ["proxy.read", "sitemap.read"], ["Start from proxy history and site map.", "Separate observations from hypotheses.", "Do not infer exploitability without reproduction evidence."]),
  skill("auth-flow-mapper", "Compare authenticated and unauthenticated traffic to map login, refresh, logout, and session transitions.", ["proxy.read", "http.execute"], ["Preserve account and session boundaries.", "Use the minimum controlled replay needed.", "Never reuse credentials outside the engagement scope."]),
  skill("access-control-comparison", "Compare authorized object and function requests using controlled identity or identifier changes.", ["proxy.read", "http.execute"], ["Use operator-approved test accounts.", "Change one authorization variable at a time.", "Require response and impact evidence before creating a finding."]),
  skill("session-scope-review", "Review cookie, token, audience, expiry, and privilege-boundary behavior from captured traffic.", ["proxy.read", "http.execute"], ["Redact secrets in notes and evidence.", "Avoid destructive account changes.", "Treat token parsing as analysis, not authorization."]),
  skill("ssrf-redirect-hypothesis", "Surface SSRF and redirect candidates from real traffic and validate only with approved, controlled destinations.", ["proxy.read", "http.execute", "collaborator.generate"], ["No blind internet scanning.", "Use an approved Collaborator or test endpoint.", "Keep high-risk and OOB actions approval-gated."]),
  skill("business-logic-review", "Model multi-step state transitions and identify invariant violations from observed workflows.", ["proxy.read", "http.execute"], ["Preserve transaction safety.", "Avoid irreversible state changes.", "Record preconditions and rollback expectations."]),
  skill("rate-limit-review", "Assess rate and abuse controls with bounded, explicitly approved request counts.", ["proxy.read", "http.execute"], ["Honor engagement rate limits.", "Do not run unbounded fuzzing or brute force.", "Stop on instability or unexpected side effects."]),
  skill("evidence-reporting", "Convert Burp observations into concise findings linked to redacted evidence and independent validation.", ["proxy.read"], ["Candidates are not findings.", "Include exact evidence IDs and reproduction steps.", "State uncertainty and rejected hypotheses."])
]);

function skill(name, purpose, capabilities, guardrails) {
  return Object.freeze({ name, purpose, capabilities: Object.freeze(capabilities), guardrails: Object.freeze(guardrails) });
}

export function resolveBurpPreset(server) {
  if (!server?.preset) return server;
  const canonical = PRESET_ALIASES[server.preset] ?? server.preset;
  const preset = BURP_PRESETS[canonical];
  if (!preset) throw new Error(`Unknown Burp MCP preset ${server.preset}`);
  return deepMerge(structuredClone(preset), { ...server, preset: canonical });
}

export function burpCapability(toolName, serverConfig = {}) {
  const family = serverConfig.burpFamily ?? inferFamily(serverConfig.preset);
  const map = family === "portswigger" ? PORTSWIGGER_CAPABILITIES : family === "swgee" ? SWGEE_CAPABILITIES : family === "bridge" ? BRIDGE_CAPABILITIES : undefined;
  return map?.[toolName];
}

export function classifyBurpCall(toolName, args, serverConfig, base) {
  if ((serverConfig.adapter ?? "") !== "burp" && !serverConfig.burpFamily && !serverConfig.preset) return base;
  const action = findAction(args);
  if (["burp_config", "burp_scope"].includes(toolName)) {
    return readAction(action) ? { ...base, capability: toolName === "burp_config" ? "burp.config.read" : "burp.scope.read", risk: "passive", requiresTarget: false } : { ...base, risk: "destructive", requiresTarget: false };
  }
  if (toolName === "burp_session_management") {
    return readAction(action) ? { ...base, capability: "burp.session.read", risk: "passive", requiresTarget: false } : { ...base, risk: "high", requiresTarget: false };
  }
  if (toolName === "burp_collaborator") {
    return readAction(action) || /poll|interaction/i.test(action) ? { ...base, capability: "collaborator.read", risk: "passive", requiresTarget: false } : { ...base, capability: "collaborator.generate", risk: "high", requiresTarget: false };
  }
  if (toolName === "burp_utilities") {
    return /shell|exec|command/i.test(action) ? { ...base, capability: "host.shell.execute", risk: "destructive", requiresTarget: false } : { ...base, capability: "utility.local", risk: "passive", requiresTarget: false };
  }
  if (["burp_proxy_interceptor", "burp_global_interceptor", "burp_websocket_interceptor"].includes(toolName)) {
    return readAction(action) ? { ...base, capability: "burp.intercept.read", risk: "passive", requiresTarget: false } : { ...base, risk: "high", requiresTarget: false };
  }
  if (toolName === "burp_websocket") {
    return readAction(action) || /history|inspect/i.test(action) ? { ...base, capability: "websocket.read", risk: "passive", requiresTarget: false } : { ...base, capability: "websocket.execute", risk: "active", requiresTarget: true };
  }
  return base;
}

export function listBurpPresets() {
  return Object.entries(BURP_PRESETS).map(([name, preset]) => ({ name, family: preset.burpFamily, transport: preset.transport, endpoint: preset.command ?? preset.url, disabledTools: preset.disabledTools.length }));
}

function inferFamily(preset) {
  if (!preset) return undefined;
  if (preset.startsWith("portswigger")) return "portswigger";
  if (preset.startsWith("swgee")) return "swgee";
  if (preset.startsWith("bridge")) return "bridge";
  return undefined;
}

function findAction(args) {
  if (!args || typeof args !== "object") return "";
  for (const key of ["action", "operation", "mode", "command", "method"]) {
    if (typeof args[key] === "string") return args[key].toLowerCase();
  }
  return "";
}

function readAction(action) { return /^(?:get|list|read|show|status|inspect|search|find|export|history|results?|poll)/i.test(action); }

function deepMerge(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return base;
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) base[key] = deepMerge({ ...base[key] }, value);
    else base[key] = value;
  }
  return base;
}
