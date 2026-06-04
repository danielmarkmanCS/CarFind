import { useState } from 'react';
import type { Filters } from '../api/listings';

const inputStyle: React.CSSProperties = {
  background: '#111', border: '1px solid var(--border)', borderRadius: 6,
  color: 'var(--text)', padding: '8px 10px', fontSize: 14, width: '100%', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4,
};

const YAD2_CATEGORIES = [
  { id: 'vehicles',    label: '🚗 רכבים' },
  { id: 'real-estate', label: '🏠 נדל"ן' },
  { id: 'products',    label: '📦 מוצרים' },
  { id: 'jobs',        label: '💼 דרושים' },
  { id: 'pets',        label: '🐾 חיות מחמד' },
];

interface Props {
  makes: string[];
  onSearch: (f: Filters) => void;
  loading: boolean;
}

export default function FiltersPanel({ makes, onSearch, loading }: Props) {
  const [f, setF] = useState<Filters>({ private_only: true });
  const [tab, setTab] = useState<'yad2' | 'marketplace'>('yad2');
  const set = (k: keyof Filters, v: unknown) => setF(p => ({ ...p, [k]: v || undefined }));

  function switchTab(t: 'yad2' | 'marketplace') {
    setTab(t);
    setF({ private_only: true, source: t === 'marketplace' ? 'marketplace' : undefined });
  }

  const isVehicles = tab === 'yad2' && f.category === 'vehicles';

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Source tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {(['yad2', 'marketplace'] as const).map(t => (
          <button key={t} onClick={() => switchTab(t)} style={{
            padding: '8px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            background: tab === t ? 'var(--accent)' : '#1a1a1a',
            color: 'var(--text)', border: '1px solid var(--border)',
          }}>
            {t === 'yad2' ? '🔵 יד2' : '📱 Marketplace'}
          </button>
        ))}
      </div>

      {/* Free text */}
      <div>
        <label style={labelStyle}>חיפוש חופשי</label>
        <input style={inputStyle} placeholder="מה אתה מחפש?"
          value={f.q ?? ''} onChange={e => set('q', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch({ ...f, page: 1 })} />
      </div>

      {/* Yad2 categories */}
      {tab === 'yad2' && (
        <div>
          <label style={labelStyle}>קטגוריה</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button onClick={() => set('category', '')} style={{
              padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: !f.category ? 'var(--accent)' : '#222', color: 'var(--text)', border: '1px solid var(--border)',
            }}>הכל</button>
            {YAD2_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => set('category', cat.id)} style={{
                padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: f.category === cat.id ? 'var(--accent)' : '#222',
                color: 'var(--text)', border: '1px solid var(--border)',
              }}>{cat.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Vehicle filters — only yad2 vehicles */}
      {isVehicles && <>
        <div>
          <label style={labelStyle}>יצרן</label>
          <select style={inputStyle} value={f.make ?? ''} onChange={e => set('make', e.target.value)}>
            <option value="">הכל</option>
            {makes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>דגם</label>
          <input style={inputStyle} placeholder="למשל: Civic" value={f.model ?? ''} onChange={e => set('model', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelStyle}>שנה מ</label>
            <input style={inputStyle} type="number" placeholder="2015" value={f.year_min ?? ''} onChange={e => set('year_min', parseInt(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle}>שנה עד</label>
            <input style={inputStyle} type="number" placeholder="2024" value={f.year_max ?? ''} onChange={e => set('year_max', parseInt(e.target.value))} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>ק"מ מקסימלי</label>
          <input style={inputStyle} type="number" placeholder="150000" value={f.km_max ?? ''} onChange={e => set('km_max', parseInt(e.target.value))} />
        </div>
      </>}

      <div>
        <label style={labelStyle}>מחיר מקסימלי (₪)</label>
        <input style={inputStyle} type="number" placeholder="100000" value={f.price_max ?? ''} onChange={e => set('price_max', parseInt(e.target.value))} />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
        <input type="checkbox" checked={f.private_only ?? true}
          onChange={e => set('private_only', e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
        <span>פרטיים בלבד</span>
      </label>

      <button onClick={() => onSearch({ ...f, page: 1 })} disabled={loading}
        style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontWeight: 700, fontSize: 15, width: '100%', opacity: loading ? 0.6 : 1 }}>
        {loading ? 'מחפש...' : 'חפש'}
      </button>
    </div>
  );
}
