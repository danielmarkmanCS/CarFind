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
  const year = safeInt(item.year);
  const title = item.title && typeof item.title === 'string'
    ? item.title
    : [make, model, year].filter(Boolean).join(' ') || null;

  // images: try item.images, then metaData.coverImage/images
  let images = [];
  if (Array.isArray(item.images) && item.images.length) {
    images = item.images.map(img => img?.src || img).filter(s => typeof s === 'string');
  }
  if (!images.length && item.metaData) {
    try {
      const meta = typeof item.metaData === 'string' ? JSON.parse(item.metaData) : item.metaData;
      if (meta.coverImage) images = [meta.coverImage, ...(meta.images || [])];
    } catch {}
  }

  const descText = (() => {
    if (!item.metaData) return null;
    try {
      const meta = typeof item.metaData === 'string' ? JSON.parse(item.metaData) : item.metaData;
      return meta.description || null;
    } catch { return null; }
  })();

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
    engine_cc: null,
    gear_type: item.gearBox === '1' ? 'manual' : item.gearBox === '2' ? 'auto' : null,
    seller_type: item._sourceType === 'private' ? 'private' : item.adType === 'commercial' ? 'dealer' : isDealer(item.contactName || ''),
    seller_name: item.contactName || null,
    phone: item.phone || null,
    city: strField(item.city),
    images,
    url: `https://www.yad2.co.il/item/${id}`,
    description: descText,
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

  try {
    await page.goto('https://www.yad2.co.il/vehicles/cars', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    // verify we're on the real page, not bot-blocked
    const title = await page.title();
    if (!title.includes('יד2') && !title.includes('yad2')) {
      console.log(`[yad2] bot block detected (title: "${title}"), aborting`);
      return 0;
    }
    console.log(`[yad2] page loaded: "${title}"`);

    // extract feed from __NEXT_DATA__ (SSR embedded data)
    const nextDataItems = await page.evaluate(() => {
      try {
        const d = JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent || '{}');
        const feedQuery = d?.props?.pageProps?.dehydratedState?.queries
          ?.find(q => JSON.stringify(q.queryKey).includes('"feed","vehicles"'));
        const data = feedQuery?.state?.data;
        if (!data) return [];
        const privateItems = (data.private || []).map(i => ({ ...i, _sourceType: 'private' }));
        const soloItems = (data.solo || []).map(i => ({ ...i, _sourceType: 'private' }));
        return [...privateItems, ...soloItems];
      } catch { return []; }
    });

    console.log(`[yad2] __NEXT_DATA__ items: ${nextDataItems.length} (private+solo)`);
    if (nextDataItems.length) allItems.push(...nextDataItems);

    // fallback: scroll to trigger dynamic load
    if (allItems.length === 0) {
      for (let i = 0; i < 6; i++) {
        await page.evaluate(() => window.scrollBy(0, 600));
        await page.waitForTimeout(1500);
      }
      await page.waitForTimeout(3000);
    }

    console.log(`[yad2] total items collected: ${allItems.length}`);

    for (const item of allItems) {
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
