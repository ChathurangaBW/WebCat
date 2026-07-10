# Kimi Code → WebCat Migration Mapping

## Package Mapping

| Kimi Code Package | WebCat Package | Action |
|---|---|---|
| `@moonshot-ai/agent-core` | `@webcat/agent-core` | Adapt: rename, add pentest agents, scope hooks |
| `@moonshot-ai/server` | `@webcat/server` | Adapt: rename, add pentest APIs, scope middleware |
| `@moonshot-ai/protocol` | `@webcat/protocol` | Adapt: rename, add pentest schemas |
| `@moonshot-ai/kimi-code-sdk` | `@webcat/node-sdk` | Adapt: rename, add pentest client methods |
| `@moonshot-ai/kosong` | `@webcat/provider-core` | Adapt: rename, keep LLM abstraction |
| `@moonshot-ai/kaos` | `@webcat/storage` | Adapt: rename, add engagement storage |

## New Packages (No Kimi Equivalent)

| WebCat Package | Purpose |
|---|---|
| `@webcat/mcp-hub` | MCP-agnostic hub with capability normalization |
| `@webcat/scope-engine` | Central scope enforcement |
| `@webcat/pentest-core` | Pentest agents and workflows |
| `@webcat/evidence-core` | Evidence management |
| `@webcat/reporting` | Report generation |
| `@webcat/execution-runtime` | Sandboxed execution |
| `@webcat/auth` | Authentication and RBAC |
| `@webcat/shared` | Shared utilities and redaction |

## App Mapping

| Kimi Code App | WebCat App | Action |
|---|---|---|
| `apps/kimi-code` (CLI) | `apps/webcat-cli` | Rewrite: `webcat` command, pentest subcommands |
| `apps/kimi-web` | `apps/webcat-web` | Rewrite: pentest UI (dashboard, traffic, findings, etc.) |
| `apps/kimi-desktop` | `apps/webcat-desktop` | Defer: build after web stability |
| `apps/vis` | `apps/webcat-visualizer` | Adapt: rename, add pentest visualization |

## Configuration Migration

| Kimi Code | WebCat |
|---|---|
| `~/.kimi-code/` | `~/.webcat/` |
| `.kimi-code` | `.webcat` |
| `KIMI_CODE_*` | `WEBCAT_*` |
| `kimi` command | `webcat` command |

## Agent Profile Migration

Kimi Code's `DEFAULT_AGENT_PROFILES` provide a foundation. WebCat extends with pentest-specific profiles while retaining the engineering profiles for development tasks.

## Skill Migration

Kimi Code's built-in skills (custom-theme, import-from-cc-codex, mcp-config, sub-skill, update-config, write-goal) are replaced with WebCat skills covering both engineering and pentest domains.

## Key Differences

1. **Scope Enforcement** — New mandatory security layer; no Kimi equivalent
2. **Pentest Workflows** — New engagement lifecycle, hypothesis-driven testing
3. **MCP Hub** — Extended MCP management with trust levels and capability normalization
4. **Evidence System** — New chain-of-custody system; no Kimi equivalent
5. **Finding System** — New vulnerability tracking and reporting
6. **Approval System** — Extended for pentest-specific risk classifications
