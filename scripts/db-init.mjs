// Creates the schema (idempotent) and seeds the beta restaurant with
// sample reviews, including the known live spam review from the PRD.
// Usage: npm run db:init

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Set it in .env or the environment.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS restaurant (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  type TEXT NOT NULL,
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_rest_created_idx ON review (restaurant_id, created_at DESC);
`;

const SEED_RESTAURANT = {
  name: "Ludhiana Burrito",
  location: "Sector 32, Ludhiana",
  cuisine: "Mexican",
  type: "Dine-in",
};

// minutesAgo is relative to seed time so relative labels look natural.
const SEED_REVIEWS = [
  { rating: 5, review: "tfhffgj", minutesAgo: 6 },
  { rating: 4, review: "Burritos are solid and the salsa verde has a proper kick. Coming back for sure.", minutesAgo: 120 },
  { rating: 3, review: "Good food but the wait was long on a Saturday evening.", minutesAgo: 300 },
  { rating: 5, review: "Best birria burrito in Ludhiana. Portion is generous.", minutesAgo: 1500 },
  { rating: 2, review: "Rice was undercooked and it took 40 minutes to serve.", minutesAgo: 3000 },
  { rating: 4, review: "Clean place, friendly staff. The quesadilla was great.", minutesAgo: 4500 },
  { rating: 5, review: "Fresh ingredients and quick service at lunch hour.", minutesAgo: 6000 },
  { rating: 3, review: "Tasty but a bit pricey for the portion size.", minutesAgo: 8000 },
  { rating: 1, review: "Wrong order twice in a row. Very disappointing.", minutesAgo: 12000 },
  { rating: 4, review: "Churros were the highlight. Kids loved them.", minutesAgo: 18000 },
];

await pool.query(SCHEMA);

const existing = await pool.query(
  `SELECT id FROM restaurant WHERE name = $1 AND location = $2 LIMIT 1`,
  [SEED_RESTAURANT.name, SEED_RESTAURANT.location]
);

let restaurantId;
if (existing.rows.length > 0) {
  restaurantId = existing.rows[0].id;
} else {
  const ins = await pool.query(
    `INSERT INTO restaurant (name, location, cuisine, type)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [SEED_RESTAURANT.name, SEED_RESTAURANT.location, SEED_RESTAURANT.cuisine, SEED_RESTAURANT.type]
  );
  restaurantId = ins.rows[0].id;
}

const revCount = await pool.query(
  `SELECT count(*)::int AS c FROM review WHERE restaurant_id = $1`,
  [restaurantId]
);

if (revCount.rows[0].c === 0) {
  for (const s of SEED_REVIEWS) {
    await pool.query(
      `INSERT INTO review (restaurant_id, rating, review, created_at)
       VALUES ($1, $2, $3, now() - ($4 || ' minutes')::interval)`,
      [restaurantId, s.rating, s.review, s.minutesAgo]
    );
  }
  const agg = await pool.query(
    `SELECT coalesce(sum(rating), 0)::int AS s, count(*)::int AS c FROM review WHERE restaurant_id = $1`,
    [restaurantId]
  );
  await pool.query(
    `UPDATE restaurant SET rating_sum = $1, rating_count = $2 WHERE id = $3`,
    [agg.rows[0].s, agg.rows[0].c, restaurantId]
  );
}

const final = await pool.query(
  `SELECT id, name, location, rating_sum, rating_count FROM restaurant WHERE id = $1`,
  [restaurantId]
);
const r = final.rows[0];
const avg = r.rating_count > 0 ? (r.rating_sum / r.rating_count).toFixed(1) : "n/a";
console.log(`Restaurant #${r.id}: ${r.name} (${r.location})`);
console.log(`Average rating: ${avg} / 5 · Based on ${r.rating_count} reviews`);

await pool.end();
