// THE BILLBOARD LOGO (scene pass 9; the LOCKED yellow billboard, tools/build_scene.py; constants LOGO_SIGN): the game's
// name on a roadside sign with two amber lamps, in place of the green name plate. Its own container over the road and
// the press screen (components/Board.svelte), so the reindeer passes behind it, in the road's px (it scales with the
// scene; its place per layout class is game/layoutSpec.ts logoBox).
//
// THE LAMPS: the base picture is the sign with both lamps dark (the locked art with only the lamps' amber glass darkened,
// by pixel work); each lamp's lit glass is a patch cut from the locked art, drawn over the base at the lamp's strength,
// with a soft glow disc added over it. So a lamp shows exactly the locked art when lit and the dark copy when dark, and
// a cross-fade between the two. One update per frame writes four alphas; no filter, no mask, no texture made per frame.
import * as PIXI from 'pixi.js';

import { LOGO_SIGN } from '../constants';
import { SCENE_ART } from '../sceneArtSpec';

const ART = SCENE_ART.logoSign;
type Side = 'left' | 'right';

/** smooth 0..1 */
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** a lamp's strength at `ms` since the sign appeared (constants LOGO_SIGN.lamps): dark, on one after the other, both
 *  held lit, then the blink */
export const lampLevel = (side: Side, ms: number): number => {
	const L = LOGO_SIGN.lamps;
	const fade = Math.max(1, L.fadeMs);
	const on = L.darkMs + (side === 'right' ? L.stepMs : 0);
	const blinkFrom = L.darkMs + L.stepMs + L.holdMs;
	let level: number;
	if (ms < blinkFrom) level = smooth((ms - on) / fade);
	else {
		// THE BLINK: each lamp lit for litShare of its period; the right lamp's cycle shifted by rightPhase. Both start
		// the blink lit (the cycle's lit part comes first), so the change from the hold is the first lamp going dark.
		const period = Math.max(2 * fade, L.periodMs);
		const shift = side === 'right' ? L.rightPhase * period : 0;
		const t = (((ms - blinkFrom - shift) % period) + period) % period;
		const litFor = Math.min(period - fade, Math.max(fade, L.litShare * period));
		// lit from 0, fading out over [litFor, litFor + fade], dark, fading in over [period - fade, period]
		if (t < litFor) level = 1;
		else if (t < litFor + fade) level = 1 - smooth((t - litFor) / fade);
		else if (t < period - fade) level = 0;
		else level = smooth((t - (period - fade)) / fade);
		// the right lamp's first shifted part of the blink: it stays lit until its own cycle starts
		if (ms - blinkFrom < shift) level = 1;
	}
	return L.darkFloor + (1 - L.darkFloor) * level;
};

export class LogoSign {
	/** in the road's px: components/Board.svelte gives it the road's transform */
	readonly root = new PIXI.Container();
	/** the sign itself, at its box inside the root */
	private readonly body = new PIXI.Container();
	private readonly base: PIXI.Sprite;
	private readonly lamps: { side: Side; lit: PIXI.Sprite; glow: PIXI.Sprite }[] = [];
	private readonly frames: PIXI.Texture[] = [];
	private ms = 0;
	/** DEV: the lamps' time held here (the captures of the dark and the lit sign), null = running */
	hold: number | null = null;
	/** the box it was last placed in, road px (the dev hook) */
	box = { x: 0, y: 0, width: 0, height: 0 };

	constructor(sheet: PIXI.Texture, tier: 'full' | 'phone') {
		this.root.eventMode = 'none';
		this.root.addChild(this.body);
		const T = ART.tiers[tier];
		const k = T.scale;
		const frame = (f: { x: number; y: number; width: number; height: number }) => {
			const t = new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(Math.round(f.x * k), Math.round(f.y * k), Math.round(f.width * k), Math.round(f.height * k)) });
			this.frames.push(t);
			return t;
		};
		this.base = new PIXI.Sprite(frame(ART.frames.base));
		this.body.addChild(this.base);
		const glowTex = frame(ART.frames.glow);
		for (const side of ['left', 'right'] as const) {
			const lit = new PIXI.Sprite(frame(ART.frames[`lamp_${side}`]));
			const glow = new PIXI.Sprite(glowTex);
			glow.anchor.set(0.5);
			glow.blendMode = 'add';
			glow.tint = LOGO_SIGN.lamps.glowTint;
			this.body.addChild(lit, glow);
			this.lamps.push({ side, lit, glow });
		}
		this.place({ x: 0, y: 0, width: ART.size[0], height: ART.size[1] });
		this.update(0);
	}

	/** put the sign in its box (road px; the box's aspect is the art's) */
	place(box: { x: number; y: number; width: number; height: number }) {
		this.box = box;
		const s = box.width / ART.size[0];
		this.body.position.set(box.x, box.y);
		// the sign's own px inside: every frame below is laid out in the clean art's px, scaled once here
		this.base.position.set(0, 0);
		this.base.width = ART.size[0] * s;
		this.base.height = ART.size[1] * s;
		for (const l of this.lamps) {
			const L = ART.lamps[l.side];
			l.lit.position.set(L.patch[0] * s, L.patch[1] * s);
			l.lit.width = L.patch[2] * s;
			l.lit.height = L.patch[3] * s;
			const d = L.radius * 2 * (LOGO_SIGN.lamps.glowSize / 2) * s;
			l.glow.position.set(L.center[0] * s, L.center[1] * s);
			l.glow.width = d;
			l.glow.height = d;
		}
	}

	/** one frame: real ms since the last */
	update(deltaMs: number) {
		this.ms += deltaMs;
		const t = this.hold ?? this.ms;
		const G = LOGO_SIGN.lamps;
		for (const l of this.lamps) {
			const v = lampLevel(l.side, t);
			l.lit.alpha = v;
			l.lit.visible = v > 0.002;
			l.glow.alpha = v * G.glowAlpha;
			l.glow.visible = v > 0.002 && G.glowAlpha > 0;
			l.glow.tint = G.glowTint;
		}
	}

	levels() {
		const t = this.hold ?? this.ms;
		return { ms: Math.round(t), left: lampLevel('left', t), right: lampLevel('right', t) };
	}

	destroy() {
		this.root.destroy({ children: true });
		for (const f of this.frames) f.destroy();
	}
}
