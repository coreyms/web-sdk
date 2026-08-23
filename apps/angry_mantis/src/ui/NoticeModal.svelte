<script lang="ts">
	// Design-styled replacement for the SDK's ModalError + ModalAutoSpinMessage (same stateModal names).
	import { stateModal } from 'state-shared';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { master, scale, left, top, compact = false }: Props = $props();

	const MESSAGES: Record<string, { title: string; body: string }> = {
		insufficientFunds: { title: 'AUTOPLAY STOPPED', body: 'Your balance is too low for the next spin at this bet.' },
		lossLimitReached: { title: 'AUTOPLAY STOPPED', body: 'Your loss limit for this autoplay session was reached.' },
		singleWinLimitReached: { title: 'AUTOPLAY STOPPED', body: 'A single win reached your autoplay win limit.' },
	};

	const modal = $derived(stateModal.modal);
	const isError = $derived(modal?.name === 'error');
	const isNotice = $derived(modal?.name === 'autoSpinMessage');
	const open = $derived(isError || isNotice);
	const errorText = $derived.by(() => {
		if (!isError) return '';
		const e = (modal as { error?: any }).error;
		if (!e) return 'Unknown error';
		if (e?.message) return `${e.error ? `${e.error}: ` : ''}${e.message}`;
		return typeof e === 'string' ? e : JSON.stringify(e);
	});
	const notice = $derived(isNotice ? MESSAGES[(modal as { message: string }).message] : null);
	const close = () => {
		if (isError) return; // errors are persistent: the player reloads
		stateModal.modal = null;
	};
	const reload = () => location.reload();
</script>

<ModalShell {open} onclose={close} {master} {scale} {left} {top} zIndex={9}>
	<div class="center">
		<div class="card" onclick={(e) => e.stopPropagation()} role="presentation" style:width={compact ? '88%' : '440px'} style:border-color={isError ? '#ff5a5a' : '#ffdc4a'}>
			<div class="title">{isError ? 'SOMETHING WENT WRONG' : notice?.title}</div>
			<div class="body">{isError ? 'Reload the game to continue. Any unfinished round resumes from the server.' : notice?.body}</div>
			{#if isError}
				<div class="slot-num detail">{errorText}</div>
			{/if}
			<button class="slot-btn ok" onclick={isError ? reload : close} style:background={isError ? 'linear-gradient(180deg, #ff7a7a, #c53c24)' : 'linear-gradient(180deg, #ffe066, #e8b04a)'}>{isError ? 'RELOAD' : 'OKAY'}</button>
		</div>
	</div>
</ModalShell>

<style>
	.center {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.card {
		pointer-events: auto;
		background: linear-gradient(180deg, #1d0e2a 0%, #0a0414 100%);
		border: 2px solid;
		border-radius: 14px;
		padding: 24px 22px 20px;
		box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8);
		display: flex;
		flex-direction: column;
		gap: 12px;
		text-align: center;
	}
	.title {
		font-weight: 900;
		font-size: 20px;
		letter-spacing: 2px;
		color: #fff;
	}
	.body {
		font-size: 13px;
		letter-spacing: 0.5px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.8);
	}
	.detail {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.55);
		background: rgba(0, 0, 0, 0.4);
		border-radius: 8px;
		padding: 8px 10px;
		max-height: 80px;
		overflow: auto;
		word-break: break-word;
	}
	.ok {
		height: 46px;
		border-radius: 8px;
		font-weight: 900;
		font-size: 13px;
		letter-spacing: 2px;
		color: #0a0410;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 3px 0 rgba(0, 0, 0, 0.5);
	}
</style>
