export interface AgentProfile {
  name: string;
  purpose: string;
  canUseActiveTools: boolean;
  outputContract: string;
}

export const WEB_SECURITY_PROFILES: readonly AgentProfile[] = [
  { name: 'webcat-orchestrator', purpose: 'Plan phases, dispatch specialists, and enforce workflow gates', canUseActiveTools: false, outputContract: 'phase decision and task bundle' },
  { name: 'scope-guardian', purpose: 'Authorize or block external operations against engagement scope', canUseActiveTools: false, outputContract: 'scope decision with reason' },
  { name: 'recon-mapper', purpose: 'Build the passive attack-surface inventory', canUseActiveTools: false, outputContract: 'hosts, endpoints, parameters, technologies' },
  { name: 'traffic-analyst', purpose: 'Analyze captured HTTP traffic and identify testable hypotheses', canUseActiveTools: false, outputContract: 'candidate hypotheses with evidence references' },
  { name: 'auth-session-analyst', purpose: 'Assess authentication and session controls', canUseActiveTools: true, outputContract: 'candidate findings and reproduction evidence' },
  { name: 'access-control-analyst', purpose: 'Assess object-level and function-level authorization', canUseActiveTools: true, outputContract: 'candidate findings and controls' },
  { name: 'injection-analyst', purpose: 'Assess server-side injection classes with bounded tests', canUseActiveTools: true, outputContract: 'candidate findings and safe proof' },
  { name: 'client-side-analyst', purpose: 'Assess browser-side trust boundaries and injection', canUseActiveTools: true, outputContract: 'candidate findings and browser evidence' },
  { name: 'api-analyst', purpose: 'Assess REST, GraphQL, and WebSocket attack surfaces', canUseActiveTools: true, outputContract: 'candidate findings and protocol evidence' },
  { name: 'business-logic-analyst', purpose: 'Assess workflow and state-machine abuse cases', canUseActiveTools: true, outputContract: 'candidate findings and invariant violations' },
  { name: 'finding-validator', purpose: 'Independently reproduce, disprove, or downgrade candidates', canUseActiveTools: true, outputContract: 'validated, rejected, or needs-more-evidence decision' },
  { name: 'security-critic', purpose: 'Challenge severity, root cause, evidence, and scope compliance', canUseActiveTools: false, outputContract: 'critic gate decision' },
  { name: 'evidence-curator', purpose: 'Normalize, redact, hash, and link evidence artifacts', canUseActiveTools: false, outputContract: 'evidence manifest' },
  { name: 'report-writer', purpose: 'Generate reports exclusively from validated findings', canUseActiveTools: false, outputContract: 'Markdown and machine-readable report' },
] as const;
