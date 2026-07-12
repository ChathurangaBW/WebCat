# WebCat

WebCat is a **terminal-native AI swarm for authorized web-application security assessment**. It combines a CLI/TUI workspace, specialized security agents, generic Model Context Protocol integrations, strict engagement scope enforcement, operator approvals, evidence preservation, independent finding validation, and report generation.

## Capabilities

- interactive `webcat` terminal workspace and scriptable CLI
- resumable assessment sessions and explicit workflow states
- 15 specialized WebCat agent profiles
- bounded concurrent swarm execution
- generic chat-completions model provider
- stdio and streamable HTTP MCP transports
- capability adapters for proxy, browser, scanner, sitemap, and custom tools
- deny-by-default target scope enforcement
- risk classification and time-limited operator approvals
- rate and concurrency controls for external actions
- redacted, hashed evidence and append-only audit records
- hypothesis and candidate-finding lifecycle
- independent validation and critic gates
- Markdown and JSON reports
- standalone installable npm package

## Repository layout

```text
apps/webcat/                 CLI and terminal workspace
packages/core/               configuration, scope, workflow, storage, reports
packages/mcp-gateway/        MCP transports, capability mapping, execution policy
packages/agent-profiles/     specialist WebCat profiles
packages/agent-runtime/      model client, agent loop, swarm scheduler
skills/                      reusable security assessment procedures
docs/                        architecture and operations documentation
```

## Development

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm package
```

Run the development CLI:

```bash
pnpm start -- help
```

## Project setup

```bash
webcat init
```

Edit the generated files under `.webcat/`:

- `engagement.yaml` — authorization, mode, allow rules, deny rules, and limits
- `config.toml` — model and swarm configuration
- `mcp.json` — MCP servers and optional explicit capability mappings

Then verify the environment:

```bash
webcat doctor
webcat scope-check https://app.example.test/
webcat mcp list
```

Start the terminal workspace:

```bash
webcat tui
```

Or run a bounded swarm directly:

```bash
webcat run --objective "Map the authorized API surface and assess access-control boundaries"
```

## Safety model

WebCat is intended only for assets covered by explicit authorization. External operations are blocked unless the engagement, target scope, capability mapping, risk policy, and required approvals all pass. Candidate issues remain unvalidated until reviewed by a separate validation lane.

## License

MIT. See [LICENSE](LICENSE).
