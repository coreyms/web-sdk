"""THE FREE SPINS DUSK ("Blue hour", Corey 2026-11-17: "Yes I like the 2 Blue Hour"; mock and the two candidates he did
not pick: ~/Desktop/Manticore Mayhem/feedback/freespins_dusk_2026-11-17/). The plain Free Spins (`bonus`) scene re-graded
from the files the game already shipped, so it reads as dusk at a glance instead of a second day. Nothing is painted or
generated: every output texel is a per-texel colour function (curves, split toning by luminance, a gradient map of the
sky that keeps the painting's own luminance texture, saturation) of the same texel of a shipped file, with soft masks
made from the files themselves (the sunset painting's own sky / land matte, luminance, the lit faces' warmth, a soft
ellipse on the citadel, the floor band).

  math-sdk/env/bin/python tools/build_sunset_dusk.py [--src DIR]

--src: the folder with the sunset painting as shipped before the dusk (backdrop-sunset[-phone].webp,
portrait-backdrop-sunset[-phone].webp; default ~/Desktop/_archive/manticore_sunset_old_2026-11-17, where they were moved
when the dusk shipped). The day foregrounds and day ridges are read from static/assets/backgrounds/scene/ (unchanged).
Writes into static/assets/backgrounds/scene/, both tiers (full, -phone), both scenes:
  backdrop-sunset, portrait-backdrop-sunset      the sunset painting re-graded (replaces the shipped painting)
  ridge-sunset, portrait-ridge-sunset            the graded painting's own skyline cut-out (NEW: the day cut-out does
                                                 not fit the sunset painting, whose left peaks are taller); alpha = the
                                                 sunset painting's own matte (build_scene_assets.py's sky_matte method on
                                                 it alone), RGB = the graded land, edge texels from the nearest pure land
  fore-sunset, portrait-fore-sunset              the DAY courtyard re-graded, its alpha byte for byte the day file's
                                                 (landscape: replaces the white overlay mask; portrait: NEW)
The skyline lies inside the shipped ridge boxes (SCENE_SPEC.sky.ridge, SCENE_SPEC_PORTRAIT.sky.ridge): checked, dies if not.
Webp at the build tool's qualities (backdrop 90, ridge 90 alpha 100, foreground 88 alpha 100); the backdrop is
dithered once before encoding (no banding in the sky gradient), the ridge cuts the same 8-bit texels.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENE = os.path.join(APP, 'static', 'assets', 'backgrounds', 'scene')
SRC_DEFAULT = os.path.expanduser('~/Desktop/_archive/manticore_sunset_old_2026-11-17')
FRAME = {'landscape': (2560, 1440), 'portrait': (1440, 2560)}
RIDGE_BOX = {'landscape': (0, 72, 2560, 400), 'portrait': (0, 376, 1440, 592)}  # SCENE_SPEC(.PORTRAIT).sky.ridge
Q = {'backdrop': 90, 'ridge': 90, 'fore': 88}
# the sky gradient's horizon row (frame px), the citadel's soft ellipse (centre, radii; frame px), the floor's start
HORIZON = {'landscape': 395.0, 'portrait': 590.0}
CITADEL = {'landscape': (1790.0, 300.0, 520.0, 200.0), 'portrait': (1000.0, 520.0, 300.0, 120.0)}
FLOOR = {'landscape': 0.66, 'portrait': 0.72}
# THE MATTE: build_scene_assets.py's constants (SKY_SMOOTH_DAY, SKY_PROBE, SKY_UNSURE, SKY_FEATHER)
SMOOTH, PROBE, UNSURE, FEATHER = 6.0, 2, 4, 0.7

# THE GRADE ("2 Blue hour" of the mock, unchanged). sky: (t, rgb) from the frame's top (0) to the horizon (1); land and
# fore: exposure, shadow / highlight tints split by luminance between lo and hi, saturation; rim: the lit faces near the
# skyline kept warm; citadel: its ellipse kept warm; floor: the courtyard floor's sheen kept partly gold
DUSK = {
    'sky': [(0.0, (22, 32, 92)), (0.3, (54, 54, 138)), (0.58, (112, 66, 156)), (0.8, (190, 78, 140)), (0.93, (226, 104, 116)), (1.0, (240, 140, 102))],
    'skyTex': 0.8,
    'land': dict(e=0.88, S=(0.56, 0.68, 1.18), H=(0.96, 0.86, 0.98), lo=0.1, hi=0.75, sat=0.72),
    'rim': dict(k=0.85, e=0.92, tint=(1.10, 0.86, 0.74)),
    'citadel': dict(k=0.6, e=0.92, tint=(1.10, 0.86, 0.72)),
    'fore': dict(e=0.88, S=(0.58, 0.68, 1.12), H=(0.98, 0.86, 0.94), lo=0.1, hi=0.7, sat=0.75),
    'floor': dict(k=0.35, tint=(1.0, 0.86, 0.72)),
}


def fname(layout, layer, tier):
    return f"{'' if layout == 'landscape' else 'portrait-'}{layer}{'-phone' if tier == 'phone' else ''}.webp"


def lum(rgb):
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def smooth(a, lo, hi):
    t = np.clip((a - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def rgba(path):
    return np.asarray(Image.open(path).convert('RGBA')).astype(np.float32) / 255


def dither8(x, seed):
    rng = np.random.default_rng(seed)
    n = (rng.random(x.shape, np.float32) - rng.random(x.shape, np.float32)) / 255
    return (np.clip(x + n, 0, 1) * 255 + 0.5).astype(np.uint8)


def matte(layout, painting):
    """the sunset painting's own land alpha (frame size) and its pure land texels: build_scene_assets.py sky_matte on
    this one painting (sky = a flood from the top through smooth texels, land = what reaches the bottom, the edge placed
    by colour between the nearest sure sky and sure land, feathered)"""
    FW, FH = FRAME[layout]
    x0, y0, x1, y1 = RIDGE_BOX[layout]
    rows = y1 + 120
    img = painting[:rows].astype(np.float64) * 255
    g = np.zeros(img.shape[:2])
    for c in range(3):
        g = np.maximum(g, np.hypot(ndi.gaussian_filter(img[..., c], 1.0, order=(0, 1)), ndi.gaussian_filter(img[..., c], 1.0, order=(1, 0))))
    sm = g < SMOOTH

    def reach(row, mask):
        seed = np.zeros_like(mask)
        seed[row] = True
        return ndi.binary_propagation(seed & mask, mask=mask)

    sky = reach(0, ndi.binary_erosion(sm, iterations=PROBE, border_value=1))
    sky = ndi.binary_propagation(sky, mask=sm & ndi.binary_dilation(sky, iterations=PROBE + 1))
    land = reach(-1, ~sky)
    sky = ~land
    sure_sky = ndi.binary_erosion(sky, iterations=UNSURE, border_value=1)
    sure_land = ndi.binary_erosion(land, iterations=UNSURE, border_value=1)
    _, (sy, sx) = ndi.distance_transform_edt(~sure_sky, return_indices=True)
    _, (ly, lx) = ndi.distance_transform_edt(~sure_land, return_indices=True)
    s_col, l_col = img[sy, sx], img[ly, lx]
    span = ((l_col - s_col) ** 2).sum(2)
    est = np.clip(((img - s_col) * (l_col - s_col)).sum(2) / np.maximum(span, 1e-6), 0, 1)
    unsure = ~(sure_sky | sure_land)
    weak = unsure & (span < 3 * 12 ** 2)
    est = np.where(unsure & ~weak, est, land.astype(float))
    hard = reach(-1, est > 0.5)
    hard = ~reach(0, ~hard)
    alpha = np.clip(ndi.gaussian_filter(hard.astype(float), FEATHER), 0, 1)
    alpha[alpha < 1 / 255] = 0
    pure = hard & (est > 0.97) & ndi.binary_erosion(hard, iterations=1, border_value=1)
    top = int((alpha > 0).argmax(0).min())
    low = int(np.nonzero((alpha < 1).any(1))[0].max())
    if top < y0 or low >= y1:
        sys.exit(f'{layout}: the sunset skyline (rows {top} to {low}) leaves the ridge box (rows {y0} to {y1}): the box would have to change')
    print(f'  {layout}: the sunset skyline is rows {top} to {low} of the frame, inside the ridge box {y0} to {y1}')
    A = np.ones((FH, FW), np.float32)
    P = np.ones((FH, FW), bool)
    A[:rows] = alpha
    P[:rows] = pure
    return A, P


def coords(layout, h, w):
    FW, FH = FRAME[layout]
    return np.meshgrid((np.arange(w) + 0.5) * FW / w, (np.arange(h) + 0.5) * FH / h)


def gradient(stops, t):
    ts = np.array([s[0] for s in stops])
    cs = np.array([s[1] for s in stops], np.float32) / 255
    return np.stack([np.interp(t, ts, cs[:, c]) for c in range(3)], -1)


def tone(img, p):
    w = smooth(lum(img)[..., None], p['lo'], p['hi'])
    out = img * p['e'] * (np.array(p['S']) * (1 - w) + np.array(p['H']) * w)
    Lo = lum(out)[..., None]
    return Lo + (out - Lo) * p['sat']


def grade_backdrop(img, A, P, layout, X, Y, C):
    _, (py, px) = ndi.distance_transform_edt(~P, return_indices=True)
    land_src = np.where(((A > 0) & ~P)[..., None], img[py, px], img)
    t = np.clip(Y / HORIZON[layout], 0, 1)
    Ls = lum(img)
    sky = A < 0.02
    row = np.array([Ls[i][sky[i]].mean() if sky[i].sum() > 8 else np.nan for i in range(Ls.shape[0])])
    good = ~np.isnan(row)
    row = np.interp(np.arange(len(row)), np.nonzero(good)[0], row[good])
    ratio = np.clip(Ls / np.maximum(row[:, None], 1e-3), 0.5, 1.6) ** C['skyTex']
    skyc = gradient(C['sky'], t) * ratio[..., None]
    land = tone(land_src, C['land'])
    L = lum(land_src)
    warmness = np.clip((land_src[..., 0] - land_src[..., 2]) * 3, 0, 1)
    x0, y0, x1, y1 = RIDGE_BOX[layout]
    rim = smooth(L, 0.35, 0.75) * warmness * (1 - smooth(Y, y0 + 40, y1 + 160)) * C['rim']['k']
    cx, cy, rx, ry = CITADEL[layout]
    cit = np.exp(-(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2) * 2.2) * C['citadel']['k']
    keep = np.clip(rim + cit, 0, 1)[..., None]
    wc = (cit / np.maximum(rim + cit, 1e-4))[..., None]
    warm = land_src * np.array(C['rim']['tint']) * C['rim']['e'] * (1 - wc) + land_src * C['citadel']['e'] * np.array(C['citadel']['tint']) * wc
    land = np.clip(land * (1 - keep) + warm * keep, 0, 1)
    a = A[..., None]
    return np.clip(skyc * (1 - a) + land * a, 0, 1), land


def grade_fore(img, layout, Y, C):
    out = tone(img, C['fore'])
    f = C['floor']
    m = (smooth(Y / FRAME[layout][1], FLOOR[layout], FLOOR[layout] + 0.05) * smooth(lum(img), 0.45, 0.85) * f['k'])[..., None]
    out = out * (1 - m) + img * np.array(f['tint']) * min(1.0, C['fore']['e'] * 1.5) * m
    return np.clip(out, 0, 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--src', default=SRC_DEFAULT, help='the sunset painting as shipped before the dusk')
    args = ap.parse_args()
    C = DUSK
    for layout in ('landscape', 'portrait'):
        full = rgba(os.path.join(args.src, fname(layout, 'backdrop-sunset', 'full')))[..., :3]
        A_full, P_full = matte(layout, full)
        for tier in ('full', 'phone'):
            src = full if tier == 'full' else rgba(os.path.join(args.src, fname(layout, 'backdrop-sunset', tier)))[..., :3]
            h, w = src.shape[:2]
            A, P = A_full, P_full
            if (h, w) != A.shape:
                A = np.clip(np.asarray(Image.fromarray(A_full).resize((w, h), Image.BILINEAR)), 0, 1)
                P = np.asarray(Image.fromarray(P_full.astype(np.uint8) * 255).resize((w, h), Image.NEAREST)) > 127
            X, Y = coords(layout, h, w)
            g, land = grade_backdrop(src, A, P, layout, X, Y, C)
            g8 = dither8(g, 1)
            out = []
            name = fname(layout, 'backdrop-sunset', tier)
            Image.fromarray(g8).save(os.path.join(SCENE, name), 'WEBP', quality=Q['backdrop'], method=6)
            out.append(name)
            rw, rh = Image.open(os.path.join(SCENE, fname(layout, 'ridge-day', tier))).size
            k = h / FRAME[layout][1]
            ya, yb = int(round(RIDGE_BOX[layout][1] * k)), int(round(RIDGE_BOX[layout][3] * k))
            assert (yb - ya, w) == (rh, rw), (layout, tier)
            r = np.concatenate([dither8(land[ya:yb], 2), (A[ya:yb, :, None] * 255 + 0.5).astype(np.uint8)], -1)
            name = fname(layout, 'ridge-sunset', tier)
            Image.fromarray(r).save(os.path.join(SCENE, name), 'WEBP', quality=Q['ridge'], method=6, alpha_quality=100)
            out.append(name)
            fore = rgba(os.path.join(SCENE, fname(layout, 'fore-day', tier)))
            fh, fw = fore.shape[:2]
            _, FY = coords(layout, fh, fw)
            q = np.concatenate([grade_fore(fore[..., :3], layout, FY, C), fore[..., 3:4]], -1)
            name = fname(layout, 'fore-sunset', tier)
            Image.fromarray((np.clip(q, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(SCENE, name), 'WEBP', quality=Q['fore'], method=6, alpha_quality=100)
            out.append(name)
            for n in out:
                im = Image.open(os.path.join(SCENE, n))
                print(f'  {n}: {im.size[0]} x {im.size[1]}, {os.path.getsize(os.path.join(SCENE, n)) / 1024:.1f} KB')


if __name__ == '__main__':
    main()
