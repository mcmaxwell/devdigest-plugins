# Contributing

## Flow

1. Fork or branch from `main`.
2. Add or change a plugin under `plugins/<name>/`; keep the marketplace entry in `.claude-plugin/marketplace.json` in sync.
3. Note the change under `## Unreleased` in the plugin `CHANGELOG.md`. Do not bump versions in a feature branch; releases are cut from `main` with `scripts/release.mjs`.
4. Run the checks below and open a pull request.

## Checks

```
claude plugin validate . --strict
node scripts/check-english.mjs
node scripts/check-portable.mjs
node --test scripts/*.test.mjs
```

CI runs the same four commands on every push and pull request.

## Rules

- One plugin, one purpose. Split a plugin that needs a paragraph to describe.
- Plugin names are kebab-case, immutable once published, and never equal to `devdigest-plugins`.
- Every description says what the plugin does and when to use it, in the words a user would search for.
- Nothing in a plugin names the project it was ported from: no origin folder names, package names or machine paths. `node scripts/check-portable.mjs` enforces it, and a skill name may exist in one plugin only.
- English only, in every file. Deliberate exceptions (for example a non-English trigger phrase) go into `.englishcheckignore` with a comment explaining why.
- Scripts inside plugins reference their own files through `${CLAUDE_PLUGIN_ROOT}` and store state under `${CLAUDE_PLUGIN_DATA}`.
- No secrets, tokens or personal data anywhere in the repository.
- No top-level `bin/` folder in a plugin; use `scripts/`.
