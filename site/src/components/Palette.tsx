// Command palette island (AC-18): opens on Cmd/Ctrl+K (dispatched by enhance.ts), same search behaviour, keyboard navigation.
import { useEffect, useRef, useState } from 'react';
import type MiniSearch from 'minisearch';
import { loadIndex, runSearch } from '../lib/client';
import type { Catalog, Rec } from '../lib/catalog';
import { DICTS, currentLang, type Lang } from '../i18n';

export default function Palette({ base }: { base: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [lang, setLang] = useState<Lang>('en');
  const [data, setData] = useState<{ catalog: Catalog; index: MiniSearch } | null>(null);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const t = DICTS[lang];

  useEffect(() => {
    const onOpen = () => { setLang(currentLang()); setOpen((v) => !v); setQ(''); setIdx(0); loadIndex(base).then(setData, () => setFailed(true)); };
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('ddp:palette', onOpen); window.addEventListener('ddp:lang', onLang);
    return () => { window.removeEventListener('ddp:palette', onOpen); window.removeEventListener('ddp:lang', onLang); };
  }, [base]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  if (!open) return null;
  const items: Rec[] = data ? (q.trim() ? runSearch(data.catalog, data.index, q).results.slice(0, 8) : [...data.catalog.records].sort((a, b) => b.lastChanged.localeCompare(a.lastChanged)).slice(0, 6)) : [];
  const go = (r: Rec) => { location.href = `${base}/a/${r.id}/`; };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && items[idx]) go(items[idx]);
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="dialog-backdrop" onClick={() => setOpen(false)}>
      <div className="dialog" role="dialog" aria-label={t.palette} onClick={(e) => e.stopPropagation()}>
        <input ref={input} className="input" value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey} placeholder={t.palettePlaceholder}
          style={{ border: 0, borderBottom: '1px solid var(--color-divider)', borderRadius: 0, minHeight: 54, fontSize: 16, padding: '0 18px' }} />
        <div style={{ maxHeight: '52vh', overflow: 'auto' }} role="listbox">
          {failed ? <div className="text-muted" style={{ padding: 18, fontSize: 13.5 }}>{t.indexFailed}</div> : null}
          {data && q.trim() && items.length === 0 ? <div className="text-muted" style={{ padding: 18, fontSize: 13.5 }}>{t.paletteEmpty} “{q}”</div> : null}
          {items.map((r, i) => (
            <a key={r.id} href={`${base}/a/${r.id}/`} className="palette-row" role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)}>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600 }}>{r.displayName}</span>
                <span style={{ fontSize: 12, opacity: .6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</span>
              </span>
              <span className="row" style={{ gap: 6, flex: 'none' }}><span style={{ opacity: .5, fontSize: 11 }}>{r.plugin}</span><span className="tag tag-neutral" style={{ fontSize: 10 }}>{t[r.type]}</span></span>
            </a>
          ))}
        </div>
        <div className="row" style={{ gap: 14, padding: '8px 18px', borderTop: '1px solid var(--color-divider)', fontSize: 11, opacity: .55 }}>
          <span><kbd>↑↓</kbd> {t.navigate}</span><span><kbd>↵</kbd> {t.open}</span><span><kbd>esc</kbd> {t.close}</span>
        </div>
      </div>
    </div>
  );
}
