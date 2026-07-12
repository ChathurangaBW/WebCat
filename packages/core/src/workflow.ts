import type { WorkflowState } from "./types.js";

const transitions: Readonly<Record<WorkflowState, readonly WorkflowState[]>> = {
  NEW: ["AUTHORIZATION_REQUIRED", "SCOPE_READY", "BLOCKED"],
  AUTHORIZATION_REQUIRED: ["SCOPE_READY", "BLOCKED"],
  SCOPE_READY: ["MCP_DISCOVERY", "PAUSED", "BLOCKED"],
  MCP_DISCOVERY: ["PASSIVE_MAPPING", "PAUSED", "BLOCKED"],
  PASSIVE_MAPPING: ["ATTACK_SURFACE_READY", "PAUSED", "BLOCKED"],
  ATTACK_SURFACE_READY: ["HYPOTHESIS_GENERATION", "PAUSED", "BLOCKED"],
  HYPOTHESIS_GENERATION: ["ACTIVE_VALIDATION", "FINDING_REVIEW", "PAUSED", "BLOCKED"],
  ACTIVE_VALIDATION: ["FINDING_REVIEW", "HYPOTHESIS_GENERATION", "PAUSED", "BLOCKED"],
  FINDING_REVIEW: ["REPORT_READY", "ACTIVE_VALIDATION", "PAUSED", "BLOCKED"],
  REPORT_READY: ["COMPLETED", "FINDING_REVIEW", "PAUSED", "BLOCKED"],
  COMPLETED: [],
  PAUSED: [
    "SCOPE_READY",
    "MCP_DISCOVERY",
    "PASSIVE_MAPPING",
    "ATTACK_SURFACE_READY",
    "HYPOTHESIS_GENERATION",
    "ACTIVE_VALIDATION",
    "FINDING_REVIEW",
    "REPORT_READY",
    "BLOCKED",
  ],
  BLOCKED: ["AUTHORIZATION_REQUIRED", "SCOPE_READY", "PAUSED"],
};

export function canTransition(from: WorkflowState, to: WorkflowState): boolean {
  return transitions[from].includes(to);
}

export class WorkflowStateMachine {
  public constructor(public state: WorkflowState = "NEW") {}

  public transition(to: WorkflowState): void {
    if (!canTransition(this.state, to)) {
      throw new Error(`invalid WebCat workflow transition: ${this.state} -> ${to}`);
    }
    this.state = to;
  }
}
