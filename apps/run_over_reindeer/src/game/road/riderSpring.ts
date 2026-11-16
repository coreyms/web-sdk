// THE RIDERS' SPRING (the wagon's tree, game/road/wagonTree.ts; the seated drivers, game/road/seated.ts): one damped
// spring pulled toward a target that follows the vehicle's own forward acceleration. Stepped on the board's clock in
// small steps (at most STEP_MS), so a long frame, turbo or a slam stop never makes it unstable, and the probes' stepped
// clock gives the same numbers as real time. No allocation per frame.

/** the longest single step, board ms (semi-implicit Euler stays stable and close to the art round's 1/960 s) */
export const STEP_MS = 2;

export type SpringTune = { freqHz: number; damping: number; gain: number; clamp: number };

export class RiderSpring {
	/** the value (road px, or degrees for a lean) and its rate per second */
	b = 0;
	v = 0;

	reset() {
		this.b = 0;
		this.v = 0;
	}

	/** advance by `dtMs` board ms toward clamp(accel x gain); accel in road px per s^2 */
	step(accel: number, dtMs: number, t: SpringTune) {
		const w = 2 * Math.PI * Math.max(0.01, t.freqHz);
		const target = Math.max(-t.clamp, Math.min(t.clamp, accel * t.gain));
		const dt = dtMs / 1000;
		const a = w * w * (target - this.b) - 2 * t.damping * w * this.v;
		this.v += a * dt;
		this.b += this.v * dt;
	}

	/** at rest (nothing worth drawing differently) */
	get still(): boolean {
		return Math.abs(this.b) < 0.002 && Math.abs(this.v) < 0.02;
	}
}
