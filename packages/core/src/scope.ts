import type {
  Engagement,
  OperationKind,
  ScopeDecision,
  ScopeRule,
} from "./types.js";

function normalizePath(pathname: string): string {
  const decoded = decodeURIComponent(pathname);
  const segments = decoded.split("/");
  const output: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") output.pop();
    else output.push(segment);
  }

  return `/${output.join("/")}${decoded.endsWith("/") && output.length > 0 ? "/" : ""}`;
}

function hostMatches(ruleHost: string, targetHost: string): boolean {
  const rule = ruleHost.toLowerCase();
  const target = targetHost.toLowerCase();
  if (rule.startsWith("*.")) {
    const suffix = rule.slice(1);
    return target.endsWith(suffix) && target !== suffix.slice(1);
  }
  return rule === target;
}

function ruleMatches(rule: ScopeRule, target: URL): boolean {
  if (rule.scheme && `${rule.scheme}:` !== target.protocol) return false;
  if (!hostMatches(rule.host, target.hostname)) return false;

  const targetPort = target.port
    ? Number(target.port)
    : target.protocol === "https:"
      ? 443
      : 80;
  if (rule.port !== undefined && rule.port !== targetPort) return false;

  if (rule.pathPrefix) {
    const prefix = normalizePath(rule.pathPrefix);
    const path = normalizePath(target.pathname);
    if (!(path === prefix || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`))) {
      return false;
    }
  }

  return true;
}

export class ScopeEngine {
  public constructor(private readonly engagement: Engagement) {}

  public evaluate(targetValue: string, operation: OperationKind): ScopeDecision {
    if (!this.engagement.authorizationConfirmed && operation !== "passive") {
      return { allowed: false, reason: "engagement authorization is not confirmed" };
    }

    if (operation === "destructive") {
      return { allowed: false, reason: "destructive operations require a separate approval gate" };
    }

    let target: URL;
    try {
      target = new URL(targetValue);
    } catch {
      return { allowed: false, reason: "target is not a valid absolute URL" };
    }

    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return { allowed: false, reason: "only HTTP and HTTPS targets are supported" };
    }

    const normalizedTarget = `${target.protocol}//${target.host}${normalizePath(target.pathname)}${target.search}`;
    const denied = this.engagement.deny.find((rule) => ruleMatches(rule, target));
    if (denied) {
      return {
        allowed: false,
        reason: "target matched an explicit deny rule",
        normalizedTarget,
        matchedRuleId: denied.id,
      };
    }

    const allowed = this.engagement.allow.find((rule) => ruleMatches(rule, target));
    if (!allowed) {
      return {
        allowed: false,
        reason: "target did not match an allow rule",
        normalizedTarget,
      };
    }

    return {
      allowed: true,
      reason: "target is inside the authorized engagement scope",
      normalizedTarget,
      matchedRuleId: allowed.id,
    };
  }
}
