# THE ROAMING REINDEER'S SHEETS (2026-11-17): the rig's walk, walk start, walk stop and sniff (idle) clips, packed from
# the SAME export the strike's run views come from (animation/export_2026-11-11/reindeer, README.txt beside it). No new
# art: these clips were rendered with the run and were "stage 2, not packed" until now (tools/build_assets.py).
#
#   math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_roam.py
#
# Writes static/assets/reindeer/roam2-<tier>-<n>.webp, roamc-<tier>-<n>.webp (the charge wind-up) and
# src/game/reindeerRoamSpec.ts (generated). Pixel work only.
#
# WHAT IS PACKED (frames of the rig's 30 fps clips; the game plays them on the rig's own frame clock, game/road/roam.ts):
#   walk        every 4th frame of the 40 frame loop (7.5 fps): 1, 5 .. 37
#   start       every 4th frame of walk_start (1 .. 29): it ends on walk frame 38, the game goes on from walk 39
#   stop        every 4th frame of walk_stop (1 .. 33) and its last (36, the stand); its frame 1 follows walk frame 8
#   sniff       every 6th frame of the 100 frame idle loop (5 fps): 1, 7 .. 97; frame 1 is the stand
# The game plays them on the rig's own 30 fps clock and shows the packed frame nearest the rig frame due.
# Each frame is resized as its whole box at the strike's side run density (3 physical px per CSS px at the largest draw:
# the same numbers as build_assets.py RUN_CSS_PER_ROAD and the R view's draw scale), then trimmed to its ink.
#
# THE CHARGE WIND-UP (2026-11-20, Corey's "Slow Drag 1" and "B Snort at lock"; the rig's addition
# animation/export_2026-11-20_charge/reindeer, R3_GAME_SPEC.md beside it): two more clips, EVERY frame packed (the scrape's
# timing is planned frame by frame, game/road/chargeWindup.ts), on sheets of their own ("roamc", loaded after the roam
# sheets) so the roam2 sheets above are byte for byte as they were:
#   charge      charge_slow_R, all 21 (head down 1-5, reach 5-8, the hit 9, the drag 9-15, the kick 17, back to 21)
#   chargeDown  charge_down_R, all 4 (Turbo 2 and a slam stop's hurry: the head goes down and holds)
# and the export's two effect sprites, resized whole (not trimmed) to their largest draw at the same density: the breath
# puff (fx.json puff sprite_diameter_frame_px_at_full) and the kicked snow (snow's). Their motion numbers, the nose and
# hoof points per frame and the run's nose per stride are copied from the export's JSON into the spec, never typed in.
import json
import os
import re
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "static", "assets")
SRC = os.path.expanduser("~/Desktop/Run Over Reindeer")
SOURCE = os.path.join(SRC, "animation", "export_2026-11-11", "reindeer")

CLIPS = {
    "walk": ("walk_R", list(range(1, 41, 4))),
    "start": ("walk_start_R", list(range(1, 33, 4))),
    "stop": ("walk_stop_R", list(range(1, 37, 4)) + [36]),
    "sniff": ("sniff_loop_R", list(range(1, 101, 6))),
}
CHARGE_SOURCE = os.path.join(SRC, "animation", "export_2026-11-20_charge", "reindeer")
CHARGE_CLIPS = {
    "charge": ("charge_slow_R", list(range(1, 22))),
    "chargeDown": ("charge_down_R", list(range(1, 5))),
}
CHARGE_PREFIX = "roamc"
# (2026-11-17, the owner after a side by side: half the frames. The sheets' file names carry "roam2" so the first build's
# roam-<tier>-<n>.webp stay on disk untouched; nothing references them any more.)
SHEET_PREFIX = "roam2"
# the same density rule as the run's side view (tools/build_assets.py RUN_CSS_PER_ROAD, RUN_DRAW_SCALE R)
CSS_PER_ROAD = {"full": 1.5 * 982 / 1536, "phone": 0.39}
DRAW_SCALE = {"full": 0.72, "phone": 0.8}
SHEET_MAX = 2048
WEBP = dict(quality=90, alpha_quality=90, method=6)


def resize_box(im, bw, bh):
    arr = np.asarray(im).astype(np.float32) / 255.0
    arr[..., :3] *= arr[..., 3:4]
    pm = Image.fromarray((arr * 255).round().astype(np.uint8), "RGBA").resize((bw, bh), Image.LANCZOS)
    o = np.asarray(pm).astype(np.float32) / 255.0
    alpha = np.clip(o[..., 3:4], 1e-6, 1)
    o[..., :3] = np.clip(o[..., :3] / alpha, 0, 1)
    return Image.fromarray((o * 255).round().astype(np.uint8), "RGBA")


# THE CHARGE CLIPS' REACH (2026-11-20), read from their frames at the native render, frame px from the anchor: `up`,
# `back`, `fwd` are the solid ink (alpha >= SOLID: his body, antlers and the light bulbs), `glow*` all ink (the bulbs'
# soft glow too). The roam's keep-outs use the solid ink for these two clips (game/road/roam.ts ROAM_REACH): their boxes
# (1160 up) count the bulbs' glow, which only the lowered head's antlers raise that high, and on the desktop that box left
# him almost no spot to stand on (265 of 300 seeded picks found none). The glow may lie up to (glowUp - up) past it.
SOLID = 128


def ink_reach(src, clip, frames, m):
    ax, ay = m["anchor_px"]
    up = back = fwd = gup = gback = gfwd = 0
    for f in frames:
        a = np.asarray(Image.open(os.path.join(src, clip, f"{f:04d}.png")).convert("RGBA"))[..., 3]
        for thr, glow in ((SOLID - 1, False), (1, True)):
            ys, xs = np.where(a > thr)
            u, b, w = ay - int(ys.min()), ax - int(xs.min()), int(xs.max()) + 1 - ax
            if glow:
                gup, gback, gfwd = max(gup, u), max(gback, b), max(gfwd, w)
            else:
                up, back, fwd = max(up, u), max(back, b), max(fwd, w)
    return {"up": up, "back": back, "fwd": fwd, "glowUp": gup, "glowBack": gback, "glowFwd": gfwd}


def pack(pictures):
    """the shelf packing (tallest first, SHEET_MAX pages, a 2 px gap): the rule the roam sheets were packed by"""
    gap = 2
    order = sorted(pictures.items(), key=lambda kv: (-kv[1][0].height, kv[0]))
    sheets = []
    cur = {"place": {}, "w": 0, "h": 0}
    x = y = shelf = 0
    for key, (im, _, _) in order:
        if x and x + im.width > SHEET_MAX:
            x = 0
            y += shelf + gap
            shelf = 0
        if y + im.height > SHEET_MAX:
            sheets.append(cur)
            cur = {"place": {}, "w": 0, "h": 0}
            x = y = shelf = 0
        cur["place"][key] = (x, y)
        cur["w"] = max(cur["w"], x + im.width)
        cur["h"] = max(cur["h"], y + im.height)
        x += im.width + gap
        shelf = max(shelf, im.height)
    sheets.append(cur)
    return sheets


def main():
    out_dir = os.path.join(OUT, "reindeer")
    os.makedirs(out_dir, exist_ok=True)
    index = json.load(open(os.path.join(SOURCE, "index.json")))
    k = index["road_px_per_frame_px"]
    spec = {"source": "animation/export_2026-11-11/reindeer (rig reindeer-rig, 2026-11-11)", "fps": 30, "roadPxPerFramePx": k, "clips": {}, "tiers": {}}
    manifests = {}
    cindex = json.load(open(os.path.join(CHARGE_SOURCE, "index.json")))
    if abs(cindex["road_px_per_frame_px"] - k) > 1e-9:
        sys.exit(f"build_roam: the charge export's road_px_per_frame_px {cindex['road_px_per_frame_px']} is not the roam's {k}")
    groups = (("roam", SOURCE, CLIPS), ("charge", CHARGE_SOURCE, CHARGE_CLIPS))
    for _, src, clips in groups:
        for name, (clip, frames) in clips.items():
            m = json.load(open(os.path.join(src, f"{clip}.json")))
            manifests[name] = m
            c = {"source": clip, "frames": frames, "rigFrames": m["frames"], "loop": bool(m.get("loop")), "frameW": m["frame_w"], "frameH": m["frame_h"], "anchorX": m["anchor_px"][0], "anchorY": m["anchor_px"][1]}
            if "ground_speed_frame_px_per_frame" in m:
                c["groundSpeed"] = m["ground_speed_frame_px_per_frame"]
            if "advance_frame_px" in m:
                c["advance"] = [round(v, 4) for v in m["advance_frame_px"]]
            # the charge clips: the nose and the near front hoof per frame (frame px from the anchor, x the way he faces,
            # y down) and the rig's beats
            if "nose" in m:
                c["nose"] = [[round(v, 2) for v in q] for q in m["nose"]]
            if "hoof_fr" in m:
                c["hoof"] = [[round(v, 2) for v in q] for q in m["hoof_fr"]]
            if "beats" in m:
                c["beats"] = m["beats"]
            if src == CHARGE_SOURCE:
                c["reach"] = ink_reach(src, clip, frames, m)
            if len(frames) != len(set(frames)) or (src == CHARGE_SOURCE and frames != list(range(1, m["frames"] + 1))):
                sys.exit(f"build_roam: {clip} must pack every frame, 1 to {m['frames']}")
            spec["clips"][name] = c
    fx = json.load(open(os.path.join(CHARGE_SOURCE, "fx.json")))
    spec["fx"] = {
        "source": "animation/export_2026-11-20_charge/reindeer/fx.json (rig reindeer-rig, 2026-11-20)",
        "puff": {kk: v for kk, v in fx["puff"].items() if kk not in ("start", "carry", "sprite")},
        "snow": {kk: v for kk, v in fx["snow"].items() if kk not in ("start", "rule", "sprite", "vx_frame_px_per_ms", "vy_frame_px_per_ms")},
        "runNose": [[round(v, 2) for v in q] for q in fx["run_nose"]],
    }
    # (the snow's speeds are written in the export as text: "-(0.14..0.62) x power"; read the two numbers out of it)
    for axis in ("vx", "vy"):
        text = fx["snow"][f"{axis}_frame_px_per_ms"]
        lo, hi = (float(v) for v in re.search(r"\(([0-9.]+)\.\.([0-9.]+)\)", text).groups())
        spec["fx"]["snow"][f"{axis}_frame_px_per_ms"] = [-hi, -lo]
    tau = re.search(r"tau ([0-9.]+) ms", fx["puff"]["carry"])
    spec["fx"]["puff"]["carry_tau_ms"] = float(tau.group(1))
    spec["fx"]["puff"]["offset_frame_px"] = [float(v) for v in re.search(r"\+ \(([0-9.]+)\*i, ([0-9.]+)\*i\)", fx["puff"]["start"]).groups()]
    FX = {"puff": (os.path.join(CHARGE_SOURCE, fx["puff"]["sprite"]), fx["puff"]["sprite_diameter_frame_px_at_full"]), "snow": (os.path.join(CHARGE_SOURCE, fx["snow"]["sprite"]), fx["snow"]["sprite_diameter_frame_px_at_full"])}
    for tier in ("full", "phone"):
        d = 3 * CSS_PER_ROAD[tier] * DRAW_SCALE[tier] * k
        files = []
        frames_out = {}
        boxes = {}
        fx_out = {}
        for group, src, clips in groups:
            pictures = {}
            for name, (clip, frames) in clips.items():
                m = manifests[name]
                bw, bh = round(m["frame_w"] * d), round(m["frame_h"] * d)
                boxes[name] = (bw, bh)
                for f in frames:
                    im = Image.open(os.path.join(src, clip, f"{f:04d}.png")).convert("RGBA")
                    if im.size != (m["frame_w"], m["frame_h"]):
                        sys.exit(f"build_roam: {clip} frame {f} is {im.size}, the manifest says {m['frame_w']} x {m['frame_h']}")
                    small = resize_box(im, bw, bh)
                    a = np.asarray(small)[..., 3]
                    ys, xs = np.where(a > 1)
                    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
                    pictures[(name, f)] = (small.crop((x0, y0, x1, y1)), x0, y0)
            if group == "charge":
                # the effect sprites, whole (a round puff, a round speck), at their largest draw at this density
                for name, (file, diameter) in FX.items():
                    im = Image.open(file).convert("RGBA")
                    side = max(2, round(diameter * d))
                    pictures[("fx", name)] = (resize_box(im, side, side), 0, 0)
            n0 = len(files)
            sheets = pack(pictures)
            for n, sh in enumerate(sheets):
                page = Image.new("RGBA", (sh["w"], sh["h"]), (0, 0, 0, 0))
                for key, (px, py) in sh["place"].items():
                    im, ox, oy = pictures[key]
                    page.paste(im, (px, py))
                    name, f = key
                    if name == "fx":
                        fx_out[f] = {"sheet": n0 + n, "x": px, "y": py, "w": im.width, "h": im.height, "diameterFramePx": FX[f][1]}
                        continue
                    frames_out.setdefault(name, {})[str(f)] = {"sheet": n0 + n, "x": px, "y": py, "w": im.width, "h": im.height, "ox": ox, "oy": oy}
                prefix = SHEET_PREFIX if group == "roam" else CHARGE_PREFIX
                fname = f"{prefix}-{tier}-{n}.webp"
                path = os.path.join(out_dir, fname)
                page.save(path, **WEBP)
                files.append({"file": f"reindeer/{fname}", "width": sh["w"], "height": sh["h"], "group": group})
                print(f"  roam {fname}: {sh['w']} x {sh['h']}, {len(sh['place'])} pictures, {os.path.getsize(path) // 1024} KB")
        gpu = {g: round(sum(f["width"] * f["height"] * 4 for f in files if f["group"] == g) / 1048576, 1) for g, _, _ in groups}
        kb = {g: sum(os.path.getsize(os.path.join(OUT, f["file"])) for f in files if f["group"] == g) // 1024 for g, _, _ in groups}
        spec["tiers"][tier] = {"density": round(d, 4), "boxes": {nm: {"w": b[0], "h": b[1]} for nm, b in boxes.items()}, "sheets": files, "frames": frames_out, "fx": fx_out, "gpuMb": gpu["roam"], "chargeGpuMb": gpu["charge"], "chargeKb": kb["charge"]}
        print(f"  roam {tier}: {len(files)} sheets, {gpu} MB on the GPU (no mip chain), download {kb} KB")
    path = os.path.join(APP, "src", "game", "reindeerRoamSpec.ts")
    with open(path, "w") as fh:
        fh.write("// AUTO-GENERATED by tools/build_roam.py from the rig's exports (walk, walk start, walk stop, sniff; the charge wind-up and its\n")
        fh.write("// effects). Do not edit: change the\n")
        fh.write("// tool and run it again. Frame px are the rig's 1536 render; sheet px are this tier's pages; road px = frame px x roadPxPerFramePx.\n")
        fh.write(f"export const REINDEER_ROAM = {json.dumps(spec, indent=chr(9))} as const;\n")
    print(f"  wrote {os.path.relpath(path, APP)}")


if __name__ == "__main__":
    main()
