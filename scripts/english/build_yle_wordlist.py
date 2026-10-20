#!/usr/bin/env python3
"""Cambridge Pre A1 Starters / A1 Movers / A2 Flyers 2018 wordlist -> src/lib/literacy/yleWordlist.generated.js

    python3 scripts/english/build_yle_wordlist.py <wordlists-pre-a1-starters-a1-movers-and-a2-flyers.pdf>

Source: Cambridge Assessment English, "Pre A1 Starters, A1 Movers and A2 Flyers Wordlists", for exams
from 2018, the free teacher download (cambridgeenglish.org/Images/wordlists-pre-a1-starters-a1-movers-
and-a2-flyers.pdf). The PDF is not in the repo. Only facts about words are kept (which level a word first
appears at, its part of speech, the UK/US alternative, its topic); no exam content.

Three readings of the same document, each checked against the others:
  1. the combined A-Z list (pages 23-30), where every entry carries S / M / F: the primary source
  2. the per-level A-Z lists (Starters 4-7, Movers 8-11, Flyers 12-16): every word marked S must be in
     the Starters list, and so on
  3. the thematic list (pages 38-43): topics, and again a level per word (by column)
A disagreement is printed and fails the build unless it is in KNOWN_SOURCE_QUIRKS with a reason.
"""
import json, re, subprocess, sys
from collections import Counter, defaultdict

POS = {'adj', 'adv', 'conj', 'det', 'dis', 'excl', 'int', 'n', 'poss', 'prep', 'pron', 'v', 'title'}
# The grammatical key printed on each list page, read as text: not words of the list.
KEY_WORDS = POS | {'adjective', 'adverb', 'conjunction', 'determiner', 'discourse', 'marker', 'exclamation',
                   'interrogative', 'noun', 'possessive', 'preposition', 'pronoun', 'verb'}
LEVELS = {'S': 'starters', 'M': 'movers', 'F': 'flyers'}
RANK = {'starters': 1, 'movers': 2, 'flyers': 3}
POS_RE = r'(?:adj|adv|conj|det|dis|excl|int|n|poss|prep|pron|v|title)'
ENTRY_RE = re.compile(rf'^(?P<head>.+?)\s+(?P<pos>{POS_RE}(?:\s*\+\s*{POS_RE})*)(?P<note>\s.*)?$')

KNOWN_SOURCE_QUIRKS = {}   # filled from the first run's report, each with a reason


def text(pdf, first, last, layout=False):
    args = ['pdftotext', '-f', str(first), '-l', str(last)] + (['-layout'] if layout else []) + [pdf, '-']
    return subprocess.run(args, capture_output=True, text=True, check=True).stdout


def is_noise(line):
    s = line.strip()
    if not s or re.fullmatch(r'[A-Z]', s) or re.fullmatch(r'\d+', s):
        return True
    if re.search(r'(A–Z wordlist|vocabulary list|Grammatical key|First appears at|^Pre A1 Starters|^A1 Movers|^A2 Flyers)', s):
        return True
    return all(w in KEY_WORDS for w in s.split())


def lines_of(raw):
    """Clean lines. pdftotext sometimes runs two entries together: "fire engine nF fire fighter" is
    "fire engine n F" and "fire fighter". The paragraph after a level's list (letters, numbers, names)
    is not part of the list."""
    out = []
    for line in raw.replace('...', '…').splitlines():
        if re.match(r'\s*(Letters & numbers|Numbers)\b', line):
            break
        line = re.sub(rf'\b({POS_RE})([SMF])\b', r'\1 \2', line)
        line = re.sub(rf'(\s[SMF])\s+(?=\S)', r'\1\n', line)
        out.extend(l for l in line.split('\n') if not is_noise(l))
    # A note in brackets can run over two lines: "could (as in past of can" / "for ability)".
    joined, open_ = [], ''
    for l in out:
        cur = (open_ + ' ' + l.strip()).strip() if open_ else l.strip()
        if cur.count('(') > cur.count(')'):
            open_ = cur
            continue
        joined.append(cur)
        open_ = ''
    if open_:
        joined.append(open_)
    return joined


def pos_only(line):
    return bool(re.fullmatch(rf'{POS_RE}(\s*\+\s*{POS_RE})*', line.strip()))


def split_note(head):
    """'football (US soccer)' -> ('football', ['US soccer']). Brackets can nest: 'candy (UK sweet(s))'."""
    word, notes, depth, cur = [], [], 0, ''
    for ch in head:
        if ch == '(':
            if depth:
                cur += ch
            depth += 1
        elif ch == ')' and depth:
            depth -= 1
            if depth:
                cur += ch
            else:
                notes.append(cur.strip())
                cur = ''
        elif depth:
            cur += ch
        else:
            word.append(ch)
    if cur:
        notes.append(cur.strip())
    return re.sub(r'\s+', ' ', ''.join(word)).strip(), notes


def parse_entry(raw):
    raw = raw.replace('...', '…')
    m = ENTRY_RE.match(raw)
    if m:
        head, pos, note = m.group('head'), m.group('pos'), (m.group('note') or '').strip()
    else:
        head, pos, note = raw, '', ''
    head, paren = split_note(head)
    # One note is printed without brackets: "take off i.e. get undressed".
    m2 = re.match(r'^(.*?)\s+((?:i\.e\.|e\.g\.)\s.*)$', head)
    if m2:
        head, paren = m2.group(1), paren + [m2.group(2)]
    notes = paren + ([note] if note else [])
    uk = us = None
    for n in paren:
        if n.startswith('UK '):
            uk = n[3:].strip()
        if n.startswith('US '):
            us = n[3:].strip()
    return {
        'word': head,
        'forms': [f.strip() for f in head.split('/')] if '/' in head and ' ' not in head else [head],
        'pos': [p.strip() for p in pos.split('+')] if pos else [],
        'notes': notes,
        'uk': uk, 'us': us,
    }


def combined(pdf):
    """Pages 23-30: entries end in S / M / F. A line without the marker continues on the next line."""
    out, pending = [], ''
    for line in lines_of(text(pdf, 23, 30)):
        s = (pending + ' ' + line.strip()).strip() if pending else line.strip()
        m = re.match(r'^(?P<body>.+?)\s+(?P<lvl>[SMF])$', s)
        if m:
            e = parse_entry(m.group('body'))
            e['level'] = LEVELS[m.group('lvl')]
            out.append(e)
            pending = ''
        else:
            pending = s
    if pending:
        print('UNFINISHED ENTRY at end of combined list:', pending)
    return out


def per_level(pdf, first, last):
    """Pages of one level's own A-Z list: entries end in a part of speech, or are the headword alone.
    A line that is only a part of speech belongs to the headword above it ("bat (as sports equipment)" / "n")."""
    words = set()
    for line in lines_of(text(pdf, first, last)):
        if pos_only(line):
            continue
        w = parse_entry(line.strip())['word'].lower()
        if w:
            words.add(w)
    return words


def thematic(pdf):
    """Pages 38-43, layout text: a topic label in the left margin, then words under three level columns
    (each level column may itself hold two sub-columns of words). Column starts are read off the
    column-header line of each page ("Pre A1 Starters   A1 Movers   A2 Flyers", not the page title, which
    also names all three). A label starting with a capital opens a topic; a lower-case one continues it
    ("Family &" / "friends", "The body" / "and the" / "face")."""
    topics = defaultdict(set)
    for page in range(38, 44):
        lines = text(pdf, page, page, layout=True).replace('...', '…').splitlines()
        hdr = next((l for l in lines if all(x in l for x in ('Pre A1 Starters', 'A1 Movers', 'A2 Flyers'))
                    and ',' not in l and 'vocabulary' not in l), None)
        if not hdr:
            continue
        cols = [hdr.index('Pre A1 Starters'), hdr.index('A1 Movers'), hdr.index('A2 Flyers')]
        topic = None
        for l in lines[lines.index(hdr) + 1:]:
            if not l.strip() or 'thematic vocabulary list' in l:
                continue
            label = l[:cols[0]].strip()
            if label:
                if label[0].isupper() or topic is None:
                    topic = label
                else:
                    # the label goes on: what was filed under its first line moves to the full name
                    full = f'{topic} {label}'
                    topics[full] |= topics.pop(topic, set())
                    topic = full
            if topic is None:
                continue
            for i, start in enumerate(cols):
                cell = l[start:cols[i + 1]] if i + 1 < len(cols) else l[start:]
                for w in re.split(r'\s{2,}', cell.strip()):
                    # a bracketed note may be cut over two lines: keep the word, drop the pieces
                    if '(' in w:
                        w = w[:w.index('(')]
                    elif ')' in w:
                        continue
                    w = w.strip().rstrip('/')    # "businessman/" + "businesswoman" on the next line
                    if re.search(r'[a-z]', w):
                        topics[topic].add((w.lower(), ['starters', 'movers', 'flyers'][i]))
    return topics


def main(pdf):
    entries = combined(pdf)
    lists = {'starters': per_level(pdf, 4, 7), 'movers': per_level(pdf, 8, 11), 'flyers': per_level(pdf, 12, 16)}
    themes = thematic(pdf)

    problems = []
    by_word = defaultdict(list)
    for e in entries:
        by_word[e['word'].lower()].append(e)
    # 2. per-level lists agree with the S / M / F markers
    for e in entries:
        w = e['word'].lower()
        if w not in lists[e['level']] and (w, e['level']) not in KNOWN_SOURCE_QUIRKS:
            problems.append(f"{e['word']} is marked {e['level']} but is not in the {e['level']} list")
    for lvl, ws in lists.items():
        for w in ws:
            if w not in by_word and (w, lvl) not in KNOWN_SOURCE_QUIRKS:
                problems.append(f"{w} is in the {lvl} list but not in the combined list")
            elif w in by_word and all(RANK[x['level']] > RANK[lvl] for x in by_word[w]) and (w, lvl) not in KNOWN_SOURCE_QUIRKS:
                problems.append(f"{w} is in the {lvl} list but marked {[x['level'] for x in by_word[w]]}")
    # 3. thematic columns agree too (a word's column = the level it first appears at, for that sense)
    word_topics = defaultdict(set)
    for topic, pairs in themes.items():
        for w, lvl in pairs:
            word_topics[w].add(topic)
            if w in by_word and lvl not in {x['level'] for x in by_word[w]} and (w, lvl) not in KNOWN_SOURCE_QUIRKS:
                problems.append(f"{w} is under {lvl} in topic '{topic}' but marked {[x['level'] for x in by_word[w]]}")

    seen = Counter()
    out = []
    for e in entries:
        key = re.sub(r'[^a-z0-9]+', '-', e['word'].lower()).strip('-')
        seen[key] += 1
        e['id'] = key if seen[key] == 1 else f'{key}-{seen[key]}'
        e['topics'] = sorted(word_topics.get(e['word'].lower(), []))
        out.append(e)

    counts = Counter(e['level'] for e in out)
    print(f"{len(out)} entries · starters {counts['starters']} · movers {counts['movers']} · flyers {counts['flyers']}")
    print(f"per-level lists: starters {len(lists['starters'])} · movers {len(lists['movers'])} · flyers {len(lists['flyers'])}")
    print(f"{len(themes)} topics, {sum(1 for e in out if e['topics'])} entries with a topic")
    for p in problems:
        print('MISMATCH', p)
    return out, problems


if __name__ == '__main__':
    entries, problems = main(sys.argv[1])
    if '--write' in sys.argv:
        dst = 'src/lib/literacy/yleWordlist.generated.js'
        with open(dst, 'w') as f:
            f.write('// Generated by scripts/english/build_yle_wordlist.py from the Cambridge 2018 Pre A1 Starters,\n'
                    '// A1 Movers and A2 Flyers wordlists (free teacher download). Facts about words only. Do not edit.\n')
            f.write('export const YLE_WORDLIST = ' + json.dumps(entries, ensure_ascii=False, indent=0) + '\n')
        print('wrote', dst)
    sys.exit(1 if problems else 0)
