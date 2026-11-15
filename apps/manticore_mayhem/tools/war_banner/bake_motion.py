"""THE WAR STANDARD, GAME BUILD: the cloth's motion for the game, baked from the approved sim (a9, 60 fps).

The game's cloth is ONE MeshSimple on a coarse grid of the cloth's material (NC columns x NR rows, u across, v down
from the roll's core), its vertices per frame read here from the sim's 6 x 3 px grid (bilinear) and projected straight
on (screen x, y; design px = desktop CSS px, x from the banner's centre line, y down from the pole's line).
A vertex still on the roll (v at or above the departure v_dep) sits on the departure line (the roll's front, y = the
roll's centre), so the mesh never folds behind itself; the game gives those rows uv v = v_dep.

Sequences (sim frames):
  unroll   18 .. 164   the unroll, the brake, the settle and its quiet tail up to the hold loop's start
  loop    165 .. 344   the hold, 180 frames (3 s). Its last LOOP_XF frames are cross faded into the frames just before
                       165 (f - 180), so frame 344 runs into 165 with the sim's own velocity: no seam
  rollup  369 .. 387   the roll up (the game blends from whatever hold frame is up over its first frames)
plus the roll's path (centre y, z; the radius is the cloth still on it) for the entry (0 .. 18) and the retreat (387 .. 400).

Output: static/assets/ui/banner/banner-motion.bin (int16, 1/QUANT px, each sequence's first frame absolute then per
frame deltas, frame-major [frame][vertex][x, y]) and banner-motion.json (the grid, the sequences, per frame v_dep / roll
centre / radius, the entry and retreat paths, the stats).
python bake_motion.py
"""
import sys, os, json, gzip
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cfg_game import *  # noqa

NC, NR = 25, 40
V_TOP = 52.0          # the top row: the brake's 8 px overshoot pays out down to v 52
V_BOT = TEX_V1        # 656: under the middle tongue's tip (653)
QUANT = 32            # 1/32 design px
LOOP0, LOOP_N, LOOP_XF = 165, 180, 60
SEQ = {"unroll": (18, 165), "loop": (LOOP0, LOOP0 + LOOP_N), "rollup": (369, 388)}


def grids(pos, uv):
    I = np.rint(uv[:, 0] / (W / 99)).astype(int); J = np.rint(uv[:, 1] / 3.0).astype(int)
    X = np.full((219, 100), np.nan); Y = np.full((219, 100), np.nan)
    X[J, I] = pos[:, 0]; Y[J, I] = pos[:, 1]
    # past the cut (round the hem): carry each column on along its own last segment
    for i in range(100):
        col = np.nonzero(~np.isnan(X[:, i]))[0]
        if not len(col): continue
        last = col.max(); prev = last - 1 if last - 1 in col else last
        dx = X[last, i] - X[prev, i]; dy = Y[last, i] - Y[prev, i]
        if prev == last: dx, dy = 0.0, 3.0
        for j in range(last + 1, 219):
            X[j, i] = X[last, i] + dx * (j - last); Y[j, i] = Y[last, i] + dy * (j - last)
    bad = np.isnan(X)
    if bad.any():
        from scipy import ndimage
        idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
        X = X[tuple(idx)]; Y = Y[tuple(idx)]
    return X, Y


def bil(G, u, v):
    fi = np.clip(u / (W / 99), 0, 99 - 1e-6); fj = np.clip(v / 3.0, 0, 218 - 1e-6)
    i0 = np.floor(fi).astype(int); j0 = np.floor(fj).astype(int); a = fi - i0; b = fj - j0
    return G[j0, i0] * (1 - a) * (1 - b) + G[j0, i0 + 1] * a * (1 - b) + G[j0 + 1, i0] * (1 - a) * b + G[j0 + 1, i0 + 1] * a * b


def main():
    d = np.load(SIM)
    pos, uv, info = d["pos"], d["uv"], d["info"]          # info: v_dep, cy, cz, R_dep, n_free
    us = np.linspace(0, W, NC); vs = np.linspace(V_TOP, V_BOT, NR)
    U, V = np.meshgrid(us, vs)                            # [NR, NC], row major (row j, column i)
    u_f, v_f = U.ravel(), V.ravel()

    def frame(f):
        X, Y = grids(pos[f], uv)
        vd = float(info[f, 0]); cy = float(info[f, 1])
        x = bil(X, u_f, v_f); y = bil(Y, u_f, v_f)
        on = v_f <= vd
        if on.any():
            x[on] = bil(X, u_f[on], np.full(on.sum(), min(vd, 654.0)))
            y[on] = cy
        return np.stack([x, y], -1)

    seqs = {}
    for k, (a, b) in SEQ.items():
        seqs[k] = np.stack([frame(f) for f in range(a, b)])
    # the loop's cross fade into the frames before its start (velocity and position close)
    loop = seqs["loop"]; pre = seqs["unroll"]
    for k in range(LOOP_XF):
        f = LOOP_N - LOOP_XF + k                          # loop index
        w = (k + 1) / LOOP_XF; w = w * w * (3 - 2 * w)
        src = pre[(LOOP0 - LOOP_N + (LOOP_N - LOOP_XF + k)) - SEQ["unroll"][0]]  # sim frame f - 180
        loop[f] = (1 - w) * loop[f] + w * src
    seqs["loop"] = loop
    # stats for the notes: the seam (last loop frame -> first) against the frame to frame step around it
    step = np.abs(loop[1:] - loop[:-1]).max(axis=(1, 2))
    seam = float(np.abs(loop[0] - loop[-1]).max())
    seam_v = float(np.abs((loop[1] - loop[0]) - (loop[0] - loop[-1])).max())
    raw_seam = float(np.abs(frame(LOOP0) - frame(LOOP0 + LOOP_N)).max())
    # quantise, delta code per sequence
    order = ["unroll", "loop", "rollup"]
    parts = []; meta_seq = {}; at = 0
    for k in order:
        q = np.rint(seqs[k] * QUANT).astype(np.int32)
        dq = q.copy(); dq[1:] = q[1:] - q[:-1]
        assert np.abs(dq).max() < 32767 and np.abs(q).max() < 32767
        parts.append(dq.astype(np.int16).ravel())
        a, b = SEQ[k]
        meta_seq[k] = dict(start=at, count=b - a, simFrom=a, vdep=[round(float(x), 3) for x in info[a:b, 0]], cy=[round(float(x), 3) for x in info[a:b, 1]],
                           R=[round(float(x), 3) for x in info[a:b, 3]])
        at += b - a
    data = np.concatenate(parts)
    os.makedirs(STATIC, exist_ok=True)
    binp = os.path.join(STATIC, "banner-motion.bin")
    data.tofile(binp)
    raw = os.path.getsize(binp); gz = len(gzip.compress(data.tobytes(), 9))
    # the roll's path over the rail (cloth not out yet) and back: centre y (design px, down from the pole), z (toward
    # the camera from the pole's axis; the board's front is z -25), the radius (the whole cloth on it)
    path = lambda a, b: dict(cy=[round(float(x), 3) for x in info[a:b, 1]], cz=[round(float(x), 3) for x in info[a:b, 2]], R=[round(float(x), 3) for x in info[a:b, 3]])
    js = dict(
        note="THE WAR STANDARD's cloth motion (tools/war_banner/bake_motion.py from sim a9): design px (desktop CSS px), x from the banner's centre line, y down from the pole's line, 60 fps.",
        fps=60, quant=QUANT, cols=NC, rows=NR, u=[round(float(x), 4) for x in us], v=[round(float(x), 4) for x in vs], width=W, texV0=TEX_V0, texV1=TEX_V1,
        coreR=R_CORE, layer=LAYER, length=L, restPaid=float(L - V_REST),
        seq=meta_seq, order=order, entry=path(0, 19), retreat=path(387, 401),
        stats=dict(raw_bytes=raw, gzip_bytes=gz, frames=int(sum(v["count"] for v in meta_seq.values())), vertices=NC * NR,
                   loop_seam_px=round(seam, 4), loop_seam_velocity_change_px=round(seam_v, 4), loop_max_step_px=round(float(step.max()), 4),
                   raw_sim_seam_px=round(raw_seam, 4)),
    )
    json.dump(js, open(os.path.join(STATIC, "banner-motion.json"), "w"), separators=(",", ":"))
    print(json.dumps(js["stats"]))


if __name__ == "__main__":
    main()
