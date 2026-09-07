<script lang="ts">
	// Exhaust fan (game/ambientSpec.ts FAN): raw Pixi objects driven from the app ticker, like BoneRig —
	// no per-frame Svelte props, no filters, no new textures. Tree:
	//   root (mask: tilted ellipse)
	//   └ persp  rotation = tilt, scale = (k, 1)      ← the perspective map A
	//     ├ spin rotation = alpha (ticker)             ← N ghost blade sprites, alpha 1/N, trailing the sweep
	//     └ hub  static cap, drawn over the blades
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { FAN } from '../game/ambientSpec';

	type Props = {
		/** hub position in canvas px */
		x: number;
		y: number;
		/** backdrop px → canvas px */
		scale: number;
		alpha?: number;
		visible?: boolean;
		zIndex?: number;
	};
	const { x, y, scale, alpha = 1, visible = true, zIndex = 0 }: Props = $props();
	const context = getContext();

	const root = new PIXI.Container();
	getContextParent().addToParent(root); // unmount cleanup destroys the subtree
	const persp = new PIXI.Container();
	const spin = new PIXI.Container();
	const tilt = (FAN.tiltDeg * Math.PI) / 180;
	persp.rotation = tilt;
	persp.scale.set(FAN.squashK, 1);
	persp.addChild(spin);
	root.addChild(persp);
	// clip: an ellipse rotated with the tilt (NOT squashed — it outlines the housing hole, not the disc)
	const clip = new PIXI.Graphics().ellipse(0, 0, FAN.clip.rx, FAN.clip.ry).fill(0xffffff);
	clip.rotation = tilt;
	root.addChild(clip);
	root.mask = clip;

	let rate = (FAN.revPerSec * Math.PI * 2) as number;
	let angle = 0;
	const ghosts: PIXI.Sprite[] = [];

	onMount(() => {
		const blades = context.stateApp.loadedAssets?.fanBlades as PIXI.Texture | undefined;
		const hub = context.stateApp.loadedAssets?.fanHub as PIXI.Texture | undefined;
		if (!blades || !hub) return;
		const n = Math.max(1, FAN.blurSamples);
		for (let i = 0; i < n; i++) {
			const s = new PIXI.Sprite(blades);
			s.anchor.set(FAN.pivot.x / blades.width, FAN.pivot.y / blades.height);
			s.scale.set(FAN.cutoutScale);
			s.alpha = 1 / n;
			spin.addChild(s);
			ghosts.push(s);
		}
		const cap = new PIXI.Sprite(hub);
		cap.anchor.set(FAN.pivot.x / hub.width, FAN.pivot.y / hub.height);
		cap.scale.set(FAN.cutoutScale);
		persp.addChild(cap);

		const ticker = context.stateApp.pixiApplication?.ticker;
		const tick = () => {
			if (!root.visible || root.worldAlpha <= 0) return;
			const dt = Math.min(0.05, ticker!.deltaMS / 1000);
			const sweep = rate * dt;
			angle = (angle + sweep) % (Math.PI * 2);
			for (let i = 0; i < ghosts.length; i++) ghosts[i].rotation = angle - (sweep * i) / ghosts.length;
		};
		ticker?.add(tick);
		// test hook (house rules: extend __angryMantis, never a new global)
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			const am = ((window as any).__angryMantis ??= {});
			(am.ambient ??= {}).fan = { setRate: (rps: number) => (rate = rps * Math.PI * 2), angle: () => angle };
		}
		return () => {
			ticker?.remove(tick);
		};
	});

	$effect(() => {
		root.position.set(x, y);
		root.scale.set(scale);
		root.alpha = alpha;
		root.visible = visible;
		root.zIndex = zIndex;
	});
</script>
