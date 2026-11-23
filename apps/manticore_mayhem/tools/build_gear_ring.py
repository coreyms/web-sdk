"""Builds static/assets/ui/gear-ring.png: the light ring drawn over the board frame's two top wheels (gear bar,
2026-11-22; components/BoardFrame.svelte, game/frameGears.ts). Corey: "put a light ring around the button with
different colors for win, Bonus, Super, Epic ... match that up with the smaller gears on both sides of the board with
their rings."

Drawn, not generated: a white ring (the game tints it) with the Play hub's own halo, three straight bands at the
mock's strengths, already at the steady strength of 0.5. No blur, no filter.

The ring's middle line is RING_R px from the center of a SIZE px square. BoardFrame scales it so that line lies on
the wheel's brass ring (FRAME_WHEEL.ringR render px). Density: the wheel's ring is 65 render px; on a 3840 x 2160
screen (the largest desktop draw) that is 73 CSS px, so 3 px per CSS px needs about 220 px: RING_R is 216.

THE SMALL RING (2026-11-24), static/assets/ui/gear-ring-small.png: the same drawing for the frame's two pinions (the
small gear on the top rail inside each wheel; game/frameGears.ts FRAME_PINION). Corey: "The outer gears got the
matching ring light ups, and that looks great. Was there a reason it didn't get applied to the smaller inner gears?"
The pinion's own brass ring is 27 render px from its center and 3 wide. The big ring scaled down to it would be an 8
to 1 reduction with a 1.9 px core, so it has its own art: the middle line 90 px from the center of a 256 px square
(27 render px is 30 CSS px on a 3840 x 2160 screen: 3 px per CSS px), a core 3.2 render px wide (the wheel's is 4.5),
and the halo at 0.6 of the wheel's width in render px (5.0, 3.5 and 2.3 against 8.4, 5.9 and 3.8), so it stays inside
the pinion's teeth and off its hub. The same three straight bands at the same strengths.

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


# the small ring: px of its own texture per render px of the pinion (90 / 27)
SMALL_SIZE = 256
SMALL_R = 90.0
SMALL_K = SMALL_R / 27.0
SMALL_CORE_HALF = 1.6 * SMALL_K
SMALL_HALO = ((5.0 * SMALL_K, 0.09), (3.5 * SMALL_K, 0.09), (2.3 * SMALL_K, 0.09))
OUT_SMALL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static', 'assets', 'ui', 'gear-ring-small.png')


def draw(size, ring_r, core_half, halos, out):
    im = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    px = im.load()
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            d = abs(math.hypot(x - c, y - c) - ring_r)
            if d > halos[0][0] + 1:
                continue
            core = band(d, core_half)
            halo = sum(k * band(d, half) for half, k in halos)
            a = core + (1 - core) * halo
            px[x, y] = (255, 255, 255, round(255 * a))
    im.save(os.path.normpath(out), optimize=True)
    print(os.path.normpath(out), os.path.getsize(os.path.normpath(out)), 'bytes')


def main():
    draw(SIZE, RING_R, CORE_HALF, HALO, OUT)
    draw(SMALL_SIZE, SMALL_R, SMALL_CORE_HALF, SMALL_HALO, OUT_SMALL)


if __name__ == '__main__':
    main()
