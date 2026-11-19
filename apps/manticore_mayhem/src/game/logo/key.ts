// THE MULTIPLIER KEY (2026-11-18, constants LOGO_KEY; components/Logo.svelte owns it): the mock's V3 inside the logo
// frame's panel. One big square shows the highest multiplier live on the board (the cold cell when there is none), and
// beside it the climb in two rows (none, x2, x4, x8 over x16, x32, x64, x128): a value live on the board is lit, the
// others dim, x128 a step dimmer still where it cannot occur. No text.
// The squares are the board's own tiles, captured from the game (game/logo/key atlas: tools/build_key_atlas.py), never
// redrawn. Plain sprites, tints and alpha only; no filter, mask or shader.
// WHAT IT READS: setLive(counts, tileCap), the number of board cells on each value (Logo.svelte counts stateGame.tiles,
// the state the board draws its tiles from, whenever a value changes). Everything is built once per layout (layout());
// tick() allocates nothing and runs only while something moves.
import * as PIXI from 'pixi.js';

import { LOGO_KEY, MULT_PLATE } from '../constants';

/** the climb, in order: 0 = no multiplier (the cold cell) */
export const KEY_VALUES = [0, 2, 4, 8, 16, 32, 64, 128] as const;
const N = KEY_VALUES.length;
const indexOf = (v: number) => {
	for (let i = 0; i < N; i += 1) if (KEY_VALUES[i] === v) return i;
	return -1;
};

type Square = { root: PIXI.Container; art: PIXI.Sprite; flash: PIXI.Sprite; x: number; y: number; s: number; b: number; bTo: number; bFrom: number; bT: number; popT: number };

const grey = (b: number) => {
	const c = Math.max(0, Math.min(255, Math.round(b * 255)));
	return (c << 16) | (c << 8) | c;
};
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** the mock's pop: 1 -> popScale at 35 % -> 1 (cubic-bezier(.2, 1.6, .4, 1) in CSS, a quick rise and a settle) */
const popCurve = (t: number, peak: number) => (t < 0.35 ? 1 + (peak - 1) * easeOut(t / 0.35) : 1 + (peak - 1) * (1 - easeInOut((t - 0.35) / 0.65)));

export class MultiplierKey {
	readonly root = new PIXI.Container();
	private readonly squares: Square[] = [];
	private readonly hero: Square;
	private readonly ring = new PIXI.Graphics();
	private textures: PIXI.Texture[] = [];
	ready = false;
	/** reduced motion: no pop, punch, breathing or slide (the values still change at once) */
	private readonly still: boolean;

	// live state (no allocation per update: fixed arrays)
	private readonly counts = new Int16Array(N);
	private top = 0;
	private shownTop = 0;
	private cap = 64;
	// the big square's change: 0 none, 1 squeeze, 2 punch
	private heroPhase = 0;
	private heroT = 0;
	// the ring
	private ringT = 0;
	private ringFrom = { x: 0, y: 0, s: 0 };
	private ringTo = { x: 0, y: 0, s: 0 };
	private ringMoveT = 1;
	private ringPlaced = false;
	/** css px per root unit (the ring's minimum width is in CSS px) */
	private cssPerUnit = 1;
	// DEV / probe
	changes = 0;
	geo = { hero: { x: 0, y: 0, s: 0 }, squares: [] as { v: number; x: number; y: number; s: number }[], stacked: false };

	constructor(reducedMotion = false) {
		this.still = reducedMotion;
		this.root.label = 'logo-key';
		const square = (): Square => {
			const root = new PIXI.Container();
			const art = new PIXI.Sprite(PIXI.Texture.EMPTY);
			art.anchor.set(0.5);
			const flash = new PIXI.Sprite(PIXI.Texture.WHITE);
			flash.anchor.set(0.5);
			flash.alpha = 0;
			flash.visible = false;
			root.addChild(art, flash);
			return { root, art, flash, x: 0, y: 0, s: 0, b: LOGO_KEY.unlit, bTo: LOGO_KEY.unlit, bFrom: LOGO_KEY.unlit, bT: 1, popT: 1 };
		};
		for (let i = 0; i < N; i += 1) {
			const q = square();
			q.root.label = `logo-key-${KEY_VALUES[i]}`;
			this.squares.push(q);
			this.root.addChild(q.root);
		}
		this.ring.label = 'logo-key-ring';
		this.root.addChild(this.ring);
		this.hero = square();
		this.hero.root.label = 'logo-key-hero';
		this.hero.b = this.hero.bTo = 1;
		this.root.addChild(this.hero.root);
	}

	/** the atlas's frames by value (key 'none', 'x2' ... 'x128') */
	build(frames: Record<string, PIXI.Texture>): void {
		this.textures = KEY_VALUES.map((v) => frames[v ? `x${v}` : 'none'] ?? PIXI.Texture.EMPTY);
		for (let i = 0; i < N; i += 1) this.squares[i].art.texture = this.textures[i];
		this.hero.art.texture = this.textures[indexOf(this.top)];
		this.shownTop = this.top;
		this.ready = true;
		this.applyBrightness(true);
	}

	/** lay the key out on the frame: W x H the frame in root units (its own px), `cssPerUnit` CSS px per unit. The squares'
	 *  rectangles are the art's own (constants LOGO_KEY.big / climb / climbSize, fractions of the frame) */
	layout(W: number, H: number, cssPerUnit: number): void {
		this.cssPerUnit = cssPerUnit;
		const K = LOGO_KEY;
		const put = (q: Square, x: number, y: number, s: number) => {
			q.x = x + s / 2;
			q.y = y + s / 2;
			q.s = s;
			q.root.position.set(q.x, q.y);
			q.art.setSize(s, s);
			q.flash.setSize(s, s);
		};
		// square: the art's rectangles are square on the frame (w x W = h x H)
		const cs = K.climbSize[0] * W;
		for (let i = 0; i < N; i += 1) put(this.squares[i], K.climb[i][0] * W, K.climb[i][1] * H, cs);
		put(this.hero, K.big[0] * W, K.big[1] * H, K.big[2] * W);
		const css = (v: number) => Math.round(v * cssPerUnit * 10) / 10;
		this.geo = { hero: { x: css(this.hero.x - this.hero.s / 2), y: css(this.hero.y - this.hero.s / 2), s: css(this.hero.s) }, squares: this.squares.map((q, i) => ({ v: KEY_VALUES[i], x: css(q.x - q.s / 2), y: css(q.y - q.s / 2), s: css(q.s) })), stacked: false };
		// the ring: drawn white once for the climb's square size, tinted the level colour
		const bw = Math.max(K.ringMinCss / cssPerUnit, cs * K.ringShare);
		this.ring.clear();
		this.ring.rect(-cs / 2, -cs / 2, cs, cs).fill({ color: 0xffffff, alpha: 1 });
		this.ring.rect(-cs / 2 + bw, -cs / 2 + bw, cs - 2 * bw, cs - 2 * bw).cut();
		this.ringPlaced = false;
		this.placeRing(true);
	}

	/** the board's live values: counts[i] = cells on KEY_VALUES[i] (counts[0] unused), and the session's ladder cap */
	setLive(counts: ArrayLike<number>, tileCap: number): void {
		let top = 0;
		for (let i = 1; i < N; i += 1) {
			const c = counts[i] | 0;
			// one more cell on a value: its square pops
			if (c > this.counts[i] && !this.still) this.squares[i].popT = 0;
			this.counts[i] = c;
			if (c > 0) top = KEY_VALUES[i];
		}
		this.counts[0] = top === 0 ? 1 : 0;
		this.cap = tileCap;
		this.applyBrightness(false);
		if (top !== this.top) {
			this.top = top;
			this.changes += 1;
			if (this.still || !this.ready) {
				this.heroPhase = 0;
				this.swapHero();
				this.hero.root.scale.set(1);
			} else if (this.heroPhase !== 1) {
				// a squeeze on the value shown; a change during the squeeze just changes what lands at its floor
				this.heroPhase = 1;
				this.heroT = 0;
			}
			this.placeRing(false);
		}
	}

	private swapHero(): void {
		this.shownTop = this.top;
		this.hero.art.texture = this.textures[indexOf(this.top)] ?? PIXI.Texture.EMPTY;
	}

	private applyBrightness(instant: boolean): void {
		for (let i = 0; i < N; i += 1) {
			const q = this.squares[i];
			const lit = this.counts[i] > 0;
			const to = lit ? 1 : KEY_VALUES[i] === 128 && this.cap < 128 ? LOGO_KEY.locked : LOGO_KEY.unlit;
			if (instant || this.still) {
				q.b = q.bTo = q.bFrom = to;
				q.bT = 1;
				q.art.tint = grey(to);
			} else if (to !== q.bTo) {
				q.bFrom = q.b;
				q.bTo = to;
				q.bT = 0;
			}
		}
	}

	private placeRing(instant: boolean): void {
		const q = this.squares[indexOf(this.top)];
		if (!q) return;
		this.ring.tint = this.top ? (MULT_PLATE.colors[this.top] ?? 0xffffff) : 0xbfb6a8;
		this.ringTo = { x: q.x, y: q.y, s: q.s };
		if (instant || this.still || !this.ringPlaced) {
			this.ringFrom = { ...this.ringTo };
			this.ringMoveT = 1;
			this.ring.position.set(q.x, q.y);
			this.ringPlaced = true;
		} else {
			this.ringFrom = { x: this.ring.x, y: this.ring.y, s: q.s };
			this.ringMoveT = 0;
		}
	}

	/** every change lands on its end at once (the panel is on the LOGO: nothing of the key is seen, so nothing is left to
	 *  play when it comes back) */
	finish(): void {
		for (let i = 0; i < N; i += 1) {
			const q = this.squares[i];
			q.b = q.bFrom = q.bTo;
			q.bT = 1;
			q.art.tint = grey(q.b);
			q.popT = 1;
			q.root.scale.set(1);
			q.flash.visible = false;
		}
		if (this.heroPhase !== 0 || this.shownTop !== this.top) this.swapHero();
		this.heroPhase = 0;
		this.hero.root.scale.set(1);
		this.hero.flash.visible = false;
		this.ringMoveT = 1;
		this.ring.position.set(this.ringTo.x, this.ringTo.y);
	}

	/** one frame (ms); false when nothing but the breathing ring is moving */
	tick(dtMs: number): boolean {
		const K = LOGO_KEY;
		let busy = false;
		for (let i = 0; i < N; i += 1) {
			const q = this.squares[i];
			if (q.bT < 1) {
				q.bT = Math.min(1, q.bT + dtMs / K.dimMs);
				q.b = q.bFrom + (q.bTo - q.bFrom) * easeOut(q.bT);
				q.art.tint = grey(q.b);
				busy = true;
			}
			if (q.popT < 1) {
				q.popT = Math.min(1, q.popT + dtMs / K.popMs);
				q.root.scale.set(popCurve(q.popT, K.popScale));
				q.flash.visible = q.popT < 1;
				q.flash.alpha = K.flashFrom * (1 - easeOut(q.popT));
				busy = true;
			}
		}
		const h = this.hero;
		if (this.heroPhase === 1) {
			this.heroT = Math.min(1, this.heroT + dtMs / K.squeezeMs);
			const t = this.heroT * this.heroT;
			h.root.scale.set(1 + (K.squeezeTo - 1) * t);
			if (this.heroT >= 1) {
				this.swapHero();
				this.heroPhase = 2;
				this.heroT = 0;
			}
			busy = true;
		} else if (this.heroPhase === 2) {
			this.heroT = Math.min(1, this.heroT + dtMs / K.punchMs);
			const t = this.heroT;
			const p = K.punchPeakAt;
			const sc = t < p ? K.squeezeTo + (K.punchTo - K.squeezeTo) * easeOut(t / p) : K.punchTo + (1 - K.punchTo) * easeInOut((t - p) / (1 - p));
			h.root.scale.set(sc);
			h.flash.visible = t < 1;
			h.flash.alpha = K.flashFrom * (1 - easeOut(t));
			if (t >= 1) {
				this.heroPhase = 0;
				h.root.scale.set(1);
			}
			busy = true;
		}
		if (this.ringMoveT < 1) {
			this.ringMoveT = Math.min(1, this.ringMoveT + dtMs / K.ringMoveMs);
			const e = easeOut(this.ringMoveT);
			this.ring.position.set(this.ringFrom.x + (this.ringTo.x - this.ringFrom.x) * e, this.ringFrom.y + (this.ringTo.y - this.ringFrom.y) * e);
			busy = true;
		}
		if (!this.still) {
			this.ringT = (this.ringT + dtMs) % K.ringMs;
			this.ring.alpha = K.ringMin + (1 - K.ringMin) * (0.5 + 0.5 * Math.cos((this.ringT / K.ringMs) * Math.PI * 2));
		}
		return busy;
	}

	/** DEV / probe: what the key shows */
	state() {
		const lit: number[] = [];
		const dim: { v: number; b: number }[] = [];
		for (let i = 0; i < N; i += 1) {
			if (this.counts[i] > 0) lit.push(KEY_VALUES[i]);
			dim.push({ v: KEY_VALUES[i], b: Number(this.squares[i].bTo.toFixed(3)) });
		}
		return {
			ready: this.ready,
			lit,
			top: this.top,
			shown: this.shownTop,
			heroPhase: this.heroPhase,
			cap: this.cap,
			brightness: dim,
			changes: this.changes,
			ring: { x: this.ring.x, y: this.ring.y, tint: this.ring.tint as number, alpha: Number(this.ring.alpha.toFixed(3)) },
			geo: this.geo,
			cssPerUnit: this.cssPerUnit,
		};
	}

	destroy(): void {
		this.root.destroy({ children: true });
	}
}
