// Level specs and review rubrics for reading passages. One place for the numbers the generator is
// told AND the gate enforces, so the two cannot drift. Levels follow docs/ENGLISH-SKILL-LADDERS.md E.

export const LEVELS = {
  // E2 and E4 are PROVISIONAL (2026-10-17): written to check Codex/Astra's 15-story draft, not decided.
  // E2 borrows E3's word rule; E4 keeps Starters–Flyers with up to 3 words outside every list.
  E2: {
    words: [30, 55], sentences: [3, 5], maxSentenceWords: 15,
    vocab: ['starters', 'movers'], base: true, contentAllowed: 2,
    ops: ['detail', 'detail', 'sequence'],
    options: 3,
    describe: 'three to five short sentences; explicit details and the order of events',
  },
  // E3 vocabulary (product decision 2026-10-17): Cambridge Starters + Movers, plus BASE_WORDS (everyday
  // words of telling: place, time and basic verbs); any other word, at any level or none, is a content
  // word, and a passage may have at most 2 of them, counted by headword over title, text and questions.
  E3: {
    words: [55, 100], sentences: [6, 9], maxSentenceWords: 14,
    vocab: ['starters', 'movers'], base: true, contentAllowed: 2,
    ops: ['detail', 'cause', 'cause'],             // one explicit detail, two explicit cause–effect
    options: 3,
    describe: 'six to nine short sentences; explicit cause and effect; no hidden meaning needed',
  },
  E4: {
    words: [120, 200], sentences: [9, 18], maxSentenceWords: 18,
    vocab: ['starters', 'movers', 'flyers'], flyersAllowed: 99, outsideAllowed: 3,
    ops: ['detail', 'inference', 'main-idea'],               // provisional, matching the 15-story draft
    options: 3,
    describe: '120–200 words; a main idea and one simple inference from clues in the text',
  },
}

// Everyday words of telling that the Cambridge lists put at Flyers (or leave out: `beside`), and without
// which a story reads like a list. Not content: they do not add reading load the way soil or hero does.
// `lie` is left out on purpose (it is also "not true").
export const BASE_WORDS = [
  'same', 'other', 'each', 'beside', 'across', 'through', 'over', 'together', 'somewhere', 'soon', 'later',
  'still', 'usually', 'already', 'until',
  'keep', 'feel', 'stay', 'hear', 'follow', 'guess', 'leave', 'turn', 'hope', 'let',
]

export const OPS = {
  detail: 'an explicit detail stated in one sentence of the text',
  cause: 'why something happened; the reason is stated in the text (because / so / that is why), not guessed',
  sequence: 'which of two events happened first, both stated in the text',
  'main-idea': 'what the whole text is mostly about',
  inference: 'a simple conclusion from two clues in the text; never stated in one sentence',
  'word-in-context': 'what a word means in this text, shown by the sentence around it',
}

// Content the module never carries. Each category is a yes/no for the safety reviewer, with a quote.
// Holidays count as religion (decision 2026-09-20: religion out entirely, symmetric).
export const SAFETY = {
  religion: 'any religion, god, prayer, church/mosque/temple, religious holiday or festival (Christmas, Easter, Eid, Diwali, Hanukkah, Halloween, Thanksgiving), angels, heaven, devils',
  'race-ethnicity': 'skin colour, race, ethnicity, nationality or accent used to describe or contrast people; any stereotype about a group',
  'romance-sexuality': 'crushes, dating, kissing, boyfriend/girlfriend, marriage proposals, bodies in a sexual way',
  'death-grief': 'death or dying of a person or pet, funerals, grief, serious illness, hospitals for serious reasons',
  'self-harm': 'suicide, self-harm, wanting to disappear or not exist, hurting oneself on purpose, starving oneself',
  violence: 'fighting, hitting, weapons (guns, knives as weapons), war, bullying shown approvingly, blood',
  fear: 'horror, monsters meant to frighten, being lost alone at night, kidnapping, strangers taking children',
  substances: 'alcohol, smoking, vaping, drugs, medicine taken by a child without an adult',
  'copyable-danger': 'something a child could copy at home that is dangerous: fire, matches, cooking with heat or sharp knives alone, climbing high, going off with strangers, playing near roads or water alone',
  'body-image': 'weight, dieting, appearance as good/bad, teasing about bodies',
  'politics-news': 'politics, elections, governments, protests, money trouble, crime, courts, news events',
  'brands-real-people': 'brand names, products, companies, celebrities, real living people',
  'family-assumption': 'presents one family shape as normal (e.g. every child has a mum and a dad); single named carers are fine',
  'regional-variety': 'words, spellings or facts that differ between UK and US English (mum/mom, colour/color, football/soccer, money, school year names)',
  'false-fact': 'in an information text: any statement that is not true, or true only with an exception the text hides',
}
