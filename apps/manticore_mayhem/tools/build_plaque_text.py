#!/usr/bin/env python
"""Plaque text for the win stingers, the bonus intro and the wrap-up (Corey, 2026-10-08).

Two looks, both BAKED so the game draws plain sprites (no filters, no per-frame text raster):
  titles   Macondo Swash Caps, POLISHED GOLD (mirror band, lit chiselled bevel), one image per word
           set, hand-spaced with the font's own kerning plus TITLE_NUDGE.
  glyphs   Rakkas, FORGED (flat pale face, dark bronze walls), one atlas for amounts and for the
           explanation lines. Every Stake currency mark is covered: the nine Rakkas lacks
           (FALLBACK_CHARS) come from Noto Serif 900, scaled to the Rakkas digit height.

Writes <out>/titles/<name>.png (+ <name>_glow.png, an additive ember halo for Epic and Max),
<out>/plaque-glyphs.{png,json} and <out>/plaque-text.json (metrics, kerning, title boxes).

Run: math-sdk/env/bin/python web-sdk/apps/manticore_mayhem/tools/build_plaque_text.py --out <dir>

  labels   THE CLUSTER LABELS' OWN SMALL ATLAS (Corey 2026-10-09: the board labels "look pixellated even
           on Desktop"; they were the plaque's 64 px glyphs drawn at 21..36 px). The same forged Rakkas
           glyphs and the same characters, baked AT THE SIZES THE LABELS ARE DRAWN (LABEL_CAPS, cap
           height in canvas pixels; the game picks the nearest, so a glyph is sampled within about 0.9x
           to 1.12x), each rendered 4x and box-reduced so every edge is antialiased, with integer
           advances. Two frames per glyph and size: the FACE (tinted cream or teal by the game) and an
           UNDER layer (a round dark outline and a soft drop shadow), so the outline stays dark whatever
           the face's tint. This mode writes ONLY its own files and touches nothing else:

  math-sdk/env/bin/python web-sdk/apps/manticore_mayhem/tools/build_plaque_text.py \
      --labels web-sdk/apps/manticore_mayhem/static/assets/ui/labels \
      --labels-ts web-sdk/apps/manticore_mayhem/src/game/labelGlyphs.ts
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage as ndi

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
sys.path.insert(0, str(REPO / "tools"))
from build_stencil_atlas import kern_pairs  # noqa: E402  (GPOS pair kerning, font units)

FONTS = HERE / "fonts"
MACONDO = FONTS / "MacondoSwashCaps-Regular.ttf"
RAKKAS = FONTS / "Rakkas-Regular.ttf"
NOTO = FONTS / "NotoSerif[wdth,wght].ttf"

TITLE_EM = 228  # px: 76 px on the 946 px ship plaque, baked at 3x
GLYPH_EM = 192  # px: amounts draw at about 64 px on the ship plaque, baked at 3x

# title -> (base gold, ember halo strength). The five win tiers climb in warmth and brightness.
GOLD = (232, 176, 72)
TITLES = {
    "win_big": ("BIG WIN", (206, 158, 82), 0),
    "win_super": ("SUPER WIN", (222, 168, 76), 0),
    "win_mega": ("MEGA WIN", (232, 176, 72), 0),
    "win_epic": ("EPIC WIN", (242, 194, 92), 0.35),
    "win_max": ("MAX WIN", (250, 214, 120), 0.5),
    # the three features climb the same way (Corey 2026-10-08): bronze gold, gold, hot gold
    "intro_bonus": ("8 FREE SPINS", (210, 162, 84), 0),
    "intro_super": ("10 SUPER FREE SPINS", (234, 180, 76), 0),
    "intro_epic": ("12 EPIC FREE SPINS", (250, 212, 116), 0.4),
    "total_win": ("TOTAL WIN", GOLD, 0),
}
# extra pair spacing in em, on top of the font's kerning (the swashed capitals leave holes)
TITLE_NUDGE: dict[tuple[str, str], float] = {}

# The bonus intro explanations (Corey 2026-10-08, layout C): three even rows at 33 px on the 946 px
# ship plaque, max row width 572 px. Each screen stands alone: a player who never read the rules
# should know what to expect. One wording for Stake and stake.us (no "pays" / "bet"). No em dashes.
INTRO_COPY = {
    "bonus": ["Wins add multipliers to their cells", "They double up to 64x and stay all round", "Stings turn symbols wild"],
    "super": ["Wins add multipliers to their cells", "They double up to 128x and stay all round", "Roars and Super Stings can strike"],
    "epic": ["Wins add multipliers to their cells", "They double up to 128x and stay all round", "Roars and Super Stings strike often"],
}
WRAP_COPY = {"title": "total_win", "line": "in {spins} {mode}"}  # e.g. "in 10 Super Free Spins"
# slab_dark: the marble panel is darkened 35 % on every screen (a black sprite clipped to the panel,
# UNDER the additive vein glow, so the glow keeps its full brightness). Corey 2026-10-08.
# Placement (approved on the 2026-10-08 mocks): phone portrait spans the screen width; desktop
# runs to the sides of the board frame and stops short of the chains (art about 490 px wide on a
# 1280 px screen, where the grid is 425). The PANEL centre sits on the grid centre. The scene
# behind keeps about 72 % of its brightness (dim alpha 0.28), far lighter than the old 0.55. The wrap-up line is the explanation size (the 22 px draft failed on a phone).
LAYOUT = {
    "ship_width": 946, "panel": [175, 173, 596, 222], "slab_dark": 0.35, "scene_dim": 0.28,
    "intro": {"title_cap": 32, "title_cy": 0.18, "text_px": 33, "rows_cy": [0.46, 0.645, 0.83], "max_width": 572},
    "win": {"title_cap": 50, "title_cy": 0.34, "amount_px": 64, "amount_cy": 0.72, "max_width": 520},
    "wrap": {"title_cap": 36, "title_cy": 0.20, "amount_px": 56, "amount_cy": 0.53, "line_px": 33, "line_cy": 0.85, "max_width": 560},
}

GLYPH_CHARS = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    ".,:-+/'x×%()! "
    "$€£¥₹₽₱₩₫₺₦₡₨₵₪łجم"
)
FALLBACK_CHARS = "₹₱₩₫₦₡₨₵₪"
FACE = (246, 236, 208)

A = lambda im: np.asarray(im, dtype=np.float32) / 255.0  # noqa: E731


def dilate(mask: Image.Image, r: float) -> Image.Image:
    return mask.filter(ImageFilter.MaxFilter(2 * max(1, int(round(r))) + 1))


def over(dst: np.ndarray, col, alpha: np.ndarray) -> np.ndarray:
    """Straight-alpha 'over' of a flat or per-pixel colour onto an RGBA float canvas."""
    col = np.broadcast_to(np.asarray(col, np.float32), dst.shape[:2] + (3,))
    a = alpha[..., None]
    out_a = a + dst[..., 3:] * (1 - a)
    rgb = (col * a + dst[..., :3] * dst[..., 3:] * (1 - a)) / np.maximum(out_a, 1e-6)
    return np.concatenate([rgb, out_a], -1)


def metal(mask: Image.Image, top: int, bot: int, base, style: str, em: float, seed: int = 7, face_only: bool = False, grain: float = 0.03) -> Image.Image:
    """The baked look: soft shadow, thin dark edge, bevel lit from the upper left. `top`..`bot` is
    the cap band the vertical reflection is mapped over, so every glyph shares one horizon.
    `face_only` (the label atlas): the lit face alone, no shadow and no edge under it."""
    w, h = mask.size
    M = A(mask)
    inside = M > 0.5
    rng = np.random.default_rng(seed)
    canvas = np.zeros((h, w, 4), np.float32)
    if not face_only:
        edge = dilate(mask, 0.019 * em)
        sh = A(ImageChops.offset(edge, int(round(0.019 * em)), int(round(0.034 * em))).filter(ImageFilter.GaussianBlur(0.034 * em)))
        canvas = over(canvas, (0, 0, 0), sh * 0.55)
        canvas = over(canvas, (34 / 255, 18 / 255, 6 / 255), A(edge.filter(ImageFilter.GaussianBlur(0.005 * em))) * 0.92)
    bevel = (0.035 if style == "polished" else 0.036) * em
    dist = ndi.distance_transform_edt(inside).astype(np.float32)
    height = ndi.gaussian_filter(np.minimum(dist, bevel), 0.009 * em)
    gy, gx = np.gradient(height)
    n = np.stack([-gx, -gy, np.ones_like(gx)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    light = np.array([-0.45, -0.70, 0.55]); light /= np.linalg.norm(light)
    diff = np.clip((n * light).sum(-1), 0, 1)
    half = light + np.array([0, 0, 1.0]); half /= np.linalg.norm(half)
    spec = np.clip((n * half).sum(-1), 0, 1) ** 26
    ys = np.clip((np.arange(h) - top) / max(1, bot - top), 0, 1)[:, None]
    bc = np.array(base, np.float32) / 255.0
    if style == "polished":  # mirror gold: bright sky, dark horizon, warm ground
        env = np.interp(ys, [0, 0.40, 0.50, 0.58, 1], [1.25, 1.02, 0.52, 0.86, 1.02])
        col = bc * (0.50 + 0.62 * diff)[..., None] * env[..., None] + spec[..., None] * 0.60
    else:  # forged: dark bronze walls, flat warm face
        wall = np.clip(1 - dist / bevel, 0, 1)
        env = np.interp(ys, [0, 1], [1.05, 0.86])
        face = bc * env[..., None] * (1 + rng.normal(0, 0.03, (h, w)) * (grain / 0.03))[..., None]
        walls = np.array([120, 70, 26], np.float32) / 255 * (0.35 + 1.1 * diff)[..., None] + spec[..., None] * 0.30
        col = face * (1 - wall[..., None]) + walls * wall[..., None]
    canvas = over(canvas, np.clip(col, 0, 1), M)
    return Image.fromarray((np.clip(canvas, 0, 1) * 255).astype(np.uint8), "RGBA")


class Face:
    def __init__(self, path: Path, em: int, chars: str, axes: list[float] | None = None):
        self.em = em
        self.font = ImageFont.truetype(str(path), em)
        if axes:
            self.font.set_variation_by_axes(axes)
        tt = TTFont(str(path))
        self.upm = tt["head"].unitsPerEm
        self.cap = getattr(tt["OS/2"], "sCapHeight", 0) or 700
        have = "".join(c for c in chars if ord(c) in tt.getBestCmap())
        self.kern = {k: v * em / self.upm for k, v in kern_pairs(tt, have).items()} if "GPOS" in tt and not axes else {}

    def advance(self, ch: str) -> float:
        return self.font.getlength(ch)


def layout(face: Face, text: str, nudge: dict[tuple[str, str], float] | None = None) -> list[tuple[str, float]]:
    x, out = 0.0, []
    for i, ch in enumerate(text):
        if i:
            pair = (text[i - 1], ch)
            x += face.kern.get(pair, 0) + (nudge or {}).get(pair, 0) * face.em
        out.append((ch, x))
        x += face.advance(ch)
    out.append(("", x))
    return out


def build_titles(out: Path) -> dict:
    (out / "titles").mkdir(parents=True, exist_ok=True)
    face = Face(MACONDO, TITLE_EM, "".join(sorted({c for t, _, _ in TITLES.values() for c in t})))
    pad = int(0.16 * TITLE_EM)
    asc = int(TITLE_EM * 1.05)
    # glow.dx / dy: the glow image's top left relative to the title image's top left (title px, 3x)
    meta = {}
    for name, (text, base, ember) in TITLES.items():
        run = layout(face, text, TITLE_NUDGE)
        w, h = int(run[-1][1]) + 2 * pad, int(TITLE_EM * 1.5) + 2 * pad
        mask = Image.new("L", (w, h), 0)
        d = ImageDraw.Draw(mask)
        base_y = pad + asc
        for ch, x in run[:-1]:
            d.text((pad + x, base_y), ch, font=face.font, fill=255, anchor="ls")
        cap_top = base_y - int(face.cap * TITLE_EM / face.upm)
        img = metal(mask, cap_top, base_y, base, "polished", TITLE_EM)
        box = img.getbbox()
        img.crop(box).save(out / "titles" / f"{name}.png")
        meta[name] = {"text": text, "w": box[2] - box[0], "h": box[3] - box[1], "baseline": base_y - box[1], "cap": base_y - cap_top, "scale": 3}
        if ember:
            # the halo spreads well past the letters: give it its own roomy canvas and box (cropping it
            # to the title's box cut it into a rectangle), and record where it sits relative to the title
            gp = int(0.45 * TITLE_EM)
            big = Image.new("L", (w + 2 * gp, h + 2 * gp), 0)
            big.paste(dilate(mask, 0.03 * TITLE_EM), (gp, gp))
            glow = big.filter(ImageFilter.GaussianBlur(0.1 * TITLE_EM))
            gbox = glow.point(lambda v: 255 if v > 1 else 0).getbbox()
            g = Image.new("RGBA", glow.size, (255, 255, 255, 0)); g.putalpha(glow)
            g.crop(gbox).save(out / "titles" / f"{name}_glow.png")
            meta[name]["glow"] = {"tint": "#ff5214", "alpha": ember, "dx": gbox[0] - gp - box[0], "dy": gbox[1] - gp - box[1], "w": gbox[2] - gbox[0], "h": gbox[3] - gbox[1]}
    return meta


def build_glyphs(out: Path) -> dict:
    rak = Face(RAKKAS, GLYPH_EM, GLYPH_CHARS)
    noto = Face(NOTO, GLYPH_EM, "", axes=[900, 100])
    # scale the fallback so its digits stand as tall as the Rakkas digits
    rb, nb = rak.font.getbbox("0", anchor="ls"), noto.font.getbbox("0", anchor="ls")
    nscale = (rb[3] - rb[1]) / (nb[3] - nb[1])
    noto = Face(NOTO, int(round(GLYPH_EM * nscale)), "", axes=[900, 100])
    pad = int(0.10 * GLYPH_EM)
    cell_h = int(GLYPH_EM * 1.45) + 2 * pad
    base_y = pad + int(GLYPH_EM * 1.0)
    cap_top = base_y - int(rak.cap * GLYPH_EM / rak.upm)
    tiles, metrics = [], {}
    for i, ch in enumerate(GLYPH_CHARS):
        face = noto if ch in FALLBACK_CHARS else rak
        adv = face.advance(ch)
        if ch == " ":
            metrics[ch] = {"adv": adv, "frame": None}
            continue
        w = int(adv + GLYPH_EM * 0.6) + 2 * pad
        mask = Image.new("L", (w, cell_h), 0)
        ox = pad + int(GLYPH_EM * 0.3)
        ImageDraw.Draw(mask).text((ox, base_y), ch, font=face.font, fill=255, anchor="ls")
        if ch in FALLBACK_CHARS:  # thicken toward the Rakkas stem weight
            mask = mask.filter(ImageFilter.GaussianBlur(0.012 * GLYPH_EM)).point(lambda v: 255 if v > 88 else int(v * 255 / 88))
        img = metal(mask, cap_top, base_y, FACE, "forged", GLYPH_EM, seed=100 + i)
        box = img.getbbox()
        if not box:
            continue
        tiles.append((ch, img.crop(box)))
        metrics[ch] = {"adv": adv, "ox": box[0] - ox, "oy": box[1] - base_y, "w": box[2] - box[0], "h": box[3] - box[1], "fallback": ch in FALLBACK_CHARS}
    # shelf pack
    W, x, y, row_h, gap, place = 2048, 0, 0, 0, 2, {}
    for ch, im in tiles:
        if x + im.width + gap > W:
            x, y, row_h = 0, y + row_h + gap, 0
        place[ch] = (x, y)
        x += im.width + gap
        row_h = max(row_h, im.height)
    sheet = Image.new("RGBA", (W, y + row_h), (0, 0, 0, 0))
    frames = {}
    for ch, im in tiles:
        px, py = place[ch]
        sheet.paste(im, (px, py))
        nm = f"pt_{ord(ch):04x}.png"
        frames[nm] = {"frame": {"x": px, "y": py, "w": im.width, "h": im.height}, "sourceSize": {"w": im.width, "h": im.height}, "spriteSourceSize": {"x": 0, "y": 0, "w": im.width, "h": im.height}}
        metrics[ch]["frame"] = nm
    sheet.save(out / "plaque-glyphs.png")
    (out / "plaque-glyphs.json").write_text(json.dumps({"frames": frames, "meta": {"image": "plaque-glyphs.png", "size": {"w": sheet.width, "h": sheet.height}, "scale": "1"}}, indent="\t"))
    kern = {a + b: round(v, 2) for (a, b), v in rak.kern.items() if a not in FALLBACK_CHARS and b not in FALLBACK_CHARS}
    print(f"glyph atlas {sheet.width}x{sheet.height}, {len(frames)} glyphs, {len(kern)} kern pairs, fallback scale {nscale:.3f}")
    return {"em": GLYPH_EM, "cap": base_y - cap_top, "glyphs": metrics, "kern": kern}


# ---- the cluster labels' small atlases ---------------------------------------------------------------
# cap heights in CANVAS pixels. The labels draw at 0.40 of a cell: about 21 px on a 1280 x 720 desktop,
# 24 at 1440 x 900, 36 on the same screen at 2x (the renderer's resolution is capped at 1.5), 23 to 25 on
# a phone, 48 to 64 on a large 2x desktop. Steps of about 1.26 keep any size within 0.89x .. 1.12x of a
# baked one. ONE FILE PER CAP: the game loads the one its screen needs up front and the rest behind.
LABEL_CAPS = [24, 30, 38, 48, 60]
# what a cluster label can ever show: a currency amount (utils-shared/amount.ts: digits, separators, every
# symbol in its table, and an unknown currency's upper case CODE) and "x n". The plaque's copy needs the
# rest of the alphabet; the labels do not, and every glyph is paid for five times here.
LABEL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZhkprsz0123456789.,-/'x× $€£¥₹₽₱₩₫₺₦₡₨₵₪łجم"
LABEL_SS = 4  # supersampling: rendered at 4x, box-reduced
LABEL_OUTLINE = 0.065  # the dark outline's reach past the glyph, in cap heights (1.6 px at 24)
LABEL_OUTLINE_RGB = (14, 10, 8)
LABEL_SHADOW = {"dx": 0.045, "dy": 0.075, "blur": 0.05, "alpha": 0.6}  # cap heights
LABEL_PREFIX = "lbl"
LABEL_WEBP = {"quality": 90, "alpha_quality": 80, "method": 6}


def reduce_rgba(arr: np.ndarray, k: int) -> np.ndarray:
    """Box-reduce a straight-alpha float RGBA canvas by k, averaging PREMULTIPLIED colour (no dark fringe)."""
    h, w = arr.shape[0] // k * k, arr.shape[1] // k * k
    pm = np.concatenate([arr[:h, :w, :3] * arr[:h, :w, 3:], arr[:h, :w, 3:]], -1)
    pm = pm.reshape(h // k, k, w // k, k, 4).mean((1, 3))
    a = pm[..., 3:]
    return np.concatenate([np.where(a > 1e-6, pm[..., :3] / np.maximum(a, 1e-6), 0), a], -1)


def to_image(arr: np.ndarray) -> Image.Image:
    return Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def build_labels(out: Path, ts_out: Path | None) -> None:
    import hashlib

    out.mkdir(parents=True, exist_ok=True)
    table: dict[str, list[list[int]]] = {ch: [] for ch in LABEL_CHARS}
    kerns: dict[str, list[int]] = {}
    digit_adv: list[int] = []
    report = []
    for ci, cap in enumerate(LABEL_CAPS):
        ss = LABEL_SS
        em = cap * 3 * ss // 2  # Rakkas's cap height is 2/3 em (GLYPH_EM 192 -> cap 128); the caps are even
        rak = Face(RAKKAS, em, LABEL_CHARS)
        noto0 = Face(NOTO, em, "", axes=[900, 100])
        rb, nb = rak.font.getbbox("0", anchor="ls"), noto0.font.getbbox("0", anchor="ls")
        noto = Face(NOTO, int(round(em * (rb[3] - rb[1]) / (nb[3] - nb[1]))), "", axes=[900, 100])
        cap_ss = int(rak.cap * em / rak.upm)
        reach = int(np.ceil((LABEL_OUTLINE + max(LABEL_SHADOW["dx"], LABEL_SHADOW["dy"]) + 2.5 * LABEL_SHADOW["blur"]) * cap_ss)) + 2 * ss
        pad = (reach // ss + 2) * ss
        cell_h = (int(em * 1.45) // ss + 1) * ss + 2 * pad
        base_y = pad + (int(em * 1.0) // ss + 1) * ss  # a multiple of ss: the baseline lands on a whole pixel
        cap_top = base_y - cap_ss
        tiles: list[tuple[str, Image.Image]] = []
        for i, ch in enumerate(LABEL_CHARS):
            face = noto if ch in FALLBACK_CHARS else rak
            adv = int(round(face.advance(ch) / ss))
            if ch == " ":
                table[ch].append([adv])
                continue
            ox = pad + (int(em * 0.3) // ss + 1) * ss  # the pen origin, a multiple of ss too
            w = ((ox + int(face.advance(ch)) + int(em * 0.3) + pad) // ss + 1) * ss
            mask = Image.new("L", (w, cell_h), 0)
            ImageDraw.Draw(mask).text((ox, base_y), ch, font=face.font, fill=255, anchor="ls")
            if ch in FALLBACK_CHARS:  # thicken toward the Rakkas stem weight (as build_glyphs)
                mask = mask.filter(ImageFilter.GaussianBlur(0.012 * em)).point(lambda v: 255 if v > 88 else int(v * 255 / 88))
            # grain 0: the plaque's 3 % face grain averages away at these sizes and only costs bytes
            face_img = A(metal(mask, cap_top, base_y, FACE, "forged", em, seed=100 + GLYPH_CHARS.index(ch), face_only=True, grain=0))
            # the under layer: a ROUND outline from the distance to the glyph (antialiased over one final
            # pixel), over a soft offset shadow
            M = A(mask)
            dist = ndi.distance_transform_edt(M < 0.5).astype(np.float32)
            outline = np.maximum(np.clip((LABEL_OUTLINE * cap_ss - dist) / ss + 0.5, 0, 1), M)
            sh = ndi.shift(outline, (LABEL_SHADOW["dy"] * cap_ss, LABEL_SHADOW["dx"] * cap_ss), order=1, mode="constant")
            sh = ndi.gaussian_filter(sh, LABEL_SHADOW["blur"] * cap_ss)
            under = np.zeros(face_img.shape, np.float32)
            under = over(under, (0, 0, 0), sh * LABEL_SHADOW["alpha"])
            under = over(under, np.array(LABEL_OUTLINE_RGB, np.float32) / 255, outline * 0.96)
            row = [adv]
            for suffix, arr in (("", face_img), ("_u", under)):
                small = to_image(reduce_rgba(arr, ss))
                box = small.split()[3].point(lambda v: 255 if v > 2 else 0).getbbox()
                # one clear pixel all round, so bilinear sampling at the frame edge reads transparent
                box = (max(0, box[0] - 1), max(0, box[1] - 1), min(small.width, box[2] + 1), min(small.height, box[3] + 1))
                tiles.append((f"{LABEL_PREFIX}{cap}_{ord(ch):04x}{suffix}", small.crop(box)))
                row += [box[0] - ox // ss, box[1] - base_y // ss, box[2] - box[0], box[3] - box[1]]
            table[ch].append(row)
        digit_adv.append(max(table[d][-1][0] for d in "0123456789"))
        for (a, b), v in rak.kern.items():
            if a in FALLBACK_CHARS or b in FALLBACK_CHARS or a not in LABEL_CHARS or b not in LABEL_CHARS:
                continue
            kerns.setdefault(a + b, [0] * len(LABEL_CAPS))[ci] = int(round(v / ss))
        # shelf pack, tallest first, into the narrowest power-of-two width that is no taller than wide
        order = sorted(tiles, key=lambda t: -t[1].height)
        gap = 1
        for W in (256, 512, 1024, 2048):
            x, y, row_h, place = gap, gap, 0, {}
            for nm, im in order:
                if x + im.width + gap > W:
                    x, y, row_h = gap, y + row_h + gap, 0
                place[nm] = (x, y)
                x += im.width + gap
                row_h = max(row_h, im.height)
            H = y + row_h + gap
            if H <= W:
                break
        sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        frames = {}
        for nm, im in order:
            px, py = place[nm]
            sheet.paste(im, (px, py))
            frames[nm] = {"frame": {"x": px, "y": py, "w": im.width, "h": im.height}}
        webp = out / f"label-glyphs-{cap}.webp"
        sheet.save(webp, "WEBP", **LABEL_WEBP)
        meta = {"image": webp.name, "format": "RGBA8888", "size": {"w": W, "h": H}, "scale": "1", "pngHash": hashlib.md5(webp.read_bytes()).hexdigest()[:8]}
        js = out / f"label-glyphs-{cap}.json"
        js.write_text(json.dumps({"frames": dict(sorted(frames.items())), "meta": meta}, separators=(",", ":")) + "\n")
        report.append(f"cap {cap}: {W}x{H}, {len(frames)} frames, webp {webp.stat().st_size} B + json {js.stat().st_size} B")
    kerns = {k: v for k, v in kerns.items() if any(v)}
    if ts_out:
        esc = lambda s: s.replace("\\", "\\\\").replace("'", "\\'")  # noqa: E731
        lines = [
            "// AUTO-GENERATED by apps/manticore_mayhem/tools/build_plaque_text.py --labels (do not edit: rerun the tool).",
            "// THE CLUSTER LABELS' GLYPHS: the plaque's forged Rakkas face baked at the sizes the labels are drawn.",
            "// LABEL_CAPS: the baked cap heights in canvas pixels, one atlas each (static/assets/ui/labels/",
            "// label-glyphs-<cap>.json). Per character, one row per cap:",
            "//   [advance, faceX, faceY, faceW, faceH, underX, underY, underW, underH]   (a space: [advance])",
            "// all WHOLE pixels of that size, x from the pen origin, y from the baseline (negative = above it).",
            "// Frames: `<LABEL_PREFIX><cap>_<hex code point>` is the face (tint it), the same name + `_u` the dark",
            "// outline and soft shadow under it (never tinted).",
            "// LABEL_KERN: pair kerning per cap (pixels), proportional rows only; LABEL_DIGIT_ADV: the tabular digit advance.",
            f"export const LABEL_PREFIX = '{LABEL_PREFIX}';",
            f"export const LABEL_CAPS = {json.dumps(LABEL_CAPS)} as const;",
            f"export const LABEL_DIGIT_ADV = {json.dumps(digit_adv)} as const;",
            "export const LABEL_GLYPHS: Record<string, readonly (readonly number[])[]> = {",
        ]
        for ch in LABEL_CHARS:
            lines.append(f"\t'{esc(ch)}': {json.dumps(table[ch], separators=(',', ':'))},")
        lines += ["};", "export const LABEL_KERN: Record<string, readonly number[]> = {"]
        for k, v in sorted(kerns.items()):
            lines.append(f"\t'{esc(k)}': {json.dumps(v, separators=(',', ':'))},")
        lines += ["};", ""]
        ts_out.write_text("\n".join(lines))
    print("label atlases:\n  " + "\n  ".join(report) + f"\n  {len(LABEL_CHARS) - 1} glyphs, {len(kerns)} kern pairs")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, help="the plaque's titles, glyph atlas and plaque-text.json (an intermediate folder)")
    ap.add_argument("--labels", type=Path, help="write ONLY the cluster labels' small atlases (label-glyphs-<cap>.webp / .json) here")
    ap.add_argument("--labels-ts", type=Path, help="with --labels: write the metrics module here (src/game/labelGlyphs.ts)")
    args = ap.parse_args()
    if args.labels:
        build_labels(args.labels, args.labels_ts)
    if not args.out:
        if not args.labels:
            ap.error("--out or --labels is required")
        return
    args.out.mkdir(parents=True, exist_ok=True)
    data = {"titles": build_titles(args.out), "text": build_glyphs(args.out), "copy": {"intro": INTRO_COPY, "wrap": WRAP_COPY}, "layout": LAYOUT}
    (args.out / "plaque-text.json").write_text(json.dumps(data, indent="\t", ensure_ascii=False))
    print("titles:", ", ".join(f"{k} {v['w']}x{v['h']}" for k, v in data["titles"].items()))


if __name__ == "__main__":
    main()
