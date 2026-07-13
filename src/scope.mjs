const RISK_ORDER = Object.freeze({ passive: 0, active: 1, high: 2, destructive: 3 });

export function assertAuthorizationCurrent(engagement, now = new Date()) {
  const start = new Date(engagement.startsAt);
  const end = new Date(engagement.expiresAt);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) throw new Error("Authorization window contains an invalid date");
  if (end <= start) throw new Error("Authorization expiry must be after the start time");
  if (now < start) throw new Error("Authorization window has not started");
  if (now > end) throw new Error("Authorization window has expired");
  if (/^replace_/i.test(engagement.authorizedBy) || /^replace_/i.test(engagement.authorizationReference)) {
    throw new Error("Authorization placeholders must be replaced before external actions");
  }
}

export function evaluateScope(engagement, target, operation = "passive", now = new Date()) {
  try { assertAuthorizationCurrent(engagement, now); }
  catch (error) { return decision(false, "authorization", error.message); }
  if (!Object.hasOwn(RISK_ORDER, operation)) return decision(false, "operation", `Unknown operation ${operation}`);
  let url;
  try { url = new URL(target); }
  catch { return decision(false, "target", "Target must be an absolute URL"); }
  const denied = engagement.deny.find((rule) => ruleMatches(rule, url, operation));
  if (denied) return decision(false, denied.id ?? "deny", "Target matches an explicit deny rule", url);
  const allowed = engagement.allow.find((rule) => ruleMatches(rule, url, operation));
  if (!allowed) return decision(false, "allow", "Target is outside the authorized allow rules", url);
  if (operation !== "passive" && engagement.mode === "observe") return decision(false, "mode", "Observe mode blocks active operations", url);
  if (operation === "high" && !engagement.riskPolicy?.allowHighRisk) return decision(false, "risk", "High-risk operations are disabled", url);
  if (operation === "destructive" && !engagement.riskPolicy?.allowDestructive) return decision(false, "risk", "Destructive operations are disabled", url);
  return decision(true, allowed.id ?? "allow", "Target is authorized", url);
}

function ruleMatches(rule, url, operation) {
  if (Array.isArray(rule.operations) && !rule.operations.includes(operation)) return false;
  if (Array.isArray(rule.schemes) && rule.schemes.length > 0 && !rule.schemes.includes(url.protocol.slice(0, -1))) return false;
  if (Array.isArray(rule.ports) && rule.ports.length > 0) {
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    if (!rule.ports.includes(port)) return false;
  }
  if (Array.isArray(rule.hosts) && rule.hosts.length > 0 && !rule.hosts.some((pattern) => hostMatches(pattern, url.hostname))) return false;
  if (Array.isArray(rule.paths) && rule.paths.length > 0 && !rule.paths.some((pattern) => pathMatches(pattern, url.pathname))) return false;
  return true;
}

export function hostMatches(pattern, hostname) {
  const expected = String(pattern).toLowerCase();
  const actual = String(hostname).toLowerCase();
  if (expected.startsWith("*.")) {
    const suffix = expected.slice(2);
    return actual.endsWith(`.${suffix}`) && actual !== suffix;
  }
  return actual === expected;
}

export function pathMatches(pattern, pathname) {
  const source = String(pattern);
  const value = pathname || "/";
  const escaped = source.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

export function operationRequiresApproval(engagement, operation) {
  if (operation === "passive") return false;
  if (operation === "destructive" || operation === "high") return true;
  return engagement.mode === "manual";
}

export function riskAtLeast(actual, minimum) {
  return RISK_ORDER[actual] >= RISK_ORDER[minimum];
}

function decision(allowed, ruleId, reason, url) {
  return {
    allowed,
    ruleId,
    reason,
    ...(url ? { target: url.toString(), host: url.hostname, path: url.pathname } : {})
  };
}
