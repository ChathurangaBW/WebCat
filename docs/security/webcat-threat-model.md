# WebCat Threat Model

**Version:** 0.1.0
**Date:** 2026-07-10
**Classification:** Public

## Scope

This threat model covers the WebCat application, its agent runtime, MCP integrations, and the data it processes. It follows a STRIDE-based methodology.

## Assets

| Asset | Sensitivity | Impact of Compromise |
|---|---|---|
| Engagement authorization records | High | Legal liability, unauthorized testing |
| Scope definitions | High | Scope bypass → unauthorized testing |
| Evidence artifacts | High | Tampering → invalid findings, legal risk |
| Redacted credentials | Critical | Credential theft → account compromise |
| MCP authentication tokens | Critical | Proxy/server compromise |
| Provider API keys | Critical | Financial cost, data exfiltration |
| Audit logs | High | Loss of non-repudiation |
| Findings and reports | High | Reputation damage, incorrect remediation |
| Agent prompts and context | Medium | Prompt injection → incorrect agent behavior |
| Session state | Medium | Session hijacking → unauthorized actions |

## Threat Actors

1. **Malicious MCP server** — A compromised or intentionally malicious MCP server
2. **Compromised web content** — Malicious HTTP responses processed by agents
3. **Insider threat** — Authorized user exceeding scope
4. **Network attacker** — MITM between WebCat and services
5. **Dependency attacker** — Compromised npm package

## Threats by STRIDE Category

### Spoofing

| ID | Threat | Severity | Mitigation |
|---|---|---|---|
| S-01 | Fake MCP server identity | High | Server fingerprint verification, TLS validation |
| S-02 | Spoofed authorization record | High | Digital signatures on authorization records |
| S-03 | Agent identity spoofing | Medium | Agent-to-agent authentication tokens |

### Tampering

| ID | Threat | Severity | Mitigation |
|---|---|---|---|
| T-01 | Evidence tampering | High | SHA-256 hashing, chain of custody, append-only audit |
| T-02 | Scope rule tampering | Critical | Immutable scope records, audit trail |
| T-03 | Audit log tampering | High | Append-only logs, integrity hashes |
| T-04 | Report tampering | Medium | Evidence references with hashes |
| T-05 | MCP tool schema manipulation | High | Schema validation before registration |

### Repudiation

| ID | Threat | Severity | Mitigation |
|---|---|---|---|
| R-01 | Agent denies sending traffic | High | Immutable audit trail with agent provenance |
| R-02 | Operator denies approval | High | Signed approval records |

### Information Disclosure

| ID | Threat | Severity | Mitigation |
|---|---|---|---|
| I-01 | Credential leakage in agent context | Critical | Central redaction service, encrypted evidence store |
| I-02 | Cross-engagement data leakage | High | Tenant isolation, engagement-scoped storage |
| I-03 | MCP output containing secrets | High | Redaction on MCP output ingestion |
| I-04 | Log injection revealing secrets | High | Secret scanning in log output |
| I-05 | Report containing raw secrets | High | Redaction in report generation |
| I-06 | Error messages exposing internals | Medium | Structured errors, no stack traces in production |
| I-07 | SSRF via MCP tools | High | Scope enforcement on all network operations |

### Denial of Service

| ID | Threat | Severity | Mitigation |
|---|---|---|---|
| D-01 | Uncontrolled fuzzing rate | High | Rate limits, payload budgets, concurrency caps |
| D-02 | Resource exhaustion via large responses | Medium | Body size limits, streaming chunk limits |
| D-03 | MCP server DoS blocking startup | Medium | Parallel startup, per-server timeouts, isolation |
| D-04 | Model context exhaustion | Medium | Compaction strategies, body truncation, evidence refs |

### Elevation of Privilege

| ID | Threat | Severity | Mitigation |
|---|---|---|---|
| E-01 | Scope bypass via redirects | Critical | Redirect target re-evaluation against scope |
| E-02 | DNS rebinding to internal hosts | Critical | DNS resolution tracking, private network protection |
| E-03 | Bypass via alternate ports | High | Port-aware scope rules |
| E-04 | Approval replay attack | High | Nonce-based approval tokens, time-bound validity |
| E-05 | Tool permission escalation | High | Tool allowlists, trust level enforcement |
| E-06 | Prompt injection → tool execution | High | Untrusted MCP output isolation, instruction boundaries |

## Specific Attack Vectors

### Prompt Injection via HTTP Content

**Vector:** An HTTP response body containing LLM instruction sequences is fed into the agent context.

**Impact:** Agent follows injected instructions instead of pentest workflow.

**Mitigation:**
- Redact or sanitize HTTP bodies before model context insertion
- Use evidence references instead of raw bodies
- Separate agent instructions from data in prompt structure
- Validate agent output against expected schema

### Prompt Injection via MCP Tools

**Vector:** A malicious MCP server returns tool results containing prompt injection payloads.

**Impact:** Agent behavior subverted, scope bypass, credential extraction.

**Mitigation:**
- Trust levels for MCP servers
- Sanitize MCP tool descriptions and output
- Scope enforcement wrappers on all MCP tools
- Never allow MCP output to override system instructions

### Malicious MCP Server

**Vector:** User connects a compromised MCP server that sends malicious tool schemas or results.

**Impact:** Arbitrary tool execution, credential theft, scope bypass.

**Mitigation:**
- Default to `untrusted` trust level
- Tool allowlist/blocklist
- Schema validation
- Risk classification of all discovered tools
- User approval for write/destructive tools

### Redirect Scope Bypass

**Vector:** An in-scope host redirects to an out-of-scope host.

**Impact:** Agent tests unintended targets.

**Mitigation:**
- Scope engine re-evaluates every redirect target
- All HTTP clients go through scope middleware
- Redirect chain is tracked and audited

### DNS Rebinding

**Vector:** A DNS name resolves to different IPs over time, one of which is internal.

**Impact:** Agent accesses internal network.

**Mitigation:**
- Track resolved IPs per hostname
- Detect IP changes across resolutions
- Block private/loopback/link-local IPs unless explicitly scoped

## Security Controls Matrix

| Control | Implementation | Status |
|---|---|---|
| Scope enforcement | `@webcat/scope-engine` middleware | Required |
| Credential redaction | `@webcat/shared` redaction service | Required |
| Audit logging | Server middleware, immutable store | Required |
| RBAC | `@webcat/auth` | Required |
| Tenant isolation | Engagement-scoped storage | Required |
| MCP trust levels | `@webcat/mcp-hub` trust system | Required |
| Evidence integrity | SHA-256 hashing, chain of custody | Required |
| CSRF protection | Secure cookies, CSRF tokens | Required |
| CSP headers | Server middleware | Required |
| Rate limiting | Scope engine, server middleware | Required |
| Input validation | Zod schemas on all inputs | Required |
| Output encoding | Vue.js auto-escaping, sanitization | Required |
| Secret scanning | Pre-commit hooks, CI pipeline | Required |
| Dependency scanning | CI pipeline | Required |
| SAST | oxlint, TypeScript strict | Required |
