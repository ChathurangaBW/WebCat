# MCP Integration

WebCat connects to MCP servers through stdio or streamable HTTP/SSE.

## Stdio server

```json
{
  "servers": {
    "proxy": {
      "transport": "stdio",
      "command": "security-proxy-mcp",
      "args": ["serve"],
      "enabled": true,
      "timeoutMs": 60000,
      "env": {
        "PROXY_URL": "http://127.0.0.1:8080",
        "PROXY_TOKEN": "${PROXY_TOKEN}"
      }
    }
  }
}
```

## HTTP server

```json
{
  "servers": {
    "remote": {
      "transport": "http",
      "url": "http://127.0.0.1:9000/mcp",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer ${WEBCAT_MCP_TOKEN}"
      }
    }
  }
}
```

## Capability normalization

Agents request stable WebCat capabilities such as:

- `proxy.history.list`
- `proxy.history.read`
- `proxy.request.replay`
- `proxy.request.batch`
- `proxy.response.diff`
- `sitemap.read`
- `browser.navigate`
- `browser.inspect`
- `scanner.run`
- `workflow.run`

Known tool names and read-only/destructive annotations are mapped automatically. An unknown active tool is not trusted by name heuristics alone.

## Custom capability mappings

```json
{
  "servers": {
    "custom": {
      "transport": "stdio",
      "command": "custom-mcp",
      "enabled": true,
      "capabilities": {
        "custom_history": {
          "name": "proxy.history.list",
          "risk": "read",
          "trusted": true
        },
        "custom_replay": {
          "name": "proxy.request.replay",
          "risk": "active",
          "trusted": true
        }
      }
    }
  }
}
```

Mappings can use the exact tool name or the normalized tool name. They are part of the trusted project configuration and should be reviewed like code.

## Operational commands

```bash
webcat mcp list
webcat mcp status
webcat mcp tools
webcat mcp tools proxy
webcat mcp call proxy list_requests --args '{}'
webcat mcp call proxy send_request --args '{"url":"https://app.example.test/api"}' --approve
```

The `--approve` option is a one-time operator approval. Stored approvals are preferable for bounded repeated work.

## Out-of-scope output filtering

Read-only history and sitemap tools may return records outside the engagement. When `filterOutOfScopeMcpOutput` is enabled, WebCat removes array records containing only out-of-scope URLs and replaces out-of-scope URLs embedded in strings with `[OUT_OF_SCOPE]` before model exposure and persistence.
