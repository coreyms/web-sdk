<script lang="ts" module>
	import type { StingerShow } from '../game/stinger/view';
	import type { StingerMode, StingerTier } from '../game/stinger/types';

	/** the DEV hook's direct controls (stage 1; tools/manticore/stinger_probe.js) */
	export type StingerPlaqueApi = {
		/** false while the art is still loading (nothing shown) */
		show: (o: StingerShow & { amount?: number }) => boolean;
		tierUp: (tier: StingerTier) => void;
		/** a book amount; `target` = the count's final amount (pins the digits and the box) */
		setAmount: (amount: number, target?: number) => void;
		hide: () => void;
	};

	/**
	 * THE REAL SCREENS (stage 2): what Win / ModePlaque / FreeSpinOutro ask of the plaque. Every amount is the
	 * book's and every tier index (0 Big .. 4 Max) is the caller's, read off the book's level: the plaque
	 * decides nothing, it paces and draws.
	 */
	export type StingerPlaqueFlow = {
		/** the art, the tracks and the scene are in: false = the caller keeps its plain screen */
		ready: () => boolean;
		/** the win screen: Big slams in and the amount counts to `amount` over durationMs (house pacing), the title
		 *  stepping up at each bar crossed, never past `finalTier`. Resolves when the count has landed. */
		win: (o: { amount: number; finalTier: number; durationMs: number }) => Promise<void>;
		/** the feature's intro: resolves once its rows are in */
		intro: (o: { mode: StingerMode }) => Promise<void>;
		/** does the baked intro copy say what the book says (spins in the title, the tile cap in the rows)? */
		introMatches: (mode: StingerMode, totalFs: number, tileCap: number) => boolean;
		/** the wrap up: TOTAL WIN, the count, then the line. `tier` = the veins / embers level from the start;
		 *  `sound` = play that tier's clip on the impact. Resolves when the count has landed; lineIn() then
		 *  resolves once the line under it has faded in. */
		/** `maxWin` (a capped round): the title is the win ladder's instead (BIG WIN stepping up to MAX WIN at each
		 *  bar of the base ladder, each tier's clip on its landing, never past `tier`), the way the win screen counts. */
		wrap: (o: { amount: number; tier: number; mode: StingerMode; line: string; durationMs: number; ladder: 'win' | 'endFeature'; sound: boolean; maxWin?: boolean }) => Promise<void>;
		lineIn: () => Promise<void>;
		/** a press while an amount counts: land on the final amount and tier, with one tier beat */
		skip: () => void;
		/** true while an amount is still counting */
		counting: () => boolean;
		/** the exit; resolves when the plaque is gone */
		hide: () => Promise<void>;
	};

	/** set while the plaque component is mounted */
	export const stingerPlaque: { flow: StingerPlaqueFlow | null } = { flow: null };
</script>

<script lang="ts">
	// THE ANIMATED WIN PLAQUE ("stinger"): the layered manticore plaque with its idle loop, flares, veins,
	// gold glint, barb glow, eyes and embers, and the win / bonus intro / wrap up text set on its slab.
	//
	// STAGE 2 (2026-10-08): the plaque IS the Big Win and above screen (components/Win.svelte), the feature
	// intro (ModePlaque.svelte) and the wrap up (FreeSpinOutro.svelte). Those components keep their events,
	// their gating and their state flags and hand the drawing to `stingerPlaque.flow` (the module export);
	// each keeps its plain screen for the cases the plaque does not cover (a win under Big, art that failed
	// to load). The count is paced HERE, on the plaque's own ticker, by game/stinger/count.ts (the house
	// pacing StagedCountUpProvider uses): one clock for the amount, the tier beats and the text.
	// The DEV hook `__manticore.stinger` (tools/manticore/stinger_probe.js, stinger_flow_probe.js) still
	// drives the plaque directly and reads its state and its beat log.
	//
	// ALWAYS MOUNTED (the conditional mount z order trap), hidden by default, between ModePlaque and Win in
	// Game.svelte: above the board, its effects and the readouts, below the presentations' press prompts,
	// the scene transition and the HTML HUD. Everything it draws is raw Pixi in one container owned by
	// game/stinger/view.ts; this component only feeds it the data, the layout and the ticker, and the
	// ticker callback is REMOVED while the plaque is hidden (no per frame work at all).
	//
	// The art rides the deferred asset phase (game/assets.ts stinger*); the motion tracks and recipes are
	// two small fetches (game/stinger/data.ts). The five atlases are uploaded once when the scene is built,
	// so the first show uploads nothing.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { STINGER_DATA_URLS } from '../game/assets';
	import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';

	import { STINGER_PLAQUE, PLAYGROUND_PX, RENDER_RESOLUTION_CAP } from '../game/constants';
	import { PHONE_TIER } from '../game/deviceTier';
	import { boardKick, chainGust } from '../game/featureFx';
	import { layoutKind } from '../game/layoutSpec';
	import { enableMipmaps } from '../game/mipmaps';
	import { WIN_TIER_SOUND, WIN_TIER_STAGES, WIN_TIER_STAGES_END_FEATURE } from '../game/winLevelMap';
	import { stagedAmountAt, stagedSegments, stagedTotal, tierIndexAt, type CountSegment } from '../game/stinger/count';
	import { loadStingerData } from '../game/stinger/data';
	import { STAGING_TOOLS, perfMark } from '../game/staging';
	import { plaquePlacement } from '../game/stinger/layout';
	import { StingerView } from '../game/stinger/view';
	import { STINGER_TIERS, type StingerData } from '../game/stinger/types';

	const context = getContext();
	const view = new StingerView(STINGER_PLAQUE);
	// on the stage itself (canvas px), not in a MainContainer: the scene dim covers the whole canvas
	getContextParent().addToParent(view.root);

	let data: StingerData | null = $state.raw(null);
	let built = $state(false);
	let limit = '';
	let mips = '';
	/** DEV A / B of the sampling (tools/manticore/stinger_flow_probe.js SHARP=1): ?stgmip=off (no chain) | tri
	 *  (chain, trilinear) | near (chain, nearest level). Production is always 'auto' (the rule in the build
	 *  effect below). */
	const mipMode = (): 'auto' | 'off' | 'tri' | 'near' => {
		if (!import.meta.env.DEV || typeof window === 'undefined') return 'auto';
		const q = new URLSearchParams(window.location.search).get('stgmip');
		return q === 'off' || q === 'tri' || q === 'near' ? q : 'auto';
	};

	// build once the tracks and every deferred atlas are in
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		const atlas = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		if (built || !data || !app || !atlas?.stg_body) return; // its five atlases publish together, ahead of the symbol sheets (game/deferredLoad.ts)
		view.build(data, atlas);
		const renderer = app.renderer as PIXI.Renderer;
		// MIPMAPS (game/mipmaps.ts), decided per asset tier (the sharpness pass, 2026-10-08; the numbers are in
		// tools/manticore/README.md, measured by stinger_flow_probe.js SHARP=1 + stinger_sharpness.py):
		//   full tier   the atlases ship at 1.5 texture px per plaque px and a 1280 wide desktop at DPR 1 draws
		//               the plaque at 0.55, about 2.7 texels a pixel: a trilinear mip chain, or it aliases into
		//               grain. Unchanged from stage 1 (desktop is approved as it is).
		//   phone tier  1 texture px per plaque px, drawn at 0.6 to 0.8 device px a texel (the renderer's DPR
		//               cap is 1.5): under two texels a pixel, where plain bilinear is clean. A chain there
		//               made trilinear sampling blend in the HALF size level, which is what read soft on a
		//               phone: NO chain on the phone tier (edge contrast up 12 to 19 %, 2.3 MB less on the GPU).
		//   full tier at renderer resolution 2 (the desktop cap since 2026-10-09, RENDER_RESOLUTION_CAP): a 1440 x 900
		//               window draws the plaque at about 1.2 texels a pixel, where trilinear blends a quarter of the
		//               half size level in. The chain stays (a small window still minifies) but the NEAREST level is
		//               sampled: edge contrast title 12.38 to 13.09, lion 22.39 to 24.42 (SHARP=desktop, the same as
		//               no chain at that size; the cap alone took them from 10.68 / 17.32). Below resolution 2
		//               (DPR 1, 1.25 and 1.5 desktops) nothing changes.
		// Never the glint slices: soft highlights at 1x.
		const src = view.sources(atlas);
		const mode = mipMode();
		const chained = mode === 'off' || (PHONE_TIER && mode === 'auto') ? [] : [src.plaque, src.fx, src.titles, src.glyphs];
		const nearest = mode === 'near' || (mode === 'auto' && !PHONE_TIER && renderer.resolution >= RENDER_RESOLUTION_CAP.desktop);
		for (const source of chained) {
			enableMipmaps(source, renderer);
			if (source && nearest) source.mipmapFilter = 'nearest';
		}
		mips = `${mode}${nearest && mode === 'auto' ? '-near' : ''}:${chained.filter(Boolean).length}`;
		void renderer.prepare?.upload(Object.values(src).filter((x): x is PIXI.TextureSource => !!x));
		built = true;
		if (STAGING_TOOLS) perfMark('plaque:built');
	});

	// placement: plain arithmetic on the board frame (game/stinger/layout.ts), re-derived on every resize
	$effect(() => {
		if (!built || !data) return;
		const kind = layoutKind(context.stateLayoutDerived.layoutType());
		const master = context.stateLayoutDerived.mainLayout();
		const canvas = context.stateLayoutDerived.canvasSizes();
		const p = plaquePlacement(data.json, kind, canvas.width / master.scale);
		limit = p.limit;
		// master -> canvas: MainContainer centres the master on the canvas at master.scale
		view.place(master.x + (p.x - master.width / 2) * master.scale, master.y + (p.y - master.height / 2) * master.scale, p.scale * master.scale, canvas.width, canvas.height, master.scale);
	});

	// ---- the ticker: on only while the plaque is up ----------------------------------------------
	let ticking = false;
	let frameMs = 0;

	// the count in flight (plain fields: nothing here is reactive, the view is written directly)
	type Count = {
		segs: CountSegment[];
		total: number;
		target: number;
		/** the ladder's upgrade bars as book amounts, and the highest tier index the book allows */
		bars: number[];
		cap: number;
		shown: number;
		/** false = the tier is fixed for the whole screen (the wrap up) */
		beats: boolean;
		fit: string;
		skipped: boolean;
		started: boolean;
		done: () => void;
	};
	let count: Count | null = null;
	/** the clip to play on the impact (an index into WIN_TIER_SOUND), -1 = none */
	let landSound = -1;
	/** promises parked on the plaque clock (seconds) or on the plaque being gone */
	let waiters: { at: number; resolve: () => void }[] = [];
	let gone: (() => void)[] = [];

	// DEV: every beat with its wall clock stamp and its place on the count (the flow probe's pacing checks)
	type Beat = { type: 'show' | 'impact' | 'countStart' | 'tier' | 'countEnd' | 'hide' | 'gone'; at: number; screen: string; tier?: string; el?: number; amount?: number; skipped?: boolean };
	const beats: Beat[] = [];
	const log = (b: Omit<Beat, 'at' | 'screen'>) => {
		if (STAGING_TOOLS) perfMark(`plaque:${b.type}`);
		if (!import.meta.env.DEV) return;
		beats.push({ ...b, at: performance.now(), screen: view.screen });
		if (beats.length > 400) beats.splice(0, 200);
	};

	const tierSound = (index: number) => context.eventEmitter.broadcast({ type: 'soundOnce', name: WIN_TIER_SOUND[index], forcePlay: true });

	// the board kick (featureFx.boardKick, applied to the board and its frame by ClawSwipe / BoardFrame every
	// frame): the swipe's own decaying wobble, at the plaque's amplitude
	let kickAmp = 0;
	let kickEl = -1;
	const kick = (px: number) => {
		kickAmp = px * PLAYGROUND_PX;
		kickEl = px > 0 ? 0 : -1;
	};
	const stepKick = (dtMs: number) => {
		if (kickEl < 0) return;
		kickEl += dtMs;
		const u = kickEl / STINGER_PLAQUE.kickMs;
		const k = u < 1 ? kickAmp * (1 - u) * Math.sin(u * Math.PI * 6) : 0;
		boardKick.x = 0.6 * k;
		boardKick.y = k;
		if (u >= 1) kickEl = -1;
	};
	const endKick = () => {
		if (kickEl < 0) return;
		kickEl = -1;
		boardKick.x = 0;
		boardKick.y = 0;
	};

	// amounts go through the game's own currency formatting, decimals pinned to the count's target (CountUpText does the same)
	const format = (amount: number, target?: number) => bookEventAmountToCurrencyString(amount, target === undefined ? undefined : { fractionDigitsOfBookAmount: target });

	/** this frame of the count: the amount, a tier landing, the end. Between view.advance() and view.render(). */
	const stepCount = (c: Count) => {
		const el = (view.clock - view.amountT0) * 1000;
		if (el < 0) return;
		if (!c.started) {
			c.started = true;
			log({ type: 'countStart', el: 0, amount: 0 });
			if (import.meta.env.DEV) beats[beats.length - 1].at -= el;
		}
		const ended = c.skipped || el >= c.total;
		const amount = ended ? c.target : stagedAmountAt(c.segs, el);
		// several bars inside one frame (a skip, a long frame) are ONE beat, on the highest tier reached
		const index = c.beats ? tierIndexAt(amount, c.bars, c.cap) : c.shown;
		const up = index > c.shown;
		if (up) {
			c.shown = index;
			view.tierUp(STINGER_TIERS[index], !ended);
			tierSound(index);
			kick(STINGER_PLAQUE.kickTierPx);
			// the chains lean from the tier's punch a beat later (CHAIN_GUST.tier), never while skipping
			if (!context.stateGame.skipping) chainGust('tier', Math.max(0.2, context.stateGameDerived.timeScale()));
			log({ type: 'tier', tier: STINGER_TIERS[index], el, amount, skipped: c.skipped });
		}
		view.setAmountText(format(amount, c.target), c.fit);
		if (!ended) return;
		view.countEnd(up);
		count = null;
		log({ type: 'countEnd', tier: STINGER_TIERS[c.shown], el, amount, skipped: c.skipped });
		c.done();
	};

	const tick = (ticker: PIXI.Ticker) => {
		frameMs = ticker.deltaMS;
		view.advance(ticker.deltaMS);
		if (view.landed) {
			kick(STINGER_PLAQUE.kickPx);
			// the air of the slam reaches the chains a beat later (CHAIN_GUST.plaque), never while skipping
			if (!context.stateGame.skipping) chainGust('plaque', Math.max(0.2, context.stateGameDerived.timeScale()));
			if (landSound >= 0) tierSound(landSound);
			landSound = -1;
			log({ type: 'impact', tier: STINGER_TIERS[view.tier] });
		}
		if (count) stepCount(count);
		stepKick(ticker.deltaMS);
		if (waiters.length) {
			const now = view.clock;
			const due = waiters.filter((w) => w.at <= now);
			if (due.length) {
				waiters = waiters.filter((w) => w.at > now);
				for (const w of due) w.resolve();
			}
		}
		if (!view.render()) stop();
	};
	const start = () => {
		if (ticking) return;
		ticking = true;
		// NORMAL: before the render (LOW), like every other raw Pixi layer here
		context.stateApp.pixiApplication?.ticker.add(tick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
	};
	/** nothing parked on the plaque may outlive it: a superseded or ended screen releases every promise */
	const release = () => {
		const c = count;
		count = null;
		c?.done();
		const w = waiters;
		waiters = [];
		for (const x of w) x.resolve();
	};
	const stop = () => {
		if (!ticking) return;
		ticking = false;
		context.stateApp.pixiApplication?.ticker.remove(tick);
		endKick();
		release();
		const g = gone;
		gone = [];
		for (const resolve of g) resolve();
		log({ type: 'gone' });
	};

	const begin = (o: StingerShow, sound: number) => {
		release();
		view.show(o);
		landSound = sound;
		log({ type: 'show', tier: o.tier });
		start();
	};
	const until = (at: number) => new Promise<void>((resolve) => waiters.push({ at, resolve }));
	const barsOf = (stages: readonly { xBet: number }[]) => stages.slice(1).map((s) => s.xBet * BOOK_AMOUNT_MULTIPLIER);
	const tierName = (index: number) => STINGER_TIERS[Math.max(0, Math.min(STINGER_TIERS.length - 1, index))];
	const counting = (o: { amount: number; durationMs: number; bars: number[]; cap: number; shown: number; beats: boolean }) =>
		new Promise<void>((done) => {
			const segs = stagedSegments(o.amount, o.durationMs, o.bars);
			count = { segs, total: stagedTotal(segs), target: o.amount, bars: o.bars, cap: o.cap, shown: o.shown, beats: o.beats, fit: format(o.amount), skipped: false, started: false, done };
			view.countBegins();
		});

	const api: StingerPlaqueApi = {
		show: (o) => {
			if (!view.ready) return false;
			begin(o, -1);
			if (o.amount !== undefined && o.screen !== 'intro') api.setAmount(o.amount);
			return true;
		},
		tierUp: (tier) => view.tierUp(tier),
		setAmount: (amount, target) => view.setAmountText(format(amount, target), undefined, target === undefined ? undefined : format(target)),
		hide: () => {
			view.hide();
			log({ type: 'hide' });
		},
	};

	const flow: StingerPlaqueFlow = {
		ready: () => view.ready,
		win: async ({ amount, finalTier, durationMs }) => {
			if (!view.ready) return;
			// Big always opens the ladder; its clip plays on the impact, as each later tier's does on its landing
			begin({ screen: 'win', tier: 'big' }, 0);
			await counting({ amount, durationMs, bars: barsOf(WIN_TIER_STAGES), cap: Math.max(0, Math.min(STINGER_TIERS.length - 1, finalTier)), shown: 0, beats: true });
		},
		intro: async ({ mode }) => {
			if (!view.ready) return;
			begin({ screen: 'intro', tier: STINGER_PLAQUE.introTier[mode], mode }, -1);
			await until(view.rowsInS);
		},
		introMatches: (mode, totalFs, tileCap) => {
			const text = data?.json.text;
			if (!text) return false;
			const title = text.titles[`intro_${mode}`]?.text ?? '';
			const rows = text.copy.intro[mode] ?? [];
			return title.startsWith(`${totalFs} `) && rows.some((row) => row.includes(` ${tileCap}x`));
		},
		wrap: async ({ amount, tier, mode, line, durationMs, ladder, sound, maxWin }) => {
			if (!view.ready) return;
			if (maxWin) {
				// Big opens the ladder and its clip plays on the impact, as on the win screen
				begin({ screen: 'wrap', tier: 'big', mode, line, ladderTitle: true }, 0);
				await counting({ amount, durationMs, bars: barsOf(WIN_TIER_STAGES), cap: Math.max(0, Math.min(STINGER_TIERS.length - 1, tier)), shown: 0, beats: true });
				return;
			}
			begin({ screen: 'wrap', tier: tierName(tier), mode, line }, sound ? Math.max(0, Math.min(WIN_TIER_SOUND.length - 1, tier)) : -1);
			// the count is paced over the ladder's bars like any other; the tier itself is fixed for the screen
			await counting({ amount, durationMs, bars: barsOf(ladder === 'endFeature' ? WIN_TIER_STAGES_END_FEATURE : WIN_TIER_STAGES), cap: tier, shown: tier, beats: false });
		},
		lineIn: async () => {
			if (ticking && view.phase === 'up' && view.screen === 'wrap') await until(view.clock + view.lineInS);
		},
		skip: () => {
			if (count) count.skipped = true;
		},
		counting: () => !!count,
		hide: () =>
			new Promise<void>((resolve) => {
				if (!ticking || view.phase === 'hidden') return resolve();
				gone.push(resolve);
				view.hide();
				log({ type: 'hide' });
			}),
	};

	onMount(() => {
		stingerPlaque.flow = flow;
		loadStingerData(STINGER_DATA_URLS)
			.then((d) => (data = d))
			.catch((error) => console.error('[manticore] the win plaque data failed to load', error));
		// ---- DEV hook: __manticore.stinger (tools/manticore/stinger_probe.js) --------------------
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			Object.assign(((window as any).__manticore ??= {}), {
				stinger: {
					...api,
					/** the real screens' entry points, and every beat played (show / impact / countStart / tier / countEnd / hide / gone) */
					flow,
					/** the plaque's own motion (STINGER_PLAQUE.hover): scale 0 pins it still (rect / sharpness probes), 1 = as shipped */
					setHover: (o: { scale?: number }) => {
						if (typeof o?.scale === 'number') view.hoverScale = Math.max(0, o.scale);
						return view.hoverScale;
					},
					log: () => beats.slice(),
					state: () => ({
						...view.state(),
						ticking,
						/** which limit sized the plaque: chains (desktop), screen (portrait) or grid (phone sideways) */
						limit,
						/** the sampling the atlases got: <mode>:<how many have a mip chain> */
						mips,
						counting: !!count,
						/** the five atlases on the GPU: [name, width, height, mip levels] and the total in MB (RGBA8, a chain = 4/3) */
						atlases: Object.entries(view.sources((context.stateApp.loadedAssets ?? {}) as Record<string, PIXI.Texture>)).map(([name, x]) => [name, x?.pixelWidth ?? 0, x?.pixelHeight ?? 0, x?.autoGenerateMipmaps ? x.mipLevelCount : 1]),
						/** the last ticker frame, ms (0 until the plaque has ticked) */
						frameMs: Number(frameMs.toFixed(2)),
						textures: (context.stateApp.pixiApplication?.renderer as any)?.texture?.managedTextures?.length ?? null,
					}),
				},
			});
		}
		return () => {
			stop();
			if (stingerPlaque.flow === flow) stingerPlaque.flow = null;
			if (import.meta.env.DEV && typeof window !== 'undefined') delete (window as any).__manticore?.stinger;
			// the parent's unmount destroys the root without its children: they go here
			for (const child of view.root.removeChildren()) child.destroy({ children: true });
		};
	});
</script>
