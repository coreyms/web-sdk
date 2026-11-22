<script lang="ts">
	import { soc } from '../game/social';
	// Autoplay Loadout (design approved 2026-08-26): configure a run, preview its TRUE total, then LOAD
	// it onto the spin button — pressing Spin is what starts it. Loss/win stops are multiples of one
	// spin's play amount. AUTOPLAY NEVER PLAYS A LOADED FEATURE (2026-11-19, ui/controls.svelte.ts autoSpinCost): with
	// Free Spins or Super Free Spins loaded the sheet prices the base game the run will play, says LOAD unloads the
	// feature, and Stop on Free Games is available as always (until 2026-11-19 the sheet priced the loaded feature and
	// switched that toggle off, though the run has always played base spins).
	// Black glass (Corey's "Black Glass Panels" pick, 2026-09-09): the sheet opens on the spin count,
	// the true total and one gold LOAD; the loss stop, single-win stop and the two toggles live behind
	// a STOP OPTIONS fold whose closed row summarises what is set, and the sheet opens unfolded
	// whenever something non-default is set — a stop is never hidden. Gold = the chosen count, white
	// = a chosen limit, red = OFF. Fonts stay the chrome's own (Outfit labels, Sora numbers).
	// Portrait (412 wide, 760 tall): the expanded sheet must fit above the bet stepper with NO scroll,
	// so the limits run six to a row, the wrap-prone hints / toggle blurbs / footer line go, and the
	// mode chip shortens to BASE · $1.00 / SPIN so the head stays one row (a bought feature's chip
	// reads "$100.00 TOTAL" instead: the price is for the whole round, not for each free spin).
	// The bet stepper sits under the sheet, as it does on the bonus-buy screen (Corey 2026-09-02).
	import { untrack } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateModal } from 'state-shared';
	import { numberToCurrencyString } from '../game/currency';

	import { modeChipData } from '../game/modeChipData';
	import { fitFont, measureFitText, UI_TEXT_FACE } from '../game/textFit';
	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import BetAdjuster from './BetAdjuster.svelte';
	import Icon from './Icon.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top, compact = false }: Props = $props();
	// compact covers phone-sideways (1480×740) and portrait (412×760); only portrait is narrow
	const portrait = $derived(master.width < master.height);
	// HUD round 5 ("Drop 6"): the phone held sideways splits the menu into two columns (the mockup's wide, low panel)
	const wide = $derived(compact && !portrait);
	// ModalShell's frame is the VIEWPORT now (Stake review FIX 5), so the sheet sizes itself against
	// real CSS px: `tiny` is Stake's Popout S band (400×225), where the sheet scrolls and the
	// secondary lines step aside so the numbers stay legible.
	const vw = $derived(innerWidth.current ?? 1280);
	const vh = $derived(innerHeight.current ?? 720);
	const tiny = $derived(vh < 300 || vw < 360);
	// LOW (2026-11-22, the small sizes fix, Corey "AO Yes"): the phone-sideways panel at Popout S height (400x225, `wide` and
	// `tiny` together). The 68vh sheet over the 54 px stepper left the last chip row cut, LOAD's label ran out of its
	// button and the 100 to unlimited chips had no room for their price lines. In LOW the sheet fits with no scroll: the
	// spin counts take the wider left column (1.25 : 1), the right column holds STOP OPTIONS, the total (two lines) and
	// LOAD (its words over its amount), the stepper's own padding tightens, and the sheet takes what height is left
	// (a loaded feature's line or a parked run's UNLOAD still scroll inside it).
	const low = $derived(wide && tiny);
	// the armed-mode pill reads "MYSTERY · $300.00 / SPIN", not "MYSTERY SPIN · $300.00 / SPIN":
	// the mode word alone, since "/ SPIN" already says the rest and the long labels clipped the
	// pill on phones (Corey 2026-09-15)
	const shortMode = (label: string) =>
		label === 'FREE SPINS' ? 'BONUS' : label.replace(/ (FREE SPINS|SPINS?|BET|MODE|GAME)$/, '');

	const open = $derived(stateModal.modal?.name === 'autoSpin');
	const close = () => (stateModal.modal = null);

	const COUNTS: number[] = [10, 25, 50, 100, 250, 500, 1000, Infinity];
	const LIMITS: (number | null)[] = [null, 5, 10, 25, 100, 500]; // null = OFF

	let count = $state(25);
	let lossMult = $state<number | null>(null);
	let winMult = $state<number | null>(null);
	let stopFree = $state(false);
	let autoBonuses = $state(false);

	/** the loaded feature LOAD will unload ("SUPER FREE SPINS"), or null */
	const unloads = $derived(controls.armedBuy() !== null ? (modeChipData()?.label ?? controls.armedBuy()) : null);
	// autoplay bonuses only exists while stop-on-free-games is off
	const stopFreeOn = $derived(stopFree);
	let advanced = $state(false);
	const anySet = $derived(lossMult !== null || winMult !== null || stopFree || autoBonuses);
	$effect(() => {
		if (open && anySet) advanced = true;
	});
	const advSummary = $derived.by(() => {
		const parts: string[] = [];
		parts.push(lossMult !== null ? `Loss limit ${lossMult}x` : 'Loss limit off');
		parts.push(winMult !== null ? `Win limit ${winMult}x` : 'Win limit off');
		if (stopFreeOn) parts.push('Stops on free games');
		else if (autoBonuses) parts.push('Bonuses autoplay');
		else parts.push('Bonuses wait for a press');
		return parts.join(', ');
	});

	const perSpin = $derived(controls.autoSpinCost());
	const pill = $derived((unloads === null ? modeChipData() : null) ?? { label: 'BASE GAME', cost: numberToCurrencyString(perSpin), unit: soc('/ SPIN', '/ PLAY') });
	const countText = (c: number) => (c === Infinity ? 'until stopped' : `${c}`);
	// Every amount on this sheet is the FULL currency string — Stake's review (2026-09-20) bars
	// K/M abbreviation on any bet-level readout. The long ones are fitted, not abbreviated:
	// the grand total shrinks to a floor (it is the number the player is deciding on, so it never
	// disappears), and the per-count sub-line under a chip drops when it cannot be fitted — that
	// same number is one tap away on the chip's own total row.
	const totalText = $derived(count === Infinity ? 'UNTIL STOPPED' : numberToCurrencyString(count * perSpin));
	const perSpinText = $derived(numberToCurrencyString(perSpin));
	// chip cell width, mirroring the CSS: panel width − padding − 3 gaps, over 4 columns, less the
	// chip's own side padding
	const panelW = $derived(low ? vw - 8 : wide ? Math.min(560, vw * 0.94) : Math.min(portrait ? 412 : 480, vw * (portrait ? 1 : 0.94)));
	// LOW's two columns, mirroring its CSS: the panel less its 1 px border and 10 px padding a side, less the 10 px column
	// gap, split 1.25 : 1
	const lowInner = $derived(panelW - 2 - 20 - 10);
	const lowLeft = $derived((lowInner * 1.25) / 2.25);
	const lowRight = $derived(lowInner / 2.25);
	// (HUD round 5: the chips in the panel's glass, the two-column phone panel's half width; LOW: 4 chips and 3 gaps of 5 in
	// the left column, less each chip's border and 2 px side padding)
	const chipW = $derived(low ? (lowLeft - 3 * 5) / 4 - 6 : wide ? ((panelW - 32 - 18) / 2 - 3 * 6) / 4 - 6 : (panelW - 2 * (portrait ? 14 : 20) - 3 * 8) / 4 - 6);
	const subFont = (text: string) => fitFont({ text, nominal: wide ? 8 : 9, box: chipW, minScale: 0.9, weight: 900, letterSpacing: 0, face: UI_TEXT_FACE });
	// the total row: label + value share the row, so the value gets a little over half of it. LOW: the label has its own
	// line, the value shares the second with the "25 x $1.00" line (.math, 9.5 px, 0.04em, 9 px gap)
	const mathText = $derived(count === Infinity ? 'until stopped' : `${count} x ${perSpinText}`);
	const totalBox = $derived(
		low ? lowRight - 4 - measureFitText(mathText, 9.5, 900, 0.38, UI_TEXT_FACE) - 9 : wide ? (panelW - 50) / 2 - 4 : panelW - 2 * (portrait ? 14 : 20) - 4,
	);
	// (LOW: when a long amount cannot sit beside that line at 11 px, the line wraps above it and the amount takes the
	// whole column)
	const besideFont = $derived(low ? (fitFont({ text: totalText, nominal: 14, box: totalBox, weight: 900, face: UI_TEXT_FACE }) ?? 0) : 0);
	const totalFont = $derived(
		low
			? besideFont >= 11
				? besideFont
				: (fitFont({ text: totalText, nominal: 14, box: lowRight - 4, floor: 11, weight: 900, face: UI_TEXT_FACE }) ?? 11)
			: (fitFont({ text: totalText, nominal: wide ? 17 : portrait ? 18 : 20, box: totalBox * 0.58, floor: 12, weight: 900, face: UI_TEXT_FACE }) ?? 12),
	);
	// LOW's LOAD: the words on one line, the amount under them, each fitted to the button's inside (its 1 px border and
	// 8 px padding a side), never clipped
	const goWords = $derived(count === Infinity ? 'LOAD AUTO SPINS' : `LOAD ${countText(count)} AUTO SPINS`);
	const goInner = $derived(lowRight - 2 - 16);
	const goFont = $derived(fitFont({ text: goWords, nominal: 10.5, box: goInner, floor: 8.5, weight: 900, letterSpacing: 0.63, face: UI_TEXT_FACE }) ?? 8.5);
	const goAmtFont = $derived(fitFont({ text: totalText, nominal: 12, box: goInner, floor: 8.5, weight: 900, letterSpacing: 0.48, face: UI_TEXT_FACE }) ?? 8.5);
	// HEAD: the mode pill carries a price, so it is never clipped — and the AUTOPLAY title is never
	// truncated either (review 2026-09-20). When the two cannot share the row the pill drops to its
	// own line under the title. A canvas estimate of the three boxes ran ~23 px pessimistic and
	// stacked the head on a Popout S that had room for it, so the widths come from the REAL
	// elements: `scrollWidth` on the two nowrap boxes is their CONTENT width in either state, and
	// the head is full-bleed in either state, so the measurement cannot oscillate with the class it
	// decides. The effect only WRITES its two state cells (house rule: never read-modify-write
	// shared state in an effect), and re-runs on the inputs that can change the content.
	let headEl: HTMLDivElement | undefined = $state();
	let titleEl: HTMLDivElement | undefined = $state();
	let pillEl: HTMLDivElement | undefined = $state();
	let xEl: HTMLButtonElement | undefined = $state();
	let headW = $state(0);
	let headNeedW = $state(0);
	const HEAD_GAP = 10;
	$effect(() => {
		// deps: anything that changes the head's content or the sheet's width
		void [pill.label, pill.cost, pill.unit, panelW, tiny, portrait, open];
		const h = headEl, t = titleEl, pi = pillEl, x = xEl;
		if (!h || !t || !pi || !x) return;
		untrack(() => {
			headW = h.clientWidth;
			headNeedW = t.scrollWidth + pi.scrollWidth + x.offsetWidth + 2 * HEAD_GAP;
		});
	});
	const headFits = $derived(headW === 0 || headNeedW <= headW);

	const load = () => {
		controls.loadAutoplay({ count, lossMult, winMult, stopFree: stopFreeOn, autoBonuses: stopFreeOn ? false : autoBonuses });
	};
	// reopening while a loadout waits: allow clearing it
	const hasLoadout = $derived(controls.autoLoadout() !== null);
</script>

{#snippet totalRow()}
	<div class="total">
		<span class="k">{soc('TOTAL BET AMOUNT', 'TOTAL PLAY AMOUNT')}</span>
		<span class="v-wrap"><span class="slot-num v" style:font-size="{totalFont}px">{totalText}</span><span class="slot-num math">{mathText}</span></span>
	</div>
{/snippet}

<ModalShell {open} onclose={close} {master} {scale} {left} {top} dim="rgba(6,4,10,0.55)" zIndex={3}>
	<div class="center" class:low style:gap="{low ? 4 : compact ? 10 : 14}px">
		<div class="panel am-glass" class:compact class:portrait class:wide class:tiny class:low onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="head" class:stacked={!headFits} bind:this={headEl}>
				<div class="title am-stencil" bind:this={titleEl}>AUTOPLAY</div>
				<div class="pill" bind:this={pillEl}><span class="mode">{shortMode(pill.label)}</span><i class="dot"></i><span class="slot-num cost">{pill.cost}</span><span class="per">{pill.unit}</span></div>
				<button class="slot-btn hg x" bind:this={xEl} onclick={() => (controls.sound('soundPressSub'), close())} aria-label="Close"><Icon name="close" s={16} /></button>
			</div>
			{#if unloads !== null}
				<div class="drop" data-auto-drop>LOAD unloads <b>{unloads}</b>. Autoplay plays base game spins, never a loaded feature.</div>
			{/if}

			<div class="cols"><div class="c1">
			<div class="sec">
				<div class="sec-label"><h3>Number of spins</h3><span class="hint">selecting only previews, nothing starts</span></div>
				<div class="chips four">
					{#each COUNTS as c (c)}
						{@const sub = c === Infinity ? 'until stopped' : numberToCurrencyString(c * perSpin)}
						{@const two = low && c === Infinity}
						{@const sf = subFont(two ? 'stopped' : sub)}
						<button class="slot-btn hg chip" class:on={count === c} onclick={() => (controls.sound('soundPressSub'), (count = c))}>
							<span class="slot-num big">{#if c === Infinity}<svg class="inf" viewBox="0 0 34 16" aria-label="until stopped"><path d="M17 8C14.2 4.4 11.9 2.6 9 2.6a5.4 5.4 0 0 0 0 10.8c2.9 0 5.2-1.8 8-5.4s5.1-5.4 8-5.4a5.4 5.4 0 0 1 0 10.8c-2.9 0-5.2-1.8-8-5.4z" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" /></svg>{:else}{countText(c)}{/if}</span>
							{#if sf !== null}<span class="slot-num sub" class:two style:font-size="{sf}px">{sub}</span>{/if}
						</button>
					{/each}
				</div>
			</div>

			{#if !low}{@render totalRow()}{/if}
			</div><div class="c2">

			<div class="fold" class:open={advanced}>
				<button class="slot-btn hg fold-row" onclick={() => { controls.sound('soundPressSub'); advanced = !advanced; }} aria-expanded={advanced}>
					<span class="fold-k">Stop options</span>
					<span class="fold-sum">{advSummary}</span>
					<span class="chev" class:down={advanced}><Icon name="chevronRight" s={16} /></span>
				</button>

				{#if advanced}
					<div class="fold-body">
						<div class="sec">
							<div class="sec-label"><h3>Stop on loss</h3><span class="hint">run stops if net loss reaches this</span></div>
							<div class="chips six">
								{#each LIMITS as m (m)}
									<button class="slot-btn hg lim" class:on={lossMult === m} class:off={m === null} onclick={() => (controls.sound('soundPressSub'), (lossMult = m))}>
										<span class="slot-num">{m === null ? 'OFF' : `${m}x`}</span>
									</button>
								{/each}
							</div>
						</div>

						<div class="sec">
							<div class="sec-label"><h3>Stop on single win</h3><span class="hint">run stops if one spin wins this much</span></div>
							<div class="chips six">
								{#each LIMITS as m (m)}
									<button class="slot-btn hg lim" class:on={winMult === m} class:off={m === null} onclick={() => (controls.sound('soundPressSub'), (winMult = m))}>
										<span class="slot-num">{m === null ? 'OFF' : `${m}x`}</span>
									</button>
								{/each}
							</div>
						</div>

						<button class="slot-btn hg toggle" class:on={stopFreeOn} onclick={() => { controls.sound('soundPressSub'); stopFree = !stopFree; if (stopFree) autoBonuses = false; }} role="switch" aria-checked={stopFreeOn}>
							<span class="t-text">
								<span class="t-main">Stop on Free Games</span>
								<span class="t-sub">Autoplay ends when a feature triggers (it still plays out)</span>
							</span>
							<span class="knob"></span>
						</button>
						<button class="slot-btn hg toggle" class:on={autoBonuses && !stopFreeOn} disabled={stopFreeOn} onclick={() => (controls.sound('soundPressSub'), (autoBonuses = !autoBonuses))} role="switch" aria-checked={autoBonuses && !stopFreeOn}>
							<span class="t-text">
								<span class="t-main">Autoplay Bonuses</span>
								<span class="t-sub" class:warn={stopFreeOn}>{stopFreeOn ? 'Unavailable: turn off Stop on Free Games first' : 'Feature screens continue on their own while autoplay runs'}</span>
							</span>
							<span class="knob"></span>
						</button>
					</div>
				{/if}
			</div>

			<!-- LOW: the total sits over LOAD in the right column (the left one is the spin counts' whole height) -->
			{#if low}{@render totalRow()}{/if}

			<button class="slot-btn hg go" onclick={load}>
				{#if low}
					<!-- LOW: the same words and amount, the words over the amount, each fitted to the button -->
					<span class="gl" style:font-size="{goFont}px">{#if count === Infinity}LOAD AUTO SPINS{:else}LOAD <span class="slot-num n">{countText(count)}</span> AUTO SPINS{/if}</span>
					{#if count !== Infinity}<span class="slot-num n mv" style:font-size="{goAmtFont}px">{totalText}</span>{/if}
				{:else if count === Infinity}LOAD AUTO SPINS{:else}LOAD <span class="slot-num n">{countText(count)}</span> AUTO SPINS<i class="dot"></i><span class="slot-num n mv">{totalText}</span>{/if}
			</button>
			<div class="cap">Loads to the Spin button. Pressing Spin starts the run; pressing again stops it.</div>
			{#if hasLoadout}
				<!-- a run already parked on the Spin button: LOAD above replaces it, this clears it -->
				<button class="slot-btn hg unload" onclick={() => { controls.sound('soundPressSub'); controls.clearAutoplay(); close(); }}>UNLOAD CURRENT AUTO SPINS</button>
			{/if}
			</div></div>
		</div>
		<div class="stepper" onclick={(e) => e.stopPropagation()} role="presentation">
			<BetAdjuster {controls} {compact} pressSound="soundPressSub" glass autoRun />
		</div>
	</div>
</ModalShell>

<style>
	/* THE AUTOPLAY MENU in the HUD's glass (HUD round 5, "Drop 6", 2026-11-12): the panel frame is ChromeStyles .am-glass
	   (the HUD's obsidian glass); every part inside wears the HUD's own pieces: glass chips with the 1 px white-top /
	   gold-bottom edge, a gold rim on the chosen one, the Spin's gold-edged glass for LOAD, glass toggles. Every colour is
	   a ui/hudTheme.ts token. Content and behaviour as before. Desktop and tablet: a panel over the board; portrait: a sheet
	   from the bottom (the bet stepper over it); phone sideways: a wide, low panel in two columns. */
	.center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 6px;
		box-sizing: border-box;
		pointer-events: none;
		font-family: var(--hud-font);
	}
	.stepper {
		pointer-events: auto;
	}
	.panel {
		width: 480px;
		max-width: 94vw;
		max-height: 86vh;
		box-sizing: border-box;
		pointer-events: auto;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 20px 16px;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;
		--lab: rgba(var(--hud-label-rgb), 0.74);
	}
	.panel::-webkit-scrollbar {
		display: none;
	}
	.panel::before {
		content: '';
		position: absolute;
		left: 24px;
		right: 24px;
		top: 2px;
		height: 1px;
		background: linear-gradient(90deg, rgba(var(--hud-ink-rgb), 0), rgba(var(--hud-ink-rgb), 0.34), rgba(var(--hud-ink-rgb), 0));
		pointer-events: none;
	}
	.panel > *,
	.c1 > *,
	.c2 > * {
		min-width: 0;
	}
	.cols,
	.c1,
	.c2 {
		display: contents;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.head > * {
		min-width: 0;
	}
	.title {
		flex: 0 0 auto;
		font-family: var(--hud-font-title);
		font-size: 21px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: rgb(var(--hud-accent-hi-rgb));
		text-shadow: 0 1px 2px rgba(var(--hud-shadow-rgb), 0.7);
		white-space: nowrap;
	}
	.head.stacked {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-areas: 'title x' 'pill pill';
		justify-items: start;
		align-items: center;
		row-gap: 8px;
	}
	.head.stacked .title {
		grid-area: title;
	}
	.head.stacked .pill {
		grid-area: pill;
	}
	.head.stacked .x {
		grid-area: x;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 24px;
		border-radius: 999px;
		padding: 0 11px;
		border: 1px solid;
		border-color: rgba(var(--hud-key-rim-rgb), var(--hud-key-rim-a));
		background: rgba(var(--hud-ink-rgb), 0.05);
		color: rgba(var(--hud-label-warm-rgb), 0.9);
		flex: 0 0 auto;
		font-size: 9.5px;
		font-weight: 900;
		letter-spacing: 0.14em;
		white-space: nowrap;
	}
	.dot {
		flex: none;
		display: inline-block;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: rgb(var(--hud-accent-hi-rgb));
	}
	.pill .cost {
		font-family: var(--hud-font);
		color: rgb(var(--hud-accent-hi-rgb));
		letter-spacing: 0.04em;
	}
	.pill .per {
		letter-spacing: 0.1em;
	}
	/* glass pieces: the HUD key's fill and per-side edge */
	.x,
	.chip,
	.lim,
	.fold-row {
		border: 1px solid;
		border-color: rgba(var(--hud-key-rim-rgb), var(--hud-key-rim-a));
		background: radial-gradient(ellipse 90% 80% at 50% 0%, rgba(var(--hud-ink-rgb), 0.17), rgba(var(--hud-ink-rgb), 0.04) 72%), rgba(var(--hud-key-rgb), 0.38);
		color: rgba(var(--hud-ink-rgb), 0.94);
		box-shadow: inset 0 1px 0 rgba(var(--hud-ink-rgb), 0.1), 0 1px 3px rgba(var(--hud-shadow-rgb), 0.4);
		transition: border-color 0.16s, box-shadow 0.16s, transform 0.12s;
	}
	@media (hover: hover) and (pointer: fine) {
		.x:hover,
		.chip:hover:not(.on),
		.lim:hover:not(.on),
		.fold-row:hover {
			border-color: rgba(var(--hud-key-rim-rgb), 0.55);
			box-shadow: inset 0 1px 0 rgba(var(--hud-ink-rgb), 0.18), 0 0 14px rgba(var(--hud-accent-rgb), 0.18), 0 1px 3px rgba(var(--hud-shadow-rgb), 0.4);
		}
	}
	.x:active,
	.chip:active,
	.lim:active {
		transform: scale(0.96);
	}
	.x {
		flex: 0 0 auto;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.sec {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.sec-label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 10px;
	}
	.sec-label h3 {
		margin: 0;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.24em;
		color: var(--lab);
		text-transform: uppercase;
		white-space: nowrap;
	}
	.hint {
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.02em;
		color: rgba(var(--hud-label-rgb), 0.5);
		text-align: right;
	}
	.chips {
		display: grid;
		gap: 8px;
	}
	.chips.four {
		grid-template-columns: repeat(4, 1fr);
	}
	.chips.six {
		grid-template-columns: repeat(6, 1fr);
		gap: 6px;
	}
	.chip {
		min-width: 0;
		height: 54px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 0 4px;
		border-radius: var(--hud-radius-chip);
	}
	.chip .big {
		display: flex;
		align-items: center;
		height: 18px;
		font-family: var(--hud-font);
		font-size: 18px;
		font-weight: 900;
		line-height: 1;
	}
	.chip .big .inf {
		display: block;
		width: 30px;
		height: 15px;
	}
	.chip .sub {
		font-family: var(--hud-font);
		font-weight: 900;
		font-size: 9px;
		letter-spacing: 0.03em;
		color: rgba(var(--hud-label-rgb), 0.64);
		white-space: nowrap;
		max-width: 100%;
	}
	/* the chosen one: a gold rim and warmer glass (no solid fill: the HUD's chosen state) */
	.chip.on,
	.lim.on {
		border-color: rgba(var(--hud-accent-rgb), 0.9);
		background: radial-gradient(ellipse 90% 100% at 50% 0%, rgba(var(--hud-accent-cream-rgb), 0.32), rgba(var(--hud-ink-rgb), 0.06) 76%), rgba(var(--hud-feature-on-deep-1-rgb), 0.6);
		box-shadow: inset 0 1px 0 rgba(var(--hud-accent-cream-rgb), 0.32), 0 0 14px rgba(var(--hud-accent-rgb), 0.32), 0 1px 3px rgba(var(--hud-shadow-rgb), 0.4);
		color: rgb(var(--hud-ink-rgb));
	}
	.chip.on .sub {
		color: rgb(var(--hud-accent-hi-rgb));
	}
	.lim {
		min-width: 0;
		height: 32px;
		padding: 0 2px;
		border-radius: 999px;
		font-family: var(--hud-font);
		font-size: 11px;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-align: center;
	}
	.lim .slot-num {
		font-family: var(--hud-font);
	}
	.total {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 12px 2px;
		border-top: 1px solid rgba(var(--hud-ink-rgb), 0.08);
		border-bottom: 1px solid rgba(var(--hud-ink-rgb), 0.08);
	}
	.total .k {
		font-size: 9.5px;
		font-weight: 900;
		letter-spacing: 0.2em;
		color: var(--lab);
		white-space: nowrap;
	}
	.v-wrap {
		display: flex;
		flex-wrap: wrap-reverse;
		justify-content: flex-end;
		align-items: baseline;
		gap: 9px;
		white-space: nowrap;
	}
	.v-wrap .v {
		order: 2;
	}
	.total .v {
		font-family: var(--hud-font);
		font-size: 20px;
		font-weight: 900;
		color: rgb(var(--hud-ink-rgb));
	}
	.total .math {
		font-family: var(--hud-font);
		font-weight: 900;
		font-size: 10px;
		letter-spacing: 0.04em;
		color: rgba(var(--hud-label-rgb), 0.6);
	}
	.fold {
		display: flex;
		flex-direction: column;
	}
	.fold-row {
		width: 100%;
		min-height: 46px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 0 14px 0 16px;
		border-radius: var(--hud-radius-chip);
		text-align: left;
	}
	.fold.open .fold-row {
		border-color: rgba(var(--hud-accent-rgb), 0.75);
	}
	.fold-row > * {
		min-width: 0;
	}
	.fold-k {
		font-size: 11px;
		font-weight: 900;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.fold-sum {
		flex: 1;
		font-size: 10.5px;
		font-weight: 900;
		letter-spacing: 0.02em;
		color: rgba(var(--hud-label-rgb), 0.62);
		text-align: right;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chev {
		flex: 0 0 auto;
		display: inline-flex;
		color: rgb(var(--hud-accent-hi-rgb));
		transform: rotate(90deg);
		transition: transform 0.2s ease;
	}
	.chev.down {
		transform: rotate(-90deg);
	}
	.fold-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px 2px 2px;
	}
	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 44px;
		padding: 0 2px;
		background: none;
		border-bottom: 1px solid rgba(var(--hud-ink-rgb), 0.08);
		color: rgb(var(--hud-ink-rgb));
		text-align: left;
		min-width: 0;
	}
	.toggle:disabled {
		opacity: 0.55;
	}
	.t-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.t-main {
		font-size: 12px;
		font-weight: 900;
		letter-spacing: 0.03em;
	}
	.t-sub {
		font-size: 10px;
		font-weight: 900;
		line-height: 1.35;
		letter-spacing: 0.01em;
		color: rgba(var(--hud-label-rgb), 0.5);
		text-wrap: pretty;
	}
	.t-sub.warn {
		color: rgb(var(--hud-feature-rim-rgb));
	}
	.knob {
		flex: 0 0 auto;
		position: relative;
		width: 46px;
		height: 26px;
		border-radius: 999px;
		border: 1px solid;
		border-color: rgba(var(--hud-key-rim-rgb), var(--hud-key-rim-a));
		background: rgba(var(--hud-panel-bottom-rgb), 0.62);
		box-shadow: inset 0 2px 4px rgba(var(--hud-shadow-rgb), 0.6);
		transition: background-color 0.2s, border-color 0.2s;
	}
	.knob::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		box-sizing: border-box;
		border: 1px solid;
		border-color: rgba(var(--hud-ink-rgb), 0.5);
		background: radial-gradient(circle at 50% 22%, rgba(var(--hud-ink-rgb), 0.6), rgba(var(--hud-ink-rgb), 0.08) 68%), rgba(var(--hud-glass-top-rgb), 0.92);
		box-shadow: 0 2px 4px rgba(var(--hud-shadow-rgb), 0.6), inset 0 1px 0 rgba(var(--hud-ink-rgb), 0.4);
		transition: transform 0.2s;
	}
	.toggle.on .knob {
		border-color: rgba(var(--hud-accent-rgb), 0.75);
		background: linear-gradient(90deg, rgba(var(--hud-accent-deep-rgb), 0.75), rgba(var(--hud-accent-rgb), 0.6));
		box-shadow: inset 0 1px 3px rgba(var(--hud-shadow-rgb), 0.4), 0 0 10px rgba(var(--hud-accent-rgb), 0.3);
	}
	.toggle.on .knob::after {
		transform: translateX(20px);
	}
	/* LOAD: the Spin's gold-edged glass, wide; UNLOAD a small ember capsule */
	.go {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 11px;
		width: 100%;
		min-height: 52px;
		padding: 0 18px;
		border-radius: 999px;
		border: 1px solid;
		border-color: var(--hud-spin-rim-side);
		color: rgb(var(--hud-ink-rgb));
		font-size: 13.5px;
		font-weight: 900;
		letter-spacing: 0.14em;
		white-space: nowrap;
		background: radial-gradient(ellipse 70% 120% at 50% 0%, rgba(var(--hud-accent-cream-rgb), 0.3), rgba(var(--hud-accent-cream-rgb), 0) 62%), radial-gradient(ellipse 70% 100% at 50% 130%, rgba(var(--hud-accent-rgb), 0.36), rgba(var(--hud-accent-rgb), 0) 70%), linear-gradient(180deg, rgba(var(--hud-spin-core-rgb), 0.94), rgba(var(--hud-spin-deep-rgb), 0.95));
		box-shadow: inset 0 1px 0 rgba(var(--hud-accent-cream-rgb), 0.5), inset 0 0 16px rgba(var(--hud-accent-rgb), 0.16), 0 0 18px rgba(var(--hud-accent-rgb), 0.2), 0 6px 14px rgba(var(--hud-shadow-rgb), 0.5);
		transition: transform 0.12s, box-shadow 0.2s;
	}
	.go:active {
		transform: scale(0.98);
	}
	.go .n {
		font-family: var(--hud-font);
		letter-spacing: 0.04em;
	}
	.go .mv {
		color: rgb(var(--hud-accent-hi-rgb));
	}
	.go .dot {
		width: 5px;
		height: 5px;
	}
	.unload {
		align-self: center;
		height: 34px;
		border-radius: 999px;
		padding: 0 16px;
		border: 1px solid;
		border-color: rgba(var(--hud-feature-rim-rgb), 0.46);
		background: linear-gradient(180deg, rgba(var(--hud-feature-deep-1-rgb), 0.8), rgba(var(--hud-feature-deep-2-rgb), 0.86));
		box-shadow: inset 0 0 12px rgba(var(--hud-feature-rgb), 0.45);
		font-size: 10.5px;
		font-weight: 900;
		letter-spacing: 0.14em;
		color: rgb(var(--hud-ink-rgb));
		margin-top: -2px;
	}
	/* the footer line steps aside while the fold is open: the 720-tall landscape master has no room for both */
	.fold.open ~ .cap {
		display: none;
	}
	/* the loaded feature LOAD unloads: shown at every size (the cap below steps aside on phones, this line never does) */
	.drop {
		margin: -4px 2px 0;
		text-align: center;
		font-size: 11px;
		font-weight: 800;
		line-height: 1.35;
		letter-spacing: 0.02em;
		color: rgba(var(--hud-label-rgb), 0.85);
	}
	.drop b {
		color: rgb(var(--hud-feature-rim-rgb));
		font-weight: 900;
	}
	.tiny .drop {
		font-size: 9.5px;
	}
	.cap {
		margin: -2px 4px 0;
		text-align: center;
		font-size: 10px;
		font-weight: 900;
		line-height: 1.45;
		letter-spacing: 0.02em;
		color: rgba(var(--hud-label-rgb), 0.6);
	}

	/* ── compact (phone sideways and portrait): the gaps tighten ── */
	.compact {
		gap: 10px;
	}

	/* ── phone sideways: wide and low, two columns (the head across both) ── */
	.wide {
		width: 560px;
		padding: 10px 16px 12px;
		border-radius: 18px;
		gap: 6px;
	}
	.wide .cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 18px;
		align-items: start;
	}
	.wide .c1,
	.wide .c2 {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.wide .chips.four {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}
	.wide .chip .sub {
		letter-spacing: 0;
	}
	.wide .title {
		font-size: 17px;
	}
	.wide .pill {
		height: 22px;
		font-size: 8.5px;
		padding: 0 9px;
	}
	.wide .x {
		width: 32px;
		height: 32px;
	}
	.wide .hint,
	.wide .t-sub:not(.warn) {
		display: none;
	}
	.wide .chips.four {
		gap: 6px;
	}
	.wide .chip {
		height: 42px;
		border-radius: 12px;
		gap: 4px;
	}
	.wide .chip .big {
		font-size: 15px;
		height: 15px;
	}
	.wide .total {
		padding: 9px 2px;
	}
	.wide .total .v {
		font-size: 17px;
	}
	.wide .fold-row {
		min-height: 38px;
		border-radius: 12px;
		padding: 0 10px 0 12px;
	}
	.wide .lim {
		height: 26px;
		font-size: 9.5px;
		letter-spacing: 0;
	}
	.wide .toggle {
		min-height: 32px;
	}
	.wide .go {
		min-height: 40px;
		font-size: 11px;
		letter-spacing: 0.12em;
	}
	.wide .cap {
		font-size: 8.5px;
	}

	/* ── tiny (Stake Popout S, 400x225): the explanatory lines step aside, the sheet scrolls ── */
	.tiny {
		gap: 7px;
		padding: 10px 12px 12px;
		max-height: 68vh;
	}
	.tiny .hint,
	.tiny .cap,
	.tiny .t-sub:not(.warn) {
		display: none;
	}
	.tiny .title {
		font-size: 15px;
	}
	.tiny .chip {
		height: 40px;
	}
	.tiny .go {
		min-height: 40px;
		font-size: 12px;
	}
	.tiny .x {
		width: 30px;
		height: 30px;
	}

	/* LOW (the phone held sideways at Popout S height, 400x225: `wide` and `tiny`; see the script): no scroll. The sheet
	   takes the height the stepper leaves (it shrinks and scrolls only for a loaded feature's line or a parked run's
	   UNLOAD), the spin counts the wider left column, STOP OPTIONS, the total and LOAD the right one. Every size in px
	   here is mirrored by the script's lowInner, chipW, totalBox and goInner. */
	.center.low {
		padding: 4px;
	}
	/* the stepper's own 8 px padding above and below its 38 px keys tightens to 2 (BetAdjuster writes it inline) */
	.center.low .stepper :global(.adj) {
		padding-top: 2px !important;
		padding-bottom: 2px !important;
	}
	.panel.low {
		width: 100%;
		max-width: 100%;
		max-height: none;
		flex: 0 1 auto;
		min-height: 0;
		padding: 6px 10px;
		gap: 4px;
	}
	.low .cols {
		grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
		gap: 10px;
	}
	.low .c1,
	.low .c2 {
		gap: 4px;
	}
	.low .sec {
		gap: 5px;
	}
	.low .chips.four {
		gap: 5px;
	}
	.low .chip {
		padding: 0 2px;
	}
	.low .chip .sub.two {
		white-space: normal;
		line-height: 1.05;
		text-align: center;
	}
	.low .fold-row {
		min-height: 36px;
		gap: 6px;
		padding: 0 8px 0 10px;
	}
	.low .fold-k {
		font-size: 10px;
		letter-spacing: 0.12em;
	}
	/* the closed row's summary had no room left at this width (it showed as a bare rule); the fold opens by itself
	   whenever a stop is set, so nothing set is ever hidden */
	.low .fold-sum {
		display: none;
	}
	.low .chev {
		margin-left: auto;
	}
	.low .total {
		flex-direction: column;
		flex-wrap: nowrap;
		align-items: stretch;
		gap: 2px;
		padding: 2px;
		border-bottom: 0;
		line-height: 1.1;
	}
	.low .total .k {
		font-size: 8.5px;
		letter-spacing: 0.1em;
	}
	.low .total .math {
		font-size: 9.5px;
	}
	.low .go {
		flex-direction: column;
		gap: 1px;
		min-height: 40px;
		padding: 0 8px;
		line-height: 1.1;
	}
	.low .go .gl {
		letter-spacing: 0.06em;
		white-space: nowrap;
	}
	.low .go .mv {
		letter-spacing: 0.04em;
	}

	/* ── portrait: a sheet that rises from the bottom, the bet stepper over it; no scroll ── */
	.center:has(.portrait) {
		justify-content: flex-end;
		padding-bottom: 0;
	}
	.center:has(.portrait) .stepper {
		order: -1;
	}
	.portrait {
		width: 100%;
		max-width: 412px;
		padding: 14px 14px max(16px, env(safe-area-inset-bottom, 0px));
		gap: 10px;
		border-radius: 22px 22px 0 0;
		border-bottom: 0;
	}
	.portrait .hint,
	.portrait .t-sub,
	.portrait .cap {
		display: none;
	}
	.portrait .t-sub.warn {
		display: block; /* an unavailable toggle still says why */
	}
	.portrait .title {
		font-size: 17px;
		letter-spacing: 0.06em;
	}
	.portrait .pill {
		font-size: 8.5px;
		letter-spacing: 0.1em;
		padding: 0 9px;
	}
	.portrait .chips.four {
		gap: 7px;
	}
	.portrait .chip {
		height: 50px;
	}
	.portrait .chip .big {
		font-size: 16px;
	}
	.portrait .chips.six {
		gap: 5px;
	}
	/* touch: 40 px limit chips and close on a phone */
	.portrait .lim {
		height: 40px;
		font-size: 10px;
	}
	.portrait .x {
		width: 40px;
		height: 40px;
	}
	.portrait .total {
		padding: 10px 2px;
	}
	.portrait .total .v {
		font-size: 18px;
	}
	.portrait .fold-row {
		min-height: 44px;
	}
	.portrait .go {
		min-height: 50px;
		font-size: 12.5px;
	}
</style>
