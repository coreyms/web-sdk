#!/usr/bin/env python
"""
build_sky_flyers.py: THE SKY'S BIRDS AND BATS (2026-11-01), crisp silhouettes with a fluid flap cycle, replacing the
blurry Angry Mantis crows (birds.webp) and Corey's bat sheet traced over them (bats.webp).

  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/build_sky_flyers.py [--out DIR] [--ship] [--frames N]

Each flyer is a small 3D skeleton (body, head, beak or muzzle and ears, tail, two wings of an arm and a hand with
feather fingers or membrane spars) posed per frame and projected to the picture plane from ahead, beside and a
little below (YAW, PITCH: the old sheets' view, the near wing sweeping back behind the body, the far wing showing
past the head), rendered at SS x the cell and box-downsampled, so every edge is anti-aliased and nothing is painted.
Pure black with alpha; the game tints and dims it.

THE CYCLE (frames per row FRAMES, 16): frame 0 is the top of the stroke. The wings beat DOWN over the first DOWN
frames (7 of 16: the power stroke is the quick one) and come back UP over the rest, both eased so neither reversal
has a corner. On the way down the wing is straight and the fingers closed; on the way up the wrist bends, the hand
folds back and the fingers spread. The body sits lowest at the top of the stroke and rises through the downstroke
(a small bob baked into the frames; the game's own bob rides on top), the tail flicks the other way, the body pitches
a little with it. The bats: the same skeleton with a membrane between four long spars, a scalloped trailing edge, a
tail membrane between the ankles, ears, a snub muzzle, no beak; a snappier downstroke and a deeper fold on the way up.
The game's cycle numbers that know the frame count (constants SKY.bats.flapBob.downAt, the centre of the downstroke,
and glide.frame, the frame with the wings out level and fully spread, on the way down: on the way up the bat folds)
are printed at the end: set them by hand, with flapFps = frames / 0.533 s (the approved flap).

ROWS, like the old sheets: rows 0 to 2 are three individuals (proportions and view differ a little), drawn at the
flock's near size, row 3 the far row (drawn when a flock's depth is under farBelow), a touch softened. The cell of a
row is CELLS[kind][row] px, square: 3 physical px per CSS px at the largest the row is drawn on a 1440 x 900 desktop
at DPR 2 (cover fit 0.625 canvas px per frame px: birds near 31.8 x 1.15 = 36.6 frame px = 22.9 CSS px -> 69, bats
46.5 x 1.15 = 53.5 = 33.4 CSS px -> 100; the far rows at the largest size their depth allows). Every frame of a row
shares one transform (the whole cycle's box is fitted into the cell), so the flyer never jumps between frames.

OUTPUT (--out, default ~/Desktop/Manticore Mayhem/images/sky_flyers_r2; r1 was the first pass, 2026-11-01):
  frames/<kind>_<row>_<frame>.png      the cells
  atlas/<birds|bats>.json|webp         the atlases (lossless webp, exact), frame names bird_<row>_<frame>.png and
                                       bat_<row>_<frame>.png, the rows stacked, the frames left to right
  sheet_<kind>_4x.png                  a contact sheet of each atlas on a sky blue, 4x nearest, for a look
--ship copies the atlases into static/assets/backgrounds/scene/ and sets SCENE_SPEC.sky.birds (rows, framesPerRow)
in src/game/sceneSpec.ts; then `node scripts/stamp-assets.mjs`. tools/build_scene_assets.py --sky copies the same
atlases from --out (its --birds / --bats defaults), so a full sky rebuild keeps them.
"""
import argparse
import hashlib
import json
import math
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENE_OUT = os.path.join(APP, 'static', 'assets', 'backgrounds', 'scene')
SPEC_TS = os.path.join(APP, 'src', 'game', 'sceneSpec.ts')
DEFAULT_OUT = os.path.expanduser('~/Desktop/Manticore Mayhem/images/sky_flyers_r2')

SS = 4
FRAMES = 16
DOWN = 7 / 16  # the downstroke's share of the cycle (7 of 16 frames)
MARGIN = 2  # px of the cell kept clear on every side
CELLS = {'bird': [72, 72, 72, 48], 'bat': [100, 100, 100, 84]}
FAR_SOFTEN = {'bird': 0.55, 'bat': 0.45}  # gaussian radius (cell px) on the far row only
Y = np.array([0.0, 1.0, 0.0])
BACK = np.array([-1.0, 0.0, 0.0])


# ---- the view ----------------------------------------------------------------------------------------------------
def camera(yaw_deg: float, pitch_deg: float):
    """image right and up vectors for a camera ahead of the flyer by yaw (about y) and below it by pitch; the
    flyer faces +x, up is +y, its near wing is +z"""
    yaw, pitch = math.radians(yaw_deg), math.radians(pitch_deg)
    cpos = np.array([math.sin(yaw) * math.cos(pitch), math.sin(pitch), math.cos(yaw) * math.cos(pitch)])
    v = -cpos
    r = np.cross(v, Y)
    r /= np.linalg.norm(r)
    if r[0] < 0:
        r = -r
    u = np.cross(r, v)
    u /= np.linalg.norm(u)
    if u[1] < 0:
        u = -u
    return r, u


def unit(a):
    return a / np.linalg.norm(a)


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def smoother(x):
    x = min(1.0, max(0.0, x))
    return x * x * x * (x * (x * 6 - 15) + 10)


def rot_x(p, a):
    c, s = math.cos(a), math.sin(a)
    return np.array([p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]])


def rot_z(p, a):
    c, s = math.cos(a), math.sin(a)
    return np.array([c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]])


def hull(pts):
    """convex hull of (n, 2) points, monotone chain"""
    pts = sorted(set(map(tuple, pts)))
    if len(pts) < 3:
        return pts

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2 and (out[-1][0] - out[-2][0]) * (p[1] - out[-2][1]) - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0]) <= 0:
                out.pop()
            out.append(p)
        return out

    lower, upper = half(pts), half(pts[::-1])
    return lower[:-1] + upper[:-1]


_SPHERE = None


def sphere_points(n=400):
    global _SPHERE
    if _SPHERE is None:
        i = np.arange(n) + 0.5
        phi = np.arccos(1 - 2 * i / n)
        theta = math.pi * (1 + 5 ** 0.5) * i
        _SPHERE = np.stack([np.cos(theta) * np.sin(phi), np.sin(theta) * np.sin(phi), np.cos(phi)], -1)
    return _SPHERE


class View:
    def __init__(self, yaw, pitch):
        self.r, self.u = camera(yaw, pitch)

    def p(self, pts):
        pts = np.asarray(pts, float).reshape(-1, 3)
        return np.stack([pts @ self.r, pts @ self.u], -1)

    def ellipsoid(self, centre, semi, pitch=0.0, yaw=0.0):
        """the silhouette of an ellipsoid (semi-axes along the flyer's x y z, pitched about z, yawed about y)"""
        pts = sphere_points() * np.asarray(semi)
        c, s = math.cos(pitch), math.sin(pitch)
        pts = pts @ np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])
        if yaw:
            c, s = math.cos(yaw), math.sin(yaw)
            pts = pts @ np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]])
        return np.array(hull(self.p(pts + np.asarray(centre))))

    def sphere(self, centre, r, n=40):
        c = self.p(centre)[0]
        a = np.linspace(0, 2 * math.pi, n, endpoint=False)
        return np.stack([c[0] + r * np.cos(a), c[1] + r * np.sin(a)], -1)


# ---- the skeletons -----------------------------------------------------------------------------------------------
def phase(t):
    """t in [0, 1): (down, u) with u the eased 0..1 progress of the stroke; lift 0 low .. 1 high of the body"""
    if t < DOWN:
        u = t / DOWN
        return True, u
    return False, (t - DOWN) / (1 - DOWN)


def wing_frame(theta, sweep):
    """span direction of a wing at dihedral theta (rad, + up) and sweep (rad, back), near wing (+z)"""
    return np.array([-math.sin(sweep), math.cos(sweep) * math.sin(theta), math.cos(sweep) * math.cos(theta)])


def chord_dir(s):
    c = BACK - (BACK @ s) * s
    return unit(c)


def taper(root, tip, w0, w1, n):
    """a tapered quad from root to tip of half widths w0, w1 in the plane with normal n (3D points)"""
    d = unit(tip - root)
    o = unit(np.cross(n, d))
    return np.array([root - o * w0, tip - o * w1, tip + o * w1, root + o * w0])


def bird_polys(view: View, t: float, V: dict):
    """one frame of a crow: a list of 2D polygons (flyer units). V: the variant's proportions"""
    down, u = phase(t)
    th_up, th_dn = math.radians(V['thetaUp']), math.radians(V['thetaDown'])
    if down:
        e = smoother(u)
        theta = th_up + (th_dn - th_up) * e
        lift = smooth(u)
        fold, spread, hsweep = 0.0, 0.0, 0.0
    else:
        e = smoother(u)
        theta = th_dn + (th_up - th_dn) * e
        lift = 1 - smooth(u)
        bump = math.sin(math.pi * u)
        fold = bump ** 1.1
        spread = bump
        hsweep = bump
    polys = []
    body_pitch = math.radians(V['pitch'] + 2 * (lift - 0.5))
    bob = np.array([0.0, V['bob'] * (lift - 0.5), 0.0])
    # body, neck, head, beak: the head sits forward on a short thick neck, the beak straight along the body's line
    body_c = np.array([0.0, 0.0, 0.0]) + bob
    polys.append(view.ellipsoid(body_c, V['body'], pitch=body_pitch))
    head_c = rot_z(np.array([V['body'][0] + V['head'] * 0.35, V['body'][1] * 0.3, 0.0]), body_pitch) + bob
    polys.append(view.sphere(head_c, V['head']))
    neck = taper(body_c + rot_z(np.array([V['body'][0] * 0.5, 0.01, 0]), body_pitch), head_c, V['body'][1] * 0.95, V['head'] * 0.95, np.array([0, 0, 1.0]))
    polys.append(view.p(neck))
    beak_root = head_c
    beak_tip = head_c + rot_z(np.array([V['head'] + V['beak'], -V['head'] * 0.12, 0]), body_pitch)
    polys.append(view.p(taper(beak_root, beak_tip, V['head'] * 0.66, 0.012, np.array([0, 0, 1.0]))))
    polys.append(view.p(taper(beak_root, beak_tip, V['head'] * 0.5, 0.012, np.array([0, 1.0, 0]))))
    # the tail: a fan from under the body's rear, flicking against the body
    flick = math.radians(-V['flick'] * (lift - 0.5))
    tr = np.array([-V['body'][0] * 0.75, -0.02, 0.0])
    tail = []
    for z in (-1, 1):
        tail.append(tr + np.array([0.0, 0.0, z * V['body'][2] * 0.35]))
    for z in (1, 0.35, -0.35, -1):
        tail.append(tr + np.array([-V['tail'], -0.01 if abs(z) > 0.5 else 0.0, z * V['tailW']]))
    tail = [rot_z(p, body_pitch + flick) + bob for p in tail]
    polys.append(view.p([tail[0], tail[1], tail[2], tail[3], tail[4], tail[5]]))
    # the wings
    for side in (1, -1):
        S = np.array([V['shoulderX'], V['shoulderY'], side * V['shoulderZ']]) + bob
        s_a = wing_frame(theta, math.radians(V['sweepArm']))
        th_h = theta + math.radians(-V['arch'] - V['fold'] * fold)
        s_h = wing_frame(th_h, math.radians(V['sweepArm'] + V['sweepHand'] * hsweep + 6))
        if side < 0:
            s_a = s_a * np.array([1, 1, -1])
            s_h = s_h * np.array([1, 1, -1])
        c_a, c_h = chord_dir(s_a), chord_dir(s_h)
        n_h = np.cross(s_h, c_h)
        A, H = V['arm'] * (1 if side > 0 else V['farScale']), V['hand'] * (1 if side > 0 else V['farScale'])
        W = S + s_a * A
        T = W + s_h * H
        # the membrane: leading edge, the hand's trailing edge (the finger roots), the secondaries' bulge
        le = [S - c_a * 0.05, S + s_a * A * 0.5 - c_a * 0.06, W - c_h * 0.03, T]
        nf = V['fingers']
        roots = []
        for i in range(nf):
            k = i / (nf - 1)
            uu = A + H * (V['rootFrom'] + (1 - V['rootFrom']) * k)
            w = V['chordHand'] * (1 - 0.72 * k)
            roots.append(W + s_h * (uu - A) + c_h * w)
        te = [W + c_h * V['chordHand'], S + s_a * A * 0.45 + c_a * V['chordArm'] * 1.08, S + c_a * V['chordArm'] * 0.9, S + c_a * V['chordArm'] * 0.45 - np.array([0, 0.03, 0])]
        polys.append(view.p(le + roots[::-1] + te))
        # the primaries: a fan from the roots, closed on the way down, spread on the way up; the middle ones longest
        a0 = math.radians(V['fingerBase'])
        da = math.radians(V['fingerClosed'] + (V['fingerSpread'] - V['fingerClosed']) * spread)
        for i, root in enumerate(roots):
            k = i / (nf - 1)
            a = a0 + da * (nf - 1 - i)
            d = s_h * math.cos(a) + c_h * math.sin(a)
            length = V['finger'] * (0.78 + 0.22 * math.sin(math.pi * (0.25 + 0.75 * k))) * (1 if side > 0 else V['farScale'])
            tip = root + d * length
            polys.append(view.p(taper(root, tip, V['fingerW'], V['fingerW'] * 0.3, n_h)))
    return polys


def bat_polys(view: View, t: float, V: dict):
    down, u = phase(t)
    th_up, th_dn = math.radians(V['thetaUp']), math.radians(V['thetaDown'])
    if down:
        # the snap: quick off the top, easing into the bottom
        e = 1 - (1 - u) ** 2.2 if u < 1 else 1.0
        e = e * (1 - smooth(u)) + smoother(u) * smooth(u)
        theta = th_up + (th_dn - th_up) * e
        lift = smooth(u)
        fold, close, hsweep = 0.0, 0.0, 0.0
    else:
        e = smoother(u)
        theta = th_dn + (th_up - th_dn) * e
        lift = 1 - smooth(u)
        bump = math.sin(math.pi * u)
        fold = bump ** 0.9
        close = bump
        hsweep = bump
    polys = []
    body_pitch = math.radians(V['pitch'] + 6 * (lift - 0.5))
    bob = np.array([0.0, V['bob'] * (lift - 0.5), 0.0])
    body_c = bob
    polys.append(view.ellipsoid(body_c, V['body'], pitch=body_pitch))
    head_c = rot_z(np.array([V['body'][0] + 0.03, V['body'][1] * 0.45, 0.0]), body_pitch) + bob
    polys.append(view.sphere(head_c, V['head']))
    polys.append(view.p(taper(body_c + rot_z(np.array([V['body'][0] * 0.5, 0.03, 0]), body_pitch), head_c, V['body'][1] * 0.8, V['head'] * 0.85, np.array([0, 0, 1.0]))))
    muzzle = head_c + rot_z(np.array([V['head'] * 0.8, -0.03, 0]), body_pitch)
    polys.append(view.ellipsoid(muzzle, (V['head'] * 0.6, V['head'] * 0.42, V['head'] * 0.5), pitch=body_pitch))
    # ears: two leaves on the crown, leaning back
    for z in (1, -1):
        base = head_c + np.array([-0.01, V['head'] * 0.75, z * V['head'] * 0.5])
        tip = base + np.array([-0.04, V['ear'], z * 0.03])
        polys.append(view.p(taper(base, tip, V['head'] * 0.42, 0.006, np.array([0, 0, 1.0]))))
        polys.append(view.p(taper(base, tip, V['head'] * 0.3, 0.006, np.array([1.0, 0, 0]))))
    # r2 (Corey 2026-11-01: "some object stuck between their legs on each clip that shouldn't be there": the tail
    # membrane hung off hairline legs as a loose piece). Short thick legs the membrane ends on, inside the body's
    # outline, and a short tail stub on the body's rear; nothing hangs below
    ankles = []
    for side in (1, -1):
        hip = np.array([-V['body'][0] * 0.6, -V['body'][1] * 0.35, side * V['body'][2] * 0.55]) + bob
        ankle = hip + np.array([-0.10, -0.05, side * 0.04])
        ankles.append(ankle)
        polys.append(view.p(taper(hip, ankle, 0.05, 0.03, np.array([0, 0, 1.0]))))
    rear = rot_z(np.array([-V['body'][0] * 0.9, -0.01, 0.0]), body_pitch) + bob
    polys.append(view.p(taper(rear, rear + np.array([-V['tail'], -0.03, 0]), 0.05, 0.012, np.array([0, 0, 1.0]))))
    # the wings: an arm to the wrist, four spars from the wrist, the membrane between them and down to the ankle
    for side, ankle in ((1, ankles[0]), (-1, ankles[1])):
        S = np.array([V['shoulderX'], V['shoulderY'], side * V['shoulderZ']]) + bob
        s_a = wing_frame(theta, math.radians(V['sweepArm']))
        th_h = theta + math.radians(-V['arch'] - V['fold'] * fold)
        s_h = wing_frame(th_h, math.radians(V['sweepArm'] + V['sweepHand'] * hsweep + 4))
        if side < 0:
            s_a = s_a * np.array([1, 1, -1])
            s_h = s_h * np.array([1, 1, -1])
        c_h = chord_dir(s_h)
        A, H = V['arm'] * (1 if side > 0 else V['farScale']), V['hand'] * (1 if side > 0 else V['farScale'])
        W = S + s_a * A
        tips = []
        angles = V['spars']
        k_close = 1 - V['sparClose'] * close
        for i, (ang, L) in enumerate(zip(angles, V['sparLen'])):
            a = math.radians(ang * k_close + 1.5 * i)
            d = s_h * math.cos(a) + c_h * math.sin(a)
            tips.append(W + d * H * L)
        # the thumb: a small hook at the wrist on the leading edge
        thumb = W + s_h * 0.04 - c_h * 0.045
        edge = [S - np.array([0.0, 0, 0]) + np.array([0.03, 0.02, 0]), S + s_a * A * 0.5 + np.array([0.0, 0.0, 0.0]) + s_a * 0 - chord_dir(s_a) * 0.02, W - c_h * 0.015, thumb, W + s_h * 0.06, tips[0]]
        # the trailing edge: scallops between the spar tips, then to the ankle
        chain = tips + [ankle]
        pts = [tips[0]]
        for a, b in zip(chain[:-1], chain[1:]):
            depth = V['scallop']
            for q in (0.25, 0.5, 0.75):
                m = a + (b - a) * q
                pts.append(m + (W - m) * depth * 4 * q * (1 - q))
            pts.append(b)
        hip = np.array([-V['body'][0] * 0.7, -V['body'][1] * 0.3, side * V['body'][2] * 0.6]) + bob
        polys.append(view.p(edge + pts[1:] + [hip, S + np.array([-V['body'][0] * 0.3, -0.02, side * V['body'][2] * 0.5])]))
        # the spars as thin dark lines: inside the membrane they only matter at the tips, where they point the scallops
        n_h = np.cross(s_h, c_h)
        for tip in tips if side > 0 else ():
            polys.append(view.p(taper(W, tip + unit(tip - W) * 0.012, 0.014, 0.004, n_h)))
    return polys


# ---- the variants ------------------------------------------------------------------------------------------------
# r2 (Corey 2026-11-01 on the r1 card: "The tails on the birds are too long, the wings don't have enough fray, the beaks
# don't read as crow beaks. The previous version had a better profile. Also the upward angle makes them read as geese
# instead of crows."): the old sheet's profile. A flat lozenge body with a slight nose-down, a heavy head on a short
# thick neck, a thick straight beak, a short fan tail, five long separated primaries on both wings in every frame.
CROW = dict(body=(0.52, 0.17, 0.15), head=0.16, beak=0.30, pitch=-3, bob=0.04, flick=6, tail=0.28, tailW=0.21,
            shoulderX=0.12, shoulderY=0.08, shoulderZ=0.10, arm=0.42, hand=0.50, farScale=0.8, thetaUp=58, thetaDown=-48,
            sweepArm=8, sweepHand=28, arch=4, fold=32, chordArm=0.40, chordHand=0.26, rootFrom=0.3,
            fingers=5, finger=0.38, fingerW=0.028, fingerBase=6, fingerClosed=8, fingerSpread=13, view=(28, -30))
BIRD_ROWS = [
    CROW,
    dict(CROW, body=(0.50, 0.15, 0.13), head=0.14, arm=0.46, hand=0.56, tail=0.32, tailW=0.19, thetaUp=62, thetaDown=-44, finger=0.40, view=(22, -26)),
    dict(CROW, body=(0.54, 0.18, 0.16), head=0.16, arm=0.40, hand=0.46, tail=0.26, tailW=0.23, thetaUp=55, thetaDown=-52, fingerW=0.028, view=(36, -34)),
    dict(CROW, view=(28, -30)),
]
BAT = dict(body=(0.36, 0.17, 0.15), head=0.115, ear=0.19, pitch=10, bob=0.06, tail=0.12,
           shoulderX=0.12, shoulderY=0.09, shoulderZ=0.10, arm=0.40, hand=0.72, farScale=0.8, thetaUp=72, thetaDown=-56,
           sweepArm=6, sweepHand=30, arch=4, fold=38, spars=(2, 20, 42, 68), sparLen=(1.0, 0.97, 0.86, 0.62), sparClose=0.3,
           scallop=0.25, view=(30, -38))
BAT_ROWS = [
    BAT,
    dict(BAT, body=(0.34, 0.16, 0.15), ear=0.24, hand=0.80, spars=(2, 18, 40, 66), sparLen=(1.0, 0.98, 0.9, 0.66), view=(24, -34)),
    dict(BAT, body=(0.40, 0.19, 0.17), head=0.13, ear=0.16, hand=0.64, thetaUp=68, thetaDown=-60, spars=(3, 24, 48, 72), sparLen=(1.0, 0.94, 0.8, 0.56), scallop=0.3, view=(38, -42)),
    dict(BAT, view=(30, -38)),
]
KINDS = {'bird': (bird_polys, BIRD_ROWS), 'bat': (bat_polys, BAT_ROWS)}


# ---- rendering ---------------------------------------------------------------------------------------------------
def render_row(kind: str, row: int, frames: int, soften: float):
    fn, rows = KINDS[kind]
    V = rows[row]
    view = View(*V['view'])
    cell = CELLS[kind][row]
    cycle = [fn(view, f / frames, V) for f in range(frames)]
    allpts = np.concatenate([p for polys in cycle for p in polys])
    lo, hi = allpts.min(0), allpts.max(0)
    span = (hi - lo).max()
    scale = (cell - 2 * MARGIN) / span
    centre = (lo + hi) / 2
    out = []
    for polys in cycle:
        im = Image.new('L', (cell * SS, cell * SS), 0)
        d = ImageDraw.Draw(im)
        for poly in polys:
            q = (poly - centre) * scale
            px = [(float(cell / 2 + x) * SS, float(cell / 2 - y) * SS) for x, y in q]
            if len(px) >= 3:
                d.polygon(px, fill=255)
        a = im.reduce(SS)
        if soften:
            a = a.filter(ImageFilter.GaussianBlur(soften))
        frame = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
        frame.putalpha(a)
        out.append(frame)
    return out


def pack(kind: str, rows: list, prefix: str):
    """the rows stacked, each row's frames left to right; returns (atlas, frames dict)"""
    widths = [len(r) * r[0].width for r in rows]
    aw, ah = max(widths), sum(r[0].height for r in rows)
    atlas = Image.new('RGBA', (aw, ah), (0, 0, 0, 0))
    frames = {}
    y = 0
    for r, row in enumerate(rows):
        x = 0
        for f, im in enumerate(row):
            atlas.paste(im, (x, y))
            w, h = im.size
            frames[f'{prefix}_{r}_{f}.png'] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': False,
                                              'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'sourceSize': {'w': w, 'h': h}}
            x += w
        y += row[0].height
    return atlas, frames


def write_atlas(folder: str, name: str, atlas: Image.Image, frames: dict) -> int:
    os.makedirs(folder, exist_ok=True)
    webp = os.path.join(folder, f'{name}.webp')
    atlas.save(webp, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    meta = {'image': f'{name}.webp', 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1',
            'pngHash': hashlib.md5(open(webp, 'rb').read()).hexdigest()[:8]}
    open(os.path.join(folder, f'{name}.json'), 'w').write(json.dumps({'frames': frames, 'meta': meta}, indent=1) + '\n')
    return os.path.getsize(webp)


def contact(atlas: Image.Image, path: str, k: int = 4):
    bg = Image.new('RGBA', atlas.size, (140, 170, 210, 255))
    bg.alpha_composite(atlas)
    bg.resize((atlas.width * k, atlas.height * k), Image.NEAREST).save(path)


def ship(out: str, frames: int, rows: int, kinds=('birds', 'bats')):
    for name in kinds:
        for ext in ('json', 'webp'):
            data = open(os.path.join(out, 'atlas', f'{name}.{ext}'), 'rb').read()
            open(os.path.join(SCENE_OUT, f'{name}.{ext}'), 'wb').write(data)
    src = open(SPEC_TS).read()
    new, n = re.subn(r'"birds": \{\s*"rows": \d+,\s*"framesPerRow": \d+\s*\}', f'"birds": {{\n\t\t\t"rows": {rows},\n\t\t\t"framesPerRow": {frames}\n\t\t}}', src)
    if n != 1:
        sys.exit(f'sceneSpec.ts: the sky.birds block was not found once ({n})')
    if new != src:
        open(SPEC_TS, 'w').write(new)
    print(f'shipped {", ".join(kinds)} to {SCENE_OUT}; SCENE_SPEC.sky.birds = rows {rows}, framesPerRow {frames}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=DEFAULT_OUT)
    ap.add_argument('--frames', type=int, default=FRAMES)
    ap.add_argument('--ship', nargs='*', default=None, help='copy the atlases into the game and set SCENE_SPEC.sky.birds; `--ship bats` ships one kind only (2026-11-01: the r2 bats went in alone, the birds stayed r1)')
    args = ap.parse_args()
    frames = args.frames
    os.makedirs(os.path.join(args.out, 'frames'), exist_ok=True)
    for kind, name in (('bird', 'birds'), ('bat', 'bats')):
        rows = []
        for r in range(len(KINDS[kind][1])):
            far = r == len(KINDS[kind][1]) - 1
            row = render_row(kind, r, frames, FAR_SOFTEN[kind] if far else 0.0)
            for f, im in enumerate(row):
                im.save(os.path.join(args.out, 'frames', f'{kind}_{r}_{f}.png'))
            rows.append(row)
        atlas, fr = pack(kind, rows, kind)
        nbytes = write_atlas(os.path.join(args.out, 'atlas'), name, atlas, fr)
        contact(atlas, os.path.join(args.out, f'sheet_{kind}_4x.png'))
        print(f'{name}: {atlas.width} x {atlas.height}, {len(rows)} rows of {frames} frames, cells {[c for c in CELLS[kind]]}, webp {nbytes / 1024:.1f} KiB')
    down_frames = frames * DOWN
    print(f'cycle: {frames} frames, downstroke frames 0 .. {down_frames:g} (centre {down_frames / 2:g} = SKY.bats.flapBob.downAt), '
          f'wings level and fully spread on the way down at frame {int(down_frames / 2)} (SKY.bats.glide.frame, every row); '
          f'flapFps {frames / (8 / 15):g} keeps the approved 0.533 s flap')
    if args.ship is not None:
        ship(args.out, frames, len(BIRD_ROWS), tuple(args.ship) or ('birds', 'bats'))


if __name__ == '__main__':
    main()
