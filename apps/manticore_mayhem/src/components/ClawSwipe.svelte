<script lang="ts">
	// THE CLAW SWIPE'S CLAWS, THE ROAR'S CELL FLASHES AND THE BOARD KICK (constants SWIPE_FX, claw-swipe-r1; ROAR_FX).
	//
	// The board engine (stateGame.swipeBand / roarBlow) owns the clock and the cells and writes
	// game/featureFx.ts every frame; this layer draws from it on the app ticker, raw Pixi, no Svelte in
	// the frame. Three things:
	//
	// 1. THE CLAWS (clawLayer, z 21: over the tiles and the badges, under the readouts' HUD). FOUR straight claw
	//    strokes ("The manticore has four claws", Corey 2026-10-16 17:32; straight and laid where the old tears were,
	//    r2 2026-10-17 09:52) rake the swiped band right to left, top claw first, SWIPE_FX.clawStaggerMs apart: each draws on behind a hot tip, holds, and burns out with its
	//    tail chasing the tip. Each claw leaves an ember scar along its path that holds until the symbols leave and
	//    fades with them (swipeFx.alpha). A warm-white flash covers the band for impactFlashMs at impactAtMs.
	//    Every claw and scar is a sprite of ONE baked streak (game/fxTexture.ts clawTexture, made at mount) with
	//    its OWN Texture object over that one source (made once): drawing on is cropping that object's frame, no
	//    mask, no new texture. A claw is a container at its start point, turned along its chord and scaled from
	//    texture px; the sprites inside sit at the crop's texture x. 4 containers x (scar, claw, tip) + the flash,
	//    all additive, built once, reused by every swipe; nothing is allocated per frame or per swipe. Inside the
	//    layer nothing is ever hidden with `visible` (each toggle makes Pixi rebuild the render group's instructions,
	//    measured as a 100 ms frame at CPU 4x): a sprite that is out is at alpha 0; only the layer itself toggles.
	// 2. THE ROAR'S CELL FLASHES (wellLayer, z -0.5: on the cell well, UNDER the tiles, like the
	//    playground's): 64 rounded squares built once, alpha from roarFx.
	// 3. THE KICK: boardKick (board px) is applied to the board container's pivot, so the whole board
	//    (mask, backdrop, tiles, claws) translates together and returns exactly to rest.
	//
	// House rules: always mounted, no filters, no masks, no backdrop-filter, no texture per frame, every duration
	// from constants.ts in style ms (the engine's clock already is: turbo shortens it). A skip never shows a claw:
	// swipeBand leaves swipeFx.active false while skipping.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { quadIn, quadOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, GRID, CELL_COUNT, BOARD_SIZES, SWIPE_FX, ROAR_FX, PLAYGROUND_PX, reelOf, rowOf } from '../game/constants';
	import { swipeFx, roarFx, boardKick } from '../game/featureFx';
	import { clawTexture, dotTexture, DOT_PX } from '../game/fxTexture';

	const context = getContext();
	const parent = getContextParent();
	const W = BOARD_SIZES.width;
	const H = BOARD_SIZES.height;
	const CELL = SYMBOL_SIZE;
	const K = PLAYGROUND_PX;
	const F = SWIPE_FX;
	const N = Math.max(1, Math.round(F.clawCount));

	// ---- the claws -------------------------------------------------------------------------------
	const geom = clawTexture();
	const src = geom.texture.source;
	const clawLayer = new PIXI.Container({ zIndex: 21, visible: false, label: 'clawSwipe' });
	parent.addToParent(clawLayer);
	const flash = new PIXI.Sprite(PIXI.Texture.WHITE);
	flash.blendMode = 'add';
	flash.tint = F.impactTint;
	flash.alpha = 0;
	clawLayer.addChild(flash);
	/** a crop of the streak: its own Texture over the one source, so its frame can move (dynamic: the sprite follows) */
	const cropOf = () => new PIXI.Texture({ source: src, frame: new PIXI.Rectangle(0, 0, geom.w, geom.h), dynamic: true });
	type Claw = {
		root: PIXI.Container;
		scar: PIXI.Sprite;
		scarTex: PIXI.Texture;
		claw: PIXI.Sprite;
		clawTex: PIXI.Texture;
		tip: PIXI.Sprite;
		t0: number;
		/** the crop last given (texture px), so an unchanged frame is never re-sent */
		scarB: number;
		clawA: number;
		clawB: number;
	};
	const claws: Claw[] = Array.from({ length: N }, (_, i) => {
		const root = new PIXI.Container({ alpha: 0 });
		const scarTex = cropOf();
		const clawTex = cropOf();
		const scar = new PIXI.Sprite(scarTex);
		scar.blendMode = 'add';
		scar.tint = F.scarTint;
		const claw = new PIXI.Sprite(clawTex);
		claw.blendMode = 'add';
		claw.tint = F.clawTints[i % F.clawTints.length] ?? 0xffffff;
		const tip = new PIXI.Sprite(dotTexture());
		tip.anchor.set(0.5);
		tip.blendMode = 'add';
		tip.tint = F.tipTint;
		root.addChild(scar, claw, tip);
		clawLayer.addChild(root);
		return { root, scar, scarTex, claw, clawTex, tip, t0: i * F.clawStaggerMs, scarB: -1, clawA: -1, clawB: -1 };
	});

	/** a crop [xa, xb] of the streak (texture px) onto a sprite: the frame and the sprite's place in the claw's
	 *  container (texture x from the start of the arc, y from its end points) */
	const crop = (s: PIXI.Sprite, t: PIXI.Texture, xa: number, xb: number) => {
		const wpx = Math.max(xb - xa, 0.5);
		t.frame.x = xa;
		t.frame.width = wpx;
		t.update();
		s.x = xa - geom.pad;
		s.y = -geom.yEnd;
	};
	/** texture x at u along the claw: the whole texture past the ends, so the end caps' glow is never cut */
	const xAt = (u: number) => (u <= 0 ? 0 : u >= 1 ? geom.w : geom.pad + u * geom.chord);

	/** the slant for a band, as the old tears had it: fixed, or from the band's centre row (the top of the board =
	 *  slantTopDeg) */
	const slantFor = (rows: number[]) => {
		if (F.slantMode !== 'rows' || !rows.length) return F.clawSlantDeg;
		const mean = rows.reduce((p, r) => p + r, 0) / rows.length;
		return F.slantTopDeg + ((F.slantBottomDeg - F.slantTopDeg) * mean) / (GRID - 1);
	};

	/** the claws' places for a band, exactly where the old tears were (r2, Corey 2026-10-17 09:52 "in the
	 *  directions/angles we already had it"): claw i (top first) is a straight stroke across the board's whole width,
	 *  its middle at the band's (i + 0.5) / N, its line y = y0 + (x - W / 2) tan(slant), drawn from the right edge to
	 *  the left one. */
	const build = (rows: number[]) => {
		const top = (rows.length ? rows[0] : 3) * CELL;
		const bot = (rows.length ? rows[rows.length - 1] + 1 : 6) * CELL;
		const tan = Math.tan((slantFor(rows) * Math.PI) / 180);
		const sy = (F.clawCorePx * K) / geom.corePx;
		// right edge to left edge: the chord is the board's width along the slant
		const L = W / Math.cos(Math.atan(tan));
		for (let i = 0; i < N; i += 1) {
			const c = claws[i];
			const y0 = top + ((bot - top) * (i + 0.5)) / N;
			c.root.position.set(W, y0 + (W / 2) * tan);
			c.root.rotation = Math.atan2(-W * tan, -W);
			c.root.scale.set(L / geom.chord, sy);
			// the tip: the soft dot stretched along the claw, its size in board px whatever the container's scale
			c.tip.scale.set(((F.tipPx * K * F.tipStretch) / DOT_PX) * (geom.chord / L), (F.tipPx * K) / DOT_PX / sy);
			c.t0 = i * F.clawStaggerMs;
			c.scarB = c.clawA = c.clawB = -1;
		}
		flashShown = false;
		flash.position.set(0, top);
		flash.setSize(W, bot - top);
	};

	/** this swipe's impact flash has been on screen (reset by build) */
	let flashShown = false;
	/** one frame of the claws at style ms `el` (the scars' fade is swipeFx.alpha) */
	const drawClaws = (el: number, fade: number) => {
		for (const c of claws) {
			const tau = el - c.t0;
			if (tau < 0) {
				c.root.alpha = 0;
				continue;
			}
			c.root.alpha = 1;
			const b = quadOut(Math.min(1, tau / Math.max(F.clawDrawMs, 1)));
			const tailSpan = Math.max(F.clawLifeMs - F.clawTailAtMs, 1);
			const tu = Math.max(0, Math.min(1, (tau - F.clawTailAtMs) / tailSpan));
			const a = quadIn(tu);
			// the claw: [a, b], burning out over its tail
			if (tu >= 1 || b <= 0) c.claw.alpha = 0;
			else {
				const xa = a <= 0 ? 0 : xAt(a);
				const xb = xAt(b);
				if (xa !== c.clawA || xb !== c.clawB) {
					c.clawA = xa;
					c.clawB = xb;
					crop(c.claw, c.clawTex, xa, xb);
				}
				c.claw.alpha = 1 - tu * tu;
			}
			// the scar: [0, b], held, then the shared fade
			const sb = xAt(b);
			if (sb !== c.scarB) {
				c.scarB = sb;
				crop(c.scar, c.scarTex, 0, sb);
			}
			c.scar.alpha = b > 0 ? F.scarAlpha * fade : 0;
			// the hot tip, on the front while it draws on
			if (b < 1) {
				c.tip.x = b * geom.chord;
				c.tip.y = geom.yAt(b) - geom.yEnd;
				c.tip.alpha = F.tipAlpha;
			} else c.tip.alpha = 0;
		}
		// the impact: up over impactRiseMs, out (squared) by impactFlashMs. At turbo the whole flash can fall between
		// two frames (60 style ms at turbo 4x is 15 real ms), so the first frame on or past the impact shows the peak
		const ft = el - F.impactAtMs;
		if (ft >= 0 && F.impactAlpha > 0 && (ft < F.impactFlashMs || !flashShown)) {
			const rise = Math.max(F.impactRiseMs, 1);
			// (its first frame is always the peak: the rise is shorter than a frame anyway)
			flash.alpha = !flashShown ? F.impactAlpha : F.impactAlpha * (ft < rise ? ft / rise : Math.pow(1 - (ft - rise) / Math.max(F.impactFlashMs - rise, 1), 2));
			flashShown = true;
		} else flash.alpha = 0;
	};

	/** DEV probe: the slowest claw frame so far, in ms, and the swipes drawn */
	const swipeStats = { drawMs: 0, swipes: 0 };
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		Object.assign(((window as any).__manticore ??= {}), {
			swipeStats: () => ({ ...swipeStats }),
			/** the claw layer's live sprites (claw-swipe-r1 probes): visible claws / scars / tips, the flash's alpha */
			claws: () => ({
				layer: clawLayer.visible,
				alpha: clawLayer.alpha,
				claws: claws.filter((c) => c.root.alpha > 0 && c.claw.alpha > 0).length,
				scars: claws.filter((c) => c.root.alpha > 0 && c.scar.alpha > 0).length,
				tips: claws.filter((c) => c.root.alpha > 0 && c.tip.alpha > 0).length,
				flash: +flash.alpha.toFixed(3),
				sprites: clawLayer.children.length + claws.length * 3,
			}),
		});
	}

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
	let serial = -1;
	let kx = 0;
	let ky = 0;
	const tick = () => {
		// the kick: the board container's pivot, offset by the kick (the base pivot is the board's centre)
		if (boardKick.x !== kx || boardKick.y !== ky) {
			kx = boardKick.x;
			ky = boardKick.y;
			parent.parent.pivot.set(W / 2 - kx, H / 2 - ky);
		}
		// the claws
		if (swipeFx.active) {
			if (serial !== swipeFx.serial) {
				serial = swipeFx.serial;
				build(swipeFx.rows);
				swipeStats.swipes += 1;
			}
			const d0 = performance.now();
			drawClaws(swipeFx.el, swipeFx.alpha);
			swipeStats.drawMs = Math.max(swipeStats.drawMs, performance.now() - d0);
			clawLayer.visible = true;
		} else if (clawLayer.visible) {
			clawLayer.visible = false;
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
		const app = context.stateApp.pixiApplication;
		const ticker = app?.ticker;
		// the streak's one upload now, not on the first swipe's frame (a renderer without initSource uploads on first draw)
		try {
			(app?.renderer as any)?.texture?.initSource?.(src);
		} catch {
			/* first draw uploads it */
		}
		// after BoardCells' sync (HIGH), before the render (LOW)
		ticker?.add(tick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
		return () => {
			ticker?.remove(tick);
			parent.parent.pivot.set(W / 2, H / 2);
			for (const c of claws) {
				c.scarTex.destroy(false);
				c.clawTex.destroy(false);
			}
			clawLayer.destroy({ children: true });
			wellLayer.destroy({ children: true });
		};
	});
</script>
