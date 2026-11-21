<script lang="ts">
	// THE BONUS ROUND'S CARDS: the intro when a round is triggered or bought, and the wrap-up with its total. HTML on
	// the house panel surface (black glass, Overpass headings), over the board; the HUD steps aside while one is up.
	// The handlers put a card in stateGame.roundCard and wait (game/bookEventHandlerMap.ts showCard); a press anywhere,
	// Space or Enter, or the card's own time running out, dismisses it. Every amount on it is the book's.
	import { onMount, untrack } from 'svelte';
	import { stateBet, stateUrlDerived } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import config from '../game/config';
	import { INTRO_LINE, REINDEER_SOUND, ROUND } from '../game/constants';
	import type { SoundEffectName } from '../game/sound';
	import { soc } from '../game/social';
	import { dismissRoundCard } from '../game/bookEventHandlerMap';
	import { scoreboardDev } from '../game/scoreboard/scoreboard';
	import type { RoundCard } from '../game/stateGame.svelte';

	type Props = { card: RoundCard };
	const { card }: Props = $props();
	const context = getContext();

	const NAME = { bonus: 'FREE SPINS', super: 'SUPER FREE SPINS' } as const;
	const ACCENT = { bonus: '#19d3da', super: '#ff5a6e' } as const;
	// (the intro's sentence lives in game/constants.ts INTRO_LINE: the LED strip scrolls the same words)

	let armed = $state(false);
	// ON THE LED BACK BOARD (card.board, constants LED_BOARD.cards; part B): the board's scene is the card. A press before
	// its press line lands the scene (the entry's READY beat, the Total Win's count) and the card stays; the next continues.
	const board = untrack(() => !!card.board);
	const press = () => {
		if (!armed) return;
		if (board && scoreboardDev.board?.cardPress()) return;
		dismissRoundCard();
	};

	/** a card's sound, through the game's own sound events (the effects volume and mute apply) */
	// (the card's kind read once, at mount: when the card goes, its prop already reads the cleared state)
	const kind: RoundCard['kind'] = untrack(() => card.kind);
	const voice = (name: string) => {
		// DEV: the moment, for the sound probe (window.__reindeer.markMoment, components/Board.svelte)
		if (import.meta.env.DEV) (window as unknown as { __reindeer?: { markMoment?: (what: string, detail?: string) => void } }).__reindeer?.markMoment?.('card', `${name} ${kind}`);
		context.eventEmitter.broadcast({ type: 'soundOnce', name: name as SoundEffectName });
	};

	// THE ENTRY CARD'S SOUNDS ARE THE BONUS ENTRANCE'S (2026-11-21, constants REINDEER_SOUND.entrance, game/bonusEntrance.ts):
	// its hit lands with the card and its drop plays on the dismissal, so the intro plays no card in or card out of its own.
	// The wrap-up keeps both.
	const ownSounds = !(kind === 'intro' && REINDEER_SOUND.entrance.on);

	onMount(() => {
		// THE CARD'S SOUNDS (constants REINDEER_SOUND cards): it comes up on this frame (its pop starts with the mount)
		if (ownSounds) voice(REINDEER_SOUND.cards.in);
		// Space belongs to the card while it is up (ui/Chrome.svelte holds its own Space hotkey off)
		context.stateGame.pressGates += 1;
		const arm = setTimeout(() => (armed = true), ROUND.armMs);
		// it continues by itself: sooner when a running autoplay is set to play the bonuses through
		const auto = context.stateGame.autoPlayBonuses && stateBet.autoSpinsCounter > 0;
		// (2026-11-17, Corey: "Free Spin Entry does not wait for Press for Continue (without Autoplay even running)"): the
		// intro's own 4 s timer continued it by itself. With no autoplay running the intro now waits for the press
		// (ROUND.introWaitsForPress); in autoplay it keeps the old timing (1.4 s with the bonuses played through, else 4 s)
		// (a wrap-up that carries a line, the cap, waits too since 2026-11-17, ROUND.lineOutroWaitsForPress: its
		// line scrolls on the LED strip from the moment the amount lands and needs about 10 s to pass once)
		const lined = card.kind === 'outro' && card.capped && ROUND.lineOutroWaitsForPress;
		// THE ENTRY IN AUTOPLAY (2026-11-18, Corey on staging: "I had auto spins on, without the option selected for AutoPlay
		// Bonuses, and it entered bonus games without me clicking to continue on the intro screen"): the rule above exempted
		// every live run, so with Autoplay Bonuses off the entry still went by itself after introAutoMs. Only Autoplay
		// Bonuses (auto) lets the entry continue by itself now; any other run's entry waits for the press, as manual play's
		// does. The wrap-up keeps its rule (it continues by itself, outroAutoMs, or autoplayMs with the option on).
		// THE WRAP-UP WAITS FOR THE PRESS TOO (2026-11-18, Corey: "Yes", as Manticore Mayhem's FreeSpinOutro does): with no
		// Autoplay Bonuses running it continued by itself after outroAutoMs (6 s). Now it waits for the press, autoplay or
		// not; with Autoplay Bonuses on it continues ROUND.wrapAutoHoldMs after its amount has landed (the LED board's count,
		// or at once for the HTML card), and when that hold ends the option is asked again, so an autoplay stopped during it
		// brings the press back (Manticore's rule). A replay keeps its old rule (outroAutoMs, a lined wrap-up waits).
		// ROUND.introWaitsForPress false (some probes) keeps the old timing for every card.
		const replay = stateUrlDerived.replay();
		const autoNow = () => context.stateGame.autoPlayBonuses && stateBet.autoSpinsCounter > 0;
		const outroHolds = ROUND.introWaitsForPress && card.kind === 'outro' && !replay && auto;
		const waits = ROUND.introWaitsForPress && (card.kind === 'intro' ? !auto : replay ? lined : !auto);
		const ms = auto ? ROUND.autoplayMs : card.kind === 'intro' ? ROUND.introAutoMs : ROUND.outroAutoMs;
		let timer: ReturnType<typeof setTimeout> | undefined = waits || outroHolds ? undefined : setTimeout(dismissRoundCard, ms);
		let poll: ReturnType<typeof setInterval> | undefined;
		if (outroHolds) {
			poll = setInterval(() => {
				if (board && !(scoreboardDev.board?.cardLanded() ?? true)) return;
				clearInterval(poll);
				poll = undefined;
				timer = setTimeout(() => {
					if (autoNow()) dismissRoundCard();
				}, ROUND.wrapAutoHoldMs);
			}, 50);
		}
		const key = (e: KeyboardEvent) => {
			if (e.code === 'Space' || e.code === 'Enter') {
				e.preventDefault();
				// one press, one action (2026-11-18): a held key's auto-repeat presses nothing more
				if (e.repeat) return;
				press();
			}
		};
		window.addEventListener('keydown', key);
		return () => {
			clearTimeout(arm);
			clearTimeout(timer);
			if (poll) clearInterval(poll);
			window.removeEventListener('keydown', key);
			context.stateGame.pressGates = Math.max(0, context.stateGame.pressGates - 1);
			// it goes on this frame (no exit animation)
			if (ownSounds) voice(REINDEER_SOUND.cards.out);
		};
	});

	const amount = (value: number) => bookEventAmountToCurrencyString(value);
</script>

<button class="am-ui catch" class:board onclick={press} aria-label="Continue"></button>
{#if board}<div class="board-card" data-round-card={card.kind} data-round-board></div>{:else}<div class="am-ui wrap">
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
		{/if}
		<div class="prompt">PRESS ANYWHERE TO CONTINUE</div>
	</div>
</div>{/if}

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
	/* on the LED back board: the board dims the scene itself; the catch only takes the press */
	.catch.board {
		background: transparent;
		animation: none;
	}
	.board-card {
		display: none;
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
