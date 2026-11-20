"""THE WILD FRAMES' TINSEL GARLAND (Corey 2026-11-19, from the wild border mock's seven candidates: "I'd go for Garland
(F), but I'd go Red for Santa because it doesn't clash with the Green number", then "We should jsut go static colors for
Reindeer Santa, Grandma for the multipliers and the garland" and "just swap the garland on santa and grandma").

Bakes the frame atlas the full column Wilds, the single cell Grandma Wild and the marked Grandma car draw their frames
from (game/road/garland.ts), one sheet per density, and writes its frames to src/game/garlandSpec.ts. The look is the
mock's candidate F (Desktop/Run Over Reindeer/wild_borders_r1_2026-11-19, tools/bake.py tinsel() and bauble()): hundreds
of tinsel strands on a dark core inside one lumpy ink outline, a glass bauble at each corner. Three fixed color sets, one
per character, at every multiplier value (no value tiers):
  silver   Reindeer (red baubles)
  red      Santa (gold baubles): a darker red than the mock's, so it separates from his red suit (with the ink outline
           and the gold baubles)
  green    Grandma, her column and her single cell Wild (gold baubles)

THE PIECES (road px are pixels of the game's 1536 x 1024 board picture; the band is T = 26 thick from the frame's outer
edge in, the texture's own thickness; the game draws it at any other thickness by scale: the cell's 20, the growing box):
  tile_<set>      one period (L0 = 64) of the band, its outer edge at v = 0, PAD of fuzz and ink outside both edges. The
                  content is periodic and the sheet carries MARGIN px of the wrapped content left and right of the frame,
                  so tiles laid end to end sample their neighbor's own pixels at the joint (no seam at any position)
  corner_<set>    the same band swept round a quarter circle about the frame's inner corner (the mock's rounded corner),
                  with its phase running on into the next strip (clockwise, the strip after it starts at phase 0 and
                  the corner reaches X past the joint with the strip's own pixels), and a TONGUE of length E back along
                  the strip before it, fading out: that strip ends at whatever phase the box's size gives it, so the
                  tongue cross-fades the two outlines (no step in the lumpy outline at any height during the grow)
  bauble_red, bauble_gold   the mock's ball (shaded, tinted), its white shine and its gold cap, composed into one sprite
  star            the twinkle glint (white, drawn additive and tinted)
  ring            a soft glow round a box (the win's halo), a nine slice: the box 28 in from the texture's edge

THE DENSITY: 3 px per CSS px at the largest draw (the house rule, tools/build_assets.py ATLAS_SCALE: 3.2 sheet px per
road px on desktop, 1.2 on phones); the ring is a soft blur and is baked at 1.2 / 0.6 (it is drawn magnified, smooth).
Every piece's pixel size is a whole number with the road px it covers exact (a tile is exactly one period in pixels).

Run with the math env's Python (Pillow, numpy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_garland.py
Then `node scripts/stamp-assets.mjs` (pnpm dev and pnpm build run it for you).
"""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "static", "assets", "wild")
SPEC = os.path.join(APP, "src", "game", "garlandSpec.ts")

DENSITY = {"full": 3.2, "phone": 1.2}
RING_DENSITY = {"full": 1.2, "phone": 0.6}
# supersampling: drawn at d x SS px per road px, then box averaged down
SS = {"full": 4, "phone": 10}
GUTTER = {"full": 4, "phone": 3}
# the wrapped content each side of a tile's frame (px): covers the bilinear tap and the first mip levels
MARGIN = {"full": 8, "phone": 4}
MAX_W = 2048
QUALITY = 92

# the band (the mock's F: T 26 on a column, 20 on a cell; the texture is made at 26)
L0 = 64.0
T = 26.0
PAD = 4.0
# the corner: how far it reaches past the joint into the strip after it (its own pixels) and its tongue back along the
# strip before it (faded out over its length)
X = 3.0
E = 12.0

INK = np.array([16, 18, 22]) / 255.0


def hexc(h):
    return np.array([(h >> 16) & 255, (h >> 8) & 255, h & 255]) / 255.0


# THE SETS (strand base colors; the mock: silver C9D2DC, green 2FB34F, red D8233A. Santa's red is darker here, so his
# frame separates from his suit: Corey's "red for Santa" with the ink outline and gold baubles)
SETS = {"silver": (0xC9D2DC, 7), "red": (0xB3192B, 9), "green": (0x2FB34F, 8)}
BAUBLES = {"red": 0xD6162C, "gold": 0xF2B51C}
GOLD = hexc(0xF2B51C)


# ---- canvas helpers (premultiplied float RGBA) ---------------------------------------------------------------------
def over(cv, rgb, a):
    a = np.clip(a, 0, 1)[..., None]
    rgb = np.broadcast_to(np.asarray(rgb, dtype=float), cv.shape[:2] + (3,))
    cv[..., :3] = rgb * a + cv[..., :3] * (1 - a)
    cv[..., 3:] = a + cv[..., 3:] * (1 - a)


def blur(m, r_px):
    im = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(max(0.5, r_px)))
    return np.asarray(im, dtype=float) / 255.0


def dilate(m, r, big):
    """grow a mask by r road px (a blur and a low threshold: the mock's)"""
    return (blur(m, r / 2 * big) > 0.03).astype(float)


def down(cv, ss):
    """premultiplied supersampled canvas -> 8 bit straight RGBA"""
    H, W = cv.shape[:2]
    s = cv[: H - H % ss, : W - W % ss].reshape(H // ss, ss, W // ss, ss, 4).mean(axis=(1, 3))
    a = s[..., 3:]
    rgb = np.where(a > 1e-5, s[..., :3] / np.maximum(a, 1e-5), 0)
    return Image.fromarray((np.clip(np.concatenate([rgb, a], -1), 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---- the tinsel field -------------------------------------------------------------------------------------------------
def tinsel_field(col, seed, N, H, ss):
    """the band, three periods long (u from -L0 to 2 L0), supersampled: N px per period, H px across (v from -PAD).
    Periodic in u by construction (the lumps' periods divide L0, every strand drawn three times a period apart)."""
    big = N / L0 * ss
    W3, Hs = 3 * N * ss, H * ss
    cv = np.zeros((Hs, W3, 4))
    y, x = np.mgrid[0:Hs, 0:W3]
    U = (x + 0.5) / big - L0
    V = (y + 0.5) / big - PAD
    lump = 1.6 * np.sin(2 * np.pi * U / 16 + 0.7) + 1.1 * np.sin(2 * np.pi * U / 32 + 2.1)
    body = ((V > 1.0 + lump * 0.6) & (V < T - 1.0 - lump * 0.5)).astype(float)
    over(cv, INK, dilate(body, 2.6, big))
    over(cv, col * 0.42, body)
    im = Image.new("RGBA", (W3, Hs), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(seed)
    for _ in range(320):
        u0 = rng.uniform(0, L0)
        v0 = T / 2 + np.clip(rng.normal(0, 3.4), -7, 7)
        ang = rng.uniform(0, 2 * np.pi)
        ln = rng.uniform(4.5, 10.5)
        b = rng.uniform(0.6, 1.45)
        c = np.clip(col * b + (0.5 if rng.random() < 0.14 else 0) * (1 - col), 0, 1)
        rgb = tuple(int(q * 255) for q in c) + (255,)
        for k in (-1, 0, 1, 2):
            x0, y0 = (u0 + k * L0 + L0) * big, (v0 + PAD) * big
            x1, y1 = x0 + math.cos(ang) * ln * big, y0 + math.sin(ang) * ln * 0.8 * big
            d.line([(x0, y0), (x1, y1)], fill=rgb, width=max(1, int(round(1.25 * big))))
    st = np.asarray(im, dtype=float) / 255.0
    over(cv, st[..., :3], st[..., 3] * dilate(body, 1.2, big))
    return cv, big


def sample(field, big, uu, vv):
    """nearest sample of the field at band coords (u any: wrapped to the middle period; v from the outer edge)"""
    Hs, W3 = field.shape[:2]
    N_ss = W3 // 3
    ix = np.clip(((np.mod(uu, L0) + L0) * big).astype(int), 0, W3 - 1)
    ix = np.where(ix >= 2 * N_ss, ix - N_ss, ix)
    iy = ((vv + PAD) * big).astype(int)
    ok = (iy >= 0) & (iy < Hs)
    out = field[np.clip(iy, 0, Hs - 1), ix] * ok[..., None]
    return out


def bake_tinsel(col, seed, d, ss, margin):
    N = int(round(L0 * d))
    H = int(round((T + 2 * PAD) * d))
    dd = N / L0  # the exact density of this piece (one period in N px)
    field, big = tinsel_field(col, seed, N, H, ss)
    full = down(field, ss)
    tile = full.crop((N - margin, 0, 2 * N + margin, H))
    # THE CORNER: local u along the strip after it (clockwise), v along the strip before it; origin the outer corner
    Wc = int(round((PAD + T + X) * dd))
    Hc = int(round((PAD + T + E) * dd))
    cv = np.zeros((Hc * ss, Wc * ss, 4))
    y, x = np.mgrid[0 : Hc * ss, 0 : Wc * ss]
    u = (x + 0.5) / big - PAD
    v = (y + 0.5) / big - PAD
    sweep = (u <= T) & (v <= T)
    strip = (u > T) & (v <= T + PAD)
    tongue = ~sweep & ~strip
    r = np.hypot(T - u, T - v)
    th = np.arctan2(T - u, T - v)
    # the phase round the corner: the arc length at a radius between the true one and the mid band's (the mock's T / 2
    # at every radius fanned the strands into a point at the inner corner); the tongue carries the phase the sweep ends
    # with at each depth on down its strip
    arc = lambda rr: rr / 2 + T / 4
    uu = np.where(sweep, -th * arc(r), np.where(strip, u - T, -np.pi / 2 * arc(np.clip(T - u, 0, None)) - (v - T)))
    vv = np.where(sweep, T - r, np.where(strip, v, u))
    smp = sample(field, big, uu, vv)
    fade = np.where(tongue, 1 - smooth(0, 1, (v - T) / E), 1.0)
    smp = smp * fade[..., None]
    corner = down(smp, ss)
    return tile, corner, dd, N, H, Wc, Hc


# ---- the bauble -----------------------------------------------------------------------------------------------------
BW, BH = 40.0, 52.0
BALL = (20.0, 29.0)
R0 = 17.5


def bake_bauble(tint, d, ss):
    big = d * ss
    W, H = int(round(BW * d)) * ss, int(round(BH * d)) * ss
    dd = W / ss / BW
    big = dd * ss
    cv = np.zeros((H, W, 4))
    y, x = np.mgrid[0:H, 0:W]
    X_ = (x + 0.5) / big
    Y_ = (y + 0.5) / big
    r = np.hypot(X_ - BALL[0], Y_ - BALL[1])
    g = np.clip(1.05 - 0.6 * np.hypot(X_ - 14, Y_ - 22) / 26, 0.3, 1.05)
    c = hexc(tint)
    over(cv, np.clip(INK * c, 0, 1), (r <= R0 + 2.6).astype(float))
    over(cv, np.clip(np.stack([g] * 3, -1) * c, 0, 1), (r <= R0).astype(float))
    hi = np.exp(-(((X_ - 13.5) / 4.2) ** 2 + ((Y_ - 21.5) / 2.8) ** 2)) + 0.5 * np.exp(-(((X_ - 27) / 2.0) ** 2 + ((Y_ - 38) / 1.6) ** 2))
    over(cv, np.ones(3), np.clip(0.9 * hi, 0, 1) * (r <= R0))
    loop = (np.abs(np.hypot(X_ - 20, Y_ - 5.2) - 3.0) < 1.0).astype(float)
    cap = ((np.abs(X_ - 20) < 6.5) & (Y_ > 7.5) & (Y_ < 14.5)).astype(float)
    over(cv, INK, dilate(np.maximum(loop, cap), 1.6, big))
    over(cv, np.array([0.72, 0.72, 0.7]), loop)
    capc = GOLD * (0.7 + 0.45 * np.clip(1 - np.abs(X_ - 17) / 7, 0, 1))[..., None]
    capc = np.where((np.sin((X_ - 13.5) * 2.4) > 0.6)[..., None], capc * 0.75, capc)
    over(cv, np.clip(capc, 0, 1), cap)
    return down(cv, ss), dd


# ---- the effects ------------------------------------------------------------------------------------------------------
def bake_star(d, ss):
    """the four point glint (the multiplier atlas's recipe, tools/build_wild_mult.py bake_fx), 40 road px"""
    s = 40.0
    n = int(round(s * d)) * ss
    yy, xx = np.mgrid[0:n, 0:n].astype(float)
    c = n / 2
    dx = np.abs(xx + 0.5 - c) / c
    dy = np.abs(yy + 0.5 - c) / c
    arm = np.clip(1 - (dx * 6 + dy) ** 0.8, 0, 1) + np.clip(1 - (dy * 6 + dx) ** 0.8, 0, 1)
    core = np.clip(1 - np.hypot(dx, dy) * 2.5, 0, 1) ** 1.5
    a = np.clip(arm * 0.9 + core, 0, 1)
    cv = np.zeros((n, n, 4))
    over(cv, np.ones(3), a)
    return down(cv, ss), n / ss / s


RING = 112.0
RING_IN = 28.0
RING_SLICE = 40.0


def bake_ring(d):
    """the mock's fx_ring: a soft glow round a box 28 road px in from the edge (white, additive and tinted)"""
    n = int(round(RING * d))
    ss = 4
    yy, xx = np.mgrid[0 : n * ss, 0 : n * ss].astype(float)
    big = n * ss / RING
    X_ = (xx + 0.5) / big
    Y_ = (yy + 0.5) / big
    c = RING / 2
    half = c - RING_IN
    dx = np.maximum(np.abs(X_ - c) - half, 0)
    dy = np.maximum(np.abs(Y_ - c) - half, 0)
    inside = np.minimum(half - np.abs(X_ - c), half - np.abs(Y_ - c))
    dist = np.where((dx > 0) | (dy > 0), np.hypot(dx, dy), inside)
    a = np.exp(-((dist / 10.0) ** 2))
    cv = np.zeros((n * ss, n * ss, 4))
    over(cv, np.ones(3), a)
    return down(cv, ss), n / RING


# ---- packing (tools/build_wild_mult.py's shelf pack) ------------------------------------------------------------------
def shelf(pictures, gap, max_w):
    order = sorted(pictures.items(), key=lambda kv: (-kv[1].height, kv[0]))
    x = y = row = 0
    width = 0
    place = {}
    for name, im in order:
        if x and x + im.width > max_w:
            x = 0
            y += row + gap
            row = 0
        place[name] = (x, y)
        x += im.width + gap
        width = max(width, x - gap)
        row = max(row, im.height)
    return place, width, y + row


def pack(pictures, gap):
    best = None
    for max_w in range(128, MAX_W + 1, 4):
        place, w, h = shelf(pictures, gap, max_w)
        if w > MAX_W or h > MAX_W:
            continue
        if best is None or w * h < best[1] * best[2]:
            best = (place, w, h)
    place, width, height = best
    sheet = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for name, im in pictures.items():
        sheet.paste(im, place[name])
    return sheet, place


def main():
    os.makedirs(OUT, exist_ok=True)
    spec = {
        "band": {"L": L0, "T": T, "pad": PAD, "x": X, "e": E},
        "bauble": {"w": BW, "h": BH, "ballX": BALL[0], "ballY": BALL[1], "r": R0 + 2.6, "hookY": 3.0},
        "star": {"size": 40.0},
        "ring": {"size": RING, "inset": RING_IN, "slice": RING_SLICE},
        "sets": list(SETS.keys()),
        "baubles": list(BAUBLES.keys()),
        "sheets": {},
    }
    report = []
    for size, d in DENSITY.items():
        ss = SS[size]
        m = MARGIN[size]
        pictures = {}
        rows = {}
        for name, (col, seed) in SETS.items():
            tile, corner, dd, N, H, Wc, Hc = bake_tinsel(hexc(col), seed, d, ss, m)
            pictures[f"tile_{name}"] = tile
            pictures[f"corner_{name}"] = corner
            # a tile's frame is its middle N px (the margins are the wrapped neighbors); road size exact
            rows[f"tile_{name}"] = {"inset": m, "w": N, "h": H, "roadW": L0, "roadH": round(H / dd, 4)}
            rows[f"corner_{name}"] = {"inset": 0, "w": Wc, "h": Hc, "roadW": round(Wc / dd, 4), "roadH": round(Hc / dd, 4)}
        for name, tint in BAUBLES.items():
            im, dd = bake_bauble(tint, d, ss)
            pictures[f"bauble_{name}"] = im
            rows[f"bauble_{name}"] = {"inset": 0, "w": im.width, "h": im.height, "roadW": BW, "roadH": round(im.height / dd, 4)}
        im, dd = bake_star(d * 0.5, max(2, ss // 2))
        pictures["star"] = im
        rows["star"] = {"inset": 0, "w": im.width, "h": im.height, "roadW": 40.0, "roadH": 40.0}
        im, dd = bake_ring(RING_DENSITY[size])
        pictures["ring"] = im
        rows["ring"] = {"inset": 0, "w": im.width, "h": im.height, "roadW": RING, "roadH": RING}
        sheet, place = pack(pictures, GUTTER[size])
        file = f"garland-{size}.webp"
        sheet.save(os.path.join(OUT, file), quality=QUALITY, alpha_quality=100, method=6)
        frames = {}
        for key, (x, y) in sorted(place.items()):
            r = rows[key]
            frames[key] = [x + r["inset"], y, r["w"], r["h"], r["roadW"], r["roadH"]]
        kb = os.path.getsize(os.path.join(OUT, file)) / 1024
        gpu = sheet.width * sheet.height * 4 / 1048576
        spec["sheets"][size] = {"file": f"wild/{file}", "width": sheet.width, "height": sheet.height, "kb": round(kb, 1), "gpuMb": round(gpu, 3), "frames": frames}
        report.append(f"  {file}: {sheet.width} x {sheet.height}, {len(frames)} frames, {kb:.0f} KB, {gpu:.2f} MB on the GPU ({gpu * 4 / 3:.2f} with a mip chain)")
        # a look at every piece for the review (not shipped): the sheet itself
    with open(SPEC, "w") as fh:
        fh.write("// AUTO-GENERATED by tools/build_garland.py (the Wild frames' tinsel garland, the mock's candidate F, one color set\n")
        fh.write("// per character). Do not edit: change the tool and run it again. A frame row is [x, y, w, h, roadW, roadH]: its\n")
        fh.write("// sheet px (a tile's x is its period's first px; the wrapped margin lies either side) and the road px it covers.\n")
        fh.write("export const GARLAND_ART = ")
        fh.write(json.dumps(spec, indent="\t"))
        fh.write(" as const;\n")
    print("wild frame garland:")
    for r in report:
        print(r)


if __name__ == "__main__":
    main()
