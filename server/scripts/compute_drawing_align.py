#!/usr/bin/env python3
"""Computes a per-step alignment correction for the guided-drawing panels and
writes it to src/lib/drawingAlign.js.

Why this exists: the panels are meant to be cumulative — step N+1 = step N
plus a few more lines in the SAME spot on the page, which is what lets the
guided-steps screen cross-fade between them (see Steps in DrawingsScreen.jsx)
instead of hard-cutting. Some sets' source panels don't hold that:

- Position drift: the canvas was re-centered partway through drawing (e.g.
  bee, caterpillar) — read as the artwork SLIDING during the fade.
- Scale drift: one panel was exported at a different zoom than the rest
  (e.g. anime-face's final, most-detailed panel is noticeably more
  zoomed-in than the one before it) — read as the artwork suddenly
  GROWING/shrinking during the fade. A translate-only correction cannot
  fix this at all (confirmed: even the best translate for that pair only
  reached 0.57 overlap, well below every other pair's 0.74-0.93).

How it decides what's real versus normal growth: an early attempt compared
each step's overall ink bounding-box CENTER to the finished drawing's, which
seemed right for cat/dog (grow straight down from a fixed head) but was
wrong for caterpillar (grows sideways from a fixed head) — it "corrected"
legitimate rightward growth as if it were an error. Bounding-box center
can't tell the two apart, and can't see scale drift at all.

What actually distinguishes them: whether step i's OWN ink still appears in
the exact same place (and size) inside step i+1. This is a registration
problem, so this searches for the (scale, dx, dy) that maximizes how much of
step i's ink is covered by step i+1's ink at that transform. If the earlier
content genuinely didn't move or resize, the best transform is (1, 0, 0) and
nothing is touched — this is why the same search is applied to every set
rather than special-casing the sets that need it: cat/dog/robot/house/
axolotl/landscape are expected to keep landing on ~identity on their own.

Per-step transforms are similarity transforms (uniform scale about the
panel's own center, then translate) chained step-to-step and re-anchored so
the LAST step (the finished drawing, shown unmodified everywhere else in the
app — Browse cards, the Ready preview, the ChildHome icon) always gets
(scale=1, dx=0, dy=0); earlier steps get whatever transform lines them up
with it.

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

GRID = 200              # working resolution for the search (square, ignoring
                         # source aspect ratio — matches how the box the CSS
                         # transform applies to is itself square-contained)
ALPHA_THRESHOLD = 40
SEARCH_FRAC = 0.22       # search +/- 22% of width/height for the best shift
STEP_FRAC = 0.005        # shift search resolution (0.5% per step)
SCALE_CANDIDATES = [1.0, 0.97, 0.94, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65,
                     1.03, 1.06, 1.1, 1.15, 1.2]  # 1.0 first: ties prefer no scale


def load_mask(path):
    im = Image.open(path).convert('RGBA').resize((GRID, GRID), Image.BILINEAR)
    alpha = np.array(im)[:, :, 3]
    return alpha > ALPHA_THRESHOLD


def scale_about_center(mask, s):
    """Resamples `mask` as if the panel's content were scaled by `s` about
    the canvas center, re-cropped/padded back to GRID x GRID."""
    if s == 1.0:
        return mask
    size = max(1, round(GRID * s))
    im = Image.fromarray((mask * 255).astype('uint8')).resize((size, size), Image.BILINEAR)
    arr = np.array(im) > 127
    out = np.zeros((GRID, GRID), dtype=bool)
    if s >= 1.0:
        off = (size - GRID) // 2
        out[:, :] = arr[off:off + GRID, off:off + GRID]
    else:
        off = (GRID - size) // 2
        out[off:off + size, off:off + size] = arr
    return out


def best_shift(mask_a, mask_b):
    """The (dx, dy) — as a fraction of width/height — maximizing how much of
    mask_a's ink is covered by mask_b at that offset. Recall-style: only
    cares whether A's own ink is covered by B, since B is expected to have
    MORE ink than A, not the same amount."""
    a_count = mask_a.sum()
    if a_count == 0:
        return (-1.0, 0.0, 0.0)

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
            if score > best_score + 1e-9 or (
                abs(score - best_score) <= 1e-9 and (ix * ix + iy * iy) < (best_dx / STEP_FRAC) ** 2 + (best_dy / STEP_FRAC) ** 2
            ):
                best_score, best_dx, best_dy = score, ix * STEP_FRAC, iy * STEP_FRAC
    return (best_score, best_dx, best_dy)


def best_transform(mask_a, mask_b):
    """(scale, dx, dy) maximizing overlap. Scored against every candidate
    independently (not a greedy walk — an earlier version compared each
    candidate only to the current leader, which could lock in a mediocre
    early scale and never reconsider it against a later, truly-better one).
    Only prefers scale != 1 if it clearly beats identity, so a set that's
    already fine never picks up a spurious scale for noise-level gains."""
    scores = {s: best_shift(scale_about_center(mask_a, s), mask_b) for s in SCALE_CANDIDATES}
    identity_score = scores[1.0][0]

    best_scale, (best_score, best_dx, best_dy) = 1.0, scores[1.0]
    for s, (score, dx, dy) in scores.items():
        if s != 1.0 and score > identity_score + 0.03 and score > best_score:
            best_scale, best_score, best_dx, best_dy = s, score, dx, dy
    return (best_scale, best_dx, best_dy)


def compose(inner, outer):
    """Combined similarity transform of applying `inner` (s1, t1) then
    `outer` (s2, t2), both operating on canvas-centered coordinates:
    output = s2*(s1*p + t1) + t2 = (s2*s1)*p + (s2*t1 + t2)."""
    s1, tx1, ty1 = inner
    s2, tx2, ty2 = outer
    return (s2 * s1, s2 * tx1 + tx2, s2 * ty1 + ty2)


def main():
    result = {}
    for d in sorted(glob.glob(os.path.join(DRAWINGS_DIR, '*') + os.sep)):
        name = os.path.basename(d.rstrip(os.sep))
        files = sorted(glob.glob(os.path.join(d, 'step-*.webp')))
        if not files:
            continue
        masks = [load_mask(f) for f in files]
        n_steps = len(masks)

        # Pairwise transform mapping step i onto step i+1's frame.
        pairwise = [best_transform(masks[i], masks[i + 1]) for i in range(n_steps - 1)]

        # Chain to get each step's transform relative to the LAST step
        # (the anchor, which trivially gets identity), composing backward.
        to_anchor = [None] * n_steps
        to_anchor[n_steps - 1] = (1.0, 0.0, 0.0)
        for i in range(n_steps - 2, -1, -1):
            to_anchor[i] = compose(pairwise[i], to_anchor[i + 1])

        offsets = [(round(s, 4), round(tx, 4), round(ty, 4)) for s, tx, ty in to_anchor]
        result[name] = offsets
        print(f'{name}: {offsets}')

    header = (
        "// GENERATED by server/scripts/compute_drawing_align.py — do not hand-edit.\n"
        "// Re-run that script after changing any drawing set's source files.\n"
        "//\n"
        "// Per-step [scale, dx, dy] correction — scale about the panel's own\n"
        "// center, dx/dy as a fraction of the rendered box's width/height — so a\n"
        "// guided drawing's steps line up when cross-faded in DrawingsScreen's\n"
        "// Steps component. Found by searching for the transform that makes each\n"
        "// step's own ink reappear in the same place (and size) inside the next\n"
        "// one. Most sets land on ~[1,0,0] everywhere (already well registered);\n"
        "// see the script's docstring for why a couple of sets don't.\n"
    )
    body = (
        f"export const DRAWING_ALIGN = {json.dumps(result, indent=2)}\n\n"
        "// { scale, dx, dy } for one step of one drawing id — dx/dy already as\n"
        "// CSS translate() percentages. [1, 0, 0] if the id or step isn't in the\n"
        "// table.\n"
        "export function drawingAlign(id, stepIndex) {\n"
        "  const [scale, dx, dy] = DRAWING_ALIGN[id]?.[stepIndex] ?? [1, 0, 0]\n"
        "  return { scale, dx: dx * 100, dy: dy * 100 }\n"
        "}\n"
    )
    with open(OUT_PATH, 'w') as f:
        f.write(header + '\n' + body)
    print(f'\nwrote {OUT_PATH}')


if __name__ == '__main__':
    main()
