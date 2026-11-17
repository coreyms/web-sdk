"""Build THE FAST LANE feature menu's three pictures (ui/FeatureMenu.svelte). Pixel work only: crop, recolour by Corey's
own red present tool, blank one sign face, resample, encode. No generated art.

Run with the math env's Python (Pillow, numpy, scipy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_fast_lane_art.py
Then `node scripts/stamp-assets.mjs` (pnpm dev and pnpm build run it for you).

It only READS (never writes) these sources under ~/Desktop/Run Over Reindeer:
  scatter_present_3d_r1_2026-11-15/frames/stills_1254/closed_painted.png   the teal present, the approved 3D build's
                                                                             closed still at 1254 px (Free Spins)
  scatter_present_red_r1_2026-11-17/tools/recolor.py                         the red recolour, design E (Super Free
                                                                             Spins), run on that same still
  references/mockups/speed_limit_10_v3.png                                   the 10 sign of the reels; its face is
                                                                             blanked white so the menu sets its own
                                                                             three lines on it (ANTE / PLAY / 2X)
and writes static/assets/fastlane/<name>-<tier>.webp for name in present-teal, present-red, sign-blank.

DENSITY (house rule: 3 physical px per CSS px at the largest draw size). The menu draws a picture no taller than:
  full   the desktop hero, 330 design px at the desktop box's top scale 1.2 (FeatureMenu.svelte DESK_MAX_SCALE):
         396 CSS px, so 1188 px tall
  phone  the phone tier's tallest draw, the upright hero, 210 design px at the upright scale cap 1.15 (UP_MAX_SCALE):
         242 CSS px, so 726 px tall
The teal still's ink is 1189 px tall, so the full tier is the source's own size (a 0.1 % resample).

THE SIGN'S FACE: the white rectangle the approved mock (fast_lane_menu_2026-11-17/mock/template.html .sign .num) laid
over SPEED LIMIT 10: 9.5 % in from the left and right, 17.5 % down, 68.5 % tall, of the sign's ink box. Here it is
painted into the picture in the face's own measured white, so the game draws no extra box.
"""
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "static", "assets", "fastlane")
SRC = os.path.expanduser("~/Desktop/Run Over Reindeer")

TEAL_STILL = os.path.join(SRC, "scatter_present_3d_r1_2026-11-15", "frames", "stills_1254", "closed_painted.png")
RECOLOR = os.path.join(SRC, "scatter_present_red_r1_2026-11-17", "tools", "recolor.py")
RECOLOR_PY = os.path.join(SRC, "scatter_present_3d_r1_2026-11-15", "work", "venv", "bin", "python")
RED_DESIGN = "E"
SIGN = os.path.join(SRC, "references", "mockups", "speed_limit_10_v3.png")

TIERS = {"full": 1188, "phone": 726}
FACE = dict(left=0.095, right=0.095, top=0.175, height=0.685)
WEBP = dict(quality=92, alpha_quality=100, method=6)


def trim(im):
    a = np.asarray(im.split()[3])
    ys, xs = np.where(a > 8)
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def resize_h(im, h):
    """Premultiplied resample to height h (no dark fringes out of transparent pixels)."""
    if im.height == h:
        return im
    w = max(1, round(im.width * h / im.height))
    arr = np.asarray(im).astype(np.float32) / 255.0
    arr[..., :3] *= arr[..., 3:4]
    chans = [Image.fromarray(arr[..., i]).resize((w, h), Image.LANCZOS) for i in range(4)]
    out = np.stack([np.asarray(c) for c in chans], axis=-1)
    a = np.clip(out[..., 3:4], 1e-6, None)
    out[..., :3] = np.where(out[..., 3:4] > 1e-4, out[..., :3] / a, 0)
    out = np.clip(out, 0, 1)
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA")


def blank_face(sign):
    arr = np.asarray(sign).copy()
    h, w = arr.shape[:2]
    x0, x1 = round(w * FACE["left"]), round(w * (1 - FACE["right"]))
    y0, y1 = round(h * FACE["top"]), round(h * (FACE["top"] + FACE["height"]))
    box = arr[y0:y1, x0:x1, :3].reshape(-1, 3).astype(np.int32)
    light = box[box.sum(axis=1) > 3 * 225]
    white = np.median(light, axis=0).round().astype(np.uint8) if len(light) else np.array([255, 255, 255], np.uint8)
    arr[y0:y1, x0:x1, :3] = white
    arr[y0:y1, x0:x1, 3] = 255
    return Image.fromarray(arr, "RGBA"), (x0, y0, x1, y1), tuple(int(v) for v in white)


def save(im, name):
    for tier, h in TIERS.items():
        path = os.path.join(OUT, f"{name}-{tier}.webp")
        resize_h(im, h).save(path, "WEBP", **WEBP)
        print(f"  {os.path.relpath(path, APP)}  {resize_h(im, h).size}  {os.path.getsize(path):,} bytes")


def main():
    os.makedirs(OUT, exist_ok=True)
    teal = Image.open(TEAL_STILL).convert("RGBA")
    print("teal present", teal.size)
    save(trim(teal), "present-teal")

    with tempfile.TemporaryDirectory() as tmp:
        red_path = os.path.join(tmp, "present-red.png")
        subprocess.run([RECOLOR_PY, "-I", RECOLOR, RED_DESIGN, TEAL_STILL, red_path], check=True)
        red = Image.open(red_path).convert("RGBA")
        # the recolour never writes alpha: the red ink box is the teal one
        assert np.array_equal(np.asarray(red)[..., 3], np.asarray(teal)[..., 3]), "recolour changed the alpha"
        save(trim(red), "present-red")

    sign = trim(Image.open(SIGN).convert("RGBA"))
    blank, box, white = blank_face(sign)
    print("sign", sign.size, "face box", box, "face white", white)
    save(blank, "sign-blank")


if __name__ == "__main__":
    sys.exit(main())
