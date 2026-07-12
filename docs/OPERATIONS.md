# WebCat Operations

## Engagement lifecycle

`NEW -> AUTHORIZATION_REQUIRED -> SCOPE_READY -> MCP_DISCOVERY -> PASSIVE_MAPPING -> ATTACK_SURFACE_READY -> HYPOTHESIS_GENERATION -> ACTIVE_VALIDATION -> FINDING_REVIEW -> REPORT_READY -> COMPLETED`

A session may also enter `PAUSED`, `BLOCKED`, or `FAILED`.

## Modes

- `observe` — passive/read-only agents and tools only
- `manual` — active testing is available through operator commands and approvals
- `authorized-auto` — the swarm may perform active operations inside scope; high and destructive operations still require policy and approval

## Persistent data

```text
.webcat/
  config.toml
  engagement.yaml
  mcp.json
  audit.jsonl
  findings.jsonl
  hypotheses.jsonl
  approvals.jsonl
  state/
  evidence/
  reports/
```

## Approval examples

```bash
webcat approvals grant --risk high --ttl 30m --reason "Approved scanner pass"
webcat approvals grant --server proxy --tool replay_request --ttl 15m --reason "Controlled authorization validation"
webcat approvals list
webcat approvals revoke <approval-id>
```

Approvals expire automatically and are checked at execution time.
