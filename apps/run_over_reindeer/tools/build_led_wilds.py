"""THE PRESS SCREEN'S WILD PICTURES (Corey 2026-11-20: "The LED Intro Screens need to be updated with the new FUll Screen
Wild and Grandma WIld styles, not the full animations because it's supposed to be an LED board, but the styles no longer
match"; constants LED_SIGN.wilds, game/landing/ledScreens.ts screenStrike).

The sleigh screen's standing column and the car screen's Grandma Wild are the game's own Wilds as they stand on the road,
as still pictures, packed into one small sheet per device tier:
  santa     Santa's column as the game draws it standing (his idle pose over the cloud backdrop, the red tinsel garland
            and its gold baubles), its number, word and twinkles not drawn
  grandma   the Grandma Wild as the game draws it standing (her brawl cloud in the green tinsel garland), likewise
  <kind>_mult_<look>, grandma_word_<look>
            the number (constants LED_SIGN.text sleighMult, carMult; Santa's green set, Grandma's gold) and the WILD word in
            the game's own candy lettering (tools/build_wild_mult.py and tools/build_wild_word.py, imported read only: the
            same font, ink outline, shadow, shine and stripes), laid out as game/road/wildMult.ts and wildWord.ts lay them
            out. look 'stripes': exactly the game's letters; 'solid': the same recipe with the stripes (the gold's tinsel
            flecks) flattened to the stripes' mean color.

THE PICTURES' SOURCE: the game's own render of each Wild (no new art, no image generation): captured from the dev
server at 1920 x 1080 with the renderer at 3 device px per CSS px (?rescap=3), the Wild's number, word and twinkles set
not to render, cropped to its frame's outer edge (Desktop/Run Over Reindeer/led_intro_wilds_built_2026-11-20: tools/
capture.cjs, tools/prep_sources.py write src/). The same capture with them drawn gives the places: the number and the
word are where the two captures differ, as shares of the picture.

THE DENSITY: 3 px per CSS px at the largest draw. The desktop tier is sized for the strike screens on the big desktop
board (LED_BOARD.size 'd' at 1440 x 900: 362 x 203 dots, 2.4835 CSS px each); the phone tier for the larger of the two
phone boards (sideways 844 x 390: 243 x 126 dots at 1.56; upright 390 x 844: 259 x 189 at 1.297). The boxes follow
ledScreens.ts screenStrike's layout (the column four rows of the cell height, the cell 1.45 times as wide, the frame
th dots outside it).

Writes static/assets/landing/led-wilds-full.webp and led-wilds-phone.webp (quality 90, alpha lossless: the LED punch keys
on alpha) and src/game/ledWildsSpec.ts (generated).

Run with the math env's Python (Pillow, numpy, scipy):
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_led_wilds.py
Then `node scripts/stamp-assets.mjs` (pnpm dev and pnpm build run it for you).
"""
import json
import math
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import build_wild_mult as bwm  # noqa: E402  (the multiplier's candy recipe, read only)
import build_wild_word as bww  # noqa: E402  (the WILD word's, read only)

SRC = os.path.expanduser("~/Desktop/Run Over Reindeer/led_intro_wilds_built_2026-11-20/src")
OUT = os.path.join(APP, "static", "assets", "landing")
SPEC = os.path.join(APP, "src", "game", "ledWildsSpec.ts")
CONSTANTS = os.path.join(APP, "src", "game", "constants.ts")
GAP = 2
WEBP = dict(quality=90, alpha_quality=100, method=6)
DENSITY = 3.0  # px per CSS px at the largest draw

# the boards the strike screens draw on (dots, CSS px per dot), per tier; `tall` as ledScreens.ts (W / H < 1.7); for
# the upright phone the words below the picture take at least `lay` of the face's height (its layoutText; measured
# 0.37 to 0.42 on the 390 x 844 board, the smaller share taken: the larger picture)
BOARDS = {
    "full": [{"W": 362, "H": 203, "pitch": 2.4835}],
    "phone": [{"W": 243, "H": 126, "pitch": 1.56}, {"W": 259, "H": 189, "pitch": 1.297, "lay": 0.37}],
}
# the frame colors the screens draw the growing box in (constants WILD_FRAME.plain: the garland's plain box)
PLAIN = {"santa": "#b3192b", "grandma": "#238c3c"}
MULT_SET = {"santa": "green", "grandma": "gold"}


def led_text():
    """LED_SIGN.text sleighMult and carMult, as constants.ts has them (the numbers baked)"""
    src = open(CONSTANTS).read()
    a = re.search(r"sleighMult:\s*'([^']+)'", src).group(1)
    b = re.search(r"carMult:\s*'([^']+)'", src).group(1)
    return {"santa": a.lower(), "grandma": b.lower()}


def boxes(board):
    """the column's and the cell's outer box in dots on one board (ledScreens.ts screenStrike)"""
    W, H = board["W"], board["H"]
    tall = W / H < 1.7
    if not tall:
        ph = H - 6
    else:
        ph = H - 4 - round(H * board.get("lay", 0.37)) - 6
    out = {}
    for kind, nr in (("santa", 4), ("grandma", 2 if tall else 3)):
        ch = max(6, ph // nr)
        cw = round(ch * 1.45)
        th = 2 if ch >= 22 else 1
        h = ch * (nr if kind == "santa" else 1)
        out[kind] = (cw + 2 * th, h + 2 * th)
    return out


def target_px(tier):
    """each picture's size in px: 3 px per CSS px of its largest draw on the tier's boards"""
    best = {}
    for b in BOARDS[tier]:
        for kind, (w, h) in boxes(b).items():
            px = (w * b["pitch"] * DENSITY, h * b["pitch"] * DENSITY)
            if kind not in best or px[1] > best[kind][1]:
                best[kind] = px
    return {k: (int(math.ceil(w)), int(math.ceil(h))) for k, (w, h) in best.items()}


# ---- the places: where the game draws the number and the word on each picture ------------------------------------------
def places(kind, meta):
    """the number's (and the word's) box as shares of the picture: where its full and bare captures differ, inside the
    frame's band (the twinkles on the band are left out)"""
    full = np.asarray(Image.open(os.path.join(SRC, f"{kind}_full.png")).convert("RGB")).astype(np.int16)
    bare = np.asarray(Image.open(os.path.join(SRC, f"{kind}.png")).convert("RGB")).astype(np.int16)
    h, w = bare.shape[:2]
    d = np.abs(full - bare).max(axis=2) > 40
    band = int(round(meta["bandPx"] * 0.8))
    m = np.zeros_like(d)
    m[band:h - band, band:w - band] = d[band:h - band, band:w - band]
    m = ndimage.binary_closing(m, iterations=6)
    lab, n = ndimage.label(m)
    blobs = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        area = int((lab[sl] == i).sum())
        if area < 0.002 * w * h:
            continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        blobs.append({"x0": x0, "x1": x1, "y0": y0, "y1": y1, "area": area})
    blobs.sort(key=lambda b: -b["area"])
    share = lambda b: {"cx": (b["x0"] + b["x1"]) / 2 / w, "cy": (b["y0"] + b["y1"]) / 2 / h, "w": (b["x1"] - b["x0"]) / w, "h": (b["y1"] - b["y0"]) / h}
    if kind == "santa":
        return {"mult": share(blobs[0])}
    # the Grandma Wild: the word is the blob up and to the left, the number the one below it
    two = sorted(blobs[:2], key=lambda b: b["y0"])
    return {"word": share(two[0]), "mult": share(two[1])}


# ---- the letters, as the game lays them out ------------------------------------------------------------------------------
def solid_of(spec):
    """the look 'solid': the set's stripes (or the gold's tinsel) as one color, the stripes' mean"""
    if "stripes" in spec:
        a, b = spec["stripes"]
        c = tuple(int(round((x + y) / 2)) for x, y in zip(a, b))
        return {"stripes": (c, c)}
    _, top, bot = spec["tinsel"]
    c = tuple(int(round((x + y) / 2)) for x, y in zip(top, bot))
    return {"stripes": (c, c)}


def trim(im):
    a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 8)
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def mult_image(text, color, look, ppu):
    """the number `text` (e.g. 10x) in a color set, laid out as game/road/wildMult.ts layout (each glyph's frame centred on
    its advance's middle, advances less the tuck), at `ppu` px per design unit"""
    spec = bwm.SETS[color] if look == "stripes" else solid_of(bwm.SETS[color])
    style = lambda pen, fm, sm: bwm.style_candy(pen, spec, fm, sm)
    old = bwm.CHARS
    bwm.CHARS = "".join(sorted(set(text)))
    try:
        g = bwm.bake_glyphs(ppu, style)
    finally:
        bwm.CHARS = old
    M = bwm.metrics()
    xs, x = [], 0.0
    for ch in text:
        a = M["adv"][ch]
        xs.append(x + a / 2)
        x += a - bwm.TUCK
    fh = max(g[ch]["fh"] for ch in text)
    fw = max(g[ch]["fw"] for ch in text)
    W = int(math.ceil((x + bwm.TUCK) * ppu + fw))
    canvas = Image.new("RGBA", (W, fh), (0, 0, 0, 0))
    for ch, cx in zip(text, xs):
        G = g[ch]
        full = Image.new("RGBA", (G["fw"], G["fh"]), (0, 0, 0, 0))
        full.paste(G["im"], (G["ox"], G["oy"]))
        px = int(round(cx * ppu + fw / 2 - G["fw"] / 2))
        canvas.alpha_composite(full, (px, (fh - G["fh"]) // 2))
    return trim(canvas)


def word_image(look, dens):
    """WILD as game/road/wildWord.ts draws it at rest: its four candy letters by their advances, turned
    GRANDMA_BRAWL.word.candy.rot (-8 degrees: up to the right), at `dens` px per road px of the bake's capital"""
    colors = bww.COLORS if look == "stripes" else solid_of({"stripes": bww.COLORS})["stripes"]
    old = bww.COLORS
    bww.COLORS = colors
    try:
        ims, letters = bww.bake(bww.candy_render(), dens)
    finally:
        bww.COLORS = old
    xs, x = [], 0.0
    width = sum(letters[c]["adv"] for c in "WILD")
    for c in "WILD":
        xs.append(x + letters[c]["adv"] / 2 - width / 2)
        x += letters[c]["adv"]
    wmax = max(im.width for im in ims.values())
    hmax = max(im.height for im in ims.values())
    W = int(math.ceil(width * dens + wmax))
    canvas = Image.new("RGBA", (W, hmax), (0, 0, 0, 0))
    for c, cx in zip("WILD", xs):
        im = ims[c]
        canvas.alpha_composite(im, (int(round(W / 2 + cx * dens - im.width / 2)), (hmax - im.height) // 2))
    canvas = canvas.rotate(8, resample=Image.BICUBIC, expand=True)
    return trim(canvas)


def fit(im, w, h):
    """down to w x h (or under, keeping its shape)"""
    k = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


# ---- the sheets ---------------------------------------------------------------------------------------------------------
def pack(pieces):
    """the tallest picture (the column) at the left, the rest shelf packed beside it, as wide as the widest of them:
    {name: (x, y, w, h)}, size"""
    order = sorted(pieces.items(), key=lambda kv: -kv[1].height)
    first, rest = order[0], order[1:]
    frames = {first[0]: {"x": 0, "y": 0, "w": first[1].width, "h": first[1].height}}
    x0 = first[1].width + GAP
    right = max(im.width for _, im in rest)
    x = y = row_h = 0
    for name, im in sorted(rest, key=lambda kv: (-kv[1].height, kv[0])):
        if x and x + im.width > right:
            y += row_h + GAP
            x = row_h = 0
        frames[name] = {"x": x0 + x, "y": y, "w": im.width, "h": im.height}
        x += im.width + GAP
        row_h = max(row_h, im.height)
    return frames, (x0 + right, max(first[1].height, y + row_h))


def main():
    meta = json.load(open(os.path.join(SRC, "src.json")))
    texts = led_text()
    pics = {k: Image.open(os.path.join(SRC, f"{k}.png")).convert("RGBA") for k in ("santa", "grandma")}
    where = {k: places(k, meta[k]) for k in pics}
    spec = {"source": meta.get("note", ""), "pictures": {}, "tiers": {}}
    for k in pics:
        spec["pictures"][k] = {"frame": k, "plain": PLAIN[k], "set": MULT_SET[k], "text": texts[k], **({"wordLook": "candy"} if k == "grandma" else {}), **{p: {q: round(v, 4) for q, v in s.items()} for p, s in where[k].items()}}
    shares = {}
    for tier in ("full", "phone"):
        size = target_px(tier)
        pieces = {}
        for k, im in pics.items():
            tw, th = size[k]
            pieces[k] = im.resize((tw, th), Image.LANCZOS) if (tw, th) != im.size else im
            if tw > im.width or th > im.height:
                print(f"NOTE {tier} {k}: the source {im.size} is under the target {tw} x {th} (scaled up)")
            for look in ("stripes", "solid"):
                for part in ("mult", "word"):
                    if part not in where[k]:
                        continue
                    P = where[k][part]
                    name = f"{k}_{part}_{look}"
                    make = (lambda d, look=look, k=k: mult_image(texts[k], MULT_SET[k], look, d)) if part == "mult" else (lambda d, look=look: word_image(look, d))
                    if name not in shares:
                        # (the desktop tier first) fitted to the box where the game draws it; its own shape kept, the
                        # spec's box then made its size
                        bw, bh = P["w"] * tw, P["h"] * th
                        probe = make(1.0)
                        piece = fit(make(max(1.0, bw / probe.width * 1.4)), bw, bh)
                        shares[name] = (piece.width / tw, piece.height / th)
                    else:
                        sw, sh = shares[name]
                        probe = make(1.0)
                        piece = make(max(1.0, sw * tw / probe.width * 1.4))
                        piece = piece.resize((max(1, round(sw * tw)), max(1, round(sh * th))), Image.LANCZOS)
                    pieces[name] = piece
        frames, (W, H) = pack(pieces)
        sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for name, f in frames.items():
            sheet.paste(pieces[name], (f["x"], f["y"]))
        file = f"landing/led-wilds-{tier}.webp"
        path = os.path.join(APP, "static", "assets", file)
        sheet.save(path, "WEBP", **WEBP)
        spec["tiers"][tier] = {"file": file, "width": W, "height": H, "kb": round(os.path.getsize(path) / 1024, 1), "frames": frames}
        print(tier, (W, H), spec["tiers"][tier]["kb"], "KB", {k: v for k, v in size.items()})
    # each part's box: its measured centre, the piece's own size (both looks share the stripes' box)
    for k in pics:
        for part in ("mult", "word"):
            if part in spec["pictures"][k]:
                sw, sh = shares[f"{k}_{part}_stripes"]
                spec["pictures"][k][part]["w"] = round(sw, 4)
                spec["pictures"][k][part]["h"] = round(sh, 4)
    with open(SPEC, "w") as f:
        f.write("// AUTO-GENERATED by tools/build_led_wilds.py (the press screen's Wild pictures: the game's own Santa column and\n")
        f.write("// Grandma Wild, their numbers and the WILD word; constants LED_SIGN.wilds, game/landing/ledScreens.ts). Do not\n")
        f.write("// edit: run the tool again. pictures: each part's box as shares of its picture (centre, width, height), `plain` the\n")
        f.write("// growing box's color, `text` the number baked; tiers: each picture's place on its sheet in px.\n")
        f.write("export const LED_WILDS = " + json.dumps(spec, indent="\t") + " as const;\n")


if __name__ == "__main__":
    main()
