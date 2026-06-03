import { pool } from '../db.js';

export async function sendAlerts() {
  const { rows: searches } = await pool.query(`SELECT * FROM saved_searches`);

  for (const search of searches) {
    const conditions = [`l.active = TRUE`];
    const params = [];
    let i = 1;

    if (search.private_only) {
      conditions.push(`l.seller_type = 'private'`);
    }
    if (search.car_make) {
      conditions.push(`LOWER(l.car_make) = LOWER($${i++})`);
      params.push(search.car_make);
    }
    if (search.car_model) {
      conditions.push(`LOWER(l.car_model) = LOWER($${i++})`);
      params.push(search.car_model);
    }
    if (search.year_min) {
      conditions.push(`l.year >= $${i++}`);
      params.push(search.year_min);
    }
    if (search.year_max) {
      conditions.push(`l.year <= $${i++}`);
      params.push(search.year_max);
    }
    if (search.km_max) {
      conditions.push(`l.km <= $${i++}`);
      params.push(search.km_max);
    }
    if (search.price_max) {
      conditions.push(`l.price <= $${i++}`);
      params.push(search.price_max);
    }

    // רק מודעות שלא נשלחה עליהן התראה
    conditions.push(`
      l.id NOT IN (
        SELECT listing_id FROM alert_logs WHERE saved_search_id = $${i++}
      )
    `);
    params.push(search.id);

    // רק מודעות משעה האחרונה
    conditions.push(`l.first_seen_at > NOW() - INTERVAL '2 hours'`);

    const query = `
      SELECT l.* FROM listings l
      WHERE ${conditions.join(' AND ')}
      ORDER BY l.first_seen_at DESC
      LIMIT 20
    `;

    const { rows: newListings } = await pool.query(query, params);

    if (!newListings.length) continue;

    await sendEmail(search.user_email, search.label, newListings);

    for (const listing of newListings) {
      await pool.query(
        `INSERT INTO alert_logs (saved_search_id, listing_id) VALUES ($1, $2)`,
        [search.id, listing.id]
      );
    }
  }
}

async function sendEmail(to, searchLabel, listings) {
  if (!process.env.RESEND_API_KEY) return;

  const items = listings.map(l => `
    <div style="border:1px solid #eee;padding:12px;margin:8px 0;border-radius:6px;">
      <strong>${l.title}</strong><br/>
      💰 ${l.price?.toLocaleString('he-IL')} ₪ &nbsp;|&nbsp;
      📅 ${l.year} &nbsp;|&nbsp;
      🛣️ ${l.km?.toLocaleString('he-IL')} ק"מ<br/>
      🏙️ ${l.city || '—'} &nbsp;|&nbsp; 📱 ${l.phone || '—'}<br/>
      <a href="${l.url}">צפה במודעה ←</a>
    </div>
  `).join('');

  const body = JSON.stringify({
    from: 'CarFind <alerts@danielmms.site>',
    to,
    subject: `🚗 ${listings.length} רכבים חדשים — ${searchLabel || 'חיפוש שמור'}`,
    html: `<div dir="rtl" style="font-family:Arial">${items}</div>`,
  });

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body,
  });
}
