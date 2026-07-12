# Development

## Commands

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm smoke
pnpm dev
```

## Repository layout

```text
apps/webcat/                 CLI and terminal workspace
packages/core/               engagement domain and persistence
packages/mcp-gateway/        MCP transports and execution guard
packages/agent-profiles/     specialist profiles
packages/agent-runtime/      model loop and swarm scheduler
skills/                      methodology skills
scripts/                     cross-platform maintenance and smoke tests
```

## Test layers

- unit tests for scope, redaction, capability mapping, guard decisions, and audit integrity;
- stdio MCP integration test using a local JSON-RPC process;
- chat-completions integration test using a local HTTP server;
- full swarm integration test covering candidate creation, independent validation, session completion, and report generation;
- CLI smoke test covering initialization, diagnostics, and scope evaluation.

## Adding an MCP adapter

Prefer adding an exact tool-name mapping in `packages/mcp-gateway/src/capabilities.ts` when the tool semantics are stable and broadly useful. Use a project `capabilities` mapping for vendor- or deployment-specific tools.

## Adding an agent profile

Add a profile in `packages/agent-profiles/src/index.ts` with a focused purpose, methodology prompt, stable capability names, and the correct active-tool flag. Update selection logic in the swarm only when the profile should be triggered automatically.
