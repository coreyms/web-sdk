#!/usr/bin/env python
"""THE WIN PLAQUE'S BRIGHT TITLES (bigwin-title r1, 2026-10-16; design review 2026-10-15 item 3: "a bright gold-to-white
title fill with a dark outline" and "a different title colour and a mode emblem" on the feature intro).

The plaque's own titles (tools/build_plaque_text.py, polished gold on the veined marble) read thin and low contrast.
This tool bakes the SAME words in the SAME face (Macondo Swash Caps, the plaque's display face: no new font family)
in a bright treatment that holds on the current marble and on a darker black iron and gold plaque:

  face      a vertical gradient over the cap band (white at the top through gold), a light bevel kept from the
            plaque's own lighting so the letters stay metal, not flat paint
  outline   a thick dark outline (a dilated mask), and a soft drop shadow under it, so the title separates from any
            slab behind it
  intro     the three feature titles in their MODE colour (the Armoury's accents: Bonus teal, Super blue, Epic
            fire red), never gold, so a feature intro never reads as a win
  emblems   the Armoury's own hero art (static/assets/ui/armoury/hero-<art>.webp: the War Standard for Bonus, the
            dagger for Super, the crown for Epic, the same pictures as the buy cards). r2 (Corey 2026-10-17 11:56
            "the symbols should use probably the symbols from the Armoury because they are better resolution and
            brighter"): the flat 640 px tall hero (sharper than any heroes.json grid cell, whose front cells are 640,
            512 and 512 tall) resized straight to the drawn size at the plaque's density, as bright as the menu
            shows it: no dark rim, no shadow, no tint (r1 had a dark rim and a drop shadow).
            r3 (Corey 2026-10-17 13:11 "they look really dark and blurry"): each emblem has its own size and lean
            (EMBLEMS, = game/constants.ts BIG_TITLE.intro.emblem), fitted to the clear marble beside the title, and
            the lean is BAKED (rotated once from the 640 px hero, premultiplied, then resized once to the drawn size),
            so the game draws the frame 1:1 at the plaque's density with no runtime rotation or scale resample

Two looks (the DEV / staging switch ?bwtitle=2|3, game/stinger/bigTitle.ts):
  forge   (2)  white to gold to deep amber, one dark outline
  molten  (3)  white to gold to fire orange, a dark red inner rim inside a black outline

Writes, per look and per asset tier (r2: the stinger PLAQUE's own density, tools/build_stinger_assets.py TIERS
plaque: FULL at 2 texture px per ship px, PHONE `-half` at 3/2; r1 baked 3/2 and 1, softer than the v6 plaque):
  static/assets/ui/bigwin/bigwin-titles-<look>[-half].json|webp     Pixi spritesheet, frames bwt_<look>_<name>
  src/game/stinger/bigTitleSpec.ts                                   every frame's box in SHIP px (tier independent)
This tool writes nothing the stinger build (tools/build_stinger_assets.py) writes.

Run from the parent repo root:
  math-sdk/env/bin/python web-sdk/apps/manticore_mayhem/tools/build_bigwin_titles.py
(from a worktree: PYTHONPATH=<parent repo>/tools, for build_plaque_text's kerning helper)
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from scipy import ndimage as ndi

import build_plaque_text as bpt
from build_stinger_assets import pack

HERE = Path(__file__).resolve().parent
APP = HERE.parent
OUT = APP / "static" / "assets" / "ui" / "bigwin"
SPEC_TS = APP / "src" / "game" / "stinger" / "bigTitleSpec.ts"
ARMOURY = APP / "static" / "assets" / "ui" / "armoury"

EM = bpt.TITLE_EM  # 228 px: the masks are drawn at 3x of a 76 px em, as the plaque's own titles are
# texture px per ship px: the stinger build's PLAQUE tiers (build_stinger_assets.TIERS[*]["plaque"]), checked in main()
TIERS = {"": 2.0, "-half": 1.5}
QUALITY = 92

# the cap height each group is BAKED at, ship px: the cap the game draws (game/constants.ts BIG_TITLE win.titleCap,
# wrap.titleCap, intro.titleCap), so the drawn texel density is exactly TIERS (more where a long title shrinks to fit)
BAKE_CAP = {"win": 54, "total": 42, "intro": 34}

# the words are the plaque's own (build_plaque_text.TITLES), so the two sets never disagree (the intro's spin counts
# are checked against the book at runtime: StingerPlaque.svelte introMatches)
WINS = {k: v[0] for k, v in bpt.TITLES.items() if k.startswith("win_")}
TOTAL = {"total_win": bpt.TITLES["total_win"][0]}
INTROS = {k: v[0] for k, v in bpt.TITLES.items() if k.startswith("intro_")}
# the intro emblems: (Armoury hero file, the art's UPRIGHT height in ship px, the lean in radians, + = counter-clockwise,
# the top toward the title on the RIGHT emblem; the game mirrors the left one). Must equal game/constants.ts
# BIG_TITLE.intro.emblem[mode].h / .tilt (view.ts warns on the dev server when the baked frame disagrees).
# r3 (2026-10-17): fitted to the clear marble beside the title (feedback/bigwin_title_r3/tools/fit_emblems.py): the War
# Standard 96, the dagger 89 stood nearly upright (0.55) in the strip beside the title and the first copy row, the
# crown 77 (r2: all three 100 px, upright art, leaned at runtime, half over the side pillars)
EMBLEMS = {
    "emblem_bonus": ("hero-standard.webp", 96, 0.12),
    "emblem_super": ("hero-dagger.webp", 89, 0.55),
    "emblem_epic": ("hero-crown.webp", 77, 0.12),
}

# gradient stops (position over the cap band, 0 = cap top, 1 = baseline; RGB)
GOLD = {
    "forge": [(0.0, (255, 252, 238)), (0.32, (255, 234, 160)), (0.6, (248, 192, 72)), (0.85, (216, 134, 36)), (1.0, (168, 88, 22))],
    "molten": [(0.0, (255, 255, 250)), (0.3, (255, 244, 196)), (0.58, (255, 206, 92)), (0.82, (246, 140, 40)), (1.0, (214, 72, 24))],
}
MODE = {
    "intro_bonus": [(0.0, (240, 255, 252)), (0.35, (170, 246, 234)), (0.7, (70, 206, 194)), (1.0, (30, 150, 142))],
    "intro_super": [(0.0, (246, 250, 255)), (0.35, (196, 222, 255)), (0.7, (136, 182, 255)), (1.0, (84, 124, 232))],
    "intro_epic": [(0.0, (255, 248, 232)), (0.35, (255, 196, 136)), (0.7, (255, 124, 84)), (1.0, (214, 64, 40))],
}
# outlines, em units of EM: (radius, RGB) drawn outermost first; then the drop shadow (dx, dy, blur, alpha)
OUTLINE = {
    "forge": [(0.062, (18, 9, 4))],
    "molten": [(0.074, (10, 5, 3)), (0.036, (122, 26, 10))],
}
SHADOW = (0.0, 0.035, 0.045, 0.7)


def gradient(stops, ys: np.ndarray) -> np.ndarray:
    pos = [p for p, _ in stops]
    return np.stack([np.interp(ys, pos, [c[i] / 255 for _, c in stops]) for i in range(3)], -1)


def bake_title(face: bpt.Face, text: str, stops, outline) -> tuple[Image.Image, dict]:
    run = bpt.layout(face, text, bpt.TITLE_NUDGE)
    pad = int(0.3 * EM)
    w, h = int(run[-1][1]) + 2 * pad, int(EM * 1.5) + 2 * pad
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    base_y = pad + int(EM * 1.05)
    for ch, x in run[:-1]:
        d.text((pad + x, base_y), ch, font=face.font, fill=255, anchor="ls")
    cap_top = base_y - int(face.cap * EM / face.upm)
    M = bpt.A(mask)
    canvas = np.zeros((h, w, 4), np.float32)
    # the drop shadow, from the outermost outline
    r0 = outline[0][0] * EM
    outer = bpt.dilate(mask, r0).filter(ImageFilter.GaussianBlur(0.006 * EM))
    dx, dy, blur, alpha = SHADOW
    sh = bpt.A(ImageChops.offset(outer, int(round(dx * EM)), int(round(dy * EM))).filter(ImageFilter.GaussianBlur(blur * EM)))
    canvas = bpt.over(canvas, (0, 0, 0), sh * alpha)
    for r, col in outline:
        ring = bpt.dilate(mask, r * EM).filter(ImageFilter.GaussianBlur(0.006 * EM))
        canvas = bpt.over(canvas, np.array(col, np.float32) / 255, bpt.A(ring))
    # the face: the gradient, with a light bevel (the plaque's own light from the upper left) so it stays metal
    inside = M > 0.5
    bevel = 0.03 * EM
    dist = ndi.distance_transform_edt(inside).astype(np.float32)
    height = ndi.gaussian_filter(np.minimum(dist, bevel), 0.008 * EM)
    gy, gx = np.gradient(height)
    n = np.stack([-gx, -gy, np.ones_like(gx)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    light = np.array([-0.45, -0.70, 0.55])
    light /= np.linalg.norm(light)
    diff = np.clip((n * light).sum(-1), 0, 1)
    half = light + np.array([0, 0, 1.0])
    half /= np.linalg.norm(half)
    spec = np.clip((n * half).sum(-1), 0, 1) ** 24
    ys = np.clip((np.arange(h) - cap_top) / max(1, base_y - cap_top), 0, 1)[:, None] * np.ones((1, w))
    col = gradient(stops, ys) * (0.78 + 0.34 * diff)[..., None] + spec[..., None] * 0.35
    canvas = bpt.over(canvas, np.clip(col, 0, 1), M)
    img = Image.fromarray((np.clip(canvas, 0, 1) * 255).astype(np.uint8), "RGBA")
    box = img.getbbox()
    meta = {"w": box[2] - box[0], "h": box[3] - box[1], "baseline": base_y - box[1], "cap": base_y - cap_top}
    return img.crop(box), meta


# the faintest alpha that counts as the picture when it is cropped (the hero files carry a soft transparent margin)
EMBLEM_CROP_ALPHA = 2


def bake_emblem(file: str, tilt: float) -> tuple[Image.Image, int]:
    """the Armoury's hero picture as the menu shows it, leaned by `tilt` radians (counter-clockwise) and cropped to its
    art: no rim, no shadow, no tint. Returns the image and the UPRIGHT art's height (what the drawn height is of)"""
    src = Image.open(ARMOURY / file).convert("RGBA")
    crop = lambda im: im.crop(im.getchannel("A").point(lambda v: 255 if v >= EMBLEM_CROP_ALPHA else 0).getbbox())
    upright = crop(src)
    # rotated premultiplied (RGBa), so the transparent margin's colour never fringes the edge
    leaned = upright.convert("RGBa").rotate(float(np.degrees(tilt)), resample=Image.BICUBIC, expand=True).convert("RGBA")
    return crop(leaned), upright.height


def to_ship(img: Image.Image, scale: float) -> np.ndarray:
    """resize a baked image by `scale` (premultiplied, so the dark rim never haloes) to a float RGBA array"""
    w, h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    a = np.asarray(img, np.float32) / 255
    pm = np.concatenate([a[..., :3] * a[..., 3:], a[..., 3:]], -1)
    chans = [Image.fromarray(pm[..., i], "F").resize((w, h), Image.LANCZOS) for i in range(4)]
    out = np.clip(np.stack([np.asarray(c) for c in chans], -1), 0, 1)
    rgb = out[..., :3] / np.maximum(out[..., 3:], 1e-6)
    return np.concatenate([np.clip(rgb, 0, 1), out[..., 3:]], -1)


def main() -> None:
    # the titles' density is the plaque's: never drift from the stinger build's tiers
    from build_stinger_assets import TIERS as STINGER_TIERS
    for suffix, tex in TIERS.items():
        assert float(STINGER_TIERS[suffix]["plaque"]) == tex, f"tier {suffix!r}: {tex} vs the plaque's {STINGER_TIERS[suffix]['plaque']}"
    OUT.mkdir(parents=True, exist_ok=True)
    chars = "".join(sorted({c for d in (WINS, TOTAL, INTROS) for t in d.values() for c in t}))
    face = bpt.Face(bpt.MACONDO, EM, chars)
    emblems = {name: (*bake_emblem(f, tilt), h) for name, (f, h, tilt) in EMBLEMS.items()}
    spec: dict[str, dict[str, list[float]]] = {}
    report = []
    for look in GOLD:
        baked: dict[str, tuple[Image.Image, dict, float]] = {}  # name -> (image, meta in bake px, ship px per bake px)
        for group, words in (("win", WINS), ("total", TOTAL), ("intro", INTROS)):
            for name, text in words.items():
                img, meta = bake_title(face, text, MODE[name] if group == "intro" else GOLD[look], OUTLINE[look])
                baked[name] = (img, meta, BAKE_CAP[group] / meta["cap"])
        for name, (img, upright_h, h) in emblems.items():
            baked[name] = (img, {"w": img.width, "h": img.height, "baseline": img.height, "cap": upright_h}, h / upright_h)
        # the boxes in SHIP px: [w, h, baseline, cap] (an emblem: the leaned frame's w and h, baseline = its bottom, cap =
        # the upright art's height, i.e. BIG_TITLE.intro.emblem[mode].h)
        spec[look] = {name: [round(m[k] * k2, 2) for k in ("w", "h", "baseline", "cap")] for name, (_, m, k2) in baked.items()}
        for suffix, tex in TIERS.items():
            items = [(f"bwt_{look}_{name}", to_ship(img, k * tex)) for name, (img, _, k) in baked.items()]
            sheet, frames = pack(items)
            stem = f"bigwin-titles-{look}{suffix}"
            im = Image.fromarray((sheet * 255 + 0.5).astype(np.uint8), "RGBA")
            path = OUT / f"{stem}.webp"
            im.save(path, "WEBP", quality=QUALITY, method=6, alpha_quality=100)
            meta = {"image": f"{stem}.webp", "format": "RGBA8888", "size": {"w": im.width, "h": im.height}, "scale": "1", "pngHash": hashlib.md5(path.read_bytes()).hexdigest()[:8]}
            (OUT / f"{stem}.json").write_text(json.dumps({"frames": frames, "meta": meta}, indent=1) + "\n")
            mb = im.width * im.height * 4 / 2**20
            report.append(f"  {stem:30s} {im.width:5d} x {im.height:4d}  {mb:5.2f} MB RGBA8 ({mb * 4 / 3:5.2f} with mips)  {path.stat().st_size / 1024:6.0f} KB")
    lines = [
        "// AUTO-GENERATED by apps/manticore_mayhem/tools/build_bigwin_titles.py (do not edit: rerun the tool).",
        "// THE WIN PLAQUE'S BRIGHT TITLES: every frame's box in SHIP px of the 946 x 532 plaque, tier independent",
        "// (static/assets/ui/bigwin/bigwin-titles-<look>[-half].json, frames bwt_<look>_<name>): [w, h, baseline, cap].",
        "// baseline and cap are measured from the image's top. The image is drawn at (drawn cap / cap) of these. An emblem",
        "// is the leaned frame (baked lean), drawn 1:1: w x h, baseline = its bottom, cap = the upright art's height.",
        f"export const BIG_TITLE_LOOKS = {json.dumps(list(GOLD))} as const;",
        "export type BigTitleLook = (typeof BIG_TITLE_LOOKS)[number];",
        "export const BIG_TITLE_SPEC: Record<BigTitleLook, Record<string, readonly [number, number, number, number]>> = {",
    ]
    for look, frames in spec.items():
        lines.append(f"\t{look}: {{")
        for name, box in frames.items():
            lines.append(f"\t\t{name}: [{', '.join(str(v) for v in box)}],")
        lines.append("\t},")
    lines.append("};")
    SPEC_TS.write_text("\n".join(lines) + "\n")
    print("bigwin titles:")
    print("\n".join(report))


if __name__ == "__main__":
    main()
