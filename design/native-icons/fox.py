#!/usr/bin/env python3
"""Tuto (the fox companion) as one Lottie file with two markers.

  idle   frames 0-120   4 s seamless loop: breathing, blink, tail wag, head tilt
  cheer  frames 120-168 plays once on a correct answer: squash, jump, happy face, wave, sparkles;
                        ends on the idle pose, so the app can go straight back to 'idle'

260x330 @ 30 fps, transparent. Geometry is the design canvas's 220x240 fox, offset by a root null.
Run: python3 design/native-icons/fox.py -> design/native-icons/lottie/fox.json
"""
import json
import os

from build import INK, Path, anim, ellipse, fill, rgb, star4, static, stroke

W, H, FPS = 260, 330, 30
IDLE, CHEER_END = 120, 168
ORANGE, CREAM, EAR, STRIPE, TEAL, BROWN = '#ff8a2a', '#fff6ea', '#ffc39a', '#e8701a', '#2ec4a6', '#6b3e26'


def hold(keys):
    """Step keyframes (no tween) for switching faces on and off."""
    return {'a': 1, 'k': [{'t': f, 's': v if isinstance(v, list) else [v], 'h': 1} for f, v in keys]}


def q(p0, c, p2):
    """Quadratic control point -> the two cubic handles."""
    return ((p0[0] + 2 / 3 * (c[0] - p0[0]), p0[1] + 2 / 3 * (c[1] - p0[1])),
            (p2[0] + 2 / 3 * (c[0] - p2[0]), p2[1] + 2 / 3 * (c[1] - p2[1])))


def grp(*items, name='g', anchor=(0, 0), rot=0, opacity=100):
    return {'ty': 'gr', 'nm': name, 'it': list(items) + [{
        'ty': 'tr', 'p': static(list(anchor)), 'a': static(list(anchor)), 's': static([100, 100]),
        'r': static(rot), 'o': static(opacity)}]}


def lyr(ind, name, shapes, anchor, parent=None, pos=None, scale=None, rot=None, opacity=None, ip=0, op=CHEER_END + 1, null=False):
    ks = {'a': static(list(anchor) + [0]), 'p': pos or static(list(anchor) + [0]),
          's': scale or static([100, 100, 100]), 'r': rot or static(0), 'o': opacity or static(100)}
    L = {'ty': 3 if null else 4, 'ind': ind, 'nm': name, 'ddd': 0, 'sr': 1, 'ip': ip, 'op': op, 'st': 0,
         'bm': 0, 'ao': 0, 'ks': ks}
    if not null:
        L['shapes'] = shapes
    if parent:
        L['parent'] = parent
    return L


def closed(p):
    return p.shape()


def build():
    # ---- geometry (design-canvas coordinates) ----
    head = Path(110, 36).C((160, 36), (178, 70), (176, 100)).C((174, 132), (146, 146), (110, 146)) \
        .C((74, 146), (46, 132), (44, 100)).C((42, 70), (60, 36), (110, 36)).shape()
    mask = Path(58, 106).C((72, 96), (94, 102), (110, 114)).C((126, 102), (148, 96), (162, 106)) \
        .C((158, 132), (136, 142), (110, 142)).C((84, 142), (62, 132), (58, 106)).shape()
    stripe = Path(98, 40).C(*q((98, 40), (110, 60), (122, 40)), (122, 40)).L(98, 40).shape()
    ears = [Path(52, 70).L(40, 12).L(92, 48).L(52, 70).shape(), Path(168, 70).L(180, 12).L(128, 48).L(168, 70).shape()]
    inner = [Path(56, 58).L(50, 26).L(80, 46).L(56, 58).shape(), Path(164, 58).L(170, 26).L(140, 46).L(164, 58).shape()]
    body = Path(66, 218).C((58, 170), (76, 138), (110, 138)).C((144, 138), (162, 170), (154, 218)).L(66, 218).shape()
    belly = Path(88, 216).C((84, 184), (94, 166), (110, 166)).C((126, 166), (136, 184), (132, 216)).L(88, 216).shape()
    scarf_band = Path(70, 140).C(*q((70, 140), (110, 160), (150, 140)), (150, 140)).L(148, 156) \
        .C(*q((148, 156), (110, 176), (72, 156)), (72, 156)).L(70, 140).shape()
    scarf_end = Path(126, 158).L(136, 192).L(152, 186).L(142, 154).L(126, 158).shape()
    tail = Path(138, 196).C((196, 200), (214, 138), (190, 100)).C((176, 128), (160, 146), (132, 160)).L(138, 196).shape()
    tip = Path(190, 100).C((204, 118), (208, 140), (200, 158)).C((188, 148), (182, 128), (190, 100)).shape()
    smile = Path(100, 124).C(*q((100, 124), (110, 136), (120, 124)), (120, 124)).shape(False)
    grin = Path(96, 122).C(*q((96, 122), (110, 142), (124, 122)), (124, 122)).L(96, 122).shape()
    happy = [Path(74, 94).C(*q((74, 94), (84, 80), (94, 94)), (94, 94)).shape(False),
             Path(126, 94).C(*q((126, 94), (136, 80), (146, 94)), (146, 94)).shape(False)]

    ROOT, HEAD = 1, 2
    base = [130, 310, 0]   # feet (110, 230) + offset (20, 80)
    up = [130, 274, 0]

    root = lyr(ROOT, 'root', None, (110, 230), null=True,
               pos=anim([(0, base), (IDLE, base), (126, base), (136, up), (146, base), (CHEER_END, base)], 'io'),
               scale=anim([(0, [100, 100, 100]), (30, [100, 102, 100]), (60, [100, 100, 100]), (90, [100, 102, 100]),
                           (IDLE, [100, 100, 100]), (126, [110, 90, 100]), (136, [94, 107, 100]), (146, [108, 92, 100]),
                           (154, [100, 100, 100]), (CHEER_END, [100, 100, 100])], 'io'))

    head_l = lyr(HEAD, 'head', [
        grp(ellipse(110, 114, 18, 13), fill(INK), name='nose'),
        grp(ellipse(66, 118, 18, 10), ellipse(154, 118, 18, 10), fill('#ff7aa2', 55), name='blush'),
        grp(stripe, fill(STRIPE), name='stripe'),
        grp(mask, fill(CREAM), name='mask'),
        grp(head, stroke(INK, 5), fill(ORANGE), name='head'),
        grp(*inner, fill(EAR), name='inner ears'),
        grp(*ears, stroke(INK, 5), fill(ORANGE), name='ears'),
    ], (110, 140), parent=ROOT,
        rot=anim([(0, 0), (30, 3), (60, 0), (90, -3), (IDLE, 0), (130, -6), (146, 4), (158, 0), (CHEER_END, 0)], 'io'))

    on_idle = [(0, 100), (IDLE + 2, 0), (160, 100)]
    on_cheer = [(0, 0), (IDLE + 2, 100), (160, 0)]
    eyes = lyr(3, 'eyes', [
        grp(ellipse(88, 86, 10, 10), ellipse(140, 86, 10, 10), ellipse(80, 98, 5, 5), ellipse(132, 98, 5, 5),
            fill('#ffffff'), name='shine'),
        grp(ellipse(84, 92, 24, 30), ellipse(136, 92, 24, 30), fill(INK), name='pupils'),
    ], (110, 92), parent=HEAD, opacity=hold(on_idle),
        scale=anim([(0, [100, 100, 100]), (64, [100, 100, 100]), (68, [100, 8, 100]), (72, [100, 100, 100]),
                    (104, [100, 100, 100]), (107, [100, 8, 100]), (110, [100, 100, 100])], 'io'))
    eyes_happy = lyr(4, 'eyes happy', [grp(*happy, stroke(INK, 5), name='arcs')], (110, 90), parent=HEAD, opacity=hold(on_cheer))
    mouth = lyr(5, 'smile', [grp(smile, stroke(INK, 4), name='smile')], (110, 128), parent=HEAD, opacity=hold(on_idle))
    mouth_open = lyr(6, 'grin', [grp(grin, stroke(INK, 4), fill('#ff6f7f'), name='grin')], (110, 128), parent=HEAD,
                     opacity=hold(on_cheer))

    arm_r = lyr(7, 'arm wave', [grp(ellipse(174, 152, 24, 44), stroke(INK, 5), fill(ORANGE), name='arm', anchor=(174, 152), rot=-55)],
                (152, 166), parent=ROOT,
                rot=anim([(0, 0), (30, -6), (60, 0), (90, -6), (IDLE, 0), (124, -40), (132, -8), (140, -40), (148, -8),
                          (156, 0), (CHEER_END, 0)], 'io'))

    body_l = lyr(8, 'body', [
        grp(scarf_end, stroke(INK, 5), fill(TEAL), name='scarf end'),
        grp(scarf_band, stroke(INK, 5), fill(TEAL), name='scarf'),
        grp(ellipse(64, 182, 24, 40), stroke(INK, 5), fill(ORANGE), name='arm left', anchor=(64, 182), rot=20),
        grp(belly, fill(CREAM), name='belly'),
        grp(body, stroke(INK, 5), fill(ORANGE), name='body'),
        grp(ellipse(86, 220, 40, 22), ellipse(134, 220, 40, 22), stroke(INK, 5), fill(BROWN), name='feet'),
    ], (110, 180), parent=ROOT)

    tail_l = lyr(9, 'tail', [
        grp(tip, stroke(INK, 5), fill(CREAM), name='tip'),
        grp(tail, stroke(INK, 5), fill(ORANGE), name='tail'),
    ], (140, 176), parent=ROOT,
        rot=anim([(0, 0), (15, 9), (45, -7), (75, 9), (105, -7), (IDLE, 0), (128, 16), (136, -12), (144, 16), (152, -8),
                  (160, 0), (CHEER_END, 0)], 'io'))

    def sparkle(ind, x, y, r, t0):
        return lyr(ind, 'sparkle', [grp(star4(x, y, r), fill('#ffd23f'), name='star')], (x, y), ip=IDLE, op=CHEER_END + 1,
                   scale=anim([(IDLE, [0, 0, 100]), (t0, [0, 0, 100]), (t0 + 6, [125, 125, 100]), (t0 + 12, [100, 100, 100]),
                               (t0 + 22, [100, 100, 100]), (t0 + 30, [0, 0, 100])], 'back'),
                   rot=anim([(t0, 0), (t0 + 30, 90)], 'out'))

    layers = [sparkle(20, 34, 104, 16, 132), sparkle(21, 222, 64, 20, 136), sparkle(22, 30, 200, 12, 140),
              eyes, eyes_happy, mouth, mouth_open, head_l, arm_r, body_l, tail_l, root]
    return {'v': '5.7.4', 'fr': FPS, 'ip': 0, 'op': CHEER_END + 1, 'w': W, 'h': H, 'nm': 'fox', 'ddd': 0,
            'assets': [], 'layers': layers,
            'markers': [{'tm': 0, 'cm': 'idle', 'dr': IDLE}, {'tm': IDLE, 'cm': 'cheer', 'dr': CHEER_END - IDLE}]}


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lottie', 'fox.json')
    with open(out, 'w') as f:
        json.dump(build(), f, separators=(',', ':'))
    print('fox', os.path.getsize(out), 'bytes')
