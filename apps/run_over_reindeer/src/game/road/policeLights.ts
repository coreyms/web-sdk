// THE POLICE CAR'S LIGHT BAR (Corey 2026-11-15: "We should do the Police car light ups for when there is a win with
// them in code"; constants POLICE_LIGHTS, game/policeLightSpec.ts measured by tools/build_police_lights.py).
//
// While a line win that runs through a police car (H4) shows, its red and blue lenses flash in turn, in step with the
// police win sound (sfx_win_h4_police: two siren whoops, at 50 and 410 ms of its 680, so a lens every 180 ms from its
// first whoop: red with each whoop, blue between them, on for the whole win hold). A police car not in the win stays
// dark; every police car in the win flashes together, in phase (one clock: the win's).
//
// No new art and no new texture: each light is the stoplights' soft white blob (the symbol atlas's stoplight_glow),
// tinted, ADDED over the picture (a blend mode, as the stoplights' glow; no filter, shader or mask). Per lens three
// sprites: a hot core on the lens, a colored glow around it, and a faint wide spill on the roof and the road. They are
// made once per police car the first time it wins, kept with it, and only moved and faded after (no allocation per
// frame). They follow the car's win pulse (about its anchor, as the car) and are off on the very frame the win
// presentation ends or is cleared (the hold's end, a slam stop, a skip).
import * as PIXI from 'pixi.js';

import { POLICE_LIGHTS } from '../constants';
import { POLICE_LIGHTS as SPEC } from '../policeLightSpec';

export type LensColor = 'red' | 'blue';
const COLORS: LensColor[] = ['red', 'blue'];

type Lens = { core: PIXI.Sprite; glow: PIXI.Sprite; spill: PIXI.Sprite };

/** which lens is lit `ms` after the win showed, and how bright (0 to 1); null before the first whoop */
export const policeFlash = (ms: number): { color: LensColor; level: number } | null => {
	const P = POLICE_LIGHTS;
	const t = ms - P.onsetMs;
	if (t < 0) return null;
	const half = Math.max(1, P.halfMs);
	const n = Math.floor(t / half);
	const into = t - n * half;
	// a quick rise, then it eases down to (1 - fade) by the end of its turn: a strobe, not a square wave
	const rise = Math.min(1, into / Math.max(1, P.attackMs));
	const u = into / half;
	return { color: n % 2 === 0 ? 'red' : 'blue', level: rise * (1 - P.fade * u * u) };
};

/** one police car's light bar: three sprites per lens, in the road's police light layer */
export class PoliceLightBar {
	private readonly lens: Record<LensColor, Lens>;
	/** what it drew last (the probes): the lit lens and its core's alpha */
	lit: LensColor | null = null;
	level = 0;

	constructor(layer: PIXI.Container, glow: PIXI.Texture) {
		const make = () => {
			const s = new PIXI.Sprite(glow);
			s.anchor.set(0.5);
			s.blendMode = 'add';
			s.visible = false;
			s.label = 'policeLight';
			layer.addChild(s);
			return s;
		};
		this.lens = {
			red: { spill: make(), glow: make(), core: make() },
			blue: { spill: make(), glow: make(), core: make() },
		};
	}

	/** dark now */
	off() {
		if (this.lit === null && this.level === 0) return;
		for (const c of COLORS) for (const s of Object.values(this.lens[c])) s.visible = false;
		this.lit = null;
		this.level = 0;
	}

	/** draw it for a police car (frame H4_R or H4_L) whose anchor is at (x, y), `k` road px per built road px (its win
	 *  pulse and its size), `ms` since the win showed */
	draw(frame: string, x: number, y: number, k: number, ms: number) {
		const P = POLICE_LIGHTS;
		const at = (SPEC.frames as Record<string, Record<LensColor, { x: number; y: number; w: number; h: number }>>)[frame];
		const f = P.on ? policeFlash(ms) : null;
		if (!at || !f || f.level <= 0.002) {
			this.off();
			return;
		}
		for (const c of COLORS) {
			const L = this.lens[c];
			const on = c === f.color;
			for (const s of [L.core, L.glow, L.spill]) s.visible = on;
			if (!on) continue;
			const p = at[c];
			const cx = x + p.x * k;
			const cy = y + p.y * k;
			const size = (s: PIXI.Sprite, w: number, h: number, tint: number, alpha: number) => {
				s.position.set(cx, cy);
				s.width = w;
				s.height = h;
				if (s.tint !== tint) s.tint = tint;
				s.alpha = alpha;
			};
			size(L.core, p.w * P.core.size * k, p.h * P.core.size * k, P.core.tint[c], P.core.alpha * f.level);
			size(L.glow, P.glow.size * k, P.glow.size * P.glow.squash * k, P.tint[c], P.glow.alpha * f.level);
			size(L.spill, P.spill.size * k, P.spill.size * P.spill.squash * k, P.tint[c], P.spill.alpha * f.level);
		}
		this.lit = f.color;
		this.level = f.level;
	}

	destroy() {
		for (const c of COLORS) for (const s of Object.values(this.lens[c])) s.destroy();
	}
}
