"""THE SEATED DRIVERS' ANIMATIONS (Corey 2026-11-16, on stills against animations: "Not staying with the stills"): an idle
(looping) and a win reaction for Grandma and for Santa, made to fit (constants SEATED.clips, game/road/seated.ts).

Run with the math env's Python (Pillow, numpy, scipy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_seated_clips.py [--preview <dir>]

It READS the keyed clips (~/Desktop/Run Over Reindeer/animation/seated/<character>_<clip>/keyed/f_###.png, 97 frames at 24
fps, 2560 px squares), the locked stills and tools/seated_split.json (through tools/build_seated.py's own functions, so the
driver picture is the one the game draws). It WRITES static/assets/riders/clips/<character>-<clip>[-phone].webp + .json and
src/game/seatedClipSpec.ts (generated).

WHAT MOVES, measured (the analysis in pass 7's notes): the whole figure sways a few px in every clip (the keyed renders are
not locked to the still), and the faces carry the acting (Grandma's grin and laugh, Santa's scowl and laugh). So:
  - THE BODY STAYS THE STILL: the locked still, as the game draws it, with the head cut away above HEAD[character].cut
    (a share of the driver picture's height; the hands, the wheel and the door line are the still's own pixels, so the hands
    stay on the wheel and the door covers them exactly as before). It is packed with each clip at the still's own density.
  - THE HEAD IS THE ANIMATED PATCH: each kept frame's head and neck, everything above cut + feather, registered to the still
    by its BODY (the frame's body region matched to the still's at sub-pixel by a shift search: the clip's sway is taken out,
    the head's own motion against the body stays), its lowest `feather` rows fading out over the still's neck. Each frame is
    trimmed to its own pixels.
  - FEWER FRAMES: the idle at IDLE_FPS (a 4.0 s loop: every 4th of the 97, the last dropped as it is the first again), the
    win at WIN_FPS (once, 4.0 s); a kept frame that is the one before it again (mean change under HOLD_EPS of 255) becomes a
    hold of the one before.
  - DENSITY: the patches at PATCH_DENSITY px per road px (desktop 1.6: 1.44 physical px per road px is the driver's drawn size
    at 1440x900 and twice the CSS px on desktop is the render cap; phone 1.0: 3 physical px per CSS px at the phone's largest
    road scale, 0.34 CSS px per road px held sideways), the body at the still's own (3.2 / 1.2, game/road/seated.ts).
  - THE DRIVE IN is not built (it does not fit the budget with the two others; the vehicle's own drive in and the code lean
    carry it).
--preview <dir>: per clip a strip of the kept frames composited over the body at 4x, and budget.json.
"""
import argparse
import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_seated as BS  # noqa: E402

APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "static", "assets", "riders", "clips")
SPEC = os.path.join(APP, "src", "game", "seatedClipSpec.ts")
CLIPS = BS.CLIPS
FIG_DENSITY = BS.DENSITY  # the driver picture's own: full 3.2, phone 1.2
PATCH_DENSITY = {"full": 1.6, "phone": 1.0}
REG_DENSITY = 0.8  # the registration's working density
REG_PAD = 10  # px at REG_DENSITY searched each way (12.5 road px)
# where the head ends (a share of the driver picture's height, from its top), and the fade over the still's neck below it
HEAD = {"grandma": {"cut": 0.465, "feather": 0.035}, "santa": {"cut": 0.585, "feather": 0.035}}
IDLE_FPS = 6
WIN_FPS = 8
HOLD_EPS = 1.2
SRC_FPS = 24


def chars():
    split = json.load(open(os.path.join(HERE, "seated_split.json")))
    out = {}
    for f in split["frames"].values():
        c = f["character"]
        fig = f["figure"]
        cur = out.setdefault(c, {"height": 0, "keep": fig["keep"], "pivot": fig["pivot"]})
        cur["height"] = max(cur["height"], fig["height"])
    return out


def still_box(character, height, keep, pivot):
    im = BS.load_still(character)
    bx0, by0, bx1, by1 = BS.trim_box(im[..., 3])
    k = height / (by1 - by0)
    cut = min(by1, int(math.ceil(pivot[1] + keep / k)))
    return im, (bx0, by0, bx1, cut), (bx0, by0, bx1, by1), k


def render(arr, box, w, h):
    """straight alpha float RGBA crop `box` (x0, y0, x1, y1, floats, may reach outside) resized to w x h, premultiplied"""
    pm = arr.copy()
    pm[..., :3] *= pm[..., 3:4]
    im = Image.fromarray((pm * 255).round().astype(np.uint8), "RGBA")
    o = np.asarray(im.resize((max(1, w), max(1, h)), Image.LANCZOS, box=box)).astype(np.float32) / 255.0
    return o  # premultiplied


def unpremul(pm):
    a = np.clip(pm[..., 3:4], 1e-6, 1)
    o = pm.copy()
    o[..., :3] = np.clip(pm[..., :3] / a, 0, 1)
    o[pm[..., 3] <= 0] = 0
    return o


def load_frame(path, pad=420):
    """a keyed frame, straight alpha float, with `pad` clear px around it (a resample box may reach past its edge)"""
    a = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32) / 255.0
    return np.pad(a, ((pad, pad), (pad, pad), (0, 0)))


def build(preview):
    spec = {"patchDensity": PATCH_DENSITY, "figDensity": FIG_DENSITY, "head": HEAD, "characters": {}}
    budget = {}
    os.makedirs(OUT, exist_ok=True)
    for c, cur in chars().items():
        still, sbox, strim, k = still_box(c, cur["height"], cur["keep"], cur["pivot"])
        bx0, by0, bx1, cut = sbox
        sw, sh = bx1 - bx0, cut - by0
        cspec = spec["characters"].setdefault(c, {"clips": {}})
        # the still at the registration density, and its body rows
        rd = k * REG_DENSITY
        RW, RH = round(sw * rd), round(sh * rd)
        S_r = render(still, sbox, RW, RH)
        body_row = int(RH * (HEAD[c]["cut"] + HEAD[c]["feather"]))
        for clip, fps in (("idle", IDLE_FPS), ("win", WIN_FPS)):
            folder = os.path.join(CLIPS, f"{c}_{clip}", "keyed")
            names = sorted(n for n in os.listdir(folder) if n.endswith(".png"))
            stride = SRC_FPS // fps
            picks = list(range(0, len(names), stride))
            if clip == "idle" and picks[-1] == len(names) - 1:
                picks = picks[:-1]  # the loop's last frame is its first again
            first = load_frame(os.path.join(folder, names[0]))
            cx0, cy0, cx1, cy1 = BS.trim_box(first[..., 3])
            kc = (cy1 - cy0) / (strim[3] - strim[1])  # clip px per still px
            base = (cx0 + (bx0 - strim[0]) * kc, cy0 + (by0 - strim[1]) * kc, cx0 + (bx1 - strim[0]) * kc, cy0 + (cut - strim[1]) * kc)
            per_reg = kc / rd  # clip px per registration px
            regs = []
            frames_pm = {"full": [], "phone": []}
            for i in picks:
                fr = load_frame(os.path.join(folder, names[i]))
                # THE REGISTRATION: the frame's body region against the still's, a shift search at REG_DENSITY
                P = REG_PAD
                big = render(fr, (base[0] - P * per_reg, base[1] - P * per_reg, base[2] + P * per_reg, base[3] + P * per_reg), RW + 2 * P, RH + 2 * P)
                tgt = S_r[body_row:]
                best = None
                scores = np.full((2 * P + 1, 2 * P + 1), np.inf)
                for v in range(-P, P + 1):
                    for u in range(-P, P + 1):
                        win = big[P + v + body_row:P + v + RH, P + u:P + u + RW]
                        s = float(((win - tgt) ** 2).sum())
                        scores[v + P, u + P] = s
                        if best is None or s < best[0]:
                            best = (s, u, v)
                _, u, v = best

                def sub(a, b, c_):
                    d = a - 2 * b + c_
                    return 0.0 if d <= 0 else 0.5 * (a - c_) / d

                fu = u + (sub(scores[v + P, u + P - 1], scores[v + P, u + P], scores[v + P, u + P + 1]) if -P < u < P else 0)
                fv = v + (sub(scores[v + P - 1, u + P], scores[v + P, u + P], scores[v + P + 1, u + P]) if -P < v < P else 0)
                regs.append((round(fu / REG_DENSITY, 2), round(fv / REG_DENSITY, 2)))  # road px of the frame's sway taken out
                box = (base[0] + fu * per_reg, base[1] + fv * per_reg, base[2] + fu * per_reg, base[3] + fv * per_reg)
                for tier, dp in PATCH_DENSITY.items():
                    d = k * dp
                    frames_pm[tier].append(render(fr, box, round(sw * d), round(sh * d)))
            cspec["clips"][clip] = {"fps": fps, "loop": clip == "idle", "source": f"{c}_{clip}", "sway": regs, "tiers": {}}
            for tier, dp in PATCH_DENSITY.items():
                d = k * dp
                PW, PH = round(sw * d), round(sh * d)
                head_end = HEAD[c]["cut"] + HEAD[c]["feather"]
                rows = int(math.ceil(PH * head_end))
                ramp = np.ones(rows, np.float32)
                r0 = PH * HEAD[c]["cut"]
                for y in range(rows):
                    yc = y + 0.5
                    if yc > r0:
                        ramp[y] = max(0.0, 1 - (yc - r0) / (PH * HEAD[c]["feather"]))
                # the kept frames, holds merged
                kept = []
                timeline = []
                prev = None
                for pm in frames_pm[tier]:
                    patch = pm[:rows] * ramp[:, None, None]
                    if prev is not None and float(np.abs(patch - prev).mean()) * 255 < HOLD_EPS:
                        timeline[-1][1] += 1
                        continue
                    kept.append(patch)
                    timeline.append([len(kept) - 1, 1])
                    prev = patch
                pictures = {}
                rects = []
                for n, patch in enumerate(kept):
                    st = unpremul(patch)
                    a = st[..., 3]
                    ys, xs = np.where(a > 1.5 / 255)
                    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
                    pictures[f"{c}_{clip}_{n}"] = st[y0:y1, x0:x1]
                    # in the DRIVER PICTURE's own px fractions (0..1 of its width and height), so one rect serves any density
                    rects.append([round(x0 / PW, 6), round(y0 / PH, 6), round((x1 - x0) / PW, 6), round((y1 - y0) / PH, 6)])
                # THE BODY: the still as the game draws it, its head cut away above `cut` (it is packed with the clip)
                fig, piv, _k = BS.figure_picture(c, cur["height"], cur["keep"], cur["pivot"], FIG_DENSITY[tier])
                FH, FW = fig.shape[:2]
                cut_row = int(math.floor(FH * HEAD[c]["cut"]))
                body = fig[cut_row:].copy()
                pictures[f"{c}_body"] = body
                body_rect = [0, round(cut_row / FH, 6), 1, round((FH - cut_row) / FH, 6)]
                sheet, frames = BS.pack_tight(pictures)
                stem = f"{c}-{clip}" + ("-phone" if tier == "phone" else "")
                img = BS.to_img(sheet)
                img.save(os.path.join(OUT, stem + ".webp"), "WEBP", quality=90, method=6)
                meta = {"frames": frames, "meta": {"image": stem + ".webp", "format": "RGBA8888", "size": {"w": sheet.shape[1], "h": sheet.shape[0]}, "scale": "1"}}
                json.dump(meta, open(os.path.join(OUT, stem + ".json"), "w"), indent=1)
                mb = sheet.shape[0] * sheet.shape[1] * 4 / 1048576
                cspec["clips"][clip]["tiers"][tier] = {"sheet": stem, "size": [sheet.shape[1], sheet.shape[0]], "mb": round(mb, 3), "frames": rects, "timeline": timeline, "body": body_rect, "bytes": os.path.getsize(os.path.join(OUT, stem + ".webp"))}
                budget[stem] = {"sheet": [sheet.shape[1], sheet.shape[0]], "gpuMB": round(mb, 3), "kept": len(kept), "steps": len(timeline), "of": len(frames_pm[tier]), "fileKB": round(os.path.getsize(os.path.join(OUT, stem + ".webp")) / 1024, 1)}
                print(stem, budget[stem], flush=True)
                if preview and tier == "full":
                    os.makedirs(preview, exist_ok=True)
                    strip = []
                    for n, patch in enumerate(kept):
                        canvas = np.zeros((FH, FW, 4), np.float32)
                        canvas[cut_row:] = body
                        st = unpremul(patch)
                        up = np.asarray(BS.to_img(st).resize((FW, int(round(rows * FH / PH))), Image.LANCZOS)).astype(np.float32) / 255
                        canvas[: up.shape[0]] = BS.over(canvas[: up.shape[0]], up)
                        strip.append(canvas)
                    W = sum(s.shape[1] for s in strip)
                    out = np.zeros((FH, W, 4), np.float32)
                    x = 0
                    for s in strip:
                        out[:, x:x + s.shape[1]] = s
                        x += s.shape[1]
                    bg = Image.new("RGBA", (W, FH), (50, 56, 64, 255))
                    bg.alpha_composite(BS.to_img(out))
                    bg.convert("RGB").save(os.path.join(preview, f"{stem}_strip.png"))
    with open(SPEC, "w") as f:
        f.write("// AUTO-GENERATED by tools/build_seated_clips.py from the keyed clips and the locked stills. Do not edit: run the tool\n")
        f.write("// again. Per character and clip: the frames kept (each a rect in the driver picture's own size, 0..1), the timeline\n")
        f.write("// ([kept frame, how many of the clip's fps steps it holds]), the body's rect (the still with the head cut away), the\n")
        f.write("// sheet and its GPU MB per tier; sway: the road px of each kept frame's body sway taken out by the registration.\n")
        f.write("export const SEATED_CLIPS = " + json.dumps(spec, indent="\t") + " as const;\n")
    if preview:
        json.dump(budget, open(os.path.join(preview, "budget.json"), "w"), indent=1)
    return budget


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview")
    args = ap.parse_args()
    b = build(args.preview)
    for tier in ("", "-phone"):
        tot = sum(v["gpuMB"] for k, v in b.items() if k.endswith("-phone") == (tier == "-phone"))
        print("all four loaded at once", tier or "desktop", round(tot, 2), "MB")
