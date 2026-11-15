"""GAME BUILD (2026-11-14, copied from the mockup's tex2.py): the live text is left out (the game draws it), the TOTAL WIN
layout is rebalanced (cfg_game TOTAL_ROWS), any tier has a TOTAL WIN cloth.
Round 2 cloth textures (flat, in material space, design px; adapted from round 1's tex.py):
  <name>_color.png RGBA sRGB, alpha = the outline (the flame-cut V hem is cut by it)
  <name>_height.png 16 bit, for the bump; <name>_mask.png R gold thread, G lettering, B glow
python tex2.py <D|P> <fs|super|epic> <intro|total_short|total_long|blank> [out_dir]
D: desktop / tablet text sizes. P: portrait and landscape phones (the banner is drawn at about 0.55 of the design), so
its text is set in phone CSS px and divided by that scale."""
import sys, os, math, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
from scipy.spatial import cKDTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cfg_game import *

TEXPX = {"D": 3.5, "P": 2.2}
PS = 0.535          # the P banner's scale on the portrait phone (CSS px per design px)


def font(path, px):
    return ImageFont.truetype(path, max(1, int(round(px))))


def wrap(text, f, maxw):
    if f.getlength(text) <= maxw: return [text]
    words = text.split(); best = None
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        m = max(f.getlength(a), f.getlength(b))
        if best is None or m < best[0]: best = (m, [a, b])
    return best[1]


def fit(face, px, text, maxw):
    f = font(face, px); w = f.getlength(text)
    return px if w <= maxw else px * maxw / w


def layout(var, tier, content):
    """rows: dict(text, face, px, cy (cap centre, material v), kind); design px. GAME BUILD: the spin count (the intro's
    hero row) keeps its laurels but its digits are drawn live; TOTAL WIN keeps its title and wreath, the amount and the
    IN n ... line are live (cfg_game.LIVE)."""
    T = TIERS[tier]
    inner = W - 2 * (BORDER + 22)
    rows = []
    R0 = V_REST
    if var == "D":
        if content == "intro":
            rows.append(dict(text=str(T["spins"]), face=CINZEL, px=150, cy=R0 + 112, kind="hero", live=True))
            rows.append(dict(text=T["name"], face=CINZEL, px=fit(CINZEL, 50, T["name"], inner), cy=R0 + 218, kind="title"))
            rf = font(CINZEL, 25); v = R0 + 254
            for line in RULES[tier]:
                for sub in wrap(line, rf, 500):
                    rows.append(dict(text=sub, face=CINZEL, px=25, cy=v, kind="rule")); v += 28
                v += 9
        elif content == "total":
            rows.append(dict(text="TOTAL WIN", face=CINZEL, px=60, cy=TOTAL_ROWS["D"]["title"], kind="title"))
            rows.append(dict(text="", face=CINZEL, px=118, cy=TOTAL_ROWS["D"]["laurel"], kind="laurel"))
    else:
        k = 1 / PS   # design px per phone CSS px
        inner_c = inner * PS
        if content == "intro":
            rows.append(dict(text=str(T["spins"]), face=CINZEL, px=78 * k, cy=R0 + 56 * k, kind="hero", live=True))
            rows.append(dict(text=T["name"], face=CINZEL, px=fit(CINZEL, 27, T["name"], inner_c) * k, cy=R0 + 108 * k, kind="title"))
            rf = font(CINZEL, 14.5); v = R0 + 132 * k
            for line in RULES[tier]:
                # GAME BUILD: the phone rules wrap at 80 % of the inner width (a full width last line ran into the chevron)
                for sub in wrap(line, rf, (inner_c - 4) * 0.8):
                    rows.append(dict(text=sub, face=CINZEL, px=14.5 * k, cy=v, kind="rule")); v += 16.5 * k
                v += 4 * k
        elif content == "total":
            rows.append(dict(text="TOTAL WIN", face=CINZEL, px=34 * k, cy=TOTAL_ROWS["P"]["title"], kind="title"))
            rows.append(dict(text="", face=CINZEL, px=64 * k, cy=TOTAL_ROWS["P"]["laurel"], kind="laurel"))
    for r in rows:
        toks = [t.strip(",.").lower() for t in r["text"].split()]
        for w in FORBIDDEN:
            assert w not in toks, (w, r["text"])
        assert "\u2014" not in r["text"]
    return rows


def cap_offset(face, px):
    f = font(face, px)
    b = f.getbbox("H" if face == CINZEL else "8")
    return (b[1] + b[3]) / 2


def leaf(cx, cy, ang, Ln, Wd):
    pts = []
    for i in range(25):
        t = i / 24; x = (t - 0.5) * Ln; w = Wd * 0.5 * math.sin(math.pi * t) ** 0.8 * (1 - 0.25 * t); pts.append((x, w))
    for i in range(24, -1, -1):
        t = i / 24; x = (t - 0.5) * Ln; w = Wd * 0.5 * math.sin(math.pi * t) ** 0.8 * (1 - 0.25 * t); pts.append((x, -w))
    c, s = math.cos(ang), math.sin(ang)
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in pts]


def laurel(draw_fill, draw_edge, cx, cy, R, side, S, n=8, Rx=None):
    p0, p1 = math.radians(-46), math.radians(50)
    Rx = Rx or R
    P = [(cx + side * Rx * math.cos(p0 + (p1 - p0) * i / n), cy - R * math.sin(p0 + (p1 - p0) * i / n)) for i in range(n + 1)]
    draw_edge.line(P, fill=255, width=max(2, int(S * 0.07)), joint="curve")
    for i in range(1, n + 1):
        (x0, y0), (x1, y1) = P[i - 1], P[i]
        ang = math.atan2(y1 - y0, x1 - x0); size = S * (1.0 - 0.35 * i / n)
        for kk in (-1, 1):
            la = ang + kk * math.radians(42)
            draw_fill.polygon(leaf(x1 + math.cos(la) * size * 0.45, y1 + math.sin(la) * size * 0.45, la, size, size * 0.36), fill=255)
    (x0, y0), (x1, y1) = P[-2], P[-1]
    ang = math.atan2(y1 - y0, x1 - x0); size = S * 0.7
    draw_fill.polygon(leaf(x1 + math.cos(ang) * size * 0.45, y1 + math.sin(ang) * size * 0.45, ang, size, size * 0.34), fill=255)


def build(var, tier, content, out_dir):
    T = TIERS[tier]
    s = TEXPX[var]
    tw, th = int(round(W * s)), int(round((L + 2) * s))
    poly = [(x * s, y * s) for x, y in outline()]
    ss = 4
    am = Image.new("L", (tw * ss, th * ss), 0)
    ImageDraw.Draw(am).polygon([(x * ss, y * ss) for x, y in poly], fill=255)
    alpha = np.asarray(am.resize((tw, th), Image.LANCZOS)).astype(np.float32) / 255
    inside = alpha > 0.5
    yy, xx = np.mgrid[0:th, 0:tw].astype(np.float32)
    # distance to the sides and the hem (the top edge is on the core: not an edge)
    pad = np.pad(inside, ((1, 1), (1, 1)), constant_values=False); pad[0, :] = pad[1, :]
    dist_side = ndimage.distance_transform_edt(pad)[1:-1, 1:-1].astype(np.float32)
    hem_zone = np.clip((yy / s - (V_SIDE - 30)) / 30, 0, 1)
    dist_side = dist_side * (1 - hem_zone * (1 - BORDER / HEM_BORDER))
    rng = np.random.default_rng(7 + {"D": 1, "P": 2}[var])

    def blur_noise(sigma, amp):
        n = rng.standard_normal((th, tw)).astype(np.float32)
        n = ndimage.gaussian_filter(n, sigma)
        return n / (n.std() + 1e-6) * amp

    cl = np.array(T["cloth"], np.float32) / 255; clo = np.array(T["cloth_lo"], np.float32) / 255
    mott = blur_noise(40 * s / 3.5, 0.5) + blur_noise(9 * s / 3.5, 0.35)
    tmix = np.clip(0.18 + 0.12 * mott, 0, 1)
    edge_dark = np.clip(1 - (dist_side - BORDER * s) / (34 * s), 0, 1) ** 1.5 * 0.45
    tmix = np.clip(tmix + edge_dark, 0, 1)
    col = cl[None, None, :] * (1 - tmix[..., None]) + clo[None, None, :] * tmix[..., None]
    height = 0.04 * blur_noise(1.0, 1.0) + 0.03 * blur_noise(3.0, 1.0)
    metal = np.zeros((th, tw), np.float32); glow = np.zeros((th, tw), np.float32)
    tr = np.array(T["trim"], np.float32) / 255; trd = np.array(T["trim_dk"], np.float32) / 255
    sat = 0.5 + 0.5 * np.sin((xx + yy) * (2 * math.pi / (2.2 * s)))

    # ---- side and hem border
    bw = BORDER * s
    band = (dist_side < bw) & inside
    bandf = ndimage.gaussian_filter(band.astype(np.float32), 0.6)
    edge_in = np.where(dist_side < bw, bw - dist_side, 1e9)
    rim = np.clip(dist_side / (2.0 * s), 0, 1) * np.clip(edge_in / (2.0 * s), 0, 1)
    gshade = 0.62 + 0.38 * rim * (0.75 + 0.25 * sat)
    goldc = trd[None, None] + (tr - trd)[None, None] * gshade[..., None]
    col = col * (1 - bandf[..., None]) + goldc * bandf[..., None]
    height += bandf * (0.55 + 0.25 * rim + 0.08 * sat)
    metal = np.maximum(metal, bandf)
    if T["glow"] > 0: glow = np.maximum(glow, bandf * (0.35 + 0.65 * rim))
    st = np.array(T["stitch"], np.float32) / 255
    stl = np.clip(1 - (np.abs(dist_side - bw * 0.5) - 0.55 * s) / (0.6 * s), 0, 1) * band
    stc = st if T["glow"] == 0 else np.array(T["outline"], np.float32) / 255
    col = col * (1 - 0.75 * stl[..., None]) + stc[None, None] * 0.75 * stl[..., None]
    height -= stl * 0.25

    # ---- the header band (just under the roll at rest) and the V chevron above the hem: gold, embroidered
    def straight_band(dist, hw):
        b = (np.abs(dist) < hw * s) & inside & (dist_side >= bw - 0.5 * s)
        bf = ndimage.gaussian_filter(b.astype(np.float32), 0.6)
        r = np.clip((hw * s - np.abs(dist)) / (1.6 * s), 0, 1)
        g = 0.62 + 0.38 * r * (0.75 + 0.25 * sat)
        return b, bf, g

    def paint_band(bf, g, h=0.55, gl=0.7):
        nonlocal col, height, metal, glow
        c_ = trd[None, None] + (tr - trd)[None, None] * g[..., None]
        col = col * (1 - bf[..., None]) + c_ * bf[..., None]
        height = height + bf * h; metal = np.maximum(metal, bf)
        if T["glow"] > 0: glow = np.maximum(glow, bf * gl)
    hdr_v = V_REST + 14.0
    for dv_, hw_ in ((hdr_v, 4.2), (hdr_v + 9.5, 1.3)):
        b, bf, g = straight_band(yy - dv_ * s, hw_); paint_band(bf, g)
    CHEV = 34.0
    u_ = xx / s
    vb = (V_CENTER + (V_SIDE - V_CENTER) * np.abs(u_ - W / 2) / (W / 2)) - CHEV
    slope = (V_CENTER - V_SIDE) / (W / 2)
    dperp = (yy / s - vb) / math.sqrt(1 + slope ** 2) * s
    for off, hw_ in ((0.0, 3.6), (-8.5, 1.1), (8.5, 1.1)):
        b, bf, g = straight_band(dperp - off * s, hw_); paint_band(bf, g, 0.5)

    # ---- running stitch (dashes) inside the side / hem border, phase = the outline's arc length
    P_ = np.array(poly + [poly[0]], np.float64); seg = np.diff(P_, axis=0); L_ = np.hypot(seg[:, 0], seg[:, 1])
    dense, arc, acc = [], [], 0.0
    for (p, sg, l) in zip(P_[:-1], seg, L_):
        if p[1] < 1.0 and (p + sg)[1] < 1.0: acc += l; continue      # the top edge is on the core
        nn = max(2, int(l / 1.0))
        for j in range(nn):
            dense.append(p + sg * j / nn); arc.append(acc + l * j / nn)
        acc += l
    tree = cKDTree(np.array(dense))
    run_d = np.abs(dist_side - (bw + 5 * s))
    near = (dist_side < bw + 9 * s) & inside & (yy > (V_REST + 30) * s)
    # not across the notches: there the stitch's offset curve rounds into arcs that run into the chevron
    hb_px = (V_CENTER + (V_SIDE - V_CENTER) * np.abs(xx / s - W / 2) / (W / 2))
    near &= ~((yy / s > hb_px - 34.0 - 14.0) & (yy / s < hb_px + 3.0))
    _, idx = tree.query(np.stack([xx[near], yy[near]], -1))
    phase = np.zeros((th, tw), np.float32); phase[near] = np.array(arc)[idx]
    dash = (np.sin(phase * (2 * math.pi / (7 * s))) > -0.1).astype(np.float32)
    run = np.clip(1 - (run_d - 0.5 * s) / (0.6 * s), 0, 1) * dash * near * (~band)
    # drop clipped dash fragments (smaller than half a dash): no stray specks where the stitch stops
    lab, nl = ndimage.label(run > 0.3)
    if nl:
        area = ndimage.sum(np.ones_like(run), lab, index=np.arange(1, nl + 1))
        small = np.isin(lab, np.nonzero(area < 0.5 * np.median(area))[0] + 1)
        run = np.where(ndimage.binary_dilation(small, iterations=2), 0.0, run)
    col = col * (1 - 0.8 * run[..., None]) + tr[None, None] * 0.8 * run[..., None]
    height += run * 0.25; metal = np.maximum(metal, run * 0.8)
    if T["glow"] > 0: glow = np.maximum(glow, run * 0.5)

    # ---- lettering and laurel at 2x then reduced
    k2 = 2
    big = (tw * k2, th * k2)
    fill_m = Image.new("L", big, 0); edge_m = Image.new("L", big, 0); shadow_m = Image.new("L", big, 0)
    lau_f = Image.new("L", big, 0); lau_e = Image.new("L", big, 0)
    df, de, ds = ImageDraw.Draw(fill_m), ImageDraw.Draw(edge_m), ImageDraw.Draw(shadow_m)
    rows = layout(var, tier, content) if content != "blank" else []
    rows_out = rows
    grad_rows = []
    for r in rows:
        if r["kind"] == "laurel":
            # an ornament without a number: the two half wreaths, closed at the bottom, under the sub line
            S = r["px"] * s * k2; capc = r["cy"] * s * k2
            for side in (-1, 1):
                laurel(ImageDraw.Draw(lau_f), ImageDraw.Draw(lau_e), W * s * k2 / 2 - side * S * 0.14, capc, S * 0.40, side, S * 0.15, Rx=S * 0.42)
            continue
        px = r["px"] * s * k2
        f = font(r["face"], px)
        wpx = f.getlength(r["text"])
        if r.get("live"):
            # GAME BUILD: the digits are the game's (live quads); the wreath is sized for them as in the mockup
            S = r["px"] * s * k2; capc = r["cy"] * s * k2
            for side in (-1, 1):
                laurel(ImageDraw.Draw(lau_f), ImageDraw.Draw(lau_e), W * s * k2 / 2, capc + S * 0.02, S * 0.55, side, S * 0.17,
                       Rx=max(S * 0.6, wpx / 2 + S * 0.3))
            continue
        x = W * s * k2 / 2 - wpx / 2
        y = r["cy"] * s * k2 - cap_offset(r["face"], px)
        sw = {"hero": 0.05, "title": 0.065, "amount": 0.05, "sub": 0.07, "rule": 0.075}[r["kind"]]
        swp = max(1, int(round(px * sw)))
        de.text((x, y), r["text"], font=f, fill=255, stroke_width=swp, stroke_fill=255)
        df.text((x, y), r["text"], font=f, fill=255)
        ds.text((x + px * 0.02, y + px * 0.035), r["text"], font=f, fill=255, stroke_width=swp, stroke_fill=255)
        b = f.getbbox(r["text"])
        grad_rows.append((y + b[1], y + b[3]))
        if r["kind"] == "hero":
            S = r["px"] * s * k2; capc = r["cy"] * s * k2
            for side in (-1, 1):
                laurel(ImageDraw.Draw(lau_f), ImageDraw.Draw(lau_e), W * s * k2 / 2, capc + S * 0.02, S * 0.55, side, S * 0.17,
                       Rx=max(S * 0.6, wpx / 2 + S * 0.3))

    def red(im):
        return np.asarray(im.resize((tw, th), Image.LANCZOS)).astype(np.float32) / 255
    fm, em, sm = red(fill_m), red(edge_m), red(shadow_m)
    lf, le = red(lau_f), red(lau_e)
    lau_all = np.maximum(lf, le)
    lau_out = np.clip(ndimage.maximum_filter(lau_all, size=3) - lau_all, 0, 1)
    ldk = np.array(T["laurel_dk"], np.float32) / 255; lg = np.array(T["laurel"], np.float32) / 255
    lshade = 0.55 + 0.45 * np.clip(ndimage.gaussian_filter(lau_all, 2.0 * s) * 1.4, 0, 1)
    lcol = ldk[None, None] + (lg - ldk)[None, None] * lshade[..., None]
    col = col * (1 - lau_out[..., None] * 0.85) + ldk[None, None] * 0.35 * lau_out[..., None] * 0.85
    col = col * (1 - lau_all[..., None]) + lcol * lau_all[..., None]
    height += lau_all * 0.6 + ndimage.gaussian_filter(lau_all, 1.2 * s) * 0.3
    metal = np.maximum(metal, lau_all)
    if T["glow"] > 0: glow = np.maximum(glow, lau_all * 0.45)
    shade = ndimage.gaussian_filter(sm, 0.9 * s) * 0.35
    col = col * (1 - shade[..., None])
    oc = np.array(T["outline"], np.float32) / 255
    col = col * (1 - em[..., None]) + oc[None, None] * em[..., None]
    ramp = np.zeros((th, tw), np.float32)
    for y0, y1 in grad_rows:
        a, b = y0 / k2, y1 / k2
        m = (yy >= a - 2) & (yy <= b + 2)
        ramp = np.where(m, np.clip((yy - a) / max(b - a, 1), 0, 1), ramp)
    lt, ll = np.array(T["letter"], np.float32) / 255, np.array(T["letter_lo"], np.float32) / 255
    lcol2 = lt[None, None] * (1 - ramp[..., None] ** 1.3) + ll[None, None] * ramp[..., None] ** 1.3
    col = col * (1 - fm[..., None]) + lcol2 * fm[..., None]
    height += em * 0.35 + fm * 0.35 + ndimage.gaussian_filter(fm, 0.8 * s) * 0.3
    letters = np.maximum(em, fm)
    if T["glow"] > 0: glow = np.maximum(glow, fm * 0.55)

    os.makedirs(out_dir, exist_ok=True)
    name = f"{var}_{tier}_{content}"
    rgba = np.dstack([np.clip(col, 0, 1), alpha])
    Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA").save(os.path.join(out_dir, name + "_color.png"))
    h = height - height.min(); h = h / max(h.max(), 1e-6)
    Image.fromarray((h * 65535).astype(np.uint16)).save(os.path.join(out_dir, name + "_height.png"))
    mk = np.dstack([metal, letters, glow])
    Image.fromarray((np.clip(mk, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB").save(os.path.join(out_dir, name + "_mask.png"))
    json.dump(dict(var=var, tier=tier, content=content, size=[tw, th], tex_px=s, rows=rows_out), open(os.path.join(out_dir, name + ".json"), "w"), indent=1)
    print("TEX", name, tw, th)
    return name


if __name__ == "__main__":
    var, tier, content = sys.argv[1:4]
    out = sys.argv[4] if len(sys.argv) > 4 else os.path.join(BAKE, "tex")
    build(var, tier, content, out)
