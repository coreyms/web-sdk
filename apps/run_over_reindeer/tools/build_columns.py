"""Build the column Wild characters' sprite sheets from Corey's nine approved clips.

Run at low priority with the math env's Python (it reads about 220 big PNGs):
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_columns.py
Then `node scripts/stamp-assets.mjs` (pnpm dev and pnpm build run it for you).
Only the cloud still behind a standing column (a few seconds, the sheets are left alone):
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_columns.py --backdrop
Only some densities, added to what is there (the others' files and spec entries are left alone):
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_columns.py --tiers d150,d215
Only the landing screen's stills (one small sheet per tier, added to the spec that is there; a whole build makes them too):
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_columns.py --landing

Sources (read only, never changed): ~/Desktop/Run Over Reindeer/animation/<clip>/<keyed folder>/, 97 keyed frames
of 1920 x 3408 at 24 fps per clip: entrance (reveal), idle and win for the reindeer, Santa and Grandma columns.
Some frames are iCloud placeholders: every frame is read whole once to fetch it, with retries. A frame that cannot be
fetched STOPS the build with its name, so a sheet never ships with a gap.

Writes inside this app:
  static/assets/columns/<tier>-<clip>-<n>.webp          the desktop tier's sheets
  static/assets/columns/<tier>-<clip>-phone-<n>.webp    the phone tier's sheets
  static/assets/columns/<tier>-<clip>-d150-<n>.webp     1.5 px per road px  } only for the staging switch
  static/assets/columns/<tier>-<clip>-d215-<n>.webp     2.15 px per road px } `?rescap=` (COLUMN_DENSITY_TEST.md)
  static/assets/columns/cloud-backdrop[-phone|-d150|-d215].webp   the still cloud behind a standing column
  static/assets/columns/landing-stills[-phone].webp     the landing screen's posed columns: the cloud still and one
                                                        hand-picked idle frame of each character (LANDING below)
  src/game/columnClipSpec.ts                            what the game needs to place and play them (generated)

HOW A FRAME SITS ON THE BOARD. The clips were drawn 9:16; a column on the board is one column wide (250 road px) and
four lanes tall (684 road px), which is narrower. The frame is fitted by HEIGHT: its 3408 px are the column's 684 road
px, so a frame is 385 road px wide and the character stands on the column's foot, as wide as it was drawn (the
reindeer 299 road px over its antlers, Santa 336, Grandma 308 and three quarters of the height). What is wider than
the column spills over the neighbors, which the spec wants ("spill over").

THE CLOUD STAYS IN THE BOX. The entrance clips start as a cloud that fills the whole frame, which would cover a third
of each neighbor column. Every entrance frame that still has cloud in it is therefore blanked outside the column's
own 250 road px (offline, here), so the cloud is contained by the red box the game draws and only the finished
character spills.

THE CLOUD BEHIND A STANDING COLUMN (Corey 2026-11-10: "we should take a still image of the smoke to put behind the
characters, so it's not plain road behind them in their boxes"). One still for all three tiers: the Grandma entrance's
frame 37, the one full-cloud frame of the three entrances with no figure in it (the reindeer's and Santa's frame 37
already carry a silhouette, which would leave a figure shaped hole behind the standing character). It is cut to the
column's own 250 x 684 road px and made fully opaque. BACKDROP below names the frame.

THE MEMORY BUDGET (docs/SECOND_PASS_DECISIONS.md has the measured numbers this prints):
  frames kept   idle every 3rd frame (32 frames, played at 8 fps: the clip's own 4 s loop, held timing)
                win every 2nd frame (48 frames, played at 24 fps: 2 s, twice the clip's speed)
                entrance from frame 37 (the cloud is full, the debris has gone) every 2nd frame to the last
                (31 frames, played at 24 fps, the last held to 1.33 s: the spec's 1.2 to 1.5 s)
                (2026-11-19, the column smoothness mock, Desktop/Run Over Reindeer/column_smooth_r1_2026-11-19; Corey:
                "it looks fine in Win and Entrance with the suggested method, but not on idle". Until then the win and
                the entrance kept every 4th frame at 12 fps: 24 and 16 frames, the same lengths. The idle is unchanged
                and never blended.)
  pixel size    desktop 1.0 px per road px, phone 0.7. The house rule of 3 physical px per CSS px would be 3.2 px
                per road px on a 1920 x 1080 screen: ten times the memory, about 1.6 GB with three tiers up. Corey on
                these clips: "It's a basic cartoon, so upscaling is fine".
  loading       per tier and per clip, only when a book calls for that tier; the entrance is dropped after it has
                played; idle and win are dropped when no column of that tier is left (game/road/columnClips.ts).
"""
import glob
import json
import os
import sys
import time

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "static", "assets", "columns")
# --out <dir>: write the sheets to <dir>/columns and the spec to <dir>/columnClipSpec.ts instead (a build to look at
# before it replaces the game's; nothing in the app is touched)
OUT_ROOT = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
if OUT_ROOT:
    OUT = os.path.join(OUT_ROOT, "columns")
SRC = os.path.expanduser("~/Desktop/Run Over Reindeer/animation")

FRAME_W, FRAME_H = 1920, 3408
# the column on the board, road px (tools/build_assets.py: pitch 250, lane lines 167 to 851)
COLUMN_W, COLUMN_H = 250, 684
ROAD_PER_SRC = COLUMN_H / FRAME_H  # the frame is fitted by height
# the column's own width inside the frame, source px (the cloud is kept inside it)
BOX_X0 = (FRAME_W - COLUMN_W / ROAD_PER_SRC) / 2
BOX_X1 = FRAME_W - BOX_X0

# sheet px per road px. "full" (desktop) and "phone" are the defaults the game picks by device (game/deviceTier.ts);
# d150 and d215 are the sharper sets the staging switch `?rescap=<n>` can ask for (game/road/columnClips.ts,
# docs/COLUMN_DENSITY_TEST.md). Every page stays at most SHEET_MAX a side whatever the density.
TIER_SCALE = {"full": 1.0, "phone": 0.7, "d150": 1.5, "d215": 2.15}
SHEET_MAX = 2048


def suffix(size):
    """the file name part of a density: none for the desktop default, -phone, else -d150 / -d215"""
    return "" if size == "full" else f"-{size}"
WEBP = dict(quality=85, alpha_quality=80, method=6)

SOURCES = {
    "reindeer": {"reveal": "column_reveal/v3_keyed", "idle": "column_idle/v6_keyed_v2", "win": "column_win/v1_keyed"},
    "santa": {"reveal": "santa_reveal/v1_keyed", "idle": "santa_idle/v1_keyed", "win": "santa_win/v1_keyed"},
    "grandma": {"reveal": "grandma_reveal/v1_keyed", "idle": "grandma_idle/v1_keyed", "win": "grandma_win/v1_keyed"},
}
# the still cloud behind a standing column: which entrance and which source frame (1-based), see the note above
BACKDROP = {"tier": "grandma", "frame": 37, "fill": (244, 247, 252)}
# THE LANDING SCREEN'S STILLS (Corey 2026-11-15, the landing mock V2): the three characters stand still on the landing
# board, one idle frame each, picked by hand from the 32 the idle clip keeps (0-based in the clip): where the pose reads
# best. The multiplier covers the same share of the feet on every idle frame (the feet do not move in the idle: 0.225
# of the reindeer's feet, 0.32 of Santa's, 0.31 to 0.32 of Grandma's), so it did not decide the pick.
#   reindeer 6   the antler lights lit, the smirk to the front           (source frame 19)
#   santa    4   facing front, arms akimbo (8 to 15 look aside)         (source frame 13)
#   grandma  0   facing front with her smile (the least covered frame)  (source frame 1)
# Kept as SOURCE frames since 2026-11-19 (the idle's step is a switch, IDLE_STEP): the spec's `landing.frames` is the
# picked frame's index in the idle clip as built (19 is index 9 at every 2nd frame, 6 at every 3rd), so the game hands
# the still over to the loop on the same picture whatever the step.
# Packed on one small sheet per tier with the cloud still, so the landing loads ONE file, at the density the game draws
# the clips at (desktop 1.0 px per road px, phones 0.7): the same picture on the landing as in play, and 60 percent of the bytes
# of 1.5 (160 KB against 266 KB on the desktop, measured 2026-11-15).
LANDING = {"source": {"reindeer": 19, "santa": 13, "grandma": 1}, "tiers": {"full": 1.0, "phone": 0.7}}
# which source frames are kept (1-based) and how fast they play
# `ms` the clip's length (the last frame holds to it): the entrance keeps the 1.33 s it had at 16 frames and 12 fps
# THE IDLE'S STEP, the one switch (Corey 2026-11-19: "idle is worth another shot with your recommendation"): every
# IDLE_STEP-th source frame of the 96 frame, 4 s loop, played at 24 / IDLE_STEP fps, hard cuts, never blended. 2: 48
# frames at 12 fps (since 2026-11-19); 3: 32 frames at 8 fps (until then: the rebuild with 3 brings it back exactly)
IDLE_STEP = 2
PICK = {
    "idle": {"frames": list(range(1, 97, IDLE_STEP)), "fps": 24 // IDLE_STEP, "loop": True, "ms": 4000.0},
    "win": {"frames": list(range(1, 97, 2)), "fps": 24, "loop": False, "ms": 2000.0},
    "reveal": {"frames": list(range(37, 98, 2)), "fps": 24, "loop": False, "ms": round(16 / 12 * 1000, 2)},
}
# THE CLOUD TEST (keep_cloud_in_box): an entrance frame is 'cloud' (blanked outside the column) while this share of the
# strips beside the column is covered. 0.35 until 2026-11-19; with every 2nd frame kept, the reindeer's source frames 94
# and 95 (27% and 20% covered by a faint trailing smoke) would ship with it spilling over the neighbors. Measured over
# every entrance frame 37 to 97: the trailing cloud never covers less than 0.197 (reindeer 95), a standing character
# alone never more than 0.087 (Santa's elbows; the reindeer 0.004, Grandma 0.021), so 0.15 parts them with room both
# ways and the cloud frames stay the first ones (cloudFrames, contiguous: the build stops if not)
CLOUD_SHARE = 0.15


def fetch(path):
    """Read the whole file once (an iCloud placeholder downloads on the first read), with retries."""
    last = None
    for attempt in range(8):
        try:
            with open(path, "rb") as fh:
                while fh.read(1 << 20):
                    pass
            im = Image.open(path)
            im.load()
            return im.convert("RGBA")
        except Exception as error:  # a timeout while iCloud fetches it
            last = error
            time.sleep(4 + 2 * attempt)
    raise RuntimeError(f"could not fetch {path}: {last}")


def alpha_box(images):
    """The union alpha box of a clip's kept frames, source px, on a 8 px grid."""
    x0, y0, x1, y1 = FRAME_W, FRAME_H, 0, 0
    for im in images:
        a = np.asarray(im.split()[3])
        ys, xs = np.where(a > 16)
        if len(xs):
            x0, y0, x1, y1 = min(x0, xs.min()), min(y0, ys.min()), max(x1, xs.max() + 1), max(y1, ys.max() + 1)
    g = 8
    return (int(x0) // g * g, int(y0) // g * g, min(FRAME_W, -(-int(x1) // g) * g), min(FRAME_H, -(-int(y1) // g) * g))


def keep_cloud_in_box(im):
    """An entrance frame that still has cloud in it: nothing outside the column's own width. A frame is 'cloud' while
    the strips outside the box are mostly covered (the character alone covers little of them)."""
    a = np.asarray(im.split()[3])
    left = a[:, : int(BOX_X0)]
    right = a[:, int(BOX_X1) :]
    outside = (float((left > 16).mean()) + float((right > 16).mean())) / 2
    if outside < CLOUD_SHARE:
        return im, False
    arr = np.asarray(im).copy()
    arr[:, : int(round(BOX_X0)), 3] = 0
    arr[:, int(round(BOX_X1)) :, 3] = 0
    return Image.fromarray(arr, "RGBA"), True


def scaled(im, box, px_per_road):
    """Crop to the clip's box and scale to the tier, premultiplied so no dark fringe is pulled out of clear pixels."""
    w = max(1, round((box[2] - box[0]) * ROAD_PER_SRC * px_per_road))
    h = max(1, round((box[3] - box[1]) * ROAD_PER_SRC * px_per_road))
    return im.crop(box).convert("RGBa").resize((w, h), Image.LANCZOS, reducing_gap=2.0).convert("RGBA")


def write_sheets(frames, stem):
    """Lay equal sized frames on a grid, as many sheets of at most SHEET_MAX as it takes. Returns the manifest part."""
    gap = 2
    fw, fh = frames[0].size
    cols = max(1, (SHEET_MAX + gap) // (fw + gap))
    rows = max(1, (SHEET_MAX + gap) // (fh + gap))
    per = cols * rows
    sheets, total_bytes, total_px = [], 0, 0
    for n, start in enumerate(range(0, len(frames), per)):
        part = frames[start : start + per]
        used_cols = min(cols, len(part))
        used_rows = -(-len(part) // cols)
        sheet = Image.new("RGBA", (used_cols * (fw + gap) - gap, used_rows * (fh + gap) - gap), (0, 0, 0, 0))
        for i, im in enumerate(part):
            sheet.paste(im, ((i % cols) * (fw + gap), (i // cols) * (fh + gap)))
        name = f"{stem}-{n}.webp"
        path = os.path.join(OUT, name)
        sheet.save(path, **WEBP)
        total_bytes += os.path.getsize(path)
        total_px += sheet.width * sheet.height
        sheets.append({"file": f"columns/{name}", "width": sheet.width, "height": sheet.height, "frames": len(part)})
    return {"sheets": sheets, "columns": cols, "gap": gap, "frameWidth": fw, "frameHeight": fh}, total_bytes, total_px


SPEC_PATH = os.path.join(APP, "src", "game", "columnClipSpec.ts")


def write_spec(spec):
    with open(os.path.join(OUT_ROOT, "columnClipSpec.ts") if OUT_ROOT else SPEC_PATH, "w") as fh:
        fh.write("// AUTO-GENERATED by tools/build_columns.py from the nine approved clips. Do not edit: change the tool and run it again.\n")
        fh.write("// Lengths are road px from the column's top left corner (the column is 250 x 684 road px); sheet sizes are sheet px.\n")
        fh.write(f"export const COLUMN_CLIPS = {json.dumps(spec, indent=chr(9))} as const;\n")


def backdrop_flat():
    """The still cloud's picture, cut to the column and made opaque (source px), and how much of the column it covers."""
    folder = SOURCES[BACKDROP["tier"]]["reveal"]
    files = sorted(glob.glob(os.path.join(SRC, folder, "*.png")))
    if len(files) != 97:
        sys.exit(f"build_columns: {folder} has {len(files)} frames, expected 97")
    im = fetch(files[BACKDROP["frame"] - 1])
    if im.size != (FRAME_W, FRAME_H):
        sys.exit(f"build_columns: {files[BACKDROP['frame'] - 1]} is {im.size}, expected {FRAME_W} x {FRAME_H}")
    box = im.crop((int(round(BOX_X0)), 0, int(round(BOX_X1)), FRAME_H))
    alpha = np.asarray(box.split()[3])
    cover = float((alpha > 250).mean())
    if cover < 0.99:
        sys.exit(f"build_columns: the backdrop frame covers only {cover:.3f} of the column; pick another frame (BACKDROP)")
    # fully opaque: the few clear pixels of the scalloped foot take the cloud's own white
    flat = Image.new("RGBA", box.size, BACKDROP["fill"] + (255,))
    flat.alpha_composite(box)
    return flat, cover


def build_landing(spec):
    """The landing screen's sheets (LANDING): the cloud still, then the three picked idle frames, left to right with a
    2 px gap. Each idle frame is cut with its clip's own box (read back from the spec), so it sits exactly where the
    clip's frames sit. Returns the spec's `landing` part."""
    flat, _ = backdrop_flat()
    gap = 2
    kept = PICK["idle"]["frames"]
    for tier, n in LANDING["source"].items():
        if n not in kept:
            sys.exit(f"build_columns: the {tier} landing still (source frame {n}) is not among the idle's kept frames (IDLE_STEP {IDLE_STEP})")
    part = {"frames": {tier: kept.index(n) for tier, n in LANDING["source"].items()}, "tiers": {}}
    sources = {}
    for tier, n in LANDING["source"].items():
        clip = spec["clips"][tier]["idle"]
        folder = SOURCES[tier]["idle"]
        files = sorted(glob.glob(os.path.join(SRC, folder, "*.png")))
        im = fetch(files[n - 1])
        # the clip's box back from its placement (source px, on the 8 px grid it was made on)
        x0 = (clip["x"] + (FRAME_W * ROAD_PER_SRC - COLUMN_W) / 2) / ROAD_PER_SRC
        y0 = clip["y"] / ROAD_PER_SRC
        snap = lambda v: int(round(v / 8) * 8)
        box = (snap(x0), snap(y0), snap(x0 + clip["width"] / ROAD_PER_SRC), snap(y0 + clip["height"] / ROAD_PER_SRC))
        sources[tier] = (im, box)
    for size, px in LANDING["tiers"].items():
        pieces = [("backdrop", flat.resize((round(COLUMN_W * px), round(COLUMN_H * px)), Image.LANCZOS, reducing_gap=2.0))]
        pieces += [(tier, scaled(im, box, px)) for tier, (im, box) in sources.items()]
        w = sum(p.width for _, p in pieces) + gap * (len(pieces) - 1)
        h = max(p.height for _, p in pieces)
        sheet = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        frames, x = {}, 0
        for name, p in pieces:
            sheet.paste(p, (x, 0))
            frames[name] = {"x": x, "y": 0, "width": p.width, "height": p.height}
            x += p.width + gap
        name = "landing-stills" + ("" if size == "full" else f"-{size}") + ".webp"
        path = os.path.join(OUT, name)
        sheet.save(path, **WEBP)
        part["tiers"][size] = {"file": f"columns/{name}", "width": w, "height": h, "pxPerRoad": px, "frames": frames}
        print(f"  landing stills {size}: {w} x {h}, {w * h * 4 / 1048576:.2f} MB on the GPU, {os.path.getsize(path) / 1024:.0f} KB file", flush=True)
    return part


def landing_only():
    """--landing: build the landing screen's stills alone and add them to the spec that is already there."""
    os.makedirs(OUT, exist_ok=True)
    spec = read_spec()
    spec["landing"] = build_landing(spec)
    write_spec(spec)


def build_backdrop(sizes=None, part=None):
    """The still cloud behind a standing column, one small picture per tier. Returns its part of the spec.
    `sizes`: only these densities (the others in `part`, the spec already there, are kept as they are)."""
    sizes = list(TIER_SCALE) if sizes is None else sizes
    folder = SOURCES[BACKDROP["tier"]]["reveal"]
    flat, cover = backdrop_flat()
    part = part or {"source": f"{folder} frame {BACKDROP['frame']}", "width": COLUMN_W, "height": COLUMN_H, "tiers": {}}
    for size in sizes:
        px = TIER_SCALE[size]
        w, h = round(COLUMN_W * px), round(COLUMN_H * px)
        name = "cloud-backdrop" + suffix(size) + ".webp"
        path = os.path.join(OUT, name)
        flat.convert("RGB").resize((w, h), Image.LANCZOS, reducing_gap=2.0).save(path, quality=88, method=6)
        part["tiers"][size] = {"file": f"columns/{name}", "width": w, "height": h}
        print(f"  cloud backdrop {size}: {w} x {h}, {w * h * 4 / 1048576:.2f} MB on the GPU, {os.path.getsize(path) / 1024:.0f} KB file (cover {cover:.3f})", flush=True)
    return part


def backdrop_only():
    """--backdrop: build the still alone and add it to the spec that is already there."""
    os.makedirs(OUT, exist_ok=True)
    text = open(SPEC_PATH).read()
    spec = json.loads(text[text.index("{") : text.rindex("}") + 1])
    spec["backdrop"] = build_backdrop()
    write_spec(spec)


def read_spec():
    # (a --out build adds to the spec it has written there before, else to the app's)
    path = os.path.join(OUT_ROOT, "columnClipSpec.ts") if OUT_ROOT and os.path.exists(os.path.join(OUT_ROOT, "columnClipSpec.ts")) else SPEC_PATH
    text = open(path).read()
    return json.loads(text[text.index("{") : text.rindex("}") + 1])


def main():
    if "--backdrop" in sys.argv:
        return backdrop_only()
    if "--landing" in sys.argv:
        return landing_only()
    os.makedirs(OUT, exist_ok=True)
    # --tiers d150,d215: build only these densities and add them to the spec that is already there. The other
    # densities' files and spec entries are left exactly as they are; a clip whose placement no longer matches the
    # spec (the source frames changed) stops the build: then run it whole.
    only = None
    if "--tiers" in sys.argv:
        only = sys.argv[sys.argv.index("--tiers") + 1].split(",")
        for size in only:
            if size not in TIER_SCALE:
                sys.exit(f"build_columns: unknown density {size}; TIER_SCALE has {', '.join(TIER_SCALE)}")
            if size == "full":
                sys.exit("build_columns: the desktop default has no file suffix to sort its sheets by; run the build whole")
    sizes = list(TIER_SCALE) if only is None else only
    # --clips reveal,win: rebuild only these clips, every density, into the spec that is there; the other clips, the
    # cloud still and the landing stills (their files and spec entries) are left exactly as they are, and no file is
    # removed (a clip's sheets are written over by name)
    clips_only = sys.argv[sys.argv.index("--clips") + 1].split(",") if "--clips" in sys.argv else None
    if clips_only is not None:
        if only is not None:
            sys.exit("build_columns: --clips and --tiers do not go together")
        spec = read_spec()
        spec["tierScale"] = dict(TIER_SCALE)
    elif only is None:
        for old in glob.glob(os.path.join(OUT, "*.webp")):
            os.remove(old)  # this app's own built sheets, rebuilt whole
        spec = {"column": {"width": COLUMN_W, "height": COLUMN_H}, "tierScale": TIER_SCALE, "clips": {}}
    else:
        spec = read_spec()
        spec["tierScale"].update({size: TIER_SCALE[size] for size in only})
        for size in only:
            for old in glob.glob(os.path.join(OUT, f"*{suffix(size)}-[0-9]*.webp")) + glob.glob(os.path.join(OUT, f"cloud-backdrop{suffix(size)}.webp")):
                os.remove(old)  # this density's own sheets, rebuilt
    report, missing = [], []
    for tier, clips in SOURCES.items():
        spec["clips"].setdefault(tier, {})
        for clip, folder in clips.items():
            if clips_only is not None and clip not in clips_only:
                continue
            files = sorted(glob.glob(os.path.join(SRC, folder, "*.png")))
            if len(files) != 97:
                sys.exit(f"build_columns: {folder} has {len(files)} frames, expected 97")
            pick = PICK[clip]
            t0 = time.time()
            images, cloud_frames = [], 0
            for n in pick["frames"]:
                try:
                    im = fetch(files[n - 1])
                except RuntimeError as error:
                    missing.append(str(error))
                    continue
                if im.size != (FRAME_W, FRAME_H):
                    sys.exit(f"build_columns: {files[n - 1]} is {im.size}, expected {FRAME_W} x {FRAME_H}")
                if clip == "reveal":
                    im, was_cloud = keep_cloud_in_box(im)
                    # the cloud frames are the first ones (the game crops them on every side, cloudFrames)
                    if was_cloud and cloud_frames < len(images):
                        sys.exit(f"build_columns: {tier} entrance source frame {n} reads as cloud after a frame that did not (CLOUD_SHARE)")
                    cloud_frames += was_cloud
                images.append(im)
            if missing:
                continue
            box = alpha_box(images)
            entry = {
                "fps": pick["fps"],
                "loop": pick["loop"],
                "frames": len(images),
                # the clip's length, ms (its last frame holds to it)
                "ms": pick["ms"],
                # where the frame's box sits, road px from the column's top left corner
                "x": round(box[0] * ROAD_PER_SRC - (FRAME_W * ROAD_PER_SRC - COLUMN_W) / 2, 2),
                "y": round(box[1] * ROAD_PER_SRC, 2),
                "width": round((box[2] - box[0]) * ROAD_PER_SRC, 2),
                "height": round((box[3] - box[1]) * ROAD_PER_SRC, 2),
                "tiers": {},
            }
            if clip == "reveal":
                entry["cloudFrames"] = cloud_frames  # the first frames, where the cloud still fills the box
            if only is not None:
                # adding densities: the clip must sit exactly where the spec already says, then only its tiers grow
                had = spec["clips"][tier][clip]
                same = {k: v for k, v in entry.items() if k != "tiers"} == {k: v for k, v in had.items() if k != "tiers"}
                if not same:
                    sys.exit(f"build_columns: {tier} {clip} no longer matches the spec (the source frames changed?); run the build whole")
                entry = had
            for size in sizes:
                px = TIER_SCALE[size]
                stem = f"{tier}-{clip}" + suffix(size)
                part, nbytes, npx = write_sheets([scaled(im, box, px) for im in images], stem)
                entry["tiers"][size] = part
                report.append((tier, clip, size, len(images), part["frameWidth"], part["frameHeight"], len(part["sheets"]), npx * 4 / 1048576, nbytes / 1048576))
            spec["clips"][tier][clip] = entry
            print(f"  {tier} {clip}: {len(images)} frames, box {box}, {time.time() - t0:.0f} s", flush=True)
    if missing:
        print("COULD NOT FETCH (nothing was written for these clips; fix and run again):")
        for m in missing:
            print("  " + m)
        sys.exit(1)

    if clips_only is None:
        spec["backdrop"] = build_backdrop(sizes, None if only is None else spec["backdrop"])
    # a whole build cleared the folder: the landing stills are made again (a --tiers build leaves them as they are)
    # (a --clips build with the idle in it makes them again: they are cut with the idle's box)
    if (only is None and clips_only is None) or (clips_only is not None and "idle" in clips_only):
        spec["landing"] = build_landing(spec)
    write_spec(spec)
    if clips_only is not None:
        # the budget below counts every clip: the ones not rebuilt as the spec has them
        for tier, clips in spec["clips"].items():
            for clip, entry in clips.items():
                if clip in clips_only:
                    continue
                for size in sizes:
                    part = entry["tiers"][size]
                    npx = sum(sh["width"] * sh["height"] for sh in part["sheets"])
                    where = lambda f: os.path.join(OUT_ROOT, f) if OUT_ROOT and os.path.exists(os.path.join(OUT_ROOT, f)) else os.path.join(APP, "static", "assets", f)
                    nbytes = sum(os.path.getsize(where(sh["file"])) for sh in part["sheets"])
                    report.append((tier, clip, size, entry["frames"], part["frameWidth"], part["frameHeight"], len(part["sheets"]), npx * 4 / 1048576, nbytes / 1048576))

    print("\nclip                     tier   frames  frame px    sheets  GPU MB  file MB")
    for tier, clip, size, n, fw, fhh, sheets, gpu, mb in report:
        print(f"{tier + ' ' + clip:24s} {size:6s} {n:6d}  {fw:4d} x {fhh:4d}  {sheets:6d}  {gpu:6.1f}  {mb:7.2f}")
    for size in sizes:
        rows = [r for r in report if r[2] == size]
        held = sum(r[7] for r in rows if r[1] in ("idle", "win"))
        reveal = max(r[7] for r in rows if r[1] == "reveal")
        print(f"{size}: every clip {sum(r[7] for r in rows):.0f} MB on the GPU, {sum(r[8] for r in rows):.1f} MB to download; "
              f"worst case on screen (three tiers' idle and win, one entrance playing) {held + reveal:.0f} MB")


if __name__ == "__main__":
    main()
