"""THE CONTACT SHADOWS (Corey 2026-11-15): one small soft shadow texture, and the table that places it under every
symbol, the column characters and the running reindeer, measured from the art the game draws.

Run with the math env's Python (Pillow, numpy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_shadows.py [--report <dir>]
Then `node scripts/stamp-assets.mjs` (pnpm dev and pnpm build run it for you).

It only READS the game's own built art (static/assets: the symbol atlas, the present's still sheet, the column
characters' idle sheets, the reindeer's run sheets) and the generated specs, and writes:
  static/assets/road/shadow.webp         the soft ellipse, desktop tier (ATLAS_SCALE.full px per road px at its
  static/assets/road/shadow-phone.webp   largest draw size), and the phone tier twin (ATLAS_SCALE.phone)
  src/game/shadowSpec.ts                 the table: per symbol frame, per column character, per run view and per run
                                         frame (generated)
With --report <dir> it also writes shadow_measure.json and shadow_table.md (the measured numbers and the table).

THE RULES (named below, every number in road px unless it says frame px):
  - "ground" is the lowest opaque row of the picture (alpha >= OPAQUE), "footprint" the left and right ends of the
    opaque pixels within a band just above it (the tyres of a car, the runners of the sleigh, the post of a sign, the
    base of the present, the feet of a column character).
  - the shadow is an ellipse of the shared texture stretched to (width, height), centred (dx, dy) from the sprite's
    anchor. Its lower edge sits `below` under the ground, so it touches its object and stops short of the lane line
    (the lines start 4.5 road px under a parked symbol's ground).
  - the reindeer: each run view's ground ellipse is his body (BODY_LENGTH from the side view, BODY_WIDTH from the
    front view) turned by the view's turnDeg and seen from STRIKE.cameraDeg; per frame his feet's height over the
    ground (lowest opaque row against the view's anchor) shrinks and lightens it.
"""
import argparse
import json
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
ASSETS = os.path.join(APP, "static", "assets")
GAME = os.path.join(APP, "src", "game")

OPAQUE = 128
# the band above the ground the footprint is read in, road px, per kind
BAND = {"car": 6.0, "sleigh": 5.0, "sign": 4.0, "present": 12.0, "column": 8.0}
# width = footprint x widen (+ pad each side); height; lower edge `below` under the ground; peak alpha share
RULE = {
    # the four cars and the van: tyre to tyre, a little past each tyre; deep enough to read between the wheels
    "car": {"widen": 1.0, "pad": 6.0, "height": 22.0, "below": 4.0, "alpha": 1.0},
    # the sleigh's runners: their whole length
    "sleigh": {"widen": 1.0, "pad": 4.0, "height": 18.0, "below": 4.0, "alpha": 1.0},
    # a sign: a small one at the foot of its post, never a blob under the board
    "sign": {"widen": 3.2, "pad": 0.0, "height": 8.0, "below": 3.0, "alpha": 0.9, "minWidth": 22.0, "maxWidth": 34.0},
    # the present: its base edge to edge
    "present": {"widen": 1.0, "pad": 4.0, "height": 20.0, "below": 4.0, "alpha": 1.0},
    # a column character: its feet, a little wider
    "column": {"widen": 1.0, "pad": 6.0, "height": 18.0, "below": 4.0, "alpha": 0.85},
}
KIND = {"H1": "car", "H2": "car", "H3": "car", "H4": "car", "W": "sleigh", "L1": "sign", "L2": "sign", "L3": "sign", "L4": "sign", "L5": "sign", "S": "present"}
FRAMES = ["H1_R", "H1_L", "H2_R", "H2_L", "H3_R", "H3_L", "H4_R", "H4_L", "W_R", "W_L", "L1", "L2", "L3", "L4", "L5"]

# THE REINDEER (frame px of the rig's 1536 render): the ground ellipse of his body, measured below from the side view
# (torso length: the ink's width in the band from his belly to his back, without the head, tail and legs) and the
# front view (body width: his chest, the same rows and fill rule)
RUN_CAMERA_DEG = 40  # constants STRIKE.cameraDeg
RUN_FEET_GROUNDED = 35  # frame px: a frame whose lowest hoof is this near the ground counts as on the ground
RUN_LIFT_FULL = 120  # frame px of foot height at which the shadow is at its smallest and lightest
RUN_LIFT_SHRINK = 0.3  # at RUN_LIFT_FULL: 0.7 of its size
RUN_LIFT_FADE = 0.55  # ...and 0.45 of its darkness
RUN_BELOW = 0.2  # share of the ellipse's half height that shows under his lowest grounded hoof
RUN_ALPHA = 0.9

# the largest draw scale a shadow gets on top of its table size (the win pulse, constants LINE_WIN.pulseScale)
PULSE_MAX = 1.12
# the texture: a soft ellipse, alpha (1 - r^2)^PROFILE, with a clear border so the stretched edge never clamps
PROFILE = 1.8
BORDER = 2


def read_spec(path):
    src = open(path).read()
    return json.loads(src[src.index("{"): src.rindex("}") + 1])


def alpha_of(im):
    return np.asarray(im.convert("RGBA"))[:, :, 3]


def footprint(a, px_per_road, band_road, post=False):
    """ground row (exclusive, px) and the footprint's left and right (px) in the band above it. `post`: only the run of
    opaque columns nearest the middle (a sign's post, not a bell or the board's corner that reaches as low)"""
    rows = np.where(a.max(1) >= OPAQUE)[0]
    ground = int(rows.max()) + 1
    band = a[max(0, ground - max(1, round(band_road * px_per_road))): ground]
    hit = band.max(0) >= OPAQUE
    cols = np.where(hit)[0]
    if not post:
        return ground, int(cols.min()), int(cols.max()) + 1
    mid = a.shape[1] / 2
    start = int(cols[np.argmin(np.abs(cols + 0.5 - mid))])
    left, right = start, start + 1
    while left > 0 and hit[left - 1]:
        left -= 1
    while right < len(hit) and hit[right]:
        right += 1
    return ground, left, right


def shape(kind, left, right, ground):
    """the shadow from a footprint (road px against the anchor): width, height, centre"""
    r = RULE[kind]
    span = right - left
    width = span * r["widen"] + 2 * r["pad"]
    if "minWidth" in r:
        width = min(r["maxWidth"], max(r["minWidth"], width))
    h = r["height"]
    # foot / ground: the measured footprint and ground it was built from (the probe checks the shadow against them)
    return {"width": round(width, 2), "height": h, "dx": round((left + right) / 2, 2), "dy": round(ground + r["below"] - h / 2, 2), "alpha": r["alpha"], "foot": [round(left, 2), round(right, 2)], "ground": round(ground, 2)}


def measure_symbols(art):
    scale = art["atlasScale"]["full"]
    atlas = Image.open(os.path.join(ASSETS, "symbols", "symbols.webp"))
    meta = json.load(open(os.path.join(ASSETS, "symbols", "symbols.json")))["frames"]
    out, measured = {}, {}
    for name in FRAMES:
        f = meta[name]["frame"]
        a = alpha_of(atlas.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"])))
        kind = KIND[name.split("_")[0]]
        ground, left, right = footprint(a, scale, BAND[kind], post=kind == "sign")
        # road px against the sprite's anchor (bottom centre of the frame; the game scales the frame to the spec's width)
        k = art["symbols"][name]["width"] / f["w"]
        m = {"kind": kind, "frame": [f["w"], f["h"]], "groundPx": ground, "footPx": [left, right], "ground": round((ground - f["h"]) * k, 2), "left": round((left - f["w"] / 2) * k, 2), "right": round((right - f["w"] / 2) * k, 2)}
        measured[name] = m
        out[name] = shape(kind, m["left"], m["right"], m["ground"])
    return out, measured


def measure_present():
    spec = read_spec(os.path.join(GAME, "presentSpec.ts"))
    t = spec["tiers"]["full"]
    s = t["still"]
    canvas = t["canvas"]
    density = canvas["w"] / spec["canvasRoad"]["width"]
    a = alpha_of(Image.open(os.path.join(ASSETS, s["file"])))
    ground, left, right = footprint(a, density, BAND["present"])
    ax = spec["anchor"]["x"] / (spec["canvasRoad"]["width"] * spec["sourceDensity"]) * canvas["w"]
    ay = spec["anchor"]["y"] / (spec["canvasRoad"]["height"] * spec["sourceDensity"]) * canvas["h"]
    m = {"kind": "present", "density": density, "groundPx": ground + s["oy"], "footPx": [left + s["ox"], right + s["ox"]], "ground": round((ground + s["oy"] - ay) / density, 2), "left": round((left + s["ox"] - ax) / density, 2), "right": round((right + s["ox"] - ax) / density, 2)}
    # the art pass's own shadow (frames/shadow.png on the 640 x 800 source canvas), for the record: it is not shipped
    art_shadow = os.path.expanduser("~/Desktop/Run Over Reindeer/scatter_present_3d_r1_2026-11-15/frames/shadow.png")
    if os.path.exists(art_shadow):
        sa = alpha_of(Image.open(art_shadow)).astype(float)
        ys, xs = np.where(sa >= 40)
        d0 = spec["sourceDensity"]
        m["artPassShadow"] = {"peakAlpha": round(sa.max() / 255, 3), "alpha40": {"left": round((xs.min() - spec["anchor"]["x"]) / d0, 2), "right": round((xs.max() + 1 - spec["anchor"]["x"]) / d0, 2), "top": round((ys.min() - spec["anchor"]["y"]) / d0, 2), "bottom": round((ys.max() + 1 - spec["anchor"]["y"]) / d0, 2)}}
    return shape("present", m["left"], m["right"], m["ground"]), m


def measure_columns():
    spec = read_spec(os.path.join(GAME, "columnClipSpec.ts"))
    col_w, col_h = spec["column"]["width"], spec["column"]["height"]
    out, measured = {}, {}
    for tier, clips in spec["clips"].items():
        clip = clips["idle"]
        t = clip["tiers"]["full"]
        per_road = t["frameWidth"] / clip["width"]
        grounds, lefts, rights = [], [], []
        for sheet in t["sheets"]:
            im = Image.open(os.path.join(ASSETS, sheet["file"]))
            for i in range(sheet["frames"]):
                fx = (i % t["columns"]) * (t["frameWidth"] + t["gap"])
                fy = (i // t["columns"]) * (t["frameHeight"] + t["gap"])
                a = alpha_of(im.crop((fx, fy, fx + t["frameWidth"], fy + t["frameHeight"])))
                g, l, r = footprint(a, per_road, BAND["column"])
                grounds.append(g)
                lefts.append(l)
                rights.append(r)
        # road px against the column's foot (the middle of its lower edge), at tier scale 1
        to_x = lambda px: clip["x"] + px / per_road - col_w / 2
        to_y = lambda px: clip["y"] + px / per_road - col_h
        m = {"frames": len(grounds), "ground": round(to_y(float(np.median(grounds))), 2), "groundRange": [round(to_y(min(grounds)), 2), round(to_y(max(grounds)), 2)], "left": round(to_x(float(np.median(lefts))), 2), "right": round(to_x(float(np.median(rights))), 2), "leftRange": [round(to_x(min(lefts)), 2), round(to_x(max(lefts)), 2)], "rightRange": [round(to_x(min(rights)), 2), round(to_x(max(rights)), 2)]}
        measured[tier] = m
        out[tier] = shape("column", m["left"], m["right"], m["ground"])
    return out, measured


def measure_run():
    spec = read_spec(os.path.join(GAME, "reindeerRunSpec.ts"))
    t = spec["tiers"]["full"]
    sheets = [Image.open(os.path.join(ASSETS, s["file"])) for s in t["sheets"]]
    frames, views = {}, {}
    side_torso, front_legs = [], []
    for view, v in spec["views"].items():
        d = t["density"][view]
        rows = {}
        for stride, f in t["frames"][view].items():
            a = alpha_of(sheets[f["sheet"]].crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"])))
            ys = np.where(a.max(1) >= OPAQUE)[0]
            bottom = (f["oy"] + ys.max() + 1) / d
            lift = max(0.0, v["anchorY"] - bottom)
            rows[int(stride)] = round(lift, 1)
            ink_top, ink_bottom = ys.min(), ys.max() + 1
            if view == "R":
                # the torso: the rows from 45 to 70 percent down the ink (under the antlers and head, over the legs);
                # its width there is nose of the chest to the rump, the tail tuft trimmed by the 80 percent fill rule
                lo, hi = int(ink_top + 0.45 * (ink_bottom - ink_top)), int(ink_top + 0.7 * (ink_bottom - ink_top))
                filled = (a[lo:hi] >= OPAQUE).mean(0) >= 0.8
                cols = np.where(filled)[0]
                if len(cols):
                    side_torso.append((cols.max() + 1 - cols.min()) / d)
            if view == "C":
                # the chest seen from the front, by the same rows and fill rule
                lo, hi = int(ink_top + 0.45 * (ink_bottom - ink_top)), int(ink_top + 0.7 * (ink_bottom - ink_top))
                cols = np.where((a[lo:hi] >= OPAQUE).mean(0) >= 0.8)[0]
                if len(cols):
                    front_legs.append((cols.max() + 1 - cols.min()) / d)
        frames[view] = dict(sorted(rows.items()))
    length = float(np.median(side_torso))
    width = float(np.median(front_legs))
    lift = math.sin(math.radians(RUN_CAMERA_DEG))
    for view, v in spec["views"].items():
        phi = math.radians(v["turnDeg"])
        w = 2 * math.hypot(length / 2 * math.cos(phi), width / 2 * math.sin(phi))
        h = 2 * math.hypot(length / 2 * math.sin(phi), width / 2 * math.cos(phi)) * lift
        # centred on his middle across; up from his lowest hoof (the view's anchor) so RUN_BELOW of its half height shows under it
        views[view] = {"width": round(w, 1), "height": round(h, 1), "dx": 0.0, "dy": round(-(1 - RUN_BELOW) * h / 2, 1)}
    measured = {"bodyLength": round(length, 1), "bodyWidth": round(width, 1), "sideTorsoSamples": len(side_torso), "frontSamples": len(front_legs)}
    return {"roadPxPerFramePx": spec["roadPxPerFramePx"], "views": views, "lift": frames, "liftFull": RUN_LIFT_FULL, "shrink": RUN_LIFT_SHRINK, "fade": RUN_LIFT_FADE, "alpha": RUN_ALPHA, "grounded": RUN_FEET_GROUNDED}, measured


def texture(width_road, height_road, px_per_road):
    w = max(8, math.ceil(width_road * px_per_road) + 2 * BORDER)
    h = max(4, math.ceil(height_road * px_per_road) + 2 * BORDER)
    iw, ih = w - 2 * BORDER, h - 2 * BORDER
    y, x = np.mgrid[0:h, 0:w].astype(float)
    nx = (x + 0.5 - w / 2) / (iw / 2)
    ny = (y + 0.5 - h / 2) / (ih / 2)
    r2 = nx * nx + ny * ny
    a = np.clip(1 - r2, 0, 1) ** PROFILE
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[:, :, :3] = 255
    rgba[:, :, 3] = np.round(a * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", default="")
    args = ap.parse_args()
    art = read_spec(os.path.join(GAME, "roadArtSpec.ts"))
    symbols, m_symbols = measure_symbols(art)
    symbols["S"], m_present = measure_present()
    columns, m_columns = measure_columns()
    run, m_run = measure_run()

    # the texture: 3 physical px per CSS px of the largest draw size, as the atlas (ATLAS_SCALE)
    road_scale = 0.85  # constants STRIKE.roadScale: the reindeer's largest draw scale
    k_run = run["roadPxPerFramePx"] * road_scale
    widths = [s["width"] * PULSE_MAX for s in symbols.values()] + [c["width"] for c in columns.values()] + [v["width"] * k_run for v in run["views"].values()]
    heights = [s["height"] * PULSE_MAX for s in symbols.values()] + [c["height"] for c in columns.values()] + [v["height"] * k_run for v in run["views"].values()]
    big_w, big_h = max(widths), max(heights)
    files = {}
    for tier, px in art["atlasScale"].items():
        im = texture(big_w, big_h, px)
        name = "shadow.webp" if tier == "full" else "shadow-phone.webp"
        im.save(os.path.join(ASSETS, "road", name), lossless=True, method=6)
        files[tier] = {"file": f"road/{name}", "width": im.width, "height": im.height, "bytes": os.path.getsize(os.path.join(ASSETS, "road", name)), "pxPerRoad": px}

    spec = {
        "texture": {"largest": {"width": round(big_w, 1), "height": round(big_h, 1)}, "profile": PROFILE, "border": BORDER, "tiers": files},
        "symbols": symbols,
        "columns": columns,
        "run": run,
    }
    head = (
        "// AUTO-GENERATED by tools/build_shadows.py from the game's own art (the measured numbers are in its report). Do not\n"
        "// edit: change the rules in the tool and run it again. Road px against each sprite's anchor: symbols from the bottom\n"
        "// centre of their frame (the present from its pieces' anchor), columns from the middle of the column's foot, the\n"
        "// reindeer in frame px of the rig's render from each run view's anchor (x roadPxPerFramePx x his draw scale).\n"
        "// width / height: the ellipse drawn; dx / dy: its centre; alpha: its share of the strength (constants SHADOW).\n"
        "// run.lift[view][stride]: his lowest hoof over the ground, frame px (0 = on the ground).\n"
    )
    with open(os.path.join(GAME, "shadowSpec.ts"), "w") as fh:
        fh.write(head + "export const SHADOW_ART = " + json.dumps(spec, indent="\t") + " as const;\n")

    if args.report:
        os.makedirs(args.report, exist_ok=True)
        measured = {"rules": {"opaque": OPAQUE, "band": BAND, "rule": RULE}, "symbols": m_symbols, "present": m_present, "columns": m_columns, "run": m_run}
        json.dump({"measured": measured, "built": spec}, open(os.path.join(args.report, "shadow_measure.json"), "w"), indent=1)
        lines = ["# The shadow table as built (tools/build_shadows.py)", "", "Road px against the sprite's anchor (bottom centre). Measured: the ground (lowest opaque row, alpha >= 128) and the footprint (left and right of the opaque pixels in the band above it).", "", "| frame | kind | ground | footprint left .. right | shadow width x height | centre dx, dy | alpha share |", "|---|---|---|---|---|---|---|"]
        for name, s in symbols.items():
            m = m_symbols.get(name, m_present)
            lines.append(f"| {name} | {m['kind']} | {m['ground']} | {m['left']} .. {m['right']} | {s['width']} x {s['height']} | {s['dx']}, {s['dy']} | {s['alpha']} |")
        lines += ["", "Columns (road px against the middle of the column's foot; medians over every idle frame):", "", "| character | frames | ground (range) | feet left .. right (ranges) | shadow | centre | alpha |", "|---|---|---|---|---|---|---|"]
        for tier, c in columns.items():
            m = m_columns[tier]
            lines.append(f"| {tier} | {m['frames']} | {m['ground']} ({m['groundRange'][0]} .. {m['groundRange'][1]}) | {m['left']} .. {m['right']} ({m['leftRange']} / {m['rightRange']}) | {c['width']} x {c['height']} | {c['dx']}, {c['dy']} | {c['alpha']} |")
        lines += ["", f"Reindeer: body length {m_run['bodyLength']} frame px (side view torso), width {m_run['bodyWidth']} (front view legs); camera {RUN_CAMERA_DEG} deg.", "", "| view | turn | ellipse w x h (frame px) | centre dy |", "|---|---|---|---|"]
        art_run = read_spec(os.path.join(GAME, "reindeerRunSpec.ts"))
        for view, v in run["views"].items():
            lines.append(f"| {view} | {art_run['views'][view]['turnDeg']} | {v['width']} x {v['height']} | {v['dy']} |")
        lines += ["", "Foot height per frame (frame px over the view's anchor):", ""]
        for view, rows in run["lift"].items():
            lines.append(f"- {view}: " + ", ".join(f"{s}: {h}" for s, h in rows.items()))
        lines += ["", f"Texture: largest draw {big_w:.1f} x {big_h:.1f} road px; " + "; ".join(f"{t}: {f['width']} x {f['height']} px, {f['bytes']} bytes" for t, f in files.items())]
        open(os.path.join(args.report, "shadow_table.md"), "w").write("\n".join(lines) + "\n")
    print(json.dumps({"texture": files, "largest": [round(big_w, 1), round(big_h, 1)], "run": m_run}, indent=1))


if __name__ == "__main__":
    main()
