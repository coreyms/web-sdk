// THE VAN'S WIN (Corey 2026-11-15; constants VAN_WIN, game/vanWinSpec.ts measured by tools/build_van_win.py).
// While a line win through the van (H3) shows:
//   1. THE LURCH AND THE BACKFIRE (the first lurchMs, the length of sfx_win_h3_van's body: its 300 ms engine burst):
//      the van jolts forward and squats, its nose lifting about the rear wheel's contact and settling back with one
//      bounce (a damped spring), and the exhaust (the rear bumper's lower corner: no tail pipe is drawn) coughs a few
//      smoke puffs (VAN_WIN.puffs: three since 2026-11-19) that drift up and back, grow and fade.
//   2. THE ROCKING AND THE FLASHLIGHT (from then to the end of the win): the body sways on its springs (a lean by skew
//      and a small bounce by its height, both about its wheel line, so the wheels stay on the road) as if someone moves
//      about inside, and a warm flashlight beam sweeps behind the two dark windows and flickers. The beam is a row of
//      small glows, one per measured slot along each window, each no wider than the glass is deep there: so it shows
//      only on the glass, with no mask.
// A van not in the win does nothing. Everything is off, and the van back on its mark and upright, on the frame the win
// presentation ends or is cleared (the hold's end, a slam stop, a skip).
// Plain sprites: the stoplights' soft blob (the symbol atlas's stoplight_glow), tinted warm and ADDED (a blend mode, as
// the stoplights' glow and the police lights; no filter, shader or mask), and one small puff texture (road/van-puff.webp,
// a few KB) with alpha and scale. Made once per van the first time it wins, kept with it; no allocation per frame.
import * as PIXI from 'pixi.js';

import { VAN_WIN } from '../constants';
import { VAN_WIN as SPEC } from '../vanWinSpec';

type Slot = { x: number; y: number; r: number };
type VanArt = { windows: { box: readonly number[]; slots: readonly Slot[] }[]; exhaust: { x: number; y: number }; rearWheel: { x: number; y: number }; rear: number };

/** a small deterministic noise in 0..1 for an integer step (the flicker; the probes replay it) */
const noise = (n: number) => {
	const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return s - Math.floor(s);
};

/** the van's body at `ms` into the win: the squat (radians, + = nose up), the jolt (road px, + = forward), the lean
 *  (skew, radians) and the bounce (its height's factor), and the beam (0 to 1 across the window slots, its level) */
export const vanMotion = (ms: number) => {
	const V = VAN_WIN;
	const out = { squat: 0, jolt: 0, lean: 0, bounce: 1, beam: 0, beamLevel: 0, phase: 'lurch' as 'lurch' | 'rock' };
	if (ms < 0) return out;
	// THE LURCH: a damped spring from the press of the throttle
	const t = ms;
	const spring = Math.exp(-t / Math.max(1, V.lurch.decayMs)) * Math.sin((2 * Math.PI * t) / Math.max(1, V.lurch.periodMs));
	out.squat = ((V.lurch.squatDeg * Math.PI) / 180) * spring;
	out.jolt = V.lurch.joltPx * spring;
	if (ms < V.lurchMs) return out;
	// THE ROCKING: two sines (not quite in step), coming in over rampMs
	out.phase = 'rock';
	const r = ms - V.lurchMs;
	const ramp = Math.min(1, r / Math.max(1, V.rock.rampMs));
	const P = Math.max(1, V.rock.periodMs);
	const lean = Math.sin((2 * Math.PI * r) / P) * 0.75 + Math.sin((2 * Math.PI * r) / (P * 0.43) + 1.1) * 0.25;
	out.lean = ((V.rock.leanDeg * Math.PI) / 180) * lean * ramp;
	out.bounce = 1 + V.rock.bounce * Math.sin((4 * Math.PI * r) / P + 0.6) * ramp;
	// THE BEAM: sweeping to and fro across the slots, flickering
	const sweep = 0.5 - 0.5 * Math.cos((2 * Math.PI * r) / Math.max(1, V.light.sweepMs));
	out.beam = sweep;
	const flick = 1 - V.light.flicker * noise(Math.floor(r / Math.max(1, V.light.flickerMs)));
	out.beamLevel = ramp * flick;
	return out;
};

export class VanWinFx {
	private readonly glows: PIXI.Sprite[] = [];
	private readonly puffs: PIXI.Sprite[] = [];
	/** the van is being moved (its transform must go back when it stops) */
	private moving = false;
	/** what it drew last (the probes) */
	last = { phase: 'off' as 'off' | 'lurch' | 'rock', squat: 0, lean: 0, bounce: 1, glowX: 0, glowAlpha: 0, puffAlpha: 0, glows: 0, puffs: 0, fit: true };

	constructor(layer: PIXI.Container, glow: PIXI.Texture, puff: PIXI.Texture | null) {
		const slots = (SPEC.frames.H3_R.windows as unknown as VanArt['windows']).reduce((n, w) => n + w.slots.length, 0);
		for (let i = 0; i < VAN_WIN.puffs.length; i++) {
			const s = new PIXI.Sprite(puff ?? PIXI.Texture.EMPTY);
			s.anchor.set(0.5);
			s.visible = false;
			s.label = 'vanFx';
			layer.addChild(s);
			this.puffs.push(s);
		}
		// (each slot's glow `layers` times: glows[i] draws slot i % slots)
		for (let i = 0; i < slots * Math.max(1, VAN_WIN.light.layers); i++) {
			const s = new PIXI.Sprite(glow);
			s.anchor.set(0.5);
			s.blendMode = 'add';
			s.visible = false;
			s.label = 'vanFx';
			layer.addChild(s);
			this.glows.push(s);
		}
	}

	/** everything off; the van back on its mark, upright (only when it was being moved) */
	off(sprite: PIXI.Sprite | null, x: number, y: number) {
		for (const s of this.glows) s.visible = false;
		for (const s of this.puffs) s.visible = false;
		if (this.moving && sprite && !sprite.destroyed) {
			sprite.rotation = 0;
			sprite.skew.set(0, 0);
			sprite.position.set(x, y);
		}
		this.moving = false;
		this.last.phase = 'off';
		this.last.glowAlpha = 0;
		this.last.puffAlpha = 0;
		this.last.glows = 0;
		this.last.puffs = 0;
	}

	/** the van `sprite` (frame H3_R or H3_L, on its mark at (x, y), `k` road px per built road px with its win pulse
	 *  already in its scale) at `ms` into the win */
	draw(sprite: PIXI.Sprite, frame: string, x: number, y: number, k: number, ms: number) {
		const art = (SPEC.frames as unknown as Record<string, VanArt>)[frame];
		if (!VAN_WIN.on || !art) {
			this.off(sprite, x, y);
			return;
		}
		const m = vanMotion(ms);
		const dir = -art.rear; // which way it faces: +1 drives right
		// THE BODY: the squat about the rear wheel's contact (nose up), the jolt forward, the lean and the bounce about
		// the wheel line (the anchor's row: the bottom of the tyres)
		const rot = -dir * m.squat;
		const px = art.rearWheel.x * k;
		const cos = Math.cos(rot);
		const sin = Math.sin(rot);
		const ox = x + px - px * cos + dir * m.jolt;
		const oy = y - px * sin;
		sprite.rotation = rot;
		sprite.skew.set(-dir * m.lean, 0);
		sprite.scale.y *= m.bounce;
		sprite.position.set(ox, oy);
		this.moving = true;
		// a point of the art (built road px from the anchor) where it is drawn now
		const sy = k * m.bounce;
		const a = cos * k;
		const b = sin * k;
		const c = -Math.sin(rot + dir * m.lean) * sy;
		const d = Math.cos(rot + dir * m.lean) * sy;
		const at = (lx: number, ly: number) => ({ x: ox + a * lx + c * ly, y: oy + b * lx + d * ly });

		// THE FLASHLIGHT: the slots of both windows, front to back in the order the beam sweeps
		const L = VAN_WIN.light;
		const slots: Slot[] = [];
		for (const w of art.windows) for (const s of w.slots) slots.push(s);
		slots.sort((p, q) => (p.x - q.x) * dir);
		let gx = 0;
		let ga = 0;
		let shown = 0;
		let fit = true;
		const layers = Math.max(1, Math.min(Math.round(this.glows.length / Math.max(1, slots.length)), VAN_WIN.light.layers));
		for (let gi = 0; gi < this.glows.length; gi++) {
			const g = this.glows[gi];
			const i = gi % Math.max(1, slots.length);
			const s = gi < slots.length * layers ? slots[i] : undefined;
			if (!s || m.phase !== 'rock' || m.beamLevel <= 0) {
				g.visible = false;
				continue;
			}
			const pos = slots.length > 1 ? i / (slots.length - 1) : 0.5;
			const level = Math.exp(-(((pos - m.beam) / Math.max(0.01, L.width)) ** 2)) * m.beamLevel;
			const alpha = L.alpha * level;
			g.visible = alpha > 0.004;
			if (!g.visible) continue;
			const p = at(s.x, s.y);
			g.position.set(p.x, p.y);
			// its visible light no wider than the glass is deep at this slot (2 r): it never reaches past the window's edge
			const size = 2 * s.r * L.fill * k;
			g.width = size;
			g.height = size;
			if (g.tint !== L.tint) g.tint = L.tint;
			g.alpha = alpha;
			shown += 1;
			// (the probes: never wider than the glass is deep at its slot, at the van's size now)
			// (the probes: its visible light, the blob's inner 80 percent, never wider than the glass is deep at its slot)
			if (size * 0.8 > 2 * s.r * k + 1e-6) fit = false;
			if (alpha > ga) {
				ga = alpha;
				gx = p.x;
			}
		}

		// THE BACKFIRE: each puff from the exhaust (where the body has it at its own start), drifting back and up
		const P = VAN_WIN.puff;
		let pa = 0;
		let puffs = 0;
		for (let i = 0; i < this.puffs.length; i++) {
			const s = this.puffs[i];
			const t = ms - VAN_WIN.puffs[i];
			if (t < 0 || t > P.lifeMs || s.texture === PIXI.Texture.EMPTY) {
				s.visible = false;
				continue;
			}
			const u = t / P.lifeMs;
			const e = at(art.exhaust.x, art.exhaust.y);
			const grow = P.from + (P.to - P.from) * (1 - (1 - u) * (1 - u));
			s.position.set(e.x - dir * (P.back * u + P.out) * k, e.y - P.rise * u * k);
			s.width = P.size * grow * k;
			s.height = P.size * grow * k;
			s.rotation = dir * u * 0.6;
			const alpha = P.alpha * Math.min(1, t / Math.max(1, P.inMs)) * (1 - u) ** 1.5;
			s.alpha = alpha;
			s.visible = alpha > 0.004;
			if (s.visible) puffs += 1;
			pa = Math.max(pa, alpha);
		}
		this.last = { phase: m.phase, squat: rot, lean: -dir * m.lean, bounce: m.bounce, glowX: Math.round(gx * 10) / 10, glowAlpha: Math.round(ga * 1000) / 1000, puffAlpha: Math.round(pa * 1000) / 1000, glows: shown, puffs, fit };
	}

	destroy() {
		for (const s of [...this.glows, ...this.puffs]) s.destroy();
	}
}
