# WebCat MCP Capability Model

## Overview

WebCat defines a normalized capability taxonomy that abstracts vendor-specific MCP tool names. Agents request capabilities; the MCP Hub maps them to available providers.

## Capability Taxonomy

### Proxy Capabilities

```
proxy.instance.read          — Get proxy instance info
proxy.project.list           — List available projects
proxy.project.select         — Select the active project
proxy.history.search         — Search proxy HTTP history
proxy.request.read           — Read a specific request (with body limits)
proxy.response.read          — Read a specific response (with body limits)
proxy.response.diff          — Diff two responses
proxy.replay.send            — Send a single replayed request
proxy.replay.edit            — Edit a request before sending
proxy.replay.batch           — Send a batch of requests
proxy.replay.session.create  — Create a replay session
proxy.replay.session.read    — Read replay session entries
proxy.replay.session.delete  — Delete a replay session
proxy.cookies.read_metadata  — Read cookie metadata (names, flags, NOT values)
proxy.cookies.clear          — Clear session cookies
proxy.sitemap.read           — Read the sitemap tree
proxy.scope.read             — Read proxy scope rules
proxy.scope.check            — Check if a URL is in scope
proxy.scope.manage           — Create/update/delete scope rules
proxy.intercept.status       — Get intercept status
proxy.intercept.pause        — Pause interception
proxy.intercept.resume       — Resume interception
proxy.intercept.forward      — Forward an intercepted request
proxy.intercept.drop         — Drop an intercepted request
proxy.fuzzer.list            — List fuzz/automate sessions
proxy.fuzzer.read            — Read fuzzer session details
proxy.fuzzer.start           — Start a fuzzing session
proxy.fuzzer.pause           — Pause fuzzing
proxy.fuzzer.resume          — Resume fuzzing
proxy.fuzzer.cancel          — Cancel fuzzing
proxy.finding.list           — List proxy findings
proxy.finding.create         — Create a finding in the proxy
proxy.finding.export         — Export findings
proxy.finding.delete         — Delete a finding
proxy.websocket.streams.read — List WebSocket streams
proxy.websocket.messages.read — Read WebSocket messages
```

### Browser Capabilities

```
browser.navigate             — Navigate to a URL
browser.request.inspect      — Inspect browser network requests
browser.dom.read             — Read DOM content
browser.screenshot           — Take a screenshot
browser.console.read         — Read console output
```

### HTTP Capabilities

```
http.request.send            — Send a single HTTP request
http.request.batch           — Send batched HTTP requests
http.response.compare        — Compare HTTP responses
```

### MCP Discovery Fields

Each discovered MCP tool includes:

```typescript
interface McpToolDefinition {
  name: string;              // MCP tool name
  description: string;       // Tool description
  inputSchema: unknown;      // JSON Schema for input
}

interface McpToolRegistration {
  qualifiedName: string;     // mcp__<server>__<tool>
  serverName: string;        // MCP server name
  toolName: string;          // Original tool name
  description: string;       // Sanitized description
  inputSchema: Record<string, unknown>;  // Validated input schema
  capabilities: string[];    // Mapped capabilities (may be empty)
  trustLevel: 'untrusted' | 'reviewed' | 'trusted' | 'system';
  riskClassification: {
    readsData: boolean;
    writesData: boolean;
    sendsNetwork: boolean;
    executesCommands: boolean;
    deletesData: boolean;
    isDestructive: boolean;
  };
  enabled: boolean;
}
```

## Adapter System

Adapters map vendor-specific tool names to normalized capabilities:

```typescript
interface McpAdapter {
  name: string;
  vendorPatterns: RegExp[];           // Patterns to match against tool names
  toolNameMapping: Record<string, string[]>;  // tool name → capabilities
  riskOverrides: Record<string, Partial<RiskClassification>>;
  inputNormalizer?: (toolName: string, args: Record<string, unknown>) => Record<string, unknown>;
  outputNormalizer?: (toolName: string, result: unknown) => unknown;
  healthCheck?: (client: MCPClient) => Promise<boolean>;
  paginationHelper?: (toolName: string, args: Record<string, unknown>) => PaginationConfig;
}
```

## Named Adapters

- **Caido Adapter** — Maps Caido MCP tools to proxy.* capabilities
- **Burp Suite Adapter** — Maps Burp-style MCP tools to proxy.* capabilities
- **OWASP ZAP Adapter** — Maps ZAP MCP tools to proxy.* capabilities
- **Generic HTTP Adapter** — Maps generic HTTP/replay tools
- **Browser Adapter** — Maps browser automation tools

## Trust Levels

| Level | Description | Default For |
|---|---|---|
| `untrusted` | New, unverified connection; all actions require approval | New MCP servers |
| `reviewed` | Reviewed by operator; read-only tools auto-approved | Reviewed servers |
| `trusted` | Fully trusted; within-scope operations auto-approved | Operator-trusted servers |
| `system` | Built-in WebCat MCP servers | WebCat internals |

## Risk Classification

Every MCP tool is classified:

```typescript
interface RiskClassification {
  readsData: boolean;       // Tool reads data
  writesData: boolean;      // Tool writes/modifies data
  sendsNetwork: boolean;    // Tool sends network traffic
  executesCommands: boolean; // Tool executes OS commands
  deletesData: boolean;     // Tool deletes data
  isDestructive: boolean;   // Tool can cause damage
  requiresApproval: boolean; // Always requires approval
  maxRate?: number;         // Max calls per minute
  maxConcurrent?: number;   // Max concurrent calls
}
```
