<script lang="ts">
	// Big-win tier title, set letter by letter from Corey's branded glyph atlas (BrandedTitle).
	// The label starts at BIG WIN and upgrades (SUPER -> MEGA -> EPIC -> MAX) as the counting
	// amount crosses each math tier bar, capped at the tier the book awarded. Motion picked in the
	// title motion lab (Corey 2026-09-05): the first title SLAMS in (letters drop and settle), every
	// upgrade is a SPLIT-FLAP — the old letters fold away in turn while the new ones flap in behind
	// them — and each tier's idle gets livelier than the last (BrandedTitle's `tier`).
	// Pure transforms + additive copies: nothing rasterizes, nothing filters (iOS-safe).
	import { Container } from 'pixi-svelte';
	import { bookEventAmountToBetAmountMultiplier } from 'utils-shared/amount';

	import BrandedTitle, { type BrandedEntrance } from './BrandedTitle.svelte';
	import { WIN_TIER_STAGES, type WinTierStage } from '../game/winLevelMap';
	import { getContext } from '../game/context';

	const context = getContext();
	// Every tier title that lands gets the slam stinger — the first entrance included. This component
	// only ever mounts inside a big-tier presentation (Win.svelte's isBigWin branch and
	// FreeSpinOutro's), so it needs no win-level guard of its own.
	// forcePlay: the clip runs 1 s but consecutive tiers can land closer than that, and the once-player
	// silently drops a re-play of a still-ringing sound — without it the fast upgrades go mute.
	const slamSound = () =>
		context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_win_big', forcePlay: true });

	type Props = { amount: number; finalAlias: string; stages?: readonly WinTierStage[]; size?: number; y?: number };
	const { amount, finalAlias, stages = WIN_TIER_STAGES, size = 110, y = 0 }: Props = $props();

	// `size` was the old text font size; the gold art it drove stood ~1.05× that in cap height
	const capHeight = $derived(size * 1.05);

	const capIndex = $derived(Math.max(0, stages.findIndex((s) => s.alias === finalAlias)));
	const stageIndex = $derived.by(() => {
		const xBet = bookEventAmountToBetAmountMultiplier(amount);
		let i = 0;
		while (i < capIndex && xBet >= stages[i + 1].xBet) i++;
		return i;
	});

	let shownIndex = $state(0);
	let outgoingIndex = $state<number | null>(null);
	let entrance = $state<BrandedEntrance>('slam');
	let enterDelay = $state(0);

	let lastIndex = -1;
	$effect(() => {
		const next = stageIndex;
		if (lastIndex === -1) {
			shownIndex = next; // first render: the letters slam in
			slamSound();
		} else if (next !== lastIndex) {
			// upgrade: the shown title folds away (split-flap) as the next flaps in 140 ms behind it
			outgoingIndex = shownIndex;
			shownIndex = next;
			entrance = 'flap';
			enterDelay = 140;
			slamSound();
		}
		lastIndex = next;
	});
</script>

<Container {y}>
	{#if outgoingIndex !== null}
		<BrandedTitle lines={[stages[outgoingIndex].title]} height={capHeight} tier={outgoingIndex} phase="exit" onexited={() => (outgoingIndex = null)} />
	{/if}
	{#key shownIndex}
		<BrandedTitle lines={[stages[shownIndex].title]} height={capHeight} tier={shownIndex} phase="enter" {entrance} {enterDelay} glint />
	{/key}
</Container>
