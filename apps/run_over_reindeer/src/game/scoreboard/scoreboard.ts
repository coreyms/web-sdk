// THE LED SCOREBOARD (Corey 2026-11-16, bigwin_led_r3_2026-11-16 "r3b", approved from the live mock; part A 2026-11-17;
// constants LED_BOARD). Under the road a one-row LED STRIP, always on and always lit: the six idle cartoons, the bonus
// round's counter, the Grandma gag, the small win and the Big and Super wins. Behind it a separate LED BACK BOARD with the
// strip's width, frame, dot pitch and bezel: for Mega, Epic and Max it rises (style C: past its seat, back down with one
// bounce) and seats its bottom rail under the strip's snow cap, so the pair reads as one scoreboard, while the strip keeps
// its own line. Decoration only: it shows the book's amounts; its race draws from its own random source.
//
// HOW IT IS DRAWN (plain Pixi, no filter, shader, mask, backdrop-filter or blob: URL), back to front:
//   the dim          a flat dark quad over the scene while the back board is up (the HUD's own areas left out)
//   the back board   a Graphics housing (frame, recess, bolts, icicles, snow cap) and its face, moved up and down as one
//   the snow cover   THE FOREGROUND SNOW that hides the lowered back board (no mask): crops of the scene's OWN textures (the
//                    preset's field tile, the road picture, the bottom band, game/scenePresets.ts boardCover) laid exactly
//                    where the scene draws them, from the strip's top to the screen's bottom, the back board's width. It
//                    adds no texture memory and cannot be told from the scene behind it. Under the dim it is tinted as the
//                    dim darkens the scene.
//   the strip        its Graphics housing and its face
//   a face           a CPU canvas at ONE PIXEL PER LED (game/scoreboard/scoreboardDraw.ts), shown by a sprite stretched over
//                    the face with NEAREST sampling (an LED is a block) and re-sent to the GPU at LED_BOARD.fps; one shared
//                    grille tile of round soft holes (mipmapped) laid over it, one hole per LED; the same picture at half
//                    the face's size in dots, linear, ADDED faintly over it (the LED glow); a static glass sheen
//   THE FINER GRID   (2026-11-19, constants LED_BOARD.density, ledGrid.ts): k LEDs per dot (1.5) where an LED stays at least
//                    minDevicePx device px (ledGrid densityFor: the pitch x the renderer's resolution / k), else one per dot as
//                    before. Decided for both faces together; a layout, a resolution change or the tune panel that changes it
//                    rebuilds both faces at once (never two densities on screen). The grille's holes then carry the soft dot.
//   THE SMALLEST DOT (2026-11-22, constants LED_BOARD.pitch, layout.ts ledPitchGeo): the dot count follows the window. A dot
//                    is at least the layout class's floor in CSS px and a whole number of renderer pixels, each face whole
//                    dots, the grille's hole made for exactly that size (no shrunk tile); the strip keeps its own dots
//                    where it is short. A show that is up is made ahead for a new grid before the board changes to it.
// PART B (2026-11-17): the back board's staged scenes (scoreboardDraw.ts backScene: the Free Spins and Super entries, the Total
// Win, Mega's jam, Epic's honk meter, Max's race), the bonus round's cards on the back board (card(), cardPress()), the tier
// sounds through `onTier` (each tier once), the shakes (shakeY: Board moves the road and the logo by it), and the Grandma
// gag's rule (only a Big or higher message cuts it; a small win waits for it to end).
import * as PIXI from 'pixi.js';

import { INTRO_LINE, LED_BOARD } from '../constants';
import { C, faceClearNow, faceDrawn, mk, screenScaleMaxNow, setFaceClear, setScreenScaleMax, shimmer, wildsDrawn, type Cv } from '../landing/ledScreens';
import { renderResolutionFor } from '../deviceTier';
import { clearP, copyFace, copyP, fillP, ledN } from './ledGrid';
import { ledPitchGeo, type ScoreboardGeo, type Rect } from './layout';
import { backScene, boardPitchNow, rowDotsNow, setRowDots, clearTitle, showRibbon, borderGlint, countBorder, dissolveFace, entryWaitOf, flashesOf, powerOnFace, plowOf, raceCardOf, ridersOf, titlesOf, gagWordsAt, setBoardClass, setBoardPitch, titleOf, makeFaceCanvases, maxRaceAtOf, maxRaceOf, powerOffFace, showCounter, showGag, showSmall, showWin, stripFlourish, type CartoonState, type Face } from './scoreboardDraw';
import { amountNow, backOffset, brightOf, dimAlpha, endShow, isCard, landCard, newCardShow, newPressShow, newShow, phaseOf, seatedAt, shakeAt, skipShow, tierNow, type Show } from './show';
import { newRace, type RaceOutcome } from './race';
import { pickStrip, type StripItem, type StripTruth } from './stripArbiter';
import { pressCycleMs, pressScreenAt, pressScreenNameAt, scatterWordsOf, showGagShort, showPressLine, showScatterCount, showWheelLine, type ScatterFace, type WheelLine } from './stripDraw';
// (2026-11-19) the round 1 LED ideas Corey picked (constants LED_BOARD.ideas): the entries, the Total Win's ladder, the strip's
// new cartoons in the rotation, the press screen's light string
import { cartoons, pressScreensLit, showCartoonNow } from './ambient';
import { presentsEntry, teaseEntry } from './entryScenes';
import { ladderTotal } from './totalLadder';
import { clearIdeas, ideasOf } from './ideasKit';
import type { LedText } from '../landing/ledScreens';
import { clearExplain, explainOf, showExplain } from './explainDraw';
import { warmRun } from './warmGate';

const col = (hex: string) => Number.parseInt(hex.slice(1), 16);
const GRILLE = { cells: 16, cellPx: 16 };
/** the lit dot's share of the pitch: the smallest dot rule's while it is on (constants LED_BOARD.pitch.fill), else the grid's */
const gridFill = () => (LED_BOARD.pitch.on ? LED_BOARD.pitch.fill : LED_BOARD.grid.fill);

/** THE GRILLE'S TILE (makeGrille): CELLS x CELLS holes, `cellPx` tile pixels each. `exact`: made for a face whose LEDs are
 *  that many whole renderer pixels (constants LED_BOARD.pitch.snap), drawn one tile pixel per renderer pixel, no mipmaps;
 *  else the 16 px tile shrunk to the LED's size with mipmaps, as before the smallest dot rule */
type GrilleTile = { key: string; tex: PIXI.Texture; canvas: Cv; cellPx: number; exact: boolean; soft: boolean; measured: { across: number; down: number; open: number } | null };
type GpuFace = {
	F: Face;
	tile: GrilleTile;
	halo: Cv;
	tex: PIXI.Texture;
	haloTex: PIXI.Texture;
	root: PIXI.Container;
	unlit: PIXI.Sprite;
	content: PIXI.Sprite;
	glow: PIXI.Sprite;
	grille: PIXI.Container;
	/** the lit dots once more over their own gaps (LED_BOARD.grid.litOver; hidden at 0, today) */
	litOver: PIXI.Sprite;
	sheen: PIXI.Sprite;
	/** the content key of the last step (a change starts the strip's switch) */
	key: string;
	switchAt: number;
	switchKind: 'scan' | 'dissolve' | null;
};

/** a scene piece the snow cover is cut from: its texture and its place in road px; `tile` repeats it on its own period */
export type CoverPiece = { tex: PIXI.Texture; x: number; y: number; w: number; h: number; tile?: boolean };

/** THE SCATTER COUNT as the road reads it each frame (game/road/roadBoard.ts scatterCount): the spin it belongs to (`id`),
 *  the presents seen, the number needed, whether the spin is in anticipation now, whether a trigger is made and the highest
 *  trigger count reached (0: none) */
export type ScatterRead = { id: number; count: number; need: number; live: boolean; hit: boolean; reached: number };

/** what the scoreboard needs from the game each frame: a bonus round and its spins left; `idle`: true idle (the base game,
 *  no autoplay, nothing playing: the race may run); the scatter count */
export type ScoreboardEnv = { free: boolean; left: number; idle?: boolean; scatter?: ScatterRead | null };

/** `countMs`: a small win's count (the line win's strip total, LINE_WIN.slam stripCountMs at the turbo level's pace) */
export type WinRequest = { x: number; amount: number; bet: number; fmt: (v: number) => string; rate: number; auto: boolean; small?: boolean; countMs?: number };
/** a bonus round card on the back board: the entries (`spins` awarded) and the Total Win (`amount`, the currency's units) */
/** (2026-11-19, LED_BOARD.ideas) `x`: the round's win in play multiples, `capped`: the round hit the cap (the Total Win's
 *  ladder and size class), `auto`: Autoplay Bonuses will continue it by itself (the cap page's hold is then off),
 *  `presents`: an entry's trigger scatter count (the book's freeSpinTrigger cells; 0 not known) */
export type CardRequest = { kind: 'fs' | 'sfs' | 'total'; spins: number; amount: number; fmt: (v: number) => string; rate: number; title?: string | null; line?: string | null; x?: number; capped?: boolean; auto?: boolean; presents?: number };

/** A CARD MADE AHEAD (constants LED_BOARD.warm, warmGate.ts; prepare / warmStep below): the card's request, its show and
 *  two scratch faces the size and density of the real ones (CPU canvases only, never a texture; let go once it is done),
 *  the card's clock at each LED step and the order they are drawn in, and its readouts for the dev hook */
type WarmJob = {
	kind: CardRequest['kind'] | 'regrid';
	/** (null: a grid made ahead for the show that is up, `grid` and `live` below) */
	req: CardRequest | null;
	/** A GRID MADE AHEAD (constants LED_BOARD.warm.regrid; ensureFaces, regridHolds): the window changed size while a show was
	 *  up, so the show is drawn ahead on scratch faces of the new grid, from its clock now on, before the board changes to it */
	grid: { geo: ScoreboardGeo; key: string } | null;
	live: Show | null;
	show: Show | null;
	back: Face | null;
	strip: Face | null;
	/** the faces the scratch faces were made for (a new size or density starts the job again) */
	faceKey: string;
	times: number[];
	order: number[];
	next: number;
	coarseDone: boolean;
	/** what each sample (its index in times) made or stopped at, over its tries */
	madeAt: Map<number, number>;
	state: 'queued' | 'running' | 'done' | 'dropped' | 'failed';
	why: string;
	samples: number;
	made: number;
	ms: number;
	frames: number;
	maxFrameMs: number;
	queuedAt: number;
	doneAt: number | null;
	/** its card has come up (a later card of its kind is not this one's) */
	used: boolean;
};
/** A SMALL WIN MADE AHEAD (2026-11-22, wip/winlights; LED_BOARD.warm.small; prepareSmall / smallWarmStep below): the strip's
 *  small win a spin's line win will show, drawn ahead on a kept scratch strip face at the steps that make pictures (its
 *  first step, the landed amount, the reindeer's hop frames, then every step of its count), so it comes up from the caches */
type SmallWarm = { show: Show; times: number[]; next: number; state: 'running' | 'done' | 'dropped' | 'failed'; why: string; samples: number; made: number; ms: number; frames: number; maxFrameMs: number; amount: string };
/** a show as it came up (performance.now()), and how far its card's warm had got then (the dev hook's frame windows) */
export type ShowMark = { kind: string; id: number; at: number; warm: string };

/** THE TUNE PANEL'S AND THE DEV HOOK'S WAY IN (staging builds too: the panel cannot reach the DEV-only window hook) */
export const scoreboardDev: { board: Scoreboard | null; bet: () => number; fmt: (v: number) => string } = { board: null, bet: () => 1, fmt: (v) => v.toFixed(2) };

/** THE BACK BOARD'S PROGRAM with the round 1 picks (constants LED_BOARD.ideas): the Free Spins entry's presents, the Super
 *  entry's red present tease, the Total Win's taillight ladder; each switch set to 'today' draws today's scene */
function ideasBackScene(F: Face, s: Show) {
	const I = LED_BOARD.ideas;
	if (s.kind === 'fs' && I.fsEntry === 'presents') return presentsEntry(F, s);
	if (s.kind === 'sfs' && I.sfsEntry === 'tease') return teaseEntry(F, s);
	if (s.kind === 'total' && I.total === 'ladder') {
		ladderTotal(F, s);
		countBorder(F, s);
		return;
	}
	backScene(F, s);
}

export class Scoreboard {
	readonly root = new PIXI.Container();
	private readonly dim = new PIXI.Sprite(PIXI.Texture.WHITE);
	private readonly backRoot = new PIXI.Container();
	private readonly backHousing = new PIXI.Graphics();
	private readonly coverA = new PIXI.Container();
	private readonly coverB = new PIXI.Container();
	/** THE SCENE SWAP (2026-11-19, game/scene/sceneSwap.ts, sceneSnapshot.ts): the cover holds the scene on screen only; at a
	 *  swap it is cut from the incoming scene at once, and the picture of the outgoing screen is laid over it here (the
	 *  cover's rectangle of it) and fades out with the picture over the road, so the cover is at the same point of the fade
	 *  as the scene round it. It moves with the cover's shake. */
	private readonly coverSnap = new PIXI.Container();
	private readonly stripRoot = new PIXI.Container();
	private readonly stripHousing = new PIXI.Graphics();
	/** the press catcher while a win counts or holds (a tap anywhere on the canvas skips; the HTML HUD stays on top) */
	private readonly catcher = new PIXI.Sprite(PIXI.Texture.WHITE);
	/** the grille's tiles in use, by look and size (makeGrille; one per face where the strip keeps its own dots) */
	private readonly tiles = new Map<string, GrilleTile>();
	/** the device px per CSS px the faces were placed for (LED_BOARD.grid.snap) */
	private placedRatio = 0;
	/** THE FINER GRID (LED_BOARD.density): the faces' LEDs per dot now, and the renderer's device px per CSS px (Board sets it
	 *  to the renderer's resolution; until then the device's, as game/deviceTier.ts would pick it) */
	private faceK = 1;
	deviceRatio: () => number = () => (typeof window === 'undefined' ? 1 : renderResolutionFor(window.innerWidth, window.innerHeight));
	private readonly sheenTex: PIXI.Texture;
	private readonly coverFrames: PIXI.Texture[] = [];
	private strip: GpuFace | null = null;
	private back: GpuFace | null = null;
	private geo: ScoreboardGeo | null = null;
	/** THE SMALLEST DOT RULE (constants LED_BOARD.pitch; layout.ts ledPitchGeo): the place as the layout pass gave it (`geo0`)
	 *  and the scene pieces of its snow cover; `geo` above is that place with the faces laid out for the renderer's
	 *  resolution, made again only when the place, the resolution or the rule's numbers change (`ruled*`) */
	private geo0: ScoreboardGeo | null = null;
	private pieces: CoverPiece[] = [];
	private ruled: ScoreboardGeo | null = null;
	private ruledFrom: ScoreboardGeo | null = null;
	private ruledRatio = 0;
	private ruledStamp = NaN;
	/** the tiles the faces were built with (a change of an LED's size in renderer pixels rebuilds them, not the pictures) */
	private tileKey = '';
	/** whether the faces as built were placed by the rule (the dot font step follows it) */
	private faceRuled = false;
	private faceKey = '';
	/** the scoreboard's own clock (real ms) and the last content step drawn */
	private clock = 0;
	private stepAt = -1;
	/** the show on the strip (and the back board when it arrives), and the one still lowering the back board */
	private show: Show | null = null;
	private lowering: Show | null = null;
	/** a small win that waits for the Grandma gag to end (part B: only a Big or higher message cuts the gag) */
	private pendingSmall: Show | null = null;
	/** THE SHAKE now (CSS px): the board moves the road and the logo by it (Board.svelte); the back board or the strip
	 *  moves with them here */
	shakeY = 0;
	private waits = new Map<number, { resolve: () => void; timer: ReturnType<typeof setTimeout> }>();
	/** the Grandma gag's start (clock ms), null when none, and whether it is the short line (one screen) */
	private gagAt: number | null = null;
	private gagShort = false;
	/** THE SCATTER COUNT (constants LED_BOARD.scatterCount): the spin's count while it is in anticipation, and its fireworks
	 *  after a trigger (until endAt) */
	private scat: (ScatterFace & { id: number; live: boolean; hit: boolean; endAt: number }) | null = null;
	/** THE SUPER WHEEL'S LINE (game/road/superWheel.ts; constants SUPER_WHEEL.text): what the wheel says on the strip while it
	 *  is up (null: nothing); it ranks just under a card's own line */
	private wheelMsg: WheelLine | null = null;
	/** DEV: the wheel's blinking line held lit (the probe's stills) */
	devWheelSteady = false;
	/** THE ARBITER'S PICK (constants LED_BOARD.stripOrder) on the last drawn step, and what was true then */
	private stripNow: StripItem = 'cartoon';
	private stripAt = 0;
	/** the Grandma lines played in this bonus round (LED_BOARD.gagPerBonus) */
	private bonusGags = 0;
	/** THE PRESS SCREEN on the expanded board (2026-11-17): its words, whether the press gate is open (the strip's line shows),
	 *  and the press's hand over (resolved as the board has powered down and starts to lower) */
	private pressText: LedText | null = null;
	private pressReady = false;
	private pressWait: { id: number; resolve: () => void; timer: ReturnType<typeof setTimeout> } | null = null;
	/** called once the press screen's board is down (the press screen's pictures may be unloaded) */
	onPressGone: (() => void) | null = null;
	/** (2026-11-18) a card or a win raised over the press screen by hand (the tune panel's buttons): the press screen comes
	 *  back once it has gone, rather than ending */
	private pressSuspended = false;
	private truthNow: StripTruth | null = null;
	/** the idle cartoons: which one, since when, and the race's own run */
	private cartoon = 0;
	private cartoonAt = 0;
	private readonly cartoonState: CartoonState = { race: null, raceFor: -1, raceNext: null };
	/** the bonus round's counter */
	private left = -1;
	private leftAt = -1e9;
	private free = false;
	/** DEV: driven by hand (frame by frame captures): the ticker's updates are ignored, step() drives it */
	manual = false;
	/** DEV / probe: a scatter count by hand in place of the road's (undefined: the road's) */
	devScatter: ScatterRead | null | undefined = undefined;
	private env: ScoreboardEnv = { free: false, left: 0 };
	/** the cover's dim tint is set for this alpha */
	private coverTintFor = -1;
	/** readouts for the dev hook and the probe */
	cost = { drawMs: 0, steps: 0, uploadBytes: 0 };
	private log: { at: number; what: string; detail?: string }[] = [];
	/** called once on each tier the count reaches (tier, show; a skip's final tier too: the tier sounds), and on a show's
	 *  beats ('start', 'gone') */
	onTier: ((tier: number, show: Show) => void) | null = null;
	onBeat: ((beat: string, show: Show) => void) | null = null;
	/** the back board's face program: the staged scene of the show (part B, scoreboardDraw.ts backScene; 2026-11-19 the round
	 *  1 picks in its place where LED_BOARD.ideas says so) */
	backProgram: (F: Face, s: Show) => void = ideasBackScene;
	/** the catcher's press (Board wires it to the skip) */
	onPress: (() => void) | null = null;
	/** THE CARDS MADE AHEAD (constants LED_BOARD.warm): the jobs queued, running and the last few finished */
	private warmJobs: WarmJob[] = [];
	/** the small win made ahead (the last one kept for the readout), and its scratch strip face (kept: one per face size) */
	private smallWarm: SmallWarm | null = null;
	private smallFace: { key: string; F: Face } | null = null;
	/** the last shows as they came up (ShowMark) */
	private marks: ShowMark[] = [];

	constructor() {
		this.root.eventMode = 'passive';
		this.dim.eventMode = 'none';
		this.dim.tint = LED_BOARD.dim.color;
		this.dim.alpha = 0;
		this.dim.visible = false;
		this.backRoot.eventMode = 'none';
		for (const c of [this.coverA, this.coverB, this.coverSnap]) c.eventMode = 'none';
		this.stripRoot.eventMode = 'none';
		this.catcher.alpha = 0;
		this.catcher.visible = false;
		this.catcher.eventMode = 'none';
		this.catcher.on('pointertap', () => this.onPress?.());
		this.backRoot.addChild(this.backHousing);
		this.stripRoot.addChild(this.stripHousing);
		this.root.addChild(this.dim, this.backRoot, this.coverA, this.coverB, this.coverSnap, this.stripRoot, this.catcher);
		this.backRoot.visible = false;
		this.grilleNow();
		const sh = mk(32, 32);
		const gr = sh.ctx.createLinearGradient(0, 0, 32 * 0.6, 32);
		gr.addColorStop(0, 'rgba(255,255,255,0.045)');
		gr.addColorStop(0.5, 'rgba(255,255,255,0)');
		sh.ctx.fillStyle = gr;
		sh.ctx.fillRect(0, 0, 32, 32);
		this.sheenTex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: sh as unknown as PIXI.ICanvas }) });
		scoreboardDev.board = this;
	}

	/** the grille's tile: CELLS x CELLS round soft holes in the housing's dark, one hole per LED (made once per look and
	 *  size). `soft` (the finer grid's soft dot, mock led_density_r1): a faint skirt baked round each hole, so a lit LED's
	 *  own light shows a little in the gap round it. `exact` (the smallest dot rule's snapped faces, mock
	 *  led_dot_size_r1_2026-11-22): the tile is made at `cellPx` pixels a hole, the LED's own size in renderer pixels, each
	 *  tile pixel the hole's share of that pixel (the stamp drawn 4 times finer and averaged), so nothing is shrunk on the
	 *  GPU and a dot and its gap stay apart; else the 16 px tile with mipmaps, as before */
	private makeGrille(soft: boolean, cellPx: number, exact: boolean, key: string): GrilleTile {
		const n = GRILLE.cells;
		const s = exact ? Math.max(1, Math.round(cellPx)) : GRILLE.cellPx;
		const q = exact ? 4 : 1;
		const Q = s * q;
		const Gd = LED_BOARD.grid;
		const tile = mk(n * s, n * s);
		const stamp = mk(Q, Q);
		const sc = stamp.ctx;
		// (LED_BOARD.grid: today's tile exactly at round, 0.73, row 1; the mock's grid group otherwise)
		const fill = gridFill();
		const row = Gd.rowScale;
		if (Gd.shape === 'square') {
			const w = Math.max(1, fill * Q);
			const h = Math.max(1, Math.min(Q, fill * row * Q));
			sc.fillStyle = 'rgba(0,0,0,0.5)';
			sc.fillRect((Q - w) / 2 - q, (Q - h) / 2 - q, w + 2 * q, h + 2 * q);
			sc.fillStyle = 'rgba(0,0,0,1)';
			sc.fillRect((Q - w) / 2, (Q - h) / 2, w, h);
		} else {
			sc.save();
			sc.translate(Q / 2, Q / 2);
			sc.scale(1, row);
			const R = Gd.shape === 'soft' ? Q * 0.62 * (fill / 0.73) : Q * 0.47 * (fill / 0.73);
			const rg = sc.createRadialGradient(0, 0, 0, 0, 0, R);
			if (Gd.shape === 'soft') {
				rg.addColorStop(0, 'rgba(0,0,0,1)');
				rg.addColorStop(0.3, 'rgba(0,0,0,0.92)');
				rg.addColorStop(0.7, 'rgba(0,0,0,0.45)');
				rg.addColorStop(1, 'rgba(0,0,0,0)');
			} else {
				rg.addColorStop(0, 'rgba(0,0,0,1)');
				rg.addColorStop(0.5, 'rgba(0,0,0,1)');
				rg.addColorStop(0.78, 'rgba(0,0,0,0.5)');
				rg.addColorStop(1, 'rgba(0,0,0,0)');
			}
			sc.fillStyle = rg;
			sc.fillRect(-Q, -Q, 2 * Q, 2 * Q);
			if (soft && Gd.shape === 'round') {
				const r2 = sc.createRadialGradient(0, 0, 0, 0, 0, Q * 0.72 * (fill / 0.73));
				r2.addColorStop(0, 'rgba(0,0,0,0.5)');
				r2.addColorStop(0.6, 'rgba(0,0,0,0.3)');
				r2.addColorStop(1, 'rgba(0,0,0,0)');
				sc.fillStyle = r2;
				sc.fillRect(-Q, -Q, 2 * Q, 2 * Q);
			}
			sc.restore();
		}
		if (!exact) {
			tile.ctx.fillStyle = C.base;
			tile.ctx.fillRect(0, 0, n * s, n * s);
			tile.ctx.globalCompositeOperation = 'destination-out';
			for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) tile.ctx.drawImage(stamp, i * s, j * s);
			tile.ctx.globalCompositeOperation = 'source-over';
			const tex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: tile as unknown as PIXI.ICanvas, autoGenerateMipmaps: true, scaleMode: 'linear' }) });
			return { key, tex, canvas: tile, cellPx: s, exact, soft, measured: null };
		}
		// one hole: each of its pixels the plate's share of that pixel (the stamp's q x q samples averaged), laid CELLS x CELLS
		const d = stamp.ctx.getImageData(0, 0, Q, Q).data;
		const cell = new Uint8Array(s * s);
		for (let j = 0; j < s; j++)
			for (let i = 0; i < s; i++) {
				let a = 0;
				for (let b = 0; b < q; b++) for (let c = 0; c < q; c++) a += d[((j * q + b) * Q + i * q + c) * 4 + 3];
				cell[j * s + i] = 255 - Math.round(a / (q * q));
			}
		const base = col(C.base);
		const id = tile.ctx.createImageData(n * s, n * s);
		for (let y = 0; y < n * s; y++)
			for (let x = 0; x < n * s; x++) {
				const o = (y * n * s + x) * 4;
				id.data[o] = (base >> 16) & 255;
				id.data[o + 1] = (base >> 8) & 255;
				id.data[o + 2] = base & 255;
				id.data[o + 3] = cell[(y % s) * s + (x % s)];
			}
		tile.ctx.putImageData(id, 0, 0);
		const tex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: tile as unknown as PIXI.ICanvas, scaleMode: 'linear' }) });
		return { key, tex, canvas: tile, cellPx: s, exact, soft, measured: null };
	}
	/** the tile for a face whose LEDs are `px` renderer pixels (`exact`: whole ones), made once per look and size */
	private tileFor(px: number, soft: boolean, exact: boolean): GrilleTile {
		const Gd = LED_BOARD.grid;
		const key = `${exact ? Math.round(px) : 'mip'}|${soft ? 1 : 0}|${Gd.shape}|${gridFill()}|${Gd.rowScale}`;
		let t = this.tiles.get(key);
		if (!t) this.tiles.set(key, (t = this.makeGrille(soft, px, exact, key)));
		return t;
	}

	// ---- THE PLACE ------------------------------------------------------------------------------------------------------------
	/** the place for the screen as it is now; a change of the dots across rebuilds the faces. `pieces`: the scene's pieces the
	 *  snow cover is cut from (road px) */
	layout(g: ScoreboardGeo, pieces: CoverPiece[]) {
		this.geo0 = g;
		this.pieces = pieces;
		// (the faces for the place and the renderer's resolution now; the same grid in a new place is only placed again)
		const before = this.geo;
		if (!this.ensureFaces() && this.geo && this.geo === before) this.applyGeo(this.geo);
	}
	/** the place `g` (the layout's, with its faces laid out by the smallest dot rule) on the faces as they are: the layouts'
	 *  per board numbers, the faces' and the housings' places, the dim, the catcher, the snow cover */
	private applyGeo(g: ScoreboardGeo) {
		this.geo = g;
		this.boardNumbers(g, this.back!.F, this.faceRuled && this.back!.F.k === 1);
		this.placeFace(this.strip!, g.strip.face);
		this.placeFace(this.back!, g.back.face);
		this.drawHousing(this.stripHousing, g, g.strip.housing, g.strip.face, g.strip.cap);
		this.drawHousing(this.backHousing, g, g.back.housing, g.back.face, g.back.cap);
		this.dim.position.set(g.dim.x, g.dim.y);
		this.dim.width = g.dim.w;
		this.dim.height = g.dim.h;
		this.catcher.position.set(0, 0);
		this.catcher.width = g.W;
		this.catcher.height = g.H;
		this.buildCover(g, this.pieces);
		this.place();
	}
	/** the layouts' per board numbers for place `g` and a back face of `B`'s dots (the live face, or a grid made ahead) */
	private boardNumbers(g: ScoreboardGeo, B: { dotsW: number; dotsH: number }, dotRows: boolean) {
		// (the dot font step, LED_BOARD.pitch.dotRowCap: only on faces the smallest dot rule placed at one LED per layout dot)
		setRowDots(dotRows);
		// the back board's title knobs are per layout class (constants LED_BOARD.titles)
		setBoardClass(g.cls);
		// (the back board's dot pitch: the Total Win ladder's label floor, LED_BOARD.sizeD.ladderLabelMinCss)
		setBoardPitch(g.back.face.w / Math.max(1, B.dotsW));
		// (board size d on desktop and tablet: the press screen's figure may grow with the face, LED_BOARD.sizeD)
		setScreenScaleMax((g.cls === 'desktop' || g.cls === 'tablet') && LED_BOARD.size === 'd' ? LED_BOARD.sizeD.pressScaleMax : 6);
		// (the press screen's face screen keeps its line above the rows the strip's snow cap covers at its highest bump, as
		// this file's drawHousing draws the cap: LED_SIGN.face)
		setFaceClear((g.back.face.y + g.back.face.h - (g.strip.housing.y - 1.3 * g.strip.cap)) / (g.back.face.h / Math.max(1, B.dotsH)));
	}
	/** a draw for another grid (a grid made ahead): the layouts' per board numbers set for it, and put back after, whatever
	 *  the draw does (a warm draw stops with a throw) */
	private withGrid(g: ScoreboardGeo, draw: () => void) {
		const pitch = boardPitchNow();
		const scale = screenScaleMaxNow();
		const clear = faceClearNow();
		const cls = this.geo?.cls ?? g.cls;
		const dots = rowDotsNow();
		this.boardNumbers(g, g.back.face, !!g.led?.ruled && g.led.back.k === 1);
		try {
			draw();
		} finally {
			setRowDots(dots);
			setBoardClass(cls);
			setBoardPitch(pitch);
			setScreenScaleMax(scale);
			setFaceClear(clear);
		}
	}

	/** THE PLACE WITH ITS FACES LAID OUT FOR THE RENDERER'S RESOLUTION (constants LED_BOARD.pitch; layout.ts ledPitchGeo): made
	 *  again only when the place, the resolution or the rule's own numbers change (every frame: a few comparisons) */
	private ruleFor(ratio: number): ScoreboardGeo | null {
		const g0 = this.geo0;
		if (!g0) return null;
		const P = LED_BOARD.pitch;
		const K = LED_BOARD.density;
		const stamp = (P.on ? 1 : 0) + P.desktopCss * 3 + P.phoneCss * 7 + (P.snap ? 11 : 0) + P.minPx * 13 + (P.words === 'auto' ? 17 : P.words * 19) + P.stripMinRows * 23 + P.miniShort * 29 + (K.on ? 31 : 0) + K.k * 37 + K.minDevicePx * 41;
		if (this.ruled && this.ruledFrom === g0 && this.ruledRatio === ratio && this.ruledStamp === stamp) return this.ruled;
		this.ruled = ledPitchGeo(g0, ratio);
		this.ruledFrom = g0;
		this.ruledRatio = ratio;
		this.ruledStamp = stamp;
		return this.ruled;
	}

	/** THE FACES FOR THE PLACE, THE RESOLUTION AND THE RULE NOW: both rebuilt together when the dots across or down or the
	 *  words' density change (the window's size, the renderer's resolution, the tune panel), so the two faces never show two
	 *  densities and no canvas of the old one is kept. A SHOW THAT IS UP IS NEVER REBUILT IN ONE FRAME (2026-11-22, constants
	 *  LED_BOARD.warm.regrid): the faces keep their dots, stretched to the new place, while the show is drawn ahead on scratch
	 *  faces of the new grid a little each frame (regridHolds, warmStep); the board changes to the new grid once that is
	 *  done, drawing from the caches. Returns whether the faces were rebuilt. Called by layout() and on every frame (numbers
	 *  only: nothing is allocated unless something changed). */
	private ensureFaces(): boolean {
		const g = this.ruleFor(this.deviceRatio());
		if (!g) return false;
		const L = g.led!;
		const k = L.back.k;
		const soft = k > 1 && LED_BOARD.density.softDot;
		const Gd = LED_BOARD.grid;
		const exactB = L.back.snapped && Math.abs(L.back.px - Math.round(L.back.px)) < 1e-6;
		const exactS = L.strip.snapped && Math.abs(L.strip.px - Math.round(L.strip.px)) < 1e-6;
		this.grilleNow();
		const sw = g.strip.face.dotsW;
		const sh = g.strip.face.dotsH;
		const bw = g.back.face.dotsW;
		const bh = g.back.face.dotsH;
		const key = `${sw}x${sh}|${bw}x${bh}|${k}`;
		const tileKey = `${exactB ? Math.round(L.back.px) : 'mip'}|${exactS ? Math.round(L.strip.px) : 'mip'}|${soft ? 1 : 0}|${Gd.shape}|${gridFill()}|${Gd.rowScale}`;
		const S = this.strip;
		const B = this.back;
		if (S && B && key === this.faceKey && tileKey === this.tileKey) {
			if (g !== this.geo) this.applyGeo(g);
			// (a snapped face sits at a whole multiple of the device px: placed again when the resolution changes)
			else if (Gd.snap && this.deviceRatio() !== this.placedRatio) {
				this.placeFace(S, g.strip.face);
				this.placeFace(B, g.back.face);
			}
			return false;
		}
		if (S && B && key !== this.faceKey && this.regridHolds(g, key)) {
			if (g !== this.geo) this.applyGeo(g);
			return false;
		}
		this.destroyFace(this.strip);
		this.destroyFace(this.back);
		this.faceK = k;
		// (a card made ahead for the grid before, still to come up, is made again for this one, a little each frame)
		if (key !== this.faceKey) for (const j of this.warmJobs) if (j.state === 'done' && !j.used && j.kind !== 'regrid') this.warmAgain(j);
		this.faceKey = key;
		this.tileKey = tileKey;
		this.faceRuled = L.ruled;
		this.strip = this.makeFace(sw, sh, k, this.tileFor(L.strip.px, soft, exactS));
		this.back = this.makeFace(bw, bh, k, this.tileFor(L.back.px, soft, exactB));
		// (the tiles no face shows any more)
		for (const [tk, t] of this.tiles)
			if (t !== this.strip.tile && t !== this.back.tile) {
				t.tex.destroy(true);
				this.tiles.delete(tk);
			}
		this.stripRoot.addChild(this.strip.root);
		this.backRoot.addChild(this.back.root);
		this.stepAt = -1;
		this.mark('density', `${k} LEDs per dot (${this.faceKey}; ${Math.round(L.back.css * 100) / 100} CSS px a dot, the strip ${Math.round(L.strip.css * 100) / 100}${L.ruled ? '' : ', no smallest dot rule'})`);
		this.applyGeo(g);
		return true;
	}
	/** A SHOW THAT IS UP HOLDS THE GRID while it is made ahead for the new one: true while the board should keep its faces
	 *  (the job is queued or running, within LED_BOARD.warm.regridMaxMs of real time); false: change now (no show up, the
	 *  job done or failed, or it took too long). One job at a time, for the newest grid asked for. */
	private regridHolds(g: ScoreboardGeo, key: string): boolean {
		const W = LED_BOARD.warm;
		const s = this.show;
		let j = this.warmJobs.find((x) => x.kind === 'regrid' && !x.used);
		const up = W.on && W.regrid && !!s && s.t < s.exitAt;
		if (j && (!up || j.grid!.key !== key || j.live !== s)) {
			if (j.state === 'queued' || j.state === 'running') this.warmEnd(j, 'dropped', up ? 'another grid or show' : 'no show up');
			j.used = true;
			j = undefined;
		}
		if (!up) return false;
		if (!j) {
			// (the finished ones: the last six kept for the readout, as prepare keeps them)
			const old = this.warmJobs.filter((x) => x.state !== 'queued' && x.state !== 'running');
			if (old.length > 6) {
				const drop = new Set(old.slice(0, old.length - 6));
				this.warmJobs = this.warmJobs.filter((x) => !drop.has(x));
			}
			this.warmJobs.push({ kind: 'regrid', req: null, grid: { geo: g, key }, live: s, show: null, back: null, strip: null, faceKey: '', times: [], order: [], next: 0, coarseDone: false, madeAt: new Map(), state: 'queued', why: '', samples: 0, made: 0, ms: 0, frames: 0, maxFrameMs: 0, queuedAt: performance.now(), doneAt: null, used: false });
			this.mark('regrid', `${this.faceKey} to ${key}: the ${s!.kind} show is made ahead first`);
			return true;
		}
		if (j.state === 'queued' || j.state === 'running') {
			if (performance.now() - j.queuedAt <= W.regridMaxMs) return true;
			this.warmEnd(j, 'dropped', 'took too long');
		}
		j.used = true;
		return false;
	}
	/** a finished job put back in the queue (its card is still to come and the grid changed) */
	private warmAgain(j: WarmJob) {
		j.state = 'queued';
		j.why = 'the grid changed';
		j.faceKey = '';
		j.next = 0;
		j.samples = 0;
		j.coarseDone = false;
		j.doneAt = null;
		j.madeAt.clear();
	}

	/** THE SCENE SWAP'S PICTURE (game/scene/sceneSnapshot.ts): the cover's containers (drawn into the picture as they are),
	 *  the layer the picture's cover rectangle is shown in, and that rectangle (global px; null: no cover drawn) */
	snapshotParts(): { keep: PIXI.Container[]; layer: PIXI.Container; rect: PIXI.Rectangle | null } {
		let rect: PIXI.Rectangle | null = null;
		for (const c of [this.coverA, this.coverB]) {
			if (!c.visible || !c.renderable || !c.children.length) continue;
			const b = c.getBounds().rectangle;
			if (b.width <= 0 || b.height <= 0) continue;
			rect = rect ? rect.enlarge(b) : b.clone();
		}
		return { keep: [this.coverA, this.coverB], layer: this.coverSnap, rect };
	}

	/** the back board's sprite box (its housing with the cap and the padding above it), CSS px, seated */
	private backBox(): Rect {
		const g = this.geo!;
		const Hs = g.back.housing;
		const padX = g.f * 1.2;
		const padTop = g.back.cap * 1.4;
		return { x: Hs.x - padX, y: Hs.y - padTop, w: Hs.w + 2 * padX, h: Hs.h + padTop };
	}
	/** how far below its seat the fully lowered board sits: its top 4 px under the strip's top (the strip hides it) */
	private downD(): number {
		const g = this.geo!;
		return g.strip.housing.y + 4 - this.backBox().y;
	}

	/** THE SNOW COVER: the scene's own pieces cropped to the cover's rectangles (sub-frames of the loaded textures) */
	private buildCover(g: ScoreboardGeo, pieces: CoverPiece[]) {
		const coverA = this.coverA;
		const coverB = this.coverB;
		const frames = this.coverFrames;
		for (const c of [coverA, coverB]) c.removeChildren().forEach((s) => s.destroy());
		for (const t of frames.splice(0)) t.destroy(false);
		const { ox, oy, k } = g.road;
		for (const c of [coverA, coverB]) {
			c.position.set(ox, oy);
			c.scale.set(k);
		}
		const bb = this.backBox();
		const x0 = bb.x - 2;
		const x1 = bb.x + bb.w + 2;
		const top = g.strip.housing.y;
		// coverA: from the strip's top to the dim's bottom edge (dimmed with the scene); coverB: from there to the screen's
		// bottom (under the HUD, never dimmed)
		const split = Math.max(top, Math.min(g.H + 4, g.dim.y + g.dim.h));
		const rects: [PIXI.Container, number, number][] = [
			[coverA, top, split],
			[coverB, split, g.H + 4],
		];
		for (const [cont, ya, yb] of rects) {
			if (yb - ya < 0.5) continue;
			// the rectangle in road px
			const r = { l: (x0 - ox) / k, t: (ya - oy) / k, r: (x1 - ox) / k, b: (yb - oy) / k };
			for (const P of pieces) {
				const src = P.tex.source;
				const sx = src.width / P.w;
				const sy = src.height / P.h;
				const cells: [number, number][] = [];
				if (P.tile) {
					for (let j = Math.floor((r.t - P.y) / P.h); P.y + j * P.h < r.b; j++) for (let i = Math.floor((r.l - P.x) / P.w); P.x + i * P.w < r.r; i++) cells.push([P.x + i * P.w, P.y + j * P.h]);
				} else cells.push([P.x, P.y]);
				for (const [px, py] of cells) {
					const il = Math.max(r.l, px);
					const it = Math.max(r.t, py);
					const ir = Math.min(r.r, px + P.w);
					const ib = Math.min(r.b, py + P.h);
					if (ir - il <= 0.01 || ib - it <= 0.01) continue;
					const frame = new PIXI.Rectangle((il - px) * sx, (it - py) * sy, (ir - il) * sx, (ib - it) * sy);
					const t = new PIXI.Texture({ source: src, frame });
					frames.push(t);
					const s = new PIXI.Sprite(t);
					s.eventMode = 'none';
					s.position.set(il, it);
					s.width = ir - il;
					s.height = ib - it;
					cont.addChild(s);
				}
			}
		}
		this.coverTintFor = -1;
	}

	private makeFace(dotsW: number, dotsH: number, k: number, tile: GrilleTile): GpuFace {
		const F = makeFaceCanvases(dotsW, dotsH, k);
		// (the halo at half the face's size in DOTS at any density: the glow keeps its size and cost)
		const halo = mk(Math.ceil(dotsW / 2), Math.ceil(dotsH / 2));
		const tex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: F.out as unknown as PIXI.ICanvas, scaleMode: 'nearest' }) });
		const haloTex = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: halo as unknown as PIXI.ICanvas, scaleMode: 'linear' }) });
		const root = new PIXI.Container();
		root.eventMode = 'none';
		const unlit = new PIXI.Sprite(PIXI.Texture.WHITE);
		unlit.tint = col(C.unlit);
		const content = new PIXI.Sprite(tex);
		const grille = new PIXI.Container();
		// (the lit dots over the grille: the same texture, one more sprite; shown only with LED_BOARD.grid.litOver above 0)
		const litOver = new PIXI.Sprite(tex);
		litOver.visible = false;
		const glow = new PIXI.Sprite(haloTex);
		glow.blendMode = 'add';
		const sheen = new PIXI.Sprite(this.sheenTex);
		root.addChild(unlit, content, grille, litOver, glow, sheen);
		// one grille sprite per CELLS x CELLS LEDs
		const n = GRILLE.cells;
		const s = tile.cellPx;
		for (let j = 0; j < F.ledH; j += n)
			for (let i = 0; i < F.ledW; i += n) {
				const cw = Math.min(n, F.ledW - i);
				const ch = Math.min(n, F.ledH - j);
				const t = cw === n && ch === n ? tile.tex : new PIXI.Texture({ source: tile.tex.source, frame: new PIXI.Rectangle(0, 0, cw * s, ch * s) });
				const sp = new PIXI.Sprite(t);
				sp.label = `${i},${j},${cw},${ch}`;
				grille.addChild(sp);
			}
		return { F, tile, halo, tex, haloTex, root, unlit, content, glow, grille, litOver, sheen, key: '', switchAt: -1e9, switchKind: null };
	}
	/** the grid as built (the probe): the knobs, the tile's dot measured through its middle (where the plate is under half
	 *  strength, as a share of the pitch, across and down), whether the soft dot is in, the lit over sprite */
	gridInfo() {
		const T = this.back?.tile ?? null;
		if (T && !T.measured) {
			const s = T.cellPx;
			const d = T.canvas.ctx.getImageData(0, 0, s, s).data;
			let across = 0;
			let down = 0;
			const m = s >> 1;
			for (let i = 0; i < s; i++) {
				if (d[(m * s + i) * 4 + 3] < 128) across += 1;
				if (d[(i * s + m) * 4 + 3] < 128) down += 1;
			}
			// (and the hole's open share of its cell: the plate's strength over the whole cell, taken from 1)
			let plate = 0;
			for (let i = 3; i < d.length; i += 4) plate += d[i];
			T.measured = { across: across / s, down: down / s, open: Math.round((1 - plate / (255 * s * s)) * 1000) / 1000 };
		}
		return { ...LED_BOARD.grid, fill: gridFill(), soft: T?.soft ?? false, measured: T?.measured ?? null, tilePx: T?.cellPx ?? null, tileExact: T?.exact ?? false, stripTilePx: this.strip?.tile.cellPx ?? null, litOverShown: !!this.back?.litOver.visible, grilleAlpha: this.back?.grille.alpha ?? null, unlitTint: this.back ? this.back.unlit.tint : null };
	}
	/** THE GRID'S LIVE KNOBS (LED_BOARD.grid): the unlit quad's color, the gaps' darkness (the grille's alpha); numbers only */
	private grilleNow() {
		const Gd = LED_BOARD.grid;
		const tint = Gd.unlit ? col(C.unlit) : 0x08090c;
		for (const G of [this.strip, this.back]) {
			if (!G) continue;
			if (G.unlit.tint !== tint) G.unlit.tint = tint;
			G.grille.alpha = Gd.gapDark;
		}
	}
	private placeFace(G: GpuFace, r0: Rect) {
		// (LED_BOARD.grid.snap: the face at a whole number of device px per LED, centred on its place: it moves under a pixel)
		let r = r0;
		const ratio = this.deviceRatio();
		this.placedRatio = ratio;
		// (a face the smallest dot rule placed is already whole LEDs on whole pixels)
		if (LED_BOARD.grid.snap && G.F.k > 1 && !this.geo?.led?.ruled) {
			const ps = Math.max(1, Math.round((r0.w * ratio) / G.F.ledW));
			const w = (G.F.ledW * ps) / ratio;
			const h = (G.F.ledH * ps) / ratio;
			r = { x: Math.round((r0.x + (r0.w - w) / 2) * ratio) / ratio, y: Math.round((r0.y + (r0.h - h) / 2) * ratio) / ratio, w, h };
		}
		for (const s of [G.unlit, G.content, G.litOver, G.glow, G.sheen]) {
			s.position.set(r.x, r.y);
			s.width = r.w;
			s.height = r.h;
		}
		// (the LED pitch: the face's width over its LEDs across)
		const px = r.w / G.F.ledW;
		const py = r.h / G.F.ledH;
		for (const sp of G.grille.children as PIXI.Sprite[]) {
			const [i, j, cw, ch] = sp.label.split(',').map(Number);
			sp.position.set(r.x + i * px, r.y + j * py);
			sp.width = cw * px;
			sp.height = ch * py;
		}
	}
	private destroyFace(G: GpuFace | null) {
		if (!G) return;
		// (the grille's corner frames first: the root's destroy empties its children)
		for (const sp of G.grille.children as PIXI.Sprite[]) if (sp.texture !== G.tile.tex) sp.texture.destroy(false);
		G.root.destroy({ children: true });
		G.tex.destroy(true);
		G.haloTex.destroy(true);
	}

	/** the housing (the mock's housingSprite, as Graphics: vector, sharp at any size): body, recess, bolts, icicles, cap */
	private drawHousing(g: PIXI.Graphics, G: ScoreboardGeo, Hs: Rect, face: Rect, capH: number) {
		g.clear();
		const f = G.f;
		const ol = G.ol;
		const rnd = (i: number) => {
			const x = Math.sin((i * 3.7 + 11) * 127.1 + 311.7) * 43758.5453;
			return x - Math.floor(x);
		};
		const OUT = 0x12161c;
		const line = { width: ol, color: OUT, join: 'round' as const, cap: 'round' as const };
		g.roundRect(Hs.x, Hs.y, Hs.w, Hs.h, f * 0.45).fill(0x2f3b4a).stroke(line);
		g.roundRect(Hs.x + f * 0.28, Hs.y + f * 0.28, Hs.w - f * 0.56, Hs.h - f * 0.56, f * 0.3).stroke({ width: Math.max(1.2, ol * 0.45), color: 0x4a5a6d });
		g.rect(face.x, face.y, face.w, face.h).fill(col(C.base));
		g.rect(face.x - 1, face.y - 1, face.w + 2, face.h + 2).stroke({ width: Math.max(1.5, ol * 0.7), color: 0x0a0d12 });
		const br = Math.max(1.5, f * 0.16);
		for (const [bx, by] of [
			[Hs.x + f * 0.5, Hs.y + Hs.h - f * 0.5],
			[Hs.x + Hs.w - f * 0.5, Hs.y + Hs.h - f * 0.5],
		])
			g.circle(bx, by, br).fill(0x8b99a9).stroke({ width: Math.max(1, ol * 0.5), color: OUT });
		const x0 = Hs.x - f * 0.5;
		const x1 = Hs.x + Hs.w + f * 0.5;
		const baseY = Hs.y + f * 0.2;
		const nI = Math.round((x1 - x0) / (f * 1.25));
		for (let i = 0; i < nI; i++) {
			const x = x0 + f * 0.9 + ((x1 - x0 - f * 1.8) * (i + rnd(i) * 0.6)) / nI;
			const yT = baseY + capH * 0.1;
			const len = Math.min(face.y - 3 - yT, f * (0.55 + rnd(i + 40) * 0.6));
			const wI = f * (0.26 + rnd(i + 80) * 0.14);
			if (len < 2) continue;
			g.poly([x - wI / 2, yT - 2, x + wI / 2, yT - 2, x + wI * 0.08, yT + len]).fill(0xdff3ff).stroke({ width: Math.max(1, ol * 0.6), color: OUT, join: 'round' });
		}
		const cap = (lift: number) => {
			g.moveTo(x0, baseY - lift);
			g.quadraticCurveTo(x0 - capH * 0.15, Hs.y - capH * 0.35, x0 + capH * 0.5, Hs.y - capH * 0.55);
			const n = Math.max(4, Math.round((x1 - x0 - capH) / (capH * 2.2)));
			const bw = (x1 - x0 - capH) / n;
			for (let i = 0; i < n; i++) {
				const xa = x0 + capH * 0.5 + bw * i;
				g.quadraticCurveTo(xa + bw / 2, Hs.y - capH * (0.95 + rnd(i + 7) * 0.35), xa + bw, Hs.y - capH * (0.5 + rnd(i + 21) * 0.15));
			}
			g.quadraticCurveTo(x1 + capH * 0.15, Hs.y - capH * 0.3, x1, baseY - lift);
			const m = Math.max(5, Math.round((x1 - x0) / (capH * 1.3)));
			const sw = (x1 - x0) / m;
			for (let i = m - 1; i >= 0; i--) {
				const xb = x0 + sw * i;
				g.quadraticCurveTo(xb + sw / 2, baseY - lift + capH * (0.08 + rnd(i + 60) * 0.22), xb, baseY - lift);
			}
			g.closePath();
		};
		cap(0);
		g.fill(0xc9def2);
		cap(capH * 0.3);
		g.fill(0xf7fbff);
		cap(0);
		g.stroke(line);
	}

	// ---- THE SHOWS --------------------------------------------------------------------------------------------------------------
	/** a win on the scoreboard. Resolves when the round may go on: at once for a small win (never waited for), else when the
	 *  hold is over (the board then powers down and lowers on its own) */
	win(o: WinRequest): Promise<void> {
		if (!LED_BOARD.on) return Promise.resolve();
		const s = newShow(o);
		this.start(s);
		if (s.kind === 'small') return Promise.resolve();
		return new Promise<void>((resolve) => {
			// a safety net: the round never waits on a stalled ticker (a hidden tab, a lost context) for longer than twice the
			// show plus 4 s of real time (a slow device's frames still play the whole show first)
			const timer = setTimeout(() => this.release(s.id), s.exitAt * 2 + 4000);
			this.waits.set(s.id, { resolve, timer });
		});
	}
	private start(s: Show) {
		// THE STRIP'S PRIORITY ORDER (2026-11-17, constants LED_BOARD.stripOrder): the spin's win amount is above the Grandma
		// line, so a small win shows at once over the gag (the gag keeps its own clock under it: nothing queues); it never
		// takes the place of a card or a big win that is still up (they are higher: it is dropped)
		const up = this.show;
		if (s.kind === 'small' && up && up.kind !== 'small' && up.t < up.exitAt) {
			this.mark('small', `dropped: ${up.kind} is up (higher)`);
			return;
		}
		if (up && up.kind === 'press' && s.kind !== 'press' && up.t < up.exitAt && !this.pressWait) {
			this.pressSuspended = true;
			this.mark('press', `suspended under ${s.kind}`);
		}
		if (this.pendingSmall) {
			this.mark('small', `dropped: ${s.kind} ${s.final}`);
			this.pendingSmall = null;
		}
		const old = this.show;
		if (old) {
			endShow(old);
			this.release(old.id);
			if (old.arrive && old.t < old.end) this.lowering = old;
		}
		if (s.arrive) {
			// (2026-11-17) the gag never plays with the back board up: a bonus entry, a Total Win, a Mega and up cut it
			this.cutGag(`the back board is up (${s.kind})`);
			// the back board is taken over from wherever it is
			const owner = this.lowering;
			const D = this.geo ? this.downD() : 0;
			s.fromD = owner ? Math.max(-D, Math.min(D, backOffset(owner, D, this.geo?.back.sc ?? 1))) : D;
			this.lowering = null;
		} else if (s.kind === 'win') this.cutGag('a win on the strip'); // a Big or Super message on the strip cuts the gag short
		this.show = s;
		this.mark('show', `${s.kind} ${s.final} ${s.arrive ? 'back' : 'strip'}`);
		// (a card made ahead is let go as it comes up: what it made is in the caches; the readout keeps how far it got)
		const sw = this.smallWarm;
		if (s.kind === 'small' && sw && sw.state === 'running') this.smallEnd(sw, 'dropped', 'the small win came up first');
		const job = isCard(s) ? this.warmJobs.find((j) => j.kind === s.kind && !j.used && (j.state === 'queued' || j.state === 'running' || j.state === 'done')) : undefined;
		const smallState = !sw || sw.amount !== s.finalStr ? 'none' : sw.state === 'done' ? 'done' : `${sw.state} ${sw.samples}/${sw.times.length}`;
		this.marks.push({ kind: s.kind, id: s.id, at: performance.now(), warm: s.kind === 'small' ? smallState : !isCard(s) ? '-' : !job ? 'none' : job.state === 'done' ? 'done' : `${job.state} ${job.samples}/${job.order.length || job.times.length}` });
		if (this.marks.length > 40) this.marks.splice(0, this.marks.length - 40);
		if (job) job.used = true;
		if (job && job.state !== 'done') this.warmEnd(job, 'dropped', 'the card came up first');
		this.onBeat?.('start', s);
	}
	private release(id: number) {
		const w = this.waits.get(id);
		if (!w) return;
		clearTimeout(w.timer);
		this.waits.delete(id);
		w.resolve();
	}
	/** THE SKIP (a press while it counts, or holds): lands the count, or ends the hold */
	skip(): boolean {
		const s = this.show;
		if (!s || s.kind !== 'win') return false;
		const ok = skipShow(s);
		if (ok) this.mark('skip', phaseOf(s));
		return ok;
	}
	/** a win counts or holds now (the press catcher is up, the HUD's WIN is lit) */
	busy(): boolean {
		const s = this.show;
		return !!s && s.kind === 'win' && s.t < s.exitAt;
	}
	/** THE ROUND'S TAIL (ui/controls.svelte.ts): a Spin press after the round's board settled lands the strip's small count
	 *  on its amount at once (it then ends on its own, or the new round's press cuts it); true when it took */
	landSmall(): boolean {
		const s = this.show;
		if (!s || s.kind !== 'small' || s.t >= s.countEnd) return false;
		s.countEnd = Math.max(s.t, s.countStart);
		this.mark('land', 'small win: a Spin press in the round\'s tail');
		return true;
	}
	/** a win's count still running on the board (a big win's or the strip's small message), board ms left; 0 when none */
	countLeft(): number {
		const s = this.show;
		if (!s || (s.kind !== 'win' && s.kind !== 'small')) return 0;
		return Math.max(0, s.countEnd - s.t);
	}
	/** A NEW SPIN'S PRESS: the Grandma gag and a small win are cut short (a big win is never up at a press: it holds the round) */
	spinPress() {
		this.cutGag('a new spin');
		if (this.scat && !this.scat.live) {
			this.mark('scatter', 'cut: a new spin');
			this.scat = null;
		}
		if (this.pendingSmall) {
			this.pendingSmall = null;
			this.mark('small', 'dropped: a new spin');
		}
		const s = this.show;
		if (s && s.kind === 'small') {
			endShow(s);
			this.mark('cut', 'small win: a new spin');
		}
	}

	// ---- THE BONUS ROUND'S CARDS ON THE BACK BOARD (part B) ----------------------------------------------------------------------
	/** the Free Spins entry, the Super entry or the Total Win rises and waits; the card's own press lands it (cardPress) and
	 *  its dismissal ends it (endCard). Nothing waits on the board: the card (ui/RoundCard.svelte) keeps the round. */
	card(o: CardRequest) {
		if (!LED_BOARD.on) return;
		this.start(newCardShow(o));
	}
	/** THE CARDS MADE AHEAD (constants LED_BOARD.warm; warmGate.ts): cards the book holds and that are still to come (the
	 *  entry from the trigger spin's reveal, the Total Win from the round's start), each as card() will be asked for it.
	 *  Each is drawn ahead of time on a scratch face, a little each frame (warmStep), so the pictures it needs are made before
	 *  it comes up. A card asked for again replaces its job; nothing waits on a job and a card never waits for one. */
	prepare(list: CardRequest[]) {
		if (!LED_BOARD.on || !LED_BOARD.warm.on) return;
		for (const req of list) {
			for (const j of this.warmJobs) if (j.kind === req.kind && (j.state === 'queued' || j.state === 'running')) this.warmEnd(j, 'dropped', 'asked for again');
			this.warmJobs.push({ kind: req.kind, req, grid: null, live: null, show: null, back: null, strip: null, faceKey: '', times: [], order: [], next: 0, coarseDone: false, madeAt: new Map(), state: 'queued', why: '', samples: 0, made: 0, ms: 0, frames: 0, maxFrameMs: 0, queuedAt: performance.now(), doneAt: null, used: false });
		}
		// (the finished ones: the last six kept for the readout)
		const old = this.warmJobs.filter((j) => j.state !== 'queued' && j.state !== 'running');
		if (old.length > 6) {
			const drop = new Set(old.slice(0, old.length - 6));
			this.warmJobs = this.warmJobs.filter((j) => !drop.has(j));
		}
	}
	/** THE SMALL WIN MADE AHEAD (LED_BOARD.warm.small; components/Board.svelte asks as a line win starts, with the very request
	 *  its strip total will make when the lights call for it): drawn ahead on a scratch strip face in the frames before it
	 *  comes up, within the same budget as a card (it goes first: it is due soonest). Nothing waits on it; the real small win
	 *  draws exactly as it always did, from the caches. */
	prepareSmall(o: WinRequest) {
		const W = LED_BOARD.warm;
		if (!LED_BOARD.on || !W.on || !W.small) return;
		const s = newShow({ ...o, small: true });
		// the steps that make pictures first: its first steps (the layout, the title, the amount's ink, its glyphs), the landed
		// amount, the reindeer's eight hop frames and its sparkles; then every LED step of the count (the digits on the way)
		const step = 1000 / Math.max(1, LED_BOARD.fps);
		// (and two steps before the count: the steady 0 shown until it starts is kept made the second time it is drawn)
		const times = [1, Math.max(2, s.countStart / 2), s.countStart + 1, s.countEnd];
		for (let i = 0; i < 8; i++) times.push(s.countEnd + 1 + i * 66);
		for (let t = s.countStart + step; t < s.countEnd; t += step) times.push(t);
		if (this.smallWarm?.state === 'running') this.smallEnd(this.smallWarm, 'dropped', 'asked for again');
		this.smallWarm = { show: s, times, next: 0, state: 'running', why: '', samples: 0, made: 0, ms: 0, frames: 0, maxFrameMs: 0, amount: s.finalStr };
	}
	private smallEnd(w: SmallWarm, state: SmallWarm['state'], why: string) {
		w.state = state;
		w.why = why;
		this.mark('warm', `small ${state}: ${why} (${w.samples} samples, ${w.made} made, ${Math.round(w.ms)} ms over ${w.frames} frames)`);
	}
	/** the small win's share of the frame's budget: true when it used the frame (the cards wait for the next) */
	private smallWarmStep(budget: number): boolean {
		const w = this.smallWarm;
		if (!w || w.state !== 'running' || !this.strip) return false;
		const S = this.strip.F;
		const key = this.faceKey;
		if (!this.smallFace || this.smallFace.key !== key) this.smallFace = { key, F: makeFaceCanvases(S.dotsW, S.dotsH, S.k) };
		const F = this.smallFace.F;
		const t0 = performance.now();
		w.frames += 1;
		while (w.next < w.times.length) {
			const left = budget - (performance.now() - t0);
			if (left <= 0) break;
			const r = warmRun(left, () => {
				for (const c of [F.out, F.a, F.b]) {
					c.ctx.globalAlpha = 1;
					c.ctx.globalCompositeOperation = 'source-over';
				}
				F.out.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
				clearTitle(F.out.ctx.canvas);
				clearIdeas(F.out.ctx.canvas);
				w.show.t = w.times[w.next];
				showSmall(F, w.show);
			});
			w.made += r.misses;
			if (r.error) {
				w.ms += performance.now() - t0;
				this.smallEnd(w, 'failed', String((r.error as Error)?.message ?? r.error).slice(0, 120));
				return true;
			}
			if (!r.done) break;
			w.samples += 1;
			w.next += 1;
		}
		const ms = performance.now() - t0;
		w.ms += ms;
		w.maxFrameMs = Math.max(w.maxFrameMs, ms);
		if (w.next >= w.times.length) this.smallEnd(w, 'done', 'every sample drawn');
		return true;
	}
	/** a job's scratch faces and samples, for the faces as they are now */
	private warmSetup(job: WarmJob) {
		const W = LED_BOARD.warm;
		const step = 1000 / Math.max(1, LED_BOARD.fps);
		const every = Math.max(1, Math.round(W.coarseEvery));
		job.next = 0;
		job.coarseDone = false;
		job.madeAt.clear();
		job.times = [];
		if (job.grid) {
			// A GRID MADE AHEAD: scratch faces of the new grid, the show that is up (a copy: its clock is set per sample) from
			// its clock now to tailMs past its press line or count (the press screen: once round its screens)
			const G = job.grid.geo;
			const k = G.led?.back.k ?? 1;
			job.back = makeFaceCanvases(G.back.face.dotsW, G.back.face.dotsH, k);
			job.strip = makeFaceCanvases(G.strip.face.dotsW, G.strip.face.dotsH, k);
			job.faceKey = job.grid.key;
			const live = job.live!;
			const s = (job.show = { ...live });
			const t0 = live.t;
			const end = s.kind === 'press' ? t0 + pressCycleMs() : Math.min(s.exitAt, Math.max(t0, s.pressLineAt ?? s.countEnd) + Math.max(0, W.tailMs));
			for (let t = t0; t <= end; t += step) job.times.push(t);
			if (!job.times.length) job.times.push(t0);
		} else {
			const B = this.back!.F;
			const S = this.strip!.F;
			job.back = makeFaceCanvases(B.dotsW, B.dotsH, B.k);
			job.strip = makeFaceCanvases(S.dotsW, S.dotsH, S.k);
			job.faceKey = this.faceKey;
			const s = (job.show = newCardShow(job.req!));
			// the card's clock at each LED step from the rise (the face is drawn from the first step the board shows) to tailMs past
			// its press line (the explanation's wipe and page, the landing's blink and fireworks)
			const end = (s.pressLineAt ?? s.countEnd) + Math.max(0, W.tailMs);
			for (let t = LED_BOARD.rise.backAtMs + 1; t <= end; t += step) job.times.push(t);
		}
		job.order = job.times.map((_, i) => i).filter((i) => i % every === 0 || i === job.times.length - 1);
	}
	/** one sample of a job: the card at its clock `t` on the scratch faces, back board and strip, as update() draws them */
	private warmDraw(job: WarmJob, t: number) {
		const s = job.show!;
		s.t = t;
		for (const F of [job.back!, job.strip!]) {
			for (const c of [F.out, F.a, F.b]) {
				c.ctx.globalAlpha = 1;
				c.ctx.globalCompositeOperation = 'source-over';
			}
			F.out.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
			clearTitle(F.out.ctx.canvas);
			clearIdeas(F.out.ctx.canvas);
		}
		if (!job.grid) {
			this.paintBack(job.back!, s);
			showRibbon(job.strip!, s);
			return;
		}
		// (a grid made ahead: the show as drawStrip and drawBack draw it, with the layouts' numbers of the new grid)
		this.withGrid(job.grid.geo, () => {
			if (s.arrive) this.paintBack(job.back!, s);
			const F = job.strip!;
			if (s.kind === 'press') showPressLine(F, s.t, this.pressReady, this.pressText?.ticker ?? '');
			else if (isCard(s)) showRibbon(F, s);
			else if (s.arrive && s.t < s.contentAt) return;
			else if (s.kind === 'small') showSmall(F, s);
			else {
				showWin(F, s);
				if (!s.arrive) stripFlourish(F, s);
			}
		});
	}
	/** a job ends: its scratch faces and show are let go (the readout keeps its numbers) */
	private warmEnd(job: WarmJob, state: WarmJob['state'], why: string) {
		job.state = state;
		job.why = why;
		job.back = null;
		job.strip = null;
		job.show = null;
		// (a grid made ahead keeps `live`, the show it was made for: regridHolds tells by it whose grid this is)
		job.doneAt ??= performance.now();
		this.mark('warm', `${job.kind} ${state}: ${why} (${job.samples} samples, ${job.made} made, ${Math.round(job.ms)} ms over ${job.frames} frames)`);
	}
	/** THE FRAME'S SHARE OF A CARD MADE AHEAD: the first job still to do, sample by sample, until the frame's budget
	 *  (LED_BOARD.warm.budgetMs less what this frame's own LED step took) is spent; a sample stopped at a picture to make
	 *  is tried again next frame. The coarse steps first, then the steps beside any coarse one that still made something. */
	private warmStep(spentMs: number) {
		const W = LED_BOARD.warm;
		if (!W.on || !this.back || !this.strip) return;
		const budget = W.budgetMs - spentMs;
		if (budget <= 0.25) return;
		// (a grid made ahead for the show that is up goes first: the board waits on it; then a small win made ahead: it
		// comes up within a second or so, a card later)
		const regrid = this.warmJobs.find((j) => j.kind === 'regrid' && (j.state === 'queued' || j.state === 'running'));
		if (!regrid && this.smallWarmStep(budget)) return;
		const job = regrid ?? this.warmJobs.find((j) => j.state === 'queued' || j.state === 'running');
		if (!job) return;
		const t0 = performance.now();
		if (job.faceKey !== (job.grid ? job.grid.key : this.faceKey) || !job.back) this.warmSetup(job);
		job.state = 'running';
		job.frames += 1;
		const every = Math.max(1, Math.round(W.coarseEvery));
		for (;;) {
			if (job.next >= job.order.length) {
				if (job.coarseDone) break;
				// the steps beside every coarse sample that still made something
				job.coarseDone = true;
				const coarse = new Set(job.order);
				const fine = new Set<number>();
				for (const c of job.order)
					if ((job.madeAt.get(c) ?? 0) > 0)
						for (let d = 1; d < every; d++) for (const i of [c - d, c + d]) if (i >= 0 && i < job.times.length && !coarse.has(i)) fine.add(i);
				job.order.push(...[...fine].sort((a, b) => a - b));
				continue;
			}
			const left = budget - (performance.now() - t0);
			if (left <= 0) break;
			const i = job.order[job.next];
			const r = warmRun(left, () => this.warmDraw(job, job.times[i]));
			job.made += r.misses;
			job.madeAt.set(i, (job.madeAt.get(i) ?? 0) + r.misses);
			if (r.error) {
				const ms = performance.now() - t0;
				job.ms += ms;
				this.warmEnd(job, 'failed', String((r.error as Error)?.message ?? r.error).slice(0, 120));
				return;
			}
			if (!r.done) break;
			job.samples += 1;
			job.next += 1;
		}
		const ms = performance.now() - t0;
		job.ms += ms;
		job.maxFrameMs = Math.max(job.maxFrameMs, ms);
		if (job.coarseDone && job.next >= job.order.length) this.warmEnd(job, 'done', 'every sample drawn');
	}
	/** DEV / probe: the cards made ahead (queued, running, the last finished) */
	warmInfo() {
		const now = performance.now();
		return this.warmJobs.map((j) => ({ kind: j.kind, state: j.state, why: j.why, samples: j.samples, of: j.order.length, steps: j.times.length, made: j.made, ms: Math.round(j.ms * 10) / 10, frames: j.frames, maxFrameMs: Math.round(j.maxFrameMs * 10) / 10, agoMs: Math.round(now - j.queuedAt), tookMs: j.doneAt === null ? null : Math.round(j.doneAt - j.queuedAt), used: j.used, amount: j.req?.amount ?? 0, spins: j.req?.spins ?? 0, grid: j.grid?.key ?? null }));
	}
	/** DEV / probe: the small win made ahead last (null: none asked for) */
	smallWarmInfo() {
		const w = this.smallWarm;
		return w ? { state: w.state, why: w.why, amount: w.amount, samples: w.samples, of: w.times.length, made: w.made, ms: Math.round(w.ms * 10) / 10, frames: w.frames, maxFrameMs: Math.round(w.maxFrameMs * 10) / 10 } : null;
	}
	/** DEV / probe: the last shows as they came up (performance.now()) and how far their card's warm had got */
	showMarks(): ShowMark[] {
		return this.marks.map((m) => ({ ...m }));
	}
	/** a press on the card: true when it landed the scene (the card stays up), false when the press should continue */
	cardPress(): boolean {
		const s = this.show;
		if (!s || !isCard(s)) return false;
		const ok = landCard(s);
		if (ok) this.mark('land', `${s.kind} at ${Math.round(s.t)}`);
		return ok;
	}
	/** the card's scene has landed: up, and a Total Win's count done (true when no card plays here: the HTML card shows its
	 *  amount at once). ui/RoundCard.svelte holds an autoplayed wrap-up from this moment (ROUND.wrapAutoHoldMs). */
	cardLanded(): boolean {
		const s = this.show;
		if (!s || !isCard(s)) return true;
		return s.t >= s.contentAt && s.t >= s.countEnd;
	}
	/** THE TOTAL WIN'S OWN COUNT (2026-11-21, the bar's WIN odometer, ui/hud/winOdometer.ts): the Total Win card while it is
	 *  the board's show, else null. Its clock (t), its count's start and end (a press that lands it, landCard, or its end,
	 *  endShow, moves countEnd to the moment) and its amount: the HUD's WIN readout reads it each frame and never keeps a
	 *  timer of its own. Read only. */
	totalCount(): Readonly<Pick<Show, 'id' | 't' | 'countStart' | 'countEnd' | 'exitAt' | 'amount' | 'skipped' | 'capped'>> | null {
		const s = this.show;
		return s && s.kind === 'total' ? s : null;
	}
	/** the card was dismissed: the board powers down and lowers */
	endCard() {
		const s = this.show;
		if (!s || !isCard(s)) return;
		endShow(s);
		this.mark('card', `${s.kind} ends at ${Math.round(s.t)}`);
	}
	// ---- THE PRESS SCREEN ON THE EXPANDED BOARD (2026-11-17, Corey approved) ------------------------------------------------
	/** the press screen: the back board rises and stays up with the dim, the explainer screens cycle on it, the strip says
	 *  PRESS ANYWHERE TO CONTINUE once the gate is open (pressGate). false: no scoreboard (the caller keeps the old sign) */
	press(text: LedText): boolean {
		if (!LED_BOARD.on) return false;
		this.pressText = text;
		this.start(newPressShow(scoreboardDev.fmt));
		return true;
	}
	/** the press gate is open or not (components/Board.svelte, every frame: boot.pressReady) */
	pressGate(ready: boolean) {
		if (ready !== this.pressReady) {
			this.pressReady = ready;
			if (this.pressUp()) this.mark('press', ready ? 'the line shows' : 'the line waits');
		}
	}
	/** the strip shows a press line on its last drawn step: the press screen's (once its gate is open) or a card's (from its
	 *  press line's time) */
	pressLineShown(): boolean {
		const s = this.show;
		if (this.stripNow !== 'entry' || !s || s.t >= s.exitAt) return false;
		if (s.kind === 'press') return this.pressReady;
		return s.pressLineAt !== null && s.t >= s.pressLineAt;
	}
	/** the press screen is up */
	pressUp(): boolean {
		const s = this.show;
		return !!s && s.kind === 'press' && s.t < s.exitAt;
	}
	/** THE PRESS: the board powers down and lowers with the game's own motion, the dim lifts. Resolves as it starts to lower
	 *  (the game's chrome may come up); onPressGone follows when it is down. */
	endPress(): Promise<void> {
		// (a card raised by hand over the press screen: the press ends it and the press screen does not come back)
		if (this.pressSuspended) {
			this.pressSuspended = false;
			const c = this.show;
			if (c && c.kind !== 'press') endShow(c);
			this.mark('press', 'ended under a card raised by hand');
		}
		const s = this.show;
		if (!s || s.kind !== 'press' || s.t >= s.exitAt) return Promise.resolve();
		endShow(s);
		this.mark('press', `ends at ${Math.round(s.t)}`);
		return new Promise<void>((resolve) => {
			// a safety net: a stalled ticker never holds the game's entry for more than the power down and lowering twice + 1 s
			const R = LED_BOARD.rise;
			const timer = setTimeout(() => this.releasePress(), (R.powerDownMs + R.lowerMs) * 2 + 1000);
			this.pressWait = { id: s.id, resolve, timer };
		});
	}
	private releasePress() {
		const w = this.pressWait;
		if (!w) return;
		this.pressWait = null;
		clearTimeout(w.timer);
		w.resolve();
	}

	/** DEV / probe: the back board and the strip not drawn (the scene swap probe looks at the scene, the dim and the snow
	 *  cover alone while it steps a fade) */
	devSceneOnly(on: boolean) {
		this.backRoot.renderable = !on;
		this.stripRoot.renderable = !on;
	}
	/** THE SCENE SWAP'S GATE (game/scene/sceneSwap.ts): a bonus entry card's back board is on its way up and not yet
	 *  seated (the swap in waits for it, so the scene changes under the seated board and the full dim) */
	entryRising(): boolean {
		const s = this.show;
		return !!s && (s.kind === 'fs' || s.kind === 'sfs') && s.t < seatedAt();
	}
	/** THE SCENE SETTING'S GATE (dark mode, components/Board.svelte): the back board is up or on its way up or down (a bonus
	 *  entry, a Total Win, a big win, the race): a change of the scene set waits until it is down */
	backBusy(): boolean {
		return !!this.backShow();
	}
	/** (2026-11-18) THE BACK BOARD'S SEATED BOX while it is up at all (rising, seated or lowering; the press screen's
	 *  expanded board included), CSS px, or null when it is down: the roaming reindeer's keep-out (components/Board.svelte) */
	/** the back board is up at all (no allocation: read every frame by the roaming reindeer's zone watch) */
	backUp(): boolean {
		return !!this.geo && this.backRoot.visible;
	}
	backZone(): { x: number; y: number; w: number; h: number } | null {
		if (!this.geo || !this.backRoot.visible) return null;
		const b = this.backBox();
		return { x: b.x, y: b.y, w: b.w, h: this.geo.strip.housing.y - b.y };
	}
	/** the card up now (its kind), for the HTML card and the probe */
	cardUp(): string | null {
		const s = this.show;
		return s && isCard(s) && s.t < s.exitAt ? s.kind : null;
	}

	// ---- THE GRANDMA GAG ----------------------------------------------------------------------------------------------------------
	private gagOn() {
		return this.gagAt !== null && this.clock - this.gagAt < this.gagMs();
	}
	/** `short`: the one screen line (autoplay, a bonus round, turbo: constants LED_BOARD.gagShortIn), else the full line */
	gag(short = false) {
		if (!LED_BOARD.on || !LED_BOARD.gag.on) return;
		// (2026-11-17) none while the back board is up (an entry, a Total Win, a tier win)
		const up = this.show;
		if (up && up.arrive && up.t < up.end) {
			this.mark('gag', `refused: the back board is up (${up.kind})`);
			return;
		}
		// (2026-11-18) a bonus round plays the line at most gagPerBonus times
		if (this.free) {
			if (this.bonusGags >= LED_BOARD.gagPerBonus) {
				this.mark('gag', `refused: ${this.bonusGags} already this bonus round`);
				return;
			}
			this.bonusGags += 1;
		}
		this.gagAt = this.clock;
		this.gagShort = short;
		this.mark('gag', short ? 'start short' : 'start');
	}
	/** the gag's length: the full line's, or the short line's */
	private gagMs() {
		return this.gagShort ? LED_BOARD.gag.short.ms : LED_BOARD.gag.ms;
	}
	private cutGag(why: string) {
		if (this.gagAt === null) return;
		if (this.clock - this.gagAt < this.gagMs()) this.mark('gag', `cut: ${why}`);
		this.gagAt = null;
	}
	/** the small win that waited for the gag starts now, from its own beginning */
	private startPending() {
		const s = this.pendingSmall;
		if (!s) return;
		this.pendingSmall = null;
		s.t = 0;
		this.mark('small', 'after the gag');
		this.start(s);
	}
	private gagT(): number | null {
		if (this.gagAt === null) return null;
		const t = this.clock - this.gagAt;
		if (t >= this.gagMs()) {
			this.gagAt = null;
			this.mark('gag', 'end');
			this.startPending();
			return null;
		}
		return t;
	}

	// ---- THE TUNE PANEL AND THE DEV HOOK ----------------------------------------------------------------------------------------
	/** raise the back board with a demo win of `x` play multiples that holds until lower() (no round waits on it) */
	raise(x = 98.75) {
		const bet = scoreboardDev.bet();
		const s = newShow({ x: Math.max(x, LED_BOARD.tiers[LED_BOARD.backFromTier].bar), amount: Math.round(x * bet * 100) / 100, bet, fmt: scoreboardDev.fmt, rate: 1, auto: false });
		s.exitAt = 1e12;
		s.end = 1e12;
		this.start(s);
	}
	lower() {
		const s = this.show;
		if (s && s.arrive) endShow(s);
	}
	/** play the race now (null: its own draw; a result: that result) */
	race(force: RaceOutcome | null = null) {
		this.cartoonState.raceNext = newRace(force);
		this.cartoon = cartoons().findIndex((c) => c.key === 'race');
		this.cartoonAt = this.clock;
		this.cartoonState.race = null;
	}

	// ---- THE FRAME ----------------------------------------------------------------------------------------------------------------
	/** DEV: `ms` of the scoreboard's time by hand (manual mode), drawn at once */
	step(ms: number) {
		const m = this.manual;
		this.manual = false;
		this.stepAt = -1;
		this.update(ms, this.env);
		this.manual = m;
	}

	update(dtMs: number, env: ScoreboardEnv) {
		this.env = env;
		if (this.manual) return;
		if (!this.geo || !this.strip || !this.back) return;
		// THE FINER GRID'S RULE on every frame (the renderer's resolution settles after a resize; the tune panel): a change
		// rebuilds both faces in place
		this.ensureFaces();
		// real ms (a slow device keeps the show's length); a stall (a hidden tab) counts as at most a quarter second
		const dt = Math.min(250, Math.max(0, dtMs));
		this.clock += dt;
		if (this.show) this.show.t += dt;
		if (this.lowering) this.lowering.t += dt;
		// the bonus round's counter: its number, and when it changed (the reindeer dashes across)
		if (env.free !== this.free) {
			this.free = env.free;
			this.left = env.left;
			this.bonusGags = 0;
			// (2026-11-17) the spins left show as a bonus round starts (the strip's order: their first window)
			if (env.free) this.leftAt = this.clock;
		}
		if (env.free && env.left !== this.left) {
			this.left = env.left;
			this.leftAt = this.clock;
		}
		// the gag's end (a small win waiting for it starts on this step, not on the next drawn one)
		if (this.pendingSmall && !this.gagOn()) this.gagT();
		this.updateScatter(this.devScatter !== undefined ? this.devScatter : (env.scatter ?? null));
		const s = this.show;
		if (s) {
			// each tier's moment once, on the step the count reaches it (a skip's final tier lands at the skip's moment)
			for (const e of s.events)
				if (e.at <= s.t && !s.fired.has(e.tier)) {
					s.fired.add(e.tier);
					this.mark('tier', `${e.tier} at ${Math.round(s.t)}`);
					this.onTier?.(e.tier, s);
				}
			if (s.t >= s.exitAt) this.release(s.id);
			if (s.t >= s.end) {
				this.onBeat?.('gone', s);
				this.show = null;
			}
		}
		// the press screen's hand over (the board has powered down) and its end (the board is down)
		const pw = this.pressWait;
		if (pw) {
			const ps = this.show?.id === pw.id ? this.show : this.lowering?.id === pw.id ? this.lowering : null;
			if (!ps || ps.t >= ps.exitAt + LED_BOARD.rise.powerDownMs) this.releasePress();
		}
		if (this.lowering && this.lowering.t >= this.lowering.end) this.lowering = null;
		// the press screen back after a card raised over it by hand has gone
		if (this.pressSuspended && this.pressText && !this.show && !this.lowering) {
			this.pressSuspended = false;
			this.start(newPressShow(scoreboardDev.fmt));
			this.mark('press', 'back after the card');
		}
		if (this.pressText && !this.pressSuspended && !this.pressWait && !this.pressUp() && this.show?.kind !== 'press' && this.lowering?.kind !== 'press') {
			this.pressText = null;
			this.mark('press', 'gone');
			this.onPressGone?.();
		}
		this.place();
		// the dots' content: re-drawn and re-sent at LED_BOARD.fps (an LED controller's refresh), not every frame
		const step = Math.floor((this.clock * LED_BOARD.fps) / 1000);
		if (step === this.stepAt) {
			this.warmStep(0);
			return;
		}
		this.stepAt = step;
		const t0 = performance.now();
		this.drawStrip();
		if (this.backRoot.visible) this.drawBack();
		// (a hidden back board draws nothing: its last step's idea records go with it, so a read while it is down never
		// reports the scene before; the probe host, 2026-11-20: the Super tease's red presents read on a Free Spins rise)
		else if (this.back) clearIdeas(this.back.F.out.ctx.canvas);
		const drawn = performance.now() - t0;
		this.cost.drawMs = Math.round(drawn * 100) / 100;
		this.cost.steps += 1;
		// a card made ahead, in what is left of the frame's share (LED_BOARD.warm.budgetMs)
		this.warmStep(drawn);
	}

	/** THE SCATTER COUNT (constants LED_BOARD.scatterCount): it starts when the road says the spin is in anticipation, ticks
	 *  up with each present seen, and when the anticipation is over plays its fireworks (a trigger) or clears quietly */
	private updateScatter(r: ScatterRead | null) {
		const K = LED_BOARD.scatterCount;
		let c = this.scat;
		if (r && r.live && K.on) {
			if (!c || c.id !== r.id) {
				c = this.scat = { id: r.id, count: r.count, need: r.need, at: this.clock, tickAt: this.clock, fwAt: null, live: true, hit: false, endAt: Infinity };
				this.mark('scatter', `count ${r.count} of ${r.need}`);
			} else if (c.live) {
				if (r.count > c.count) {
					c.tickAt = this.clock;
					this.mark('scatter', `tick ${r.count} of ${r.need}`);
				}
				c.count = r.count;
				c.need = r.need;
			}
		} else if (c && c.live) {
			// the anticipation is over (the last car seen, the deciding present seen, a slam stop): the presents seen in the end
			const same = !!r && r.id === c.id;
			if (same && r!.count > c.count) c.tickAt = this.clock;
			if (same) c.count = r!.count;
			c.live = false;
			c.hit = same ? r!.hit : false;
			if (c.hit) {
				// the count shows the trigger made: the highest trigger the presents reached
				c.need = r!.reached || c.count;
				c.fwAt = this.clock;
				c.endAt = this.clock + K.fireworksMs;
				this.mark('scatter', `hit ${c.count} of ${c.need}: fireworks`);
			} else {
				c.endAt = this.clock;
				this.mark('scatter', `miss ${c.count}: cleared`);
			}
		}
		if (this.scat && !this.scat.live && this.clock >= this.scat.endAt) this.scat = null;
	}
	private scatterOn() {
		const c = this.scat;
		return !!c && (c.live || this.clock < c.endAt);
	}

	/** the board's owner: the show up now if it uses the back board, else the one still lowering */
	private backShow(): Show | null {
		if (this.show?.arrive) return this.show;
		return this.lowering;
	}
	/** the back board's place, the dim, the catcher */
	private place() {
		const g = this.geo;
		if (!g) return;
		const D = this.downD();
		const bs = this.backShow();
		const y = bs ? backOffset(bs, D, g.back.sc) : D;
		// THE SHAKE (the mock's shakeAt): a back board show shakes the road, the logo and the back board, the strip stays; a
		// strip win shakes the road and the strip. The snow cover moves with the road (it is cut from the road's pictures).
		const cur = this.show;
		const sh = cur && cur.t < cur.end ? shakeAt(cur, cur.arrive ? g.back.sc : (g.f / 22) * 1.6) : 0;
		this.shakeY = Math.abs(sh) < 0.05 ? 0 : sh;
		this.backRoot.y = y + (cur?.arrive && bs === cur ? this.shakeY : 0);
		this.stripRoot.y = cur && !cur.arrive ? this.shakeY : 0;
		this.coverA.y = g.road.oy + this.shakeY;
		this.coverB.y = g.road.oy + this.shakeY;
		this.coverSnap.y = this.shakeY;
		this.backRoot.visible = !!bs && y < D - 0.25;
		const da = dimAlpha(bs);
		this.dim.alpha = da;
		this.dim.visible = da > 0.002;
		if (Math.abs(da - this.coverTintFor) > 0.004) {
			this.coverTintFor = da;
			const v = Math.round(255 * (1 - da));
			const tint = (v << 16) | (v << 8) | v;
			for (const c of this.coverA.children as PIXI.Sprite[]) c.tint = tint;
		}
		const busy = this.busy();
		this.catcher.visible = busy;
		this.catcher.eventMode = busy ? 'static' : 'none';
	}

	/** THE SUPER WHEEL'S LINE on the strip (null takes it down) */
	wheelLine(text: string | null, tone: 'gold' | 'white' = 'gold', blink = false) {
		this.wheelMsg = text === null ? null : { text, tone, blink };
		this.mark('wheel', text ?? 'off');
	}
	/** the wheel's line as it stands (the probe) */
	wheelLineNow(): WheelLine | null {
		return this.wheelMsg ? { ...this.wheelMsg } : null;
	}

	/** WHAT IS TRUE NOW for the strip (constants LED_BOARD.stripOrder; game/scoreboard/stripArbiter.ts). Each writer only says
	 *  whether it has something to show; the arbiter picks. `gt`: the gag's time (null: none). */
	private stripTruth(gt: number | null): StripTruth {
		const s = this.show;
		const up = !!s && s.t < s.exitAt;
		// a bonus round's spins left: for spinsLeftMs after the count changes (and as the round starts), then the last counterMs
		// of every cycleMs after that
		const C = LED_BOARD.counterBreak;
		const sinceLeft = this.clock - this.leftAt;
		const after = sinceLeft - LED_BOARD.spinsLeftMs;
		// (2026-11-18) no idle content in a bonus round: the spins left are the strip's resting state there
		const bonusRest = this.free && !LED_BOARD.bonusIdle;
		// (the resting state is under everything that may play: the Grandma line, the one item ranked under it, still shows)
		const spinsLeft = this.free && (bonusRest ? gt === null : after < 0 || (C.on && after % C.cycleMs >= C.cycleMs - C.counterMs));
		const idle = this.env.idle ?? !this.free;
		const raceUp = cartoons()[this.cartoon % cartoons().length].key === 'race';
		return {
			entry: up && (isCard(s) || s!.kind === 'press'),
			wheel: this.wheelMsg !== null,
			bigWin: up && s!.kind === 'win',
			scatter: this.scatterOn(),
			winAmount: up && s!.kind === 'small',
			spinsLeft,
			gag: gt !== null,
			cartoon: !bonusRest && (!raceUp || !idle),
			race: !bonusRest && raceUp && idle,
		};
	}

	private drawStrip() {
		const G = this.strip!;
		const F = G.F;
		clearTitle(F.out.ctx.canvas);
		clearIdeas(F.out.ctx.canvas);
		const s = this.show;
		let key: string;
		const gt = this.gagT();
		// THE ARBITER (2026-11-17): the highest true item in LED_BOARD.stripOrder
		const truth = this.stripTruth(gt);
		let item = pickStrip(truth);
		// NO FLASHING IN A BONUS ROUND (LED_BOARD.bonusHoldMs): down to a lower item only bonusHoldMs after the last change,
		// while the item up now is still true (a higher one cuts in at once)
		const order = LED_BOARD.stripOrder;
		if (this.free && item !== this.stripNow && order.indexOf(item) > order.indexOf(this.stripNow) && truth[this.stripNow] && this.clock - this.stripAt < LED_BOARD.bonusHoldMs) item = this.stripNow;
		if (item !== this.stripNow) {
			this.mark('strip', `${item} (was ${this.stripNow})`);
			this.stripAt = this.clock;
		}
		this.stripNow = item;
		this.truthNow = truth;
		if (item === 'entry' || item === 'bigWin' || item === 'winAmount') {
			// a card's line on the strip (the press line and the sentences), a big win (the tier and the counting amount; blank
			// while the back board rises, as the mock's ribbon), the spin's win amount
			if (s!.kind === 'press') showPressLine(F, s!.t, this.pressReady, this.pressText?.ticker ?? '');
			else if (isCard(s)) showRibbon(F, s!);
			else if (s!.arrive && s!.t < s!.contentAt) F.out.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
			else if (s!.kind === 'small') showSmall(F, s!);
			else {
				showWin(F, s!);
				if (!s!.arrive) stripFlourish(F, s!);
			}
			key = `show${s!.id}`;
		} else if (item === 'wheel') {
			showWheelLine(F, this.devWheelSteady ? { ...this.wheelMsg!, blink: false } : this.wheelMsg!, this.clock);
			key = 'wheel';
		} else if (item === 'scatter') {
			showScatterCount(F, this.scat!, this.clock);
			key = `scatter${this.scat!.id}`;
		} else if (item === 'spinsLeft') {
			showCounter(F, this.clock, Math.max(0, this.left), this.leftAt);
			key = 'counter';
		} else if (item === 'gag') {
			if (this.gagShort) showGagShort(F, gt!);
			else showGag(F, gt!);
			key = `gag${this.gagAt}`;
		} else {
			const want = LED_BOARD.cartoon;
			const pinned = want === 'auto' ? -1 : cartoons().findIndex((c) => c.key === want);
			if (pinned >= 0 && pinned !== this.cartoon) {
				this.cartoon = pinned;
				this.cartoonAt = this.clock;
			}
			const list = cartoons();
			let idx = this.cartoon % list.length;
			if (this.clock - this.cartoonAt > list[idx].ms()) {
				this.cartoon = pinned >= 0 ? pinned : (idx + 1) % list.length;
				this.cartoonAt = this.clock;
			}
			// THE RACE ONLY AT TRUE IDLE: away from it the cartoons go on to the next one (a race under way is cut)
			idx = this.cartoon % list.length;
			let draw = this.cartoon;
			if (item === 'cartoon' && list[idx].key === 'race') {
				if (pinned >= 0) draw = 0; // (the tune panel pinned the race: the first cartoon stands in for it away from idle)
				else {
					this.mark('race', 'skipped: not at true idle');
					this.cartoon = draw = (idx + 1) % list.length;
					this.cartoonAt = this.clock;
					this.cartoonState.race = null;
				}
			}
			showCartoonNow(F, draw, this.clock - this.cartoonAt, this.cartoonState, this.cartoonAt);
			key = `cartoon${this.cartoon}@${pinned >= 0 ? this.cartoonAt : ''}`;
		}
		// THE STRIP'S OWN SWITCH: to a message by LED_BOARD.effects.stripSwitch (a dissolve since 2026-11-20; 'scan' is today's
		// line), a dissolve back to the cartoons
		if (G.key !== key) {
			if (G.key) {
				G.switchAt = this.clock;
				G.switchKind = /^(show|gag|scatter)/.test(key) && LED_BOARD.effects.stripSwitch === 'scan' ? 'scan' : 'dissolve';
			}
			G.key = key;
		}
		const since = this.clock - G.switchAt;
		if (G.switchKind === 'scan' && since < LED_BOARD.strip.switchMs) {
			const o = F.out.ctx;
			// (in LEDs: the line one dot wide, running LED by LED across the face's LEDs)
			const W = F.ledW;
			const u = ledN(F.k, 1);
			const x = Math.round((since / LED_BOARD.strip.switchMs) * W);
			// (M4, 2026-11-19: the new message is cleared from the old one's side of the line first; it used to be drawn under
			// the old picture there, so the two read as one, "$9.10EFT", for the whole scan)
			clearP(o, x + u, 0, W - x - u, F.ledH);
			copyP(o, F.prev, x + u, 0, W - x - u, F.ledH);
			clearP(o, x, 0, u, F.ledH);
			o.fillStyle = '#fff';
			fillP(o, x, 0, u, F.ledH);
		} else if (G.switchKind === 'dissolve' && since < LED_BOARD.strip.dissolveMs) {
			F.b.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
			copyFace(F.b.ctx, F.out);
			F.a.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
			copyFace(F.a.ctx, F.prev);
			dissolveFace(F, since / LED_BOARD.strip.dissolveMs);
		} else {
			// the last clean picture, kept for the next switch
			F.prev.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
			copyFace(F.prev.ctx, F.out);
		}
		// the face's moving effects (LED_BOARD.effects): the border glint; the light band only if switched back on
		borderGlint(F, this.clock / 1000);
		if (LED_BOARD.effects.band) shimmer(F.out.ctx, F.dotsW, F.dotsH, this.clock / 1000);
		this.publish(G, 1);
	}

	private drawBack() {
		const G = this.back!;
		const F = G.F;
		const s = this.backShow();
		F.out.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
		clearTitle(F.out.ctx.canvas);
		clearIdeas(F.out.ctx.canvas);
		if (!s) return this.publish(G, 1);
		this.paintBack(F, s);
		this.publish(G, brightOf(s));
	}
	/** THE BACK BOARD'S PICTURE of show `s` on face `F` (its records cleared first): the real face each step, and a card made
	 *  ahead on its scratch face (warmStep), the same code for both */
	private paintBack(F: Face, s: Show) {
		// the press screen's explainer screens (2026-11-17), else the show's staged scene
		clearExplain(F.out.ctx.canvas);
		const X = LED_BOARD.explain;
		const sup = s.kind === 'sfs';
		const explains = X.on && s.pressLineAt !== null && s.t >= s.pressLineAt && s.t < s.exitAt && (s.kind === 'fs' || sup || (s.kind === 'total' && !!s.line));
		if (s.kind === 'press' && this.pressText) pressScreensLit(F, Math.max(0, s.t - s.contentAt) / 1000, this.pressText);
		else if (explains) {
			// THE EXPLANATION ON THE BIG BOARD (2026-11-18, LED_BOARD.explain): from the READY beat (a wrap-up: its landing)
			const head = s.kind === 'total' ? { kind: 'total' as const, title: s.title ?? 'TOTAL WIN', amount: s.finalStr, color: '#ffffff' } : { kind: 'entry' as const, count: String(s.spins), title: sup ? 'SUPER FREE SPINS' : 'FREE SPINS', color: sup ? '#ffd23a' : '#ffffff' };
			const sentence = s.kind === 'total' ? s.line! : INTRO_LINE[sup ? 'super' : 'bonus'];
			const border = sup ? ['#ff3a2e', '#ffd23a'] : s.kind === 'total' ? ['#36ff74', '#ff3a2e'] : ['#36ff74', '#ffffff', '#ff3a2e', '#ffffff'];
			showExplain(F, s.t - s.pressLineAt!, (f) => this.backProgram(f, s), head, sentence, sup || s.kind === 'total' ? '#ffd23a' : '#ffffff', border);
		} else this.backProgram(F, s);
		// the face powers on as it seats (dark until just before, then LED_BOARD.effects.powerOn: its LEDs coming on at random
		// since 2026-11-20, today's scan line by the knob), and powers down before it lowers
		const seated = LED_BOARD.rise.backAtMs + LED_BOARD.rise.riseMs;
		if (s.t < seated - 120) F.out.ctx.clearRect(0, 0, F.dotsW, F.dotsH);
		else powerOnFace(F, s.t - (seated - 120));
		if (s.t > s.exitAt) powerOffFace(F, Math.min(1, (s.t - s.exitAt) / LED_BOARD.rise.powerDownMs));
		borderGlint(F, this.clock / 1000);
		if (LED_BOARD.effects.band) shimmer(F.out.ctx, F.dotsW, F.dotsH, this.clock / 1000);
	}

	/** the dots to the GPU: the face's picture, and its half size halo */
	private publish(G: GpuFace, bright: number) {
		const h = G.halo.ctx;
		h.clearRect(0, 0, G.halo.width, G.halo.height);
		h.imageSmoothingEnabled = true;
		h.drawImage(G.F.out, 0, 0, G.halo.width, G.halo.height);
		G.tex.source.update();
		G.haloTex.source.update();
		G.content.alpha = bright;
		G.glow.alpha = LED_BOARD.halo * bright;
		const lo = LED_BOARD.grid.litOver;
		G.litOver.visible = lo > 0;
		G.litOver.alpha = lo * bright;
		this.cost.uploadBytes = (G.F.ledW * G.F.ledH + G.halo.width * G.halo.height) * 4;
	}

	private mark(what: string, detail?: string) {
		this.log.push({ at: Math.round(this.clock), what, detail });
		if (this.log.length > 200) this.log.splice(0, this.log.length - 200);
	}

	// ---- DEV / PROBES -----------------------------------------------------------------------------------------------------------
	/** the GPU bytes this system holds: both faces and their halos, the grille tile with its mips, the sheen (the cover adds
	 *  none: it is frames of textures the scene already holds) */
	gpuBytes(): number {
		const face = (G: GpuFace | null) => (G ? (G.F.ledW * G.F.ledH + G.halo.width * G.halo.height) * 4 : 0);
		let grille = 0;
		for (const t of this.tiles.values()) grille += Math.round(t.canvas.width * t.canvas.height * 4 * (t.exact ? 1 : 4 / 3));
		return face(this.strip) + face(this.back) + grille + 32 * 32 * 4;
	}
	/** DEV / probe: a face's picture as drawn on the last step: its lit LEDs and a hash of its pixels (png: the LEDs too, a
	 *  data URL of the face at one pixel per LED, for the probe's frame strips). W and H are the face in dots (every record
	 *  is in dots); k its LEDs per dot, ledW x ledH its LEDs, `dots` its LED count */
	faceStats(which: 'strip' | 'back', png = false) {
		const G = which === 'strip' ? this.strip : this.back;
		if (!G) return null;
		const F = G.F;
		const d = F.out.ctx.getImageData(0, 0, F.ledW, F.ledH).data;
		let lit = 0;
		let h = 2166136261;
		for (let i = 0; i < d.length; i++) {
			if ((i & 3) === 3 && d[i] > 40) lit += 1;
			h = Math.imul(h ^ d[i], 16777619);
		}
		// the title as drawn this step (the back board), the entry's wait as drawn (the strip)
		return { lit, dots: F.ledW * F.ledH, hash: (h >>> 0).toString(16), W: F.dotsW, H: F.dotsH, k: F.k, ledW: F.ledW, ledH: F.ledH, png: png ? F.out.toDataURL('image/png') : null, explain: explainOf(F.out.ctx.canvas), title: titleOf(F.out.ctx.canvas), titles: titlesOf(F.out.ctx.canvas), entryWait: entryWaitOf(F.out.ctx.canvas), raceCard: raceCardOf(F.out.ctx.canvas), plow: plowOf(F.out.ctx.canvas), riders: ridersOf(F.out.ctx.canvas), ideas: ideasOf(F.out.ctx.canvas), flashes: flashesOf(F.out.ctx.canvas) };
	}
	/** DEV / probe: the dots as built now (snapshot().leds) */
	ledsInfo() {
		const g = this.geo;
		const L = g?.led;
		if (!g || !L || !this.back || !this.strip) return null;
		const r = (v: number) => Math.round(v * 1000) / 1000;
		const face = (G: GpuFace, rect: Rect, grid: { css: number; px: number }) => ({ across: G.F.ledW, down: G.F.ledH, layoutAcross: G.F.dotsW, layoutDown: G.F.dotsH, k: G.F.k, pitchCss: r(rect.w / G.F.ledW), pitchPx: r((rect.w / G.F.ledW) * L.ratio), rulePitchCss: r(grid.css), rulePitchPx: r(grid.px), tilePx: G.tile.cellPx, tileExact: G.tile.exact });
		const job = this.warmJobs.find((j) => j.kind === 'regrid' && !j.used) ?? null;
		const held = `${g.strip.face.dotsW}x${g.strip.face.dotsH}|${g.back.face.dotsW}x${g.back.face.dotsH}|${L.back.k}` !== this.faceKey;
		return { ruled: L.ruled, floorCss: L.floor, ratio: r(L.ratio), key: this.faceKey, back: face(this.back, g.back.face, L.back), strip: face(this.strip, g.strip.face, L.strip), held, regrid: job ? { to: job.grid!.key, state: job.state, samples: job.samples, of: job.order.length, ms: Math.round(job.ms * 10) / 10, frames: job.frames, maxFrameMs: Math.round(job.maxFrameMs * 10) / 10 } : null };
	}
	snapshot() {
		const g = this.geo;
		const r = (v: number) => Math.round(v * 100) / 100;
		const s = this.show;
		const bs = this.backShow();
		const D = g ? this.downD() : 0;
		const gt = this.gagAt === null ? null : this.clock - this.gagAt;
		return {
			on: LED_BOARD.on,
			cls: g?.cls ?? null,
			clock: Math.round(this.clock),
			pitch: g ? r(g.pitch) : null,
			/** THE FINER GRID (LED_BOARD.density): the LEDs per dot of both faces, the LED's pitch (CSS px) and size in device px,
			 *  the renderer's resolution the rule read, and the rule's least device px */
			grid: this.gridInfo(),
			/** THE SMALLEST DOT RULE (constants LED_BOARD.pitch): the dots as built now, per face: the LEDs across and down, the
			 *  layout dots they carry, an LED's pitch in CSS px and in the renderer's pixels; whether the rule placed them, its
			 *  floor, the resolution it read; a grid being made ahead for a show that is up (the faces then still hold the grid
			 *  before, stretched: `held`) */
			leds: this.ledsInfo(),
			density: g ? { k: this.faceK, strip: this.strip?.F.k ?? null, back: this.back?.F.k ?? null, ledPitch: r(g.pitch / this.faceK), devicePx: r((g.pitch * this.deviceRatio()) / this.faceK), ratio: r(this.deviceRatio()), minDevicePx: LED_BOARD.density.minDevicePx, stripLeds: this.strip ? `${this.strip.F.ledW}x${this.strip.F.ledH}` : null, backLeds: this.back ? `${this.back.F.ledW}x${this.back.F.ledH}` : null, faceRoots: { strip: this.stripRoot.children.length - 1, back: this.backRoot.children.length - 1 } } : null,
			strip: g ? { x: r(g.strip.box.x), y: r(g.strip.box.y), w: r(g.strip.box.w), h: r(g.strip.box.h), housingBottom: r(g.strip.housing.y + g.strip.housing.h), dotsW: g.strip.face.dotsW, dotsH: g.strip.face.dotsH, capTop: r(g.strip.housing.y - g.strip.cap * 1.3) } : null,
			back: g
				? {
						housing: { x: r(g.back.housing.x), y: r(g.back.housing.y), w: r(g.back.housing.w), h: r(g.back.housing.h) },
						/** the face, seated (CSS px): board size d puts it on the reel board's box (the probe) */
						face: { x: r(g.back.face.x), y: r(g.back.face.y), w: r(g.back.face.w), h: r(g.back.face.h) },
						dotsW: g.back.face.dotsW,
						dotsH: g.back.face.dotsH,
						offset: r(this.backRoot.y),
						down: r(D),
						visible: this.backRoot.visible,
						/** the housing's bottom edge where it is drawn now, and the strip's top: seated = bottom at strip top + f/2 */
						bottomNow: r(g.back.housing.y + g.back.housing.h + this.backRoot.y),
						topNow: r(this.backBox().y + this.backRoot.y),
						seatBottom: r(g.strip.housing.y + g.f * 0.5),
					}
				: null,
			dim: { alpha: r(this.dim.alpha), rect: g?.dim ?? null },
			hudTop: g ? r(g.hudTop) : null,
			show: s ? { id: s.id, kind: s.kind, final: s.final, finalTier: s.finalTier, arrive: s.arrive, t: Math.round(s.t), phase: phaseOf(s), tier: tierNow(s), amount: s.fmt(amountNow(s)), finalStr: s.finalStr, countStart: Math.round(s.countStart), countEnd: Math.round(s.countEnd), exitAt: Math.round(s.exitAt), end: Math.round(s.end), skipped: s.skipped, seatedAt: seatedAt(), events: s.events.map((e) => ({ ...e, at: Math.round(e.at) })), fired: [...s.fired], sceneT: Math.round(s.t - s.sceneAt), pressLineAt: s.pressLineAt === null ? null : Math.round(s.pressLineAt), spins: s.spins, presents: s.presents, x: s.x, capped: s.capped, maxRace: maxRaceOf(s)?.outcome ?? null, maxRaceAt: maxRaceAtOf(s) } : null,
			pendingSmall: !!this.pendingSmall,
			shake: r(this.shakeY),
			card: this.cardUp(),
			lowering: this.lowering ? { id: this.lowering.id, t: Math.round(this.lowering.t), phase: phaseOf(this.lowering) } : null,
			backOwner: bs?.id ?? null,
			busy: this.busy(),
			stripKey: this.strip?.key ?? null,
			/** the strip's own switch (a scan to a message, a dissolve back): its kind and ms since it started (the probe) */
			stripSwitch: this.strip ? { kind: this.strip.switchKind, since: Math.round(this.clock - this.strip.switchAt) } : null,
			gag: gt === null ? null : { t: Math.round(gt), words: this.gagShort ? LED_BOARD.gag.short.text : gagWordsAt(gt), short: this.gagShort, ms: this.gagMs() },
			/** THE ARBITER (constants LED_BOARD.stripOrder): the item the strip shows on the last drawn step, and what was true */
			press: this.pressText ? { up: this.pressUp(), ready: this.pressReady, screen: s && s.kind === 'press' ? pressScreenAt(Math.max(0, s.t - s.contentAt) / 1000) : null, name: s && s.kind === 'press' ? pressScreenNameAt(Math.max(0, s.t - s.contentAt) / 1000) : null, waiting: !!this.pressWait, wilds: wildsDrawn(), face: faceDrawn() } : null,
			stripPick: { item: this.stripNow, truth: this.truthNow ? { ...this.truthNow } : null },
			scatter: this.scat ? { id: this.scat.id, count: this.scat.count, need: this.scat.need, live: this.scat.live, hit: this.scat.hit, fireworks: this.scat.fwAt !== null && this.clock < this.scat.endAt, words: scatterWordsOf(this.scat), sinceTick: Math.round(this.clock - this.scat.tickAt) } : null,
			cartoon: { index: this.cartoon, key: cartoons()[this.cartoon % cartoons().length].key, t: Math.round(this.clock - this.cartoonAt), race: this.cartoonState.race ? { outcome: this.cartoonState.race.outcome, id: this.cartoonState.race.id } : null },
			free: this.free,
			left: this.left,
			cost: { ...this.cost },
			gpuBytes: this.gpuBytes(),
			/** THE CARDS MADE AHEAD (constants LED_BOARD.warm) */
			warm: this.warmInfo(),
			cover: { a: this.coverA.children.length, b: this.coverB.children.length, snap: this.coverSnap.children.length },
			log: this.log.slice(-40),
		};
	}

	destroy() {
		for (const j of this.warmJobs) if (j.state === 'queued' || j.state === 'running') this.warmEnd(j, 'dropped', 'the board is gone');
		for (const w of this.waits.values()) {
			clearTimeout(w.timer);
			w.resolve();
		}
		this.waits.clear();
		this.destroyFace(this.strip);
		this.destroyFace(this.back);
		this.strip = null;
		this.back = null;
		for (const t of this.coverFrames.splice(0)) t.destroy(false);
		for (const t of this.tiles.values()) t.tex.destroy(true);
		this.tiles.clear();
		this.sheenTex.destroy(true);
		this.root.destroy({ children: true });
		if (scoreboardDev.board === this) scoreboardDev.board = null;
	}
}
