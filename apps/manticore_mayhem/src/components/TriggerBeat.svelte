<script lang="ts">
	// THE TRIGGER BEAT'S LIGHT (constants TRIGGER_BEAT; harsh review 2026-10-15 design item 8, Corey 2026-10-16 17:32
	// "A1. Sounds good"). The board engine (stateGame.triggerBeat) lifts and lights the triggering War Standards and
	// writes game/featureFx.ts triggerFx every frame; this layer draws what is not a board cell:
	//   the light columns   one per triggering scatter: a soft shaft standing on the banner's top edge, rising to
	//                       shaftCells over shaftInMs and shimmering slightly while it holds, in shaftColor
	//   the flare           a round halo burst on each scatter at the lift's peak, fading over flareMs
	// House rules: always mounted at one z in the sorted board container (over the cells, under the sting overlays),
	// raw Pixi ticked from the app ticker with an early out at rest, every sprite pooled and built at mount, the two
	// textures baked once (game/beamTexture.ts), additive sprites only: no filters, no masks, no per-frame textures.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, TRIGGER_BEAT, reelOf, rowOf } from '../game/constants';
	import { triggerFx } from '../game/featureFx';
	import { shaftTexture, haloTexture } from '../game/beamTexture';

	const context = getContext();
	const CELL = SYMBOL_SIZE;
	const T = TRIGGER_BEAT;
	/** one per column at most (bonusStart.scatters: at most one per column, 8 for the 8 scatter Epic) */
	const POOL = 8;

	const root = new PIXI.Container({ zIndex: 14, visible: false });
	getContextParent().addToParent(root);
	const shafts = Array.from({ length: POOL }, () => {
		const s = new PIXI.Sprite(shaftTexture());
		s.anchor.set(0.5, 1);
		s.blendMode = 'add';
		s.tint = T.shaftColor;
		s.visible = false;
		root.addChild(s);
		return s;
	});
	const halos = Array.from({ length: POOL }, () => {
		const s = new PIXI.Sprite(haloTexture());
		s.anchor.set(0.5);
		s.blendMode = 'add';
		s.tint = T.glowColor;
		s.visible = false;
		root.addChild(s);
		return s;
	});

	/** DEV probe: the most columns drawn at once since load, and the beats seen */
	const stats = { peak: 0, beats: 0 };
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		Object.assign(((window as any).__manticore ??= {}), { triggerBeat: () => ({ ...stats, active: triggerFx.active, cells: triggerFx.cells.slice(), shaft: triggerFx.shaft, alpha: triggerFx.alpha, flare: triggerFx.flare }) });
	}

	let shown = false;
	const tick = () => {
		if (!triggerFx.active || context.stateGame.skipping) {
			if (shown) {
				shown = false;
				root.visible = false;
				for (const s of shafts) s.visible = false;
				for (const s of halos) s.visible = false;
			}
			return;
		}
		if (!shown) {
			shown = true;
			root.visible = true;
			stats.beats += 1;
		}
		const cells = triggerFx.cells;
		const n = Math.min(cells.length, POOL);
		stats.peak = Math.max(stats.peak, n);
		const h = T.shaftCells * CELL * triggerFx.shaft;
		for (let i = 0; i < POOL; i += 1) {
			const s = shafts[i];
			const g = halos[i];
			if (i >= n) {
				if (s.visible) s.visible = false;
				if (g.visible) g.visible = false;
				continue;
			}
			const cx = (reelOf(cells[i]) + 0.5) * CELL;
			const cy = (rowOf(cells[i]) + 0.5) * CELL;
			// each column shimmers on its own phase (a slow flicker, never a strobe)
			const shimmer = 0.88 + 0.12 * Math.sin((triggerFx.el / 1000) * 5.1 + i * 1.7);
			s.visible = h > 1 && triggerFx.alpha > 0;
			if (s.visible) {
				s.position.set(cx, cy - CELL * 0.36);
				s.setSize(T.shaftWidthCells * CELL, h);
				s.alpha = triggerFx.alpha * shimmer;
			}
			g.visible = triggerFx.flare > 0;
			if (g.visible) {
				const size = T.flareCells * CELL * (0.55 + 0.45 * (1 - triggerFx.flare));
				g.position.set(cx, cy);
				g.setSize(size, size);
				g.alpha = T.flareAlpha * triggerFx.flare;
			}
		}
	};

	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		ticker?.add(tick);
		return () => {
			ticker?.remove(tick);
			// the parent's unmount destroys root; the baked textures are shared and stay
			root.destroy({ children: true });
		};
	});
</script>
