// Search island: loads the index, parses the query, applies filters, mirrors state to the URL (AC-9..17, AC-28, AC-29).
// The page renders the full static list underneath for no-JS visitors; this component hides it once results paint.
import { useEffect, useMemo, useState } from 'react';
import type MiniSearch from 'minisearch';
import { Card } from './Card';
import { loadIndex, runSearch } from '../lib/client';
import type { Catalog, Rec, ArtifactType } from '../lib/catalog';
import { DICTS, currentLang, type Lang } from '../i18n';

const TYPES: ArtifactType[] = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp-server'];
type Sort = 'relevance' | 'name' | 'recent';
type HasKey = 'hasAgents' | 'hasHooks' | 'hasMcp';
interface Filters { type: ArtifactType | 'all'; category: string | null; plugin: string | null; keyword: string | null; has: HasKey | null; sort: Sort }

const readUrl = (): { q: string } & Filters => {
  const P = new URLSearchParams(location.search);
  return { q: P.get('q') ?? '', type: (P.get('type') as ArtifactType) ?? 'all', category: P.get('category'), plugin: P.get('plugin'), keyword: P.get('keyword'), has: P.get('has') as HasKey | null, sort: (P.get('sort') as Sort) ?? 'relevance' };
};
const writeUrl = (s: { q: string } & Filters) => {
  const P = new URLSearchParams();
  if (s.q) P.set('q', s.q); if (s.type !== 'all') P.set('type', s.type);
  for (const k of ['category', 'plugin', 'keyword', 'has'] as const) if (s[k]) P.set(k, s[k]!);
  if (s.sort !== 'relevance') P.set('sort', s.sort);
  const qs = P.toString(); history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
};

export default function Search({ base, repo, commit }: { base: string; repo: string; commit: string }) {
  const [lang, setLang] = useState<Lang>('en');
  const t = DICTS[lang];
  const [data, setData] = useState<{ catalog: Catalog; index: MiniSearch } | null>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<{ q: string } & Filters>({ q: '', type: 'all', category: null, plugin: null, keyword: null, has: null, sort: 'relevance' });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLang(currentLang()); setState(readUrl());
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('ddp:lang', onLang);
    loadIndex(base).then((d) => { setData(d); const el = document.getElementById('static-list'); if (el) el.hidden = true; }, () => setFailed(true));
    return () => window.removeEventListener('ddp:lang', onLang);
  }, [base]);
  useEffect(() => { if (data) writeUrl(state); }, [state, data]);

  const view = useMemo(() => {
    if (!data) return null;
    const { results, parsed } = runSearch(data.catalog, data.index, state.q);
    const byId = new Map(data.catalog.records.map((r) => [r.id, r]));
    const effType = parsed.type ?? (state.type === 'all' ? null : state.type);
    let pool = results;
    if (parsed.terms.length === 0 || state.sort === 'name') pool = [...pool].sort((a, b) => a.displayName.localeCompare(b.displayName));
    if (state.sort === 'recent') pool = [...pool].sort((a, b) => b.lastChanged.localeCompare(a.lastChanged));
    const pluginOf = (r: Rec) => byId.get(r.plugin)!;
    const passes = (r: Rec, skip?: string) =>
      (skip === 'type' || !effType || r.type === effType) && (skip === 'category' || !state.category || r.category === state.category) &&
      (skip === 'plugin' || !state.plugin || r.plugin === state.plugin) && (skip === 'keyword' || !state.keyword || r.keywords.includes(state.keyword)) &&
      (skip === 'has' || !state.has || !!pluginOf(r)?.details[state.has]);
    const count = (pred: (r: Rec) => boolean, skip: string) => pool.filter((r) => passes(r, skip) && pred(r)).length;
    const uniq = (f: (r: Rec) => string[]) => [...new Set(data.catalog.records.flatMap(f))].sort();
    const facet = (key: 'category' | 'plugin' | 'keyword' | 'has', label: string, vals: string[], labelOf?: (v: string) => string) => ({
      key, label,
      options: vals.map((v) => ({ v, label: labelOf ? labelOf(v) : v, active: state[key] === v, count: key === 'has' ? count((r) => !!pluginOf(r)?.details[v as HasKey], key) : count((r) => (key === 'keyword' ? r.keywords.includes(v) : (r as unknown as Record<string, string>)[key] === v), key) })).filter((o) => o.count || o.active),
    });
    return {
      parsed, effType, list: pool.filter((r) => passes(r)),
      typeCounts: Object.fromEntries([['all', pool.filter((r) => passes(r, 'type')).length], ...TYPES.map((k) => [k, count((r) => r.type === k, 'type')])]) as Record<string, number>,
      facets: [facet('category', t.category, uniq((r) => [r.category])), facet('plugin', t.parentPlugin, data.catalog.records.filter((r) => r.type === 'plugin').map((r) => r.name)), facet('has', t.has, ['hasAgents', 'hasHooks', 'hasMcp'], (v) => t[v]), facet('keyword', t.keyword, uniq((r) => r.keywords))],
      recent: [...data.catalog.records].sort((a, b) => b.lastChanged.localeCompare(a.lastChanged)).slice(0, 3),
    };
  }, [data, state, t]);

  const anyFilter = !!(state.q || (view?.effType) || state.category || state.plugin || state.keyword || state.has);
  const clearAll = () => setState((s) => ({ ...s, q: '', type: 'all', category: null, plugin: null, keyword: null, has: null }));
  const stripTypeWord = (q: string, type: ArtifactType) => q.split(/\s+/).filter((w) => !(data?.catalog.synonyms[w.toLowerCase()] ?? [w.toLowerCase()]).some((x) => [type, type + 's', 'mcp'].includes(x))).join(' ');
  const requestUrl = `https://github.com/${repo}/issues/new?title=${encodeURIComponent('Request: ' + state.q.slice(0, 200))}&body=${encodeURIComponent(`Searched for: ${state.q.slice(0, 200)}\nSite build: ${commit}\n\nWhat I expected to find:\n`)}`;

  return (
    <div>
      <div style={{ position: 'relative', maxWidth: 820 }}>
        <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: .6 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <input className="input input-lg" type="search" aria-label={t.catalogue} placeholder={t.searchPlaceholder} value={state.q} disabled={!data && !failed}
          onChange={(e) => setState((s) => ({ ...s, q: e.target.value, type: 'all' }))} />
        {!data && !failed ? <span className="spinner" style={{ position: 'absolute', right: 14, top: '50%', marginTop: -8 }} /> : null}
      </div>
      {!data && !failed ? <p className="text-muted" style={{ fontSize: 13, margin: '9px 0 0' }}>{t.loadingIndex}</p> : null}
      {view?.parsed.truncated ? <p style={{ fontSize: 13, margin: '9px 0 0', color: 'var(--color-accent)' }}>{t.truncated}</p> : null}

      {failed ? (
        <div className="notice" style={{ marginTop: 28, maxWidth: 640 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{t.indexFailed}</div>
          <p className="text-muted">{t.indexFailedBody}</p>
          <a className="btn btn-primary" href="#static-list" onClick={() => { const el = document.getElementById('static-list'); if (el) el.hidden = false; }}>{t.fullList}</a>
        </div>
      ) : null}

      {view ? (
        <>
          <div className="row wrap-row" style={{ gap: 5, marginTop: 18 }}>
            {(['all', ...TYPES] as const).map((k) => {
              const active = k === 'all' ? !view.effType : view.effType === k;
              return (
                <button key={k} className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={active} style={{ gap: 8 }}
                  onClick={() => setState((s) => ({ ...s, type: k, q: view.parsed.type ? stripTypeWord(s.q, view.parsed.type) : s.q }))}>
                  {k === 'all' ? t.all : t[k]} <span className="tnum" style={{ opacity: .55, fontFamily: 'var(--font-body)', fontSize: 11 }}>{view.typeCounts[k]}</span>
                </button>
              );
            })}
            {view.parsed.type ? <span className="tag tag-accent" style={{ marginLeft: 9 }}>{t[view.parsed.type]} · {t.typeFromQuery}</span> : null}
          </div>

          <div className="search-layout">
            <aside data-open={showFilters}>
              <button className="btn btn-secondary facet-toggle" data-facet-toggle onClick={() => setShowFilters((v) => !v)}>{t.filters}</button>
              <div className="row between"><h6 style={{ margin: 0 }}>{t.filters}</h6>{anyFilter ? <button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 6px' }} onClick={clearAll}>{t.clear}</button> : null}</div>
              {view.facets.map((g) => (
                <div key={g.key} className="stack" style={{ gap: 2 }}>
                  <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .55, marginBottom: 4 }}>{g.label}</div>
                  {g.options.map((o) => (
                    <button key={o.v} className="facet-btn" aria-pressed={o.active} onClick={() => setState((s) => ({ ...s, [g.key]: o.active ? null : o.v }))}>
                      <span>{o.label}</span><span>{o.count}</span>
                    </button>
                  ))}
                </div>
              ))}
            </aside>
            <main>
              <div className="results-bar">
                <div style={{ opacity: .65 }}><span className="tnum">{view.list.length}</span> {t.results}</div>
                <div className="row" style={{ fontSize: 12 }}>
                  <span style={{ opacity: .6 }}>{t.sort}</span>
                  <div className="seg">
                    {([['relevance', t.relevance], ['name', t.byName], ['recent', t.recent]] as [Sort, string][]).map(([k, label]) => (
                      <button key={k} className="seg-opt" style={{ fontSize: 12 }} aria-pressed={state.sort === k} onClick={() => setState((s) => ({ ...s, sort: k }))}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {view.list.length === 0 && anyFilter ? (
                <div style={{ padding: '28px 0', maxWidth: 640 }}>
                  <h2 style={{ fontWeight: 400 }}>{t.noResults}</h2>
                  <p className="text-muted">{t.noResultsBody} <span style={{ color: 'var(--color-text)' }}>“{state.q}”</span>. {t.noResultsHint}</p>
                  <a className="btn btn-primary" href={requestUrl} target="_blank" rel="noopener">{t.requestSkill}</a>
                  <h6 style={{ margin: '37px 0 14px' }}>{t.recentlyChanged}</h6>
                  <div className="grid-cards-sm">
                    {view.recent.map((r) => (
                      <a key={r.id} href={`${base}/a/${r.id}/`} className="card" style={{ color: 'inherit', textDecoration: 'none' }}>
                        <span className="card-kicker">{t[r.type]}</span><span className="card-title">{r.displayName}</span><span className="card-meta">{r.plugin} · {r.lastChanged}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid-cards">{view.list.slice(0, 50).map((r) => <Card key={r.id} r={r} base={base} t={t} />)}</div>
              {view.list.length > 50 ? <p className="text-muted" style={{ marginTop: 18, fontSize: 13 }}>{view.list.length - 50} more. Narrow the search or use a filter.</p> : null}
            </main>
          </div>
        </>
      ) : null}
    </div>
  );
}
