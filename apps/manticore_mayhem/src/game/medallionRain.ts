// THE WILD MEDALLION RAIN (Corey 2026-10-15, "Wild Medallions"; constants MAX_WIN.rain), the max win screen's backdrop
// (components/MaxWinCinematic.svelte): the Wild's static tile, the gold Lion-Sun Medallion (`W.png` in the mmSymbols
// atlas, already resident for the board), falling behind the creature and the titles and turning over like thrown
// coins. Since 1.0.04 (Corey 2026-10-20, "can we use the model we are using for the coin in game so they aren't flat?")
// each one draws the 3D medallion's frame for its turn (game/coinFlip.ts, constants COIN_FLIP) at full width once that
// sheet is in; until then the flat tile, its width following the cosine of the turn (no filter, no mesh).
//
// The shape of Angry Mantis's TrayRain: ONE raw Pixi container, the whole pool made up front, one tick that moves it.
// Nothing is allocated per frame and nothing is added or removed mid beat; density is how many of the pool are live:
// sparse with the dim, a downpour on the MAX WIN slam, thinning with the track's fade so the screen is clear as the
// music ends. Positions are CANVAS px (the rain covers the whole canvas, past the master's box on a wide window);
// sizes and speeds are master px x the master's scale, so a phone and a desktop see the same rain.
import * as PIXI from 'pixi.js';

import { COIN_FLIP, MAX_WIN } from './constants';
import { coinFlipFrame, coinFlipFrames } from './coinFlip';
import type { LayoutKind } from './layoutSpec';

const R = MAX_WIN.rain;

type Medallion = { s: PIXI.Sprite; x: number; y: number; vy: number; w: number; turn: number; vturn: number; rot: number; vrot: number; a: number };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class MedallionRain {
	readonly root = new PIXI.Container();
	private pool: Medallion[] = [];
	private kind: LayoutKind = 'landscape';
	private width = 1;
	private height = 1;
	/** canvas px per master px */
	private scale = 1;
	private masterWidth = 1280;
	/** how many are on screen after the last tick */
	live = 0;

	constructor() {
		this.root.label = 'maxwin-rain';
		this.root.eventMode = 'none';
	}

	/** make the pool for this LayoutKind (once per kind: a change of kind rebuilds it, outside the beat) */
	private flat: PIXI.Texture = PIXI.Texture.EMPTY;

	build(texture: PIXI.Texture, kind: LayoutKind): void {
		this.flat = texture;
		if (this.pool.length && kind === this.kind) return;
		for (const child of this.root.removeChildren()) child.destroy();
		this.pool = [];
		this.kind = kind;
		const count = R.count[kind];
		for (let i = 0; i < count; i += 1) {
			const s = new PIXI.Sprite(texture);
			s.anchor.set(0.5);
			s.visible = false;
			this.root.addChild(s);
			const m: Medallion = { s, x: 0, y: 0, vy: 0, w: 0, turn: 0, vturn: 0, rot: 0, vrot: 0, a: 1 };
			// the first sparse share is already on the screen when the dim comes up; every later one falls in from above
			this.roll(m, i < Math.round(count * R.sparseShare));
			this.pool.push(m);
		}
	}

	/** the canvas and the master as they are now */
	place(width: number, height: number, masterScale: number, masterWidth: number): void {
		this.width = width;
		this.height = height;
		this.scale = masterScale;
		this.masterWidth = masterWidth;
	}

	/** re-roll one medallion above the top edge (`initial`: anywhere on the screen, for the first scatter) */
	private roll(m: Medallion, initial = false): void {
		const [lo, hi] = R.size[this.kind];
		const k = Math.random();
		const w = this.masterWidth * (lo + (hi - lo) * k) * this.scale;
		m.w = w;
		m.x = rnd(-w * 0.3, this.width + w * 0.3);
		m.y = initial ? rnd(-w, this.height) : rnd(-this.height * 0.5, -w);
		// a small one is further away: slower and dimmer
		m.vy = rnd(R.speed[0], R.speed[1]) * (0.45 + 0.55 * k) * this.scale;
		m.turn = Math.random();
		m.vturn = rnd(R.flip[0], R.flip[1]) * (Math.random() < 0.5 ? -1 : 1);
		m.rot = rnd(-0.6, 0.6);
		m.vrot = rnd(R.roll[0], R.roll[1]);
		m.a = R.alpha[0] + (R.alpha[1] - R.alpha[0]) * k;
	}

	/** the share of the pool live at `t` ms after the track started */
	static shareAt(t: number): number {
		if (t < R.sparseAt) return 0;
		if (t < R.downpourAt) return R.sparseShare + (R.fullShare - R.sparseShare) * ((t - R.sparseAt) / (R.downpourAt - R.sparseAt));
		if (t < R.holdUntil) return R.fullShare;
		return R.fullShare * Math.max(0, 1 - (t - R.holdUntil) / Math.max(1, R.emptyAt - R.holdUntil));
	}

	/** the whole rain's alpha at `t`: 1 until fadeFrom, 0 by fadeTo (the medallions still falling go with the music) */
	static fadeAt(t: number): number {
		return Math.max(0, Math.min(1, 1 - (t - R.fadeFrom) / Math.max(1, R.fadeTo - R.fadeFrom)));
	}

	/** one frame: `dtMs` since the last, `t` the screen's clock */
	tick(dtMs: number, t: number): void {
		const dt = Math.min(0.05, dtMs / 1000);
		if (MedallionRain.fadeAt(t) <= 0) {
			if (this.live) this.clear();
			return;
		}
		const want = Math.round(this.pool.length * MedallionRain.shareAt(t));
		// the turning medallion's frames once its sheet is in (game/coinFlip.ts), else the flat tile
		const frames = coinFlipFrames();
		let live = 0;
		for (let i = 0; i < this.pool.length; i += 1) {
			const m = this.pool[i];
			// a medallion that is falling finishes its fall when the share drops: the rain thins, nothing blinks out
			if (i >= want && (!m.s.visible || m.y - m.w > this.height)) {
				if (m.s.visible) {
					m.s.visible = false;
					this.roll(m);
				}
				continue;
			}
			if (!m.s.visible) m.s.visible = true;
			live += 1;
			m.y += m.vy * dt;
			m.turn += m.vturn * dt;
			m.rot += m.vrot * dt;
			if (m.y - m.w > this.height) this.roll(m);
			m.s.position.set(m.x, m.y);
			m.s.rotation = m.rot;
			if (frames) {
				// the frame carries the turn and its light: full width, scaled so it is the flat tile's size face on
				const f = coinFlipFrame(frames, m.turn);
				if (m.s.texture !== f) m.s.texture = f;
				m.s.setSize(m.w * COIN_FLIP.faceScale, m.w * COIN_FLIP.faceScale);
				m.s.alpha = m.a;
				continue;
			}
			if (m.s.texture !== this.flat) m.s.texture = this.flat;
			const c = Math.cos(m.turn * Math.PI * 2);
			// never quite edge on (a dark hairline reads as a scratch): the narrowest a coin turns is minTurn of its width
			m.s.setSize(m.w * Math.max(R.minTurn, Math.abs(c)), m.w);
			// the back of the coin reads a little darker as it turns away
			m.s.alpha = m.a * (0.78 + 0.22 * Math.abs(c));
		}
		this.live = live;
	}

	/** the screen's clock has jumped to `t` (the max win screen's early press, MaxWinCinematic): the share of the pool
	 *  live at `t` is put on the screen at once, scattered over it as the first sparse share is, so the rain is at its
	 *  density of that moment instead of falling in from the top */
	fill(t: number): void {
		const want = Math.round(this.pool.length * MedallionRain.shareAt(t));
		for (let i = 0; i < want; i += 1) {
			const m = this.pool[i];
			if (m.s.visible) continue;
			this.roll(m, true);
		}
	}

	/** DEV: the first live medallion [frame of the turning medallion (-1: the flat tile), drawn width, drawn height] */
	sample(): number[] {
		const m = this.pool.find((x) => x.s.visible);
		if (!m) return [];
		const frames = coinFlipFrames();
		return [frames ? frames.indexOf(m.s.texture) : -1, Math.round(m.s.width), Math.round(m.s.height)];
	}

	/** every medallion off and re-rolled (the screen is over) */
	clear(): void {
		const first = Math.round(this.pool.length * R.sparseShare);
		for (let i = 0; i < this.pool.length; i += 1) {
			this.pool[i].s.visible = false;
			this.roll(this.pool[i], i < first);
		}
		this.live = 0;
	}

	/** hand the texture back (the atlas the sprites read is never released here: it is the board's) */
	destroy(): void {
		for (const child of this.root.removeChildren()) child.destroy();
		this.pool = [];
	}
}
