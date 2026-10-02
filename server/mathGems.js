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


// Working on paper pays a fifth more than the same work on the screen. Paper has no hints or help to
// lean on and it is the offline option, so the choice screen offers it as a bonus and the amount is
// the same figure the card shows: up to max × 1.2.
export const PAPER_BONUS = 1.2

// What one maths session pays. `share` is the per-question mean when the record covers every question
// (null otherwise, then the session-level `scale` and the help count decide). The daily limit and the
// ledger are the caller's.
export function sessionGems({ max, share, scale, helpUsed = 0, paper = false }) {
  const base = share !== null && share !== undefined
    ? max * share
    : max * scale * (Number(helpUsed) > 0 ? 0.67 : 1)
  return Math.round(base * (paper ? PAPER_BONUS : 1))
}
