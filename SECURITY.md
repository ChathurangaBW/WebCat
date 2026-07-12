# Security policy

## Intended use

WebCat is intended only for web applications and APIs covered by explicit, current authorization. Do not use it against public targets, third-party infrastructure, or data outside the written engagement scope.

## Reporting a vulnerability in WebCat

Do not disclose a WebCat vulnerability in a public issue if it could expose credentials, bypass scope controls, corrupt evidence, or permit unintended external actions. Contact the repository owner privately through GitHub first.

Include:

- affected commit or version;
- reproduction steps;
- expected and actual policy behavior;
- whether the issue can bypass scope, approvals, redaction, or audit integrity;
- a minimal patch or mitigation when available.

## Security invariants

Changes must preserve these invariants:

- no active external call without a concrete target;
- deny rules override allow rules;
- wildcard hosts do not match sibling or lookalike domains;
- expired or placeholder authorization blocks execution;
- model output cannot bypass the gateway;
- untrusted MCP output is never inserted as system instructions;
- evidence redaction occurs before persistence;
- candidates are not promoted without validation;
- destructive operations remain disabled unless explicitly enabled and approved;
- audit-chain verification detects mutation.
