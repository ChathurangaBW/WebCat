# Upstream Source References

## Kimi Code (Primary Architecture Reference)

- **Repository URL:** https://github.com/MoonshotAI/kimi-code
- **Default Branch:** main
- **Reviewed Commit SHA:** `04041eb998b6798898fa5df97f7587b3aa119b27`
- **Commit Message:** `fix(web): hide injected system asides in user message bubbles (#1535)`
- **Retrieval Date:** 2026-07-10
- **License:** MIT (Copyright 2026 Moonshot AI)

### Package Structure

```
kimi-code/
├── apps/
│   ├── kimi-code/          # CLI entry point (Commander, TUI, server subcommand)
│   ├── kimi-desktop/       # Electron desktop application
│   ├── kimi-web/           # Vue 3 + Vite web application
│   └── vis/                # Session/agent-run visualizer
├── packages/
│   ├── agent-core/         # Central agent engine (session, tools, MCP, skills, loop)
│   ├── server/             # Fastify REST + WebSocket server
│   ├── protocol/           # Shared wire schemas (Zod)
│   ├── node-sdk/           # Node.js SDK for programmatic usage
│   ├── acp-adapter/        # Agent Communication Protocol adapter
│   ├── kaos/               # Configuration/state management layer
│   ├── kosong/             # LLM provider abstraction layer
│   ├── migration-legacy/   # Migration from legacy configurations
│   ├── oauth/              # OAuth integration support
│   ├── pi-tui/             # Terminal UI components
│   ├── server-e2e/         # End-to-end server tests
│   └── telemetry/          # Telemetry/analytics
└── plugins/                # Extensible plugin system
```

### Key Architectural Patterns

1. **Agent Core** (`packages/agent-core`):
   - Session-based agent orchestration with `Session` class
   - `Agent` class with goal-mode, plan-mode, and swarm-mode
   - MCP connection manager supporting stdio, HTTP, and SSE transports
   - Tool manager with built-in tools and MCP-discovered tools
   - Skill system with YAML front-matter, scanning, and registry
   - Permission manager with allow/deny/ask rules
   - Compaction strategies (full, micro, handoff)
   - Hook engine for lifecycle events
   - Subagent host for parallel agent lanes
   - Provider manager for model abstraction

2. **Server** (`packages/server`):
   - Fastify-based HTTP server
   - REST routes: sessions, messages, approvals, questions, config, files, MCP, OAuth
   - WebSocket gateway for live events
   - Authentication middleware
   - Rate limiting
   - OpenAPI documentation
   - Request ID tracking

3. **Protocol** (`packages/protocol`):
   - Zod-based schemas for all wire contracts
   - Envelope types, error codes, pagination

4. **Web App** (`apps/kimi-web`):
   - Vue 3 with Composition API
   - Vite build system
   - Internationalization (vue-i18n)
   - Chat interface with Markdown rendering
   - Settings management

## Caido MCP Server (Proxy Integration Reference)

- **Repository URL:** https://github.com/c0tton-fluff/caido-mcp-server
- **Default Branch:** main
- **Reviewed Commit SHA:** `10c07084a6398703e38caf28bdc4575aaa9aa76f`
- **Commit Message:** `chore: remove .aider.conf.yml (aider no longer in use)`
- **Retrieval Date:** 2026-07-10
- **License:** MIT (Copyright 2026 c0tton-fluff)

### Package Structure

```
caido-mcp-server/
├── cmd/                    # CLI entry points
├── internal/
│   ├── auth/               # OAuth and token store
│   ├── httputil/           # HTTP utilities: body conversion, CRLF, diff, fingerprint, parse, redact, URL
│   ├── raceattack/         # Race-condition attack utilities
│   ├── replay/             # Request replay with cookie jars and connection pooling
│   ├── resources/          # MCP resources: findings, projects, replay sessions, requests, scopes, sitemap
│   └── tools/              # MCP tools: proxy history, replay, findings, scopes, projects, workflows, intercept
├── docs/
└── scripts/
```

### Key Patterns to Replicate

1. **Header Redaction** (`internal/httputil/redact.go`):
   - Redacts sensitive header values (Authorization, Cookie, Set-Cookie, etc.)
   - Preserves non-sensitive headers byte-for-byte
   - Honors opt-out mechanism for authorized replay

2. **Response Fingerprinting** (`internal/httputil/fingerprint.go`):
   - Content-type-aware classification (JSON, HTML, XML, text, binary)
   - Extracts title, redirect target, status code, cookies
   - Lightweight deduplication signal

3. **Response Diffing** (`internal/httputil/diff.go`):
   - Compact diffs for comparing similar responses
   - Avoids sending full response bodies to the LLM

4. **Cookie Jar** (`internal/replay/cookiejar.go`):
   - Per-session cookie management
   - Cookie metadata without exposing values

5. **Request Replay** (`internal/replay/replay.go`):
   - Connection pooling with configurable limits
   - Timeout and retry controls

6. **Tool Registration** (`internal/tools/register.go`):
   - Centralized registry of all MCP tools
   - Covers proxy history, replay, automate, findings, scopes, projects, workflows
