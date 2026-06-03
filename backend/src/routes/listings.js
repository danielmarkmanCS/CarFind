import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const {
    make, model, year_min, year_max, km_max, price_max,
    private_only, source, page = 1, limit = 24
  } = req.query;

  const conditions = ['active = TRUE'];
  const params = [];
  let i = 1;

  if (private_only === 'true') {
    conditions.push(`seller_type = 'private'`);
  }
  if (make) {
    conditions.push(`LOWER(car_make) LIKE LOWER($${i++})`);
    params.push(`%${make}%`);
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
});

router.get('/makes', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT car_make FROM listings
     WHERE car_make IS NOT NULL AND active = TRUE
     ORDER BY car_make`
  );
  res.json(rows.map(r => r.car_make));
});

router.get('/stats', async (_req, res) => {
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
});

export default router;
