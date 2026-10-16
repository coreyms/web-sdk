// THE WELLS TRIAL (wells_r1 + r2, 2026-10-16): DEV-ONLY mockups of a per-cell backing texture (constants WELLS_TRIAL)
// and, for option D, the REACTIVE VEINS (constants WELLS_FX).
//
// ?wells=A..F (C2, D1) puts one sprite per cell, from one shared atlas of four variants (tools/build_wells_trial.py),
// on each cell's whole box (symbolPlace.ts op.box: bar centre line to bar centre line) in the frame's plate slot,
// UNDER the multiplier tiles and the frame (so the lattice bars cover the texture's outer px), over the black
// backing. Each cell takes a variant and a turn from a fixed table (no two edge neighbours share a variant). The
// atlas is mipmapped (game/mipmaps.ts) once, before its first draw. No filter, no mask.
// THE GLOW (an option with a wells-<opt>-glow.png, D today): per cell one more sprite, the same variant and turn,
// additive, in its own layer OVER the multiplier tiles (a lit tile is nearly opaque: a glow under it would never
// show) and under the frame and the symbols. Only alpha, tint and visibility change, and only when they move.
// THE LIGHT: the wells take the scene's night / fire as one tint per sprite (with the win dim folded in).
// ?symfill=82 scales every symbol by 82 / WELLS_TRIAL.currentFillPct (SYMBOL_PLACE.global), read at boot.
// In a release build every entry point returns at once and the PNGs are never bundled (the glob below sits behind
// import.meta.env.DEV, which the build replaces with false, so the dynamic imports are dead code).
import * as PIXI from 'pixi.js';

import { CELL_COUNT, GRID, SYMBOL_PLACE, WELLS_FX, WELLS_TRIAL } from './constants';
import { PHONE_TIER } from './deviceTier';
import { enableMipmaps } from './mipmaps';
import { sceneLight } from './scene';
import { stingFx, swipeFx, type StingStrikeFx } from './featureFx';
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

/** per cell (reel * 8 + row): the variant (0..3), the turn (0..7: bit 2 flips x, bits 0..1 quarter turns) and the
 *  power shimmer's phase */
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
	// (drawn after the table, so r1's variants and turns are unchanged)
	const phase = new Float32Array(CELL_COUNT);
	for (let i = 0; i < CELL_COUNT; i += 1) phase[i] = rnd() * Math.PI * 2;
	return { variant, turn, phase };
};

/** what BoardCells hands the wells once a frame (plain reads of the game's state, nothing tracked) */
export type WellsFrame = {
	tiles: { value: number; chg: number; pop: number }[];
	cells: { reel: number; row: number; state: string; scaleX: number }[];
	/** per cell the dim of the symbol on it (1 = none) */
	cover: Float32Array;
	skipping: boolean;
	freegame: boolean;
	/** the turbo scale now (style ms per real ms) */
	rate: number;
};

type FlareKind = 'light' | 'double' | 'win' | 'swipe' | 'sting';
type Flare = {
	cell: number;
	t0: number;
	rate: number;
	peak: number;
	inMs: number;
	holdMs: number;
	outMs: number;
	tint: number;
	kind: FlareKind;
};

export type WellsTrial = {
	/** the option shown (null: none, the black backing alone) */
	option: () => string | null;
	/** switch option at run time (DEV hook); null hides the wells */
	set: (option: string | null) => Promise<void>;
	/** into the frame's plate slot: the wells under everything there, the glow over the tiles (a no-op once in) */
	mount: (slot: PIXI.Container | null) => void;
	/** every well on its cell's box (a layout change) */
	place: (op: Openings) => void;
	/** once a frame: the light, the dim, the triggers, the flares */
	tick: (now: number, f: WellsFrame) => void;
	/** DEV: a flare by hand (cell, kind, delay ms) */
	flare: (cell: number, kind: FlareKind, delayMs?: number) => void;
	state: () => unknown;
	/** DEV: the flares asked for since the last read (kind, cell, performance.now() of their start) */
	log: () => { kind: FlareKind; cell: number; at: number }[];
	/** DEV: the per-frame cost of tick (mean / worst ms since the last read) */
	cost: () => { mean: number; max: number; ticks: number; flares: number; peakFlares: number };
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** null in a release build; in DEV always made (hidden until ?wells or the hook turns an option on) */
export const createWellsTrial = (renderer: () => PIXI.Renderer | undefined): WellsTrial | null => {
	if (!import.meta.env.DEV) return null;
	const table = makeTable();
	const urls = import.meta.glob('./wellsTrial/*.png', {
		query: '?url',
		import: 'default',
	}) as Record<string, () => Promise<string>>;
	const layer = new PIXI.Container({ label: 'wells-trial', visible: false });
	const glowLayer = new PIXI.Container({ label: 'wells-glow', visible: false });
	const make = (into: PIXI.Container, add: boolean) =>
		Array.from({ length: CELL_COUNT }, () => {
			const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
			s.anchor.set(0.5);
			if (add) {
				s.blendMode = 'add';
				s.visible = false;
				s.alpha = 0;
			}
			into.addChild(s);
			return s;
		});
	const sprites = make(layer, false);
	const glows = make(glowLayer, true);
	const frames = new Map<
		string,
		{ well: PIXI.Texture[]; glow: PIXI.Texture[] | null; px: number[] }
	>();
	let current: string | null = null;
	let hasGlow = false;
	let lastOp: Openings | null = null;

	const atlas = async (file: string) => {
		const get = urls[file];
		if (!get) return null;
		const tex = (await PIXI.Assets.load(await get())) as PIXI.Texture;
		enableMipmaps(tex.source, renderer());
		const px = PHONE_TIER ? WELLS_TRIAL.cellPxPhone : WELLS_TRIAL.cellPx;
		return {
			px: tex.source.pixelWidth,
			frames: Array.from(
				{ length: WELLS_TRIAL.variants },
				(_, v) =>
					new PIXI.Texture({
						source: tex.source,
						frame: new PIXI.Rectangle((v % 2) * px, Math.floor(v / 2) * px, px, px),
					}),
			),
		};
	};
	const load = async (option: string) => {
		const hit = frames.get(option);
		if (hit) return hit;
		const half = PHONE_TIER ? '-half' : '';
		const well = await atlas(`./wellsTrial/wells-${option}${half}.png`);
		if (!well) return null;
		const glow = await atlas(`./wellsTrial/wells-${option}-glow${half}.png`);
		const out = { well: well.frames, glow: glow?.frames ?? null, px: [well.px, glow?.px ?? 0] };
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
			const k = i * 4;
			const w = b[k + 2] - b[k];
			const h = b[k + 3] - b[k + 1];
			const t = table.turn[i];
			const quarter = anyTurn ? t & 3 : 0;
			const flip = t & 4 ? -1 : 1;
			// a quarter turn swaps which texture side lies along the box's width
			const odd = quarter % 2 === 1;
			for (const s of [sprites[i], glows[i]]) {
				s.position.set((b[k] + b[k + 2]) / 2, (b[k + 1] + b[k + 3]) / 2);
				s.rotation = (quarter * Math.PI) / 2;
				s.scale.set((flip * (odd ? h : w)) / px, (odd ? w : h) / px);
			}
		}
	};

	let atlasPx = [0, 0];
	const set = async (option: string | null) => {
		const key = option ? option.toUpperCase() : null;
		if (!key || !WELLS_TRIAL.options[key]) {
			current = null;
			hasGlow = false;
			layer.visible = glowLayer.visible = false;
			clearFlares();
			return;
		}
		const tex = await load(key);
		if (!tex) return;
		current = key;
		hasGlow = !!tex.glow;
		atlasPx = tex.px;
		clearFlares();
		for (let i = 0; i < CELL_COUNT; i += 1) {
			sprites[i].texture = tex.well[table.variant[i]];
			if (tex.glow) glows[i].texture = tex.glow[table.variant[i]];
		}
		layer.visible = true;
		glowLayer.visible = hasGlow;
		if (lastOp) place(lastOp);
	};

	// ---- the light and the dim on the wells: one tint per sprite, written when it moves a step -------------------------
	const dimOn = query('wellsdim') !== '0' && WELLS_TRIAL.dimWithBoard;
	const shownTint = new Int32Array(CELL_COUNT).fill(0xffffff);
	const light = [1, 1, 1];
	const lightOf = () => {
		const L = sceneLight;
		const n = L.night;
		const f = L.fire * n;
		for (let c = 0; c < 3; c += 1) {
			const fore = c === 0 ? L.foreR : c === 1 ? L.foreG : L.foreB;
			light[c] = (1 + (WELLS_FX.night[c] - 1) * n) * fore * (1 + (WELLS_FX.fireWarm[c] - 1) * f);
		}
	};

	// ---- the flares: a fixed pool of plain objects ----------------------------------------------------------------------
	const pool: Flare[] = Array.from({ length: WELLS_FX.pool }, () => ({
		cell: 0,
		t0: 0,
		rate: 1,
		peak: 0,
		inMs: 0,
		holdMs: 0,
		outMs: 0,
		tint: 0,
		kind: 'light' as FlareKind,
	}));
	const live: Flare[] = [];
	const free: Flare[] = pool.slice();
	let peakFlares = 0;
	const fxLog: { kind: FlareKind; cell: number; at: number }[] = [];
	const add = (cell: number, kind: FlareKind, at: number, rate: number, peakScale = 1) => {
		if (!hasGlow || cell < 0 || cell >= CELL_COUNT) return;
		const spec = WELLS_FX[kind];
		// pool full: the one nearest its end makes room
		let f = free.pop();
		if (!f) {
			let worst = 0;
			for (let i = 1; i < live.length; i += 1) if (live[i].t0 < live[worst].t0) worst = i;
			f = live[worst];
			live.splice(worst, 1);
		}
		f.cell = cell;
		f.t0 = at;
		f.rate = Math.max(0.2, rate);
		f.peak = spec.peak * peakScale;
		f.inMs = spec.inMs;
		f.holdMs = spec.holdMs;
		f.outMs = spec.outMs;
		f.tint = WELLS_FX.tint[kind];
		f.kind = kind;
		live.push(f);
		if (live.length > peakFlares) peakFlares = live.length;
		// DEV capture log: when each kind of flare was asked for (probes and clip cuts read it)
		if (fxLog.length < 2000) fxLog.push({ kind, cell, at: Math.round(at) });
	};
	/** a flare's strength at `now` (0 before it starts), or -1 once it is over */
	/** every flare back to the pool, every glow hidden (an option change) */
	const clearFlares = () => {
		while (live.length) free.push(live.pop()!);
		for (const g of glows) {
			g.visible = false;
			g.alpha = 0;
		}
		shownAlpha.fill(0);
	};
	const level = (f: Flare, now: number) => {
		const el = (now - f.t0) * f.rate;
		if (el < 0) return 0;
		if (el < f.inMs) return f.peak * Math.sin((Math.PI / 2) * (el / f.inMs));
		const e2 = el - f.inMs - f.holdMs;
		if (e2 < 0) return f.peak;
		if (e2 >= f.outMs) return -1;
		return f.peak * Math.pow(1 - e2 / f.outMs, 1.6);
	};

	// ---- the triggers (all read from state the game already keeps) ------------------------------------------------------
	const lastValue = new Float64Array(CELL_COUNT);
	const winOn = new Uint8Array(CELL_COUNT);
	const started: number[] = [];
	const seenStrikes = new WeakSet<StingStrikeFx>();
	let swipeSerial = swipeFx.serial;
	const dist = new Int16Array(CELL_COUNT);
	const queue = new Int16Array(CELL_COUNT);
	const inSet = new Uint8Array(CELL_COUNT);

	const triggers = (now: number, F: WellsFrame) => {
		// 1. tiles: a value that changes WHILE its count-over / pop runs (a reveal's carried grid lands at rest: no flare)
		for (let i = 0; i < CELL_COUNT; i += 1) {
			const t = F.tiles[i];
			const v = t ? t.value : 0;
			if (v === lastValue[i]) continue;
			if (!F.skipping && v > lastValue[i] && (t.chg < 1 || t.pop < 1))
				add(i, lastValue[i] > 0 ? 'double' : 'light', now, F.rate);
			lastValue[i] = v;
		}
		// 2. wins: a winner whose pulse has just started (its cluster's readout): grouped by touching cells, each group a
		// ripple from its lowest cell outward
		started.length = 0;
		for (const c of F.cells) {
			const i = c.reel * GRID + c.row;
			if (i < 0 || i >= CELL_COUNT) continue;
			const on = c.state === 'win' && c.scaleX > 1.0005;
			if (on && !winOn[i]) started.push(i);
			if (c.state !== 'win') winOn[i] = 0;
			else if (on) winOn[i] = 1;
		}
		if (started.length && !F.skipping) {
			inSet.fill(0);
			for (const i of started) inSet[i] = 1;
			started.sort((a, b) => a - b);
			for (const origin of started) {
				if (inSet[origin] !== 1) continue;
				// breadth first over the started cells that touch
				let head = 0;
				let tail = 0;
				queue[tail++] = origin;
				dist[origin] = 0;
				inSet[origin] = 2;
				while (head < tail) {
					const i = queue[head++];
					add(i, 'win', now + (dist[i] * WELLS_FX.win.stepMs) / F.rate, F.rate);
					const r = i % GRID;
					const nb = [r > 0 ? i - 1 : -1, r < GRID - 1 ? i + 1 : -1, i - GRID, i + GRID];
					for (const j of nb) {
						if (j < 0 || j >= CELL_COUNT || inSet[j] !== 1) continue;
						inSet[j] = 2;
						dist[j] = dist[i] + 1;
						queue[tail++] = j;
					}
				}
			}
		}
		// 3. the swipe: its rows, right to left like the tears
		if (swipeFx.serial !== swipeSerial) {
			swipeSerial = swipeFx.serial;
			if (swipeFx.active && !F.skipping) {
				for (const row of swipeFx.rows) {
					for (let reel = 0; reel < GRID; reel += 1)
						add(
							reel * GRID + row,
							'swipe',
							now + (((GRID - 1 - reel) / (GRID - 1)) * WELLS_FX.swipe.sweepMs) / F.rate,
							F.rate,
						);
				}
			}
		}
		// 4. the sting: at the hit, the struck cell, then ring by ring outward (never a scatter sting)
		for (const s of stingFx.strikes) {
			if (seenStrikes.has(s)) continue;
			seenStrikes.add(s);
			if (s.kind === 'scatter' || F.skipping) continue;
			const hit = s.t0 + (s.hitAt * s.dur) / Math.max(s.rate, 0.2);
			const r0 = s.cell % GRID;
			const c0 = Math.floor(s.cell / GRID);
			const S = WELLS_FX.sting;
			for (let dc = -S.reach; dc <= S.reach; dc += 1) {
				for (let dr = -S.reach; dr <= S.reach; dr += 1) {
					const reel = c0 + dc;
					const row = r0 + dr;
					if (reel < 0 || reel >= GRID || row < 0 || row >= GRID) continue;
					const d = Math.max(Math.abs(dc), Math.abs(dr));
					add(
						reel * GRID + row,
						'sting',
						hit + (d * S.stepMs) / s.rate,
						s.rate,
						Math.pow(S.falloff, d),
					);
				}
			}
		}
	};

	// ---- the board power (free spins): the resting glow of every vein --------------------------------------------------
	let power = 0;
	let powerTarget = 0;
	let lastNow = 0;
	const tickPower = (now: number, F: WellsFrame) => {
		const P = WELLS_FX.power;
		let sum = 0;
		if (F.freegame) for (const t of F.tiles) sum += t ? t.value : 0;
		powerTarget =
			sum > 0
				? P.cap * clamp01(Math.log2(1 + sum / P.refValue) / Math.log2(1 + P.fullValue / P.refValue))
				: 0;
		const dt = lastNow ? Math.min(now - lastNow, 100) : 0;
		lastNow = now;
		const tau = powerTarget > power ? P.riseMs : P.fallMs;
		power += (powerTarget - power) * (1 - Math.exp(-dt / Math.max(tau / 3, 1)));
		if (Math.abs(power - powerTarget) < 1e-4) power = powerTarget;
	};

	// ---- the frame ------------------------------------------------------------------------------------------------------
	const acc = new Float32Array(CELL_COUNT);
	const accTint = new Int32Array(CELL_COUNT);
	const shownAlpha = new Float32Array(CELL_COUNT);
	const shownGlowTint = new Int32Array(CELL_COUNT).fill(-1);
	const spent = { ms: 0, max: 0, ticks: 0 };
	const tick = (now: number, F: WellsFrame) => {
		if (!current) return;
		const t0 = performance.now();
		// the wells: the scene light times the win dim, as one tint
		lightOf();
		for (let i = 0; i < CELL_COUNT; i += 1) {
			const d = dimOn ? Math.round(F.cover[i] * 64) / 64 : 1;
			const tint =
				(Math.min(255, Math.round(255 * d * light[0])) << 16) |
				(Math.min(255, Math.round(255 * d * light[1])) << 8) |
				Math.min(255, Math.round(255 * d * light[2]));
			if (tint !== shownTint[i]) {
				shownTint[i] = tint;
				sprites[i].tint = tint;
			}
		}
		if (hasGlow) {
			triggers(now, F);
			tickPower(now, F);
			const P = WELLS_FX.power;
			const w = (2 * Math.PI * now) / P.periodMs;
			for (let i = 0; i < CELL_COUNT; i += 1) {
				acc[i] =
					power > 0
						? power * (1 - P.shimmer / 2 + (P.shimmer / 2) * Math.sin(w + table.phase[i]))
						: 0;
				accTint[i] = WELLS_FX.tint.power;
			}
			for (let k = live.length - 1; k >= 0; k -= 1) {
				const f = live[k];
				const a = level(f, now);
				if (a < 0) {
					live[k] = live[live.length - 1];
					live.length -= 1;
					free.push(f);
					continue;
				}
				if (a > acc[f.cell]) {
					acc[f.cell] = a;
					accTint[f.cell] = f.tint;
				}
			}
			for (let i = 0; i < CELL_COUNT; i += 1) {
				const a = acc[i] < WELLS_FX.epsilon ? 0 : Math.min(1, acc[i]);
				const g = glows[i];
				if (a !== shownAlpha[i]) {
					shownAlpha[i] = a;
					g.alpha = a;
					g.visible = a > 0;
				}
				if (a > 0 && accTint[i] !== shownGlowTint[i]) {
					shownGlowTint[i] = accTint[i];
					g.tint = accTint[i];
				}
			}
		}
		const ms = performance.now() - t0;
		spent.ms += ms;
		spent.ticks += 1;
		if (ms > spent.max) spent.max = ms;
	};

	// (last: everything set() touches is declared by now)
	if (firstOption) void set(firstOption);

	return {
		option: () => current,
		set,
		mount: (slot) => {
			if (!slot) return;
			if (layer.parent !== slot) slot.addChildAt(layer, 0);
			// over the tiles (added before this, in BoardCells' sync), under the frame (outside this slot)
			if (glowLayer.parent !== slot) slot.addChild(glowLayer);
		},
		place,
		tick,
		flare: (cell, kind, delayMs = 0) => add(cell, kind, performance.now() + delayMs, 1),
		log: () => fxLog.splice(0, fxLog.length),
		cost: () => {
			const out = {
				mean: spent.ticks ? Number((spent.ms / spent.ticks).toFixed(4)) : 0,
				max: Number(spent.max.toFixed(3)),
				ticks: spent.ticks,
				flares: live.length,
				peakFlares,
			};
			spent.ms = spent.max = spent.ticks = 0;
			peakFlares = live.length;
			return out;
		},
		state: () => ({
			dimWithBoard: dimOn,
			option: current,
			name: current ? WELLS_TRIAL.options[current].name : null,
			phoneTier: PHONE_TIER,
			atlasPx,
			hasGlow,
			/** resident GPU MB of the atlases (well, glow), RGBA8 with the mip chain (x 4 / 3) */
			atlasMB: atlasPx.map((p) => (p ? Number(((p * p * 4 * 4) / 3 / 2 ** 20).toFixed(2)) : 0)),
			symFill,
			global: SYMBOL_PLACE.global,
			power: Number(power.toFixed(4)),
			powerTarget: Number(powerTarget.toFixed(4)),
			flares: live.length,
			glowsVisible: glows.filter((g) => g.visible).length,
			light: light.map((x) => Number(x.toFixed(3))),
			wellTint0: shownTint[0],
			layers: layer.parent ? layer.parent.children.map((c) => c.label || c.constructor.name) : [],
			variants: Array.from(table.variant),
			turns: Array.from(table.turn),
		}),
	};
};
