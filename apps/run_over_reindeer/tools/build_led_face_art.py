"""THE FACE SCREEN'S TWO ART FIXES (the press screen's fourth screen, the reindeer's face: constants LED_SIGN.face,
game/landing/ledScreens.ts screenFace). Plain image work on the approved face (no generation of any kind):

  FURRED LIDS   the mock's half and closed lids (led_intro_face_screen_r2_2026-11-21/layers/eyes_half.png, eyes_closed.png)
                are a flat brow coloured fill inside the eye's whole black outline, so a shut eye reads as a drawn ring.
                Here the lid is fur: the brow's own fur colour (sampled above each column of the lid line), shaded as a lid
                (a soft crease under the brow, the bulge lit, a little darker toward the edge), with the brow's own light
                and dark strokes mirrored down onto it (the fine detail of the fur above, sampled from the face itself). The
                upper lid line (the black line under the brow) becomes that soft crease, kept as ink only at the eye's two
                corners where it joins the outline that stays, and the lid's edge is the one black LASH LINE: the lower
                outline for the closed lid (thickened toward the middle), its own line for the half lid. A thin lit rim sits
                just above the lash.
  NOSTRIL PUFFS the mock's puffs sit beside the nose and its first frames cover the nose's lower rim. Here the breath comes
                OUT of each nostril: the first frame small on the nostril's opening, the second swelling down and out
                inside the nose's red, then, past the rim, out and down over the muzzle, growing and breaking up as it fades.
                No frame touches the nose's rim: no pixel of a frame inside the rim's BOXES (the boxes the game and its
                probes test, one per RIM_STEP px column of the rim) grown by RIM_MARGIN px, for both nostrils, the right
                nostril's frames mirrored about the nostrils' own middle. (Until 2026-11-21 this was the rim's own pixels
                grown by 4 px: frame 1 passed here but lit 1 to 3 LEDs on the board's rim boxes. The node check
                tools/led_face_check.mjs bakes every frame onto the dot board at every face size and is the judge.) The look is the game's
                breath (tools/build_roam.py candidate_fx look A: four soft lobes, a top lit fill, the dark ink rim), drawn
                with the mock's own recipe (led_intro_face_screen_r2_2026-11-21/_build/art/puffs_build.py).

Writes full size face frames (1672 x 941, only the eyes changed) eyes_half_fur.png and eyes_closed_fur.png, the puff frames
puff_n0.png to puff_n3.png with puffs_nostril.json (each frame's top left in the face picture's px and its size), and
nose.json (the nostrils, the mirror axis, the nose's rim as boxes for the probes) into
art-src/led_intro_face_built_2026-11-21/fix_2026-11-21/layers/. tools/build_led_wilds.py packs them with the mock's
other layers (the glances and the ears) into the press screen's Wild sheets.

Run with the math env's Python (Pillow, numpy, scipy):
    nice -n 19 math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_led_face_art.py
"""
import json
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from _paths import ART_SRC  # noqa: E402  (tools/_paths.py: the app's art-src/ folder)

FACE_SRC = os.path.join(ART_SRC, "led_intro_reindeer_face_r4_2026-11-21/face_2_no_smoke.png")
# (since 2026-11-21 the fix round's folder: frame 1 moved off the rim's boxes; the first build's layers/ stay as they were)
OUT = os.environ.get("LED_FACE_LAYERS") or os.path.join(ART_SRC, "led_intro_face_built_2026-11-21/fix_2026-11-21/layers")

# ---- the eyes' geometry (the mock's _build/art/eyegeom.py, unchanged) ---------------------------------------------------
EYE_BOXES = [(500, 360, 770, 540), (900, 360, 1172, 540)]


def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def eye_geometry(im, box):
    """the eye's inside (sclera, iris, ring, pupil) below the lid line and inside the outline, as a full size mask"""
    x0, y0, x1, y1 = box
    r, g, b = [im[y0:y1, x0:x1, i] for i in range(3)]
    dark = (r + g + b) < 150
    filled = ndimage.binary_fill_holes(dark)
    lab, n = ndimage.label(filled)
    yellow = (r > 200) & (g > 120) & ~dark
    keep = np.zeros_like(filled)
    for i in range(1, n + 1):
        c = lab == i
        if (c & yellow).sum() > 200:
            keep |= c
    nd = ~dark & keep
    cl = ndimage.binary_closing(np.pad(nd, 30), structure=disk(25))[30:-30, 30:-30]
    op = ndimage.binary_fill_holes(cl) & keep
    red = (r > 180) & (g < 125) & (b < 60) & op
    lr, nr = ndimage.label(red)
    szr = ndimage.sum(np.ones_like(lr), lr, range(1, nr + 1))
    red = lr == (1 + int(np.argmax(szr)))
    ys, xs = np.nonzero(red)
    cx0, cy0 = xs.mean(), ys.min() + (ys.max() - ys.min()) * 0.3
    pts = []
    for ang in np.radians(np.arange(-15, 196, 3)):
        dx, dy = np.cos(ang), np.sin(ang)
        far = None
        for s in np.arange(5, 120, 0.5):
            x, y = int(round(cx0 + dx * s)), int(round(cy0 + dy * s))
            if 0 <= y < red.shape[0] and 0 <= x < red.shape[1] and red[y, x]:
                far = (cx0 + dx * s, cy0 + dy * s)
        if far:
            pts.append(far)
    P = np.array(pts)
    for _ in range(4):
        A = np.c_[2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))]
        sol = np.linalg.lstsq(A, (P ** 2).sum(1), rcond=None)[0]
        cx, cy = sol[0], sol[1]
        R = np.sqrt(sol[2] + cx * cx + cy * cy)
        res = np.abs(np.hypot(P[:, 0] - cx, P[:, 1] - cy) - R)
        P = P[res < max(1.5, 2 * res.std())]
    cols = [x for x in range(op.shape[1]) if op[:, x].sum() >= 3]
    T = np.array([(x, np.nonzero(op[:, x])[0].min()) for x in cols], float)
    B = np.array([(x, np.nonzero(op[:, x])[0].max()) for x in cols], float)

    def robust(P, deg=3):
        m = np.ones(len(P), bool)
        for _ in range(6):
            c = np.polyfit(P[m, 0], P[m, 1], deg)
            res = P[:, 1] - np.polyval(c, P[:, 0])
            m = np.abs(res) < 2.0
        return c

    ct, cb = robust(T), robust(B)
    yy = np.arange(op.shape[0])[:, None]
    xx = np.arange(op.shape[1])[None, :]
    between = (yy >= np.polyval(ct, xx) - 0.5) & (yy <= np.polyval(cb, xx) + 0.5)
    ys_, xs_ = np.mgrid[0:op.shape[0], 0:op.shape[1]]
    disc = np.hypot(xs_ - cx, ys_ - cy) <= R + 12
    op2 = (op | (between & keep & disc)) & (ndimage.binary_dilation(nd, structure=disk(2)) | disc)
    op2 = ndimage.binary_opening(op2, structure=disk(1))
    lo, no = ndimage.label(op2)
    so = ndimage.sum(np.ones_like(lo), lo, range(1, no + 1))
    op2 = lo == (1 + int(np.argmax(so)))
    full = np.zeros(im.shape[:2], bool)
    full[y0:y1, x0:x1] = op2
    return full


# ---- FIX 1: THE FURRED LIDS -----------------------------------------------------------------------------------------------
LID = {"half": 0.55, "closed": 1.0}  # the lid's edge: this share of the eye's height down from its top (the mock's)
INK = np.array([6, 2, 2], float)  # the face's line ink (the mock's)
# THE LID'S LOOK. Its tone down its height w (0 at the old lid line, 1 at the lash): the crease (a soft brown fold where the
# black line was, `width` a share of the line's thickness) and the shadow under the brow below it, the lit bulge (lighter
# toward the eye's middle), a little darker over the lash, and (the half lid) a thin lit rim just above the lash line
CREASE = {"dark": 0.42, "width": 0.55, "shadow": 0.22, "shadowReach": 0.3}
BULGE = {"at": 0.6, "light": 0.13, "width": 0.32}
EDGE_DARK = 0.1
RIM_LIGHT = {"light": 0.2, "px": 3.5}
# THE FUR STROKES on the lid, in the face's own style (tapered strokes along the fur's run) and colours (the brow's light
# and dark fur, sampled above each eye): (tone, from u0 to u1 along the eye from its outer corner, at w0 down the lid, its
# slope in w per u, its widest px, its strength). The right eye's are mirrored.
STROKE_LIST = [
    ("light", 0.22, 0.78, 0.52, -0.06, 6.0, 0.65),
    ("light", 0.42, 0.92, 0.7, -0.05, 4.0, 0.45),
    ("light", 0.12, 0.4, 0.78, 0.04, 3.0, 0.35),
    ("dark", 0.06, 0.46, 0.34, 0.1, 4.5, 0.55),
    ("dark", 0.58, 0.96, 0.3, 0.05, 3.5, 0.4),
    ("dark", 0.3, 0.62, 0.88, 0.0, 3.0, 0.3),
]
CORNER_INK = (0.03, 0.2)  # the old lid line stays as drawn at the eye's corners (shares of its width), fading to the crease
FEATHER = 4.0  # px: the lid's top edge fades into the brow
LASH = {"closed": 0.45, "half": 1.0}  # the lash line's thickness (closed: added up into the lid over the lower outline) as a
# share of the measured lid line, thinner to the corners


def robust_fit(x, y, deg=3, tol=2.0):
    m = np.ones(len(x), bool)
    for _ in range(6):
        c = np.polyfit(x[m], y[m], deg)
        m = np.abs(y - np.polyval(c, x)) < tol
    return np.polyval(c, x)


def furred_lids(im):
    """both eyes' half and closed lids as fur: {state: full frame RGBA uint8}"""
    H, W = im.shape[:2]
    rgb = im[..., :3].copy()
    dark = rgb.sum(2) < 150
    out = {k: im.copy() for k in LID}
    ys = np.arange(H, dtype=float)
    for box in EYE_BOXES:
        op = eye_geometry(im, box)
        soft = ndimage.gaussian_filter(op.astype(float), 0.7) * op
        halo = ndimage.binary_dilation(op, iterations=2) & ~dark
        cols = np.nonzero(op.any(0))[0]
        t_raw = np.array([np.nonzero(op[:, x])[0].min() for x in cols], float)
        b_raw = np.array([np.nonzero(op[:, x])[0].max() for x in cols], float)
        n_raw = []
        for x, tt in zip(cols, t_raw):
            y = int(tt) - 1
            k = 0
            while y > 0 and dark[y, x]:
                y -= 1
                k += 1
            n_raw.append(k)
        n_raw = np.array(n_raw, float)
        # smooth curves for the inside's top and bottom and the old lid line's top (the raw ones step column to column)
        xf = cols.astype(float)
        t = robust_fit(xf, t_raw)
        b = robust_fit(xf, b_raw)
        lt = robust_fit(xf, t_raw - n_raw, tol=3.0)
        n = np.maximum(2.0, t - lt)
        Tline = float(np.median(n))
        u = (cols - cols.min()) / max(1, cols.max() - cols.min())
        mid = np.sin(np.pi * np.clip(u, 0, 1))
        # the brow's own lit fur over each column (14 to 40 px above the line), smoothed along the eye
        furc = np.array([np.median(rgb[max(0, int(a) - 40):max(1, int(a) - 14), x], axis=0) for x, a in zip(cols, lt)])
        furc = ndimage.uniform_filter1d(ndimage.median_filter(furc, size=(31, 1), mode="nearest"), 41, axis=0, mode="nearest")
        corner = np.clip(np.minimum(u - CORNER_INK[0], 1 - CORNER_INK[0] - u) / (CORNER_INK[1] - CORNER_INK[0]), 0, 1)
        corner = corner * corner * (3 - 2 * corner)
        taper = 0.45 + 0.55 * mid ** 0.6
        # the brow's light and dark fur (14 to 60 px above the line, ink left out): the mean of its lightest and darkest tenth
        band = np.concatenate([rgb[max(0, int(a) - 60):max(1, int(a) - 14), x] for x, a in zip(cols, lt)])
        band = band[band.sum(1) > 240]
        lum = band @ np.array([0.3, 0.59, 0.11])
        tone = {"light": band[lum >= np.percentile(lum, 90)].mean(0), "dark": band[lum <= np.percentile(lum, 10)].mean(0)}
        uu = u if box[0] < 836 else 1 - u
        for state, f in LID.items():
            v = out[state]
            cov = np.zeros((H, W))
            col = np.zeros((H, W, 3))
            for i, x in enumerate(cols):
                top = lt[i]
                e = max(b[i], b_raw[i]) + 1.0 if f >= 1 else t[i] + f * (b[i] - t[i])
                span = max(1.0, e - top)
                w = np.clip((ys - top) / span, 0, 1)
                lc = (lt[i] + t[i]) / 2
                crease = CREASE["dark"] * np.exp(-(((ys - lc) / max(1.0, CREASE["width"] * n[i])) ** 2))
                s_in = np.clip((ys - lc) / max(1.0, 0.8 * n[i]), 0, 1)
                s_out = np.clip(1 - (ys - lc) / max(1.0, CREASE["shadowReach"] * span), 0, 1) ** 1.5
                shadow = CREASE["shadow"] * (s_in * s_in * (3 - 2 * s_in)) * s_out
                bulge = BULGE["light"] * (0.6 + 0.4 * mid[i]) * np.exp(-(((w - BULGE["at"]) / BULGE["width"]) ** 2))
                edge = EDGE_DARK * np.clip((w - 0.8) / 0.2, 0, 1)
                rim = 0.0
                if f < 1:
                    rim = RIM_LIGHT["light"] * np.exp(-(((ys - (e - Tline * LASH[state] * taper[i] / 2 - RIM_LIGHT["px"])) / RIM_LIGHT["px"]) ** 2))
                shade = 1 - crease - shadow + bulge - edge + rim
                c = np.clip(furc[i][None, :] * shade[:, None], 0, 255)
                for kind, u0, u1, w0, slope, wide, strength in STROKE_LIST:
                    if not (u0 <= uu[i] <= u1):
                        continue
                    q = (uu[i] - u0) / (u1 - u0)
                    half = wide / 2 * np.sin(np.pi * q) ** 0.8
                    yc = top + (w0 + slope * (uu[i] - u0)) * span
                    al = strength * np.clip(half - np.abs(ys - yc) + 0.5, 0, 1)
                    c = c * (1 - al[:, None]) + tone[kind][None, :] * al[:, None]
                cover = np.clip((ys - (top - FEATHER)) / FEATHER, 0, 1) * np.clip(e - ys + 0.5, 0, 1)
                # (toward the corners the old line stays as drawn: over its rows the lid fades out, never into the inside)
                above = ys < min(t[i], t_raw[i])
                cover = np.where(above, cover * corner[i], cover)
                th = Tline * LASH[state] * taper[i]
                if f >= 1:
                    lash = np.clip((ys - (e - th)) + 0.5, 0, 1) * (ys <= e + 1)
                else:
                    lash = np.clip(th / 2 - np.abs(ys - e) + 0.5, 0, 1)
                cov[:, x] = np.maximum(cover, lash)
                col[:, x] = c * (1 - lash[:, None]) + INK * lash[:, None]
            # (the lid covers the inside, its light edge pixels and the old line's rows over the inside's columns, and its
            # feather into the brow; never the lower outline's own dark pixels)
            reach = np.zeros((H, W), bool)
            for i, x in enumerate(cols):
                reach[int(np.floor(lt[i] - FEATHER - 1)):int(t[i]) + 1, x] = True
            m = np.maximum(np.maximum(soft, halo.astype(float)), reach.astype(float))
            c2 = cov * m
            v[..., :3] = v[..., :3] * (1 - c2[..., None]) + col * c2[..., None]
    return {k: v.clip(0, 255).round().astype(np.uint8) for k, v in out.items()}


# ---- FIX 2: THE PUFFS OUT OF THE NOSTRILS ---------------------------------------------------------------------------------
FX_INK = (22, 24, 32)
LOBES = [(0.34, 0.6, 0.38), (0.56, 0.42, 0.42), (0.72, 0.6, 0.34), (0.5, 0.7, 0.32)]
# the left nostril's frames: centre (face_2_no_smoke.png px), diameter, the lobes' spread and size (the last breaks up).
# Frame 0 sits on the nostril's opening, frame 1 swells down and out inside the nose's red, frames 2 and 3 are past the
# rim, out and down over the muzzle (never below the picture: the line of text is under it).
PUFF_FRAMES = [
    {"c": (751, 822), "d": 40, "spread": 1.0, "size": 1.0},
    {"c": (746, 838), "d": 50, "spread": 1.0, "size": 1.0},
    {"c": (650, 876), "d": 96, "spread": 1.05, "size": 0.97},
    {"c": (574, 868), "d": 132, "spread": 1.2, "size": 0.84},
]
RIM_STEP = 4  # px: the rim's boxes, one per run of rim rows in each RIM_STEP px wide column (the game's and probes' rim)
RIM_MARGIN = 4  # px every frame keeps off the rim's boxes


def puff(d, spread, shrink, ink_px):
    """the breath recipe (the mock's puffs_build.py puff): a padded square RGBA picture"""
    S = 4
    pad = int(ink_px * 1.6) + 2
    n = int(round(d * spread)) + 2 * pad
    N = n * S
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32) / N
    out = np.zeros((N, N), np.float32)
    k = d * spread / n
    for cx, cy, r in LOBES:
        cx2 = 0.5 + (cx - 0.5) * k
        cy2 = 0.5 + (cy - 0.5) * k
        rr = r * (d / n) * shrink
        dist = np.hypot(xx - cx2, yy - cy2) / max(rr, 1e-6)
        out = np.maximum(out, np.clip(1 - dist ** 2, 0, 1) ** 1.5)
    shape = np.clip((out - 0.3) / 0.12, 0, 1)
    under = np.clip((yy - 0.42) * 2.4 + (xx - 0.5) * 0.6, 0, 1) * 0.8
    topc = np.array((240, 245, 252), np.float32) / 255
    undc = np.array((196, 210, 230), np.float32) / 255
    rgb = topc[None, None] * (1 - under[..., None]) + undc[None, None] * under[..., None]
    m = Image.fromarray((shape * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(int(ink_px * S) | 1))
    outer = np.asarray(m).astype(np.float32) / 255
    inkm = np.clip(outer - shape, 0, 1)
    rgb = rgb * (1 - inkm[..., None]) + (np.array(FX_INK, np.float32) / 255)[None, None] * inkm[..., None]
    a = np.maximum(shape, outer)
    img = Image.fromarray((np.dstack([np.clip(rgb, 0, 1), a]) * 255).round().astype(np.uint8), "RGBA")
    return img.resize((n, n), Image.LANCZOS), n


def nose_geometry(im):
    """the nose's red ball, its rim (the dark outline round it), the two nostrils and their middle"""
    r, g, b, a = [im[..., i] for i in range(4)]
    red = (r > 150) & (g < 90) & (b < 90) & (a > 200)
    lab, _ = ndimage.label(red)
    ball = ndimage.binary_fill_holes(lab == lab[790, 800])
    dark = (r + g + b) < 200
    # the rim: the dark ring just outside the red, and the red's own shaded edge (3 px in)
    ring = ndimage.binary_dilation(ball, iterations=25) & ~ball & dark
    ring = ndimage.binary_closing(ring, iterations=2)
    rim = ring | (ball & ~ndimage.binary_erosion(ball, iterations=3))
    nos = ((r + g + b) < 120) & ndimage.binary_erosion(ball, iterations=6)
    nos[:780] = False
    nos[860:] = False
    lab2, _ = ndimage.label(nos)
    nostrils = []
    for j, sl in enumerate(ndimage.find_objects(lab2), 1):
        m = lab2 == j
        if m.sum() > 600:
            yy, xx = np.nonzero(m)
            nostrils.append({"c": [round(float(xx.mean()), 1), round(float(yy.mean()), 1)], "box": [int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1]})
    nostrils.sort(key=lambda q: q["c"][0])
    assert len(nostrils) == 2, nostrils
    axis = (nostrils[0]["c"][0] + nostrils[1]["c"][0]) / 2
    return ball, rim, nostrils, axis


def rim_boxes(rim, step=12):
    """the rim as boxes (x0, y0, x1, y1), one per run of rim rows in each `step` px wide strip"""
    ys, xs = np.nonzero(rim)
    out = []
    for x0 in range(int(xs.min()), int(xs.max()) + 1, step):
        sl = rim[:, x0:x0 + step].any(1)
        rows = np.nonzero(sl)[0]
        if not len(rows):
            continue
        runs = np.split(rows, np.where(np.diff(rows) > 1)[0] + 1)
        for run in runs:
            cols = np.nonzero(rim[run[0]:run[-1] + 1, x0:x0 + step].any(0))[0]
            out.append([x0 + int(cols.min()), int(run[0]), x0 + int(cols.max()) + 1, int(run[-1]) + 1])
    return out


def nostril_puffs(im):
    H, W = im.shape[:2]
    ball, rim, nostrils, axis = nose_geometry(im)
    boxes = rim_boxes(rim, RIM_STEP)
    keep_off = np.zeros_like(rim)
    for b in boxes:
        keep_off[max(0, b[1] - RIM_MARGIN):b[3] + RIM_MARGIN, max(0, b[0] - RIM_MARGIN):b[2] + RIM_MARGIN] = True

    def rim_hits(a, x, y, mask=keep_off):
        """the frame's pixels (alpha over 0) on `mask` (the rim's boxes grown by RIM_MARGIN), both nostrils"""
        hits = 0
        for side in "lr":
            x0 = x if side == "l" else int(round(2 * axis - x - a.shape[1]))
            aa = a if side == "l" else a[:, ::-1]
            ys, xs = np.nonzero(aa)
            ys = ys + y
            xs = xs + x0
            ok = (xs >= 0) & (xs < W) & (ys >= 0) & (ys < H)
            hits += int(mask[ys[ok], xs[ok]].sum())
        return hits

    def rect_hits(x, y, w, h):
        """the frame's box against the rim's boxes (the probes' test), both nostrils"""
        n = 0
        for x0 in (x, int(round(2 * axis - x - w))):
            n += sum(1 for b in boxes if x0 < b[2] and b[0] < x0 + w and y < b[3] and b[1] < y + h)
        return n

    frames = []
    pics = []
    report = []
    ncx, ncy = nostrils[0]["c"]
    for i, F in enumerate(PUFF_FRAMES):
        ink = float(np.clip(0.11 * F["d"], 6, 10))
        img, n = puff(F["d"], F["spread"], F["size"], ink)
        arr = np.array(img)
        al = arr[..., 3]
        arr[..., 3] = np.where(al < 8, 0, np.where(al >= 248, 255, al)).astype(np.uint8)
        img = Image.fromarray(arr)
        bb = img.getbbox()
        img = img.crop(bb)
        a = np.array(img)[..., 3] > 0
        cx, cy = F["c"]
        inside = bool(ball[int(cy), int(cx)])
        # (nudged off the rim: a frame on the nose back toward its nostril, a frame past the rim on out along its way)
        dx, dy = cx - ncx, cy - ncy
        dn = max(1e-6, (dx * dx + dy * dy) ** 0.5)
        dx, dy = dx / dn, dy / dn
        sgn = -1 if inside else 1
        for step in range(0, 80):
            x = int(round(cx + sgn * dx * step - n / 2 + bb[0]))
            y = int(round(cy + sgn * dy * step - n / 2 + bb[1]))
            y = min(y, H - img.height)
            if not rim_hits(a, x, y):
                break
        assert y + img.height <= H, f"puff {i} below the picture"
        pics.append(img)
        frames.append({"frame": f"puff_n{i}", "x": x, "y": y, "w": img.width, "h": img.height, "ink": round(ink, 1)})
        report.append({"frame": f"puff_n{i}", "nudgedPx": step, "rimPx": rim_hits(a, x, y), "rimOwnPx": rim_hits(a, x, y, rim), "rimBoxesHit": rect_hits(x, y, img.width, img.height), "onTheNose": inside})
    return frames, pics, {"nostrils": nostrils, "axis": round(axis, 2), "rimStep": RIM_STEP, "rimMargin": RIM_MARGIN, "rimBoxes": boxes, "check": report}


def main():
    os.makedirs(OUT, exist_ok=True)
    im = np.array(Image.open(FACE_SRC).convert("RGBA")).astype(np.float64)
    lids = furred_lids(im)
    for state, v in lids.items():
        Image.fromarray(v).save(os.path.join(OUT, f"eyes_{state}_fur.png"))
        d = np.abs(v.astype(int) - im.round().astype(int)).max(2) > 0
        ys, xs = np.nonzero(d)
        print(state, "changed box", int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    frames, pics, nose = nostril_puffs(im)
    for f, img in zip(frames, pics):
        img.save(os.path.join(OUT, f["frame"] + ".png"))
    json.dump(frames, open(os.path.join(OUT, "puffs_nostril.json"), "w"), indent=1)
    json.dump(nose, open(os.path.join(OUT, "nose.json"), "w"), indent=1)
    print(json.dumps(frames))
    print("nose", nose["nostrils"], "axis", nose["axis"], "check", nose["check"])
    bad = [c for c in nose["check"] if c["rimPx"]]
    if bad:
        raise SystemExit(f"puffs on the nose rim: {bad}")


if __name__ == "__main__":
    main()
