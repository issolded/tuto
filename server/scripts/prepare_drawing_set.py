#!/usr/bin/env python3
"""Turns a folder of raw guided-step PNGs into drawings/<id>/step-NN.webp.

The raw sets arrive as one generated grid image sliced into panels named
`..._parca_N.png` or `..._adim_N.png`: white paper, opaque, sometimes with the step number printed
in a corner, and each panel exported at a slightly different pixel size. What
the app wants is the opposite of all of that — transparent line art, no
numbers, every panel of a set cropped identically so the guided-steps screen
can cross-fade between them.

What this does, per set:

1. Selects panels by number. `steps` is an explicit list, not a range, because
   a panel is sometimes dropped: the sources are generated, and a panel that
   LOSES ink the previous one had (robot's old step 5, galata's door, dunya's
   island dots) breaks the one promise these sketches make — that step N+1 is
   step N plus a few more lines. Dropping it and renumbering is the same fix
   the robot set already got.
2. Erases a burned-in step number from the top-left corner (`erase`, as a
   fraction of width/height). Only some sets have one.
3. White → transparent. The white point is the 97th percentile of the panel's
   own luminance, so beige/textured paper (girl standing) normalises to clean
   white instead of leaving a faint rectangle of tint over the app's panel.
   Ink keeps its shape as ALPHA and the colour is left black: composited over
   white that reproduces the pencil exactly, and over the category tint it
   darkens naturally. (The sets added before this script encoded colour as the
   original grey WITH that same alpha, which washes midtones out — a Big Ben
   drawn that way reads noticeably fainter. Not worth rewriting the old sets
   for, but not worth copying either.)
4. Crops every panel of the set to ONE box — the union of their ink, plus a
   small margin. A per-panel crop would silently re-register the artwork and
   turn the cross-fade into a slide. Panels whose exported size differs by a
   percent or two are resized to a common canvas first, for the same reason.
5. Downscales so the long edge is at most 1024 and writes WebP.

  python3 server/scripts/prepare_drawing_set.py [--dry] [id ...]

Then: compute_drawing_align.py (registration), upload_drawings.mjs (storage),
a DRAWING_STEPS entry in src/lib/drawingSteps.js (the words), and a catalogue
row. The panels alone are half a drawing.
"""

import re
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'cizims_sep2026'
OUT = ROOT / 'drawings'
MAX_EDGE = 1024
MARGIN = 0.035          # of the long edge, so the ink never touches the frame
ALPHA_FLOOR = 12        # below this, paper grain rather than pencil
BBOX_INK = 40           # what counts as ink when deciding where to crop

# id → (raw folder under cizims_sep2026/, panels to keep in order,
#        corner-number erase box or None)
DRIVE = 'drive-download-20260904T060949Z-1-001'
SETS = {
    'car':             ('drawings/araba',            [1, 2, 3, 4, 5],          None),
    'airplane':        ('drawings/ucak',             [1, 2, 3, 4, 5, 6],       None),
    'ship':            ('drawings/gemi',             [1, 2, 3, 4, 5, 6],       None),
    'big-ben':         ('drawings/bigben',           [1, 2, 3, 4, 6, 7, 8],    None),
    'galata-tower':    ('drawings/galata',           [1, 2, 3, 5, 6, 7, 8],    None),
    'globe':           ('drawings/dunya',            [1, 2, 4, 5],             (0.09, 0.16)),
    'adventure-map':   ('drawings/harita2',          [1, 2, 3, 4],             (0.20, 0.28)),
    'bike-hero':       ('drawings/bisikletli cocuk', [1, 2, 3, 4, 5],          None),
    'girl-reading':    ('drawings/kitap okuyan kiz', [1, 2, 3, 4, 5, 6],       None),
    'desk-boy':        ('drawings/masada cocuk',     [1, 2, 3, 4, 6],          (0.12, 0.16)),
    'forest-explorer': ('drawings/girl standing',    [1, 2, 3, 4, 5, 6, 7],    None),

    # Second drop, same morning. These four finally retire the "Soon" tiles that
    # DrawingsScreen has been showing since the module shipped.
    'butterfly':       (f'{DRIVE}/butterfly',        [1, 2, 3, 4, 5, 6],       None),
    'alien':           (f'{DRIVE}/alien',            [1, 2, 3, 4, 5, 6],       None),
    'rocket':          (f'{DRIVE}/roket',            [1, 2, 3, 4, 5],          None),
    'sun':             (f'{DRIVE}/gunes',            [1, 2, 3, 4, 5, 6, 7, 8], None),
    'koala':           (f'{DRIVE}/koala',            [1, 2, 3, 4, 5, 6],       None),
}


def panel_number(path):
    # Two spellings so far: ..._parca_3.png and ..._adim_3.png.
    m = re.search(r'(?:parca|adim)_(\d+)', path.name)
    return int(m.group(1)) if m else 0


def load_luma(path, canvas, erase):
    """Panel as a float luminance array on the set's common canvas, number gone."""
    im = Image.open(path).convert('L')
    if im.size != canvas:
        im = im.resize(canvas, Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    if erase:
        fw, fh = erase
        h, w = a.shape
        a[:int(h * fh), :int(w * fw)] = 255.0
    return a


def to_alpha(luma):
    """White → transparent, ink → black at the alpha its darkness earns."""
    white = np.percentile(luma, 97)
    norm = np.clip(luma * 255.0 / max(white, 1.0), 0, 255)
    alpha = 255.0 - norm
    alpha[alpha < ALPHA_FLOOR] = 0
    return alpha


def build(drawing_id, dry=False):
    folder, wanted, erase = SETS[drawing_id]
    src = RAW / folder
    by_number = {panel_number(p): p for p in src.glob('*.png')}
    missing = [n for n in wanted if n not in by_number]
    if missing:
        raise SystemExit(f'{drawing_id}: raw panels {missing} not in {src}')

    # One canvas for the whole set: the size most of its panels already are.
    sizes = Counter(Image.open(by_number[n]).size for n in wanted)
    canvas = sizes.most_common(1)[0][0]

    alphas = [to_alpha(load_luma(by_number[n], canvas, erase)) for n in wanted]

    # One crop box for the whole set, from every panel's ink together.
    ink = np.zeros(alphas[0].shape, bool)
    for a in alphas:
        ink |= a > BBOX_INK
    ys, xs = np.where(ink)
    pad = int(MARGIN * max(canvas))
    x0, x1 = max(int(xs.min()) - pad, 0), min(int(xs.max()) + pad + 1, canvas[0])
    y0, y1 = max(int(ys.min()) - pad, 0), min(int(ys.max()) + pad + 1, canvas[1])

    w, h = x1 - x0, y1 - y0
    scale = min(1.0, MAX_EDGE / max(w, h))
    size = (max(round(w * scale), 1), max(round(h * scale), 1))

    dest = OUT / drawing_id
    print(f'{drawing_id}: {len(wanted)} steps from {folder} '
          f'(panels {wanted}) crop {w}x{h} → {size[0]}x{size[1]}')
    if dry:
        return
    dest.mkdir(parents=True, exist_ok=True)
    for i, a in enumerate(alphas, 1):
        cut = a[y0:y1, x0:x1].astype(np.uint8)
        rgba = np.zeros(cut.shape + (4,), np.uint8)      # black ink…
        rgba[..., 3] = cut                                # …shaped by alpha
        im = Image.fromarray(rgba).resize(size, Image.LANCZOS)
        out = dest / f'step-{i:02d}.webp'
        im.save(out, 'WEBP', quality=88, method=6)
        print(f'  ✓ {out.relative_to(ROOT)} ({out.stat().st_size / 1024:.0f} KB)')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry' in sys.argv
    for did in (args or SETS):
        if did not in SETS:
            raise SystemExit(f'unknown set "{did}"; known: {", ".join(SETS)}')
        build(did, dry=dry)
