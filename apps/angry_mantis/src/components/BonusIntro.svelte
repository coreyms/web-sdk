<script lang="ts" module>
	import type { BonusMode, BonusHost } from '../game/types';

	export type EmitterEventBonusIntro =
		| { type: 'bonusIntroShow'; mode: BonusMode; host: BonusHost; totalFs: number }
		| { type: 'bonusIntroHide' };
</script>

<script lang="ts">
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { Sprite, Container } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import GameText from './GameText.svelte';
	import { BONUS_MODE_LABEL } from '../game/constants';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();

	let show = $state(false);
	let mode = $state<BonusMode>('free');
	let host = $state<BonusHost>('marty');
	let totalFs = $state(0);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		bonusIntroShow: async (emitterEvent) => {
			mode = emitterEvent.mode;
			host = emitterEvent.host;
			totalFs = emitterEvent.totalFs;
			show = true;
			// auto-advance after a short hold; a tap (PressToContinue) skips it
			await Promise.race([waitForResolve((resolve) => (oncomplete = resolve)), waitForTimeout(3800)]);
		},
		bonusIntroHide: () => (show = false),
	});

	const hosts = $derived(host === 'both' ? ['marky', 'marty'] : [host]); // Marky always left, Marty right

	// one-sentence "how it works" per mode (also warmed in TextWarmup — keep in sync)
	const MODE_DETAIL: Record<BonusMode, string> = {
		free: 'EVERY DINNER LEAF IS A STRIKE — MARTY EATS THE LOWEST SYMBOL LEFT AND IT LEAVES THE REELS',
		super: 'MARKY STRIKES MORE OFTEN — EVERY LEAF EATS THE LOWEST SYMBOL LEFT, ESCALATING WINS',
		feast: 'BOTH MANTISES STRIKE — EAT ALL 8 SYMBOLS FOR THE 20,000\u00d7 MAX WIN',
	};
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.7} />
	<MainContainer>
		{@const w = context.stateLayoutDerived.mainLayout().width}
		{@const h = context.stateLayoutDerived.mainLayout().height}
		<Container x={w * 0.5} y={h * 0.42} scale={Math.min(1, w / 800)}>
			<GameText
				y={-220}
				text={BONUS_MODE_LABEL[mode]}
			 preset="gold" size={72} />
			{#each hosts as name, i (name)}
				<Sprite
					anchor={0.5}
					x={(i - (hosts.length - 1) / 2) * 260}
					y={-40}
					width={220}
					height={220}
					key="{name}Headshot"
				/>
			{/each}
			<GameText
				y={150}
				text={`${totalFs} FREE SPINS`}
			 preset="gold" size={56} />
			<GameText
				y={215}
				text={mode === 'feast' ? 'MARTY + MARKY STRIKE TOGETHER' : mode === 'super' ? 'MARKY IS HUNGRY' : 'MARTY IS HUNGRY'}
			 preset="silver" size={30} />
			<GameText y={262} text={MODE_DETAIL[mode]} preset="silver" size={19} maxWidth={700} />
		</Container>
	</MainContainer>
	<PressToContinue onpress={() => oncomplete()} />
</FadeContainer>
