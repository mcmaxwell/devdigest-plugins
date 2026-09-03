// Shared between the build-time indexer and the browser. Keep it dependency-free.

export const SCHEMA_VERSION = 1;

export const MINISEARCH_OPTIONS = {
  idField: 'id',
  fields: ['name', 'displayName', 'description', 'keywords', 'body'],
  storeFields: ['id'],
  extractField: (doc, field) => (Array.isArray(doc[field]) ? doc[field].join(' ') : doc[field] ?? ''),
};

export const SEARCH_OPTIONS = {
  boost: { name: 10, displayName: 10, description: 5, keywords: 5, body: 1 },
  prefix: true,
  fuzzy: (term) => (term.length >= 5 ? 1 : false),
  combineWith: 'OR',
};

export const STOP_WORDS = new Set(
  'i a an the for to of need want some something that does me my with and or in on is it please how can you which what'.split(' '),
);

// Words that become a type filter instead of a search term (AC-10). Plurals and
// the Ukrainian equivalents live in synonyms.json so this file stays English.
export const TYPE_WORDS = {
  plugin: ['plugin', 'plugins'],
  skill: ['skill', 'skills'],
  agent: ['agent', 'agents'],
  command: ['command', 'commands'],
  hook: ['hook', 'hooks'],
  'mcp-server': ['mcp', 'mcps', 'mcp-server'],
};

export const MAX_QUERY = 200;

export function tokenize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\-_.'@]+/gu, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Splits a raw query into search terms, an optional type filter and a truncation flag. */
export function parseQuery(raw, synonyms = {}) {
  let q = String(raw ?? '');
  const truncated = q.length > MAX_QUERY;
  if (truncated) q = q.slice(0, MAX_QUERY);
  let type = null;
  const terms = [];
  for (const w of tokenize(q)) {
    const expanded = synonyms[w] ? [w, ...synonyms[w]] : [w];
    const typeHit = expanded.map((x) => Object.keys(TYPE_WORDS).find((k) => TYPE_WORDS[k].includes(x))).find(Boolean);
    if (typeHit && !type) { type = typeHit; continue; }
    if (STOP_WORDS.has(w)) continue;
    terms.push(...expanded);
  }
  return { terms, type, truncated };
}
