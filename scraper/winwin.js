import axios from 'axios';
import * as cheerio from 'cheerio';
import { upsertListing, markInactive } from './dedup.js';

const BASE = 'https://www.winwin.co.il/private-cars';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept-Language': 'he-IL,he;q=0.9',
};

export async function scrapeWinwin() {
  console.log('[winwin] scraping...');
  const activeIds = [];

  try {
    const { data } = await axios.get(BASE, { headers: HEADERS, timeout: 30000 });
    const $ = cheerio.load(data);

    $('[class*="listing-item"], [class*="feed-item"], article, [class*="item-row"]').each(async (_, el) => {
      const $el = $(el);
      const link = $el.find('a[href*="/item/"]').attr('href') || '';
      const external_id = link.match(/\/item\/(\d+)/)?.[1];
      if (!external_id) return;

      const priceText = $el.find('[class*="price"]').text().replace(/\D/g, '');
      const details = $el.find('[class*="details"], [class*="specs"]').text();
      const yearMatch = details.match(/20\d{2}|19\d{2}/);
      const kmMatch = details.match(/([\d,]+)\s*ק"מ/);

      const parsed = {
        source: 'winwin',
        external_id,
        title: $el.find('[class*="title"]').text().trim() || null,
        price: priceText ? parseInt(priceText) : null,
        year: yearMatch ? parseInt(yearMatch[0]) : null,
        km: kmMatch ? parseInt(kmMatch[1].replace(',', '')) : null,
        car_make: null, car_model: null, hand: null, engine_cc: null, gear_type: null,
        seller_type: 'private',
        seller_name: null, phone: null,
        city: $el.find('[class*="city"], [class*="location"]').text().trim() || null,
        images: [$el.find('img').first().attr('src')].filter(Boolean),
        url: link.startsWith('http') ? link : `https://www.winwin.co.il${link}`,
        description: null,
      };

      await upsertListing(parsed);
      activeIds.push(external_id);
    });
  } catch (err) {
    console.error('[winwin] error:', err.message);
  }

  await markInactive('winwin', activeIds);
  console.log(`[winwin] done — ${activeIds.length} listings saved`);
  return activeIds.length;
}
