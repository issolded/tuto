// A child's age from their birth date — the one place it is worked out on the client. The server
// has its own copy (ageOn in server/index.js) because the two deploy separately.
//
// `children.birth_date` is the truth; `children.age` is kept in step with it by the server (once
// an hour, and the moment a parent saves a date), so the forty-odd places that read `age` never
// had to change. A child without a birth date keeps the age their parent typed, as before.

// Whole years between a 'YYYY-MM-DD' date and `on`, by the calendar rather than by milliseconds,
// so a birthday counts from the morning of the day. null for anything that is not a date.
export function ageFromBirthDate(iso, on = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!m) return null
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  let age = on.getFullYear() - y
  const before = on.getMonth() + 1 < mo || (on.getMonth() + 1 === mo && on.getDate() < d)
  if (before) age--
  return age
}

// The range a birth date field offers: a child of 3 to 14 today. Tuto's content runs 5 to 11;
// the margin is for a younger sibling set up early and an older one who still wants in.
export function birthDateBounds(on = new Date()) {
  // Local calendar fields, not toISOString: that is UTC, and a day off wherever the clock is ahead.
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  const min = new Date(on.getFullYear() - 14, on.getMonth(), on.getDate() + 1)
  const max = new Date(on.getFullYear() - 3, on.getMonth(), on.getDate())
  return { min: iso(min), max: iso(max) }
}
