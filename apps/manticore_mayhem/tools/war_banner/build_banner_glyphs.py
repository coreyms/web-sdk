#!/usr/bin/env python
"""THE WAR STANDARD BANNER'S OWN AMOUNT GLYPHS (Fix 2, 2026-11-15; Corey on his iPhone: "The Win amount this large
looks soft compared to the other lettering").

The banner's live spin count and TOTAL WIN amount were drawn from the plaque's glyph atlas (stinger-glyphs, cap 128;
the phone tier's cap 85), up to about 2x upscaled on a 3x phone and 1.8x on a 2x desktop. This atlas holds ONLY the
glyphs a count or an amount can show (digits, separators, every mark of utils-shared/amount.ts and an unknown
currency's upper case code), the same forged Rakkas (tools/build_plaque_text.py metal(), Noto Serif for the nine marks
Rakkas lacks), rendered 4x and reduced, at the density of its largest draw:

  class  digits cap   others cap   largest draw it covers
  P      214 px       186 px       the largest P draw at resolution 3: the class ends where the cloth is 420 CSS px wide
                                   (frontScale 0.7047), so the count's cap is at most 71.1 CSS px (213.3 device px) and the
                                   amount's 61.9 (185.8). Was 174 / 151 (the 390 portrait's 3.2x) until 2026-11-15: the
                                   count was upscaled 1.05x on a 440 x 956 iPhone and 1.11x in its landscape (Corey's
                                   iPhone: "the number 8/10 here on the intro screen banners is also blurry")
  D      280 px       224 px       2 px per CSS px on a 1920 x 1080 desktop (count 140 CSS px, amount 112)

Digits are larger than the rest because only they appear in the spin count (cap 105 design px against the amount's 84).
FRAMES KEEP THE PLAQUE'S METRICS: every frame is the plaque glyph's own padded cell (stinger.json text.glyphs: adv, ox,
oy, w, h in em 192 px) at a higher resolution, under the same frame name, so the game lays out with the same
PlaqueFont and only swaps the texture (game/banner/view.ts). The IN n FREE SPINS line stays on the plaque's atlas (its
cap is 22 design px: the plaque's atlas is already larger than it is drawn).

THE LOOK (COUNT 3, 2026-11-15; Corey on his iPhone 17 Pro: "the number 8/10 here on the intro screen banners is also
blurry", then "Count 3"). Until then these glyphs used the plaque's forged look (build_plaque_text.metal "forged"):
a 0.036 em linear bevel ramp from the ivory face into the bronze wall, inside a 0.034 em soft shadow, a 7.4 to 7.8
device px edge on the count at 402 x 874 at resolution 3 against the baked title's 1.8 to 2.2. LOOKS holds both
looks by name: "forged_c2506b9" (the old numbers, byte for byte the old sheets) and "count3" (the investigation's
option 3, images/war_banner_2026-11-13/count_17pro_2026-11-15/NOTES.md: shadow halved, bevel cut to a third with its
height smoothing, and a crisp near black keyline 0.009 em hugging the letter inside the brown edge ring; count edge
about 2.9 device px there). Every length is in em, so both classes get the same look in proportion. The plaque's own
glyphs (stinger-glyphs) keep build_plaque_text.metal as it is.

Writes static/assets/ui/banner/banner-glyphs-{D,P}.{webp,json}.
Run: math-sdk/env/bin/python web-sdk/apps/manticore_mayhem/tools/war_banner/build_banner_glyphs.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from scipy import ndimage as ndi

HERE = Path(__file__).resolve().parent
TOOLS = HERE.parent
APP = TOOLS.parent
sys.path.insert(0, str(TOOLS))
import build_plaque_text as bpt  # noqa: E402
from build_stinger_assets import pack, resample  # noqa: E402

OUT = APP / "static" / "assets" / "ui" / "banner"
STINGER = APP / "static" / "assets" / "ui" / "stinger" / "stinger.json"

# what a count or an amount can show (utils-shared/amount.ts: digits, separators, every symbol in its table, an unknown
# currency's upper case CODE, GC / SC with its space; the label atlas's own list, LABEL_CHARS, less x and the times sign)
CHARS = "0123456789.,-/'ABCDEFGHIJKLMNOPQRSTUVWXYZhkprsz$€£¥₹₽₱₩₫₺₦₡₨₵₪łجم"
CAP = 128  # the plaque glyphs' cap in their em 192 px
CLASSES = {"D": {"digits": 280, "others": 224}, "P": {"digits": 214, "others": 186}}
SS = 4  # rendered at 4x the plaque's em, then reduced
QUALITY = 92

# the metal look, every length in em (sh_* drop shadow, edge_* the brown edge ring, bevel the face-to-wall band,
# hsmooth its height smoothing, key_* the near black keyline; key_op 0 = no keyline)
FORGED_C2506B9 = dict(sh_dx=0.019, sh_dy=0.034, sh_blur=0.034, sh_op=0.55, edge_r=0.019, edge_blur=0.005, edge_op=0.92,
                      edge_col=(34, 18, 6), bevel=0.036, hsmooth=0.009, key_r=0.0, key_blur=0.0, key_op=0.0, key_col=(8, 4, 2))
LOOKS = {
    # the plaque's forged look, shipped on these sheets until 2026-11-15 (web-sdk c2506b9)
    "forged_c2506b9": FORGED_C2506B9,
    # Count 3 (Corey's pick, 2026-11-15): shadow at half its blur and offset, bevel band at a third (0.036 to 0.012)
    # with its height smoothing (0.009 to 0.003), and a crisp near black keyline inside the brown edge ring
    "count3": dict(FORGED_C2506B9, sh_dx=0.0095, sh_dy=0.017, sh_blur=0.017, bevel=0.012, hsmooth=0.003,
                   key_r=0.009, key_blur=0.0015, key_op=1.0),
}
LOOK = "count3"


def metal(mask: Image.Image, top: int, bot: int, base, em: float, seed: int, P: dict, grain: float = 0.03) -> Image.Image:
    """build_plaque_text.metal(style "forged") with its numbers taken from P (LOOKS); with FORGED_C2506B9 it gives the
    same pixels as bpt.metal forged"""
    A = bpt.A
    w, h = mask.size
    M = A(mask)
    inside = M > 0.5
    rng = np.random.default_rng(seed)
    canvas = np.zeros((h, w, 4), np.float32)
    edge = bpt.dilate(mask, P["edge_r"] * em)
    sh = A(ImageChops.offset(edge, int(round(P["sh_dx"] * em)), int(round(P["sh_dy"] * em))).filter(ImageFilter.GaussianBlur(P["sh_blur"] * em)))
    canvas = bpt.over(canvas, (0, 0, 0), sh * P["sh_op"])
    canvas = bpt.over(canvas, tuple(c / 255 for c in P["edge_col"]), A(edge.filter(ImageFilter.GaussianBlur(P["edge_blur"] * em))) * P["edge_op"])
    if P["key_op"] > 0:
        key = bpt.dilate(mask, P["key_r"] * em)
        canvas = bpt.over(canvas, tuple(c / 255 for c in P["key_col"]), A(key.filter(ImageFilter.GaussianBlur(P["key_blur"] * em))) * P["key_op"])
    bevel = P["bevel"] * em
    dist = ndi.distance_transform_edt(inside).astype(np.float32)
    height = ndi.gaussian_filter(np.minimum(dist, bevel), P["hsmooth"] * em)
    gy, gx = np.gradient(height)
    n = np.stack([-gx, -gy, np.ones_like(gx)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    light = np.array([-0.45, -0.70, 0.55]); light /= np.linalg.norm(light)
    diff = np.clip((n * light).sum(-1), 0, 1)
    half = light + np.array([0, 0, 1.0]); half /= np.linalg.norm(half)
    spec = np.clip((n * half).sum(-1), 0, 1) ** 26
    ys = np.clip((np.arange(h) - top) / max(1, bot - top), 0, 1)[:, None]
    bc = np.array(base, np.float32) / 255.0
    wall = np.clip(1 - dist / bevel, 0, 1)
    env = np.interp(ys, [0, 1], [1.05, 0.86])
    face = bc * env[..., None] * (1 + rng.normal(0, 0.03, (h, w)) * (grain / 0.03))[..., None]
    walls = np.array([120, 70, 26], np.float32) / 255 * (0.35 + 1.1 * diff)[..., None] + spec[..., None] * 0.30
    col = face * (1 - wall[..., None]) + walls * wall[..., None]
    canvas = bpt.over(canvas, np.clip(col, 0, 1), M)
    return Image.fromarray((np.clip(canvas, 0, 1) * 255).astype(np.uint8), "RGBA")


def render_cells(P: dict) -> dict[str, np.ndarray]:
    """each glyph's padded cell (the plaque's metric box) at SS x the plaque's em, straight RGBA float"""
    T = json.loads(STINGER.read_text())["text"]
    assert T["em"] == bpt.GLYPH_EM and T["cap"] == CAP, (T["em"], T["cap"])
    em = bpt.GLYPH_EM * SS
    rak = bpt.Face(bpt.RAKKAS, em, bpt.GLYPH_CHARS)
    rb = rak.font.getbbox("0", anchor="ls")
    noto0 = bpt.Face(bpt.NOTO, em, "", axes=[900, 100])
    nb = noto0.font.getbbox("0", anchor="ls")
    noto = bpt.Face(bpt.NOTO, int(round(em * (rb[3] - rb[1]) / (nb[3] - nb[1]))), "", axes=[900, 100])
    pad = int(0.10 * em)
    cell_h = int(em * 1.45) + 2 * pad
    base_y = pad + int(em * 1.0)
    cap_top = base_y - int(rak.cap * em / rak.upm)
    cells = {}
    for ch in CHARS:
        g = T["glyphs"][ch]
        assert len(g) == 6, ch
        adv, ox, oy, w, h, name = g
        face = noto if ch in bpt.FALLBACK_CHARS else rak
        cw = int(face.advance(ch) + em * 0.6) + 2 * pad
        mask = Image.new("L", (cw, cell_h), 0)
        pen = pad + int(em * 0.3)
        ImageDraw.Draw(mask).text((pen, base_y), ch, font=face.font, fill=255, anchor="ls")
        if ch in bpt.FALLBACK_CHARS:
            mask = mask.filter(ImageFilter.GaussianBlur(0.012 * em)).point(lambda v: 255 if v > 88 else int(v * 255 / 88))
        img = metal(mask, cap_top, base_y, bpt.FACE, em, seed=100 + bpt.GLYPH_CHARS.index(ch), P=P)
        a = np.asarray(img, np.float32) / 255.0
        # the plaque's metric box at SS x: from (pen + ox, baseline + oy), w x h (its padded cell)
        x0, y0 = pen + ox * SS, base_y + oy * SS
        cell = np.zeros((h * SS, w * SS, 4), np.float32)
        sx0, sy0 = max(0, x0), max(0, y0)
        sx1, sy1 = min(a.shape[1], x0 + w * SS), min(a.shape[0], y0 + h * SS)
        cell[sy0 - y0 : sy1 - y0, sx0 - x0 : sx1 - x0] = a[sy0:sy1, sx0:sx1]
        # nothing of the glyph may fall outside its box (the plaque's own cell held it at 1x)
        outside = a[..., 3].sum() - a[sy0:sy1, sx0:sx1, 3].sum()
        assert outside < 0.02 * max(1.0, a[..., 3].sum()), (ch, outside)
        cells[ch] = (name, cell)
    return cells


def main() -> None:
    # LOOK=<name> OUT_DIR=<dir> build another look into another folder (a check: forged_c2506b9 rebuilds the old sheets)
    import os

    look = os.environ.get("LOOK", LOOK)
    out = Path(os.environ["OUT_DIR"]) if os.environ.get("OUT_DIR") else OUT
    cells = render_cells(LOOKS[look])
    T = json.loads(STINGER.read_text())["text"]
    out.mkdir(parents=True, exist_ok=True)
    for cls, caps in CLASSES.items():
        items = []
        for ch, (name, cell) in cells.items():
            k = (caps["digits"] if ch.isdigit() else caps["others"]) / CAP
            _, _, _, w, h, _ = T["glyphs"][ch]
            items.append((name, resample(cell, max(1, round(w * k)), max(1, round(h * k)))))
        sheet, frames = pack(items)
        stem = f"banner-glyphs-{cls}"
        img = Image.fromarray((np.clip(sheet, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
        path = out / f"{stem}.webp"
        img.save(path, "WEBP", quality=QUALITY, method=6, alpha_quality=100)
        meta = {"image": f"{stem}.webp", "format": "RGBA8888", "size": {"w": img.width, "h": img.height}, "scale": "1", "pngHash": hashlib.md5(path.read_bytes()).hexdigest()[:8], "caps": caps, "look": look}
        (out / f"{stem}.json").write_text(json.dumps({"frames": frames, "meta": meta}, indent=1) + "\n")
        gpu = img.width * img.height * 4
        print(f"{stem}: {img.width} x {img.height}, {len(items)} glyphs, {path.stat().st_size / 1024:.0f} KB webp, GPU {gpu / 1e6:.1f} MB ({gpu * 4 / 3 / 1e6:.1f} MB with mips)")


if __name__ == "__main__":
    main()
