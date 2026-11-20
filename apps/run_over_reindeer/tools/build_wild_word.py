"""Bake the Grandma Wild's WILD word, treatment B "Candy Cane" (Corey's pick from the WILD word mock, 2026-11-20:
Desktop/Run Over Reindeer/wild_word_r1_2026-11-19, index.html treatment B; its tools/bake_words.py candy_render).

Run with the math env's Python:
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_wild_word.py
Then `node scripts/stamp-assets.mjs` (pnpm dev and pnpm build run it for you).

THE ART is the mock's own recipe, unchanged: the multiplier's candy lettering (tools/build_wild_mult.py, imported read
only: Sigmar, the thick ink outline, the candy stripes) in the Reindeer set's reds (200, 20, 40) / (240, 92, 108), one
sprite per letter W I L D, plus each letter's face as a white silhouette (the sweep of light; bwm.style_sheen, at the
multiplier's own SHEEN_DENSITY). No image generation; nothing redrawn by hand. The mock baked its letters at a 56 road
px capital (its stamp treatment's size); B draws them at 0.46 of that (a 25.8 road px capital, tilted 8 degrees into
the top left corner) and drops them in from 1.8x at the landing. So they are baked here at the LARGEST DRAW: 1.8 x 0.46
x 56 = 46.4 road px capital, at the house density (3 px per CSS px at the largest draw: 3.2 atlas px per road px on
the desktop tier, 1.2 on the phone tier, tools/build_wild_mult.py DENSITY).

Writes:
  static/assets/wild/wild-word-full.webp, wild-word-phone.webp   one small atlas per tier
  src/game/wildWordSpec.ts                                       the frames and each letter's size and advance (road px
                                                                 at the bake's capital), generated
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import build_wild_mult as bwm  # noqa: E402  (the multiplier's own candy recipe, read only)

OUT = os.path.join(APP, "static", "assets", "wild")
SPEC_PATH = os.path.join(APP, "src", "game", "wildWordSpec.ts")
DENSITY = dict(bwm.DENSITY)  # full 3.2, phone 1.2 atlas px per road px
SS = 4
REST_SIZE = 0.46  # the mock's B default size, of its 56 road px capital
MOCK_CAP = 56.0
DROP_FROM = 1.8  # the mock's appear starts its letters at 1.8x
BAKE_CAP = round(MOCK_CAP * REST_SIZE * DROP_FROM, 3)
COLORS = ((200, 20, 40), (240, 92, 108))  # the Reindeer set's candy reds (the mock's candy_render default)
GAP = 2
WEBP = dict(quality=90, alpha_quality=90, method=6)


def candy_render(sheen=False):
    """the mock's tools/bake_words.py candy_render, with its capital as BAKE_CAP"""

    def render(k, ch):
        pen = bwm.Pen(k / SS * BAKE_CAP / bwm.CAP)
        f0 = ImageFont.truetype(bwm.FONT, 400)
        bH = f0.getbbox("H")
        f = ImageFont.truetype(bwm.FONT, max(4, round(bwm.CAP * pen.big / ((bH[3] - bH[1]) / 400))))
        st = pen.R(bwm.STROKE)
        pad = pen.R(bwm.PAD)
        probe = ImageDraw.Draw(Image.new("L", (8, 8)))
        b = probe.textbbox((0, 0), ch, font=f, stroke_width=st)
        top_b = probe.textbbox((0, 0), "WILD", font=f, stroke_width=st)
        w = b[2] - b[0] + 2 * pad
        h = top_b[3] - top_b[1] + 2 * pad
        fm = Image.new("L", (w, h), 0)
        ImageDraw.Draw(fm).text((pad - b[0], pad - top_b[1]), ch, font=f, fill=255)
        sm = Image.new("L", (w, h), 0)
        ImageDraw.Draw(sm).text((pad - b[0], pad - top_b[1]), ch, font=f, fill=255, stroke_width=st, stroke_fill=255)
        fmA = np.asarray(fm).astype(np.float32) / 255
        smA = np.asarray(sm).astype(np.float32) / 255
        arr = bwm.style_sheen(pen, fmA, smA) if sheen else bwm.style_candy(pen, {"stripes": COLORS}, fmA, smA)
        scale = k / (pen.big * bwm.CAP / BAKE_CAP)
        im = Image.fromarray(np.clip(np.round(arr * 255), 0, 255).astype(np.uint8), "RGBA")
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
        adv_road = (b[2] - b[0]) / pen.big * BAKE_CAP / bwm.CAP - bwm.TUCK * BAKE_CAP / bwm.CAP
        return np.asarray(im).astype(np.float32) / 255, adv_road

    return render


def bake(render, dens):
    """each letter at `dens` atlas px per road px: (images, letters {w, h, adv} road px)"""
    k = dens * SS
    ims, letters = {}, {}
    for ch in "WILD":
        arr, adv = render(k, ch)
        h, w = arr.shape[:2]
        im = Image.fromarray(np.clip(np.round(arr * 255), 0, 255).astype(np.uint8), "RGBA")
        ims[ch] = im.resize((max(1, round(w / SS)), max(1, round(h / SS))), Image.LANCZOS)
        letters[ch] = {"w": round(w / k, 3), "h": round(h / k, 3), "adv": round(adv, 3)}
    return ims, letters


def main():
    os.makedirs(OUT, exist_ok=True)
    spec = {"cap": BAKE_CAP, "mockCap": MOCK_CAP, "colors": COLORS, "letters": None, "tiers": {}}
    for tier, dens in DENSITY.items():
        face, letters = bake(candy_render(), dens)
        sheen, _ = bake(candy_render(sheen=True), dens * bwm.SHEEN_DENSITY)
        spec["letters"] = spec["letters"] or letters
        # one row of the four letters, then one row of their sheens
        pieces = [(f"candy_{c}", face[c]) for c in "WILD"] + [(f"sheen_{c}", sheen[c]) for c in "WILD"]
        row1 = sum(face[c].width for c in "WILD") + GAP * 3
        row2 = sum(sheen[c].width for c in "WILD") + GAP * 3
        h1 = max(face[c].height for c in "WILD")
        h2 = max(sheen[c].height for c in "WILD")
        sheet = Image.new("RGBA", (max(row1, row2), h1 + GAP + h2), (0, 0, 0, 0))
        frames = {}
        x, y = 0, 0
        for name, im in pieces:
            if name == "sheen_W":
                x, y = 0, h1 + GAP
            sheet.paste(im, (x, y))
            frames[name] = [x, y, im.width, im.height]
            x += im.width + GAP
        file = f"wild/wild-word-{tier}.webp"
        path = os.path.join(APP, "static", "assets", file)
        sheet.save(path, **WEBP)
        spec["tiers"][tier] = {"file": file, "width": sheet.width, "height": sheet.height, "density": dens, "sheenDensity": dens * bwm.SHEEN_DENSITY, "frames": frames, "kb": round(os.path.getsize(path) / 1024, 1), "gpuMb": round(sheet.width * sheet.height * 4 / 1048576, 3)}
        print(tier, sheet.size, spec["tiers"][tier]["kb"], "KB", spec["tiers"][tier]["gpuMb"], "MB")
    with open(SPEC_PATH, "w") as fh:
        fh.write("// AUTO-GENERATED by tools/build_wild_word.py (the WILD word mock's treatment B, the multiplier's candy recipe). Do\n")
        fh.write("// not edit: change the tool and run it again. letters: road px at the bake's capital `cap`; frames: atlas px.\n")
        fh.write(f"export const WILD_WORD_ART = {json.dumps(spec, indent=chr(9))} as const;\n")
    print("wrote", SPEC_PATH)


if __name__ == "__main__":
    main()
