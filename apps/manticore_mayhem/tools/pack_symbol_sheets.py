"""Pack the Manticore Mayhem symbol animation sheets and the real static symbol atlas.

  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/pack_symbol_sheets.py [--only H1,L4] [--no-sheets]
                                                                                           [--no-atlas] [--no-tiles] [--full-only] [--verify]
                                                                                           [--style outline|outline-pop|outline-pop-rim --out-dir <dir>]

Sources (read only, never written):
  ~/Desktop/Manticore Mayhem/handoff/assets/tiles/<code>.webp          the ten approved 256 px static tiles
  ~/Desktop/Manticore Mayhem/images/symbols/<CODE_name>/animation/drop/  drop frames, 512 px RGBA
  ~/Desktop/Manticore Mayhem/images/symbols/<CODE_name>/animation/idle/  idle loop frames, 512 px RGBA
  CLIPS (below) picks other folders per symbol and clip: H1 reads drop_r2/, idle_r2/ and win/ (revision 2, 2026-10-19)
  .../animation/win/  (only where CLIPS names one) the WIN clip: masters at canvas.json "scale" x the 512 frame (768 px
                      for 1.5), the 512 frame centred in them at the same pixel density; canvas.json gives the scale
  SOURCE_OVERRIDES (below): S reads its frames and tile from S_war-standard/graded_r1/ (tools/grade_war_standard.py)
  tools/render_symbols/out/render/<CODE>.png + fit.json                 the 1024 harness renders the tiles were baked
                                                                         from (make_tiles.py); the fit is derived from
                                                                         them and cached in render_symbols/sheet_fit.json
                                                                         so a re-run works without out/ (gitignored)

Outputs (static/assets):
  sprites/mmSymbols/<code>-drop.json|webp, <code>-idle.json|webp        256 px cells, frames <code>-drop-000 ...
  sprites/mmSymbols/<code>-drop-half.json|webp, <code>-idle-half...     128 px twins for the phone tier
  sprites/mmSymbols/<code>-win.json|webp, <code>-win-half...            the win clip (only symbols with one): cells of
                                                                         scale x 256 (384 / 192 px for 1.5), the same fit,
                                                                         scale and style per pixel as the drop, so the
                                                                         centre 256 of frame 0 is the rest tile; the json
                                                                         meta carries "canvas": {"scale", "cellPx", "px"}
  sprites/mmSymbols/mmSymbols.json|webp, mmSymbols-half.json|webp       base atlas: the real static tiles for the ten
                                                                         symbols; x2..x128 and cell copied unchanged
  tiles/<code>.webp                                                     128 px paytable thumbnails (GameInfoModal)

The fit: make_tiles.py crops the 1024 render to its silhouette, rotates by rot, scales so the larger side is
size % of the 110 px cell (the 256 tile is 0.94 of a cell) and centres it with dx/dy. Every animation frame
goes through the SAME crop box, rotation, scale and offset (derived once from the render, halved for the 512
frames), so the frame that matches the rest pose lands on the static tile pixel for pixel and motion outside
the rest silhouette is kept (up to the 256 cell edge). Downscale is one LANCZOS resample straight from 512.
A WIN clip goes through the same box grown by its canvas scale about the box centre, resampled to scale x 256 px, so
every output pixel samples the source exactly where the 256 cell's pixel does (the centre 256 of a win cell is the
drop cell of the same source frame). --verify measures it (frame 0 centre vs drop frame 0 and the atlas tile).
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
import shutil
import subprocess
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
    # M1 REVISION 2 (Corey 2026-10-19 10:53 review; 12:07 "Helmet looks good now"): readable landing and idle, and the
    # win r3 (r2 centred in the cell while it faces the camera, Corey 12:00). Replaces drop/ = drop_lively
    "M1": {"drop": "drop_r2", "idle": "idle_r2", "win": "win_r3"},
    "L3": {"drop": "drop", "idle": None},  # no idle delivered yet
    # REVISION 2 (2026-10-19, Stake's "The symbols are poorly animated"; Corey 10:11 "The crown looks much better"): the
    # readable landing and idle, and a WIN clip of its own (NOTES.md "Revision 2" in the symbol's animation folder)
    "H1": {"drop": "drop_r2", "idle": "idle_r2", "win": "win"},
}
# the clips a symbol may have, in build order; "win" only where CLIPS names a folder for it (no win sheet otherwise:
# the game then keeps the shared win look for that symbol)
CLIP_KINDS = ("drop", "idle", "win")
DEFAULT_CLIPS = {"drop": "drop", "idle": "idle"}
WIN_CANVAS_JSON = "canvas.json"  # in the win folder: {"scale": 1.5, ...} written by the art job (post_r2.py)
# SOURCE OVERRIDES: a symbol whose frames and static tile come from a graded copy instead of the masters (the masters
# stay untouched). The folder holds drop/ and idle/ (same file names as animation/<folder>/) and tile/<code>.webp.
#   S: the War Standard re-grade (review B5, Corey 2026-10-17 13:08, no Blender), written by tools/grade_war_standard.py
SOURCE_OVERRIDES = {"S": os.path.join(SYMBOLS_DIR, "S_war-standard", "graded_r1")}
FRAME_RE = re.compile(r"^(?:[A-Za-z0-9]+_(?:drop|idle|win)(?:_r\d+)?_)?\d{3,4}\.png$")


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
# darkRim (Corey 2026-10-13 12:06, the Symbol Fit Playground's DARK RIM, baked): the styled silhouette (outline and
# shadow included) grown by `masterPx` desktop master px AT EACH SYMBOL'S OWN DRAWN SIZE, gaussian `softness` x
# max(masterPx, 0.5), `color` at `opacity`, UNDER the styled art. The numbers and each symbol's size are read from
# src/game/constants.ts (SYMBOL_RIM, SYMBOL_PLACE, CELL_FILL, SYMBOL_FIT) so the two never drift.
CONSTANTS_TS = os.path.join(APP, "src", "game", "constants.ts")


def _read_rim():
    src = open(CONSTANTS_TS).read()
    num = lambda name: float(re.search(r"export const " + name + r" = ([\d.]+);", src).group(1))
    rim = re.search(r"export const SYMBOL_RIM = \{ masterPx: ([\d.]+), opacity: ([\d.]+), softness: ([\d.]+), color: 0x([0-9a-fA-F]{6}) \}", src)
    place = src[src.index("export const SYMBOL_PLACE"):]
    place = place[:place.index("};") + 2]
    ref = float(re.search(r"refPitch: ([\d.]+)", place).group(1))
    glob = float(re.search(r"global: ([\d.]+)", place).group(1))
    sizes = {m.group(1): float(m.group(2)) for m in re.finditer(r"\b([A-Z][A-Z0-9]?): \{ size: ([\d.]+)", place)}
    assert rim and set(sizes) == set(CODES), (rim, sizes)
    hexc = rim.group(4)
    return {"masterPx": float(rim.group(1)), "opacity": float(rim.group(2)), "softness": float(rim.group(3)),
            "color": tuple(int(hexc[i:i + 2], 16) for i in (0, 2, 4)), "refPitch": ref, "global": glob,
            "spriteFrac": num("CELL_FILL") * num("SYMBOL_FIT"), "sizes": sizes}


DARK_RIM = _read_rim()


def dark_rim_px(code):
    """the rim's width and gaussian sigma in 256 px cell pixels for `code` (cell px per desktop master px = 256 / the
    symbol's drawn side in master px at the playground's pitch)"""
    d = DARK_RIM
    per_master = CELL / (d["spriteFrac"] * d["refPitch"] * d["global"] * d["sizes"][code])
    return d["masterPx"] * per_master, d["softness"] * max(d["masterPx"], 0.5) * per_master


STYLES = {
    "outline": {"outline": OUTLINE, "shadow": SHADOW},
    "outline-pop": {"outline": OUTLINE, "shadow": SHADOW, "pop": POP},
    "outline-pop-rim": {"outline": OUTLINE, "shadow": SHADOW, "pop": POP, "rim": RIM},
    "outline-pop-darkrim": {"outline": OUTLINE, "shadow": SHADOW, "pop": POP,
                            "darkRim": {k: v for k, v in DARK_RIM.items() if k != "sizes"}},
}
# SHIPPED STYLE (Corey 2026-10-07, "ship B for now"): outline-pop is what a plain run writes into mmSymbols/.
# 2026-10-14: outline-pop plus the owner's dark rim (Symbol Fit Playground v7, 2026-10-13 12:06).
# An explicit --style <name> is a TRIAL build into mmSymbols-trial/<name>/ and never touches the shipped set;
# --style none there gives the unstyled sheets for comparison.
SHIP_STYLE = "outline-pop-darkrim"
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


def stylize(im, cfg=None, code=None):
    """one 256 px RGBA cell -> the styled cell (premultiplied compositing, clean alpha). `code` sizes the dark rim."""
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
    if "darkRim" in cfg:
        # the playground's rimFor(): the silhouette stamped round a circle of the rim's width, filled with the colour,
        # softened (canvas shadowBlur 2 sigma); drawn under the symbol at its opacity
        assert code, "the dark rim is sized per symbol"
        dc = cfg["darkRim"]
        w_px, sigma = dark_rim_px(code)
        sil = _dilate(np.clip(out_a, 0, 1), w_px)
        if sigma >= 0.3 * CELL / 256:
            sil = ndimage.gaussian_filter(sil, sigma, mode="constant", cval=0.0)
        rim_a = np.clip(sil * dc["opacity"], 0, 1)
        rim_rgb = np.array(dc["color"]) / 255.0 * rim_a[..., None]
        pm_rgb = pm_rgb + rim_rgb * (1 - out_a[..., None])
        out_a = out_a + rim_a * (1 - out_a)
    out_a = np.clip(out_a, 0, 1)
    rgb_out = np.where(out_a[..., None] > 1e-6, pm_rgb / np.maximum(out_a[..., None], 1e-6), 0)  # unpremultiply; empty px rgb 0
    o = np.dstack([np.clip(rgb_out, 0, 1), out_a])
    return Image.fromarray(np.round(o * 255).astype(np.uint8), "RGBA")


def half_of(styled):
    """the half tier of a styled cell (256 -> 128, a win cell 384 -> 192)"""
    return styled.resize((styled.width // 2, styled.height // 2), Image.LANCZOS)


def symbol_dir(code):
    for name in os.listdir(SYMBOLS_DIR):
        if name.startswith(code + "_"):
            return os.path.join(SYMBOLS_DIR, name)
    raise SystemExit(f"no symbol folder for {code}")


def clip_dir(code, folder):
    """the folder a clip's frames are read from: the graded copy for an overridden symbol, else animation/<folder>"""
    if code in SOURCE_OVERRIDES:
        return os.path.join(SOURCE_OVERRIDES[code], folder)
    return os.path.join(symbol_dir(code), "animation", folder)


def tile_path(code):
    """the 256 px static tile: the graded copy for an overridden symbol, else the handoff tile"""
    if code in SOURCE_OVERRIDES:
        return os.path.join(SOURCE_OVERRIDES[code], "tile", code.lower() + ".webp")
    return os.path.join(HANDOFF_TILES, code.lower() + ".webp")


def win_canvas(code, folder):
    """the win clip's canvas scale (canvas.json "scale"); the cell sizes it gives must be whole pixels, centred"""
    cj = json.load(open(os.path.join(clip_dir(code, folder), WIN_CANVAS_JSON)))
    scale = float(cj["scale"])
    for px in (CELL, HALF):
        out = px * scale
        assert out == int(out) and (out - px) % 2 == 0, f"{code} win canvas {scale}: {out} px cells are not centred whole pixels"
    return scale


def canvas_px(px, canvas):
    return int(round(px * canvas))


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


def process(im, g, out_px, canvas=1.0):
    """One source frame (any square size at the render's framing) -> an out_px tile through the fit.
    canvas > 1: the source is a win master, `canvas` x its frame at the same density with the frame centred in it;
    the fit box is grown by `canvas` about its own centre (out_px is then canvas x the cell)."""
    im = im.convert("RGBA")
    n = im.size[0]
    frame = n / canvas  # the render-framed square inside the canvas
    off = (n - frame) / 2
    padded = Image.new("RGBA", (n + 2 * PAD, n + 2 * PAD), (0, 0, 0, 0))
    padded.paste(im, (PAD, PAD))
    s = frame / g["render"]
    if g["angle"]:
        c = (g["centre"][0] * s + off + PAD, g["centre"][1] * s + off + PAD)
        padded = padded.rotate(g["angle"], resample=Image.BICUBIC, center=c)
    x0, y0, x1, y1 = source_box(g, frame)
    if canvas != 1.0:
        gx, gy = (x1 - x0) * (canvas - 1) / 2, (y1 - y0) * (canvas - 1) / 2
        x0, y0, x1, y1 = x0 - gx, y0 - gy, x1 + gx, y1 + gy
    x0, y0, x1, y1 = x0 + off, y0 + off, x1 + off, y1 + off
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


NEAR_LOSSLESS = 60  # cwebp -near_lossless level for the animation sheets (Corey 2026-10-15, S4)
# REVISION 2 SHEETS (a symbol whose CLIPS entry names a win clip): every one of its sheets, both tiers, is lossy at this
# quality with the alpha lossless (Corey 2026-10-19 11:59, "q85 is fine", after the side-by-side of a lit crown frame).
# Near-lossless suited the old sheets, which barely moved (the crown's idle was 64 KB); with real motion it made the
# crown's three sheets 3.9 MB, q85 1.56 MB
R2_QUALITY = 85
CWEBP = shutil.which("cwebp") or "/opt/homebrew/bin/cwebp"


def save_near_lossless(img, path):
    """cwebp -lossless -q 100 -m 6 -near_lossless 60 (Pillow has no near_lossless option); the PNG in between is
    the exact pixels the sheet was built from"""
    png = path + ".tmp.png"
    img.save(png, "PNG")
    try:
        subprocess.run([CWEBP, "-quiet", "-lossless", "-q", "100", "-m", "6", "-near_lossless", str(NEAR_LOSSLESS),
                        png, "-o", path], check=True)
    finally:
        os.remove(png)
    return f"near-lossless {NEAR_LOSSLESS}"


def save_webp(img, path, lossless_only=False, full_tier=False, lossy=False):
    """animation sheets: near-lossless 60 (Corey 2026-10-15, S4: "I really can't tell the differences"); on the half
    tier only when plain lossless is within 1.6x the q95 file, else q95 (alpha stays lossless) as before.
    lossless_only: the base atlas, where the static tiles must be the approved pixels exactly (stays lossless)."""
    if lossless_only:
        img.save(path, "WEBP", lossless=True, quality=100, method=6)
        return "lossless"
    if lossy:
        img.save(path, "WEBP", quality=R2_QUALITY, method=6, alpha_quality=100)
        return f"q{R2_QUALITY}"
    if full_tier:
        return save_near_lossless(img, path)
    img.save(path + ".tmp-ll", "WEBP", lossless=True, quality=100, method=4)
    img.save(path + ".tmp-lossy", "WEBP", quality=95, method=6, alpha_quality=100)
    ll, lossy = os.path.getsize(path + ".tmp-ll"), os.path.getsize(path + ".tmp-lossy")
    pick = ".tmp-ll" if ll <= lossy * 1.6 else ".tmp-lossy"
    if pick == ".tmp-lossy":
        os.replace(path + pick, path)
    for t in (".tmp-ll", ".tmp-lossy"):
        if os.path.exists(path + t):
            os.remove(path + t)
    return save_near_lossless(img, path) if pick == ".tmp-ll" else "q95"


def h8(path):
    """the first 8 hex of the file's md5: scripts/stamp-assets.mjs's meta.pngHash, written here too so a sheet that
    script does not list (the win sheets) still changes its json, and so its stamped URL, when its picture changes"""
    import hashlib
    return hashlib.md5(open(path, "rb").read()).hexdigest()[:8]


def pack(name, frames, px, clip, meta_extra, full_tier=None, lossy=False):
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
    # full tier: was always lossless (Corey 2026-10-06); since 2026-10-15 (Corey, S4 of the download analysis, after
    # the side-by-side samples) near-lossless 60. Half tier: near-lossless 60 unless plain lossless is 1.6x the q95
    # file, then q95 as before. The base atlas (build_atlas) stays lossless.
    full_tier = (px == CELL) if full_tier is None else full_tier
    enc = save_webp(sheet, os.path.join(SPRITES, name + ".webp"), full_tier=full_tier, lossy=lossy)
    meta = {"image": name + ".webp", "format": "RGBA8888", "size": {"w": sheet.width, "h": sheet.height},
            "scale": "1" if full_tier else "0.5", "fps": FPS, "encoding": enc}
    meta.update(meta_extra)
    if STYLE:
        meta["style"] = {"name": STYLE_NAME, **STYLE}
    meta["pngHash"] = h8(os.path.join(SPRITES, name + ".webp"))
    doc = {"frames": out, "animations": {clip: [f for f, _ in frames]}, "meta": meta}
    json.dump(doc, open(os.path.join(SPRITES, name + ".json"), "w"), indent=1)
    pages.append(sheet.size)
    return {"cells": len(uniq), "frames": len(frames), "size": sheet.size, "encoding": enc}


def build_sheets(geo, only):
    report = {}
    for code in CODES:
        if only and code not in only:
            continue
        clips = CLIPS.get(code, DEFAULT_CLIPS)
        g = geo[code]
        for clip in CLIP_KINDS:
            folder = clips.get(clip)
            if not folder:
                if clip != "win":
                    print(f"{code} {clip}: none delivered, skipped")
                continue
            canvas = win_canvas(code, folder) if clip == "win" else 1.0
            px_full, px_half = canvas_px(CELL, canvas), canvas_px(HALF, canvas)
            files = frame_files(clip_dir(code, folder))
            full, half = [], []
            for i, fp in enumerate(files):
                src = Image.open(fp)
                assert src.size[0] == src.size[1], fp
                fname = f"{code.lower()}-{clip}-{i:03d}"
                cell = stylize(process(src, g, px_full, canvas), code=code)
                full.append((fname, cell))
                if HALF_TIER:
                    half.append((fname, half_of(cell) if STYLE else process(src, g, px_half, canvas)))
            src_rel = os.path.relpath(clip_dir(code, folder), SYMBOLS_DIR)
            fit_meta = {"fit": {"source": src_rel, "sourcePx": round(512 * canvas),
                                "box512": [round(v, 3) for v in source_box(g, 512)], "angle": g["angle"],
                                "fitJson": g["fit"]}}
            if STYLE.get("darkRim"):
                fit_meta["darkRimPx"] = [round(v, 3) for v in dark_rim_px(code)]
            base = f"{code.lower()}-{clip}"
            if canvas != 1.0:
                # the game draws the sheet at `scale` x the cell, centred, so the cell area stays where it was
                meta_full = {**fit_meta, "canvas": {"scale": canvas, "cellPx": CELL, "px": px_full}}
                meta_half = {**fit_meta, "canvas": {"scale": canvas, "cellPx": HALF, "px": px_half}}
            else:
                meta_full = meta_half = fit_meta
            lossy = bool(clips.get("win"))  # R2_QUALITY
            r1 = pack(base, full, px_full, clip, meta_full, full_tier=True, lossy=lossy)
            r2 = pack(base + "-half", half, px_half, clip, meta_half, full_tier=False, lossy=lossy) if HALF_TIER else r1
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
            tile = Image.open(tile_path(code)).convert("RGBA")
            tile = stylize(tile, code=code)
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
        tile = Image.open(tile_path(code)).convert("RGBA")
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


def diff_max(a, b):
    """premultiplied RGBA on 0..255: mean, max, pixels with any channel over 8"""
    d = np.abs(pm(a) - pm(b))
    return round(float(d.mean()), 4), round(float(d.max()), 3), int((d.max(-1) > 8).sum())


def centre(im, px):
    o = (im.width - px) // 2
    return im.crop((o, o, o + px, o + px))


def verify_win(code, line):
    """the win sheet (both tiers): frame 0's centre cell vs drop frame 0 and the atlas's static tile, the hold frames,
    the alpha outside the centre cell at the worst frame, and nothing on the canvas edge"""
    c = code.lower()
    if not os.path.exists(os.path.join(SPRITES, f"{c}-win.json")):
        return
    atlas = {"": sheet_frames_atlas("mmSymbols"), "-half": sheet_frames_atlas("mmSymbols-half")}
    for suffix, px in (("", CELL), ("-half", HALF)):
        doc = json.load(open(os.path.join(SPRITES, f"{c}-win{suffix}.json")))
        win = sheet_frames(f"{c}-win{suffix}")
        drop = sheet_frames(f"{c}-drop{suffix}")
        names = list(win)
        w0 = win[names[0]]
        cv = doc["meta"]["canvas"]
        tag = "win" + suffix
        line[tag + "_n"] = len(names)
        line[tag + "_canvas"] = cv
        line[tag + "0_centre_vs_drop0"] = diff_max(centre(w0, px), drop[f"{c}-drop-000"])
        line[tag + "0_centre_vs_atlasTile"] = diff_max(centre(w0, px), atlas[suffix][f"{code}.png"])
        line[tag + "0_outside_alpha"] = int(np.asarray(w0)[..., 3].sum() - np.asarray(centre(w0, px))[..., 3].sum())
        last = win[names[-1]]
        line[tag + "_hold_identical_from"] = next(i for i in range(len(names)) if all(diff_max(win[names[j]], last)[1] == 0 for j in range(i, len(names))))
        worst = (0.0, -1)
        edge = 0
        for i, n in enumerate(names):
            a = np.asarray(win[n])[..., 3].astype(np.float64)
            inner = np.asarray(centre(win[n], px))[..., 3].astype(np.float64).sum()
            out = 1 - inner / max(1.0, a.sum())
            if out > worst[0]:
                worst = (round(out, 4), i)
            edge = max(edge, int(max(a[0].max(), a[-1].max(), a[:, 0].max(), a[:, -1].max())))
        line[tag + "_worst_outside_cell"] = worst
        line[tag + "_canvas_edge_alpha_max"] = edge


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
        tile = Image.open(tile_path(code)).convert("RGBA")
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
        clips = CLIPS.get(code, DEFAULT_CLIPS)
        line["clip_drop"] = clipped_alpha(geo, code, clip_dir(code, clips["drop"]))
        if clips.get("idle"):
            line["clip_idle"] = clipped_alpha(geo, code, clip_dir(code, clips["idle"]))
        verify_win(code, line)
        rows.append(line)
        print(json.dumps(line))
    # base atlas: the ten tiles exactly, overlays untouched
    for suffix, px in (("", CELL), ("-half", HALF)):
        fr = sheet_frames_atlas(f"mmSymbols{suffix}")
        for code in CODES:
            t = Image.open(tile_path(code)).convert("RGBA")
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
        picks = [Image.open(tile_path(code)).convert("RGBA")]
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
