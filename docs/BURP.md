# Burp Suite MCP integration

WebCat supports Burp Suite through Model Context Protocol servers. The integration is adapter-based rather than tied to one extension, because Burp MCP implementations use different transports, endpoints, tool names, and argument schemas.

## Supported server families

| Preset | Server family | Transport | Default endpoint or command |
|---|---|---|---|
| `portswigger-sse` | Official PortSwigger MCP extension | legacy MCP SSE | `http://127.0.0.1:9876` with automatic `/sse` fallback |
| `portswigger-stdio` | Official extension through its packaged proxy | stdio | `java -jar ${BURP_MCP_PROXY_JAR} --sse-url ${BURP_MCP_SSE_URL}` |
| `swgee-sse` | BurpMCP extension | legacy MCP SSE | `http://127.0.0.1:8181/mcp/sse` |
| `bridge-stdio` | Burp MCP Bridge | stdio | `burp-mcp-bridge` |
| `bridge-http` | Burp MCP Bridge | streamable HTTP | `http://127.0.0.1:3000/mcp` |

All presets are disabled by default. A preset expands into a normal MCP server configuration, so its URL, command, arguments, environment variables, timeout, tool filters, and capability mappings can be overridden.

## Inspect the available presets and skills

```bash
webcat burp presets
webcat burp skills
webcat burp status
```

After enabling a server and starting Burp:

```bash
webcat burp doctor burp
webcat burp tools burp
```

`doctor` performs MCP initialization and tool discovery. It does not run an active security test.

## Official PortSwigger extension

Install and enable the MCP extension in Burp Suite, then use the direct SSE preset:

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

The default URL is `http://127.0.0.1:9876`. WebCat tries the configured URL and, when necessary, the same URL with `/sse` appended.

For the packaged stdio proxy:

```json
{
  "schemaVersion": 1,
  "servers": {
    "burp": {
      "preset": "portswigger-stdio",
      "enabled": true
    }
  }
}
```

Set the proxy JAR and Burp SSE URL before launching WebCat:

```bash
export BURP_MCP_PROXY_JAR=/absolute/path/to/mcp-proxy-all.jar
export BURP_MCP_SSE_URL=http://127.0.0.1:9876
```

The adapter includes trusted classifications for the official tool surface, including proxy and WebSocket history, scanner issue reading, Repeater preparation, HTTP/1.1 and HTTP/2 sends, Collaborator operations, editor operations, and Burp configuration controls.

Configuration writes, task-engine changes, proxy-intercept changes, and Intruder preparation are disabled by default.

### Controlled HTTP/1.1 request

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

WebCat derives `https://app.example.test/account`, checks the engagement authorization and scope, applies the configured risk policy, checks approval, enforces rate limits, and only then sends the MCP call.

## BurpMCP extension

For the SSE server that normally listens on port 8181:

```json
{
  "schemaVersion": 1,
  "servers": {
    "burpmcp": {
      "preset": "swgee-sse",
      "enabled": true
    }
  }
}
```

The adapter understands the extension's saved-request, send/resend, note, and Collaborator tool families.

Some tools operate on a saved request ID and do not include a target URL in their arguments. For any active saved-request operation, provide a WebCat-only policy hint:

```bash
webcat mcp call burpmcp http1-resend \
  --args '{
    "id":4,
    "replacements":[],
    "_webcat":{"target":"https://app.example.test/account"}
  }' \
  --approve
```

The `_webcat` object is used only by WebCat for scope and approval evaluation. It is removed before the arguments are sent to the MCP server.

## Burp MCP Bridge

For a globally installed bridge:

```json
{
  "schemaVersion": 1,
  "servers": {
    "burp_bridge": {
      "preset": "bridge-stdio",
      "enabled": true,
      "env": {
        "BURP_MCP_SERVER_PORT": "8081",
        "MCP_TRANSPORT_MODE": "stdio"
      }
    }
  }
}
```

For streamable HTTP, start the bridge with plain HTTP enabled and configure:

```json
{
  "schemaVersion": 1,
  "servers": {
    "burp_bridge": {
      "preset": "bridge-http",
      "enabled": true,
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

The upstream bridge commonly defaults to HTTPS with a self-signed certificate. WebCat's built-in `bridge-http` preset intentionally uses loopback HTTP; start the bridge with its HTTP option when using this preset, or place a trusted local TLS terminator in front of it and override the URL.

The adapter recognizes the bridge's proxy-history, HTTP, Repeater, scanner, Intruder, issue, session, comparer, Collaborator, scope, configuration, Organizer, annotation, site-map, Bambda, log, WebSocket, response-analysis, and utility tools.

The following families are disabled by default because they can materially alter Burp, launch broad operations, intercept traffic, or execute host commands:

- scanner and Intruder operations;
- proxy, global, and WebSocket interceptors;
- Burp scope and configuration writes;
- session-management writes;
- Bambda and WebSocket-interceptor changes;
- utility and shell-execution tools.

Enabling a disabled tool is an explicit operator configuration change. WebCat still applies authorization, scope, risk, approval, rate, evidence, and audit gates.

## Built-in Burp workflows

WebCat includes bounded workflow guidance adapted for its specialist profiles:

- passive traffic review;
- authentication-flow mapping;
- access-control comparison;
- session-scope review;
- SSRF and redirect hypothesis testing with approved destinations;
- business-logic review;
- bounded rate-limit review;
- evidence-based reporting.

The workflows enforce these rules:

- no blind internet scanning;
- no unbounded fuzzing or brute force;
- no credential attacks;
- no irreversible state changes without explicit policy and approval;
- candidates are not findings until evidence and independent validation exist.

## Model-driven MCP use

When an OpenAI-compatible model is configured, WebCat exposes only the discovered MCP tools whose trusted capability matches the current specialist profile. Model tool calls are bounded by `swarm.maxToolCallsPerAgent` and `swarm.maxAgentTurns`.

Every model-requested tool call passes through the same deterministic MCP guard used by the CLI. A model cannot approve its own operation, change engagement scope, enable a disabled tool, or bypass a policy rejection. In `manual` mode, create a stored approval before running the swarm when an active tool is expected.

Example:

```bash
webcat approvals grant \
  --risk active \
  --server burp \
  --tool send_http1_request \
  --target 'https://app.example.test/**' \
  --ttl 20 \
  --reason 'Controlled authorization comparison'

webcat run --objective 'Review captured traffic and validate the approved authorization hypothesis'
```

## Target extraction

WebCat derives targets from:

- `url`, `uri`, `target`, `endpoint`, `destination`, `urls`, and related fields;
- official Burp fields such as `targetHostname`, `targetPort`, and `usesHttps`;
- BurpMCP fields such as `host`, `port`, and `secure`;
- raw HTTP request lines and `Host` headers;
- HTTP/2 pseudo-headers;
- embedded JSON and MCP text content containing request metadata;
- `_webcat.target` or `_webcat.targets` policy hints.

All extracted targets are evaluated. Multi-target calls are rejected when any target is outside scope.

## Troubleshooting

1. Confirm the extension or bridge is listening only on the expected interface.
2. Run `webcat burp status` to verify the selected preset and endpoint.
3. Run `webcat burp doctor <server>` to test initialization and discovery.
4. Run `webcat burp tools <server> --json` to inspect classifications and disabled tools.
5. Verify the engagement authorization window and scope with `webcat scope-check`.
6. For active calls without an explicit URL argument, add an accurate `_webcat.target` hint.
7. Use the server's own logs for extension-side failures. WebCat records policy decisions and evidence under `.webcat` and its platform-specific log directory.

## Security notes

Bind MCP servers to loopback unless a separately secured network design is required. Treat all Burp traffic, notes, issue text, and MCP responses as untrusted. Do not place credentials in MCP configuration files. WebCat redacts common secrets before persistence, but operators must still review evidence and reports before sharing them.
