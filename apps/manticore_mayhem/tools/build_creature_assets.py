#!/usr/bin/env python
"""Game assets for THE MANTICORE CREATURE from a rig drop (drop 3 and later), in the game's own atlas conventions.

CHANGED 2026-10-13 FOR DROP 4 (10 clips: sting_recrouch is new, the roar is 53 frames). The clips were always read from
meta.json, so the tenth clip and the longer roar need no special case; what changed is:
  - the look folders are <--drop>, <--drop>-night, -super, -epic (default drop-4; was fixed to drop-3)
  - the spec carries the new clip fields follows / followsFrame / returnsToFrame, and the looks are checked to agree on them
  - two OPTIONAL memory levers, both off by default (the default output is what drop 3's build would have made):
      --clip-size roar=544:368        one clip at a smaller canvas than its tier (full:phone, multiples of 4). Its frames
                                      carry that sourceSize; game/creature.ts already scales a sprite by canvas / orig.width
                                      on every frame swap, so the loader needs nothing. The shadow atlas is not touched.
      --thin roar=37:2                from rig frame 37 on keep every 2nd frame and HOLD it for the ones dropped: the
                                      dropped frames keep their NAMES and point at the kept frame's rectangle (two names,
                                      one rectangle, as duplicate frames always were), so the loader needs nothing. The
                                      clip's shadow frames are thinned the same way. The LAST frame is always kept.

A sibling in style of apps/manticore_mayhem/tools/build_flame_assets.py (same packer, same TexturePacker JSON the
game's loader already reads). Until 2026-10-15 the drop 4 version lived in ~/Desktop/Manticore Mayhem/creature/
prep_2026-10-13/ (the in-repo copy was the drop 3 one); this is that file with the 2026-10-15 encode change. The
shipped set (drop 4 + the glow add-on) is rebuilt with:

  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/build_creature_assets.py \
      --drops /Volumes/manticore/rig-review/2026-10-13 --looks day,super,epic \
      --addon /Volumes/manticore/rig-review/2026-10-13/drop-4-glow-addon --out <scratch folder>
  then copy <out>/{day,super,epic,shared} into static/assets/sprites/creature and <out>/creatureSpec.ts into src/game.

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

THE GLOW ADD-ON (2026-10-13, drop-4-glow-addon: sting_hit_glow 9 frames, sting_recrouch_glow 3 frames).
  --addon <folder>      its meta_addon.json `clips` are merged into every look's clips after charge_glow (and checked
                        against the folder's own merged meta/<look>/meta.json); its atlases are read from that folder.
                        EVERY overlay clip now goes into the ONE shared glow atlas creature-glow[-phone] (it was
                        charge_glow alone): charge_glow keeps its names creature_glow_<NNN>, an add-on overlay is
                        creature_glow_<the body clip it lies over>_<NNN> (creature_glow_sting_hit_000 ..). The spec
                        carries overlayFrames / gain / gainBaked.
  --only-shared         build the shared atlases only (shadows, glow) and take every look's rows from the report.json
                        already in --out: the look atlases are not read, resized or written. For adding the glow
                        add-on to a finished build without touching it.

WHAT IS CHECKED AND PRINTED: every clip's frame count against meta.json and that its frames are contiguous; no sheet
over 4096; duplicate frames inside a clip are stored once (two names, one rectangle); each shipped webp against the
frames handed to the encoder (premultiplied, mean and worst of 255); totals per look and tier.

webp: the look atlases quality 85, method 6, alpha_quality 70 (Corey 2026-10-15, A1 of the download analysis, after the
side-by-side samples: "q85 + alpha_q 70 is acceptable"; was quality 90, alpha_quality 100). The shared glow atlas keeps
quality 90, alpha_quality 100 (an additive overlay, not in the samples). The shadow atlas has no colour, so it is
lossless (it is small). No mipmaps are assumed (game/mipmaps.ts: art drawn near 1:1 has
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

LOOK_SUFFIX = {'day': '', 'night': '-night', 'super': '-super', 'epic': '-epic'}
LOOKS: dict[str, str] = {}  # look -> folder name, filled from --drop
CLIP_FACTS = ('frames', 'holdFrame', 'returnsTo', 'returnsToFrame', 'startsFrom', 'follows', 'followsFrame', 'overlay', 'overlayOf', 'overlayFrames', 'gainBaked')
Q_CREATURE = 85   # the look atlases (Corey 2026-10-15, A1; was 90 = build_flame_assets.py Q_FLAME)
A_CREATURE = 70   # their alpha_quality (Corey 2026-10-15, A1; was 100)
Q_GLOW, A_GLOW = 90, 100  # the shared additive glow atlas keeps the old settings (not part of A1's samples)
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
                q, aq = job.get('quality', (Q_CREATURE, A_CREATURE))
                atlas.save(path, 'WEBP', quality=q, method=6, alpha_quality=aq)
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
    ap.add_argument('--drops', required=True, help='the folder that holds the look folders (drop-4, drop-4-night, ...)')
    ap.add_argument('--drop', default='drop-4', help='the day look folder name; the others are <name>-night, -super, -epic')
    ap.add_argument('--clip-size', action='append', default=[], metavar='CLIP=FULL:PHONE', help='one clip at its own canvas, px per tier')
    ap.add_argument('--thin', action='append', default=[], metavar='CLIP=FROM:STEP', help='from rig frame FROM keep every STEPth frame, hold it for the rest')
    ap.add_argument('--out', required=True)
    ap.add_argument('--looks', default='day,night,super,epic')
    ap.add_argument('--full', type=int, default=640, help='the full tier canvas, px (the rig canvas is 1024)')
    ap.add_argument('--phone', type=int, default=432, help='the phone tier canvas, px')
    ap.add_argument('--jobs', type=int, default=8)
    ap.add_argument('--addon', default='', help='a folder with meta_addon.json and its overlay atlases (the glow add-on)')
    ap.add_argument('--only-shared', action='store_true', help='build the shared atlases only; the looks come from the report.json in --out')
    ap.add_argument('--report-only', action='store_true', help='pack and count, write no image')
    args = ap.parse_args()
    looks = [l for l in args.looks.split(',') if l]
    LOOKS.update({l: args.drop + sfx for l, sfx in LOOK_SUFFIX.items()})
    clip_size = {}
    for item in args.clip_size:
        c, v = item.split('=')
        f, p = (int(x) for x in v.split(':'))
        if f % 4 or p % 4:
            die(f'--clip-size {item}: not multiples of 4')
        clip_size[c] = {'full': f, 'phone': p}
    thin = {}
    for item in args.thin:
        c, v = item.split('=')
        thin[c] = tuple(int(x) for x in v.split(':'))
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
        if args.addon:
            add = json.load(open(os.path.join(os.path.expanduser(args.addon), 'meta_addon.json')))['clips']
            merged = {}
            for c, v in metas[l][1]['clips'].items():
                merged[c] = v
                if c == 'charge_glow':
                    merged.update(add)
            metas[l][1]['clips'] = merged
            theirs = os.path.join(os.path.expanduser(args.addon), 'meta', l, 'meta.json')
            if os.path.isfile(theirs) and json.load(open(theirs)) != metas[l][1]:
                die(f'{theirs} is not {folder}/meta.json + meta_addon.json')
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
        facts = lambda mm: {c: tuple(v.get(k) for k in CLIP_FACTS) for c, v in mm['clips'].items()}
        if facts(m) != facts(first):
            die(f'{l}: the clips differ from {looks[0]}')
    clips = first['clips']
    overlays = [c for c, v in clips.items() if v.get('overlay')]
    colour = [c for c in clips if c not in overlays]
    shadowed = [c for c, v in clips.items() if v.get('shadowAtlas')]
    scanvas = tuple(first['shadow']['canvas'])
    for c in list(clip_size) + list(thin):
        if c not in clips:
            die(f'no clip {c} in meta.json')

    def held(c: str, src: list) -> list:
        """--thin: a dropped frame is drawn from the last kept frame before it (the clip's last frame is always kept)"""
        if c not in thin:
            return src
        start, step = thin[c]
        out, keep = [], 0
        for i in range(len(src)):
            n = i + 1
            if n < start or (n - start) % step == 0 or n == len(src):
                keep = i
            out.append(src[keep])
        return out

    # the shared files must be the same bytes in every look given
    shared_src = metas[looks[0]][0]
    addon_clips = set(json.load(open(os.path.join(os.path.expanduser(args.addon), 'meta_addon.json')))['clips']) if args.addon else set()
    src_of = lambda c: os.path.expanduser(args.addon) if c in addon_clips else shared_src
    for c in [c for c in overlays if c not in addon_clips] + [f'{c}_shadow' for c in shadowed]:
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
            for c in ([] if args.only_shared else colour):
                src = held(c, read_clip(folder, clips[c]['atlas'], clips[c]['frames'], c + '/frame_{n:04d}.png'))
                t = clip_size.get(c, tiers)[tier]
                jobs.append({'key': [tier, l, c], 'out': os.path.join(out, l), 'base': f'creature-{l}-{c}{suffix}',
                             'frames': [(f'creature_{l}_{c}_{n:03d}', png, e) for n, (png, e) in enumerate(src)],
                             'canvas': canvas, 'size': (t, t), 'lossless': False, 'report_only': args.report_only})
        t = tiers[tier]
        os.makedirs(os.path.join(out, 'shared'), exist_ok=True)
        gframes = []
        for c in overlays:
            if clips[c].get('overlay') != 'additive':
                die(f'{c}: overlay {clips[c].get("overlay")} (only additive is known)')
            src = read_clip(src_of(c), clips[c]['atlas'], clips[c]['frames'], c + '/frame_{n:04d}.png')
            # charge_glow keeps the names the game already reads; any other overlay is named for the body clip under it
            stem = 'creature_glow' if c == 'charge_glow' else f"creature_glow_{clips[c]['overlayOf']}"
            gframes += [(f'{stem}_{n:03d}', png, e) for n, (png, e) in enumerate(src)]
        jobs.append({'key': [tier, 'shared', 'glow'], 'out': os.path.join(out, 'shared'), 'base': f'creature-glow{suffix}', 'frames': gframes,
                     'canvas': canvas, 'size': (t, t), 'lossless': False, 'quality': (Q_GLOW, A_GLOW), 'report_only': args.report_only})
        frames = []
        for c in shadowed:
            src = held(c, read_clip(shared_src, clips[c]['shadowAtlas'], clips[c]['frames'], c + '/frame_{n:04d}_shadow.png'))
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
    if args.only_shared:
        had = json.load(open(os.path.join(out, 'report.json')))
        if (had['tiers']['full']['canvas'], had['tiers']['phone']['canvas']) != (args.full, args.phone) or sorted(had['tiers']['full']['looks']) != sorted(looks):
            die('--only-shared: the report.json in --out is of another build (tier sizes or looks)')
        for tier, _ in TIERS:
            for l in looks:
                for c in colour:
                    by[(tier, l, c)] = {'sheets': had['tiers'][tier]['looks'][l]['clips'][c]}

    # ---- the spec and the report -------------------------------------------------------------------------------------
    spec = {
        'source': {l: metas[l][1].get('drop', LOOKS[l]) for l in looks},
        'canvas': list(canvas), 'feetRow': first['feetRow'], 'feetCol': canvas[0] // 2, 'contactX': first['contactX'], 'fps': first['fps'],
        'shadow': {'canvasShare': 0.25, 'scale': first['shadow']['scale']},
        'clips': {c: {k: v[k] for k in ('frames', 'loop', 'holdFrame', 'returnsTo', 'returnsToFrame', 'startsFrom', 'follows', 'followsFrame', 'overlay', 'overlayOf', 'overlayFrames', 'gain', 'gainBaked') if k in v} | {'shadow': c in shadowed} for c, v in clips.items()},
        'looks': looks,
        **({'held': {c: {'from': v[0], 'every': v[1]} for c, v in thin.items()}} if thin else {}),
        'frameName': {'colour': 'creature_<look>_<clip>_<NNN>', 'shadow': 'creature_shadow_<clip>_<NNN>', 'glow': 'creature_glow_<NNN>', 'glowOver': 'creature_glow_<body clip>_<NNN>'},
        'glow': {c: ('creature_glow' if c == 'charge_glow' else f"creature_glow_{clips[c]['overlayOf']}") for c in overlays},
        'tiers': {},
    }
    report = {'drop': args.drop, 'clipSize': clip_size, 'thin': {c: list(v) for c, v in thin.items()}, 'tiers': {}, 'units': 'bytes; GPU = sheet width x height x 4 (RGBA8, no mipmaps)'}
    for tier, suffix in TIERS:
        t = tiers[tier]
        T = spec['tiers'][tier] = {'canvas': [t, t], 'scale': t / canvas[0], 'shadowCanvas': [t // 4, t // 4], 'looks': {}, 'shared': {}}
        if clip_size:
            T['clipCanvas'] = {c: [v[tier], v[tier]] for c, v in clip_size.items()}
        R = report['tiers'][tier] = {'canvas': t, 'looks': {}, 'shared': {}}
        for c in ['glow', 'shadow']:
            r = by[(tier, 'shared', c)]
            T['shared'][c] = [{'file': f"shared/{x['file']}.json", 'sheet': x['sheet']} for x in r['sheets']]
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
