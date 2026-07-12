# Contributing

## Setup

```bash
npm install
npm test
npm run smoke
npm pack --dry-run
```

## Change requirements

Security-sensitive changes should include tests for both allow and deny behavior. At minimum, consider:

- authorization expiry;
- exact and wildcard host matching;
- deny precedence;
- path and operation-risk matching;
- approval expiry and revocation;
- target extraction;
- MCP capability classification;
- out-of-scope response filtering;
- evidence redaction;
- audit-chain verification under concurrent writers;
- candidate-to-validated finding transitions.

Keep runtime dependencies minimal. Do not add a scanner, payload library, credential harvester, or autonomous target-discovery mechanism to the core product.

## Pull requests

Describe:

- what changed;
- the security invariant affected;
- validation performed;
- any residual risk or compatibility concern.
