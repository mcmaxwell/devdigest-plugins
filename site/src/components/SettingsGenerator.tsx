// Settings generator island (AC-32): tick plugins, get a valid .claude/settings.json fragment.
import { useEffect, useState } from 'react';
import { DICTS, currentLang, type Lang } from '../i18n';

interface P { name: string; displayName: string; description: string; stale: boolean; lastChanged: string }

export default function SettingsGenerator({ plugins, marketplace, repo, initial = [] }: { plugins: P[]; marketplace: string; repo: string; initial?: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [lang, setLang] = useState<Lang>('en');
  const t = DICTS[lang];
  useEffect(() => { setLang(currentLang()); const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail); window.addEventListener('ddp:lang', onLang); return () => window.removeEventListener('ddp:lang', onLang); }, []);

  const snippet = JSON.stringify({ extraKnownMarketplaces: { [marketplace]: { source: { source: 'github', repo } } }, enabledPlugins: Object.fromEntries(selected.map((n) => [`${n}@${marketplace}`, true])) }, null, 2);
  const toggle = (n: string) => setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  return (
    <div className="two-col" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(320px,1.2fr)' }}>
      <div className="stack" style={{ gap: 0 }}>
        {plugins.map((p) => (
          <label key={p.name} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid var(--color-divider)', cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.includes(p.name)} onChange={() => toggle(p.name)} style={{ marginTop: 5 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="row between" style={{ alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600 }}>{p.displayName}</span>
                <span className={`tag ${p.stale ? 'tag-outline' : 'tag-neutral'}`} style={{ fontSize: 10 }}>{p.stale ? t.stale : t.validated} · {p.lastChanged}</span>
              </span>
              <span style={{ display: 'block', fontSize: 13, opacity: .7 }}>{p.description}</span>
            </span>
          </label>
        ))}
      </div>
      <aside style={{ position: 'sticky', top: 80 }}>
        <div className="row between" style={{ marginBottom: 9 }}>
          <h6 style={{ margin: 0 }}>{t.snippet} {selected.length ? <span style={{ opacity: .7 }}>{selected.length}</span> : null}</h6>
          <button className="btn btn-primary btn-sm" data-copy={snippet} disabled={!selected.length}>{t.copySnippet}</button>
        </div>
        {selected.length ? <pre>{snippet}</pre> : <div className="text-muted" style={{ padding: 28, border: '1px dashed var(--color-divider)', borderRadius: 4, textAlign: 'center', fontSize: 13.5 }}>{t.noneSelected}</div>}
      </aside>
    </div>
  );
}
