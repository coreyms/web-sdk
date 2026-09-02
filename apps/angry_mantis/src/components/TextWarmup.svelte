<script lang="ts">
	// Pre-warms Pixi's text-texture cache. CanvasTextSystem keys textures by text + style + resolution and
	// ref-counts them, so a permanently mounted instance of each FIXED presentation string keeps its texture
	// resident; when BonusIntro / FreeSpinOutro / Win later mount the same string with the
	// same GameText preset+size, they hit the cache instead of rasterizing + uploading a big POT canvas
	// mid-play (the 100–150ms hitches traced at bonus intro and feature exit). Rendered far off-screen so the
	// quads exist (culling is off) but never show. Keep entries in sync with the components' presets/sizes.
	// (Mode headers and win tiers are atlas sprite art now — only styled GameText needs warming here.)
	import { Container } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import GameText from './GameText.svelte';

	const entries: { text: string; preset: 'gold' | 'silver'; size: number; extra?: Record<string, unknown> }[] = [
		// BonusIntro contributes NOTHING here any more (2026-09-01): the bonus board is Corey's
		// header/free-spin art plus glyph sprites off the numerals + gold-alphabet atlases, so
		// there is no styled text on that screen to keep resident.
		// FreeSpinOutro (merged wrap-up)
		{ text: 'TOTAL WIN', preset: 'silver', size: 28, extra: { letterSpacing: 6 } },
		// Mantis choreography + max win
		{ text: '...', preset: 'silver', size: 36 },
	];
</script>

<MainContainer>
	<Container x={-20000} y={-20000}>
		{#each entries as e (e.text + e.preset + e.size)}
			<GameText text={e.text} preset={e.preset} size={e.size} extra={e.extra ?? {}} />
		{/each}
	</Container>
</MainContainer>
