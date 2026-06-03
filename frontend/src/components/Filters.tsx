import { useState } from 'react';
import type { Filters } from '../api/listings';

const inputStyle: React.CSSProperties = {
  background: '#111',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  padding: '8px 10px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 4,
};

interface Props {
  makes: string[];
  onSearch: (f: Filters) => void;
  loading: boolean;
}

export default function FiltersPanel({ makes, onSearch, loading }: Props) {
  const [f, setF] = useState<Filters>({ private_only: true });
  const set = (k: keyof Filters, v: unknown) => setF(p => ({ ...p, [k]: v || undefined }));

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>חיפוש רכבים</div>

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
          <input style={inputStyle} type="number" placeholder="2015" min={2000} max={2025}
            value={f.year_min ?? ''} onChange={e => set('year_min', parseInt(e.target.value))} />
        </div>
        <div>
          <label style={labelStyle}>שנה עד</label>
          <input style={inputStyle} type="number" placeholder="2023" min={2000} max={2025}
            value={f.year_max ?? ''} onChange={e => set('year_max', parseInt(e.target.value))} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>ק"מ מקסימלי</label>
        <input style={inputStyle} type="number" placeholder="150000"
          value={f.km_max ?? ''} onChange={e => set('km_max', parseInt(e.target.value))} />
      </div>

      <div>
        <label style={labelStyle}>מחיר מקסימלי (₪)</label>
        <input style={inputStyle} type="number" placeholder="100000"
          value={f.price_max ?? ''} onChange={e => set('price_max', parseInt(e.target.value))} />
      </div>

      <div>
        <label style={labelStyle}>מקור</label>
        <select style={inputStyle} value={f.source ?? ''} onChange={e => set('source', e.target.value)}>
          <option value="">כולם</option>
          <option value="yad2">יד2</option>
          <option value="winwin">Winwin</option>
          <option value="forsale">Forsale</option>
          <option value="marketplace">Marketplace</option>
        </select>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
        <input type="checkbox" checked={f.private_only ?? true}
          onChange={e => set('private_only', e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
        <span>פרטיים בלבד (ללא סוחרים)</span>
      </label>

      <button
        onClick={() => onSearch({ ...f, page: 1 })}
        disabled={loading}
        style={{
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '11px 0',
          fontWeight: 700,
          fontSize: 15,
          width: '100%',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'מחפש...' : 'חפש'}
      </button>
    </div>
  );
}
