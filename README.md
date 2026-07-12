# WebCat

WebCat is a terminal-native AI swarm for authorized web application security assessment.

## Run

```bash
npm link
webcat --version
webcat init
webcat doctor
webcat tui
```

## Core capabilities

- CLI and interactive TUI
- engagement authorization and deny-by-default scope enforcement
- observe, manual, and authorized-auto operating modes
- generic stdio and HTTP/SSE MCP integration
- capability and risk classification
- persistent operator approvals
- specialist WebCat agent profiles
- OpenAI-compatible model tool loop
- evidence hashing and secret redaction
- hash-chained audit records
- sessions, resume, findings, and Markdown reports

Edit `.webcat/engagement.json`, `.webcat/config.json`, and `.webcat/mcp.json` after initialization. WebCat is for explicitly authorized targets only.
