# devdigest-plugins

A Claude Code plugin marketplace: skills, agents, commands and hooks built around the DevDigest code review workflow.

## Install

```
/plugin marketplace add mcmaxwell/devdigest-plugins
/plugin install <plugin-name>@devdigest-plugins
```

Or browse the catalogue in `/plugin` under Discover.

## Plugins

| Plugin | What it does |
| --- | --- |
| `example-plugin` | Reference layout for new plugins; ships the `plugin-authoring` skill. |

## For teams

Pin the marketplace and the plugins your project uses in the project's `.claude/settings.json`.
Everyone who opens the repository gets the same set.

```json
{
  "extraKnownMarketplaces": {
    "devdigest-plugins": {
      "source": { "source": "github", "repo": "mcmaxwell/devdigest-plugins" }
    }
  },
  "enabledPlugins": {
    "example-plugin@devdigest-plugins": true
  }
}
```

## Repository layout

```
.claude-plugin/marketplace.json   # the catalogue: one entry per plugin
plugins/<name>/                   # one folder per plugin, see plugins/example-plugin
scripts/                          # release, rollback and English-only checks
docs/specs/                       # product specs (the marketplace site lives here first)
docs/temp/                        # research notes kept until the plugins exist, then deleted
site/                             # the GitHub Pages catalogue site (planned, see docs/specs)
.github/workflows/                # validate on every push and PR; deploy the site from main
```

## Developing a plugin

1. Copy `plugins/example-plugin` to `plugins/<name>` and edit the manifest, the components and the README.
2. Add an entry to `.claude-plugin/marketplace.json`; `name`, `version` and `description` must match `plugin.json`.
3. Write everything in English. `node scripts/check-english.mjs` fails on any other script.
4. Test locally: `claude --plugin-dir ./plugins/<name>`, or `/plugin marketplace add ./` inside Claude Code.
5. Validate before pushing: `claude plugin validate . --strict`.

Full rules: `plugins/example-plugin/skills/plugin-authoring/SKILL.md` and `CONTRIBUTING.md`.

## Releasing

Claude Code caches a plugin by its version, so a change without a version bump never reaches installed copies.
Releases go through the script, never by hand:

```
node scripts/release.mjs <plugin-name> patch        # or minor, major, or an exact x.y.z
node scripts/release.mjs <plugin-name> patch --push # also push the commit and the tag
```

The script bumps `plugin.json` and the marketplace entry together, rotates `## Unreleased` in the plugin changelog into the new version, validates, commits, and tags `<plugin-name>--v<version>`.

## Rolling back

A plugin is rolled back forward: the files from an earlier tag are published as a new, higher version.
Downgrading the version number would not propagate to users.

```
node scripts/rollback.mjs <plugin-name>                 # restore the previous tag
node scripts/rollback.mjs <plugin-name> --to 1.2.0      # restore a specific version
node scripts/rollback.mjs --site <git-ref>              # redeploy the site from a known-good commit
```

Details and dry-run flags: `scripts/README.md`.

## One-time setup for the site

GitHub Pages must be told to publish from Actions, once, after the first push:

```
gh api -X POST repos/mcmaxwell/devdigest-plugins/pages -f build_type=workflow
```

Or in the repository settings: Pages, Source, GitHub Actions.
The site then deploys on every push to `main` from `.github/workflows/deploy-pages.yml`.

## License

MIT, see `LICENSE`. Each plugin may carry its own license file.
