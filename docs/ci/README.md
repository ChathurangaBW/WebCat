# Proposed CI changes

`ci.proposed.yml` contains the reviewed CI workflow. It is staged here rather than applied to
`.github/workflows/ci.yml` because the automation that produced this branch does not hold the
GitHub `workflows` permission and the push is rejected otherwise.

To apply it, a maintainer can run:

```bash
cp docs/ci/ci.proposed.yml .github/workflows/ci.yml
git commit -am "Run QA across the supported platform matrix and add CodeQL"
```

## What changes

- **Platform matrix.** `src/paths.mjs` branches on `win32`, `darwin`, and Linux, and the
  `0o600`/`0o700` file modes behave differently per platform, but CI only ran `ubuntu-latest`.
  The proposed workflow runs the gate on Linux, macOS, and Windows against Node 22 and 24.
- **CodeQL.** Adds a JavaScript analysis job with `security-events: write`.

`.github/dependabot.yml` (weekly GitHub Actions and npm updates) is applied on this branch and
needs no extra permission.

Note that on Windows the POSIX permission bits WebCat sets when writing configuration, evidence,
approval, and audit files are not enforced by the filesystem; access control there depends on the
directory ACLs of the user profile.
