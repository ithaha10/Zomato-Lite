# Zomato-lite

The fastest, most honest read on a restaurant: one average rating, its review
count, the latest review pinned on top, and a one-tap way to write a review.
Currently in **beta** with a single restaurant page (Ludhiana Burrito).

## Stack

- Next.js 15 (App Router) + React 19
- Neon Postgres (`pg`), index on `review (restaurant_id, created_at)`
- Deployed on Vercel

## API

- `GET /api/restaurant/{id}` — restaurant details, average rating (1 decimal),
  review count, latest review, and earlier reviews sorted newest first
  (`?limit=20&offset=0` for pagination).
- `POST /api/review` — `{ restaurant_id, rating (1-5), review (optional, 500 max) }`.
  Validates on the server, rate-limits per IP, and dedupes via `Idempotency-Key`.
  Rating totals (`rating_sum`, `rating_count`) are updated in the same transaction.

## Local development

```bash
npm install
npm run db:init   # creates schema + seeds Ludhiana Burrito with sample reviews
npm run dev       # http://localhost:3000
```

Environment lives in `.env` (never committed — see `.env.example`).
