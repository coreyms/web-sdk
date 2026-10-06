"""Headless Blender symbol renderer. Usage:
  Blender -b --python render_rig.py -- --rig rig.json --models models.json --out DIR [--size 512] [--survey] [--only CODE,CODE]
models.json: [{"code":"M3","glb":"/abs/path.glb","azimuth":0,"elevation":12,"roll":0,"fill":0.82}]
  azimuth: degrees around Z (0 = the glb's -Y face toward the camera), elevation: degrees above the horizon, fill: object extent as a share of the frame
rig.json: {
  "engine":"EEVEE"|"CYCLES", "samples":64, "denoise":true, "view_transform":"AgX"|"Filmic"|"Standard", "look":"None"|"AgX - Punchy"|..., "exposure":0, "gamma":1,
  "world":{"color":[r,g,b],"strength":0.3},
  "camera":{"type":"ORTHO"|"PERSP","fov":35},
  "lights":[{"name":"Key","type":"AREA"|"POINT"|"SPOT"|"SUN","pos":[x,y,z],"energy":900,"color":[1,1,1],"size":1.0,"spot_angle":60}],
  "shadow_catcher": false,
  "per_code": {"W": {"exposure": 0.3, "lights_extra": [ ...same shape as lights... ], "light_scale": {"Front": 0.5}, "drop_lights": ["Under"]}}
}
per_code (optional) applies per symbol code in the same pass: exposure is ADDED to the rig exposure, lights_extra are appended,
light_scale multiplies the energy of named rig lights, drop_lights removes named rig lights. A model entry may also carry "exposure".
Light positions are in CAMERA space, in units of the object's size: x right, y up, z toward the camera (so the same rig lights every model from the same screen direction). energy for AREA/POINT/SPOT is multiplied by size^2 (inverse square), SUN energy is used as-is (W/m^2).
Writes <out>/<code>.png (RGBA) and prints one RESULT json line per model.
"""
import bpy, sys, math, json, os, time
from mathutils import Vector, Matrix
argv = sys.argv[sys.argv.index("--")+1:]
def arg(k, d=None):
    return argv[argv.index(k)+1] if k in argv else d
rig = json.load(open(arg("--rig"))); models = json.load(open(arg("--models")))
out = arg("--out"); size_px = int(arg("--size", 512)); survey = "--survey" in argv
only = arg("--only"); only = set(only.split(",")) if only else None
os.makedirs(out, exist_ok=True)

def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi

def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    eng = rig.get("engine", "EEVEE").upper()
    sc.render.engine = "CYCLES" if eng == "CYCLES" else "BLENDER_EEVEE"
    if eng == "CYCLES":
        sc.cycles.samples = int(rig.get("samples", 64)); sc.cycles.use_denoising = bool(rig.get("denoise", True))
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences; prefs.compute_device_type = "METAL"; prefs.get_devices()
            for d in prefs.devices: d.use = (d.type == "METAL")
            sc.cycles.device = "GPU"
        except Exception as e: print("GPU setup skipped:", e)
    else:
        sc.eevee.taa_render_samples = int(rig.get("samples", 64))
    sc.render.resolution_x = sc.render.resolution_y = size_px; sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"; sc.render.image_settings.color_depth = "8"
    vs = sc.view_settings
    vs.view_transform = rig.get("view_transform", "AgX")
    try: vs.look = rig.get("look", "None")
    except Exception as e: print("look skipped:", e)
    vs.exposure = float(rig.get("exposure", 0)); vs.gamma = float(rig.get("gamma", 1))
    w = bpy.data.worlds.new("World"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    wc = rig.get("world", {"color": [0.05, 0.05, 0.05], "strength": 0.0})
    bg.inputs["Color"].default_value = (*wc.get("color", [0.05, 0.05, 0.05]), 1); bg.inputs["Strength"].default_value = float(wc.get("strength", 0))
    return sc

def render_model(m, az, el, tag=None):
    sc = setup_scene()
    pc = rig.get("per_code", {}).get(m["code"], {})
    sc.view_settings.exposure = float(rig.get("exposure", 0)) + float(pc.get("exposure", 0)) + float(m.get("exposure", 0))
    bpy.ops.import_scene.gltf(filepath=m["glb"])
    objs = [o for o in sc.objects if o.type == "MESH"]
    lo, hi = bounds(objs); centre = (lo + hi) / 2; ext = hi - lo; size = max(ext)
    radius = (ext.length) / 2
    # camera orbit: azimuth around Z, elevation above the XY plane; camera looks at the centre
    a, e = math.radians(az), math.radians(el)
    dist = max(size * 6, 1e-3)
    direction = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))  # from centre toward camera
    cam_data = bpy.data.cameras.new("Cam"); cam = bpy.data.objects.new("Cam", cam_data); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = centre + direction * dist
    cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    cam.rotation_euler.rotate_axis("Z", math.radians(m.get("roll", 0)))
    fill = float(m.get("fill", 0.82))
    ctype = rig.get("camera", {}).get("type", "ORTHO").upper()
    if ctype == "PERSP":
        cam_data.type = "PERSP"; fov = math.radians(float(rig.get("camera", {}).get("fov", 35))); cam_data.angle = fov
        d = (radius / fill) / math.tan(fov / 2); cam.location = centre + direction * d
    else:
        cam_data.type = "ORTHO"; cam_data.ortho_scale = (2 * radius) / fill
    cam_data.clip_end = dist * 4
    # lights in camera space
    cam_mat = cam.matrix_world.to_3x3()
    drop = set(pc.get("drop_lights", [])); scale = pc.get("light_scale", {})
    lights = [L for L in rig.get("lights", []) if L.get("name") not in drop] + list(pc.get("lights_extra", []))
    for L in lights:
        kind = L.get("type", "AREA").upper()
        ld = bpy.data.lights.new(L.get("name", kind), kind)
        base = float(L.get("energy", 500)) * float(scale.get(L.get("name"), 1.0))
        ld.energy = base if kind == "SUN" else base * size * size
        ld.color = tuple(L.get("color", [1, 1, 1]))
        if kind == "AREA": ld.size = float(L.get("size", 1.0)) * size; ld.shape = "SQUARE"
        if kind == "SPOT": ld.spot_size = math.radians(float(L.get("spot_angle", 60))); ld.spot_blend = 0.5; ld.shadow_soft_size = float(L.get("size", 0.3)) * size
        if kind == "POINT": ld.shadow_soft_size = float(L.get("size", 0.3)) * size
        if kind == "SUN": ld.angle = math.radians(float(L.get("sun_angle", 5)))
        lo_ = bpy.data.objects.new(ld.name, ld); sc.collection.objects.link(lo_)
        p = Vector(L.get("pos", [1, 1, 1])) * size
        lo_.location = centre + cam_mat @ p
        lo_.rotation_euler = (centre - lo_.location).to_track_quat("-Z", "Y").to_euler()
    if rig.get("shadow_catcher"):
        bpy.ops.mesh.primitive_plane_add(size=size * 6, location=(centre.x, centre.y, lo.z))
        pl = bpy.context.object; pl.is_shadow_catcher = True
    name = m["code"] + (f"_{tag}" if tag else "")
    sc.render.filepath = os.path.join(out, name + ".png")
    t = time.time(); bpy.ops.render.render(write_still=True)
    print("RESULT " + json.dumps({"code": m["code"], "tag": tag, "file": sc.render.filepath, "secs": round(time.time() - t, 1), "exposure": round(sc.view_settings.exposure, 2), "lights": [L.get("name") for L in lights], "meshes": len(objs), "verts": sum(len(o.data.vertices) for o in objs), "dims": [round(v, 3) for v in ext], "materials": sorted({mat.name for o in objs for mat in o.data.materials if mat})[:8]}))

for m in models:
    if only and m["code"] not in only: continue
    if survey:
        for az in (0, 45, 90, 135, 180, 225, 270, 315):
            render_model(m, az, 15, tag=f"az{az:03d}")
        render_model(m, 0, 70, tag="top")
    else:
        render_model(m, float(m.get("azimuth", 0)), float(m.get("elevation", 12)))
