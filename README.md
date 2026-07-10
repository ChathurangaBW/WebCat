# 🐱 WebCat

**Local-first, AI-assisted web-application penetration-testing platform.**

WebCat combines an AI agent runtime with MCP-agnostic proxy integrations, a mandatory scope-enforcement engine, and evidence-based reporting. It helps security professionals conduct thorough, authorized penetration tests with AI assistance while maintaining strict security boundaries.

## Features

- **🤖 Agent Swarm** — Specialized AI agents for reconnaissance, analysis, validation, and reporting
- **🔌 MCP-Agnostic Hub** — Connect any MCP-compatible proxy (Caido, Burp Suite, OWASP ZAP, browser automation, custom)
- **🛡️ Scope Engine** — Mandatory security boundary enforcing allowed targets, blocking private networks, preventing DNS rebinding
- **📊 Evidence System** — Chain-of-custody tracking, SHA-256 hashing, redacted and encrypted evidence storage
- **🔍 Finding Management** — Structured findings with CWE/OWASP mapping, deduplication, severity scoring
- **📝 Report Generation** — Markdown, HTML, and JSON export with evidence references
- **🌐 Web Interface** — Vue 3 dashboard for engagements, traffic, findings, approvals, and settings
- **🔒 Security by Default** — Secret redaction, immutable audit logs, RBAC, trust levels

## Quick Start

```bash
# Install
git clone https://github.com/ChathurangaBW/WebCat.git
cd WebCat
pnpm install

# Start the server
pnpm dev:server

# In another terminal, start the web UI
pnpm dev:web

# Open http://localhost:5173
```

## Commands

```bash
webcat                    # Start full WebCat platform
webcat server run         # Start server only
webcat server run --port 8080
webcat --help
```

## Configuration

| Scope | Path |
|---|---|
| User global | `~/.webcat/config.json` |
| User MCP | `~/.webcat/mcp.json` |
| Project | `.webcat/config.json` |
| Environment | `WEBCAT_*` variables |

## Architecture

```
apps/
  webcat-cli/          CLI entry (webcat command)
  webcat-web/          Vue 3 browser application
packages/
  shared/              Core types, redaction, errors
  protocol/            REST + WebSocket schemas
  scope-engine/        Central scope enforcement
  mcp-hub/             MCP integration hub
  server/              Fastify REST + WebSocket server
  agent-core/          Agent runtime engine
```

## Upstream Attribution

WebCat builds on architecture patterns from:

- **Kimi Code** by Moonshot AI — Agent runtime, server, and protocol architecture (MIT)
- **Caido MCP Server** by c0tton-fluff — Proxy integration patterns (MIT)

See [NOTICE.md](NOTICE.md) for details. WebCat is not affiliated with these projects.

## License

MIT — See [LICENSE](LICENSE)

## Security

WebCat is designed for **authorized testing only**. Every engagement requires explicit authorization affirmation and scope definition. See [SECURITY.md](SECURITY.md).
