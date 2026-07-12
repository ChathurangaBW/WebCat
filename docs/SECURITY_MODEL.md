# Security Model

## Trust boundaries

WebCat treats model output, MCP tool metadata, MCP responses, captured traffic, and skill text as untrusted input. Project configuration and operator approvals are privileged inputs.

## Enforced controls

- active operations require confirmed authorization;
- observe mode blocks active, high, and destructive operations;
- deny rules take precedence over allow rules;
- unknown active MCP capabilities require an explicit trusted mapping;
- active calls require absolute target URLs in arguments;
- manual mode requires operator approval for active calls;
- high and destructive operations require engagement policy and approval;
- request rate and parallelism are bounded;
- out-of-scope MCP records are filtered before model exposure;
- common credentials are redacted before persistence;
- evidence is hashed and audit records are hash chained;
- only validator and critic profiles can change finding validation status.

## Non-goals

WebCat cannot prove that an external MCP server faithfully applies its own controls. It cannot prevent an authorized external tool from performing behavior that is hidden behind a misleading tool implementation. Use only MCP servers you trust and review custom capability mappings.

## Sensitive data

Do not commit `.webcat` engagement state. Keep authentication tokens in environment variables. Leave upstream proxy-side sensitive-header redaction enabled unless the engagement explicitly requires otherwise.
