# Security model

WebCat does not infer authorization from a URL, model response, proxy history, or tool availability.

## Deterministic controls

- Authorization start and expiry validation
- Placeholder authorization rejection
- Exact and subdomain-wildcard host matching
- Scheme, port, path, and operation matching
- Deny precedence
- Allow-rule shape validation, so a malformed rule fails closed instead of matching every target
- Observe, manual, and authorized-auto modes
- High-risk and destructive-operation switches
- Expiring server/tool/target-scoped approvals
- Active-tool target requirement
- Conservative MCP capability trust (unmapped tools default to `active`; untrusted descriptions may only escalate risk)
- Rate and concurrency limits (request slots are reserved before dispatch, so the configured rate holds under concurrent calls)
- Secret redaction
- Evidence hashes
- Serialized hash-chained audit records covering every refusal class (untrusted tool, missing target, scope, approval, concurrency)

No compatibility loader imports configuration from a differently branded legacy directory.
