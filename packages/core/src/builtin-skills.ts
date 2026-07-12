import type { SkillDefinition } from "./types.js";

export const BUILTIN_SKILLS: SkillDefinition[] = [
  {
    name: "pre-phase-briefing",
    description: "Establish scope, evidence, exclusions, stop conditions, and handoff format before a phase",
    whenToUse: "Before every swarm phase",
    source: "builtin:webcat",
    body: "Read the engagement, current session, evidence index, hypotheses, findings, and prior failures. State the objective, lane, exclusions, evidence requirements, safe stopping conditions, and handoff structure. Do not begin active work when authorization or scope is unresolved."
  },
  {
    name: "passive-attack-surface-mapping",
    description: "Build a coverage-oriented map from traffic, routes, schemas, and metadata",
    whenToUse: "During reconnaissance and traffic analysis",
    source: "builtin:webcat",
    body: "Inventory hosts, ports, routes, methods, parameters, content types, authentication states, roles, identifiers, state-changing operations, browser entry points, APIs, and observed technologies. Mark each item observed, inferred, or unknown. Prefer deterministic traffic evidence over model inference."
  },
  {
    name: "access-control-testing",
    description: "Perform controlled object, function, and tenant authorization comparisons",
    whenToUse: "When testing authorization boundaries",
    source: "builtin:webcat",
    body: "Use at least two controlled identities or roles. Establish an owner/control request, change one authorization variable at a time, avoid destructive state changes, and compare status, body, side effects, and audit behavior. A differing identifier alone is not proof of unauthorized access."
  },
  {
    name: "authentication-session-testing",
    description: "Assess authentication, recovery, token, cookie, and session lifecycle controls",
    whenToUse: "When authentication or sessions are in scope",
    source: "builtin:webcat",
    body: "Map login, logout, recovery, MFA, token issuance, refresh, rotation, revocation, cookie flags, fixation, concurrency, and timeout behavior. Preserve test-account safety and never attempt credential attacks without explicit high-risk approval."
  },
  {
    name: "safe-injection-validation",
    description: "Validate input-handling hypotheses with minimal reversible probes and controls",
    whenToUse: "When injection behavior is suspected",
    source: "builtin:webcat",
    body: "Begin with a clean baseline and a harmless control. Use the smallest probe capable of distinguishing parsing behavior. Avoid destructive payloads, persistence, external callbacks, data extraction, and resource exhaustion. Record exact encoding and response differences."
  },
  {
    name: "finding-validation",
    description: "Independently reproduce, reject, or request more evidence for a candidate",
    whenToUse: "For every candidate finding",
    source: "builtin:webcat",
    body: "Do not inherit the originating agent's conclusion. Reproduce within scope, include a negative or expected-behavior control, preserve exact evidence, analyze alternative explanations, establish impact, identify root cause, and set validated, rejected, or needs-more-evidence."
  },
  {
    name: "critic-gate",
    description: "Adversarially review high and critical findings",
    whenToUse: "Before a high-impact finding enters the final report",
    source: "builtin:webcat",
    body: "Attempt to disprove exploitability, impact, affected scope, and severity. Check for environmental artifacts, cached responses, identity mistakes, duplicated root causes, missing controls, and unsupported escalation. Downgrade or reject claims that do not survive disproof."
  },
  {
    name: "evidence-curation",
    description: "Ensure evidence integrity, redaction, traceability, and coverage closure",
    whenToUse: "Before validation and reporting",
    source: "builtin:webcat",
    body: "Verify that every claim points to evidence, every evidence item has a stable identifier and hash, sensitive values are redacted, hypotheses have outcomes, candidates are not represented as findings, and coverage gaps are stated explicitly."
  },
  {
    name: "security-reporting",
    description: "Create a defensible report from independently validated findings",
    whenToUse: "At report generation",
    source: "builtin:webcat",
    body: "Include scope and authorization reference, methodology, limitations, validated findings, evidence references, impact, severity rationale, and actionable remediation. Exclude candidate and rejected items from the validated findings section."
  }
];
