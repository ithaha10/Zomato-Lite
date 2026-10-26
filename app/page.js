import { notFound } from "next/navigation";
import { getRestaurantPage, RESTAURANT_ID } from "../lib/restaurant.js";
import { initials, bannerColor } from "../lib/format.js";
import ReviewsSection from "../components/ReviewsSection.js";

export const dynamic = "force-dynamic";

export default async function RestaurantPage() {
  const page = await getRestaurantPage(RESTAURANT_ID);
  if (!page) notFound();

  const { restaurant, latest, earlier, hasMore } = page;

  return (
    <main className="shell">
      <div
        className="banner"
        style={{ backgroundColor: bannerColor(restaurant.name) }}
        role="img"
        aria-label={`${restaurant.name} initials banner`}
      >
        <span className="banner__initials">{initials(restaurant.name)}</span>
      </div>

      <section className="card">
        <div className="card__top">
          <h1 className="card__name">{restaurant.name}</h1>
          <span className="pill">BETA</span>
        </div>
        <p className="card__meta">
          {restaurant.location} · {restaurant.cuisine} · {restaurant.type}
        </p>
      </section>

      <ReviewsSection
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        initialSum={restaurant.rating_sum}
        initialCount={restaurant.rating_count}
        initialLatest={latest}
        initialEarlier={earlier}
        initialHasMore={hasMore}
      />
    </main>
  );
}
