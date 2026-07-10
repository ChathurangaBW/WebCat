import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type ServerInstance } from './server.js';

describe('WebCat Server', () => {
  let server: ServerInstance;
  let baseUrl: string;

  beforeAll(async () => {
    server = await createServer({ port: 0, logger: false });
    await server.start();
    const addr = server.app.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3456;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  // ── Health ──────────────────────────────────────────────────

  it('GET /api/v1/health returns ok', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(body.meta.requestId).toBeDefined();
  });

  // ── Engagements ─────────────────────────────────────────────

  it('POST /api/v1/engagements creates an engagement', async () => {
    const res = await fetch(`${baseUrl}/api/v1/engagements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Engagement',
        owner: 'tester',
        authorizationAffirmation: true,
        testingPeriodStart: '2026-07-10T00:00:00Z',
        testingPeriodEnd: '2026-07-17T00:00:00Z',
        allowedHosts: ['example.com'],
        testIntensity: 'safe',
      }),
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe('Test Engagement');
    expect(body.data.scope.allowed).toHaveLength(1);
    expect(body.data.scope.allowed[0].value).toBe('example.com');
  });

  it('GET /api/v1/engagements lists engagements', async () => {
    const res = await fetch(`${baseUrl}/api/v1/engagements`);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/engagements/:id returns 404 for missing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/engagements/nonexistent`);
    expect(res.status).toBe(404);
  });

  // ── Findings ────────────────────────────────────────────────

  it('POST /api/v1/findings creates a finding', async () => {
    const res = await fetch(`${baseUrl}/api/v1/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engagementId: 'test-eng',
        title: 'XSS Vulnerability',
        description: 'Reflected XSS in search parameter',
        severity: 'high',
        confidence: 'firm',
        cwe: 'CWE-79',
        owasp: 'A03:2021',
        affectedEndpoint: '/search',
      }),
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.severity).toBe('high');
    expect(body.data.status).toBe('draft');
    expect(body.data.cwe).toBe('CWE-79');
  });

  // ── MCP Connections ─────────────────────────────────────────

  it('GET /api/v1/mcp/connections returns empty when no manager', async () => {
    const res = await fetch(`${baseUrl}/api/v1/mcp/connections`);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  // ── Audit ───────────────────────────────────────────────────

  it('GET /api/v1/audit returns audit log', async () => {
    const res = await fetch(`${baseUrl}/api/v1/audit`);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  // ── Reports ─────────────────────────────────────────────────

  it('POST /api/v1/reports/generate creates a report', async () => {
    const res = await fetch(`${baseUrl}/api/v1/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engagementId: 'test-eng', format: 'markdown' }),
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.format).toBe('markdown');
    expect(body.data.status).toBe('pending');
  });

  // ── CORS and Security Headers ───────────────────────────────

  it('sets security headers', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });
});
