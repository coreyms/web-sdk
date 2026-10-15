#!/usr/bin/env python
"""THE MAX WIN SCREEN'S OWN TYPE (Corey 2026-10-15, components/MaxWinCinematic.svelte).

The win plaque's two looks (tools/build_plaque_text.py), baked BIG enough to fill a screen, since the plaque's
own atlases are cut for a plaque (its MAX WIN title is 528 px wide, its digits 84 px tall):
  titles   Macondo Swash Caps, POLISHED GOLD with the additive ember halo: MAYHEM, UNLEASHED, MAX WIN
  glyphs   Rakkas, FORGED: what an amount and a multiple can show (build_plaque_text.LABEL_CHARS: every currency
           mark of utils-shared/amount.ts, an unknown currency's upper case code, digits, separators and "x")

One atlas per asset tier (full; -half for the phone tier), each json carrying the metrics in its meta.text in the
shape game/stinger/text.ts PlaqueFont and game/stinger/plaqueText.ts PlaqueTitle read (FULL tier px; the game sizes
every sprite with setSize, so the half tier's frames simply draw the same boxes at half the texels).

Run (from the parent repo):
  math-sdk/env/bin/python web-sdk/apps/manticore_mayhem/tools/build_maxwin_assets.py
then `node scripts/stamp-assets.mjs` in the app (it hashes every file under static/assets).
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
APP = HERE.parent
# build_plaque_text imports the parent repo's tools/build_stencil_atlas.py (kern_pairs). In a git worktree of
# web-sdk the parent repo is not three folders up: STAKE_ENGINE names it then.
for root in (HERE.parents[3], Path(os.environ.get("STAKE_ENGINE", "/Users/corey/Projects/stake-engine"))):
    if (root / "tools" / "build_stencil_atlas.py").exists():
        sys.path.insert(0, str(root / "tools"))
        break
sys.path.insert(0, str(HERE))
import build_plaque_text as bpt  # noqa: E402

OUT = APP / "static" / "assets" / "ui" / "maxwin"

# Title em in FULL tier px: MAX WIN's cap is then about 228 px, what the desktop slot draws on a 1440 x 900 window at
# the renderer's resolution 2 (MAX_WIN.layout.landscape.maxCap 104 master px x 1.125 x 2 = 234). Bigger windows
# upscale a little; the half tier (phones, resolution cap 1.5) has room to spare.
TITLE_EM = 330
GLYPH_EM = 240  # the amount's cap about 160 px full tier
# name -> (text, base gold, ember halo strength). MAX WIN is the plaque's own win_max recipe.
TITLES = {
    "mw_mayhem": ("MAYHEM", (242, 194, 92), 0.42),
    "mw_unleashed": ("UNLEASHED", (242, 194, 92), 0.42),
    "mw_max": ("MAX WIN", (250, 214, 120), 0.5),
}
GLYPH_CHARS = bpt.LABEL_CHARS
TIERS = {"": 1.0, "-half": 0.5}
QUALITY = 90
PAD = 2


def bake_titles():
    face = bpt.Face(bpt.MACONDO, TITLE_EM, "".join(sorted({c for t, _, _ in TITLES.values() for c in t})))
    pad = int(0.16 * TITLE_EM)
    asc = int(TITLE_EM * 1.05)
    items, meta = [], {}
    for name, (text, base, ember) in TITLES.items():
        run = bpt.layout(face, text, bpt.TITLE_NUDGE)
        w, h = int(run[-1][1]) + 2 * pad, int(TITLE_EM * 1.5) + 2 * pad
        mask = Image.new("L", (w, h), 0)
        d = ImageDraw.Draw(mask)
        base_y = pad + asc
        for ch, x in run[:-1]:
            d.text((pad + x, base_y), ch, font=face.font, fill=255, anchor="ls")
        cap_top = base_y - int(face.cap * TITLE_EM / face.upm)
        img = bpt.metal(mask, cap_top, base_y, base, "polished", TITLE_EM)
        box = img.getbbox()
        img = img.crop(box)
        items.append((name, img, 1.0))
        meta[name] = {"frame": name, "text": text, "w": img.width, "h": img.height, "baseline": base_y - box[1], "cap": base_y - cap_top}
        if ember:
            gp = int(0.45 * TITLE_EM)
            big = Image.new("L", (w + 2 * gp, h + 2 * gp), 0)
            big.paste(bpt.dilate(mask, 0.03 * TITLE_EM), (gp, gp))
            glow = big.filter(ImageFilter.GaussianBlur(0.1 * TITLE_EM))
            gbox = glow.point(lambda v: 255 if v > 1 else 0).getbbox()
            g = Image.new("RGBA", glow.size, (255, 255, 255, 0))
            g.putalpha(glow)
            g = g.crop(gbox)
            # a soft halo: stored at half scale, drawn at its full box (as the plaque's own glows)
            items.append((f"{name}_glow", g, 0.5))
            meta[name]["glow"] = {"tint": "#ff5214", "alpha": ember, "dx": gbox[0] - gp - box[0], "dy": gbox[1] - gp - box[1], "w": g.width, "h": g.height}
    return items, meta


def bake_glyphs():
    rak = bpt.Face(bpt.RAKKAS, GLYPH_EM, GLYPH_CHARS)
    noto = bpt.Face(bpt.NOTO, GLYPH_EM, "", axes=[900, 100])
    rb, nb = rak.font.getbbox("0", anchor="ls"), noto.font.getbbox("0", anchor="ls")
    nscale = (rb[3] - rb[1]) / (nb[3] - nb[1])
    noto = bpt.Face(bpt.NOTO, int(round(GLYPH_EM * nscale)), "", axes=[900, 100])
    pad = int(0.10 * GLYPH_EM)
    cell_h = int(GLYPH_EM * 1.45) + 2 * pad
    base_y = pad + int(GLYPH_EM * 1.0)
    cap_top = base_y - int(rak.cap * GLYPH_EM / rak.upm)
    items, glyphs = [], {}
    for i, ch in enumerate(GLYPH_CHARS):
        face = noto if ch in bpt.FALLBACK_CHARS else rak
        adv = face.advance(ch)
        if ch == " ":
            glyphs[ch] = [round(adv, 2)]
            continue
        w = int(adv + GLYPH_EM * 0.6) + 2 * pad
        mask = Image.new("L", (w, cell_h), 0)
        ox = pad + int(GLYPH_EM * 0.3)
        ImageDraw.Draw(mask).text((ox, base_y), ch, font=face.font, fill=255, anchor="ls")
        if ch in bpt.FALLBACK_CHARS:
            mask = mask.filter(ImageFilter.GaussianBlur(0.012 * GLYPH_EM)).point(lambda v: 255 if v > 88 else int(v * 255 / 88))
        img = bpt.metal(mask, cap_top, base_y, bpt.FACE, "forged", GLYPH_EM, seed=100 + i)
        box = img.getbbox()
        if not box:
            continue
        img = img.crop(box)
        name = f"mw_g_{ord(ch):04x}"
        items.append((name, img, 1.0))
        glyphs[ch] = [round(adv, 2), box[0] - ox, box[1] - base_y, img.width, img.height, name]
    kern = {a + b: round(v, 2) for (a, b), v in rak.kern.items() if a not in bpt.FALLBACK_CHARS and b not in bpt.FALLBACK_CHARS}
    return items, {"em": GLYPH_EM, "cap": base_y - cap_top, "glyphs": glyphs, "kern": kern}


def shelf(items: list[tuple[str, Image.Image]]):
    """tallest first, rows across the narrowest width that keeps the sheet under 4096 on both sides and near square"""
    order = sorted(items, key=lambda it: (-it[1].height, -it[1].width))
    widest = max(im.width for _, im in items) + 2 * PAD
    area = sum((im.width + 2 * PAD) * (im.height + 2 * PAD) for _, im in items)
    best = None
    for W in range(max(widest, 256), 4097, 64):
        x = y = row = 0
        place = {}
        for name, im in order:
            w, h = im.width + 2 * PAD, im.height + 2 * PAD
            if x + w > W:
                x, y, row = 0, y + row, 0
            place[name] = (x + PAD, y + PAD)
            x += w
            row = max(row, h)
        H = y + row
        key = (max(W, H) > 4096, W * H, abs(W - H))
        if best is None or key < best[0]:
            best = (key, W, H, place)
    _, W, H, place = best
    sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    frames = {}
    for name, im in items:
        x, y = place[name]
        sheet.paste(im, (x, y))
        frames[name] = {"frame": {"x": x, "y": y, "w": im.width, "h": im.height}, "rotated": False, "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": im.width, "h": im.height}, "sourceSize": {"w": im.width, "h": im.height}}
    return sheet, frames, area / (W * H)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    titles, tmeta = bake_titles()
    glyph_items, text = bake_glyphs()
    text["titles"] = tmeta
    for suffix, k in TIERS.items():
        items = []
        for name, im, own in titles + glyph_items:
            f = k * own
            items.append((name, im if f == 1 else im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)))
        sheet, frames, fill = shelf(items)
        name = f"maxwin{suffix}"
        path = OUT / f"{name}.webp"
        sheet.save(path, "WEBP", quality=QUALITY, method=6, alpha_quality=100)
        meta = {"image": f"{name}.webp", "format": "RGBA8888", "size": {"w": sheet.width, "h": sheet.height}, "scale": "1", "pngHash": hashlib.md5(path.read_bytes()).hexdigest()[:8], "text": text}
        (OUT / f"{name}.json").write_text(json.dumps({"frames": frames, "meta": meta}, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(f"{name}: {sheet.width}x{sheet.height} ({sheet.width * sheet.height * 4 / 1048576:.1f} MB on the GPU, fill {fill:.0%}), {path.stat().st_size / 1024:.0f} KB")
    print("titles:", ", ".join(f"{k} {v['w']}x{v['h']} cap {v['cap']}" for k, v in tmeta.items()), f"| glyphs: {len(glyph_items)}, cap {text['cap']}")


if __name__ == "__main__":
    main()
