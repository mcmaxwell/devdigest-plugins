---
name: plugin-authoring
description: Use when adding or changing a plugin in the devdigest-plugins marketplace - creating a plugin folder, writing plugin.json, adding a skill, agent, command or hook, bumping a version, or preparing a release. Explains the layout, the naming rules, the English-only rule and the release flow.
---

# Authoring a plugin for devdigest-plugins

## Layout

Every plugin lives in `plugins/<plugin-name>/` and follows this shape:

```
plugins/<plugin-name>/
├── .claude-plugin/
│   └── plugin.json      # manifest: name, version, description, author
├── skills/<skill-name>/SKILL.md
├── agents/<agent-name>.md
├── commands/<command-name>.md
├── hooks/hooks.json
├── .mcp.json
├── CHANGELOG.md
└── README.md
```

Only create the component folders the plugin uses.
Component folders sit at the plugin root, never inside `.claude-plugin/`.

## Rules

- Names are kebab-case: the plugin folder, `plugin.json` `name`, skill folders, agent and command files.
- The plugin `name` must equal the folder name and the `name` of its entry in `.claude-plugin/marketplace.json`.
- A plugin name is immutable once published. Change `displayName` for a label change; a real rename goes through the `renames` map in `marketplace.json`.
- Never name a plugin `devdigest-plugins`, the marketplace name.
- All text is English: descriptions, skill bodies, READMEs, changelogs, comments. `node scripts/check-english.mjs` enforces it in CI.
- Every skill `description` says when to use the skill, in the words a user would type.
- Reference files inside the plugin with `${CLAUDE_PLUGIN_ROOT}`, never with absolute or working-directory-relative paths.
- Hook and MCP scripts must not persist state under `${CLAUDE_PLUGIN_ROOT}`; it changes on every update. Use `${CLAUDE_PLUGIN_DATA}`.

## Versioning and release

- `version` in `plugin.json` and in the marketplace entry must match. `claude plugin validate . --strict` fails otherwise.
- Claude Code caches a plugin by version. A change that ships without a version bump is invisible to installed copies.
- Record changes under `## Unreleased` in the plugin `CHANGELOG.md` as you go.
- Release with `node scripts/release.mjs <plugin-name> <patch|minor|major>`; it bumps both versions, rotates the changelog, validates, commits and tags `<plugin-name>--v<version>`.
- Roll back with `node scripts/rollback.mjs <plugin-name> --to <version>`; it restores the files from that tag and publishes them as a new, higher version, because a lower version does not propagate to installed copies.

## Before opening a pull request

```
claude plugin validate . --strict
node scripts/check-english.mjs
```
