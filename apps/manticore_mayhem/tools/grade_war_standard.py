"""Re-grade the War Standard (S) so it sits with the lit 3D symbol set (review B5; Corey 2026-10-17 13:08: "Okay let's
do it. Not in blender"). A colour grade of the existing renders only: no re-render, no runtime filter.

  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/grade_war_standard.py [--variant default|strong]
                                                                                         [--out <dir>] [--stills-only]
  ... tools/grade_war_standard.py --armoury [--variant armoury] [--out <dir>]      the Armoury's War Standard frames

Reads (never written):
  ~/Desktop/Manticore Mayhem/images/symbols/S_war-standard/animation/drop/S_drop_*.png   512 px RGBA, 48 frames
  ~/Desktop/Manticore Mayhem/images/symbols/S_war-standard/animation/idle/S_idle_*.png   512 px RGBA, 60 frames
  ~/Desktop/Manticore Mayhem/handoff/assets/tiles/s.webp                                256 px static tile
Writes (default --out, the folder tools/pack_symbol_sheets.py SOURCE_OVERRIDES reads):
  ~/Desktop/Manticore Mayhem/images/symbols/S_war-standard/graded_r1/drop/, idle/ (same file names), tile/s.webp

One set of numbers (GRADES below) goes through every frame and the tile identically. The only per-source number is the
pixel scale: every width is in 512 px master frame pixels, and the 256 tile (which is the packer's cell space) uses
them x 256 / the width of the fit box in the 512 frame (sheet_fit.json), so a fold falls off the same on both.

Steps, all on straight (unpremultiplied) RGB; alpha is copied through untouched:
  1. masks. RED: hue within HUE_RED (full) fading out by HUE_RED_FADE, saturation over SAT_RED (fade). GOLD: hue in
     HUE_GOLD, saturation over SAT_GOLD. The cloth's emblem (sun and laurels) is the gold that the red cloth encloses
     (holes of the red mask); the pole, finials, side trims and fringe are the rest of the gold.
  2. red cloth only: HSV value through the CURVE (control points in, out), the shadow end pulled toward CRIMSON (hue
     and chroma, not just darker), saturation x SAT (luma based), then the edge falloff: x (1 - EDGE_DARK) at the
     alpha edge, back to 1 at EDGE_WIDTH master px in (smoothstep on the distance from the alpha > 0.5 edge).
  3. outer gold only (not the emblem): highlights over GOLD_HI (smoothstep from..to on value) move toward GOLD_EDGE by
     GOLD_LIFT. No glow, no outline: only pixels already lit move.

--armoury (Corey 2026-10-17 14:07, "Can it do the same color grade on the scatter in the Armoury?"): the same steps on
the Armoury's War Standard frames, with the "armoury" numbers. Reads (never written):
  ~/Desktop/Manticore Mayhem/images/feature_menu_heroes_r1/standard/manifest.json + every frame it lists (5 x 3, 956 x
  1024 RGBA; the straight-on frame r1c2 is also the Armoury's flat hero and thumb, the set has no flat.png)
Writes (default --out, the folder tools/build_armoury_assets.py SOURCE_OVERRIDES reads):
  ~/Desktop/Manticore Mayhem/images/feature_menu_heroes_r1/standard/graded_r1/  same file names + manifest.json (copied)
The board frames get the packer's pop (pack_symbol_sheets.py POP: saturation x1.3, contrast x1.15, S-curve) AFTER the
grade; the Armoury build has no such step, so the "armoury" numbers are not the board's: they were fitted so the
Armoury cloth lands on the SHIPPED board S cloth (darkest 5%, median, brightest 5%: Lab L and C*); the match is noted at GRADES["armoury"].
Widths stay in 512 px board master px: ARMOURY px per master px is the straight-on frame's silhouette width over the
board idle master's (S_idle_000), so the edge falloff covers the same share of the cloth.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.expanduser("~/Desktop/Manticore Mayhem")
S_DIR = os.path.join(WORK, "images", "symbols", "S_war-standard")
MASTER_CLIPS = {"drop": os.path.join(S_DIR, "animation", "drop"), "idle": os.path.join(S_DIR, "animation", "idle")}
MASTER_TILE = os.path.join(WORK, "handoff", "assets", "tiles", "s.webp")
GRADED_DIR = os.path.join(S_DIR, "graded_r1")
FIT_CACHE = os.path.join(HERE, "render_symbols", "sheet_fit.json")
MASTER_PX = 512
CELL = 256
ARMOURY_SRC = os.path.join(WORK, "images", "feature_menu_heroes_r1", "standard")
ARMOURY_GRADED_DIR = os.path.join(ARMOURY_SRC, "graded_r1")
ARMOURY_STRAIGHT_ON = "r1c2.png"  # yaw 0, pitch 0 (build_armoury_assets.centre_frame)
SILHOUETTE_ALPHA = 128  # alpha over this counts toward a silhouette's width (the px scale)

# ---- the grade ------------------------------------------------------------------------------------------------------
# hues in degrees, saturation / value 0..1 (HSV), widths in 512 px master pixels, colours sRGB 0..255
HUE_RED = 14.0  # red cloth: hue <= HUE_RED (or >= 360 - HUE_RED_WRAP) counts fully
HUE_RED_FADE = 24.0  # ... fading to nothing by this hue (the gold sits at 30 to 50)
HUE_RED_WRAP = 25.0  # the magenta side of red: 335..360 counts fully
SAT_RED = (0.30, 0.50)  # red needs saturation over this (smoothstep from, to): greys and pale specks stay
HUE_GOLD = (24.0, 62.0)  # gold: pole, finials, trims, fringe, sun and laurels
SAT_GOLD = (0.15, 0.30)
EMBLEM_CLOSE_PX = 2  # the red mask is grown this much before its holes (the sun and laurels) are filled

GRADES = {
    # picked default (2026-10-17): after the shipped pop the cloth runs #600000 (p5) / #710000 (p10) / #a80000 (median)
    # / #df5138 (p95), was #be0000 / #cb0000 / #ed0000 / #ff5c48
    "default": {
        "CURVE": ((0.0, 0.0), (0.50, 0.33), (0.62, 0.43), (0.72, 0.60), (0.80, 0.76), (0.86, 0.86), (1.0, 1.0)),
        "CRIMSON": (0x6A, 0x0E, 0x0E),  # the shadow colour the ramp bends toward
        "CRIMSON_BELOW": (0.40, 0.72),  # value (after the curve) where the pull is full .. where it is gone
        "CRIMSON_PULL": 0.55,
        "SAT": 0.85,  # the red's saturation (luma based), one step down
        "EDGE_DARK": 0.25,  # darkening right at the alpha edge
        "EDGE_WIDTH": 18.0,  # master px over which it fades back to none
        "GOLD_EDGE": (0xFF, 0xD2, 0x7A),  # the crown's gold
        "GOLD_HI": (0.70, 0.95),  # value range where a gold highlight is taken (smoothstep)
        "GOLD_LIFT": 0.30,
    },
    "strong": {
        "CURVE": ((0.0, 0.0), (0.50, 0.28), (0.62, 0.36), (0.72, 0.52), (0.80, 0.68), (0.86, 0.82), (1.0, 1.0)),
        "CRIMSON": (0x5A, 0x0C, 0x0C),
        "CRIMSON_BELOW": (0.40, 0.78),
        "CRIMSON_PULL": 0.70,
        "SAT": 0.80,
        "EDGE_DARK": 0.38,
        "EDGE_WIDTH": 24.0,
        "GOLD_EDGE": (0xFF, 0xD2, 0x7A),
        "GOLD_HI": (0.65, 0.95),
        "GOLD_LIFT": 0.40,
    },
    # the Armoury (2026-10-17): fitted to land on the shipped board S cloth WITHOUT a pop step after it (the board's
    # default x the packer's pop). Same crimson, edge falloff and gold edge as default; a gentler shadow curve (the
    # Armoury renders already sit darker in the folds: darkest 5% L 21.5 against the board master tile's 28.4) and the
    # saturation the pop would have added (0.85 x 1.3 is about 1.1 net on the board). Measured on the red cloth (Lab,
    # darkest 5% / median / brightest 5%): shipped board S cell L 14.0 / 32.3 / 59.7, C* 41.0 / 72.1 / 66.9; the built
    # hero-standard.webp L 15.1 / 33.4 / 58.2, C* 41.2 / 70.5 / 67.4 (was L 22.0 / 39.1 / 58.7, C* 54.0 / 78.1 / 58.8)
    "armoury": {
        "CURVE": ((0.0, 0.0), (0.50, 0.39), (0.62, 0.45), (0.72, 0.58), (0.80, 0.78), (0.86, 0.94), (1.0, 1.0)),
        "CRIMSON": (0x6A, 0x0E, 0x0E),
        "CRIMSON_BELOW": (0.40, 0.72),
        "CRIMSON_PULL": 0.38,
        "SAT": 1.14,
        "EDGE_DARK": 0.25,
        "EDGE_WIDTH": 18.0,
        "GOLD_EDGE": (0xFF, 0xD2, 0x7A),
        "GOLD_HI": (0.70, 0.95),
        "GOLD_LIFT": 0.30,
    },
}
LUMA = np.array([0.2126, 0.7152, 0.0722])


def arg(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def smoothstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def hsv(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    c = mx - mn
    s = np.where(mx > 0, c / np.maximum(mx, 1e-6), 0.0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    cs = np.maximum(c, 1e-6)
    h = np.where(mx == r, ((g - b) / cs) % 6, np.where(mx == g, (b - r) / cs + 2, (r - g) / cs + 4)) * 60.0
    h = np.where(c > 0, h, 0.0)
    return h, s, mx


def masks(rgb, a):
    """red cloth weight (0..1), outer gold weight (0..1), emblem gold (bool) for one frame"""
    h, s, v = hsv(rgb)
    red_h = np.maximum(1 - smoothstep(h, HUE_RED, HUE_RED_FADE), (h >= 360 - HUE_RED_WRAP).astype(float))
    red = red_h * smoothstep(s, *SAT_RED) * (a > 0)
    gold = ((h >= HUE_GOLD[0]) & (h <= HUE_GOLD[1])).astype(float) * smoothstep(s, *SAT_GOLD) * (a > 0)
    cloth = ndimage.binary_dilation(red > 0.5, iterations=EMBLEM_CLOSE_PX)
    inside = ndimage.binary_fill_holes(cloth) & ~cloth  # what the red encloses: the sun and the laurels
    inside = ndimage.binary_dilation(inside, iterations=EMBLEM_CLOSE_PX)  # and their own anti-aliased rim
    return red, gold * (~inside), inside


def edge_distance(a):
    """distance in px from every opaque pixel to the alpha edge (outside the frame counts as empty)"""
    pad = 2
    m = np.pad(a > 0.5, pad)
    return ndimage.distance_transform_edt(m)[pad:-pad, pad:-pad]


def grade(im, g, px_scale=1.0):
    """one RGBA image -> the graded RGBA image (alpha byte for byte). px_scale: this image's px per 512 master px."""
    arr = np.asarray(im.convert("RGBA"))
    f = arr.astype(np.float64) / 255.0
    rgb, a = f[..., :3], f[..., 3]
    red, gold, _ = masks(rgb, a)
    # 2. the red cloth: value curve, crimson shadows, one step less saturation, edge falloff
    _, _, v = hsv(rgb)
    xs, ys = zip(*g["CURVE"])
    v2 = np.interp(v, xs, ys)
    out = rgb * (v2 / np.maximum(v, 1e-6))[..., None]
    crimson = np.array(g["CRIMSON"], float)
    crimson = crimson / crimson.max()
    pull = (1 - smoothstep(v2, *g["CRIMSON_BELOW"])) * g["CRIMSON_PULL"]
    out = out + (v2[..., None] * crimson - out) * pull[..., None]
    l = (out @ LUMA)[..., None]
    out = l + (out - l) * g["SAT"]
    d = edge_distance(a) / px_scale  # in master px
    fall = 1 - g["EDGE_DARK"] * (1 - smoothstep(d, 0.0, g["EDGE_WIDTH"]))
    out = np.clip(out * fall[..., None], 0, 1)
    rgb2 = rgb + (out - rgb) * red[..., None]
    # 3. the outer gold's highlights toward the crown's gold
    _, _, v = hsv(rgb2)
    lift = gold * smoothstep(v, *g["GOLD_HI"]) * g["GOLD_LIFT"]
    rgb2 = rgb2 + (np.array(g["GOLD_EDGE"], float) / 255.0 - rgb2) * lift[..., None]
    o = np.round(np.clip(rgb2, 0, 1) * 255).astype(np.uint8)
    o = np.where((arr[..., 3] > 0)[..., None], o, arr[..., :3])  # empty pixels keep their bytes
    return Image.fromarray(np.dstack([o, arr[..., 3]]), "RGBA")


def tile_px_scale():
    """tile px per 512 master px: the cell is the fit box of the 512 frame (pack_symbol_sheets.source_box)"""
    geo = json.load(open(FIT_CACHE))["S"]
    s = MASTER_PX / geo["render"]
    w, W = geo["crop"][0], geo["scaled"][0]
    box_w = CELL * (w / W) * s
    return CELL / box_w


def frame_files(folder):
    return sorted(f for f in os.listdir(folder) if f.endswith(".png") and " " not in f and f[0] != "_")


def silhouette_width(im):
    box = im.convert("RGBA").getchannel("A").point(lambda v: 255 if v > SILHOUETTE_ALPHA else 0).getbbox()
    return box[2] - box[0]


def armoury_px_scale():
    """Armoury frame px per 512 board master px: the straight-on frame's silhouette over the board idle master's"""
    master = Image.open(os.path.join(MASTER_CLIPS["idle"], frame_files(MASTER_CLIPS["idle"])[0]))
    assert master.size == (MASTER_PX, MASTER_PX), master.size
    return silhouette_width(Image.open(os.path.join(ARMOURY_SRC, ARMOURY_STRAIGHT_ON))) / silhouette_width(master)


def armoury_main():
    """grade every frame the Armoury standard's manifest lists into ARMOURY_GRADED_DIR (the masters are never written)"""
    variant = arg("--variant", "armoury")
    g = GRADES[variant]
    out_dir = arg("--out", ARMOURY_GRADED_DIR if variant == "armoury" else ARMOURY_GRADED_DIR + "_" + variant)
    assert os.path.realpath(out_dir) != os.path.realpath(ARMOURY_SRC)
    man_path = os.path.join(ARMOURY_SRC, "manifest.json")
    man = json.load(open(man_path))
    files = [x["file"] if isinstance(x, dict) else x for x in man["frames"]]
    assert ARMOURY_STRAIGHT_ON in files
    scale = armoury_px_scale()
    os.makedirs(out_dir, exist_ok=True)
    for fn in files:
        assert not os.path.exists(os.path.join(out_dir, fn)) or "--force" in sys.argv, "%s exists (--force to regrade)" % fn
    for fn in files:
        im = Image.open(os.path.join(ARMOURY_SRC, fn))
        o = grade(im, g, scale)
        assert np.array_equal(np.asarray(o)[..., 3], np.asarray(im.convert("RGBA"))[..., 3]), fn
        o.save(os.path.join(out_dir, fn), "PNG")
    with open(man_path, "rb") as f, open(os.path.join(out_dir, "manifest.json"), "wb") as o:
        o.write(f.read())
    json.dump({"variant": variant, "grade": g, "hueRed": [HUE_RED, HUE_RED_FADE, HUE_RED_WRAP], "satRed": SAT_RED,
               "hueGold": HUE_GOLD, "satGold": SAT_GOLD, "pxScale": scale, "source": ARMOURY_SRC},
              open(os.path.join(out_dir, "grade.json"), "w"), indent=1)
    print(f"armoury: {len(files)} frames, px scale {scale:.4f} -> {out_dir}")


def main():
    if "--armoury" in sys.argv:
        return armoury_main()
    variant = arg("--variant", "default")
    g = GRADES[variant]
    out_dir = arg("--out", GRADED_DIR if variant == "default" else GRADED_DIR + "_" + variant)
    assert os.path.realpath(out_dir) not in {os.path.realpath(p) for p in MASTER_CLIPS.values()}
    assert not os.path.realpath(out_dir).startswith(os.path.realpath(os.path.join(S_DIR, "animation")))
    os.makedirs(os.path.join(out_dir, "tile"), exist_ok=True)
    tile = Image.open(MASTER_TILE)
    graded = grade(tile, g, tile_px_scale())
    graded.save(os.path.join(out_dir, "tile", "s.webp"), "WEBP", lossless=True, quality=100, method=6)
    print(f"tile: px scale {tile_px_scale():.4f}")
    if "--stills-only" in sys.argv:
        return
    for clip, src in MASTER_CLIPS.items():
        dst = os.path.join(out_dir, clip)
        os.makedirs(dst, exist_ok=True)
        files = frame_files(src)
        for fn in files:
            im = Image.open(os.path.join(src, fn))
            o = grade(im, g)
            assert np.array_equal(np.asarray(o)[..., 3], np.asarray(im.convert("RGBA"))[..., 3]), fn
            o.save(os.path.join(dst, fn), "PNG")
        print(f"{clip}: {len(files)} frames -> {dst}")
    json.dump({"variant": variant, "grade": g, "hueRed": [HUE_RED, HUE_RED_FADE, HUE_RED_WRAP], "satRed": SAT_RED,
               "hueGold": HUE_GOLD, "satGold": SAT_GOLD, "tilePxScale": tile_px_scale()},
              open(os.path.join(out_dir, "grade.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
