"""THE WILDS' MULTIPLIERS, candidate E "Candy Cane Lettering" (Corey 2026-11-19: "E Candy Cane"), in fixed colors by
character (Corey 2026-11-19: "We should jsut go static colors for Reindeer Santa, Grandma for the multipliers ... Grandma
is the exception, she has gold number that deserve effects as they get much larger").

Bakes the multiplier atlas the Grandma Wild cell and the full column Wilds draw their numbers from
(game/road/wildMult.ts), one sheet per density, and writes its frames to src/game/wildMultSpec.ts. The letters are the
approved mock's (Desktop/Run Over Reindeer/wild_multipliers_r1_2026-11-19, tools/bake.py style_candy and shared): Sigmar
with a thick ink outline, a baked drop shadow, a rounded shine and a gloss stroke. Three color sets, each with every
glyph (0 to 9 and x), one per character (constants WILD_MULT.colors picks which):
  red     candy stripes in two tones of one red
  green   candy stripes in two greens (Santa: "the Green number")
  gold    gold tinsel (Grandma, her column and her single cell Wild)
plus `sheen`: each glyph's face as a white silhouette, at half density (the gold number's sheen and shimmer, drawn
additive over the letter, game/road/wildMult.ts), and three effect sprites: a four point star glint (white, additive and
tinted), a snow puff and a soft glow blob (white, additive, tinted).

LEGIBILITY (2026-11-19, a first look inside a frame: the green striped "25X" was hard to read at phone size, the stripes
breaking the digit shapes): the stripes are wider and their two tones closer than the mock's (STRIPE_PERIOD, the sets'
colors), so the digit's outline carries its shape; the outline is the mock's.

Run with the math env's Python (Pillow, numpy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_wild_mult.py
Then `node scripts/stamp-assets.mjs` (pnpm dev and pnpm build run it for you).

THE COST: one atlas per density (static/assets/wild/wild-mult-full.webp and wild-mult-phone.webp); the digits are
composed at runtime from glyphs; each set is baked at the largest draw any value makes (the column's letter height held to
the frame's inside width, game/road/wildMult.ts layout), at the house density (3 px per CSS px at the largest draw: 3.2
atlas px per road px on desktop, 1.2 on phones, tools/build_assets.py ATLAS_SCALE); every glyph is trimmed to its pixels.
The sets are BAKED, not tinted: no tint reproduces a two tone stripe or the tinsel exactly (a tint multiplies one color
into the white, and the shine and the outline would take it too).
Design units: "road px at the mock's nominal letter height" (the mock's cap 80; a glyph's metrics are in these units and
the game scales them by cap / CAP).
"""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "static", "assets", "wild")
SPEC = os.path.join(APP, "src", "game", "wildMultSpec.ts")
FONT = os.path.join(os.path.expanduser("~/Library/Fonts"), "Sigmar-Regular.ttf")  # Sigmar (OFL), as the mock

# the house density, atlas px per road px (tools/build_assets.py ATLAS_SCALE)
DENSITY = {"full": 3.2, "phone": 1.2}
GUTTER = {"full": 6, "phone": 3}  # px between frames (the desktop sheet is mipmapped)
MAX_W = 2048
QUALITY = 92  # webp color quality (the alpha is lossless)

# the mock's glyph recipe (tools/bake.py glyph_set("candyN", F_SIGMAR, 80, style_candy(N), stroke_road=6.5, pad_road=7,
# tuck_road=3.0))
CAP = 80.0
STROKE = 6.5
TUCK = 3.0
PAD = 7.0
CHARS = "0123456789x"
# THE COLOR SETS. Stripes: (dark, light) and the period in design units (the mock: 15, red 214,18,40 / 255,128,140 and
# green 16,128,56 / 120,222,150; wider and closer here for legibility). Tinsel: the mock's tier 2 gold.
STRIPE_PERIOD = 22
SETS = {
    "red": {"stripes": ((200, 20, 40), (240, 92, 108))},
    "green": {"stripes": ((18, 132, 60), (78, 190, 112))},
    "gold": {"tinsel": (7, (255, 220, 90), (232, 160, 20))},
}
SHEEN_DENSITY = 0.5  # the sheen silhouettes against the letters' density
# the values a number can draw (any character, 2x to 500x: a value over its kind's top only ever draws smaller)
VALUES = list(range(2, 101)) + [150, 200, 250, 300, 400, 500]
# THE PLACES (keep in step with constants WILD_MULT.place): letter height per value band (road px; bands from 10x, 50x,
# 100x) and the widest the number may be (road px); the column is the larger of the two places
PLACE = {
    "cell": {"caps": [56, 58, 60, 62], "maxW": 196},
    "col": {"caps": [70, 76, 82, 88], "maxW": 184},
}
# THE KINDS (keep in step with constants WILD_MULT.maxValue, the math's tops, 2026-11-19): each kind's place and largest
# value. The game lifts a kind's letters so its largest value fills the place's width (game/road/wildMult.ts kindTop):
# the Reindeer's 8x makes every Reindeer number 75 road px tall, the largest draw of all.
KINDS = {
    "cell": ("cell", 100),
    "reindeer": ("col", 8),
    "santa": ("col", 30),
    "grandma": ("col", 75),
}
BAND_FROM = [10, 50, 100]
BREATHE = 1.02  # the idle's largest swell (constants WILD_MULT.idle.breathe)

SS_MIN_BIG = 6.0  # supersampling: draw at no fewer than this many px per design unit, then bring down (Lanczos)


# ---- the mock's drawing helpers (tools/bake.py), with the density a parameter ---------------------------------------
class Pen:
    def __init__(self, px_per_unit):
        self.ts = px_per_unit
        self.ss = max(2, math.ceil(SS_MIN_BIG / px_per_unit))
        self.big = self.ts * self.ss

    def R(self, v):
        return int(round(v * self.big))

    def blur(self, mask, r):
        if r <= 0:
            return mask.copy()
        im = Image.fromarray(np.clip(mask * 255, 0, 255).astype(np.uint8), "L")
        im = im.filter(ImageFilter.GaussianBlur(r * self.big))
        return np.asarray(im).astype(np.float32) / 255.0

    def emboss(self, mask, r, strength, light=(-1, -1)):
        hgt = self.blur(mask, r)
        gy, gx = np.gradient(hgt)
        lx, ly = light
        n = math.hypot(lx, ly)
        v = -(gx * lx + gy * ly) / n
        return np.clip(v * strength * r * self.big, -1, 1)

    def stripes(self, h, w, period, c1, c2, angle=-35, soft=0.6):
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        a = math.radians(angle)
        u = (xx * math.cos(a) + yy * math.sin(a)) / (period * self.big)
        f = u - np.floor(u)
        edge = soft / period
        m = np.clip((np.abs(f - 0.5) - 0.25) / max(edge, 1e-3) + 0.5, 0, 1)
        c1 = np.array(c1, np.float32) / 255
        c2 = np.array(c2, np.float32) / 255
        return c1 * m[..., None] + c2 * (1 - m[..., None])

    def tinsel(self, h, w, seed, base_top, base_bot):
        rng = np.random.default_rng(seed)
        g = vgrad(h, w, [(0, base_top), (0.45, (255, 236, 150)), (0.55, base_bot), (1, (150, 90, 10))])
        # the flecks: one design unit square (the mock's 6 px at 6 px per unit)
        cell = max(1, int(round(self.big)))
        n = rng.random((max(1, h // cell), max(1, w // cell))).astype(np.float32)
        n = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((w, h), Image.NEAREST)).astype(np.float32) / 255
        flecks = (n > 0.82).astype(np.float32) * 0.45 - (n < 0.12).astype(np.float32) * 0.18
        return np.clip(g + flecks[..., None], 0, 1)

    def ellipse_mask(self, w, h, cx, cy, rx, ry):
        im = Image.new("L", (w, h), 0)
        ImageDraw.Draw(im).ellipse([self.R(cx - rx), self.R(cy - ry), self.R(cx + rx), self.R(cy + ry)], fill=255)
        return np.asarray(im).astype(np.float32) / 255.0

    def poly_dilate(self, m, r):
        im = Image.fromarray((m * 255).astype(np.uint8), "L")
        k = max(3, int(self.R(r)) * 2 + 1)
        return np.asarray(im.filter(ImageFilter.MaxFilter(k if k % 2 else k + 1))).astype(np.float32) / 255.0

    def down(self, arr):
        """float RGBA at big px per unit -> 8 bit RGBA at ts px per unit, as the mock's save() (Pillow's Lanczos on RGBA
        works on premultiplied pixels)"""
        im = Image.fromarray(np.clip(np.round(arr * 255.0), 0, 255).astype(np.uint8), "RGBA")
        return im.resize((max(1, round(im.width / self.ss)), max(1, round(im.height / self.ss))), Image.LANCZOS)


def shift(a, dx, dy):
    out = np.zeros_like(a)
    h, w = a.shape
    dx, dy = int(round(dx)), int(round(dy))
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    out[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx] = a[ys0:ys1, xs0:xs1]
    return out


def over(dst, src):
    sa = src[..., 3:4]
    da = dst[..., 3:4]
    oa = sa + da * (1 - sa)
    rgb = np.where(oa > 1e-6, (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6), 0)
    return np.concatenate([rgb, oa], axis=-1)


def layer(mask, color, alpha=1.0):
    h, w = mask.shape
    c = np.array(color[:3], np.float32) / 255.0
    rgb = np.broadcast_to(c, (h, w, 3))
    return np.concatenate([rgb, (mask * alpha)[..., None]], axis=-1)


def vgrad(h, w, stops):
    t = np.linspace(0, 1, h)[:, None]
    ts = [s[0] for s in stops]
    cols = np.array([s[1] for s in stops], np.float32) / 255.0
    out = np.stack([np.interp(t[:, 0], ts, cols[:, i]) for i in range(3)], axis=-1)
    return np.broadcast_to(out[:, None, :], (h, w, 3)).copy()


def shade_layer(lum, conf, a_hi=0.9, a_lo=0.75):
    hi = np.clip(lum, 0, 1) * conf * a_hi
    lo = np.clip(-lum, 0, 1) * conf * a_lo
    h, w = lum.shape
    out = np.zeros((h, w, 4), np.float32)
    out[..., :3] = (hi / np.maximum(hi + lo, 1e-6))[..., None]
    out[..., 3] = np.clip(hi + lo, 0, 1)
    return out


def font_for(pen):
    f0 = ImageFont.truetype(FONT, 400)
    b = f0.getbbox("0")
    ratio = (b[3] - b[1]) / 400
    size = max(4, round(CAP * pen.big / ratio))
    return ImageFont.truetype(FONT, size)


def style_candy(pen, spec, fm, sm):
    """the mock's style_candy, its fill from a color set (no baked halo: the gold's glow is a sprite in the game)"""
    h, w = fm.shape
    R = pen.R
    if "stripes" in spec:
        c1, c2 = spec["stripes"]
        fill = pen.stripes(h, w, STRIPE_PERIOD, c1, c2, angle=-35)
    else:
        seed, top_c, bot_c = spec["tinsel"]
        fill = pen.tinsel(h, w, seed, top_c, bot_c)
    lum = pen.emboss(fm, 2.0, 1.6)
    out = np.zeros((h, w, 4), np.float32)
    sh = shift(pen.blur(sm, 1.5), R(1.5), R(4.5))
    out = over(out, layer(sh, (40, 10, 20), 0.55))
    out = over(out, layer(sm, (18, 12, 14)))
    out = over(out, np.concatenate([fill, fm[..., None]], axis=-1))
    out = over(out, shade_layer(lum, fm, 0.75, 0.35))
    top = np.clip(fm - shift(fm, R(0), R(9)), 0, 1)
    out = over(out, layer(pen.blur(top, 0.6) * fm, (255, 255, 255), 0.35))
    return out


def style_sheen(pen, fm, sm):
    """the letter's face, white, brighter toward its top (the sheen and shimmer light it additively)"""
    h, w = fm.shape
    g = np.linspace(1.0, 0.55, h)[:, None]
    return layer(np.clip(fm * g, 0, 1), (255, 255, 255))


# ---- metrics (density free: measured once at the mock's own 6 px per unit) ---------------------------------------------
def metrics():
    pen = Pen(3.0)
    f = font_for(pen)
    st = pen.R(STROKE)
    probe = ImageDraw.Draw(Image.new("L", (8, 8)))
    boxes = {ch: probe.textbbox((0, 0), ch, font=f, stroke_width=st) for ch in "0123456789x"}
    top = min(b[1] for b in boxes.values())
    bottom = max(b[3] for b in boxes.values())
    zb = probe.textbbox((0, 0), "0", font=f)
    return {
        "cap": round((zb[3] - zb[1]) / pen.big, 2),
        "h": round((bottom - top) / pen.big, 2),
        "adv": {ch: round((b[2] - b[0]) / pen.big, 2) for ch, b in boxes.items()},
    }


def band(v):
    return 3 if v >= BAND_FROM[2] else 2 if v >= BAND_FROM[1] else 1 if v >= BAND_FROM[0] else 0


def layout_scale(M, text, cap, max_w):
    """the game's layout (game/road/wildMult.ts layout): letters cap tall, held to max_w"""
    s = cap / M["cap"]
    ink = sum(M["adv"][c] for c in text) - TUCK * (len(text) - 1)
    if ink * s > max_w:
        s = max_w / ink
    return s


def ink(M, text):
    return sum(M["adv"][c] for c in text) - TUCK * (len(text) - 1)


def kind_top(M, place, top_value):
    """the letter height at which a kind's largest value fills its place's width (game/road/wildMult.ts kindTop)"""
    return min(place["caps"][-1], M["cap"] * place["maxW"] / ink(M, f"{top_value}x"))


def largest_draw(M):
    best = 0.0
    for place_name, top_value in KINDS.values():
        place = PLACE[place_name]
        top = kind_top(M, place, top_value)
        for v in VALUES:
            cap = max(place["caps"][band(v)], top) if v <= top_value else place["caps"][band(v)]
            best = max(best, layout_scale(M, f"{v}x", cap, place["maxW"]))
    return best * BREATHE


# ---- the bake --------------------------------------------------------------------------------------------------------------
def trim(im):
    a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 0)
    if not len(xs):
        return im.crop((0, 0, 1, 1)), 0, 0
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    return im.crop((x0, y0, x1, y1)), int(x0), int(y0)


def bake_glyphs(px_per_unit, style):
    pen = Pen(px_per_unit)
    f = font_for(pen)
    st = pen.R(STROKE)
    pad = pen.R(PAD)
    probe = ImageDraw.Draw(Image.new("L", (8, 8)))
    boxes = {ch: probe.textbbox((0, 0), ch, font=f, stroke_width=st) for ch in CHARS}
    top = min(b[1] for b in boxes.values())
    bottom = max(b[3] for b in boxes.values())
    out = {}
    for ch in CHARS:
        b = boxes[ch]
        w = b[2] - b[0] + 2 * pad
        h = bottom - top + 2 * pad
        fill = Image.new("L", (w, h), 0)
        ImageDraw.Draw(fill).text((pad - b[0], pad - top), ch, font=f, fill=255)
        strk = Image.new("L", (w, h), 0)
        ImageDraw.Draw(strk).text((pad - b[0], pad - top), ch, font=f, fill=255, stroke_width=st, stroke_fill=255)
        fm = np.asarray(fill).astype(np.float32) / 255.0
        sm = np.asarray(strk).astype(np.float32) / 255.0
        im = pen.down(style(pen, fm, sm))
        full_w, full_h = im.width, im.height
        cut, ox, oy = trim(im)
        out[ch] = {"im": cut, "ox": ox, "oy": oy, "fw": full_w, "fh": full_h}
    return out


def bake_fx(px_per_unit):
    """the mock's shared(): the star glint, the soft glow, the snow puff (white, tinted or not in the game)"""
    out = {}
    pen = Pen(px_per_unit)
    s = 40
    w = h = pen.R(s)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx = cy = w / 2
    dx = np.abs(xx - cx) / (w / 2)
    dy = np.abs(yy - cy) / (h / 2)
    arm = np.clip(1 - (dx * 6 + dy) ** 0.8, 0, 1) + np.clip(1 - (dy * 6 + dx) ** 0.8, 0, 1)
    core = np.clip(1 - np.hypot(dx, dy) * 2.5, 0, 1) ** 1.5
    a = np.clip(arm * 0.9 + core, 0, 1)
    out["star"] = (pen.down(layer(a, (255, 255, 255))), s)
    # the glow is a smooth blob: 64 px whatever the density (the game stretches it)
    gp = Pen(1.0)
    s = 64
    w = h = gp.R(s)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot(xx - w / 2, yy - h / 2) / (w / 2)
    a = np.clip(1 - d, 0, 1) ** 2
    out["glow"] = (gp.down(layer(a, (255, 255, 255))), s)
    s = 48
    w = h = pen.R(s)
    m = np.zeros((h, w), np.float32)
    for i in range(7):
        ang = i / 7 * math.tau
        cx = s / 2 + math.cos(ang) * s * 0.17
        cy = s / 2 + math.sin(ang) * s * 0.15
        m = np.maximum(m, pen.ellipse_mask(w, h, cx, cy, s * 0.2, s * 0.19))
    m = np.maximum(m, pen.ellipse_mask(w, h, s / 2, s / 2, s * 0.26, s * 0.24))
    shade = vgrad(h, w, [(0, (255, 255, 255)), (0.55, (246, 250, 255)), (1, (176, 196, 222))])
    body = np.concatenate([shade, m[..., None]], axis=-1)
    res = over(layer(np.clip(pen.poly_dilate(m, 1.6) - m, 0, 1), (60, 80, 110), 0.9), body)
    out["puff"] = (pen.down(res), s)
    return out


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
    """shelf pack, tallest first, at the sheet width (up to MAX_W) that gives the smallest sheet with both sides at most
    MAX_W"""
    best = None
    for max_w in range(256, MAX_W + 1, 8):
        place, w, h = shelf(pictures, gap, max_w)
        if w > MAX_W or h > MAX_W:
            continue
        if best is None or w * h < best[1] * best[2]:
            best = (place, w, h)
    if best is None:
        return None
    place, width, height = best
    sheet = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for name, im in pictures.items():
        sheet.paste(im, place[name])
    return sheet, place


def main():
    os.makedirs(OUT, exist_ok=True)
    M = metrics()
    scale = largest_draw(M)
    # the effects' largest draws (the mock's E): a star at 0.7 of its 40, a puff at about its own 48
    fx_scale = {"star": 0.7, "puff": 1.0}
    spec = {"cap": M["cap"], "h": M["h"], "tuck": TUCK, "adv": M["adv"], "drawMax": round(scale, 3), "sets": {}, "fx": {}, "sheets": {}}
    report = []
    for size, dens in DENSITY.items():
        pictures = {}
        frames = {}
        ppu = dens * scale
        jobs = [(name, ppu, (lambda sp: lambda pen, fm, sm: style_candy(pen, sp, fm, sm))(sp)) for name, sp in SETS.items()]
        jobs.append(("sheen", ppu * SHEEN_DENSITY, style_sheen))
        for name, d, style in jobs:
            spec["sets"].setdefault(name, {})[size] = round(d, 4)
            for ch, g in bake_glyphs(d, style).items():
                key = f"{name}_{ch}"
                pictures[key] = g["im"]
                frames[key] = {"ox": g["ox"], "oy": g["oy"], "fw": g["fw"], "fh": g["fh"]}
        fx = {"star": bake_fx(dens * fx_scale["star"])["star"], "puff": bake_fx(dens * fx_scale["puff"])["puff"], "glow": bake_fx(1.0)["glow"]}
        for name, (im, sz) in fx.items():
            pictures[f"fx_{name}"] = im
            frames[f"fx_{name}"] = {"ox": 0, "oy": 0, "fw": im.width, "fh": im.height}
            spec["fx"].setdefault(name, {"size": sz, "density": {}})["density"][size] = round(im.width / sz, 4)
        packed = pack(pictures, GUTTER[size])
        if packed is None:
            raise SystemExit(f"{size}: the frames do not fit one {MAX_W} px sheet")
        sheet, place = packed
        file = f"wild-mult-{size}.webp"
        # lossy color, lossless alpha (the ink edges and the shadow keep their exact coverage): QUALITY
        sheet.save(os.path.join(OUT, file), quality=QUALITY, alpha_quality=100, method=6)
        rows = {}
        for key, (x, y) in sorted(place.items()):
            fr = frames[key]
            im = pictures[key]
            rows[key] = [0, x, y, im.width, im.height, fr["ox"], fr["oy"], fr["fw"], fr["fh"]]
        kb = os.path.getsize(os.path.join(OUT, file)) / 1024
        gpu = sheet.width * sheet.height * 4 / 1048576
        spec["sheets"][size] = {"pages": [{"file": f"wild/{file}", "width": sheet.width, "height": sheet.height, "kb": round(kb, 1), "gpuMb": round(gpu, 2)}], "frames": rows}
        report.append(f"  {file}: {sheet.width} x {sheet.height}, {len(rows)} frames, {kb:.0f} KB, {gpu:.2f} MB on the GPU ({gpu * 4 / 3:.2f} with a mip chain)")
    with open(SPEC, "w") as fh:
        fh.write("// AUTO-GENERATED by tools/build_wild_mult.py (the Wilds' multipliers, candidate E Candy Cane Lettering, a fixed color\n")
        fh.write("// set per character). Do not edit: change the tool and run it again. Glyph metrics are design units (road px at the\n")
        fh.write("// bake's nominal letter height, cap); a frame row is [page, x, y, w, h, trimX, trimY, frameW, frameH] in sheet px (the\n")
        fh.write("// untrimmed frame is the glyph's ink box plus its pad, centred on the ink); a set's density is sheet px per design unit.\n")
        fh.write("export const WILD_MULT_ART = ")
        fh.write(json.dumps(spec, indent="\t"))
        fh.write(" as const;\n")
    print("wild multipliers:")
    print("  largest draw (x the nominal letters):", round(scale, 3))
    for r in report:
        print(r)


if __name__ == "__main__":
    main()
