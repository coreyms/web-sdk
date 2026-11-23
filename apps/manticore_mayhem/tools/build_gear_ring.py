"""Builds static/assets/ui/gear-ring.png: the light ring drawn over the board frame's two top wheels (gear bar,
2026-11-22; components/BoardFrame.svelte, game/frameGears.ts). Corey: "put a light ring around the button with
different colors for win, Bonus, Super, Epic ... match that up with the smaller gears on both sides of the board with
their rings."

Drawn, not generated: a white ring (the game tints it) with the Play hub's own halo, three straight bands at the
mock's strengths, already at the steady strength of 0.5. No blur, no filter.

The ring's middle line is RING_R px from the center of a SIZE px square. BoardFrame scales it so that line lies on
the wheel's brass ring (FRAME_WHEEL.ringR render px). Density: the wheel's ring is 65 render px; on a 3840 x 2160
screen (the largest desktop draw) that is 73 CSS px, so 3 px per CSS px needs about 220 px: RING_R is 216.

Run: /Users/corey/Projects/stake-engine/math-sdk/env/bin/python -I tools/build_gear_ring.py
"""
import math
import os

from PIL import Image

SIZE = 512
RING_R = 216.0
CORE_HALF = 7.4
# the halo: half widths (px) and the strength each band adds (the mock: 0.18 a band, at the steady 0.5)
HALO = ((27.9, 0.09), (19.6, 0.09), (12.6, 0.09))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static', 'assets', 'ui', 'gear-ring.png')


def band(d, half):
    """coverage of a band of this half width at distance d from its middle line, one px of edge"""
    return max(0.0, min(1.0, half + 0.5 - d))


def main():
    im = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 0))
    px = im.load()
    c = (SIZE - 1) / 2
    for y in range(SIZE):
        for x in range(SIZE):
            d = abs(math.hypot(x - c, y - c) - RING_R)
            if d > HALO[0][0] + 1:
                continue
            core = band(d, CORE_HALF)
            halo = sum(k * band(d, half) for half, k in HALO)
            a = core + (1 - core) * halo
            px[x, y] = (255, 255, 255, round(255 * a))
    im.save(os.path.normpath(OUT), optimize=True)
    print(os.path.normpath(OUT), os.path.getsize(os.path.normpath(OUT)), 'bytes')


if __name__ == '__main__':
    main()
