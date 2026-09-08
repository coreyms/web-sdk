<script lang="ts">
	// Active game-mode plaque on the reel frame's bottom border: mode name + the TRUE cost of one
	// spin press. Rendered in Pixi so it sits BEHIND the mantises (Corey 2026-08-26) — Marty's
	// antennae pass in front of it. Landscape keeps it just under the frame (no character there).
	import { MainContainer } from 'components-layout';
	import { Container, Rectangle, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { frameFor, layoutKind, FRAME_ART, HUD } from '../game/layoutSpec';
	import { modeChipData } from '../game/modeChipData';
	import { UI_NUM_FONT } from '../ui/uiMeasure';

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
	// Set in the HTML chrome's number face (Sora, white, weight 800), the same face the HUD amounts
	// and the play button use (Corey 2026-09-08: the stencil glyphs read poorly; the HUD's own face
	// is the standard). One PIXI.Text that changes only on arm / cancel / bet change — never per
	// frame (house rule 1). The border is the buttons' gold (#ffdc4a), not the old amber.
	// Sized to read like the old stencil label (cap 0.82 × size): Sora at 0.95 × size, weight 600
	// (Corey 2026-09-08: the first cut at 1.14 × size / 800 was too big and too bold on the rail).
	const fontSize = $derived(size * 0.95);
	const SHADOW = 1.5; // drop-shadow distance, px
	const style = $derived({
		fontFamily: UI_NUM_FONT,
		fontSize,
		fontWeight: '600' as const,
		fill: 0xffffff,
		letterSpacing: 0.5,
		dropShadow: { alpha: 0.7, blur: 0, distance: SHADOW, angle: Math.PI / 2, color: 0x000000 },
	});
	let textW = $state(0);
	// no pill without a label: an empty backing on the rail is worse than nothing
	const labelReady = $derived(!!chip && text.length > 0 && textW > 0);
	// tight pill (Corey 2026-09-08): about half a cap of air beside the label, a hair above and below
	const w = $derived(textW + (kind === 'portrait' ? 14 : 22));
	const h = $derived(size + (kind === 'portrait' ? 4 : 9));
	// anchor 0.5 centres the text's BOX (ascender line to descender + shadow), and Sora's box hangs
	// further below the caps than above them, so the caps ride high: push the text down so the caps,
	// not the box, sit on the rail's centre line (measured on the landscape capture 2026-09-08:
	// 1.3 px high at a 14 px font, i.e. 0.09 em)
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
		<!-- the thin border is back (Corey 2026-09-06): without it the pill reads as a plain dark bar;
		     it is the HUD buttons' gold so the chrome has one accent (Corey 2026-09-08) -->
		<Rectangle x={-w / 2} y={-h / 2} width={w} height={h} borderRadius={h / 2} backgroundColor={0x0a0602} alpha={0.85} borderWidth={1.5} borderColor={0xffdc4a} />
		{#key text}
			<Text {text} {style} anchor={0.5} x={0} y={fontSize * 0.09} onresize={({ width }) => (textW = width)} />
		{/key}
	</Container>
</MainContainer>
