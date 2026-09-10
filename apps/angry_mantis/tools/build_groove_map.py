"""Build the steel door's GROOVE MAP for the painted-on door layers (run with math-sdk/env/bin/python).

The bonus intro / wrap-up paint their headers, counts and stinger onto the rolled steel door with a
fragment shader (src/components/DoorPaint.svelte, src/game/doorPaint.ts). Every painted pixel is
multiplied by the metal under it, so the paint sits in the door's grooves however the layer moves.
That "metal under it" is this map, derived ONCE from the door art:

  R  high-pass luminance ratio: lum / blur(lum, 14 px), stored /2 (0.5 = neutral, <0.5 groove,
     >0.5 ridge). The shader raises it to the groove-strength power.
  G  vertical gradient of the (lightly blurred) luminance, stored 0.5-centred: the lit lip under a
     groove is > 0.5. The shader adds it as a highlight.
  B  soft blotchy noise, fixed to the door: the shader chips paint where it is dark, so wear never
     swims when a layer moves.

Source: <repo>/assets/images/backgrounds/door-steel.webp  ->  static/assets/ui/paint/door-groove.webp
"""
import os
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, *[".."] * 4))
SRC = os.path.join(REPO, "assets", "images", "backgrounds", "door-steel.webp")
OUT = os.path.abspath(os.path.join(HERE, "..", "static", "assets", "ui", "paint", "door-groove.webp"))

door = Image.open(SRC).convert("L")
lum = np.asarray(door).astype(np.float32) / 255
blur = np.asarray(door.filter(ImageFilter.GaussianBlur(14))).astype(np.float32) / 255
ratio = np.clip(lum / np.maximum(blur, 0.02), 0, 2) / 2
soft = np.asarray(door.filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
grad = np.zeros_like(soft)
grad[1:-1] = (soft[2:] - soft[:-2]) * 0.5
grad = np.clip(grad * 6, -1, 1) * 0.5 + 0.5
rng = np.random.default_rng(20260910)
noise = Image.fromarray((rng.random(lum.shape) * 255).astype(np.uint8))
noise = np.asarray(noise.filter(ImageFilter.GaussianBlur(2.0))).astype(np.float32) / 255
noise = np.clip((noise - noise.mean()) * 4 + 0.5, 0, 1)  # spread the blurred noise back out
rgb = np.stack([ratio, grad, noise], axis=-1)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
# lossy at high quality: the map is smooth and the shader only reads broad ratios from it
Image.fromarray((rgb * 255).astype(np.uint8)).save(OUT, "WEBP", quality=92, method=6)
print(f"ok — {door.size[0]}x{door.size[1]} groove map, {os.path.getsize(OUT) // 1024} KB -> {OUT}")
