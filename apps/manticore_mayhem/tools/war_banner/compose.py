"""THE WAR STANDARD, GAME BUILD: the game's cloth texture from the rest renders (render_rest.py).

For every texel of the square texture (material u 0 .. W, v TEX_V0 .. TEX_V1) the rest pose's screen position comes from
the sim's own grid (bilinear between its vertices), and the render is sampled there: the texture IS the approved look
of the hung banner (its folds, bump, thread and light), laid back onto the cloth so the game's mesh can carry it.
Each tier's layers are tinted and summed the way the game lights its board frame (cfg_game.LIGHT). Epic adds its
ember glow (the trim, wreath and stitching) and keeps its letters ivory. The alpha is the texture builder's own outline
(the flame cut hem), resampled, never the render's.

python compose.py <D|P> <fs|super|epic> <intro|total>
writes static/assets/ui/banner/banner-<D|P>-<tier>-<content>.webp and _bake/comp/<same>.png + .json (stats)
"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cfg_game import *  # noqa

RENDER_SCALE = {"D": 4.3, "P": 2.2}
RECT = (-300.0, -12.0, 300.0, 600.0)
TEXPX = {"D": 3.5, "P": 2.2}


def rest_grid():
    """the sim's rest pose on its structured grid: X, Y [219 rows (v 0, 3 .. 654), 100 cols (u linspace 0 .. W)], NaN where
    the sim has no vertex (cut away round the hem); then filled outward from the nearest vertex down its column"""
    d = np.load(SIM)
    pos = d["pos"][REST_FRAME]; uv = d["uv"]
    us = np.linspace(0, W, 100); nv = 219
    I = np.rint(uv[:, 0] / (W / 99)).astype(int); J = np.rint(uv[:, 1] / 3.0).astype(int)
    X = np.full((nv, 100), np.nan); Y = np.full((nv, 100), np.nan)
    X[J, I] = pos[:, 0]; Y[J, I] = pos[:, 1]
    # fill holes column by column: extend the last valid vertex straight down (rest direction), then rows from neighbours
    for i in range(100):
        col = ~np.isnan(X[:, i])
        if not col.any(): continue
        last = np.nonzero(col)[0].max()
        for j in range(last + 1, nv):
            X[j, i] = X[last, i]; Y[j, i] = Y[last, i] + 3.0 * (j - last)
    bad = np.isnan(X)
    if bad.any():
        idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
        X = X[tuple(idx)]; Y = Y[tuple(idx)]
    return X, Y


def sample_grid(G, u, v):
    """bilinear on the sim grid at material (u, v) arrays"""
    fi = np.clip(u / (W / 99), 0, 99 - 1e-6); fj = np.clip(v / 3.0, 0, 218 - 1e-6)
    i0 = np.floor(fi).astype(int); j0 = np.floor(fj).astype(int); a = fi - i0; b = fj - j0
    return (G[j0, i0] * (1 - a) * (1 - b) + G[j0, i0 + 1] * a * (1 - b) + G[j0 + 1, i0] * (1 - a) * b + G[j0 + 1, i0 + 1] * a * b)


# the frame plates' own post step (comp.py grade_banner in the mockup, the frame_v6 renders): the Stinger grade on the day
# (D1) and night renders, none on the fire layer
sys.path.insert(0, "/Users/corey/Desktop/Manticore Mayhem/images/board/frame_v6_shapr_2026-11-10/scripts")
from stinger_grade import grade as stinger_grade, GRADE
GRADED = {"D1": True, "night": True, "fire": False}


def load_render(path):
    im = np.asarray(Image.open(path)).astype(np.float32)
    im = im / (65535.0 if im.max() > 255 else 255.0)
    rgb, a = im[..., :3], im[..., 3]
    solid = a > 0.98
    # every pixel takes the colour of the nearest fully covered one (no dark fringe where the dithered cut thins)
    idx = ndimage.distance_transform_edt(~solid, return_distances=False, return_indices=True)
    return rgb[tuple(idx)]


def main(var, tier, content):
    S = TEX_SIZE[var]
    name = f"{var}_{tier}_{content}"
    texb = os.path.join(BAKE, "tex", name)
    iu, iv = np.meshgrid((np.arange(S) + 0.5) / S, (np.arange(S) + 0.5) / S)
    u = iu * W; v = TEX_V0 + iv * (TEX_V1 - TEX_V0)
    X, Y = rest_grid()
    x = sample_grid(X, u, v); y = sample_grid(Y, u, v)
    rs = RENDER_SCALE[var]
    px = (x - RECT[0]) * rs - 0.5; py = (y - RECT[1]) * rs - 0.5
    acc = np.zeros((S, S, 3), np.float32)
    for rig, tint in LIGHT[tier]:
        rgb = load_render(os.path.join(BAKE, "rend", f"{name}_{rig}.png"))
        if GRADED[rig]:
            rgb = np.clip(stinger_grade(np.clip(rgb, 0, 1), GRADE), 0, 1).astype(np.float32)
        for c in range(3):
            acc[..., c] += ndimage.map_coordinates(rgb[..., c], [py, px], order=1, mode="nearest") * tint[c]
    # the builder's own maps in material space (3.5 / 2.2 px per design px from v 0)
    tp = TEXPX[var]
    col = np.asarray(Image.open(texb + "_color.png")).astype(np.float32) / 255
    msk = np.asarray(Image.open(texb + "_mask.png")).astype(np.float32) / 255
    mx, my = u * tp - 0.5, v * tp - 0.5
    alpha = ndimage.map_coordinates(col[..., 3], [my, mx], order=1, mode="nearest")
    T = TIERS[tier]
    letters = ndimage.map_coordinates(msk[..., 1], [my, mx], order=1, mode="nearest")
    if T["glow"] > 0:
        # EPIC: its ember glows on its own light (the trim, wreath and stitches: the mask's glow channel), a soft halo
        # round it, and the letters held ivory (lit by their own glow, not by the braziers: the mockup's read copper)
        glow = ndimage.map_coordinates(msk[..., 2], [my, mx], order=1, mode="nearest")
        alb = np.stack([ndimage.map_coordinates(col[..., c], [my, mx], order=1, mode="nearest") for c in range(3)], -1)
        ember = np.array([1.0, 0.36, 0.10], np.float32)
        halo = ndimage.gaussian_filter(glow, 3.0 * S / 2048)
        acc += (glow * (1 - letters))[..., None] * alb * 0.55 + halo[..., None] * ember * 0.10
        ivory = np.stack([ndimage.map_coordinates(col[..., c], [my, mx], order=1, mode="nearest") for c in range(3)], -1)
        lhalo = ndimage.gaussian_filter(letters, 4.0 * S / 2048)
        acc = acc * (1 - letters[..., None] * 0.85) + ivory * 0.97 * letters[..., None] * 0.85 + (lhalo * (1 - letters))[..., None] * ember * 0.16
    elif tier in LIFT:
        # SUPER (oxblood, gold; 2026-11-15): the gold thread and the cloth lifted by their own albedo under the night rig,
        # the letters held ivory (super_look_r1/_work/build.py, the stills Corey picked)
        lf = LIFT[tier]
        metal = ndimage.map_coordinates(msk[..., 0], [my, mx], order=1, mode="nearest")
        alb = np.stack([ndimage.map_coordinates(col[..., c], [my, mx], order=1, mode="nearest") for c in range(3)], -1)
        acc += (metal * (1 - letters))[..., None] * alb * lf["trim"]
        acc += ((1 - metal) * (1 - letters))[..., None] * alb * lf["cloth"]
        acc = acc * (1 - letters[..., None] * 0.85) + alb * 0.97 * letters[..., None] * 0.85
    acc = np.clip(acc, 0, 1)
    # the live glyphs' tint: what this tier's light makes of the baked letters (their lit colour over their albedo)
    alb_l = np.stack([ndimage.map_coordinates(col[..., c], [my, mx], order=1, mode="nearest") for c in range(3)], -1)
    m = (letters > 0.95) & (alpha > 0.99) & (alb_l.mean(-1) > 0.6)
    ratio = (acc[m].mean(0) / np.maximum(alb_l[m].mean(0), 1e-3)) if m.any() else np.ones(3)
    ratio = np.clip(ratio / max(1.0, ratio.max()), 0, 1)
    out8 = (np.dstack([acc, alpha]) * 255 + 0.5).astype(np.uint8)
    os.makedirs(STATIC, exist_ok=True); os.makedirs(os.path.join(BAKE, "comp"), exist_ok=True)
    im = Image.fromarray(out8, "RGBA")
    im.save(os.path.join(BAKE, "comp", name + ".png"))
    webp = os.path.join(STATIC, f"banner-{var}-{tier}-{content}.webp")
    im.save(webp, "WEBP", quality=90, alpha_quality=100, method=6)
    stats = dict(name=name, size=[S, S], webp_bytes=os.path.getsize(webp), letter_tint=[round(float(c), 4) for c in ratio],
                 gpu_mb=round(S * S * 4 / 2 ** 20, 2), gpu_mb_mips=round(S * S * 4 * 4 / 3 / 2 ** 20, 2))
    json.dump(stats, open(os.path.join(BAKE, "comp", name + ".json"), "w"), indent=1)
    print("COMP", json.dumps(stats))


if __name__ == "__main__":
    main(*sys.argv[1:4])
