#!/usr/bin/env python
"""THE ARMOURY's pictures (the feature menu; spec ~/Desktop/Manticore Mayhem/feedback/armoury_build_r1/SPEC.md section 3).

  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/build_armoury_assets.py            the small pictures, heroes.json {}
  ... tools/build_armoury_assets.py --grids crown,dagger      also pack those heroes' angle grids (spec commit 11)
  ... tools/build_armoury_assets.py --grids all
  ... tools/build_armoury_assets.py --measure DIR             pack every grid into DIR (not static/) and print the sizes
  ... tools/build_armoury_assets.py --only standard           rebuild ONE hero's files only: hero-<art>(-half), grid- and
                                                              turn-<art> (if heroes.json has its grid) and thumbs.webp
                                                              (its cell); every other file is left as it is on disk
  node scripts/stamp-assets.mjs                                (afterwards, from the app folder)

SOURCES (read only, never written; they stay in the Desktop working folder, spec 3.4):
  ~/Desktop/Manticore Mayhem/images/feature_menu_heroes_r1/<folder>/   manifest.json + frames (+ flat.png), per hero
  ~/Desktop/Manticore Mayhem/images/feature_menu_r1/src/assets/        plaque.webp, crest-day.png
SOURCE_OVERRIDES: a hero whose frames are read from another folder (same manifest.json and file names), e.g. the War
Standard's graded copy (tools/grade_war_standard.py --armoury; Corey 2026-10-17 14:07).
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
                           padding; cells GRID_H_FOR[art] px high (frames are only scaled DOWN, never up)
  turn-<art>.webp          (--grids) the phone tier's strip: the pitch 0 row only, half the grid's cell height
  card-frame-lg.webp       the confirm card's frame for the DESKTOP layout: the approved 1024 x 1536 intro card frame
                           (spec 3.1 "soft spot", decided in the spec: the desktop confirm card gets the larger picture).
                           Fetched when the menu opens, never at boot and not in the deferred group

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
# owner 2026-10-14 10:58 "Okay 512 then": the two fine sets (the dagger's 27 frames, the crown's 21) at 512 px frames
GRID_H_FOR = {'dagger': 512, 'crown': 512}
GRID_Q = 86
CARD_LG = os.path.join(DESK, 'intro_cards_r3', 'card_frame.webp')   # the approved 1024 x 1536 frame
CARD_LG_Q = 86
# FINAL (owner 2026-10-14 16:51, "Yes"): 10 MB. The spec's budget was 7 MB (3.4), set on an estimate of 5 to 6 MB of
# grids; measured with all six grids at the owner's sizes the folder is 9.25 MB (grids 6.97, phone strips 1.15, menu
# core 0.81, card-frame-lg 0.31). Kept in step with scripts/stamp-assets.mjs and constants.ts ARMOURY.assets.folderMaxMb.
FOLDER_MAX_MB = 10
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
# art key -> the folder its frames come from instead of HEROES/HERO_FOR[art] (tools/grade_war_standard.py --armoury
# writes the War Standard's graded copy there; Corey 2026-10-17 14:07 "Can it do the same color grade on the scatter
# in the Armoury?")
# dagger and seal: the symbol recolour (an Engine.io developer's "too much yellow"; Corey 2026-10-22 "Go"), the board
# symbols' grade on the hero renders with ID masks from the same camera (images/symbol_recolour_r1/official/M2/NOTES.md
# round 3, official/WIRING_NOTES.md). dagger: SUPER card, tray and confirm card (graded_r1/flat.png = the graded
# straight-on frame cropped as check2.py cropped flat.png); seal: the MYSTERY card (no flat.png: its thumb is the frame)
SOURCE_OVERRIDES = {'standard': os.path.join(HEROES, HERO_FOR['standard'], 'graded_r1'),
                    'dagger': os.path.join(HEROES, HERO_FOR['dagger'], 'graded_r1'),
                    'seal': os.path.join(HEROES, HERO_FOR['seal'], 'graded_r1')}


def hero_dir(art):
    return SOURCE_OVERRIDES.get(art) or os.path.join(HEROES, HERO_FOR[art])


def webp(im, q, method=6):
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=method)
    return b.getvalue()


def write(path, data):
    with open(path, 'wb') as f:
        f.write(data)
    return len(data)


def manifest(art):
    d = hero_dir(art)
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


def grid_h(art):
    return GRID_H_FOR.get(art, GRID_H)


def edge_motion(art, h):
    """the largest move of the silhouette's left or right edge between two neighbouring frames of the pitch 0 row,
    in px of a frame drawn h px high (the owner's motion rule: under about 6 px a step)"""
    d, man, cols, rows, files, yaw, pitch = manifest(art)
    r = nearest(pitch, 0)
    boxes = []
    for c in range(cols):
        im = Image.open(os.path.join(d, files[r * cols + c])).convert('RGBA')
        a = im.getchannel('A').point(lambda v: 255 if v > 24 else 0)
        boxes.append((a.getbbox(), im.height))
    worst = 0.0
    for (b0, H0), (b1, _) in zip(boxes, boxes[1:]):
        if b0 and b1:
            worst = max(worst, abs(b1[0] - b0[0]) * h / H0, abs(b1[2] - b0[2]) * h / H0)
    return worst


def build_grid(art, dest):
    gh = grid_h(art)
    grid, cell, (cols, rows, yaw, pitch, ar) = pack(art, gh)
    turn, tcell, _ = pack(art, gh // 2, row_only=True)
    gname, tname = 'grid-%s.webp' % art, 'turn-%s.webp' % art
    gb = write(os.path.join(dest, gname), webp(grid, GRID_Q))
    tb = write(os.path.join(dest, tname), webp(turn, GRID_Q))
    entry = {'cols': cols, 'rows': rows, 'yaw': yaw, 'pitch': pitch, 'ar': round(ar, 5), 'cell': list(cell), 'grid': gname,
             'turn': tname, 'turnCell': list(tcell)}
    info = {'frames': cols * rows, 'cell': cell, 'edge': edge_motion(art, cell[1]), 'atlas': grid.size, 'bytes': gb, 'decodedMB': grid.width * grid.height * 4 / 1e6,
            'turnFrames': cols, 'turnAtlas': turn.size, 'turnBytes': tb, 'turnDecodedMB': turn.width * turn.height * 4 / 1e6}
    return entry, info


def report_grid(art, info):
    print('  %-10s %2d frames, cell %dx%d, atlas %5dx%-4d %7.0f KB, %5.1f MB decoded | turn %2d frames %5dx%-3d %5.0f KB, %4.1f MB decoded | edge %.1f px a step at cell size' % (
        art, info['frames'], info['cell'][0], info['cell'][1], info['atlas'][0], info['atlas'][1], info['bytes'] / 1024,
        info['decodedMB'], info['turnFrames'], info['turnAtlas'][0], info['turnAtlas'][1], info['turnBytes'] / 1024, info['turnDecodedMB'], info['edge']))


def thumbs_sheet():
    sheet = Image.new('RGBA', (THUMB * len(ORDER), THUMB), (0, 0, 0, 0))
    for i, art in enumerate(ORDER):
        pic, what = small_picture(art)
        pic.thumbnail((THUMB, THUMB), Image.LANCZOS)
        sheet.paste(pic, (i * THUMB + (THUMB - pic.width) // 2, (THUMB - pic.height) // 2), pic)
        print('thumb %d %-10s from %s (%s), %dx%d in its cell' % (i, art, hero_dir(art), what, pic.width, pic.height))
    return sheet


def build_only(art):
    """one hero's outputs: the flat heroes, its grid and turn strip if heroes.json packs them (the entry must come out
    the same), and the thumbs sheet (its cell). Nothing else in OUT is written."""
    assert art in ORDER, 'unknown art key %s (one of %s)' % (art, ', '.join(ORDER))
    sizes = {}
    sizes['thumbs.webp'] = write(os.path.join(OUT, 'thumbs.webp'), webp(thumbs_sheet(), 86))
    im, ang = centre_frame(art)
    sizes['hero-%s.webp' % art] = write(os.path.join(OUT, 'hero-%s.webp' % art), webp(scaled(im, HERO_H), 88))
    sizes['hero-%s-half.webp' % art] = write(os.path.join(OUT, 'hero-%s-half.webp' % art), webp(scaled(im, HERO_HALF_H), 88))
    print('hero  %-10s straight-on frame (yaw %s, pitch %s) of %s, %dx%d' % (art, ang[0], ang[1], hero_dir(art), im.width, im.height))
    with open(os.path.join(OUT, 'heroes.json'), encoding='utf-8') as f:
        heroes = json.load(f)
    if art in heroes:
        entry, info = build_grid(art, OUT)
        assert entry == heroes[art], '%s: the grid entry changed (%s, was %s); run the full build' % (art, entry, heroes[art])
        sizes[entry['grid']] = info['bytes']; sizes[entry['turn']] = info['turnBytes']
        report_grid(art, info)
    for k in sorted(sizes):
        print('  %-26s %8.1f KB' % (k, sizes[k] / 1024))
    folder = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print('folder static/assets/ui/armoury: %.2f MB in %d files' % (folder / 1048576, len(os.listdir(OUT))))
    if folder > FOLDER_MAX_MB * 1048576:
        sys.exit('the folder is over %d MB' % FOLDER_MAX_MB)
    print('now run: node scripts/stamp-assets.mjs')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--grids', default='', help='comma separated art keys whose grids to pack into static/, or "all"')
    ap.add_argument('--measure', default='', help='pack every grid into this folder (not static/) and print the sizes')
    ap.add_argument('--only', default='', help='rebuild one art key\'s files (and thumbs.webp) only')
    a = ap.parse_args()

    if a.only:
        return build_only(a.only)

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
        card = Image.open(CARD_LG).convert('RGBA')
        print('  card-frame-lg.webp %dx%d q%d: %.0f KB (source %.0f KB)' % (card.width, card.height, CARD_LG_Q, len(webp(card, CARD_LG_Q)) / 1024, os.path.getsize(CARD_LG) / 1024))
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
    sizes['thumbs.webp'] = write(os.path.join(OUT, 'thumbs.webp'), webp(thumbs_sheet(), 86))
    # the flat heroes: the straight-on frame on the grid's own canvas
    for art in ORDER:
        im, ang = centre_frame(art)
        sizes['hero-%s.webp' % art] = write(os.path.join(OUT, 'hero-%s.webp' % art), webp(scaled(im, HERO_H), 88))
        sizes['hero-%s-half.webp' % art] = write(os.path.join(OUT, 'hero-%s-half.webp' % art), webp(scaled(im, HERO_HALF_H), 88))
        print('hero  %-10s straight-on frame (yaw %s, pitch %s) of %s, %dx%d' % (art, ang[0], ang[1], hero_dir(art), im.width, im.height))
    # the desktop confirm card's frame: the approved original, re-encoded
    card = Image.open(CARD_LG).convert('RGBA')
    assert card.size == (1024, 1536), 'card-frame-lg: expected the 1024 x 1536 original, got %s' % (card.size,)
    sizes['card-frame-lg.webp'] = write(os.path.join(OUT, 'card-frame-lg.webp'), webp(card, CARD_LG_Q))
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
