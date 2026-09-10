"""Build the Angry Mantis symbol + character sprite sheets (run with math-sdk/env/bin/python).

Real art is picked up from <repo>/assets/images/tile/<file>.webp when present (any source size; it is
resampled to S×S), otherwise a labelled placeholder tile is drawn. Eaten variants of real art are derived
(desaturated + darkened) until dedicated eaten art exists. Keep the frame names — the game references them.

Preferred art scheme (2026-08-26) for the eight paying insects: TWO files per symbol —
  <p>-plate.webp   the empty plate            (p = l1..l4, m1..m3, h1)
  <p>-insect.webp  the insect cutout, positioned at its on-plate spot in a transparent S×S canvas
The tile is composited here (plate + contact shadow + insect), so the eat animation's pickup is
pixel-perfect by construction and the shadow correctly vanishes with the insect. The older three-file
scheme (combined tile + -blank + -insect) still works wherever no -plate file exists."""
import json, os
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageEnhance, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))  # apps/angry_mantis/tools (moved out of static/ 2026-09-02 so it no longer ships to the CDN)
REPO = os.path.abspath(os.path.join(HERE, *[".."] * 4))
SPRITES = os.path.abspath(os.path.join(HERE, "..", "static", "assets", "sprites"))
ART = os.environ.get("AM_TILE_ART", os.path.join(REPO, "assets", "images", "tile"))
S = 256  # source tile size (design spec: 256×256, corner radius 9% = 23px)
RADIUS = round(S * 0.09)
FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", round(S * 0.27))
SMALL = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", round(S * 0.13))

# symbol -> (placeholder label, colour, real art file or None)
# eaten state: <base>-blank.webp (the empty plate — the insect is gone) when it exists,
# else derived desaturate/darken. W/S/GL are never eaten; their eaten frames are unused.
# GL = the Service Bell (was the Glowing Leaf until 2026-09-10; the symbol id is the math contract).
SYMBOLS = {
    "H1": ("Marty Head", (46, 204, 113), "h1-mantis.webp"),
    "M1": ("Beetle", (230, 126, 34), "m1-beetle.webp"),
    "M2": ("Spider", (52, 152, 219), "m2-spider.webp"),
    "M3": ("Scorpion", (155, 89, 182), "m3-scorpion.webp"),
    # low-tier order re-arranged 2026-08-26 (round-plate art set): highest low first
    "L1": ("Lightning Bug", (241, 196, 15), "l1-lightning-bug.webp"),
    "L2": ("Fly", (39, 174, 96), "l2-fly.webp"),
    "L3": ("Moth", (149, 165, 166), "l3-moth.webp"),
    "L4": ("Caterpillar", (22, 160, 133), "l4-caterpillar.webp"),
    "W": ("WILD", (212, 175, 55), "wild.webp"),
    "S": ("MARKY", (192, 57, 43), "scatter-marky.webp"),
    # Service Bell (2026-09-10, replaced the Glowing Leaf): frame 1 is the resting tile; the four
    # pressed frames below are appended to the sheet as GL_ring_2..5 for the "order up" ring
    "GL": ("Service Bell", (200, 170, 90), "service-bell-1.webp"),
}
BELL_RING_FRAMES = [f"service-bell-{i}.webp" for i in range(2, 6)]
# Glow baked BEHIND every bell frame on the board tile (Corey 2026-09-10, "rays + ripple" pick at
# 77%): a soft halo plus a 14-ray sunburst, same hue as the runtime glow under the hero bell —
# keep BELL_GLOW_HEX in sync with BELL_GLOW.color in src/game/bellGlow.ts.
BELL_GLOW_HEX = (0xC4, 0xBC, 0x00)
BELL_GLOW_PCT = 0.77


def bell_glow():
    """halo + ray wheel at 1.15x the tile, clipped by the tile canvas, alpha scaled by BELL_GLOW_PCT."""
    from PIL import ImageChops
    big = int(S * 1.15)
    glow = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    # halo: radial falloff 0.9 -> 0.45 at 35% -> 0
    r = big / 2
    halo = Image.new("L", (big, big), 0)
    px = halo.load()
    for y in range(big):
        for x in range(big):
            d = ((x - r) ** 2 + (y - r) ** 2) ** 0.5 / r
            if d >= 1:
                continue
            a = 0.9 - (0.9 - 0.45) * (d / 0.35) if d < 0.35 else 0.45 * (1 - (d - 0.35) / 0.65)
            px[x, y] = int(255 * a * 0.8)
    # rays: 14 wedges, linear falloff to the rim
    rays = Image.new("L", (big, big), 0)
    rd = ImageDraw.Draw(rays)
    import math
    for i in range(14):
        ang = i * 2 * math.pi / 14
        for k in range(12, 0, -1):  # concentric wedge slices approximate the gradient
            f = k / 12
            a = int(255 * 0.55 * (1 - f) * 0.5)
            L = r * f
            hw = 22 * (big / 512) * f
            tip = (r + math.cos(ang) * L, r + math.sin(ang) * L)
            nx, ny = -math.sin(ang) * hw, math.cos(ang) * hw
            rd.polygon([(r, r), (tip[0] + nx, tip[1] + ny), (tip[0] - nx, tip[1] - ny)], fill=max(a, rays.getpixel((int(tip[0]), int(tip[1]))) if 0 <= tip[0] < big and 0 <= tip[1] < big else a))
    alpha = ImageChops.add(halo, rays)
    alpha = alpha.point(lambda p: int(p * BELL_GLOW_PCT))
    glow.paste(BELL_GLOW_HEX + (255,), (0, 0, big, big), alpha)
    off = (S - big) // 2
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.alpha_composite(glow, (off, off), (0, 0, big, big)) if off >= 0 else out.alpha_composite(glow.crop((-off, -off, -off + S, -off + S)))
    return out


def with_bell_glow(frame):
    return Image.alpha_composite(bell_glow(), frame)


def tile(label, sub, color, glow=False):
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if glow:
        d.ellipse((6, 6, S - 6, S - 6), fill=(*color, 90))
    d.rounded_rectangle((2, 2, S - 3, S - 3), radius=RADIUS, fill=(*color, 255), outline=(20, 20, 20, 255), width=round(S * 0.025))
    w = d.textlength(label, font=FONT)
    d.text(((S - w) / 2, S * 0.24), label, font=FONT, fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0, 255))
    w = d.textlength(sub, font=SMALL)
    d.text(((S - w) / 2, S * 0.61), sub, font=SMALL, fill=(255, 255, 255, 230))
    return im


def art(fname):
    path = os.path.join(ART, fname)
    if not os.path.exists(path):
        return None
    im = Image.open(path).convert("RGBA")
    if im.size != (S, S):
        im = im.resize((S, S), Image.LANCZOS)
    return im


def contact_shadow(insect, plate, offset=(0, 22), blur=8, strength=0.8):
    """Cast shadow from the insect's own silhouette, straight down like the painted tray shadows
    (Corey 2026-09-04), clipped to the plate so a bug never shadows outside its own tray. Baked into
    the composed tile only, so it lifts away with the insect during the eat flight."""
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    a = insect.getchannel("A").point(lambda p: int(p * strength))
    shadow.paste((12, 8, 3, 255), offset, a)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    clipped = ImageChops.multiply(shadow.getchannel("A"), plate.getchannel("A"))
    shadow.putalpha(clipped)
    return shadow


def eaten_from_art(im):
    # desaturate + darken; alpha preserved
    gray = ImageEnhance.Color(im.convert("RGB")).enhance(0)
    out = ImageEnhance.Brightness(gray).enhance(0.42).convert("RGBA")
    out.putalpha(im.getchannel("A"))
    return out


def sheet(name, frames):
    cols = 4
    rows = (len(frames) + cols - 1) // cols
    atlas = Image.new("RGBA", (cols * S, rows * S), (0, 0, 0, 0))
    meta = {"frames": {}, "meta": {"image": f"{name}.webp", "format": "RGBA8888", "size": {"w": cols * S, "h": rows * S}, "scale": "1"}}
    for i, (fname, im) in enumerate(frames.items()):
        x, y = (i % cols) * S, (i // cols) * S
        atlas.paste(im, (x, y))
        meta["frames"][fname] = {"frame": {"x": x, "y": y, "w": S, "h": S}, "rotated": False, "trimmed": False,
                                 "spriteSourceSize": {"x": 0, "y": 0, "w": S, "h": S}, "sourceSize": {"w": S, "h": S}, "pivot": {"x": 0.5, "y": 0.5}}
    out = os.path.join(SPRITES, name)
    os.makedirs(out, exist_ok=True)
    # lossy WebP with a lossless alpha plane: the PNG sheet was 2.96 MB, this is ~0.65 MB at q90 with
    # no visible difference on 256 px tiles (Stake review 2026-09-02, landing payload)
    atlas.save(os.path.join(out, f"{name}.webp"), "WEBP", quality=90, method=6, exact=True)
    json.dump(meta, open(os.path.join(out, f"{name}.json"), "w"), indent=1)


frames = {}
real = []
missing_insects = []
composited = []
for sym, (sub, color, file) in SYMBOLS.items():
    prefix = sym.lower()
    plate = art(f"{prefix}-plate.webp") if sym not in ("W", "S", "GL") else None
    insect = art(f"{prefix}-insect.webp") if sym not in ("W", "S", "GL") else None
    if plate is not None and insect is not None:
        # two-file scheme: tile = plate + contact shadow + insect (registration-perfect pickup)
        tile_im = Image.alpha_composite(Image.alpha_composite(plate, contact_shadow(insect, plate)), insect)
        real.append(sym)
        composited.append(sym)
        frames[f"{sym}.png"] = tile_im
        frames[f"{sym}_eaten.png"] = plate
        frames[f"{sym}_insect.png"] = insect
        continue
    im = art(file) if file else None
    if im is not None:
        real.append(sym)
        frames[f"{sym}.png"] = im
        base = file.replace("-", "-blank-").split("-blank-")[0] if file else None
        blank = art(f"{base}-blank.webp") if base else None
        frames[f"{sym}_eaten.png"] = blank if blank is not None else eaten_from_art(im)
        if sym not in ("W", "S", "GL"):  # flight sprite for the eat animation: bug only, no plate
            # missing cutout -> fully transparent frame (bare leaf, invisible flight) rather than the
            # full tile riding the leaf; delivering <base>-insect.webp self-heals on next build
            frames[f"{sym}_insect.png"] = insect if insect is not None else Image.new("RGBA", (S, S), (0, 0, 0, 0))
            if insect is None:
                missing_insects.append(sym)
    else:
        frames[f"{sym}.png"] = tile(sym, sub, color, glow=(sym == "GL"))
        frames[f"{sym}_eaten.png"] = tile(sym, "EATEN", tuple(c // 3 for c in color))
# ring frames of the Service Bell (see game/bell.ts): GL_ring_2..5 = press depths, played 1-5 once
for i, fname in enumerate(BELL_RING_FRAMES, start=2):
    im = art(fname)
    frames[f"GL_ring_{i}"+".png"] = im if im is not None else tile("GL", f"ring {i}", (200, 170, 90))
# the glow sits behind every bell frame so the ring never pops it on/off
for key in ["GL.png"] + [f"GL_ring_{i}.png" for i in range(2, 6)]:
    frames[key] = with_bell_glow(frames[key])
sheet("amSymbols", frames)

chars = {
    "marty_idle.png": tile("MARTY", "idle", (46, 204, 113)),
    "marty_strike.png": tile("MARTY", "STRIKE!", (30, 150, 80)),
    "marky_idle.png": tile("MARKY", "idle", (192, 57, 43)),
    "marky_strike.png": tile("MARKY", "STRIKE!", (140, 30, 20)),
    "lock.png": tile("ANTE", "locked S", (212, 175, 55)),
}
sheet("amCharacters", chars)

# Game Info thumbnails: per-symbol webp for the HTML rules modal, served from static/assets/tiles/.
# <key>.webp = the tile; <key>_insect.webp = the insect cutout (paying symbols only).
THUMB = 128
thumb_dir = os.path.abspath(os.path.join(SPRITES, "..", "tiles"))
os.makedirs(thumb_dir, exist_ok=True)
for sym in SYMBOLS:
    frames[f"{sym}.png"].resize((THUMB, THUMB), Image.LANCZOS).save(os.path.join(thumb_dir, f"{sym.lower()}.webp"), "WEBP", quality=88)
    insect = frames.get(f"{sym}_insect.png")
    if insect is not None:
        insect.resize((THUMB, THUMB), Image.LANCZOS).save(os.path.join(thumb_dir, f"{sym.lower()}_insect.webp"), "WEBP", quality=88)
print(f"ok — real art for {real}; composited (plate+insect) {composited}; placeholders for {[s for s in SYMBOLS if s not in real]}; missing insect cutouts: {missing_insects}  (art dir: {ART})")
