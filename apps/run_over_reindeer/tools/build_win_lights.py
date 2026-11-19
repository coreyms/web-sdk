"""THE CHRISTMAS LIGHTS WIN LINES' TEXTURES (Corey 2026-11-15, the win line mock's style 2, "Christmas lights"; the game
draws them in game/road/winLights.ts, constants LINE_WIN lights). One small sheet per asset tier holding:
  - BULB  one Christmas bulb, WHITE so the game tints it per line (a light grey body shaded from the top left, so a tint
          keeps a little roundness; a dark outline like the art's; a near black socket on top; a highlight on the upper
          left, the body's lightest part, so it survives the tint as a lighter shade of the bulb's own color). It hangs
          from the middle of its top edge.
  - GLOW  one soft round glow, white, its alpha falling to nothing at the edge (the game adds it, tinted, under a lit
          bulb: no filter, no blur at run time; the softness is in the picture)
  - NAIL  THE WIRE'S END (Corey 2026-11-18, T2 of the tips mock win_line_tips_2026-11-18: "the ends of them are just
          squared off"): one wrap of the wire round a nail, in its own colors (not tinted). A ring of the wire, the same
          widths and colors as the game's wire (LINE_WIN.lights.wire: outline 14, core 6, #0b0c0f / #1f5c36), radius
          RING to its centerline, with a steel nail head over its middle (the art's dark outline, toon shading lit from
          the upper left, a white highlight). The game ends each wire where it meets this ring tangentially on its lower
          side, so the ring's edges continue the wire's and its square end is under the ring. Round, so it never turns.
          The phone tier's head is a little larger with a larger highlight, so it still reads at about 6 CSS px.
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
# THE NAIL: road px. The ring is the wire's own (constants LINE_WIN.lights.wire: keep these equal to it)
WIRE_OUTLINE, WIRE_CORE, WIRE_CORE_RGB = 14, 6, (31, 92, 54)
RING = 9.0  # the ring's centerline radius
NAIL_HALF = RING + WIRE_OUTLINE / 2 + 1.5  # the frame's half size (the ring's outer edge and a margin)
# the head: fill radius, its dark outline, the highlight's size (a share of the radius), per tier
NAIL_HEAD = {"full": (6.8, 3.0, 0.2), "phone": (7.6, 3.0, 0.27)}
STEEL = [(96, 106, 120), (170, 180, 192), (226, 232, 238), (255, 255, 255)]  # dark, base, light, highlight
LIGHT = np.array((-0.55, -0.68, 0.48)) / np.linalg.norm((-0.55, -0.68, 0.48))


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


def nail(px_per_road, tier):
    """the nail and its wrap, RGBA, supersampled 4x and box reduced (premultiplied): a ring of the wire, a nail head on it"""
    S = 4
    k = px_per_road * POP
    n = int(round(2 * NAIL_HALF * k))
    N = n * S
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    x = (xx + 0.5) / (S * k) - NAIL_HALF
    y = (yy + 0.5) / (S * k) - NAIL_HALF
    d = np.hypot(x, y)
    rgb = np.zeros((N, N, 3))
    a = np.zeros((N, N))
    # the wrap: the wire's outline band, its core band
    band = np.abs(d - RING) <= WIRE_OUTLINE / 2
    rgb[band] = INK
    a[band] = 1
    core = np.abs(d - RING) <= WIRE_CORE / 2
    rgb[core] = WIRE_CORE_RGB
    # the head: its dark outline, then the steel: a lighter crescent on the upper left, a darker one on the lower right,
    # the flat middle, a white highlight
    r, ink, hl = NAIL_HEAD[tier]
    head_ink = d <= r + ink
    rgb[head_ink] = INK
    a[head_ink] = 1
    head = d <= r
    side = (x * LIGHT[0] + y * LIGHT[1]) / r
    inner = np.hypot(x - 0.1 * r, y - 0.1 * r) <= 0.7 * r
    col = np.zeros((N, N, 3)) + STEEL[1]
    col[~inner & (side > 0)] = STEEL[2]
    col[~inner & (side <= 0)] = STEEL[0]
    col[np.hypot(x + 0.38 * r, y + 0.38 * r) <= hl * r] = STEEL[3]
    rgb[head] = col[head]
    pm = (rgb * a[..., None]).reshape(n, S, n, S, 3).mean(axis=(1, 3))
    al = a.reshape(n, S, n, S).mean(axis=(1, 3))
    out = np.where(al[..., None] > 0, pm / np.maximum(al[..., None], 1e-9), 0)
    return Image.fromarray(np.dstack([np.clip(out, 0, 255).round().astype(np.uint8), (al * 255).round().astype(np.uint8)]), "RGBA")


def main():
    spec = {"bulb": {"width": BULB[0] * POP, "height": BULB[1] * POP, "anchor": [0.5, 0.0], "pop": POP},
            "glow": {"width": GLOW * POP, "height": GLOW * POP},
            # the nail: its drawn size at the pop, centred; the ring's centerline radius and outer radius and the wire widths it
            # was drawn for (road px at scale 1)
            "nail": {"width": 2 * NAIL_HALF * POP, "height": 2 * NAIL_HALF * POP, "anchor": [0.5, 0.5], "pop": POP,
                     "ring": RING, "ringOuter": RING + WIRE_OUTLINE / 2, "wire": [WIRE_OUTLINE, WIRE_CORE],
                     "head": {t: v[0] + v[1] for t, v in NAIL_HEAD.items()}}, "tiers": {}}
    for tier, k in DENSITY.items():
        g, b, nl = glow(k), bulb(k), nail(k, tier)
        W = g.width + PAD + b.width + PAD + nl.width
        H = max(g.height, b.height, nl.height)
        sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sheet.paste(g, (0, 0))
        sheet.paste(b, (g.width + PAD, 0))
        sheet.paste(nl, (g.width + PAD + b.width + PAD, 0))
        name = "win-lights.webp" if tier == "full" else "win-lights-phone.webp"
        sheet.save(os.path.join(OUT, name), "WEBP", lossless=True)
        spec["tiers"][tier] = {"file": f"road/{name}", "width": W, "height": H, "density": k,
                               "frames": {"glow": {"x": 0, "y": 0, "width": g.width, "height": g.height},
                                          "bulb": {"x": g.width + PAD, "y": 0, "width": b.width, "height": b.height},
                                          "nail": {"x": g.width + PAD + b.width + PAD, "y": 0, "width": nl.width, "height": nl.height}}}
        print(f"{tier}: {name} {W} x {H} (bulb {b.width} x {b.height}, glow {g.width} x {g.height}, nail {nl.width} x {nl.height}), {os.path.getsize(os.path.join(OUT, name))} bytes")
    with open(SPEC, "w") as f:
        f.write("// AUTO-GENERATED by tools/build_win_lights.py. Do not edit: change the tool and run it again.\n")
        f.write("// The Christmas lights win lines' sheet (one glow, one bulb, the wire's end: a nail and its wrap) per asset tier: frames in sheet px; `width` and `height`\n")
        f.write("// at the top are the road px each is drawn at, at its largest (a lighting bulb's pop, `pop`).\n")
        f.write("export const WIN_LIGHTS_ART = " + json.dumps(spec, indent="\t") + " as const;\n")
    print("wrote", os.path.relpath(SPEC, APP))


if __name__ == "__main__":
    main()
