import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.post('/', async (req, res) => {
  const { user_email, label, car_make, car_model, year_min, year_max, km_max, price_max, private_only = true } = req.body;
  if (!user_email) return res.status(400).json({ error: 'user_email required' });

  const { rows } = await pool.query(
    `INSERT INTO saved_searches
      (user_email, label, car_make, car_model, year_min, year_max, km_max, price_max, private_only)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [user_email, label, car_make, car_model, year_min, year_max, km_max, price_max, private_only]
  );
  res.json(rows[0]);
});

router.get('/:email', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM saved_searches WHERE user_email = $1 ORDER BY created_at DESC`,
    [req.params.email]
  );
  res.json(rows);
});

router.delete('/:id', async (req, res) => {
  await pool.query(`DELETE FROM saved_searches WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

export default router;
