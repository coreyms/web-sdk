<script lang="ts">
	// THE CANVAS LOGO (desktop tier, landscape master): the stacked logo with its wings, drawn from the layered
	// data: entrance, idle breathe, glint, flare (game/logo/view.ts owns the scene, constants LOGO the numbers).
	// On the phone tier this component is not mounted at all and the logo is the chrome's <img>.
	//
	// WHERE: exactly the box the HTML rule gives (game/logo/layout.ts logoArtRect), mapped from the master to
	// canvas px the way MainContainer does. It is the LAST child of the stage: the HTML logo it replaces sat
	// over the whole canvas (the plaque's scene dim, the transition), and so does this.
	// WHEN IT IS THE LOGO: the atlas and the tracks are in (they ride the deferred phase, game/deferredLoad.ts)
	// and the layout is the landscape master. Until then, and in the other layouts, logoState.canvas is false
	// and ui/ChromeLandscape.svelte shows the still in the same box.
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
	import { LOGO, RENDER_RESOLUTION_CAP } from '../game/constants';
	import { layoutKind } from '../game/layoutSpec';
	import { enableMipmaps } from '../game/mipmaps';
	import { loadLogoData, logoDataNow, type LogoData } from '../game/logo/data';
	import { logoArtRect, logoFramePlacement } from '../game/logo/layout';
	import { logoState } from '../game/logo/state.svelte';
	import { LogoView } from '../game/logo/view';

	const context = getContext();
	const sg = context.stateGame;
	const view = new LogoView(LOGO);
	// on the stage itself (canvas px), after everything else: see WHERE above
	getContextParent().addToParent(view.root);

	let data: LogoData | null = $state.raw(logoDataNow());
	let built = $state(false);
	/** DEV A / B (tools/manticore/logo_probe.js): false hands the logo back to the chrome's still */
	let enabled = $state(true);
	/** the max win screen's deep hide (uiHide { deep }): even the kept HUD elements go, and so does this */
	let deep = $state(false);
	/** true only through the first pass of the effects below: a logo built in it plays the entrance */
	let firstPass = true;
	let mips = 1;

	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const active = $derived(built && enabled && kind === 'landscape');
	const shown = $derived(active && stateModal.modal == null && !deep);
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
		const p = logoFramePlacement(data.json.art, logoArtRect('landscape'));
		// master -> canvas: MainContainer centres the master on the canvas at master.scale
		view.place(master.x + (p.x - master.width / 2) * master.scale, master.y + (p.y - master.height / 2) * master.scale, p.scale * master.scale);
	});

	// who draws the logo, and the first show
	let wasActive = false;
	$effect(() => {
		const on = active;
		const visible = shown;
		untrack(() => {
			logoState.canvas = on;
			if (on && !wasActive) {
				view.show(visible, true);
				if (firstPass && visible) view.startEntrance(performance.now());
				else view.takeOver();
			} else if (!on) view.show(false, true);
			else view.show(visible);
			wasActive = on;
			if (on) start();
		});
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
			deep = emitterEvent.deep ?? false;
		},
		uiShow: () => {
			deep = false;
		},
		spinWinFinal: ({ amount }) => {
			if (!active || sg.skipping || amount / BOOK_AMOUNT_MULTIPLIER < LOGO.flareMinXBet) return;
			if (view.flare(performance.now())) start();
		},
	});

	onMount(() => {
		if (!data) {
			loadLogoData(LOGO_DATA_URLS)
				.then((d) => (data = d))
				.catch((error) => console.error('[manticore] the logo data failed to load', error));
		}
		// ---- DEV hook: __manticore.logo (tools/manticore/logo_probe.js) ------------------------------
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			Object.assign(((window as any).__manticore ??= {}), {
				logo: {
					state: () => {
						const source = view.source((context.stateApp.loadedAssets ?? {}) as Record<string, PIXI.Texture>);
						return {
							...view.state(),
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
						start();
					},
					/** false = the chrome's still draws the logo again (the A / B of the cost and of the placement) */
					enable: (on: boolean) => (enabled = on),
					/** the motion's vertices for an idle frame, a settle weight and a flare frame (negative = none) */
					sample: (idleFrame: number, settle: number, flareFrame: number) => view.sample(idleFrame, settle, flareFrame),
				},
			});
		}
		return () => {
			stop();
			logoState.canvas = false;
			if (import.meta.env.DEV && typeof window !== 'undefined') delete (window as any).__manticore?.logo;
			// the parent's unmount destroys the root without its children: they go here
			for (const child of view.root.removeChildren()) child.destroy({ children: true });
		};
	});
</script>
