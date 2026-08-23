<script lang="ts">
	import ChunkyBtn from './ChunkyBtn.svelte';
	import Icon from './Icon.svelte';
	import type { Controls } from './controls.svelte';

	type Props = { size?: number; controls: Controls };
	const { size = 42, controls }: Props = $props();
</script>

<ChunkyBtn {size} color="#ffdc4a" active disabled={controls.betDisabled()} onclick={controls.openDenom} ariaLabel="Bet amount">
	<Icon name="coins" s={size * 0.72} />
</ChunkyBtn>
