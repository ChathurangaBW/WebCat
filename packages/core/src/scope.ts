import net from "node:net";
import type { Engagement, OperationKind, ScopeDecision, ScopeRule } from "./types.js";

function normalizePath(pathname: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  const output: string[] = [];
  for (const segment of decoded.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") output.pop();
    else output.push(segment);
  }
  return `/${output.join("/")}${decoded.endsWith("/") && output.length ? "/" : ""}`;
}

export function hostMatches(ruleHost: string, targetHost: string): boolean {
  const rule = ruleHost.toLowerCase().replace(/\.$/, "");
  const target = targetHost.toLowerCase().replace(/\.$/, "");
  if (rule.startsWith("*.")) {
    const suffix = rule.slice(2);
    return target.endsWith(`.${suffix}`) && target !== suffix;
  }
  return rule === target;
}

export function isPrivateAddress(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  const version = net.isIP(normalized);
  if (version === 4) {
    const [a = 0, b = 0] = normalized.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (version === 6) {
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || normalized.startsWith("fe80:");
  }
  return false;
}

function ruleMatches(rule: ScopeRule, target: URL): boolean {
  if (rule.scheme && `${rule.scheme}:` !== target.protocol) return false;
  if (!hostMatches(rule.host, target.hostname)) return false;
  const targetPort = target.port ? Number(target.port) : target.protocol === "https:" ? 443 : 80;
  if (rule.port !== undefined && rule.port !== targetPort) return false;
  if (rule.pathPrefix) {
    const prefix = normalizePath(rule.pathPrefix);
    const targetPath = normalizePath(target.pathname);
    if (!(targetPath === prefix || targetPath.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`))) return false;
  }
  return true;
}

export function extractHttpUrls(value: unknown): string[] {
  const output = new Set<string>();
  const visit = (item: unknown): void => {
    if (typeof item === "string") {
      for (const match of item.match(/https?:\/\/[^\s"'<>]+/gi) ?? []) output.add(match.replace(/[),.;]+$/, ""));
      return;
    }
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    if (item && typeof item === "object") {
      for (const child of Object.values(item as Record<string, unknown>)) visit(child);
    }
  };
  visit(value);
  return [...output];
}

export class ScopeEngine {
  public constructor(private readonly engagement: Engagement) {}

  public evaluate(targetValue: string, operation: OperationKind): ScopeDecision {
    const deny = (reason: string, extra: Partial<ScopeDecision> = {}): ScopeDecision => ({
      allowed: false,
      reason,
      operation,
      ...extra
    });

    if (operation !== "passive" && !this.engagement.authorizationConfirmed) {
      return deny("engagement authorization is not confirmed");
    }
    if (operation !== "passive" && this.engagement.mode === "observe") {
      return deny("engagement is in observe mode");
    }
    if (operation === "high" && !this.engagement.allowHighRisk) {
      return deny("high-risk operations are disabled for this engagement");
    }
    if (operation === "destructive" && !this.engagement.allowDestructive) {
      return deny("destructive operations are disabled for this engagement");
    }

    let target: URL;
    try {
      target = new URL(targetValue);
    } catch {
      return deny("target is not a valid absolute URL");
    }
    if (!['http:', 'https:'].includes(target.protocol)) return deny("only HTTP and HTTPS targets are supported");
    if (target.username || target.password) return deny("targets containing URL credentials are not accepted");

    const normalizedTarget = `${target.protocol}//${target.host}${normalizePath(target.pathname)}${target.search}`;
    const deniedRule = this.engagement.deny.find((rule) => ruleMatches(rule, target));
    if (deniedRule) {
      return deny("target matched an explicit deny rule", { normalizedTarget, matchedRuleId: deniedRule.id });
    }
    const allowedRule = this.engagement.allow.find((rule) => ruleMatches(rule, target));
    if (!allowedRule) return deny("target did not match an allow rule", { normalizedTarget });
    if (isPrivateAddress(target.hostname) && allowedRule.host.toLowerCase() !== target.hostname.toLowerCase()) {
      return deny("private targets require an exact host allow rule", { normalizedTarget });
    }
    return {
      allowed: true,
      reason: "target is inside the authorized engagement scope",
      normalizedTarget,
      matchedRuleId: allowedRule.id,
      operation
    };
  }

  public evaluateMany(targets: string[], operation: OperationKind): ScopeDecision[] {
    return [...new Set(targets)].map((target) => this.evaluate(target, operation));
  }
}
