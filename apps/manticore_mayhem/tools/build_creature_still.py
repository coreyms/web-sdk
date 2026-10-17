#!/usr/bin/env python
"""THE CREATURE'S STILL (first-minute plan D, Corey 2026-10-16 17:21 "Yes D"): one frame of the manticore in the FIRST
download, so he stands in the courtyard from the game's first frame instead of fading in when his 2.7 MB idle sheet lands.

The still is EXACTLY his idle loop's first frame (creature_day_idle_000) and the matching shadow frame
(creature_shadow_idle_000), cut out of the SHIPPED atlases (static/assets/sprites/creature/day/creature-day-idle[-phone]
and shared/creature-shadow[-phone]) with their trim rectangles and canvas sizes kept, so game/creature.ts draws it at the
same anchor, scale and pixels as idle frame 1: when the idle sheet lands the swap to frame 1 is invisible (same pose, no
jump, no cross-fade). One small atlas per tier, two frames:
  creature_still_body     the body (the 640 / 432 px canvas of the look atlases)
  creature_still_shadow   the shadow (the 160 / 108 px canvas of the shadow atlas)
Output: static/assets/sprites/creature/still/creature-day-still[-phone].json|webp (TexturePacker JSON, like every atlas).
Encoded at the look atlases' own settings (quality 85, alpha_quality 70: tools/build_creature_assets.py, Corey
2026-10-15 A1) from the decoded shipped pixels. Re-run after a new rig drop is shipped:

  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/build_creature_still.py
"""
import hashlib
import json
import os

from PIL import Image

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREATURE = os.path.join(APP, 'static', 'assets', 'sprites', 'creature')
OUT = os.path.join(CREATURE, 'still')
LOOK = 'day'
QUALITY = 85
ALPHA_QUALITY = 70
GAP = 2  # px between the two frames in the atlas


def frame_of(json_path, name):
    doc = json.load(open(json_path))
    f = doc['frames'][name]
    assert not f.get('rotated'), f'{name} is rotated'
    img = Image.open(os.path.join(os.path.dirname(json_path), doc['meta']['image'])).convert('RGBA')
    r = f['frame']
    return img.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), f


def build(suffix):
    body, fb = frame_of(os.path.join(CREATURE, LOOK, f'creature-{LOOK}-idle{suffix}.json'), f'creature_{LOOK}_idle_000')
    shadow, fs = frame_of(os.path.join(CREATURE, 'shared', f'creature-shadow{suffix}.json'), 'creature_shadow_idle_000')
    w = max(body.width, shadow.width)
    h = body.height + GAP + shadow.height
    atlas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    atlas.paste(body, (0, 0))
    atlas.paste(shadow, (0, body.height + GAP))
    os.makedirs(OUT, exist_ok=True)
    base = f'creature-{LOOK}-still{suffix}'
    path = os.path.join(OUT, base + '.webp')
    atlas.save(path, 'WEBP', quality=QUALITY, method=6, alpha_quality=ALPHA_QUALITY)
    frames = {
        'creature_still_body': {**fb, 'frame': {'x': 0, 'y': 0, 'w': body.width, 'h': body.height}},
        'creature_still_shadow': {**fs, 'frame': {'x': 0, 'y': body.height + GAP, 'w': shadow.width, 'h': shadow.height}},
    }
    meta = {'image': base + '.webp', 'format': 'RGBA8888', 'size': {'w': w, 'h': h}, 'scale': '1',
            'pngHash': hashlib.md5(open(path, 'rb').read()).hexdigest()[:8]}
    jpath = os.path.join(OUT, base + '.json')
    open(jpath, 'w').write(json.dumps({'frames': frames, 'meta': meta}, indent=1) + '\n')
    print(f'{base}: {w} x {h}, {os.path.getsize(path) / 1024:.1f} KiB webp + {os.path.getsize(jpath)} B json')


if __name__ == '__main__':
    build('')
    build('-phone')
