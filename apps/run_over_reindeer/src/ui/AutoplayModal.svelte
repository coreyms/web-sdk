<script lang="ts">
	import { soc } from '../game/social';
	// Autoplay menu (design approved 2026-08-26): configure a run, preview its TRUE total, then START it. Since 2026-11-23
	// (Corey: "What would it take to make that the Start Auto-play button and not have the load to button state?") the
	// key begins the run at once (ui/controls.svelte.ts startAutoplay); until then it loaded the run onto the Spin key and
	// the Spin press started it. The key names the count and the total, and pressing it in this menu is the player's
	// confirmation. Loss/win stops are multiples of one
	// spin's play amount. AUTOPLAY NEVER PLAYS A LOADED FEATURE (2026-11-19, ui/controls.svelte.ts autoSpinCost): with
	// Free Spins or Super Free Spins loaded the sheet prices the base game the run will play, says START unloads the
	// feature, and Stop on Free Games is available as always (until 2026-11-19 the sheet priced the loaded feature and
	// switched that toggle off, though the run has always played base spins).
	// THE SIGN CARD (2026-11-23; Corey's pick from the mock menus_r1_2026-11-23, style A "Guide sign": "I like the green
	// menus ... Just green everywhere."): the card is a green guide sign in the sign bar's own language (ui/sign/
	// signPanel.css, ui/hudTheme.ts SIGN_PANEL): the count tiles, the limit chips, the close key and the STOP OPTIONS row
	// are small dark plates set into the field, the chosen one a white plate; START is the Turbo yellow key; the two
	// switches' knobs turn yellow when on. The mock's mock.css is the spec. Content, wording and behaviour as before: the
	// sheet opens on the spin count, the true total and START; the loss stop, the single-win stop and the two switches
	// live behind the STOP OPTIONS fold whose closed row summarises what is set, and the sheet opens unfolded whenever
	// something non-default is set (a stop is never hidden). Until then this card wore the glass dock's blue-grey glass.
	// THE LAYOUTS (ui/sign/signPanelLayout.ts autoClass; the mock's own, and what it left for the windows it did not show):
	//   desk      a desktop window 760 px tall or more: a 480 px card over the board, the amount stepper under it
	//   short     a desktop window from 670 to 760 tall (Stake's 1200 x 675): the two switches side by side and lower
	//             tiles, so the open STOP OPTIONS fit with no scroll (the mock's departure)
	//   wide      a phone held sideways, and a desktop window under 670 tall (Stake's 1024 x 576): a wide, low card in
	//             two columns, the amount stepper in the card's head row (the mock's departure: under the card the open
	//             STOP OPTIONS pushed START off the window once every press box is 44 px)
	//   portrait  an upright phone or tablet: a sheet from the bottom, the amount stepper over it
	//   low       Stake's Popout S (400 x 225: the sideways layout under 300 px tall), the small sizes fix of 2026-11-22
	//             (wip/smallsizes, Corey "AO Yes"), kept and drawn in the sign style: the spin counts take the wider
	//             left column (1.25 : 1), the right column holds STOP OPTIONS, the total (its word over its amount) and
	//             START (its words over its amount, each fitted to the key), a tightened stepper stands under the card,
	//             and with STOP OPTIONS shut nothing scrolls and nothing is cut
	// Every press box on a touch layout is 44 CSS px or more (the limit chips, the close key and the stepper keys were
	// 40, 40 and 38); Popout S, a mouse's mini player, keeps its smaller keys. Where a window is too short for the mock's
	// own numbers the gaps close up first (`snug`: sideways under 390 tall, upright under 724), and where the open STOP
	// OPTIONS still do not fit the card scrolls inside itself, as it did before; it never leaves the window. That is:
	// Popout S; a sideways window under 693 px wide (568 x 320, 667 x 375: the narrow card), one from 693 to 811 wide
	// and under 409 tall, one 812 or wider and under 365 tall; an upright window under 628 tall (413 x 586, 390 x 620,
	// 320 x 568). With STOP OPTIONS shut it fits every window with no scroll, and every tile keeps its price line.
	import { untrack } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateModal } from 'state-shared';
	import { numberToCurrencyString } from '../game/currency';

	import { modeChipData } from '../game/modeChipData';
	import { fitFont, measureFitText } from '../game/textFit';
	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import BetAdjuster from './BetAdjuster.svelte';
	import HudIcon from './hud/HudIcon.svelte';
	import { AUTO_SUB_MIN, autoClass, autoGeometry } from './sign/signPanelLayout';
	import './hudTheme';
	import './sign/signPanel.css';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top, compact = false }: Props = $props();
	// compact covers the phone held sideways (1480 x 740) and portrait (412 x 760); only portrait is narrow
	const portrait = $derived(master.width < master.height);
	// ModalShell's frame is the VIEWPORT (Stake review FIX 5), so the sheet sizes itself against
	// real CSS px: `tiny` is Stake's Popout S band (400 x 225), where the sheet scrolls and the
	// secondary lines step aside so the numbers stay legible.
	const vw = $derived(innerWidth.current ?? 1280);
	const vh = $derived(innerHeight.current ?? 720);
	const tiny = $derived(vh < 300 || vw < 360);
	const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
	// the armed-mode pill reads "MYSTERY, $300.00 / SPIN", not "MYSTERY SPIN, $300.00 / SPIN":
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

	/** the loaded feature START will unload ("SUPER FREE SPINS"), or null */
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

	// ---- the layout class and the widths the fits below measure against (the style block's own numbers) ----
	const cls = $derived(autoClass({ compact, portrait, vh, coarse, drop: unloads !== null }));
	const wide = $derived(cls === 'wide');
	const touch = $derived(compact || coarse || wide);
	// LOW (2026-11-22, the small sizes fix, wip/smallsizes, Corey "AO Yes"): the sideways card at Popout S height (400 x
	// 225, `wide` and `tiny` together). There the sheet over the stepper left the last tile row cut, the main key's
	// label ran out of its key and the 100 to unlimited tiles had no room for their price lines. In LOW the card fits
	// with no scroll while STOP OPTIONS is shut: see the layouts above (a loaded feature's line and the open STOP
	// OPTIONS still scroll inside it). Every size in px in the style block is mirrored by ui/sign/signPanelLayout.ts
	// autoGeometry (the card, its columns, lowInner, a tile's text box chipW), which the fits below measure against.
	const G = $derived(autoGeometry({ cls, vw, tiny }));
	const low = $derived(G.low);
	/** two columns: the wide card and LOW */
	const twoCol = $derived(wide);
	/** a narrow wide card (the small sideways phones, 568 x 320 and 667 x 375): LOW's column split, the limit chips
	 *  three to a row (44 px wide and more), START's words over its amount */
	const narrow = $derived(G.narrow);
	const panelW = $derived(G.panelW);
	const padX = $derived(G.padX);
	const c1W = $derived(G.c1W);
	const c2W = $derived(G.c2W);
	/** the two switches side by side: the short desktop card, and the wide card where its right column has the room for
	 *  their words (the mock's 760 px card); one over the other everywhere else */
	const tgRow = $derived(G.tgRow);
	/** the gaps close up where the open card at the mock's own numbers is taller than the window: the wide card is 370
	 *  px tall with STOP OPTIONS open (44 more with the switches one over the other), the upright sheet and its stepper
	 *  720 (40 more with the unload line) */
	const snug = $derived(low ? false : wide ? vh - 10 < 370 + (tgRow ? 0 : 44) : cls === 'portrait' ? vh < 724 + (unloads !== null ? 40 : 0) : false);

	const perSpin = $derived(controls.autoSpinCost());
	const pill = $derived((unloads === null ? modeChipData() : null) ?? { label: 'BASE GAME', cost: numberToCurrencyString(perSpin), unit: soc('/ SPIN', '/ PLAY') });
	const countText = (c: number) => (c === Infinity ? 'until stopped' : `${c}`);
	// Every amount on this sheet is the FULL currency string: Stake's review (2026-09-20) bars
	// K/M abbreviation on any bet-level readout. The long ones are fitted, not abbreviated:
	// the grand total shrinks to a floor (it is the number the player is deciding on, so it never
	// disappears), and the per-count sub-line under a tile drops when it cannot be fitted (that
	// same number is one tap away on the tile's own total row). START's words shrink together to the key.
	const OVER = "'Overpass', sans-serif";
	const totalText = $derived(count === Infinity ? 'UNTIL STOPPED' : numberToCurrencyString(count * perSpin));
	const perSpinText = $derived(numberToCurrencyString(perSpin));
	// a tile's text box: the column less three gaps, over four tiles, less the tile's own side padding (3 px, 2 in LOW)
	// and line
	const chipW = $derived(G.chipW);
	// a tile's price line: 10 px (8 in LOW, as the small sizes fix drew it), no smaller than 0.9 of that; "until stopped"
	// goes on two lines where one does not fit (LOW, a 320 px wide phone), so every tile keeps its line
	const subNominal = $derived(G.subNominal);
	const subFont = (text: string) => fitFont({ text, nominal: subNominal, box: chipW, minScale: AUTO_SUB_MIN, weight: 900, letterSpacing: 0.02 * subNominal, face: OVER });
	const subLine = (text: string, until: boolean) => {
		const one = subFont(text);
		return one !== null || !until ? { px: one, two: false } : { px: subFont('stopped'), two: true };
	};
	// the total row: label + value share the row, so the value gets a little over half of it. LOW: the label has its own
	// line, the value shares the second with the "25 x $1.00" line (.math, 9.5 px, 0.03em, 9 px gap)
	const mathText = $derived(count === Infinity ? 'until stopped' : `${count} x ${perSpinText}`);
	const totalBox = $derived(low ? c2W - 4 - measureFitText(mathText, 9.5, 900, 0.285, OVER) - 9 : (c1W - 4) * 0.58);
	// (LOW: when a long amount cannot sit beside that line at 11 px, it wraps under the line and takes the whole column)
	const besideFont = $derived(low ? (fitFont({ text: totalText, nominal: 14, box: totalBox, weight: 900, face: OVER }) ?? 0) : 0);
	const totalFont = $derived(
		low
			? besideFont >= 11
				? besideFont
				: (fitFont({ text: totalText, nominal: 14, box: c2W - 4, floor: 11, weight: 900, face: OVER }) ?? 11)
			: (fitFont({ text: totalText, nominal: 22, box: totalBox, floor: 12, weight: 900, face: OVER }) ?? 12),
	);
	// START: its words and the total, as one line inside the key (never under 9 px)
	const goNominal = $derived(touch ? 13 : 14);
	const goFont = $derived(
		fitFont({ text: count === Infinity ? 'START AUTO SPINS' : `START ${count} AUTO SPINS${totalText}`, nominal: goNominal, box: c2W - 38 - (count === Infinity ? 0 : 27), floor: 9, weight: 900, letterSpacing: 0.1 * goNominal, face: OVER }) ?? goNominal,
	);
	// START WITH ITS WORDS OVER ITS AMOUNT (LOW, and the narrow wide card): the words on one line, the amount under them,
	// each fitted to the key's inside (its 3 px band and its padding: 8 px a side in LOW, 16 on the narrow card), never
	// clipped. LOW: 10.5 and 12 px, never under 8.5 (the small sizes fix's numbers); narrow: 12 and 13 px, never under 9
	const goStack = $derived(G.stack);
	const goWords = $derived(count === Infinity ? 'START AUTO SPINS' : `START ${countText(count)} AUTO SPINS`);
	const goInner = $derived(c2W - 6 - (low ? 16 : 32));
	const GO = $derived(low ? { words: 10.5, amt: 12, floor: 8.5 } : { words: 12, amt: 13, floor: 9 });
	const goLowFont = $derived(fitFont({ text: goWords, nominal: GO.words, box: goInner, floor: GO.floor, weight: 900, letterSpacing: 0.06 * GO.words, face: OVER }) ?? GO.floor);
	const goAmtFont = $derived(fitFont({ text: totalText, nominal: GO.amt, box: goInner, floor: GO.floor, weight: 900, letterSpacing: 0.04 * GO.amt, face: OVER }) ?? GO.floor);
	// HEAD: the mode pill carries a price, so it is never clipped, and the AUTOPLAY title is never
	// truncated either (review 2026-09-20). When they cannot share the row the pill drops to its
	// own line under the title. The widths come from the REAL elements: `scrollWidth` on the nowrap
	// boxes is their CONTENT width in either state, and the head is full-bleed in either state, so
	// the measurement cannot oscillate with the class it decides. The effect only WRITES its two
	// state cells (house rule: never read-modify-write shared state in an effect), and re-runs on
	// the inputs that can change the content. On the wide card the amount stepper stands in this row too.
	let headEl: HTMLDivElement | undefined = $state();
	let titleEl: HTMLDivElement | undefined = $state();
	let pillEl: HTMLDivElement | undefined = $state();
	let xEl: HTMLButtonElement | undefined = $state();
	let headW = $state(0);
	let headNeedW = $state(0);
	const HEAD_GAP = 10;
	$effect(() => {
		// deps: anything that changes the head's content or the sheet's width
		void [pill.label, pill.cost, pill.unit, panelW, tiny, cls, low, touch, perSpinText, open];
		const h = headEl, t = titleEl, pi = pillEl, x = xEl;
		if (!h || !t || !pi || !x) return;
		untrack(() => {
			const st = h.querySelector<HTMLElement>('.adj');
			headW = h.clientWidth;
			headNeedW = t.scrollWidth + pi.scrollWidth + x.offsetWidth + (st ? st.offsetWidth + HEAD_GAP : 0) + 2 * HEAD_GAP;
		});
	});
	const headFits = $derived(headW === 0 || headNeedW <= headW);

	const start = () => {
		controls.startAutoplay({ count, lossMult, winMult, stopFree: stopFreeOn, autoBonuses: stopFreeOn ? false : autoBonuses });
	};
</script>

{#snippet dropLine()}
	<div class="drop" data-auto-drop>START unloads <b>{unloads}</b>. Autoplay plays base game spins, never a loaded feature.</div>
{/snippet}

{#snippet totalRow()}
	<div class="total">
		<span class="sp-lab k">{soc('TOTAL BET AMOUNT', 'TOTAL PLAY AMOUNT')}</span>
		<span class="v-wrap"><span class="math">{mathText}</span><span class="sp-cap v" style:font-size="{totalFont}px">{totalText}</span></span>
	</div>
{/snippet}

<ModalShell {open} onclose={close} {master} {scale} {left} {top} dim="rgba(6,4,10,0.55)" zIndex={3}>
	<div class="center {cls}" class:touch class:snug class:narrow class:tiny class:low class:go-stack={goStack} class:tg-row={tgRow} data-auto-layout={low ? 'low' : cls}>
		<div class="sp sp-plate panel" style:--px="{padX}px" onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="head" class:stacked={!headFits} bind:this={headEl}>
				<div class="title" bind:this={titleEl}><span class="sp-cap">AUTOPLAY</span></div>
				<div class="sp-well pill" bind:this={pillEl}><span class="sp-cap mode">{shortMode(pill.label)}</span><i class="sp-dot dot"></i><span class="sp-cap cost">{pill.cost}</span><span class="sp-cap per">{pill.unit}</span></div>
				{#if wide && !low}<BetAdjuster {controls} pressSound="soundPressSub" autoRun bare touch />{/if}
				<button type="button" class="sp-well x" bind:this={xEl} onclick={() => (controls.sound('soundPressSub'), close())} aria-label="Close"><HudIcon name="x" /></button>
			</div>
			{#if unloads !== null && (!twoCol || low)}{@render dropLine()}{/if}

			<div class="cols"><div class="c1">
			<div class="sec">
				<div class="sec-label"><h3 class="sp-lab">Number of spins</h3><span class="hint">selecting only previews, nothing starts</span></div>
				<div class="chips four">
					{#each COUNTS as c (c)}
						{@const sub = c === Infinity ? 'until stopped' : numberToCurrencyString(c * perSpin)}
						{@const sf = subLine(sub, c === Infinity)}
						<button type="button" class="sp-well chip" class:on={count === c} onclick={() => (controls.sound('soundPressSub'), (count = c))}>
							<span class="big">{#if c === Infinity}<svg class="inf" viewBox="0 0 34 16" aria-label="until stopped"><path d="M17 8C14.2 4.4 11.9 2.6 9 2.6a5.4 5.4 0 0 0 0 10.8c2.9 0 5.2-1.8 8-5.4s5.1-5.4 8-5.4a5.4 5.4 0 0 1 0 10.8c-2.9 0-5.2-1.8-8-5.4z" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" /></svg>{:else}{countText(c)}{/if}</span>
							{#if sf.px !== null}<span class="sub" class:two={sf.two} style:font-size="{sf.px}px">{sub}</span>{/if}
						</button>
					{/each}
				</div>
			</div>

			{#if !low}{@render totalRow()}{/if}
			<!-- (the wide card: the unload line stands in the left column, which has the room) -->
			{#if unloads !== null && twoCol && !low}{@render dropLine()}{/if}
			</div><div class="c2">

			<div class="fold" class:open={advanced}>
				<button type="button" class="sp-well fold-row" onclick={() => { controls.sound('soundPressSub'); advanced = !advanced; }} aria-expanded={advanced}>
					<span class="sp-cap fold-k">Stop options</span>
					<span class="fold-sum">{advSummary}</span>
					<HudIcon name="chev" cls="chv" />
				</button>

				<!-- always there, shut to no height and inert until the row is pressed (the mock's fold: it opens over 0.22 s) -->
				<div class="fold-body" inert={!advanced}>
					<div class="fold-in">
						<div class="sec">
							<div class="sec-label"><h3 class="sp-lab">Stop on loss</h3><span class="hint">run stops if net loss reaches this</span></div>
							<div class="chips six">
								{#each LIMITS as m (m)}
									<button type="button" class="sp-well lim" class:on={lossMult === m} class:off={m === null} onclick={() => (controls.sound('soundPressSub'), (lossMult = m))}>
										<span class="sp-cap">{m === null ? 'OFF' : `${m}x`}</span>
									</button>
								{/each}
							</div>
						</div>

						<div class="sec">
							<div class="sec-label"><h3 class="sp-lab">Stop on single win</h3><span class="hint">run stops if one spin wins this much</span></div>
							<div class="chips six">
								{#each LIMITS as m (m)}
									<button type="button" class="sp-well lim" class:on={winMult === m} class:off={m === null} onclick={() => (controls.sound('soundPressSub'), (winMult = m))}>
										<span class="sp-cap">{m === null ? 'OFF' : `${m}x`}</span>
									</button>
								{/each}
							</div>
						</div>

						<div class="tgs">
							<button type="button" class="toggle" class:on={stopFreeOn} onclick={() => { controls.sound('soundPressSub'); stopFree = !stopFree; if (stopFree) autoBonuses = false; }} role="switch" aria-checked={stopFreeOn}>
								<span class="t-text">
									<span class="t-main">Stop on Free Games</span>
									<span class="t-sub">Autoplay ends when a feature triggers (it still plays out)</span>
								</span>
								<span class="sp-knob knob"></span>
							</button>
							<button type="button" class="toggle" class:on={autoBonuses && !stopFreeOn} disabled={stopFreeOn} onclick={() => (controls.sound('soundPressSub'), (autoBonuses = !autoBonuses))} role="switch" aria-checked={autoBonuses && !stopFreeOn}>
								<span class="t-text">
									<span class="t-main">Autoplay Bonuses</span>
									<span class="t-sub" class:warn={stopFreeOn}>{stopFreeOn ? 'Unavailable: turn off Stop on Free Games first' : 'Feature screens continue on their own while autoplay runs'}</span>
								</span>
								<span class="sp-knob knob"></span>
							</button>
						</div>
					</div>
				</div>
			</div>

			<!-- LOW: the total stands over START in the right column (the left one is the spin counts' whole height) -->
			{#if low}{@render totalRow()}{/if}

			<button type="button" class="sp-kgo go" style:font-size="{goFont}px" onclick={start}>
				{#if goStack}
					<!-- LOW and the narrow card: the same words and amount, the words over the amount, each fitted to the key -->
					<span class="sp-cap gl" style:font-size="{goLowFont}px">{#if count === Infinity}START AUTO SPINS{:else}START <span class="n">{countText(count)}</span> AUTO SPINS{/if}</span>
					{#if count !== Infinity}<span class="sp-cap n mv" style:font-size="{goAmtFont}px">{totalText}</span>{/if}
				{:else if count === Infinity}<span class="sp-cap">START AUTO SPINS</span>{:else}<span class="sp-cap">START <span class="n">{countText(count)}</span> AUTO SPINS</span><i class="sp-dot dot"></i><span class="sp-cap n mv">{totalText}</span>{/if}
			</button>
			<div class="cap">Starts the run right away. Pressing Spin stops it.</div>
			</div></div>
		</div>
		{#if !wide || low}
			<div class="stepper" onclick={(e) => e.stopPropagation()} role="presentation">
				<BetAdjuster {controls} pressSound="soundPressSub" autoRun touch={touch && !low} {low} />
			</div>
		{/if}
	</div>
</ModalShell>

<style>
	/* THE AUTOPLAY CARD as a green guide sign (2026-11-23, the mock menus_r1_2026-11-23, style A; its mock.css is the
	   spec). The plate, the small plates set into it, the yellow key, the switches' knobs and the stepper's symbols are
	   ui/sign/signPanel.css's shared pieces (--sp-* tokens, ui/hudTheme.ts SIGN_PANEL); this block is the card's own
	   layout. Some elements keep the glass card's class names for the probes (.panel, .pill, .chip, .lim, .toggle, .go,
	   .cap, .fold-row, .fold-body, .x). Every rule starts at .center or .panel, so it outranks the shared pieces. */
	.center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		padding: 6px;
		box-sizing: border-box;
		pointer-events: none;
	}
	.center .stepper {
		flex: none;
		display: flex;
		pointer-events: auto;
	}
	.center .panel {
		flex: 0 1 auto;
		min-height: 0;
		width: 480px;
		max-width: 94%;
		pointer-events: auto;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 12px;
		/* (the side padding is the script's padX: the fits measure against it) */
		padding: 14px var(--px, 18px) 16px;
		line-height: 1.35;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;
	}
	.center .panel::-webkit-scrollbar {
		display: none;
	}
	.panel > *,
	.panel .c1 > *,
	.panel .c2 > * {
		min-width: 0;
		flex: none;
	}
	.panel .cols,
	.panel .c1,
	.panel .c2 {
		display: contents;
	}
	.panel .head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.panel .title {
		flex: 0 0 auto;
		font-size: 22px;
		line-height: 1;
		letter-spacing: 0.07em;
		white-space: nowrap;
	}
	.panel .head.stacked {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-areas: 'title x' 'pill pill';
		justify-items: start;
		align-items: center;
		row-gap: 8px;
	}
	.panel .head.stacked .title {
		grid-area: title;
	}
	.panel .head.stacked .pill {
		grid-area: pill;
	}
	.panel .head.stacked .x {
		grid-area: x;
	}
	/* the mode and what one spin uses: a pill shaped plate (it is not a key: no hover, no press) */
	.panel .pill {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 11px;
		border-radius: 999px;
		font-size: 10px;
		line-height: 1;
		letter-spacing: 0.12em;
		white-space: nowrap;
		pointer-events: none;
	}
	.panel .pill .dot {
		width: 4px;
		height: 4px;
	}
	.panel .x {
		flex: none;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
	}
	.panel .x :global(.ic) {
		width: 17px;
		height: 17px;
		stroke-width: 2.6;
	}
	.panel .sec {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.panel .sec-label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 10px;
	}
	.panel .hint {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.02em;
		color: var(--sp-ink3);
		text-align: right;
	}
	.panel .chips {
		display: grid;
	}
	.panel .chips.four {
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}
	.panel .chips.six {
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 6px;
	}
	/* a count tile */
	.panel .chip {
		min-width: 0;
		height: 54px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 0 3px;
	}
	.panel .chip .big {
		display: flex;
		align-items: center;
		height: 18px;
		font-size: 19px;
		line-height: 1;
		transform: translateY(0.06em);
	}
	.panel .chip .big .inf {
		display: block;
		width: 30px;
		height: 15px;
		transform: translateY(-0.06em);
	}
	.panel .chip .sub {
		font-size: 10px;
		line-height: 1;
		letter-spacing: 0.02em;
		opacity: 0.82;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	/* ("until stopped" on two lines, where one does not fit the tile) */
	.panel .chip .sub.two {
		white-space: normal;
		line-height: 1;
		text-align: center;
	}
	/* a limit chip */
	.panel .lim {
		min-width: 0;
		height: 32px;
		padding: 0;
		border-radius: 999px;
		font-size: 11.5px;
		line-height: 1;
		letter-spacing: 0.05em;
		text-align: center;
	}
	.panel .total {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 12px 2px 10px;
		border-top: 2px solid var(--sp-rule);
		border-bottom: 2px solid var(--sp-rule);
	}
	.panel .v-wrap {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: baseline;
		gap: 9px;
		margin-left: auto;
		white-space: nowrap;
	}
	.panel .total .math {
		font-size: 10.5px;
		line-height: 1;
		letter-spacing: 0.03em;
		color: var(--sp-ink2);
		font-variant-numeric: tabular-nums;
	}
	.panel .total .v {
		font-size: 22px;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.panel .fold {
		display: flex;
		flex-direction: column;
	}
	.panel .fold-row {
		width: 100%;
		min-height: 46px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 0 12px 0 14px;
		text-align: left;
	}
	.panel .fold-row > :global(*) {
		min-width: 0;
	}
	.panel .fold-k {
		font-size: 11.5px;
		line-height: 1;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.panel .fold-sum {
		flex: 1;
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 0.02em;
		color: var(--sp-ink2);
		text-align: right;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.panel .fold-row :global(.chv) {
		width: 17px;
		height: 17px;
		stroke-width: 2.6;
		transform: rotate(90deg);
		transition: transform 0.2s ease;
	}
	.panel .fold.open .fold-row :global(.chv) {
		transform: rotate(-90deg);
	}
	.panel .fold-body {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 0.22s ease;
	}
	.panel .fold.open .fold-body {
		grid-template-rows: 1fr;
	}
	/* (2 px either side, so a chosen chip's black line is not cut by the fold's own clip) */
	.panel .fold-in {
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 0 2px;
		margin: 0 -2px;
		visibility: hidden;
		transition: visibility 0s linear 0.22s;
	}
	.panel .fold.open .fold-in {
		visibility: visible;
		transition-delay: 0s;
	}
	.panel .fold-in > :first-child {
		margin-top: 12px;
	}
	.panel .fold-in > * {
		flex: none;
	}
	.panel .tgs {
		display: flex;
		flex-direction: column;
	}
	/* a switch row */
	.panel .toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		min-width: 0;
		min-height: 44px;
		padding: 3px 2px;
		border-bottom: 2px solid var(--sp-rule);
		text-align: left;
	}
	.panel .toggle:disabled {
		opacity: 0.55;
	}
	.panel .t-text {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.panel .t-main {
		font-size: 12.5px;
		letter-spacing: 0.03em;
	}
	.panel .t-sub {
		font-size: 10px;
		font-weight: 800;
		line-height: 1.3;
		color: var(--sp-ink3);
	}
	/* START (the shared yellow key): room under it for its drop */
	.panel .go {
		margin-bottom: 6px;
	}
	.panel .go .n {
		font-variant-numeric: tabular-nums;
	}
	.panel .cap {
		margin: -3px 4px 0;
		text-align: center;
		font-size: 10.5px;
		font-weight: 800;
		line-height: 1.4;
		letter-spacing: 0.02em;
		color: var(--sp-ink2);
	}
	/* the hint steps aside while the fold is open */
	.panel .fold.open ~ .cap {
		display: none;
	}
	/* the loaded feature START unloads: shown at every size */
	.panel .drop {
		margin: -4px 2px 0;
		text-align: center;
		font-size: 11px;
		font-weight: 800;
		line-height: 1.35;
		letter-spacing: 0.02em;
		color: var(--sp-ink2);
	}
	.panel .drop b {
		color: var(--sp-acc);
		font-weight: 900;
	}

	/* ---- touch sizes: every press box 44 CSS px at least ---- */
	.touch .panel .x {
		width: 44px;
		height: 44px;
	}
	.touch .panel .lim {
		height: 44px;
	}
	.touch .panel .fold-row {
		min-height: 44px;
	}
	.touch .panel .go {
		min-height: 48px;
	}

	/* ---- a short desktop window (Stake's 1200 x 675): the open STOP OPTIONS fit with no scroll (the two switches side
	   by side, the tiles and gaps a little tighter) ---- */
	.center.short {
		gap: 10px;
	}
	.short .panel {
		gap: 10px;
		padding-top: 10px;
		padding-bottom: 12px;
	}
	.short .panel .chip {
		height: 48px;
	}
	/* the two switches side by side (the script's tgRow) */
	.tg-row .panel .tgs {
		flex-direction: row;
		gap: 14px;
	}
	.tg-row .panel .toggle {
		flex: 1 1 0;
	}

	/* ---- portrait: a sheet that rises from the bottom, the amount stepper over it ---- */
	.center.portrait {
		justify-content: flex-end;
		padding: 6px 0 0;
		gap: 10px;
	}
	.portrait .stepper {
		order: -1;
	}
	.portrait .panel {
		width: 100%;
		max-width: 412px;
		padding-top: 12px;
		padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
		gap: 10px;
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
		border-bottom-width: 0;
	}
	.portrait .panel .title {
		font-size: 18px;
	}
	.portrait .panel .pill {
		font-size: 9.5px;
		padding: 0 9px;
	}
	.portrait .panel .chips.four {
		gap: 7px;
	}
	.portrait .panel .chip {
		height: 50px;
	}
	.portrait .panel .chips.six {
		gap: 5px;
	}
	.portrait .panel .t-sub {
		display: none;
	}
	.portrait .panel .t-sub.warn {
		display: block; /* an unavailable switch still says why */
	}
	/* an upright window under 724 tall: the gaps close up (the press boxes stay 44) */
	.center.portrait.snug {
		padding-top: 4px;
		gap: 6px;
	}
	.portrait.snug .panel {
		padding-top: 8px;
		padding-bottom: max(10px, env(safe-area-inset-bottom, 0px));
		gap: 6px;
	}
	.portrait.snug .panel .sec {
		gap: 6px;
	}
	.portrait.snug .panel .hint {
		line-height: 1;
	}
	.portrait.snug .panel .chips.four {
		gap: 6px;
	}
	.portrait.snug .panel .chip {
		height: 44px;
		gap: 3px;
	}
	.portrait.snug .panel .total {
		padding: 7px 2px 5px;
	}
	.portrait.snug .panel .fold-in {
		gap: 6px;
	}
	.portrait.snug .panel .fold-in > :first-child {
		margin-top: 6px;
	}
	.portrait.snug .stepper :global(.adj) {
		padding: 2px 10px;
	}

	/* ---- wide (a phone held sideways, a desktop window under 670 tall): low, two columns, the amount stepper in the
	   head row ---- */
	.center.wide {
		gap: 6px;
		padding: 5px max(5px, env(safe-area-inset-right, 0px)) 5px max(5px, env(safe-area-inset-left, 0px));
	}
	.wide .panel {
		width: 760px;
		padding-top: 8px;
		padding-bottom: 10px;
		gap: 6px;
	}
	.wide .panel .cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 18px;
		align-items: start;
	}
	.wide .panel .c1,
	.wide .panel .c2 {
		display: flex;
		flex-direction: column;
		gap: 7px;
		min-width: 0;
	}
	.wide .panel .head.stacked {
		grid-template-columns: 1fr auto auto;
		grid-template-areas: 'title stp x' 'pill pill pill';
		column-gap: 10px;
	}
	.wide .panel .head.stacked :global(.adj) {
		grid-area: stp;
	}
	.wide .panel .title {
		font-size: 18px;
	}
	.wide .panel .hint,
	.wide .panel .t-sub:not(.warn) {
		display: none;
	}
	.wide .panel .chips.four {
		gap: 6px;
	}
	.wide .panel .chip {
		height: 44px;
		gap: 3px;
	}
	.wide .panel .total {
		padding: 8px 2px 6px;
	}
	.wide .panel .fold-in {
		gap: 7px;
	}
	.wide .panel .fold-in > :first-child {
		margin-top: 7px;
	}
	.wide.tg-row .panel .tgs {
		gap: 12px;
	}
	.wide .panel .toggle {
		gap: 8px;
	}
	.wide .panel .t-main {
		font-size: 11.5px;
		letter-spacing: 0;
		white-space: nowrap;
	}
	.wide .panel .drop {
		margin: 0 2px;
	}
	/* a sideways window too short for those numbers (a real phone's 832 x 376 frame): the gaps close up */
	.wide.snug .panel {
		padding-top: 6px;
		padding-bottom: 7px;
		gap: 4px;
	}
	.wide.snug .panel .c1,
	.wide.snug .panel .c2 {
		gap: 5px;
	}
	.wide.snug .panel .fold-in {
		gap: 5px;
	}
	.wide.snug .panel .fold-in > :first-child {
		margin-top: 5px;
	}
	/* a narrow wide card (the small sideways phones, 568 x 320 and 667 x 375): LOW's column split, so every tile keeps
	   its price line; the limit chips three to a row (six would be under 44 px wide) */
	.wide.narrow .panel {
		max-width: 96%;
	}
	.wide.narrow .panel .cols {
		grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
	}
	.wide.narrow .panel .chips.six {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	/* START with its words over its amount (LOW, and the narrow card), each fitted to the key by the script */
	.go-stack .panel .go {
		flex-direction: column;
		gap: 1px;
		line-height: 1.1;
	}
	.go-stack .panel .go .gl {
		letter-spacing: 0.06em;
		white-space: nowrap;
	}
	.go-stack .panel .go .mv {
		letter-spacing: 0.04em;
		white-space: nowrap;
	}
	.wide.narrow .panel .title {
		font-size: 16px;
	}
	.wide.narrow .panel .pill {
		font-size: 9.5px;
		padding: 0 9px;
	}

	/* ---- tiny (Stake's Popout S, 400 x 225, and a 320 px wide phone): the explanatory lines step aside ---- */
	.tiny .panel {
		gap: 7px;
	}
	.tiny .panel .hint,
	.tiny .panel .t-sub:not(.warn) {
		display: none;
	}
	.tiny .panel .title {
		font-size: 16px;
	}
	.tiny .panel .drop {
		font-size: 9.5px;
	}

	/* ---- LOW (the sideways card at Popout S height, 400 x 225: `wide` and `tiny`; see the script; the small sizes fix
	   of 2026-11-22, in the sign style): no scroll while STOP OPTIONS is shut. The card takes the height the stepper
	   leaves, the spin counts the wider left column, STOP OPTIONS, the total and START the right one. Every size in px
	   here is mirrored by the script's lowInner, chipW, totalBox and goInner. This block stands after the touch, wide
	   and tiny ones, whose rules it replaces. By its numbers the card is 163 px tall in the 167 the window leaves. ---- */
	.center.low {
		padding: 4px;
		gap: 4px;
	}
	.low .panel {
		width: 100%;
		max-width: 100%;
		padding-top: 5px;
		padding-bottom: 6px;
		gap: 4px;
	}
	.low .panel .cols {
		grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
		gap: 10px;
	}
	.low .panel .c1,
	.low .panel .c2 {
		gap: 4px;
	}
	.low .panel .title {
		font-size: 15px;
	}
	.low .panel .pill {
		height: 22px;
		font-size: 9.5px;
		padding: 0 9px;
	}
	.low .panel .x {
		width: 26px;
		height: 26px;
	}
	.low .panel .x :global(.ic) {
		width: 14px;
		height: 14px;
	}
	.low .panel .sec {
		gap: 5px;
	}
	.low .panel .chips.four {
		gap: 5px;
	}
	.low .panel .chip {
		height: 40px;
		padding: 0 2px;
		gap: 3px;
	}
	.low .panel .chip .big {
		height: 15px;
		font-size: 15px;
	}
	.low .panel .chip .big .inf {
		width: 26px;
		height: 13px;
	}
	.low .panel .fold-row {
		min-height: 32px;
		gap: 6px;
		padding: 0 8px 0 10px;
	}
	.low .panel .fold-k {
		font-size: 10px;
		letter-spacing: 0.12em;
	}
	/* the closed row's summary has no room at this width; the fold opens by itself whenever a stop is set, so nothing
	   set is ever hidden */
	.low .panel .fold-sum {
		display: none;
	}
	.low .panel .fold-row :global(.chv) {
		margin-left: auto;
	}
	/* (open, the card scrolls: three limit chips to a row, so each holds its figure) */
	.low .panel .chips.six {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 4px;
	}
	.low .panel .lim {
		height: 28px;
	}
	.low .panel .total {
		flex-direction: column;
		flex-wrap: nowrap;
		align-items: stretch;
		gap: 2px;
		padding: 2px;
		border-bottom: 0;
		line-height: 1.1;
	}
	.low .panel .total .k {
		font-size: 9px;
		line-height: 1.1;
		letter-spacing: 0.12em;
	}
	.low .panel .v-wrap {
		margin-left: 0;
	}
	.low .panel .total .math {
		font-size: 9.5px;
		line-height: 1.1;
	}
	.low .panel .total .v {
		line-height: 1.1;
	}
	/* START: its words over its amount; a lower drop, which stays inside the card's 6 px foot */
	.low .panel .go {
		min-height: 40px;
		margin-bottom: 0;
		padding: 0 8px;
		box-shadow:
			0 0 0 1.5px var(--sp-ki-c),
			0 3px 0 1.5px var(--sp-acc-deep);
	}
	.low .panel .go:active:not(:disabled) {
		transform: translateY(2px);
		box-shadow:
			0 0 0 1.5px var(--sp-ki-c),
			0 1px 0 1.5px var(--sp-acc-deep);
	}
	.low .panel .cap {
		display: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.panel .fold-body,
		.panel .fold-row :global(.chv) {
			transition: none;
		}
	}
</style>
