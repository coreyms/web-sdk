"""THE LED BOARDS' SEATED RIDERS (Corey 2026-11-19: "can we put Grandma in the cars, santa in the sleighs in the existing
animations?"). Grandma's car and Santa's sleigh on the LED pictures (tools/build_scoreboard_art.py: the strip's cartoons and
the back board's scenes; tools/build_led_art.py: the press screen) are drawn with their rider seated, exactly as the road
board seats them (game/road/seated.ts): the vehicle (the symbol atlas's own frame) as the back layer, the locked still
(references/mockups/grandma_car_seated_v4.png, santa_sleigh_seated_v13.png, resampled only) at the built placement of
tools/seated_split.json, then the vehicle's near door or sleigh wall (the front layer, the same cut line) over her or him.
The helpers are tools/build_seated.py's own (cut_line, front_layer, figure_picture, place), so the LED picture is the road
board's picture at rest (no lean, no win bob), from the desktop atlas (3.2 px per road px), stepped down to the LED sheet's
size with a premultiplied Lanczos.

compose(frame, vehicle_w) -> (PIL RGBA picture, vehicle box): the picture trimmed to its ink, sized so the VEHICLE is
vehicle_w px wide (the mock's vehicle pictures are the atlas frames at 160 px wide), and the vehicle's box in it
{x, y, w, h} px: the LED code places and sizes the picture by the vehicle (game/scoreboard/scoreboardDraw.ts sprite,
game/landing/ledScreens.ts drawFit), so the vehicle lands where the empty one did and the rider rises above it.
"""
import importlib.util
import json
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("build_seated", os.path.join(HERE, "build_seated.py"))
bs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bs)
bs.SPLIT = json.load(open(os.path.join(HERE, "seated_split.json")))

DENS = bs.DENSITY["full"]


def _char_height(character):
    return max(f["figure"]["height"] for f in bs.SPLIT["frames"].values() if f["character"] == character)


def compose(frame, vehicle_w):
    S = bs.SPLIT
    f = S["frames"][frame]
    fig = f["figure"]
    c = f["character"]
    ch = _char_height(c)
    rw, rh = bs.road_size(frame)
    car = bs.atlas_frame("full", frame)
    H, W = car.shape[:2]
    xr, yr = bs.cut_line(f, frame, rw, rh, car)
    floor = fig["at"][1] + fig["keep"] * fig["height"] / ch + S["floorMargin"]
    front = bs.front_layer(car, rw, rh, xr, yr, S["band"], floor)
    pic, piv, _k = bs.figure_picture(c, ch, fig["keep"], fig["pivot"], DENS)
    kxp, kyp = W / rw, H / rh
    # room on every side, so nothing of the rider is cut by the vehicle's frame
    pad = int(round(80 * DENS))
    canvas = (H + pad, W + 2 * pad)
    at = ((fig["at"][0] + rw / 2) * kxp + pad, (fig["at"][1] + rh) * kyp + pad)
    drv = bs.place(canvas, pic, piv, at, fig["mirror"], fig["height"] / ch)
    car_pad = np.zeros(canvas + (4,), np.float32)
    car_pad[pad:, pad:pad + W] = car
    front_pad = np.zeros(canvas + (4,), np.float32)
    front_pad[pad:, pad:pad + W] = front
    comp = bs.over(bs.over(car_pad, drv), front_pad)
    x0, y0, x1, y1 = bs.trim_box(comp[..., 3], 1.5 / 255)
    comp = comp[y0:y1, x0:x1]
    s = vehicle_w / W
    out = bs.resize_pm(comp, round(comp.shape[1] * s), round(comp.shape[0] * s))
    # the vehicle's box in the output (its frame: x pad..pad+W, y pad..pad+H on the canvas)
    vx, vy = (pad - x0) * s, (pad - y0) * s
    box = {"x": round(vx), "y": round(vy), "w": round(W * s), "h": out.shape[0] - round(vy)}
    return bs.to_img(out), box


if __name__ == "__main__":
    import sys

    dest = sys.argv[1] if len(sys.argv) > 1 else "."
    for fr in ("H1_L", "W_L"):
        im, box = compose(fr, 160)
        im.save(os.path.join(dest, f"{fr}_seated.png"))
        print(fr, im.size, box)
