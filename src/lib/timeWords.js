// How a time is said, in one place, because two things need it and they must agree: the
// question text (mathTemplates.js) and the clock's live readout (components/ClockFace.jsx).
// A child reading "3'ü kaç dakika geçiyor?" and then dragging a clock that says "3'i" would
// be reading two different clocks.

// Turkish attaches the suffix to the number's spoken form, which does not follow from its
// digits — "3'ü" but "6'yı". Twelve of each is smaller than any rule that would get it right.
export const TR_ACC = ['', "1'i", "2'yi", "3'ü", "4'ü", "5'i", "6'yı", "7'yi", "8'i", "9'u", "10'u", "11'i", "12'yi"]
export const TR_DAT = ['', "1'e", "2'ye", "3'e", "4'e", "5'e", "6'ya", "7'ye", "8'e", "9'a", "10'a", "11'e", "12'ye"]
export const TR_ABL = ['', "1'den", "2'den", "3'ten", "4'ten", "5'ten", "6'dan", "7'den", "8'den", "9'dan", "10'dan", "11'den", "12'den"]

export const clockHour = (h) => ((Number(h) % 12) + 12) % 12 || 12
export const nextHour  = (h) => (clockHour(h) === 12 ? 1 : clockHour(h) + 1)

export const digital = (hour, minute) =>
  `${clockHour(hour)}:${String(minute).padStart(2, '0')}`

export function timeWords(hour, minute, lang = 'en') {
  const h = clockHour(hour)
  const next = nextHour(h)
  if (lang === 'tr') {
    if (minute === 0)  return `saat ${h}`
    if (minute === 15) return `${TR_ACC[h]} çeyrek geçiyor`
    if (minute === 30) return `${h} buçuk`
    if (minute === 45) return `${TR_DAT[next]} çeyrek var`
    if (minute < 30)   return `${TR_ACC[h]} ${minute} geçiyor`
    return `${TR_DAT[next]} ${60 - minute} var`
  }
  if (minute === 0)  return `${h} o'clock`
  if (minute === 15) return `quarter past ${h}`
  if (minute === 30) return `half past ${h}`
  if (minute === 45) return `quarter to ${next}`
  if (minute < 30)   return `${minute} past ${h}`
  return `${60 - minute} to ${next}`
}
