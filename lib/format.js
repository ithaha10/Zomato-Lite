// Formatting + business rules shared by server and client.

export function round1(n) {
  return Math.round(n * 10) / 10;
}

export function formatAverage(avg) {
  return avg == null ? null : round1(avg).toFixed(1);
}

// Rating badge colour follows the score band.
export function ratingBand(avg) {
  if (avg >= 3.5) return "green";
  if (avg >= 2.5) return "amber";
  return "red";
}

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const BANNER_COLORS = ["#0f766e", "#7c3aed", "#b91c1c", "#b45309", "#1d4ed8", "#be185d"];

export function bannerColor(name) {
  const str = String(name || "");
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.codePointAt(0)) % 997;
  return BANNER_COLORS[h % BANNER_COLORS.length];
}

// Minutes, hours or days; switches to a date after 7 days.
export function relativeTime(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = now - t;
  if (diff < 0) return "Just now";
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
