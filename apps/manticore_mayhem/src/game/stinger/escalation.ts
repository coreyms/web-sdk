// THE PLAQUE'S TIER ESCALATION (bigwin-title r1, 2026-10-16; constants PLAQUE_ESCALATION): what happens AROUND the plaque
// so each win tier is a visible step up, not just a new word (design review 2026-10-15 item 3).
//   BIG    embers rise from below the plaque and up its sides
//   SUPER  + gold medallions thrown out from under it (a burst on the landing, then a trickle)
//   MEGA   + light rays fanned behind it, slowly turning
//   EPIC   + the rays turn fire, more of everything; the creature's roar and the Epic braziers are the component's
//          (components/StingerPlaque.svelte), on the same landing
// Two layers the view places in its own `placed` container (ship px, origin the panel centre): `back` under the plaque
// (the rays, and the coins, thrown out from behind its side pillars) and `front` over it (the embers, which rise up the
// pillars and beyond, never over the text panel).
// House rules: every sprite pooled and made at build, nothing allocated per frame, no filter, no mask; the textures are
// the plaque's own ember sprites, the board's W.png medallion and the tease's beam (all resident or made once); since
// 1.0.04 (Corey 2026-10-20) the coins draw the 3D medallion's frame for their turn (game/coinFlip.ts, constants
// COIN_FLIP) at full width once that sheet is in, the flat W.png with its cosine width until then.
import * as PIXI from 'pixi.js';

import { COIN_FLIP, PLAQUE_ESCALATION } from '../constants';
import { coinFlipFrame, coinFlipFrames } from '../coinFlip';
import { STAGING_TOOLS } from '../staging';

/** ?bwesc=0 on the dev server or a staging build: the escalation off (an A / B against the plaque as submitted) */
export const escalationOn = (): boolean => !(STAGING_TOOLS && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('bwesc') === '0');

const E = PLAQUE_ESCALATION;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const tierAt = <T>(list: readonly T[], tier: number): T => list[Math.max(0, Math.min(list.length - 1, tier))];

type Ember = { s: PIXI.Sprite; x: number; y: number; vy: number; phase: number; age: number; life: number; size: number; base: number };
type Coin = { s: PIXI.Sprite; x: number; y: number; vx: number; vy: number; turn: number; vturn: number; rot: number; vrot: number; age: number; size: number };

export class TierEscalation {
	readonly back = new PIXI.Container();
	readonly front = new PIXI.Container();
	private rays = new PIXI.Container();
	private emberLayer = new PIXI.Container();
	private coinLayer = new PIXI.Container();
	private embers: Ember[] = [];
	private coins: Coin[] = [];
	private rayAlpha = 0;
	/** -1 = off (the intro, or hidden) */
	private tier = -1;
	private rayT0 = 0;
	private emberDebt = 0;
	private coinDebt = 0;
	private coinTexW = 1;
	private coinFlat: PIXI.Texture = PIXI.Texture.EMPTY;
	/** DEV state: how many are alive, and the last tier landed */
	alive = { embers: 0, coins: 0, rays: 0 };
	/** DEV: the first live ember on the canvas [x, y, width, alpha, texture width] */
	sample: number[] = [];

	/** `emberTex` with each one's ship size (the plaque's own ember sprites); `coin` the medallion (null: no coins);
	 *  `beam` the ray wedge */
	build(emberTex: { texture: PIXI.Texture; base: number }[], coin: PIXI.Texture | null, beam: PIXI.Texture): void {
		this.back.eventMode = 'none';
		this.front.eventMode = 'none';
		const R = E.rays;
		for (let i = 0; i < R.count; i += 1) {
			const s = new PIXI.Sprite(beam);
			s.anchor.set(0.5, 0);
			s.blendMode = 'add';
			s.setSize(R.width, R.len);
			this.rays.addChild(s);
		}
		this.rays.visible = false;
		for (let i = 0; i < E.embers.pool; i += 1) {
			const k = emberTex.length ? emberTex[i % emberTex.length] : { texture: PIXI.Texture.EMPTY, base: 1 };
			const s = new PIXI.Sprite(k.texture);
			s.anchor.set(0.5);
			s.blendMode = 'add';
			s.visible = false;
			this.emberLayer.addChild(s);
			this.embers.push({ s, x: 0, y: 0, vy: 0, phase: 0, age: 0, life: 0, size: 1, base: k.base });
		}
		if (coin) {
			this.coinTexW = Math.max(1, coin.width);
			this.coinFlat = coin;
			for (let i = 0; i < E.coins.pool; i += 1) {
				const s = new PIXI.Sprite(coin);
				s.anchor.set(0.5);
				s.visible = false;
				this.coinLayer.addChild(s);
				this.coins.push({ s, x: 0, y: 0, vx: 0, vy: 0, turn: 0, vturn: 0, rot: 0, vrot: 0, age: -1, size: 1 });
			}
		}
		this.back.addChild(this.rays, this.coinLayer);
		this.front.addChild(this.emberLayer);
	}

	/** DEV: the first live coin [frame of the turning medallion (-1: the flat tile), drawn width, drawn height] */
	coinSample(): number[] {
		const c = this.coins.find((x) => x.age >= 0 && x.s.visible);
		if (!c) return [];
		const frames = coinFlipFrames();
		return [frames ? frames.indexOf(c.s.texture) : -1, Math.round(c.s.width), Math.round(c.s.height)];
	}

	/** a screen opens at `tier` (-1: none, the intro); `t` the plaque clock of its impact. Clears what was flying. */
	reset(tier: number, t: number): void {
		for (const e of this.embers) {
			e.life = 0;
			e.s.visible = false;
		}
		for (const c of this.coins) {
			c.age = -1;
			c.s.visible = false;
		}
		this.tier = tier;
		this.rayT0 = t;
		this.rayAlpha = 0;
		this.emberDebt = 0;
		this.coinDebt = 0;
		this.rays.rotation = Math.random() * Math.PI * 2;
		this.landAt = tier >= 0 ? t : Infinity;
	}

	/** a tier landing (the impact counts as Big's): the bursts at `t` */
	private landAt = Infinity;
	land(tier: number, t: number): void {
		const wasRays = tierAt(E.rays.alpha, this.tier) > 0;
		this.tier = tier;
		if (!wasRays && tierAt(E.rays.alpha, tier) > 0) this.rayT0 = t;
		this.landAt = t;
	}

	private spawnEmber(): void {
		const e = this.embers.find((x) => x.life <= 0 || x.age >= x.life);
		if (!e) return;
		const A = E.embers.area;
		e.x = (Math.random() < 0.5 ? -1 : 1) * rnd(A[0], A[1]);
		e.y = rnd(A[2], A[3]);
		e.vy = -rnd(E.embers.rise[0], E.embers.rise[1]);
		e.phase = Math.random() * Math.PI * 2;
		e.age = 0;
		e.life = rnd(E.embers.life[0], E.embers.life[1]);
		e.size = rnd(E.embers.size[0], E.embers.size[1]);
		e.s.tint = tierAt(E.embers.hot, this.tier);
	}

	private spawnCoin(): void {
		const c = this.coins.find((x) => x.age < 0);
		if (!c) return;
		const C = E.coins;
		const side = Math.random() < 0.5 ? -1 : 1;
		c.x = side * rnd(C.spawnX[0], C.spawnX[1]);
		c.y = rnd(C.spawnY[0], C.spawnY[1]);
		// leaning outward on its own side, between lean[0] and lean[1] radians off straight up
		const a = side * rnd(C.lean[0], C.lean[1]);
		const v = rnd(C.speed[0], C.speed[1]);
		c.vx = Math.sin(a) * v;
		c.vy = -Math.cos(a) * v;
		c.turn = Math.random();
		c.vturn = rnd(C.flip[0], C.flip[1]);
		c.rot = rnd(-0.4, 0.4);
		c.vrot = rnd(-1.5, 1.5);
		c.age = 0;
		c.size = rnd(C.size[0], C.size[1]);
	}

	/** move everything to plaque time `t` (dt seconds since the last call); `on` = the screen is up (not leaving) */
	update(t: number, dt: number, on: boolean): void {
		const tier = this.tier;
		if (tier < 0) {
			this.back.visible = this.front.visible = false;
			return;
		}
		this.back.visible = this.front.visible = true;
		// the landing's bursts
		if (t >= this.landAt) {
			this.landAt = Infinity;
			for (let i = 0; i < tierAt(E.embers.burst, tier); i += 1) this.spawnEmber();
			if (this.coins.length) for (let i = 0; i < tierAt(E.coins.burst, tier); i += 1) this.spawnCoin();
		}
		// the steady streams while the screen is up
		if (on && dt > 0) {
			this.emberDebt += tierAt(E.embers.rate, tier) * dt;
			while (this.emberDebt >= 1) {
				this.emberDebt -= 1;
				this.spawnEmber();
			}
			if (this.coins.length) {
				this.coinDebt += tierAt(E.coins.trickle, tier) * dt;
				while (this.coinDebt >= 1) {
					this.coinDebt -= 1;
					this.spawnCoin();
				}
			}
		}
		// rays
		const R = E.rays;
		const want = tierAt(R.alpha, tier);
		this.rays.visible = want > 0;
		let nr = 0;
		if (want > 0) {
			const u = Math.min(1, ((t - this.rayT0) * 1000) / R.inMs);
			this.rayAlpha = want * u * u * (3 - 2 * u);
			this.rays.rotation += R.spin * dt;
			const tint = tierAt(R.tint, tier);
			const kids = this.rays.children as PIXI.Sprite[];
			for (let i = 0; i < kids.length; i += 1) {
				const s = kids[i];
				s.rotation = (i / kids.length) * Math.PI * 2;
				s.alpha = this.rayAlpha * (i % 2 ? 0.7 : 1);
				s.tint = tint;
			}
			nr = kids.length;
		}
		// embers: rise, sway, flicker out
		let ne = 0;
		for (const e of this.embers) {
			if (e.life <= 0 || e.age >= e.life) {
				if (e.s.visible) e.s.visible = false;
				continue;
			}
			e.age += dt;
			const u = e.age / e.life;
			e.y += e.vy * dt;
			const s = e.s;
			s.visible = u < 1;
			if (!s.visible) continue;
			s.position.set(e.x + Math.sin(e.phase + e.age * 3.1) * E.embers.sway, e.y);
			s.scale.set(e.base * e.size * (1 - 0.35 * u));
			// in fast, held, out over the last third, with a flicker
			s.alpha = Math.min(1, u * 6) * Math.min(1, (1 - u) * 3) * (0.8 + 0.2 * Math.sin(e.phase * 3 + e.age * 17));
			ne += 1;
		}
		// coins: thrown, falling, turning
		const C = E.coins;
		const frames = coinFlipFrames();
		let nc = 0;
		for (const c of this.coins) {
			if (c.age < 0) continue;
			c.age += dt;
			c.vy += C.gravity * dt;
			c.x += c.vx * dt;
			c.y += c.vy * dt;
			c.turn += c.vturn * dt;
			c.rot += c.vrot * dt;
			if (c.y > C.killY || c.age > C.life) {
				c.age = -1;
				c.s.visible = false;
				continue;
			}
			const s = c.s;
			s.visible = true;
			s.position.set(c.x, c.y);
			s.rotation = c.rot;
			if (frames) {
				// the frame carries the turn: full width, the flat coin's size face on
				const f = coinFlipFrame(frames, c.turn);
				if (s.texture !== f) s.texture = f;
				s.setSize(c.size * COIN_FLIP.faceScale, c.size * COIN_FLIP.faceScale);
			} else {
				if (s.texture !== this.coinFlat) s.texture = this.coinFlat;
				const k = c.size / this.coinTexW;
				const flip = Math.max(C.minTurn, Math.abs(Math.cos(c.turn * Math.PI * 2)));
				s.scale.set(k * flip, k);
			}
			s.alpha = Math.min(1, (C.life - c.age) / C.fadeS);
			nc += 1;
		}
		this.alive.embers = ne;
		if (import.meta.env.DEV) {
			const e = this.embers.find((x) => x.s.visible);
			this.sample = e ? (() => { const b = e.s.getBounds(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Number(e.s.alpha.toFixed(2)), e.s.texture.width]; })() : [];
		}
		this.alive.coins = nc;
		this.alive.rays = nr;
	}
}
