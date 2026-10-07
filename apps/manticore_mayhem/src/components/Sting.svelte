<script lang="ts">
	// THE STING OVERLAYS (RULE_PASS_2 section F, STING locked Corey 2026-10-06 10:36).
	//
	// Everything the player sees of a sting that is not the board cells themselves: the board engine
	// (stateGame.stingHit / stingBig) owns the cells (pop, flip, dim) and stamps one stingFx entry per
	// overlay (game/featureFx.ts); this layer draws them on the app ticker in the playground's maths
	// (motion-playground.html draw(), the sting overlays):
	//   normal   the tail streak from off the top-right corner into the cell during the wind-up
	//            (quadIn along the line, trailing 35%), the white flash at the hit fading over 120 ms,
	//            one ring 0.22 -> ringScale / 2 cells over ringMs (quadOut, fades)
	//   big      the centre telegraph breathing through the charge, the white flash on every cell at
	//   super    the hit, NO per-cell rings; bigRings rings from the centre, bigRingGapMs apart, each
	//            0.2 -> reach cells over bigRingMs, width bigRingPx shrinking 60%
	//   scatter  SCATTER_STING: the normal streak and flash (no white ring); the scatter's STANDARD landing
	//            ring (a coloured ring with its glow, stateGame.scatterRing) rides the ripple-ring pool
	// A Spine rig can still replace this file alone: the handler and the engine speak in kinds.
	//
	// House rules: always mounted at one z in the sorted board container (the conditional-mount trap),
	// no filters, no textures at all. Every node is pooled and built at mount; the flashes are drawn
	// once (only transform + alpha move), the streaks and rings are a single stroked segment / circle
	// redrawn into their own Graphics while they are live (geometry, never a texture). The canvas
	// glow the playground gives the streak and the big rings (shadowBlur) is a wider, fainter stroke
	// under the line.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { quadIn, quadOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, GRID, STING, PLAYGROUND_PX, reelOf, rowOf } from '../game/constants';
	import { stingFx, clearStingFx } from '../game/featureFx';

	const context = getContext();
	const CELL = SYMBOL_SIZE;
	const K = PLAYGROUND_PX;
	const FLASH_SIZE = CELL - 4 * K;
	/** the playground's streak origin: 1.5 cells right of the board, 1.2 cells above it */
	const ORIGIN_X = CELL * GRID + CELL * 1.5;
	const ORIGIN_Y = -CELL * 1.2;
	const FLASH_MS = 120;

	// pool sizes: a super's nine flashes at once, a normal's ring tail overlapping the next wind-up
	const FLASH_POOL = 12;
	const STREAK_POOL = 4;
	const RING_POOL = 6;
	// big / super ripples (2) and the scatter landing rings (up to six scatters landing close together)
	const SHAPE_RING_POOL = 8;

	const root = new PIXI.Container({ zIndex: 15 });
	getContextParent().addToParent(root);
	const graphics = (n: number) =>
		Array.from({ length: n }, () => {
			const g = new PIXI.Graphics();
			g.visible = false;
			root.addChild(g);
			return g;
		});
	const telegraph = graphics(1)[0];
	const streaks = graphics(STREAK_POOL);
	const rings = graphics(RING_POOL);
	const shapeRings = graphics(SHAPE_RING_POOL);
	const flashes = Array.from({ length: FLASH_POOL }, () => {
		const g = new PIXI.Graphics().roundRect(-FLASH_SIZE / 2, -FLASH_SIZE / 2, FLASH_SIZE, FLASH_SIZE, 6 * K).fill(0xffffff);
		g.visible = false;
		root.addChild(g);
		return g;
	});

	const cx = (cell: number) => (reelOf(cell) + 0.5) * CELL;
	const cy = (cell: number) => (rowOf(cell) + 0.5) * CELL;

	/** DEV probe counters: overlays drawn this frame and the most at once */
	const stats = { flashes: 0, streaks: 0, rings: 0, shapeRings: 0, telegraph: 0, dropped: 0 };
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		Object.assign(((window as any).__manticore ??= {}), { stingOverlays: () => ({ ...stats }) });
	}

	let shown = false;
	const hideAll = () => {
		telegraph.visible = false;
		for (const g of streaks) g.visible = false;
		for (const g of rings) g.visible = false;
		for (const g of shapeRings) g.visible = false;
		for (const g of flashes) g.visible = false;
		shown = false;
	};

	const tick = () => {
		if (context.stateGame.skipping) {
			// SKIP TO RESULT: the engine applies the symbol change; the overlays have nothing to show
			clearStingFx();
			if (shown) hideAll();
			return;
		}
		const ch = stingFx.charge;
		if (!ch && !stingFx.strikes.length && !stingFx.rings.length) {
			if (shown) hideAll();
			return;
		}
		shown = true;
		const now = performance.now();
		let nf = 0;
		let ns = 0;
		let nr = 0;
		let nsr = 0;

		// ---- the centre telegraph ----
		telegraph.visible = false;
		if (ch) {
			const el = (now - ch.t0) * ch.rate;
			if (el >= ch.dur) stingFx.charge = null;
			else if (el >= 0) {
				const u = el / ch.dur;
				telegraph.clear();
				const pulse = Math.max(0, Math.sin(u * Math.PI * STING.chargeBeats));
				telegraph.circle(cx(ch.centre), cy(ch.centre), CELL * (0.3 + 0.25 * pulse)).stroke({ color: STING.wildColor, width: 3 * K });
				telegraph.alpha = 0.25 + 0.6 * pulse;
				telegraph.visible = true;
				stats.telegraph = 1;
			}
		}

		// ---- the struck cells ----
		for (let i = stingFx.strikes.length - 1; i >= 0; i -= 1) {
			const st = stingFx.strikes[i];
			const el = (now - st.t0) * st.rate;
			const hitT = st.hitAt * st.dur;
			const end = Math.max(st.dur, hitT + Math.max(FLASH_MS, st.ringMs));
			if (el >= end) {
				stingFx.strikes.splice(i, 1);
				continue;
			}
			if (el < 0) continue; // a big / super's hit, still charging
			const u = el / st.dur;
			const x = cx(st.cell);
			const y = cy(st.cell);
			if (st.streak && u < st.hitAt) {
				if (ns >= STREAK_POOL) stats.dropped += 1;
				else {
					const g = streaks[ns++];
					const a = quadIn(u / st.hitAt);
					const b = Math.max(0, a - 0.35);
					const x0 = ORIGIN_X + (x - ORIGIN_X) * b;
					const y0 = ORIGIN_Y + (y - ORIGIN_Y) * b;
					const x1 = ORIGIN_X + (x - ORIGIN_X) * a;
					const y1 = ORIGIN_Y + (y - ORIGIN_Y) * a;
					const w = STING.streakPx * K;
					g.clear()
						.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: STING.wildColor, width: w + 12 * K, alpha: 0.22, cap: 'round' })
						.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: STING.wildColor, width: w + 5 * K, alpha: 0.45, cap: 'round' })
						.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: STING.wildColor, width: w, cap: 'round' });
					g.alpha = 1;
					g.visible = true;
				}
			}
			const since = el - hitT;
			if (since < 0) continue;
			if (STING.flashAlpha > 0 && since < FLASH_MS) {
				if (nf >= FLASH_POOL) stats.dropped += 1;
				else {
					const g = flashes[nf++];
					g.position.set(x, y);
					g.alpha = STING.flashAlpha * (1 - since / FLASH_MS);
					g.visible = true;
				}
			}
			if (st.ringMs > 0 && since < st.ringMs) {
				if (nr >= RING_POOL) stats.dropped += 1;
				else {
					const g = rings[nr++];
					const v = since / st.ringMs;
					g.clear().circle(x, y, CELL * (0.22 + (STING.ringScale / 2 - 0.22) * quadOut(v))).stroke({ color: 0xffffff, width: (4 * (1 - v) + 1) * K });
					g.alpha = 1 - v;
					g.visible = true;
				}
			}
		}

		// ---- the big / super ripple rings ----
		for (let i = stingFx.rings.length - 1; i >= 0; i -= 1) {
			const r = stingFx.rings[i];
			const el = (now - r.t0) * r.rate;
			if (el >= r.dur) {
				stingFx.rings.splice(i, 1);
				continue;
			}
			if (el < 0) continue;
			if (nsr >= SHAPE_RING_POOL) {
				stats.dropped += 1;
				continue;
			}
			const u = el / r.dur;
			const g = shapeRings[nsr++];
			const r0 = r.from ?? 0.2;
			const rad = CELL * (r0 + (r.reach - r0) * quadOut(u));
			const w = (r.px * (1 - 0.6 * u) + 1) * K;
			const x = cx(r.centre);
			const y = cy(r.centre);
			// the playground's shapeRing: the ring in its colour (white for a wild shape) over its soft glow
			// (canvas shadowBlur 10, here a wider faint stroke)
			g.clear()
				.circle(x, y, rad).stroke({ color: r.color ?? STING.wildColor, width: w + 10 * K, alpha: 0.3 })
				.circle(x, y, rad).stroke({ color: r.color ?? 0xffffff, width: w });
			g.alpha = 1 - u;
			g.visible = true;
		}

		for (let i = nf; i < FLASH_POOL; i += 1) flashes[i].visible = false;
		for (let i = ns; i < STREAK_POOL; i += 1) streaks[i].visible = false;
		for (let i = nr; i < RING_POOL; i += 1) rings[i].visible = false;
		for (let i = nsr; i < SHAPE_RING_POOL; i += 1) shapeRings[i].visible = false;
		stats.flashes = Math.max(stats.flashes, nf);
		stats.streaks = Math.max(stats.streaks, ns);
		stats.rings = Math.max(stats.rings, nr);
		stats.shapeRings = Math.max(stats.shapeRings, nsr);
	};

	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		ticker?.add(tick);
		return () => {
			ticker?.remove(tick);
			// the parent's unmount destroys root without its children
			root.destroy({ children: true });
		};
	});
</script>
