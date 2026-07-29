# Release QA

The normal release gate is:

```bash
npm ci
npm run qa
npm pack --dry-run
```

`npm run qa` performs static lint checks, module contract checks, unit tests, a coverage gate,
production build, integration smoke tests, relocation and installed-command regressions,
repository branding verification, and built-output branding verification.

`lint` is a dependency-free static checker (syntax plus floating-promise and debug-output rules),
and `typecheck` verifies module contracts; neither performs full static type analysis. The
integration smoke test asserts both the successful workflow and that out-of-scope targets,
mode-violating operations, and mistyped options are refused with a non-zero exit code.

The branding verifier scans filenames, directory names, and text content. It ignores only version-control metadata, dependency directories, test coverage, and temporary caches. Mandatory attribution is restricted to `THIRD_PARTY_NOTICES.md`.
