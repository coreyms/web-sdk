<script lang="ts">
	// THE BACKGROUND, two ways by layout:
	//
	// LANDSCAPE and PHONE SIDEWAYS: THE COURTYARD SCENE (game/scene.ts owns the Pixi scene, constants SCENE the
	// numbers, game/sceneSpec.ts the geometry, tools/build_scene_assets.py the files): painted backdrop, 3D
	// foreground, the braziers' fire light as an additive pass that flickers, and the knocker rings and chains,
	// which sway in the wind and swing on the board's kick. One 16:9 frame, cover-fitted to the canvas and centred
	// exactly as the placeholder was. This component only tells the scene WHICH mode and layout it is in:
	//   family   the game's four background keys, unchanged: base outside a feature (Base, the antes, a Mystery's
	//            base spin), else the book's own bonus kind (bonus / super / epic, which is also where a Mystery's
	//            award lands). base and bonus are the DAY scene, super the NIGHT, epic the night in red.
	//   dim      the old wash as a tint on every layer (SCENE.dim: darker in the features, as before).
	// A change of either crossfades. A Super or Epic that starts before the night files are in (the deferred
	// phase, after the plaque) plays over the day scene and crossfades when they land.
	//
	// PORTRAIT: THE PLACEHOLDER, untouched: the citadel courtyard painting (tools/build_board_layers.py), one crop
	// per layout, cover-fitted, under the scene wash. It also stands in for the scene in the other two layouts
	// while the scene's files are on their way (a game that booted in portrait and was turned: game/deferredLoad.ts
	// loadSceneLate), and the scene fades in over it. The flat sky colour is under everything, so nothing here ever
	// mounts conditionally (house rule: always-mounted z order).
	import * as PIXI from 'pixi.js';
	import { onMount, untrack } from 'svelte';
	import { BaseSprite, Rectangle, getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { layoutKind } from '../game/layoutSpec';
	import { BACKGROUND_WASH, SCENE, zIndexes } from '../game/constants';
	import { SCENE_LATE } from '../game/assets';
	import { loadSceneLate } from '../game/deferredLoad';
	import { PHONE_TIER } from '../game/deviceTier';
	import { SCENE_SPEC } from '../game/sceneSpec';
	import { SceneView, flickerAt, idleAt } from '../game/scene';

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

	// ---- the courtyard scene ---------------------------------------------------------------------
	const view = new SceneView(PHONE_TIER ? 'phone' : 'full');
	view.root.zIndex = zIndexes.background.scene;
	getContextParent().addToParent(view.root);

	const sceneLayout = $derived(kind !== 'portrait');
	const dim = $derived(context.stateGame.gameType === 'freegame' ? SCENE.dim.freegame : SCENE.dim.base);
	let dayReady = $state(false);
	let nightReady = $state(false);
	/** the scene is the background of this layout and its day files are in */
	const sceneOn = $derived(sceneLayout && dayReady);
	/** the scene has fully covered the placeholder (which is then not drawn) */
	let covered = $state(false);
	/** DEV A / B (tools/manticore/scene_probe.js cost): false hands every layout back to the placeholder */
	let enabled = $state(true);

	// the ticker: on while the scene is drawn (the fire always flickers), off in portrait and before the files
	let ticking = false;
	/** DEV: what the tick itself costs (ms), summed since the probe last read it */
	const spent = { ms: 0, max: 0, ticks: 0 };
	const tick = (ticker: PIXI.Ticker) => {
		const t0 = import.meta.env.DEV ? performance.now() : 0;
		view.tick(ticker.lastTime, ticker.deltaMS);
		if (!covered && view.shown) covered = true;
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

	// the files: the day set builds the scene, the night set joins it; each uploaded once, when it lands
	$effect(() => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		if (!assets || (dayReady && nightReady)) return;
		untrack(() => {
			const renderer = context.stateApp.pixiApplication?.renderer as PIXI.Renderer | undefined;
			const before = view.sources().length;
			if (!dayReady && view.setDay(assets)) dayReady = true;
			if (dayReady && !nightReady && view.setNight(assets, performance.now())) nightReady = true;
			if (view.sources().length !== before) void renderer?.prepare?.upload(view.sources());
		});
	});
	// a game that booted in portrait registered none of the scene's files: fetch them the first time they can show
	$effect(() => {
		if (sceneLayout && enabled && Object.keys(SCENE_LATE).length) void loadSceneLate(context.stateApp);
	});

	// placement: the placeholder's own cover fit, on the scene's frame
	$effect(() => {
		const [fw, fh] = SCENE_SPEC.frame;
		const s = Math.max(canvas.width / fw, canvas.height / fh);
		view.place((canvas.width - fw * s) / 2, (canvas.height - fh * s) / 2, s);
	});

	// which mode, and whether the scene is drawn at all
	let wasOn = false;
	$effect(() => {
		const on = sceneOn && enabled;
		const f = family;
		const d = dim;
		// the loading screen is still up: nothing to fade over, the scene is simply there when it lifts
		const instant = context.stateLayout.showLoadingScreen;
		untrack(() => {
			view.root.visible = on;
			if (on) {
				view.mode(f, d, instant ? -1 : performance.now());
				if (view.shown) covered = true;
				start();
			} else {
				if (wasOn) view.hide();
				covered = false;
				stop();
			}
			wasOn = on;
		});
	});

	onMount(() => {
		// ---- DEV hook: __manticore.scene (tools/manticore/scene_probe.js) ---------------------------
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			const pt = (x: number, y: number) => {
				const p = view.root.toGlobal({ x, y });
				return { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) };
			};
			Object.assign(((window as any).__manticore ??= {}), {
				scene: {
					state: () => ({
						...view.state(),
						kind,
						on: sceneOn && enabled,
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
						fit: { scale: view.root.scale.x, x: view.root.x, y: view.root.y, frame: SCENE_SPEC.frame },
						stage: view.root.parent?.children.map((c) => `${c.label || c.constructor.name}@${c.zIndex}`) ?? [],
						textures: { ...view.state().textures, managed: (context.stateApp.pixiApplication?.renderer as any)?.texture?.managedTextures?.length ?? null },
						/** per side, in CANVAS px as Pixi draws them: the ring's hook for the swag through the ring sprite's
						 *  own transform, and the swag strip's top end at that height through the strip's own vertices */
						screen: Object.fromEntries(
							(['L', 'R'] as const).map((side) => {
								const p = SCENE_SPEC.points[side];
								const hook = view.hookOnScreen(side);
								return [side, { pivot: pt(p.pivot[0], p.pivot[1]), ringHook: hook.ring, swagTop: hook.swag, gap: Number(Math.hypot(hook.ring.x - hook.swag.x, hook.ring.y - hook.swag.y).toFixed(3)), swagPin: pt(p.swagPin[0], p.swagPin[1]) }];
							}),
						),
					}),
					/** the constants and the pure curves, so the probe never repeats a number */
					constants: () => JSON.parse(JSON.stringify(SCENE)),
					spec: () => JSON.parse(JSON.stringify(SCENE_SPEC)),
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
<!-- the placeholder and its wash: portrait, and the other layouts until the scene has covered them -->
<BaseSprite
	zIndex={zIndexes.background.normal}
	{texture}
	visible={texture !== PIXI.Texture.EMPTY && !covered}
	x={fit.x}
	y={fit.y}
	scale={fit.s}
/>
<Rectangle zIndex={zIndexes.background.feature} width={canvas.width} height={canvas.height} backgroundColor={0x05060a} alpha={wash} visible={!covered} />
