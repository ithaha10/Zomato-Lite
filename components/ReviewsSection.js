"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ratingBand, round1 } from "../lib/format.js";
import RelativeTime from "./RelativeTime.js";
import ReviewForm from "./ReviewForm.js";

function RatingChip({ value }) {
  return <span className={`chip chip--${ratingBand(value)}`}>{value}</span>;
}

function ReviewCard({ review }) {
  return (
    <article className="review">
      <div className="review__head">
        <RatingChip value={review.rating} />
        <RelativeTime createdAt={review.createdAt} fallback={review.timeLabel} />
      </div>
      {review.review ? (
        <p className="review__text">{review.review}</p>
      ) : (
        <p className="review__text review__text--empty">No comment</p>
      )}
    </article>
  );
}

export default function ReviewsSection({
  restaurantId,
  restaurantName,
  initialSum,
  initialCount,
  initialLatest,
  initialEarlier,
  initialHasMore,
}) {
  const [sum, setSum] = useState(initialSum);
  const [count, setCount] = useState(initialCount);
  const [latest, setLatest] = useState(initialLatest);
  const [earlier, setEarlier] = useState(initialEarlier);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toast, setToast] = useState(null);

  const average = count > 0 ? sum / count : null;
  const display = average == null ? null : round1(average).toFixed(1);
  const band = average == null ? null : ratingBand(round1(average));

  // Earlier reviews load 20 at a time (infinite scroll + button fallback).
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/restaurant/${restaurantId}?offset=${earlier.length}&limit=20`);
      if (!res.ok) throw new Error(`Failed to load earlier reviews (${res.status})`);
      const data = await res.json();
      setEarlier((prev) => prev.concat(data.earlierReviews));
      setHasMore(data.hasMore);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  }, [earlier.length, hasMore, loadingMore, restaurantId]);

  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "240px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Instant feedback: new review becomes the latest, average and count
  // update in place — no manual refresh needed.
  function handleSubmitted(review) {
    if (latest) setEarlier((prev) => [latest, ...prev]);
    setLatest(review);
    setCount((c) => c + 1);
    setSum((s) => s + review.rating);
    setToast("Your review is live");
  }

  return (
    <>
      {toast && <div className="toast">{toast}</div>}

      <section className="summary">
        {average != null ? (
          <>
            <span className={`badge badge--${band}`}>{display}</span>
            <span className="summary__based">Based on {count} review{count === 1 ? "" : "s"}</span>
          </>
        ) : (
          <p className="summary__empty">No reviews yet. Be the first</p>
        )}
      </section>

      {latest && (
        <section className="latest">
          <div className="review__head">
            <span className="tag">LATEST</span>
            <RelativeTime createdAt={latest.createdAt} fallback={latest.timeLabel} />
          </div>
          {latest.review ? (
            <p className="review__text">{latest.review}</p>
          ) : (
            <p className="review__text review__text--empty">No comment</p>
          )}
        </section>
      )}

      {earlier.length > 0 && (
        <section className="earlier">
          <h2 className="earlier__title">Earlier Reviews</h2>
          <div className="earlier__list">
            {earlier.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </section>
      )}

      <div ref={sentinelRef} className="sentinel">
        {loadingMore && <span>Loading earlier reviews…</span>}
        {!loadingMore && hasMore && (
          <button className="linklike" onClick={loadMore}>
            Load more
          </button>
        )}
      </div>

      <ReviewForm restaurantId={restaurantId} restaurantName={restaurantName} onSubmitted={handleSubmitted} />
    </>
  );
}
