# Security policy

WebCat is intended only for systems covered by explicit written authorization.

The runtime is deny-by-default. External MCP operations require a current authorization window, a concrete target, an allow-rule match, no deny-rule match, permitted engagement mode, permitted risk class, operator approval where required, and request-rate controls.

Report security defects privately to the repository owner. Do not include production credentials, session cookies, authorization headers, private evidence, or target data in public issues.

WebCat redacts common secret fields before writing logs, evidence, and audit records. Operators remain responsible for reviewing third-party MCP server behavior and storage.
