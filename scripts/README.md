# Maintenance scripts

Node 22, no dependencies. Run from anywhere inside the repository.

| Script | Purpose |
| --- | --- |
| `release.mjs` | Cut a plugin release: bump, changelog, validate, commit, tag. |
| `rollback.mjs` | Republish an earlier plugin tag as a new version, or redeploy the site from a known-good commit. |
| `check-english.mjs` | Fail on any non-Latin letters in tracked text files. |
| `lib.mjs` | Shared helpers, unit-tested in `lib.test.mjs` (`node --test scripts/*.test.mjs`). |

## Why releases need a script

Claude Code installs a plugin into a cache keyed by its version and only fetches a version it has not seen.
Two things follow.

- A change without a version bump never reaches anyone who already installed the plugin.
- Rolling back by lowering the version does not work either; a rollback is a new, higher version whose files are the old ones.

The scripts make both paths mechanical, and they keep `plugin.json` and the marketplace entry on the same version, which `claude plugin validate --strict` demands.

## release.mjs

```
node scripts/release.mjs <plugin-name> <patch|minor|major|x.y.z> [--push] [--dry-run]
```

What it does, in order:

1. Refuses to run off `main` (`--any-branch` overrides) or on a dirty tree (`--allow-dirty` overrides).
2. Reads `plugins/<name>/.claude-plugin/plugin.json` and the marketplace entry; stops if their versions differ.
3. Computes the new version and stops if the tag `<name>--v<version>` already exists.
4. Writes the version to both files and bumps the marketplace's own `version` (patch), so clients that watch it see a change. `--no-marketplace-bump` skips that.
5. Rotates `## Unreleased` in the plugin `CHANGELOG.md` into `## <version> - <date>`. An empty section stops the release unless `--allow-empty-changelog` is given.
6. Runs `claude plugin validate . --strict` and `node scripts/check-english.mjs`.
7. Commits `release(<name>): <version>` and tags with `claude plugin tag`, which re-checks that manifest and entry agree.
8. With `--push`, pushes the commit and the tag. Without it, prints the push commands.

`--dry-run` prints steps 3 to 5 and writes nothing.

## rollback.mjs, plugin mode

```
node scripts/rollback.mjs <plugin-name> [--to x.y.z] [--reason "text"] [--push] [--dry-run]
```

1. Picks the target: `--to`, or the highest release tag below the current version.
2. Removes `plugins/<name>/` and checks it out from the tag, so files added since the target disappear too.
3. Keeps the current `CHANGELOG.md` and adds a rollback line under `## Unreleased`.
4. Publishes the result as `current + patch` through the same path `release.mjs` uses: validate, commit `rollback(<name>): <new> restores <target>`, tag.

After a rollback, fix forward on `main` and release again.
The bad version stays in git history and in the changelog, which is intended.

## rollback.mjs, site mode

```
node scripts/rollback.mjs --site <git-ref> [--dry-run]
```

GitHub Pages serves whatever the last successful `deploy-pages.yml` run uploaded.
The script tags the given commit as `site-rollback-<timestamp>`, pushes the tag and dispatches the deploy workflow on it.
`main` is not rewritten; the next push to `main` deploys `main` again, so land the fix soon after.

Needs the GitHub CLI (`gh`) logged in with access to the repository.

## check-english.mjs

```
node scripts/check-english.mjs [path ...] [--json]
```

Scans tracked and untracked-but-not-ignored files with a text extension and reports every line that contains a letter outside the Latin script.
Accented Latin (`café`, `naïve`) passes; Cyrillic, Greek, CJK and so on fail.

Exceptions:

- `.englishcheckignore` at the root: exact path, `dir/` prefix, or `*.ext`, one per line with a comment saying why.
- `english-check: ignore` anywhere on a line exempts that line.

Exit code 1 on findings, so CI and the release script stop.
