import { NextResponse } from "next/server";
import { getRestaurantPage } from "../../../../lib/restaurant.js";
import { round1, ratingBand, relativeTime } from "../../../../lib/format.js";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { id } = await params;
  const restaurantId = Number(id);
  if (!Number.isInteger(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurant id." }, { status: 400 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 50);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  try {
    const page = await getRestaurantPage(restaurantId, { limit, offset });
    if (!page) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }

    const { restaurant, latest, earlier, hasMore } = page;
    const now = Date.now();
    const avg = restaurant.rating_count > 0 ? restaurant.rating_sum / restaurant.rating_count : null;

    return NextResponse.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        location: restaurant.location,
        cuisine: restaurant.cuisine,
        type: restaurant.type,
      },
      rating: {
        average: avg == null ? null : round1(avg).toFixed(1),
        band: avg == null ? null : ratingBand(round1(avg)),
        count: restaurant.rating_count,
      },
      latestReview: latest ? { ...latest, timeLabel: relativeTime(latest.createdAt, now) } : null,
      earlierReviews: earlier.map((r) => ({ ...r, timeLabel: relativeTime(r.createdAt, now) })),
      hasMore,
    });
  } catch (err) {
    console.error("GET /api/restaurant/[id] failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
