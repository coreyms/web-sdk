<script lang="ts">
	import { OnHotkey } from 'components-shared';
	import { MainContainer, OnPressFullScreen } from 'components-layout';
	import { Tween } from 'svelte/motion';
	import { onMount, untrack } from 'svelte';

	import { getContext } from '../game/context';
	import { HUD, layoutKind } from '../game/layoutSpec';
	import ArtAmount from './ArtAmount.svelte';

	// `active` (default true — conditionally-mounted gates need nothing): consumers whose
	// PressToContinue stays ALWAYS mounted under a persistent FadeContainer (BonusIntro) pass
	// their `show` here so the gate follows visibility, not mount.
	type Props = { onpress: () => void; showText?: boolean; active?: boolean };
	const props: Props = $props();
	const context = getContext();
	const active = $derived(props.active ?? true);
	const slot = $derived(HUD[layoutKind(context.stateLayoutDerived.layoutType())].pressToContinue);

	// Press-gate registration: the emitter fans the Space hotKey out to EVERY OnHotkey, so without
	// this a "continue" press also reached Chrome's Space→controls.spin, whose stopButtonClick
	// subscriber force-enables turbo (non-persistently) and rushes the reels. While any gate is
	// active, stateGame.pressGates > 0 disables Chrome's spin/stop hotkey (its `disabled` expr);
	// this component's own hotkey keeps working. A counter, not a boolean — gates can overlap
	// during transitions; the effect cleanup keeps it balanced on hide/unmount.
	$effect(() => {
		if (!active) return;
		// untrack: `+= 1` READS pressGates, and an effect that reads what it writes re-runs
		// itself forever (live-caught: the intro's gate pinned the main thread at 100%)
		untrack(() => (context.stateGame.pressGates += 1));
		return () => {
			untrack(() => (context.stateGame.pressGates -= 1));
		};
	});

	const blink = new Tween(1, { duration: 700 });
	let alive = true;
	onMount(() => {
		(async () => {
			while (alive) {
				await blink.set(0.45);
				await blink.set(1);
			}
		})();
		return () => (alive = false);
	});
</script>

{#if props.showText}
<MainContainer>
	<ArtAmount
		text="PRESS ANYWHERE TO CONTINUE"
		height={slot.height * 0.42}
		x={context.stateLayoutDerived.mainLayout().width * 0.5}
		y={slot.y - slot.height * 0.5}
		alpha={blink.current}
		maxWidth={slot.width}
	/>
</MainContainer>
{/if}
<OnHotkey hotkey="Space" disabled={!active} onpress={() => props.onpress()} />
<OnPressFullScreen onpress={() => props.onpress()} />
