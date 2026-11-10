// THE FEATURES ON THE ROAD: the reindeer's strike (its run in the snow above the board and its turn down into the
// target), the Grandma Wild (the crash cloud in one cell), the red box, and the full column Wilds with their three
// characters and their multipliers.
//
// Everything here is drawn in road px inside the road board's own container (game/road/roadBoard.ts adds the two
// layers and ticks this from its own update), and everything it shows was said by a book event: which cell, which
// tier, which multiplier. Nothing is rolled or chosen here; the reindeer's path is fixed presentation (STRIKE).
//
// No filter, mask or shader. The red box is plain colored quads. The cloud is "revealed" as the box grows by moving
// a texture's frame (a crop of the picture), and it stays inside the box because the entrance frames were cut to the
// column's width offline (tools/build_columns.py). The character is never cropped: it draws over the box and over
// the neighboring cells (spill over).
//
// THE DRAW ORDER (Corey 2026-11-10), bottom to top, each its own layer across ALL columns:
//   back     the red box on a Grandma car in a struck Santa reel (under the column, which grows over it), each column's
//            still cloud, and its entrance while the moving cloud is still in the frame
//   boxes    the red frames (outer frame only: no lines between the rows)
//   cells    the Grandma Wild cells (cloud, frame, WILD and number)
//   bodies   the characters with their spill over, reel 1 on top, then reel 2, down to reel 5 at the back,
//            whatever order they arrived in
//   numbers  every column's multiplier, over every character, so no neighbor's elbow can cover one
import * as PIXI from 'pixi.js';

import { ROAD_ART } from '../roadArtSpec';
import { CLOUD_CELL, COLUMN, RED_BOX, STRIKE } from '../constants';
import type { LayoutKind } from '../layoutSpec';
import type { ColumnTier, HeldColumn } from '../typesBookEvent';
import { getBackdrop, getClip, isWanted, loadBackdrop, loadClip, releaseClip, setStandingProbe, setUploadGate, type Clip } from './columnClips';

const ROWS = ROAD_ART.board.rows;
const PITCH = ROAD_ART.board.pitch;
const LINES = ROAD_ART.laneLines;
const BOARD_X = ROAD_ART.board.x;
const IMAGE_W = ROAD_ART.image.width;
const COLUMN_TOP = LINES[0];
const COLUMN_H = LINES[ROWS] - LINES[0];

type Tex = (frame: string) => PIXI.Texture | undefined;

/** digits from the atlas (white with a dark edge, tinted here): "12x". Sprites only, no text is ever rasterized. */
export class NumberLabel {
	readonly root = new PIXI.Container();
	private sprites: PIXI.Sprite[] = [];
	private shown = '';
	constructor(private readonly tex: Tex, private height: number, private tint: number) {}

	set(text: string, height = this.height, tint = this.tint) {
		if (text === this.shown && height === this.height && tint === this.tint) return;
		this.shown = text;
		this.height = height;
		this.tint = tint;
		const art = ROAD_ART.feature.numbers;
		const k = height / art.height;
		// the outlines of neighbors overlap a little, as set type does
		const tuck = art.height * 0.085;
		let x = 0;
		const widths = art.widths as Record<string, number>;
		const chars = [...text].filter((ch) => widths[ch] !== undefined);
		while (this.sprites.length < chars.length) {
			const s = new PIXI.Sprite();
			this.root.addChild(s);
			this.sprites.push(s);
		}
		this.sprites.forEach((s, i) => {
			const ch = chars[i];
			s.visible = ch !== undefined;
			if (ch === undefined) return;
			s.texture = this.tex(`num_${ch}`) ?? PIXI.Texture.EMPTY;
			s.width = widths[ch] * k;
			s.height = height;
			s.tint = tint;
			s.position.set(x, -height / 2);
			x += (widths[ch] - tuck) * k;
		});
		const total = x + tuck * k;
		for (const s of this.sprites) s.x -= total / 2;
	}
}

/** the red box: four sides with a dark line around them and nothing inside (Corey 2026-11-10: "We shouldn't have the
 *  inner lines", at every stage, growing or held). Plain white quads, tinted. */
class RedBox {
	readonly root = new PIXI.Container();
	private readonly outer: PIXI.Sprite[] = [];
	private readonly sides: PIXI.Sprite[] = [];
	constructor() {
		const quad = (tint: number, alpha = 1) => {
			const s = new PIXI.Sprite(PIXI.Texture.WHITE);
			s.tint = tint;
			s.alpha = alpha;
			this.root.addChild(s);
			return s;
		};
		for (let i = 0; i < 4; i++) this.outer.push(quad(RED_BOX.edgeColor));
		for (let i = 0; i < 4; i++) this.sides.push(quad(RED_BOX.color));
	}

	/** lay the box around a rectangle (road px) */
	set(x: number, y: number, w: number, h: number) {
		const frame = (list: PIXI.Sprite[], t: number, grow: number) => {
			const x0 = x - grow;
			const y0 = y - grow;
			const ww = w + 2 * grow;
			const hh = h + 2 * grow;
			list[0].position.set(x0, y0);
			list[0].width = ww;
			list[0].height = t;
			list[1].position.set(x0, y0 + hh - t);
			list[1].width = ww;
			list[1].height = t;
			list[2].position.set(x0, y0);
			list[2].width = t;
			list[2].height = hh;
			list[3].position.set(x0 + ww - t, y0);
			list[3].width = t;
			list[3].height = hh;
		};
		frame(this.outer, RED_BOX.width + 2 * RED_BOX.edge, RED_BOX.edge);
		frame(this.sides, RED_BOX.width, 0);
	}
}

const cellRect = (cell: number) => {
	const reel = Math.floor(cell / ROWS);
	const row = cell % ROWS;
	return { x: BOARD_X + reel * PITCH, y: LINES[row], w: PITCH, h: LINES[row + 1] - LINES[row] };
};
const inset = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + RED_BOX.inset, y: r.y + RED_BOX.inset, w: r.w - 2 * RED_BOX.inset, h: r.h - 2 * RED_BOX.inset });

type CloudCell = { cell: number; root: PIXI.Container; cloud: PIXI.Sprite; t0: number; leaving: number | null };

type Column = {
	reel: number;
	tier: ColumnTier;
	multiplier: number;
	sticky: boolean;
	/** under every red frame: the still cloud, the cloud while the box grows, and the entrance while its cloud shows */
	back: PIXI.Container;
	/** the still cloud that stays behind the character for as long as the column stands */
	backdrop: PIXI.Sprite;
	box: RedBox;
	/** the cloud while the box grows: the entrance's first frame, cropped to the box by its texture frame */
	cloud: PIXI.Sprite;
	cloudTex: PIXI.Texture | null;
	cellCloud: PIXI.Sprite;
	body: PIXI.Sprite;
	label: NumberLabel;
	/** impact (box on the struck cell), grow, enter (the entrance clip), idle, win (the win clip once), leave */
	phase: 'wait' | 'impact' | 'grow' | 'enter' | 'idle' | 'win' | 'leave';
	t0: number;
	/** the struck row the box grows from, or -1 (a column that starts whole: Super's opening column) */
	fromRow: number;
	labelShown: boolean;
	/** a Grandma Wild's multiplier joining the number (0 = none): the number shows multiplier - joinAdd first */
	joinAdd: number;
	frame: number;
	/** its entrance has played: the entrance's pictures may go as soon as it draws its idle */
	dropReveal: boolean;
};

/** the running reindeer: along the snow, the hold, the turn, down the screen. Times on the road's clock from t0. */
type Runner = {
	sprite: PIXI.Sprite;
	t0: number;
	/** which way it runs along the snow (1 = left to right) */
	dir: 1 | -1;
	fromX: number;
	/** the target reel's centre: where it stops, turns and runs down */
	toX: number;
	/** its feet in the snow, and its middle at the impact */
	feetY: number;
	impactY: number;
	snowScale: number;
	alongMs: number;
	downMs: number;
	/** a Grandma car to box as it starts down (a struck Santa reel), or null */
	markCell: number | null;
	marked: boolean;
};

type Waiter = { at: number; resolve: () => void };

/** what the board needs for a strike: the target cell, and the Grandma car to box in the same reel (or null) */
export type StrikeSpec = { cell: number; markCell: number | null };

/** the runner's speed along the snow: steady, then braking to a stop over the last `brake` share. 0 to 1 in, 0 to 1 out. */
const braking = (u: number, brake: number) => {
	const b = Math.max(0, Math.min(1, brake));
	const a = 1 - b;
	const v = 1 / (a + b / 2);
	if (u <= a || b === 0) return Math.min(1, v * u);
	const w = u - a;
	return Math.min(1, v * a + v * (w - (w * w) / (2 * b)));
};

export class RoadFeatures {
	/** boxes, clouds, characters and their numbers: over the traffic */
	readonly layer = new PIXI.Container();
	// the draw order, bottom to top (the note at the top of this file)
	private readonly backLayer = new PIXI.Container();
	private readonly boxLayer = new PIXI.Container();
	private readonly cellLayer = new PIXI.Container();
	private readonly bodyLayer = new PIXI.Container();
	private readonly numberLayer = new PIXI.Container();
	/** the running reindeer: over the line win as well */
	readonly runnerLayer = new PIXI.Container();
	private clouds: CloudCell[] = [];
	private columns: Column[] = [];
	private runner: Runner | null = null;
	/** the red boxes on Grandma cars in struck Santa reels, until their column covers them */
	private marks: { cell: number; box: RedBox }[] = [];
	private waiters: Waiter[] = [];
	private clock = 0;
	private destroyed = false;

	/** the road board hides or shows the symbol standing in a cell (the cloud and the column cover them) */
	hideCell: (cell: number, hidden: boolean) => void = () => {};
	/** a beat the handlers voice: the reindeer's impact, a column's box */
	onBeat: ((kind: 'impact' | 'column') => void) | null = null;
	/** the layout the road is drawn in (components/Board.svelte sets it): the run height in the snow is per layout */
	layoutKind: LayoutKind = 'landscape';

	constructor(private readonly tex: Tex) {
		this.layer.addChild(this.backLayer, this.boxLayer, this.cellLayer, this.bodyLayer, this.numberLayer);
		setStandingProbe((tier) => this.columns.some((c) => c.tier === tier));
		// the column pictures' upload queue (game/road/columnClips.ts) keeps out of an impact's frames, and goes at once
		// for a picture a column is waiting on
		setUploadGate({
			quiet: () => this.impactFrames(),
			needNow: (tier, name) => this.columns.some((c) => c.tier === tier && (name === 'reveal' ? c.phase === 'wait' : name === 'idle' ? c.phase === 'idle' && !getClip(tier, 'idle') : false)),
		});
	}

	/** THE FRAMES OF AN IMPACT, kept clear of GPU uploads: the reindeer's run down and its fade into the cloud, a Grandma
	 *  Wild's pop, and a column's box landing and growing */
	private impactFrames(): boolean {
		const r = this.runner;
		if (r && this.clock - r.t0 >= r.alongMs + STRIKE.holdMs + STRIKE.turnMs) return true;
		if (this.clouds.some((c) => c.leaving === null && this.clock - c.t0 < CLOUD_CELL.popMs + 60)) return true;
		return this.columns.some((c) => c.phase === 'wait' || c.phase === 'impact' || c.phase === 'grow');
	}

	// ---- the strike ----------------------------------------------------------------------------------------------------
	/** THE REINDEER RUNS (the PLACEHOLDER picture; constants STRIKE): in at one end of the snow bank above the road,
	 *  along it to the target's reel, a hold there, the turn, and straight down the screen into the target cell.
	 *  Resolves at the impact. */
	strike(spec: StrikeSpec): Promise<void> {
		const target = cellRect(spec.cell);
		const reel = Math.floor(spec.cell / ROWS);
		const toX = target.x + target.w / 2;
		// which end of the snow bank it comes in at (STRIKE.entry)
		const nearLeft = reel < 2;
		const entry = STRIKE.entry;
		const fromLeft = entry === 'left' ? true : entry === 'right' ? false : entry === 'near' ? nearLeft : !nearLeft;
		const dir: 1 | -1 = fromLeft ? 1 : -1;
		const snow = STRIKE.snow[this.layoutKind] ?? STRIKE.snow.landscape;
		const size = ROAD_ART.symbols.reindeer_run;
		const half = (size.width * Math.max(snow.scale, STRIKE.roadScale)) / 2;
		const fromX = fromLeft ? -half - STRIKE.enterPad : IMAGE_W + half + STRIKE.enterPad;
		const alongMs = Math.max(STRIKE.runMinMs, Math.min(STRIKE.runMaxMs, (Math.abs(toX - fromX) / STRIKE.runSpeed) * 1000));
		const impactY = target.y + target.h * STRIKE.impactAt;
		const startMid = snow.feetY - (size.height * snow.scale) / 2;
		const downMs = Math.max(STRIKE.downMinMs, Math.min(STRIKE.downMaxMs, (Math.abs(impactY - startMid) / STRIKE.downSpeed) * 1000));
		if (this.runner) this.runner.sprite.destroy();
		const sprite = new PIXI.Sprite(this.tex(fromLeft ? 'reindeer_run' : 'reindeer_run_L') ?? PIXI.Texture.EMPTY);
		// about its middle, so the turn leans it about its middle
		sprite.anchor.set(0.5);
		sprite.visible = false;
		this.runnerLayer.addChild(sprite);
		const t0 = this.clock + STRIKE.leadInMs;
		this.runner = { sprite, t0, dir, fromX, toX, feetY: snow.feetY, impactY, snowScale: snow.scale, alongMs, downMs, markCell: spec.markCell, marked: false };
		return this.wait(t0 + alongMs + STRIKE.holdMs + STRIKE.turnMs + downMs);
	}

	/** the red box on a Grandma car in a struck Santa reel: under the column, which grows over it (Corey 2026-11-10) */
	private markCell(cell: number) {
		const box = new RedBox();
		const b = inset(cellRect(cell));
		box.set(b.x, b.y, b.w, b.h);
		this.backLayer.addChild(box.root);
		this.marks.push({ cell, box });
	}

	private dropMarks(reel: number | null) {
		for (const m of [...this.marks]) {
			if (reel !== null && Math.floor(m.cell / ROWS) !== reel) continue;
			m.box.root.destroy({ children: true });
			this.marks = this.marks.filter((x) => x !== m);
		}
	}

	// ---- the Grandma Wild ------------------------------------------------------------------------------------------------
	/** the struck car's cell becomes the crash cloud with WILD and its multiplier, for this spin */
	grandmaWild(cell: number, multiplier: number): Promise<void> {
		const r = cellRect(cell);
		const root = new PIXI.Container();
		root.position.set(r.x + r.w / 2, r.y + r.h / 2);
		const cloud = new PIXI.Sprite(this.tex('cloud_cell') ?? PIXI.Texture.EMPTY);
		const box = new RedBox();
		const b = inset(r);
		cloud.anchor.set(0.5);
		cloud.width = b.w;
		cloud.height = b.h;
		box.set(-b.w / 2, -b.h / 2, b.w, b.h);
		const word = new PIXI.Sprite(this.tex('word_wild') ?? PIXI.Texture.EMPTY);
		const art = ROAD_ART.feature.wordWild;
		word.anchor.set(0.5);
		word.height = CLOUD_CELL.wordHeight;
		word.width = (art.width / art.height) * CLOUD_CELL.wordHeight;
		word.y = (CLOUD_CELL.wordY - 0.5) * r.h;
		const label = new NumberLabel(this.tex, CLOUD_CELL.numberHeight, CLOUD_CELL.numberTint);
		label.set(`${multiplier}x`);
		label.root.y = (CLOUD_CELL.numberY - 0.5) * r.h;
		root.addChild(cloud, box.root, word, label.root);
		root.scale.set(CLOUD_CELL.popFrom);
		this.cellLayer.addChild(root);
		this.clouds.push({ cell, root, cloud, t0: this.clock, leaving: null });
		this.hideCell(cell, true);
		this.onBeat?.('impact');
		return this.wait(this.clock + CLOUD_CELL.holdMs);
	}

	// ---- the column Wild ---------------------------------------------------------------------------------------------------
	private makeColumn(reel: number, tier: ColumnTier, multiplier: number, sticky: boolean, joinAdd = 0): Column {
		const back = new PIXI.Container();
		const backdrop = new PIXI.Sprite();
		const cloud = new PIXI.Sprite();
		const cellCloud = new PIXI.Sprite(this.tex('cloud_cell') ?? PIXI.Texture.EMPTY);
		const body = new PIXI.Sprite();
		const box = new RedBox();
		const label = new NumberLabel(this.tex, COLUMN.numberHeight, COLUMN.numberTint);
		label.set(`${multiplier - joinAdd}x`);
		label.root.visible = false;
		backdrop.visible = false;
		cloud.visible = false;
		cellCloud.visible = false;
		body.visible = false;
		// the clouds inside the box, the box over them, the character over the box (it may spill), its number on top:
		// each in its own layer, so the order holds across neighboring columns too
		back.addChild(backdrop, cellCloud, cloud, body);
		this.backLayer.addChild(back);
		this.boxLayer.addChild(box.root);
		this.numberLayer.addChild(label.root);
		void loadBackdrop();
		const column: Column = { reel, tier, multiplier, sticky, back, backdrop, box, cloud, cloudTex: null, cellCloud, body, label, phase: 'wait', t0: this.clock, fromRow: -1, labelShown: false, joinAdd, frame: -1, dropReveal: false };
		label.root.position.set(BOARD_X + (reel + 0.5) * PITCH, COLUMN_TOP + COLUMN_H - COLUMN.numberUp);
		this.columns.push(column);
		return column;
	}

	/** THE RED BOX GROWS to a full column: the cloud on the struck cell, the box to four rows, the cloud clearing as
	 *  the tier's character steps in, then its idle. Resolves when the character stands. `fromCell` null = it starts
	 *  whole (Super's opening column). `joinAdd`: a Grandma Wild's multiplier joining the number (0 = none). */
	async columnWild(reel: number, tier: ColumnTier, multiplier: number, sticky: boolean, fromCell: number | null, joinAdd = 0): Promise<void> {
		this.removeColumn(reel, true);
		const column = this.makeColumn(reel, tier, multiplier, sticky, joinAdd);
		column.fromRow = fromCell === null ? -1 : fromCell % ROWS;
		// 'wait': the box stands on the struck cell with the cell cloud until the tier's pictures are in. They usually are
		// (they started loading when the book arrived). A late or failed load never holds the round longer than
		// loadWaitMs: the column then stands as its box and its number.
		column.phase = 'wait';
		this.onBeat?.('column');
		const wait = <T>(p: Promise<T>) => Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), COLUMN.loadWaitMs))]);
		void loadClip(tier, 'idle');
		const reveal = await wait(loadClip(tier, 'reveal'));
		if (this.destroyed || !this.columns.includes(column) || column.phase !== 'wait') return;
		column.phase = 'impact';
		column.t0 = this.clock;
		const entrance = reveal ? (reveal.textures.length / reveal.fps) * 1000 : 200;
		// a joining Grandma Wild's sum shows after the column's own number (never under variant F)
		const join = joinAdd > 0 ? Math.max(0, entrance * COLUMN.numberAt + COLUMN.joinMs - entrance) : 0;
		await this.wait(this.clock + COLUMN.impactMs + COLUMN.growMs + entrance + join);
	}

	/** make the board's sticky columns exactly this list, with no entrance (the start of each free spin; a resume or a
	 *  replay builds its columns from this alone). Columns not in it, and every cloud cell, leave. A column that stands
	 *  keeps the number it landed with: nothing changes a held column's multiplier (Corey 2026-11-10: "I don't think
	 *  the column wilds should ever multiply from their original set value"; the book repeats it unchanged). */
	syncHeld(held: HeldColumn[]) {
		for (const cloud of this.clouds) if (cloud.leaving === null) cloud.leaving = this.clock;
		this.dropMarks(null);
		for (const column of [...this.columns]) {
			const want = held.find((h) => h.reel === column.reel);
			if (!want || want.tier !== column.tier) this.removeColumn(column.reel, false);
			else {
				column.sticky = true;
				// a book that disagrees is a fault in the book; it is said in DEV and the number on screen stays
				if (import.meta.env.DEV && want.multiplier !== column.multiplier) console.warn(`[reindeer] held column ${column.reel}: the book says ${want.multiplier}x, it landed with ${column.multiplier}x`);
			}
		}
		for (const h of held) {
			if (this.columns.some((c) => c.reel === h.reel && c.phase !== 'leave')) continue;
			const column = this.makeColumn(h.reel, h.tier, h.multiplier, true);
			column.phase = 'idle';
			column.t0 = this.clock;
			column.labelShown = true;
			column.label.root.visible = true;
			void loadClip(h.tier, 'idle');
			void loadClip(h.tier, 'win');
			for (let row = 0; row < ROWS; row++) this.hideCell(h.reel * ROWS + row, true);
		}
	}

	/** the press: the spin before is over, so every cloud cell and every column leaves */
	clearAll() {
		this.syncHeld([]);
	}

	private removeColumn(reel: number, instant: boolean) {
		for (const column of this.columns) {
			if (column.reel !== reel || column.phase === 'leave') continue;
			column.phase = 'leave';
			column.t0 = instant ? this.clock - COLUMN.leaveMs : this.clock;
		}
	}

	/** the columns a win runs through play their win clip once */
	winColumns(reels: number[]) {
		for (const column of this.columns) {
			if (!reels.includes(column.reel) || column.phase !== 'idle') continue;
			if (!getClip(column.tier, 'win')) {
				void loadClip(column.tier, 'win');
				continue;
			}
			column.phase = 'win';
			column.t0 = this.clock;
		}
	}

	/** is a column standing on this reel (the board skips its cells when traffic drives in)? */
	hasColumn(reel: number): boolean {
		return this.columns.some((c) => c.reel === reel && c.phase !== 'leave');
	}

	// ---- the frame ---------------------------------------------------------------------------------------------------------
	update(clock: number) {
		if (this.destroyed) return;
		this.clock = clock;
		this.updateRunner();
		this.updateClouds();
		for (const column of [...this.columns]) this.updateColumn(column);
		if (this.waiters.length) {
			const due = this.waiters.filter((w) => clock >= w.at);
			if (due.length) {
				this.waiters = this.waiters.filter((w) => !due.includes(w));
				for (const w of due) w.resolve();
			}
		}
	}

	private updateRunner() {
		const r = this.runner;
		if (!r) return;
		const t = this.clock - r.t0;
		if (t < 0) return;
		const s = r.sprite;
		const size = ROAD_ART.symbols.reindeer_run;
		const holdAt = r.alongMs;
		const turnAt = holdAt + STRIKE.holdMs;
		const downAt = turnAt + STRIKE.turnMs;
		const impactAt = downAt + r.downMs;
		if (t >= impactAt) {
			// the impact: it is gone into the cloud
			const u = (t - impactAt) / STRIKE.fadeMs;
			s.alpha = Math.max(0, 1 - u);
			if (u >= 1) {
				s.destroy();
				this.runner = null;
			}
			return;
		}
		s.visible = true;
		let k = r.snowScale;
		let sx = 1;
		let sy = 1;
		let x = r.toX;
		let rotation = 0;
		let mid: number;
		const snowMid = r.feetY - (size.height * r.snowScale) / 2;
		if (t < holdAt) {
			// along the snow, cantering, braking into the stop above the target's reel
			const u = t / Math.max(1, r.alongMs);
			x = r.fromX + (r.toX - r.fromX) * braking(u, STRIKE.brakeShare);
			const hop = Math.abs(Math.sin((t / 1000) * Math.PI * STRIKE.hopsPerSecond)) * STRIKE.hopPx * (r.snowScale / STRIKE.roadScale) * (1 - u * u);
			mid = snowMid - hop;
		} else if (t < turnAt) {
			// the anticipation: it stands over the reel and crouches, feet planted
			const u = (t - holdAt) / Math.max(1, STRIKE.holdMs);
			sy = 1 - (1 - STRIKE.crouch) * Math.sin(Math.PI * 0.5 * Math.min(1, u * 1.6));
			sx = 1 + (1 - sy) * 0.5;
			mid = r.feetY - (size.height * r.snowScale * sy) / 2;
		} else if (t < downAt) {
			// the turn: it leans head down about its middle, coming out of the crouch
			const u = (t - turnAt) / Math.max(1, STRIKE.turnMs);
			const e = 1 - (1 - u) * (1 - u);
			rotation = r.dir * ((STRIKE.downAngle * Math.PI) / 180) * e;
			sy = STRIKE.crouch + (1 - STRIKE.crouch) * e;
			sx = 1 + (1 - sy) * 0.5;
			mid = snowMid;
		} else {
			// down the screen, quickening, growing to its road size as it comes toward us
			if (!r.marked) {
				r.marked = true;
				if (r.markCell !== null) this.markCell(r.markCell);
			}
			const u = (t - downAt) / Math.max(1, r.downMs);
			const e = u * u;
			rotation = r.dir * ((STRIKE.downAngle * Math.PI) / 180);
			k = r.snowScale + (STRIKE.roadScale - r.snowScale) * e;
			mid = snowMid + (r.impactY - snowMid) * e;
		}
		s.rotation = rotation;
		s.width = size.width * k * sx;
		s.height = size.height * k * sy;
		s.position.set(x, mid);
	}

	private updateClouds() {
		for (const c of [...this.clouds]) {
			if (c.leaving !== null) {
				const u = (this.clock - c.leaving) / COLUMN.leaveMs;
				c.root.alpha = Math.max(0, 1 - u);
				if (u >= 1) {
					this.hideCell(c.cell, false);
					c.root.destroy({ children: true });
					this.clouds = this.clouds.filter((x) => x !== c);
				}
				continue;
			}
			const u = Math.min(1, (this.clock - c.t0) / CLOUD_CELL.popMs);
			// out past its size, then back onto it
			const over = CLOUD_CELL.popOver;
			const k = u < 0.7 ? CLOUD_CELL.popFrom + (over - CLOUD_CELL.popFrom) * (u / 0.7) : over + (1 - over) * ((u - 0.7) / 0.3);
			c.root.scale.set(k);
		}
	}

	/** where the character draws: under its red frame while the entrance's cloud is still in the picture (the cloud
	 *  belongs inside the box), or up among the characters, over every frame, once it stands alone (spill over) */
	private bodyOver(column: Column, over: boolean) {
		const parent = over ? this.bodyLayer : column.back;
		if (column.body.parent === parent) return;
		if (!over) {
			parent.addChild(column.body);
			return;
		}
		// among the characters: reel 1 on top, reel 5 at the back. The layer is kept in that order by where each one is
		// put in (never a zIndex: Pixi turns sorting on for the parent of any child given one, which would also re-sort
		// the column's own clouds).
		const behind = this.bodyLayer.children.filter((child) => this.reelOfBody(child) > column.reel).length;
		this.bodyLayer.addChildAt(column.body, behind);
	}

	private reelOfBody(body: PIXI.ContainerChild): number {
		return this.columns.find((c) => c.body === body)?.reel ?? -1;
	}

	/** a leaving column fades as one: its four parts live in four layers */
	private fadeColumn(column: Column, alpha: number) {
		column.back.alpha = alpha;
		column.box.root.alpha = alpha;
		column.body.alpha = alpha;
		column.label.root.alpha = alpha;
	}

	private destroyColumn(column: Column) {
		column.cloudTex?.destroy(false);
		// the character may be in either layer; it goes with the rest
		column.back.addChild(column.body);
		column.back.destroy({ children: true });
		column.box.root.destroy({ children: true });
		column.label.root.destroy({ children: true });
	}

	private placeBody(column: Column, clip: Clip, frame: number) {
		const k = COLUMN.tierScale[column.tier] ?? 1;
		const left = BOARD_X + column.reel * PITCH;
		// scaled about the middle of the column's foot
		const footX = left + PITCH / 2;
		const footY = COLUMN_TOP + COLUMN_H;
		const body = column.body;
		if (column.frame !== frame || body.texture !== clip.textures[frame]) {
			body.texture = clip.textures[frame] ?? PIXI.Texture.EMPTY;
			column.frame = frame;
		}
		body.width = clip.width * k;
		body.height = clip.height * k;
		body.position.set(footX + (clip.x - PITCH / 2) * k, footY + (clip.y - COLUMN_H) * k);
		body.visible = true;
	}

	private updateColumn(column: Column) {
		const t = this.clock - column.t0;
		const left = BOARD_X + column.reel * PITCH;
		const full = inset({ x: left, y: COLUMN_TOP, w: PITCH, h: COLUMN_H });
		const reveal = getClip(column.tier, 'reveal');
		const idle = getClip(column.tier, 'idle');

		if (column.phase === 'leave') {
			const u = t / COLUMN.leaveMs;
			this.fadeColumn(column, Math.max(0, 1 - u));
			if (u >= 1) {
				for (let row = 0; row < ROWS; row++) this.hideCell(column.reel * ROWS + row, false);
				this.destroyColumn(column);
				this.columns = this.columns.filter((c) => c !== column);
				// the tier's pictures go with its last column, unless the book being played still calls for the tier
				if (!this.columns.some((c) => c.tier === column.tier) && !isWanted(column.tier)) {
					releaseClip(column.tier, 'idle');
					releaseClip(column.tier, 'win');
					releaseClip(column.tier, 'reveal');
				}
			}
			return;
		}

		if (column.phase === 'wait' || column.phase === 'impact' || column.phase === 'grow') {
			// the box: on the struck cell, then growing to the four rows (from the middle when there is no struck cell)
			const from = column.fromRow >= 0 ? inset(cellRect(column.reel * ROWS + column.fromRow)) : { x: full.x, y: full.y + full.h / 2 - 4, w: full.w, h: 8 };
			let g = 0;
			if (column.phase === 'impact' && t >= COLUMN.impactMs) {
				column.phase = 'grow';
			}
			if (column.phase === 'grow') {
				const u = Math.min(1, (t - COLUMN.impactMs) / COLUMN.growMs);
				g = 1 - (1 - u) * (1 - u);
			}
			const y = from.y + (full.y - from.y) * g;
			const h = from.h + (full.h - from.h) * g;
			column.box.set(full.x, y, full.w, h);
			// the cloud in the box: the cell cloud at the impact, then the entrance's own first frame cropped to the box
			column.cellCloud.visible = column.phase !== 'grow' && column.fromRow >= 0;
			if (column.cellCloud.visible) {
				column.cellCloud.position.set(from.x, from.y);
				column.cellCloud.width = from.w;
				column.cellCloud.height = from.h;
				this.hideCell(column.reel * ROWS + column.fromRow, true);
			}
			// (the entrance's pictures can be gone: then the box grows empty and nothing stale is drawn)
			if (!reveal) column.cloud.visible = false;
			if (column.phase === 'grow' && reveal) {
				const first = reveal.textures[0];
				if (!column.cloudTex) {
					// dynamic: a sprite only follows a texture whose frame changes when the texture says it will change
					// (without it the cloud stayed one cell tall while the box grew)
					column.cloudTex = new PIXI.Texture({ source: first.source, frame: first.frame.clone(), dynamic: true });
					column.cloud.texture = column.cloudTex;
				}
				// the part of the picture that falls inside the box, by moving the texture's frame (a crop, not a mask)
				const perRoad = first.frame.height / reveal.height;
				const top = Math.max(0, y - (COLUMN_TOP + reveal.y));
				const shown = Math.min(reveal.height - top, h);
				column.cloudTex.frame.x = first.frame.x;
				column.cloudTex.frame.width = first.frame.width;
				column.cloudTex.frame.y = first.frame.y + top * perRoad;
				column.cloudTex.frame.height = Math.max(1, shown * perRoad);
				column.cloudTex.update();
				column.cloud.position.set(left + reveal.x, COLUMN_TOP + reveal.y + top);
				column.cloud.width = reveal.width;
				column.cloud.height = Math.max(1, shown);
				column.cloud.visible = true;
				// the symbols under the box as it passes them
				for (let row = 0; row < ROWS; row++) if (LINES[row + 1] > y && LINES[row] < y + h) this.hideCell(column.reel * ROWS + row, true);
			}
			if (column.phase === 'grow' && t >= COLUMN.impactMs + COLUMN.growMs) {
				// the column's cloud now covers the whole reel: a Grandma car's red box under it goes, and a Grandma Wild
				// standing in the reel (never under variant F) gives way to the column, her number joining its own
				this.dropMarks(column.reel);
				for (const c of this.clouds) if (Math.floor(c.cell / ROWS) === column.reel && c.leaving === null) c.leaving = this.clock;
				column.phase = 'enter';
				column.t0 = this.clock;
				column.cloud.visible = false;
				for (let row = 0; row < ROWS; row++) this.hideCell(column.reel * ROWS + row, true);
			}
			return;
		}

		column.box.set(full.x, full.y, full.w, full.h);
		column.cellCloud.visible = false;
		column.cloud.visible = false;
		// THE STILL CLOUD, wall to wall inside the frame, from the first frame of the entrance to the column's last. The
		// entrance's own first frames are a full cloud over it, so it is first seen as that moving cloud thins: the
		// hand-over is the clip's own fade, with no cut.
		const still = getBackdrop();
		if (still) {
			const backdrop = column.backdrop;
			if (backdrop.texture !== still) backdrop.texture = still;
			backdrop.position.set(full.x, full.y);
			backdrop.width = full.w;
			backdrop.height = full.h;
			backdrop.tint = COLUMN.backdropTint;
			backdrop.visible = true;
		}

		if (column.phase === 'enter') {
			const frames = reveal ? reveal.textures.length : 0;
			const length = reveal ? (frames / reveal.fps) * 1000 : 200;
			if (reveal) {
				const frame = Math.min(frames - 1, Math.floor((t / 1000) * reveal.fps));
				this.placeBody(column, reveal, frame);
				// while the cloud is still in the frame the box stands OVER it (the cloud is inside the box); once the
				// character stands alone it draws over the box (spill over)
				this.bodyOver(column, frame >= reveal.cloudFrames);
			} else {
				column.body.visible = false;
			}
			if (!column.labelShown && t >= length * COLUMN.numberAt) {
				column.labelShown = true;
				column.label.root.visible = true;
				column.label.root.scale.set(1.5);
			}
			this.joinNumber(column, t - length * COLUMN.numberAt);
			if (t >= length) {
				column.phase = 'idle';
				column.t0 = this.clock;
				// the entrance's pictures can go once this column is drawing its idle (below)
				column.dropReveal = true;
			}
		} else if (column.phase === 'win') {
			const win = getClip(column.tier, 'win');
			const length = win ? (win.textures.length / win.fps) * 1000 : 0;
			if (!win || t >= length) {
				column.phase = 'idle';
				column.t0 = this.clock;
			} else {
				this.bodyOver(column, true);
				this.placeBody(column, win, Math.min(win.textures.length - 1, Math.floor((t / 1000) * win.fps)));
			}
		}
		if (column.phase === 'idle' && idle) {
			// each column a little out of step with its neighbors, so two of a kind do not move as one
			const frame = Math.floor((t / 1000) * idle.fps + column.reel * 5) % idle.textures.length;
			this.bodyOver(column, true);
			this.placeBody(column, idle, frame);
			if (column.dropReveal) {
				// nothing of this column draws the entrance any more: its cloud crop goes, and the entrance's sheets with it
				// unless another column of the tier is still on its way in
				column.dropReveal = false;
				column.cloud.texture = PIXI.Texture.EMPTY;
				column.cloudTex?.destroy(false);
				column.cloudTex = null;
				const busy = (c: Column) => c !== column && c.tier === column.tier && (c.phase === 'wait' || c.phase === 'impact' || c.phase === 'grow' || c.phase === 'enter' || c.dropReveal);
				if (!this.columns.some(busy)) releaseClip(column.tier, 'reveal');
			}
		}

		// a join still due when the entrance ended (a short entrance) shows now
		if (column.joinAdd > 0 && column.phase !== 'enter') this.joinNumber(column, Infinity);
		// the number settles from its pop; it never changes once it stands
		const label = column.label.root;
		label.scale.set(label.scale.x + (1 - label.scale.x) * 0.2);
	}

	/** a Grandma Wild's multiplier joining the column's number, joinMs after it popped in: the sum, with a second pop */
	private joinNumber(column: Column, sincePop: number) {
		if (column.joinAdd <= 0 || !column.labelShown || sincePop < COLUMN.joinMs) return;
		column.joinAdd = 0;
		column.label.set(`${column.multiplier}x`);
		column.label.root.scale.set(1.5);
	}

	private wait(at: number): Promise<void> {
		if (this.destroyed) return Promise.resolve();
		return new Promise<void>((resolve) => this.waiters.push({ at, resolve }));
	}

	/** where the runner is in its strike (dev hook and the probes) */
	private runnerPhase(r: Runner): 'wait' | 'along' | 'hold' | 'turn' | 'down' | 'impact' {
		const t = this.clock - r.t0;
		if (t < 0) return 'wait';
		if (t < r.alongMs) return 'along';
		if (t < r.alongMs + STRIKE.holdMs) return 'hold';
		if (t < r.alongMs + STRIKE.holdMs + STRIKE.turnMs) return 'turn';
		return t < r.alongMs + STRIKE.holdMs + STRIKE.turnMs + r.downMs ? 'down' : 'impact';
	}

	/** what stands on the road (dev hook and the probes) */
	snapshot() {
		return {
			columns: this.columns.filter((c) => c.phase !== 'leave').map((c) => ({ reel: c.reel, tier: c.tier, multiplier: c.multiplier, sticky: c.sticky, phase: c.phase, drawn: c.body.visible, backdrop: c.backdrop.visible, over: c.body.parent === this.bodyLayer })),
			// the characters as they are drawn, back to front (reel numbers from 0)
			bodyOrder: this.bodyLayer.children.map((b) => this.reelOfBody(b)),
			clouds: this.clouds.filter((c) => c.leaving === null).map((c) => c.cell),
			runner: this.runner ? { phase: this.runnerPhase(this.runner), x: Math.round(this.runner.sprite.x), y: Math.round(this.runner.sprite.y), rotation: +this.runner.sprite.rotation.toFixed(2) } : null,
			/** the red boxes on Grandma cars in struck Santa reels */
			marks: this.marks.map((m) => m.cell),
		};
	}

	destroy() {
		this.destroyed = true;
		for (const w of this.waiters) w.resolve();
		this.waiters = [];
	}
}
