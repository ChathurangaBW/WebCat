# Contributing to WebCat

## Development Setup

```bash
# Clone the repository
git clone https://github.com/ChathurangaBW/WebCat.git
cd WebCat

# Install dependencies
pnpm install

# Start the development server
pnpm dev:server

# In another terminal, start the web UI
pnpm dev:web

# Run tests
pnpm test
```

## Project Structure

```
apps/
  webcat-cli/       # CLI entry point
  webcat-web/       # Vue 3 web application
packages/
  shared/           # Shared types, utilities, redaction
  protocol/         # REST + WebSocket schemas
  scope-engine/     # Central scope enforcement
  mcp-hub/          # MCP integration hub
  server/           # Fastify REST + WebSocket server
  agent-core/       # Agent runtime engine
```

## Coding Standards

- TypeScript strict mode
- Composition API for Vue components
- Zod schemas for all wire contracts
- Vitest for testing
- Follow existing patterns in each package

## Commit Convention

- `feat:` — New features
- `fix:` — Bug fixes
- `docs:` — Documentation
- `test:` — Tests
- `refactor:` — Code restructuring
- `chore:` — Build, CI, dependencies

## Security

- Never commit secrets or credentials
- Use environment variables for API keys
- All MCP output is treated as untrusted
- Scope enforcement is mandatory for network operations
