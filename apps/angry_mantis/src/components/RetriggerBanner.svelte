<script lang="ts" module>
	export type EmitterEventRetrigger = { type: 'retriggerShow'; added: number; newTotalFs: number };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import ArtAmount from './ArtAmount.svelte';
	import { Container } from 'pixi-svelte';
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
			{#if added > 0}
				<ArtAmount text={`${added}+ FREE GAME${added === 1 ? '' : 'S'}`} height={56} maxWidth={620} />
			{:else}
				<ArtAmount text="EXTRA SPINS MAXED" height={40} maxWidth={560} />
			{/if}
		</Container>
	</MainContainer>
</FadeContainer>
