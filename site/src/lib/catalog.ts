// Catalogue access at build time. The JSON is produced by scripts/build-catalog.mjs before `astro build`.
import catalog from '../../public/catalog.json';

export type ArtifactType = 'plugin' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp-server';
export interface Release { version: string; date: string; notes: string[] }
export interface HookEvent { event: string; matcher: string; command: string; type: string }
export interface Rec {
  id: string; type: ArtifactType; name: string; displayName: string; plugin: string; description: string; category: string;
  keywords: string[]; version: string | null; path: string | null; sourceUrl: string | null; install: string; lastChanged: string;
  health: { validated: boolean; stale: boolean; dateFallback: boolean };
  details: {
    components?: string[]; license?: string | null; homepage?: string | null; repository?: string | null; author?: string | null; authorUrl?: string | null;
    changelog?: Release[] | null; hasAgents?: boolean; hasHooks?: boolean; hasMcp?: boolean; external?: boolean;
    allowedTools?: string | null; model?: string | null; argumentHint?: string | null; hookEvents?: HookEvent[]; command?: string | null; args?: string[]; mcpEnv?: string[];
  };
  body?: string | null; frontmatter?: Record<string, unknown> | null; files?: string[]; related: string[];
}
export interface Collection { slug: string; title: string; description: string; plugins: string[] }
export interface Catalog {
  schemaVersion: number; marketplace: string; repo: string; commit: string; shortSha: string; builtAt: string; buildDate: string; siteUrl: string;
  externalPlugins: string[]; synonyms: Record<string, string[]>; collections: Collection[]; records: Rec[];
}

export const CATALOG = catalog as unknown as Catalog;
export const RECORDS = CATALOG.records;
export const BY_ID = new Map(RECORDS.map((r) => [r.id, r]));
export const PLUGINS = RECORDS.filter((r) => r.type === 'plugin');
export const TYPES: ArtifactType[] = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp-server'];

export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (p: string) => `${BASE}/${p.replace(/^\//, '')}`;
export const artifactUrl = (id: string) => url(`a/${id}/`);

export const issueUrl = (title: string, body: string) =>
  `https://github.com/${CATALOG.repo}/issues/new?title=${encodeURIComponent(title.slice(0, 200))}&body=${encodeURIComponent(body)}`;
export const reportUrl = (r: Rec) => issueUrl(`Problem with ${r.id}`, `Artifact: ${r.path ?? r.id}\nSite build: ${CATALOG.commit}\n\nWhat is wrong:\n`);

export const settingsSnippet = (plugins: string[]) => JSON.stringify({
  extraKnownMarketplaces: { [CATALOG.marketplace]: { source: { source: 'github', repo: CATALOG.repo } } },
  enabledPlugins: Object.fromEntries(plugins.map((n) => [`${n}@${CATALOG.marketplace}`, true])),
}, null, 2);
