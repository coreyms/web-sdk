// Whole-screen kick: nudges the Pixi stage root for a few frames (decaying two-axis wobble) so
// everything on the canvas — plate, board, backdrop, ambient layers — jolts together. Driven from
// the app ticker, restores the stage to exactly where it was, and a new kick during an old one
// simply restarts the wobble at the new amplitude. Transform-only (house rule: no filters).
import type { Application } from 'pixi.js';

const DUR = 220;
let active: { app: Application; t0: number; amp: number; baseX: number; baseY: number; tick: () => void } | null = null;

export const screenKick = (app: Application | undefined, amp: number) => {
	if (!app?.stage || !app.ticker) return;
	if (active && active.app === app) {
		active.t0 = performance.now();
		active.amp = amp;
		return;
	}
	const baseX = app.stage.x;
	const baseY = app.stage.y;
	const tick = () => {
		if (!active) return;
		const q = (performance.now() - active.t0) / DUR;
		if (q >= 1) {
			app.stage.position.set(active.baseX, active.baseY);
			app.ticker.remove(active.tick);
			active = null;
			return;
		}
		const a = active.amp * (1 - q);
		app.stage.position.set(active.baseX + a * Math.sin(q * Math.PI * 3), active.baseY - a * Math.sin(q * Math.PI * 2.4));
	};
	active = { app, t0: performance.now(), amp, baseX, baseY, tick };
	app.ticker.add(tick);
};
