"""THE PLAQUE'S DARKER CENTRE (1.0.04; images/plaque_r5 PLAN.md "The centre colour", option A; Corey 2026-10-20 approved
the plaque storyboard with centre A). Re-makes the DAY plaque art of every layout with its dark field taken to the board
frame's feet: #302516, the feet panel's own value in the frame art (on screen #241b0f against the feet's #23190e).

A re-made art layer, not a tint (a tint would darken the copper rim too) and not a filter. The field's weight comes from
the art itself: its dark pixels (luminance 66 to 86 ramp) inside the bevel, the hull of the connected dark area holding
the centre, so the fine gold line and the corner lozenges keep their own light. Every field pixel is multiplied per
channel by target / the field's mean, which keeps the brushed grain. The night and fire layers are not touched (at
night the centre already matches the feet: #090606 against #0a0807).

Source: the untouched originals in images/spin_amount_final/static/assets/ui (the plaque spec's own files), so the
script can be run again and always starts from them. Encoder: the spec's (webp quality 85, method 6, alpha quality 100).
usage: python -I tools/build_plaque_centre.py
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.expanduser('~/Desktop/Manticore Mayhem/images/spin_amount_final/static/assets/ui')
DST = os.path.join(APP, 'static/assets/ui')
TARGET = (0x30, 0x25, 0x16)
LAYOUTS = ['landscape', 'portrait', 'phone']

def field_weight(a):
    L = a[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
    w = np.clip((86 - L) / (86 - 66), 0, 1) * (a[..., 3] > 250)
    lab, n = ndi.label(w > 0.5)
    c = lab[a.shape[0] // 2, a.shape[1] // 2]
    core = ndi.binary_dilation(lab == c, iterations=2)
    hull = np.zeros_like(core)
    for r in np.where(core.any(1))[0]:
        xs = np.where(core[r])[0]
        hull[r, xs.min():xs.max() + 1] = True
    return np.clip(w * hull, 0, 1)

def main():
    for k in LAYOUTS:
        src = os.path.join(SRC, f'board-plaque-{k}.webp')
        a = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32)
        w = field_weight(a)
        mean = a[w > 0.95][:, :3].mean(0)
        ratio = 1 + w[..., None] * (np.array(TARGET, np.float32)[None, None, :] / mean[None, None, :] - 1)
        out = a.copy()
        out[..., :3] = np.clip(a[..., :3] * ratio, 0, 255)
        dst = os.path.join(DST, f'board-plaque-{k}.webp')
        Image.fromarray((out + 0.5).astype(np.uint8), 'RGBA').save(dst, 'WEBP', quality=85, method=6, alpha_quality=100)
        print(k, 'field px', int((w > 0.95).sum()), 'mean before #%02x%02x%02x' % tuple(int(v) for v in mean), '->', '#%02x%02x%02x' % TARGET, os.path.getsize(dst), 'bytes')
        if '--masks' in sys.argv:
            Image.fromarray((w * 255).astype(np.uint8)).save(f'/tmp/plaque_centre_mask_{k}.png')

if __name__ == '__main__':
    main()
