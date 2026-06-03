import 'dotenv/config';
import { scrapeYad2Category } from './yad2.js';
import { scrapeMarketplace } from './marketplace.js';
import { pool } from './db.js';

const ROTATION = ['vehicles', 'real-estate', 'products', 'jobs', 'pets'];

async function main() {
  const hour = new Date().getHours();
  const cat = ROTATION[hour % ROTATION.length];
  console.log(`CarFind scraper starting — yad2: ${cat}, marketplace: all`, new Date().toISOString());

  await scrapeYad2Category(cat).catch(err => console.error('[yad2]', err.message));
  await scrapeMarketplace().catch(err => console.error('[marketplace]', err.message));

  console.log('\nDone.');
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
