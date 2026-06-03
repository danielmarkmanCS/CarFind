import { pool } from '../db.js';

const DEALER_KEYWORDS = [
  'סוכנות', 'מוסך', 'ליסינג', 'יבואן', 'דילר', 'dealer',
  'מכירת רכבים', 'יד שלישית', 'center', 'motors', 'auto',
  'cars', 'garage', 'trade'
];

// אם לאותו מספר טלפון יש >= N מודעות → סוחר
const DEALER_LISTING_THRESHOLD = 3;

export function detectByName(sellerName = '') {
  const lower = sellerName.toLowerCase();
  return DEALER_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()))
    ? 'dealer'
    : 'unknown';
}

export async function detectByPhone(phone) {
  if (!phone) return 'unknown';
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM listings WHERE phone = $1 AND active = TRUE`,
    [phone]
  );
  return parseInt(rows[0].count) >= DEALER_LISTING_THRESHOLD ? 'dealer' : 'private';
}

export async function classify(phone, sellerName) {
  if (detectByName(sellerName) === 'dealer') return 'dealer';
  return detectByPhone(phone);
}
