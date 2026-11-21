"""THE SUPER WHEEL'S ART (Corey 2026-11-18, the approved mock super_wheel_2026-11-18 round 5, "Mc Under the number and P2";
the game draws it in game/road/superWheel.ts, constants SUPER_WHEEL). One sheet per asset tier, every piece a flat
pre-baked sprite (no mask, filter or shader at run time):

  wedge_reindeer / wedge_santa   one 45 degree wedge per character: the flat wedge colour (reindeer green #1f8f45, Santa
                                 red #d0262c), its darker edges, half of the dark divider on each side, and the character's
                                 bust raised to the rim (MC), cut to the wedge here. The bust is the game's SHIPPED column
                                 Wild art (the d215 idle sheet's frame 0), scaled, never redrawn.
  hi                             the winner's highlight: the wedge's full shape (hub to the gold trim, the true sides)
  rim                            one 45 degree piece of the candy cane rim with its gold trim, drawn here by rule as a
                                 TRUE CIRCLE about the wheel's centre (the mock's generated ring was round only to 0.6% and
                                 off centre: Corey, "The Wheel itself doesn't seem perfectly circle, or it's off centered").
                                 Eight copies turned by 45 degrees make the rim; the stripes repeat every 15 degrees.
  stud, bulb_<c>_<on|off>        the gold studs on the trim and the string lights (four colours, lit and dim)
  (the wedges' numbers)           since 2026-11-20 the Wild multipliers' own sprites (game/road/wildMult.ts, Corey: "put
                                 the new wild multipliers in the place of the yellow"); the old num_<m>x went
  ring, ring_hi, ring_ptr, col_<n>   P2's inner ring of the five columns, its winner's highlight, its pointer, its digits
  hub, tag, medal_<tier>         the hub (the mock's approved layer, tools/super_wheel_src/hub.webp, recentred here on its
                                 own gold disc), the SPIN tag, the winner's face on a gold medal (the same shipped bust)
  peg_bracket, peg_flap          the top peg (the mock's approved layers, tools/super_wheel_src/)
  base                           a plain disc (the wheel's dark back and its drop shadow, tinted)

Everything is in WHEEL UNITS about the wheel's centre (0, 0): the rim's outer edge is radius 460, y is up negative, a
wedge's own middle points up. Each frame's `ox, oy` is where the piece's own origin (the wheel's centre, the peg's
bolt, a number's baseline middle) falls inside it, in sheet px: the game anchors the sprite there, so every piece
shares one centre by construction.

Also measured here, from the shipped side run (static/assets/reindeer/run-full-*.webp, view R): for each of the 16
poses, how far the body is lowered so that its lowest hoof pixel is exactly on the rim's outer edge when he runs on the
wheel's left shoulder (RUN below), on the exact circle. The game only reads the table.

Density: 3 physical px per CSS px at the largest draw (desktop 1440 x 900: a 604 CSS px wheel, 0.657 CSS px per unit,
so 2.0 sheet px per unit; the upright phone's 381 px wheel: 1.25).

Run with the math env's Python (Pillow, numpy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_super_wheel.py
Writes static/assets/wheel/super-wheel.webp, super-wheel-phone.webp and src/game/superWheelSpec.ts.
"""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
ASSETS = os.path.join(APP, "static", "assets")
OUT = os.path.join(ASSETS, "wheel")
SRC = os.path.join(HERE, "super_wheel_src")
SPEC = os.path.join(APP, "src", "game", "superWheelSpec.ts")
FONT = os.path.join(ASSETS, "fonts", "overpass", "Overpass-heavy.woff2")
DENSITY = {"full": 2.0, "phone": 1.25}  # sheet px per wheel unit
SS = 3  # supersampling of every drawn shape

# ---- the wheel's geometry, wheel units (the mock's faces5.js and wheel_r5_open_me.html) --------------------------------
# THE CANDY CANE RIM'S WIDTH (Corey 2026-11-20: "can we reduce the width of the candy cane border, keeping the same wheel
# size? make the wedges and characters larger"): the candy band's width as a share of round 5's (55.3 units). The outer
# edge stays at RIM; the gold trim, its studs and the string lights move out by what the band gives up, and the wedges
# (their busts and numbers) grow into it about the hub. RIM_SHARE in the environment overrides it (the build's captures of
# the other widths).
# THE LAYOUT PAGE'S ROUND 3 (Corey 2026-11-20, wheel_layout_r3_2026-11-20: "Can we go with tihs for small screens ... and
# this for tablet/desktop?"): rim 0.46 (it was 0.5).
RIM_SHARE = float(os.environ.get("RIM_SHARE", "0.46"))
CANDY_W0 = 453.5 - 398.2  # round 5's candy band
GROW = CANDY_W0 * (1.0 - RIM_SHARE)  # how far everything inside the candy band moves out
RIM = 460.0  # the rim's outer edge: the reindeer runs on it
R_HUB = 94.0
R_WEDGE = 392.0 + GROW  # the wedges run out under the gold trim
WEDGE_K = (R_WEDGE - R_HUB) / (392.0 - R_HUB)  # the wedges' growth about the hub
# THE STUDS (layout page round 3: studs 1.09, radialOffset 6.5): every radius of the stud (its ink 17.5, its gold 12.5, its
# highlight 4.5 and that highlight's offset) times STUD_SIZE, its centre STUD_SHIFT units further out than the trim's rule
STUD_SIZE = 1.09
STUD_SHIFT = 6.5
STUD_INK0, STUD_GOLD0, STUD_HL0 = 17.5, 12.5, 4.5  # round 5's stud radii (its highlight's radius is also its offset)
STUD_R = 385.4 + GROW + STUD_SHIFT
STUD_OUT = STUD_INK0 * STUD_SIZE  # the stud's outer (ink) radius
# THE PEG MEETS THE STUDS (Corey 2026-11-20: "pay attention to the circles the pin is supposed to come in contact with,
# the pin moves way too early"): its tip (the end of the flapper's centre line) reaches TIP_BITE units inside the studs'
# outer edge; the bolt sits above it by the flapper's length (scaled with the peg about its tip, game/road/superWheel.ts).
# 7 until the layout page; his round 2 settings asked 20 with the pin lowered 8.5 (28.5) on a flapper 1.22 long.
# 11 for one build (6a95d3b): every stud let go before the closest stop, so the pin always came back straight. Corey then
# (2026-11-20): "Go deeper, by dropping lower I was trying to make it move more visibly": 28.5 again, the tip down among
# the string lights. A stop can now leave the pin leaning on a stud's side, as a real clicker does (game/road/wheelPeg.ts).
TIP_BITE = 28.5
# THE FLAPPER'S LENGTH (Corey 2026-11-20, his round 2 value, kept: "I actually did not mean to change the size of the
# flapper"): 1.22 times its art, REDRAWN at that length (make_long_flap: one more turn of its stripe, never a stretch)
FLAP_LENGTH = 1.22
PEG_TIP = 165.0 * FLAP_LENGTH  # the flapper's tip below its bolt as round 3 placed it (the art measures 164.85: pegFit)
TIP_R = STUD_R + STUD_OUT - TIP_BITE
RING = (100.0, 168.0)  # P2's inner ring
HUB_K = 0.8
SLICES = 8
STEP = 360.0 / SLICES
INK = (0x14, 0x16, 0x1F)
COLORS = {"santa": (0xD0, 0x26, 0x2C), "reindeer": (0x1F, 0x8F, 0x45)}
GOLD = (0xFF, 0xD2, 0x1F)
# the rim's bands, inner to outer radius
TRIM = {"wire": (378.5 + GROW, 383.0 + GROW), "gold": (383.0 + GROW, 395.0 + GROW), "goldLight": (385.2 + GROW, 388.2 + GROW), "goldDark": (392.4 + GROW, 395.0 + GROW), "inkIn": (395.0 + GROW, 398.2 + GROW), "candy": (398.2 + GROW, 453.5), "inkOut": (453.5, RIM)}
STRIPES = 48  # red and white together: a multiple of 8, so every 45 degree piece is the same
TWIST = 6.75  # degrees a stripe leans across the candy band
# the bust on a wedge (MC): the character's nose at radius rf, the bust (0.6 of the picture's height) `units` tall; fx, fy
# the nose in the trimmed picture (faces5.js ART, FACE_UP and MC's + 18 / - 14)
BUST0 = {"reindeer": {"w": 564, "h": 1471, "fx": 0.62, "fy": 0.31, "rf": 270 + 18, "units": 236 - 14}, "santa": {"w": 712, "h": 1471, "fx": 0.55, "fy": 0.245, "rf": 274 + 18, "units": 244 - 14}}
# THE BUSTS (layout page round 3): each bust's size (times its grown height), its nose moved in or out (wheel units, + is
# out toward the rim), sideways (+ is clockwise) and turned about the nose (degrees, + is clockwise); still cut to its
# wedge, the number over it
BUST_SIZE = {"reindeer": 2.37, "santa": 2.36}
BUST_SHIFT_R = {"reindeer": -29.0, "santa": -90.5}
BUST_X = {"reindeer": 30.5, "santa": 9.5}
BUST_ROT = {"reindeer": 1.0, "santa": 0.5}
# (grown with the wedge about the hub, then the page's settings; the shipped art itself, never redrawn)
BUST = {t: {**b, "rf": R_HUB + (b["rf"] - R_HUB) * WEDGE_K + BUST_SHIFT_R[t], "units": b["units"] * WEDGE_K * BUST_SIZE[t], "x": BUST_X[t], "rot": BUST_ROT[t]} for t, b in BUST0.items()}
# THE BUSTS' SOURCE (2026-11-20): at 2.36 the bust is about 995 wheel units tall, 1990 sheet px at the desktop sheet's
# density, more than the d215 idle frame's 1471. The keyed source frame that frame 0 was cut from (1920 x 3408,
# tools/build_columns.py SOURCES idle, frame 1) is read instead, through the SAME crop (the clip's box, then the frame's
# own ink across), so the placement above is unchanged; the d215 frame is only the check (load_bust)
BUST_SRC = {"reindeer": "column_idle/v6_keyed_v2", "santa": "santa_idle/v1_keyed"}
BUST_SRC_ROOT = os.path.expanduser("~/Desktop/Run Over Reindeer/animation")
BUST_SRC_FRAME = (1920, 3408)
BUST_CHECK_MAX = 4.0  # the keyed source brought down to the d215 frame may differ from it by at most this (mean, 0 to 255)
# THE WEDGE'S NUMBER (2026-11-20: Corey's Wild multipliers, game/road/wildMult.ts, in place of the yellow): its centre's
# radius, round 5's number's middle (baseline 166, the digits 66 above it and 10 below) grown with the wedge, then the
# layout page's round 3 radialOffset (+149.5: out under the string lights)
MULT_SHIFT_R = 149.5
MULT_R = R_HUB + (166.0 + (66.0 - 10.0) / 2 - R_HUB) * WEDGE_K + MULT_SHIFT_R
# THE NUMBERS' OUTLINE (layout page round 3, outline type "even"): each letter's SOLID shape (the Wild multiplier atlas's
# letter where its alpha is over OUTLINE_SOLID: its fill and its ink edge, never its soft baked shade) grown by one
# thickness all round, in wheel units: OUTLINE_UNITS.phone on the game's phone layouts (layoutSpec isPhoneSizeType:
# the window's short side 480 CSS px or less), .wide on tablets and desktops. Baked here, one black silhouette per
# letter, drawn behind each letter (game/road/wildMult.ts setOutlineArt). The letters stand WHEEL_CAP tall on every wedge
# (constants WILD_MULT.place.wheel caps: one height for every value, never squeezed)
OUTLINE_UNITS = {"phone": 6.1, "wide": 2.8}
OUTLINE_SOLID = 200
WHEEL_CAP = 58.24
OUTLINE_COLORS = {"reindeer": "red", "santa": "green"}  # constants WILD_MULT.colors
WHEEL_VALUES = {"reindeer": [4, 5, 6, 8], "santa": [10, 12, 15, 30]}  # game/superWheelPlan.ts WHEEL_SHARES
WILD_SPEC = os.path.join(APP, "src", "game", "wildMultSpec.ts")
MULTS = [4, 5, 6, 8, 10, 12, 15, 30]
MULT_SIZE = 80.0  # font size, wheel units (MC); its baseline sits at radius 166
MULT_BASE = 166.0
COL_SIZE = 56.0
BULB_COLORS = {"r": ((0xFF, 0x3B, 0x30), (0x6E, 0x17, 0x12)), "y": ((0xFF, 0xD2, 0x1F), (0x6E, 0x5A, 0x10)), "g": ((0x37, 0xD6, 0x7A), (0x16, 0x5A, 0x30)), "b": ((0x4A, 0xA8, 0xFF), (0x1B, 0x43, 0x70))}
# the mock's placement of its hub and peg layers (assets2/data2.js look l1), wheel units
HUB_SRC = {"x": -144.75166508087537, "y": -163.3244529019981, "w": 291.12844909609896}
PEG_SRC = {"x": -79.10958904109589, "y": -66.45205479452055, "w": 154.3013698630137, "h": 231.45205479452054, "boltY": -569.0, "tip": 165.0}
# the flapper redrawn at FLAP_LENGTH (make_long_flap), in the art's own px (1024 x 1536, its bolt at row 441): the edges
# smoothed over FLAP_SMOOTH rows, the stripe pitch measured on columns FLAP_PITCH_COLS over rows FLAP_BODY, the stripes'
# slant measured out to FLAP_SLANT_U of the width either side of the middle (stripe_slant), the taper drawn out over rows
# FLAP_ZONE (below the cap, above the rounded tip), one pitch of stripe phase doubled at FLAP_SEAM: the middle of the white
# stripe from row 900 to 1042 at the middle column (one pitch above, 692, is the middle of the one from 621 to 755), so
# the seam runs through white at every place across the body and never through a red stripe's highlight; the row each
# pixel is read from is solved FLAP_SOLVE times (its slant depends on that row)
FLAP_SMOOTH = 15
PEG_PROFILE_N = 41  # the flapper's half width sampled at this many steps from the bolt to the tip (make_peg)
FLAP_PITCH_COLS = (480, 568)
FLAP_BODY = (500, 1450)
FLAP_SLANT_U = 0.42
FLAP_ZONE = (640, 1470)
FLAP_SEAM = 971
FLAP_SOLVE = 4

# ---- the reindeer on the rim -------------------------------------------------------------------------------------------
RUN = {
    "boxShare": 0.40,  # the run view's box width over the wheel's diameter (the mock: frameW = D0 * 0.40)
    "shoulderDeg": -40.0,  # where his hooves meet the rim, degrees from the top (left of the peg)
    "contactBackFramePx": 100 / 0.3825,  # the hooves' middle is this far behind the feet point (the mock's 100 box px)
    "sweepFramePx": 71.9,  # the planted hoof's sweep per pose (constants STRIKE)
    "tuck": 0.5,  # wheel units the lowest hoof pixel sits inside the rim's edge, so the two outlines meet with no hairline
}


def canvas(x0, y0, x1, y1, d):
    """pixel centres of a canvas covering [x0, x1] x [y0, y1] wheel units at d * SS px per unit: X, Y, r, angle (deg from up, clockwise)"""
    k = d * SS
    w = int(math.ceil((x1 - x0) * d)) * SS
    h = int(math.ceil((y1 - y0) * d)) * SS
    xs = x0 + (np.arange(w) + 0.5) / k
    ys = y0 + (np.arange(h) + 0.5) / k
    X, Y = np.meshgrid(xs, ys)
    r = np.hypot(X, Y)
    a = np.degrees(np.arctan2(X, -Y))
    return X, Y, r, a, w, h


def down(rgba):
    """box filter the supersampled float RGBA (premultiplied inside) down by SS, to an 8 bit image"""
    h, w, _ = rgba.shape
    a = rgba[..., 3:4]
    pm = np.concatenate([rgba[..., :3] * a, a], axis=2)
    pm = pm.reshape(h // SS, SS, w // SS, SS, 4).mean(axis=(1, 3))
    al = pm[..., 3:4]
    rgb = np.where(al > 1e-6, pm[..., :3] / np.maximum(al, 1e-6), 0)
    out = np.concatenate([rgb, al], axis=2)
    return Image.fromarray(np.clip(np.round(out * 255), 0, 255).astype(np.uint8), "RGBA")


def blank(w, h):
    return np.zeros((h, w, 4), np.float64)


def paint(img, mask, colour, alpha=1.0):
    """source over: a flat colour through a boolean or float mask"""
    m = mask.astype(np.float64) * alpha
    c = np.array(colour, np.float64) / 255.0
    a0 = img[..., 3]
    a1 = m + a0 * (1 - m)
    for i in range(3):
        img[..., i] = np.where(a1 > 1e-9, (c[i] * m + img[..., i] * a0 * (1 - m)) / np.maximum(a1, 1e-9), 0)
    img[..., 3] = a1


def wedge_dist(X, Y, r, a, half, r0, r1):
    """signed distance to a wedge's boundary (negative inside), wheel units: the wedge is |angle| <= half, r0 <= r <= r1"""
    side = r * np.sin(np.radians(np.abs(a) - half))  # distance past a side line (negative inside)
    side = np.where(np.abs(a) - half > 90, r, side)
    return np.maximum(np.maximum(side, r - r1), r0 - r)


def load_bust_d215(tier):
    """the shipped column Wild art: the d215 idle sheet's frame 0, trimmed to its ink across (tools/build_columns.py made
    it); also where that frame sits in its keyed source frame (the clip's box, source px)"""
    src = open(os.path.join(APP, "src", "game", "columnClipSpec.ts")).read()
    spec = json.loads(src[src.index("{") : src.rindex("}") + 1])
    clip = spec["clips"][tier]["idle"]
    t = clip["tiers"]["d215"]
    sheet = Image.open(os.path.join(ASSETS, t["sheets"][0]["file"])).convert("RGBA")
    frame = sheet.crop((0, 0, t["frameWidth"], t["frameHeight"]))
    box = frame.getchannel("A").getbbox()  # every pixel with any ink, as the mock cut it
    cut = frame.crop((box[0], 0, box[2], frame.height))
    B = BUST[tier]
    assert cut.size == (B["w"], B["h"]), f"{tier}: the idle frame is {cut.size}, the mock's placement was made for {(B['w'], B['h'])}"
    # tools/build_columns.py: the frame is the source cropped to the clip's box (x from the column's left edge, road px; the
    # source fitted by its height to the column's 684 road px) and scaled to frameWidth x frameHeight
    fw, fh = BUST_SRC_FRAME
    road_per_src = spec["column"]["height"] / fh
    bx0 = (clip["x"] + (fw * road_per_src - spec["column"]["width"]) / 2) / road_per_src
    bw = clip["width"] / road_per_src
    bh = clip["height"] / road_per_src
    sx, sy = bw / t["frameWidth"], bh / t["frameHeight"]
    rect = (bx0 + box[0] * sx, clip["y"] / road_per_src, bx0 + box[2] * sx, clip["y"] / road_per_src + frame.height * sy)
    return cut, rect


def load_bust(tier):
    """THE BUST'S PICTURE: the keyed source frame (BUST_SRC) and the rectangle of it (source px, floats) that IS the d215
    cut the placement (BUST0) was made for. Checked here: that rectangle brought down to the cut's size matches the cut."""
    cut, rect = load_bust_d215(tier)
    folder = os.path.join(BUST_SRC_ROOT, BUST_SRC[tier])
    files = sorted(f for f in os.listdir(folder) if f.endswith(".png"))
    src = Image.open(os.path.join(folder, files[0]))
    src.load()
    src = src.convert("RGBA")
    assert src.size == BUST_SRC_FRAME, f"{tier}: the keyed source frame is {src.size}"
    # the check: the source through the rectangle at the cut's size, against the cut (premultiplied colour, and alpha)
    x0, y0, x1, y1 = rect
    w, h = cut.size
    a = (x1 - x0) / w
    e = (y1 - y0) / h
    small = src.convert("RGBa").transform((w, h), Image.AFFINE, (a, 0, x0, 0, e, y0), resample=Image.BICUBIC)
    small = np.asarray(small.resize((w, h)), np.float64)
    ref = np.asarray(cut.convert("RGBa"), np.float64)
    diff = float(np.abs(small - ref).mean())
    print(f"  {tier} bust: keyed source {files[0]} through ({x0:.1f}, {y0:.1f}) to ({x1:.1f}, {y1:.1f}) source px ({x1 - x0:.0f} x {y1 - y0:.0f}); against the d215 cut ({w} x {h}): mean difference {diff:.2f} of 255")
    assert diff <= BUST_CHECK_MAX, f"{tier}: the keyed source does not match the d215 frame ({diff:.2f})"
    return {"src": src, "rect": rect, "w": w, "h": h, "check": round(diff, 2), "srcPx": [round(x1 - x0, 1), round(y1 - y0, 1)]}


def place_image(bust, w, h, d, x0, y0, ix, iy, iw, ih, nose=(0.0, 0.0), rot=0.0):
    """the bust picture (load_bust) drawn into a (w, h) supersampled canvas whose corner is (x0, y0) wheel units, its top
    left at (ix, iy) with size (iw, ih) units, then turned `rot` degrees clockwise about `nose` (wheel units); float RGBA.
    Sampled straight from the keyed source through its rectangle (one resampling, premultiplied)."""
    k = d * SS
    rx0, ry0, rx1, ry1 = bust["rect"]
    su = (rx1 - rx0) / iw  # source px per wheel unit, across and down the picture
    sv = (ry1 - ry0) / ih
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    nx, ny = nose
    # canvas px (X, Y) -> wheel units (x0 + X / k, y0 + Y / k) -> about the nose, turned back by rot -> the picture's own
    # units (lx - ix, ly - iy) -> source px
    # local = R(-rot) (p - nose) + nose;  R(-rot) = [[c, s], [-s, c]]
    A = c / k * su
    B = s / k * su
    C = (c * (x0 - nx) + s * (y0 - ny) + nx - ix) * su + rx0
    D = -s / k * sv
    E = c / k * sv
    F = (-s * (x0 - nx) + c * (y0 - ny) + ny - iy) * sv + ry0
    out = bust["src"].convert("RGBa").transform((w, h), Image.AFFINE, (A, B, C, D, E, F), resample=Image.BICUBIC).convert("RGBA")
    return np.asarray(out, np.float64) / 255.0


def over(img, top):
    a1 = top[..., 3]
    a0 = img[..., 3]
    a = a1 + a0 * (1 - a1)
    for i in range(3):
        img[..., i] = np.where(a > 1e-9, (top[..., i] * a1 + img[..., i] * a0 * (1 - a1)) / np.maximum(a, 1e-9), 0)
    img[..., 3] = a


def make_wedge(tier, d, bust):
    half = STEP / 2
    x0, x1 = -R_WEDGE * math.sin(math.radians(half)) - 3, R_WEDGE * math.sin(math.radians(half)) + 3
    y0, y1 = -R_WEDGE - 3, -R_HUB * math.cos(math.radians(half)) + 3
    X, Y, r, a, w, h = canvas(x0, y0, x1, y1, d)
    dist = wedge_dist(X, Y, r, a, half, R_HUB, R_WEDGE)
    inside = dist <= 0
    img = blank(w, h)
    paint(img, inside, COLORS[tier])
    # the darker edges (3 degrees a side)
    paint(img, inside & (np.abs(a) > half - 3), (0, 0, 0), 0.22)
    # the bust, cut to the wedge
    B = BUST[tier]
    s = B["units"] / (0.6 * B["h"])
    bw, bh = B["w"] * s, B["h"] * s
    # its nose at (x, -rf), the picture turned about the nose (the page: translate, rotate, then draw)
    top = place_image(bust, w, h, d, x0, y0, B["x"] - B["fx"] * bw, -B["rf"] - B["fy"] * bh, bw, bh, nose=(B["x"], -B["rf"]), rot=B["rot"])
    top[..., 3] *= inside
    over(img, top)
    # half of the dark divider on each side (two neighbours make the mock's 8 unit line)
    side = r * np.sin(np.radians(half - np.abs(a)))
    paint(img, inside & (side <= 4.0), INK)
    return down(img), (-x0 * d, -y0 * d)


def make_hi(d):
    half = STEP / 2
    pad = 9
    x0, x1 = -R_WEDGE * math.sin(math.radians(half)) - pad, R_WEDGE * math.sin(math.radians(half)) + pad
    y0, y1 = -R_WEDGE - pad, -R_HUB * math.cos(math.radians(half)) + pad
    X, Y, r, a, w, h = canvas(x0, y0, x1, y1, d)
    dist = wedge_dist(X, Y, r, a, half, R_HUB, R_WEDGE)
    img = blank(w, h)
    paint(img, dist <= 0, (255, 240, 160), 0.22)
    paint(img, np.abs(dist) <= 6.5, (0xFF, 0xF3, 0xA8))
    return down(img), (-x0 * d, -y0 * d)


def make_rim(d):
    half = STEP / 2 + 0.4  # a little past its 45 degrees: the neighbours overlap, so no seam shows
    r0 = TRIM["wire"][0]
    x0, x1 = -RIM * math.sin(math.radians(half)) - 2, RIM * math.sin(math.radians(half)) + 2
    y0, y1 = -RIM - 2, -r0 * math.cos(math.radians(half)) + 2
    X, Y, r, a, w, h = canvas(x0, y0, x1, y1, d)
    ang = np.abs(a) <= half
    img = blank(w, h)

    def band(key):
        lo, hi = TRIM[key]
        return ang & (r >= lo) & (r < hi)

    paint(img, band("wire"), (0x1C, 0x2A, 0x1E))
    paint(img, band("gold"), (0xF2, 0xC2, 0x1B))
    paint(img, band("goldLight"), (0xFF, 0xE8, 0x8A))
    paint(img, band("goldDark"), (0xC9, 0x96, 0x10))
    paint(img, band("inkIn"), INK)
    lo, hi = TRIM["candy"]
    t = (r - lo) / (hi - lo)
    period = 360.0 / STRIPES * 2
    phase = np.mod(a + 360.0 + TWIST * t, period) / period
    candy = band("candy")
    paint(img, candy, (0xFF, 0xFF, 0xFF))
    paint(img, candy & (phase < 0.5), (0xE3, 0x26, 0x2D))
    # the cane's roundness, flat steps: a darker inner and outer edge, a light line along its upper third
    paint(img, candy & ((t < 0.16) | (t > 0.86)), (0x4A, 0x10, 0x1C), 0.2)
    paint(img, candy & (t > 0.58) & (t < 0.70), (0xFF, 0xFF, 0xFF), 0.4)
    paint(img, ang & (r >= TRIM["inkOut"][0]) & (r <= RIM), INK)
    return down(img), (-x0 * d, -y0 * d)


def make_disc(d, radius):
    # (2026-11-21, wheel_probe concentric: the disc centred on its picture. Its canvas was radius + 1 units each side, so a
    # density whose (2 radius + 2) d is not a whole number of px (the phone tier's 0.3125: 80.625) rounded the picture up
    # on the right and bottom only, its origin 40.31 px in an 81 px frame. Stretched 3.3 times as the wheel's dark back
    # (superWheel.ts discOf), the sprite's quad cut its soft edge 0.19 px nearer on the left and top than on the right and
    # bottom: 1.06 CSS px off the rim's centre at 844 x 390. The frame's own px count, its origin at its exact middle.)
    w_px = math.ceil((2 * radius + 2) * d - 1e-9)
    half = w_px / 2 / d
    X, Y, r, a, w, h = canvas(-half, -half, -half + (w_px - 1e-6) / d, -half + (w_px - 1e-6) / d, d)
    img = blank(w, h)
    paint(img, r <= radius, (255, 255, 255))
    return down(img), (w_px / 2, w_px / 2)


def make_stud(d):
    e = math.ceil(STUD_OUT + 1.5)  # the canvas's half size, units (19 at round 5's 17.5; 21 at 1.09)
    X, Y, r, a, w, h = canvas(-e, -e, e, e, d)
    img = blank(w, h)
    paint(img, r <= STUD_INK0 * STUD_SIZE, INK)
    paint(img, r <= STUD_GOLD0 * STUD_SIZE, (0xF2, 0xC2, 0x1B))
    hl = STUD_HL0 * STUD_SIZE
    paint(img, np.hypot(X + hl, Y + hl) <= hl, (255, 255, 255), 0.85)
    return down(img), (e * d, e * d)


def make_bulb(d, colour, on):
    # its own origin is on the wire; the socket points out (up), the glass hangs in toward the hub
    X, Y, r, a, w, h = canvas(-15, -19, 15, 31, d)
    img = blank(w, h)
    paint(img, (np.abs(X) <= 8.4) & (Y >= -17.0) & (Y <= -3.0), INK)
    paint(img, (np.abs(X) <= 5.6) & (Y >= -14.2) & (Y <= -4.4), (0x2F, 0x33, 0x40))
    e = (X / 12.0) ** 2 + ((Y - 10.0) / 17.5) ** 2
    paint(img, e <= 1.0, INK)
    e2 = (X / 9.0) ** 2 + ((Y - 10.0) / 14.5) ** 2
    paint(img, e2 <= 1.0, colour[0] if on else colour[1])
    hl = ((X + 3.2) / 2.5) ** 2 + ((Y - 4.6) / 5.0) ** 2
    paint(img, hl <= 1.0, (255, 255, 255), 0.75 if on else 0.15)
    return down(img), (15 * d, 19 * d)


def make_ring(d):
    R0, R1 = RING
    out = R1 + 6
    X, Y, r, a, w, h = canvas(-out, -out, out, out, d)
    img = blank(w, h)
    band = (r >= R0) & (r <= R1)
    seg = np.floor(np.mod(a + 36.0 + 360.0, 360.0) / 72.0).astype(int) % 5
    paint(img, band, (0x1B, 0x1F, 0x2E))
    paint(img, band & (seg % 2 == 1), (0x26, 0x2B, 0x3D))
    # the dark lines between the five places and along the inner edge
    off = np.mod(a + 36.0 + 360.0, 72.0)
    side = r * np.sin(np.radians(np.minimum(off, 72.0 - off)))
    paint(img, band & (side <= 2.5), INK)
    paint(img, (r >= R0 - 2.5) & (r <= R0 + 2.5), INK)
    paint(img, (r >= R1 - 3.5) & (r <= R1 + 5.5), INK)
    paint(img, (r >= R1 - 3.5) & (r <= R1 + 3.5), GOLD)
    return down(img), (out * d, out * d)


def make_ring_hi(d):
    R0, R1 = RING
    pad = 7
    x0, x1 = -R1 * math.sin(math.radians(36)) - pad, R1 * math.sin(math.radians(36)) + pad
    y0, y1 = -R1 - pad, -R0 * math.cos(math.radians(36)) + pad
    X, Y, r, a, w, h = canvas(x0, y0, x1, y1, d)
    dist = wedge_dist(X, Y, r, a, 36.0, R0, R1)
    img = blank(w, h)
    paint(img, dist <= 0, (255, 240, 160), 0.25)
    paint(img, np.abs(dist) <= 4.5, (0xFF, 0xF3, 0xA8))
    return down(img), (-x0 * d, -y0 * d)


def make_ring_ptr(d):
    R1 = RING[1]
    pts = [(0, -R1 + 8), (-13, -R1 - 16), (13, -R1 - 16)]
    x0, y0, x1, y1 = -20, -R1 - 22, 20, -R1 + 15
    k = d * SS
    w, h = int(math.ceil((x1 - x0) * d)) * SS, int(math.ceil((y1 - y0) * d)) * SS
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    px = [((x - x0) * k, (y - y0) * k) for x, y in pts]
    dr.polygon(px, fill=GOLD + (255,))
    dr.line(px + [px[0], px[1]], fill=INK + (255,), width=int(round(5 * k)), joint="curve")
    return down(np.asarray(im, np.float64) / 255.0), (-x0 * d, -y0 * d)


def make_text(d, text, size, fill, stroke, stroke_fill=INK):
    """a line of Overpass Black, its origin at the middle of its baseline (the mock's text-anchor middle)"""
    k = d * SS
    font = ImageFont.truetype(FONT, int(round(size * k)))
    sw = int(round(stroke * k))
    l, t, r, b = font.getbbox(text, anchor="ms", stroke_width=sw)
    pad = 2 * SS
    w = int(math.ceil((r - l + 2 * pad) / SS)) * SS
    h = int(math.ceil((b - t + 2 * pad) / SS)) * SS
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ox, oy = -l + pad, -t + pad
    ImageDraw.Draw(im).text((ox, oy), text, font=font, anchor="ms", fill=fill + (255,), stroke_width=sw, stroke_fill=stroke_fill + (255,))
    return down(np.asarray(im, np.float64) / 255.0), (ox / SS, oy / SS)


def make_tag(d):
    """the hub's SPIN tag: a white plate with a dark outline and the word"""
    x0, y0, x1, y1 = -76, -31, 76, 31
    k = d * SS
    w, h = int(math.ceil((x1 - x0) * d)) * SS, int(math.ceil((y1 - y0) * d)) * SS
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    dr.rounded_rectangle([(-73.5 - x0) * k, (-28.5 - y0) * k, (73.5 - x0) * k, (28.5 - y0) * k], radius=17.5 * k, fill=INK + (255,))
    dr.rounded_rectangle([(-66.5 - x0) * k, (-21.5 - y0) * k, (66.5 - x0) * k, (21.5 - y0) * k], radius=10.5 * k, fill=(255, 255, 255, 255))
    font = ImageFont.truetype(FONT, int(round(38 * k)))
    dr.text(((0 - x0) * k, (14 - y0) * k), "SPIN", font=font, anchor="ms", fill=INK + (255,))
    return down(np.asarray(im, np.float64) / 255.0), (-x0 * d, -y0 * d)


def make_medal(d, tier, bust):
    X, Y, r, a, w, h = canvas(-76, -76, 76, 76, d)
    img = blank(w, h)
    paint(img, r <= 73.5, INK)
    paint(img, r <= 66.5, GOLD)
    paint(img, r <= 60.0, (0xFF, 0xF8, 0xEA))
    # the face: a square of the bust about its nose, a little above it
    B = BUST[tier]
    side = 0.215 * B["h"]
    cx, cy = B["fx"] * B["w"] - 0.02 * B["w"], B["fy"] * B["h"] - 0.035 * B["h"]
    s = 120.0 / side
    top = place_image(bust, w, h, d, -76, -76, -cx * s, -cy * s, B["w"] * s, B["h"] * s)
    top[..., 3] *= r <= 60.0
    over(img, top)
    return down(img), (76 * d, 76 * d)


def fit_circle(pts):
    """least squares circle through points: centre and radius"""
    A = np.c_[2 * pts[:, 0], 2 * pts[:, 1], np.ones(len(pts))]
    b = (pts**2).sum(axis=1)
    cx, cy, c = np.linalg.lstsq(A, b, rcond=None)[0]
    return cx, cy, math.sqrt(c + cx * cx + cy * cy)


def make_hub(d):
    """the mock's hub layer, placed so that ITS GOLD DISC'S OWN CENTRE (fitted to the disc's outline below the bow) is the
    wheel's centre, at the mock's size"""
    src = Image.open(os.path.join(SRC, "hub.webp")).convert("RGBA")
    al = np.asarray(src.getchannel("A")) > 128
    ys = np.where(al.any(axis=1))[0]
    y_lo = int(ys[0] + 0.62 * (ys[-1] - ys[0]))
    pts = []
    for y in range(y_lo, ys[-1] + 1, 2):
        xs = np.where(al[y])[0]
        if len(xs) > 40:
            pts += [(xs[0], y), (xs[-1], y)]
    cx, cy, rad = fit_circle(np.array(pts, np.float64))
    upp = HUB_SRC["w"] / src.width * HUB_K  # wheel units per source px, as drawn
    mock_c = (-HUB_SRC["x"] / HUB_SRC["w"] * src.width, -HUB_SRC["y"] / HUB_SRC["w"] * src.height)
    info = {"discRadius": round(rad * upp, 2), "fitCentrePx": [round(cx, 1), round(cy, 1)], "mockCentrePx": [round(mock_c[0], 1), round(mock_c[1], 1)], "movedUnits": [round((cx - mock_c[0]) * upp, 2), round((cy - mock_c[1]) * upp, 2)]}
    box = src.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    cut = src.crop(box)
    k = upp * d
    tw, th = int(round(cut.width * k)), int(round(cut.height * k))
    out = cut.convert("RGBa").resize((tw, th), Image.LANCZOS).convert("RGBA")
    return out, ((cx - box[0]) * k, (cy - box[1]) * k), info


def flap_edges(al):
    """the flapper art's left and right ink edge per row (art px, -1 where the row is empty), smoothed over FLAP_SMOOTH rows"""
    n = al.shape[0]
    left = np.full(n, -1.0)
    right = np.full(n, -1.0)
    for y in range(n):
        xs = np.where(al[y])[0]
        if len(xs):
            left[y], right[y] = xs[0], xs[-1] + 1.0
    k = np.ones(FLAP_SMOOTH) / FLAP_SMOOTH
    ok = left >= 0
    ls, rs = left.copy(), right.copy()
    ls[ok] = np.convolve(np.pad(left[ok], FLAP_SMOOTH // 2, mode="edge"), k, mode="valid")[: ok.sum()]
    rs[ok] = np.convolve(np.pad(right[ok], FLAP_SMOOTH // 2, mode="edge"), k, mode="valid")[: ok.sum()]
    return ls, rs


def stripe_pitch(px):
    """the candy stripe's repeat down the flapper (art px): the rows where a white stripe starts, along columns about the
    middle of the body, their spacing averaged"""
    rgb = px[..., :3]
    al = px[..., 3] > 128
    steps = []
    for xc in range(FLAP_PITCH_COLS[0], FLAP_PITCH_COLS[1], 8):
        white = (rgb[:, xc].min(axis=1) > 200) & al[:, xc]
        starts = [y for y in range(FLAP_BODY[0], FLAP_BODY[1]) if white[y] and not white[y - 1]]
        steps += list(np.diff(starts))
    steps = [s for s in steps if s > 100]
    return float(np.median(steps)), len(steps)


def stripe_slant(px, left, right):
    """THE STRIPES' SLANT across the flapper: for each stripe edge crossing the middle column (art rows), how far above
    (+) or below it the same edge lies at each place across the body (u, -0.5 left edge to 0.5 right edge, in the row's
    own width), followed out from the middle. Returns the edges' middle rows, the u grid and the offsets (art px)."""
    al = px[..., 3] > 128
    red = (px[..., 0] > 150) & (px[..., 1] < 90) & al
    c, w = (left + right) / 2, right - left

    def at(u, y):
        return red[y, int(round(c[y] + u * w[y]))]

    edges = [(y, at(0, y - 1)) for y in range(FLAP_BODY[0], FLAP_BODY[1] + 1) if at(0, y) != at(0, y - 1)]
    us = np.round(np.arange(-FLAP_SLANT_U, FLAP_SLANT_U + 1e-9, 0.02), 2)
    table = np.zeros((len(edges), len(us)))
    for i, (yb, from_red) in enumerate(edges):
        off = {0.0: 0.0}
        for side in (1, -1):
            prev = 0.0
            for u in sorted((v for v in us if side * v > 0), key=abs):
                best = None
                for dy in range(-25, 26):
                    y = int(round(yb + prev + dy))
                    a0, a1 = at(u, y - 1), at(u, y)
                    if a0 != a1 and a0 == from_red and (best is None or abs(dy) < abs(best)):
                        best = dy
                if best is None:
                    break
                prev += best
                off[u] = prev
        ks = np.array(sorted(off))
        table[i] = np.interp(us, ks, [off[k] for k in ks])  # (past the last edge found: held)
    return np.array([e[0] for e in edges], np.float64), us, table


def make_long_flap():
    """THE FLAPPER AT FLAP_LENGTH, REDRAWN (Corey 2026-11-20: his round 2 length 1.22; the layout page stretched the art to
    get it, and a stretch draws its stripes 22% longer). The mock's flapper art (super_wheel_src/peg_flap.webp) gets ONE
    MORE TURN OF ITS STRIPE, drawn in the stripes' own frame:
      - each art pixel's STRIPE PHASE is its row less the stripe's slant at its place across the body (stripe_slant:
        measured from the art's own stripe edges, larger where the body is wider), so in that frame every stripe edge is
        level and one pitch of phase is one turn of the stripe;
      - the new flapper's rows are the art's rows with one pitch of phase doubled at FLAP_SEAM (the middle of a white
        stripe at every place across the body; the red stripes' highlights are never cut), its taper drawn out smoothly
        over FLAP_ZONE so the outline stays one clean curve, each row's slant that of the art's row of the same width;
      - one pitch is a little longer than the 22% asked, so the stripes over FLAP_ZONE are drawn about 3.6% closer
        together (their slant and width as drawn); the cap at the bolt and the rounded tip are the art's own rows.
    Returns the art (same canvas width, taller) and what it did."""
    from scipy.ndimage import map_coordinates

    src = Image.open(os.path.join(SRC, "peg_flap.webp")).convert("RGBA")
    px8 = np.asarray(src)
    px = px8.astype(np.float64) / 255.0
    H, W = px.shape[:2]
    al = px[..., 3] > 0.5
    upp = PEG_SRC["w"] / W
    bolt_y = -PEG_SRC["y"] / upp
    tip_row = np.where(al.any(axis=1))[0][-1] + 1.0
    L0 = tip_row - bolt_y
    dL = L0 * (FLAP_LENGTH - 1.0)  # what the flapper grows by, art px
    P, nP = stripe_pitch(px8)
    a, b = FLAP_ZONE
    j = FLAP_SEAM
    left, right = flap_edges(al)
    ey, us, table = stripe_slant(px8.astype(int), left, right)
    rows = np.arange(H, dtype=np.float64)
    okr = left >= 0
    Ho = int(math.ceil(H + dL)) + 2
    Y = np.arange(Ho, dtype=np.float64) + 0.5  # output row centres
    span = (b + dL) - a  # the zone's length in the new art

    def smooth(t):
        t = np.clip(t, 0.0, 1.0)
        return t * t * (3 - 2 * t)

    uz = (Y - a) / span
    g = Y + (P - dL) * smooth(uz)  # the row of the long texture (its phase before the slant)
    p = Y - dL * smooth(uz)  # the art's row whose silhouette (and slant) this row takes (the taper drawn out)
    li = lambda arr, q: np.interp(q - 0.5, rows[okr], arr[okr])  # noqa: E731
    lt, rt = li(left, p), li(right, p)
    ct, wt = (lt + rt) / 2, rt - lt
    X = np.arange(W, dtype=np.float64) + 0.5
    XX, YY = np.meshgrid(X, Y)
    U = (XX - ct[:, None]) / wt[:, None]
    Uc = np.clip(U, us[0], us[-1])

    def slant(u, y):
        """the stripes' slant (art px) at place u across the body, art row y (between the measured edges: linear)"""
        iu = np.interp(u, us, np.arange(len(us)))
        i0 = np.clip(np.floor(iu).astype(int), 0, len(us) - 2)
        fu = iu - i0
        per_edge = table[:, i0] * (1 - fu) + table[:, i0 + 1] * fu  # (edges, ...)
        iy = np.interp(y, ey, np.arange(len(ey)))
        k0 = np.clip(np.floor(iy).astype(int), 0, len(ey) - 2)
        fy = iy - k0
        pe = np.take_along_axis(per_edge, k0[None], axis=0)[0]
        pe1 = np.take_along_axis(per_edge, (k0 + 1)[None], axis=0)[0]
        return pe * (1 - fy) + pe1 * fy

    phase = g[:, None] - slant(Uc, np.broadcast_to(p[:, None], Uc.shape))
    phase = np.where(phase >= j, phase - P, phase)  # the doubled pitch
    ys = phase + slant(Uc, phase)
    for _ in range(FLAP_SOLVE):
        ys = phase + slant(Uc, ys)
    xs = li(left, ys) + (U + 0.5) * (li(right, ys) - li(left, ys))
    inside = ((Y >= a) & (Y <= b + dL))[:, None]
    xs = np.where(inside, xs, XX)
    yy = np.where(inside, ys, np.where(YY > b, YY - dL, YY))
    pm = np.concatenate([px[..., :3] * px[..., 3:4], px[..., 3:4]], axis=2)
    out = np.zeros((Ho, W, 4))
    for ch in range(4):
        out[..., ch] = map_coordinates(pm[..., ch], [yy - 0.5, xs - 0.5], order=1, mode="constant", cval=0.0)
    a_ = out[..., 3:4]
    rgb = np.where(a_ > 1e-6, out[..., :3] / np.maximum(a_, 1e-6), 0)
    img = Image.fromarray(np.clip(np.round(np.concatenate([rgb, a_], axis=2) * 255), 0, 255).astype(np.uint8), "RGBA")
    new_tip = np.where(np.asarray(img.getchannel("A")) > 128)[0].max() + 1.0
    info = {"pitchPx": round(P, 1), "pitchSamples": nP, "seamPx": j, "zonePx": [a, b], "stripeEdges": [int(v) for v in ey], "lengthArtPx": [round(float(L0), 1), round(float(new_tip - bolt_y), 1)], "length": round(float((new_tip - bolt_y) / L0), 4), "zoneTexture": round((b - a + P) / span, 4)}
    return img, info


def make_peg(d, name, src=None):
    """a peg layer at the mock's place about its bolt (the flapper turns about it)"""
    if src is None:
        src = Image.open(os.path.join(SRC, name)).convert("RGBA")
    upp = PEG_SRC["w"] / src.width
    box = src.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    cut = src.crop(box)
    k = upp * d
    out = cut.convert("RGBa").resize((int(round(cut.width * k)), int(round(cut.height * k))), Image.LANCZOS).convert("RGBA")
    bolt = (-PEG_SRC["x"] / upp, -PEG_SRC["y"] / upp)
    # where the flapper's tip is, across (it should hang on the wheel's own upright line)
    al = np.asarray(cut.getchannel("A")) > 128
    tip_row = np.where(al.any(axis=1))[0][-1]
    tip_x = np.where(al[max(0, tip_row - 6)])[0].mean() + box[0]
    info = {"tipOffsetUnits": round((tip_x - bolt[0]) * upp, 2), "tipBelowBoltUnits": round((tip_row + box[1] - bolt[1]) * upp, 2)}
    # THE FLAPPER'S OWN WIDTH (2026-11-20, the deeper pin: it rests against a stud's side, so the contact is its drawn outline,
    # ink included, not a line): its half width at PEG_PROFILE_N even steps from the bolt (0) to the tip (1), wheel units
    # at the peg's own size (game/road/wheelPeg.ts scales it with the peg)
    if name.startswith("peg_flap"):
        L_px = tip_row + box[1] - bolt[1]
        prof = []
        for i in range(PEG_PROFILE_N):
            y = int(round(bolt[1] + L_px * i / (PEG_PROFILE_N - 1))) - box[1]
            y = min(max(y, 0), al.shape[0] - 1)
            xs = np.where(al[y])[0]
            prof.append(round((xs[-1] + 1 - xs[0]) / 2 * upp, 2) if len(xs) else 0.0)
        prof[-1] = 0.0  # (the tip's last row is a point: the rounded end is the samples before it)
        info["profile"] = prof
    return out, ((bolt[0] - box[0]) * k, (bolt[1] - box[1]) * k), info


def load_wild_letters():
    """the Wild multiplier atlas (tools/build_wild_mult.py, its desktop sheet): each wheel letter's untrimmed frame as an
    alpha array, the set's density (sheet px per design unit) and its letter height (design units)"""
    src = open(WILD_SPEC).read()
    spec = json.loads(src[src.index("{") : src.rindex("}") + 1])
    sheet = spec["sheets"]["full"]
    pages = [np.asarray(Image.open(os.path.join(ASSETS, p["file"])).convert("RGBA").getchannel("A"), np.float64) for p in sheet["pages"]]
    letters = {}
    for tier, color in OUTLINE_COLORS.items():
        dens = spec["sets"][color]["full"]
        for ch in sorted({c for m in WHEEL_VALUES[tier] for c in f"{m}x"}):
            page, x, y, w, h, ox, oy, fw, fh = sheet["frames"][f"{color}_{ch}"]
            a = np.zeros((fh, fw))
            a[oy : oy + h, ox : ox + w] = pages[page][y : y + h, x : x + w]
            letters[(color, ch)] = (a, dens)
    return letters, spec["cap"]


def make_outline_letter(d, alpha, dens, art_cap, t):
    """ONE LETTER'S EVEN OUTLINE: its solid shape (alpha over OUTLINE_SOLID) grown by t wheel units, black, at the letters'
    wheel size (WHEEL_CAP tall); its origin the letter frame's centre (where the game anchors the letter)"""
    from scipy.ndimage import distance_transform_edt, map_coordinates

    upd = WHEEL_CAP / art_cap  # wheel units per design unit
    fh, fw = alpha.shape
    hw, hh = fw / dens * upd / 2 + t + 2, fh / dens * upd / 2 + t + 2  # half the canvas, units
    hw, hh = math.ceil(hw * d) / d, math.ceil(hh * d) / d
    X, Y, r, a, w, h = canvas(-hw, -hh, hw, hh, d)
    # the letter's frame px under each supersampled pixel (its centre at the frame's centre)
    fx = X / upd * dens + fw / 2 - 0.5
    fy = Y / upd * dens + fh / 2 - 0.5
    solid = map_coordinates(alpha, [fy, fx], order=1, mode="constant", cval=0.0) > OUTLINE_SOLID
    k = d * SS
    dist = distance_transform_edt(~solid) / k
    img = blank(w, h)
    paint(img, dist <= t, (0, 0, 0))
    return down(img), (hw * d, hh * d)


def pack(items, pad=2):
    """shelf packing, tallest first; returns the sheet and each frame's place"""
    order = sorted(items, key=lambda it: -it[1].height)
    width = 2048
    while True:
        x = y = pad
        shelf = 0
        places = {}
        ok = True
        for name, im, _ in order:
            if im.width + 2 * pad > width:
                ok = False
                break
            if x + im.width + pad > width:
                x = pad
                y += shelf + pad
                shelf = 0
            places[name] = (x, y)
            x += im.width + pad
            shelf = max(shelf, im.height)
        if ok:
            break
        width *= 2
    height = y + shelf + pad
    used = max(places[n][0] + im.width for n, im, _ in order) + pad
    sheet = Image.new("RGBA", (used, height), (0, 0, 0, 0))
    frames = {}
    for name, im, origin in order:
        px, py = places[name]
        sheet.paste(im, (px, py))
        frames[name] = {"x": px, "y": py, "w": im.width, "h": im.height, "ox": round(origin[0], 2), "oy": round(origin[1], 2)}
    return sheet, frames


def build_tier(tier, busts, flap, letters):
    d = DENSITY[tier]
    items = []
    info = {}
    for t in ("reindeer", "santa"):
        im, o = make_wedge(t, d, busts[t])
        items.append((f"wedge_{t}", im, o))
        im, o = make_medal(d, t, busts[t])
        items.append((f"medal_{t}", im, o))
    for name, fn in (("hi", make_hi), ("rim", make_rim), ("stud", make_stud), ("ring", make_ring), ("ring_hi", make_ring_hi), ("ring_ptr", make_ring_ptr), ("tag", make_tag)):
        im, o = fn(d)
        items.append((name, im, o))
    im, o = make_disc(d * 0.25, 128)  # a small disc, stretched by the game (its edge is under the rim, or is a soft shadow's)
    items.append(("base", im, o))
    for c, colour in BULB_COLORS.items():
        for on in (True, False):
            im, o = make_bulb(d, colour, on)
            items.append((f"bulb_{c}_{'on' if on else 'off'}", im, o))
    # (the wedges' numbers are the Wild multipliers' own atlas now: no num_ sprites here)
    for n in range(1, 6):
        im, o = make_text(d, str(n), COL_SIZE, GOLD, 5.0)
        items.append((f"col_{n}", im, o))
    im, o, info["hub"] = make_hub(d)
    items.append(("hub", im, o))
    for key, name in (("peg_bracket", "peg_bracket.webp"), ("peg_flap", "peg_flap.webp")):
        im, o, info[key] = make_peg(d, name, flap if key == "peg_flap" else None)
        items.append((key, im, o))
    # the numbers' even outline, one black silhouette per wheel letter and screen class: mo_<phone|wide>_<color>_<letter>
    art, art_cap = letters
    for cls, t in OUTLINE_UNITS.items():
        for (color, ch), (alpha, dens) in sorted(art.items()):
            im, o = make_outline_letter(d, alpha, dens, art_cap, t)
            items.append((f"mo_{cls}_{color}_{ch}", im, o))
    sheet, frames = pack(items)
    name = "super-wheel.webp" if tier == "full" else f"super-wheel-{tier}.webp"
    os.makedirs(OUT, exist_ok=True)
    sheet.save(os.path.join(OUT, name), "WEBP", lossless=True, method=6, exact=True)
    size = os.path.getsize(os.path.join(OUT, name))
    return {"file": f"wheel/{name}", "density": d, "width": sheet.width, "height": sheet.height, "frames": frames}, info, size


def run_contact():
    """THE REINDEER ON THE RIM, measured from the shipped side run (view R, the full tier's sheets): each pose's bottom
    outline (the lowest ink of every pixel column, about its feet point), and how far the body is lowered toward the
    wheel's centre so that the outline's point nearest the rim is `tuck` inside the rim's edge. Wheel units."""
    src = open(os.path.join(APP, "src", "game", "reindeerRunSpec.ts")).read()
    run = json.loads(src[src.index("{") : src.rindex("}") + 1])
    T = run["tiers"]["full"]
    dens = T["density"]["R"]
    box = T["boxes"]["R"]
    V = run["views"]["R"]
    sheets = [Image.open(os.path.join(ASSETS, s["file"])).convert("RGBA") for s in T["sheets"]]
    upf = RUN["boxShare"] * 2 * RIM / V["frameW"]  # wheel units per frame px
    phi = math.radians(RUN["shoulderDeg"])
    Tn = (math.cos(phi), math.sin(phi))  # forward along the rim
    N = (math.sin(phi), -math.cos(phi))  # out from the centre
    s_bar = -RUN["contactBackFramePx"] * upf
    bx, by = math.sin(phi) * RIM - s_bar * Tn[0], -math.cos(phi) * RIM - s_bar * Tn[1]
    poses = []
    for stride in range(1, 17):
        f = T["frames"]["R"][str(stride)]
        al = np.zeros((box["h"], box["w"]), bool)
        crop = np.asarray(sheets[f["sheet"]].crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"])).getchannel("A")) > 128
        al[f["oy"] : f["oy"] + f["h"], f["ox"] : f["ox"] + f["w"]] = crop
        pts = []
        for x in range(box["w"]):
            col = np.where(al[:, x])[0]
            if len(col):
                # the pixel's lower corners, frame px about the feet point (s forward, h up)
                for dx in (0.0, 1.0):
                    pts.append((((x + dx) / dens - V["anchorX"]) * upf, (V["anchorY"] - (col[-1] + 1) / dens) * upf))
        P = np.array(pts)

        def nearest(dd):
            px = bx + P[:, 0] * Tn[0] + (P[:, 1] - dd) * N[0]
            py = by + P[:, 0] * Tn[1] + (P[:, 1] - dd) * N[1]
            rr = np.hypot(px, py)
            i = int(rr.argmin())
            return rr[i], i

        lo, hi = -80.0, 120.0
        target = RIM - RUN["tuck"]
        for _ in range(40):
            mid = (lo + hi) / 2
            if nearest(mid)[0] > target:
                lo = mid
            else:
                hi = mid
        dd = (lo + hi) / 2
        rr, i = nearest(dd)
        poses.append({"stride": stride, "lower": round(dd, 3), "hoof": [round(P[i, 0] / upf, 1), round(P[i, 1] / upf, 1)], "gap": round(rr - RIM, 3)})
    return {"boxShare": RUN["boxShare"], "shoulderDeg": RUN["shoulderDeg"], "contactBackFramePx": round(RUN["contactBackFramePx"], 2), "sweepFramePx": RUN["sweepFramePx"], "tuck": RUN["tuck"], "frameW": V["frameW"], "frameH": V["frameH"], "anchorX": V["anchorX"], "anchorY": V["anchorY"], "poses": poses}


def main():
    busts = {t: load_bust(t) for t in ("reindeer", "santa")}
    flap, flap_info = make_long_flap()
    print("  flapper redrawn:", flap_info)
    letters = load_wild_letters()
    tiers = {}
    notes = {}
    for tier in DENSITY:
        tiers[tier], info, size = build_tier(tier, busts, flap, letters)
        notes[tier] = info
        print(f"{tier}: {tiers[tier]['width']} x {tiers[tier]['height']} px, {size / 1024:.0f} KB, {tiers[tier]['width'] * tiers[tier]['height'] * 4 / 1048576:.1f} MB on the GPU")
        print("  hub", info["hub"], "peg", info["peg_bracket"], info["peg_flap"])
    run = run_contact()
    for p in run["poses"]:
        print(f"  pose {p['stride']:2d}: lowered {p['lower']:6.2f} units, its hoof at {p['hoof']} frame px, {p['gap']:+.2f} units from the rim's edge")
    spec = {
        "units": {"rim": RIM, "rimShare": RIM_SHARE, "wedge": round(R_WEDGE, 3), "wedgeK": round(WEDGE_K, 4), "hub": R_HUB, "stud": round(STUD_R, 3), "studOut": STUD_OUT, "ring": list(RING), "hubK": HUB_K, "slices": SLICES, "multR": round(MULT_R, 2), "baseRadius": 128, "peg": {"boltY": round(-TIP_R - PEG_TIP, 3), "tip": PEG_TIP, "tipR": round(TIP_R, 3), "bite": TIP_BITE}, "trim": {k: [round(v[0], 3), round(v[1], 3)] for k, v in TRIM.items()}},
        "mults": MULTS,
        "hubFit": notes["full"]["hub"],
        "pegFit": {"bracket": notes["full"]["peg_bracket"], "flap": notes["full"]["peg_flap"]},
        "flap": {"length": FLAP_LENGTH, **flap_info},
        "studs": {"size": STUD_SIZE, "shift": STUD_SHIFT},
        "busts": {t: {"rf": round(b["rf"], 3), "units": round(b["units"], 3), "x": b["x"], "rot": b["rot"], "size": BUST_SIZE[t], "srcPx": busts[t]["srcPx"], "check": busts[t]["check"]} for t, b in BUST.items()},
        "numbers": {"cap": WHEEL_CAP, "outline": OUTLINE_UNITS, "solidAlpha": OUTLINE_SOLID, "colors": OUTLINE_COLORS, "values": WHEEL_VALUES, "multShift": MULT_SHIFT_R},
        "run": run,
        "tiers": tiers,
    }
    head = "// AUTO-GENERATED by tools/build_super_wheel.py (the Super wheel's sheet, and the reindeer's place on the rim per run pose,\n// measured from the shipped side run). Do not edit: change the tool and run it again. Wheel units: the rim's outer edge is\n// radius 460 about the wheel's centre; a frame's ox, oy is its own origin inside it, sheet px.\n"
    with open(SPEC, "w") as fh:
        fh.write(head + "export const SUPER_WHEEL_ART = " + json.dumps(spec, indent="\t") + " as const;\n")
    print("wrote", os.path.relpath(SPEC, APP))


if __name__ == "__main__":
    main()
