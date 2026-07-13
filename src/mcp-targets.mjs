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

export function filterOutOfScope(value, engagement) {
  if (Array.isArray(value)) return value.map((entry) => filterOutOfScope(entry, engagement)).filter((entry) => entry !== undefined);
  if (value && typeof value === "object") {
    const targets = extractTargets(value);
    if (targets.some((target) => !evaluateScope(engagement, target, "passive").allowed)) return undefined;
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, filterOutOfScope(entry, engagement)]).filter(([, entry]) => entry !== undefined));
  }
  return value;
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
