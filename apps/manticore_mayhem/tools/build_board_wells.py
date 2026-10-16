"""THE BOARD WELLS (Corey 2026-10-16 16:40 "Well backgrounds look good"): the backing texture of the 64 board cells and
the glow of their veins (src/game/wells.ts, constants WELLS / WELLS_FX). Shipped: option D of the wells_r1 / r2
mockups, black marble cut from the Big Win plaque's own slab with continuous dull gold veins.

Per atlas four variants (crops / seeds) packed 2 x 2: 512 x 512 (256 px a cell; the desktop cell is ~99 CSS px at
1920 x 1080, ~198 device px at the DPR 2 cap) and a half atlas 256 x 256 (128 px a cell) for the phone tier (37 CSS px
a cell, 56 device px at the 1.5 cap, 111 at an allowlisted iPhone's 3x).
  board-wells[-half].webp       the wells, opaque RGB (lossy q 92)
  board-wells-glow[-half].webp  the same veins as light: opaque greyscale RGB, intensity = brightness, bloom baked
                                (lossy q 90). Drawn ADDITIVE, so its black adds nothing: no alpha channel to ship.

The cell texture covers the whole-cell box (bar centre line to bar centre line, symbolPlace.ts op.box), so its
outer HIDDEN px (half a lattice bar, ~3.7 % a side) sit under the frame's bars; nothing that matters is drawn there.

The other mockup options (A..F, C2, D1; palette notes below) are kept so the round can be re-rendered:
  board frame bronze (board-frame-landscape.webp) shadows 49 36 20, mid 105 70 38
  HUD plate bronze (ui/ChromeStyles.svelte --plate-bronze-2/3) 8f6636 / 5a3e1f, rivet 7a5529 -> d2a364
  board backdrop stone (board-backdrop.webp) 15 17 18
  win plaque marble (ui/board-plaque-*.webp) dark 54 37 23, veins 180 113 60

Run:  math-sdk/env/bin/python apps/manticore_mayhem/tools/build_board_wells.py               (the shipped D webps)
      math-sdk/env/bin/python apps/manticore_mayhem/tools/build_board_wells.py --mockups DIR [A,B,...]
                                                     (PNG atlases + loose 256 px variants of the mockup options)
"""

import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter

N = 256
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'static', 'assets', 'ui')
# the share of a side hidden under half a lattice bar (bar radius 2.95 screen px on a 79.7 px cell)
HIDDEN = 0.037
H0 = HIDDEN * N  # ~9.5 px

# palette (sRGB 0..255)
STONE = np.array([18, 16, 14], float)
IRON = np.array([15, 15, 16], float)
MARBLE = np.array([14, 13, 12], float)
BRONZE_DARK = np.array([58, 40, 22], float)
BRONZE_RIVET = np.array([74, 52, 28], float)
BRONZE_HI = np.array([118, 88, 52], float)
VEIN_GOLD = np.array([98, 74, 40], float)
WARM = np.array([30, 18, 9], float)

yy, xx = np.mgrid[0:N, 0:N].astype(float)
# distance to the nearest texture edge (px) and to the nearest edge of the VISIBLE opening
EDGE = np.minimum.reduce([xx + 0.5, yy + 0.5, N - xx - 0.5, N - yy - 0.5])
VIS = EDGE - H0


def noise(seed, cells, octaves=4, persistence=0.55):
    """fBm value noise in about -1..1: random grids upsampled bicubic, summed"""
    rng = np.random.default_rng(seed)
    out = np.zeros((N, N))
    amp, tot = 1.0, 0.0
    c = cells
    for _ in range(octaves):
        g = rng.standard_normal((c + 3, c + 3)).astype(np.float32)
        big = np.asarray(Image.fromarray(g, 'F').resize((N * (c + 3) // c, N * (c + 3) // c), Image.BICUBIC))
        ox, oy = rng.integers(0, max(1, N * 3 // c), 2)
        out += amp * big[oy:oy + N, ox:ox + N]
        tot += amp
        amp *= persistence
        c *= 2
    out /= tot
    return out / (np.abs(out).max() + 1e-9)


def blur(a, r):
    return gaussian_filter(np.asarray(a, float), r)


def shade(height, strength, light=(-0.35, -0.94)):
    """lambert-ish relief from a height map: positive where the surface faces the light (top, a little left)"""
    gy, gx = np.gradient(height)
    return -(gx * light[0] + gy * light[1]) * strength


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def to_img(rgb):
    return Image.fromarray(np.clip(np.round(rgb), 0, 255).astype(np.uint8), 'RGB')


def grain(seed, base, amp=6.0, speck=0.014):
    """fine stone grain: fBm mottling plus sparse dark / light specks"""
    rng = np.random.default_rng(seed + 1000)
    g = noise(seed, 6, 5) * amp + noise(seed + 7, 40, 2) * amp * 0.45
    s = rng.random((N, N))
    g = g + np.where(s < speck, -5, 0) + np.where(s > 1 - speck * 0.6, 4, 0)
    return base[None, None, :] + g[..., None] * np.array([1.0, 0.95, 0.88])


# ---- A. black stone block: a stone face with a faint bevelled edge (~9 % of the side) and fine grain ------------------------------
def opt_a(seed):
    rgb = grain(seed, STONE)
    # the block: a plateau with a chamfer of ~5.5 % just inside the visible edge, lit from the top
    w = 0.09 * N
    h = smoothstep(0, w, VIS) * 16.0
    rgb += shade(h, 11.0)[..., None]
    # a hairline dark joint right at the visible edge (the block sits in the lattice)
    rgb *= (0.55 + 0.45 * smoothstep(-1, 2.5, VIS))[..., None]
    # a couple of faint hairline fissures
    rng = np.random.default_rng(seed + 50)
    cr = Image.new('F', (N, N), 0)
    d = ImageDraw.Draw(cr)
    for _ in range(2):
        x, y = rng.uniform(40, 216, 2)
        ang = rng.uniform(0, np.pi)
        pts = [(x, y)]
        for _ in range(6):
            ang += rng.normal(0, 0.45)
            x += np.cos(ang) * 14
            y += np.sin(ang) * 14
            pts.append((x, y))
        d.line(pts, fill=1.0, width=1)
    crack = blur(np.asarray(cr), 0.6)
    rgb -= (crack * 7.0)[..., None]
    return rgb


# ---- B. black iron plate with four tiny dull bronze rivets --------------------------------------------------
def rivet(rgb, cx, cy, r):
    dx, dy = xx - cx, yy - cy
    d = np.hypot(dx, dy) / r
    inside = d < 1
    # the HUD's rivet: radial highlight at 36 % / 34 %, dimmed to stay dull
    hx, hy = cx - 0.28 * r, cy - 0.32 * r
    k = np.clip(np.hypot(xx - hx, yy - hy) / (1.25 * r), 0, 1)
    col = BRONZE_HI[None, None, :] * (1 - k[..., None]) ** 1.6 + BRONZE_RIVET[None, None, :] * (k[..., None]) * 0.75
    rim = smoothstep(0.78, 1.0, d)[..., None]
    col = col * (1 - 0.6 * rim)
    a = smoothstep(1.0, 0.86, d)[..., None]
    # a soft contact shadow round the head, down-right
    sh = np.exp(-((np.hypot(dx - 0.25 * r, dy - 0.3 * r) / (1.35 * r)) ** 4))[..., None]
    rgb[:] = rgb * (1 - 0.55 * sh * (1 - a)) * (1 - a) + col * a
    _ = inside


def opt_b(seed):
    rng = np.random.default_rng(seed)
    # blackened iron: cooler than stone, a brushed streak (stretched noise) and faint warm scale patches
    streak = np.asarray(Image.fromarray(rng.standard_normal((N, 24)).astype(np.float32), 'F').resize((N, N), Image.BICUBIC))
    streak = streak / np.abs(streak).max()
    mott = noise(seed, 4, 4)
    rgb = IRON[None, None, :] + (streak * 2.4 + noise(seed + 3, 32, 2) * 2.4)[..., None]
    warm = np.clip(mott, 0, 1)[..., None] * np.array([7.0, 4.0, 1.5])
    rgb += warm
    # the plate's edge: a narrow raised lip lit from the top
    h = smoothstep(0, 0.035 * N, VIS) * 4.0
    rgb += shade(h, 6.0)[..., None]
    rgb *= (0.5 + 0.5 * smoothstep(-1, 2.0, VIS))[..., None]
    # four tiny rivets ~11.5 % in from the texture edge (well inside the visible opening)
    r = 0.031 * N
    m = 0.115 * N
    for cx, cy in ((m, m), (N - m, m), (m, N - m), (N - m, N - m)):
        rivet(rgb, cx + rng.normal(0, 0.4), cy + rng.normal(0, 0.4), r)
    return rgb


# ---- C. engraved motif: a very faint engraved emblem in the centre (rosette or star) ------------------------
def rosette_mask(petals=12, r_in=0.10, r_out=0.36):
    im = Image.new('L', (N * 4, N * 4), 0)
    d = ImageDraw.Draw(im)
    S = N * 4
    c = S / 2
    w = int(S * 0.011)
    d.ellipse([c - r_out * S, c - r_out * S, c + r_out * S, c + r_out * S], outline=255, width=w)
    d.ellipse([c - r_in * S, c - r_in * S, c + r_in * S, c + r_in * S], outline=255, width=w)
    # the petals: pointed ovals from the inner ring to just inside the outer one
    for i in range(petals):
        a = 2 * np.pi * i / petals
        pts = []
        for t in np.linspace(0, np.pi, 24):
            rr = r_in + (r_out - 0.03 - r_in) * (1 - np.cos(t)) / 2
            wd = 0.11 * np.sin(t)
            pts.append((c + S * (rr * np.cos(a) - wd * rr * np.sin(a)) / 1, c + S * (rr * np.sin(a) + wd * rr * np.cos(a))))
        for t in np.linspace(np.pi, 0, 24):
            rr = r_in + (r_out - 0.03 - r_in) * (1 - np.cos(t)) / 2
            wd = -0.11 * np.sin(t)
            pts.append((c + S * (rr * np.cos(a) - wd * rr * np.sin(a)), c + S * (rr * np.sin(a) + wd * rr * np.cos(a))))
        d.line(pts + [pts[0]], fill=255, width=w)
    d.ellipse([c - 0.035 * S, c - 0.035 * S, c + 0.035 * S, c + 0.035 * S], fill=255)
    return np.asarray(im.resize((N, N), Image.LANCZOS)).astype(float) / 255


def star_mask(r_out=0.37):
    """the Assyrian star of Shamash: four straight rays and four wavy ones round a disc, in a ring"""
    S = N * 4
    c = S / 2
    im = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(im)
    w = int(S * 0.011)
    d.ellipse([c - r_out * S, c - r_out * S, c + r_out * S, c + r_out * S], outline=255, width=w)
    d.ellipse([c - 0.07 * S, c - 0.07 * S, c + 0.07 * S, c + 0.07 * S], outline=255, width=w)
    for i in range(8):
        a = 2 * np.pi * i / 8
        L = r_out - 0.035
        if i % 2 == 0:  # straight pointed ray
            base = 0.055
            p = [(c + S * 0.07 * np.cos(a + base * 4), c + S * 0.07 * np.sin(a + base * 4)), (c + S * L * np.cos(a), c + S * L * np.sin(a)), (c + S * 0.07 * np.cos(a - base * 4), c + S * 0.07 * np.sin(a - base * 4))]
            d.line(p, fill=255, width=w)
        else:  # three wavy lines
            for off in (-0.035, 0, 0.035):
                pts = []
                for t in np.linspace(0.09, L, 40):
                    lat = off + 0.018 * np.sin(t * 60)
                    pts.append((c + S * (t * np.cos(a) - lat * np.sin(a)), c + S * (t * np.sin(a) + lat * np.cos(a))))
                d.line(pts, fill=255, width=max(1, int(w * 0.7)))
    return np.asarray(im.resize((N, N), Image.LANCZOS)).astype(float) / 255


def engraved(seed, mask, depth=12.0):
    rgb = grain(seed, STONE, amp=4.5)
    # the cut: the motif's lines sunk into the face; shading gives a lit lower lip and a dark upper one
    wear = 0.75 + 0.25 * (noise(seed + 11, 5, 3) * 0.5 + 0.5)
    h = -blur(mask * wear, 1.1) * depth
    rgb += shade(h, 2.4)[..., None] * np.array([1.0, 0.92, 0.78])
    rgb -= (blur(mask, 0.6) * 3.5 * wear)[..., None]
    h2 = smoothstep(0, 0.045 * N, VIS) * 4.0
    rgb += shade(h2, 1.4)[..., None]
    rgb *= (0.55 + 0.45 * smoothstep(-1, 2.5, VIS))[..., None]
    return rgb


ROSETTE = None
STAR = None


def opt_c(seed):
    global ROSETTE
    if ROSETTE is None:
        ROSETTE = rosette_mask()
    return engraved(seed, ROSETTE)


def opt_c2(seed):
    global STAR
    if STAR is None:
        STAR = star_mask()
    return engraved(seed, STAR)


# ---- D1 (wells_r1's D, kept for comparison). black marble: near-black with very faint dull gold veins --------------
def opt_d1(seed):
    rng = np.random.default_rng(seed)
    base = MARBLE[None, None, :] + (noise(seed, 3, 4) * 3.6 + noise(seed + 1, 24, 3) * 1.6)[..., None]
    # cloudy charcoal depth
    cloud = noise(seed + 2, 2, 4)
    base += (np.clip(cloud, 0, 1) * 6.0)[..., None] * np.array([1.0, 0.96, 0.9])
    # veins: a domain-warped sine band, thin, gold at the core
    ang = rng.uniform(0, np.pi)
    u = xx * np.cos(ang) + yy * np.sin(ang)
    warp = noise(seed + 3, 3, 5) * 46 + noise(seed + 4, 10, 3) * 9
    f = rng.uniform(0.018, 0.026)
    band = np.abs(np.sin((u + warp) * f * np.pi))
    core = np.exp(-(band / 0.024) ** 2)
    halo = np.exp(-(band / 0.09) ** 2)
    # the vein comes and goes along its length
    fade = smoothstep(-0.45, 0.4, noise(seed + 5, 3, 3))
    # a second, finer set across it
    ang2 = ang + rng.uniform(0.9, 1.6)
    u2 = xx * np.cos(ang2) + yy * np.sin(ang2)
    band2 = np.abs(np.sin((u2 + noise(seed + 6, 4, 4) * 30) * f * 1.7 * np.pi))
    core2 = np.exp(-(band2 / 0.012) ** 2) * smoothstep(0.1, 0.7, noise(seed + 7, 3, 3))
    a = np.clip(core * 0.5 * fade + core2 * 0.26, 0, 1)
    rgb = base * (1 - a[..., None]) + VEIN_GOLD[None, None, :] * a[..., None]
    rgb += (halo * fade * 3.2)[..., None] * np.array([1.0, 0.75, 0.4])
    rgb *= (0.55 + 0.45 * smoothstep(-1, 2.5, VIS))[..., None]
    return rgb


# ---- D (wells_r2, Corey 2026-10-16 15:25 picked D: "reminds me of the stinger slate board"). The plaque's own slab ----
# (static/assets/ui/stinger/stinger-plaque.webp, frame stg_body, the panel inside the frame) cut into four 256 px
# crops, its lighting flattened, darkened to "mostly black" and its veins keyed exactly as the stinger's vein FX
# (images/ui/model/scripts/61_veins.py: luminance above the local stone level times a warmth key, specks dropped),
# then pushed toward dull gold so they read at 80 to 100 px cells. The GLOW sprite of each crop is the same vein key,
# white RGB with alpha = intensity and the bloom baked in (max(core, 0.55 blur + 0.38 wider blur)); the game draws it
# ADDITIVE with a gold tint over the well and animates only its alpha and tint (the stinger's own rule).
SLAB = None
SLAB_BOX = (232, 236, 1088, 500)  # the panel in stg_body px, clear of the frame, the lion's chin and the wings
D_CROPS = [(0, 4), (200, 0), (400, 8), (600, 2)]
D_DARK = 0.30  # the slab's stone times this: median luma ~15
D_KEY_FLOOR = 0.04
D_MIN_AREA = 6
D_CRACKLE_MIX = 0.16
D_CRACKLE_GLOW = 0.4
# the stinger's bloom (0.55, 0.38) a little wider and hotter: a well is drawn at 80 to 100 px, the plaque far larger
D_BLOOM = (0.7, 0.55)
D_GLOW_GAIN = 1.35
D_VEIN_COL = np.array([104, 78, 42], float)
D_VEIN_MIX = 0.55


def slab():
    global SLAB
    if SLAB is not None:
        return SLAB
    import json
    st = os.path.join(HERE, '..', 'static', 'assets', 'ui', 'stinger')
    fr = json.load(open(os.path.join(st, 'stinger-plaque.json')))['frames']['stg_body']['frame']
    im = Image.open(os.path.join(st, 'stinger-plaque.webp')).convert('RGB')
    body = im.crop((fr['x'], fr['y'], fr['x'] + fr['w'], fr['y'] + fr['h']))
    P = np.asarray(body.crop(SLAB_BOX)).astype(float) / 255
    lum = P @ np.array([0.299, 0.587, 0.114])
    # flatten the render's light: the stone divided by its own wide average
    wide = gaussian_filter(lum, 40)
    flat = P * (np.median(lum) / np.maximum(wide, 1e-3))[..., None]
    lumf = flat @ np.array([0.299, 0.587, 0.114])
    # the stinger's vein key (61_veins.py), its 4x radii scaled to this res (x 0.344)
    bg = gaussian_filter(lumf, 8.3)
    warm = np.clip(((flat[..., 0] - flat[..., 2]) - 0.035) / 0.07, 0, 1)
    # (r2: a higher floor and bigger pieces than the plaque's own key, so only the cracks' lines are kept, not the
    # stone's fine crackle: the well stays mostly black)
    v = np.clip((lumf - bg - D_KEY_FLOOR) / 0.16, 0, 1) * warm
    from scipy import ndimage as ndi
    lab, _ = ndi.label(v > 0.12)
    area = np.bincount(lab.ravel())
    v *= area[lab] >= D_MIN_AREA
    v = np.clip(v * 1.35, 0, 1) ** 0.85
    SLAB = (flat, v)
    return SLAB


def vein_lines(seed):
    """r1's veins (a domain-warped sine band, gold at the core, coming and going along its length), denser for r2:
    a main set and a crossing set, both continuous, so a light-up runs ALONG a crack"""
    rng = np.random.default_rng(seed)
    out = np.zeros((N, N))
    for k, (w, amp, freq) in enumerate(((0.030, 1.0, 1.0), (0.022, 0.75, 1.6), (0.016, 0.5, 2.3))):
        ang = rng.uniform(0, np.pi)
        u = xx * np.cos(ang) + yy * np.sin(ang)
        warp = noise(seed + 10 * k + 3, 3, 5) * 46 + noise(seed + 10 * k + 4, 10, 3) * 9
        f = rng.uniform(0.016, 0.022) * freq
        band = np.abs(np.sin((u + warp) * f * np.pi))
        core = np.exp(-(band / w) ** 2)
        fade = smoothstep(-0.55, 0.25, noise(seed + 10 * k + 5, 3, 3))
        out = np.maximum(out, core * fade * amp)
    return out


def d_parts(i):
    flat, v = slab()
    x, y = D_CROPS[i]
    # the plaque slab's stone (its fine crackle kept faint), darkened to mostly black
    stone = flat[y:y + N, x:x + N] * 255 * D_DARK
    crackle = v[y:y + N, x:x + N]
    lines = vein_lines(4040 + 31 * i)
    a = np.clip(lines * D_VEIN_MIX + crackle * D_CRACKLE_MIX, 0, 1)[..., None]
    rgb = stone * (1 - a) + D_VEIN_COL[None, None, :] * a
    edge = smoothstep(-1, 2.5, VIS)
    rgb *= (0.55 + 0.45 * edge)[..., None]
    # the glow: the same veins (the crackle weaker), bloom baked in, nothing under the bars
    core = np.clip(lines + crackle * D_CRACKLE_GLOW, 0, 1) * smoothstep(0.5, 3.0, VIS)
    glow = np.maximum(core, D_BLOOM[0] * blur(core, 1.4) + D_BLOOM[1] * blur(core, 5.0))
    return rgb, np.clip(glow * D_GLOW_GAIN, 0, 1)


def opt_d(seed):
    return d_parts(seed % 4)


# ---- E. recessed well: thin dark bronze inset line, soft inner shadow, faint warm bounce to the centre ----------
def opt_e(seed):
    rgb = grain(seed, np.array([10, 9, 8], float), amp=2.6, speck=0.006)
    # the inner shadow: the walls of the recess darken the edges
    sh = 1 - 0.55 * np.exp(-np.clip(VIS, 0, None) / (0.07 * N))
    rgb *= sh[..., None]
    # the warm bounce: a soft round glow toward the centre
    r = np.hypot(xx - N / 2 + 0.5, yy - N / 2 + 0.5) / (N / 2)
    rgb += (np.exp(-(r / 0.62) ** 2) * 1.0)[..., None] * WARM[None, None, :] * 0.55
    # the inset line: 1.4 px of dark bronze ~6 % inside the visible edge, lit a touch brighter on top
    line_at = 0.06 * N
    ln = np.exp(-((VIS - line_at) / 1.0) ** 2) * (VIS > line_at - 3)
    top = np.clip(1 - yy / N, 0, 1)
    col = BRONZE_DARK * (0.75 + 0.35 * top[..., None])
    rgb = rgb * (1 - 0.8 * ln[..., None]) + col * 0.8 * ln[..., None]
    rgb *= (0.55 + 0.45 * smoothstep(-1, 2.5, VIS))[..., None]
    return rgb


# ---- F. (own idea) basalt recess: A's stone carved INTO the frame: top wall in shadow, bottom lip catching light,
# no line, no motif -----------------------------------------------------------------------------------------------
def opt_f(seed):
    rgb = grain(seed, STONE, amp=5.0)
    w = 0.11 * N
    # a recess: the floor is lower than the rim, so the wall under the top edge faces down (dark) and the wall
    # above the bottom edge faces up (lit by the braziers)
    h = -smoothstep(0, w, VIS) * 20.0
    rgb += shade(h, 9.0)[..., None] * np.array([1.0, 0.86, 0.66])
    rgb *= (1 - 0.35 * np.exp(-np.clip(VIS, 0, None) / (0.05 * N)))[..., None]
    r = np.hypot(xx - N / 2 + 0.5, (yy - N / 2 + 0.5) * 1.0) / (N / 2)
    rgb += (np.exp(-(r / 0.75) ** 2))[..., None] * WARM[None, None, :] * 0.3
    rgb *= (0.55 + 0.45 * smoothstep(-1, 2.5, VIS))[..., None]
    return rgb


OPTIONS = {'A': opt_a, 'B': opt_b, 'C': opt_c, 'C2': opt_c2, 'D1': opt_d1, 'D': opt_d, 'E': opt_e, 'F': opt_f}
# D1 keeps r1's D seed (404) so it regenerates byte for byte; D's seed only picks the crop (seed % 4)
SEEDS = {'A': 101, 'B': 202, 'C': 303, 'C2': 313, 'D1': 404, 'D': 0, 'E': 505, 'F': 606}
SEED_STEP = {'D': 1}


def atlas_of(key):
    """the option's four variants: (wells atlas RGB, glow atlas greyscale or None, the tiles, the glows)"""
    fn = OPTIONS[key]
    parts = [fn(SEEDS[key] + SEED_STEP.get(key, 17) * i) for i in range(4)]
    tiles = [to_img(p[0] if isinstance(p, tuple) else p) for p in parts]
    glows = [p[1] for p in parts if isinstance(p, tuple)]
    atlas = Image.new('RGB', (2 * N, 2 * N))
    for i, t in enumerate(tiles):
        atlas.paste(t, ((i % 2) * N, (i // 2) * N))
    glow = None
    if len(glows) == 4:
        g = np.zeros((2 * N, 2 * N), np.uint8)
        for i, gl in enumerate(glows):
            g[(i // 2) * N:(i // 2 + 1) * N, (i % 2) * N:(i % 2 + 1) * N] = np.round(np.clip(gl, 0, 1) * 255).astype(np.uint8)
        glow = Image.fromarray(np.stack([g] * 3, -1), 'RGB')
    return atlas, glow, tiles


def half(im):
    return im.resize((im.width // 2, im.height // 2), Image.LANCZOS)


def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--mockups':
        out = sys.argv[2]
        only = sys.argv[3].split(',') if len(sys.argv) > 3 else list(OPTIONS)
        os.makedirs(out, exist_ok=True)
        for key in only:
            atlas, glow, tiles = atlas_of(key)
            for i, t in enumerate(tiles):
                t.save(os.path.join(out, f'well_{key}_v{i}_256.png'))
            atlas.save(os.path.join(out, f'wells-{key}-atlas-512.png'))
            half(atlas).save(os.path.join(out, f'wells-{key}-atlas-256-phone.png'))
            if glow:
                glow.save(os.path.join(out, f'wells-{key}-glow-atlas-512.png'))
            luma = np.asarray(atlas).astype(float) @ [0.299, 0.587, 0.114]
            print(f'{key}: luma mean {luma.mean():.1f} p99 {np.percentile(luma, 99):.1f} max {luma.max():.0f}')
        return
    # THE SHIPPED WELLS: option D
    atlas, glow, _ = atlas_of('D')
    os.makedirs(OUT, exist_ok=True)
    for name, im, q in (('board-wells', atlas, 92), ('board-wells-glow', glow, 90)):
        for suffix, img in (('', im), ('-half', half(im))):
            path = os.path.join(OUT, f'{name}{suffix}.webp')
            img.save(path, quality=q, method=6)
            print(f'{path}: {img.width} x {img.height}, {os.path.getsize(path) // 1024} KB')
    luma = np.asarray(atlas).astype(float) @ [0.299, 0.587, 0.114]
    g = np.asarray(glow)[..., 0]
    print(f'wells luma mean {luma.mean():.1f} p99 {np.percentile(luma, 99):.1f}; glow coverage (> 64) {(g > 64).mean() * 100:.1f} %')


if __name__ == '__main__':
    main()
