# Red present recolor: scripted pixel work only (no AI, no web). Run with the math env's Python (PIL, numpy, scipy):
#   PY=/Users/corey/Projects/stake-engine/math-sdk/env/bin/python
#   $PY -I tools/present_recolor.py <candidate> <in.png|webp> <out.png|webp> [--spec <presentSpec.ts> --tier full|phone]
#                     [--webp q,aq] [--debug <classmap.png>]
#
# The owner's red present tool, copied into the app on 2026-11-28 from the round's
# scatter_present_red_r1_2026-11-17/tools/recolor.py (art-src/ keeps that copy) with only this header changed, so no
# build runs code from the art folder. tools/build_present.py imports it; tools/build_fast_lane_art.py runs it.
#
# How it works
#   1. CLASSES. Every pixel is given a part: BOX (the turquoise box, lid, step, inside, lid underside, with its white
#      stars), RIBBON (ribbon bands, bow loops, knot, tails) or NONE (the FS letters, anything unrecognised). Seeds are
#      pixels that sit right on the box's or the ribbon's painted tone ramp (params.json palette of the 3D build);
#      the seeds then grow through every pixel that is not black ink (geodesic: they never cross an outline), so a
#      star (no outline round it) belongs to the box, a ribbon highlight to the ribbon, and the letters (closed by
#      their thick black outline) stay NONE. Ink pixels take the class of the nearest coloured pixel (for their
#      anti-aliasing).
#   2. UNMIXING. A pixel of a class is explained as  alpha * (a point on its class's tone ramp) + (1 - alpha) * (a
#      neutral: ink, black, white, the stars' tones), or as a mix of two neutrals. The ramp point is replaced by the
#      candidate's ramp point at the same place, the neutral stays itself (or turns gold for gold stars), and whatever
#      the model did not explain (webp noise, paint texture) is kept as it was:  out = in + alpha * (new - old).
#      So edges stay anti-aliased against the ink and the stars exactly as painted, no teal can survive on a box
#      pixel, letters / stars / outlines are untouched, and ALPHA IS NEVER WRITTEN (copied byte for byte).
#   3. Sheets: with --spec/--tier only the frame pieces of the game's sheet are touched (the light's ray / star / glow
#      sprites are copied as they are).
import json, os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def hx(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


# ---- the source ramps (scatter_present_3d_r1_2026-11-15/blend/params.json "palette", sorted dark to light; each
#      part's cast-shadow tone = its darkest x 0.72, as tools/paintover.py adds) -----------------------------------
BOX_SRC = ["002629", "013539", "01454b", "014f55", "025b62", "035f66", "036b72", "047a80", "03858d", "02a7ad",
           "01d0d0", "52e1df", "c8f6f4"]
RIB_SRC = ["677789", "8fa5bf", "b0c1e1", "dde2f3", "fdfdfd", "ffffff"]     # ribbon bands, bow loops' outside
RIBIN_SRC = ["50818f", "6fb3c9", "a9bfe0", "c8d4ef"]                       # the bow loops' insides
# neutrals: ink line, the letters' black, white, the stars' three tones
NEU = ["0a0c0e", "030303", "fcfcfc", "c9d6e4", "e6edf3", "fbfbfb"]
STAR_IDX = [3, 4, 5]

# ---- the candidates: box ramp (one per BOX_SRC), ribbon ramps (None = keep the pale blue), gold stars -------------------
SUPER = ["2a040c", "3a0611", "4a0815", "560a19", "640b1d", "6a0c20", "7a0f24", "8a1229", "9a1530", "c4213a",
         "ec3b50", "ff6b7b", "ffc9cf"]
CRIMSON = ["1e030a", "2b040e", "360512", "3f0615", "4a0719", "4f081b", "5c0a20", "680c24", "740e28", "931530",
           "b51d35", "d63a4f", "f4b2bb"]
SILVER = (["6d737b", "98a0aa", "bac1ca", "e2e6ea", "fbfcfd", "ffffff"], ["5f666e", "8a939d", "b1b8c1", "d0d5db"])
GOLD = (["6b4a08", "a8740f", "d49a1c", "f2c53c", "ffe98c", "fff6cf"], ["5c3f06", "9c690c", "c98f1a", "e3b030"])
GREEN = (["0f3d1d", "17602c", "23803b", "3aa452", "8fdc98", "d9f7dc"], ["0c3318", "145425", "1f7535", "329447"])
GOLD_STARS = ["d99a1a", "f5c23a", "ffe27a"]

CANDIDATES = {
    "A": dict(box=SUPER, rib=None, stars=None, label="A  Super red box, pale blue ribbon kept"),
    "B": dict(box=SUPER, rib=SILVER, stars=None, label="B  Super red box, silver-white ribbon"),
    "C": dict(box=SUPER, rib=GOLD, stars=None, label="C  Super red box, gold ribbon"),
    "D": dict(box=CRIMSON, rib=GREEN, stars=None, label="D  deep crimson box, green ribbon"),
    "E": dict(box=SUPER, rib=GOLD, stars=GOLD_STARS, label="E  Super red box, gold ribbon, gold stars"),
}


def arr(lst):
    return np.array([hx(h) for h in lst], np.float32)


def densify(src, dst, n=12):
    """a polyline through the anchors, n samples per segment, with the matching target point for each sample"""
    S, D = [], []
    for i in range(len(src) - 1):
        for t in np.linspace(0, 1, n, endpoint=False):
            S.append(src[i] * (1 - t) + src[i + 1] * t); D.append(dst[i] * (1 - t) + dst[i + 1] * t)
    S.append(src[-1]); D.append(dst[-1])
    return np.array(S, np.float32), np.array(D, np.float32)


def curve_dist(px, S):
    """distance from each pixel to the nearest sample of a densified ramp"""
    out = np.full(len(px), 1e9, np.float32)
    for i in range(0, len(px), 20000):
        p = px[i:i + 20000]
        out[i:i + 20000] = np.sqrt(((p[:, None, :] - S[None]) ** 2).sum(-1)).min(1)
    return out


def unmix(px, S, D, N, ND):
    """out = px + alpha (D_s - S_s) + (1 - alpha) (ND_k - N_k) for the best (ramp sample s, neutral k, alpha); also pure
    ramp, pure neutral and neutral + neutral mixes (identity unless a neutral is remapped)."""
    out = px.copy()
    nn = len(N)
    pairs = [(a, b) for a in range(nn) for b in range(a + 1, nn)]
    for i in range(0, len(px), 4000):
        p = px[i:i + 4000]
        # ramp sample + neutral
        Cm = S[None, :, None, :]                    # 1 m 1 3
        Nk = N[None, None, :, :]                    # 1 1 k 3
        v = Cm - Nk
        w = p[:, None, None, :] - Nk
        a = np.clip((w * v).sum(-1) / np.maximum((v * v).sum(-1), 1e-6), 0, 1)   # n m k
        err = np.sqrt(((w - a[..., None] * v) ** 2).sum(-1))
        flat = err.reshape(len(p), -1)
        j = flat.argmin(1)
        best = flat[np.arange(len(p)), j]
        si, ki = np.unravel_index(j, err.shape[1:])
        al = a.reshape(len(p), -1)[np.arange(len(p)), j]
        delta = al[:, None] * (D[si] - S[si]) + (1 - al[:, None]) * (ND[ki] - N[ki])
        # neutral + neutral
        if pairs:
            A = np.array([N[x] for x, _ in pairs]); B = np.array([N[y] for _, y in pairs])
            dA = np.array([ND[x] - N[x] for x, _ in pairs]); dB = np.array([ND[y] - N[y] for _, y in pairs])
            v2 = A - B
            w2 = p[:, None, :] - B[None]
            a2 = np.clip((w2 * v2[None]).sum(-1) / np.maximum((v2 * v2).sum(-1), 1e-6), 0, 1)
            e2 = np.sqrt(((w2 - a2[..., None] * v2[None]) ** 2).sum(-1))
            j2 = e2.argmin(1); b2 = e2[np.arange(len(p)), j2]; a2b = a2[np.arange(len(p)), j2]
            d2 = a2b[:, None] * dA[j2] + (1 - a2b[:, None]) * dB[j2]
            use2 = b2 < best - 0.5
            delta[use2] = d2[use2]
        out[i:i + 4000] = p + delta
    return np.clip(out, 0, 255)


def mix_error(px, S, N):
    """distance from each pixel to the nearest mix of a ramp sample and a neutral"""
    out = np.empty(len(px), np.float32)
    v = S[:, None, :] - N[None, :, :]                       # m k 3
    vv = np.maximum((v * v).sum(-1), 1e-6)
    for i in range(0, len(px), 3000):
        p = px[i:i + 3000]
        w = p[:, None, None, :] - N[None, None, :, :]        # n 1 k 3
        a = np.clip((w * v[None]).sum(-1) / vv[None], 0, 1)  # n m k
        e = ((w - a[..., None] * v[None]) ** 2).sum(-1)
        out[i:i + 3000] = np.sqrt(e.reshape(len(p), -1).min(1))
    return out


def classify(rgb, alpha, region):
    """0 none, 1 box, 2 ribbon (see the header)"""
    h, w = alpha.shape
    vis = (alpha > 0) & region
    px = rgb[vis]
    BS = densify(arr(BOX_SRC), arr(BOX_SRC), 8)[0]
    RS = np.concatenate([densify(arr(RIB_SRC), arr(RIB_SRC), 8)[0], densify(arr(RIBIN_SRC), arr(RIBIN_SRC), 8)[0]])
    NS = arr(NEU)
    dB, dR, dN = curve_dist(px, BS), curve_dist(px, RS), curve_dist(px, NS)
    mx, mn = px.max(1), px.min(1)
    chroma = mx - mn
    # how well the pixel is explained as a box tone mixed with a neutral (a star's or an outline's anti-aliasing)
    eBN = mix_error(px, BS, NS)
    seedB = (dB < 14) & (dB < dR) & (dB < dN)
    seedR = (dR < 10) & (dR < dB) & (dR < dN - 3) & (chroma > 16) & (dR + 4 < eBN)
    ink = (mx < 80) & (chroma < 22)
    L = np.zeros((h, w), np.uint8)
    lb = np.zeros(len(px), np.uint8); lb[seedB] = 1; lb[seedR] = 2
    L[vis] = lb
    passable = np.zeros((h, w), bool); passable[vis] = ~ink
    # components: a component needs at least 1 % ribbon seeds (and >= 4 px) to keep any; drops stray specks
    comp, nc = ndi.label(passable, structure=np.ones((3, 3)))
    if nc:
        idx = np.arange(1, nc + 1)
        size = ndi.sum(np.ones_like(comp), comp, idx)
        nR = ndi.sum(L == 2, comp, idx); nB = ndi.sum(L == 1, comp, idx)
        weakR = (nR < np.maximum(4, 0.01 * size))
        weakB = (nB < np.maximum(4, 0.01 * size))
        drop = np.zeros(nc + 1, bool)
        dropR = np.zeros(nc + 1, bool); dropR[1:] = weakR
        dropB = np.zeros(nc + 1, bool); dropB[1:] = weakB
        L[(L == 2) & dropR[comp]] = 0
        L[(L == 1) & dropB[comp]] = 0
    # geodesic growth through non-ink pixels
    cross = ndi.generate_binary_structure(2, 1)
    for _ in range(2000):
        un = passable & (L == 0)
        gB = ndi.binary_dilation(L == 1, cross) & un
        gR = ndi.binary_dilation(L == 2, cross) & un & ~gB
        if not gB.any() and not gR.any():
            break
        L[gB] = 1; L[gR] = 2
    # ink (and anything left) takes the nearest coloured pixel's class, within 4 px
    lab = L > 0
    if lab.any():
        d, (iy, ix) = ndi.distance_transform_edt(~lab, return_indices=True)
        fill = vis & ~lab & (d <= 4)
        L[fill] = L[iy[fill], ix[fill]]
    # coloured pixels still unclassed (a pocket of box paint shut in by outlines, too small for a seed): by their tone
    left = np.zeros((h, w), bool)
    left[vis] = (chroma > 20) & (dB < dR) & (dB < 60)
    L[left & (L == 0)] = 1
    left[vis] = (chroma > 20) & (dR < dB) & (dR < 25) & (dR + 4 < eBN)
    L[left & (L == 0)] = 2
    L[~vis] = 0
    return L


def recolor(cand, rgba, region=None):
    rgb = rgba[..., :3].astype(np.float32)
    alpha = rgba[..., 3]
    if region is None:
        region = np.ones(alpha.shape, bool)
    L = classify(rgb, alpha, region)
    out = rgb.copy()
    c = CANDIDATES[cand]
    N = arr(NEU)
    # box
    S, D = densify(arr(BOX_SRC), arr(c["box"]))
    m = L == 1
    if c["stars"]:
        # every white in the box's class is a star (the letters are closed by their outline and stay NONE)
        ND = N.copy(); ND[STAR_IDX] = arr(c["stars"]); ND[2] = arr(c["stars"])[2]
        out[m] = unmix(rgb[m], S, D, N, ND)
    else:
        out[m] = unmix(rgb[m], S, D, N, N)
    # ribbon
    if c["rib"]:
        S1, D1 = densify(arr(RIB_SRC), arr(c["rib"][0]))
        S2, D2 = densify(arr(RIBIN_SRC), arr(c["rib"][1]))
        S, D = np.concatenate([S1, S2]), np.concatenate([D1, D2])
        Ni = arr(NEU[:2])
        m = L == 2
        out[m] = unmix(rgb[m], S, D, Ni, Ni)
    res = rgba.copy()
    res[..., :3] = np.round(out).clip(0, 255).astype(np.uint8)
    res[..., 3] = alpha  # never touched
    return res, L


def spec_region(spec_path, tier, shape, sheet_file):
    """only the frame pieces of this sheet (not the light's sprites)"""
    s = open(spec_path).read()
    s = s[s.index("{"):s.rindex("}") + 1]
    spec = json.loads(s)
    t = spec["tiers"][tier]
    base = os.path.basename(sheet_file).replace("-red", "")
    reg = np.zeros(shape, bool)
    if base == os.path.basename(t["still"]["file"]):
        reg[:] = True
        return reg
    sheets = [os.path.basename(x["file"]) for x in t["sheets"]]
    if base not in sheets:
        raise SystemExit(f"{base} not in the spec's {tier} sheets")
    k = sheets.index(base)
    for name, p in t["pieces"].items():
        if p["sheet"] != k or name in ("ray", "star", "glow"):
            continue
        reg[p["y"]:p["y"] + p["h"], p["x"]:p["x"] + p["w"]] = True
    return reg


def main():
    a = sys.argv[1:]
    opt = {}
    pos = []
    i = 0
    while i < len(a):
        if a[i].startswith("--"):
            opt[a[i][2:]] = a[i + 1]; i += 2
        else:
            pos.append(a[i]); i += 1
    cand, src, dst = pos
    rgba = np.asarray(Image.open(src).convert("RGBA")).copy()
    region = None
    if "spec" in opt:
        region = spec_region(opt["spec"], opt["tier"], rgba.shape[:2], src)
    res, L = recolor(cand, rgba, region)
    im = Image.fromarray(res, "RGBA")
    if dst.endswith(".webp"):
        q, aq = (opt.get("webp", "92,100")).split(",")
        im.save(dst, quality=int(q), alpha_quality=int(aq), method=6)
        back = np.asarray(Image.open(dst).convert("RGBA"))
        if not np.array_equal(back[..., 3], rgba[..., 3]):
            print(f"WARNING alpha differs after webp encode: {np.abs(back[..., 3].astype(int) - rgba[..., 3]).max()}")
    else:
        im.save(dst)
    if "debug" in opt:
        col = np.array([[0, 0, 0, 0], [255, 60, 60, 255], [60, 120, 255, 255]], np.uint8)
        dbg = col[L]
        dbg[(L == 0) & (rgba[..., 3] > 0)] = [200, 200, 200, 255]
        Image.fromarray(dbg, "RGBA").save(opt["debug"])
    vis = rgba[..., 3] > 0
    print(f"{cand} {os.path.basename(src)} -> {os.path.basename(dst)}  box {int((L == 1).sum())} px, ribbon {int((L == 2).sum())} px, untouched {int((vis & (L == 0)).sum())} px")


if __name__ == "__main__":
    main()
