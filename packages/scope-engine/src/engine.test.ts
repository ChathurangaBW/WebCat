import { describe, it, expect } from 'vitest';
import { ScopeEngine } from './engine.js';
import type { ScopeRule, Target } from '@webcat/shared';

function makeRule(overrides: Partial<ScopeRule> = {}): ScopeRule {
  return {
    id: 'rule-1',
    engagementId: 'eng-1',
    type: 'exact_host',
    value: 'example.com',
    isAllow: true,
    ...overrides,
  };
}

function makeTarget(overrides: Partial<Target> = {}): Target {
  return {
    original: 'https://example.com',
    canonical: 'https://example.com',
    resolvedHost: 'example.com',
    scheme: 'https',
    port: 443,
    ...overrides,
  };
}

describe('ScopeEngine', () => {
  describe('exact_host matching', () => {
    it('allows exact host match', () => {
      const engine = new ScopeEngine([makeRule({ type: 'exact_host', value: 'example.com' })], []);
      const result = engine.checkTarget(makeTarget());
      expect(result.decision).toBe('allowed');
    });

    it('denies non-matching host', () => {
      const engine = new ScopeEngine([makeRule({ type: 'exact_host', value: 'example.com' })], []);
      const result = engine.checkTarget(makeTarget({ resolvedHost: 'other.com' }));
      expect(result.decision).toBe('denied');
    });
  });

  describe('deny rules take precedence', () => {
    it('denies when deny rule matches even with allow rule', () => {
      const engine = new ScopeEngine(
        [makeRule({ type: 'exact_host', value: 'example.com', isAllow: true })],
        [makeRule({ type: 'exact_host', value: 'example.com', isAllow: false })],
      );
      const result = engine.checkTarget(makeTarget());
      expect(result.decision).toBe('denied');
    });
  });

  describe('domain_suffix matching', () => {
    it('allows subdomain of allowed suffix', () => {
      const engine = new ScopeEngine([makeRule({ type: 'domain_suffix', value: '.example.com' })], []);
      const result = engine.checkTarget(makeTarget({ resolvedHost: 'sub.example.com' }));
      expect(result.decision).toBe('allowed');
    });

    it('denies the suffix domain itself', () => {
      const engine = new ScopeEngine([makeRule({ type: 'domain_suffix', value: '.example.com' })], []);
      const result = engine.checkTarget(makeTarget({ resolvedHost: 'example.com' }));
      // exact match of suffix is NOT a subdomain
      expect(result.decision).toBe('denied');
    });
  });

  describe('URL matching', () => {
    it('allows exact URL match', () => {
      const engine = new ScopeEngine([makeRule({ type: 'exact_url', value: 'https://example.com/api' })], []);
      const result = engine.checkTarget(makeTarget({ canonical: 'https://example.com/api' }));
      expect(result.decision).toBe('allowed');
    });

    it('allows URL prefix match', () => {
      const engine = new ScopeEngine([makeRule({ type: 'url_prefix', value: 'https://example.com/api' })], []);
      const result = engine.checkTarget(makeTarget({ canonical: 'https://example.com/api/v1/users' }));
      expect(result.decision).toBe('allowed');
    });
  });

  describe('CIDR matching', () => {
    it('allows IP in CIDR range', () => {
      const engine = new ScopeEngine([makeRule({ type: 'cidr', value: '10.0.0.0/8' })], []);
      const result = engine.checkTarget(makeTarget({ resolvedHost: '10.1.2.3' }));
      expect(result.decision).toBe('allowed');
    });

    it('denies IP outside CIDR range', () => {
      const engine = new ScopeEngine([makeRule({ type: 'cidr', value: '10.0.0.0/8' })], []);
      const result = engine.checkTarget(makeTarget({ resolvedHost: '192.168.1.1' }));
      expect(result.decision).toBe('denied');
    });
  });

  describe('private network protection', () => {
    it('blocks private IPs by default', () => {
      const engine = new ScopeEngine(
        [makeRule({ type: 'domain_suffix', value: '.example.com' })],
        [],
        { blockPrivateNetworks: true },
      );
      const result = engine.checkTarget(makeTarget({ resolvedHost: '192.168.1.1' }));
      expect(result.decision).toBe('denied');
      expect(result.reason).toContain('Private/reserved');
    });

    it('blocks loopback', () => {
      const engine = new ScopeEngine([], [], { blockPrivateNetworks: true });
      const result = engine.checkTarget(makeTarget({ resolvedHost: '127.0.0.1' }));
      expect(result.decision).toBe('denied');
    });

    it('allows private IP when explicitly scoped', () => {
      const engine = new ScopeEngine(
        [makeRule({ type: 'ip_address', value: '192.168.1.1' })],
        [],
        { blockPrivateNetworks: true },
      );
      const result = engine.checkTarget(makeTarget({ resolvedHost: '192.168.1.1' }));
      expect(result.decision).toBe('allowed');
    });
  });

  describe('port restrictions', () => {
    it('denies when port not in allowed list', () => {
      const engine = new ScopeEngine(
        [makeRule({ type: 'exact_host', value: 'example.com', ports: [443] })],
        [],
      );
      const result = engine.checkTarget(makeTarget({ port: 8080 }));
      expect(result.decision).toBe('denied');
    });

    it('allows when port in allowed list', () => {
      const engine = new ScopeEngine(
        [makeRule({ type: 'exact_host', value: 'example.com', ports: [443, 8080] })],
        [],
      );
      const result = engine.checkTarget(makeTarget({ port: 8080 }));
      expect(result.decision).toBe('allowed');
    });
  });

  describe('time window', () => {
    it('denies outside time window', () => {
      const engine = new ScopeEngine(
        [makeRule({
          type: 'exact_host',
          value: 'example.com',
          timeWindowStart: '2026-01-01T00:00:00Z',
          timeWindowEnd: '2026-01-02T00:00:00Z',
        })],
        [],
      );
      const result = engine.checkTarget(makeTarget());
      expect(result.decision).toBe('denied');
      expect(result.reason).toContain('time window');
    });
  });

  describe('unknown scope denies', () => {
    it('denies when no rules match', () => {
      const engine = new ScopeEngine([], []);
      const result = engine.checkTarget(makeTarget());
      expect(result.decision).toBe('denied');
    });
  });

  describe('assertInScope', () => {
    it('throws ScopeDeniedError when denied', () => {
      const engine = new ScopeEngine([], []);
      expect(() => engine.assertInScope(makeTarget())).toThrow();
    });

    it('returns result when allowed', () => {
      const engine = new ScopeEngine([makeRule({ type: 'exact_host', value: 'example.com' })], []);
      expect(() => engine.assertInScope(makeTarget())).not.toThrow();
    });
  });

  describe('canonicalizeTarget', () => {
    it('extracts scheme and port from URL', () => {
      const engine = new ScopeEngine([], []);
      const result = engine.canonicalizeTarget({
        original: 'https://example.com:8443/api',
        canonical: 'https://example.com:8443/api',
      });
      expect(result.scheme).toBe('https');
      expect(result.resolvedHost).toBe('example.com');
      expect(result.port).toBe(8443);
    });
  });
});
