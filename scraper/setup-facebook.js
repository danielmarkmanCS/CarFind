/**
 * הרץ פעם אחת: node setup-facebook.js
 * יפתח דפדפן, תתחבר ל-Facebook, ישמור cookies לקובץ
 */
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync } from 'fs';

chromium.use(StealthPlugin());

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
});
const page = await context.newPage();

console.log('נפתח דפדפן — התחבר ל-Facebook ואז חזור לכאן ולחץ ENTER');
await page.goto('https://www.facebook.com/login');

// חכה שהמשתמש יתחבר ידנית
await new Promise(resolve => {
  process.stdin.once('data', resolve);
  console.log('לאחר ההתחברות לחץ ENTER...');
});

const cookies = await context.cookies('https://www.facebook.com');
writeFileSync('./fb-cookies.json', JSON.stringify(cookies, null, 2));
console.log(`✓ נשמרו ${cookies.length} cookies ל-fb-cookies.json`);

await browser.close();
process.exit(0);
