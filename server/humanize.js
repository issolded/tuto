export function humanizeDelay(text) {
  const base = 800 + (text?.length || 0) * 25;
  const capped = Math.min(base, 4000);
  const jitter = capped * (Math.random() * 0.4 - 0.2); // ±%20
  return Math.max(0, Math.round(capped + jitter));
}
