<script lang="ts" module>
	import type { Board as BoardSymbols } from '../game/types';
	import type { LineWinSpec } from '../game/road/roadBoard';
	import type { StrikeSpec } from '../game/road/roadFeatures';
	import type { ColumnTier, HeldColumn } from '../game/typesBookEvent';

	// what the book event handlers ask of the board (game/bookEventHandlerMap.ts, game/actor.ts)
	export type EmitterEventBoard =
		/** put a board up at rest, no motion (boot, a resumed round, a failed play) */
		| { type: 'boardSnap'; board: BoardSymbols }
		/** the press: the old board drives away, and every cloud and column of the spin before leaves */
		| { type: 'boardDriveOut' }
		/** the book's board drives in; resolves when every symbol has settled */
		| { type: 'boardDriveIn'; board: BoardSymbols }
		/** the sticky columns standing at the start of a spin, exactly (none in the base game) */
		| { type: 'boardHeld'; held: HeldColumn[] }
		/** the reindeer runs along the snow above the board, turns down into its target's reel and runs into the target;
		 *  resolves at the impact */
		| { type: 'boardStrike'; strike: StrikeSpec }
		/** the struck car's cell becomes the crash cloud Wild */
		| { type: 'boardGrandmaWild'; cell: number; multiplier: number }
		/** the red box grows to a column Wild and its character steps in; fromCell null = it starts whole. joinAdd: a
		 *  Grandma Wild's multiplier joining the column's number (0 = none) */
		| { type: 'boardColumnWild'; reel: number; tier: ColumnTier; multiplier: number; sticky: boolean; fromCell: number | null; joinAdd: number }
		/** show the winning lines and the amount; resolves when the hold is over */
		| { type: 'boardWinShow'; wins: LineWinSpec[]; amountText: string; multiplier: number }
		| { type: 'boardWinClear' }
		/** pulse cells with no line (the scatters of a trigger); resolves after ms */
		| { type: 'boardPulse'; cells: number[]; ms: number }
		/** a short line over the board; resolves after ms */
		| { type: 'boardMessage'; text: string; ms: number }
		/** a tap on the board during a live spin (ui/controls.svelte.ts hurries it) */
		| { type: 'boardTap' }
		/** the landing screen is going (under the fade's black): its posed board goes, the first board comes up */
		| { type: 'boardLandingEnd' };
</script>

<script lang="ts">
	// THE BOARD: mounts the road (game/road/roadBoard.ts) on the stage, scales it into the layout, ticks it, and
	// passes the book event handlers' requests on. Always mounted (the conditional mount z order trap).
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { stateUrlDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { layoutKind, roadPlacement, boardRect, MASTER } from '../game/layoutSpec';
	import { LINE_WIN, ROAD_MOTION, TUNE } from '../game/constants';
	import { PHONE_TIER } from '../game/deviceTier';
	import { enableMipmaps } from '../game/mipmaps';
	import { ROAD_ART } from '../game/roadArtSpec';
	import { RoadBoard } from '../game/road/roadBoard';
	import { planRun } from '../game/road/roadFeatures';
	import { boardRate, stateGame } from '../game/stateGame.svelte';
	import { clipMemory, setClipRebatch, setClipUploader, setClipView } from '../game/road/columnClips';
	import { loadRunViews, runMemory, setRunMipmapper } from '../game/road/reindeerRun';
	import { loadPresent, presentMemory, presentTrace, setPresentMipmapper } from '../game/road/present';
	import { perfMarks } from '../game/staging';
	import { COLUMN_CLIPS } from '../game/columnClipSpec';
	import { LANDING_POSE, landingColumns } from '../game/landingBoard';

	const context = getContext();
	const parent = getContextParent();

	/** DEV: the board's own time, slowed or frozen from the dev hook (__reindeer.clock) to look at a spin frame by frame.
	 *  Always 1 in a build. */
	const devClock = { rate: 1 };

	const loaded = context.stateApp.loadedAssets as Record<string, PIXI.Texture | undefined>;
	const tex = (frame: string) => loaded[frame];
	const road = new RoadBoard(tex, { road: loaded.road, tunnelLeft: loaded.tunnelLeft, tunnelRight: loaded.tunnelRight });
	road.setBoard(stateGame.board);
	road.onLaneStop = () => context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_reel_stop' });
	// the features' beats, voiced with BORROWED Manticore sounds until this game has its own
	road.features.onBeat = (kind) => context.eventEmitter.broadcast({ type: 'soundOnce', name: kind === 'column' ? 'sfx_sting_big_hit' : 'sfx_sting_hit' });
	// the target crosshair (constants CROSSHAIR): nothing of it shows under SKIP TO RESULT. Its beats (hop, drop, lock,
	// morph) are road.features.onCrosshair, left unset until the game has its own sounds.
	road.features.crosshairOff = () => stateGame.skipping;
	parent.addToParent(road.root);

	// THE LANDING BOARD (game/landingBoard.ts): while the landing screen is up the road shows the posed, still board (the
	// side reels' symbols, the three column Wilds with their top multipliers, the dim). It goes at boardLandingEnd, under
	// the fade's black, before the first board or a resumed round is put up. A replay has no landing.
	const landingSheet = loaded.landingStills;
	if (context.stateLayout.showLoadingScreen && !stateUrlDerived.replay() && landingSheet) {
		road.setBoard(LANDING_POSE);
		road.features.showLanding(landingSheet, COLUMN_CLIPS.landing.tiers[PHONE_TIER ? 'phone' : 'full'].frames, landingColumns());
		road.setLandingDim(true);
	}

	// the road in the layout: road px -> master units (layoutSpec ROAD_LAYOUT) -> canvas px (the main layout's fit).
	// Derived from the window on every change, never cached (the house rule: this is why rotation survives).
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const place = $derived(roadPlacement(kind));
	$effect(() => {
		const masterLeft = main.x - (main.width * main.scale) / 2;
		const masterTop = main.y - (main.height * main.scale) / 2;
		road.layoutKind = kind; // the stoplights hang by their own numbers per layout (constants STOPLIGHT)
		road.features.layoutKind = kind; // and the reindeer runs at its own height in the snow per layout (STRIKE.snow)
		road.root.scale.set(place.scale * main.scale);
		road.root.position.set(masterLeft + place.x * main.scale, masterTop + place.y * main.scale);
	});

	// the board's tap area: a tap during a live spin hurries it, as the Spin press does (ui/controls.svelte.ts boardTap)
	road.root.eventMode = 'static';
	road.root.hitArea = new PIXI.Rectangle(ROAD_ART.board.x, ROAD_ART.laneLines[0], ROAD_ART.board.width, ROAD_ART.laneLines[4] - ROAD_ART.laneLines[0]);
	road.root.on('pointertap', () => context.eventEmitter.broadcast({ type: 'boardTap' }));

	onMount(() => {
		const app = context.stateApp.pixiApplication;
		// a column character's sheet goes to the GPU when it has loaded, not on the frame it is first drawn
		setClipUploader(app ? (texture) => app.renderer.prepare.upload(texture) : null);
		// before a character's sheet is unloaded, every batch is rebuilt (game/road/columnClips.ts release): toggling an
		// empty child's visibility marks the render group's structure as changed, through Pixi's own public setter
		const rebatchNudge = new PIXI.Container();
		road.root.addChild(rebatchNudge);
		setClipRebatch(() => {
			rebatchNudge.visible = false;
			rebatchNudge.visible = true;
		});
		// the staging switch `?rescap=` picks the characters' sheet density from the road's on-screen scale (CSS px per
		// road px) and the GPU's largest texture side (game/road/columnClips.ts); read when a column first loads
		const renderer = app?.renderer as unknown as { gl?: WebGLRenderingContext; gpu?: { device?: { limits?: { maxTextureDimension2D?: number } } } } | undefined;
		const maxTextureSize = renderer?.gl ? Number(renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE)) || 0 : (renderer?.gpu?.device?.limits?.maxTextureDimension2D ?? 0);
		setClipView(() => ({ cssPerRoad: place.scale * main.scale, maxTextureSize }));
		// the desktop atlas is drawn well under its own size on a small window: a mip chain keeps it clean (house rule).
		// The phone atlas draws near 1:1 and stays out.
		if (!PHONE_TIER) enableMipmaps(tex('H1_R')?.source, app?.renderer as PIXI.Renderer | undefined);
		// the present's still sheet (game/assets.ts presentStill) is drawn as small as the atlas: the same chain
		if (!PHONE_TIER) enableMipmaps(tex('presentStill')?.source, app?.renderer as PIXI.Renderer | undefined);
		// THE REINDEER'S RUN VIEWS (game/road/reindeerRun.ts): loaded in the background from now on, never holding up the
		// preload; the desktop sheets are drawn well under their 3x size on most screens, so they get a mip chain too
		if (!PHONE_TIER) setRunMipmapper((source) => enableMipmaps(source, app?.renderer as PIXI.Renderer | undefined));
		void loadRunViews();
		// THE PRESENT'S PEEK (game/road/present.ts): its sheet loads in the background from now on, after everything else in
		// the upload queue; a present that lands before it is in stays still. Desktop sheets get a mip chain.
		if (!PHONE_TIER) setPresentMipmapper((source) => enableMipmaps(source, app?.renderer as PIXI.Renderer | undefined));
		void loadPresent('peek');
		const tick = (ticker: PIXI.Ticker) => road.update(ticker.deltaMS * devClock.rate, boardRate(), stateGame.hurryLevel > 0 ? ROAD_MOTION.hurryRate : 1);
		app?.ticker.add(tick);
		return () => {
			// Equivalent to onDestroy(); Leave this comment for searching.
			app?.ticker.remove(tick);
			road.destroy();
		};
	});

	context.eventEmitter.subscribeOnMount({
		boardLandingEnd: () => {
			road.features.endLanding();
			road.setLandingDim(false);
			road.setBoard(stateGame.board);
		},
		boardSnap: ({ board }) => {
			road.features.clearAll();
			road.setBoard(board);
		},
		boardDriveOut: () => {
			road.features.clearAll();
			road.driveOut(stateGame.turboLevel);
		},
		boardDriveIn: async ({ board }) => {
			await road.driveIn(board, stateGame.turboLevel);
		},
		boardHeld: ({ held }) => road.features.syncHeld(held),
		boardStrike: async ({ strike }) => {
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_swipe' });
			await road.features.strike(strike);
		},
		boardGrandmaWild: async ({ cell, multiplier }) => {
			await road.features.grandmaWild(cell, multiplier);
		},
		boardColumnWild: async ({ reel, tier, multiplier, sticky, fromCell, joinAdd }) => {
			await road.features.columnWild(reel, tier, multiplier, sticky, fromCell, joinAdd);
		},
		boardWinShow: async ({ wins, amountText, multiplier }) => {
			await road.showWin(wins, amountText, LINE_WIN.holdMs * (LINE_WIN.holdShare[stateGame.turboLevel] ?? 1), multiplier);
		},
		boardWinClear: () => road.clearWin(),
		boardPulse: async ({ cells, ms }) => {
			// THE PRESENTS OF A TRIGGER play their full open with the light (game/road/present.ts), the other symbols dimmed
			// for as long; without the open's pictures in time they pulse as before
			if (await road.presentsReady()) {
				await Promise.all([road.openPresents(cells), road.pulseCells(cells, Math.max(ms, road.presentShowMs() / boardRate()))]);
			} else await road.pulseCells(cells, ms);
			road.clearWin();
		},
		boardMessage: async ({ text, ms }) => {
			await road.message(text, ms);
			road.clearWin();
		},
	});

	// THE DEV HOOK (house rule: one object on the window per game, extended and never replaced; the probes read it)
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		Object.assign(((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}), {
			/** every tunable number, live: change one in the console and spin (game/constants.ts TUNE) */
			tune: TUNE,
			tuneJson: () => JSON.stringify(TUNE, null, '\t'),
			/** what the road is drawing: board[reel][row], drift off the marks, sprites by phase */
			road: () => road.snapshot(),
			atRest: () => road.atRest && !stateGame.busy,
			board: () => stateGame.board.map((reel) => [...reel]),
			gameType: () => stateGame.gameType,
			/** the layout in use and where the board's cells are, master units and CSS px */
			boardLayout: () => {
				const r = boardRect(kind);
				const masterLeft = main.x - (main.width * main.scale) / 2;
				const masterTop = main.y - (main.height * main.scale) / 2;
				return {
					kind,
					master: MASTER[kind],
					roadScale: place.scale,
					board: r,
					css: { x: masterLeft + r.x * main.scale, y: masterTop + r.y * main.scale, width: r.width * main.scale, height: r.height * main.scale, pitch: (ROAD_ART.board.pitch * place.scale * main.scale) },
				};
			},
			/** slow or freeze the board's own time to study the motion: __reindeer.clock(0.1), __reindeer.clock(0), __reindeer.clock(1) */
			clock: (rate = 1) => (devClock.rate = Math.max(0, Math.min(4, Number(rate) || 0))),
			/** with the clock frozen (clock(0)), advance the road by hand: `n` steps of `ms` each, at the speed the game is
			 *  set to (turbo, a slam stop). Exact timings whatever the machine is doing (the probes measure with it). */
			step: (ms = 4, n = 1) => {
				for (let i = 0; i < n; i++) road.update(ms, boardRate(), stateGame.hurryLevel > 0 ? ROAD_MOTION.hurryRate : 1);
				return road.snapshot();
			},
			/** put any board up at rest: __reindeer.setBoard([[...4 symbols] x 5 reels]) */
			setBoard: (board: BoardSymbols) => road.setBoard(board),
			/** hold both stoplights on 'red', 'amber' or 'green', or dark (null); no argument hands them back to the board */
			signal: (...color: ['red' | 'amber' | 'green' | null] | []) => road.forceSignal(color.length ? color[0] : undefined),
			/** the column characters' pictures that are loaded now, and what they weigh on the GPU */
			clipMemory: () => clipMemory(),
			/** the reindeer's run views: loaded or not, their sheets, what they weigh on the GPU */
			runMemory: () => runMemory(),
			/** THE SCATTER PRESENT: its sheets loaded now and their GPU weight; the per-frame trace of its animations
			 *  (clear = true empties it); the full open by hand on the board as it stands (no book, no sound) */
			presentMemory: () => presentMemory(),
			presentTrace: (clear = false) => presentTrace(clear),
			presentLoad: (group: 'peek' | 'open') => loadPresent(group),
			presentPeek: (cell: number) => road.peekPresentAt(cell),
			presentOpen: async (cells: number[]) => {
				if (!(await road.presentsReady())) return false;
				return road.openPresents(cells);
			},
			/** run a strike into a cell by hand (no book, no sound): __reindeer.strike(cell). Resolves at the impact. */
			strike: (cell: number) => road.features.strike({ cell, markCell: null }),
			/** stand a column Wild by hand from a struck cell (no book, no sound), and read its box and clouds as drawn */
			column: (reel: number, tier: 'reindeer' | 'santa' | 'grandma', multiplier: number, fromCell: number | null) => road.features.columnWild(reel, tier, multiplier, false, fromCell),
			columnTrace: (reel: number) => road.features.columnTrace(reel),
			/** THE TARGET CROSSHAIR on a posed board (no book, no sound): `cells` the valid targets to pose (Grandma's car or
			 *  Santa's sleigh, `kinds` per cell, default H1 for the first and alternating), `target` the struck one (the first
			 *  by default), `follow` then plays the Wild the book would (a Grandma Wild, or a Santa column from the cell).
			 *  Every other cell gets a plain symbol. Resolves at the impact (or when the Wild stands, with follow). */
			crosshairStrike: async (opts: { cells: number[]; target?: number; kinds?: ('H1' | 'W')[]; follow?: boolean; poseOnly?: boolean }) => {
				const FILL = ['L1', 'H2', 'L3', 'H3', 'L5', 'H4', 'L2', 'L4'] as const;
				const board = Array.from({ length: 5 }, (_, reel) => Array.from({ length: 4 }, (_, row) => FILL[(reel * 3 + row * 5) % FILL.length])) as unknown as BoardSymbols;
				opts.cells.forEach((cell, i) => (board[Math.floor(cell / 4)][cell % 4] = opts.kinds?.[i] ?? (i % 2 ? 'W' : 'H1')));
				const target = opts.target ?? opts.cells[0];
				road.features.clearAll();
				stateGame.board = board;
				road.setBoard(board);
				if (opts.poseOnly) return;
				await road.features.strike({ cell: target, markCell: null });
				if (!opts.follow) return;
				if (board[Math.floor(target / 4)][target % 4] === 'W') await road.features.columnWild(Math.floor(target / 4), 'santa', 20, false, target);
				else await road.features.grandmaWild(target, 10);
			},
			/** the crosshair's per-frame trace since its strike began: time, centre, width, state, the cell it is on or
			 *  heading to, the target, candidates left, the reindeer's feet x and phase, the other symbols' brightness */
			crosshairTrace: () => road.features.crosshairTrace(),
			/** the live turbo level, by hand (the probes' turbo runs): 0, 1 or 2 */
			turbo: (level: 0 | 1 | 2) => (stateGame.turboLevel = level),
			/** the run's plan along the snow for a distance (road px), a diagonal and a fixed start pose (stage 2; null = free) */
			planRun: (distance: number, diagonal: number, startPose: number | null = null, maxFactor?: number) => planRun(distance, diagonal, startPose, maxFactor),
			/** the staging readout's labels as they stand, oldest first, with performance.now() (the probes read the upload
			 *  queue's spread from them: `upload:<tier>:<clip>:<sheet>`) */
			perfMarks: () => {
				const m = perfMarks;
				if (!m) return [];
				const out: { name: string; at: number }[] = [];
				for (let i = 0; i < m.slots; i++) {
					const k = (m.next + i) % m.slots;
					if (m.name[k]) out.push({ name: m.name[k], at: Math.round(m.at[k]) });
				}
				return out;
			},
		});
	}
</script>
