<script lang="ts" module>
	import type { RigReaction } from '../game/constants';

	export type MartyReaction = RigReaction;
	export type EmitterEventMartyArt =
		| { type: 'martyReact'; kind: MartyReaction }
		| { type: 'martyWalkOut' };
</script>

<script lang="ts">
	// Base-game Marty, bottom-right behind the controls — the BoneRutter rig (idle loop + reaction
	// clips) replacing the static illustration + tween wiggles. Hidden while the bonus-session
	// mantises (Mantis.svelte) are on stage.
	import * as PIXI from 'pixi.js';
	import { Container } from 'pixi-svelte';

	import { Tween } from 'svelte/motion';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { MARTY, MASTER, layoutKind, martyFor } from '../game/layoutSpec';
	import { RIG, reactionVoice } from '../game/constants';
	import type { Rig } from '../bonerutter';
	import { playClip, playIdle, currentClip, isIdling, scheduleBored } from '../game/mantisRig';
	import BoneRig from './BoneRig.svelte';

	const context = getContext();
	// viewport width in master units: portrait's frame grows with it, and Marty's y follows the frame
	const vw = $derived(context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale);
	const place = $derived(martyFor(layoutKind(context.stateLayoutDerived.layoutType()), vw));

	let rig = $state<Rig | null>(null);
	let busy = false;

	// Stage presence (Corey 2026-08-29): Marty is a permanent fixture. Free/feast bonuses take
	// over his exact slot (Mantis.svelte renders its own marty there), so this one vanishes
	// INSTANTLY at the swap — no fade, no walk, the character just keeps standing. The SUPER
	// bonus is Marky's solo show, so there Marty walks off screen and walks back on afterwards.
	const WALK_MS = 1200;
	const onStage = $derived(context.stateGame.gameType === 'basegame');
	let rendered = $state(true);
	// SUPER round trip (Corey 2026-09-08 bug: he walked off, then walked straight back on and
	// vanished under the door drop). martyWalkOut runs while gameType is STILL 'basegame', so
	// the on-stage effect re-rendered him at once. Now the walk-out parks him 'away' until the
	// bonus has actually run (gameType seen as 'freegame'), and the walk back in waits for the
	// base game's door to rise (doorOpen with gameType 'basegame'), so it is seen.
	let superPhase: 'home' | 'out' | 'away' | 'returning' = 'home';
	const walkBackIn = async () => {
		superPhase = 'returning';
		rendered = true;
		walkOff.set(offscreenDist(), { duration: 0 });
		for (let t = 0; t < 30 && !rig; t++) await waitForTimeout(100);
		if (!rig) {
			walkOff.set(0, { duration: 0 });
			superPhase = 'home';
			return;
		}
		busy = true;
		playClip(rig, RIG.walk.forward, { loop: true, speed: RIG.walkSpeed });
		await walkOff.set(0, { duration: WALK_MS });
		if (rig) playIdle(rig);
		busy = false;
		superPhase = 'home';
	};
	$effect(() => {
		if (context.stateGame.gameType === 'freegame' && superPhase === 'out') superPhase = 'away';
	});
	const walkOff = new Tween(0);
	const offscreenDist = () => {
		const kind = layoutKind(context.stateLayoutDerived.layoutType());
		return MASTER[kind].width - MARTY[kind].x + MARTY[kind].size;
	};
	// game load (Corey 2026-09-05): this component mounts once per page load, right after the
	// landing press clears the loading screen — a few idle loops in, Marty plays the bored clip
	// once. Mount-scoped on purpose: returning from free games re-renders, it does not re-mount.
	let boredOnLoad = false;
	$effect(() => {
		if (rig && !boredOnLoad) {
			boredOnLoad = true;
			scheduleBored(rig, 3);
		}
	});
	$effect(() => {
		if (!onStage && rendered) {
			// free/feast: Mantis marty is already standing in this spot — instant handoff.
			// (The SUPER walk-out already ran via martyWalkOut before the transition; this is
			// only a fallback if it couldn't.)
			rendered = false;
		} else if (onStage && !rendered && superPhase === 'home') {
			// free/feast hand-off: the rig Marty leaves and this one re-renders in place, same frame
			rendered = true;
			walkOff.set(0, { duration: 0 });
		}
		// 'out' / 'away' / 'returning': stay off stage; doorOpen brings him back
	});

	const react = (kind: MartyReaction) => {
		if (busy || !rendered || !rig) return;
		busy = true;
		// voice rides the animation, and only once it is certain to play (guards above): a big win in
		// a bonus broadcasts martyReact AND mantisReact, but this Marty is unrendered there
		context.eventEmitter.broadcast({ type: 'soundOnce', name: reactionVoice(kind) });
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
		if (!rig || busy || !rendered) return;
		if (anticipating && isIdling(rig)) playClip(rig, RIG.anticipation, { loop: true });
		else if (!anticipating && currentClip(rig) === RIG.anticipation) playIdle(rig);
	});

	context.eventEmitter.subscribeOnMount({
		martyReact: ({ kind }) => react(kind),
		// super is Marky's solo show: Marty visibly walks off BEFORE the transition wipes the
		// screen (bonusStart awaits this), and walks back on when the base game returns
		martyWalkOut: async () => {
			superPhase = 'out';
			if (!rendered || !rig) {
				rendered = false;
				return;
			}
			busy = true;
			playClip(rig, RIG.walk.backward, { loop: true, speed: RIG.walkSpeed });
			await walkOff.set(offscreenDist(), { duration: WALK_MS });
			rendered = false;
			busy = false;
		},
		// the base game's door rising after a SUPER bonus: walk him back on, in view
		doorOpen: () => {
			if (context.stateGame.gameType === 'basegame' && (superPhase === 'away' || superPhase === 'out')) void walkBackIn();
		},
	});
	// test hook (house rules: extend __angryMantis): the SUPER round-trip phase, for the walk gate
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		((window as any).__angryMantis ??= {}).marty = { phase: () => superPhase, rendered: () => rendered, off: () => walkOff.current };
	}
	const poke = () => {
		if (!context.stateXstateDerived.isIdle()) return;
		react('poke');
	};
	// the rig is a loose cloud of sprites — a fixed square hit area (the old sprite's footprint)
	// keeps the poke target predictable and >= 44px
	const hitArea = $derived(new PIXI.Rectangle(-place.size / 2, -place.size / 2, place.size, place.size));
</script>

{#if rendered}
	<Container
		x={place.x + walkOff.current}
		y={place.y}
		{hitArea}
		eventMode={context.stateXstateDerived.isIdle() ? 'static' : 'none'}
		cursor="pointer"
		onpointerup={poke}
	>
		<BoneRig bind:rig size={place.size} />
	</Container>
{/if}
