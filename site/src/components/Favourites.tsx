// Favourites and recents island (AC-35..37). Reads local storage; the page hides itself via [data-needs-storage] when storage is unavailable.
import { useEffect, useState } from 'react';
import { Card } from './Card';
import { loadIndex, storage } from '../lib/client';
import type { Catalog, Rec } from '../lib/catalog';
import { DICTS, currentLang, type Lang } from '../i18n';

export default function Favourites({ base }: { base: string }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [favs, setFavs] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [lang, setLang] = useState<Lang>('en');
  const t = DICTS[lang];

  useEffect(() => {
    const read = () => { setFavs(storage.get<string[]>('favourites', [])); setRecents(storage.get<string[]>('recents', [])); };
    read(); setLang(currentLang());
    loadIndex(base).then((d) => setCatalog(d.catalog), () => {});
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('ddp:favs', read); window.addEventListener('storage', read); window.addEventListener('ddp:lang', onLang);
    return () => { window.removeEventListener('ddp:favs', read); window.removeEventListener('storage', read); window.removeEventListener('ddp:lang', onLang); };
  }, [base]);

  if (!catalog) return <p className="text-muted">…</p>;
  const byId = new Map(catalog.records.map((r) => [r.id, r]));
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((r): r is Rec => !!r);
  const favRecs = pick(favs), recentRecs = pick(recents);
  return (
    <>
      {favRecs.length === 0 ? <p className="text-muted" style={{ maxWidth: '60ch' }}>{t.favEmpty}</p> : null}
      <div className="grid-cards">{favRecs.map((r) => <Card key={r.id} r={r} base={base} t={t} />)}</div>
      <h6 style={{ margin: '37px 0 14px' }}>{t.recents}</h6>
      {recentRecs.length === 0 ? <p className="text-muted" style={{ fontSize: 13.5 }}>{t.recentsEmpty}</p> : null}
      <div className="stack" style={{ gap: 0, maxWidth: 640 }}>
        {recentRecs.map((r) => (
          <a key={r.id} href={`${base}/a/${r.id}/`} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--color-divider)', textDecoration: 'none', color: 'inherit', fontSize: 14 }}>
            <span>{r.displayName} <span style={{ opacity: .5 }}>· {r.plugin}</span></span>
            <span style={{ opacity: .5, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t[r.type]}</span>
          </a>
        ))}
      </div>
    </>
  );
}
