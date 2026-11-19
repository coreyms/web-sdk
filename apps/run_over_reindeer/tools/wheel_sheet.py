"""THE SUPER WHEEL'S BUILD SHEET: one page of REAL captures from the built game (tools/wheel_probe.mjs with SHOTS=<dir>:
its `shots` section plays one forced Super round per layout at device pixel ratio 3, its `contact` section saves the
reindeer standing on the rim in four of his strides). Per layout: the emergence, the wheel at rest, the reindeer on the
rim, the first stop with its full-shape highlight, the inner ring's stop and the character landing, each scaled to one
row; under them the closeups at 3 physical px per CSS px, untouched: his feet on the rim (the live frame and four
strides) and the winner's wedge under the peg.

    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/wheel_sheet.py <shots dir> <out.png>
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(os.path.dirname(HERE), "static", "assets", "fonts", "overpass", "Overpass-bold.woff2")
LAYOUTS = [("desktop", "Desktop 1440 x 900"), ("upright", "Upright phone 390 x 844"), ("sideways", "Sideways phone 844 x 390"), ("popout", "Popout 400 x 225")]
STEPS = [("1_emerge0", "the red present's lid pops"), ("1_emerge1", "the wheel rises out of it"), ("1_emerge2", "it grows, the traffic drives out"), ("2_rest", "at rest: PRESS SPIN"), ("3_drive", "the reindeer drives the rim"), ("4_land", "spin one stops: the full wedge lit"), ("5_ring", "the ring stops on the column"), ("6_landed", "the character has landed: the first free spin drives in")]
DPR = 3
ROW_H = 380
MAX_W = 620
BG = (16, 18, 28)
INK = (236, 238, 245)
DIM = (150, 156, 175)


def font(size):
    return ImageFont.truetype(FONT, size)


def tile(path, label):
    im = Image.open(path).convert("RGB")
    k = min(ROW_H / im.height, MAX_W / im.width)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    out = Image.new("RGB", (im.width, ROW_H + 30), BG)
    out.paste(im, (0, 0))
    ImageDraw.Draw(out).text((2, ROW_H + 6), label, font=font(15), fill=DIM)
    return out


def crop_css(im, x, y, w, h, off=(0, 0), dpr=DPR):
    """a box given in CSS px of the page, cut from a capture at `dpr` px per CSS px (off: the capture's own corner in CSS
    px); a capture taken at less than 3 is brought to 3 so every closeup is at one size"""
    box = [round((x - off[0]) * dpr), round((y - off[1]) * dpr), round((x + w - off[0]) * dpr), round((y + h - off[1]) * dpr)]
    box[0], box[1] = max(0, box[0]), max(0, box[1])
    box[2], box[3] = min(im.width, box[2]), min(im.height, box[3])
    out = im.crop(box)
    if dpr != DPR:
        out = out.resize((round(out.width * DPR / dpr), round(out.height * DPR / dpr)), Image.LANCZOS)
    return out


def labelled(im, label):
    out = Image.new("RGB", (max(im.width, 10), im.height + 30), BG)
    out.paste(im, (0, 0))
    ImageDraw.Draw(out).text((2, im.height + 6), label, font=font(15), fill=DIM)
    return out


def row(tiles, gap=14):
    w = sum(t.width for t in tiles) + gap * (len(tiles) - 1)
    h = max(t.height for t in tiles)
    out = Image.new("RGB", (max(w, 10), h), BG)
    x = 0
    for t in tiles:
        out.paste(t, (x, 0))
        x += t.width + gap
    return out


def main():
    shots, dest = sys.argv[1], sys.argv[2]
    blocks = []
    for key, title in LAYOUTS:
        if not os.path.exists(os.path.join(shots, f"{key}_2_rest.json")):
            continue
        rest = json.load(open(os.path.join(shots, f"{key}_2_rest.json")))
        g = rest["geo"]
        R = g["d"] / 2
        head = Image.new("RGB", (1200, 44), BG)
        ImageDraw.Draw(head).text((0, 8), f"{title}: a {g['d']:.0f} CSS px wheel (book: {rest['plan']['real']['tier']} {rest['plan']['real']['m']}x, column {rest['plan']['real']['reel'] + 1})", font=font(24), fill=INK)
        tiles = [tile(os.path.join(shots, f"{key}_{name}.png"), label) for name, label in STEPS if os.path.exists(os.path.join(shots, f"{key}_{name}.png"))]
        # the closeups, at the capture's own pixels (3 per CSS px)
        closes = []
        a = math.radians(-40)
        fx, fy = g["cx"] + math.sin(a) * R, g["cy"] - math.cos(a) * R
        side = max(70, 0.42 * g["d"])
        drive = os.path.join(shots, f"{key}_3_drive.png")
        if os.path.exists(drive):
            im = Image.open(drive).convert("RGB")
            closes.append(labelled(crop_css(im, fx - side * 0.62, fy - side * 0.66, side, side * 0.9), "3x: his feet on the rim, the live frame"))
        cj = os.path.join(shots, f"{key}_contact.json")
        if os.path.exists(cj):
            c = json.load(open(cj))
            for stride in (1, 4, 8, 13):
                f = os.path.join(shots, f"{key}_contact_{stride:02d}.png")
                if os.path.exists(f):
                    im = Image.open(f).convert("RGB")
                    closes.append(labelled(crop_css(im, fx - side * 0.62, fy - side * 0.66, side, side * 0.9, (c["clip"]["x"], c["clip"]["y"]), c.get("DPR", DPR)), f"3x: stride {stride} standing on the rim" + ("" if c.get("DPR", DPR) == DPR else f" (captured at {c['DPR']}x, the desktop game's own density)")))
        land = os.path.join(shots, f"{key}_4_land.png")
        if os.path.exists(land):
            im = Image.open(land).convert("RGB")
            closes.append(labelled(crop_css(im, g["cx"] - 0.3 * g["d"], g["cy"] - R - 0.13 * g["d"], 0.6 * g["d"], 0.62 * g["d"]), "3x: the first stop, the winner's full wedge lit under the lights"))
        ring = os.path.join(shots, f"{key}_5_ring.png")
        if os.path.exists(ring):
            im = Image.open(ring).convert("RGB")
            closes.append(labelled(crop_css(im, g["cx"] - 0.26 * g["d"], g["cy"] - 0.27 * g["d"], 0.52 * g["d"], 0.5 * g["d"]), "3x: the ring's stop"))
        blocks += [head, row(tiles)]
        # the closeups in rows no wider than the steps' row
        limit = max(2400, blocks[-1].width)
        line = []
        for c in closes:
            if line and sum(t.width for t in line) + 14 * len(line) + c.width > limit:
                blocks.append(row(line))
                line = []
            line.append(c)
        if line:
            blocks.append(row(line))
    title = Image.new("RGB", (2400, 64), BG)
    ImageDraw.Draw(title).text((0, 10), "Run Over Reindeer: the Super wheel as built (real captures from the game, device pixel ratio 3)", font=font(32), fill=(255, 210, 31))
    blocks.insert(0, title)
    W = max(b.width for b in blocks) + 48
    H = sum(b.height for b in blocks) + 22 * len(blocks) + 48
    sheet = Image.new("RGB", (W, H), BG)
    y = 24
    for b in blocks:
        sheet.paste(b, (24, y))
        y += b.height + 22
    sheet.save(dest, optimize=True)
    print(dest, sheet.size, f"{os.path.getsize(dest) / 1048576:.1f} MB")


if __name__ == "__main__":
    main()
