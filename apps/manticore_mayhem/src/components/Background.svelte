<script lang="ts">
	// THE BACKGROUND: THE COURTYARD SCENE in every layout (game/scene.ts owns the Pixi scenes, constants SCENE the
	// numbers, game/sceneSpec.ts the geometry, tools/build_scene_assets.py the files). Two scenes, one per frame:
	//   LANDSCAPE and PHONE SIDEWAYS   one 16:9 frame: painted backdrop, 3D foreground, the braziers' fire light as an
	//                                  additive pass that flickers, and the knocker rings and chains, which sway in
	//                                  the wind and swing on the board's kick.
	//   PORTRAIT                       its own 9:16 frame: backdrop, the paved floor, the same fire pass treatment.
	//                                  Nothing moves in it (no columns, knockers or chains are in view).
	// Each is cover-fitted to the canvas and centred exactly as the placeholder was. This component only tells the
	// scene of the current layout WHICH mode it is in:
	//   family   the game's four background keys, unchanged: base outside a feature (Base, the antes, a Mystery's
	//            base spin), else the book's own bonus kind (bonus / super / epic, which is also where a Mystery's
	//            award lands). base and bonus are the DAY scene, super the NIGHT, epic the night in red.
	//   dim      the old wash as a tint on every layer (SCENE.dim).
	// A change of either crossfades. A Super or Epic that starts before the night files are in (the deferred
	// phase, after the plaque) plays over the day scene and crossfades when they land.
	//
	// WHICH FILES: only the boot layout's scene is registered (game/assets.ts). When the layout first becomes the
	// other scene's (the device was turned), game/deferredLoad.ts loadSceneLate fetches that scene then, and it fades
	// in. Once both are in, a turn switches at once, and the scene that is no longer shown lets its GPU copies go
	// (SceneView.release: the decoded images stay, so turning back downloads and decodes nothing; Pixi uploads them
	// again as they are drawn).
	//
	// THE PLACEHOLDER (the citadel courtyard painting, tools/build_board_layers.py, one crop per layout under the
	// scene wash) is the fallback: it is drawn while a scene's files are on their way, or if they failed, and the
	// scene fades in over it. The flat sky colour is under everything, so nothing here ever mounts conditionally
	// (house rule: always-mounted z order).
	import * as PIXI from 'pixi.js';
	import { onMount, untrack } from 'svelte';
	import { BaseSprite, Rectangle, getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { layoutKind } from '../game/layoutSpec';
	import { BACKGROUND_WASH, SCENE, zIndexes } from '../game/constants';
	import { SCENE_AT_BOOT } from '../game/assets';
	import { loadPlaceholderLate, loadSceneLate } from '../game/deferredLoad';
	import { PHONE_TIER } from '../game/deviceTier';
	import { SCENE_SPEC, SCENE_SPEC_PORTRAIT } from '../game/sceneSpec';
	import { SceneView, flickerAt, idleAt, type SceneLayout } from '../game/scene';

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));

	const family = $derived(
		context.stateGame.gameType !== 'freegame'
			? 'base'
			: context.stateGame.bonusMode === 'epic'
				? 'epic'
				: context.stateGame.bonusMode === 'super'
					? 'super'
					: 'bonus',
	);
	const texture = $derived.by(() => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		return assets?.[`bg_${family}_${kind}`] ?? assets?.[`bg_base_${kind}`] ?? PIXI.Texture.EMPTY;
	});
	/** cover fit: the texture fills the canvas, centred, the overflow cropped by the canvas edge. A scale,
	 *  never width / height: those are relative to whichever texture the sprite holds when they land */
	const fit = $derived.by(() => {
		const tw = texture.width || 1;
		const th = texture.height || 1;
		const s = Math.max(canvas.width / tw, canvas.height / th);
		return { x: (canvas.width - tw * s) / 2, y: (canvas.height - th * s) / 2, s };
	});
	const wash = $derived(context.stateGame.gameType === 'freegame' ? BACKGROUND_WASH.freegame : BACKGROUND_WASH.base);

	// ---- the courtyard scenes ---------------------------------------------------------------------
	const LAYOUTS = ['landscape', 'portrait'] as const;
	const tier = PHONE_TIER ? 'phone' : 'full';
	const views: Record<SceneLayout, SceneView> = { landscape: new SceneView('landscape', tier), portrait: new SceneView('portrait', tier) };
	const frames = { landscape: SCENE_SPEC.frame, portrait: SCENE_SPEC_PORTRAIT.frame };
	const parent = getContextParent();
	for (const layout of LAYOUTS) {
		views[layout].root.zIndex = zIndexes.background.scene;
		parent.addToParent(views[layout].root);
	}

	/** the scene this layout draws */
	const which: SceneLayout = $derived(kind === 'portrait' ? 'portrait' : 'landscape');
	const dim = $derived(context.stateGame.gameType === 'freegame' ? SCENE.dim.freegame : SCENE.dim.base);
	const ready = $state({ landscape: { day: false, night: false }, portrait: { day: false, night: false } });
	/** this layout's scene has its day files */
	const sceneOn = $derived(ready[which].day);
	/** the scene has fully covered the placeholder (which is then not drawn) */
	let covered = $state(false);
	/** DEV A / B (tools/manticore/scene_probe.js cost): false hands every layout back to the placeholder */
	let enabled = $state(true);
	/** the scene being drawn (a plain copy of `which` for the ticker) */
	let active: SceneLayout = 'landscape';
	/** DEV: every release of a hidden scene's GPU copies and every upload of a scene that came back */
	const memory = { releases: 0, wakes: 0 };

	const renderer = () => context.stateApp.pixiApplication?.renderer as PIXI.Renderer | undefined;
	/** this layout's scene covers the screen: the placeholder goes, and so do the other scene's GPU copies */
	const settle = () => {
		covered = true;
		const other = views[active === 'landscape' ? 'portrait' : 'landscape'];
		if (other.dayReady && other.release()) memory.releases += 1;
	};

	// the ticker: ONE callback, on while a scene is drawn (the fire always flickers), off before its files are in
	let ticking = false;
	/** DEV: what the tick itself costs (ms), summed since the probe last read it */
	const spent = { ms: 0, max: 0, ticks: 0 };
	const tick = (ticker: PIXI.Ticker) => {
		const t0 = import.meta.env.DEV ? performance.now() : 0;
		const view = views[active];
		view.tick(ticker.lastTime, ticker.deltaMS);
		if (!covered && view.shown) settle();
		if (import.meta.env.DEV) {
			const ms = performance.now() - t0;
			spent.ms += ms;
			spent.max = Math.max(spent.max, ms);
			spent.ticks += 1;
		}
	};
	const start = () => {
		if (ticking) return;
		ticking = true;
		// NORMAL: before the render (LOW), like every other raw Pixi layer here; it reads the same boardKick
		// this frame as the board's own chains (components/BoardFrame.svelte)
		context.stateApp.pixiApplication?.ticker.add(tick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
	};
	const stop = () => {
		if (!ticking) return;
		ticking = false;
		context.stateApp.pixiApplication?.ticker.remove(tick);
	};

	// the files: a scene's day set builds it, its night set joins it. Uploaded once when they land if that scene is
	// the one on screen; a scene that is not showing takes its upload when it is next shown.
	$effect(() => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		if (!assets) return;
		untrack(() => {
			for (const layout of LAYOUTS) {
				const view = views[layout];
				const r = ready[layout];
				if (r.day && r.night) continue;
				const before = view.sources().length;
				if (!r.day && view.setDay(assets)) r.day = true;
				if (r.day && !r.night && view.setNight(assets, performance.now())) r.night = true;
				if (view.sources().length === before) continue;
				if (layout === which) void renderer()?.prepare?.upload(view.sources());
				else view.released = true;
			}
		});
	});
	// only the boot layout's scene was registered: fetch the other one the first time it can show, and with it the
	// placeholder crop of this layout, which stands in until the scene is in (nothing of either on a game never turned)
	$effect(() => {
		if (!enabled || which === SCENE_AT_BOOT) return;
		if (!ready[which].day) void loadPlaceholderLate(context.stateApp, kind);
		void loadSceneLate(context.stateApp);
	});

	// placement: the placeholder's own cover fit, on each scene's frame
	$effect(() => {
		for (const layout of LAYOUTS) {
			const [fw, fh] = frames[layout];
			const s = Math.max(canvas.width / fw, canvas.height / fh);
			views[layout].place((canvas.width - fw * s) / 2, (canvas.height - fh * s) / 2, s);
		}
	});

	// which scene, which mode, and whether a scene is drawn at all
	let wasOn = false;
	let lastWhich: SceneLayout | null = null;
	$effect(() => {
		const w = which;
		const on = sceneOn && enabled;
		const f = family;
		const d = dim;
		const loading = context.stateLayout.showLoadingScreen;
		untrack(() => {
			const view = views[w];
			const turned = lastWhich !== w;
			if (turned) {
				const other = views[w === 'landscape' ? 'portrait' : 'landscape'];
				other.hide();
				other.root.visible = false;
				covered = false;
			}
			active = w;
			view.root.visible = on;
			if (on) {
				if (view.released) {
					view.released = false;
					memory.wakes += 1;
					void renderer()?.prepare?.upload(view.sources());
				}
				// at once when nothing is there to fade over (the loading screen is up) and when the layout has just
				// become this scene's with its files already in (a turn back); a scene whose files land later fades in
				view.mode(f, d, loading || turned ? -1 : performance.now());
				if (view.shown) settle();
				start();
			} else {
				if (wasOn && !turned) view.hide();
				covered = false;
				stop();
			}
			wasOn = on;
			lastWhich = w;
		});
	});

	onMount(() => {
		// ---- DEV hook: __manticore.scene (tools/manticore/scene_probe.js) ---------------------------
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			/** how many of a scene's sources have a GL texture right now (the renderer's own table, not the count it keeps) */
			const onGpu = (view: SceneView) => {
				const table = (renderer() as any)?.texture?._glTextures ?? {};
				return view.sources().filter((source) => !!table[source.uid]).length;
			};
			const pt = (view: SceneView, x: number, y: number) => {
				const p = view.root.toGlobal({ x, y });
				return { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) };
			};
			Object.assign(((window as any).__manticore ??= {}), {
				scene: {
					/** the scene of the current layout (or of `layout`: the one that is not showing) */
					state: (layout: SceneLayout = which) => {
						const view = views[layout];
						const mine = layout === which;
						return {
							...view.state(),
							kind,
							on: mine && sceneOn && enabled,
							/** the placeholder: drawn (true) or covered by the scene, and its wash */
							placeholder: { drawn: texture !== PIXI.Texture.EMPTY && !covered, wash: covered ? 0 : wash },
							ticking,
							/** the tick's own cost since the last read: mean and worst ms, and how many ticks */
							tick: (() => {
								const out = { mean: spent.ticks ? Number((spent.ms / spent.ticks).toFixed(4)) : 0, max: Number(spent.max.toFixed(3)), ticks: spent.ticks };
								spent.ms = spent.max = spent.ticks = 0;
								return out;
							})(),
							/** canvas px per frame px, the frame's rectangle on the canvas, and the stage's children by z */
							fit: { scale: view.root.scale.x, x: view.root.x, y: view.root.y, frame: frames[layout] },
							stage: view.root.parent?.children.map((c) => `${c.label || c.constructor.name}@${c.zIndex}${c.visible ? '' : ' (off)'}`) ?? [],
							textures: { ...view.state().textures, managed: (renderer() as any)?.texture?.managedTextures?.length ?? null },
							/** both scenes: files in, GPU copies let go, and how often that happened */
							resident: {
								landscape: { ...ready.landscape, released: views.landscape.released, onGpu: onGpu(views.landscape) },
								portrait: { ...ready.portrait, released: views.portrait.released, onGpu: onGpu(views.portrait) },
								...memory,
							},
							/** landscape only, per side, in CANVAS px as Pixi draws them: the ring's hook for the swag through the
							 *  ring sprite's own transform, and the swag strip's top end at that height through its own vertices */
							screen:
								layout !== 'landscape'
									? null
									: Object.fromEntries(
											(['L', 'R'] as const).map((side) => {
												const p = SCENE_SPEC.points[side];
												const hook = view.hookOnScreen(side);
												return [side, { pivot: pt(view, p.pivot[0], p.pivot[1]), ringHook: hook.ring, swagTop: hook.swag, gap: Number(Math.hypot(hook.ring.x - hook.swag.x, hook.ring.y - hook.swag.y).toFixed(3)), swagPin: pt(view, p.swagPin[0], p.swagPin[1]) }];
											}),
										),
						};
					},
					/** the constants and the pure curves, so the probe never repeats a number */
					constants: () => JSON.parse(JSON.stringify(SCENE)),
					spec: (layout: SceneLayout = 'landscape') => JSON.parse(JSON.stringify(layout === 'landscape' ? SCENE_SPEC : SCENE_SPEC_PORTRAIT)),
					flickerAt: (ms: number) => flickerAt(ms),
					idleAt: (piece: 'hang' | 'swag', side: 'L' | 'R', ms: number) => idleAt(piece, side, ms),
					/** false = the placeholder draws every layout again (the A / B of the cost) */
					enable: (on: boolean) => (enabled = on),
				},
			});
		}
		return () => stop();
	});
</script>

<!-- the flat sky stays under the art: it is what shows before the texture is in -->
<Rectangle zIndex={zIndexes.background.backdrop} width={canvas.width} height={canvas.height} backgroundColor={0x2a2230} />
<!-- the placeholder and its wash: the fallback, until the scene has covered them -->
<BaseSprite
	zIndex={zIndexes.background.normal}
	{texture}
	visible={texture !== PIXI.Texture.EMPTY && !covered}
	x={fit.x}
	y={fit.y}
	scale={fit.s}
/>
<Rectangle zIndex={zIndexes.background.feature} width={canvas.width} height={canvas.height} backgroundColor={0x05060a} alpha={wash} visible={!covered} />
