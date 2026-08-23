<script lang="ts" module>
	import type { Position } from '../game/types';

	export type EmitterEventAnteLock = { type: 'anteLockShow'; position: Position };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { Sprite, Container } from 'pixi-svelte';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, TIMINGS } from '../game/constants';
	import { getSymbolX, getSymbolY } from '../game/utils';

	const context = getContext();
	let position = $state<Position | null>(null);

	context.eventEmitter.subscribeOnMount({
		anteLockShow: async ({ position: p }) => {
			position = p;
			await waitForTimeout(TIMINGS.anteLock);
		},
	});

	const visible = $derived(context.stateGame.anteLocked && context.stateGame.gameType === 'basegame');
</script>

{#if visible && position}
	<MainContainer>
		{@const layout = context.stateGameDerived.boardLayout()}
		<Container x={layout.x - layout.pivot.x * layout.scale} y={layout.y - layout.pivot.y * layout.scale} scale={layout.scale}>
			<Sprite
				anchor={0.5}
				x={getSymbolX(position.reel)}
				y={getSymbolY(position.row - 1)}
				width={SYMBOL_SIZE * 0.4}
				height={SYMBOL_SIZE * 0.4}
				key="lock.png"
				alpha={0.9}
			/>
		</Container>
	</MainContainer>
{/if}
