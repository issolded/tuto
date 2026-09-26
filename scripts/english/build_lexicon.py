#!/usr/bin/env python3
"""Build src/lib/englishLexicon.generated.js from WordNet.

Run once, on a developer machine, with the venv described in requirements.txt. NOTHING here
runs in production: the output is a plain JS data file that ships with the app, the same way
scripts/fetch-puzzle-fonts.mjs bakes Noto's drawings into puzzleArt.generated.js. No model, no
network, no per-question cost.

What WordNet gives us, measured against the Bond 8-9 book rather than assumed:

  categories (odd-one-out)   excellent — `lamb/calf/foal` all sit under young_mammal.n.01 and
                             `donkey/pig` do not, which is the book's own question, generated
  antonyms                   excellent — 999 pairs survive the common-word gate
  senses (what does X mean    excellent — a polysemous word's senses come with example
  in this sentence?)         sentences AND the synonym set of each sense, which is the
                             question and its options in one object
  synonyms                   POOR — of the book's twelve SIMILAR pairs WordNet has four.
                             Its neighbours are adult and rare (`knowledge → noesis`). So
                             synonym ANSWERS are hand-written (src/lib/englishPairs.js) and
                             what WordNet contributes is the DISTRACTORS: asked for `medal`
                             it offers `ribbon`, which is the book's own first distractor.

Two gates decide what a word is allowed to be:

  frequency   wordfreq's Zipf scale, stored per word so the band is a runtime dial rather
              than something baked in here. Calibration is measured, not guessed: the 598
              real words the Bond 8-9 book uses as options have their 5th percentile at
              Zipf 2.86, so 2.8 keeps 95% of the book's own vocabulary. Words below it are
              the book's rare inflected distractors (`goslings` 1.86, `brayed` 1.17).
              Later bands move this number and nothing else: 5-6 wants ~4.2, 10-11 ~2.6.

  safety      blocklist.txt, applied to the lemma, to every definition and example sentence,
              and to category names. The sense gate is the one that earns its keep: `crack`,
              `pot`, `joint` and `shot` are innocent lemmas carrying senses a nine-year-old's
              quiz has no business in.
"""
import json, re, datetime
from pathlib import Path
from collections import defaultdict

from nltk.corpus import names as name_corpus
from nltk.corpus import wordnet as wn
from wordfreq import zipf_frequency

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'src' / 'lib' / 'englishLexicon.generated.js'
BLOCK = Path(__file__).with_name('blocklist.txt')
TOPICS = Path(__file__).with_name('sentence-topics.txt')
CAT_SKIP = Path(__file__).with_name('category-skip.txt')
MENTIONABLE_FILE = Path(__file__).with_name('mentionable.txt')
VENDOR = Path(__file__).parent / 'vendor'

# Floor for anything that may appear on screen at all. Bands sit ABOVE this; it exists so the
# file is not 150k words of WordNet's long tail.
MIN_ZIPF = 2.6
MIN_LEN, MAX_LEN = 3, 12


def load_words(path):
    words = set()
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            words.add(line.lower())
    return words


def load_published_lists():
    """The three published profanity lists, merged.

    Written by hand first, and the hand-written list turned out to be missing ninety words
    these carry — `anus`, `blowjob`, `nigga`, `chink`, `honky`, `paedophile` — every one of
    them still in the lexicon, where a filler option could have reached it. A list of what
    must never be shown to a child is not something to write from memory.

    A fourth list, zacanger/profane-words, was here and was dropped: LGPL-3.0 is the only
    copyleft licence among them and these lists ship inside the app bundle. The 25 words it
    alone protected against are now in blocklist.txt, written out one by one.

    `cuss` rates its entries 0 to 2 and only 1 and 2 are taken. Its 0 tier is
    context-dependent rather than profane, and it holds `african`, `asian`, `arab`,
    `american`, `adult` and `angry`; blocking those would be a worse failure than the one
    this is guarding against.

    Multi-word entries are dropped — the lexicon holds single words, and "alligator bait"
    cannot appear in it.
    """
    out = set()
    for w in (VENDOR / 'ldnoobw-en.txt').read_text().split('\n'):
        w = w.strip().lower()
        if w.isalpha():
            out.add(w)
    for w, score in json.loads((VENDOR / 'cuss.json').read_text()).items():
        if score >= 1 and w.isalpha():
            out.add(w.lower())
    return out


PUBLISHED = load_published_lists()
BLOCKED = load_words(BLOCK) | PUBLISHED

# Words 80% of US fourth-graders know (Dale-Chall). An ALLOWLIST, and the only one here.
# Too small to be the module's vocabulary — 2942 words against the 19,000 this lexicon keeps,
# and the Bond 8-9 paper reaches well past it — but exactly the right size for judging a
# SENTENCE, where one unknown word sinks the whole question.
DALE_CHALL = {w.lower() for w in json.loads((VENDOR / 'dale-chall.json').read_text())}
# Safe words that set a grown-up scene. They stay in the lexicon — a child can be asked what
# `market` means — and they are kept out of EXAMPLE SENTENCES, where they stop being vocabulary
# and start being the news. See sentence-topics.txt for why this is a second list.
SENTENCE_TOPICS = load_words(TOPICS)
# Allowed inside a definition, never as an answer. See mentionable.txt for why the two are
# different questions.
MENTIONABLE = load_words(MENTIONABLE_FILE)
# Reviewed by eye rather than derived: see category-skip.txt for why each entry is there.
_CAT_SKIP = load_words(CAT_SKIP)
SKIP_GROUPS = {w.split(':', 1)[1].strip() for w in _CAT_SKIP if w.startswith('group:')}
SKIP_MEMBERS = {w for w in _CAT_SKIP if not w.startswith('group:')}

# Whole-word matching with the simple inflections, so `kill` takes `kills`/`killed`/`killing`
# but never `skill`, and `rape` never takes `grape`.
#
# Done by tokenising and looking each word up, rather than with one alternation regex over the
# whole text. The regex version was fine for a 450-word hand-written list and hung the build
# when the published lists took it past four thousand: Python compiles that into four thousand
# alternatives and walks them at every position of every string, and there are 200,000 strings
# here. Stripping the endings off each token instead costs one pass per word.
def _forms(token):
    """The token, plus the base forms it could be an inflection of.

    The endings are stripped conditionally rather than blindly, and the difference is not
    cosmetic. Stripping a bare `r` turns `poor` into `poo`, which is on the list, and blind
    stripping cost roughly three quarters of the usable sentences before anyone noticed the
    lexicon had shrunk. An `-r`/`-rs` ending only means an agent noun when what is left ends
    in `e` — `abuser` → `abuse` — so that is the only case it is taken off.
    """
    yield token
    if len(token) > 3:
        for suf in ('s', 'es', 'ed', 'ing', 'd'):
            if token.endswith(suf) and len(token) - len(suf) >= 3:
                yield token[:-len(suf)]
        for suf in ('r', 'rs'):
            if token.endswith(suf) and token[:-len(suf)].endswith('e'):
                yield token[:-len(suf)]


def _hits(text, vocabulary):
    for token in re.findall(r"[a-z]+", text.lower()):
        if any(f in vocabulary for f in _forms(token)):
            return True
    return False


def unsafe(text):
    return _hits(text, BLOCKED)


# The lexical files that name a THING: something in the world a child could point at, pick up
# or stroke. Deliberately narrower than the engine's `concrete` list, which also admits
# adjectives and feelings for its option lines — here the question is whether the SENTENCE has
# anything in it to picture.
THING_LEXNAMES = {
    'noun.animal', 'noun.artifact', 'noun.body', 'noun.food',
    'noun.object', 'noun.plant', 'noun.substance', 'noun.person',
}


def has_something_to_picture(text, lexname):
    """At least one word in the sentence names a thing.

    The topic list keeps the news out; this keeps the abstract out, and they are different
    failures. "offend all laws of humanity", "production was up in the second quarter" and
    "they assumed their operational positions" contain no forbidden word and nothing a child
    can see. A sentence with a car, a plate, a chair or a fork in it almost always reads as a
    sentence about something.

    Measured over the 4139 sentences that reach this point: 35% carry a thing. What that
    removes is "Will the new rules affect me?" and "she was adequate to the job"; what it
    keeps is "comfortable chairs arranged around the fireplace" and "an amber light
    illuminated the room".
    """
    return any(lexname.get(w) in THING_LEXNAMES
               for w in re.findall(r"[a-z']+", text.lower()))


def grown_up_scene(text):
    """A sentence set in the adult world: a courtroom, a market, a ward, a war."""
    return _hits(text, SENTENCE_TOPICS)


# A gate lived here that removed any word WordNet also spells with a capital letter. It was
# added in the same pass as the fix below and turned out to be doing that fix's job badly.
#
# `Russia`, `Jap`, `Wallace` and `Dresden` reached the lexicon because usable_lemma was being
# handed an already-lowercased name, so its islower() test was trivially true. Once the RAW
# lemma is passed instead, a capitalised entry cannot get in at all — and the extra gate was
# then only removing words that happen to ALSO be a name or an acronym somewhere in WordNet.
#
# Measured before removing it: 520 common words, among them `cat` (WordNet carries CAT for the
# scan), `ball`, `angle`, `army`, `bath`, `bell`, `berry`, `best`, `black`, `begin`, `acre` and
# `balance`. A children's English module with no word for `cat` in it is not a close call.
#
# What it was credited with catching that the case fix does not — `anna`, `basil`, `iris`,
# common nouns whose frequency belongs to the name — is caught by is_bare_name below. `murphy`,
# which neither catches, is in blocklist.txt by hand.

# Every given name NLTK knows, 7576 of them. A name reaches the lexicon whenever it is also a
# lowercase lemma, and plenty are: `anna` is an Indian coin,
# `basil` is a herb, `jack` is a lifting tool. Each is a real word and each scores a frequency
# it did not earn, because wordfreq counts every person called that.
FIRST_NAMES = {n.lower() for f in name_corpus.fileids() for n in name_corpus.words(f)}


def is_bare_name(name):
    """A given name whose common-noun sense nobody actually uses.

    Dropping every name would take `rose`, `daisy`, `grace`, `june`, `bill` and `mark` with it,
    which are ordinary words a child meets. SemCor separates them: it tagged `rose` five times
    and `june` twenty-six, and `anna`, `iris`, `basil` and `jack` never once.
    """
    if name not in FIRST_NAMES:
        return False
    return max((l.count() for s in wn.synsets(name) for l in s.lemmas()
                if l.name().lower() == name), default=0) == 0


def usable_lemma(name):
    """A single, lower-case, alphabetic common word.

    `name` is the RAW lemma, not a lowercased one — which is the whole point. The first build
    lowercased before this check, so `name.islower()` was trivially true and every proper noun
    in WordNet walked through: a question asked a child to find the opposite of `denmark`, and
    one offered a racial slur as a distractor because `Jap` became `jap` on the way in.
    """
    return (name.islower() and name.isalpha()
            and MIN_LEN <= len(name) <= MAX_LEN and name not in BLOCKED
            and not is_bare_name(name))


def spelling_variant(a, b):
    """True when two lemmas are the same word spelled two ways.

    `colored/coloured`, `centre/center`, `realise/realize`, `traveled/travelled`. WordNet
    lists these as synonyms, correctly, and they are worthless as a synonym QUESTION: a child
    who answers it has demonstrated nothing, and one who gets it wrong has been tested on
    which side of the Atlantic wrote the paper.
    """
    if a == b:
        return False
    # Plurals and other inflections of one another (`tactic/tactics`, `sep/sept`) are the same
    # non-question as the spellings: WordNet lists them because they are the same word.
    for short, long in ((a, b), (b, a)):
        if long in (short + 's', short + 'es', short + 't'):
            return True
    for x, y in (('our', 'or'), ('re', 'er'), ('ise', 'ize'), ('isa', 'iza'),
                 ('yse', 'yze'), ('ll', 'l'), ('ae', 'e'), ('oe', 'e'),
                 ('er', 'or'), ('ence', 'ense'), ('ogue', 'og')):
        if a.replace(x, y) == b.replace(x, y):
            return True
    # An optional internal `e`: `judgement/judgment`, `acknowledgement/acknowledgment`. These
    # reached the homophone list, where they are not a question — the two spellings are one
    # word, so "which of these sounds the same as `judgement`" answers itself.
    #
    # Exactly ONE `e` removed, at one position, and not `e`s stripped wholesale: the loose
    # version took `bare/bear` with it, which is the best homophone pair in the language.
    short, long = sorted((a, b), key=len)
    if len(long) == len(short) + 1:
        for i, ch in enumerate(long):
            if ch == 'e' and long[:i] + long[i + 1:] == short:
                return True
        # The same thing with any vowel, on longer words only: `speciality/specialty`,
        # `aluminium/aluminum`. Both appeared on one odd-synonym line, where a child is asked
        # which word does not belong and two of the five are the same word. The length floor
        # keeps `bare/bear` and `hare/hair` out of it, which are four letters and real pairs.
        if len(short) >= 8:
            for i, ch in enumerate(long):
                if ch in 'aeiou' and long[:i] + long[i + 1:] == short:
                    return True
    return False


def near_the_front(name, syn):
    """Is this one of the word's first three senses in its own part of speech?

    The test the antonym list needs, and NOT the `dominant` test the synonym sets use. That
    one also requires the sense to be in the word's main part of speech, and applied here it
    took `wet/dry` and `early/late` with it — `wet` and `early` are adjectives whose verb and
    adverb readings carry their own SemCor weight. Measured on the pairs that matter: `wet`,
    `early`, `high` and `small` are all their part of speech's FIRST sense; `clear`, in the
    sense that makes it the opposite of `bounce`, is its seventh.
    """
    order = wn.synsets(name, syn.pos())
    return syn in order and order.index(syn) < 3


def is_inflected(name):
    """True when the word is an inflected form of some other word.

    Two mechanisms, because English has two. `morphy` strips the regular endings, which is
    what caught `needs` and `wrapped`. It cannot touch the irregular ones — it returns `felt`
    for `felt` and `saw` for `saw`, since both are also lemmas in their own right (a fabric, a
    tool). Those live in WordNet's exception lists, which map `felt → feel`, `saw → see`,
    `fell → fall`, `went → go`.

    It matters for the sense questions, and it matters in the answer rather than the question:
    "She wrapped her arms around the child — what does `wrapped` mean?" was answered `wind`,
    and "her fingers felt their way" was answered `feel`. The child is shown a past tense and
    offered five infinitives.
    """
    if any(wn.morphy(name, pos) not in (None, name) for pos in 'nvar'):
        return True
    wn.ensure_loaded()
    return any(name in wn._exception_map.get(pos, {}) for pos in 'nvar')


# The British counterpart of an American spelling, or None.
#
# Both books are British and all three bands are calibrated to them, so a module holding both
# spellings will show a child `color` in one question and `colour` in the next — and in the
# spelling types it will mark the spelling they were taught as the mistake. WordNet is
# American, so every pair is in here: all fifteen that were checked by hand.
#
# Written as a GENERATOR of candidates rather than a comparison of pairs. Comparing every word
# with every other word is 19,000 squared and does not finish; asking "what would the British
# spelling of this word be, and is it in the lexicon" is one pass.
#
# Only the unambiguous patterns are here. `practice`/`practise` are both British and mean
# different things, a noun and a verb; `program` and `programme` are both current; and Oxford
# itself prefers `-ize`, so `realize` is not an Americanism. Those three stay as they are.
# Words the patterns would pair up that are not the same word. Seventeen -er/-re pairs come
# out of the rule and sixteen are real (`centre`, `metre`, `theatre`); `timber` is a plank and
# `timbre` is the colour of a sound, and the audit caught it by noticing that a Zipf 2.6 word
# had reached an options line in the youngest band.
_NOT_A_VARIANT = {'timber', 'pier', 'eager', 'mater', 'cater', 'later', 'water', 'gender',
                  'tender', 'render', 'wonder', 'order', 'under', 'over', 'power', 'flower'}

# Only pairs that are the same word in every sense. `check/cheque`, `tire/tyre`, `curb/kerb`,
# `draft/draught` and `story/storey` were here and are not: each American word is ALSO a
# British word with its own meaning (to check, to tire, to curb, a first draft, a story), so
# mapping it to the British spelling printed `cheque` where a question meant `check`.
_ONE_OFF = {
    'gray': 'grey', 'plow': 'plough', 'aluminum': 'aluminium', 'jewelry': 'jewellery',
    'mustache': 'moustache', 'pajamas': 'pyjamas', 'ax': 'axe', 'chili': 'chilli',
    'counselor': 'counsellor', 'counseling': 'counselling',
}

# The endings before which British doubles an `l` that American leaves single.
_DOUBLE_L_ENDINGS = ('ed', 'ing', 'er', 'ers', 'ery', 'ous', 'ist', 'ity', 'en', 'or', 'ors')


def british_candidates(word, known=()):
    out = []
    if word in _ONE_OFF:
        out.append(_ONE_OFF[word])
    for us, uk in (('or', 'our'), ('er', 're'), ('og', 'ogue'), ('e', 'ae')):
        if word.endswith(us) and len(word) > len(us) + 2 and word not in _NOT_A_VARIANT:
            out.append(word[:-len(us)] + uk)
    # -se/-ce is NOT a pattern. It holds for `defense/defence` and breaks for `advise/advice`,
    # `practise/practice`, `devise/device` and `licence/license`, which are pairs of different
    # words — a verb and a noun — and the rule was quietly merging them.
    if word in ('defense', 'offense', 'pretense'):
        out.append(word[:-2] + 'ce')
    # The same `or` inside the word, before an ending: `favorite`, `favorable`, `colorful`,
    # `honorable`, `neighborhood`. The suffix rule only sees it at the end.
    for i in range(2, len(word) - 2):
        if word[i:i + 2] == 'or':
            out.append(word[:i] + 'our' + word[i + 2:])
    # A single `l` where British doubles it before a SUFFIX: traveled/travelled,
    # canceled/cancelled, jeweler/jeweller, modeling/modelling. Before a suffix, not before any
    # vowel — the first version doubled every `l` followed by a vowel, and paired `below` with
    # `bellow`, `filing` with `filling` and `pilar` with `pillar`, so a British question printed
    # `bellow` wherever it meant `below`.
    for i in range(2, len(word) - 1):
        # And the part before the ending has to be a word ending in that `l` — `travel`,
        # `label`, `wool` — or `filing` (file + ing) passes for `travelling` and pairs with
        # `filling`.
        if (word[i] == 'l' and word[i - 1] in 'aeiou' and word[i + 1:] in _DOUBLE_L_ENDINGS
                and word[:i + 1] in known):
            out.append(word[:i + 1] + 'l' + word[i + 1:])
    return out


def safe_synset(s, strict=True):
    """Is this sense safe?

    `strict` decides which of the two questions is being asked. Strict is "may a child READ
    this definition or example", and uses the whole blocklist. Non-strict is "may the word
    this defines EXIST", and forgives the mentionable words — the ones it is fine to meet
    inside a lexicographer's phrasing and not fine to be offered as an answer.
    """
    text = ' '.join([s.definition()] + list(s.examples()))
    if strict:
        return not unsafe(text)
    # Non-strict asks only whether the word's meaning is itself unspeakable, which is what the
    # published profanity lists are for. It used to ask the whole blocklist, and that made the
    # definition scan the accidental authority on which words exist at all — `valley` was
    # absent because its definition says `depression`, and `bra` and `apartheid` were absent
    # for reasons nobody had written down. A word's existence is the lemma blocklist's
    # decision; this is only about meaning nobody can print.
    # Minus the clinical words. `sex` appears in biological definitions constantly — `cattle`
    # is "domesticated bovine animals as a group regardless of sex" — and its presence there
    # says nothing about the word being defined. A word that really is one of these is caught
    # by its own lemma.
    return not _hits(text, PUBLISHED - {'sex', 'sexual', 'sexually', 'breast', 'naked',
                                        'nude', 'virgin', 'strip', 'erotic', 'intercourse'})


def main():
    zipf = {}

    def z(w):
        if w not in zipf:
            zipf[w] = zipf_frequency(w, 'en')
        return zipf[w]

    def common(w):
        """Takes an already-lowercased word; the case test has run on the raw lemma."""
        return (w.isalpha() and MIN_LEN <= len(w) <= MAX_LEN and w not in BLOCKED
                and not is_bare_name(w)
                and z(w) >= MIN_ZIPF)

    # ---- pass 1: the word list, and which senses each word may speak for ----------------
    # `dominant` answers the donkey problem. WordNet's first sense for `donkey` is "the symbol
    # of the Democratic Party", so a category built by taking sense 1 puts donkey under
    # `emblem` and not under `animal` — and the question "which two are not animals" then has
    # a wrong answer. A sense counts as dominant when it is among the word's first two, or
    # when SemCor actually tagged it in running text.
    #
    # The rule has two halves, and the second half was learned the hard way. Ranking senses
    # WITHIN a part of speech is not enough: `sky` has exactly one verb sense ("sky the ball"),
    # so that sense is automatically its verb's first and the gate waved through `sky = toss`.
    # Same for `mount = wax`, `stand = stomach`, `get = stimulate` — in each the second word is
    # speaking a part of speech nobody uses it in. So a sense also has to be in the word's MAIN
    # part of speech, decided by which one SemCor actually tagged most often.
    dominant = defaultdict(set)
    words = {}
    lexname = {}
    WORD_LEX_TMP = lexname
    pos_weight = defaultdict(lambda: defaultdict(int))
    for syn in wn.all_synsets():
        for lem in syn.lemmas():
            if not usable_lemma(lem.name()):
                continue
            pos_weight[lem.name().lower()][syn.pos()] += lem.count()

    def main_pos(name):
        weights = pos_weight[name]
        best = max(weights.values()) if weights else 0
        # Nothing tagged: fall back to WordNet's own ordering, whose first entry is its
        # judgement of the word's primary reading.
        if best == 0:
            first = wn.synsets(name)
            return first[0].pos() if first else None
        return max(weights, key=lambda p: weights[p])

    for syn in wn.all_synsets():
        if not safe_synset(syn, strict=False) or syn.instance_hypernyms():
            continue
        for lem in syn.lemmas():
            if not usable_lemma(lem.name()):
                continue
            name = lem.name().lower()
            if not common(name):
                continue
            words[name] = round(z(name) * 10)
            lexname[name] = lexname.get(name) or syn.lexname()
            order = wn.synsets(name, syn.pos())
            idx = order.index(syn) if syn in order else 99
            # The main part of speech is required in BOTH branches. It used to be required
            # only in the second, and the SemCor escape hatch let `form = spring` through — a
            # synset meaning "come into existence", where `spring` is a verb and everyone under
            # forty means the season. A blind test picked it out as the one synonym question
            # with no defensible answer.
            if syn.pos() == main_pos(name) and (lem.count() >= 1 or idx < 2):
                dominant[name].add(syn.name())

    # ---- pass 2: synonym sets ------------------------------------------------------------
    # The dominant-sense gate from above is what makes this list usable. Without it the pairs
    # read like a crossword setter's notebook, because WordNet knows every sense a word has
    # ever had: `man = piece` (chess), `pan = trash` (to criticise), `enter = figure` (to
    # figure in), `back = stake`. Every one of those is a rare sense of a common word, and a
    # child asked to match them is not being tested on vocabulary but on trivia. Requiring
    # BOTH words to be speaking their own main sense removes the whole class.
    # Relations read the LENIENT scan, because none of them shows the child a definition.
    #
    # The strict one was costing basic pairs and nobody had noticed: `hot/cold` is absent from
    # this lexicon because WordNet's definition of `cold` ends "...by e.g. ice or
    # refrigeration; dead", and `dead` is blocked. That is the `valley` mistake again — a scan
    # over text the child never sees deciding what the child may be asked — fixed there for
    # whether a word EXISTS and left here for what it may be related to.
    synsets = []
    for syn in wn.all_synsets():
        if not safe_synset(syn, strict=False):
            continue
        names = sorted({l.name().lower() for l in syn.lemmas()
                        if common(l.name().lower()) and syn.name() in dominant[l.name().lower()]})
        names = [n for n in names if not any(spelling_variant(n, m) for m in names if m < n)]
        if len(names) >= 2:
            synsets.append([syn.pos(), names])

    # ---- pass 3: antonyms ----------------------------------------------------------------
    # WordNet's antonyms hang off LEMMAS, not synsets, which is right: `early/late` is a fact
    # about those two words, and the sets around them are not opposites of each other.
    antonyms = set()
    for syn in wn.all_synsets():
        if not safe_synset(syn, strict=False):
            continue
        for lem in syn.lemmas():
            a = lem.name().lower()
            if not common(a) or not near_the_front(a, syn):
                continue
            for other in lem.antonyms():
                b = other.name().lower()
                if not common(b) or not near_the_front(b, other.synset()):
                    continue
                if not safe_synset(other.synset(), strict=False):
                    continue
                # Both words near the front of their own part of speech, which the synonym
                # sets have required since `man = piece` and this list never did. A blind round
                # asked for the opposite of `clear` and answered `bounce` — a real relation in
                # WordNet between senses of both words that nobody uses.
                antonyms.add((a, b, syn.pos()) if a < b else (b, a, syn.pos()))

    # ---- pass 4: categories ---------------------------------------------------------------
    # One entry per hypernym that has enough common, dominant members to build a question:
    # three for the correct group plus two outsiders is the book's five-option line, so five
    # members is the floor and more is better.
    # Categories use a STRICTER sense gate than everything else: the word's very first sense,
    # not merely one of its first two. The looser rule put `stunt` among the animals (WordNet's
    # second sense of it is "a dwarfed plant or animal"), `ministry` and `architecture` among
    # the buildings, `instrument` among the assistants. Elsewhere a second-sense word is a
    # harmless distractor; in a category question it is the wrong answer marked right.
    def primary(name, syn):
        first = wn.synsets(name)
        return bool(first) and first[0] == syn

    cats = defaultdict(set)
    for syn in wn.all_synsets('n'):
        if not safe_synset(syn, strict=False):
            continue
        # No inflected forms. This is the `murphy` problem wearing a plural: `bones` is a
        # percussion instrument in WordNet and a skeleton to everyone else, `vibes` is a
        # vibraphone and slang, `organs` is an instrument and a body. Each one carries a
        # frequency earned by the sense the category is NOT about, and each landed in an
        # odd-two line where a child could not see the group — `vibes / drum / bones` against
        # `prosecutor / judge`. The primary-sense gate cannot catch them because the plural is
        # its own lemma and the instrument really is its first sense.
        names = {l.name().lower() for l in syn.lemmas()
                 if usable_lemma(l.name()) and common(l.name().lower())
                 and primary(l.name().lower(), syn) and not is_inflected(l.name().lower())
                 and l.name().lower() not in SKIP_MEMBERS}
        if not names:
            continue
        for hyper in syn.hypernyms():
            if not safe_synset(hyper, strict=False):
                continue
            cats[hyper.name()] |= names

    # A category only counts when a nine-year-old could name the thing it groups. WordNet's
    # hypernym tree is mostly not that: `measure / step / parking`, `dam / fence / rail`,
    # `arch / meter / gauge` are all real groups and all invisible. The first build asked a
    # child to spot the odd two among them.
    #
    # The filter is ancestry, not a list of groups: a category is kept when it sits under one
    # of the roots below — things with legs, things you eat, things you wear, things you play.
    # `corvine bird` is not in this list and does not need to be; it is under `animal`.
    ROOTS = [
        'animal.n.01', 'plant.n.02', 'food.n.01', 'food.n.02', 'vehicle.n.01', 'clothing.n.01',
        'furniture.n.01', 'tool.n.01', 'building.n.01', 'body_part.n.01', 'worker.n.01',
        'sport.n.01', 'color.n.01', 'musical_instrument.n.01', 'container.n.01', 'fruit.n.01',
        'vegetable.n.01', 'bird.n.01', 'fish.n.01', 'insect.n.01', 'game.n.01', 'toy.n.01',
        'dwelling.n.01', 'tableware.n.01', 'footwear.n.01', 'headdress.n.01', 'weather.n.01',
        'natural_elevation.n.01', 'body_of_water.n.01', 'tree.n.01', 'flower.n.01',
    ]
    allowed = set()
    root_of = {}
    for r in ROOTS:
        root = wn.synset(r)
        allowed.add(root.name())
        root_of[root.name()] = r.split('.')[0].replace('_', ' ')
        for d in root.closure(lambda x: x.hyponyms()):
            allowed.add(d.name())
            root_of.setdefault(d.name(), r.split('.')[0].replace('_', ' '))

    categories = []
    for key, members in sorted(cats.items()):
        if len(members) < 5 or key not in allowed or key in SKIP_GROUPS:
            continue
        label = key.split('.')[0].replace('_', ' ')
        if unsafe(label) or unsafe(key):
            continue
        categories.append([key, label, sorted(members), root_of.get(key, '')])

    # ---- pass 5: senses --------------------------------------------------------------------
    # The book's most-asked question ("What does 'bear' mean as used in this sentence?") wants
    # three things at once: a sentence using the word, the synonyms of THAT sense (the answer),
    # and the synonyms of its other senses (the distractors). One WordNet entry carries all
    # three, which is why this type needs no hand-written content at all.
    senses = {}
    for name in sorted(words):
        # The word has to be a BASE form. WordNet's examples quote a word however the sentence
        # needs it, and a question built on an inflected quote goes wrong in the answer rather
        # than in the question: "She wrapped her arms around the child — what does `wrapped`
        # mean?" was answered `wind`, because the synset's lemmas are base forms and `wound` is
        # not one of them. The child is asked about a past tense and offered five infinitives.
        if is_inflected(name):
            continue
        rows = []
        for syn in wn.synsets(name):
            if not safe_synset(syn):
                continue
            # The same readability gate EXAMPLES uses. It was missing here, and the audit
            # found it: a sense question is mostly its sentence, so an unreadable sentence
            # is an unreadable question even when all five options are common words.
            ex = [e for e in syn.examples()
                  if re.search(r'\b' + re.escape(name) + r'\b', e, re.I)
                  and 4 <= len(e.split()) <= 16
                  and not grown_up_scene(e)
                  and has_something_to_picture(e, lexname)
                  and not any(zipf_frequency(tok, 'en') < 3.4
                              for tok in re.findall(r"[a-z']+", e.lower()) if len(tok) > 2)]
            if not ex:
                continue
            # A word's own base form is not a meaning of it. `won → win`, `saw → see`,
            # `shook → shake` all came out of this type, and the engine's spelling-based check
            # cannot see them: no shared prefix, no shared ending, nothing but English's
            # irregular verbs. WordNet's morphy knows, so ask it.
            def same_word(other):
                bases = {wn.morphy(name, pos) for pos in 'nvar'} | {name}
                others = {wn.morphy(other, pos) for pos in 'nvar'} | {other}
                return bool((bases & others) - {None})

            sibs = sorted({l.name().lower() for l in syn.lemmas()
                           if usable_lemma(l.name()) and common(l.name().lower())
                           and l.name().lower() != name and not same_word(l.name().lower())})
            if not sibs:
                continue
            rows.append([syn.pos(), ex[0], sibs, syn.definition(), syn.name()])

        # Which of a word's senses are FAR ENOUGH APART to be each other's distractors.
        #
        # This is the correction the browser found. The type was built so that the wrong
        # options are other senses of the same word — the child has to read the sentence, not
        # the word. It is a good idea and it was producing questions with two right answers:
        # asked what `protection` means in "a sense of peace and protection in his new home",
        # the answer was `shelter` and one wrong option was `security`. Both are right.
        #
        # The book does not have this problem because it does not do this: its distractors for
        # `bear` in "could not bear to be too hot" are `sit, run, find, make` — ordinary words,
        # none of them a sense of `bear` at all. The sentence is there to pin which sense is
        # meant; the options test whether the child found it.
        #
        # So the type keeps its teeth and loses the ambiguity: another sense may supply a
        # distractor only when WordNet puts real distance between the two. Different parts of
        # speech are far by definition; within one, Wu-Palmer similarity below 0.4 is the line
        # — `corner` the predicament and `corner` the nook are 0.23 apart, `protection` the
        # shelter and `protection` the security are 0.86.
        # Computed for every row before any row is rewritten: row[4] holds the synset name on
        # the way in and the `far` list on the way out, and mutating in place mid-loop made the
        # second row read the first one's answer instead of its synset.
        keys = [row[4] for row in rows]
        far_lists = []
        for i, key in enumerate(keys):
            far = []
            a = wn.synset(key)
            for j, other_key in enumerate(keys):
                if i == j:
                    continue
                b = wn.synset(other_key)
                if a.pos() != b.pos():
                    far.append(j)
                    continue
                try:
                    sim = a.wup_similarity(b) or 0
                except Exception:
                    sim = 0
                if sim < 0.4:
                    far.append(j)
            far_lists.append(far)
        for row, far in zip(rows, far_lists):
            row[4] = far
        # Two senses is the minimum a question of this kind can be built from: one to ask
        # about and one to be wrong with.
        if len(rows) >= 2:
            senses[name] = rows

    # ---- pass 6: one example sentence per word ---------------------------------------------
    # For the types that hide letters inside a word ("We had fun in the ___chen when we iced
    # cakes"): the child needs a sentence to know which word is meant. WordNet's examples are
    # written to illustrate a sense, so many are fragments ("able to swim") — a fragment is
    # useless here, and the filter below is what separates them: a real sentence, long enough
    # to carry a context, with the word in it whole.
    examples = {}
    for name in sorted(words):
        best = None
        for syn in wn.synsets(name):
            if not safe_synset(syn):
                continue
            if syn.name() not in dominant[name]:
                continue
            for ex in syn.examples():
                if not re.search(r'\b' + re.escape(name) + r'\b', ex, re.I):
                    continue
                if not (5 <= len(ex.split()) <= 14) or len(ex) > 80:
                    continue
                if grown_up_scene(ex) or not has_something_to_picture(ex, lexname):
                    continue
                # The sentence is read by a nine-year-old, so it is held to the same
                # vocabulary bar as everything else. WordNet's examples are written for
                # lexicographers and it shows: "a mechanism of social control", "a
                # generation for that prejudice to fade". Every word in the sentence has to
                # be one the child could read.
                if any(zipf_frequency(t, 'en') < 3.4
                       for t in re.findall(r"[a-z']+", ex.lower()) if len(t) > 2):
                    continue
                # A sentence naming the word twice, or one that is itself a definition
                # ("a kitchen is where..."), reads as a riddle about itself.
                if len(re.findall(r'\b' + re.escape(name) + r'\b', ex, re.I)) > 1:
                    continue
                if best is None or len(ex) < len(best):
                    best = ex
        if best:
            examples[name] = best

    # ---- pass 7: the ungated synonym relation, for validation only -------------------------
    # SYNSETS above is dominance-gated, because a question built from a rare sense is a bad
    # question. But the CHECK that a question has only one answer must see every sense there
    # is — and the difference is not theoretical. A sense item asked what `catch` means in
    # "Did you catch the thief?", answered `get`, and offered `grab` as a wrong option. The two
    # share a sense WordNet ranks low for both, so the gated index could not see it, and the
    # item shipped with two right answers.
    kin = defaultdict(set)
    for syn in wn.all_synsets():
        if not safe_synset(syn, strict=False):
            continue
        names = [l.name().lower() for l in syn.lemmas()
                 if usable_lemma(l.name()) and common(l.name().lower())]
        for a in names:
            for b in names:
                if a != b:
                    kin[a].add(b)
    kinship = {k: sorted(v) for k, v in sorted(kin.items())}

    # ---- pass 8: pronunciation, in two varieties ---------------------------------------------
    # Three types ask how a word SOUNDS — rhyme, homophone and syllables — and their answers
    # are not the same on both sides of the Atlantic. `calm` rhymes with `arm` in British and
    # not in American; `flaw` and `floor` are homophones in British, `pore` and `pour` in both,
    # `oar` and `ore` only in American. Measured over this lexicon: 880 words (5%) have a
    # different rhyme, and there are 49 homophone groups British has that American does not,
    # against 9 the other way.
    #
    # So the pronunciation is stored twice and a question is generated for one variety. Which
    # one is a setting, not a fact about the module.
    #
    # Read from two IPA dictionaries rather than from CMUdict plus a rule, and that replacement
    # fixed a real defect rather than adding a feature. CMUdict is American and American merged
    # the vowels of `hot` and `calm` into one symbol; reading it non-rhotically to reach British
    # then made `heart` and `hot` identical. The lexicon was offering `heart/hot`, `carp/cop`
    # and `darn/don` as homophones, which they are in no dialect. The distinction is not in an
    # American dictionary, so no transformation of one can recover it.
    def load_ipa(path):
        out = {}
        for line in path.read_text(encoding='utf-8').splitlines():
            if '\t' not in line:
                continue
            word, prons = line.split('\t', 1)
            word = word.lower()
            if word.isalpha():
                out[word] = [x.strip().strip('/') for x in prons.split(',') if x.strip()]
        return out

    IPA = {'uk': load_ipa(VENDOR / 'ipa-en_UK.txt'), 'us': load_ipa(VENDOR / 'ipa-en_US.txt')}

    # IPA marks stress with a mark BEFORE the syllable rather than on the vowel, so a syllable
    # is counted by its vowel and the rhyme runs from the last stressed one.
    # Read off the two dictionaries rather than guessed at — every symbol either of them uses,
    # sorted into vowels and not. Guessing cost two things: `ɝ`, the r-coloured vowel of
    # American `bird` and `holder`, was missing although it occurs 29,132 times, so `holder`
    # counted as one syllable; and `ː`, which is a length mark and not a vowel at all, was in.
    VOWELS = set('ɪəiɛʊæɑaeoɔuɐɒʌɜɝ')
    STRESS = 'ˈˌ'

    def strip_marks(p):
        return ''.join(ch for ch in p if ch not in STRESS)

    # The diphthongs, which are written as two vowel letters and are one syllable. Everything
    # else adjacent is two.
    #
    # Collapsing every run of vowel letters was the first version and it counted `casual`
    # /ˈkæʒuəl/ as two syllables: `uə` is not a diphthong, it is a hiatus — ca-su-al. A blind
    # round caught it by finding two two-syllable options on the same line. `radio`, `create`,
    # `science`, `quiet` and `poem` all break the same way.
    #
    # `ɪə` was in this set and `iə` was not, which is backwards for the UK dictionary, and the
    # set could not be shared at all. An outside re-audit reported `nefarious` as three
    # syllables and this is what was under it. The two dictionaries use different SYSTEMS, and
    # the raw entries say so plainly:
    #
    #   here    UK /hˈiə/      US /ˈhiɹ/
    #   beard   UK /bˈiəd/     US /ˈbɪɹd/
    #   square  UK /skwˈeə/    US /ˈskwɛɹ/
    #   obvious UK /ˈɒbvɪəs/   US /ˈɑbviəs/
    #
    # British English has centring diphthongs and writes them `iə`, `eə`, `ʊə`. General
    # American has none — they are a vowel plus `ɹ` — so in that dictionary those same letter
    # pairs are ALWAYS two syllables, and `-ious` is written `iəs` where the UK writes `ɪəs`.
    # One shared set had to be wrong for one of them whichever way round it was written.
    DIPHTHONGS = {
        'uk': {'aɪ', 'aʊ', 'eɪ', 'ɔɪ', 'əʊ', 'iə', 'eə', 'ʊə', 'ɛə', 'ɑɪ', 'ɔə'},
        # No centring diphthongs, on purpose. Adding them back makes `nefarious` three.
        'us': {'aɪ', 'aʊ', 'eɪ', 'oʊ', 'ɔɪ', 'ɑɪ'},
    }

    def syllable_count(p, variety):
        bare = strip_marks(p).replace('ː', '')
        diph = DIPHTHONGS[variety]
        n, i = 0, 0
        while i < len(bare):
            if bare[i] not in VOWELS:
                i += 1
                continue
            if i + 1 < len(bare) and bare[i:i + 2] in diph:
                n += 1
                i += 2
            else:
                n += 1
                i += 1
        return max(1, n)

    def rime_of(p):
        """From the last stressed vowel to the end."""
        marks = [i for i, ch in enumerate(p) if ch in STRESS]
        for start_at in reversed(marks):
            tail = strip_marks(p[start_at:])
            for i, ch in enumerate(tail):
                if ch in VOWELS:
                    return tail[i:]
        bare = strip_marks(p)
        for i, ch in enumerate(bare):
            if ch in VOWELS:
                return bare[i:]
        return bare

    rimes = {'uk': {}, 'us': {}}
    syllables = {'uk': {}, 'us': {}}
    sound_key = {'uk': {}, 'us': {}}
    for variety, table in IPA.items():
        for w in sorted(words):
            ps = table.get(w)
            if not ps:
                continue
            rimes[variety][w] = sorted({rime_of(p) for p in ps})
            syllables[variety][w] = min(syllable_count(p, variety) for p in ps)
            sound_key[variety][w] = sorted({strip_marks(p) for p in ps})

    # The two dictionaries now check each other, and a word only keeps a syllable count when
    # they agree on it.
    #
    # This is here because of a specific criticism, and it is a fair one: the audit script
    # reads the same generated table the generator does, so it can confirm that a question is
    # consistent with the table and can never tell that the TABLE is wrong. `nefarious` counted
    # as three passed every check there is. Nothing inside one dictionary can catch that.
    # Two independently compiled dictionaries can, and where they part company the honest
    # answer is not to ask the question at all.
    #
    # It removes the genuinely uncertain, not the merely hard: `idea` and `area` (UK 2, US 3),
    # `casual` (3 / 2) and `aspiring` (4 / 3) all go, and each is a word people really do say
    # both ways. `here`, `beard`, `career`, `nefarious`, `obvious` and `mysterious` all stay,
    # because both books agree on them.
    sure = {w for w in syllables['uk'] if syllables['us'].get(w) == syllables['uk'][w]}
    dropped = {v: len(t) - len(sure & set(t)) for v, t in syllables.items()}
    for variety in syllables:
        syllables[variety] = {w: n for w, n in syllables[variety].items() if w in sure}
    print(f"syllables: kept {len(sure)} words both dictionaries agree on; "
          f"dropped uk {dropped['uk']}, us {dropped['us']}")

    rhyme_groups = {}
    homophones = {}
    for variety in IPA:
        by_rime = defaultdict(set)
        for w, ks in rimes[variety].items():
            for k in ks:
                by_rime[k].add(w)
        rhyme_groups[variety] = {k: sorted(v) for k, v in by_rime.items() if len(v) >= 3}

        by_sound = defaultdict(set)
        for w, ks in sound_key[variety].items():
            for k in ks:
                by_sound[k].add(w)
        # Homophones only count when the spellings differ and are not the same word twice.
        homophones[variety] = [sorted(v) for v in by_sound.values()
                               if len(v) >= 2
                               and not any(spelling_variant(a, b) for a in v for b in v if a < b)]

    # ---- pass 9: word formation --------------------------------------------------------------
    # Suffixes, prefixes and roots — the 9-10 book's "add the suffix ful", the 11-12 book's
    # "write an antonym by adding a prefix" and "write the root word of each of these".
    #
    # WordNet's derivationally_related_forms is the source and it is a good one: 15,887 pairs,
    # each asserted by a lexicographer rather than guessed from spelling. The spelling change is
    # what makes the question — `beauty` + `ful` is `beautiful`, not `beautyful` — so a pair is
    # only kept when the derived word is NOT simply base + suffix.
    # Verbs where the regular past is ALSO correct, so there is no single right answer.
    #
    # A frequency threshold cannot find these and two blind rounds proved it: `sneaked` scores
    # 2.84 and `speeded` 2.37 — rarer than their irregular twins and perfectly standard
    # English — while `learned` scores 4.85. Any bar that catches the first two throws away
    # verbs nobody would argue about. The set is finite, so it is written down.
    #
    # Most are the British -t / -ed pairs (`learnt/learned`, `dreamt/dreamed`), a few are an
    # Atlantic split (`dived/dove`, `sneaked/snuck`), and `hang` is on the list for a different
    # reason: `hung` and `hanged` are both correct and mean different things.
    BOTH_FORMS = {
        'burn', 'dive', 'dream', 'dwell', 'fit', 'hang', 'kneel', 'knit', 'lean', 'leap',
        'learn', 'light', 'plead', 'prove', 'shine', 'shred', 'smell', 'sneak', 'speed',
        'spell', 'spill', 'spoil', 'stave', 'strive', 'sweat', 'thrive', 'wake', 'weave', 'wet',
    }

    # Longest/specific endings must come first. Without `ial`, `office -> official`,
    # `face -> facial` and six similar records matched the shorter `al` and told the child to
    # add the wrong suffix even though the derived spelling happened to be right.
    SUFFIXES = ['ful', 'ous', 'ness', 'ment', 'able', 'ible', 'less', 'tion', 'sion',
                'ity', 'ance', 'ence', 'ive', 'ial', 'al', 'ist', 'er', 'or', 'ly', 'ish', 'y']
    PREFIXES = ['un', 'in', 'im', 'il', 'ir', 'dis', 'non', 'mis', 're', 'pre', 'over',
                'under', 'sub', 'super', 'anti', 'inter', 'micro', 'trans', 'semi', 'co']

    deriv = set()
    for syn in wn.all_synsets():
        if not safe_synset(syn, strict=False):
            continue
        for lem in syn.lemmas():
            for other in lem.derivationally_related_forms():
                a, b = lem.name().lower(), other.name().lower()
                if usable_lemma(lem.name()) and usable_lemma(other.name()) and a != b:
                    deriv.add((a, b) if a < b else (b, a))

    suffixed = []
    for a, b in sorted(deriv):
        for base, derived in ((a, b), (b, a)):
            if not (common(base) and common(derived)) or len(derived) <= len(base):
                continue
            for suf in SUFFIXES:
                if not derived.endswith(suf):
                    continue
                stem = derived[:-len(suf)]
                # base itself, base minus a silent e, or base with y -> i
                if stem in (base, base[:-1], base[:-1] + 'i') or (base.endswith('y') and stem == base[:-1] + 'i'):
                    # Report the suffix the CHILD would be told to add, not the one this loop
                    # happened to match on. `act` + `ion` is `action`; the loop matched `tion`
                    # because `act` minus its last letter is `ac`, and the question would have
                    # read "add the suffix tion to act".
                    # Whatever letters actually follow the base, whether or not they are on
                    # the SUFFIXES list: `act` + `ion` is `action`, and looking `ion` up in a
                    # list that only knows `tion` produced the question "add the suffix tion
                    # to act".
                    added = derived[len(base):] if derived.startswith(base) else suf
                    suffixed.append([base, derived, added or suf])
                    break

    # Prefixed pairs are taken from the ANTONYM relation, not from spelling. Spelling alone
    # says `comedian` is `co` + `median` and `reach` is `re` + `ach`; it has no way to know
    # otherwise. What the 11-12 book actually asks — "write an antonym for each of these words
    # by adding a prefix" — is a question about `possible/impossible` and `agree/disagree`,
    # which is the antonym list filtered to pairs where one word contains the other.
    NEGATIVE = ['un', 'in', 'im', 'il', 'ir', 'dis', 'non', 'mis', 'anti']
    prefixed = []
    for a, b, _pos in sorted(antonyms):
        for stem, whole in ((a, b), (b, a)):
            if not whole.endswith(stem) or len(whole) <= len(stem):
                continue
            pre = whole[:-len(stem)]
            if pre in NEGATIVE and common(stem) and common(whole):
                prefixed.append([stem, whole, pre])
                break

    # ---- pass 10: inflections -----------------------------------------------------------------
    # Plurals and past tenses that a spelling rule gets wrong — which is the only kind worth
    # asking about. `cats` teaches nothing; `wolf -> wolves`, `mouse -> mice`, `potato ->
    # potatoes` and `run -> ran` do.
    wn.ensure_loaded()

    # Plurals, and the point is the RULE rather than the word.
    #
    # The first version took only WordNet's irregular list, which meant 19 of the 27 plurals
    # the two books actually ask were unaskable — `baby`, `church`, `valley`, `roof`, `fly`,
    # `lady`, `donkey`. Those are not irregular; they are where the rules live, and the books
    # teach them by pairing a rule against its neighbour: `baby -> babies` beside
    # `valley -> valleys` (consonant + y against vowel + y), `thief -> thieves` beside
    # `roof -> roofs`. A list of exceptions cannot pose either pair.
    #
    # So each entry carries which rule it follows, and the generator builds its wrong answers
    # by applying the OTHER rules — which is exactly the mistake the question is about.
    #
    # Latin and Greek plurals are marked separately and held back to the oldest band, because
    # that is where the books put them: the 9-10 paper asks `thief` and `church`, and
    # `campus`, `radius` and `criterion` do not appear until 11-12.
    LATIN_TAIL = ('um', 'us', 'a', 'ex', 'ix', 'is', 'on')
    # A plain terminal `s` is left out on purpose: almost every word that ends in one is
    # already a plural, and the ones that are not end in `ss`, `us` or `is` (`class`, `bus`,
    # `iris`). Including it pluralised `affairs`, `alms`, `annals` and `arrears`.
    SIBILANT = ('ss', 'us', 'is', 'x', 'z', 'ch', 'sh')

    plurals = []
    seen_singular = set()
    for plural, singulars in sorted(wn._exception_map['n'].items()):
        if not (plural.isalpha() and singulars):
            continue
        sing = singulars[0].lower()
        if not (common(sing) and 3 <= len(plural) <= 12 and plural not in BLOCKED):
            continue
        if plural == sing or plural == sing + 's' or zipf_frequency(plural, 'en') < 3.0:
            continue
        if plural.endswith('ing'):
            continue
        # A Latin or Greek plural is only a question when English has not adopted an -s form
        # beside it. `formulas`, `indexes` and `antennas` are ordinary written English, so
        # `formula -> formulae` has two right answers; `thesises` and `crisises` are not words
        # at all, so `thesis -> theses` has one.
        # The irregular plural has to be THE plural, not merely A plural. `duo -> dui` shipped
        # with `duos` offered as the mistake, and `duos` is what everybody writes; the Latin
        # tails do not catch it because `duo` has none.
        #
        # Comparing the two frequencies rather than putting a floor under the regular one is
        # what makes this safe. A plain floor would take `child -> children` with it: `childs`
        # scores 3.17, all of it possessive apostrophes lost in tokenising. `children` beats it
        # by two and a half, while `dui` loses to `duos` outright.
        regular = sing + ('es' if sing.endswith(('s', 'x', 'z', 'ch', 'sh')) else 's')
        if zipf_frequency(plural, 'en') <= zipf_frequency(regular, 'en') + 0.5:
            continue
        # Frequency alone cannot finish the job, because the "plural" is sometimes a common
        # word of its own. `dui` scores 3.35 on the drink-driving acronym and beats `duos`;
        # `dive` scores 4.12 as the verb and beats `divas`. Two more tests, one for each shape:
        #
        #   the plural is its own lemma       `dive` is in WordNet as a verb, `children` is
        #                                     not in it at all — morphy only maps it to `child`
        #   the regular is current and the    `duos` is written and `dui` is not dominant;
        #   irregular is not dominant         `childs` is written too, all of it possessives
        #                                     lost in tokenising, but `children` is enormous
        #   the plural's FIRST sense is not     `dive` is in WordNet as the plural of `diva`
        #   the singular's                      and its first sense is a headlong plunge;
        #                                       `teeth` is a lemma too and its first sense is
        #                                       `tooth`, which is why asking merely whether it
        #                                       is a lemma threw `tooth -> teeth` away
        #   the regular is current and the      `duos` is written and `dui` is not dominant.
        #   irregular is not dominant           The bar sits at 2.5 rather than 2.0 because
        #                                       `knifes` scores 2.17 on the verb and was
        #                                       costing us `knife -> knives`
        # Within the plural form's first two senses, not merely its first. `teeth` is a lemma
        # in its own right — its first sense is `dentition`, the arrangement of them — and
        # demanding the very first threw `tooth -> teeth` and `fungus -> fungi` away. The
        # singular ranks first or second in both. In `dive` it ranks fourth, behind a dive bar
        # and two kinds of plunge, which is the difference the test is for.
        plural_senses = wn.synsets(plural)
        singular_senses = set(wn.synsets(sing))
        if plural_senses and not any(x in singular_senses for x in plural_senses[:2]):
            continue
        if zipf_frequency(regular, 'en') >= 2.5 and zipf_frequency(plural, 'en') < 4.0:
            continue
        latin = sing.endswith(LATIN_TAIL)
        plurals.append([sing, plural, 'latin' if latin else 'irregular'])
        seen_singular.add(sing)

    # The rules, generated rather than looked up — they have no exceptions in either direction.
    for w in sorted(words):
        if w in seen_singular or not (3 <= len(w) <= 11) or w in BLOCKED:
            continue
        if not (WORD_LEX_TMP.get(w) or '').startswith('noun.'):
            continue
        # The word has to be a SINGULAR. Without this the -es rule fires on every word ending
        # in `s`, which is every plural already in the lexicon: `rails -> railses`,
        # `roots -> rootses`, `scores -> scoreses`. Two tests, because two kinds slip through.
        # morphy catches the ordinary plurals; the plural-only nouns it does not — `genetics`,
        # `semantics`, `premises`, `manners` are all their own singular as far as it knows, and
        # all of them are `genetic`, `semantic`, `premise`, `manner` plus an s.
        if is_inflected(w):
            continue
        if w.endswith('s') and (w[:-1] in words or w[:-2] in words):
            continue
        # Every generated plural has to be a form people actually write. The rules apply
        # cleanly to mass nouns and produce words nobody says: `electricities`,
        # `machineries`, `geologies`, `publicities`.
        def used(form):
            return zipf_frequency(form, 'en') >= 2.0

        if w.endswith('y') and w[-2] not in 'aeiou' and used(w[:-1] + 'ies'):
            plurals.append([w, w[:-1] + 'ies', 'ies'])
        elif w.endswith(('ey', 'ay', 'oy')):
            # The neighbour that makes the -ies rule a question rather than a reflex: the book
            # asks `baby` and `valley` in the same list.
            if used(w + 's'):
                plurals.append([w, w + 's', 's-after-vowel'])
        elif w.endswith(SIBILANT) and used(w + 'es'):
            plurals.append([w, w + 'es', 'es'])
        elif w.endswith(('f', 'fe')) and zipf_frequency(
                (w[:-1] if w.endswith('f') else w[:-2]) + 'ves', 'en') < 2.5:
            # `roof -> roofs`, `chief -> chiefs`, `belief -> beliefs`. Assuming that anything
            # missing from WordNet's exception list takes a plain -s is not safe — it does not
            # hold `loaf`, and the first build answered `loaf -> loafs` with `loaves` sitting
            # there as the mistake. The -ves form has to be checked for, not assumed absent.
            if used(w + 's'):
                plurals.append([w, w + 's', 's-after-f'])
        elif (w.endswith('o') and not w.endswith(('oo', 'io')) and used(w + 's')
              and zipf_frequency(w + 'es', 'en') < 2.5):
            # The same check the -f branch makes, and for the same reason. `cargo -> cargos`
            # shipped with `cargoes` as the mistake; both are standard and Oxford prefers the
            # one being marked wrong.
            # `piano -> pianos` against `potato -> potatoes`, the other pair the books use.
            # -oo and -io never take -oes (`radio`, `zoo`), so they are not a question.
            plurals.append([w, w + 's', 's-after-o'])

    pasts = []
    # WordNet's verb exceptions mix past tense with past participle and do not say which is
    # which: `ring` gets `rang` and `rung`, `eat` gets `ate` and `eaten`. The question asks for
    # the past tense, so the participle is a wrong answer dressed as the right one — and the
    # first build shipped `ring -> rung`.
    #
    # Where a verb has two forms, two patterns separate them and nothing else is guessed at:
    # the participle ends in -en (`eaten`, `written`), or the strong-verb vowel splits a for
    # the past against u for the participle (`sang/sung`, `drank/drunk`, `rang/rung`). A verb
    # whose two forms fit neither pattern is left out rather than guessed.
    by_base = defaultdict(list)
    for form, bases in wn._exception_map['v'].items():
        if form.isalpha() and bases and not form.endswith('ing'):
            by_base[bases[0].lower()].append(form)

    def past_tense_of(base, forms):
        if len(forms) == 1:
            return forms[0]
        if len(forms) == 2:
            en = [f for f in forms if f.endswith('en')]
            if len(en) == 1:
                return [f for f in forms if f not in en][0]
            if 'i' in base:
                a = [f for f in forms if 'a' in f]
                u = [f for f in forms if 'u' in f]
                if len(a) == 1 and len(u) == 1:
                    return a[0]
        return None

    pasts = []
    for base, forms in sorted(by_base.items()):
        form = past_tense_of(base, sorted(forms))
        if not form:
            continue
        if not (common(base) and form not in BLOCKED and 3 <= len(form) <= 12):
            continue
        if form in (base, base + 'ed') or zipf_frequency(form, 'en') < 3.2:
            continue
        # Verbs where the regular form is ALSO correct are not questions, they are traps with
        # two right answers. English has a pile of them, some of them an Atlantic split
        # (`dived`/`dove`) and some just optional (`learned`/`learnt`, `dreamed`/`dreamt`,
        # `spelled`/`spelt`). The first build offered `dive -> dove` with `dived` as a mistake.
        # If the -ed form is common in running text, the irregular one is not the only answer.
        regular = (base + 'd') if base.endswith('e') else (base + 'ed')
        if zipf_frequency(regular, 'en') >= 3.4 or base in BOTH_FORMS:
            continue
        pasts.append([base, form])

    # ---- pass 11: definitions ------------------------------------------------------------------
    # "Write one word for each definition." WordNet is a dictionary; this is the one type where
    # that is the whole answer. Kept short and screened like every other string here.
    definitions = {}
    for name in sorted(words):
        if z(name) < 3.6:
            continue
        best = None
        # The word's FIRST sense, not merely a dominant one. A definition question puts the
        # definition on the page and asks for the word, so a secondary reading reads as a
        # riddle: "a sustained bass note" is `pedal`, "the intended meaning of a
        # communication" is `spirit`, and neither is what the child knows the word to be.
        first = wn.synsets(name)
        for syn in first[:1]:
            if not safe_synset(syn):
                continue
            d = syn.definition()
            if not (4 <= len(d.split()) <= 14) or ';' in d or '(' in d:
                continue
            if grown_up_scene(d) or re.search(r'\b' + re.escape(name) + r'\b', d, re.I):
                continue
            if any(zipf_frequency(t, 'en') < 3.2 for t in re.findall(r"[a-z']+", d.lower()) if len(t) > 2):
                continue
            if best is None or len(d) < len(best):
                best = d
        if best:
            # Whether a child in the youngest band can READ it, decided here rather than in the
            # engine. The engine can only ask whether a word is in the lexicon, and answering
            # "not in it, so wave it through" is backwards: `larvae` is not a lemma and it is
            # not easy. Here the frequency of every word is available.
            young = all(
                len(t) <= 3 or t in DALE_CHALL or zipf_frequency(t, 'en') >= 4.2
                for t in re.findall(r"[a-z']+", best.lower()))
            definitions[name] = [best, 1 if young else 0]

    # ---- pass 12: the two spellings, both kept -----------------------------------------------
    # An earlier build DELETED the American spellings, on the grounds that all three books are
    # British. That is right about the books and wrong about the children: a child in the
    # United States writes `color`, and a module that only knows `colour` marks them wrong in
    # exactly the types where spelling IS the answer.
    #
    # So both stay and the choice moves to generation time, beside the pronunciation. What the
    # lexicon records is which is which, so a question can be built in one variety and never
    # show the other — the failure to avoid is not picking the wrong spelling, it is putting
    # `color` in one question and `colour` in the next.
    spelling = {}
    for w in sorted(words):
        for other in british_candidates(w, words):
            if other in words:
                spelling[w] = {'us': w, 'uk': other}
                spelling[other] = {'us': w, 'uk': other}
                break

    meta = {
        'built': datetime.date.today().isoformat(),
        'wordnet': str(wn.get_version() or '3.0'),
        'min_zipf': MIN_ZIPF,
        'counts': {
            'words': len(words), 'synsets': len(synsets), 'antonyms': len(antonyms),
            'categories': len(categories), 'senses': len(senses),
            'examples': len(examples),
            'kinship': len(kinship),
            'blocklist': len(BLOCKED),
            'blocklist_published': len(PUBLISHED),
            'blocklist_handwritten': len(load_words(BLOCK)),
            'sentence_topics': len(SENTENCE_TOPICS),
            'category_skips': len(_CAT_SKIP),
            'rhyme_groups': {v: len(g) for v, g in rhyme_groups.items()},
            'homophones': {v: len(g) for v, g in homophones.items()},
            'syllables': {v: len(g) for v, g in syllables.items()},
            'suffixed': len(suffixed),
            'prefixed': len(prefixed),
            'plurals': len(plurals),
            'pasts': len(pasts),
            'definitions': len(definitions),
            'spelling_pairs': len(spelling) // 2,
        },
    }

    def js(name, value):
        return f'export const {name} = ' + json.dumps(value, separators=(',', ':'), sort_keys=False) + '\n\n'

    body = (
        '// GENERATED by scripts/english/build_lexicon.py — do not edit. Re-run `npm run english:lexicon`.\n'
        '//\n'
        '// Source: Princeton WordNet 3.0 (WordNet License, a permissive BSD-style licence) and\n'
        '// wordfreq (Robyn Speer, MIT). Both are cited in scripts/english/README.md.\n'
        '//\n'
        '// WORD_Z      word -> Zipf frequency x10, integer. The band dial reads this and nothing else.\n'
        '// SYNSETS     [pos, [words]] — one sense\'s common words. Distractor fuel; see the builder.\n'
        '// ANTONYMS    [a, b, pos] — WordNet\'s lemma-level opposites.\n'
        '// CATEGORIES  [key, label, [members], root] — a hypernym, the common words under it, and\n'
        '//             which of the child-recognisable roots it descends from.\n'
        '// SENSES      word -> [[pos, example, [synonyms of this sense], definition, [far]]]\n'
        '//             `far` lists the OTHER senses distant enough in meaning to supply this\n'
        '//             one\'s distractors. See the builder: without it the type asks what a\n'
        '//             word means and offers two right answers.\n'
        '// EXAMPLES    word -> one real sentence using it, for the hide-the-letters types.\n'
        '// SYLLABLES   variety -> word -> syllable count.\n'
        '// RIMES       variety -> word -> its rhyme keys, one per pronunciation.\n'
        '// RHYME_GROUPS variety -> rhyme key -> the words that rhyme.\n'
        '// HOMOPHONES  variety -> groups of differently-spelled words that sound the same.\n'
        '//             All four are stored per variety because their ANSWERS differ: `calm`\n'
        '//             rhymes with `arm` in British and not in American.\n'
        '// SPELLING    word -> {uk, us} for the words spelled two ways. Both spellings stay\n'
        '//             in the lexicon; a question picks one variety and never mixes them.\n'
        '// SUFFIXED    [base, derived, suffix] where the spelling CHANGED (beauty+ful).\n'
        '// PREFIXED    [stem, prefixed, prefix].\n'
        '// PLURALS     [singular, plural] where the plural is not just +s.\n'
        '// PASTS       [base, past] where the past is not just +ed.\n'
        '// DEFINITIONS word -> [definition, readable by the youngest band]. The flag is set\n'
        '//             here because only here is every word\'s frequency available.\n'
        '// FAMILIAR    the lexicon\'s words that Dale-Chall lists as known to 80% of nine-\n'
        '//             and ten-year-olds. An age anchor frequency cannot give: `policy`,\n'
        '//             `research` and `analysis` are all commoner than `pillow`.\n'
        '// BLOCKED     blocklist.txt itself. The engine needs it at RUNTIME, not only here: the\n'
        '//             letter types build options out of letters rather than out of the lexicon,\n'
        '//             and three random letters spell `ass` roughly once in every 300 items.\n'
        '// KINSHIP     word -> every common word sharing ANY sense with it. Not for building\n'
        '//             questions (too loose); for proving one has a single answer.\n'
        '// WORD_LEX    word -> WordNet lexical file of its main sense (noun.animal, verb.motion…).\n'
        '//             The engine uses it to keep filler options concrete: a nine-year-old\n'
        '//             choosing between `demography` and `dilution` is not being asked anything.\n'
        '//\n'
        f'// Every string here passed scripts/english/blocklist.txt ({len(BLOCKED)} entries) on the\n'
        '// lemma, on the definition and on the example sentence.\n\n'
        + js('LEXICON_META', meta)
        + js('WORD_Z', words)
        + js('SYNSETS', synsets)
        + js('ANTONYMS', sorted(antonyms))
        + js('CATEGORIES', categories)
        + js('SENSES', senses)
        + js('EXAMPLES', examples)
        + js('WORD_LEX', lexname)
        + js('KINSHIP', kinship)
        + js('BLOCKED', sorted(BLOCKED))
        + js('SYLLABLES', syllables)
        + js('RIMES', rimes)
        + js('RHYME_GROUPS', rhyme_groups)
        + js('HOMOPHONES', homophones)
        + js('SPELLING', spelling)
        + js('SUFFIXED', suffixed)
        + js('PREFIXED', prefixed)
        + js('PLURALS', plurals)
        + js('PASTS', pasts)
        + js('DEFINITIONS', definitions)
        + js('FAMILIAR', sorted(w for w in words if w in DALE_CHALL))
    )
    OUT.write_text(body)
    size = OUT.stat().st_size
    print(json.dumps(meta['counts'], indent=2))
    print(f'wrote {OUT.relative_to(ROOT)}  {size/1024:.0f} KB')


if __name__ == '__main__':
    main()
