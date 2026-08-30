<script lang="ts" module>
	export type EmitterEventRetrigger = { type: 'retriggerShow'; added: number; newTotalFs: number };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import GameText from './GameText.svelte';
	import { Container, Sprite } from 'pixi-svelte';
	import { TIMINGS } from '../game/constants';

	const context = getContext();
	let show = $state(false);
	let added = $state(0);

	context.eventEmitter.subscribeOnMount({
		retriggerShow: async (emitterEvent) => {
			added = emitterEvent.added;
			show = true;
			await waitForTimeout(TIMINGS.retrigger);
			show = false;
		},
	});
</script>

<FadeContainer {show}>
	<MainContainer>
		<Container
			x={context.stateLayoutDerived.mainLayout().width * 0.5}
			y={context.stateLayoutDerived.mainLayout().height * 0.5}
			scale={Math.min(1, context.stateLayoutDerived.mainLayout().width / 800)}
		>
			{#if added >= 1 && added <= 3}
				<!-- composed from the gold art: [+][digit]  [FREE GAME(S)] — digits render at a common
				     display height (digit-1 was exported half-size; height-normalizing absorbs it) -->
				{@const DIGIT_H = 92}
				{@const WORD_H = 64}
				{@const digit = ['textDigit1', 'textDigit2', 'textDigit3'][added - 1]}
				{@const digitW = [94 / 168, 240 / 336, 220 / 336][added - 1] * DIGIT_H}
				{@const plusW = (270 / 336) * DIGIT_H}
				{@const wordNat = added === 1 ? { key: 'textFreeGame', ratio: 800 / 180 } : { key: 'textFreeGames', ratio: 800 / 168 }}
				{@const wordW = wordNat.ratio * WORD_H}
				{@const total = plusW + 10 + digitW + 26 + wordW}
				<Sprite key="textPlus" anchor={0.5} x={-total / 2 + plusW / 2} height={DIGIT_H} width={plusW} />
				<Sprite key={digit} anchor={0.5} x={-total / 2 + plusW + 10 + digitW / 2} height={DIGIT_H} width={digitW} />
				<Sprite key={wordNat.key} anchor={0.5} x={total / 2 - wordW / 2} height={WORD_H} width={wordW} />
			{:else if added > 3}
				<GameText text={`+${added} FREE GAMES`} preset="gold" size={64} />
			{:else}
				<GameText text="EXTRA SPINS MAXED" preset="silver" size={44} />
			{/if}
		</Container>
	</MainContainer>
</FadeContainer>
