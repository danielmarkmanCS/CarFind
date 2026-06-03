import { chromium } from 'playwright';
import { classify } from '../services/dealerDetection.js';
import { upsertListing, markInactive } from '../services/dedup.js';

const YAD2_URL = 'https://www.yad2.co.il/vehicles/cars';

function parseItem(item) {
  return {
    source: 'yad2',
    external_id: String(item.id || item.orderId || item.token),
    title: item.title || `${item.manufacturer || ''} ${item.model || ''} ${item.year || ''}`.trim(),
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
    images: (item.images || []).map(img => img.src || img).filter(Boolean),
    url: `https://www.yad2.co.il/item/${item.id || item.orderId || item.token}`,
    description: item.metaData || item.info_text || null,
  };
}

export async function scrapeYad2() {
  console.log('[yad2] starting scrape with Playwright...');
  const activeIds = [];

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      locale: 'he-IL',
    });

    const page = await context.newPage();
    const collectedItems = [];

    // intercept Yad2 API responses
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('feed-search') || url.includes('/vehicles/cars') && url.includes('page=')) {
        try {
          const json = await response.json();
          const items = json?.data?.feed?.feed_items || json?.feed_items || [];
          collectedItems.push(...items.filter(i => i.id || i.orderId || i.token));
        } catch {}
      }
    });

    await page.goto(YAD2_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // scroll to trigger more loads
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await page.waitForTimeout(2000);
    }

    console.log(`[yad2] collected ${collectedItems.length} items from page intercept`);

    for (const item of collectedItems) {
      const parsed = parseItem(item);
      parsed.seller_type = await classify(parsed.phone, parsed.seller_name);
      await upsertListing(parsed);
      activeIds.push(parsed.external_id);
    }

    await context.close();
  } catch (err) {
    console.error('[yad2] error:', err.message);
  } finally {
    await browser.close();
  }

  await markInactive('yad2', activeIds);
  console.log(`[yad2] done. ${activeIds.length} listings saved.`);
}
