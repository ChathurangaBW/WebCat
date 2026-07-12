# Security model

## Trust boundaries

Trusted deterministic components:

- local engagement configuration;
- scope engine;
- approval store;
- MCP guard;
- evidence redaction;
- audit hashing;
- session state transitions.

Untrusted components:

- model output;
- MCP server descriptions and results;
- target application content;
- proxy history;
- browser-rendered content;
- third-party skills.

## Threats addressed

- model requests an out-of-scope target;
- MCP tool name understates its impact;
- wildcard domain matches a lookalike host;
- passive proxy history leaks unrelated hosts;
- expired authorization continues to run;
- prompt injection appears in target content;
- secrets are persisted in evidence;
- a candidate claim is reported as confirmed;
- audit records are modified.

## Limitations

- WebCat cannot prove the legal sufficiency of an authorization document.
- Custom MCP servers can misrepresent behavior. Use explicit capability mappings and local isolation.
- Output filtering is a defense-in-depth control, not a replacement for configuring proxy scope.
- The JSON action protocol depends on the configured model following instructions; malformed output stops the agent rather than being guessed.
- Legacy SSE servers that require a separate GET endpoint and message endpoint may need a streamable HTTP bridge.
