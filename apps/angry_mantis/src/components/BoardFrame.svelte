<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	// Rusted-steel cafeteria frame (Corey's art, 2026-08-30). The art's transparent interior
	// window is anchored to the cell area (frame rect inset by `inset`), stretching the art
	// non-uniformly by <1% to absorb its 1.2386 aspect vs the board's 1.25 — invisible on rust.
	// The old procedural PNGs baked the cell-well grid into the frame; this art leaves the
	// window open, so the wells render here as a Graphics layer UNDER the frame sprite
	// (same styling as tools/build_reel_frames.py: #140a04 backing, #1a0f08 wells, radius 4).
	import type * as PIXI from 'pixi.js';
	import { Sprite, Graphics } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { frameFor, layoutKind, FRAME_ART } from '../game/layoutSpec';

	const context = getContext();
	const vw = $derived(
		context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale,
	);
	const frame = $derived(frameFor(layoutKind(context.stateLayoutDerived.layoutType()), vw));

	// interior window (cell area) in master units
	const win = $derived({
		x: frame.x + frame.inset,
		y: frame.y + frame.inset,
		w: frame.width - frame.inset * 2,
		h: frame.height - frame.inset * 2,
	});
	const sx = $derived(win.w / FRAME_ART.winW);
	const sy = $derived(win.h / FRAME_ART.winH);

	const drawWells = (g: PIXI.Graphics, f: typeof frame, w: typeof win) => {
		// dark backing panel, bled under the frame edge so no seam shows at the window border
		const bleed = f.inset * 0.5;
		g.roundRect(w.x - bleed, w.y - bleed, w.w + bleed * 2, w.h + bleed * 2, 6).fill(0x140a04);
		for (let col = 0; col < 5; col += 1) {
			for (let row = 0; row < 4; row += 1) {
				const x = w.x + col * (f.cell + f.gap);
				const y = w.y + row * (f.cell + f.gap);
				g.roundRect(x, y, f.cell, f.cell, 4)
					.fill(0x1a0f08)
					.stroke({ width: 1, color: 0xffffff, alpha: 0.035 });
			}
		}
	};
</script>

<Graphics draw={(g) => drawWells(g, frame, win)} />
<Sprite
	key="frameCafeteria"
	x={win.x - FRAME_ART.winX * sx}
	y={win.y - FRAME_ART.winY * sy}
	width={FRAME_ART.w * sx}
	height={FRAME_ART.h * sy}
/>
