import { stateBet, stateBetDerived } from 'state-shared';
import { waitForTimeout } from 'utils-shared/wait';
import { createGetWinLevelDataByWinLevelAlias } from 'utils-shared/winLevel';

import type { GameType, BonusMode, MysteryOutcome, SymbolName, SymbolState, CellIndex } from './types';
import type { Fill, TileEntry } from './typesBookEvent';
import { stateLayoutDerived } from './stateLayout';
import { boardPlacement, layoutKind } from './layoutSpec';
import { winLevelMap } from './winLevelMap';
import {
	GRID,
	CELL_COUNT,
	SYMBOL_SIZE,
	BOARD_SIZES,
	INITIAL_BOARD,
	DROP,
	GRAVITY_DROP,
	CLUSTER,
	TILE,
	FEATURE_FX,
	STING,
	ANTICIPATION,
	cellOf,
	reelOf,
	rowOf,
} from './constants';

// ================================================================================================
// THE BOARD ENGINE
//
// Manticore is a cascade board, not a reel machine: there is no spin, no strip and no anticipation
// hold, so utils-slots' reel machinery buys us nothing. Instead the board is 64 CELLS that fall,
// pop and vanish, and every one of those moves comes from a book event (EVENT_SCHEMA.md) — the
// frontend never decides what lands, what pays or what a tile becomes.
//
// One rAF loop runs a batch of per-cell "jobs" (delay, duration, from, to) so a full 8x8 reveal is
// ONE animation, not 64 promises. Every duration is divided by stateBetDerived.timeScale() at
// playback, so turbo compresses the whole choreography uniformly; every number is in constants.ts.
// ================================================================================================

export type Cell = {
	/** unique per sprite instance — the keyed {#each} identity, so a tile that survives a tumble
	 *  keeps its sprite (and its motion) instead of being recreated under the new row */
	id: number;
	name: SymbolName;
	reel: number;
	/** the cell's LOGICAL row once the move in flight has finished */
	row: number;
	/** the drawn row-space y; fractional (and negative) while a tile is in the air */
	y: number;
	scaleX: number;
	scaleY: number;
	alpha: number;
	/** additive flash tint strength 0..1 (swipe / roar / scatter beats) */
	flash: number;
	flashColor: number;
	state: SymbolState;
};

export type Tile = { value: number; scale: number };
export type Readout = { id: number; x: number; y: number; text: string; alpha: number; scale: number };

let nextId = 1;
const makeCell = (name: SymbolName, reel: number, row: number, y = row): Cell => ({
	id: nextId++,
	name,
	reel,
	row,
	y,
	scaleX: 1,
	scaleY: 1,
	alpha: 1,
	flash: 0,
	flashColor: 0xffffff,
	state: 'static',
});

const initialCells = (): Cell[] =>
	INITIAL_BOARD.flatMap((column, reel) => column.map((name, row) => makeCell(name, reel, row)));

const emptyTiles = (): Tile[] => Array.from({ length: CELL_COUNT }, () => ({ value: 0, scale: 1 }));

export const stateGame = $state({
	cells: initialCells(),
	/** the multiplier grid, indexed by the book's cellIndex (reel * 8 + row) */
	tiles: emptyTiles(),
	/** per-cluster pay readouts floating over the board while a cascade step is presented */
	readouts: [] as Readout[],

	gameType: 'basegame' as GameType,
	/** the feature a round is in, null in the base game */
	bonusMode: null as BonusMode | null,
	/** the ladder cap this session runs on (bonusStart.tileCap); 64 outside a feature */
	tileCap: 64,
	fs: 0,
	totalFs: 0,
	spinsPlayed: 0,
	/** the running total of the spin being presented (cascade.spinWin), in book cents of bet */
	spinWin: 0,
	/** scatters on the board this spin, in landing order — the reveal's, then every scatter the
	 *  tail stings in (RULE_PASS_2 section C/D), so the counter reads 4/5/6 before bonusStart */
	scatterCells: [] as CellIndex[],
	/** per-column scatter tease during a Mystery reveal (components/Anticipation.svelte).
	 *  `q` is the share of the column's hold that has run, `fade` the cross-fade over its fall. */
	anticipation: Array.from({ length: GRID }, () => ({ on: false, q: 0, fade: 1 })),
	/** the Mystery outcome of the round being played, null outside a Mystery book. Presentation
	 *  never branches on it (the spin plays itself out); it is a DEV / probe read only. */
	mysteryOutcome: null as MysteryOutcome | null,
	/** scatters counted so far this spin (components/Sound.svelte's counter events) */
	scatterCounter: 0,
	/** true while a spin's choreography is in flight (probe hook: atRest) */
	busy: false,
	/** the plain mode plaque's current copy, null when it is down */
	plaque: null as null | { title: string; sub: string },

	turboLevel: 0 as 0 | 1 | 2,
	baseTurboLevel: 0 as 0 | 1 | 2,
	autoLoadout: null as AutoLoadout | null,
	autoStopOnFreeGames: false,
	autoPlayBonuses: false,
	/** count of ACTIVE press-to-continue gates; while > 0 Chrome's Space hotkey belongs to them */
	pressGates: 0,
	/** mirrors Win.svelte's visibility (DEV soak hook only) */
	winShowing: false,
	/** wrap-up recap stashed by bonusEnd and rendered by freeSpinEnd */
	sessionRecap: null as null | { mode: BonusMode; spinsPlayed: number; totalSessionWin: number },
});

/** a configured autoplay run waiting on the spin button (built in AutoplayModal, consumed on start) */
export type AutoLoadout = {
	count: number; // Infinity allowed
	lossMult: number | null;
	winMult: number | null;
	stopFree: boolean;
	autoBonuses: boolean;
};

/** the RUNNING autoplay wants the press-gated screens to continue on their own */
export const autoBonusesRunning = (): boolean =>
	isReplayPlayback() || (stateGame.autoPlayBonuses && stateBet.autoSpinsCounter > 0);

const isReplayPlayback = (): boolean =>
	typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('replay') === 'true';

// ---- motion primitives --------------------------------------------------------------------------

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ts = () => Math.max(0.2, stateBetDerived.timeScale());

/** a pause in STYLE time: authored at normal speed, divided by the turbo scale like every
 *  other duration here, so a handler never has to reach for timeScale itself */
export const waitStyle = (ms: number) => waitForTimeout(Math.max(1, ms / ts()));

/** run id: a new spin invalidates whatever is still in the air (never await an aborted tween) */
let runId = 0;
export const newRun = () => ++runId;
const alive = (id: number) => id === runId;

/** one rAF pass over `ms` of STYLE time, already divided by the turbo scale */
const raf = (ms: number, step: (t: number, elapsed: number) => void): Promise<void> => {
	const scaled = Math.max(1, ms / ts());
	return new Promise((resolve) => {
		if (typeof requestAnimationFrame !== 'function') {
			step(1, ms);
			resolve();
			return;
		}
		const t0 = performance.now();
		const tick = () => {
			const t = clamp01((performance.now() - t0) / scaled);
			step(t, t * ms);
			if (t < 1) requestAnimationFrame(tick);
			else resolve();
		};
		requestAnimationFrame(tick);
	});
};

// A motion job never holds a CELL, only its id. Svelte 5's $state deep-proxies the array on
// assignment, so a reference captured BEFORE `stateGame.cells = [...]` is the RAW target: writing
// to it changes the value but notifies nothing, and the sprite renders at whatever y it had when
// the component last ran. That is exactly how the swipe train-wreck happened (2026-09-22) — the
// refill tiles were created, pushed into the array and then animated through their raw objects, so
// they never moved off their start y while the survivors, which came back out of the array as
// proxies, did. Resolve every job against the LIVE array each time and the class of bug is gone.
type DropJob = { cellId: number; fromY: number; toY: number; delay: number; dur: number };

/** constant-acceleration fall time (see DROP.gravityMs) */
const dropDuration = (distance: number) => DROP.gravityMs * Math.sqrt(Math.max(0, distance));

/** where the i-th of `count` incoming tiles (top-down) waits above the board before it falls */
const stackedAbove = (i: number, count: number) => i - count - DROP.clearance;

/** the landing beat: squashed on contact, easing back, then a small counter-overshoot */
const landScale = (u: number): [number, number] => {
	if (u < GRAVITY_DROP.squashMs) {
		const k = 1 - u / GRAVITY_DROP.squashMs;
		return [1 + GRAVITY_DROP.squash * k, 1 - GRAVITY_DROP.squash * k];
	}
	const k = clamp01((u - GRAVITY_DROP.squashMs) / GRAVITY_DROP.settleMs);
	const o = GRAVITY_DROP.squash * GRAVITY_DROP.settleRatio * Math.sin(Math.PI * k);
	return [1 - o, 1 + o];
};

const LAND_MS = GRAVITY_DROP.squashMs + GRAVITY_DROP.settleMs;

/** live proxies, keyed by id — rebuilt from stateGame.cells so writes are always reactive */
const liveById = () => new Map(stateGame.cells.map((c) => [c.id, c]));

/** animate a batch of falling cells, landing beat included. The FINAL positions are applied
 *  whether or not the run was superseded: a cancelled animation must never leave the board
 *  half-way between two grids. */
const runDrops = async (jobs: DropJob[], id: number, onFrame?: (now: number) => void) => {
	if (!jobs.length) return;
	const total = jobs.reduce((n, j) => Math.max(n, j.delay + j.dur), 0) + LAND_MS;
	const map = liveById();
	await raf(total, (_t, now) => {
		if (!alive(id)) return;
		onFrame?.(now);
		for (const j of jobs) {
			const cell = map.get(j.cellId);
			if (!cell) continue;
			const p = clamp01((now - j.delay) / j.dur);
			cell.y = j.fromY + (j.toY - j.fromY) * DROP.easing(p);
			if (p >= 1) {
				const [sx, sy] = landScale(now - j.delay - j.dur);
				cell.scaleX = sx;
				cell.scaleY = sy;
			}
		}
	});
	const after = liveById();
	for (const j of jobs) {
		const cell = after.get(j.cellId);
		if (!cell) continue;
		cell.y = j.toY;
		cell.scaleX = 1;
		cell.scaleY = 1;
	}
};

// ---- board operations (every one of them is driven by a book event) ------------------------------

const columnCells = (reel: number) =>
	stateGame.cells.filter((c) => c.reel === reel && c.state !== 'removing').sort((a, b) => a.row - b.row);

/**
 * THE AT-REST CONTRACT, enforced after every structural change.
 *
 * Exactly one sprite per occupied cell, sitting on its grid position, and nothing else on the
 * board: no half-faded leftovers from a removal, no cell stranded at a fractional y, no flash tint
 * still burning from a fire-and-forget beat. Anything the book's own diff did not account for is
 * reported in DEV rather than left on screen.
 */
export const settleBoard = () => {
	// 1. anything still marked for removal is gone, full stop
	const kept = stateGame.cells.filter((c) => c.state !== 'removing');
	if (kept.length !== stateGame.cells.length) stateGame.cells = kept;

	// 2. one pass per column: rows are 0..GRID-1 top to bottom, in the order the cells already sit
	for (let reel = 0; reel < GRID; reel += 1) {
		const column = stateGame.cells.filter((c) => c.reel === reel).sort((a, b) => a.row - b.row || a.y - b.y);
		if (import.meta.env.DEV && column.length !== GRID) {
			console.warn(`[manticore] column ${reel} settled with ${column.length} cells, expected ${GRID}`);
		}
		const offset = GRID - column.length; // a short column hangs from the BOTTOM, never the top
		column.forEach((cell, i) => {
			cell.row = offset + i;
		});
	}

	// 3. every cell at rest: on its row, full size, full opacity, no tint
	for (const cell of stateGame.cells) {
		cell.y = cell.row;
		cell.scaleX = 1;
		cell.scaleY = 1;
		cell.alpha = 1;
		cell.flash = 0;
		cell.state = 'static';
	}
	for (const tile of stateGame.tiles) tile.scale = 1;
	stateGame.readouts = [];
	clearAnticipation();
};

/** the Mystery tease never outlives the drop that armed it */
export const clearAnticipation = () => {
	for (const a of stateGame.anticipation) {
		if (!a.on && a.q === 0) continue;
		a.on = false;
		a.q = 0;
		a.fade = 1;
	}
};

/** The at-rest invariant, as a report rather than an exception (probe hook __manticore.invariant).
 *  `ok` is what the Playwright gate asserts after every round. */
export const boardInvariant = () => {
	const problems: string[] = [];
	const seen = new Map<number, number>(); // cellIndex -> how many sprites claim it
	for (const c of stateGame.cells) {
		if (c.reel < 0 || c.reel >= GRID || c.row < 0 || c.row >= GRID) {
			problems.push(`cell ${c.id} off the grid at reel ${c.reel} row ${c.row}`);
			continue;
		}
		const index = cellOf(c.reel, c.row);
		seen.set(index, (seen.get(index) ?? 0) + 1);
		if (Math.abs(c.y - c.row) > 0.01) problems.push(`cell ${index} parked at y ${c.y.toFixed(3)}, row ${c.row}`);
		if (Math.abs(c.scaleX - 1) > 0.01 || Math.abs(c.scaleY - 1) > 0.01) problems.push(`cell ${index} scaled ${c.scaleX.toFixed(2)}x${c.scaleY.toFixed(2)}`);
		if (Math.abs(c.alpha - 1) > 0.01) problems.push(`cell ${index} alpha ${c.alpha.toFixed(2)}`);
		if (c.flash > 0.01) problems.push(`cell ${index} still flashing ${c.flash.toFixed(2)}`);
		if (c.state !== 'static') problems.push(`cell ${index} in state ${c.state}`);
	}
	for (const [index, count] of seen) if (count > 1) problems.push(`cell ${index} holds ${count} sprites`);
	for (let index = 0; index < CELL_COUNT; index += 1) if (!seen.has(index)) problems.push(`cell ${index} is empty`);
	if (stateGame.cells.length !== CELL_COUNT) problems.push(`${stateGame.cells.length} sprites on an ${CELL_COUNT} cell board`);
	if (stateGame.readouts.length) problems.push(`${stateGame.readouts.length} win readouts left on screen`);
	return { ok: problems.length === 0, count: stateGame.cells.length, problems: problems.slice(0, 40) };
};

/** a whole new board falls in (reveal). Bottom row lands first, columns ripple left to right. */
/**
 * A whole new board falls in (reveal). Bottom row lands first, columns ripple left to right.
 *
 * `anticipation` is the BOOK's per-column array and is passed only where the book's own tease is
 * honoured (Mystery — RULE_PASS_2 section D); every other mode calls this without it. A teased
 * column waits above the board for its hold before it drops and then falls `fallSlow` times
 * slower, and the columns behind it wait with it, so the tease reads left to right exactly like
 * Angry Mantis's reels. The visuals are components/Anticipation.svelte, driven by
 * stateGame.anticipation, which this function is the only writer of.
 */
export const revealBoard = async (
	board: SymbolName[][],
	{ animate = true, anticipation }: { animate?: boolean; anticipation?: number[] } = {},
) => {
	const id = newRun();
	stateGame.readouts = [];
	clearAnticipation();

	// per-column hold (0 = no tease) and the delay every later column inherits from it
	const holdMs = Array.from({ length: GRID }, () => 0);
	const holdStart = Array.from({ length: GRID }, () => 0);
	let carried = 0;
	if (animate && anticipation?.length) {
		let scale = 1;
		for (let reel = 0; reel < GRID; reel += 1) {
			holdStart[reel] = reel * DROP.columnStaggerMs + carried;
			if (!anticipation[reel]) continue;
			holdMs[reel] = Math.max(ANTICIPATION.holdFloorMs, ANTICIPATION.holdMs * scale);
			scale *= ANTICIPATION.holdDecay;
			carried += holdMs[reel];
		}
	}
	const teased = holdMs.some((ms) => ms > 0);

	const cells: Cell[] = [];
	const plan: DropJob[] = [];
	board.forEach((column, reel) => {
		const wait = holdStart[reel] + holdMs[reel] - reel * DROP.columnStaggerMs;
		const slow = holdMs[reel] > 0 ? ANTICIPATION.fallSlow : 1;
		column.forEach((name, row) => {
			// the whole column waits stacked above the board and pours in, bottom row first
			const fromY = stackedAbove(row, GRID);
			const cell = makeCell(name, reel, row, animate ? fromY : row);
			cells.push(cell);
			if (animate) {
				plan.push({
					cellId: cell.id,
					fromY,
					toY: row,
					delay: reel * DROP.columnStaggerMs + wait + (GRID - 1 - row) * DROP.rowStaggerMs,
					dur: dropDuration(row - fromY) * slow,
				});
			}
		});
	});
	// assign FIRST, animate second: the jobs address the proxies this assignment creates
	stateGame.cells = cells;
	if (animate) {
		await runDrops(plan, id, teased ? (now) => tickAnticipation(now, holdStart, holdMs) : undefined);
	}
	settleBoard();
	return id;
};

/** one frame of the column tease, in the drop's own style-time clock */
const tickAnticipation = (now: number, holdStart: number[], holdMs: number[]) => {
	for (let reel = 0; reel < GRID; reel += 1) {
		const ms = holdMs[reel];
		if (!ms) continue;
		const a = stateGame.anticipation[reel];
		const start = holdStart[reel];
		const end = start + ms;
		if (now < start) {
			if (a.on) a.on = false;
			continue;
		}
		if (now <= end) {
			a.on = true;
			a.q = (now - start) / ms;
			a.fade = 1;
			continue;
		}
		// the real symbols are on their way down: cross-fade the tease out over their fall
		const fade = 1 - (now - end) / ANTICIPATION.fadeMs;
		a.q = 1;
		a.fade = Math.max(0, fade);
		a.on = fade > 0;
	}
};

/** highlight one cluster and dim everything else; resolves when the hold is over */
export const presentCluster = async (cells: CellIndex[], readout: string, id: number) => {
	const inCluster = new Set(cells);
	const memberIds: number[] = [];
	for (const c of stateGame.cells) {
		const isMember = inCluster.has(cellOf(c.reel, c.row));
		c.state = isMember ? 'win' : 'dim';
		if (isMember) memberIds.push(c.id);
	}
	const members = stateGame.cells.filter((c) => memberIds.includes(c.id));
	// the readout sits on the cluster's centroid, clamped inside the board
	const cx = members.reduce((n, c) => n + c.reel + 0.5, 0) / Math.max(1, members.length);
	const cy = members.reduce((n, c) => n + c.row + 0.5, 0) / Math.max(1, members.length);
	const read: Readout = {
		id: nextId++,
		x: Math.min(GRID - 1.4, Math.max(1.4, cx)) * SYMBOL_SIZE,
		y: Math.min(GRID - 0.6, Math.max(0.6, cy)) * SYMBOL_SIZE,
		text: readout,
		alpha: 0,
		scale: 0.8,
	};
	stateGame.readouts = [read];

	await raf(CLUSTER.winRiseMs, (t) => {
		if (!alive(id)) return;
		const e = CLUSTER.winEasing(t);
		for (const c of stateGame.cells) {
			if (c.state === 'win') {
				c.scaleX = 1 + (CLUSTER.winScale - 1) * e;
				c.scaleY = c.scaleX;
			} else if (c.state === 'dim') {
				c.alpha = 1 - (1 - CLUSTER.dimAlpha) * t;
			}
		}
		read.alpha = t;
		read.scale = 0.8 + 0.2 * e;
	});
	if (!alive(id)) return;
	await raf(CLUSTER.holdMs, () => {});
};

/** the cluster leaves the board: a pop, then nothing. The DELETION is unconditional — a superseded
 *  run may skip the animation, never the structural change. */
export const removeCells = async (cells: CellIndex[], id: number) => {
	const doomed = new Set(cells);
	const goingIds: number[] = [];
	for (const c of stateGame.cells) {
		if (doomed.has(cellOf(c.reel, c.row))) {
			c.state = 'removing';
			goingIds.push(c.id);
		}
	}
	if (!goingIds.length) return;
	const going = new Set(goingIds);
	await raf(CLUSTER.removeMs, (t) => {
		if (!alive(id)) return;
		const e = CLUSTER.removeEasing(t);
		const s = t < 0.3 ? 1 + 0.4 * (t / 0.3) : 1.4 * (1 - CLUSTER.removeEasing((t - 0.3) / 0.7));
		for (const c of stateGame.cells) {
			if (!going.has(c.id)) continue;
			c.scaleX = s;
			c.scaleY = s;
			c.alpha = 1 - e;
		}
	});
	stateGame.cells = stateGame.cells.filter((c) => !going.has(c.id));
	for (const c of stateGame.cells) {
		c.state = 'static';
		c.alpha = 1;
		c.scaleX = 1;
		c.scaleY = 1;
	}
	stateGame.readouts = [];
};

/** apply the book's tile diff — the client NEVER re-derives which cells step up */
export const applyTiles = async (entries: TileEntry[], id: number) => {
	if (!entries.length) return;
	for (const [cell, value] of entries) {
		const tile = stateGame.tiles[cell];
		if (tile) {
			tile.value = value;
			tile.scale = TILE.popScale;
		}
	}
	await raf(TILE.popMs, (t) => {
		if (!alive(id)) return;
		const e = TILE.popEasing(t);
		for (const [cell] of entries) {
			const tile = stateGame.tiles[cell];
			if (tile) tile.scale = TILE.popScale + (1 - TILE.popScale) * e;
		}
	});
	for (const [cell] of entries) {
		const tile = stateGame.tiles[cell];
		if (tile) tile.scale = 1;
	}
};

/** survivors fall into the gaps and `fill` drops in from above, per column, top-down */
export const dropFill = async (fill: Fill, id: number) => {
	const plan: DropJob[] = [];
	const added: Cell[] = [];
	for (let reel = 0; reel < GRID; reel += 1) {
		const survivors = columnCells(reel);
		const incoming = fill[reel] ?? [];
		// the finished column, top-down: the new symbols first, then whatever survived. A book's
		// fill always refills the column to GRID; if it ever did not, the shortfall hangs from the
		// TOP so the survivors keep sitting on the floor (settleBoard enforces the same rule).
		const total = incoming.length + survivors.length;
		const topRow = GRID - total;
		incoming.forEach((name, i) => {
			const row = topRow + i;
			// the new symbols wait stacked above the board, in column order, and fall in behind the
			// survivors: same start time, same gravity, so the stack never overtakes what is below
			const fromY = stackedAbove(i, incoming.length);
			const cell = makeCell(name, reel, row, fromY);
			added.push(cell);
			plan.push({ cellId: cell.id, fromY, toY: row, delay: reel * DROP.columnStaggerMs, dur: dropDuration(row - fromY) });
		});
		survivors.forEach((cell, i) => {
			const row = topRow + incoming.length + i;
			if (row === cell.row) return;
			const fromY = cell.y;
			cell.row = row;
			plan.push({ cellId: cell.id, fromY, toY: row, delay: reel * DROP.columnStaggerMs, dur: dropDuration(row - fromY) });
		});
	}
	// assign FIRST, animate second (see DropJob): the new cells only become reactive here
	stateGame.cells = [...stateGame.cells, ...added];
	await runDrops(plan, id);
	settleBoard();
};

// ---- the sting (RULE_PASS_2 section B/F) ---------------------------------------------------------
// The tail replaces what is on the cells in place: no refill, no drop. The board engine owns the
// CELLS (flash, pop, dim, symbol swap); components/Sting.svelte owns the strike art on top of them
// and is kind-driven, so a Spine rig can replace the placeholder without either of them changing.
//
// `cells -> symbol` is applied EXACTLY as the book wrote it. The shape is never re-derived from
// `center`, and a cell the book did not list is never touched.

const cellIdsAt = (cells: CellIndex[]) => {
	const wanted = new Set(cells);
	const ids: number[] = [];
	for (const c of stateGame.cells) if (c.state !== 'removing' && wanted.has(cellOf(c.reel, c.row))) ids.push(c.id);
	return ids;
};

/** the charge-up before a big / super sting: the board dims away and the shape pulses */
export const stingCharge = async (cells: CellIndex[], ms: number, id: number) => {
	const targets = new Set(cellIdsAt(cells));
	if (!targets.size) return;
	await raf(ms, (t) => {
		if (!alive(id)) return;
		const pulse = 1 + STING.chargePulse * Math.sin(Math.PI * STING.chargeBeats * 2 * t) * t;
		const map = liveById();
		for (const c of map.values()) {
			if (targets.has(c.id)) {
				c.scaleX = pulse;
				c.scaleY = pulse;
				c.flashColor = STING.wildColor;
				c.flash = 0.35 * t;
			} else {
				c.alpha = 1 - (1 - STING.dimAlpha) * t;
			}
		}
	});
};

/**
 * The hit itself: the listed cells flash and swell, flip to `symbol` at STING.hitAt of the beat,
 * then settle. One cell for a normal or scatter sting, the whole plus / block at once for a big
 * or super one (RULE_PASS_2 section F: "the plus / block turns wild TOGETHER").
 */
export const stingStrike = async (
	cells: CellIndex[],
	symbol: SymbolName,
	{ ms, popScale, color }: { ms: number; popScale: number; color: number },
	id: number,
) => {
	const targetIds = cellIdsAt(cells);
	if (!targetIds.length) return;
	const targets = new Set(targetIds);
	let flipped = false;
	const flip = () => {
		if (flipped) return;
		flipped = true;
		const map = liveById();
		for (const cellId of targetIds) {
			const cell = map.get(cellId);
			if (cell) cell.name = symbol;
		}
	};
	for (const c of stateGame.cells) if (targets.has(c.id)) c.flashColor = color;
	await raf(ms, (t) => {
		if (!alive(id)) return;
		if (t >= STING.hitAt) flip();
		const k = Math.sin(Math.PI * clamp01(t));
		const scale = 1 + (popScale - 1) * k;
		const map = liveById();
		for (const cellId of targetIds) {
			const cell = map.get(cellId);
			if (!cell) continue;
			cell.scaleX = scale;
			cell.scaleY = scale;
			cell.flash = STING.flashAlpha * k;
		}
	});
	flip(); // a superseded run may skip the animation, never the book's symbol change
};

/** flash a set of cells in a feature colour (swipe band / roar lows) before they leave.
 *  Fire-and-forget safe: a superseded run leaves no tint behind, because settleBoard clears
 *  `flash` on every cell and this always ends by clearing its own. */
export const flashCells = async (cells: CellIndex[], color: number, ms: number, id: number) => {
	const set = new Set(cells);
	const memberIds: number[] = [];
	for (const c of stateGame.cells) {
		if (!set.has(cellOf(c.reel, c.row))) continue;
		c.flashColor = color;
		memberIds.push(c.id);
	}
	if (!memberIds.length) return;
	const members = new Set(memberIds);
	await raf(ms, (t) => {
		if (!alive(id)) return;
		const k = Math.sin(Math.PI * t) * FEATURE_FX.swipeFlashAlpha;
		for (const c of stateGame.cells) if (members.has(c.id)) c.flash = k;
	});
	for (const c of stateGame.cells) if (members.has(c.id)) c.flash = 0;
};

export const resetTiles = () => {
	stateGame.tiles = emptyTiles();
};

export const setBoardFromSymbols = (board: SymbolName[][]) => {
	stateGame.cells = board.flatMap((column, reel) => column.map((name, row) => makeCell(name, reel, row)));
	settleBoard();
};

/** a fresh round: nothing from the last one may outlive it */
export const resetSession = () => {
	stateGame.spinsPlayed = 0;
	stateGame.fs = 0;
	stateGame.totalFs = 0;
	stateGame.spinWin = 0;
	stateGame.bonusMode = null;
	stateGame.tileCap = 64;
	stateGame.scatterCells = [];
	stateGame.readouts = [];
	stateGame.mysteryOutcome = null;
	clearAnticipation();
	resetTiles();
};

/** the ONE way to change the live turbo level */
const setTurboLevel = (level: 0 | 1 | 2) => {
	stateGame.turboLevel = level;
	stateBetDerived.updateIsTurbo(level > 0, { persistent: true });
};

// Board placement in master units (layoutSpec.ts). width/height are the UNSCALED Pixi board sizes.
const boardLayout = () => {
	const vw = stateLayoutDerived.canvasSizes().width / stateLayoutDerived.mainLayout().scale;
	const placement = boardPlacement(layoutKind(stateLayoutDerived.layoutType()), vw);
	return {
		x: placement.x,
		y: placement.y,
		scale: placement.scale,
		anchor: { x: 0.5, y: 0.5 },
		pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
		...BOARD_SIZES,
	};
};

/** the board as the book addresses it: board[reel][row] of symbol names (probe hook) */
const boardRaw = (): SymbolName[][] => {
	const out: SymbolName[][] = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => 'L1' as SymbolName));
	for (const c of stateGame.cells) if (c.state !== 'removing' && out[c.reel]) out[c.reel][c.row] = c.name;
	return out;
};

const tilesRaw = (): Record<number, number> => {
	const out: Record<number, number> = {};
	stateGame.tiles.forEach((t, i) => {
		if (t.value) out[i] = t.value;
	});
	return out;
};

export const { getWinLevelDataByWinLevelAlias } = createGetWinLevelDataByWinLevelAlias({ winLevelMap });

export const stateGameDerived = {
	boardLayout,
	boardRaw,
	tilesRaw,
	getWinLevelDataByWinLevelAlias,
	resetSession,
	setTurboLevel,
	revealBoard,
	setBoardFromSymbols,
	settleBoard,
	boardInvariant,
	newRun,
	cellOf,
	reelOf,
	rowOf,
};
