<script lang="ts" module>
	import type { PayingSymbolName } from '../game/types';

	export type EmitterEventPoolHud = { type: 'poolRemove'; symbol: PayingSymbolName };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { Sprite, Container } from 'pixi-svelte';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import config from '../game/config';
	import { TIMINGS } from '../game/constants';
	import { HUD, layoutKind } from '../game/layoutSpec';

	const context = getContext();
	const CELL = 62;
	const ON_THE_MENU_ART = { w: 300, h: 51 };

	// Always-mounted (persistent FadeContainer): a `{#if gameType === 'freegame'}` mount joined
	// the stage LAST — above the presentation layers that follow PoolHud in Game.svelte
	// (conditional-mount z-order trap) — and blinked out at freeSpinEnd's gameType flip while the
	// summary/outro were still presenting on the closed door. Show tracks the freegame flip
	// (mid-intro, behind the closed door — the same moment it used to mount); hide waits for the
	// door roll-up that returns to the base game, so the pool rides under the summary + outro.
	let shown = $state(false);

	$effect(() => {
		if (context.stateGame.gameType === 'freegame') shown = true;
	});

	context.eventEmitter.subscribeOnMount({
		poolRemove: async () => {
			await waitForTimeout(TIMINGS.eat / 2);
		},
		// bonusStart's doorOpen reveals the free board (gameType already 'freegame' — stays up);
		// freeSpinEnd's doorOpen reveals the base board — the pool fades as the door rises
		doorOpen: () => {
			if (context.stateGame.gameType !== 'freegame') shown = false;
		},
	});
</script>

<FadeContainer persistent show={shown}>
	<MainContainer>
		{@const hud = HUD[layoutKind(context.stateLayoutDerived.layoutType())].pool}
		{@const rows = Math.ceil(config.eatOrder.length / hud.cols)}
		<Container x={hud.x} y={hud.y}>
			<!-- Corey's ON THE MENU art in place of the old gold GameText; width tracks the text size it
			     replaced (11 caps at ~0.65 em each ≈ 7.2× the font size), height from the art's aspect -->
			{@const size = Math.round(hud.cell * (hud.cols > 4 ? 0.36 : 0.45))}
			<Sprite key="textOnTheMenu" anchor={{ x: 0.5, y: 1 }} y={-(rows * hud.cell) / 2 + 3} width={size * 7.2} height={(size * 7.2) * ON_THE_MENU_ART.h / ON_THE_MENU_ART.w} />
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
</FadeContainer>
