import axios from 'axios';
import { classify } from '../services/dealerDetection.js';
import { upsertListing, markInactive } from '../services/dedup.js';

const BASE = 'https://gw.yad2.co.il/feed-search-legacy/vehicles/cars';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Referer': 'https://www.yad2.co.il/',
  'Accept': 'application/json',
  'Accept-Language': 'he-IL,he;q=0.9',
};

function buildParams(filters = {}) {
  return {
    carFamilyType: '1,2,3,4,5,6,7,8',
    topArea: filters.topArea || 0,
    year: filters.yearMin && filters.yearMax
      ? `${filters.yearMin}-${filters.yearMax}`
      : '-1--1',
    km: filters.kmMax ? `0-${filters.kmMax}` : '-1--1',
    price: filters.priceMax ? `0-${filters.priceMax}` : '-1--1',
    manufacturer: filters.make || '',
    model: filters.model || '',
    rows: 40,
    page: 1,
  };
}

function parseItem(item) {
  return {
    source: 'yad2',
    external_id: String(item.id || item.orderId),
    title: item.title || `${item.manufacturer} ${item.model} ${item.year}`,
    price: item.price ? parseInt(String(item.price).replace(/\D/g, '')) : null,
    year: item.year ? parseInt(item.year) : null,
    km: item.kilometers ? parseInt(String(item.kilometers).replace(/\D/g, '')) : null,
    car_make: item.manufacturer || null,
    car_model: item.model || null,
    hand: item.hand ? parseInt(item.hand) : null,
    engine_cc: item.engineSize ? parseInt(item.engineSize) : null,
    gear_type: item.gearBox === '1' ? 'manual' : item.gearBox === '2' ? 'auto' : null,
    seller_name: item.contactName || null,
    phone: item.phone || null,
    city: item.city || null,
    images: item.images?.map(img => img.src || img) || [],
    url: `https://www.yad2.co.il/item/${item.id || item.orderId}`,
    description: item.metaData || null,
  };
}

export async function scrapeYad2(filters = {}) {
  console.log('[yad2] starting scrape...');
  const params = buildParams(filters);
  let page = 1;
  const activeIds = [];
  let totalPages = 1;

  do {
    try {
      const { data } = await axios.get(BASE, {
        params: { ...params, page },
        headers: HEADERS,
        timeout: 15000,
      });

      const items = data?.data?.feed?.feed_items || [];
      totalPages = data?.data?.pagination?.last_page || 1;

      for (const item of items) {
        if (!item.id && !item.orderId) continue;
        const parsed = parseItem(item);
        parsed.seller_type = await classify(parsed.phone, parsed.seller_name);
        await upsertListing(parsed);
        activeIds.push(parsed.external_id);
      }

      console.log(`[yad2] page ${page}/${totalPages} — ${items.length} items`);
      page++;

      await new Promise(r => setTimeout(r, 1200));
    } catch (err) {
      console.error(`[yad2] page ${page} error:`, err.message);
      break;
    }
  } while (page <= Math.min(totalPages, 25));

  await markInactive('yad2', activeIds);
  console.log(`[yad2] done. ${activeIds.length} listings processed.`);
}
