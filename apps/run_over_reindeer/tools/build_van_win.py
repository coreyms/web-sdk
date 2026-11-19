"""THE VAN'S WIN (Corey 2026-11-15: the van, H3, rocks with a flashlight behind its dark windows, after a lurch and a
backfire): measures its dark windows and its exhaust point in the desktop and the phone symbol atlases (H3_R, H3_L) and
writes src/game/vanWinSpec.ts (generated). The win itself is drawn in code (game/road/vanWin.ts): no new art.

Run with the math env's Python (Pillow, numpy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_van_win.py [--report <file.json>]

THE RULES (road px from the sprite's anchor, the frame's bottom centre, at the symbol's built road size):
  - a window is a connected patch of dark glass (alpha >= 200, brightness <= 80) of at least MIN_AREA frame px in the
    van's upper three quarters, after an opening about 2.5 road px wide (the dark outlines are as dark as the glass): the cab's side window and the windscreen. Its depth inside (how far each glass pixel is
    from the nearest non glass pixel) is measured by repeated 3 x 3 erosion.
  - THE SLOTS: per window, SLOTS points along its long axis among the pixels at least 0.55 of its deepest depth, each
    with the radius that fits there (its depth, less one pixel). A glow drawn at a slot no wider than twice its radius
    stays on the glass: that is how the flashlight keeps inside the window shapes without a mask.
  - THE EXHAUST: there is no tail pipe drawn, so it is the rear bumper's lower corner: the rearmost opaque pixel in the
    band 4 to 16 percent above the frame's bottom, at that band's bottom.
  - THE REAR WHEEL: the pivot of the lurch (the rear squats, the nose lifts about it): the lowest opaque row's rearmost
    run of pixels in the rear half, its middle.
It also draws THE BACKFIRE'S PUFF, one small cartoon smoke puff (four overlapping lobes, a gray fill lit from the top
left, a dark outline like the art's), at the symbol atlas's density for its largest draw (PUFF_ROAD road px):
static/assets/road/van-puff.webp (desktop) and van-puff-phone.webp (phone tier). Lossless WebP.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SYM = os.path.join(APP, "static", "assets", "symbols")
MIN_AREA = 0.004  # share of the frame's pixels
SLOTS = 4
PUFF_ROAD = 96  # the puff's largest draw, road px (VAN_WIN.puff.size x its end scale; 48 until 2026-11-19, when the puff
# grew from 40 to 70 road px so it reads on a phone: Corey had never noticed the backfire)
PUFF_LINE = 0.09  # its dark outline, a share of its size (0.06 until 2026-11-19: a darker edge against the asphalt)
DENSITY = {"full": 3.2, "phone": 1.2}  # px per road px: the symbol atlas's own (tools/build_assets.py)


def draw_puff(px):
    """a cartoon smoke puff, px x px: four lobes, gray lit from the top left, a dark outline PUFF_LINE of its size"""
    S = 4  # supersampled
    n = px * S
    yy, xx = np.mgrid[0:n, 0:n] / n
    lobes = [(0.36, 0.56, 0.24), (0.58, 0.42, 0.27), (0.66, 0.66, 0.22), (0.44, 0.34, 0.2)]
    inside = np.zeros((n, n), dtype=bool)
    for cx, cy, r in lobes:
        inside |= (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r
    m = Image.fromarray((inside * 255).astype(np.uint8))
    line = max(3, int(round(n * PUFF_LINE)) | 1)
    outer = np.asarray(m.filter(ImageFilter.MaxFilter(line))) > 127
    shade = np.clip(0.55 + 0.35 * (1 - (xx * 0.6 + yy * 0.8)), 0, 1)
    rgb = np.zeros((n, n, 3))
    # a mid gray lit from the top left: it has to read on the near black asphalt (about 50 56 64), the outline darker
    gray = (np.array([170, 172, 178]) * shade[..., None] + np.array([104, 106, 114]) * (1 - shade[..., None]))
    rgb[inside] = gray[inside]
    edge = outer & ~inside
    rgb[edge] = [18, 18, 22]
    a = np.where(outer, 255, 0).astype(np.uint8)
    img = Image.fromarray(np.dstack([rgb.astype(np.uint8), a]), "RGBA")
    return img.resize((px, px), Image.LANCZOS)


def road_size(frame):
    src = open(os.path.join(APP, "src", "game", "roadArtSpec.ts")).read()
    d = json.loads(src[src.index("{"): src.rindex("}") + 1])
    s = d["symbols"][frame]
    return s["width"], s["height"]


def components(mask):
    seen = np.zeros_like(mask, dtype=bool)
    H, W = mask.shape
    out = []
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
        out.append((np.array(ys), np.array(xs)))
    return out


def depth(mask):
    """per pixel: how many 3 x 3 erosions it survives (its depth inside the mask, px)"""
    d = np.zeros(mask.shape, dtype=int)
    cur = Image.fromarray((mask * 255).astype(np.uint8))
    k = 0
    while True:
        a = np.asarray(cur) > 127
        if not a.any():
            break
        k += 1
        d[a] = k
        cur = cur.filter(ImageFilter.MinFilter(3))
    return d


def measure(atlas, frame):
    meta = json.load(open(os.path.join(SYM, atlas + ".json")))
    f = meta["frames"][frame]["frame"]
    im = np.asarray(Image.open(os.path.join(SYM, atlas + ".webp")).convert("RGBA")).astype(int)
    a = im[f["y"]: f["y"] + f["h"], f["x"]: f["x"] + f["w"]]
    H, W = a.shape[:2]
    rw, rh = road_size(frame)
    kx, ky = rw / W, rh / H
    road = lambda x, y: (round((x - W / 2) * kx, 2), round((y - H) * ky, 2))
    lum = a[..., :3].mean(axis=2)
    glass = (a[..., 3] >= 200) & (lum <= 80)
    glass[int(H * 0.75):, :] = False
    # the dark outlines are glass colored too, and join everything: an opening (erode, then grow back) about 2.5 road px
    # wide drops them and keeps the panes
    k = max(3, int(round(2.5 / kx)) | 1)
    g = Image.fromarray((glass * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
    glass = glass & (np.asarray(g) > 127)
    wins = [c for c in components(glass) if len(c[0]) >= MIN_AREA * W * H]
    wins.sort(key=lambda c: -len(c[0]))
    wins = wins[:2]
    out = {"windows": []}
    for ys, xs in wins:
        m = np.zeros((H, W), dtype=bool)
        m[ys, xs] = True
        d = depth(m)
        deep = d >= max(2, 0.55 * d.max())
        py, px = np.nonzero(deep)
        # the long axis of the deep pixels
        cx, cy = px.mean(), py.mean()
        cov = np.cov(np.vstack([px - cx, py - cy]))
        ev, evec = np.linalg.eigh(cov)
        ax = evec[:, np.argmax(ev)]
        if ax[0] < 0:
            ax = -ax
        t = (px - cx) * ax[0] + (py - cy) * ax[1]
        slots = []
        for i in range(SLOTS):
            q = np.quantile(t, (i + 0.5) / SLOTS)
            j = np.argmin(np.abs(t - q) * 4 + (d.max() - d[py, px]))
            sx, sy = road(px[j] + 0.5, py[j] + 0.5)
            r = max(1, d[py[j], px[j]] - 1)
            slots.append({"x": sx, "y": sy, "r": round(r * min(kx, ky), 2)})
        slots.sort(key=lambda s: s["x"])
        x0, y0 = road(xs.min(), ys.min())
        x1, y1 = road(xs.max() + 1, ys.max() + 1)
        out["windows"].append({"box": [x0, y0, x1, y1], "area": int(len(xs)), "deepest": round(float(d.max()) * min(kx, ky), 2), "slots": slots})
    out["windows"].sort(key=lambda w: w["box"][0])
    # the rear: H3_R drives right, so its rear is on the left
    rear = -1 if frame.endswith("_R") else 1
    op = a[..., 3] >= 128
    band = op[int(H * 0.84): int(H * 0.96), :]
    cols = np.nonzero(band.any(axis=0))[0]
    ex = cols.min() if rear < 0 else cols.max() + 1
    out["exhaust"] = dict(zip(("x", "y"), road(ex, H * 0.96)))
    # the rear wheel's contact: the lowest opaque row, its run nearest the rear
    rows = np.nonzero(op.any(axis=1))[0]
    low = op[rows.max() - 2: rows.max() + 1, :].any(axis=0)
    xs = np.nonzero(low)[0]
    half = xs[xs < W / 2] if rear < 0 else xs[xs >= W / 2]
    # the run nearest the rear end
    runs = np.split(half, np.nonzero(np.diff(half) > 1)[0] + 1)
    run = runs[0] if rear < 0 else runs[-1]
    out["rearWheel"] = dict(zip(("x", "y"), road((run.min() + run.max() + 1) / 2, rows.max() + 1)))
    out["rear"] = rear
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report")
    args = ap.parse_args()
    table, report = {}, {}
    for frame in ("H3_R", "H3_L"):
        full = measure("symbols", frame)
        phone = measure("symbols-phone", frame)
        report[frame] = {"full": full, "phone": phone}
        if len(full["windows"]) != 2 or len(phone["windows"]) != 2:
            raise SystemExit(f"{frame}: expected two windows, found {len(full['windows'])} (desktop) and {len(phone['windows'])} (phone)")
        for wf, wp in zip(full["windows"], phone["windows"]):
            d = max(abs(a - b) for a, b in zip(wf["box"], wp["box"]))
            if d > 8:
                raise SystemExit(f"{frame}: the phone atlas's window is {d:.1f} road px from the desktop one")
        table[frame] = {"windows": [{"box": w["box"], "slots": w["slots"]} for w in full["windows"]], "exhaust": full["exhaust"], "rearWheel": full["rearWheel"], "rear": full["rear"]}
    body = json.dumps({"frames": table}, indent="\t")
    with open(os.path.join(APP, "src", "game", "vanWinSpec.ts"), "w") as fh:
        fh.write(
            "// AUTO-GENERATED by tools/build_van_win.py from the symbol atlases. Do not edit: change the tool and run it again.\n"
            "// The van's two dark windows (their box, and the slots along each where a glow of radius r stays on the glass),\n"
            "// its exhaust point (the rear bumper's lower corner) and its rear wheel's contact, road px from the sprite's anchor\n"
            "// (the frame's bottom centre) at the symbol's built size. rear: -1 = the rear is on the left (it drives right).\n"
            f"export const VAN_WIN = {body} as const;\n"
        )
    puffs = {}
    for tier, name in (("full", "van-puff.webp"), ("phone", "van-puff-phone.webp")):
        px = int(round(PUFF_ROAD * DENSITY[tier]))
        path = os.path.join(APP, "static", "assets", "road", name)
        draw_puff(px).save(path, "WEBP", lossless=True)
        puffs[tier] = {"file": f"road/{name}", "px": px, "bytes": os.path.getsize(path)}
    report["puff"] = puffs
    if args.report:
        json.dump(report, open(args.report, "w"), indent=1)
    print(json.dumps(puffs, indent=1))


main()
