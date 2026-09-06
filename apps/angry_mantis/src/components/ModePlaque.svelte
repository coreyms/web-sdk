<script lang="ts">
	// Active game-mode plaque on the reel frame's bottom border: mode name + the TRUE cost of one
	// spin press. Rendered in Pixi so it sits BEHIND the mantises (Corey 2026-08-26) — Marty's
	// antennae pass in front of it. Landscape keeps it just under the frame (no character there).
	import { MainContainer } from 'components-layout';
	import { Container, Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { frameFor, layoutKind, FRAME_ART, HUD } from '../game/layoutSpec';
	import { modeChipData } from '../game/modeChipData';
	import { layoutStencil } from '../game/stencilLayout';
	import StencilText from './StencilText.svelte';

	const context = getContext();
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const vw = $derived(
		context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale,
	);
	const f = $derived(frameFor(kind, vw));
	const chip = $derived(modeChipData());
	// Badge centered on the counter's bottom rail (Corey 2026-08-30) — in the art, the rail reads
	// top face (y ~1121-1142) / highlight seam / front face (y 1149-1208). WHICH band it rides is
	// per-LayoutKind (HUD[kind].modePlaque.railArtY): landscape and portrait keep the front face;
	// phone-sideways sits higher because its HTML stats strip owns the front face. The anchor is an
	// art-space y so portrait's frameFor()-expanded frame keeps it on the rail.
	const railArtY = $derived(HUD[kind].modePlaque.railArtY);
	const CENTER_BELOW_WINDOW = $derived(railArtY - (FRAME_ART.winY + FRAME_ART.winH)); // art px
	const FACE_H_ART = 1208 - 1149; // front-face band height in art px
	const railSy = $derived((f.height - 2 * f.inset) / FRAME_ART.winH);
	const railTop = $derived(f.y + f.height - f.inset);
	const centerY = $derived(railTop + CENTER_BELOW_WINDOW * railSy);
	const faceH = $derived(FACE_H_ART * railSy); // front face in master px (~28.4 landscape, ~35.5 phone, ~17 portrait)
	// Landscape (15+16=31) and phone (18+16=34) keep their proven fixed pills — phone's face (~35.5)
	// still contains its pill. Portrait's face is only ~17 master px, so the pill derives from the
	// face (~85% of it) with tighter padding to sit INSIDE the front face; text size is floored at
	// 9 master px for readability (the floored 15px pill still fits the ~17px band).
	const size = $derived(kind === 'phone' ? 18 : kind === 'landscape' ? 15 : Math.max(9, Math.round(faceH * 0.85) - 6));
	const text = $derived(chip ? `${chip.label}  ·  ${chip.cost} / SPIN` : '');
	// Set from the prison-stencil numerals atlas (game/stencilLayout), the same face the amounts
	// use: batched sprites, no PIXI.Text, no gradient fill — the gradient-text plaque was the
	// "standard font + gradient + border" triple Stake's quality page names (review 2026-09-05).
	// The block is laid out synchronously, so the pill's width is exact on the first frame.
	const cap = $derived(size * 0.82);
	const block = $derived(layoutStencil({ parts: [{ text, face: 'white' }], cap }));
	// no pill without glyphs: an empty backing on the rail is worse than nothing
	const labelReady = $derived(!!chip && block.complete && block.width > 0);
	const w = $derived(block.width + (kind === 'portrait' ? 24 : 40));
	const h = $derived(size + (kind === 'portrait' ? 6 : 16));
</script>

<!-- ALWAYS mounted (visibility-toggled): an {#if} would add the Pixi nodes to the stage the moment
     a mode is armed — i.e. AFTER the characters — putting the plaque in front of Marty. Mounting at
     boot pins its stage position: over the board frame, under the mantises. -->
<MainContainer>
	<Container visible={labelReady} x={f.x + f.width / 2} y={centerY}>
		<!-- keyed TOGETHER: a PIXI.Text updated while its container is invisible keeps its old
		     glyphs, so the node is rebuilt when the label changes (rare — arm/cancel/bet change),
		     and the backing rebuilds with it so the two can never be out of step; the fresh Text's
		     onresize re-reports the measurement the pill width derives from -->
		<Rectangle x={-w / 2} y={-h / 2} width={w} height={h} borderRadius={h / 2} backgroundColor={0x0a0602} alpha={0.85} />
		{#if labelReady}
			<StencilText {block} x={0} y={-cap / 2} tint={0xf2c14e} />
		{/if}
	</Container>
</MainContainer>
