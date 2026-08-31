<script lang="ts">
	import { OnHotkey } from 'components-shared';
	import { MainContainer, OnPressFullScreen } from 'components-layout';
	import { Tween } from 'svelte/motion';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import { HUD, layoutKind } from '../game/layoutSpec';
	import ArtAmount from './ArtAmount.svelte';

	type Props = { onpress: () => void; showText?: boolean };
	const props: Props = $props();
	const context = getContext();
	const slot = $derived(HUD[layoutKind(context.stateLayoutDerived.layoutType())].pressToContinue);

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
<OnHotkey hotkey="Space" onpress={() => props.onpress()} />
<OnPressFullScreen onpress={() => props.onpress()} />
