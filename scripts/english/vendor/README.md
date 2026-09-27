# Vendored word lists

Checked in rather than fetched, so `npm run english:lexicon` needs no network and two builds
of the same commit produce the same lexicon.

| file | what | source | licence |
|---|---|---|---|
| `ldnoobw-en.txt` | 403 obscene terms | [LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) (Shutterstock) | CC-BY 4.0 |
| `cuss.json` | 1795 terms **rated** 0–2 for certainty | [words/cuss](https://github.com/words/cuss) (Titus Wormer) | MIT — `cuss.LICENSE.txt` |
| `ipa-en_UK.txt` | 65,119 British pronunciations, in IPA | [open-dict-data/ipa-dict](https://github.com/open-dict-data/ipa-dict) | MIT — `ipa-dict.LICENSE.txt` |
| `ipa-en_US.txt` | 125,927 American pronunciations, in IPA | same | MIT |
| `dale-chall.json` | 2942 words 80% of US fourth-graders know | [words/dale-chall](https://github.com/words/dale-chall) (Titus Wormer) | MIT — `dale-chall.LICENSE.txt` |

Every licence here is permissive. A fourth list, [zacanger/profane-words](https://github.com/zacanger/profane-words),
was used and then dropped: LGPL-3.0 is copyleft, and these lists are compiled into
`src/lib/englishLexicon.generated.js`, which ships in the app bundle. That is not a question
worth carrying for a word list. Measured before removing it, the words it alone caught in our
frequency band numbered 50, half of them false alarms it would have cost us (`leper`,
`licking`, `clamps`, `vixen`, `bombers`). The other 25 are written out in `../blocklist.txt`.

## Why two pronunciation dictionaries and not CMUdict

CMUdict was here first and could not do the job, for a reason that only shows up when you
look at the output. It is American, and American English merged two vowels that British keeps
apart: `hot` and `calm` share the symbol AA. Reading it non-rhotically to get British
pronunciation — which the 9-10 poem forces, since it rhymes `calm` with `arm` — then makes
`heart` and `hot` identical. The lexicon was offering `heart/hot`, `carp/cop`, `darn/don` and
`parted/potted` as homophones, which they are in no dialect of English.

No transformation of an American dictionary can fix that, because the distinction is not in
it. These two are IPA, they are separate dictionaries rather than one plus a rule, and they
give the right answer in both varieties: British `heart` is /hɑːt/ against `hot` /hɒt/, and
`flaw` and `floor` are both /flɔː/; American `flaw` is /flɔ/ against `floor` /flɔɹ/, and
`pore`, `pour`, `oar` and `ore` are all /ɔɹ/.

They cover 95% of this lexicon. A word in neither is simply not asked about its sound.

## Why these, and what they do not do

The hand-written `blocklist.txt` was missing 90 words these lists carry, including racial
slurs and explicit sexual vocabulary, all of them sitting in the lexicon where a filler option
could have reached them. That is the argument for using a published list instead of one
person's memory: the memory is the part that fails.

**cuss is used from score 1 upwards, never 0.** Its score 0 tier is context-dependent rather
than profane and holds `african`, `asian`, `arab`, `american`, `adult`, `angry`. Blocking
those would be a worse mistake than the one the list is here to prevent.

**What no profanity list solves.** The first bad question the lab produced was "received
confirmed reports of casualties", and none of these three lists contains `casualty` — it is
not a rude word, it is a word about dead people. The same goes for the whole register in
`../sentence-topics.txt`: war, courtrooms, markets, wards. Profanity and
age-appropriateness are different axes, and only the first one has a published list.

**dale-chall is the opposite kind of list** — an allowlist, not a blocklist: words known to
80% of nine- and ten-year-olds. Too small to be the module's vocabulary (2942 against the
19,000 this lexicon holds, and the Bond 8-9 paper reaches well past it), it is used as the
readability test for SENTENCES, where a single unknown word can sink the whole question.
