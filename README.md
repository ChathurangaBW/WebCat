# WebCat

WebCat is a terminal-native AI swarm runtime for **authorized web application security assessment**.

It coordinates isolated security-specialist agents, connects to external security tooling through the Model Context Protocol (MCP), enforces engagement authorization and scope before tool execution, stores redacted evidence, validates candidate findings, and produces Markdown or JSON reports.

WebCat does **not** include a browser dashboard, an exploit library, an autonomous internet scanner, or a bundled interception proxy. Network activity is performed only through MCP servers that you configure.

## Project status

WebCat 1.1 is an early, functional CLI/TUI release intended for controlled testing and further development.

Implemented areas include:

- CLI and interactive terminal interface
- engagement initialization and diagnostics
- explicit authorization-window validation
- allow and deny scope rules with deny precedence
- observe, manual, and authorized-auto operating modes
- expiring operator approvals
- generic MCP support over stdio and HTTP/SSE
- MCP tool discovery, allowlists, denylists, timeouts, and environment interpolation
- conservative MCP capability and risk classification
- bounded parallel specialist-agent execution
- hypotheses, candidate findings, validator review, and critic review
- secret-redacted evidence with integrity hashes
- serialized hash-chained audit records
- resumable sessions
- Markdown and JSON reports
- Linux, macOS, and Windows runtime-path handling
- release, relocation, branding, logging, MCP, and scope regression tests

This project is not a replacement for an experienced penetration tester. Operators must review scope, requests, evidence, and findings.

## Safety and authorization

Use WebCat only against systems for which you have explicit permission to test.

Before any external operation is executed, WebCat evaluates:

1. the engagement authorization window;
2. explicit deny rules;
3. explicit allow rules;
4. the requested operation risk;
5. the selected engagement mode;
6. high-risk and destructive-operation policy;
7. operator approval requirements;
8. rate and parallelism limits.

Active MCP tools must have a trusted explicit capability mapping and an extractable absolute target URL. Out-of-scope requests are blocked before transport execution.

## Requirements

- Node.js 22 or later
- npm 10 or later
- Optional: an OpenAI-compatible chat-completions endpoint
- Optional: one or more MCP servers for proxy, browser, scanner, replay, sitemap, or workflow operations

The application has no runtime npm dependencies.

## Installation from source

```bash
git clone https://github.com/ChathurangaBW/WebCat.git
cd WebCat
npm install
npm run qa
npm link
```

Verify the installed command:

```bash
webcat --version
webcat --help
```

You can also run WebCat without linking it globally:

```bash
node bin/webcat.mjs --help
```

For reproducible CI installation, use `npm ci` instead of `npm install`.

## Quick start without a model or MCP server

The generated configuration uses the deterministic `mock` model provider, so the basic workflow can be tested without API credentials or external tools.

```bash
mkdir authorized-assessment
cd authorized-assessment
webcat init
webcat doctor
webcat paths
```

Edit the generated engagement file before running a real assessment:

```text
.webcat/engagement.json
```

The generated file contains placeholder authorization values and cannot authorize external operations until they are replaced with valid engagement information.

Run a local mock session:

```bash
webcat run --objective "Review the configured authorized scope and produce a test assessment summary"
webcat sessions list
webcat audit verify
webcat evidence verify
webcat report --format markdown
```

## Project configuration

`webcat init` creates:

```text
.webcat/
├── config.toml
├── engagement.json
└── mcp.json
```

### `config.toml`

Controls the model provider, swarm limits, logging, and evidence limits.

Default development configuration:

```toml
[model]
provider = "mock"
baseUrl = "http://127.0.0.1:11434/v1"
apiKeyEnv = "WEBCAT_MODEL_API_KEY"
model = "webcat-local"
timeoutMs = 120000

[swarm]
maxConcurrency = 3
maxAgentTurns = 6
maxToolCallsPerAgent = 8

[logging]
level = "info"

[evidence]
maxBodyBytes = 262144
```

To use an OpenAI-compatible service, set the configured provider and endpoint, then export the environment variable named by `apiKeyEnv` when the endpoint requires authentication.

Never commit credentials to `config.toml` or `mcp.json`.

### `engagement.json`

Defines:

- engagement ID and name
- authorizer and authorization reference
- authorization start and expiry times
- operating mode
- allow and deny scope rules
- passive, active, high, and destructive operation permissions
- request and concurrency limits
- high-risk and destructive-action policy

Check a URL before using it in an operation:

```bash
webcat scope-check https://app.example.test/api --operation passive
webcat scope-check https://app.example.test/api --operation active --json
```

### `mcp.json`

Defines MCP servers and tool policy.

Supported transports:

- stdio JSON-RPC
- streamable HTTP JSON-RPC
- SSE-formatted HTTP responses

Supported controls include:

- disabled servers
- enabled-tool allowlists
- disabled-tool denylists
- per-server timeouts
- environment-variable interpolation
- header interpolation
- explicit capability mappings

Inspect configured MCP servers:

```bash
webcat mcp status
webcat mcp tools
webcat mcp tools caido
```

Call a configured tool:

```bash
webcat mcp call caido list_requests --args '{}'
```

Example active call requiring a target and applicable approval:

```bash
webcat mcp call caido send_request \
  --args '{"url":"https://app.example.test/api/profile"}' \
  --approve
```

The exact MCP tool names depend on the connected server.

## Operating modes

| Mode | Behaviour |
|---|---|
| `observe` | Permits passive/read-only operations only. |
| `manual` | Active operations require an applicable operator approval. |
| `authorized-auto` | In-scope active operations may execute automatically; high-risk and destructive operations remain separately controlled. |

Grant a temporary approval:

```bash
webcat approvals grant \
  --risk active \
  --ttl 20 \
  --reason "Controlled authorization validation"
```

List or revoke approvals:

```bash
webcat approvals list
webcat approvals revoke <approval-id>
```

## Main commands

```text
webcat init [--force]
webcat doctor [--json]
webcat paths [--json]
webcat scope-check <url> [--operation passive|active|high|destructive] [--json]
webcat profiles [--json]
webcat mcp status|tools [server] [--json]
webcat mcp call <server> <tool> --args '<json>' [--approve]
webcat approvals list|grant|revoke
webcat run --objective "Authorized assessment objective" [--json]
webcat resume [session-id] [--json]
webcat sessions list|show [session-id]
webcat findings list|show [finding-id]
webcat hypotheses list|show [hypothesis-id]
webcat evidence list|verify
webcat audit list|verify
webcat report [session-id] [--format markdown|json]
webcat tui
```

Run `webcat --help` for the current command surface.

## Agent workflow

A session follows a gated workflow:

```text
authorization and scope validation
        ↓
MCP discovery
        ↓
parallel specialist analysis
        ↓
hypotheses and candidate findings
        ↓
independent validation
        ↓
security critic review
        ↓
evidence, audit, and reporting
```

Candidate findings are not treated as validated findings until they pass the validator and critic stages.

## Evidence, audit, and reports

Project runtime records are stored under `.webcat` and are excluded from version control.

WebCat provides:

- secret and credential redaction before persistence
- SHA-256 evidence integrity verification
- serialized hash-chained audit entries
- session-scoped hypotheses and findings
- Markdown and JSON reports

Useful commands:

```bash
webcat evidence list
webcat evidence verify
webcat audit list
webcat audit verify
webcat findings list
webcat hypotheses list
webcat report --format markdown
webcat report --format json
```

## User runtime paths

WebCat does not depend on the parent directory name of the repository.

Default user paths are platform-specific:

- Linux: XDG configuration, state, cache, and data directories under `webcat`
- macOS: `~/Library/Application Support/WebCat`, `~/Library/Caches/WebCat`, and `~/Library/Logs/WebCat`
- Windows: `%APPDATA%\WebCat` and `%LOCALAPPDATA%\WebCat`

Overrides:

- `WEBCAT_HOME`
- `WEBCAT_CONFIG_HOME`
- `WEBCAT_LOG_LEVEL`
- `WEBCAT_LOG_FILE`
- `WEBCAT_DISABLE_UPDATE_CHECK`

The default log file is `webcat.log`. Authorization headers, cookies, token-like fields, passwords, and configured secrets are redacted before logging.

Display the paths selected for the current environment:

```bash
webcat paths
```

## Development and QA

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
npm run test:relocation
npm run verify:branding
npm run verify:built
npm run qa
npm pack --dry-run
```

`npm run qa` executes the normal release gate, including unit tests, production build, integration smoke tests, relocation/global-install regression tests, repository branding verification, and built-output verification.

GitHub Actions runs the same QA gate for pull requests and pushes to `main`.

## Repository layout

```text
WebCat/
├── .github/workflows/     CI
├── .webcat/               configuration examples
├── bin/                   executable entry point
├── docs/                  architecture and operator documentation
├── scripts/               build, QA, smoke, and verification scripts
├── src/                   runtime modules
├── test/                  unit and regression tests
├── package.json
└── README.md
```

## Current limitations

- MCP compatibility can vary between server implementations.
- Active MCP tools require explicit trusted capability mappings.
- The built-in model integration expects an OpenAI-compatible chat-completions interface.
- The TUI is a command-oriented terminal loop, not a full-screen graphical terminal application.
- Findings produced by an AI model require human verification.
- WebCat does not establish legal authorization; the operator is responsible for obtaining and correctly configuring it.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Configuration](docs/CONFIGURATION.md)
- [MCP integration](docs/MCP.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Release QA](docs/RELEASE_QA.md)
- [Security policy](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

WebCat is released under the MIT License. See [LICENSE](LICENSE).