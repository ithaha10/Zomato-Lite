"use client";

import { useEffect, useState } from "react";
import { relativeTime } from "../lib/format.js";

// Renders the server-computed label first, then recomputes on the client
// from createdAt so the label is always fresh. One-time on mount, so no
// hydration mismatch and no ticking timer.
export default function RelativeTime({ createdAt, fallback }) {
  const [label, setLabel] = useState(fallback ?? "");
  useEffect(() => {
    if (createdAt) setLabel(relativeTime(createdAt));
  }, [createdAt]);
  return <time suppressHydrationWarning>{label}</time>;
}
