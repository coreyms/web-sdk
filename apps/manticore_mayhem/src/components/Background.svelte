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
	//   PORTRAIT                       its own 9:16 frame: backdrop, the paved floor, the same fire pass treatment, and
	//                                  THE AMBIENT SKY too (2026-10-12; constants SKY.portrait: its own cut-out, the
	//                                  landscape sky's atlas, birds and bats). No columns, knockers, chains or flames
	//                                  are in view.
	// THE FOREGROUND KICK (constants FOREGROUND_KICK): in both scenes everything from the foreground up (SceneView
	// .foreground) is shoved with the board on a kick, by the same offset on the same frame; the backdrop and the sky
	// stay still. This component hands the scenes the shove (featureFx.foregroundKick.take) and works out how much
	// oversize the foreground must be drawn in this layout so the shove never shows an edge (`foregroundOver`).
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
	import { BACKGROUND_WASH, CHAIN_GUST, CHAIN_SOUND, CREATURE, FIRE_SOUND, FLAMES, FOREGROUND_KICK, PLAYGROUND_PX, SCENE, SKY, zIndexes, type CreatureSpot } from '../game/constants';
	import { creature, creatureFront, creaturePlaceFor, type CreaturePlace } from '../game/creature';
	import { creatureBuyArmed, creatureLoader, creatureLoadLog, creatureLoadState, creaturePrefetchLog } from '../game/creatureLoad';
	import { stateBet } from 'state-shared';
	import { CREATURE_SPEC } from '../game/creatureSpec';
	import type { SoundEffectName } from '../game/sound';
	import { boardKick, foregroundKick, shoveForeground } from '../game/featureFx';
	import { boardOpening } from '../game/boardTap';
	import { SCENE_AT_BOOT } from '../game/assets';
	import { loadPlaceholderLate, loadSceneLate } from '../game/deferredLoad';
	import { PHONE_TIER } from '../game/deviceTier';
	import { SCENE_SPEC, SCENE_SPEC_PORTRAIT } from '../game/sceneSpec';
	import { SceneView, clearSceneLight, flickerAt, idleAt, isCreature, type SceneLayout } from '../game/scene';
	import { skyNumbers } from '../game/sky';
	import { FLAME_SPEC } from '../game/flameSpec';
	import type { FlameClip, FlameTreatment } from '../game/flames';
	import { fireSoundLog, fireSoundState, setFireSound } from '../game/fireSound';
	import { chainSoundLog } from '../game/chainSound';
	import { sound } from '../game/sound';

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));

	// THE TRIGGER BEAT'S RELIGHT (constants TRIGGER_BEAT.relightAt): a Super / Epic trigger beat draws the feature's scene
	// (night, the fire braziers, his night or fire look) from the beat on, in front of the player, before the intro plaque
	const family = $derived(
		context.stateGame.gameType !== 'freegame' && !context.stateGame.relightAhead
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
	// each scene's twin root IN FRONT of the board (components/CreatureFront.svelte puts them on the stage)
	creatureFront.roots = LAYOUTS.map((layout) => views[layout].front);
	creatureFront.sync();

	/** the scene this layout draws */
	const which: SceneLayout = $derived(kind === 'portrait' ? 'portrait' : 'landscape');
	const dim = $derived(context.stateGame.gameType === 'freegame' ? SCENE.dim.freegame : SCENE.dim.base);
	const ready = $state({ landscape: { day: false, night: false, flames: false, sky: false }, portrait: { day: false, night: false, flames: false, sky: false } });
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
		// what the two scenes share (the sky's atlas, the birds, the bats) is being drawn: it stays on the GPU
		if (other.dayReady && other.release(views[active].sources())) memory.releases += 1;
	};

	// the ticker: ONE callback, on while a scene is drawn (the fire always flickers), off before its files are in
	let ticking = false;
	/** DEV: what the tick itself costs (ms), summed since the probe last read it */
	const spent = { ms: 0, max: 0, ticks: 0 };
	const tick = (ticker: PIXI.Ticker) => {
		const t0 = import.meta.env.DEV ? performance.now() : 0;
		const view = views[active];
		view.tick(ticker.lastTime, ticker.deltaMS);
		// the creature stands in this scene (his own clock: the board's beats are stamped with performance.now())
		creature.tick(performance.now());
		// the board frame's relight reads the scene on screen (game/scene.ts sceneLight)
		view.writeLight();
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
		// no scene is drawn: the frame goes back to its day light
		clearSceneLight();
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
				if (r.day && r.night && r.flames && r.sky) continue;
				const before = view.sources().length;
				if (!r.day && view.setDay(assets)) r.day = true;
				if (r.day && !r.night && view.setNight(assets, performance.now())) r.night = true;
				if (r.day && !r.flames && view.setFlames(assets, performance.now())) r.flames = true;
				// the sky's shared files (atlas, birds, bats) can land after this scene's own sets when it was fetched at a turn
				if (r.day && !r.sky && view.setSky(assets)) r.sky = true;
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

	// THE FOREGROUND KICK: the shove BoardFrame hands over (canvas px) goes to both scenes (the one not showing costs
	// two numbers), so a turn mid kick has nothing to catch up
	foregroundKick.take = (x, y) => {
		views.landscape.kick(x, y);
		views.portrait.kick(x, y);
	};
	/** the switch at run time (the constant; the DEV hook turns it): off = no shove and no oversize, as before */
	let foregroundOn = $state(FOREGROUND_KICK.on as boolean);
	/** canvas px per PLAYGROUND px of the board in this layout: what a kick of 1 px moves the board on the canvas */
	const canvasPerKickPx = $derived(context.stateGameDerived.boardLayout().scale * context.stateLayoutDerived.mainLayout().scale * PLAYGROUND_PX);
	/** THE OVERSIZE: the smallest uniform scale about the frame's centre that keeps every canvas edge under the
	 *  foreground at the largest shove, (0.6, 1) x coverPx, plus the slack. `cropX / cropY`: what the cover fit
	 *  already hides beyond each edge (canvas px); `halfW / halfH`: half the fitted frame (canvas px). */
	const foregroundOver = (perPx: number, cropX: number, cropY: number, halfW: number, halfH: number) => {
		const needX = Math.max(0, 0.6 * FOREGROUND_KICK.coverPx * perPx + FOREGROUND_KICK.slackPx - cropX);
		const needY = Math.max(0, FOREGROUND_KICK.coverPx * perPx + FOREGROUND_KICK.slackPx - cropY);
		return 1 + Math.max(needX / halfW, needY / halfH);
	};

	// placement: the placeholder's own cover fit, on each scene's frame
	$effect(() => {
		for (const layout of LAYOUTS) {
			const [fw, fh] = frames[layout];
			const s = Math.max(canvas.width / fw, canvas.height / fh);
			const x = (canvas.width - fw * s) / 2;
			const y = (canvas.height - fh * s) / 2;
			views[layout].place(x, y, s, foregroundOn ? foregroundOver(canvasPerKickPx, -x, -y, (fw * s) / 2, (fh * s) / 2) : 1);
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
				other.show(false);
				covered = false;
			}
			active = w;
			view.show(on);
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

	// ---- THE CREATURE (game/creature.ts, constants CREATURE) ------------------------------------------
	// WHICH SPOT: landscape = desktop, the phone master = phone sideways, and a portrait screen is a PHONE or a TABLET
	// by the layout system's own size class (its short side at most 480 CSS px is a phone): never between the two.
	const spot: CreatureSpot = $derived(
		kind === 'landscape' ? 'desktop' : kind === 'phone' ? 'phoneSideways' : ['smallMobile', 'mobile'].includes(context.stateLayoutDerived.canvasSizeType()) ? 'portraitPhone' : 'portraitTablet',
	);
	creatureLoader.renderer = renderer;
	creature.env = {
		ts: () => context.stateGameDerived.timeScale(),
		skipping: () => context.stateGame.skipping,
		play: (name, rate) => context.eventEmitter.broadcast({ type: 'soundOnce', name: name as SoundEffectName, forcePlay: true, rate }),
		stop: (name) => context.eventEmitter.broadcast({ type: 'soundStop', name: name as SoundEffectName }),
		idle: () => context.stateXstateDerived.isIdle(),
		board: (x, y) => boardOpening.contains(x, y),
	};
	// he stands in the scene of the current layout: the shadow on its floor, the body in the scene's twin root (behind
	// the board or in front of it, over the logo either way). Only on a change of layout or spot.
	$effect(() => {
		const view = views[which];
		const layer = CREATURE.place[spot].layer;
		untrack(() => {
			view.foreground.addChild(creature.shadowNode);
			// the body is always in the scene's twin root; the layer says which host on the stage holds that root:
			// behind the board or in front of it, both over the canvas logo (game/creature.ts creatureFront)
			view.frontForeground.addChild(creature.bodyNode);
			creatureFront.layer = layer;
			creatureFront.sync();
			creature.place(creaturePlace);
		});
	});
	// ...and where in it: the spot's place for the canvas's shape (the desktop spot follows it from 16:10 to 16:9,
	// constants CREATURE.desktopTall). A resize moves him without re-adding his nodes. DEV: `placeOverride` (the
	// __manticore.creature.placeAt hook) stands him somewhere else until it is cleared.
	let placeOverride: CreaturePlace | null = $state(null);
	const creaturePlace = $derived(placeOverride ?? creaturePlaceFor(spot, canvas.width / Math.max(canvas.height, 1)));
	$effect(() => {
		const place = creaturePlace;
		untrack(() => creature.place(place));
	});
	// the look of the mode (the scene's own family)
	$effect(() => {
		creature.mode(family);
	});
	// A FEATURE'S LOOK AHEAD OF ITS MODE (game/creatureLoad.ts EARLY): an armed Super or Epic buy loads its look now, and
	// a disarmed one lets it go
	$effect(() => {
		const key = stateBet.activeBetModeKey;
		untrack(() => creatureBuyArmed(key));
	});
	// THE LANDING SCREEN (ui/LandingScreen.svelte, HTML over this canvas) is up until its press has played out to
	// black: he is not drawn behind it, body or shadow, in any layout, and is silent; he fades in when it goes
	// (constants CREATURE.landingFadeMs). His sheets load meanwhile exactly as before, and nothing waits for this.
	$effect(() => {
		creature.veil(context.stateLayout.showLoadingScreen);
	});
	// the board's beats and the handlers' look-ahead: he follows, nothing waits for him
	context.eventEmitter.subscribeOnMount({
		featureBeat: ({ beat }) => creature.beat(beat),
		stingBeat: ({ phase, kind, more }) => creature.stingBeat(phase, kind, !!more),
		creatureCue: ({ what, inMs, kind }) => {
			if (what === 'swipe') creature.cueSwipe(inMs);
			else if (what === 'growl') creature.growl();
			else creature.cueBeat(what, inMs, kind ?? null);
		},
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
			const onGpu = (view: SceneView, shared = false) => {
				const table = (renderer() as any)?.texture?._glTextures ?? {};
				const other = views[view === views.landscape ? 'portrait' : 'landscape'].sources();
				return view.sources().filter((source) => other.includes(source) === shared && !!table[source.uid]).length;
			};
			/** the sky hooks act on the sky of the scene of the current layout (or of `layout`) */
			const skyOf = (layout: SceneLayout = which) => views[layout].sky;
			const pt = (view: SceneView, x: number, y: number) => {
				const p = view.root.toGlobal({ x, y });
				return { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) };
			};
			/** a frame px of something IN THE FOREGROUND (chains, flames, floor) on the canvas: through the foreground
			 *  container, so its oversize and any kick are in it */
			const ptFore = (view: SceneView, x: number, y: number) => {
				const p = view.foreground.toGlobal({ x, y });
				return { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) };
			};
			/** the foreground's own fit: canvas px = x + frame px x scale (the root's fit with the oversize and the kick) */
			const foreFit = (view: SceneView) => ({ scale: view.root.scale.x * view.foreground.scale.x, x: view.root.x + view.foreground.x * view.root.scale.x, y: view.root.y + view.foreground.y * view.root.scale.y });
			/** the canvas rectangle the foreground picture covers now, and how far it reaches past each canvas edge */
			const foreCover = (layout: SceneLayout) => {
				const f = foreFit(views[layout]);
				const [fw, fh] = frames[layout];
				return { left: -f.x, top: -f.y, right: f.x + fw * f.scale - canvas.width, bottom: f.y + fh * f.scale - canvas.height };
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
							fit: { scale: view.root.scale.x, x: view.root.x, y: view.root.y, frame: frames[layout], /** the foreground's own (oversize, kick) */ fore: foreFit(view) },
							stage: view.root.parent?.children.map((c) => `${c.label || c.constructor.name}@${c.zIndex}${c.visible ? '' : ' (off)'}`) ?? [],
							textures: { ...view.state().textures, managed: (renderer() as any)?.texture?.managedTextures?.length ?? null },
							/** both scenes: files in, GPU copies let go, and how often that happened */
							resident: {
								/** onGpu: its OWN sources with a GL texture; sharedOnGpu: the ones both scenes draw (the sky's atlas,
								 *  the birds, the bats), which stay while either scene shows */
								landscape: { ...ready.landscape, released: views.landscape.released, onGpu: onGpu(views.landscape), sharedOnGpu: onGpu(views.landscape, true), sources: views.landscape.sources().length },
								portrait: { ...ready.portrait, released: views.portrait.released, onGpu: onGpu(views.portrait), sharedOnGpu: onGpu(views.portrait, true), sources: views.portrait.sources().length },
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
												return [side, { pivot: ptFore(view, p.pivot[0], p.pivot[1]), ringHook: hook.ring, swagTop: hook.swag, gap: Number(Math.hypot(hook.ring.x - hook.swag.x, hook.ring.y - hook.swag.y).toFixed(3)), swagPin: ptFore(view, p.swagPin[0], p.swagPin[1]) }];
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
				// ---- __manticore.sky (tools/manticore/ambient_probe.js): the ambient sky of the scene of the CURRENT layout
				// (landscape and phone sideways: the 16:9 scene's; portrait: the 9:16 scene's), or of `layout` where a hook
				// takes one. hide and freeze act on BOTH scenes' skies, so a probe that turns the device keeps them ----
				sky: {
					/** what the sky draws now (frame px), the root's whole layer order, and the scene's fit */
					state: (layout: SceneLayout = which) => ({
						...skyOf(layout).state(),
						on: layout === which && sceneOn && enabled,
						order: views[layout].state().allOrder,
						portraitHasSky: true,
						portraitOrder: views.portrait.root.children.length,
						frame: frames[layout],
						fit: { scale: views[layout].root.scale.x, x: views[layout].root.x, y: views[layout].root.y, /** the foreground's own (oversize, kick): the sky keeps the root's */ fore: foreFit(views[layout]) },
					}),
					constants: () => JSON.parse(JSON.stringify(SKY)),
					/** the numbers the sky of a layout runs on: SKY's own (landscape), SKY through SKY.portrait (portrait) */
					numbers: (layout: SceneLayout = which) => JSON.parse(JSON.stringify(skyNumbers(layout))),
					/** every sky layer off (true) or back: the scene is then the picture the source composite has */
					hide: (on = true) => {
						for (const layout of LAYOUTS) views[layout].hideSky(on);
					},
					/** nothing moves, no flock is sent, until freeze(false) */
					freeze: (on = true) => {
						for (const layout of LAYOUTS) views[layout].sky.frozen = on;
						return on;
					},
					/** a flock now (day only): what was rolled, or false */
					flock: () => skyOf().forceFlock(),
					clearBirds: () => skyOf().clearBirds(),
					/** the same for the bats (night only) */
					batFlock: () => skyOf().forceFlock('bats'),
					clearBats: () => skyOf().clearBirds('bats'),
					/** the aurora held flat (every column of the first curtain the same; the seam test), or released: () */
					auroraFlat: (y = 0, h = 0, alpha = 1) => skyOf().auroraFlat(y, h, alpha),
					stepFlyers: (kind: 'birds' | 'bats', dt: number) => skyOf().stepFlyers(kind, dt),
					/** `seconds` of one kind's flock timer and flight at once: { flocks, refused, maxLive, pool } */
					runFlyers: (kind: 'birds' | 'bats', seconds: number, dt = 0.25) => skyOf().runFlyers(kind, seconds, dt),
					/** THE GAP measured: `seconds` of one kind run at once, every pair on the frame at every step (sky.ts gapRun) */
					gapRun: (kind: 'birds' | 'bats', seconds: number, dt: number, FH: number, gx: number, gy: number, off = false) => skyOf().gapRun(kind, seconds, dt, FH, gx, gy, off),
					/** every cloud to a known place along its run (0 .. 1), and one cloud to a given place and size */
					cloudPhase: (phase: number) => skyOf().cloudPhase(phase),
					cloud: (i: number, x: number, y: number, scale = 1, alpha = 1) => skyOf().placeCloud(i, x, y, scale, alpha),
					reroll: () => skyOf().rerollClouds(),
					/** a frame px on the canvas */
					toCanvas: (x: number, y: number) => pt(views[which], x, y),
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
							// the flames are in the foreground container: their fit is its (oversize and kick included)
							fit: foreFit(view),
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
					toCanvas: (x: number, y: number) => ptFore(views.landscape, x, y),
				},
				// ---- __manticore.foregroundKick (tools/manticore/chain_gust_probe.js, ONLY=foreground): the scene's side of
				// the foreground kick. The board's side is __manticore.frameGust.kick ----
				foregroundKick: {
					constants: () => JSON.parse(JSON.stringify(FOREGROUND_KICK)),
					/** the scene of the current layout (or of `layout`): the switch, the shove as handed over (canvas px), the
					 *  foreground container's place and oversize, the foreground's fit, how far the picture reaches past each
					 *  canvas edge NOW (negative = an edge shows), the largest shove this layout can get (canvas px), and where
					 *  everything that must stay still is */
					state: (layout: SceneLayout = which) => ({
						t: performance.now(),
						layout,
						enabled: foregroundKick.enabled,
						handed: { x: foregroundKick.x, y: foregroundKick.y },
						source: { x: boardKick.x, y: boardKick.y },
						...views[layout].foregroundState(),
						fit: foreFit(views[layout]),
						rootFit: { scale: views[layout].root.scale.x, x: views[layout].root.x, y: views[layout].root.y },
						cover: foreCover(layout),
						maxShove: { x: 0.6 * FOREGROUND_KICK.coverPx * canvasPerKickPx, y: FOREGROUND_KICK.coverPx * canvasPerKickPx },
						canvasPerKickPx,
						canvas: { width: canvas.width, height: canvas.height },
						still: views[layout].stillLayers(),
						rootOrder: views[layout].root.children.map((c) => c.label || 'sprite'),
						foregroundOrder: views[layout].foreground.children.filter((c) => !isCreature(c)).map((c) => c.label || 'sprite'),
					}),
					/** light enough for every frame: the shove the scene holds and draws (canvas px), and whether anything else moved */
					sample: () => {
						const f = views[which].foregroundState();
						return { t: performance.now(), x: f.drawn.x, y: f.drawn.y, hx: foregroundKick.x, hy: foregroundKick.y, /** sum of |x| + |y| of everything that must stay still */ still: views[which].stillLayers().reduce((n, l) => n + Math.abs(l.x) + Math.abs(l.y), 0) };
					},
					/** the switch (false = the board alone kicks and the foreground is drawn at the frame's own size) */
					enable: (on: boolean) => {
						foregroundKick.enabled = on;
						foregroundOn = on;
						if (!on) shoveForeground(0, 0);
						return on;
					},
					/** HOLD a kick of `px` playground px on the board ((0.6, 1) x px, like every kick; 0 lets go): for a still
					 *  at a known shove. A feature's own kick writes over it. */
					hold: (px: number) => {
						boardKick.x = 0.6 * px * PLAYGROUND_PX;
						boardKick.y = px * PLAYGROUND_PX;
						return { x: boardKick.x, y: boardKick.y };
					},
				},
				// ---- __manticore.creature (tools/manticore/creature_probe.js) ----
				creature: {
					constants: () => JSON.parse(JSON.stringify(CREATURE)),
					spec: () => ({ canvas: CREATURE_SPEC.canvas, feetRow: CREATURE_SPEC.feetRow, feetCol: CREATURE_SPEC.feetCol, fps: CREATURE_SPEC.fps, clips: JSON.parse(JSON.stringify(CREATURE_SPEC.clips)), tier, tierCanvas: CREATURE_SPEC.tiers[tier].canvas }),
					/** everything: the state machine, what is loaded, the spot, and where the nodes are ON THE CANVAS through
					 *  their own transforms (the feet point, and one 1024 canvas px in canvas px) */
					state: () => {
						const body = creature.bodyNode;
						const sh = creature.shadowNode;
						const at = (n: PIXI.Container) => {
							if (!n.parent) return null;
							const a = n.toGlobal({ x: 0, y: 0 });
							const b = n.toGlobal({ x: 1, y: 0 });
							return { x: Number(a.x.toFixed(3)), y: Number(a.y.toFixed(3)), px: Number((b.x - a.x).toFixed(5)) };
						};
						const view = views[which];
						const stage = view.root.parent?.children ?? [];
						// the board's stage child: the one whose subtree holds the container labelled 'board' (components/BoardContainer.svelte;
						// found by its mask until the board window mask went, 2026-10-13, which left stageIndex.board at -1)
						const holdsBoard = (c: PIXI.Container, depth = 0): boolean => c.label === 'board' || (depth < 3 && (c.children ?? []).some((k) => holdsBoard(k as PIXI.Container, depth + 1)));
						const main = stage.find((c) => holdsBoard(c as PIXI.Container));
						return {
							...creature.info(),
							spot,
							kind,
							which,
							sizeType: context.stateLayoutDerived.canvasSizeType(),
							canvas: { width: canvas.width, height: canvas.height },
							fore: foreFit(view),
							body: at(body),
							shadow: at(sh),
							/** the stage, bottom to top, and where the scene, the board and the creature's front host are in it */
							stage: stage.map((c) => `${c.label || c.constructor.name}@${c.zIndex}`),
							stageIndex: { scene: stage.indexOf(view.root), logo: stage.findIndex((c) => c.label === 'logo'), behind: stage.findIndex((c) => c.label === 'creature-behind'), front: stage.findIndex((c) => c.label === 'creature-front'), board: main ? stage.indexOf(main) : -1, count: stage.length },
							/** which host holds this scene's twin root (his body's root) */
							host: view.front.parent?.label ?? null,
							/** the foreground's children, bottom to top (the creature's nodes included) */
							foreground: view.foreground.children.map((c) => c.label || 'sprite'),
							frontForeground: view.frontForeground.children.map((c) => c.label || 'sprite'),
							load: creatureLoadState(),
						};
					},
					/** light enough for every frame: his frame, the looks' opacities, and the kick as each layer draws it */
					sample: () => {
						const view = views[which];
						const k = view.root.scale.x || 1;
						const f = view.foregroundState();
						const body = creature.bodyNode.parent ? creature.bodyNode.toGlobal({ x: 0, y: 0 }) : { x: 0, y: 0 };
						const sh = creature.shadowNode.parent ? creature.shadowNode.toGlobal({ x: 0, y: 0 }) : { x: 0, y: 0 };
						return { ...creature.sample(), bx: body.x, by: body.y, sx: sh.x, sy: sh.y, floorX: f.drawn.x, floorY: f.drawn.y, frontX: (f.front.x - f.rest.x) * k, frontY: (f.front.y - f.rest.y) * k, handedX: foregroundKick.x, handedY: foregroundKick.y, turbo: context.stateGame.turboLevel, skipping: context.stateGame.skipping };
					},
					/** his BODY's drawn pixels on the canvas (2026-10-15, the tablet placement): the body node rendered by itself
					 *  at resolution 1, a pixel counted where its alpha is over `alphaMin` (of 255); the box they span in CSS
					 *  px and, per rect given (CSS px), the area of him inside it in CSS px squared (creature_probe.js PLACE) */
					opaque: (rects: { x0: number; y0: number; x1: number; y1: number }[] = [], alphaMin = 96) => {
						const r = renderer();
						const n = creature.bodyNode;
						if (!r || !n.parent || !n.visible) return null;
						const B = n.getBounds();
						const ex = r.extract.pixels({ target: n, resolution: 1 });
						const W = ex.width;
						const H = ex.height;
						const cw = B.width / W;
						const ch = B.height / H;
						const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
						const inside = rects.map(() => 0);
						let count = 0;
						for (let y = 0; y < H; y += 1) {
							for (let x = 0; x < W; x += 1) {
								if (ex.pixels[(y * W + x) * 4 + 3] <= alphaMin) continue;
								const px = B.x + (x + 0.5) * cw;
								const py = B.y + (y + 0.5) * ch;
								count += 1;
								box.x0 = Math.min(box.x0, px - cw / 2);
								box.y0 = Math.min(box.y0, py - ch / 2);
								box.x1 = Math.max(box.x1, px + cw / 2);
								box.y1 = Math.max(box.y1, py + ch / 2);
								rects.forEach((q, i) => {
									if (px >= q.x0 && px < q.x1 && py >= q.y0 && py < q.y1) inside[i] += cw * ch;
								});
							}
						}
						return { count, box: count ? box : null, inside };
					},
					/** where he stands now (the spot's place for this canvas, game/creature.ts creaturePlaceFor), and a DEV
					 *  override of it (null: back to the layout's) */
					place: () => ({ ...creaturePlace }),
					placeAt: (p: CreaturePlace | null) => (placeOverride = p),
					log: () => creature.log.map((e) => ({ ...e })),
					loadLog: () => creatureLoadLog.map((e) => ({ ...e })),
					/** THE PREFETCH (game/creatureLoad.ts): its two conditions, when it ran, every file it fetched */
					prefetch: () => JSON.parse(JSON.stringify(creaturePrefetchLog)),
					/** every source he draws from: its size, its bytes as RGBA8 with no mipmaps, and whether it has a GL texture */
					memory: () => {
						const table = (renderer() as any)?.texture?._glTextures ?? {};
						const list = creature.sources().map(({ name, source }) => ({ name, w: source.pixelWidth, h: source.pixelHeight, bytes: source.pixelWidth * source.pixelHeight * 4, onGpu: !!table[source.uid], mips: source.autoGenerateMipmaps, gc: source.autoGarbageCollect }));
						return { list, gpuBytes: list.filter((s) => s.onGpu).reduce((n, s) => n + s.bytes, 0), managed: (renderer() as any)?.texture?.managedTextures?.length ?? null };
					},
					/** the A / B switch: false = he is not drawn, takes no beat and plays no sound */
					enable: (on: boolean) => (creature.enabled = on),
					/** the look of a mode, asked for by hand (the game's own mode is left alone, so only at rest in the base
					 *  game): changes of look at chosen moments, with no round (creature_probe.js HANDOVER) */
					mode: (f: keyof typeof CREATURE.looks) => creature.mode(f),
					/** the next idle loop restart plays this alternate (or none) instead of rolling */
					forceRoll: (what: 'snarl' | 'growl' | 'none' | null) => (creature.forceRoll = what),
					growl: () => creature.growl(),
					/** the voice's own picker, asked `n` times in a row (no sound is played): the takes and rates it would use */
					voicePicks: (clip: 'snarl' | 'growl', n: number) => Array.from({ length: n }, () => creature.pickVoice(clip)),
					/** THE POKE: its hit area on the canvas, whether it is live, its clocks; whether a canvas point would
					 *  take one; a poke by hand (the tap's own path, minus the hit test) */
					pokeInfo: () => creature.pokeInfo(),
					pokeHits: (x: number, y: number) => creature.pokeHits(x, y),
					poke: () => creature.poke(performance.now()),
					/** the A / B of CREATURE.glowPhase (the crouch's phase before a lit strike) */
					glowPhase: (on: boolean) => (creature.glowPhase = on),
				},
				// ---- __manticore.fireSound / chainSound (tools/manticore/win_sound_probe.js, ONLY=fire,chain) ----
				fireSound: { state: () => fireSoundState(), log: () => fireSoundLog.map((e) => ({ ...e })), constants: () => JSON.parse(JSON.stringify(FIRE_SOUND)) },
				chainSound: { log: () => chainSoundLog.asked.map((e) => ({ ...e })), refused: () => chainSoundLog.refused, constants: () => JSON.parse(JSON.stringify({ sound: CHAIN_SOUND, gust: CHAIN_GUST })) },
			});
		}
		return () => {
			stop();
			foregroundKick.take = null;
		};
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
