<script lang="ts">
	// Lamp flicker (game/ambientSpec.ts LIGHTS), base scene only. One sprite per lamp holding its
	// "off" patch over the lit room; alpha 0 = lit, 1 = dark. A ticker runs the rare-event timer and
	// each lamp's blink sequence. Raw Pixi like the other ambient layers: no per-frame Svelte
	// props, no filters, no new textures. Authored in backdrop px; the parent maps that space onto
	// the cover-fitted room.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { LIGHTS } from '../game/ambientSpec';

	type Props = { x: number; y: number; scale: number; alpha?: number; visible?: boolean; zIndex?: number };
	const { x, y, scale, alpha = 1, visible = true, zIndex = 0 }: Props = $props();
	const context = getContext();

	const root = new PIXI.Container();
	getContextParent().addToParent(root);
	const KEY: Record<string, string> = { hanging: 'lightOffHanging', sconce: 'lightOffSconce', counter: 'lightOffCounter' };
	type Lamp = { name: string; s: PIXI.Sprite; seq: { alpha: number; ms: number }[]; t: number; target: number };
	const lamps: Lamp[] = [];
	const rnd = (a: number, b: number) => a + Math.random() * (b - a);
	let nextEvent = rnd(LIGHTS.everyS[0], LIGHTS.everyS[1]);

	// a flicker: on/off pairs at blink timing, maybe an outage, then on
	const flicker = (l: Lamp) => {
		const seq: { alpha: number; ms: number }[] = [];
		const n = Math.round(rnd(LIGHTS.blinks[0], LIGHTS.blinks[1]));
		for (let i = 0; i < n; i++) {
			seq.push({ alpha: 1, ms: rnd(LIGHTS.blinkMs[0], LIGHTS.blinkMs[1]) });
			seq.push({ alpha: 0, ms: rnd(LIGHTS.blinkMs[0], LIGHTS.blinkMs[1]) });
		}
		if (Math.random() < LIGHTS.outageChance) {
			seq.push({ alpha: 1, ms: rnd(LIGHTS.outageS[0], LIGHTS.outageS[1]) * 1000 });
			seq.push({ alpha: LIGHTS.dim, ms: rnd(LIGHTS.blinkMs[0], LIGHTS.blinkMs[1]) });
		}
		seq.push({ alpha: 0, ms: 0 });
		l.seq = seq;
		l.t = 0;
	};
	const pick = () => {
		const total = lamps.reduce((a, l) => a + (LIGHTS.lamps[l.name]?.weight ?? 1), 0);
		let r = Math.random() * total;
		for (const l of lamps) {
			r -= LIGHTS.lamps[l.name]?.weight ?? 1;
			if (r <= 0) return l;
		}
		return lamps[lamps.length - 1];
	};

	onMount(() => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		for (const [name, spec] of Object.entries(LIGHTS.lamps)) {
			const tex = assets?.[KEY[name]];
			if (!tex) continue;
			const s = new PIXI.Sprite(tex);
			s.position.set(spec.x, spec.y);
			s.alpha = 0;
			root.addChild(s);
			lamps.push({ name, s, seq: [], t: 0, target: 0 });
		}
		const ticker = context.stateApp.pixiApplication?.ticker;
		const tick = () => {
			if (!root.visible || root.alpha <= 0 || !lamps.length) return;
			const dtMs = Math.min(50, ticker?.deltaMS ?? 16);
			nextEvent -= dtMs / 1000;
			if (nextEvent <= 0) {
				const l = pick();
				if (!l.seq.length) flicker(l);
				nextEvent = rnd(LIGHTS.everyS[0], LIGHTS.everyS[1]);
			}
			for (const l of lamps) {
				if (l.seq.length) {
					l.t -= dtMs;
					const step = l.seq[0];
					l.target = step.alpha;
					if (l.t <= 0) {
						l.seq.shift();
						l.t = l.seq[0]?.ms ?? 0;
					}
				} else l.target = 0;
				// short ramp toward the target: a filament does not switch in one frame
				const k = LIGHTS.fadeMs > 0 ? Math.min(1, dtMs / LIGHTS.fadeMs) : 1;
				l.s.alpha += (l.target * LIGHTS.strength - l.s.alpha) * k;
			}
		};
		ticker?.add(tick);
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			const am = ((window as any).__angryMantis ??= {});
			(am.ambient ??= {}).lights = {
				flicker: (name?: string) => { const l = name ? lamps.find((x) => x.name === name) : pick(); if (l) flicker(l); },
				set: (name: string, a: number) => { const l = lamps.find((x) => x.name === name); if (l) { l.seq = [{ alpha: a, ms: 1e9 }]; l.t = 1e9; } },
				alphas: () => Object.fromEntries(lamps.map((l) => [l.name, +l.s.alpha.toFixed(2)])),
			};
		}
		return () => ticker?.remove(tick);
	});

	$effect(() => {
		root.position.set(x, y);
		root.scale.set(scale);
		root.alpha = alpha;
		root.visible = visible;
		root.zIndex = zIndex;
	});
</script>
