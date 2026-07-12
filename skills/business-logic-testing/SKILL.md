---
name: business-logic-testing
description: Model workflow invariants and test reversible state transitions
whenToUse: When assessing pricing, ordering, limits, approvals, coupons, races, or multi-step state
---

Document the intended invariant before testing. Identify actors, prerequisites, state transitions, idempotency, and rollback behavior. Use a controlled test account and reversible operations. Distinguish a security-impacting invariant violation from a product enhancement or usability defect.
