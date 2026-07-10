import type { ScopeRule, ScopeDecision, Target } from '@webcat/shared';
import { ScopeDeniedError } from '@webcat/shared';

// ── Private Network Ranges ────────────────────────────────────────

const PRIVATE_IPV4_RANGES: Array<{ network: number; prefix: number }> = [
  { network: ipv4ToInt('10.0.0.0'), prefix: 8 },
  { network: ipv4ToInt('172.16.0.0'), prefix: 12 },
  { network: ipv4ToInt('192.168.0.0'), prefix: 16 },
  { network: ipv4ToInt('127.0.0.0'), prefix: 8 },  // loopback
  { network: ipv4ToInt('169.254.0.0'), prefix: 16 }, // link-local
  { network: ipv4ToInt('0.0.0.0'), prefix: 8 },      // current network
];

// ── Types ─────────────────────────────────────────────────────────

export interface ScopeDecisionResult {
  decision: ScopeDecision;
  target: Target;
  matchedAllowRule: ScopeRule | null;
  matchedDenyRule: ScopeRule | null;
  engagementId: string;
  agentId?: string;
  toolId?: string;
  timestamp: string;
  reason: string;
}

export interface ScopeEngineOptions {
  /** Block all private network targets not explicitly allowed */
  blockPrivateNetworks?: boolean;
  /** Block DNS rebinding (IP changes for same hostname) */
  blockDnsRebinding?: boolean;
  /** Track resolved IPs for DNS rebinding detection */
  dnsCache?: Map<string, string[]>;
}

// ── Scope Engine ──────────────────────────────────────────────────

export class ScopeEngine {
  private readonly allowRules: ScopeRule[];
  private readonly denyRules: ScopeRule[];
  private readonly options: Required<ScopeEngineOptions>;
  private readonly dnsCache: Map<string, string[]>;

  constructor(
    allowRules: ScopeRule[],
    denyRules: ScopeRule[],
    options: ScopeEngineOptions = {},
  ) {
    this.allowRules = [...allowRules];
    this.denyRules = [...denyRules];
    this.options = {
      blockPrivateNetworks: options.blockPrivateNetworks ?? true,
      blockDnsRebinding: options.blockDnsRebinding ?? true,
      dnsCache: options.dnsCache ?? new Map(),
    };
    this.dnsCache = this.options.dnsCache;
  }

  /**
   * Check whether a target is in scope.
   * Deny rules take precedence over allow rules.
   */
  checkTarget(target: Target, agentId?: string, toolId?: string): ScopeDecisionResult {
    const now = new Date().toISOString();

    // Canonicalize the target
    const canonical = this.canonicalizeTarget(target);

    // 1. Check deny rules first (deny wins over allow)
    for (const rule of this.denyRules) {
      if (this.matchesRule(canonical, rule)) {
        return {
          decision: 'denied',
          target: canonical,
          matchedAllowRule: null,
          matchedDenyRule: rule,
          engagementId: rule.engagementId,
          agentId,
          toolId,
          timestamp: now,
          reason: `Denied by rule: ${rule.description ?? rule.id}`,
        };
      }
    }

    // 2. Check private network protection
    if (this.options.blockPrivateNetworks && canonical.resolvedHost) {
      if (this.isPrivateIp(canonical.resolvedHost)) {
        const explicitlyAllowed = this.allowRules.some(
          (r) => (r.type === 'ip_address' || r.type === 'cidr') && this.matchesRule(canonical, r),
        );
        if (!explicitlyAllowed) {
          return {
            decision: 'denied',
            target: canonical,
            matchedAllowRule: null,
            matchedDenyRule: null,
            engagementId: '',
            agentId,
            toolId,
            timestamp: now,
            reason: `Private/reserved IP address blocked: ${canonical.resolvedHost}`,
          };
        }
      }
    }

    // 3. DNS rebinding check
    if (this.options.blockDnsRebinding && canonical.original !== canonical.resolvedHost) {
      const cachedIps = this.dnsCache.get(canonical.original);
      if (cachedIps && canonical.resolvedHost) {
        if (!cachedIps.includes(canonical.resolvedHost)) {
          return {
            decision: 'denied',
            target: canonical,
            matchedAllowRule: null,
            matchedDenyRule: null,
            engagementId: '',
            agentId,
            toolId,
            timestamp: now,
            reason: `DNS rebinding detected: ${canonical.original} now resolves to ${canonical.resolvedHost} (previously: ${cachedIps.join(', ')})`,
          };
        }
      }
      // Track for future rebinding checks
      if (canonical.resolvedHost) {
        const existing = this.dnsCache.get(canonical.original) ?? [];
        if (!existing.includes(canonical.resolvedHost)) {
          this.dnsCache.set(canonical.original, [...existing, canonical.resolvedHost]);
        }
      }
    }

    // 4. Check allow rules
    for (const rule of this.allowRules) {
      if (this.matchesRule(canonical, rule)) {
        // Check time window
        if (!this.isWithinTimeWindow(rule)) {
          return {
            decision: 'denied',
            target: canonical,
            matchedAllowRule: null,
            matchedDenyRule: null,
            engagementId: rule.engagementId,
            agentId,
            toolId,
            timestamp: now,
            reason: 'Outside testing time window',
          };
        }

        // Check port
        if (rule.ports && canonical.port && !rule.ports.includes(canonical.port)) {
          return {
            decision: 'denied',
            target: canonical,
            matchedAllowRule: null,
            matchedDenyRule: null,
            engagementId: rule.engagementId,
            agentId,
            toolId,
            timestamp: now,
            reason: `Port ${canonical.port} not in allowed ports`,
          };
        }

        return {
          decision: 'allowed',
          target: canonical,
          matchedAllowRule: rule,
          matchedDenyRule: null,
          engagementId: rule.engagementId,
          agentId,
          toolId,
          timestamp: now,
          reason: `Allowed by rule: ${rule.description ?? rule.id}`,
        };
      }
    }

    // 5. No matching rule → denied (unknown scope is denied)
    return {
      decision: 'denied',
      target: canonical,
      matchedAllowRule: null,
      matchedDenyRule: null,
      engagementId: '',
      agentId,
      toolId,
      timestamp: now,
      reason: 'No matching scope rule found — unknown scope is denied',
    };
  }

  /**
   * Assert that a target is in scope, throwing if denied.
   */
  assertInScope(target: Target, agentId?: string, toolId?: string): ScopeDecisionResult {
    const result = this.checkTarget(target, agentId, toolId);
    if (result.decision === 'denied') {
      throw new ScopeDeniedError(
        result.reason,
        result.target.original,
        result.reason,
      );
    }
    return result;
  }

  /**
   * Convert a raw URL/host into a canonicalized Target.
   */
  canonicalizeTarget(raw: Target): Target {
    let canonical = (raw.canonical ?? raw.original).toLowerCase().trim();

    // Remove trailing slash for consistency
    if (canonical.endsWith('/') && !canonical.endsWith('://')) {
      canonical = canonical.slice(0, -1);
    }

    // Extract scheme and port if URL-like
    let scheme = raw.scheme;
    let port = raw.port;
    let host = raw.resolvedHost ?? raw.original;

    const urlMatch = canonical.match(/^(https?|wss?):\/\/([^/:]+)(?::(\d+))?/);
    if (urlMatch) {
      scheme = (urlMatch[1] as 'http' | 'https' | 'ws' | 'wss') ?? scheme;
      host = urlMatch[2];
      if (urlMatch[3]) {
        port = parseInt(urlMatch[3], 10);
      } else if (port === undefined) {
        port = scheme === 'https' || scheme === 'wss' ? 443 : 80;
      }
    }

    return {
      original: raw.original,
      canonical,
      resolvedHost: raw.resolvedHost ?? host,
      port,
      scheme,
    };
  }

  /**
   * Check if a canonicalized target matches a scope rule.
   */
  private matchesRule(target: Target, rule: ScopeRule): boolean {
    const host = target.resolvedHost ?? target.original;
    const canonical = target.canonical;

    switch (rule.type) {
      case 'exact_host':
        return host === rule.value;

      case 'domain_suffix':
        return host.endsWith(rule.value) && host !== rule.value;

      case 'wildcard_subdomain': {
        const parts = rule.value.split('.');
        const hostParts = host.split('.');
        if (parts[0] === '*' && parts.length === hostParts.length) {
          return (
            parts.slice(1).every((p, i) => p === hostParts[i + 1] ||
              (p === '*' && hostParts[i + 1] !== undefined))
          );
        }
        return false;
      }

      case 'exact_url':
        return canonical === rule.value;

      case 'url_prefix':
        return canonical.startsWith(rule.value);

      case 'cidr': {
        if (!target.resolvedHost) return false;
        return ipInCidr(target.resolvedHost, rule.value);
      }

      case 'ip_address':
        return target.resolvedHost === rule.value;

      case 'port_range': {
        if (!target.port) return false;
        const [start, end] = rule.value.split('-').map(Number);
        return target.port >= start && target.port <= end;
      }

      case 'protocol':
        return target.scheme === rule.value;

      default:
        return false;
    }
  }

  /**
   * Check if a rule's time window is currently active.
   */
  private isWithinTimeWindow(rule: ScopeRule): boolean {
    if (!rule.timeWindowStart && !rule.timeWindowEnd) return true;
    const now = new Date();
    if (rule.timeWindowStart && new Date(rule.timeWindowStart) > now) return false;
    if (rule.timeWindowEnd && new Date(rule.timeWindowEnd) < now) return false;
    return true;
  }

  /**
   * Check if an IP is in a private/reserved range.
   */
  private isPrivateIp(ip: string): boolean {
    if (ip === 'localhost' || ip === '::1') return true;

    const intIp = ipv4ToInt(ip);
    if (intIp === null) return false;

    for (const range of PRIVATE_IPV4_RANGES) {
      const mask = ~((1 << (32 - range.prefix)) - 1);
      if ((intIp & mask) === (range.network & mask)) {
        return true;
      }
    }
    return false;
  }
}

// ── IP Utilities ──────────────────────────────────────────────────

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) return null;
    result = (result << 8) | num;
  }
  return result >>> 0;
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const netInt = ipv4ToInt(network);
  if (ipInt === null || netInt === null) return false;

  const mask = ~((1 << (32 - prefix)) - 1);
  return (ipInt & mask) === (netInt & mask);
}
