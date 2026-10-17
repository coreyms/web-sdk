<script lang="ts">
	// THE LOGO, IN THE CANVAS IN EVERY LAYOUT AND TIER (2026-10-13, Corey: "The manticore should read in front of the
	// Logo in Portrait mode, I guess that can be for all modes").
	//   animated  desktop tier, landscape master: the stacked logo with its wings, drawn from the layered data:
	//             entrance, idle breathe, glint, flare (game/logo/view.ts owns the scene, constants LOGO the numbers)
	//   still     everywhere else (the phone tier, every portrait screen, the phone master) and as the desktop's
	//             stand-in until its atlas is in: logo-stacked.webp with its baked shadow and the Shine in strips
	//             (game/logo/still.ts). It was the chrome's <img> until now; HTML is over the whole canvas, so the
	//             creature could not stand in front of it. The <img> stays in the chrome as the fallback (and the
	//             alt text) and is hidden for as long as this draws the logo (logoState.canvas).
	//
	// WHERE: exactly the box the HTML rule gives (game/logo/layout.ts logoArtRect), mapped from the master to
	// canvas px the way MainContainer does.
	// Z ORDER: its host `logo` is mounted in components/Game.svelte straight after the scene and BEFORE the creature's
	// two hosts and the board: scene < logo < creature (behind the board) < board < creature (in front) < spin total,
	// plaques, win screens, transition < the HTML HUD. So the logo is under the creature in every layout, and since
	// the creature is under the plaques and the transition, so is the logo now (the plaque's scene dim darkens it and
	// the transition covers it; it was over both). No logo box reaches the board's art in any layout.
	// WHEN THE ANIMATED ONE IS THE LOGO: the atlas and the tracks are in (they ride the deferred phase,
	// game/deferredLoad.ts) and the layout is the landscape master. Until then, and in the other layouts, the still
	// is drawn in the same box.
	//   ready when the game first shows   the entrance plays, once
	//   ready later                       it takes over from the still on the still's own pose, no entrance
	// WHAT IT READS: whether the board is at rest, the spin's final total (for the flare) and the HUD's own
	// show / hide events. It decides nothing.
	//   at rest    the game actor is idle, no choreography in flight, no cluster readout, no win screen, no
	//              plaque, no press gate, no modal: the breathing advances and one glint sweeps per breath
	//   otherwise  the current frame is held: no vertex is written and the ticker callback is off
	//   flare      on spinWinFinal at LOGO.flareMinXBet times the bet or more (game/logo/view.ts flare() holds
	//              the one at a time and minimum gap rules); never while SKIP TO RESULT runs
	import * as PIXI from 'pixi.js';
	import { onMount, untrack } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { stateModal } from 'state-shared';
	import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';

	import { getContext } from '../game/context';
	import { LOGO_DATA_URLS } from '../game/assets';
	import { CHAIN_GUST, LOGO, RENDER_RESOLUTION_CAP } from '../game/constants';
	import { chainGust } from '../game/featureFx';
	import { PHONE_TIER } from '../game/deviceTier';
	import { isPhoneSizeType, layoutKind } from '../game/layoutSpec';
	import { enableMipmaps } from '../game/mipmaps';
	import { loadLogoData, logoDataNow, type LogoData } from '../game/logo/data';
	import { logoArtRect, logoFramePlacement } from '../game/logo/layout';
	import { logoState } from '../game/logo/state.svelte';
	import { portraitOptions } from '../game/portraitOptions.svelte';
	import { LogoStill } from '../game/logo/still';
	import { LogoView } from '../game/logo/view';
	import { hudHiddenByModal } from '../ui/armoury/armouryView.svelte';

	const context = getContext();
	const sg = context.stateGame;
	const view = new LogoView(LOGO);
	const still = new LogoStill({ fadeMs: LOGO.fadeMs, shadowBakeWidth: LOGO.still.shadowBakeWidth, shine: LOGO.still.shine });
	// on the stage itself (canvas px): see Z ORDER above. One host, the still under the animated logo (never both drawn)
	const host = new PIXI.Container();
	host.label = 'logo';
	host.eventMode = 'none';
	host.interactiveChildren = false;
	host.addChild(still.root, view.root);
	getContextParent().addToParent(host);

	let data: LogoData | null = $state.raw(logoDataNow());
	let built = $state(false);
	/** DEV A / B (tools/manticore/logo_probe.js): false hands the logo back to the chrome's still */
	let enabled = $state(true);
	/** DEV (logo_probe.js): false = no still either, so a shot has no logo at all */
	let stillEnabled = $state(true);
	let stillBuilt = $state(false);
	/** the HUD is away (uiHide .. uiShow), and the max win screen's deep hide (uiHide { deep }): even the kept HUD
	 *  elements go, and so does this */
	let hudOff = $state(false);
	let deep = $state(false);
	/** true only through the first pass of the effects below: a logo built in it plays the entrance */
	let firstPass = true;
	let mips = 1;
	/** the art box's centre in canvas px (the placement effect): where the entrance's gust comes from */
	let centreX = 0;

	/** the entrance's gust (CHAIN_GUST.logo): the air of the letters setting down at landFrame reaches the chains a
	 *  beat later, each leaning away from the logo (fromLogo) or from the centre. Never while skipping. */
	const entranceGust = () => {
		if (sg.skipping || !data) return;
		const lead = LOGO.entranceDelayMs + (CHAIN_GUST.logo.landFrame * 1000) / data.json.fps;
		chainGust('logo', Math.max(0.2, context.stateGameDerived.timeScale()), CHAIN_GUST.logo.fromLogo ? centreX : null, lead);
	};

	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const active = $derived(built && enabled && kind === 'landscape');
	/** the HUD's own rule for its logo (ui/Chrome.svelte): gone under a modal (but not under THE ARMOURY, which keeps the
	 *  game visible under its tint: the one shared rule, ui/armoury/armouryView hudHiddenByModal); a kept element in
	 *  landscape and portrait (only the deep hide takes it), and on the phone master it goes with the HUD */
	const hudShows = $derived(!hudHiddenByModal(stateModal.modal) && (kind === 'phone' ? !hudOff : !deep));
	const shown = $derived(active && hudShows);
	const stillOn = $derived(stillBuilt && stillEnabled && !active);
	const stillShown = $derived(stillOn && hudShows);
	const reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	/** the Shine: where the chrome's still had one (not on the desktop's stand-in) */
	const stillShine = $derived(!reducedMotion && (PHONE_TIER || kind !== 'landscape'));
	const rest = $derived(shown && context.stateXstateDerived.isIdle() && !sg.busy && sg.readouts.length === 0 && !sg.winShowing && sg.pressGates === 0 && !sg.plaque && !sg.sessionRecap);

	// ---- the ticker: on only while something moves ------------------------------------------------
	let ticking = false;
	let resting = false;
	/** DEV: what the tick itself costs (ms), summed since the probe last read it */
	const spent = { ms: 0, max: 0, ticks: 0 };
	const tick = (ticker: PIXI.Ticker) => {
		const t0 = import.meta.env.DEV ? performance.now() : 0;
		const more = view.tick(ticker.lastTime, ticker.deltaMS, resting);
		if (import.meta.env.DEV) {
			const ms = performance.now() - t0;
			spent.ms += ms;
			spent.max = Math.max(spent.max, ms);
			spent.ticks += 1;
		}
		if (!more) stop();
	};
	const start = () => {
		if (ticking || !view.ready) return;
		ticking = true;
		// NORMAL: before the render (LOW), like every other raw Pixi layer here
		context.stateApp.pixiApplication?.ticker.add(tick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
	};
	const stop = () => {
		if (!ticking) return;
		ticking = false;
		context.stateApp.pixiApplication?.ticker.remove(tick);
	};

	// ---- the still: its own ticker callback, on only while it fades or keeps the Shine's time ----
	let stillTicking = false;
	const stillTick = (ticker: PIXI.Ticker) => {
		if (!still.tick(ticker.lastTime, ticker.deltaMS)) stopStill();
	};
	const startStill = () => {
		if (stillTicking || !still.ready) return;
		stillTicking = true;
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
		if (stillBuilt || !app || !atlas?.logoStill) return;
		const renderer = app.renderer as PIXI.Renderer;
		// 1200 px drawn at 390 to 770 device px: a mip chain, as the <img> had the browser's own downscale
		if (LOGO.mipmaps) enableMipmaps(atlas.logoStill.source, renderer);
		still.build(atlas.logoStill, atlas.logoGlint ?? null);
		void renderer.prepare?.upload([atlas.logoStill.source]);
		stillBuilt = true;
	});
	// placement, every layout: the box the HTML rule gives, master -> canvas as MainContainer does
	$effect(() => {
		if (!stillBuilt) return;
		const master = context.stateLayoutDerived.mainLayout();
		const rect = kind === 'portrait' ? logoArtRect('portrait', context.stateLayoutDerived.canvasSizes().width / master.scale, isPhoneSizeType(context.stateLayoutDerived.canvasSizeType())) : logoArtRect(kind);
		const sh = LOGO.still.shadow[kind];
		untrack(() => still.place(master.x + (rect.x - master.width / 2) * master.scale, master.y + (rect.y - master.height / 2) * master.scale, rect.width * master.scale, { dy: sh.dy * master.scale, blur: sh.blur * master.scale, alpha: sh.alpha }));
	});
	let stillWasOn = false;
	$effect(() => {
		const on = stillOn;
		const visible = stillShown;
		const shine = stillShine;
		untrack(() => {
			still.shine = shine;
			// the hand over to and from the animated logo is a cut (the same picture in the same box); the HUD's is a fade
			still.show(visible, !on || !stillWasOn);
			stillWasOn = on;
			if (on) startStill();
		});
	});

	// build once the tracks and the atlas are in
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		const atlas = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		if (built || !data || !app || !atlas?.logo_letters) return;
		view.build(data, atlas);
		const renderer = app.renderer as PIXI.Renderer;
		// the art is drawn at 0.3 to 0.9 of its texture: a mip chain, sampled the way the plaque's full tier is
		// (the nearest level at the desktop resolution cap, trilinear below it; components/StingerPlaque.svelte)
		const source = view.source(atlas);
		if (LOGO.mipmaps && source) {
			enableMipmaps(source, renderer);
			if (renderer.resolution >= RENDER_RESOLUTION_CAP.desktop) source.mipmapFilter = 'nearest';
			mips = source.autoGenerateMipmaps ? source.mipLevelCount : 1;
		}
		if (source) void renderer.prepare?.upload([source]);
		built = true;
	});

	// placement: plain arithmetic on the layout rule, re-derived on every resize
	$effect(() => {
		if (!built || !data) return;
		const master = context.stateLayoutDerived.mainLayout();
		const rect = logoArtRect('landscape');
		const p = logoFramePlacement(data.json.art, rect);
		centreX = master.x + (rect.x + rect.width / 2 - master.width / 2) * master.scale;
		// master -> canvas: MainContainer centres the master on the canvas at master.scale
		view.place(master.x + (p.x - master.width / 2) * master.scale, master.y + (p.y - master.height / 2) * master.scale, p.scale * master.scale);
	});

	// who draws the logo, and the first show
	let wasActive = false;
	$effect(() => {
		const on = active;
		const visible = shown;
		untrack(() => {
			if (on && !wasActive) {
				view.show(visible, true);
				if (firstPass && visible) {
					view.startEntrance(performance.now());
					entranceGust();
				} else view.takeOver();
			} else if (!on) view.show(false, true);
			else view.show(visible);
			wasActive = on;
			if (on) start();
		});
	});
	// the chrome's <img> is hidden for as long as the canvas draws the logo, animated or still: one logo, never two
	$effect(() => {
		logoState.canvas = active || stillOn;
	});
	$effect(() => {
		resting = rest;
		if (rest) start();
	});
	$effect(() => {
		// registered last, so it runs after the first pass of the effects above
		firstPass = false;
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
		// the still's full Shine on a spin press, as ui/Shine.svelte
		bet: () => {
			if (!stillOn || !still.shown) return;
			still.sweep(performance.now(), true);
			startStill();
		},
		spinWinFinal: ({ amount }) => {
			if (!active || sg.skipping || amount / BOOK_AMOUNT_MULTIPLIER < LOGO.flareMinXBet) return;
			if (view.flare(performance.now())) start();
		},
	});

	onMount(() => {
		// the phone tier never draws the animated logo: none of its files is asked for
		if (!data && !PHONE_TIER) {
			loadLogoData(LOGO_DATA_URLS)
				.then((d) => (data = d))
				.catch((error) => console.error('[manticore] the logo data failed to load', error));
		}
		// ---- DEV hook: __manticore.logo (tools/manticore/logo_probe.js) ------------------------------
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			Object.assign(((window as any).__manticore ??= {}), {
				/** THE PORTRAIT PHONE LOGO's option (constants LOGO.portraitPhoneEdge): 'current' (shipped) or 'edge' (the left
				 *  wing's tip 2 CSS px from the screen's left edge). Returns the option in force. */
				logoPlace: (key: 'current' | 'edge') => {
					if (key === 'current' || key === 'edge') portraitOptions.logo = key;
					return portraitOptions.logo;
				},
				logo: {
					state: () => {
						const source = view.source((context.stateApp.loadedAssets ?? {}) as Record<string, PIXI.Texture>);
						return {
							...view.state(),
							/** the still in the canvas: on (it is the logo), its art box in canvas px, the Shine, the shadow */
							still: { ...still.state(), on: stillOn, shownByHud: stillShown, ticking: stillTicking },
							/** the stage bottom to top around the logo's host */
							order: (() => {
								const stage = host.parent?.children ?? [];
								const ix = (label: string) => stage.findIndex((c) => c.label === label);
								return { logo: stage.indexOf(host), scene: Math.max(ix('scene'), ix('scene-portrait')), creatureBehind: ix('creature-behind'), creatureFront: ix('creature-front'), count: stage.length, hostChildren: host.children.map((c) => c.label) };
							})(),
							canvasLogo: logoState.canvas,
							active,
							shown,
							rest,
							ticking,
							/** the tick's own cost since the last read: mean and worst ms, and how many ticks */
							tick: (() => {
								const out = { mean: spent.ticks ? Number((spent.ms / spent.ticks).toFixed(4)) : 0, max: Number(spent.max.toFixed(3)), ticks: spent.ticks };
								spent.ms = spent.max = spent.ticks = 0;
								return out;
							})(),
							/** the atlas on the GPU: width, height, mip levels */
							atlas: [source?.pixelWidth ?? 0, source?.pixelHeight ?? 0, mips],
							textures: (context.stateApp.pixiApplication?.renderer as any)?.texture?.managedTextures?.length ?? null,
						};
					},
					/** a flare by the game's own rules (false = refused: one at a time, the minimum gap) */
					flare: () => {
						const ok = view.flare(performance.now());
						if (ok) start();
						return ok;
					},
					/** play the entrance again (the review recording) */
					entrance: () => {
						view.startEntrance(performance.now());
						entranceGust();
						start();
					},
					/** false = the chrome's still draws the logo again (the A / B of the cost and of the placement) */
					enable: (on: boolean) => (enabled = on),
					/** false = the still is not drawn either (with enable(false): no logo in the canvas, the chrome's <img> shows) */
					enableStill: (on: boolean) => (stillEnabled = on),
					/** the motion's vertices for an idle frame, a settle weight and a flare frame (negative = none) */
					sample: (idleFrame: number, settle: number, flareFrame: number) => view.sample(idleFrame, settle, flareFrame),
				},
			});
		}
		return () => {
			stop();
			stopStill();
			logoState.canvas = false;
			if (import.meta.env.DEV && typeof window !== 'undefined') {
				delete (window as any).__manticore?.logo;
				delete (window as any).__manticore?.logoPlace;
			}
			// the parent's unmount destroys the root without its children: they go here
			for (const child of view.root.removeChildren()) child.destroy({ children: true });
			for (const child of host.removeChildren()) child.destroy({ children: true });
		};
	});
</script>
