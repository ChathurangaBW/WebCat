# Changelog

All notable changes to WebCat are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **Allow rules no longer fail open.** Every constraint in an allow rule was previously optional,
  so a rule with no `hosts`, an empty `hosts` array, or `hosts` given as a bare string instead of
  an array matched every target. A single-host engagement could silently become allow-all. Allow
  rules now require a non-empty `hosts` array, are validated when the engagement is loaded, and a
  malformed rule fails closed. Deny rules continue to match permissively so mistakes there also
  fail closed.
- **Untrusted tool descriptions can no longer downgrade risk.** Risk for unmapped MCP tools was
  inferred from the tool name *and* the server-supplied description, and the passive pattern
  matched substrings such as `history` or `scope` anywhere in that text. A tool named
  `exec_command` described as "Runs a command; see scope and history" was classified passive and
  executed with no target check, no approval, and no audited refusal. Classification is now based
  on an anchored match against the tool name, unmapped tools default to `active`, and the
  description may only escalate the assessed risk.
- **Rate limiting now holds under concurrency.** All in-flight callers read the same
  `lastRequest` timestamp and slept in parallel, so the configured rate applied per burst rather
  than per request (five concurrent calls at 6 req/min completed in 10s instead of 40s). Each
  caller now reserves its slot synchronously before awaiting.
- **Raw HTTP secrets are redacted.** Redaction matched sensitive object keys and a few inline
  patterns, but proxy tools return whole request/response strings, where `Cookie:`,
  `Authorization: Basic`, and bare JWTs were all written to evidence and audit files in
  plaintext. Header-line, auth-scheme, and JWT patterns have been added.
- **Every refusal class is audited.** Only scope failures produced an `mcp.blocked` record.
  Untrusted-tool, missing-target, approval, and concurrency refusals are now recorded on the
  hash chain with a `control` field before the error is raised.
- Added an opt-in `requireCapabilityMap` server setting that refuses any tool without an explicit
  `capabilityMap` entry, including otherwise-passive tools.

### Fixed

- Approval targets now honour the `**` glob documented in the README and Burp guide. Previously
  only a trailing single `*` was supported, so the documented
  `--target 'https://app.example.test/**'` matched nothing and the operation was refused.
- `filterOutOfScope` no longer discards an entire result tree when one nested URL is out of
  scope. A single CDN or analytics URL in proxy history previously collapsed the whole response
  to `undefined`, leaving agents reasoning from empty evidence with no signal. Only the
  offending subtree is pruned, and the number of removals is reported as `filteredOutOfScope`.
- CLI options accept the `--opt=value` form. `scope-check --operation=active` was silently
  parsed as `passive` and reported an allow verdict for the wrong risk class. Unknown options are
  now rejected instead of ignored.
- The TUI tokenizer preserves JSON arguments, so `mcp call ... --args '{"a":1}'` works.
- MCP configuration rejects an empty command or URL after `${VAR}` interpolation instead of
  failing later with an opaque spawn or fetch error, and requires an absolute http(s) URL.
- `webcat tui` exits cleanly on EOF instead of exiting 13 with an unsettled top-level await.
- A failed audit append no longer poisons the serialized queue for all later appends.
- Evidence truncation slices on a byte budget instead of characters, so `maxBodyBytes` is
  respected for multi-byte content, and reports `originalBytes`.
- `SessionStore.write` no longer mutates the caller's session object.
- MCP `clientInfo.version` reads from `IDENTITY` instead of a duplicated literal.

### Added

- `webcat mcp refresh [server]` drops cached tool listings so a long-running session picks up
  tools added after an MCP extension reload.
- `npm run test:coverage` enforces a line and branch coverage floor.
- `test/policy-regressions.test.mjs` covers each of the above with paired allow and deny cases.
- The integration smoke test now asserts refusals (out-of-scope target, mode violation, mistyped
  option, and the `--operation=` form) in addition to the successful workflow.

### Changed

- `npm run lint` performs dependency-free static analysis (floating promises on audit/evidence
  calls, stray debug output, empty catch blocks) in addition to the previous syntax check.
- Added Dependabot updates for GitHub Actions and npm. An expanded CI workflow (QA across
  Linux, macOS, and Windows on Node 22 and 24, plus CodeQL) is staged in `docs/ci/` for a
  maintainer to apply, since updating `.github/workflows/` requires the `workflows` permission.
- `package.json` declares `repository`, `bugs`, `homepage`, and `keywords`.
- Documentation corrected where it overstated behaviour: approval glob syntax, redaction
  coverage, rate-limit guarantees, and what `lint`/`typecheck` actually verify.

## [1.1.0]

- Native Burp MCP adapters and guarded agent tools.
