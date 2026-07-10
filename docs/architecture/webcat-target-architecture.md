# WebCat Target Architecture

**Version:** 0.1.0
**Date:** 2026-07-10

## Overview

WebCat is a local-first, AI-assisted web-application penetration-testing platform. It combines an agent runtime based on Kimi Code's architecture with pentest-specific workflows, a scope enforcement engine, an MCP-agnostic integration hub, and evidence-based reporting.

## Monorepo Structure

```
webcat/
├── apps/
│   ├── webcat-cli/           # CLI entry point (`webcat` command)
│   ├── webcat-web/           # Vue 3 + Vite web application
│   ├── webcat-desktop/       # Electron desktop (post-web stability)
│   └── webcat-visualizer/    # Session, evidence, and agent-run visualizer
├── packages/
│   ├── agent-core/           # Agent engine (adapted from @moonshot-ai/agent-core)
│   ├── server/               # Fastify REST + WebSocket server
│   ├── protocol/             # Shared wire schemas (Zod)
│   ├── node-sdk/             # Node.js SDK
│   ├── provider-core/        # LLM provider abstraction
│   ├── mcp-hub/              # MCP-agnostic integration hub
│   ├── scope-engine/         # Central scope enforcement
│   ├── pentest-core/         # Pentest agents, workflows, hypotheses
│   ├── evidence-core/        # Evidence collection and management
│   ├── reporting/            # Report generation
│   ├── execution-runtime/    # Sandboxed process and tool execution
│   ├── auth/                 # Authentication and RBAC
│   ├── storage/              # Configuration and state persistence
│   └── shared/               # Shared types, utilities, redaction
├── docs/
├── tests/
└── .webcat/                  # Project-local WebCat state
    ├── config.json
    ├── mcp.json
    ├── skills/
    ├── engagements/
    ├── runs/
    ├── evidence/
    └── reports/
```

## Package Dependencies

```
webcat-cli
  ├── server
  ├── protocol
  └── node-sdk

webcat-web
  ├── protocol
  └── node-sdk (via REST/WS)

server
  ├── agent-core
  ├── protocol
  ├── auth
  ├── scope-engine
  └── mcp-hub

agent-core
  ├── protocol
  ├── provider-core
  ├── mcp-hub
  ├── pentest-core
  ├── evidence-core
  ├── execution-runtime
  ├── storage
  └── shared

mcp-hub
  ├── protocol
  ├── scope-engine
  └── shared

scope-engine
  ├── protocol
  └── shared
```

## Component Architecture

### 1. Agent Core (`packages/agent-core`)

Adapted from Kimi Code's agent-core. Key extensions:
- Pentest agent profiles (Engagement Manager, Passive Recon, Traffic Analyst, etc.)
- Scope-aware tool execution
- Evidence association with agent actions
- Hypothesis tracking and validation workflow
- Finding creation and deduplication

### 2. Server (`packages/server`)

Fastify-based, adapted from Kimi Code's server. Key additions:
- `/api/v1/engagements` — CRUD for pentest engagements
- `/api/v1/scope` — Scope rule management
- `/api/v1/findings` — Finding CRUD and deduplication
- `/api/v1/evidence` — Evidence artifact management
- `/api/v1/reports` — Report generation and export
- `/api/v1/mcp` — MCP connection management
- Scope enforcement middleware on all network-affecting endpoints
- Audit logging middleware

### 3. MCP Hub (`packages/mcp-hub`)

Central MCP integration layer:
- Connection manager (stdio, Streamable HTTP, HTTP+SSE)
- OAuth and token-reference support
- Tool discovery with schema validation
- Capability normalization (proxy.*, browser.*, http.*)
- Trust levels (untrusted, reviewed, trusted, system)
- Tool allowlist/blocklist
- Adapter system for vendor-specific mappings
- Generic MCP tool passthrough for unknown tools

### 4. Scope Engine (`packages/scope-engine`)

Mandatory security boundary:
- Scope rule model (hosts, domains, URLs, CIDRs, ports, protocols)
- Canonicalization and DNS resolution
- Allow/deny/requires_approval decisions
- Redirect and DNS rebinding protection
- Private network protection
- Rate and concurrency enforcement
- Enforcement middleware for HTTP, WebSocket, MCP tools

### 5. Pentest Core (`packages/pentest-core`)

Pentest-specific logic:
- Engagement lifecycle (intake → discovery → validation → reporting)
- Agent profiles (19 pentest agents)
- Hypothesis generation (OWASP WSTG, Top 10, API Top 10, CWE)
- Validation escalation levels (L0-L4)
- Attack surface modeling
- Finding workflow (create, validate, deduplicate, review, report)

### 6. Evidence Core (`packages/evidence-core`)

Evidence management:
- Content hashing (SHA-256)
- MIME type detection
- Redaction state tracking
- Chain of custody
- Encrypted evidence store
- Large-body offset retrieval
- Evidence-to-finding linking
- Export with provenance

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js >= 24.15.0 |
| Package Manager | pnpm >= 10.33.0 |
| Language | TypeScript 6.0.2 (strict) |
| Monorepo | pnpm workspaces |
| Build | tsdown, Vite |
| Server | Fastify 5.x |
| Web Framework | Vue 3.5 + Composition API |
| Web Build | Vite 6.x |
| WebSocket | ws 8.x |
| Schema Validation | Zod 4.x |
| LLM Abstraction | Adapted from kosong |
| MCP SDK | @modelcontextprotocol/sdk 1.x |
| Testing | Vitest 4.x |
| Linting | oxlint |
| Changesets | @changesets/cli |

## Configuration Locations

| Scope | Path |
|---|---|
| User global | `~/.webcat/` |
| Project | `.webcat/` |
| Environment | `WEBCAT_*` |
| Legacy compat | `~/.kimi-code/`, `.swarm`, `KIMI_CODE_*` |
