import { useEffect, useState, useCallback } from 'react';
import { fetchListings, fetchMakes, type Filters, type Listing } from './api/listings';
import CarCard from './components/CarCard';
import FiltersPanel from './components/Filters';

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [makes, setMakes] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>({ private_only: true });

  useEffect(() => {
    fetchMakes().then(setMakes).catch(() => {});
  }, []);

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
      setError('שגיאה בטעינת הרכבים. נסה שוב.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search({ private_only: true, page: 1 });
  }, [search]);

  const goPage = (p: number) => search({ ...filters, page: p });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px' }}>
          🔍 FindIt
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
          חיפוש מודעות מיד2, Marketplace ועוד — הכל במקום אחד
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
        {/* סרגל פילטרים */}
        <FiltersPanel makes={makes} onSearch={search} loading={loading} />

        {/* תוצאות */}
        <div>
          {!loading && (
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>
              {total > 0 ? `${total.toLocaleString('he-IL')} מודעות נמצאו` : ''}
            </div>
          )}

          {error && (
            <div style={{ color: '#ef4444', padding: 16, textAlign: 'center' }}>{error}</div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 16 }}>
              טוען רכבים...
            </div>
          ) : listings.length === 0 && !error ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
              <div style={{ fontSize: 40 }}>🔍</div>
              <div style={{ marginTop: 12 }}>לא נמצאו מודעות. נסה מילות חיפוש אחרות.</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}>
              {listings.map(l => <CarCard key={`${l.source}-${l.id}`} listing={l} />)}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 32 }}>
              <button onClick={() => goPage(page - 1)} disabled={page <= 1}
                style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', opacity: page <= 1 ? 0.4 : 1 }}>
                ←
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} onClick={() => goPage(p)}
                    style={{ padding: '8px 14px', background: p === page ? 'var(--accent)' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontWeight: p === page ? 700 : 400 }}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => goPage(page + 1)} disabled={page >= pages}
                style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', opacity: page >= pages ? 0.4 : 1 }}>
                →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
