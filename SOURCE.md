# Source distribution

`src/webcat.mjs` is the readable, dependency-free ESM source distribution for WebCat. It is generated from the internally tested modular TypeScript implementation and retains module boundary comments such as `packages/core`, `packages/mcp-gateway`, `packages/agent-profiles`, `packages/agent-runtime`, and `apps/webcat`.

The bundled source is committed intentionally so installation does not require a compiler, package workspace, or third-party runtime dependency. The executable wrapper is `bin/webcat.mjs`.
