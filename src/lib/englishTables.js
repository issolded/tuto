// Hand-written tables for the English engine — the questions a lexicon cannot answer.
//
// Everything in englishLexicon.generated.js is derived from WordNet and two pronunciation
// dictionaries. What is here is the other kind of knowledge: that a young sheep is a LAMB, that
// the feminine of `duke` is `duchess`, that a group of lions is a PRIDE, that `could've` is not
// `could of`. None of that is in WordNet in a form a generator can use, and all of it is small,
// closed and settled — the same forty facts every Bond book asks. So it is written down.
//
// Sources: Bond Verbal Reasoning Assessment Papers 7-8 (J M Bond) for the analogy relations and
// the logic scenes; Bond English Assessment Papers 10-11 Book 1 and Bond 11+ English
// Multiple-choice Test Papers Pack 2 (Sarah Lindsay) for everything else. Each table says which
// question uses it. Where the book gives an item, it is here; the rest are its neighbours, the
// same kind of fact at the same level.
//
// British English throughout, like the books. Words whose SPELLING differs by variety are left
// out of every table (`colour`, `programme`, `sombre`, `miaow`), because a table cannot carry
// two spellings the way the lexicon does and a child in either country must not be marked on it.

// ── analogies (VR 7-8) ────────────────────────────────────────────────────────────────────
// "Cat is to kitten as dog is to (poodle, puppy, dog)." Each relation maps a word to the SET of
// answers the book would accept, so a distractor can be checked against all of them — a lion's
// young and a bear's young are both `cub`, and `cub` must never be a wrong answer for either.
export const RELATIONS = {
  young: {
    cat: ['kitten'], dog: ['puppy'], sheep: ['lamb'], cow: ['calf'], horse: ['foal'],
    frog: ['tadpole'], duck: ['duckling'], hen: ['chick'], goat: ['kid'], pig: ['piglet'],
    bear: ['cub'], lion: ['cub'], fox: ['cub'], swan: ['cygnet'], owl: ['owlet'],
    goose: ['gosling'], deer: ['fawn'], kangaroo: ['joey'], butterfly: ['caterpillar'],
  },
  sound: {
    dog: ['bark'], cow: ['moo'], sheep: ['baa'], horse: ['neigh'], pig: ['grunt', 'oink'],
    duck: ['quack'], frog: ['croak'], hen: ['cluck'], lion: ['roar'], owl: ['hoot'],
    mouse: ['squeak'], snake: ['hiss'], bee: ['buzz'], donkey: ['bray'], wolf: ['howl'],
  },
  home: {
    bird: ['nest'], bee: ['hive'], dog: ['kennel'], horse: ['stable'], rabbit: ['burrow'],
    pig: ['sty'], spider: ['web'], car: ['garage'], fish: ['pond', 'sea', 'river'],
  },
  colour: {
    grass: ['green'], snow: ['white'], sky: ['blue'], coal: ['black'],
    banana: ['yellow'], lemon: ['yellow'], milk: ['white'], leaf: ['green'], cherry: ['red'],
  },
  opposite: {
    hot: ['cold'], big: ['little', 'small'], up: ['down'], open: ['shut', 'closed'],
    wet: ['dry'], fast: ['slow'], happy: ['sad'], day: ['night'], black: ['white'],
    full: ['empty'], early: ['late'], first: ['last'], top: ['bottom'], cheap: ['expensive'],
    high: ['low'], strong: ['weak'], hard: ['soft'], old: ['new', 'young'], thick: ['thin'],
    loud: ['quiet'], tall: ['short'], light: ['dark', 'heavy'], near: ['far'], wide: ['narrow'],
    go: ['come', 'stop'], in: ['out'], win: ['lose'], give: ['take'], buy: ['sell'],
  },
  female: {
    king: ['queen'], man: ['woman'], boy: ['girl'], prince: ['princess'], uncle: ['aunt'],
    son: ['daughter'], brother: ['sister'], father: ['mother'], husband: ['wife'],
    nephew: ['niece'], grandfather: ['grandmother'], bull: ['cow'], ram: ['ewe'],
    stallion: ['mare'], gander: ['goose'], drake: ['duck'], cockerel: ['hen'],
  },
  foot: {
    horse: ['hoof'], cat: ['paw'], dog: ['paw'], bird: ['claw'], person: ['foot'],
  },
  travels: {
    car: ['road'], train: ['rails', 'track'], boat: ['water', 'sea'], plane: ['sky', 'air'],
    bike: ['road', 'path'], ship: ['sea', 'water'],
  },
}

// The words each relation is phrased with, so a question never has to be read off the keys.
export const RELATION_NAMES = {
  young: 'young', sound: 'sound', home: 'home', colour: 'colour', opposite: 'opposite',
  female: 'female', foot: 'foot', travels: 'travels on',
}

// Bare synonym pairs for questions that provide no sentence. WordNet records every sense of a
// word, so pairs such as `home / plate` (home plate) and `have / throw` (have/throw a party) are
// related in a particular construction but are not synonyms on the page. These pairs are the
// deliberately small, ordinary-vocabulary bank used by pair-meaning and the youngest synonym
// questions.
export const PAIR_SYNONYMS = [
  ['rent', 'hire'], ['friend', 'mate'], ['midday', 'noon'], ['pips', 'seeds'],
  ['vehicle', 'car'], ['groceries', 'food'], ['instruct', 'teach'], ['graze', 'scratch'],
  ['brook', 'stream'], ['seashore', 'coast'], ['quarrel', 'fight'], ['shut', 'close'],
  ['large', 'big'], ['tiny', 'small'], ['angry', 'cross'], ['quick', 'fast'],
  ['chilly', 'cold'], ['damp', 'wet'], ['glad', 'happy'], ['unhappy', 'sad'],
  ['shout', 'yell'], ['leap', 'jump'], ['stone', 'rock'], ['path', 'track'],
  ['sea', 'ocean'], ['hill', 'mound'], ['sleep', 'nap'], ['tale', 'story'],
  ['present', 'gift'], ['clever', 'bright'], ['beginning', 'start'], ['finish', 'end'],
  ['boat', 'ship'], ['tidy', 'neat'], ['look', 'see'], ['talk', 'speak'],
  ['home', 'house'], ['stop', 'halt'], ['pull', 'drag'], ['autumn', 'fall'],
  ['chat', 'talk'], ['child', 'kid'], ['scared', 'afraid'], ['correct', 'right'],
  ['break', 'snap'], ['pebble', 'stone'], ['hole', 'gap'], ['hurry', 'rush'],
]

// ── logic scenes (VR 7-8) ─────────────────────────────────────────────────────────────────
// "A and M use yellow paint. D and E use orange paint. A and E paint dogs. D and M paint cats.
// Who paints yellow dogs?" Four children split two ways, so every pair of values names exactly
// one child. The sentences are templates with {a} {b} for two names and {v} for a value.
export const LOGIC_SCENES = [
  {
    first: { values: ['yellow', 'orange', 'red', 'blue', 'green'], line: '{a} and {b} use {v} paint.' },
    second: { values: ['dogs', 'cats', 'horses', 'boats', 'houses', 'flowers'], line: '{a} and {b} paint {v}.' },
    question: 'Who paints {v1} {v2}?',
  },
  {
    first: { values: ['football', 'tennis', 'swimming', 'netball', 'chess'], line: '{a} and {b} like {v}.' },
    second: { values: ['biking', 'skateboarding', 'reading', 'painting', 'baking'], line: '{a} and {b} like {v}.' },
    question: 'Who likes {v1} and {v2}?',
  },
  {
    first: { values: ['chips', 'pizza', 'pasta', 'rice', 'potatoes'], line: '{a} and {b} have {v}.' },
    second: { values: ['salt', 'ketchup', 'cheese', 'pepper', 'gravy'], line: '{a} and {b} put {v} on their food.' },
    question: 'Who puts {v2} on their {v1}?',
  },
  {
    first: { values: ['tall', 'short'], line: '{a} and {b} are {v}.', pair: true },
    second: { values: ['fair', 'dark'], line: '{a} and {b} have {v} hair.', pair: true },
    question: 'Who is {v1} with {v2} hair?',
  },
  {
    first: { values: ['red', 'blue', 'green', 'yellow'], line: '{a} and {b} have {v} bikes.' },
    second: { values: ['bells', 'baskets', 'lights', 'flags'], line: '{a} and {b} have {v} on their bikes.' },
    question: 'Who has a {v1} bike with {v2}?',
  },
]

// "Tom is smaller than Kang and Kang is smaller than Leo. Who is the smallest?"
export const ORDER_SCENES = [
  { more: 'taller', less: 'shorter', most: 'tallest', least: 'shortest' },
  { more: 'older', less: 'younger', most: 'oldest', least: 'youngest' },
  { more: 'faster', less: 'slower', most: 'fastest', least: 'slowest' },
  { more: 'bigger', less: 'smaller', most: 'biggest', least: 'smallest' },
  { more: 'heavier', less: 'lighter', most: 'heaviest', least: 'lightest' },
]

// Short names from many backgrounds, as the book's are (Meera, Sanjay, Morwen, Kang, Samina).
export const NAMES = [
  'Tom', 'Mia', 'Sam', 'Leo', 'Zoe', 'Raj', 'Amir', 'Lily', 'Omar', 'Ella', 'Ben', 'Priya',
  'Kofi', 'Nina', 'Jack', 'Aisha', 'Ravi', 'Yan', 'Sara', 'Max', 'Kang', 'Meera', 'Dan', 'Rita',
]

// ── possessive apostrophes (English 10-11, Paper 1) ─────────────────────────────────────
// "Rewrite each of the following, using only two words, one of which should have an
// apostrophe. basket for a cat → cat's basket; school for girls → girls' school."
// [owner as the phrase prints it, owner as it owns, the thing, how the phrase joins them,
//  whether the owner is plural]. The explicit flag matters for singular words ending in s:
//  princess's and class's take 's; girls' and classes' do not.
export const POSSESSIVES = [
  ['a cat', 'cat', 'basket', 'for'], ['girls', 'girls', 'school', 'for', true],
  ['women', 'women', 'hospital', 'for', true], ['the workers', 'workers', 'canteen', 'for', true],
  ['children', 'children', 'playground', 'for', true], ['a dog', 'dog', 'kennel', 'for'],
  ['the babies', 'babies', 'toys', 'of', true], ['a baby', 'baby', 'cot', 'for'],
  ['the teachers', 'teachers', 'room', 'for', true], ['a teacher', 'teacher', 'desk', 'of'],
  ['the men', 'men', 'changing room', 'for', true], ['a man', 'man', 'hat', 'of'],
  ['the mice', 'mice', 'nest', 'of', true], ['a mouse', 'mouse', 'tail', 'of'],
  ['the birds', 'birds', 'nests', 'of', true], ['a bird', 'bird', 'wing', 'of'],
  ['the families', 'families', 'picnic', 'of', true], ['a family', 'family', 'car', 'of'],
  ['the players', 'players', 'kit', 'of', true], ['a player', 'player', 'boots', 'of'],
  ['the sheep', 'sheep', 'field', 'for', true], ['the geese', 'geese', 'pond', 'for', true],
  ['the horses', 'horses', 'stable', 'for', true], ['a horse', 'horse', 'saddle', 'of'],
  ['the ladies', 'ladies', 'cloakroom', 'for', true], ['a lady', 'lady', 'handbag', 'of'],
  ['the pupils', 'pupils', 'books', 'of', true], ['a pupil', 'pupil', 'pencil case', 'of'],
  ['the people', 'people', 'park', 'for', true], ['the puppies', 'puppies', 'basket', 'for', true],
  ['a puppy', 'puppy', 'lead', 'of'], ['the boys', 'boys', 'football', 'of', true],
  ['a boy', 'boy', 'bike', 'of'], ['the doctors', 'doctors', 'meeting', 'of', true],
  ['the princess', 'princess', 'crown', 'of'], ['the class', 'class', 'trip', 'of'],
  ['the classes', 'classes', 'concert', 'of', true], ['the fox', 'fox', 'den', 'of'],
  ['the foxes', 'foxes', 'den', 'of', true], ['the wolves', 'wolves', 'howls', 'of', true],
  ['the fishermen', 'fishermen', 'boats', 'of', true], ['my brother', 'brother', 'room', 'of'],
  ['my sisters', 'sisters', 'room', 'of', true], ['the twins', 'twins', 'birthday', 'of', true],
]

// ── spelling (English 10-11 Papers 4, 6; MC Pack 2 Section 2) ────────────────────────────
// [correct, the misspelling]. The misspellings are the books' own where they give one, and the
// shape of theirs where they do not: a dropped letter, a doubled one, a swapped vowel, a sound
// spelled the way it is heard. Words spelled differently in the two varieties are not here.
export const MISSPELLINGS = [
  ['temperature', 'temprature'], ['separate', 'seperate'], ['sacrifice', 'sacrifise'],
  ['government', 'goverment'], ['necessary', 'necesary'], ['vegetables', 'vegtables'],
  ['dictionary', 'dictionery'], ['library', 'libaray'],
  ['cemetery', 'cemetry'], ['sufficient', 'sufficent'], ['definite', 'definte'],
  ['restaurant', 'resturant'], ['persuade', 'pursuade'], ['embarrass', 'embarass'],
  ['family', 'famly'], ['different', 'diffrent'], ['available', 'availible'],
  ['extraordinary', 'extrordinary'], ['believed', 'beleved'], ['special', 'specail'],
  ['presentation', 'presuntation'], ['referred', 'refered'], ['preferred', 'prefered'],
  ['originally', 'originly'], ['conscious', 'consious'], 
  ['significant', 'significent'], ['beautiful', 'beautifull'], ['because', 'becuase'],
  ['friend', 'freind'], ['believe', 'belive'], ['receive', 'recieve'], ['weird', 'wierd'],
  ['definitely', 'definately'], ['accommodation', 'accomodation'], ['address', 'adress'],
  ['argument', 'arguement'], ['beginning', 'begining'], ['business', 'buisness'],
  ['calendar', 'calender'], ['committee', 'comittee'], ['disappear', 'dissapear'],
  ['disappoint', 'dissapoint'], ['environment', 'enviroment'], ['exaggerate', 'exagerate'],
  ['existence', 'existance'], ['foreign', 'foriegn'],
  ['forty', 'fourty'], ['grammar', 'grammer'], ['guarantee', 'garantee'],
  ['height', 'heigth'], ['immediately', 'immediatly'],
  ['independent', 'independant'], ['interrupt', 'interupt'], ['knowledge', 'knowlege'],
  ['marriage', 'marrage'], 
  ['mischievous', 'mischievious'], ['occasion', 'occassion'],
  ['occurred', 'occured'], ['parallel', 'paralell'], ['parliament', 'parliment'],
  ['possession', 'posession'], ['privilege', 'priviledge'], ['pronunciation', 'pronounciation'],
  ['queue', 'que'], ['recommend', 'reccomend'], ['rhythm', 'rythm'], ['secretary', 'secretery'],
  ['successful', 'succesful'], ['surprise', 'suprise'],
  ['tomorrow', 'tommorow'], ['truly', 'truely'], ['until', 'untill'], ['vehicle', 'vehical'],
  ['across', 'accross'],
  ['almost', 'allmost'], ['always', 'allways'], ['answer', 'anser'], ['busy', 'buisy'],
  ['caught', 'cought'], ['certain', 'certin'], ['describe', 'discribe'],
  ['different', 'diffirent'], ['enough', 'enuff'], ['exercise', 'excercise'],
  ['government', 'govenment'], ['island', 'iland'],
  ['minute', 'minit'], ['opposite', 'oposite'], ['probably', 'probly'],
  ['remember', 'remeber'], ['strength', 'strenth'],
  ['thought', 'thougth'], ['usually', 'usualy'],
]

// ── contractions (English 10-11 Papers 3, 9) ─────────────────────────────────────────────
// [short, full, and the wrong answers a child actually gives]. `could of` is the one the whole
// type exists for: it is what `could've` sounds like.
export const CONTRACTIONS = [
  ["I'm", 'I am', ['I have', 'I will', 'I was']],
  ["don't", 'do not', ['did not', 'does not', 'done not']],
  ["could've", 'could have', ['could of', 'can have', 'could not']],
  ["should've", 'should have', ['should of', 'shall have', 'should not']],
  ["would've", 'would have', ['would of', 'will have', 'would not']],
  ["you're", 'you are', ['your', 'you were', 'you have']],
  ["they're", 'they are', ['their', 'there', 'they were']],
  ["we'll", 'we will', ['we all', 'we would', 'well']],
  ["won't", 'will not', ['would not', 'want not', 'was not']],
  ["can't", 'cannot', ['could not', 'can it', 'can to']],
  ["shouldn't", 'should not', ['shall not', 'should now', 'could not']],
  ["wasn't", 'was not', ['were not', 'was it', 'is not']],
  ["weren't", 'were not', ['was not', 'we are not', 'where not']],
  ["isn't", 'is not', ['it is not', 'was not', 'is it']],
  ["aren't", 'are not', ['am not', 'is not', 'were not']],
  ["haven't", 'have not', ['had not', 'has not', 'have it']],
  ["hasn't", 'has not', ['have not', 'had not', 'was not']],
  ["hadn't", 'had not', ['have not', 'has not', 'would not']],
  ["didn't", 'did not', ['do not', 'does not', 'had not']],
  ["doesn't", 'does not', ['do not', 'did not', 'is not']],
  ["couldn't", 'could not', ['can not', 'would not', 'could it']],
  ["wouldn't", 'would not', ['will not', 'could not', 'would it']],
  ["I'll", 'I will', ['I all', 'ill', 'I would']],
  ["I've", 'I have', ['I of', 'I am', 'I had']],
  ["I'd", 'I would', ['I did it', 'I do', 'I will']],
  ["we're", 'we are', ['were', 'where', 'we were']],
  ["we've", 'we have', ['we of', 'we are', 'we had']],
  ["she's", 'she is', ['she was', 'shes', 'she will']],
  ["he'll", 'he will', ['he all', 'he would', 'here will']],
  ["let's", 'let us', ['lets', 'let is', 'let was']],
  ["who's", 'who is', ['whose', 'who was', 'who does']],
  ["there's", 'there is', ['theirs', 'their is', 'there was']],
  ["what's", 'what is', ['whats', 'what was', 'what does']],
  ["mustn't", 'must not', ['must now', 'might not', 'may not']],
  ["you've", 'you have', ['you of', 'you are', 'you had']],
  ["they'll", 'they will', ['they all', 'they would', 'there will']],
  ["she'd", 'she would', ['she did', 'shed', 'she will']],
  ["needn't", 'need not', ['needed not', 'need it', 'did not']],
  ["shan't", 'shall not', ['should not', 'shant', 'shall it']],
  ["that's", 'that is', ['thats', 'that was', 'this is']],
]

// ── homophones in a sentence (English 10-11 Papers 2, 5; MC Pack 2 Section 4) ───────────
// "Write there, their or they're in each gap." The sentence carries a single gap `___`; the
// options are the whole set, and the answer is the one that fits. Written so that exactly one
// member of the set is grammatical — no sentence where `their` and `there` could both be read.
export const HOMOPHONE_SETS = {
  there: ['there', 'their', "they're"],
  to: ['to', 'too', 'two'],
  where: ['where', 'were', 'wear', "we're"],
  your: ['your', "you're"],
  its: ['its', "it's"],
  whose: ['whose', "who's"],
  hear: ['hear', 'here'],
  knew: ['knew', 'new'],
  right: ['right', 'write'],
  weather: ['weather', 'whether'],
  passed: ['passed', 'past'],
  allowed: ['allowed', 'aloud'],
  brought: ['brought', 'bought'],
  which: ['which', 'witch'],
  lose: ['lose', 'loose'],
  quiet: ['quiet', 'quite'],
  of: ['of', 'off'],
  than: ['than', 'then'],
}

export const HOMOPHONE_CLOZE = [
  ['They must get ___ coats before we leave.', 'their'],
  ['Put the box over ___ by the door.', 'there'],
  ["___ always late when it rains.", "they're"],
  ['The pupils in Class 6 always have ___ reading time after lunch.', 'their'],
  ['Is ___ any milk left in the fridge?', 'there'],
  ['I think ___ going to win the match.', "they're"],
  ['It is ___ hot to play outside today.', 'too'],
  ['The ___ hens scratched around in the dirt.', 'two'],
  ['We walked ___ the park after school.', 'to'],
  ['Can I come ___?', 'too'],
  ['She has ___ brothers and a sister.', 'two'],
  ['I want ___ learn to swim.', 'to'],
  ['___ did you put my pencil case?', 'where'],
  ['The children ___ very excited about the trip.', 'were'],
  ['You must ___ a helmet when you ride your bike.', 'wear'],
  ["___ going to the beach tomorrow!", "we're"],
  ['Is this ___ coat on the floor?', 'your'],
  ["___ going to love this story.", "you're"],
  ['The dog wagged ___ tail.', 'its'],
  ["___ raining again, so bring a coat.", "it's"],
  ['The tree lost all ___ leaves in the storm.', 'its'],
  ["I think ___ time to go home.", "it's"],
  ['___ bag is this on the table?', 'whose'],
  ["___ coming to the party on Saturday?", "who's"],
  ['Come over ___ and sit next to me.', 'here'],
  ['Did you ___ the thunder last night?', 'hear'],
  ['She ___ the answer straight away.', 'knew'],
  ['I got a ___ pair of trainers for my birthday.', 'new'],
  ['Please ___ your name at the top of the page.', 'write'],
  ['Turn ___ at the end of the road.', 'right'],
  ['The ___ was sunny all week.', 'weather'],
  ['I do not know ___ to go or to stay.', 'whether'],
  ['We ___ the bakery on the way to school.', 'passed'],
  ['It was half ___ eight when we got home.', 'past'],
  ['Dogs are not ___ in the shop.', 'allowed'],
  ['The teacher read the poem ___ to the class.', 'aloud'],
  ['Finn ___ his favourite game in to school to show his friends.', 'brought'],
  ['Mum ___ some apples at the market.', 'bought'],
  ['___ way is the station?', 'which'],
  ['The ___ flew over the castle on her broomstick.', 'witch'],
  ['Hold my hand or you might ___ me in the crowd.', 'lose'],
  ['My tooth is ___ and wobbly.', 'loose'],
  ['Please be ___ while the baby is asleep.', 'quiet'],
  ['The test was ___ easy in the end.', 'quite'],
  ['Take your muddy boots ___ at the door.', 'off'],
  ['She drank a glass ___ water.', 'of'],
  ['My sister is taller ___ me.', 'than'],
  ['We had lunch and ___ went to the park.', 'then'],
]

// ── verb forms and word choice in a sentence (English 10-11; MC Pack 2 Section 4) ────────
// "Choose the correct word or short phrase to complete each sentence. Each sentence must make
// sense and use Standard English." [sentence, answer, wrong options]
export const GRAMMAR_CLOZE = [
  ['Kate ___ very happy on holiday.', 'was', ['were', 'be', 'been']],
  ['They ___ unsure whether to go to the park.', 'are', ['is', 'am', 'be']],
  ['Meena and Tuhil ___ very excited about the party.', 'were', ['was', 'is', 'be']],
  ['The goat ___ all of its food yesterday.', 'ate', ['eat', 'eaten', 'eated']],
  ['Hannah ___ the whole bottle of water after the race.', 'drank', ['drink', 'drinks', 'drinked']],
  ['There ___ many bags to choose from.', 'are', ['is', 'was', 'be']],
  ['He ___ running when he slipped into the puddle.', 'was', ['were', 'is', 'be']],
  ['It ___ time to go home.', 'was', ['were', 'are', 'be']],
  ['When ___ Greg arriving?', 'is', ['are', 'am', 'be']],
  ["You ___ very tired, aren't you?", 'are', ['is', 'was', 'be']],
  ["Susan's sisters ___ much older than her.", 'were', ['was', 'is', 'be']],
  ['He ___ not do what he should have done.', 'did', ['done', 'do', 'doing']],
  ['She said she had ___ it already.', 'done', ['did', 'do', 'doed']],
  ['Mark ___ his homework yesterday.', 'did', ['done', 'do', 'does']],
  ['The children had ___ it was late before they set off.', 'known', ['know', 'knew', 'knowing']],
  ['I always ___ to do my best.', 'try', ['tries', 'trying', 'tried to']],
  ['The snow ___ down the branches of the trees.', 'weighed', ['way', 'weight', 'wade']],
  ["I'm going to ask Raj if he ___ to walk to school with me.", 'wants', ['want', 'wanting', 'will']],
  ['Going swimming on Saturday would ___ been a great idea.', 'have', ['of', 'has', 'had']],
  ['Cats are said to have nine ___.', 'lives', ['lifes', 'life', 'lived']],
  ['"___ is Adam\'s house? I\'ve forgotten!"', 'Where', ['Were', 'Wear', 'Wears']],
  ['We ___ our best in the race last week.', 'did', ['done', 'do', 'doed']],
  ['Neither Jack nor Jill ___ going up the hill.', 'is', ['are', 'were', 'be']],
  ['Ian and I ___ going to the party.', 'are', ['is', 'am', 'was']],
  ['Dad gave Cameron and ___ some apples.', 'me', ['I', 'myself', 'mine']],
  ['The book belongs to them, so it is ___.', 'theirs', ["their's", 'there', 'theres']],
  ['My brother and ___ walked to school together.', 'I', ['me', 'myself', 'mine']],
  ['She ___ her bike to school every day.', 'rides', ['ride', 'rided', 'riden']],
  ['We have ___ this film three times now.', 'seen', ['saw', 'see', 'seed']],
  ['I ___ my coat at school yesterday.', 'left', ['leaved', 'leave', 'leaven']],
  ['The bell ___ at three o\'clock yesterday.', 'rang', ['rung', 'ringed', 'ring']],
  ['Has anyone ___ my pencil?', 'seen', ['saw', 'seed', 'see']],
  ['The team has ___ every match this year.', 'won', ['win', 'winned', 'wan']],
  ['Tom ___ the ball over the fence.', 'threw', ['throwed', 'thrown', 'through']],
  ['They should ___ told us earlier.', 'have', ['of', 'has', 'had of']],
  ['Each of the pupils ___ a book.', 'has', ['have', 'having', 'haves']],
  ['I ___ to the shops before breakfast.', 'went', ['goed', 'gone', 'go']],
  ['She has ___ a letter to her grandma.', 'written', ['wrote', 'writ', 'writed']],
  ['The water ___ when the kettle was turned on.', 'boiled', ['boils', 'boil', 'boilt']],
]

// ── comparatives (MC Pack 2 Section 4; English 10-11 Paper 2) ────────────────────────────
// [adjective, comparative, superlative]. Written out rather than derived, because the rules
// that derive them are exactly what the question tests and a rule bug here would mark a child
// wrong for being right.
export const COMPARATIVES = [
  ['cheap', 'cheaper', 'cheapest'], ['tall', 'taller', 'tallest'], ['silly', 'sillier', 'silliest'],
  ['happy', 'happier', 'happiest'], ['big', 'bigger', 'biggest'], ['hot', 'hotter', 'hottest'],
  ['thin', 'thinner', 'thinnest'], ['brave', 'braver', 'bravest'], ['nice', 'nicer', 'nicest'],
  ['large', 'larger', 'largest'], ['safe', 'safer', 'safest'], ['easy', 'easier', 'easiest'],
  ['busy', 'busier', 'busiest'], ['early', 'earlier', 'earliest'], ['noisy', 'noisier', 'noisiest'],
  ['funny', 'funnier', 'funniest'], ['sad', 'sadder', 'saddest'], ['wet', 'wetter', 'wettest'],
  ['great', 'greater', 'greatest'], ['small', 'smaller', 'smallest'], ['fast', 'faster', 'fastest'],
  ['heavy', 'heavier', 'heaviest'], ['dry', 'drier', 'driest'], ['late', 'later', 'latest'],
  ['strong', 'stronger', 'strongest'], ['young', 'younger', 'youngest'], ['long', 'longer', 'longest'],
  ['good', 'better', 'best'], ['bad', 'worse', 'worst'],
  ['beautiful', 'more beautiful', 'most beautiful'], ['careful', 'more careful', 'most careful'],
  ['important', 'more important', 'most important'], ['dangerous', 'more dangerous', 'most dangerous'],
  ['comfortable', 'more comfortable', 'most comfortable'], ['exciting', 'more exciting', 'most exciting'],
  ['difficult', 'more difficult', 'most difficult'], ['famous', 'more famous', 'most famous'],
  ['delicious', 'more delicious', 'most delicious'], 
  ['interesting', 'more interesting', 'most interesting'], ['expensive', 'more expensive', 'most expensive'],
]

// ── gender (English 10-11 Papers 6, 8) ───────────────────────────────────────────────────
// "Change the words in bold into their feminine form." [masculine, feminine]
export const GENDER_PAIRS = [
  ['king', 'queen'], ['prince', 'princess'], ['duke', 'duchess'],
  ['nephew', 'niece'], ['uncle', 'aunt'], ['son', 'daughter'], ['brother', 'sister'],
  ['father', 'mother'], ['husband', 'wife'], ['man', 'woman'], ['boy', 'girl'],
  ['hero', 'heroine'], ['emperor', 'empress'], ['waiter', 'waitress'], ['actor', 'actress'],
  ['host', 'hostess'], ['grandfather', 'grandmother'], ['gentleman', 'lady'],
  ['bridegroom', 'bride'], ['wizard', 'witch'], ['gander', 'goose'],
  ['drake', 'duck'], ['bull', 'cow'], ['ram', 'ewe'], ['stallion', 'mare'], ['cockerel', 'hen'],
  ['stag', 'doe'], ['fox', 'vixen'], ['lion', 'lioness'], ['tiger', 'tigress'],
  ['headmaster', 'headmistress'], ['landlord', 'landlady'], ['schoolboy', 'schoolgirl'],
]

// ── collective nouns (English 10-11 Papers 6, 7) ─────────────────────────────────────────
// [the collective noun, the things it collects]. A group can take more than one — fish come in
// a shoal AND a school — so the check is against every collective a thing is listed under.
export const COLLECTIVES = [
  ['herd', ['cows', 'cattle', 'elephants', 'deer']], ['flock', ['sheep', 'birds', 'geese']],
  ['pack', ['wolves', 'cards', 'dogs']], ['swarm', ['bees', 'insects', 'flies']],
  ['shoal', ['fish']], ['school', ['fish', 'whales', 'dolphins']], ['pride', ['lions']],
  ['gaggle', ['geese']], ['litter', ['puppies', 'kittens', 'piglets']], ['pod', ['dolphins', 'whales']],
  ['choir', ['singers']], ['crew', ['sailors']], ['team', ['players']],
  ['bunch', ['flowers', 'grapes', 'bananas', 'keys']], ['colony', ['ants', 'bats', 'penguins']],
  ['class', ['pupils']], ['band', ['musicians']],
  ['clutch', ['eggs']], ['crowd', ['people']], ['bundle', ['sticks']],
  ['string', ['pearls']], ['range', ['mountains']], ['galaxy', ['stars']], ['deck', ['cards']],
  ['orchestra', ['musicians']], ['audience', ['listeners']], ['library', ['books']],
  ['forest', ['trees']], ['bouquet', ['flowers']], ['stack', ['plates']],
  ['staff', ['teachers']], ['swarm', ['locusts']],
]

// ── proverbs (English 10-11 Papers 2, 5) ─────────────────────────────────────────────────
// [the proverb with `___` where the missing word goes, the word, near misses]
export const PROVERBS = [
  ['There is no smoke without ___.', 'fire', ['water', 'cloud', 'light']],
  ['Birds of a feather flock ___.', 'together', ['apart', 'south', 'home']],
  ['Every cloud has a silver ___.', 'lining', ['coin', 'edge', 'spoon']],
  ['First come, first ___.', 'served', ['seated', 'saved', 'seen']],
  ['More haste, less ___.', 'speed', ['time', 'waste', 'work']],
  ["When the cat's away the ___ will play.", 'mice', ['dogs', 'birds', 'kittens']],
  ["Don't put all your ___ in one basket.", 'eggs', ['apples', 'money', 'toys']],
  ['A stitch in time saves ___.', 'nine', ['time', 'ten', 'money']],
  ['Let sleeping dogs ___.', 'lie', ['sleep', 'rest', 'dream']],
  ['Two heads are better than ___.', 'one', ['none', 'three', 'two']],
  ['Practice makes ___.', 'perfect', ['better', 'progress', 'sense']],
  ['Too many cooks spoil the ___.', 'broth', ['soup', 'dinner', 'cake']],
  ['One good turn deserves ___.', 'another', ['thanks', 'more', 'nothing']],
  ['Look before you ___.', 'leap', ['run', 'jump', 'speak']],
  ["Don't count your chickens before they ___.", 'hatch', ['grow', 'lay', 'cluck']],
  ['The early bird catches the ___.', 'worm', ['bus', 'fish', 'fly']],
  ['An apple a day keeps the ___ away.', 'doctor', ['teacher', 'dentist', 'worm']],
  ['Actions speak louder than ___.', 'words', ['voices', 'shouts', 'thoughts']],
  ['Where there is a will there is a ___.', 'way', ['road', 'door', 'plan']],
  ['All that glitters is not ___.', 'gold', ['silver', 'real', 'new']],
  ['Absence makes the heart grow ___.', 'fonder', ['colder', 'stronger', 'bigger']],
  ['Every dog has its ___.', 'day', ['bone', 'home', 'ball']],
  ['Many hands make light ___.', 'work', ['loads', 'play', 'hands']],
  ['Out of sight, out of ___.', 'mind', ['reach', 'place', 'time']],
  ['Better late than ___.', 'never', ['early', 'sorry', 'soon']],
  ['Rome was not built in a ___.', 'day', ['week', 'year', 'month']],
]

// ── silent letters (English 10-11 Paper 6) ───────────────────────────────────────────────
// "Rewrite each word, adding the missing silent letter: hym, nock, lim, autum, bom." The pattern
// says where the letter sits; the lexicon supplies the words.
export const SILENT_PATTERNS = [
  { re: /^kn/, at: 0, letter: 'k' },
  { re: /^wr/, at: 0, letter: 'w' },
  { re: /^gn/, at: 0, letter: 'g' },
  { re: /mb$/, at: -1, letter: 'b' },
  { re: /mn$/, at: -1, letter: 'n' },
  { re: /stle$/, at: -3, letter: 't' },
  { re: /sten$/, at: -3, letter: 't' },
  { re: /^gh/, at: 1, letter: 'h' },
  // Not `wh`: the h is sounded in Scotland and Ireland, so it is not silent for every child.
]

// ── endings that sound alike (English 10-11 Papers 2, 3, 6, 8, 9) ────────────────────────
// "Add cial or tial", "Add sure or ture", "Add ary, ery or ory", "Complete each word:
// depend_ncy, excell_nce, blat_nt". Each group is a set of endings a child cannot tell apart
// by ear; the lexicon supplies the words.
export const ENDING_GROUPS = [
  ['ance', 'ence'], ['ancy', 'ency'], ['ant', 'ent'], ['able', 'ible'],
  ['ary', 'ery', 'ory'], ['cial', 'tial'], ['sure', 'ture'], ['cian', 'tion', 'sion'],
]

// ── similar meaning + rhyme (VR 7-8) ─────────────────────────────────────────────────────
// "Find a word that is similar in meaning to the word in capital letters and that rhymes with
// the second word. CABLE, tyre → wire." [the clue as printed, the answer]. The clue may be a
// phrase, as the book's are (WOOLLY ANIMAL, RAIL CARRIAGES). The rhyming word is not written
// here — the lexicon supplies one per question from the answer's own rhyme group. Written by
// hand because WordNet's synonyms cross senses: generated, this type offered `most` for ABOUT
// and `sick` for CRAZY.
export const RHYME_CLUES = [
  ['RENT', 'hire'], ['FRIEND', 'mate'], ['WOOLLY ANIMAL', 'sheep'], ['MIDDAY', 'noon'],
  ['PIPS', 'seeds'], ['VEHICLE', 'car'], ['A ROAD', 'street'], ['GROCERIES', 'food'],
  ['SPONGE', 'cake'], ['INSTRUCT', 'teach'], ['GRAZE', 'scratch'], ['BROOK', 'stream'],
  ['RAIL CARRIAGES', 'train'], ['SEASHORE', 'coast'], ['A DOG', 'hound'], ['QUARREL', 'fight'],
  ['TO BEGIN', 'start'], ['A SMALL RODENT', 'mouse'], ['A BOX', 'crate'], ['CABLE', 'wire'],
  ['SHUT', 'close'], ['LARGE', 'big'], ['TINY', 'small'], ['ANGRY', 'cross'], ['QUICK', 'fast'],
  ['CHILLY', 'cold'], ['DAMP', 'wet'], ['GLAD', 'happy'], ['UNHAPPY', 'sad'], ['SHOUT', 'yell'],
  ['LEAP', 'jump'], ['STONE', 'rock'], ['PATH', 'track'], ['SEA', 'ocean'], ['HILL', 'mound'],
  ['SLEEP', 'nap'], ['TALE', 'story'], ['PRESENT', 'gift'], ['CLEVER', 'bright'],
  ['BEGINNING', 'start'], ['FINISH', 'end'], ['FLOOR COVERING', 'rug'], ['BOAT', 'ship'],
  ['TIDY', 'neat'], ['LOOK', 'see'], ['TALK', 'speak'], ['HOME', 'house'], ['STOP', 'halt'],
  ['PULL', 'drag'], ['AUTUMN', 'fall'], ['EVENING MEAL', 'tea'], ['CHAT', 'talk'],
  ['CHILD', 'kid'], ['SCARED', 'afraid'], ['CORRECT', 'right'], ['BREAK', 'snap'],
  ['PAN', 'pot'], ['PEBBLE', 'stone'], ['HOLE', 'gap'], ['HURRY', 'rush'],
]
