// THE ROAD BOARD: the 5 x 4 board drawn as a four lane road, and its traffic.
//
// One plain PIXI container in ROAD PX (the 1536 x 1024 background's pixels, game/roadArtSpec.ts), moved by ONE
// update call per frame (components/Board.svelte ticks it and scales the container into the layout). No Svelte
// state is touched per frame, no texture is made per frame, and there is no filter, mask or shader: the traffic
// "comes out of the tunnels" because the two portal strips cut from the background are drawn over it, and it
// darkens near them by a plain sprite tint.
//
// Layers, back to front: the scene's field (game/scene/sceneLayers.ts), the background, the scene's bands and forest, the
// ground (every symbol's cast shadow and the running reindeer's, game/road/shadows.ts), the four lanes (top lane first, so
// lower lanes draw in front), the features (cloud cells, red boxes, column characters), the line win overlay, the two
// stoplights, the scene's edge cover beside the picture (where the rock was until scene pass 9), the tunnel portals, the
// scene's painted tunnel ends and the running reindeer.
//
// What is on the board only ever comes from the caller (the book event handlers): setBoard / driveIn take the
// book's board as it is. The one place a random number is used is the make-believe "through traffic" that may pass
// while the game waits for a slow book (ROAD_MOTION through), which is decoration and never lands.
import * as PIXI from 'pixi.js';

import { ROAD_ART } from '../roadArtSpec';
import config from '../config';
import { LANDING_DIM, LANE_FLOW, LINE_WIN, REINDEER_SOUND, ROAD, SEATED, STOPLIGHT, WAGON_TREE, motionFor, type RoadMotion } from '../constants';
import type { LayoutKind } from '../layoutSpec';
import type { Board, SymbolName } from '../types';
import { NumberLabel, RoadFeatures } from './roadFeatures';
import { PRESENT_LOOK, PresentActor, presentOpenMs, presentStillTexture, presentsReadyForOpen, presentTriggerPlayed } from './present';
import { castShadow, makeShadow, shadowStrength } from './shadows';
import { PoliceLightBar } from './policeLights';
import { VanWinFx } from './vanWin';
import { WinLights, lightsSchedule, type LightLine, type SlamOpts } from './winLights';
import { WagonTree, type TreeFrame } from './wagonTree';
import { SeatedDriver, type SeatFrame } from './seated';
import { BrakeLightPair, type BrakeState } from './brakeLights';
import { SceneLayers } from '../scene/sceneLayers';
import { releaseAllSeatClips, seatClip, type SeatChar, type SeatClip } from './seatedClips';
import { flowLevel, flowParams, planFlow, type FlowCar, type FlowPlan } from './laneFlow';
import { PHONE_TIER } from '../deviceTier';

const COLS = ROAD_ART.board.columns;
const ROWS = ROAD_ART.board.rows;
const PITCH = ROAD_ART.board.pitch;
const LINES = ROAD_ART.laneLines;
const MOUTH_L = ROAD_ART.covers.left.mouth;
const MOUTH_R = ROAD_ART.covers.right.mouth;
/** how far past a mouth a symbol is parked or retired, on top of half its own width (it is under the portal there) */
const HIDE_PAD = 40;

const CARS: SymbolName[] = ['H1', 'H2', 'H3', 'H4'];
/** THE VALID STRIKE TARGETS (the book's grandmaCar and santaSleigh): the target crosshair hops between these, and the
 *  other symbols fade while it is up (constants CROSSHAIR) */
const TARGETS: SymbolName[] = ['H1', 'W'];
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
	/** in (LANE_FLOW): when it leaves the tunnel (board clock), its cruise speed (road px per s) and its brake (ms) */
	rel: number;
	v: number;
	b: number;
	overshoot: number;
	dive: number;
	m: RoadMotion | null;
	/** line win: part of a win, and the brightness it is drawn at */
	winning: boolean;
	bright: number;
	tintNow: number;
	/** in: it has reached its stop point (the brake bounce follows) */
	stopped: boolean;
	/** THE SCATTER PRESENT's animation (game/road/present.ts): made the first time this sprite's present animates, kept
	 *  with the sprite (it is drawn just after it in its lane) */
	present: PresentActor | null;
	/** ITS CAST SHADOW (game/road/shadows.ts): its twin, made with the car, in the ground layer */
	shadow: PIXI.Sprite;
	/** A POLICE CAR'S LIGHT BAR (game/road/policeLights.ts): made the first time this sprite wins as a police car */
	lights: PoliceLightBar | null;
	/** THE VAN'S WIN (game/road/vanWin.ts): made the first time this sprite wins as the van */
	van: VanWinFx | null;
	/** THE RIDERS, each made the first time this slot draws its vehicle and kept with it, in its lane just after the
	 *  sprite and given the sprite's transform, tint and visibility every frame (syncRiders): THE WAGON'S TREE
	 *  (game/road/wagonTree.ts) and THE SEATED DRIVER (game/road/seated.ts) */
	tree: WagonTree | null;
	seated: SeatedDriver | null;
	/** the rider's silhouette above the vehicle (the tree's, the driver's), cast with the vehicle's shadow */
	riderShadow: PIXI.Sprite;
	/** THE BRAKE LIGHTS (game/road/brakeLights.ts): made the first time this slot shows a car (H1 to H4) */
	brake: BrakeLightPair | null;
};

/** THE DRIVE IN'S PLAN (constants LANE_FLOW, game/road/laneFlow.ts) as the road plays it: the plan (ms from `start`, the
 *  board clock of its first release), each lane's releases (board clock), and the tease's sound as played */
type Flow = {
	start: number;
	plan: FlowPlan;
	level: 0 | 1 | 2;
	free: boolean;
	laneRel: number[][];
	soundOn: boolean;
	soundDone: boolean;
	stepped: boolean;
	seenMarked: number;
	/** the scatters whose landing sound has played (REINDEER_SOUND.scatterLand) */
	landSounded: number;
	cut: boolean;
	/** DEV: performance.now() of the press, and when the board came to rest (the spin's length) */
	pressReal: number;
};

/** the asset tier the riders' sheets come in */
const TIER: 'full' | 'phone' = PHONE_TIER ? 'phone' : 'full';
/** the vehicles that carry a seated driver */
const SEATS: SymbolName[] = ['H1', 'W'];

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
	/** the tease drives it now (constants STOPLIGHT.tease): its changes are silent and instant */
	teasing: boolean;
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

/** a winning line: its cells, its payline; the symbol it pays and its own amount (the Christmas lights, LINE_WIN lights) */
export type LineWinSpec = { cells: number[]; line: number; symbol?: string; amountText?: string; plainText?: string; multiplier?: number };
/** a line win's options: the turbo level's share of every time, a capped spin, TREATMENT B's (constants LINE_WIN slam):
 *  `onTotal` is called once on the win clock's frame the strip's total is due (the spin's win amount), `big` a big win (the
 *  strip counts it after the lines: the win ends when the last line is down), `phone` the upright phone's rule */
export type ShowWinOpts = { pace?: number; capped?: boolean; onTotal?: (() => void) | null; big?: boolean; phone?: boolean };

export class RoadBoard {
	readonly root = new PIXI.Container();
	private readonly lanes: PIXI.Container[] = [];
	/** THE GROUND: every cast shadow (the symbols' and the running reindeer's), under every lane, so no shadow is ever
	 *  drawn over a symbol */
	private readonly ground = new PIXI.Container();
	private readonly cars: Car[] = [];
	private readonly winLayer = new PIXI.Container();
	/** THE WIN EFFECTS: the police cars' lights (game/road/policeLights.ts), the van's flashlight and backfire
	 *  (game/road/vanWin.ts): over every lane, under the features and the line win */
	private readonly policeLayer = new PIXI.Container();
	/** THE BRAKE LIGHTS (game/road/brakeLights.ts, constants BRAKE_LIGHTS) */
	private readonly brakeLayer = new PIXI.Container();
	/** the far lamps' halos (constants BRAKE_LIGHTS.halo): over the ground's cast shadows, under every lane */
	private readonly brakeBackLayer = new PIXI.Container();
	/** THE SEATED DRIVERS' ANIMATIONS in this frame (game/road/seatedClips.ts): per character, the idle and the win if in */
	/** DEV: the seated idle's clock by hand (ms), null = performance.now() */
	seatTime: number | null = null;
	private seatClips: Record<SeatChar, { idle: SeatClip | null; win: SeatClip | null }> = { grandma: { idle: null, win: null }, santa: { idle: null, win: null } };
	/** THE DRIVE IN'S PLAN (constants LANE_FLOW): the last drive in's, null before the first or after a board put up */
	private flow: Flow | null = null;
	/** the drive in's waiter (a slam stop's cut brings it forward) */
	private driveWaiter: Waiter | null = null;
	/** the board clock when the slam stop's hurry began (a cut applies to the spin it began in) */
	private hurryFrom = -Infinity;
	/** this spin's stops were cut together (a slam stop): they sound once, by the turbo 2 rule */
	private cutOneMoment = false;
	/** DEV: the spin's length (press to rest, real ms) of the last drive ins */
	private spinLog: { pressReal: number; restReal: number | null; pressClock: number; startClock: number; restClock: number | null; level: number; scatters: number; factor: number; teaseFrom: number | null; end: number; cut: boolean }[] = [];
	private pressReal = 0;
	private pressClock = 0;
	private readonly winLines = new PIXI.Graphics();
	private winAmount: PIXI.Text | null = null;
	private winMult: NumberLabel | null = null;
	/** THE CHRISTMAS LIGHTS (game/road/winLights.ts), made at the first win; null until then */
	private winFx: WinLights | null = null;
	private lightsOn = false;
	/** the total's x multiplier is wanted (it shows with the total) */
	private winMultWanted = false;
	/** each light line's start (win clock ms into the win), and how many of them have sounded */
	private lineStarts: number[] = [];
	/** each light line's cells, in the lights' order: a winning symbol pulses only while a line through it is up */
	private lineCells: Set<number>[] = [];
	/** the last line show sounds until this performance.now() (one voice over the accelerating lines) */
	private lineShowUntil = 0;
	private linesVoiced = 0;
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
	/** THE SPIN'S SOUNDS (constants REINDEER_SOUND, round 2): per reel, when its last car reaches its stop point (board
	 *  clock; null once sounded, or for a reel no car drives into), whether the traffic's fade has begun, and a
	 *  trigger's pop still to come (the frame the first present's lid leaves the box) */
	private reelStopAt: (number | null)[] = [null, null, null, null, null];
	private trafficFading = false;
	/** a stop sound has played this spin (the traffic's fade may begin once every car is out) */
	private stopsBegun = false;
	/** this spin drove in at turbo 2: its reel stops are one moment and sound once (RoadSounds.reelStop) */
	private reelStopTurbo2 = false;
	private popWanted = false;
	/** a trigger's pop on its pulse's first frame (the open's pictures were not in time) */
	private pulsePopWanted = false;
	/** the win showing: its start (win clock), its whole length, when the total pops in (ms into the win) */
	private win: { t0: number; holdMs: number; fadeAt: number; active: boolean; dim: boolean; totalAt: number; onTotal: (() => void) | null; totalOnBoard: boolean } | null = null;
	private destroyed = false;
	/** how many symbols the board on the road parks (20, less four for every column Wild standing) */
	private parked = COLS * ROWS;

	/** THE SCENE AROUND THE ROAD (game/scene/sceneLayers.ts): its layers sit in this container's draw order */
	readonly scene = new SceneLayers();

	/** the present's still picture (game/road/present.ts), null when its sheet did not load (the S then draws empty) */
	private readonly presentStill: PIXI.Texture | null;

	/** THE LANDING DIM (constants LANDING_DIM): the road band outside reels 2 to 4, under the features (so the characters'
	 *  spill stays bright), and over the tunnel portals for the part of the band they cover. Null when off. */
	private landingDim: PIXI.Container[] | null = null;

	/** a lane's front car has stopped (the handler plays the stop sound) */
	onLaneStop: ((lane: number) => void) | null = null;

	constructor(private readonly tex: TextureLookup) {
		this.presentStill = presentStillTexture(tex('presentStill'));
		// THE SCENE (scene pass 9, game/scene/sceneLayers.ts): the field under the picture, the picture (since the scene
		// swap, 2026-11-17, the preset's own: the night scenes re-colour it), the bands and the forest over it
		this.root.addChild(this.scene.field, this.scene.picture);
		this.root.addChild(this.scene.bands, this.scene.forest);
		this.root.addChild(this.ground);
		this.root.addChild(this.brakeBackLayer);
		for (let row = 0; row < ROWS; row++) {
			const lane = new PIXI.Container();
			this.lanes.push(lane);
			this.root.addChild(lane);
		}
		// the brake lights over every lane (one batch for all of them), under the win effects
		this.root.addChild(this.brakeLayer);
		this.root.addChild(this.policeLayer);
		// the cloud cells, the red boxes and the column characters stand over the traffic and under the line win
		this.features = new RoadFeatures(tex);
		// the running reindeer's shadow lies on the ground with the traffic's (under every lane)
		this.ground.addChild(this.features.groundLayer);
		this.features.hideCell = (cell, hidden) => this.setCellHidden(cell, hidden);
		// the crosshair's candidates: the valid targets parked and shown now; and the board as text for its seed
		this.features.targetCells = () => this.cars.filter((c) => c.phase === 'rest' && c.sprite.visible && c.symbol !== null && TARGETS.includes(c.symbol)).map((c) => c.col * ROWS + c.lane);
		this.features.boardText = () => {
			const cells: string[] = Array.from({ length: COLS * ROWS }, () => '-');
			for (const c of this.cars) if (c.phase === 'rest' && c.symbol) cells[c.col * ROWS + c.lane] = c.symbol;
			return cells.join(',');
		};
		this.root.addChild(this.features.layer);
		this.winLayer.addChild(this.winLines);
		this.winLayer.visible = false;
		this.root.addChild(this.winLayer);
		this.root.addChild(this.lightLayer);
		this.buildLights();

		// THE EDGE COVER beside the picture (scene pass 9: where the dark rock, ROAD.rock, stood until then): the field's own
		// pixels over the traffic that has driven past the picture's edge. Only seen where the screen is wider than the
		// picture, and then it is the same snow as under it.
		this.root.addChild(this.scene.cover);
		// the tunnel portal strips (the preset's own since the scene swap: game/scene/sceneLayers.ts tunnels)
		this.root.addChild(this.scene.tunnels);
		// the painted tunnel ends over the portal strips (their caps lie on the stone), then the running reindeer over
		// everything of the road and the ends: he runs in on the snow from past the screen's edge (scene pass 9; until then
		// he was drawn under the stoplights and the rock and came out from under the rock)
		this.root.addChild(this.scene.ends);
		this.root.addChild(this.features.runnerLayer);
	}

	// ---- cars ------------------------------------------------------------------------------------------------------
	private take(lane: number, symbol: SymbolName): Car {
		const dir = ROAD.laneDirection[lane];
		let car = this.cars.find((c) => c.phase === 'free');
		if (!car) {
			const sprite = new PIXI.Sprite();
			sprite.anchor.set(0.5, 1);
			const shadow = makeShadow();
			this.ground.addChild(shadow);
			// the rider's shadow silhouette (the tree's, the driver's) lies right over the vehicle's own twin
			const riderShadow = makeShadow();
			// (its own label: the probes count the vehicles' twins by 'shadow')
			riderShadow.label = 'riderShadow';
			this.ground.addChild(riderShadow);
			car = { sprite, phase: 'free', lane: 0, col: -1, symbol: null, dir: 1, halfW: 0, baseScale: 1, restX: 0, x0: 0, t0: 0, stopAt: 0, rel: -Infinity, v: 0, b: 0, overshoot: 0, dive: 0, m: null, winning: false, bright: 1, tintNow: 0xffffff,	stopped: false, present: null, shadow, lights: null, van: null, tree: null, seated: null, riderShadow, brake: null };
			this.cars.push(car);
		}
		this.stopPresent(car);
		const frame = frameFor(symbol, dir);
		const size = (ROAD_ART.symbols as Record<string, { width: number; height: number }>)[frame];
		const want = (size?.width ?? PITCH * 0.8) * (ROAD.symbolScale[symbol] ?? 1);
		const still = symbol === 'S' ? this.presentStill : null;
		if (still) {
			// THE PRESENT, closed and still: its own sheet, drawn by the same anchor and scale as its animation frames
			// (game/road/present.ts), so a peek starts and ends on the very picture
			car.sprite.texture = still;
			car.sprite.anchor.set(PRESENT_LOOK.anchorX, PRESENT_LOOK.anchorY);
			car.baseScale = PRESENT_LOOK.scale * (ROAD.symbolScale.S ?? 1);
		} else {
			const texture = this.tex(frame) ?? PIXI.Texture.EMPTY;
			car.sprite.texture = texture;
			car.sprite.anchor.set(0.5, 1);
			car.baseScale = texture.width > 0 ? want / texture.width : 1;
		}
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
		car.rel = -Infinity;
		car.brake?.off();
		if (car.sprite.parent !== this.lanes[lane]) this.lanes[lane].addChild(car.sprite);
		// a new vehicle in this slot: its riders hang still
		car.tree?.reset();
		car.seated?.reset();
		return car;
	}

	private free(car: Car) {
		this.stopPresent(car);
		car.phase = 'free';
		car.symbol = null;
		car.sprite.visible = false;
		car.shadow.visible = false;
		car.lights?.off();
		car.van?.off(car.sprite, car.restX, laneSitY(car.lane));
		car.brake?.off();
		this.syncRiders(car);
	}

	// ---- the scatter present (game/road/present.ts) ------------------------------------------------------------------
	/** a present's animation stops and its still picture draws again */
	private stopPresent(car: Car) {
		car.present?.reset();
		car.sprite.renderable = true;
	}

	/** the present's actor, in its lane just after its sprite (so it draws exactly where the sprite would) */
	private presentOf(car: Car): PresentActor {
		const actor = (car.present ??= new PresentActor());
		const lane = this.lanes[car.lane];
		if (actor.root.parent !== lane || lane.getChildIndex(actor.root) !== lane.getChildIndex(car.sprite) + 1) {
			actor.root.removeFromParent();
			lane.addChildAt(actor.root, lane.getChildIndex(car.sprite) + 1);
		}
		actor.cell = car.col * ROWS + car.lane;
		return actor;
	}

	/** THE PEEK: a present has reached its stop point (`at`, board clock) */
	private peekPresent(car: Car, at: number) {
		this.presentOf(car).peek(at);
	}

	/** DEV: the peek on a present parked in a cell, from now (the probe's stills) */
	peekPresentAt(cell: number): boolean {
		const car = this.cars.find((c) => c.phase === 'rest' && c.symbol === 'S' && c.col * ROWS + c.lane === cell);
		return car ? this.presentOf(car).peek(this.clock) : false;
	}

	/** every present animating: follows its sprite, shows its frame and light */
	private updatePresents(now: number) {
		// a trigger whose open's pictures were not in time pulses instead: its pop on the pulse's first frame (pass 5)
		if (this.pulsePopWanted && this.win?.active) {
			this.pulsePopWanted = false;
			this.features.sounds.mark('lid', 'pulse first frame (the open did not load in time)');
			this.features.sounds.cue('present', 'pulse');
		}
		for (const car of this.cars) {
			const actor = car.present;
			if (!actor || !actor.busy) continue;
			if (!actor.update(now, car.sprite, car.baseScale)) car.sprite.renderable = true;
			// the pop starts on the open's first frame (round 3; its own pop is 170 ms into the file, so it lands just after
			// the lid leaves the box at PRESENT_LID_FRAME)
			if (this.popWanted && actor.openSlot >= REINDEER_SOUND.presentPopFrame) {
				this.popWanted = false;
				this.features.sounds.mark('lid', `cell ${actor.cell} open frame ${actor.openSlot}`);
				this.features.sounds.cue('present', `cell ${actor.cell}`);
			}
		}
	}

	/** the open's pictures are in (waits for them at most PRESENT.loadWaitMs); false: the trigger pulses as before */
	presentsReady(): Promise<boolean> {
		return presentsReadyForOpen();
	}

	/** THE TRIGGER: the presents parked in these cells play the full open (game/road/present.ts). Resolves when they
	 *  are closed again. Call it once presentsReady() said yes. */
	async openPresents(cells: number[]): Promise<boolean> {
		const shows: Promise<void>[] = [];
		for (const car of this.cars) {
			if (car.phase !== 'rest' || car.symbol !== 'S' || !cells.includes(car.col * ROWS + car.lane)) continue;
			shows.push(this.presentOf(car).open(this.clock));
		}
		// ONE pop for the trigger, on the open's first frame (updatePresents)
		this.popWanted = shows.length > 0;
		await Promise.all(shows);
		this.popWanted = false;
		presentTriggerPlayed();
		return shows.length > 0;
	}

	/** how long the presents' show of a trigger runs, board clock ms (Board.svelte holds the board's dim that long) */
	presentShowMs(): number {
		return presentOpenMs();
	}

	/** a cell's parked symbol is covered by a cloud or a column (it is not drawn, and does not come back by itself) */
	private setCellHidden(cell: number, hidden: boolean) {
		const col = Math.floor(cell / ROWS);
		const lane = cell % ROWS;
		for (const car of this.cars) {
			if (car.phase !== 'rest' || car.col !== col || car.lane !== lane) continue;
			car.sprite.visible = !hidden;
			// its riders go (or come back) with it on this very frame, and their shadow
			this.syncRiders(car);
			if (hidden) car.riderShadow.visible = false;
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
		this.reelStopAt = this.reelStopAt.map(() => null);
		this.features.sounds.trafficStop('board put up as it is');
		this.features.sounds.teaseStop('board put up as it is', REINDEER_SOUND.stopFadeMs);
		this.flow = null;
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
		// THE TRAFFIC: on from the press (and from each later spin's pull away) until the last reel stops
		this.reelStopAt = this.reelStopAt.map(() => null);
		this.trafficFading = false;
		this.stopsBegun = false;
		this.features.sounds.teaseStop('the board pulls away', REINDEER_SOUND.stopFadeMs);
		this.flow = null;
		this.pressReal = performance.now();
		this.pressClock = this.clock;
		this.features.sounds.trafficStart('the board pulls away');
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

	/** THE BOOK'S BOARD drives in, lane by lane (constants LANE_FLOW: the lanes 100 ms apart, the lead car of each lane
	 *  first, the scatter tease). Resolves when the last symbol has settled on its mark. `free`: a feature round's spin
	 *  (three scatters decide: the retrigger); `tease`: a tease is allowed (false: a feature that has had its one). */
	driveIn(board: Board, level: 0 | 1 | 2, opts: { free?: boolean; tease?: boolean } = {}): Promise<void> {
		const m = motionFor(level);
		// a board that never drove out (a round's later spins, a resume) pulls away first
		if (this.cars.some((c) => c.phase === 'rest')) this.driveOut(level);
		this.waiting = null;
		const start = Math.max(this.clock, (this.outAt ?? this.clock) + m.in.delayMs);
		this.convoyAt = start;
		this.outAt = null;
		this.flow = null;
		this.cutOneMoment = false;
		let allHome = start;
		let parked = 0;
		const reelStop: (number | null)[] = Array.from({ length: COLS }, () => null);
		const laneSound: (number | null)[] = [null, null, null, null];
		const hiddenAt = (dir: number, halfW: number) => (dir > 0 ? MOUTH_L - halfW - HIDE_PAD : MOUTH_R + halfW + HIDE_PAD);
		// every place of every lane, the lead first (the lead is the column farthest from the entry)
		const placesOf = (lane: number) => {
			const dir = ROAD.laneDirection[lane];
			return Array.from({ length: COLS }, (_, i) => (dir > 0 ? COLS - 1 - i : i));
		};
		// THE PLAN (LANE_FLOW on): the release times, the drives and the tease; a car per place that parks
		let plan: FlowPlan | null = null;
		const planned = new Map<string, FlowPlan['cars'][number]>();
		if (LANE_FLOW.on) {
			const input: FlowCar[] = [];
			for (const lane of m.laneOrder) placesOf(lane).forEach((col, k) => this.parks(board, col, lane) && input.push({ lane, k, scatter: board[col][lane] === 'S' }));
			// no tease in a spin that drives in already hurried (a slam stop earlier in the round)
			const tease = (opts.tease ?? true) && !this.hurrying;
			// THE CAP is from the PRESS to the board at rest (pass 8): the time already gone since the press (the pull away's
			// delay and the wait for the book: `start` is when this drive in begins), the last car's settle after its stop,
			// and the frame the rest is seen on all come out of capMs before the release schedule gets the rest
			const lead = Math.max(m.in.delayMs, start - this.pressClock);
			plan = planFlow(input, flowParams(level, { free: !!opts.free, tease, budgetMs: LANE_FLOW.capMs - lead - m.in.settleMs - LANE_FLOW.capPadMs }));
			for (const c of plan.cars) planned.set(`${c.lane}:${c.k}`, c);
		}
		const laneRel: number[][] = [[], [], [], []];
		m.laneOrder.forEach((lane, laneK) => {
			const dir = ROAD.laneDirection[lane];
			let t0 = start + laneK * m.in.laneStaggerMs;
			for (let n = 0; n < m.through.perLane; n++) {
				this.spawnThrough(lane, t0, m);
				t0 += m.through.gapMs;
			}
			const order = placesOf(lane);
			// THE OLD CONVOY (LANE_FLOW off): the lane's time is set by its FRONT place, cruise speed, then the brake
			const brakeDist = (m.cruise * m.in.brakeMs) / 2000;
			const stopFor = (halfW: number, overshoot: number) => {
				const s0 = Math.abs(columnX(order[0]) + dir * overshoot - hiddenAt(dir, halfW));
				return t0 + m.in.brakeMs + (Math.max(0, s0 - brakeDist) / m.cruise) * 1000;
			};
			let leadStop = stopFor(PITCH * 0.46, m.in.overshootPx);
			let count = 0;
			let laneStop = -Infinity;
			let laneBrake = Infinity;
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
				const from = this.hiddenX(car, true);
				const dist = Math.abs(car.restX + dir * car.overshoot - from);
				const p = planned.get(`${lane}:${i}`);
				if (plan && p) {
					// its own drive: cruise, then the brake over its last b ms (constants LANE_FLOW), arriving at p.arr
					car.rel = start + p.rel;
					car.stopAt = start + p.arr;
					car.b = Math.min(LANE_FLOW.brakeMs, LANE_FLOW.brakeShareMax * p.dur);
					car.v = dist / Math.max(0.001, (p.dur - car.b / 2) / 1000);
					laneRel[lane].push(car.rel);
				} else {
					if (i === 0) leadStop = stopFor(car.halfW, car.overshoot);
					car.stopAt = leadStop + i * m.in.carStaggerMs;
					car.v = m.cruise;
					car.b = m.in.brakeMs;
					car.rel = car.stopAt - m.in.brakeMs - (Math.max(0, dist - brakeDist) / m.cruise) * 1000;
				}
				laneStop = Math.max(laneStop, car.stopAt);
				laneBrake = Math.min(laneBrake, car.stopAt - car.b);
				// this reel's stop: when its last car reaches its stop point
				reelStop[col] = Math.max(reelStop[col] ?? -Infinity, car.stopAt);
				car.sprite.x = from;
				car.sprite.visible = false;
				count += 1;
			});
			if (!plan) {
				laneStop = leadStop + (COLS - 1) * m.in.carStaggerMs;
				laneBrake = leadStop - m.in.brakeMs;
			} else if (count === 0) {
				laneStop = start;
				laneBrake = start;
			}
			this.laneParked[lane] = count;
			parked += count;
			this.laneStopSoundAt[lane] = count > 0 ? (plan ? laneStop : leadStop) : null;
			laneSound[lane] = count > 0 ? laneStop : null;
			// THE SIGNAL: this lane's first symbol starts to brake here (amber); its last symbol reaches its stop point here
			// (red: the start of the brake bounce, not the end of it)
			this.laneBrakeAt[lane] = laneBrake;
			this.laneStopAt[lane] = laneStop;
			this.laneHomeAt[lane] = laneStop + m.in.settleMs;
			allHome = Math.max(allHome, this.laneHomeAt[lane]);
		});
		this.parked = parked;
		if (plan) {
			// ONE STOP SOUND PER LANE (constants REINDEER_SOUND reelStops, pass 7), top lane first: never before the lane
			// above it below turbo 2
			if (level < 2) {
				let prev = -Infinity;
				for (let lane = 0; lane < ROWS; lane++) {
					const at = laneSound[lane];
					if (at === null) continue;
					if (at < prev) laneSound[lane] = prev;
					prev = laneSound[lane] as number;
				}
			}
			this.reelStopAt = laneSound;
			this.flow = { start, plan, level, free: !!opts.free, laneRel, soundOn: false, soundDone: false, stepped: false, seenMarked: 0, landSounded: 0, cut: false, pressReal: this.pressReal };
			this.spinLog.push({ pressReal: this.pressReal, restReal: null, pressClock: this.pressClock, startClock: start, restClock: null, level, scatters: plan.seen.length, factor: plan.factor, teaseFrom: plan.teaseFrom, end: plan.end, cut: false });
			if (this.spinLog.length > 40) this.spinLog.shift();
			this.features.sounds.mark('flowPlan', `${plan.cars.length} cars, ${plan.seen.length} scatter(s), tease ${plan.teaseFrom === null ? 'none' : Math.round(plan.teaseFrom)}, end ${Math.round(plan.end)}, factor ${plan.factor.toFixed(3)}`);
		} else {
			// the stop SOUNDS go left to right at normal speed and turbo 1 (constants REINDEER_SOUND reel stop, pass 5): a
			// reel planned a few ms before the reel to its left sounds with it instead
			if (level < 2) {
				let prev = -Infinity;
				for (let col = 0; col < COLS; col++) {
					const at = reelStop[col];
					if (at === null) continue;
					if (at < prev) reelStop[col] = prev;
					prev = reelStop[col] as number;
				}
			}
			this.reelStopAt = reelStop;
		}
		this.reelStopTurbo2 = level === 2;
		this.trafficFading = false;
		this.stopsBegun = false;
		const waiter: Waiter = { at: allHome + 20, clock: 'board', resolve: () => {} };
		const done = this.destroyed ? Promise.resolve() : new Promise<void>((resolve) => (waiter.resolve = resolve));
		if (!this.destroyed) this.waiters.push(waiter);
		this.driveWaiter = waiter;
		// A SLAM STOP pressed during this spin before its board drove in: straight to the stopped board, no tease
		if (this.hurrying && this.hurryFrom >= this.spinStartAt) this.slamCut();
		return done;
	}

	/** THE SLAM STOP'S CUT (constants LANE_FLOW): every car still driving in or in the tunnel is at its stop point now
	 *  (its rock back follows on the hurried clock), the tease is over, the lanes' stops sound once */
	private slamCut() {
		const now = this.clock;
		let any = false;
		for (const car of this.cars) {
			if (car.phase !== 'in' || car.stopAt <= now) continue;
			car.rel = Math.min(car.rel, now);
			car.stopAt = now;
			any = true;
		}
		if (!any || !LANE_FLOW.on) return;
		let home = now;
		for (let lane = 0; lane < ROWS; lane++) {
			this.laneStopAt[lane] = Math.min(this.laneStopAt[lane], now);
			this.laneBrakeAt[lane] = Math.min(this.laneBrakeAt[lane], now);
			const m = this.cars.find((c) => c.lane === lane && c.m)?.m ?? motionFor(0);
			this.laneHomeAt[lane] = Math.min(this.laneHomeAt[lane], now + m.in.settleMs);
			home = Math.max(home, this.laneHomeAt[lane]);
			if (this.reelStopAt[lane] !== null && this.reelStopAt[lane]! > now) this.reelStopAt[lane] = now;
		}
		this.cutOneMoment = true;
		if (this.driveWaiter) this.driveWaiter.at = Math.min(this.driveWaiter.at, home + 20);
		if (this.flow) {
			this.flow.cut = true;
			const last = this.spinLog[this.spinLog.length - 1];
			if (last) last.cut = true;
		}
		this.features.sounds.mark('slamCut', 'the drive in cut to the stopped board');
		this.features.sounds.teaseStop('slam stop', REINDEER_SOUND.stopFadeMs);
		// the scatters not yet seen are on the board now: their landings sound ONCE together, the rung of the whole count
		const f = this.flow;
		if (f && f.landSounded < f.plan.seen.length) {
			const n = f.plan.seen.length;
			const unplayed = n - f.landSounded;
			f.landSounded = n;
			this.features.sounds.scatterLand(n, `slam stop, ${unplayed} not yet played, once together`);
		}
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
	/** show a win: THE CHRISTMAS LIGHTS (constants LINE_WIN lights), each winning line a wire of lights drawn in one after
	 *  another with its own amount as it completes, then the total as before; or (lights off, a trigger's pulse, a
	 *  message) every line at once with the total. `pace` is the turbo level's share of every time (LINE_WIN.holdShare);
	 *  `capped` (a max win spin): no line's own amount (the lines pay more than is awarded), only the total. Resolves
	 *  when the hold after the total is over. */
	/** THE AMOUNTS' FLOOR (road px; components/Board.svelte sets it from the LED strip's place): a line amount never reaches
	 *  below it (the strip's snow cap, or the HUD's top where it is higher). Infinity: none. */
	labelFloor = Infinity;

	showWin(wins: LineWinSpec[], amountText: string, holdMs: number, multiplier = 1, opts: ShowWinOpts = {}): Promise<void> {
		const pace = opts.pace ?? 1;
		const cells = new Set<number>();
		for (const w of wins) for (const c of w.cells) cells.add(c);
		for (const car of this.cars) {
			if (car.phase !== 'rest') continue;
			car.winning = cells.has(car.col * ROWS + car.lane);
		}
		const g = this.winLines;
		g.clear();
		const drawn = wins.filter((w) => w.cells.length >= 2);
		this.lightsOn = LINE_WIN.lights.on && drawn.length > 0;
		this.lineStarts = [];
		this.lineCells = [];
		this.linesVoiced = 0;
		let totalAt = 0;
		/** TREATMENT B (constants LINE_WIN slam): the lines' own amounts slam their multipliers in, no total over the board */
		let slamLength: number | null = null;
		if (this.lightsOn) {
			if (!this.winFx) {
				this.winFx = new WinLights(this.tex('winLights'), PHONE_TIER ? 'phone' : 'full', this.tex);
				this.winLayer.addChildAt(this.winFx.root, 0);
			}
			const lines: LightLine[] = drawn.map((w) => {
				const sorted = [...w.cells].sort((a, b) => a - b);
				const points = sorted.map((c) => ({ x: columnX(Math.floor(c / ROWS)), y: laneMidY(c % ROWS) }));
				// its amount's places, best first: the top edge of each of its symbols from the middle one outward, then the
				// lane line under each
				const order = sorted.map((_, i) => i).sort((a, b) => Math.abs(a - (sorted.length - 1) / 2) - Math.abs(b - (sorted.length - 1) / 2) || a - b);
				const x = (c: number) => Math.min(MOUTH_R - 90, Math.max(MOUTH_L + 90, columnX(Math.floor(c / ROWS))));
				const slots = [...order.map((i) => ({ x: x(sorted[i]), y: LINES[sorted[i] % ROWS] - 4 })), ...order.map((i) => ({ x: x(sorted[i]), y: LINES[(sorted[i] % ROWS) + 1] - 4 }))];
				return { points, symbol: w.symbol ?? 'L5', amountText: w.amountText ?? '', slots, plainText: w.plainText, multiplier: w.multiplier ?? 1 };
			});
			// TREATMENT B: every line its own amount (a one line win's too; never a capped spin's: its lines pay more than is
			// awarded), the label sized for the phone's rule there (its digit cap phone.capPx CSS px)
			const SL = LINE_WIN.slam;
			let slam: SlamOpts | null = null;
			if (SL.on && !opts.capped) {
				const k = Math.abs(this.root.scale.x) || 1;
				const phone = !!opts.phone && SL.phone.on;
				const scale = phone ? Math.max(1, SL.phone.capPx / (SL.capRatio * LINE_WIN.lights.amount.size * k)) : 1;
				slam = { scale, phone, left: MOUTH_L, right: MOUTH_R, topLine: LINES[0], floor: this.labelFloor };
			}
			this.winFx.set(lines, pace, slam ? true : drawn.length > 1 && !opts.capped, slam);
			const plan = this.winFx.slamPlan();
			this.lineStarts = plan ? plan.starts : lightsSchedule(lines.length, pace).starts;
			// the total follows when the last light is down (a one line win: as its line is strung, its amount the total);
			// treatment B: the strip's total as the last line starts to come down, the win over after the hold (a big win: when
			// the last line is down, the strip's count follows)
			totalAt = plan ? plan.totalAt : this.winFx.linesDoneMs();
			if (plan) slamLength = opts.big ? (lines.length === 1 ? plan.totalAt + SL.phone.readMs * pace : plan.linesEnd) : plan.endAt;
			this.lineCells = drawn.map((w) => new Set(w.cells));
		} else {
			this.winFx?.hide();
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
		}
		// the probe's moment: the winning lines show (the first starts on the next frame drawn; their symbol's sound is the
		// handler's, the same tick); THE LINE SHOW sounds once per line as it lights (constants REINDEER_SOUND lines): the
		// first now, the others as each starts (updateWin). All at once (lights off): once.
		if (drawn.length) {
			this.features.sounds.mark('lines', `${drawn.length} line(s)`);
			this.voiceLine(0);
		}
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
		// (treatment B: no total over the board for line wins; the strip carries it)
		const totalOnBoard = slamLength === null;
		this.winAmount.visible = totalOnBoard && totalAt <= 0;
		this.winAmount.scale.set(LINE_WIN.popFrom);
		// kept inside the picture: a long amount on an outer column is pulled toward the middle
		const half = this.winAmount.width / 2 + 20;
		const x = first ? columnX(Math.floor(mid / ROWS)) : ROAD_ART.image.width / 2;
		this.winAmount.position.set(Math.min(MOUTH_R - half, Math.max(MOUTH_L + half, x)), first ? laneMidY(mid % ROWS) : ROAD_ART.image.height / 2);
		// a win through multiplier Wilds says so: "x35" over the amount (the highest multiplier among the winning lines)
		if (!this.winMult) {
			this.winMult = new NumberLabel(this.tex, LINE_WIN.multHeight, LINE_WIN.multTint);
			this.winLayer.addChild(this.winMult.root);
		}
		// (treatment B: never a multiplier over a total, the capped spin's included: it read as "35x $399.50")
		const multOver = multiplier > 1 && !LINE_WIN.slam.on;
		this.winMult.root.visible = multOver && totalAt <= 0;
		if (multOver) {
			this.winMult.set(`x${multiplier}`, LINE_WIN.multHeight, LINE_WIN.multTint);
			this.winMult.root.position.set(this.winAmount.x, this.winAmount.y - LINE_WIN.multUp);
		}
		this.winMultWanted = multOver;
		// the columns a winning line runs through play their win clip
		const reels = new Set<number>();
		for (const w of wins) for (const c of w.cells) reels.add(Math.floor(c / ROWS));
		this.features.winColumns([...reels]);
		this.winLayer.alpha = 1;
		this.winLayer.visible = true;
		// a line win dims the symbols that are not part of it; a plain message over the board (no cells) dims nothing
		const length = slamLength ?? totalAt + holdMs;
		this.win = { t0: this.winClock, holdMs: length, fadeAt: this.winClock + length, active: true, dim: wins.length > 0, totalAt, onTotal: opts.onTotal ?? null, totalOnBoard };
		if (totalAt <= 0) this.fireTotal();
		if (this.lightsOn) this.winFx!.update(0);
		return this.wait(this.winClock + length, 'win');
	}

	/** the strip's total is due (treatment B): the caller's moment, once */
	private fireTotal() {
		const w = this.win;
		if (!w || !w.onTotal) return;
		const f = w.onTotal;
		w.onTotal = null;
		this.features.sounds.mark('stripTotal', `${Math.round(this.winClock - w.t0)} ms into the win`);
		f();
	}

	/** THE LINE SHOWS (constants REINDEER_SOUND lines): each light line after the first sounds on the frame it starts to
	 *  light, after the features' update (so the sounds' log has this frame's number) */
	private updateLineShows() {
		const win = this.win;
		if (!win || !win.active || !this.lightsOn) return;
		const t = this.winClock - win.t0;
		while (this.linesVoiced < this.lineStarts.length && t >= this.lineStarts[this.linesVoiced]) this.voiceLine(this.linesVoiced);
	}

	/** a light line's line show: line `k` (0-based) has started to light */
	private voiceLine(k: number) {
		this.linesVoiced = k + 1;
		const n = Math.max(1, this.lineStarts.length);
		// over the accelerating lines (constants LINE_WIN lights sound): each a little faster than the last, and one voice
		const S = LINE_WIN.lights.sound;
		const rate = Math.min(S.rateMax, 1 + S.rateStep * k);
		const now = performance.now();
		if (S.oneVoice && k > 0 && now < this.lineShowUntil) this.features.sounds.stopNamed(REINDEER_SOUND.lineShow, `line ${k + 1} of ${n} starts`);
		this.lineShowUntil = now + S.lengthMs / rate;
		this.features.sounds.mark('lineShow', `line ${k + 1} of ${n}`);
		this.features.sounds.playNamed(REINDEER_SOUND.lineShow, `line ${k + 1} of ${n}`, rate);
	}

	/** DEV / probes: draw the win's lights or not (the win and its clock go on as they are) */
	devWinLightsShown(on: boolean) {
		if (this.winFx && this.lightsOn) this.winFx.root.visible = on;
	}

	/** DEV / probes: the lights as drawn (each line's draw fraction, bulbs lit, amount), and the total */
	winLightsSnapshot() {
		const win = this.win;
		return {
			ms: win ? Math.round((this.winClock - win.t0) * 10) / 10 : null,
			active: !!win?.active,
			visible: this.winLayer.visible && this.winLayer.alpha > 0,
			alpha: Math.round(this.winLayer.alpha * 100) / 100,
			totalAt: win ? Math.round(win.totalAt * 10) / 10 : null,
			total: this.winAmount ? { text: this.winAmount.text, shown: this.winAmount.visible && this.winLayer.visible, scale: Math.round(this.winAmount.scale.x * 1000) / 1000 } : null,
			mult: this.winMult ? this.winMult.root.visible && this.winLayer.visible : false,
			/** TREATMENT B (constants LINE_WIN slam): its plan (ms into the win) and whether the strip's total was asked for */
			slam: (() => {
				const P = this.winFx?.slamPlan();
				const r = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
				return P && win ? { totalAt: r(P.totalAt), endAt: r(P.endAt), linesEnd: r(P.linesEnd), length: r(win.holdMs), f: P.f.map(r), lits: P.lits.map(r), phone: P.phone, stripTotalDue: !win.onTotal } : null;
			})(),
			lines: this.winFx?.snapshot() ?? [],
			sprites: this.winFx?.spriteCount() ?? 0,
			lightsOn: this.lightsOn,
			linesVoiced: this.linesVoiced,
			/** the cells whose symbol is swollen by the win pulse now */
			pulsing: this.cars.filter((c) => c.phase === 'rest' && c.baseScale > 0 && Math.abs(c.sprite.scale.y) > c.baseScale * 1.0005).map((c) => c.col * ROWS + c.lane),
			lineCells: this.lineCells.map((c) => [...c]),
		};
	}

	/** THE POLICE LIGHTS (constants POLICE_LIGHTS): every police car in the win showing now flashes, on the win's clock
	 *  (so all of them in phase), at its win pulse; every other one is dark, and all of them are dark the frame the win's
	 *  hold ends or it is cleared */
	private updatePolice() {
		const win = this.win;
		const live = !!win && win.active && win.dim;
		for (const car of this.cars) {
			const police = car.symbol === 'H4' && car.phase === 'rest' && car.winning && car.sprite.visible;
			if (!live || !police) {
				car.lights?.off();
				continue;
			}
			if (!car.lights) {
				const glow = this.tex('stoplight_glow');
				if (!glow) continue;
				car.lights = new PoliceLightBar(this.policeLayer, glow);
			}
			const frame = frameFor('H4', car.dir);
			const art = (ROAD_ART.symbols as Record<string, { width: number; height: number }>)[frame];
			const t = car.sprite.texture;
			// road px per built road px: the symbol's own scale with its win pulse
			const k = art && t.height > 0 ? (Math.abs(car.sprite.scale.y) * t.height) / art.height : 1;
			car.lights.draw(frame, car.sprite.x, car.sprite.y, k, this.winClock - win!.t0);
		}
	}

	/** THE VAN'S WIN (constants VAN_WIN): every van in the win showing now lurches, backfires, then rocks with its
	 *  flashlight, on the win's clock; every other one is still, and all of them are still and dark (back on their mark,
	 *  upright) the frame the win's hold ends or it is cleared. Before paint, so the shadows see it (they keep to the
	 *  mark: placeShadows). */
	private updateVans() {
		const win = this.win;
		const live = !!win && win.active && win.dim;
		for (const car of this.cars) {
			const van = car.symbol === 'H3' && car.phase === 'rest' && car.winning && car.sprite.visible;
			if (!live || !van) {
				if (car.van && car.phase === 'rest') car.van.off(car.sprite, car.restX, laneSitY(car.lane));
				else car.van?.off(null, 0, 0);
				continue;
			}
			if (!car.van) {
				const glow = this.tex('stoplight_glow');
				if (!glow) continue;
				car.van = new VanWinFx(this.policeLayer, glow, this.tex('vanPuff') ?? null);
			}
			const frame = frameFor('H3', car.dir);
			const art = (ROAD_ART.symbols as Record<string, { width: number; height: number }>)[frame];
			const t = car.sprite.texture;
			const k = art && t.height > 0 ? (Math.abs(car.sprite.scale.y) * t.height) / art.height : 1;
			car.van.draw(car.sprite, frame, car.restX, laneSitY(car.lane), k, this.winClock - win!.t0);
		}
	}

	/** DEV / probes: every van's win as drawn (cell, winning, its phase, the body's squat and lean, the brightest glow's x
	 *  and alpha, the puffs' alpha) */
	vanSnapshot() {
		return this.cars
			.filter((c) => c.symbol === 'H3' && c.phase !== 'free')
			.map((c) => ({ cell: c.phase === 'rest' ? c.col * ROWS + c.lane : null, dir: c.dir, winning: c.winning, ...(c.van?.last ?? { phase: 'off', squat: 0, lean: 0, bounce: 1, glowX: 0, glowAlpha: 0, puffAlpha: 0, glows: 0, puffs: 0, fit: true }), rotation: c.sprite.rotation, skew: c.sprite.skew.x, x: Math.round(c.sprite.x * 100) / 100, y: Math.round(c.sprite.y * 100) / 100, restX: c.restX, sitY: laneSitY(c.lane), winMs: this.win ? Math.round((this.winClock - this.win.t0) * 10) / 10 : null, winActive: !!this.win?.active }));
	}

	/** DEV / probes: every police car's light bar as drawn (cell, winning, the lit lens, its level) */
	policeSnapshot() {
		return this.cars
			.filter((c) => c.symbol === 'H4' && c.phase !== 'free')
			.map((c) => ({ cell: c.phase === 'rest' ? c.col * ROWS + c.lane : null, dir: c.dir, winning: c.winning, lit: c.lights?.lit ?? null, level: Math.round((c.lights?.level ?? 0) * 1000) / 1000, winMs: this.win ? Math.round((this.winClock - this.win.t0) * 10) / 10 : null, winActive: !!this.win?.active }));
	}

	/** pulse some cells with no line and no amount (the scatters of a trigger); resolves after `ms`. `presentPop`: this
	 *  pulse is a trigger's whole show (the open's pictures were not in time), so the presents' pop comes on its first
	 *  frame, as it would on the open's */
	pulseCells(cells: number[], ms: number, presentPop = false): Promise<void> {
		const shown = this.showWin(cells.map((cell) => ({ cells: [cell], line: 1 })), '', ms);
		this.pulsePopWanted = presentPop && cells.length > 0;
		return shown.finally(() => {
			this.pulsePopWanted = false;
		});
	}

	/** a short line over the middle of the board (a retrigger's "+3 FREE SPINS"); resolves after `ms` */
	message(text: string, ms: number): Promise<void> {
		return this.showWin([], text, ms);
	}

	/** take the win picture down (the lines and the amount fade, the symbols come back to full brightness) */
	clearWin() {
		for (const car of this.cars) car.winning = false;
		if (this.win) this.win.active = false;
		for (const car of this.cars) {
			car.lights?.off();
			if (car.phase === 'rest') car.van?.off(car.sprite, car.restX, laneSitY(car.lane));
		}
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
			this.lights.push({ root, side, lanes: side > 0 ? [0, 1] : [2, 3], lens, showing: null, teasing: false, redOnReal: 0 });
		}
	}

	/** what a light shows now: Corey's ruling (constants STOPLIGHT), read off the road's own clock */
	private signalFor(light: Stoplight): SignalColor | null {
		if (this.signalForced !== undefined) return this.signalForced;
		if (!STOPLIGHT.lit) return null;
		if (!this.spinActive) return 'red';
		// a slam stop: red at once
		if (STOPLIGHT.slamRed && this.hurrying) return 'red';
		// THE TEASE (constants STOPLIGHT.tease): while this light's lanes still have cars in the tunnel
		const tease = this.teaseSignal(light);
		if (tease !== undefined) return tease;
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

	/** the tease's color for a light now (undefined: not teasing; null: a flash's dark beat). Sets light.teasing. */
	private teaseSignal(light: Stoplight): SignalColor | null | undefined {
		light.teasing = false;
		const f = this.flow;
		if (!f || f.cut || f.plan.teaseFrom === null) return undefined;
		const t = this.clock - f.start;
		const lv = flowLevel(f.plan.seen, t, f.plan.decideAt);
		if (lv !== 1 && lv !== 2) return undefined;
		const rels = [...f.laneRel[light.lanes[0]], ...f.laneRel[light.lanes[1]]];
		if (!rels.some((r) => r > this.clock)) return undefined;
		light.teasing = true;
		const T = STOPLIGHT.tease;
		if (rels.some((r) => r <= this.clock && this.clock - r < T.greenMs)) return 'green';
		if (lv === 1) return Math.floor(t / Math.max(1, T.flashMs)) % 2 === 0 ? 'amber' : null;
		return Math.floor(t / Math.max(1, T.alternateMs)) % 2 === 0 ? 'red' : 'amber';
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
		const changed: string[] = [];
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
			const wasTeasing = light.teasing;
			light.teasing = false;
			const want = this.signalFor(light);
			if (want === 'red' && light.showing !== 'red') light.redOnReal = performance.now(); // DEV readout
			// a light changing color (not its first color, not a dark light): its sound, once for the frame below. The
			// tease's flashing is silent (it has its own sound); with releaseSound a release's green sounds.
			const teaseChange = light.teasing || wasTeasing;
			const voiced = !teaseChange || (STOPLIGHT.tease.releaseSound && light.teasing && want === 'green');
			if (light.showing !== null && want !== null && want !== light.showing && voiced) changed.push(`${top ? 'top' : 'bottom'} ${light.showing}>${want}`);
			light.showing = want;
			const size = STOPLIGHT.glow.size;
			for (const color of SIGNAL_COLORS) {
				const l = light.lens[color];
				const target = want === color ? 1 : 0;
				// RED IS INSTANT (Corey: "turn Red as soon as the symbols stop"): on, and the others off, in this frame.
				// Green and amber fade over fadeMs.
				if (want === 'red' || light.teasing) l.alpha = target;
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
		if (changed.length) this.features.sounds.stoplight(changed.join(', '));
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
		// A SLAM STOP during a live drive in cuts straight to the stopped board (constants LANE_FLOW)
		if (hurry > 1 && !this.hurrying) {
			this.hurrying = true;
			this.hurryFrom = this.clock;
			this.slamCut();
		}
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
				if (now < car.rel) {
					// still in the tunnel (LANE_FLOW: the tunnel holds it until its release)
					s.x = this.hiddenX(car, true);
					s.rotation = 0;
					s.visible = false;
				} else if (left > 0) {
					const brake = car.b;
					// distance still to go to the stop point: a constant deceleration over the brake time, its own cruise
					// speed before it (constants LANE_FLOW: each car's drive takes its planned time)
					const dist = left <= brake ? (car.v * left * left) / (2000 * brake) : (car.v * brake) / 2000 + (car.v * (left - brake)) / 1000;
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
						// a present has landed: its peek starts from its stop point
						if (car.symbol === 'S') this.peekPresent(car, car.stopAt);
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
		this.features.rate = rate;
		this.features.update(now);
		this.updateTease(now);
		this.updateLights(dt);
		this.updateReelStops(now, rate);
		this.updateLineShows();
		this.updateVans();
		this.stepRiders(now, dt * rate);
		this.updateSeatClips();
		this.paint();
		this.updateBrakes(dt);
		this.updatePolice();
		this.updatePresents(now);
		this.noteRest();

		if (this.waiters.length) {
			const due = this.waiters.filter((x) => (x.clock === 'board' ? this.clock : this.winClock) >= x.at);
			if (due.length) {
				this.waiters = this.waiters.filter((x) => !due.includes(x));
				for (const x of due) x.resolve();
			}
		}
	}

	/** THE TEASE'S SOUND AND MOMENTS (constants REINDEER_SOUND tease, LANE_FLOW): each scatter as it is seen (a moment
	 *  for the probes), the loop from the tease's start, its step at three seen, its end */
	private updateTease(now: number) {
		const f = this.flow;
		if (!f) return;
		const t = now - f.start;
		const S = this.features.sounds;
		while (f.seenMarked < f.plan.seen.length && t >= f.plan.seen[f.seenMarked]) {
			f.seenMarked += 1;
			S.mark('scatterSeen', `${f.seenMarked} of ${f.plan.seen.length}`);
			// THE HOUSE SCATTER LANDING (REINDEER_SOUND.scatterLand): its rung on the frame it is seen (after a cut the later
			// planned moments stay silent: the cut sounded them)
			if (!f.cut && f.landSounded < f.seenMarked) {
				f.landSounded = f.seenMarked;
				S.scatterLand(f.seenMarked, `seen, ${f.seenMarked} of ${f.plan.seen.length}`);
			}
		}
		if (f.cut) return;
		const P = f.plan;
		if (P.teaseFrom === null || P.teaseEnd === null) return;
		if (!f.soundOn && !f.soundDone && t >= P.teaseFrom && t < P.teaseEnd) {
			f.soundOn = true;
			S.mark('teaseStart', `two seen, ${P.cars.filter((c) => c.rel > t).length} car(s) to come`);
			S.teaseStart();
		}
		if (f.soundOn && !f.stepped && P.threeFrom !== null && t >= P.threeFrom && t < P.teaseEnd) {
			f.stepped = true;
			S.mark('teaseThree', 'three seen');
			S.teaseStep(REINDEER_SOUND.tease.rateAtThree);
		}
		if (f.soundOn && t >= P.teaseEnd) {
			f.soundOn = false;
			f.soundDone = true;
			const decided = P.seen.length >= P.decideAt && P.seen[P.decideAt - 1] <= P.teaseEnd + 0.01;
			S.mark('teaseEnd', decided ? 'the deciding scatter seen' : 'the last car seen');
			S.teaseStop(decided ? 'decided' : 'the last car seen', REINDEER_SOUND.tease.fadeMs);
		}
		// SKIP TO RESULT: the tease's loop never plays on under it
		if (f.soundOn && S.env.skipping?.()) {
			f.soundOn = false;
			f.soundDone = true;
			S.teaseStop('skip to result', REINDEER_SOUND.stopFadeMs);
		}
	}

	/** THE BRAKE LIGHTS (constants BRAKE_LIGHTS): every car's, from what it is doing now */
	private updateBrakes(dtMs: number) {
		const glow = this.tex('stoplight_glow');
		if (!glow) return;
		const now = this.clock;
		for (const car of this.cars) {
			const isCar = car.symbol !== null && CARS.includes(car.symbol);
			if (!isCar || car.phase === 'free') {
				if (car.brake?.shown || car.brake?.level) car.brake.off();
				continue;
			}
			let state: BrakeState = 'off';
			if (car.phase === 'rest') state = 'stopped';
			else if (car.phase === 'in') state = now >= car.stopAt ? 'stopped' : now >= car.stopAt - car.b && now >= car.rel ? 'brake' : 'off';
			const pair = (car.brake ??= new BrakeLightPair(this.brakeLayer, glow, this.brakeBackLayer));
			pair.draw(car.sprite, frameFor(car.symbol!, car.dir), this.builtK(car), (car.tintNow & 0xff) / 255, state, dtMs);
		}
	}

	/** DEV: the spin's length, the frame the board is at rest after a drive in */
	private noteRest() {
		const last = this.spinLog[this.spinLog.length - 1];
		if (last && last.restReal === null && this.flow && this.atRest) {
			last.restReal = performance.now();
			last.restClock = this.clock;
		}
	}

	/** DEV / probes: the clock and the stoplights only (read every frame by the lane stagger probe) */
	flowLite() {
		return { clock: Math.round(this.clock * 10) / 10, lights: this.lights.map((l) => ({ lanes: l.lanes, showing: l.showing, teasing: l.teasing })) };
	}

	/** DEV / probes: the last drive in's plan as the road plays it (board clock ms from its start), and the spins' lengths */
	/** THE SCATTER COUNT for the LED strip (constants LED_BOARD.scatterCount), read each frame: only what the player has SEEN
	 *  (a present counts LANE_FLOW seenMs after its car leaves the tunnel, the tease's own moment), never the board to come.
	 *  The spin is in anticipation while config.anticipationAt presents are seen, cars are still to come, the deciding count
	 *  (the highest of config.scatterTriggers) is not reached and the next trigger is still possible: the presents seen plus
	 *  the columns still to show a car and showing no present yet (a present lands at most once per column). A slam stop
	 *  ends it (every present is on the board). null: no drive in of the lane by lane traffic yet. */
	scatterCount(): { id: number; count: number; need: number; live: boolean; hit: boolean; reached: number } | null {
		const f = this.flow;
		if (!f) return null;
		const P = f.plan;
		const kind = f.free ? 'freegame' : 'basegame';
		const T = config.scatterTriggers[kind];
		const antic = config.anticipationAt[kind];
		const t = this.clock - f.start;
		const seenAt = (c: { rel: number }) => c.rel + LANE_FLOW.seenMs;
		const colOf = (c: { lane: number; k: number }) => (ROAD.laneDirection[c.lane] > 0 ? COLS - 1 - c.k : c.k);
		let count = 0;
		let left = 0;
		const withPresent = new Set<number>();
		const toCome = new Set<number>();
		for (const c of P.cars) {
			const seen = f.cut || seenAt(c) <= t;
			if (seen && c.scatter) {
				count += 1;
				withPresent.add(colOf(c));
			} else if (!seen) {
				left += 1;
				toCome.add(colOf(c));
			}
		}
		for (const col of withPresent) toCome.delete(col);
		const top = T[T.length - 1];
		const need = T.find((n) => n > count) ?? top;
		const reached = [...T].reverse().find((n) => n <= count) ?? 0;
		const live = !f.cut && count >= antic && left > 0 && count < top && count + toCome.size >= need;
		return { id: f.start, count, need, live, hit: reached > 0, reached };
	}

	flowSnapshot() {
		const f = this.flow;
		const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
		return {
			on: LANE_FLOW.on,
			clock: r1(this.clock),
			plan: f
				? {
						start: r1(f.start),
						clockNow: r1(this.clock),
						level: f.level,
						free: f.free,
						cut: f.cut,
						decideAt: f.plan.decideAt,
						factor: Math.round(f.plan.factor * 10000) / 10000,
						seen: f.plan.seen.map(r1),
						teaseFrom: r1(f.plan.teaseFrom),
						threeFrom: r1(f.plan.threeFrom),
						teaseEnd: r1(f.plan.teaseEnd),
						end: r1(f.plan.end),
						firstRelease: r1(f.plan.firstRelease),
						lastRelease: r1(f.plan.lastRelease),
						held: f.plan.held,
						cars: f.plan.cars.map((c) => ({ lane: c.lane, k: c.k, scatter: c.scatter, nr: r1(c.nr), rel: r1(c.rel), dur: r1(c.dur), arr: r1(c.arr), level: c.level })),
						sound: { on: f.soundOn, done: f.soundDone, stepped: f.stepped },
					}
				: null,
			// the spin's length: from the press to the board at rest, on the board clock (ms at normal speed) and in real ms
			spins: this.spinLog.map((x) => ({ ...x, boardMs: x.restClock === null ? null : Math.round(x.restClock - x.pressClock), realMs: x.restReal === null ? null : Math.round(x.restReal - x.pressReal) })),
			lights: this.lights.map((l) => ({ lanes: l.lanes, showing: l.showing, teasing: l.teasing })),
		};
	}

	/** DEV / probes: every symbol on the road: its phase, x, its brake state, level and lamps drawn */
	brakeSnapshot() {
		// (every symbol on the road: the signs and the sleigh carry no lights, state 'off')
		return this.cars
			.filter((c) => c.phase !== 'free' && c.symbol !== null)
			.map((c) => ({ symbol: c.symbol, frame: frameFor(c.symbol!, c.dir), lane: c.lane, col: c.col, phase: c.phase, x: Math.round(c.sprite.x * 100) / 100, visible: c.sprite.visible, rotation: c.sprite.rotation, state: c.brake?.state ?? 'off', level: Math.round((c.brake?.level ?? 0) * 1000) / 1000, shown: !!c.brake?.shown, at: c.brake?.at ?? [], rel: c.rel, stopAt: c.stopAt, b: c.b, v: Math.round(c.v) }));
	}

	/** THE REEL STOPS (constants REINDEER_SOUND reel stop): each reel's own on the frame its last car reaches its stop
	 *  point, after the features' update (so the sounds' log has this frame's number). The traffic fades from the first
	 *  one over the time left to the last (real ms at this frame's rate) and is done at the last. */
	private updateReelStops(now: number, rate: number) {
		let fired = false;
		let left = 0;
		let last = -Infinity;
		for (let col = 0; col < this.reelStopAt.length; col++) {
			const at = this.reelStopAt[col];
			if (at == null) continue;
			if (now >= at) {
				this.reelStopAt[col] = null;
				fired = true;
				this.features.sounds.mark('reelStop', this.flow ? `lane ${col + 1}` : `reel ${col + 1}`);
				this.features.sounds.reelStop(col, this.reelStopTurbo2, this.cutOneMoment);
			} else {
				left += 1;
				last = Math.max(last, at);
			}
		}
		// THE TRAFFIC'S FADE (LANE_FLOW): never before the last car has left the tunnel (a tease keeps the traffic rolling)
		const lastRelease = this.flow && !this.flow.cut ? this.flow.start + this.flow.plan.lastRelease : -Infinity;
		if (left === 0) {
			if (fired) this.features.sounds.trafficDone('the last lane stopped');
		} else if ((fired || this.stopsBegun) && !this.trafficFading && now >= lastRelease) {
			this.trafficFading = true;
			this.features.sounds.trafficStop(this.flow ? 'the first lane stopped and every car is out' : 'the first reel stopped', (last - now) / Math.max(0.001, rate));
		}
		if (fired) this.stopsBegun = true;
	}

	private updateWin() {
		const win = this.win;
		if (!win) return;
		const t = this.winClock - win.t0;
		if (win.active) {
			// the light lines, and each one's line show as it starts; the line amounts fade as the total comes
			if (this.lightsOn && this.winFx) {
				this.winFx.update(t);
			}
			// the total pops in at totalAt (at once when there are no light lines); treatment B: the strip's total is due
			const since = t - win.totalAt;
			if (since >= 0) this.fireTotal();
			const amount = this.winAmount;
			if (amount) {
				amount.visible = since >= 0 && win.totalOnBoard;
				const u = Math.min(1, Math.max(0, since) / LINE_WIN.popMs);
				const e = 1 - (1 - u) * (1 - u);
				amount.scale.set(LINE_WIN.popFrom + (1 - LINE_WIN.popFrom) * e);
			}
			if (this.winMult) this.winMult.root.visible = this.winMultWanted && since >= 0;
			const u = Math.min(1, t / Math.max(1, win.holdMs));
			const swell = Math.sin(Math.PI * LINE_WIN.pulses * u);
			const k = 1 + (LINE_WIN.pulseScale - 1) * swell * swell;
			for (const car of this.cars) {
				if (car.phase !== 'rest') continue;
				// a present playing its trigger show does not swell (its open is the show)
				// with the lights, only while a line through it is up (and under the total only if pulseWithTotal)
				let pulse = car.winning && !car.present?.opening;
				if (pulse && this.lightsOn && this.winFx && this.lineCells.length) {
					const cell = car.col * ROWS + car.lane;
					pulse = this.lineCells.some((c, i) => c.has(cell) && this.winFx!.lineUp(i, t)) || (LINE_WIN.lights.pulseWithTotal && t >= win.totalAt);
				}
				car.sprite.scale.set(car.baseScale * (pulse ? k : 1));
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
				this.winFx?.hide();
				this.lightsOn = false;
				this.win = null;
			}
		}
	}

	/** the tunnel shadow and the win dim, as each sprite's tint (written only when it changes) */
	private paint() {
		const sh = ROAD.tunnelShade;
		// the target crosshair's fade: every symbol that is not a valid target, while it is up (1 = none)
		const others = this.features.otherSymbolsBrightness();
		for (const car of this.cars) {
			if (car.phase === 'free' || !car.sprite.visible) continue;
			const inside = Math.min(car.sprite.x - MOUTH_L, MOUTH_R - car.sprite.x);
			const u = Math.max(0, Math.min(1, (inside - sh.from) / Math.max(1, sh.to - sh.from)));
			const focus = others < 1 && !(car.symbol && TARGETS.includes(car.symbol)) ? others : 1;
			const b = (sh.dark + (1 - sh.dark) * u * u * (3 - 2 * u)) * car.bright * focus;
			const v = Math.max(0, Math.min(255, Math.round(b * 255)));
			const tint = (v << 16) | (v << 8) | v;
			if (tint !== car.tintNow) {
				car.tintNow = tint;
				car.sprite.tint = tint;
			}
		}
		for (const car of this.cars) this.syncRiders(car);
		this.placeShadows();
	}

	/** THE CAST SHADOWS (constants SHADOW, game/road/shadows.ts): each symbol's twin on the ground, pinned at its ground
	 *  point (the sprite's anchor), on its x and at its win pulse's scale, never tilted by the drive's dive (the ground
	 *  does not tilt); gone with it (free, hidden in a tunnel, under a cloud or a column). A present playing its peek or
	 *  open throws its still picture's shadow (the box stays on the ground). Near a tunnel mouth it fades with the
	 *  tunnel's own shade (ROAD.tunnelShade): there is no sun in a tunnel. */
	private placeShadows() {
		const k = shadowStrength();
		const sh = ROAD.tunnelShade;
		for (const car of this.cars) {
			const s = car.shadow;
			const o = car.sprite;
			if (car.phase === 'free' || !o.visible || k <= 0) {
				if (s.visible) s.visible = false;
				continue;
			}
			const inside = Math.min(o.x - MOUTH_L, MOUTH_R - o.x);
			const u = Math.max(0, Math.min(1, (inside - sh.from) / Math.max(1, sh.to - sh.from)));
			// a parked symbol's twin keeps to its mark (the van's win moves the van on its springs, not its shadow)
			const gx = car.phase === 'rest' ? car.restX : o.x;
			const gy = car.phase === 'rest' ? laneSitY(car.lane) : o.y;
			castShadow(s, o.texture, o.anchor.x, o.anchor.y, gx, gy, o.scale.x, o.scale.y, k * u * u * (3 - 2 * u));
			// the rider's silhouette above the vehicle (its picture less the vehicle's, cut by the build): the same cast, so
			// the two twins make one shape and are never doubled where they meet
			const rs = car.riderShadow;
			const rider = car.symbol === 'H2' ? car.tree : car.symbol && SEATS.includes(car.symbol) ? car.seated : null;
			const on = car.symbol === 'H2' ? WAGON_TREE.shadow : SEATED.shadow;
			const art = rider && rider.root.visible && on ? rider.shadowArt() : null;
			const t = art?.texture;
			if (!art || !t || t.width <= 1 || art.box.w <= 0 || art.box.h <= 0) {
				if (rs.visible) rs.visible = false;
				continue;
			}
			const kk = this.builtK(car);
			castShadow(rs, t, -art.box.x / art.box.w, -art.box.y / art.box.h, gx, gy, (kk * art.box.w) / t.width, (kk * art.box.h) / t.height, k * u * u * (3 - 2 * u));
		}
	}

	// ---- the riders (the wagon's tree, the seated drivers) -------------------------------------------------------------
	/** road px per built road px of a vehicle's sprite now (its symbol scale with its win pulse) */
	private builtK(car: Car): number {
		const s = car.sprite;
		const art = car.symbol ? (ROAD_ART.symbols as Record<string, { width: number; height: number }>)[frameFor(car.symbol, car.dir)] : undefined;
		const t = s.texture;
		return art && t && t.height > 0 ? (Math.abs(s.scale.y) * t.height) / art.height : 1;
	}

	/** where the car's motion puts it at board time `t` (the update loop's own formulas, without their side effects) */
	private posAt(car: Car, t: number): number {
		const m = car.m;
		if (!m) return car.sprite.x;
		if (car.phase === 'out') {
			const tau = (t - car.t0) / 1000;
			if (tau <= 0) return car.x0;
			const cap = m.out.maxSpeed / m.out.accel;
			const dist = tau <= cap ? 0.5 * m.out.accel * tau * tau : 0.5 * m.out.accel * cap * cap + m.out.maxSpeed * (tau - cap);
			return car.x0 + car.dir * dist;
		}
		if (car.phase === 'through') {
			// it comes out of the tunnel already at cruise (never a jump from standing)
			return car.x0 + car.dir * m.cruise * ((t - car.t0) / 1000);
		}
		if (car.phase === 'in') {
			const left = car.stopAt - t;
			if (t < car.rel) {
				// in the tunnel: at its release point, moving at its cruise speed from then (no jolt at the mouth)
				const dist = (car.v * car.b) / 2000 + (car.v * (car.stopAt - car.rel - car.b)) / 1000 + (car.v * (car.rel - t)) / 1000;
				return car.restX + car.dir * (car.overshoot - dist);
			}
			if (left > 0) {
				const brake = car.b;
				const dist = left <= brake ? (car.v * left * left) / (2000 * brake) : (car.v * brake) / 2000 + (car.v * (left - brake)) / 1000;
				return car.restX + car.dir * (car.overshoot - dist);
			}
			const u = -left / m.in.settleMs;
			if (u >= 1) return car.restX;
			const g = Math.exp(-4 * u) * Math.cos(2 * Math.PI * m.in.settleSwings * u) * (1 - u);
			return car.restX + car.dir * car.overshoot * g;
		}
		return car.phase === 'rest' ? car.restX : car.sprite.x;
	}

	/** the car's forward acceleration (road px per s^2 of board time) at board time `t` */
	private accelAt(car: Car, t: number): number {
		if (car.phase === 'rest' || car.phase === 'free' || !car.m) return 0;
		const h = 4;
		const a = (this.posAt(car, t + h) - 2 * this.posAt(car, t) + this.posAt(car, t - h)) / ((h / 1000) * (h / 1000));
		return car.dir * a;
	}

	/** the riders' springs, on the board's clock (`dtMs` board ms this frame) */
	private stepRiders(now: number, dtMs: number) {
		if (dtMs <= 0) return;
		for (const car of this.cars) {
			if (car.phase === 'free' || !car.symbol) continue;
			if (car.symbol === 'H2' && car.tree) car.tree.step(now, dtMs, (t) => this.accelAt(car, t));
			else if (SEATS.includes(car.symbol) && car.seated) car.seated.step(now, dtMs, (t) => this.accelAt(car, t));
		}
	}

	/** a rider's root in its car's lane, just after the car's sprite, with the sprite's transform, tint and visibility */
	private placeRider(car: Car, root: PIXI.Container) {
		const lane = this.lanes[car.lane];
		const s = car.sprite;
		if (root.parent !== lane || lane.getChildIndex(root) !== lane.getChildIndex(s) + 1) {
			root.removeFromParent();
			lane.addChildAt(root, lane.getChildIndex(s) + 1);
		}
		const k = this.builtK(car);
		root.position.set(s.x, s.y);
		root.rotation = s.rotation;
		if (root.skew.x !== s.skew.x || root.skew.y !== s.skew.y) root.skew.set(s.skew.x, s.skew.y);
		root.scale.set(k * Math.sign(s.scale.x || 1), k * Math.sign(s.scale.y || 1));
		if (root.tint !== s.tint) root.tint = s.tint;
		root.alpha = s.alpha;
		root.visible = true;
	}

	/** THE RIDERS FOLLOW THEIR CAR: shown only while it is (not free, visible, renderable) and only on their own symbol */
	private syncRiders(car: Car) {
		const s = car.sprite;
		const shown = car.phase !== 'free' && s.visible && s.renderable && car.symbol !== null;
		const wantTree = shown && WAGON_TREE.on && car.symbol === 'H2';
		const wantSeat = shown && SEATED.on && car.symbol !== null && SEATS.includes(car.symbol);
		if (wantTree) {
			const tree = (car.tree ??= new WagonTree(this.tex, TIER));
			if (tree.setFrame(frameFor('H2', car.dir) as TreeFrame)) {
				this.placeRider(car, tree.root);
				tree.draw();
			} else tree.root.visible = false;
		} else if (car.tree && car.tree.root.visible) car.tree.root.visible = false;
		if (wantSeat) {
			const seat = (car.seated ??= new SeatedDriver(this.tex, TIER));
			if (seat.setFrame(frameFor(car.symbol!, car.dir) as SeatFrame)) {
				this.placeRider(car, seat.root);
				// the win pulse's swell (0 to 1) from the sprite's own scale: the bob rides it
				const pulse = car.phase === 'rest' && car.winning && car.baseScale > 0 ? (Math.abs(s.scale.y) / car.baseScale - 1) / Math.max(1e-6, LINE_WIN.pulseScale - 1) : 0;
				// THE ANIMATION (constants SEATED.clips): the win reaction while a win runs through it (once), else the idle
				// while it stands at rest, else the still
				const clips = this.seatClips[car.symbol === 'H1' ? 'grandma' : 'santa'];
				// (once started the reaction plays to its end while the vehicle stands, even past a short win's hold)
				const inWin = car.phase === 'rest' && car.winning && !!this.win?.active;
				if (car.phase !== 'rest') seat.winT0 = null;
				let clip: SeatClip | null = null;
				let ms = 0;
				if ((inWin || seat.winT0 !== null) && clips.win) {
					seat.winT0 ??= this.winClock;
					ms = this.winClock - seat.winT0;
					if (ms < clips.win.lengthMs) clip = clips.win;
					else if (!inWin) seat.winT0 = null;
				}
				if (!clip && car.phase === 'rest' && clips.idle) {
					clip = clips.idle;
					// each slot its own place in the loop, so a board of drivers does not move as one
					ms = (this.seatTime ?? performance.now()) + this.cars.indexOf(car) * 1370;
				}
				seat.draw(pulse, clip, ms);
			} else seat.root.visible = false;
		} else if (car.seated && car.seated.root.visible) car.seated.root.visible = false;
		if (!wantTree && !wantSeat && car.riderShadow.visible) car.riderShadow.visible = false;
	}

	/** THE SEATED DRIVERS' ANIMATIONS: which sheets are wanted this frame (game/road/seatedClips.ts loads and lets go) */
	private updateSeatClips() {
		const want: Record<SeatChar, { idle: boolean; win: boolean }> = { grandma: { idle: false, win: false }, santa: { idle: false, win: false } };
		const winLive = !!this.win?.active;
		for (const car of this.cars) {
			if (car.phase !== 'rest' || !car.symbol || !SEATS.includes(car.symbol) || !car.sprite.visible) continue;
			const c: SeatChar = car.symbol === 'H1' ? 'grandma' : 'santa';
			want[c].idle = true;
			if ((car.winning && winLive) || car.seated?.winT0 != null) want[c].win = true;
		}
		const now = performance.now();
		for (const c of ['grandma', 'santa'] as SeatChar[]) {
			const before = this.seatClips[c];
			const idle = seatClip(c, 'idle', TIER, want[c].idle && SEATED.on, now);
			const win = seatClip(c, 'win', TIER, want[c].win && SEATED.on, now);
			// a sheet let go this frame: every driver of the character back to the still now (drawn or not), so nothing
			// holds its textures when they are destroyed
			if ((before.idle && !idle) || (before.win && !win)) for (const car of this.cars) if (car.seated && car.seated.last.character === c) car.seated.resetAnim();
			this.seatClips[c] = { idle, win };
		}
	}

	/** DEV / probes: every wagon's tree as drawn (cell, phase, direction, whether it shows, sits right after its wagon in
	 *  the lane, follows the wagon's transform and tint; the springs' values and the travel drawn at the tip, the body,
	 *  under the ropes; its shadow) */
	treeSnapshot() {
		const r3 = (v: number) => Math.round(v * 1000) / 1000;
		return this.cars
			.filter((c) => c.symbol === 'H2' && c.phase !== 'free')
			.map((c) => {
				const t = c.tree;
				const lane = this.lanes[c.lane];
				const root = t?.root;
				return {
					slot: this.cars.indexOf(c), cell: c.phase === 'rest' ? c.col * ROWS + c.lane : null, phase: c.phase, dir: c.dir, lane: c.lane, carVisible: c.sprite.visible && c.sprite.renderable, x: r3(c.sprite.x),
					shown: !!root && root.visible && root.parent === lane, frame: t?.frame ?? null,
					afterSprite: !!root && root.parent === lane && lane.getChildIndex(root) === lane.getChildIndex(c.sprite) + 1,
					follows: !!root && Math.abs(root.x - c.sprite.x) < 1e-6 && Math.abs(root.y - c.sprite.y) < 1e-6 && root.rotation === c.sprite.rotation && Math.abs(root.scale.y - this.builtK(c)) < 1e-6 && root.tint === c.sprite.tint,
					tip: r3(t?.tip.b ?? 0), body: r3(t?.body.b ?? 0), ...(t?.last ?? { tipDy: 0, bodyDy: 0, ropeDy: 0, strips: 0 }),
					shadow: c.riderShadow.visible, carShadow: c.shadow.visible,
				};
			});
	}

	/** DEV / probes: every seated driver as drawn (cell, phase, direction, its vehicle's symbol, shown, the layer order:
	 *  vehicle sprite, then the root right after it with the driver before the front layer; its lean and bob) */
	seatedSnapshot() {
		return this.cars
			.filter((c) => c.symbol !== null && SEATS.includes(c.symbol) && c.phase !== 'free')
			.map((c) => {
				const d = c.seated;
				const lane = this.lanes[c.lane];
				const root = d?.root;
				return {
					slot: this.cars.indexOf(c), carX: Math.round(c.sprite.x * 100) / 100, cell: c.phase === 'rest' ? c.col * ROWS + c.lane : null, phase: c.phase, dir: c.dir, symbol: c.symbol, lane: c.lane, carVisible: c.sprite.visible && c.sprite.renderable, winning: c.winning,
					shown: !!root && root.visible && root.parent === lane, frame: d?.frame ?? null,
					layered: !!root && root.parent === lane && lane.getChildIndex(root) === lane.getChildIndex(c.sprite) + 1 && root.getChildIndex(d!.figure) < root.getChildIndex(d!.front) && d!.figure.visible && d!.front.visible,
					follows: !!root && Math.abs(root.x - c.sprite.x) < 1e-6 && Math.abs(root.y - c.sprite.y) < 1e-6 && root.rotation === c.sprite.rotation && Math.abs(root.scale.y - this.builtK(c)) < 1e-6 && root.tint === c.sprite.tint,
					...(d?.last ?? { leanDeg: 0, bob: 0, x: 0, y: 0, scale: 1, character: '' }),
					// (a driver not drawn this frame shows nothing)
					anim: d && d.root.visible ? d.anim : { clip: 'still', frame: -1 },
					headShown: !!d && d.patch.visible && d.root.visible,
					headLayered: !!d && d.root.getChildIndex(d.figure) < d.root.getChildIndex(d.patch) && d.root.getChildIndex(d.patch) < d.root.getChildIndex(d.front),
					headFollows: !!d && (!d.patch.visible || (d.patch.x === d.figure.x && d.patch.y === d.figure.y && d.patch.rotation === d.figure.rotation && Math.sign(d.patch.scale.x) === Math.sign(d.figure.scale.x))),
					shadow: c.riderShadow.visible,
				};
			});
	}

	/** DEV / probes: riders drawn now whose car is not (free, hidden, another symbol), and rider shadows left on: always 0 */
	strayRiders(): number {
		let n = 0;
		for (const lane of this.lanes) {
			for (const child of lane.children) {
				if ((child.label !== 'wagonTree' && child.label !== 'seated') || !child.visible) continue;
				const owner = this.cars.find((c) => c.tree?.root === child || c.seated?.root === child);
				const ok = !!owner && owner.phase !== 'free' && owner.sprite.visible && owner.sprite.renderable && (child.label === 'wagonTree' ? owner.symbol === 'H2' : owner.symbol !== null && SEATS.includes(owner.symbol));
				if (!ok) n += 1;
			}
		}
		for (const c of this.cars) if (c.riderShadow.visible && (c.phase === 'free' || !c.sprite.visible)) n += 1;
		return n;
	}

	private wait(at: number, clock: 'board' | 'win'): Promise<void> {
		if (this.destroyed) return Promise.resolve();
		return new Promise<void>((resolve) => this.waiters.push({ at, clock, resolve }));
	}

	/** the landing board's dim on the road band outside the three posed columns, on or off */
	setLandingDim(on: boolean) {
		if (!on) {
			for (const c of this.landingDim ?? []) c.destroy({ children: true });
			this.landingDim = null;
			return;
		}
		if (this.landingDim) return;
		const D = LANDING_DIM;
		const lane = (LINES[ROWS] - LINES[0]) / ROWS;
		const top = LINES[0] - D.above * lane;
		const bottom = LINES[ROWS] + D.below * lane;
		const alpha = 1 - D.brightness;
		const under = new PIXI.Container();
		const over = new PIXI.Container();
		// the band in pieces, each piece's outer edges (the band's top and bottom) in `steps` strips of falling alpha (a
		// soft edge with no blur). `soft`: which of its own edges are the band's.
		const piece = (parent: PIXI.Container, x0: number, x1: number, y0: number, y1: number, softTop: boolean, softBottom: boolean) => {
			if (x1 <= x0 || y1 <= y0) return;
			const f = D.feather;
			const quad = (a0: number, a1: number, a: number) => {
				const q = new PIXI.Sprite(PIXI.Texture.WHITE);
				q.tint = 0x000000;
				q.alpha = a;
				q.position.set(x0, a0);
				q.width = x1 - x0;
				q.height = a1 - a0;
				parent.addChild(q);
			};
			const t = softTop ? y0 + f / 2 : y0;
			const b = softBottom ? y1 - f / 2 : y1;
			quad(t, b, alpha);
			for (let i = 0; i < D.steps; i++) {
				const a = (alpha * (i + 0.5)) / D.steps;
				const h = f / D.steps;
				if (softTop) quad(y0 - f / 2 + i * h, y0 - f / 2 + (i + 1) * h, a);
				if (softBottom) quad(y1 + f / 2 - (i + 1) * h, y1 + f / 2 - i * h, a);
			}
		};
		const left = ROAD_ART.covers.left;
		const right = ROAD_ART.covers.right;
		const stageL = ROAD_ART.board.x + PITCH;
		const stageR = ROAD_ART.board.x + 4 * PITCH;
		const imgW = ROAD_ART.image.width;
		// beside the three columns, the band's whole height; over and under them, only the snow and the shoulder outside
		// the columns' own box (the characters draw over it, so what spills above stays bright)
		piece(under, left.x + left.width, stageL, top, bottom, true, true);
		piece(under, stageR, right.x, top, bottom, true, true);
		piece(under, stageL, stageR, top, LINES[0], true, false);
		piece(under, stageL, stageR, LINES[ROWS], bottom, false, true);
		piece(over, 0, left.x + left.width, top, bottom, true, true);
		piece(over, right.x, imgW, top, bottom, true, true);
		// under: right over the lanes, under the features; over: on top of the portals
		this.root.addChildAt(under, this.root.getChildIndex(this.features.layer));
		this.root.addChild(over);
		this.landingDim = [under, over];
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
			// the last drive in's schedule (board clock): when its traffic set off, when its last lane is home
			spin: { convoyAt: Number.isFinite(this.convoyAt) ? Math.round(this.convoyAt * 10) / 10 : null, homeAt: Math.round(Math.max(...this.laneHomeAt) * 10) / 10 },
			// the presents on the road: where, whether animating, and what is drawn (the still S or the present's pieces)
			presents: this.cars
				.filter((c) => c.symbol === 'S' && c.phase !== 'free')
				.map((c) => ({ cell: c.col * ROWS + c.lane, phase: c.phase, busy: !!c.present?.busy, opening: !!c.present?.opening, stillDrawn: c.sprite.renderable && c.sprite.visible, texture: c.sprite.texture?.label ?? null, frame: c.sprite.texture ? { w: c.sprite.texture.frame.width, h: c.sprite.texture.frame.height } : null })),
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

	/** THE CAST SHADOWS as drawn (dev hook, tools/shadow_probe.mjs): every symbol's twin against its owner (texture,
	 *  anchor, place, scale, rotation and the twin's lean and alpha), the features' (columns, the runner), and the
	 *  ground layer's sprites */
	shadowSnapshot() {
		const r2 = (v: number) => Math.round(v * 100) / 100;
		const cars = this.cars
			.filter((c) => c.phase !== 'free' || c.shadow.visible)
			.map((c) => {
				const s = c.shadow;
				const o = c.sprite;
				return {
					phase: c.phase, symbol: c.symbol, cell: c.phase === 'rest' ? c.col * ROWS + c.lane : null, lane: c.lane, frame: c.symbol ? frameFor(c.symbol, c.dir) : null,
					ownerX: r2(o.x), ownerY: r2(o.y), ownerVisible: o.visible, ownerScaleX: Math.round(o.scale.x * 10000) / 10000, ownerScaleY: Math.round(o.scale.y * 10000) / 10000, ownerAnchor: [o.anchor.x, o.anchor.y], ownerRotation: o.rotation, ownerTexture: o.texture?.label ?? null, ownerTextureUid: o.texture?.uid ?? -1,
					visible: s.visible, x: r2(s.x), y: r2(s.y), scaleX: Math.round(s.scale.x * 10000) / 10000, scaleY: Math.round(s.scale.y * 10000) / 10000, skewX: s.skew.x, skewY: s.skew.y, rotation: s.rotation, anchor: [s.anchor.x, s.anchor.y], sameTexture: s.texture === o.texture, alpha: Math.round(s.alpha * 1000) / 1000, tint: s.tint,
					// the owner's picture height (road px, at its scale) and the parent the twin lies in
					ownerHeight: r2(o.texture ? o.texture.height * Math.abs(o.scale.y) : 0), ownerWidth: r2(o.texture ? o.texture.width * Math.abs(o.scale.x) : 0), inGround: s.parent === this.ground,
					// the owner's picture as drawn (its trim inside its canvas: the present's still sits in a bigger canvas), road
					// px from its anchor
					ownerArt: (() => {
						const t = o.texture;
						if (!t) return null;
						const tr = t.trim;
						const x0 = tr ? tr.x : 0;
						const y0 = tr ? tr.y : 0;
						const w = tr ? tr.width : t.orig.width;
						const h = tr ? tr.height : t.orig.height;
						return { x0: r2((x0 - o.anchor.x * t.orig.width) * Math.abs(o.scale.x)), y0: r2((y0 - o.anchor.y * t.orig.height) * Math.abs(o.scale.y)), w: r2(w * Math.abs(o.scale.x)), h: r2(h * Math.abs(o.scale.y)) };
					})(),
				};
			});
		// the lanes' index in the root against the ground's (the ground must be under every lane)
		const groundIndex = this.root.getChildIndex(this.ground);
		const lanesAbove = this.lanes.every((l) => this.root.getChildIndex(l) > groundIndex);
		return { strength: shadowStrength(), cars, groundSprites: this.ground.children.length - 1 + this.features.groundLayer.children.length, lanesAbove, features: this.features.shadowSnapshot() };
	}

	destroy() {
		this.destroyed = true;
		releaseAllSeatClips();
		for (const w of this.waiters) w.resolve();
		this.waiters = [];
		this.features.destroy();
		this.scene.destroy();
		this.root.destroy({ children: true });
	}
}
