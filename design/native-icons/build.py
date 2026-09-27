#!/usr/bin/env python3
"""Builds the animated home-screen icons as Lottie JSON (no dependencies).

Each file is 320x240 @ 30 fps with a transparent background (the card supplies
the colour) and two named markers:
  idle  frames 0-90   seamless loop, play while the task is "next"
  done  frames 90-120 plays once, ends on a still frame with the check badge

Run: python3 design/native-icons/build.py   -> writes design/native-icons/lottie/*.json
"""
import json
import math
import os

W, H, FPS, IDLE, END = 320, 240, 30, 90, 120
K = 0.5523  # cubic handle length for a quarter circle
INK = '#2b1d3a'


def rgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1]


def static(v):
    return {'a': 0, 'k': v}


def anim(keys, ease='io'):
    """keys: [(frame, value), ...]; value is a number or list."""
    eases = {'io': ([0.42], [0], [0.58], [1]), 'out': ([0.2], [0], [0.2], [1]),
             'back': ([0.3], [0], [0.35], [1.4]), 'in': ([0.5], [0], [0.8], [0.6])}
    ox, oy, ix, iy = eases[ease]
    out = []
    for f, v in keys:
        out.append({'t': f, 's': v if isinstance(v, list) else [v],
                    'o': {'x': ox, 'y': oy}, 'i': {'x': ix, 'y': iy}})
    return {'a': 1, 'k': out}


# ---------- shapes ----------

class Path:
    """Tiny path builder: lines, cubics and semicircles, emitted as a Lottie 'sh'."""

    def __init__(self, x, y):
        self.v, self.i, self.o = [[x, y]], [[0, 0]], [[0, 0]]

    @property
    def cur(self):
        return self.v[-1]

    def L(self, x, y):
        self.v.append([x, y]); self.i.append([0, 0]); self.o.append([0, 0]); return self

    def H(self, x): return self.L(x, self.cur[1])

    def V(self, y): return self.L(self.cur[0], y)

    def C(self, c1, c2, p):
        px, py = self.cur
        self.o[-1] = [c1[0] - px, c1[1] - py]
        self.v.append(list(p)); self.i.append([c2[0] - p[0], c2[1] - p[1]]); self.o.append([0, 0])
        return self

    def semi(self, bx, by, side):
        """Half circle from the current point to (bx, by). side=+1 bulges toward (ty, -tx) for travel direction t (screen coords: down -> right, right -> up); -1 the other way."""
        ax, ay = self.cur
        cx, cy = (ax + bx) / 2, (ay + by) / 2
        r = math.hypot(bx - ax, by - ay) / 2
        ux, uy = (ax - cx) / r, (ay - cy) / r            # centre -> start
        tx, ty = (bx - ax) / (2 * r), (by - ay) / (2 * r)  # direction of travel
        nx, ny = (ty, -tx) if side > 0 else (-ty, tx)     # bulge direction
        mx, my = cx + r * nx, cy + r * ny
        k = K * r
        self.C((ax + k * nx, ay + k * ny), (mx + k * ux, my + k * uy), (mx, my))
        self.C((mx - k * ux, my - k * uy), (bx + k * nx, by + k * ny), (bx, by))
        return self

    def shape(self, closed=True):
        v, i, o = self.v, self.i, self.o
        if closed and len(v) > 1 and v[0] == v[-1]:
            i[0] = i[-1]; v, i, o = v[:-1], i[:-1], o[:-1]
        return {'ty': 'sh', 'ks': static({'c': closed, 'v': v, 'i': i, 'o': o})}


def rect(cx, cy, w, h, r):
    return {'ty': 'rc', 'p': static([cx, cy]), 's': static([w, h]), 'r': static(r)}


def ellipse(cx, cy, w, h):
    return {'ty': 'el', 'p': static([cx, cy]), 's': static([w, h])}


def fill(c, opacity=100):
    return {'ty': 'fl', 'c': static(rgb(c)), 'o': static(opacity), 'r': 1}


def stroke(c=INK, w=8, dash=None, opacity=100):
    s = {'ty': 'st', 'c': static(rgb(c)), 'o': static(opacity), 'w': static(w), 'lc': 2, 'lj': 2}
    if dash:
        s['d'] = [{'n': 'd', 'nm': 'dash', 'v': static(dash[0])}, {'n': 'g', 'nm': 'gap', 'v': static(dash[1])},
                  {'n': 'o', 'nm': 'offset', 'v': static(0)}]
    return s


def group(*items, name='g'):
    """items: shapes first, then stroke/fill. Earlier items paint on top, so stroke goes before fill."""
    return {'ty': 'gr', 'nm': name, 'it': list(items) + [{
        'ty': 'tr', 'p': static([0, 0]), 'a': static([0, 0]), 's': static([100, 100]),
        'r': static(0), 'o': static(100)}]}


def layer(name, groups, anchor=(W / 2, H / 2), pos=None, scale=None, rot=None, opacity=None, ip=0, op=END + 1):
    pos = pos if pos is not None else static(list(anchor))
    return {'ty': 4, 'nm': name, 'ddd': 0, 'sr': 1, 'ip': ip, 'op': op, 'st': 0, 'bm': 0, 'ao': 0,
            'ks': {'a': static(list(anchor) + [0]), 'p': pos if pos.get('a') else static(list(pos['k']) + [0]),
                   's': scale or static([100, 100, 100]), 'r': rot or static(0), 'o': opacity or static(100)},
            'shapes': groups}


def check_badge(cx=292, cy=34):
    """Green check that pops in at the start of 'done' and stays."""
    tick = Path(cx - 11, cy + 1).L(cx - 3, cy + 9).L(cx + 12, cy - 8)
    return layer('check', [
        group(tick.shape(False), stroke('#ffffff', 7), name='tick'),
        group(ellipse(cx, cy, 52, 52), stroke('#ffffff', 8), fill('#3fbf6f'), name='disc'),
    ], anchor=(cx, cy), ip=IDLE, op=END + 1,
        scale=anim([(IDLE, [0, 0, 100]), (IDLE + 9, [120, 120, 100]), (IDLE + 15, [100, 100, 100])], 'back'),
        rot=anim([(IDLE, -25), (IDLE + 12, 0)], 'out'))


def doc(name, layers):
    return {'v': '5.7.4', 'fr': FPS, 'ip': 0, 'op': END + 1, 'w': W, 'h': H, 'nm': name, 'ddd': 0,
            'assets': [], 'layers': layers,
            'markers': [{'tm': 0, 'cm': 'idle', 'dr': IDLE}, {'tm': IDLE, 'cm': 'done', 'dr': END - IDLE}]}


def star4(cx, cy, r):
    p = Path(cx, cy - r)
    q = r * 0.28
    p.L(cx + q, cy - q).L(cx + r, cy).L(cx + q, cy + q).L(cx, cy + r).L(cx - q, cy + q).L(cx - r, cy).L(cx - q, cy - q).L(cx, cy - r)
    return p.shape()


# ---------- icons ----------

def math_icon():
    def block(name, cx, color, inner, phase):
        cy = 112
        period = 38
        keys = [(0, [cx, cy]), (phase, [cx, cy])]
        for n in range(4):
            keys.append((phase + period // 2 * (n + 1), [cx, cy - 18 if n % 2 == 0 else cy]))
        keys.append((IDLE, [cx, cy]))
        keys.append((END, [cx, cy]))
        return layer(name, inner + [group(rect(cx, cy, 80, 80, 20), stroke(), fill(color), name='block')],
                     anchor=(cx, cy), pos=anim(keys))

    def pips(cx, cy, pts):
        return [group(*[ellipse(cx + dx, cy + dy, 14, 14) for dx, dy in pts], fill(INK), name='pips')]

    plus = Path(146, 112).H(174).shape(False), Path(160, 98).V(126).shape(False)
    eq_pill = [
        group(Path(136, 198).H(164).shape(False), Path(136, 212).H(164).shape(False), stroke('#ffffff', 7), name='eq'),
        group(star4(190, 205, 13), fill('#ffd23f'), name='star'),
        group(rect(160, 205, 128, 52, 26), stroke(), fill('#3fbf6f'), name='pill'),
    ]
    pill = layer('equals', eq_pill, anchor=(160, 205),
                 scale=anim([(0, [0, 0, 100]), (48, [0, 0, 100]), (56, [118, 118, 100]), (62, [100, 100, 100]),
                             (80, [100, 100, 100]), (88, [0, 0, 100]), (IDLE, [0, 0, 100]),
                             (IDLE + 8, [118, 118, 100]), (IDLE + 14, [100, 100, 100])], 'back'))
    return doc('math', [
        check_badge(),
        pill,
        block('b3', 272, '#ff8fb1', pips(272, 112, [(-16, -16), (16, -16), (-16, 16), (16, 16)]), 12),
        block('b2', 160, '#ffffff', [group(*plus, stroke(INK, 9), name='plus')], 6),
        block('b1', 48, '#ffd23f', pips(48, 112, [(-17, -17), (0, 0), (17, 17)]), 0),
    ])


def book_icon():
    left = Path(20, 68).C((80, 44), (124, 48), (160, 80)).V(220).C((124, 192), (80, 188), (20, 208)).L(20, 68).shape()
    right = Path(300, 68).C((240, 44), (196, 48), (160, 80)).V(220).C((196, 192), (240, 188), (300, 208)).L(300, 68).shape()
    lines = [Path(48, y).H(48 + w).shape(False) for y, w in ((108, 80), (132, 68), (156, 76))] + \
            [Path(192, y).H(192 + w).shape(False) for y, w in ((108, 80), (132, 64), (156, 72))]
    page = Path(160, 80).C((196, 52), (244, 52), (292, 72)).V(208).C((244, 192), (196, 196), (160, 220)).L(160, 80).shape()
    page_lines = [Path(192, y).H(192 + w).shape(False) for y, w in ((108, 80), (132, 64), (156, 72))]
    flip = layer('page', [group(*page_lines, stroke('#c7b3f5', 8), name='lines'),
                          group(page, stroke(), fill('#fff6ea'), name='page')], anchor=(160, 150),
                 scale=anim([(0, [100, 100, 100]), (18, [100, 100, 100]), (48, [-100, 100, 100]), (IDLE, [-100, 100, 100]),
                             (IDLE + 1, [100, 100, 100])], 'io'),
                 opacity=anim([(0, 100), (72, 100), (84, 0), (IDLE, 0), (IDLE + 1, 100)], 'io'))

    def sparkle(name, cx, cy, r, phase):
        keys, rots = [], []
        for t in range(0, END + 1, 27):
            f = t + phase
            if f > END: break
            on = (t // 27) % 2 == 0
            keys.append((f, [110 if on else 35] * 2 + [100]))
        if keys[0][0] > 0:
            keys.insert(0, (0, [35, 35, 100]))
        return layer(name, [group(star4(cx, cy, r), fill('#ffd23f'), name='star')], anchor=(cx, cy),
                     scale=anim(keys), rot=anim([(0, 0), (END, 180)], 'io'))

    burst = layer('burst', [group(star4(160, 40, 22), fill('#ffd23f'), name='s')], anchor=(160, 40), ip=IDLE,
                  scale=anim([(IDLE, [0, 0, 100]), (IDLE + 10, [140, 140, 100]), (IDLE + 18, [100, 100, 100])], 'back'),
                  rot=anim([(IDLE, 0), (IDLE + 18, 90)], 'out'))
    return doc('book', [
        check_badge(), burst,
        sparkle('spark1', 252, 22, 18, 0), sparkle('spark2', 52, 26, 13, 14),
        flip,
        layer('book', [group(*lines, stroke('#c7b3f5', 8), name='lines'),
                       group(left, stroke(), fill('#ffffff'), name='left'),
                       group(right, stroke(), fill('#fff6ea'), name='right')]),
    ])


def puzzle_icon():
    dx, dy = 24, -8
    X = lambda x: x + dx
    Y = lambda y: y + dy
    yellow = Path(X(48), Y(32)).H(X(132)).V(Y(64)).semi(X(132), Y(104), 1).V(Y(144)).H(X(48)).L(X(48), Y(32)).shape()
    pink = (Path(X(132), Y(32)).H(X(224)).V(Y(144)).H(X(180)).V(Y(124)).semi(X(140), Y(124), -1).V(Y(144))
            .H(X(132)).V(Y(104)).semi(X(132), Y(64), -1).L(X(132), Y(32)).shape())

    def white():
        return (Path(X(48), Y(144)).H(X(140)).V(Y(124)).semi(X(180), Y(124), 1).V(Y(144))
                .H(X(224)).V(Y(224)).H(X(48)).L(X(48), Y(144)).shape())

    home = [X(136), Y(184)]
    away = [home[0] + 34, home[1] - 58]
    piece = layer('piece', [group(white(), stroke(), fill('#ffffff'), name='piece')], anchor=tuple(home),
                  pos=anim([(0, away), (36, home), (IDLE - 12, home), (IDLE, away), (IDLE + 12, home), (END, home)], 'out'),
                  rot=anim([(0, 16), (36, 0), (IDLE - 12, 0), (IDLE, 16), (IDLE + 12, 0)], 'out'),
                  scale=anim([(0, [100, 100, 100]), (36, [100, 100, 100]), (41, [105, 105, 100]), (46, [100, 100, 100]),
                              (IDLE + 12, [100, 100, 100]), (IDLE + 17, [105, 105, 100]), (IDLE + 22, [100, 100, 100])], 'io'))
    ring = layer('ring', [group(ellipse(home[0], home[1], 184, 184), stroke('#ffffff', 8), name='ring')], anchor=tuple(home),
                 scale=anim([(0, [60, 60, 100]), (36, [60, 60, 100]), (58, [130, 130, 100]), (IDLE, [130, 130, 100]),
                             (IDLE + 12, [60, 60, 100]), (IDLE + 34, [130, 130, 100])], 'out'),
                 opacity=anim([(0, 0), (36, 0), (40, 90), (58, 0), (IDLE + 12, 0), (IDLE + 16, 90), (IDLE + 30, 0)], 'io'))
    slot = layer('slot', [group(white(), stroke(INK, 5, dash=(10, 12), opacity=45), fill('#ffffff', 30), name='slot')])
    return doc('puzzle', [
        check_badge(), ring, piece,
        layer('board', [group(pink, stroke(), fill('#ff8fb1'), name='pink'),
                        group(yellow, stroke(), fill('#ffd23f'), name='yellow')]),
        slot,
    ])


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lottie')
    os.makedirs(out, exist_ok=True)
    for build in (math_icon, book_icon, puzzle_icon):
        d = build()
        with open(os.path.join(out, d['nm'] + '.json'), 'w') as f:
            json.dump(d, f, separators=(',', ':'))
        print(d['nm'], os.path.getsize(os.path.join(out, d['nm'] + '.json')), 'bytes')
