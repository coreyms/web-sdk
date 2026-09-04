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

	// ── ground shadow ─────────────────────────────────────────────────────────────────────────────
	// One tinted sprite (static/assets/ui/ground-shadow.webp, a soft ellipse) under the rig, placed
	// from the four foot bones each tick: centred on the feet spread, as wide as the stance, sitting
	// on the ground line measured from the idle pose. Feet stay planted through an idle bob, so the
	// shadow holds still while the body breathes; a stride slides it with the stance foot; when the
	// lowest foot leaves the rest ground line (a hop, a rearing reaction) the shadow shrinks and
	// fades — the off-the-ground cue. No allocation, no filter: a few multiplies in the existing tick.
	const FEET = ['Right Foot', 'Foot', 'Left Front Foot', 'Left Back Foot'];
	const SHADOW_ALPHA = 0.5;
	let shadow: PIXI.Sprite | null = null;
	let groundRest = 0; // lowest foot y in view-local (unscaled) units at idle frame 0
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
	const placeShadow = (r: Rig) => {
		if (!shadow) return;
		const f = feetOf(r);
		if (!f) return;
		const v = r.view;
		const s = v.scale.x;
		const cx = ((f.minX + f.maxX) / 2 - v.pivot.x) * s;
		const groundY = (groundRest - v.pivot.y) * s + size * 0.05; // toe length below the ankle bone
		// lift: how far the lowest foot has risen off the rest ground line, in body sizes
		const lift = Math.min(1, Math.max(0, (groundRest - f.lowest) * s / (size * 0.35)));
		const w = (f.maxX - f.minX) * s + size * 0.42;
		shadow.position.set(cx, groundY);
		shadow.width = w * (1 - 0.45 * lift);
		shadow.height = w * 0.28 * (1 - 0.45 * lift);
		shadow.alpha = SHADOW_ALPHA * (1 - 0.75 * lift);
	};

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
			const restFeet = feetOf(r);
			const tex = context.stateApp.loadedAssets?.groundShadow as PIXI.Texture | undefined;
			if (groundShadow && restFeet && tex) {
				groundRest = restFeet.lowest;
				shadow = new PIXI.Sprite(tex);
				shadow.anchor.set(0.5);
				shadow.tint = 0x000000;
				shadow.alpha = SHADOW_ALPHA;
				wrapper.addChildAt(shadow, 0); // under the rig view
				// test hook (house rules: extend __angryMantis, never a new global): A/B the shadow cost
				if (typeof window !== 'undefined') {
					const am = ((window as any).__angryMantis ??= {});
					const set = am.setGroundShadow as ((on: boolean) => void) | undefined;
					am.setGroundShadow = (on: boolean) => {
						set?.(on);
						if (shadow) shadow.visible = on;
					};
				}
			}
			if (skin) r.setSkin(skin);
			wrapper.addChild(r.view);
			playIdle(r); // weighted idle pick + random start frame desyncs multiple mantises
			const ticker = context.stateApp.pixiApplication?.ticker;
			if (ticker) {
				tick = () => {
					r.update(ticker.deltaMS / 1000);
					placeShadow(r);
				};
				ticker.add(tick);
			}
			// idle variety: occasionally re-roll the idle clip, but only while actually idling —
			// a strike, reaction, or walk in progress is never interrupted
			rotate = setInterval(() => {
				if (isIdling(r)) playIdle(r);
			}, 14000 + Math.random() * 8000);
			rig = r;
		});
		return () => {
			dead = true;
			if (tick) context.stateApp.pixiApplication?.ticker.remove(tick);
			clearInterval(rotate);
			rig = null;
		};
	});

	$effect(() => {
		const s = size / maxDim;
		if (rig) {
			rig.view.scale.set(s);
			placeShadow(rig);
		}
		wrapper.scale.x = mirror ? -1 : 1;
	});
</script>
