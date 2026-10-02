// Help for the English module: what a child is shown when they ask for a hint, and what the
// screen explains after a question is settled. Pure functions over an item the engine dealt
// (src/lib/englishTemplates.js); like the engine it runs on the SERVER only, because every hint is
// built from `rule` and `correct`, which never go near the browser until the question is over.
//
// Three rungs, the way the maths panel has them:
//   1. tip     the way to think about this KIND of question. Names no word of this question's answer.
//   2. narrow  one wrong option crossed out, with the reason (the option's own `why`).
//   3. steps   the question worked one small step at a time, stopping one step short of the answer.
// After the question is settled the same steps are shown in full, the last one being the answer
// and why it is right: that is the explanation a wrong answer is owed.
//
// Text is written trilingual in place (`L(en, tr, es)`), next to the logic that fills it, and the
// server picks the child's language (children.language), not the parent's. The audit
// (scripts/english-help-audit.mjs) fails any rung 1-3 that contains the answer.

import { spell } from './englishTemplates.js'

const L = (en, tr, es) => ({ en, tr, es })
const up = (s) => String(s).toUpperCase()
const ans = (it) => it.correct.map(i => it.options[i].text)
const wrongOptions = (it) => it.options.map((o, i) => ({ ...o, i })).filter(o => !it.correct.includes(o.i))
const spaced = (w) => [...String(w)].join(' ')
const sortedLetters = (w) => [...String(w)].sort().join('')

// One wrong option to use as a worked example: the first, so the same question always shows the same one.
const sample = (it) => wrongOptions(it)[0]?.text ?? ''

// An example pair for "opposite" tips that is none of the question's own words: a tip that used
// "hot, cold" ahead of a question whose answer is "hot" would hand it over.
const EXAMPLES = [
  ['hot', 'cold', 'sıcak, soğuk', 'caliente, frío'], ['up', 'down', 'yukarı, aşağı', 'arriba, abajo'],
  ['day', 'night', 'gündüz, gece', 'día, noche'], ['wet', 'dry', 'ıslak, kuru', 'mojado, seco'],
  ['open', 'shut', 'açık, kapalı', 'abierto, cerrado'],
]
function pickExample(it) {
  const used = new Set(it.options.flatMap(o => o.text.toLowerCase().split(/[^a-z]+/)).concat(Object.values(it.prompt).flatMap(v => typeof v === 'string' ? v.toLowerCase().split(/[^a-z]+/) : [])))
  return EXAMPLES.find(e => !used.has(e[0]) && !used.has(e[1])) || EXAMPLES[0]
}

// ── per-type help ────────────────────────────────────────────────────────────────────────────
// Each entry: (item) => { tip, steps }, `steps` ending with the step that states the answer.

const HELP = {
  // ── 7-8 verbal reasoning ──
  'anagram-pair': (it) => {
    const [a, b] = it.rule.words
    const w = sample(it)
    return {
      tip: L('Two of the words are made of exactly the same letters, just in a different order.',
        'İkisi tam olarak aynı harflerden oluşuyor, sadece sıraları farklı.',
        'Dos palabras tienen exactamente las mismas letras, solo que en otro orden.'),
      steps: [
        L(`Sort the letters of one word into A-Z order. "${w}" gives ${spaced(sortedLetters(w))}. Does another word give the same letters? No, so it is not one of the pair.`,
          `Bir kelimenin harflerini alfabe sırasına diz. "${w}" şöyle olur: ${spaced(sortedLetters(w))}. Başka bir kelime aynı harfleri veriyor mu? Hayır, o zaman çiftten biri değil.`,
          `Ordena las letras de una palabra de la A a la Z. "${w}" da ${spaced(sortedLetters(w))}. ¿Otra palabra da las mismas letras? No, así que no es de la pareja.`),
        L(`Do the same with each of the others. Two words give exactly the same letters: ${a} and ${b}, both ${spaced(sortedLetters(a))}.`,
          `Diğerlerine de aynısını yap. İki kelime tam aynı harfleri veriyor: ${a} ve ${b}, ikisi de ${spaced(sortedLetters(a))}.`,
          `Haz lo mismo con las demás. Dos palabras dan las mismas letras: ${a} y ${b}, ambas ${spaced(sortedLetters(a))}.`),
      ],
    }
  },
  'letter-code': (it) => {
    const key = it.rule.key
    const nums = it.prompt.keyCode.split(' ')
    const table = [...key].map((c, i) => `${up(c)}=${nums[i]}`).join('  ')
    const word = it.rule.word
    const code = (w) => [...w].map(c => key.indexOf(c) + 1).join(' ')
    return it.rule.decode ? {
      tip: L('Write the key under its numbers first. Then change each number back into its letter, one at a time.',
        'Önce anahtarı numaralarının altına yaz. Sonra her numarayı sırayla harfine çevir.',
        'Primero escribe la clave bajo sus números. Luego cambia cada número por su letra, uno a uno.'),
      steps: [
        L(`Write the key out: ${table}.`, `Anahtarı yaz: ${table}.`, `Escribe la clave: ${table}.`),
        L(`Take the code ${it.prompt.code} one number at a time. The first number is ${it.prompt.code.split(' ')[0]}, and ${it.prompt.code.split(' ')[0]} is the letter ${up(word[0])}.`,
          `${it.prompt.code} kodunu sırayla al. İlk numara ${it.prompt.code.split(' ')[0]}, ${it.prompt.code.split(' ')[0]} da ${up(word[0])} harfi.`,
          `Toma el código ${it.prompt.code} número a número. El primero es ${it.prompt.code.split(' ')[0]}, y ${it.prompt.code.split(' ')[0]} es la letra ${up(word[0])}.`),
        L(`The letters spell ${up(word)}.`, `Harfler ${up(word)} kelimesini oluşturuyor.`, `Las letras forman ${up(word)}.`),
      ],
    } : {
      tip: L('Write the key under its numbers first. Then find each letter of the word in the key and write its number.',
        'Önce anahtarı numaralarının altına yaz. Sonra kelimenin her harfini anahtarda bul ve numarasını yaz.',
        'Primero escribe la clave bajo sus números. Luego busca cada letra de la palabra en la clave y escribe su número.'),
      steps: [
        L(`Write the key out: ${table}.`, `Anahtarı yaz: ${table}.`, `Escribe la clave: ${table}.`),
        L(`Take ${up(word)} one letter at a time. The first letter is ${up(word[0])}, and in the key ${up(word[0])} is ${key.indexOf(word[0]) + 1}.`,
          `${up(word)} kelimesini harf harf al. İlk harf ${up(word[0])}, anahtarda ${up(word[0])} = ${key.indexOf(word[0]) + 1}.`,
          `Toma ${up(word)} letra a letra. La primera es ${up(word[0])}, y en la clave ${up(word[0])} es ${key.indexOf(word[0]) + 1}.`),
        L(`The code is ${code(word)}.`, `Kod ${code(word)}.`, `El código es ${code(word)}.`),
      ],
    }
  },
  'front-letter': (it) => {
    const tails = it.prompt.tails
    const w = sample(it)
    return {
      tip: L('One letter goes in front of ALL the endings and makes a real word every time. If it fails once, it is not the letter.',
        'Tek bir harf TÜM eklerin başına gelip her seferinde gerçek bir kelime yapmalı. Bir kez bile tutmazsa o harf değil.',
        'Una letra va delante de TODAS las terminaciones y forma una palabra real cada vez. Si falla una vez, no es esa.'),
      steps: [
        L(`Try an option on every ending. "${w}": ${tails.map(t => w + t).join(', ')}. Not all of them are words, so cross it out.`,
          `Bir şıkkı tüm eklerde dene. "${w}": ${tails.map(t => w + t).join(', ')}. Hepsi kelime değil, çiz gitsin.`,
          `Prueba una opción con todas las terminaciones. "${w}": ${tails.map(t => w + t).join(', ')}. No todas son palabras, táchala.`),
        L(`Only ${up(it.rule.letter)} works with all of them: ${it.rule.words.join(', ')}.`,
          `Hepsiyle yalnız ${up(it.rule.letter)} çalışıyor: ${it.rule.words.join(', ')}.`,
          `Solo ${up(it.rule.letter)} funciona con todas: ${it.rule.words.join(', ')}.`),
      ],
    }
  },
  'alpha-order': (it) => {
    const n = it.rule.nth
    const ord = ['', 'first', 'second', 'third', 'fourth', 'fifth']
    const ordTr = ['', 'ilk', 'ikinci', 'üçüncü', 'dördüncü', 'beşinci']
    const ordEs = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta']
    return {
      tip: L('Look at the first letter of each word and put the words in A-Z order. If two start the same, look at the next letter.',
        'Her kelimenin ilk harfine bak ve kelimeleri A-Z sırasına diz. İkisi aynı harfle başlıyorsa bir sonraki harfe bak.',
        'Mira la primera letra de cada palabra y ordénalas de la A a la Z. Si dos empiezan igual, mira la letra siguiente.'),
      steps: [
        L(`Write the first letters in a row: ${it.options.map(o => up(o.text[0])).join(' ')}.`,
          `İlk harfleri yan yana yaz: ${it.options.map(o => up(o.text[0])).join(' ')}.`,
          `Escribe las primeras letras en fila: ${it.options.map(o => up(o.text[0])).join(' ')}.`),
        L(`Put them in alphabet order and count to number ${n}: that is the ${ord[n]} word.`,
          `Alfabe sırasına diz ve ${n}. sıraya kadar say: aranan ${ordTr[n]} kelime o.`,
          `Ponlas en orden alfabético y cuenta hasta el número ${n}: es la palabra ${ordEs[n]}.`),
        L(`In order the words go ${it.rule.order.join(', ')}. Number ${n} is ${it.rule.order[n - 1]}.`,
          `Sıralı hâli: ${it.rule.order.join(', ')}. ${n}. kelime ${it.rule.order[n - 1]}.`,
          `En orden quedan ${it.rule.order.join(', ')}. La número ${n} es ${it.rule.order[n - 1]}.`),
      ],
    }
  },
  'join-letter': (it) => {
    const { left, right } = it.prompt
    const w = sample(it)
    return {
      tip: L('One letter does two jobs: it finishes the first word and it starts the second word.',
        'Tek bir harf iki iş yapıyor: birinci kelimeyi bitiriyor, ikinciyi başlatıyor.',
        'Una letra hace dos trabajos: termina la primera palabra y empieza la segunda.'),
      steps: [
        L(`Try an option in both places. "${w}" gives ${left}${w} and ${w}${right}. Are both real words? No, so cross it out.`,
          `Bir şıkkı iki yerde de dene. "${w}": ${left}${w} ve ${w}${right}. İkisi de gerçek kelime mi? Hayır, çiz.`,
          `Prueba una opción en los dos sitios. "${w}" da ${left}${w} y ${w}${right}. ¿Son las dos palabras reales? No, táchala.`),
        L(`With ${up(ans(it)[0])}: ${it.rule.words[0]} and ${it.rule.words[1]}. Both are words.`,
          `${up(ans(it)[0])} ile: ${it.rule.words[0]} ve ${it.rule.words[1]}. İkisi de kelime.`,
          `Con ${up(ans(it)[0])}: ${it.rule.words[0]} y ${it.rule.words[1]}. Las dos son palabras.`),
      ],
    }
  },
  'change-pattern': (it) => {
    const [a, b] = it.prompt.pairs[0]
    const x = it.prompt.word
    const kind = it.rule.rule.split(':')[0]
    const how = kind.startsWith('sub') ? L('One letter is swapped for another, in the same place.', 'Bir harf, aynı yerde başka bir harfle değişiyor.', 'Una letra se cambia por otra, en el mismo sitio.')
      : kind.startsWith('ins') ? L('One letter is added, in the same place.', 'Aynı yere bir harf ekleniyor.', 'Se añade una letra, en el mismo sitio.')
        : kind === 'drop' ? L('The first letter is taken away.', 'İlk harf çıkarılıyor.', 'Se quita la primera letra.')
          : L('The word is turned round backwards.', 'Kelime tersten yazılıyor.', 'La palabra se escribe al revés.')
    return {
      tip: L('Look at what changes in the first two pairs. The same change must work on the third word.',
        'İlk iki çiftte neyin değiştiğine bak. Aynı değişiklik üçüncü kelimede de çalışmalı.',
        'Mira qué cambia en las dos primeras parejas. El mismo cambio debe servir para la tercera palabra.'),
      steps: [
        L(`Line up ${a} and ${b}, letter by letter. What is different?`, `${a} ile ${b} kelimelerini harf harf alt alta getir. Ne farklı?`, `Alinea ${a} y ${b}, letra a letra. ¿Qué es distinto?`),
        L(`Here ${how.en.charAt(0).toLowerCase()}${how.en.slice(1)} Do exactly that to ${x}.`,
          `Burada ${how.tr.charAt(0).toLocaleLowerCase('tr')}${how.tr.slice(1)} Aynısını ${x} kelimesine yap.`,
          `Aquí ${how.es.charAt(0).toLowerCase()}${how.es.slice(1)} Haz exactamente eso con ${x}.`),
        L(`${x} becomes ${ans(it)[0]}.`, `${x} kelimesi ${ans(it)[0]} oluyor.`, `${x} se convierte en ${ans(it)[0]}.`),
      ],
    }
  },
  'word-ladder': (it) => {
    const { from, to } = it.prompt
    return {
      tip: L('The middle word is ONE letter away from the first word and ONE letter away from the last word.',
        'Ortadaki kelime ilk kelimeden BİR harf, son kelimeden de BİR harf uzakta.',
        'La palabra del medio está a UNA letra de la primera y a UNA letra de la última.'),
      steps: [
        L(`Check every option twice: is it one letter away from ${from}? Is it one letter away from ${to}?`,
          `Her şıkkı iki kez kontrol et: ${from} kelimesinden bir harf uzak mı? ${to} kelimesinden bir harf uzak mı?`,
          `Comprueba cada opción dos veces: ¿está a una letra de ${from}? ¿Está a una letra de ${to}?`),
        L(`Only ${ans(it)[0]} passes both tests.`, `İki sınavı da yalnız ${ans(it)[0]} geçiyor.`, `Solo ${ans(it)[0]} pasa las dos pruebas.`),
      ],
    }
  },
  'not-from-letters': (it) => {
    const word = it.prompt.word
    return {
      tip: L('Three-quarters of the words can be built from the letters of the big word. One cannot.',
        'Kelimelerin çoğu büyük kelimenin harflerinden kurulabilir. Biri kurulamaz.',
        'Casi todas las palabras se pueden formar con las letras de la palabra grande. Una no.'),
      steps: [
        L(`Write out the letters of ${word}: ${spaced(sortedLetters(word))}.`, `${word} kelimesinin harflerini yaz: ${spaced(sortedLetters(word))}.`, `Escribe las letras de ${word}: ${spaced(sortedLetters(word))}.`),
        L('Take an option and tick off its letters, one at a time. A letter that is missing, or already used up, means it can\'t be built.',
          'Bir şıkkı al ve harflerini tek tek işaretle. Eksik ya da zaten kullanılmış bir harf varsa kurulamaz.',
          'Toma una opción y tacha sus letras una a una. Si falta una letra, o ya está gastada, no se puede formar.'),
        L(`${ans(it)[0]} needs a letter ${word} does not have (or has already used).`,
          `${ans(it)[0]} kelimesi, ${word} kelimesinde olmayan (ya da bitmiş) bir harf istiyor.`,
          `${ans(it)[0]} necesita una letra que ${word} no tiene (o que ya se gastó).`),
      ],
    }
  },
  'letter-analogy': (it) => {
    const { a, b, c } = it.prompt
    const pat = it.rule.pattern
    const how = pat === 'number'
      ? L('the letter moves one place along and the number goes up by one', 'harf bir ilerliyor, sayı bir artıyor', 'la letra avanza un puesto y el número sube uno')
      : pat === 'mirror'
        ? L('the first letter moves along and the second letter, counted from the end of the alphabet, moves back', 'ilk harf ileri gidiyor, ikinci harf (alfabenin sonundan sayılan) geri geliyor', 'la primera letra avanza y la segunda, contada desde el final del alfabeto, retrocede')
        : pat === 'back-pair'
          ? L(`every letter moves ${it.rule.step} along`, `her harf ${it.rule.step} ileri gidiyor`, `cada letra avanza ${it.rule.step}`)
          : L(`every letter moves ${it.rule.step} along the alphabet`, `her harf alfabede ${it.rule.step} ileri gidiyor`, `cada letra avanza ${it.rule.step} en el alfabeto`)
    return {
      tip: L('Write the alphabet out. Find how the first group turns into the second, then do the same to the third.',
        'Alfabeyi yaz. İlk grubun ikinciye nasıl dönüştüğünü bul, aynısını üçüncüye uygula.',
        'Escribe el alfabeto. Mira cómo el primer grupo pasa al segundo y haz lo mismo con el tercero.'),
      steps: [
        L(`Compare ${a} with ${b}. What happens to each letter or number?`, `${a} → ${b}: Her harfe ya da sayıya ne oluyor?`, `Compara ${a} con ${b}. ¿Qué le pasa a cada letra o número?`),
        L(`Here ${how.en}. Do the same to ${c}.`, `Burada ${how.tr}. Aynısını ${c} için yap.`, `Aquí ${how.es}. Haz lo mismo con ${c}.`),
        L(`${c} becomes ${ans(it)[0]}.`, `${c} → ${ans(it)[0]}.`, `${c} pasa a ser ${ans(it)[0]}.`),
      ],
    }
  },
  analogy: (it) => {
    const { a, A, b } = it.prompt
    const link = {
      young: L(`"${A}" is the baby of "${a}"`, `"${A}", "${a}" yavrusu`, `"${A}" es la cría de "${a}"`),
      sound: L(`"${A}" is the sound a "${a}" makes`, `"${A}", "${a}" sesi`, `"${A}" es el sonido que hace "${a}"`),
      home: L(`"${A}" is where a "${a}" lives`, `"${A}", "${a}" yaşadığı yer`, `"${A}" es donde vive "${a}"`),
      colour: L(`"${A}" is the colour of "${a}"`, `"${A}", "${a}" rengi`, `"${A}" es el color de "${a}"`),
      opposite: L(`"${A}" is the opposite of "${a}"`, `"${A}", "${a}" kelimesinin zıttı`, `"${A}" es lo contrario de "${a}"`),
      female: L(`"${A}" is the female of "${a}"`, `"${A}", "${a}" kelimesinin dişi karşılığı`, `"${A}" es la hembra de "${a}"`),
      foot: L(`"${A}" is the part a "${a}" stands on`, `"${A}", "${a}" varlığının üzerinde durduğu kısım`, `"${A}" es la parte sobre la que se apoya "${a}"`),
      travels: L(`"${A}" is what a "${a}" travels on`, `"${A}", "${a}" aracının üzerinde gittiği şey`, `"${A}" es por donde viaja "${a}"`),
    }[it.rule.relation]
    return {
      tip: L('Say the first pair as a sentence, then use the same link for the second pair.',
        'İlk çifti bir cümleyle söyle, sonra aynı bağı ikinci çift için kullan.',
        'Di la primera pareja como una frase y usa el mismo vínculo para la segunda.'),
      steps: [
        L(`Say the first pair as a sentence: "${a}" and "${A}". How are they linked?`, `İlk çifti cümleyle söyle: "${a}" ve "${A}". Aralarındaki bağ ne?`, `Di la primera pareja en una frase: "${a}" y "${A}". ¿Cómo se relacionan?`),
        ...(link ? [L(`${link.en}. Make the same sentence with "${b}".`, `${link.tr}. Aynı cümleyi "${b}" ile kur.`, `${link.es}. Haz la misma frase con "${b}".`)] : []),
        L(`The answer is ${ans(it)[0]}.`, `Cevap ${ans(it)[0]}.`, `La respuesta es ${ans(it)[0]}.`),
      ],
    }
  },
  'rhyme-synonym': (it) => {
    const { word, rhyme } = it.prompt
    return {
      tip: L('The answer has to do TWO things: mean the same as the clue, and rhyme with the other word.',
        'Cevap İKİ şeyi birden yapmalı: ipucu kelimeyle aynı anlama gelmeli ve diğer kelimeyle uyaklı olmalı.',
        'La respuesta tiene que cumplir DOS cosas: significar lo mismo que la pista y rimar con la otra palabra.'),
      steps: [
        L(`Cross out every word that does not mean ${String(word).toLowerCase()}.`, `${String(word).toLowerCase()} anlamına gelmeyenleri çiz.`, `Tacha las palabras que no significan ${String(word).toLowerCase()}.`),
        L(`Of what is left, say each one next to "${rhyme}". Which pair ends with the same sound?`, `Kalanları "${rhyme}" ile yan yana söyle. Hangisi aynı sesle bitiyor?`, `De las que quedan, di cada una junto a "${rhyme}". ¿Cuál termina con el mismo sonido?`),
        L(`${ans(it)[0]} means ${String(word).toLowerCase()} and rhymes with ${rhyme}.`, `${ans(it)[0]} hem ${String(word).toLowerCase()} anlamında hem ${rhyme} ile uyaklı.`, `${ans(it)[0]} significa ${String(word).toLowerCase()} y rima con ${rhyme}.`),
      ],
    }
  },
  'compound-front': (it) => {
    const tails = it.prompt.tails
    const w = sample(it)
    return {
      tip: L('One word can go in front of ALL the endings to make four new words.', 'Tek bir kelime TÜM eklerin önüne gelip dört yeni kelime yapabilir.', 'Una sola palabra puede ir delante de TODAS las terminaciones y formar cuatro palabras nuevas.'),
      steps: [
        L(`Try an option on all four: "${w}" gives ${tails.map(t => w + t).join(', ')}. Some of those are not words, so cross it out.`,
          `Bir şıkkı dördünde de dene: "${w}": ${tails.map(t => w + t).join(', ')}. Bazıları kelime değil, çiz.`,
          `Prueba una opción con las cuatro: "${w}" da ${tails.map(t => w + t).join(', ')}. Algunas no son palabras, táchala.`),
        L(`${ans(it)[0]} makes ${it.rule.words.join(', ')}.`, `${ans(it)[0]}: ${it.rule.words.join(', ')}.`, `${ans(it)[0]} forma ${it.rule.words.join(', ')}.`),
      ],
    }
  },
  'pair-meaning': (it) => {
    const opp = it.rule.opposite
    const eg = pickExample(it)
    return {
      tip: opp
        ? L(`Opposite means one word is the reverse of the other (${eg[0]}, ${eg[1]}). Check each pair.`, `Zıt, bir kelimenin diğerinin tersi olması demek (${eg[2]}). Her çifti kontrol et.`, `Opuesto quiere decir que una palabra es lo contrario de la otra (${eg[3]}). Revisa cada pareja.`)
        : L('Same meaning means you could swap one word for the other in a sentence. Check each pair.', 'Aynı anlam, bir cümlede birini diğerinin yerine koyabilmek demek. Her çifti kontrol et.', 'Mismo significado quiere decir que puedes cambiar una palabra por la otra en una frase. Revisa cada pareja.'),
      steps: [
        L('Say each pair out loud and decide: same, opposite, or only in the same family of things (like car and bus).', 'Her çifti yüksek sesle söyle ve karar ver: aynı, zıt ya da yalnızca aynı grup (araba ile otobüs gibi).', 'Di cada pareja en voz alta y decide: igual, opuesta o solo de la misma familia (como coche y autobús).'),
        L(`${ans(it)[0]} is the pair that ${opp ? 'is opposite' : 'means the same'}.`, `${ans(it)[0]} çifti ${opp ? 'zıt anlamlı' : 'aynı anlamda'}.`, `${ans(it)[0]} es la pareja que ${opp ? 'es opuesta' : 'significa lo mismo'}.`),
      ],
    }
  },
  'logic-grid': (it) => {
    if (it.rule.kind === 'logic-order') {
      const [x, y, w] = it.rule.order
      return {
        tip: L('Draw a line from the smallest to the biggest and put each name on it, one fact at a time.', 'Küçükten büyüğe bir çizgi çiz ve her bilgiyle bir ismi yerleştir.', 'Dibuja una línea de menor a mayor y coloca cada nombre con cada dato.'),
        steps: [
          L(`Put the first two names on the line, using the first sentence.`, 'İlk cümleyi kullanarak ilk iki ismi çizgiye yerleştir.', 'Coloca los dos primeros nombres en la línea con la primera frase.'),
          L('Use the other sentence to fit the third name in.', 'Diğer cümleyle üçüncü ismi yerine koy.', 'Usa la otra frase para colocar el tercer nombre.'),
          L(`The line goes ${w}, ${y}, ${x} (from the end the sentences call less to the end they call more).`, `Sıra: ${w}, ${y}, ${x} (azdan çoğa).`, `La línea queda ${w}, ${y}, ${x} (de menos a más).`),
        ],
      }
    }
    const [q1, q2] = it.rule.ask
    const first = Object.entries(it.rule.who).filter(([k]) => k.split('|')[0] === q1).map(([, n]) => n)
    const second = Object.entries(it.rule.who).filter(([k]) => k.split('|')[1] === q2).map(([, n]) => n)
    return {
      tip: L('Make two short lists, one for each thing the question asks, and find the name that is on BOTH.', 'Sorunun sorduğu her şey için kısa bir liste yap ve İKİSİNDE de olan ismi bul.', 'Haz dos listas cortas, una por cada cosa que pregunta, y busca el nombre que está en LAS DOS.'),
      steps: [
        L(`List the names that go with "${q1}": ${first.join(' and ')}.`, `"${q1}" ile ilgili isimleri yaz: ${first.join(' ve ')}.`, `Anota los nombres que van con "${q1}": ${first.join(' y ')}.`),
        L(`List the names that go with "${q2}": ${second.join(' and ')}.`, `"${q2}" ile ilgili isimleri yaz: ${second.join(' ve ')}.`, `Anota los nombres que van con "${q2}": ${second.join(' y ')}.`),
        L(`Only ${ans(it)[0]} is on both lists.`, `İki listede de yalnız ${ans(it)[0]} var.`, `Solo ${ans(it)[0]} está en las dos listas.`),
      ],
    }
  },
  unscramble: (it) => ({
    tip: L('Look for a common start, a common ending, or a vowel pair; build little chunks of the word.', 'Yaygın bir başlangıç, bir bitiş ya da ünlü çifti ara; kelimeyi küçük parçalarla kur.', 'Busca un comienzo, un final o una pareja de vocales comunes; forma trocitos de la palabra.'),
    steps: [
      L(`The letters are ${spaced(sortedLetters(it.prompt.letters.toLowerCase()))} in A-Z order. Each option must use exactly these.`, `Harfler alfabe sırasıyla ${spaced(sortedLetters(it.prompt.letters.toLowerCase()))}. Her şık tam olarak bunları kullanmalı.`, `Las letras son ${spaced(sortedLetters(it.prompt.letters.toLowerCase()))} en orden A-Z. Cada opción debe usar exactamente estas.`),
      L('Count the letters of each option and check them against the muddled letters. Cross out any that has a different letter.', 'Her şıkkın harflerini say ve karışık harflerle karşılaştır. Farklı harfi olanı çiz.', 'Cuenta las letras de cada opción y compáralas con las revueltas. Tacha la que tenga una letra distinta.'),
      L(`${up(it.prompt.letters)} rearranged spells ${ans(it)[0]}.`, `${up(it.prompt.letters)} harflerini dizince ${ans(it)[0]} olur.`, `${up(it.prompt.letters)} reordenadas forman ${ans(it)[0]}.`),
    ],
  }),
  'letters-in-order': (it) => {
    const bad = wrongOptions(it)[0]?.text || ''
    let at = -1
    for (let i = 1; i < bad.length; i++) if (bad[i] < bad[i - 1]) { at = i; break }
    const show = at > 0
      ? L(`"${bad}": ${up(bad[at - 1])} then ${up(bad[at])}. ${up(bad[at])} comes BEFORE ${up(bad[at - 1])} in the alphabet, so it is out of order.`,
        `"${bad}": ${up(bad[at - 1])} sonra ${up(bad[at])}. ${up(bad[at])}, alfabede ${up(bad[at - 1])} harfinden ÖNCE gelir, sıra bozuk.`,
        `"${bad}": ${up(bad[at - 1])} y luego ${up(bad[at])}. ${up(bad[at])} va ANTES que ${up(bad[at - 1])} en el alfabeto, está desordenada.`)
      : L('Check each word letter by letter.', 'Her kelimeyi harf harf kontrol et.', 'Revisa cada palabra letra a letra.')
    return {
      tip: L('In the right word, every letter comes later in the alphabet than the one before it.', 'Doğru kelimede her harf, kendinden öncekinden alfabede daha sonra gelir.', 'En la palabra correcta, cada letra va más adelante en el alfabeto que la anterior.'),
      steps: [
        show,
        L(`${ans(it)[0]} goes ${spaced(up(ans(it)[0]))}, every letter later than the last. So that is the one.`, `${ans(it)[0]}: ${spaced(up(ans(it)[0]))}, her harf bir öncekinden sonra geliyor. Cevap o.`, `${ans(it)[0]}: ${spaced(up(ans(it)[0]))}, cada letra va después de la anterior. Esa es.`),
      ],
    }
  },
  'letter-sum': (it) => {
    const { val, x, op, y } = it.rule
    const sum = it.prompt.sum
    return {
      tip: L('Swap each letter for its number, then do the sum.', 'Her harfi sayısıyla değiştir, sonra işlemi yap.', 'Cambia cada letra por su número y luego haz la operación.'),
      steps: [
        L(`Write the numbers in: ${x} = ${val[x]} and ${y} = ${val[y]}, so ${sum} is ${val[x]} ${op} ${val[y]}.`, `Sayıları yaz: ${x} = ${val[x]}, ${y} = ${val[y]}; yani ${sum} işlemi ${val[x]} ${op} ${val[y]}.`, `Escribe los números: ${x} = ${val[x]} y ${y} = ${val[y]}, así que ${sum} es ${val[x]} ${op} ${val[y]}.`),
        ...(it.prompt.asLetter ? [L('Work it out, then look in the table for the letter with that number.', 'Sonucu bul, sonra tabloda o sayıya sahip harfi ara.', 'Calcúlalo y busca en la tabla la letra con ese número.')] : []),
        L(`${val[x]} ${op} ${val[y]} gives ${ans(it)[0]}.`, `${val[x]} ${op} ${val[y]} = ${ans(it)[0]}.`, `${val[x]} ${op} ${val[y]} da ${ans(it)[0]}.`),
      ],
    }
  },
  // ── meanings ──
  synonym: (it) => ({
    tip: L('Say a sentence with the word. Then put each option into the same sentence: which one keeps the meaning?', 'Kelimeyle bir cümle kur. Sonra her şıkkı aynı cümleye koy: hangisi anlamı koruyor?', 'Di una frase con la palabra. Luego pon cada opción en la misma frase: ¿cuál mantiene el significado?'),
    steps: [
      L('Cross out any option that means the OPPOSITE, or that only sounds a bit like the word. They are traps.', 'ZIT anlamlı olanları ve yalnızca kulağa benzeyenleri çiz. Bunlar tuzak.', 'Tacha las opciones que significan lo CONTRARIO o que solo suenan parecido. Son trampas.'),
      L(`"${it.rule.of}" and "${ans(it)[0]}" mean almost the same thing.`, `"${it.rule.of}" ile "${ans(it)[0]}" neredeyse aynı anlamda.`, `"${it.rule.of}" y "${ans(it)[0]}" significan casi lo mismo.`),
    ],
  }),
  antonym: (it) => {
    const eg = pickExample(it)
    return {
    tip: L(`Think of the word that is the exact reverse (${eg[0]}, ${eg[1]}). Check each option against it.`, `Tam tersi olan kelimeyi düşün (${eg[2]}). Şıkları onunla karşılaştır.`, `Piensa en la palabra que es justo lo contrario (${eg[3]}). Compara las opciones con ella.`),
    steps: [
      L('Cross out words that mean the SAME, and words that have nothing to do with it.', 'AYNI anlamda olanları ve hiç alakası olmayanları çiz.', 'Tacha las que significan LO MISMO y las que no tienen nada que ver.'),
      L(`The opposite of "${it.rule.of}" is "${ans(it)[0]}".`, `"${it.rule.of}" kelimesinin zıttı "${ans(it)[0]}".`, `El opuesto de "${it.rule.of}" es "${ans(it)[0]}".`),
    ],
  }
  },
  sense: (it) => ({
    tip: L('A word can mean different things. Read the whole sentence to see which meaning is being used.', 'Bir kelimenin birden çok anlamı olabilir. Hangisinin kullanıldığını görmek için cümlenin tamamını oku.', 'Una palabra puede tener varios significados. Lee toda la frase para ver cuál se usa.'),
    steps: [
      L(`Read it again: "${it.prompt.sentence}".`, `Yeniden oku: "${it.prompt.sentence}".`, `Léela otra vez: "${it.prompt.sentence}".`),
      L(`Put each option in place of "${it.prompt.word}". The sentence must still make sense and mean the same.`, `"${it.prompt.word}" yerine her şıkkı koy. Cümle yine anlamlı olmalı ve aynı şeyi anlatmalı.`, `Pon cada opción en lugar de "${it.prompt.word}". La frase debe tener sentido y significar lo mismo.`),
      L(`"${ans(it)[0]}" fits: it is how "${it.prompt.word}" is used here.`, `"${ans(it)[0]}" uyuyor: "${it.prompt.word}" burada bu anlamda.`, `"${ans(it)[0]}" encaja: así se usa "${it.prompt.word}" aquí.`),
    ],
  }),
  'odd-two': (it) => ({
    tip: L('Three of the words belong together in one group. The two that do not are the answer.', 'Kelimelerden üçü aynı gruba ait. Ait olmayan ikisi cevap.', 'Tres de las palabras forman un grupo. Las dos que no encajan son la respuesta.'),
    steps: [
      (() => {
        const inside = it.options.filter((_, i) => !it.correct.includes(i)).map(o => o.text).slice(0, 2).join(', ')
        return L(`Three of the words belong together, for example ${inside}: they are all kinds of ${it.rule.group}.`, `Üç kelime birbirine ait, örneğin ${inside}: hepsi bir tür: ${it.rule.group}.`, `Tres de las palabras van juntas, por ejemplo ${inside}: todas son tipos de: ${it.rule.group}.`)
      })(),
      L(`The other two, ${ans(it).join(' and ')}, are not.`, `Diğer ikisi, ${ans(it).join(' ve ')}, değil.`, `Las otras dos, ${ans(it).join(' y ')}, no.`),
    ],
  }),
  'word-grid': (it) => ({
    tip: it.prompt.opposite
      ? L(`Find TWO words that mean the opposite of "${it.prompt.word}". Read the whole grid before you choose.`, `"${it.prompt.word}" kelimesinin zıttı İKİ kelimeyi bul. Seçmeden önce tüm tabloyu oku.`, `Busca DOS palabras con el significado contrario de "${it.prompt.word}". Lee toda la cuadrícula antes de elegir.`)
      : L(`Find TWO words that mean the same as "${it.prompt.word}". Read the whole grid before you choose.`, `"${it.prompt.word}" ile aynı anlamdaki İKİ kelimeyi bul. Seçmeden önce tüm tabloyu oku.`, `Busca DOS palabras con el mismo significado que "${it.prompt.word}". Lee toda la cuadrícula antes de elegir.`),
    steps: [
      L('Go along the grid one row at a time and cross out words that are about something else.', 'Tabloda satır satır ilerle ve başka konudaki kelimeleri çiz.', 'Recorre la cuadrícula fila a fila y tacha las palabras que son de otra cosa.'),
      L(`${ans(it).join(' and ')} are the two.`, `${ans(it).join(' ve ')} kelimeleri.`, `${ans(it).join(' y ')} son las dos.`),
    ],
  }),
  'letter-pair': (it) => ({
    tip: L('Think of a word with the meaning asked for, then see which letters would fill the gap.', 'İstenen anlamda bir kelime düşün, sonra boşluğa hangi harflerin geleceğine bak.', 'Piensa en una palabra con el significado pedido y mira qué letras llenan el hueco.'),
    steps: [
      L(`The gap is "${it.prompt.masked}". Put each option into the gap and read the whole word.`, `Boşluk: "${it.prompt.masked}". Her şıkkı boşluğa koy ve kelimenin tamamını oku.`, `El hueco es "${it.prompt.masked}". Pon cada opción en el hueco y lee la palabra entera.`),
      L(`Only ${ans(it)[0]} makes a real word that ${it.prompt.opposite ? 'means the opposite of' : 'means the same as'} "${it.prompt.word}": ${it.rule.answer}.`, `Yalnız ${ans(it)[0]}, "${it.prompt.word}" kelimesinin ${it.prompt.opposite ? 'zıttı' : 'eş anlamlısı'} olan gerçek bir kelime yapıyor: ${it.rule.answer}.`, `Solo ${ans(it)[0]} forma una palabra real que ${it.prompt.opposite ? 'significa lo contrario de' : 'significa lo mismo que'} "${it.prompt.word}": ${it.rule.answer}.`),
    ],
  }),
  'shared-letters': (it) => {
    const [b1, b2] = it.prompt.blanks
    const w = sample(it)
    return {
      tip: L('The SAME three letters, in the same order, must make a real word in BOTH gaps.', 'AYNI üç harf, aynı sırayla, İKİ boşlukta da gerçek bir kelime yapmalı.', 'Las MISMAS tres letras, en el mismo orden, deben formar una palabra real en LOS DOS huecos.'),
      steps: [
        L(`Try an option in both gaps. "${w}" gives ${b1.replace('___', w)} and ${b2.replace('___', w)}. Not both are words, so cross it out.`, `Bir şıkkı iki boşlukta dene. "${w}": ${b1.replace('___', w)} ve ${b2.replace('___', w)}. İkisi birden kelime değil, çiz.`, `Prueba una opción en los dos huecos. "${w}" da ${b1.replace('___', w)} y ${b2.replace('___', w)}. No son palabras las dos, táchala.`),
        L(`${ans(it)[0]} gives ${it.rule.words.join(' and ')}.`, `${ans(it)[0]}: ${it.rule.words.join(' ve ')}.`, `${ans(it)[0]} da ${it.rule.words.join(' y ')}.`),
      ],
    }
  },
  'hidden-word': (it) => {
    const w = sample(it)
    return {
      tip: L('A small word is hiding inside a longer word. Put each option into the gap and see if the long word is real.', 'Uzun bir kelimenin içinde küçük bir kelime saklanıyor. Her şıkkı boşluğa koy ve uzun kelimenin gerçek olup olmadığına bak.', 'Una palabra pequeña se esconde dentro de otra larga. Pon cada opción en el hueco y mira si la palabra larga existe.'),
      steps: [
        L(`Read the sentence to see which word is missing: "${it.prompt.sentence}".`, `Cümleyi oku, hangi kelime eksik: "${it.prompt.sentence}".`, `Lee la frase para ver qué palabra falta: "${it.prompt.sentence}".`),
        L(`Try "${w}": ${it.prompt.masked.replace('___', w)}. That is not a word, so cross it out.`, `"${w}" dene: ${it.prompt.masked.replace('___', w)}. Kelime değil, çiz.`, `Prueba "${w}": ${it.prompt.masked.replace('___', w)}. No es una palabra, táchala.`),
        L(`${ans(it)[0]} makes ${it.rule.word}.`, `${ans(it)[0]} ile ${it.rule.word} olur.`, `${ans(it)[0]} forma ${it.rule.word}.`),
      ],
    }
  },
  'odd-synonym': (it) => {
    const [g0, g1] = it.rule.group
    return {
      tip: L('Four of the words mean almost the same thing. One does not.', 'Kelimelerin dördü neredeyse aynı anlamda. Biri değil.', 'Cuatro palabras significan casi lo mismo. Una no.'),
      steps: [
        L(`Start with two you are sure about: "${g0}" and "${g1}" go together.`, `Emin olduğun ikisiyle başla: "${g0}" ile "${g1}" bir arada.`, `Empieza con dos de las que estés seguro: "${g0}" y "${g1}" van juntas.`),
        L('Which of the others means the same kind of thing as those two? Four will. One means something else.', 'Diğerlerinden hangisi bu ikisiyle aynı türden? Dördü olur, biri başka bir şey demek.', '¿Cuáles de las otras significan lo mismo que esas dos? Cuatro sí. Una significa otra cosa.'),
        L(`"${ans(it)[0]}" is the odd one out.`, `"${ans(it)[0]}" ayrı duran.`, `"${ans(it)[0]}" es la que sobra.`),
      ],
    }
  },
  definition: (it) => ({
    tip: L('Read what it means, then try each option as the word being explained.', 'Anlamını oku, sonra her şıkkı açıklanan kelime gibi dene.', 'Lee lo que significa y prueba cada opción como la palabra explicada.'),
    steps: [
      L(`Is it an action, a thing, or a describing word? Cross out options of the wrong kind.`, `Bir eylem mi, bir şey mi, yoksa niteleyen bir kelime mi? Yanlış türdekileri çiz.`, `¿Es una acción, una cosa o una palabra que describe? Tacha las opciones de otro tipo.`),
      L(`The word is "${ans(it)[0]}", which has ${ans(it)[0].length} letters and starts with ${up(ans(it)[0][0])}.`, `Kelime "${ans(it)[0]}", ${ans(it)[0].length} harfli ve ${up(ans(it)[0][0])} ile başlıyor.`, `La palabra es "${ans(it)[0]}", tiene ${ans(it)[0].length} letras y empieza por ${up(ans(it)[0][0])}.`),
    ],
  }),
  // ── sounds ──
  rhyme: (it) => ({
    tip: L('Rhymes END with the same sound. Say the words out loud and listen to the ends, not the spelling.', 'Uyaklı kelimeler AYNI sesle biter. Kelimeleri yüksek sesle söyle ve yazılışa değil sonlarına kulak ver.', 'Las palabras que riman ACABAN con el mismo sonido. Dilas en voz alta y escucha el final, no la ortografía.'),
    steps: [
      L(`Say "${it.rule.of}" slowly and listen to how it ends.`, `"${it.rule.of}" kelimesini yavaş söyle ve nasıl bittiğini dinle.`, `Di "${it.rule.of}" despacio y escucha cómo acaba.`),
      L('Say each option the same way. Watch out for words that LOOK the same at the end but sound different.', 'Her şıkkı aynı şekilde söyle. Sonu AYNI GÖRÜNEN ama farklı okunan kelimelere dikkat.', 'Di cada opción igual. Cuidado con las que se VEN igual al final pero suenan distinto.'),
      L(`"${ans(it)[0]}" ends with the same sound as "${it.rule.of}".`, `"${ans(it)[0]}", "${it.rule.of}" ile aynı sesle bitiyor.`, `"${ans(it)[0]}" acaba con el mismo sonido que "${it.rule.of}".`),
    ],
  }),
  homophone: (it) => ({
    tip: L('A homophone sounds EXACTLY the same but is spelled differently and means something different.', 'Eş sesli kelime TAM aynı okunur ama farklı yazılır ve farklı anlama gelir.', 'Una palabra homófona suena EXACTAMENTE igual pero se escribe distinto y significa otra cosa.'),
    steps: [
      L(`Say "${it.rule.of}" out loud. Then say each option. A word that only rhymes is not the same sound.`, `"${it.rule.of}" kelimesini yüksek sesle söyle. Sonra şıkları söyle. Yalnızca uyaklı olan, aynı ses değildir.`, `Di "${it.rule.of}" en voz alta. Luego di cada opción. Una palabra que solo rima no suena igual.`),
      L(`"${ans(it)[0]}" sounds the same as "${it.rule.of}".`, `"${ans(it)[0]}", "${it.rule.of}" ile aynı okunuyor.`, `"${ans(it)[0]}" suena igual que "${it.rule.of}".`),
    ],
  }),
  syllables: (it) => {
    const bad = wrongOptions(it).find(o => /^syllables-\d$/.test(o.why || ''))
    const n = bad ? Number(bad.why.slice(-1)) : null
    return {
      tip: L('Clap or tap once for every beat in the word, then count the claps.', 'Kelimedeki her vuruş için bir kez el çırp, sonra çırpışları say.', 'Da una palmada por cada golpe de la palabra y cuenta las palmadas.'),
      steps: [
        ...(bad ? [L(`"${bad.text}" has ${n} beats, not ${it.rule.count}, so it is not it.`, `"${bad.text}" ${n} heceli, ${it.rule.count} değil; o değil.`, `"${bad.text}" tiene ${n} golpes, no ${it.rule.count}, así que no es.`)] : []),
        L(`Clap each of the others. You need the word with ${it.rule.count} beats.`, `Diğerlerini de çırparak say. ${it.rule.count} heceli olanı arıyorsun.`, `Da palmadas con las demás. Buscas la de ${it.rule.count} golpes.`),
        L(`"${ans(it)[0]}" has ${it.rule.count} beats.`, `"${ans(it)[0]}" ${it.rule.count} heceli.`, `"${ans(it)[0]}" tiene ${it.rule.count} golpes.`),
      ],
    }
  },
  // ── word forms ──
  plural: (it) => {
    const w = it.rule.of
    const rule = it.rule.rule
    const why = {
      ies: L(`"${w}" ends in a consonant and then y. Change the y to i and add es.`, `"${w}" ünsüz + y ile bitiyor. y'yi i yap ve es ekle.`, `"${w}" acaba en consonante + y. Cambia la y por i y añade es.`),
      es: L(`"${w}" ends in a hissing sound (s, x, z, ch, sh), so it needs es to be said.`, `"${w}" tıslama sesiyle (s, x, z, ch, sh) bitiyor, o yüzden es alır.`, `"${w}" acaba en un sonido silbante (s, x, z, ch, sh), así que lleva es.`),
      's-after-vowel': L(`"${w}" ends in a vowel and then y. The y stays, and you just add s.`, `"${w}" ünlü + y ile bitiyor. y kalır, sadece s eklenir.`, `"${w}" acaba en vocal + y. La y se queda y solo se añade s.`),
      's-after-o': L(`"${w}" ends in o, but this one only takes s (most short and borrowed o-words do).`, `"${w}" o ile bitiyor ama bu yalnız s alır (kısa ve yabancı kökenli o'lu kelimelerin çoğu öyle).`, `"${w}" acaba en o, pero esta solo lleva s (la mayoría de las palabras cortas o prestadas en o).`),
      's-after-f': L(`"${w}" ends in f (or ff, fe), but this one does not change. It only takes s.`, `"${w}" f (ya da ff, fe) ile bitiyor ama bu değişmiyor; yalnız s alır.`, `"${w}" acaba en f (o ff, fe), pero esta no cambia. Solo lleva s.`),
      irregular: /(f|fe)$/.test(w)
        ? L(`"${w}" ends in f or fe, and this kind of word often changes to ves. Not all do, so you have to know this one.`, `"${w}" f ya da fe ile bitiyor ve böyle kelimeler çoğu zaman ves alır. Hepsi değil, bunu bilmek gerekir.`, `"${w}" acaba en f o fe, y este tipo de palabra suele cambiar a ves. No todas, así que hay que conocerla.`)
        : /o$/.test(w)
          ? L(`"${w}" ends in o, and a few words like this take es instead of just s. You have to know this one.`, `"${w}" o ile bitiyor ve böyle birkaç kelime yalnız s değil es alır. Bunu bilmek gerekir.`, `"${w}" acaba en o, y unas pocas palabras así llevan es y no solo s. Hay que conocerla.`)
          : L(`"${w}" is an irregular word: it does not follow the add-s rule, so you have to know its own form.`, `"${w}" düzensiz bir kelime: s ekleme kuralına uymaz, kendi çoğulunu bilmek gerekir.`, `"${w}" es irregular: no sigue la regla de añadir s, hay que conocer su forma.`),
      latin: L(`"${w}" comes from Latin or Greek and keeps its old plural ending.`, `"${w}" Latince ya da Yunancadan geliyor ve eski çoğul ekini koruyor.`, `"${w}" viene del latín o del griego y conserva su plural antiguo.`),
    }[rule] || L(`Look at how "${w}" ends.`, `"${w}" kelimesinin sonuna bak.`, `Mira cómo acaba "${w}".`)
    return {
      tip: L('Look at the LAST letters of the word. They decide how the plural is made, and the usual "add s" is often the trap.', 'Kelimenin SON harflerine bak. Çoğulun nasıl yapılacağını onlar belirler; alışılmış "s ekle" çoğu zaman tuzaktır.', 'Mira las ÚLTIMAS letras de la palabra. Ellas deciden el plural y el habitual "añade s" suele ser la trampa.'),
      steps: [
        L(`Say "${w}" and look at how it ends.`, `"${w}" kelimesini söyle ve sonuna bak.`, `Di "${w}" y mira cómo acaba.`),
        why,
        L(`So the plural is ${ans(it)[0]}.`, `Çoğulu ${ans(it)[0]}.`, `El plural es ${ans(it)[0]}.`),
      ],
    }
  },
  'past-tense': (it) => {
    const w = it.rule.of
    const a = ans(it)[0]
    const kind = /ied$/.test(a) ? 'ied' : (a === w + w.slice(-1) + 'ed' ? 'double' : (/ed$|d$/.test(a) ? 'plain' : 'irregular'))
    const why = {
      ied: L(`"${w}" ends in a consonant and then y. Change the y to i, then add ed.`, `"${w}" ünsüz + y ile bitiyor. y'yi i yap, sonra ed ekle.`, `"${w}" acaba en consonante + y. Cambia la y por i y añade ed.`),
      double: L(`"${w}" ends in one vowel and one consonant, with the stress on its last beat, so the last letter is written twice before ed.`, `"${w}" tek ünlü + tek ünsüzle bitiyor ve vurgu son hecede; o yüzden ed'den önce son harf ikilenir.`, `"${w}" acaba en una vocal y una consonante, con el acento en el último golpe, así que la última letra se escribe dos veces antes de ed.`),
      plain: L(`"${w}" just needs ed (or d), but check the spelling of the middle carefully.`, `"${w}" için ed (ya da d) yeter, ama yazılışı dikkatle kontrol et.`, `"${w}" solo necesita ed (o d), pero revisa bien la ortografía.`),
      irregular: L(`"${w}" is an irregular verb: it does not take ed, you have to know its own past form.`, `"${w}" düzensiz bir fiil: ed almaz, kendi geçmiş biçimini bilmek gerekir.`, `"${w}" es un verbo irregular: no lleva ed, hay que saber su forma de pasado.`),
    }[kind]
    return {
      tip: L('Say "Yesterday I ..." with each option. Look at how the verb ends before adding ed, and remember some verbs do not take ed at all.', '"Yesterday I ..." cümlesini her şıkla söyle. ed eklemeden önce fiilin sonuna bak; bazı fiiller hiç ed almaz.', 'Di "Yesterday I ..." con cada opción. Mira cómo acaba el verbo antes de añadir ed, y recuerda que algunos no llevan ed.'),
      steps: [
        why,
        L(`The past tense of "${w}" is "${a}".`, `"${w}" fiilinin geçmişi "${a}".`, `El pasado de "${w}" es "${a}".`),
      ],
    }
  },
  suffix: (it) => {
    const base = it.rule.of, a = ans(it)[0], suf = it.rule.suffix
    const last = base.slice(-1), stem = base.slice(0, -1)
    const kind = a === base + suf ? 'plain'
      : a === base + last + suf ? 'double'
        : /y$/.test(base) && a === stem + 'i' + suf ? 'y-i'
          : /y$/.test(base) && a === stem + suf ? 'drop-y'
            : /e$/.test(base) && a === stem + suf ? 'drop-e'
              : 'other'
    const changes = kind !== 'plain'
    const how = {
      plain: L('Here the ending just sticks on and nothing else changes.', 'Burada ek olduğu gibi yapışıyor, başka bir şey değişmiyor.', 'Aquí la terminación simplemente se pega y nada más cambia.'),
      double: L('Here the last letter is written twice before the ending.', 'Burada son harf, ekten önce ikilenir.', 'Aquí la última letra se escribe dos veces antes de la terminación.'),
      'y-i': L('Here the y changes to i before the ending.', 'Burada y, ekten önce i olur.', 'Aquí la y cambia a i antes de la terminación.'),
      'drop-y': L('Here the y is dropped before the ending.', 'Burada y, ekten önce düşer.', 'Aquí se quita la y antes de la terminación.'),
      'drop-e': L('Here the silent e is dropped before the ending.', 'Burada sessiz e, ekten önce düşer.', 'Aquí se quita la e muda antes de la terminación.'),
      other: L(`Here the end of the word changes in its own way, so it is one to learn.`, `Burada kelimenin sonu kendine özgü şekilde değişiyor; bunu öğrenmek gerekir.`, `Aquí el final de la palabra cambia a su manera, así que hay que aprenderla.`),
    }[kind]
    return {
      tip: L('Look at how the word ends before you add the new ending. Letters can change, double or disappear.', 'Yeni eki eklemeden önce kelimenin sonuna bak. Harfler değişebilir, ikilenebilir ya da düşebilir.', 'Mira cómo acaba la palabra antes de añadir la terminación. Las letras pueden cambiar, duplicarse o desaparecer.'),
      steps: [
        L(`Write "${base}" and the ending -${suf} next to each other. What happens where they meet?`, `"${base}" ile -${suf} ekini yan yana yaz. Birleştikleri yerde ne oluyor?`, `Escribe "${base}" y la terminación -${suf} juntas. ¿Qué pasa donde se unen?`),
        changes
          ? L(`The end of "${base}" does not just stay as it is before -${suf}: cross out options that stick the ending on unchanged.`, `"${base}" kelimesinin sonu -${suf} ekinden önce olduğu gibi kalmıyor: eki değiştirmeden yapıştıran şıkları çiz.`, `El final de "${base}" no se queda igual ante -${suf}: tacha las opciones que pegan la terminación sin cambiar nada.`)
          : L(`Here nothing in "${base}" needs to change: look for the option that simply adds -${suf}.`, `Burada "${base}" kelimesinde bir şey değişmiyor: eki sadece ekleyen şıkkı ara.`, `Aquí nada de "${base}" necesita cambiar: busca la opción que solo añade -${suf}.`),
        L(`"${base}" + -${suf} = ${a}. ${how.en}`, `"${base}" + -${suf} = ${a}. ${how.tr}`, `"${base}" + -${suf} = ${a}. ${how.es}`),
      ],
    }
  },
  'prefix-antonym': (it) => ({
    tip: L('A small beginning (un-, in-, im-, il-, ir-, dis-) turns a word into its opposite. Only one goes with this word.', 'Küçük bir başlangıç (un-, in-, im-, il-, ir-, dis-) kelimeyi zıttına çevirir. Bu kelimeyle yalnız biri gider.', 'Un comienzo pequeño (un-, in-, im-, il-, ir-, dis-) vuelve la palabra su contraria. Solo uno va con esta.'),
    steps: [
      L(`"${it.rule.of}" starts with the letter ${up(it.rule.of[0])}.`, `"${it.rule.of}" ${up(it.rule.of[0])} harfiyle başlıyor.`, `"${it.rule.of}" empieza por la letra ${up(it.rule.of[0])}.`),
      L('The rule: il- goes before L, ir- before R, im- before M, B or P. With the rest it is un- (the commonest), in- or dis-, and you learn which word takes which.', 'Kural: il- L\'den önce, ir- R\'den önce, im- M, B, P\'den önce gelir. Diğerlerinde un- (en yaygını), in- ya da dis- olur; hangi kelimenin hangisini aldığı öğrenilir.', 'La regla: il- va ante L, ir- ante R, im- ante M, B o P. Con el resto es un- (la más común), in- o dis-, y se aprende qué palabra lleva cuál.'),
      L(`${ans(it)[0]}${it.rule.of} is the opposite.`, `${ans(it)[0]}${it.rule.of} zıt anlamlı.`, `${ans(it)[0]}${it.rule.of} es el opuesto.`),
    ],
  }),
  'root-word': (it) => ({
    tip: L('Take off the beginning (like un-, re-, im-) and the ending (like -ed, -ful, -ness). What is left should be a word on its own.', 'Başlangıcı (un-, re-, im- gibi) ve sonu (-ed, -ful, -ness gibi) çıkar. Kalan tek başına bir kelime olmalı.', 'Quita el comienzo (como un-, re-, im-) y el final (como -ed, -ful, -ness). Lo que queda debe ser una palabra por sí sola.'),
    steps: [
      L(`Look at "${it.rule.of}". Is there a small beginning, a small ending, or both?`, `"${it.rule.of}" kelimesine bak. Küçük bir başlangıç, küçük bir son ek ya da ikisi birden var mı?`, `Mira "${it.rule.of}". ¿Hay un comienzo pequeño, un final pequeño o los dos?`),
      L('Cross out options that cut the word in the wrong place and leave letters that are not a word.', 'Kelimeyi yanlış yerden kesip kelime olmayan harfler bırakanları çiz.', 'Tacha las que cortan la palabra en mal sitio y dejan letras que no son una palabra.'),
      L(`Taking the extra bits off "${it.rule.of}" leaves "${ans(it)[0]}".`, `"${it.rule.of}" kelimesinden fazlalıklar çıkınca "${ans(it)[0]}" kalıyor.`, `Al quitar lo extra de "${it.rule.of}" queda "${ans(it)[0]}".`),
    ],
  }),
  'missing-vowel': (it) => {
    const w = sample(it)
    return {
      tip: L('Say the word slowly and try each vowel in the gap. Only one makes a real word.', 'Kelimeyi yavaş söyle ve boşluğa her ünlüyü dene. Yalnız biri gerçek bir kelime yapar.', 'Di la palabra despacio y prueba cada vocal en el hueco. Solo una forma una palabra real.'),
      steps: [
        L(`Try "${w}": ${it.prompt.masked.replace('_', w)}. That does not look like a word.`, `"${w}" dene: ${it.prompt.masked.replace('_', w)}. Kelimeye benzemiyor.`, `Prueba "${w}": ${it.prompt.masked.replace('_', w)}. No parece una palabra.`),
        L(`With ${up(ans(it)[0])} it spells ${it.rule.word}.`, `${up(ans(it)[0])} ile ${it.rule.word} yazılıyor.`, `Con ${up(ans(it)[0])} se escribe ${it.rule.word}.`),
      ],
    }
  },
  // ── spelling & grammar ──
  apostrophe: (it) => ({
    tip: L('Who owns the thing? One owner gets \'s. Several owners that end in s only get the apostrophe after the s.', 'Şey kime ait? Tek sahip \'s alır. S ile biten birden çok sahip yalnız s\'den sonra kesme işareti alır.', '¿Quién es el dueño? Un dueño lleva \'s. Varios dueños que acaban en s solo llevan el apóstrofo después de la s.'),
    steps: [
      L(`The owner is "${it.rule.owner}". Is it one, or more than one?`, `Sahip: "${it.rule.owner}". Tek mi, birden çok mu?`, `El dueño es "${it.rule.owner}". ¿Es uno o más de uno?`),
      L(`The apostrophe goes ${it.rule.plural && it.rule.owner.endsWith('s') ? 'AFTER the s (more than one owner)' : 'BEFORE an s (one owner, or a plural without s)'}.`, `Kesme işareti ${it.rule.plural && it.rule.owner.endsWith('s') ? 's\'den SONRA (birden çok sahip)' : 's\'den ÖNCE (tek sahip ya da s\'siz çoğul)'} gelir.`, `El apóstrofo va ${it.rule.plural && it.rule.owner.endsWith('s') ? 'DESPUÉS de la s (más de un dueño)' : 'ANTES de una s (un dueño, o un plural sin s)'}.`),
      L(`The answer is ${ans(it)[0]}.`, `Cevap: ${ans(it)[0]}.`, `La respuesta es ${ans(it)[0]}.`),
    ],
  }),
  misspelt: (it) => ({
    tip: L('Four words are spelled right and one has a mistake. Read each word slowly, a few letters at a time.', 'Dört kelime doğru yazılmış, biri hatalı. Her kelimeyi yavaşça, birkaç harf birkaç harf oku.', 'Cuatro palabras están bien escritas y una tiene un error. Lee cada palabra despacio, unas pocas letras cada vez.'),
    steps: [
      L('Look for doubled letters that should not be doubled, single ones that should be double, and ie / ei.', 'Gereksiz ikilenmiş harfleri, ikilenmesi gerekirken tek kalanları ve ie / ei\'yi ara.', 'Busca letras dobles que no deben serlo, simples que deberían ser dobles y ie / ei.'),
      L(`"${ans(it)[0]}" is the mistake. It should be "${it.rule.word}".`, `"${ans(it)[0]}" hatalı. Doğrusu "${it.rule.word}".`, `"${ans(it)[0]}" es el error. Lo correcto es "${it.rule.word}".`),
    ],
  }),
  ending: (it) => {
    const set = it.options.map(o => o.text).sort().join('/')
    const pair = it.options.map(o => `-${o.text}`).join(' / ')
    const rules = {
      'cian/sion/tion': L('-tion is by far the commonest. -sion often follows l, n, r or s. -cian is for people with a skill (musician, magician).', '-tion açık farkla en yaygını. -sion çoğu zaman l, n, r ya da s\'den sonra gelir. -cian becerisi olan kişiler için (musician, magician).', '-tion es con mucho la más común. -sion suele ir tras l, n, r o s. -cian es para personas con un oficio (musician, magician).'),
      'able/ible': L('-able goes on a whole word (comfort, comfortable). -ible goes on a part that is not a word by itself (vis, visible).', '-able bütün bir kelimeye gelir (comfort, comfortable). -ible tek başına kelime olmayan bir parçaya gelir (vis, visible).', '-able va con una palabra entera (comfort, comfortable). -ible va con una parte que no es palabra sola (vis, visible).'),
      'ance/ence': L('After a hard c or g sound the ending is -ance (elegance); after a soft c or g sound it is -ence (innocence). A related word helps: elegant → elegance.', 'Sert c ya da g sesinden sonra son ek -ance (elegance); yumuşak c ya da g sesinden sonra -ence (innocence). Akraba bir kelime yardım eder: elegant → elegance.', 'Tras un sonido c o g duro, la terminación es -ance (elegance); tras c o g suave, -ence (innocence). Una palabra de la familia ayuda: elegant → elegance.'),
      'ancy/ency': L('After a hard c or g sound the ending is -ancy (vacancy); after a soft c or g sound it is -ency (emergency). A related word helps: vacant → vacancy.', 'Sert c ya da g sesinden sonra -ancy (vacancy); yumuşak c ya da g sesinden sonra -ency (emergency). Akraba kelime yardım eder: vacant → vacancy.', 'Tras c o g duro, -ancy (vacancy); tras c o g suave, -ency (emergency). Una palabra de la familia ayuda: vacant → vacancy.'),
      'ant/ent': L('After a hard c or g sound the ending is -ant (significant); after a soft c or g sound it is -ent (innocent). A related word helps: significance → significant.', 'Sert c ya da g sesinden sonra -ant (significant); yumuşak c ya da g sesinden sonra -ent (innocent). Akraba kelime yardım eder: significance → significant.', 'Tras c o g duro, -ant (significant); tras c o g suave, -ent (innocent). Una palabra de la familia ayuda: significance → significant.'),
      'ary/ery/ory': L('Nothing in the sound tells them apart. -ary is the commonest (library, necessary); -ery and -ory are words you learn (mystery, history).', 'Sesleri ayırt ettirmez. -ary en yaygını (library, necessary); -ery ve -ory ise kelime kelime öğrenilir (mystery, history).', 'El sonido no las distingue. -ary es la más común (library, necessary); -ery y -ory se aprenden palabra a palabra (mystery, history).'),
      'cial/tial': L('-cial usually comes after a vowel (special, social). -tial usually comes after a consonant (essential, partial).', '-cial çoğu zaman ünlüden sonra gelir (special, social). -tial çoğu zaman ünsüzden sonra (essential, partial).', '-cial suele ir tras vocal (special, social). -tial suele ir tras consonante (essential, partial).'),
      'sure/ture': L('-ture sounds like "cher" (picture, future). -sure sounds like "zher" (measure, pleasure).', '-ture "çır" gibi okunur (picture, future). -sure "jır" gibi okunur (measure, pleasure).', '-ture suena como "cher" (picture, future). -sure suena como "yer" (measure, pleasure).'),
    }
    const gap = it.prompt.masked.replace('___', '')
    return {
      tip: L(`These endings sound alike (${pair}), so look at the letters BEFORE the gap and remember which goes where.`, `Bu son ekler benzer okunur (${pair}); boşluktan ÖNCEKİ harflere bak ve hangisinin nerede kullanıldığını hatırla.`, `Estas terminaciones suenan parecido (${pair}), así que mira las letras ANTES del hueco y recuerda cuál va dónde.`),
      steps: [
        L(`Look at the letter before the gap in "${it.prompt.masked}": it is ${up(gap.slice(-1))}.`, `"${it.prompt.masked}" kelimesinde boşluktan önceki harf: ${up(gap.slice(-1))}.`, `Mira la letra antes del hueco en "${it.prompt.masked}": es ${up(gap.slice(-1))}.`),
        rules[set] || L('Try each ending in the gap and read the whole word.', 'Her son eki boşluğa koy ve kelimenin tamamını oku.', 'Prueba cada terminación en el hueco y lee la palabra entera.'),
        L(`The word is ${it.rule.word}.`, `Kelime ${it.rule.word}.`, `La palabra es ${it.rule.word}.`),
      ],
    }
  },
  'ie-ei': (it) => ({
    tip: L('"i before e, except after c" — but only when it sounds like "ee".', '"i, e\'den önce gelir, c\'den sonra hariç" — ama yalnız "ii" gibi okunuyorsa.', '"i antes de e, excepto después de c" — pero solo cuando suena como "i".'),
    steps: [
      L(`Look at the letter before the gap in "${it.prompt.masked}": ${up(it.prompt.masked.split('__')[0].slice(-1))}.`, `"${it.prompt.masked}" kelimesinde boşluktan önceki harf: ${up(it.prompt.masked.split('__')[0].slice(-1))}.`, `Mira la letra antes del hueco en "${it.prompt.masked}": ${up(it.prompt.masked.split('__')[0].slice(-1))}.`),
      L('After C it is EI. If the sound is "ay" (like in "neighbour") it is EI too. Otherwise it is IE. A few words just break the rule.', 'C\'den sonra EI olur. Ses "ey" gibiyse ("neighbour" gibi) yine EI. Yoksa IE. Birkaç kelime kuralı bozar.', 'Tras C es EI. Si suena "ei" (como en "neighbour") también es EI. Si no, es IE. Unas pocas palabras rompen la regla.'),
      L(`The word is ${it.rule.word}${ans(it)[0] === 'ei' && it.prompt.masked.split('__')[0].slice(-1) !== 'c' ? ' (EI without a C: say it carefully or learn it, it is one of the exceptions)' : ''}.`,
        `Kelime ${it.rule.word}${ans(it)[0] === 'ei' && it.prompt.masked.split('__')[0].slice(-1) !== 'c' ? ' (C olmadan EI: istisnalardan biri, dikkatle söyle ya da ezberle)' : ''}.`,
        `La palabra es ${it.rule.word}${ans(it)[0] === 'ei' && it.prompt.masked.split('__')[0].slice(-1) !== 'c' ? ' (EI sin C: es una de las excepciones, dila con cuidado o apréndela)' : ''}.`),
    ],
  }),
  'silent-letter': (it) => ({
    tip: L('One letter in this word makes no sound. Pairs like kn-, wr-, gn-, -mb, -mn and -stle hide one.', 'Bu kelimede bir harf ses çıkarmıyor. kn-, wr-, gn-, -mb, -mn ve -stle gibi çiftlerde biri saklanır.', 'Una letra de esta palabra no suena. Parejas como kn-, wr-, gn-, -mb, -mn y -stle esconden una.'),
    steps: [
      L(`Read "${it.prompt.masked}" aloud, skipping the gap. Which letter would you NOT say?`, `"${it.prompt.masked}" kelimesini boşluğu atlayarak yüksek sesle oku. Hangi harfi söylemezsin?`, `Lee "${it.prompt.masked}" en voz alta saltando el hueco. ¿Qué letra NO dirías?`),
      L(`The letter is ${up(ans(it)[0])}, making ${it.rule.word}.`, `Harf ${up(ans(it)[0])}, ortaya ${it.rule.word} çıkıyor.`, `La letra es ${up(ans(it)[0])}, y forma ${it.rule.word}.`),
    ],
  }),
  contraction: (it) => it.prompt.expand ? {
    tip: L('An apostrophe takes the place of missing letters. Put the missing letters back.', 'Kesme işareti eksik harflerin yerini tutar. Eksik harfleri yerine koy.', 'El apóstrofo ocupa el lugar de letras que faltan. Devuélvelas.'),
    steps: [
      L(`In "${it.prompt.word}", the apostrophe is where letters were left out. Which words could it be short for?`, `"${it.prompt.word}" içinde kesme işareti harflerin düştüğü yer. Hangi kelimelerin kısaltması olabilir?`, `En "${it.prompt.word}", el apóstrofo está donde se quitaron letras. ¿De qué palabras es la forma corta?`),
      L(`"${it.prompt.word}" is short for "${ans(it)[0]}".`, `"${it.prompt.word}", "${ans(it)[0]}" kısaltması.`, `"${it.prompt.word}" es la forma corta de "${ans(it)[0]}".`),
    ],
  } : {
    tip: L('Join the two words into one. The apostrophe goes exactly where letters disappear.', 'İki kelimeyi birleştir. Kesme işareti tam harflerin düştüğü yere gelir.', 'Une las dos palabras en una. El apóstrofo va justo donde desaparecen las letras.'),
    steps: [
      L(`Write "${it.prompt.word}" as one word. Which letters have to go?`, `"${it.prompt.word}" ifadesini tek kelime yap. Hangi harfler düşüyor?`, `Escribe "${it.prompt.word}" como una palabra. ¿Qué letras se quitan?`),
      L(`The apostrophe goes where they were: ${ans(it)[0]}.`, `Kesme işareti onların yerine gelir: ${ans(it)[0]}.`, `El apóstrofo va donde estaban: ${ans(it)[0]}.`),
    ],
  },
  'homophone-cloze': (it) => ({
    tip: L('The options sound the same, so spelling is not enough. The meaning of the sentence decides.', 'Şıklar aynı okunuyor, yani yazım yetmez. Cümlenin anlamı belirler.', 'Las opciones suenan igual, así que no basta con la ortografía. Decide el sentido de la frase.'),
    steps: [
      L(`Read the sentence with each option: "${it.prompt.sentence.replace('___', '___')}".`, `Cümleyi her şıkla oku: "${it.prompt.sentence}".`, `Lee la frase con cada opción: "${it.prompt.sentence}".`),
      L('These words sound the same but mean different things. Which meaning does this sentence need?', 'Bu kelimeler aynı okunur ama farklı anlamlara gelir. Bu cümle hangi anlamı istiyor?', 'Estas palabras suenan igual pero significan cosas distintas. ¿Qué significado necesita esta frase?'),
      L(`"${ans(it)[0]}" is the one that fits.`, `Uyan şık "${ans(it)[0]}".`, `La que encaja es "${ans(it)[0]}".`),
    ],
  }),
  'grammar-cloze': (it) => ({
    tip: L('Say the whole sentence with each option and listen. The one that sounds like proper English wins.', 'Cümlenin tamamını her şıkla söyle ve dinle. Doğru İngilizce gibi duyulan kazanır.', 'Di la frase entera con cada opción y escucha. Gana la que suena como inglés correcto.'),
    steps: [
      L('Check who or what the sentence is about, and whether it is one or many, now or in the past.', 'Cümlenin kim ya da ne hakkında olduğuna, tek mi çok mu olduğuna, şimdi mi geçmiş mi olduğuna bak.', 'Mira de quién o de qué habla la frase, si es uno o varios y si es presente o pasado.'),
      L(`"${ans(it)[0]}" is the one that fits.`, `Uyan şık "${ans(it)[0]}".`, `La que encaja es "${ans(it)[0]}".`),
    ],
  }),
  comparative: (it) => {
    const two = it.rule.than
    return {
      tip: two
        ? L('Comparing TWO things: add -er or use "more". Never both.', 'İKİ şeyi karşılaştırırken: -er ekle ya da "more" kullan. İkisini birden değil.', 'Al comparar DOS cosas: añade -er o usa "more". Nunca las dos.')
        : L('Comparing ALL of them (the top one): add -est or use "most". Never both.', 'HEPSİNİ karşılaştırırken (en üstteki): -est ekle ya da "most" kullan. İkisini birden değil.', 'Al comparar TODOS (el primero): añade -est o usa "most". Nunca las dos.'),
      steps: [
        L(`The sentence is about ${two ? 'two things' : 'a whole group'}, so you need the ${two ? '-er / more' : '-est / most'} form of "${it.prompt.word}".`, `Cümle ${two ? 'iki şey' : 'bütün bir grup'} hakkında, o yüzden "${it.prompt.word}" için ${two ? '-er / more' : '-est / most'} biçimi gerekir.`, `La frase trata de ${two ? 'dos cosas' : 'todo un grupo'}, así que hace falta la forma ${two ? '-er / more' : '-est / most'} de "${it.prompt.word}".`),
        L('Some words are irregular (good, bad, little) and have their own forms. Cross out any option that uses two comparing words at once.', 'Bazı kelimeler düzensiz (good, bad, little) ve kendi biçimleri var. İki karşılaştırma kelimesini birden kullananı çiz.', 'Algunas son irregulares (good, bad, little) y tienen su propia forma. Tacha la que use dos palabras comparativas a la vez.'),
        L(`The answer is ${ans(it)[0]}.`, `Cevap ${ans(it)[0]}.`, `La respuesta es ${ans(it)[0]}.`),
      ],
    }
  },
  singular: (it) => ({
    tip: L('Take the plural ending off. What is left must be a real word, and you must not cut too much or too little.', 'Çoğul ekini çıkar. Kalan gerçek bir kelime olmalı; ne fazla ne az kesmelisin.', 'Quita la terminación del plural. Lo que queda debe ser una palabra real, y no debes cortar de más ni de menos.'),
    steps: [
      L(`Look at the ending of "${it.rule.of}": is it -s, -es, -ies, -ves, or something else?`, `"${it.rule.of}" kelimesinin sonuna bak: -s, -es, -ies, -ves ya da başka bir şey mi?`, `Mira el final de "${it.rule.of}": ¿es -s, -es, -ies, -ves u otra cosa?`),
      L(`The single word is "${ans(it)[0]}".`, `Tekil: "${ans(it)[0]}".`, `El singular es "${ans(it)[0]}".`),
    ],
  }),
  gender: (it) => ({
    tip: L('Some pairs just add -ess (lion, lioness). Many are completely different words (bull, cow).', 'Bazı çiftler sadece -ess alır (lion, lioness). Çoğu tamamen farklı kelimedir (bull, cow).', 'Algunas parejas solo añaden -ess (lion, lioness). Muchas son palabras totalmente distintas (bull, cow).'),
    steps: [
      L(`Think of "${it.rule.of}" and the word for the other sex in the pair.`, `"${it.rule.of}" kelimesini ve çiftin diğer cinsiyetteki karşılığını düşün.`, `Piensa en "${it.rule.of}" y en la palabra del otro sexo de la pareja.`),
      L(`The partner of "${it.rule.of}" is "${ans(it)[0]}".`, `"${it.rule.of}" kelimesinin eşi "${ans(it)[0]}".`, `La pareja de "${it.rule.of}" es "${ans(it)[0]}".`),
    ],
  }),
  collective: (it) => ({
    tip: L('A group has its own name: a swarm of bees, a pod of whales. Each group name goes with certain things.', 'Her grubun kendi adı var: bir arı kümesi, bir balina sürüsü. Her grup adı belli şeylerle gider.', 'Cada grupo tiene su nombre: un enjambre de abejas, un grupo de ballenas. Cada nombre va con ciertas cosas.'),
    steps: [
      L(`Say "a ___ of ${it.rule.of}" with each option. Which one have you heard? Cross out ones you know belong to something else.`, `"a ___ of ${it.rule.of}" cümlesini her şıkla söyle. Hangisini duydun? Başka şeye ait olduğunu bildiklerini çiz.`, `Di "a ___ of ${it.rule.of}" con cada opción. ¿Cuál has oído? Tacha las que sabes que son de otra cosa.`),
      L(`The group of ${it.rule.of} is a ${ans(it)[0]}.`, `${it.rule.of} grubunun adı: ${ans(it)[0]}.`, `El grupo de ${it.rule.of} es ${ans(it)[0]}.`),
    ],
  }),
  proverb: (it) => ({
    tip: L('This is a saying people use. Several options make sense, but only one is the words the saying really uses.', 'Bu, insanların kullandığı bir söz. Birçok şık anlamlı olur ama sözün gerçek kelimesi yalnız biri.', 'Es un refrán que se usa. Varias opciones tienen sentido, pero solo una es la palabra del refrán.'),
    steps: [
      L(`Read the whole saying with each option: "${it.prompt.sentence}".`, `Sözü her şıkla baştan sona oku: "${it.prompt.sentence}".`, `Lee el refrán entero con cada opción: "${it.prompt.sentence}".`),
      L(`Which one have you heard before? It is "${ans(it)[0]}".`, `Hangisini daha önce duydun? "${ans(it)[0]}".`, `¿Cuál has oído antes? Es "${ans(it)[0]}".`),
    ],
  }),
}

// ── public ──────────────────────────────────────────────────────────────────────────────────

const GENERIC = {
  tip: L('Read the question again slowly and cross out the options you are sure about.', 'Soruyu yavaşça yeniden oku ve emin olduğun şıkları çiz.', 'Lee la pregunta otra vez despacio y tacha las opciones de las que estés seguro.'),
  steps: [L('Cross out the options that do not fit. Which ones are left?', 'Uymayan şıkları çiz. Hangileri kaldı?', 'Tacha las opciones que no encajan. ¿Cuáles quedan?')],
}

// The engine spells what a question PRINTS for the child's variety (colour/color) but keeps the lexicon's
// spelling in `rule`; help that quoted `rule.of` printed a word the child never saw ("medalist" under
// "medallist"). Every word in the rule is put through the same spelling before the text is built.
const RULE_KEEP = new Set(['kind', 'relation', 'pattern', 'rule', 'key', 'variety'])
function spelled(item) {
  const sp = (v) => (typeof v === 'string' ? spell(v, item.variety) : Array.isArray(v) ? v.map(sp) : v)
  const rule = {}
  for (const [k, v] of Object.entries(item.rule || {})) rule[k] = RULE_KEEP.has(k) ? v : sp(v)
  return { ...item, rule }
}

function build(item) {
  const make = HELP[item.type]
  try { return make ? make(spelled(item)) : GENERIC } catch { return GENERIC }
}

const pickLang = (l, lang) => l[lang] ?? l.en

/**
 * The hint at a rung. level 1: { tip }. level 2: { eliminate, why } — an option to cross out
 * and the key of the reason (null when no wrong option is left). level 3: { steps } — every
 * step except the one that states the answer. Never contains a right option's text, except
 * where a worked step has to name a word the question itself printed.
 */
export function hintAt(item, level, lang = 'en', { eliminated = [], chosen = [] } = {}) {
  const h = build(item)
  if (level <= 1) return { level: 1, text: pickLang(h.tip, lang) }
  if (level === 2) {
    const left = wrongOptions(item).filter(o => !eliminated.includes(o.i) && !chosen.includes(o.i))
    const o = left[0]
    return o ? { level: 2, eliminate: o.i, why: o.why || null } : { level: 2, eliminate: null, why: null }
  }
  const steps = h.steps.slice(0, Math.max(1, h.steps.length - 1)).map(s => pickLang(s, lang))
  return { level: 3, steps }
}

/** The full explanation, answer included, shown once the question is settled. */
export function explanation(item, lang = 'en') {
  return build(item).steps.map(s => pickLang(s, lang))
}

/** Every rung of one item, for the audit: text of each language, for the leak and coverage checks. */
export function allHelp(item) {
  const make = HELP[item.type]
  if (!make) throw new Error(`no help written for ${item.type}`)
  const h = make(spelled(item))
  return { tip: h.tip, steps: h.steps }
}

export const HELP_TYPES = Object.keys(HELP)
