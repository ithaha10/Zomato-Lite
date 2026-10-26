"use client";

import { useEffect, useState } from "react";

export default function ReviewForm({ restaurantId, restaurantName, onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [key, setKey] = useState(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setKey(crypto?.randomUUID ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    if (!submitting) setOpen(false);
  }

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setError("Please pick a rating from 1 to 5.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ restaurant_id: restaurantId, rating, review: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save your review. Please try again.");
        return;
      }
      onSubmitted(data.review);
      setOpen(false);
      setRating(0);
      setHover(0);
      setText("");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="sticky-cta">
        <button className="cta" onClick={() => setOpen(true)}>
          ✎ Write a Review
        </button>
      </div>

      {open && (
        <div className="overlay" onClick={close}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h2 className="sheet__title">Write a Review</h2>
            <p className="sheet__sub">{restaurantName}</p>

            <div className="stars" role="radiogroup" aria-label="Rating from 1 to 5 stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`star ${(hover || rating) >= n ? "star--on" : ""}`}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => {
                    setRating(n);
                    setError(null);
                  }}
                  aria-pressed={rating === n}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              className="sheet__text"
              placeholder="How was the food, service, vibe? (optional)"
              value={text}
              maxLength={500}
              rows={3}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="sheet__counter">{text.length}/500</div>

            {error && (
              <p className="sheet__error" role="alert">
                {error}
              </p>
            )}

            <div className="sheet__actions">
              <button type="button" className="ghost" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={submitting}>
                {submitting ? "Posting…" : "Post Review"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
