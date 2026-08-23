<script lang="ts" module>
	import type { PayingSymbolName } from '../game/types';

	export type EmitterEventPoolHud = { type: 'poolRemove'; symbol: PayingSymbolName };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { Sprite, Container } from 'pixi-svelte';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import GameText from './GameText.svelte';
	import config from '../game/config';
	import { TIMINGS } from '../game/constants';
	import { HUD, layoutKind } from '../game/layoutSpec';

	const context = getContext();
	const CELL = 62;

	context.eventEmitter.subscribeOnMount({
		poolRemove: async () => {
			await waitForTimeout(TIMINGS.eat / 2);
		},
	});
</script>

{#if context.stateGame.gameType === 'freegame'}
	<MainContainer>
		{@const hud = HUD[layoutKind(context.stateLayoutDerived.layoutType())].pool}
		{@const rows = Math.ceil(config.eatOrder.length / hud.cols)}
		<Container x={hud.x} y={hud.y}>
			<GameText anchor={{ x: 0.5, y: 1 }} y={-(rows * hud.cell) / 2 - 4} text="ON THE MENU" preset="gold" size={Math.round(hud.cell * (hud.cols > 4 ? 0.36 : 0.45))} />
			{#each config.eatOrder as symbol, i (symbol)}
				{@const eaten = !context.stateGame.symbolPool.includes(symbol)}
				<Sprite
					anchor={0.5}
					x={((i % hud.cols) - (hud.cols - 1) / 2) * hud.cell}
					y={(Math.floor(i / hud.cols) - (rows - 1) / 2) * hud.cell}
					width={hud.cell - 8}
					height={hud.cell - 8}
					key={eaten ? `${symbol}_eaten.png` : `${symbol}.png`}
					alpha={eaten ? 0.5 : 1}
				/>
			{/each}
		</Container>
	</MainContainer>
{/if}
