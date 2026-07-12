# Configuration

## `.webcat/engagement.json`

Required fields:

- `id`, `name`
- `authorizedBy`
- `authorizationReference`
- `startsAt`, `expiresAt`
- `mode`
- `allow`, `deny`
- `rateLimit`
- `riskPolicy`

A scope rule supports:

- `hosts`: exact hosts or `*.example.test`
- `schemes`: `http`, `https`, `ws`, `wss`
- `ports`
- `paths`: `*` matches one path segment; `**` crosses segments
- `methods`
- `operations`: `passive`, `active`, `high`, `destructive`

Deny rules are evaluated first.

## `.webcat/config.json`

`model`:

- `provider`: `openai-compatible` or `mock`
- `baseUrl`
- `apiKeyEnv`
- `model`
- `timeoutMs`
- optional static headers

`swarm`:

- `maxConcurrency`
- `maxAgentTurns`
- `maxToolCallsPerAgent`
- optional `selectedProfiles`

`evidence`:

- `maxBodyBytes`
- `redactHeaders`
- `redactKeys`

## Environment

- the configured model API key variable, such as `OPENAI_API_KEY`
- `WEBCAT_DEBUG=1` to include stack traces on CLI failures
- server-specific environment variables referenced by MCP configuration
