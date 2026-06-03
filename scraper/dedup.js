import { pool } from './db.js';

export async function upsertListing(listing) {
  const {
    source, external_id, title, price, year, km,
    car_make, car_model, hand, engine_cc, gear_type,
    seller_type, seller_name, phone, city,
    images, url, description, category = 'general'
  } = listing;

  const existing = await pool.query(
    `SELECT id, price, price_history FROM listings WHERE source=$1 AND external_id=$2`,
    [source, external_id]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    let history = row.price_history || [];
    if (row.price !== price && price) {
      history = [{ price: row.price, date: new Date() }, ...history].slice(0, 10);
    }
    await pool.query(
      `UPDATE listings SET title=$1,price=$2,km=$3,seller_type=$4,images=$5,
       year=$6,car_make=$7,car_model=$8,city=$9,hand=$10,category=$11,
       last_seen_at=NOW(),price_history=$12,active=TRUE WHERE id=$13`,
      [title, price, km, seller_type, images,
       year, car_make, car_model, city, hand, category,
       JSON.stringify(history), row.id]
    );
    return 'updated';
  }

  await pool.query(
    `INSERT INTO listings (source,external_id,title,price,year,km,car_make,car_model,hand,engine_cc,gear_type,seller_type,seller_name,phone,city,images,url,description,category)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     ON CONFLICT (source,external_id) DO NOTHING`,
    [source, external_id, title, price, year, km, car_make, car_model, hand, engine_cc, gear_type, seller_type, seller_name, phone, city, images, url, description, category]
  );
  return 'inserted';
}

export async function markInactive(source, activeIds, category = null) {
  if (!activeIds.length) return;
  if (category) {
    await pool.query(
      `UPDATE listings SET active=FALSE WHERE source=$1 AND category=$2 AND external_id!=ALL($3) AND active=TRUE`,
      [source, category, activeIds]
    );
  } else {
    await pool.query(
      `UPDATE listings SET active=FALSE WHERE source=$1 AND external_id!=ALL($2) AND active=TRUE`,
      [source, activeIds]
    );
  }
}
