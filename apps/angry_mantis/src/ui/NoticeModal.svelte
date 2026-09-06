<script lang="ts">
	import { soc } from '../game/social';
	// Design-styled replacement for the SDK's ModalError + ModalAutoSpinMessage (same stateModal names).
	import { stateModal } from 'state-shared';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { master, scale, left, top, compact = false }: Props = $props();

	const MESSAGES: Record<string, { title: string; body: string }> = {
		insufficientBalance: { title: soc('INSUFFICIENT BALANCE', 'BALANCE TOO LOW'), body: soc('Your balance does not cover this bet. Lower the bet amount or add funds to play.', 'Your balance does not cover this play amount. Lower the play amount or get coins to play.') },
		insufficientFunds: { title: 'AUTOPLAY STOPPED', body: soc('Your balance is too low for the next spin at this bet.', 'Your balance is too low for the next spin at this play amount.') },
		lossLimitReached: { title: 'AUTOPLAY STOPPED', body: 'Your loss limit for this autoplay session was reached.' },
		singleWinLimitReached: { title: 'AUTOPLAY STOPPED', body: 'A single win reached your autoplay win limit.' },
	};

	// Stake Engine RGS error codes → what the player should do. Checked against the live wallet
	// docs (stake-engine.com/docs/rgs/wallet, 2026-09-06): the published table is ERR_VAL, ERR_IPB,
	// ERR_IS, ERR_ATE, ERR_GLE, ERR_LOC (400) and ERR_GEN, ERR_MAINTENANCE (500); the other keys
	// below are codes Corey saw in RGS responses (2026-09-02) and are kept as a superset. The fetcher hands the JSON body straight through, so the code may sit
	// at error.error (string), error.error.statusCode, or error.statusCode; a text scan is the
	// last resort. `reload: false` codes are recoverable in place (OKAY closes the card).
	const RGS_ERRORS: Record<string, { title: string; body: string; reload: boolean }> = {
		ERR_SCR: { title: 'CONFIGURATION ERROR', body: 'The game is not correctly configured for this operator. Reload the game; if this keeps happening, contact support.', reload: true },
		ERR_OPT: { title: 'CONFIGURATION ERROR', body: 'The game is not correctly configured for this operator. Reload the game; if this keeps happening, contact support.', reload: true },
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
		// only the code reaches the player; the payload stays out of the DOM (it can carry a whole book)
		const code = rgsCode(e);
		if (code) return code;
		if (typeof e?.error === 'string') return e.error;
		return 'Unknown error';
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
		<div class="card" class:halt={needsReload} onclick={(e) => e.stopPropagation()} role="presentation" style:width={compact ? '88%' : '440px'}>
			<div class="grain"></div>
			<div class="stamp">{needsReload ? 'NOTICE' : 'SLIP'}</div>
			<div class="title">{isError ? (known?.title ?? 'SOMETHING WENT WRONG') : notice?.title}</div>
			<div class="body">{isError ? (known?.body ?? 'Reload the game to continue. Any unfinished round resumes from the server.') : notice?.body}</div>
			{#if isError}
				<div class="slot-num detail">{errorText}</div>
			{/if}
			<button class="slot-btn ok" class:halt={needsReload} onclick={needsReload ? reload : close}>{needsReload ? 'RELOAD' : 'OKAY'}</button>
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
	/* the same paper slip as the replay / autoplay / feature tickets (ReplayModal.svelte tokens) */
	.card {
		--ink: #1b1204;
		--body: #2a241a;
		--muted: #6b6250;
		--faint: #8a8069;
		--rule: #a99c7d;
		--rust: #b8371e;
		pointer-events: auto;
		position: relative;
		color: var(--body);
		background: linear-gradient(180deg, #ebe3cf, #d9cfb4);
		border-radius: 18px;
		padding: 22px 24px 18px;
		box-shadow: 0 30px 70px rgba(0, 0, 0, 0.7), inset 0 0 0 2px rgba(0, 0, 0, 0.08);
		display: flex;
		flex-direction: column;
		gap: 12px;
		text-align: center;
	}
	.grain {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.035) 0 1px, transparent 1px 3px);
		pointer-events: none;
	}
	.card > :not(.grain) {
		position: relative;
	}
	.stamp {
		align-self: center;
		border-radius: 999px;
		padding: 5px 14px;
		background: var(--body);
		color: #f2c14e;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 2px;
	}
	.card.halt .stamp {
		background: var(--rust);
		color: #f6ead3;
	}
	.title {
		font-weight: 900;
		font-size: 20px;
		letter-spacing: 3px;
		color: var(--ink);
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
	}
	.body {
		font-size: 13.5px;
		letter-spacing: 0.3px;
		line-height: 1.5;
		color: var(--body);
	}
	.detail {
		font-size: 11px;
		color: var(--muted);
		border: 2px dashed var(--rule);
		border-radius: 10px;
		padding: 8px 10px;
		max-height: 80px;
		overflow: auto;
		word-break: break-word;
	}
	.ok {
		height: 46px;
		border-radius: 12px;
		font-weight: 900;
		font-size: 14px;
		letter-spacing: 3px;
		color: var(--ink);
		background: linear-gradient(180deg, #9be04a, #6fb52a);
		box-shadow: 0 5px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.ok.halt {
		color: #f6ead3;
		background: linear-gradient(180deg, #d9603a, #a8341a);
	}
	.ok:active {
		transform: translateY(2px);
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
</style>
