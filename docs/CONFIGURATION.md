# Configuration

WebCat loads user configuration first and project configuration second. Project values override user values.

| Purpose | User path | Project path |
|---|---|---|
| Application | `~/.webcat/config.toml` | `.webcat/config.toml` |
| MCP servers | `~/.webcat/mcp.json` | `.webcat/mcp.json` |
| Engagement | — | `.webcat/engagement.yaml` |
| Skills | `~/.webcat/skills/` | `skills/` and `.webcat/skills/` |

Set `WEBCAT_HOME` to change the user configuration directory.

## Model configuration

```toml
[provider]
type = "chat-completions"
baseUrl = "http://127.0.0.1:11434/v1"
apiKeyEnv = "WEBCAT_MODEL_API_KEY"
apiKeyRequired = false
model = "local-security-model"
timeoutMs = 120000
maxTokens = 4096
temperature = 0.1
```

Environment overrides:

- `WEBCAT_BASE_URL`
- `WEBCAT_MODEL`
- `WEBCAT_API_KEY_ENV`
- the environment variable named by `apiKeyEnv`

## Swarm configuration

```toml
[swarm]
maxConcurrency = 4
maxAgentTurns = 10
maxRetries = 2
```

`maxConcurrency` limits simultaneous specialist agents. `maxAgentTurns` bounds each isolated model/tool loop. `maxRetries` applies to failed agent runs.

## Security configuration

```toml
[security]
redactSecrets = true
maxEvidenceBytes = 1048576
requireApprovalForActive = false
filterOutOfScopeMcpOutput = true
```

In manual mode, active calls require approval regardless of `requireApprovalForActive`. In authorized-auto mode, the setting can require approval for active calls as an additional control.

## Engagement configuration

```yaml
engagement:
  id: authorized-example
  name: Authorized Example Assessment
  authorizationConfirmed: true
  authorizationReference: TICKET-2026-1001
  mode: manual
  maxRequestsPerSecond: 2
  maxParallelRequests: 4
  allowHighRisk: false
  allowDestructive: false
  allow:
    - id: primary
      scheme: https
      host: app.example.test
      port: 443
      pathPrefix: /api
  deny:
    - id: reset
      host: app.example.test
      pathPrefix: /api/admin/reset
```

Deny rules are evaluated before allow rules. Wildcard hosts use the form `*.example.test` and do not include the parent host. Private IP targets require an exact host allow rule.
