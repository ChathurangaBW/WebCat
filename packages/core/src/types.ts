export type OperatingMode = "observe" | "manual" | "authorized-auto";
export type OperationKind = "passive" | "active" | "destructive";

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
  mode: OperatingMode;
  allow: ScopeRule[];
  deny: ScopeRule[];
}

export interface ScopeDecision {
  allowed: boolean;
  reason: string;
  normalizedTarget?: string;
  matchedRuleId?: string;
}

export type WorkflowState =
  | "NEW"
  | "AUTHORIZATION_REQUIRED"
  | "SCOPE_READY"
  | "MCP_DISCOVERY"
  | "PASSIVE_MAPPING"
  | "ATTACK_SURFACE_READY"
  | "HYPOTHESIS_GENERATION"
  | "ACTIVE_VALIDATION"
  | "FINDING_REVIEW"
  | "REPORT_READY"
  | "COMPLETED"
  | "PAUSED"
  | "BLOCKED";
