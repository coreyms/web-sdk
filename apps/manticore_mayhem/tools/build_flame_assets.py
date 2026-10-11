#!/usr/bin/env python
"""Game assets for THE BRAZIER FLAMES of the landscape courtyard scene (game/flames.ts, drawn by game/scene.ts; constants
FLAMES). A sibling of build_scene_assets.py: run it AFTER that tool, it reads the foreground and fire pass files that
tool shipped.

  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/build_flame_assets.py DROP [--scene DIR] [--out DIR]
  node scripts/stamp-assets.mjs          (afterwards, from the app folder)

DROP (read only, never written) is the flame agent's delivery, for example
/Volumes/manticore/rig-review/2026-10-11/flames-drop-1 :
  meta.json                 per clip: frames, fps, canvas, anchor (canvas px from the top-left), draw_scale
  <clip>/frame_NNNN.png     the loose frames, the whole canvas, straight alpha, from 0001
  <clip>.json / .png        the delivery's own atlas: NOT used (repacked here, tighter, per tier)
--scene (read only; default the folder SCENE_SPEC.source names under .../scene_blockout/lookdev): day_base_<W>.png and
night_base_<W>.png, the foreground the bowls are in. Only the RIM LINE is measured from them.

Outputs, two tiers like the scene's (full = the frame's own size, phone = PHONE_WIDTH wide):
  static/assets/backgrounds/scene/flame-<base|super|epic>[-phone].json|webp   one atlas per clip, frames
                                                                              flame_<clip>_<NNN> from 000, trimmed on
                                                                              alpha 0 with sourceSize kept (the canvas)
  static/assets/backgrounds/scene/flame-fx[-phone].json|webp                  the RIM OCCLUDERS and the ember dot:
                                                                              flame_rim_<L|R>_<day|night> (the bowl's
                                                                              rim and body in front of the flame, cut
                                                                              from the SHIPPED foreground), flame_rimfire_
                                                                              <L|R> (the SHIPPED fire pass over the same
                                                                              cut, on its own texels, on black, for the
                                                                              additive blend),
                                                                              flame_ember (a soft white dot)
  src/game/flameSpec.ts                                                       the bowls, the rim line, each clip's canvas,
                                                                              anchor, frames and texture, the cuts' boxes

THE RIM LINE (rim_line below). The camera is level with the bowls, so a bowl's opening is not seen: its rim is one line,
the top silhouette of the rim slab, and the flame comes up from behind it. Per bowl that line is measured from the
foreground SOURCE: where open sky is behind the rim, the alpha edge, to a fraction of a pixel; where the wall is behind
it (the outer part of each rim), the first row that leaves the flat wall above it, the same in the day and the night
render. A tilted half ellipse is fitted through both (the rim is a level circle seen off the camera's axis), outliers
dropped, the sky side weighted double. The bowl's centre is the middle of the rim slab's ends.
THE CUT. Everything of a flame under that line is inside the bowl, so the occluder is simply the foreground again from
the line down, RIM_DEPTH px, over the rim's span: drawn over the flame it hides the flame's base behind the rim and the bead
band. Each flame frame is cut off TUCK px under its anchor (see TUCK), so no part of a flame reaches under the slab to
where the bowl narrows. A cut pixel has the foreground's own opacity; under the rim's top outline only the foreground's
solid and all but solid pixels are taken (a half transparent pixel of the bowl's side outline, drawn a second time
over itself, would harden that outline). Above the line the cut is empty (RIM_LIFT px of safety,
feathered over one px), so nothing behind the bowl ever covers a flame.

CHECKS printed: the fit's residuals; per clip how far its frames reach under the anchor against RIM_DEPTH; that no flame
pixel under the line lies over a foreground pixel that is not solid (it would show beside the bowl); every file's size
and its GPU memory.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(APP, 'static', 'assets', 'backgrounds', 'scene')
SPEC = os.path.join(APP, 'src', 'game', 'flameSpec.ts')
SCENE_SPEC = os.path.join(APP, 'src', 'game', 'sceneSpec.ts')
LOOKDEV = os.path.expanduser('~/Desktop/Manticore Mayhem/images/backgrounds/base/drafts/scene_blockout/lookdev')

PHONE_WIDTH = 1600  # build_scene_assets.py PHONE_WIDTH
FIRE_SHARE = 0.5  # build_scene_assets.py FIRE_SHARE: the shipped fire pass is half the foreground's size
CLIPS = ('base', 'super', 'epic')
SIDES = ('L', 'R')
SETS = ('day', 'night')
Q_FLAME = 90
MAX_SHEET = 4096
PAD = 2  # transparent px round every frame in a sheet
# each bowl's rim slab in the frame (px): its two ends, read once from the foreground. The INNER end (toward the board)
# has open sky beyond it and is an alpha edge, which the tool checks to RIM_END_TOL px (the end is rounded); the OUTER end has the wall
# behind it and was read off the art at 4x (338.5 on the left, its mirror on the right). The centre is their middle.
BOWLS = {'L': (338.5, 696.0), 'R': (1864.0, 2221.5)}
RIM_END_TOL = 2.5
RIM_ROWS = (700, 740)  # the rows the rim's top edge is looked for in
SLAB_ROWS = (738, 744)  # rows through the rim slab's face, where the inner end is checked
# the cut reaches this far under the rim line at the bowl's centre: the TUCK and half as much again (room for a larger
# draw scale in the game's constants; tools/manticore/flame_probe.js holds the two together). No deeper: nothing of a
# flame is down there, and the cut would only draw the bowl's side outline a second time.
RIM_DEPTH = 30
# THE TUCK: how much of a flame is kept under its anchor row, px of the scene's frame at the delivery's draw scale. The
# delivery's art runs about 10% of its height under the anchor (61 px for the epic clip at 1.2), which is deeper than
# the rim slab and its bead band are tall: down there the bowl narrows, and a wide flame's lower corners came out from
# behind the bowl's own outline (seen by tools/manticore/flame_probe.js RIM on the epic clip: a few half transparent
# pixels beside the bowl, 50 px under the rim). Nothing under the rim line is ever meant to be seen, so each frame is cut
# off TUCK px under the anchor: inside the rim slab at every column the flame reaches.
TUCK = 20
RIM_LIFT = 0.5  # the cut starts this far ABOVE the fitted line (never a sliver of rim in front of nothing)
RIM_FEATHER = 1.0
OUTLINE_BAND = 3.0  # px under the fitted line that count as the rim's top outline (see WHICH PIXELS)
NEAR_SOLID = 240  # of 255: under the outline band a foreground pixel this opaque or more is taken into the cut
EMBER_PX = 32  # the ember dot's cell at the full tier
SIDE_MARGIN = 2


def die(msg: str):
    sys.exit(f'build_flame_assets: {msg}')


def save_webp(im: Image.Image, name: str, quality: int, **kw) -> int:
    path = os.path.join(OUT, name)
    im.save(path, 'WEBP', quality=quality, method=6, **kw)
    return os.path.getsize(path)


def scene_spec() -> dict:
    text = open(SCENE_SPEC).read()
    mark = 'export const SCENE_SPEC = '
    body = text[text.index(mark) + len(mark):]
    return json.loads(body[:body.index(' as const;')])


# ---- the rim line ------------------------------------------------------------------------------------------------------
def rim_model(x: np.ndarray, c: float, a: float, p) -> np.ndarray:
    u = np.clip((np.asarray(x, float) - c) / a, -0.999, 0.999)
    return p[0] + p[1] * (x - c) + p[2] * (1 - np.sqrt(1 - u * u)) + p[3] * u ** 4


def rim_line(fore: dict, side: str) -> dict:
    """one bowl's rim: its centre, half width and the fitted top edge (see THE RIM LINE above)"""
    y0, y1 = RIM_ROWS
    alpha = fore['day'][..., 3]
    lum = {st: fore[st][..., :3] @ [0.299, 0.587, 0.114] for st in SETS}
    x0, x1 = BOWLS[side]
    c, a = (x0 + x1) / 2, (x1 - x0) / 2
    # the inner end against the alpha: the slab's face is opaque up to it and open sky is beyond
    face = alpha[SLAB_ROWS[0]:SLAB_ROWS[1]].min(0) > 128
    inner = x1 if side == 'L' else x0
    run = int(round(c))
    step = 1 if side == 'L' else -1
    while face[run + step]:
        run += step
    found = run + 1 if side == 'L' else run
    if abs(found - inner) > RIM_END_TOL:
        die(f'bowl {side}: the rim slab\'s inner end is at x {found} in the foreground, BOWLS says {inner}')
    pts = []
    for x in range(int(np.ceil(c - a)) + 4, int(np.floor(c + a)) - 3):
        col = alpha[y0:y1, x]
        if col[:6].max() < 8:  # open sky above the rim
            r = int(np.argmax(col >= 128))
            if 4 < r < y1 - y0 - 2:
                pts.append((x, y0 + r - col[r - 1] / 255.0, 1.0))
        elif col[:10].min() > 250:  # the wall behind it
            rows = []
            for st, thr in (('day', 6.0), ('night', 2.5)):
                v = lum[st][y0:y1, x - 2:x + 3].mean(1)
                dev = np.abs(v - np.median(v[:10])) > thr
                both = dev[:-2] & dev[1:-1] & dev[2:]
                if both.any():
                    rows.append(int(np.argmax(both)) + y0)
            if len(rows) == 2 and abs(rows[0] - rows[1]) <= 2:
                pts.append((x, sum(rows) / 2, 0.5))
    if len(pts) < 150:
        die(f'bowl {side}: only {len(pts)} columns of rim found: check BOWLS / RIM_ROWS')
    x = np.array([p[0] for p in pts], float)
    y = np.array([p[1] for p in pts])
    w = np.array([p[2] for p in pts])
    u = np.clip((x - c) / a, -0.999, 0.999)
    m = np.stack([np.ones_like(x), x - c, 1 - np.sqrt(1 - u * u), u ** 4], 1)
    keep = np.ones(len(x), bool)
    for _ in range(6):
        p, *_ = np.linalg.lstsq(m[keep] * w[keep, None], y[keep] * w[keep], rcond=None)
        res = y - m @ p
        keep = np.abs(res) < np.where(w == 1, 1.0, 2.0)
    sky, wall = keep & (w == 1), keep & (w < 1)
    print(f'  bowl {side}: centre x {c:.2f}, half width {a:.2f} (inner end found at {found}), rim line at the centre y {p[0]:.2f}; '
          f'{int(sky.sum())} sky columns (rms {np.sqrt((res[sky] ** 2).mean()):.2f} px), {int(wall.sum())} wall columns (rms {np.sqrt((res[wall] ** 2).mean()) if wall.any() else 0:.2f} px), '
          f'{int((~keep).sum())} dropped; tilt {p[1] * 100:.2f} px per 100 px; the line at -150 / -75 / 0 / +75 / +150 px: '
          + ' / '.join(f'{v:.1f}' for v in rim_model(c + np.array([-150.0, -75, 0, 75, 150]), c, a, p)))
    return {'c': float(c), 'a': float(a), 'p': [float(v) for v in p]}


# ---- the flame atlases -------------------------------------------------------------------------------------------------
def shelf_pack(sizes: list[tuple[int, int]], width: int) -> tuple[list[tuple[int, int]], int, int]:
    """shelves, tallest first: positions, the sheet's width and height"""
    order = sorted(range(len(sizes)), key=lambda k: (-sizes[k][1], -sizes[k][0]))
    pos: list[tuple[int, int]] = [(0, 0)] * len(sizes)
    x = y = shelf = used = 0
    for i in order:
        w, h = sizes[i]
        if x + w > width:
            x, y, shelf = 0, y + shelf, 0
        pos[i] = (x, y)
        x += w
        shelf = max(shelf, h)
        used = max(used, x)
    return pos, used, y + shelf


def pack(sizes: list[tuple[int, int]]) -> tuple[list[tuple[int, int]], int, int]:
    """the smallest sheet under MAX_SHEET a side, by area, over a sweep of widths"""
    best = None
    for width in range(max(w for w, _ in sizes), MAX_SHEET + 1, 8):
        pos, aw, ah = shelf_pack(sizes, width)
        if ah <= MAX_SHEET and (best is None or aw * ah < best[1] * best[2]):
            best = (pos, aw, ah)
    if best is None:
        die('a flame clip does not fit one sheet under 4096: split it')
    return best


def build_clip(drop: str, clip: str, meta: dict, s: float, suffix: str) -> tuple[dict, tuple, np.ndarray]:
    """one clip at one tier: the atlas, its spec entry, its report row, and the union of every frame's alpha on the
    full size canvas (for the checks)"""
    cw, ch = meta['canvas']
    size = (round(cw * s), round(ch * s))
    if abs(size[0] - cw * s) > 1e-6 or abs(size[1] - ch * s) > 1e-6:
        print(f'  NOTE flame_{clip}{suffix}: the canvas {cw} x {ch} is not whole px at this tier ({cw * s} x {ch * s})')
    cells, boxes = [], []
    union = np.zeros((ch, cw), np.uint8)
    for n in range(1, meta['frames'] + 1):
        path = os.path.join(drop, f'flame_{clip}', f'frame_{n:04d}.png')
        if not os.path.isfile(path):
            die(f'{path} is missing')
        im = Image.open(path).convert('RGBA')
        if im.size != (cw, ch):
            die(f'{path} is {im.size}, meta.json says {(cw, ch)}')
        # THE TUCK: nothing kept deeper than TUCK frame px under the anchor row at the delivery's draw scale
        keep = int(round(meta['anchor'][1] + TUCK / float(meta['draw_scale'])))
        if keep < ch:
            px = np.asarray(im).copy()
            px[keep:, :, 3] = 0
            im = Image.fromarray(px, 'RGBA')
        np.maximum(union, np.asarray(im)[..., 3], out=union)
        if s != 1:
            im = im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
        a = np.asarray(im)[..., 3]
        ys, xs = np.nonzero(a)
        box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        boxes.append(box)
        cells.append(im.crop(box))
    pos, aw, ah = pack([(c.size[0] + PAD, c.size[1] + PAD) for c in cells])
    atlas = Image.new('RGBA', (aw, ah), (0, 0, 0, 0))
    frames = {}
    for n, (cell, box, (px, py)) in enumerate(zip(cells, boxes, pos)):
        atlas.paste(cell, (px, py))
        w, h = cell.size
        frames[f'flame_{clip}_{n:03d}'] = {'frame': {'x': px, 'y': py, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                                           'spriteSourceSize': {'x': box[0], 'y': box[1], 'w': w, 'h': h}, 'sourceSize': {'w': size[0], 'h': size[1]}}
    image = f'flame-{clip}{suffix}.webp'
    nbytes = save_webp(atlas, image, Q_FLAME, alpha_quality=100)
    meta_out = {'image': image, 'format': 'RGBA8888', 'size': {'w': aw, 'h': ah}, 'scale': '1',
                'pngHash': hashlib.md5(open(os.path.join(OUT, image), 'rb').read()).hexdigest()[:8]}
    jpath = os.path.join(OUT, f'flame-{clip}{suffix}.json')
    open(jpath, 'w').write(json.dumps({'frames': frames, 'meta': meta_out}, indent=1) + '\n')
    # what the encoder did to it: the shipped sheet against the one handed over, premultiplied
    got = np.asarray(Image.open(os.path.join(OUT, image)).convert('RGBa')).astype(np.float64)
    err = np.abs(got - np.asarray(atlas.convert('RGBa')).astype(np.float64))
    print(f'  {image}: {len(cells)} frames, sheet {aw} x {ah} ({sum(c.size[0] * c.size[1] for c in cells) / (aw * ah) * 100:.0f}% used), '
          f'{nbytes / 1024:.0f} KiB; against the frames handed over a mean of {err.mean():.2f} of 255, worst {err.max():.0f}')
    return {'sheet': [aw, ah], 'canvas': list(size)}, (f'flame-{clip}{suffix}.json + .webp', nbytes + os.path.getsize(jpath), aw, ah), union


def main():
    global OUT
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('drop', help='the flame delivery folder (meta.json, <clip>/frame_NNNN.png)')
    ap.add_argument('--scene', default=None, help='the landscape scene folder with day_base_<W>.png and night_base_<W>.png')
    ap.add_argument('--out', default=None, help='write the files here instead of static/assets/backgrounds/scene (a dry run: the spec is then not written)')
    ap.add_argument('--check', default=None, help='a folder for the rim check images (the cut over magenta, 4x)')
    args = ap.parse_args()
    drop = os.path.abspath(os.path.expanduser(args.drop))
    shipped = OUT
    if args.out:
        OUT = os.path.abspath(os.path.expanduser(args.out))
    os.makedirs(OUT, exist_ok=True)
    scene = scene_spec()
    FW, FH = scene['frame']
    src = os.path.abspath(os.path.expanduser(args.scene)) if args.scene else os.path.join(LOOKDEV, scene['source'])
    meta = json.load(open(os.path.join(drop, 'meta.json')))['clips']
    for clip in CLIPS:
        if f'flame_{clip}' not in meta:
            die(f'meta.json has no flame_{clip}')
    print(f'drop {drop}\nscene {src}\nframe {FW} x {FH}')

    # ---- the rim line, from the foreground source ----------------------------------------------------------------------
    fore_src = {}
    for st in SETS:
        path = os.path.join(src, f'{st}_base_{FW}.png')
        if not os.path.isfile(path):
            die(f'{path} not found')
        fore_src[st] = np.asarray(Image.open(path).convert('RGBA')).astype(np.float64)
    rims = {side: rim_line(fore_src, side) for side in SIDES}
    mirror = abs(rims['L']['c'] + rims['R']['c'] - FW)
    print(f'  the two bowls mirror each other about the frame\'s middle within {mirror:.2f} px')

    tiers = {'full': FW, 'phone': PHONE_WIDTH}
    spec = {
        'source': os.path.basename(drop),
        'scene': scene['source'],
        'frame': [FW, FH],
        # per bowl: its centre, and the rim line's height there (the flame's anchor goes on this point)
        'bowls': {side: [round(rims[side]['c'], 2), round(float(rim_model(np.array([rims[side]['c']]), rims[side]['c'], rims[side]['a'], rims[side]['p'])[0]), 2)] for side in SIDES},
        # the rim line: y(x) = p0 + p1 (x - c) + p2 (1 - sqrt(1 - u^2)) + p3 u^4, u = (x - c) / a
        'rim': {side: {'c': round(rims[side]['c'], 2), 'a': round(rims[side]['a'], 2), 'p': [round(v, 5) for v in rims[side]['p']]} for side in SIDES},
        'rimDepth': RIM_DEPTH,
        'clips': {},
        'ember': EMBER_PX,
        'tiers': {},
    }
    report: list[tuple[str, int, int, int]] = []
    unions = {}
    for tier, width in tiers.items():
        s = width / FW
        suffix = '' if tier == 'full' else f'-{tier}'
        tier_spec = {'clips': {}, 'boxes': {}, 'fireBoxes': {}}
        for clip in CLIPS:
            entry, row, union = build_clip(drop, clip, meta[f'flame_{clip}'], s, suffix)
            tier_spec['clips'][clip] = entry
            report.append(row)
            unions[clip] = union

        # ---- the rim occluders and the ember dot: one small atlas ------------------------------------------------------
        size = (width, round(FH * s))
        fore = {st: Image.open(os.path.join(shipped, f'fore-{st}{suffix}.webp')).convert('RGBA') for st in SETS}
        for st in SETS:
            if fore[st].size != size:
                die(f'fore-{st}{suffix}.webp is {fore[st].size}, expected {size}: run build_scene_assets.py first')
        fire = Image.open(os.path.join(shipped, f'fire{suffix}.webp')).convert('RGB')
        cells: dict[str, Image.Image] = {}
        for side in SIDES:
            r = rims[side]
            line = lambda x: rim_model(x, r['c'], r['a'], r['p'])
            fx0, fx1 = r['c'] - r['a'] - SIDE_MARGIN, r['c'] + r['a'] + SIDE_MARGIN
            span = np.arange(np.floor(fx0), np.ceil(fx1) + 1)
            fy0, fy1 = float(line(span).min()) - RIM_LIFT - RIM_FEATHER - 1, float(line(np.array([r['c']]))[0]) + RIM_DEPTH
            # the box on the FIRE PASS's texel grid (the coarser of the two), so the cut and its light end on the same
            # line on every side
            kx, ky = fire.size[0] / size[0], fire.size[1] / size[1]
            f0x, f0y, f1x, f1y = int(np.floor(fx0 * s * kx)), int(np.floor(fy0 * s * ky)), int(np.ceil(fx1 * s * kx)), int(np.ceil(fy1 * s * ky))
            t0x, t0y, t1x, t1y = round(f0x / kx), round(f0y / ky), round(f1x / kx), round(f1y / ky)
            tier_spec['boxes'][side] = [round(v / s, 4) for v in (t0x, t0y, t1x, t1y)]
            # each texel's coverage by "under the line": its centre in frame px against the line, feathered
            tx = (np.arange(t0x, t1x) + 0.5) / s
            ty = (np.arange(t0y, t1y) + 0.5) / s
            inside = (np.abs(tx - r['c']) < r['a'] + SIDE_MARGIN).astype(np.float64)
            cover = np.clip((ty[:, None] - (line(tx)[None, :] - RIM_LIFT)) / max(RIM_FEATHER, 1e-6) + 0.5, 0, 1) * inside[None, :]
            # WHICH PIXELS, AND HOW OPAQUE. A cut pixel is the foreground's own pixel at the foreground's own opacity
            # a: exactly right with a flame behind it (a of rim over 1 - a of flame). With NO flame behind it the pixel
            # is drawn twice and comes out a (1 - a) too opaque, which hardens an outline. So:
            #   on the rim's top outline (the first OUTLINE_BAND px under the line, plus two texels of this tier for
            #   the outline's own softness after the resize): every pixel, at a. A flame is what is behind that row.
            #   under it: only pixels that are solid or all but solid (a >= NEAR_SOLID of 255; the double draw is then
            #   under 6% of the difference to what is behind). After the TUCK no flame reaches the bowl's side outlines,
            #   so their half transparent pixels are left alone.
            # Solid pixels only (a == 255) left a comb of flame and rim pixels wherever the resized foreground's alpha
            # was 250 to 254: along the rim on the full tier, and well under it on the phone tier (2026-10-11).
            crops = {st: np.asarray(fore[st].crop((t0x, t0y, t1x, t1y))).astype(np.float64) for st in SETS}
            least = np.minimum(*[crops[st][..., 3] for st in SETS])
            outline = ty[:, None] <= line(tx)[None, :] + OUTLINE_BAND + 2 / s
            for st in SETS:
                cut = crops[st].copy()
                cut[..., 3] = np.where(outline | (least >= NEAR_SOLID), least * cover, 0.0)
                cells[f'rim_{side}_{st}'] = Image.fromarray(cut.round().astype(np.uint8), 'RGBA')
            # THE FIRE PASS OVER THE SAME CUT, on the pass's OWN texels (it ships at FIRE_SHARE of the foreground's size):
            # the pass's pixels as they are, times the cut's coverage of each of them, opaque on black. Drawn at the
            # pass's own scale on the pass's own grid, the GPU samples it exactly as it samples the pass, so under the
            # outline the light on the cut is the pass's to the level. (Resampled on the foreground's texels instead,
            # it was 13 to 26 of 255 off at the pass's sharpest highlights: seen by flame_probe.js RIM, 2026-10-11.)
            tier_spec['fireBoxes'][side] = [round(v, 4) for v in (f0x / kx / s, f0y / ky / s, f1x / kx / s, f1y / ky / s)]
            # the cut's coverage (the day cell's alpha), per pass texel
            mh = np.asarray(cells[f'rim_{side}_day'].getchannel('A').resize((f1x - f0x, f1y - f0y), Image.BOX)).astype(np.float64) / 255.0
            lit = np.asarray(fire.crop((f0x, f0y, f1x, f1y))).astype(np.float64) * mh[..., None]
            cells[f'rimfire_{side}'] = Image.fromarray(np.dstack([lit, np.full(lit.shape[:2], 255.0)]).round().astype(np.uint8), 'RGBA')
        # the ember: a soft round dot, white, the falloff in the alpha
        e = max(8, round(EMBER_PX * s))
        g = (np.arange(e) + 0.5) / e * 2 - 1
        rr = np.sqrt(g[None, :] ** 2 + g[:, None] ** 2)
        dot = np.clip(1 - rr, 0, 1) ** 2
        cells['ember'] = Image.merge('RGBA', (*[Image.new('L', (e, e), 255)] * 3, Image.fromarray((dot * 255).round().astype(np.uint8))))
        names = sorted(cells)
        pos, aw, ah = pack([(cells[n].size[0] + PAD, cells[n].size[1] + PAD) for n in names])
        pos = [(x + 1, y + 1) for x, y in pos]
        aw, ah = aw + 1, ah + 1
        atlas = Image.new('RGBA', (aw, ah), (0, 0, 0, 0))
        frames = {}
        for n, (px, py) in zip(names, pos):
            # EXTRUDED by one texel into the padding (each cell's edge rows and columns again): a sample at the very edge
            # of a cut then blends with the cut's own edge, not with the empty padding (which read as a faint line of
            # missing light along the cut's lower edge on the phone tier)
            w, h = cells[n].size
            cell = np.asarray(cells[n])
            atlas.paste(Image.fromarray(np.pad(cell, ((1, 1), (1, 1), (0, 0)), mode='edge'), 'RGBA'), (px - 1, py - 1))
            frames[f'flame_{n}'] = {'frame': {'x': px, 'y': py, 'w': w, 'h': h}, 'rotated': False, 'trimmed': False,
                                    'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'sourceSize': {'w': w, 'h': h}}
        image = f'flame-fx{suffix}.webp'
        # LOSSLESS: a cut must be its foreground again to the level (a lossy copy was up to 15 of 255 off on a few
        # pixels of the phone tier, which tools/manticore/flame_probe.js RIM read as the picture changing under the rim)
        atlas.save(os.path.join(OUT, image), 'WEBP', lossless=True, quality=100, method=6, exact=True)
        nbytes = os.path.getsize(os.path.join(OUT, image))
        meta_out = {'image': image, 'format': 'RGBA8888', 'size': {'w': aw, 'h': ah}, 'scale': '1',
                    'pngHash': hashlib.md5(open(os.path.join(OUT, image), 'rb').read()).hexdigest()[:8]}
        jpath = os.path.join(OUT, f'flame-fx{suffix}.json')
        open(jpath, 'w').write(json.dumps({'frames': frames, 'meta': meta_out}, indent=1) + '\n')
        report.append((f'flame-fx{suffix}.json + .webp', nbytes + os.path.getsize(jpath), aw, ah))
        # the cut laid back over the foreground it was cut from must be that foreground again
        got = Image.open(os.path.join(OUT, image)).convert('RGBA')
        worst = 0.0
        for n, (px, py) in zip(names, pos):
            if not n.startswith('rim_'):
                continue
            _, side, st = n.split('_')
            b = [round(v * s) for v in tier_spec['boxes'][side]]
            under = np.asarray(fore[st].crop(tuple(b)).convert('RGBa')).astype(np.float64)
            cell = np.asarray(got.crop((px, py, px + cells[n].size[0], py + cells[n].size[1]))).astype(np.float64)
            a = cell[..., 3:] / 255
            solid_px = under[..., 3] >= 255
            over = cell[..., :3] * a + under[..., :3] * (1 - a)
            worst = max(worst, float(np.abs(over - under[..., :3])[solid_px].max()))
        print(f'  {image}: {aw} x {ah}, {len(names)} frames, {nbytes / 1024:.0f} KiB lossless; a cut laid back over its own foreground changes no solid pixel by more than {worst:.2f} of 255')
        tier_spec['fx'] = [aw, ah]
        spec['tiers'][tier] = tier_spec

        if tier == 'full' and args.check:
            os.makedirs(os.path.expanduser(args.check), exist_ok=True)
            for side in SIDES:
                b = [round(v) for v in tier_spec['boxes'][side]]
                for st in SETS:
                    cell = cells[f'rim_{side}_{st}']
                    bg = Image.new('RGBA', cell.size, (255, 0, 255, 255))
                    bg.alpha_composite(cell)
                    both = Image.new('RGBA', (cell.size[0], cell.size[1] * 2), (0, 0, 0, 255))
                    both.paste(fore[st].crop(tuple(b)), (0, 0))
                    both.paste(bg, (0, cell.size[1]))
                    both.resize((both.size[0] * 4, both.size[1] * 4), Image.NEAREST).save(os.path.join(os.path.expanduser(args.check), f'rim_cut_{side}_{st}.png'))

    # ---- the clips' own numbers, and the checks against the cut ----------------------------------------------------------
    alpha_day = fore_src['day'][..., 3]
    for clip in CLIPS:
        m = meta[f'flame_{clip}']
        cw, ch = m['canvas']
        ax, ay = m['anchor']
        scale = float(m['draw_scale'])
        u = unions[clip]
        ys, xs = np.nonzero(u)
        solid = np.nonzero(u >= 128)
        spec['clips'][clip] = {
            'frames': m['frames'], 'fps': m['fps'], 'canvas': [cw, ch], 'anchor': [ax, ay], 'drawScale': scale,
            # over every frame, canvas px from the anchor: how far any pixel reaches up, down, left and right; and up for
            # pixels at half opacity or more
            'reach': {'up': int(ay - ys.min()), 'down': int(ys.max() + 1 - ay), 'left': int(ax - xs.min()), 'right': int(xs.max() + 1 - ax), 'upSolid': int(ay - solid[0].min())},
        }
        down = (ys.max() + 1 - ay) * scale
        print(f'  flame_{clip}: at the delivery\'s draw scale {scale} it reaches {(ay - ys.min()) * scale:.0f} px over the rim line ({(ay - solid[0].min()) * scale:.0f} at half opacity), '
              f'{down:.0f} under it (the cut is {RIM_DEPTH} deep), {(ax - xs.min()) * scale:.0f} left and {(xs.max() + 1 - ax) * scale:.0f} right')
        if down > RIM_DEPTH - 2:
            die(f'flame_{clip} reaches {down:.0f} px under the rim line at draw scale {scale}: raise RIM_DEPTH')
        for side in SIDES:
            r = rims[side]
            cx, cy = spec['bowls'][side]
            uu = u[:, ::-1] if side == 'R' else u
            axm = cw - ax if side == 'R' else ax
            yy, xx = np.nonzero(uu)
            fx = cx + (xx + 0.5 - axm) * scale
            fy = cy + (yy + 0.5 - ay) * scale
            # 3 px: the fitted line is within 1.5 px of the true outline, whose own soft row is one more (where the
            # outline is lower than the line the cut has nothing solid to take, and the flame rightly shows down to it)
            under = fy > rim_model(fx, r['c'], r['a'], r['p']) + 3
            ix, iy = np.clip(fx.astype(int), 0, FW - 1), np.clip(fy.astype(int), 0, FH - 1)
            # anything less than an all but solid foreground pixel there would let the flame show through
            bare = under & ((alpha_day[iy, ix] < NEAR_SOLID) | (np.abs(fx - r['c']) > r['a'] + SIDE_MARGIN))
            print(f'    bowl {side}: {int(under.sum())} px of it more than 3 px under the rim line, {int(bare.sum())} of them over a foreground pixel that is not all but solid, or outside the cut')
            if bare.any():
                die(f'flame_{clip} at bowl {side}: {int(bare.sum())} px under the rim line would show beside the bowl')

    print('\nfile'.ljust(42) + 'KiB'.rjust(9) + '   texture'.ljust(16) + 'GPU MB (w x h x 4)')
    for name, nbytes, w, h in report:
        print(f'{name.ljust(41)}{nbytes / 1024:9.1f}   {f"{w} x {h}".ljust(13)}{w * h * 4 / 1e6:8.2f}')
    for tier in tiers:
        mine = [r for r in report if ('-phone' in r[0]) == (tier == 'phone')]
        first = [r for r in mine if 'flame-base' in r[0] or 'flame-fx' in r[0]]
        later = [r for r in mine if r not in first]
        print(f'flames {tier}: with the scene\'s day set (base clip, the cuts) {sum(r[1] for r in first) / 1024:.0f} KiB, {sum(r[2] * r[3] * 4 for r in first) / 1e6:.2f} MB on the GPU; '
              f'deferred (super, epic) {sum(r[1] for r in later) / 1024:.0f} KiB, {sum(r[2] * r[3] * 4 for r in later) / 1e6:.2f} MB; '
              f'all resident {sum(r[2] * r[3] * 4 for r in mine) / 1e6:.2f} MB')

    if args.out:
        print(f'\n--out: {os.path.relpath(SPEC, APP)} NOT written; the spec would be\n' + json.dumps(spec)[:600] + ' ...')
        return
    header = (
        '// GENERATED by tools/build_flame_assets.py from the flame delivery\'s meta.json and frames and the scene\'s foreground:\n'
        '// do not edit by hand, rerun the tool when either changes. Every number is in px of the scene\'s FRAME (top-left\n'
        '// origin) unless it says canvas px (a clip\'s own canvas at the full tier).\n'
        '//   bowls   per side the bowl\'s centre and the rim line\'s height there: the flame\'s anchor goes on this point.\n'
        '//   rim     the rim line (the top silhouette of the rim slab): y(x) = p0 + p1 (x - c) + p2 (1 - sqrt(1 - u^2)) + p3 u^4,\n'
        '//           u = (x - c) / a, for |x - c| < a.\n'
        '//   clips   frames, fps, canvas, anchor (canvas px from the top-left) and drawScale as DELIVERED (the game\'s own\n'
        '//           numbers are constants FLAMES; tools/manticore/flame_probe.js holds the two together); reach: over every\n'
        '//           frame, canvas px from the anchor, how far any pixel goes (upSolid: at half opacity or more).\n'
        '//   tiers   per tier each clip\'s sheet and canvas in texels, the fx atlas, and each rim cut\'s box (its atlas\n'
        '//           frames flame_rim_<side>_<set> cover exactly this box) and each fire light cut\'s box (fireBoxes, frame\n'
        '//           flame_rimfire_<side>: on the fire pass\'s own, coarser texels, so a little larger). rimDepth: how far under\n'
        '//           the rim line the cut reaches. ember: the dot\'s cell at the full tier.\n'
    )
    open(SPEC, 'w').write(header + 'export const FLAME_SPEC = ' + json.dumps(spec, indent='\t') + ' as const;\n')
    print(f'wrote {os.path.relpath(SPEC, APP)}')


if __name__ == '__main__':
    main()
