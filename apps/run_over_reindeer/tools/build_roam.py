# THE ROAMING REINDEER'S SHEETS (2026-11-17): the rig's walk, walk start, walk stop and sniff (idle) clips, packed from
# the SAME export the strike's run views come from (animation/export_2026-11-11/reindeer, README.txt beside it). No new
# art: these clips were rendered with the run and were "stage 2, not packed" until now (tools/build_assets.py).
#
#   math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_roam.py
#
# Writes static/assets/reindeer/roam2-<tier>-<n>.webp, roamc-<tier>-<n>.webp (the charge wind-up) and
# src/game/reindeerRoamSpec.ts (generated). Pixel work only.
#
# WHAT IS PACKED (frames of the rig's 30 fps clips; the game plays them on the rig's own frame clock, game/road/roam.ts):
#   walk        every 4th frame of the 40 frame loop (7.5 fps): 1, 5 .. 37
#   start       every 4th frame of walk_start (1 .. 29): it ends on walk frame 38, the game goes on from walk 39
#   stop        every 4th frame of walk_stop (1 .. 33) and its last (36, the stand); its frame 1 follows walk frame 8
#   sniff       every 2nd frame of the 100 frame idle loop (15 fps): 1, 3 .. 99; frame 1 is the stand (2026-11-22, Corey:
#               "the sniff is choppy", then "Let's try every 2nd frame"; it was every 6th, 5 fps, 17 frames)
# The game plays them on the rig's own 30 fps clock and shows the packed frame nearest the rig frame due.
# Each frame is resized as its whole box at the strike's side run density (3 physical px per CSS px at the largest draw:
# the same numbers as build_assets.py RUN_CSS_PER_ROAD and the R view's draw scale), then trimmed to its ink.
#
# THE CHARGE WIND-UP (2026-11-20, Corey's "Slow Drag 1" and "B Snort at lock"; the rig's addition
# animation/export_2026-11-20_charge/reindeer, R3_GAME_SPEC.md beside it): two more clips, EVERY frame packed (the scrape's
# timing is planned frame by frame, game/road/chargeWindup.ts), on sheets of their own ("roamc", loaded after the roam
# sheets) so the roam2 sheets above are byte for byte as they were:
#   charge      charge_slow_R, all 21 (head down 1-5, reach 5-8, the hit 9, the drag 9-15, the kick 17, back to 21)
#   chargeDown  charge_down_R, all 4 (Turbo 2 and a slam stop's hurry: the head goes down and holds)
# and the export's two effect sprites, resized whole (not trimmed) to their largest draw at the same density: the breath
# puff (fx.json puff sprite_diameter_frame_px_at_full) and the kicked snow (snow's). Their motion numbers, the nose and
# hoof points per frame and the run's nose per stride are copied from the export's JSON into the spec, never typed in.
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageFilter
from _paths import ART_SRC  # noqa: E402  (tools/_paths.py: the app's art-src/ folder)

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "static", "assets")
SRC = ART_SRC
SOURCE = os.path.join(SRC, "animation", "export_2026-11-11", "reindeer")

CLIPS = {
    "walk": ("walk_R", list(range(1, 41, 4))),
    "start": ("walk_start_R", list(range(1, 33, 4))),
    "stop": ("walk_stop_R", list(range(1, 37, 4)) + [36]),
    "sniff": ("sniff_loop_R", list(range(1, 101, 2))),
}
CHARGE_SOURCE = os.path.join(SRC, "animation", "export_2026-11-20_charge", "reindeer")
CHARGE_CLIPS = {
    "charge": ("charge_slow_R", list(range(1, 22))),
    "chargeDown": ("charge_down_R", list(range(1, 5))),
}
CHARGE_PREFIX = "roamc"
# (2026-11-17, the owner after a side by side: half the frames. The sheets' file names carry "roam2" so the first build's
# roam-<tier>-<n>.webp stayed on disk untouched; nothing referenced them, and they were archived on 2026-11-23 to
# the web-sdk repo's _archive/2026-11-23/apps/run_over_reindeer/static/assets/reindeer/.)
SHEET_PREFIX = "roam2"
# the same density rule as the run's side view (tools/build_assets.py RUN_CSS_PER_ROAD, RUN_DRAW_SCALE R)
CSS_PER_ROAD = {"full": 1.5 * 982 / 1536, "phone": 0.39}
DRAW_SCALE = {"full": 0.72, "phone": 0.8}
SHEET_MAX = 2048
WEBP = dict(quality=90, alpha_quality=90, method=6)


def resize_box(im, bw, bh):
    arr = np.asarray(im).astype(np.float32) / 255.0
    arr[..., :3] *= arr[..., 3:4]
    pm = Image.fromarray((arr * 255).round().astype(np.uint8), "RGBA").resize((bw, bh), Image.LANCZOS)
    o = np.asarray(pm).astype(np.float32) / 255.0
    alpha = np.clip(o[..., 3:4], 1e-6, 1)
    o[..., :3] = np.clip(o[..., :3] / alpha, 0, 1)
    return Image.fromarray((o * 255).round().astype(np.uint8), "RGBA")


# THE CHARGE CLIPS' REACH (2026-11-20), read from their frames at the native render, frame px from the anchor: `up`,
# `back`, `fwd` are the solid ink (alpha >= SOLID: his body, antlers and the light bulbs), `glow*` all ink (the bulbs'
# soft glow too). The roam's keep-outs use the solid ink for these two clips (game/road/roam.ts ROAM_REACH): their boxes
# (1160 up) count the bulbs' glow, which only the lowered head's antlers raise that high, and on the desktop that box left
# him almost no spot to stand on (265 of 300 seeded picks found none). The glow may lie up to (glowUp - up) past it.
SOLID = 128

# THE EFFECTS MADE TO READ (Corey 2026-11-20, "Make them read": the rig's white puff and specks were all but invisible
# on the pale snow and sky). Derived here from the rig's own fx/puff.png and fx/snow.png (never redrawn; the files are
# kept as delivered): drawn FX_DRAW times the export's size, and given a faint cool blue-grey edge and a shaded underside,
# the scene's snow shading language (a cool shade lit from the top left, as the van's backfire puff is lit), thin, so
# they stay weather details and not cartoon clouds. The motion, counts and spawn points are the export's (fx.json).
FX_DRAW = {"puff": 2.0, "snow": 2.0}
FX_EDGE = (112, 132, 164)  # the edge, a cool blue-grey
FX_SHADE = (190, 205, 228)  # the underside's shade
FX_EDGE_ALPHA = {"puff": 0.85, "snow": 0.6}


def _smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def readable_fx(name, im):
    """the export's sprite with a faint blue-grey edge and a shaded underside (same size, straight alpha)"""
    arr = np.asarray(im.convert("RGBA")).astype(np.float32) / 255.0
    a = arr[..., 3]
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ys, xs = np.where(a > 0.02)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    r = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 + 1e-6
    # lit from the top left: 0 on the lit side, 1 on the underside
    under = _smooth(((xx - cx) * 0.45 + (yy - cy) * 0.9) / r, -0.2, 0.9)
    if name == "puff":
        # the soft breath: a firmer body (its faint outer half lifted), its falloff turning cool toward the rim (no
        # ring: a breath has no line)
        alpha = np.clip(a * 2.0, 0, 1) ** 0.8
        edge = (1 - _smooth(a, 0.03, 0.75)) * (alpha > 0.01)
    else:
        # the speck: white through (round 2, measured: its cool rim and shade greyed a cluster of 5 CSS px specks on
        # Super snow), the export's own soft edge kept in its alpha
        alpha = a
        arr = arr.copy()
        arr[..., :3] = 1.0
        edge = np.zeros_like(a)
    # (from the export's own colors: the speck's rim is already a cool grey)
    rgb = arr[..., :3].copy()
    shade = np.array(FX_SHADE, np.float32) / 255
    sh = FX_LIGHT_SHADE[name]
    rgb = rgb * (1 - sh * under[..., None]) + shade * (sh * under[..., None])
    e = np.array(FX_EDGE, np.float32) / 255
    k = (edge * FX_EDGE_ALPHA[name])[..., None]
    rgb = rgb * (1 - k) + e * k
    return Image.fromarray((np.dstack([rgb, alpha]) * 255).round().astype(np.uint8), "RGBA")


# ROUND 2 (Corey 2026-11-20: "Make them read", the coordinator's round 2): a white puff on white snow has no contrast.
# Each effect is baked in two LOOKS from the same rig sprite, both on the sheet, the look picked at spawn by the ground
# he stands on (the scene preset shown): `light` (readable_fx above: white, a cool falloff) for dark ground, `dark` (a
# slate blue-grey body with a clear darker rim, the same shape) for light ground. Which ground is light is read from the
# scene's own art (ground_looks: the field and top band's median luminance) and the look with the higher contrast there
# is the one used. The alpha numbers (FX_ALPHA) are each look's start opacity; the fade holds it to FX_HOLD of the life.
# (round 2, measured: his ground is not one tone. On the snow grounds the puff can sit on lit snow (0.87 by day, 0.36 by
# night), on his own shadow or the dark tree line behind his head (0.12 to 0.23), and the specks on snow or its blue
# shade, so the `dark` look is a LIGHT body inside a clear dark rim: the rim stands out on the light ground, the body
# on the dark)
FX_DARK_BODY = {"puff": (226, 233, 244), "snow": (58, 70, 94)}
FX_DARK_RIM = (30, 38, 56)
FX_DARK_SHADE = {"puff": (196, 208, 226), "snow": (40, 50, 70)}
# the light look's underside shade, per effect (the speck kept near white: on Super snow its shade lost the contrast)
FX_LIGHT_SHADE = {"puff": 0.8, "snow": 0.15}
FX_ALPHA = {"puff": {"light": 0.8, "dark": 0.95}, "snow": {"light": 1.0, "dark": 1.0}}
FX_HOLD = 0.6
# the smallest each may be drawn at its largest, CSS px (the smallest phone, 360 x 560), and its picture's floor at 3
# physical px a CSS px of that (and of the desktop's natural size)
FX_MIN_CSS = {"puff": 22, "snow": 5}
FX_MIN_TEX = {"puff": 3 * 30, "snow": 3 * 6}
SCENE_GROUNDS = {"snowDay": "snow-day", "snowNight": "snow-night", "snowSuper": "snow-super", "grassDay": "grass-day", "grassNight": "grass-night", "grassSuper": "grass-super"}


def readable_fx_dark(name, im):
    """the export's sprite as a slate blue-grey body with a clear darker rim (the `dark` look, for light ground)"""
    arr = np.asarray(im.convert("RGBA")).astype(np.float32) / 255.0
    a = arr[..., 3]
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ys, xs = np.where(a > 0.02)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    r = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 + 1e-6
    d = np.hypot(xx - cx, yy - cy) / r
    under = _smooth(((xx - cx) * 0.45 + (yy - cy) * 0.9) / r, -0.2, 0.9)
    if name == "puff":
        alpha = np.clip(a * 2.0, 0, 1) ** 0.8
        ring = _smooth(d, 0.48, 0.56) * (1 - _smooth(d, 0.86, 0.92))
    else:
        alpha = a
        ring = _smooth(d, 0.6, 0.85) * (a > 0.02)
    alpha = np.maximum(alpha, ring)
    body = np.array(FX_DARK_BODY[name], np.float32) / 255
    shade = np.array(FX_DARK_SHADE[name], np.float32) / 255
    rim = np.array(FX_DARK_RIM, np.float32) / 255
    rgb = body * (1 - 0.7 * under[..., None]) + shade * (0.7 * under[..., None])
    rgb = rgb * (1 - ring[..., None]) + rim * ring[..., None]
    return Image.fromarray((np.dstack([rgb, alpha]) * 255).round().astype(np.uint8), "RGBA")


# ROUND 3 (2026-11-20, the coordinator: the r2 ring "reads, but ... a donut or a bubble, not breath"; candidates for
# Corey): three more looks for LIGHT ground, each a puff and its specks, all built here from the rig's own sprites (the
# lobes are copies of the rig's soft puff, the clumps copies of its speck; nothing is redrawn by hand). No circle:
#   A  a cartoon breath cloud: four lobes, a thin even dark outline (the reindeer's own black ink, about 5 % of the
#      puff's size, his 7 frame px line scaled to the puff), a light blue-white fill shaded on the underside
#   B  a soft slate breath: the same lobed shape with no line, a mid slate blue-grey body with a lighter core, soft edge
#   C  comic huff marks: each puff a short curved stroke bowing forward (the game mirrors it with him), slate with a
#      light top edge; four of them drift apart as the puffs do
# and their specks: small clumps of three of the rig's specks, a light top and a slate underside (A's with the outline).
FX_INK = (22, 24, 32)
CANDIDATES = ("A", "B", "C")
LOBES = [(0.34, 0.6, 0.38), (0.56, 0.42, 0.42), (0.72, 0.6, 0.34), (0.5, 0.7, 0.32)]
CLUMP = [(0.4, 0.56, 0.3), (0.6, 0.5, 0.27), (0.5, 0.38, 0.24)]


def _union(src_alpha, n, parts):
    """the union (max) of copies of a soft sprite's alpha, each resized to its part's diameter at its centre (n x n)"""
    out = np.zeros((n, n), np.float32)
    base = Image.fromarray((src_alpha * 255).astype(np.uint8))
    for cx, cy, r in parts:
        dpx = max(2, int(round(2 * r * n)))
        a = np.asarray(base.resize((dpx, dpx), Image.LANCZOS)).astype(np.float32) / 255
        x0, y0 = int(round(cx * n - dpx / 2)), int(round(cy * n - dpx / 2))
        xs0, ys0 = max(0, -x0), max(0, -y0)
        xe, ye = min(dpx, n - x0), min(dpx, n - y0)
        out[y0 + ys0:y0 + ye, x0 + xs0:x0 + xe] = np.maximum(out[y0 + ys0:y0 + ye, x0 + xs0:x0 + xe], a[ys0:ye, xs0:xe])
    return out


def _grow(mask, px):
    m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(int(px) | 1))
    return np.asarray(m).astype(np.float32) / 255


def candidate_fx(name, look, im):
    """a round 3 candidate look (A, B or C) of the effect `name`, from the rig's sprite `im`, at its own size x 4
    supersampled, then down to its size"""
    S = 4
    n = im.width * S
    src = np.asarray(im.convert("RGBA")).astype(np.float32)[..., 3] / 255
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / n
    # lit from the top left: 0 on the lit side, 1 on the underside
    under = np.clip((yy - 0.42) * 2.4 + (xx - 0.5) * 0.6, 0, 1)
    if name == "puff" and look == "C":
        # one curved stroke bowing forward (to the right; mirrored with him), round ends, slate with a light top edge
        d = np.hypot(xx - 0.18, yy - 0.5)
        ang = np.arctan2(yy - 0.5, xx - 0.18)
        on_arc = np.abs(d - 0.5) < 0.055
        span = np.abs(ang) < np.radians(38)
        ends = []
        for sgn in (-1, 1):
            ex, ey = 0.18 + 0.5 * np.cos(np.radians(38) * sgn), 0.5 + 0.5 * np.sin(np.radians(38) * sgn)
            ends.append(np.hypot(xx - ex, yy - ey) < 0.055)
        shape = ((on_arc & span) | ends[0] | ends[1]).astype(np.float32)
        top = np.clip((0.5 - (d - 0.5) / 0.055 * 0.5), 0, 1)  # the stroke's inner side lighter
        body = np.array((70, 84, 112), np.float32) / 255
        light = np.array((150, 166, 194), np.float32) / 255
        rgb = body[None, None] * (1 - 0.6 * top[..., None]) + light[None, None] * (0.6 * top[..., None])
        alpha = shape
    else:
        parts = LOBES if name == "puff" else CLUMP
        soft = _union(src, n, parts)
        if look == "B":
            alpha = np.clip(soft * 1.7, 0, 1) ** 0.9
            core = np.clip(1 - np.hypot(xx - 0.54, yy - 0.55) / 0.36, 0, 1) ** 0.8
            body = np.array((112, 128, 156) if name == "puff" else (120, 136, 164), np.float32) / 255
            light = np.array((176, 190, 212) if name == "puff" else (236, 242, 250), np.float32) / 255
            if name == "snow":
                # a clump: light top, slate underside
                core = 1 - under
            rgb = body[None, None] * (1 - core[..., None]) + light[None, None] * core[..., None]
        else:
            shape = np.clip((soft - 0.3) / 0.12, 0, 1)
            fill_top = np.array((240, 245, 252), np.float32) / 255
            fill_under = np.array((196, 210, 230) if name == "puff" else (128, 144, 172), np.float32) / 255
            sh = under if name == "snow" else under * 0.8
            rgb = fill_top[None, None] * (1 - sh[..., None]) + fill_under[None, None] * sh[..., None]
            if look == "A":
                line = (0.05 if name == "puff" else 0.1) * n
                outer = _grow(shape, line)
                ink = np.clip(outer - shape, 0, 1)
                rgb = rgb * (1 - ink[..., None]) + (np.array(FX_INK, np.float32) / 255)[None, None] * ink[..., None]
                alpha = np.maximum(shape, outer)
            else:
                # C's clump: no ink, its edge a darker slate
                edge = np.clip(_grow(shape, 0.08 * n) - shape, 0, 1)
                rgb = rgb * (1 - edge[..., None]) + (np.array((84, 98, 126), np.float32) / 255)[None, None] * edge[..., None]
                alpha = np.maximum(shape, edge)
    img = Image.fromarray((np.dstack([np.clip(rgb, 0, 1), np.clip(alpha, 0, 1)]) * 255).round().astype(np.uint8), "RGBA")
    return img.resize((im.width, im.height), Image.LANCZOS)


def _lum(rgb):
    c = np.asarray(rgb, np.float64)
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return lin @ np.array([0.2126, 0.7152, 0.0722])


def _ratio(l1, l2):
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)


def ground_looks(fx_images):
    """per scene preset: the ground's luminance (its field and top band, median of the opaque pixels) and the look that
    stands out most on it (each look's rim and body, at its start opacity, over that ground)"""
    out = {}
    for preset, stem in SCENE_GROUNDS.items():
        ls = []
        for part in ("field", "band-top"):
            arr = np.asarray(Image.open(os.path.join(OUT, "scene", f"{stem}-{part}.webp")).convert("RGBA")).astype(np.float64) / 255
            ls.append(_lum(arr[..., :3][arr[..., 3] > 0.5]))
        g = float(np.median(np.concatenate(ls)))
        best = None
        for look in ("light", "dark"):
            worst = None
            for name in ("puff", "snow"):
                arr = np.asarray(fx_images[(name, look)]).astype(np.float64) / 255
                al = arr[..., 3] * FX_ALPHA[name][look]
                m = arr[..., 3] > 0.85
                L = _lum(arr[..., :3][m]) * al[m] + g * (1 - al[m])
                # the rim's or the body's: the strongest tenth of the opaque pixels against the ground
                c = float(np.percentile([_ratio(v, g) for v in L], 90))
                worst = c if worst is None else min(worst, c)
            if best is None or worst > best[1]:
                best = (look, worst)
        out[preset] = {"lum": round(g, 4), "look": best[0], "contrast": round(best[1], 2)}
    return out


def ink_reach(src, clip, frames, m):
    ax, ay = m["anchor_px"]
    up = back = fwd = gup = gback = gfwd = 0
    for f in frames:
        a = np.asarray(Image.open(os.path.join(src, clip, f"{f:04d}.png")).convert("RGBA"))[..., 3]
        for thr, glow in ((SOLID - 1, False), (1, True)):
            ys, xs = np.where(a > thr)
            u, b, w = ay - int(ys.min()), ax - int(xs.min()), int(xs.max()) + 1 - ax
            if glow:
                gup, gback, gfwd = max(gup, u), max(gback, b), max(gfwd, w)
            else:
                up, back, fwd = max(up, u), max(back, b), max(fwd, w)
    return {"up": up, "back": back, "fwd": fwd, "glowUp": gup, "glowBack": gback, "glowFwd": gfwd}


def pack(pictures):
    """the shelf packing (tallest first, SHEET_MAX pages, a 2 px gap): the rule the roam sheets were packed by"""
    gap = 2
    order = sorted(pictures.items(), key=lambda kv: (-kv[1][0].height, kv[0]))
    sheets = []
    cur = {"place": {}, "w": 0, "h": 0}
    x = y = shelf = 0
    for key, (im, _, _) in order:
        if x and x + im.width > SHEET_MAX:
            x = 0
            y += shelf + gap
            shelf = 0
        if y + im.height > SHEET_MAX:
            sheets.append(cur)
            cur = {"place": {}, "w": 0, "h": 0}
            x = y = shelf = 0
        cur["place"][key] = (x, y)
        cur["w"] = max(cur["w"], x + im.width)
        cur["h"] = max(cur["h"], y + im.height)
        x += im.width + gap
        shelf = max(shelf, im.height)
    sheets.append(cur)
    return sheets


def main():
    out_dir = os.path.join(OUT, "reindeer")
    os.makedirs(out_dir, exist_ok=True)
    index = json.load(open(os.path.join(SOURCE, "index.json")))
    k = index["road_px_per_frame_px"]
    spec = {"source": "animation/export_2026-11-11/reindeer (rig reindeer-rig, 2026-11-11)", "fps": 30, "roadPxPerFramePx": k, "clips": {}, "tiers": {}}
    manifests = {}
    cindex = json.load(open(os.path.join(CHARGE_SOURCE, "index.json")))
    if abs(cindex["road_px_per_frame_px"] - k) > 1e-9:
        sys.exit(f"build_roam: the charge export's road_px_per_frame_px {cindex['road_px_per_frame_px']} is not the roam's {k}")
    groups = (("roam", SOURCE, CLIPS), ("charge", CHARGE_SOURCE, CHARGE_CLIPS))
    for _, src, clips in groups:
        for name, (clip, frames) in clips.items():
            m = json.load(open(os.path.join(src, f"{clip}.json")))
            manifests[name] = m
            c = {"source": clip, "frames": frames, "rigFrames": m["frames"], "loop": bool(m.get("loop")), "frameW": m["frame_w"], "frameH": m["frame_h"], "anchorX": m["anchor_px"][0], "anchorY": m["anchor_px"][1]}
            if "ground_speed_frame_px_per_frame" in m:
                c["groundSpeed"] = m["ground_speed_frame_px_per_frame"]
            if "advance_frame_px" in m:
                c["advance"] = [round(v, 4) for v in m["advance_frame_px"]]
            # the charge clips: the nose and the near front hoof per frame (frame px from the anchor, x the way he faces,
            # y down) and the rig's beats
            if "nose" in m:
                c["nose"] = [[round(v, 2) for v in q] for q in m["nose"]]
            if "hoof_fr" in m:
                c["hoof"] = [[round(v, 2) for v in q] for q in m["hoof_fr"]]
            if "beats" in m:
                c["beats"] = m["beats"]
            if src == CHARGE_SOURCE:
                c["reach"] = ink_reach(src, clip, frames, m)
            if len(frames) != len(set(frames)) or (src == CHARGE_SOURCE and frames != list(range(1, m["frames"] + 1))):
                sys.exit(f"build_roam: {clip} must pack every frame, 1 to {m['frames']}")
            spec["clips"][name] = c
    fx = json.load(open(os.path.join(CHARGE_SOURCE, "fx.json")))
    spec["fx"] = {
        "source": "animation/export_2026-11-20_charge/reindeer/fx.json (rig reindeer-rig, 2026-11-20)",
        "puff": {kk: v for kk, v in fx["puff"].items() if kk not in ("start", "carry", "sprite")},
        "snow": {kk: v for kk, v in fx["snow"].items() if kk not in ("start", "rule", "sprite", "vx_frame_px_per_ms", "vy_frame_px_per_ms")},
        "runNose": [[round(v, 2) for v in q] for q in fx["run_nose"]],
    }
    # (the snow's speeds are written in the export as text: "-(0.14..0.62) x power"; read the two numbers out of it)
    for axis in ("vx", "vy"):
        text = fx["snow"][f"{axis}_frame_px_per_ms"]
        lo, hi = (float(v) for v in re.search(r"\(([0-9.]+)\.\.([0-9.]+)\)", text).groups())
        spec["fx"]["snow"][f"{axis}_frame_px_per_ms"] = [-hi, -lo]
    tau = re.search(r"tau ([0-9.]+) ms", fx["puff"]["carry"])
    spec["fx"]["puff"]["carry_tau_ms"] = float(tau.group(1))
    # (drawn FX_DRAW times the export's size: its radius numbers stay the export's, the game multiplies)
    spec["fx"]["puff"]["drawScale"] = FX_DRAW["puff"]
    spec["fx"]["snow"]["drawScale"] = FX_DRAW["snow"]
    for name in ("puff", "snow"):
        spec["fx"][name]["alphaByLook"] = FX_ALPHA[name]
        spec["fx"][name]["minCss"] = FX_MIN_CSS[name]
        spec["fx"][name]["hold"] = FX_HOLD
    full = {}
    for name in ("puff", "snow"):
        src_im = Image.open(os.path.join(CHARGE_SOURCE, fx[name]["sprite"])).convert("RGBA")
        full[(name, "light")] = readable_fx(name, src_im)
        full[(name, "dark")] = readable_fx_dark(name, src_im)
    spec["fx"]["grounds"] = ground_looks(full)
    print("  fx looks by ground:", spec["fx"]["grounds"])
    spec["fx"]["puff"]["offset_frame_px"] = [float(v) for v in re.search(r"\+ \(([0-9.]+)\*i, ([0-9.]+)\*i\)", fx["puff"]["start"]).groups()]
    FX = {"puff": (os.path.join(CHARGE_SOURCE, fx["puff"]["sprite"]), fx["puff"]["sprite_diameter_frame_px_at_full"]), "snow": (os.path.join(CHARGE_SOURCE, fx["snow"]["sprite"]), fx["snow"]["sprite_diameter_frame_px_at_full"])}
    for tier in ("full", "phone"):
        d = 3 * CSS_PER_ROAD[tier] * DRAW_SCALE[tier] * k
        files = []
        frames_out = {}
        boxes = {}
        fx_out = {}
        for group, src, clips in groups:
            pictures = {}
            for name, (clip, frames) in clips.items():
                m = manifests[name]
                bw, bh = round(m["frame_w"] * d), round(m["frame_h"] * d)
                boxes[name] = (bw, bh)
                for f in frames:
                    im = Image.open(os.path.join(src, clip, f"{f:04d}.png")).convert("RGBA")
                    if im.size != (m["frame_w"], m["frame_h"]):
                        sys.exit(f"build_roam: {clip} frame {f} is {im.size}, the manifest says {m['frame_w']} x {m['frame_h']}")
                    small = resize_box(im, bw, bh)
                    a = np.asarray(small)[..., 3]
                    ys, xs = np.where(a > 1)
                    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
                    pictures[(name, f)] = (small.crop((x0, y0, x1, y1)), x0, y0)
            if group == "charge":
                # the effect sprites, whole (a round puff, a round speck), at their largest draw at this density
                for name, (file, diameter) in FX.items():
                    src_im = Image.open(file).convert("RGBA")
                    side = max(2, round(diameter * FX_DRAW[name] * d), FX_MIN_TEX[name])
                    for look, make in (("light", readable_fx), ("dark", readable_fx_dark)):
                        pictures[("fx", name if look == "light" else name + "Dark")] = (resize_box(make(name, src_im), side, side), 0, 0)
                    for c in CANDIDATES:
                        pictures[("fx", name + c)] = (resize_box(candidate_fx(name, c, src_im), side, side), 0, 0)
            n0 = len(files)
            sheets = pack(pictures)
            for n, sh in enumerate(sheets):
                page = Image.new("RGBA", (sh["w"], sh["h"]), (0, 0, 0, 0))
                for key, (px, py) in sh["place"].items():
                    im, ox, oy = pictures[key]
                    page.paste(im, (px, py))
                    name, f = key
                    if name == "fx":
                        base = "puff" if f.startswith("puff") else "snow"
                        fx_out[f] = {"sheet": n0 + n, "x": px, "y": py, "w": im.width, "h": im.height, "diameterFramePx": FX[base][1] * FX_DRAW[base]}
                        continue
                    frames_out.setdefault(name, {})[str(f)] = {"sheet": n0 + n, "x": px, "y": py, "w": im.width, "h": im.height, "ox": ox, "oy": oy}
                prefix = SHEET_PREFIX if group == "roam" else CHARGE_PREFIX
                fname = f"{prefix}-{tier}-{n}.webp"
                path = os.path.join(out_dir, fname)
                page.save(path, **WEBP)
                files.append({"file": f"reindeer/{fname}", "width": sh["w"], "height": sh["h"], "group": group})
                print(f"  roam {fname}: {sh['w']} x {sh['h']}, {len(sh['place'])} pictures, {os.path.getsize(path) // 1024} KB")
        gpu = {g: round(sum(f["width"] * f["height"] * 4 for f in files if f["group"] == g) / 1048576, 1) for g, _, _ in groups}
        kb = {g: sum(os.path.getsize(os.path.join(OUT, f["file"])) for f in files if f["group"] == g) // 1024 for g, _, _ in groups}
        spec["tiers"][tier] = {"density": round(d, 4), "boxes": {nm: {"w": b[0], "h": b[1]} for nm, b in boxes.items()}, "sheets": files, "frames": frames_out, "fx": fx_out, "gpuMb": gpu["roam"], "chargeGpuMb": gpu["charge"], "chargeKb": kb["charge"]}
        print(f"  roam {tier}: {len(files)} sheets, {gpu} MB on the GPU (no mip chain), download {kb} KB")
    path = os.path.join(APP, "src", "game", "reindeerRoamSpec.ts")
    with open(path, "w") as fh:
        fh.write("// AUTO-GENERATED by tools/build_roam.py from the rig's exports (walk, walk start, walk stop, sniff; the charge wind-up and its\n")
        fh.write("// effects). Do not edit: change the\n")
        fh.write("// tool and run it again. Frame px are the rig's 1536 render; sheet px are this tier's pages; road px = frame px x roadPxPerFramePx.\n")
        fh.write(f"export const REINDEER_ROAM = {json.dumps(spec, indent=chr(9))} as const;\n")
    print(f"  wrote {os.path.relpath(path, APP)}")


if __name__ == "__main__":
    main()
