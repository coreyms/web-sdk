"""THE WAR STANDARD, GAME BUILD: render the hanging cloth in its rest pose (sim REST_FRAME) under one of the board
frame's own rigs, EEVEE, orthographic, straight on, transparent film. compose.py then resamples it into the cloth's
material space (the game's texture). Only the cloth: no holdout, no roll art (the roll is the game's own parts).
Design px -> board metres as the mockup's render2.py: X = x K, Z = (306.7 - y) K, Y = -z K.
Blender -b --factory-startup -t 3 --python render_rest.py -- --tex <bake/tex/D_fs_intro> --tier fs --rig D1
    --scale 4.3 --out <png> [--samples 64] [--glow 0]
"""
import bpy, sys, os, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cfg_game import *  # noqa
import blib
blib.TIERS = TIERS

argv = sys.argv[sys.argv.index("--") + 1:]
def arg(k, d=None):
    return argv[argv.index(k) + 1] if k in argv else d

TEXB = arg("--tex"); TIER = arg("--tier"); RIG = arg("--rig"); OUT = arg("--out")
SCALE = float(arg("--scale", "4.3")); SAMPLES = int(arg("--samples", "64")); GLOW = float(arg("--glow", "0"))
EV = float(arg("--ev", "0"))
RECT = (-300.0, -12.0, 300.0, 600.0)  # design px: x, y (y down from the pole's line)
Y_POLE = 349.7 - 43.0

d = np.load(SIM)
pos = d["pos"][REST_FRAME].astype(np.float64); uv = d["uv"]; faces = d["faces"]

def to_world(p):
    return np.stack([p[..., 0] * K_M, -p[..., 2] * K_M, (Y_POLE - p[..., 1]) * K_M], -1)

sc = blib.reset()
me = bpy.data.meshes.new("banner")
me.from_pydata([tuple(q) for q in to_world(pos)], [], [tuple(int(i) for i in f) for f in faces])
me.update()
uvl = me.uv_layers.new(name="UVMap")
uvs = np.stack([uv[:, 0] / W, 1 - uv[:, 1] / (L + 2)], -1)
li = np.zeros(len(me.loops), int); me.loops.foreach_get("vertex_index", li)
uvl.data.foreach_set("uv", uvs[li].ravel())
cloth = bpy.data.objects.new("BN_cloth", me); sc.collection.objects.link(cloth)
for p in me.polygons: p.use_smooth = True
sub = cloth.modifiers.new("subd", "SUBSURF"); sub.levels = 1; sub.render_levels = 1
mat = blib.cloth_material(f"cloth_{TIER}", TEXB, TIER, glow_strength=GLOW)
cloth.data.materials.append(mat)

blib.apply_rig(sc, RIG, "A", EV)
x0, y0, x1, y1 = RECT
cd = bpy.data.cameras.new("cam"); cd.type = "ORTHO"
w, h = x1 - x0, y1 - y0
cd.ortho_scale = max(w, h) * K_M; cd.clip_start = 0.01; cd.clip_end = 100
cam = bpy.data.objects.new("cam", cd); sc.collection.objects.link(cam)
cc = to_world(np.array([(x0 + x1) / 2, (y0 + y1) / 2, 0.0]))
cam.location = (cc[0], -8.0, cc[2]); cam.rotation_euler = (math.radians(90), 0, 0); sc.camera = cam
sc.render.resolution_x = int(round(w * SCALE)); sc.render.resolution_y = int(round(h * SCALE)); sc.render.resolution_percentage = 100
cd.sensor_fit = "HORIZONTAL" if w >= h else "VERTICAL"
blib.eevee(sc, SAMPLES)
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"; sc.render.image_settings.color_depth = "16"
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
