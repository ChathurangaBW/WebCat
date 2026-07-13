# Contributing

Run the complete release gate before opening a pull request:

```bash
npm ci
npm run qa
npm pack --dry-run
```

Security-sensitive changes must include both allow and deny tests. Relevant invariants include authorization expiry, wildcard-safe host matching, deny precedence, target extraction, active-tool trust, approval expiry and revocation, evidence redaction, audit-chain integrity, and candidate-to-validated finding transitions.

Keep runtime dependencies minimal. Do not add autonomous public-target discovery, credential harvesting, destructive defaults, or a bypass around the MCP policy gateway.
