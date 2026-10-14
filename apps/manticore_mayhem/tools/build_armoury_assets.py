#!/usr/bin/env python
"""THE ARMOURY's pictures (the feature menu; spec ~/Desktop/Manticore Mayhem/feedback/armoury_build_r1/SPEC.md section 3).

  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/build_armoury_assets.py            the small pictures, heroes.json {}
  ... tools/build_armoury_assets.py --grids crown,dagger      also pack those heroes' angle grids (spec commit 11)
  ... tools/build_armoury_assets.py --grids all
  ... tools/build_armoury_assets.py --measure DIR             pack every grid into DIR (not static/) and print the sizes
  node scripts/stamp-assets.mjs                                (afterwards, from the app folder)

SOURCES (read only, never written; they stay in the Desktop working folder, spec 3.4):
  ~/Desktop/Manticore Mayhem/images/feature_menu_heroes_r1/<folder>/   manifest.json + frames (+ flat.png), per hero
  ~/Desktop/Manticore Mayhem/images/feature_menu_r1/src/assets/        plaque.webp, crest-day.png
Which folder each hero comes from: HERO_FOR below (the prototype's choice, feature_menu_r2/build.py HERO_FOR: the
dagger at 2.5 degree steps for SUPER, the crown at 1 degree of yaw for EPIC; the manticore is scrapped as a hero).

OUTPUTS, static/assets/ui/armoury/ (only finished .webp and one .json; nothing else may go in, spec 3.4):
  plaque.webp              the price plaque, the prototype's file byte for byte (620 x 123)
  crest.webp               the header crest, from crest-day.png, CREST_H px high (the prototype's header art)
  thumbs.webp              the tile and confirm card pictures: one sheet, six THUMB px cells in tray order
                           (game/armouryData.ts ARMOURY_ART_ORDER), each picture contained and centred in its cell. The
                           picture is the set's flat.png where it has one, else its straight-on frame (the prototype's art())
  hero-<art>.webp          the flat hero, full tier: the grid's STRAIGHT-ON FRAME on the grid's own canvas, HERO_H px high,
                           so a grid that arrives later swaps in with nothing shifting
  hero-<art>-half.webp     the same, phone tier (game/deviceTier.ts PHONE_TIER), HERO_HALF_H px high
  heroes.json              { "<art>": { cols, rows, yaw, pitch, ar, cell, grid, turn, turnCell } } for the heroes whose
                           grids are packed (ui/armoury/heroGrid.ts parseHeroes); {} = flat art everywhere
  grid-<art>.webp          (--grids) the whole set, cols x rows cells in manifest order, row by row, no trimming, no
                           padding; cells GRID_H px high (frames are only scaled DOWN, never up)
  turn-<art>.webp          (--grids) the phone tier's strip: the pitch 0 row only, TURN_H px high

Sizes are kept in step by hand with constants.ts ARMOURY.assets. Every encode is WebP; frames are re-encoded and scaled
down, never sharpened or upscaled. The folder must stay under FOLDER_MAX_MB (scripts/stamp-assets.mjs fails above it)."""
import argparse, io, json, os, shutil, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, 'static', 'assets', 'ui', 'armoury')
DESK = os.path.expanduser('~/Desktop/Manticore Mayhem/images')
HEROES = os.path.join(DESK, 'feature_menu_heroes_r1')
R1 = os.path.join(DESK, 'feature_menu_r1', 'src', 'assets')

# constants.ts ARMOURY.assets (kept in step by hand)
THUMB = 256
HERO_H = 640
HERO_HALF_H = 320
CREST_H = 96
GRID_H = 640          # owner 2026-10-13 22:18: "640px"
TURN_H = 320
FOLDER_MAX_MB = 7
WEBP_MAX = 16383      # the WebP format's largest side

# tray order (game/armouryData.ts ARMOURY_MODES): art key -> hero folder
ORDER = ['crest-day', 'crest-fire', 'standard', 'dagger', 'crown', 'seal']
HERO_FOR = {
    'crest-day': 'crest-day',
    'crest-fire': 'crest-fire',
    'standard': 'standard',
    'dagger': 'dagger-super-yaw2.5',
    'crown': 'crown-epic-yaw1',
    'seal': 'seal',
}


def webp(im, q, method=6):
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=method)
    return b.getvalue()


def write(path, data):
    with open(path, 'wb') as f:
        f.write(data)
    return len(data)


def manifest(art):
    d = os.path.join(HEROES, HERO_FOR[art])
    with open(os.path.join(d, 'manifest.json'), encoding='utf-8') as f:
        man = json.load(f)
    cols, rows, fr = int(man['cols']), int(man['rows']), man['frames']
    assert len(fr) == cols * rows, '%s: needs cols x rows frames' % art
    files = [x['file'] if isinstance(x, dict) else x for x in fr]
    yaw = man.get('yaw') or [float(fr[c]['yaw']) for c in range(cols)]
    pitch = man.get('pitch') or [float(fr[r * cols]['pitch']) for r in range(rows)]
    assert len(yaw) == cols and len(pitch) == rows, '%s: yaw needs one value per column, pitch one per row' % art
    assert all(b > a for a, b in zip(yaw, yaw[1:])) and all(b > a for a, b in zip(pitch, pitch[1:])), '%s: angles must rise' % art
    return d, man, cols, rows, files, yaw, pitch


def nearest(lst, v):
    return min(range(len(lst)), key=lambda i: abs(lst[i] - v))


def scaled(im, h):
    if im.height <= h:
        return im
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def centre_frame(art):
    d, man, cols, rows, files, yaw, pitch = manifest(art)
    i = nearest(pitch, 0) * cols + nearest(yaw, 0)
    im = Image.open(os.path.join(d, files[i])).convert('RGBA')
    return im, (yaw[i % cols], pitch[i // cols])


def small_picture(art):
    d, man, *_ = manifest(art)
    flat = os.path.join(d, man.get('flat', 'flat.png'))
    if os.path.exists(flat):
        return Image.open(flat).convert('RGBA'), os.path.basename(flat)
    im, _ = centre_frame(art)
    return im, 'straight-on frame'


def pack(art, h, row_only=False):
    """one atlas: cols x rows cells (row_only: the pitch 0 row), manifest order, row by row, every cell the same size"""
    d, man, cols, rows, files, yaw, pitch = manifest(art)
    use_rows = [nearest(pitch, 0)] if row_only else list(range(rows))
    first = Image.open(os.path.join(d, files[0]))
    W0, H0 = first.size
    ch = min(h, H0)
    cw = round(W0 * ch / H0)
    atlas = Image.new('RGBA', (cw * cols, ch * len(use_rows)), (0, 0, 0, 0))
    assert atlas.width <= WEBP_MAX and atlas.height <= WEBP_MAX, '%s: atlas %dx%d is over the WebP limit' % (art, atlas.width, atlas.height)
    for ri, r in enumerate(use_rows):
        for c in range(cols):
            im = Image.open(os.path.join(d, files[r * cols + c])).convert('RGBA')
            assert im.size == (W0, H0), '%s: every frame must share one canvas (%s is %s)' % (art, files[r * cols + c], im.size)
            atlas.paste(im.resize((cw, ch), Image.LANCZOS) if (cw, ch) != im.size else im, (c * cw, ri * ch))
    return atlas, (cw, ch), (cols, rows, yaw, pitch, W0 / H0)


def build_grid(art, dest):
    grid, cell, (cols, rows, yaw, pitch, ar) = pack(art, GRID_H)
    turn, tcell, _ = pack(art, TURN_H, row_only=True)
    gname, tname = 'grid-%s.webp' % art, 'turn-%s.webp' % art
    gb = write(os.path.join(dest, gname), webp(grid, 86))
    tb = write(os.path.join(dest, tname), webp(turn, 86))
    entry = {'cols': cols, 'rows': rows, 'yaw': yaw, 'pitch': pitch, 'ar': round(ar, 5), 'cell': list(cell), 'grid': gname,
             'turn': tname, 'turnCell': list(tcell)}
    info = {'frames': cols * rows, 'cell': cell, 'atlas': grid.size, 'bytes': gb, 'decodedMB': grid.width * grid.height * 4 / 1e6,
            'turnFrames': cols, 'turnAtlas': turn.size, 'turnBytes': tb, 'turnDecodedMB': turn.width * turn.height * 4 / 1e6}
    return entry, info


def report_grid(art, info):
    print('  %-10s %2d frames, cell %dx%d, atlas %5dx%-4d %7.0f KB, %5.1f MB decoded | turn %2d frames %5dx%-3d %5.0f KB, %4.1f MB decoded' % (
        art, info['frames'], info['cell'][0], info['cell'][1], info['atlas'][0], info['atlas'][1], info['bytes'] / 1024,
        info['decodedMB'], info['turnFrames'], info['turnAtlas'][0], info['turnAtlas'][1], info['turnBytes'] / 1024, info['turnDecodedMB']))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--grids', default='', help='comma separated art keys whose grids to pack into static/, or "all"')
    ap.add_argument('--measure', default='', help='pack every grid into this folder (not static/) and print the sizes')
    a = ap.parse_args()

    if a.measure:
        os.makedirs(a.measure, exist_ok=True)
        print('MEASURE: every grid packed into', a.measure, '(static/ untouched)')
        tot = {'bytes': 0, 'turn': 0}
        dec = []
        for art in ORDER:
            entry, info = build_grid(art, a.measure)
            report_grid(art, info)
            tot['bytes'] += info['bytes']; tot['turn'] += info['turnBytes']; dec.append((info['decodedMB'], info['turnDecodedMB']))
        two = sorted((d for d, _ in dec), reverse=True)[:2]
        twot = sorted((t for _, t in dec), reverse=True)[:2]
        print('  all six: %.2f MB of grids (desktop), %.2f MB of turn strips (phone); two held decoded at worst %.1f MB desktop, %.1f MB phone' % (
            tot['bytes'] / 1048576, tot['turn'] / 1048576, sum(two), sum(twot)))
        return

    os.makedirs(OUT, exist_ok=True)
    sizes = {}
    # the plaque, byte for byte
    sizes['plaque.webp'] = write(os.path.join(OUT, 'plaque.webp'), open(os.path.join(R1, 'plaque.webp'), 'rb').read())
    # the header crest (the prototype's header uses the r1 crest-day picture)
    crest = Image.open(os.path.join(R1, 'crest-day.png')).convert('RGBA')
    crest = crest.crop(crest.getbbox())
    sizes['crest.webp'] = write(os.path.join(OUT, 'crest.webp'), webp(scaled(crest, CREST_H), 90))
    # the thumbs sheet, tray order
    sheet = Image.new('RGBA', (THUMB * len(ORDER), THUMB), (0, 0, 0, 0))
    for i, art in enumerate(ORDER):
        pic, what = small_picture(art)
        pic.thumbnail((THUMB, THUMB), Image.LANCZOS)
        sheet.paste(pic, (i * THUMB + (THUMB - pic.width) // 2, (THUMB - pic.height) // 2), pic)
        print('thumb %d %-10s from %s (%s), %dx%d in its cell' % (i, art, HERO_FOR[art], what, pic.width, pic.height))
    sizes['thumbs.webp'] = write(os.path.join(OUT, 'thumbs.webp'), webp(sheet, 86))
    # the flat heroes: the straight-on frame on the grid's own canvas
    for art in ORDER:
        im, ang = centre_frame(art)
        sizes['hero-%s.webp' % art] = write(os.path.join(OUT, 'hero-%s.webp' % art), webp(scaled(im, HERO_H), 88))
        sizes['hero-%s-half.webp' % art] = write(os.path.join(OUT, 'hero-%s-half.webp' % art), webp(scaled(im, HERO_HALF_H), 88))
        print('hero  %-10s straight-on frame (yaw %s, pitch %s) of %s, %dx%d' % (art, ang[0], ang[1], HERO_FOR[art], im.width, im.height))
    # the grids, if asked for
    want = ORDER if a.grids == 'all' else [g for g in a.grids.split(',') if g]
    for g in want:
        assert g in ORDER, 'unknown art key %s (one of %s)' % (g, ', '.join(ORDER))
    heroes = {}
    for art in want:
        entry, info = build_grid(art, OUT)
        heroes[art] = entry
        sizes[entry['grid']] = info['bytes']; sizes[entry['turn']] = info['turnBytes']
        report_grid(art, info)
    # grids not asked for this run are left out of heroes.json; their old files (if any) are reported, not deleted
    stale = [f for f in os.listdir(OUT) if (f.startswith('grid-') or f.startswith('turn-')) and f not in sizes]
    js = json.dumps(heroes, indent='\t') + '\n'
    sizes['heroes.json'] = write(os.path.join(OUT, 'heroes.json'), js.encode())

    for k in sorted(sizes):
        print('  %-26s %8.1f KB' % (k, sizes[k] / 1024))
    full = sizes['plaque.webp'] + sizes['crest.webp'] + sizes['thumbs.webp'] + sum(v for k, v in sizes.items() if k.startswith('hero-') and not k.endswith('-half.webp'))
    half = sizes['plaque.webp'] + sizes['crest.webp'] + sizes['thumbs.webp'] + sum(v for k, v in sizes.items() if k.endswith('-half.webp'))
    print('menu core (the deferred group): %.0f KB full tier, %.0f KB phone tier' % (full / 1024, half / 1024))
    folder = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    odd = [f for f in os.listdir(OUT) if not (f.endswith('.webp') or f == 'heroes.json')]
    print('folder static/assets/ui/armoury: %.2f MB in %d files%s' % (folder / 1048576, len(os.listdir(OUT)), '' if not stale else ' (grids on disk but NOT in heroes.json: %s)' % ', '.join(stale)))
    if odd:
        sys.exit('only .webp and heroes.json may be in the folder: %s' % ', '.join(odd))
    if folder > FOLDER_MAX_MB * 1048576:
        sys.exit('the folder is over %d MB' % FOLDER_MAX_MB)
    print('now run: node scripts/stamp-assets.mjs')


if __name__ == '__main__':
    main()
