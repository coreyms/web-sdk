<script lang="ts">
	// THE BONUS ROUND'S CARDS: the intro when a round is triggered or bought, and the wrap-up with its total. HTML on
	// the house panel surface (black glass, Overpass headings), over the board; the HUD steps aside while one is up.
	// The handlers put a card in stateGame.roundCard and wait (game/bookEventHandlerMap.ts showCard); a press anywhere,
	// Space or Enter, or the card's own time running out, dismisses it. Every amount on it is the book's.
	import { onMount } from 'svelte';
	import { stateBet } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import config from '../game/config';
	import { ROUND } from '../game/constants';
	import { soc } from '../game/social';
	import { dismissRoundCard } from '../game/bookEventHandlerMap';
	import type { RoundCard } from '../game/stateGame.svelte';

	type Props = { card: RoundCard };
	const { card }: Props = $props();
	const context = getContext();

	const NAME = { bonus: 'FREE SPINS', super: 'SUPER FREE SPINS' } as const;
	const ACCENT = { bonus: '#19d3da', super: '#ff5a6e' } as const;
	const INTRO_LINE = {
		bonus: 'Every column Wild stays for the whole round and keeps its multiplier.',
		super: 'The round starts with a column Wild in place. Column Wilds stay and keep their multipliers.',
	} as const;

	let armed = $state(false);
	const press = () => {
		if (armed) dismissRoundCard();
	};

	onMount(() => {
		// Space belongs to the card while it is up (ui/Chrome.svelte holds its own Space hotkey off)
		context.stateGame.pressGates += 1;
		const arm = setTimeout(() => (armed = true), ROUND.armMs);
		// it continues by itself: sooner when a running autoplay is set to play the bonuses through
		const auto = context.stateGame.autoPlayBonuses && stateBet.autoSpinsCounter > 0;
		const ms = auto ? ROUND.autoplayMs : card.kind === 'intro' ? ROUND.introAutoMs : ROUND.outroAutoMs;
		const timer = setTimeout(dismissRoundCard, ms);
		const key = (e: KeyboardEvent) => {
			if (e.code === 'Space' || e.code === 'Enter') {
				e.preventDefault();
				press();
			}
		};
		window.addEventListener('keydown', key);
		return () => {
			clearTimeout(arm);
			clearTimeout(timer);
			window.removeEventListener('keydown', key);
			context.stateGame.pressGates = Math.max(0, context.stateGame.pressGates - 1);
		};
	});

	const amount = (value: number) => bookEventAmountToCurrencyString(value);
	const floorText = (floor: number) => `${floor / 100}x`;
</script>

<button class="am-ui catch" onclick={press} aria-label="Continue"></button>
<div class="am-ui wrap">
	<div class="card am-glass" data-round-card={card.kind} style:--accent={ACCENT[card.bonus]}>
		{#if card.kind === 'intro'}
			<div class="name am-stencil">{NAME[card.bonus]}</div>
			<div class="big"><span class="slot-num">{card.spins}</span> FREE SPINS</div>
			<div class="line">{INTRO_LINE[card.bonus]}</div>
		{:else}
			<div class="name am-stencil">{NAME[card.bonus]}</div>
			<div class="label">{card.capped ? 'MAX WIN' : 'TOTAL WIN'}</div>
			<div class="slot-num amount" data-round-total>{amount(card.amount)}</div>
			{#if card.capped}<div class="line">{config.maxWin.toLocaleString('en-US')}x {soc('the bet, the most a round can pay', 'the play amount, the most a round can award')}.</div>{/if}
			{#if card.topUp}
				<div class="line" data-top-up>
					Includes {amount(card.topUp.amount)} added to bring this round up to its {floorText(card.topUp.floor)} minimum.
				</div>
			{/if}
		{/if}
		<div class="prompt">PRESS ANYWHERE TO CONTINUE</div>
	</div>
</div>

<style>
	.catch {
		position: fixed;
		inset: 0;
		z-index: 40;
		border: none;
		padding: 0;
		background: rgba(6, 8, 14, 0.42);
		cursor: pointer;
		animation: round-card-in 0.2s ease both;
	}
	.wrap {
		position: fixed;
		inset: 0;
		z-index: 41;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		box-sizing: border-box;
		pointer-events: none;
	}
	.card {
		box-sizing: border-box;
		width: min(100%, 460px);
		padding: clamp(16px, 4vmin, 30px) clamp(16px, 4vmin, 34px);
		border-radius: 18px;
		border-top: 4px solid var(--accent);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(6px, 1.6vmin, 12px);
		text-align: center;
		font-family: var(--ui-font);
		animation: round-card-pop 0.26s cubic-bezier(0.2, 1.3, 0.4, 1) both;
	}
	.name {
		color: var(--accent);
		font-size: clamp(20px, 5.2vmin, 34px);
		line-height: 1.05;
	}
	.big {
		font-family: var(--ui-font-display);
		font-weight: var(--ui-display-weight);
		font-size: clamp(26px, 7vmin, 46px);
		line-height: 1;
		color: var(--ui-ink);
	}
	.big .slot-num {
		color: var(--ui-gold);
	}
	.label {
		font-weight: 800;
		letter-spacing: 0.16em;
		font-size: clamp(11px, 2.4vmin, 14px);
		color: var(--ui-ink-2);
	}
	.amount {
		font-size: clamp(30px, 9vmin, 58px);
		font-weight: 800;
		line-height: 1;
		color: var(--ui-gold);
	}
	.line {
		font-size: clamp(12px, 2.6vmin, 15px);
		line-height: 1.35;
		color: #c9ccd6;
		max-width: 34em;
	}
	.prompt {
		margin-top: clamp(4px, 1.4vmin, 10px);
		font-family: var(--ui-font-display);
		font-weight: var(--ui-display-weight);
		letter-spacing: 0.05em;
		font-size: clamp(11px, 2.4vmin, 14px);
		color: var(--ui-ink-2);
		animation: round-card-pulse 1.6s ease-in-out infinite;
	}
	@keyframes round-card-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes round-card-pop {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	@keyframes round-card-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card,
		.catch,
		.prompt {
			animation: none;
		}
	}
</style>
