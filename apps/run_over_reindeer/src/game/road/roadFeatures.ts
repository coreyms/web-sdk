// THE FEATURES ON THE ROAD: the reindeer's strike (its run in the snow above the board, its turn down the gap between
// two reels and its last diagonal cut into the target), the Grandma Wild (the crash cloud in one cell), the red box, and the full column Wilds with their three
// characters and their multipliers.
//
// Everything here is drawn in road px inside the road board's own container (game/road/roadBoard.ts adds the two
// layers and ticks this from its own update), and everything it shows was said by a book event: which cell, which
// tier, which multiplier. Nothing is rolled or chosen here; the reindeer's path is fixed presentation (STRIKE).
//
// No filter, mask or shader. THE FRAMES (since 2026-11-19) are the tinsel garland, baked tiles, corners and baubles in
// one look per character (game/road/garland.ts, constants WILD_FRAME); before that, and until the garland's atlas is in,
// the red box's plain colored quads. The entrance plays from the moment the box starts to grow, each frame "revealed"
// to the box as it grows by moving a texture's frame (a crop of the picture), and it stays inside the box because the
// entrance frames were cut to the column's width offline (tools/build_columns.py). The character is cropped the same
// way to its box's outer edge, and its frame is drawn over it (since 2026-11-15; it used to spill over the box and the
// neighboring cells).
//
// THE DRAW ORDER (Corey 2026-11-10; the characters under the frames since 2026-11-15), bottom to top, each its own
// layer across ALL columns:
//   back     the red box on a Grandma car in a struck Santa reel (under the column, which grows over it), each column's
//            still cloud, its character's cast shadow on that cloud (constants SHADOW), and its entrance while the
//            moving cloud is still in the frame
//   stacks   one per reel, reel 5 at the back and reel 1 on top, each (bottom to top):
//              right  the full column's RIGHT band (its red and its dark lines), under its character (Corey 2026-11-16:
//                     "keep the left, top, bottom border as a character boundary, but let them overlap on the right
//                     borders")
//              body   the character, cropped to its own box by its texture's frame at the left, top and bottom (Corey
//                     2026-11-15: "I'd like their feet to be behind the borders ... the same for the top border"), not
//                     on the right once it stands clear of its entrance's cloud: there it draws over its right band and
//                     on past the box
//              left   the full column's LEFT band, over its own character
//            so a character that spills past its right band draws over the left band (and the character) of the
//            column to its right (Corey 2026-11-17: "the characters spill over should be left to right, so Santa's
//            Elbow here should be above the left hand border from the Reindeer column")
//   rails    the full columns' top and bottom bands, over every character. A rail's dark quad stops at its red's inner
//            edge and its inner dark line runs between the two side bands' reds only, so each frame draws as one clean
//            rectangle with its sides in other layers (until 2026-11-17 a full width inner line lay across the right
//            band's red as a notch at its top and bottom)
//   cells    the Grandma Wild cells (cloud, frame, WILD and number)
//   numbers  every column's multiplier, over everything (and, in a win, the copies that fly to a line's multiplier)
// THE MULTIPLIERS on a Grandma Wild and a column are game/road/wildMult.ts (Corey 2026-11-19, "E Candy Cane"); the
// atlas digits below (NumberLabel) stay the line win's multiplier's (game/road/winLights.ts, roadBoard winMult).
import * as PIXI from 'pixi.js';

import { ROAD_ART } from '../roadArtSpec';
import { CLOUD_CELL, COLUMN, CROSSHAIR, RED_BOX, REINDEER_SOUND, ROAM, SHADOW, STRIKE, WILD_FRAME, WILD_MULT, type GarlandLook } from '../constants';
// BRAWL (game/road/brawlCloud.ts, constants GRANDMA_BRAWL): the Grandma Wild's animated cloud; its hooks here are marked BRAWL
import { ROAD as ROAD_C, GRANDMA_BRAWL } from '../constants';
import { Brawl, type BrawlCell, type StrikeEnd } from './brawlCloud';
import type { LayoutKind } from '../layoutSpec';
import type { ColumnTier, HeldColumn } from '../typesBookEvent';
import { getBackdrop, getClip, isWanted, loadBackdrop, loadClip, releaseClip, setStandingProbe, setUploadGate, type Clip } from './columnClips';
import { COLUMN_CLIPS } from '../columnClipSpec';
import { REINDEER_RUN } from '../reindeerRunSpec';
import { awaitRunViews, runBox, runFrame, type RunView } from './reindeerRun';
import { CrosshairArt, easeOut, hashText, planCrosshair, sample, type CrosshairPlan, type CrosshairState, type Rect } from './crosshair';
import { RoadSounds } from './roadSounds';
import { castShadow, dropShadow, makeShadow, shadowStrength } from './shadows';
import { Roam, roamDev } from './roam';
import { ChargeFx, planWindup, windupFrame, type WindupPlan } from './chargeWindup';
import { REINDEER_ROAM } from '../reindeerRoamSpec';
import type { RoadRect } from '../roamPaths';
import { WildMult } from './wildMult';
import { GarlandFrame } from './garland';

const ROWS = ROAD_ART.board.rows;
const COLS = ROAD_ART.board.columns;
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
 *  inner lines", at every stage, growing or held). Plain white quads, tinted. Since 2026-11-19 the Wilds' frames are the
 *  tinsel garland (game/road/garland.ts); this box is what a garland draws until its atlas is on the GPU, in the
 *  tinsel's own color (WILD_FRAME.plain). */
class RedBox {
	readonly root = new PIXI.Container();
	private readonly outer: PIXI.Sprite[] = [];
	private readonly sides: PIXI.Sprite[] = [];
	/** `split` (a full column): the right band (its dark lines and its red) is in rightRoot, a layer under its own
	 *  character; the left band in leftRoot, over its own character but under the character of the column to its left;
	 *  root keeps the top and bottom bands (the rails), over every character */
	readonly rightRoot: PIXI.Container | null;
	readonly leftRoot: PIXI.Container | null;
	/** split only: the rails' inner dark lines, run between the two side bands' reds (top, bottom). A rail's dark quad
	 *  stops at its red's inner edge, so no dark line of a rail ever lies across a side band's red: the side bands are
	 *  in other layers, and a full width inner line drew over them as a notch at each inner corner (2026-11-17) */
	private readonly inner: PIXI.Sprite[] = [];
	constructor(split = false, color: number = RED_BOX.color) {
		this.rightRoot = split ? new PIXI.Container() : null;
		this.leftRoot = split ? new PIXI.Container() : null;
		const quad = (tint: number, side: number) => {
			const s = new PIXI.Sprite(PIXI.Texture.WHITE);
			s.tint = tint;
			(side === 3 && this.rightRoot ? this.rightRoot : side === 2 && this.leftRoot ? this.leftRoot : this.root).addChild(s);
			return s;
		};
		for (let i = 0; i < 4; i++) this.outer.push(quad(RED_BOX.edgeColor, i));
		for (let i = 0; i < 4; i++) this.sides.push(quad(color, i));
		if (split) for (let i = 0; i < 2; i++) this.inner.push(quad(RED_BOX.edgeColor, i));
	}

	/** the red lines as laid: top, bottom, left, right; a line not yet traced has no length (the probes read them) */
	lines() {
		return this.sides.map((q) => ({ y: q.y, width: q.visible ? q.width : 0, height: q.visible ? q.height : 0 }));
	}

	/** lay the box around a rectangle (road px). `drawn` (0 to 1) is how much of it has been traced: from the top left
	 *  corner along the top, down the right side, back along the bottom and up the left side. 1 = the whole box.
	 *  `width`: the red band's thickness inside the rectangle (RED_BOX.width; a full column's is COLUMN.frameWidth). The
	 *  dark line around it is RED_BOX.edge either side, so the outer edge stays where it was whatever the width. */
	set(x: number, y: number, w: number, h: number, drawn = 1, width = RED_BOX.width) {
		const frame = (list: PIXI.Sprite[], t: number, grow: number) => {
			const x0 = x - grow;
			const y0 = y - grow;
			const ww = w + 2 * grow;
			const hh = h + 2 * grow;
			const d = Math.max(0, Math.min(1, drawn)) * 2 * (ww + hh);
			const part = (from: number, length: number) => Math.max(0, Math.min(length, d - from));
			const top = part(0, ww);
			const right = part(ww, hh);
			const bottom = part(ww + hh, ww);
			const leftSide = part(2 * ww + hh, hh);
			list[0].position.set(x0, y0);
			list[0].width = top;
			list[0].height = t;
			list[0].visible = top > 0;
			list[1].position.set(x0 + ww - bottom, y0 + hh - t);
			list[1].width = bottom;
			list[1].height = t;
			list[1].visible = bottom > 0;
			list[2].position.set(x0, y0 + hh - leftSide);
			list[2].width = t;
			list[2].height = leftSide;
			list[2].visible = leftSide > 0;
			list[3].position.set(x0 + ww - t, y0);
			list[3].width = t;
			list[3].height = right;
			list[3].visible = right > 0;
			return { top, bottom };
		};
		const traced = frame(this.outer, width + 2 * RED_BOX.edge, RED_BOX.edge);
		frame(this.sides, width, 0);
		if (!this.inner.length) return;
		// SPLIT: each rail's dark quad covers its outer line and the red only (the red lies over it); its inner dark line
		// is its own quad, from the left band's red to the right band's red, cut to the part of the rail traced so far
		const e = RED_BOX.edge;
		const [oTop, oBottom] = this.outer;
		oTop.height = e + width;
		oBottom.y = y + h - width;
		oBottom.height = width + e;
		const x0 = x - e;
		const ww = w + 2 * e;
		const a = x + width;
		const b = x + w - width;
		const topEnd = Math.min(b, x0 + traced.top);
		const bottomStart = Math.max(a, x0 + ww - traced.bottom);
		const [iTop, iBottom] = this.inner;
		iTop.position.set(a, y + width);
		iTop.width = Math.max(0, topEnd - a);
		iTop.height = e;
		iTop.visible = iTop.width > 0;
		iBottom.position.set(bottomStart, y + h - width - e);
		iBottom.width = Math.max(0, b - bottomStart);
		iBottom.height = e;
		iBottom.visible = iBottom.width > 0;
	}

	/** split only, the probes: the box's quads as drawn (road px), by part */
	parts() {
		const q = (s: PIXI.Sprite) => (s.visible ? { x: s.x, y: s.y, w: s.width, h: s.height } : null);
		return { outer: this.outer.map(q), sides: this.sides.map(q), inner: this.inner.map(q) };
	}
}

/** A WILD'S FRAME (constants WILD_FRAME, game/road/garland.ts): the tinsel garland in its look, with the red box's
 *  quads in its tinsel's color as its plain box until the frame atlas is in */
const makeFrame = (split: boolean, look: GarlandLook, place: 'col' | 'cell', seed: number) => new GarlandFrame(split, look, place, new RedBox(split, WILD_FRAME.plain[look.tinsel]), seed);

const cellRect = (cell: number) => {
	const reel = Math.floor(cell / ROWS);
	const row = cell % ROWS;
	return { x: BOARD_X + reel * PITCH, y: LINES[row], w: PITCH, h: LINES[row + 1] - LINES[row] };
};
const inset = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + RED_BOX.inset, y: r.y + RED_BOX.inset, w: r.w - 2 * RED_BOX.inset, h: r.h - 2 * RED_BOX.inset });
/** where a full column's pictures are cut: the inside of its frame's dark outer line (its red band's outer edge), so the
 *  cut lies under the band and no filtered edge texel reaches past the dark line at any render resolution */
const columnInside = (reel: number) => inset({ x: BOARD_X + reel * PITCH, y: COLUMN_TOP, w: PITCH, h: COLUMN_H });

/** voiced: its crash has played (its first frame); wildVoiced: the Grandma Wild's sound (its pop settled) */
type CloudCell = { cell: number; root: PIXI.Container; cloud: PIXI.Sprite; box: GarlandFrame; t0: number; leaving: number | null; voiced: boolean; wildVoiced: boolean; num: WildMult; multiplier: number; brawl: BrawlCell | null };

/** the target crosshair of the strike under way (constants CROSSHAIR, game/road/crosshair.ts) */
type Crosshair = {
	plan: CrosshairPlan;
	art: CrosshairArt;
	/** the road clock when it showed */
	start: number;
	/** the crash: when its frame began to close onto the red box (null before), and over how long */
	morphAt: number | null;
	morphMs: number;
	/** where it stood at the crash: its frame and its arm length */
	morphFrom: { rect: Rect; arm: number } | null;
	/** the leg of the plan drawn last (the hop and lock beats), the candidates already dropped */
	leg: number;
	dropped: Set<number>;
	/** as drawn now (the probes' trace) */
	state: CrosshairState;
	on: number;
	scale: number;
	rect: Rect;
};

type Column = {
	reel: number;
	tier: ColumnTier;
	multiplier: number;
	sticky: boolean;
	/** under every frame: the still cloud, the cloud while the box grows, and the entrance while its cloud shows */
	back: PIXI.Container;
	/** the still cloud that stays behind the character for as long as the column stands */
	backdrop: PIXI.Sprite;
	/** its frame (the tinsel garland, WILD_FRAME) */
	box: GarlandFrame;
	/** the entrance while the box grows (since 2026-11-19 it plays from the grow's start, Corey: "Is it possible to have
	 *  the video alreday playing within the border boundaries while it grows?"): its frame of the moment, cropped to the
	 *  box by its texture frame (or the still cloud, cropped the same way, while the entrance's pictures are not in) */
	cloud: PIXI.Sprite;
	cloudTex: PIXI.Texture | null;
	cellCloud: PIXI.Sprite;
	body: PIXI.Sprite;
	/** its multiplier (game/road/wildMult.ts), in the numbers layer */
	label: WildMult;
	/** the board ms a Grandma Wild's join slams the sum down (its stamp), or null */
	stampAt: number | null;
	/** impact (box on the struck cell), grow, enter (the entrance clip), idle, win (the win clip once), leave */
	phase: 'wait' | 'impact' | 'grow' | 'enter' | 'idle' | 'win' | 'leave';
	t0: number;
	/** when the box began to be traced around the struck cell, and this column's times on the cell and growing */
	boxT0: number;
	/** the crosshair closes onto this column's box (its draw-on is the crosshair's morph): the box shows once it is done */
	xhBox: boolean;
	/** a landing board column (showLanding): one still frame and the cloud still from the landing sheet. Once the tier's
	 *  idle clip is in (loadLandingIdle) it plays that loop from the still's own frame (`from`), so the hand-over has no
	 *  pop; `live` = it has; until then, and if the clip goes again, the still */
	still: { clip: Clip; backdrop: PIXI.Texture; from: number; live: boolean } | null;
	impactMs: number;
	growMs: number;
	/** the struck row the box grows from, or -1 (a column that starts whole: Super's opening column) */
	fromRow: number;
	labelShown: boolean;
	/** a Grandma Wild's multiplier joining the number (0 = none): the number shows multiplier - joinAdd first */
	joinAdd: number;
	frame: number;
	/** its entrance has played: the entrance's pictures may go as soon as it draws its idle */
	dropReveal: boolean;
	/** THE SOUNDS (game/road/roadSounds.ts): its crash has played (the cell cloud's first frame), its entrance's
	 *  footstep has played, its entrance frame shows the cloud still filling the box, and its idle loop's count (the
	 *  snort's roll) with the t0 it was counted from */
	crashVoiced: boolean;
	stepVoiced: boolean;
	/** its win clip's sound has played (reset each time the clip starts) */
	winVoiced: boolean;
	enterCloud: boolean;
	idleLoop: number;
	idleT0: number;
	/** ITS CAST SHADOW on the column's cloud (constants SHADOW): the character's twin, its own cropped texture (made on
	 *  first use), and when it began to show (NaN: not yet) */
	foot: PIXI.Sprite;
	footTex: PIXI.Texture | null;
	footT0: number;
	/** the character's own cropped texture (placeBody: its clip frame cut to the box), made on first use */
	bodyTex: PIXI.Texture | null;
	/** the still cloud cut to the growing box (placeStill), made on first use */
	stillTex: PIXI.Texture | null;
};

/** the running reindeer (constants STRIKE, game/road/reindeerRun.ts): the side run in the snow, one pose of S, the
 *  diagonal in Q, one pose of M, the run down the GAP beside the target's reel in C, and the last diagonal cut into the
 *  target in Q (planStrike). It is counted in POSES of the 16 pose run cycle (a float: pose 3.4 shows pose index 3, 0.4
 *  of the way to the next place); positions are its FEET (the views' anchor), road px. */
type Runner = {
	sprite: PIXI.Sprite;
	/** the road clock when it sets off (after the lead in) */
	t0: number;
	/** the pose drawn now (from the time since t0; a protected pose may hold it back for one frame) */
	pose: number;
	/** the pose index drawn last (-1 before the first), and this frame's protected pose: how late it is drawn, ms of the
	 *  road clock behind its own time (null when this frame shows the pose its time asks for) */
	shown: number;
	late: number | null;
	/** which way it runs along the snow (1 = left to right; -1 is the same views mirrored) */
	dir: 1 | -1;
	/** the target reel's centre (the impact), and the gap it runs down (a reel's edge) */
	toX: number;
	gapX: number;
	/** which way the last cut runs (toward the target's centre; mirrored views for -1) */
	cutDir: 1 | -1;
	/** its feet in the snow */
	feetY: number;
	snowScale: number;
	/** poses of the side run and of the diagonal; the poses along the snow in all (R, one S, Q, one M); the run down the
	 *  gap (C); the last cut (Q) */
	nR: number;
	nQ: number;
	nAlong: number;
	nC: number;
	nCut: number;
	/** the stride (1 to 16) of its first pose: (7 - nAlong) mod 16, so the run down starts on pose 7 */
	s0: number;
	/** the side run's step against runSpeed / strideFps (1 = as tuned) */
	factor: number;
	/** its feet at each pose boundary, 0 .. nAlong + nC + nCut (the last is the impact point), and the road clock ms
	 *  from t0 at each (planStrike) */
	path: { x: number; y: number }[];
	times: number[];
	/** its feet at the impact (its middle at STRIKE.impactAt of the target cell, at the road scale) */
	impactFeetY: number;
	/** the road clock at the impact (null until then) */
	impactAt: number | null;
	resolve: () => void;
	/** the run views were not in: the placeholder picture stands in for every view */
	placeholder: boolean;
	/** what it drew last (the probes' per-frame log) */
	view: RunView;
	stride: number;
	scale: number;
	/** a Grandma car to box as it starts down (a struck Santa reel), or null */
	markCell: number | null;
	marked: boolean;
	/** THE SOUNDS (game/road/roadSounds.ts): the strike's first frame (the alert), the set off (the run loop), the turn,
	 *  the last cut */
	alerted: boolean;
	setOff: boolean;
	turned: boolean;
	cut: boolean;
	/** the dart's whoosh has been cued (REINDEER_SOUND dart) */
	darted: boolean;
	/** THE SNORT AT THE LOCK (his own strike, REINDEER_SOUND.snort.lockPeakMs): asked once (played or kept quiet) */
	snorted: boolean;
	/** HIS CAST SHADOW (constants SHADOW): his twin, on the road's ground under the traffic */
	shadow: PIXI.Sprite;
	/** the plan's numbers for the probes: the old straight path's time to the impact (kept), and whether it was kept */
	keepMs: number;
	kept: boolean;
	/** THE ROAMING REINDEER'S STRIKE (STRIKE.roam, game/road/roam.ts): made by the one standing on the screen. preN poses
	 *  of a side run back out first (facing preDir; 0 when the turn fits from where he stands); the off-screen strike's
	 *  own time to the impact (todayMs, from its set off) and how much later than its set off this one sets off (waitMs;
	 *  negative: the start of his run is cut) */
	roam: boolean;
	preN: number;
	preDir: 1 | -1;
	todayMs: number;
	waitMs: number;
	/** the last strike of its spin (the book): the next roaming reindeer walks in after its impact */
	last: boolean;
	/** BRAWL: the target cell, a Grandma car (its end at the car's rear: endX, endY) */
	cell: number;
	grandma: boolean;
	endX: number;
	endY: number;
};

/** a turned view's step on the screen: which way it runs (dx across, dy down, per unit of ground step) and how long
 *  its step looks against the side run's (the ground step seen from the camera at STRIKE.cameraDeg above the ground) */
const viewStep = (view: RunView) => {
	const turn = (runBox(view).turnDeg * Math.PI) / 180;
	const lift = Math.sin((STRIKE.cameraDeg * Math.PI) / 180);
	const across = Math.cos(turn);
	const down = Math.sin(turn) * lift;
	return { dx: across, dy: down, length: Math.hypot(across, down) };
};

/** the C poses the sheets carry in a row from pose 7 (7 to 16, 1, 2: 12). The run down never runs past them. */
const C_SAFE = (() => {
	const packed = new Set<number>(REINDEER_RUN.views.C.strides as readonly number[]);
	let n = 0;
	while (n < 16 && packed.has(((6 + n) % 16) + 1)) n++;
	return n;
})();

export type RunPlan = { nR: number; nQ: number; nAlong: number; s0: number; step: number; factor: number };

/** THE PLAN OF THE RUN ALONG THE SNOW (a pure function; the strike uses it, the probe checks it). `distance`: road px
 *  across from where it sets off to the target reel's centre. `startPose` null: free start (stage 1: it comes in from
 *  off the screen, so it starts on whatever pose the (7 - n) rule asks for; the step is trimmed by under 1 / (2 n)).
 *  `startPose` a number (stage 2: the take-off clip hands over on that pose): the side run's poses are chosen so that n
 *  = (7 - startPose) mod 16, and the step is scaled by `factor` to fit the distance; null when no such n is within
 *  maxFactor of the tuned step. */
export const planRun = (distance: number, diagonal: number, startPose: number | null = null, maxFactor = STRIKE.startFactorMax): RunPlan | null => {
	const S = viewStep('S');
	const Q = viewStep('Q');
	const M = viewStep('M');
	const step0 = STRIKE.runSpeed / STRIKE.strideFps;
	const nQ = Math.max(1, Math.round(diagonal / (step0 * Q.length)));
	const across = S.dx + nQ * Q.dx + M.dx;
	const make = (nR: number) => {
		const step = distance / (nR + across);
		const nAlong = nR + nQ + 2;
		return { nR, nQ, nAlong, s0: ((((7 - nAlong - 1) % 16) + 16) % 16) + 1, step, factor: step / step0 };
	};
	if (startPose === null) return make(Math.max(1, Math.round(distance / step0 - across)));
	// n = nR + nQ + 2 must be (7 - startPose) mod 16: the side run's pose counts that do it, nearest the tuned step first
	const want = (((7 - startPose - nQ - 2) % 16) + 16) % 16;
	const ideal = distance / step0 - across;
	let best: RunPlan | null = null;
	for (let nR = want === 0 ? 16 : want; nR <= ideal * (1 + maxFactor) + 32; nR += 16) {
		const plan = make(nR);
		if (!best || Math.abs(plan.factor - 1) < Math.abs(best.factor - 1)) best = plan;
	}
	if (best && best.s0 !== (((startPose - 1) % 16) + 16) % 16 + 1) throw new Error('planRun: the start pose rule broke');
	return best && Math.abs(best.factor - 1) <= maxFactor + 1e-9 ? best : null;
};

/** THE GAP HE RUNS DOWN (Corey 2026-11-15: "the reindeer should probably run between the traffic and take another
 *  diagonal turn at the very end to get to the strike point"): the edge of the target's reel on the side he comes from
 *  (he reaches it first, and the last cut then runs on the way he was going), or the reel's inner edge when that side
 *  is the board's outer edge (reel 1 from the left, reel 5 from the right: the road's shoulder by the tunnel). At the
 *  default entry ('far': reels 1 and 2 from the right, 3 to 5 from the left) that is always the gap nearer the
 *  board's centre. Returns its x, road px. */
export const strikeGapX = (reel: number, dir: 1 | -1): number => {
	let edge = dir === 1 ? reel : reel + 1;
	if (edge <= 0) edge = 1;
	if (edge >= COLS) edge = COLS - 1;
	return BOARD_X + edge * PITCH;
};

export type StrikePlan = {
	plan: RunPlan;
	gapX: number;
	cutDir: 1 | -1;
	nC: number;
	nCut: number;
	/** feet at every pose boundary (0 .. nAlong + nC + nCut) and the ms from the set off at each */
	path: { x: number; y: number }[];
	times: number[];
	impactFeetY: number;
	/** the straight path's time to the impact (before round 2: the turn over the reel's centre and straight down it),
	 *  and whether the new path keeps it exactly */
	keepMs: number;
	kept: boolean;
	/** screen speed of the run down and the cut, road px per second */
	downSpeed: number;
};

/** THE WHOLE PATH OF A STRIKE (a pure function; the strike uses it, the probes check it): from `fromX` (off the board's
 *  edge, feet at snow.feetY) to the target cell `target` in reel `toX`. Along the snow as planRun says, but its turn ends
 *  over the GAP (strikeGapX); then straight down the gap in C, then the last cut in Q (the only view the rig rendered
 *  with every pose that runs that way: M has one pose) on its own screen direction to the impact point: the target
 *  reel's centre, its middle at STRIKE.impactAt of the cell. THE TIME IS KEPT: from the set off to the impact it takes
 *  exactly what the straight path (the turn over the reel's centre, straight down it) took, so every frame cued sound
 *  lands where it did. The time left after the snow run is shared by the run down and the cut at one screen speed;
 *  no pose is shorter than 1000 / STRIKE.cut.maxPoseFps ms (a 60 Hz screen shows every one); only a path that cannot
 *  fit (an entry from the near side into an outer reel's inner gap) runs longer, and says so (kept false). */
export const planStrike = (fromX: number, toX: number, gapX: number, snow: { feetY: number; diagonal: number }, target: { y: number; h: number }, startPose: number | null = STRIKE.startPose, end: StrikeEnd | null = null): StrikePlan => {
	const S = viewStep('S');
	const Q = viewStep('Q');
	const M = viewStep('M');
	const C = runBox('C');
	const QB = runBox('Q');
	const downStep = STRIKE.downSpeed / STRIKE.downStrideFps;
	const dir: 1 | -1 = gapX >= fromX ? 1 : -1;
	const centre = target.y + target.h * STRIKE.impactAt;
	// THE STRAIGHT PATH'S TIME (the one kept): planRun to the reel's centre, then whole C poses straight down at
	// downSpeed / downStrideFps, as before round 2
	const old = planRun(Math.abs(toX - fromX), snow.diagonal) as RunPlan;
	const oldTop = snow.feetY + (S.dy + old.nQ * Q.dy + M.dy) * old.step;
	const oldImpact = Math.max(centre + (C.height * C.anchorY * STRIKE.roadScale) / 2, oldTop);
	const oldNC = Math.max(1, Math.min(C_SAFE, Math.round(Math.max(0, oldImpact - oldTop) / downStep)));
	const keepMs = (old.nAlong * 1000) / STRIKE.strideFps + (oldNC * 1000) / STRIKE.downStrideFps;

	// ALONG THE SNOW to the gap
	const distance = Math.abs(gapX - fromX);
	const plan = (startPose !== null ? planRun(distance, snow.diagonal, startPose) : null) ?? (planRun(distance, snow.diagonal) as RunPlan);
	const { nR, nQ, nAlong, step } = plan;
	const path: { x: number; y: number }[] = [{ x: fromX, y: snow.feetY }];
	const go = (dx: number, dy: number) => {
		const p = path[path.length - 1];
		path.push({ x: p.x + dir * dx * step, y: p.y + dy * step });
	};
	for (let i = 0; i < nR; i++) go(1, 0);
	go(S.dx, S.dy);
	for (let i = 0; i < nQ; i++) go(Q.dx, Q.dy);
	go(M.dx, M.dy);
	path[path.length - 1].x = gapX; // (it is there already, to the rounding)
	const top = path[nAlong].y;

	// THE LAST CUT: from the gap to the reel's centre along Q's own screen direction; THE RUN DOWN the gap before it
	// (BRAWL: a Grandma car's strike ends at the car's rear, `end`, the cut running the way the car faces)
	const endX = end ? end.x : toX;
	const cutDir: 1 | -1 = end ? end.dir : toX >= gapX ? 1 : -1;
	const across = Math.abs(endX - gapX);
	const cutDrop = (across * Q.dy) / Q.dx;
	const cutLen = (across * Q.length) / Q.dx;
	const impactFeetY = end ? Math.max(end.y, top + cutDrop) : Math.max(centre + (QB.height * QB.anchorY * STRIKE.roadScale) / 2, top + cutDrop);
	const cutTop = impactFeetY - cutDrop;
	const dC = Math.max(0, cutTop - top);
	const nCut = Math.max(STRIKE.cut.minPoses, Math.round(cutLen / downStep));
	let nC = Math.max(1, Math.min(C_SAFE, Math.round(dC / downStep)));
	// THE TIME: what the straight path took, less the snow run; one screen speed for both legs, no pose under minPose
	const alongMs = (nAlong * 1000) / STRIKE.strideFps;
	const minPose = 1000 / STRIKE.cut.maxPoseFps;
	let rest = keepMs - alongMs;
	const len = dC + cutLen;
	const share = (rest * dC) / Math.max(1e-9, len);
	// a run down too short in time for its poses: fewer poses (never under 1)
	nC = Math.max(1, Math.min(nC, Math.floor(share / minPose + 1e-9)));
	const tC = Math.max(nC * minPose, share);
	let tCut = rest - tC;
	if (tCut < nCut * minPose) tCut = nCut * minPose;
	const kept = Math.abs(tC + tCut - rest) < 1e-6;
	rest = tC + tCut;
	for (let i = 1; i <= nC; i++) path.push({ x: gapX, y: top + (dC * i) / nC });
	for (let i = 1; i <= nCut; i++) path.push({ x: gapX + (cutDir * across * i) / nCut, y: cutTop + (cutDrop * i) / nCut });
	path[path.length - 1] = { x: endX, y: impactFeetY };
	const times: number[] = [];
	for (let i = 0; i <= nAlong; i++) times.push((i * 1000) / STRIKE.strideFps);
	for (let i = 1; i <= nC; i++) times.push(alongMs + (tC * i) / nC);
	for (let i = 1; i <= nCut; i++) times.push(alongMs + tC + (tCut * i) / nCut);
	return { plan, gapX, cutDir, nC, nCut, path, times, impactFeetY, keepMs, kept, downSpeed: (len / Math.max(1e-9, rest)) * 1000 };
};

/** THE ROAMING REINDEER'S STRIKE (a pure function; the strike uses it, the probes check it): from where he stands
 *  (`spot`, feet in road px) toward the target. He runs toward the board from his path's side (`sideDir`; the other way
 *  when the turn does not fit from his spot that way); where neither fits (he stands over the target's reel), he first
 *  runs back out (preN side run poses, facing preDir) to where it does. His feet come from his own height to the run's
 *  over the side run. Everything from the turn on is planStrike's. THE IMPACT IS NEVER LATER THAN THE STRIKE FROM OFF
 *  THE SCREEN (`todayMs` from its set off): he waits (waitMs) and sets off so that it lands exactly then; a run that
 *  would take longer has its side run sped up (to 1 / ROAM.minRunShare at most), and then its start cut (waitMs < 0). */
export const planRoamStrike = (spot: { x: number; y: number }, reel: number, toX: number, target: { y: number; h: number }, snow: { feetY: number; diagonal: number }, sideDir: 1 | -1, todayMs: number, end: StrikeEnd | null = null) => {
	const S = viewStep('S');
	const Q = viewStep('Q');
	const M = viewStep('M');
	const step0 = STRIKE.runSpeed / STRIKE.strideFps;
	const nQ = Math.max(1, Math.round(snow.diagonal / (step0 * Q.length)));
	// one side run pose and the turn: the least room the plan needs before the gap
	const minRun = step0 * (1 + S.dx + nQ * Q.dx + M.dx);
	let dir = sideDir;
	// (BRAWL: a Grandma strike runs down at its own x, whichever side he comes from)
	const gapFor = (d: 1 | -1) => (end ? end.gapX : strikeGapX(reel, d));
	let gapX = gapFor(dir);
	let fromX = spot.x;
	let pre = false;
	if ((gapX - fromX) * dir < minRun) {
		const d2 = -sideDir as 1 | -1;
		const g2 = gapFor(d2);
		if ((g2 - fromX) * d2 >= minRun) {
			dir = d2;
			gapX = g2;
		} else {
			pre = true;
			fromX = gapX - dir * minRun * 1.5;
		}
	}
	const P = planStrike(fromX, toX, gapX, snow, target, STRIKE.startPose, end);
	let path = P.path.map((p) => ({ ...p }));
	let times = [...P.times];
	let nPre = 0;
	let preDir: 1 | -1 = dir;
	if (pre) {
		const dist = Math.hypot(fromX - spot.x, snow.feetY - spot.y);
		nPre = Math.max(1, Math.round(dist / step0));
		preDir = fromX >= spot.x ? 1 : -1;
		const lead: { x: number; y: number }[] = [];
		for (let i = 0; i < nPre; i++) lead.push({ x: spot.x + ((fromX - spot.x) * i) / nPre, y: spot.y + ((snow.feetY - spot.y) * i) / nPre });
		const preMs = (nPre * 1000) / STRIKE.strideFps;
		path = [...lead, ...path];
		times = [...lead.map((_, i) => (i * 1000) / STRIKE.strideFps), ...times.map((t) => t + preMs)];
	} else {
		const nR = P.plan.nR;
		for (let i = 0; i <= nR; i++) path[i].y += (spot.y - snow.feetY) * (1 - i / nR);
	}
	const nR = nPre + P.plan.nR;
	const nAlong = nPre + P.plan.nAlong;
	const s0 = ((((7 - nAlong - 1) % 16) + 16) % 16) + 1;
	const ownMs = times[times.length - 1];
	let waitMs = todayMs - ownMs;
	let runShare = 1;
	if (waitMs < 0) {
		// too far: the side run (and the run back out) faster, then its start cut
		const tR = times[nR];
		runShare = Math.max(ROAM.minRunShare, Math.min(1, (tR + waitMs) / Math.max(1e-9, tR)));
		const cut = tR * (1 - runShare);
		times = times.map((t, i) => (i <= nR ? t * runShare : t - cut));
		waitMs = Math.min(0, todayMs - times[times.length - 1]);
	}
	return { P, dir, gapX, path, times, nR, nAlong, nPre, preDir, s0, waitMs, ownMs, runShare };
};

type Waiter = { at: number; resolve: () => void };

/** what the board needs for a strike: the target cell, and the Grandma car to box in the same reel (or null) */
/** `first` / `last`: the first / the last strike of its spin (game/bookEventHandlerMap.ts); the roaming reindeer makes the
 *  first, and a new one walks in after the last. A strike by hand (dev hook) has neither: it runs from off the screen. */
export type StrikeSpec = { cell: number; markCell: number | null; first?: boolean; last?: boolean; /** BRAWL: the target is a Grandma car */ grandma?: boolean };

export class RoadFeatures {
	/** boxes, clouds, characters and their numbers: over the traffic */
	readonly layer = new PIXI.Container();
	// the draw order, bottom to top (the note at the top of this file)
	private readonly backLayer = new PIXI.Container();
	private readonly cellLayer = new PIXI.Container();
	/** THE STANDING COLUMNS, one stack per reel (its right band, its character, its left band), the stacks right to
	 *  left so each reel's stack is over the one to its right (2026-11-17, Corey: "the characters spill over should be
	 *  left to right, so Santa's Elbow here should be above the left hand border from the Reindeer column") */
	private readonly stackLayer = new PIXI.Container();
	private readonly stacks: { root: PIXI.Container; right: PIXI.Container; body: PIXI.Container; left: PIXI.Container }[] = [];
	/** the full columns' top and bottom bands (the rails), over every character */
	private readonly railLayer = new PIXI.Container();
	/** the column frames' twinkles and win halos (additive), over every rail (one blend change for all of them) */
	private readonly frameFxLayer = new PIXI.Container();
	/** THE RUNNING REINDEER'S CAST SHADOW: on the road's ground, under every lane (game/road/roadBoard.ts puts this layer
	 *  in its ground), so it never lies over a symbol */
	readonly groundLayer = new PIXI.Container();
	private readonly numberLayer = new PIXI.Container();
	/** the target crosshair: over every box, cloud and column of the features (under the running reindeer) */
	private readonly crosshairLayer = new PIXI.Container();
	/** the running reindeer: over the line win as well */
	readonly runnerLayer = new PIXI.Container();
	/** THE ROAMING REINDEER (STRIKE.roam, game/road/roam.ts): on the snow outside the tunnel between spins, drawn under the
	 *  running one in the same layer */
	readonly roam = new Roam();
	/** HIS CHARGE WIND-UP'S EFFECTS (game/road/chargeWindup.ts): the kicked snow and the breath puff at the lock, over him
	 *  and the runner (kept the top child of the runner layer) */
	readonly charge = new ChargeFx();
	/** Turbo 2, or a slam stop's hurry running (components/Board.svelte): his wind-up is the head going down only */
	windupQuick: () => boolean = () => false;
	/** the scene preset shown (components/Board.svelte): the ground under him, for his effects' look (REINDEER_ROAM.fx.grounds) */
	groundPreset: () => string = () => 'snowDay';
	/** his strike's wind-up plan (kept past his set off: the lock's puff may come after it) */
	private windupPlan: WindupPlan | null = null;
	/** the screen in road px (components/Board.svelte): the roaming reindeer's path is fractions of it and the picture */
	screenRect: RoadRect | null = null;
	private clouds: CloudCell[] = [];
	private columns: Column[] = [];
	/** BRAWL: the Grandma Wilds' animated clouds (game/road/brawlCloud.ts) */
	readonly brawl: Brawl;
	private runner: Runner | null = null;
	/** the frames on Grandma cars in struck Santa reels, until their column covers them */
	private marks: { cell: number; box: GarlandFrame }[] = [];
	private waiters: Waiter[] = [];
	private clock = 0;
	private destroyed = false;
	/** THE TARGET CROSSHAIR (constants CROSSHAIR): the one up now, the fade of the other symbols (0 to 1, linear on the
	 *  road clock; drawn eased), the strikes so far this spin (the seed), and the per-frame trace (dev hook, probes) */
	private xh: Crosshair | null = null;
	private xhFade = 0;
	private xhFadeClock = 0;
	private strikesThisSpin = 0;
	private xhTrace: Record<string, unknown>[] = [];
	private xhInfo: Record<string, unknown> | null = null;

	/** the road board says which cells hold a valid target now (a parked Grandma's car or Santa's sleigh, shown), and
	 *  the board as text (the crosshair's seed) */
	targetCells: () => number[] = () => [];
	boardText: () => string = () => '';
	/** true while nothing of the strike's lead in may show (SKIP TO RESULT; there is none in this pass) */
	crosshairOff: () => boolean = () => false;
	/** THE CROSSHAIR'S BEATS, for the sounds to come (none wired yet): a hop lands on a cell, a candidate drops, the
	 *  lock, the morph into the red box at the crash */
	onCrosshair: ((beat: 'hop' | 'drop' | 'lock' | 'morph', cell: number) => void) | null = null;

	/** the road board hides or shows the symbol standing in a cell (the cloud and the column cover them) */
	hideCell: (cell: number, hidden: boolean) => void = () => {};
	/** a beat the handlers voice: a column's box when no strike made it (Super's opening column; a struck reel's column
	 *  and a Grandma Wild are voiced by the crash, the cloud and their own sounds, `sounds` below). 'impact' is no
	 *  longer sent (sfx_crash took its place, 2026-11-15). */
	onBeat: ((kind: 'impact' | 'column') => void) | null = null;
	/** the first board's posed columns (showLanding) have all left: their sheet may leave the GPU (components/Board.svelte) */
	onLandingGone: (() => void) | null = null;
	/** the first board's columns have asked for their idle clips (loadLandingIdle) */
	private landingIdleAsked = false;
	/** THE ROAD'S OWN SOUNDS (constants REINDEER_SOUND): cued from the frames below; components/Board.svelte hands it
	 *  the game's sound events */
	readonly sounds = new RoadSounds();
	/** the board's frames so far (the sounds' log, the probes) */
	frameNo = 0;
	/** the board clock's rate this frame (turbo, a slam stop; game/road/roadBoard.ts sets it): the dart's lead is real ms */
	rate = 1;
	/** the layout the road is drawn in (components/Board.svelte sets it): the run height in the snow is per layout */
	layoutKind: LayoutKind = 'landscape';
	/** the screen's left and right edges in road px (components/Board.svelte sets them): with the snow running on past the
	 *  picture (scene pass 9) the reindeer starts just outside the screen, never on the open snow */
	screenEdges: { left: number; right: number } | null = null;

	constructor(private readonly tex: Tex) {
		this.brawl = new Brawl(tex, (cell, hidden) => this.hideCell(cell, hidden));
		for (let reel = 0; reel < COLS; reel++) {
			const s = { root: new PIXI.Container(), right: new PIXI.Container(), body: new PIXI.Container(), left: new PIXI.Container() };
			s.root.addChild(s.right, s.body, s.left);
			this.stacks.push(s);
		}
		// reel 5 at the back, reel 1 on top
		for (let reel = COLS - 1; reel >= 0; reel--) this.stackLayer.addChild(this.stacks[reel].root);
		this.layer.addChild(this.backLayer, this.stackLayer, this.railLayer, this.frameFxLayer, this.cellLayer, this.numberLayer, this.crosshairLayer);
		this.runnerLayer.addChild(this.roam.shadow, this.roam.sprite, this.charge.root);
		roamDev.roam = this.roam;
		// the roaming reindeer's safety net waits while a strike runs
		this.roam.busy = () => this.runner !== null;
		// his effects' look by the ground (read from the scene's art by tools/build_roam.py) and their minimum size
		const grounds = REINDEER_ROAM.fx.grounds as Record<string, { look: 'light' | 'dark' }>;
		this.charge.look = () => grounds[this.groundPreset()]?.look ?? 'light';
		this.charge.cssPerRoad = () => roamDev.view?.()?.k ?? 1;
		setStandingProbe((tier) => this.columns.some((c) => c.tier === tier));
		// the column pictures' upload queue (game/road/columnClips.ts) keeps out of an impact's frames, and goes at once
		// for a picture a column is waiting on
		setUploadGate({
			quiet: () => this.impactFrames(),
			needNow: (tier, name) => this.columns.some((c) => c.tier === tier && (name === 'reveal' ? c.phase === 'wait' : name === 'idle' ? c.phase === 'idle' && !c.still && !getClip(tier, 'idle') : false)),
		});
	}

	/** THE FRAMES OF AN IMPACT, kept clear of GPU uploads: the reindeer's run down and its fade into the cloud, a Grandma
	 *  Wild's pop, and a column's box landing and growing */
	private impactFrames(): boolean {
		const r = this.runner;
		if (r && (r.pose >= r.nAlong || r.impactAt !== null)) return true;
		if (this.clouds.some((c) => c.leaving === null && this.clock - c.t0 < CLOUD_CELL.popMs + 60)) return true;
		// BRAWL: a Grandma Wild's landing
		if (this.brawl.landing()) return true;
		return this.columns.some((c) => c.phase === 'wait' || c.phase === 'impact' || c.phase === 'grow');
	}

	// ---- the strike ----------------------------------------------------------------------------------------------------
	/** THE REINDEER RUNS (constants STRIKE; the rig's run views, game/road/reindeerRun.ts): in at one end of the snow
	 *  bank above the road, side on along it, one frame of S, the diagonal in Q, one frame of M, straight down the gap
	 *  beside the target's reel in C (between the traffic), and the last diagonal cut in Q into the target cell
	 *  (planStrike). No stop on the way. Resolves at the impact. */
	async strike(spec: StrikeSpec): Promise<void> {
		// the run views load in the background from the moment the board is up: a strike waits a moment for them at most
		const ready = await awaitRunViews(STRIKE.loadWaitMs);
		if (this.destroyed) return;
		const target = cellRect(spec.cell);
		const reel = Math.floor(spec.cell / ROWS);
		const toX = target.x + target.w / 2;
		// which end of the snow bank it comes in at (STRIKE.entry)
		const nearLeft = reel < 2;
		const entry = STRIKE.entry;
		const fromLeft = entry === 'left' ? true : entry === 'right' ? false : entry === 'near' ? nearLeft : !nearLeft;
		const dir: 1 | -1 = fromLeft ? 1 : -1;
		const snow = STRIKE.snow[this.layoutKind] ?? STRIKE.snow.landscape;
		const side = runBox('R');
		const half = (side.width * Math.max(snow.scale, STRIKE.roadScale)) / 2;
		const edge = STRIKE.enterFromScreen ? this.screenEdges : null;
		const fromX = fromLeft ? Math.min(-half - STRIKE.enterPad, (edge?.left ?? 0) - half - STRIKE.enterPad) : Math.max(IMAGE_W + half + STRIKE.enterPad, (edge?.right ?? IMAGE_W) + half + STRIKE.enterPad);
		// THE PATH (planStrike): along the snow (the turn ending over the gap), down the gap, the cut into the target
		// BRAWL: a Grandma car's strike ends at the car's rear (the clip's first frame has him there)
		const row = spec.cell % ROWS;
		const end = spec.grandma ? this.brawl.strikeEnd(toX, LINES[row + 1] - ROAD_C.sitAboveLine, (ROAD_C.laneDirection[row] ?? 1) as 1 | -1) : null;
		if (end) this.brawl.strikeStarts();
		const gapX = end ? end.gapX : strikeGapX(reel, dir);
		const P = planStrike(fromX, toX, gapX, snow, target, STRIKE.startPose, end);
		const { nQ } = P.plan;
		let { nR, nAlong, s0 } = P.plan;
		const todayMs = P.times[P.times.length - 1];
		// THE ROAMING REINDEER (STRIKE.roam): the first strike of a spin is his when he is on the screen; one still walking
		// in from past the edge gives way to the strike from off the screen (a new one walks in after the spin)
		const spot = STRIKE.roam && spec.first ? this.roam.standing() : null;
		if (STRIKE.roam && spec.first && !spot) this.roam.leave();
		const R = spot ? planRoamStrike(spot, reel, toX, target, snow, this.roam.area().side === 'left' ? 1 : -1, todayMs, end) : null;
		const runDir = R ? R.dir : dir;
		const path = R ? R.path : P.path;
		const times = R ? R.times : P.times;
		if (R) {
			nR = R.nR;
			nAlong = R.nAlong;
			s0 = R.s0;
		}
		const plan = R ? R.P : P;

		if (this.runner) {
			this.runner.sprite.destroy();
			this.runner.shadow.destroy();
			this.runner.resolve();
			this.sounds.runStop('strike replaced');
		}
		const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
		sprite.visible = false;
		this.runnerLayer.addChild(sprite);
		const shadow = makeShadow();
		this.groundLayer.addChild(shadow);
		// THE TARGET CROSSHAIR hops for its lead in before the reindeer sets off (CROSSHAIR.leadMs on the road clock)
		const crosshair = CROSSHAIR.on && !this.crosshairOff();
		const lead = this.clock + (crosshair ? Math.max(STRIKE.leadInMs, CROSSHAIR.leadMs) : STRIKE.leadInMs);
		// his set off: the off-screen strike's, or later so that his impact lands exactly when its would (planRoamStrike)
		const t0 = R ? lead + R.waitMs : lead;
		this.endCrosshair();
		if (crosshair) this.startCrosshair(spec.cell, t0, runDir, path, nR, R ? times : null);
		// HIS CHARGE WIND-UP (constants ROAM.charge, game/road/chargeWindup.ts): planned now from the crosshair's own hops
		// (its glides' landings), which it follows and never moves; the effects keep over the new runner
		this.runnerLayer.addChild(this.charge.root);
		if (R) {
			const hops = this.xh ? this.xh.plan.legs.filter((l) => l.kind === 'glide').map((l) => l.t1) : [];
			const windup = ROAM.charge.on ? planWindup(this.clock, t0, hops, this.windupQuick()) : null;
			this.roam.alert(R.nPre ? R.preDir : R.dir, t0, windup);
			this.windupPlan = this.roam.windup;
			if (this.roam.windup) this.charge.begin(this.roam.windup, this.roamPose(), hashText(`charge|${this.boardText()}|${spec.cell}`));
			else this.charge.clear();
		} else {
			this.windupPlan = null;
			this.charge.forget();
		}
		return new Promise<void>((resolve) => {
			this.runner = { sprite, t0, pose: 0, shown: -1, late: null, dir: runDir, toX, gapX: R ? R.gapX : gapX, cutDir: plan.cutDir, feetY: snow.feetY, snowScale: snow.scale, nR, nQ, nAlong, nC: plan.nC, nCut: plan.nCut, s0, factor: plan.plan.factor, path, times, impactFeetY: plan.impactFeetY, impactAt: null, resolve, placeholder: !ready, view: 'R', stride: s0, scale: snow.scale, markCell: spec.markCell, marked: false, alerted: false, setOff: false, turned: false, cut: false, darted: false, snorted: false, shadow, keepMs: plan.keepMs, kept: plan.kept, roam: !!R, preN: R ? R.nPre : 0, preDir: R ? R.preDir : dir, todayMs, waitMs: R ? R.waitMs : 0, last: !!spec.last, cell: spec.cell, grandma: !!end, endX: path[path.length - 1].x, endY: path[path.length - 1].y };
		});
	}

	/** the red box on a Grandma car in a struck Santa reel: under the column, which grows over it (Corey 2026-11-10) */
	private markCell(cell: number) {
		const box = makeFrame(false, WILD_FRAME.mark, 'cell', cell * 0.71);
		const b = inset(cellRect(cell));
		box.set(b.x, b.y, b.w, b.h);
		box.land(this.clock);
		this.backLayer.addChild(box.root);
		this.marks.push({ cell, box });
	}

	private dropMarks(reel: number | null) {
		for (const m of [...this.marks]) {
			if (reel !== null && Math.floor(m.cell / ROWS) !== reel) continue;
			m.box.destroy();
			this.marks = this.marks.filter((x) => x !== m);
		}
	}

	/** the roaming reindeer as drawn now, for his wind-up's effects: feet, road px per rig frame px, facing */
	private roamPose() {
		return { x: this.roam.x, y: this.roam.y, kf: REINDEER_ROAM.roadPxPerFramePx * this.roam.scale(), facing: this.roam.facing };
	}

	/** THE BREATH PUFF AT THE LOCK (his own strike; on the crosshair's lock frame): from the nose of what shows at the
	 *  lock's own moment (lockAt, at most a frame before this one): the wind-up's frame while he stands, the side run's
	 *  stride once he has set off (with his ground speed, which the puffs carry and lose). The lock is always lockLeadMs
	 *  before his turn, so a running lock is in the side run (R). */
	private chargePuff() {
		const r = this.runner;
		const W = this.windupPlan;
		if (!r || !r.roam || !ROAM.charge.on || !W || !this.xh) return;
		const at = Math.min(this.clock, this.xh.plan.lockAt);
		const seed = hashText(`puff|${this.boardText()}|${r.cell}`);
		if (at < r.t0) {
			const f = windupFrame(W, at);
			const nose = REINDEER_ROAM.clips[W.clip].nose[f - 1];
			this.charge.puff(at, this.roamPose(), nose, 0, 0, seed, { running: false, stride: null, frame: f, clip: W.clip });
			return;
		}
		if (r.placeholder) return;
		const pose = this.poseAt(r, at - r.t0);
		const index = Math.floor(pose + 1e-9);
		if (index >= r.nR) return;
		const stride = ((r.s0 - 1 + index) % 16) + 1;
		const i = Math.max(0, Math.min(index, r.path.length - 2));
		const a = r.path[i];
		const b = r.path[i + 1];
		const u = Math.max(0, Math.min(1, pose - i));
		const dt = Math.max(1e-6, r.times[i + 1] - r.times[i]);
		const facing: 1 | -1 = index < r.preN ? r.preDir : r.dir;
		const nose = REINDEER_ROAM.fx.runNose[stride - 1];
		this.charge.puff(at, { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, kf: REINDEER_ROAM.roadPxPerFramePx * r.snowScale, facing }, nose, (b.x - a.x) / dt, (b.y - a.y) / dt, seed, { running: true, stride, frame: null, clip: null });
	}

	// ---- the target crosshair (constants CROSSHAIR, game/road/crosshair.ts) ----------------------------------------------
	/** the candidates now: every valid target shown on the board, less the reels a column stands in and the cells a
	 *  Grandma Wild's cloud covers (struck this spin); the book's target always among them */
	private candidates(target: number): number[] {
		const struck = new Set(this.clouds.filter((c) => c.leaving === null).map((c) => c.cell));
		const cells = this.targetCells().filter((c) => !struck.has(c) && !this.hasColumn(Math.floor(c / ROWS)));
		if (!cells.includes(target)) cells.push(target);
		return [...new Set(cells)].sort((a, b) => a - b);
	}

	/** the plan for this strike: when the reindeer has run past each candidate's reel (from its path along the snow) */
	private startCrosshair(target: number, t0: number, dir: 1 | -1, path: { x: number; y: number }[], nR: number, times: number[] | null = null) {
		const cells = this.candidates(target);
		// (a roaming reindeer's run has its own times: his side run may be sped up; the strike from off the screen keeps
		// strideFps poses a second, exactly as before)
		const at = (pose: number) => {
			if (!times) return (pose * 1000) / STRIKE.strideFps;
			const i = Math.max(0, Math.min(times.length - 2, Math.floor(pose)));
			return times[i] + (times[i + 1] - times[i]) * (pose - i);
		};
		const turnAt = t0 + at(nR);
		const targetReel = Math.floor(target / ROWS);
		const dropAt: Record<number, number> = {};
		for (const cell of cells) {
			const reel = Math.floor(cell / ROWS);
			dropAt[cell] = turnAt;
			if (reel === targetReel) continue;
			// the line its feet cross: passAt of the way across the reel, in the way it runs
			const line = BOARD_X + (dir === 1 ? reel + CROSSHAIR.passAt : reel + 1 - CROSSHAIR.passAt) * PITCH;
			for (let i = 0; i < Math.min(nR, path.length - 1); i++) {
				const a = path[i].x;
				const b = path[i + 1].x;
				if ((b - line) * dir < 0 || (a - line) * dir > 0) continue;
				const pose = i + (b === a ? 0 : (line - a) / (b - a));
				dropAt[cell] = Math.min(turnAt, t0 + at(pose));
				break;
			}
		}
		const centre = (cell: number) => {
			const r = cellRect(cell);
			return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
		};
		const seed = hashText(`${this.boardText()}|${target}|${this.strikesThisSpin++}`);
		const plan = planCrosshair(cells, target, centre, this.clock, turnAt, dropAt, seed);
		const art = new CrosshairArt();
		art.root.alpha = 0;
		this.crosshairLayer.addChild(art.root);
		const rect = inset(cellRect(target));
		this.xh = { plan, art, start: this.clock, morphAt: null, morphMs: CROSSHAIR.morphMs, morphFrom: null, leg: -1, dropped: new Set(), state: 'hop', on: target, scale: 1, rect };
		this.xhTrace = [];
		const rel = (t: number) => (Number.isFinite(t) ? Math.round((t - this.clock) * 10) / 10 : null);
		this.xhInfo = { target, cells, seed, runAt: rel(t0), turnAt: rel(turnAt), lockAt: rel(plan.lockAt), dropAt: Object.fromEntries(Object.entries(plan.dropAt).map(([c, t]) => [c, rel(t)])), hops: plan.legs.filter((l) => l.kind === 'dwell').map((l) => (l.kind === 'dwell' ? l.cell : -1)) };
	}

	/** the crash: it closes onto the red box at the cell's edge (a Wild made right after takes it over: its own time) */
	private crosshairCrash() {
		const x = this.xh;
		if (!x || x.morphAt !== null) return;
		x.morphAt = this.clock;
		x.morphFrom = { rect: { ...x.rect }, arm: CROSSHAIR.armFrac * Math.min(x.rect.w, x.rect.h) };
		x.state = 'morph';
		this.onCrosshair?.('morph', x.plan.target);
	}

	/** is the crosshair standing on this cell, not yet done closing onto its box? */
	private crosshairOn(cell: number): boolean {
		return !!this.xh && this.xh.plan.target === cell;
	}

	/** THE HAND-OVER TO THE WILD'S FRAME (WILD_FRAME.crosshairBlend; the crosshair is red quads, the frame a tinsel
	 *  garland): 0 while the crosshair stands on this cell, rising to 1 over the last share of its morph as the crosshair
	 *  fades out over the frame, 1 once it has gone (and for any other cell) */
	private crosshairHandover(cell: number): number {
		const x = this.xh;
		if (!x || x.plan.target !== cell) return 1;
		if (x.morphAt === null) return 0;
		const b = Math.max(0.001, WILD_FRAME.crosshairBlend);
		const k = Math.max(0, Math.min(1, ((this.clock - x.morphAt) / Math.max(1, x.morphMs) - (1 - b)) / b));
		return k * k * (3 - 2 * k);
	}

	private endCrosshair() {
		if (!this.xh) return;
		this.xh.art.root.destroy({ children: true });
		this.xh = null;
	}

	/** how dim the symbols that are not a valid target are drawn now (1 = full; the road board's paint multiplies) */
	otherSymbolsBrightness(): number {
		if (this.xhFade <= 0) return 1;
		const u = this.xhFade;
		return 1 - (1 - CROSSHAIR.fade) * (u * u * (3 - 2 * u));
	}

	private updateCrosshair() {
		const now = this.clock;
		const x = this.xh;
		// the fade: in while it is up, out from the crash (linear on the road clock, eased where it is drawn)
		const dt = Math.max(0, now - this.xhFadeClock);
		this.xhFadeClock = now;
		const up = !!x && x.morphAt === null;
		this.xhFade = up ? Math.min(1, this.xhFade + dt / CROSSHAIR.fadeInMs) : Math.max(0, this.xhFade - dt / CROSSHAIR.fadeOutMs);
		if (!x) return;
		const C = CROSSHAIR;
		let rect: Rect;
		let arm: number;
		let armH: number;
		let tick: number;
		if (x.morphAt === null) {
			const s = sample(x.plan, now, (cell) => inset(cellRect(cell)));
			// the beats: a hop lands, the lock (the sounds to come)
			const leg = x.plan.legs.indexOf(s.leg);
			if (leg !== x.leg) {
				if (s.leg.kind === 'dwell' && leg > 0) this.onCrosshair?.(s.leg.final ? 'lock' : 'hop', s.leg.cell);
				else if (s.leg.kind === 'dwell' && s.leg.final) this.onCrosshair?.('lock', s.leg.cell);
				if (s.leg.kind === 'dwell' && s.leg.final) this.chargePuff();
				x.leg = leg;
			}
			const locked = s.state === 'locked';
			for (const cell of x.plan.cells) {
				if (cell === x.plan.target || x.dropped.has(cell)) continue;
				if (locked || now >= x.plan.dropAt[cell]) {
					x.dropped.add(cell);
					this.onCrosshair?.('drop', cell);
				}
			}
			let k: number;
			if (s.state === 'glide') k = C.moveScale;
			else if (locked) k = C.moveScale + (C.lockScale - C.moveScale) * easeOut((now - x.plan.lockAt) / C.lockMs);
			else k = C.moveScale + (C.dwellScale - C.moveScale) * easeOut(s.sinceArrive / C.settleMs);
			// it shows: bigger and fading in
			const a = easeOut((now - x.start) / C.appearMs);
			k *= C.appearScale + (1 - C.appearScale) * a;
			x.art.root.alpha = a;
			const r = s.rect;
			rect = { x: r.x + (r.w * (1 - k)) / 2, y: r.y + (r.h * (1 - k)) / 2, w: r.w * k, h: r.h * k };
			arm = C.armFrac * Math.min(rect.w, rect.h);
			armH = arm;
			tick = C.tickPx;
			x.state = s.state;
			x.on = s.cell;
			x.scale = k;
		} else {
			// THE MORPH: the frame closes onto the red box at the cell's edge, the arms run out to whole sides, the ticks
			// pull in
			const u = (now - x.morphAt) / Math.max(1, x.morphMs);
			const e = easeOut(u);
			const from = x.morphFrom ?? { rect: x.rect, arm: C.armFrac * Math.min(x.rect.w, x.rect.h) };
			const to = inset(cellRect(x.plan.target));
			rect = { x: from.rect.x + (to.x - from.rect.x) * e, y: from.rect.y + (to.y - from.rect.y) * e, w: from.rect.w + (to.w - from.rect.w) * e, h: from.rect.h + (to.h - from.rect.h) * e };
			arm = from.arm + (rect.w / 2 - from.arm) * e;
			armH = from.arm + (rect.h / 2 - from.arm) * e;
			tick = C.tickPx * (1 - e);
			// (it fades over the Wild's own frame as it closes: crosshairHandover)
			x.art.root.alpha = 1 - this.crosshairHandover(x.plan.target);
			x.state = 'morph';
			x.scale = to.w > 0 ? rect.w / to.w : 1;
			if (u >= 1) {
				this.trace(x, rect);
				// done: the Wild's own box (in the same place) shows from here
				this.endCrosshair();
				return;
			}
		}
		x.rect = rect;
		x.art.set(rect, arm, armH, tick);
		this.trace(x, rect);
	}

	/** one row of the per-frame trace (dev hook __reindeer.crosshairTrace, the crosshair probe) */
	private trace(x: Crosshair, rect: Rect) {
		if (!import.meta.env.DEV || this.xhTrace.length > 6000) return;
		const now = this.clock;
		// one row per step of the board clock (a frozen clock still ticks the road every frame: no repeated rows)
		const last = this.xhTrace[this.xhTrace.length - 1];
		if (last && last.t === Math.round((now - x.start) * 10) / 10 && last.state === x.state) return;
		const left = x.state === 'locked' || x.state === 'morph' ? 1 : x.plan.cells.filter((c) => c === x.plan.target || !x.dropped.has(c)).length;
		const r = this.runner;
		const round = (v: number) => Math.round(v * 10) / 10;
		this.xhTrace.push({
			t: round(now - x.start),
			x: round(rect.x + rect.w / 2),
			y: round(rect.y + rect.h / 2),
			w: round(rect.w),
			state: x.state,
			on: x.on,
			target: x.plan.target,
			left,
			rx: r && r.sprite.visible ? round(r.sprite.x) : null,
			phase: r ? this.runnerPhase(r) : null,
			fade: Math.round(this.otherSymbolsBrightness() * 1000) / 1000,
		});
	}

	/** the crosshair's per-frame trace since the strike started, and its plan (dev hook) */
	crosshairTrace() {
		return { rows: this.xhTrace, plan: this.xhInfo, live: this.xh ? this.xh.state : 'off' };
	}

	/** A WILD BOX'S HALF WIDTH at a cell (road px, to its outer dark line), or 0: a Grandma Wild's box on that cell, or a
	 *  column Wild standing in its reel (the win lights' nails clear it: constants LINE_WIN lights tips) */
	wildBoxHalf(cell: number): number {
		const reel = Math.floor(cell / ROWS);
		const on = this.clouds.some((c) => c.cell === cell && c.leaving === null) || this.columns.some((c) => c.reel === reel && c.phase !== 'leave');
		return on ? PITCH / 2 - RED_BOX.inset + RED_BOX.edge : 0;
	}

	// ---- the Grandma Wild ------------------------------------------------------------------------------------------------
	/** the struck car's cell becomes the crash cloud with WILD and its multiplier, for this spin */
	grandmaWild(cell: number, multiplier: number): Promise<void> {
		const r = cellRect(cell);
		const root = new PIXI.Container();
		root.position.set(r.x + r.w / 2, r.y + r.h / 2);
		const box = makeFrame(false, WILD_FRAME.cell, 'cell', cell * 0.71);
		const b = inset(r);
		// (2026-11-17: the smoke fills the box edge to edge, its picture's opaque core cropped to the box: cellCloudTex)
		const cloud = new PIXI.Sprite(this.cellCloudTex(b.w, b.h));
		cloud.anchor.set(0.5);
		cloud.width = b.w;
		cloud.height = b.h;
		box.set(-b.w / 2, -b.h / 2, b.w, b.h);
		// its baubles drop in as her pop settles (WILD_FRAME.land cellDelayMs)
		box.land(this.clock + WILD_FRAME.land.cellDelayMs);
		const word = new PIXI.Sprite(this.tex('word_wild') ?? PIXI.Texture.EMPTY);
		const art = ROAD_ART.feature.wordWild;
		word.anchor.set(0.5);
		word.height = CLOUD_CELL.wordHeight;
		word.width = (art.width / art.height) * CLOUD_CELL.wordHeight;
		word.y = (CLOUD_CELL.wordY - 0.5) * r.h;
		// her multiplier drops in as her pop settles (constants WILD_MULT appear cellDelayMs), inside the cloud's pop
		const num = new WildMult('cell', WILD_MULT.cellColor, cell * 0.37);
		// standing on the inside of her box's bottom band
		num.root.y = r.h / 2 - WILD_MULT.place.cell.floor;
		num.show(multiplier, 'appear', this.clock + WILD_MULT.appear.cellDelayMs);
		root.addChild(cloud, box.root, word, num.root);
		root.scale.set(CLOUD_CELL.popFrom);
		this.cellLayer.addChild(root);
		// BRAWL: the animated cloud over the still one (game/road/brawlCloud.ts); a landed one shows its car's bump first,
		// then the clip (no pop of the whole cell), WILD and the number popping as the car is covered
		const row = cell % ROWS;
		const brawl = GRANDMA_BRAWL.on ? this.brawl.make(cell, root, cloud, word, { x: b.x - r.x - r.w / 2, y: b.y - r.y - r.h / 2, w: b.w, h: b.h }, r.h, this.clock, LINES[row + 1] - ROAD_C.sitAboveLine - (r.y + r.h / 2)) : null;
		if (brawl && brawl.mode === 'land') {
			root.scale.set(1);
			num.show(multiplier, 'appear', brawl.t0 + brawl.coverMs);
		}
		this.clouds.push({ cell, root, cloud, box, t0: this.clock, leaving: null, voiced: false, wildVoiced: false, num, multiplier, brawl });
		// the crosshair on this cell closes onto her box while her cloud pops (the box shows when it is done)
		if (this.xh && this.xh.plan.target === cell && this.xh.morphAt !== null) this.xh.morphMs = CLOUD_CELL.popMs;
		box.opacity = this.crosshairHandover(cell);
		// (BRAWL: a landing hides the car itself once its bump is over)
		if (!brawl) this.hideCell(cell, true);
		// (its crash, cloud loop and Wild sound are cued from its frames: updateClouds)
		return this.wait(this.clock + CLOUD_CELL.holdMs);
	}

	// ---- the column Wild ---------------------------------------------------------------------------------------------------
	private makeColumn(reel: number, tier: ColumnTier, multiplier: number, sticky: boolean, joinAdd = 0, pictures = true): Column {
		const back = new PIXI.Container();
		const backdrop = new PIXI.Sprite();
		const cloud = new PIXI.Sprite();
		const cellCloud = new PIXI.Sprite(this.tex('cloud_cell') ?? PIXI.Texture.EMPTY);
		const body = new PIXI.Sprite();
		const box = makeFrame(true, WILD_FRAME.look[tier], 'col', reel * 1.37);
		const label = new WildMult('col', WILD_MULT.colors[tier], reel * 0.37);
		backdrop.visible = false;
		cloud.visible = false;
		cellCloud.visible = false;
		body.visible = false;
		// the clouds inside the box, the character over them (cropped to the box), the box over it, its number on top:
		// the clouds in the back layer, the side bands in the reel's own stack (the character goes between them when it
		// stands), the rails and the number in layers over every column
		// its cast shadow on the cloud: over the clouds, under the character (and under the red frame, a layer up)
		const foot = makeShadow();
		back.addChild(backdrop, cellCloud, cloud, foot, body);
		this.backLayer.addChild(back);
		this.railLayer.addChild(box.root);
		this.frameFxLayer.addChild(box.fxRoot);
		this.stacks[reel].right.addChild(box.rightRoot!);
		this.stacks[reel].left.addChild(box.leftRoot!);
		this.numberLayer.addChild(label.root);
		if (pictures) void loadBackdrop();
		const column: Column = { reel, tier, multiplier, sticky, back, backdrop, box, cloud, cloudTex: null, cellCloud, body, label, phase: 'wait', t0: this.clock, boxT0: this.clock, impactMs: COLUMN.wholeImpactMs, growMs: COLUMN.wholeGrowMs, fromRow: -1, labelShown: false, joinAdd, stampAt: null, frame: -1, dropReveal: false, xhBox: false, still: null, crashVoiced: false, stepVoiced: false, winVoiced: false, enterCloud: false,	idleLoop: -1, idleT0: NaN, foot, footTex: null, footT0: NaN, bodyTex: null, stillTex: null };
		// its number stands on the inside of the frame's bottom rail (constants WILD_MULT place col floor)
		label.root.position.set(BOARD_X + (reel + 0.5) * PITCH, COLUMN_TOP + COLUMN_H - WILD_MULT.place.col.floor);
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
		if (column.fromRow >= 0) {
			column.impactMs = COLUMN.impactMs;
			column.growMs = COLUMN.growMs;
		}
		// the crosshair on the struck cell IS the box's draw-on now: it closes onto the box over boxDrawMs, and the
		// cloud pops on its old beat
		if (fromCell !== null && this.xh && this.xh.plan.target === fromCell && this.xh.morphAt !== null) {
			this.xh.morphMs = COLUMN.boxDrawMs;
			column.xhBox = true;
		}
		// 'wait': the box stands on the struck cell with the cell cloud until the tier's pictures are in. They usually are
		// (they started loading when the book arrived). A late or failed load never holds the round longer than
		// loadWaitMs: the column then stands as its box and its number.
		column.phase = 'wait';
		// a struck reel's column is voiced by the crash on its cell cloud's first frame (updateColumn); only a column with
		// no strike behind it keeps the box beat
		if (fromCell === null) this.onBeat?.('column');
		const wait = <T>(p: Promise<T>) => Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), COLUMN.loadWaitMs))]);
		void loadClip(tier, 'idle');
		const reveal = await wait(loadClip(tier, 'reveal'));
		if (this.destroyed || !this.columns.includes(column) || column.phase !== 'wait') return;
		// the time on the struck cell counts from the first stroke of the box, not from the pictures' arrival
		column.phase = 'impact';
		column.t0 = column.boxT0;
		const entrance = reveal ? reveal.ms : 200;
		// THE ENTRANCE STARTS WITH THE GROW (2026-11-19): the column stands when the longer of the two is over (the
		// entrance), about growMs sooner than when it began once the box was whole; its number pops in at numberAt of the
		// entrance, never before the box is whole
		const end = COLUMN.entranceWithGrow ? Math.max(column.growMs, entrance) : column.growMs + entrance;
		const labelAt = COLUMN.entranceWithGrow ? Math.max(column.growMs, entrance * COLUMN.numberAt) : column.growMs + entrance * COLUMN.numberAt;
		// a joining Grandma Wild's sum shows after the column's own number (never under variant F)
		// (and its count up and slam: constants WILD_MULT change)
		const join = joinAdd > 0 ? Math.max(0, labelAt + COLUMN.joinMs - end) + WILD_MULT.change.countMs + WILD_MULT.change.slamMs : 0;
		// THE ROUND STILL WAITS AS LONG AS BEFORE (2026-11-20): the column stands growMs sooner, but the round goes on to the
		// next strike or the win only when an entrance that started at the box's full height would have ended (grow, then
		// the whole entrance, then a join). Two columns in one spin keep the spacing they had: with the shorter wait a slam
		// stop's hurry brought the second reindeer's entrance sound (1234 ms long) in 160 ms before the first one's had
		// ended (tools/sound_probe.mjs threeslam on the upright phone: one sound twice at once)
		const before = column.growMs + entrance + (joinAdd > 0 ? Math.max(0, entrance * COLUMN.numberAt + COLUMN.joinMs - entrance) + WILD_MULT.change.countMs + WILD_MULT.change.slamMs : 0);
		await this.wait(column.t0 + column.impactMs + Math.max(end + join, before));
	}

	/** make the board's sticky columns exactly this list, with no entrance (the start of each free spin; a resume or a
	 *  replay builds its columns from this alone). Columns not in it, and every cloud cell, leave. A column that stands
	 *  keeps the number it landed with: nothing changes a held column's multiplier (Corey 2026-11-10: "I don't think
	 *  the column wilds should ever multiply from their original set value"; the book repeats it unchanged). */
	syncHeld(held: HeldColumn[]) {
		// a new spin: the crosshair's seed counts its strikes from here
		this.strikesThisSpin = 0;
		this.sounds.runStop('new spin');
		// (his wind-up's effects: a few hundred ms at most, gone now with the board's other strike pieces)
		this.charge.clear();
		this.windupPlan = null;
		this.endFlies();
		this.endCrosshair();
		for (const cloud of this.clouds) if (cloud.leaving === null) cloud.leaving = this.clock;
		this.dropMarks(null);
		for (const column of [...this.columns]) {
			const want = held.find((h) => h.reel === column.reel);
			if (!want || want.tier !== column.tier) this.removeColumn(column.reel, false);
			else {
				column.sticky = true;
				// its number and its frame stand at rest into the new spin (a win's move is not carried over)
				column.label.settle();
				column.box.settle();
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
			column.label.show(h.multiplier, 'rest', this.clock);
			column.box.land(-Infinity);
			void loadClip(h.tier, 'idle');
			void loadClip(h.tier, 'win');
			for (let row = 0; row < ROWS; row++) this.hideCell(h.reel * ROWS + row, true);
		}
	}

	// ---- the landing board (game/landingBoard.ts) ----------------------------------------------------------------------
	/** THE LANDING BOARD'S COLUMNS: standing, from the landing sheet (one picked idle frame per character and the cloud
	 *  still; tools/build_columns.py --landing), their numbers up. They load nothing here: the still stands until
	 *  loadLandingIdle (once the press gate is open) has brought the tier's idle in, then that loop plays on (Corey
	 *  2026-11-19: "make the full column wilds on the intial screens have their idle animations instead of still images") */
	showLanding(sheet: PIXI.Texture, frames: Record<string, { x: number; y: number; width: number; height: number }>, columns: { reel: number; tier: ColumnTier; multiplier: number }[]) {
		const cut = (f: { x: number; y: number; width: number; height: number }) => new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(f.x, f.y, f.width, f.height) });
		const backdrop = cut(frames.backdrop);
		for (const { reel, tier, multiplier } of columns) {
			const f = frames[tier];
			if (!f) continue;
			this.removeColumn(reel, true);
			const column = this.makeColumn(reel, tier, multiplier, false, 0, false);
			const spec = COLUMN_CLIPS.clips[tier].idle;
			const from = (COLUMN_CLIPS.landing.frames as Record<string, number>)[tier] ?? 0;
			column.still = { clip: { textures: [cut(f)], fps: 1, loop: true, x: spec.x, y: spec.y, width: spec.width, height: spec.height, cloudFrames: 0, ms: 1000 }, backdrop, from, live: false };
			column.phase = 'idle';
			column.t0 = this.clock;
			column.labelShown = true;
			column.label.show(multiplier, 'rest', this.clock);
			column.box.land(-Infinity);
		}
	}

	/** THE FIRST BOARD'S COLUMNS COME ALIVE: their tiers' idle clips load in the background (the upload queue's own turn,
	 *  never holding the splash or the press screen back); each column swaps its still for the loop the frame its clip is
	 *  in. Once (components/Board.svelte calls it when the press gate opens, and again as the landing ends). */
	loadLandingIdle() {
		if (this.landingIdleAsked) return;
		const tiers = new Set(this.columns.filter((c) => c.still && c.phase !== 'leave').map((c) => c.tier));
		if (!tiers.size) return;
		this.landingIdleAsked = true;
		for (const tier of tiers) void loadClip(tier, 'idle');
	}

	/** what a landing column draws: the tier's idle loop once it is in (started on the still's own frame, so there is no
	 *  pop), else its still */
	private landingIdle(column: Column, still: NonNullable<Column['still']>): Clip {
		const clip = getClip(column.tier, 'idle');
		if (!clip || !clip.textures.length || clip.textures.some((t) => t.destroyed)) {
			still.live = false;
			return still.clip;
		}
		if (!still.live) {
			still.live = true;
			// the loop's frame is floor((t + reel x idlePhaseMs) x fps) mod n (updateColumn, idleFrame): t0 set so it is the
			// still's own frame now, whatever the loop's frame count and fps (tools/build_columns.py IDLE_STEP)
			const loopMs = clip.ms;
			const phase = ((((still.from + 0.5) * 1000) / Math.max(1, clip.fps) - column.reel * COLUMN.idlePhaseMs) % loopMs + loopMs) % loopMs;
			column.t0 = this.clock - phase;
		}
		return clip;
	}

	/** a landing column has gone: its tier's idle (loaded for it, loadLandingIdle) goes too unless another column of the
	 *  tier stands or the book being played calls for it */
	private releaseLandingIdle(tier: ColumnTier) {
		if (!this.landingIdleAsked) return;
		if (!this.columns.some((c) => c.tier === tier) && !isWanted(tier)) releaseClip(tier, 'idle');
	}

	/** the landing is over: its columns go at once (no fade, nothing left behind), before the first board is put up */
	endLanding() {
		const textures = new Set<PIXI.Texture>();
		for (const column of [...this.columns]) {
			if (!column.still) continue;
			for (let row = 0; row < ROWS; row++) this.hideCell(column.reel * ROWS + row, false);
			textures.add(column.still.backdrop);
			for (const t of column.still.clip.textures) textures.add(t);
			column.body.texture = PIXI.Texture.EMPTY;
			column.bodyTex?.destroy(false);
			column.bodyTex = null;
			column.backdrop.texture = PIXI.Texture.EMPTY;
			this.destroyColumn(column);
			this.columns = this.columns.filter((c) => c !== column);
			this.releaseLandingIdle(column.tier);
		}
		// the frames only (the sheet itself is the preload's)
		for (const t of textures) t.destroy(false);
		if (textures.size) this.onLandingGone?.();
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
			column.winVoiced = false;
		}
	}

	// ---- the multipliers in a line win (constants WILD_MULT win) -----------------------------------------------------------
	/** the copies flying to a line's multiplier (two Wilds adding on it): made at the win, gone as they land */
	private flies: { num: WildMult; fromX: number; fromY: number; toX: number; toY: number; t0: number }[] = [];

	/** A LINE WIN through multiplier Wilds: every Grandma Wild cell and column on a winning line plays its win (from the
	 *  first of its lines to start: `startsMs`, board ms from now). On a line with two or more of them a copy of each
	 *  flies to the line's own multiplier as it shows (`badges[k]`, road px and board ms from now; null: none shown). */
	winNumbers(lines: readonly (readonly number[])[], startsMs: readonly number[], badges: readonly ({ x: number; y: number; inMs: number } | null)[]) {
		this.endFlies();
		const told = new Set<WildMult>();
		lines.forEach((cells, k) => {
			const on: { num: WildMult; frame: GarlandFrame; value: number; x: number; y: number }[] = [];
			// BRAWL: each Grandma Wild on the line plays its win beat once, from the first of its lines, staggered in the
			// line's own order
			let nth = 0;
			for (const cell of cells) {
				const c = this.clouds.find((x) => x.cell === cell && x.leaving === null);
				if (c?.brawl) this.brawl.win(c.brawl, this.clock + (startsMs[k] ?? 0) + nth++ * GRANDMA_BRAWL.win.staggerMs, this.clock + (startsMs[k] ?? 0));
			}
			for (const c of this.clouds) {
				if (c.leaving !== null || !cells.includes(c.cell)) continue;
				const r = cellRect(c.cell);
				on.push({ num: c.num, frame: c.box, value: c.multiplier, x: r.x + r.w / 2, y: r.y + r.h - WILD_MULT.place.cell.floor + c.num.centreY });
			}
			for (const col of this.columns) {
				if (col.phase === 'leave' || !col.labelShown || !cells.some((cell) => Math.floor(cell / ROWS) === col.reel)) continue;
				on.push({ num: col.label, frame: col.box, value: col.label.target, x: col.label.root.x, y: col.label.root.y + col.label.centreY });
			}
			for (const o of on) {
				if (told.has(o.num)) continue;
				told.add(o.num);
				o.num.win(this.clock + (startsMs[k] ?? 0));
				// its frame wins with it (WILD_FRAME.win)
				o.frame.win(this.clock + (startsMs[k] ?? 0));
			}
			const badge = badges[k];
			if (!badge || on.length < 2) return;
			for (const o of on) {
				const num = new WildMult('sum', o.num.color, 0);
				num.show(o.value, 'still', this.clock);
				num.root.visible = false;
				this.numberLayer.addChild(num.root);
				this.flies.push({ num, fromX: o.x, fromY: o.y, toX: badge.x, toY: badge.y, t0: this.clock + badge.inMs - WILD_MULT.win.fly.ms });
			}
		});
	}

	private updateFlies() {
		if (!this.flies.length) return;
		const F = WILD_MULT.win.fly;
		let done = 0;
		for (const f of this.flies) {
			const u = (this.clock - f.t0) / Math.max(1, F.ms);
			if (u >= 1) {
				f.num.root.visible = false;
				done++;
				continue;
			}
			f.num.update(this.clock);
			const on = u >= 0;
			f.num.root.visible = on;
			if (!on) continue;
			const e = u * u;
			f.num.root.position.set(f.fromX + (f.toX - f.fromX) * e, f.fromY + (f.toY - f.fromY) * e);
			f.num.root.scale.set(1 + (F.toScale - 1) * u);
			f.num.root.alpha = F.alpha * (1 - F.fade * u);
		}
		if (done === this.flies.length) this.endFlies();
	}

	/** the copies go (they have landed, the win is cleared, a new spin) */
	endFlies() {
		for (const f of this.flies) f.num.destroy();
		this.flies = [];
	}

	/** the multipliers as drawn (probes): every Grandma Wild cell's and column's, and the copies in flight */
	multipliers() {
		return {
			cells: this.clouds.filter((c) => c.leaving === null).map((c) => ({ cell: c.cell, multiplier: c.multiplier, ...c.num.state(), glyphs: c.num.glyphBounds() })),
			columns: this.columns.filter((c) => c.phase !== 'leave').map((c) => ({ reel: c.reel, tier: c.tier, multiplier: c.multiplier, shown: c.labelShown, ...c.label.state(), glyphs: c.label.glyphBounds() })),
			flies: this.flies.length,
		};
	}

	/** is a column standing on this reel (the board skips its cells when traffic drives in)? */
	hasColumn(reel: number): boolean {
		return this.columns.some((c) => c.reel === reel && c.phase !== 'leave');
	}

	// ---- the frame ---------------------------------------------------------------------------------------------------------
	update(clock: number) {
		if (this.destroyed) return;
		this.clock = clock;
		this.frameNo += 1;
		this.sounds.beginFrame(this.frameNo, clock);
		this.updateRunner();
		// the roaming reindeer after the runner: the frame his run sets off he is gone and the runner shows
		this.roam.setView(this.layoutKind, this.screenRect);
		this.roam.update(clock);
		this.updateCrosshair();
		this.charge.update(clock, this.roam.windup !== null);
		this.updateClouds();
		for (const m of this.marks) m.box.update(clock);
		for (const column of [...this.columns]) this.updateColumn(column);
		this.updateFlies();
		// THE CRASH CLOUDS on screen this frame (the cloud loop), and whether a strike or a column's arrival is going on
		// (no idle snort then): a Grandma Wild's cloud cell, standing or leaving; a struck reel's column from its cell
		// cloud's pop to the end of its entrance's cloud frames
		const struck = this.columns.filter((c) => c.fromRow >= 0 && !c.still && (c.cellCloud.visible || c.cloud.visible || c.enterCloud));
		const standing = this.clouds.filter((c) => c.leaving === null).length + struck.filter((c) => c.phase !== 'leave').length;
		const leaving = this.clouds.length + struck.length - standing;
		const arriving = this.columns.some((c) => c.phase === 'wait' || c.phase === 'impact' || c.phase === 'grow' || c.phase === 'enter');
		this.sounds.endFrame(standing, leaving, this.runner !== null || this.xh !== null || arriving);
		if (this.waiters.length) {
			const due = this.waiters.filter((w) => clock >= w.at);
			if (due.length) {
				this.waiters = this.waiters.filter((w) => !due.includes(w));
				for (const w of due) w.resolve();
			}
		}
	}

	/** the road clock ms (from t0) a pose index starts at (planStrike's times: strideFps poses a second along the snow,
	 *  then the run down and the cut at the pace that keeps the strike's length) */
	private poseTime(r: Runner, index: number): number {
		return r.times[Math.max(0, Math.min(index, r.times.length - 1))];
	}

	/** the pose (a float) at `e` ms from t0 */
	private poseAt(r: Runner, e: number): number {
		const t = r.times;
		let i = 0;
		while (i < t.length - 2 && e >= t[i + 1]) i++;
		return i + Math.max(0, (e - t[i]) / Math.max(1e-9, t[i + 1] - t[i]));
	}

	private updateRunner() {
		const r = this.runner;
		if (!r) return;
		const s = r.sprite;
		if (r.impactAt !== null) {
			// the impact: it is gone into the cloud, fading on the pose it struck with
			const u = (this.clock - r.impactAt) / STRIKE.fadeMs;
			s.alpha = Math.max(0, 1 - u);
			// his shadow fades with him
			this.placeRunnerShadow(r);
			if (u >= 1) {
				s.destroy();
				r.shadow.destroy();
				this.runner = null;
			}
			return;
		}
		if (!r.alerted) {
			// THE STRIKE'S FIRST FRAME: the crosshair's first frame (updateCrosshair, just after), he has seen a target
			r.alerted = true;
			this.sounds.mark('strike', `target ${this.xh?.plan.target ?? '-'}`);
			this.sounds.cue('alert');
		}
		if (r.roam && !r.snorted && ROAM.charge.on && this.xh && this.xh.morphAt === null) {
			// THE SNORT AT THE LOCK (REINDEER_SOUND.snort.lockPeakMs, his own strike only): its loudest point lands on the
			// lock, so it starts on the first frame within lockPeakMs real ms of it (the strike's first frame when the
			// lock is there)
			const left = (this.xh.plan.lockAt - this.clock) / Math.max(0.001, this.rate);
			if (left <= REINDEER_SOUND.snort.lockPeakMs) {
				r.snorted = true;
				this.sounds.lockSnort(`${Math.round(left)} ms before the lock, ${this.roam.state === 'alert' ? `standing, ${this.roam.clip} frame ${Math.round(this.roam.frame)}` : 'running'}`);
			}
		}
		if (this.clock < r.t0) return;
		// THE STRIKE RUNS ON TIME (Corey 2026-11-12: slow screens skip poses so the strike always takes the same time):
		// the pose and the body's place both come from the road clock since t0, so a slow screen, a dropped frame, turbo
		// or a slam stop skip poses and keep the strike's length. Four poses are never skipped: the one S pose, the one
		// M pose, the first C pose (the safe start) and the first pose of the last cut. A frame that would jump over one
		// draws it instead (a little late: under one frame), and the next frame catches up with the time.
		const e = this.clock - r.t0;
		const end = r.nAlong + r.nC + r.nCut;
		const cutAt = r.nAlong + r.nC;
		const keys = [r.nR, r.nR + 1 + r.nQ, r.nAlong, cutAt];
		const missed = keys.find((k) => r.shown < k);
		let pose: number;
		r.late = null;
		if (e >= this.poseTime(r, end)) {
			// THE IMPACT, on time. Drawn on the cut's last pose, or on a protected pose not drawn yet (a very slow screen
			// that jumped from before it straight past the impact)
			// (a missed run down or cut pose is not drawn late on the impact frame: the impact is always at the target, in
			// the cut's view; only a very slow screen that jumped over the turn itself draws S or M there, as before)
			const late = missed !== undefined && missed < r.nAlong ? missed : undefined;
			pose = late !== undefined ? late : end - 1e-6;
			if (missed !== undefined) r.late = e - this.poseTime(r, missed);
			r.impactAt = this.clock;
			this.crosshairCrash();
			// BRAWL: a Grandma car's landing starts from this frame; the spin's last strike lets the landing's frames go after
			this.brawl.struck(r.cell, this.clock, r.grandma, r.last);
			// the spin's last strike: a new roaming reindeer walks in a moment after it (never waited on)
			if (r.last && STRIKE.roam && this.roam.state === 'none') this.roam.walkInAt = this.clock + ROAM.walkInDelayMs;
		} else {
			pose = this.poseAt(r, e);
			const index = Math.floor(pose + 1e-9);
			const skipped = keys.find((k) => r.shown < k && index > k);
			if (skipped !== undefined) {
				pose = skipped;
				r.late = e - this.poseTime(r, skipped);
			}
		}
		r.pose = pose;
		r.shown = Math.floor(pose + 1e-9);
		if (!r.setOff) {
			// he sets off along the snow: the run loop, for the side run only
			r.setOff = true;
			this.sounds.mark('setOff', `nR ${r.nR}`);
			if (r.shown < r.nR) this.sounds.runStart();
		}
		if (!r.turned && (r.shown >= r.nR || r.impactAt !== null)) {
			// THE TURN toward the board (the S pose drawn now): the run loop stops on this frame and the turn plays
			r.turned = true;
			this.sounds.mark('turn', `pose ${r.shown}`);
			this.sounds.runStop('turn');
			this.sounds.cue('turn');
		}
		if (!r.darted) {
			// THE DART (REINDEER_SOUND dart): the whoosh starts peakMs real ms before the impact, so its loudest moment lands
			// on it (the impact's own frame at the latest)
			const left = (r.t0 + this.poseTime(r, end) - this.clock) / Math.max(0.001, this.rate);
			if (left <= REINDEER_SOUND.dart.peakMs || r.impactAt !== null) {
				r.darted = true;
				this.sounds.mark('dart', `${Math.round(left)} ms before the impact, pose ${r.shown}`);
				this.sounds.cue('dart');
			}
		}
		if (pose >= r.nAlong && !r.marked) {
			// it starts down the gap: a Grandma car in the struck Santa reel gets its red box
			r.marked = true;
			this.sounds.mark('down', `pose ${r.shown}, ${r.nC} poses down the gap at x ${Math.round(r.gapX)}, then ${r.nCut} in the cut`);
			if (r.markCell !== null) this.markCell(r.markCell);
		}
		if (!r.cut && r.shown >= cutAt) {
			// THE LAST CUT (its first Q pose drawn now): the turn sound again (REINDEER_SOUND.cutTurn)
			r.cut = true;
			this.sounds.mark('cut', `pose ${r.shown}`);
			if (REINDEER_SOUND.cutTurn) this.sounds.cue('turn', 'the last cut');
		}
		if (r.impactAt === this.clock) this.sounds.mark('impact', `pose ${r.shown}`);
		this.placeRunner(r, pose);
		if (r.impactAt !== null) r.resolve();
	}

	/** the runner at `pose`: which view, which stride, where its feet are, how big */
	private placeRunner(r: Runner, pose: number) {
		const s = r.sprite;
		// one stride pose per pose, counted on through every change of view (the same index the time path drew: a pose
		// a hair under a whole number from the floating point counts as that number)
		const index = Math.floor(pose + 1e-9);
		const cutAt = r.nAlong + r.nC;
		const view: RunView = index < r.nR ? 'R' : index === r.nR ? 'S' : index < r.nR + 1 + r.nQ ? 'Q' : index === r.nR + 1 + r.nQ ? 'M' : index < cutAt ? 'C' : 'Q';
		const stride = ((r.s0 - 1 + index) % 16) + 1;
		// steady along the path, pose boundary to pose boundary (the snow run, the run down the gap and the cut alike)
		const last = r.path.length - 1;
		const i = Math.max(0, Math.min(index, last - 1));
		const a = r.path[i];
		const b = r.path[i + 1];
		const u = Math.max(0, Math.min(1, pose - i));
		const x = a.x + (b.x - a.x) * u;
		const y = a.y + (b.y - a.y) * u;
		// the cut runs toward the target's centre: mirrored when that is against the way it came along the snow
		// (a roaming reindeer that first runs back out faces that way until his own turn back toward the board)
		const facing = index >= cutAt ? r.cutDir : index < r.preN ? r.preDir : r.dir;
		// its size: the snow size along the snow; once it turns toward us it grows with how far down the screen it has
		// come, to the road size at the impact
		const reach = Math.max(1, r.impactFeetY - r.feetY);
		const k = view === 'R' ? r.snowScale : r.snowScale + (STRIKE.roadScale - r.snowScale) * Math.max(0, Math.min(1, (y - r.feetY) / reach));
		s.visible = true;
		s.position.set(x, y);
		const got = r.placeholder ? null : runFrame(view, stride);
		if (got) {
			const box = runBox(view);
			if (s.texture !== got.texture) s.texture = got.texture;
			s.anchor.set(box.anchorX, box.anchorY);
			// mirrored about its feet for a run to the left (the anchor's x mirrors with it)
			s.scale.set((facing * box.width * k) / got.texture.orig.width, (box.height * k) / got.texture.orig.height);
		} else {
			// the placeholder still (the run views did not load in time): standing on its feet, one picture per side
			const size = ROAD_ART.symbols.reindeer_run;
			const tex = this.tex(facing === 1 ? 'reindeer_run' : 'reindeer_run_L') ?? PIXI.Texture.EMPTY;
			if (s.texture !== tex) s.texture = tex;
			s.anchor.set(0.5, 1);
			s.width = size.width * k;
			s.height = size.height * k;
		}
		r.view = view;
		r.stride = stride;
		r.scale = k;
		this.placeRunnerShadow(r);
	}

	/** HIS SHADOW (constants SHADOW): his twin on the road's ground (under the traffic), pinned at his feet point (the
	 *  sprite's anchor), the same view, stride and mirror as he is drawn, faded with him */
	private placeRunnerShadow(r: Runner) {
		const k = SHADOW.runner ? shadowStrength() : 0;
		const s = r.sprite;
		castShadow(r.shadow, s.texture, s.anchor.x, s.anchor.y, s.x, s.y, s.scale.x, s.scale.y, s.visible ? k * s.alpha : 0);
	}

	private updateClouds() {
		for (const c of [...this.clouds]) {
			// her multiplier (game/road/wildMult.ts), inside the cloud's pop and its fade
			c.num.update(this.clock);
			if (c.leaving !== null) {
				const u = (this.clock - c.leaving) / COLUMN.leaveMs;
				c.root.alpha = Math.max(0, 1 - u);
				if (u >= 1) {
					this.hideCell(c.cell, false);
					// BRAWL: its sprites' textures go before the root
					if (c.brawl) this.brawl.drop(c.brawl);
					c.num.destroy();
					c.box.destroy();
					c.root.destroy({ children: true });
					this.clouds = this.clouds.filter((x) => x !== c);
				}
				continue;
			}
			const u = Math.min(1, (this.clock - c.t0) / CLOUD_CELL.popMs);
			if (!c.voiced) {
				// THE CLOUD'S FIRST FRAME: the crash
				c.voiced = true;
				this.sounds.mark('cloud', `grandma cell ${c.cell}`);
				this.sounds.cue('crash', `cell ${c.cell}`);
			}
			if (!c.wildVoiced && u >= 1) {
				// her pop has settled and her red box shows: she has turned Wild
				c.wildVoiced = true;
				this.sounds.mark('wild', `cell ${c.cell}`);
				this.sounds.cue('grandmaWild', `cell ${c.cell}`);
			}
			// her frame comes in as the crosshair hands over to it, and moves (its baubles, its twinkles, a win)
			c.box.opacity = this.crosshairHandover(c.cell);
			c.box.update(this.clock);
			// BRAWL: the landing, the loop, the win beat (a landed Wild has no pop of the whole cell)
			if (c.brawl) this.brawl.update(c.brawl, this.clock, CLOUD_CELL.popMs);
			if (c.brawl && c.brawl.landed) continue;
			// out past its size, then back onto it
			const over = CLOUD_CELL.popOver;
			const k = u < 0.7 ? CLOUD_CELL.popFrom + (over - CLOUD_CELL.popFrom) * (u / 0.7) : over + (1 - over) * ((u - 0.7) / 0.3);
			c.root.scale.set(k);
		}
	}

	/** where the character draws: under its red frame while the entrance's cloud is still in the picture (the cloud
	 *  belongs inside the box), or up in its reel's stack once it stands alone: over its own right band, under its own
	 *  left band and the rails, and over everything of the reels to its right (the stacks are in reel order, reel 1 on
	 *  top; never a zIndex: Pixi turns sorting on for the parent of any child given one) */
	private bodyOver(column: Column, over: boolean) {
		const parent = over ? this.stacks[column.reel].body : column.back;
		if (column.body.parent === parent) return;
		parent.addChild(column.body);
	}

	/** the character stands in its reel's stack (not in its back layer under the frame) */
	private standing(column: Column) {
		return column.body.parent === this.stacks[column.reel].body;
	}

	private reelOfBody(body: PIXI.ContainerChild): number {
		return this.columns.find((c) => c.body === body)?.reel ?? -1;
	}

	/** a leaving column fades as one: its five parts live in five layers */
	private fadeColumn(column: Column, alpha: number) {
		column.back.alpha = alpha;
		column.box.root.alpha = alpha;
		column.box.fxRoot.alpha = alpha;
		if (column.box.rightRoot) column.box.rightRoot.alpha = alpha;
		if (column.box.leftRoot) column.box.leftRoot.alpha = alpha;
		column.body.alpha = alpha;
		column.label.root.alpha = alpha;
	}

	private destroyColumn(column: Column) {
		column.cloudTex?.destroy(false);
		// the character may be in either layer; it goes with the rest
		column.back.addChild(column.body);
		column.back.destroy({ children: true });
		column.box.destroy();
		column.label.destroy();
		column.footTex?.destroy(false);
		column.footTex = null;
		column.bodyTex?.destroy(false);
		column.bodyTex = null;
		column.stillTex?.destroy(false);
		column.stillTex = null;
	}

	/** THE CHARACTER IN ITS BOX (Corey 2026-11-15: "the animation bleeds outside the column boxes ... I'd like their feet
	 *  to be behind the borders ... the same for the top border"): the clip's frame, drawn at the column's size, cropped
	 *  by its own texture's frame to the box's outer edge (a crop, not a mask: the column cloud's own technique), and
	 *  drawn UNDER the red frame, which covers the cut (feet, antlers, hat). THE RIGHT BORDER (Corey 2026-11-16: "let them
	 *  overlap on the right borders"): `rightFree` (it stands clear of its entrance's cloud: the rest of the entrance,
	 *  its idle and its win) leaves the right side uncut, so an elbow, the cane or an antler draws over the right band
	 *  (a layer under the characters) and on past the box; while its cloud is in the picture it is cut there too, so
	 *  no cloud ever passes the frame. Every cut is inside the frame's dark line (RED_BOX.edge in from its outer edge),
	 *  so no filtered edge texel can show outside it at any render resolution. */
	private placeBody(column: Column, clip: Clip, frame: number, rightFree = true) {
		column.frame = frame;
		this.placeClip(column, clip, frame, column.body, 'bodyTex', rightFree, null);
	}

	/** a clip's frame on `sprite` (the character, or the growing box's cloud), at the column's size, cropped by its own
	 *  dynamic texture's frame (`slot`) to the column's inside (columnInside) at the left, top and bottom, at the right
	 *  unless `rightFree`, and to `rows` (road px, the growing box's top and height) when given. Any frame count, any fps,
	 *  any sheet: the texture follows the frame's own sheet. */
	private placeClip(column: Column, clip: Clip, frame: number, sprite: PIXI.Sprite, slot: 'bodyTex' | 'cloudTex', rightFree: boolean, rows: { y: number; h: number } | null) {
		const k = COLUMN.tierScale[column.tier] ?? 1;
		const left = BOARD_X + column.reel * PITCH;
		// scaled about the middle of the column's foot
		const footX = left + PITCH / 2;
		const footY = COLUMN_TOP + COLUMN_H;
		const src = clip.textures[frame];
		const bx = footX + (clip.x - PITCH / 2) * k;
		const by = footY + (clip.y - COLUMN_H) * k;
		const bw = clip.width * k;
		const bh = clip.height * k;
		const o = columnInside(column.reel);
		const x0 = Math.max(bx, o.x);
		const x1 = rightFree ? bx + bw : Math.min(bx + bw, o.x + o.w);
		const y0 = Math.max(by, o.y, rows ? rows.y : -Infinity);
		const y1 = Math.min(by + bh, o.y + o.h, rows ? rows.y + rows.h : Infinity);
		if (!src || src.destroyed || x1 - x0 < 1 || y1 - y0 < 1) {
			sprite.visible = false;
			return;
		}
		const f = src.frame;
		const perX = f.width / bw;
		const perY = f.height / bh;
		// dynamic: the sprite follows a texture whose frame changes when the texture says so
		const tex = (column[slot] ??= new PIXI.Texture({ source: src.source, frame: f.clone(), dynamic: true }));
		if (tex.source !== src.source) tex.source = src.source;
		tex.frame.x = f.x + (x0 - bx) * perX;
		tex.frame.y = f.y + (y0 - by) * perY;
		tex.frame.width = Math.max(1, (x1 - x0) * perX);
		tex.frame.height = Math.max(1, (y1 - y0) * perY);
		tex.update();
		if (sprite.texture !== tex) sprite.texture = tex;
		sprite.position.set(x0, y0);
		sprite.width = x1 - x0;
		sprite.height = y1 - y0;
		sprite.visible = true;
	}

	/** THE ENTRANCE WHILE THE BOX GROWS (2026-11-19): `e` ms into the entrance (= since the grow began), the box's top `y`
	 *  and height `h` (road px). Its frame for that time, cropped to the box: in its cloud frames on the box's cloud sprite
	 *  (under the frame, cut on every side: no cloud ever passes the frame), past them (a grow longer than the clip's cloud)
	 *  as the character itself, among the characters as it would stand in the entrance. Under it the still cloud, cropped
	 *  to the box the same way (what the entrance thins to; and all the box shows while the entrance's pictures are not
	 *  in: once they are, the entrance picks up at the frame for the time gone). */
	private growEntrance(column: Column, reveal: Clip | null, e: number, y: number, h: number) {
		const rows = { y, h };
		this.placeStill(column, rows);
		if (!reveal || !reveal.textures.length || reveal.textures.some((x) => x.destroyed)) {
			column.cloud.visible = false;
			column.body.visible = false;
			column.enterCloud = false;
			return;
		}
		const n = reveal.textures.length;
		const frame = Math.max(0, Math.min(n - 1, Math.floor((e / 1000) * reveal.fps)));
		column.frame = frame;
		if (frame < reveal.cloudFrames) {
			column.body.visible = false;
			this.bodyOver(column, false);
			this.placeClip(column, reveal, frame, column.cloud, 'cloudTex', false, rows);
			column.enterCloud = true;
		} else {
			column.cloud.visible = false;
			this.bodyOver(column, true);
			this.placeClip(column, reveal, frame, column.body, 'bodyTex', true, rows);
			column.enterCloud = false;
		}
		this.voiceStep(column, frame);
	}

	/** the still cloud behind the column, wall to wall inside the frame; while the box grows, cropped to its rows (its own
	 *  dynamic texture: the shared still is never changed) */
	private placeStill(column: Column, rows: { y: number; h: number } | null) {
		const still = column.still?.backdrop ?? getBackdrop();
		const backdrop = column.backdrop;
		if (!still || still.destroyed) {
			backdrop.visible = false;
			return;
		}
		const full = columnInside(column.reel);
		const y0 = rows ? Math.max(full.y, rows.y) : full.y;
		const y1 = rows ? Math.min(full.y + full.h, rows.y + rows.h) : full.y + full.h;
		if (y1 - y0 < 1) {
			backdrop.visible = false;
			return;
		}
		let tex = still;
		if (rows) {
			const f = still.frame;
			const per = f.height / full.h;
			const t = (column.stillTex ??= new PIXI.Texture({ source: still.source, frame: f.clone(), dynamic: true }));
			if (t.source !== still.source) t.source = still.source;
			t.frame.x = f.x;
			t.frame.width = f.width;
			t.frame.y = f.y + (y0 - full.y) * per;
			t.frame.height = Math.max(1, (y1 - y0) * per);
			t.update();
			tex = t;
		}
		if (backdrop.texture !== tex) backdrop.texture = tex;
		backdrop.position.set(full.x, y0);
		backdrop.width = full.w;
		backdrop.height = y1 - y0;
		backdrop.tint = COLUMN.backdropTint;
		backdrop.visible = true;
	}

	/** the character stands in full color out of the cloud (its entrance frame REINDEER_SOUND columnIn.frame, in the grow
	 *  or after it): the reindeer's first hoof, Santa's heavy steps, Grandma's cane */
	private voiceStep(column: Column, frame: number) {
		if (column.stepVoiced || frame < REINDEER_SOUND.columnIn.frame[column.tier]) return;
		column.stepVoiced = true;
		this.sounds.mark('footfall', `reel ${column.reel} ${column.tier} frame ${frame}`);
		this.sounds.cue(column.tier === 'santa' ? 'santaIn' : column.tier === 'grandma' ? 'grandmaIn' : 'columnIn', `reel ${column.reel}`);
	}

	private updateColumn(column: Column) {
		const t = this.clock - column.t0;
		const left = BOARD_X + column.reel * PITCH;
		const full = inset({ x: left, y: COLUMN_TOP, w: PITCH, h: COLUMN_H });
		const reveal = getClip(column.tier, 'reveal');
		const idle = column.still ? this.landingIdle(column, column.still) : getClip(column.tier, 'idle');

		if (column.phase === 'leave') {
			const u = t / COLUMN.leaveMs;
			// (its shadow is in the column's back layer: it fades with it)
			this.placeFoot(column);
			this.fadeColumn(column, Math.max(0, 1 - u));
			if (u >= 1) {
				for (let row = 0; row < ROWS; row++) this.hideCell(column.reel * ROWS + row, false);
				this.destroyColumn(column);
				this.columns = this.columns.filter((c) => c !== column);
				// a posed column of the first board: its frames go with it (the sheet itself is the preload's), and once
				// the last one has gone its sheet may leave the GPU
				if (column.still) {
					for (const t of column.still.clip.textures) t.destroy(false);
					this.releaseLandingIdle(column.tier);
					if (!this.columns.some((c) => c.still)) {
						// (the cloud still's frame is shared by the three: it goes with the last)
						column.still.backdrop.destroy(false);
						this.onLandingGone?.();
					}
					return;
				}
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
			if (column.phase === 'impact' && t >= column.impactMs) {
				column.phase = 'grow';
				// THE BOX STARTS TO GROW up the reel: its riser (constants REINDEER_SOUND grow)
				this.sounds.mark('grow', `reel ${column.reel}`);
				this.sounds.cue('grow', `reel ${column.reel}`);
			}
			if (column.phase === 'grow') {
				const u = Math.min(1, (t - column.impactMs) / column.growMs);
				g = 1 - (1 - u) * (1 - u);
			}
			const y = from.y + (full.y - from.y) * g;
			const h = from.h + (full.h - from.h) * g;
			// the box is traced around the struck cell first, the symbol still showing under it
			const sinceBox = this.clock - column.boxT0;
			const cell = column.reel * ROWS + column.fromRow;
			// THE BAND thickens from a cell's to the full column's as it grows (WILD_FRAME.band); the crosshair hands over to
			// the cell's frame as it closes onto it (crosshairHandover), and the frame moves on the board clock
			const band = WILD_FRAME.band.cell + (WILD_FRAME.band.col - WILD_FRAME.band.cell) * g;
			column.box.set(full.x, y, full.w, h, column.fromRow < 0 || column.xhBox ? 1 : sinceBox / COLUMN.boxDrawMs, band);
			column.box.opacity = column.xhBox ? this.crosshairHandover(cell) : 1;
			column.box.update(this.clock);
			// the cloud in the box: the cell cloud pops in once the box is whole, then the entrance's own first frame
			// cropped to the box as it grows
			const sincePop = sinceBox - COLUMN.boxDrawMs;
			column.cellCloud.visible = column.phase !== 'grow' && column.fromRow >= 0 && sincePop >= 0;
			if (column.cellCloud.visible && !column.crashVoiced) {
				// THE CELL CLOUD'S FIRST FRAME (it pops once the box is traced): the crash
				column.crashVoiced = true;
				this.sounds.mark('cloud', `column reel ${column.reel}`);
				this.sounds.cue('crash', `reel ${column.reel}`);
			}
			if (column.cellCloud.visible) {
				const u = Math.min(1, sincePop / COLUMN.cloudPopMs);
				const over = COLUMN.cloudPopOver;
				const k = u < 0.7 ? COLUMN.cloudPopFrom + (over - COLUMN.cloudPopFrom) * (u / 0.7) : over + (1 - over) * ((u - 0.7) / 0.3);
				const ct = this.cellCloudTex(from.w, from.h);
				if (column.cellCloud.texture !== ct) column.cellCloud.texture = ct;
				column.cellCloud.position.set(from.x + (from.w * (1 - k)) / 2, from.y + (from.h * (1 - k)) / 2);
				column.cellCloud.width = from.w * k;
				column.cellCloud.height = from.h * k;
				this.hideCell(column.reel * ROWS + column.fromRow, true);
			}
			// THE ENTRANCE PLAYS FROM THE GROW'S START (Corey 2026-11-19: "When a full screen wild is in the reveal process,
			// we stay on a still video for the frames until the border has grown all the way. Is it possible to have the
			// video alreday playing within the border boundaries while it grows?"): its frame for the time since the grow
			// began, cropped to the box as it is now, and the still cloud under it cropped the same way; at the box's full
			// height the entrance simply carries on (its clock is the grow's: column.t0 below)
			if (column.phase === 'grow') {
				// (COLUMN.entranceWithGrow false: the entrance's first frame stands still until the box is whole, as before)
				this.growEntrance(column, reveal, COLUMN.entranceWithGrow ? t - column.impactMs : 0, y, h);
				// the symbols under the box as it passes them
				for (let row = 0; row < ROWS; row++) if (LINES[row + 1] > y && LINES[row] < y + h) this.hideCell(column.reel * ROWS + row, true);
			}
			if (column.phase === 'grow' && t >= column.impactMs + column.growMs) {
				// the column's cloud now covers the whole reel: a Grandma car's red box under it goes, and a Grandma Wild
				// standing in the reel (never under variant F) gives way to the column, her number joining its own
				this.dropMarks(column.reel);
				for (const c of this.clouds) if (Math.floor(c.cell / ROWS) === column.reel && c.leaving === null) c.leaving = this.clock;
				column.phase = 'enter';
				// the entrance's clock is the grow's: it began with the grow and carries on (no frame skipped or repeated);
				// with COLUMN.entranceWithGrow false it starts now
				column.t0 = COLUMN.entranceWithGrow ? column.t0 + column.impactMs : this.clock;
				column.cloud.visible = false;
				// the box is whole: its baubles drop in (WILD_FRAME.land)
				column.box.land(this.clock);
				// the entrance is still in its cloud frames: the crash cloud carries on through this hand-over (its loop with it)
				column.enterCloud = !!reveal && reveal.cloudFrames > 0 && Math.floor(((this.clock - column.t0) / 1000) * reveal.fps) < reveal.cloudFrames;
				for (let row = 0; row < ROWS; row++) this.hideCell(column.reel * ROWS + row, true);
				// THE HAND-OVER IN ONE FRAME (2026-11-17, Corey: "the video disappears in one of them, which looks like a big
				// glitch"): the moving cloud has just been hidden, so the entrance (its still cloud and its first frame) is
				// drawn on THIS frame too. It used to return here and draw it on the next, leaving one frame with nothing
				// inside the frame but the bare road, at every column's arrival (seen when that frame was shown: most often
				// at turbo, where the arrival has fewer frames).
				this.updateColumn(column);
			}
			return;
		}

		column.box.set(full.x, full.y, full.w, full.h, 1, WILD_FRAME.band.col);
		column.box.opacity = 1;
		column.box.update(this.clock);
		column.cellCloud.visible = false;
		column.cloud.visible = false;
		// THE STILL CLOUD, wall to wall inside the frame, from the first frame of the entrance to the column's last. The
		// entrance's own first frames are a full cloud over it, so it is first seen as that moving cloud thins: the
		// hand-over is the clip's own fade, with no cut.
		this.placeStill(column, null);

		if (column.phase === 'enter') {
			const frames = reveal ? reveal.textures.length : 0;
			// (its last frame holds to its length: Clip.ms)
			const length = reveal ? reveal.ms : 200;
			if (reveal) {
				const frame = Math.max(0, Math.min(frames - 1, Math.floor((t / 1000) * reveal.fps)));
				this.placeBody(column, reveal, frame, frame >= reveal.cloudFrames);
				column.enterCloud = frame < reveal.cloudFrames;
				this.voiceStep(column, frame);
				// while the cloud is still in the frame the box stands OVER it (the cloud is inside the box); once the
				// character stands alone it moves up among the characters (still under the frame)
				this.bodyOver(column, frame >= reveal.cloudFrames);
			} else {
				column.body.visible = false;
			}
			if (!column.labelShown && t >= length * COLUMN.numberAt) {
				column.labelShown = true;
				column.label.show(column.multiplier - column.joinAdd, 'appear', this.clock);
				this.stamp(column, column.multiplier - column.joinAdd);
			}
			this.joinNumber(column, t - length * COLUMN.numberAt);
			if (t >= length) {
				column.phase = 'idle';
				column.t0 = this.clock;
				column.enterCloud = false;
				// the entrance's pictures can go once this column is drawing its idle (below)
				column.dropReveal = true;
				// a sticky column (free spins, Super) stands to stay: it settles in (constants REINDEER_SOUND sticky)
				if (column.sticky) {
					this.sounds.mark('sticky', `reel ${column.reel}`);
					this.sounds.cue('sticky', `reel ${column.reel}`);
				}
			}
		} else if (column.phase === 'win') {
			const win = getClip(column.tier, 'win');
			const length = win ? win.ms : 0;
			if (!win || t >= length) {
				column.phase = 'idle';
				column.t0 = this.clock;
			} else {
				if (!column.winVoiced) {
					// the win clip's first frame: the character's own win sound (constants REINDEER_SOUND column win)
					column.winVoiced = true;
					this.sounds.columnWin(column.tier, column.reel);
				}
				this.bodyOver(column, true);
				this.placeBody(column, win, Math.min(win.textures.length - 1, Math.floor((t / 1000) * win.fps)));
			}
		}
		if (column.phase === 'idle' && idle) {
			// each column a little out of step with its neighbors, so two of a kind do not move as one (COLUMN.idlePhaseMs a
			// reel: the same time whatever the loop's frame count)
			const ticks = ((t + column.reel * COLUMN.idlePhaseMs) / 1000) * idle.fps;
			const frame = Math.floor(ticks) % idle.textures.length;
			this.bodyOver(column, true);
			this.placeBody(column, idle, frame);
			if (column.tier === 'reindeer' && !column.still) {
				// the idle loop restarts (not its first frame after an entrance or a win): the snort's roll
				const loop = Math.floor(ticks / idle.textures.length);
				if (column.idleT0 !== column.t0) {
					column.idleT0 = column.t0;
					column.idleLoop = loop;
				} else if (loop !== column.idleLoop) {
					column.idleLoop = loop;
					this.sounds.mark('idleWrap', `reel ${column.reel}`);
					this.sounds.idleWrap(column.reel);
				}
			}
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
		// a join's sum slams down: its stamp
		if (column.stampAt !== null && this.clock >= column.stampAt) {
			column.stampAt = null;
			this.stamp(column, column.multiplier);
		}
		// the number (constants WILD_MULT); it never changes once it stands but for a Grandma Wild's join
		column.label.update(this.clock);
		this.placeFoot(column);
	}

	/** A COLUMN CHARACTER'S SHADOW (constants SHADOW column): its twin thrown up and to the left onto the column's cloud,
	 *  cropped to the inside of the box, once the character stands clear of the entrance's cloud (it is drawn among the
	 *  characters then), coming in over columnInMs. It lies in the column's back layer, so a leave fades it with the
	 *  column. */
	private placeFoot(column: Column) {
		const k = SHADOW.columns && SHADOW.on ? Math.max(0, Math.min(1, SHADOW.column.alpha)) : 0;
		const standing = column.body.visible && this.standing(column) && column.phase !== 'wait';
		if (k <= 0 || (!standing && column.phase !== 'leave') || !column.body.visible) {
			column.foot.visible = false;
			column.footT0 = NaN;
			return;
		}
		if (Number.isNaN(column.footT0)) column.footT0 = this.clock;
		const ramp = Math.min(1, (this.clock - column.footT0) / Math.max(1, SHADOW.columnInMs));
		const box = inset({ x: BOARD_X + column.reel * PITCH, y: COLUMN_TOP, w: PITCH, h: COLUMN_H });
		column.footTex = dropShadow(column.foot, column.footTex, column.body, box, k * ramp);
	}

	/** a Grandma Wild's multiplier joining the column's number, joinMs after it popped in: the sum, counted up to */
	private joinNumber(column: Column, sincePop: number) {
		if (column.joinAdd <= 0 || !column.labelShown || sincePop < COLUMN.joinMs) return;
		column.joinAdd = 0;
		// it counts up to the sum and slams down (constants WILD_MULT change); the stamp plays as it slams
		column.label.change(column.multiplier, this.clock);
		column.stampAt = column.label.slamAt();
	}

	/** a column's number stamps on (its pop): the multiplier stamp of its band (REINDEER_SOUND stamp) */
	private stamp(column: Column, value: number) {
		const S = REINDEER_SOUND.stamp;
		const band = value >= S.high ? 'high' : value >= S.mid ? 'mid' : 'small';
		this.sounds.mark('stamp', `reel ${column.reel} ${value}x ${band}`);
		this.sounds.playNamed(S.names[band], `reel ${column.reel} ${value}x`);
	}

	private wait(at: number): Promise<void> {
		if (this.destroyed) return Promise.resolve();
		return new Promise<void>((resolve) => this.waiters.push({ at, resolve }));
	}

	/** where the runner is in its strike (dev hook and the probes) */
	private runnerPhase(r: Runner): 'wait' | 'along' | 'turn' | 'down' | 'cut' | 'impact' {
		if (r.impactAt !== null) return 'impact';
		if (this.clock < r.t0 || r.shown < 0) return 'wait';
		if (r.pose < r.nR) return 'along';
		return r.pose < r.nAlong ? 'turn' : r.shown < r.nAlong + r.nC ? 'down' : 'cut';
	}

	/** what stands on the road (dev hook and the probes) */
	/** a column's box and clouds as drawn, road px (the probes' per-frame log of the struck cell, the pop and the growth) */
	columnTrace(reel: number) {
		const c = this.columns.find((x) => x.reel === reel && x.phase !== 'leave');
		if (!c) return null;
		const [top, bottom, left, right] = c.box.lines();
		return { ms: this.clock - c.boxT0, phase: c.phase, top: top.width, right: right.height, bottom: bottom.width, left: left.height, boxY: top.y, boxBottom: bottom.y + bottom.height, cellCloud: c.cellCloud.visible ? c.cellCloud.width : 0, growCloud: c.cloud.visible ? c.cloud.height : 0 };
	}

	/** THE WILDS' FRAMES as laid (dev hook __reindeer.wildFrames, tools/garland_probe.mjs): each column's, each Grandma Wild
	 *  cell's and each marked car's garland (road px), its look, what of it is drawn */
	frames() {
		return {
			columns: this.columns.filter((c) => c.phase !== 'leave').map((c) => {
				const clip = (name: 'reveal' | 'idle' | 'win') => {
					const k = getClip(c.tier, name);
					return k ? { frames: k.textures.length, fps: k.fps, ms: k.ms, cloudFrames: k.cloudFrames } : null;
				};
				return { reel: c.reel, tier: c.tier, phase: c.phase, frame: c.frame, clips: { reveal: clip('reveal'), idle: clip('idle'), win: clip('win') }, ...c.box.parts() };
			}),
			cells: this.clouds.filter((c) => c.leaving === null).map((c) => ({ cell: c.cell, scale: c.root.scale.x, ...c.box.parts() })),
			marks: this.marks.map((m) => ({ cell: m.cell, ...m.box.parts() })),
		};
	}

	snapshot() {
		return {
			columns: this.columns.filter((c) => c.phase !== 'leave').map((c) => ({ reel: c.reel, tier: c.tier, multiplier: c.multiplier, sticky: c.sticky, phase: c.phase, drawn: c.body.visible, backdrop: c.backdrop.visible, over: this.standing(c), frame: c.frame, landing: c.still ? (c.still.live ? 'live' : 'still') : null })),
			// the characters as they are drawn, back to front (reel numbers from 0)
			bodyOrder: [...this.stacks].reverse().flatMap((s) => s.body.children.map((b) => this.reelOfBody(b))),
			clouds: this.clouds.filter((c) => c.leaving === null).map((c) => c.cell),
			runner: this.runner ? this.runnerSnapshot(this.runner) : null,
			/** the roaming reindeer (game/road/roam.ts) */
			roam: this.roam.snapshot(),
			/** his charge wind-up's effects (game/road/chargeWindup.ts): up now, and what this strike spawned */
			charge: { up: this.charge.state(this.clock), snow: this.charge.log.snow.map((q) => ({ ...q, t: Math.round(q.t * 100) / 100 })), puff: this.charge.log.puff },
			/** the red boxes on Grandma cars in struck Santa reels */
			marks: this.marks.map((m) => m.cell),
		};
	}

	/** the runner as drawn (the probes' per-frame log): its view and stride, its feet in road px, its size on top of the
	 *  built size, and whether it is the mirrored run (from the right) */
	private runnerSnapshot(r: Runner) {
		const s = r.sprite;
		return {
			phase: this.runnerPhase(r),
			view: r.placeholder ? 'placeholder' : r.view,
			stride: r.stride,
			x: Math.round(s.x * 100) / 100,
			y: Math.round(s.y * 100) / 100,
			scale: Math.round(r.scale * 10000) / 10000,
			mirrored: s.scale.x < 0,
			alpha: Math.round(s.alpha * 100) / 100,
			rotation: 0,
			pose: Math.round(r.pose * 1000) / 1000,
			index: r.shown,
			late: r.late === null ? null : Math.round(r.late * 100) / 100,
			poses: { side: r.nR, diagonal: r.nQ, along: r.nAlong, down: r.nC, cut: r.nCut, firstStride: r.s0, factor: Math.round(r.factor * 10000) / 10000 },
			toX: r.toX,
			gapX: r.gapX,
			cutDir: r.cutDir,
			/** BRAWL: a Grandma car's strike, and where it ends (the car's rear; the reel's centre otherwise) */
			grandma: r.grandma,
			endX: Math.round(r.endX * 100) / 100,
			endY: Math.round(r.endY * 100) / 100,
			/** ms from the set off to the impact as planned, the straight path's (kept), and whether it is kept */
			impactMs: Math.round(r.times[r.times.length - 1] * 100) / 100,
			/** road clock ms since the set off (negative in the lead in) */
			elapsedMs: Math.round((this.clock - r.t0) * 100) / 100,
			keepMs: Math.round(r.keepMs * 100) / 100,
			kept: r.kept,
			impactFeetY: Math.round(r.impactFeetY * 100) / 100,
			/** the roaming reindeer's strike: his own, the run back out, the off-screen strike's time, his wait */
			roam: r.roam,
			pre: r.preN,
			todayMs: Math.round(r.todayMs * 100) / 100,
			waitMs: Math.round(r.waitMs * 100) / 100,
			startX: Math.round(r.path[0].x * 100) / 100,
			startY: Math.round(r.path[0].y * 100) / 100,
		};
	}

	/** THE CAST SHADOWS of the features as drawn (dev hook, tools/shadow_probe.mjs): each column character's twin on its
	 *  cloud against the character and the box, and the running reindeer's twin against him */
	shadowSnapshot() {
		const r2 = (v: number) => Math.round(v * 100) / 100;
		const r = this.runner;
		return {
			columns: this.columns.map((c) => {
				const f = c.foot;
				const box = inset({ x: BOARD_X + c.reel * PITCH, y: COLUMN_TOP, w: PITCH, h: COLUMN_H });
				return {
					reel: c.reel, tier: c.tier, phase: c.phase, bodyVisible: c.body.visible, bodyOver: this.standing(c),
					body: { x: r2(c.body.x), y: r2(c.body.y), w: r2(c.body.width), h: r2(c.body.height), source: c.body.texture?.source?.uid ?? -1, frame: c.body.texture ? { x: c.body.texture.frame.x, y: c.body.texture.frame.y, w: c.body.texture.frame.width, h: c.body.texture.frame.height } : null },
					box: { x: box.x, y: box.y, w: box.w, h: box.h },
					visible: f.visible && !f.destroyed, x: r2(f.x), y: r2(f.y), w: r2(f.width), h: r2(f.height), alpha: Math.round(f.alpha * 1000) / 1000, backAlpha: Math.round(c.back.alpha * 1000) / 1000,
					source: f.texture?.source?.uid ?? -1, frame: f.texture ? { x: r2(f.texture.frame.x), y: r2(f.texture.frame.y), w: r2(f.texture.frame.width), h: r2(f.texture.frame.height) } : null,
					// it lies on its own cloud: between the backdrop and the character, in the column's back layer
					inBack: f.parent === c.back && c.back.getChildIndex(f) > c.back.getChildIndex(c.backdrop),
				};
			}),
			runner: r
				? {
						phase: this.runnerPhase(r), view: r.placeholder ? 'placeholder' : r.view, stride: r.stride, feetX: r2(r.sprite.x), feetY: r2(r.sprite.y), scale: Math.round(r.scale * 10000) / 10000, spriteVisible: r.sprite.visible, spriteAlpha: Math.round(r.sprite.alpha * 1000) / 1000,
						spriteScaleX: Math.round(r.sprite.scale.x * 10000) / 10000, spriteScaleY: Math.round(r.sprite.scale.y * 10000) / 10000, anchor: [r.sprite.anchor.x, r.sprite.anchor.y], textureHeight: r.sprite.texture?.height ?? 0, gapX: r.gapX, toX: r.toX,
						shadow: { visible: r.shadow.visible && !r.shadow.destroyed, x: r2(r.shadow.x), y: r2(r.shadow.y), scaleX: Math.round(r.shadow.scale.x * 10000) / 10000, scaleY: Math.round(r.shadow.scale.y * 10000) / 10000, skewX: r.shadow.skew.x, anchor: [r.shadow.anchor.x, r.shadow.anchor.y], sameTexture: r.shadow.texture === r.sprite.texture, alpha: Math.round(r.shadow.alpha * 1000) / 1000, inGround: r.shadow.parent === this.groundLayer },
					}
				: null,
			layers: { runner: this.groundLayer.children.length, runnerLayer: this.runnerLayer.children.length, feet: this.columns.filter((c) => c.foot.visible).length },
		};
	}

	/** THE SMOKE OF ONE CELL, EDGE TO EDGE (2026-11-17, Corey: "can we extend the smoke image to the full width of the
	 *  border? Then crop it at the Border boundaries?"): the cell cloud's picture has open sides (its smoke stops short of
	 *  the frame, its debris pokes out), so the box shows the picture's opaque core only, cropped by the texture's frame (a
	 *  crop, not a mask) to the box's own shape and scaled to fill it: the smoke reaches the red band on every side, and
	 *  nothing passes the box (the red band is drawn over the crop's edge). CLOUD_CELL.core: the core's inset share of the
	 *  picture each side, measured on the atlas (99.9% opaque inside). One texture per box shape, kept. */
	private cellTex = new Map<string, PIXI.Texture>();
	private cellCloudTex(w: number, h: number): PIXI.Texture {
		const base = this.tex('cloud_cell');
		if (!base) return PIXI.Texture.EMPTY;
		const A = w / Math.max(1, h);
		const C = CLOUD_CELL.core;
		const key = `${A.toFixed(3)}|${C.x}|${C.y}`;
		let t = this.cellTex.get(key);
		if (t) return t;
		const f = base.frame;
		const maxW = f.width * (1 - 2 * C.x);
		const maxH = f.height * (1 - 2 * C.y);
		const fw = Math.min(maxW, maxH * A);
		const fh = fw / A;
		t = new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(f.x + (f.width - fw) / 2, f.y + (f.height - fh) / 2, fw, fh) });
		this.cellTex.set(key, t);
		return t;
	}

	destroy() {
		this.destroyed = true;
		for (const t of this.cellTex.values()) t.destroy(false);
		this.cellTex.clear();
		this.sounds.stopAll();
		this.runner?.resolve();
		this.charge.clear();
		for (const w of this.waiters) w.resolve();
		this.waiters = [];
	}
}
