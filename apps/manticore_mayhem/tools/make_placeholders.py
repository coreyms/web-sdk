"""Build the Manticore Mayhem PLACEHOLDER art (run with math-sdk/env/bin/python).

Milestone 1 ships no production art: every tile is a flat coloured plate carrying the symbol's
CODE ID and its TIER word, so a board read at phone size still sorts tier first and symbol second
(spec D's readability rule, expressed the cheap way). Real art replaces these files one at a time —
the frame names are the contract and must not change.

Outputs (static/assets):
  sprites/mmSymbols/mmSymbols.json + .webp        256 px cells, one frame per symbol
  sprites/mmSymbols/mmSymbols-half.json + .webp   128 px twin for the phone asset tier
  ui/logo-wide.webp, ui/logo-landscape.webp       placeholder wordmark
  ui/10000x.webp                                  placeholder "WIN UP TO 10,000x" tagline strip
  ui/intro/card-1..3.webp                         placeholder primer cards (landing screen)
  ui/board-backdrop.webp                          the 8x8 cell wells behind the tiles
  tiles/<code>.webp, tiles/x<n>.webp              single tiles for the HTML Game Info paytable

Frames in the atlas:
  L1..L4, M1..M3, H1      paying symbols  (plate + id + tier word)
  W                       wild            (lion-sun placeholder: gold plate, WILD)
  S                       scatter         (crimson plate, SCATTER)
  x2 x4 x8 x16 x32 x64 x128   multiplier-tile OVERLAYS drawn on top of a cell's symbol
  cell                    one empty cell well (tiled into the board backdrop)
"""
import json
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.abspath(os.path.join(HERE, "..", "static", "assets"))
SPRITES = os.path.join(STATIC, "sprites", "mmSymbols")
UI = os.path.join(STATIC, "ui")

S = 256
RADIUS = round(S * 0.10)

BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
F_ID = ImageFont.truetype(BOLD, round(S * 0.34))
F_TIER = ImageFont.truetype(BOLD, round(S * 0.11))
F_MULT = ImageFont.truetype(BOLD, round(S * 0.30))

# Persian / iron / gold / turquoise palette (spec A identity). One hue per symbol, tier read by
# plate brightness: lows are flat and dark, highs are brighter metal, the premium is gold.
SYMBOLS = {
    "L1": ("LOW", "IRON SHACKLE", (86, 92, 98)),
    "L2": ("LOW", "BULL SKULL", (196, 188, 170)),
    "L3": ("LOW", "ANCIENT KEY", (108, 138, 122)),
    "L4": ("LOW", "ROYAL SEAL", (38, 132, 124)),
    "M1": ("HIGH", "PERSIAN HELMET", (118, 146, 176)),
    "M2": ("HIGH", "PERSIAN DAGGER", (150, 120, 132)),
    "M3": ("HIGH", "ROYAL CHALICE", (196, 158, 74)),
    "H1": ("PREMIUM", "ANCIENT CROWN", (226, 182, 72)),
    "W": ("WILD", "LION-SUN", (212, 175, 55)),
    "S": ("SCATTER", "WAR STANDARD", (176, 44, 44)),
}
MULTS = [2, 4, 8, 16, 32, 64, 128]

IRON = (26, 28, 32)
GOLD = (214, 174, 84)
TURQUOISE = (46, 176, 168)
SAND = (232, 216, 186)


def _text(d, xy, s, font, fill, anchor="mm", shadow=(0, 0, 0, 150)):
    if shadow:
        d.text((xy[0] + S * 0.012, xy[1] + S * 0.012), s, font=font, fill=shadow, anchor=anchor)
    d.text(xy, s, font=font, fill=fill, anchor=anchor)


def plate(rgb, size=S, radius=RADIUS, border=GOLD, border_w=None):
    """A flat plate with a bevel lip and a hairline border — the placeholder tile body."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = round(size * 0.035)
    bw = border_w if border_w is not None else max(2, round(size * 0.016))
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=rgb + (255,))
    # top lip: a lighter band so the tile reads as a physical plate at small sizes
    lip = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lip)
    ld.rounded_rectangle([pad, pad, size - pad, pad + size * 0.30], radius=radius, fill=(255, 255, 255, 34))
    img.alpha_composite(lip)
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, outline=border + (210,), width=bw)
    return img


def symbol_tile(code, tier, rgb):
    img = plate(rgb)
    d = ImageDraw.Draw(img)
    ink = IRON if sum(rgb) > 430 else (245, 240, 230)
    _text(d, (S / 2, S * 0.45), code, F_ID, ink + (255,))
    _text(d, (S / 2, S * 0.74), tier, F_TIER, ink + (200,))
    return img


def mult_overlay(value):
    """Drawn OVER a cell's symbol: a turquoise disc with the multiplier, corner-anchored by the
    board so the symbol underneath stays readable."""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = S * 0.40
    cx = cy = S / 2
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([cx - r * 1.18, cy - r * 1.18, cx + r * 1.18, cy + r * 1.18], fill=TURQUOISE + (90,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(S * 0.04)))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=IRON + (238,), outline=TURQUOISE + (255,), width=max(3, round(S * 0.022)))
    label = f"x{value}"
    font = F_MULT if len(label) <= 3 else ImageFont.truetype(BOLD, round(S * 0.22))
    _text(d, (cx, cy), label, font, (255, 255, 255, 255))
    return img


def cell_well():
    """One empty cell of the board backdrop: a dark recess with a gold hairline."""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = round(S * 0.035)
    d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=RADIUS, fill=(16, 17, 20, 220),
                        outline=GOLD + (70,), width=max(2, round(S * 0.012)))
    return img


def build_atlas():
    frames = {}
    images = []
    for code, (tier, _name, rgb) in SYMBOLS.items():
        images.append((f"{code}.png", symbol_tile(code, tier, rgb)))
    for m in MULTS:
        images.append((f"x{m}.png", mult_overlay(m)))
    images.append(("cell.png", cell_well()))

    cols = 4
    rows = math.ceil(len(images) / cols)
    sheet = Image.new("RGBA", (cols * S, rows * S), (0, 0, 0, 0))
    for i, (name, im) in enumerate(images):
        x, y = (i % cols) * S, (i // cols) * S
        sheet.alpha_composite(im, (x, y))
        frames[name] = {
            "frame": {"x": x, "y": y, "w": S, "h": S},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": S, "h": S},
            "sourceSize": {"w": S, "h": S},
            "pivot": {"x": 0.5, "y": 0.5},
        }
    os.makedirs(SPRITES, exist_ok=True)
    sheet.save(os.path.join(SPRITES, "mmSymbols.webp"), "WEBP", quality=92, method=6)
    json.dump(
        {"frames": frames, "meta": {"image": "mmSymbols.webp", "format": "RGBA8888",
                                    "size": {"w": sheet.width, "h": sheet.height}, "scale": "1"}},
        open(os.path.join(SPRITES, "mmSymbols.json"), "w"), indent=1)

    # half-resolution twin for the phone asset tier (game/deviceTier.ts)
    half = sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS)
    half.save(os.path.join(SPRITES, "mmSymbols-half.webp"), "WEBP", quality=92, method=6)
    hframes = {}
    for name, f in frames.items():
        hf = {k: dict(v) if isinstance(v, dict) else v for k, v in f.items()}
        hf["frame"] = {k: v // 2 for k, v in f["frame"].items()}
        hf["spriteSourceSize"] = {"x": 0, "y": 0, "w": S // 2, "h": S // 2}
        hf["sourceSize"] = {"w": S // 2, "h": S // 2}
        hframes[name] = hf
    json.dump(
        {"frames": hframes, "meta": {"image": "mmSymbols-half.webp", "format": "RGBA8888",
                                     "size": {"w": half.width, "h": half.height}, "scale": "0.5"}},
        open(os.path.join(SPRITES, "mmSymbols-half.json"), "w"), indent=1)
    print(f"atlas: {len(frames)} frames, {sheet.width}x{sheet.height}")


def build_tiles():
    """individual tile files for the HTML Game Info paytable (<img> cannot read the atlas)"""
    out = os.path.join(STATIC, "tiles")
    os.makedirs(out, exist_ok=True)
    for code, (tier, _name, rgb) in SYMBOLS.items():
        symbol_tile(code, tier, rgb).resize((128, 128), Image.LANCZOS).save(
            os.path.join(out, f"{code.lower()}.webp"), "WEBP", quality=92, method=6)
    for m in MULTS:
        mult_overlay(m).resize((128, 128), Image.LANCZOS).save(
            os.path.join(out, f"x{m}.webp"), "WEBP", quality=92, method=6)


def build_backdrop():
    """8x8 cell wells on one image, exactly the board window's aspect."""
    cell = cell_well().resize((128, 128), Image.LANCZOS)
    img = Image.new("RGBA", (128 * 8, 128 * 8), (10, 11, 13, 255))
    for r in range(8):
        for c in range(8):
            img.alpha_composite(cell, (c * 128, r * 128))
    os.makedirs(UI, exist_ok=True)
    img.save(os.path.join(UI, "board-backdrop.webp"), "WEBP", quality=90, method=6)


def build_tagline():
    """the chrome's "WIN UP TO 10,000x" strip (ui/Chrome*.svelte)"""
    w, h = 1080, 112
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(BOLD, 66)
    d.text((w / 2 + 3, h / 2 + 3), "WIN UP TO 10,000x", font=f, fill=(0, 0, 0, 160), anchor="mm")
    d.text((w / 2, h / 2), "WIN UP TO 10,000x", font=f, fill=SAND + (255,), anchor="mm")
    img.save(os.path.join(UI, "10000x.webp"), "WEBP", quality=92, method=6)


def build_logo():
    """Two wordmarks with the ASPECT RATIOS the chrome lays out around (matched to Angry Mantis's,
    which is what ui/Chrome*.svelte's fixed slots were sized for):
      logo-wide      1200x201  one line, portrait + phone
      logo-landscape  900x480  stacked, desktop
    """
    # wide: one line
    w, h = 1200, 201
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(BOLD, 104)
    d.text((w / 2 + 4, h / 2 + 4), "MANTICORE MAYHEM", font=f, fill=(0, 0, 0, 170), anchor="mm")
    d.text((w / 2, h / 2), "MANTICORE MAYHEM", font=f, fill=GOLD + (255,), anchor="mm")
    img.save(os.path.join(UI, "logo-wide.webp"), "WEBP", quality=92, method=6)

    # landscape: stacked
    w, h = 900, 480
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f1 = ImageFont.truetype(BOLD, 132)
    f2 = ImageFont.truetype(BOLD, 74)
    d.text((w / 2 + 5, h * 0.40 + 5), "MANTICORE", font=f1, fill=(0, 0, 0, 170), anchor="mm")
    d.text((w / 2, h * 0.40), "MANTICORE", font=f1, fill=GOLD + (255,), anchor="mm")
    d.text((w / 2, h * 0.68), "MAYHEM", font=f2, fill=TURQUOISE + (255,), anchor="mm")
    img.save(os.path.join(UI, "logo-landscape.webp"), "WEBP", quality=92, method=6)


CARDS = [
    ("CLUSTERS", "5 or more touching symbols pay.\nWinners are removed and the\nboard refills from above."),
    ("MULTIPLIER TILES", "Every cleared cell lights up x2\nand doubles again each time.\nTiles under a cluster add up."),
    ("THE MANTICORE", "Swipe, sting and roar break a\nstalled board open. 4, 5 or 6\nstandards open the features."),
]


def build_cards():
    os.makedirs(os.path.join(UI, "intro"), exist_ok=True)
    W, H = 800, 1200
    for i, (title, body) in enumerate(CARDS, start=1):
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([8, 8, W - 8, H - 8], radius=44, fill=(18, 19, 24, 242), outline=GOLD + (200,), width=6)
        d.rounded_rectangle([44, 44, W - 44, 300], radius=28, fill=(TURQUOISE if i == 2 else GOLD) + (46,))
        ft = ImageFont.truetype(BOLD, 64)
        fb = ImageFont.truetype(BOLD, 40)
        d.text((W / 2, 172), title, font=ft, fill=SAND + (255,), anchor="mm")
        d.multiline_text((W / 2, 560), body, font=fb, fill=(206, 206, 210, 255), anchor="mm",
                         align="center", spacing=22)
        d.text((W / 2, H - 120), "PLACEHOLDER ART", font=ImageFont.truetype(BOLD, 30),
               fill=(120, 120, 128, 255), anchor="mm")
        img.save(os.path.join(UI, "intro", f"card-{i}.webp"), "WEBP", quality=90, method=6)


if __name__ == "__main__":
    build_atlas()
    build_tiles()
    build_backdrop()
    build_logo()
    build_tagline()
    build_cards()
    print("placeholders written to", STATIC)
