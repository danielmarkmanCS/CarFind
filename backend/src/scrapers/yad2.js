import { chromium } from 'playwright';
import { classify } from '../services/dealerDetection.js';
import { upsertListing, markInactive } from '../services/dedup.js';

const YAD2_URL = 'https://www.yad2.co.il/vehicles/cars';

export async function scrapeYad2() {
  console.log('[yad2] starting scrape...');
  const activeIds = [];
  const apiItems = [];

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      locale: 'he-IL',
    });

    const page = await context.newPage();

    // capture ALL json responses to find the right API URL
    page.on('response', async (response) => {
      const url = response.url();
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      try {
        const json = await response.json();
        const items =
          json?.data?.feed?.feed_items ||
          json?.feed?.feed_items ||
          json?.feed_items ||
          json?.data?.items ||
          json?.items ||
          [];
        if (items.length > 0) {
          console.log(`[yad2] intercepted ${items.length} items from: ${url}`);
          apiItems.push(...items);
        }
      } catch {}
    });

    console.log('[yad2] loading page...');
    await page.goto(YAD2_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    console.log(`[yad2] API captured ${apiItems.length} items. Trying DOM fallback...`);

    // DOM fallback — extract from rendered page
    if (apiItems.length === 0) {
      const domItems = await page.evaluate(() => {
        const cards = document.querySelectorAll('[class*="feed-item"], [class*="feedItem"], [data-item-id]');
        return Array.from(cards).map(card => ({
          id: card.getAttribute('data-item-id') || card.getAttribute('id'),
          title: card.querySelector('[class*="title"]')?.textContent?.trim(),
          price: card.querySelector('[class*="price"]')?.textContent?.trim(),
          year: card.querySelector('[class*="year"]')?.textContent?.trim(),
          km: card.querySelector('[class*="km"], [class*="kilometers"]')?.textContent?.trim(),
          city: card.querySelector('[class*="city"]')?.textContent?.trim(),
          image: card.querySelector('img')?.src,
          href: card.querySelector('a')?.href,
        }));
      });

      console.log(`[yad2] DOM extracted ${domItems.length} items`);

      for (const item of domItems) {
        if (!item.id && !item.href) continue;
        const priceNum = item.price ? parseInt(item.price.replace(/\D/g, '')) : null;
        const kmNum = item.km ? parseInt(item.km.replace(/\D/g, '')) : null;
        const yearNum = item.year ? parseInt(item.year.match(/\d{4}/)?.[0]) : null;
        const extId = item.id || item.href?.split('/').pop();
        if (!extId) continue;

        const parsed = {
          source: 'yad2',
          external_id: String(extId),
          title: item.title || null,
          price: priceNum,
          year: yearNum,
          km: kmNum,
          car_make: null,
          car_model: null,
          hand: null,
          engine_cc: null,
          gear_type: null,
          seller_type: 'unknown',
          seller_name: null,
          phone: null,
          city: item.city || null,
          images: item.image ? [item.image] : [],
          url: item.href || `https://www.yad2.co.il/item/${extId}`,
          description: null,
        };

        await upsertListing(parsed);
        activeIds.push(parsed.external_id);
      }
    } else {
      // use API items
      for (const item of apiItems) {
        const parsed = {
          source: 'yad2',
          external_id: String(item.id || item.orderId || item.token),
          title: item.title || `${item.manufacturer || ''} ${item.model || ''} ${item.year || ''}`.trim(),
          price: item.price ? parseInt(String(item.price).replace(/\D/g, '')) : null,
          year: item.year ? parseInt(item.year) : null,
          km: item.kilometers ? parseInt(String(item.kilometers).replace(/\D/g, '')) : null,
          car_make: item.manufacturer || null,
          car_model: item.model || null,
          hand: item.hand ? parseInt(item.hand) : null,
          engine_cc: null,
          gear_type: item.gearBox === '1' ? 'manual' : item.gearBox === '2' ? 'auto' : null,
          seller_type: 'unknown',
          seller_name: item.contactName || null,
          phone: item.phone || null,
          city: item.city || null,
          images: (item.images || []).map(img => img.src || img).filter(Boolean),
          url: `https://www.yad2.co.il/item/${item.id || item.orderId}`,
          description: item.metaData || null,
        };
        parsed.seller_type = await classify(parsed.phone, parsed.seller_name);
        await upsertListing(parsed);
        activeIds.push(parsed.external_id);
      }
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
