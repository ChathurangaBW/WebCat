# Release QA

The normal release gate is:

```bash
npm ci
npm run qa
npm pack --dry-run
```

`npm run qa` performs syntax linting, module contract checks, unit tests, production build, integration smoke tests, relocation and installed-command regressions, repository branding verification, and built-output branding verification.

The branding verifier scans filenames, directory names, and text content. It ignores only version-control metadata, dependency directories, test coverage, and temporary caches. Mandatory attribution is restricted to `THIRD_PARTY_NOTICES.md`.
