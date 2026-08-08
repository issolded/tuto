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
  // Audited against drawings/anime-face/*.webp — nine steps, not ten: that folder also holds
  // an icon.webp, which the first count mistook for a step.
  'anime-face': {
    en: [
      'Draw a circle for the skull, with a line down the middle and a small mark below for the chin.',
      'Draw the jaw down to that mark, and two lines for the neck.',
      'Smooth the whole head into one outline, add an ear on the left, and a guide line across for the eyes.',
      'Draw sharp eyebrows, the outline of both eyes, a small nose and a smiling mouth.',
      'Draw a big circle inside each eye for the iris.',
      'Add the other ear on the right so both match.',
      'Fill in the pupils and leave a white dot in each for the shine.',
      'Draw the fringe: pointed strands of hair falling over the forehead.',
      'Add the rest of the spiky hair all around, then shade the face and eyes.',
    ],
    tr: [
      'Kafatası için bir daire çiz, ortasından bir çizgi geçir, altına da çene için küçük bir işaret koy.',
      'Çeneyi o işarete kadar indir, boyun için iki çizgi çek.',
      'Bütün kafayı tek bir hatta yumuşat, soluna bir kulak ekle, gözler için de enine bir yardım çizgisi çiz.',
      'Keskin kaşlar, iki gözün dış hattı, küçük bir burun ve gülümseyen bir ağız çiz.',
      'Her gözün içine iris için büyük bir daire çiz.',
      'Sağa da öbür kulağı ekle, ikisi eşit olsun.',
      'Göz bebeklerini doldur, her birinde parıltı için beyaz bir nokta bırak.',
      'Kâkülü çiz: alnına düşen sivri saç tutamları.',
      'Çevresine diken diken saçın kalanını ekle, sonra yüzü ve gözleri gölgele.',
    ],
  },
  // Audited against drawings/train/*.webp. Four steps, and each one carries a lot — this is
  // the shortest sequence in the set.
  train: {
    en: [
      'Draw a long rectangle for the engine, sitting on a base, with two small wheels and one big wheel.',
      'Add a tall chimney on the left, and the cab wall and roof on the right.',
      'Round off the front of the boiler, put a window in the cab, add a smoke cloud, a wedge at the front, a rod across the wheels, and a wagon behind.',
      'Shade the whole engine and draw the rails underneath.',
    ],
    tr: [
      'Lokomotif için bir kaide üstünde uzun bir dikdörtgen çiz; iki küçük, bir büyük tekerlek koy.',
      'Soluna uzun bir baca, sağına da kabinin duvarını ve çatısını ekle.',
      'Kazanın önünü yuvarlat, kabine pencere koy, bir duman bulutu, önüne bir takoz, tekerleklerin üstüne bir kol ve arkasına bir vagon ekle.',
      'Bütün lokomotifi gölgele ve altına rayları çiz.',
    ],
  },
  // Audited against drawings/map/*.webp.
  map: {
    en: [
      'Draw a wobbly island shape, with a few tiny rocks in the sea around it.',
      'Put three mountain peaks inside it, and a lake just below them.',
      'Wind a river down from the lake to the coast, and add bushy trees on each side.',
      'Add a castle, a little village, and shade the mountains with snow on top.',
      'Draw waves in the sea, a sailing boat and a sea serpent, then a dotted trail with bridges over the river.',
    ],
    tr: [
      'Dalgalı kenarlı bir ada çiz, çevresindeki denize de birkaç küçük kaya koy.',
      'İçine üç dağ zirvesi, hemen altlarına da bir göl çiz.',
      'Gölden kıyıya kıvrıla kıvrıla bir nehir indir, iki yanına da çalı gibi ağaçlar ekle.',
      'Bir kale ve küçük bir köy ekle, dağları gölgele, tepelerine kar koy.',
      'Denize dalgalar, bir yelkenli ve bir deniz yılanı çiz; sonra nehrin üstünden köprülü, noktalı bir patika geçir.',
    ],
  },
  // Audited against drawings/dolphin/*.webp.
  dolphin: {
    en: [
      'Draw one big curve, arching up like a rainbow — that is the back.',
      'Bring a second curve underneath to close the body, ending in a pointed snout on the right.',
      'Draw a long side flipper under the middle of the body.',
      'Add the fin on top of the back, and a forked tail at the other end.',
      'Draw a big eye with a shine in it, an eyebrow, a smiling mouth, and a small second flipper.',
      'Go over all your lines to make them dark and smooth.',
    ],
    tr: [
      'Gökkuşağı gibi yukarı kıvrılan büyük bir yay çiz — bu sırtı.',
      'Altından ikinci bir yay geçirip gövdeyi kapat, sağ ucu sivri bir burun olsun.',
      'Gövdenin ortasının altına uzun bir yan yüzgeç çiz.',
      'Sırtının üstüne yüzgeci, öbür ucuna da çatal kuyruğu ekle.',
      'Parıltılı büyük bir göz, bir kaş, gülümseyen bir ağız ve küçük bir ikinci yüzgeç çiz.',
      'Bütün çizgilerin üstünden geçip koyu ve düzgün hâle getir.',
    ],
  },
  // Audited against drawings/fish/*.webp.
  fish: {
    en: [
      'Draw a big oval lying on its side for the body.',
      'Add a triangle tail on the left, pinched in the middle.',
      'Draw a curved line near the front for the head, and a small circle for the eye.',
      'Put a pointed fin on top of the back, and give the fish a smile.',
      'Add a fin on the side of the body and another underneath.',
      'Draw rows of curved scales, and a few bubbles floating up beside it.',
    ],
    tr: [
      'Gövde için yan yatmış büyük bir oval çiz.',
      'Soluna ortası içeri girmiş üçgen bir kuyruk ekle.',
      'Ön tarafa baş için kavisli bir çizgi, göz için de küçük bir daire çiz.',
      'Sırtının üstüne sivri bir yüzgeç koy ve balığa bir gülümseme ver.',
      'Gövdenin yanına bir yüzgeç, altına da bir tane daha ekle.',
      'Sıra sıra kavisli pullar çiz, yanına da yukarı süzülen birkaç kabarcık koy.',
    ],
  },
  // Audited against drawings/master/*.webp. Five steps for a whole standing figure, so each
  // one is a big jump — this is the hardest drawing in the set and the wording says what to
  // block in rather than pretending it is easy.
  master: {
    en: [
      'Draw a head with a pointed chin, a guide line down the middle and one across, then the neck and the collar.',
      'Draw sharp narrow eyes under strong eyebrows, and a small mouth.',
      'Drape a wide cloak from the shoulders, flaring out, with the body showing below it.',
      'Add the arms — one hand on the hip, the other down by a sword — a belt, and the legs.',
      'Draw long flowing hair, then shade the cloak and trousers with lots of fine lines.',
    ],
    tr: [
      'Sivri çeneli bir kafa çiz, ortasından ve enine yardım çizgileri geçir, sonra boynu ve yakayı ekle.',
      'Kalın kaşların altına keskin, ince gözler ve küçük bir ağız çiz.',
      'Omuzlardan aşağı yayılan geniş bir pelerin çiz, altından gövde görünsün.',
      'Kolları ekle — bir el belde, öbürü aşağıda kılıcın yanında — bir kemer ve bacaklar.',
      'Uzun, savrulan saçları çiz, sonra pelerini ve pantolonu bol ince çizgiyle gölgele.',
    ],
  },
  // Audited against drawings/axolotl/*.webp.
  axolotl: {
    en: [
      'Draw a big wide circle for the head, and a rounder body just below it.',
      'Add two little arms out to the sides and two short legs underneath.',
      'Draw two big oval eyes, filled in dark, with two white dots in each.',
      'Add a wide open smile.',
      'Draw three feathery frills on each side of the head, and a long flat tail curving to the left.',
      'Go over all the outlines to make them dark and smooth.',
    ],
    tr: [
      'Kafa için büyük ve geniş bir daire, hemen altına da daha yuvarlak bir gövde çiz.',
      'İki yanına küçük kollar, altına da iki kısa bacak ekle.',
      'İçi koyu doldurulmuş iki büyük oval göz çiz, her birine iki beyaz nokta koy.',
      'Kocaman, açık bir gülümseme ekle.',
      'Kafasının iki yanına üçer tüylü solungaç, sola doğru kıvrılan uzun ve yassı bir kuyruk çiz.',
      'Bütün dış çizgilerin üstünden geçip koyu ve düzgün hâle getir.',
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
