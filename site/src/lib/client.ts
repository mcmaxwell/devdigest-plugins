// Browser-side loading of catalog.json + search-index.json (shared by the Search, Palette and Favourites islands).
import MiniSearch from 'minisearch';
import { MINISEARCH_OPTIONS, SEARCH_OPTIONS, parseQuery } from '../../scripts/search-config.mjs';
import type { Catalog, Rec, ArtifactType } from './catalog';

let pending: Promise<{ catalog: Catalog; index: MiniSearch }> | null = null;

export function loadIndex(base: string) {
  pending ??= Promise.all([
    fetch(`${base}/catalog.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`catalog ${r.status}`)))),
    fetch(`${base}/search-index.json`).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`index ${r.status}`)))),
  ]).then(([catalog, indexJson]) => ({ catalog: catalog as Catalog, index: MiniSearch.loadJSON(indexJson, MINISEARCH_OPTIONS as never) }));
  return pending;
}

export interface Parsed { terms: string[]; type: ArtifactType | null; truncated: boolean }

/** Ranked records for a query; an empty term list returns everything. */
export function runSearch(catalog: Catalog, index: MiniSearch, raw: string): { results: Rec[]; parsed: Parsed } {
  const parsed = parseQuery(raw, catalog.synonyms) as Parsed;
  const byId = new Map(catalog.records.map((r) => [r.id, r]));
  if (!parsed.terms.length) return { results: [...catalog.records].sort((a, b) => a.displayName.localeCompare(b.displayName)), parsed };
  const hits = index.search(parsed.terms.join(' '), SEARCH_OPTIONS as never);
  return { results: hits.map((h) => byId.get(h.id)).filter((r): r is Rec => !!r), parsed };
}

export const storage = {
  ok(): boolean { try { localStorage.setItem('ddp:probe', '1'); localStorage.removeItem('ddp:probe'); return true; } catch { return false; } },
  get<T>(k: string, fallback: T): T { try { const v = localStorage.getItem('ddp:' + k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } },
  set(k: string, v: unknown) { try { localStorage.setItem('ddp:' + k, JSON.stringify(v)); } catch { /* unavailable: feature hidden by enhance.ts */ } },
};
