"""Build the column Wild characters' sprite sheets from Corey's nine approved clips.

Run at low priority with the math env's Python (it reads about 220 big PNGs):
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_columns.py
Then `node scripts/stamp-assets.mjs` (pnpm dev and pnpm build run it for you).
Only the cloud still behind a standing column (a few seconds, the sheets are left alone):
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_columns.py --backdrop
Only some densities, added to what is there (the others' files and spec entries are left alone):
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_columns.py --tiers d150,d215

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
                win every 4th frame (24 frames, played at 12 fps: 2 s, twice the clip's speed)
                entrance from frame 37 (the cloud is full, the debris has gone) every 4th frame to the last
                (16 frames, played at 12 fps: 1.3 s, the spec's 1.2 to 1.5 s)
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
# which source frames are kept (1-based) and how fast they play
PICK = {
    "idle": {"frames": list(range(1, 97, 3)), "fps": 8, "loop": True},
    "win": {"frames": list(range(1, 97, 4)), "fps": 12, "loop": False},
    "reveal": {"frames": list(range(37, 98, 4)), "fps": 12, "loop": False},
}


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
    if outside < 0.35:
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
    with open(SPEC_PATH, "w") as fh:
        fh.write("// AUTO-GENERATED by tools/build_columns.py from the nine approved clips. Do not edit: change the tool and run it again.\n")
        fh.write("// Lengths are road px from the column's top left corner (the column is 250 x 684 road px); sheet sizes are sheet px.\n")
        fh.write(f"export const COLUMN_CLIPS = {json.dumps(spec, indent=chr(9))} as const;\n")


def build_backdrop(sizes=None, part=None):
    """The still cloud behind a standing column, one small picture per tier. Returns its part of the spec.
    `sizes`: only these densities (the others in `part`, the spec already there, are kept as they are)."""
    sizes = list(TIER_SCALE) if sizes is None else sizes
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
    text = open(SPEC_PATH).read()
    return json.loads(text[text.index("{") : text.rindex("}") + 1])


def main():
    if "--backdrop" in sys.argv:
        return backdrop_only()
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
    if only is None:
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
                    cloud_frames += was_cloud
                images.append(im)
            if missing:
                continue
            box = alpha_box(images)
            entry = {
                "fps": pick["fps"],
                "loop": pick["loop"],
                "frames": len(images),
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

    spec["backdrop"] = build_backdrop(sizes, None if only is None else spec["backdrop"])
    write_spec(spec)

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
