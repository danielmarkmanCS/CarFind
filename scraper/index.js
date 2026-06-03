import 'dotenv/config';
import { scrapeYad2Category } from './yad2.js';
import { pool } from './db.js';

// רוטציה: כל שעה קטגוריה אחרת
const ROTATION = ['vehicles', 'real-estate', 'products', 'jobs', 'pets'];

async function main() {
  const hour = new Date().getHours();
  const cat = ROTATION[hour % ROTATION.length];
  console.log(`CarFind scraper starting — category: ${cat}`, new Date().toISOString());
  const count = await scrapeYad2Category(cat).catch(err => { console.error('[yad2]', err.message); return 0; });
  console.log(`\nDone. ${cat}: ${count}`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
