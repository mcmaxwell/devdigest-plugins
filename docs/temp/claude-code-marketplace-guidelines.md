# Claude Code plugin marketplaces: how they work and how to run one

Temporary research note.
It distils the official Claude Code documentation, the layout of Anthropic's own marketplace as cloned on this machine, and what marketplace maintainers report in the field.
Delete it once the first real plugins exist and the rules below have moved into `CONTRIBUTING.md` and the `plugin-authoring` skill.

Verified against Claude Code 2.1.259 on 2026-09-02.
The plugin system is young and moves fast; re-check the linked pages before relying on a version-gated field.

## 1. What a marketplace repository is

A marketplace is a git repository, a directory, or a bare URL that serves one file: `.claude-plugin/marketplace.json`.
That file is a catalogue.
Each entry names a plugin and says where its files come from.
Claude Code clones the marketplace, reads the catalogue, and installs plugins into a version-keyed cache under `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`.

Minimal shape:

```
my-marketplace/
├── .claude-plugin/
│   └── marketplace.json
└── plugins/
    └── my-plugin/
        ├── .claude-plugin/plugin.json
        └── skills/my-skill/SKILL.md
```

Rules that trip people up first:

- `marketplace.json` lives in `.claude-plugin/` at the repository root, nowhere else.
- Plugin component folders (`skills/`, `agents/`, `commands/`, `hooks/`) sit at the plugin root, never inside the plugin's `.claude-plugin/`.
- Relative sources start with `./` and resolve from the marketplace root, not from `.claude-plugin/`.

## 2. marketplace.json

Top level:

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | kebab-case, globally unique, never equal to a plugin name (see section 5) |
| `owner` | yes | `{ name, email?, url? }` |
| `plugins` | yes | the entries; `--strict` validation fails on an empty list |
| `description`, `version` | no | the top-level `version` is rarely bumped by Anthropic; plugin versions drive updates |
| `metadata.pluginRoot` | no | prefix for bare plugin sources, e.g. `"pluginRoot": "./plugins"` lets an entry say `"source": "my-plugin"` |
| `renames` | no | `{ "old-name": "new-name" }` or `{ "removed": null }`; installed copies migrate on their next sync |
| `allowCrossMarketplaceDependenciesOn` | no | which other marketplaces plugins here may depend on |
| `$schema` | no | Anthropic's own file uses `https://anthropic.com/claude-code/marketplace.schema.json`; the docs also show `https://code.claude.com/schemas/marketplace.json` |

Plugin entry:

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | kebab-case, unique in the marketplace, immutable once published |
| `source` | yes | string (relative path) or object, see section 3 |
| `description`, `version`, `author`, `homepage`, `repository`, `license`, `keywords`, `category`, `tags`, `displayName` | no | entry values override `plugin.json` for display |
| `strict` | no | default `true`: `plugin.json` is authoritative for components. `false` lets the entry declare `skills`, `commands`, `agents`, `hooks`, `mcpServers`, `lspServers` for a source that has no manifest |
| `skills`, `commands`, `agents`, `hooks`, `mcpServers`, `lspServers` | no | component overrides, relative to the plugin root, each starting with `./` |
| `relevance` | no | suggestion signals: `topic`, `signals.cli`, `signals.filesRead`, `signals.cwd`, `signals.hosts`, `signals.manifestDeps` |
| `headers`, `headersHelper` | no | auth for archive and URL sources; the helper needs `strict: false` |

How Anthropic's own catalogue uses these fields, counted on the local clone of `claude-plugins-official` (291 entries):

| Pattern | Count |
| --- | --- |
| `source` as relative path (`./plugins/...` 38, `./external_plugins/...` 15) | 53 |
| `source.source = "url"` with a pinned `sha` | 153 |
| `source.source = "git-subdir"` with `path`, `ref` and `sha` | 85 |
| entries with `version` | 14 |
| entries with `strict: false` | 14 |
| entries declaring `skills` inline (skill bundles without a manifest) | 3 |
| entries with `lspServers` | 12 |
| entries with `keywords` | 1 |
| entries with `displayName` | 7 |
| entries with `tags` (`community-managed`) | 3 |

Two things stand out.
Almost every external entry is pinned to a commit `sha`, and a CI job moves the pins.
Almost no entry carries a `version`; the sha is the version.

## 3. Source types

| `source` | Use when | Shape |
| --- | --- | --- |
| relative path | plugin lives in this repository | `"./plugins/name"` |
| `github` | plugin has its own GitHub repository | `{ "source": "github", "repo": "owner/repo", "ref"?: "main", "sha"?: "..." }` |
| `url` | any git host, HTTPS, ends in `.git` | `{ "source": "url", "url": "https://gitlab.com/x/y.git", "ref"?, "sha"? }` |
| `git-subdir` | plugin is a folder of another repository | `{ "source": "git-subdir", "url": "...git", "path": "plugins/x", "ref"?, "sha"? }` |
| `npm` | plugin is published to npm | `{ "source": "npm", "package": "@org/x", "version": "1.2.3", "registry"? }` |
| `archive` | zip on an HTTPS server | `{ "source": "archive", "url": "https://.../x.zip", "sha256": "..." }`, max 256 MiB and 20,000 entries |
| `command` | a local tool prints the plugin path | `{ "source": "command", "command": "...", "timeout"?, "mode": "copy" or "link" }`, Claude Code 2.1.229+ |

Relative paths only work when the marketplace was cloned.
A marketplace added by a bare URL to `marketplace.json` downloads that one file, so every relative source in it fails; use `github`, `url`, `git-subdir`, `archive` or `npm` there.

A plain `github` source of a big monorepo clones the whole repository on every install.
`git-subdir` clones sparsely; prefer it for anything inside a large repository.

## 4. The plugin itself

```
plugin-name/
├── .claude-plugin/plugin.json   # name, version, description, author, ...
├── skills/<name>/SKILL.md       # always scanned, custom paths add to it
├── agents/<name>.md
├── commands/<name>.md           # a custom `commands` path replaces this folder
├── hooks/hooks.json
├── .mcp.json
├── scripts/                     # never a top-level bin/, it is blocked for org distribution
├── CHANGELOG.md
└── README.md
```

`plugin.json` is optional when the default folders are enough.
It is required to carry a `version`, dependencies, `userConfig`, `defaultEnabled`, custom component paths, or inline hooks and MCP servers.

Precedence when the marketplace entry and `plugin.json` disagree: the entry wins for display fields and component paths; `plugin.json` alone defines `dependencies`, `defaultEnabled` and `userConfig`.
`claude plugin validate` warns when the two versions differ, and `--strict` turns that into a failure.

Paths inside a plugin go through `${CLAUDE_PLUGIN_ROOT}`.
That directory changes on every update, so state belongs under `${CLAUDE_PLUGIN_DATA}`.
The docs steer new plugins to `skills/` with `SKILL.md` rather than flat `commands/*.md`.

## 5. Names

- Marketplace and plugin names are kebab-case.
- Installed identity is `plugin@marketplace`, for example `example-plugin@devdigest-plugins`; skills register as `plugin:skill`.
- Reserved marketplace names: `claude-code-marketplace`, `claude-code-plugins`, `anthropic-plugins`, and anything impersonating an official source.
- A plugin name is immutable after publishing: renaming breaks installed copies with `plugin-not-found`. Use `displayName` for labels and the `renames` map for a real rename (Anthropic's README states this rule explicitly).
- Never give a plugin the same name as its marketplace. The installer stages under the plugin name and renames under the marketplace name; equal names collide and fail with `EXDEV` on Linux tmpfs (anthropics/claude-code#24389).
- Two repositories declaring the same marketplace `name` silently overwrite each other in `known_marketplaces.json` (anthropics/claude-code#44042). Pick a name nobody else would.

## 6. Hosting and distribution

Adding a marketplace, all equivalent:

```
/plugin marketplace add owner/repo            # GitHub shorthand
/plugin marketplace add owner/repo@v2.0       # pinned branch or tag
/plugin marketplace add https://gitlab.com/team/plugins.git
/plugin marketplace add https://example.com/marketplace.json   # file only, no relative sources
/plugin marketplace add ./my-marketplace      # local, for testing
```

Team distribution through the project's `.claude/settings.json`:

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

`extraKnownMarketplaces` is an object keyed by marketplace name, not an array; one popular tutorial shows an array and is wrong.
A `directory` source with a relative path in `extraKnownMarketplaces` does not resolve (anthropics/claude-code#23978); a checked-in settings file cannot bootstrap a marketplace from `./`.
Managed settings add `strictKnownMarketplaces` (allowlist, supports `owner/*`, empty array locks everything) and `pluginSuggestionMarketplaces`.

Private repositories: the docs describe `GITHUB_TOKEN`, `GITLAB_TOKEN`, `BITBUCKET_TOKEN` and a `gh auth token` fallback, but three open issues (#17201, #18137, #49694) say this is unreliable.
The dependable rule is: if `git clone` works in the user's terminal with their credential helper or SSH key, it works for Claude Code.

## 7. Versions, caches and updates

This is the part that decides how the release process must look.

- Claude Code caches a plugin by version and fetches only a version it has not seen. A change without a version bump is invisible to installed copies.
- Bump the plugin `version` on every release, in `plugin.json` and in the marketplace entry, or omit `version` entirely and let the resolved commit act as the version.
- A lower version does not propagate. A rollback is a new, higher version whose files are the old ones.
- Dependencies with ranges resolve against git tags named `{plugin-name}--v{version}`. `claude plugin tag --push` creates them and checks that `plugin.json` and the entry agree.
- Update checks run shortly after a session starts. A running session keeps what it loaded until `/reload-plugins` or a restart.
- Several issues (#16866, #17361, #29071, #36317, #44276, #72616) report that the cached marketplace clone is not always fast-forwarded before an install. Tell users to run `/plugin marketplace update devdigest-plugins` when they do not see a release.
- Anthropic's community marketplace pins every external entry to a `sha` and moves the pins by CI. Pinning to a sha rather than a tag is the deterministic choice for team rollout; tags move, commits do not.

## 8. Validation and testing

```
claude plugin validate .                 # marketplace: JSON, duplicates, path traversal, entry vs plugin.json
claude plugin validate . --strict        # warnings are errors; use in CI
claude plugin validate ./plugins/x       # one plugin: manifest, skills, agents, commands
claude --plugin-dir ./plugins/x          # run Claude Code with the plugin loaded, no marketplace needed
/plugin marketplace add ./               # register the working copy inside Claude Code
claude plugin details x@devdigest-plugins   # component inventory and projected token cost
claude plugin eval ./plugins/x           # run evals/ cases against the plugin
```

`claude plugin validate` works without a logged-in account, so it runs in CI after `npm install -g @anthropic-ai/claude-code`.
It does not validate skill bodies for quality; it checks structure and frontmatter.

## 9. What maintainers do in the field

Two repository shapes dominate.

- Monorepo with a `plugins/` folder and relative sources: Anthropic's bundled marketplace, wshobson/agents (about 90 plugins, one source of truth that also generates artifacts for other tools), davila7/claude-code-templates.
- Thin index that points at sibling repositories: obra/superpowers-marketplace holds only `marketplace.json` and a README, and references `obra/superpowers`, `obra/the-elements-of-style`, and others by `github` source.

Anthropic's official marketplace mixes both: `plugins/` for internal plugins, `external_plugins/` for partner plugins vendored in, and `url` or `git-subdir` sources with sha pins for everything else.
Its README carries a reference plugin at `plugins/example-plugin`, a "plugin names are immutable" section, and a "skill-bundle plugins" section showing `strict: false` plus an explicit `skills` array for repositories that ship `SKILL.md` files without a manifest.

Hygiene that recurs across the good repositories:

- MIT license at the root and per plugin.
- A README with install commands, a plugin table, the repository layout, a contributing flow, and a security notice that plugins run trusted code in the user's session.
- A CI workflow that runs `claude plugin validate --strict` on every push and pull request (ivan-magda/claude-code-plugin-template).
- Per-plugin `CHANGELOG.md` in Keep a Changelog form; conventional commits and Release Please where releases are frequent (Nagell/claude-marketplace-template).
- Small, single-purpose plugins with names that read as a search query.
- Some maintainers run `stable` and `canary` marketplaces that point at different pinned commits.
- `CLAUDE_CODE_PLUGIN_SEED_DIR` bakes plugins into a CI image to avoid GitHub rate limits during builds.

Known platform problems to design around, not assume away:

- Windows: `~\.claude` path collapse and `EPERM` on rename during install (#52435); WSL2 stray directories from backslash paths (#26517). Keep scripts in Node rather than bash so they run on every platform.
- Full clones on plain `github` sources (#40864). Use `git-subdir` for anything inside a large repository.
- A manifest that references files that do not exist ships silently until a user hits it (davila7/claude-code-templates#124). Validate in CI.
- No signing of plugins exists. Auto-update from a marketplace is trust in its maintainers; say so in the README.

## 10. Decisions taken for devdigest-plugins

| Decision | Reason |
| --- | --- |
| Monorepo, plugins under `plugins/`, relative sources | one place to validate, one CI, one changelog per plugin; the catalogue site indexes the working tree without cloning anything |
| Marketplace name `devdigest-plugins`, repository `mcmaxwell/devdigest-plugins` | globally distinctive; the same string as the repository so `/plugin marketplace add mcmaxwell/devdigest-plugins` reads naturally |
| No plugin may be named `devdigest-plugins` | staging-path collision in the installer |
| `version` in both `plugin.json` and the entry, always equal, changed only by `scripts/release.mjs` | strict validation demands equality; the version is what makes an update visible |
| Tags `<plugin>--v<version>` on every release via `claude plugin tag` | dependency ranges resolve against them; they are also the rollback targets |
| Rollback republishes an old tag as `current + patch` | lower versions do not propagate |
| Marketplace top-level `version` bumped by patch on each release | cheap signal for clients that watch it; disabled with `--no-marketplace-bump` |
| English-only enforced by `scripts/check-english.mjs` in CI | the audience and the search index are English; a mixed-language catalogue searches badly |
| Node scripts, no bash | Windows contributors |
| `example-plugin` kept in the catalogue | `--strict` refuses an empty catalogue; it doubles as the contributor template, as in Anthropic's repository |
| Site deploys from `main` by Actions; rollback dispatches the deploy workflow on a tag | no history rewriting, `main` stays the source of truth |

## 11. Sources

Official documentation:

- https://code.claude.com/docs/en/plugin-marketplaces
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/plugins-reference
- https://code.claude.com/docs/en/plugin-dependencies
- https://code.claude.com/docs/en/plugin-relevance
- https://code.claude.com/docs/en/discover-plugins

Anthropic repositories:

- https://github.com/anthropics/claude-plugins-official (local clone inspected under `~/.claude/plugins/marketplaces/claude-plugins-official`)
- https://github.com/anthropics/claude-plugins-community
- https://github.com/anthropics/claude-code/blob/main/.claude-plugin/marketplace.json

Community repositories and posts:

- https://github.com/wshobson/agents
- https://github.com/obra/superpowers-marketplace
- https://github.com/davila7/claude-code-templates
- https://github.com/ivan-magda/claude-code-plugin-template
- https://dev.to/nagell/build-your-own-claude-code-marketplace-scaffold-structure-and-auto-updates-4n3f
- https://github.com/hesreallyhim/awesome-claude-code

Issues cited: anthropics/claude-code #16866, #17201, #17361, #18137, #23978, #24389, #26517, #29071, #36317, #36575, #40864, #44042, #44276, #45266, #49694, #52435, #72616; obra/superpowers #355; davila7/claude-code-templates #124.
Issue numbers other than #16866, #23978, #24389, #40864, #44042 and #52435 were confirmed by title only.
