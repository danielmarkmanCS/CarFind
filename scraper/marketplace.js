import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { readFileSync } from 'fs';
import { upsertListing, markInactive } from './dedup.js';

chromium.use(StealthPlugin());

const MARKETPLACE_CATEGORIES = [
  { id: 'vehicles',    url: 'https://www.facebook.com/marketplace/category/vehicles' },
  { id: 'real-estate', url: 'https://www.facebook.com/marketplace/category/property-rentals' },
  { id: 'products',    url: 'https://www.facebook.com/marketplace/category/electronics' },
];

function parseCard(link, category) {
  const href = link.href || '';
  const external_id = href.match(/\/item\/(\d+)/)?.[1];
  if (!external_id) return null;

  let container = link;
  for (let i = 0; i < 6; i++) {
    if (!container.parentElement) break;
    container = container.parentElement;
    if (container.querySelectorAll('span').length >= 2) break;
  }

  const spans = Array.from(container.querySelectorAll('span')).map(s => s.textContent?.trim()).filter(Boolean);
  const img = container.querySelector('img')?.src;
  const allText = spans.join(' ');

  const priceText = spans.find(t => t.match(/[\d,]{3,}/));
  const title = spans.find(t => t.length > 5 && !t.match(/^[\d,₪$\s]+$/));

  const yearMatch = allText.match(/\b(19|20)\d{2}\b/);
  const kmMatch = allText.match(/([\d,]+)\s*k?m/i);

  return {
    source: 'marketplace',
    external_id,
    title: title || null,
    price: priceText ? parseInt(priceText.replace(/\D/g, '')) : null,
    year: yearMatch ? parseInt(yearMatch[0]) : null,
    km: kmMatch ? parseInt(kmMatch[1].replace(',', '')) : null,
    car_make: null,
    car_model: null,
    seller_type: 'private',
    phone: null,
    city: null,
    images: img ? [img] : [],
    url: `https://www.facebook.com/marketplace/item/${external_id}/`,
    category,
  };
}

async function scrapeCategory(context, cat) {
  const page = await context.newPage();
  const activeIds = [];

  try {
    await page.goto(cat.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);

    // גלול לטעינת תוצאות
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(1500);
    }

    const listings = await page.evaluate((category) => {
      const links = document.querySelectorAll('a[href*="/marketplace/item/"]');
      const results = [];
      links.forEach(link => {
        let container = link;
        for (let i = 0; i < 6; i++) {
          if (!container.parentElement) break;
          container = container.parentElement;
          if (container.querySelectorAll('span').length >= 2) break;
        }
        const spans = Array.from(container.querySelectorAll('span')).map(s => s.textContent?.trim()).filter(Boolean);
        const img = container.querySelector('img')?.src;
        const allText = spans.join(' ');
        const external_id = (link.href || '').match(/\/item\/(\d+)/)?.[1];
        if (!external_id) return;
        const priceText = spans.find(t => t.match(/[\d,]{3,}/));
        const title = spans.find(t => t.length > 5 && !t.match(/^[\d,₪$\s]+$/));
        const yearMatch = allText.match(/\b(19|20)\d{2}\b/);
        const kmMatch = allText.match(/([\d,]+)\s*k?m/i);
        results.push({
          source: 'marketplace', external_id,
          title: title || null,
          price: priceText ? parseInt(priceText.replace(/\D/g, '')) : null,
          year: yearMatch ? parseInt(yearMatch[0]) : null,
          km: kmMatch ? parseInt(kmMatch[1].replace(',', '')) : null,
          car_make: null, car_model: null, seller_type: 'private',
          phone: null, city: null,
          images: img ? [img] : [],
          url: `https://www.facebook.com/marketplace/item/${external_id}/`,
          category,
        });
      });
      return results;
    }, cat.id);

    console.log(`[marketplace/${cat.id}] found ${listings.length} listings`);

    for (const l of listings) {
      await upsertListing(l);
      activeIds.push(l.external_id);
    }
  } finally {
    await page.close();
  }

  return activeIds.length;
}

export async function scrapeMarketplace() {
  let cookiesData;
  try {
    cookiesData = JSON.parse(readFileSync('./fb-cookies.json', 'utf8'));
  } catch {
    console.log('[marketplace] fb-cookies.json not found — run setup-facebook.js first');
    return 0;
  }

  console.log('[marketplace] launching browser...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'he-IL',
  });

  await context.addCookies(cookiesData);

  let total = 0;
  try {
    for (const cat of MARKETPLACE_CATEGORIES) {
      total += await scrapeCategory(context, cat);
      await new Promise(r => setTimeout(r, 5000 + Math.random() * 5000));
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`[marketplace] done — ${total} total`);
  return total;
}
