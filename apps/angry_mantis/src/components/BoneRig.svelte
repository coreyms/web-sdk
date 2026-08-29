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
	};
	let { size, mirror = false, skin = null, rig = $bindable(null) }: Props = $props();

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
			const b = measureIdlePose(r);
			maxDim = Math.max(b.width, b.height);
			r.view.pivot.set(b.x + b.width / 2, b.y + b.height / 2);
			if (skin) r.setSkin(skin);
			wrapper.addChild(r.view);
			playIdle(r); // weighted idle pick + random start frame desyncs multiple mantises
			const ticker = context.stateApp.pixiApplication?.ticker;
			if (ticker) {
				tick = () => r.update(ticker.deltaMS / 1000);
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
		if (rig) rig.view.scale.set(s);
		wrapper.scale.x = mirror ? -1 : 1;
	});
</script>
