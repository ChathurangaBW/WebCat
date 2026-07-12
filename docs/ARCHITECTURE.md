# Architecture

## Design goals

WebCat separates probabilistic agent reasoning from deterministic execution policy. Agents can propose actions, but only the MCP gateway can execute them.

## Packages

- `@webcat/core` — engagement schema, scope engine, approvals, evidence, audit, sessions, hypotheses, findings, skills, and reports.
- `@webcat/mcp-gateway` — generic MCP transports, discovery, classification, target extraction, guard pipeline, filtering, and rate limits.
- `@webcat/agent-profiles` — specialist contribution catalog and objective-based selection.
- `@webcat/agent-runtime` — model provider, JSON action protocol, isolated agent loop, bounded swarm, validation, and critic gates.
- `@webcat/cli` — operator commands, diagnostics, initialization, reporting, and TUI.

## Session state machine

```text
NEW
 -> AUTHORIZATION_REQUIRED | SCOPE_READY
 -> MCP_DISCOVERY
 -> PASSIVE_MAPPING
 -> ATTACK_SURFACE_READY
 -> HYPOTHESIS_GENERATION
 -> ACTIVE_VALIDATION (when permitted and needed)
 -> FINDING_REVIEW
 -> REPORT_READY
 -> COMPLETED
```

`PAUSED`, `BLOCKED`, and `FAILED` preserve resumable state.

## Agent isolation

Each profile receives:

- its own system prompt;
- the engagement summary, not raw secrets;
- only MCP tools whose classified capability appears in that profile's allowlist;
- an independent conversation transcript;
- untrusted MCP output inside explicit data delimiters.

The parent runtime receives only the final handoff and evidence identifiers.

## Finding lifecycle

```text
observation -> hypothesis -> candidate finding -> validator -> critic
                                               -> validated/rejected
```

A specialist cannot directly create a confirmed finding. Validator and critic outputs are matched to stored candidates, and the deterministic runtime applies status changes.
