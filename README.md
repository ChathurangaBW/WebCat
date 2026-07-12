# WebCat

WebCat is a terminal-native AI swarm for **authorized web application security assessment**. It coordinates isolated specialist agents, connects to generic Model Context Protocol (MCP) security tools, enforces engagement scope before external actions, records redacted evidence, independently validates candidate findings, and generates Markdown or JSON reports.

WebCat has no browser dashboard and does not contain a built-in exploit library. All external actions flow through configured MCP servers and a deterministic policy gateway.

## Current release

This repository contains the WebCat 1.0 implementation:

- CLI and interactive TUI
- explicit authorization window and deny-by-default scope engine
- observe, manual, and authorized-auto modes
- expiring, capability-scoped approvals
- stdio and streamable HTTP/SSE MCP JSON-RPC clients
- generic MCP tool discovery and capability classification
- Caido and Burp starter configurations
- output filtering for out-of-scope records
- rate and parallelism controls
- OpenAI-compatible model provider and deterministic mock provider
- bounded parallel specialist-agent swarm with isolated conversations
- hypotheses, redacted evidence, SHA-256 integrity, and hash-chained audit
- validator and critic gates before findings are promoted
- resumable sessions and Markdown/JSON reporting
- unit tests, smoke tests, and GitHub Actions CI

## Safety boundary

WebCat is for systems you are explicitly authorized to assess. It does not infer authorization from a URL, a model response, proxy history, or an MCP tool.

An external operation must pass:

1. capability classification;
2. authorization-window validation;
3. deny rules;
4. allow rules;
5. engagement-mode policy;
6. high/destructive risk policy;
7. operator approval policy;
8. request-rate and parallelism limits;
9. evidence redaction and audit recording.

The model cannot bypass those checks. Active operations without a concrete target are blocked.

## Requirements

- Node.js 22 or later
- npm 10 or later
- an OpenAI-compatible chat-completions endpoint, or the built-in mock provider
- optional MCP servers such as Caido, Burp, browser tooling, scanners, or custom security adapters

## Install and test

WebCat ships as a dependency-free Node.js source distribution.

```bash
npm install
npm test
npm run smoke
```

Run directly:

```bash
node bin/webcat.mjs --version
node bin/webcat.mjs tui
```

Install the command locally:

```bash
npm link
webcat --version
```

## Initialize an engagement

```bash
webcat init
```

Edit the generated files:

- `.webcat/engagement.json` — written authorization, mode, rate limits, allow rules, and deny rules
- `.webcat/config.json` — model, swarm, and evidence policy
- `.webcat/mcp.json` — enabled MCP servers and custom capability mappings

The generated engagement is intentionally non-operational until placeholder authorization values and target scope are replaced.

Validate the setup:

```bash
webcat doctor
webcat scope-check https://app.example.test/api/users --operation passive
webcat mcp status
```

## Run the swarm

```bash
webcat run --objective "Map the authorized API and assess object authorization"
```

Resume:

```bash
webcat resume
webcat resume session_abc123
```

Generate reports:

```bash
webcat report --format markdown --output .webcat/reports/report.md
webcat report --format json --output .webcat/reports/report.json
```

## Common commands

```text
webcat init [--force]
webcat doctor [--json]
webcat scope-check <url> --operation passive|active|high|destructive
webcat profiles [--json]
webcat skills [--json]
webcat mcp status [--connect] [--json]
webcat mcp tools [--json]
webcat mcp call <server> <tool> --args '{...}'
webcat approvals grant --risk active --ttl 20m --reason "Controlled validation"
webcat approvals list
webcat approvals revoke <id>
webcat run --objective "..."
webcat resume [session-id]
webcat hypotheses [--json]
webcat findings [--json]
webcat evidence verify
webcat audit verify
webcat report --format markdown|json
webcat tui
```

## Engagement modes

| Mode | Behavior |
|---|---|
| `observe` | Passive/read-only capabilities only. Active, high, and destructive calls are blocked. |
| `manual` | Non-passive in-scope calls require an active operator approval. |
| `authorized-auto` | Active in-scope calls may run automatically. High and destructive calls still require policy enablement and approval. |

## Architecture

```text
CLI / TUI
   |
   v
Session state machine
   |
   v
Bounded swarm orchestrator ---- Markdown skill catalog
   |                              |
   v                              v
Isolated specialists -> validator -> critic -> report
   |
   v
MCP capability gateway
classify -> scope -> approval -> rate limit -> execute -> filter
   |
   v
Generic stdio / HTTP / SSE MCP servers
   |
   v
Redacted evidence + hypotheses + findings + hash-chained audit
```

See:

- [Architecture](docs/ARCHITECTURE.md)
- [Configuration](docs/CONFIGURATION.md)
- [MCP integration](docs/MCP.md)
- [Operations](docs/OPERATIONS.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Development](docs/DEVELOPMENT.md)
