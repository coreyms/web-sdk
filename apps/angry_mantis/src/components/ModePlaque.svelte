<script lang="ts">
	// Active game-mode plaque on the reel frame's bottom border: mode name + the TRUE cost of one
	// spin press. Rendered in Pixi so it sits BEHIND the mantises (Corey 2026-08-26) — Marty's
	// antennae pass in front of it. Landscape keeps it just under the frame (no character there).
	import { MainContainer } from 'components-layout';
	import { Container, Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { frameFor, layoutKind } from '../game/layoutSpec';
	import { modeChipData } from '../game/modeChipData';
	import GameText from './GameText.svelte';

	const context = getContext();
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const vw = $derived(
		context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale,
	);
	const f = $derived(frameFor(kind, vw));
	const chip = $derived(modeChipData());
	const size = $derived(kind === 'phone' ? 18 : 15);
	// fallback must be a real string: a PIXI.Text born from whitespace-only never renders later updates
	const text = $derived(chip ? `${chip.label}  ·  ${chip.cost} / SPIN` : 'MODE');
	// pill sized from an average glyph width — the display font has no monospace metrics to query
	const w = $derived(text.length * size * 0.62 + 40);
	const h = $derived(size + 16);
	// fully below the frame — never over a board tile; the mantises draw in front of it
	const y = $derived(f.y + f.height + (kind === 'landscape' ? 8 : 4));
</script>

<!-- ALWAYS mounted (visibility-toggled): an {#if} would add the Pixi nodes to the stage the moment
     a mode is armed — i.e. AFTER the characters — putting the plaque in front of Marty. Mounting at
     boot pins its stage position: over the board frame, under the mantises. -->
<MainContainer>
	<Container visible={!!chip} x={f.x + f.width / 2} y={y + h / 2}>
		<Rectangle
			x={-w / 2}
			y={-h / 2}
			width={w}
			height={h}
			borderRadius={h / 2}
			backgroundColor={0x0a0602}
			alpha={0.85}
			borderWidth={1.5}
			borderColor={0xe8b04a}
		/>
		<!-- keyed: a PIXI.Text updated while its container is invisible keeps its old glyphs, so
		     rebuild the node when the label changes (rare — only on arm/cancel/bet change) -->
		{#key text}
			<GameText {text} preset="gold" size={size} extra={{ letterSpacing: 1.6 }} />
		{/key}
	</Container>
</MainContainer>
