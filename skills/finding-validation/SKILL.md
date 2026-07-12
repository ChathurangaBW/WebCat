---
name: finding-validation
description: Independently reproduce or disprove a candidate security issue
---

Validation procedure:

1. reconstruct the preconditions from saved evidence;
2. repeat the smallest safe test using an independent agent context;
3. execute a negative control where possible;
4. record exact request, response, actor, target, and timestamps;
5. return one decision: validated, rejected, needs-more-evidence, duplicate-root-cause, or severity-downgraded.
