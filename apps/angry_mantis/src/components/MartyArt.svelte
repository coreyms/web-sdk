<script lang="ts" module>
	import type { RigReaction } from '../game/constants';

	export type MartyReaction = RigReaction;
	export type EmitterEventMartyArt = { type: 'martyReact'; kind: MartyReaction };
</script>

<script lang="ts">
	// Base-game Marty, bottom-right behind the controls — the BoneRutter rig (idle loop + reaction
	// clips) replacing the static illustration + tween wiggles. Hidden while the bonus-session
	// mantises (Mantis.svelte) are on stage.
	import * as PIXI from 'pixi.js';
	import { Container } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';

	import { getContext } from '../game/context';
	import { MARTY, layoutKind } from '../game/layoutSpec';
	import { RIG } from '../game/constants';
	import type { Rig } from '../bonerutter';
	import { playClip, playIdle, currentClip, isIdling } from '../game/mantisRig';
	import BoneRig from './BoneRig.svelte';

	const context = getContext();
	const place = $derived(MARTY[layoutKind(context.stateLayoutDerived.layoutType())]);
	const show = $derived(context.stateGame.gameType === 'basegame');

	let rig = $state<Rig | null>(null);
	let busy = false;

	const react = (kind: MartyReaction) => {
		if (busy || !show || !rig) return;
		busy = true;
		const pool = RIG.reactions[kind];
		playClip(rig, pool[Math.floor(Math.random() * pool.length)], {
			loop: false,
			onComplete: () => {
				busy = false;
				if (rig) playIdle(rig);
			},
		});
	};

	// scatter anticipation: while a reel is teasing, Marty leans in (Anticipation loop) instead of
	// idling; hands back to an idle the moment the tease resolves. Never interrupts a reaction.
	const anticipating = $derived(context.stateGame.board.some((reel) => reel.reelState.anticipating));
	$effect(() => {
		if (!rig || busy || !show) return;
		if (anticipating && isIdling(rig)) playClip(rig, RIG.anticipation, { loop: true });
		else if (!anticipating && currentClip(rig) === RIG.anticipation) playIdle(rig);
	});

	context.eventEmitter.subscribeOnMount({ martyReact: ({ kind }) => react(kind) });
	const poke = () => {
		if (!context.stateXstateDerived.isIdle()) return;
		react('poke');
	};
	// the rig is a loose cloud of sprites — a fixed square hit area (the old sprite's footprint)
	// keeps the poke target predictable and >= 44px
	const hitArea = $derived(new PIXI.Rectangle(-place.size / 2, -place.size / 2, place.size, place.size));
</script>

<FadeContainer {show} duration={400}>
	<Container
		x={place.x}
		y={place.y}
		{hitArea}
		eventMode={context.stateXstateDerived.isIdle() ? 'static' : 'none'}
		cursor="pointer"
		onpointerup={poke}
	>
		<BoneRig bind:rig size={place.size} />
	</Container>
</FadeContainer>
