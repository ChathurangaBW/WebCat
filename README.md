# WebCat

WebCat is a terminal-native AI swarm runtime for **authorized web application security assessment**.

It coordinates isolated specialist profiles, connects to external security tooling through the Model Context Protocol (MCP), enforces authorization and scope before tool execution, stores redacted evidence, validates candidate findings, and produces Markdown or JSON reports.

WebCat does not bundle an interception proxy, exploit library, browser dashboard, or autonomous internet scanner. Network operations are performed only through MCP servers that the operator configures.

## Project status

WebCat 1.1 is an early functional CLI/TUI release for controlled testing and continued development.

Implemented capabilities include:

- explicit authorization-window and deny-first scope enforcement;
- observe, manual, and authorized-auto modes;
- expiring operator approvals and rate/concurrency limits;
- generic MCP over stdio, streamable HTTP, and legacy SSE;
- native Burp MCP presets and adapters for three server families;
- Caido and custom MCP configuration;
- bounded model-driven MCP tool calls through the policy gateway;
- specialist workflows for passive analysis, authentication, access control, server-side behavior, APIs, business logic, validation, and reporting;
- redacted evidence with SHA-256 integrity;
- serialized hash-chained audit records;
- resumable sessions, hypotheses, candidate findings, validator/critic gates, and reports;
- Linux, macOS, and Windows runtime paths;
- release, relocation, branding, logging, MCP, scope, and Burp regression tests.

This project is not a replacement for an experienced penetration tester. Operators must review scope, requests, evidence, and findings.

## Safety boundary

Use WebCat only against systems for which you have explicit permission to test.

Before an external operation executes, WebCat checks:

1. the written authorization window;
2. explicit deny rules;
3. explicit allow rules;
4. the operation risk;
5. engagement mode;
6. high-risk and destructive-operation policy;
7. operator approval requirements;
8. request-rate and parallel limits.

Active MCP tools require a trusted capability mapping and an extractable in-scope target. Multi-target calls are rejected when any target is outside scope. A model cannot approve its own operation, change scope, enable a disabled tool, or bypass a policy rejection.

## Requirements

- Node.js 22 or later
- npm 10 or later
- Optional: an OpenAI-compatible chat-completions endpoint
- Optional: one or more MCP servers such as Burp Suite, Caido, browser tooling, or a custom security adapter

The application has no runtime npm dependencies.

## Install from source

```bash
git clone https://github.com/ChathurangaBW/WebCat.git
cd WebCat
npm install
npm run qa
npm link
```

Verify the command:

```bash
webcat --version
webcat --help
```

Run without global linking:

```bash
node bin/webcat.mjs --help
```

Use `npm ci` for reproducible CI installation.

## Quick start

Create an engagement workspace:

```bash
mkdir authorized-assessment
cd authorized-assessment
webcat init
webcat doctor
webcat paths
```

`webcat init` creates:

```text
.webcat/
├── config.toml
├── engagement.json
└── mcp.json
```

The generated model provider is `mock`, so a local workflow can run without credentials. The generated engagement contains authorization placeholders and must be edited before any real external operation.

```bash
webcat run --objective "Review the configured authorized scope and produce a test assessment summary"
webcat sessions list
webcat audit verify
webcat evidence verify
webcat report --format markdown
```

## Configuration

### `.webcat/config.toml`

Controls the model provider, swarm limits, logging, and evidence size.

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

To use an OpenAI-compatible service, set `provider = "openai-compatible"`, configure the endpoint/model, and export the environment variable named by `apiKeyEnv` when authentication is required.

Never commit credentials to WebCat configuration.

### `.webcat/engagement.json`

Defines engagement identity, authorization, mode, allow/deny rules, operation permissions, request limits, and high/destructive policy.

Check targets before use:

```bash
webcat scope-check https://app.example.test/api --operation passive
webcat scope-check https://app.example.test/api --operation active --json
```

### `.webcat/mcp.json`

Defines MCP servers, transports, interpolation, timeouts, tool filters, presets, and capability mappings.

```bash
webcat mcp status
webcat mcp tools
webcat mcp tools <server> --json
```

See [MCP integration](docs/MCP.md).

## Burp Suite MCP support

WebCat includes tested adapter presets for:

| Preset | Implementation | Transport |
|---|---|---|
| `portswigger-sse` | Official PortSwigger MCP extension | legacy SSE |
| `portswigger-stdio` | Official extension through packaged proxy | stdio |
| `swgee-sse` | BurpMCP extension | legacy SSE |
| `bridge-stdio` | Burp MCP Bridge | stdio |
| `bridge-http` | Burp MCP Bridge | streamable HTTP |

Inspect them:

```bash
webcat burp presets
webcat burp skills
webcat burp status
```

Enable the official extension in `.webcat/mcp.json`:

```json
{
  "schemaVersion": 1,
  "servers": {
    "burp": {
      "preset": "portswigger-sse",
      "enabled": true
    }
  }
}
```

Then verify initialization and tool discovery:

```bash
webcat burp doctor burp
webcat burp tools burp
```

A controlled official HTTP/1.1 call:

```bash
webcat mcp call burp send_http1_request \
  --args '{
    "content":"GET /account HTTP/1.1\r\nHost: app.example.test\r\n\r\n",
    "targetHostname":"app.example.test",
    "targetPort":443,
    "usesHttps":true
  }' \
  --approve
```

WebCat derives the target URL and applies scope, mode, risk, approval, rate, evidence, and audit controls before transport execution.

Configuration writes, intercept changes, task-engine changes, Intruder/scanner operations, broad interceptors, utility/shell execution, and other high-impact tool families are disabled by default where applicable.

Built-in Burp workflow guidance includes passive traffic review, authentication-flow mapping, access-control comparison, session-scope review, SSRF/redirect hypotheses using approved destinations, business-logic review, bounded rate-limit review, and evidence-based reporting.

See [Burp Suite MCP integration](docs/BURP.md) for all presets, setup variants, policy hints, exact safety behavior, and troubleshooting.

## Model-driven MCP tools

With an OpenAI-compatible provider, each specialist receives only discovered MCP tools whose trusted capability matches its profile. The model may request tool calls, but execution remains inside the deterministic MCP guard.

Tool use is bounded by `maxAgentTurns` and `maxToolCallsPerAgent`. In `manual` mode, create a stored approval before a model-driven active operation:

```bash
webcat approvals grant \
  --risk active \
  --server burp \
  --tool send_http1_request \
  --target 'https://app.example.test/**' \
  --ttl 20 \
  --reason 'Controlled authorization validation'
```

Policy errors are returned to the model as final safety decisions, not invitations to retry around controls.

## Operating modes

| Mode | Behavior |
|---|---|
| `observe` | Passive/read-only MCP operations only. |
| `manual` | Active operations require a matching operator approval. |
| `authorized-auto` | In-scope active operations may run automatically; high and destructive operations remain separately gated. |

## Main commands

```text
webcat init [--force]
webcat doctor [--json]
webcat paths [--json]
webcat scope-check <url> [--operation passive|active|high|destructive] [--json]
webcat profiles [--json]
webcat mcp status|tools [server] [--json]
webcat mcp call <server> <tool> --args '<json>' [--approve]
webcat burp status|doctor|tools [server] [--json]
webcat burp presets|skills [--json]
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

## Evidence and reporting

WebCat provides common secret redaction, SHA-256 evidence integrity, hash-chained audit entries, session-scoped hypotheses/findings, validator/critic gates, and Markdown/JSON reports.

```bash
webcat evidence verify
webcat audit verify
webcat findings list
webcat hypotheses list
webcat report --format markdown
```

Candidate findings are not promoted without evidence IDs, reproduction detail, sufficient confidence, and critic review.

## Runtime paths

- Linux: XDG directories under `webcat`
- macOS: `~/Library/Application Support/WebCat`, `~/Library/Caches/WebCat`, and `~/Library/Logs/WebCat`
- Windows: `%APPDATA%\WebCat` and `%LOCALAPPDATA%\WebCat`

Overrides: `WEBCAT_HOME`, `WEBCAT_CONFIG_HOME`, `WEBCAT_LOG_LEVEL`, `WEBCAT_LOG_FILE`, and `WEBCAT_DISABLE_UPDATE_CHECK`.

The default log is `webcat.log`. Common credentials and token-like fields are redacted before logging.

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

GitHub Actions runs the same QA gate for pull requests and pushes to `main`.

## Current limitations

- Burp MCP implementations evolve independently; inspect discovered tools after upgrades.
- Model-driven MCP use requires an OpenAI-compatible chat-completions endpoint with tool-call support.
- The TUI is a command-oriented terminal loop, not a full-screen graphical terminal application.
- Findings generated by a model require human verification.
- WebCat does not establish legal authorization; the operator must obtain and configure it correctly.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Configuration](docs/CONFIGURATION.md)
- [MCP integration](docs/MCP.md)
- [Burp Suite MCP integration](docs/BURP.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Release QA](docs/RELEASE_QA.md)
- [Security policy](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

WebCat is released under the MIT License. See [LICENSE](LICENSE).
