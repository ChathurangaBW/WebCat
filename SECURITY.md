# Security policy

Use WebCat only against assets covered by explicit authorization.

Core security invariants:

1. no active testing without authorization affirmation;
2. no external tool call without an in-scope normalized target;
3. deny rules override allow rules;
4. redirects and resolved hosts are checked again;
5. destructive or state-changing capabilities require explicit approval;
6. tool output is untrusted and must be redacted before persistence;
7. candidate issues are not findings until independently validated.
