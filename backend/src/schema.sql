CREATE TABLE IF NOT EXISTS listings (
  id              SERIAL PRIMARY KEY,
  source          TEXT NOT NULL,        -- 'yad2' | 'winwin' | 'forsale' | 'marketplace'
  external_id     TEXT NOT NULL,
  title           TEXT,
  price           INTEGER,
  year            INTEGER,
  km              INTEGER,
  car_make        TEXT,
  car_model       TEXT,
  hand            INTEGER,             -- יד ראשונה, שניה, וכו'
  engine_cc       INTEGER,
  gear_type       TEXT,                -- 'auto' | 'manual'
  seller_type     TEXT DEFAULT 'unknown', -- 'private' | 'dealer' | 'unknown'
  seller_name     TEXT,
  phone           TEXT,
  city            TEXT,
  images          TEXT[],
  url             TEXT,
  description     TEXT,
  first_seen_at   TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ DEFAULT NOW(),
  price_history   JSONB DEFAULT '[]',
  active          BOOLEAN DEFAULT TRUE,
  UNIQUE(source, external_id)
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id          SERIAL PRIMARY KEY,
  user_email  TEXT NOT NULL,
  label       TEXT,
  car_make    TEXT,
  car_model   TEXT,
  year_min    INTEGER,
  year_max    INTEGER,
  km_max      INTEGER,
  price_max   INTEGER,
  private_only BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_logs (
  id              SERIAL PRIMARY KEY,
  saved_search_id INTEGER REFERENCES saved_searches(id) ON DELETE CASCADE,
  listing_id      INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  sent_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_source     ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_year       ON listings(year);
CREATE INDEX IF NOT EXISTS idx_listings_price      ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_km         ON listings(km);
CREATE INDEX IF NOT EXISTS idx_listings_seller     ON listings(seller_type);
CREATE INDEX IF NOT EXISTS idx_listings_active     ON listings(active);
CREATE INDEX IF NOT EXISTS idx_listings_last_seen  ON listings(last_seen_at);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
