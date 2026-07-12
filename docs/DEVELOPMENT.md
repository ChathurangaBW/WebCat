# Development and distribution

## Commands

```bash
npm install
npm test
npm run smoke
npm pack --dry-run
```

## Source layout

- `src/webcat.mjs` — readable dependency-free ESM source distribution
- `bin/webcat.mjs` — executable wrapper
- `test/cli.test.mjs` — packaged CLI and scope-policy tests
- `test/e2e.mjs` — initialization, mock swarm, audit, evidence, and report workflow

The committed source distribution is generated from a modular TypeScript workspace and retains module-boundary comments for core, MCP gateway, profiles, runtime, and CLI code. The repository intentionally does not require a compiler or runtime dependency.

## Test strategy

Tests cover:

- executable version and profile discovery;
- exact and wildcard-safe scope matching;
- lookalike-domain denial;
- project initialization;
- mock-provider swarm completion;
- concurrent audit-chain integrity;
- evidence integrity verification;
- Markdown report generation.

The bundled runtime also contains its internal scope, evidence, audit, MCP guard, and agent-protocol logic that was validated before packaging.

## Modifying the source

Preserve these invariants:

- no active external call without a concrete in-scope target;
- deny rules override allow rules;
- model and MCP output cannot bypass the deterministic guard;
- secrets are redacted before persistence;
- candidate findings require validation and critic review;
- concurrent audit writes remain serialized.
