<script lang="ts">
	// THE HUD'S DARK BEDS (constants HUD_BED): flat dark bars in the canvas under the HUD zones that would otherwise
	// sit on snow, where the house HUD's white and gold ink cannot be read. A first pass stand-in for dark ground in
	// the scene art itself. Drawn over the board's picture and under the HTML HUD. Always mounted; a layout with no
	// bed draws nothing.
	import { Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { HUD_BED } from '../game/constants';
	import { MASTER, layoutKind, landscapeExtraY } from '../game/layoutSpec';

	const context = getContext();
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	// master y -> canvas y
	const masterTop = $derived(main.y - (main.height * main.scale) / 2);
	// how far the HUD's rows ride toward the screen's edges on a screen taller than the master (ui/Chrome.svelte)
	const extra = $derived(kind === 'portrait' ? Math.max(0, (canvas.height / main.scale - MASTER.portrait.height) / 2) : kind === 'landscape' ? landscapeExtraY(canvas.height / main.scale) : 0);
	// the clock strip rides up with the letterbox on desktop only; the portrait one keeps its master place
	const topEdge = $derived(kind === 'phone' ? 0 : masterTop + (HUD_BED.top[kind] - (kind === 'landscape' ? extra : 0)) * main.scale);
	const bottomEdge = $derived(kind === 'phone' ? canvas.height : masterTop + (HUD_BED.bottom[kind] + extra) * main.scale);
	const line = $derived(Math.max(1, HUD_BED.edgeWidth * main.scale));
</script>

{#if kind !== 'phone'}
	<Rectangle x={0} y={0} width={canvas.width} height={Math.max(0, topEdge)} backgroundColor={HUD_BED.color} />
	<Rectangle x={0} y={topEdge - line} width={canvas.width} height={line} backgroundColor={HUD_BED.edge} />
	<Rectangle x={0} y={bottomEdge} width={canvas.width} height={Math.max(0, canvas.height - bottomEdge)} backgroundColor={HUD_BED.color} />
	<Rectangle x={0} y={bottomEdge} width={canvas.width} height={line} backgroundColor={HUD_BED.edge} />
{/if}
