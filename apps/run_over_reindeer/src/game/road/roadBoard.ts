// THE ROAD BOARD: the 5 x 4 board drawn as a four lane road, and its traffic.
//
// One plain PIXI container in ROAD PX (the 1536 x 1024 background's pixels, game/roadArtSpec.ts), moved by ONE
// update call per frame (components/Board.svelte ticks it and scales the container into the layout). No Svelte
// state is touched per frame, no texture is made per frame, and there is no filter, mask or shader: the traffic
// "comes out of the tunnels" because the two portal strips cut from the background are drawn over it, and it
// darkens near them by a plain sprite tint.
//
// Layers, back to front: the background, the four lanes (top lane first, so lower lanes draw in front), the features
// (cloud cells, red boxes, column characters), the line win overlay, the running reindeer, the two stoplights, the
// rock beside the picture and the tunnel portals.
//
// What is on the board only ever comes from the caller (the book event handlers): setBoard / driveIn take the
// book's board as it is. The one place a random number is used is the make-believe "through traffic" that may pass
// while the game waits for a slow book (ROAD_MOTION through), which is decoration and never lands.
import * as PIXI from 'pixi.js';

import { ROAD_ART } from '../roadArtSpec';
import { LINE_WIN, ROAD, STOPLIGHT, motionFor, type RoadMotion } from '../constants';
import type { LayoutKind } from '../layoutSpec';
import type { Board, SymbolName } from '../types';
import { NumberLabel, RoadFeatures } from './roadFeatures';

const COLS = ROAD_ART.board.columns;
const ROWS = ROAD_ART.board.rows;
const PITCH = ROAD_ART.board.pitch;
const LINES = ROAD_ART.laneLines;
const MOUTH_L = ROAD_ART.covers.left.mouth;
const MOUTH_R = ROAD_ART.covers.right.mouth;
/** how far past a mouth a symbol is parked or retired, on top of half its own width (it is under the portal there) */
const HIDE_PAD = 40;

const CARS: SymbolName[] = ['H1', 'H2', 'H3', 'H4'];
/** symbols with a picture per driving direction (lettering and tags are never mirrored) */
const DIRECTIONAL: SymbolName[] = [...CARS, 'W', 'GW', 'CW'];
/** through traffic is picked from these (decoration only) */
const THROUGH_POOL: SymbolName[] = ['H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'L5'];

export type TextureLookup = (frame: string) => PIXI.Texture | undefined;

/** the atlas frame for a symbol in a lane driving `dir`. The two feature Wilds have no art yet and draw as the sleigh. */
export const frameFor = (symbol: SymbolName, dir: 1 | -1): string => {
	const base = symbol === 'GW' || symbol === 'CW' ? 'W' : symbol;
	return DIRECTIONAL.includes(symbol) ? `${base}_${dir > 0 ? 'R' : 'L'}` : base;
};

export const columnX = (col: number) => ROAD_ART.board.x + (col + 0.5) * PITCH;
/** where a symbol's lower edge sits in a lane */
export const laneSitY = (row: number) => LINES[row + 1] - ROAD.sitAboveLine;
/** the middle of a lane (the line win is drawn through these) */
export const laneMidY = (row: number) => (LINES[row] + LINES[row + 1]) / 2;

type Phase = 'free' | 'rest' | 'out' | 'in' | 'through';

type Car = {
	sprite: PIXI.Sprite;
	phase: Phase;
	lane: number;
	col: number;
	symbol: SymbolName | null;
	dir: 1 | -1;
	halfW: number;
	baseScale: number;
	/** rest position (its column's centre) */
	restX: number;
	/** out / through: where it set off from and when (board clock ms) */
	x0: number;
	t0: number;
	/** in: when it stops, and the numbers of that stop */
	stopAt: number;
	overshoot: number;
	dive: number;
	m: RoadMotion | null;
	/** line win: part of a win, and the brightness it is drawn at */
	winning: boolean;
	bright: number;
	tintNow: number;
	/** in: it has reached its stop point (the brake bounce follows) */
	stopped: boolean;
};

export type SignalColor = 'red' | 'amber' | 'green';
const SIGNAL_COLORS: SignalColor[] = ['red', 'amber', 'green'];

/** one stoplight: its container (origin on the housing's lens edge, at mid height) and its three lenses */
type Stoplight = {
	root: PIXI.Container;
	/** -1 hangs from the left mouth (the picture as drawn), 1 from the right mouth (mirrored) */
	side: -1 | 1;
	/** the two lanes it stands beside */
	lanes: number[];
	lens: Record<SignalColor, { lit: PIXI.Sprite; glow: PIXI.Sprite | null; alpha: number }>;
	showing: SignalColor | null;
	/** DEV readout: performance.now() when its red last came on */
	redOnReal: number;
};

/** the x of a tunnel mouth's line at height y (road px), from the measured line (tools/build_assets.py) */
const mouthAt = (side: 'left' | 'right', y: number): number => {
	const line = ROAD_ART.covers[side].mouthLine;
	if (y <= line[0][0]) return line[0][1];
	for (let i = 1; i < line.length; i++) {
		if (y <= line[i][0]) {
			const [y0, x0] = line[i - 1];
			const [y1, x1] = line[i];
			return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
		}
	}
	return line[line.length - 1][1];
};

type Waiter = { at: number; clock: 'board' | 'win'; resolve: () => void };

export type LineWinSpec = { cells: number[]; line: number };

export class RoadBoard {
	readonly root = new PIXI.Container();
	private readonly lanes: PIXI.Container[] = [];
	private readonly cars: Car[] = [];
	private readonly winLayer = new PIXI.Container();
	private readonly winLines = new PIXI.Graphics();
	private winAmount: PIXI.Text | null = null;
	private winMult: NumberLabel | null = null;
	/** the strike, the cloud cells and the column Wilds (game/road/roadFeatures.ts) */
	readonly features: RoadFeatures;
	private readonly lightLayer = new PIXI.Container();
	private readonly lights: Stoplight[] = [];
	/** THE SIGNAL's clock marks: a spin is under way from the press until every lane is home; per lane, when its
	 *  front symbol starts to brake (Infinity until the book's board is driving in) */
	private spinActive = false;
	/** the road clock at the press, and when the book's traffic set off (Infinity until it has) */
	private spinStartAt = 0;
	private convoyAt = Infinity;
	/** a slam stop is running the rest of this spin fast */
	private hurrying = false;
	private laneBrakeAt: number[] = [Infinity, Infinity, Infinity, Infinity];
	/** per lane, when its LAST symbol reaches its stop point (the start of its brake bounce): the signal's red */
	private laneStopAt: number[] = [0, 0, 0, 0];
	/** DEV readout (snapshot().signalTiming): per lane, performance.now() when its last symbol was seen at its stop point
	 *  (read off the symbols themselves, not off the schedule), and per light when its red came on */
	private laneStoppedReal: number[] = [0, 0, 0, 0];
	private laneStoppedCount: number[] = [0, 0, 0, 0];
	/** how many symbols park in each lane this spin (5, less the column Wilds standing in it) */
	private laneParked: number[] = [COLS, COLS, COLS, COLS];
	/** DEV: hold the lights on one color (or dark) whatever the board does; undefined = follow the board */
	private signalForced: SignalColor | null | undefined = undefined;
	/** the layout the road is drawn in (components/Board.svelte sets it): the stoplights' place is per layout */
	layoutKind: LayoutKind = 'landscape';

	/** the board clock, ms. Runs at the rate update() is given (turbo, a slam stop). */
	private clock = 0;
	/** the win clock, ms of real time (hurried by a slam stop only) */
	private winClock = 0;
	private waiters: Waiter[] = [];
	/** when the last drive out began (the convoy gives it a head start), or null when the board did not drive out */
	private outAt: number | null = null;
	/** waiting for a book: through traffic may run (ROAD_MOTION through.whileWaiting) */
	private waiting: { m: RoadMotion; next: number[] } | null = null;
	/** per lane: when its incoming convoy is home (board clock) */
	private laneHomeAt: number[] = [0, 0, 0, 0];
	private laneStopSoundAt: (number | null)[] = [null, null, null, null];
	private win: { t0: number; holdMs: number; fadeAt: number; active: boolean; dim: boolean } | null = null;
	private destroyed = false;
	/** how many symbols the board on the road parks (20, less four for every column Wild standing) */
	private parked = COLS * ROWS;

	/** a lane's front car has stopped (the handler plays the stop sound) */
	onLaneStop: ((lane: number) => void) | null = null;

	constructor(
		private readonly tex: TextureLookup,
		textures: { road?: PIXI.Texture; tunnelLeft?: PIXI.Texture; tunnelRight?: PIXI.Texture },
	) {
		const img = ROAD_ART.image;
		if (textures.road) {
			const bg = new PIXI.Sprite(textures.road);
			bg.width = img.width;
			bg.height = img.height;
			this.root.addChild(bg);
		}
		for (let row = 0; row < ROWS; row++) {
			const lane = new PIXI.Container();
			this.lanes.push(lane);
			this.root.addChild(lane);
		}
		// the cloud cells, the red boxes and the column characters stand over the traffic and under the line win
		this.features = new RoadFeatures(tex);
		this.features.hideCell = (cell, hidden) => this.setCellHidden(cell, hidden);
		this.root.addChild(this.features.layer);
		this.winLayer.addChild(this.winLines);
		this.winLayer.visible = false;
		this.root.addChild(this.winLayer);
		// the running reindeer, over the line win too
		this.root.addChild(this.features.runnerLayer);
		this.root.addChild(this.lightLayer);
		this.buildLights();

		// THE ROCK beside the picture (ROAD.rock): the hillside the tunnels run into. Traffic that has driven past the
		// picture's edge is under it. Only seen where the screen is wider than the picture.
		const rock = new PIXI.Graphics();
		rock.rect(-1200, -600, 1200, img.height + 1200).fill(ROAD.rock);
		rock.rect(img.width, -600, 1200, img.height + 1200).fill(ROAD.rock);
		this.root.addChild(rock);
		for (const side of ['left', 'right'] as const) {
			const t = side === 'left' ? textures.tunnelLeft : textures.tunnelRight;
			if (!t) continue;
			const c = ROAD_ART.covers[side];
			const cover = new PIXI.Sprite(t);
			cover.position.set(c.x, c.y);
			cover.width = c.width;
			cover.height = c.height;
			this.root.addChild(cover);
		}
	}

	// ---- cars ------------------------------------------------------------------------------------------------------
	private take(lane: number, symbol: SymbolName): Car {
		const dir = ROAD.laneDirection[lane];
		let car = this.cars.find((c) => c.phase === 'free');
		if (!car) {
			const sprite = new PIXI.Sprite();
			sprite.anchor.set(0.5, 1);
			car = { sprite, phase: 'free', lane: 0, col: -1, symbol: null, dir: 1, halfW: 0, baseScale: 1, restX: 0, x0: 0, t0: 0, stopAt: 0, overshoot: 0, dive: 0, m: null, winning: false, bright: 1, tintNow: 0xffffff, stopped: false };
			this.cars.push(car);
		}
		const frame = frameFor(symbol, dir);
		const texture = this.tex(frame) ?? PIXI.Texture.EMPTY;
		const size = (ROAD_ART.symbols as Record<string, { width: number; height: number }>)[frame];
		const want = (size?.width ?? PITCH * 0.8) * (ROAD.symbolScale[symbol] ?? 1);
		car.sprite.texture = texture;
		car.baseScale = texture.width > 0 ? want / texture.width : 1;
		car.sprite.scale.set(car.baseScale);
		car.sprite.rotation = 0;
		car.sprite.y = laneSitY(lane);
		car.sprite.visible = true;
		car.halfW = want / 2;
		car.lane = lane;
		car.dir = dir;
		car.symbol = symbol;
		car.col = -1;
		car.winning = false;
		car.bright = 1;
		car.stopped = false;
		car.m = null;
		if (car.sprite.parent !== this.lanes[lane]) this.lanes[lane].addChild(car.sprite);
		return car;
	}

	private free(car: Car) {
		car.phase = 'free';
		car.symbol = null;
		car.sprite.visible = false;
	}

	/** a cell's parked symbol is covered by a cloud or a column (it is not drawn, and does not come back by itself) */
	private setCellHidden(cell: number, hidden: boolean) {
		const col = Math.floor(cell / ROWS);
		const lane = cell % ROWS;
		for (const car of this.cars) {
			if (car.phase !== 'rest' || car.col !== col || car.lane !== lane) continue;
			car.sprite.visible = !hidden;
		}
	}

	/** the x a symbol is hidden at on the side it enters from (`enter`) or leaves by */
	private hiddenX(car: Car, enter: boolean): number {
		const fromLeft = car.dir > 0 ? enter : !enter;
		return fromLeft ? MOUTH_L - car.halfW - HIDE_PAD : MOUTH_R + car.halfW + HIDE_PAD;
	}

	/** does a symbol park in this cell? Not where a column Wild stands, and the two feature Wilds are never traffic. */
	private parks(board: Board, col: number, row: number): boolean {
		const symbol = board[col][row];
		return symbol !== 'CW' && symbol !== 'GW' && !this.features.hasColumn(col);
	}

	/** put a board up as it is, at rest (boot, a resumed round, a failed play) */
	setBoard(board: Board) {
		for (const car of this.cars) if (car.phase !== 'free') this.free(car);
		this.outAt = null;
		this.waiting = null;
		this.spinActive = false; // stopped: the signal is red
		this.clearWin();
		let parked = 0;
		for (let col = 0; col < COLS; col++) {
			for (let row = 0; row < ROWS; row++) {
				if (!this.parks(board, col, row)) continue;
				const car = this.take(row, board[col][row]);
				car.phase = 'rest';
				car.col = col;
				car.restX = columnX(col);
				car.sprite.x = car.restX;
				parked += 1;
			}
		}
		this.parked = parked;
		this.paint();
	}

	/** THE PRESS: every lane's symbols pull away toward their far tunnel, front car first. Returns at once. */
	driveOut(level: 0 | 1 | 2) {
		const m = motionFor(level);
		this.clearWin();
		this.outAt = this.clock;
		// THE SIGNAL: green from the press. No lane has a brake time until the book's board drives in.
		this.spinActive = true;
		this.spinStartAt = this.clock;
		this.convoyAt = Infinity;
		this.laneBrakeAt = [Infinity, Infinity, Infinity, Infinity];
		this.laneStopAt = [Infinity, Infinity, Infinity, Infinity];
		this.laneStoppedCount = [0, 0, 0, 0];
		m.laneOrder.forEach((lane, k) => {
			const dir = ROAD.laneDirection[lane];
			const resting = this.cars.filter((c) => c.phase === 'rest' && c.lane === lane).sort((a, b) => (b.restX - a.restX) * dir);
			resting.forEach((car, j) => {
				car.phase = 'out';
				car.m = m;
				car.x0 = car.sprite.x;
				car.t0 = this.clock + k * m.out.laneStaggerMs + j * m.out.carStaggerMs;
			});
		});
		const first = this.clock + m.in.delayMs + 2 * m.through.gapMs;
		this.waiting = { m, next: m.laneOrder.map((_, k) => first + k * m.in.laneStaggerMs) };
	}

	/** THE BOOK'S BOARD drives in, lane by lane. Resolves when the last symbol has settled on its mark. */
	driveIn(board: Board, level: 0 | 1 | 2): Promise<void> {
		const m = motionFor(level);
		// a board that never drove out (a round's later spins, a resume) pulls away first
		if (this.cars.some((c) => c.phase === 'rest')) this.driveOut(level);
		this.waiting = null;
		const start = Math.max(this.clock, (this.outAt ?? this.clock) + m.in.delayMs);
		this.convoyAt = start;
		this.outAt = null;
		const brakeDist = (m.cruise * m.in.brakeMs) / 2000;
		let allHome = start;
		let parked = 0;
		m.laneOrder.forEach((lane, k) => {
			const dir = ROAD.laneDirection[lane];
			let t0 = start + k * m.in.laneStaggerMs;
			for (let n = 0; n < m.through.perLane; n++) {
				this.spawnThrough(lane, t0, m);
				t0 += m.through.gapMs;
			}
			// the convoy, front car first: the front car is the one whose column is farthest from the entry
			const order = Array.from({ length: COLS }, (_, i) => (dir > 0 ? COLS - 1 - i : i));
			// The lane's time is set by its FRONT place (the column farthest from the entry), whether or not a symbol parks
			// there: a held column Wild in the lane leaves the other symbols' places and times exactly as they were.
			const hiddenAt = (halfW: number) => (dir > 0 ? MOUTH_L - halfW - HIDE_PAD : MOUTH_R + halfW + HIDE_PAD);
			const stopFor = (halfW: number, overshoot: number) => {
				const s0 = Math.abs(columnX(order[0]) + dir * overshoot - hiddenAt(halfW));
				return t0 + m.in.brakeMs + (Math.max(0, s0 - brakeDist) / m.cruise) * 1000;
			};
			let leadStop = stopFor(PITCH * 0.46, m.in.overshootPx);
			let count = 0;
			order.forEach((col, i) => {
				if (!this.parks(board, col, lane)) return;
				const car = this.take(lane, board[col][lane]);
				const stiff = CARS.includes(car.symbol as SymbolName) ? 1 : m.in.stiffShare;
				car.phase = 'in';
				car.m = m;
				car.col = col;
				car.restX = columnX(col);
				car.overshoot = m.in.overshootPx * stiff;
				car.dive = (m.in.diveDeg * stiff * Math.PI) / 180;
				if (i === 0) leadStop = stopFor(car.halfW, car.overshoot);
				car.stopAt = leadStop + i * m.in.carStaggerMs;
				car.sprite.x = this.hiddenX(car, true);
				car.sprite.visible = false;
				count += 1;
			});
			this.laneParked[lane] = count;
			parked += count;
			this.laneStopSoundAt[lane] = count > 0 ? leadStop : null;
			// THE SIGNAL: this lane's front symbol starts to brake here (amber); its last symbol reaches its stop point
			// here (red: the start of the brake bounce, not the end of it)
			this.laneBrakeAt[lane] = leadStop - m.in.brakeMs;
			this.laneStopAt[lane] = leadStop + (COLS - 1) * m.in.carStaggerMs;
			this.laneHomeAt[lane] = leadStop + (COLS - 1) * m.in.carStaggerMs + m.in.settleMs;
			allHome = Math.max(allHome, this.laneHomeAt[lane]);
		});
		this.parked = parked;
		return this.wait(allHome + 20, 'board');
	}

	private spawnThrough(lane: number, at: number, m: RoadMotion) {
		const symbol = THROUGH_POOL[Math.floor(Math.random() * THROUGH_POOL.length)];
		const car = this.take(lane, symbol);
		car.phase = 'through';
		car.m = m;
		car.t0 = at;
		car.x0 = this.hiddenX(car, true);
		car.sprite.x = car.x0;
		car.sprite.visible = false;
	}

	// ---- the line win ------------------------------------------------------------------------------------------------
	/** show every winning line together with the amount; resolves when the hold is over */
	showWin(wins: LineWinSpec[], amountText: string, holdMs: number, multiplier = 1): Promise<void> {
		const cells = new Set<number>();
		for (const w of wins) for (const c of w.cells) cells.add(c);
		for (const car of this.cars) {
			if (car.phase !== 'rest') continue;
			car.winning = cells.has(car.col * ROWS + car.lane);
		}
		const g = this.winLines;
		g.clear();
		wins.forEach((w) => {
			if (w.cells.length < 2) return;
			const pts = [...w.cells].sort((a, b) => a - b).map((c) => ({ x: columnX(Math.floor(c / ROWS)), y: laneMidY(c % ROWS) }));
			const color = LINE_WIN.lineColors[(Math.max(1, w.line) - 1) % LINE_WIN.lineColors.length];
			for (const [width, col] of [
				[LINE_WIN.lineWidth + 2 * LINE_WIN.lineEdge, 0x101216],
				[LINE_WIN.lineWidth, color],
			] as const) {
				g.moveTo(pts[0].x, pts[0].y);
				for (let p = 1; p < pts.length; p++) g.lineTo(pts[p].x, pts[p].y);
				g.stroke({ width, color: col, alpha: LINE_WIN.lineAlpha, cap: 'round', join: 'round' });
			}
		});
		// the amount, on the middle of the first line
		if (!this.winAmount) {
			this.winAmount = new PIXI.Text({
				text: '',
				style: {
					fontFamily: 'Overpass, sans-serif',
					fontWeight: '900',
					fontSize: LINE_WIN.amountSize,
					fill: LINE_WIN.amountFill,
					stroke: { color: LINE_WIN.amountStroke, width: LINE_WIN.amountStrokeWidth, join: 'round' },
					align: 'center',
				},
			});
			this.winAmount.anchor.set(0.5);
			this.winLayer.addChild(this.winAmount);
		}
		const first = wins[0];
		const sorted = first ? [...first.cells].sort((a, b) => a - b) : [];
		const mid = sorted[Math.floor(sorted.length / 2)] ?? 0;
		this.winAmount.style.fontSize = LINE_WIN.amountSize;
		this.winAmount.text = amountText;
		// kept inside the picture: a long amount on an outer column is pulled toward the middle
		const half = this.winAmount.width / 2 + 20;
		const x = first ? columnX(Math.floor(mid / ROWS)) : ROAD_ART.image.width / 2;
		this.winAmount.position.set(Math.min(MOUTH_R - half, Math.max(MOUTH_L + half, x)), first ? laneMidY(mid % ROWS) : ROAD_ART.image.height / 2);
		// a win through multiplier Wilds says so: "x35" over the amount (the highest multiplier among the winning lines)
		if (!this.winMult) {
			this.winMult = new NumberLabel(this.tex, LINE_WIN.multHeight, LINE_WIN.multTint);
			this.winLayer.addChild(this.winMult.root);
		}
		this.winMult.root.visible = multiplier > 1;
		if (multiplier > 1) {
			this.winMult.set(`x${multiplier}`, LINE_WIN.multHeight, LINE_WIN.multTint);
			this.winMult.root.position.set(this.winAmount.x, this.winAmount.y - LINE_WIN.multUp);
		}
		// the columns a winning line runs through play their win clip
		const reels = new Set<number>();
		for (const w of wins) for (const c of w.cells) reels.add(Math.floor(c / ROWS));
		this.features.winColumns([...reels]);
		this.winLayer.alpha = 1;
		this.winLayer.visible = true;
		// a line win dims the symbols that are not part of it; a plain message over the board (no cells) dims nothing
		this.win = { t0: this.winClock, holdMs, fadeAt: this.winClock + holdMs, active: true, dim: wins.length > 0 };
		return this.wait(this.winClock + holdMs, 'win');
	}

	/** pulse some cells with no line and no amount (the scatters of a trigger); resolves after `ms` */
	pulseCells(cells: number[], ms: number): Promise<void> {
		return this.showWin(cells.map((cell) => ({ cells: [cell], line: 1 })), '', ms);
	}

	/** a short line over the middle of the board (a retrigger's "+3 FREE SPINS"); resolves after `ms` */
	message(text: string, ms: number): Promise<void> {
		return this.showWin([], text, ms);
	}

	/** take the win picture down (the lines and the amount fade, the symbols come back to full brightness) */
	clearWin() {
		for (const car of this.cars) car.winning = false;
		if (this.win) this.win.active = false;
	}

	// ---- the stoplights (constants STOPLIGHT) -----------------------------------------------------------------------------
	private buildLights() {
		const art = ROAD_ART.stoplight;
		const base = this.tex('stoplight');
		if (!base) return;
		const glowTex = this.tex('stoplight_glow');
		// the picture as drawn hangs from the LEFT mouth beside the bottom two lanes; its mirror from the RIGHT mouth
		// beside the top two (a mirrored container: one set of frames, an exact matched pair)
		for (const side of [-1, 1] as const) {
			const root = new PIXI.Container();
			const body = new PIXI.Sprite(base);
			body.width = art.width;
			body.height = art.height;
			body.position.set(-art.housing.x1, -art.height / 2);
			root.addChild(body);
			const lens = {} as Stoplight['lens'];
			for (const color of SIGNAL_COLORS) {
				const d = art.domes[color];
				let glow: PIXI.Sprite | null = null;
				if (glowTex) {
					glow = new PIXI.Sprite(glowTex);
					glow.anchor.set(0.5);
					glow.position.set(d.centreX - art.housing.x1, d.centreY - art.height / 2);
					glow.tint = Number.parseInt(art.lit[color].slice(1), 16);
					glow.blendMode = 'add';
					glow.alpha = 0;
					root.addChild(glow);
				}
				const lit = new PIXI.Sprite(this.tex(`stoplight_${color}`) ?? PIXI.Texture.EMPTY);
				lit.width = d.width;
				lit.height = d.height;
				lit.position.set(d.x - art.housing.x1, d.y - art.height / 2);
				lit.alpha = 0;
				root.addChild(lit);
				lens[color] = { lit, glow, alpha: 0 };
			}
			this.lightLayer.addChild(root);
			this.lights.push({ root, side, lanes: side > 0 ? [0, 1] : [2, 3], lens, showing: null, redOnReal: 0 });
		}
	}

	/** what a light shows now: Corey's ruling (constants STOPLIGHT), read off the road's own clock */
	private signalFor(light: Stoplight): SignalColor | null {
		if (this.signalForced !== undefined) return this.signalForced;
		if (!STOPLIGHT.lit) return null;
		if (!this.spinActive) return 'red';
		// a slam stop: red at once
		if (STOPLIGHT.slamRed && this.hurrying) return 'red';
		// the lanes it answers to: its own two, or the whole board (constants STOPLIGHT.follow)
		const F = STOPLIGHT.follow;
		let stop = -Infinity;
		let brake = Infinity;
		for (let lane = 0; lane < ROWS; lane++) {
			const mine = lane === light.lanes[0] || lane === light.lanes[1];
			if (mine || F.red === 'board') stop = Math.max(stop, this.laneStopAt[lane]);
			if (mine || F.amber === 'board') brake = Math.min(brake, this.laneBrakeAt[lane]);
		}
		// the book is not in yet (its traffic has no stop time): green
		if (stop === Infinity) return 'green';
		// RED leads the stop (never after it, never before the book's traffic set off)
		const redAt = Math.min(stop, Math.max(stop - Math.max(0, STOPLIGHT.lead.red), this.convoyAt));
		if (this.clock >= redAt) return 'red';
		// AMBER: after green's time, or a fixed time before the red, or at the first brake; in every case not before the
		// book's traffic set off, and at least minShowMs before the red
		const wanted =
			STOPLIGHT.amberFrom === 'beforeRed'
				? redAt - STOPLIGHT.amberMs
				: STOPLIGHT.amberFrom === 'brake'
					? brake
					: Math.min(this.spinStartAt + STOPLIGHT.greenMs, this.spinStartAt + (redAt - this.spinStartAt) / 2);
		const amberAt = Math.max(this.convoyAt, Math.min(wanted, redAt - STOPLIGHT.minShowMs));
		return this.clock >= amberAt ? 'amber' : 'green';
	}

	private updateLights(dtMs: number) {
		if (!this.lights.length) return;
		// for the signal the spin is over once every lane's last symbol is at its stop point
		if (this.spinActive && this.clock >= Math.max(this.laneStopAt[0], this.laneStopAt[1], this.laneStopAt[2], this.laneStopAt[3])) this.spinActive = false;
		const art = ROAD_ART.stoplight;
		const place = STOPLIGHT.layout[this.layoutKind];
		const lane = (LINES[ROWS] - LINES[0]) / ROWS;
		const k = (place.height * lane) / (art.housing.y1 - art.housing.y0);
		const step = STOPLIGHT.fadeMs > 0 ? dtMs / STOPLIGHT.fadeMs : 1;
		this.lightLayer.visible = STOPLIGHT.show;
		for (const light of this.lights) {
			// placed every frame from the tuning numbers (a handful of writes), so a change in the console shows at once
			const top = light.side > 0;
			const mid = top ? (LINES[0] + LINES[2]) / 2 : (LINES[2] + LINES[4]) / 2;
			const y = mid + (top ? place.along : -place.along);
			const mouth = mouthAt(top ? 'right' : 'left', y);
			light.root.position.set(mouth - light.side * place.protrude, y);
			light.root.scale.set(-light.side * k, k);
			// + tilt turns the lens edge toward the middle of the road: for both lights that is against the clock on screen
			light.root.rotation = (-place.tilt * Math.PI) / 180;
			const want = this.signalFor(light);
			if (want === 'red' && light.showing !== 'red') light.redOnReal = performance.now(); // DEV readout
			light.showing = want;
			const size = STOPLIGHT.glow.size;
			for (const color of SIGNAL_COLORS) {
				const l = light.lens[color];
				const target = want === color ? 1 : 0;
				// RED IS INSTANT (Corey: "turn Red as soon as the symbols stop"): on, and the others off, in this frame.
				// Green and amber fade over fadeMs.
				if (want === 'red') l.alpha = target;
				else if (l.alpha !== target) l.alpha = target > l.alpha ? Math.min(1, l.alpha + step) : Math.max(0, l.alpha - step);
				l.lit.alpha = l.alpha;
				if (l.glow) {
					l.glow.alpha = l.alpha * STOPLIGHT.glow.alpha;
					l.glow.visible = l.glow.alpha > 0.002;
					l.glow.width = size;
					l.glow.height = size;
				}
			}
		}
	}

	/** DEV: hold both lights on a color, or dark (null); call with no argument to hand them back to the board */
	forceSignal(color?: SignalColor | null) {
		this.signalForced = color;
	}

	// ---- the frame -------------------------------------------------------------------------------------------------------
	/** advance by `dtMs` of real time. `rate` is the board clock's speed (turbo, a slam stop); `hurry` also speeds the win hold. */
	update(dtMs: number, rate: number, hurry = 1) {
		if (this.destroyed) return;
		const dt = Math.min(dtMs, 100); // a tab that slept does not teleport the traffic
		this.clock += dt * rate;
		this.winClock += dt * hurry;
		this.hurrying = hurry > 1;
		const now = this.clock;

		// through traffic while a book is awaited
		const w = this.waiting;
		if (w && w.m.through.whileWaiting) {
			w.m.laneOrder.forEach((lane, k) => {
				if (now >= w.next[k]) {
					this.spawnThrough(lane, now, w.m);
					w.next[k] = now + w.m.through.gapMs * 2;
				}
			});
		}

		for (const car of this.cars) {
			if (car.phase === 'free') continue;
			const s = car.sprite;
			const m = car.m;
			if (car.phase === 'out' && m) {
				const tau = (now - car.t0) / 1000;
				if (tau > 0) {
					const cap = m.out.maxSpeed / m.out.accel;
					const dist = tau <= cap ? 0.5 * m.out.accel * tau * tau : 0.5 * m.out.accel * cap * cap + m.out.maxSpeed * (tau - cap);
					s.x = car.x0 + car.dir * dist;
					const u = (tau * 1000) / m.out.squatMs;
					s.rotation = u < 1 ? (-car.dir * m.out.squatDeg * Math.PI * Math.sin(Math.PI * u)) / 180 : 0;
					const gone = car.dir > 0 ? s.x > this.hiddenX(car, false) : s.x < this.hiddenX(car, false);
					if (gone) this.free(car);
				}
			} else if (car.phase === 'through' && m) {
				const tau = (now - car.t0) / 1000;
				if (tau >= 0) {
					s.visible = true;
					s.x = car.x0 + car.dir * m.cruise * tau;
					const gone = car.dir > 0 ? s.x > this.hiddenX(car, false) : s.x < this.hiddenX(car, false);
					if (gone) this.free(car);
				}
			} else if (car.phase === 'in' && m) {
				const left = car.stopAt - now; // ms until it stops
				if (left > 0) {
					const brake = m.in.brakeMs;
					// distance still to go to the stop point: a constant deceleration over the brake time, cruise before it
					const dist = left <= brake ? (m.cruise * left * left) / (2000 * brake) : (m.cruise * brake) / 2000 + (m.cruise * (left - brake)) / 1000;
					s.x = car.restX + car.dir * (car.overshoot - dist);
					const p = left <= brake ? 1 - left / brake : 0;
					s.rotation = car.dir * car.dive * p * p;
					const hidden = this.hiddenX(car, true);
					s.visible = car.dir > 0 ? s.x >= hidden : s.x <= hidden;
				} else {
					if (!car.stopped) {
						// DEV readout: this symbol is at its stop point now (snapshot().signalTiming)
						car.stopped = true;
						if (++this.laneStoppedCount[car.lane] === this.laneParked[car.lane]) this.laneStoppedReal[car.lane] = performance.now();
					}
					const u = -left / m.in.settleMs;
					if (u >= 1) {
						car.phase = 'rest';
						s.x = car.restX;
						s.rotation = 0;
					} else {
						// the rock back: a damped swing from the stop point onto the mark
						const g = Math.exp(-4 * u) * Math.cos(2 * Math.PI * m.in.settleSwings * u) * (1 - u);
						s.x = car.restX + car.dir * car.overshoot * g;
						s.rotation = car.dir * car.dive * g;
					}
					s.visible = true;
				}
			}
		}

		for (let lane = 0; lane < ROWS; lane++) {
			const at = this.laneStopSoundAt[lane];
			if (at !== null && now >= at) {
				this.laneStopSoundAt[lane] = null;
				this.onLaneStop?.(lane);
			}
		}

		this.updateWin();
		this.features.update(now);
		this.updateLights(dt);
		this.paint();

		if (this.waiters.length) {
			const due = this.waiters.filter((x) => (x.clock === 'board' ? this.clock : this.winClock) >= x.at);
			if (due.length) {
				this.waiters = this.waiters.filter((x) => !due.includes(x));
				for (const x of due) x.resolve();
			}
		}
	}

	private updateWin() {
		const win = this.win;
		if (!win) return;
		const t = this.winClock - win.t0;
		if (win.active) {
			const amount = this.winAmount;
			if (amount) {
				const u = Math.min(1, t / LINE_WIN.popMs);
				const e = 1 - (1 - u) * (1 - u);
				amount.scale.set(LINE_WIN.popFrom + (1 - LINE_WIN.popFrom) * e);
			}
			const u = Math.min(1, t / Math.max(1, win.holdMs));
			const swell = Math.sin(Math.PI * LINE_WIN.pulses * u);
			const k = 1 + (LINE_WIN.pulseScale - 1) * swell * swell;
			for (const car of this.cars) {
				if (car.phase !== 'rest') continue;
				car.sprite.scale.set(car.baseScale * (car.winning ? k : 1));
				const want = car.winning || !win.dim ? 1 : LINE_WIN.dim;
				car.bright += (want - car.bright) * 0.25;
			}
			if (t >= win.holdMs) win.active = false;
		} else {
			// the picture comes down: the overlay fades, the symbols come back
			this.winLayer.alpha = Math.max(0, this.winLayer.alpha - 0.12);
			let settled = this.winLayer.alpha <= 0;
			for (const car of this.cars) {
				if (car.phase === 'free') continue;
				if (car.phase === 'rest') car.sprite.scale.set(car.baseScale);
				car.bright += (1 - car.bright) * 0.25;
				if (car.bright < 0.995) settled = false;
				else car.bright = 1;
			}
			if (settled) {
				this.winLayer.visible = false;
				this.win = null;
			}
		}
	}

	/** the tunnel shadow and the win dim, as each sprite's tint (written only when it changes) */
	private paint() {
		const sh = ROAD.tunnelShade;
		for (const car of this.cars) {
			if (car.phase === 'free' || !car.sprite.visible) continue;
			const inside = Math.min(car.sprite.x - MOUTH_L, MOUTH_R - car.sprite.x);
			const u = Math.max(0, Math.min(1, (inside - sh.from) / Math.max(1, sh.to - sh.from)));
			const b = (sh.dark + (1 - sh.dark) * u * u * (3 - 2 * u)) * car.bright;
			const v = Math.max(0, Math.min(255, Math.round(b * 255)));
			const tint = (v << 16) | (v << 8) | v;
			if (tint !== car.tintNow) {
				car.tintNow = tint;
				car.sprite.tint = tint;
			}
		}
	}

	private wait(at: number, clock: 'board' | 'win'): Promise<void> {
		if (this.destroyed) return Promise.resolve();
		return new Promise<void>((resolve) => this.waiters.push({ at, clock, resolve }));
	}

	// ---- readouts ----------------------------------------------------------------------------------------------------------
	/** every symbol is parked on its mark and nothing is in flight */
	get atRest(): boolean {
		return this.cars.every((c) => c.phase === 'free' || c.phase === 'rest') && this.cars.filter((c) => c.phase === 'rest').length === this.parked;
	}

	/** what is drawn where, for the dev hook and the probes: board[reel][row] of the parked symbols, and how far each is off its mark */
	snapshot() {
		const board: (string | null)[][] = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => null));
		let maxDrift = 0;
		for (const car of this.cars) {
			if (car.phase !== 'rest') continue;
			board[car.col][car.lane] = car.symbol;
			maxDrift = Math.max(maxDrift, Math.abs(car.sprite.x - columnX(car.col)), Math.abs(car.sprite.y - laneSitY(car.lane)));
		}
		const phases: Record<string, number> = {};
		for (const car of this.cars) phases[car.phase] = (phases[car.phase] ?? 0) + 1;
		return { board, maxDrift, phases, sprites: this.cars.length, clock: Math.round(this.clock), atRest: this.atRest, winShowing: !!this.win?.active, features: this.features.snapshot(),
			signals: this.lights.map((l) => l.showing),
			// per lane: every one of its symbols has reached its stop point (read off the symbols)
			lanesStopped: this.laneStoppedCount.map((n, lane) => n === this.laneParked[lane]),
			// per light: ms from its two lanes' last symbol reaching its stop point to its red coming on (the last spin).
			// Negative = the red led the stop by that much.
			signalTiming: this.lights.map((l) => {
				const stopped = Math.max(this.laneStoppedReal[l.lanes[0]], this.laneStoppedReal[l.lanes[1]]);
				return { lanes: l.lanes, stoppedAt: Math.round(stopped * 10) / 10, redAt: Math.round(l.redOnReal * 10) / 10, gapMs: Math.round((l.redOnReal - stopped) * 10) / 10 };
			}),
		};
	}

	destroy() {
		this.destroyed = true;
		for (const w of this.waiters) w.resolve();
		this.waiters = [];
		this.features.destroy();
		this.root.destroy({ children: true });
	}
}
