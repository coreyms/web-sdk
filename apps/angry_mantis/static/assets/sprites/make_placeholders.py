"""Build the Angry Mantis symbol + character sprite sheets (run with math-sdk/env/bin/python).

Real art is picked up from <repo>/assets/images/tile/<file>.webp when present (any source size; it is
resampled to S×S), otherwise a labelled placeholder tile is drawn. Eaten variants of real art are derived
(desaturated + darkened) until dedicated eaten art exists. Keep the frame names — the game references them."""
import json, os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, *[".."] * 6))
ART = os.environ.get("AM_TILE_ART", os.path.join(REPO, "assets", "images", "tile"))
S = 256  # source tile size (design spec: 256×256, corner radius 9% = 23px)
RADIUS = round(S * 0.09)
FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", round(S * 0.27))
SMALL = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", round(S * 0.13))

# symbol -> (placeholder label, colour, real art file or None)
SYMBOLS = {
    "H1": ("Marty Head", (46, 204, 113), "h1-mantis.webp"),
    "M1": ("Beetle", (230, 126, 34), "m1-beetle.webp"),
    "M2": ("Spider", (52, 152, 219), "m2-spider.webp"),
    "M3": ("Scorpion", (155, 89, 182), "m3-scorpion.webp"),
    "L1": ("Fly", (39, 174, 96), "l1-fly.webp"),
    "L2": ("Caterpillar", (22, 160, 133), "l2-caterpillar.webp"),
    "L3": ("Lightning Bug", (241, 196, 15), "l3-lightning-bug.webp"),
    "L4": ("Moth", (149, 165, 166), "l4-moth.webp"),
    "W": ("WILD", (212, 175, 55), "wild.webp"),
    "S": ("MARKY", (192, 57, 43), "scatter-marky.webp"),
    "GL": ("Glowing Leaf", (120, 255, 120), "strike-leaf.webp"),
}


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
    meta = {"frames": {}, "meta": {"image": f"{name}.png", "format": "RGBA8888", "size": {"w": cols * S, "h": rows * S}, "scale": "1"}}
    for i, (fname, im) in enumerate(frames.items()):
        x, y = (i % cols) * S, (i // cols) * S
        atlas.paste(im, (x, y))
        meta["frames"][fname] = {"frame": {"x": x, "y": y, "w": S, "h": S}, "rotated": False, "trimmed": False,
                                 "spriteSourceSize": {"x": 0, "y": 0, "w": S, "h": S}, "sourceSize": {"w": S, "h": S}, "pivot": {"x": 0.5, "y": 0.5}}
    out = os.path.join(HERE, name)
    os.makedirs(out, exist_ok=True)
    atlas.save(os.path.join(out, f"{name}.png"))
    json.dump(meta, open(os.path.join(out, f"{name}.json"), "w"), indent=1)


frames = {}
real = []
for sym, (sub, color, file) in SYMBOLS.items():
    im = art(file) if file else None
    if im is not None:
        real.append(sym)
        frames[f"{sym}.png"] = im
        frames[f"{sym}_eaten.png"] = eaten_from_art(im)
    else:
        frames[f"{sym}.png"] = tile(sym, sub, color, glow=(sym == "GL"))
        frames[f"{sym}_eaten.png"] = tile(sym, "EATEN", tuple(c // 3 for c in color))
sheet("amSymbols", frames)

chars = {
    "marty_idle.png": tile("MARTY", "idle", (46, 204, 113)),
    "marty_strike.png": tile("MARTY", "STRIKE!", (30, 150, 80)),
    "marky_idle.png": tile("MARKY", "idle", (192, 57, 43)),
    "marky_strike.png": tile("MARKY", "STRIKE!", (140, 30, 20)),
    "lock.png": tile("ANTE", "locked S", (212, 175, 55)),
}
sheet("amCharacters", chars)
print(f"ok — real art for {real}; placeholders for {[s for s in SYMBOLS if s not in real]}  (art dir: {ART})")
