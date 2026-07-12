# MCP integration

WebCat supports MCP servers over:

- stdio;
- streamable HTTP;
- HTTP responses encoded as server-sent events.

## Configuration

```json
{
  "schemaVersion": 1,
  "servers": {
    "caido": {
      "transport": "stdio",
      "command": "caido-mcp",
      "args": ["serve"],
      "enabled": true,
      "startupTimeoutMs": 15000,
      "toolTimeoutMs": 60000,
      "disabledTools": ["race_window_send"]
    },
    "custom": {
      "transport": "http",
      "url": "http://127.0.0.1:9000/mcp",
      "bearerTokenEnvVar": "CUSTOM_MCP_TOKEN",
      "enabled": true
    }
  }
}
```

## Capability classification

Classification uses, in order:

1. explicit `capabilityMap`;
2. MCP tool annotations;
3. conservative tool-name patterns;
4. a default active/high classification.

Unknown tools are not assumed passive.

Useful capability classes include:

- `proxy.read`
- `data.read`
- `scope.read`
- `http.execute`
- `browser.navigate`
- `scanner.run`
- `concurrency.test`
- `findings.write`
- `proxy.control`
- `workspace.admin`
- `destructive.execute`

## Stdio requirements

MCP servers must emit JSON-RPC messages on stdout and diagnostics on stderr. Accidental stdout noise is ignored, but repeated protocol violations will cause timeouts.

## Output filtering

Passive tools may return records for multiple hosts. WebCat recursively removes records containing URLs or host/path pairs that fail current scope evaluation before evidence is persisted or returned to an agent.
