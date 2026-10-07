"""Pack the Manticore Mayhem symbol animation sheets and the real static symbol atlas.

  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/pack_symbol_sheets.py [--only H1,L4] [--no-sheets]
                                                                                           [--no-atlas] [--no-tiles] [--full-only] [--verify]
                                                                                           [--style outline|outline-pop|outline-pop-rim --out-dir <dir>]

Sources (read only, never written):
  ~/Desktop/Manticore Mayhem/handoff/assets/tiles/<code>.webp          the ten approved 256 px static tiles
  ~/Desktop/Manticore Mayhem/images/symbols/<CODE_name>/animation/drop/  drop frames, 512 px RGBA
  ~/Desktop/Manticore Mayhem/images/symbols/<CODE_name>/animation/idle/  idle loop frames, 512 px RGBA
  tools/render_symbols/out/render/<CODE>.png + fit.json                 the 1024 harness renders the tiles were baked
                                                                         from (make_tiles.py); the fit is derived from
                                                                         them and cached in render_symbols/sheet_fit.json
                                                                         so a re-run works without out/ (gitignored)

Outputs (static/assets):
  sprites/mmSymbols/<code>-drop.json|webp, <code>-idle.json|webp        256 px cells, frames <code>-drop-000 ...
  sprites/mmSymbols/<code>-drop-half.json|webp, <code>-idle-half...     128 px twins for the phone tier
  sprites/mmSymbols/mmSymbols.json|webp, mmSymbols-half.json|webp       base atlas: the real static tiles for the ten
                                                                         symbols; x2..x128 and cell copied unchanged
  tiles/<code>.webp                                                     128 px paytable thumbnails (GameInfoModal)

The fit: make_tiles.py crops the 1024 render to its silhouette, rotates by rot, scales so the larger side is
size % of the 110 px cell (the 256 tile is 0.94 of a cell) and centres it with dx/dy. Every animation frame
goes through the SAME crop box, rotation, scale and offset (derived once from the render, halved for the 512
frames), so the frame that matches the rest pose lands on the static tile pixel for pixel and motion outside
the rest silhouette is kept (up to the 256 cell edge). Downscale is one LANCZOS resample straight from 512.
Frame file names vary per folder; Finder duplicates ("0001 2.png") are skipped.

--style <name> (EXPERIMENT, 2026-10-07): post-process every frame and atlas tile in the 256 px cell space after the
fit, before packing (presets in STYLES). The -half twins are then the styled 256 cell LANCZOS to 128 (not one resample
from 512), so the outline scales with the art. Writes to --out-dir (default static/assets/sprites/mmSymbols-trial/
<style>/) with the shipped file names; the shipped mmSymbols/ set, sheet_fit.json and the paytable tiles are not
touched (tiles are skipped). Without --style the run writes the SHIPPED set in SHIP_STYLE (outline-pop since
2026-10-07); the paytable tiles stay unstyled.
"""
import json
import math
import os
import re
import sys

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
STATIC = os.path.join(APP, "static", "assets")
SPRITES = os.path.join(STATIC, "sprites", "mmSymbols")
SPRITES_IN = SPRITES  # the shipped atlas JSONs give the layout
TILES_OUT = os.path.join(STATIC, "tiles")
RS = os.path.join(HERE, "render_symbols")
WORK = os.path.expanduser("~/Desktop/Manticore Mayhem")
HANDOFF_TILES = os.path.join(WORK, "handoff", "assets", "tiles")
SYMBOLS_DIR = os.path.join(WORK, "images", "symbols")

CELL = 256
HALF = 128
COLS = 8
HALF_TIER = "--full-only" not in sys.argv  # --full-only: rebuild the 256 px sheets, leave the -half twins as they are
MAX_SHEET = 4096
FPS = 30
PAD = 512  # transparent margin around a source frame so a crop box may run past its edge
CODES = ["L1", "L2", "L3", "L4", "M1", "M2", "M3", "H1", "W", "S"]
# per-symbol source folders under animation/ (None = no clip delivered)
CLIPS = {
    "L4": {"drop": "drop", "idle": "idle"},  # drop/ = baked stamp squash (NOT drop_nosquash)
    "M1": {"drop": "drop", "idle": "idle"},  # drop/ = drop_lively
    "L3": {"drop": "drop", "idle": None},  # no idle delivered yet
}
FRAME_RE = re.compile(r"^(?:[A-Za-z0-9]+_(?:drop|idle)_)?\d{3,4}\.png$")


def arg(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


# ---- style stage (experiment) -------------------------------------------------------------------
# Every number of the trial looks lives here. Units are 256 px cell pixels; colours 0..255 sRGB.
#   outline: alpha-dilated silhouette (anti-aliased disc of `radius`), `color` at `alpha`, under the art
#   shadow:  the dilated silhouette moved by `offset` (down-right), gaussian `blur`, black at `alpha`, under it all
#   pop:     on the art only (before the outline): saturation x`sat`, contrast x`contrast` about `pivot`, then an
#            S-curve on luminance (power `gamma` either side of `pivot`, mixed in by `strength`), applied as a
#            luminance shift so hues hold
#   rim:     a light rim INSIDE the silhouette on its up-left edge: the art's alpha minus itself moved `width` px
#            toward the lower right, softened by `blur`, `color` at `alpha` over the art (alpha unchanged)
OUTLINE = {"radius": 2.5, "color": (0x1A, 0x12, 0x0C), "alpha": 0.9, "floor": 0.04}
SHADOW = {"offset": (1.0, 1.0), "blur": 0.8, "alpha": 0.5}
POP = {"sat": 1.3, "contrast": 1.15, "pivot": 0.42, "gamma": 1.4, "strength": 0.5}
RIM = {"width": 1.0, "dir": (-1.0, -1.0), "blur": 0.5, "color": (0xFF, 0xF4, 0xE0), "alpha": 0.6}
STYLES = {
    "outline": {"outline": OUTLINE, "shadow": SHADOW},
    "outline-pop": {"outline": OUTLINE, "shadow": SHADOW, "pop": POP},
    "outline-pop-rim": {"outline": OUTLINE, "shadow": SHADOW, "pop": POP, "rim": RIM},
}
# SHIPPED STYLE (Corey 2026-10-07, "ship B for now"): outline-pop is what a plain run writes into mmSymbols/.
# An explicit --style <name> is a TRIAL build into mmSymbols-trial/<name>/ and never touches the shipped set;
# --style none there gives the unstyled sheets for comparison.
SHIP_STYLE = "outline-pop"
STYLES["none"] = {}
STYLE_ARG = arg("--style")
if STYLE_ARG and STYLE_ARG not in STYLES:
    raise SystemExit(f"--style must be one of {', '.join(STYLES)}")
TRIAL = STYLE_ARG is not None
STYLE_NAME = STYLE_ARG or SHIP_STYLE
STYLE = STYLES[STYLE_NAME]
LUMA = np.array([0.2126, 0.7152, 0.0722])


def _dilate(a, r):
    """anti-aliased dilation of alpha a (0..1) by a disc of radius r px (coverage weight per offset)"""
    n = int(math.ceil(r + 0.5))
    p = np.pad(a, n)
    out = np.zeros_like(a)
    H, W = a.shape
    for dy in range(-n, n + 1):
        for dx in range(-n, n + 1):
            w = min(1.0, max(0.0, r + 0.5 - math.hypot(dx, dy)))
            if w > 0:
                np.maximum(out, p[n + dy:n + dy + H, n + dx:n + dx + W] * w, out=out)
    return out


def _shift(a, dx, dy):
    """move a by (dx, dy) px (bilinear, transparent fill)"""
    return ndimage.shift(a, (dy, dx), order=1, mode="constant", cval=0.0)


def _pop(rgb, cfg):
    l0 = (rgb @ LUMA)[..., None]
    rgb = l0 + (rgb - l0) * cfg["sat"]
    rgb = cfg["pivot"] + (rgb - cfg["pivot"]) * cfg["contrast"]
    rgb = np.clip(rgb, 0, 1)
    l = rgb @ LUMA
    pv, g = cfg["pivot"], cfg["gamma"]
    lo = pv * np.power(np.clip(l / pv, 0, 1), g)
    hi = 1 - (1 - pv) * np.power(np.clip((1 - l) / (1 - pv), 0, 1), g)
    s = np.where(l < pv, lo, hi)
    l2 = l + (s - l) * cfg["strength"]
    return np.clip(rgb + (l2 - l)[..., None], 0, 1)


def stylize(im, cfg=None):
    """one 256 px RGBA cell -> the styled cell (premultiplied compositing, clean alpha)"""
    cfg = cfg or STYLE
    if not cfg:
        return im
    a8 = np.asarray(im.convert("RGBA")).astype(np.float64) / 255.0
    rgb, a = a8[..., :3].copy(), a8[..., 3]
    if "pop" in cfg:
        rgb = np.where(a[..., None] > 0, _pop(rgb, cfg["pop"]), rgb)
    if "rim" in cfg:
        rc = cfg["rim"]
        ux, uy = rc["dir"]
        k = rc["width"] / math.hypot(ux, uy)
        edge = np.clip(a - _shift(a, -ux * k, -uy * k), 0, 1)  # art whose up-left neighbour is empty
        edge = ndimage.gaussian_filter(edge, rc["blur"]) * a  # soft, and only inside the silhouette
        t = (edge * rc["alpha"])[..., None]
        rgb = rgb * (1 - t) + np.array(rc["color"]) / 255.0 * t
    # the art, premultiplied
    pm_rgb, out_a = rgb * a[..., None], a.copy()
    if "outline" in cfg:
        oc = cfg["outline"]
        base = np.clip((a - oc["floor"]) / (1 - oc["floor"]), 0, 1)  # ignore near-empty fringe noise
        sil = _dilate(base, oc["radius"])
        under_rgb = np.zeros_like(pm_rgb)
        under_a = np.zeros_like(a)
        if "shadow" in cfg:
            sc = cfg["shadow"]
            sh = ndimage.gaussian_filter(_shift(sil, *sc["offset"]), sc["blur"]) * sc["alpha"]
            under_a = sh  # black, premultiplied rgb stays 0
        ol_a = sil * oc["alpha"]
        ol_rgb = np.array(oc["color"]) / 255.0 * ol_a[..., None]
        # outline over shadow, then the art over both (Porter-Duff over, premultiplied)
        under_rgb = ol_rgb + under_rgb * (1 - ol_a[..., None])
        under_a = ol_a + under_a * (1 - ol_a)
        pm_rgb = pm_rgb + under_rgb * (1 - a[..., None])
        out_a = a + under_a * (1 - a)
    out_a = np.clip(out_a, 0, 1)
    rgb_out = np.where(out_a[..., None] > 1e-6, pm_rgb / np.maximum(out_a[..., None], 1e-6), 0)  # unpremultiply; empty px rgb 0
    o = np.dstack([np.clip(rgb_out, 0, 1), out_a])
    return Image.fromarray(np.round(o * 255).astype(np.uint8), "RGBA")


def half_of(styled256):
    return styled256.resize((HALF, HALF), Image.LANCZOS)


def symbol_dir(code):
    for name in os.listdir(SYMBOLS_DIR):
        if name.startswith(code + "_"):
            return os.path.join(SYMBOLS_DIR, name)
    raise SystemExit(f"no symbol folder for {code}")


def frame_files(folder):
    return [os.path.join(folder, f) for f in sorted(os.listdir(folder)) if FRAME_RE.match(f)]


# ---- the fit ------------------------------------------------------------------------------------
def derive_fit(code, fit):
    """Replay make_tiles.py on the 1024 render and return the geometry it used, in render pixels:
    rot (deg, PIL sense), centre (rotation pivot), origin (top-left of the scaled crop, post rotation),
    crop w/h, scaled W/H and the paste x/y in the tile."""
    cell_fill = float(fit.get("cellFill", 0.94))
    f = fit["symbols"].get(code, {"size": 88, "dx": 0, "dy": 0, "rot": 0})
    im = Image.open(os.path.join(RS, "out", "render", code + ".png")).convert("RGBA")
    bx0, by0, bx1, by1 = im.getbbox()
    crop = im.crop((bx0, by0, bx1, by1))
    w0, h0 = crop.size
    centre = (bx0 + w0 / 2, by0 + h0 / 2)
    ox, oy = bx0, by0
    angle = 0.0
    if f.get("rot"):
        angle = -f["rot"]
        rot = crop.rotate(angle, resample=Image.BICUBIC, expand=True)
        rx0, ry0, rx1, ry1 = rot.getbbox()
        nw, nh = rot.size
        ox, oy = centre[0] - nw / 2 + rx0, centre[1] - nh / 2 + ry0
        crop = rot.crop((rx0, ry0, rx1, ry1))
    w, h = crop.size
    px_per_cell = CELL / cell_fill
    k = px_per_cell * f["size"] / 100 / max(w, h)
    W, H = max(1, round(w * k)), max(1, round(h * k))
    x = round((CELL - W) / 2 + px_per_cell * f.get("dx", 0) / 100)
    y = round((CELL - H) / 2 + px_per_cell * f.get("dy", 0) / 100)
    return {"render": 1024, "angle": angle, "centre": list(centre), "origin": [ox, oy], "crop": [w, h],
            "scaled": [W, H], "paste": [x, y], "fit": f}


def source_box(g, src_px):
    """The region of a src_px square source frame that maps onto the 256 tile."""
    s = src_px / g["render"]
    (ox, oy), (w, h), (W, H), (x, y) = g["origin"], g["crop"], g["scaled"], g["paste"]
    sx, sy = w / W, h / H  # render px per tile px
    return ((ox - x * sx) * s, (oy - y * sy) * s, (ox + (CELL - x) * sx) * s, (oy + (CELL - y) * sy) * s)


def process(im, g, out_px):
    """One source frame (any square size at the render's framing) -> an out_px tile through the fit."""
    im = im.convert("RGBA")
    n = im.size[0]
    padded = Image.new("RGBA", (n + 2 * PAD, n + 2 * PAD), (0, 0, 0, 0))
    padded.paste(im, (PAD, PAD))
    s = n / g["render"]
    if g["angle"]:
        c = (g["centre"][0] * s + PAD, g["centre"][1] * s + PAD)
        padded = padded.rotate(g["angle"], resample=Image.BICUBIC, center=c)
    x0, y0, x1, y1 = source_box(g, n)
    return padded.resize((out_px, out_px), Image.LANCZOS, box=(x0 + PAD, y0 + PAD, x1 + PAD, y1 + PAD))


def load_geometry(only):
    cache = os.path.join(RS, "sheet_fit.json")
    fit = json.load(open(os.path.join(RS, "fit.json")))
    geo = json.load(open(cache)) if os.path.exists(cache) else {}
    have_renders = os.path.isdir(os.path.join(RS, "out", "render"))
    for code in CODES:
        if only and code not in only:
            continue
        if have_renders and os.path.exists(os.path.join(RS, "out", "render", code + ".png")):
            geo[code] = derive_fit(code, fit)
        elif code not in geo:
            raise SystemExit(f"{code}: no out/render/{code}.png and no cached fit in sheet_fit.json")
    if not TRIAL:  # a trial build never rewrites the tracked fit cache
        json.dump(geo, open(cache, "w"), indent=1)
    return geo


# ---- packing ------------------------------------------------------------------------------------
def frame_entry(x, y, px):
    return {"frame": {"x": x, "y": y, "w": px, "h": px}, "rotated": False, "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": px, "h": px}, "sourceSize": {"w": px, "h": px},
            "pivot": {"x": 0.5, "y": 0.5}}


def save_webp(img, path, lossless_only=False):
    """lossless unless that is more than 1.6x the q95 file, then q95 (alpha stays lossless).
    lossless_only: the base atlas, where the static tiles must be the approved pixels exactly."""
    if lossless_only:
        img.save(path, "WEBP", lossless=True, quality=100, method=6)
        return "lossless"
    img.save(path + ".tmp-ll", "WEBP", lossless=True, quality=100, method=4)
    img.save(path + ".tmp-lossy", "WEBP", quality=95, method=6, alpha_quality=100)
    ll, lossy = os.path.getsize(path + ".tmp-ll"), os.path.getsize(path + ".tmp-lossy")
    pick = ".tmp-ll" if ll <= lossy * 1.6 else ".tmp-lossy"
    os.replace(path + pick, path)
    for t in (".tmp-ll", ".tmp-lossy"):
        if os.path.exists(path + t):
            os.remove(path + t)
    return "lossless" if pick == ".tmp-ll" else "q95"


def pack(name, frames, px, clip, meta_extra):
    """frames: list of (frame_name, PIL image px). Pixel-identical frames share one cell."""
    uniq, cell_of = [], []
    seen = {}
    for _, im in frames:
        key = im.tobytes()
        if key not in seen:
            seen[key] = len(uniq)
            uniq.append(im)
        cell_of.append(seen[key])
    cols = min(COLS, len(uniq))
    rows = math.ceil(len(uniq) / cols)
    pages = []
    per_page = (MAX_SHEET // px) ** 2
    if len(uniq) > per_page:  # multipack (never hit at 256 px with these clip lengths)
        raise SystemExit(f"{name}: {len(uniq)} cells exceed one {MAX_SHEET} sheet; add multipack")
    sheet = Image.new("RGBA", (cols * px, rows * px), (0, 0, 0, 0))
    pos = []
    for i, im in enumerate(uniq):
        x, y = (i % cols) * px, (i // cols) * px
        sheet.alpha_composite(im, (x, y))
        pos.append((x, y))
    out = {}
    for (fname, _), ci in zip(frames, cell_of):
        out[fname] = frame_entry(*pos[ci], px)
    # full tier: always lossless (Corey 2026-10-06); half tier: lossless unless 1.6x the q95 file
    enc = save_webp(sheet, os.path.join(SPRITES, name + ".webp"), lossless_only=(px == CELL))
    meta = {"image": name + ".webp", "format": "RGBA8888", "size": {"w": sheet.width, "h": sheet.height},
            "scale": "1" if px == CELL else "0.5", "fps": FPS, "encoding": enc}
    meta.update(meta_extra)
    if STYLE:
        meta["style"] = {"name": STYLE_NAME, **STYLE}
    doc = {"frames": out, "animations": {clip: [f for f, _ in frames]}, "meta": meta}
    json.dump(doc, open(os.path.join(SPRITES, name + ".json"), "w"), indent=1)
    pages.append(sheet.size)
    return {"cells": len(uniq), "frames": len(frames), "size": sheet.size, "encoding": enc}


def build_sheets(geo, only):
    report = {}
    for code in CODES:
        if only and code not in only:
            continue
        sdir = symbol_dir(code)
        clips = CLIPS.get(code, {"drop": "drop", "idle": "idle"})
        g = geo[code]
        for clip in ("drop", "idle"):
            folder = clips.get(clip)
            if not folder:
                print(f"{code} {clip}: none delivered, skipped")
                continue
            files = frame_files(os.path.join(sdir, "animation", folder))
            full, half = [], []
            for i, fp in enumerate(files):
                src = Image.open(fp)
                assert src.size[0] == src.size[1], fp
                fname = f"{code.lower()}-{clip}-{i:03d}"
                cell = stylize(process(src, g, CELL))
                full.append((fname, cell))
                if HALF_TIER:
                    half.append((fname, half_of(cell) if STYLE else process(src, g, HALF)))
            fit_meta = {"fit": {"source": f"{os.path.basename(sdir)}/animation/{folder}", "sourcePx": 512,
                                "box512": [round(v, 3) for v in source_box(g, 512)], "angle": g["angle"],
                                "fitJson": g["fit"]}}
            base = f"{code.lower()}-{clip}"
            r1 = pack(base, full, CELL, clip, fit_meta)
            r2 = pack(base + "-half", half, HALF, clip, fit_meta) if HALF_TIER else r1
            report[base] = (r1, r2)
            print(f"{base}: {r1['frames']} frames, {r1['cells']} unique cells, {r1['size']} {r1['encoding']}"
                  f" | half {r2['size']} {r2['encoding']}")
    return report


# ---- base atlas ---------------------------------------------------------------------------------
def build_atlas():
    """Same layout and frame names as make_placeholders.build_atlas. The x2..x128 overlays and the cell
    well are redrawn by make_placeholders' own functions (identical source pixels, so a re-run never
    re-encodes an already lossy cell); the ten symbol cells are the handoff tiles."""
    sys.path.insert(0, HERE)
    import make_placeholders as mp
    full = Image.new("RGBA", (1024, 1280), (0, 0, 0, 0))
    doc = json.load(open(os.path.join(SPRITES_IN, "mmSymbols.json")))
    for m in mp.MULTS:
        r = doc["frames"][f"x{m}.png"]["frame"]
        full.paste(mp.mult_overlay(m), (r["x"], r["y"]))
    r = doc["frames"]["cell.png"]["frame"]
    full.paste(mp.cell_well(), (r["x"], r["y"]))
    for suffix, px in (("", CELL), ("-half", HALF)):
        jp = os.path.join(SPRITES, f"mmSymbols{suffix}.json")
        doc = json.load(open(os.path.join(SPRITES_IN, f"mmSymbols{suffix}.json")))
        sheet = full if px == CELL else full.resize((full.width // 2, full.height // 2), Image.LANCZOS)
        assert sheet.size == (doc["meta"]["size"]["w"], doc["meta"]["size"]["h"])
        for code in CODES:
            fr = doc["frames"][f"{code}.png"]["frame"]
            assert fr["w"] == px and fr["h"] == px, (code, fr)
            tile = Image.open(os.path.join(HANDOFF_TILES, code.lower() + ".webp")).convert("RGBA")
            tile = stylize(tile)
            if px != CELL:
                tile = tile.resize((px, px), Image.LANCZOS)
            sheet.paste(tile, (fr["x"], fr["y"]))  # replace the cell outright (no compositing on the plate)
        if STYLE:
            doc["meta"]["image"] = f"mmSymbols{suffix}.webp"
            doc["meta"].pop("pngHash", None)
            doc["meta"]["style"] = {"name": STYLE_NAME, **STYLE}
        doc["meta"]["encoding"] = save_webp(sheet, os.path.join(SPRITES, f"mmSymbols{suffix}.webp"), lossless_only=True)
        json.dump(doc, open(jp, "w"), indent=1)
        print(f"mmSymbols{suffix}: {sheet.size} {doc['meta']['encoding']}")


def build_tiles():
    os.makedirs(TILES_OUT, exist_ok=True)
    for code in CODES:
        tile = Image.open(os.path.join(HANDOFF_TILES, code.lower() + ".webp")).convert("RGBA")
        tile.resize((128, 128), Image.LANCZOS).save(os.path.join(TILES_OUT, code.lower() + ".webp"), "WEBP",
                                                     lossless=True, quality=100, method=6)
    print("tiles: ten 128 px paytable thumbnails")


# ---- verify -------------------------------------------------------------------------------------
def pm(im):
    a = np.asarray(im.convert("RGBA")).astype(np.float64)
    a[..., :3] *= a[..., 3:] / 255.0
    return a


def diff(a, b):
    d = np.abs(pm(a) - pm(b))
    return round(float(d.mean()), 3), int((d.max(-1) > 8).sum())


def sheet_frames(name):
    doc = json.load(open(os.path.join(SPRITES, name + ".json")))
    img = Image.open(os.path.join(SPRITES, doc["meta"]["image"])).convert("RGBA")
    W, H = doc["meta"]["size"]["w"], doc["meta"]["size"]["h"]
    assert img.size == (W, H), (name, img.size, W, H)
    out = {}
    for fname, f in doc["frames"].items():
        r = f["frame"]
        assert 0 <= r["x"] and 0 <= r["y"] and r["x"] + r["w"] <= W and r["y"] + r["h"] <= H, (name, fname, r)
        out[fname] = img.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))
    assert list(doc["animations"].values())[0] == list(doc["frames"].keys())
    return out


def clipped_alpha(geo, code, folder):
    """share of each source frame's alpha mass that falls outside the 256 tile box (worst frame)"""
    worst = (0.0, -1)
    files = frame_files(folder)
    for i, fp in enumerate(files):
        a = np.asarray(Image.open(fp).convert("RGBA"))[..., 3].astype(np.float64)
        x0, y0, x1, y1 = source_box(geo[code], a.shape[0])
        inside = a[max(0, math.ceil(y0)):max(0, math.floor(y1)), max(0, math.ceil(x0)):max(0, math.floor(x1))].sum()
        lost = 1 - inside / max(1.0, a.sum())
        if lost > worst[0]:
            worst = (lost, i)
    return worst


def verify(geo, only):
    rows = []
    for code in CODES:
        if only and code not in only:
            continue
        c = code.lower()
        tile = Image.open(os.path.join(HANDOFF_TILES, c + ".webp")).convert("RGBA")
        line = {"code": code}
        # the fit replay itself: the 1024 render through process() vs the handoff tile
        rp = os.path.join(RS, "out", "render", code + ".png")
        if os.path.exists(rp):
            line["render_vs_tile"] = diff(process(Image.open(rp), geo[code], CELL), tile)
        drop = sheet_frames(f"{c}-drop")
        names = list(drop)
        line["drop_n"] = len(names)
        line["drop0_vs_tile"] = diff(drop[names[0]], tile)
        line["dropLast_vs_tile"] = diff(drop[names[-1]], tile)
        best = min(((diff(drop[n], tile), i) for i, n in enumerate(names)), key=lambda t: t[0][0])
        line["best_drop_vs_tile"] = (best[1], best[0])
        if os.path.exists(os.path.join(SPRITES, f"{c}-idle.json")):
            idle = sheet_frames(f"{c}-idle")
            inames = list(idle)
            line["idle_n"] = len(inames)
            line["idle0_vs_dropLast"] = diff(idle[inames[0]], drop[names[-1]])
            line["idle0_vs_tile"] = diff(idle[inames[0]], tile)
            line["idle_seam"] = diff(idle[inames[-1]], idle[inames[0]])
        hd = sheet_frames(f"{c}-drop-half")
        line["half0_vs_tile128"] = diff(hd[f"{c}-drop-000"], tile.resize((HALF, HALF), Image.LANCZOS))
        sdir = symbol_dir(code)
        clips = CLIPS.get(code, {"drop": "drop", "idle": "idle"})
        line["clip_drop"] = clipped_alpha(geo, code, os.path.join(sdir, "animation", clips["drop"]))
        if clips.get("idle"):
            line["clip_idle"] = clipped_alpha(geo, code, os.path.join(sdir, "animation", clips["idle"]))
        rows.append(line)
        print(json.dumps(line))
    # base atlas: the ten tiles exactly, overlays untouched
    for suffix, px in (("", CELL), ("-half", HALF)):
        fr = sheet_frames_atlas(f"mmSymbols{suffix}")
        for code in CODES:
            t = Image.open(os.path.join(HANDOFF_TILES, code.lower() + ".webp")).convert("RGBA")
            if px != CELL:
                t = t.resize((px, px), Image.LANCZOS)
            print(f"mmSymbols{suffix} {code}.png vs handoff", diff(fr[f"{code}.png"], t))
    json.dump(rows, open(os.path.join(RS, "out", "_sheets_verify.json"), "w"), indent=1)
    contact(rows)


def sheet_frames_atlas(name):
    doc = json.load(open(os.path.join(SPRITES, name + ".json")))
    img = Image.open(os.path.join(SPRITES, doc["meta"]["image"])).convert("RGBA")
    out = {}
    for fname, f in doc["frames"].items():
        r = f["frame"]
        assert r["x"] + r["w"] <= img.width and r["y"] + r["h"] <= img.height
        out[fname] = img.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))
    return out


def contact(rows):
    """frame 0 / 12 / 24 / 47 (last when shorter) per symbol at the real cell size on the board backdrop,
    with the static tile first and idle 0 last; 2x so the cells read on a laptop screen"""
    zoom = 2
    cell = 110 * zoom
    tile_px = round(110 * 0.94) * zoom
    off = (cell - tile_px) // 2
    bd = ImageOps.fit(Image.open(os.path.join(STATIC, "ui", "board-backdrop.webp")).convert("RGB"),
                      (880 * zoom // 1, 880 * zoom // 1), method=Image.LANCZOS)
    well = bd.crop((0, 0, cell, cell))
    cols = ["tile", "d0", "d12", "d24", "d47", "idle0"]
    img = Image.new("RGB", (60 + len(cols) * (cell + 8), 30 + len(rows) * (cell + 8)), (28, 24, 34))
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    for j, name in enumerate(cols):
        d.text((60 + j * (cell + 8) + 6, 8), name, fill=(220, 210, 190))
    for i, line in enumerate(rows):
        code = line["code"]
        c = code.lower()
        y = 30 + i * (cell + 8)
        d.text((10, y + cell // 2), code, fill=(220, 210, 190))
        drop = sheet_frames(f"{c}-drop")
        names = list(drop)
        picks = [Image.open(os.path.join(HANDOFF_TILES, c + ".webp")).convert("RGBA")]
        picks += [drop[names[min(k, len(names) - 1)]] for k in (0, 12, 24, 47)]
        if os.path.exists(os.path.join(SPRITES, f"{c}-idle.json")):
            picks.append(sheet_frames(f"{c}-idle")[f"{c}-idle-000"])
        for j, t in enumerate(picks):
            x = 60 + j * (cell + 8)
            img.paste(well, (x, y))
            t = t.resize((tile_px, tile_px), Image.LANCZOS)
            img.paste(t, (x + off, y + off), t)
    out = os.path.join(RS, "out", "_sheets_contact.png")
    img.save(out)
    print("contact:", out)


def main():
    only = arg("--only")
    only = only.split(",") if only else None
    geo = load_geometry(only)
    global SPRITES
    if TRIAL:
        SPRITES = os.path.abspath(arg("--out-dir") or os.path.join(STATIC, "sprites", "mmSymbols-trial", STYLE_NAME))
        assert os.path.realpath(SPRITES) != os.path.realpath(SPRITES_IN), "a style build never writes the shipped set"
        print(f"style {STYLE_NAME} -> {SPRITES}")
    os.makedirs(SPRITES, exist_ok=True)
    if "--no-tiles" not in sys.argv and not TRIAL:
        build_tiles()
    if "--no-atlas" not in sys.argv:
        build_atlas()
    if "--no-sheets" not in sys.argv:
        build_sheets(geo, only)
    if "--verify" in sys.argv:
        verify(geo, only)


if __name__ == "__main__":
    main()
