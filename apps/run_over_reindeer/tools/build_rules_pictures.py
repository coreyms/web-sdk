"""THE RULES PAGE'S VEHICLE PICTURES WITH THEIR RIDERS (2026-11-16): Grandma's car (H1) with Grandma seated, the station
wagon (H2) with its Christmas tree, rail and ropes, Santa's sleigh (W) with Santa seated, as the board draws them at rest.

Run with the math env's Python (Pillow, numpy, scipy), AFTER tools/build_assets.py (it writes every rules page picture,
these three empty), tools/build_seated.py and tools/build_wagon_tree.py:
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_rules_pictures.py [--out <dir>]

It READS only the game's own built art: the desktop symbol atlas (static/assets/symbols/symbols.webp, the vehicle
sprite), the desktop rider sheets (static/assets/riders/seated.webp, wagon-tree.webp) and the placements the game draws
them by (src/game/seatedSpec.ts, wagonTreeSpec.ts, roadArtSpec.ts, constants SEATED.place at its defaults). All of it is
at 3.2 px per road px; the riders are placed on the vehicle at that density (bilinear, premultiplied), in the game's
order: the vehicle sprite, then the driver and the front layer (the near door, the sleigh's near wall), or the tree, the
front rail and the ropes. At rest: no lean, no bob, no bend.
It WRITES static/assets/symbols/single/{H1_R,H2_R,W_R}.webp (or into --out): the right facing pictures the rules page
shows (ui/GameInfoModal.svelte pictureOf), at the same 2 px per road px and webp quality as tools/build_assets.py. The
canvas is the vehicle's own box, grown only where a rider reaches past it (Grandma's head, the tree's top), so the
vehicle draws at the same size in the page's square tile as before. The _L pictures are not on the page and stay as
build_assets.py made them.
"""
import argparse
import json
import math
import os

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
ASSETS = os.path.join(APP, "static", "assets")
GAME = os.path.join(APP, "src", "game")
DENS = 3.2  # px per road px of the desktop atlases
OUT_DENS = 2.0  # the rules page pictures' (tools/build_assets.py build_symbols)


def ts_json(name):
    src = open(os.path.join(GAME, name)).read()
    return json.loads(src[src.index("{"): src.rindex("}") + 1])


def sheet_frame(sheet_json, name):
    meta = json.load(open(os.path.join(ASSETS, sheet_json)))
    f = meta["frames"][name]["frame"]
    im = Image.open(os.path.join(os.path.dirname(os.path.join(ASSETS, sheet_json)), meta["meta"]["image"])).convert("RGBA")
    return np.asarray(im.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))).astype(np.float32) / 255.0


def draw(canvas, pic, x, y, w, h, origin, anchor=(0.0, 0.0), mirror=False):
    """`pic` drawn over `canvas` (straight alpha float RGBA): its anchor point at road (x, y), road size w x h, mirrored
    about its anchor; `origin` the canvas px of road (0, 0). Bilinear on premultiplied pixels."""
    H, W = canvas.shape[:2]
    ph, pw = pic.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    rx = (xx - origin[0]) / DENS - x  # road px from the anchor point
    ry = (yy - origin[1]) / DENS - y
    if mirror:
        rx = -rx
    sx = (rx / w + anchor[0]) * pw - 0.5
    sy = (ry / h + anchor[1]) * ph - 0.5
    pm = pic.copy()
    pm[..., :3] *= pm[..., 3:4]
    top = np.stack([ndimage.map_coordinates(pm[..., i], [sy, sx], order=1, mode="constant") for i in range(4)], -1)
    # straight over: out = top + bottom * (1 - a_top), in premultiplied terms
    bot = canvas.copy()
    bot[..., :3] *= bot[..., 3:4]
    out = top + bot * (1 - top[..., 3:4])
    a = np.clip(out[..., 3:4], 1e-6, 1)
    out[..., :3] = np.clip(out[..., :3] / a, 0, 1)
    out[..., 3] = np.clip(out[..., 3], 0, 1)
    return out


def resize(arr, scale):
    """tools/build_assets.py resize: premultiplied Lanczos, so no dark fringes"""
    h, w = arr.shape[:2]
    pm = arr.copy()
    pm[..., :3] *= pm[..., 3:4]
    im = Image.fromarray((pm * 255).round().astype(np.uint8), "RGBA").resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    out = np.asarray(im).astype(np.float32) / 255.0
    alpha = np.clip(out[..., 3:4], 1e-6, 1)
    out[..., :3] = np.clip(out[..., :3] / alpha, 0, 1)
    return Image.fromarray((out * 255).round().astype(np.uint8), "RGBA")


def layers(frame):
    """the layers over the vehicle sprite, in draw order: (picture, x, y, w, h, anchor, mirror), road px from the anchor"""
    if frame == "H2_R":
        t = ts_json("wagonTreeSpec.ts")["frames"][frame]["tiers"]["full"]
        return [(sheet_frame("riders/wagon-tree.json", f"{frame}_{k}"), t[k]["x"], t[k]["y"], t[k]["w"], t[k]["h"], (0, 0), False) for k in ("tree", "rail", "ropes")]
    S = ts_json("seatedSpec.ts")
    f = S["frames"][frame]
    c = S["characters"][f["character"]]
    ct = c["tiers"]["full"]
    k = f["height"] / c["height"]  # constants SEATED.place[frame].scale is 1 and its dx, dy 0 (checked by the game's probe)
    fb = f["tiers"]["full"]["front"]
    return [
        (sheet_frame("riders/seated.json", f"seat_{f['character']}"), f["at"][0], f["at"][1], ct["width"] * k, ct["height"] * k, tuple(ct["anchor"]), f["mirror"]),
        (sheet_frame("riders/seated.json", f"{frame}_front"), fb["x"], fb["y"], fb["w"], fb["h"], (0, 0), False),
    ]


def build(frame, out_dir):
    rw, rh = ts_json("roadArtSpec.ts")["symbols"][frame].values()
    car = sheet_frame("symbols/symbols.json", frame)
    L = layers(frame)
    # the canvas: the vehicle's box (anchor at its bottom centre), grown to every layer's box
    x0, y0, x1, y1 = -rw / 2, -rh, rw / 2, 0.0
    for pic, x, y, w, h, an, mir in L:
        lx = x - an[0] * w if not mir else x - (1 - an[0]) * w
        x0, y0, x1, y1 = min(x0, lx), min(y0, y - an[1] * h), max(x1, lx + w), max(y1, y + (1 - an[1]) * h)
    # whole output px on every side the vehicle's own box had (so the vehicle keeps its exact place in the old picture)
    grow = [math.ceil(((-rw / 2) - x0) * OUT_DENS - 1e-6), math.ceil(((-rh) - y0) * OUT_DENS - 1e-6), math.ceil((x1 - rw / 2) * OUT_DENS - 1e-6), math.ceil((y1 - 0) * OUT_DENS - 1e-6)]
    car_w, car_h = car.shape[1], car.shape[0]
    pad = [g / OUT_DENS * DENS for g in grow]  # in atlas px
    W = round(car_w + pad[0] + pad[2])
    H = round(car_h + pad[1] + pad[3])
    canvas = np.zeros((H, W, 4), np.float32)
    ox, oy = round(pad[0]), round(pad[1])
    canvas[oy: oy + car_h, ox: ox + car_w] = car
    # road (0, 0) is the sprite's anchor, its bottom centre, in canvas px
    origin = (ox + car_w / 2, oy + car_h)
    kx, ky = car_w / rw, car_h / rh
    assert abs(kx - DENS) < 0.02 and abs(ky - DENS) < 0.02, (frame, kx, ky)
    for pic, x, y, w, h, an, mir in L:
        canvas = draw(canvas, pic, x, y, w, h, origin, an, mir)
    small = resize(canvas, OUT_DENS / DENS)
    path = os.path.join(out_dir, f"{frame}.webp")
    small.save(path, quality=90, method=6)
    return path, small.size, grow


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ASSETS, "symbols", "single"))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    for frame in ("H1_R", "H2_R", "W_R"):
        path, size, grow = build(frame, args.out)
        print(f"  {frame}: {size[0]} x {size[1]} (grown left {grow[0]}, top {grow[1]}, right {grow[2]}, bottom {grow[3]} px past the vehicle) -> {os.path.relpath(path, APP)}")


if __name__ == "__main__":
    main()
