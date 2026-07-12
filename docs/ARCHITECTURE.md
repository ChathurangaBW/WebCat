# WebCat architecture

```text
WebCat CLI/TUI
  -> Kimi session runtime
  -> WebCat orchestrator profile
  -> native Agent / AgentSwarm specialists
  -> MCP capability gateway
  -> scope + permission + approval enforcement
  -> Caido / Burp / ZAP / browser / custom MCP
  -> evidence pipeline
  -> validator and critic gates
  -> validated findings
  -> terminal and file reports
```

## Architectural rules

1. WebCat remains terminal-first. No browser dashboard or required REST server.
2. Agent profiles must use Kimi's native profile-contribution system.
3. Parallel work must use Kimi's native Agent and AgentSwarm lifecycle.
4. MCP servers remain external processes or endpoints; WebCat provides protocol integration and policy enforcement.
5. Scope enforcement must execute inside the MCP invocation path. Fail-open hooks are not a sufficient security boundary.
6. Vendor-specific MCP tools are normalized to stable WebCat capabilities.
7. A specialist produces candidates; a validator and critic control publication.
8. State, evidence, audit events, hypotheses, and findings remain resumable under `.webcat/`.

## Intended package placement after upstream import

The final implementation should move these domains into the checked-out Kimi monorepo rather than maintain a parallel agent runtime:

- product identity and CLI: `apps/kimi-code` renamed/rebranded to WebCat
- profiles: `packages/agent-core-v2/src/agent/webcat/profiles`
- engagement and scope services: `packages/agent-core-v2/src/webcat`
- MCP policy gateway: adjacent to the existing MCP client execution path
- skills: project, plugin, or built-in WebCat skills using Kimi's native loader
