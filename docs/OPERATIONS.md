# Operations

## Engagement lifecycle

```text
NEW
 -> AUTHORIZATION_REQUIRED or SCOPE_READY
 -> MCP_DISCOVERY
 -> PASSIVE_MAPPING
 -> ATTACK_SURFACE_READY
 -> HYPOTHESIS_GENERATION
 -> ACTIVE_VALIDATION when candidates exist
 -> FINDING_REVIEW
 -> REPORT_READY
 -> COMPLETED
```

A session may also enter `PAUSED`, `BLOCKED`, or `FAILED`.

## Project startup

```bash
webcat init
webcat doctor
webcat scope-check https://app.example.test/api --operation passive
webcat mcp status
```

Confirm the authorization reference and change the engagement mode only after the scope is correct.

## Approvals

```bash
webcat approvals grant \
  --risk active \
  --ttl 20m \
  --reason "Controlled object authorization comparison" \
  --server proxy \
  --tool send_request \
  --target 'https://app.example.test/api/*'

webcat approvals list
webcat approvals revoke apr_example
```

Approvals can be restricted by risk, MCP server, tool, and wildcard target pattern. They expire automatically and are evaluated at call time.

## Persistent data

```text
.webcat/
  config.toml
  engagement.yaml
  mcp.json
  audit.jsonl
  approvals.jsonl
  findings.jsonl
  hypotheses.jsonl
  state/
  evidence/
  reports/
```

Evidence payloads are stored separately from the evidence index. Audit records form a SHA-256 hash chain.

## Review workflow

```bash
webcat hypotheses list
webcat findings list
webcat findings show find_example
webcat evidence show ev_example
webcat audit verify
webcat report --format markdown
```

Only findings with `validated` status appear as confirmed findings in the Markdown report.

## Recovery

```bash
webcat sessions list
webcat sessions show session_example
webcat resume session_example
```

A resumed run reuses the existing session record and objective while creating new isolated agent conversations.
