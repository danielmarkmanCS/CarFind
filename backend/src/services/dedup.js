import { pool } from '../db.js';

export async function upsertListing(listing) {
  const {
    source, external_id, title, price, year, km,
    car_make, car_model, hand, engine_cc, gear_type,
    seller_type, seller_name, phone, city,
    images, url, description
  } = listing;

  const existing = await pool.query(
    `SELECT id, price, price_history FROM listings WHERE source = $1 AND external_id = $2`,
    [source, external_id]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    let history = row.price_history || [];

    if (row.price !== price && price) {
      history = [{ price: row.price, date: new Date() }, ...history].slice(0, 10);
    }

    await pool.query(
      `UPDATE listings SET
        title=$1, price=$2, km=$3, seller_type=$4, images=$5,
        last_seen_at=NOW(), price_history=$6, active=TRUE
       WHERE id=$7`,
      [title, price, km, seller_type, images, JSON.stringify(history), row.id]
    );
    return { action: 'updated', id: row.id };
  }

  const { rows } = await pool.query(
    `INSERT INTO listings
      (source, external_id, title, price, year, km, car_make, car_model,
       hand, engine_cc, gear_type, seller_type, seller_name, phone, city,
       images, url, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING id`,
    [source, external_id, title, price, year, km, car_make, car_model,
     hand, engine_cc, gear_type, seller_type, seller_name, phone, city,
     images, url, description]
  );
  return { action: 'inserted', id: rows[0].id };
}

export async function markInactive(source, activeIds) {
  if (!activeIds.length) return;
  await pool.query(
    `UPDATE listings SET active = FALSE
     WHERE source = $1 AND external_id != ALL($2) AND active = TRUE`,
    [source, activeIds]
  );
}
