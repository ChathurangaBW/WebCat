export type EngagementMode = "observe" | "manual" | "authorized-auto";
export type OperationKind = "passive" | "active" | "high" | "destructive";
export type RiskClass = "read" | "active" | "high" | "destructive";

export interface ScopeRule {
  id: string;
  scheme?: "http" | "https";
  host: string;
  port?: number;
  pathPrefix?: string;
}

export interface Engagement {
  id: string;
  name: string;
  authorizationConfirmed: boolean;
  authorizationReference?: string;
  mode: EngagementMode;
  allow: ScopeRule[];
  deny: ScopeRule[];
  maxRequestsPerSecond: number;
  maxParallelRequests: number;
  allowHighRisk: boolean;
  allowDestructive: boolean;
}

export interface ScopeDecision {
  allowed: boolean;
  reason: string;
  normalizedTarget?: string;
  matchedRuleId?: string;
  operation: OperationKind;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  status: "allowed" | "blocked" | "completed" | "failed";
  details: Record<string, unknown>;
}

export interface EvidenceRecord {
  id: string;
  timestamp: string;
  agent: string;
  kind: "request" | "response" | "observation" | "model-output" | "validation" | "artifact";
  summary: string;
  data: unknown;
  sha256: string;
  byteLength: number;
}

export type HypothesisStatus = "open" | "testing" | "supported" | "disproved" | "blocked";
export interface Hypothesis {
  id: string;
  title: string;
  rationale: string;
  target?: string;
  expectedSecureBehavior?: string;
  status: HypothesisStatus;
  evidenceIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type FindingStatus = "candidate" | "validated" | "rejected" | "needs-more-evidence";
export interface Finding {
  id: string;
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  status: FindingStatus;
  description: string;
  impact: string;
  remediation: string;
  target?: string;
  evidenceIds: string[];
  hypothesisIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  validationNotes?: string;
}

export type ApprovalStatus = "active" | "revoked" | "expired";
export interface ApprovalRecord {
  id: string;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  reason: string;
  status: ApprovalStatus;
  risk?: RiskClass;
  server?: string;
  tool?: string;
  targetPattern?: string;
  revokedAt?: string;
}

export type WorkflowState =
  | "NEW" | "AUTHORIZATION_REQUIRED" | "SCOPE_READY" | "MCP_DISCOVERY"
  | "PASSIVE_MAPPING" | "ATTACK_SURFACE_READY" | "HYPOTHESIS_GENERATION"
  | "ACTIVE_VALIDATION" | "FINDING_REVIEW" | "REPORT_READY" | "COMPLETED"
  | "PAUSED" | "BLOCKED" | "FAILED";

export interface SessionRecord {
  id: string;
  objective: string;
  state: WorkflowState;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  selectedProfiles: string[];
  reportPath?: string;
  error?: string;
}

export interface SkillDefinition {
  name: string;
  description: string;
  whenToUse?: string;
  body: string;
  source: string;
}

export interface AppConfig {
  provider: {
    type: "chat-completions";
    baseUrl: string;
    apiKeyEnv: string;
    model: string;
    timeoutMs: number;
    maxTokens: number;
    temperature: number;
  };
  swarm: {
    maxConcurrency: number;
    maxAgentTurns: number;
    maxRetries: number;
  };
  security: {
    redactSecrets: boolean;
    maxEvidenceBytes: number;
    requireApprovalForActive: boolean;
  };
}
