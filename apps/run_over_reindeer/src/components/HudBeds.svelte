<script lang="ts">
	// THE HUD'S DARK BEDS (constants HUD_BED): flat dark bars in the canvas under the HUD zones that would otherwise
	// sit on snow, where the HUD's light ink cannot be read. A first pass stand-in for dark ground in the scene art
	// itself. Drawn over the board's picture and under the HTML HUD. Always mounted; a layout with no bed draws nothing.
	// THE GLASS HUD (ui/hud, 2026-11-15): the bottom bed's top edge is HUD_BED.bottom as before, or higher where the
	// HUD's own top (its highest readout, the Spin's top, the bar) comes within HUD_BED.hudPad CSS px of it, so every
	// readout and key stands on the bed; never above the board's bottom edge.
	// SCENE PASS 9: off with the snow scene (game/scenePresets.ts hudBeds false): the deeper glass and the dark readouts
	// read on the snow itself. The rule stays for a scene preset that wants beds.
	import { Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { HUD_BED } from '../game/constants';
	import { MASTER, layoutKind, landscapeExtraY, boardRect, isPhoneSizeType } from '../game/layoutSpec';
	import { hudFrame, portraitGeo, desktopGeo, readSafeInsets } from '../ui/hud/hudLayout';
	import { stateScene } from '../game/stateScene.svelte';

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
	// the HUD's top, canvas px (= CSS px: the canvas fills the viewport)
	const hudTop = $derived.by(() => {
		if (kind === 'phone') return canvas.height;
		const phone = isPhoneSizeType(context.stateLayoutDerived.canvasSizeType());
		const f = hudFrame({ kind, phone, vw: canvas.width, vh: canvas.height, safe: readSafeInsets() });
		if (kind === 'portrait') {
			const G = portraitGeo(f, 0);
			return Math.min(G.win.y, G.amt.y, G.spin.y, G.bar.y0) * f.u;
		}
		const G = desktopGeo(f, 0);
		return Math.min(G.spin.y, G.y0, G.win.y, G.bal.y) * f.u;
	});
	const boardBottom = $derived(masterTop + boardRect(kind).bottom * main.scale);
	const bottomEdge = $derived(
		kind === 'phone' ? canvas.height : Math.max(boardBottom, Math.min(masterTop + (HUD_BED.bottom[kind] + extra) * main.scale, hudTop - HUD_BED.hudPad)),
	);
	const line = $derived(Math.max(1, HUD_BED.edgeWidth * main.scale));
</script>

{#if kind !== 'phone' && stateScene.preset.hudBeds}
	<Rectangle x={0} y={0} width={canvas.width} height={Math.max(0, topEdge)} backgroundColor={HUD_BED.color} />
	<Rectangle x={0} y={topEdge - line} width={canvas.width} height={line} backgroundColor={HUD_BED.edge} />
	<Rectangle x={0} y={bottomEdge} width={canvas.width} height={Math.max(0, canvas.height - bottomEdge)} backgroundColor={HUD_BED.color} />
	<Rectangle x={0} y={bottomEdge} width={canvas.width} height={line} backgroundColor={HUD_BED.edge} />
{/if}
