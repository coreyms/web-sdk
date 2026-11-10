<script lang="ts">
	import { onMount } from 'svelte';

	type Props = { side: 'left' | 'right'; text?: string; clock?: boolean };
	const { side, text = '', clock = false }: Props = $props();

	let now = $state(new Date());
	onMount(() => {
		const id = setInterval(() => (now = new Date()), 30000);
		return () => clearInterval(id);
	});
	const hhmm = $derived(`${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`);
</script>

<div class="strip" style:left={side === 'left' ? '14px' : 'auto'} style:right={side === 'right' ? '14px' : 'auto'}>
	{#if clock}{hhmm}&nbsp;&nbsp;&nbsp;{/if}{text}
</div>

<style>
	/* --vp-extra-top (ui/Chrome.svelte): the letterbox over the master on a desktop screen narrower than 16:9 (layoutSpec
	   LANDSCAPE_TALL), so the strip is at the screen's top edge there too; 0 in every other case */
	.strip {
		position: absolute;
		top: calc(10px - var(--vp-extra-top, 0px));
		font-family: var(--ui-font);
		font-size: 12px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.85);
		letter-spacing: 1.5px;
		text-transform: uppercase;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
		pointer-events: none;
		white-space: pre;
		z-index: 10;
	}
</style>
