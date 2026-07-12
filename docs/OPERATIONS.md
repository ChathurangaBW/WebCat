# Operations

## Recommended workflow

1. Run `webcat init`.
2. Replace all authorization placeholders.
3. Add exact allow and deny rules.
4. Start in `observe` mode.
5. Configure and enable one MCP server.
6. Run `webcat doctor`.
7. Run `webcat mcp status --connect`.
8. Use passive mapping objectives.
9. Review hypotheses and evidence.
10. Change to `manual` only when bounded active validation is authorized.
11. Grant short-lived, narrowly scoped approvals.
12. Verify evidence and audit integrity before reporting.

## Approvals

Prefer the narrowest approval:

```bash
webcat approvals grant \
  --risk active \
  --ttl 10m \
  --capability http.execute \
  --server caido \
  --tool send_request \
  --reason "Validate object authorization using two test accounts"
```

Revoke it immediately after the validation step.

## Incident response

If an operation appears out of scope:

1. stop the MCP server;
2. switch the engagement to `observe`;
3. revoke active approvals;
4. preserve `.webcat/audit.jsonl`;
5. run `webcat audit verify`;
6. inspect redacted evidence and the relevant authorization rules.
