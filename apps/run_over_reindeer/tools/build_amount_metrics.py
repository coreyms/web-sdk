"""THE AMOUNT FIT METRICS (2026-11-21, wip/pricefit): the advance widths, in em, of every character an amount can hold, read
from the game's own bundled font files, for tools/amount_fit_test.mjs (node only: no canvas, no browser).

    nice -n 19 /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/build_amount_metrics.py   (from the app)

Writes tools/amount_fit_metrics.json. Per face and weight: the printable ASCII, the no-break space, the currency signs the
face has, and "missing" (the widest the browser's fallback face is assumed to draw a sign the face lacks: 0.72 em, an
upper bound over the system faces' rouble, rupee, won, dong, naira and shekel signs). Digits are measured as the widest
digit, so a number reads at its tabular width whatever its digits. Kerning is not applied (it only narrows these
strings), so every width is an upper bound.
"""
import json
import os

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "..", "static", "assets", "fonts")
OUT = os.path.join(HERE, "amount_fit_metrics.json")

# (face name as the CSS names it, weight, file, variable axis value or None)
FACES = [
    ("Overpass", 400, "overpass/Overpass-regular.woff2", None),
    ("Overpass", 700, "overpass/Overpass-bold.woff2", None),
    ("Overpass", 800, "overpass/Overpass-extrabold.woff2", None),
    ("Overpass", 900, "overpass/Overpass-heavy.woff2", None),
    # Outfit-Variable.woff2 is one static Black face (ui/fontFaces.ts): every weight draws it
    ("Outfit", 900, "ui/Outfit-Variable.woff2", None),
    ("Sora", 800, "ui/Sora-Variable.woff2", None),
    ("Outfit Text", 400, "ui/OutfitText-Variable.woff2", 400),
    ("Outfit Text", 500, "ui/OutfitText-Variable.woff2", 500),
    ("Outfit Text", 600, "ui/OutfitText-Variable.woff2", 600),
    ("Outfit Text", 700, "ui/OutfitText-Variable.woff2", 700),
    ("Outfit Text", 800, "ui/OutfitText-Variable.woff2", 800),
    ("Outfit Text", 900, "ui/OutfitText-Variable.woff2", 900),
]
MISSING_EM = 0.72
EXTRA = "   −¥€£₽₹₩₫₺₦₪₡₨₵₾₴₱ł"


def advances(path, wght):
    f = TTFont(path)
    if wght is not None and "fvar" in f:
        f = instantiateVariableFont(f, {"wght": wght})
    upm = f["head"].unitsPerEm
    cmap = f.getBestCmap()
    hmtx = f["hmtx"].metrics
    out = {}
    for ch in [chr(c) for c in range(0x20, 0x7F)] + list(EXTRA):
        g = cmap.get(ord(ch))
        if g is not None:
            out[ch] = round(hmtx[g][0] / upm, 4)
    widest_digit = max(out[d] for d in "0123456789")
    for d in "0123456789":
        out[d] = widest_digit
    return out


def main():
    faces = {}
    for name, weight, rel, wght in FACES:
        faces[f"{name}|{weight}"] = advances(os.path.join(FONTS, rel), wght)
    with open(OUT, "w") as fh:
        json.dump({"missing": MISSING_EM, "faces": faces}, fh, ensure_ascii=False, indent=0, sort_keys=True)
        fh.write("\n")
    print(f"wrote {OUT}: {len(faces)} faces")


if __name__ == "__main__":
    main()
