# MCP integration

WebCat supports:

- stdio JSON-RPC
- streamable HTTP JSON-RPC
- SSE-formatted HTTP responses
- disabled servers
- enabled-tool allowlists
- disabled-tool denylists
- per-server timeouts
- environment and header interpolation
- explicit capability mappings

Passive discovery tools may be classified conservatively by name and description. Active, high-risk, and destructive tools require an explicit trusted capability mapping. Active operations require an extractable absolute target URL and are evaluated by the authorization and scope engine before transport execution.

MCP output is untrusted. Target-bearing records outside the approved passive scope are removed before evidence persistence.
