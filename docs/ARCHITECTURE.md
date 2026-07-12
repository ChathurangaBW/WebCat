# WebCat Architecture

## System shape

```text
┌────────────────────────────────────────────────────────────┐
│ WebCat CLI and interactive terminal workspace              │
│ init • doctor • run • resume • findings • report • audit  │
└────────────────────────────┬───────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────┐
│ Session and workflow runtime                               │
│ lifecycle • persistence • cancellation • retries          │
└────────────────────────────┬───────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────┐
│ Swarm orchestrator                                         │
│ planning • lane selection • bounded concurrency • review  │
└───────────────┬──────────────────────┬─────────────────────┘
                │                      │
       ┌────────▼────────┐    ┌────────▼────────┐
       │ Specialist      │    │ Validator and   │
       │ agents          │    │ critic agents   │
       └────────┬────────┘    └────────┬────────┘
                └──────────────┬───────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│ MCP capability gateway                                    │
│ discover -> classify -> scope -> approve -> limit -> call │
│          -> filter out-of-scope output -> persist         │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│ External MCP servers                                      │
│ proxy • browser • scanner • sitemap • custom tools        │
└──────────────────────────────┬─────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────┐
│ Engagement records                                        │
│ audit • evidence • hypotheses • findings • reports        │
└────────────────────────────────────────────────────────────┘
```

## Packages

### `@webcat/core`

Owns configuration, engagement parsing, scope rules, approvals, redaction, audit-chain persistence, evidence, hypotheses, findings, workflow state, skills, and reports.

### `@webcat/mcp-gateway`

Owns MCP stdio and HTTP/SSE transports, initialization, tool discovery, capability mapping, scope and approval enforcement, rate limiting, response filtering, and evidence capture.

### `@webcat/agent-profiles`

Defines the WebCat orchestrator, passive mapping agents, vulnerability-domain specialists, independent validator, security critic, evidence curator, and report writer.

### `@webcat/agent-runtime`

Owns the chat-completions client, isolated agent conversations, internal evidence/finding tools, MCP tool exposure, bounded scheduling, retries, validation, critic review, and session completion.

### `@webcat/cli`

Provides the `webcat` command, project initialization, diagnostics, operational commands, and interactive terminal workspace.

## External-call enforcement

Every MCP call follows this fixed path:

1. resolve the tool to a WebCat capability;
2. classify it as read, active, high, or destructive;
3. reject untrusted active heuristics unless a custom mapping exists;
4. extract absolute target URLs from arguments;
5. enforce authorization, engagement mode, allow rules, deny rules, and risk policy;
6. resolve one-time or stored operator approval;
7. acquire request-rate and concurrency capacity;
8. execute the MCP request;
9. filter returned records and URLs against passive scope;
10. redact secrets and persist request, response, and audit evidence.

This enforcement is code-level. Agent prompts and skills provide methodology but are not security boundaries.

## Agent isolation

Each specialist receives an independent message history, task, profile prompt, and capability-filtered MCP tool set. Results are returned to the orchestrator through stored evidence, hypotheses, findings, and final summaries rather than shared mutable model context.

## Finding lifecycle

```text
observation -> hypothesis -> controlled test -> evidence
           -> candidate -> independent validator
           -> critic for high/critical -> validated report item
```

A specialist cannot directly create a validated finding. Only validator or critic profiles receive the status-transition tool.
