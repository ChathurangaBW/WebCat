import type { WorkflowState } from "./types.js";

const transitions: Record<WorkflowState, WorkflowState[]> = {
  NEW: ["AUTHORIZATION_REQUIRED", "SCOPE_READY", "BLOCKED", "FAILED"],
  AUTHORIZATION_REQUIRED: ["SCOPE_READY", "BLOCKED", "FAILED"],
  SCOPE_READY: ["MCP_DISCOVERY", "PASSIVE_MAPPING", "BLOCKED", "FAILED"],
  MCP_DISCOVERY: ["PASSIVE_MAPPING", "BLOCKED", "FAILED"],
  PASSIVE_MAPPING: ["ATTACK_SURFACE_READY", "PAUSED", "FAILED"],
  ATTACK_SURFACE_READY: ["HYPOTHESIS_GENERATION", "PAUSED", "FAILED"],
  HYPOTHESIS_GENERATION: ["ACTIVE_VALIDATION", "FINDING_REVIEW", "REPORT_READY", "PAUSED", "FAILED"],
  ACTIVE_VALIDATION: ["FINDING_REVIEW", "PAUSED", "FAILED"],
  FINDING_REVIEW: ["ACTIVE_VALIDATION", "REPORT_READY", "PAUSED", "FAILED"],
  REPORT_READY: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  PAUSED: ["SCOPE_READY", "PASSIVE_MAPPING", "HYPOTHESIS_GENERATION", "ACTIVE_VALIDATION", "FINDING_REVIEW", "REPORT_READY", "FAILED"],
  BLOCKED: ["SCOPE_READY", "PAUSED", "FAILED"],
  FAILED: ["PAUSED", "SCOPE_READY"]
};

export class WorkflowMachine {
  public constructor(public state: WorkflowState = "NEW") {}

  public canTransition(next: WorkflowState): boolean {
    return transitions[this.state].includes(next);
  }

  public transition(next: WorkflowState): WorkflowState {
    if (!this.canTransition(next)) throw new Error(`invalid workflow transition ${this.state} -> ${next}`);
    this.state = next;
    return this.state;
  }
}
