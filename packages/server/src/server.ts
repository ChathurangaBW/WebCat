import Fastify, { type FastifyInstance } from 'fastify';
import { WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'node:http';
import { okEnvelope, errEnvelope } from '@webcat/shared';
import { API_ROUTES } from '@webcat/protocol';
import type { McpConnectionManager } from '@webcat/mcp-hub';
import type { ScopeEngine } from '@webcat/scope-engine';

// ── Types ─────────────────────────────────────────────────────────

export interface ServerOptions {
  port?: number;
  host?: string;
  logger?: boolean;
  /** Path to the WebCat home directory */
  webcatHomeDir?: string;
  /** Pass external MCP connection manager */
  mcpManager?: McpConnectionManager;
  /** Pass external scope engine */
  scopeEngine?: ScopeEngine;
}

export interface ServerInstance {
  app: FastifyInstance;
  wss: WebSocketServer;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

// ── In-Memory Stores (replace with real DB in production) ─────────

interface Store {
  engagements: Map<string, unknown>;
  findings: Map<string, unknown>;
  evidence: Map<string, unknown>;
  approvals: Map<string, unknown>;
  hypotheses: Map<string, unknown>;
  auditLog: unknown[];
}

// ── Server Factory ────────────────────────────────────────────────

export async function createServer(options: ServerOptions = {}): Promise<ServerInstance> {
  const port = options.port ?? 3456;
  const host = options.host ?? '127.0.0.1';

  const store: Store = {
    engagements: new Map(),
    findings: new Map(),
    evidence: new Map(),
    approvals: new Map(),
    hypotheses: new Map(),
    auditLog: [],
  };

  const app = Fastify({
    logger: options.logger ?? true,
  });

  // ── CORS ────────────────────────────────────────────────────

  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
  });

  // Handle OPTIONS preflight
  app.options('*', async (_request, reply) => {
    reply.status(204).send();
  });

  // ── Request ID ──────────────────────────────────────────────

  app.addHook('onRequest', async (request) => {
    (request as any).requestId = (request.headers['x-request-id'] as string) ?? crypto.randomUUID();
  });

  // ── Health Check ────────────────────────────────────────────

  app.get(API_ROUTES.health, async (request) => {
    return okEnvelope(
      { status: 'ok', uptime: process.uptime(), version: '0.1.0' },
      { requestId: (request as any).requestId },
    );
  });

  // ── Engagements ─────────────────────────────────────────────

  app.get(API_ROUTES.engagements, async (request) => {
    const engagements = Array.from(store.engagements.values());
    return okEnvelope(engagements, { requestId: (request as any).requestId });
  });

  app.post(API_ROUTES.engagements, async (request, reply) => {
    const body = request.body as any;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const engagement = {
      id,
      name: body.name,
      owner: body.owner,
      authorizationAffirmation: body.authorizationAffirmation,
      status: 'draft',
      scope: {
        allowed: body.allowedHosts?.map((host: string) => ({
          id: crypto.randomUUID(),
          engagementId: id,
          type: 'exact_host' as const,
          value: host,
          isAllow: true,
          description: `Allowed host: ${host}`,
        })) ?? [],
        denied: body.deniedHosts?.map((host: string) => ({
          id: crypto.randomUUID(),
          engagementId: id,
          type: 'exact_host' as const,
          value: host,
          isAllow: false,
          description: `Denied host: ${host}`,
        })) ?? [],
      },
      testingPeriod: {
        start: body.testingPeriodStart,
        end: body.testingPeriodEnd,
      },
      testIntensity: body.testIntensity ?? 'safe',
      rateLimit: body.rateLimit ?? 10,
      concurrentLimit: body.concurrentLimit ?? 3,
      credentialsSupplied: body.credentialsSupplied ?? false,
      dataHandlingPolicy: body.dataHandlingPolicy,
      reportingRequirements: body.reportingRequirements,
      selectedMcpIntegrations: body.selectedMcpIntegrations ?? [],
      createdAt: now,
      updatedAt: now,
    };

    store.engagements.set(id, engagement);
    store.auditLog.push({
      id: crypto.randomUUID(),
      engagementId: id,
      actor: body.owner,
      action: 'engagement.created',
      startTime: now,
    });

    reply.status(201);
    return okEnvelope(engagement, { requestId: (request as any).requestId });
  });

  app.get('/api/v1/engagements/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const engagement = store.engagements.get(id);
    if (!engagement) {
      reply.status(404);
      return errEnvelope('NOT_FOUND', `Engagement not found: ${id}`, undefined, { requestId: (request as any).requestId });
    }
    return okEnvelope(engagement, { requestId: (request as any).requestId });
  });

  app.patch('/api/v1/engagements/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const engagement = store.engagements.get(id) as any;
    if (!engagement) {
      reply.status(404);
      return errEnvelope('NOT_FOUND', `Engagement not found: ${id}`, undefined, { requestId: (request as any).requestId });
    }
    const body = request.body as any;
    Object.assign(engagement, body, { updatedAt: new Date().toISOString() });
    store.engagements.set(id, engagement);
    return okEnvelope(engagement, { requestId: (request as any).requestId });
  });

  // ── Scope Check ─────────────────────────────────────────────

  app.post(API_ROUTES.scopeCheck, async (request, reply) => {
    const body = request.body as any;
    if (options.scopeEngine && body.target && body.engagementId) {
      const result = options.scopeEngine.checkTarget({
        original: body.target,
        canonical: body.target,
      });
      return okEnvelope(result, { requestId: (request as any).requestId });
    }
    reply.status(400);
    return errEnvelope('BAD_REQUEST', 'Scope engine not configured or missing parameters', undefined, { requestId: (request as any).requestId });
  });

  // ── Findings ────────────────────────────────────────────────

  app.get(API_ROUTES.findings, async (request) => {
    const findings = Array.from(store.findings.values());
    return okEnvelope(findings, { requestId: (request as any).requestId });
  });

  app.post(API_ROUTES.findings, async (request, reply) => {
    const body = request.body as any;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const finding = {
      id,
      ...body,
      status: 'draft',
      evidenceIds: body.evidenceIds ?? [],
      createdAt: now,
      updatedAt: now,
    };

    store.findings.set(id, finding);
    store.auditLog.push({
      id: crypto.randomUUID(),
      engagementId: body.engagementId,
      actor: 'agent',
      action: 'finding.created',
      startTime: now,
    });

    reply.status(201);
    return okEnvelope(finding, { requestId: (request as any).requestId });
  });

  app.get('/api/v1/findings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const finding = store.findings.get(id);
    if (!finding) {
      reply.status(404);
      return errEnvelope('NOT_FOUND', `Finding not found: ${id}`, undefined, { requestId: (request as any).requestId });
    }
    return okEnvelope(finding, { requestId: (request as any).requestId });
  });

  // ── MCP Connections ─────────────────────────────────────────

  app.get(API_ROUTES.mcpConnections, async (request) => {
    if (options.mcpManager) {
      const states = options.mcpManager.getServerStates();
      return okEnvelope(states, { requestId: (request as any).requestId });
    }
    return okEnvelope([], { requestId: (request as any).requestId });
  });

  app.post(API_ROUTES.mcpConnections, async (request, reply) => {
    const body = request.body as any;
    if (options.mcpManager) {
      try {
        const state = await options.mcpManager.connectServer(body);
        reply.status(state.status === 'failed' ? 400 : 201);
        return okEnvelope(state, { requestId: (request as any).requestId });
      } catch (err) {
        reply.status(500);
        return errEnvelope('MCP_ERROR', err instanceof Error ? err.message : 'Unknown error', undefined, { requestId: (request as any).requestId });
      }
    }
    reply.status(400);
    return errEnvelope('BAD_REQUEST', 'MCP manager not configured', undefined, { requestId: (request as any).requestId });
  });

  app.get(API_ROUTES.mcpCapabilities, async (request) => {
    if (options.mcpManager) {
      const capabilities = options.mcpManager.getAvailableCapabilities();
      return okEnvelope(capabilities, { requestId: (request as any).requestId });
    }
    return okEnvelope([], { requestId: (request as any).requestId });
  });

  // ── Approvals ───────────────────────────────────────────────

  app.get(API_ROUTES.approvals, async (request) => {
    const approvals = Array.from(store.approvals.values());
    return okEnvelope(approvals, { requestId: (request as any).requestId });
  });

  app.post('/api/v1/approvals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const approval = store.approvals.get(id) as any;
    if (!approval) {
      reply.status(404);
      return errEnvelope('NOT_FOUND', `Approval not found: ${id}`, undefined, { requestId: (request as any).requestId });
    }
    const body = request.body as any;
    approval.decision = body.decision;
    approval.status = body.decision === 'deny' ? 'denied' : 'approved';
    store.approvals.set(id, approval);

    store.auditLog.push({
      id: crypto.randomUUID(),
      engagementId: approval.engagementId,
      actor: 'user',
      action: `approval.${body.decision}`,
      approvalDecision: body.decision,
      startTime: new Date().toISOString(),
    });

    return okEnvelope(approval, { requestId: (request as any).requestId });
  });

  // ── Audit ───────────────────────────────────────────────────

  app.get(API_ROUTES.audit, async (request) => {
    return okEnvelope(store.auditLog, { requestId: (request as any).requestId });
  });

  // ── Reports ─────────────────────────────────────────────────

  app.post(API_ROUTES.reportGenerate, async (request) => {
    const body = request.body as any;
    const id = crypto.randomUUID();
    const report = {
      id,
      engagementId: body.engagementId,
      format: body.format ?? 'markdown',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    return okEnvelope(report, { requestId: (request as any).requestId });
  });

  // ── WebSocket ───────────────────────────────────────────────

  const httpServer = app.server;
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    const sessionId = crypto.randomUUID();
    ws.send(JSON.stringify({
      type: 'session:connected',
      payload: { sessionId },
      timestamp: new Date().toISOString(),
    }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Echo for now; in production, route to agent engine
        ws.send(JSON.stringify({
          type: 'agent:status',
          payload: { status: 'received', echo: msg },
          timestamp: new Date().toISOString(),
          sessionId,
        }));
      } catch {
        ws.send(JSON.stringify({
          type: 'agent:error',
          payload: { error: 'Invalid message format' },
          timestamp: new Date().toISOString(),
          sessionId,
        }));
      }
    });

    ws.on('close', () => {
      // Session cleanup
    });
  });

  // ── Start / Stop ────────────────────────────────────────────

  async function start(): Promise<void> {
    await app.listen({ port, host });
    app.log.info(`WebCat server listening on http://${host}:${port}`);
    app.log.info(`WebSocket available at ws://${host}:${port}/ws`);
  }

  async function stop(): Promise<void> {
    wss.close();
    await app.close();
  }

  return { app, wss, start, stop };
}
