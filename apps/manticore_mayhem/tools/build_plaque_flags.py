"""THE PLAQUE'S WAR STANDARD FLAG ROW, its art (1.0.04; images/anticipation_r2 NOTES.md r4 to r6, option B approved by Corey
2026-10-20: "R5 looks good for the plaque, let's just increase the size of the first 3 flags to fill more space";
images/plaque_r6_storyboard STORYBOARD.md S3 to S7; drawn by components/BoardPlaque.svelte).

One small atlas, static/assets/ui/plaque-flags.webp + .json (a Pixi spritesheet), baked at K px per FACE unit (the plaque
face is 100 units tall, game/plaqueField.ts), from the anticipation work's own recipe (its flagrow_r4.py level_flag):
  landed            the War Standard (s-idle frame 0, its ink box) at the landed flags' height; landedGlow its soft halo
  lvl_<L>_empty     a level flag's empty outline: the War Standard's silhouette widened LEVEL_STRETCH, an inlaid brass
                    edge, an engraved line inside it, a dark field, the word engraved inside (FS, SUPER, EPIC)
  lvl_<L>_full      the same banner filled in the War Standard's crimson with its gold edge, the word in bright gold
  lvl_<L>_glow      its soft halo (white: tinted and added in the game)
  L = FS, SUPER, EPIC, SA_SUPER (Super Ante's own SUPER: the edge and the word in its accent #e08a3c), BLANK (Super Ante's
      5th slot: no word, no level: Corey 2026-10-20 "Super Ante needs an earlier Super Ante Symbol")
  sep, lozenge      the separators' bar and lozenge
Textures only (no filter in the game: every glow is a baked sprite drawn with the additive blend).
usage: python -I tools/build_plaque_flags.py
"""
import os, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import gaussian_filter, binary_erosion

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AS = os.path.join(APP, 'static', 'assets')
OUT = os.path.join(AS, 'ui')
FONT = os.path.join(AS, 'fonts', 'ui', 'Cinzel-Bold.woff2')
K = 1.4                 # atlas px per face unit (a level flag is 72 units: 101 px; about 1.6x its size on a 1080p desktop)
FILLED_H = 72.0         # the three landed War Standards (r6 B: the level flags' own height)
LEVEL_H = 72.0          # the level flags
LEVEL_STRETCH = 1.35    # the level banners are widened so SUPER fits inside
LABEL_U = 15.5          # one label size for all three, face units
LABELS = {'FS': 'FS', 'SUPER': 'SUPER', 'EPIC': 'EPIC', 'SA_SUPER': 'SUPER', 'BLANK': ''}
SA_ACCENT = (0xe0 / 255, 0x8a / 255, 0x3c / 255)

def s_idle0():
    d = json.load(open(os.path.join(AS, 'sprites', 'mmSymbols', 's-idle.json')))
    f = d['frames']['s-idle-000']['frame']
    im = Image.open(os.path.join(AS, 'sprites', 'mmSymbols', d['meta']['image'])).convert('RGBA')
    t = im.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
    return t.crop(t.getbbox())

W0 = s_idle0()
A0 = np.asarray(W0, np.float32)[..., 3] / 255

def silhouette(w, h):
    a = np.asarray(Image.fromarray((A0 * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS), np.float32) / 255
    return a > 0.5

def level_flag(w, h, label, font_px, accent=None):
    a = silhouette(w, h)
    k = max(2, int(round(h * 0.035)))
    er = binary_erosion(a, iterations=k)
    edge = a & ~er
    inner = er & ~binary_erosion(a, iterations=2 * k)
    yy = np.linspace(0, 1, h)[:, None]
    if accent is None:
        gold = np.dstack([0.98 - 0.15 * yy, 0.78 - 0.25 * yy, 0.42 - 0.2 * yy]) * np.ones((h, w, 1))
    else:
        r, g, b = accent
        gold = np.dstack([np.minimum(1, r * 1.12) - 0.15 * yy, g * 1.05 - 0.2 * yy, b * 1.0 - 0.12 * yy]) * np.ones((h, w, 1))
    rgba = lambda rgb, al: np.dstack([rgb, al]).astype(np.float32)
    field = np.zeros((h, w, 3)); field[:] = (0.09, 0.04, 0.03)
    rgb = np.where(edge[..., None], gold, field)
    rgb = np.where(inner[..., None], np.array([0.22, 0.12, 0.05]), rgb)
    al = np.where(edge | inner, 1.0, np.where(a, 0.72, 0.0))
    empty = rgba(rgb, al)
    xx = np.linspace(-1, 1, w)[None, :]
    z = np.zeros((h, w))
    cloth = np.dstack([z + 0.78 - 0.25 * yy - 0.1 * np.cos(xx * 9) ** 2, z + 0.07 + 0.03 * (1 - yy), z + 0.05])
    rgb2 = np.where(edge[..., None], gold, cloth)
    rgb2 = np.where(inner[..., None], np.array([0.55, 0.36, 0.12]) if accent is None else np.array(accent) * 0.6, rgb2)
    full = rgba(rgb2, a.astype(np.float32))
    if label:
        font = ImageFont.truetype(FONT, font_px)
        bb = font.getbbox(label)
        m = Image.new('L', (w, h)); d = ImageDraw.Draw(m)
        tx = (w - (bb[2] - bb[0])) / 2 - bb[0]; ty = h * 0.47 - (bb[3] + bb[1]) / 2
        d.text((tx, ty), label, font=font, fill=255)
        m = np.asarray(m, np.float32) / 255
        o = max(1, font_px // 14)
        sh = np.zeros_like(m); sh[o:, o:] = m[:-o, :-o]
        hl = np.zeros_like(m); hl[:-o, :-o] = m[o:, o:]
        def engrave(img, ink, dark, light):
            out = img.copy()
            out[..., :3] = out[..., :3] * (1 - sh[..., None]) + np.array(dark) * sh[..., None]
            out[..., :3] = out[..., :3] * (1 - hl[..., None] * 0.5) + np.array(light) * hl[..., None] * 0.5
            out[..., :3] = out[..., :3] * (1 - m[..., None]) + np.array(ink) * m[..., None]
            out[..., 3] = np.maximum(out[..., 3], np.maximum(m, sh))
            return out
        ink_e = (0.9, 0.72, 0.42) if accent is None else tuple(min(1, c * 1.1) for c in accent)
        ink_f = (1.0, 0.88, 0.5) if accent is None else (1.0, 0.78, 0.45)
        empty = engrave(empty, ink_e, (0.02, 0.01, 0.0), (0.5, 0.35, 0.15))
        full = engrave(full, ink_f, (0.25, 0.02, 0.01), (1.0, 0.6, 0.5))
    return empty, full, glow_of(a)

def glow_of(a):
    h, w = a.shape
    g = gaussian_filter(np.pad(a.astype(np.float32), ((h // 2, h // 2), (w // 2, w // 2))), h * 0.12)
    g = g / max(1e-6, g.max())
    return np.dstack([np.ones(g.shape + (3,), np.float32), g])

def to_pil(arr):
    return Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')

def main():
    frames = {}
    fh = int(round(FILLED_H * K)); fw = int(round(fh * W0.width / W0.height))
    landed = W0.resize((fw, fh), Image.LANCZOS)
    frames['landed'] = landed
    frames['landedGlow'] = to_pil(glow_of(np.asarray(landed, np.float32)[..., 3] / 255 > 0.5))
    lh = int(round(LEVEL_H * K)); lw = int(round(lh * W0.width / W0.height * LEVEL_STRETCH))
    for key, word in LABELS.items():
        e, f, g = level_flag(lw, lh, word, int(round(LABEL_U * K)), SA_ACCENT if key == 'SA_SUPER' else None)
        frames[f'lvl_{key}_empty'] = to_pil(e)
        frames[f'lvl_{key}_full'] = to_pil(f)
        frames[f'lvl_{key}_glow'] = to_pil(g)
    frames['sep'] = Image.new('RGBA', (6, 64), (220, 165, 80, 255))
    d = 24; loz = Image.new('RGBA', (d, d)); ImageDraw.Draw(loz).polygon([(d / 2, 0), (d, d / 2), (d / 2, d), (0, d / 2)], fill=(232, 182, 92, 255))
    frames['lozenge'] = loz
    # shelf packing, tallest first, 2 px apart
    keys = sorted(frames, key=lambda k: -frames[k].height)
    Wd = 1024; x = y = 1; rowh = 0; pos = {}
    for k in keys:
        im = frames[k]
        if x + im.width + 1 > Wd: x = 1; y += rowh + 2; rowh = 0
        pos[k] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    Ht = y + rowh + 1; Ht += (-Ht) % 4
    sheet = Image.new('RGBA', (Wd, Ht), (0, 0, 0, 0))
    fr = {}
    for k in keys:
        sheet.paste(frames[k], pos[k])
        w, h = frames[k].size
        fr[f'{k}.png'] = {'frame': {'x': pos[k][0], 'y': pos[k][1], 'w': w, 'h': h}, 'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'sourceSize': {'w': w, 'h': h}}
    p = os.path.join(OUT, 'plaque-flags.webp')
    sheet.save(p, 'WEBP', quality=88, method=6, alpha_quality=100)
    json.dump({'frames': fr, 'meta': {'app': 'manticore-plaque-flags', 'image': 'plaque-flags.webp', 'format': 'RGBA8888', 'size': {'w': Wd, 'h': Ht}, 'scale': '1', 'facePx': K}}, open(os.path.join(OUT, 'plaque-flags.json'), 'w'), indent=1)
    print('plaque-flags', sheet.size, os.path.getsize(p), 'bytes; landed', landed.size, 'level', (lw, lh))

if __name__ == '__main__':
    main()
