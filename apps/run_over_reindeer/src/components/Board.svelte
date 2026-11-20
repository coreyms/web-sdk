<script lang="ts" module>
	import type { Board as BoardSymbols } from '../game/types';
	import type { LineWinSpec } from '../game/road/roadBoard';
	import type { StrikeSpec } from '../game/road/roadFeatures';
	import type { ColumnTier, HeldColumn } from '../game/typesBookEvent';
	import type { WheelPlan } from '../game/superWheelPlan';

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
		| { type: 'boardStrike'; strike: StrikeSpec; gag?: boolean }
		/** the struck car's cell becomes the crash cloud Wild */
		| { type: 'boardGrandmaWild'; cell: number; multiplier: number }
		/** the red box grows to a column Wild and its character steps in; fromCell null = it starts whole. joinAdd: a
		 *  Grandma Wild's multiplier joining the column's number (0 = none) */
		| { type: 'boardColumnWild'; reel: number; tier: ColumnTier; multiplier: number; sticky: boolean; fromCell: number | null; joinAdd: number }
		/** show the winning lines and the amount; resolves when the hold is over. Treatment B (constants LINE_WIN slam):
		 *  `stripTotal` the spin's win (book amount) the strip counts when the lines say it is due (null: none, a big win
		 *  counts after the lines), `big` a big win */
		| { type: 'boardWinShow'; wins: LineWinSpec[]; amountText: string; multiplier: number; capped?: boolean; stripTotal?: number | null; big?: boolean }
		| { type: 'boardWinClear' }
		/** pulse cells with no line (the scatters of a trigger); resolves after ms */
		| { type: 'boardPulse'; cells: number[]; ms: number }
		/** a short line over the board; resolves after ms */
		| { type: 'boardMessage'; text: string; ms: number }
		/** a tap on the board during a live spin (ui/controls.svelte.ts hurries it) */
		| { type: 'boardTap' }
		/** the landing screen is going: the posed board stays as the first board (a resumed round puts its own up) */
		| { type: 'boardLandingEnd' }
		/** the press on the LED billboard: it powers down; resolves when the game's chrome may come up */
		| { type: 'boardLandingPress' }
		/** THE LED SCOREBOARD (game/scoreboard/): a win of `amount` (book amount) on the strip and the back board. A small win
		 *  (under the Big bar, or `small`) resolves at once; a Big win and up resolves when its hold is over */
		| { type: 'boardScoreboardWin'; amount: number; small?: boolean }
		/** PART B: a bonus round card on the back board (the Free Spins or Super entry with the spins it awards, the Total Win
		 *  with the book's amount); it waits until boardScoreboardCardEnd (the HTML card keeps the round and the press) */
		| { type: 'boardScoreboardCard'; kind: 'fs' | 'sfs' | 'total'; spins: number; amount: number; topUp?: { floor: number; amount: number } | null; capped?: boolean; presents?: number }
		| { type: 'boardScoreboardCardEnd' }
		/** THE SUPER WHEEL (game/road/superWheel.ts): the round's opening shown by the wheel, which stops on the plan's own
		 *  values (the book's); resolves when the wheel has left (or at once when it cannot play) */
		| { type: 'boardSuperWheel'; plan: WheelPlan }
		/** the Spin press (or a press on the wheel or the board) while the wheel waits (ui/controls.svelte.ts) */
		| { type: 'wheelPress' };
</script>

<script lang="ts">
	// THE BOARD: mounts the road (game/road/roadBoard.ts) on the stage, scales it into the layout, ticks it, and
	// passes the book event handlers' requests on. Always mounted (the conditional mount z order trap).
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { stateBet, stateUrlDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { layoutKind, roadPlacement, boardRect, MASTER, isPhoneSizeType, landscapeExtraY, logoBox, logoClass, TITLE } from '../game/layoutSpec';
	import { LANE_FLOW, LED_BOARD, LED_SIGN, LINE_WIN, LOGO_SIGN, ROAD_MOTION, ROUND, STRIKE, SUPER_WHEEL, TUNE, motionFor } from '../game/constants';
	import { SuperWheel, setWheelMipmapper, wheelMemory, type WheelGeo } from '../game/road/superWheel';
	import { buildWheelPlan } from '../game/superWheelPlan';
	import { sceneHooks, setSceneChoice, stateScene } from '../game/stateScene.svelte';
	import { homePreset, presetForMode, type ScenePreset, type ScenePresetName } from '../game/scenePresets';
	import { setFor, type SceneChoice } from '../game/sceneChoice';
	import { LogoSign } from '../game/scene/logoSign';
	import { SceneSwap } from '../game/scene/sceneSwap';
	import { SceneSnapshot, type SnapshotShow } from '../game/scene/sceneSnapshot';
	import config from '../game/config';
	import { boot } from '../game/boot.svelte';
	import { LedSign, capTopProfile, ledGeometry } from '../game/landing/ledSign';
	import { resumeCardWanted } from '../game/resumeRound.svelte';
	import { setLedArt, type LedText } from '../game/landing/ledScreens';
	import { LED_ART } from '../game/ledArtSpec';
	import { seatClipMemory, setSeatUploader } from '../game/road/seatedClips';
	import { PHONE_TIER } from '../game/deviceTier';
	import { enableMipmaps } from '../game/mipmaps';
	import { ROAD_ART } from '../game/roadArtSpec';
	import { FOREST_LINE } from '../game/forestLineSpec';
	import { forestLineY } from '../game/scene/sceneLayers';
	import { scenePrefetchState, setScenePrefetchView } from '../game/scenePrefetch';
	import { RoadBoard } from '../game/road/roadBoard';
	import { planRun } from '../game/road/roadFeatures';
	import { boardRate, stateGame } from '../game/stateGame.svelte';
	import { loadWildMult, setWildMultMipmapper, wildMultMemory } from '../game/road/wildMult';
	import { garlandMemory, loadGarland, setGarlandMipmapper } from '../game/road/garland';
	import { brawlForBook, brawlRoundEnd } from '../game/road/brawlCloud';
	import { clipMemory, setClipRebatch, setClipUploader, setClipView } from '../game/road/columnClips';
	import { loadRunViews, runMemory, setRunMipmapper } from '../game/road/reindeerRun';
	import { loadRoamFrames, roamMemory, setRoamMipmapper } from '../game/road/roamFrames';
	import { roamDev, type RoamZone } from '../game/road/roam';
	import { ROAM_AREAS, ROAM_AREAS_DEFAULT, ROAM_EDIT } from '../game/roamPaths';
	import { loadPresent, presentMemory, presentTrace, presentWheelDone, setPresentMipmapper } from '../game/road/present';
	import { perfMarks } from '../game/staging';
	import type { SoundEffectName } from '../game/sound';
	import { COLUMN_CLIPS } from '../game/columnClipSpec';
	import { LANDING_POSE, landingColumns } from '../game/landingBoard';
	import { Scoreboard, scoreboardDev, type CoverPiece, type ScatterRead } from '../game/scoreboard/scoreboard';
	import { scoreboardGeometry } from '../game/scoreboard/layout';
	import { setScoreboardArt } from '../game/scoreboard/scoreboardDraw';
	import { raceTally, raceTrace, newRace, reseedRace } from '../game/scoreboard/race';
	import { SCENE_ART } from '../game/sceneArtSpec';
	import { isPaying, symbolPopupBoard, symbolPopupHook } from '../game/symbolPopup';
	import { boardIdle } from '../game/boardIdle';
	import { bookEventAmountToBetAmountMultiplier, bookEventAmountToCurrencyString, bookEventAmountToNormalisedAmount, numberToCurrencyString } from 'utils-shared/amount';
	import { ledAmountText, ledSentenceAmount } from '../game/scoreboard/ledCurrency';

	const context = getContext();
	const parent = getContextParent();

	/** DEV: the board's own time, slowed or frozen from the dev hook (__reindeer.clock) to look at a spin frame by frame.
	 *  Always 1 in a build. */
	const devClock = { rate: 1 };

	const loaded = context.stateApp.loadedAssets as Record<string, PIXI.Texture | undefined>;
	const tex = (frame: string) => loaded[frame];
	const road = new RoadBoard(tex);
	/** the asphalt's band in road px (the road picture's own: from under its top snow rim to its bottom rim): the roaming
	 *  reindeer's feet never go there */
	const ROAM_ROAD = { top: 120, bottom: 905 };
	/** his head stays this many CSS px under the top line's text */
	const ROAM_TOP_LINE_CLEAR = 8;
	road.setBoard(stateGame.board);
	// (a lane's stop no longer sounds: since round 2, 2026-11-15, each REEL has its own stop, sfx_lane_stop_1..5, cued by
	// the road itself as that reel's last car stops, game/road/roadBoard.ts updateReelStops; the borrowed sfx_reel_stop
	// that played here once per lane is gone)
	// the features' beats: since 2026-11-15 only a column with no strike behind it (Super's opening column) sends one, and
	// since pass 7 (2026-11-16, Corey: "Yes") it plays nothing: the borrowed Manticore sting is gone, the column grow
	// (sfx_column_grow, game/road/roadSounds.ts) voices that box
	road.features.onBeat = null;
	// THE ROAD'S OWN SOUNDS (game/road/roadSounds.ts, constants REINDEER_SOUND): the reindeer's alert, run and turn, the
	// crash and its cloud, the Grandma Wild, the reindeer column's entrance and his idle snort, cued from the frames. Through
	// the game's sound events (components/Sound.svelte), so the effects volume, mute and SKIP TO RESULT apply. A one-shot
	// always plays (forcePlay: the next strike's alert never waits for the last one's to end).
	road.features.sounds.env = {
		play: (name, rate) => context.eventEmitter.broadcast({ type: 'soundOnce', name: name as SoundEffectName, forcePlay: true, rate }),
		loop: (name) => context.eventEmitter.broadcast({ type: 'soundLoop', name: name as SoundEffectName }),
		fade: (name, from, to, ms) => context.eventEmitter.broadcast({ type: 'soundFade', name: name as SoundEffectName, from, to, duration: ms }),
		stop: (name) => context.eventEmitter.broadcast({ type: 'soundStop', name: name as SoundEffectName }),
		roundLive: () => stateGame.busy,
		rate: (name, rate) => context.eventEmitter.broadcast({ type: 'soundRate', name: name as SoundEffectName, rate }),
		skipping: () => stateGame.skipping,
	};
	// the target crosshair (constants CROSSHAIR): nothing of it shows under SKIP TO RESULT. Its beats (hop, drop, lock,
	// morph) are voiced by the road's own sounds since round 2 (2026-11-15): RoadSounds.crosshair.
	road.features.crosshairOff = () => stateGame.skipping;
	road.features.onCrosshair = (beat, cell) => road.features.sounds.crosshair(beat, cell);
	parent.addToParent(road.root);

	// THE LED SCOREBOARD (constants LED_BOARD, game/scoreboard/scoreboard.ts): the strip under the road and the back board
	// that rises behind it. Added here, under the press screen's billboard and its dim (the strip is part of the scene);
	// once the press screen has gone it is moved over the billboard logo (the back board covers the logo's foot on an
	// upright phone, as the mock draws it, and the logo dims with the scene while the back board is up).
	const scoreboard = LED_BOARD.on ? new Scoreboard() : null;
	if (scoreboard) {
		const sheet = loaded.scoreboardArt?.source?.resource as CanvasImageSource | undefined;
		setScoreboardArt(sheet ?? null);
		// THE FINER GRID'S RULE (constants LED_BOARD.density) reads the renderer's own resolution (components/Game.svelte sets
		// it from the device under the cap): an LED's device pixels are what the renderer draws it with
		scoreboard.deviceRatio = () => context.stateApp.pixiApplication?.renderer?.resolution ?? window.devicePixelRatio ?? 1;
		parent.addToParent(scoreboard.root);
		scoreboard.onPress = () => {
			if (scoreboard.busy()) scoreboard.skip();
		};
		// THE TIER SOUNDS (constants LED_BOARD.tierSounds, part B): one as the count reaches each tier (a skip: the final
		// tier's only), through the road's sound log and the game's sound events (the effects volume, mute and SKIP TO RESULT)
		// (2026-11-17, approved: the tier sounds no longer pile up as a win climbs) a tier's sound fades the one before it out
		// over LED_BOARD.tierSounds.fadeMs as it starts, through the road's fade (the game's soundFade, then soundStop)
		// (only within one win: a new win's first tier never fades the last win's)
		let lastTier: { name: string; at: number; show: number } | null = null;
		scoreboard.onTier = (tier, show) => {
			const T = LED_BOARD.tierSounds;
			const name = T.on ? T.names[tier] : null;
			if (!name) return;
			if (lastTier && lastTier.show === show.id && lastTier.name !== name && performance.now() - lastTier.at < T.lengthMs) road.features.sounds.fadeNamed(lastTier.name, T.fadeMs, `the next tier's sound (${name})`);
			road.features.sounds.playNamed(name, `scoreboard tier ${tier}`);
			lastTier = { name, at: performance.now(), show: show.id };
		};
	}
	/** where the layout put the road and the logo (the shake moves them from here, game/scoreboard/show.ts shakeAt) */
	let roadBaseY = 0;
	let logoBaseY = 0;
	/** THE SIGN ON THE PRESS SCREEN (2026-11-17, Corey approved: on an upright phone the sign's foot rests on the billboard's
	 *  snow cap): the rule's box (layoutSpec logoBox), the lift the press screen asks for (road px, negative = up) and the
	 *  lift drawn now; once the press screen has gone the lift eases back to 0 over LOGO_SIGN.pressLiftBackMs */
	/** DEV: the Grandma gags asked by strikes (the LED probe's gag rule), and which line each played ('full', 'short') */
	let devGags = 0;
	let devGagModes: string[] = [];
	let logoHome: { x: number; y: number; width: number; height: number } | null = null;
	/** how far the sign moved down off the trees on an upright phone (road px), and how far it still fell short (road px:
	 *  the board's top in the way) */
	let logoTreeDrop = 0;
	let logoTreeShort = 0;
	/** the sign's lowest visible pixel, a share of its box's height (its picture's alpha, logoSign footShares) */
	const logoFootShare = () => {
		const F = logo?.footShares();
		let deep = -Infinity;
		if (F) for (let i = 0; i < F.length; i++) if (!Number.isNaN(F[i])) deep = Math.max(deep, F[i]);
		return Number.isFinite(deep) ? deep : 1;
	};
	let logoLiftWant = 0;
	let logoLift = 0;
	let logoLiftFrom: number | null = null;
	const placeLogo = () => {
		if (logo && logoHome) logo.place({ ...logoHome, y: logoHome.y + logoLift });
	};
	let shookY = 0;
	/** the LED amount: the play currency's amount as the HUD writes it, its digits pinned to the final amount, the symbol
	 *  drawn in LED glyphs, or the number alone for a currency the boards have no glyphs for (game/scoreboard/ledCurrency.ts) */
	const ledAmount = (final: number) => (v: number) => ledAmountText(numberToCurrencyString(v, { fractionDigitsOf: final }), stateBet.currency);
	scoreboardDev.bet = () => bookEventAmountToNormalisedAmount(100);
	scoreboardDev.fmt = (v: number) => ledAmountText(numberToCurrencyString(v), stateBet.currency);
	/** the scoreboard over the logo (see above) */
	const scoreboardOverLogo = () => {
		const p = logo?.root.parent;
		if (!scoreboard || !logo || !p || scoreboard.root.parent !== p) return;
		p.setChildIndex(scoreboard.root, p.getChildIndex(logo.root));
	};
	/** free spins played or playing in this bonus round (the strip's counter: the spins left after the one on the road) */
	let fsDone = 0;

	// THE FIRST BOARD (game/landingBoard.ts; Corey 2026-11-16: the pattern "was meant for after" the press screen): the
	// posed, still board (the side reels' symbols, the three column Wilds with their top multipliers) stands from the
	// start, dimmed behind the LED billboard while the press screen is up, and stays as the board at rest before the first
	// spin, whose press takes its columns away. A resumed round puts its own board up instead. A replay has no landing.
	const landingSheet = loaded.landingStills;
	const landing = context.stateLayout.showLoadingScreen && !stateUrlDerived.replay();
	if (landing && landingSheet) {
		road.setBoard(LANDING_POSE);
		road.features.showLanding(landingSheet, COLUMN_CLIPS.landing.tiers[PHONE_TIER ? 'phone' : 'full'].frames, landingColumns());
		if (!LED_SIGN.on) road.setLandingDim(true);
	}
	// once the first board's columns have left (the first spin's press), their sheet leaves the GPU
	road.features.onLandingGone = () => landingSheet?.source.unload();

	// THE LED BILLBOARD PRESS SCREEN (constants LED_SIGN, game/landing/ledSign.ts): over the dimmed first board, from the
	// moment the board is up; its ticker says PRESS ANYWHERE once the press gate is open (boot.pressReady). Unloaded once
	// the game is entered (the sign, its canvases and textures, its pictures' file).
	const ledText = (): LedText => {
		const T = LED_SIGN.text;
		return {
			win: { top: T.winTop, num: `${config.maxWin.toLocaleString('en-US')}X` },
			sleigh: { head: T.sleighHead, body: T.sleighBody, mult: T.sleighMult },
			car: { head: T.carHead, body: T.carBody, mult: T.carMult, bodyScales: [2, 1] },
			ticker: T.ticker,
		};
	};
	let led: LedSign | null = null;
	/** THE PRESS SCREEN ON THE GAME'S OWN LED BOARD (constants LED_SIGN.onBoard, 2026-11-17): the scoreboard's expanded back
	 *  board plays the screens, the strip says PRESS ANYWHERE; no separate sign. Set once it is up, cleared once it is down. */
	let pressOnBoard = false;
	// (THE RESUME CARD, 2026-11-18: a reload into an open round has no press screen; the card asks instead, ui/ResumeCard.svelte)
	if (landing && LED_SIGN.on && LED_SIGN.onBoard && scoreboard && !resumeCardWanted()) {
		const art = loaded.ledArt;
		const image = art?.source?.resource as CanvasImageSource | undefined;
		setLedArt(image ? { image, frames: LED_ART.frames } : null);
		pressOnBoard = scoreboard.press(ledText());
		boot.ledSign = pressOnBoard;
		scoreboard.onPressGone = () => {
			pressOnBoard = false;
			boot.ledSign = false;
			setLedArt(null);
			// the pictures' file goes (it was never sent to the GPU: only drawn on the board's canvases)
			const src = (context.stateApp.assets as Record<string, { src: string }> | undefined)?.ledArt?.src;
			if (src) void PIXI.Assets.unload(src).catch(() => {});
		};
	}
	if (landing && LED_SIGN.on && !pressOnBoard && !resumeCardWanted()) {
		const art = loaded.ledArt;
		const image = art?.source?.resource as CanvasImageSource | undefined;
		setLedArt(image ? { image, frames: LED_ART.frames } : null);
		led = new LedSign(ledText());
		parent.addToParent(led.root);
		boot.ledSign = true;
		led.onGone = () => {
			const sign = led;
			led = null;
			boot.ledSign = false;
			// the sign goes back to its in-game place (eased in the tick)
			logoLiftWant = 0;
			scoreboardOverLogo();
			setLedArt(null);
			// hidden this frame (the sign's root is invisible now), destroyed two frames later: a texture destroyed in the
			// frame it was last batched takes the render loop down (the column sheets' rule, game/road/columnClips.ts)
			requestAnimationFrame(() => requestAnimationFrame(() => sign?.destroy()));
			// the pictures' file goes with it (it was never sent to the GPU: only drawn on the sign's canvases)
			const src = (context.stateApp.assets as Record<string, { src: string }> | undefined)?.ledArt?.src;
			if (src) void PIXI.Assets.unload(src).catch(() => {});
		};
	}

	// THE BILLBOARD LOGO (game/scene/logoSign.ts, constants LOGO_SIGN): over the road and over the press screen's dim (the
	// green plate stood over both as HTML), placed with the road (its own container, the road's transform)
	const logo = loaded.logoSign ? new LogoSign(loaded.logoSign, PHONE_TIER ? 'phone' : 'full') : null;
	if (logo) parent.addToParent(logo.root);
	if (!led) scoreboardOverLogo();

	// THE SUPER WHEEL (game/road/superWheel.ts, constants SUPER_WHEEL): over the road and the logo, UNDER the LED scoreboard
	// (its bottom is tucked behind the strip, mock round 4), placed in the canvas's own CSS px. It asks the road for the
	// red present's open and the drive away, the strip for its line, the road's sounds for its few sounds.
	const wheel = new SuperWheel();
	parent.addToParent(wheel.root);
	/** the wheel just under the scoreboard in the draw order (the scoreboard is moved over the logo after the press screen) */
	/** THE LOGO UNDER THE WHEEL WHILE IT IS UP (2026-11-19): on an upright phone the billboard logo stands where the
	 *  reindeer runs on the wheel's left shoulder, and it is drawn over the scoreboard; while the wheel is up it is drawn
	 *  just under it, and goes back over the scoreboard when the wheel has left (wheelLayerBack) */
	let logoWasOver = false;
	const wheelUnderBoard = () => {
		const p = wheel.root.parent;
		if (!p) return;
		p.removeChild(wheel.root);
		const board = scoreboard && scoreboard.root.parent === p ? scoreboard.root : null;
		if (board && logo && logo.root.parent === p && p.getChildIndex(logo.root) > p.getChildIndex(board)) {
			logoWasOver = true;
			p.setChildIndex(logo.root, p.getChildIndex(board));
		}
		p.addChildAt(wheel.root, board ? p.getChildIndex(board) : p.children.length);
	};
	const wheelLayerBack = () => {
		const p = logo?.root.parent;
		if (!logoWasOver || !logo || !p || !scoreboard || scoreboard.root.parent !== p) return;
		logoWasOver = false;
		if (p.getChildIndex(logo.root) < p.getChildIndex(scoreboard.root)) p.setChildIndex(logo.root, p.getChildIndex(scoreboard.root));
	};
	/** the wheel has left into its column: the roaming reindeer walks back in once that column has grown */
	let roamBackDue = false;
	wheel.env = {
		openPresent: () => road.wheelPresent(),
		driveAway: () => {
			// (a base game column Wild of the trigger spin leaves with its board)
			road.features.clearAll();
			road.driveAway(stateGame.turboLevel);
			scoreboard?.spinPress();
		},
		led: (text, tone, blink) => scoreboard?.wheelLine(text, tone, blink),
		sound: (name, detail, rate) => {
			if (name && !stateGame.skipping) road.features.sounds.playNamed(name, `wheel: ${detail}`, rate);
		},
		runSound: (on) => {
			// DEV: his set off and his leaving into the road's log (the sound probe pairs the wheel's run loop with them)
			if (import.meta.env.DEV) road.features.sounds.mark('wheelRun', on ? 'start' : 'stop');
			if (on) road.features.sounds.runStart();
			else road.features.sounds.runStop('the wheel');
		},
		// ONE REINDEER ON THE SCREEN: the roaming one (game/road/roam.ts) goes as the wheel comes out (he is the one who runs
		// it): on the screen he stands startled and runs off, toward the left (where the wheel's driver runs in from) when
		// that is quick enough, else off the nearest edge. He stays away through the whole wheel (no walk in, no safety net)
		// and a new one walks in the usual way SUPER_WHEEL.roamBackMs after the opening column has grown (boardColumnWild)
		roamer: (on) => {
			if (on) roamBackDue = true;
			else if (STRIKE.roam) road.features.roam.away(-1);
		},
		// AUTOPLAY BONUSES (a run still live), or a replay (its Spin key is the REPLAY banner)
		// (ROUND.introWaitsForPress false, some probes: nothing waits for a press, the wheel neither)
		auto: () => (stateGame.autoPlayBonuses && stateBet.autoSpinsCounter > 0) || (SUPER_WHEEL.replayAuto && stateUrlDerived.replay()) || !ROUND.introWaitsForPress,
		phase: (phase) => {
			stateGame.wheelPhase = phase;
			// (a wheel that ended without leaving into its column, as the dev poses' end: he is not kept away)
			if (phase === null)
				queueMicrotask(() => {
					if (!roamBackDue && road.features.roam.held) road.features.roam.back(0);
				});
			// DEV: the phase into the road's log, on the board's own clock (the probe's timings)
			if (import.meta.env.DEV) road.features.sounds.mark('wheel', phase ?? 'gone');
			// THE REST: the Spin key is the wheel's from here, at regular pace (a slam stop spent on the way in ends here)
			if (phase === 'rest') {
				context.eventEmitter.broadcast({ type: 'stopButtonEnable' });
				// THE RED PRESENT'S SHEETS GO HERE (2026-11-19, the probe host's present_probe): the wheel has come out of it and
				// its car has driven away, so nothing draws them through the wheel's spins (22 MB on desktop, 3 MB on a phone,
				// held only from the trigger to this moment; game/road/present.ts presentWheelDone)
				presentWheelDone();
			}
		},
	};
	// a press on the wheel is the board's tap (ui/controls.svelte.ts boardTap: the wheel's press at rest, the slam stop after)
	wheel.onTap = () => context.eventEmitter.broadcast({ type: 'boardTap' });
	/** THE WHEEL'S PLACE (constants SUPER_WHEEL.size; mock rounds 3 and 4), canvas CSS px */
	const wheelGeoOf = (g: ReturnType<typeof scoreboardGeometry>, layout: typeof kind, canvasW: number, board: { x: number; y: number; w: number; h: number }): WheelGeo => {
		const Z = SUPER_WHEEL.size;
		// round 3's wheel: the board's height about its middle (sideways and desktop), or the board's width standing on the
		// board's bottom edge (upright), the board being the layout's own box (layoutSpec boardRect, as the mock read it);
		// its top is kept
		const d3 = layout === 'portrait' ? Z.boardWidthShare * board.w : Z.boardHeightShare * board.h;
		const top3 = layout === 'portrait' ? board.y + board.h + Z.lift * d3 - d3 : board.y + board.h / 2 - Z.lift * d3 - d3 / 2;
		// round 4: it grows down until its bottom is tucked behind the LED strip, never wider than the screen
		const d = Math.max(40, Math.min(Math.max(d3, g.strip.housing.y + g.strip.housing.h - Z.bottomInset - top3), canvasW - 2 * Z.screenPad));
		return { cx: board.x + board.w / 2, cy: top3 + d / 2, d, pegScale: Math.min(1, d3 / d), capTop: g.strip.housing.y - g.strip.cap * 1.3, road: g.road };
	};

	// THE SCENE PRESET AND ITS SWAP (game/stateScene.svelte.ts, game/scene/sceneSwap.ts): its pieces by asset key (the base
	// scene of the set the Scene setting asks for in the manifest; every other scene and the upright forest off the phone
	// tier load lazily, game/assets.ts SCENE_LAZY_URLS). The scene follows the
	// round's mode; the swap in waits for the LED back board's entry scene to be seated over the dimmed scene, the swap back
	// starts once the mode is the base game again (after the Total Win is dismissed). The fade is one picture of the
	// outgoing screen fading out over the incoming scene (game/scene/sceneSnapshot.ts).
	/** the screen as the last layout saw it, and the LED scoreboard's place (its snow cover is re-cut when the pieces change) */
	let sceneView: { kind: typeof kind; uprightPhone: boolean } | null = null;
	// the background prefetch of the other scene set asks for exactly this view's pieces (game/scenePrefetch.ts)
	setScenePrefetchView(() => sceneView);
	let boardGeo: ReturnType<typeof scoreboardGeometry> | null = null;
	const swap = new SceneSwap({
		loaded,
		layers: road.scene,
		view: () => sceneView,
		upload: (t) => context.stateApp.pixiApplication?.renderer.prepare.upload(t),
		gate: (to) => to === homePreset(stateScene.set) || !scoreboard || !scoreboard.entryRising(),
		onPieces: () => cutCover(),
		// THE PICTURE of the screen as it is (game/scene/sceneSnapshot.ts): the road and the board's snow cover drawn into one
		// texture, shown over the road (its last child) and over the cover (the cover's rectangle of it)
		snapshot: () => {
			const app = context.stateApp.pixiApplication;
			const keep: PIXI.Container[] = [road.root];
			const shows: SnapshotShow[] = [{ parent: road.root, rect: null }];
			const cover = scoreboard?.snapshotParts();
			if (cover?.rect) {
				keep.push(...cover.keep);
				shows.push({ parent: cover.layer, rect: cover.rect });
			}
			return SceneSnapshot.take(app?.renderer as PIXI.Renderer | undefined, app?.stage, keep, shows);
		},
	});
	const sceneTex = swap.tex;
	sceneHooks.prefetch = (name) => void swap.prefetch(name);
	// A ROUND LEFT OPEN INSIDE A BONUS (the session's resumed bet): its scene is asked for from the moment the bet is known,
	// so its pieces load behind the press screen and the resumed free spins come up in their night; the round's own mode
	// takes over once its snapshot has rebuilt it (game/bookEventHandlerMap.ts createBonusSnapshot)
	const resumedMode = (): 'bonus' | 'super' | null => {
		const bet = stateBet.betToResume as { active?: boolean; event?: string | number; state?: { type: string; bonusType?: string }[] } | null;
		if (!bet?.active || !Array.isArray(bet.state)) return null;
		const at = Number(bet.event ?? 0);
		let mode: 'bonus' | 'super' | null = null;
		bet.state.forEach((e, i) => {
			if (i >= at) return;
			if (e.type === 'freeSpinTrigger') mode = e.bonusType === 'super' ? 'super' : 'bonus';
			if (e.type === 'freeSpinEnd') mode = null;
		});
		return mode;
	};
	let resumeHeld = true;
	$effect(() => {
		const mode = stateGame.bonusMode;
		const resumed = resumeHeld ? resumedMode() : null;
		if (mode) resumeHeld = false;
		stateScene.want = presetForMode(mode ?? resumed, stateScene.set);
	});
	/** THE SCENE SETTING (dark mode, game/sceneChoice.ts): the set the player's choice means (Auto: the device's light or dark
	 *  setting as it is now) is taken up only with the board at rest: no round running (a change during a round waits for
	 *  its end), no bonus round (nor a resumed one waiting), no card, the LED back board down (never during a bonus entry or
	 *  a Total Win scene) and the set's base scene settled on screen. Then `want` turns to the new set's base scene (the
	 *  effect above) and the swap fades to it as it does to a bonus scene; the old set is let go as the fade starts. *
	/** why the set in use is not the one the setting asks for (null when it is, or when it was just taken up) */
	let sceneSetWait: string | null = null;
	const takeSceneSet = () => {
		const target = setFor(stateScene.choice, stateScene.dark);
		sceneSetWait = null;
		if (target === stateScene.set) return;
		if (stateGame.busy || !context.stateXstateDerived.isIdle()) sceneSetWait = 'a round is running';
		else if (stateGame.bonusMode || stateGame.gameType === 'freegame') sceneSetWait = 'a bonus round';
		else if (stateGame.roundCard) sceneSetWait = 'a card is up';
		// (THE PRESS SCREEN's own expanded board is not one of those: a press on the press screen's switch changes the scene
		// behind it at once, 2026-11-19, Corey: "Clicking the SNOW/DARK for the scenes on the intro page isn't doing
		// anything until you click press to continue")
		else if (scoreboard?.backBusy() && !scoreboard.pressUp()) sceneSetWait = 'the LED back board is up';
		else if (stateScene.want !== homePreset(stateScene.set) || !swap.settled()) sceneSetWait = 'the scene is changing';
		if (sceneSetWait) return;
		stateScene.set = target;
	};
	/** THE LED SCOREBOARD'S SNOW COVER from a preset's pieces: the field tile, the road picture, the bottom band, and the
	 *  painted ends where the layout shows them (road px) */
	const coverPieces = (P: ScenePreset, layout: typeof kind): CoverPiece[] => {
		const pieces: CoverPiece[] = [];
		if (!P.boardCover) return pieces;
		const A = SCENE_ART[P.kit];
		const field = sceneTex(P.boardCover.field);
		const band = P.boardCover.band ? sceneTex(P.boardCover.band) : null;
		const picture = sceneTex(P.picture.road);
		const F = A.field.road;
		if (field) pieces.push({ tex: field, x: F[0], y: F[1], w: F[2], h: F[3], tile: true });
		if (picture) pieces.push({ tex: picture, x: 0, y: 0, w: ROAD_ART.image.width, h: ROAD_ART.image.height });
		const B = A.bandBottom.road;
		if (band) pieces.push({ tex: band, x: B[0], y: B[1], w: B[2], h: B[3] });
		if (P.ends && P.ends.layouts.includes(layout))
			for (const [key, R] of [
				[P.ends.left, A.endLeft.road],
				[P.ends.right, A.endRight.road],
			] as const) {
				const t = sceneTex(key);
				if (t) pieces.push({ tex: t, x: R[0], y: R[1], w: R[2], h: R[3] });
			}
		return pieces;
	};
	/** the cover cut for the scene on screen now (a swap re-cuts it from the incoming scene at once: the picture of the
	 *  outgoing screen fades out over it) */
	const cutCover = () => {
		if (!scoreboard || !boardGeo || !sceneView) return;
		const [shown] = road.scene.presets();
		scoreboard.layout(boardGeo, shown ? coverPieces(shown, sceneView.kind) : []);
	};

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
		roadBaseY = road.root.y;
		shookY = 0;
		// THE SCENE: the part of the road's plane the canvas shows, in road px
		const canvasSize = context.stateLayoutDerived.canvasSizes();
		const k = place.scale * main.scale;
		const ox = masterLeft + place.x * main.scale;
		const oy = masterTop + place.y * main.scale;
		const rect = { left: -ox / k, top: -oy / k, right: (canvasSize.width - ox) / k, bottom: (canvasSize.height - oy) / k };
		const uprightPhone = kind === 'portrait' && isPhoneSizeType(context.stateLayoutDerived.canvasSizeType());
		const feetY = (STRIKE.snow[kind] ?? STRIKE.snow.landscape).feetY;
		sceneView = { kind, uprightPhone };
		road.scene.layout({ kind, uprightPhone, rect, feetY });
		road.features.screenEdges = { left: rect.left, right: rect.right };
		// the roaming reindeer's area is fractions of the picture and of this (game/roamPaths.ts)
		road.features.screenRect = rect;
		roamView = { kind, k, ox, oy, rect };
		// a piece this layout draws that is not in yet (the forest on a desktop browser narrowed to an upright phone, a
		// night scene's ends after a rotation): loaded now, drawn when in
		swap.layoutChanged(`${canvasSize.width}x${canvasSize.height}|${kind}|${ox.toFixed(2)},${oy.toFixed(2)},${k.toFixed(5)}`);
		// the billboard logo, by its class's rule (layoutSpec logoBox), in the road's px
		if (logo) {
			const extraTop = kind === 'landscape' ? landscapeExtraY(canvasSize.height / main.scale) : 0;
			const box = logoBox(logoClass(kind, canvasSize.width, canvasSize.height), place, main.scale, masterLeft, extraTop);
			logo.root.scale.set(k);
			logo.root.position.set(ox, oy);
			logoBaseY = oy;
			// THE SIGN'S FOOT ON OPEN GROUND (constants LOGO_SIGN treeGapCss, boardGapCss): an upright phone only
			logoTreeDrop = 0;
			logoTreeShort = 0;
			if (uprightPhone) {
				const foot = box.y + logoFootShare() * box.height;
				const line = forestLineY(rect, box.x, box.x + box.width);
				if (Number.isFinite(line)) {
					const want = line + LOGO_SIGN.treeGapCss / k - foot;
					const room = ROAD_ART.laneLines[0] - LOGO_SIGN.boardGapCss / k - (box.y + box.height);
					logoTreeDrop = Math.max(0, Math.min(want, room));
					logoTreeShort = Math.max(0, want - logoTreeDrop);
					box.y += logoTreeDrop;
				}
			}
			logoHome = box;
			placeLogo();
		}
		// THE LED SCOREBOARD: its rule per layout class (game/scoreboard/layout.ts), and the scene pieces its foreground snow is
		// cut from (the preset's boardCover: the field tile, the road picture, the bottom band, and the painted ends where the
		// layout shows them), road px
		// THE SUPER WHEEL's place follows the LED strip's (its bottom tucks behind it)
		{
			const br = boardRect(kind);
			const wg = wheelGeoOf(scoreboardGeometry(kind, canvasSize.width, canvasSize.height, main, place, isPhoneSizeType(context.stateLayoutDerived.canvasSizeType())), kind, canvasSize.width, { x: masterLeft + br.x * main.scale, y: masterTop + br.y * main.scale, w: br.width * main.scale, h: br.height * main.scale });
			wheel.layout(wg);
			stateGame.wheelBox = { cx: wg.cx, cy: wg.cy, d: wg.d };
		}
		if (scoreboard) {
			boardGeo = scoreboardGeometry(kind, canvasSize.width, canvasSize.height, main, place, isPhoneSizeType(context.stateLayoutDerived.canvasSizeType()));
			// the line amounts' floor (2026-11-18): above the strip's snow cap and the HUD's top, 4 road px clear, in road px
			const capTop = boardGeo.strip.housing.y - boardGeo.strip.cap * 1.3;
			road.labelFloor = (Math.min(capTop, boardGeo.hudTop) - boardGeo.road.oy) / boardGeo.road.k - 4;
			cutCover();
		}
		// the billboard: centred on the board, sized per layout (canvas CSS px)
		if (led) {
			const r = boardRect(kind);
			const canvas = context.stateLayoutDerived.canvasSizes();
			const lg = ledGeometry(kind, canvas.width, canvas.height, main.scale, { x: masterLeft + r.x * main.scale, y: masterTop + r.y * main.scale, w: r.width * main.scale, h: r.height * main.scale });
			led.layout(lg);
			// THE SIGN ON THE CAP (upright phones, the press screen only): the sign rests on the cap's drawn top (ledSign
			// capTopProfile): column by column, its lowest visible pixel against the cap's top under it, the deepest of them
			// put pressCapOverlap CSS px into the cap, wherever the rule put the sign; other layouts keep the rule's place
			logoLiftWant = 0;
			const F = logo && logoHome && kind === 'portrait' ? logo.footShares() : null;
			if (F && logoHome) {
				const cap = capTopProfile(lg);
				const bx = ox + logoHome.x * k;
				const by = oy + logoHome.y * k;
				const bw = logoHome.width * k;
				const bh = logoHome.height * k;
				let deepest = -Infinity;
				for (let i = 0; i < F.length; i++) {
					if (Number.isNaN(F[i])) continue;
					const j = Math.round(bx + ((i + 0.5) / F.length) * bw - cap.x0);
					if (j < 0 || j >= cap.ys.length) continue;
					deepest = Math.max(deepest, by + F[i] * bh - cap.ys[j]);
				}
				if (Number.isFinite(deepest)) logoLiftWant = (LOGO_SIGN.pressCapOverlap - deepest) / k;
			}
			logoLift = logoLiftWant;
			placeLogo();
		}
	});

	// THE ROAMING REINDEER'S VIEW AND ZONES (game/road/roam.ts roamDev): the staging area editor and the probes draw and
	// check the area in CSS px; the zones are where his body must never be (the road under his feet, the HUD, the LED
	// strip, the logo, the top line). Read when he picks a spot or the layout changes, never per frame.
	let roamView: { kind: typeof kind; k: number; ox: number; oy: number; rect: { left: number; top: number; right: number; bottom: number } } | null = null;
	roamDev.view = () => roamView;
	const roamZones = (): RoamZone[] => {
		const out: RoamZone[] = [];
		const v = roamView;
		if (!v || typeof document === 'undefined') return out;
		const add = (name: string, x0: number, y0: number, x1: number, y1: number) => {
			if (x1 - x0 > 0.5 && y1 - y0 > 0.5) out.push({ name, x0, y0, x1, y1 });
		};
		const el = (name: string, e: Element) => {
			// shown: laid out and not hidden (the menu's closed rows are visibility: hidden, which their children inherit)
			if (getComputedStyle(e).visibility === 'hidden') return;
			const b = e.getBoundingClientRect();
			add(name, b.left, b.top, b.right, b.bottom);
		};
		// the road: the asphalt between the trench's two snow rims, the picture's whole width (his feet never on it)
		add('road', v.ox, v.oy + ROAM_ROAD.top * v.k, v.ox + ROAD_ART.image.width * v.k, v.oy + ROAM_ROAD.bottom * v.k);
		// (SKIP TO RESULT, components/SkipButton.svelte, 2026-11-19: its button is in the DOM, transparent and disabled, all the
		// time it is allowed, and as a 'hud' zone it closed the top right corner he walks in through on desktop and tablet,
		// in every round: 1fc7cea, the probe host. Now it is its own zone, 'skip', its button's box, only while it is up; he
		// never stops under it, and a walk may pass it (game/road/roam.ts), as a walk passes behind the top line's text. Its
		// prompt's Yes and No are 'hud' zones while the prompt is open, as before.)
		document.querySelectorAll('.hudp button, .hudp [data-hud]').forEach((e) => {
			if (e.matches('[data-skip="button"]')) {
				if (e.classList.contains('up')) el('skip', e);
				return;
			}
			el('hud', e);
		});
		// the top line: and 8 CSS px under it (Corey 2026-11-17: his head clears it by 8 px or more)
		const line0 = out.length;
		document.querySelectorAll('[data-top-line]').forEach((e) => el('top line', e));
		for (let i = line0; i < out.length; i++) out[i].y1 += ROAM_TOP_LINE_CLEAR;
		// (the bonus round's counter plate is gone from the game since the 17 fixes: no zone for it)
		if (logo?.box) add('logo', v.ox + logo.box.x * v.k, v.oy + logo.box.y * v.k, v.ox + (logo.box.x + logo.box.width) * v.k, v.oy + (logo.box.y + logo.box.height) * v.k);
		const strip = scoreboard?.snapshot().strip;
		if (strip) add('LED strip', strip.x, strip.capTop, strip.x + strip.w, strip.housingBottom);
		// (2026-11-18) THE LED BACK BOARD while it is up (a big win, a card, the press screen's expanded board): its whole
		// seated box down to the strip, whatever its motion, so nothing of him (body or shadow, game/road/roam.ts clear) is
		// ever over it as it rises; read again the frame it comes up or goes down (roamDev.zonesKey)
		// (2026-11-18) the two stoplights at the tunnel mouths: his cast shadow leans over the right one from the snow
		// beside the right tunnel on a sideways phone
		for (const b of road.stoplightBoxes()) add('stoplight', b.x0, b.y0, b.x1, b.y1);
		const back = scoreboard?.backZone();
		if (back) add('LED board', back.x, back.y, back.x + back.w, back.y + back.h);
		return out;
	};
	roamDev.zones = roamZones;
	// THE FOREST behind the upright phone's snow (2026-11-19, Corey: "the reindeer is walking on the trees"): where the scene
	// draws it now and the preset's kit, for its tree line (game/forestLineSpec.ts); null where no forest shows
	road.features.roam.forest = () => {
		const f = road.scene.last.forest;
		return f ? { ...f, kit: stateScene.preset.kit } : null;
	};
	roamDev.zonesKey = () => `${scoreboard?.backUp() ? 'board up' : 'board down'}|${typeof document !== 'undefined' && document.querySelector('[data-skip="button"].up') ? 'skip up' : 'skip down'}`;

	// the board's tap area: a tap during a live spin hurries it, as the Spin press does (ui/controls.svelte.ts boardTap)
	road.root.eventMode = 'static';
	road.root.hitArea = new PIXI.Rectangle(ROAD_ART.board.x, ROAD_ART.laneLines[0], ROAD_ART.board.width, ROAD_ART.laneLines[4] - ROAD_ART.laneLines[0]);
	road.root.on('pointertap', (event: PIXI.FederatedPointerEvent) => {
		context.eventEmitter.broadcast({ type: 'boardTap' });
		// the symbol pay popup (components/SymbolPopup.svelte): it opens on an idle board only and decides that itself
		symbolPopupHook.tap(event.global.x, event.global.y);
	});
	// THE SYMBOL PAY POPUP'S QUESTIONS (game/symbolPopup.ts symbolPopupBoard): which cell is under a point, what it shows
	// (a standing column covers its reel, a crash cloud its cell, else the parked symbol), the boxes (Pixi global units)
	{
		const LINES = ROAD_ART.laneLines;
		const BX = ROAD_ART.board.x;
		const PITCH = ROAD_ART.board.pitch;
		const local = new PIXI.Point();
		const globalBox = (x0: number, y0: number, x1: number, y1: number) => {
			const a = road.root.toGlobal({ x: x0, y: y0 });
			const b = road.root.toGlobal({ x: x1, y: y1 });
			return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
		};
		symbolPopupBoard.cellAt = (x, y) => {
			if (!road.root.parent) return null;
			road.root.toLocal({ x, y }, undefined, local);
			const reel = Math.floor((local.x - BX) / PITCH);
			if (reel < 0 || reel >= ROAD_ART.board.columns || local.y < LINES[0] || local.y >= LINES[ROAD_ART.board.rows]) return null;
			let row = 0;
			while (row < ROAD_ART.board.rows - 1 && local.y >= LINES[row + 1]) row += 1;
			return { reel, row };
		};
		symbolPopupBoard.what = (reel, row) => {
			const snap = road.snapshot();
			const column = snap.features.columns.find((c) => c.reel === reel);
			if (column) return `CW_${column.tier}`;
			if (snap.features.clouds.includes(reel * ROAD_ART.board.rows + row)) return 'GW';
			const code = snap.board[reel]?.[row];
			return code && (isPaying(code) || code === 'W' || code === 'S') ? code : null;
		};
		symbolPopupBoard.cellBox = (reel, row) => globalBox(BX + reel * PITCH, LINES[row], BX + (reel + 1) * PITCH, LINES[row + 1]);
		symbolPopupBoard.reelBox = (reel) => globalBox(BX + reel * PITCH, LINES[0], BX + (reel + 1) * PITCH, LINES[ROAD_ART.board.rows]);
		symbolPopupBoard.boardBox = () => globalBox(BX, LINES[0], BX + ROAD_ART.board.width, LINES[ROAD_ART.board.rows]);
		symbolPopupBoard.quiet = () => road.atRest && !(scoreboard?.backBusy() ?? false) && !wheel.active;
	}

	onMount(() => {
		const app = context.stateApp.pixiApplication;
		// a column character's sheet goes to the GPU when it has loaded, not on the frame it is first drawn
		setClipUploader(app ? (texture) => app.renderer.prepare.upload(texture) : null);
		// the seated drivers' animation sheets the same way (game/road/seatedClips.ts)
		setSeatUploader(app ? (texture) => app.renderer.prepare.upload(texture) : null);
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
		if (!PHONE_TIER) enableMipmaps(tex('presentStillRed')?.source, app?.renderer as PIXI.Renderer | undefined);
		// the wagon's tree and the seated drivers' sheets (game/road/wagonTree.ts, seated.ts) are drawn as small: the same
		if (!PHONE_TIER) enableMipmaps(tex('H2_R_tree')?.source, app?.renderer as PIXI.Renderer | undefined);
		if (!PHONE_TIER) enableMipmaps(tex('seat_grandma')?.source, app?.renderer as PIXI.Renderer | undefined);
		// THE REINDEER'S RUN VIEWS (game/road/reindeerRun.ts): loaded in the background from now on, never holding up the
		// preload; the desktop sheets are drawn well under their 3x size on most screens, so they get a mip chain too
		if (!PHONE_TIER) setRunMipmapper((source) => enableMipmaps(source, app?.renderer as PIXI.Renderer | undefined));
		// THE ROAMING REINDEER'S FRAMES (game/road/roamFrames.ts): after the run views, the same way (STRIKE.roam), and only
		// once the press screen has gone (the old billboard's textures were destroyed as it left, and the warm-up of that
		// time could still hold them in Pixi's queue behind a long upload; since 2026-11-17 game/gpuWarm.ts has its own
		// queue that skips a destroyed or let go source, and runs while the press screen waits)
		if (!PHONE_TIER) setRoamMipmapper((source) => enableMipmaps(source, app?.renderer as PIXI.Renderer | undefined));
		const roamLoad = () => {
			if (led) setTimeout(roamLoad, 500);
			else setTimeout(() => STRIKE.roam && void loadRoamFrames(), 1500);
		};
		void loadRunViews().then(roamLoad);
		// THE PRESENT'S PEEK (game/road/present.ts): its sheet loads in the background from now on, after everything else in
		// the upload queue; a present that lands before it is in stays still. Desktop sheets get a mip chain.
		if (!PHONE_TIER) setPresentMipmapper((source) => enableMipmaps(source, app?.renderer as PIXI.Renderer | undefined));
		// THE SUPER WHEEL's sheet (game/road/superWheel.ts) is drawn under its size on most desktop windows: the same chain
		if (!PHONE_TIER) setWheelMipmapper((source) => enableMipmaps(source, app?.renderer as PIXI.Renderer | undefined));
		void loadPresent('peek');
		// THE WILDS' MULTIPLIERS (game/road/wildMult.ts): their atlas loads in the background from now on, never in the
		// preload, and goes to the GPU in the upload queue's turn (at once when the first board's columns wait on it);
		// its sheet is drawn well under its 3x size on both tiers (a long number shrinks to the frame): a mip chain on both
		setWildMultMipmapper((source) => enableMipmaps(source, app?.renderer as PIXI.Renderer | undefined));
		void loadWildMult();
		// THE WILDS' FRAMES (game/road/garland.ts, the tinsel garland): their atlas the same way, a mip chain on both tiers
		setGarlandMipmapper((source) => enableMipmaps(source, app?.renderer as PIXI.Renderer | undefined));
		void loadGarland();
		const tick = (ticker: PIXI.Ticker) => {
			// THE SIGN IDLE (constants SIGN_WIN idleShow) only on an idle board (the symbol popup's rule)
			road.signIdleOk = boardIdle();
			road.update(ticker.deltaMS * devClock.rate, boardRate(), stateGame.hurryLevel > 0 ? ROAD_MOTION.hurryRate : 1);
			// THE SUPER WHEEL on the board's own pace (turbo, a slam stop's hurry); its Autoplay Bonuses wait counts real time
			wheel.update(ticker.deltaMS * devClock.rate, boardRate());
			led?.update(ticker.deltaMS, boot.pressReady);
			// THE FIRST BOARD'S COLUMNS COME ALIVE (game/road/roadFeatures.ts loadLandingIdle): their idle clips load once the
			// press gate is open (the boot is done), so the splash never waits on them; the still stands until each is in (a
			// round to resume puts its own board up at the press: nothing loaded for the posed one)
			if (boot.pressReady && !stateBet.betToResume?.active) road.features.loadLandingIdle();
			logo?.update(ticker.deltaMS);
			// the sign easing back from its press screen place (a straight move, real ms)
			if (logoLift !== logoLiftWant) {
				logoLiftFrom ??= logoLift;
				const step = (Math.abs(logoLiftFrom - logoLiftWant) * ticker.deltaMS) / Math.max(1, LOGO_SIGN.pressLiftBackMs);
				logoLift = Math.abs(logoLiftWant - logoLift) <= step ? logoLiftWant : logoLift + Math.sign(logoLiftWant - logoLift) * step;
				if (logoLift === logoLiftWant) logoLiftFrom = null;
				placeLogo();
			}
			// THE SCENE SETTING, then THE SCENE SWAP (real ms: the cross-fade keeps its own time, as the logo does)
			takeSceneSet();
			swap.update(ticker.deltaMS);
			if (scoreboard) {
				const free = stateGame.gameType === 'freegame';
				if (!free) fsDone = 0;
				// true idle (the race may run): the base game, no autoplay, no round playing; the scatter count as the road sees it
				const idle = !free && !stateGame.busy && stateBet.autoSpinsCounter <= 0;
				if (pressOnBoard) scoreboard.pressGate(boot.pressReady);
				// ONE PROMPT (2026-11-18): while the strip says PRESS ANYWHERE the press screen's HTML line steps aside (Corey saw
				// both when the tune panel's Free Spins entry took the board over the press screen)
				const sp = scoreboard.pressLineShown();
				if (boot.stripPress !== sp) boot.stripPress = sp;
				scoreboard.update(ticker.deltaMS, { free, left: Math.max(0, stateGame.totalFs - fsDone), idle, scatter: road.scatterCount() });
				// the HUD's WIN lights a step brighter and a board tap leaves the spin alone while a big win counts or holds
				const busy = scoreboard.busy();
				if (stateGame.winShowing !== busy) stateGame.winShowing = busy;
				// THE SHAKE (part B): the road and the logo move with the scoreboard's shake (the snow cover and the board inside)
				const dy = scoreboard.shakeY;
				if (dy !== shookY) {
					shookY = dy;
					road.root.y = roadBaseY + dy;
					if (logo) logo.root.y = logoBaseY + dy;
				}
			}
		};
		app?.ticker.add(tick);
		return () => {
			// Equivalent to onDestroy(); Leave this comment for searching.
			app?.ticker.remove(tick);
			led?.destroy();
			led = null;
			logo?.destroy();
			scoreboard?.destroy();
			wheel.destroy();
			stateGame.wheelPhase = null;
			road.destroy();
		};
	});

	context.eventEmitter.subscribeOnMount({
		boardLandingPress: async () => {
			// (the press screen on the board: the board powers down and lowers with its own motion, the dim lifts)
			if (pressOnBoard && scoreboard) await scoreboard.endPress();
			await led?.exit();
		},
		boardLandingEnd: () => {
			road.setLandingDim(false);
			// the posed board stays as the first board (its columns leave at the first spin's press); a round to resume
			// (or the old press screen) puts its own board up as before
			if (!LED_SIGN.on || stateBet.betToResume?.active) {
				road.features.endLanding();
				road.setBoard(stateGame.board);
			}
			// the posed columns that stay play their idle (the press gate's own call has normally asked already: once only)
			road.features.loadLandingIdle();
		},
		boardSnap: ({ board }) => {
			road.features.clearAll();
			road.setBoard(board);
		},
		boardDriveOut: () => {
			road.features.clearAll();
			road.driveOut(stateGame.turboLevel);
			// a new spin's press cuts the Grandma gag and a small win on the strip short
			scoreboard?.spinPress();
		},
		boardDriveIn: async ({ board }) => {
			// THE TEASE (constants LANE_FLOW): a feature round's spin decides at three (the retrigger), and has at most one
			// tease per feature round
			const free = stateGame.gameType === 'freegame';
			const tease = !free || !LANE_FLOW.tease.oncePerFeature || !stateGame.featureTeased;
			const drive = road.driveIn(board, stateGame.turboLevel, { free, tease });
			if (free) fsDone = stateGame.spinsPlayed + 1;
			if (free && road.flowSnapshot().plan?.teaseFrom != null) stateGame.featureTeased = true;
			await drive;
		},
		boardHeld: ({ held }) => road.features.syncHeld(held),
		boardStrike: async ({ strike, gag }) => {
			// (its sounds come from its frames: the alert on its first, roadFeatures.updateRunner; the borrowed sfx_swipe
			// that stood here until 2026-11-15 is gone)
			await road.features.strike(strike);
			// THE GRANDMA GAG (constants LED_BOARD.gag): the reindeer has struck a Grandma's car and the book's rule says it
			// plays (game/bookEventHandlerMap.ts strike: the base game always; a bonus round's first, or a paying spin's)
			if (gag) {
				devGags += 1;
				// THE SHORT LINE (constants LED_BOARD.gagShortIn): one screen in autoplay, a bonus round and turbo; the full
				// three screen line only in manual base play
				const S = LED_BOARD.gagShortIn;
				const short = (S.auto && stateBet.autoSpinsCounter > 0) || (S.free && stateGame.gameType === 'freegame') || (S.turbo && stateGame.turboLevel > 0);
				devGagModes.push(short ? 'short' : 'full');
				scoreboard?.gag(short);
			}
		},
		boardGrandmaWild: async ({ cell, multiplier }) => {
			await road.features.grandmaWild(cell, multiplier);
		},
		boardColumnWild: async ({ reel, tier, multiplier, sticky, fromCell, joinAdd }) => {
			await road.features.columnWild(reel, tier, multiplier, sticky, fromCell, joinAdd);
			// THE SUPER WHEEL has left into this column and it has grown: the roaming reindeer may walk back in
			if (roamBackDue) {
				roamBackDue = false;
				road.features.roam.back(SUPER_WHEEL.roamBackMs);
			}
		},
		boardWinShow: async ({ wins, amountText, multiplier, capped, stripTotal, big }) => {
			// every time of the win (the lights' stagger and draw, the hold after the total) is this share at the turbo level
			const pace = LINE_WIN.holdShare[stateGame.turboLevel] ?? 1;
			// TREATMENT B (constants LINE_WIN slam): the spin's total on the strip, plain (no multiplier), counting up, on the win
			// clock's frame it is due (never waited for: a small win)
			const amount = stripTotal ?? 0;
			const onTotal =
				scoreboard && amount > 0
					? () => {
							const value = bookEventAmountToNormalisedAmount(amount);
							const countMs = LINE_WIN.slam.stripTotal === 'count' ? Math.max(1, LINE_WIN.slam.stripCountMs * pace) : 1;
							void scoreboard.win({ x: bookEventAmountToBetAmountMultiplier(amount), amount: value, bet: bookEventAmountToNormalisedAmount(100), fmt: ledAmount(value), rate: motionFor(stateGame.turboLevel).rate, auto: stateBet.autoSpinsCounter > 0, small: true, countMs });
						}
					: null;
			await road.showWin(wins, amountText, LINE_WIN.holdMs * pace, multiplier, { pace, capped, onTotal, big: !!big, phone: sceneView?.uprightPhone ?? false });
		},
		boardWinClear: () => road.clearWin(),
		boardPulse: async ({ cells, ms }) => {
			// THE PRESENTS OF A TRIGGER play their full open with the light (game/road/present.ts), the other symbols dimmed
			// for as long; without the open's pictures in time they pulse as before (with the pop on the pulse's first frame)
			if (await road.presentsReady()) {
				await Promise.all([road.openPresents(cells), road.pulseCells(cells, Math.max(ms, road.presentShowMs() / boardRate()))]);
			} else await road.pulseCells(cells, ms, true); // (the presents' pop on the pulse's first frame, as on the open's)
			road.clearWin();
		},
		boardScoreboardWin: async ({ amount, small }) => {
			if (!scoreboard || amount <= 0) return;
			const value = bookEventAmountToNormalisedAmount(amount);
			const auto = stateBet.autoSpinsCounter > 0;
			await scoreboard.win({ x: bookEventAmountToBetAmountMultiplier(amount), amount: value, bet: bookEventAmountToNormalisedAmount(100), fmt: ledAmount(value), rate: motionFor(stateGame.turboLevel).rate, auto, small });
		},
		boardScoreboardCard: ({ kind, spins, amount, topUp, capped, presents }) => {
			if (!scoreboard) return;
			const value = bookEventAmountToNormalisedAmount(amount);
			const fmt = ledAmount(value);
			// a wrap-up's own lines, word for word as the HTML card said them (ui/RoundCard.svelte), for the strip: the cap (the
			// card's social wording on every build: the board shows no betting words) and the top-up, its amount from the book
			// as the card wrote it (bookEventAmountToCurrencyString)
			const lines: string[] = [];
			if (capped) lines.push(`${config.maxWin.toLocaleString('en-US')}x the play amount, the most a round can award.`);
			if (topUp) lines.push(`Includes ${ledSentenceAmount(bookEventAmountToCurrencyString(topUp.amount), stateBet.currency)} added to bring this round up to its ${topUp.floor / 100}x minimum.`);
			// (2026-11-19: the round's multiple and the cap for the Total Win's ladder, LED_BOARD.ideas)
			scoreboard.card({ kind, spins, amount: value, fmt, rate: motionFor(stateGame.turboLevel).rate, title: capped ? 'MAX WIN' : null, line: lines.length ? lines.join('  ') : null, x: kind === 'total' ? bookEventAmountToBetAmountMultiplier(amount) : 0, capped: !!capped, auto: stateGame.autoPlayBonuses && stateBet.autoSpinsCounter > 0, presents: presents ?? 0 });
		},
		boardScoreboardCardEnd: () => scoreboard?.endCard(),
		// a Spin press while a big win counts or holds (the slam stop's event): lands the count, or ends the hold
		stopButtonClick: () => {
			if (scoreboard?.busy()) scoreboard.skip();
			// THE SUPER WHEEL: the slam stop's press takes a spinning wheel (or its ring) straight to the book's stop
			wheel.skip();
		},
		boardSuperWheel: async ({ plan }) => {
			// a slam stop spent on the trigger spin ends here: the wheel comes out at the round's own pace
			context.eventEmitter.broadcast({ type: 'stopButtonEnable' });
			wheelUnderBoard();
			await wheel.play(plan);
			wheelLayerBack();
			// (a wheel that could not play never came to rest: the red present's sheets go here, game/road/present.ts)
			presentWheelDone();
		},
		wheelPress: () => {
			wheel.press();
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
			/** THE SIGN RIGS as drawn (constants SIGN_WIN, game/road/signRig.ts), and a sign's win or idle by hand:
			 *  __reindeer.signShow(cell, 'win' | 'idle', pace) */
			signs: () => road.signSnapshot(),
			signShow: (cell: number, kind: 'win' | 'idle' = 'win', pace = 1) => road.devSignShow(cell, kind, pace),
			/** the road board itself (pass 6 probes: the column frame, the seated crops, the shadow sheet); DEV only */
			roadBoard: () => road,
			/** THE WILDS' MULTIPLIERS (game/road/wildMult.ts): every one as drawn (value, move, letters' canvas boxes), and
			 *  the atlas's weight */
			wildMult: () => road.features.multipliers(),
			wildMultMemory: () => wildMultMemory(),
			/** THE WILDS' FRAMES (game/road/garland.ts): every one as laid, and the frame atlas's weight */
			wildFrames: () => road.features.frames(),
			garlandMemory: () => garlandMemory(),
			atRest: () => road.atRest && !stateGame.busy,
			/** the game takes a Spin press as a new round now (the round machine idle, no round live): a manual base win's
			 *  round stays open past atRest until its LED count lands (game/utils.ts ledCountDone), and a press then is its
			 *  STOP (tools/rider_probe_lib.mjs stepRound waits for this) */
			pressReady: () => context.stateXstateDerived.isIdle() && !stateGame.busy,
			board: () => stateGame.board.map((reel) => [...reel]),
			gameType: () => stateGame.gameType,
			/** the layout in use and where the board's cells are, master units and CSS px */
			/** THE SCENE (scene pass 9): the preset, what the scene layers drew, the billboard's box (road px and CSS px) and its
			 *  lamps; `logoHold(ms)` freezes the lamps' time (null runs it again) */
			scene: () => {
				const masterLeft = main.x - (main.width * main.scale) / 2;
				const masterTop = main.y - (main.height * main.scale) / 2;
				const k = place.scale * main.scale;
				const ox = masterLeft + place.x * main.scale;
				const oy = masterTop + place.y * main.scale;
				const b = logo?.box ?? null;
				return {
					preset: stateScene.preset.name,
					layers: road.scene.last,
					picture: { x: ox, y: oy, width: 1536 * k, height: 1024 * k, k },
					logo: b
						? {
								road: b,
								css: { x: ox + b.x * k, y: oy + b.y * k, width: b.width * k, height: b.height * k },
								lamps: logo!.levels(),
								/** its lowest visible pixel (CSS px), the drawn forest's tree line under it (CSS px, null: no forest), and
								 *  how far it moved down off the trees and fell short (road px) */
								foot: oy + (b.y + logoFootShare() * b.height) * k,
								treeLine: (() => {
									const f = road.scene.last.forest;
									const line = f ? (FOREST_LINE[stateScene.preset.kit]?.line as readonly number[] | undefined) : undefined;
									if (!f || !line) return null;
									let y = -Infinity;
									for (let i = 0; i < line.length; i++) {
										const a = f.x + (f.width * i) / line.length;
										const c = f.x + (f.width * (i + 1)) / line.length;
										if (c > b.x && a < b.x + b.width) y = Math.max(y, f.y + f.height * line[i]);
									}
									return Number.isFinite(y) ? oy + y * k : null;
								})(),
								drop: logoTreeDrop,
								short: logoTreeShort,
							}
						: null,
				};
			},
			/** THE SCENE SWAP (game/scene/sceneSwap.ts): the preset shown, wanted and on the DOM side, the fade, the skins, every
			 *  scene piece loaded (MB, on the GPU or not) and its log; `sceneWant(name)` asks for a preset by hand (as the tune
			 *  panel's buttons); `gpuTextures()` every texture the renderer holds on the GPU (MB, mips counted) */
			sceneSwap: () => swap.snapshot((src) => !!(context.stateApp.pixiApplication?.renderer as unknown as { texture?: { managedTextures?: PIXI.TextureSource[] } } | undefined)?.texture?.managedTextures?.includes(src)),
			sceneWant: (name: ScenePresetName) => (stateScene.want = name),
			/** THE SCENE SETTING (dark mode): the player's choice by hand, as the switch sets it ('auto', 'snow', 'dark'), and
			 *  the setting as it stands (the choice, the device dark or not, the set in use) */
			sceneChoice: (choice: SceneChoice) => setSceneChoice(choice),
			sceneSetting: () => ({ choice: stateScene.choice, dark: stateScene.dark, set: stateScene.set, wait: sceneSetWait }),
			/** the other scene set fetched into the browser's cache on the press screen (game/scenePrefetch.ts) */
			scenePrefetch: () => scenePrefetchState(),
			/** hold a swap's fade where it is once it starts (on), and move it by hand (the probe steps it frame by frame) */
			sceneSwapHold: (on: boolean) => (swap.hold = !!on),
			sceneSwapStep: (ms: number) => {
				swap.step(ms);
				return swap.snapshot(() => false).fade;
			},
			/** the scene alone (on): nothing of the road but its scene layers, no logo, no LED faces (the dim and the snow cover
			 *  stay); off puts everything back as it was. The scene swap probe steps a fade so, with nothing else in the frame. */
			sceneOnly: (on: boolean) => {
				const keep = new Set<PIXI.Container>([road.scene.field, road.scene.picture, road.scene.bands, road.scene.forest, road.scene.cover, road.scene.tunnels, road.scene.ends]);
				// (a scene swap's picture is the scene's too: game/scene/sceneSnapshot.ts)
				for (const c of road.root.children) if (!keep.has(c) && c.label !== 'scene:snapshot') c.renderable = !on;
				if (logo) logo.root.renderable = !on;
				scoreboard?.devSceneOnly(on);
			},
			/** every sprite the scene layers show now: those with no texture to draw (an empty or destroyed one) are counted */
			sceneSprites: () => {
				let shown = 0;
				let missing = 0;
				const walk = (node: PIXI.Container) => {
					if (!node.visible || node.alpha <= 0) return;
					if (node instanceof PIXI.Sprite) {
						shown += 1;
						const t = node.texture;
						if (!t || t === PIXI.Texture.EMPTY || t.destroyed || !t.source || t.source.destroyed) missing += 1;
					}
					for (const child of node.children) walk(child as PIXI.Container);
				};
				for (const c of [road.scene.field, road.scene.picture, road.scene.bands, road.scene.forest, road.scene.cover, road.scene.tunnels, road.scene.ends]) walk(c);
				return { shown, missing };
			},
			gpuTextures: () => {
				const list = (context.stateApp.pixiApplication?.renderer as unknown as { texture?: { managedTextures?: PIXI.TextureSource[] } } | undefined)?.texture?.managedTextures ?? [];
				let bytes = 0;
				for (const src of list) bytes += src.pixelWidth * src.pixelHeight * 4 * (src.autoGenerateMipmaps ? 4 / 3 : 1);
				return { count: list.length, mb: Math.round((bytes / 1048576) * 100) / 100 };
			},
			logoHold: (ms: number | null) => {
				if (logo) logo.hold = ms;
				return logo?.levels() ?? null;
			},
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
				for (let i = 0; i < n; i++) {
					road.update(ms, boardRate(), stateGame.hurryLevel > 0 ? ROAD_MOTION.hurryRate : 1);
					wheel.update(ms, boardRate());
				}
				return road.snapshot();
			},
			/** THE SUPER WHEEL (game/road/superWheel.ts): what it is doing and where it is drawn; its line on the LED strip; a
			 *  wheel standing with nothing running, from a round's events (the probe's stills and measurements: wheelSet poses
			 *  it, wheelEnd takes it down); its sheet's weight */
			wheel: () => ({ ...wheel.snapshot(), line: scoreboard?.wheelLineNow() ?? null, hudPhase: stateGame.wheelPhase }),
			wheelShow: async (events: Parameters<typeof buildWheelPlan>[0]) => {
				const plan = buildWheelPlan(events);
				if (!plan) return false;
				wheelUnderBoard();
				return wheel.devShow(plan);
			},
			wheelSet: (o: Parameters<SuperWheel['devSet']>[0]) => wheel.devSet(o),
			/** the LED scoreboard (drawn over the wheel's foot) not drawn, for the probe's measurements of the whole wheel */
			wheelAlone: (on: boolean) => {
				if (scoreboard) scoreboard.root.renderable = !on;
			},
			wheelEnd: () => {
				wheel.devEnd();
				wheelLayerBack();
			},
			/** the strip's blinking wheel line held lit (the probe's stills) */
			wheelSteady: (on: boolean) => scoreboard && (scoreboard.devWheelSteady = !!on),
			wheelMemory: () => wheelMemory(),
			/** put any board up at rest: __reindeer.setBoard([[...4 symbols] x 5 reels]) */
			setBoard: (board: BoardSymbols) => {
				// (the first board's posed columns go first: a board put up by hand stands alone)
				road.features.endLanding();
				road.setBoard(board);
			},
			/** hold both stoplights on 'red', 'amber' or 'green', or dark (null); no argument hands them back to the board */
			signal: (...color: ['red' | 'amber' | 'green' | null] | []) => road.forceSignal(color.length ? color[0] : undefined),
			/** the column characters' pictures that are loaded now, and what they weigh on the GPU */
			clipMemory: () => clipMemory(),
			/** the reindeer's run views: loaded or not, their sheets, what they weigh on the GPU */
			runMemory: () => runMemory(),
			/** THE SCATTER PRESENT: its sheets loaded now and their GPU weight; the per-frame trace of its animations
			 *  (clear = true empties it); the full open by hand on the board as it stands (no book, no sound) */
			/** LANE BY LANE TRAFFIC AND THE TEASE (constants LANE_FLOW): the last drive in's plan as played, the spins'
			 *  lengths, the lights; THE BRAKE LIGHTS per car (constants BRAKE_LIGHTS) */
			flow: () => road.flowSnapshot(),
			/** the lights and the clock only (the lane stagger probe reads it every frame) */
			flowLite: () => road.flowLite(),
			/** THE LED BILLBOARD as drawn (game/landing/ledSign.ts): its place, dots, screen, mode, cost; freeze(t) holds its
			 *  screens' time at t s (null runs it again) */
			led: () => led?.snapshot() ?? null,
			ledFreeze: (t: number | null) => led?.freeze(t),
			/** the sign driven by hand (on), and stepped `ms` at a time (the evidence's frame by frame clips) */
			ledManual: (on: boolean) => led && (led.manual = on),
			ledStep: (ms: number) => led?.step(ms, boot.pressReady),
			/** THE LED SCOREBOARD (game/scoreboard/): what it draws and where; a win by hand (x play multiples; no book, nothing
			 *  waits on it unless awaited); the gag; the race (its own random source: tally n seeded runs, trace one); skip;
			 *  driven by hand (manual, then step ms at a time); raise / lower the back board (a demo win that holds) */
			scoreboard: () => scoreboard?.snapshot() ?? null,
			scoreboardWin: (x: number, opts: { auto?: boolean; rate?: number; small?: boolean; countMs?: number } = {}) => {
				if (!scoreboard) return null;
				const bet = bookEventAmountToNormalisedAmount(100);
				const value = Math.round(x * bet * 100) / 100;
				// countMs (2026-11-18): a small win counted as a line win's strip total is (LINE_WIN.slam.stripCountMs)
				return scoreboard.win({ x, amount: value, bet, fmt: ledAmount(value), rate: opts.rate ?? 1, auto: !!opts.auto, small: opts.small, countMs: opts.countMs });
			},
			scoreboardGag: (short = false) => scoreboard?.gag(short),
			scoreboardSkip: () => scoreboard?.skip() ?? false,
			/** a scatter count by hand in place of the road's ({ id, count, need, live, hit, reached }; undefined: the road's) */
			scoreboardScatter: (read: ScatterRead | null | undefined) => scoreboard && (scoreboard.devScatter = read),
			/** the road's scatter count now (game/road/roadBoard.ts scatterCount) */
			scatterCount: () => road.scatterCount(),
			/** which Grandma line each gag the strikes asked for played ('full', 'short'; constants LED_BOARD.gagShortIn) */
			gagModes: (clear = false) => {
				const out = [...devGagModes];
				if (clear) devGagModes = [];
				return out;
			},
			scoreboardManual: (on: boolean) => scoreboard && (scoreboard.manual = !!on),
			scoreboardStep: (ms: number, n = 1) => {
				for (let i = 0; i < n; i++) scoreboard?.step(ms);
				return scoreboard?.snapshot() ?? null;
			},
			scoreboardRaise: (x?: number) => scoreboard?.raise(x),
			/** PART B: a bonus round card's scene by hand (kind fs, sfs or total; no HTML card: press or end it by hand) */
			// (2026-11-19) `play`: the play amount the multiple is of (the bet by default), `capped` (default: a MAX WIN title),
			// `auto`: as Autoplay Bonuses raises it, `presents`: the trigger's scatter count (0: the tune panel's fallback)
			scoreboardCard: (kind: 'fs' | 'sfs' | 'total', opts: { spins?: number; x?: number; rate?: number; line?: string; title?: string; play?: number; capped?: boolean; auto?: boolean; presents?: number } = {}) => {
				if (!scoreboard) return;
				const x = opts.x ?? 248.5;
				const value = Math.round(x * (opts.play ?? bookEventAmountToNormalisedAmount(100)) * 100) / 100;
				scoreboard.card({ kind, spins: opts.spins ?? 10, amount: value, fmt: ledAmount(value), rate: opts.rate ?? 1, line: opts.line ?? null, title: opts.title ?? null, x, capped: opts.capped ?? opts.title === 'MAX WIN', auto: !!opts.auto, presents: opts.presents ?? 0 });
			},
			scoreboardCardPress: () => scoreboard?.cardPress() ?? false,
			scoreboardFace: (which: 'strip' | 'back', png = false) => scoreboard?.faceStats(which, png) ?? null,
			/** the play currency by hand (the LED currency probe: the boards' symbols and the fallback; game/scoreboard/ledCurrency.ts) */
			ledCurrency: (code: string) => (stateBet.currency = code as typeof stateBet.currency),
			scoreboardCardEnd: () => scoreboard?.endCard(),
			scoreboardLower: () => scoreboard?.lower(),
			scoreboardRace: (force: 'reindeer' | 'police' | 'tie' | null = null) => scoreboard?.race(force),
			raceTally: (seed: number, n: number) => raceTally(seed, n),
			raceTrace: (force: 'reindeer' | 'police' | 'tie' | null = null) => raceTrace(newRace(force)),
			raceSeed: (seed: number) => reseedRace(seed),
			/** the seated drivers' idle on a clock of the caller's (ms; null: real time), for frame by frame captures */
			seatTime: (ms: number | null) => (road.seatTime = ms),
			brakes: () => road.brakeSnapshot(),
			/** SKIP TO RESULT on or off by hand (the lane stagger probe: the tease's loop stops under it) */
			skip: (on: boolean) => (stateGame.skipping = !!on),
			/** a slam stop's hurry now (0 = none), and the free spin under way (1-based; 0 outside a bonus round) */
			hurryLevel: () => stateGame.hurryLevel,
			/** a book amount in the play's currency units, as the HTML cards showed it (the LED probe's Total Win check) */
			bookAmount: (a: number) => bookEventAmountToNormalisedAmount(a),
			freeSpinNow: () => (stateGame.gameType === 'freegame' ? stateGame.spinsPlayed + 1 : 0),
			/** the Grandma gags strikes have asked for since the last clear (the book's rule, bookEventHandlerMap strike) */
			gagsAsked: (clear = false) => {
				const n = devGags;
				if (clear) devGags = 0;
				return n;
			},
			/** THE CAST SHADOWS as drawn (game/road/shadows.ts; the numbers are tune.shadow), and what the road draws:
			 *  every sprite shown (visible all the way up and renderable), and how many of them are shadows */
			shadows: () => road.shadowSnapshot(),
			/** THE POLICE CARS' LIGHT BARS as drawn (game/road/policeLights.ts; the numbers are tune.policeLights) */
			police: () => road.policeSnapshot(),
			/** THE VANS' WIN as drawn (game/road/vanWin.ts; the numbers are tune.vanWin) */
			vans: () => road.vanSnapshot(),
			/** THE WAGONS' CHRISTMAS TREE as drawn (game/road/wagonTree.ts; the numbers are tune.wagonTree) */
			trees: () => road.treeSnapshot(),
			/** THE SEATED DRIVERS as drawn (game/road/seated.ts; the numbers are tune.seated, the placement tune.seated.place) */
			seated: () => road.seatedSnapshot(),
			/** riders (trees, drivers) or their shadows drawn without their vehicle: always 0 */
			strayRiders: () => road.strayRiders(),
			/** THE SEATED DRIVERS' ANIMATIONS: the sheets loaded now and their GPU MB (game/road/seatedClips.ts) */
			seatClipMemory: () => seatClipMemory(),
			/** the riders' sheets as loaded: their size and GPU weight (mips counted when the sheet has them) */
			riderMemory: () => {
				const out: Record<string, { w: number; h: number; mips: boolean; mb: number }> = {};
				for (const [name, frame] of [['wagonTree', 'H2_R_tree'], ['seated', 'seat_grandma']] as const) {
					const src = tex(frame)?.source;
					if (!src) continue;
					const mips = !!src.autoGenerateMipmaps;
					out[name] = { w: src.pixelWidth, h: src.pixelHeight, mips, mb: Math.round(((src.pixelWidth * src.pixelHeight * 4 * (mips ? 4 / 3 : 1)) / 1048576) * 1000) / 1000 };
				}
				return out;
			},
			/** THE CHRISTMAS LIGHTS WIN LINES as drawn (game/road/winLights.ts; the numbers are tune.lineWin.lights): each line's
			 *  start, draw fraction, bulbs lit, palette, own amount (its box), and the total */
			winLights: () => road.winLightsSnapshot(),
			/** the lights drawn or not, the win itself untouched (the probe's cost: the same frozen frame with and without) */
			winLightsShown: (on: boolean) => road.devWinLightsShown(on),
			/** an animation moment from outside the road (the bonus round cards, the ambience) into the road's sound log, on
			 *  the board's current frame (the sound probe sets it against the sound's own play) */
			markMoment: (what: string, detail?: string) => road.features.sounds.mark(what, detail),
			roadSprites: () => {
				let sprites = 0;
				let shadows = 0;
				const walk = (node: PIXI.Container) => {
					if (!node.visible || node.alpha <= 0) return;
					if (node instanceof PIXI.Sprite && node.renderable && node.texture && node.texture !== PIXI.Texture.EMPTY) {
						sprites += 1;
						if (node.label === 'shadow') shadows += 1;
					}
					for (const child of node.children) walk(child as PIXI.Container);
				};
				walk(road.root);
				return { sprites, shadows };
			},
			presentMemory: () => presentMemory(),
			presentTrace: (clear = false) => presentTrace(clear),
			presentLoad: (group: 'peek' | 'open', variant: 'teal' | 'red' = 'teal') => loadPresent(group, variant),
			presentPeek: (cell: number) => road.peekPresentAt(cell),
			presentOpen: async (cells: number[]) => {
				if (!(await road.presentsReady())) return false;
				return road.openPresents(cells);
			},
			/** THE ROAD'S SOUNDS (game/road/roadSounds.ts): its log of animation moments and sounds asked (clear = true
			 *  empties it), the loops it holds on, the board's frame count, and the snort's roll forced ('always' / 'never')
			 *  or back to its odds (null) */
			roadSounds: (clear = false) => road.features.sounds.trace(clear),
			roadSoundState: () => road.features.sounds.state(),
			frame: () => road.features.frameNo,
			forceSnort: (mode: 'always' | 'never' | null) => (road.features.sounds.forceSnort = mode),
			/** run a strike into a cell by hand (no book; its own sounds play, game/road/roadSounds.ts): __reindeer.strike(cell). Resolves at the impact. */
			strike: (cell: number, grandma = false) => {
				road.features.endLanding();
				// (BRAWL: `grandma` true runs it as a Grandma car's strike: its end at the car's rear)
				return road.features.strike({ cell, markCell: null, grandma });
			},
			/** THE ROAMING REINDEER (game/road/roam.ts): what he is doing and where, his area as resolved; a strike by hand as
			 *  the first of a spin (his, when he is on the screen) and the last (a new one walks in after it); his sheets'
			 *  GPU weight; the zones he must keep out of (CSS px); the areas (live, editable) and their defaults; a run of
			 *  seeded picks (nothing moves); reseed him; stand him somewhere; walk a new one in; a bonus round's sign by hand */
			roam: () => road.features.roam.snapshot(),
			roamStrike: (cell: number, opts: { first?: boolean; last?: boolean; grandma?: boolean } = {}) => {
				road.features.endLanding();
				return road.features.strike({ cell, markCell: null, first: opts.first ?? true, last: opts.last ?? true, grandma: opts.grandma ?? false });
			},
			roamMemory: () => roamMemory(),
			roamZones: () => roamZones(),
			roamView: () => roamView,
			roamAreas: () => ROAM_AREAS,
			roamAreasDefault: () => ROAM_AREAS_DEFAULT,
			roamPicks: (count: number, walkIns: number, seed: number) => road.features.roam.devPicks(count, walkIns, seed),
			roamEdited: () => ROAM_EDIT.version++,
			roamReseed: (seed: number) => road.features.roam.reseed(seed),
			roamPlace: () => road.features.roam.placeNow(),
			roamStandAt: (x: number, y: number) => road.features.roam.standAt(x, y),
			roamInArea: (x: number, y: number) => road.features.roam.inAreaNow(x, y),
			roamWalkIn: (delayMs = 0) => road.features.roam.walkInSoon(delayMs),
			/** the Super wheel's hold (game/road/roam.ts away / back): he runs off and stays away; he walks back in */
			roamAway: (prefer: 1 | -1 | 0 = -1) => road.features.roam.away(prefer),
			roamBack: (delayMs = 0) => road.features.roam.back(delayMs),
			roundSign: (on: boolean) => {
				stateGame.gameType = on ? 'freegame' : 'basegame';
				stateGame.totalFs = on ? 10 : 0;
			},
			/** stand a column Wild by hand from a struck cell (no book, no sound), and read its box and clouds as drawn */
			column: (reel: number, tier: 'reindeer' | 'santa' | 'grandma', multiplier: number, fromCell: number | null) => {
				road.features.endLanding();
				return road.features.columnWild(reel, tier, multiplier, false, fromCell);
			},
			columnTrace: (reel: number) => road.features.columnTrace(reel),
			/** BRAWL: the Grandma Wilds' brawl clouds as drawn, the shared frame sets and their memory (game/road/brawlCloud.ts) */
			brawl: () => road.features.brawl.snapshot(),
			/** BRAWL: as a book with (true) or without a Grandma Wild would (its frames warmed, or let go once none stands);
			 *  brawlRoundEnd as the round's end does */
			brawlBook: (grandma = true) => brawlForBook(grandma ? [{ type: 'grandmaWild' }] : []),
			brawlRoundEnd: () => brawlRoundEnd(),
			/** a Grandma crash Wild's cloud on a cell by hand (no book, no strike; the symbol pay popup probe) */
			grandmaWild: (cell: number, multiplier: number) => {
				road.features.endLanding();
				return road.features.grandmaWild(cell, multiplier);
			},
			/** THE TARGET CROSSHAIR on a posed board (no book; the road's own sounds play, except the cloud loop, which needs a live round): `cells` the valid targets to pose (Grandma's car or
			 *  Santa's sleigh, `kinds` per cell, default H1 for the first and alternating), `target` the struck one (the first
			 *  by default), `follow` then plays the Wild the book would (a Grandma Wild, or a Santa column from the cell).
			 *  Every other cell gets a plain symbol. Resolves at the impact (or when the Wild stands, with follow). */
			crosshairStrike: async (opts: { cells: number[]; target?: number; kinds?: ('H1' | 'W')[]; follow?: boolean; poseOnly?: boolean }) => {
				const FILL = ['L1', 'H2', 'L3', 'H3', 'L5', 'H4', 'L2', 'L4'] as const;
				const board = Array.from({ length: 5 }, (_, reel) => Array.from({ length: 4 }, (_, row) => FILL[(reel * 3 + row * 5) % FILL.length])) as unknown as BoardSymbols;
				opts.cells.forEach((cell, i) => (board[Math.floor(cell / 4)][cell % 4] = opts.kinds?.[i] ?? (i % 2 ? 'W' : 'H1')));
				const target = opts.target ?? opts.cells[0];
				road.features.endLanding();
				road.features.clearAll();
				stateGame.board = board;
				road.setBoard(board);
				if (opts.poseOnly) return;
				// (BRAWL: a Grandma car's strike ends at its rear and lands the brawl cloud)
				const grandma = board[Math.floor(target / 4)][target % 4] === 'H1';
				await road.features.strike({ cell: target, markCell: null, grandma });
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
