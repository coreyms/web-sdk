#!/usr/bin/env python
"""THE INTRO CARDS' SLATE LETTERING (intro cards round 3, header H1; Corey 2026-11-18: "This looks great, but the
vertical alignment should be fixed and this will be good to put in the game").

The approved mock (Desktop/Manticore Mayhem/feedback/intro_cards_mock_2026-11-17/round3, intro_cards_r3_open_me.html,
version "R3 header H1", "8 Free Spins" in its own color, third header MANTICORE) set every word on the cards' dark
slate as image lettering: crops of art the game ships, placed in card-width units. This tool sets the SAME pieces
with the mock's own numbers (its template.html: lettering(), measure(), fitCap(), R3_PICS, A_PICS.features, HEAD.h1)
and bakes them, so the game draws plain pictures and only positions them.

  header   CLUSTERS / SCATTERS / MANTICORE in GOLD: the win plaque's ivory lettering (ui/stinger/stinger-glyphs.webp,
           frames stg_g_XXXX) with each glyph crop multiplied by one gold color (255, 198, 104), as the mock's
           round3/tools/extract.py did (what a sprite tint does; the shapes and bevels are the shipped pixels).
           One cap height for the three (the tightest fit, HEAD.h1: at most 8.4 units in 71).
  clusters "5+" (the war banner's large digits, ui/banner/banner-glyphs-D.webp, its dash drawn twice for the plus)
           beside "TOUCHING / SYMBOLS WIN" (ivory); the Multiplier Tiles x2 .. x128 (tiles/x*.webp) 4 over 3, each its
           own picture so the game can lift it as the clip doubles its tiles.
  scatters "4+" beside the War Standard (ui/armoury/hero-standard.webp), "WAR STANDARDS" (ivory), and "8 FREE SPINS"
           in the round's own teal title (ui/bigwin/bigwin-titles-molten, frame bwt_molten_intro_bonus). The title is
           BAKED AGAIN here by tools/build_bigwin_titles.py's own bake_title() with the molten outline and the Bonus
           color, the same function and numbers as the shipped frame, at this slate's density (the shipped frame is
           655 px wide, 2.4 px per CSS px where the slate draws it): only its texel count differs.
  features the Manticore's roar frame (sprites/creature/day/creature-day-roar, frame creature_day_roar_018) with
           "STING. SWIPE. ROAR." (ivory) across his feet.

DENSITY: 3 physical px per CSS px at the largest draw (Corey 2026-10-28): a card is never drawn wider than
INTRO_CARD.maxCssWidth (384 CSS px), so one card-width unit is 3 x 3.84 = 11.52 px. Every piece is composed at twice
that and reduced once (premultiplied), so a glyph's sub-pixel place survives.

Writes (nothing else):
  static/assets/ui/intro/intro-slate.webp     one atlas, every piece
  src/game/introSlateSpec.ts                  each piece's atlas box and its place in card-width units (AUTO-GENERATED)
  static/assets/ui/intro/intro-maxline-<art>[-social].webp   the max win line candidates (DEV / staging ?maxline)
  src/game/introMaxlineSpec.ts                the candidates' sizes and cap boxes (AUTO-GENERATED)

Run (from the parent repo root, or with the worktree's path):
  math-sdk/env/bin/python web-sdk/apps/manticore_mayhem/tools/build_intro_slate.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent
APP = HERE.parent
ASSETS = APP / "static" / "assets"
OUT_IMG = ASSETS / "ui" / "intro" / "intro-slate.webp"
OUT_TS = APP / "src" / "game" / "introSlateSpec.ts"
sys.path.insert(0, str(HERE))

# ---- density -----------------------------------------------------------------------------------------------------
MAX_CSS_CARD = 384  # = game/introCards.ts INTRO_CARD.maxCssWidth (checked in main)
PX_PER_UNIT = 3 * MAX_CSS_CARD / 100  # 11.52
SS = 2  # composed at SS x, reduced once
# lossy color and alpha: the alpha's largest step is about 10 levels of 255 at the soft edges (lossless alpha costs
# about 100 KB more on this sheet)
QUALITY = 85
ALPHA_QUALITY = 70

# ---- the mock's numbers (round3/tools/template.html), card-width units ----------------------------------------------
GOLD = (255, 198, 104)  # round3/tools/extract.py: the multiply color of header H1
TRACK = {"ivory": 0.07, "ivgold": 0.08}
SPACE = {"ivory": 0.34, "ivgold": 0.34}
KERN = {"AV": -0.1, "VA": -0.1, "AW": -0.08, "WA": -0.08, "AT": -0.08, "TA": -0.08, "PA": -0.08, "LT": -0.06, "TO": -0.04, "AR": 0, "RO": -0.02, "R.": -0.04, "G.": 0, "E.": 0}
HEAD = {"set": "ivgold", "max": 8.4, "w": 71}  # HEAD.h1
TITLES = {"clusters": "CLUSTERS", "scatters": "SCATTERS", "features": "MANTICORE"}
# the slate's fixed zones (render(): the header zone, the picture zone pz and its fit, the two rules, the line zone)
HEADER_ZONE = {"left": 14, "top": 64.6, "w": 72, "h": 12}
PZ = {"left": 14, "top": 79.2, "bottom": 118.4, "w": 72, "kmax": 1.12}
RULES = [{"top": 77.5, "opacity": 0.55}, {"top": 119.4, "opacity": 1.0}]
LINE_ZONE = {"top": 120.6, "h": 10.6}


# ---- the glyph sets: crops of the shipped atlases, as the mock's extract.py cut them --------------------------------
def bbox(im: Image.Image, thr: int):
    return im.getchannel("A").point(lambda v: 255 if v > thr else 0).getbbox()


def cut(atlas: Image.Image, fr: dict) -> Image.Image:
    return atlas.crop((fr["x"], fr["y"], fr["x"] + fr["w"], fr["y"] + fr["h"]))


def glyph(im: Image.Image, ink_thr: int = 120, tint=None) -> dict | None:
    full = bbox(im, 6)
    if not full:
        return None
    c = im.crop(full)
    ink = bbox(c, ink_thr) or (0, 0, c.width, c.height)
    if tint is not None:
        rgb = ImageChops.multiply(c.convert("RGB"), Image.new("RGB", c.size, tint))
        c = Image.merge("RGBA", (*rgb.split(), c.getchannel("A")))
    return {"im": c, "w": c.width, "h": c.height, "ix": ink[0], "iy": ink[1], "iw": ink[2] - ink[0], "ih": ink[3] - ink[1]}


def load_sets() -> dict:
    st_j = json.loads((ASSETS / "ui/stinger/stinger-glyphs.json").read_text())["frames"]
    st = Image.open(ASSETS / "ui/stinger/stinger-glyphs.webp").convert("RGBA")
    ivory, ivgold = {}, {}
    for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789":
        k = "stg_g_%04x" % ord(ch)
        if k in st_j:
            ivory[ch] = glyph(cut(st, st_j[k]["frame"]))
            # (the max win line, 2026-11-18: the gold set has the digits too; the slate's gold headers use letters only)
            ivgold[ch] = glyph(cut(st, st_j[k]["frame"]), tint=GOLD)
    for ch, nm in (("+", "002b"), (".", "002e"), ("x", "00d7"), (",", "002c")):
        k = "stg_g_" + nm
        if k in st_j:
            ivory[ch] = glyph(cut(st, st_j[k]["frame"]))
            if ch in "x,.":
                ivgold[ch] = glyph(cut(st, st_j[k]["frame"]), tint=GOLD)
    # the max win line's "x" is the face's own lowercase x (stg_g_0078) on the baseline, not the slate's multiplier sign:
    # keyed by a private-use character so the slate's "x" (the sign) is untouched
    ivory[LOWER_X] = glyph(cut(st, st_j["stg_g_0078"]["frame"]))
    ivgold[LOWER_X] = glyph(cut(st, st_j["stg_g_0078"]["frame"]), tint=GOLD)
    bn_j = json.loads((ASSETS / "ui/banner/banner-glyphs-D.json").read_text())["frames"]
    bn = Image.open(ASSETS / "ui/banner/banner-glyphs-D.webp").convert("RGBA")
    big = {ch: glyph(cut(bn, bn_j["stg_g_%04x" % ord(ch)]["frame"])) for ch in "0123456789"}
    big["-"] = glyph(cut(bn, bn_j["stg_g_002d"]["frame"]))
    return {
        "ivory": {"cap": ivory["H"]["ih"], "g": ivory, "big": big, "bigcap": big["0"]["ih"]},
        "ivgold": {"cap": ivgold["H"]["ih"], "g": ivgold, "big": {}, "bigcap": ivgold["H"]["ih"]},
    }


SETS: dict = {}
LOWER_X = "\ue078"


# ---- the mock's setter: measure() and lettering(), as draw lists ------------------------------------------------------
def measure(text: str, s: str, big: bool = False) -> float:
    S = SETS[s]
    w, prev = 0.0, ""
    for ch in text:
        if ch == " ":
            w += SPACE[s]
            prev = ""
            continue
        if big and ch == "+" and "-" in S["big"]:
            w += 0.46 + TRACK[s]
            prev = ch
            continue
        use_big = big and ch in S["big"]
        g = S["big"][ch] if use_big else S["g"].get(ch)
        cap_ink = S["bigcap"] if use_big else S["cap"]
        iw = g["iw"] / cap_ink if g else (0.56 if ch == "+" else 0.3)
        w += KERN.get(prev + ch, 0) + iw + TRACK[s]
        prev = ch
    return w - TRACK[s]


def fit_cap(text: str, s: str, width: float, mx: float, big: bool = False) -> float:
    return min(mx, width / measure(text, s, big))


def lettering(text: str, s: str, cap: float, big: bool = False) -> tuple[list, float]:
    """the draw list [(image, left, top, w, h, rot)] in units from the line's box (top = cap top), and its width"""
    S = SETS[s]
    draws, pen, prev = [], 0.0, ""
    for ch in text:
        if ch == " ":
            pen += SPACE[s] * cap
            prev = ""
            continue
        if big and ch == "+" and "-" in S["big"]:
            d = S["big"]["-"]
            k = (cap * 0.46) / d["iw"]
            cy = cap * 0.52
            for rot in (0, 90):
                draws.append((d, pen - d["ix"] * k, cy - (d["iy"] + d["ih"] / 2) * k, d["w"] * k, d["h"] * k, rot))
            pen += cap * 0.46 + TRACK[s] * cap
            prev = ch
            continue
        use_big = big and ch in S["big"]
        g = S["big"][ch] if use_big else S["g"].get(ch)
        assert g, f"no glyph {ch!r} in {s}"
        cap_ink = S["bigcap"] if use_big else S["cap"]
        pen += KERN.get(prev + ch, 0) * cap
        k = cap / cap_ink
        if ch in "+x":
            top = cap * (0.5 if ch == "+" else 0.62) - (g["iy"] + g["ih"] / 2) * k
        elif ch == ",":
            # the comma hangs below the baseline: its ink top where the period's ink top is
            top = cap - S["g"]["."]["ih"] * k - g["iy"] * k if "." in S["g"] else cap - (g["iy"] + g["ih"] * 0.4) * k
        else:
            top = cap - (g["iy"] + g["ih"]) * k
        draws.append((g, pen - g["ix"] * k, top, g["w"] * k, g["h"] * k, 0))
        pen += g["iw"] * k + TRACK[s] * cap
        prev = ch
    return draws, pen - TRACK[s] * cap


def shift(draws: list, dx: float, dy: float) -> list:
    return [(g, x + dx, y + dy, w, h, r) for g, x, y, w, h, r in draws]


def pic(im: Image.Image, x: float, y: float, w: float, h: float) -> tuple:
    return ({"im": im, "w": im.width, "h": im.height, "ix": 0, "iy": 0, "iw": im.width, "ih": im.height}, x, y, w, h, 0)


# ---- the pictures ------------------------------------------------------------------------------------------------------
def tile(n: int) -> Image.Image:
    return Image.open(ASSETS / f"tiles/x{n}.webp").convert("RGBA")


def hero_standard() -> Image.Image:
    s = Image.open(ASSETS / "ui/armoury/hero-standard.webp").convert("RGBA")
    return s.crop(bbox(s, 6))


def hero_manticore() -> Image.Image:
    cj = json.loads((ASSETS / "sprites/creature/day/creature-day-roar.json").read_text())["frames"]
    ci = Image.open(ASSETS / "sprites/creature/day/creature-day-roar.webp").convert("RGBA")
    return cut(ci, cj["creature_day_roar_018"]["frame"])


def free_spins_title(draw_x: float, draw_y: float, draw_w: float) -> tuple:
    """"8 FREE SPINS" in the round's molten teal. The mock drew the shipped frame's alpha box (> 6) `draw_w` units wide at
    (draw_x, draw_y); here the same bake, at this density, covers the rectangle the WHOLE shipped frame stood in"""
    bj = json.loads((ASSETS / "ui/bigwin/bigwin-titles-molten.json").read_text())["frames"]["bwt_molten_intro_bonus"]["frame"]
    shipped = cut(Image.open(ASSETS / "ui/bigwin/bigwin-titles-molten.webp").convert("RGBA"), bj)
    b = bbox(shipped, 6)
    k = draw_w / (b[2] - b[0])  # units per shipped px
    import build_bigwin_titles as bwt
    import build_plaque_text as bpt
    chars = "".join(sorted({c for d in (bwt.WINS, bwt.TOTAL, bwt.INTROS) for t in d.values() for c in t}))
    face = bpt.Face(bpt.MACONDO, bwt.EM, chars)
    img, meta = bwt.bake_title(face, bwt.INTROS["intro_bonus"], bwt.MODE["intro_bonus"], bwt.OUTLINE["molten"])
    # the shipped frame is this bake resized as a whole (build_bigwin_titles to_ship): its size must come out the same
    ship_k = bwt.BAKE_CAP["intro"] / meta["cap"] * 2.0
    assert (round(img.width * ship_k), round(img.height * ship_k)) == (shipped.width, shipped.height), (img.size, ship_k, shipped.size)
    return pic(img, draw_x - b[0] * k, draw_y - b[1] * k, shipped.width * k, shipped.height * k), {"srcW": img.width, "shippedW": shipped.width}


# ---- the slate per card (the mock's R3_PICS and A_PICS.features), in units of the picture box -----------------------
def clusters():
    W, s = 72, "ivory"
    num_cap = 14.5
    num, num_w = lettering("5+", s, num_cap, True)
    bw = W - num_w - 3.4
    c1, c2 = fit_cap("TOUCHING", s, bw, 6.6), fit_cap("SYMBOLS WIN", s, bw, 6.6)
    block_h = c1 + 2.1 + c2
    row_h = max(num_cap, block_h)
    chip, g, gap_row = 10.6, 1.5, 2.9
    H = row_h + gap_row + 2 * chip + g
    words = shift(num, 0, (row_h - num_cap) / 2)
    bx, by = num_w + 3.4, (row_h - block_h) / 2
    l1, w1 = lettering("TOUCHING", s, c1)
    l2, w2 = lettering("SYMBOLS WIN", s, c2)
    words += shift(l1, bx + (bw - w1) / 2, by) + shift(l2, bx + (bw - w2) / 2, by + c1 + 2.1)
    tiles = []
    for r, row in enumerate(((2, 4, 8, 16), (32, 64, 128))):
        rw = len(row) * chip + (len(row) - 1) * g
        x0 = (W - rw) / 2
        for i, n in enumerate(row):
            tiles.append((n, pic(tile(n), x0 + i * (chip + g), row_h + gap_row + r * (chip + g), chip, chip)))
    return W, H, {"words": words}, tiles


def scatters():
    W, s = 72, "ivory"
    std = hero_standard()
    std_h = 13.2
    std_w = std_h * std.width / std.height
    num_cap = 11.6
    num, num_w = lettering("4+", s, num_cap, True)
    row_w = num_w + 2.4 + std_w
    word_cap = fit_cap("WAR STANDARDS", s, 58, 5.5)
    bj = json.loads((ASSETS / "ui/bigwin/bigwin-titles-molten.json").read_text())["frames"]["bwt_molten_intro_bonus"]["frame"]
    shipped = cut(Image.open(ASSETS / "ui/bigwin/bigwin-titles-molten.webp").convert("RGBA"), bj)
    tb = bbox(shipped, 6)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    title_w = 71
    title_h = title_w * th / tw
    g1, g2 = 1.9, 2.4
    H = std_h + g1 + word_cap + g2 + title_h
    x0 = (W - row_w) / 2
    d = shift(num, x0, (std_h - num_cap) / 2 + 0.5)
    d.append(pic(std, x0 + num_w + 2.4, 0, std_w, std_h))
    wd, ww = lettering("WAR STANDARDS", s, word_cap)
    d += shift(wd, (W - ww) / 2, std_h + g1)
    title, info = free_spins_title((W - title_w) / 2, std_h + g1 + word_cap + g2, title_w)
    d.append(title)
    return W, H, {"pic": d}, [], info


def features():
    W, s = 72, "ivory"
    m = hero_manticore()
    hero_h = 33
    hero_w = hero_h * m.width / m.height
    cap = fit_cap("STING. SWIPE. ROAR.", s, 70, 6)
    over = 3.4
    H = hero_h - over + cap + 0.6
    d = [pic(m, (W - hero_w) / 2, 0, hero_w, hero_h)]
    td, tw = lettering("STING. SWIPE. ROAR.", s, cap)
    d += shift(td, (W - tw) / 2, hero_h - over)
    return W, H, {"pic": d}, []


# ---- composing ---------------------------------------------------------------------------------------------------------
def premul(im: Image.Image) -> np.ndarray:
    a = np.asarray(im.convert("RGBA"), np.float32) / 255
    return np.concatenate([a[..., :3] * a[..., 3:], a[..., 3:]], -1)


def resize_pm(pm: np.ndarray, w: int, h: int) -> np.ndarray:
    chans = [Image.fromarray(np.ascontiguousarray(pm[..., i]), "F").resize((w, h), Image.LANCZOS) for i in range(4)]
    return np.clip(np.stack([np.asarray(c) for c in chans], -1), 0, 1)


def compose(draws: list) -> tuple[np.ndarray, tuple[float, float, float, float]]:
    """the draws (units) composed at SS x the slate density, reduced once; returns the straight-alpha float RGBA and the
    image's box in units (x0, y0, w, h), the box covering every pixel any draw touches"""
    D = PX_PER_UNIT * SS
    x0 = min(x for _, x, _, _, _, _ in draws) - 0.2
    y0 = min(y for _, _, y, _, _, _ in draws) - 0.2
    x1 = max(x + w for _, x, _, w, _, _ in draws) + 0.2
    y1 = max(y + h for _, _, y, _, h, _ in draws) + 0.2
    # rotated pieces may reach past their own box: the dash is short and its ink center is the turning point, so pad by its width
    pad = max([max(w, h) for _, _, _, w, h, r in draws if r] or [0])
    x0, y0, x1, y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    # whole output pixels
    X0, Y0 = np.floor(x0 * PX_PER_UNIT) / PX_PER_UNIT, np.floor(y0 * PX_PER_UNIT) / PX_PER_UNIT
    OW, OH = int(np.ceil((x1 - X0) * PX_PER_UNIT)), int(np.ceil((y1 - Y0) * PX_PER_UNIT))
    canvas = np.zeros((OH * SS, OW * SS, 4), np.float32)
    for g, x, y, w, h, rot in draws:
        px, py = (x - X0) * D, (y - Y0) * D
        iw, ih = max(1, round(w * D)), max(1, round(h * D))
        pm = resize_pm(premul(g["im"]), iw, ih)
        ox, oy = int(round(px)), int(round(py))
        if rot:
            # turned about the ink center (the mock's transform-origin), in premultiplied space
            cx = (g["ix"] + g["iw"] / 2) / g["w"] * iw
            cy = (g["iy"] + g["ih"] / 2) / g["h"] * ih
            side = int(np.ceil(2 * max(iw, ih))) + 4
            big = np.zeros((side, side, 4), np.float32)
            bx, by = side // 2 - int(round(cx)), side // 2 - int(round(cy))
            big[by : by + ih, bx : bx + iw] = pm
            # CSS rotate(+90deg) is clockwise on screen; PIL's rotate is counter-clockwise for positive angles
            chans = [Image.fromarray(np.ascontiguousarray(big[..., i]), "F").rotate(-rot, resample=Image.BICUBIC, center=(side // 2, side // 2)) for i in range(4)]
            pm = np.clip(np.stack([np.asarray(c) for c in chans], -1), 0, 1)
            ox, oy = ox - bx, oy - by
            ih, iw = pm.shape[0], pm.shape[1]
        ya, xa = max(0, oy), max(0, ox)
        yb, xb = min(canvas.shape[0], oy + ih), min(canvas.shape[1], ox + iw)
        src = pm[ya - oy : yb - oy, xa - ox : xb - ox]
        dst = canvas[ya:yb, xa:xb]
        canvas[ya:yb, xa:xb] = src + dst * (1 - src[..., 3:])
    out = resize_pm(canvas, OW, OH)
    rgb = out[..., :3] / np.maximum(out[..., 3:], 1e-6)
    return np.concatenate([np.clip(rgb, 0, 1), out[..., 3:]], -1), (float(X0), float(Y0), OW / PX_PER_UNIT, OH / PX_PER_UNIT)


def trim(arr: np.ndarray, box) -> tuple[np.ndarray, tuple]:
    a = arr[..., 3] > 1 / 255
    ys, xs = np.where(a)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return arr[y0:y1, x0:x1], (box[0] + x0 / PX_PER_UNIT, box[1] + y0 / PX_PER_UNIT, (x1 - x0) / PX_PER_UNIT, (y1 - y0) / PX_PER_UNIT)


def pack(items: dict[str, np.ndarray], width: int = 1024, gap: int = 12) -> tuple[np.ndarray, dict]:
    """a plain shelf packer, tallest first. `gap`: clear px around every piece, so a card drawn at a sixth of the atlas
    density (the popout) samples none of its neighbours"""
    order = sorted(items, key=lambda k: -items[k].shape[0])
    width = max(width, max(a.shape[1] for a in items.values()) + 2 * gap)
    x = y = gap
    shelf = 0
    rects = {}
    for k in order:
        h, w = items[k].shape[:2]
        if x + w + gap > width:
            x, y, shelf = gap, y + shelf + gap, 0
        rects[k] = (x, y, w, h)
        x += w + gap
        shelf = max(shelf, h)
    H = y + shelf + gap
    sheet = np.zeros((H, width, 4), np.float32)
    for k, (x, y, w, h) in rects.items():
        sheet[y : y + h, x : x + w] = items[k]
    return sheet, rects


def main() -> None:
    ts = (APP / "src/game/introCards.ts").read_text()
    assert f"maxCssWidth: {MAX_CSS_CARD}," in ts, "INTRO_CARD.maxCssWidth changed: the slate's density follows it"
    SETS.update(load_sets())
    head_cap = min(fit_cap(t, HEAD["set"], HEAD["w"], HEAD["max"]) for t in TITLES.values())
    items: dict[str, np.ndarray] = {}
    place: dict[str, dict] = {}
    notes = []

    def add(name: str, draws: list, card: str, role: str, extra: dict | None = None):
        arr, box = trim(*compose(draws))
        items[name] = arr
        place[name] = {"card": card, "role": role, "x": box[0], "y": box[1], "w": box[2], "h": box[3], **(extra or {})}

    for key, text in TITLES.items():
        d, w = lettering(text, HEAD["set"], head_cap)
        # the header zone: the line centered in it, its cap box (y 0 .. cap) at the zone's middle
        add(f"header_{key}", shift(d, HEADER_ZONE["left"] + (HEADER_ZONE["w"] - w) / 2, HEADER_ZONE["top"] + (HEADER_ZONE["h"] - head_cap) / 2), key, "header", {"text": text})

    zone_h = PZ["bottom"] - PZ["top"]
    for key, fn in (("clusters", clusters), ("scatters", scatters), ("features", features)):
        res = fn()
        W, H, groups, tiles = res[:4]
        if len(res) > 4:
            notes.append(res[4])
        k = min(PZ["kmax"], zone_h / H, PZ["w"] / W)
        # the picture box centered in the zone and scaled about its center (render(): flex center, then scale(k))
        ox = PZ["left"] + PZ["w"] / 2 - W * k / 2
        oy = PZ["top"] + zone_h / 2 - H * k / 2

        def to_card(draws):
            return [(g, ox + x * k, oy + y * k, w * k, h * k, r) for g, x, y, w, h, r in draws]

        for gname, draws in groups.items():
            add(f"{key}_{gname}", to_card(draws), key, gname)
        for i, (n, dr) in enumerate(tiles):
            add(f"tile_x{n}", to_card([dr]), key, "tile", {"n": n, "order": i})
        notes.append({"card": key, "W": W, "H": round(H, 3), "k": round(k, 4)})

    sheet, rects = pack(items)
    OUT_IMG.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray((sheet * 255 + 0.5).astype(np.uint8), "RGBA").save(OUT_IMG, "WEBP", quality=QUALITY, method=6, alpha_quality=ALPHA_QUALITY)
    cap_top = HEADER_ZONE["top"] + (HEADER_ZONE["h"] - head_cap) / 2
    r = lambda v: round(v, 3)  # noqa: E731
    lines = [
        "// AUTO-GENERATED by apps/manticore_mayhem/tools/build_intro_slate.py (do not edit: rerun the tool).",
        "// THE INTRO CARDS' SLATE LETTERING (intro cards round 3, header H1): every piece of static/assets/ui/intro/intro-slate.webp,",
        "// its box in the atlas (px) and where it stands on the card in CARD-WIDTH UNITS (1 = 1 % of the card's width; x from the",
        "// card's left edge, y from the card's top edge, as the approved mock placed it: the game moves the whole block, see",
        "// game/introCards.ts INTRO_SLATE). Density: 3 px per CSS px on a card drawn at INTRO_CARD.maxCssWidth.",
        f"export const INTRO_SLATE_ATLAS = {{ w: {sheet.shape[1]}, h: {sheet.shape[0]}, pxPerUnit: {PX_PER_UNIT} }} as const;",
        "/** the mock's fixed zones (card-width units from the card's top): the header's cap box, the two rules, the line zone */",
        f"export const INTRO_SLATE_ZONES = {{ capTop: {r(cap_top)}, cap: {r(head_cap)}, rules: {json.dumps(RULES)}, lineTop: {LINE_ZONE['top']}, lineH: {LINE_ZONE['h']} }} as const;",
        "export type IntroSlatePiece = { card: 'clusters' | 'scatters' | 'features'; role: string; atlas: readonly [number, number, number, number]; x: number; y: number; w: number; h: number; n?: number; order?: number; text?: string };",
        "export const INTRO_SLATE_PIECES: Record<string, IntroSlatePiece> = {",
    ]
    for name, p in place.items():
        x, y, w, h = rects[name]
        extra = "".join(f", {k}: {json.dumps(p[k])}" for k in ("n", "order", "text") if k in p)
        lines.append(f"\t{name}: {{ card: '{p['card']}', role: '{p['role']}', atlas: [{x}, {y}, {w}, {h}], x: {r(p['x'])}, y: {r(p['y'])}, w: {r(p['w'])}, h: {r(p['h'])}{extra} }},")
    lines.append("};")
    OUT_TS.write_text("\n".join(lines) + "\n")
    print(f"intro-slate.webp {sheet.shape[1]} x {sheet.shape[0]}  {OUT_IMG.stat().st_size / 1024:.1f} KB; header cap {head_cap:.3f} at {cap_top:.3f}")
    for n in notes:
        print(" ", n)


# ---- THE MAX WIN LINE CANDIDATES (2026-11-18; Corey "yes" to bringing the max win back onto the intro) ------------------
# One line of image lettering OUTSIDE the cards, in the slate's own two faces. The words are the game's own: the
# INTRO_MAX_WIN_WORDS table in src/game/introCardText.ts (lead and tail, standard and social) and config.ts maxWin
# (the number, en-US grouping, then "x"), read from the source here, never typed in. A wording whose words are the same
# in both modes is baked once. Candidates (game/introCards.ts INTRO_MAXLINE, DEV / staging ?maxline=1|2|3):
#   m1  "WIN UP TO 10,000x" in the H1 gold, the rest of the phrase smaller in ivory, on one baseline   (?maxline=1 and 3)
#   m2  the whole phrase in the ivory headline face, smaller                                            (?maxline=2)
# Density: 3 px per CSS px at the largest the game draws it (INTRO_MAXLINE.maxCapCss, read from introCards.ts).
OUT_MAXLINE = ASSETS / "ui" / "intro"
OUT_MAXLINE_TS = APP / "src" / "game" / "introMaxlineSpec.ts"
BANNED = ("bet", "buy", "cash", "money", "paid", "credit", "gamble", "wager", "stake")
TAIL_CAP = 0.62  # m1: the ivory tail's cap per the gold cap


def maxline_words() -> dict[str, tuple[str, str, str]]:
    import re
    txt = (APP / "src/game/introCardText.ts").read_text()
    block = txt[txt.index("export const INTRO_MAX_WIN_WORDS = {") :]
    block = block[: block.index("} as const;")]
    words = {}
    for mode in ("standard", "social"):
        m = re.search(mode + r": \{ lead: '([^']*)', tail: '([^']*)' \}", block)
        assert m, f"INTRO_MAX_WIN_WORDS.{mode} not found"
        words[mode] = (m.group(1), m.group(2))
    cfg = (APP / "src/game/config.ts").read_text()
    max_win = int(re.search(r"\bmaxWin: (\d+),", cfg).group(1))
    num = f"{max_win:,}x"
    for lead, tail in words.values():
        assert not any(re.search(r"\b" + b, (lead + tail).lower()) for b in BANNED), (lead, tail)
    return {mode: (lead, num, tail) for mode, (lead, tail) in words.items()}


def max_cap_css() -> dict[str, float]:
    import re
    ts = (APP / "src/game/introCards.ts").read_text()
    m = re.search(r"maxCapCss: \{ m1: ([\d.]+), m2: ([\d.]+) \}", ts)
    assert m, "INTRO_MAXLINE.maxCapCss not found"
    return {"m1": float(m.group(1)), "m2": float(m.group(2))}


def build_maxline() -> list[str]:
    caps = max_cap_css()
    words = maxline_words()
    out, report = {}, []
    for art in ("m1", "m2"):
        cap = 3 * caps[art] / PX_PER_UNIT  # units: the reference cap at 3 px per CSS px of its largest draw
        out[art] = {}
        baked: dict[tuple, str] = {}
        for mode, (lead, num, tail) in words.items():
            key = (lead, num, tail)
            if key in baked:
                out[art][mode] = out[art][baked[key]]
                continue
            baked[key] = mode
            lx = lambda t: t.replace("x", LOWER_X)  # noqa: E731  (the words are capitals: only the number's x is lowercase)
            if art == "m1":
                d1, w1 = lettering(lx((lead + num).strip()), "ivgold", cap)
                t_cap = cap * TAIL_CAP
                d2, w2 = lettering(tail.strip(), "ivory", t_cap)
                gap = SPACE["ivgold"] * cap
                # one baseline: the tail's cap box sits on the gold line's baseline
                draws = d1 + shift(d2, w1 + gap, cap - t_cap)
            else:
                draws, _ = lettering(lx((lead + num + tail).strip()), "ivory", cap)
            arr, box = trim(*compose(draws))
            name = f"intro-maxline-{art}" + ("" if mode == "standard" else f"-{mode}") + ".webp"
            path = OUT_MAXLINE / name
            Image.fromarray((arr * 255 + 0.5).astype(np.uint8), "RGBA").save(path, "WEBP", quality=QUALITY, method=6, alpha_quality=ALPHA_QUALITY)
            # the reference cap box in the image's px (y from its top), so the game can size it by the cap
            cap_top_px = (0 - box[1]) * PX_PER_UNIT
            out[art][mode] = {"src": f"/assets/ui/intro/{name}", "w": arr.shape[1], "h": arr.shape[0], "capTop": round(cap_top_px, 2), "cap": round(cap * PX_PER_UNIT, 2), "text": (lead + num + tail).strip(), "bytes": path.stat().st_size}
            report.append(f"  {name} {arr.shape[1]} x {arr.shape[0]}  {path.stat().st_size / 1024:.1f} KB  \"{(lead + num + tail).strip()}\"")
    lines = [
        "// AUTO-GENERATED by apps/manticore_mayhem/tools/build_intro_slate.py (do not edit: rerun the tool).",
        "// THE MAX WIN LINE CANDIDATES (DEV / staging ?maxline=1|2|3, game/introCards.ts INTRO_MAXLINE): per art and wording the",
        "// baked line, its size in px, and its reference cap box (capTop from the image's top, cap: the gold cap for m1, the",
        "// ivory cap for m2), so the game draws it by its cap height. `text` is what the image says (introCardText INTRO_MAX_WIN).",
        "export type IntroMaxlineArt = { src: string; w: number; h: number; capTop: number; cap: number; text: string; bytes: number };",
        "export const INTRO_MAXLINE_ART: Record<'m1' | 'm2', Record<'standard' | 'social', IntroMaxlineArt>> = {",
    ]
    for art, modes in out.items():
        lines.append(f"\t{art}: {{")
        for mode, a in modes.items():
            lines.append(f"\t\t{mode}: {json.dumps(a)},")
        lines.append("\t},")
    lines.append("};")
    OUT_MAXLINE_TS.write_text("\n".join(lines) + "\n")
    return report


if __name__ == "__main__":
    import sys as _sys
    if "--maxline-only" in _sys.argv:
        SETS.update(load_sets())
    else:
        main()
    print("max win line candidates:")
    print("\n".join(build_maxline()))
