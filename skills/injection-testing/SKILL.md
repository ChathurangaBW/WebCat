---
name: injection-testing
description: Evaluate input-handling hypotheses with minimal, non-destructive probes and response controls
whenToUse: When user-controlled input reaches interpreters, templates, queries, headers, paths, or parsers
---

Use the smallest reversible input necessary to test a hypothesis. Pair every probe with a neutral control. Prefer response comparison, parsing differences, and deterministic behavior over broad payload spraying. Do not use destructive statements, persistence, denial-of-service techniques, or out-of-band interactions unless separately authorized by the engagement policy.
