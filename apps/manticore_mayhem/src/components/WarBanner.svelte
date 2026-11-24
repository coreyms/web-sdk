<script lang="ts" module>
	import type { StingerMode } from '../game/stinger/types';

	/**
	 * THE WAR STANDARD BANNER's flow (approved 2026-11-13, game build 2026-11-14): what ModePlaque (the feature intro) and
	 * FreeSpinOutro (the TOTAL WIN wrap up) ask of the banner. They keep their events, their press gates and their state
	 * flags exactly as they were with the plaque; the banner only draws, paces the count and plays the screen's cues.
	 * A Max Win wrap up (the win ladder's titles) stays on the animated plaque (components/StingerPlaque.svelte).
	 */
	export type WarBannerFlow = {
		/** the motion and the glyph atlas are in */
		ready: () => boolean;
		/** the baked rules say the book's tile cap (the spin count is drawn live, any count reads right) */
		introMatches: (mode: StingerMode, tileCap: number) => boolean;
		/** the feature intro: resolves once the press gate may open (true), or false at once when the cloth could not be
		 *  shown (its texture failed): the caller keeps its plaque / plain screen */
		intro: (o: { mode: StingerMode; totalFs: number }) => Promise<boolean>;
		/** the mode's intro cloth and its glyphs are decoded and on the GPU NOW (intro would show it without a wait) */
		introUp: (mode: StingerMode) => boolean;
		/** the wrap up: TOTAL WIN, the count of the book's amount, resolves when the count has landed (true), or false at
		 *  once when the cloth could not be shown. `tier` = the total's own tier (its clip on the impact when `sound`) */
		wrap: (o: { amount: number; tier: number; mode: StingerMode; spins: number; durationMs: number; sound: boolean }) => Promise<boolean>;
		/** resolves once the IN n ... line has faded in */
		lineIn: () => Promise<void>;
		/** a press while the amount counts (or the cloth still unrolls): straight to the hung banner, the final amount */
		skip: () => void;
		counting: () => boolean;
		/** THE TOTAL WIN'S OWN COUNT (2026-11-21, the bar's WIN odometer, ui/hud/winOdometer.ts): while a TOTAL WIN screen
		 *  is up and its count has started, its screen number (id), its clock (t, real ms since the screen showed), its
		 *  count's start and end on that clock (a press during the count, skip, moves the end to the press), the amount and
		 *  whether it was pressed through; null before the count starts and once the banner rolls up. The HUD's WIN readout
		 *  reads it each frame and never keeps a timer of its own. Read only. */
		totalCount: () => BannerTotalCount | null;
		/** the exit: resolves when the cloth is rolled up (the roll's retreat and the light's fade go on after) */
		hide: () => Promise<void>;
	};

	export type BannerTotalCount = { id: number; t: number; countStart: number; countEnd: number; amount: number; skipped: boolean };

	export const warBanner: { flow: WarBannerFlow | null } = { flow: null };
</script>

<script lang="ts">
	// THE WAR STANDARD BANNER (game/banner/: spec.ts the numbers, view.ts the drawing, motion.ts the baked cloth;
	// tools/war_banner/ the bake; images/war_banner_2026-11-13/game_build/WIRING_NOTES.md).
	//
	// ALWAYS MOUNTED, between StingerPlaque and Win in Game.svelte (the old plaque's place in the z order: over the board,
	// its readouts and the plaques; under the win screen, the press prompts' text, the transition and the HTML HUD). Its
	// roll goes UNDER the frame plate while it is behind the rail (BoardFrame's bannerBackSlot). The ticker callback runs
	// only while a banner is up.
	//
	// TEXTURES: one cloth texture (a tier and a screen, D desktop / tablet 2048 or P phone 1024, mipmapped) is resident at
	// a time, loaded on demand and unloaded when its screen has gone: the intro's from the feature's start (bonusStart
	// sets the mode, the trigger beat plays meanwhile), the TOTAL WIN's from the feature's last spin (or its end).
	//
	// CUES (the old plaque's, at the same moments relative to the screen appearing, measured from the show):
	//   impact      the old plaque landed at 250 ms; the roll lands on the pole at 300 ms: sfx_plaque_land there (and a
	//               TOTAL WIN's tier clip, as before), 50 ms later than before. No board kick and no chain gust: the
	//               chains run with the banner instead (the trigger run).
	//   count       a TOTAL WIN's amount counts from 400 ms (the old 250 + 150), the house pacing, sfx_money_counter
	//               while it runs (game/stinger/count.ts, the same pacer)
	//   gate        the intro's press gate opens at 1100 ms (the plaque's rows were in at 830 ms; the cloth is unrolled
	//               at 950 and settled at 1200); the wrap up's after the count and its line, as before
	//   exit        the roll up (about 300 ms) where the plaque lifted out in 200; hide() resolves at its end
	import * as PIXI from 'pixi.js';
	import { onMount, untrack } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { bookEventAmountToCurrencyString } from '../game/amount';
	import { stateBet } from 'state-shared';
	import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';

	import { getContext } from '../game/context';
	import { STINGER_DATA_URLS } from '../game/assets';
	import { BONUS_MODE_LABEL, PLAQUE_CHEER, PLAQUE_ESCALATION, CREATURE } from '../game/constants';
	import { layoutKind } from '../game/layoutSpec';
	import { boardRegistration } from '../game/boardArt';
	import { bannerBackSlot, frameLight } from '../game/boardPlateSlot';
	import { creatureUploadQuiet } from '../game/creatureLoad';
	import { epicBannerClass } from '../game/epicLoad';
	import { warmWait } from '../game/fileWarm';
	import { creature } from '../game/creature';
	import { enableMipmaps } from '../game/mipmaps';
	import { chainRun } from '../game/featureFx';
	import { STAGING_TOOLS, perfMark } from '../game/staging';
	import { celebrateShow } from '../game/plaqueCelebrate';
	import { WIN_TIER_SOUND, WIN_TIER_STAGES_END_FEATURE, winLevelMap } from '../game/winLevelMap';
	import { stagedAmountAt, stagedSegments, stagedTotal } from '../game/stinger/count';
	import { loadStingerData } from '../game/stinger/data';
	import { PlaqueFont } from '../game/stinger/text';
	import { STINGER_TIERS } from '../game/stinger/types';
	import { BANNER, BANNER_GLYPHS, BANNER_TEXTURES, bannerTierOf, type BannerClass, type BannerContent, type BannerTier } from '../game/banner/spec';
	import { loadBannerMotion } from '../game/banner/motion';
	import { BannerView } from '../game/banner/view';
	import { featureScreens } from '../game/featurePacing';
	import { hudWinOdometer } from '../game/hudWin.svelte';

	const context = getContext();
	const view = new BannerView();
	getContextParent().addToParent(view.front);

	let built = $state(false);
	let font: PlaqueFont | null = null;
	let motionReady = $state(false);
	let fontReady = $state(false);
	/** the texture class the layout wants now (D / P) */
	let wantCls: BannerClass = 'D';

	// ---- build: the motion, the plaque's font (its JSON is cached by the plaque) and the glyph atlas ---------------
	let motion: Awaited<ReturnType<typeof loadBannerMotion>> | null = null;
	$effect(() => {
		const atlas = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		if (built || !motionReady || !fontReady || !font || !motion) return;
		if (!atlas?.[font.frames[0]]) return;
		view.build(motion, font, atlas);
		built = true;
		if (STAGING_TOOLS) perfMark('banner:built');
	});

	// ---- placement: the pole on the frame's registration, re-derived on every resize -------------------------------
	$effect(() => {
		const kind = layoutKind(context.stateLayoutDerived.layoutType());
		const master = context.stateLayoutDerived.mainLayout();
		const canvas = context.stateLayoutDerived.canvasSizes();
		const vw = canvas.width / master.scale;
		const reg = boardRegistration(kind, vw);
		const pole = reg.map(BANNER.poleX, BANNER.poleY);
		const masterPerDesign = reg.m * BANNER.renderPerDesign;
		const fx = master.x + (pole.x - master.width / 2) * master.scale;
		const fy = master.y + (pole.y - master.height / 2) * master.scale;
		const scale = masterPerDesign * master.scale;
		view.place(fx, fy, scale, canvas.width, canvas.height, pole.x, pole.y, masterPerDesign);
		wantCls = BANNER.width * scale < BANNER.phoneBelowCss ? 'P' : 'D';
		// (THE EPIC ON DEMAND, game/epicLoad.ts: the class whose Epic intro files a book that reaches the Epic fetches first)
		epicBannerClass.current = wantCls;
	});

	// ---- the one resident cloth texture --------------------------------------------------------------------------
	type Res = { key: string; url: string; cls: BannerClass; tier: BannerTier; content: BannerContent; promise: Promise<PIXI.Texture | null>; tex: PIXI.Texture | null; inUse: boolean; glyphs: Record<string, PIXI.Texture> | null; held: boolean };
	let res: Res | null = null;
	/** DEV: every load / unload with its time */
	const texLog: { what: 'load' | 'ready' | 'unload' | 'failed'; key: string; at: number; ms?: number }[] = [];
	const renderer = () => context.stateApp.pixiApplication?.renderer as PIXI.Renderer | undefined;
	// THE BANNER'S OWN COUNT AND AMOUNT GLYPHS (Fix 2, 2026-11-15; game/banner/spec.ts BANNER_GLYPHS): one sheet per texture
	// class, loaded with each screen's cloth and let go with it. Counted per class: the next screen's cloth can be loading
	// (the TOTAL WIN's from the last spin) while the one before is still up, and both name the same sheet
	// THE LET GO IS DEFERRED AND CAN BE TAKEN BACK (Fix 2): a screen's cloth is often let go and the next one's asked for
	// in the same tick (the intro's at its end, the TOTAL WIN's at once under SKIP TO RESULT). The sheet is then kept
	// (its count goes back up before the deferred let go looks), and a sheet asked for while its unload is on its way
	// is loaded again only after that unload: Pixi's cache would otherwise hand back the sheet being destroyed (the
	// "Cannot read properties of null (reading 'addressModeU')" page error at its upload)
	const glyphRefs: Partial<Record<BannerClass, { n: number; promise: Promise<Record<string, PIXI.Texture> | null> }>> = {};
	const glyphGone: Partial<Record<BannerClass, Promise<unknown>>> = {};
	// ONE CACHE KEY PER FRAME (harsh review 2026-11-17 m2, the 131 "[Cache] already has key: stg_g_*" warnings): these
	// sheets carry the plaque glyph atlas's own frame names (stg_g_*), and PIXI.Assets.load of a spritesheet registers
	// every frame name in Pixi's global Cache, so each banner sheet re-registered 65 names the resident plaque atlas
	// (stinger-glyphs) already holds, and its unload then deleted those names from the Cache again. The sheet is now
	// made here: its JSON fetched, its picture loaded through Assets (cached under its own URL only, the same URL Pixi's
	// spritesheet loader asked for: the JSON's ?v= stamp copied on) and its frames cut by PIXI.Spritesheet.parse, which
	// puts nothing in the Cache. The frames and the one texture are the same as before (no extra GPU copy).
	const glyphSheets: Partial<Record<BannerClass, { sheet: PIXI.Spritesheet; image: string }>> = {};
	const glyphSheetLoad = async (cls: BannerClass, url: string): Promise<PIXI.Spritesheet> => {
		// (game/fileWarm.ts may be fetching this sheet into the cache for an Epic: read it from there once it is in)
		await warmWait(url);
		const got = await fetch(url);
		if (!got.ok) throw new Error(`banner glyphs ${got.status}`);
		const data = (await got.json()) as PIXI.SpritesheetData;
		const json = new URL(url, location.href);
		const img = new URL(data.meta.image ?? '', json);
		img.search = json.search;
		const image = img.href;
		const tex = (await PIXI.Assets.load(image)) as PIXI.Texture;
		const sheet = new PIXI.Spritesheet(tex, data);
		await sheet.parse();
		glyphSheets[cls] = { sheet, image };
		return sheet;
	};
	/** the sheet's let go, in the order Pixi's own spritesheet unload uses: the picture (its GPU copy), then the frames */
	const glyphSheetUnload = async (cls: BannerClass): Promise<void> => {
		const have = glyphSheets[cls];
		if (!have) return;
		delete glyphSheets[cls];
		await PIXI.Assets.unload(have.image);
		have.sheet.destroy(false);
	};
	const glyphsLoad = (cls: BannerClass): Promise<Record<string, PIXI.Texture> | null> => {
		const have = glyphRefs[cls];
		if (have) {
			have.n += 1;
			return have.promise;
		}
		const { url, mips } = BANNER_GLYPHS[cls];
		const t0 = performance.now();
		texLog.push({ what: 'load', key: `glyphs-${cls}`, at: t0 });
		const promise = (glyphGone[cls] ?? Promise.resolve())
			.then(() => glyphSheetLoad(cls, url))
			.then(async (sheet) => {
				const source = Object.values(sheet.textures)[0]?.source;
				const rd = renderer();
				if (source && mips) enableMipmaps(source, rd);
				if (source && rd) await rd.prepare?.upload([source]);
				texLog.push({ what: 'ready', key: `glyphs-${cls}`, at: performance.now(), ms: Number((performance.now() - t0).toFixed(1)) });
				return sheet.textures as Record<string, PIXI.Texture>;
			})
			.catch((error) => {
				// the plaque's glyphs draw the count and the amount instead (softer, never missing)
				texLog.push({ what: 'failed', key: `glyphs-${cls}`, at: performance.now() });
				console.warn('[manticore] the war banner glyphs failed to load; the plaque glyphs stand in', cls, error);
				return null;
			});
		glyphRefs[cls] = { n: 1, promise };
		return promise;
	};
	const glyphsFree = (cls: BannerClass) => {
		const have = glyphRefs[cls];
		if (!have || --have.n > 0) return;
		glyphGone[cls] = have.promise.then(async (tex) => {
			// (after this task: a screen asking for it in the same tick has taken it back)
			await new Promise((r) => setTimeout(r, 0));
			if (glyphRefs[cls] !== have || have.n > 0) return;
			delete glyphRefs[cls];
			// (nothing may draw from it when it goes: the view is handed back to the plaque's atlas first)
			const source = tex ? Object.values(tex)[0]?.source : null;
			if (source && view.glyphsInUse === source) view.glyphsHome();
			texLog.push({ what: 'unload', key: `glyphs-${cls}`, at: performance.now() });
			await glyphSheetUnload(cls).catch(() => {});
		});
	};
	/** a screen's hold on its glyph sheet goes (once) */
	const freeGlyphsOf = (r: Res) => {
		if (!r.held) return;
		r.held = false;
		glyphsFree(r.cls);
	};
	/** a cloth's unload on its way, by url (the same rule as the glyphs: asked for again, it loads after it) */
	const clothGone = new Map<string, Promise<unknown>>();
	const unload = (r: Res) => {
		if (res === r) res = null;
		texLog.push({ what: 'unload', key: r.key, at: performance.now() });
		const gone = r.promise.then(() => PIXI.Assets.unload(r.url).catch(() => {}));
		clothGone.set(r.url, gone);
		void gone.then(() => {
			if (clothGone.get(r.url) === gone) clothGone.delete(r.url);
		});
		freeGlyphsOf(r);
	};
	// A CLOTH STILL ON SCREEN WHEN THE NEXT ONE IS ASKED FOR (2026-11-18, banner_probe real round: the intro's cloth and its
	// glyph sheet were never let go): the TOTAL WIN's cloth can be asked for while the intro is still rolling up (SKIP TO
	// RESULT straight after the intro, and since the HUD stays up under the banners the free spins start about 0.7 s
	// sooner). The screen on show keeps its cloth until it has gone; it waits here and stop() lets it go then
	let leaving: Res[] = [];
	const load = (tier: BannerTier, content: BannerContent, cls: BannerClass = wantCls): Promise<PIXI.Texture | null> => {
		const key = `${cls}-${tier}-${content}`;
		if (res && res.key === key) return res.promise;
		if (res && !res.inUse) unload(res);
		else if (res) leaving.push(res);
		const url = BANNER_TEXTURES[cls][tier][content];
		const t0 = performance.now();
		texLog.push({ what: 'load', key, at: t0 });
		const r: Res = { key, url, cls, tier, content, tex: null, inUse: false, promise: Promise.resolve(null), glyphs: null, held: true };
		const glyphs = glyphsLoad(cls).then((g) => (r.glyphs = g));
		r.promise = (clothGone.get(url) ?? Promise.resolve())
			// (an Epic's cloth may be on its way into the cache, game/epicLoad.ts: no second download beside it)
			.then(() => warmWait(url))
			.then(() => PIXI.Assets.load(url) as Promise<PIXI.Texture>)
			.then(async (tex) => {
				const rd = renderer();
				// mipmaps on (the rule lines shimmer without, mockup round 1), built once at the upload; the upload now,
				// never at the first draw
				enableMipmaps(tex.source, rd);
				if (rd) await rd.prepare?.upload([tex.source]);
				// (the screen waits for its glyphs too: they load beside the cloth and are a quarter of its size or less)
				await glyphs;
				r.tex = tex;
				texLog.push({ what: 'ready', key, at: performance.now(), ms: Number((performance.now() - t0).toFixed(1)) });
				return tex;
			})
			.catch((error) => {
				texLog.push({ what: 'failed', key, at: performance.now() });
				console.error('[manticore] the war banner texture failed to load', key, error);
				if (res === r) res = null;
				freeGlyphsOf(r);
				return null;
			});
		res = r;
		return r.promise;
	};
	/** the screen's texture, waiting at most `ms` for it */
	const texFor = async (tier: BannerTier, content: BannerContent, ms = 4000): Promise<{ tex: PIXI.Texture; cls: BannerClass } | null> => {
		const p = load(tier, content, res && res.tier === tier && res.content === content ? res.cls : wantCls);
		const tex = await Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
		return tex && res ? { tex, cls: res.cls } : null;
	};

	// PRELOAD: the intro's cloth from the feature's start, the TOTAL WIN's from its last spin (or its end)
	$effect(() => {
		const sg = context.stateGame;
		const mode = sg.bonusMode as StingerMode | null;
		const gt = sg.gameType;
		const last = sg.fs >= sg.totalFs && sg.totalFs > 0;
		const recap = !!sg.sessionRecap;
		const ok = built;
		untrack(() => {
			if (!ok || !mode || ticking) return;
			if (gt === 'basegame' && !recap && !sg.lookHold) void load(bannerTierOf(mode), 'intro');
			else if (gt === 'freegame' && (last || recap)) void load(bannerTierOf(mode), 'total');
		});
	});

	// ---- the screen -------------------------------------------------------------------------------------------------
	let ticking = false;
	/** real ms since show (never jumps; the view's own clock jumps on a cut) */
	let clock = 0;
	let frameMs = 0;
	let screenNo = 0;
	let impactDone = false;
	let landSound = -1;
	let wrapCheer = -1;
	let pressed = -1;
	let cheered = -1;
	let waiters: { at: number; resolve: () => void }[] = [];
	let rolled: (() => void)[] = [];
	type Count = { segs: ReturnType<typeof stagedSegments>; total: number; target: number; fit: string; el: number; started: boolean; skipped: boolean; done: () => void };
	let count: Count | null = null;
	/** THE TOTAL WIN's count on the screen's clock, for the bar's WIN odometer (flow.totalCount): set by wrap, its start
	 *  and end written as the count starts, its end moved to a press that lands it (skip) */
	let total: { id: number; countStart: number | null; countEnd: number; amount: number; skipped: boolean } | null = null;
	/** the odometer's cue off (game/hudWin.svelte.ts hudWinOdometer): the bar's WIN is today's readout again */
	const odometerOff = () => {
		total = null;
		if (hudWinOdometer.amount !== null) hudWinOdometer.amount = null;
	};
	/** the line's fade: starts lineDelayMs after the count lands */
	let lineT0 = Infinity;
	let gateAt = Infinity;

	type Beat = { type: string; at: number; clock: number; t: number; screen: string; tier: string; amount?: number; skipped?: boolean };
	const beats: Beat[] = [];
	const log = (type: string, extra: Partial<Beat> = {}) => {
		if (STAGING_TOOLS) perfMark(`banner:${type}`);
		if (!import.meta.env.DEV) return;
		beats.push({ type, at: performance.now(), clock: Number(clock.toFixed(1)), t: Number(view.t.toFixed(1)), screen: view.content, tier: view.tier, ...extra });
		if (beats.length > 400) beats.splice(0, 200);
	};
	/** DEV: per frame records while `recording` (tools/manticore/banner_probe.js) */
	let recording = false;
	let frames: Record<string, unknown>[] = [];

	const tierSound = (index: number) => context.eventEmitter.broadcast({ type: 'soundOnce', name: WIN_TIER_SOUND[index], forcePlay: true });
	let countLoopOn = false;
	const countLoop = (on: boolean) => {
		if (on === countLoopOn) return;
		countLoopOn = on;
		context.eventEmitter.broadcast({ type: on ? 'soundLoop' : 'soundStop', name: 'sfx_money_counter' });
	};
	const format = (amount: number, target?: number) => bookEventAmountToCurrencyString(amount, { fractionDigitsOfBookAmount: target, canvas: true });
	const fast = () => context.stateGame.skipping || context.stateGameDerived.timeScale() > 1.001;
	const EPIC = STINGER_TIERS.indexOf('epic');

	const impact = () => {
		if (impactDone) return;
		impactDone = true;
		// THE LANDING THUMP (sfx_plaque_land): the roll lands on the pole; a TOTAL WIN's tier clip with it, as on the plaque
		context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_plaque_land', forcePlay: true });
		if (landSound >= 0) tierSound(landSound);
		landSound = -1;
		creatureUploadQuiet(CREATURE.wins.quiet.impactMs, true);
		log('impact');
		if (view.content === 'total' && wrapCheer >= 0) cheer(wrapCheer);
	};
	// THE CHEER on a TOTAL WIN (PLAQUE_CHEER): the total's own tier, as the plaque does it
	const cheer = (tier: number) => {
		if (!PLAQUE_CHEER.on || cheered === screenNo || pressed === screenNo || context.stateGame.skipping) return;
		cheered = screenNo;
		const mine = screenNo;
		const epic = tier === EPIC;
		const at = clock + (epic ? PLAQUE_ESCALATION.epic.roarDelayMs : PLAQUE_CHEER.delayMs);
		void until(at).then(() => {
			if (mine !== screenNo || pressed === mine || !ticking || view.phase === 'rollup' || view.phase === 'retreat' || clock < at || context.stateGame.skipping) return;
			if (epic) {
				context.eventEmitter.broadcast({ type: 'plaqueCheer', move: PLAQUE_CHEER.epic });
				log('roar');
				return;
			}
			const move = PLAQUE_CHEER.moves[tier];
			if (!move) return;
			context.eventEmitter.broadcast({ type: 'plaqueCheer', move });
			log('cheer');
		});
	};

	const until = (at: number) => new Promise<void>((resolve) => waiters.push({ at, resolve }));

	const stepCount = (c: Count, dt: number) => {
		if (!c.started) {
			if (clock < BANNER.timing.countStartMs && view.cutAt < 0) return;
			c.started = true;
			// (el counts from this frame on, so the count's own clock is the screen's clock less this moment)
			if (total && total.countStart === null) {
				total.countStart = clock;
				total.countEnd = c.skipped ? clock : clock + c.total;
			}
			log('countStart');
		} else c.el += dt;
		const ended = c.skipped || c.el >= c.total;
		countLoop(!ended);
		const amount = ended ? c.target : stagedAmountAt(c.segs, c.el);
		// CENTRED THROUGH THE COUNT (Corey 2026-11-14: "must stay centered through the count up like it already did on the
		// stinger"): tabular digits (no jitter frame to frame), the row centred on its own width (re-centred as a digit is
		// added), its size fixed from the first frame by the final amount (`fit`)
		view.setText('amount', format(amount, c.target), { tabular: true, fit: c.fit });
		if (!ended) return;
		count = null;
		if (total && c.skipped) {
			total.skipped = true;
			total.countEnd = Math.min(total.countEnd, clock);
		}
		lineT0 = clock + BANNER.timing.lineDelayMs;
		log('countEnd', { amount: c.target, skipped: c.skipped });
		c.done();
	};

	const tick = (ticker: PIXI.Ticker) => {
		const dt = Math.min(ticker.deltaMS, 100);
		frameMs = ticker.deltaMS;
		clock += dt;
		const alive = view.tick(dt);
		// no random idle action of his starts while a TOTAL WIN is up (constants PLAQUE_CHEER.plaqueRollQuietMs)
		if (view.content === 'total') creature.quietRolls(PLAQUE_CHEER.plaqueRollQuietMs);
		if (!impactDone && (view.t >= BANNER.timing.entryMs || view.cutAt >= 0) && view.phase !== 'rollup' && view.phase !== 'retreat') impact();
		if (count) stepCount(count, dt);
		if (lineT0 !== Infinity) view.setLineAlpha(Math.min(1, Math.max(0, (clock - lineT0) / BANNER.timing.lineFadeMs)));
		if (waiters.length) {
			const due = waiters.filter((w) => w.at <= clock);
			if (due.length) {
				waiters = waiters.filter((w) => w.at > clock);
				for (const w of due) w.resolve();
			}
		}
		if (rolled.length && view.rolledUp) {
			const r = rolled;
			rolled = [];
			log('rolledUp');
			for (const resolve of r) resolve();
		}
		if (recording) frames.push({ clock: Number(clock.toFixed(2)), dt: Number(dt.toFixed(2)), ...view.state(), haul: (window as any).__manticore?.frameGears?.offset ?? null, gear: (window as any).__manticore?.frameGears?.frame ?? null });
		if (!alive) stop();
	};
	const start = () => {
		if (ticking) return;
		ticking = true;
		featureScreens.bannerUp = true;
		context.stateApp.pixiApplication?.ticker.add(tick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
	};
	const release = () => {
		const c = count;
		count = null;
		countLoop(false);
		c?.done();
		const w = waiters;
		waiters = [];
		for (const x of w) x.resolve();
		const r = rolled;
		rolled = [];
		for (const x of r) x();
	};
	const stop = () => {
		if (!ticking) return;
		ticking = false;
		featureScreens.bannerUp = false;
		context.stateApp.pixiApplication?.ticker.remove(tick);
		odometerOff();
		context.eventEmitter.broadcast({ type: 'plaqueCheerEnd' });
		release();
		log('gone');
		// the screen has gone: its cloth leaves the GPU (one resident at a time; the next screen's loads on its own cue)
		if (res && res.inUse) {
			res.inUse = false;
			unload(res);
		}
		// every earlier screen's cloth that waited for its screen to go (load above)
		const was = leaving;
		leaving = [];
		for (const r of was) {
			r.inUse = false;
			unload(r);
		}
	};

	const begin = (tier: BannerTier, content: BannerContent, cls: BannerClass, tex: PIXI.Texture, sound: number) => {
		release();
		odometerOff();
		screenNo += 1;
		wrapCheer = -1;
		clock = 0;
		impactDone = false;
		lineT0 = Infinity;
		gateAt = Infinity;
		landSound = sound;
		if (res) res.inUse = true;
		view.attachBack(bannerBackSlot.current);
		view.show({ tier, content, cls, texture: tex, glyphTint: BANNER.glyphTint[tier], glyphs: res && res.cls === cls ? res.glyphs : null });
		// the board plaque does not celebrate the intro or the TOTAL WIN (the plaque's own rule)
		celebrateShow(false, performance.now());
		creatureUploadQuiet(CREATURE.wins.quiet.showMs);
		log('show');
		start();
		const C = BANNER.chains;
		if (fast()) {
			view.cut();
			log('cut');
			// the chains jump to their end offset
			chainRun({ links: 0, ms: 0, ease: 'run', toWhole: C.runMinLinks });
		} else chainRun({ links: 0, ms: C.runMs, ease: 'run', toWhole: C.runMinLinks, rampMs: C.runRampMs, easeMs: C.runEaseMs });
	};

	const tileCapOk = (mode: StingerMode, tileCap: number) => BANNER.tileCap[mode] === tileCap;

	const flow: WarBannerFlow = {
		ready: () => built,
		introMatches: (mode, tileCap) => built && tileCapOk(mode, tileCap),
		introUp: (mode) => built && !!res && !!res.tex && res.tier === bannerTierOf(mode) && res.content === 'intro',
		intro: async ({ mode, totalFs }) => {
			if (!built) return false;
			const tier = bannerTierOf(mode);
			const got = await texFor(tier, 'intro');
			if (!got) return false;
			begin(tier, 'intro', got.cls, got.tex, -1);
			view.setText('count', `${totalFs}`);
			gateAt = view.cutAt >= 0 ? 0 : BANNER.timing.introGateMs;
			await until(gateAt);
			log('gate');
			return true;
		},
		wrap: async ({ amount, tier, mode, spins, durationMs, sound }) => {
			if (!built) return false;
			const bt = bannerTierOf(mode);
			const got = await texFor(bt, 'total');
			if (!got) return false;
			begin(bt, 'total', got.cls, got.tex, sound ? Math.max(0, Math.min(WIN_TIER_SOUND.length - 1, tier)) : -1);
			wrapCheer = sound ? Math.min(EPIC, tier) : -1;
			view.setText('line', `IN ${spins} ${BONUS_MODE_LABEL[mode]}`);
			view.setLineAlpha(0);
			const bars = WIN_TIER_STAGES_END_FEATURE.slice(1).map((s) => s.xBet * BOOK_AMOUNT_MULTIPLIER);
			const fit = format(amount, amount);
			view.setText('amount', format(0, amount), { tabular: true, fit });
			// the bar's WIN rolls with this count (ui/hud/winOdometer.ts): its cue, and the count's record on this clock
			total = { id: screenNo, countStart: null, countEnd: Infinity, amount, skipped: false };
			hudWinOdometer.amount = amount;
			await new Promise<void>((done) => {
				const segs = stagedSegments(amount, durationMs, bars);
				count = { segs, total: stagedTotal(segs), target: amount, fit, el: 0, started: false, skipped: false, done };
			});
			return true;
		},
		lineIn: async () => {
			if (!ticking || view.content !== 'total' || lineT0 === Infinity) return;
			await until(lineT0 + BANNER.timing.lineFadeMs);
		},
		skip: () => {
			pressed = screenNo;
			if (view.phase === 'entry' || view.phase === 'unroll') {
				view.cut();
				log('cut');
			}
			if (count) {
				count.skipped = true;
				// the press lands the bar's WIN at once, on this frame's clock (the banner's own count lands on its next tick)
				if (total) {
					if (total.countStart === null) total.countStart = clock;
					total.countEnd = Math.min(total.countEnd, clock);
					total.skipped = true;
				}
			}
		},
		counting: () => !!count,
		totalCount: () => {
			const T = total;
			if (!T || T.countStart === null || T.id !== screenNo || !ticking || view.content !== 'total') return null;
			if (view.phase === 'hidden' || view.phase === 'rollup' || view.phase === 'retreat') return null;
			return { id: T.id, t: clock, countStart: T.countStart, countEnd: T.countEnd, amount: T.amount, skipped: T.skipped };
		},
		hide: () =>
			new Promise<void>((resolve) => {
				if (!ticking || view.phase === 'hidden') return resolve();
				count = null;
				countLoop(false);
				odometerOff();
				const instant = fast();
				context.eventEmitter.broadcast({ type: 'plaqueCheerEnd' });
				chainRun({ links: BANNER.chains.backLinks, ms: instant ? 0 : BANNER.chains.backMs, ease: 'inOut' });
				log('hide', { skipped: instant });
				if (instant) {
					view.hide(true);
					stop();
					return resolve();
				}
				rolled.push(resolve);
				view.hide();
			}),
	};

	onMount(() => {
		warBanner.flow = flow;
		loadBannerMotion()
			.then((m) => {
				motion = m;
				motionReady = true;
			})
			.catch((error) => console.error('[manticore] the war banner motion failed to load', error));
		loadStingerData(STINGER_DATA_URLS)
			.then((d) => {
				font = new PlaqueFont(d.json);
				fontReady = true;
			})
			.catch((error) => console.error('[manticore] the war banner font failed to load', error));

		// ---- DEV hook: __manticore.banner (tools/manticore/banner_probe.js) ---------------------------------------
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			const waitFor = async (cond: () => boolean, ms: number) => {
				const t0 = performance.now();
				while (!cond() && performance.now() - t0 < ms) await new Promise((r) => setTimeout(r, 50));
				return cond();
			};
			/** THE TIER'S SCENE for a forced screen: the feature's look held as a TOTAL WIN holds it (stateGame.lookHold) */
			const lookOn = async (mode: StingerMode) => {
				context.stateGame.bonusMode = mode;
				context.stateGame.lookHold = true;
				if (mode !== 'bonus') await waitFor(() => frameLight.nightSet && frameLight.night >= 0.999, 12000);
				else await new Promise((r) => setTimeout(r, 900));
			};
			const lookOff = () => {
				context.stateGame.lookHold = false;
				context.stateGame.bonusMode = null;
			};
			let forcing: Promise<void> | null = null;
			Object.assign(((window as any).__manticore ??= {}), {
				banner: {
					flow,
					state: () => ({
						built,
						ticking,
						clock: Number(clock.toFixed(1)),
						frameMs: Number(frameMs.toFixed(2)),
						gateAt,
						counting: !!count,
						wantCls,
						resident: res ? { key: res.key, ready: !!res.tex, inUse: res.inUse, w: res.tex?.source.pixelWidth ?? 0, h: res.tex?.source.pixelHeight ?? 0, mips: res.tex?.source.mipLevelCount ?? 0 } : null,
						/** every banner texture the renderer holds now (uid:label:file:w x h) */
						gpu: (((renderer() as any)?.texture?.managedTextures ?? []) as PIXI.TextureSource[])
							.map((s) => `${s.uid}:${(s.resource as { src?: string } | null)?.src?.split('/').pop()?.split('?')[0] ?? s.label ?? ''}:${s.pixelWidth}x${s.pixelHeight}`)
							.filter((x) => x.includes('banner-')),
						view: view.state(),
					}),
					log: () => beats.slice(),
					texLog: () => texLog.slice(),
					/** per frame records (every tick of the banner's ticker) between record(true) and record(false) */
					record: (on: boolean) => {
						recording = on;
						if (on) frames = [];
						return frames.length;
					},
					frames: (from = 0) => frames.slice(from),
					/** THE REAL SCREENS, FORCED: the tier's scene (the look held), then the real events ModePlaque and FreeSpinOutro
					 *  answer (their gates, their press handling); the HUD leaves and comes back as in a round. `screen` 'intro' |
					 *  'wrap'; amount = a book amount (default 1250 x); `currency` swaps stateBet.currency for this screen only. */
					force: (o: { screen: 'intro' | 'wrap'; mode: StingerMode; amount?: number; spins?: number; level?: number; currency?: string; capped?: boolean; turbo?: 0 | 1 | 2; bet?: number }) => {
						if (forcing) return false;
						const emitter = context.eventEmitter;
						forcing = (async () => {
							const was = stateBet.currency;
							const wasBet = stateBet.wageredBetAmount;
							const wasTurbo = context.stateGame.turboLevel;
							if (o.currency) stateBet.currency = o.currency;
							if (o.bet) stateBet.wageredBetAmount = o.bet;
							try {
								// the HUD as in a round: on screen, disabled, under the banner (m8, game/stateGame hudHeld)
								context.stateGame.hudHeld = true;
								await emitter.broadcastAsync({ type: 'uiHide' });
								await lookOn(o.mode);
								// a turbo level for this screen only (the feature's own turbo: the wrap up meets it; the intro never does
								// in a round, every feature starts at normal speed)
								if (o.turbo !== undefined) context.stateGameDerived.setTurboLevel(o.turbo);
								if (o.screen === 'intro') {
									const totalFs = o.spins ?? { bonus: 8, super: 10, epic: 12 }[o.mode];
									await emitter.broadcastAsync({
										type: 'modePlaqueShow',
										title: BONUS_MODE_LABEL[o.mode],
										sub: `${totalFs} SPINS`,
										gated: true,
										intro: { mode: o.mode, totalFs, tileCap: BANNER.tileCap[o.mode] },
									});
								} else {
									const amount = o.amount ?? 1250 * BOOK_AMOUNT_MULTIPLIER;
									context.stateGame.sessionRecap = { mode: o.mode, spinsPlayed: o.spins ?? 8, totalSessionWin: amount };
									await emitter.broadcastAsync({ type: 'freeSpinOutroShow' });
									await emitter.broadcastAsync({ type: 'freeSpinOutroCountUp', amount, winLevelData: winLevelMap[(o.level ?? 9) as keyof typeof winLevelMap], capped: !!o.capped });
									emitter.broadcast({ type: 'freeSpinOutroHide' });
									await waitFor(() => !ticking, 3000);
									context.stateGame.sessionRecap = null;
								}
								lookOff();
								await emitter.broadcastAsync({ type: 'uiShow' });
							} finally {
								context.stateGame.hudHeld = false;
								if (o.currency) stateBet.currency = was;
								if (o.bet) stateBet.wageredBetAmount = wasBet;
								if (o.turbo !== undefined) context.stateGameDerived.setTurboLevel(wasTurbo as 0 | 1 | 2);
								forcing = null;
							}
						})();
						return true;
					},
					forcing: () => !!forcing,
					/** the amount's fit for a currency and a book amount, without a screen: the string, its laid out width and the
					 *  row's maxWidth (material px, the cloth's inner width) */
					fit: (currency: string, amount: number, bet?: number) => {
						const was = stateBet.currency;
						const wasBet = stateBet.wageredBetAmount;
						stateBet.currency = currency;
						if (bet) stateBet.wageredBetAmount = bet;
						try {
							const text = format(amount, amount);
							const L = BANNER.live[view.cls].amount;
							const em = (L.cap * (font?.em ?? 192)) / (font?.cap ?? 128);
							const run = font ? font.layout(text, em, new (class { count = 0; width = 0; scale = 1; frame = new Int16Array(64); x = new Float32Array(64); y = new Float32Array(64); w = new Float32Array(64); h = new Float32Array(64); capacity = 64; })() as any, { maxWidth: L.maxWidth, tabular: true }) : null;
							return { text, missing: font?.missing(text) ?? '', width: run?.width ?? 0, maxWidth: L.maxWidth, shrunk: run ? run.scale < em / (font!.em) - 1e-9 : false, scale: run?.scale ?? 0 };
						} finally {
							stateBet.currency = was;
							stateBet.wageredBetAmount = wasBet;
						}
					},
					/** load a screen's texture now (the preload, by hand) */
					load: (mode: StingerMode, content: BannerContent) => load(bannerTierOf(mode), content).then((t) => !!t),
				},
			});
		}
		return () => {
			stop();
			if (warBanner.flow === flow) warBanner.flow = null;
			if (res) unload(res);
			if (import.meta.env.DEV && typeof window !== 'undefined') delete (window as any).__manticore?.banner;
			for (const child of view.front.removeChildren()) child.destroy({ children: true });
			view.back.destroy({ children: true });
		};
	});
</script>
