import { z } from 'zod';

// ── Core Identifiers ──────────────────────────────────────────────

export const UlidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/i, 'Must be a valid ULID');
export type Ulid = z.infer<typeof UlidSchema>;

export const RequestIdSchema = z.string().min(1);
export type RequestId = z.infer<typeof RequestIdSchema>;

// ── Scope Types ───────────────────────────────────────────────────

export const ScopeDecisionSchema = z.enum(['allowed', 'denied', 'requires_approval']);
export type ScopeDecision = z.infer<typeof ScopeDecisionSchema>;

export const TargetSchema = z.object({
  original: z.string(),
  canonical: z.string(),
  resolvedHost: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  scheme: z.enum(['http', 'https', 'ws', 'wss']).optional(),
});
export type Target = z.infer<typeof TargetSchema>;

export const ScopeRuleTypeSchema = z.enum([
  'exact_host',
  'domain_suffix',
  'wildcard_subdomain',
  'exact_url',
  'url_prefix',
  'cidr',
  'ip_address',
  'port_range',
  'protocol',
]);
export type ScopeRuleType = z.infer<typeof ScopeRuleTypeSchema>;

export const ScopeRuleSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  type: ScopeRuleTypeSchema,
  value: z.string(),
  isAllow: z.boolean(),
  ports: z.array(z.number().int().min(1).max(65535)).optional(),
  protocols: z.array(z.enum(['http', 'https', 'ws', 'wss'])).optional(),
  timeWindowStart: z.string().datetime().optional(),
  timeWindowEnd: z.string().datetime().optional(),
  rateLimit: z.number().int().positive().optional(),
  concurrentLimit: z.number().int().positive().optional(),
  description: z.string().optional(),
});
export type ScopeRule = z.infer<typeof ScopeRuleSchema>;

// ── Trust Levels ──────────────────────────────────────────────────

export const TrustLevelSchema = z.enum(['untrusted', 'reviewed', 'trusted', 'system']);
export type TrustLevel = z.infer<typeof TrustLevelSchema>;

// ── Risk Classification ───────────────────────────────────────────

export const RiskClassificationSchema = z.object({
  readsData: z.boolean().default(true),
  writesData: z.boolean().default(false),
  sendsNetwork: z.boolean().default(false),
  executesCommands: z.boolean().default(false),
  deletesData: z.boolean().default(false),
  isDestructive: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  maxRate: z.number().int().positive().optional(),
  maxConcurrent: z.number().int().positive().optional(),
});
export type RiskClassification = z.infer<typeof RiskClassificationSchema>;

// ── Evidence Types ────────────────────────────────────────────────

export const EvidenceArtifactSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  contentHash: z.string(),
  mimeType: z.string(),
  size: z.number(),
  sourceTool: z.string().optional(),
  sourceMcpServer: z.string().optional(),
  redacted: z.boolean().default(false),
  createdAt: z.string().datetime(),
  accessPolicy: z.enum(['engagement', 'finding', 'report']).default('engagement'),
});
export type EvidenceArtifact = z.infer<typeof EvidenceArtifactSchema>;

// ── Finding Types ─────────────────────────────────────────────────

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

export const ConfidenceSchema = z.enum(['certain', 'firm', 'tentative']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const FindingStatusSchema = z.enum([
  'draft',
  'under_review',
  'confirmed',
  'duplicate',
  'false_positive',
  'accepted_risk',
  'remediated',
  'closed',
]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  title: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  confidence: ConfidenceSchema,
  cwe: z.string().optional(),
  owasp: z.string().optional(),
  status: FindingStatusSchema.default('draft'),
  affectedAsset: z.string().optional(),
  affectedEndpoint: z.string().optional(),
  preconditions: z.string().optional(),
  reproductionSteps: z.string().optional(),
  expectedBehavior: z.string().optional(),
  actualBehavior: z.string().optional(),
  securityImpact: z.string().optional(),
  remediation: z.string().optional(),
  retestGuidance: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  duplicateOf: z.string().optional(),
  agentProvenance: z.string().optional(),
  toolProvenance: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Finding = z.infer<typeof FindingSchema>;

// ── Engagement Types ──────────────────────────────────────────────

export const TestIntensitySchema = z.enum(['passive', 'safe', 'standard', 'intrusive']);
export type TestIntensity = z.infer<typeof TestIntensitySchema>;

export const EngagementStatusSchema = z.enum([
  'draft',
  'validated',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
]);
export type EngagementStatus = z.infer<typeof EngagementStatusSchema>;

export const EngagementSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  owner: z.string(),
  authorizationAffirmation: z.boolean(),
  status: EngagementStatusSchema.default('draft'),
  scope: z.object({
    allowed: z.array(ScopeRuleSchema),
    denied: z.array(ScopeRuleSchema),
  }),
  testingPeriod: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  testIntensity: TestIntensitySchema.default('safe'),
  rateLimit: z.number().int().positive().default(10),
  concurrentLimit: z.number().int().positive().default(3),
  credentialsSupplied: z.boolean().default(false),
  dataHandlingPolicy: z.string().optional(),
  reportingRequirements: z.string().optional(),
  selectedMcpIntegrations: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Engagement = z.infer<typeof EngagementSchema>;

// ── Approval Types ────────────────────────────────────────────────

export const ApprovalDecisionSchema = z.enum([
  'deny',
  'approve_once',
  'approve_for_task',
  'approve_for_session',
  'approve_persistent',
]);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'denied', 'expired']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  agentId: z.string(),
  toolName: z.string(),
  mcpServer: z.string().optional(),
  riskClassification: RiskClassificationSchema,
  target: TargetSchema.optional(),
  scopeResult: ScopeDecisionSchema.optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  expectedEffect: z.string().optional(),
  reversibility: z.string().optional(),
  timeout: z.number().int().positive().optional(),
  status: ApprovalStatusSchema.default('pending'),
  decision: ApprovalDecisionSchema.optional(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

// ── Audit Types ───────────────────────────────────────────────────

export const AuditEventSchema = z.object({
  id: z.string(),
  engagementId: z.string().optional(),
  sessionId: z.string().optional(),
  taskId: z.string().optional(),
  actor: z.string(),
  action: z.string(),
  toolName: z.string().optional(),
  mcpServer: z.string().optional(),
  scopeDecision: ScopeDecisionSchema.optional(),
  approvalDecision: ApprovalDecisionSchema.optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  result: z.string().optional(),
  error: z.string().optional(),
  evidenceRefs: z.array(z.string()).default([]),
  parentAction: z.string().optional(),
  correlationId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ── Agent Types ───────────────────────────────────────────────────

export const AgentProfileTypeSchema = z.enum([
  'orchestrator',
  'explorer',
  'planner',
  'coder',
  'reviewer',
  'test_engineer',
  'security_reviewer',
  'critic',
  'researcher',
  'documentation',
  'reporter',
  'curator',
  'engagement_manager',
  'scope_guardian',
  'passive_recon',
  'attack_surface_mapper',
  'traffic_analyst',
  'auth_session_agent',
  'authz_access_control_agent',
  'api_graphql_agent',
  'input_validation_agent',
  'client_side_agent',
  'business_logic_agent',
  'workflow_automation_agent',
  'controlled_fuzzing_agent',
  'websocket_agent',
  'evidence_verifier',
  'finding_deduplicator',
  'severity_taxonomy_agent',
  'remediation_writer',
  'retest_agent',
]);
export type AgentProfileType = z.infer<typeof AgentProfileTypeSchema>;

export const AgentRoleSchema = z.enum(['engineering', 'pentest']);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

// ── Hypothesis Types ──────────────────────────────────────────────

export const ValidationLevelSchema = z.enum(['L0', 'L1', 'L2', 'L3', 'L4']);
export type ValidationLevel = z.infer<typeof ValidationLevelSchema>;

export const HypothesisStatusSchema = z.enum([
  'proposed',
  'approved',
  'in_progress',
  'confirmed',
  'rejected',
  'inconclusive',
]);
export type HypothesisStatus = z.infer<typeof HypothesisStatusSchema>;

export const HypothesisSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  title: z.string(),
  description: z.string(),
  preconditions: z.string().optional(),
  target: TargetSchema,
  testingMethod: z.string(),
  requiredCapability: z.string(),
  validationLevel: ValidationLevelSchema.default('L0'),
  risk: z.string().optional(),
  expectedNormalBehavior: z.string().optional(),
  potentialVulnerableBehavior: z.string().optional(),
  evidenceRequired: z.string().optional(),
  approvalRequired: z.boolean().default(true),
  owaspRef: z.string().optional(),
  cweRef: z.string().optional(),
  status: HypothesisStatusSchema.default('proposed'),
  findingId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Hypothesis = z.infer<typeof HypothesisSchema>;
