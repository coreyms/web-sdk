<script lang="ts">
	// Big-win tier title on Corey's gold 3D text art. The label starts at BIG WIN and upgrades
	// (SUPER -> MEGA -> EPIC -> MAX) as the counting amount crosses each math tier bar, capped at
	// the tier the book awarded. Each upgrade is a SLAM: the new title drops in oversized and
	// crushes the old one off screen (it tumbles away), landing with a squash bounce and a short
	// shake. Pure transforms + alpha — nothing rasterizes, nothing filters (iOS-safe).
	import { Container, Sprite } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicIn, cubicOut, backOut } from 'svelte/easing';
	import { waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToBetAmountMultiplier } from 'utils-shared/amount';

	import { WIN_TIER_STAGES, type WinTierStage } from '../game/winLevelMap';

	type Props = { amount: number; finalAlias: string; stages?: readonly WinTierStage[]; size?: number; y?: number };
	const { amount, finalAlias, stages = WIN_TIER_STAGES, size = 110, y = 0 }: Props = $props();

	// art is 800px wide; at the old font size 110 the title spanned ~615px, so scale = size/143
	const artScale = $derived(size / 143);

	const capIndex = $derived(Math.max(0, stages.findIndex((s) => s.alias === finalAlias)));
	const stageIndex = $derived.by(() => {
		const xBet = bookEventAmountToBetAmountMultiplier(amount);
		let i = 0;
		while (i < capIndex && xBet >= stages[i + 1].xBet) i++;
		return i;
	});

	let shownIndex = $state(0);
	let outgoing = $state<string | null>(null); // assetKey of the title being knocked away
	const slam = new Tween(1); // incoming scale multiplier
	const squash = new Tween({ x: 1, y: 1 });
	const shake = new Tween({ x: 0, y: 0 });
	const out = new Tween({ x: 0, y: 0, rot: 0, alpha: 1 });

	let animGen = 0;
	const slamTo = async (next: number) => {
		const gen = ++animGen;
		outgoing = stages[shownIndex].assetKey;
		shownIndex = next;
		// old title tumbles off down-left while the new one crushes it from above
		out.set({ x: 0, y: 0, rot: 0, alpha: 1 }, { duration: 0 });
		out.set({ x: -230, y: 190, rot: -0.45, alpha: 0 }, { duration: 420, easing: cubicIn });
		slam.set(2.4, { duration: 0 });
		await slam.set(1, { duration: 150, easing: cubicIn });
		if (gen !== animGen) return;
		// impact: squash bounce + a quick dying shake
		squash.set({ x: 1.1, y: 0.86 }, { duration: 60, easing: cubicOut }).then(() => {
			if (gen === animGen) squash.set({ x: 1, y: 1 }, { duration: 160, easing: backOut });
		});
		for (const mag of [6, 4, 2]) {
			shake.set({ x: (Math.random() - 0.5) * 2 * mag, y: mag }, { duration: 34 });
			await waitForTimeout(34);
			shake.set({ x: 0, y: 0 }, { duration: 34 });
			await waitForTimeout(34);
			if (gen !== animGen) return;
		}
		await waitForTimeout(200);
		if (gen === animGen) outgoing = null;
	};

	let lastIndex = -1;
	$effect(() => {
		const next = stageIndex;
		if (lastIndex === -1) {
			shownIndex = next; // first render: no slam, the parent pops the whole block in
		} else if (next !== lastIndex) {
			slamTo(next);
		}
		lastIndex = next;
	});
</script>

<Container y={y + shake.current.y} x={shake.current.x}>
	<!-- outgoing stays MOUNTED (visible-toggled): an {#if} would add it to the stage the moment a
	     slam starts — i.e. AFTER the incoming sprite below — putting the OLD title on top of the
	     new slam (conditional-mount z-order trap; DoorSteel/Mantis precedent) -->
	<Sprite
		key={outgoing ?? stages[shownIndex].assetKey}
		visible={outgoing !== null}
		anchor={0.5}
		x={out.current.x}
		y={out.current.y}
		rotation={out.current.rot}
		alpha={out.current.alpha}
		scale={artScale}
	/>
	<Sprite
		key={stages[shownIndex].assetKey}
		anchor={0.5}
		scale={{ x: artScale * slam.current * squash.current.x, y: artScale * slam.current * squash.current.y }}
	/>
</Container>
