import type { Capability } from "./types.js";

const EXACT: Record<string, Capability> = {
  list_requests: { name: "proxy.history.list", risk: "read", trusted: true },
  get_request: { name: "proxy.history.read", risk: "read", trusted: true },
  get_response: { name: "proxy.history.read", risk: "read", trusted: true },
  send_request: { name: "proxy.request.replay", risk: "active", trusted: true },
  replay_request: { name: "proxy.request.replay", risk: "active", trusted: true },
  compare_responses: { name: "proxy.response.diff", risk: "read", trusted: true },
  list_sitemap: { name: "sitemap.read", risk: "read", trusted: true },
  get_sitemap: { name: "sitemap.read", risk: "read", trusted: true },
  browser_navigate: { name: "browser.navigate", risk: "active", trusted: true },
  browser_inspect: { name: "browser.inspect", risk: "read", trusted: true },
  run_scanner: { name: "scanner.run", risk: "high", trusted: true },
  run_workflow: { name: "workflow.run", risk: "high", trusted: true }
};

function normalizedName(toolName: string): string {
  const withoutPrefix = toolName.toLowerCase().replace(/^mcp__[^_]+__/, "");
  return withoutPrefix.replace(/^(caido|burp|zap|proxy|browser|scanner)[_-]/, "");
}

export function resolveCapability(toolName: string, annotations: Record<string, unknown> = {}): Capability | undefined {
  if (typeof annotations.webcatCapability === "string" && typeof annotations.webcatRisk === "string") {
    return { name: annotations.webcatCapability, risk: annotations.webcatRisk as Capability["risk"], trusted: annotations.webcatTrusted !== false };
  }
  const key = normalizedName(toolName);
  if (EXACT[key]) return EXACT[key];
  if (annotations.destructiveHint === true) return { name: `generic.${key}`, risk: "destructive", trusted: false };
  if (annotations.readOnlyHint === true) {
    if (/site|map|route|endpoint/.test(key)) return { name: "sitemap.read", risk: "read", trusted: true };
    if (/browser|dom|page|inspect/.test(key)) return { name: "browser.inspect", risk: "read", trusted: true };
    return { name: "proxy.history.read", risk: "read", trusted: true };
  }
  if (/delete|drop|reset|purge|shutdown|destroy|remove_project|clear_all|truncate/.test(key)) return { name: `generic.${key}`, risk: "destructive", trusted: false };
  if (/scan|intruder|automate|fuzz|crawl|spider|bruteforce|workflow_run|run_workflow/.test(key)) return { name: `generic.${key}`, risk: "high", trusted: false };
  if (/send|replay|request|navigate|intercept|tamper|modify|update|create/.test(key)) return { name: "proxy.request.replay", risk: "active", trusted: true };
  if (/diff|compare|fingerprint/.test(key)) return { name: "proxy.response.diff", risk: "read", trusted: true };
  if (/list|history|get|read|find|search|site|scope|project|inspect|export/.test(key)) return { name: "proxy.history.read", risk: "read", trusted: true };
  return undefined;
}
