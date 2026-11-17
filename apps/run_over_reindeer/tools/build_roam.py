# THE ROAMING REINDEER'S SHEETS (2026-11-17): the rig's walk, walk start, walk stop and sniff (idle) clips, packed from
# the SAME export the strike's run views come from (animation/export_2026-11-11/reindeer, README.txt beside it). No new
# art: these clips were rendered with the run and were "stage 2, not packed" until now (tools/build_assets.py).
#
#   math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_roam.py
#
# Writes static/assets/reindeer/roam-<tier>-<n>.webp and src/game/reindeerRoamSpec.ts (generated). Pixel work only.
#
# WHAT IS PACKED (frames of the rig's 30 fps clips; the game plays them on the rig's own frame clock, game/road/roam.ts):
#   walk        every 2nd frame of the 40 frame loop (15 fps): 1, 3 .. 39
#   start       every 2nd frame of walk_start (1 .. 31): it ends on walk frame 38, the game goes on from walk 39
#   stop        every 2nd frame of walk_stop (1 .. 35) and its last (36, the stand); its frame 1 follows walk frame 8
#   sniff       every 3rd frame of the 100 frame idle loop (10 fps): 1, 4 .. 100; frame 1 is the stand
# Each frame is resized as its whole box at the strike's side run density (3 physical px per CSS px at the largest draw:
# the same numbers as build_assets.py RUN_CSS_PER_ROAD and the R view's draw scale), then trimmed to its ink.
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "static", "assets")
SRC = os.path.expanduser("~/Desktop/Run Over Reindeer")
SOURCE = os.path.join(SRC, "animation", "export_2026-11-11", "reindeer")

CLIPS = {
    "walk": ("walk_R", list(range(1, 41, 2))),
    "start": ("walk_start_R", list(range(1, 33, 2))),
    "stop": ("walk_stop_R", list(range(1, 37, 2)) + [36]),
    "sniff": ("sniff_loop_R", list(range(1, 101, 3))),
}
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


def main():
    out_dir = os.path.join(OUT, "reindeer")
    os.makedirs(out_dir, exist_ok=True)
    index = json.load(open(os.path.join(SOURCE, "index.json")))
    k = index["road_px_per_frame_px"]
    spec = {"source": "animation/export_2026-11-11/reindeer (rig reindeer-rig, 2026-11-11)", "fps": 30, "roadPxPerFramePx": k, "clips": {}, "tiers": {}}
    manifests = {}
    for name, (clip, frames) in CLIPS.items():
        m = json.load(open(os.path.join(SOURCE, f"{clip}.json")))
        manifests[name] = m
        c = {"source": clip, "frames": frames, "rigFrames": m["frames"], "loop": bool(m.get("loop")), "frameW": m["frame_w"], "frameH": m["frame_h"], "anchorX": m["anchor_px"][0], "anchorY": m["anchor_px"][1]}
        if "ground_speed_frame_px_per_frame" in m:
            c["groundSpeed"] = m["ground_speed_frame_px_per_frame"]
        if "advance_frame_px" in m:
            c["advance"] = [round(v, 4) for v in m["advance_frame_px"]]
        spec["clips"][name] = c
    for tier in ("full", "phone"):
        d = 3 * CSS_PER_ROAD[tier] * DRAW_SCALE[tier] * k
        pictures = {}
        boxes = {}
        for name, (clip, frames) in CLIPS.items():
            m = manifests[name]
            bw, bh = round(m["frame_w"] * d), round(m["frame_h"] * d)
            boxes[name] = (bw, bh)
            for f in frames:
                im = Image.open(os.path.join(SOURCE, clip, f"{f:04d}.png")).convert("RGBA")
                if im.size != (m["frame_w"], m["frame_h"]):
                    sys.exit(f"build_roam: {clip} frame {f} is {im.size}, the manifest says {m['frame_w']} x {m['frame_h']}")
                small = resize_box(im, bw, bh)
                a = np.asarray(small)[..., 3]
                ys, xs = np.where(a > 1)
                x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
                pictures[(name, f)] = (small.crop((x0, y0, x1, y1)), x0, y0)
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
        files = []
        frames_out = {name: {} for name in CLIPS}
        for n, sh in enumerate(sheets):
            page = Image.new("RGBA", (sh["w"], sh["h"]), (0, 0, 0, 0))
            for key, (px, py) in sh["place"].items():
                im, ox, oy = pictures[key]
                page.paste(im, (px, py))
                name, f = key
                frames_out[name][str(f)] = {"sheet": n, "x": px, "y": py, "w": im.width, "h": im.height, "ox": ox, "oy": oy}
            fname = f"roam-{tier}-{n}.webp"
            path = os.path.join(out_dir, fname)
            page.save(path, **WEBP)
            files.append({"file": f"reindeer/{fname}", "width": sh["w"], "height": sh["h"]})
            print(f"  roam {fname}: {sh['w']} x {sh['h']}, {len(sh['place'])} frames, {os.path.getsize(path) // 1024} KB")
        gpu = sum(f["width"] * f["height"] * 4 for f in files) / 1048576
        spec["tiers"][tier] = {"density": round(d, 4), "boxes": {nm: {"w": b[0], "h": b[1]} for nm, b in boxes.items()}, "sheets": files, "frames": frames_out, "gpuMb": round(gpu, 1)}
        print(f"  roam {tier}: {len(files)} sheets, {gpu:.1f} MB on the GPU (no mip chain)")
    path = os.path.join(APP, "src", "game", "reindeerRoamSpec.ts")
    with open(path, "w") as fh:
        fh.write("// AUTO-GENERATED by tools/build_roam.py from the rig's export (walk, walk start, walk stop, sniff). Do not edit: change the\n")
        fh.write("// tool and run it again. Frame px are the rig's 1536 render; sheet px are this tier's pages; road px = frame px x roadPxPerFramePx.\n")
        fh.write(f"export const REINDEER_ROAM = {json.dumps(spec, indent=chr(9))} as const;\n")
    print(f"  wrote {os.path.relpath(path, APP)}")


if __name__ == "__main__":
    main()
