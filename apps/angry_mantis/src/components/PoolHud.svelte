<script lang="ts" module>
	import type { PayingSymbolName } from '../game/types';

	export type EmitterEventPoolHud =
		| { type: 'poolRemove'; symbol: PayingSymbolName }
		// ON THE MENU glow: on when a dinner leaf lands, off once the mantis has eaten the last
		// struck leaf of the spin (Corey 2026-09-05)
		| { type: 'menuGlow'; on: boolean };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { Sprite, Container } from 'pixi-svelte';

	import BrandedTitle from './BrandedTitle.svelte';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import config from '../game/config';
	import { TIMINGS } from '../game/constants';
	import { HUD, layoutKind } from '../game/layoutSpec';

	const context = getContext();
	const CELL = 62;

	// Always-mounted (persistent FadeContainer): a `{#if gameType === 'freegame'}` mount joined
	// the stage LAST — above the presentation layers that follow PoolHud in Game.svelte
	// (conditional-mount z-order trap) — and blinked out at freeSpinEnd's gameType flip while the
	// summary/outro were still presenting on the closed door. Show tracks the freegame flip
	// (mid-intro, behind the closed door — the same moment it used to mount); hide waits for the
	// door roll-up that returns to the base game, so the pool rides under the summary + outro.
	let shown = $state(false);
	let menuGlow = $state(false);

	$effect(() => {
		if (context.stateGame.gameType === 'freegame') shown = true;
	});

	context.eventEmitter.subscribeOnMount({
		menuGlow: ({ on }) => (menuGlow = on),
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
			<!-- ON THE MENU set from the branded glyphs (width capped at the 7.2 em the old art took);
			     it glows from a dinner-leaf landing until the mantis finishes eating -->
			{@const size = Math.round(hud.cell * (hud.cols > 4 ? 0.36 : 0.45))}
			<BrandedTitle lines={['ON THE MENU']} height={size * 0.95} maxWidth={size * 7.2} y={-(rows * hud.cell) / 2 + 3 - size * 0.62} glow={menuGlow} />
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
