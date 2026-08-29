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

	const context = getContext();

	let amount = $state<number | null>(null);
	const pop = new Tween(0, { duration: 260, easing: backOut });

	context.eventEmitter.subscribeOnMount({
		comboWinShow: async (emitterEvent) => {
			amount = emitterEvent.amount;
			pop.set(0, { duration: 0 });
			pop.set(1);
			await waitForTimeout(700 / stateBetDerived.timeScale());
			await pop.set(0, { duration: 140 });
			amount = null;
		},
	});

	const layout = $derived(context.stateGameDerived.boardLayout());
</script>

{#if amount !== null}
	<MainContainer>
		<Container x={layout.x} y={layout.y} scale={pop.current * layout.scale}>
			<GameText text={bookEventAmountToCurrencyString(amount)} preset="gold" size={64} maxWidth={480} />
		</Container>
	</MainContainer>
{/if}
