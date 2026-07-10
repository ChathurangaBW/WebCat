# Changelog

## [0.1.0] — 2026-07-10

### Added
- Initial WebCat foundation and rebrand from Kimi Code architecture
- `@webcat/shared` — Core types (engagement, finding, audit, approval), redaction service, ULID generator, error types
- `@webcat/scope-engine` — Central scope enforcement with allow/deny rules, CIDR support, private network protection, DNS rebinding detection
- `@webcat/mcp-hub` — MCP-agnostic integration hub with Caido, Burp Suite, OWASP ZAP, Browser, and Generic HTTP adapters
- `@webcat/protocol` — REST and WebSocket wire schemas, API route definitions
- `@webcat/server` — Fastify-based server with REST API and WebSocket support
- `@webcat/cli` — CLI entry point (`webcat` command)
- `@webcat/web` — Vue 3 web application with Dashboard, Engagements, MCP Connections, Findings, Approvals, and Settings views
- WebCat logo (cat + shield motif, SVG)
- Documentation: upstream sources, current-state analysis, target architecture, migration maps, capability model, threat model, brand guidelines

### Test Coverage
- 35 tests passing across shared, mcp-hub, and server packages
- Redaction service tests (15)
- MCP hub tests (11) — Caido, Burp, capability mapping, trust levels, risk classification
- Server API tests (9) — health, engagements, findings, approvals, audit, reports, CORS
