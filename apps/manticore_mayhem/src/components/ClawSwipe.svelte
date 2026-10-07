<script lang="ts">
	// THE CLAW SWIPE'S TEARS, THE ROAR'S CELL FLASHES AND THE BOARD KICK (MOTION_SPEC "Claw swipe",
	// "Roar"; the playground's draw() for tears, motion-playground.html).
	//
	// The board engine (stateGame.swipeBand / roarBlow) owns the clock and the cells and writes
	// game/featureFx.ts every frame; this layer draws from it on the app ticker, raw Pixi, no Svelte in
	// the frame. Three things:
	//
	// 1. THE TEARS (tearLayer, z 21: over the tiles and the badges, under the readouts' HUD). Each tear
	//    is the playground's three non-overlapping polygons around a jittered centreline (26 segments):
	//    the CORE (+-tearThickPx / 2) and the TOP and BOTTOM hot bands outside it, whose outer side
	//    carries the torn-paper spikes (78 segments, 1.0 / 0.25 of tearEdgeJitterPx). The reveal is the
	//    playground's clip rect sweeping right to left, done by cutting the polygons at the front (no
	//    mask). Per frame, in this order:
	//      glow   the outer outlines stroked in the glow colour, six graded strokes from wide and faint
	//             to narrow and solid (the canvas shadowBlur without a filter). Bevel joins: round
	//             joins on these widths cost 50 ms a sweep frame at CPU 4x in tessellation alone
	//      bands  filled with the edge colour, then the board copy at tearReflect through the band as a
	//             mask: upright on the bottom band, flipped about the tear's line on the top band. The
	//             copy is ONE RenderTexture of the board rendered ONCE at the swipe's start (allocated
	//             once, at the first swipe, and reused)
	//      core   black at tearCoreAlpha and nothing else: the tear layer sits over the tiles, so the cut
	//             darkens them; the backing and the frame's lattice under the board read through it
	//    The geometry is rebuilt only while a tear is still sweeping (the first ~125 ms); after that
	//    only the layer's alpha moves (the shared fade).
	// 2. THE ROAR'S CELL FLASHES (wellLayer, z -0.5: on the cell well, UNDER the tiles, like the
	//    playground's): 64 rounded squares built once, alpha from roarFx.
	// 3. THE KICK: boardKick (board px) is applied to the board container's pivot, so the whole board
	//    (mask, backdrop, tiles, tears) translates together and returns exactly to rest.
	//
	// House rules: always mounted, no filters, no backdrop-filter, no texture per frame (the one
	// RenderTexture is allocated once), every duration from constants.ts divided by timeScale (the
	// engine's clock already is).
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { quadOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, GRID, CELL_COUNT, BOARD_SIZES, SWIPE_FX, ROAR_FX, PLAYGROUND_PX, reelOf, rowOf } from '../game/constants';
	import { swipeFx, roarFx, boardKick } from '../game/featureFx';
	import { seeded } from '../game/sparkles';

	const context = getContext();
	const parent = getContextParent();
	const W = BOARD_SIZES.width;
	const H = BOARD_SIZES.height;
	const CELL = SYMBOL_SIZE;
	const K = PLAYGROUND_PX;
	const SEGS = 26;
	const FINE = 78;
	const MAX_TEARS = Math.max(1, Math.round(SWIPE_FX.tearCount));

	// ---- the tears -------------------------------------------------------------------------------
	const tearLayer = new PIXI.Container({ zIndex: 21, visible: false });
	parent.addToParent(tearLayer);
	const glowG = new PIXI.Graphics();
	const bandFillG = new PIXI.Graphics();
	const botMask = new PIXI.Graphics();
	const topMasks = Array.from({ length: MAX_TEARS }, () => new PIXI.Graphics());
	const coreFillG = new PIXI.Graphics();
	// the board copy: the RenderTexture is made at the first swipe (never per frame, never per swipe)
	let rt: PIXI.RenderTexture | null = null;
	const botRefl = new PIXI.Sprite(PIXI.Texture.EMPTY);
	botRefl.alpha = SWIPE_FX.tearReflect;
	botRefl.mask = botMask;
	const topRefl = topMasks.map((m) => {
		const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
		s.alpha = SWIPE_FX.tearReflect;
		s.scale.y = -1;
		s.mask = m;
		return s;
	});
	tearLayer.addChild(glowG, bandFillG, botRefl, ...topRefl, coreFillG, botMask, ...topMasks);

	/** one tear's outlines, sampled at FINE + 1 evenly spaced x across the board (board px) */
	type Tear = { y0: number; t0: number; topOut: Float64Array; coreTop: Float64Array; coreBot: Float64Array; botOut: Float64Array };
	const tears: Tear[] = Array.from({ length: MAX_TEARS }, () => ({
		y0: 0,
		t0: 0,
		topOut: new Float64Array(FINE + 1),
		coreTop: new Float64Array(FINE + 1),
		coreBot: new Float64Array(FINE + 1),
		botOut: new Float64Array(FINE + 1),
	}));
	const pts = new Float64Array(SEGS + 1);

	/** the slant for a band: fixed, or from the band's centre row (top of the board = slantTopDeg) */
	const slantFor = (rows: number[]) => {
		if (SWIPE_FX.slantMode !== 'rows' || !rows.length) return SWIPE_FX.tearSlantDeg;
		const mean = rows.reduce((a, b) => a + b, 0) / rows.length;
		return SWIPE_FX.slantTopDeg + ((SWIPE_FX.slantBottomDeg - SWIPE_FX.slantTopDeg) * mean) / (GRID - 1);
	};

	/** the playground's compileSwipe + the tear geometry of its draw(), in board px. The seeds are the
	 *  playground's (17 + 101 i for the centreline, 3 seed + 7 for the spikes), so the shapes match. */
	const build = (rows: number[]) => {
		const top = rows.length ? rows[0] : 3;
		const bot = rows.length ? rows[rows.length - 1] + 1 : 6;
		const slant = Math.tan((slantFor(rows) * Math.PI) / 180);
		const half = (SWIPE_FX.tearThickPx * K) / 2;
		const edge = SWIPE_FX.tearEdgePx * K;
		const ej = SWIPE_FX.tearEdgeJitterPx * K;
		for (let i = 0; i < MAX_TEARS; i += 1) {
			const tr = tears[i];
			const seed = 17 + i * 101;
			tr.y0 = (top + ((bot - top) * (i + 0.5)) / MAX_TEARS) * CELL;
			tr.t0 = i * SWIPE_FX.tearStaggerMs;
			const rnd = seeded(seed);
			for (let k = 0; k <= SEGS; k += 1) {
				const x = (W * k) / SEGS;
				pts[k] = tr.y0 + (x - W / 2) * slant + (rnd() - 0.5) * 2 * SWIPE_FX.tearJitterPx * K;
			}
			const rnd2 = seeded(seed * 3 + 7);
			for (let k = 0; k <= FINE; k += 1) {
				const x = (W * k) / FINE;
				const u = Math.max(0, Math.min(SEGS - 1e-9, (x / W) * SEGS));
				const j = Math.floor(u);
				const f = u - j;
				const c = pts[j] * (1 - f) + pts[j + 1] * f;
				const spike = rnd2() * ej * (k % 2 ? 1 : 0.25);
				const spike2 = rnd2() * ej * (k % 2 ? 0.25 : 1);
				tr.coreTop[k] = c - half;
				tr.coreBot[k] = c + half;
				tr.topOut[k] = c - half - edge - spike;
				tr.botOut[k] = c + half + edge + spike2;
			}
		}
	};

	// polyline helpers: a sampled outline from the reveal front xc to the right edge, as flat x,y pairs
	const sampleX = (k: number) => (W * k) / FINE;
	const at = (arr: Float64Array, x: number) => {
		const u = Math.max(0, Math.min(FINE - 1e-9, (x / W) * FINE));
		const j = Math.floor(u);
		const f = u - j;
		return arr[j] * (1 - f) + arr[j + 1] * f;
	};
	/** push arr's points with x >= xc onto out (forward, or right to left when `reverse`) */
	const pushLine = (out: number[], arr: Float64Array, xc: number, reverse: boolean) => {
		const first = Math.max(0, Math.ceil((xc / W) * FINE - 1e-9));
		if (!reverse) {
			if (xc > 0) out.push(xc, at(arr, xc));
			for (let k = first; k <= FINE; k += 1) if (sampleX(k) > xc) out.push(sampleX(k), arr[k]);
		} else {
			for (let k = FINE; k >= first; k -= 1) if (sampleX(k) > xc) out.push(sampleX(k), arr[k]);
			if (xc > 0) out.push(xc, at(arr, xc));
		}
	};
	// a FRESH array per shape: Pixi's Polygon keeps the array it is given and tessellates it later, at
	// render time, so a reused buffer would draw whatever it last held (these allocate only while a
	// tear is sweeping, a handful of frames per swipe)
	const polyOf = (a: Float64Array, b: Float64Array, xc: number) => {
		const out: number[] = [];
		pushLine(out, a, xc, false);
		pushLine(out, b, xc, true);
		return out;
	};
	const lineOf = (a: Float64Array, xc: number) => {
		const out: number[] = [];
		pushLine(out, a, xc, false);
		return out;
	};

	/** the glow: the playground's canvas glow (a glowPx / 2 stroke on the outline, shadowBlur glowPx,
	 *  i.e. a Gaussian of sigma glowPx / 2) as six strokes on the outer outlines, each [how far it
	 *  reaches past the outline in glowPx, alpha]: the stacked alphas follow the Gaussian's falloff */
	const GLOW = [
		[1.4, 0.05],
		[1.1, 0.065],
		[0.85, 0.1],
		[0.65, 0.11],
		[0.45, 0.14],
		[0.25, 1],
	] as const;

	const reveals = new Float64Array(MAX_TEARS).fill(-1);
	let complete = false;
	const drawTears = (el: number) => {
		let changed = false;
		for (let i = 0; i < MAX_TEARS; i += 1) {
			const r = el < tears[i].t0 ? -1 : Math.min((el - tears[i].t0) / Math.max(SWIPE_FX.tearSweepMs, 1), 1);
			if (r !== reveals[i]) {
				reveals[i] = r;
				changed = true;
			}
		}
		if (!changed && complete) return;
		complete = reveals.every((r) => r >= 1);
		glowG.clear();
		bandFillG.clear();
		botMask.clear();
		coreFillG.clear();
		for (let i = 0; i < MAX_TEARS; i += 1) {
			const m = topMasks[i];
			m.clear();
			const r = reveals[i];
			if (r < 0) {
				topRefl[i].visible = false;
				continue;
			}
			const tr = tears[i];
			// the playground's clip rect: from x1 - (x1 - x0) quadOut(reveal) - 2 px to the right edge
			const xc = Math.max(0, W - W * quadOut(r) - 2 * K);
			if (SWIPE_FX.tearGlowAlpha > 0 && SWIPE_FX.tearGlowPx > 0) {
				for (const [wk, ak] of GLOW) {
					const style = { color: SWIPE_FX.tearGlowColor, width: 2 * SWIPE_FX.tearGlowPx * K * wk, alpha: SWIPE_FX.tearGlowAlpha * ak, join: 'bevel' as const, cap: 'butt' as const };
					glowG.poly(lineOf(tr.topOut, xc), false).stroke(style);
					glowG.poly(lineOf(tr.botOut, xc), false).stroke(style);
				}
			}
			bandFillG.poly(polyOf(tr.topOut, tr.coreTop, xc)).fill({ color: SWIPE_FX.tearEdgeColor });
			bandFillG.poly(polyOf(tr.coreBot, tr.botOut, xc)).fill({ color: SWIPE_FX.tearEdgeColor });
			m.poly(polyOf(tr.topOut, tr.coreTop, xc)).fill(0xffffff);
			botMask.poly(polyOf(tr.coreBot, tr.botOut, xc)).fill(0xffffff);
			coreFillG.poly(polyOf(tr.coreTop, tr.coreBot, xc)).fill({ color: 0x000000, alpha: SWIPE_FX.tearCoreAlpha });
			topRefl[i].visible = SWIPE_FX.tearReflect > 0;
			// flipped about the tear's line: board y maps to 2 y0 - y
			topRefl[i].y = 2 * tr.y0;
		}
		botRefl.visible = SWIPE_FX.tearReflect > 0;
	};

	/** render the board (without the tears) into the copy, once per swipe */
	const captureFor = (renderer: PIXI.Renderer) => {
		if (!rt) {
			rt = PIXI.RenderTexture.create({ width: W, height: H, resolution: 1 });
			botRefl.texture = rt;
			for (const s of topRefl) s.texture = rt;
		}
		tearLayer.visible = false;
		renderer.render({ container: parent.parent, target: rt, clear: true, transform: identity });
	};
	const identity = new PIXI.Matrix();

	// ---- the roar's cell flashes, on the well under the tiles ------------------------------------
	const wellLayer = new PIXI.Container({ zIndex: -0.5, visible: false });
	parent.addToParent(wellLayer);
	const WELL = CELL - 4 * K;
	const wells = Array.from({ length: CELL_COUNT }, (_, index) => {
		const g = new PIXI.Graphics().roundRect(-WELL / 2, -WELL / 2, WELL, WELL, 6 * K).fill(ROAR_FX.flashColor);
		g.position.set((reelOf(index) + 0.5) * CELL, (rowOf(index) + 0.5) * CELL);
		g.visible = false;
		wellLayer.addChild(g);
		return g;
	});

	// ---- the ticker ----------------------------------------------------------------------------
	/** DEV probe: the slowest capture and tear rebuild so far, in ms */
	const swipeStats = { captureMs: 0, drawMs: 0, captures: 0 };
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		Object.assign(((window as any).__manticore ??= {}), { swipeStats: () => ({ ...swipeStats }) });
	}
	let serial = -1;
	let kx = 0;
	let ky = 0;
	const tick = () => {
		const app = context.stateApp.pixiApplication;
		// the kick: the board container's pivot, offset by the kick (the base pivot is the board's centre)
		if (boardKick.x !== kx || boardKick.y !== ky) {
			kx = boardKick.x;
			ky = boardKick.y;
			parent.parent.pivot.set(W / 2 - kx, H / 2 - ky);
		}
		// the tears
		if (swipeFx.active) {
			if (serial !== swipeFx.serial && app?.renderer) {
				serial = swipeFx.serial;
				build(swipeFx.rows);
				reveals.fill(-1);
				complete = false;
				const c0 = performance.now();
				captureFor(app.renderer as PIXI.Renderer);
				swipeStats.captureMs = Math.max(swipeStats.captureMs, performance.now() - c0);
				swipeStats.captures += 1;
			}
			const d0 = performance.now();
			drawTears(swipeFx.el);
			swipeStats.drawMs = Math.max(swipeStats.drawMs, performance.now() - d0);
			tearLayer.alpha = swipeFx.alpha;
			tearLayer.visible = swipeFx.alpha > 0;
		} else if (tearLayer.visible) {
			tearLayer.visible = false;
		}
		// the roar's flashes
		if (roarFx.active || wellLayer.visible) {
			let any = false;
			for (let k = 0; k < CELL_COUNT; k += 1) {
				const a = roarFx.active ? roarFx.flash[k] : 0;
				const g = wells[k];
				if (a > 0) {
					any = true;
					g.alpha = a;
					g.visible = true;
				} else if (g.visible) g.visible = false;
			}
			wellLayer.visible = any;
		}
	};

	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		// after BoardCells' sync (HIGH) so the copy holds this frame's tiles, before the render (LOW)
		ticker?.add(tick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
		return () => {
			ticker?.remove(tick);
			parent.parent.pivot.set(W / 2, H / 2);
			tearLayer.destroy({ children: true });
			wellLayer.destroy({ children: true });
			rt?.destroy(true);
		};
	});
</script>
