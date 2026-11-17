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
	private readonly sprites: { halo: PIXI.Sprite; glow: PIXI.Sprite; core: PIXI.Sprite }[] = [];
	/** the level drawn (0 off, 1 full), eased toward the state's level */
	level = 0;
	/** the halo's alpha drawn, eased toward the state's (BRAKE_LIGHTS.halo) */
	haloLevel = 0;
	state: BrakeState = 'off';
	/** what it drew last (the probes): shown, and the lamps' centres in road px */
	shown = false;
	at: { x: number; y: number }[] = [];

	/** `layer` over the lanes (the lamps, the near lamp's halo); `behind` under the lanes and over the cast shadows (the
	 *  far lamp's halo: the car's own body covers its forward half, so its edge stays soft everywhere) */
	constructor(layer: PIXI.Container, glow: PIXI.Texture, behind: PIXI.Container = layer) {
		for (let i = 0; i < 2; i++) {
			const make = (label: string, into = layer) => {
				const s = new PIXI.Sprite(glow);
				s.anchor.set(0.5);
				s.blendMode = 'add';
				s.visible = false;
				s.label = label;
				into.addChild(s);
				return s;
			};
			// the halo first: behind its lamp's glow (BRAKE_LIGHTS.halo); the far lamp's under the car
			this.sprites.push({ halo: make('brakeHalo', i === 1 ? behind : layer), glow: make('brakeGlow'), core: make('brakeCore') });
		}
	}

	/** dark now, at once (the slot was freed or changed car) */
	off() {
		this.level = 0;
		this.haloLevel = 0;
		this.state = 'off';
		this.hide();
	}

	private hide() {
		if (!this.shown) return;
		for (const s of this.sprites) s.halo.visible = s.glow.visible = s.core.visible = false;
		this.shown = false;
	}

	/** draw it for the car sprite `s` (frame H1_R .. H4_L), `k` road px per built road px, `bright` the car's own
	 *  brightness (0..1), `state` what it is doing, `dtMs` real ms since the last frame. Corey's tuned model (pass 8,
	 *  brake_light_halo_mock_2026-11-16.html): per lamp a halo blob, the lamp glow and a hot core, all added; the lamp is
	 *  as bright braking as stopped (BRAKE_LIGHTS brake / stopped), the halo is what changes (halo.brake / halo.stopped);
	 *  the far lamp at farShare of the near one's strength, moved by farOffset, its halo on the layer under the car (Corey:
	 *  "the other half of the halo should still exist, but be placed behind the car image, or we get a hard line") */
	draw(s: PIXI.Sprite, frame: string, k: number, bright: number, state: BrakeState, dtMs: number) {
		const B = BRAKE_LIGHTS;
		const H = B.halo;
		this.state = state;
		const ease = (from: number, to: number) => (to > from ? Math.min(to, from + dtMs / Math.max(1, B.attackMs)) : Math.max(to, from - dtMs / Math.max(1, B.releaseMs)));
		this.level = ease(this.level, !B.on ? 0 : state === 'brake' ? B.brake : state === 'stopped' ? B.stopped : 0);
		this.haloLevel = ease(this.haloLevel, !B.on ? 0 : state === 'brake' ? H.brake : state === 'stopped' ? H.stopped : 0);
		const lamps = (BRAKE_LAMPS as unknown as Record<string, { near: Lamp; far: Lamp }>)[frame];
		const a = this.level * bright;
		const hA = this.haloLevel * bright;
		if (!lamps || !s.visible || !s.renderable || (a <= 0.004 && hA <= 0.004)) {
			this.hide();
			this.at = [];
			return;
		}
		// the far lamp's move (Corey's, road px, for the right-facing frame; x mirrored for the left-facing one)
		const off = (B.farOffset as Record<string, readonly [number, number]>)[frame.slice(0, 2)] ?? [0, 0];
		const mirror = frame.endsWith('_L') ? -1 : 1;
		const cos = Math.cos(s.rotation);
		const sin = Math.sin(s.rotation);
		this.at = [];
		[lamps.near, lamps.far].forEach((p, i) => {
			const sp = this.sprites[i];
			const px = i === 0 ? p.x : p.x + off[0] * mirror;
			const py = i === 0 ? p.y : p.y + off[1];
			const x = s.x + (px * cos - py * sin) * k;
			const y = s.y + (px * sin + py * cos) * k;
			this.at.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
			const share = i === 0 ? 1 : B.farShare;
			const gw = B.glow.size * k;
			sp.glow.position.set(x, y);
			sp.glow.width = gw;
			sp.glow.height = gw * B.glow.squash;
			sp.glow.rotation = s.rotation;
			if (sp.glow.tint !== B.tint) sp.glow.tint = B.tint;
			sp.glow.alpha = a * share;
			const cw = B.core.size * k;
			sp.core.position.set(x, y);
			sp.core.width = sp.core.height = cw;
			sp.core.rotation = s.rotation;
			if (sp.core.tint !== B.coreTint) sp.core.tint = B.coreTint;
			sp.core.alpha = a * share;
			// the halo: a full round blob on both lamps (the far lamp's sits under the car: see the constructor)
			const hw = H.size * k;
			sp.halo.width = hw;
			sp.halo.position.set(x, y);
			sp.halo.height = hw * H.squash;
			sp.halo.rotation = s.rotation;
			if (sp.halo.tint !== B.tint) sp.halo.tint = B.tint;
			sp.halo.alpha = hA * share;
			sp.halo.visible = hA * share > 0.004;
			sp.glow.visible = sp.core.visible = a * share > 0.004;
		});
		this.shown = true;
	}

	destroy() {
		for (const s of this.sprites) {
			s.halo.destroy();
			s.glow.destroy();
			s.core.destroy();
		}
	}
}
