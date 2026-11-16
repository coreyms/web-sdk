"""THE CHRISTMAS TREE ON THE STATION WAGON (Corey 2026-11-16: "Yes this one looks good."; round 4 art,
~/Desktop/Run Over Reindeer/wagon_tree_r4_2026-11-15/, NOTES.md there). Packs the approved layers and measures what the game
bends them by.

Run with the math env's Python (Pillow, numpy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_wagon_tree.py

It READS the round's atlas_ready/ pictures (H2_{R,L}_{tree,rail,ropes}[_phone].png, already at the symbol atlas's density:
3.2 px per road px desktop, 1.2 phone, the 3 physical px per CSS px rule), their offsets (_outputs.json: each picture's top
left corner from the H2 anchor, road px), the rope positions (scripts/_build_params.json) and the H2 frames of the symbol
atlases. It WRITES static/assets/riders/wagon-tree.json + .webp (desktop), wagon-tree-phone.json + .webp, and
src/game/wagonTreeSpec.ts. The pictures are packed as they are: no resample, no edit.

Draw order over the wagon sprite (game/road/wagonTree.ts): the tree, the front rail, the ropes. The layer frame is the H2
frame raised about 4 road px (the round tree stands that much over the roof); the wagon's anchor and cell do not change.

THE BEND (no filter, shader or mask; the game has no mesh anywhere, so STRIPS): the tree picture is cut into vertical strips
whose edges fall exactly on each rope's margin (nothing moves under a rope), the tip run past the first rope in narrow
strips (its weight climbs as a power) and a few wider ones between the ropes. The game moves each strip EDGE by the two
springs times that edge's weight, and draws each strip as a sheared quad between its two edges (its left and right edges
meet its neighbours': no seams, no steps). Weights, from NOTES.md (car x in wheelbase units, ropes at -0.54, -0.26, 0.02,
0.30, a 0.02 margin each side of a rope):
  tip   0 up to the first rope's margin (+0.32), then ((x - 0.32) / (0.58 - 0.32)) ^ 2.2, 1 past the tip
  body  a half sine between each pair of ropes (0 at both, 1 midway); behind the last rope (the cut end) a small seesaw the
        other way, minus ((r0 - x) / (r0 - cut))^2
THE SHADOW: the wagon's cast shadow is a twin of its own picture (game/road/shadows.ts); the tree and its ropes rise above
it, so each direction gets the silhouette of the tree and ropes OUTSIDE the wagon's (their alpha less the wagon's), cast
with the wagon's twin: one shape, never doubled.
"""
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SYM = os.path.join(APP, "static", "assets", "symbols")
OUT = os.path.join(APP, "static", "assets", "riders")
ROUND = os.path.expanduser("~/Desktop/Run Over Reindeer/wagon_tree_r4_2026-11-15")
DENSITY = {"full": 3.2, "phone": 1.2}
LAYERS = ("tree", "rail", "ropes")
# the bend's numbers (NOTES.md, Motion): wheelbase units
ROPE_MARGIN = 0.02
X_TIP = 0.58
X_CUT = -0.84
TIP_POW = 2.2
# strips per run of the tree: behind the last rope, under each rope (one, still), between two ropes, past the first rope
STRIPS = {"back": 3, "between": 4, "tip": 9}


def road_size(frame):
    src = open(os.path.join(APP, "src", "game", "roadArtSpec.ts")).read()
    d = json.loads(src[src.index("{"): src.rindex("}") + 1])
    s = d["symbols"][frame]
    return s["width"], s["height"]


def atlas_frame(tier, frame):
    stem = "symbols" if tier == "full" else "symbols-phone"
    meta = json.load(open(os.path.join(SYM, stem + ".json")))
    f = meta["frames"][frame]["frame"]
    im = Image.open(os.path.join(SYM, stem + ".webp")).convert("RGBA")
    return np.asarray(im.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))).astype(np.float32) / 255.0


def pack(pictures, max_width):
    gap = 2
    order = sorted(pictures.items(), key=lambda kv: -kv[1].shape[0])
    x = y = shelf = width = 0
    at = {}
    for name, im in order:
        h, w = im.shape[:2]
        if x and x + w + gap > max_width:
            x = 0
            y += shelf + gap
            shelf = 0
        at[name] = (x, y)
        x += w + gap
        width = max(width, x)
        shelf = max(shelf, h)
    sheet = np.zeros((y + shelf, width, 4), np.float32)
    frames = {}
    for name, im in pictures.items():
        px, py = at[name]
        h, w = im.shape[:2]
        sheet[py:py + h, px:px + w] = im
        frames[name] = {"frame": {"x": px, "y": py, "w": w, "h": h}, "rotated": False, "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h}, "sourceSize": {"w": w, "h": h}}
    return sheet, frames


def pack_tight(pictures):
    """the shelf pack at the sheet width (2 px steps, up to 2048) that wastes least"""
    widest = max(im.shape[1] for im in pictures.values())
    best = None
    for w in range(widest, 2049, 2):
        sheet, frames = pack(pictures, w)
        if best is None or sheet.shape[0] * sheet.shape[1] < best[0].shape[0] * best[0].shape[1]:
            best = (sheet, frames)
    return best


def weights(X, ropes):
    m = ROPE_MARGIN
    r1 = ropes[-1] + m
    wt = float(np.clip((X - r1) / (X_TIP - r1), 0, 1) ** TIP_POW)
    wb = 0.0
    for a, b in zip(ropes[:-1], ropes[1:]):
        u = (X - (a + m)) / ((b - m) - (a + m))
        if 0 < u < 1:
            wb = float(np.sin(np.pi * u))
    r0 = ropes[0] - m
    if X < r0:
        wb = -float(np.clip((r0 - X) / (r0 - X_CUT), 0, 1) ** 2)
    return wt, wb


def main():
    info = json.load(open(os.path.join(ROUND, "_outputs.json")))
    ropes = sorted(json.load(open(os.path.join(ROUND, "scripts", "_build_params.json")))["ropes_x"])
    car_k = info["car_k"]
    box = info["h2_trim_box_1536"]
    anchor1536 = (box[0] + box[2]) / 2
    # road px from the H2 anchor of a car x in wheelbase units (749.27 px per unit at 1536, x = 0 at column 768; the left
    # facing picture mirrored: NOTES.md, scripts/motion.py)
    road_x = lambda X, d: (768 + d * X * (1536 / 2.05) - anchor1536) * car_k
    os.makedirs(OUT, exist_ok=True)
    spec = {"source": "wagon_tree_r4_2026-11-15 (atlas_ready)", "ropesWheelbase": ropes, "frames": {}, "tiers": {}}
    for tier, dens in DENSITY.items():
        pictures = {}
        for d_name, d in (("R", 1), ("L", -1)):
            frame = f"H2_{d_name}"
            o = info["frames"][f"{frame}_{tier}"]
            fs = spec["frames"].setdefault(frame, {"dir": d, "tiers": {}})
            ft = fs["tiers"].setdefault(tier, {})
            layers = {}
            for layer in LAYERS:
                p = os.path.join(ROUND, "atlas_ready", f"{frame}_{layer}{'' if tier == 'full' else '_phone'}.png")
                im = np.asarray(Image.open(p).convert("RGBA")).astype(np.float32) / 255.0
                if [im.shape[1], im.shape[0]] != o[layer]["trim_px"]:
                    raise SystemExit(f"build_wagon_tree: {p} is {im.shape[1]} x {im.shape[0]}, _outputs.json says {o[layer]['trim_px']}")
                pictures[f"{frame}_{layer}"] = im
                layers[layer] = im
                ox, oy = o[layer]["offset_road_px"]
                ft[layer] = {"x": ox, "y": oy, "w": round(im.shape[1] / dens, 3), "h": round(im.shape[0] / dens, 3)}
            # THE STRIPS: edges in the tree picture's px, on whole px; each with its weights (at the edge's road x)
            tw = layers["tree"].shape[1]
            tx0 = ft["tree"]["x"]
            to_px = lambda xr: (xr - tx0) * dens
            marks = []  # wheelbase x of the run boundaries, back to front along the car (toward the tip)
            m = ROPE_MARGIN
            marks.append(("back", X_CUT - 0.1, ropes[0] - m))
            for i, r in enumerate(ropes):
                marks.append(("rope", r - m, r + m))
                if i + 1 < len(ropes):
                    marks.append(("between", r + m, ropes[i + 1] - m))
            marks.append(("tip", ropes[-1] + m, X_TIP))
            marks.append(("past", X_TIP, X_TIP + 0.2))
            xs = set([0, tw])
            still = set()  # the edges of a rope's strip: exactly still (the px rounding must not leave a hair of weight)
            for kind, a, b in marks:
                n = {"back": STRIPS["back"], "between": STRIPS["between"], "tip": STRIPS["tip"]}.get(kind, 1)
                for j in range(n + 1):
                    X = a + (b - a) * j / n
                    px = int(round(to_px(road_x(X, d))))
                    if 0 <= px <= tw:
                        xs.add(px)
                        if kind == "rope":
                            still.add(px)
            edges = sorted(xs)
            ft["strips"] = []
            for px in edges:
                xr = tx0 + px / dens
                X = ((xr / car_k) + anchor1536 - 768) / (1536 / 2.05) * d
                wt, wb = (0.0, 0.0) if px in still else weights(X, ropes)
                ft["strips"].append({"px": px, "x": round(xr, 3), "tip": round(wt, 4), "body": round(wb, 4), **({"rope": True} if px in still else {})})
            ft["ropesX"] = [round(road_x(r, d), 2) for r in ropes]
            # THE SHADOW'S EXTRA SILHOUETTE: tree and ropes outside the wagon (its alpha), on the wagon's frame raised
            car = atlas_frame(tier, frame)
            rw, rh = road_size(frame)
            H, W = car.shape[:2]
            kx, ky = W / rw, H / rh
            pad = int(round(8 * dens))
            canvas = np.zeros((H + pad, W), np.float32)
            for layer in ("tree", "ropes"):
                im = layers[layer]
                x0 = int(round((ft[layer]["x"] + rw / 2) * kx))
                y0 = int(round((ft[layer]["y"] + rh) * ky)) + pad
                h, w = im.shape[:2]
                sub = canvas[y0:y0 + h, x0:x0 + w]
                a = im[: sub.shape[0], : sub.shape[1], 3]
                canvas[y0:y0 + h, x0:x0 + w] = 1 - (1 - sub) * (1 - a)
            carpad = np.zeros_like(canvas)
            carpad[pad:] = car[..., 3]
            extra = np.clip(canvas - carpad, 0, 1)
            extra[extra < 3 / 255] = 0
            ys, xs2 = np.where(extra > 0)
            ex = np.zeros((ys.max() - ys.min() + 1, xs2.max() - xs2.min() + 1, 4), np.float32)
            ex[..., :3] = 1
            ex[..., 3] = extra[ys.min(): ys.max() + 1, xs2.min(): xs2.max() + 1]
            pictures[f"{frame}_treeshadow"] = ex
            ft["shadow"] = {"x": round(xs2.min() / kx - rw / 2, 3), "y": round((ys.min() - pad) / ky - rh, 3), "w": round(ex.shape[1] / kx, 3), "h": round(ex.shape[0] / ky, 3)}
        sheet, frames = pack_tight(pictures)
        stem = "wagon-tree" if tier == "full" else "wagon-tree-phone"
        Image.fromarray((np.clip(sheet, 0, 1) * 255).round().astype(np.uint8), "RGBA").save(os.path.join(OUT, f"{stem}.webp"), lossless=True, method=6)
        meta = {"frames": frames, "meta": {"image": f"{stem}.webp", "format": "RGBA8888", "size": {"w": sheet.shape[1], "h": sheet.shape[0]}, "scale": "1"}}
        with open(os.path.join(OUT, f"{stem}.json"), "w") as fh:
            json.dump(meta, fh, indent=1)
            fh.write("\n")
        mb = sheet.shape[0] * sheet.shape[1] * 4 / 1048576
        spec["tiers"][tier] = {"sheet": f"riders/{stem}.webp", "w": sheet.shape[1], "h": sheet.shape[0], "gpuMb": round(mb, 3), "bytes": os.path.getsize(os.path.join(OUT, f"{stem}.webp")), "px": int(sum(p.shape[0] * p.shape[1] for p in pictures.values()))}
        print(f"  {stem}: {sheet.shape[1]} x {sheet.shape[0]}, {len(frames)} frames, {mb:.2f} MB on the GPU (+ a third with mips), {spec['tiers'][tier]['bytes'] // 1024} KB")
    for frame, fs in spec["frames"].items():
        print(f"  {frame}: {len(fs['tiers']['full']['strips']) - 1} strips desktop, {len(fs['tiers']['phone']['strips']) - 1} phone; ropes at {fs['tiers']['full']['ropesX']} road px")
    with open(os.path.join(APP, "src", "game", "wagonTreeSpec.ts"), "w") as fh:
        fh.write(
            "// AUTO-GENERATED by tools/build_wagon_tree.py from the approved round 4 layers. Do not edit: change the tool and run it\n"
            "// again. Per wagon frame and tier: each layer's top left corner from the H2 sprite's anchor (the frame's bottom centre)\n"
            "// and its size, road px at the symbol's built size; the tree's strip edges (px of the tree picture, road x) with the\n"
            "// tip's and the body's weight there; the ropes' road x; the shadow's extra silhouette (tree and ropes outside the wagon).\n"
            f"export const WAGON_TREE_ART = {json.dumps(spec, indent=chr(9))} as const;\n"
        )


main()
