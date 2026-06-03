import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { upsertListing, markInactive } from './dedup.js';

chromium.use(StealthPlugin());

const CATEGORIES = [
  { id: 'vehicles',    url: 'https://www.yad2.co.il/vehicles/cars',                        privateKey: true },
  { id: 'real-estate', url: 'https://www.yad2.co.il/real-estate/rent-apartments',          privateKey: false },
  { id: 'products',    url: 'https://www.yad2.co.il/products/second-hand/general-items',   privateKey: false },
  { id: 'jobs',        url: 'https://www.yad2.co.il/jobs',                                 privateKey: false },
  { id: 'pets',        url: 'https://www.yad2.co.il/pets/dogs',                            privateKey: false },
];

const DEALER_KEYWORDS = ['סוכנות','מוסך','ליסינג','יבואן','דילר','dealer','motors','auto','cars','garage'];
const isDealer = (name = '') => DEALER_KEYWORDS.some(k => name.toLowerCase().includes(k)) ? 'dealer' : 'unknown';
const safeInt = (val) => { if (!val && val !== 0) return null; const n = parseInt(String(val).replace(/\D/g, '')); return isNaN(n) ? null : n; };
const strField = (val) => { if (!val) return null; if (typeof val === 'object') return val.text || val.textEng || null; return String(val); };

function parseItem(item, category) {
  const id = String(item.token || item.orderId || item.id || '');
  if (!id || id === 'undefined') return null;

  const make = strField(item.manufacturer);
  const model = strField(item.model);
  const yearRaw = safeInt(item.year) || safeInt(item.vehicleDates?.yearOfProduction);
  const year = yearRaw || (() => {
    const t = item.title && typeof item.title === 'string' ? item.title : '';
    const m = t.match(/\b(19|20)\d{2}\b/); return m ? safeInt(m[0]) : null;
  })();

  const title = item.title && typeof item.title === 'string'
    ? item.title
    : [make, model, year].filter(Boolean).join(' ') || null;

  const city = strField(item.city) || item.address?.city?.text || item.address?.area?.text || null;

  let images = [];
  if (Array.isArray(item.images) && item.images.length)
    images = item.images.map(img => img?.src || img).filter(s => typeof s === 'string');
  if (!images.length && item.metaData) {
    const meta = typeof item.metaData === 'string' ? JSON.parse(item.metaData) : item.metaData;
    if (meta?.coverImage) images = [meta.coverImage, ...(meta.images || [])].filter(Boolean);
  }

  const meta = item.metaData ? (typeof item.metaData === 'string' ? JSON.parse(item.metaData) : item.metaData) : null;

  return {
    source: 'yad2',
    external_id: id,
    title,
    price: safeInt(item.price),
    year,
    km: safeInt(item.kilometers),
    car_make: make,
    car_model: model,
    hand: safeInt(item.hand),
    engine_cc: safeInt(item.engineVolume),
    gear_type: item.gearBox === '1' ? 'manual' : item.gearBox === '2' ? 'auto' : null,
    seller_type: item._sourceType === 'private' ? 'private' : item.adType === 'commercial' ? 'dealer' : isDealer(item.contactName || ''),
    seller_name: item.contactName || null,
    phone: item.phone || null,
    city,
    images,
    url: `https://www.yad2.co.il/item/${id}`,
    description: meta?.description || null,
    category,
  };
}

function extractFromNextData(raw, privateKey) {
  try {
    const d = JSON.parse(raw || '{}');
    const pp = d?.props?.pageProps;
    const totalItems = pp?.totalFeedItems || 0;
    const queries = pp?.dehydratedState?.queries || [];

    for (const q of queries) {
      const data = q?.state?.data;
      if (!data) continue;

      if (privateKey && (data.private || data.solo)) {
        const items = [
          ...(data.private || []).map(i => ({ ...i, _sourceType: 'private' })),
          ...(data.solo   || []).map(i => ({ ...i, _sourceType: 'private' })),
        ];
        if (items.length) return { items, total: totalItems };
      }

      const feedItems = data?.feed_items || data?.data?.feed?.feed_items || [];
      if (feedItems.length) return { items: feedItems, total: totalItems };

      // generic: any array of objects with id/token/orderId
      for (const val of Object.values(data)) {
        if (Array.isArray(val) && val.length && (val[0]?.id || val[0]?.token || val[0]?.orderId))
          return { items: val, total: totalItems };
      }
    }
  } catch {}
  return { items: [], total: 0 };
}

async function scrapeCategory(page, cat) {
  const activeIds = [];
  const MAX_PAGES = 10;

  await page.goto(cat.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  const title = await page.title();
  if (!title.includes('יד2') && !title.includes('yad2')) {
    console.log(`[yad2/${cat.id}] bot block, skipping`);
    return 0;
  }

  const raw1 = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent || '{}');
  const { items: page1Items, total } = extractFromNextData(raw1, cat.privateKey);

  const itemsPerPage = page1Items.length || 20;
  const totalPages = Math.min(MAX_PAGES, Math.ceil(total / itemsPerPage));
  console.log(`[yad2/${cat.id}] page 1: ${page1Items.length} items | total: ${total} | pages: ${totalPages}`);

  const allItems = [...page1Items];

  for (let p = 2; p <= totalPages; p++) {
    await page.waitForTimeout(2000 + Math.random() * 2000);
    await page.goto(`${cat.url}?page=${p}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    const rawP = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent || '{}');
    const { items } = extractFromNextData(rawP, cat.privateKey);
    console.log(`[yad2/${cat.id}] page ${p}: ${items.length} items`);
    allItems.push(...items);
  }

  const seen = new Set();
  for (const item of allItems) {
    const id = String(item.token || item.orderId || item.id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const parsed = parseItem(item, cat.id);
    if (!parsed) continue;
    await upsertListing(parsed);
    activeIds.push(parsed.external_id);
  }

  await markInactive('yad2', activeIds, cat.id);
  console.log(`[yad2/${cat.id}] done — ${activeIds.length} saved`);
  return activeIds.length;
}

async function freshPage(browser) {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'he-IL',
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'he-IL,he;q=0.9' },
  });
  return { ctx, page: await ctx.newPage() };
}

export async function scrapeYad2Category(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0];
  console.log(`[yad2] launching browser for category: ${cat.id}`);
  await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const { ctx, page } = await freshPage(browser);
  let total = 0;
  try {
    total = await scrapeCategory(page, cat);
  } finally {
    await ctx.close();
    await browser.close();
  }
  return total;
}

export async function scrapeYad2() {
  console.log('[yad2] launching browser...');
  await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000));

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  let total = 0;

  try {
    for (const cat of CATEGORIES) {
      const { ctx, page } = await freshPage(browser);
      try {
        total += await scrapeCategory(page, cat);
      } finally {
        await ctx.close();
      }
      // הפסקה בין קטגוריות + session חדש
      await new Promise(r => setTimeout(r, 8000 + Math.random() * 7000));
    }
  } finally {
    await browser.close();
  }

  console.log(`[yad2] all categories done — ${total} total saved`);
  return total;
}
