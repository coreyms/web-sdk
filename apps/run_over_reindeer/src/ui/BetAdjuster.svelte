<script lang="ts">
	import { soc } from '../game/social';
	import { betStepTarget } from './betStep';
	import type { Controls } from './controls.svelte';
	import { numberToCurrencyString } from '../game/currency';
	import { stepDraw } from './sign/signLayout';
	import { stepSvg } from './sign/signDraw';
	import './hudTheme';
	import './sign/signPanel.css';

	// THE AUTOPLAY CARD'S AMOUNT STEPPER, in the sign bar's style (2026-11-23; Corey's pick from the mock
	// menus_r1_2026-11-23, style A): a small green sign plate under the card with the bar's own bet symbols (a red < and
	// a green >, ui/sign/signDraw.ts stepSvg) either side of a header plate and the amount. Until then it was a dark box
	// with the glass dock's round minus and plus keys. The stepping rules, the sub click and the press on the amount
	// (it opens the amount list) are unchanged.
	// pressSound: the autoplay card voices its own buttons with the sub click; elsewhere the arrows keep the general
	// click (setBet's own)
	// autoRun: the Autoplay menu's stepper shows what one spin of the run will use (ui/controls.svelte.ts autoSpinCost,
	// 2026-11-19): with a feature loaded, the base amount under SPIN / PLAY, since START unloads the feature
	// row: the header plate and the amount side by side (a phone held sideways, where height is short)
	// bare: no plate of its own: the stepper rides in the card's head row (the mock's departure for the sideways phone:
	// under the card the open STOP OPTIONS pushed the main key off the window once every press box is 44 px)
	// touch: the keys at 44 px (46 with a mouse)
	// low: the Autoplay card's LOW layout (Stake's 400 x 225 popout, ui/AutoplayModal.svelte): a tightened plate under
	// the card, 36 px keys, the header plate and a smaller amount side by side, 46 px tall in all
	type Props = { controls: Controls; pressSound?: 'soundPressGeneral' | 'soundPressSub'; autoRun?: boolean; row?: boolean; bare?: boolean; touch?: boolean; low?: boolean };
	const { controls, pressSound = 'soundPressGeneral', autoRun = false, row = false, bare = false, touch = false, low = false }: Props = $props();
	// Same label rule as the HUD readout (controls.betLabel): a bought feature names the mode, everything
	// else reads SPIN / PLAY. Ante is announced by this component's own tag beside the header.
	const label = $derived(autoRun && controls.armedBuy() !== null ? soc('SPIN', 'PLAY') : controls.betLabel());
	const value = $derived(autoRun ? numberToCurrencyString(controls.autoSpinCost()) : controls.betText());

	// stepping rules (affordability clamp) live in betStep.ts, shared with the bar's own symbols
	const stepTarget = betStepTarget;
	const step = (dir: 1 | -1) => {
		const next = stepTarget(dir);
		if (next === undefined) return;
		controls.sound(pressSound);
		controls.setBet(next, { silent: true });
	};
	// the bar's own symbol at 24 bar px, in a 46 px box (the mock's numbers); the box scales with the key
	const KEY = 46;
	const sym = (dir: 1 | -1) => stepSvg(dir, stepDraw(24), KEY, KEY);
</script>

<div class="adj sp" class:sp-plate={!bare} class:bare class:row={row || bare || low} class:touch class:low data-auto-stepper={bare ? 'head' : 'plate'}>
	<button type="button" class="sp-sk" disabled={stepTarget(-1) === undefined} onclick={() => step(-1)} aria-label={soc('Decrease bet', 'Decrease play amount')}>
		<svg viewBox="0 0 {KEY} {KEY}" aria-hidden="true">{@html sym(-1)}</svg>
	</button>
	<button type="button" class="mid" onclick={() => controls.openDenom()}>
		{#if controls.anteActive()}<span class="ante">{soc('ANTE BET', 'ANTE MODE')}</span>{/if}
		<span class="sp-tag lbl"><span>{label}</span></span>
		<span class="val">{value}</span>
	</button>
	<button type="button" class="sp-sk" disabled={stepTarget(1) === undefined} onclick={() => step(1)} aria-label={soc('Increase bet', 'Increase play amount')}>
		<svg viewBox="0 0 {KEY} {KEY}" aria-hidden="true">{@html sym(1)}</svg>
	</button>
</div>

<style>
	/* the mock's .stp: a small plate, the bar's bet symbols either side of the header plate and the amount */
	.adj {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px;
		pointer-events: auto;
		font-family: 'Overpass', 'Outfit', sans-serif;
		font-weight: 900;
		color: var(--sp-ink);
		-webkit-font-smoothing: antialiased;
	}
	.adj.touch :global(.sp-sk) {
		width: 44px;
		height: 44px;
	}
	.adj .mid {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		min-width: 132px;
		white-space: nowrap;
	}
	.adj .lbl {
		font-size: 11.5px;
	}
	.adj .val {
		font-size: 23px;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		transform: translateY(0.06em);
	}
	/* an Ante level on: a small yellow sign chip over the header (beside it in a row) */
	.adj .ante {
		padding: 2px 5px 0;
		font-size: 9.5px;
		line-height: 1.2;
		letter-spacing: 0.08em;
		color: var(--sp-acc-ink);
		background: var(--sp-acc);
		border: 1.5px solid var(--sp-ki-c);
		border-radius: 4px;
	}
	/* side by side: the sideways phone's plate, and the stepper in the card's head row */
	.adj.row {
		padding: 2px 10px;
	}
	.adj.row .mid {
		flex-direction: row;
		gap: 9px;
	}
	.adj.bare {
		padding: 0;
		gap: 2px;
	}
	/* LOW: 36 px keys and 1 px of padding over and under them */
	.adj.low {
		padding: 1px 10px;
	}
	.adj.low :global(.sp-sk) {
		width: 36px;
		height: 36px;
	}
	.adj.low .val {
		font-size: 18px;
	}
	.adj.low .lbl {
		font-size: 10px;
	}
	.adj.bare .mid {
		min-width: 0;
		gap: 8px;
		padding: 0 4px;
	}
</style>
