"""THE BOARD FRAME RELIGHT AND THE TURNING GEARS (approved Corey 2026-10-11), called by tools/build_board_layers.py.

Sources (read only, never written), all 2048 x 1935 like the board render:
  drafts/gears_sync_r1/plate/board_v5l_{D1,night}_plate.png       the frame layer WITHOUT the six turning parts (their rest
                                                                  shadow is in it); the D1 plate is the day frame the main
                                                                  tool exports as ui/board-frame-<layout>.webp
  drafts/gears_sync_r1/plate/board_v5l_fire_plate_on_black.png    the fire light alone on black (additive), darkest of the loop
  drafts/relight_r1/full/fire/board_v5l_fire_frame_on_black.png   the fire light at rest (outside the gear cells the plate is this)
  drafts/gears_sync_r1/sheets/full2048/<D1|night|fire>/<part>_<L|R>.png   the gear frame loops, 5 columns, 1 px gutter
  drafts/gears_sync_r1/work/layers_report.json                    each loop's box in render px and its cell size
  drafts/gears_sync_r1/work/renders/D1/<group>_<pose>.png         each group alone (every other object a holdout): what a
                                                                  part ever covers, for the trim
  drafts/relight_r1/full/shadow/board_v5l_contact_shadow.png      black with alpha: the floor shadow under the feet
  drafts/bracket_r7/full/board_v5l_frame.png                      the LOCKED frame: the alpha contract

Outputs (static/assets/ui), per layout:
  board-frame-night-<layout>.webp     the night plate at the day plate's size (phone: a -half twin for the phone tier)
  board-frame-fire-<layout>.webp      the fire plate on black at HALF the day plate's size (it is soft light), opaque
  board-gears-<layout>.{json,webp}    one atlas: the six day loops (100 cells) and the contact shadow
  board-gears-night-<layout>.{json,webp}   one atlas: the six night loops and the six fire loops (200 cells)
                                      (phone: -half twins of both atlases for the phone tier)
and the 'relight' block of boardArtSpec.ts.

THE TRIM (Corey: "trim the gear frames to about 20 px around each part"). A loop's cell keeps what its part ever
covers plus TRIM_PX render px round it; over the last FEATHER_PX of that the cell fades out (its premultiplied colour
times f), so the kept shadow change ends in a ramp and not on a line. What a cell shows is lerp(plate, target, f): frame 0
is the locked picture wherever f is 1, and outside the trim the plate stands still. The fire plate is lerp(rest, darkest,
max f) for the same reason: outside the cells it must be the picture at rest, since nothing is added to it there.

ONE CELL SIZE PER LOOP, cut on the day plate's own texture pixel grid (the cell's box is a whole number of plate texture
px, EVEN ones where a half twin exists), and resampled with the plate's own scale and phase: a frame change is a texture
swap on a sprite that never moves.
"""
import hashlib
import json
import math
import os

import numpy as np
from PIL import Image
from scipy import ndimage

# WARNING, 2026-10-13: THE SHIPPED FRAME FILES ARE NO LONGER BUILT FROM THE v5l PLATES BELOW. The ten board-frame-* files
# in static/assets/ui (day, night, night half twin, fire) carry the lion crest on both foot plates (board v5m) and were
# exported from ~/Desktop/Manticore Mayhem/images/board/export_v5m_emblem/sources/ (board_v5m_D1_plate.png,
# board_v5m_night_plate.png, board_v5m_fire_plate_on_black.png, board_v5m_fire_frame_on_black.png; see that folder's
# NOTES.md and scripts/export_game_files.py, which swaps the four paths in memory). PLATE and FIRE_REST here still point
# at the v5l sources: a plain re-run of build_board_layers.py writes the OLD FEET back. Before a re-run, point PLATE
# day / night / fire and FIRE_REST at those four v5m files (alpha is v5l's, nothing else changes).
DRAFTS = os.path.expanduser('~/Desktop/Manticore Mayhem/images/board/drafts')
GEARS = os.path.join(DRAFTS, 'gears_sync_r1')
RELIGHT = os.path.join(DRAFTS, 'relight_r1', 'full')
LOCKED = os.path.join(DRAFTS, 'bracket_r7', 'full', 'board_v5l_frame.png')
PLATE = {'day': os.path.join(GEARS, 'plate', 'board_v5l_D1_plate.png'), 'night': os.path.join(GEARS, 'plate', 'board_v5l_night_plate.png'),
         'fire': os.path.join(GEARS, 'plate', 'board_v5l_fire_plate_on_black.png')}
FIRE_REST = os.path.join(RELIGHT, 'fire', 'board_v5l_fire_frame_on_black.png')
SHADOW = os.path.join(RELIGHT, 'shadow', 'board_v5l_contact_shadow.png')
CHAINS = {'day': os.path.join(RELIGHT, 'D1', 'board_v5l_D1_chains.png'), 'night': os.path.join(RELIGHT, 'night', 'board_v5l_night_chains.png'),
          'fire': os.path.join(RELIGHT, 'fire', 'board_v5l_fire_chains.png')}
RIG = {'day': 'D1', 'night': 'night', 'fire': 'fire'}
SETS = ('day', 'night', 'fire')
# the gear zone of the render (gears_sync_r1 gs_common.BORDER_ROWS) and the loop (N frames a link; the end gear's 72
# degree period is half of it, so its loop is N / 2)
Y0, Y1 = 110, 500
N = 20
# draw order over the plate (gs_common.ORDER), left then right
PARTS = [(g, s) for g in ('endgear', 'pinion', 'wheel') for s in 'LR']
FRAMES = {'endgear': N // 2, 'pinion': N, 'wheel': N}
TRIM_PX = 20
FEATHER_PX = 6
# the contact shadow: its rows of the render canvas (relight_r1 NOTES: cleared above row 1690), the whole width; drawn
# from a texture at SHADOW_SCALE of the plate's (it is a blur), white with alpha so its colour is the sprite's tint
SHADOW_BOX = (0, 1690, 2048, 1935)
SHADOW_SCALE = 0.5
FIRE_SCALE = 0.5
PAD = 2
Q_PLATE = 85
Q_GEARS = 90
# layouts whose new layers also ship a half size twin for the PHONE TIER (game/deviceTier.ts): the phone master's
# textures are 2 texture px per master px and a phone tier screen draws at most 1.01 canvas px per master px (short
# side <= 500 CSS px over the 740 master, renderer resolution capped at 1.5), so the half twin is still 1 : 1 there
HALF_TWIN = ('phone',)


def _pm(a):
    o = a.astype(np.float64)
    o[..., :3] *= o[..., 3:] / 255
    return o


def _over(dst, src):
    return src + (1 - src[..., 3:] / 255) * dst


def _load_strip(path, mode):
    return np.asarray(Image.open(path).convert(mode))[Y0:Y1]


def trim_weights():
    """per part, f over the gear strip (rows Y0 .. Y1): 1 on what the part ever covers and for TRIM_PX - FEATHER_PX
    round it, 0 from TRIM_PX out"""
    ren = os.path.join(GEARS, 'work', 'renders', 'D1')
    out = {}
    half = np.zeros((Y1 - Y0, 2048), bool)
    half[:, :1024] = True
    for g in ('endgear', 'pinion', 'wheel'):
        ever = np.zeros((Y1 - Y0, 2048), bool)
        for k in range(N):
            pose = f'{k / N:07.4f}'.replace('.', 'p')
            ever |= _load_strip(os.path.join(ren, f'{g}_{pose}.png'), 'RGBA')[..., 3] > 0
        for s in 'LR':
            mine = ever & (half if s == 'L' else ~half)
            dist = ndimage.distance_transform_edt(~mine)
            out[(g, s)] = np.clip((TRIM_PX - dist) / FEATHER_PX, 0, 1)
    return out


def load_loops(report, weights):
    """every loop frame as a strip-sized array, trimmed: day / night straight RGBA uint8 (alpha x f), fire RGB float (x f)"""
    loops = {}
    for st in SETS:
        for g, s in PARTS:
            x0, y0, x1, y1 = report['boxes_render_px'][f'{g}_{s}']
            cw, ch = report['sheets'][f'full2048/{RIG[st]}/{g}_{s}']['cell']
            assert (cw, ch) == (x1 - x0, y1 - y0), (g, s, cw, ch)
            sheet = np.asarray(Image.open(os.path.join(GEARS, 'sheets', 'full2048', RIG[st], f'{g}_{s}.png')).convert('RGB' if st == 'fire' else 'RGBA'))
            f = weights[(g, s)]
            for k in range(FRAMES[g]):
                cy, cx = (k // 5) * (ch + 2) + 1, (k % 5) * (cw + 2) + 1
                cell = sheet[cy:cy + ch, cx:cx + cw]
                strip = np.zeros((Y1 - Y0, 2048, cell.shape[2]), np.float64)
                strip[y0 - Y0:y1 - Y0, x0:x1] = cell
                if st == 'fire':
                    strip *= f[..., None]
                else:
                    strip[..., 3] *= f
                loops[(st, g, s, k)] = np.clip(strip + 0.5, 0, 255).astype(np.uint8)
    return loops


def fire_plate(weights):
    """the fire plate the game adds: the darkest of the loop inside the cells, the picture at rest outside them"""
    dark = np.asarray(Image.open(PLATE['fire']).convert('RGB')).astype(np.float64)
    rest = np.asarray(Image.open(FIRE_REST).convert('RGB')).astype(np.float64)
    f = np.zeros(dark.shape[:2])
    f[Y0:Y1] = np.max([weights[p] for p in PARTS], 0)
    return np.clip(rest + (dark - rest) * f[..., None] + 0.5, 0, 255).astype(np.uint8)


def check_full(loops, weights, fire_full, log):
    """(work/comp holds the gear strip only, rows Y0 .. Y1.) At render size, as the game stacks them: frame 0 over each plate against the relight's own frame layer and the
    locked alpha; every turned frame against gears_sync_r1's own recomposite (what the trim leaves still)"""
    lock = _load_strip(LOCKED, 'RGBA')[..., 3].astype(np.float64)
    out = {}
    night_alpha = {}
    for st in ('day', 'night'):
        plate = _pm(_load_strip(PLATE[st], 'RGBA'))
        rest = _pm(_load_strip(os.path.join(RELIGHT, RIG[st], f'board_v5l_{RIG[st]}_frame.png'), 'RGBA'))
        worst8 = worst = 0
        for k in range(N):
            c = plate.copy()
            keep = np.ones(c.shape[:2])
            for g, s in PARTS:
                u = _pm(loops[(st, g, s, k % FRAMES[g])])
                c = _over(c, u)
                keep *= 1 - u[..., 3] / 255
            if st == 'night':
                night_alpha[k] = keep
            if k == 0:
                e = np.abs(c - rest).max(2)
                out[st] = {'frame0_vs_relight_frame_max': round(float(e.max()), 2), 'frame0_px_over_2': int((e > 2).sum()),
                           'frame0_alpha_px_differ_from_locked': int((np.round(c[..., 3]) != lock).sum())}
            else:
                ref = _pm(np.asarray(Image.open(os.path.join(GEARS, 'work', 'comp', f'{RIG[st]}_{k:02d}.png')).convert('RGBA')))
                e = np.abs(c - ref).max(2)
                worst8 = max(worst8, int((e > 8).sum()))
                worst = max(worst, float(e.max()))
        out[st]['turned_px_over_8_left_still_by_the_trim_worst_frame'] = worst8
        out[st]['turned_max'] = round(worst, 2)
    rest = _load_strip(FIRE_REST, 'RGB').astype(np.float64)
    pf = fire_full[Y0:Y1].astype(np.float64)
    worst8 = worst = 0
    for k in range(N):
        c = pf * night_alpha[k][..., None] + sum(loops[('fire', g, s, k % FRAMES[g])].astype(np.float64) for g, s in PARTS)
        if k == 0:
            e = np.abs(c - rest).max(2)
            out['fire'] = {'frame0_vs_relight_fire_max': round(float(e.max()), 2), 'frame0_px_over_2': int((e > 2).sum()), 'frame0_px_over_8': int((e > 8).sum())}
        else:
            ref = np.asarray(Image.open(os.path.join(GEARS, 'work', 'comp', f'fire_{k:02d}.png')).convert('RGB')).astype(np.float64)
            e = np.abs(c - ref).max(2)
            worst8 = max(worst8, int((e > 8).sum()))
            worst = max(worst, float(e.max()))
    out['fire']['turned_px_over_8_left_still_by_the_trim_worst_frame'] = worst8
    out['fire']['turned_max'] = round(worst, 2)
    for st, v in out.items():
        log(f'  relight check, {st} at 2048: {json.dumps(v)}')
    return out


def rest_outline(plate, rest, cells, boxes):
    """THE ALPHA CONTRACT AT TEXTURE SIZE. At render size frame 0 over the plate has the locked alpha exactly; resampled
    one by one, the plate and the cells no longer multiply out to the resampled locked alpha on the few hundred outline
    pixels where a tooth stands past the housing. So on the plate's outline pixels (plate alpha under 255) each frame 0
    cell's alpha is solved again: the part that holds most of the pixel takes the alpha that makes the stack's alpha
    the rest picture's, and where a cell had nothing there it takes the rest picture's colour. plate, rest: RGBA
    images at texture size (rest = the relight's own frame layer, alpha = the locked alpha); cells: {part: RGBA image}
    of frame 0, changed in place; boxes: {part: texture box}. Returns (px changed, px still off by more than 1 level)."""
    P = np.asarray(plate).astype(np.float64)
    T = np.asarray(rest).astype(np.float64)
    arr = {p: np.asarray(c).astype(np.float64) for p, c in cells.items()}
    h, w = P.shape[:2]
    alpha = np.zeros((len(arr), h, w))
    for i, p in enumerate(arr):
        x0, y0, x1, y1 = boxes[p]
        alpha[i, y0:y1, x0:x1] = arr[p][..., 3] / 255
    pa, ta = P[..., 3] / 255, T[..., 3] / 255
    stack = 1 - (1 - pa) * np.prod(1 - alpha, 0)
    covered = np.zeros((h, w), bool)
    for p in arr:
        x0, y0, x1, y1 = boxes[p]
        covered[y0:y1, x0:x1] = True
    fix = covered & (pa < 1) & (np.abs(np.round(stack * 255) - T[..., 3]) > 0)
    top = alpha.argmax(0)
    changed = 0
    for i, p in enumerate(arr):
        x0, y0, x1, y1 = boxes[p]
        m = (fix & (top == i))[y0:y1, x0:x1]
        if not m.any():
            continue
        others = (1 - pa) * np.prod(np.delete(1 - alpha, i, 0), 0)
        want = np.clip(1 - (1 - ta) / np.maximum(others, 1e-6), 0, 1)[y0:y1, x0:x1]
        a = arr[p]
        empty = m & (a[..., 3] < 8)
        a[..., :3][empty] = T[y0:y1, x0:x1, :3][empty]
        a[..., 3][m] = np.round(want[m] * 255)
        alpha[i, y0:y1, x0:x1] = a[..., 3] / 255
        cells[p].paste(Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), 'RGBA'))
        changed += int(m.sum())
    stack = 1 - (1 - pa) * np.prod(1 - alpha, 0)
    return changed, int((np.abs(np.round(stack * 255) - T[..., 3]) > 1).sum())


def pack(sizes, max_w=2048):
    """shelf packing, tallest first; the width (a multiple of 64 up to max_w) that gives the smallest sheet. Returns
    (positions in the input's order, width, height)"""
    order = sorted(range(len(sizes)), key=lambda i: (-sizes[i][1], -sizes[i][0]))
    best = None
    for width in range(max(256, max(w for w, _ in sizes) + PAD), max_w + 1, 64):
        pos = [None] * len(sizes)
        x = y = PAD
        row_h = 0
        used_w = 0
        for i in order:
            w, h = sizes[i]
            if x + w + PAD > width:
                x = PAD
                y += row_h + PAD
                row_h = 0
            pos[i] = (x, y)
            x += w + PAD
            used_w = max(used_w, x)
            row_h = max(row_h, h)
        height = y + row_h + PAD
        if height > 4096:
            continue
        if best is None or used_w * height < best[1] * best[2]:
            best = (pos, used_w, height)
    return best


def write_atlas(out_dir, name, cells, quality):
    """cells: [(frame name, RGBA image)]. Writes <name>.webp and <name>.json (the Pixi spritesheet), returns the facts."""
    pos, aw, ah = pack([c.size for _, c in cells])
    atlas = Image.new('RGBA', (aw, ah), (0, 0, 0, 0))
    frames = {}
    for (fname, cell), (px, py) in zip(cells, pos):
        atlas.paste(cell, (px, py))
        w, h = cell.size
        frames[fname] = {'frame': {'x': px, 'y': py, 'w': w, 'h': h}, 'rotated': False, 'trimmed': False,
                         'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'sourceSize': {'w': w, 'h': h}}
    image = f'{name}.webp'
    path = os.path.join(out_dir, image)
    atlas.save(path, 'WEBP', quality=quality, method=6, alpha_quality=100)
    meta = {'image': image, 'format': 'RGBA8888', 'size': {'w': aw, 'h': ah}, 'scale': '1', 'pngHash': hashlib.md5(open(path, 'rb').read()).hexdigest()[:8]}
    open(os.path.join(out_dir, f'{name}.json'), 'w').write(json.dumps({'frames': frames, 'meta': meta}, separators=(',', ':')) + '\n')
    return {'size': [aw, ah], 'cells': len(cells), 'residentMB': round(aw * ah * 4 / 2 ** 20, 2), 'bytes': os.path.getsize(path) + os.path.getsize(os.path.join(out_dir, f'{name}.json'))}


def build(ui_dir, frame_spec, log=print):
    """frame_spec: boardArtSpec's `frame` block ({layout: {crop, size, tex}}). Writes the files, returns the spec block."""
    os.makedirs(ui_dir, exist_ok=True)
    report = json.load(open(os.path.join(GEARS, 'work', 'layers_report.json')))
    weights = trim_weights()
    loops = load_loops(report, weights)
    fire_full = fire_plate(weights)
    checks = check_full(loops, weights, fire_full, log)
    night_full = Image.open(PLATE['night']).convert('RGBA')
    shadow_a = np.asarray(Image.open(SHADOW).convert('RGBA'))[..., 3]
    white = np.full(shadow_a.shape + (4,), 255, np.uint8)
    white[..., 3] = shadow_a
    shadow_full = Image.fromarray(white, 'RGBA')
    # each loop's kept box in render px: where its weight is not 0, inside the box the round's own sheet had
    kept = {}
    for g, s in PARTS:
        ys, xs = np.nonzero(weights[(g, s)] > 0)
        x0, y0, x1, y1 = report['boxes_render_px'][f'{g}_{s}']
        kept[(g, s)] = (max(x0, int(xs.min())), max(y0, int(ys.min()) + Y0), min(x1, int(xs.max()) + 1), min(y1, int(ys.max()) + 1 + Y0))
    spec = {'source': 'gears_sync_r1 + relight_r1', 'frames': N, 'trimPx': TRIM_PX, 'featherPx': FEATHER_PX, 'parts': [f'{g}_{s}' for g, s in PARTS],
            'loop': {f'{g}_{s}': FRAMES[g] for g, s in PARTS}, 'checks': checks, 'layouts': {}}
    for kind, fs in frame_spec.items():
        (cx, cy), (cw, ch), (tw, th) = fs['crop'], fs['size'], fs['tex']
        sx, sy = tw / cw, th / ch
        fbox = (cx, cy, cx + cw, cy + ch)
        step = 2 if kind in HALF_TWIN else 1
        out = {'tiers': {}}
        # ---- the plates: night at the day plate's size, fire at half of it (opaque: it is added)
        night = night_full.crop(fbox).resize((tw, th), Image.LANCZOS)
        plates = {'day': Image.open(PLATE['day']).convert('RGBA').crop(fbox).resize((tw, th), Image.LANCZOS), 'night': night}
        rests = {st: Image.open(os.path.join(RELIGHT, RIG[st], f'board_v5l_{RIG[st]}_frame.png')).convert('RGBA').crop(fbox).resize((tw, th), Image.LANCZOS) for st in ('day', 'night')}
        night.save(os.path.join(ui_dir, f'board-frame-night-{kind}.webp'), 'WEBP', quality=Q_PLATE, method=6, alpha_quality=100)
        ftw, fth = math.ceil(tw * FIRE_SCALE), math.ceil(th * FIRE_SCALE)
        fire = Image.fromarray(fire_full, 'RGB').crop(fbox).resize((ftw, fth), Image.LANCZOS)
        fire.save(os.path.join(ui_dir, f'board-frame-fire-{kind}.webp'), 'WEBP', quality=Q_PLATE, method=6)
        out['night'] = {'tex': [tw, th]}
        out['fire'] = {'tex': [ftw, fth]}
        # ---- the loops' boxes on the plate's texture grid (whole plate texture px; even where a half twin exists)
        boxes = {}
        for g, s in PARTS:
            x0, y0, x1, y1 = kept[(g, s)]
            t0x = math.floor((x0 - cx) * sx / step) * step
            t0y = math.floor((y0 - cy) * sy / step) * step
            t1x = math.ceil((x1 - cx) * sx / step) * step
            t1y = math.ceil((y1 - cy) * sy / step) * step
            boxes[(g, s)] = (t0x, t0y, t1x, t1y)
        out['gears'] = {f'{g}_{s}': {'tex': list(boxes[(g, s)]), 'box': [round(cx + boxes[(g, s)][0] / sx, 4), round(cy + boxes[(g, s)][1] / sy, 4), round((boxes[(g, s)][2] - boxes[(g, s)][0]) / sx, 4), round((boxes[(g, s)][3] - boxes[(g, s)][1]) / sy, 4)]} for g, s in PARTS}
        # ---- the contact shadow: its own box of the render canvas, at SHADOW_SCALE of the plate's scale
        sb = SHADOW_BOX
        sw, sh = math.ceil((sb[2] - sb[0]) * sx * SHADOW_SCALE), math.ceil((sb[3] - sb[1]) * sy * SHADOW_SCALE)
        shadow = shadow_full.crop(sb).resize((sw, sh), Image.LANCZOS)
        out['shadow'] = {'box': [sb[0], sb[1], sb[2] - sb[0], sb[3] - sb[1]], 'tex': [sw, sh]}
        for tier, div in (('full', 1), ('half', 2)) if kind in HALF_TWIN else (('full', 1),):
            suffix = '' if div == 1 else '-half'
            if div != 1:
                night.resize((math.ceil(tw / div), math.ceil(th / div)), Image.LANCZOS).save(os.path.join(ui_dir, f'board-frame-night-{kind}{suffix}.webp'), 'WEBP', quality=Q_PLATE, method=6, alpha_quality=100)
            cells = {st: [] for st in SETS}
            for st in SETS:
                for g, s in PARTS:
                    t0x, t0y, t1x, t1y = boxes[(g, s)]
                    size = ((t1x - t0x) // div, (t1y - t0y) // div)
                    # the same render px the plate's texture px (t0x .. t1x) cover, strip rows
                    rbox = (cx + t0x / sx, cy + t0y / sy - Y0, cx + t1x / sx, cy + t1y / sy - Y0)
                    for k in range(FRAMES[g]):
                        a = loops[(st, g, s, k)]
                        im = Image.fromarray(a, 'RGB' if st == 'fire' else 'RGBA').resize(size, Image.LANCZOS, box=rbox)
                        cells[st].append((f'boardGear_{kind}_{st}_{g}_{s}_{k:02d}', im.convert('RGBA')))
                if div == 1 and st != 'fire':
                    zero = {f'{g}_{s}': next(c for n, c in cells[st] if n == f'boardGear_{kind}_{st}_{g}_{s}_00') for g, s in PARTS}
                    changed, left = rest_outline(plates[st], rests[st], zero, {f'{g}_{s}': boxes[(g, s)] for g, s in PARTS})
                    out.setdefault('restOutline', {})[st] = {'pxSolved': changed, 'pxOffByMoreThan1': left}
                    log(f'  relight {kind} {st}: frame 0 alpha solved again on {changed} outline px of the texture; stack alpha against the rest picture off by more than 1 level on {left} px')
            day = write_atlas(ui_dir, f'board-gears-{kind}{suffix}', cells['day'] + [(f'boardShadow_{kind}', shadow)], Q_GEARS)
            nite = write_atlas(ui_dir, f'board-gears-night-{kind}{suffix}', cells['night'] + cells['fire'], Q_GEARS)
            px = lambda st: sum(c.size[0] * c.size[1] for _, c in cells[st])
            out['tiers'][tier] = {'day': day, 'night': nite, 'cellsMB': {st: round(px(st) * 4 / 2 ** 20, 2) for st in SETS},
                                  'plateMB': {'day': round(tw * th * 4 / 2 ** 20, 2), 'night': round(math.ceil(tw / div) * math.ceil(th / div) * 4 / 2 ** 20, 2), 'fire': round(ftw * fth * 4 / 2 ** 20, 2)}}
            log(f'  relight {kind} {tier}: day atlas {day["size"]} {day["residentMB"]} MB ({day["bytes"] / 1024:.0f} KiB), night + fire atlas {nite["size"]} {nite["residentMB"]} MB ({nite["bytes"] / 1024:.0f} KiB); cells alone {out["tiers"][tier]["cellsMB"]}; plates {out["tiers"][tier]["plateMB"]}')
        spec['layouts'][kind] = out
    return spec
