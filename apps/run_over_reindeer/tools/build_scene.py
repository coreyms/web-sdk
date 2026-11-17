"""THE SCENE'S TEXTURES (scene pass 9, 2026-11-16): the snow scene kit, the upright phones' forest and the yellow billboard
logo, converted for the game. Pixel work only (crops, alpha masks, resampling); nothing is generated or repainted here.

It only READS these sources (never changes them):
  ~/Desktop/Run Over Reindeer/snow_scene_kit_r1_2026-11-16/pieces/   field_tile, band_top, band_bottom, end_left, end_right
                                                                       (their road px places: pieces/placements.json)
  ~/Desktop/Run Over Reindeer/treeline_r2_2026-11-16/forest_A.png     the evergreen forest, candidate A (1330 x 1024)
  ~/Desktop/Run Over Reindeer/billboard_logo_r2_2026-11-15/           logo_billboard_clean.png (the LOCKED sign, haze
                                                                       removed, every pixel of alpha 9 or more as locked)
                                                                       and logo_billboard_lamps_off.png (the same picture
                                                                       with the amber glass of both lamps darkened by a
                                                                       plain multiply; checked here: nothing else differs)
and writes inside this app:
  static/assets/scene/snow-day-*.webp   the kit's pieces and the forest (lossy WebP like road.webp; alpha kept exact)
  static/assets/scene/logo-sign.webp    one sheet: the sign with its lamps dark, each lamp's lit glass as a patch, one
  static/assets/scene/logo-sign-phone.webp   soft glow disc (the phone tier's twin is the same sheet, smaller)
  src/game/sceneArtSpec.ts              (generated) every piece's file, size and road px place; the sign's frames

The ends ship at their source density (1.41 px per road px, Corey's approval 2026-11-16), trimmed to their alpha box.

THE NIGHT KITS (scene swap, 2026-11-17): the Free Spins and Super Free Spins night snow, built the same way, read only:
  ~/Desktop/Run Over Reindeer/scene_kit_snow_bonus_S2_r2_2026-11-16/pieces/   (preset snowNight, files scene/snow-night-*)
  ~/Desktop/Run Over Reindeer/scene_kit_snow_super_S1_r2_2026-11-16/pieces/   (preset snowSuper, files scene/snow-super-*)
Each has the day kit's pieces (field tile, bands, ends: same sizes, same alpha, same road px places, checked here) and three
more: its own road picture (the day picture re-coloured: q92 like road/road.webp), its two portal strips (lossless with the
day strips' exact alpha, like road/tunnel-*.webp) and its upright phone forest (q80 like the day forest). Nothing in them is
repainted here: crops and format only.
Run with the math env's Python (Pillow, numpy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_scene.py
"""
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "static", "assets", "scene")
SPEC = os.path.join(APP, "src", "game", "sceneArtSpec.ts")
DESK = os.path.expanduser("~/Desktop/Run Over Reindeer")
KIT = os.path.join(DESK, "snow_scene_kit_r1_2026-11-16", "pieces")
FOREST = os.path.join(DESK, "treeline_r2_2026-11-16", "forest_A.png")
LOGO = os.path.join(DESK, "billboard_logo_r2_2026-11-15")
# the night kits: preset name -> (kit folder, file prefix)
NIGHT_KITS = {
    "snowNight": (os.path.join(DESK, "scene_kit_snow_bonus_S2_r2_2026-11-16", "pieces"), "snow-night"),
    "snowSuper": (os.path.join(DESK, "scene_kit_snow_super_S1_r2_2026-11-16", "pieces"), "snow-super"),
}
ROAD_DIR = os.path.join(APP, "static", "assets", "road")

OPAQUE = dict(quality=92, method=6)  # as road.webp (tools/build_assets.py)
ALPHA = dict(quality=90, alpha_quality=100, method=6)  # lossy color, exact alpha
SIGN = dict(quality=92, alpha_quality=100, method=6)
# the forest is busy everywhere (needles, ink, snow glimpses): q80 is the same to the eye at 3x and a third smaller than q90
FOREST_OPTS = dict(quality=80, alpha_quality=100, method=6)
# the sign's phone twin: 440 px wide covers its largest phone draw (about 141 CSS px) at 3 px per CSS px
SIGN_PHONE_W = 440
PAD = 4  # sheet px between frames


def premul_resize(rgba, size):
    """resize RGBA without dark fringes: premultiplied, Lanczos per channel"""
    a = rgba[..., 3:4].astype(np.float32) / 255.0
    rgb = rgba[..., :3].astype(np.float32) * a
    chans = [np.asarray(Image.fromarray(rgb[..., i]).resize(size, Image.LANCZOS)) for i in range(3)]
    al = np.asarray(Image.fromarray(a[..., 0]).resize(size, Image.LANCZOS))
    al = np.clip(al, 0, 1)
    out = np.zeros((size[1], size[0], 4), np.float32)
    safe = np.maximum(al, 1e-6)
    for i in range(3):
        out[..., i] = np.where(al > 1e-4, np.clip(chans[i], 0, None) / safe, 0)
    out[..., 3] = al * 255
    return np.clip(out.round(), 0, 255).astype(np.uint8)


def alpha_box(rgba):
    ys, xs = np.nonzero(rgba[..., 3] > 0)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def save(img, name, opts):
    path = os.path.join(OUT, name)
    img.save(path, **opts)
    return os.path.getsize(path)


def build_kit():
    place = json.load(open(os.path.join(KIT, "placements.json")))["pieces"]
    pieces = {}
    field = Image.open(os.path.join(KIT, "field_tile.png")).convert("RGB")
    pieces["field"] = {"file": "scene/snow-day-field.webp", "px": list(field.size), "road": [0, 0, field.size[0], field.size[1]], "bytes": save(field, "snow-day-field.webp", OPAQUE)}
    for key, src, y in (("bandTop", "band_top.png", 0), ("bandBottom", "band_bottom.png", 948)):
        im = Image.open(os.path.join(KIT, src)).convert("RGBA")
        name = f"snow-day-{'band-top' if key == 'bandTop' else 'band-bottom'}.webp"
        pieces[key] = {"file": f"scene/{name}", "px": list(im.size), "road": [0, y, im.size[0], im.size[1]], "bytes": save(im, name, ALPHA)}
    for key, src in (("endLeft", "end_left.png"), ("endRight", "end_right.png")):
        p = place[src]
        im = np.asarray(Image.open(os.path.join(KIT, src)).convert("RGBA"))
        x0, y0, x1, y1 = alpha_box(im)
        k = 727.0 / im.shape[1]  # road px per px: the piece is drawn 727 x 1090 road px
        ox, oy = (-567, -15) if key == "endLeft" else (1376, -15)
        crop = Image.fromarray(im[y0:y1, x0:x1].copy(), "RGBA")
        name = f"snow-day-{'end-left' if key == 'endLeft' else 'end-right'}.webp"
        pieces[key] = {
            "file": f"scene/{name}",
            "px": [x1 - x0, y1 - y0],
            "road": [round(ox + x0 * k, 2), round(oy + y0 * k, 2), round((x1 - x0) * k, 2), round((y1 - y0) * k, 2)],
            "density": round(1 / k, 4),
            "bytes": save(crop, name, ALPHA),
        }
        assert p["alpha_box_px"] == [x0, y0, x1, y1], (src, p["alpha_box_px"], (x0, y0, x1, y1))
    forest = Image.open(FOREST).convert("RGBA")
    # its road size is set by the layout (full width, game/scenePresets.ts); here only its pixels and aspect
    pieces["forest"] = {"file": "scene/snow-day-forest.webp", "px": list(forest.size), "aspect": round(forest.size[1] / forest.size[0], 5), "bytes": save(forest, "snow-day-forest.webp", FOREST_OPTS)}
    return pieces


def build_night(day, kit, prefix):
    """one night kit: the day kit's pieces at the day's sizes and places (alpha checked equal), its road picture, its two
    portal strips and its forest"""
    pieces = {}
    field = Image.open(os.path.join(kit, "field_tile.png")).convert("RGB")
    assert list(field.size) == day["field"]["px"], ("field", field.size)
    name = f"{prefix}-field.webp"
    pieces["field"] = {**day["field"], "file": f"scene/{name}", "bytes": save(field, name, OPAQUE)}
    for key, src, tag in (("bandTop", "band_top.png", "band-top"), ("bandBottom", "band_bottom.png", "band-bottom")):
        im = Image.open(os.path.join(kit, src)).convert("RGBA")
        ref = np.asarray(Image.open(os.path.join(KIT, src)).convert("RGBA"))[..., 3]
        assert list(im.size) == day[key]["px"] and np.array_equal(np.asarray(im)[..., 3], ref), (key, "alpha or size differs from the day kit")
        name = f"{prefix}-{tag}.webp"
        pieces[key] = {**day[key], "file": f"scene/{name}", "bytes": save(im, name, ALPHA)}
    for key, src, tag in (("endLeft", "end_left.png", "end-left"), ("endRight", "end_right.png", "end-right")):
        im = np.asarray(Image.open(os.path.join(kit, src)).convert("RGBA"))
        ref = np.asarray(Image.open(os.path.join(KIT, src)).convert("RGBA"))[..., 3]
        assert np.array_equal(im[..., 3], ref), (key, "alpha differs from the day kit")
        x0, y0, x1, y1 = alpha_box(im)
        assert [x1 - x0, y1 - y0] == day[key]["px"], (key, "alpha box differs")
        name = f"{prefix}-{tag}.webp"
        pieces[key] = {**day[key], "file": f"scene/{name}", "bytes": save(Image.fromarray(im[y0:y1, x0:x1].copy(), "RGBA"), name, ALPHA)}
    forest = Image.open(os.path.join(kit, "forest_phone.png")).convert("RGBA")
    assert list(forest.size) == day["forest"]["px"], ("forest", forest.size)
    name = f"{prefix}-forest.webp"
    pieces["forest"] = {**day["forest"], "file": f"scene/{name}", "bytes": save(forest, name, FOREST_OPTS)}
    # the road picture (opaque, as road/road.webp) and the portal strips (lossless, the day strips' exact alpha)
    road = Image.open(os.path.join(kit, "road.png")).convert("RGB")
    assert road.size == (1536, 1024), road.size
    name = f"{prefix}-road.webp"
    road.save(os.path.join(OUT, name), quality=92, method=6)
    pieces["road"] = {"file": f"scene/{name}", "px": list(road.size), "road": [0, 0, 1536, 1024], "bytes": os.path.getsize(os.path.join(OUT, name))}
    for key, side in (("tunnelLeft", "left"), ("tunnelRight", "right")):
        im = np.asarray(Image.open(os.path.join(kit, f"tunnel_{side}.png")).convert("RGBA"))
        ref = np.asarray(Image.open(os.path.join(ROAD_DIR, f"tunnel-{side}.webp")).convert("RGBA"))
        assert im.shape == ref.shape and np.array_equal(im[..., 3], ref[..., 3]), (key, "the strip's alpha differs from road/tunnel-*.webp")
        name = f"{prefix}-tunnel-{side}.webp"
        Image.fromarray(im, "RGBA").save(os.path.join(OUT, name), lossless=True, method=6)
        pieces[key] = {"file": f"scene/{name}", "px": [im.shape[1], im.shape[0]], "bytes": os.path.getsize(os.path.join(OUT, name))}
    return pieces


def build_sign():
    lit = np.asarray(Image.open(os.path.join(LOGO, "logo_billboard_clean.png")).convert("RGBA"))
    dark = np.asarray(Image.open(os.path.join(LOGO, "logo_billboard_lamps_off.png")).convert("RGBA"))
    lamps = json.load(open(os.path.join(LOGO, "lamps.json")))
    assert lit.shape == dark.shape
    assert np.array_equal(lit[..., 3], dark[..., 3]), "the dark copy's alpha must be the sign's own"
    diff = np.any(lit[..., :3] != dark[..., :3], axis=2) & (lit[..., 3] > 0)
    H, W = diff.shape
    frames = {"base": {"x": 0, "y": 0, "width": W, "height": H}}
    patches = []
    covered = np.zeros_like(diff)
    for side in ("left", "right"):
        bx0, by0, bx1, by1 = lamps[side]["lens_bbox"]
        # the globe's side crescent lies left of the lens: search a box grown round the lens
        gx0, gy0, gx1, gy1 = max(0, bx0 - 90), max(0, by0 - 40), min(W, bx1 + 40), min(H, by1 + 40)
        region = np.zeros_like(diff)
        region[gy0:gy1, gx0:gx1] = diff[gy0:gy1, gx0:gx1]
        covered |= region
        ys, xs = np.nonzero(region)
        # the patch: the changed pixels grown by 2 px (those are the same in both pictures, so the patch's edge falls on
        # pixels that do not change: drawn at any strength over the dark base it shows exactly lit or dark glass)
        m = region.copy()
        for _ in range(2):
            g = m.copy()
            g[1:] |= m[:-1]
            g[:-1] |= m[1:]
            g[:, 1:] |= m[:, :-1]
            g[:, :-1] |= m[:, 1:]
            m = g
        x0, y0, x1, y1 = int(xs.min()) - 3, int(ys.min()) - 3, int(xs.max()) + 4, int(ys.max()) + 4
        patch = lit[y0:y1, x0:x1].copy()
        patch[..., 3] = np.where(m[y0:y1, x0:x1], lit[y0:y1, x0:x1, 3], 0)
        patches.append((side, patch, (x0, y0), lamps[side]))
    assert not np.any(diff & ~covered), "the dark copy differs outside the two lamps"
    changed = int(diff.sum())
    # the glow: a soft white disc, its alpha a smooth bell to nothing at its edge (tinted and added in the game)
    G = 192
    yy, xx = np.mgrid[0:G, 0:G].astype(np.float32)
    r = np.hypot(xx - (G - 1) / 2, yy - (G - 1) / 2) / (G / 2)
    ga = np.clip(np.exp(-(r**2) * 3.2) - np.exp(-3.2), 0, None) / (1 - np.exp(-3.2))
    ga[r >= 1] = 0
    glow = np.zeros((G, G, 4), np.uint8)
    glow[..., :3] = 255
    glow[..., 3] = (ga * 255).round().astype(np.uint8)

    # the sheet: the dark sign, then a row under it with the two patches and the glow
    row_h = max(max(p[1].shape[0] for p in patches), G)
    SW, SH = W, H + PAD + row_h
    sheet = np.zeros((SH, SW, 4), np.uint8)
    sheet[:H, :W] = dark
    x = 0
    lamp_spec = {}
    for side, patch, (px, py), L in patches:
        h, w = patch.shape[:2]
        sheet[H + PAD : H + PAD + h, x : x + w] = patch
        frames[f"lamp_{side}"] = {"x": x, "y": H + PAD, "width": w, "height": h}
        lamp_spec[side] = {"patch": [px, py, w, h], "center": L["lens_center"], "radius": L["lens_radius_equal_area"]}
        x += w + PAD
    sheet[H + PAD : H + PAD + G, x : x + G] = glow
    frames["glow"] = {"x": x, "y": H + PAD, "width": G, "height": G}
    assert x + G <= SW
    full = Image.fromarray(sheet, "RGBA")
    full_bytes = save(full, "logo-sign.webp", SIGN)
    k = SIGN_PHONE_W / W
    ph = premul_resize(sheet, (int(round(SW * k)), int(round(SH * k))))
    phone_bytes = save(Image.fromarray(ph, "RGBA"), "logo-sign-phone.webp", SIGN)
    return {
        "source": "~/Desktop/Run Over Reindeer/billboard_logo_r2_2026-11-15/logo_billboard_clean.png (the LOCKED sign) and logo_billboard_lamps_off.png",
        "size": [W, H],
        "aspect": round(H / W, 5),
        "lamps": lamp_spec,
        "changedPixels": changed,
        "frames": frames,
        "tiers": {
            "full": {"file": "scene/logo-sign.webp", "width": SW, "height": SH, "scale": 1, "bytes": full_bytes},
            "phone": {"file": "scene/logo-sign-phone.webp", "width": ph.shape[1], "height": ph.shape[0], "scale": round(k, 6), "bytes": phone_bytes},
        },
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    kit = build_kit()
    sign = build_sign()
    spec = {"units": "road px: pixels of the 1536 x 1024 road picture, (0, 0) its top left corner", "snowDay": kit}
    for preset, (folder, prefix) in NIGHT_KITS.items():
        spec[preset] = build_night(kit, folder, prefix)
        for k, v in spec[preset].items():
            print(f"{preset} {k}: {v['px']} {v['bytes']} bytes")
    spec["logoSign"] = sign
    body = json.dumps(spec, indent="\t")
    with open(SPEC, "w") as f:
        f.write("// AUTO-GENERATED by tools/build_scene.py. Do not edit: change the tool and run it again.\n")
        f.write("// The scene's pieces (the day snow kit and the two night kits, the forests, the night road pictures and portal strips) with their files, pixel sizes and road px places\n")
        f.write("// ([x, y, width, height]), and the billboard logo's sheet (its frames in sheet px, per asset tier).\n")
        f.write(f"export const SCENE_ART = {body} as const;\n")
    for k, v in kit.items():
        print(f"{k}: {v['px']} {v['bytes']} bytes")
    print(f"logo: {sign['tiers']} changed {sign['changedPixels']}")


if __name__ == "__main__":
    main()
