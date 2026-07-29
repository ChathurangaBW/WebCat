# Configuration

Project files live under `.webcat`:

- `config.toml`
- `engagement.json`
- `mcp.json`

User configuration uses the platform-specific WebCat configuration directory. Project configuration overrides user configuration by section and key.

## Environment variables

- `WEBCAT_HOME`: isolated root containing config, state, cache, and data directories
- `WEBCAT_CONFIG_HOME`: configuration-directory override
- `WEBCAT_LOG_LEVEL`: `debug`, `info`, `warn`, or `error`
- `WEBCAT_LOG_FILE`: exact log-file override
- `WEBCAT_DISABLE_UPDATE_CHECK`: reserved for distribution integrations

MCP JSON values support `${VARIABLE}` interpolation. Diagnostics redact configured header values and token-like fields.

## Example files

The repository ships reference copies of each configuration file:

- [`.webcat/config.example.toml`](../.webcat/config.example.toml)
- [`.webcat/engagement.example.json`](../.webcat/engagement.example.json)
- [`.webcat/mcp.example.json`](../.webcat/mcp.example.json)

`webcat init` generates equivalent files in a new project directory.

## Allow-rule requirements

Every entry in `allow` must be an object with a non-empty `hosts` array. Optional `schemes`,
`paths`, `operations`, and `ports` must also be non-empty arrays when present. A rule that omits
`hosts`, supplies an empty array, or supplies a bare string is rejected when the engagement is
loaded rather than being treated as a wildcard, and `webcat doctor` reports the offending rule.

Deny rules are matched permissively on purpose: a malformed constraint in a deny rule is treated
as matching, so a mistake there fails closed as well.

## MCP server variables

`${VAR}` placeholders in `.webcat/mcp.json` are interpolated from the environment. An unresolved
placeholder collapses to an empty string and is rejected at load time, so an unexported variable
surfaces as a clear configuration error instead of an obscure spawn failure later.

Set `requireCapabilityMap = true` on a server to refuse any tool that has no explicit
`capabilityMap` entry, including tools that would otherwise be classified as passive.
