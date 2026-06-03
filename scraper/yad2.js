import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import { upsertListing, markInactive } from './dedup.js';

chromium.use(StealthPlugin());

const DEALER_KEYWORDS = ['סוכנות','מוסך','ליסינג','יבואן','דילר','dealer','motors','auto','cars','garage'];
function isDealer(name = '') {
  return DEALER_KEYWORDS.some(k => name.toLowerCase().includes(k)) ? 'dealer' : 'unknown';
}

const safeInt = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(String(val).replace(/\D/g, ''));
  return isNaN(n) ? null : n;
};

function strField(val) {
  if (!val) return null;
  if (typeof val === 'object') return val.text || val.textEng || null;
  return String(val);
}

function parseItem(item) {
  const id = String(item.token || item.orderId || item.id || '');
  if (!id || id === 'undefined') return null;

  const make = strField(item.manufacturer);
  const model = strField(item.model);
  // year: direct field OR nested vehicleDates OR extracted from title
  const yearRaw = safeInt(item.year) || safeInt(item.vehicleDates?.yearOfProduction);
  const year = yearRaw || (() => {
    const t = item.title && typeof item.title === 'string' ? item.title : '';
    const m = t.match(/\b(19|20)\d{2}\b/);
    return m ? safeInt(m[0]) : null;
  })();
  const title = item.title && typeof item.title === 'string'
    ? item.title
    : [make, model, year].filter(Boolean).join(' ') || null;

  // city: direct field OR nested address
  const city = strField(item.city)
    || item.address?.city?.text
    || item.address?.area?.text
    || null;

  // images: direct array OR metaData object
  let images = [];
  if (Array.isArray(item.images) && item.images.length) {
    images = item.images.map(img => img?.src || img).filter(s => typeof s === 'string');
  }
  if (!images.length && item.metaData) {
    const meta = typeof item.metaData === 'string' ? JSON.parse(item.metaData) : item.metaData;
    if (meta?.coverImage) images = [meta.coverImage, ...(meta.images || [])].filter(Boolean);
  }

  const meta = item.metaData
    ? (typeof item.metaData === 'string' ? JSON.parse(item.metaData) : item.metaData)
    : null;

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
  };
}

export async function scrapeYad2() {
  console.log('[yad2] launching browser...');
  const activeIds = [];
  const allItems = [];

  // small random delay to avoid rapid-fire detection
  await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000));

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'he-IL',
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'he-IL,he;q=0.9' },
  });

  const page = await context.newPage();

  // capture all JSON responses
  page.on('response', async (response) => {
    const url = response.url();
    if (!(response.headers()['content-type'] || '').includes('json')) return;
    try {
      const json = await response.json();

      // recommendations endpoint
      const recItems = json?.data?.flat?.() || [];
      if (recItems.length && url.includes('recommendations')) {
        console.log(`[yad2] recommendations: ${recItems.length} items`);
        allItems.push(...recItems);
      }

      // feed-search endpoint
      const feedItems = json?.data?.feed?.feed_items || json?.feed_items || [];
      if (feedItems.length) {
        console.log(`[yad2] feed: ${feedItems.length} items from ${url.substring(0, 80)}`);
        allItems.push(...feedItems);
      }
    } catch {}
  });

  const MAX_PAGES = 10;

  function extractNextData(raw) {
    try {
      const d = JSON.parse(raw || '{}');
      const pp = d?.props?.pageProps;
      const feedQuery = pp?.dehydratedState?.queries
        ?.find(q => JSON.stringify(q.queryKey).includes('"feed","vehicles"'));
      const data = feedQuery?.state?.data;
      const totalItems = pp?.totalFeedItems || 0;
      if (!data) return { items: [], total: totalItems };
      const privateItems = (data.private || []).map(i => ({ ...i, _sourceType: 'private' }));
      const soloItems = (data.solo || []).map(i => ({ ...i, _sourceType: 'private' }));
      return { items: [...privateItems, ...soloItems], total: totalItems };
    } catch { return { items: [], total: 0 }; }
  }

  try {
    // page 1
    await page.goto('https://www.yad2.co.il/vehicles/cars', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    const title = await page.title();
    if (!title.includes('יד2') && !title.includes('yad2')) {
      console.log(`[yad2] bot block detected (title: "${title}"), aborting`);
      return 0;
    }
    console.log(`[yad2] page loaded: "${title}"`);

    const raw1 = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent || '{}');
    const { items: page1Items, total } = extractNextData(raw1);
    allItems.push(...page1Items);

    const itemsPerPage = page1Items.length || 20;
    const totalPages = Math.min(MAX_PAGES, Math.ceil(total / itemsPerPage));
    console.log(`[yad2] page 1: ${page1Items.length} items | total: ${total} | pages to scrape: ${totalPages}`);

    // pages 2+
    for (let p = 2; p <= totalPages; p++) {
      await page.waitForTimeout(2000 + Math.random() * 2000);
      await page.goto(`https://www.yad2.co.il/vehicles/cars?page=${p}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(4000);

      const rawP = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent || '{}');
      const { items: pageItems } = extractNextData(rawP);
      console.log(`[yad2] page ${p}: ${pageItems.length} items`);
      allItems.push(...pageItems);
    }

    // deduplicate by external_id
    const seen = new Set();
    const unique = allItems.filter(i => {
      const id = String(i.token || i.orderId || i.id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    console.log(`[yad2] total unique items: ${unique.length}`);

    for (const item of unique) {
      const parsed = parseItem(item);
      if (!parsed) continue;
      await upsertListing(parsed);
      activeIds.push(parsed.external_id);
    }

  } finally {
    await context.close();
    await browser.close();
  }

  await markInactive('yad2', activeIds);
  console.log(`[yad2] done — ${activeIds.length} listings saved`);
  return activeIds.length;
}
