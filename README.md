# WebCat

WebCat is a **CLI/TUI-first AI swarm for authorized web-application penetration testing**. It is designed as a native extension path for the Kimi Code agent architecture, with generic Model Context Protocol (MCP) integration for Caido, Burp Suite, ZAP, browser tooling, and custom security tools.

## Current foundation

- TypeScript and Node.js monorepo
- `webcat` CLI entry point
- explicit engagement authorization and target scope
- deny-by-default scope evaluation
- MCP capability abstraction and risk classification
- native specialist-agent profile catalog
- evidence-first validation workflow
- no browser dashboard or standalone REST platform

## Repository layout

```text
apps/webcat/                 CLI/TUI application
packages/core/               engagement, scope, workflow, evidence types
packages/mcp-gateway/        MCP capability and policy gateway
packages/agent-profiles/     native WebCat specialist profiles
skills/                      reusable swarm procedures
docs/architecture.md         architecture and execution flow
```

## Development

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm dev -- --help
```

## Intended runtime flow

```text
webcat CLI/TUI
  -> engagement authorization
  -> scope validation
  -> MCP server discovery
  -> passive mapping
  -> specialist-agent dispatch
  -> scoped tool execution
  -> evidence collection
  -> independent validation
  -> reporting
```

## Safety model

WebCat is for systems you own or are explicitly authorized to test. Active MCP calls are denied when authorization or scope is absent. Redirects and derived targets must be re-evaluated before execution.

## Upstream

The implementation direction is based on the MIT-licensed MoonshotAI Kimi Code architecture. External MCP servers remain separate processes and retain their own licenses. WebCat is not affiliated with or endorsed by Moonshot AI, Caido, PortSwigger, or OWASP.
