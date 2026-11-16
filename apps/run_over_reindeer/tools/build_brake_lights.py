"""THE BRAKE LIGHTS (Corey 2026-11-16: "we need to give the different cars brake lights in code when they are slowing
down and stopped"): measures where each car's rear lamps sit on its art (H1 Grandma's car, H2 the wagon, H3 the van,
H4 the police car; both directions) in the desktop and the phone symbol atlases, and writes src/game/brakeLightSpec.ts
(generated). The lights are drawn in code (game/road/brakeLights.ts): no new art.

Run with the math env's Python (Pillow, numpy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_brake_lights.py [--report <file.json>] [--preview <dir>]

THE RULE. The cars are drawn side on from a high three-quarter camera, so each shows the NEAR rear lamp on its rear edge
(the left edge facing right, the right edge facing left); the far lamp is hidden behind the body.
  near lamp  the LOWEST red lamp (its lenses: the connected red patches of at least 12 px within CLUSTER road px
             of the lowest one's bottom) (R >= 180, G <= 70, B <= 70: not the van's rust, alpha >= 200) inside the rear REAR_SHARE of
             the width and below the top TOP_SKIP of the height (keeps the police light bar and the van's lettering
             out). Its centre and size.
  no patch   (Grandma's car: its rear has no red lamp drawn) the lamp is put ON THE REAR EDGE: the outermost opaque
             pixel at NO_LAMP_Y of the height from the bottom, LAMP_IN of the width inward, at NO_LAMP_SIZE of the
             height. Flagged measured: false.
  far lamp   a second red patch drawn above the near one (the police car's upper lamp: measured), else the far lamp
             of the pair peeking past the rear edge: at the near lamp's outer edge, FAR_UP of the height above it,
             FAR_SIZE of its size (not drawn on the art: measured false).
Positions are road px from the sprite's anchor (the frame's bottom centre) at the symbol's built road size
(game/roadArtSpec.ts), so one table serves both tiers; the phone atlas is measured too and must agree within 4 road px.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SYM = os.path.join(APP, "static", "assets", "symbols")
OUT = os.path.join(APP, "src", "game", "brakeLightSpec.ts")
FRAMES = ["H1_R", "H1_L", "H2_R", "H2_L", "H3_R", "H3_L", "H4_R", "H4_L"]
REAR_SHARE = 0.07
TOP_SKIP = 0.3
NO_LAMP_Y = 0.42
CLUSTER = 22
NO_LAMP_SIZE = 0.09
LAMP_IN = 0.012
FAR_UP = 0.07
FAR_SIZE = 0.7


def road_size(frame):
    src = open(os.path.join(APP, "src", "game", "roadArtSpec.ts")).read()
    d = json.loads(src[src.index("{"): src.rindex("}") + 1])
    s = d["symbols"][frame]
    return s["width"], s["height"]


def patches(mask, least=12):
    """every 4-connected patch of a boolean mask with at least `least` pixels: a list of (ys, xs)"""
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    H, W = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        ys, xs = [], []
        while stack:
            y, x = stack.pop()
            ys.append(y)
            xs.append(x)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                v, u = y + dy, x + dx
                if 0 <= v < H and 0 <= u < W and mask[v, u] and not seen[v, u]:
                    seen[v, u] = True
                    stack.append((v, u))
        if len(ys) >= least:
            out.append((np.array(ys), np.array(xs)))
    return out


def crop(atlas, frame):
    meta = json.load(open(os.path.join(SYM, atlas + ".json")))
    f = meta["frames"][frame]["frame"]
    im = Image.open(os.path.join(SYM, meta["meta"]["image"].split("?")[0])).convert("RGBA")
    return im.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))


def measure(atlas, frame):
    c = crop(atlas, frame)
    a = np.asarray(c).astype(int)
    H, W = a.shape[:2]
    rw, rh = road_size(frame)
    k = rw / W  # road px per atlas px
    rear_left = frame.endswith("_R")
    band = max(2, int(round(W * REAR_SHARE)))
    x0 = 0 if rear_left else W - band
    sub = a[:, x0:x0 + band]
    red = (sub[..., 0] >= 180) & (sub[..., 1] <= 70) & (sub[..., 2] <= 70) & (sub[..., 3] >= 200)
    red[: int(H * TOP_SKIP)] = False
    found = sorted(patches(red), key=lambda p: -p[0].max())
    def box(group):
        ys = np.concatenate([p[0] for p in group])
        xs = np.concatenate([p[1] for p in group]) + x0
        return {"x": (xs.min() + xs.max() + 1) / 2, "y": (ys.min() + ys.max() + 1) / 2, "w": xs.max() - xs.min() + 1, "h": ys.max() - ys.min() + 1, "measured": True, "edge": xs.min() if rear_left else xs.max() + 1, "top": ys.min()}
    # a lamp drawn as several lenses (dark lines between them) is one lamp: the patches within CLUSTER road px of the
    # lowest patch's bottom
    gap = CLUSTER / k
    lower = [p for p in found if p[0].min() >= found[0][0].max() - gap]
    upper = [p for p in found if p[0].min() < found[0][0].max() - gap]
    if found:
        near = box(lower)
        edge = near["edge"]
    else:
        y = int(H * (1 - NO_LAMP_Y))
        row = np.nonzero(a[y, :, 3] >= 128)[0]
        edge = row.min() if rear_left else row.max() + 1
        cx = edge + (1 if rear_left else -1) * W * LAMP_IN
        s = H * NO_LAMP_SIZE
        near = {"x": cx, "y": y, "w": s * 0.8, "h": s, "measured": False}
    # the far lamp: a second red patch drawn above the near one (the police car's upper lamp), else peeking past the edge
    above = [p for p in upper if p[0].max() < near.get("top", near["y"])]
    if above and sum(len(p[0]) for p in above) * k * k >= 4:
        far = box(above)
    else:
        far = {"x": edge + (1 if rear_left else -1) * near["w"] * 0.25, "y": near["y"] - H * FAR_UP, "w": near["w"] * FAR_SIZE, "h": near["h"] * FAR_SIZE, "measured": False}
    # to road px from the anchor (bottom centre)
    def road(l):
        return {"x": round((l["x"] - W / 2) * k, 2), "y": round((l["y"] - H) * k, 2), "w": round(l["w"] * k, 2), "h": round(l["h"] * k, 2), "measured": l["measured"]}
    return {"near": road(near), "far": road(far)}, c, (near, far)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report")
    ap.add_argument("--preview")
    args = ap.parse_args()
    out = {}
    report = {}
    for frame in FRAMES:
        full, c, raw = measure("symbols", frame)
        phone, _, _ = measure("symbols-phone", frame)
        # the phone atlas is too coarse to find the police car's thin upper lamp: the near lamp must agree, and the
        # desktop's numbers serve both tiers
        for lamp in ("near",):
            for key in ("x", "y"):
                d = abs(full[lamp][key] - phone[lamp][key])
                if d > 4:
                    raise SystemExit(f"{frame} {lamp} {key}: desktop {full[lamp][key]} phone {phone[lamp][key]}")
        out[frame] = full
        report[frame] = {"full": full, "phone": phone}
        if args.preview:
            os.makedirs(args.preview, exist_ok=True)
            big = c.resize((c.width * 2, c.height * 2), Image.LANCZOS)
            bg = Image.new("RGBA", big.size, (50, 56, 64, 255))
            bg.alpha_composite(big)
            d = ImageDraw.Draw(bg)
            for l, col in zip(raw, ((0, 255, 0, 255), (255, 0, 255, 255))):
                d.ellipse((2 * (l["x"] - l["w"] / 2), 2 * (l["y"] - l["h"] / 2), 2 * (l["x"] + l["w"] / 2), 2 * (l["y"] + l["h"] / 2)), outline=col, width=3)
            bg.convert("RGB").save(os.path.join(args.preview, f"{frame}.png"))
    with open(OUT, "w") as f:
        f.write("// AUTO-GENERATED by tools/build_brake_lights.py from the symbol atlases. Do not edit: change the tool and run it\n")
        f.write("// again. Each car frame's two rear lamps: the NEAR lamp (measured on the art where it is drawn, measured: true; on\n")
        f.write("// the rear edge where the art has none) and the FAR lamp (never drawn on the art: peeking past the rear edge). Centre\n")
        f.write("// (x, y) and size (w, h), road px from the sprite's anchor (the frame's bottom centre) at the symbol's built size.\n")
        f.write("export const BRAKE_LAMPS = " + json.dumps(out, indent="\t") + " as const;\n")
    if args.report:
        json.dump(report, open(args.report, "w"), indent=1)
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
