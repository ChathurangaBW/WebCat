# Security policy

WebCat is intended only for systems covered by explicit written authorization.

The runtime is deny-by-default. External MCP operations require a current authorization window, a concrete target, an allow-rule match, no deny-rule match, permitted engagement mode, permitted risk class, operator approval where required, and request-rate controls.

Report security defects privately to the repository owner. Do not include production credentials, session cookies, authorization headers, private evidence, or target data in public issues.

WebCat redacts common secret fields before writing logs, evidence, and audit records. This
covers sensitive object keys, raw HTTP header lines (`Cookie`, `Set-Cookie`, `Authorization`,
`Proxy-Authorization`, and common API-key headers), bearer/basic/digest credentials, bare JWTs,
and secret-bearing query parameters. Redaction is a defence-in-depth measure and not a
guarantee that every application-specific secret format is recognized; review stored evidence
before sharing it. Operators remain responsible for reviewing third-party MCP server behavior and storage.
