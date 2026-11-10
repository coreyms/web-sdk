"""Build the Run Over Reindeer first-pass art from Corey's source images.

Run with the math env's Python (Pillow, numpy, fontTools, brotli):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_assets.py
Then `node scripts/stamp-assets.mjs` (pnpm dev and pnpm build run it for you).

It only READS the sources (the Desktop folder and ~/Library/Fonts) and writes inside this app:
  static/assets/road/road.webp            the locked board background, at source size (1536 x 1024)
  static/assets/road/tunnel-left.webp     the left portal (stone wall and rim) cut along the tunnel mouth, with alpha;
  static/assets/road/tunnel-right.webp    drawn OVER the symbols so traffic comes out from under it
  static/assets/symbols/symbols.json + .webp         the symbol atlas, desktop tier (ATLAS_SCALE.full px per road px);
                                                     it also carries the stoplight's frames (gather_stoplight)
  static/assets/symbols/symbols-phone.json + .webp   the phone tier twin (ATLAS_SCALE.phone px per road px)
  static/assets/symbols/single/<frame>.webp          one small picture per symbol for the HTML rules page
  static/assets/fonts/overpass/*.woff2               Overpass Regular, Bold, ExtraBold and Heavy
  src/game/roadArtSpec.ts                            the measured numbers the game places things by (generated)

"Road px" are pixels of the 1536 x 1024 background. The whole board (lanes, columns, symbols, the portals) is
authored in road px and scaled as one piece per layout (src/game/layoutSpec.ts ROAD).

Every size below is a first-pass decision. docs/FIRST_PASS_DECISIONS.md lists them.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "static", "assets")
SRC = os.path.expanduser("~/Desktop/Run Over Reindeer")
MOCK = os.path.join(SRC, "references", "mockups")
CARS = os.path.join(SRC, "models", "meshy_cars_v2")
FONTS = os.path.expanduser("~/Library/Fonts")

BACKGROUND = os.path.join(MOCK, "road_tunnels_phone_v12.png")

# ---- the board in road px -------------------------------------------------------------------------------------
COLUMNS = 5
ROWS = 4
# One column's width. The locked mock (mock_lanes_85.jpg) has a column 300 wide for a lane 212 tall; the painted
# lanes here average 171 road px, which gives about 242. 250 puts the outer columns 91 road px inside each tunnel
# mouth, at the foot of the painted tunnel shadow.
COLUMN_PITCH = 250

# ---- symbol sizes in road px ------------------------------------------------------------------------------------
# The four cars share one scale (they came out of one camera): the widest, the police car, is CAR_MAX_WIDTH wide.
CAR_MAX_WIDTH = 230
# The signs are sized by visual area (Corey 2026-11-04): the A's picture is SIGN_A_HEIGHT tall, and each lower
# sign's painted area is this share of the A's.
SIGN_A_HEIGHT = 160
SIGN_AREA = {"L1": 1.00, "L2": 0.95, "L3": 0.90, "L4": 0.85, "L5": 0.80}
SLEIGH_WIDTH = 205
PRESENT_HEIGHT = 150
REINDEER_HEIGHT = 190

# Atlas pixels per road px. House rule: 3 physical px per CSS px at the largest draw size.
#   full   a 1920 x 1080 desktop draws the road at 1.07 CSS px per road px (ROAD.landscape x 1.5): 3.2 px
#   phone  a phone held sideways (932 x 430) draws it at 0.39, upright (440 wide) at 0.29: 1.2 px covers both
ATLAS_SCALE = {"full": 3.2, "phone": 1.2}

# Frame names are the contract with the game (src/game/config.ts): H1 Grandma's car, H2 station wagon, H3 OH-KAY van,
# H4 police car (the order of the lower three is still open in the spec), L1-L5 the signs A K Q J 10, W Santa's
# sleigh, S the present. Cars and the sleigh have one frame per driving direction: _R for the top two lanes (left to
# right) and _L for the bottom two (right to left), so lettering and tags are never mirrored.
CAR_SOURCES = {
    "H1": ("renders_v7/final/grandma_{d}.png", "Grandma's car, render v7"),
    "H2": ("renders_v7/final/wagon_{d}.png", "station wagon, render v7"),
    "H3": ("renders_v4/final/van_{d}.png", "OH-KAY van, render v4"),
    "H4": ("renders_v7/final/police_{d}.png", "police car, render v7 (light bar off)"),
}
SIGN_SOURCES = {
    "L1": "sign_A_v2.png",
    "L2": "sign_K_v2.png",
    "L3": "sign_Q_v2.png",
    "L4": "sign_J_v2.png",
    "L5": "speed_limit_10_v3.png",
}
SLEIGH_SOURCE = "santa_sleigh_v6_2runners.png"
REINDEER_SOURCE = "reindeer_run_ref_v2.png"

SNOW = (233, 240, 253)

# ---- the stoplights (Corey 2026-11-09) --------------------------------------------------------------------------
# One signal seen from above: a tall dark housing with a yellow edge, three glass domes on its RIGHT edge, a steel
# arm on its LEFT. As drawn it is the bottom left light (arm into the left tunnel); the game mirrors the same
# frames for the top right one, so the two are an exact matched pair.
STOPLIGHT_SOURCE = os.path.join("stoplight", "stoplight_unlit_v4.png")
# the housing's height (outline to outline) the frames are built at: one lane and a half (the lanes average 171)
STOPLIGHT_HOUSING_HEIGHT = 256
# the lit lens colors (flat, bright), top dome first
STOPLIGHT_LIT = {"red": (255, 48, 40), "amber": (255, 196, 22), "green": (52, 238, 104)}
# the soft glow picture: this many road px across at the built size (a white blob with alpha, tinted by the game)
STOPLIGHT_GLOW_SIZE = 120


def font(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, f"overpass-{weight}.otf"), size)


def trim(im):
    """Crop to the picture's alpha box (pixels over a small alpha floor, so stray haze does not count)."""
    a = np.asarray(im.split()[3])
    ys, xs = np.where(a > 8)
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def resize(im, scale):
    w = max(1, round(im.width * scale))
    h = max(1, round(im.height * scale))
    # premultiply so the resample does not pull dark fringes out of transparent pixels
    arr = np.asarray(im).astype(np.float32) / 255.0
    arr[..., :3] *= arr[..., 3:4]
    pm = Image.fromarray((arr * 255).round().astype(np.uint8), "RGBA").resize((w, h), Image.LANCZOS)
    out = np.asarray(pm).astype(np.float32) / 255.0
    alpha = np.clip(out[..., 3:4], 1e-6, 1)
    out[..., :3] = np.clip(out[..., :3] / alpha, 0, 1)
    return Image.fromarray((out * 255).round().astype(np.uint8), "RGBA")


# ---- the background and its measurements -------------------------------------------------------------------------
def runs(mask):
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        if not v and start is not None:
            out.append((start, i - 1))
            start = None
    if start is not None:
        out.append((start, len(mask) - 1))
    return out


def measure_background(bg):
    rgb = np.asarray(bg.convert("RGB")).astype(int)
    h, w, _ = rgb.shape
    luma = rgb.mean(axis=2)
    band = rgb[:, w // 3 : 2 * w // 3, :]
    white = ((band[..., 0] > 190) & (band[..., 1] > 190) & (band[..., 2] > 190)).mean(axis=1) > 0.3
    yellow = ((band[..., 0] > 190) & (band[..., 1] > 160) & (band[..., 2] < 90)).mean(axis=1) > 0.5
    # the painted lines between the snow banks: thin runs only (the banks are far thicker)
    whites = [(a + b) / 2 for a, b in runs(white) if b - a < 30 and 100 < a < h - 100]
    yellows = runs(yellow)
    if len(whites) != 4 or len(yellows) != 2:
        sys.exit(f"build_assets: expected 4 white lane lines and a double yellow, found {whites} {yellows}")
    centre = (yellows[0][0] + yellows[1][1]) / 2
    lines = [whites[0], whites[1], centre, whites[2], whites[3]]

    # the tunnel mouths: on each row, the first run of dark asphalt coming in from the image edge
    def edge(y, left):
        row = luma[y]
        rng = range(0, 400) if left else range(w - 1, w - 400, -1)
        for x in rng:
            seg = row[x : x + 12] if left else row[x - 11 : x + 1]
            if (seg < 70).all():
                return x
        return None

    top = int(lines[0]) - 75
    bottom = int(lines[4]) + 75
    left, right = {}, {}
    for y in range(top, bottom + 1):
        left[y] = edge(y, True)
        right[y] = edge(y, False)

    def smooth(edges):
        ys = sorted(edges)
        vals = np.array([edges[y] if edges[y] is not None else np.nan for y in ys], dtype=float)
        # fill gaps, then a running median so one snow speck does not notch the cut
        good = ~np.isnan(vals)
        vals = np.interp(np.arange(len(vals)), np.flatnonzero(good), vals[good])
        k = 15
        pad = np.pad(vals, k, mode="edge")
        med = np.array([np.median(pad[i : i + 2 * k + 1]) for i in range(len(vals))])
        return dict(zip(ys, med))

    return {"lines": lines, "left": smooth(left), "right": smooth(right), "rows": (top, bottom)}


def build_road(spec):
    os.makedirs(os.path.join(OUT, "road"), exist_ok=True)
    bg = Image.open(BACKGROUND).convert("RGB")
    m = measure_background(bg)
    bg.save(os.path.join(OUT, "road", "road.webp"), quality=92, method=6)

    rgba = np.asarray(bg.convert("RGBA")).copy()
    top, bottom = m["rows"]
    covers = {}
    for side in ("left", "right"):
        edges = m[side]
        xs = np.array([edges[y] for y in range(top, bottom + 1)])
        if side == "left":
            x0, x1 = 0, int(math.ceil(xs.max())) + 2
        else:
            x0, x1 = int(math.floor(xs.min())) - 2, bg.width
        strip = rgba[top : bottom + 1, x0:x1].copy()
        cols = np.arange(x0, x1)[None, :]
        e = xs[:, None]
        # 1 px soft edge on the mouth line; solid outside it
        cover = np.clip((e - cols) if side == "left" else (cols - e), 0, 1)
        # fade the strip's own top and bottom over 12 rows so it never shows a hard end on the snow
        rows = np.arange(strip.shape[0])[:, None]
        fade = np.clip(np.minimum(rows, strip.shape[0] - 1 - rows) / 12.0, 0, 1)
        strip[..., 3] = (cover * fade * 255).round().astype(np.uint8)
        name = f"tunnel-{side}.webp"
        Image.fromarray(strip, "RGBA").save(os.path.join(OUT, "road", name), lossless=True, method=6)
        covers[side] = {"x": x0, "y": top, "width": x1 - x0, "height": bottom + 1 - top}
        # the mouth line the traffic appears from, at the road's mid height
        covers[side]["mouth"] = float(edges[int((m["lines"][0] + m["lines"][4]) / 2)])
        # the mouth line down the portal, every 20 road px: [y, x] (the stoplights hang from it)
        covers[side]["mouthLine"] = [[y, round(float(edges[y]), 1)] for y in range(top, bottom + 1, 20)]

    spec["image"] = {"width": bg.width, "height": bg.height}
    spec["laneLines"] = [round(v, 1) for v in m["lines"]]
    spec["covers"] = covers
    spec["snow"] = "#%02x%02x%02x" % SNOW
    board_w = COLUMNS * COLUMN_PITCH
    centre = (covers["left"]["mouth"] + covers["right"]["mouth"]) / 2
    spec["board"] = {"columns": COLUMNS, "rows": ROWS, "pitch": COLUMN_PITCH, "x": round(centre - board_w / 2, 1), "width": board_w}


# ---- symbols ---------------------------------------------------------------------------------------------------------
def label_strip(im, text, fill=(255, 235, 59), ink=(20, 20, 24)):
    """A plain tag across the lower part of a placeholder so nobody mistakes it for final art."""
    draw = ImageDraw.Draw(im)
    size = max(12, im.width // 9)
    f = font("heavy", size)
    box = draw.textbbox((0, 0), text, font=f)
    tw, th = box[2] - box[0], box[3] - box[1]
    pad = size // 3
    x0 = (im.width - tw) // 2 - pad
    y0 = im.height - th - 3 * pad
    draw.rectangle((x0, y0, x0 + tw + 2 * pad, y0 + th + 2 * pad), fill=fill + (255,), outline=ink + (255,), width=max(2, size // 10))
    draw.text((x0 + pad - box[0], y0 + pad - box[1]), text, font=f, fill=ink + (255,))
    return im


def make_present(px):
    """PLACEHOLDER scatter: a turquoise and white wrapped box with FS on it (the spec's colors), tagged."""
    s = 4  # supersample
    w = h = px * s
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    teal, white, ink = (0, 191, 196, 255), (250, 252, 255, 255), (18, 22, 30, 255)
    line = max(6, w // 40)
    # box
    bx0, by0, bx1, by1 = int(w * 0.10), int(h * 0.36), int(w * 0.90), int(h * 0.97)
    d.rounded_rectangle((bx0, by0, bx1, by1), radius=w // 24, fill=teal, outline=ink, width=line)
    for i in range(1, 8, 2):
        x = bx0 + (bx1 - bx0) * i // 8
        d.rectangle((x - w // 36, by0 + line, x + w // 36, by1 - line), fill=white)
    # lid
    lx0, ly0, lx1, ly1 = int(w * 0.05), int(h * 0.22), int(w * 0.95), int(h * 0.40)
    d.rounded_rectangle((lx0, ly0, lx1, ly1), radius=w // 30, fill=white, outline=ink, width=line)
    # bow
    cx = w // 2
    for sx in (-1, 1):
        d.ellipse((cx + sx * w * 0.02 - (w * 0.20 if sx < 0 else 0), h * 0.03, cx + sx * w * 0.02 + (w * 0.20 if sx > 0 else 0), h * 0.24), fill=teal, outline=ink, width=line)
    d.ellipse((cx - w * 0.06, h * 0.12, cx + w * 0.06, h * 0.26), fill=white, outline=ink, width=line)
    # FS plate
    f = font("heavy", int(h * 0.30))
    box = d.textbbox((0, 0), "FS", font=f)
    tw, th = box[2] - box[0], box[3] - box[1]
    px0, py0 = cx - tw // 2 - w // 30, int(h * 0.50)
    d.rounded_rectangle((px0, py0, px0 + tw + w // 15, py0 + th + h // 14), radius=w // 40, fill=white, outline=ink, width=line)
    d.text((px0 + w // 30 - box[0], py0 + h // 28 - box[1]), "FS", font=f, fill=ink)
    im = im.resize((px, px), Image.LANCZOS)
    return trim(im)


def gather_symbols(scale):
    """name -> RGBA picture at `scale` atlas px per road px, trimmed to its alpha box."""
    out = {}
    notes = {}

    # cars: one common scale from the widest (the police car)
    trimmed = {}
    for code, (pattern, note) in CAR_SOURCES.items():
        for d in ("R", "L"):
            trimmed[f"{code}_{d}"] = trim(Image.open(os.path.join(CARS, pattern.format(d=d))).convert("RGBA"))
        notes[code] = note
    widest = max(im.width for im in trimmed.values())
    car_k = CAR_MAX_WIDTH / widest
    for name, im in trimmed.items():
        out[name] = resize(im, car_k * scale)

    # signs: by painted area against the A
    signs = {code: trim(Image.open(os.path.join(MOCK, src)).convert("RGBA")) for code, src in SIGN_SOURCES.items()}
    area = {code: float((np.asarray(im.split()[3]) > 128).sum()) for code, im in signs.items()}
    a_k = SIGN_A_HEIGHT / signs["L1"].height
    a_area = area["L1"] * a_k * a_k
    for code, im in signs.items():
        k = math.sqrt(SIGN_AREA[code] * a_area / area[code])
        out[code] = resize(im, k * scale)
        notes[code] = f"{SIGN_SOURCES[code]} (draft), {round(SIGN_AREA[code] * 100)}% of the A's painted area"

    # Santa's sleigh, the natural Wild: the empty sleigh still with a WILD tag (Santa's seated layer is not composited yet)
    sleigh = trim(Image.open(os.path.join(MOCK, SLEIGH_SOURCE)).convert("RGBA"))
    sleigh = resize(sleigh, SLEIGH_WIDTH / sleigh.width * 4)  # tag drawn at 4 px per road px, then to scale
    # one picture per driving direction (the source faces right): mirrored first, tagged after, so WILD always reads
    for d, im in (("R", sleigh), ("L", sleigh.transpose(Image.FLIP_LEFT_RIGHT))):
        out[f"W_{d}"] = resize(label_strip(im.copy(), "WILD", fill=(255, 255, 255), ink=(200, 16, 46)), scale / 4)
    notes["W"] = f"{SLEIGH_SOURCE} with a WILD tag (no Santa in it yet)"

    present = make_present(PRESENT_HEIGHT * 4)
    present = label_strip(present, "PLACEHOLDER")
    out["S"] = resize(present, scale / 4)
    notes["S"] = "PLACEHOLDER drawn by tools/build_assets.py (turquoise and white box, FS)"

    deer = trim(Image.open(os.path.join(MOCK, REINDEER_SOURCE)).convert("RGBA"))
    deer = resize(deer, REINDEER_HEIGHT / deer.height * 4)
    deer = label_strip(deer, "PLACEHOLDER")
    out["reindeer_run"] = resize(deer, scale / 4)
    notes["reindeer_run"] = f"PLACEHOLDER: {REINDEER_SOURCE} (a still, not the run cycle), tagged"
    return out, notes


def gather_stoplight(scale):
    """The stoplight's frames at `scale` atlas px per road px, and where each sits on the unlit picture (road px).

    stoplight          the unlit signal, trimmed to its alpha box
    stoplight_red      the lit lens of each dome: only the dome's glass, recolored bright, cut from the same picture
    stoplight_amber    so it lands exactly on the dark dome under it
    stoplight_green
    stoplight_glow     a soft white blob with alpha (tinted and added over the lit dome by the game; no filter)
    """
    from scipy import ndimage

    src = Image.open(os.path.join(MOCK, STOPLIGHT_SOURCE)).convert("RGBA")
    a = np.asarray(src).copy()
    a[a[..., 3] <= 8] = 0  # stray near-transparent haze around the drawing
    ys, xs = np.where(a[..., 3] > 8)
    bx0, by0, bx1, by1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    rgb = a[..., :3].astype(float)
    solid = a[..., 3] > 128
    # the housing: the yellow edge's box, plus the black outline around it (as thick as the gap above the yellow)
    yel = (rgb[..., 0] > 200) & (rgb[..., 1] > 150) & (rgb[..., 2] < 90) & solid
    yy, yx = np.where(yel)
    outline = int(yy.min()) - by0
    hx0, hx1 = int(yx.min()) - outline, int(yx.max()) + 1 + outline
    hy0, hy1 = by0, by1
    k = STOPLIGHT_HOUSING_HEIGHT / (hy1 - hy0)  # road px per source px

    base = Image.fromarray(a, "RGBA").crop((bx0, by0, bx1, by1))
    out = {"stoplight": resize(base, k * scale)}

    # the domes: the colored glass right of the yellow edge, one blob per light, its pale highlight filled in
    x_edge = int(yx.max()) + 1
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    glass = solid & (sat > 0.35) & (mx > 22)  # the glass and its darker shadow tone; the outline is under 10
    glass[:, :x_edge] = False
    labels, count = ndimage.label(glass)
    blobs = sorted((i for i in range(1, count + 1) if (labels == i).sum() > 2000), key=lambda i: np.where(labels == i)[0].min())
    if len(blobs) != 3:
        sys.exit(f"build_assets: expected 3 stoplight domes, found {len(blobs)}")
    domes = {}
    for name, i in zip(("red", "amber", "green"), blobs):
        mask = ndimage.binary_fill_holes(labels == i)
        dy, dx = np.where(mask)
        pad = 4
        x0, y0, x1, y1 = int(dx.min()) - pad, int(dy.min()) - pad, int(dx.max()) + 1 + pad, int(dy.max()) + 1 + pad
        m = mask[y0:y1, x0:x1]
        px = rgb[y0:y1, x0:x1]
        value = px.max(axis=2)
        body = float(np.median(value[m]))
        # the glass in its lit color; the drawing's own shadow tone stays a little darker, its highlight goes near white
        r = value / max(body, 1.0)
        lit = np.array(STOPLIGHT_LIT[name], dtype=float)
        col = lit[None, None, :] * np.clip(0.94 * r, 0.72, 1.0)[..., None]
        hot = np.clip((r - 1.45) / 0.5, 0, 1)[..., None] * 0.85
        col = col * (1 - hot) + 255.0 * hot
        # a soft edge, so the lens blends into the dome's black outline instead of leaving a dark or bright rim
        alpha = np.clip(ndimage.gaussian_filter(m.astype(float), 1.2) * 1.6 - 0.3, 0, 1)
        tile = np.dstack([np.clip(col, 0, 255), alpha * 255]).round().astype(np.uint8)
        out[f"stoplight_{name}"] = resize(Image.fromarray(tile, "RGBA"), k * scale)
        domes[name] = {
            # the overlay's top left corner on the unlit picture, and the dome's centre, road px
            "x": round((x0 - bx0) * k, 2),
            "y": round((y0 - by0) * k, 2),
            "width": round((x1 - x0) * k, 2),
            "height": round((y1 - y0) * k, 2),
            "centreX": round(((dx.min() + dx.max() + 1) / 2 - bx0) * k, 2),
            "centreY": round(((dy.min() + dy.max() + 1) / 2 - by0) * k, 2),
        }

    # the glow: a white blob whose alpha falls off smoothly to nothing at the picture's edge
    g = max(16, round(STOPLIGHT_GLOW_SIZE * scale / 2))  # half the road px density is plenty for a blur
    yy2, xx2 = np.mgrid[0:g, 0:g]
    d = np.hypot(xx2 - (g - 1) / 2, yy2 - (g - 1) / 2) / (g / 2)
    fall = np.clip(1 - d, 0, 1) ** 2 * np.exp(-2.2 * d * d)
    glow = np.dstack([np.full((g, g, 3), 255.0), fall / fall.max() * 255]).round().astype(np.uint8)
    out["stoplight_glow"] = Image.fromarray(glow, "RGBA")

    info = {
        "width": round((bx1 - bx0) * k, 2),
        "height": round((by1 - by0) * k, 2),
        # the housing's box on the unlit picture (outline to outline): x1 is the edge the domes sit on
        "housing": {"x0": round((hx0 - bx0) * k, 2), "x1": round((hx1 - bx0) * k, 2), "y0": 0, "y1": round((hy1 - hy0) * k, 2)},
        "domes": domes,
        "glowSize": STOPLIGHT_GLOW_SIZE,
        "lit": {name: "#%02x%02x%02x" % c for name, c in STOPLIGHT_LIT.items()},
    }
    return out, info


def pack(pictures, max_width):
    """Shelf pack, tallest first, 2 px gutters. Returns (sheet, frames)."""
    gap = 2
    order = sorted(pictures.items(), key=lambda kv: -kv[1].height)
    x = y = shelf = 0
    width = 0
    place = {}
    for name, im in order:
        if x and x + im.width + gap > max_width:
            x = 0
            y += shelf + gap
            shelf = 0
        place[name] = (x, y)
        x += im.width + gap
        width = max(width, x)
        shelf = max(shelf, im.height)
    height = y + shelf
    sheet = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    frames = {}
    for name, im in pictures.items():
        px, py = place[name]
        sheet.paste(im, (px, py))
        frames[name] = {
            "frame": {"x": px, "y": py, "w": im.width, "h": im.height},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": im.width, "h": im.height},
            "sourceSize": {"w": im.width, "h": im.height},
        }
    return sheet, frames


def build_symbols(spec):
    os.makedirs(os.path.join(OUT, "symbols", "single"), exist_ok=True)
    sizes = {}
    notes = {}
    for tier, scale in ATLAS_SCALE.items():
        pictures, notes = gather_symbols(scale)
        lights, light_info = gather_stoplight(scale)
        pictures.update(lights)
        sheet, frames = pack(pictures, 2048 if tier == "full" else 1024)
        stem = "symbols" if tier == "full" else "symbols-phone"
        sheet.save(os.path.join(OUT, "symbols", f"{stem}.webp"), lossless=True, method=6)
        meta = {"frames": frames, "meta": {"image": f"{stem}.webp", "format": "RGBA8888", "size": {"w": sheet.width, "h": sheet.height}, "scale": "1"}}
        with open(os.path.join(OUT, "symbols", f"{stem}.json"), "w") as fh:
            json.dump(meta, fh, indent=1)
            fh.write("\n")
        print(f"  {stem}: {sheet.width} x {sheet.height}, {len(frames)} frames")
        if tier == "full":
            spec["stoplight"] = light_info
            for name, im in pictures.items():
                if name.startswith("stoplight"):
                    continue  # placed by its own numbers (spec.stoplight), and never on the rules page
                sizes[name] = {"width": round(im.width / scale, 1), "height": round(im.height / scale, 1)}
                # the rules page pictures: 2 px per road px is plenty for a 60 px table cell at 3x
                small = resize(im, 2 / scale)
                small.save(os.path.join(OUT, "symbols", "single", f"{name}.webp"), quality=90, method=6)
    spec["symbols"] = sizes
    spec["symbolNotes"] = notes
    spec["atlasScale"] = ATLAS_SCALE


# ---- fonts -----------------------------------------------------------------------------------------------------------
OVERPASS = {"regular": 400, "bold": 700, "extrabold": 800, "heavy": 900}

OFL = """Copyright 2016 Red Hat, Inc.

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is available with a FAQ at: https://openfontlicense.org

The font files in this folder are Overpass v3.0.5 (Red Hat), converted from the installed .otf files to .woff2 by
tools/build_assets.py with no change to the outlines. Check this notice against the release's own OFL.txt before
the game ships.
"""


def build_fonts(spec):
    from fontTools.ttLib import TTFont

    out = os.path.join(OUT, "fonts", "overpass")
    os.makedirs(out, exist_ok=True)
    for name, weight in OVERPASS.items():
        dst = os.path.join(out, f"Overpass-{name}.woff2")
        src = os.path.join(FONTS, f"overpass-{name}.otf")
        # the woff2 packer is not bit-reproducible: an unchanged source is never packed again, or its content stamp
        # would move and every returning player would download the same font twice (house rule)
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            print(f"  Overpass-{name}.woff2 kept")
            continue
        f = TTFont(src)
        f.flavor = "woff2"
        f.save(dst)
        print(f"  Overpass-{name}.woff2 {os.path.getsize(dst)} bytes")
    with open(os.path.join(out, "OFL-Overpass.txt"), "w") as fh:
        fh.write(OFL)
    spec["fonts"] = {name: weight for name, weight in OVERPASS.items()}


def write_spec(spec):
    path = os.path.join(APP, "src", "game", "roadArtSpec.ts")
    body = json.dumps(spec, indent="\t")
    with open(path, "w") as fh:
        fh.write("// AUTO-GENERATED by tools/build_assets.py from the source art. Do not edit: change the tool and run it again.\n")
        fh.write("// Every length is in road px (pixels of the 1536 x 1024 board background).\n")
        fh.write(f"export const ROAD_ART = {body} as const;\n")
    print(f"  wrote {os.path.relpath(path, APP)}")


def main():
    spec = {}
    print("road")
    build_road(spec)
    print("symbols")
    build_symbols(spec)
    print("fonts")
    build_fonts(spec)
    write_spec(spec)


if __name__ == "__main__":
    main()
