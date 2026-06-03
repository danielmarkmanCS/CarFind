import type { Listing } from '../api/listings';

const SOURCE_LABEL: Record<string, string> = {
  yad2: 'יד2',
  winwin: 'Winwin',
  forsale: 'Forsale',
  marketplace: 'Marketplace',
};

export default function CarCard({ listing }: { listing: Listing }) {
  const img = listing.images?.[0];
  const daysAgo = Math.floor(
    (Date.now() - new Date(listing.first_seen_at).getTime()) / 86400000
  );
  const hasDrop = listing.price_history?.length > 0 &&
    listing.price_history[0].price > (listing.price ?? 0);

  return (
    <a href={listing.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        transition: 'border-color 0.15s',
        cursor: 'pointer',
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        {/* תמונה */}
        <div style={{ height: 180, background: '#111', position: 'relative' }}>
          {img ? (
            <img src={img} alt={listing.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: 32 }}>🚗</div>
          )}
          {/* תגיות */}
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
            <span style={{
              background: listing.seller_type === 'private' ? 'var(--private)' : listing.seller_type === 'dealer' ? 'var(--dealer)' : '#555',
              color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
            }}>
              {listing.seller_type === 'private' ? 'פרטי' : listing.seller_type === 'dealer' ? 'סוחר' : '?'}
            </span>
            <span style={{
              background: 'rgba(0,0,0,0.7)', color: '#fff',
              fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
            }}>
              {SOURCE_LABEL[listing.source] ?? listing.source}
            </span>
          </div>
          {daysAgo === 0 && (
            <span style={{
              position: 'absolute', top: 8, left: 8,
              background: 'var(--accent)', color: '#fff',
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
            }}>חדש</span>
          )}
        </div>

        {/* פרטים */}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {listing.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>
              {listing.price ? `₪${listing.price.toLocaleString('he-IL')}` : '—'}
            </span>
            {hasDrop && (
              <span style={{ fontSize: 11, color: 'var(--private)', fontWeight: 600 }}>
                ↓ מ-₪{listing.price_history[0].price.toLocaleString('he-IL')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--muted)' }}>
            {listing.year && <span>📅 {listing.year}</span>}
            {listing.km && <span>🛣️ {listing.km.toLocaleString('he-IL')} ק"מ</span>}
            {listing.hand && <span>יד {listing.hand}</span>}
          </div>
          {(listing.city || listing.phone) && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 12 }}>
              {listing.city && <span>📍 {listing.city}</span>}
              {listing.phone && <span>📞 {listing.phone}</span>}
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 11, color: '#555' }}>
            {daysAgo === 0 ? 'היום' : `לפני ${daysAgo} ימים`}
          </div>
        </div>
      </div>
    </a>
  );
}
