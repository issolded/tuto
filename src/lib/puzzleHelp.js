// Help for the shape-and-pattern puzzles, the same three rungs the English module has
// (src/lib/englishHelp.js) and for the same reason on the server only: a hint is built from the question's
// `rule`, which is its answer key.
//   1. tip      how to look at this KIND of puzzle.
//   2. narrow   one wrong option crossed out (no reason given: the pictures are the reason).
//   3. look     what to compare, naming the attribute the puzzle is about, never the answer.
// After the question is settled puzzleExplain.js's sentence says why the answer is the answer.
// Written trilingual in place; scripts/puzzle-help-audit.mjs checks every type, band and language.

import { ATTR, NOM } from './puzzleExplain.js'

const L = (en, tr, es) => ({ en, tr, es })
const pick = (l, lang) => l[lang] ?? l.en
const attrNames = (q, lang) => String(q.rule?.attr ?? '').replace(/^code:/, '').split('+').map(a => ATTR[lang]?.[a] || ATTR.en[a]).filter(Boolean)
const nomNames = (q, lang) => String(q.rule?.attr ?? '').replace(/^code:/, '').split('+').map(a => NOM[lang]?.[a] || NOM.en[a]).filter(Boolean)
const joinAnd = (names, lang) => names.length < 2 ? (names[0] || '') : `${names.slice(0, -1).join(', ')} ${{ tr: 've', es: 'y' }[lang] || 'and'} ${names[names.length - 1]}`

// Per type: [tip, look(q) → L]. `look` is what rung 3 says.
const HELP = {
  'odd-one-out': [
    L('All the shapes but one share something. Find what they share, then pick the one that does not.', 'Biri dışında hepsinin ortak bir yanı var. Ortak yanı bul, sonra olmayanı seç.', 'Todas las figuras menos una comparten algo. Busca qué comparten y elige la que no.'),
    (q, g) => L(`Compare ${joinAnd(attrNames(q, 'en'), 'en') ? 'their ' + joinAnd(attrNames(q, 'en'), 'en') : 'them'} one shape at a time: all but one are the same.`, `Şekillerin ${joinAnd(nomNames(q, 'tr'), 'tr')} özelliğini tek tek karşılaştır: biri dışında hepsi aynı.`, `Compara ${joinAnd(attrNames(q, 'es'), 'es')} figura a figura: todas menos una son iguales.`),
  ],
  identical: [
    L('Look at the shape above, then check each option against it, one detail at a time.', 'Üstteki şekle bak, sonra her seçeneği ona göre tek tek, ayrıntı ayrıntı kontrol et.', 'Mira la figura de arriba y compara cada opción con ella, detalle a detalle.'),
    () => L('Check three things on each option: the outline, the shading and any small mark inside. Every wrong option has one thing different.', 'Her seçenekte üç şeye bak: dış çizgi, dolgu ve içindeki küçük işaret. Yanlış seçeneklerin her birinde bir şey farklı.', 'Revisa tres cosas en cada opción: el contorno, el relleno y cualquier marca pequeña dentro. Cada opción incorrecta tiene una cosa distinta.'),
  ],
  sequence: [
    L('Look at how the pictures change from one to the next. The same change keeps happening, or the order keeps repeating.', 'Resimlerin birinden ötekine nasıl değiştiğine bak. Aynı değişiklik sürüyor ya da sıra tekrar ediyor.', 'Mira cómo cambian los dibujos de uno al siguiente. Sigue el mismo cambio o se repite el orden.'),
    (q) => q.rule?.attr === 'dots' ? L('Count the dots in each picture. How does the number change from one to the next?', 'Her resimdeki noktaları say. Sayı birinden ötekine nasıl değişiyor?', 'Cuenta los puntos de cada dibujo. ¿Cómo cambia el número de uno al siguiente?')
      : q.rule?.attr === 'rotation' ? L('Look at which way the shape points in each picture. How far does it turn each time?', 'Şeklin her resimde hangi yöne baktığına bak. Her seferinde ne kadar dönüyor?', 'Mira hacia dónde apunta la figura en cada dibujo. ¿Cuánto gira cada vez?')
        : L(`Follow the ${joinAnd(attrNames(q, 'en'), 'en')} along the row. What comes after the last one?`, `Sırada ${joinAnd(nomNames(q, 'tr'), 'tr')} özelliğini izle. Sonuncudan sonra ne geliyor?`, `Sigue ${joinAnd(attrNames(q, 'es'), 'es')} a lo largo de la fila. ¿Qué viene después del último?`),
  ],
  belongs: [
    L('The pictures above have something in common. The answer is the only option that has it too.', 'Üstteki resimlerin ortak bir yanı var. Doğru cevap, onu taşıyan tek seçenek.', 'Los dibujos de arriba tienen algo en común. La respuesta es la única opción que también lo tiene.'),
    (q) => L(`Find what is the same about the ${joinAnd(attrNames(q, 'en'), 'en')} of the pictures above, then check each option for it.`, `Üstteki resimlerin ${joinAnd(nomNames(q, 'tr'), 'tr')} özelliğinde ortak olanı bul, sonra her seçeneğe bak.`, `Busca qué es igual en ${joinAnd(attrNames(q, 'es'), 'es')} de los dibujos de arriba y comprueba cada opción.`),
  ],
  'grid-complete': [
    L('The grid changes one way across and another way down. The empty box has to fit both.', 'Tablo bir yönde bir şekilde, öbür yönde başka şekilde değişiyor. Boş kutu ikisine birden uymalı.', 'La cuadrícula cambia de una forma a lo ancho y de otra hacia abajo. La casilla vacía debe encajar con las dos.'),
    (q) => L(`Look across a row, then down a column: one way the ${attrNames(q, 'en')[0] || 'first feature'} changes, the other way the ${attrNames(q, 'en')[1] || 'second feature'}. Which is which?`, `Önce bir satıra, sonra bir sütuna bak: bir yönde ${nomNames(q, 'tr')[0] || 'bir özellik'}, öbür yönde ${nomNames(q, 'tr')[1] || 'başka bir özellik'} değişiyor. Hangisi hangi yönde?`, `Mira una fila y luego una columna: en un sentido cambia ${nomNames(q, 'es')[0] || 'una característica'} y en el otro ${nomNames(q, 'es')[1] || 'otra'}. ¿Cuál es cuál?`),
  ],
  analogy: [
    L('The first shape turns into the second. Make the same change to the third shape.', 'İlk şekil ikinciye dönüşüyor. Aynı değişikliği üçüncü şekle yap.', 'La primera figura se convierte en la segunda. Haz el mismo cambio con la tercera.'),
    (q) => L(`Compare the first two shapes. What changes in their ${joinAnd(attrNames(q, 'en'), 'en') || 'looks'}? Everything else stays the same.`, `İlk iki şekli karşılaştır. ${joinAnd(nomNames(q, 'tr'), 'tr')} özelliklerinde ne değişiyor? Geri kalan her şey aynı kalıyor.`, `Compara las dos primeras figuras. ¿Qué cambia en ${joinAnd(attrNames(q, 'es'), 'es') || 'su aspecto'}? Todo lo demás queda igual.`),
  ],
  reflection: [
    L('Imagine a mirror next to the shape. The mirror turns left into right and right into left.', 'Şeklin yanında bir ayna düşün. Ayna sağı sola, solu sağa çevirir.', 'Imagina un espejo junto a la figura. El espejo cambia la izquierda por la derecha y la derecha por la izquierda.'),
    () => L('Pick one part of the shape that is on one side, and find where it should be in the mirror. Then check the other parts.', 'Şeklin bir yanındaki bir parçayı seç ve aynadaki yerini bul. Sonra öbür parçalara bak.', 'Elige una parte de la figura que esté en un lado y busca dónde debe estar en el espejo. Luego revisa las otras partes.'),
  ],
  'hidden-part': [
    L('The small shape is hiding inside one of the pictures. Its outline and its shading must both match.', 'Küçük şekil resimlerden birinin içinde saklanıyor. Hem şekli hem dolgusu aynı olmalı.', 'La figura pequeña se esconde dentro de uno de los dibujos. Su contorno y su relleno deben coincidir.'),
    () => L('Trace the small shape with your eyes along the edges of each picture. Look for the exact same outline, not just a similar one.', 'Küçük şekli her resmin kenarlarında gözünle takip et. Benzerini değil, tıpatıp aynı çizgiyi ara.', 'Sigue con la vista la figura pequeña por los bordes de cada dibujo. Busca el mismo contorno exacto, no uno parecido.'),
  ],
  symmetry: [
    L('A shape is symmetrical if you can fold it down the middle and both halves match exactly.', 'Ortadan katlayınca iki yarısı tam üst üste gelen şekil simetriktir.', 'Una figura es simétrica si al doblarla por la mitad las dos mitades coinciden exactamente.'),
    () => L('Imagine a fold line down the middle of each shape. Do the left half and the right half match, including the shading?', 'Her şeklin ortasından bir katlama çizgisi düşün. Sol ve sağ yarı, dolgu da dahil, aynı mı?', 'Imagina una línea de pliegue por el centro de cada figura. ¿Coinciden la mitad izquierda y la derecha, incluido el relleno?'),
  ],
  code: [
    L('Each letter in the code stands for one thing about a shape. Work out what each letter means from the pictures above.', 'Koddaki her harf şeklin bir özelliğini anlatır. Üstteki resimlerden her harfin neyi anlattığını bul.', 'Cada letra del código representa una cosa de la figura. Descubre qué significa cada una con los dibujos de arriba.'),
    (q) => L(`One letter is about ${nomNames(q, 'en')[0] || 'one feature'}, the other about ${nomNames(q, 'en')[1] || 'another'}. Match each to the shapes that already have codes.`, `Harflerden biri ${nomNames(q, 'tr')[0] || 'bir özellik'}, öbürü ${nomNames(q, 'tr')[1] || 'başka bir özellik'} için. Kodu olan şekillerle eşleştir.`, `Una letra es de ${nomNames(q, 'es')[0] || 'una característica'} y la otra de ${nomNames(q, 'es')[1] || 'otra'}. Empareja cada una con las figuras que ya tienen código.`),
  ],
  overlay: [
    L('Imagine sliding one picture on top of the other without turning either. Every mark stays where it is.', 'Resimlerden birini ötekinin üstüne çevirmeden kaydırdığını düşün. Her işaret yerinde kalır.', 'Imagina deslizar un dibujo sobre el otro sin girarlos. Cada marca se queda donde está.'),
    () => L('Take one mark from the first picture and one from the second, and find where each ends up. Then check the options for both.', 'İlk resimden bir, ikinciden bir işaret al ve ikisinin nereye düştüğünü bul. Sonra seçeneklere ikisini de ara.', 'Toma una marca del primer dibujo y otra del segundo y busca dónde queda cada una. Luego busca las dos en las opciones.'),
  ],
  matrix: [
    L('Look along each row and down each column. Something turns or changes the same way each time.', 'Her satıra ve her sütuna bak. Bir şey her seferinde aynı biçimde dönüyor ya da değişiyor.', 'Mira cada fila y cada columna. Algo gira o cambia igual cada vez.'),
    () => L('Follow ONE small mark across the first row: where does it go each step? Then check the empty box for it.', 'İlk satırda TEK bir küçük işareti izle: her adımda nereye gidiyor? Sonra boş kutuda onu ara.', 'Sigue UNA marca pequeña por la primera fila: ¿adónde va en cada paso? Luego búscala en la casilla vacía.'),
  ],
  'compound-analogy': [
    L('Work out what was done to the first picture to get the second, then do exactly that to the third.', 'İlk resme ikinciyi elde etmek için ne yapıldığını bul, sonra tam aynısını üçüncüye yap.', 'Descubre qué se hizo al primer dibujo para obtener el segundo y haz exactamente eso con el tercero.'),
    () => L('Two things may have happened to the pieces: they may have turned, and filled and empty marks may have swapped. Check both.', 'Parçalara iki şey olmuş olabilir: dönmüş olabilirler, dolu ve boş işaretler yer değiştirmiş olabilir. İkisine de bak.', 'Pueden haber pasado dos cosas: que las piezas hayan girado y que las marcas llenas y vacías se hayan cambiado. Revisa las dos.'),
  ],
  'compound-mirror': [
    L('The whole picture is reflected in a mirror: left and right swap, and the shading stays as it is.', 'Resmin tamamı aynada yansıyor: sağ ile sol yer değiştirir, dolgular aynı kalır.', 'Todo el dibujo se refleja en un espejo: izquierda y derecha se cambian y el relleno se queda igual.'),
    () => L('Take the part on the far left and find it on the far right of each option. The same goes for the other parts.', 'En soldaki parçayı al ve her seçeneğin en sağında ara. Diğer parçalar için de aynısı.', 'Toma la parte de la izquierda del todo y búscala a la derecha del todo en cada opción. Igual con las demás partes.'),
  ],
  'cube-net': [
    L('Imagine folding the net into a cube. Each face goes onto a side, and faces that are opposite never touch.', 'Açınımı bir küp olacak şekilde katladığını düşün. Her yüz bir kenara gider ve karşılıklı yüzler birbirine değmez.', 'Imagina plegar el desarrollo para hacer un cubo. Cada cara va a un lado y las caras opuestas nunca se tocan.'),
    () => L('Find two faces that sit side by side in the net, and check that they also touch in each cube. Opposite faces are never next to each other.', 'Açınımda yan yana duran iki yüzü bul ve her küpte de birbirine değip değmediğine bak. Karşılıklı yüzler yan yana olamaz.', 'Busca dos caras que estén juntas en el desarrollo y comprueba si también se tocan en cada cubo. Las caras opuestas nunca están juntas.'),
  ],
  'glyph-odd': [
    L('Say what each picture is. All but one are the same kind of thing.', 'Her resmin ne olduğunu söyle. Biri dışında hepsi aynı türden.', 'Di qué es cada dibujo. Todos menos uno son del mismo tipo.'),
    () => L('Put the pictures into groups in your head: what could each one be used for, or where does it live? One does not fit.', 'Resimleri kafanda gruplara ayır: her biri ne için kullanılır ya da nerede yaşar? Biri uymuyor.', 'Agrupa los dibujos en tu cabeza: ¿para qué sirve cada uno o dónde vive? Uno no encaja.'),
  ],
  'glyph-belongs': [
    L('The pictures above are the same kind of thing. The answer is the one option of that kind.', 'Üstteki resimler aynı türden. Cevap, o türden olan tek seçenek.', 'Los dibujos de arriba son del mismo tipo. La respuesta es la única opción de ese tipo.'),
    () => L('Say what each picture above is, and what they have in common. Then check each option: is it that kind of thing too?', 'Üstteki her resmin ne olduğunu ve ortak yanlarını söyle. Sonra her seçeneğe bak: o da aynı türden mi?', 'Di qué es cada dibujo de arriba y qué tienen en común. Luego mira cada opción: ¿es de ese tipo también?'),
  ],
  'glyph-trait': [
    L('Think about what each thing can do or has. One of them is different from the rest in that way.', 'Her şeyin ne yapabildiğini ya da neye sahip olduğunu düşün. Biri bu yönden diğerlerinden farklı.', 'Piensa en lo que puede hacer o tiene cada cosa. Una es distinta de las demás en eso.'),
    () => L('Ask the same question about every picture, such as "can it fly?" or "does it have wings?", and see which answer is different.', 'Her resim için aynı soruyu sor ("uçabilir mi?", "kanadı var mı?") ve hangisinin cevabı farklı bak.', 'Haz la misma pregunta de cada dibujo, como "¿puede volar?" o "¿tiene alas?", y mira cuál responde distinto.'),
  ],
  'glyph-sequence': [
    L('The pictures repeat in the same order again and again. Find the part that repeats.', 'Resimler hep aynı sırayla tekrar ediyor. Tekrar eden kısmı bul.', 'Los dibujos se repiten siempre en el mismo orden. Busca la parte que se repite.'),
    () => L('Find where the first picture shows up again. Everything between is the pattern; keep counting along it.', 'İlk resmin tekrar nerede göründüğünü bul. Arası örüntü; onu sayarak ilerle.', 'Busca dónde vuelve a aparecer el primer dibujo. Lo que hay en medio es el patrón; sigue contando por él.'),
  ],
  'glyph-analogy': [
    L('The first two pictures are linked in a way. Find the link and use it on the third picture.', 'İlk iki resim bir şekilde bağlantılı. Bağlantıyı bul ve üçüncü resimde kullan.', 'Los dos primeros dibujos están unidos de alguna forma. Descubre el vínculo y úsalo con el tercero.'),
    () => L('Say the link in a sentence: "the first gives us / turns into / lives in the second". Then make the same sentence with the third picture.', 'Bağı bir cümleyle söyle: "ilki ikinciyi verir / ikinciye dönüşür / ikincide yaşar". Sonra aynı cümleyi üçüncü resimle kur.', 'Di el vínculo en una frase: "el primero da / se convierte en / vive en el segundo". Luego haz la misma frase con el tercero.'),
  ],
  'icon-odd': [
    L('Say what each picture is. All but one are the same kind of thing.', 'Her resmin ne olduğunu söyle. Biri dışında hepsi aynı türden.', 'Di qué es cada dibujo. Todos menos uno son del mismo tipo.'),
    () => L('Put the pictures into groups in your head. One does not fit with the others.', 'Resimleri kafanda gruplara ayır. Biri diğerleriyle uymuyor.', 'Agrupa los dibujos en tu cabeza. Uno no encaja con los demás.'),
  ],
  'icon-belongs': [
    L('The pictures above are the same kind of thing. The answer is the one option of that kind.', 'Üstteki resimler aynı türden. Cevap, o türden olan tek seçenek.', 'Los dibujos de arriba son del mismo tipo. La respuesta es la única opción de ese tipo.'),
    () => L('Say what each picture above is, and what they have in common. Then check each option.', 'Üstteki her resmin ne olduğunu ve ortak yanlarını söyle. Sonra her seçeneğe bak.', 'Di qué es cada dibujo de arriba y qué tienen en común. Luego mira cada opción.'),
  ],
  'icon-sequence': [
    L('The pictures repeat in order, and some also switch between filled and empty. Find the part that repeats.', 'Resimler sırayla tekrar ediyor, bazıları da dolu ile boş arasında gidip geliyor. Tekrar eden kısmı bul.', 'Los dibujos se repiten en orden y algunos alternan entre llenos y vacíos. Busca la parte que se repite.'),
    () => L('Follow the pictures along the row. Is the picture the same as two steps ago? Is it filled or empty this time?', 'Resimleri sırada izle. Resim iki adım öncekiyle aynı mı? Bu seferki dolu mu boş mu?', 'Sigue los dibujos por la fila. ¿Es igual que dos pasos atrás? ¿Está lleno o vacío esta vez?'),
  ],
}

const GENERIC = [
  L('Look carefully at the pictures and find what stays the same and what changes.', 'Resimlere dikkatle bak ve neyin aynı kaldığını, neyin değiştiğini bul.', 'Mira los dibujos con atención y busca qué se queda igual y qué cambia.'),
  () => L('Compare the options one by one with the pictures above.', 'Seçenekleri üstteki resimlerle tek tek karşılaştır.', 'Compara las opciones una a una con los dibujos de arriba.'),
]
const entry = (q) => HELP[q.type] || GENERIC

export const PUZZLE_HELP_TYPES = Object.keys(HELP)

/** Rung 1 { text }, rung 2 { eliminate } (an option index, null when none is left), rung 3 { text }. */
export function puzzleHintAt(q, level, lang = 'en', { eliminated = [] } = {}) {
  const [tip, look] = entry(q)
  const g = ['tr', 'es'].includes(lang) ? lang : 'en'
  if (level <= 1) return { level: 1, text: pick(tip, g) }
  if (level === 2) {
    const left = q.options.map((_, i) => i).filter(i => i !== q.correct_index && !eliminated.includes(i))
    return { level: 2, eliminate: left.length ? left[0] : null }
  }
  return { level: 3, text: pick(look(q, g), g) }
}

/** Every text a question's help can print, for the audit: { tip, look } with all three languages. */
export function puzzleAllHelp(q) {
  const [tip, look] = entry(q)
  return { tip, look: look(q, 'en') && { en: look(q, 'en').en, tr: look(q, 'tr').tr, es: look(q, 'es').es } }
}
