import type { Capability, CapabilityOverride } from "./types.js";

const EXACT: Record<string, Omit<Capability, "source">> = {
  list_requests: { name: "proxy.history.list", risk: "read", trusted: true },
  search_requests: { name: "proxy.history.list", risk: "read", trusted: true },
  get_request: { name: "proxy.history.read", risk: "read", trusted: true },
  get_response: { name: "proxy.history.read", risk: "read", trusted: true },
  get_history: { name: "proxy.history.list", risk: "read", trusted: true },
  get_proxy_http_history: { name: "proxy.history.list", risk: "read", trusted: true },
  get_site_map: { name: "sitemap.read", risk: "read", trusted: true },
  diff_responses: { name: "proxy.response.diff", risk: "read", trusted: true },
  compare_responses: { name: "proxy.response.diff", risk: "read", trusted: true },
  send_request: { name: "proxy.request.replay", risk: "active", trusted: true },
  replay_request: { name: "proxy.request.replay", risk: "active", trusted: true },
  send_http_request: { name: "proxy.request.replay", risk: "active", trusted: true },
  send_to_repeater: { name: "proxy.request.replay", risk: "active", trusted: true },
  edit_request: { name: "proxy.request.replay", risk: "active", trusted: true },
  batch_send: { name: "proxy.request.batch", risk: "high", trusted: true },
  export_curl: { name: "proxy.request.export", risk: "read", trusted: true },
  list_sitemap: { name: "sitemap.read", risk: "read", trusted: true },
  get_sitemap: { name: "sitemap.read", risk: "read", trusted: true },
  list_scopes: { name: "scope.read", risk: "read", trusted: true },
  check_scope: { name: "scope.check", risk: "read", trusted: true },
  browser_navigate: { name: "browser.navigate", risk: "active", trusted: true },
  browser_inspect: { name: "browser.inspect", risk: "read", trusted: true },
  run_scanner: { name: "scanner.run", risk: "high", trusted: true },
  run_workflow: { name: "workflow.run", risk: "high", trusted: true },
  forward_intercepted_request: { name: "proxy.intercept.forward", risk: "active", trusted: true },
  drop_intercepted_request: { name: "proxy.intercept.drop", risk: "destructive", trusted: true }
};

function normalizedName(toolName: string): string {
  const withoutMcpPrefix = toolName.toLowerCase().replace(/^mcp__[^_]+__/, "");
  return withoutMcpPrefix.replace(/^(caido|burp|zap|proxy|browser|scanner)[_-]/, "");
}

export function resolveCapability(
  toolName: string,
  annotations: Record<string, unknown> = {},
  custom: Record<string, CapabilityOverride> = {}
): Capability | undefined {
  const key = normalizedName(toolName);
  const override = custom[toolName] ?? custom[key];
  if (override) {
    return { name: override.name, risk: override.risk, trusted: override.trusted !== false, source: "custom" };
  }
  if (EXACT[key]) return { ...EXACT[key]!, source: "exact" };

  if (annotations.destructiveHint === true) {
    return { name: `generic.${key}`, risk: "destructive", trusted: false, source: "annotation" };
  }
  if (annotations.readOnlyHint === true) {
    if (/site|map|route|endpoint/.test(key)) return { name: "sitemap.read", risk: "read", trusted: true, source: "annotation" };
    if (/browser|dom|page|inspect/.test(key)) return { name: "browser.inspect", risk: "read", trusted: true, source: "annotation" };
    return { name: "proxy.history.read", risk: "read", trusted: true, source: "annotation" };
  }

  if (/delete|drop|reset|purge|shutdown|destroy|remove|clear_all|truncate/.test(key)) {
    return { name: `generic.${key}`, risk: "destructive", trusted: false, source: "heuristic" };
  }
  if (/scan|intruder|automate|fuzz|crawl|spider|bruteforce|batch|workflow_run|run_workflow/.test(key)) {
    return { name: `generic.${key}`, risk: "high", trusted: false, source: "heuristic" };
  }
  if (/send|replay|navigate|intercept|tamper|modify|update|create|forward/.test(key)) {
    return { name: `generic.${key}`, risk: "active", trusted: false, source: "heuristic" };
  }
  if (/diff|compare|fingerprint/.test(key)) {
    return { name: "proxy.response.diff", risk: "read", trusted: true, source: "heuristic" };
  }
  if (/list|history|get|read|find|search|site|scope|project|inspect|export/.test(key)) {
    return { name: "proxy.history.read", risk: "read", trusted: true, source: "heuristic" };
  }
  return undefined;
}
