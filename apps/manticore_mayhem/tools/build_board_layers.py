"""Export the Manticore Mayhem board frame, the chains layer and the temporary scene background.

  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/build_board_layers.py [--no-frame] [--no-bg]

Sources (read only, never written), TAG = board_v4i (TILT_DEG 4) or board_v4d (TILT_DEG 0):
  ~/Desktop/Manticore Mayhem/images/board/drafts/<TAG>_frame.png    2048 x 1935 RGBA (v4h; 1863 up to v4g): frame + 9x9
                                                                    lattice + top links
  ~/Desktop/Manticore Mayhem/images/board/drafts/<TAG>_neutral_frame.png   the same with the NEUTRAL steel grid (v4f)
  ~/Desktop/Manticore Mayhem/images/board/drafts/<TAG>_chains.png   same canvas: the 16 run links per side only
  ~/Desktop/Manticore Mayhem/images/board/drafts/<TAG>_camera.json  camera; v4e also carries the projected
                                                                    lattice crossings and chain anchors
  ~/Desktop/Manticore Mayhem/images/submission/final/tile-bg.jpg    1672 x 941 citadel courtyard (temporary bg)

Outputs (static/assets):
  ui/board-frame-<layout>.webp        the frame cropped to its alpha bbox plus MARGIN, scaled per layout, with the
                                      DEFAULT_GRID steel (v4f: neutral); the other grid as board-frame-<layout>-blue.webp
                                      (candidate B), so switching back is a file swap
  ui/board-chain-tile-<layout>.webp   THE HAUL (Corey 2026-10-07 13:25): a SEAMLESS two-link tile per run, L and R side by
                                      side with a transparent gutter, power-of-two (the strip mesh repeats it vertically,
                                      texture wrap 'repeat'), cut from the chain render at a between-links phase and
                                      de-slanted onto the run's centreline; the tool prints the seam check (the tile's first
                                      row against the row one period later). The leaned top links are ERASED from the frame
                                      export (the loop enters the cap straight): erase_leaned_links().
  backgrounds/<mode>-<layout>.webp    mode = base / bonus / super / epic (one image for now), cover crops
  src/game/boardArtSpec.ts            GENERATED: lattice, art bbox, corners, crop origins, texture scales and
                                      the FRAME rects this registration derives (copy them into layoutSpec.ts)

REGISTRATION. The lattice's outer bars at MID-HEIGHT (the render is tilted) span the cell area and the art is
centred vertically on it (layoutSpec.registrationOf). Per layout the scale comes from ART_FIT (landscape: the
whole art fitted to its space, the FRAME derived from the lattice at that scale), CHAIN_FIT (portrait, Corey
2026-10-06 21:32: each chain's centreline ~10 master px inside the screen edge, the posts and finials overhang
off screen; vertically the dead band between the tagline and the HUD row split 1 : 1.3 above / below the art)
or PHONE_CELL (phone: the approved cell area). The tool prints the mismatches: what the tilt moved, the corners
against the cell area, and EVERY inner bar against the tile gap it should sit in (v4f: the lattice is uniform,
board_v4_NOTES.md v4f), and solves SYMBOL_FIT (the largest symbol scale whose opaque art, and the multiplier
badge, clear every bar and rivet by the margin). Texture resolution: at least 2 texture px per master px
(portrait at the frameFor() growth cap, 1.12).
"""
import argparse
import json
import math
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
ASSETS = os.path.join(APP, 'static', 'assets')
SPEC_TS = os.path.join(APP, 'src', 'game', 'boardArtSpec.ts')
DESK = os.path.expanduser('~/Desktop/Manticore Mayhem/images')
# THE TILT (Corey 2026-10-06: "a slight downward perspective angle, just a few degrees"). 0 = the flat
# orthographic v4d set; 4 = v4e, rendered by model/scripts/render_layers_tilt.py (camera 4 degrees above,
# 7 units out, lens 124.9 mm). The registration is measured at the lattice's MID-HEIGHT width.
TILT_DEG = 4
# v4g (Corey 2026-10-07): the inner rails trimmed off the frame, the lattice grown to the posts and the lower rail
# v4h (Corey 2026-10-07 11:35): the top raised 0.0692 so the opening is SQUARE (1.3684 x 1.3684), the lattice uniform in
# both directions (pitch W / 8), 17 chain links a side; the render canvas grew 72 px at the top (2048 x 1935)
# v4i (Corey 12:25): the top rail's bar clips removed, a REAL top outer bar with rivets at every crossing and corner
RENDERS = {0: 'board_v4d', 4: 'board_v4i'}
TAG = RENDERS[TILT_DEG]
# --tag <render tag> overrides it (dry runs of a variant, e.g. board_v4g_uz with --no-frame --no-bg)
import sys as _sys
if '--tag' in _sys.argv:
    TAG = _sys.argv[_sys.argv.index('--tag') + 1]
_D = os.path.join(DESK, 'board/drafts')
_pick = lambda *names: next((os.path.join(_D, n) for n in names if os.path.exists(os.path.join(_D, n))), os.path.join(_D, names[-1]))
# the grid steel (Corey 2026-10-06 21:33: B read teal over black): 'neutral' = textures_v4f/neutral, 'blue' = B.
# v4f: <TAG>_frame.png was B and <TAG>_neutral_frame.png neutral; v4g: <TAG>_frame.png is neutral, B is <TAG>_blue_frame.png
DEFAULT_GRID = 'neutral'
GRID_SRC = {'blue': _pick(f'{TAG}_blue_frame.png', f'{TAG}_frame.png'), 'neutral': _pick(f'{TAG}_neutral_frame.png', f'{TAG}_frame.png')}
SRC_FRAME = GRID_SRC[DEFAULT_GRID]
SRC_CHAINS = _pick(f'{TAG}_chains.png', 'board_v4i_chains.png')
SRC_CAMERA = os.path.join(_D, f'{TAG}_camera.json')
FLAT_CAMERA = os.path.join(DESK, 'board/drafts/board_v4d_camera.json')
PREV_CAMERA = os.path.join(DESK, 'board/drafts/board_v4h_camera.json')  # the previous lattice, for the before line
SRC_BG = os.path.join(DESK, 'submission/final/tile-bg.jpg')

# lattice bar axes, world units: the v4 numbers (board_v4_NOTES.md, "Grid material finding") for the flat
# reference; a v4f camera json carries its own (respaced) bar_x / bar_z
BARS_X = [-0.648, -0.51, -0.34, -0.17, 0.0, 0.17, 0.34, 0.51, 0.648]
BARS_Z = [0.618, 0.475, 0.31, 0.145, -0.018, -0.18, -0.342, -0.502, -0.64]

# WHERE THE ART GOES per layout (Corey 2026-10-06). phone: approved as it was, the lattice on the old
# 632.5 cell area. landscape / portrait: the whole frame art (finials to plinth, posts and chains) fitted to
# the space, and the FRAME rect (cells, inset) DERIVED from the lattice at that scale:
#   landscape  x 340 .. 940, centred on the 1280 master (Corey 2026-10-07; was 300 .. 900). The BALANCE / WIN /
#              SPIN row keys from the art's edges; the art reaches 40 px into the manticore column. top ART_TOP
#   portrait   the 412 master less SIDE 7 a side, top under the logo's tagline band (114 .. 150)
PHONE_CELL = {'x': 423.75, 'y': 48.0, 'size': 632.5}
ART_FIT = {'landscape': {'x0': 340.0, 'x1': 940.0, 'top': 38.0}}
# portrait: the chain centrelines (mean of each run's top pivot and bottom anchor, render px) at x0 / x1 of the 412
# master; the art then sits in the band band_top .. hud_top (tagline band bottom 150, the BALANCE / BET row's
# content top 688, measured in the running game at 360 / 390 / 430 wide) with the dead space split above : below =
# 1 : gap_ratio. layoutSpec.frameFor() grows the same way on wide portrait viewports (keep them in step).
CHAIN_FIT = {'portrait': {'x0': 10.0, 'x1': 402.0, 'band_top': 150.0, 'hud_top': 688.0, 'gap_ratio': 1.3}}
# kept proportions of the old FRAME entries: inset / cell area, gap / pitch, plate margin / cell area
RATIOS = {'landscape': (14.5 / 549, 3 / 69, 6 / 549), 'portrait': (11 / 344, 3 / 43.5, 5 / 344), 'phone': (16 / 632.5, 3.5 / 79.5, 7 / 632.5)}
# the bar checks (Corey 2026-10-06): every inner bar on its tile gap within BAR_TOL (master px; phone in SCREEN px
# at the phone probe's 844 x 390, master -> screen 390 / 740)
BAR_TOL = {'landscape': 1.5, 'portrait': 1.5, 'phone': 2.5 * 740 / 390}
# SYMBOL_FIT (constants.ts): the symbol's opaque art and the badge disc must clear every bar edge and rivet by
# FIT_MARGIN master px (phone: 1.5 screen px). Static tile art (static/assets/tiles, 128 px, alpha > 128).
FIT_MARGIN = {'landscape': 1.0, 'portrait': 1.0, 'phone': 1.5 * 740 / 390}
CELL_FILL = 0.94   # constants.ts: drawn tile size / cell pitch
BADGE = {'size': 0.4, 'offset': 0.26, 'disc': 104 / 128}  # constants.ts TILE; the badge disc spans 12..116 of 128
TILES = os.path.join(ASSETS, 'tiles')
GROWTH = {'landscape': 1.0, 'portrait': 1.12, 'phone': 1.0}
DEVICE_PX = 2.0  # texture px per master px the export must reach
MARGIN = 6  # render px kept around each alpha bbox
QUALITY = 85

# background masters (layoutSpec MASTER); the crop keeps the source's resolution (it cannot be upscaled)
MASTER = {'landscape': (1280, 720), 'phone': (1480, 740), 'portrait': (412, 760)}
# horizontal centre of each crop as a share of the source width (0.5 = centre crop)
BG_CX = {'landscape': 0.5, 'phone': 0.5, 'portrait': 0.5}
# vertical centre of each crop as a share of the source height
BG_CY = {'landscape': 0.5, 'phone': 0.5, 'portrait': 0.5}
MODES = ['base', 'bonus', 'super', 'epic']


def world_to_px(cam, x, z):
    w, h = cam['resolution']
    ppu = cam['px_per_unit']
    cx, _, cz = cam['location']
    return w / 2 + (x - cx) * ppu, h / 2 - (z - cz) * ppu


def tile_art_masks():
    """per static tile (symbols + the multiplier tiles), the opaque pixel centres as texture fractions -0.5..0.5"""
    import numpy as np
    out = {}
    for f in sorted(os.listdir(TILES)):
        if not f.endswith('.webp') or f.startswith('x'):
            continue
        a = np.asarray(Image.open(os.path.join(TILES, f)).convert('RGBA'))[:, :, 3]
        ys, xs = np.nonzero(a > 128)
        # keep the outline only (the extreme pixels per row and column): enough for distances, much faster
        keep = np.zeros(a.shape, bool)
        for y in np.unique(ys):
            row = xs[ys == y]
            keep[y, row.min()] = keep[y, row.max()] = True
        for x in np.unique(xs):
            col = ys[xs == x]
            keep[col.min(), x] = keep[col.max(), x] = True
        yy, xx = np.nonzero(keep)
        out[f[:-5]] = ((xx + 0.5) / a.shape[1] - 0.5, (yy + 0.5) / a.shape[0] - 0.5)
    return out


def crop_box(bbox, size):
    x0, y0, x1, y1 = bbox
    return (max(0, x0 - MARGIN), max(0, y0 - MARGIN), min(size[0], x1 + MARGIN), min(size[1], y1 + MARGIN))


# THE CHAIN LOOP (Corey 2026-10-07 13:25): the leaned top link of each run (FRAME layer, over transparent
# background, left of the post's bracket) is erased, and the run becomes a repeating two-link tile.
# Measured on board_v4i: the leaned links lie in these render-px boxes; the run's two-link period is
# CHAIN_PERIOD render px (autocorrelation of the run, 125.75 measured; the brief said ~126); the strip is
# clipped at the bracket's underside (CHAIN_CLIP top) and at the plinth's shackle (bottom).
LEANED_BOX = {'L': (120, 240, 240, 350), 'R': (2048 - 240, 240, 2048 - 120, 350)}
CHAIN_CLIP = (304.0, 1352.0)
CHAIN_PHASE_SEARCH = (700, 830)  # the tile is cut from the middle of the run (perspective is mildest there)
CHAIN_HALF_W = 53.5  # render px either side of the centreline (the old crop was 107 wide)


def hue_of(a):
    import numpy as np
    r, g, b = a[..., 0].astype(float), a[..., 1].astype(float), a[..., 2].astype(float)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    d = np.maximum(mx - mn, 1e-3)
    return np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6


def erase_leaned_links(img):
    """Erase the two leaned top chain links from a frame render (RGBA, in place copy returned). In each
    LEANED_BOX the chain is the largest connected blob of chain-hued pixels (hue > 0.074; the copper is
    0.054..0.08 with its median at 0.062); that blob, dilated 2 px, is cleared except where it is solid
    copper (the bracket the link hooks into). Prints how many pixels went per side."""
    import numpy as np
    a = np.array(img.convert('RGBA'))
    for side, (x0, y0, x1, y1) in LEANED_BOX.items():
        box = a[y0:y1, x0:x1]
        h = hue_of(box)
        cand = (h > 0.074) & (box[..., 3] > 10)
        # largest 4-connected component
        seen = np.zeros(cand.shape, bool)
        best = []
        H, W = cand.shape
        for sy in range(H):
            for sx in range(W):
                if not cand[sy, sx] or seen[sy, sx]:
                    continue
                stack, comp = [(sy, sx)], []
                seen[sy, sx] = True
                while stack:
                    y, x = stack.pop()
                    comp.append((y, x))
                    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= ny < H and 0 <= nx < W and cand[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
                if len(comp) > len(best):
                    best = comp
        m = np.zeros(cand.shape, bool)
        for y, x in best:
            m[y, x] = True
        for _ in range(2):
            m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
        copper = (h < 0.072) & (box[..., 3] > 200)
        kill = m & ~copper
        box[kill] = 0
        # whatever is left in the box and no longer joined to the post (the link's stray rim pixels) goes too
        body = np.zeros(cand.shape, bool)
        opaque = box[..., 3] > 10
        edge = W - 1 if side == 'L' else 0
        stack = [(y, edge) for y in range(H) if opaque[y, edge]]
        for y, x in stack:
            body[y, x] = True
        while stack:
            y, x = stack.pop()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < H and 0 <= nx < W and opaque[ny, nx] and not body[ny, nx]:
                    body[ny, nx] = True
                    stack.append((ny, nx))
        stray = opaque & ~body
        box[stray] = 0
        print(f'  leaned link {side}: blob {len(best)} px, erased {int(kill.sum())} px + {int(stray.sum())} stray in {LEANED_BOX[side]}')
    return Image.fromarray(a)


def chain_runs(chains, cam):
    """Each run de-slanted onto its centreline (the pivot -> anchor line), as float RGBA rows [y, x, 4] over
    the whole render height, CHAIN_HALF_W either side, plus the two-link period and the tile phase."""
    import numpy as np
    c = np.array(chains.convert('RGBA')).astype(float)
    out = {}
    for side in ('L', 'R'):
        (tx, ty), (bx, by) = cam['chains'][side]['top_pivot_px'], cam['chains'][side]['bottom_anchor_px']
        W = int(round(2 * CHAIN_HALF_W))
        rows = np.zeros((c.shape[0], W, 4))
        for y in range(c.shape[0]):
            cx = tx + (bx - tx) * (y - ty) / (by - ty)
            xs = np.arange(W) + cx - CHAIN_HALF_W
            i = np.clip(np.floor(xs).astype(int), 0, c.shape[1] - 2)
            f = (xs - i)[:, None]
            rows[y] = c[y, i] * (1 - f) + c[y, i + 1] * f
        out[side] = rows
    # the period: autocorrelation of alpha x luma down the middle of the L run
    sig = out['L'][..., 3] * out['L'][..., :3].mean(-1) / 255
    seg = sig[500:1100]
    best = None
    for p in np.arange(110, 140, 0.05):
        ys = np.arange(500, 1100) + p
        i = np.floor(ys).astype(int)
        f = (ys - i)[:, None]
        d = np.abs(sig[i] * (1 - f) + sig[i + 1] * f - seg).mean()
        if best is None or d < best[0]:
            best = (d, float(p))
    period = round(best[1], 2)
    # the phase: the row in the search window where the least of the chain is (between two face-on links,
    # only the edge-on link's middle crosses), both runs together
    lo, hi = CHAIN_PHASE_SEARCH
    cover = [(out['L'][y, :, 3].sum() + out['R'][y, :, 3].sum(), y) for y in range(lo, hi)]
    phase = float(min(cover)[1])
    return out, period, phase


def chain_tile_sheet(runs, period, phase, scale):
    """L and R two-link tiles side by side (a 4 px transparent gutter), each the de-slanted run from `phase`
    over one `period`, resampled to the layout's texture scale; the sheet is power-of-two on both sides so the
    wrap works on every WebGL. Returns (sheet, parts, seam) where seam is each run's mean |RGBA| difference
    between the tile's first row and the row one period later (0 = seamless)."""
    import numpy as np
    parts, ims, seam = {}, [], {}
    tw = math.ceil(2 * CHAIN_HALF_W * scale)
    th_n = math.ceil(period * scale)
    pot = lambda n: 1 << max(0, math.ceil(math.log2(max(n, 1))))
    TW, TH = pot(2 * tw + 8), pot(th_n)
    x = 2
    for side in ('L', 'R'):
        rows = runs[side]
        y0 = int(math.floor(phase))
        span = rows[y0:y0 + int(math.ceil(period)) + 2]
        strip = Image.fromarray(np.clip(span + 0.5, 0, 255).astype('uint8'), 'RGBA')
        tile = strip.resize((tw, TH), Image.LANCZOS, box=(0, phase - y0, strip.size[0], phase - y0 + period))
        ims.append((x, tile))
        parts[side] = {'texX': x, 'texW': tw}
        # the seam: row `phase` against row `phase + period`, at render resolution
        def row_at(yy):
            i = int(math.floor(yy))
            f = yy - i
            return rows[i] * (1 - f) + rows[i + 1] * f
        seam[side] = round(float(np.abs(row_at(phase) - row_at(phase + period)).mean()), 3)
        x += tw + 4
    sheet = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
    for px, im in ims:
        sheet.paste(im, (px, 0))
    return sheet, parts, seam


def save_webp(im, rel):
    path = os.path.join(ASSETS, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=QUALITY, method=6, alpha_quality=100)
    return os.path.getsize(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--no-frame', action='store_true')
    ap.add_argument('--no-bg', action='store_true')
    ap.add_argument('--tag')
    args = ap.parse_args()

    cam = json.load(open(SRC_CAMERA))
    flat = json.load(open(FLAT_CAMERA))
    bars_x, bars_z = cam.get('lattice', {}).get('bar_x', BARS_X), cam.get('lattice', {}).get('bar_z', BARS_Z)
    flat_cross = [[world_to_px(flat, x, z) for x in bars_x] for z in bars_z]
    if 'lattice' in cam:  # a projected (tilted) render: crossings come from the camera
        cross = [[tuple(p) for p in row] for row in cam['lattice']['crossings_px']]
        mh = cam['lattice']['mid_height']
        lx0, lx1 = mh['left_px'][0], mh['right_px'][0]
        ly0, ly1 = cam['lattice']['top_centre_px'][1], cam['lattice']['bottom_centre_px'][1]
    else:
        cross = flat_cross
        lx0, ly0 = cross[0][0]
        lx1, ly1 = cross[-1][-1]
    lat = {'x0': lx0, 'y0': ly0, 'x1': lx1, 'y1': ly1}
    lat_w, lat_h = lx1 - lx0, ly1 - ly0
    print(f'{TAG} (tilt {TILT_DEG}): lattice mid-height x {lx0:.2f}..{lx1:.2f} ({lat_w:.2f})  centre line y {ly0:.2f}..{ly1:.2f} ({lat_h:.2f})')
    print(f'  top bar width {cross[0][-1][0] - cross[0][0][0]:.2f}  bottom bar width {cross[-1][-1][0] - cross[-1][0][0]:.2f}')

    frame_a = Image.open(SRC_FRAME).split()[-1]
    chains_a = Image.open(SRC_CHAINS).split()[-1]
    fb, cb = frame_a.getbbox(), chains_a.getbbox()
    art = (min(fb[0], cb[0]), min(fb[1], cb[1]), max(fb[2], cb[2]), max(fb[3], cb[3]))
    art_w, art_h = art[2] - art[0], art[3] - art[1]

    # the inner bars as projected: vertical bars at the mid-height row, horizontal bars at x = 0 (v4f writes them;
    # older cameras: the crossings' middle row / column)
    L = cam.get('lattice', {})
    bars_u = L.get('bars_mid_px') or [p[0] for p in cross[4]]
    bars_v = L.get('bars_centre_px') or [row[4][1] for row in cross]
    rbar_px, rriv_px = L.get('bar_radius_px', 14.2), L.get('rivet_radius_px', 28.7)
    prev = None
    if os.path.exists(PREV_CAMERA) and PREV_CAMERA != SRC_CAMERA:
        pcj = json.load(open(PREV_CAMERA))
        pc = pcj['lattice']['crossings_px']
        dv = cam.get('extra_top_px', 0) - pcj.get('extra_top_px', 0)   # v4h's canvas grew at the top: same pixel grid + dv
        prev = ([p[0] for p in pc[4]], [row[4][1] + dv for row in pc])
    tiles_art = tile_art_masks()

    # which crossings carry a rivet: v4f only the 7 x 7 inner ones (its outer bars were virtual, inside the rails);
    # v4g's outer bars are real (side and bottom, copied with their rivets, plus the two bottom corners), only the
    # top line is still virtual (inside the top rail). The SIDE bars' rivets (rows 1..7) bind the column 0 / 7 cells
    # like any inner rivet; the bottom bar's rivets (and the corners) belong with the bottom outer bar that row 7 is
    # already allowed to hang over (rails=False below), so they count only in the rows 0 / 7 overhang report
    outer_rivets = TAG.startswith(('board_v4g', 'board_v4h', 'board_v4i'))
    rivet_at = (lambda r, c: 0 < r < 8) if outer_rivets else (lambda r, c: 0 < r < 8 and 0 < c < 8)
    # v4h: the opening is SQUARE, so rows 0 / 7 no longer hang over the top / bottom outer bars: they are held to them
    # like every other bar (HOLD_ROWS: rails=True in the solve), and every crossing counts as a rivet: the bottom bar's
    # real rivets and the top line's (v4h: the copper bar clips under the top rail, a rivet as their stand-in; v4i: the
    # real top bar's rivets, the clips are gone)
    HOLD_ROWS = TAG.startswith(('board_v4h', 'board_v4i'))
    if HOLD_ROWS:
        rivet_at = lambda r, c: True

    # ---- the per-layout registration and the derived FRAME --------------------------------------------
    layouts, frames, checks = {}, {}, {}
    for kind in ('landscape', 'portrait', 'phone'):
        if kind == 'phone':
            m = PHONE_CELL['size'] / lat_w
            cell = dict(PHONE_CELL)
        elif kind in CHAIN_FIT:
            fit = CHAIN_FIT[kind]
            ch = cam['chains']
            cl = (ch['L']['top_pivot_px'][0] + ch['L']['bottom_anchor_px'][0]) / 2
            cr = (ch['R']['top_pivot_px'][0] + ch['R']['bottom_anchor_px'][0]) / 2
            m = (fit['x1'] - fit['x0']) / (cr - cl)
            ox = fit['x0'] - cl * m
            dead = fit['hud_top'] - fit['band_top'] - art_h * m
            top = fit['band_top'] + max(dead, 0) / (1 + fit['gap_ratio'])
            oy = top - art[1] * m
            size = lat_w * m
            cy = oy + (ly0 + ly1) / 2 * m
            cell = {'x': ox + lx0 * m, 'y': cy - size / 2, 'size': size}
            print(f'  {kind}: chain centrelines {cl:.2f} / {cr:.2f} render px -> {fit["x0"]} / {fit["x1"]} master; dead band {dead:.2f}, gap above {top - fit["band_top"]:.2f} below {fit["hud_top"] - top - art_h * m:.2f}')
        else:
            fit = ART_FIT[kind]
            m = (fit['x1'] - fit['x0']) / art_w
            ox = fit['x0'] - art[0] * m
            oy = fit['top'] - art[1] * m
            size = lat_w * m
            cy = oy + (ly0 + ly1) / 2 * m
            cell = {'x': ox + lx0 * m, 'y': cy - size / 2, 'size': size}
        ri, rg, rm = RATIOS[kind]
        inset = cell['size'] * ri
        pitch = cell['size'] / (8 - rg)
        gap = pitch * rg
        frames[kind] = {'x': cell['x'] - inset, 'y': cell['y'] - inset, 'width': cell['size'] + 2 * inset, 'height': cell['size'] + 2 * inset,
                        'inset': inset, 'cell': pitch - gap, 'gap': gap, 'margin': cell['size'] * rm}
        # placement: the lattice mid-height width on the cell area, centred vertically on it
        oyy = cell['y'] + (cell['size'] - lat_h * m) / 2
        mp = lambda u, v: (cell['x'] + (u - lx0) * m, oyy + (v - ly0) * m)
        a0, a1 = mp(art[0], art[1]), mp(art[2], art[3])
        # mismatch 1: what the tilt moved, crossing by crossing, against the flat lattice registered the same way
        fl0x, fl0y = flat_cross[0][0]
        fl1x, fl1y = flat_cross[-1][-1]
        fm = cell['size'] / (fl1x - fl0x)
        foy = cell['y'] + (cell['size'] - (fl1y - fl0y) * fm) / 2
        tilt_err = max(math.hypot(mp(*cross[r][c])[0] - (cell['x'] + (flat_cross[r][c][0] - fl0x) * fm), mp(*cross[r][c])[1] - (foy + (flat_cross[r][c][1] - fl0y) * fm)) for r in range(9) for c in range(9))
        corner = max(abs(mp(*cross[r][c])[0] - (cell['x'] + (cell['size'] if c else 0))) for r in (0, 8) for c in (0, 8))
        # mismatch 2: EVERY inner bar against the tile gap it should sit in. The tiles (BoardCells) are pitch apart,
        # centred on the cell area, so the gap between tile k-1 and k is centred at cell + k pitch - gap / 2; the
        # bars are at cell + k size / 8 (the lattice width IS the cell area), so even a perfect lattice is off by
        # |k - 4| gap / 8 (<= 3/8 gap) at the outer inner bars
        gx = lambda k: cell['x'] + k * pitch - gap / 2
        gy = lambda k: cell['y'] + k * pitch - gap / 2
        ex = [mp(bars_u[k], ly0)[0] - gx(k) for k in range(1, 8)]
        ey = [mp(lx0, bars_v[k])[1] - gy(k) for k in range(1, 8)]
        ux = [mp(bars_u[k], ly0)[0] - (cell['x'] + k * cell['size'] / 8) for k in range(1, 8)]
        uy = [mp(lx0, bars_v[k])[1] - (cell['y'] + k * cell['size'] / 8) for k in range(1, 8)]
        before = None
        if prev:
            before = max(max(abs(mp(prev[0][k], ly0)[0] - gx(k)) for k in range(1, 8)), max(abs(mp(lx0, prev[1][k])[1] - gy(k)) for k in range(1, 8)))
        worst = max(map(abs, ex + ey))
        layouts[kind] = {'m': m, 'art': {'x': a0[0], 'y': a0[1], 'right': a1[0], 'bottom': a1[1]}}
        print(f'  {kind}: m {m:.5f} art x {a0[0]:.2f}..{a1[0]:.2f} y {a0[1]:.2f}..{a1[1]:.2f}  cell area {cell["x"]:.2f},{cell["y"]:.2f} size {cell["size"]:.2f} pitch {pitch:.3f}')
        print(f'    tilt-induced lattice shift max {tilt_err:.2f} px, lattice corner vs cell area x max {corner:.2f} px (master)')
        print(f'    inner bars vs tile gaps (master px): x {[round(v, 2) for v in ex]} y {[round(v, 2) for v in ey]}  worst {worst:.2f} '
              f'(tol {BAR_TOL[kind]:.2f}) {"ok" if worst <= BAR_TOL[kind] else "FAIL"}; vs k size/8 max {max(map(abs, ux + uy)):.2f}'
              + (f'; {os.path.basename(PREV_CAMERA)} bars vs the same tile gaps: worst {before:.2f}' if before is not None else ''))
        print('    FRAME', json.dumps({k: round(v, 3) for k, v in frames[kind].items()}))
        # ---- the clear openings, for SYMBOL_FIT: each cell between its 4 bar centrelines (all 81 projected
        # crossings, so the tilt's keystone is in), less the bar radius; rivets at the 4 corners
        rb, rr = rbar_px * m, rriv_px * m
        cells = []
        for r in range(8):
            for c in range(8):
                pts = [mp(*cross[r + i][c + j]) for i in (0, 1) for j in (0, 1)]
                cells.append({'tile': (gx(c) + gap / 2 + (pitch - gap) / 2, gy(r) + gap / 2 + (pitch - gap) / 2),
                              'x0': max(pts[0][0], pts[2][0]) + rb, 'x1': min(pts[1][0], pts[3][0]) - rb,
                              'y0': max(pts[0][1], pts[1][1]) + rb, 'y1': min(pts[2][1], pts[3][1]) - rb,
                              'rivets': [p for p, (i, j) in zip(pts, ((0, 0), (0, 1), (1, 0), (1, 1))) if rivet_at(r + i, c + j)]})
        checks[kind] = {'cells': cells, 'pitch': pitch, 'gap': gap, 'rb': rb, 'rr': rr, 'worst_bar': worst, 'opening': min(min(c['x1'] - c['x0'], c['y1'] - c['y0']) for c in cells)}

    # ---- SYMBOL_FIT: the largest symbol scale (0.01 steps) whose art and badge clear every bar / rivet ----------
    def clear(kind, fit, rows=range(8), why=None, rails=False):
        """the smallest clearance (master px, beyond the margin) of any symbol art / badge to a bar edge or rivet.
        rails=False skips the TOP outer bar edge for row 0 and the BOTTOM one for row 7: the lattice is wider than
        tall (v4f 3.2 %, v4g 5.3 %) and the 8 square tile rows are registered to its width, so those two rows
        always hang over the top / bottom outer bars (the top one inside the top rail, the bottom one on the lower
        rail since v4g); no sensible symbol scale avoids that, it is reported separately (rail_overhang)."""
        ck = checks[kind]
        p, mg = ck['pitch'], FIT_MARGIN[kind]
        side = p * CELL_FILL * fit
        worst = 1e9
        for i, cl in enumerate(ck['cells']):
            if i // 8 not in rows:
                continue
            w0 = worst
            tx, ty = cl['tile']
            for name, (xs, ys) in tiles_art.items():
                # opaque pixels (texture fraction -0.5..0.5) -> master
                X, Y = tx + xs * side, ty + ys * side
                r_ = i // 8
                top = (Y - cl['y0']).min() if (rails or r_ != 0) else 1e9
                bot = (cl['y1'] - Y).min() if (rails or r_ != 7) else 1e9
                d = min((X - cl['x0']).min(), (cl['x1'] - X).min(), top, bot)
                what = 'bar'
                for (rx, ry) in cl['rivets']:
                    dr = (((X - rx) ** 2 + (Y - ry) ** 2) ** 0.5).min() - ck['rr']
                    if dr < d:
                        d, what = dr, 'rivet'
                if why is not None and d < worst:
                    why[:] = [i // 8, i % 8, name, what, round(d - mg, 2)]
                worst = min(worst, d)
            # the badge disc, top-right of the tile, size and offset scaled with the symbol
            bx, by = tx + BADGE['offset'] * p * fit, ty - BADGE['offset'] * p * fit
            br = BADGE['size'] * p * fit * BADGE['disc'] / 2
            d = min(bx - br - cl['x0'], cl['x1'] - bx - br, by - br - cl['y0'] if (rails or i // 8 != 0) else 1e9, cl['y1'] - by - br)
            what = 'badge-bar'
            for (rx, ry) in cl['rivets']:
                dr = math.hypot(bx - rx, by - ry) - br - ck['rr']
                if dr < d:
                    d, what = dr, 'badge-rivet'
            if why is not None and d < worst:
                why[:] = [i // 8, i % 8, 'badge', what, round(d - mg, 2)]
            worst = min(worst, d)
        return worst - mg

    symbol_fit = 1.0
    while symbol_fit > 0.5 and min(clear(k, symbol_fit, rails=HOLD_ROWS) for k in checks) < 0:
        symbol_fit = round(symbol_fit - 0.01, 2)
    print(f'SYMBOL_FIT {symbol_fit:.2f} (art = static tiles alpha > 128 + the badge disc; margins {FIT_MARGIN})')
    rail_overhang = {}
    for k in checks:
        why = []
        clear(k, symbol_fit + 0.01, range(8), why, rails=HOLD_ROWS)
        # rows 0 / 7 against the top / bottom outer bar edge (inside the rails) at the shipped fit
        rail_overhang[k] = round(-min(clear(k, symbol_fit, [0], rails=True), clear(k, symbol_fit, [7], rails=True)), 2)
        print(f'  {k}: the next step (fit {symbol_fit + 0.01:.2f}) would fail at row/col/art/what/clearance {why}; rows 0 / 7 vs the top / bottom outer bar edge: overhang {max(rail_overhang[k], 0):.2f} master px beyond the margin (clearance {max(-rail_overhang[k], 0):.2f}){" (held: square opening)" if HOLD_ROWS else " (inherent, see clear())"}')
    for k, ck in checks.items():
        p = ck['pitch']
        print(f'  {k}: pitch {p:.2f}, bar r {ck["rb"]:.2f}, rivet r {ck["rr"]:.2f}, narrowest clear opening {ck["opening"]:.2f} master px; '
              f'symbol sprite {p * CELL_FILL:.2f} -> {p * CELL_FILL * symbol_fit:.2f}, badge {BADGE["size"] * p:.2f} -> {BADGE["size"] * p * symbol_fit:.2f}; '
              f'clearance left {clear(k, symbol_fit, rails=HOLD_ROWS) + FIT_MARGIN[k]:.2f} (margin {FIT_MARGIN[k]:.2f}); at fit 1.00: {clear(k, 1.0, rails=HOLD_ROWS) + FIT_MARGIN[k]:.2f}')

    frame_spec, chain_spec, sizes = {}, {}, {}
    if not args.no_frame:
        frame = erase_leaned_links(Image.open(SRC_FRAME).convert('RGBA'))
        # the other grid steel, same crop and scale, under its suffix (a file swap switches the default)
        other = 'blue' if DEFAULT_GRID == 'neutral' else 'neutral'
        frame_other = erase_leaned_links(Image.open(GRID_SRC[other]).convert('RGBA')) if os.path.exists(GRID_SRC[other]) and GRID_SRC[other] != SRC_FRAME else None
        chains = Image.open(SRC_CHAINS).convert('RGBA')
        runs, period, phase = chain_runs(chains, cam)
        print(f'chain loop: two-link period {period} render px, tile phase y {phase}, strip clip {CHAIN_CLIP}')
        fbox = crop_box(frame.split()[-1].getbbox(), frame.size)
        half = chains.size[0] // 2
        cboxes = {}
        for side, (x0, x1) in (('L', (0, half)), ('R', (half, chains.size[0]))):
            b = chains_a.crop((x0, 0, x1, chains.size[1])).getbbox()
            cboxes[side] = crop_box((b[0] + x0, b[1], b[2] + x0, b[3]), chains.size)
        for kind in ('landscape', 'portrait', 'phone'):
            m = layouts[kind]['m'] * GROWTH[kind]  # master px per render px at the largest fit
            scale = m * DEVICE_PX
            cw, chh = fbox[2] - fbox[0], fbox[3] - fbox[1]
            tw, th = math.ceil(cw * scale), math.ceil(chh * scale)
            tex = frame.crop(fbox).resize((tw, th), Image.LANCZOS)
            sizes[f'ui/board-frame-{kind}.webp'] = save_webp(tex, f'ui/board-frame-{kind}.webp')
            if frame_other is not None:
                sizes[f'ui/board-frame-{kind}-{other}.webp'] = save_webp(frame_other.crop(fbox).resize((tw, th), Image.LANCZOS), f'ui/board-frame-{kind}-{other}.webp')
            frame_spec[kind] = {'crop': [fbox[0], fbox[1]], 'size': [cw, chh], 'tex': [tw, th]}
            # THE CHAIN LOOP: the seamless two-link tiles, L then R, power-of-two (the strip repeats it)
            sheet, parts, seam = chain_tile_sheet(runs, period, phase, scale)
            path = os.path.join(ASSETS, f'ui/board-chain-tile-{kind}.webp')
            sheet.save(path, 'WEBP', lossless=True, method=6)
            sizes[f'ui/board-chain-tile-{kind}.webp'] = os.path.getsize(path)
            chain_spec[kind] = {'tex': list(sheet.size), 'periodPx': period, 'phasePx': phase, 'halfWidthPx': CHAIN_HALF_W, 'clip': list(CHAIN_CLIP), **parts}
            print(f'{kind}: master/px {m:.5f}  frame tex {tw}x{th} ({tex.size[0] / cw:.4f}/px)  chain tile {sheet.size} (seam |d| L {seam["L"]} R {seam["R"]} of 255)')

    if not args.no_bg:
        bg = Image.open(SRC_BG).convert('RGB')
        sw, sh = bg.size
        for kind, (mw, mh) in MASTER.items():
            r = mw / mh
            cw, chh = (sw, round(sw / r)) if sw / sh < r else (round(sh * r), sh)
            cx = min(max(BG_CX[kind] * sw - cw / 2, 0), sw - cw)
            cy = min(max(BG_CY[kind] * sh - chh / 2, 0), sh - chh)
            crop = bg.crop((round(cx), round(cy), round(cx) + cw, round(cy) + chh))
            for mode in MODES:
                rel = f'backgrounds/{mode}-{kind}.webp'
                sizes[rel] = save_webp(crop, rel)
            print(f'bg {kind}: crop {cw}x{chh} at ({round(cx)}, {round(cy)})')

    for rel, n in sizes.items():
        print(f'  {rel}: {n / 1024:.1f} KiB')

    if not args.no_frame:
        ch = cam['chains']
        anchors = {s: {'top': ch[s]['top_pivot_px'], 'bottom': ch[s]['bottom_anchor_px']} for s in ('L', 'R')}
        spec = {
            'source': TAG,
            'tiltDeg': TILT_DEG,
            'render': {'width': cam['resolution'][0], 'height': cam['resolution'][1], 'pxPerUnit': cam['px_per_unit']},
            'lattice': {k: round(v, 3) for k, v in lat.items()},
            'art': list(art),
            # the four outer crossings (top-left, top-right, bottom-left, bottom-right), for the corner check
            'corners': [[round(v, 3) for v in cross[r][c]] for r, c in ((0, 0), (0, 8), (8, 0), (8, 8))],
            'frame': frame_spec,
            'chains': chain_spec,
            'anchors': anchors,
            'grid': DEFAULT_GRID,
            # every bar axis as projected: vertical bars (x) at the mid-height row, horizontal bars (y) at x = 0,
            # outer bars included (index 0 and 8); radii at the board centre
            'bars': {'x': [round(v, 3) for v in bars_u], 'y': [round(v, 3) for v in bars_v], 'barRadius': rbar_px, 'rivetRadius': rriv_px},
            'symbolFit': symbol_fit,
            # v4g: the side and bottom outer bars are real and carry rivets (every crossing but the top line)
            'outerRivets': outer_rivets,
            # v4h: square opening, rows 0 / 7 held to the top / bottom outer bars and every crossing a rivet (probe + fit)
            'holdRows': HOLD_ROWS,
            # all 81 projected bar crossings (rows top to bottom), for the probe's per-cell openings
            'crossings': [[[round(v, 2) for v in p] for p in row] for row in cross],
            # each static tile's opaque art box (alpha > 128) as fractions of its sprite, -0.5..0.5
            'symbolArt': {n: [round(float(xs.min()) - 0.5 / 128, 4), round(float(ys.min()) - 0.5 / 128, 4), round(float(xs.max()) + 0.5 / 128, 4), round(float(ys.max()) + 0.5 / 128, 4)] for n, (xs, ys) in tiles_art.items()},
        }
        spec['frameRects'] = {k: {kk: round(vv, 3) for kk, vv in v.items()} for k, v in frames.items()}
        body = json.dumps(spec, indent='\t')
        with open(SPEC_TS, 'w') as f:
            f.write(
                f'// GENERATED by tools/build_board_layers.py from {TAG}_camera.json: do not edit by hand, rerun the\n'
                f'// tool when the board renders change. Every number is in RENDER pixels of the {cam["resolution"][0]} x {cam["resolution"][1]} board render\n'
                '// (top-left origin) unless it says tex: texture pixels of the exported webp. lattice = the mid-height width\n'
                '// and the centre line of the outer bars; art = the frame + chains alpha bbox; frameRects = the FRAME\n'
                '// entries this registration derives (copied into layoutSpec.ts). game/layoutSpec.ts registers it.\n'
                f'export const BOARD_ART = {body} as const;\n'
            )
        print('wrote', os.path.relpath(SPEC_TS, APP))


if __name__ == '__main__':
    main()
