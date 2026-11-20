// THE GRANDMA WILD'S WORD WILD, treatment B "Candy Cane" (Corey 2026-11-20, from the WILD word mock
// Desktop/Run Over Reindeer/wild_word_r1_2026-11-19, index.html treatment B; constants GRANDMA_BRAWL.word.candy).
// WILD in the multiplier's own candy lettering (tools/build_wild_word.py bakes the mock's recipe: Sigmar, the thick ink
// outline, the Reindeer set's red candy stripes), small and tilted into the top left corner of the cell, over the brawl
// clip and under the gold number. Its motion is the mock's, on the board clock:
//   LAND  its letters drop in like the number's (from 1.8x with a squash, 60 ms apart) when the car is covered
//   WIN   its letters hop as a wave on the number's beats
//   IDLE  a light sweeps across it every 3.4 s (each letter's white face silhouette, faded by its distance from the sweep)
// Sprites, transforms and alpha only: no filter, mask, shader or blend mode (the mock added its sweep; here the white
// silhouette is drawn with plain alpha). One small atlas per tier (wild/wild-word-<tier>.webp), loaded once through the
// column pictures' upload queue and kept. Never mirrored: it lives in the cell's root, which the clip's mirror never
// touches. Until its atlas is in, the Wild shows today's word (the symbols atlas' word_wild) instead.
import * as PIXI from 'pixi.js';

import { GRANDMA_BRAWL } from '../constants';
import { WILD_WORD_ART as ART } from '../wildWordSpec';
import { stamp } from '../assets';
import { PHONE_TIER } from '../deviceTier';
import { STAGING_TOOLS, perfMark } from '../staging';
import { queuePresentUpload } from './columnClips';

const TIER: 'full' | 'phone' = PHONE_TIER ? 'phone' : 'full';
const LETTERS = ['W', 'I', 'L', 'D'] as const;
type Ch = (typeof LETTERS)[number];

let textures: { face: Record<Ch, PIXI.Texture>; sheen: Record<Ch, PIXI.Texture> } | null = null;
let loading: Promise<boolean> | null = null;
let mb = 0;
/** a Wild is drawing today's word while it waits for this atlas */
let waiting = 0;

/** load the word's atlas (once; it stays for the session: about 1 MB on the desktop, 0.15 MB on a phone) */
export const loadWildWord = (): Promise<boolean> => {
	if (textures) return Promise.resolve(true);
	loading ??= (async () => {
		try {
			const t = ART.tiers[TIER];
			const base = (await PIXI.Assets.load(stamp(`/assets/${t.file}`))) as PIXI.Texture;
			await queuePresentUpload('wildword', 1, base, () => waiting > 0);
			const fr = t.frames as Record<string, readonly number[]>;
			const cut = (name: string) => new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(fr[name][0], fr[name][1], fr[name][2], fr[name][3]) });
			const face = {} as Record<Ch, PIXI.Texture>;
			const sheen = {} as Record<Ch, PIXI.Texture>;
			for (const c of LETTERS) {
				face[c] = cut(`candy_${c}`);
				sheen[c] = cut(`sheen_${c}`);
			}
			mb = (base.source.pixelWidth * base.source.pixelHeight * 4) / 1048576;
			textures = { face, sheen };
			if (STAGING_TOOLS) perfMark('load:wildword');
			return true;
		} catch (error) {
			// without it the Wild keeps today's word
			console.warn('[reindeer] the WILD word atlas failed to load', error);
			loading = null;
			return false;
		}
	})();
	return loading;
};

export const wildWordReady = () => !!textures;
export const wildWordMemory = () => ({ tier: TIER, loaded: !!textures, mb: Math.round(mb * 1000) / 1000, kb: ART.tiers[TIER].kb });

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const eIn = (u: number) => Math.pow(clamp(u, 0, 1), 2);
const bump = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));

/** the mock's appear (wildMult.ts APPEAR's shape): from 1.8x with alpha in, then a damped squash */
const appearK = (u: number) => {
	if (u < 0) return null;
	if (u < 0.55) {
		const s = lerp(1.8, 1, eIn(u / 0.55));
		return { sx: s, sy: s, a: clamp(u * 4, 0, 1) };
	}
	const w = (u - 0.55) / 0.45;
	const q = Math.exp(-w * 4) * Math.cos(w * 9);
	return { sx: 1 + 0.2 * q, sy: 1 - 0.2 * q, a: 1 };
};

/** ONE WILD'S WORD: four letter sprites and their four light silhouettes in one container */
export class WildWord {
	readonly root = new PIXI.Container();
	private readonly faces: PIXI.Sprite[] = [];
	private readonly sheens: PIXI.Sprite[] = [];
	private counted = false;
	/** what it drew last (probes): each letter's centre (cell road px, before the turn), scale against rest, alpha */
	last = { shown: false, alpha: 0, letters: [] as { ch: string; x: number; y: number; sx: number; sy: number; a: number; sheen: number }[], box: { x: 0, y: 0, w: 0, h: 0 } };
	constructor(private readonly seed: number) {
		for (let i = 0; i < 4; i++) {
			const f = new PIXI.Sprite();
			const s = new PIXI.Sprite();
			f.anchor.set(0.5);
			s.anchor.set(0.5);
			f.visible = s.visible = false;
			this.faces.push(f);
			this.sheens.push(s);
			this.root.addChild(f, s);
		}
		this.root.visible = false;
	}

	/** draw it for the cell's box (w, h road px) at board ms `clock`: `tl` ms since the car was covered in a landing
	 *  (null: standing), `tw` ms since its number's win began (null: none), `alpha` the whole word's (the win's fade).
	 *  False when its atlas is not in (the caller shows today's word). */
	draw(box: { w: number; h: number }, clock: number, tl: number | null, tw: number | null, alpha: number): boolean {
		if (!textures) {
			if (!this.counted) {
				this.counted = true;
				waiting += 1;
				void loadWildWord();
			}
			this.root.visible = false;
			this.last.shown = false;
			return false;
		}
		if (this.counted) {
			this.counted = false;
			waiting -= 1;
		}
		const C = GRANDMA_BRAWL.word.candy;
		// the mock's box is 248 x 176.5 road px; the game's cell box is its own (the clip's scale across, its height down)
		const kx = box.w / 248;
		const ky = box.h / 176.5;
		const k = (C.size * ART.mockCap) / ART.cap * kx;
		const L = ART.letters;
		let width = 0;
		for (const c of LETTERS) width += L[c].adv;
		const xs: number[] = [];
		let x = 0;
		for (const c of LETTERS) {
			xs.push((x + L[c].adv / 2 - width / 2) * k);
			x += L[c].adv;
		}
		this.root.position.set(C.x * kx, C.y * ky);
		this.root.rotation = (C.rot * Math.PI) / 180;
		this.root.alpha = alpha;
		// the sweep of light: across the word every everyMs, for 45% of it
		const ms = C.sheen.everyMs;
		const W = width * k;
		const ph = ((((clock + this.seed * 997) % ms) + ms) % ms) / (ms * 0.45);
		const sweep = ph < 1 ? -W / 2 - W * 0.45 + ph * W * 1.9 : Infinity;
		const H = C.hop;
		let shown = false;
		const rows = this.last.letters;
		rows.length = 0;
		LETTERS.forEach((c, q) => {
			const f = this.faces[q];
			const s = this.sheens[q];
			let sx = 1;
			let sy = 1;
			let a = 1;
			let dy = 0;
			if (tl !== null) {
				const ap = appearK((tl - q * C.letterMs) / C.dropMs);
				if (!ap) {
					f.visible = s.visible = false;
					rows.push({ ch: c, x: xs[q], y: 0, sx: 0, sy: 0, a: 0, sheen: 0 });
					return;
				}
				sx = ap.sx;
				sy = ap.sy;
				a = ap.a;
			}
			if (tw !== null) for (const b of H.beats) dy -= H.px * bump((tw - b - q * H.staggerMs) / H.ms);
			const ft = textures!.face[c];
			if (f.texture !== ft) f.texture = ft;
			f.position.set(xs[q], dy);
			f.scale.set((k * sx * L[c].w) / ft.frame.width, (k * sy * L[c].h) / ft.frame.height);
			f.alpha = a;
			f.visible = a > 0.002;
			const sa = C.sheen.alpha * clamp(1 - Math.abs(xs[q] - sweep) / Math.max(1, W * 0.45), 0, 1) * a;
			const st = textures!.sheen[c];
			if (s.texture !== st) s.texture = st;
			s.position.set(xs[q], dy);
			s.scale.set((k * sx * L[c].w) / st.frame.width, (k * sy * L[c].h) / st.frame.height);
			s.alpha = sa;
			s.visible = sa > 0.003;
			shown ||= f.visible;
			rows.push({ ch: c, x: Math.round(xs[q] * 100) / 100, y: Math.round(dy * 100) / 100, sx: Math.round(sx * 1000) / 1000, sy: Math.round(sy * 1000) / 1000, a: Math.round(a * 1000) / 1000, sheen: Math.round(sa * 1000) / 1000 });
		});
		this.root.visible = shown && alpha > 0;
		this.last.shown = this.root.visible;
		this.last.alpha = Math.round(alpha * 1000) / 1000;
		// its box at rest (cell road px, unturned): the word's width, a letter's height
		this.last.box = { x: Math.round((C.x * kx - W / 2) * 10) / 10, y: Math.round((C.y * ky - (k * L.W.h) / 2) * 10) / 10, w: Math.round(W * 10) / 10, h: Math.round(k * L.W.h * 10) / 10 };
		return true;
	}

	destroy() {
		if (this.counted) waiting -= 1;
		this.counted = false;
		this.root.destroy({ children: true });
	}
}
