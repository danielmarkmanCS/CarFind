import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

const HE_EN = {
  'רכב': 'car', 'מכונית': 'car', 'אוטו': 'car', 'ג׳יפ': 'jeep',
  'טלוויזיה': 'tv television', 'מחשב': 'computer laptop', 'טלפון': 'phone',
  'אייפון': 'iphone', 'סמסונג': 'samsung', 'אייפד': 'ipad',
  'ספה': 'sofa couch', 'כיסא': 'chair', 'שולחן': 'table desk',
  'מיטה': 'bed', 'ארון': 'wardrobe closet',
  'נעל': 'shoes', 'חולצה': 'shirt', 'מכנסיים': 'pants jeans',
  'אופניים': 'bicycle bike', 'קורקינט': 'scooter',
  'כלב': 'dog', 'חתול': 'cat',
  'דירה': 'apartment', 'חדר': 'room', 'שכירות': 'rent',
};

function expandQuery(q = '') {
  if (!q) return q;
  const lower = q.toLowerCase();
  for (const [he, en] of Object.entries(HE_EN)) {
    if (lower.includes(he)) return `${q} ${en}`;
  }
  return q;
}

router.get('/', async (req, res) => {
  try {
    const {
      make, model, year_min, year_max, km_max, price_max,
      private_only, source, category, q,
      page = 1, limit = 24
    } = req.query;

    const conditions = ['active = TRUE'];
    const params = [];
    let i = 1;

    if (private_only === 'true') {
      conditions.push(`seller_type = 'private'`);
    }
    if (make) {
      conditions.push(`(LOWER(car_make) LIKE LOWER($${i}) OR LOWER(title) LIKE LOWER($${i}))`);
      params.push(`%${make}%`);
      i++;
    }
    if (model) {
      conditions.push(`LOWER(car_model) LIKE LOWER($${i++})`);
      params.push(`%${model}%`);
    }
    if (year_min) {
      conditions.push(`year >= $${i++}`);
      params.push(parseInt(year_min));
    }
    if (year_max) {
      conditions.push(`year <= $${i++}`);
      params.push(parseInt(year_max));
    }
    if (km_max) {
      conditions.push(`km <= $${i++}`);
      params.push(parseInt(km_max));
    }
    if (price_max) {
      conditions.push(`price <= $${i++}`);
      params.push(parseInt(price_max));
    }
    if (source) {
      conditions.push(`source = $${i++}`);
      params.push(source);
    }
    if (category) {
      conditions.push(`category = $${i++}`);
      params.push(category);
    }
    if (q) {
      const expanded = expandQuery(q);
      if (expanded !== q) {
        // Hebrew + English
        conditions.push(`(LOWER(title) LIKE LOWER($${i}) OR LOWER(description) LIKE LOWER($${i}) OR LOWER(title) LIKE LOWER($${i+1}) OR LOWER(description) LIKE LOWER($${i+1}))`);
        params.push(`%${q}%`, `%${expanded}%`);
        i += 2;
      } else {
        conditions.push(`(LOWER(title) LIKE LOWER($${i}) OR LOWER(description) LIKE LOWER($${i}))`);
        params.push(`%${q}%`);
        i++;
      }
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = conditions.join(' AND ');

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `SELECT * FROM listings WHERE ${where}
         ORDER BY first_seen_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, parseInt(limit), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM listings WHERE ${where}`, params),
    ]);

    res.json({
      listings: rows,
      total: parseInt(countRows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countRows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    console.error('[listings] error:', err.message);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

router.get('/makes', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT car_make FROM listings
       WHERE car_make IS NOT NULL AND active = TRUE
       ORDER BY car_make`
    );
    res.json(rows.map(r => r.car_make));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chrome Extension endpoint
router.post('/bulk', async (req, res) => {
  const { listings } = req.body;
  if (!Array.isArray(listings)) return res.status(400).json({ error: 'listings array required' });

  let inserted = 0;
  for (const l of listings) {
    if (!l.source || !l.external_id) continue;
    try {
      await pool.query(
        `INSERT INTO listings (source,external_id,title,price,year,km,car_make,car_model,seller_type,phone,city,images,url,description,seller_name,category)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (source,external_id) DO UPDATE SET
           price=EXCLUDED.price, title=EXCLUDED.title, last_seen_at=NOW(), active=TRUE, category=EXCLUDED.category`,
        [l.source, l.external_id, l.title, l.price, l.year, l.km,
         l.car_make, l.car_model, l.seller_type || 'private',
         l.phone, l.city, l.images || [], l.url, l.description, l.seller_name,
         l.category || 'general']
      );
      inserted++;
    } catch {}
  }
  res.json({ inserted });
});

router.get('/stats', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        source,
        COUNT(*) FILTER (WHERE active) AS active,
        COUNT(*) FILTER (WHERE seller_type = 'private' AND active) AS private_count,
        COUNT(*) FILTER (WHERE seller_type = 'dealer' AND active) AS dealer_count,
        MAX(last_seen_at) AS last_scraped
      FROM listings
      GROUP BY source
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
