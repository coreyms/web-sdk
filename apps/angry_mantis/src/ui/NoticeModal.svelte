<script lang="ts">
	import { soc } from '../game/social';
	// Design-styled replacement for the SDK's ModalError + ModalAutoSpinMessage (same stateModal names).
	import { stateModal } from 'state-shared';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { master, scale, left, top, compact = false }: Props = $props();

	const MESSAGES: Record<string, { title: string; body: string }> = {
		insufficientFunds: { title: 'AUTOPLAY STOPPED', body: soc('Your balance is too low for the next spin at this bet.', 'Your balance is too low for the next spin at this play amount.') },
		lossLimitReached: { title: 'AUTOPLAY STOPPED', body: 'Your loss limit for this autoplay session was reached.' },
		singleWinLimitReached: { title: 'AUTOPLAY STOPPED', body: 'A single win reached your autoplay win limit.' },
	};

	// Stake Engine RGS error codes (rgs-communication "Response Codes", Corey 2026-09-02) → what
	// the player should do. The fetcher hands the JSON body straight through, so the code may sit
	// at error.error (string), error.error.statusCode, or error.statusCode; a text scan is the
	// last resort. `reload: false` codes are recoverable in place (OKAY closes the card).
	const RGS_ERRORS: Record<string, { title: string; body: string; reload: boolean }> = {
		ERR_IPB: { title: soc('INSUFFICIENT BALANCE', 'BALANCE TOO LOW'), body: soc('Your balance does not cover this bet. Lower the bet amount or add funds, then try again.', 'Your balance does not cover this play amount. Lower the play amount, then try again.'), reload: false },
		ERR_VAL: { title: 'INVALID REQUEST', body: 'The server rejected the request. Reload the game and try again.', reload: true },
		ERR_IS: { title: 'SESSION EXPIRED', body: 'Your session has timed out. Reload the game to sign in again. Any unfinished round resumes from the server.', reload: true },
		ERR_ATE: { title: 'SIGN-IN EXPIRED', body: 'Your sign-in token has expired. Reload the game to sign in again. Any unfinished round resumes from the server.', reload: true },
		ERR_GLE: { title: 'LIMIT REACHED', body: soc('This bet would exceed a gambling limit set on your account. Nothing was wagered.', 'This round would exceed a limit set on your account. Nothing was played.'), reload: false },
		ERR_LOC: { title: 'NOT AVAILABLE HERE', body: 'This game is not available in your current location.', reload: true },
		ERR_BE: { title: 'ROUND IN PROGRESS', body: 'You already have an unfinished round. Reload the game to resume it.', reload: true },
		ERR_BNF: { title: 'ROUND NOT FOUND', body: 'The server could not find this round. Reload the game to continue.', reload: true },
		ERR_MAINTENANCE: { title: 'PLANNED MAINTENANCE', body: 'The game server is under planned maintenance. Please try again in a few minutes.', reload: true },
		ERR_GEN: { title: 'SERVER ERROR', body: 'Something went wrong on the game server. Reload the game to continue. Any unfinished round resumes from the server.', reload: true },
		ERR_UE: { title: 'SERVER ERROR', body: 'Something went wrong on the game server. Reload the game to continue. Any unfinished round resumes from the server.', reload: true },
		ERR_GE: { title: 'SERVER ERROR', body: 'Something went wrong on the game server. Reload the game to continue. Any unfinished round resumes from the server.', reload: true },
	};
	const rgsCode = (e: any): string | null => {
		if (!e) return null;
		const direct = [e.error, e.error?.statusCode, e.error?.code, e.statusCode, e.code].find((c) => typeof c === 'string' && c.startsWith('ERR_'));
		if (direct) return direct;
		const text = typeof e === 'string' ? e : (() => { try { return JSON.stringify(e); } catch { return String(e); } })();
		return text.match(/ERR_[A-Z]+/)?.[0] ?? null;
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
	const known = $derived(isError ? RGS_ERRORS[rgsCode((modal as { error?: unknown }).error) ?? ''] ?? null : null);
	// a recoverable RGS error (balance, limits) closes in place; everything else reloads
	const needsReload = $derived(isError && (known ? known.reload : true));
	const close = () => {
		if (needsReload) return; // persistent: the player reloads
		stateModal.modal = null;
	};
	const reload = () => location.reload();
</script>

<ModalShell {open} onclose={close} {master} {scale} {left} {top} zIndex={9}>
	<div class="center">
		<div class="card" onclick={(e) => e.stopPropagation()} role="presentation" style:width={compact ? '88%' : '440px'} style:border-color={needsReload ? '#ff5a5a' : '#ffdc4a'}>
			<div class="title">{isError ? (known?.title ?? 'SOMETHING WENT WRONG') : notice?.title}</div>
			<div class="body">{isError ? (known?.body ?? 'Reload the game to continue. Any unfinished round resumes from the server.') : notice?.body}</div>
			{#if isError}
				<div class="slot-num detail">{errorText}</div>
			{/if}
			<button class="slot-btn ok" onclick={needsReload ? reload : close} style:background={needsReload ? 'linear-gradient(180deg, #ff7a7a, #c53c24)' : 'linear-gradient(180deg, #ffe066, #e8b04a)'}>{needsReload ? 'RELOAD' : 'OKAY'}</button>
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
