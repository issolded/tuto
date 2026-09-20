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
import json, re, sys, datetime
from pathlib import Path
from collections import defaultdict

from nltk.corpus import names as name_corpus
from nltk.corpus import wordnet as wn
from wordfreq import zipf_frequency

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'src' / 'lib' / 'englishLexicon.generated.js'
BLOCK = Path(__file__).with_name('blocklist.txt')

# Floor for anything that may appear on screen at all. Bands sit ABOVE this; it exists so the
# file is not 150k words of WordNet's long tail.
MIN_ZIPF = 2.6
MIN_LEN, MAX_LEN = 3, 12


def load_blocklist():
    words = set()
    for line in BLOCK.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            words.add(line.lower())
    return words


BLOCKED = load_blocklist()

# Whole-word matching with the simple inflections, so `kill` takes `kills`/`killed`/`killing`
# but never `skill`, and `rape` never takes `grape`. Built once; it is applied to every
# definition and example sentence in WordNet, which is 200k+ strings.
_BLOCK_RE = re.compile(
    r'\b(?:' + '|'.join(sorted((re.escape(w) for w in BLOCKED), key=len, reverse=True))
    + r')(?:s|es|ed|ing|d|r|rs)?\b', re.I)


def unsafe(text):
    return bool(_BLOCK_RE.search(text))


# Every spelling WordNet knows with a capital letter. `Russia`, `Jap`, `Wallace`, `Nancy`,
# `Dresden` — and also the surname behind `murphy`, which is why a slang sense of `potato` was
# scoring Zipf 4.3: wordfreq counts every Murphy in every text as the same token.
CAPITALISED = None

# Every given name NLTK knows, 7576 of them. The capitalised-elsewhere gate catches a name only
# when WordNet also holds it capitalised, and plenty slip past: `anna` is an Indian coin,
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


def capitalised_elsewhere(name):
    global CAPITALISED
    if CAPITALISED is None:
        CAPITALISED = {l.name().lower() for s in wn.all_synsets() for l in s.lemmas()
                       if not l.name().islower()}
    return name in CAPITALISED


def usable_lemma(name):
    """A single, lower-case, alphabetic common word.

    `name` is the RAW lemma, not a lowercased one — which is the whole point. The first build
    lowercased before this check, so `name.islower()` was trivially true and every proper noun
    in WordNet walked through: a question asked a child to find the opposite of `denmark`, and
    one offered a racial slur as a distractor because `Jap` became `jap` on the way in.
    """
    return (name.islower() and name.isalpha()
            and MIN_LEN <= len(name) <= MAX_LEN and name not in BLOCKED
            and not capitalised_elsewhere(name) and not is_bare_name(name))


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
                 ('yse', 'yze'), ('ll', 'l'), ('ae', 'e'), ('oe', 'e')):
        if a.replace(x, y) == b.replace(x, y):
            return True
    return False


def safe_synset(s):
    """A sense is safe when neither its definition nor any example sentence trips the list."""
    if unsafe(s.definition()):
        return False
    return not any(unsafe(e) for e in s.examples())


def main():
    zipf = {}

    def z(w):
        if w not in zipf:
            zipf[w] = zipf_frequency(w, 'en')
        return zipf[w]

    def common(w):
        """Takes an already-lowercased word; the case test has run on the raw lemma."""
        return (w.isalpha() and MIN_LEN <= len(w) <= MAX_LEN and w not in BLOCKED
                and not capitalised_elsewhere(w) and not is_bare_name(w)
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
        if not safe_synset(syn) or syn.instance_hypernyms():
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
            if lem.count() >= 1 or (idx < 2 and syn.pos() == main_pos(name)):
                dominant[name].add(syn.name())

    # ---- pass 2: synonym sets ------------------------------------------------------------
    # The dominant-sense gate from above is what makes this list usable. Without it the pairs
    # read like a crossword setter's notebook, because WordNet knows every sense a word has
    # ever had: `man = piece` (chess), `pan = trash` (to criticise), `enter = figure` (to
    # figure in), `back = stake`. Every one of those is a rare sense of a common word, and a
    # child asked to match them is not being tested on vocabulary but on trivia. Requiring
    # BOTH words to be speaking their own main sense removes the whole class.
    synsets = []
    for syn in wn.all_synsets():
        if not safe_synset(syn):
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
        if not safe_synset(syn):
            continue
        for lem in syn.lemmas():
            a = lem.name().lower()
            if not common(a):
                continue
            for other in lem.antonyms():
                b = other.name().lower()
                if not common(b):
                    continue
                if not safe_synset(other.synset()):
                    continue
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
        if not safe_synset(syn):
            continue
        names = {l.name().lower() for l in syn.lemmas()
                 if usable_lemma(l.name()) and common(l.name().lower())
                 and primary(l.name().lower(), syn)}
        if not names:
            continue
        for hyper in syn.hypernyms():
            if not safe_synset(hyper):
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
        if len(members) < 5 or key not in allowed:
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
                  and not any(zipf_frequency(tok, 'en') < 3.4
                              for tok in re.findall(r"[a-z']+", e.lower()) if len(tok) > 2)]
            if not ex:
                continue
            sibs = sorted({l.name().lower() for l in syn.lemmas()
                           if usable_lemma(l.name()) and common(l.name().lower())
                           and l.name().lower() != name})
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
        if not safe_synset(syn):
            continue
        names = [l.name().lower() for l in syn.lemmas()
                 if usable_lemma(l.name()) and common(l.name().lower())]
        for a in names:
            for b in names:
                if a != b:
                    kin[a].add(b)
    kinship = {k: sorted(v) for k, v in sorted(kin.items())}

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
    )
    OUT.write_text(body)
    size = OUT.stat().st_size
    print(json.dumps(meta['counts'], indent=2))
    print(f'wrote {OUT.relative_to(ROOT)}  {size/1024:.0f} KB')


if __name__ == '__main__':
    main()
