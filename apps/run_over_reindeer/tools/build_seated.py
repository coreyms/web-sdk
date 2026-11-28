"""THE SEATED DRIVERS (Corey 2026-11-16): Grandma at the wheel of her car (H1) and Santa in his sleigh (W), drawn BETWEEN
the vehicle's far side and its near side, so the near door or the sleigh's near wall covers them from the waist down.

Run with the math env's Python (Pillow, numpy, scipy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_seated.py [--preview <dir>]

It READS the locked stills (references/mockups/grandma_car_seated_v4.png, santa_sleigh_seated_v13.png: used exactly as they
are, resampled only), the symbol atlases (static/assets/symbols/symbols[-phone]) and the hand set split, tools/seated_split.json.
It WRITES static/assets/riders/seated.json + .webp (desktop) and seated-phone.json + .webp, and src/game/seatedSpec.ts.

THE SPLIT, per vehicle and direction (no runtime mask): the vehicle sprite itself stays the BACK layer, drawn as it always was.
Over it the driver, then the FRONT layer: the vehicle's own pixels below the hand set cut line (the near door's top edge, the
sleigh's near rim), taken from the symbol atlas of the same tier so it lands on them pixel for pixel. Between the snap columns
the line moves onto the top of the dark ink line it was drawn beside, so the outline belongs to the front layer. The front
layer is only a band `band` road px deep under the line: it only has to cover the driver's hidden part (the still is cut
`keep` road px below its hip), and inside the vehicle it is drawn over the very same pixels, so its lower edge never shows.

THE DRIVER: one picture per character (the right facing still; the left facing vehicles draw it mirrored), at the symbol
atlas's density for its largest drawn size (3.2 px per road px desktop, 1.2 phone: the 3 physical px per CSS px rule), cut
`keep` road px under its hip pivot. The game turns it about that pivot (the lean) and lifts it (the win bob).

THE SHADOW: each vehicle's cast shadow is a twin of its own picture (game/road/shadows.ts). The driver rises above it, so
each frame gets a picture of the driver's silhouette OUTSIDE the vehicle's (the driver's alpha less the vehicle's, at the
built placement), cast by the game with the vehicle's own twin: the shadow is one shape, never doubled where they overlap.

--preview <dir>: the composites per frame (game density and 4x crops, with the same crop before), the clips' memory table
(clips_budget.json) and the split's check (every hidden pixel of the driver under an opaque front pixel, at every lean).
"""
import argparse
import json
import math
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage
from _paths import ART_SRC  # noqa: E402  (tools/_paths.py: the app's art-src/ folder)

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SYM = os.path.join(APP, "static", "assets", "symbols")
OUT = os.path.join(APP, "static", "assets", "riders")
SRC = ART_SRC
STILLS = {
    "grandma": os.path.join(SRC, "references", "mockups", "grandma_car_seated_v4.png"),
    "santa": os.path.join(SRC, "references", "mockups", "santa_sleigh_seated_v13.png"),
}
CLIPS = os.path.join(SRC, "animation", "seated")
DENSITY = {"full": 3.2, "phone": 1.2}  # px per road px: the symbol atlas's own (tools/build_assets.py ATLAS_SCALE)
LEAN_CHECK_DEG = 9.0  # the split check turns the driver this far both ways (constants SEATED.lean clamps well inside it)


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


def trim_box(a, floor=8 / 255):
    ys, xs = np.where(a > floor)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def resize_pm(arr, w, h):
    """straight alpha float RGBA -> resized straight alpha float RGBA (premultiplied resample: no dark fringes)"""
    pm = arr.copy()
    pm[..., :3] *= pm[..., 3:4]
    im = Image.fromarray((pm * 255).round().astype(np.uint8), "RGBA").resize((max(1, w), max(1, h)), Image.LANCZOS)
    o = np.asarray(im).astype(np.float32) / 255.0
    a = np.clip(o[..., 3:4], 1e-6, 1)
    o[..., :3] = np.clip(o[..., :3] / a, 0, 1)
    o[..., 3] = np.where(o[..., 3] < 1.5 / 255, 0, o[..., 3])
    return o


def to_img(arr):
    return Image.fromarray((np.clip(arr, 0, 1) * 255).round().astype(np.uint8), "RGBA")


# ---- the cut line -----------------------------------------------------------------------------------------------------
def cut_line(spec, frame, rw, rh, full):
    """the cut as y (road px from the anchor) per road x: a function, plus its x span; snapped on the desktop atlas"""
    pts = np.array(spec["cut"], dtype=float)
    H, W = full.shape[:2]
    kx, ky = rw / W, rh / H
    xs_px = np.arange(int(math.floor(pts[:, 0].min())), int(math.ceil(pts[:, 0].max())) + 1)
    ys_px = np.interp(xs_px + 0.5, pts[:, 0], pts[:, 1])
    if spec.get("snap"):
        x0, x1 = spec["snap"]
        L = full[..., :3].max(axis=2) * 255  # ink is dark in every channel (a dark red or purple is not)
        A = full[..., 3]
        R = SPLIT["snapPx"]
        snapped = ys_px.copy()
        for i, x in enumerate(xs_px):
            if x < x0 or x > x1 or x < 0 or x >= W:
                continue
            y0 = int(round(ys_px[i]))
            best = None
            for y in range(max(1, y0 - R), min(H - 3, y0 + R) + 1):
                # the top of an ink line: this row and the next are dark and opaque, the row above is not dark
                if L[y, x] <= SPLIT["dark"] and L[y + 1, x] <= SPLIT["dark"] and A[y, x] > 0.9 and L[y - 1, x] > SPLIT["dark"]:
                    if best is None or abs(y - ys_px[i]) < abs(best - ys_px[i]):
                        best = y
            if best is not None:
                snapped[i] = best
        # a short median, so one stray dark speck does not notch the line
        sel = (xs_px >= x0) & (xs_px <= x1)
        med = ndimage.median_filter(snapped, size=5, mode="nearest")
        ys_px = np.where(sel, med, ys_px)
    # to road px from the anchor (bottom centre)
    xr = (xs_px + 0.5) * kx - rw / 2
    yr = ys_px * ky - rh
    return xr, yr


def front_layer(tier_arr, rw, rh, xr, yr, band, floor):
    """the vehicle's own pixels below the cut, inside its x span, down to `floor` (road px from the anchor: under the
    driver's kept part) and at least `band` road px under the line; alpha antialiased on the line"""
    H, W = tier_arr.shape[:2]
    kx, ky = rw / W, rh / H
    cx = (np.arange(W) + 0.5) * kx - rw / 2
    line = np.interp(cx, xr, yr, left=np.nan, right=np.nan)
    cy = (np.arange(H)[:, None] + 0.5) * ky - rh
    inside = ~np.isnan(line)[None, :]
    lp = np.where(np.isnan(line), 0, line)[None, :]
    # coverage of each pixel by "below the line" (1 px soft edge), and by "above the band's floor" (a hard floor inside the
    # opaque body, drawn over identical pixels)
    cover = np.clip((cy - lp) / ky + 0.5, 0, 1) * (cy < np.maximum(lp + band, floor)) * inside
    out = tier_arr.copy()
    out[..., 3] = tier_arr[..., 3] * cover
    return out


# ---- the driver ---------------------------------------------------------------------------------------------------------
def load_still(character):
    im = np.asarray(Image.open(STILLS[character]).convert("RGBA")).astype(np.float32) / 255.0
    im[im[..., 3] <= 8 / 255] = 0  # the stray near-clear haze around the drawing
    return im


def figure_picture(character, height, keep, pivot, density):
    """the still at `density` px per road px for a trimmed height of `height` road px, cut `keep` road px under the pivot.
    Returns the picture and the pivot inside it (px)"""
    im = load_still(character)
    bx0, by0, bx1, by1 = trim_box(im[..., 3])
    k = height / (by1 - by0)  # road px per still px
    cut = min(by1, int(math.ceil(pivot[1] + keep / k)))
    crop = im[by0:cut, bx0:bx1]
    d = k * density  # picture px per still px
    w, h = round(crop.shape[1] * d), round(crop.shape[0] * d)
    pic = resize_pm(crop, w, h)
    return pic, ((pivot[0] - bx0) * w / crop.shape[1], (pivot[1] - by0) * h / crop.shape[0]), k


def place(canvas_shape, pic, pivot_px, at_px, mirror, scale=1.0, angle=0.0, lift=0.0):
    """the driver picture drawn on a canvas (H, W): its pivot at at_px, mirrored, scaled, turned `angle` radians (screen,
    + = clockwise) and lifted; bilinear. Returns straight alpha RGBA."""
    H, W = canvas_shape
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    X = xx - at_px[0]
    Y = yy - (at_px[1] - lift)
    c, s = math.cos(angle), math.sin(angle)
    # inverse rotate, unscale, unmirror
    u = (c * X + s * Y) / scale
    v = (-s * X + c * Y) / scale
    if mirror:
        u = -u
    sx = u + pivot_px[0] - 0.5
    sy = v + pivot_px[1] - 0.5
    pm = pic.copy()
    pm[..., :3] *= pm[..., 3:4]
    out = np.stack([ndimage.map_coordinates(pm[..., i], [sy, sx], order=1, mode="constant") for i in range(4)], -1)
    a = np.clip(out[..., 3:4], 1e-6, 1)
    out[..., :3] = np.clip(out[..., :3] / a, 0, 1)
    return out


def over(bottom, top):
    a = top[..., 3:4] + bottom[..., 3:4] * (1 - top[..., 3:4])
    rgb = (top[..., :3] * top[..., 3:4] + bottom[..., :3] * bottom[..., 3:4] * (1 - top[..., 3:4])) / np.clip(a, 1e-6, 1)
    return np.concatenate([rgb, a], -1)


def pack(pictures, max_width):
    """shelf pack, tallest first, 2 px gutters -> (sheet, frames)"""
    gap = 2
    order = sorted(pictures.items(), key=lambda kv: -kv[1].shape[0])
    x = y = shelf = width = 0
    place_at = {}
    for name, im in order:
        h, w = im.shape[:2]
        if x and x + w + gap > max_width:
            x = 0
            y += shelf + gap
            shelf = 0
        place_at[name] = (x, y)
        x += w + gap
        width = max(width, x)
        shelf = max(shelf, h)
    sheet = np.zeros((y + shelf, width, 4), np.float32)
    frames = {}
    for name, im in pictures.items():
        px, py = place_at[name]
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


def trimmed(arr):
    a = arr[..., 3]
    if not (a > 1.5 / 255).any():
        return arr[:1, :1] * 0, 0, 0
    x0, y0, x1, y1 = trim_box(a, 1.5 / 255)
    return arr[y0:y1, x0:x1], x0, y0


# ---- the clips' memory (budget only) --------------------------------------------------------------------------------------
def clip_budget(character, height, keep, pivot, rate_fps=(24, 12, 8)):
    """per clip: the px of every keyed frame at each tier's density, cut as the still is (registered to the still by its
    trimmed box), trimmed per frame; MB on the GPU (4 bytes a px, no mips) at 24, 12 and 8 fps"""
    still = load_still(character)
    sx0, sy0, sx1, sy1 = trim_box(still[..., 3])
    out = {}
    for clip in ("idle", "win", "drivein"):
        folder = os.path.join(CLIPS, f"{character}_{clip}", "keyed")
        names = sorted(n for n in os.listdir(folder) if n.endswith(".png"))
        first = np.asarray(Image.open(os.path.join(folder, names[0])))[..., 3]
        cx0, cy0, cx1, cy1 = trim_box(first)
        kc = (cy1 - cy0) / (sy1 - sy0)  # clip px per still px
        cut_clip = cy0 + (pivot[1] + keep / (height / (sy1 - sy0)) - sy0) * kc
        px = {"full": [], "phone": []}
        for n in names:
            a = np.asarray(Image.open(os.path.join(folder, n)))[..., 3]
            a = a[: int(cut_clip)]
            x0, y0, x1, y1 = trim_box(a)
            for tier, dens in DENSITY.items():
                d = height / (sy1 - sy0) / kc * dens  # tier px per clip px
                px[tier].append(round((x1 - x0) * d) * round((y1 - y0) * d))
        out[clip] = {"frames": len(names), "fps": 24}
        for tier in DENSITY:
            arr = np.array(px[tier])
            out[clip][tier] = {f"{fps}fps": round(float(arr[:: 24 // fps].sum()) * 4 / 1048576, 2) for fps in rate_fps}
            out[clip][tier]["perFrameKB"] = round(float(arr.mean()) * 4 / 1024, 1)
    return out


def main():
    global SPLIT
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview")
    ap.add_argument("--no-clips", action="store_true", help="skip the clips' memory table (it reads every keyed frame)")
    args = ap.parse_args()
    SPLIT = json.load(open(os.path.join(HERE, "seated_split.json")))
    band = SPLIT["band"]
    os.makedirs(OUT, exist_ok=True)

    # one driver picture per character, at the largest height either direction asks for
    chars = {}
    for frame, f in SPLIT["frames"].items():
        c = f["character"]
        fig = f["figure"]
        cur = chars.setdefault(c, {"height": 0, "keep": fig["keep"], "pivot": fig["pivot"]})
        cur["height"] = max(cur["height"], fig["height"])
        if cur["pivot"] != fig["pivot"] or cur["keep"] != fig["keep"]:
            sys.exit(f"build_seated: {frame}: one picture per character, so pivot and keep must agree")

    spec = {"frames": {}, "characters": {}, "tiers": {}}
    report = {"split": {}, "clips": {}}
    tier_pics = {}
    for tier, dens in DENSITY.items():
        pictures = {}
        for c, cur in chars.items():
            pic, piv, k = figure_picture(c, cur["height"], cur["keep"], cur["pivot"], dens)
            pictures[f"seat_{c}"] = pic
            # the pivot as an anchor (0..1 of the picture), and the picture's size in road px at the built height
            spec["characters"].setdefault(c, {"height": cur["height"], "keep": cur["keep"], "tiers": {}})
            spec["characters"][c]["tiers"][tier] = {"anchor": [round(piv[0] / pic.shape[1], 5), round(piv[1] / pic.shape[0], 5)], "width": round(pic.shape[1] / dens, 3), "height": round(pic.shape[0] / dens, 3), "px": [pic.shape[1], pic.shape[0]]}
            tier_pics[(tier, c)] = (pic, piv)
        full_cache = {}
        for frame, f in SPLIT["frames"].items():
            rw, rh = road_size(frame)
            full = full_cache.setdefault(frame, atlas_frame("full", frame))
            xr, yr = cut_line(f, frame, rw, rh, full)
            car = atlas_frame(tier, frame)
            H, W = car.shape[:2]
            # the floor: the driver's kept part ends `keep` under its pivot; a margin for the lean and the win bob
            floor = f["figure"]["at"][1] + f["figure"]["keep"] * f["figure"]["height"] / chars[f["character"]]["height"] + SPLIT["floorMargin"]
            front = front_layer(car, rw, rh, xr, yr, band, floor)
            fr, fx0, fy0 = trimmed(front)
            pictures[f"{frame}_front"] = fr
            # the driver at the built placement, in the frame's px (the shadow's extra silhouette, the split check)
            fig = f["figure"]
            c = f["character"]
            pic, piv = tier_pics[(tier, c)]
            kxp, kyp = W / rw, H / rh
            pad = int(round(40 * dens))  # room above the frame for the driver's head
            canvas = (H + pad, W)
            at = ((fig["at"][0] + rw / 2) * kxp, (fig["at"][1] + rh) * kyp + pad)
            sc = fig["height"] / chars[c]["height"]
            drv = place(canvas, pic, piv, at, fig["mirror"], sc)
            car_pad = np.zeros(canvas + (4,), np.float32)
            car_pad[pad:] = car
            front_pad = np.zeros(canvas + (4,), np.float32)
            front_pad[pad:] = front
            extra = np.zeros(canvas + (4,), np.float32)
            extra[..., :3] = 1
            extra[..., 3] = np.clip(drv[..., 3] - car_pad[..., 3], 0, 1)
            extra[..., 3] = np.where(extra[..., 3] < 3 / 255, 0, extra[..., 3])
            ex, ex0, ey0 = trimmed(extra)
            pictures[f"{frame}_seatshadow"] = ex
            fs = spec["frames"].setdefault(frame, {"character": c, "mirror": fig["mirror"], "at": fig["at"], "height": fig["height"], "tiers": {}})
            fs["tiers"][tier] = {
                # top left corners in road px from the vehicle's anchor, and sizes in road px
                "front": {"x": round(fx0 / kxp - rw / 2, 3), "y": round(fy0 / kyp - rh, 3), "w": round(fr.shape[1] / kxp, 3), "h": round(fr.shape[0] / kyp, 3)},
                "shadow": {"x": round(ex0 / kxp - rw / 2, 3), "y": round((ey0 - pad) / kyp - rh, 3), "w": round(ex.shape[1] / kxp, 3), "h": round(ex.shape[0] / kyp, 3)},
            }
            if tier == "full":
                fs["cut"] = [[round(float(x), 2), round(float(y), 2)] for x, y in zip(xr[::8], yr[::8])]
            # THE SPLIT CHECK: every driver pixel below the cut is under an opaque front pixel, at rest and leaned both ways
            worst = 0.0
            where = None
            for ang in (0.0, LEAN_CHECK_DEG, -LEAN_CHECK_DEG):
                d2 = place(canvas, pic, piv, at, fig["mirror"], sc, math.radians(ang))
                cx = (np.arange(W) + 0.5) / kxp - rw / 2
                # outside the cut's span the line runs on level (a driver pixel down there would show over the body)
                line = np.interp(cx, xr, yr)
                cy = (np.arange(H + pad)[:, None] + 0.5 - pad) / kyp - rh
                below = cy > line[None, :] + 1.0 / kyp
                leak = d2[..., 3] * (1 - front_pad[..., 3]) * below
                if float(leak.max()) > worst:
                    worst = float(leak.max())
                    wy, wx = np.unravel_index(int(np.argmax(leak)), leak.shape)
                    where = {"deg": ang, "x": round(float((wx + 0.5) / kxp - rw / 2), 1), "y": round(float((wy + 0.5 - pad) / kyp - rh), 1), "px": int((leak > 0.05).sum())}
            report["split"].setdefault(frame, {})[tier] = {"maxLeakAlpha": round(worst, 4), **({"at": where} if worst > 0.05 else {})}
            if args.preview and tier == "full":
                os.makedirs(args.preview, exist_ok=True)
                comp = over(over(car_pad, drv), front_pad)
                bg = np.zeros(canvas + (4,), np.float32)
                bg[..., :3] = np.array([52, 58, 66]) / 255
                bg[..., 3] = 1
                before = over(bg, car_pad)
                after = over(bg, comp)
                side = np.concatenate([before, np.ones((canvas[0], 8, 4), np.float32), after], 1)
                to_img(side).save(os.path.join(args.preview, f"{frame}_compose.png"))
                big = to_img(side).resize((side.shape[1] * 2, side.shape[0] * 2), Image.LANCZOS)
                big.save(os.path.join(args.preview, f"{frame}_compose_2x.png"))
                np.save(os.path.join(args.preview, f"{frame}_line.npy"), np.stack([xr, yr]))
        sheet, frames = pack_tight(pictures)
        stem = "seated" if tier == "full" else "seated-phone"
        to_img(sheet).save(os.path.join(OUT, f"{stem}.webp"), lossless=True, method=6)
        meta = {"frames": frames, "meta": {"image": f"{stem}.webp", "format": "RGBA8888", "size": {"w": sheet.shape[1], "h": sheet.shape[0]}, "scale": "1"}}
        with open(os.path.join(OUT, f"{stem}.json"), "w") as fh:
            json.dump(meta, fh, indent=1)
            fh.write("\n")
        mb = sheet.shape[0] * sheet.shape[1] * 4 / 1048576
        px = {n: int(p.shape[0] * p.shape[1]) for n, p in pictures.items()}
        spec["tiers"][tier] = {"sheet": f"riders/{stem}.webp", "w": sheet.shape[1], "h": sheet.shape[0], "gpuMb": round(mb, 3), "px": px, "bytes": os.path.getsize(os.path.join(OUT, f"{stem}.webp"))}
        print(f"  {stem}: {sheet.shape[1]} x {sheet.shape[0]}, {len(frames)} frames, {mb:.2f} MB on the GPU (+ a third with mips), {spec['tiers'][tier]['bytes'] // 1024} KB")

    for c, cur in ({} if args.no_clips else chars).items():
        report["clips"][c] = clip_budget(c, cur["height"], cur["keep"], cur["pivot"])
    spec["split"] = report["split"]
    spec["clipsBudget"] = report["clips"]
    body = json.dumps(spec, indent="\t")
    with open(os.path.join(APP, "src", "game", "seatedSpec.ts"), "w") as fh:
        fh.write(
            "// AUTO-GENERATED by tools/build_seated.py from the locked stills, the symbol atlases and tools/seated_split.json. Do not\n"
            "// edit: change the split or the tool and run it again. Road px from the vehicle sprite's anchor (the frame's bottom\n"
            "// centre) at the symbol's built size. characters: the driver picture per tier, its pivot as an anchor (0..1). frames:\n"
            "// per vehicle frame the built placement (at: where the pivot sits; height: the still's trimmed height), the front\n"
            "// layer's and the shadow silhouette's boxes per tier. split: the check (the most alpha of a hidden driver pixel that\n"
            "// shows, at rest and leaned 9 degrees both ways). clipsBudget: the keyed clips' GPU MB at the drawn size (not packed).\n"
            # where each driver's still came from: a comment, never a field of the runtime object (a field ships in the
            # game's bundle as text; 2026-11-23)
            + "".join(f"// {c}'s still: {os.path.relpath(STILLS[c], SRC)}\n" for c in spec["characters"])
            + f"export const SEATED_ART = {body} as const;\n"
        )
    print(json.dumps(report, indent=1))


SPLIT = {}
# (guarded 2026-11-19: tools/led_seated.py imports the split's helpers to seat the riders in the LED boards' pictures)
if __name__ == "__main__":
    main()
