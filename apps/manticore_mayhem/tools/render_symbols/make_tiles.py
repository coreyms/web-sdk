#!/usr/bin/env python3
"""Render the Manticore symbol models and bake them into 256 px tiles.

  math-sdk/env/bin/python make_tiles.py [--only H1,W] [--no-render] [--out DIR]

1. Renders every model in models.json with rig.json through Blender (headless) at 1024 px into
   <out>/render/<CODE>.png (RGBA). The rig's per_code block carries the per-symbol exposure.
2. Bakes each render into a 256 px tile per fit.json: the silhouette is cropped, scaled so its
   larger side is `size` percent of the 110 px cell (the tile itself is CELL_FILL = 0.94 of the
   cell), offset by dx/dy percent of a cell, rotated by rot degrees, and centred.
3. Writes <out>/tiles/<code>.png (256, transparent) plus <out>/_contact.png and <out>/_context.png.
Nothing is copied into static/assets or the working folder's final/: promotion is a manual step.
"""
import json, os, subprocess, sys, math
from PIL import Image, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"
BACKDROP = os.path.join(HERE, "..", "..", "static", "assets", "ui", "board-backdrop.webp")
TILE = 256
def arg(k, d=None): return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
out = arg("--out", os.path.join(HERE, "out")); only = arg("--only")
fit = json.load(open(os.path.join(HERE, "fit.json"))); cell_fill = float(fit.get("cellFill", 0.94))
models = json.load(open(os.path.join(HERE, "models.json")))
rdir, tdir = os.path.join(out, "render"), os.path.join(out, "tiles"); os.makedirs(rdir, exist_ok=True); os.makedirs(tdir, exist_ok=True)
if "--no-render" not in sys.argv:
    cmd = [BLENDER, "-b", "--python", os.path.join(HERE, "render_rig.py"), "--", "--rig", os.path.join(HERE, "rig.json"), "--models", os.path.join(HERE, "models.json"), "--out", rdir, "--size", "1024"]
    if only: cmd += ["--only", only]
    r = subprocess.run(cmd, capture_output=True, text=True)
    for line in r.stdout.splitlines():
        if line.startswith("RESULT"): print(line[:120])
    if r.returncode: print(r.stderr[-2000:]); sys.exit("blender failed")
px_per_cell = TILE / cell_fill  # tile pixels in one 110 px cell
for m in models:
    code = m["code"]
    if only and code not in only.split(","): continue
    f = fit["symbols"].get(code, {"size": 88, "dx": 0, "dy": 0, "rot": 0})
    im = Image.open(os.path.join(rdir, code + ".png")).convert("RGBA"); bb = im.getbbox(); crop = im.crop(bb) if bb else im
    if f.get("rot"): crop = crop.rotate(-f["rot"], resample=Image.BICUBIC, expand=True); crop = crop.crop(crop.getbbox())
    w, h = crop.size; side = px_per_cell * f["size"] / 100; k = side / max(w, h)
    crop = crop.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    tile = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    x = round((TILE - crop.size[0]) / 2 + px_per_cell * f.get("dx", 0) / 100); y = round((TILE - crop.size[1]) / 2 + px_per_cell * f.get("dy", 0) / 100)
    tile.alpha_composite(crop, (x, y)) if (0 <= x and 0 <= y and x + crop.size[0] <= TILE and y + crop.size[1] <= TILE) else tile.paste(crop, (x, y), crop)
    tile.save(os.path.join(tdir, code.lower() + ".png"), optimize=True)
    print(f"{code}: silhouette {crop.size[0]}x{crop.size[1]} in {TILE} (size {f['size']}%, dx {f.get('dx',0)}, dy {f.get('dy',0)}, rot {f.get('rot',0)})")
# review sheets: the tiles at the real cell size on the real board
bd = ImageOps.fit(Image.open(BACKDROP).convert("RGB"), (880, 880), method=Image.LANCZOS)
codes = [m["code"] for m in models]; tiles = {c: Image.open(os.path.join(tdir, c.lower() + ".png")).convert("RGBA") for c in codes if os.path.exists(os.path.join(tdir, c.lower() + ".png"))}
ctx = Image.new("RGB", (880 + 24 + 330, 880 + 60), (28, 24, 34)); ctx.paste(bd, (12, 44)); sz = int(110 * cell_fill); off = (110 - sz) // 2
keys = list(tiles)
for k in range(64):
    r, c = divmod(k, 8); t = tiles[keys[(r + c) % len(keys)]].resize((sz, sz), Image.LANCZOS); ctx.paste(t, (12 + c * 110 + off, 44 + r * 110 + off), t)
for i, code in enumerate(keys[:3]):
    t = tiles[code].resize((sz * 2, sz * 2), Image.LANCZOS); zx = 12 + 880 + 24; ctx.paste(bd.crop((0, 0, 220, 220)), (zx, 44 + i * 230)); ctx.paste(t, (zx + off * 2, 44 + i * 230 + off * 2), t)
ctx.save(os.path.join(out, "_context.png"))
contact = Image.new("RGB", (16 + len(keys) * 264, 300), (28, 24, 34))
for i, code in enumerate(keys): bg = Image.new("RGBA", (256, 256), (40, 36, 44, 255)); bg.alpha_composite(tiles[code]); contact.paste(bg, (12 + i * 264, 22))
contact.save(os.path.join(out, "_contact.png")); print("sheets:", os.path.join(out, "_context.png"))
