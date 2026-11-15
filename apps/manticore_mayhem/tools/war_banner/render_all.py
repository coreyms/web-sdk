"""THE WAR STANDARD, GAME BUILD: every rest render the textures need, 3 Blender processes at a time under nice 19.
python render_all.py [substring filter, e.g. "P_epic"]"""
import os, sys, subprocess
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cfg_game import BAKE, BLENDER, LIGHT, RENDER_EV

HERE = os.path.dirname(os.path.abspath(__file__))
flt = sys.argv[1] if len(sys.argv) > 1 else ""
jobs = []
for v in ("D", "P"):
    for t in ("fs", "super", "epic"):
        for c in ("intro", "total"):
            for rig, _ in LIGHT[t]:
                name = f"{v}_{t}_{c}_{rig}"
                if flt in name: jobs.append((v, t, c, rig, name))
os.makedirs(os.path.join(BAKE, "rend"), exist_ok=True)


def run(j):
    v, t, c, rig, name = j
    cmd = ["nice", "-n", "19", BLENDER, "-b", "--factory-startup", "-t", "1", "--python", os.path.join(HERE, "render_rest.py"), "--",
           "--tex", os.path.join(BAKE, "tex", f"{v}_{t}_{c}"), "--tier", t, "--rig", rig, "--scale", "4.3" if v == "D" else "2.2",
           "--ev", str(RENDER_EV[rig]), "--out", os.path.join(BAKE, "rend", name + ".png")]
    r = subprocess.run(cmd, capture_output=True, text=True)
    ok = "RENDERED" in r.stdout
    print(("OK " if ok else "FAIL ") + name, flush=True)
    if not ok: print(r.stdout[-2000:], r.stderr[-2000:])


with ThreadPoolExecutor(3) as ex:
    list(ex.map(run, jobs))
