<script lang="ts">
	// THE BACKGROUND: THE COURTYARD SCENE in every layout (game/scene.ts owns the Pixi scenes, constants SCENE the
	// numbers, game/sceneSpec.ts the geometry, tools/build_scene_assets.py the files). Two scenes, one per frame:
	//   LANDSCAPE and PHONE SIDEWAYS   one 16:9 frame: painted backdrop, 3D foreground, the braziers' fire light as an
	//                                  additive pass that flickers, and the knocker rings and chains, which sway in
	//                                  the wind and swing on the board's kick. Between the backdrop and the foreground
	//                                  it has THE AMBIENT SKY (game/sky.ts, constants SKY): drifting wisps behind the
	//                                  ridge, birds in the day modes, mist in the gorge. And in each of its two
	//                                  bowls THE BRAZIER FLAMES (game/flames.ts, constants FLAMES): the base clip in
	//                                  the day modes, the super and epic clips with embers at night.
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
	// THE FIRE LOOPS (game/fireSound.ts, constants FIRE_SOUND) follow the same `family`: super and epic each have a
	// quiet loop for the whole round, in every layout (the portrait scene has the braziers' light too).
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
	import { BACKGROUND_WASH, CHAIN_GUST, CHAIN_SOUND, FIRE_SOUND, FLAMES, SCENE, SKY, zIndexes } from '../game/constants';
	import { SCENE_AT_BOOT } from '../game/assets';
	import { loadPlaceholderLate, loadSceneLate } from '../game/deferredLoad';
	import { PHONE_TIER } from '../game/deviceTier';
	import { SCENE_SPEC, SCENE_SPEC_PORTRAIT } from '../game/sceneSpec';
	import { SceneView, flickerAt, idleAt, type SceneLayout } from '../game/scene';
	import { FLAME_SPEC } from '../game/flameSpec';
	import type { FlameClip, FlameTreatment } from '../game/flames';
	import { fireSoundLog, fireSoundState, setFireSound } from '../game/fireSound';
	import { chainSoundLog } from '../game/chainSound';
	import { sound } from '../game/sound';

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
	const ready = $state({ landscape: { day: false, night: false, flames: false }, portrait: { day: false, night: false, flames: false } });
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

	// the files: a scene's day set builds it, its night set joins it, and the landscape scene's two deferred flame
	// clips after that. Each lot is uploaded once, when it lands, if that scene is the one on screen (sources already
	// on the GPU are only bound again); a scene that is not showing takes its upload when it is next shown.
	$effect(() => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		if (!assets) return;
		untrack(() => {
			for (const layout of LAYOUTS) {
				const view = views[layout];
				const r = ready[layout];
				if (r.day && r.night && r.flames) continue;
				const before = view.sources().length;
				if (!r.day && view.setDay(assets)) r.day = true;
				if (r.day && !r.night && view.setNight(assets, performance.now())) r.night = true;
				if (r.day && !r.flames && view.setFlames(assets, performance.now())) r.flames = true;
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

	// THE FIRE LOOP of the mode (game/fireSound.ts): on for a SUPER or an EPIC round, off otherwise, fading with the
	// scene's change of mode. SKIP TO RESULT fades it out like every effect it silences, and it stays out for what is
	// left of that round (the base game is back half a second after a skip ends: a loop started then would fade in
	// and straight out again). Nothing is asked before the sprite has loaded.
	let fireSkipped = false;
	$effect(() => {
		const want = family === 'super' || family === 'epic' ? family : null;
		const skipping = context.stateGame.skipping;
		const loaded = sound.loadStatus === 'loaded';
		untrack(() => {
			if (!want) fireSkipped = false;
			else if (skipping) fireSkipped = true;
			setFireSound(loaded && !skipping && !fireSkipped ? want : null);
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
					/** the landscape scene's gust and chain springs, light enough to read every frame (chain_gust_probe.js) */
					gust: () => ({ t: performance.now(), on: which === 'landscape' && sceneOn && enabled, ...views.landscape.gustSample() }),
					/** the constants and the pure curves, so the probe never repeats a number */
					constants: () => JSON.parse(JSON.stringify(SCENE)),
					spec: (layout: SceneLayout = 'landscape') => JSON.parse(JSON.stringify(layout === 'landscape' ? SCENE_SPEC : SCENE_SPEC_PORTRAIT)),
					flickerAt: (ms: number) => flickerAt(ms),
					idleAt: (piece: 'hang' | 'swag', side: 'L' | 'R', ms: number) => idleAt(piece, side, ms),
					/** false = the placeholder draws every layout again (the A / B of the cost) */
					enable: (on: boolean) => (enabled = on),
				},
				// ---- __manticore.sky (tools/manticore/ambient_probe.js): the landscape scene's ambient sky ----
				sky: {
					/** what the sky draws now (frame px), the root's whole layer order, and whether each scene has one */
					state: () => ({
						...views.landscape.sky!.state(),
						on: which === 'landscape' && sceneOn && enabled,
						order: views.landscape.state().allOrder,
						portraitHasSky: views.portrait.sky !== null,
						portraitOrder: views.portrait.root.children.length,
						fit: { scale: views.landscape.root.scale.x, x: views.landscape.root.x, y: views.landscape.root.y },
					}),
					constants: () => JSON.parse(JSON.stringify(SKY)),
					/** every sky layer off (true) or back: the scene is then the picture the source composite has */
					hide: (on = true) => views.landscape.hideSky(on),
					/** nothing moves, no flock is sent, until freeze(false) */
					freeze: (on = true) => (views.landscape.sky!.frozen = on),
					/** a flock now (day only): what was rolled, or false */
					flock: () => views.landscape.sky!.forceFlock(),
					clearBirds: () => views.landscape.sky!.clearBirds(),
					/** every cloud to a known place along its run (0 .. 1), and one cloud to a given place and size */
					cloudPhase: (phase: number) => views.landscape.sky!.cloudPhase(phase),
					cloud: (i: number, x: number, y: number, scale = 1, alpha = 1) => views.landscape.sky!.placeCloud(i, x, y, scale, alpha),
					reroll: () => views.landscape.sky!.rerollClouds(),
					/** a frame px on the canvas */
					toCanvas: (x: number, y: number) => pt(views.landscape, x, y),
				},
				// ---- __manticore.flames (tools/manticore/flame_probe.js): the landscape scene's brazier flames ----
				flames: {
					/** what the flames draw now (frame px), the root's whole layer order, which of their sources have a GL
					 *  texture, and the scene values they follow */
					state: () => {
						const view = views.landscape;
						const sc = view.state();
						const table = (renderer() as any)?.texture?._glTextures ?? {};
						const set = new Set<PIXI.TextureSource>();
						view.flames!.sources(set);
						return {
							...view.flames!.state(),
							on: which === 'landscape' && sceneOn && enabled,
							family: sc.family,
							night: sc.night,
							fading: sc.fading,
							sceneFlicker: sc.fire.flicker,
							fireTint: sc.fire.tint,
							foreTint: sc.tints.fore,
							order: sc.allOrder,
							portraitHasFlames: views.portrait.flames !== null,
							sources: set.size,
							onGpu: [...set].filter((source) => !!table[source.uid]).length,
							managed: (renderer() as any)?.texture?.managedTextures?.length ?? null,
							fit: { scale: view.root.scale.x, x: view.root.x, y: view.root.y },
						};
					},
					constants: () => JSON.parse(JSON.stringify(FLAMES)),
					spec: () => JSON.parse(JSON.stringify(FLAME_SPEC)),
					/** flames, embers and rim cuts off (true) or back: the scene is then the picture the source composite has */
					hide: (on = true) => {
						views.landscape.flames!.hidden = on;
						views.landscape.refreshFlames();
					},
					/** one clip burning whatever the mode (null: the mode's own again); at once, no crossfade */
					force: (clip: FlameClip | null = null) => {
						views.landscape.flames!.forced = clip;
						views.landscape.refreshFlames();
					},
					/** EPIC's tint treatment: 'A' the light's multiply, 'B' a gentler multiply, 'C' untinted over a red additive copy */
					treatment: (t: FlameTreatment = FLAMES.epicTint.default) => {
						views.landscape.flames!.treatment = t;
						views.landscape.refreshFlames();
					},
					/** every clip held on this frame, the right bowl its phase ahead (null: running again); embers hold too */
					freeze: (frame: number | null = null) => (views.landscape.flames!.frozen = frame),
					/** hold the scene's flicker signal at a value, -1 .. 1 (the fire light and the flames; null: running again) */
					flicker: (value: number | null = null) => (views.landscape.holdFlicker = value),
					/** false: no embers are sent, and the ones burning are put back. `strength`: the embers' strength
					 *  whatever the mode says (0 .. 1; null: the mode's own again) */
					embers: (on = true, strength: number | null = null) => {
						views.landscape.flames!.emberForced = strength;
						views.landscape.flames!.embersOff = !on;
						if (!on) views.landscape.flames!.clearEmbers();
						views.landscape.refreshFlames();
					},
					toCanvas: (x: number, y: number) => pt(views.landscape, x, y),
				},
				// ---- __manticore.fireSound / chainSound (tools/manticore/win_sound_probe.js, ONLY=fire,chain) ----
				fireSound: { state: () => fireSoundState(), log: () => fireSoundLog.map((e) => ({ ...e })), constants: () => JSON.parse(JSON.stringify(FIRE_SOUND)) },
				chainSound: { log: () => chainSoundLog.asked.map((e) => ({ ...e })), refused: () => chainSoundLog.refused, constants: () => JSON.parse(JSON.stringify({ sound: CHAIN_SOUND, gust: CHAIN_GUST })) },
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
