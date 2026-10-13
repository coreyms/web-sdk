#!/usr/bin/env python
"""Game assets for THE MANTICORE CREATURE from a rig drop (drop 3 and later), in the game's own atlas conventions.
A sibling in style of apps/manticore_mayhem/tools/build_flame_assets.py (same packer, same webp settings, same
TexturePacker JSON the game's loader already reads). It lives OUTSIDE the repo for now (prep work, 2026-10-12): when
the creature is wired, move it to apps/manticore_mayhem/tools/build_creature_assets.py and point --out at
static/assets/sprites/creature.

  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python build_creature_assets.py \
      --drops <folder holding drop-3, drop-3-night, drop-3-super, drop-3-epic> --out <folder> [--looks day,super,epic]
      [--full 640] [--phone 432] [--jobs 8] [--report-only]

INPUT (read only, never written), per look folder:
  meta.json                 canvas, feetRow, fps, clips (frames, loop, holdFrame, returnsTo, startsFrom, overlay),
                            shadow (canvas, scale, suffix). Frame counts are ALWAYS read from here.
  <clip>[-N].json / .png    the rig's own atlases (TexturePacker JSON Hash, multipack via related_multi_packs,
                            frames "<clip>/frame_NNNN.png", trimmed, straight alpha, 1024 canvas)
  <clip>_shadow.json/.png   the shadow atlases (256 canvas, drawn at scale 4, RGB 0, alpha = density)

OUTPUT, two tiers like the scene's (suffix '' = full, '-phone' = phone tier):
  <out>/<look>/creature-<look>-<clip>[-phone][-N].json|webp   one atlas per clip and look (N = 1, 2 .. only when a
                                                               clip does not fit one sheet under 4096), frames
                                                               creature_<look>_<clip>_<NNN> from 000, trimmed on
                                                               alpha 0, sourceSize = the tier's canvas
  <out>/shared/creature-shadow[-phone].json|webp              every clip's shadow frames, ONE atlas for all looks:
                                                               creature_shadow_<clip>_<NNN>; canvas = tier canvas / 4
                                                               so the loader keeps the rig's "scale 4" relation
  <out>/shared/creature-glow[-phone].json|webp                the charge_glow overlay, ONE atlas for all looks:
                                                               creature_glow_<NNN> (additive)
  <out>/creatureSpec.json, creatureSpec.ts                    the generated spec (the flameSpec.ts convention): canvas,
                                                               feet row, fps, clips, per tier the canvas and every
                                                               atlas's file, sheet size and bytes
  <out>/report.json                                           per look and tier: download bytes, GPU bytes, sheets

FRAME NAMES CARRY THE LOOK on purpose: game/deferredLoad.ts loadOne publishes a sheet's frames into
stateApp.loadedAssets by FRAME NAME (and Pixi caches textures by name), so two looks with the same frame names would
overwrite each other.

SHARED FILES. The rig renders shadows and charge_glow once (the day pass) and copies them into every look. This tool
checks that by content hash across the looks it was given and refuses to share anything that differs.

WHAT IS CHECKED AND PRINTED: every clip's frame count against meta.json and that its frames are contiguous; no sheet
over 4096; duplicate frames inside a clip are stored once (two names, one rectangle); each shipped webp against the
frames handed to the encoder (premultiplied, mean and worst of 255); totals per look and tier.

webp: quality 90, method 6, alpha_quality 100 (build_flame_assets.py Q_FLAME, board_relight.py Q_GEARS). The shadow
atlas has no colour, so it is lossless (it is small). No mipmaps are assumed (game/mipmaps.ts: art drawn near 1:1 has
none), so GPU bytes = sheet width x height x 4.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

LOOKS = {'day': 'drop-3', 'night': 'drop-3-night', 'super': 'drop-3-super', 'epic': 'drop-3-epic'}
Q_CREATURE = 90   # build_flame_assets.py Q_FLAME, board_relight.py Q_GEARS
MAX_SHEET = 4096  # house rule
PAD = 2           # transparent px round every frame in a sheet (build_flame_assets.py PAD)
TIERS = (('full', ''), ('phone', '-phone'))


def die(msg: str):
    sys.exit(f'build_creature_assets: {msg}')


# ---- reading a rig atlas ---------------------------------------------------------------------------------------------
def read_clip(folder: str, atlas: str, frames: int, stem: str) -> list[tuple[str, dict]]:
    """a clip's frames in order, each (png path, TexturePacker frame entry), following the multipack links"""
    seen, todo, found = set(), [atlas], {}
    while todo:
        name = todo.pop()
        if name in seen:
            continue
        seen.add(name)
        doc = json.load(open(os.path.join(folder, name)))
        png = os.path.join(folder, doc['meta']['image'])
        for key, entry in doc['frames'].items():
            if entry.get('rotated'):
                die(f'{folder}/{name}: {key} is rotated (not supported)')
            found[key] = (png, entry)
        todo.extend(doc['meta'].get('related_multi_packs', []))
    out = []
    for n in range(1, frames + 1):
        key = stem.format(n=n)
        if key not in found:
            die(f'{folder}: {key} is missing ({atlas}; meta.json says {frames} frames)')
        out.append(found[key])
    if len(found) != frames:
        die(f'{folder}/{atlas}: {len(found)} frames in the atlas, meta.json says {frames}')
    return out


_sheets: dict[str, Image.Image] = {}


def sheet(path: str) -> Image.Image:
    if path not in _sheets:
        if len(_sheets) > 3:
            _sheets.clear()
        _sheets[path] = Image.open(path).convert('RGBA')
    return _sheets[path]


def frame_on_canvas(png: str, entry: dict, canvas: tuple[int, int]) -> Image.Image:
    """the frame put back on its own canvas (straight alpha)"""
    f, sss, src = entry['frame'], entry['spriteSourceSize'], entry['sourceSize']
    if (src['w'], src['h']) != tuple(canvas):
        die(f'{png}: sourceSize {src} is not the canvas {canvas}')
    im = Image.new('RGBA', canvas, (0, 0, 0, 0))
    im.paste(sheet(png).crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])), (sss['x'], sss['y']))
    return im


# ---- packing (build_flame_assets.py shelf_pack / pack, plus pages) ---------------------------------------------------
def shelf_pack(sizes, width):
    order = sorted(range(len(sizes)), key=lambda k: (-sizes[k][1], -sizes[k][0]))
    pos = [(0, 0)] * len(sizes)
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


def pack(sizes):
    """the smallest sheet under MAX_SHEET a side, by area, over a sweep of widths; None when it does not fit one"""
    best = None
    for width in range(max(w for w, _ in sizes), MAX_SHEET + 1, 8):
        pos, aw, ah = shelf_pack(sizes, width)
        if ah <= MAX_SHEET and aw <= MAX_SHEET and (best is None or aw * ah < best[1] * best[2]):
            best = (pos, aw, ah)
    return best


def pack_pages(sizes):
    """the fewest pages (frames kept in order, split evenly) that each fit one sheet: [(first, last+1, pos, w, h)]"""
    n = len(sizes)
    for pages in range(1, n + 1):
        cuts = [round(n * k / pages) for k in range(pages + 1)]
        out = []
        for a, b in zip(cuts, cuts[1:]):
            got = pack(sizes[a:b])
            if got is None:
                break
            out.append((a, b, *got))
        else:
            return out
    die('a single frame does not fit a 4096 sheet')


# ---- one atlas -------------------------------------------------------------------------------------------------------
def build_atlas(job: dict) -> dict:
    """one clip (or the shared shadow / glow set) at one tier. job: out dir, base name, frames [(name, png, entry)],
    source canvas, tier canvas, lossless, report-only"""
    canvas = tuple(job['canvas'])
    size = tuple(job['size'])
    cells, boxes, names = [], [], []
    alias: dict[str, int] = {}
    index = []  # per frame: which stored cell
    for name, png, entry in job['frames']:
        im = frame_on_canvas(png, entry, canvas)
        if size != canvas:
            im = im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
        a = np.asarray(im)[..., 3]
        ys, xs = np.nonzero(a)
        if not len(xs):
            box = (0, 0, 1, 1)
        else:
            box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        cell = im.crop(box)
        key = hashlib.md5(cell.tobytes() + repr(box).encode()).hexdigest()
        if key not in alias:
            alias[key] = len(cells)
            cells.append(cell)
            boxes.append(box)
        index.append(alias[key])
        names.append(name)
    pages = pack_pages([(c.size[0] + PAD, c.size[1] + PAD) for c in cells])
    sheets = []
    files = []
    for p, (a, b, pos, aw, ah) in enumerate(pages):
        suffix = '' if len(pages) == 1 else f'-{p + 1}'
        base = f"{job['base']}{suffix}"
        files.append(base)
    for p, (a, b, pos, aw, ah) in enumerate(pages):
        base = files[p]
        atlas = Image.new('RGBA', (aw, ah), (0, 0, 0, 0))
        frames = {}
        for k in range(a, b):
            atlas.paste(cells[k], pos[k - a])
        for n, name in enumerate(names):
            k = index[n]
            if not a <= k < b:
                continue
            (px, py), box = pos[k - a], boxes[k]
            w, h = cells[k].size
            frames[name] = {'frame': {'x': px, 'y': py, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                            'spriteSourceSize': {'x': box[0], 'y': box[1], 'w': w, 'h': h}, 'sourceSize': {'w': size[0], 'h': size[1]}}
        used = sum(cells[k].size[0] * cells[k].size[1] for k in range(a, b)) / (aw * ah)
        row = {'file': base, 'sheet': [aw, ah], 'frames': len(frames), 'cells': b - a, 'gpuBytes': aw * ah * 4, 'used': round(used, 3)}
        if not job['report_only']:
            image = base + '.webp'
            path = os.path.join(job['out'], image)
            if job['lossless']:
                atlas.save(path, 'WEBP', lossless=True, quality=100, method=6, exact=True)
            else:
                atlas.save(path, 'WEBP', quality=Q_CREATURE, method=6, alpha_quality=100)
            meta = {'image': image, 'format': 'RGBA8888', 'size': {'w': aw, 'h': ah}, 'scale': '1',
                    'pngHash': hashlib.md5(open(path, 'rb').read()).hexdigest()[:8]}
            if len(pages) > 1:
                meta['related_multi_packs'] = [f + '.json' for f in files if f != base]
            jpath = os.path.join(job['out'], base + '.json')
            open(jpath, 'w').write(json.dumps({'frames': frames, 'meta': meta}, indent=1) + '\n')
            got = np.asarray(Image.open(path).convert('RGBa')).astype(np.float64)
            err = np.abs(got - np.asarray(atlas.convert('RGBa')).astype(np.float64))
            row.update(webpBytes=os.path.getsize(path), jsonBytes=os.path.getsize(jpath), errMean=round(float(err.mean()), 3), errMax=int(err.max()))
        sheets.append(row)
    return {'key': job['key'], 'sheets': sheets, 'frames': len(names), 'stored': len(cells)}


def md5(path: str) -> str:
    return hashlib.md5(open(path, 'rb').read()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--drops', required=True, help='the folder that holds the look folders (drop-3, drop-3-night, ...)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--looks', default='day,night,super,epic')
    ap.add_argument('--full', type=int, default=640, help='the full tier canvas, px (the rig canvas is 1024)')
    ap.add_argument('--phone', type=int, default=432, help='the phone tier canvas, px')
    ap.add_argument('--jobs', type=int, default=8)
    ap.add_argument('--report-only', action='store_true', help='pack and count, write no image')
    args = ap.parse_args()
    looks = [l for l in args.looks.split(',') if l]
    for l in looks:
        if l not in LOOKS:
            die(f'unknown look {l}')
    tiers = {'full': args.full, 'phone': args.phone}
    for name, t in tiers.items():
        if t % 4:
            die(f'the {name} tier canvas {t} is not a multiple of 4 (the shadow canvas is a quarter of it)')
    out = os.path.abspath(os.path.expanduser(args.out))
    metas = {}
    for l in looks:
        folder = os.path.join(os.path.expanduser(args.drops), LOOKS[l])
        if not os.path.isfile(os.path.join(folder, 'meta.json')):
            die(f'{folder}/meta.json is missing')
        metas[l] = (folder, json.load(open(os.path.join(folder, 'meta.json'))))
        if metas[l][1].get('look') != l:
            die(f"{folder}/meta.json says look {metas[l][1].get('look')}, expected {l}")
    first = metas[looks[0]][1]
    canvas = tuple(first['canvas'])
    if canvas[0] != canvas[1]:
        die('the canvas is not square')
    for l in looks:
        m = metas[l][1]
        for k in ('canvas', 'feetRow', 'contactX', 'fps', 'shadow'):
            if m[k] != first[k]:
                die(f'{l}: meta.json {k} differs from {looks[0]}')
        if {c: (v['frames'], v.get('holdFrame')) for c, v in m['clips'].items()} != {c: (v['frames'], v.get('holdFrame')) for c, v in first['clips'].items()}:
            die(f'{l}: the clips differ from {looks[0]}')
    clips = first['clips']
    overlays = [c for c, v in clips.items() if v.get('overlay')]
    colour = [c for c in clips if c not in overlays]
    shadowed = [c for c, v in clips.items() if v.get('shadowAtlas')]
    scanvas = tuple(first['shadow']['canvas'])

    # the shared files must be the same bytes in every look given
    shared_src = metas[looks[0]][0]
    for c in overlays + [f'{c}_shadow' for c in shadowed]:
        hashes = {l: md5(os.path.join(metas[l][0], f'{c}.png')) for l in looks}
        if len(set(hashes.values())) != 1:
            die(f'{c}.png differs between looks {hashes}: it cannot be shared, give it a per look atlas')
    print(f'shared across {", ".join(looks)} (same bytes in every look): {", ".join(overlays)} and {len(shadowed)} shadow atlases')

    jobs = []
    for tier, suffix in TIERS:
        t = tiers[tier]
        for l in looks:
            folder = metas[l][0]
            os.makedirs(os.path.join(out, l), exist_ok=True)
            for c in colour:
                src = read_clip(folder, clips[c]['atlas'], clips[c]['frames'], c + '/frame_{n:04d}.png')
                jobs.append({'key': [tier, l, c], 'out': os.path.join(out, l), 'base': f'creature-{l}-{c}{suffix}',
                             'frames': [(f'creature_{l}_{c}_{n:03d}', png, e) for n, (png, e) in enumerate(src)],
                             'canvas': canvas, 'size': (t, t), 'lossless': False, 'report_only': args.report_only})
        os.makedirs(os.path.join(out, 'shared'), exist_ok=True)
        for c in overlays:
            src = read_clip(shared_src, clips[c]['atlas'], clips[c]['frames'], c + '/frame_{n:04d}.png')
            name = 'glow' if c == 'charge_glow' else c
            jobs.append({'key': [tier, 'shared', c], 'out': os.path.join(out, 'shared'), 'base': f'creature-{name}{suffix}',
                         'frames': [(f'creature_{name}_{n:03d}', png, e) for n, (png, e) in enumerate(src)],
                         'canvas': canvas, 'size': (t, t), 'lossless': False, 'report_only': args.report_only})
        frames = []
        for c in shadowed:
            src = read_clip(shared_src, clips[c]['shadowAtlas'], clips[c]['frames'], c + '/frame_{n:04d}_shadow.png')
            frames += [(f'creature_shadow_{c}_{n:03d}', png, e) for n, (png, e) in enumerate(src)]
        jobs.append({'key': [tier, 'shared', 'shadow'], 'out': os.path.join(out, 'shared'), 'base': f'creature-shadow{suffix}', 'frames': frames,
                     'canvas': scanvas, 'size': (t // 4, t // 4), 'lossless': True, 'report_only': args.report_only})

    # the biggest first, so the pool's tail is short
    jobs.sort(key=lambda j: -len(j['frames']) * j['size'][0] ** 2)
    with Pool(args.jobs) as pool:
        done = []
        for r in pool.imap_unordered(build_atlas, jobs):
            done.append(r)
            s = r['sheets']
            print(f"  {'/'.join(r['key']):28s} {r['frames']:3d} frames ({r['stored']} stored), " + ', '.join(f"{x['sheet'][0]} x {x['sheet'][1]}" for x in s)
                  + (f", {sum(x['webpBytes'] for x in s) / 1024:.0f} KiB, encoder error mean {max(x['errMean'] for x in s)} worst {max(x['errMax'] for x in s)} of 255" if not args.report_only else ''), flush=True)
    by = {tuple(r['key']): r for r in done}

    # ---- the spec and the report -------------------------------------------------------------------------------------
    spec = {
        'source': {l: metas[l][1].get('drop', LOOKS[l]) for l in looks},
        'canvas': list(canvas), 'feetRow': first['feetRow'], 'feetCol': canvas[0] // 2, 'contactX': first['contactX'], 'fps': first['fps'],
        'shadow': {'canvasShare': 0.25, 'scale': first['shadow']['scale']},
        'clips': {c: {k: v[k] for k in ('frames', 'loop', 'holdFrame', 'returnsTo', 'startsFrom', 'overlay', 'overlayOf') if k in v} | {'shadow': c in shadowed} for c, v in clips.items()},
        'looks': looks,
        'frameName': {'colour': 'creature_<look>_<clip>_<NNN>', 'shadow': 'creature_shadow_<clip>_<NNN>', 'glow': 'creature_glow_<NNN>'},
        'tiers': {},
    }
    report = {'tiers': {}, 'units': 'bytes; GPU = sheet width x height x 4 (RGBA8, no mipmaps)'}
    for tier, suffix in TIERS:
        t = tiers[tier]
        T = spec['tiers'][tier] = {'canvas': [t, t], 'scale': t / canvas[0], 'shadowCanvas': [t // 4, t // 4], 'looks': {}, 'shared': {}}
        R = report['tiers'][tier] = {'canvas': t, 'looks': {}, 'shared': {}}
        for c in overlays + ['shadow']:
            r = by[(tier, 'shared', c)]
            T['shared']['glow' if c == 'charge_glow' else c] = [{'file': f"shared/{x['file']}.json", 'sheet': x['sheet']} for x in r['sheets']]
            R['shared'][c] = r['sheets']
        for l in looks:
            T['looks'][l] = {c: [{'file': f"{l}/{x['file']}.json", 'sheet': x['sheet']} for x in by[(tier, l, c)]['sheets']] for c in colour}
            rows = [x for c in colour for x in by[(tier, l, c)]['sheets']]
            R['looks'][l] = {'sheets': len(rows), 'gpuBytes': sum(x['gpuBytes'] for x in rows), 'downloadBytes': sum(x.get('webpBytes', 0) + x.get('jsonBytes', 0) for x in rows),
                             'clips': {c: by[(tier, l, c)]['sheets'] for c in colour}}
        srows = [x for v in R['shared'].values() for x in v]
        R['sharedTotal'] = {'sheets': len(srows), 'gpuBytes': sum(x['gpuBytes'] for x in srows), 'downloadBytes': sum(x.get('webpBytes', 0) + x.get('jsonBytes', 0) for x in srows)}
    open(os.path.join(out, 'report.json'), 'w').write(json.dumps(report, indent=1) + '\n')
    if not args.report_only:
        open(os.path.join(out, 'creatureSpec.json'), 'w').write(json.dumps(spec, indent=1) + '\n')
        head = ('// GENERATED by build_creature_assets.py from the rig drop\'s meta.json and atlases: do not edit by hand, rerun the\n'
                '// tool when a new drop lands. Clip facts (frames, holdFrame, returnsTo) are the rig\'s meta.json, 1 based frame\n'
                '// numbers as the rig counts them; atlas frame names count from 000. canvas / feetRow / contactX are px of the rig\'s\n'
                '// 1024 canvas; tiers.<tier>.canvas is that canvas in texels, and every atlas frame\'s sourceSize is it.\n')
        open(os.path.join(out, 'creatureSpec.ts'), 'w').write(head + 'export const CREATURE_SPEC = ' + json.dumps(spec, indent='\t') + ' as const;\n')

    print()
    for tier, _ in TIERS:
        R = report['tiers'][tier]
        st = R['sharedTotal']
        print(f"{tier} tier, canvas {R['canvas']} px: shared (shadows + glow) {st['sheets']} sheets, {st['downloadBytes'] / 1e6:.2f} MB download, {st['gpuBytes'] / 1e6:.1f} MB ({st['gpuBytes'] / 2**20:.1f} MiB) on the GPU")
        for l in looks:
            x = R['looks'][l]
            g = x['gpuBytes'] + st['gpuBytes']
            print(f"  {l:6s} {x['sheets']} sheets, {x['downloadBytes'] / 1e6:.2f} MB download, {x['gpuBytes'] / 1e6:.1f} MB GPU; with the shared set {g / 1e6:.1f} MB ({g / 2**20:.1f} MiB)")


if __name__ == '__main__':
    main()
