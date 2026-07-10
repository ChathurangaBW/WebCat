# Current State Analysis

**Date:** 2026-07-10

## Repository State

The current `WebCat` repository is a fresh, nearly-empty Git repository:

- Single initial commit (`039729d6b9768f23958a92d925cf959256506cb3`)
- Contains only a minimal `README.md` with `"# WebCat\n"`
- No existing application code, package manifests, agent definitions, or configuration
- No AWAM/SWAM code present (the prompt references an "uploaded AWAM/SWAM package" but none exists in the workspace)

## Reference Architecture Assessment

### Kimi Code (`04041eb`)

The Kimi Code repository provides a mature, well-structured foundation for a TypeScript-based agent platform. Key components that can be adapted:

| Component | Status | Action |
|---|---|---|
| `packages/agent-core` | Fully featured | Adapt — rename to `@webcat/agent-core`, extend with pentest agents |
| `packages/server` | Fastify + WS | Adapt — add scope enforcement, engagement APIs, audit middleware |
| `packages/protocol` | Zod schemas | Reuse pattern — create `@webcat/protocol` with pentest schemas |
| `packages/node-sdk` | SDK client | Adapt — add WebCat-specific client methods |
| `apps/kimi-web` | Vue 3 + Vite | Rewrite — create `apps/webcat-web` with pentest UI |
| `apps/kimi-code` | CLI entry | Rewrite — create `apps/webcat-cli` with `webcat` command |
| `apps/vis` | Session visualizer | Adapt — create `apps/webcat-visualizer` |
| `packages/kaos` | Config management | Reuse — create `@webcat/storage` |
| `packages/kosong` | LLM abstraction | Reuse — create `@webcat/provider-core` |
| `packages/mcp/*` | MCP connection manager | Extend heavily — create `@webcat/mcp-hub` |
| `plugins/` | Plugin system | Adapt — add pentest plugin types |

### Caido MCP Server (`10c0708`)

The Caido MCP server is a Go-based MCP server. Its patterns should be replicated in TypeScript:

| Component | Action |
|---|---|
| Header redaction | Implement in `@webcat/shared` as a TypeScript redaction service |
| Response fingerprinting | Implement in `@webcat/evidence-core` |
| Response diffing | Implement in `@webcat/evidence-core` |
| Cookie jar | Implement in `@webcat/pentest-core` |
| Request replay with pooling | Implement in `@webcat/pentest-core` |
| Tool registration pattern | Follow in `@webcat/mcp-hub` adapter layer |

## Required New Packages

Packages that do not exist in either reference and must be created:

1. **`@webcat/mcp-hub`** — MCP-agnostic integration hub with capability normalization
2. **`@webcat/scope-engine`** — Central scope enforcement service
3. **`@webcat/pentest-core`** — Pentest-specific agents, workflows, hypotheses
4. **`@webcat/evidence-core`** — Evidence collection, hashing, chain of custody
5. **`@webcat/reporting`** — Report generation (Markdown, HTML, JSON, PDF)
6. **`@webcat/auth`** — Authentication and RBAC
7. **`@webcat/shared`** — Shared types, utilities, redaction

## Key Architectural Decisions

1. **Keep TypeScript/Node.js stack** — Both reference repos use compatible stacks
2. **Keep pnpm workspace + monorepo** — Kimi's monorepo structure works well
3. **Keep Fastify server** — Well-built, extensible
4. **Keep Vue 3 web app** — Good foundation for the pentest UI
5. **Add scope enforcement as middleware** — Critical security boundary
6. **Extend MCP connection manager** — Add trust levels, capability mapping, tool allowlists/blocklists
7. **Add pentest agent swarm** — New agent profiles on top of existing agent infrastructure
8. **Add evidence and reporting packages** — Not present in either reference

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Scope bypass via redirects | Critical | Scope engine middleware on all network operations |
| Prompt injection via MCP output | High | Sanitization, redaction, untrusted data handling |
| Credential leakage in agent context | High | Central redaction service, encrypted evidence store |
| Malicious MCP server | High | Trust levels, tool allowlists, process sandboxing |
| Cross-engagement data leakage | High | Tenant isolation, engagement-scoped storage |
| LLM hallucinated findings | Medium | Evidence gates, reviewer gates, verification requirements |
| Denial of service via fuzzing | Medium | Rate limits, concurrency limits, payload budgets |
