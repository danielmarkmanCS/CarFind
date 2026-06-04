import { useEffect, useState, useCallback } from 'react';
import { fetchListings, fetchMakes, type Filters, type Listing } from './api/listings';
import CarCard from './components/CarCard';
import FiltersPanel from './components/Filters';
import { useWishlist } from './hooks/useWishlist';

type View = 'search' | 'wishlist';

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [wishlistListings, setWishlistListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [makes, setMakes] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>({ private_only: true, source: 'yad2' });
  const [view, setView] = useState<View>('search');
  const { ids: wishlistIds, toggle, has } = useWishlist();

  useEffect(() => { fetchMakes().then(setMakes).catch(() => {}); }, []);

  const search = useCallback(async (f: Filters) => {
    setLoading(true);
    setError('');
    setFilters(f);
    try {
      const data = await fetchListings(f);
      setListings(data.listings);
      setTotal(data.total);
      setPages(data.pages);
      setPage(data.page);
    } catch {
      setError('שגיאה בטעינת מודעות. נסה שוב.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { search({ private_only: true, source: 'yad2', page: 1 }); }, [search]);

  // Load wishlist listings
  useEffect(() => {
    if (view !== 'wishlist' || wishlistIds.length === 0) {
      setWishlistListings([]);
      return;
    }
    fetchListings({ page: 1, limit: 100 } as Filters)
      .then(d => setWishlistListings(d.listings.filter(l => wishlistIds.includes(l.id))))
      .catch(() => {});
  }, [view, wishlistIds]);

  const goPage = (p: number) => search({ ...filters, page: p });
  const displayListings = view === 'wishlist' ? wishlistListings : listings;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px' }}>🔍 FindIt</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            חיפוש מודעות מיד2, Marketplace ועוד — הכל במקום אחד
          </div>
        </div>
        <button onClick={() => setView(v => v === 'wishlist' ? 'search' : 'wishlist')} style={{
          background: view === 'wishlist' ? '#ef4444' : 'var(--surface)',
          color: 'var(--text)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
          fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ❤️ מועדפים {wishlistIds.length > 0 && `(${wishlistIds.length})`}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
        {view === 'search' && <FiltersPanel makes={makes} onSearch={search} loading={loading} />}
        {view === 'wishlist' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>❤️ המועדפים שלי</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{wishlistIds.length} פריטים שמורים</div>
            <button onClick={() => setView('search')} style={{
              marginTop: 16, width: '100%', padding: '10px', background: 'var(--accent)',
              color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
            }}>← חזור לחיפוש</button>
          </div>
        )}

        <div>
          {view === 'search' && !loading && total > 0 && (
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>
              {total.toLocaleString('he-IL')} מודעות נמצאו
            </div>
          )}

          {error && <div style={{ color: '#ef4444', padding: 16, textAlign: 'center' }}>{error}</div>}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 16 }}>טוען...</div>
          ) : displayListings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
              <div style={{ fontSize: 40 }}>{view === 'wishlist' ? '❤️' : '🔍'}</div>
              <div style={{ marginTop: 12 }}>
                {view === 'wishlist' ? 'אין מועדפים עדיין — לחץ על הלב במודעות' : 'לא נמצאו מודעות. נסה מילות חיפוש אחרות.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {displayListings.map(l => (
                <CarCard
                  key={`${l.source}-${l.id}`}
                  listing={l}
                  wishlisted={has(l.id)}
                  onWishlist={() => toggle(l.id)}
                />
              ))}
            </div>
          )}

          {view === 'search' && pages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 32 }}>
              <button onClick={() => goPage(page - 1)} disabled={page <= 1}
                style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', opacity: page <= 1 ? 0.4 : 1 }}>←</button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                const p = i + 1;
                return <button key={p} onClick={() => goPage(p)} style={{ padding: '8px 14px', background: p === page ? 'var(--accent)' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontWeight: p === page ? 700 : 400 }}>{p}</button>;
              })}
              <button onClick={() => goPage(page + 1)} disabled={page >= pages}
                style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', opacity: page >= pages ? 0.4 : 1 }}>→</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
