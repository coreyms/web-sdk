"""THE LED SCOREBOARD'S PICTURES (Corey 2026-11-16, bigwin_led_r3_2026-11-16 "r3b", approved; game/scoreboard/): packs the
approved mock's own pictures (its work/art/: the reindeer's eight run frames, Grandma's car, the wagon, the OH-KAY van, the
police car, Santa's sleigh, the three column characters and the present, at the sizes the mock draws them from) into ONE
small sheet the strip and the back board draw their cartoons from, at one pixel per dot, on 2D canvases:
static/assets/scoreboard/scoreboard-art.webp (quality 90, its alpha lossless: the LED punch keys on alpha) and
src/game/scoreboardArtSpec.ts (generated: each picture's place on the sheet). The run strip stays whole (its eight
125 x 108 frames side by side, as the mock cuts them).

The sheet is never drawn by Pixi (never sent to the GPU): the dot canvases read it. The dot canvases are exempt from the 3x
rule by design (one canvas pixel per LED dot, scaled with nearest sampling).

THE RIDERS (Corey 2026-11-19): Grandma's car and Santa's sleigh carry their riders, seated as the road board seats them
(tools/led_seated.py: the atlas's H1_L and W_L frames with the locked stills and the near door or sleigh wall over them, at
the mock's vehicle width). Their frames carry `vehicle`: the vehicle's box in the picture (px), which the LED code places
and sizes by, so the vehicle lands where the empty one did and the rider rises above it.

THE ROUND 1 LED IDEAS (Corey 2026-11-19, led_anim_ideas_r1_2026-11-19; game/scoreboard/entryScenes.ts, ambient.ts): a fourth
row of the game's own approved art, read from static/assets (no new drawing): the red present (the Super scatter, S-red, at
the present's own 180 x 201), the wagon's tree (riders/wagon-tree H2_R_tree), the four road signs A K Q J (symbols/single
L1 to L4) and the J sign's plate and post (the symbol atlas's L4_plate and L4_post), each trimmed to its alpha and
stepped down (premultiplied Lanczos) to IDEAS_H px tall (the J's post at the J's own scale: the mock's 142 of 240), the
tree to 64 px (the largest any of them is drawn is about half that in LEDs). The LED code keeps the mock's proportions (it reads only each picture's aspect and its own shares).

Run with the math env's Python (Pillow, numpy, scipy):
    math-sdk/env/bin/python web-sdk/apps/run_over_reindeer/tools/build_scoreboard_art.py
"""
import json
import os

from PIL import Image

from led_seated import compose

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SRC = os.path.expanduser("~/Desktop/Run Over Reindeer/bigwin_led_r3_2026-11-16/work/art")
OUT = os.path.join(APP, "static", "assets", "scoreboard")
SPEC = os.path.join(APP, "src", "game", "scoreboardArtSpec.ts")
# row 1: the run strip; row 2 the cars and the sleigh; row 3 the column characters and the present
ROWS = [["run_strip"], ["car", "H2", "H3", "H4", "sleigh"], ["reindeer_col", "santa_col", "grandma_col", "present"], ["present_red", "sign_a", "sign_k", "sign_q", "sign_j", "sign_j_plate", "sign_j_post"], ["tree", "sleigh_r", "H4_r"]]
GAME = os.path.join(APP, "static", "assets")
IDEAS_H = 112
# the round 1 ideas' pictures: (source, frame or None, height)
IDEAS = {
    "present_red": ("symbols/single/S-red.webp", None, None),
    "sign_a": ("symbols/single/L1.webp", None, IDEAS_H),
    "sign_k": ("symbols/single/L2.webp", None, IDEAS_H),
    "sign_q": ("symbols/single/L3.webp", None, IDEAS_H),
    "sign_j": ("symbols/single/L4.webp", None, IDEAS_H),
    "sign_j_plate": ("symbols/symbols.webp", "L4_plate", IDEAS_H),
    "sign_j_post": ("symbols/symbols.webp", "L4_post", round(142 * IDEAS_H / 240)),
    "tree": ("riders/wagon-tree.webp", "H2_R_tree", 64),
}
GAP = 2
# the vehicles drawn with their rider: the atlas frame each one is (the mock's pictures face left)
SEATED = {"car": "H1_L", "sleigh": "W_L", "sleigh_r": "W_R"}
# THE WORDS READ LEFT TO RIGHT (Corey 2026-11-19: "Mirrored wild on sleigh LED, yes fix it"): a vehicle that travels right
# on the LED boards is its own picture made from the atlas's RIGHT facing frame (the road's own art, its lettering drawn
# readable that way: WILD on the sleigh, POLICE on the police car), never the left facing picture mirrored at draw time.
# The vehicle box of sleigh_r is the right facing composite's own; H4_r is the atlas's H4_R at the H4 picture's width.
FACING_R = {"H4_r": ("H4_R", "H4")}


def resize_premul(im, w, h):
    """a premultiplied Lanczos step down (no dark fringe from the transparent pixels' colour)"""
    import numpy as np

    a = np.asarray(im.convert("RGBA")).astype(np.float64) / 255.0
    rgb = a[..., :3] * a[..., 3:4]
    chans = [Image.fromarray((rgb[..., i] * 255).round().astype("uint8")).resize((w, h), Image.LANCZOS) for i in range(3)]
    al = Image.fromarray((a[..., 3] * 255).round().astype("uint8")).resize((w, h), Image.LANCZOS)
    A = np.asarray(al).astype(np.float64) / 255.0
    out = np.zeros((h, w, 4))
    for i in range(3):
        c = np.asarray(chans[i]).astype(np.float64) / 255.0
        out[..., i] = np.where(A > 0, np.clip(c / np.maximum(A, 1e-6), 0, 1), 0)
    out[..., 3] = A
    return Image.fromarray((out * 255).round().astype("uint8"), "RGBA")


def idea(name):
    """one of the round 1 ideas' pictures from the game's own static art"""
    src, frame, h = IDEAS[name]
    im = Image.open(os.path.join(GAME, src)).convert("RGBA")
    if frame:
        js = json.load(open(os.path.join(GAME, os.path.splitext(src)[0] + ".json")))["frames"][frame]["frame"]
        im = im.crop((js["x"], js["y"], js["x"] + js["w"], js["y"] + js["h"]))
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    if name == "present_red":
        # the red present at the teal present's own size (scoreboard present: 180 x 201, the same picture's aspect)
        return resize_premul(im, 180, 201)
    if im.height != h:
        im = resize_premul(im, max(1, round(im.width * h / im.height)), h)
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    def load(n):
        if n in IDEAS:
            return idea(n)
        if n in FACING_R:
            fr, like = FACING_R[n]
            js = json.load(open(os.path.join(GAME, "symbols", "symbols.json")))["frames"][fr]["frame"]
            im = Image.open(os.path.join(GAME, "symbols", "symbols.webp")).convert("RGBA").crop((js["x"], js["y"], js["x"] + js["w"], js["y"] + js["h"]))
            bb = im.getbbox()
            im = im.crop(bb) if bb else im
            ref = Image.open(os.path.join(SRC, like + ".png"))
            return resize_premul(im, ref.width, max(1, round(im.height * ref.width / im.width)))
        if n in SEATED and n not in ("car", "sleigh"):
            return Image.new("RGBA", (160, 100))  # (composed below)
        return Image.open(os.path.join(SRC, n + ".png")).convert("RGBA")

    ims = {n: load(n) for row in ROWS for n in row}
    boxes = {}
    for n, fr in SEATED.items():
        ims[n], boxes[n] = compose(fr, ims[n].width)
    W = max(sum(ims[n].width for n in row) + GAP * (len(row) - 1) for row in ROWS)
    H = sum(max(ims[n].height for n in row) for row in ROWS) + GAP * (len(ROWS) - 1)
    sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    frames = {}
    y = 0
    for row in ROWS:
        x = 0
        for n in row:
            im = ims[n]
            sheet.paste(im, (x, y))
            frames[n] = {"x": x, "y": y, "w": im.width, "h": im.height}
            if n in boxes:
                frames[n]["vehicle"] = boxes[n]
            x += im.width + GAP
        y += max(ims[n].height for n in row) + GAP
    path = os.path.join(OUT, "scoreboard-art.webp")
    sheet.save(path, "WEBP", quality=90, alpha_quality=100, method=6)
    with open(SPEC, "w") as f:
        f.write("// AUTO-GENERATED by tools/build_scoreboard_art.py from the approved LED scoreboard mock's pictures (bigwin_led_r3).\n")
        f.write("// Do not edit: run the tool again. The pictures the strip and the back board draw their cartoons from\n")
        f.write("// (game/scoreboard/scoreboardDraw.ts), their place on static/assets/scoreboard/scoreboard-art.webp in px; the run\n")
        f.write("// strip holds the reindeer's eight 125 x 108 run frames.\n")
        f.write("export const SCOREBOARD_ART = " + json.dumps({"width": W, "height": H, "frames": frames}, indent="\t") + " as const;\n")
    print(W, H, os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
