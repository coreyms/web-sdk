"""THE WAR STANDARD BANNER, GAME BUILD (2026-11-14): shared numbers for the bake scripts in this folder.

It builds on the approved mockup's own numbers (cfg2.py in the mockup's _work/scripts, imported from there, read only)
and changes only what the game build asked for:
  * Epic: a brighter cloth and ivory letters (the mockup's read dark copper)
  * the live text (the intro's spin count, the TOTAL WIN amount and its IN n ... FREE SPINS line) is NOT baked: the game
    draws it from its own glyph atlas (stinger-glyphs, Rakkas) as quads that ride the cloth's mesh
  * the TOTAL WIN layout rebalanced lower (less empty cloth under it), the cloth size unchanged
  * the textures cover the hanging cloth only (material v 60 .. 656: the part below the roll at rest), square
Run with the cad_frame venv python (numpy, scipy, PIL): /Users/corey/Tools/cad_frame/venv/bin/python
"""
import os, sys

MOCK = "/Users/corey/Desktop/Manticore Mayhem/images/war_banner_2026-11-13"
sys.path.insert(0, os.path.join(MOCK, "_work", "scripts"))
from cfg2 import *  # noqa: F401,F403  (W, L, V_REST, outline, tips, TIERS, RULES, fonts, FORBIDDEN ...)
import cfg2 as _cfg2

GAME = "/Users/corey/Projects/stake-engine/web-sdk/apps/manticore_mayhem"
STATIC = os.path.join(GAME, "static", "assets", "ui", "banner")
BAKE = os.path.join(MOCK, "game_build", "_bake")
SIM = os.path.join(MOCK, "_work", "sim", "a9.npz")
SIM_SUMMARY = os.path.join(MOCK, "_work", "sim", "a9_summary.json")
BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"
PY = "/Users/corey/Tools/cad_frame/venv/bin/python"

# the texture covers material u 0 .. W and v TEX_V0 .. TEX_V1 (the cloth below the roll at rest, down past the middle
# tongue's tip at 653). Square, power of two: D 2048 (desktop / tablet, the 2048 cap), P 1024 (phones).
TEX_V0 = 60.0
TEX_V1 = TEX_V0 + W  # 656
TEX_SIZE = {"D": 2048, "P": 1024}
# the rest pose the textures are rendered in (a hold frame of the sim; the mockup's stills used the same)
REST_FRAME = 230

# ---- Epic, the game build's fix: a brighter cloth (still a cool near black, no red to go brown under the braziers) and
# ivory letters that stay ivory to their foot (the mockup's ran ivory to ember and read copper)
_cfg2.TIERS["epic"].update(cloth=(58, 53, 66), cloth_lo=(28, 25, 33), letter=(255, 248, 234), letter_lo=(244, 228, 204))
# ---- Super, 2026-11-15 (Corey: "the Blue doesn't really fit the game", picked option 1 "Oxblood, gold" from the stills in
# super_look_r1, FIX2_NOTES.md section D): an oxblood cloth (the helmet's wine wrap, m1) with crown gold trim and laurel
# (h1), ivory letters held ivory as Epic's are, no ember glow. Exactly super_look_r1/_work/options.py OPTIONS["superA"].
# The blue (navy 30 34 104, gray trim 214 206 176) is archived in ~/Desktop/_archive/manticore-super-banner-blue-2026-11-15.
_cfg2.TIERS["super"].update(cloth=(116, 20, 40), cloth_lo=(66, 9, 22), trim=(250, 212, 104), trim_dk=(156, 106, 30),
                            stitch=(58, 8, 18), outline=(26, 8, 10), laurel=(244, 200, 92), laurel_dk=(134, 88, 20),
                            letter=(250, 244, 230), letter_lo=(236, 224, 200), glow=0.0)
TIERS = _cfg2.TIERS
# compose.py's lifts for Super (its night rig alone leaves the deep cloth at about a third and dims the gold thread): the
# thread (mask metal) lifted by 0.30 of its albedo, the cloth by 0.35, the letters held ivory (Epic's hold, no halo)
LIFT = {"super": dict(trim=0.30, cloth=0.35)}

# ---- the scene light per tier: each layer is a render of the cloth under the board frame's own rig (blib TIER_LOOK: D1,
# night and fire are the frame plates' rigs), the day and night layers graded like the plates (the Stinger grade), summed
# in sRGB like the game sums the frame's layers (components/BoardFrame.svelte applyLight):
#   bonus (Free Spins)  D1 at RENDER_EV, graded: exactly the approved mockup's Free Spins (render2 --ev -0.55 + grade)
#   super               night at RENDER_EV, graded, x foreTint (1, 1, 1)  +  fire x fire 0.7 x fireTint (1, 1, 1)
#   epic                night at RENDER_EV, graded, x foreTint (1, .86, .86)  +  fire x fire 0.9 (flicker .8..1) x (1, .7, .5)
# (SCENE.modes / SCENE.fire / FRAME_RELIGHT.fireGain 1: the frame's own night and fire light per mode; the day and
# night layers take the same exposure offset, so the three tiers keep the frame plates' day / night relation)
RENDER_EV = {"D1": -0.55, "night": -0.55, "fire": 0.0}
LIGHT = {
    "fs": [("D1", (1.0, 1.0, 1.0))],
    "super": [("night", (1.0, 1.0, 1.0)), ("fire", (0.7, 0.7, 0.7))],
    "epic": [("night", (1.0, 0.86, 0.86)), ("fire", (0.9, 0.9 * 0.7, 0.9 * 0.5))],
}

# ---- the live text, material px (u right from the cloth's left edge, v down from its top edge on the roll's core).
# cap = the cap height of the glyph atlas's face (Rakkas: cap 128 of em 192); cy = the cap's centre; maxWidth = the
# row's fit (the amount shrinks to it, never abbreviated).
K_P = 1 / 0.535  # design px per portrait phone CSS px (the P texture's text is set in phone px)
LIVE = {
    "D": {
        "intro": {"count": dict(cy=V_REST + 112, cap=105, maxWidth=230)},
        "total": {"amount": dict(cy=V_REST + 262, cap=84, maxWidth=512), "line": dict(cy=V_REST + 372, cap=22, maxWidth=520)},
    },
    "P": {
        "intro": {"count": dict(cy=V_REST + 56 * K_P, cap=54 * K_P, maxWidth=230)},
        "total": {"amount": dict(cy=V_REST + 134 * K_P, cap=47 * K_P, maxWidth=(W - 2 * (BORDER + 22)) - 8 * K_P),
                  "line": dict(cy=V_REST + 194 * K_P, cap=12.5 * K_P, maxWidth=(W - 2 * (BORDER + 22)))},
    },
}
# the baked rows of the TOTAL WIN cloth (the title and the small wreath), rebalanced with the live rows above
TOTAL_ROWS = {
    "D": dict(title=V_REST + 130, laurel=V_REST + 438),
    "P": dict(title=V_REST + 60 * K_P, laurel=V_REST + 228 * K_P),
}
