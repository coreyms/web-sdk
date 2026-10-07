import { stateBet, stateBetDerived } from 'state-shared';
import { waitForTimeout } from 'utils-shared/wait';
import { createGetWinLevelDataByWinLevelAlias } from 'utils-shared/winLevel';
import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

import type { GameType, BonusMode, MysteryOutcome, SymbolName, SymbolState, CellIndex } from './types';
import type { Fill, TileEntry } from './typesBookEvent';
import { stateLayoutDerived } from './stateLayout';
import { boardPlacement, layoutKind } from './layoutSpec';
import { winLevelMap } from './winLevelMap';
import { layoutNumerals } from './numeralLayout';
import { spawnSparkles } from './sparkles';
import { boardKick, swipeFx, roarFx, stingFx, clearStingFx, fxStamp, type FxRecord } from './featureFx';
import {
	GRID,
	CELL_COUNT,
	CELL_FILL,
	SYMBOL_FIT,
	SYMBOL_SIZE,
	BOARD_SIZES,
	INITIAL_BOARD,
	DROP,
	GRAVITY_DROP,
	CLUSTER,
	READOUT,
	SPARKLE,
	SYMBOL_COLORS,
	TILE,
	FEATURE_FX,
	STING,
	SWIPE_FX,
	ROAR_FX,
	PLAYGROUND_PX,
	ANTICIPATION,
	cellOf,
	reelOf,
	rowOf,
	TURBO_SCALE,
	symbolAnim,
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
// ONE animation, not 64 promises. Every duration is divided by timeScale() (TURBO_SCALE by turbo level) at
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
	/** drawn x offset in cells from the cell's column centre (the roar's rattle), 0 at rest */
	dx: number;
	/** drawn rotation in radians about the tile's centre (the roar's rattle and fall), 0 at rest */
	rot: number;
	scaleX: number;
	scaleY: number;
	alpha: number;
	/** additive flash tint strength 0..1 (swipe / roar / scatter beats) */
	flash: number;
	flashColor: number;
	/** the landing aura 0..1: a winner of the next cascade glows as it lands (CLUSTER.auraMs) */
	glow: number;
	/** performance.now() of this cell's last landing contact (0 = never landed): BoardCells starts
	 *  the symbol's drop sheet from it. Written once per landing, never per frame. */
	landAt: number;
	state: SymbolState;
};

export type Tile = { value: number; scale: number };
/** one cluster's pay readout over the board. `raw`: the amount and the multiplier sit apart at
 *  amountX / multX (board px) and slam together; `merged`: one amount `text` at `scale`. */
export type Readout = {
	id: number;
	x: number;
	y: number;
	alpha: number;
	mode: 'raw' | 'merged';
	amount: string;
	mult: string;
	amountX: number;
	multX: number;
	text: string;
	scale: number;
};

let nextId = 1;
const makeCell = (name: SymbolName, reel: number, row: number, y = row): Cell => ({
	id: nextId++,
	name,
	reel,
	row,
	y,
	dx: 0,
	rot: 0,
	scaleX: 1,
	scaleY: 1,
	alpha: 1,
	flash: 0,
	flashColor: 0xffffff,
	glow: 0,
	landAt: 0,
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
	/** SKIP TO RESULT is pressed: every remaining event before bonusEnd still runs through its own
	 *  handler and applies its structural change, only the waits collapse (waitStyle / raf resolve at
	 *  once, the presentation components short-circuit). Set ONLY by stateGameDerived.requestSkip,
	 *  cleared ONLY by stateGameDerived.finishSkip (the bonusEnd and wincap handlers). Not persisted:
	 *  a reload mid-skip resumes the round at normal speed. */
	skipping: false,
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
/** the ONE style-time divisor: by Manticore's turbo level (TURBO_SCALE), not the shared 1 / 2 switch */
export const timeScale = () => TURBO_SCALE[stateGame.turboLevel] ?? 1;
const ts = () => Math.max(0.2, timeScale());

/** a pause in STYLE time: authored at normal speed, divided by the turbo scale like every
 *  other duration here, so a handler never has to reach for timeScale itself */
export const waitStyle = (ms: number) => (stateGame.skipping ? Promise.resolve() : waitForTimeout(Math.max(1, ms / ts())));

/** run id: a new spin invalidates whatever is still in the air (never await an aborted tween) */
let runId = 0;
export const newRun = () => ++runId;
const alive = (id: number) => id === runId;

/** one rAF pass over `ms` of STYLE time, already divided by the turbo scale */
const raf = (ms: number, step: (t: number, elapsed: number) => void): Promise<void> => {
	const scaled = Math.max(1, ms / ts());
	return new Promise((resolve) => {
		// SKIP TO RESULT: the pass lands on its last frame at once. Every caller's step() writes the
		// final state at t = 1, so the structural result is identical to the full animation's.
		if (stateGame.skipping || typeof requestAnimationFrame !== 'function') {
			step(1, ms);
			resolve();
			return;
		}
		const t0 = performance.now();
		const tick = () => {
			// a skip pressed mid-beat ends the beat on its next frame, at its final state
			const t = stateGame.skipping ? 1 : clamp01((performance.now() - t0) / scaled);
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
type DropJob = { cellId: number; fromY: number; toY: number; delay: number; dur: number; aura?: boolean };
/** a winner of the next cascade that does not move in this drop: it glows from `t0` (style ms) */
type AuraJob = { cellId: number; t0: number };

/** constant-acceleration fall time (see DROP.gravityMs) */
const dropDuration = (distance: number) => DROP.gravityMs * Math.sqrt(Math.max(0, distance));

/** where the i-th of `count` incoming tiles (top-down) waits above the board before it falls */
const stackedAbove = (i: number, count: number) => i - count - DROP.clearance;

/**
 * The landing beat at `u` ms after contact: [scaleX, scaleY, dy]. Squash wide-and-short on contact
 * (sine over squashMs), then the counter-overshoot (sine over settleMs), and the bounce (sine over
 * bounceMs) alongside. The squash scales about the tile's BOTTOM edge, so `dy` (row units) is the
 * centre shift that keeps the bottom edge on the floor, less the bounce lift. Matches the
 * playground's `squash` / `settle` / `bounce` tracks sample for sample.
 */
const landPose = (u: number, squash: number = GRAVITY_DROP.squash): [number, number, number] => {
	let sx = 1;
	let sy = 1;
	// squash: per symbol (constants SYMBOL_ANIM; L4 bakes its own into its drop frames, so 0)
	if (squash > 0 && GRAVITY_DROP.squashMs > 0) {
		if (u < GRAVITY_DROP.squashMs) {
			const k = Math.sin(Math.PI * (u / GRAVITY_DROP.squashMs)) * squash;
			sx *= 1 + k;
			sy *= 1 - k;
		} else if (GRAVITY_DROP.settleMs > 0 && GRAVITY_DROP.settleRatio > 0) {
			const k =
				Math.sin(Math.PI * clamp01((u - GRAVITY_DROP.squashMs) / GRAVITY_DROP.settleMs)) *
				squash *
				GRAVITY_DROP.settleRatio;
			sx *= 1 - k;
			sy *= 1 + k;
		}
	}
	let dy = ((1 - sy) * CELL_FILL * SYMBOL_FIT) / 2; // the drawn tile's bottom stays planted
	if (GRAVITY_DROP.bounceCells > 0 && GRAVITY_DROP.bounceMs > 0) {
		dy -= Math.sin(Math.PI * clamp01(u / GRAVITY_DROP.bounceMs)) * GRAVITY_DROP.bounceCells;
	}
	return [sx, sy, dy];
};

/** how long a landed tile keeps moving after contact: squash + settle, or the bounce if longer */
const LAND_MS = Math.max(GRAVITY_DROP.squashMs + GRAVITY_DROP.settleMs, GRAVITY_DROP.bounceMs);

/** live proxies, keyed by id — rebuilt from stateGame.cells so writes are always reactive */
const liveById = () => new Map(stateGame.cells.map((c) => [c.id, c]));

/** the cells the LAST drop glowed (cellIndex): presentWinSet plays a standalone aura for any winner
 *  the drop did not reach (one that was stung in place, say). Presentation only. */
const lastAura = new Set<CellIndex>();

/** animate a batch of falling cells, landing beat and aura included. The FINAL positions are
 *  applied whether or not the run was superseded: a cancelled animation must never leave the board
 *  half-way between two grids. */
const runDrops = async (jobs: DropJob[], id: number, onFrame?: (now: number) => void, auras: AuraJob[] = []) => {
	if (!jobs.length && !auras.length) return;
	const auraMs = CLUSTER.auraMs;
	let total = jobs.reduce((n, j) => Math.max(n, j.delay + j.dur), 0) + LAND_MS;
	for (const j of jobs) if (j.aura) total = Math.max(total, j.delay + j.dur + auraMs);
	for (const a of auras) total = Math.max(total, a.t0 + auraMs);
	const map = liveById();
	const landed = new Set<number>(); // job cell ids whose contact has been stamped
	await raf(total, (_t, now) => {
		if (!alive(id)) return;
		onFrame?.(now);
		for (const j of jobs) {
			const cell = map.get(j.cellId);
			if (!cell) continue;
			const p = clamp01((now - j.delay) / j.dur);
			const y = j.fromY + (j.toY - j.fromY) * DROP.easing(p);
			if (p >= 1) {
				const u = now - j.delay - j.dur;
				if (!landed.has(j.cellId)) {
					// the contact happened u style ms before this frame: stamp it in real time so the
					// drop sheet starts on the landing frame whatever the frame rate
					landed.add(j.cellId);
					cell.landAt = performance.now() - u / ts();
				}
				const [sx, sy, dy] = landPose(u, symbolAnim(cell.name).squash);
				cell.scaleX = sx;
				cell.scaleY = sy;
				cell.y = y + dy;
				if (j.aura && auraMs > 0) cell.glow = Math.sin(Math.PI * clamp01(u / auraMs));
			} else {
				cell.y = y;
			}
		}
		for (const a of auras) {
			const cell = map.get(a.cellId);
			if (cell && now >= a.t0) cell.glow = Math.sin(Math.PI * clamp01((now - a.t0) / auraMs));
		}
	});
	const after = liveById();
	lastAura.clear();
	for (const j of jobs) {
		const cell = after.get(j.cellId);
		if (!cell) continue;
		cell.y = j.toY;
		cell.scaleX = 1;
		cell.scaleY = 1;
		cell.glow = 0;
		if (j.aura) lastAura.add(cellOf(cell.reel, cell.row));
	}
	for (const a of auras) {
		const cell = after.get(a.cellId);
		if (!cell) continue;
		cell.glow = 0;
		lastAura.add(cellOf(cell.reel, cell.row));
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
		cell.dx = 0;
		cell.rot = 0;
		cell.scaleX = 1;
		cell.scaleY = 1;
		cell.alpha = 1;
		cell.flash = 0;
		cell.glow = 0;
		cell.state = 'static';
	}
	for (const tile of stateGame.tiles) tile.scale = 1;
	boardKick.x = 0;
	boardKick.y = 0;
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
		if (Math.abs(c.dx) > 0.01 || Math.abs(c.rot) > 0.001) problems.push(`cell ${index} offset dx ${c.dx.toFixed(3)} rot ${c.rot.toFixed(3)}`);
		if (Math.abs(c.scaleX - 1) > 0.01 || Math.abs(c.scaleY - 1) > 0.01) problems.push(`cell ${index} scaled ${c.scaleX.toFixed(2)}x${c.scaleY.toFixed(2)}`);
		if (Math.abs(c.alpha - 1) > 0.01) problems.push(`cell ${index} alpha ${c.alpha.toFixed(2)}`);
		if (c.flash > 0.01) problems.push(`cell ${index} still flashing ${c.flash.toFixed(2)}`);
		if (c.glow > 0.01) problems.push(`cell ${index} still glowing ${c.glow.toFixed(2)}`);
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
 *
 * `aura` is the set of cells (cellIndex) that win in the cascade that FOLLOWS this reveal: those
 * tiles glow for CLUSTER.auraMs as they land. Presentation only; the handler reads it ahead from
 * the book, which is fully known.
 */
export const revealBoard = async (
	board: SymbolName[][],
	{ animate = true, anticipation, aura }: { animate?: boolean; anticipation?: number[]; aura?: Set<CellIndex> } = {},
) => {
	const id = newRun();
	stateGame.readouts = [];
	clearAnticipation();
	clearStingFx();

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
					aura: aura?.has(cellOf(reel, row)) ?? false,
				});
			}
		});
	});
	// assign FIRST, animate second: the jobs address the proxies this assignment creates
	stateGame.cells = cells;
	lastAura.clear();
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

// ---- the win set (MOTION PASS 1) ------------------------------------------------------------------
// Every cluster of one cascade step, presented in SEQUENCE with overlap, from ONE compiled schedule in
// style ms sampled by ONE rAF pass — the playground's model (motion-playground.html compileWinSet /
// presentCluster / removeCluster / sample), so the two agree sample for sample:
//   cluster i+1 starts at max(cluster i start, cluster i removal end + CLUSTER.clusterGapMs)
//   dim ONCE at the first cluster's start (every winner of every cluster excluded), un-dim ONCE after
//     the last cluster's removal (re-dimming per cluster flashed the board)
//   per cluster: [standalone aura] -> rise -> raw -> slam -> punch + count -> hold -> removal + sparkle
//   removal end = last cell's removeMs (+ staggerMs per cell, cells ordered by distance from the
//     cluster centre); the refill starts at the LAST removal end; the sparkles outlive it
// The cells a cluster removes are its OWN (win.c); a cell two clusters share (a wild) goes with the
// first. The handler removes whatever else the book's `removed` lists afterwards, and asserts the set.

/** one cluster as the handler hands it over: the book's cells and the book's three numbers */
export type WinSpec = { cells: CellIndex[]; base: number; mult: number; total: number; symbol: SymbolName };
export type WinSetHooks = {
	/** a cluster's readout has begun (its SFX) */
	onClusterStart?: (index: number) => void;
	/** a cluster's count-up has landed on `total` (the spin total bumps here) */
	onCountDone?: (index: number, total: number) => void;
};

const fmtAmount = (n: number) => bookEventAmountToCurrencyString(Math.round(n));
const READOUT_H = SYMBOL_SIZE * CLUSTER.readoutHeight;
/** the drawn width of a stencil string at the readout height, for the raw layout */
const textWidth = (text: string, height: number) => {
	const glyphs = layoutNumerals(text, height);
	if (!glyphs?.length) return 0;
	let lo = Infinity;
	let hi = -Infinity;
	for (const g of glyphs) {
		lo = Math.min(lo, g.x);
		hi = Math.max(hi, g.x + g.w);
	}
	return hi - lo;
};
/** the shrink removal: grow a hair, then shrink to nothing (the playground's 'shrink' style) */
const shrinkScale = (u: number) => (u < 0.25 ? 1 + 0.12 * (u / 0.25) : 1.12 * (1 - CLUSTER.removeEasing((u - 0.25) / 0.75)));

type Member = { cell: Cell; index: CellIndex; removeT0: number; spawned: boolean };
type Cluster = {
	members: Member[];
	/** the cluster's start (before its standalone aura) and the readout's start (after it) */
	tc: number;
	t: number;
	aura: number;
	rise: number;
	raw: number;
	slam: number;
	count: number;
	hold: number;
	tCountDone: number;
	tReadoutDone: number;
	tRemEnd: number;
	spec: WinSpec;
	readout: Readout;
	wa: number;
	wb: number;
	started: boolean;
	counted: boolean;
};

/**
 * Present every cluster of a cascade step and remove their cells. Resolves at the last removal end
 * (the refill starts then). Returns the cells removed (cellIndex), for the handler's assertion
 * against the book's `removed`. The DELETION is unconditional: a superseded run skips the motion,
 * never the structural change.
 */
export const presentWinSet = async (wins: WinSpec[], id: number, hooks: WinSetHooks = {}): Promise<CellIndex[]> => {
	if (!wins.length) return [];
	const at = new Map<CellIndex, Cell>();
	for (const c of stateGame.cells) if (c.state !== 'removing') at.set(cellOf(c.reel, c.row), c);
	const allWinners = new Set<CellIndex>();
	for (const w of wins) for (const index of w.cells) allWinners.add(index);
	const claimed = new Set<CellIndex>();

	// ---- compile ----
	const gap0 = READOUT.rawGapCells * SYMBOL_SIZE;
	let tc = 0;
	let tRem = 0;
	const clusters: Cluster[] = wins.map((spec, i) => {
		const cx = spec.cells.reduce((n, index) => n + reelOf(index) + 0.5, 0) / Math.max(1, spec.cells.length);
		const cy = spec.cells.reduce((n, index) => n + rowOf(index) + 0.5, 0) / Math.max(1, spec.cells.length);
		const members: Member[] = [];
		for (const index of spec.cells) {
			const cell = at.get(index);
			if (!cell || claimed.has(index)) continue; // a shared cell leaves with the first cluster
			claimed.add(index);
			members.push({ cell, index, removeT0: 0, spawned: false });
		}
		// cells leave in order of distance from the cluster centre
		members.sort((a, b) => Math.hypot(rowOf(a.index) + 0.5 - cy, reelOf(a.index) + 0.5 - cx) - Math.hypot(rowOf(b.index) + 0.5 - cy, reelOf(b.index) + 0.5 - cx));
		// a winner the preceding drop did not glow gets the standalone aura (the whole cluster, together)
		const aura = CLUSTER.auraMs > 0 && members.some((m) => !lastAura.has(m.index)) ? CLUSTER.auraMs : 0;
		const t = tc + aura;
		const rise = Math.max(CLUSTER.winRiseMs, i === 0 ? CLUSTER.dimMs : 0, 1);
		const raw = spec.mult ? READOUT.rawMs : 0;
		const slam = raw > 0 ? READOUT.slamMs : 0;
		const count = READOUT.countMs;
		const hold = CLUSTER.holdMs;
		const tCountDone = t + rise + raw + slam + count;
		const tReadoutDone = tCountDone + hold;
		let tRemEnd = tReadoutDone;
		members.forEach((m, k) => {
			m.removeT0 = tReadoutDone + k * SPARKLE.staggerMs;
			tRemEnd = Math.max(tRemEnd, m.removeT0 + Math.max(CLUSTER.removeMs, 1));
		});
		tRem = Math.max(tRem, tRemEnd);
		const start = tc;
		tc = Math.max(tc, tRemEnd + (i < wins.length - 1 ? CLUSTER.clusterGapMs : 0));
		const amount = fmtAmount(spec.base);
		const mult = `×${spec.mult}`;
		const readout: Readout = {
			id: nextId++,
			x: Math.min(GRID - 1.4, Math.max(1.4, cx)) * SYMBOL_SIZE,
			y: Math.min(GRID - 0.6, Math.max(0.6, cy)) * SYMBOL_SIZE,
			alpha: 0,
			mode: raw > 0 ? 'raw' : 'merged',
			amount,
			mult,
			amountX: 0,
			multX: 0,
			text: fmtAmount(raw > 0 ? spec.base : 0),
			scale: 1,
		};
		return {
			members,
			tc: start,
			t,
			aura,
			rise,
			raw,
			slam,
			count,
			hold,
			tCountDone,
			tReadoutDone,
			tRemEnd,
			spec,
			readout,
			wa: textWidth(amount, READOUT_H),
			wb: textWidth(mult, READOUT_H),
			started: false,
			counted: false,
		};
	});
	const dimT0 = clusters[0].t;
	const dimmed: Cell[] = [];
	for (const c of stateGame.cells) if (!allWinners.has(cellOf(c.reel, c.row)) && c.state !== 'removing') dimmed.push(c);
	for (const cl of clusters) for (const m of cl.members) m.cell.state = 'win';
	for (const c of dimmed) c.state = 'dim';
	const lifeReal = SPARKLE.lifeMs / ts();

	// ---- sample ----
	const live = new Map<number, Readout>(); // readout id -> its live proxy in stateGame.readouts
	const sample = (now: number) => {
		// the dim, once, for the whole set
		const dk = clamp01((now - dimT0) / Math.max(CLUSTER.dimMs, 1));
		if (now >= dimT0) for (const c of dimmed) c.alpha = 1 - (1 - CLUSTER.dimAlpha) * dk;

		let listChanged = false;
		for (let i = 0; i < clusters.length; i += 1) {
			const cl = clusters[i];
			if (now >= cl.t && !cl.started) {
				cl.started = true;
				hooks.onClusterStart?.(i);
			}
			if (now >= cl.tCountDone && !cl.counted) {
				cl.counted = true;
				hooks.onCountDone?.(i, cl.spec.total);
			}
			for (const m of cl.members) {
				const c = m.cell;
				if (cl.aura > 0 && now >= cl.tc && now < cl.t) c.glow = Math.sin(Math.PI * clamp01((now - cl.tc) / cl.aura));
				else if (c.glow !== 0) c.glow = 0;
				if (now < cl.t) continue;
				if (now < m.removeT0) {
					const s = 1 + (CLUSTER.winScale - 1) * CLUSTER.winEasing(clamp01((now - cl.t) / Math.max(CLUSTER.winRiseMs, 1)));
					c.scaleX = s;
					c.scaleY = s;
					continue;
				}
				// leaving: shrink from the held win scale; sparkle at the first frame of it
				if (!m.spawned) {
					m.spawned = true;
					if (!stateGame.skipping) spawnSparkles(c.reel, c.row, SYMBOL_COLORS[c.name] ?? 0xffffff, lifeReal);
				}
				c.state = 'removing';
				const u = clamp01((now - m.removeT0) / Math.max(CLUSTER.removeMs, 1));
				const s = u >= 1 ? 0 : CLUSTER.winScale * shrinkScale(u);
				c.scaleX = s;
				c.scaleY = s;
			}
			// the readout, up from the cluster's start to the end of its hold
			const up = now >= cl.t && now < cl.tReadoutDone;
			const shown = live.get(cl.readout.id);
			if (!up) {
				if (shown) {
					live.delete(cl.readout.id);
					listChanged = true;
				}
				continue;
			}
			if (!shown) {
				live.set(cl.readout.id, cl.readout);
				listChanged = true;
			}
		}
		if (listChanged) {
			// animate the PROXIES, never the raw objects (see DropJob): rebuild the live map from the
			// array the assignment creates
			stateGame.readouts = [...live.values()];
			live.clear();
			for (const r of stateGame.readouts) live.set(r.id, r);
		}
		for (const cl of clusters) {
			const r = live.get(cl.readout.id);
			if (!r) continue;
			const el = now - cl.t;
			const appear = clamp01(el / Math.max(cl.rise, 1));
			const tSlam = cl.rise + cl.raw;
			const tCount = tSlam + cl.slam;
			const tHold = tCount + cl.count;
			r.alpha = appear;
			if (cl.raw > 0 && el < tCount) {
				// two parts: the gap closes over the slam (backIn winds up, then crosses a hair)
				let gap = gap0;
				if (el >= tSlam) gap = gap0 * (1 - Math.max(0, Math.min(1.2, READOUT.slamEasing(clamp01((el - tSlam) / Math.max(cl.slam, 1))))));
				const half = (cl.wa + cl.wb) / 2 + gap / 2;
				r.mode = 'raw';
				r.amountX = r.x - half + cl.wa / 2;
				r.multX = r.x + half - cl.wb / 2;
				continue;
			}
			let val = cl.spec.total;
			if (cl.count > 0 && el < tHold) {
				const k = READOUT.countEasing(clamp01((el - tCount) / cl.count));
				val = cl.raw > 0 ? cl.spec.base + (cl.spec.total - cl.spec.base) * k : cl.spec.total * k;
			}
			let scale = 1;
			if (cl.raw > 0 && READOUT.slamPunchMs > 0 && el < tCount + READOUT.slamPunchMs) {
				scale = 1 + (READOUT.slamScale - 1) * Math.sin(Math.PI * clamp01((el - tCount) / READOUT.slamPunchMs));
			}
			r.mode = 'merged';
			const text = fmtAmount(val);
			if (r.text !== text) r.text = text;
			r.scale = scale;
		}
	};

	await raf(tRem, (_t, now) => {
		if (!alive(id)) return;
		sample(now);
	});

	// ---- the structural result, whether or not the run was superseded ----
	const removed: CellIndex[] = [];
	const goingIds = new Set<number>();
	for (const cl of clusters) {
		for (const m of cl.members) {
			removed.push(m.index);
			goingIds.add(m.cell.id);
		}
		// a skip (or a superseded run) may have jumped the hooks: fire what is still owed, in order
		if (!cl.started) {
			cl.started = true;
			hooks.onClusterStart?.(clusters.indexOf(cl));
		}
		if (!cl.counted) {
			cl.counted = true;
			hooks.onCountDone?.(clusters.indexOf(cl), cl.spec.total);
		}
	}
	stateGame.cells = stateGame.cells.filter((c) => !goingIds.has(c.id));
	stateGame.readouts = [];
	lastAura.clear();
	const dimmedIds = new Set(dimmed.map((c) => c.id));
	for (const c of stateGame.cells) {
		c.state = 'static';
		c.scaleX = 1;
		c.scaleY = 1;
		c.glow = 0;
		if (!dimmedIds.has(c.id)) c.alpha = 1;
	}
	// un-dim ONCE, alongside the refill (never awaited: the refill starts at the removal end).
	// settleBoard at the end of the fill lands every alpha on 1 whatever happened here.
	if (stateGame.skipping || !alive(id)) {
		for (const c of stateGame.cells) c.alpha = 1;
	} else {
		void raf(CLUSTER.dimMs, (t) => {
			if (!alive(id)) return;
			const map = liveById();
			for (const idm of dimmedIds) {
				const c = map.get(idm);
				if (c) c.alpha = CLUSTER.dimAlpha + (1 - CLUSTER.dimAlpha) * t;
			}
		});
	}
	return removed;
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

/** survivors fall into the gaps and `fill` drops in from above, per column, top-down. `aura` is the
 *  next cascade's winners (cellIndex, on the FILLED board): the ones that move glow as they land, the
 *  ones already in place glow when the last moving winner lands, so the cluster lights up whole. */
export const dropFill = async (fill: Fill, id: number, aura?: Set<CellIndex>) => {
	const plan: DropJob[] = [];
	const added: Cell[] = [];
	const still: Cell[] = []; // winners that do not move in this drop
	let lastWinnerLanding = -1;
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
			const job: DropJob = { cellId: cell.id, fromY, toY: row, delay: reel * DROP.columnStaggerMs, dur: dropDuration(row - fromY), aura: aura?.has(cellOf(reel, row)) ?? false };
			if (job.aura) lastWinnerLanding = Math.max(lastWinnerLanding, job.delay + job.dur);
			plan.push(job);
		});
		survivors.forEach((cell, i) => {
			const row = topRow + incoming.length + i;
			const wins = aura?.has(cellOf(reel, row)) ?? false;
			if (row === cell.row) {
				if (wins) still.push(cell);
				return;
			}
			const fromY = cell.y;
			cell.row = row;
			const job: DropJob = { cellId: cell.id, fromY, toY: row, delay: reel * DROP.columnStaggerMs, dur: dropDuration(row - fromY), aura: wins };
			if (job.aura) lastWinnerLanding = Math.max(lastWinnerLanding, job.delay + job.dur);
			plan.push(job);
		});
	}
	// a still winner joins the aura when the last moving winner lands; if none moved (a win that
	// was already standing, e.g. after a sting) presentWinSet plays the standalone aura instead
	const auras: AuraJob[] = lastWinnerLanding >= 0 ? still.map((cell) => ({ cellId: cell.id, t0: lastWinnerLanding })) : [];
	// assign FIRST, animate second (see DropJob): the new cells only become reactive here
	stateGame.cells = [...stateGame.cells, ...added];
	lastAura.clear();
	await runDrops(plan, id, undefined, auras);
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

type StingKindName = 'normal' | 'big' | 'super' | 'scatter';

/** turn the listed cells into `symbol` (the book's change, applied exactly as written) */
const flipCells = (targetIds: number[], symbol: SymbolName) => {
	const map = liveById();
	for (const cellId of targetIds) {
		const cell = map.get(cellId);
		if (cell) cell.name = symbol;
	}
};

/**
 * One tail hit on its cells (a normal sting's one cell, or the scatter sting's): the cell pops
 * (popScale, sine over the whole beat) and flips to `symbol` at STING.hitAt of it. The overlays
 * (the tail streak during the wind-up, the white flash, the per-cell ring) are Sting.svelte's, from
 * the stingFx entry stamped here. The scatter sting keeps its own beat: the old flash tint, no streak.
 * Resolves at the end of the beat; the ring tail runs on into the gap on its own.
 */
export const stingHit = async (
	cells: CellIndex[],
	symbol: SymbolName,
	{ ms, popScale, kind }: { ms: number; popScale: number; kind: StingKindName },
	id: number,
	rec?: FxRecord,
) => {
	const targetIds = cellIdsAt(cells);
	if (!targetIds.length) return;
	const scatter = kind === 'scatter';
	if (!stateGame.skipping) {
		const t0 = performance.now();
		const rate = ts();
		for (const cell of cells) {
			stingFx.strikes.push({
				cell,
				t0,
				rate,
				dur: ms,
				hitAt: STING.hitAt,
				streak: kind === 'normal' && STING.streak,
				ringMs: kind === 'normal' ? STING.ringMs : 0,
				kind,
			});
		}
	}
	let flipped = false;
	const flip = () => {
		if (flipped) return;
		flipped = true;
		if (rec) fxStamp(rec, 'hit');
		flipCells(targetIds, symbol);
	};
	if (scatter) {
		const targets = new Set(targetIds);
		for (const c of stateGame.cells) if (targets.has(c.id)) c.flashColor = STING.scatterColor;
	}
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
			if (scatter) cell.flash = STING.scatterFlashAlpha * k;
		}
	});
	flip(); // a superseded run may skip the animation, never the book's symbol change
	if (rec) fxStamp(rec, 'end');
};

/**
 * A big / super sting, one compiled beat in style ms (the playground's compileSting finisher):
 *   0 .. charge            the board outside the shape dims to dimAlpha over dimMs; the centre
 *                          telegraph breathes (Sting.svelte); chargePulse 0 = the cells do not pulse
 *   charge .. charge+hit   every shape cell pops (bigPopScale, sine) and flips TOGETHER at hitAt;
 *                          bigRings rings ripple from the centre, bigRingGapMs apart (Sting.svelte)
 *   .. + undimMs           the board comes back up
 * `onStrike` fires when the charge ends (the strike beat + SFX). Resolves at the end of the undim.
 */
export const stingBig = async (
	cells: CellIndex[],
	center: CellIndex,
	symbol: SymbolName,
	kind: 'big' | 'super',
	id: number,
	{ onStrike, rec }: { onStrike?: () => void; rec?: FxRecord } = {},
) => {
	const targetIds = cellIdsAt(cells);
	const charge = Math.max(0, kind === 'super' ? STING.superChargeMs : STING.chargeMs);
	const hit = Math.max(1, STING.bigHitMs);
	const total = charge + hit + (charge > 0 ? STING.undimMs : 0);
	const targets = new Set(targetIds);
	if (!stateGame.skipping) {
		const t0 = performance.now();
		const rate = ts();
		if (charge > 0) stingFx.charge = { centre: center, t0, rate, dur: charge, kind };
		const hitT0 = t0 + charge / rate;
		for (const cell of cells) stingFx.strikes.push({ cell, t0: hitT0, rate, dur: hit, hitAt: STING.hitAt, streak: false, ringMs: 0, kind });
		const reach = (kind === 'super' ? 1.5 * Math.SQRT2 : 1.5) * STING.bigRingReach;
		if (STING.bigRingMs > 0) {
			for (let k = 0; k < Math.max(1, Math.round(STING.bigRings)); k += 1) {
				stingFx.rings.push({ centre: center, t0: t0 + (charge + STING.hitAt * hit + k * STING.bigRingGapMs) / rate, rate, dur: STING.bigRingMs, reach, px: STING.bigRingPx });
			}
		}
	}
	let struck = false;
	let flipped = false;
	const strike = () => {
		if (struck) return;
		struck = true;
		if (rec) fxStamp(rec, 'strike');
		onStrike?.();
	};
	const flip = () => {
		if (flipped) return;
		flipped = true;
		if (rec) fxStamp(rec, 'hit');
		flipCells(targetIds, symbol);
	};
	await raf(total, (_t, el) => {
		if (!alive(id)) return;
		const dimIn = clamp01(el / Math.max(STING.dimMs, 1));
		const undim = el > charge + hit ? clamp01((el - charge - hit) / Math.max(STING.undimMs, 1)) : 0;
		const dim = charge > 0 ? 1 - (1 - STING.dimAlpha) * dimIn * (1 - undim) : 1;
		let scale = 1;
		if (el < charge) {
			scale = 1 + STING.chargePulse * Math.max(0, Math.sin((el / charge) * Math.PI * STING.chargeBeats));
		} else {
			strike();
			const u = (el - charge) / hit;
			if (u < 1) scale = 1 + (STING.bigPopScale - 1) * Math.sin(Math.PI * u);
			if (u >= STING.hitAt) flip();
		}
		if (el >= charge + hit && rec) fxStamp(rec, 'undim');
		const map = liveById();
		for (const c of map.values()) {
			if (targets.has(c.id)) {
				c.scaleX = scale;
				c.scaleY = scale;
			} else {
				c.alpha = dim;
			}
		}
	});
	strike();
	flip();
	if (rec) fxStamp(rec, 'end');
	if (!alive(id) || stateGame.skipping) stingFx.charge = null;
};

/** the scatter sting's disappointment / anticipation beat on the resting board: the centre telegraph
 *  pulses (Sting.svelte) for scatterHoldMs. Its own beat, unchanged by the lock. */
export const stingScatterWait = async (center: CellIndex) => {
	if (!stateGame.skipping) stingFx.charge = { centre: center, t0: performance.now(), rate: ts(), dur: STING.scatterHoldMs, kind: 'scatter' };
	await waitStyle(STING.scatterHoldMs);
	stingFx.charge = null;
};

// ---- the claw swipe (MOTION_SPEC "Claw swipe", the playground's compileSwipe) ---------------------

/** the swipe's schedule in style ms: when the last tear is fully out, when the symbols start to
 *  leave (and the tears fade), when the kick starts, and when the refill may start */
export const swipeSchedule = () => {
	const n = Math.max(1, Math.round(SWIPE_FX.tearCount));
	const lastReveal = (n - 1) * SWIPE_FX.tearStaggerMs + SWIPE_FX.tearSweepMs;
	const tExit = lastReveal + SWIPE_FX.tearHoldMs;
	const exitMs = Math.max(SWIPE_FX.exitMs, 1);
	return {
		n,
		lastReveal,
		tExit,
		exitMs,
		kickT0: lastReveal - SWIPE_FX.tearSweepMs * 0.3,
		tRefill: tExit + Math.max(exitMs, SWIPE_FX.tearFadeMs) + SWIPE_FX.refillDelayMs,
	};
};

/**
 * The claw swipe over `rows` (the book's): the tears (ClawSwipe.svelte, from swipeFx) rake right to
 * left, hold, and fade while the `removed` symbols leave by SWIPE_FX.exit; the board kicks on the
 * last tear. `onExit` fires when the symbols start to leave (the handler pops the swipe's tiles
 * then). Resolves when the refill may start; the cells are gone by then, whatever happened.
 */
export const swipeBand = async (removed: CellIndex[], rows: number[], id: number, { onExit, rec }: { onExit?: () => void; rec?: FxRecord } = {}) => {
	const S = swipeSchedule();
	const doomed = new Set(removed);
	const goingIds: number[] = [];
	for (const c of stateGame.cells) if (c.state !== 'removing' && doomed.has(cellOf(c.reel, c.row))) goingIds.push(c.id);
	swipeFx.serial += 1;
	swipeFx.rows = rows.slice().sort((a, b) => a - b);
	swipeFx.el = 0;
	swipeFx.alpha = 1;
	swipeFx.active = !stateGame.skipping;
	let exited = false;
	const exit = () => {
		if (exited) return;
		exited = true;
		if (rec) fxStamp(rec, 'exit');
		const going = new Set(goingIds);
		for (const c of stateGame.cells) if (going.has(c.id)) c.state = 'removing';
		onExit?.();
	};
	const kickK = SWIPE_FX.kickPx * PLAYGROUND_PX;
	await raf(S.tRefill, (_t, el) => {
		if (!alive(id)) return;
		swipeFx.el = el;
		swipeFx.alpha = el > S.tExit ? 1 - clamp01((el - S.tExit) / Math.max(SWIPE_FX.tearFadeMs, 1)) : 1;
		if (el >= S.lastReveal && rec) fxStamp(rec, 'revealed');
		// the kick: (0.6k, k), k = kickPx (1 - u) sin(6 pi u)
		const ku = (el - S.kickT0) / Math.max(SWIPE_FX.kickMs, 1);
		const k = SWIPE_FX.kickPx > 0 && ku >= 0 && ku < 1 ? kickK * (1 - ku) * Math.sin(ku * Math.PI * 6) : 0;
		boardKick.x = 0.6 * k;
		boardKick.y = k;
		if (el < S.tExit) return;
		exit();
		const u = clamp01((el - S.tExit) / S.exitMs);
		const map = liveById();
		for (const cellId of goingIds) {
			const c = map.get(cellId);
			if (!c) continue;
			if (SWIPE_FX.exit === 'fade') c.alpha = 1 - u;
			else if (SWIPE_FX.exit === 'slideLeft') {
				c.dx = -SWIPE_FX.slideCells * u * u;
				c.alpha = 1 - u;
			} else {
				const v = 1 - u * u;
				c.scaleX = v;
				c.scaleY = v;
			}
		}
	});
	exit();
	swipeFx.active = false;
	swipeFx.alpha = 0;
	boardKick.x = 0;
	boardKick.y = 0;
	const going = new Set(goingIds);
	stateGame.cells = stateGame.cells.filter((c) => !going.has(c.id));
	if (rec) fxStamp(rec, 'end');
};

// ---- the roar (MOTION_SPEC "Roar", the playground's compileRoar, style shakeLoose) ----------------

/** a removed low's leave time in style ms: bottom rows first */
export const roarLeaveMs = (row: number) => ROAR_FX.windupMs + ROAR_FX.rattleMs + ROAR_FX.waveMs * (1 - (row + 0.5) / GRID);

/**
 * The roar: every removed low rattles from the end of the wind-up, growing as u^1.5, until its leave
 * time; then it falls ROAR_FX.exitDistCells (quadIn) with a little spin and fades, and its cell
 * flashes. The board kicks with the rattle over the whole rattle window. Multiplier tiles are never
 * touched. Resolves when the last low is gone (+ refillDelayMs); the cells are removed by then.
 */
export const roarBlow = async (removed: CellIndex[], id: number, rec?: FxRecord) => {
	const R = ROAR_FX;
	const doomed = new Set(removed);
	type Low = { id: number; index: number; row: number; leave: number; ph: number; ph2: number; spin: number };
	const lows: Low[] = [];
	for (const c of stateGame.cells) {
		if (c.state === 'removing') continue;
		const index = cellOf(c.reel, c.row);
		if (!doomed.has(index)) continue;
		// the playground's per-tile seeds (row r, column c): the rattle's two phases, the spin's sign
		const rnd = seededRnd(31 + c.row * GRID + c.reel);
		const ph = rnd() * 6.28;
		const ph2 = rnd() * 6.28;
		const spin = ((R.exitSpinDeg * Math.PI) / 180) * ((c.row + c.reel) % 2 ? 1 : -1);
		lows.push({ id: c.id, index, row: c.row, leave: roarLeaveMs(c.row), ph, ph2, spin });
	}
	const tStart = R.windupMs;
	const rattleHi = lows.reduce((n, l) => Math.max(n, l.leave), tStart);
	const firstLeave = lows.reduce((n, l) => Math.min(n, l.leave), Infinity);
	const lastGone = lows.reduce((n, l) => Math.max(n, l.leave + Math.max(R.exitMs, 1)), tStart);
	const total = lastGone + R.refillDelayMs;
	const amp = R.rattleAmpPx / 66.5; // cells: the playground's px over its cell
	const rotAmp = (R.rattleRotDeg * Math.PI) / 180;
	const w0 = (R.rattleHz * Math.PI * 2) / 1000;
	const kickK = R.kickPx * PLAYGROUND_PX;
	const flashHalf = R.flashMs * 0.5;
	roarFx.flash.fill(0);
	roarFx.active = !stateGame.skipping;
	await raf(total, (_t, el) => {
		if (!alive(id)) return;
		if (el >= tStart && rec) fxStamp(rec, 'rattle');
		if (el >= firstLeave && rec) fxStamp(rec, 'firstLeave');
		const map = liveById();
		for (const l of lows) {
			const c = map.get(l.id);
			if (!c) continue;
			const since = el - l.leave;
			roarFx.flash[l.index] = R.flashAlpha > 0 && since >= 0 && since < flashHalf ? R.flashAlpha * (1 - since / flashHalf) : 0;
			if (el < tStart) continue;
			if (since < 0) {
				const u = (el - tStart) / Math.max(l.leave - tStart, 1);
				const g = Math.pow(u, 1.5) * amp;
				const w = (el - tStart) * w0;
				c.dx = Math.sin(w + l.ph) * g;
				c.y = l.row + Math.cos(w * 1.3 + l.ph2) * g * 0.6;
				c.rot = Math.sin(w * 0.9 + l.ph) * rotAmp * Math.pow(u, 1.5);
				continue;
			}
			c.state = 'removing';
			const u = clamp01(since / Math.max(R.exitMs, 1));
			c.dx = 0;
			c.y = l.row + R.exitDistCells * u * u;
			c.rot = l.spin * 0.3 * u;
			c.alpha = u >= 1 ? 0 : u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
		}
		// the kick rides the rattle: same Hz, growing with it, from the first rattle to the last leave
		const ku = (el - tStart) / Math.max(rattleHi - tStart, 1);
		const k = R.kickPx > 0 && ku >= 0 && ku < 1 ? kickK * Math.pow(ku, 1.5) * Math.sin((el - tStart) * w0) : 0;
		boardKick.x = 0.6 * k;
		boardKick.y = k;
		if (el >= lastGone && rec) fxStamp(rec, 'lastGone');
	});
	roarFx.active = false;
	roarFx.flash.fill(0);
	boardKick.x = 0;
	boardKick.y = 0;
	const going = new Set(lows.map((l) => l.id));
	stateGame.cells = stateGame.cells.filter((c) => !going.has(c.id));
	if (rec) {
		fxStamp(rec, 'lastGone');
		fxStamp(rec, 'end');
		rec.info = { ...(rec.info ?? {}), firstLeave, lastGone, rattleHi, lows: lows.length };
	}
};

/** the playground's LCG (game/sparkles.ts `seeded` is the same sequence) */
const seededRnd = (seed: number) => {
	let x = (seed * 9301 + 49297) % 233280;
	return () => {
		x = (x * 9301 + 49297) % 233280;
		return x / 233280;
	};
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

// ---- SKIP TO RESULT ------------------------------------------------------------------------------
// The ONE way to start a skip (the SkipButton and the DEV hook) and the ONE way to end one (the
// bonusEnd and wincap handlers). There is no separate fast path: the same handlers apply the same
// state, only the waits collapse while `skipping` is true.

/** is the feature still playing its spins? bonusEnd writes the recap (and bonusStart clears it), and
 *  gameType stays 'freegame' until freeSpinEnd a beat later: a press in that gap must not take, or
 *  `skipping` would be set with no bonusEnd left to clear it (caught by the skip probe). */
export const featureSpinsLive = () => stateGame.gameType === 'freegame' && stateGame.sessionRecap === null;

/** press SKIP TO RESULT: only while a feature's spins are live, and a second press is a no-op.
 *  Returns whether it took. */
const requestSkip = (): boolean => {
	if (!featureSpinsLive() || stateGame.skipping) return false;
	stateGame.skipping = true;
	return true;
};

/** the skip is over: the outro (or the max-win presentation) plays at normal speed from here */
const finishSkip = () => {
	stateGame.skipping = false;
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
	timeScale,
	boardLayout,
	boardRaw,
	tilesRaw,
	getWinLevelDataByWinLevelAlias,
	resetSession,
	setTurboLevel,
	requestSkip,
	finishSkip,
	revealBoard,
	setBoardFromSymbols,
	settleBoard,
	boardInvariant,
	newRun,
	cellOf,
	reelOf,
	rowOf,
};
