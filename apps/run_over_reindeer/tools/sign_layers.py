"""THE SIGN RIG'S LAYERS (Corey 2026-11-19, the sign wins mock sign_wins_r1_2026-11-19, his settings "cand 3, honeycomb
field, glint from the face, the sign bends at the road, glint on the swing back, today's pulse on, hinged landing, idle
both"): the five flattened road sign pictures cut into the layers the game's sign rig moves (game/road/signRig.ts).
A port of the mock's tools/separate.py, unchanged in method and numbers; tools/build_assets.py packs its output into the
symbol atlases (both tiers) and writes src/game/signRigSpec.ts. No AI, plain array work.

Reads   ~/Desktop/Run Over Reindeer/references/mockups/<sign>.png   (the approved art the atlas's flattened frames are
        built from; those frames stay: through traffic, shadows, the rules page and the probes still use them)

Method
  1. Every element in this art is outlined in black, so the light (non-outline) pixels fall into connected pieces.
     Each piece is given a class by a seed point (the decorations, snow cap, bolts, post) or by rule (letters are the
     big black pieces inside the face; everything else is the sign body).
  2. Each outline pixel goes to the nearest classed piece within OUTLINE px, so every element keeps its own outline.
  3. Layers are peeled top down (decorations, snow cap, bolts, letter, post). A peeled element's pixels are refilled
     from the nearest pixel that is not under it (class and color both), so the layer under it is complete where it
     was hidden. Its anti-aliased fringe is unmixed against that refill (black outline over the refill color), so a
     moved piece leaves no dark halo behind.
  4. The post is extended upward under the plate (its own column profile repeated), so a plate rocking on it shows
     post, not air.
  5. A recomposite of every layer is compared with the original.
The game draws the PLATE as one picture: the body, the letter and the bolts (the letter pop is off in Corey's settings),
with the honeycomb's reflectors at rest baked in on the four colored signs (the mock's "seen at rest" 0.1, its lens
tinted 14% darker than the face). The 10's reflectors at rest are sprites (its look is one of three options:
constants SIGN_WIN.ten).
"""
import json
import math
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

MOCK = os.path.expanduser("~/Desktop/Run Over Reindeer/references/mockups")

# the sizes and sources are tools/build_assets.py's own (configure() takes them from it; these are the same values, for
# a run of this file on its own)
SIGN_A_HEIGHT = 160
SIGN_AREA = {"L1": 1.00, "L2": 0.95, "L3": 0.90, "L4": 0.85, "L5": 0.80}
SRC = {"L1": "sign_A_v2.png", "L2": "sign_K_v2.png", "L3": "sign_Q_v2.png", "L4": "sign_J_v2.png", "L5": "speed_limit_10_v3.png"}
NAMES = {"L1": "A", "L2": "K", "L3": "Q", "L4": "J", "L5": "10"}


def configure(mock_dir, sources, area, a_height):
    """take build_assets.py's sources and sizes (one place for them)"""
    global MOCK, SRC, SIGN_AREA, SIGN_A_HEIGHT
    MOCK, SRC, SIGN_AREA, SIGN_A_HEIGHT = mock_dir, dict(sources), dict(area), a_height

DARK_V = 70        # an outline / letter pixel: max channel under this
OUTLINE = 10       # source px: an outline pixel within this of a classed piece belongs to it
FRINGE = 3         # source px: the anti-aliased fringe unmixed around a peeled element
DECO_GROW = 12     # source px: how far the snow and the outlines go on under a decoration (None: the mock's fill)
SNOW_CLOSE = 30    # source px: the snow cap is closed across a decoration's hole with a disc this wide (its curve)
SNOW_EDGE = 8      # source px: the black outline drawn along that closed edge

# Seeds are points (source px) inside a light piece of that element. Pieces were read off a component dump
# (tools/analyze.py). Each decoration piece is its own moving part; `pivot` is where it hangs from.
SIGNS = {
    "L5": {  # SPEED LIMIT 10, white, holly top right
        "face": "white",
        "snow": [(363, 113), (1010, 200)],
        "bolts": [(627, 182), (622, 1075)],
        "post": [(623, 1205)],
        "decos": {
            "holly": {"seeds": [(1005, 100), (864, 80), (918, 146)], "pivot": "base"},
        },
    },
    "L4": {  # J, hot pink circle, candy cane
        "face": (246, 3, 144),
        "snow": [(400, 100), (940, 232)],
        "bolts": [(626, 249), (626, 1052)],
        "post": [(616, 1200)],
        "decos": {
            "cane": {"seeds": [(1040, 300)], "pivot": "top"},
        },
    },
    "L3": {  # Q, yellow diamond, string of lights
        "face": (250, 204, 1),
        "snow": [(400, 250)],
        "bolts": [(626, 175), (623, 1013)],
        "post": [(619, 1190)],
        "decos": {
            "bulb1": {"seeds": [(771, 228)], "pivot": "socket"},
            "bulb2": {"seeds": [(855, 310)], "pivot": "socket"},
            "bulb3": {"seeds": [(937, 378)], "pivot": "socket"},
            "bulb4": {"seeds": [(1030, 449)], "pivot": "socket"},
        },
    },
    "L2": {  # K, orange triangle with a reflective band, gold bell on a green bow
        "face": (242, 96, 7),
        "snow": [(600, 100)],
        "bolts": [(608, 245), (608, 1008)],
        "post": [(607, 1180)],
        "decos": {
            "bell": {"seeds": [(1127, 1110), (1129, 1170)], "pivot": "top"},
        },
        "mirror": ["bell"],
    },
    "L1": {  # A, lime pentagon, mistletoe
        "face": (197, 247, 3),
        "snow": [(300, 300), (900, 300)],
        "bolts": [(622, 1050), (622, 302)],
        "post": [(623, 1180)],
        "decos": {
            "mistletoe": {"seeds": [(624, 24), (554, 169), (716, 200), (673, 251), (562, 249), (643, 162), (606, 174), (633, 200)], "pivot": "top"},
        },
    },
}

CLS_BG, CLS_BODY, CLS_SNOW, CLS_LETTER, CLS_BOLT, CLS_POST = 0, 1, 2, 3, 4, 5
CLS_DECO0 = 10


def lum(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def disk(r):
    y, x = np.ogrid[-r : r + 1, -r : r + 1]
    return x * x + y * y <= r * r


def resize_premul(arr, scale):
    """RGBA float 0..255 array -> resized uint8 image, premultiplied so no dark fringes come out of clear pixels."""
    h, w = arr.shape[:2]
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    a = arr[..., 3:4] / 255.0
    pm = np.concatenate([arr[..., :3] * a, arr[..., 3:4]], -1)
    chans = [np.asarray(Image.fromarray(pm[..., i].astype(np.float32), "F").resize((nw, nh), Image.LANCZOS)) for i in range(4)]
    out = np.stack(chans, -1)
    al = np.clip(out[..., 3:4], 0, 255)
    rgb = np.where(al > 0.5, out[..., :3] / np.maximum(al / 255.0, 1e-6), 0)
    return np.concatenate([np.clip(rgb, 0, 255), al], -1).round().astype(np.uint8)


def smooth_fill(ch, hole, sigma):
    """inside `hole`, replace values by a gaussian average of themselves (the NN fill), keeping outside as is"""
    w = hole.astype(np.float32)
    num = ndi.gaussian_filter(ch * w, sigma)
    den = ndi.gaussian_filter(w, sigma)
    out = ch.copy()
    ok = hole & (den > 1e-3)
    out[ok] = num[ok] / den[ok]
    return out


def components(mask):
    lab, n = ndi.label(mask)
    return lab, n


def separate(code, cfg):
    im = np.asarray(Image.open(os.path.join(MOCK, SRC[code])).convert("RGBA")).astype(np.float32)
    H, W = im.shape[:2]
    rgb, a = im[..., :3], im[..., 3]
    v = rgb.max(-1)
    solid = a > 200
    dark = solid & (v < DARK_V)
    light = solid & ~dark
    lab, n = components(light)

    C = np.full((H, W), CLS_BODY, np.int16)
    C[a <= 8] = CLS_BG

    def comp_at(pt):
        x, y = pt
        k = lab[y, x]
        if k == 0:
            # the seed sits on a thin outline: take the nearest light piece
            d, (iy, ix) = ndi.distance_transform_edt(lab == 0, return_indices=True)
            k = lab[iy[y, x], ix[y, x]]
        return k

    deco_names = list(cfg["decos"].keys())
    deco_cls = {name: CLS_DECO0 + i for i, name in enumerate(deco_names)}
    classed = np.zeros((H, W), bool)
    for cls, seeds in [(CLS_SNOW, cfg["snow"]), (CLS_BOLT, cfg["bolts"]), (CLS_POST, cfg["post"])] + [
        (deco_cls[nm], d["seeds"]) for nm, d in cfg["decos"].items()
    ]:
        for pt in seeds:
            k = comp_at(pt)
            m = lab == k
            C[m] = cls
            classed |= m

    # the letters: the big black pieces that do not touch the outer outline, and are not a ring (the 10's inner border)
    dlab, dn = components(dark)
    outer = np.zeros_like(dark)
    edge_touch = ndi.binary_dilation(a <= 8, iterations=3)
    letter = np.zeros_like(dark)
    for k in range(1, dn + 1):
        m = dlab == k
        area = m.sum()
        if area < 1500 or (m & edge_touch).any():
            continue
        filled = ndi.binary_fill_holes(m).sum()
        if filled > 6 * area:
            continue  # a ring: the 10's inner border
        # a bolt's outline ring is caught later by the outline rule; letters are big
        if area < 6000:
            continue
        letter |= m
    C[letter] = CLS_LETTER

    # semi-transparent edge pixels take the class of the nearest solid pixel
    soft = (a > 8) & ~solid
    if soft.any():
        _, (iy, ix) = ndi.distance_transform_edt(~solid, return_indices=True)
        C[soft] = C[iy[soft], ix[soft]]

    # outline pixels go to the nearest classed (non body) light piece within OUTLINE
    for cls in [CLS_SNOW, CLS_BOLT, CLS_POST] + list(deco_cls.values()):
        pass
    best_d = np.full((H, W), np.inf)
    best_c = np.full((H, W), CLS_BODY, np.int16)
    for cls in [CLS_SNOW, CLS_BOLT, CLS_POST] + list(deco_cls.values()):
        src = (C == cls) & light
        if not src.any():
            continue
        d = ndi.distance_transform_edt(~src)
        upd = d < best_d
        best_d[upd] = d[upd]
        best_c[upd] = cls
    take = (dark | soft) & (C == CLS_BODY) & (best_d <= OUTLINE)
    # the post's outline may also sit under the rim; never give it rim pixels above its own top
    C[take] = best_c[take]
    # a soft edge pixel next to a decoration that sits off the sign belongs to it
    rest_class = C.copy()  # what is seen at rest (for the reflector dots)

    # ---- peel, top down -----------------------------------------------------------------------------------------
    img = im.copy()
    layers = {}
    order = [(nm, deco_cls[nm]) for nm in deco_names] + [("snow", CLS_SNOW), ("bolts", CLS_BOLT), ("letter", CLS_LETTER), ("post", CLS_POST)]
    sx = None
    if cfg.get("mirror"):
        sx = mirror_axis(img, C)
    K = np.array([14.0, 14.0, 18.0])
    for name, cls in order:
        mask = C == cls
        if not mask.any():
            continue
        band = ndi.binary_dilation(mask, disk(FRINGE)) & ~mask & (C != CLS_BG)
        if name == "post":
            band[:] = False  # the post is behind the plate: the rim's edge over it stays as drawn
        hole = mask | band
        U = np.zeros_like(img)
        Cn = np.zeros_like(C)
        if name == "post":
            U[:] = 0
            Cn[:] = CLS_BG
        else:
            # sample past the hole's own anti-aliased ring (3 px), so no dark fringe is copied in as streaks
            nosrc = ndi.binary_dilation(hole, disk(3))
            dist, (iy, ix) = ndi.distance_transform_edt(nosrc, return_indices=True)
            U = img[iy, ix].copy()
            Cn = C[iy, ix].copy()
            if name in deco_names and DECO_GROW is not None:
                # (the game's port, 2026-11-19: the mock's known faults, the A's mistletoe wedge, the J's cane stub, the
                # 10's holly sliver) under a decoration the snow cap and the face's painted shadows (mid tones that are
                # neither the face color nor the black outline) go on at most DECO_GROW source px; past that the hole
                # takes the nearest plain face (or air). The black outlines and rims go on as before (a rim under the cane
                # stays a rim), so a swinging decoration uncovers face, not a streak of snow or a shadow's wedge.
                src_ok = ~nosrc
                rgbi = img[..., :3]
                dark_src = src_ok & (rgbi.max(-1) < DARK_V) & (img[..., 3] > 128)
                snow_src = src_ok & (C == CLS_SNOW)
                if cfg["face"] == "white":
                    face_like = rgbi.min(-1) > 200
                else:
                    face_like = np.sqrt(((rgbi - np.array(cfg["face"], np.float32)) ** 2).sum(-1)) < 60
                face_src = src_ok & (C == CLS_BODY) & face_like & (img[..., 3] > 128)
                air_src = src_ok & (img[..., 3] <= 8)
                # the face's painted shadows: its own hue, darker (the 10: grays)
                if cfg["face"] == "white":
                    shade_like = (rgbi.max(-1) - rgbi.min(-1)) < 0.15 * np.maximum(rgbi.max(-1), 1)
                else:
                    f = np.array(cfg["face"], np.float32)
                    shade_like = (rgbi @ f) / np.maximum(np.linalg.norm(rgbi, axis=-1) * np.linalg.norm(f), 1e-6) > 0.97
                other_src = src_ok & (C == CLS_BODY) & ~dark_src & ~face_like & shade_like & (img[..., 3] > 128)
                bad = np.zeros_like(hole)
                for m in (snow_src, other_src):
                    if m.any():
                        far = ndi.distance_transform_edt(~m) > DECO_GROW
                        bad |= hole & m[iy, ix] & far
                plain = face_src | air_src
                if bad.any() and plain.any():
                    _, (jy, jx) = ndi.distance_transform_edt(~plain, return_indices=True)
                    U[bad] = img[jy[bad], jx[bad]]
                    Cn[bad] = C[jy[bad], jx[bad]]
                # the snow cap's own edge goes on under it: the cap closed across the hole (its curve, not a streak),
                # filled from the nearest snow, with a black outline SNOW_EDGE px wide along the closed edge
                if snow_src.any():
                    closed = ndi.binary_closing(snow_src, disk(SNOW_CLOSE), border_value=0) & hole
                    if closed.any():
                        _, (sy, sx2) = ndi.distance_transform_edt(~snow_src, return_indices=True)
                        U[closed] = img[sy[closed], sx2[closed]]
                        Cn[closed] = CLS_SNOW
                        whole = closed | snow_src
                        edge = hole & ~whole & ndi.binary_dilation(whole, disk(SNOW_EDGE)) & ~ndi.binary_dilation(face_src | air_src, disk(1))
                        U[edge, :3] = K
                        U[edge, 3] = 255
                        Cn[edge] = CLS_SNOW
            if name in ("letter", "bolts"):
                # these sit on the flat face: smooth the refill (normalized convolution of the sampled face) so it is
                # one even color, not nearest-pixel rays
                for ch in range(4):
                    U[..., ch] = smooth_fill(U[..., ch], hole, 9)
            if name == "snow":
                # under the snow cap: the plate goes on for a short way under its lower edge; above that it is open
                # sky (the cap stands above the plate), so a squashed cap never shows invented sign
                far = dist > 34
                U[far & hole] = 0
                Cn[far & hole] = CLS_BG
            if name in cfg.get("mirror", []) and sx is not None:
                # mirror fill across the sign's own axis where the mirrored pixel is plain sign (not a hole, not bg)
                ys, xs = np.nonzero(mask)  # the fringe keeps its nearest neighbour (next to the bow, say)
                mx = np.round(2 * sx - xs).astype(int)
                ok = (mx >= 0) & (mx < W)
                ys, xs, mx = ys[ok], xs[ok], mx[ok]
                good = ~hole[ys, mx] & (C[ys, mx] == CLS_BODY)
                U[ys[good], xs[good]] = img[ys[good], mx[good]]
                Cn[ys[good], xs[good]] = CLS_BODY
                # where the mirror says background, it is background
                bgm = (C[ys, mx] == CLS_BG) & ~hole[ys, mx]
                U[ys[bgm], xs[bgm]] = 0
                Cn[ys[bgm], xs[bgm]] = CLS_BG
        L = np.zeros_like(img)
        L[mask] = img[mask]
        # fringe: unmix a black outline over the refill
        # P = a K + (1 - a) U  ->  a = (U - P).(U - K) / |U - K|^2; a pixel off that line (another color mixed in)
        # goes with the element as drawn, so the rest picture is exact and nothing of it stays behind
        P = img[band][:, :3]
        Ub = U[band][:, :3]
        ua = U[band][:, 3]
        uk = Ub - K[None, :]
        alpha = np.clip(((Ub - P) * uk).sum(1) / np.maximum((uk * uk).sum(1), 1), 0, 1)
        resid = np.sqrt(((P - (alpha[:, None] * K[None, :] + (1 - alpha[:, None]) * Ub)) ** 2).sum(1))
        Lb = np.zeros((band.sum(), 4), np.float32)
        Lb[:, :3] = K
        Lb[:, 3] = alpha * img[band][:, 3]
        whole = (resid > 30) | (ua < 128)
        Lb[whole] = img[band][whole]
        flat = (lum(Ub) < 60) & ~whole  # the refill is itself dark: nothing to unmix
        Lb[flat, 3] = 0
        L[band] = Lb
        layers[name] = L
        img[hole] = U[hole]
        C[hole] = Cn[hole]
        if name == "post":
            C[mask] = CLS_BG
    layers["body"] = img

    # ---- the post, extended up under the plate ---------------------------------------------------------------------
    post = layers["post"]
    pm = post[..., 3] > 128
    ys, xs = np.nonzero(pm)
    p_top, p_bot = ys.min(), ys.max()
    prof_y = int(p_top + 0.35 * (p_bot - p_top))
    row = post[prof_y].copy()
    ext = int(0.22 * H)
    for y in range(max(0, p_top - ext), prof_y):
        fill = row[:, 3] > post[y, :, 3]
        if y >= p_top:
            fill &= layers["body"][y, :, 3] > 250  # only where the plate hides it
        post[y, fill] = row[fill]
    post_cx = float(xs.mean())

    # ---- pivots ---------------------------------------------------------------------------------------------------
    pivots = {}
    for nm in deco_names:
        m = layers[nm][..., 3] > 128
        yy, xx = np.nonzero(m)
        kind = cfg["decos"][nm]["pivot"]
        if kind == "top":
            top = yy.min()
            sel = yy < top + 12
            pivots[nm] = (float(xx[sel].mean()), float(top + 6))
        elif kind == "base":
            pivots[nm] = (float(xx.mean()), float(np.percentile(yy, 80)))
        elif kind == "socket":
            # the top of the bulb: the bulb end nearest the wire (the wire runs above it)
            top = yy.min()
            sel = yy < top + 10
            pivots[nm] = (float(xx[sel].mean()), float(top + 4))
    snow_m = layers["snow"][..., 3] > 128
    yy, xx = np.nonzero(snow_m)
    pivots["snow"] = (float(xx.mean()), float(np.percentile(yy, 75)))
    pivots["plate"] = (post_cx, float(p_top))

    # ---- check: recomposite ----------------------------------------------------------------------------------------
    comp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for nm in ["post", "body", "letter", "bolts", "snow"] + deco_names:
        comp.alpha_composite(Image.fromarray(np.clip(layers[nm], 0, 255).round().astype(np.uint8), "RGBA"))
    ca = np.asarray(comp).astype(np.float32)
    bg = np.array([60, 70, 80], np.float32)

    def over(x):
        al = x[..., 3:4] / 255
        return x[..., :3] * al + bg * (1 - al)

    diff = np.abs(over(ca) - over(im)).max(-1)
    # the post extension sits under the plate: compare only where the original is opaque or clear alike
    err = {"mean": float(diff.mean()), "p99": float(np.percentile(diff, 99)), "max": float(diff.max()), "over24": int((diff > 24).sum())}

    return {"src": im, "layers": layers, "rest_class": rest_class, "pivots": pivots, "deco": deco_names, "err": err, "C_after": C}


def mirror_axis(img, C):
    """The sign's left-right axis: the x that best mirrors the plain body's dark outline onto itself."""
    H, W = C.shape
    m = ((C == CLS_BODY) & (img[..., :3].max(-1) < DARK_V)).astype(np.float32)
    m[: H // 3] = 0  # the snow cap is not symmetric
    best, bx = None, None
    for s2 in range(2 * 560, 2 * 660):
        sx = s2 / 2
        xs = np.arange(W)
        mx = np.round(2 * sx - xs).astype(int)
        ok = (mx >= 0) & (mx < W)
        a = m[:, ok]
        b = m[:, mx[ok]]
        score = (a * b).sum() / max(1, (a + b).sum())
        if best is None or score > best:
            best, bx = score, sx
    return bx


def sign_scale():
    """road px per source px for each sign (tools/build_assets.py gather_symbols)."""
    trims, areas = {}, {}
    for code, f in SRC.items():
        a = np.asarray(Image.open(os.path.join(MOCK, f)).convert("RGBA"))[..., 3]
        ys, xs = np.where(a > 8)
        trims[code] = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        areas[code] = float((a > 128).sum())
    a_k = SIGN_A_HEIGHT / (trims["L1"][3] - trims["L1"][1])
    a_area = areas["L1"] * a_k * a_k
    return {code: math.sqrt(SIGN_AREA[code] * a_area / areas[code]) for code in SRC}, trims


def face_mask(code, res, cfg):
    """the colored face seen at rest (where a reflector may sit), source px"""
    im = res["src"]
    rc = res["rest_class"]
    rgb = im[..., :3]
    body = (rc == CLS_BODY) & (im[..., 3] > 250)
    if cfg["face"] == "white":
        # the 10: white pixels deeper than its outer outline, white rim and inner border (57 source px at mid height)
        inside = ndi.distance_transform_edt(im[..., 3] > 8) > 62
        return body & (rgb.min(-1) > 200) & inside
    f = np.array(cfg["face"], np.float32)
    d = np.sqrt(((rgb - f) ** 2).sum(-1))
    return body & (d < 60)


def place_dots(fm, plate, kind, k, axis, ring_band=None):
    """dot centres in source px for a layout. `k` road px per source px; `axis` the sign's mirror x (source px).
    ring_band: for the K, the reflective band its ring runs along instead of the face's inner edge."""
    rpx = 1.0 / k  # source px per road px
    if kind == "ring":
        r_road, gap_road, inset_road = 2.8, 10.0, 1.4
    elif kind == "field":
        r_road, gap_road = 2.3, 9.0
    else:
        r_road, gap_road = 5.2, 0
    r = r_road * rpx
    margin = r + (1.0 if kind == "ring" else 1.6) * rpx
    allowed = ndi.binary_erosion(fm, disk(max(1, int(round(margin)))))
    H, W = fm.shape
    pts = []
    if kind == "ring":
        if ring_band is not None:
            band = ring_band
        else:
            dist = ndi.distance_transform_edt(plate)
            inset = inset_road * rpx + r
            band = allowed & (np.abs(dist - inset) < 1.2)
        ys, xs = np.nonzero(band)
        if len(xs):
            cy, cx = ys.mean(), xs.mean()
            ang = np.arctan2(ys - cy, xs - cx)
            order = np.argsort(ang)
            gap = gap_road * rpx
            for i in order:
                p = (xs[i], ys[i])
                if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 >= gap * gap for q in pts):
                    pts.append(p)
            # the last pick may crowd the first round the loop
            if len(pts) > 2 and (pts[-1][0] - pts[0][0]) ** 2 + (pts[-1][1] - pts[0][1]) ** 2 < (0.7 * gap) ** 2:
                pts.pop()
    elif kind == "field":
        gap = gap_road * rpx
        row = 0
        y = gap / 2
        while y < H:
            off = (gap / 2) if row % 2 else 0
            n = int(W / gap) + 2
            for j in range(-n, n + 1):
                x = axis + off + j * gap
                xi, yi = int(round(x)), int(round(y))
                if 0 <= yi < H and 0 <= xi < W and allowed[yi, xi]:
                    pts.append((xi, yi))
            y += gap * math.sqrt(3) / 2
            row += 1
    else:
        # sparse: three mirrored pairs of big reflectors, spread by farthest point picks on the left half
        mirror_ok = allowed.copy()
        xs_all = np.arange(W)
        mx = np.clip(np.round(2 * axis - xs_all).astype(int), 0, W - 1)
        mirror_ok &= allowed[:, mx]
        mirror_ok[:, int(axis - 2 * r):] = False
        ys, xs = np.nonzero(mirror_ok)
        cand = np.stack([xs, ys], 1)[:: max(1, len(xs) // 6000)].astype(float)
        if len(cand):
            def both(p):
                return [p, (2 * axis - p[0], p[1])]
            first = cand[np.argmin(cand[:, 1])]
            chosen = [tuple(first)]
            refs = np.array(both(first))
            dmin = np.min(np.sqrt(((cand[:, None, :] - refs[None]) ** 2).sum(-1)), 1)
            while len(chosen) < 3:
                i = int(np.argmax(dmin))
                chosen.append(tuple(cand[i]))
                refs = np.array(both(cand[i]))
                dmin = np.minimum(dmin, np.min(np.sqrt(((cand[:, None, :] - refs[None]) ** 2).sum(-1)), 1))
            for p in chosen:
                pts += both(p)
    return [(float(x), float(y)) for x, y in pts], r




# ---- THE HONEYCOMB FIELD with its own numbers (the 10's denser options) ---------------------------------------------------
def place_field(fm, k, axis, r_road, gap_road, margin_road):
    """place_dots' honeycomb field with its own dot radius, spacing and clearance (road px)"""
    rpx = 1.0 / k
    r = r_road * rpx
    margin = r + margin_road * rpx
    allowed = ndi.binary_erosion(fm, disk(max(1, int(round(margin)))))
    H, W = fm.shape
    gap = gap_road * rpx
    pts = []
    row = 0
    y = gap / 2
    while y < H:
        off = (gap / 2) if row % 2 else 0
        n = int(W / gap) + 2
        for j in range(-n, n + 1):
            x = axis + off + j * gap
            xi, yi = int(round(x)), int(round(y))
            if 0 <= yi < H and 0 <= xi < W and allowed[yi, xi]:
                pts.append((xi, yi))
        y += gap * math.sqrt(3) / 2
        row += 1
    return [(float(x), float(y)) for x, y in pts], r


def border_band_points(res, k, step_road):
    """THE 10's BLACK BORDER BAND (option b): points along the middle of the thin black border ring between its white
    rim and its white face, where it is seen at rest (not under the snow cap, the holly or a bolt), every step_road road
    px. Additive light shows on this black and nothing on the white either side of it."""
    im = res["src"]
    rc = res["rest_class"]
    a = im[..., 3]
    dark = (a > 200) & (im[..., :3].max(-1) < DARK_V) & (rc == CLS_BODY)
    d_edge = ndi.distance_transform_edt(a > 8)
    # the inner border sits 45 to 80 source px in from the sign's silhouette (the outline and the rim outside it)
    band = dark & (d_edge > 42) & (d_edge < 85)
    lab, n = ndi.label(band)
    if n == 0:
        return []
    sizes = ndi.sum(band, lab, range(1, n + 1))
    band = lab == (int(np.argmax(sizes)) + 1)
    dtb = ndi.distance_transform_edt(band)
    ridge = band & (dtb >= 0.75 * np.percentile(dtb[band], 95))
    ys, xs = np.nonzero(ridge)
    cy, cx = ys.mean(), xs.mean()
    order = np.argsort(np.arctan2(ys - cy, xs - cx))
    gap = step_road / k
    pts = []
    for i in order:
        p = (float(xs[i]), float(ys[i]))
        if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 >= gap * gap for q in pts):
            pts.append(p)
    if len(pts) > 2 and (pts[-1][0] - pts[0][0]) ** 2 + (pts[-1][1] - pts[0][1]) ** 2 < (0.7 * gap) ** 2:
        pts.pop()
    return pts


# ---- the effect pictures (white, tinted by the game; the mock's tools/fx.py, unchanged, plus the 10's ring) ------------
def _grid(n):
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    c = (n - 1) / 2
    return (x - c) / c, (y - c) / c


def fx_pictures():
    """sign_glow (additive halo with a hot core), sign_lens (a reflector disc, lighter rim, hot spot; normal blend),
    sign_ring (the 10's reflector rim seen at rest, option a), sign_sparkle (a four point star, additive), sign_flake0..2
    (snow clumps, normal blend). Drawn at their texture size or smaller everywhere (glow 64 px at most 29 road px across:
    83 px at 3x on the largest desktop)."""
    out = {}

    def pic(a):
        return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")

    x, y = _grid(64)
    r = np.sqrt(x * x + y * y)
    al = np.exp(-((r / 0.42) ** 2)) * 0.75 + np.exp(-((r / 0.13) ** 2)) * 0.6
    al = np.clip(al, 0, 1) * (r < 1)
    a = np.zeros((64, 64, 4))
    a[..., :3] = 255
    a[..., 3] = al * 255
    out["sign_glow"] = pic(a)

    x, y = _grid(48)
    r = np.sqrt(x * x + y * y)
    edge = np.clip((0.62 - r) / 0.06, 0, 1)
    shade = 0.78 + 0.22 * np.clip(1 - np.sqrt((x + 0.22) ** 2 + (y + 0.22) ** 2) / 0.5, 0, 1)
    rim = np.clip(1 - np.abs(r - 0.53) / 0.07, 0, 1)
    v = np.clip(shade + 0.25 * rim, 0, 1)
    a = np.zeros((48, 48, 4))
    a[..., 0] = a[..., 1] = a[..., 2] = v * 255
    a[..., 3] = edge * 255
    out["sign_lens"] = pic(a)
    # the ring: the lens's own edge as a thin line (its disc is 0.62 of the half width, the line 0.13 wide inside it)
    ring = np.clip(1 - np.abs(r - 0.55) / 0.075, 0, 1)
    a = np.zeros((48, 48, 4))
    a[..., :3] = 255
    a[..., 3] = ring * 255
    out["sign_ring"] = pic(a)

    x, y = _grid(96)
    r = np.sqrt(x * x + y * y)
    ray = np.exp(-(np.abs(x) / 0.035)) * np.exp(-(np.abs(y) / 0.55)) + np.exp(-(np.abs(y) / 0.035)) * np.exp(-(np.abs(x) / 0.55))
    d1, d2 = (x + y) / np.sqrt(2), (x - y) / np.sqrt(2)
    ray += 0.35 * (np.exp(-(np.abs(d1) / 0.03)) * np.exp(-(np.abs(d2) / 0.25)) + np.exp(-(np.abs(d2) / 0.03)) * np.exp(-(np.abs(d1) / 0.25)))
    al = np.clip(ray + np.exp(-((r / 0.12) ** 2)), 0, 1) * (r < 1)
    a = np.zeros((96, 96, 4))
    a[..., :3] = 255
    a[..., 3] = al * 255
    out["sign_sparkle"] = pic(a)

    rng = np.random.default_rng(7)
    for i in range(3):
        n = 40
        x, y = _grid(n)
        ang = np.arctan2(y, x)
        r = np.sqrt(x * x + y * y)
        bumps = 0.62 + 0.12 * np.sin(ang * (3 + i) + i) + 0.06 * np.sin(ang * (5 + i) + 2 * i)
        inside = r < bumps
        outline = (r < bumps + 0.16) & ~inside
        light = np.clip(0.9 - 0.35 * np.clip(y + 0.15 - 0.3 * x, 0, 1), 0, 1)
        a = np.zeros((n, n, 4))
        a[inside, 0] = 205 + 50 * light[inside]
        a[inside, 1] = 222 + 33 * light[inside]
        a[inside, 2] = 250
        a[inside, 3] = 255
        a[outline, :3] = (16, 18, 26)
        a[outline, 3] = 255
        out[f"sign_flake{i}"] = pic(a)
    del rng
    return out


# ---- the 10's reflector options and the rest bake ----------------------------------------------------------------------
# THE 10 (white SPEED LIMIT sign): its honeycomb at the four signs' numbers (gap 9, radius 2.3) fits only 10 reflectors
# between its letters, and additive light shows nothing on white. Its options (constants SIGN_WIN.ten) use their own
# dot sets: `dense` (options a and b) a closer honeycomb of smaller reflectors, `denseBig` (option c) a closer honeycomb
# of slightly larger ones, `band` (option b) points on its thin black border ring. Road px.
TEN_DOTS = {
    "dense": {"r": 1.9, "gap": 6.6, "margin": 1.1},
    "denseBig": {"r": 2.5, "gap": 7.4, "margin": 1.1},
}
TEN_BAND_STEP = 7.0
# THE REST BAKE (Corey's "Seen at rest" 0.1, dot size 1.25, the honeycomb field, the glint color from the face): each
# reflector at rest is the lens tinted 14% darker than the face at alpha 0.1, drawn under the light as the mock draws it.
# Baked into the four colored signs' plates (it is a 1 to 2% change of the face: no sprite for it). Change these and
# rebuild for another rest look; SIGN_WIN.glint.rest / size do not move it.
REST_BAKE = {"layout": "field", "size": 1.25, "alpha": 0.1, "darken": 0.14}


def _lens_at(lens, size_px, color):
    """the lens picture at `size_px` source px, its white tinted by `color` (premultiplied resample)"""
    n = max(2, int(round(size_px)))
    a = np.asarray(lens).astype(np.float32)
    pm = a.copy()
    pm[..., :3] *= pm[..., 3:4] / 255.0
    chans = [np.asarray(Image.fromarray(pm[..., i], "F").resize((n, n), Image.LANCZOS)) for i in range(4)]
    out = np.stack(chans, -1)
    al = np.clip(out[..., 3:4], 0, 255)
    rgb = np.where(al > 0.5, out[..., :3] / np.maximum(al / 255.0, 1e-6), 0)
    rgb = np.clip(rgb, 0, 255) * (np.asarray(color, np.float32) / 255.0)[None, None, :]
    return np.concatenate([rgb, al], -1)


def _over(dst, src, x0, y0):
    """straight alpha `src` over `dst` (both float 0..255 RGBA) at integer x0, y0"""
    h, w = src.shape[:2]
    H, W = dst.shape[:2]
    sx0, sy0 = max(0, -x0), max(0, -y0)
    dx0, dy0 = max(0, x0), max(0, y0)
    dx1, dy1 = min(W, x0 + w), min(H, y0 + h)
    if dx1 <= dx0 or dy1 <= dy0:
        return
    s = src[sy0 : sy0 + dy1 - dy0, sx0 : sx0 + dx1 - dx0]
    d = dst[dy0:dy1, dx0:dx1]
    sa = s[..., 3:4] / 255.0
    da = d[..., 3:4] / 255.0
    oa = sa + da * (1 - sa)
    rgb = (s[..., :3] * sa + d[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    d[..., :3] = rgb
    d[..., 3:4] = oa * 255


_CUT = None


def cut_all():
    """every sign cut (cached: both atlas tiers use one cut). code -> {"res", "entry", "plate"} with the plate as drawn
    (body, letter, bolts; the colored signs' rest reflectors baked in), source px."""
    global _CUT
    if _CUT is not None:
        return _CUT
    scale, trims = sign_scale()
    fx = fx_pictures()
    out = {}
    for code, cfg in SIGNS.items():
        res = separate(code, cfg)
        k = scale[code]
        x0, y0, x1, y1 = trims[code]
        names = ["post", "plate", "snow"] + res["deco"]
        entry = {"name": NAMES[code], "roadPerSrc": k, "box": [x0, y0, x1, y1], "size": [(x1 - x0) * k, (y1 - y0) * k], "layers": names, "pivots": {}, "dots": {}, "deco": res["deco"]}
        ax, ay = (x0 + x1) / 2, y1

        def to_road(p):
            return [round((p[0] - ax) * k, 2), round((p[1] - ay) * k, 2)]

        for nm, p in res["pivots"].items():
            entry["pivots"][nm] = to_road(p)
        for nm in res["deco"]:
            m = res["layers"][nm][..., 3] > 128
            yy, xx = np.nonzero(m)
            entry.setdefault("centres", {})[nm] = to_road((xx.mean(), yy.mean()))
            entry.setdefault("decoColor", {})[nm] = [int(c) for c in np.median(res["layers"][nm][m][:, :3], 0)]
        bm = res["layers"]["bolts"][..., 3] > 128
        blab, bn = ndi.label(bm)
        entry["bolts"] = [to_road(ndi.center_of_mass(blab == i)[::-1]) for i in range(1, bn + 1) if (blab == i).sum() > 300]
        fm = face_mask(code, res, cfg)
        plate_m = ndi.binary_fill_holes(fm | (res["rest_class"] == CLS_LETTER) | (res["rest_class"] == CLS_BOLT))
        axis = mirror_axis(res["src"], res["rest_class"])
        ring_band = None
        if code == "L2":
            dsil = ndi.distance_transform_edt(res["src"][..., 3] > 8)
            seen = (res["rest_class"] == CLS_BODY) & (res["src"][..., 3] > 250)
            ring_band = seen & (np.abs(dsil - 37) < 1.2) & ndi.binary_erosion(seen, disk(int(2.8 / k) + 3))
        entry["axis"] = round((axis - ax) * k, 2)
        for kind in ["ring", "field", "sparse"]:
            pts, r = place_dots(fm, plate_m, kind, k, axis, ring_band)
            entry["dots"][kind] = {"r": round(r * k, 2), "pts": [to_road(p) for p in pts]}
        if cfg["face"] == "white":
            for kind, d in TEN_DOTS.items():
                pts, r = place_field(fm, k, axis, d["r"], d["gap"], d["margin"])
                entry["dots"][kind] = {"r": round(r * k, 2), "pts": [to_road(p) for p in pts]}
            entry["dots"]["band"] = {"r": 0.6, "pts": [to_road(p) for p in border_band_points(res, k, TEN_BAND_STEP)]}
        fcol = cfg["face"] if cfg["face"] != "white" else (245, 246, 250)
        entry["face"] = list(fcol)
        sm = res["layers"]["snow"][..., 3] > 128
        ys, xs = np.nonzero(sm)
        edge = []
        for x in range(xs.min() + 20, xs.max() - 20, 40):
            col = ys[xs == x]
            if len(col):
                edge.append(to_road((x, col.max())))
        entry["snowEdge"] = edge
        # THE PLATE as the game draws it: the body, the letter and the bolts, and (colored signs) the rest reflectors
        plate = res["layers"]["body"].copy()
        for nm in ("letter", "bolts"):
            _over(plate, res["layers"][nm], 0, 0)
        if cfg["face"] != "white":
            dd = entry["dots"][REST_BAKE["layout"]]
            rest = [round(c * (1 - REST_BAKE["darken"])) for c in fcol]
            r_src = dd["r"] * REST_BAKE["size"] / k
            ls = 2 * r_src / 0.62
            tile = _lens_at(fx["sign_lens"], ls, rest)
            tile[..., 3] *= REST_BAKE["alpha"]
            n = tile.shape[0]
            for px, py in dd["pts"]:
                sx, sy = ax + px / k, ay + py / k
                _over(plate, tile, int(round(sx - n / 2)), int(round(sy - n / 2)))
        out[code] = {"res": res, "entry": entry, "plate": plate, "fm": fm}
        print(f"  sign {code} ({NAMES[code]}) cut: recomposite mean {res['err']['mean']:.2f}, {res['err']['over24']} px over 24; dots " + ", ".join(f"{kd} {len(v['pts'])}" for kd, v in entry["dots"].items()))
    _CUT = out
    return out


def tier_pictures(scale):
    """the rig's layers at `scale` atlas px per road px, each trimmed to its ink, and where each sits: name ->
    (picture, [x0, y0, w, h] road px from the sign's anchor, the bottom centre of its flattened frame). Plus the effect
    pictures (one size for both tiers: they are small)."""
    cut = cut_all()
    pics, boxes = {}, {}
    for code, c in cut.items():
        res, entry = c["res"], c["entry"]
        x0, y0, x1, y1 = entry["box"]
        s = entry["roadPerSrc"] * scale
        for nm in entry["layers"]:
            arr = c["plate"] if nm == "plate" else res["layers"][nm]
            crop = np.clip(arr[y0:y1, x0:x1], 0, 255)
            full = resize_premul(crop, s)
            Hc, Wc = full.shape[:2]
            al = full[..., 3]
            ys, xs = np.nonzero(al > 0)
            tx0, ty0, tx1, ty1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
            name = f"{code}_{nm}"
            pics[name] = Image.fromarray(full[ty0:ty1, tx0:tx1], "RGBA")
            # the canvas is the flattened frame's (same box, same rounding): its anchor at (Wc / 2, Hc)
            boxes[name] = [round((tx0 - Wc / 2) / scale, 3), round((ty0 - Hc) / scale, 3), round((tx1 - tx0) / scale, 3), round((ty1 - ty0) / scale, 3)]
    for name, im in fx_pictures().items():
        pics[name] = im
    return pics, boxes


def ten_options_js():
    """the 10's option dot sets for the mock page (layers/ten_options.js): road px from its anchor"""
    e = cut_all()["L5"]["entry"]
    d = {k: e["dots"][k] for k in ("dense", "denseBig", "band")}
    return "window.TEN_DOTS = " + json.dumps(d) + ";\n"


def check_sheet(code, scale_px, out_dir):
    """a check of the cut: every layer over magenta, and the face mask, at `scale_px` (for a review)"""
    c = cut_all()[code]
    res, entry = c["res"], c["entry"]
    x0, y0, x1, y1 = entry["box"]
    tiles = []
    for nm in entry["layers"]:
        arr = c["plate"] if nm == "plate" else res["layers"][nm]
        t = Image.new("RGBA", (x1 - x0, y1 - y0), (255, 0, 255, 255))
        t.alpha_composite(Image.fromarray(np.clip(arr[y0:y1, x0:x1], 0, 255).astype(np.uint8), "RGBA"))
        tiles.append(t.convert("RGB"))
    w = scale_px
    sh = Image.new("RGB", (w * len(tiles), w), (0, 0, 0))
    for i, t in enumerate(tiles):
        t.thumbnail((w, w))
        sh.paste(t, (i * w, 0))
    sh.save(os.path.join(out_dir, f"check_{code}.png"))


if __name__ == "__main__":
    import sys

    out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    for code in cut_all():
        check_sheet(code, 360, out_dir)
