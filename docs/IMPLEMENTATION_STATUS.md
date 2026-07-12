# Implementation status

## Completed in this cleanup foundation

- removed the unrelated Vue web application and Fastify server architecture
- established a CLI-only monorepo shape
- added engagement, scope, workflow, MCP capability, risk, and profile primitives
- added initial tests for deny-by-default scope behavior and capability normalization
- adapted core swarm concepts into WebCat skills
- documented the native Kimi integration target

## Not yet complete

This branch is not the full Kimi fork. The following work still requires importing and modifying the upstream Kimi Code source:

1. Preserve upstream history or vendor a pinned Kimi commit.
2. Rebrand product constants, executable, paths, configuration, update endpoints, and user-facing strings.
3. Register WebCat profiles through Kimi's profile contribution catalog.
4. Connect WebCat phase orchestration to native Agent and AgentSwarm services.
5. Insert the scope and risk gate directly into native MCP tool invocation.
6. Add engagement persistence, audit JSONL, evidence storage, finding lifecycle, resume behavior, and TUI views.
7. Add Caido reference adapter and generic MCP discovery/mapping.
8. Run upstream tests, add WebCat integration tests, and produce distributable binaries.

No claim of complete autonomous pentesting functionality should be made until these items are implemented and tested.
