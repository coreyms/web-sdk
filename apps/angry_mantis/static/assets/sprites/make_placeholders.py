"""Generate placeholder sprite sheets for Angry Mantis (run with math-sdk/env/bin/python).
Replace these with the real art from Corey's animation app; keep the frame names."""
import json, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
S = 200
FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 54)
SMALL = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 26)

SYMBOLS = {
    "H1": ("Marty Head", (46, 204, 113)), "M1": ("Cricket", (230, 126, 34)), "M2": ("Beetle", (52, 152, 219)),
    "M3": ("Butterfly", (155, 89, 182)), "L1": ("Leaf Tile", (39, 174, 96)), "L2": ("Leaf Tile", (22, 160, 133)),
    "L3": ("Leaf Tile", (241, 196, 15)), "L4": ("Leaf Tile", (149, 165, 166)), "W": ("WILD", (212, 175, 55)),
    "S": ("MARKY", (192, 57, 43)), "GL": ("Glowing Leaf", (120, 255, 120)),
}


def tile(label, sub, color, glow=False):
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if glow:
        d.ellipse((6, 6, S - 6, S - 6), fill=(*color, 90))
    d.rounded_rectangle((2, 2, S - 3, S - 3), radius=18, fill=(*color, 255), outline=(20, 20, 20, 255), width=5)
    w = d.textlength(label, font=FONT)
    d.text(((S - w) / 2, 48), label, font=FONT, fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0, 255))
    w = d.textlength(sub, font=SMALL)
    d.text(((S - w) / 2, 122), sub, font=SMALL, fill=(255, 255, 255, 230))
    return im


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
for sym, (sub, color) in SYMBOLS.items():
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
print("ok")
