#!/usr/bin/env node
// Indexer: repository -> public/catalog.json, search-index.json, feed.xml, llms.txt, robots.txt.
// Runs before `astro build` (see package.json). Fails loudly; a failed build keeps the previous deployment live.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import MiniSearch from 'minisearch';
import { MINISEARCH_OPTIONS, SCHEMA_VERSION } from './search-config.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(SITE, '..');
const OUT = join(SITE, 'public');
const SITE_URL = (process.env.SITE_BASE_URL ?? 'http://localhost:4321').replace(/\/$/, '');
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const STALE_DAYS = 180;

const fail = (msg) => { console.error(`build-catalog: ${msg}`); process.exit(1); };
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const exists = (p) => existsSync(p);
const sh = (cmd) => { try { return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };

const commit = sh('git rev-parse HEAD') || 'unknown';
const shortSha = commit.slice(0, 7);
const repoSlug = (() => {
  const url = sh('git config --get remote.origin.url');
  const m = url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
  return m ? m[1] : 'mcmaxwell/devdigest-plugins';
})();
const sourceUrl = (p) => `https://github.com/${repoSlug}/blob/${commit}/${p}`;

let dateFallbacks = 0;
function lastCommitDate(relPath) {
  const d = sh(`git log -1 --format=%cs -- "${relPath}"`);
  if (d) return { date: d, fallback: false };
  dateFallbacks++;
  return { date: BUILD_DATE, fallback: true };
}
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

const marketplacePath = join(ROOT, '.claude-plugin/marketplace.json');
if (!exists(marketplacePath)) fail('.claude-plugin/marketplace.json not found');
const marketplace = readJson(marketplacePath);
if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) fail('marketplace.json has no plugins');

const synonyms = exists(join(SITE, 'synonyms.json')) ? readJson(join(SITE, 'synonyms.json')) : {};
delete synonyms._comment;
const collections = exists(join(SITE, 'collections.json')) ? readJson(join(SITE, 'collections.json')) : [];

function parseChangelog(text) {
  const releases = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^## \[?(\d+\.\d+\.\d+)\]?\s*-\s*(\d{4}-\d{2}-\d{2})/);
    if (h) { cur = { version: h[1], date: h[2], notes: [] }; releases.push(cur); continue; }
    if (/^## /.test(line)) { cur = null; continue; }
    const li = line.match(/^\s*[-*]\s+(.+)/);
    if (li && cur) cur.notes.push(li[1].replace(/`/g, ''));
  }
  return releases;
}

function listMd(dir) {
  if (!exists(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => join(dir, f));
}

const records = [];
const externalPlugins = [];

for (const entry of marketplace.plugins) {
  const src = typeof entry.source === 'string' ? entry.source : null;
  const install = `/plugin install ${entry.name}@${marketplace.name}`;
  if (!src || !src.startsWith('./')) {
    // External source: card from the entry alone (open question in the spec, resolved as "entry only").
    externalPlugins.push(entry.name);
    records.push({
      id: entry.name, type: 'plugin', name: entry.name, displayName: entry.displayName ?? entry.name, plugin: entry.name,
      description: entry.description ?? '', category: entry.category ?? 'uncategorised', keywords: entry.keywords ?? [],
      version: entry.version ?? null, path: null, sourceUrl: typeof entry.source === 'object' ? (entry.source.url ?? entry.homepage ?? null) : entry.homepage ?? null,
      install, lastChanged: BUILD_DATE, health: { validated: true, stale: false, dateFallback: true },
      details: { external: true, components: [] }, related: [],
    });
    continue;
  }
  const relDir = src.replace(/^\.\//, '');
  const dir = join(ROOT, relDir);
  if (!exists(dir)) fail(`plugin folder ${relDir} referenced by marketplace.json does not exist`);
  const manifest = exists(join(dir, '.claude-plugin/plugin.json')) ? readJson(join(dir, '.claude-plugin/plugin.json')) : {};
  const p = { ...entry, ...manifest, name: entry.name };
  const category = entry.category ?? 'uncategorised';
  const keywords = p.keywords ?? [];
  const componentIds = [];

  const push = (type, name, relPath, extra) => {
    const { date, fallback } = lastCommitDate(relPath);
    const folder = type === 'mcp-server' ? 'mcp' : `${type}s`;
    const rec = {
      id: `${p.name}/${folder}/${name}`, type, name, displayName: extra.displayName ?? name, plugin: p.name,
      description: extra.description ?? '', category, keywords, version: p.version, path: relPath, sourceUrl: sourceUrl(relPath),
      install, lastChanged: date, health: { validated: true, stale: daysBetween(BUILD_DATE, date) > STALE_DAYS, dateFallback: fallback },
      details: extra.details ?? {}, body: extra.body ?? null, frontmatter: extra.frontmatter ?? null, files: extra.files ?? [], related: [],
    };
    records.push(rec); componentIds.push(rec.id);
  };

  // skills/<name>/SKILL.md
  const skillsDir = join(dir, 'skills');
  if (exists(skillsDir)) for (const s of readdirSync(skillsDir)) {
    const file = join(skillsDir, s, 'SKILL.md');
    if (!exists(file)) continue;
    const { data, content } = matter(readFileSync(file, 'utf8'));
    if (!data.description) { console.log(`skip ${relative(ROOT, file)}: frontmatter has no description`); continue; }
    const files = readdirSync(join(skillsDir, s), { recursive: true }).filter((f) => statSync(join(skillsDir, s, f)).isFile()).map((f) => `skills/${s}/${f}`);
    push('skill', s, `${relDir}/skills/${s}/SKILL.md`, { description: data.description, body: content.trim(), frontmatter: data, files, details: { allowedTools: data['allowed-tools'] ?? null, model: data.model ?? null } });
  }
  // agents/<name>.md
  for (const file of listMd(join(dir, 'agents'))) {
    const { data, content } = matter(readFileSync(file, 'utf8'));
    const name = data.name ?? file.split('/').pop().replace(/\.md$/, '');
    if (!data.description) { console.log(`skip ${relative(ROOT, file)}: frontmatter has no description`); continue; }
    push('agent', name, relative(ROOT, file), { description: data.description, body: content.trim(), frontmatter: data, files: [`agents/${file.split('/').pop()}`], details: { allowedTools: data.tools ?? null, model: data.model ?? null } });
  }
  // commands/<name>.md
  for (const file of listMd(join(dir, 'commands'))) {
    const { data, content } = matter(readFileSync(file, 'utf8'));
    const name = file.split('/').pop().replace(/\.md$/, '');
    if (!data.description) { console.log(`skip ${relative(ROOT, file)}: frontmatter has no description`); continue; }
    push('command', name, relative(ROOT, file), { displayName: `/${name}`, description: data.description, body: content.trim(), frontmatter: data, files: [`commands/${name}.md`], details: { allowedTools: data['allowed-tools'] ?? null, argumentHint: data['argument-hint'] ?? null } });
  }
  // hooks: hooks/hooks.json or inline in the manifest
  const hooksDef = exists(join(dir, 'hooks/hooks.json')) ? readJson(join(dir, 'hooks/hooks.json')) : manifest.hooks ? { hooks: manifest.hooks } : null;
  if (hooksDef?.hooks) {
    const events = [];
    for (const [event, groups] of Object.entries(hooksDef.hooks)) for (const g of groups ?? []) for (const h of g.hooks ?? []) events.push({ event, matcher: g.matcher ?? '*', command: h.command ?? '', type: h.type ?? 'command' });
    const relPath = exists(join(dir, 'hooks/hooks.json')) ? `${relDir}/hooks/hooks.json` : `${relDir}/.claude-plugin/plugin.json`;
    push('hook', 'hooks', relPath, { displayName: `${p.name} hooks`, description: `${events.length} hook${events.length === 1 ? '' : 's'}: ${events.map((e) => `${e.event} on ${e.matcher}`).join('; ')}.`, files: ['hooks/hooks.json'], details: { hookEvents: events } });
  }
  // MCP servers: .mcp.json or inline in the manifest
  const mcpDef = exists(join(dir, '.mcp.json')) ? readJson(join(dir, '.mcp.json')) : manifest.mcpServers ? { mcpServers: manifest.mcpServers } : null;
  if (mcpDef?.mcpServers) for (const [name, def] of Object.entries(mcpDef.mcpServers)) {
    const env = Object.keys(def.env ?? {}); // names only, never values (untrusted input)
    const relPath = exists(join(dir, '.mcp.json')) ? `${relDir}/.mcp.json` : `${relDir}/.claude-plugin/plugin.json`;
    push('mcp-server', name, relPath, { description: `MCP server "${name}": ${[def.command, ...(def.args ?? [])].join(' ')}.${env.length ? ` Needs ${env.join(', ')}.` : ''}`, files: ['.mcp.json'], details: { command: def.command ?? null, args: def.args ?? [], mcpEnv: env } });
  }

  const { date, fallback } = lastCommitDate(relDir);
  const changelogPath = join(dir, 'CHANGELOG.md');
  const changelog = exists(changelogPath) ? parseChangelog(readFileSync(changelogPath, 'utf8')) : null;
  const httpsOnly = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);
  records.push({
    id: p.name, type: 'plugin', name: p.name, displayName: p.displayName ?? p.name, plugin: p.name, description: p.description ?? '', category, keywords,
    version: p.version, path: `${relDir}/.claude-plugin/plugin.json`, sourceUrl: sourceUrl(relDir), install, lastChanged: date,
    health: { validated: true, stale: daysBetween(BUILD_DATE, date) > STALE_DAYS, dateFallback: fallback },
    details: {
      components: componentIds, license: p.license ?? null, homepage: httpsOnly(p.homepage), repository: httpsOnly(p.repository),
      author: p.author?.name ?? null, authorUrl: httpsOnly(p.author?.url), changelog,
      hasAgents: componentIds.some((i) => i.includes('/agents/')), hasHooks: componentIds.some((i) => i.includes('/hooks/')), hasMcp: componentIds.some((i) => i.includes('/mcp/')),
    },
    files: ['.claude-plugin/plugin.json', ...(changelog ? ['CHANGELOG.md'] : []), ...(exists(join(dir, 'README.md')) ? ['README.md'] : [])],
    related: [],
  });
}

// AC-2: folders under plugins/ with no entry are excluded and logged.
const pluginsDir = join(ROOT, 'plugins');
if (exists(pluginsDir)) for (const f of readdirSync(pluginsDir)) {
  if (!marketplace.plugins.some((e) => typeof e.source === 'string' && e.source.replace(/^\.\//, '') === `plugins/${f}`)) console.log(`excluded: plugins/${f} has no entry in marketplace.json`);
}

// AC-31: collections must reference catalogue plugins.
const byId = new Map(records.map((r) => [r.id, r]));
for (const c of collections) for (const name of c.plugins) if (!byId.has(name) || byId.get(name).type !== 'plugin') fail(`collection "${c.slug}" references unknown plugin "${name}"`);

// AC-25: related = shared keywords (3) > same plugin (2) > same category (1), up to six.
for (const r of records) {
  r.related = records
    .filter((x) => x.id !== r.id)
    .map((x) => ({ id: x.id, s: x.keywords.filter((k) => r.keywords.includes(k)).length * 3 + (x.plugin === r.plugin ? 2 : 0) + (x.category === r.category ? 1 : 0) }))
    .filter((o) => o.s > 0).sort((a, b) => b.s - a.s).slice(0, 6).map((o) => o.id);
}

mkdirSync(OUT, { recursive: true });
const catalog = {
  schemaVersion: SCHEMA_VERSION, marketplace: marketplace.name, repo: repoSlug, commit, shortSha, builtAt: new Date().toISOString(), buildDate: BUILD_DATE,
  siteUrl: SITE_URL, externalPlugins, synonyms, collections, records,
};
writeFileSync(join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 2));

const ms = new MiniSearch(MINISEARCH_OPTIONS);
ms.addAll(records.map((r) => ({ id: r.id, name: r.name, displayName: r.displayName, description: r.description, keywords: r.keywords, body: r.body ?? '' })));
writeFileSync(join(OUT, 'search-index.json'), JSON.stringify(ms.toJSON()));

// feed.xml: one item per plugin release (AC-34).
const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const items = records.filter((r) => r.type === 'plugin' && r.details.changelog).flatMap((r) => r.details.changelog.map((rel) => ({ r, rel }))).sort((a, b) => b.rel.date.localeCompare(a.rel.date));
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(marketplace.name)} releases</title>
<link>${SITE_URL}/</link>
<description>${esc(marketplace.description ?? '')}</description>
${items.map(({ r, rel }) => `<item>
<title>${esc(r.displayName)} ${esc(rel.version)}</title>
<link>${SITE_URL}/a/${r.id}/</link>
<guid isPermaLink="false">${esc(r.id)}--v${esc(rel.version)}</guid>
<pubDate>${new Date(rel.date).toUTCString()}</pubDate>
<description>${esc(rel.notes.join('\n'))}</description>
</item>`).join('\n')}
</channel></rss>
`;
writeFileSync(join(OUT, 'feed.xml'), feed);

writeFileSync(join(OUT, 'llms.txt'), `# ${marketplace.name}

> ${marketplace.description ?? ''}

Catalogue site for the ${marketplace.name} Claude Code plugin marketplace. Built from commit ${commit} on ${BUILD_DATE}.

## Endpoints (stable paths, JSON, no authentication)

- ${SITE_URL}/catalog.json - one record per artifact (plugin, skill, agent, command, hook, mcp-server). schemaVersion ${SCHEMA_VERSION}; breaking changes bump it.
- ${SITE_URL}/search-index.json - MiniSearch index over name, displayName, description, keywords, body. Load with MiniSearch.loadJSON.
- ${SITE_URL}/feed.xml - RSS, one item per plugin release.
- ${SITE_URL}/sitemap-index.xml

## Record shape

id, type, name, displayName, plugin, description, category, keywords[], version, path, sourceUrl, install, lastChanged (YYYY-MM-DD), health {validated, stale, dateFallback}, details (type-specific), related[] (ids).

## Install

/plugin marketplace add ${repoSlug}
/plugin install <plugin>@${marketplace.name}
`);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap-index.xml\n`);

console.log(`catalog: ${records.length} records from ${marketplace.plugins.length} plugins (${externalPlugins.length} external, ${dateFallbacks} date fallbacks) at ${shortSha}`);
