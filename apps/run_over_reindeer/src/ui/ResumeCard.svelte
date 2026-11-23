<script lang="ts">
	// THE RESUME CARD (2026-11-18, a stock rule for every game; game/resumeRound.svelte.ts): a reload into an open round
	// shows this in place of the landing screen's PRESS ANYWHERE, once the game is loaded. Two choices, the same words as
	// Manticore Mayhem's card: Play Round (the default, focused) and Skip to Result. One press, one action: the first choice
	// takes it and the card goes; nothing sounds before that press (the landing screen's own press voice follows it).
	// The look is THE FAST LANE's confirm card (ui/FeatureMenu.svelte): since 2026-11-23 the green guide sign with the sign
	// bar's white band (Corey, on the mock menus_r1_2026-11-23: "Just green everywhere", and "yes" to this card; a plain
	// restyle, its size, rows and words unchanged), the red GO button, the second button a dark plate with a white
	// line. Until then the white road sign with its black rim. HTML over the canvas; the HUD is not up behind it (the
	// landing screen's time).
	import { onMount, tick } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateBet } from 'state-shared';

	import { MODE_NAMES } from '../game/gameInfoText';
	// (the sign panels' tokens, --sp-*: this card can be up before the HUD is)
	import './hudTheme';
	import { RESUME_TEXT, type ResumeChoice } from '../game/resumeRound.svelte';

	type Props = { onchoose: (choice: ResumeChoice) => void };
	const props: Props = $props();

	// the open round's mode, by its key (the RGS's own case, as ResumeBet hands it over)
	const modeKey = (stateBet.betToResume?.mode ?? 'BASE').toLowerCase();
	const modeName = MODE_NAMES[modeKey] ?? MODE_NAMES.base;
	// a round played from the base game that triggered a bonus: name the bonus it is in
	const book = (stateBet.betToResume?.state ?? []) as { type: string; bonusType?: string }[];
	const trigger = book.find((e) => e.type === 'freeSpinTrigger');
	const roundName = trigger ? (trigger.bonusType === 'super' ? MODE_NAMES.super : MODE_NAMES.bonus) : modeName;

	let chosen = $state(false);
	let playBtn: HTMLButtonElement | undefined = $state();
	let cardH = $state(0);
	const vw = $derived(innerWidth.current ?? 1280);
	const vh = $derived(innerHeight.current ?? 720);
	// the sign's own size, then scaled to fit the window (Stake's 400 x 225 popout included), never above 1
	const compact = $derived(vw < 560 || vh < 420);
	const baseW = $derived(compact ? 340 : 470);
	const s = $derived(Math.min(1, (vw - 24) / baseW, cardH > 0 ? (vh - 24) / cardH : 1));

	const choose = (choice: ResumeChoice) => {
		if (chosen) return;
		chosen = true;
		props.onchoose(choice);
	};

	onMount(async () => {
		await tick();
		playBtn?.focus({ preventScroll: true });
	});
</script>

<div class="rwrap" data-resume-card>
	<div class="dim"></div>
	<div class="card" class:compact bind:offsetHeight={cardH} style:width="{baseW}px" style:transform="scale({s})" role="dialog" aria-modal="true" aria-labelledby="resume-title" aria-describedby="resume-line">
		<h3 id="resume-title">{RESUME_TEXT.title}</h3>
		<div class="rows"><div>{RESUME_TEXT.mode}</div><div data-resume-mode>{roundName}</div></div>
		<p id="resume-line">{RESUME_TEXT.line}</p>
		<div class="btns">
			<button class="no" data-resume="skip" disabled={chosen} onclick={() => choose('skip')}>{RESUME_TEXT.skip}</button>
			<button class="go ok" data-resume="play" bind:this={playBtn} disabled={chosen} onclick={() => choose('play')}>{RESUME_TEXT.play}</button>
		</div>
	</div>
</div>

<style>
	/* THE FAST LANE's confirm card (ui/FeatureMenu.svelte), its buttons, and the sign panels' green card (the --sp-*
	   tokens, ui/hudTheme.ts SIGN_PANEL): sign green, the white band, the navy line outside it and the black line inside */
	.rwrap {
		--green-deep: #064a31;
		--sign-white: #f7f8f3;
		--sign-black: #14161a;
		--yellow: #ffd21f;
		--disp: 'Overpass', var(--ui-font-display), sans-serif;
		--read: 'Outfit Text', 'Outfit', system-ui, sans-serif;
		position: fixed;
		inset: 0;
		z-index: 70;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
	}
	.dim {
		position: absolute;
		inset: 0;
		background: rgba(4, 8, 14, 0.62);
		animation: resume-in 0.2s ease both;
	}
	.card {
		position: relative;
		box-sizing: border-box;
		flex: none;
		background: var(--sp-field);
		color: var(--sp-ink);
		border: var(--sp-cbw) solid var(--sp-band);
		border-radius: var(--sp-crad);
		box-shadow:
			0 0 0 calc(var(--sp-cbw) * 0.36) var(--sp-ko-c),
			inset 0 0 0 calc(var(--sp-cbw) * 0.28) var(--sp-ki-c),
			0 14px 30px rgba(0, 0, 0, 0.5);
		padding: 22px 24px 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		font-family: var(--read);
		transform-origin: 50% 50%;
		animation: resume-pop 0.26s cubic-bezier(0.2, 1.3, 0.4, 1) both;
	}
	h3 {
		margin: 0;
		font-family: var(--disp);
		font-weight: 900;
		font-size: 26px;
		text-align: center;
		letter-spacing: 0.02em;
		line-height: 1.1;
	}
	.rows {
		font-size: 15px;
		font-family: var(--disp);
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
	}
	.rows div {
		padding: 7px 0 5px;
		border-top: 2px solid rgba(255, 255, 255, 0.34);
		border-bottom: 2px solid rgba(255, 255, 255, 0.34);
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		letter-spacing: 0.08em;
	}
	.rows div:nth-child(even) {
		text-align: right;
		font-weight: 900;
		padding-left: 12px;
		letter-spacing: 0.02em;
	}
	p {
		margin: 0;
		font-size: 14.5px;
		line-height: 1.35;
		color: #e6f3ec;
	}
	.btns {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	button {
		font: inherit;
		cursor: pointer;
		border: 0;
		padding: 0 10px;
		margin: 0;
		background: none;
		color: inherit;
		-webkit-tap-highlight-color: transparent;
	}
	button:focus-visible {
		outline: 3px solid var(--yellow);
		outline-offset: 2px;
	}
	.go {
		flex: 2 1 0;
		min-width: 0;
		height: 56px;
		font-size: 20px;
		background: linear-gradient(180deg, #ee3344, #b9141f);
		color: #fff;
		border: 4px solid var(--sign-white);
		border-radius: 12px;
		font-family: var(--disp);
		font-weight: 900;
		letter-spacing: 0.06em;
		box-shadow:
			0 0 0 1.5px var(--sp-ki-c),
			0 5px 0 1.5px #6d0a12;
		white-space: nowrap;
		transition:
			transform 90ms ease,
			box-shadow 90ms ease;
	}
	.go:active:not(:disabled) {
		transform: translateY(3px);
	}
	.no {
		flex: 1.4 1 0;
		min-width: 0;
		height: 52px;
		font-size: 16px;
		border: 3px solid var(--sp-ink);
		border-radius: 10px;
		font-family: var(--disp);
		font-weight: 800;
		color: var(--sp-ink);
		background: rgba(4, 22, 13, 0.3);
		white-space: nowrap;
		transition:
			transform 90ms ease,
			background-color 90ms ease;
	}
	.no:active:not(:disabled) {
		transform: translateY(2px);
		background: rgba(255, 255, 255, 0.24);
	}
	button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.card.compact {
		padding: 16px 16px 14px;
		gap: 9px;
	}
	.card.compact h3 {
		font-size: 21px;
	}
	.card.compact p {
		font-size: 13px;
	}
	.card.compact .go {
		height: 48px;
		font-size: 16px;
	}
	.card.compact .no {
		height: 48px;
		font-size: 14px;
	}
	@keyframes resume-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes resume-pop {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.dim,
		.card {
			animation: none;
		}
	}
</style>
