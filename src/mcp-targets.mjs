import { evaluateScope } from "./scope.mjs";

const POLICY_KEY = "_webcat";

export function extractTarget(args) { return extractTargets(args)[0]; }

export function extractTargets(args) {
  const candidates = [];
  const policy = args && typeof args === "object" ? args[POLICY_KEY] : undefined;
  if (typeof policy?.target === "string") candidates.push(policy.target);
  if (Array.isArray(policy?.targets)) candidates.push(...policy.targets.filter((item) => typeof item === "string"));

  walk(args, (key, value) => {
    if (typeof value !== "string") return;
    if (/^(?:url|uri|target|targetUrl|endpoint|destination|request_url|urls|targets)$/i.test(key)) candidates.push(value);
    for (const url of urlsFromText(value)) candidates.push(url);
    const rawTarget = targetFromRawRequest(value, args);
    if (rawTarget) candidates.push(rawTarget);
    const parsed = parseEmbeddedJson(value);
    if (parsed !== undefined) candidates.push(...extractTargets(parsed));
  });

  const rawTargets = rawRequests(args).map((raw) => targetFromRawRequest(raw, args)).filter(Boolean);
  if (rawTargets.length) candidates.unshift(...rawTargets);
  else {
    const service = targetFromServiceFields(args);
    if (service) candidates.unshift(service);
  }

  const normalized = [];
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate).toString();
      if (!normalized.includes(url)) normalized.push(url);
    } catch { /* ignore non-URLs */ }
  }
  return normalized;
}

export function stripPolicyMetadata(value) {
  if (Array.isArray(value)) return value.map(stripPolicyMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== POLICY_KEY).map(([key, entry]) => [key, stripPolicyMetadata(entry)]));
}

// Prunes only the smallest subtree that actually references an out-of-scope target, and records
// how many were removed. A single third-party URL (CDN, analytics, fonts) in a proxy-history
// result must not collapse the whole response and leave the agent silently reasoning about
// nothing. The count is surfaced so the omission is visible rather than invisible.
export function filterOutOfScope(value, engagement) {
  const stats = { removed: 0 };
  const filtered = prune(value, engagement, stats, true);
  if (stats.removed === 0) return filtered;
  const marker = { filteredOutOfScope: stats.removed };
  if (Array.isArray(filtered)) return Object.assign(filtered, marker);
  if (filtered && typeof filtered === "object") return { ...filtered, ...marker };
  return { value: filtered, ...marker };
}

function prune(value, engagement, stats, isRoot = false) {
  if (Array.isArray(value)) {
    const output = [];
    for (const entry of value) {
      const child = prune(entry, engagement, stats);
      if (child !== undefined) output.push(child);
    }
    return output;
  }
  if (value && typeof value === "object") {
    // Only the targets named directly on this node decide this node's fate; nested nodes are
    // judged on their own so a bad leaf does not condemn its in-scope siblings or ancestors.
    if (!isRoot && hasOutOfScopeOwnTarget(value, engagement)) { stats.removed += 1; return undefined; }
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      const child = prune(entry, engagement, stats);
      if (child !== undefined) output[key] = child;
    }
    return output;
  }
  return value;
}

function hasOutOfScopeOwnTarget(node, engagement) {
  const shallow = {};
  for (const [key, entry] of Object.entries(node)) {
    if (entry === null || typeof entry !== "object") shallow[key] = entry;
  }
  const targets = extractTargets(shallow);
  return targets.length > 0 && targets.some((target) => !evaluateScope(engagement, target, "passive").allowed);
}

export const policyHintName = POLICY_KEY;

function targetFromServiceFields(args) {
  if (!args || typeof args !== "object") return undefined;
  const pseudo = args.pseudoHeaders && typeof args.pseudoHeaders === "object" ? args.pseudoHeaders : {};
  const host = args.targetHostname ?? args.hostname ?? args.host ?? pseudo.authority ?? pseudo[":authority"];
  if (typeof host !== "string" || !host.trim()) return undefined;
  if (/^https?:\/\//i.test(host)) return host;
  const portValue = args.targetPort ?? args.port;
  const port = Number.isFinite(Number(portValue)) ? Number(portValue) : undefined;
  const secure = booleanHint(args.usesHttps ?? args.secure ?? args.tls) ?? (/https/i.test(String(args.scheme ?? args.protocol ?? pseudo.scheme ?? pseudo[":scheme"] ?? "")) || port === 443);
  const scheme = secure ? "https" : "http";
  const path = String(pseudo.path ?? pseudo[":path"] ?? "/");
  const authority = port && ![80, 443].includes(port) ? `${host}:${port}` : host;
  return `${scheme}://${authority}${path.startsWith("/") ? path : `/${path}`}`;
}

function rawRequests(args) {
  if (!args || typeof args !== "object") return [];
  return [args.request, args.rawRequest, args.raw_request, args.data, args.content].filter((value) => typeof value === "string" && /^(?:[A-Z]+\s+|:method\s*:)/m.test(value));
}

function targetFromRawRequest(raw, args) {
  const normalized = raw.replace(/\\r\\n/g, "\n").replace(/\r\n/g, "\n");
  const requestLine = normalized.match(/^([A-Z]+)\s+(\S+)\s+HTTP\/\d(?:\.\d)?\s*$/im);
  const absolute = requestLine?.[2]?.match(/^https?:\/\/\S+/i)?.[0];
  if (absolute) return absolute;
  const path = requestLine?.[2] ?? "/";
  const host = normalized.match(/^host\s*:\s*([^\s]+)\s*$/im)?.[1];
  if (!host) return undefined;
  const portMatch = host.match(/:(\d+)$/);
  const metadataPort = normalized.match(/^Port:\s*(\d+)\s*$/im)?.[1];
  const port = portMatch ? Number(portMatch[1]) : Number(args?.targetPort ?? args?.port ?? metadataPort);
  const metadataProtocol = normalized.match(/^Protocol:\s*(HTTPS?)\s*$/im)?.[1];
  const secure = booleanHint(args?.usesHttps ?? args?.secure ?? args?.tls) ?? (/https/i.test(String(args?.scheme ?? args?.protocol ?? metadataProtocol ?? "")) || port === 443);
  const authority = port && ![80, 443].includes(port) && !portMatch ? `${host}:${port}` : host;
  return `${secure ? "https" : "http"}://${authority}${path.startsWith("/") ? path : "/"}`;
}

function urlsFromText(value) {
  const matches = String(value).match(/https?:\/\/[^\s"'<>\]})]+/gi) ?? [];
  return matches.map((item) => item.replace(/[.,;:]+$/, ""));
}

function parseEmbeddedJson(value) {
  const text = String(value).trim();
  if (!(text.startsWith("{") || text.startsWith("[")) || text.length > 2_000_000) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

function booleanHint(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string" && /^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  return undefined;
}

function walk(value, visitor, key = "") {
  if (Array.isArray(value)) return value.forEach((entry) => walk(entry, visitor, key));
  if (value && typeof value === "object") return Object.entries(value).forEach(([childKey, entry]) => { visitor(childKey, entry); walk(entry, visitor, childKey); });
  visitor(key, value);
}
