"""usage: python -I tools/build_plaque_numerals.py
The plaque's glyph atlas: Cinzel Bold in the N1 paint (inlaid brass: one muted gold, a narrow tone range, a hairline
light edge upper left, a hairline dark edge lower right; no outline, no drop shadow), plus the marks the game's Cinzel
subset lacks, in the same paint. Metrics and atlas json in the formats of static/assets/ui/numerals (glyphs.json,
numerals.json) so game/numeralLayout.ts can lay it out with a second glyph table."""
import sys, os, json, math, numpy as np
sys.dont_write_bytecode = True
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
# 1.0.04 (plaque rework, images/plaque_r6_storyboard): run from the game's tools/, writing straight into the game. The
# fonts and the source notes stay in the plaque spec's work folder (images/spin_amount_final/work), untouched.
HERE = os.path.expanduser("~/Desktop/Manticore Mayhem/images/spin_amount_final/work")
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(APP, "static", "assets", "ui", "plaque-numerals"); os.makedirs(OUT, exist_ok=True)
TMP = "/tmp/plaque_numerals_build"; os.makedirs(TMP, exist_ok=True)
TOOLS = "/Users/corey/Projects/stake-engine/web-sdk/apps/manticore_mayhem/tools/fonts/"
CINZEL = os.path.join(HERE, "Cinzel-Bold.ttf")          # the game's own Cinzel-Bold.woff2 (220 glyph subset) converted with fontTools in round 1
NOTO = TOOLS + "NotoSerif[wdth,wght].ttf"; RAKKAS = TOOLS + "Rakkas-Regular.ttf"
SS = 4; H_FULL = 64                                       # digit ink height in the full atlas, px; drawn SS times larger
CAP = H_FULL * SS; EM = CAP / 0.714
GRAD = [(214, 170, 96), (204, 158, 84), (190, 142, 70)]; LIGHT = (246, 224, 172); DARK = (26, 14, 6); HAIR = 0.022 * CAP
# glyph key (game/numeralTokens.ts names) -> character
# every capital (an operator currency outside the table shows its CODE), the six small letters the table uses (Rp, zl, kr, Bs, KSh, TSh, USh), the digits
LET = {c: c for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZhkprsz0123456789"}
NAMED = {"period": ".", "comma": ",", "slash": "/", "dollar": "$", "euro": "€", "pound": "£", "yen": "¥", "rupee": "₹", "ruble": "₽", "peso": "₱", "won": "₩", "dong": "₫",
         "lira": "₺", "naira": "₦", "colonSign": "₡", "rupeeSign": "₨", "cedi": "₵", "lstroke": "ł", "jeem": "ج", "meem": "م",
         # 1.0.04: the cluster rows' "8 × [icon] 2.40" (game/numeralTokens.ts names it multx); Cinzel Bold has U+00D7
         "multx": "×"}
GLYPHS = {**LET, **NAMED}
cz = ImageFont.truetype(CINZEL, int(round(EM)))
from fontTools.ttLib import TTFont
CZ_CMAP = set(TTFont(CINZEL).getBestCmap())
def stem(font, ch="H"):
    """the width of the left stem of H at mid height, px"""
    b = font.getbbox(ch); im = Image.new("L", (b[2] + 20, b[3] + 20), 0); ImageDraw.Draw(im).text((10, 10), ch, font=font, fill=255)
    r = np.asarray(im)[10 + b[1] + (b[3] - b[1]) * 3 // 10]; xs = np.where(r > 128)[0]; run = xs[: np.argmax(np.diff(xs) > 1) + 1] if (np.diff(xs) > 1).any() else xs; return len(run)
capH = cz.getbbox("H")[3] - cz.getbbox("H")[1]; target = stem(cz)
best = None
for w in range(400, 901, 20):
    f = ImageFont.truetype(NOTO, 400); f.set_variation_by_axes([w, 100]); size = int(round(400 * capH / (f.getbbox("H")[3] - f.getbbox("H")[1])))
    f = ImageFont.truetype(NOTO, size); f.set_variation_by_axes([w, 100]); s = stem(f)
    if best is None or abs(s - target) < abs(best[0] - target): best = (s, w, size)
NOTO_W, NOTO_SIZE = best[1], best[2]; nt = ImageFont.truetype(NOTO, NOTO_SIZE); nt.set_variation_by_axes([NOTO_W, 100])
# Rakkas for the two Arabic letters of the Egyptian pound: sized so the jeem is 1.05 figure heights tall, and both raised by the same
# amount so the jeem's tail ends 0.16 of a figure height under the baseline (the stencil atlas sets its Arabic pair the same way)
_r = ImageFont.truetype(RAKKAS, 1000); _b = _r.getbbox("ج", anchor="ls"); RK_SIZE = int(round(1000 * 1.05 * CAP / (_b[3] - _b[1])))
rk = ImageFont.truetype(RAKKAS, RK_SIZE); RK_LIFT = rk.getbbox("ج", anchor="ls")[3] - 0.16 * CAP
print(f"Cinzel Bold stem {target} px at cap {capH}; Noto Serif weight {NOTO_W} gives {best[0]} px at size {NOTO_SIZE}")
SOURCE = {}
def mask_of(key):
    ch = GLYPHS[key]; pad = int(CAP * 0.6); W, Hh = int(CAP * 2.4), int(CAP * 2.6); by = pad + CAP + int(CAP * 0.3)
    m = Image.new("L", (W, Hh), 0); d = ImageDraw.Draw(m)
    if key == "lstroke":       # the l of Cinzel (a small capital L) with a stroke drawn through its stem: no foreign face needed
        d.text((pad, by), "l", font=cz, fill=255, anchor="ls"); b = cz.getbbox("l", anchor="ls"); x0, x1 = pad + b[0], pad + b[2]; top, bot = by + b[1], by + b[3]
        sx = x0 + target / 2 + 0.06 * CAP * 0.0; ym = (top + bot) / 2 - 0.02 * CAP; t = 0.058 * CAP; dx = 0.16 * CAP; dyy = 0.085 * CAP; sx = x0 + target * 0.62
        d.polygon([(sx - dx, ym + dyy + t / 2), (sx + dx, ym - dyy + t / 2), (sx + dx, ym - dyy - t / 2), (sx - dx, ym + dyy - t / 2)], fill=255); SOURCE[key] = "Cinzel l + a drawn stroke"
    elif ord(ch) in CZ_CMAP: d.text((pad, by), ch, font=cz, fill=255, anchor="ls"); SOURCE[key] = "Cinzel Bold"
    elif key in ("jeem", "meem"): d.text((pad, by - RK_LIFT), ch, font=rk, fill=255, anchor="ls"); SOURCE[key] = "Rakkas"
    else: d.text((pad, by), ch, font=nt, fill=255, anchor="ls"); SOURCE[key] = f"Noto Serif {NOTO_W}"
    return np.asarray(m).astype(np.float32) / 255, by
def sh(m, dx, dy): return ndi.shift(m, (dy, dx), order=1, mode="constant")
def paint(ink, by):
    h, w = ink.shape; yy = np.clip((np.arange(h) - (by - CAP)) / CAP, 0, 1)[:, None]; g = np.array(GRAD, np.float32)
    col = np.where(yy < 0.5, g[0] + (g[1] - g[0]) * (yy / 0.5), g[1] + (g[2] - g[1]) * ((yy - 0.5) / 0.5))[:, None, :] * np.ones((1, w, 1), np.float32)
    rgb = np.zeros((h, w, 3), np.float32); a = np.zeros((h, w), np.float32)
    for mask, c in ((np.clip(sh(ink, HAIR, HAIR) - ink, 0, 1) * 0.9, DARK), (ink, col), (np.clip(ink - sh(ink, HAIR, HAIR), 0, 1) * 0.75, LIGHT)):
        c = np.asarray(c, np.float32); na = mask + a * (1 - mask)
        rgb = np.where(na[..., None] > 1e-4, (c * mask[..., None] + rgb * (a * (1 - mask))[..., None]) / np.maximum(na[..., None], 1e-4), 0); a = na
    return np.dstack([rgb, a * 255])
frames = {}; metrics = {}
for key in GLYPHS:
    ink, by = mask_of(key); arr = paint(ink, by); al = arr[..., 3]; ys, xs = np.where(al > 6)
    x0, x1, y0, y1 = xs.min() // SS * SS - SS, (xs.max() // SS + 2) * SS, ys.min() // SS * SS - SS, (ys.max() // SS + 2) * SS
    pm = arr[y0:y1, x0:x1].copy(); pm[..., :3] *= pm[..., 3:] / 255
    small = np.dstack([np.asarray(Image.fromarray(np.ascontiguousarray(pm[..., c]), "F").resize(((x1 - x0) // SS, (y1 - y0) // SS), Image.LANCZOS)) for c in range(4)])
    a2 = np.clip(small[..., 3:], 0, 255); rgb = np.where(a2 > 0.5, small[..., :3] / np.maximum(a2 / 255, 1e-3), 0)
    frames[key] = Image.fromarray(np.clip(np.dstack([rgb, a2]) + 0.5, 0, 255).astype(np.uint8), "RGBA"); metrics[key] = dict(w=(x1 - x0) / SS, h=(y1 - y0) / SS, bottom=(y1 - by) / SS)
D0 = metrics["0"]; DIGIT_H = D0["h"]
G = {k: dict(w=round(m["w"], 1), h=round(m["h"], 1), d=round(m["bottom"] - D0["bottom"], 1)) for k, m in metrics.items()}
def pack(scale, name):
    keys = sorted(frames, key=lambda k: -frames[k].size[1]); Wd = 1024 if scale == 1 else 512; x = y = 1; rowh = 0; pos = {}; ims = {}
    for k in keys:
        im = frames[k] if scale == 1 else frames[k].resize((max(1, math.ceil(frames[k].size[0] / 2)), max(1, math.ceil(frames[k].size[1] / 2))), Image.LANCZOS); ims[k] = im
        if x + im.size[0] + 1 > Wd: x = 1; y += rowh + 2; rowh = 0
        pos[k] = (x, y); x += im.size[0] + 2; rowh = max(rowh, im.size[1])
    Ht = y + rowh + 1; Ht += (-Ht) % 4; sheet = Image.new("RGBA", (Wd, Ht), (0, 0, 0, 0)); fr = {}
    for k in keys:
        sheet.paste(ims[k], pos[k]); w, h = ims[k].size
        fr[f"plq_{k}.png"] = {"frame": {"x": pos[k][0], "y": pos[k][1], "w": w, "h": h}, "rotated": False, "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h}, "sourceSize": {"w": w, "h": h}}
    p = os.path.join(OUT, name + ".webp"); sheet.save(p, "WEBP", quality=85, method=6, alpha_quality=100); sheet.save(os.path.join(TMP, name + "_lossless.png"))
    json.dump({"frames": fr, "meta": {"app": "manticore-plaque-numerals", "image": name + ".webp", "format": "RGBA8888", "size": {"w": Wd, "h": Ht}, "scale": "1" if scale == 1 else "0.5"}}, open(os.path.join(OUT, name + ".json"), "w"), indent=1)
    print(name, sheet.size, os.path.getsize(p), "bytes, GPU", Wd * Ht * 4, "(+1/3 with mipmaps)")
pack(1, "plaque-numerals"); pack(2, "plaque-numerals-half")
json.dump(G, open(os.path.join(TMP, "glyphs.json"), "w"), indent=1)  # the game reads plaqueNumeralGlyphs.ts, not this
ts = ["// GENERATED by tools/build_plaque_numerals.py (spin_amount_final/work/build_atlas.py plus the cluster rows' x, 1.0.04): Cinzel Bold in the plaque's inlaid brass paint (N1).", "// Same shape as game/numeralGlyphs.ts: display units = full atlas px; `d` = frame bottom below the digit 0 frame bottom.",
      f"export const PLAQUE_DIGIT_H = {DIGIT_H};", "export const PLAQUE_GLYPH_PREFIX = 'plq_';", "export const PLAQUE_GLYPHS: Record<string, { w: number; h: number; d: number }> = {"]
ts += [f"\t'{k}': {{ w: {v['w']}, h: {v['h']}, d: {v['d']} }}," for k, v in sorted(G.items())] + ["};", ""]
open(os.path.join(APP, "src", "game", "plaqueNumeralGlyphs.ts"), "w").write("\n".join(ts))
json.dump({"digitH": DIGIT_H, "capInkPx": H_FULL, "zeroBottom": metrics["1"]["bottom"] + (D0["bottom"] - metrics["1"]["bottom"]) * 0 , "flatDigitBottom": metrics["1"]["bottom"], "zeroFrameBottom": D0["bottom"], "source": SOURCE, "notoWeight": NOTO_W}, open(os.path.join(TMP, "atlas_info.json"), "w"), indent=1)
dc = max(G[d]["w"] for d in "0123456789"); sc = max(G["comma"]["w"], G["period"]["w"])
print("DIGIT_H", DIGIT_H, "digit cell", dc, "sep cell", sc, "dollar", G["dollar"])
for gap in (0.0, 0.02, 0.03, 0.05): print("gap", gap, "longest USD width / digit H =", round((G["dollar"]["w"] + 9 * dc + 3 * sc + 12 * gap * DIGIT_H) / DIGIT_H, 3), " per ink cap:", round((G["dollar"]["w"] + 9 * dc + 3 * sc + 12 * gap * DIGIT_H) / H_FULL, 3))
print({k: v for k, v in SOURCE.items() if v != "Cinzel Bold"})
