// THE BRAKE LIGHTS (Corey 2026-11-16: "we need to give the different cars brake lights in code when they are slowing
// down and stopped"; constants BRAKE_LIGHTS, game/brakeLightSpec.ts measured by tools/build_brake_lights.py).
//
// Each of the four cars (H1 Grandma's car, H2 the wagon, H3 the van, H4 the police car; never the sleigh or a sign)
// lights its two rear lamps: BRIGHT while it brakes into its spot, DIM while it stands (the rock back, at rest), OFF
// while it cruises in and while it pulls away. No new art: each lamp is the stoplights' soft white blob (the symbol
// atlas's stoplight_glow), tinted and ADDED (a blend mode, no filter, shader or mask), a wide glow and a small hot core.
// Four sprites a car, made the first time its slot shows a car and kept with the slot (no allocation per frame), in
// the road's brake light layer over the lanes (one batch for every car). Each frame they take the car's place, its
// dive (the rotation about its anchor), its win pulse (its scale), its brightness (the tunnel's shade, the win's dim,
// the crosshair's fade: the sprite's tint) and its visibility (a tunnel, a cloud, a column, struck, retired).
import * as PIXI from 'pixi.js';

import { BRAKE_LIGHTS } from '../constants';
import { BRAKE_LAMPS } from '../brakeLightSpec';

export type BrakeState = 'off' | 'brake' | 'stopped';
type Lamp = { x: number; y: number; w: number; h: number; measured: boolean };

export class BrakeLightPair {
	private readonly sprites: { glow: PIXI.Sprite; core: PIXI.Sprite }[] = [];
	/** the level drawn (0 off, 1 full), eased toward the state's level */
	level = 0;
	state: BrakeState = 'off';
	/** what it drew last (the probes): shown, and the lamps' centres in road px */
	shown = false;
	at: { x: number; y: number }[] = [];

	constructor(layer: PIXI.Container, glow: PIXI.Texture) {
		for (let i = 0; i < 2; i++) {
			const make = (label: string) => {
				const s = new PIXI.Sprite(glow);
				s.anchor.set(0.5);
				s.blendMode = 'add';
				s.visible = false;
				s.label = label;
				layer.addChild(s);
				return s;
			};
			this.sprites.push({ glow: make('brakeGlow'), core: make('brakeCore') });
		}
	}

	/** dark now, at once (the slot was freed or changed car) */
	off() {
		this.level = 0;
		this.state = 'off';
		this.hide();
	}

	private hide() {
		if (!this.shown) return;
		for (const s of this.sprites) s.glow.visible = s.core.visible = false;
		this.shown = false;
	}

	/** draw it for the car sprite `s` (frame H1_R .. H4_L), `k` road px per built road px, `bright` the car's own
	 *  brightness (0..1), `state` what it is doing, `dtMs` real ms since the last frame */
	draw(s: PIXI.Sprite, frame: string, k: number, bright: number, state: BrakeState, dtMs: number) {
		const B = BRAKE_LIGHTS;
		this.state = state;
		const want = !B.on ? 0 : state === 'brake' ? B.brake : state === 'stopped' ? B.stopped : 0;
		if (want > this.level) this.level = Math.min(want, this.level + dtMs / Math.max(1, B.attackMs));
		else if (want < this.level) this.level = Math.max(want, this.level - dtMs / Math.max(1, B.releaseMs));
		const lamps = (BRAKE_LAMPS as unknown as Record<string, { near: Lamp; far: Lamp }>)[frame];
		const a = this.level * bright;
		if (!lamps || !s.visible || !s.renderable || a <= 0.004) {
			this.hide();
			this.at = [];
			return;
		}
		const cos = Math.cos(s.rotation);
		const sin = Math.sin(s.rotation);
		this.at = [];
		[lamps.near, lamps.far].forEach((p, i) => {
			const sp = this.sprites[i];
			const x = s.x + (p.x * cos - p.y * sin) * k;
			const y = s.y + (p.x * sin + p.y * cos) * k;
			this.at.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
			// the far lamp is the smaller, fainter one (it is farther away, or only peeking)
			const share = i === 0 ? 1 : 0.7;
			const gw = B.glow.size * share * k;
			sp.glow.position.set(x, y);
			sp.glow.width = gw;
			sp.glow.height = gw * B.glow.squash;
			sp.glow.rotation = s.rotation;
			if (sp.glow.tint !== B.tint) sp.glow.tint = B.tint;
			sp.glow.alpha = a * share;
			const cw = Math.max(B.core.size * share, Math.max(p.w, p.h) * 1.4) * k;
			sp.core.position.set(x, y);
			sp.core.width = cw * Math.min(1, Math.max(0.45, p.w / Math.max(1, p.h)) + 0.25);
			sp.core.height = cw;
			sp.core.rotation = s.rotation;
			if (sp.core.tint !== B.coreTint) sp.core.tint = B.coreTint;
			sp.core.alpha = Math.min(1, a * share * 1.1);
			sp.glow.visible = sp.core.visible = true;
		});
		this.shown = true;
	}

	destroy() {
		for (const s of this.sprites) {
			s.glow.destroy();
			s.core.destroy();
		}
	}
}
