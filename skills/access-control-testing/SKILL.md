---
name: access-control-testing
description: Evaluate object, tenant, and function authorization with paired controls
whenToUse: When testing identifiers, roles, tenants, ownership, or privileged functions
---

1. Identify the legitimate owner or permitted role.
2. Capture the expected authorized response as the positive control.
3. Use a separate identity or tenant for the negative control.
4. Change one authorization-relevant variable at a time.
5. Stop once a stable authorization difference is proven or disproved.
6. Record request and response evidence for both control and test.
7. Do not infer unauthorized impact from status code alone.
