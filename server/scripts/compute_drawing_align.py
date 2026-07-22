#!/usr/bin/env python3
"""Computes a per-step alignment correction for the guided-drawing panels and
writes it to src/lib/drawingAlign.js.

Why this exists: the panels are meant to be cumulative — step N+1 = step N
plus a few more lines in the SAME spot on the page, which is what lets the
guided-steps screen cross-fade between them (see Steps in DrawingsScreen.jsx)
instead of hard-cutting. Some sets' source panels don't hold that — the
canvas was evidently re-centered partway through drawing them — which made
the cross-fade look like the artwork was sliding during the fade instead of
gaining new pencil strokes in place.

How it decides what's "drift" versus normal growth: a first attempt compared
each step's overall ink bounding-box CENTER to the finished drawing's, which
seemed right for cat/dog (which grow straight down from a fixed head) but
was wrong for caterpillar (which grows sideways from a fixed head) — it
"corrected" legitimate rightward growth as if it were an error, dragging the
head sideways instead. Bounding-box center can't tell the two apart.

What actually distinguishes them: whether step i's OWN ink still appears in
the exact same place inside step i+1. This is a registration problem, not a
summary-statistic problem, so this searches for the (dx, dy) shift that
maximizes how much of step i's ink is covered by step i+1's ink at that
offset. If the earlier content genuinely didn't move (new stroke added
elsewhere), the best shift is (0, 0) and nothing is touched — this is why
the same search is applied to every set rather than special-casing bee and
caterpillar: cat/dog/robot/house/axolotl are expected to keep landing on
~zero on their own.

Per-step corrections chain step-to-step and are then re-anchored so the
LAST step (the finished drawing, shown unmodified everywhere else in the
app — Browse cards, the Ready preview, the ChildHome icon) always gets
(0, 0); earlier steps get whatever offset lines them up with it.

Re-run this whenever a drawing set's source files change or a new set is
added:
    python3 server/scripts/compute_drawing_align.py
"""
import glob
import json
import os

import numpy as np
from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DRAWINGS_DIR = os.path.join(REPO_ROOT, 'drawings')
OUT_PATH = os.path.join(REPO_ROOT, 'src', 'lib', 'drawingAlign.js')

GRID = 200            # working resolution for the correlation search (square,
                       # ignoring source aspect ratio — matches how the %-based
                       # CSS transform is applied to a square-contained box)
ALPHA_THRESHOLD = 40
SEARCH_FRAC = 0.22     # search +/- 22% of width/height for the best shift
STEP_FRAC = 0.005      # search resolution (0.5% of width/height per step)


def load_mask(path):
    im = Image.open(path).convert('RGBA').resize((GRID, GRID), Image.BILINEAR)
    alpha = np.array(im)[:, :, 3]
    return alpha > ALPHA_THRESHOLD


def best_shift(mask_a, mask_b):
    """The (dx, dy) — as a fraction of width/height — that best explains
    mask_a's ink reappearing inside mask_b. Recall-style: only cares whether
    A's own ink is covered by B at the candidate offset, since B is expected
    to have MORE ink than A (a later, more-complete panel), not the same
    amount."""
    a_count = mask_a.sum()
    if a_count == 0:
        return (0.0, 0.0)

    n = int(SEARCH_FRAC / STEP_FRAC)
    best_score, best_dx, best_dy = -1.0, 0.0, 0.0
    for iy in range(-n, n + 1):
        dy_px = round(iy * STEP_FRAC * GRID)
        shifted_y = np.roll(mask_a, dy_px, axis=0)
        if dy_px > 0:
            shifted_y[:dy_px, :] = False
        elif dy_px < 0:
            shifted_y[dy_px:, :] = False
        for ix in range(-n, n + 1):
            dx_px = round(ix * STEP_FRAC * GRID)
            shifted = np.roll(shifted_y, dx_px, axis=1)
            if dx_px > 0:
                shifted[:, :dx_px] = False
            elif dx_px < 0:
                shifted[:, dx_px:] = False
            score = np.logical_and(shifted, mask_b).sum() / a_count
            # Prefer the smallest shift among near-ties, so ambiguous/symmetric
            # content (e.g. a blank early panel) doesn't drift for no reason.
            if score > best_score + 1e-9 or (
                abs(score - best_score) <= 1e-9 and (ix * ix + iy * iy) < (best_dx / STEP_FRAC) ** 2 + (best_dy / STEP_FRAC) ** 2
            ):
                best_score, best_dx, best_dy = score, ix * STEP_FRAC, iy * STEP_FRAC
    return (best_dx, best_dy)


def main():
    result = {}
    for d in sorted(glob.glob(os.path.join(DRAWINGS_DIR, '*') + os.sep)):
        name = os.path.basename(d.rstrip(os.sep))
        files = sorted(glob.glob(os.path.join(d, 'step-*.webp')))
        if not files:
            continue
        masks = [load_mask(f) for f in files]

        # Chain pairwise shifts (step i -> step i+1), accumulate, then
        # re-anchor so the last step lands on (0, 0).
        cumulative = [(0.0, 0.0)]
        for i in range(len(masks) - 1):
            dx, dy = best_shift(masks[i], masks[i + 1])
            px, py = cumulative[-1]
            cumulative.append((round(px + dx, 4), round(py + dy, 4)))
        anchor_x, anchor_y = cumulative[-1]
        offsets = [(round(x - anchor_x, 4), round(y - anchor_y, 4)) for x, y in cumulative]

        result[name] = offsets
        print(f'{name}: {offsets}')

    header = (
        "// GENERATED by server/scripts/compute_drawing_align.py — do not hand-edit.\n"
        "// Re-run that script after changing any drawing set's source files.\n"
        "//\n"
        "// Per-step [dx, dy] correction (fraction of the rendered box's width/\n"
        "// height) so a guided drawing's steps line up when cross-faded in\n"
        "// DrawingsScreen's Steps component, found by searching for the shift that\n"
        "// makes each step's own ink reappear in the same place inside the next\n"
        "// one. Most sets land on ~[0,0] everywhere (already well registered);\n"
        "// see the script's docstring for why a couple of sets don't.\n"
    )
    body = (
        f"export const DRAWING_ALIGN = {json.dumps(result, indent=2)}\n\n"
        "// translate() percentages for one step of one drawing id. [0, 0] if the\n"
        "// id or step isn't in the table.\n"
        "export function drawingAlign(id, stepIndex) {\n"
        "  const [dx, dy] = DRAWING_ALIGN[id]?.[stepIndex] ?? [0, 0]\n"
        "  return { dx: dx * 100, dy: dy * 100 }\n"
        "}\n"
    )
    with open(OUT_PATH, 'w') as f:
        f.write(header + '\n' + body)
    print(f'\nwrote {OUT_PATH}')


if __name__ == '__main__':
    main()
