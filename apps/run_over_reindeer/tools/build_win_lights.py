"""THE CHRISTMAS LIGHTS WIN LINES' TEXTURES (Corey 2026-11-15, the win line mock's style 2, "Christmas lights"; the game
draws them in game/road/winLights.ts, constants LINE_WIN lights). One small sheet per asset tier holding:
  - BULB  one Christmas bulb, WHITE so the game tints it per line (a light grey body shaded from the top left, so a tint
          keeps a little roundness; a dark outline like the art's; a near black socket on top; a highlight on the upper
          left, the body's lightest part, so it survives the tint as a lighter shade of the bulb's own color). It hangs
          from the middle of its top edge.
  - GLOW  one soft round glow, white, its alpha falling to nothing at the edge (the game adds it, tinted, under a lit
          bulb: no filter, no blur at run time; the softness is in the picture)
The wire itself is plain tinted quads of Pixi's own white texture (no picture of its own).

Sizes are road px (game/roadArtSpec.ts: the 1536 x 1024 background's pixels), at the house density: 3 physical px per
CSS px at the largest draw (tools/build_assets.py ATLAS_SCALE: full 3.2 px per road px, phone 1.2). Lossless WebP:
static/assets/road/win-lights.webp and win-lights-phone.webp. Writes src/game/winLightsSpec.ts (generated): each
tier's frames in sheet px, and the road size each one is drawn at.

Run with the math env's Python (Pillow, numpy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_win_lights.py
"""
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "static", "assets", "road")
SPEC = os.path.join(APP, "src", "game", "winLightsSpec.ts")
DENSITY = {"full": 3.2, "phone": 1.2}  # px per road px (tools/build_assets.py ATLAS_SCALE)
# road px, the largest draw (constants LINE_WIN lights draws them at scale 1, a lighting bulb pops up to 1.18)
POP = 1.18
BULB = (32, 48)  # w, h: the socket's top edge to the bulb's tip
GLOW = 108  # diameter
PAD = 2  # sheet px between frames
INK = (11, 12, 15)  # the art's outline color (the mock's #0b0c0f)
SOCKET = (22, 38, 27)  # a near black green: the socket and its collar


def bulb(px_per_road):
    """the bulb, RGBA, supersampled 4x and reduced (smooth edges, no blur at run time)"""
    S = 4
    w = int(round(BULB[0] * POP * px_per_road))
    h = int(round(BULB[1] * POP * px_per_road))
    W, H = w * S, h * S
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    u = xx / W  # 0..1 across
    v = yy / H  # 0..1 down
    line = 0.085  # the outline, a share of the width (about 2 road px)
    # THE BODY: an egg, wider below its middle and blunt at the tip (a C9 bulb), from 0.17 of the height to the tip
    top, tip = 0.17, 0.985
    cy = top + (tip - top) * 0.55
    ry_up, ry_dn = (cy - top), (tip - cy)
    ry = np.where(v < cy, ry_up, ry_dn)
    # narrower toward the tip (a C9 bulb's point): the half width shrinks to 0.62 of itself at the tip
    taper = 1 - 0.38 * np.clip((v - cy) / ry_dn, 0, 1) ** 1.5
    rx = (0.5 - line * 0.5) * taper
    d_body = ((u - 0.5) / rx) ** 2 + ((v - cy) / ry) ** 2
    body = d_body <= 1.0
    # the outline: the body grown by the line's width
    rxo = rx + line * (0.6 + 0.4 * taper)
    ryo = ry + line * W / H
    outer_body = ((u - 0.5) / rxo) ** 2 + ((v - cy) / ryo) ** 2 <= 1.0
    # THE SOCKET: a short ribbed cylinder on top, narrower than the body
    sw, s0, s1 = 0.2, 0.01, top + 0.06
    sock = (np.abs(u - 0.5) <= sw) & (v >= s0 + line * 0.5) & (v <= s1)
    sock_outer = (np.abs(u - 0.5) <= sw + line) & (v >= s0) & (v <= s1 + line)
    # shading: lightest at the upper left, darker down and right (white x this, so a tint keeps the roundness)
    shade = 0.94 - 0.16 * np.clip((u - 0.32) * 0.9 + (v - cy + 0.18) * 1.1, 0, 1)
    # the highlight: a small slanted ellipse on the upper left, pure white
    hu, hv = (u - 0.33), (v - (cy - ry_up * 0.42))
    a = np.deg2rad(-25)
    hx = hu * np.cos(a) - hv * np.sin(a)
    hy = hu * np.sin(a) + hv * np.cos(a)
    hl = (hx / 0.075) ** 2 + (hy / 0.13) ** 2 <= 1.0
    rgb = np.zeros((H, W, 3))
    alpha = np.zeros((H, W))
    ink = (outer_body | sock_outer)
    rgb[ink] = INK
    alpha[ink] = 1
    val = np.clip(shade, 0, 1)[..., None] * 255
    rgb[body] = np.repeat(val, 3, axis=2)[body]
    rgb[body & hl] = 255
    # the socket: its ribs as two darker bands
    rib = sock & (((v - s0) / (s1 - s0) * 4).astype(int) % 2 == 1)
    rgb[sock] = SOCKET
    rgb[rib] = (np.array(SOCKET) * 0.6)
    img = Image.fromarray(np.dstack([rgb.astype(np.uint8), (alpha * 255).astype(np.uint8)]), "RGBA")
    return img.resize((w, h), Image.LANCZOS)


def glow(px_per_road):
    """the glow: white, alpha (1 - r)^2.2, a little flat in the middle"""
    n = int(round(GLOW * POP * px_per_road))
    yy, xx = np.mgrid[0:n, 0:n].astype(float)
    r = np.hypot(xx - (n - 1) / 2, yy - (n - 1) / 2) / (n / 2)
    a = np.clip(1 - r, 0, 1) ** 2.2
    rgb = np.full((n, n, 3), 255, dtype=np.uint8)
    return Image.fromarray(np.dstack([rgb, (a * 255).astype(np.uint8)]), "RGBA")


def main():
    spec = {"bulb": {"width": BULB[0] * POP, "height": BULB[1] * POP, "anchor": [0.5, 0.0], "pop": POP},
            "glow": {"width": GLOW * POP, "height": GLOW * POP}, "tiers": {}}
    for tier, k in DENSITY.items():
        g, b = glow(k), bulb(k)
        W = g.width + PAD + b.width
        H = max(g.height, b.height)
        sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sheet.paste(g, (0, 0))
        sheet.paste(b, (g.width + PAD, 0))
        name = "win-lights.webp" if tier == "full" else "win-lights-phone.webp"
        sheet.save(os.path.join(OUT, name), "WEBP", lossless=True)
        spec["tiers"][tier] = {"file": f"road/{name}", "width": W, "height": H, "density": k,
                               "frames": {"glow": {"x": 0, "y": 0, "width": g.width, "height": g.height},
                                          "bulb": {"x": g.width + PAD, "y": 0, "width": b.width, "height": b.height}}}
        print(f"{tier}: {name} {W} x {H} (bulb {b.width} x {b.height}, glow {g.width} x {g.height}), {os.path.getsize(os.path.join(OUT, name))} bytes")
    with open(SPEC, "w") as f:
        f.write("// AUTO-GENERATED by tools/build_win_lights.py. Do not edit: change the tool and run it again.\n")
        f.write("// The Christmas lights win lines' sheet (one bulb, one glow) per asset tier: frames in sheet px; `width` and `height`\n")
        f.write("// at the top are the road px each is drawn at, at its largest (a lighting bulb's pop, `pop`).\n")
        f.write("export const WIN_LIGHTS_ART = " + json.dumps(spec, indent="\t") + " as const;\n")
    print("wrote", os.path.relpath(SPEC, APP))


if __name__ == "__main__":
    main()
