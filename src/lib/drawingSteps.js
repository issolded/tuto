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
  // Audited against drawings/house/*.webp. The old list had 15 lines for these 8 pictures;
  // its "two windows" belonged to a version of this house that had two. This one has one.
  // Audited against drawings/caterpillar/*.webp. The count matched before, which is why this
  // one looked fine and was not: step 3 is the antennae, not what the old line claimed, and
  // the old step 5 described the eyes, drawn in step 4.
  caterpillar: {
    en: [
      'Draw a big circle for the head.',
      'Add three more circles behind it, each a little smaller.',
      'Give it two curly antennae on top.',
      'Draw two big eyes with shiny pupils, and a small eyebrow above each.',
      'Add a happy smile.',
      'Join the body circles into segments and add little looping legs underneath.',
      'Draw wavy stripes across each segment.',
      'Put a big leaf under the caterpillar and a flower beside it.',
    ],
    tr: [
      'Kafa için büyük bir daire çiz.',
      'Arkasına gittikçe küçülen üç daire daha ekle.',
      'Tepesine iki tane kıvrık anten çiz.',
      'Parlak bebekli iki büyük göz çiz, her birinin üstüne de küçük bir kaş.',
      'Güler yüzlü bir gülümseme ekle.',
      'Gövde dairelerini halkalara bağla, altına da küçük ilmek bacaklar ekle.',
      'Her halkanın üstüne dalgalı çizgiler çiz.',
      'Tırtılın altına kocaman bir yaprak, yanına da bir çiçek koy.',
    ],
  },
  // Audited against drawings/mountains/*.webp. This one had no descriptions at all.
  // Step 5 loses the snow caps drawn in step 3 and gets them back in step 6 — a flaw in the
  // source art. Unlike robot's step 5 it still teaches something (the bare trunk), so it
  // stays, and the wording does not mention snow there.
  mountains: {
    en: [
      'Draw a long line across the middle for the ground.',
      'Draw two big triangles above it for the mountains, overlapping a little.',
      'Add a zigzag line near each peak for the snow.',
      'Draw a winding path coming towards you from between the mountains.',
      'On the left, draw a tree trunk with a few bare branches.',
      'Give that tree a big bumpy crown of leaves.',
      'Draw a second leafy tree on the right side.',
      'Shade the mountainsides, the trees and the path to finish.',
    ],
    tr: [
      'Ortadan boydan boya bir çizgi çekerek yeri çiz.',
      'Üstüne dağlar için birbirine biraz giren iki büyük üçgen çiz.',
      'Her zirvenin altına kar için zikzak bir çizgi ekle.',
      'Dağların arasından sana doğru gelen kıvrımlı bir yol çiz.',
      'Sol tarafa birkaç çıplak dallı bir ağaç gövdesi çiz.',
      'O ağaca kabarık, yuvarlak bir yaprak tepesi ver.',
      'Sağ tarafa yapraklı ikinci bir ağaç çiz.',
      'Dağ yamaçlarını, ağaçları ve yolu gölgeleyerek bitir.',
    ],
  },
  house: {
    en: [
      'Draw a big square for the walls.',
      'Put a wide triangle on top for the roof.',
      'Add a chimney on the right side of the roof, and a tall rectangle for the door.',
      'Draw one square window to the right of the door.',
      'Cover the roof in rows of tiles, and let some smoke curl out of the chimney.',
      'Split the window into four panes and add curtains, then a round door handle.',
      'Draw a picket fence across the front of the house.',
      'Shade the roof, the door and the chimney bricks, and add bushes in the garden.',
    ],
    tr: [
      'Duvarlar için büyük bir kare çiz.',
      'Üstüne çatı için geniş bir üçgen koy.',
      'Çatının sağına baca, eve de kapı için uzun bir dikdörtgen ekle.',
      'Kapının sağına bir tane kare pencere çiz.',
      'Çatıyı sıra sıra kiremitlerle kapla, bacadan da dumanlar çıksın.',
      'Pencereyi dört bölmeye ayır, perdelerini ekle, sonra yuvarlak bir kapı kolu çiz.',
      'Evin önüne boydan boya bir çit çiz.',
      'Çatıyı, kapıyı ve bacanın tuğlalarını gölgele, bahçeye çalılar ekle.',
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
