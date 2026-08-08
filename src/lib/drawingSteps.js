// What the child is told to draw at each step, per language.
//
// These used to be one English array per drawing, inside DrawingsScreen, and they had drifted
// badly away from the pictures they describe. An audit of every folder against its step images
// found:
//
//   * 14 of 24 drawings had no descriptions at all — the child saw pictures and no words
//   * house had 15 descriptions for 8 pictures, landscape 16 for 6, princess 29 for 6, cat 8
//     for 9. The extras are from earlier, longer versions of those drawings, so from some
//     point onward every description described a different picture than the one on screen.
//     That is why house step 4 said "two windows" when the picture has one, and why
//     caterpillar's step 5 described something drawn several steps earlier.
//
// A description that does not match its picture is worse than none: a six-year-old trusts the
// words over what they see. So a drawing appears here only once its steps have been checked
// against the images one by one, and DRAWINGS_AUDITED records which those are — anything else
// shows pictures alone, as it did before, rather than confident nonsense.
//
// Adding a language: another field beside en/tr, same as src/lib/i18n.js.

export const DRAWING_STEPS = {
  // Audited against drawings/robot/*.webp. The old step 5 was removed: the ear knobs and knee
  // circles drawn in step 4 vanished in it and came back in step 6, so it belonged to a
  // different version of this robot. Remaining steps renumbered 1-6.
  robot: {
    en: [
      'Draw a rectangle for the head.',
      'Add a square below it for the body.',
      'Add a short neck, curved arms with round hands, and two legs with feet.',
      'Put an antenna on top, two big round eyes, and little ears on each side.',
      'Draw a screen and two buttons on the chest, then add fingers and bolts.',
      'Colour the eyes in, draw a line across the screen, and add joint lines to the arms and legs.',
    ],
    tr: [
      'Kafa için bir dikdörtgen çiz.',
      'Altına gövde için bir kare ekle.',
      'Kısa bir boyun, yuvarlak elli kavisli kollar ve ayaklı iki bacak ekle.',
      'Tepesine anten, iki büyük yuvarlak göz ve iki yanına küçük kulak koy.',
      'Göğsüne bir ekran ve iki düğme çiz, sonra parmakları ve vidaları ekle.',
      'Gözleri boya, ekranın üstüne bir çizgi çek, kollara ve bacaklara eklem çizgileri ekle.',
    ],
  },
}

// Only these are known to match their pictures. The rest are waiting on the same
// image-by-image pass; until then they render without text.
export const DRAWINGS_AUDITED = new Set(Object.keys(DRAWING_STEPS))

export function stepsFor(drawingKey, lang) {
  const entry = DRAWING_STEPS[drawingKey]
  if (!entry) return null
  return entry[lang] ?? entry.en ?? null
}

export function stepTip(drawingKey, stepIndex, lang) {
  const steps = stepsFor(drawingKey, lang)
  return steps?.[stepIndex] ?? null
}
