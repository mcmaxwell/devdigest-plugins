# site

The catalogue site: a static Astro build published to GitHub Pages from `.github/workflows/deploy-pages.yml`.
Nothing runs at request time.

```
repository  ->  scripts/build-catalog.mjs  ->  public/catalog.json, search-index.json, feed.xml, llms.txt, robots.txt
            ->  astro build                ->  dist/  (one HTML page per artifact, collection and list)
```

`site/` is self-contained: its own `package.json`, lock file and `node_modules`.
It only reads the marketplace (`../.claude-plugin/marketplace.json`, `../plugins/`) at build time and never writes outside itself.
Nothing under `site/` is a plugin, and `claude plugin validate` ignores it.

## How indexing works

There is no live index.
The indexer runs at build time and writes the catalogue into `public/`, so the browser only ever loads static JSON.

1. It starts from `marketplace.json` and walks every entry with a relative `source`.
   A folder under `plugins/` with no entry is skipped and named in the build log.
   An entry with an external source (`github`, `git-subdir`, `url`) gets a plugin card from the entry alone and no component artifacts.
2. For each plugin it reads `plugin.json`, every `skills/*/SKILL.md`, `agents/*.md`, `commands/*.md`, `hooks/hooks.json`, `.mcp.json` and `CHANGELOG.md`, and takes the last commit date of each path from git.
3. It writes one record per artifact into `catalog.json`, the search index into `search-index.json`, the release feed, `llms.txt` and `robots.txt`.
4. Astro then renders one HTML page per artifact, collection and list from the same records.

Re-indexing is automatic: every push to `main` runs the workflow, so adding or changing a plugin needs no manual step beyond the marketplace entry.
The site is stale only for the minutes the workflow takes.
Locally, `npm run dev` watches `../plugins` and `../.claude-plugin` and rebuilds the catalogue on change.

## Where the build runs

- On GitHub Actions, Ubuntu runner, in the "Site" workflow. The "Build site" job runs on every pull request and every push to `main`; the "Deploy to GitHub Pages" job runs after it on `main` only.
- The marketplace checks (`claude plugin validate`, English and portability checks, script tests) live in the separate "Validate" workflow, so a site failure and a marketplace failure show as different checks.
- Locally with `npm run build`, which produces `dist/` exactly as the workflow does.

## GitHub Pages

- Published from Actions, not from a branch. One-time setup: repository Settings, Pages, Source: GitHub Actions, or `gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`.
- URL: `https://<owner>.github.io/<repo>/`. The sub-path comes from `SITE_BASE_URL` in the workflow; every link, asset and fetch is built relative to it (`import.meta.env.BASE_URL`). A custom domain changes only that variable.
- `public/.nojekyll` keeps Pages from touching `_astro/`; `404.astro` becomes `404.html`, which Pages serves for unknown paths.
- Endpoints stay at fixed paths under the root: `/catalog.json`, `/search-index.json`, `/feed.xml`, `/llms.txt`, `/robots.txt`, `/sitemap-index.xml`.

## Local development

```
cd site
npm install
npm run dev          # builds the catalogue, watches ../plugins and ../.claude-plugin, runs Astro on http://localhost:4321/
```

`npm run build` produces `dist/`; `npm run preview` serves it.
Set `SITE_BASE_URL=https://mcmaxwell.github.io/devdigest-plugins` to reproduce the Pages sub-path locally.

## Layout

| Path | Role |
| --- | --- |
| `scripts/build-catalog.mjs` | Indexer. Starts from `marketplace.json`, reads manifests, frontmatter, `hooks.json`, `.mcp.json`, changelogs and git dates. Fails the build on a bad collection. |
| `scripts/search-config.mjs` | Shared search rules: field boosts, prefix, fuzzy (edit distance 1 for words of five letters or more), stop words, type words. Used by the indexer and the browser. |
| `scripts/dev.mjs` | Local server with catalogue rebuilds on change. |
| `collections.json` | Hand-maintained collections; validated at build time. |
| `synonyms.json` | Query-term synonyms, English only. |
| `src/pages/` | `index` (search), `a/[...id]` (artifact), `collections/`, `new`, `favourites`, `settings`, `404`. |
| `src/components/` | `Card.tsx` (static and live), islands: `Search`, `Palette`, `SettingsGenerator`, `Favourites`. |
| `src/scripts/enhance.ts` | Theme, interface strings, copy buttons, favourites, recents, offline notice, Cmd+K. |
| `src/i18n/` | One locale file per language (`en.json` today). Components never carry interface strings; they read the dictionary, and static markup carries `data-t` keys so a future locale can swap text in the browser. |
| `src/styles/global.css` | Design tokens, dark-first, plus the component classes. |

## Interface strings

Every user-facing string lives in `src/i18n/en.json`.
Components and pages call `t('key')` or mark elements with `data-t="key"`; none of them contain literal interface text.
Adding a language means adding one JSON file with the same keys and listing it in `src/i18n/index.ts`; nothing else changes.
The repository itself stays English, so translation files for other languages would need an entry in `.englishcheckignore`.

## Not done yet

- `public/og/default.png` is a single placeholder; per-artifact Open Graph images (AC-41) need a build step (for example `satori` + `resvg`).
- Pagination past fifty cards shows a count, not pages.
- Lighthouse and bundle-size budgets are not enforced in CI yet.
