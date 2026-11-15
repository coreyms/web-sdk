#!/usr/bin/env python
"""THE WAR STANDARD BANNER'S OWN AMOUNT GLYPHS (Fix 2, 2026-11-15; Corey on his iPhone: "The Win amount this large
looks soft compared to the other lettering").

The banner's live spin count and TOTAL WIN amount were drawn from the plaque's glyph atlas (stinger-glyphs, cap 128;
the phone tier's cap 85), up to about 2x upscaled on a 3x phone and 1.8x on a 2x desktop. This atlas holds ONLY the
glyphs a count or an amount can show (digits, separators, every mark of utils-shared/amount.ts and an unknown
currency's upper case code), the same forged Rakkas (tools/build_plaque_text.py metal(), Noto Serif for the nine marks
Rakkas lacks), rendered 4x and reduced, at the density of its largest draw:

  class  digits cap   others cap   largest draw it covers
  P      174 px       151 px       the phone cloth's own density (1.72 texture px per design px: 3.2x of a 390 portrait)
  D      280 px       224 px       2 px per CSS px on a 1920 x 1080 desktop (count 140 CSS px, amount 112)

Digits are larger than the rest because only they appear in the spin count (cap 105 design px against the amount's 84).
FRAMES KEEP THE PLAQUE'S METRICS: every frame is the plaque glyph's own padded cell (stinger.json text.glyphs: adv, ox,
oy, w, h in em 192 px) at a higher resolution, under the same frame name, so the game lays out with the same
PlaqueFont and only swaps the texture (game/banner/view.ts). The IN n FREE SPINS line stays on the plaque's atlas (its
cap is 22 design px: the plaque's atlas is already larger than it is drawn).

Writes static/assets/ui/banner/banner-glyphs-{D,P}.{webp,json}.
Run: math-sdk/env/bin/python web-sdk/apps/manticore_mayhem/tools/war_banner/build_banner_glyphs.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

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
CLASSES = {"D": {"digits": 280, "others": 224}, "P": {"digits": 174, "others": 151}}
SS = 4  # rendered at 4x the plaque's em, then reduced
QUALITY = 92


def render_cells() -> dict[str, np.ndarray]:
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
        img = bpt.metal(mask, cap_top, base_y, bpt.FACE, "forged", em, seed=100 + bpt.GLYPH_CHARS.index(ch))
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
    cells = render_cells()
    T = json.loads(STINGER.read_text())["text"]
    OUT.mkdir(parents=True, exist_ok=True)
    for cls, caps in CLASSES.items():
        items = []
        for ch, (name, cell) in cells.items():
            k = (caps["digits"] if ch.isdigit() else caps["others"]) / CAP
            _, _, _, w, h, _ = T["glyphs"][ch]
            items.append((name, resample(cell, max(1, round(w * k)), max(1, round(h * k)))))
        sheet, frames = pack(items)
        stem = f"banner-glyphs-{cls}"
        img = Image.fromarray((np.clip(sheet, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
        path = OUT / f"{stem}.webp"
        img.save(path, "WEBP", quality=QUALITY, method=6, alpha_quality=100)
        meta = {"image": f"{stem}.webp", "format": "RGBA8888", "size": {"w": img.width, "h": img.height}, "scale": "1", "pngHash": hashlib.md5(path.read_bytes()).hexdigest()[:8], "caps": caps}
        (OUT / f"{stem}.json").write_text(json.dumps({"frames": frames, "meta": meta}, indent=1) + "\n")
        gpu = img.width * img.height * 4
        print(f"{stem}: {img.width} x {img.height}, {len(items)} glyphs, {path.stat().st_size / 1024:.0f} KB webp, GPU {gpu / 1e6:.1f} MB ({gpu * 4 / 3 / 1e6:.1f} MB with mips)")


if __name__ == "__main__":
    main()
