import { query } from "./db.js";

// Beta: single restaurant (Ludhiana Burrito).
export const RESTAURANT_ID = 1;

const REVIEW_COLUMNS = `id, rating, review, created_at`;

function toReviewDTO(row) {
  const iso = row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString();
  return { id: row.id, rating: row.rating, review: row.review, createdAt: iso };
}

// Loads one restaurant plus its reviews. The newest review (latest) is
// fetched separately; earlier reviews are paginated newest first with
// ties broken on higher review id.
export async function getRestaurantPage(id, { limit = 20, offset = 0 } = {}) {
  const restaurantRes = await query(
    `SELECT id, name, location, cuisine, type, rating_sum, rating_count
     FROM restaurant
     WHERE id = $1`,
    [id]
  );
  if (restaurantRes.rows.length === 0) return null;
  const restaurant = restaurantRes.rows[0];

  let latest = null;
  if (offset === 0) {
    const latestRes = await query(
      `SELECT ${REVIEW_COLUMNS}
       FROM review
       WHERE restaurant_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [id]
    );
    latest = latestRes.rows[0] ? toReviewDTO(latestRes.rows[0]) : null;
  }

  // Offset 1 skips the latest review; `offset` is how many earlier reviews
  // the caller already has. Fetch limit+1 to detect hasMore cheaply.
  const earlierRes = await query(
    `SELECT ${REVIEW_COLUMNS}
     FROM review
     WHERE restaurant_id = $1
     ORDER BY created_at DESC, id DESC
     OFFSET $2
     LIMIT $3`,
    [id, 1 + offset, limit + 1]
  );
  const hasMore = earlierRes.rows.length > limit;
  const earlier = earlierRes.rows.slice(0, limit).map(toReviewDTO);

  return { restaurant, latest, earlier, hasMore };
}
