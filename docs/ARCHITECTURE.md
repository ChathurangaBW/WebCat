# Architecture

```text
CLI / TUI
   |
   +-- identity and platform paths
   +-- project and user configuration
   +-- authorization and scope engine
   +-- approvals, logging, evidence, and audit
   +-- specialist swarm runtime
   +-- MCP manager and policy guard
   +-- reports and persistent sessions
```

Product identity is centralized in `src/identity.mjs`. Platform path generation is centralized in `src/paths.mjs`. External actions pass through `McpGuard`; model output cannot call an MCP transport directly.

Agent profiles are isolated by role, purpose, and capability declaration. Findings begin as candidates and must pass independent evidence and critic gates before reporting as validated.
