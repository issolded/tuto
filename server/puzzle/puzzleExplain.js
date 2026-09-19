// One sentence saying why the answer is the answer, built from the rule the question was made
// on. Shown to a child after a wrong answer — on the flash and in the review at the end — so the
// mistake comes with the thing they missed rather than just the right picture.
//
// It is built on the server and sent only in the reply to an answer: the rule IS the answer key,
// and the browser is never given it before the child has committed (see publicQuestion).
//
// Written for a child reading it, not for the engine: attributes are named the way a child
// would point at them ("which way it points", "how many dots"), and Turkish is written so no
// suffix has to agree with a word chosen at run time. Spanish carries its article in the table and
// avoids adjectives that would have to agree with it ("es diferente", never "distinta").

const ATTR = {
  tr: {
    shape: 'şekli', fill: 'içinin deseni', rotation: 'yönü', size: 'büyüklüğü', stretch: 'genişliği',
    half: 'boyalı yarısı', dots: 'nokta sayısı', corner: 'köşedeki işareti', inner: 'içindeki şekil',
    position: 'dolu küçük dairesinin yeri', flip: 'baktığı yön',
  },
  en: {
    shape: 'shape', fill: 'shading', rotation: 'direction', size: 'size', stretch: 'width',
    half: 'shaded half', dots: 'number of dots', corner: 'corner mark', inner: 'shape inside',
    position: 'filled little circle', flip: 'way it faces',
  },
  es: {
    shape: 'la forma', fill: 'el relleno', rotation: 'la dirección', size: 'el tamaño', stretch: 'la anchura',
    half: 'la mitad pintada', dots: 'el número de puntos', corner: 'la marca de la esquina', inner: 'la figura de dentro',
    position: 'el sitio del circulito relleno', flip: 'el lado al que mira',
  },
}

// The same, standing alone — "the shape changes" rather than "its shape". Turkish needs both:
// "Hepsinin yönü aynı" but "Bir yönde şekil, öbür yönde desen değişiyor". English does not.
const NOM = {
  tr: {
    shape: 'şekil', fill: 'desen', rotation: 'yön', size: 'büyüklük', stretch: 'genişlik',
    half: 'boyalı yarı', dots: 'nokta sayısı', corner: 'köşedeki işaret', inner: 'içteki şekil',
    position: 'dolu küçük dairenin yeri', flip: 'yön',
  },
}
NOM.en = ATTR.en
NOM.es = ATTR.es

// What a group of pictures IS, as the end of "they are all …" and "this one is …".
const GROUP = {
  tr: {
    fruit: ['meyve', 'bir meyve'], vehicle: ['taşıt', 'bir taşıt'], animal: ['memeli hayvan', 'bir memeli hayvan'],
    bug: ['böcek', 'bir böcek'], weather: ['hava olayı', 'bir hava olayı'], plant: ['bitki', 'bir bitki'],
    tool: ['kırtasiye malzemesi', 'bir kırtasiye malzemesi'], music: ['müzikle ilgili', 'müzikle ilgili'],
    food: ['yiyecek ya da içecek', 'bir yiyecek ya da içecek'], home: ['evde kullandığımız eşya', 'bir ev eşyası'],
    sport: ['spor malzemesi', 'bir spor malzemesi'], symbol: ['işaret', 'bir işaret'],
  },
  en: {
    fruit: ['fruit', 'a fruit'], vehicle: ['vehicles', 'a vehicle'], animal: ['mammals', 'a mammal'],
    bug: ['bugs', 'a bug'], weather: ['weather', 'weather'], plant: ['plants', 'a plant'],
    tool: ['desk things', 'a desk thing'], music: ['to do with music', 'to do with music'],
    food: ['food or drink', 'food or drink'], home: ['things at home', 'a thing at home'],
    sport: ['sport things', 'a sport thing'], symbol: ['symbols', 'a symbol'],
  },
  es: {
    fruit: ['fruta', 'una fruta'], vehicle: ['vehículos', 'un vehículo'], animal: ['mamíferos', 'un mamífero'],
    bug: ['bichos', 'un bicho'], weather: ['cosas del tiempo', 'algo del tiempo'], plant: ['plantas', 'una planta'],
    tool: ['cosas del cole', 'una cosa del cole'], music: ['cosas de música', 'algo de música'],
    food: ['comida o bebida', 'comida o bebida'], home: ['cosas de casa', 'una cosa de casa'],
    sport: ['cosas de deporte', 'una cosa de deporte'], symbol: ['símbolos', 'un símbolo'],
  },
}
const RELATION = {
  tr: {
    produces: 'İlk resim ikincisini verir. Doğru cevap da üçüncü resmin verdiği şey.',
    becomes: 'İlk resim zamanla ikincisine dönüşür. Doğru cevap da üçüncü resmin dönüştüğü şey.',
    protects: 'İkinci resim bizi ilkinden korur. Doğru cevap da bizi üçüncüsünden koruyan şey.',
    lives_in: 'İlk resimdeki canlı ikinci resimdeki yerde yaşar. Doğru cevap da üçüncüsünün yaşadığı yer.',
  },
  en: {
    produces: 'The first picture gives us the second. The answer is what the third one gives us.',
    becomes: 'The first picture turns into the second. The answer is what the third one turns into.',
    protects: 'The second picture protects us from the first. The answer is what protects us from the third.',
    lives_in: 'The first one lives in the place in the second picture. The answer is where the third one lives.',
  },
  es: {
    produces: 'La primera imagen nos da la segunda. La respuesta es lo que nos da la tercera.',
    becomes: 'La primera imagen se convierte en la segunda. La respuesta es aquello en lo que se convierte la tercera.',
    protects: 'La segunda imagen nos protege de la primera. La respuesta es lo que nos protege de la tercera.',
    lives_in: 'El primero vive en el sitio de la segunda imagen. La respuesta es donde vive el tercero.',
  },
}

const TRAIT = {
  tr: {
    flies: ['Yalnızca bu uçabiliyor, diğerleri uçamıyor.', 'Diğerlerinin hepsi uçabiliyor, bu uçamıyor.'],
    wings: ['Yalnızca bunun kanatları var.', 'Diğerlerinin hepsinin kanatları var, bunun yok.'],
  },
  en: {
    flies: ['Only this one can fly; the others cannot.', 'All the others can fly; this one cannot.'],
    wings: ['Only this one has wings.', 'All the others have wings; this one does not.'],
  },
  es: {
    flies: ['Solo este puede volar; los demás no.', 'Todos los demás pueden volar; este no.'],
    wings: ['Solo este tiene alas.', 'Todos los demás tienen alas; este no.'],
  },
}

const list = (names, lang) => (names.length < 2 ? names[0]
  : `${names.slice(0, -1).join(', ')} ${{ tr: 've', es: 'y' }[lang] || 'and'} ${names[names.length - 1]}`)

export function explainQuestion(q, lang = 'en') {
  const L = ['tr', 'es'].includes(lang) ? lang : 'en'
  const tr = L === 'tr'
  const es = L === 'es'
  // Picks the sentence for the language: P(english, turkish, spanish).
  const P = (en, trS, esS) => (tr ? trS : es ? esS : en)
  const attr = String(q.rule?.attr ?? '')
  const parts = attr.replace(/^code:/, '').split('+')
  const names = parts.map(a => ATTR[L][a]).filter(Boolean)
  // "the shape inside and the shape" — when both move, the outer one is named as the outer one.
  const nom = parts.map(a => (tr && a === 'shape' && parts.includes('inner') ? 'dıştaki şekil' : NOM[L][a])).filter(Boolean)
  const A = names[0]
  const cap = (x) => x.charAt(0).toLocaleUpperCase(L) + x.slice(1)

  switch (q.type) {
    case 'odd-one-out':
      if (!A) break
      return P(`They all have the same ${A} — only this one's is different.`, `Hepsinin ${A} aynı, yalnızca bunun ${A} farklı.`,
        `En todos ${A} es igual; solo en este es diferente.`)
    case 'belongs':
      if (!A) break
      return P(`The ones above all have the same ${A}, and the answer is the only option that does too.`,
        `Üsttekilerin hepsinin ${A} aynı. Doğru cevap da bu özelliği taşıyan tek seçenek.`,
        `En los de arriba ${A} es igual, y la respuesta es la única opción donde también lo es.`)
    case 'identical':
      return P('The answer is exactly the same as the shape above. Each of the others has one small difference.',
        'Doğru cevap üstteki şeklin tıpatıp aynısı. Diğerlerinin her birinde küçük bir fark var.',
        'La respuesta es exactamente igual que la figura de arriba. Cada una de las otras tiene una pequeña diferencia.')
    case 'sequence': {
      const step = q.rule?.step
      if (step !== undefined && q.rule.attr === 'dots') {
        if (step > 0) {
          return P(`One more dot each time, so ${q.rule.to} dots come next.`, `Her adımda bir nokta artıyor, sırada ${q.rule.to} noktalı şekil var.`,
            `Cada vez hay un punto más, así que ahora tocan ${q.rule.to} puntos.`)
        }
        return P('One dot fewer each time, so no dots come next.', 'Her adımda bir nokta azalıyor, sırada hiç noktası olmayan şekil var.',
          'Cada vez hay un punto menos, así que ahora toca una figura sin puntos.')
      }
      if (step !== undefined && q.rule.attr === 'rotation') {
        const cw = step > 0
        return P(`The shape turns a little further ${cw ? 'clockwise' : 'anticlockwise'} each time.`,
          `Şekil her adımda ${cw ? 'saat yönünde' : 'saatin tersine'} biraz daha dönüyor.`,
          `La figura gira un poco más cada vez, ${cw ? 'en el sentido de las agujas del reloj' : 'al revés que las agujas del reloj'}.`)
      }
      if (!A) break
      if (nom[1]) {
        return P(`The ${A} changes in order and repeats. At the same time the ${names[1]} switches back and forth.`,
          `${cap(nom[0])} sırayla değişip tekrar ediyor. Bir yandan da ${nom[1]} bir değişip bir geri dönüyor.`,
          `${cap(nom[0])} cambia en orden y se repite. A la vez, ${nom[1]} va y vuelve una y otra vez.`)
      }
      return P(`The ${A} changes in order, and the order repeats.`, `${cap(nom[0])} sırayla değişiyor ve aynı sırayla tekrar ediyor.`,
        `${cap(nom[0])} cambia en orden, y el orden se repite.`)
    }
    case 'grid-complete':
      if (nom.length < 2) break
      return P(`One way the ${names[0]} changes, the other way the ${names[1]}. The empty box has to fit both.`,
        `Bir yönde ${nom[0]}, öbür yönde ${nom[1]} değişiyor. Boş kutu ikisine birden uymalı.`,
        `En un sentido cambia ${nom[0]}; en el otro, ${nom[1]}. La casilla vacía tiene que encajar con los dos.`)
    case 'analogy':
      if (!A) break
      return P(`From the first shape to the second, the ${list(names, L)} changes. Make the same change to the third and you get the answer.`,
        `İlk şekilden ikincisine ${list(nom, L)} değişiyor. Üçüncü şekle aynı değişikliği yapınca doğru cevap çıkıyor.`,
        `De la primera figura a la segunda ${nom.length > 1 ? 'cambian' : 'cambia'} ${list(nom, L)}. Haz el mismo cambio en la tercera y tendrás la respuesta.`)
    case 'reflection':
      return P('In a mirror a shape flips: everything on the right moves to the left, and the left to the right.',
        'Aynada şekil ters döner: sağdaki her şey sola, soldaki her şey sağa geçer.',
        'En un espejo la figura se da la vuelta: lo de la derecha pasa a la izquierda, y lo de la izquierda, a la derecha.')
    case 'symmetry':
      return q.rule?.to
        ? P('This is the only shape whose two halves match when you fold it down the middle.',
          'Ortadan ikiye katlayınca iki yarısı tam üst üste gelen tek şekil bu.',
          'Es la única figura cuyas dos mitades coinciden al doblarla por la mitad.')
        : P('All the others fold into two matching halves; this one does not.',
          'Diğerlerinin hepsi ortadan katlanınca iki yarısı üst üste geliyor, bunda gelmiyor.',
          'Todas las demás se doblan en dos mitades iguales; esta no.')
    case 'code': {
      const [a, b] = nom
      if (!a || !b) break
      return P(`One letter is for the ${a}, the other for the ${b}. Check both on the shape with the question mark.`,
        `Harflerden biri ${a} için, öbürü ${b} için. Soru işaretli şekle ikisini de bakarak seç.`,
        `Una letra es para ${a} y la otra para ${b}. Fíjate en las dos en la figura del signo de interrogación.`)
    }
    case 'glyph-odd':
    case 'icon-odd': {
      const inG = GROUP[L][q.rule?.from], outG = GROUP[L][q.rule?.to]
      if (!inG || !outG) break
      return P(`All the others are ${inG[0]}; this one is ${outG[1]}.`, `Diğerlerinin hepsi ${inG[0]}, bu ise ${outG[1]}.`,
        `Todos los demás son ${inG[0]}; este es ${outG[1]}.`)
    }
    case 'glyph-belongs':
    case 'icon-belongs': {
      const inG = GROUP[L][q.rule?.from]
      if (!inG) break
      return P(`The ones above are all ${inG[0]}, and the answer is the only option that is too.`,
        `Üsttekilerin hepsi ${inG[0]}. Seçeneklerden ${inG[0]} olan tek şey doğru cevap.`,
        `Los de arriba son todos ${inG[0]}, y la respuesta es la única opción que también lo es.`)
    }
    case 'glyph-trait': {
      const t = TRAIT[L][attr.replace(/^trait:/, '')]
      if (!t) break
      return q.rule?.to ? t[0] : t[1]
    }
    case 'glyph-analogy': {
      const s = RELATION[L][attr.replace(/^relation:/, '')]
      if (s) return s
      break
    }
    case 'glyph-sequence':
      return P('The pictures repeat in the same order.', 'Resimler hep aynı sırayla tekrar ediyor.', 'Los dibujos se repiten siempre en el mismo orden.')
    case 'icon-sequence':
      if (attr === 'fill') return P('The picture goes filled, empty, filled, empty.', 'Resim bir dolu, bir boş gidiyor.', 'El dibujo va lleno, vacío, lleno, vacío.')
      if (attr === 'icon+fill') {
        return P('The pictures repeat in order, and they also go filled, empty, filled, empty.',
          'Resimler aynı sırayla tekrar ediyor, bir yandan da bir dolu bir boş gidiyor.',
          'Los dibujos se repiten en orden y, además, van lleno, vacío, lleno, vacío.')
      }
      return P('The pictures repeat in the same order.', 'Resimler aynı sırayla tekrar ediyor.', 'Los dibujos se repiten en el mismo orden.')
    default:
  }
  return null
}
