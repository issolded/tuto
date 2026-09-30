// What each question of a screen session pays, as a share of the session's reward: unaided and
// right is a whole share, right after a hint, help or a first wrong try is a half, wrong or
// skipped is nothing. The mean is the session's share. Returns null unless the record covers
// every question, so a partial or missing record falls back to the session-level scale rather
// than paying out on a guess about what is missing.
export function questionShareMean(attempts, total) {
  const list = Array.isArray(attempts) ? attempts : []
  const n = Number(total)
  if (!Number.isInteger(n) || n < 1 || list.length !== n) return null
  const sum = list.reduce((acc, a) => acc + (a && a.correct === true ? (a.help_used ? 0.5 : 1) : 0), 0)
  return sum / n
}

