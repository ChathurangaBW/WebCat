# WebCat

WebCat is a terminal-native AI swarm runtime for **authorized web application security assessment**. It coordinates isolated specialist profiles, connects to generic Model Context Protocol (MCP) servers, enforces scope before external actions, records redacted evidence, validates candidate findings, and produces Markdown or JSON reports.

WebCat has no browser dashboard and no built-in exploit library. External operations are executed only through configured MCP servers after deterministic authorization, scope, risk, approval, and rate-limit checks.

## Requirements

- Node.js 22 or later
- npm 10 or later
- Optional: an OpenAI-compatible chat-completions endpoint
- Optional: MCP servers for proxy, browser, scanner, or workflow tooling

## Install and QA

```bash
npm ci
npm run qa
npm link
webcat --help
webcat --version
```

The source distribution has no runtime dependencies.

## Initialize an engagement

```bash
webcat init
```

Edit the generated files:

- `.webcat/config.toml` — model, swarm, logging, and evidence settings
- `.webcat/engagement.json` — written authorization, time window, scope, mode, risk policy, and rate limits
- `.webcat/mcp.json` — MCP transports, tool filters, environment interpolation, and explicit capability mappings

The generated engagement contains placeholders and cannot authorize external actions until they are replaced.

## Common commands

```bash
webcat doctor
webcat paths
webcat scope-check https://app.example.test/api --operation passive
webcat profiles
webcat mcp status
webcat mcp tools caido
webcat approvals grant --risk active --ttl 20 --reason "Controlled validation"
webcat run --objective "Assess object authorization within the approved scope"
webcat audit verify
webcat evidence verify
webcat report --format markdown
webcat tui
```

## Runtime paths

WebCat uses platform-specific user directories and never depends on the repository parent-directory name.

- Linux: XDG configuration, state, cache, and data directories under `webcat`
- macOS: `Library/Application Support/WebCat`, `Library/Caches/WebCat`, and `Library/Logs/WebCat`
- Windows: `%APPDATA%\WebCat` and `%LOCALAPPDATA%\WebCat`

Overrides:

- `WEBCAT_HOME`
- `WEBCAT_CONFIG_HOME`
- `WEBCAT_LOG_LEVEL`
- `WEBCAT_LOG_FILE`
- `WEBCAT_DISABLE_UPDATE_CHECK`

The default log filename is `webcat.log`. Secrets, cookies, authorization headers, and token-like fields are redacted before persistence.

## Safety boundary

An external action must pass all of the following:

1. Current written authorization window
2. Explicit deny rules
3. Explicit allow rules
4. Engagement mode
5. High-risk and destructive-operation policy
6. Operator approval where required
7. Request rate and parallelism controls
8. Redacted evidence and hash-chained audit recording

Active tools without an extractable absolute target URL are blocked. Active tools inferred only from naming are blocked until an explicit capability mapping marks them trusted.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Configuration](docs/CONFIGURATION.md)
- [MCP](docs/MCP.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Release QA](docs/RELEASE_QA.md)
