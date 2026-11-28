"""Build the Grandma Wild's brawl cloud sheets (loop, landing, win) from Corey's approved keyed clips.

Run at low priority with the math env's Python:
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_brawl.py
Then `node scripts/stamp-assets.mjs` (pnpm dev and pnpm build run it for you).
    --out <dir>   write the sheets to <dir>/brawl and the spec to <dir>/brawlClipSpec.ts (nothing in the app touched)

Sources (read only, never changed): art-src/animation/grandma_brawl/ (tools/_paths.py)
  loop_v1_keyed/     96 keyed frames, 1708 x 960 (2x the 854 x 480 clip), brawl_loop_draft_v1 (Corey: "Brawl draft 1
                     looks good"; frame 97 duplicated frame 1 and was dropped)
  landing_v3_keyed/  41 keyed frames of brawl_landing_draft_v3 (option C keeps 10 of them)
  win_v2_keyed/      97 keyed frames of brawl_win_draft_v2 (Corey: "Win beat yes")
  landing_preview.html, win_preview.html   the approved pages: their data tables (the landing's car match K0 and car
                     point, the cut table to the loop, the win's head-up frames and its entry table) are read from them
  landing_assets/    star.png (the contact star of option C) and sprite.json (its place, the clip's reindeer feet)
The keying, the upscale and every number below are the grandma_brawl NOTES.md's; this tool only crops, thins and packs.

THE CROP, all three clips ("a", Corey's pick): the still's 1.4:1 crop (A_final px 61, 10 to 1473, 1019) mapped into the
clip, exactly crop_pack.py's BOX_A: the Grandma Wild's box of 248 x 176.5 road px ("u", road px at the loop's scale,
from the cell's centre). Everything outside is cut here; the game crops further by each frame's texture frame (the
box drawn, and the landing's moving, scaled clip inside it).

THE FRAMES KEPT (NOTES.md, the previews as played):
  loop     every 2nd frame from frame 1 (48), played at 12 fps: the 4.0 s loop
  landing  option C: 10, 12, 14, 16, 18, 20, 22, 24, 25, 26 (the clip is drawn on twos from frame 8), the game plays
           them on its own clock (GRANDMA_BRAWL.landing: 10x the clip's 24 fps to the cover frame 16, then 1.5x)
  win      the "about 2.0 s" trim: frames 1 to 45 then 90 to 97, every 2nd of those (and the last): 27 at 12 fps
  still    the loop's frame 1 (the shared still A) on its own small sheet: what a Wild shows until the loop is in
  star     option C's contact star (landing_assets/star.png, the A still's starburst)

THE DENSITIES (sheet px per road px; NOTES.md's recommendation): full 1.5 (d150: 2 device px per CSS px on a 1440 x
900 desktop, the game's desktop render cap of 2; 3x would be d215 and is wasted under that cap) and phone 0.76 (p076:
3 device px per CSS px on the 390 x 844 phone's 63 CSS px cell). Pages at most 2048 a side, frames on a grid with a
2 px gap, premultiplied LANCZOS, WebP quality 85 / alpha 80 / method 6 (build_columns.py's). GPU = page w x h x 4.
"""
import glob
import json
import os
import re
import sys

import numpy as np
from PIL import Image
from _paths import ART_SRC  # noqa: E402  (tools/_paths.py: the app's art-src/ folder)

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT_ROOT = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
OUT = os.path.join(OUT_ROOT, "brawl") if OUT_ROOT else os.path.join(APP, "static", "assets", "brawl")
SPEC_PATH = os.path.join(OUT_ROOT, "brawlClipSpec.ts") if OUT_ROOT else os.path.join(APP, "src", "game", "brawlClipSpec.ts")
SRC = os.path.join(ART_SRC, "animation/grandma_brawl")

TIER_SCALE = {"full": 1.5, "phone": 0.76}
SHEET_MAX, GAP = 2048, 2
WEBP = dict(quality=85, alpha_quality=80, method=6)

# ---- the cell crop (crop_pack.py, verbatim) -------------------------------------------------------------------------
CELL_W, CELL_H = 248.0, 176.5
S = 1308 / 1532
OX, OY = 306 - 2 * S, 108 - 9 * S
K = 2.0


def a2k(x, y):
    return ((OX + x * S) * 854 / 1920 * K, (OY + y * S) * 480 / 1080 * K)


CX0, CY0 = a2k(61, 10)
CX1, CY1 = a2k(1473, 1019)
BOX_A = (CX0, CY0, CX1, CY1)

KEEP = {
    "loop": list(range(1, 97, 2)),
    "land": [10, 12, 14, 16, 18, 20, 22, 24, 25, 26],
}
WIN_TRIM = (45, 90)


def win_frames():
    seq = list(range(1, WIN_TRIM[0] + 1)) + list(range(WIN_TRIM[1], 98))
    return [f for i, f in enumerate(seq) if i % 2 == 0 or i == len(seq) - 1]


KEEP["win"] = win_frames()
FOLDER = {"loop": "loop_v1_keyed", "land": "landing_v3_keyed", "win": "win_v2_keyed"}
FPS = {"loop": 12, "land": 24, "win": 12}


def page_data(name, start):
    """the JSON object a preview page declares after `start` (read only)"""
    text = open(os.path.join(SRC, name)).read()
    i = text.index(start) + len(start)
    depth, j = 0, i
    while True:
        ch = text[j]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[i : j + 1])
        j += 1


def frame(clip, n):
    path = os.path.join(SRC, FOLDER[clip], f"f_{n:03d}.png")
    im = Image.open(path)
    im.load()
    return im.convert("RGBA")


def crop_scale(im, box, w, h):
    pad = 400
    big = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    big.paste(im, (pad, pad))
    b = tuple(v + pad for v in box)
    return big.convert("RGBa").resize((w, h), Image.LANCZOS, box=b, reducing_gap=2.0).convert("RGBA")


def write_sheets(frames, stem):
    """equal frames on a grid, as few pages of at most SHEET_MAX as it takes, the frames shared evenly between them"""
    fw, fh = frames[0].size
    cols = max(1, (SHEET_MAX + GAP) // (fw + GAP))
    rows = max(1, (SHEET_MAX + GAP) // (fh + GAP))
    per = cols * rows
    pages = -(-len(frames) // per)
    per = -(-len(frames) // pages)
    sheets, total_bytes, total_px = [], 0, 0
    for n, start in enumerate(range(0, len(frames), per)):
        part = frames[start : start + per]
        uc = min(cols, len(part))
        ur = -(-len(part) // cols)
        sh = Image.new("RGBA", (uc * (fw + GAP) - GAP, ur * (fh + GAP) - GAP), (0, 0, 0, 0))
        for i, im in enumerate(part):
            sh.paste(im, ((i % cols) * (fw + GAP), (i // cols) * (fh + GAP)))
        name = f"{stem}-{n}.webp"
        path = os.path.join(OUT, name)
        sh.save(path, **WEBP)
        total_bytes += os.path.getsize(path)
        total_px += sh.width * sh.height
        sheets.append({"file": f"brawl/{name}", "width": sh.width, "height": sh.height, "frames": len(part)})
    tier = {"sheets": sheets, "columns": cols, "gap": GAP, "frameWidth": fw, "frameHeight": fh}
    return tier, {"gpuMb": round(total_px * 4 / 1048576, 2), "kb": round(total_bytes / 1024, 1)}


def suffix(tier):
    return "" if tier == "full" else f"-{tier}"


def main():
    os.makedirs(OUT, exist_ok=True)
    land = page_data("landing_preview.html", "const DATA = ")
    win = page_data("win_preview.html", "const { LOOP, WIN, TRIMS, ENTRY } = ")
    spr = json.load(open(os.path.join(SRC, "landing_assets", "sprite.json")))
    if win["TRIMS"]["about 2.0 s"] != list(WIN_TRIM):
        raise SystemExit(f"the win page's 2.0 s trim is {win['TRIMS']['about 2.0 s']}, the tool has {WIN_TRIM}")
    spec = {
        "cell": {"width": CELL_W, "height": CELL_H},
        "tierScale": TIER_SCALE,
        "clips": {},
        "budget": {},
    }
    for clip in ("loop", "land", "win"):
        keep = KEEP[clip]
        src = [frame(clip, n) for n in keep]
        entry = {"fps": FPS[clip], "frames": keep, "count": len(keep), "tiers": {}}
        for tier, d in TIER_SCALE.items():
            w, h = round(CELL_W * d), round(CELL_H * d)
            part, cost = write_sheets([crop_scale(im, BOX_A, w, h) for im in src], f"{clip}{suffix(tier)}")
            entry["tiers"][tier] = part
            spec["budget"][f"{clip}:{tier}"] = cost
            print(clip, tier, f"{len(keep)} frames {w}x{h}", f"{len(part['sheets'])} page(s)", cost)
        spec["clips"][clip] = entry
    # the still: the loop's frame 1, its own small sheet
    still = frame("loop", 1)
    spec["still"] = {"tiers": {}}
    for tier, d in TIER_SCALE.items():
        w, h = round(CELL_W * d), round(CELL_H * d)
        part, cost = write_sheets([crop_scale(still, BOX_A, w, h)], f"still{suffix(tier)}")
        spec["still"]["tiers"][tier] = part
        spec["budget"][f"still:{tier}"] = cost
        print("still", tier, cost)
    # the contact star (3.2 px per road px in landing_assets)
    star = Image.open(os.path.join(SRC, "landing_assets", "star.png")).convert("RGBA")
    spec["star"] = {"width": spr["star"]["w"], "height": spr["star"]["h"], "at": spr["star"]["at"], "tiers": {}}
    for tier, d in TIER_SCALE.items():
        w, h = max(1, round(spr["star"]["w"] * d * 1.15)), max(1, round(spr["star"]["h"] * d * 1.15))
        im = star.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")
        part, cost = write_sheets([im], f"star{suffix(tier)}")
        spec["star"]["tiers"][tier] = part
        spec["budget"][f"star:{tier}"] = cost
    # THE LANDING'S DATA (landing_preview.html): the clip's car bottom centre in u, the match to the game's car, the
    # clip's own shove on its frame 2 (u), the reindeer's feet in the clip from the car's bottom centre (road px), and the
    # loop frame each landing frame cuts to best (1-based source frames of both)
    L = land["LAND"]
    spec["land"] = {
        "k0": L["k0"],
        "carU": L["car_u"],
        "shoveU": 15.7,
        "cut": land["CUT"],
        "deerFeetFromCar": spr["deer"]["clip_feet_from_car"],
        "carWidth": spr["car"]["w"],
    }
    # THE WIN'S DATA (win_preview.html): per kept frame whether the head is up (WILD's fade), and per loop frame (kept
    # index) the kept win frame the beat enters at (the wind up frame most like it; the page's ENTRY table)
    up = win["WIN"]["up"]
    E = win["ENTRY"]
    frames = KEEP["win"]
    enter = []
    for i in range(len(KEEP["loop"])):
        e = E[KEEP["loop"][i] - 1] if KEEP["loop"][i] - 1 < len(E) else 1
        k = next((j for j, f in enumerate(frames) if f >= e), 0)
        enter.append(k)
    spec["win"] = {"headUp": [bool(up[f - 1]) for f in frames], "enterAt": enter}
    total = {t: round(sum(v["gpuMb"] for k, v in spec["budget"].items() if k.endswith(":" + t)), 2) for t in TIER_SCALE}
    kb = {t: round(sum(v["kb"] for k, v in spec["budget"].items() if k.endswith(":" + t)), 1) for t in TIER_SCALE}
    print("all resident", total, "MB;", kb, "KB")
    with open(SPEC_PATH, "w") as fh:
        fh.write("// AUTO-GENERATED by tools/build_brawl.py from the approved brawl clips (Desktop/Run Over Reindeer/animation/\n")
        fh.write("// grandma_brawl). Do not edit: change the tool and run it again. Lengths in road px at the loop's scale (u, the\n")
        fh.write("// Grandma Wild box of 248 x 176.5 from its centre); sheet sizes in sheet px; budget per clip and tier (GPU MB, KB).\n")
        fh.write(f"export const BRAWL_CLIPS = {json.dumps(spec, indent=chr(9))} as const;\n")
    print("wrote", SPEC_PATH)


if __name__ == "__main__":
    main()
