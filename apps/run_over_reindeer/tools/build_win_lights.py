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

THE STRAND (Corey 2026-11-20, candidate B of win_line_lights_r1_2026-11-20 with the round 2 nails of
win_line_lights_r2_2026-11-20; constants LINE_WIN lights strand, game/road/winLights.ts). The mock's canvas drawing code
(its src/app.js bakeBulb, drawCoil, drawHead, drawNailShadow, the cord's strokes) redrawn here, supersampled 8x and box
reduced (premultiplied). Every picture has an even ink outline (a stroke of one width round the whole silhouette):
  - C7 BODY  the C7 bulb's glass and collar: the ink outline round both, the glass white with a grey shade crescent at
             its lower right (tinted per bulb at run time; black stays black). Its anchor is the cord point it hangs from.
  - C7 OVER  never tinted, drawn over the body: the pigtail lead (an S from the cord down into the collar, the cord's
             colors), its tie round the cord, the collar (ribbed, a sheen), the seam where the glass meets the collar and
             the glass highlight (white on any color). The same frame and anchor as the body.
  - HEAD     the silver nail head (shadow side, body, lit rim, highlight) with its ink ring. Untinted, centred.
  - RING     one turn of the cord round an end nail's shank (the wrap's centerline radius, the cord's widths, colors and
             highlight). The head goes over its inner part. Deeper turns are the same frame, offset and tinted darker.
  - SHADOW   the nail's soft contact shadow on the board (black at SHADOW_ALPHA), its anchor the nail's centre.
  - CORD     the cord's cross section as a strip: a margin, the ink, the green core with its highlight toward the top
             (the upper side of a cord running left to right), the ink, a margin. The game lays it along the path as a
             triangle strip (a Pixi Mesh); the strip's columns are all alike, so it can be stretched any length.
The old BULB and NAIL frames stay on the sheet (no longer drawn; the code that drew them is kept). The numbers baked
in (STRAND below) are written to the spec's strand.bakedFor and must equal constants LINE_WIN lights strand
(tools/win_lines_probe.mjs checks it).

Sizes are road px (game/roadArtSpec.ts: the 1536 x 1024 background's pixels), at the house density: 3 physical px per
CSS px at the largest draw (tools/build_assets.py ATLAS_SCALE: full 3.2 px per road px, phone 1.2). Lossless WebP:
static/assets/road/win-lights.webp and win-lights-phone.webp. Writes src/game/winLightsSpec.ts (generated): each
tier's frames in sheet px, and the road size each one is drawn at.

Run with the math env's Python (Pillow, numpy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_win_lights.py
"""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw

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

# ---- THE STRAND (round 2): keep these equal to constants LINE_WIN.lights.strand (the spec's bakedFor) ----------------
STRAND = {
    "wire": 10.0,  # cord.width: the cord's core, road px
    "ink": 2.75,  # cord.ink: the even outline of everything, each side
    "cordColor": 0x2B7746,
    "cordHighlight": 0x7CC591,
    "highlightUp": 0.2,  # the highlight's centre above the cord's middle, a share of the cord's width
    "highlightWidth": 0.26,
    "bulbSize": 1.05,
    "leadRoadPx": 12.0,  # the pigtail lead's length at size 1 (times max(0.8, bulbSize))
    "socketColor": 0x1F3B29,
    "nailSize": 1.55,
    "headRoadPx": 6.6,  # the head's radius at nail size 1
    "shankShare": 0.36,  # the shank's radius, a share of the head's
    "nailColor": "silver",
    "wrapSize": 0.15,  # the end wrap: tight on the shank (0) to loose
    "shadow": [2.6, 4.0, 0.38],  # dx, dy, alpha
}
S_INK = (11, 12, 15, 255)
# the head's four tones (the mock's NAIL_COLORS): shadow side, body, lit rim, highlight
NAIL_TONES = {
    "silver": ["#5e6876", "#a9b3bf", "#e1e7ee", "#ffffff"],
    "brass": ["#8a5a14", "#d9a033", "#f4cf6e", "#fff6d8"],
    "iron": ["#1b1e23", "#3c424b", "#6d7581", "#c3c9d2"],
    "candy": ["#7a0c14", "#d81f2c", "#ff7a7a", "#ffffff"],
    "gold": ["#94620e", "#f2b51c", "#ffe08a", "#fffbe6"],
}
SS = 8  # supersampling of the strand's pictures
STRAND_MARGIN = 1.0  # road px of clear edge round each picture (and each side of the cord strip)


def rgba(c, a=1.0):
    if isinstance(c, str):
        c = int(c[1:], 16)
    return ((c >> 16) & 255, (c >> 8) & 255, c & 255, int(round(a * 255)))


def head_r():
    return STRAND["headRoadPx"] * STRAND["nailSize"]


def shank_r():
    return STRAND["shankShare"] * head_r()


def wrap_r():
    """the end wrap's centerline radius (the mock's wrapR): tight on the shank, wrapSize loosens it"""
    W, ink = STRAND["wire"], STRAND["ink"]
    return shank_r() + W / 2 + ink * 0.6 + STRAND["wrapSize"] * W * 0.9


class Pen:
    """a supersampled RGBA canvas in road px: `ppr` final px per road px, the road origin at final px (ax, ay)"""

    def __init__(self, w, h, ppr, ax, ay):
        self.w, self.h, self.ppr, self.ax, self.ay = w, h, ppr, ax, ay
        self.k = ppr * SS
        self.img = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))

    def P(self, x, y):
        return ((x * self.ppr + self.ax) * SS, (y * self.ppr + self.ay) * SS)

    def pts(self, pts):
        return [self.P(x, y) for x, y in pts]

    def layer(self):
        im = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        return im, ImageDraw.Draw(im)

    def put(self, layer, clip=None):
        """composite a layer over the canvas, its alpha cut to `clip` (an L mask)"""
        if clip is not None:
            a = np.asarray(layer.getchannel("A"), dtype=np.float64) * (np.asarray(clip, dtype=np.float64) / 255)
            layer.putalpha(Image.fromarray(a.round().astype(np.uint8), "L"))
        self.img = Image.alpha_composite(self.img, layer)

    def mask(self, poly):
        m = Image.new("L", self.img.size, 0)
        ImageDraw.Draw(m).polygon(self.pts(poly), fill=255)
        return m

    def fill(self, poly, col, clip=None):
        im, d = self.layer()
        d.polygon(self.pts(poly), fill=col)
        self.put(im, clip)

    def stroke(self, pts, width, col, closed=False, cap=True, clip=None):
        """an even stroke of `width` road px along a polyline (round joins, round caps)"""
        # (PIL's own wide lines leave spikes at the joins: each segment is a quad and each joint a disc instead, so the
        # width is exactly even and every join round)
        im, d = self.layer()
        q = self.pts(pts + ([pts[0]] if closed else []))
        h = width * self.k / 2
        for (x0, y0), (x1, y1) in zip(q[:-1], q[1:]):
            L = math.hypot(x1 - x0, y1 - y0)
            if L < 1e-9:
                continue
            nx, ny = -(y1 - y0) / L * h, (x1 - x0) / L * h
            d.polygon([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)], fill=col)
        joints = q if (cap or closed) else q[1:-1]
        for x, y in joints:
            d.ellipse([x - h, y - h, x + h, y + h], fill=col)
        self.put(im, clip)

    def annulus(self, x, y, r0, r1, col, clip=None):
        """a ring between radii r0 and r1 (exact circles)"""
        im, d = self.layer()
        X, Y = self.P(x, y)
        d.ellipse([X - r1 * self.k, Y - r1 * self.k, X + r1 * self.k, Y + r1 * self.k], fill=col)
        if r0 > 0:
            d.ellipse([X - r0 * self.k, Y - r0 * self.k, X + r0 * self.k, Y + r0 * self.k], fill=(0, 0, 0, 0))
        self.put(im, clip)

    def circle(self, x, y, r, col, clip=None):
        im, d = self.layer()
        X, Y = self.P(x, y)
        R = r * self.k
        d.ellipse([X - R, Y - R, X + R, Y + R], fill=col)
        self.put(im, clip)

    def done(self):
        """the box reduction, premultiplied"""
        a = np.asarray(self.img, dtype=np.float64)
        H, W = self.h, self.w
        al = a[..., 3:4] / 255
        pm = (a[..., :3] * al).reshape(H, SS, W, SS, 3).mean(axis=(1, 3))
        am = al.reshape(H, SS, W, SS, 1).mean(axis=(1, 3))
        rgb = np.where(am > 0, pm / np.maximum(am, 1e-9), 0)
        return Image.fromarray(np.dstack([np.clip(rgb, 0, 255).round().astype(np.uint8), (am[..., 0] * 255).round().astype(np.uint8)]), "RGBA")


def cubic(p0, p1, p2, p3, n=24):
    out = []
    for i in range(1, n + 1):
        u = i / n
        v = 1 - u
        out.append((v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]))
    return out


def quad(p0, p1, p2, n=16):
    out = []
    for i in range(1, n + 1):
        u = i / n
        v = 1 - u
        out.append((v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1]))
    return out


def arc_pts(cx, cy, r, a0, a1, step=0.04):
    n = max(2, int(math.ceil(abs(a1 - a0) / step)))
    return [(cx + math.cos(a0 + (a1 - a0) * i / n) * r, cy + math.sin(a0 + (a1 - a0) * i / n) * r) for i in range(n + 1)]


def round_rect(x, y, w, h, radii):
    """a rounded rectangle's outline (radii: top left, top right, bottom right, bottom left)"""
    tl, tr, br, bl = radii
    pts = []
    pts += arc_pts(x + tl, y + tl, tl, math.pi, 1.5 * math.pi)
    pts += arc_pts(x + w - tr, y + tr, tr, 1.5 * math.pi, 2 * math.pi)
    pts += arc_pts(x + w - br, y + h - br, br, 0, 0.5 * math.pi)
    pts += arc_pts(x + bl, y + h - bl, bl, 0.5 * math.pi, math.pi)
    return pts


def c7_shapes():
    """the mock's C7 (bulbShape('C7')): local road px at size 1, the collar's top at (0, 0)"""
    body = [(-4.8, 8.4)]
    body += cubic((-4.8, 8.4), (-11.6, 12.6), (-11.8, 25.5), (-4.6, 35.2))
    body += quad((-4.6, 35.2), (-1.6, 39.6), (0, 40))
    body += quad((0, 40), (1.6, 39.6), (4.6, 35.2))
    body += cubic((4.6, 35.2), (11.8, 25.5), (11.6, 12.6), (4.8, 8.4))
    return {"body": body, "collar": (-5.4, 0.0, 10.8, 10.0), "center": 24.0, "len": 40.0, "hl": (-4.8, 18.5, 1.9, 5.6, 0.32), "dot": (-2.4, 28.5, 1.1)}


def c7_frame():
    """the C7 frame's extent round the cord point (road px): its top, bottom and half width (the mock's bakeBulb)"""
    W, ink, size = STRAND["wire"], STRAND["ink"], STRAND["bulbSize"]
    off = STRAND["leadRoadPx"] * max(0.8, size)
    sh = c7_shapes()
    top = -(W / 2 + ink + 4) - 2
    bottom = off + sh["len"] * size + ink + 3
    half = 17 * size + ink + 3
    return top, bottom, half, off


def c7(ppr):
    """the C7 bulb on its pigtail: (body, over), both anchored at the cord point"""
    W, ink, size = STRAND["wire"], STRAND["ink"], STRAND["bulbSize"]
    sh = c7_shapes()
    top, bottom, half, off = c7_frame()
    w = int(math.ceil(2 * half * ppr))
    h = int(math.ceil((bottom - top) * ppr))
    ax, ay = w / 2, -top * ppr
    L = lambda pts: [(x * size, y * size + off) for x, y in pts]  # local (size scaled, off down) to road px
    cx, cy, cw, chh = sh["collar"]
    collar = L(round_rect(cx, cy, cw, chh, (1.6, 1.6, 2.2, 2.2)))
    body = L(sh["body"])
    # THE BODY: the ink round the glass and the collar (even all round), the glass white with its shade crescent
    b = Pen(w, h, ppr, ax, ay)
    b.fill(body, S_INK)
    b.stroke(body, 2 * ink, S_INK, closed=True)
    b.fill(collar, S_INK)
    b.stroke(collar, 2 * ink, S_INK, closed=True)
    clip = b.mask(body)
    b.fill(body, (255, 255, 255, 255))
    b.fill([(-30, -20), (30, -20), (30, 80), (-30, 80)], rgba(0xB9BEC6), clip=clip)
    shifted = [(x - 2.6 * size, y - 2.2 * size) for x, y in body]
    b.fill(shifted, (255, 255, 255, 255), clip=clip)
    # THE OVER: the lead, its tie round the cord, the collar, the seam and the highlight
    o = Pen(w, h, ppr, ax, ay)
    lead = [(0.0, 0.0)] + cubic((0, 0), (4.5, off * 0.3), (-4.5, off * 0.62), (0, off + 1))
    cord = rgba(STRAND["cordColor"])
    o.stroke(lead, 3.2 + 2 * ink, S_INK)
    o.stroke(lead, 3.2, cord)
    th = W + 2 * ink + 2.4
    tw = 3.4 + 1.4 * ink
    o.fill(round_rect(-tw / 2, -th / 2, tw, th, (2, 2, 2, 2)), S_INK)
    o.fill(round_rect(-1.7, -th / 2 + ink * 0.7, 3.4, th - ink * 1.4, (1.2, 1.2, 1.2, 1.2)), cord)
    o.fill(collar, S_INK)
    o.stroke(collar, 2 * ink, S_INK, closed=True)
    o.fill(collar, rgba(STRAND["socketColor"]))
    cm = o.mask(collar)
    o.fill(L([(cx + cw * 0.16, cy - 20), (cx + cw * 0.34, cy - 20), (cx + cw * 0.34, cy + chh + 10), (cx + cw * 0.16, cy + chh + 10)]), (255, 255, 255, 41), clip=cm)
    for f in (0.38, 0.66):
        o.stroke(L([(cx, cy + chh * f), (cx + cw, cy + chh * f)]), max(0.6, ink * 0.32), (0, 0, 0, 140), cap=False, clip=cm)
    o.stroke(L([(cx + 0.4, cy + chh), (cx + cw - 0.4, cy + chh)]), ink * 0.75, S_INK)
    hx, hy, rx, ry, rot = sh["hl"]
    ell = [(hx + math.cos(t) * rx * math.cos(rot) - math.sin(t) * ry * math.sin(rot), hy + math.cos(t) * rx * math.sin(rot) + math.sin(t) * ry * math.cos(rot)) for t in np.linspace(0, 2 * math.pi, 64)]
    o.fill(L(ell), (255, 255, 255, 235))
    dx, dy, dr = sh["dot"]
    o.fill(L(arc_pts(dx, dy, dr, 0, 2 * math.pi)), (255, 255, 255, 235))
    spec = {"anchor": [ax / w, ay / h], "center": off + sh["center"] * size, "len": sh["len"] * size, "lead": off, "top": top, "bottom": bottom, "half": half}
    return b.done(), o.done(), spec


def strand_head(ppr):
    """the nail head (the mock's drawHead), centred"""
    R, ink = head_r(), STRAND["ink"]
    C = [rgba(c) for c in NAIL_TONES[STRAND["nailColor"]]]
    ext = R + ink + STRAND_MARGIN
    n = int(math.ceil(2 * ext * ppr))
    p = Pen(n, n, ppr, n / 2, n / 2)
    p.circle(0, 0, R + ink, S_INK)
    p.circle(0, 0, R, C[1])
    clip = p.mask(arc_pts(0, 0, R, 0, 2 * math.pi))
    # the shadow side: the even-odd ring of two circles, lower right
    im, d = p.layer()
    X, Y = p.P(R * 0.35, R * 0.35)
    r1 = R * 1.05 * p.k
    d.ellipse([X - r1, Y - r1, X + r1, Y + r1], fill=C[0])
    X2, Y2 = p.P(R * 0.12, R * 0.12)
    r2 = R * 0.78 * p.k
    d.ellipse([X2 - r2, Y2 - r2, X2 + r2, Y2 + r2], fill=(0, 0, 0, 0))
    p.put(im, clip)
    # the lit rim, upper left
    p.stroke(arc_pts(-R * 0.3, -R * 0.3, R * 0.95, math.pi * 0.9, math.pi * 1.6), R * 0.32, C[2], cap=False, clip=clip)
    p.circle(-R * 0.36, -R * 0.38, R * 0.24, C[3])
    return p.done(), {"radius": R, "outer": R + ink}


def strand_ring(ppr):
    """one turn of the cord round an end nail's shank (the mock's drawCoil, one turn), centred"""
    W, ink = STRAND["wire"], STRAND["ink"]
    rc = wrap_r()
    ext = rc + W / 2 + ink + STRAND_MARGIN
    n = int(math.ceil(2 * ext * ppr))
    p = Pen(n, n, ppr, n / 2, n / 2)
    p.annulus(0, 0, rc - W / 2 - ink, rc + W / 2 + ink, S_INK)
    p.annulus(0, 0, rc - W / 2, rc + W / 2, rgba(STRAND["cordColor"]))
    p.stroke(arc_pts(0, 0, rc - W * 0.08, math.pi * 0.95, math.pi * 1.55), W * 0.28, rgba(STRAND["cordHighlight"]))
    return p.done(), {"radius": rc, "outer": rc + W / 2 + ink}


def strand_shadow(ppr):
    """the nail's contact shadow (the mock's drawNailShadow), its anchor the nail's centre"""
    dx, dy, alpha = STRAND["shadow"]
    R = head_r() + STRAND["ink"]
    ext = max(R * 1.02 + abs(dx), R * 0.9 + abs(dy)) + STRAND_MARGIN
    n = int(math.ceil(2 * ext * ppr))
    p = Pen(n, n, ppr, n / 2, n / 2)
    ell = [(dx + math.cos(t) * R * 1.02, dy + math.sin(t) * R * 0.9) for t in np.linspace(0, 2 * math.pi, 96)]
    p.fill(ell, (0, 0, 0, int(round(alpha * 255))))
    return p.done(), {}


CORD_COLS = 8  # the strip's columns (all alike); the frame is the middle CORD_COLS - 4 (2 px of the same each side)


def strand_cord(ppr):
    """the cord's cross section, top (the cord's upper side) to bottom, as a strip of like columns"""
    W, ink = STRAND["wire"], STRAND["ink"]
    T = W + 2 * ink + 2 * STRAND_MARGIN
    h = int(math.ceil(T * ppr))
    half = h / ppr / 2
    p = Pen(CORD_COLS, h, ppr, CORD_COLS / 2, h / 2)

    def band(y0, y1, col):
        p.fill([(-50, y0), (50, y0), (50, y1), (-50, y1)], col)

    band(-(W / 2 + ink), W / 2 + ink, S_INK)
    band(-W / 2, W / 2, rgba(STRAND["cordColor"]))
    yc = -STRAND["highlightUp"] * W
    hw = STRAND["highlightWidth"] * W / 2
    band(yc - hw, yc + hw, rgba(STRAND["cordHighlight"]))
    return p.done(), {"halfWidth": half}


def pack(items, max_w):
    """shelf packing: (name, image) tallest first into rows no wider than max_w; returns positions and the sheet size"""
    order = sorted(items, key=lambda it: -it[1].height)
    pos = {}
    x = y = row_h = 0
    W = 0
    for name, im in order:
        if x and x + im.width > max_w:
            y += row_h + PAD
            x = row_h = 0
        pos[name] = (x, y)
        x += im.width + PAD
        row_h = max(row_h, im.height)
        W = max(W, x - PAD)
    return pos, W, y + row_h


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
    # THE STRAND (round 2): the numbers baked in, and each picture's road size and anchor (road px at rest; the sheet
    # holds them at the pop's size, `ppr` sheet px per road px per tier)
    top, bottom, half, off = c7_frame()
    spec["strand"] = {"bakedFor": dict(STRAND), "head": {"radius": head_r(), "outer": head_r() + STRAND["ink"], "shank": shank_r()},
                      "ring": {"radius": wrap_r(), "outer": wrap_r() + STRAND["wire"] / 2 + STRAND["ink"]},
                      "c7": {"center": off + c7_shapes()["center"] * STRAND["bulbSize"], "lead": off, "top": top, "bottom": bottom, "half": half}}
    for tier, k in DENSITY.items():
        ppr = k * POP
        g, b, nl = glow(k), bulb(k), nail(k, tier)
        body, over, c7spec = c7(ppr)
        head, _ = strand_head(ppr)
        ring, _ = strand_ring(ppr)
        shadow, _ = strand_shadow(ppr)
        cord, cspec = strand_cord(ppr)
        items = [("glow", g), ("bulb", b), ("nail", nl), ("c7Body", body), ("c7Over", over), ("head", head), ("ring", ring), ("shadow", shadow), ("cord", cord)]
        pos, W, H = pack(items, 1024 if tier == "full" else 400)
        sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for nm, im in items:
            sheet.paste(im, pos[nm])
        name = "win-lights.webp" if tier == "full" else "win-lights-phone.webp"
        sheet.save(os.path.join(OUT, name), "WEBP", lossless=True)
        frames = {nm: {"x": pos[nm][0], "y": pos[nm][1], "width": im.width, "height": im.height} for nm, im in items}
        # the cord strip's frame: its middle columns (the outer two each side the same, so the sampling never reaches past)
        frames["cord"] = {"x": pos["cord"][0] + 2, "y": pos["cord"][1], "width": CORD_COLS - 4, "height": cord.height}
        spec["tiers"][tier] = {"file": f"road/{name}", "width": W, "height": H, "density": k, "ppr": ppr,
                               "c7Anchor": c7spec["anchor"], "cordHalfWidth": cspec["halfWidth"], "frames": frames}
        sizes = ", ".join(f"{nm} {im.width} x {im.height}" for nm, im in items)
        print(f"{tier}: {name} {W} x {H} ({sizes}), {os.path.getsize(os.path.join(OUT, name))} bytes")
    with open(SPEC, "w") as f:
        f.write("// AUTO-GENERATED by tools/build_win_lights.py. Do not edit: change the tool and run it again.\n")
        f.write("// The Christmas lights win lines' sheet per asset tier: frames in sheet px; `width` and `height` at the top are the\n")
        f.write("// road px each is drawn at, at its largest (a lighting bulb's pop, `pop`). The strand's pictures (round 2: the C7 body\n")
        f.write("// and its socket, the nail head, the end wrap's ring, the nail's shadow, the cord strip) are at `ppr` sheet px per road px;\n")
        f.write("// the old bulb and nail frames stay on the sheet, no longer drawn.\n")
        f.write("export const WIN_LIGHTS_ART = " + json.dumps(spec, indent="\t") + " as const;\n")
    print("wrote", os.path.relpath(SPEC, APP))


if __name__ == "__main__":
    main()
