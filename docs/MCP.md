# MCP integration

WebCat is an MCP client and policy gateway for external security tools. It supports stdio JSON-RPC, streamable HTTP JSON-RPC, legacy MCP SSE, and SSE-formatted streamable HTTP responses.

## Configuration

Project MCP configuration is stored in `.webcat/mcp.json`. User configuration is stored in the platform-specific WebCat configuration directory. Project entries replace user entries with the same server name.

```json
{
  "schemaVersion": 1,
  "servers": {
    "example": {
      "transport": "stdio",
      "command": "example-mcp",
      "args": ["serve"],
      "enabled": false,
      "timeoutMs": 60000,
      "enabledTools": [],
      "disabledTools": [],
      "env": {},
      "capabilityMap": {}
    }
  }
}
```

HTTP and SSE servers use `url` and may include `headers`. String values support `${VARIABLE}` interpolation.

## Tool discovery and policy

```bash
webcat mcp status
webcat mcp tools
webcat mcp tools <server> --json
```

Passive tools may be conservatively classified from their name and description. Active, high-risk, and destructive tools require a trusted mapping. A mapping has this form:

```json
{
  "send_request": {
    "capability": "http.execute",
    "risk": "active",
    "requiresTarget": true
  }
}
```

A configured mapping overrides the built-in adapter mapping for that exact tool name.

## Execution gates

Before transport execution, WebCat verifies:

1. the server and tool are enabled;
2. the tool has a trusted classification when it is not passive;
3. required target URLs can be extracted;
4. every extracted target is currently authorized and in scope;
5. engagement mode and high/destructive policy permit the operation;
6. required stored or one-time approval is present;
7. request-rate and parallel limits are available.

Tool results are treated as untrusted, filtered for out-of-scope target-bearing records, redacted, hashed as evidence, and recorded in the audit chain.

## Model tool calls

For OpenAI-compatible providers, WebCat can expose profile-compatible MCP tools to the model. The model sees only discovered tools whose trusted capability matches the specialist profile. Calls remain bounded by the configured agent-turn and tool-call limits and are executed through the same deterministic guard as direct CLI calls.

A model cannot grant approval, modify scope, enable disabled tools, or bypass a rejected policy decision.

## Burp Suite

WebCat includes tested adapters and presets for the official PortSwigger MCP extension, BurpMCP, and Burp MCP Bridge. See [Burp Suite MCP integration](BURP.md) for setup, exact presets, tool families, safety defaults, and examples.

## Caido

The example configuration includes a Caido stdio server with conservative mappings for history, request retrieval, sending, and workflows. WebCat remains server-agnostic; add or refine mappings to match the exact Caido MCP server version in use.

## Diagnostics

```bash
webcat doctor
webcat mcp status
webcat mcp tools <server>
webcat burp doctor <server>
```

Diagnostics redact token-like values and configured authorization headers. Server-side logs remain governed by the external MCP implementation.
