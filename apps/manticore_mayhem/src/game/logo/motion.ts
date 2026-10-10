// THE WINGS' MOTION: the port of the review compositor's vertex math (logo_review_5/scripts/41_comp.py
// Logo.verts, model/scripts/L0_lib.py add_flare), which is what was approved. Pure arithmetic into arrays
// the caller owns: nothing is allocated here.
//
//   idle     idle_breathe, 135 frames at 30 fps, absolute vertex positions. Only every idleStep-th frame
//            ships (tools/build_logo_assets.py prints the error that costs: under 0.03 ship px); positions
//            between two keys are interpolated, so any frame rate reads the same curve.
//   flare    22 frames, per vertex a turn about the wing's knuckle, ADDED to whatever the idle is showing
//            (running or held): v = pivot + R(theta) (idle - pivot), theta clockwise on screen. Frames 0
//            and 21 are zero, so it starts from and returns to the idle with no step.
//   bind     the still's own pose. `settle` 0 draws it, 1 draws the idle, between them a straight blend:
//            how the canvas logo takes over from the still when its data arrives late.
// The entrance is not here: it turns and scales each WHOLE wing, which the view does with the mesh's own
// transform.
import type { LogoData, LogoWing } from './data';

export class LogoMotion {
	readonly wings: LogoWing[];
	readonly fps: number;
	readonly idleFrames: number;
	readonly idleStep: number;
	readonly idleKeys: number;
	readonly flareFrames: number;

	constructor(data: LogoData) {
		const m = data.json.motion;
		this.wings = data.wings;
		this.fps = data.json.fps;
		this.idleFrames = m.idleFrames;
		this.idleStep = m.idleStep;
		this.idleKeys = m.idleKeys;
		this.flareFrames = m.flareFrames;
	}

	/**
	 * The vertex positions of wing i (ship px) into out (nv x 2).
	 * idleFrame: 0 <= f < idleFrames, fractional. settle: 0 = the bind pose .. 1 = the idle.
	 * flareFrame: the flare's frame (fractional, up to flareFrames - 1), or a negative number for none.
	 */
	evaluate(i: number, idleFrame: number, settle: number, flareFrame: number, out: Float32Array): void {
		const W = this.wings[i];
		const n = W.nv * 2;
		const kf = idleFrame / this.idleStep;
		const a = Math.floor(kf);
		const k = kf - a;
		const oa = (a % this.idleKeys) * n;
		const ob = ((a + 1) % this.idleKeys) * n;
		const idle = W.idle;
		if (settle >= 1) {
			for (let j = 0; j < n; j += 1) out[j] = idle[oa + j] + (idle[ob + j] - idle[oa + j]) * k;
		} else {
			const bind = W.bind;
			for (let j = 0; j < n; j += 1) out[j] = bind[j] + (idle[oa + j] + (idle[ob + j] - idle[oa + j]) * k - bind[j]) * settle;
		}
		if (flareFrame < 0) return;
		const last = this.flareFrames - 1;
		const g = flareFrame > last ? last : flareFrame;
		const ga = Math.floor(g);
		const gk = g - ga;
		const fa = ga * W.nv;
		const fb = (ga < last ? ga + 1 : last) * W.nv;
		const flare = W.flare;
		const px = W.pivotX;
		const py = W.pivotY;
		for (let v = 0; v < W.nv; v += 1) {
			const theta = flare[fa + v] + (flare[fb + v] - flare[fa + v]) * gk;
			if (theta === 0) continue; // the knuckle spikes and the root bones do not turn
			const c = Math.cos(theta);
			const s = Math.sin(theta);
			const ax = out[v * 2] - px;
			const ay = out[v * 2 + 1] - py;
			out[v * 2] = px + c * ax - s * ay;
			out[v * 2 + 1] = py + s * ax + c * ay;
		}
	}
}
