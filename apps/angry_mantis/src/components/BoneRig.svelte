<script lang="ts">
	// Mounts a BoneRutter Rig into the pixi-svelte tree and pumps it from the app ticker.
	// Creation is async (rig file + atlas come from a shared cache); `rig` is bindable so the
	// parent can play clips once it lands. The wrapper's origin sits at the idle-pose centre,
	// matching the anchor-0.5 placeholder Sprite this replaces, and `size` stays reactive
	// (orientation flips) without re-measuring: the idle bounds are measured once.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { MANTIS_SHADOW as MS, footOvalTexture, fadeTexture, setMantisShadowSource } from '../game/mantisShadow';
	import type { Rig } from '../bonerutter';
	import { createMantisRig, measureIdlePose, playIdle, isIdling } from '../game/mantisRig';

	type Props = {
		size: number;
		mirror?: boolean;
		skin?: string | null;
		rig?: Rig | null;
		/** soft ground shadow under the feet, tracking the rig every frame (default on) */
		groundShadow?: boolean;
	};
	let { size, mirror = false, skin = null, rig = $bindable(null), groundShadow = true }: Props = $props();

	// ── floor shadows (Corey's Mantis Shadow artifact, 2026-09-08; numbers in game/mantisShadow.ts) ──
	// Three parts, all inside the wrapper (so Marky's mirror flips them for free), all UNDER the rig:
	//  · one soft oval per FOOT, placed from the four foot bones each tick (ankle → measured toe
	//    offset in rig units + Corey's nudge); a foot that rises off its rest ground line shrinks
	//    and fades its own oval — the off-the-ground cue;
	//  · two BODY shadows: the rig rendered into a small render texture each tick, drawn back as a
	//    black-tinted sprite flattened onto the floor — one toward the camera (windows behind
	//    him), one short and faint toward the wall (lamps in front). The far end thins through
	//    an 'erase' gradient pass inside the same render; the low resolution IS the softness.
	//    No filters, no per-frame textures: the two render textures are allocated once.
	// FrameShadow.svelte reads the soft texture through game/mantisShadow's registry to throw the
	// same silhouette onto the board frame's post.
	const FEET = ['Right Foot', 'Foot', 'Left Front Foot', 'Left Back Foot'];
	type Foot = { name: string; s: PIXI.Sprite; rest: number };
	const feet: Foot[] = [];
	let groundRest = 0; // lowest foot y in view-local (unscaled) units at idle frame 0
	let H = 1; // idle-pose height on screen (master px)
	let rtFront: PIXI.RenderTexture | null = null;
	let rtBack: PIXI.RenderTexture | null = null;
	let shFront: PIXI.Sprite | null = null;
	let shBack: PIXI.Sprite | null = null;
	let fadeFront: PIXI.Sprite | null = null;
	let fadeBack: PIXI.Sprite | null = null;
	let fadeHolderFront: PIXI.Container | null = null;
	let fadeHolderBack: PIXI.Container | null = null;
	let rtBounds = { x: 0, y: 0, width: 1, height: 1 }; // view-local bounds the render textures span
	const rtTransform = new PIXI.Matrix();
	const feetOf = (r: Rig) => {
		let minX = Infinity, maxX = -Infinity, lowest = -Infinity, n = 0;
		for (const name of FEET) {
			const p = r.part(name);
			if (!p) continue;
			n++;
			minX = Math.min(minX, p.position.x);
			maxX = Math.max(maxX, p.position.x);
			lowest = Math.max(lowest, p.position.y);
		}
		return n ? { minX, maxX, lowest } : null;
	};
	/** toe tip of one foot bone in wrapper space (master px): ankle + rig offset, scaled, + nudge */
	const toeOf = (r: Rig, name: string) => {
		const p = r.part(name);
		const o = MS.feet.offsets[name];
		if (!p || !o) return null;
		const v = r.view;
		const sc = rigScale();
		return {
			x: (p.position.x + o.rig.x - v.pivot.x) * sc + o.nudge.x * H,
			y: (p.position.y + o.rig.y - v.pivot.y) * sc + (o.nudge.y + MS.feet.toe) * H,
			ankleY: p.position.y,
		};
	};
	/** the shadow's floor projection: up in the texture → the floor direction, as a 2×2 */
	const projection = (cfg: { angleDeg: number; length: number; width: number; resolution: number }, sc: number) => {
		// a RenderTexture keeps its LOGICAL size (view-local units here); `resolution` only thins the
		// backing store, so screen px per texture unit is the rig scale alone
		const k = sc;
		const phi = (cfg.angleDeg * Math.PI) / 180;
		return { a: cfg.width * k, b: 0, c: -Math.cos(phi) * cfg.length * k, d: -Math.sin(phi) * cfg.length * k };
	};
	// the rig's on-screen scale: size / maxDim — NOT r.view.scale, which the size $effect sets only
	// after mount (building from it gave scale 1: shadows 2.6× too big, 2026-09-08)
	const rigScale = () => size / maxDim;
	let projScale = 0; // the scale the body-shadow projections were last built for
	const applyProjections = (sc: number) => {
		if (!shFront || !shBack || sc === projScale) return;
		projScale = sc;
		for (const [sp, cfg] of [[shFront, MS.front], [shBack, MS.back]] as const) {
			const P = projection(cfg, sc);
			const { x, y } = sp.position;
			sp.setFromMatrix(new PIXI.Matrix(P.a, P.b, P.c, P.d, x, y));
		}
	};
	const buildShadows = (r: Rig, idle: { x: number; y: number; width: number; height: number }) => {
		const sc = rigScale();
		H = idle.height * sc;
		// feet
		const w = MS.feet.width * H, h = w * MS.feet.aspect, blur = MS.feet.softness * H;
		const tex = footOvalTexture(w, h, blur);
		for (const name of FEET) {
			const p = r.part(name);
			if (!p) continue;
			const s = new PIXI.Sprite(tex);
			s.anchor.set(0.5);
			s.tint = 0x000000;
			s.width = tex.width / 2; // baked at 2×
			s.height = tex.height / 2;
			wrapper.addChildAt(s, 0);
			feet.push({ name, s, rest: p.position.y });
		}
		// render textures spanning the idle bounds grown by rtMargin
		const m = MS.rtMargin;
		rtBounds = { x: idle.x - idle.width * m, y: idle.y - idle.height * m, width: idle.width * (1 + 2 * m), height: idle.height * (1 + 2 * m) };
		const make = (cfg: typeof MS.front) => {
			const rt = PIXI.RenderTexture.create({ width: Math.max(2, Math.ceil(rtBounds.width)), height: Math.max(2, Math.ceil(rtBounds.height)), resolution: cfg.resolution });
			const sp = new PIXI.Sprite(rt);
			sp.tint = 0x000000;
			sp.alpha = cfg.alpha;
			wrapper.addChildAt(sp, 0);
			// far-end fade: white→transparent strip, alpha `fade` at the top of the bounds down to 0
			// at the toe line, rendered over the silhouette with 'erase'
			// the fade sprite lives in its own holder: renderer.render() treats the container it is
			// given as the root and applies `transform` in place of that root's own transform, so a
			// bare sprite's position/size would be dropped
			const f = new PIXI.Sprite(fadeTexture(cfg.fade));
			f.blendMode = 'erase';
			const holder = new PIXI.Container();
			holder.addChild(f);
			return { rt, sp, f, holder };
		};
		const fr = make(MS.front), bk = make(MS.back);
		rtFront = fr.rt; shFront = fr.sp; fadeFront = fr.f; fadeHolderFront = fr.holder;
		rtBack = bk.rt; shBack = bk.sp; fadeBack = bk.f; fadeHolderBack = bk.holder;
		rtTransform.set(1, 0, 0, 1, -rtBounds.x, -rtBounds.y);
		applyProjections(sc);
	};
	const placeShadows = (r: Rig) => {
		const v = r.view;
		const sc = rigScale();
		H = (rtBounds.height / (1 + 2 * MS.rtMargin)) * sc;
		applyProjections(sc);
		const renderer = context.stateApp.pixiApplication?.renderer;
		// feet
		let tx = 0, ty = 0, n = 0;
		for (const f of feet) {
			const t = toeOf(r, f.name);
			if (!t) continue;
			f.s.position.set(t.x, t.y);
			const lift = Math.min(1, Math.max(0, ((f.rest - t.ankleY) * sc) / (size * MS.feet.liftSpan)));
			f.s.scale.set(0.5 * (1 - 0.45 * lift));
			f.s.alpha = MS.feet.alpha * (1 - lift);
			tx += t.x; ty += t.y; n++;
		}
		if (!n || !renderer || !rtFront || !rtBack || !shFront || !shBack || !fadeFront || !fadeBack) return;
		tx /= n; ty /= n;
		// body silhouettes: the toe line in view-local units anchors both textures
		const toeLocal = ty / sc + v.pivot.y;
		const anchorY = Math.min(1, Math.max(0, (toeLocal - rtBounds.y) / rtBounds.height));
		if (!fadeHolderFront || !fadeHolderBack) return;
		for (const [rt, sp, fd, holder, cfg] of [[rtFront, shFront, fadeFront, fadeHolderFront, MS.front], [rtBack, shBack, fadeBack, fadeHolderBack, MS.back]] as const) {
			renderer.render({ container: v, target: rt, clear: true, transform: rtTransform });
			fd.position.set(rtBounds.x, rtBounds.y);
			fd.width = rtBounds.width;
			fd.height = Math.max(1, toeLocal - rtBounds.y);
			renderer.render({ container: holder, target: rt, clear: false, transform: rtTransform });
			sp.anchor.set(0.5, anchorY);
			sp.position.set(tx, ty + cfg.start * H);
		}
	};
	const toeWorld = () => wrapper.toGlobal(lastToe);
	const lastToe = new PIXI.Point();
	const context = getContext();
	const wrapper = new PIXI.Container();
	getContextParent().addToParent(wrapper); // its unmount cleanup destroys wrapper + rig.view

	let maxDim = $state(1);

	onMount(() => {
		let dead = false;
		let tick: (() => void) | null = null;
		let rotate: ReturnType<typeof setInterval> | undefined;
		createMantisRig().then((r) => {
			if (dead) {
				r.destroy();
				return;
			}
			const b = measureIdlePose(r); // leaves the rig on idle frame 0: the rest pose for the ground line
			maxDim = Math.max(b.width, b.height);
			r.view.pivot.set(b.x + b.width / 2, b.y + b.height / 2);
			// test hook (house rules: extend __angryMantis): the idle-pose box in rig units, so
			// layoutSpec's MARTY_TOP (antenna tip above the origin, in body sizes) can be re-measured
			// after a rig re-export: top = (height / max(width, height)) / 2
			if (import.meta.env.DEV && typeof window !== 'undefined') {
				((window as any).__angryMantis ??= {}).rigIdleBounds = { width: b.width, height: b.height };
			}
			const restFeet = feetOf(r);
			if (groundShadow && restFeet) {
				groundRest = restFeet.lowest;
				buildShadows(r, b);
				// test hook (house rules: extend __angryMantis, never a new global): A/B the shadow cost
				if (import.meta.env.DEV && typeof window !== 'undefined') {
					const am = ((window as any).__angryMantis ??= {});
					const set = am.setGroundShadow as ((on: boolean) => void) | undefined;
					am.setGroundShadow = (on: boolean) => {
						set?.(on);
						for (const f of feet) f.s.visible = on;
						if (shFront) shFront.visible = on;
						if (shBack) shBack.visible = on;
					};
				}
			}
			if (skin) r.setSkin(skin);
			wrapper.addChild(r.view);
			// test hook (house rules: extend __angryMantis): a PNG of the rig view alone, transparent
			// background, for offline shadow / silhouette work (the Mantis Shadow artifact, 2026-09-08)
			if (import.meta.env.DEV && typeof window !== 'undefined') {
				const am = ((window as any).__angryMantis ??= {});
				(am.rigs ??= {})[skin ?? 'Marty'] = {
					extract: () => context.stateApp.pixiApplication?.renderer.extract.base64({ target: r.view, resolution: 2 }),
					feet: () => feetOf(r),
					shadows: (which: { feet?: boolean; front?: boolean; back?: boolean }) => {
						if (which.feet !== undefined) for (const f of feet) f.s.visible = which.feet;
						if (which.front !== undefined && shFront) shFront.visible = which.front;
						if (which.back !== undefined && shBack) shBack.visible = which.back;
					},
					backInfo: () => (shBack ? { x: shBack.x, y: shBack.y, w: shBack.width, h: shBack.height, sx: shBack.scale.x, sy: shBack.scale.y, skx: shBack.skew.x, sky: shBack.skew.y, rot: shBack.rotation, bounds: shBack.getBounds().rectangle } : null),
					rtFront: () => (rtFront ? context.stateApp.pixiApplication?.renderer.extract.base64({ target: rtFront }) : null),
					rtBack: () => (rtBack ? context.stateApp.pixiApplication?.renderer.extract.base64({ target: rtBack }) : null),
					// each foot bone in the view's local (children) space, and the local bounds the
					// extract image spans: image px = (local − bounds.min) × extract resolution
					feetAll: () => FEET.map((name) => { const p = r.part(name); return p ? { name, x: p.position.x, y: p.position.y } : null; }).filter(Boolean),
					bounds: () => { const b = r.view.getLocalBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height }; },
					scale: () => r.view.scale.x,
					pivot: () => ({ x: r.view.pivot.x, y: r.view.pivot.y }),
					size,
				};
			}
			playIdle(r); // weighted idle pick + random start frame desyncs multiple mantises
			const ticker = context.stateApp.pixiApplication?.ticker;
			if (ticker) {
				tick = () => {
					r.update(ticker.deltaMS / 1000);
					placeShadows(r);
					if (shFront) lastToe.set(shFront.x, shFront.y - MS.front.start * H);
				};
				ticker.add(tick);
			}
			// idle variety: occasionally re-roll the idle clip, but only while actually idling —
			// a strike, reaction, or walk in progress is never interrupted
			rotate = setInterval(() => {
				if (isIdling(r)) playIdle(r);
			}, 14000 + Math.random() * 8000);
			rig = r;
			if (rtBack && shBack) {
				setMantisShadowSource(skin ?? 'Marty', {
					texture: rtBack,
					mirror,
					k: rigScale(),
					anchor: { x: 0.5, y: shBack.anchor.y },
					toeWorld,
					H,
				});
			}
		});
		return () => {
			dead = true;
			setMantisShadowSource(skin ?? 'Marty', null);
			rtFront?.destroy(true);
			rtBack?.destroy(true);
			if (tick) context.stateApp.pixiApplication?.ticker.remove(tick);
			clearInterval(rotate);
			rig = null;
		};
	});

	$effect(() => {
		const s = size / maxDim;
		if (rig) {
			rig.view.scale.set(s);
			placeShadows(rig);
		}
		wrapper.scale.x = mirror ? -1 : 1;
	});
</script>
