# Security model

WebCat does not infer authorization from a URL, model response, proxy history, or tool availability.

## Deterministic controls

- Authorization start and expiry validation
- Placeholder authorization rejection
- Exact and subdomain-wildcard host matching
- Scheme, port, path, and operation matching
- Deny precedence
- Observe, manual, and authorized-auto modes
- High-risk and destructive-operation switches
- Expiring server/tool/target-scoped approvals
- Active-tool target requirement
- Conservative MCP capability trust
- Rate and concurrency limits
- Secret redaction
- Evidence hashes
- Serialized hash-chained audit records

No compatibility loader imports configuration from a differently branded legacy directory.
