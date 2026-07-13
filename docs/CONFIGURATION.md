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
