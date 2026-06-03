import 'dotenv/config';
import { scrapeYad2 } from './yad2.js';
import { pool } from './db.js';

async function main() {
  console.log('CarFind scraper starting...', new Date().toISOString());
  const yad2Count = await scrapeYad2().catch(err => { console.error('[yad2]', err.message); return 0; });
  console.log(`\nDone. Yad2: ${yad2Count}`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
