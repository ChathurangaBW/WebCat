# Security Policy

WebCat is for explicitly authorized security assessments only.

External operations are deny-by-default and must pass:

1. written authorization confirmation;
2. exact engagement scope evaluation;
3. trusted MCP capability classification;
4. engagement risk policy;
5. operator approval when required;
6. request-rate and parallelism limits.

Destructive operations are disabled unless both the engagement policy and an explicit operator approval permit them. Secrets are redacted before audit and evidence persistence. Do not commit API keys, session cookies, authorization headers, private evidence, or production engagement data.
