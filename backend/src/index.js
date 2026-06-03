import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import listingsRouter from './routes/listings.js';
import alertsRouter from './routes/alerts.js';
import { scrapeYad2 } from './scrapers/yad2.js';
import { scrapeWinwin } from './scrapers/winwin.js';
import cron from 'node-cron';
import { sendAlerts } from './services/alerts.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.use('/listings', listingsRouter);
app.use('/alerts', alertsRouter);

const scrapeStatus = { lastRun: null, lastError: null, yad2Count: 0 };

app.get('/health', (_req, res) => res.json({ ok: true, ...scrapeStatus }));

app.get('/debug/yad2', async (_req, res) => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.goto('https://www.yad2.co.il/vehicles/cars', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const title = await page.title();
    const url = page.url();
    const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 500));
    const cardCount = await page.evaluate(() =>
      document.querySelectorAll('[class*="feed-item"], [class*="feedItem"], [data-item-id]').length
    );
    await browser.close();
    res.json({ title, url, cardCount, bodySnippet });
  } catch (err) {
    await browser.close();
    res.status(500).json({ error: err.message });
  }
});

app.post('/scrape/run', async (_req, res) => {
  res.json({ started: true });
  scrapeStatus.lastRun = new Date().toISOString();
  scrapeStatus.lastError = null;
  try {
    await scrapeYad2();
    const { rows } = await (await import('./db.js')).pool.query(`SELECT COUNT(*) FROM listings WHERE source='yad2'`);
    scrapeStatus.yad2Count = parseInt(rows[0].count);
  } catch (err) {
    scrapeStatus.lastError = err.message;
    console.error('[scrape/run] error:', err.message);
  }
  await scrapeWinwin().catch(err => console.error('[winwin]', err.message));
  await sendAlerts().catch(() => {});
});

// Cron כל שעה
cron.schedule('0 * * * *', async () => {
  console.log('[cron] hourly scrape started');
  await scrapeYad2();
  await scrapeWinwin();
  await sendAlerts();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CarFind backend running on :${PORT}`));
