<script lang="ts">
	// Big-win tier title that climbs with the count-up: the label starts at BIG WIN and upgrades
	// (SUPER -> MEGA -> EPIC -> MAX) the moment the counting amount crosses each math tier bar,
	// capped at the tier the book actually awarded. Each upgrade re-pops just the title; the
	// parent's own intro pop still animates the whole block in.
	import { Container } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';
	import { bookEventAmountToBetAmountMultiplier } from 'utils-shared/amount';

	import GameText from './GameText.svelte';
	import { WIN_TIER_STAGES } from '../game/winLevelMap';

	type Props = { amount: number; finalAlias: string; size?: number; y?: number };
	const { amount, finalAlias, size = 110, y = 0 }: Props = $props();

	const pop = new Tween(1, { duration: 380, easing: backOut });

	const capIndex = $derived(Math.max(0, WIN_TIER_STAGES.findIndex((s) => s.alias === finalAlias)));
	const stageIndex = $derived.by(() => {
		const xBet = bookEventAmountToBetAmountMultiplier(amount);
		let i = 0;
		while (i < capIndex && xBet >= WIN_TIER_STAGES[i + 1].xBet) i++;
		return i;
	});

	let lastIndex = -1;
	$effect(() => {
		if (lastIndex !== -1 && stageIndex !== lastIndex) {
			pop.set(0.55, { duration: 0 });
			pop.set(1);
		}
		lastIndex = stageIndex;
	});
</script>

<Container {y} scale={pop.current}>
	<GameText text={WIN_TIER_STAGES[stageIndex].title} preset="gold" {size} />
</Container>
