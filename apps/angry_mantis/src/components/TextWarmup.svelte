<script lang="ts">
	// Pre-warms Pixi's text-texture cache. CanvasTextSystem keys textures by text + style + resolution and
	// ref-counts them, so a permanently mounted instance of each FIXED presentation string keeps its texture
	// resident; when BonusIntro / FreeSpinOutro / Win / RetriggerBanner later mount the same string with the
	// same GameText preset+size, they hit the cache instead of rasterizing + uploading a big POT canvas
	// mid-play (the 100–150ms hitches traced at bonus intro and feature exit). Rendered far off-screen so the
	// quads exist (culling is off) but never show. Keep entries in sync with the components' presets/sizes.
	import { Container } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import GameText from './GameText.svelte';
	import { BONUS_MODE_LABEL } from '../game/constants';

	const modes = Object.values(BONUS_MODE_LABEL);
	const entries: { text: string; preset: 'gold' | 'silver'; size: number; extra?: Record<string, unknown> }[] = [
		// BonusIntro
		...modes.map((m) => ({ text: m, preset: 'gold' as const, size: 72 })),
		{ text: '8 FREE SPINS', preset: 'gold', size: 56 },
		{ text: '10 FREE SPINS', preset: 'gold', size: 56 },
		{ text: 'MARTY IS HUNGRY', preset: 'silver', size: 30 },
		{ text: 'MARKY IS HUNGRY', preset: 'silver', size: 30 },
		{ text: 'MARTY + MARKY STRIKE TOGETHER', preset: 'silver', size: 30 },
		{ text: 'EVERY GLOWING LEAF IS A STRIKE — MARTY EATS THE LOWEST SYMBOL LEFT AND IT LEAVES THE REELS', preset: 'silver', size: 19 },
		{ text: 'MARKY STRIKES MORE OFTEN — EVERY LEAF EATS THE LOWEST SYMBOL LEFT, ESCALATING WINS', preset: 'silver', size: 19 },
		{ text: 'BOTH MANTISES STRIKE — EAT ALL 8 SYMBOLS FOR THE 20,000\u00d7 MAX WIN \u00b7 PAYS AT LEAST 300\u00d7', preset: 'silver', size: 19 },
		// FreeSpinOutro + SessionSummary
		...modes.map((m) => ({ text: `${m} COMPLETE`, preset: 'gold' as const, size: 64 })),
		...modes.map((m) => ({ text: `${m} COMPLETE`, preset: 'gold' as const, size: 56 })),
		{ text: 'TOTAL WIN', preset: 'silver', size: 28, extra: { letterSpacing: 6 } },
		// Win tiers
		...['BIG WIN', 'SUPER WIN', 'MEGA WIN', 'EPIC WIN', 'MAX WIN'].map((t) => ({ text: t, preset: 'gold' as const, size: 110 })),
		// RetriggerBanner
		{ text: '+1 FREE SPIN', preset: 'gold', size: 64 },
		{ text: '+2 FREE SPINS', preset: 'gold', size: 64 },
		{ text: '+3 FREE SPINS', preset: 'gold', size: 64 },
		{ text: 'EXTRA SPINS MAXED', preset: 'silver', size: 44 },
		// Mantis choreography + max win
		{ text: 'CHOMP!', preset: 'gold', size: 36 },
		{ text: '...', preset: 'silver', size: 36 },
		{ text: 'MAX WIN!', preset: 'gold', size: 96 },
		{ text: 'EVERYTHING IS EATEN...', preset: 'gold', size: 56 },
		{ text: '20000X', preset: 'silver', size: 40 },
	];
</script>

<MainContainer>
	<Container x={-20000} y={-20000}>
		{#each entries as e (e.text + e.preset + e.size)}
			<GameText text={e.text} preset={e.preset} size={e.size} extra={e.extra ?? {}} />
		{/each}
	</Container>
</MainContainer>
