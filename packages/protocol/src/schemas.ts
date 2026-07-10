import { z } from 'zod';
import {
  EngagementSchema,
  ScopeRuleSchema,
  FindingSchema,
  HypothesisSchema,
  ApprovalRequestSchema,
  AuditEventSchema,
  SeveritySchema,
  ConfidenceSchema,
  FindingStatusSchema,
} from '@webcat/shared';

// ── API Envelope ──────────────────────────────────────────────────

export const EnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.boolean(),
    data: dataSchema.nullable(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
      })
      .nullable(),
    meta: z.object({
      requestId: z.string(),
      timestamp: z.string(),
      pagination: z
        .object({
          offset: z.number(),
          limit: z.number(),
          total: z.number(),
          hasMore: z.boolean(),
        })
        .optional(),
    }),
  });

// ── API Request Schemas ───────────────────────────────────────────

export const CreateEngagementRequestSchema = z.object({
  name: z.string().min(1).max(200),
  owner: z.string().min(1),
  authorizationAffirmation: z.literal(true, {
    errorMap: () => ({ message: 'Authorization affirmation must be true' }),
  }),
  testIntensity: z.enum(['passive', 'safe', 'standard', 'intrusive']).default('safe'),
  rateLimit: z.number().int().positive().max(1000).default(10),
  concurrentLimit: z.number().int().positive().max(50).default(3),
  dataHandlingPolicy: z.string().optional(),
  reportingRequirements: z.string().optional(),
  testingPeriodStart: z.string().datetime(),
  testingPeriodEnd: z.string().datetime(),
  allowedHosts: z.array(z.string().min(1)).min(1, 'At least one allowed host is required'),
  deniedHosts: z.array(z.string()).default([]),
  selectedMcpIntegrations: z.array(z.string()).default([]),
});

export const UpdateEngagementRequestSchema = CreateEngagementRequestSchema.partial();

export const AddScopeRuleRequestSchema = z.object({
  engagementId: z.string(),
  type: z.enum([
    'exact_host', 'domain_suffix', 'wildcard_subdomain',
    'exact_url', 'url_prefix', 'cidr', 'ip_address',
    'port_range', 'protocol',
  ]),
  value: z.string().min(1),
  isAllow: z.boolean(),
  ports: z.array(z.number().int().min(1).max(65535)).optional(),
  protocols: z.array(z.enum(['http', 'https', 'ws', 'wss'])).optional(),
  description: z.string().optional(),
});

export const CreateFindingRequestSchema = z.object({
  engagementId: z.string(),
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  severity: SeveritySchema,
  confidence: ConfidenceSchema,
  cwe: z.string().optional(),
  owasp: z.string().optional(),
  affectedAsset: z.string().optional(),
  affectedEndpoint: z.string().optional(),
  preconditions: z.string().optional(),
  reproductionSteps: z.string().optional(),
  expectedBehavior: z.string().optional(),
  actualBehavior: z.string().optional(),
  securityImpact: z.string().optional(),
  remediation: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
});

export const UpdateFindingRequestSchema = CreateFindingRequestSchema.partial().extend({
  status: FindingStatusSchema.optional(),
  duplicateOf: z.string().optional(),
});

export const CreateHypothesisRequestSchema = z.object({
  engagementId: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  target: z.object({
    original: z.string(),
    resolvedHost: z.string().optional(),
    port: z.number().int().min(1).max(65535).optional(),
    scheme: z.enum(['http', 'https', 'ws', 'wss']).optional(),
  }),
  testingMethod: z.string(),
  requiredCapability: z.string(),
  validationLevel: z.enum(['L0', 'L1', 'L2', 'L3', 'L4']).default('L0'),
  owaspRef: z.string().optional(),
  cweRef: z.string().optional(),
});

export const ApprovalDecisionRequestSchema = z.object({
  decision: z.enum(['deny', 'approve_once', 'approve_for_task', 'approve_for_session', 'approve_persistent']),
  comment: z.string().optional(),
});

// ── MCP Connection Request ────────────────────────────────────────

export const McpConnectionRequestSchema = z.object({
  name: z.string().min(1).max(100),
  transport: z.enum(['stdio', 'http', 'sse']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  workingDir: z.string().optional(),
  bearerTokenEnv: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
  toolAllowlist: z.array(z.string()).optional(),
  toolBlocklist: z.array(z.string()).optional(),
  trustLevel: z.enum(['untrusted', 'reviewed', 'trusted', 'system']).default('untrusted'),
});

// ── Query Schemas ─────────────────────────────────────────────────

export const PaginationQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const FindingQuerySchema = PaginationQuerySchema.extend({
  severity: SeveritySchema.optional(),
  confidence: ConfidenceSchema.optional(),
  status: FindingStatusSchema.optional(),
  search: z.string().optional(),
});

// ── WebSocket Event Schemas ───────────────────────────────────────

export const WsEventTypeSchema = z.enum([
  'agent:status',
  'agent:output',
  'agent:tool_call',
  'agent:tool_result',
  'agent:error',
  'agent:approval_required',
  'approval:updated',
  'engagement:updated',
  'finding:created',
  'finding:updated',
  'mcp:status_changed',
  'scope:decision',
  'audit:event',
  'task:status',
  'session:connected',
  'session:disconnected',
]);

export const WsEventSchema = z.object({
  type: WsEventTypeSchema,
  payload: z.unknown(),
  timestamp: z.string(),
  sessionId: z.string().optional(),
  engagementId: z.string().optional(),
});

// ── API Route Paths ───────────────────────────────────────────────

export const API_ROUTES = {
  // Health
  health: '/api/v1/health',

  // Engagements
  engagements: '/api/v1/engagements',
  engagement: '/api/v1/engagements/:id',
  engagementScope: '/api/v1/engagements/:id/scope',
  engagementFindings: '/api/v1/engagements/:id/findings',
  engagementHypotheses: '/api/v1/engagements/:id/hypotheses',
  engagementEvidence: '/api/v1/engagements/:id/evidence',

  // Findings
  findings: '/api/v1/findings',
  finding: '/api/v1/findings/:id',
  findingDedup: '/api/v1/findings/:id/deduplicate',

  // Evidence
  evidence: '/api/v1/evidence',
  evidenceItem: '/api/v1/evidence/:id',
  evidenceDownload: '/api/v1/evidence/:id/download',

  // Scope
  scopeCheck: '/api/v1/scope/check',

  // MCP
  mcpConnections: '/api/v1/mcp/connections',
  mcpConnection: '/api/v1/mcp/connections/:name',
  mcpConnectionTest: '/api/v1/mcp/connections/:name/test',
  mcpConnectionReconnect: '/api/v1/mcp/connections/:name/reconnect',
  mcpCapabilities: '/api/v1/mcp/capabilities',

  // Approvals
  approvals: '/api/v1/approvals',
  approval: '/api/v1/approvals/:id',

  // Reports
  reports: '/api/v1/reports',
  reportGenerate: '/api/v1/reports/generate',
  reportDownload: '/api/v1/reports/:id/download',

  // Audit
  audit: '/api/v1/audit',
  auditEngagement: '/api/v1/audit/engagements/:id',

  // Agents
  agents: '/api/v1/agents',
  agentStatus: '/api/v1/agents/status',
  agentCancel: '/api/v1/agents/:id/cancel',

  // Auth
  authLogin: '/api/v1/auth/login',
  authLogout: '/api/v1/auth/logout',
  authSession: '/api/v1/auth/session',
} as const;
