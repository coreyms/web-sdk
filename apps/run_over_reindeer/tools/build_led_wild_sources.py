"""THE LED WILD PICTURES' SOURCES, WHOLE (Corey 2026-11-21, on staging: "not cut off Santa's Elbow? same on the wild, if
zooming in I can see there is some cropping on the bottom and right sides of it on the LED screens").

tools/build_led_wilds.py packs the sleigh screen's Santa column and the car screen's Grandma Wild from the game's own render
(Desktop/Run Over Reindeer/led_intro_wilds_built_2026-11-20: tools/capture.cjs, tools/prep_sources.py). Those sources were
cut to the frame's OUTER EDGE (the garland's parts().outer), but the game draws past it: the tinsel's lumpy ink outline 4 road
px out (garland.ts Side.lay: -B.pad), the corner baubles over the corners (out a few road px at the sides and the foot,
their caps over the top), and Santa's idle elbow over his right band and on past the column (roadFeatures.ts placeBody,
`rightFree`: Corey 2026-11-16 "let them overlap on the right borders"). So the LED board cut the baubles and the elbow
with a straight edge.

This rebuilds each source by plain image work, no new art and no image generation, from:
  - the same capture with its 14 CSS px pad (raw/real2/src1920x1080_m<moment>_<column|cell>_bare.png, 3 device px per
    CSS px): the picture inside the outer edge is the old source pixel for pixel; outside it the capture's own pixels
    where the frame's pieces cover the road
  - the frame atlas (static/assets/wild/garland-full.webp, game/garlandSpec.ts), laid out as garland.ts lays it out for
    that box: only its COVERAGE (alpha) is used, to tell the frame's pixels from the road's outside the outer edge
    (each bauble's sway angle found by matching it against the capture)
  - Santa's idle clip (static/assets/columns/santa-idle-d215-*.webp, game/columnClipSpec.ts), the frame that matches the
    capture (found by search, then placed to half a pixel): his pixels past the outer edge (the elbow), drawn over the
    right band as the game draws him
  - for the grow (ledScreens.ts wildGrow: the column grows from the struck cell before he stands clear, as the game's
    entrance cuts him at the frame): `santa_band`, the right band and its outer fuzz where his elbow covers them, made
    from the left band (over him in the game, so clean in the capture) mirrored left to right, drawn over the picture
    after the picture is cleared from `bandClear` (the band's outer fuzz) rightward over its rows

Each picture keeps a transparent margin round its drawn pixels (PAD_SHARE of its outer box's width: wide enough that the
LED board's bake of the smallest board leaves its edge LEDs dark, tools/led_wild_cut_check.mjs). Writes, beside the
picture files, src.json: each picture's outer edge inside it (px), the band strip's place, the moments used.

    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_led_wild_sources.py
then tools/build_led_wilds.py.
"""
import json
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
CAP = os.path.expanduser("~/Desktop/Run Over Reindeer/led_intro_wilds_built_2026-11-20")
OUT = os.environ.get("LED_WILD_SRC") or os.path.expanduser("~/Desktop/Run Over Reindeer/led_intro_lines_crop_2026-11-21/src")
SIZE = "src1920x1080"
PAD_CSS = 14  # capture.cjs clipOf: CSS px round each clip
PAD_SHARE = 0.03  # the transparent margin round the drawn pixels, of the outer box's width


def spec(path):
    s = open(os.path.join(APP, "src", "game", path)).read()
    return json.loads(s[s.index("{"): s.rindex("}") + 1])


GARLAND = spec("garlandSpec.ts")
CLIPS = spec("columnClipSpec.ts")
B = GARLAND["band"]
BAUBLE = GARLAND["bauble"]
# COPY OF game/constants.ts WILD_FRAME (band, bauble) and RED_BOX.edge
BAND = {"col": 26, "cell": 20}
BAUBLE_SC = {"col": 0.9, "cell": 0.78, "inset": 4}
LOOK = {"santa": ("red", "gold", "col"), "grandma": ("green", "gold", "cell")}


# ---- the frame's coverage, laid out as garland.ts lays it --------------------------------------------------------------
def sheet():
    t = GARLAND["sheets"]["full"]
    return Image.open(os.path.join(APP, "static", "assets", t["file"])).convert("RGBA"), t["frames"]


def place(canvas, img, ax, ay, px, py, rot, sx, sy):
    """img (RGBA, its px) drawn on canvas (RGBA float array, premultiplied, raw px): its point (ax, ay) at (px, py), turned
    `rot`, scaled sx, sy raw px per img px; alpha over"""
    H, W = canvas.shape[:2]
    c, s = math.cos(rot), math.sin(rot)
    # out (X, Y) -> in (u, v): u = ax + ( c (X - px) + s (Y - py)) / sx, v = ay + (-s (X - px) + c (Y - py)) / sy
    data = (c / sx, s / sx, ax - (c * px + s * py) / sx, -s / sy, c / sy, ay - (-s * px + c * py) / sy)
    a = np.asarray(img).astype(np.float32) / 255.0
    pm = Image.fromarray((np.dstack([a[..., :3] * a[..., 3:], a[..., 3:]]) * 255).round().astype(np.uint8), "RGBA")
    t = np.asarray(pm.transform((W, H), Image.AFFINE, data, resample=Image.BICUBIC)).astype(np.float32) / 255.0
    canvas *= 1 - t[..., 3:]
    canvas += t


def render_frame(shape, O, S, ox, oy, place_kind, tinsel, bauble, rots):
    """the frame's layers on canvases of `shape` (raw px): under (the right band) and over (the left band, the rails, the
    corners, the baubles), premultiplied RGBA floats"""
    img, F = sheet()
    crop = lambda r: img.crop((r[0], r[1], r[0] + r[2], r[1] + r[3]))
    x, y, w, h = O
    T = min(BAND[place_kind], w / 2, h / 2)
    s = T / B["T"]
    R = lambda rx, ry: (ox + (rx - x) * S, oy + (ry - y) * S)
    under = np.zeros(shape + (4,), np.float32)
    over = np.zeros(shape + (4,), np.float32)
    # the sides: one strip of tiles each, from its corner, its outer edge pad*s outside the box
    tr = F[f"tile_{tinsel}"]
    N = tr[2]
    L = B["L"] * s
    tile = img.crop((tr[0], tr[1], tr[0] + N, tr[1] + tr[3]))
    sides = [((x + T, y), 0.0, w - 2 * T), ((x + w, y + T), math.pi / 2, h - 2 * T), ((x + w - T, y + h), math.pi, w - 2 * T), ((x, y + h - T), 3 * math.pi / 2, h - 2 * T)]
    for i, ((axr, ayr), rot, run) in enumerate(sides):
        if run <= 0:
            continue
        n = int(math.ceil(run / L - 1e-6))
        strip = Image.new("RGBA", (N * n, tr[3]))
        for j in range(n):
            strip.paste(tile, (j * N, 0))
        strip = strip.crop((0, 0, max(1, int(round(run / L * N))), tr[3]))
        px, py = R(axr, ayr)
        k = L / N * S  # raw px per sheet px along; the height: roadH * s over the tile's px
        kv = tr[5] * s / tr[3] * S
        # (its top row is pad*s outside the box: local y from -pad*s)
        dst = under if (place_kind == "col" and i == 1) else over
        place(dst, strip, 0, B["pad"] * s / (tr[5] * s) * tr[3], px, py, rot, k, kv)
    # the corners: the outer corner at the box's corner, its picture pad*s in from its own top left
    cr = F[f"corner_{tinsel}"]
    cim = crop(cr)
    at = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    for i in range(4):
        px, py = R(*at[i])
        place(over, cim, B["pad"] / cr[4] * cr[2], B["pad"] / cr[5] * cr[3], px, py, i * math.pi / 2, s * cr[4] / cr[2] * S, s * cr[5] / cr[3] * S)
    # the baubles: hung from their cap's loop, set in from the corner
    br = F[f"bauble_{bauble}"]
    bim = crop(br)
    sc = BAUBLE_SC[place_kind] * (T / BAND[place_kind])
    inn = T / 2 + BAUBLE_SC["inset"] * sc
    hook = (BAUBLE["ballY"] - BAUBLE["hookY"] - 5) * sc
    for i in range(4):
        cx = x + w - inn if i in (1, 2) else x + inn
        cy = y + h - inn if i >= 2 else y + inn
        px, py = R(cx, cy - hook)
        k = sc * br[4] / br[2] * S
        place(over, bim, BAUBLE["ballX"] / br[4] * br[2], BAUBLE["hookY"] / br[5] * br[3], px, py, rots[i], k, k)
    return under, over


def bauble_rots(raw, O, S, ox, oy, place_kind, tinsel, bauble):
    """each bauble's sway (radians) at the capture's moment: the angle whose render matches the capture best (WILD_FRAME
    idle sway 0.05, searched to 0.08)"""
    img, F = sheet()
    br = F[f"bauble_{bauble}"]
    bim = img.crop((br[0], br[1], br[0] + br[2], br[1] + br[3]))
    x, y, w, h = O
    T = min(BAND[place_kind], w / 2, h / 2)
    sc = BAUBLE_SC[place_kind] * (T / BAND[place_kind])
    inn = T / 2 + BAUBLE_SC["inset"] * sc
    hook = (BAUBLE["ballY"] - BAUBLE["hookY"] - 5) * sc
    out = []
    for i in range(4):
        cx = x + w - inn if i in (1, 2) else x + inn
        cy = y + h - inn if i >= 2 else y + inn
        px, py = ox + (cx - x) * S, oy + (cy - hook - y) * S
        k = sc * br[4] / br[2] * S
        best = None
        for rot in np.linspace(-0.08, 0.08, 33):
            c = np.zeros(raw.shape[:2] + (4,), np.float32)
            place(c, bim, BAUBLE["ballX"] / br[4] * br[2], BAUBLE["hookY"] / br[5] * br[3], px, py, float(rot), k, k)
            m = c[..., 3] > 0.98
            d = float(np.abs(c[..., :3][m] / c[..., 3:][m] - raw[m] / 255.0).mean())
            if best is None or d < best[0]:
                best = (d, float(rot))
        out.append(best)
    return out


# ---- Santa's idle frame -----------------------------------------------------------------------------------------------
def idle_frame(i):
    t = CLIPS["clips"]["santa"]["idle"]["tiers"]["d215"]
    fpp = t["sheets"][0]["frames"]
    sh = Image.open(os.path.join(APP, "static", "assets", t["sheets"][i // fpp]["file"])).convert("RGBA")
    j = i % fpp
    col, row = j % t["columns"], j // t["columns"]
    x0 = col * (t["frameWidth"] + t["gap"])
    y0 = row * (t["frameHeight"] + t["gap"])
    return sh.crop((x0, y0, x0 + t["frameWidth"], y0 + t["frameHeight"]))


def santa_layer(raw, shape, S, ox, oy, inside):
    """Santa's idle frame matching the capture (by search), drawn where the game draws it: raw px, premultiplied RGBA"""
    clip = CLIPS["clips"]["santa"]["idle"]
    # (the outer box is the column's inside (RED_BOX.inset 4) less the frame's dark edge (RED_BOX.edge 3): 1 road px in
    # from the column; the clip's box from the column's left and top: clip.x, clip.y)
    x0 = ox + (clip["x"] - 1) * S
    y0 = oy + (clip["y"] - 1) * S
    W = clip["width"] * S
    H = clip["height"] * S
    fx0, fy0, fx1, fy1 = inside
    best = None
    for i in range(clip["frames"]):
        f = idle_frame(i)
        for dx in (0, 0.5, 1):
            c = np.zeros(shape + (4,), np.float32)
            place(c, f, 0, 0, x0 + dx, y0, 0, W / f.width, H / f.height)
            sub = c[fy0:fy1, fx0:fx1]
            m = sub[..., 3] > 0.98
            d = float(np.abs(sub[..., :3][m] / sub[..., 3:][m] - raw[fy0:fy1, fx0:fx1][m] / 255.0).mean() * 255)
            if best is None or d < best[0]:
                best = (d, i, dx, c)
    return best


# ---- one picture --------------------------------------------------------------------------------------------------------
def build(kind, moment, rects, dpr):
    tinsel, bauble, place_kind = LOOK[kind]
    n = "column" if kind == "santa" else "cell"
    r = rects[n]
    S = r["cssPerRoad"] * dpr
    raw = np.asarray(Image.open(os.path.join(CAP, "raw", "real2", f"{SIZE}_m{moment}_{n}_bare.png")).convert("RGB")).astype(np.float32)
    # the outer box in the capture (prep_sources.py: the clip's corner PAD_CSS before it, clamped at 0)
    ox = (r["x"] - max(0, r["x"] - PAD_CSS)) * dpr
    oy = (r["y"] - max(0, r["y"] - PAD_CSS)) * dpr
    ow, oh = r["w"] * dpr, r["h"] * dpr
    box = (round(ox), round(oy), round(ox + ow), round(oy + oh))  # the old source's crop, exactly
    Ow, Oh = r["w"] / r["cssPerRoad"], r["h"] / r["cssPerRoad"]
    O = (0.0, 0.0, Ow, Oh)
    # a canvas with room round the capture for what passes its pad (the elbow)
    G = 160
    shape = (raw.shape[0] + 2 * G, raw.shape[1] + 2 * G)
    big = np.zeros(shape + (3,), np.float32)
    big[G:G + raw.shape[0], G:G + raw.shape[1]] = raw
    have = np.zeros(shape, bool)
    have[G:G + raw.shape[0], G:G + raw.shape[1]] = True
    bx0, by0, bx1, by1 = box[0] + G, box[1] + G, box[2] + G, box[3] + G
    rots = bauble_rots(raw, O, S, ox, oy, place_kind, tinsel, bauble)
    under, over = render_frame(shape, O, S, ox + G, oy + G, place_kind, tinsel, bauble, [q[1] for q in rots])
    report = {"moment": moment, "S": S, "outerRaw": [ox, oy, ow, oh], "bauble": [{"rot": round(q[1], 4), "diff": round(q[0] * 255, 2)} for q in rots]}
    # the frame's own pixels: the capture's color where the render covers them (outside the box)
    fa = 1 - (1 - under[..., 3]) * (1 - over[..., 3])
    # how well the render sits on the capture: its opaque frame pixels against the capture (inside its pad)
    rgb = lambda c: c[..., :3] / np.maximum(c[..., 3:], 1e-6)
    m = (over[..., 3] > 0.98) & have
    report["frameDiff"] = round(float(np.abs(rgb(over)[m] * 255 - big[m]).mean()), 2)
    inside = np.zeros(shape, bool)
    inside[by0:by1, bx0:bx1] = True
    col = np.zeros(shape + (3,), np.float32)
    alpha = np.zeros(shape, np.float32)
    col[inside] = big[inside]
    alpha[inside] = 1
    out = ~inside & have
    # (outside: the frame's coverage, the capture's colors; the road's pixels left out)
    alpha[out] = fa[out]
    col[out] = big[out]
    strip = None
    if kind == "santa":
        d, idx, dx, sl = santa_layer(big, shape, S, ox + G, oy + G, (bx0 + int(40 * S), by0 + int(40 * S), bx1 - int(40 * S), by1 - int(40 * S)))
        report["idle"] = {"frame": idx, "dx": dx, "diff": round(d, 2)}
        santa_all = sl[..., 3]
        # his pixels past the outer edge, on the right only (the game cuts him at the left, top and bottom), over the
        # right band and its fuzz, under the rails and baubles
        sa = sl[..., 3].copy()
        sa[:, :bx1] = 0
        sa[:by0] = 0
        sa[by1:] = 0
        under_a = under[..., 3]
        base_a = np.where(inside, 1.0, alpha)
        base_c = col
        # the right band (its capture colors where the capture has them) under him, then him, then the rest of the frame
        ov = over[..., 3]
        # compose outside the box: [right band] -> Santa -> [over]; the capture's colors for the frame's layers
        a1 = under_a
        c1 = big * a1[..., None]
        sc_ = sl[..., :3] * 255 * (sa / np.maximum(sl[..., 3], 1e-6))[..., None]
        c2 = sc_ + c1 * (1 - sa)[..., None]
        a2 = sa + a1 * (1 - sa)
        c3 = big * ov[..., None] + c2 * (1 - ov)[..., None]
        a3 = ov + a2 * (1 - ov)
        o2 = ~inside
        alpha[o2] = a3[o2]
        col[o2] = np.where(a3[o2][..., None] > 1e-6, c3[o2] / np.maximum(a3[o2], 1e-6)[..., None], 0)
        # where the capture has no pixels (past its pad) only Santa can be drawn
        nohave = ~have
        alpha[nohave] = sa[nohave]
        col[nohave] = np.where(sa[nohave][..., None] > 1e-6, sl[..., :3][nohave] / np.maximum(sl[..., 3][nohave], 1e-6)[..., None] * 255, 0)
        # the seam: his pixels just past the box against the capture's just inside (mean difference, 0 to 255)
        rows = np.nonzero(sa[:, bx1 + 1] > 0.98)[0]
        if len(rows):
            report["seam"] = round(float(np.abs(rgb(sl)[rows, bx1 + 1] * 255 - big[rows, bx1 - 1]).mean()), 2)
        # THE BAND STRIP (the grow): rows where he covers the right band or passes the box; the left band and its fuzz
        # mirrored onto the right side (outer edge onto outer edge)
        sm = sl[..., 3] > 0.05
        band_px = int(math.ceil((BAND["col"] + B["pad"]) * S)) + 1
        cover = sm[by0:by1, bx1 - band_px:bx1].any(1) | (sa[by0:by1] > 0.05).any(1)
        ys = np.nonzero(cover)[0]
        if len(ys):
            e0, e1 = int(ys.min()) + by0 - 4, int(ys.max()) + by0 + 5
            margin = bx0 - int(math.floor(bx0 - 12 * S))
            lx0, lx1 = bx0 - margin, bx0 + band_px
            # (the left band's own coverage: the frame's 'over' layer there is the left band alone; its colors the capture's)
            left_c = big[e0:e1, lx0:lx1][:, ::-1]
            left_a = over[e0:e1, lx0:lx1, 3][:, ::-1]
            strip = {"y0": e0, "y1": e1, "x0": bx1 - band_px, "x1": bx1 + margin, "c": left_c, "a": left_a}
    # THE OUTER RING INSIDE THE BOX: the backdrop stands RED_BOX.edge (3 road px) in from the outer edge, so the box's own
    # corners outside the garland's rounded corners showed the road (a lane marking's tip in the old sources): there the
    # frame's coverage (and his, on the column) decides
    e = int(math.ceil(3 * S))
    core = np.zeros(shape, bool)
    core[by0 + e:by1 - e, bx0 + e:bx1 - e] = True
    # (and the four corner squares, the band's thickness: the backdrop's own corners do not reach them; the garland's
    # corner covers them where the game covers them)
    q = int(math.ceil(min(BAND[place_kind], Ow / 2, Oh / 2) * S))
    for cy0, cx0 in ((by0, bx0), (by0, bx1 - q), (by1 - q, bx0), (by1 - q, bx1 - q)):
        core[cy0:cy0 + q, cx0:cx0 + q] = False
    ring = inside & ~core
    cov = fa if kind != "santa" else 1 - (1 - fa) * (1 - santa_all)
    alpha[ring] = np.clip(cov[ring], 0, 1)
    # the picture's drawn extent and its margin
    ys, xs = np.nonzero(alpha > 0.02)
    pad = int(math.ceil(PAD_SHARE * (bx1 - bx0)))
    X0, Y0 = min(int(xs.min()), bx0) - pad, min(int(ys.min()), by0) - pad
    X1, Y1 = max(int(xs.max()) + 1, bx1) + pad, max(int(ys.max()) + 1, by1) + pad
    X0, Y0 = max(0, X0), max(0, Y0)
    X1, Y1 = min(shape[1], X1), min(shape[0], Y1)
    rgba = np.dstack([np.clip(col, 0, 255), np.clip(alpha * 255, 0, 255)]).round().astype(np.uint8)
    pic = Image.fromarray(rgba[Y0:Y1, X0:X1], "RGBA")
    meta = {
        "outer": [bx0 - X0, by0 - Y0, bx1 - bx0, by1 - by0],
        "size": [X1 - X0, Y1 - Y0],
        "ink": [int(xs.min()) - X0, int(ys.min()) - Y0, int(xs.max()) + 1 - X0, int(ys.max()) + 1 - Y0],
        "report": report,
    }
    band = None
    if strip:
        # (the strip REPLACES a rectangle of the picture: from the band's inner edge to the picture's right edge, over the
        # rows he covers it; what lies right of the mirrored fuzz is transparent, so his elbow is not drawn while it shows)
        a = np.clip(strip["a"] * 255, 0, 255)
        sw = X1 - strip["x0"]
        rgba = np.zeros((strip["y1"] - strip["y0"], sw, 4), np.uint8)
        part = np.dstack([np.clip(strip["c"], 0, 255), a]).round().astype(np.uint8)
        rgba[:, : part.shape[1]] = part[:, :sw]
        band = Image.fromarray(rgba, "RGBA")
        meta["band"] = [strip["x0"] - X0, strip["y0"] - Y0, sw, strip["y1"] - strip["y0"]]
        # (the grow's picture clears the picture from the tinsel's outer fuzz (pad road px in from the outer edge) to its
        # right edge over these rows, then draws the strip OVER it: inside that line the band's core covers him and his
        # pixels show through the inner fuzz's gaps as the left band lets them; nothing of the elbow is left past it)
        meta["bandClear"] = int(math.floor(bx1 - B["pad"] * S)) - X0
    # the inside is the old source exactly
    old = np.asarray(Image.open(os.path.join(CAP, "src", f"{kind}.png")).convert("RGB"))
    o = meta["outer"]
    same = np.array_equal(np.asarray(pic)[o[1]:o[1] + o[3], o[0]:o[0] + o[2], :3], old)
    meta["report"]["insideIsOldSource"] = bool(same)
    return pic, band, meta


def main():
    os.makedirs(OUT, exist_ok=True)
    L = json.load(open(os.path.join(CAP, "raw", "real", "log.json")))[SIZE]
    old = json.load(open(os.path.join(CAP, "src", "src.json")))
    meta = {"note": old.get("note", "") + "; whole: tools/build_led_wild_sources.py (outer edge, frame coverage, Santa's idle elbow)", "pictures": {}}
    for kind in ("santa", "grandma"):
        pic, band, m = build(kind, old[kind]["moment"], L["rects"], L["dpr"])
        pic.save(os.path.join(OUT, f"{kind}.png"))
        if band is not None:
            band.save(os.path.join(OUT, f"{kind}_band.png"))
        meta["pictures"][kind] = m
        print(kind, pic.size, json.dumps({k: v for k, v in m.items()}))
    json.dump(meta, open(os.path.join(OUT, "src.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
