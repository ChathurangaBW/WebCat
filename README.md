# WebCat

WebCat is a **terminal-native AI swarm for authorized web-application security assessment**. It coordinates specialized agents, connects to generic Model Context Protocol (MCP) security tools, enforces engagement scope before external actions, records redacted evidence, validates candidate findings, and generates Markdown and JSON reports.

WebCat is a CLI/TUI product. It does not require a browser dashboard or a separate application server.

## Capabilities

- interactive terminal workspace and headless CLI
- project initialization, diagnostics, session persistence, and resume
- deny-by-default host, scheme, port, path, and operation-risk enforcement
- stdio and streamable HTTP/SSE MCP transports
- built-in and custom MCP capability classification
- output filtering for out-of-scope MCP records
- persistent operator approvals with expiry and revocation
- request-rate and parallelism controls
- configurable chat-completions-compatible model endpoint
- bounded parallel specialist-agent swarm with isolated conversations
- hypotheses, evidence hashing, secret redaction, and hash-chained audit records
- candidate, validator, and critic workflow
- Markdown skill discovery from repository, project, and user directories
- Markdown and JSON reporting

## Architecture

```text
WebCat CLI / TUI
       |
       v
Session + Workflow Runtime
       |
       v
Swarm Orchestrator ---- Skills Catalog
       |        |        |
       v        v        v
Specialists / Validator / Critic
       |
       v
MCP Capability Gateway
classify -> scope -> approval -> rate limit -> execute -> filter
       |
       v
External MCP Servers
       |
       v
Evidence / Hypotheses / Findings / Audit / Reports
```

## Requirements

- Node.js 22 or later
- pnpm 10
- a chat-completions-compatible model endpoint
- optional MCP servers for proxy, browser, scanner, sitemap, or workflow tooling

## Build and test

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm smoke
```

Run directly:

```bash
pnpm build
node apps/webcat/dist/main.js --version
node apps/webcat/dist/main.js tui
```

Install the repository command locally:

```bash
pnpm build
npm link
webcat --version
```

## Initialize an engagement

```bash
webcat init
```

Edit:

- `.webcat/engagement.yaml` — authorization, mode, limits, allow rules, and deny rules
- `.webcat/config.toml` — model, swarm, evidence, and approval policy
- `.webcat/mcp.json` — enabled MCP servers and optional custom capability mappings

Validate the setup:

```bash
webcat doctor
webcat scope-check https://app.example.test/api --operation passive
webcat mcp status
```

## Run the swarm

```bash
webcat run --objective "Map the authorized API and assess object authorization"
```

Resume an interrupted or failed session:

```bash
webcat resume
webcat resume session_abc123
```

## Common commands

```bash
webcat tui
webcat profiles
webcat skills
webcat mcp tools
webcat mcp call proxy proxy_history --args '{}'
webcat approvals grant --risk active --ttl 20m --reason "Controlled authorization validation"
webcat hypotheses list
webcat findings list
webcat evidence list
webcat audit verify
webcat report --format markdown
webcat report --format json
```

## Modes

| Mode | Behavior |
|---|---|
| `observe` | Passive/read-only MCP capabilities only. Active calls are blocked at the gateway. |
| `manual` | Active in-scope calls require one-time or stored operator approval. |
| `authorized-auto` | Active in-scope calls may run automatically. High and destructive calls still require explicit policy and approval. |

## Safety boundary

WebCat is for systems you are explicitly authorized to assess. An external operation must pass capability classification, scope evaluation, engagement policy, approval policy, and rate controls before execution. The model cannot bypass these checks.

See:

- [Architecture](docs/ARCHITECTURE.md)
- [Configuration](docs/CONFIGURATION.md)
- [MCP integration](docs/MCP.md)
- [Operations](docs/OPERATIONS.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Development](docs/DEVELOPMENT.md)
