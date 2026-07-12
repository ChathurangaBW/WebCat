---
name: auth-session-testing
description: Review authentication and session controls using controlled identity and state comparisons
whenToUse: When the objective references login, logout, password recovery, cookies, tokens, or account state
---

Map the complete authentication lifecycle before active testing. Compare authenticated, unauthenticated, expired, logged-out, and role-changed states. Use reversible requests and record a negative control. Keep credentials redacted. Submit a candidate only when the behavior is reproducible and the impact is distinct from a generic error-handling issue.
