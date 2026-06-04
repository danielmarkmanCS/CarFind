import { useState, useEffect } from 'react';

const KEY = 'carfind_wishlist';

export function useWishlist() {
  const [ids, setIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(ids));
  }, [ids]);

  const toggle = (id: number) =>
    setIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const has = (id: number) => ids.includes(id);

  return { ids, toggle, has };
}
