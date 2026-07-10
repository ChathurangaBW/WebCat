# Security Policy

## Authorized Use Only

WebCat is an **authorized security-testing platform**. It must only be used to test systems for which you have explicit, written authorization.

Using WebCat to test systems without authorization is illegal and violates the platform's terms of use.

## Scope Enforcement

WebCat implements mandatory scope enforcement:
- Every network operation is checked against the engagement's scope rules
- Unknown targets are denied by default
- Deny rules take precedence over allow rules
- Redirects are re-evaluated against scope
- Private network addresses are blocked unless explicitly scoped

## Reporting a Vulnerability

If you discover a security vulnerability in WebCat itself, please report it by opening a GitHub issue with the `security` label.

## Security Controls

WebCat implements:
- RBAC (Role-Based Access Control)
- Tenant and workspace isolation
- Secret redaction from logs, prompts, and outputs
- Immutable audit logging
- Evidence integrity hashing
- MCP trust levels
- Rate limiting and concurrency controls
- Secure default headers (CSP, X-Frame-Options, X-Content-Type-Options)
