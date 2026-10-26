import { NextResponse } from "next/server";
import { getPool, query } from "../../../lib/db.js";
import { relativeTime } from "../../../lib/format.js";

export const dynamic = "force-dynamic";

// Simple in-memory per-IP rate limit (spam guard; per server instance).
const RATE_LIMIT = { windowMs: 60_000, max: 10 };
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT.windowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  hits.set(ip, entry);
  return entry.count > RATE_LIMIT.max;
}

// Saves a review and updates rating totals in one transaction, so reads
// never scan all reviews. An idempotency key makes a double tap return
// the already-saved review instead of creating a second one.
async function saveReview({ restaurantId, rating, text, key }) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    let row = null;
    if (key) {
      const insert = await client.query(
        `INSERT INTO review (restaurant_id, rating, review, idempotency_key)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id, rating, review, created_at`,
        [restaurantId, rating, text, key]
      );
      if (insert.rows.length === 0) {
        const existing = await client.query(
          `SELECT id, rating, review, created_at FROM review WHERE idempotency_key = $1`,
          [key]
        );
        await client.query("COMMIT");
        return { row: existing.rows[0], duplicate: true };
      }
      row = insert.rows[0];
    } else {
      const insert = await client.query(
        `INSERT INTO review (restaurant_id, rating, review)
         VALUES ($1, $2, $3)
         RETURNING id, rating, review, created_at`,
        [restaurantId, rating, text]
      );
      row = insert.rows[0];
    }

    await client.query(
      `UPDATE restaurant
       SET rating_sum = rating_sum + $1, rating_count = rating_count + 1, updated_at = now()
       WHERE id = $2`,
      [rating, restaurantId]
    );

    await client.query("COMMIT");
    return { row, duplicate: false };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function toResponseReview(row) {
  const iso = row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString();
  return {
    id: row.id,
    rating: row.rating,
    review: row.review,
    createdAt: iso,
    timeLabel: relativeTime(iso),
  };
}

export async function POST(request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many reviews posted. Please wait a minute." }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const restaurantId = Number(body?.restaurant_id);
  const rating = Number(body?.rating);
  const headerKey = request.headers.get("idempotency-key");
  const key = headerKey && headerKey.trim() !== ""
    ? headerKey.trim()
    : (typeof body?.idempotency_key === "string" && body.idempotency_key.trim() !== ""
        ? body.idempotency_key.trim()
        : null);
  const text = typeof body?.review === "string" ? body.review : "";

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be a whole number between 1 and 5.", field: "rating" },
      { status: 400 }
    );
  }
  if (!Number.isInteger(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurant." }, { status: 400 });
  }
  if (text.trim().length > 500) {
    return NextResponse.json(
      { error: "Review must be 500 characters or fewer.", field: "review" },
      { status: 400 }
    );
  }

  try {
    const exists = await query(`SELECT 1 FROM restaurant WHERE id = $1`, [restaurantId]);
    if (exists.rows.length === 0) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }
  } catch (err) {
    console.error("POST /api/review restaurant lookup failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  try {
    const { row, duplicate } = await saveReview({
      restaurantId,
      rating,
      text: text.trim(),
      key,
    });
    return NextResponse.json({ review: toResponseReview(row), duplicate });
  } catch (err) {
    console.error("POST /api/review failed", err);
    return NextResponse.json({ error: "Could not save your review. Please try again." }, { status: 500 });
  }
}
