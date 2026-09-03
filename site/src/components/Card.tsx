// One card for every artifact. Rendered statically by Astro pages and live by the Search/Favourites islands.
// Buttons are enhanced by scripts/enhance.ts through data-copy / data-fav, so this component needs no state.
import type { Rec } from '../lib/catalog';
import type { Dict } from '../i18n';

export const Star = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
export const External = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

export function HealthTag({ r, t, small }: { r: Rec; t: Dict; small?: boolean }) {
  const stale = r.health.stale;
  return (
    <span className={`tag ${stale ? 'tag-outline' : 'tag-neutral'}`} style={small ? { fontSize: 10 } : undefined}
      title={r.health.dateFallback ? t.dateFallback : stale ? t.staleTitle : t.validatedTitle}>
      <span data-t={stale ? 'stale' : 'validated'}>{stale ? t.stale : t.validated}</span>&nbsp;· {r.lastChanged}{r.health.dateFallback ? '*' : ''}
    </span>
  );
}

export function Card({ r, base, t }: { r: Rec; base: string; t: Dict }) {
  const href = `${base}/a/${r.id}/`;
  const kw = r.keywords.slice(0, 5);
  return (
    <article className="card" data-id={r.id}>
      <div className="row between">
        <span className="card-kicker" data-t={r.type}>{t[r.type]}</span>
        <button className="btn btn-icon btn-ghost" style={{ width: 28, height: 28 }} data-fav={r.id} data-needs-storage="" aria-pressed="false" aria-label={t.favourite}><Star /></button>
      </div>
      <a className="card-title" href={href}>{r.displayName}</a>
      <div className="card-meta tnum"><a href={`${base}/a/${r.plugin}/`}>{r.plugin}</a>{r.version ? <span>· v{r.version}</span> : null}<span>· {r.category}</span></div>
      <p className="card-body clamp-3">{r.description}</p>
      <div className="tags">
        {kw.map((k) => <span className="tag tag-neutral" key={k}>{k}</span>)}
        {r.keywords.length > 5 ? <span className="tag tag-outline">+{r.keywords.length - 5}</span> : null}
      </div>
      <div className="row between card-foot">
        <HealthTag r={r} t={t} />
        <div className="row" style={{ gap: 4 }}>
          <button className="btn btn-primary btn-sm" style={{ minWidth: 86 }} data-copy={r.install} data-t="install">{t.install}</button>
          {r.sourceUrl ? <a className="btn btn-secondary btn-sm btn-icon" href={r.sourceUrl} target="_blank" rel="noopener" aria-label={t.source}><External /></a> : null}
        </div>
      </div>
    </article>
  );
}
