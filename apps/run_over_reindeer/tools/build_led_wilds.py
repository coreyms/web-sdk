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
not to render, cropped to its frame's outer edge (art-src/led_intro_wilds_built_2026-11-20/src, written by that round's
tools/capture.cjs and tools/prep_sources.py). The same capture with them drawn gives the places: the number and the
word are where the two captures differ, as shares of the picture's outer edge. Since 2026-11-21 the pictures themselves come
WHOLE from tools/build_led_wild_sources.py (art-src/led_intro_lines_crop_2026-11-21/src): the same
pixels inside the outer edge, plus what the game draws past it (the tinsel's fuzz, the baubles, Santa's elbow) on a
transparent margin, and `santa_band`, the strip the column's grow shows over his right band while he is not yet standing
clear (ledScreens.ts wildGrow). The spec gives each picture's outer edge, its drawn pixels and the strip's place as shares.

THE DENSITY: 3 px per CSS px at the largest draw. The desktop tier is sized for the strike screens on the big desktop
board (LED_BOARD.size 'd' at 1440 x 900: 362 x 203 dots, 2.4835 CSS px each); the phone tier for the larger of the two
phone boards (sideways 844 x 390: 243 x 126 dots at 1.56; upright 390 x 844: 259 x 189 at 1.297). The boxes follow
ledScreens.ts screenStrike's layout (the column four rows of the cell height, the cell 1.45 times as wide, the frame
th dots outside it).

THE FACE SCREEN (Corey 2026-11-21, led_intro_face_screen_r2_2026-11-21, his pick: candidate A first in the cycle, the
face alive; constants LED_SIGN.face, ledScreens.ts screenFace) rides on the same sheets, in its own column to the right
of the Wild pictures (the Wild pictures keep their places, so their bakes do not move by a level):
  face      the approved face (led_intro_reindeer_face_r4_2026-11-21/face_2_no_smoke.png, unedited) cut to its drawn
            width (x 77 to 1595, full height), at its own 1518 px on the desktop tier (the source's whole width: no upscale;
            the board shows it 233 dots across on the 1440 x 900 desktop, 350 LEDs at 1.5 LEDs per dot) and 922 px on the
            phone tier (3 px per CSS px of the 390 x 844 board's 205 dots)
  patches   eye_<l|r>_<gaze_l|gaze_r|half|closed> and ear_<l|r>_<5|12>: each a rectangle of a whole face frame that differs
            from the face only inside it (its changed pixels' box plus MARGIN px), cut from that frame scaled whole to the
            tier, so it registers with the face exactly; the eyes split at the face's middle (x 836). The glances and the
            ears are the mock's layers (led_intro_face_screen_r2_2026-11-21/layers); the half and closed lids are the
            furred ones (tools/build_led_face_art.py, led_intro_face_built_2026-11-21/fix_2026-11-21/layers). The mock's own flat lids
            and puffs left the sheet on 2026-11-21 (Corey approved the built look: "Eyelid puff sheet looks good").
  puffs     puff_n0 to puff_n3: the breath out of the nostrils (tools/build_led_face_art.py)
The spec's `face` holds the patches' rectangles and the puffs' boxes as shares of the face, the face's drawn extent per 1%
band of its height (every ear frame with it: the pictures beside it keep clear), the nostril and the nostrils' middle, the
nose's rim as boxes (the probes: no puff over it), and each tier's `places` (each patch's corner in the face frame, px).

Writes static/assets/landing/led-wilds-full.webp and led-wilds-phone.webp (quality 90, alpha lossless: the LED punch keys
on alpha) and src/game/ledWildsSpec.ts (generated), and tools/led_face_check_data.json: the face screen's pieces as the
game decodes them from the sheets just written (each puff's alpha), so the node check tools/led_face_check.mjs bakes them through the board's own math without a browser.

Run with the math env's Python (Pillow, numpy, scipy):
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_led_face_art.py   (the face's two fixes)
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_led_wilds.py
Then `node scripts/stamp-assets.mjs` (pnpm dev and pnpm build run it for you).
"""
import base64
import json
import math
import os
import re
import sys
import zlib

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import build_wild_mult as bwm  # noqa: E402  (the multiplier's candy recipe, read only)
import build_wild_word as bww  # noqa: E402  (the WILD word's, read only)
from _paths import ART_SRC  # noqa: E402  (tools/_paths.py: the app's art-src/ folder)

# THE PICTURES WHOLE (2026-11-21, Corey: "not cut off Santa's Elbow? same on the wild ... some cropping on the bottom and
# right sides"): tools/build_led_wild_sources.py rebuilt the two captures with what the game draws past the frame's outer
# edge (the tinsel's fuzz, the baubles, Santa's elbow) and a transparent margin round it; its src.json gives each picture's
# outer edge inside it. The number's and the word's places are still read from the first captures (CAPTURE_SRC), as shares
# of the outer edge.
SRC = os.environ.get("LED_WILD_SRC") or os.path.join(ART_SRC, "led_intro_lines_crop_2026-11-21/src")
CAPTURE_SRC = os.path.join(ART_SRC, "led_intro_wilds_built_2026-11-20/src")
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
# THE FACE SCREEN's sources (see above)
FACE_SRC = os.path.join(ART_SRC, "led_intro_reindeer_face_r4_2026-11-21/face_2_no_smoke.png")
FACE_MOCK = os.path.join(ART_SRC, "led_intro_face_screen_r2_2026-11-21/layers")
FACE_BUILT = os.environ.get("LED_FACE_LAYERS") or os.path.join(ART_SRC, "led_intro_face_built_2026-11-21/fix_2026-11-21/layers")
FACE_CROP = (77, 0, 1595, 941)  # the face's drawn width (alpha x 85 to 1587) with 8 px either side; full height
FACE_TIER_W = {"full": 1518, "phone": 922}
FACE_MID = 836  # the eye patches: the left eye's from x under it, the right eye's from x at or over it
FACE_MARGIN = 6  # px of the picture round each patch's changed pixels (the downscale's reach: the rest bakes the same)
# (name, frame file, folder, half)
FACE_PATCHES = []
for _st in ("gaze_l", "gaze_r"):
    FACE_PATCHES += [(f"eye_l_{_st}", f"eyes_{_st}.png", FACE_MOCK, "l"), (f"eye_r_{_st}", f"eyes_{_st}.png", FACE_MOCK, "r")]
for _st in ("half", "closed"):
    FACE_PATCHES += [(f"eye_l_{_st}", f"eyes_{_st}_fur.png", FACE_BUILT, "l"), (f"eye_r_{_st}", f"eyes_{_st}_fur.png", FACE_BUILT, "r")]
for _side in "lr":
    for _deg in (5, 12):
        FACE_PATCHES.append((f"ear_{_side}_{_deg}", f"ears_{_side}_{_deg}.png", FACE_MOCK, None))
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
    full = np.asarray(Image.open(os.path.join(CAPTURE_SRC, f"{kind}_full.png")).convert("RGB")).astype(np.int16)
    bare = np.asarray(Image.open(os.path.join(CAPTURE_SRC, f"{kind}.png")).convert("RGB")).astype(np.int16)
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


# ---- THE FACE SCREEN'S PICTURES ---------------------------------------------------------------------------------------------
def face_parts():
    """the face, its patches' rectangles (crop px, full size), the whole variant frames, the puffs and the spec"""
    orig = Image.open(FACE_SRC).convert("RGBA")
    O = np.array(orig).astype(np.int16)
    face = orig.crop(FACE_CROP)
    fw, fh = face.size
    rects, variants = {}, {}
    for name, fn, folder, half in FACE_PATCHES:
        V = Image.open(os.path.join(folder, fn)).convert("RGBA")
        assert V.size == orig.size, (fn, V.size)
        variants[name] = V
        d = np.abs(np.array(V).astype(np.int16) - O).max(2) > 0
        if half == "l":
            d[:, FACE_MID:] = False
        elif half == "r":
            d[:, :FACE_MID] = False
        ys, xs = np.nonzero(d)
        x0, y0 = xs.min() - FACE_MARGIN - FACE_CROP[0], ys.min() - FACE_MARGIN
        x1, y1 = xs.max() + 1 + FACE_MARGIN - FACE_CROP[0], ys.max() + 1 + FACE_MARGIN
        rects[name] = (max(0, x0), max(0, y0), min(fw, x1), min(fh, y1))
    # the face's drawn rows (alpha at or over the LED punch's 70) per 1% band of its height, [left, right] shares, the face
    # and every ear frame together
    A = np.array(face)[..., 3] >= 70
    for name, V in variants.items():
        if name.startswith("ear"):
            A |= np.array(V.crop(FACE_CROP))[..., 3] >= 70
    prof = []
    for i in range(100):
        a, b = int(i * fh / 100), max(int(i * fh / 100) + 1, int((i + 1) * fh / 100))
        cols = np.nonzero(A[a:b].any(0))[0]
        prof.append([round(cols.min() / fw, 4), round((cols.max() + 1) / fw, 4)] if len(cols) else None)
    nose = json.load(open(os.path.join(FACE_BUILT, "nose.json")))
    axis = nose["axis"] - FACE_CROP[0]
    nostril = nose["nostrils"][0]["c"]
    lst = json.load(open(os.path.join(FACE_BUILT, "puffs_nostril.json")))
    puffs = [{"frame": p["frame"], "x": round((p["x"] - FACE_CROP[0]) / fw, 5), "y": round(p["y"] / fh, 5), "w": round(p["w"] / fw, 5), "h": round(p["h"] / fh, 5)} for p in lst]
    puff_ims = {p["frame"]: Image.open(os.path.join(FACE_BUILT, p["frame"] + ".png")).convert("RGBA") for p in lst}
    # the puffs' reach, both nostrils (the pictures beside the face keep clear of it)
    allp = puffs
    ax = axis / fw
    spec = {
        "frame": "face",
        "source": "led_intro_reindeer_face_r4_2026-11-21/face_2_no_smoke.png x %d to %d" % (FACE_CROP[0], FACE_CROP[2]),
        "nose": round(ax, 5),
        "nostril": [round((nostril[0] - FACE_CROP[0]) / fw, 5), round(nostril[1] / fh, 5)],
        "profile": prof,
        "puffBox": [round(min(q["x"] for q in allp), 4), round(min(q["y"] for q in allp), 4), round(max(2 * ax - q["x"] for q in allp), 4), round(min(1, max(q["y"] + q["h"] for q in allp)), 4)],
        "patches": {n: [round(r[0] / fw, 5), round(r[1] / fh, 5), round(r[2] / fw, 5), round(r[3] / fh, 5)] for n, r in rects.items()},
        "puffs": puffs,
        "rim": [[round((b[0] - FACE_CROP[0]) / fw, 4), round(b[1] / fh, 4), round((b[2] - FACE_CROP[0]) / fw, 4), round(b[3] / fh, 4)] for b in nose["rimBoxes"]],
    }
    return face, rects, variants, puff_ims, spec


def face_tier(tier, parts):
    """the tier's face, its patches and puffs as pictures, and each patch's corner in the tier's face frame"""
    face, rects, variants, puff_ims, _ = parts
    w = FACE_TIER_W[tier]
    k = w / face.width
    th = round(face.height * k)
    F = face if k == 1 else face.resize((w, th), Image.LANCZOS)
    pieces, places = {}, {}
    for name, V in variants.items():
        V = V.crop(FACE_CROP)
        if k != 1:
            V = V.resize((w, th), Image.LANCZOS)
        x0, y0, x1, y1 = rects[name]
        r = (int(np.floor(x0 * k)), int(np.floor(y0 * k)), int(np.ceil(x1 * k)), int(np.ceil(y1 * k)))
        pieces[name] = V.crop(r)
        places[name] = [r[0], r[1]]
    for name, im in puff_ims.items():
        pieces[name] = im if k == 1 else im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    return F, pieces, places


def pack_more(frames, size, face, pieces):
    """the face in its own column right of the sheet as it was, its pieces packed into the room left (MaxRects, best short
    side fit), the sheet growing down only when nothing fits; the frames already placed do not move"""
    W0, H0 = size
    fx = W0 + GAP
    W = fx + face.width
    H = max(H0, face.height)
    used = [(f["x"], f["y"], f["w"] + GAP, f["h"] + GAP) for f in frames.values()] + [(fx, 0, face.width, face.height + GAP)]
    out = dict(frames)
    out["face"] = {"x": fx, "y": 0, "w": face.width, "h": face.height}

    def split(free, u):
        ux, uy, uw, uh = u
        res = []
        for (x, y, w, h) in free:
            if ux >= x + w or ux + uw <= x or uy >= y + h or uy + uh <= y:
                res.append((x, y, w, h))
                continue
            if ux > x:
                res.append((x, y, ux - x, h))
            if ux + uw < x + w:
                res.append((ux + uw, y, x + w - ux - uw, h))
            if uy > y:
                res.append((x, y, w, uy - y))
            if uy + uh < y + h:
                res.append((x, uy + uh, w, y + h - uy - uh))
        res = [r for r in res if r[2] > 0 and r[3] > 0]
        return [a for i, a in enumerate(res) if not any(j != i and b[0] <= a[0] and b[1] <= a[1] and b[0] + b[2] >= a[0] + a[2] and b[1] + b[3] >= a[1] + a[3] and (b != a or j < i) for j, b in enumerate(res))]

    def free_of(H):
        free = [(0, 0, W, H + GAP)]
        for u in used:
            free = split(free, u)
        return free

    free = free_of(H)
    for name, im in sorted(pieces.items(), key=lambda kv: (-max(kv[1].width, kv[1].height), -kv[1].width * kv[1].height, kv[0])):
        pw, ph = im.width + GAP, im.height + GAP
        while True:
            best = None
            for (x, y, w, h) in free:
                if pw <= w and ph <= h:
                    sc = (min(w - pw, h - ph), max(w - pw, h - ph), y, x)
                    if best is None or sc < best[0]:
                        best = (sc, x, y)
            if best:
                break
            H += ph
            free = free_of(H)
        _, x, y = best
        used.append((x, y, pw, ph))
        free = split(free, (x, y, pw, ph))
        out[name] = {"x": x, "y": y, "w": im.width, "h": im.height}
        H = max(H, y + im.height)
    H = max(H0, max(f["y"] + f["h"] for f in out.values()))
    return out, (W, H)


CHECK_DATA = os.path.join(HERE, "led_face_check_data.json")
CUT_DATA = os.path.join(HERE, "led_wild_cut_data.json")


def wild_cut_data(path, frames):
    """the Wild pictures' alpha as the game decodes them from the sheet at `path` (tools/led_wild_cut_check.mjs bakes them
    onto the dot board, as led_face_check does the puffs): each frame's alpha, bytes row by row, deflated, base64"""
    im = np.array(Image.open(path).convert("RGBA"))
    pack = lambda a: base64.b64encode(zlib.compress(np.ascontiguousarray(a, np.uint8).tobytes(), 9)).decode()
    return {n: {"w": f["w"], "h": f["h"], "a": pack(im[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"], 3])} for n, f in frames.items() if n in ("santa", "grandma", "santa_band")}


def face_check_data(path, frames):
    """the face screen's puffs as the game decodes them from the sheet at `path` (tools/led_face_check.mjs bakes them
    onto the dot board): each puff frame's alpha, bytes row by row, deflated, base64. (The patches need no pixels there:
    the check takes every pixel the game puts in as changed, ledScreens.ts patchBake, and follows how far the bake
    carries it.)"""
    im = np.array(Image.open(path).convert("RGBA"))
    pack = lambda a: base64.b64encode(zlib.compress(np.ascontiguousarray(a, np.uint8).tobytes(), 9)).decode()
    out = {}
    for name, f in frames.items():
        if name.startswith("puff_n"):
            out[name] = {"w": f["w"], "h": f["h"], "a": pack(im[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"], 3])}
    return {"puffs": out}


def main():
    meta = json.load(open(os.path.join(CAPTURE_SRC, "src.json")))
    whole = json.load(open(os.path.join(SRC, "src.json")))["pictures"]
    texts = led_text()
    pics = {k: Image.open(os.path.join(SRC, f"{k}.png")).convert("RGBA") for k in ("santa", "grandma")}
    bands = {k: Image.open(os.path.join(SRC, f"{k}_band.png")).convert("RGBA") for k in pics if "band" in whole[k]}
    where = {k: places(k, meta[k]) for k in pics}
    spec = {"source": meta.get("note", "") + "; whole (fuzz, baubles, Santa's elbow): tools/build_led_wild_sources.py", "pictures": {}, "tiers": {}}
    for k in pics:
        W0, H0 = whole[k]["size"]
        ox, oy, ow, oh = whole[k]["outer"]
        ix0, iy0, ix1, iy1 = whole[k]["ink"]
        # (shares of the picture: `outer` its frame's outer edge (x, y, w, h; the box the screens lay out), `ink` its drawn
        # pixels (x0, y0, x1, y1), `band` the grow's band strip's place (x, y, w, h: frame <kind>_band), `bandClear` where the grow's picture is
        # cleared from before the strip goes over it)
        geo = {"outer": [round(ox / W0, 5), round(oy / H0, 5), round(ow / W0, 5), round(oh / H0, 5)], "ink": [round(ix0 / W0, 5), round(iy0 / H0, 5), round(ix1 / W0, 5), round(iy1 / H0, 5)]}
        if k in bands:
            bx, by, bw, bh = whole[k]["band"]
            geo["band"] = [round(bx / W0, 5), round(by / H0, 5), round(bw / W0, 5), round(bh / H0, 5)]
            geo["bandClear"] = round(whole[k]["bandClear"] / W0, 5)
        spec["pictures"][k] = {"frame": k, "plain": PLAIN[k], "set": MULT_SET[k], "text": texts[k], **({"wordLook": "candy"} if k == "grandma" else {}), **{p: {q: round(v, 4) for q, v in s.items()} for p, s in where[k].items()}, **geo}
    shares = {}
    parts = face_parts()
    spec["face"] = parts[4]
    check_data = {}
    cut_data = {}
    for tier in ("full", "phone"):
        size = target_px(tier)
        pieces = {}
        for k, im in pics.items():
            # (the target is the OUTER box's px: the whole picture at the same px per source px, its band strip likewise)
            tw, th = size[k]
            ox, oy, ow, oh = whole[k]["outer"]
            fx, fy = tw / ow, th / oh
            pw, ph = int(round(im.width * fx)), int(round(im.height * fy))
            pieces[k] = im.resize((pw, ph), Image.LANCZOS) if (pw, ph) != im.size else im
            if k in bands:
                b = bands[k]
                pieces[f"{k}_band"] = b.resize((max(1, int(round(b.width * fx))), max(1, int(round(b.height * fy)))), Image.LANCZOS)
            if tw > ow or th > oh:
                print(f"NOTE {tier} {k}: the source's outer box {ow} x {oh} is under the target {tw} x {th} (scaled up)")
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
        # THE FACE SCREEN's pictures beside them
        face, fpieces, fplaces = face_tier(tier, parts)
        frames, (W, H) = pack_more(frames, (W, H), face, fpieces)
        pieces.update(fpieces)
        pieces["face"] = face
        sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for name, f in frames.items():
            sheet.paste(pieces[name], (f["x"], f["y"]))
        file = f"landing/led-wilds-{tier}.webp"
        path = os.path.join(APP, "static", "assets", file)
        sheet.save(path, "WEBP", **WEBP)
        spec["tiers"][tier] = {"file": file, "width": W, "height": H, "kb": round(os.path.getsize(path) / 1024, 1), "frames": frames, "facePlaces": fplaces}
        check_data[tier] = face_check_data(path, frames)
        cut_data[tier] = wild_cut_data(path, frames)
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
        f.write("// growing box's color, `text` the number baked; tiers: each picture's place on its sheet in px. face: the face\n")
        f.write("// screen's patches and puffs as shares of the face (tools/build_led_face_art.py), each tier's facePlaces in px.\n")
        f.write("export const LED_WILDS = " + json.dumps(spec, indent="\t") + " as const;\n")
    with open(CHECK_DATA, "w") as f:
        json.dump({"note": "AUTO-GENERATED by tools/build_led_wilds.py for tools/led_face_check.mjs (see face_check_data)", "tiers": check_data}, f)
    print("check data", round(os.path.getsize(CHECK_DATA) / 1024, 1), "KB")
    with open(CUT_DATA, "w") as f:
        json.dump({"note": "AUTO-GENERATED by tools/build_led_wilds.py for tools/led_wild_cut_check.mjs (see wild_cut_data)", "tiers": cut_data}, f)
    print("cut data", round(os.path.getsize(CUT_DATA) / 1024, 1), "KB")


if __name__ == "__main__":
    main()
