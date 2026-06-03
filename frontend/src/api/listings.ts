const BASE = import.meta.env.VITE_API_URL || '/api';

export interface Listing {
  id: number;
  source: string;
  title: string;
  price: number | null;
  year: number | null;
  km: number | null;
  car_make: string | null;
  car_model: string | null;
  hand: number | null;
  gear_type: string | null;
  seller_type: 'private' | 'dealer' | 'unknown';
  seller_name: string | null;
  phone: string | null;
  city: string | null;
  images: string[];
  url: string;
  category: string;
  first_seen_at: string;
  price_history: { price: number; date: string }[];
}

export interface ListingsResponse {
  listings: Listing[];
  total: number;
  page: number;
  pages: number;
}

export interface Filters {
  q?: string;
  category?: string;
  make?: string;
  model?: string;
  year_min?: number;
  year_max?: number;
  km_max?: number;
  price_max?: number;
  private_only?: boolean;
  source?: string;
  page?: number;
}

export const CATEGORIES = [
  { id: '', label: 'הכל' },
  { id: 'vehicles', label: '🚗 רכבים' },
  { id: 'real-estate', label: '🏠 נדל"ן' },
  { id: 'products', label: '📦 מוצרים' },
  { id: 'jobs', label: '💼 דרושים' },
  { id: 'pets', label: '🐾 חיות מחמד' },
  { id: 'marketplace', label: '📱 Marketplace' },
];

export async function fetchListings(filters: Filters): Promise<ListingsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== false) params.set(k, String(v));
  });
  const res = await fetch(`${BASE}/listings?${params}`);
  if (!res.ok) throw new Error('שגיאה בטעינת מודעות');
  return res.json();
}

export async function fetchMakes(): Promise<string[]> {
  const res = await fetch(`${BASE}/listings/makes`);
  return res.json();
}
