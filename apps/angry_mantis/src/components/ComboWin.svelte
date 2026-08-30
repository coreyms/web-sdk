<script lang="ts" module>
	export type EmitterEventComboWin = { type: 'comboWinShow'; amount: number };
</script>

<script lang="ts">
	// Per-combo win amount (finishing-touches item 1): after a combo's symbols pulse (others dimmed
	// via winFocus), its amount pops over the board — STATIC, no count-up; the count-up is reserved
	// for the total. winInfo awaits this, so combos present strictly one after another.
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';
	import { Container } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { waitForTimeout } from 'utils-shared/wait';
	import { stateBetDerived } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import GameText from './GameText.svelte';
	import ArtAmount, { artAmountSupports } from './ArtAmount.svelte';

	const context = getContext();

	let amount = $state<number | null>(null);
	// near-instant in, quick out (Corey 2026-08-29: "snappy and fast")
	const pop = new Tween(0, { duration: 110, easing: backOut });

	context.eventEmitter.subscribeOnMount({
		comboWinShow: async (emitterEvent) => {
			amount = emitterEvent.amount;
			pop.set(0, { duration: 0 });
			pop.set(1);
			await waitForTimeout(320 / stateBetDerived.timeScale());
			await pop.set(0, { duration: 90 });
			amount = null;
		},
	});

	const layout = $derived(context.stateGameDerived.boardLayout());
</script>

{#if amount !== null}
	<MainContainer>
		<Container x={layout.x} y={layout.y} scale={pop.current * layout.scale}>
			{@const comboText = bookEventAmountToCurrencyString(amount)}
			<!-- stencil white, not gold: per-combo amounts read distinct from the gold tier/total text -->
			{#if artAmountSupports(comboText)}
				<ArtAmount text={comboText} height={64} maxWidth={480} />
			{:else}
				<GameText text={comboText} preset="silver" size={64} maxWidth={480} />
			{/if}
		</Container>
	</MainContainer>
{/if}
