#!/usr/bin/env python
"""THE LOGO: the Citadel Tablet (Corey picked take A, 2026-11-16; images/logo_tablet_r1_2026-11-16/NOTES.md).

  /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/build_logo_tablet.py [--src PNG]

The art is not touched: the source PNG is encoded as it is, and the phone tier's copy is a plain Lanczos downscale
(Pillow resizes RGBA in premultiplied alpha, so no dark fringe). No sharpening, no trim: the files keep the source's
8 px transparent margin, so the groove map (src/game/logo/grooves.json, image px of 1893 x 620) lines up with both.

  static/assets/ui/logo-tablet.webp         1893 x 620, the source's own pixels (every tier but the phone's)
  static/assets/ui/logo-tablet-phone.webp   PHONE_WIDTH wide (the phone tier: game/deviceTier.ts PHONE_TIER)

PHONE_WIDTH: the phone tier's largest draw is the portrait landing screen (LOGO.landing.portrait, 348 of the 412 master)
on the widest portrait phone the tier allows (short side 500 CSS px: 422 CSS px), so 1280 keeps 3 device px per CSS px
there. Rerun stamp-assets (pnpm dev / pnpm build do) after a rebuild.
"""
import argparse
from pathlib import Path

from PIL import Image

APP = Path(__file__).resolve().parent.parent
UI = APP / "static" / "assets" / "ui"
SRC = Path.home() / "Desktop" / "Manticore Mayhem" / "images" / "logo_tablet_r1_2026-11-16" / "logo_tablet_A.png"
PHONE_WIDTH = 1280
QUALITY = 90


def save(img: Image.Image, path: Path) -> None:
    img.save(path, "WEBP", quality=QUALITY, method=6, alpha_quality=100, exact=True)
    print(f"{path.relative_to(APP)}  {img.width} x {img.height}  {path.stat().st_size / 1024:.0f} KB")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=SRC)
    ap.add_argument("--out", type=Path, default=UI)
    a = ap.parse_args()
    src = Image.open(a.src).convert("RGBA")
    out = a.out
    out.mkdir(parents=True, exist_ok=True)
    save(src, out / "logo-tablet.webp")
    h = round(src.height * PHONE_WIDTH / src.width)
    save(src.resize((PHONE_WIDTH, h), Image.LANCZOS), out / "logo-tablet-phone.webp")


if __name__ == "__main__":
    main()
