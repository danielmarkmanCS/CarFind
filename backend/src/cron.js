import cron from 'node-cron';
import { scrapeYad2 } from './scrapers/yad2.js';
import { scrapeWinwin } from './scrapers/winwin.js';
import { sendAlerts } from './services/alerts.js';

async function runAll() {
  console.log('[cron] scrape cycle started', new Date().toISOString());
  await scrapeYad2();
  await scrapeWinwin();
  await sendAlerts();
  console.log('[cron] scrape cycle done');
}

// כל שעה
cron.schedule('0 * * * *', runAll);

// הרצה ראשונה מיד בעלייה
runAll();
