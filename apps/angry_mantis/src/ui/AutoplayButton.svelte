<script lang="ts">
	import ChunkyBtn from './ChunkyBtn.svelte';
	import Icon from './Icon.svelte';
	import Popover from './Popover.svelte';
	import type { Controls } from './controls.svelte';

	type Props = { size?: number; controls: Controls; compact?: boolean };
	const { size = 42, controls, compact = false }: Props = $props();

	const COUNTS: { label: string; value: number }[] = [
		{ label: '10', value: 10 },
		{ label: '25', value: 25 },
		{ label: '50', value: 50 },
		{ label: '100', value: 100 },
		{ label: '500', value: 500 },
		{ label: '1000', value: 1000 },
		{ label: '∞', value: Infinity },
	];
	const running = $derived(controls.autoRunning());
	const cell = $derived(compact ? 56 : 68);
</script>

<div class="wrap">
	<ChunkyBtn glass {size} color={running ? '#ff5a8a' : '#fff'} active={running} disabled={controls.autoDisabled()} onclick={controls.autoPress} ariaLabel="Autoplay">
		{#if running}<Icon name="close" s={size * 0.5} />{:else}<Icon name="auto" s={size * 0.42} />{/if}
	</ChunkyBtn>
	<Popover open={controls.autoOpen} onclose={() => (controls.autoOpen = false)} side="right" offset={size + 14} width={cell * 4 + 32 + 24}>
		<div class="title" style:font-size="{compact ? 11 : 13}px">AUTOPLAY ROUNDS</div>
		<div class="grid" style:grid-template-columns="repeat(4, {cell}px)">
			{#each COUNTS as c (c.label)}
				<button class="slot-btn cell" style:width="{cell}px" style:height="{cell}px" style:font-size="{compact ? 14 : 16}px" onclick={() => controls.autoStart(c.value)}>{c.label}</button>
			{/each}
		</div>
	</Popover>
</div>

<style>
	.wrap {
		position: relative;
		display: inline-block;
	}
	.title {
		font-weight: 900;
		letter-spacing: 2.5px;
		color: rgba(255, 255, 255, 0.8);
		margin-bottom: 12px;
		text-align: center;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
	}
	.grid {
		display: grid;
		gap: 8px;
	}
	.cell {
		border-radius: 12px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.45) 100%);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 3px 0 rgba(0, 0, 0, 0.4);
		color: #fff;
		font-weight: 800;
		letter-spacing: 0.5px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
