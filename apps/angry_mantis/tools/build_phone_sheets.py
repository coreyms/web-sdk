"""Build the PHONE ASSET TIER: half-resolution twins of the symbol atlas and the pose sheets.

Run with math-sdk/env/bin/python (Pillow):
    /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/build_phone_sheets.py

WHY (2026-09-17 phone crash): a tester's phone tab died on the production build. Measured at
390x844 the eight pose sheets (256 px cells, up to 4096x2304) decode to ~178 MB of RGBA and the
symbol atlas to ~11 MB — a GPU/heap bill no phone budget survives. A phone reel cell actually
draws at ~95-124 PHYSICAL px (the renderer caps DPR at 1.5), so a 256 px cell is already ~2x
oversampled there and a 128 px cell still covers it. Desktop draws cells up to ~260 px and keeps
the full sheets, so this is a per-device TIER (src/game/deviceTier.ts), not a downgrade.

Outputs, written NEXT TO the sources so the loader only swaps a file name:
    static/assets/sprites/poses-<p>-half.webp / .json     (p = h1,l1,l2,l3,l4,m1,m2,m3)
    static/assets/sprites/amSymbols/amSymbols-half.webp / .json

The JSON keeps the TexturePacker JSON-hash shape and EVERY key of the source (animations, pivots,
the pose builder's `fit` block, fps): only the pixel geometry is halved. scripts/stamp-assets.mjs
discovers the -half pose JSONs by its `^poses-.+\\.json$` regex and lists amSymbols-half
explicitly, so both get their cache-buster like any other atlas.

Idempotent: re-running rewrites the same bytes (the pngHash written here is the one the stamp
script would write, so build -> stamp is a no-op).
"""

import hashlib
import json
import math
import os
from PIL import Image

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPRITES = os.path.join(APP, "static", "assets", "sprites")

# lossy RGB + EXACT (lossless) alpha, matching how the sources were written by
# tools/make_placeholders.py (q85/q90, method=6, exact=True). q92 at half size: the resample has
# already thrown away the high frequencies a lower q would chew on, and the wings are ~40%
# semi-transparent, so the alpha plane must stay exact or the insects grow halos.
QUALITY = 92

SOURCES = [os.path.join(SPRITES, f"poses-{p}.json") for p in ("h1", "l1", "l2", "l3", "l4", "m1", "m2", "m3")]
SOURCES.append(os.path.join(SPRITES, "amSymbols", "amSymbols.json"))


def half_up(n: int) -> int:
    """odd dimensions round UP, so a half sheet never loses its last column/row of pixels"""
    return math.ceil(n / 2)


def halve_box(box: dict, max_w: int, max_h: int) -> dict:
    """x,y floor and w,h ceil — the frame can only ever grow into its neighbour's 1 px gutter,
    never crop the art — then clamped so no frame can point past the image (Pixi would sample
    garbage / assert on an out-of-bounds frame)."""
    out = dict(box)
    if "x" in box:
        out["x"] = box["x"] // 2
        out["y"] = box["y"] // 2
    out["w"] = half_up(box["w"])
    out["h"] = half_up(box["h"])
    if "x" in box:
        out["w"] = min(out["w"], max_w - out["x"])
        out["h"] = min(out["h"], max_h - out["y"])
    return out


def build(json_path: str) -> tuple:
    src_dir = os.path.dirname(json_path)
    stem = os.path.basename(json_path)[: -len(".json")]
    sheet = json.load(open(json_path))
    src_img_name = str(sheet["meta"]["image"]).split("?")[0]
    src_img_path = os.path.join(src_dir, src_img_name)

    out_json_path = os.path.join(src_dir, f"{stem}-half.json")
    out_img_name = f"{stem}-half.webp"
    out_img_path = os.path.join(src_dir, out_img_name)

    im = Image.open(src_img_path)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    w, h = half_up(im.width), half_up(im.height)
    im.resize((w, h), Image.LANCZOS).save(out_img_path, "WEBP", quality=QUALITY, method=6, exact=True)

    # every other key of every frame (pivot, rotated, trimmed) and of meta (animations, fps, fit)
    # is carried across untouched — only the pixel geometry is scaled.
    for frame in sheet["frames"].values():
        frame["frame"] = halve_box(frame["frame"], w, h)
        # spriteSourceSize/sourceSize describe the ORIGINAL (untrimmed) art, not the atlas, so they
        # are clamped to the source cell rather than to the sheet.
        frame["spriteSourceSize"] = halve_box(frame["spriteSourceSize"], 1 << 30, 1 << 30)
        frame["sourceSize"] = halve_box(frame["sourceSize"], 1 << 30, 1 << 30)
    sheet["meta"]["size"] = {"w": w, "h": h}
    sheet["meta"]["image"] = out_img_name
    # meta.scale stays exactly as the source has it ("1"): Pixi divides the frame rect by it, and
    # these frames are already expressed in the half sheet's own pixels.
    sheet["meta"]["pngHash"] = hashlib.md5(open(out_img_path, "rb").read()).hexdigest()[:8]

    # same formatting scripts/stamp-assets.mjs writes (JSON.stringify(meta, null, 1) + '\n') so the
    # stamp pass after this one is a no-op instead of a diff
    with open(out_json_path, "w") as f:
        f.write(json.dumps(sheet, indent=1) + "\n")

    return (
        os.path.relpath(src_img_path, SPRITES),
        (im.width, im.height),
        os.path.getsize(src_img_path) + os.path.getsize(json_path),
        (w, h),
        os.path.getsize(out_img_path) + os.path.getsize(out_json_path),
    )


def main() -> None:
    rows = [build(p) for p in SOURCES]
    print(f"{'sheet':<28}{'source':>13}{'KB':>8}{'half':>13}{'KB':>8}{'RGBA MB':>10}{'->':>3}{'MB':>8}")
    tot_src = tot_half = 0.0
    for name, (sw, sh), sbytes, (hw, hh), hbytes in rows:
        smb, hmb = sw * sh * 4 / 1e6, hw * hh * 4 / 1e6
        tot_src, tot_half = tot_src + smb, tot_half + hmb
        print(f"{name:<28}{f'{sw}x{sh}':>13}{sbytes/1024:>8.0f}{f'{hw}x{hh}':>13}{hbytes/1024:>8.0f}{smb:>10.1f}{'->':>3}{hmb:>8.1f}")
    print(f"{'TOTAL decoded RGBA':<28}{'':>13}{'':>8}{'':>13}{'':>8}{tot_src:>10.1f}{'->':>3}{tot_half:>8.1f}")
    print("now run `node scripts/stamp-assets.mjs` so the -half files get their ?v= cache-buster")


if __name__ == "__main__":
    main()
