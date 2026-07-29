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
  const denied = engagement.deny.find((rule) => ruleMatches(rule, url, operation, "deny"));
  if (denied) return decision(false, denied.id ?? "deny", "Target matches an explicit deny rule", url);
  const malformed = engagement.allow.find((rule) => !isUsableAllowRule(rule));
  if (malformed) return decision(false, malformed?.id ?? "allow", "Allow rule is malformed: hosts must be a non-empty array of host patterns", url);
  const allowed = engagement.allow.find((rule) => ruleMatches(rule, url, operation, "allow"));
  if (!allowed) return decision(false, "allow", "Target is outside the authorized allow rules", url);
  if (operation !== "passive" && engagement.mode === "observe") return decision(false, "mode", "Observe mode blocks active operations", url);
  if (operation === "high" && !engagement.riskPolicy?.allowHighRisk) return decision(false, "risk", "High-risk operations are disabled", url);
  if (operation === "destructive" && !engagement.riskPolicy?.allowDestructive) return decision(false, "risk", "Destructive operations are disabled", url);
  return decision(true, allowed.id ?? "allow", "Target is authorized", url);
}

export function isUsableAllowRule(rule) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return false;
  if (!isNonEmptyStringArray(rule.hosts)) return false;
  for (const field of ["schemes", "paths", "operations"]) {
    if (rule[field] !== undefined && !isNonEmptyStringArray(rule[field])) return false;
  }
  if (rule.ports !== undefined && !(Array.isArray(rule.ports) && rule.ports.length > 0 && rule.ports.every((port) => Number.isFinite(Number(port))))) return false;
  return true;
}

// An allow rule only widens authorization, so an absent or unusable constraint must never
// be read as "matches everything". A deny rule only narrows it, so a present-but-malformed
// constraint is treated as matching in order to fail closed.
function ruleMatches(rule, url, operation, kind = "allow") {
  const strict = kind === "allow";
  if (strict && !isUsableAllowRule(rule)) return false;
  if (rule.operations !== undefined && !(Array.isArray(rule.operations) ? rule.operations.includes(operation) : !strict)) return false;
  if (!fieldMatches(rule.schemes, strict, (patterns) => patterns.includes(url.protocol.slice(0, -1)))) return false;
  if (!fieldMatches(rule.ports, strict, (patterns) => {
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    return patterns.map(Number).includes(port);
  })) return false;
  if (!fieldMatches(rule.hosts, strict, (patterns) => patterns.some((pattern) => hostMatches(pattern, url.hostname)), strict)) return false;
  if (!fieldMatches(rule.paths, strict, (patterns) => patterns.some((pattern) => pathMatches(pattern, url.pathname)))) return false;
  return true;
}

function fieldMatches(value, strict, predicate, required = false) {
  if (value === undefined || value === null) return required ? false : true;
  if (!Array.isArray(value)) return !strict;
  if (value.length === 0) return required ? false : !strict;
  return predicate(value);
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0);
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
