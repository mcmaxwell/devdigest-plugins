# devdigest-plugins

Claude Code plugin marketplace. The catalogue is `.claude-plugin/marketplace.json`; each plugin lives in `plugins/<name>/`.
A static catalogue site for GitHub Pages is specified in `docs/specs/S01-marketplace-site.md` and is built under `site/`.

## Commands

```
claude plugin validate . --strict          # manifest + entries, warnings are errors
node scripts/check-english.mjs             # every text file must be English
node scripts/check-portable.mjs            # no origin-project names or paths in plugins, no duplicate skill names
node --test scripts/*.test.mjs                       # unit tests for the scripts
node scripts/release.mjs <plugin> patch    # cut a release (bump, changelog, commit, tag)
node scripts/rollback.mjs <plugin>         # republish the previous tag as a new version
node scripts/rollback.mjs --site <ref>     # redeploy the site from a known-good commit
```

## Rules

- `plugin.json` `version` and the marketplace entry `version` always match; only `scripts/release.mjs` changes them.
- A plugin name never changes after publishing. Use `displayName` for labels and the `renames` map in `marketplace.json` for a real rename.
- Plugins are portable: they never name the project they came from, its packages, folders or machine paths; they read the host project's CLAUDE.md instead.
- Everything is written in English. Exceptions are listed in `.englishcheckignore` with a reason.
- Component folders (`skills/`, `agents/`, `commands/`, `hooks/`) sit at the plugin root, never inside `.claude-plugin/`.
- Paths inside a plugin use `${CLAUDE_PLUGIN_ROOT}`; persistent state uses `${CLAUDE_PLUGIN_DATA}`.
- Do not edit `CHANGELOG.md` version headings by hand; add lines under `## Unreleased` and let the release script rotate them.
- Do not commit, tag or push on your own initiative. Leave changes for the maintainer to review.

## Read when

- adding or changing a plugin: `plugins/example-plugin/skills/plugin-authoring/SKILL.md`
- releasing or rolling back: `scripts/README.md`
- working on the site: `docs/specs/S01-marketplace-site.md`
- unsure how marketplaces behave: `docs/temp/claude-code-marketplace-guidelines.md`
