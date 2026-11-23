<script lang="ts">
	import { stateBet } from 'state-shared';

	import ChunkyBtn from './ChunkyBtn.svelte';
	import Icon from './Icon.svelte';
	import type { Controls } from './controls.svelte';

	type Props = { size?: number; controls: Controls };
	const { size = 42, controls }: Props = $props();
</script>

<ChunkyBtn glass {size} color={controls.turboLevel() > 0 ? '#ffdc4a' : '#fff'} active={controls.turboLevel() > 0} disabled={stateBet.isSpaceHold} onclick={controls.turboPress} ariaLabel={controls.turboLevel() === 2 ? 'Turbo: instant' : controls.turboLevel() === 1 ? 'Turbo: on' : 'Turbo'}>
	<Icon name={controls.turboLevel() === 2 ? 'instant' : 'turbo'} s={size * 0.43} />
</ChunkyBtn>
