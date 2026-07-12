# WebCat Architecture

```text
WebCat CLI / Terminal Workspace
            |
            v
Session + Workflow Runtime
            |
            v
Swarm Orchestrator ---- Skills Catalog
      |        |        |
      v        v        v
Specialist Agents / Validator / Critic
            |
            v
MCP Capability Gateway
  discovery -> classification -> scope -> approval -> rate limit -> execution
            |
            v
External MCP Servers
            |
            v
Evidence / Hypotheses / Findings / Audit / Reports
```

## Packages

- `@webcat/core` — configuration, scope, workflow, state, approvals, evidence, findings, skills, reporting
- `@webcat/mcp-gateway` — MCP transports, clients, discovery, capability mapping, execution guard
- `@webcat/agent-profiles` — native WebCat specialist profiles
- `@webcat/agent-runtime` — model client, agent loop, bounded scheduler, validation pipeline
- `@webcat/cli` — commands and terminal workspace

## Enforcement path

Every external tool call follows the same path:

1. resolve the MCP tool to a WebCat capability;
2. classify risk as read, active, high, or destructive;
3. extract and normalize target URLs;
4. evaluate every target against allow and deny rules;
5. enforce authorization and engagement risk settings;
6. resolve operator approval requirements;
7. acquire request-rate and concurrency limits;
8. execute through the MCP transport;
9. redact and persist evidence and audit records.

Core enforcement is implemented in the gateway execution path. It does not depend on prompts or optional hooks.
