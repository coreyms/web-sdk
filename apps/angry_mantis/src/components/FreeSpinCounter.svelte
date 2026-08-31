<script lang="ts" module>
	export type EmitterEventFreeSpinCounter =
		| { type: 'freeSpinCounterShow' }
		| { type: 'freeSpinCounterHide' }
		| { type: 'freeSpinCounterUpdate'; current?: number; total?: number };
</script>

<script lang="ts">
	// Own free-spin counter: a dark pill with FREE SPIN + "current / total" in the HUD slot (layoutSpec).
	import { Container, Rectangle } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';

	import { getContext } from '../game/context';
	import { HUD, layoutKind } from '../game/layoutSpec';
	import GameText from './GameText.svelte';

	const context = getContext();
	const slot = $derived(HUD[layoutKind(context.stateLayoutDerived.layoutType())].fsCounter);
	const W = 220;
	const H = 72;

	let show = $state(false);
	let current = $state(0);
	let total = $state(0);

	context.eventEmitter.subscribeOnMount({
		freeSpinCounterShow: () => (show = true),
		freeSpinCounterHide: () => (show = false),
		freeSpinCounterUpdate: (emitterEvent) => {
			if (emitterEvent.current !== undefined) current = emitterEvent.current;
			if (emitterEvent.total !== undefined) total = emitterEvent.total;
		},
	});
</script>

<!-- persistent: claims its Game.svelte slot at game start (z-order trap — a lazy mount at
     freeSpinCounterShow time would join the stage LAST, above the win presentations) -->
<FadeContainer persistent {show}>
	<MainContainer>
		<Container x={slot.x} y={slot.y} scale={slot.scale}>
			<Rectangle width={W} height={H} borderRadius={14} backgroundColor={0x000000} alpha={0.55} borderWidth={2} borderColor={0xffdc4a} />
			<GameText text="FREE SPIN" preset="gold" size={16} x={W / 2} y={18} extra={{ letterSpacing: 3 }} />
			<!-- keyed: the trigger's first counterUpdate lands before the fade-in frame, and a
			     PIXI.Text updated while its container is invisible keeps its old glyphs -->
			{#key `${current}/${total}`}
				<GameText text={`${current} / ${total}`} preset="silver" size={28} x={W / 2} y={48} />
			{/key}
		</Container>
	</MainContainer>
</FadeContainer>
