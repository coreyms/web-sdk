<script lang="ts">
	// THE LOGO, IN THE CANVAS IN EVERY LAYOUT AND TIER (2026-10-13, Corey: "The manticore should read in front of the
	// Logo in Portrait mode, I guess that can be for all modes").
	// 2026-11-17: THE CITADEL TABLET (Corey's take A of 2026-11-16, images/logo_tablet_r1_2026-11-16), a still in every
	// layout and tier: game/logo/still.ts draws it with its baked shadow. The stacked logo's animated wings (entrance,
	// breathing, flare) and its glint are gone (Corey: "No glinting on the lettering"). The groove line trace comes in a
	// later pass: it attaches to `still.trace`, a container in the art's own px over the picture (game/logo/still.ts).
	// 2026-11-17, later: THE GROOVE TRACE (game/logo/trace.ts, constants LOGO.trace), Corey's three styles from the mock:
	//   idle     style 1, the border spark, always while the logo is shown
	//   tease    style 2 grows with the scatter tease (game/teaseState.ts teaseNow, read every frame; the War Standards a
	//            scatter sting brings), holds; the trigger pulse takes it further, the feature entry completes it
	//            (bookEventHandlerMap bonusStart: logoTrace.event(bonus)) and it drains; a miss drains it back
	//   big win  style 3 while the win screen counts (game/plaqueCelebrate.ts, read every frame), a step per tier
	// It ticks only while the logo is shown and the landing screen is gone, never while the tab is hidden, and not at all
	// for a player who asked for less motion (prefers-reduced-motion) or with `?trace=0` on a staging build. The groove map
	// (game/logo/grooves.json, 120 KB) is its own file, fetched once the logo is mounted.
	// The chrome keeps its <img> as the fallback (and the alt text), hidden for as long as this draws (logoState.canvas).
	//
	// WHERE: exactly the box the HTML rule gives (game/logo/layout.ts logoArtRect), mapped from the master to
	// canvas px the way MainContainer does.
	// Z ORDER: its host `logo` is mounted in components/Game.svelte straight after the scene and BEFORE the creature's
	// two hosts and the board: scene < logo < creature (behind the board) < board < creature (in front) < spin total,
	// plaques, win screens, transition < the HTML HUD. So the logo is under the creature in every layout, and since
	// the creature is under the plaques and the transition, so is the logo (the plaque's scene dim darkens it and
	// the transition covers it). No logo box reaches the board's art in any layout.
	// WHAT IT READS: the layout and the HUD's own show / hide events. The ticker runs only while it fades.
	// 2026-11-18, THE PANEL AND THE MULTIPLIER KEY (constants LOGO_KEY, game/logo/key.ts): the frame (the still) holds a
	// panel with two states, LOGO (the lettering) and KEY (the board's live multipliers), crossfaded. KEY from the spin
	// press until the round is over and the board at rest (then LOGO after LOGO_KEY.state.restHoldMs, unless the next round
	// starts or an autoplay run is on), throughout a feature, never on the landing screen or in Popout S. The key's art
	// loads after the mount (its own small atlas); until it is in, the panel stays on LOGO: never a hole.
	import * as PIXI from 'pixi.js';
	import { onMount, untrack } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { stateBet, stateModal } from 'state-shared';

	import { getContext } from '../game/context';
	import { ANTICIPATION_TEASE, LOGO, LOGO_KEY } from '../game/constants';
	import { PHONE_TIER } from '../game/deviceTier';
	import { KEY_VALUES, MultiplierKey } from '../game/logo/key';
	import { stamp } from '../game/assets';
	import { isPhoneSizeType, layoutKind } from '../game/layoutSpec';
	import { enableMipmaps } from '../game/mipmaps';
	import { logoArtRect } from '../game/logo/layout';
	import { logoState } from '../game/logo/state.svelte';
	import { portraitOptions } from '../game/portraitOptions.svelte';
	import { LogoStill } from '../game/logo/still';
	import { attachLogoTrace, GrooveTrace, logoTrace, type GrooveJson, type TraceLevel } from '../game/logo/trace';
	import { plaqueCelebrate } from '../game/plaqueCelebrate';
	import { stagingTrace } from '../game/staging';
	import { teaseNow } from '../game/teaseState';
	import { revealTease } from '../game/stateGame.svelte';
	import { hudHiddenByModal } from '../ui/armoury/armouryView.svelte';

	const context = getContext();
	const still = new LogoStill({ fadeMs: LOGO.fadeMs, shadowBakeWidth: LOGO.still.shadowBakeWidth, artPx: LOGO.art });
	// on the stage itself (canvas px): see Z ORDER above
	const host = new PIXI.Container();
	host.label = 'logo';
	host.eventMode = 'none';
	host.interactiveChildren = false;
	host.addChild(still.root);
	getContextParent().addToParent(host);

	/** DEV (logo_probe.js): false = no logo in the canvas, so a shot has no logo at all (the chrome's <img> shows) */
	let stillEnabled = $state(true);
	let stillBuilt = $state(false);
	/** the HUD is away (uiHide .. uiShow), and the max win screen's deep hide (uiHide { deep }): even the kept HUD
	 *  elements go, and so does this */
	let hudOff = $state(false);
	let deep = $state(false);
	let mips = 1;

	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	/** the HUD's own rule for its logo (ui/Chrome.svelte): gone under a modal (but not under THE ARMOURY, which keeps the
	 *  game visible under its tint: the one shared rule, ui/armoury/armouryView hudHiddenByModal); a kept element in
	 *  landscape and portrait (only the deep hide takes it), and on the phone master it goes with the HUD */
	const hudShows = $derived(!hudHiddenByModal(stateModal.modal) && (kind === 'phone' ? !hudOff : !deep));
	const stillOn = $derived(stillBuilt && stillEnabled);
	const stillShown = $derived(stillOn && hudShows);

	// ---- THE GROOVE TRACE ----
	const sg = context.stateGame;
	const reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	/** the trace is wanted at all: the constant (or `?trace=` on a staging build) and no reduced motion */
	const traceWanted = (stagingTrace ?? LOGO.trace.on) && !reducedMotion;
	let grooves: GrooveJson | null = $state.raw(null);
	let trace: GrooveTrace | null = null;
	let traceBuilt = $state(false);
	/** DEV (logo_probe.js): false = no trace drawn (the A / B of its cost and of its pixels) */
	let traceEnabled = $state(true);
	let tabVisible = $state(typeof document === 'undefined' ? true : !document.hidden);
	const traceActive = $derived(traceBuilt && traceEnabled && stillShown && !context.stateLayout.showLoadingScreen && tabVisible);
	const A = LOGO.trace.event.tease;
	/** a tease ran in this build up (its held columns count as done once it has ended) */
	let teaseRan = false;
	/** DEV (logo_probe.js): a win tier held by hand, no win screen (null = the win screen's own) */
	let devWinTier: number | null = null;
	/** DEV: what the tick itself costs (ms), summed since the probe last read it */
	const traceSpent = { ms: 0, max: 0, ticks: 0 };
	const traceTick = (ticker: PIXI.Ticker) => {
		const t = trace;
		if (!t) return;
		const t0 = import.meta.env.DEV ? performance.now() : 0;
		// THE ANTICIPATION: the scatter tease on screen (a regular spin's or a Mystery's), in the base game only
		// (teaseNow is only asked while a reveal has a tease: with none it fills its shared object from a fresh one)
		const st = revealTease.teased || revealTease.mystery ? teaseNow() : null;
		if (sg.skipping) t.release();
		else if (st && st.active && sg.gameType === 'basegame') {
			const col = st.phase === 'hold' ? st.holdIndex + 0.5 * st.holdProgress : st.phase === 'fall' ? st.holdIndex + 0.5 + 0.5 * st.fallProgress : st.held;
			teaseRan = true;
			t.tease(Math.min(A.max, A.start + (A.columns * col) / Math.max(1, st.held) + A.perScatter * Math.max(0, st.landed - st.triggerAfter)));
		} else if (t.fillPhase === 'build') {
			// after the tease (a scatter sting run brings the rest): each War Standard after the third
			t.tease(Math.min(A.max, A.start + (teaseRan ? A.columns : 0) + A.perScatter * Math.max(0, sg.scatterCells.length - ANTICIPATION_TEASE.triggerAfter)));
			// nothing came of it and the round is over: drain (the miss's own beat drains it sooner)
			if (context.stateXstateDerived.isIdle()) t.release();
		}
		if (t.fillPhase !== 'build') teaseRan = false;
		// THE BIG WIN COUNT: the win screen's tier (its impact is BIG, each landing after it the next), -1 when none
		let tier = -1;
		if (import.meta.env.DEV && devWinTier !== null) tier = devWinTier;
		else if (plaqueCelebrate.on && plaqueCelebrate.hideAt < 0) {
			tier = 0;
			const now = performance.now();
			const beats = plaqueCelebrate.beats;
			for (let i = 0; i < beats.length; i += 1) if (beats[i].barAt <= now && beats[i].tier > tier) tier = beats[i].tier;
		}
		t.win(tier);
		t.tick(ticker.deltaMS);
		if (import.meta.env.DEV) {
			const ms = performance.now() - t0;
			traceSpent.ms += ms;
			traceSpent.max = Math.max(traceSpent.max, ms);
			traceSpent.ticks += 1;
		}
	};
	let traceTicking = false;
	/** the logo was hidden (not the tab): the trace starts afresh when it is back */
	let traceStale = false;
	$effect(() => {
		const on = traceActive;
		const hiddenTab = !tabVisible;
		untrack(() => {
			const ticker = context.stateApp.pixiApplication?.ticker;
			if (on && !traceTicking && trace && ticker) {
				if (traceStale) trace.reset();
				traceStale = false;
				traceTicking = true;
				// NORMAL: before the render (LOW), like every other raw Pixi layer here
				ticker.add(traceTick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
			} else if (!on && traceTicking) {
				traceTicking = false;
				ticker?.remove(traceTick);
				// a hidden tab pauses where it is; anything else (a modal, the landing screen, the HUD away) starts afresh
				if (!hiddenTab) traceStale = true;
			}
		});
	});
	// DEV `enable(false)`: the light itself is not drawn either (the probe's A / B of its pixels and draw calls)
	$effect(() => {
		const on = traceEnabled && traceBuilt;
		untrack(() => {
			if (trace) trace.root.visible = on;
		});
	});
	// built once the still and the groove map are in
	$effect(() => {
		if (traceBuilt || !stillBuilt || !grooves || !context.stateApp.pixiApplication) return;
		untrack(() => {
			trace = new GrooveTrace(grooves!, (context.stateApp.pixiApplication?.renderer as PIXI.Renderer | undefined) ?? null);
			still.trace.addChild(trace.root);
			trace.place(still.state().contentScale);
			traceBuilt = true;
		});
	});

	// ---- THE PANEL AND THE KEY (constants LOGO_KEY) ----
	const key = new MultiplierKey(reducedMotion);
	still.over.addChild(key.root);
	still.over.alpha = 0;
	still.over.visible = false;
	let keyReady = $state(false);
	/** the board's live values, counted whenever a tile's value changes (stateGame.tiles: the state BoardCells draws from) */
	const counts = new Int16Array(KEY_VALUES.length);
	const slot = new Int8Array(129).fill(-1);
	KEY_VALUES.forEach((v, i) => (slot[v] = i));
	let anyLit = $state(false);
	/** DEV (logo_probe.js, the sheet's frame strips): values held in place of the board's, null = the board's */
	let devLive: number[] | null = $state(null);
	/** DEV: the panel's and the key's time runs this many times slower (the frame strips of the crossfade and the change) */
	let devSlow = 1;
	$effect(() => {
		const tiles = sg.tiles;
		const cap = sg.tileCap;
		counts.fill(0);
		let lit = false;
		for (let i = 0; i < tiles.length; i += 1) {
			const v = tiles[i].value;
			if (v > 0 && v <= 128 && slot[v] >= 0) {
				counts[slot[v]] += 1;
				lit = true;
			}
		}
		if (import.meta.env.DEV && devLive) {
			counts.fill(0);
			lit = false;
			for (const v of devLive) if (v > 0 && v <= 128 && slot[v] >= 0) (counts[slot[v]] += 1), (lit = true);
		}
		untrack(() => {
			key.setLive(counts, cap);
			// the LOGO is up: the key is not seen, so its change lands at once (no punch left over for the KEY's return)
			if (panelA === 0) key.finish();
			anyLit = lit;
			wakePanel();
		});
	});
	/** Popout S (constants LOGO_KEY.popout) and the per-layout choice (LOGO_KEY.layouts) */
	const keyLayout = $derived.by(() => {
		const c = context.stateLayoutDerived.canvasSizes();
		const P = LOGO_KEY.popout;
		if (c.width <= P.maxWidth && c.height <= P.maxHeight) return LOGO_KEY.layouts.popout === 'key';
		return LOGO_KEY.layouts[kind] === 'key';
	});
	/** DEV (logo_probe.js): 'logo' / 'key' holds the panel there, null = the game's own rule */
	let devPanel: 'logo' | 'key' | null = $state(null);
	const S = LOGO_KEY.state;
	const inFeature = $derived(sg.bonusMode !== null || sg.gameType !== 'basegame');
	const roundOn = $derived(!context.stateXstateDerived.isIdle() || sg.busy || sg.readouts.length > 0 || (stateBet.autoSpinsCounter ?? 0) !== 0);
	/** the KEY is wanted right now (before the hold back to LOGO) */
	const wantKey = $derived(
		devPanel !== null
			? devPanel === 'key'
			: !context.stateLayout.showLoadingScreen && keyLayout && (roundOn || (S.featureKey && inFeature) || (S.restWithLit === 'key' && anyLit)),
	);
	let panelKey = $state(false);
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	/** DEV / probe: every flip, when it happened (performance.now()) */
	const panelLog: { to: 'logo' | 'key'; at: number }[] = [];
	$effect(() => {
		const want = wantKey;
		const dev = devPanel !== null;
		untrack(() => {
			if (want) {
				if (holdTimer) clearTimeout(holdTimer);
				holdTimer = null;
				if (!panelKey) {
					panelKey = true;
					if (import.meta.env.DEV) panelLog.push({ to: 'key', at: performance.now() });
				}
			} else if (panelKey && !holdTimer) {
				const flip = () => {
					holdTimer = null;
					panelKey = false;
					if (import.meta.env.DEV) panelLog.push({ to: 'logo', at: performance.now() });
				};
				if (dev || !keyLayout || context.stateLayout.showLoadingScreen) flip();
				else holdTimer = setTimeout(flip, S.restHoldMs);
			}
		});
	});
	/** the panel's crossfade: 0 = LOGO, 1 = KEY (shown only once the key's art is in) */
	let panelA = 0;
	const panelTarget = $derived(panelKey && keyReady ? 1 : 0);
	let panelTicking = false;
	const applyPanel = () => {
		still.over.alpha = panelA;
		still.over.visible = panelA > 0;
		still.lettering.alpha = 1 - panelA;
	};
	const panelTick = (ticker: PIXI.Ticker) => {
		const to = panelTarget;
		const dt = import.meta.env.DEV ? ticker.deltaMS / devSlow : ticker.deltaMS;
		if (panelA !== to) {
			const step = dt / Math.max(1, S.fadeMs);
			panelA = to > panelA ? Math.min(to, panelA + step) : Math.max(to, panelA - step);
			applyPanel();
		}
		const moving = panelA > 0 ? key.tick(dt) : false;
		// the KEY breathes its ring while it is up; nothing else keeps this running
		if (panelA === to && to === 0 && !moving) stopPanel();
	};
	function wakePanel() {
		if (panelTicking || !context.stateApp.pixiApplication) return;
		if (panelA === 0 && panelTarget === 0) return;
		panelTicking = true;
		// NORMAL: before the render (LOW), like every other raw Pixi layer here
		context.stateApp.pixiApplication.ticker.add(panelTick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
	}
	function stopPanel() {
		if (!panelTicking) return;
		panelTicking = false;
		context.stateApp.pixiApplication?.ticker.remove(panelTick);
	}
	$effect(() => {
		void panelTarget;
		untrack(wakePanel);
	});
	/** the key's atlas (constants LOGO_KEY.atlas): the phone tier's half size copy */
	const keyAtlasUrl = PHONE_TIER ? stamp(new URL('../../assets/key/key-tiles-phone.json', import.meta.url).href) : stamp(new URL('../../assets/key/key-tiles.json', import.meta.url).href);
	/** the key laid out on the frame (every layout, and once its art is in) */
	function placePanel() {
		if (!stillBuilt) return;
		// CSS px per frame px (the stage is in CSS px)
		key.layout(still.art.width, still.art.height, still.content.scale.x || 1);
	}
	/** the frame's panel on screen (the probe's box: the key and the lettering stay inside it) */
	const panelScreen = () => {
		const [x, y, w, h] = LOGO_KEY.panel;
		const b = still.box;
		return { x: b.x + x * b.width, y: b.y + y * b.height, w: w * b.width, h: h * b.height };
	};

	// ---- the ticker: on only while the still fades ----
	let stillTicking = false;
	const stillTick = (ticker: PIXI.Ticker) => {
		if (!still.tick(ticker.deltaMS)) stopStill();
	};
	const startStill = () => {
		if (stillTicking || !still.ready) return;
		stillTicking = true;
		// NORMAL: before the render (LOW), like every other raw Pixi layer here
		context.stateApp.pixiApplication?.ticker.add(stillTick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
	};
	const stopStill = () => {
		if (!stillTicking) return;
		stillTicking = false;
		context.stateApp.pixiApplication?.ticker.remove(stillTick);
	};
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		const atlas = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		if (stillBuilt || !app || !atlas?.logoStill || !atlas?.logoLettering) return;
		const renderer = app.renderer as PIXI.Renderer;
		// 1938 px (1311 on the phone tier) drawn at 140 to 760 CSS px: a mip chain, as the <img> has the browser's own downscale
		if (LOGO.mipmaps) {
			enableMipmaps(atlas.logoStill.source, renderer);
			mips = atlas.logoStill.source.autoGenerateMipmaps ? atlas.logoStill.source.mipLevelCount : 1;
		}
		if (LOGO.mipmaps) enableMipmaps(atlas.logoLettering.source, renderer);
		still.build(atlas.logoStill, atlas.logoLettering);
		void renderer.prepare?.upload([atlas.logoStill.source, atlas.logoLettering.source]);
		stillBuilt = true;
	});
	// placement, every layout: the box the HTML rule gives, master -> canvas as MainContainer does
	$effect(() => {
		if (!stillBuilt) return;
		const master = context.stateLayoutDerived.mainLayout();
		const rect = kind === 'portrait' ? logoArtRect('portrait', context.stateLayoutDerived.canvasSizes().width / master.scale, isPhoneSizeType(context.stateLayoutDerived.canvasSizeType())) : logoArtRect(kind);
		const sh = LOGO.still.shadow[kind];
		const built = traceBuilt;
		untrack(() => {
			still.place(master.x + (rect.x - master.width / 2) * master.scale, master.y + (rect.y - master.height / 2) * master.scale, rect.width * master.scale, { dy: sh.dy * master.scale, blur: sh.blur * master.scale, alpha: sh.alpha });
			// the glow's width is in CSS px: its vertices follow the logo's size
			if (built) trace?.place((rect.width * master.scale) / LOGO.art.width);
			placePanel();
		});
	});
	let stillWasOn = false;
	$effect(() => {
		const on = stillOn;
		const visible = stillShown;
		untrack(() => {
			// the first show and a DEV switch are a cut; the HUD's own show / hide is a fade
			still.show(visible, !on || !stillWasOn);
			stillWasOn = on;
			if (on) startStill();
		});
	});
	// the chrome's <img> is hidden for as long as the canvas draws the logo: one logo, never two
	$effect(() => {
		logoState.canvas = stillOn;
	});

	context.eventEmitter.subscribeOnMount({
		// the HUD's own events: the logo is one of its kept elements (ui/Chrome.svelte)
		uiHide: (emitterEvent) => {
			hudOff = true;
			deep = emitterEvent.deep ?? false;
		},
		uiShow: () => {
			hudOff = false;
			deep = false;
		},
		// THE ANTICIPATION's outcome on screen (bookEventHandlerMap, the plaque's flag row reads the same beats): the trigger
		// pulse takes the fill further, a miss drains it back
		plaqueTease: ({ what }) => {
			if (what === 'miss') trace?.release();
			else if (what === 'trigger' && sg.gameType === 'basegame' && !sg.skipping) trace?.tease(A.trigger);
		},
		// a scatter sting run (a Mystery's, or the stings after a tease): the build up starts with its first strike
		stingBeat: ({ phase, kind }) => {
			if (kind !== 'scatter' || phase !== 'strike' || sg.gameType !== 'basegame' || sg.skipping || !trace) return;
			trace.tease(Math.min(A.max, A.start + A.perScatter * Math.max(0, sg.scatterCells.length - ANTICIPATION_TEASE.triggerAfter)));
		},
	});

	onMount(() => {
		// the groove map: its own chunk, asked for once the logo is mounted (never for a player with reduced motion)
		if (traceWanted) {
			// a literal `new URL(..., import.meta.url)`: Vite emits the file with a content hash in its name (the app does not
			// import JSON modules)
			fetch(new URL('../game/logo/grooves.json', import.meta.url).href)
				.then((r) => r.json() as Promise<GrooveJson>)
				.then((g) => (grooves = g))
				.catch((error) => console.error('[manticore] the logo groove map failed to load', error));
		}
		// THE ONE LINE HOOK (game/logo/trace.ts logoTrace.event): style 2 once, by the game's own rules: never while
		// skipping, nothing when the trace is not drawn
		attachLogoTrace((level: TraceLevel) => {
			if (!trace || !traceActive || sg.skipping) return;
			trace.event(level);
		});
		// THE KEY's atlas, its own request (until it is in the panel stays on LOGO)
		void PIXI.Assets.load<PIXI.Spritesheet>(keyAtlasUrl)
			.then((sheet) => {
				const renderer = context.stateApp.pixiApplication?.renderer as PIXI.Renderer | undefined;
				const first = Object.values(sheet.textures)[0];
				if (first && renderer) {
					// 384 px squares drawn at 20 to 100 CSS px: a mip chain
					enableMipmaps(first.source, renderer);
					void renderer.prepare?.upload([first.source]);
				}
				key.build(sheet.textures as Record<string, PIXI.Texture>);
				placePanel();
				keyReady = true;
			})
			.catch((error) => console.error('[manticore] the multiplier key atlas failed to load', error));
		const onVisibility = () => (tabVisible = !document.hidden);
		document.addEventListener('visibilitychange', onVisibility);
		// ---- DEV hook: __manticore.logo (tools/manticore/logo_probe.js) ------------------------------
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			Object.assign(((window as any).__manticore ??= {}), {
				/** THE PORTRAIT PHONE LOGO's option (constants LOGO.portraitPhoneEdge): 'current' (the old centre) or 'edge' (the
				 *  default since 2026-10-17: the tablet's left edge 2 CSS px from the screen's left edge). Returns the option in force. */
				logoPlace: (key: 'current' | 'edge') => {
					if (key === 'current' || key === 'edge') portraitOptions.logo = key;
					return portraitOptions.logo;
				},
				logo: {
					state: () => ({
						/** the still in the canvas: on (it is the logo), its art box in canvas px, the shadow, the file, the trace's place */
						still: { ...still.state(), on: stillOn, shownByHud: stillShown, ticking: stillTicking, mips },
						/** the stage bottom to top around the logo's host */
						order: (() => {
							const stage = host.parent?.children ?? [];
							const ix = (label: string) => stage.findIndex((c) => c.label === label);
							return { logo: stage.indexOf(host), scene: Math.max(ix('scene'), ix('scene-portrait')), creatureBehind: ix('creature-behind'), creatureFront: ix('creature-front'), count: stage.length, hostChildren: host.children.map((c) => c.label) };
						})(),
						canvasLogo: logoState.canvas,
						textures: (context.stateApp.pixiApplication?.renderer as any)?.texture?.managedTextures?.length ?? null,
					}),
					/** THE PANEL (constants LOGO_KEY): its state, the crossfade, the key's own state and every flip */
					panel: () => ({
						key: panelKey,
						want: wantKey,
						alpha: panelA,
						artReady: keyReady,
						layout: keyLayout,
						inFeature,
						roundOn,
						anyLit,
						holding: holdTimer !== null,
						dev: devPanel,
						ticking: panelTicking,
						lettering: still.lettering.alpha,
						coverBox: panelScreen(),
						letteringBox: (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(still.lettering.getBounds()),
						keyBox: (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(key.root.getBounds()),
						heroScreen: (() => {
							const h = key.root.getChildByLabel('logo-key-hero');
							if (!h) return null;
							const b = h.getBounds();
							return { x: b.x, y: b.y, w: b.width, h: b.height };
						})(),
						log: panelLog.slice(-40),
						/** every flip since the mount (log holds the last 40) */
						flips: panelLog.length,
						...key.state(),
					}),
					/** values held in place of the board's (e.g. [2, 2, 4]); null = the board's again */
					keyLive: (values: number[] | null) => (devLive = Array.isArray(values) ? values.slice() : null),
					/** the panel's and the key's time this many times slower (1 = real time) */
					keySlow: (k: number) => (devSlow = k > 0 ? k : 1),
					/** hold the panel on 'logo' or 'key' (null = the game's rule) */
					setPanel: (to: 'logo' | 'key' | null) => (devPanel = to === 'logo' || to === 'key' ? to : null),
					/** false = the still is not drawn (no logo in the canvas, the chrome's <img> shows) */
					enableStill: (on: boolean) => (stillEnabled = on),
					/** THE GROOVE TRACE (game/logo/trace.ts): where every style stands, and the game's own entry points */
					trace: {
						state: () =>
							trace && {
								...trace.state(),
								wanted: traceWanted,
								active: traceActive,
								ticking: traceTicking,
								enabled: traceEnabled,
								/** the tick's own cost since the last read: mean and worst ms, and how many ticks */
								tick: (() => {
									const out = { mean: traceSpent.ticks ? Number((traceSpent.ms / traceSpent.ticks).toFixed(4)) : 0, max: Number(traceSpent.max.toFixed(3)), ticks: traceSpent.ticks };
									traceSpent.ms = traceSpent.max = traceSpent.ticks = 0;
									return out;
								})(),
							},
						/** the feature entry's call, as bonusStart makes it */
						event: (level: TraceLevel = 'bonus') => {
							logoTrace.event(level);
							return trace?.fillPhase ?? null;
						},
						/** a tease's build up to this share of the full fill (the anticipation, by hand) */
						tease: (share: number) => trace?.tease(share),
						release: () => trace?.release(),
						/** false = no trace drawn */
						enable: (on: boolean) => (traceEnabled = on),
						/** a win tier held by hand without the win screen (0 BIG .. 4 MAX), null = back to the win screen's */
						win: (tier: number | null) => (devWinTier = typeof tier === 'number' ? tier : null),
						/** the brightness of every point of one groove path */
						litAlong: (id: string) => trace?.litAlong(id) ?? [],
						/** DEV: the light pass's gain (constants LOGO.trace.passGain), to measure it against the mock */
						passGain: (g: number) => {
							if (trace && g > 0) trace.cfg.passGain = g;
							return trace?.cfg.passGain ?? null;
						},
						/** the instance itself (in-page probes only) */
						instance: () => trace,
					},
					/** THE PORTRAIT PHONE LOGO's width, master px (null = constants LOGO.portraitPhone.width): the gap measure */
					phoneWidth: (w: number | null) => {
						portraitOptions.logoWidth = typeof w === 'number' && w > 0 ? w : null;
						return portraitOptions.logoWidth;
					},
				},
			});
		}
		return () => {
			stopStill();
			stopPanel();
			if (holdTimer) clearTimeout(holdTimer);
			attachLogoTrace(null);
			document.removeEventListener('visibilitychange', onVisibility);
			if (traceTicking) context.stateApp.pixiApplication?.ticker.remove(traceTick);
			traceTicking = false;
			trace?.destroy();
			trace = null;
			logoState.canvas = false;
			if (import.meta.env.DEV && typeof window !== 'undefined') {
				delete (window as any).__manticore?.logo;
				delete (window as any).__manticore?.logoPlace;
			}
			// the parent's unmount destroys the root without its children: they go here
			for (const child of host.removeChildren()) child.destroy({ children: true });
		};
	});
</script>
