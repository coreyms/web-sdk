"""Build the scatter present's animation sheets for the game from the approved 3D frames (round 1, 2026-11-15).

Run with the math env's Python (Pillow, numpy, scipy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_present.py
Then `node scripts/stamp-assets.mjs` (pnpm dev and pnpm build run it for you).

It only READS the delivered frames (~/Desktop/Run Over Reindeer/scatter_present_3d_r1_2026-11-15: frames/painted, the
part ID renders in work/raw, frames/meta.js) and writes inside this app:
  static/assets/present/present-<tier>-still.webp    the closed present (in the preload; the symbol atlas has no S)
  static/assets/present/present-<tier>-peek-<n>.webp the landing peek's pictures and the light's sprites (kept loaded)
  static/assets/present/present-<tier>-open-<n>.webp the full open's pictures (loaded for a book with a trigger only)
  src/game/presentSpec.ts                            every piece's place, the frames, the clips, the light's numbers
and, with --evidence <dir>, the same pieces as PNG plus present_trim.js for the side by side page (compare.html).

THE ART IS NOT CHANGED. Every picture the game draws is one of the delivered painted frames, resampled once to the
tier's density and cut into pieces that put it back together exactly:
  - BACK and FRONT: the delivered `_over` frame is the frame minus the box's inside. The back piece is the inside alone
    (base minus over, worked out per pixel so that over on top of it gives the base back); the front piece is the over
    frame. The light is drawn between the two, as the demo page draws it between a frame and its `_over` copy, and
    with the light off the two give the delivered frame. The back piece only exists where the inside shows (it is a
    thin strip around the opening), so a frame costs about one picture, not two.
  - THE STATIC BODY: in the frames listed in SHARED_BODY the box's body is rendered at exactly 1.000 scale, so its
    pixels are the same frame to frame (measured, see NOTES.md). Those frames draw one shared body picture with a front
    piece on top holding the lid and bow and every pixel that differs from the shared body by more than SAME_TOL.
  - FRAMES DROPPED: the frames left out of KEEP are shown as the measured nearest neighbour (SUBSTITUTE); the light's
    numbers still follow the delivered timeline frame by frame.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "static", "assets", "present")
SRC = os.path.expanduser("~/Desktop/Run Over Reindeer/scatter_present_3d_r1_2026-11-15")
PAINTED = os.path.join(SRC, "frames", "painted")
RAW = os.path.join(SRC, "work", "raw")

# ---- the delivered frames ---------------------------------------------------------------------------------------------
SRC_DENSITY = 3.2  # px per road px of the delivered 640 x 800 frames
CANVAS = (640, 800)
# the closed present's bottom centre (the delivery note: centre x 320, lowest point y 751; with its outline the ink ends
# at the edge y 754). This frame point stands on the symbol's sit line, for the still and every animation frame.
ANCHOR = (320.0, 754.0)
FPS = 30

# ---- density per asset tier, sheet px per road px -----------------------------------------------------------------------
# House rule: 3 physical px per CSS px at the largest draw size.
#   full   the largest the desktop tier draws the road is a 1920 x 1080 desktop: 1.5 x 982 / 1536 = 0.959 CSS px per road
#          px (game/layoutSpec.ts ROAD_LAYOUT.landscape since the 2026-11-10 shrink; build_assets.py RUN_CSS_PER_ROAD).
#          3 x 0.959 = 2.88. (The symbol atlas still carries 3.2, sized for the road before that shrink.)
#   phone  the game's phone tier scale (build_assets.py ATLAS_SCALE.phone): 1.2
DENSITY = {"full": 2.88, "phone": 1.2}
SHEET_MAX = {"full": 2048, "phone": 2048}
GUTTER = {"full": 4, "phone": 1}  # transparent px between pieces (the desktop sheets get a mip chain; the phone's none)
WEBP = dict(quality=92, alpha_quality=100, method=6)

# ---- which frames ship --------------------------------------------------------------------------------------------------
# Measured neighbour differences (mean of the per-pixel largest channel difference, premultiplied, x 1000; the pop's
# own steps are 86 to 223, the hold's 16 to 29; NOTES.md has the table):
#   o13: o12 64, o14 50 | o14: o15 55 | o16: o15 48, o17 46 | o17: o18 37 | o19: o18 29, o20 16 | o20: o21 19 |
#   o22: o21 19, o23 16 | o23: c0 4 | c4: o3 8 | c5: o2 19 | c9: c8 30, c7 36
# Kept: every frame of the pop (o1 to o13), the settle and hold at about 10 to 15 fps, the close's fall and bounce.
KEEP = [("open", i) for i in range(1, 14)] + [("open", 15), ("open", 18)] + [("close", i) for i in (0, 1, 2, 3, 6, 7, 8)]
# a dropped frame -> the kept frame shown in its place
SUBSTITUTE = {
    ("open", 0): "still",
    ("open", 14): ("open", 13),
    ("open", 16): ("open", 15),
    ("open", 17): ("open", 18),
    ("open", 19): ("open", 18),
    ("open", 20): ("open", 18),
    ("open", 21): ("close", 0),
    ("open", 22): ("close", 0),
    ("open", 23): ("close", 0),
    ("close", 4): ("open", 3),
    ("close", 5): ("open", 2),
    ("close", 9): ("close", 7),
}
# the light is full (the demo: lid_lift / 0.22) from this lid lift up
FULL_LIFT = 0.22
# frames whose body is rendered at 1.000 x 1.000 (the lid table): one shared body picture, cut from the first
SHARED_BODY = [("open", 18), ("close", 0), ("close", 1), ("close", 2), ("close", 3)]
# a body pixel counts as the same as the shared body's when no channel differs by more than this (premultiplied, 0..1)
SAME_TOL = 24 / 255
MIN_PATCH = 24

# ---- the clips the game plays (30 fps slots of the delivered timeline) ---------------------------------------------------
# PEEK (a present lands): the open's squash and first lift (o1 to o4, the lid 8 road px up at o4) then the close from
# its matching pose (c3: 7.6 road px up) down onto the box with its squash and bounce. 11 slots, 367 ms.
PEEK = [("open", i) for i in range(1, 5)] + [("close", i) for i in range(3, 10)]
# OPEN (a trigger): the whole open clip, then (in the game) a hold on its last pose, then the whole close
OPEN = [("open", i) for i in range(1, 24)]
CLOSE = [("close", i) for i in range(0, 10)]
# the frames the peek needs stay loaded for the session; the rest load only for a book with a trigger
PEEK_GROUP = sorted({k for k in PEEK})


def tag(key):
    return "still" if key == "still" else f"{key[0][0]}{key[1]:02d}"


def shown(key):
    if key in KEEP:
        return key
    return SUBSTITUTE[key]


# ---- pixels -------------------------------------------------------------------------------------------------------------
def load_pm(path):
    a = np.asarray(Image.open(path).convert("RGBA")).astype(np.float64) / 255.0
    a[..., :3] *= a[..., 3:4]
    return a


def frame_path(key, over=False):
    clip, i = key
    return os.path.join(PAINTED, clip, f"{clip}_{i:02d}{'_over' if over else ''}.png")


def lid_mask(key):
    """the lid and the bow (and their outer outline, which lies on the background) at the frame's size, binary"""
    clip, i = key
    idr = np.asarray(Image.open(os.path.join(RAW, clip, f"{i:02d}_id.png")).convert("RGBA")).astype(int)
    ids = np.where(idr[..., 3] > 0, np.round(idr[..., 0] / 10).astype(int), 0)
    lid = ids >= 9  # lid_out .. tails (tools/paintover.py IDS)
    body = (ids >= 1) & (ids <= 8)
    grow = ndi.binary_dilation(lid, iterations=16) & ~body  # the silhouette line is 12.8 px wide at the 2x render
    m = (lid | grow).reshape(CANVAS[1], 2, CANVAS[0], 2).any(axis=(1, 3))
    return m


def split_back_front(key):
    """(back, front) premultiplied at 640 x 800: back = the inside alone, front = the delivered over frame"""
    base = load_pm(frame_path(key))
    over = load_pm(frame_path(key, True))
    a = over[..., 3:4]
    room = np.clip(1.0 - a, 0, 1)
    back = np.where(room > 1e-3, (base - over) / np.maximum(room, 1e-3), 0.0)
    back = np.clip(back, 0, 1)
    back[..., :3] = np.minimum(back[..., :3], back[..., 3:4])
    back[back[..., 3] < 1.5 / 255] = 0
    return back, over, base


def composite(front, back):
    return front + (1.0 - front[..., 3:4]) * back


def resize_pm(layer, size):
    """premultiplied LANCZOS resample of a whole 640 x 800 layer to the tier's canvas"""
    out = np.zeros((size[1], size[0], 4))
    for c in range(4):
        im = Image.fromarray(layer[..., c].astype(np.float32), "F").resize(size, Image.LANCZOS)
        out[..., c] = np.asarray(im)
    out = np.clip(out, 0, 1)
    out[..., :3] = np.minimum(out[..., :3], out[..., 3:4])
    out[out[..., 3] < 1.0 / 255] = 0
    return out


def to_image(pm):
    a = pm[..., 3:4]
    rgb = np.where(a > 0, pm[..., :3] / np.maximum(a, 1e-6), 0)
    return Image.fromarray((np.dstack([rgb, a]) * 255 + 0.5).clip(0, 255).astype(np.uint8), "RGBA")


def trim(pm):
    ys, xs = np.where(pm[..., 3] > 0)
    if not len(xs):
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


# ---- the light's sprites (drawn by code; the demo page's rays and four-point stars as pictures) ------------------------
def ray_sprite(h):
    """one shine ray, apex at the bottom centre: a thin wedge (the demo's 0.085 rad half angle) that fades along its
    length, warm white to gold (the demo's three stops), premultiplied"""
    w = max(8, int(round(h * math.tan(0.085) * 2)) + 4)
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float64)
    t = (h - 0.5 - ys) / h  # 0 at the apex (bottom), 1 at the far end
    half = np.maximum(t * h * math.tan(0.085), 0.35)
    cover = np.clip(half - np.abs(xs + 0.5 - w / 2) + 0.5, 0, 1)
    stops = [(0.0, (255, 236, 150), 0.75), (0.5, (255, 200, 70), 0.35), (1.0, (255, 180, 40), 0.0)]
    col = np.zeros((h, w, 3))
    alpha = np.zeros((h, w))
    for (t0, c0, a0), (t1, c1, a1) in zip(stops, stops[1:]):
        sel = (t >= t0) & (t <= t1)
        u = ((t - t0) / (t1 - t0))[sel]
        for k in range(3):
            col[..., k][sel] = (c0[k] + (c1[k] - c0[k]) * u) / 255
        alpha[sel] = a0 + (a1 - a0) * u
    a = alpha * cover
    pm = np.dstack([col * a[..., None], a])
    return pm


def glow_sprite(size):
    """a soft round blob, white, alpha 1 at the centre falling straight to 0 at the edge (the demo's bloom gradient),
    premultiplied; the game stretches it into the bloom's ellipse and tints it"""
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float64)
    d = np.hypot(xs + 0.5 - size / 2, ys + 0.5 - size / 2) / (size / 2)
    a = np.clip(1 - d, 0, 1)
    return np.dstack([a, a, a, a])


def star_sprite(r):
    """the demo's four-point star (a concave diamond, white heart, gold edge) with its soft glow, radius r px,
    premultiplied, (2 * 1.25 r) square"""
    ss = 4
    size = int(math.ceil(2.5 * r)) + 2
    n = size * ss
    c = n / 2
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float64)
    dx, dy = (xs + 0.5 - c) / ss, (ys + 0.5 - c) / ss
    d = np.hypot(dx, dy)
    # the glow: rgba(255,240,170,0.55) to rgba(255,190,60,0) over 1.25 r
    u = np.clip(d / (1.25 * r), 0, 1)
    ga = 0.55 * (1 - u)
    gcol = np.dstack([np.full_like(u, 1.0), (240 + (190 - 240) * u) / 255, (170 + (60 - 170) * u) / 255])
    # the star: a point at each of the four axes, the sides bowed in toward the centre (the demo's quadratic curve
    # through 0.12 r on the diagonals). Inside test in polar form: the boundary radius at angle phi.
    phi = np.mod(np.arctan2(dy, dx), math.pi / 2)
    s = np.abs(phi - math.pi / 4) / (math.pi / 4)  # 1 at a point, 0 on a diagonal
    rb = r * (0.12 + 0.88 * s ** 2.2)
    inside = (d <= rb).astype(np.float64)
    v = np.clip(d / r, 0, 1)
    stops = [(0.0, (255, 255, 255)), (0.35, (255, 242, 166)), (1.0, (255, 184, 31))]
    scol = np.zeros(d.shape + (3,))
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        sel = (v >= t0) & (v <= t1)
        w = ((v - t0) / (t1 - t0))[sel]
        for k in range(3):
            scol[..., k][sel] = (c0[k] + (c1[k] - c0[k]) * w) / 255
    a = inside + ga * (1 - inside)
    rgb = scol * inside[..., None] + gcol * (ga * (1 - inside))[..., None]
    pm = np.dstack([rgb, a])
    img = Image.fromarray((pm * 255).clip(0, 255).astype(np.uint8), "RGBA").resize((size, size), Image.BOX)
    return np.asarray(img).astype(np.float64) / 255  # already premultiplied values (box filter of premultiplied)


# ---- packing ------------------------------------------------------------------------------------------------------------
def pack(items, max_side, gutter):
    """skyline bottom-left packing of (name, w, h) into pages of at most max_side; returns pages [{w, h, place}]"""
    def try_width(width, todo):
        pages = []
        rest = list(todo)
        while rest:
            sky = [(0, width, 0)]  # (x, w, y)
            place = {}
            left = []
            for name, w, h in rest:
                W, H = w + gutter, h + gutter
                best = None
                for i in range(len(sky)):
                    x = sky[i][0]
                    if x + W > width:
                        break
                    y = 0
                    span = 0
                    j = i
                    while span < W and j < len(sky):
                        y = max(y, sky[j][2])
                        span = sky[j][0] + sky[j][1] - x
                        j += 1
                    if span < W or y + H > max_side:
                        continue
                    if best is None or y + H < best[1] + best[3] or (y + H == best[1] + best[3] and x < best[0]):
                        best = (x, y, W, H)
                if best is None:
                    left.append((name, w, h))
                    continue
                x, y, W, H = best
                place[name] = (x, y)
                new = []
                for sx, sw, sy in sky:
                    a0, a1 = sx, sx + sw
                    if a1 <= x or a0 >= x + W:
                        new.append((sx, sw, sy))
                    else:
                        if a0 < x:
                            new.append((a0, x - a0, sy))
                        if a1 > x + W:
                            new.append((x + W, a1 - x - W, sy))
                new.append((x, W, y + H))
                new.sort()
                merged = []
                for seg in new:
                    if merged and merged[-1][2] == seg[2] and merged[-1][0] + merged[-1][1] == seg[0]:
                        merged[-1] = (merged[-1][0], merged[-1][1] + seg[1], seg[2])
                    else:
                        merged.append(seg)
                sky = merged
            if not place:
                raise SystemExit("build_present: a piece is larger than a page")
            pw = max(place[n][0] + w for n, w, h in rest if n in place)
            ph = max(place[n][1] + h for n, w, h in rest if n in place)
            pages.append({"w": pw, "h": ph, "place": place})
            rest = left
        return pages

    orders = [
        sorted(items, key=lambda it: (-it[2], -it[1], it[0])),
        sorted(items, key=lambda it: (-it[1] * it[2], it[0])),
        sorted(items, key=lambda it: (-it[1], -it[2], it[0])),
        sorted(items, key=lambda it: (-max(it[1], it[2]), it[0])),
    ]
    best = None
    widest = max(w for _, w, _ in items)
    for order in orders:
        for width in range(widest + gutter, max_side + 1, 8):
            pages = try_width(width, order)
            area = sum(p["w"] * p["h"] for p in pages)
            key = (area, len(pages))
            if best is None or key < best[0]:
                best = (key, pages)
    return best[1]


# ---- the build ----------------------------------------------------------------------------------------------------------
def read_meta():
    s = open(os.path.join(SRC, "frames", "meta.js")).read()
    return json.loads(s[s.index("{"): s.rstrip().rstrip(";").rindex("}") + 1])


def road(x, y):
    """frame px -> road px from the anchor"""
    return round((x - ANCHOR[0]) / SRC_DENSITY, 2), round((y - ANCHOR[1]) / SRC_DENSITY, 2)


def build(evidence=None):
    meta = read_meta()
    os.makedirs(OUT, exist_ok=True)
    # every kept frame cut into pieces at the source size
    layers = {}  # piece name -> premultiplied 640 x 800 layer
    frames = {}  # frame tag -> {"back": [...], "front": [...]}
    report = {"exact": {}, "shared": {}}
    shared_body = None
    # THE INSIDE PIECE only where the light does not cover the opening: a frame shown in a slot whose lid is below
    # FULL_LIFT (the light is partial there). With the light full the game fills the opening solid (the demo's fill is
    # 0.95 to 1.0 opaque there) and edges it with a band of the inside's own colour (RIM_PAD) for the inside's few pixels
    # that lie just outside the delivered ring.
    partial = set()
    for slots in (PEEK, OPEN, CLOSE):
        for key in slots:
            if meta["clips"][key[0]][key[1]]["lid_lift"] < FULL_LIFT and shown(key) != "still":
                partial.add(shown(key))
    rim = {"px": 0, "maxOut": 0.0, "colour": np.zeros(3), "n": 0}
    inside_shows = set()
    for key in KEEP:
        back, over, base = split_back_front(key)
        t = tag(key)
        backs = []
        if back[..., 3].max() > 0:
            inside_shows.add(t)
        if back[..., 3].max() > 0 and key in partial:
            layers[f"{t}_in"] = back
            backs.append(f"{t}_in")
        elif back[..., 3].max() > 0:
            # what the solid fill has to cover: the inside's pixels outside the delivered ring, how far out, what colour
            ring = meta["clips"][key[0]][key[1]]["opening"]["ring"]
            im = Image.new("L", CANVAS, 0)
            ImageDraw.Draw(im).polygon([tuple(p) for p in ring], fill=255)
            poly = np.asarray(im) > 0
            out = (back[..., 3] > 0.02) & ~poly
            if out.any():
                dist = ndi.distance_transform_edt(~poly)
                rim["maxOut"] = max(rim["maxOut"], float(dist[out].max()))
                rim["colour"] += (back[out][:, :3] / np.maximum(back[out][:, 3:4], 1e-6)).sum(0)
                rim["n"] += int(out.sum())
        if key in SHARED_BODY:
            if shared_body is None:
                m = lid_mask(key)
                shared_body = over * (~m)[..., None]
                layers["body_hold"] = shared_body
                report["shared"]["body_from"] = t
            diff = np.abs(over - shared_body).max(-1) > SAME_TOL
            # specks of a pixel or two along an outline (the anti-aliasing of a 0.1 % body scale) are not a difference
            # anyone can see; a patch of MIN_PATCH px or more goes in the front piece
            lab, n = ndi.label(diff)
            if n:
                sizes = ndi.sum(diff, lab, index=np.arange(1, n + 1))
                diff = np.isin(lab, np.flatnonzero(sizes >= MIN_PATCH) + 1)
            m = ndi.binary_dilation(lid_mask(key) | diff, iterations=2)
            # grown only where the front is solid or the shared body has nothing (a half covered pixel laid over a body
            # pixel would count twice)
            m &= (over[..., 3] > 0.996) | (shared_body[..., 3] < 1 / 255) | diff
            front = over * m[..., None]
            layers[f"{t}_lid"] = front
            frames[t] = {"back": backs, "front": ["body_hold", f"{t}_lid"]}
            comp = composite(front, shared_body)
            err = np.abs(composite(comp, back) - base).max(-1)
            report["shared"][t] = {"maxErr255": round(float(err.max()) * 255, 1), "pxOver2": int((err > 2 / 255).sum()), "pxOver24": int((err > 24 / 255).sum()), "pxOver64": int((err > 64 / 255).sum())}
        else:
            layers[f"{t}"] = over
            frames[t] = {"back": backs, "front": [t]}
            err = np.abs(composite(over, back) - base).max(-1)
            report["exact"][t] = round(float(err.max()) * 255, 3)
    spec = {
        "source": "~/Desktop/Run Over Reindeer/scatter_present_3d_r1_2026-11-15 (Blender build round 1, approved 2026-11-15)",
        "fps": FPS,
        "sourceDensity": SRC_DENSITY,
        "anchor": {"x": ANCHOR[0], "y": ANCHOR[1]},
        "canvasRoad": {"x": road(0, 0)[0], "y": road(0, 0)[1], "width": CANVAS[0] / SRC_DENSITY, "height": CANVAS[1] / SRC_DENSITY},
        "frames": {},
        "clips": {},
        "tiers": {},
    }
    # the frames: pieces, and the delivered numbers (the opening ring in road px from the anchor, the lid)
    for key in KEEP:
        t = tag(key)
        row = meta["clips"][key[0]][key[1]]
        op = row["opening"]
        spec["frames"][t] = {
            **frames[t],
            # the box's inside shows in this frame (the lid is off the opening): the light's fill is drawn
            "inside": t in inside_shows,
            "ring": [list(road(x, y)) for x, y in op["ring"]],
            "opening": {"cx": road(op["cx"], op["cy"])[0], "cy": road(op["cx"], op["cy"])[1], "hw": round(op["hw"] / SRC_DENSITY, 2), "hh": round(op["hh"] / SRC_DENSITY, 2)},
        }
    # the clips: per 30 fps slot the delivered frame's numbers and the frame shown
    for name, slots in (("peek", PEEK), ("open", OPEN), ("close", CLOSE)):
        out = []
        for key in slots:
            row = meta["clips"][key[0]][key[1]]
            s = shown(key)
            out.append({"src": tag(key), "show": tag(s) if s != "still" else "still", "lift": row["lid_lift"], "pitch": row["pitch"], "roll": row["roll"]})
        spec["clips"][name] = out

    peek_frames = {tag(shown(k)) for k in PEEK if shown(k) != "still"}
    peek_pieces = set()
    for t in peek_frames:
        peek_pieces.update(frames[t]["back"] + frames[t]["front"])
    # the light's sprites, at each tier's density
    for tier, d in DENSITY.items():
        k = d / SRC_DENSITY
        size = (int(round(CANVAS[0] * k)), int(round(CANVAS[1] * k)))
        pieces = {}
        for name, layer in layers.items():
            small = resize_pm(layer, size)
            box = trim(small)
            if box is None:
                continue
            pieces[name] = (small[box[1]:box[3], box[0]:box[2]], box)
        # rays: the demo's longest ray is 0.62 of the frame's height (496 frame px) at full glow. A soft additive wedge:
        # built at half the tier's density (as the stoplight glow is) and drawn at twice its size
        ray_h = int(round(496 * k / 2))
        pieces["ray"] = (ray_sprite(ray_h), None)
        # stars: the demo's largest is 33 frame px across the points' radius (13 + 20)
        pieces["star"] = (star_sprite(33 * k), None)
        pieces["glow"] = (glow_sprite(64 if tier == "full" else 32), None)
        LIGHT = ("ray", "star", "glow")
        groups = {"peek": [n for n in pieces if n in peek_pieces or n in LIGHT], "open": [n for n in pieces if n not in peek_pieces and n not in LIGHT]}
        tier_spec = {"density": d, "rayDensity": d / 2, "canvas": {"w": size[0], "h": size[1]}, "sheets": [], "pieces": {}, "gpu": {}}
        for group, names in groups.items():
            items = [(n, pieces[n][0].shape[1], pieces[n][0].shape[0]) for n in names]
            pages = pack(items, SHEET_MAX[tier], GUTTER[tier])
            for p_i, page in enumerate(pages):
                sheet = np.zeros((page["h"], page["w"], 4))
                for n, (x, y) in page["place"].items():
                    pm = pieces[n][0]
                    sheet[y:y + pm.shape[0], x:x + pm.shape[1]] = pm
                    box = pieces[n][1]
                    tier_spec["pieces"][n] = {"sheet": len(tier_spec["sheets"]), "x": x, "y": y, "w": pm.shape[1], "h": pm.shape[0], **({"ox": box[0], "oy": box[1]} if box else {})}
                fname = f"present-{tier}-{group}-{p_i}.webp"
                path = os.path.join(OUT, fname)
                to_image(sheet).save(path, **WEBP)
                tier_spec["sheets"].append({"file": f"present/{fname}", "group": group, "width": page["w"], "height": page["h"], "bytes": os.path.getsize(path)})
                print(f"  {tier} {fname}: {page['w']} x {page['h']}, {len(page['place'])} pieces, {os.path.getsize(path) // 1024} KB")
        for group in ("peek", "open"):
            mb = sum(s["width"] * s["height"] * 4 for s in tier_spec["sheets"] if s["group"] == group) / 1048576
            tier_spec["gpu"][group] = round(mb, 2)
        tier_spec["gpu"]["both"] = round(tier_spec["gpu"]["peek"] + tier_spec["gpu"]["open"], 2)
        # THE STILL (closed, no motion): the rest frame o00, the same resample and anchor as the pieces, on its own small
        # sheet in the preload (game/assets.ts presentStill). The symbol atlas no longer carries an S.
        still = resize_pm(load_pm(frame_path(("open", 0))), size)
        box = trim(still)
        fname = f"present-{tier}-still.webp"
        to_image(still[box[1]:box[3], box[0]:box[2]]).save(os.path.join(OUT, fname), **WEBP)
        tier_spec["still"] = {"file": f"present/{fname}", "w": box[2] - box[0], "h": box[3] - box[1], "ox": box[0], "oy": box[1], "bytes": os.path.getsize(os.path.join(OUT, fname))}
        tier_spec["gpu"]["still"] = round((box[2] - box[0]) * (box[3] - box[1]) * 4 / 1048576, 2)
        print(f"  {tier} {fname}: {box[2] - box[0]} x {box[3] - box[1]}, {os.path.getsize(os.path.join(OUT, fname)) // 1024} KB")
        print(f"  {tier}: GPU peek {tier_spec['gpu']['peek']} MB, open {tier_spec['gpu']['open']} MB, both {tier_spec['gpu']['both']} MB (x 4/3 with a mip chain)")
        spec["tiers"][tier] = tier_spec
    if evidence:
        write_evidence(evidence, spec)
    # this tool's own sheets from an earlier run that this run did not write (a page count that went down)
    written = {os.path.basename(sh["file"]) for t in spec["tiers"].values() for sh in t["sheets"]} | {os.path.basename(t["still"]["file"]) for t in spec["tiers"].values()}
    for name in os.listdir(OUT):
        if name.startswith("present-") and name.endswith(".webp") and name not in written:
            os.remove(os.path.join(OUT, name))
    spec["kept"] = [tag(k) for k in KEEP]
    colour = rim["colour"] / max(1, rim["n"])
    spec["light"] = {
        "fullLift": FULL_LIFT,
        # the band of inside colour round the solid fill: how far the inside reaches past the ring, road px
        "rimPad": round(rim["maxOut"] / SRC_DENSITY + 0.25, 2),
        "rimColour": "#%02x%02x%02x" % tuple(int(round(c * 255)) for c in colour),
    }
    spec["report"] = report
    path = os.path.join(APP, "src", "game", "presentSpec.ts")
    with open(path, "w") as fh:
        fh.write("// AUTO-GENERATED by tools/build_present.py from the approved present frames. Do not edit: change the tool and run it\n")
        fh.write("// again. Road px are pixels of the 1536 x 1024 board background, measured from the present's anchor (its bottom centre).\n")
        fh.write(f"export const PRESENT_ART = {json.dumps(spec, indent=chr(9))} as const;\n")
    print(f"  wrote {os.path.relpath(path, APP)}")
    print("  exact pieces, worst error vs the delivered frame (of 255):", max(report["exact"].values()))
    print("  shared body:", json.dumps(report["shared"]))


def write_evidence(folder, spec):
    """the trimmed set for compare.html: every tier's sheets and still beside it (as PNG, decoded from the game's webp,
    so the page shows exactly what the game draws) and a script with the pieces, frames and clips"""
    data = {"fps": FPS, "anchor": spec["anchor"], "light": None, "frames": {}, "clips": spec["clips"], "tiers": {}}
    for t, f in spec["frames"].items():
        data["frames"][t] = {"back": f["back"], "front": f["front"], "inside": f["inside"]}
    for tier, ts in spec["tiers"].items():
        d = os.path.join(folder, "trimmed", tier)
        os.makedirs(d, exist_ok=True)
        files = []
        for sh in ts["sheets"] + [ts["still"]]:
            name = os.path.basename(sh["file"]).replace(".webp", ".png")
            Image.open(os.path.join(APP, "static", "assets", sh["file"])).save(os.path.join(d, name))
            files.append(f"trimmed/{tier}/{name}")
        data["tiers"][tier] = {"density": ts["density"], "canvas": ts["canvas"], "sheets": files[:-1], "still": {**ts["still"], "file": files[-1]}, "pieces": ts["pieces"]}
    with open(os.path.join(folder, "trimmed", "present_trim.js"), "w") as fh:
        fh.write("window.PRESENT_TRIM = " + json.dumps(data) + ";\n")


if __name__ == "__main__":
    ev = None
    if "--evidence" in sys.argv:
        ev = os.path.expanduser(sys.argv[sys.argv.index("--evidence") + 1])
    build(ev)
