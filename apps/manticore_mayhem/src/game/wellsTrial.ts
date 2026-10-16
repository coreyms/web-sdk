// THE WELLS TRIAL (wells_r1, 2026-10-16): DEV-ONLY mockups of a per-cell backing texture (constants WELLS_TRIAL).
//
// ?wells=A..F (or C2) puts one sprite per cell, from one shared atlas of four variants (tools/build_wells_trial.py),
// on each cell's whole box (symbolPlace.ts op.box: bar centre line to bar centre line) in the frame's plate slot,
// UNDER the multiplier tiles and the frame (so the lattice bars cover the texture's outer px), over the black
// backing. Each cell takes a variant and a turn from a fixed table (no two edge neighbours share a variant). The
// atlas is mipmapped (game/mipmaps.ts) once, before its first draw. No filter, no mask, nothing per frame: the
// sprites are placed on a layout change only.
// ?symfill=82 scales every symbol by 82 / WELLS_TRIAL.currentFillPct (SYMBOL_PLACE.global), read at boot.
// In a release build every entry point returns at once and the PNGs are never bundled (the glob below sits behind
// import.meta.env.DEV, which the build replaces with false, so the dynamic imports are dead code).
import * as PIXI from 'pixi.js';

import { CELL_COUNT, GRID, SYMBOL_PLACE, WELLS_TRIAL } from './constants';
import { PHONE_TIER } from './deviceTier';
import { enableMipmaps } from './mipmaps';
import type { Openings } from './symbolPlace';

const query = (key: string): string | null => {
	if (!import.meta.env.DEV || typeof window === 'undefined') return null;
	return new URLSearchParams(window.location.search).get(key);
};

const firstOption = (() => {
	if (!import.meta.env.DEV) return null;
	const v = query('wells');
	return v && WELLS_TRIAL.options[v.toUpperCase()] ? v.toUpperCase() : null;
})();

/** ?symfill: applied once at module load (before any symbol is placed) */
export const symFill = (() => {
	if (!import.meta.env.DEV) return null;
	const v = Number(query('symfill'));
	if (!v || v < WELLS_TRIAL.symFillMin || v > WELLS_TRIAL.symFillMax) return null;
	SYMBOL_PLACE.global = v / WELLS_TRIAL.currentFillPct;
	return v;
})();

/** per cell (reel * 8 + row): the variant (0..3) and the turn (0..7: bit 2 flips x, bits 0..1 quarter turns) */
const makeTable = () => {
	let s = WELLS_TRIAL.seed >>> 0;
	const rnd = () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const variant = new Uint8Array(CELL_COUNT);
	const turn = new Uint8Array(CELL_COUNT);
	for (let row = 0; row < GRID; row += 1) {
		for (let reel = 0; reel < GRID; reel += 1) {
			const i = reel * GRID + row;
			const left = reel > 0 ? variant[(reel - 1) * GRID + row] : -1;
			const up = row > 0 ? variant[i - 1] : -1;
			let v = Math.floor(rnd() * WELLS_TRIAL.variants);
			while (v === left || v === up) v = (v + 1) % WELLS_TRIAL.variants;
			variant[i] = v;
			turn[i] = Math.floor(rnd() * 8);
		}
	}
	return { variant, turn };
};

export type WellsTrial = {
	/** the option shown (null: none, the black backing alone) */
	option: () => string | null;
	/** switch option at run time (DEV hook); null hides the wells */
	set: (option: string | null) => Promise<void>;
	/** into the frame's plate slot, under everything else there (a no-op once in) */
	mount: (slot: PIXI.Container | null) => void;
	/** every well on its cell's box (a layout change) */
	place: (op: Openings) => void;
	/** per cell the dim of the symbol on it (1 = none): the well darkens with it (WELLS_TRIAL.dimWithBoard) */
	dim: (cover: Float32Array) => void;
	state: () => unknown;
};

/** null in a release build; in DEV always made (hidden until ?wells or the hook turns an option on) */
export const createWellsTrial = (renderer: () => PIXI.Renderer | undefined): WellsTrial | null => {
	if (!import.meta.env.DEV) return null;
	const table = makeTable();
	const urls = import.meta.glob('./wellsTrial/*.png', {
		query: '?url',
		import: 'default',
	}) as Record<string, () => Promise<string>>;
	const layer = new PIXI.Container({ label: 'wells-trial', visible: false });
	const sprites = Array.from({ length: CELL_COUNT }, () => {
		const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
		s.anchor.set(0.5);
		layer.addChild(s);
		return s;
	});
	const frames = new Map<string, PIXI.Texture[]>();
	let current: string | null = null;
	let lastOp: Openings | null = null;
	let atlasPx = 0;

	const load = async (option: string): Promise<PIXI.Texture[] | null> => {
		const hit = frames.get(option);
		if (hit) return hit;
		const file = `./wellsTrial/wells-${option}${PHONE_TIER ? '-half' : ''}.png`;
		const get = urls[file];
		if (!get) return null;
		const tex = (await PIXI.Assets.load(await get())) as PIXI.Texture;
		enableMipmaps(tex.source, renderer());
		const px = PHONE_TIER ? WELLS_TRIAL.cellPxPhone : WELLS_TRIAL.cellPx;
		atlasPx = tex.source.pixelWidth;
		const out = Array.from(
			{ length: WELLS_TRIAL.variants },
			(_, v) =>
				new PIXI.Texture({
					source: tex.source,
					frame: new PIXI.Rectangle((v % 2) * px, Math.floor(v / 2) * px, px, px),
				}),
		);
		frames.set(option, out);
		return out;
	};

	const place = (op: Openings) => {
		lastOp = op;
		if (!current) return;
		const anyTurn = WELLS_TRIAL.options[current]?.orient === 'any';
		const px = PHONE_TIER ? WELLS_TRIAL.cellPxPhone : WELLS_TRIAL.cellPx;
		const b = op.box;
		for (let i = 0; i < CELL_COUNT; i += 1) {
			const s = sprites[i];
			const k = i * 4;
			const w = b[k + 2] - b[k];
			const h = b[k + 3] - b[k + 1];
			const t = table.turn[i];
			const quarter = anyTurn ? t & 3 : 0;
			const flip = t & 4 ? -1 : 1;
			s.position.set((b[k] + b[k + 2]) / 2, (b[k + 1] + b[k + 3]) / 2);
			s.rotation = (quarter * Math.PI) / 2;
			// a quarter turn swaps which texture side lies along the box's width
			const odd = quarter % 2 === 1;
			s.scale.set((flip * (odd ? h : w)) / px, (odd ? w : h) / px);
		}
	};

	const set = async (option: string | null) => {
		const key = option ? option.toUpperCase() : null;
		if (!key || !WELLS_TRIAL.options[key]) {
			current = null;
			layer.visible = false;
			return;
		}
		const tex = await load(key);
		if (!tex) return;
		current = key;
		for (let i = 0; i < CELL_COUNT; i += 1) sprites[i].texture = tex[table.variant[i]];
		layer.visible = true;
		if (lastOp) place(lastOp);
	};

	if (firstOption) void set(firstOption);

	const dimOn = query('wellsdim') !== '0' && WELLS_TRIAL.dimWithBoard;
	const shownDim = new Float32Array(CELL_COUNT).fill(1);
	const dim = (cover: Float32Array) => {
		if (!current || !dimOn) return;
		for (let i = 0; i < CELL_COUNT; i += 1) {
			// in 1 / 64 steps, so a fade writes a tint only when it moves a step
			const d = Math.round(cover[i] * 64) / 64;
			if (d === shownDim[i]) continue;
			shownDim[i] = d;
			const c = Math.round(255 * d);
			sprites[i].tint = (c << 16) | (c << 8) | c;
		}
	};

	return {
		option: () => current,
		set,
		mount: (slot) => {
			if (slot && layer.parent !== slot) slot.addChildAt(layer, 0);
		},
		place,
		dim,
		state: () => ({
			dimWithBoard: dimOn,
			option: current,
			name: current ? WELLS_TRIAL.options[current].name : null,
			phoneTier: PHONE_TIER,
			atlasPx,
			/** resident GPU bytes of the one atlas, RGBA8 with its mip chain (x 4 / 3) */
			atlasMB: atlasPx ? Number(((atlasPx * atlasPx * 4 * 4) / 3 / 2 ** 20).toFixed(2)) : 0,
			symFill,
			global: SYMBOL_PLACE.global,
			variants: Array.from(table.variant),
			turns: Array.from(table.turn),
			layerIndex: layer.parent ? layer.parent.children.indexOf(layer) : -1,
			cell0: sprites[0].getBounds(),
		}),
	};
};
