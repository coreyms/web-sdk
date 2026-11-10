<script lang="ts">
	// THE FAST LANE: Run Over Reindeer's feature menu (Corey 2026-11-09). Three cards on the house panel surface:
	//   FREE SPINS         the 100x buy
	//   SUPER FREE SPINS   the 300x buy
	//   ANTE               ONE card with a three stop slider (2x, 4x, 10x): each stop is its own math mode
	// Each card carries three or four short odds rows; the Ante card's rows change with the slider. Copy and rows
	// come from game/featureMenuData.ts (the rows are DUMMY numbers in the first pass and the menu says so).
	//
	// What a press does (the house flow, ui/controls.svelte.ts):
	//   BUY        arms the feature on the Spin button for ONE round. Nothing is charged and nothing plays until the
	//              player presses Spin; the round's end returns the game to the base game.
	//   ACTIVATE   switches the chosen Ante level on; it stays on until switched off here.
	// Prices are the RGS's cost multipliers (game/betModeMeta.ts modeCost) times the current bet, never a number
	// from the data file. A modal: it never scrolls, in any layout.
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateBet, stateModal } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import BetAdjuster from './BetAdjuster.svelte';
	import Icon from './Icon.svelte';
	import { ANTE_KEYS, modeCost } from '../game/betModeMeta';
	import { ANTE_ODDS, BUY_ODDS, FEATURE_MENU_TEXT as T, ODDS_ARE_DUMMY, type OddsRow } from '../game/featureMenuData';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top }: Props = $props();

	const open = $derived(stateModal.modal?.name === 'buyBonus');
	const close = () => (stateModal.modal = null);

	const vw = $derived(innerWidth.current ?? 1280);
	const vh = $derived(innerHeight.current ?? 720);
	// three cards side by side when the screen is wide enough for them, else stacked (portrait)
	const row = $derived(vw >= 640 && vw > vh);
	// a short screen (a phone held sideways) or a small upright phone: tighter type
	const tight = $derived(row ? vh < 480 : vh < 700);
	// the smallest upright phones (360 x 640): one more notch tighter
	const tiny = $derived(!row && vh < 660);
	// "three or four short odds rows": four where there is room, three on a small upright phone (the modal never scrolls)
	const oddsShown = $derived(!row && vh < 740 ? 3 : 4);

	const activeKey = $derived(stateBet.activeBetModeKey.toUpperCase());
	const armed = $derived(controls.armedBuy());
	const anteOn = $derived(ANTE_KEYS.includes(activeKey) ? activeKey : null);

	// the Ante slider's stop. It opens on the level that is on, else on the middle one (4x).
	let stop = $state(1);
	$effect(() => {
		if (!open) return;
		const i = anteOn ? ANTE_KEYS.indexOf(anteOn) : -1;
		stop = i >= 0 ? i : 1;
	});
	const anteKey = $derived(ANTE_KEYS[stop] ?? ANTE_KEYS[0]);
	const anteRows = $derived<OddsRow[]>(ANTE_ODDS[anteKey] ?? []);

	const multText = (key: string) => `${modeCost(key)}x`;
	const priceText = (key: string) => numberToCurrencyString(stateBet.betAmount * modeCost(key));

	const BUYS = [
		{ key: 'BONUS' as const, accent: '#19d3da' },
		{ key: 'SUPER' as const, accent: '#ff5a6e' },
	];
	const ANTE_ACCENT = '#ffdc4a';

	const buy = (key: string) => {
		if (armed === key) {
			controls.sound('soundPressMinor');
			controls.cancelArmed();
			return;
		}
		controls.buyMode(key); // arms it, closes the menu, voices the press
	};
	const anteActivate = () => {
		controls.sound('soundPressMinor');
		controls.activateMode(anteKey); // also closes the menu
	};
	const anteOff = () => {
		controls.sound('soundPressMinor');
		controls.cancelArmed();
	};
	const setStop = (i: number) => {
		if (i === stop) return;
		stop = i;
		controls.sound('soundPressSub');
	};
</script>

{#snippet odds(rows: OddsRow[])}
	<div class="odds">
		{#each rows.slice(0, oddsShown) as r (r.label)}
			<div class="odd"><span class="odd-k">{r.label}</span><span class="slot-num odd-v">{r.value}</span></div>
		{/each}
	</div>
{/snippet}

{#snippet buyButton(key: 'BONUS' | 'SUPER')}
	<button class="slot-btn go" class:on={armed === key} onclick={() => buy(key)}>{armed === key ? T.unload : T.cards[key].button}</button>
{/snippet}

{#snippet anteButtons()}
	{#if anteOn === null}
		<button class="slot-btn go" onclick={anteActivate}>{T.cards.ANTE.button}</button>
	{:else}
		<div class="pair">
			<button class="slot-btn go" disabled={anteOn === anteKey} onclick={anteActivate}>{anteOn === anteKey ? T.cards.ANTE.on : T.cards.ANTE.change}</button>
			<button class="slot-btn go off" onclick={anteOff}>{T.cards.ANTE.switchOff}</button>
		</div>
	{/if}
{/snippet}

<ModalShell {open} onclose={close} {master} {scale} {left} {top} dim="rgba(6,8,14,0.72)" zIndex={2}>
	<div class="center">
		<div class="panel am-glass" class:row class:tight class:tiny data-feature-menu onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="head">
				<div class="title am-stencil">{T.name}</div>
				{#if row}<div class="bet"><BetAdjuster {controls} compact /></div>{/if}
				<button class="slot-btn x" onclick={(e) => (e.stopPropagation(), close())} aria-label={T.close}><Icon name="close" s={tight ? 13 : 16} /></button>
			</div>
			<!-- upright: the bet control has its own line under the title (beside it there is no room) -->
			{#if !row}<div class="bet line"><BetAdjuster {controls} compact /></div>{/if}

			<div class="cards">
				{#each BUYS as b (b.key)}
					{@const c = T.cards[b.key]}
					{@const on = armed === b.key}
					<div class="card" class:on data-card={b.key} style:--accent={b.accent}>
						<div class="card-top">
							<div class="info">
								<div class="card-head">
									<div class="card-title">{c.title}</div>
									<div class="slot-num mult">{multText(b.key)}</div>
								</div>
								<div class="price"><span class="slot-num price-v">{priceText(b.key)}</span><span class="price-u">{T.total}</span></div>
							</div>
							<!-- upright: the button stands beside the price, so three cards fit one screen -->
							{#if !row}<div class="act">{@render buyButton(b.key)}</div>{/if}
						</div>
						{#if row && !tight}<div class="blurb">{c.blurb}</div>{/if}
						{@render odds(BUY_ODDS[b.key])}
						{#if row}{@render buyButton(b.key)}{/if}
						{#if on}<div class="flag">{T.armed}</div>{/if}
					</div>
				{/each}

				<div class="card ante" class:on={anteOn !== null} data-card="ANTE" style:--accent={ANTE_ACCENT}>
					<div class="card-top">
						<div class="info">
							<div class="card-head">
								<div class="card-title">{T.cards.ANTE.title}</div>
								<div class="slot-num mult">{multText(anteKey)}</div>
							</div>
							<div class="price"><span class="slot-num price-v">{priceText(anteKey)}</span><span class="price-u">{T.perSpin}</span></div>
						</div>
						{#if !row}<div class="act">{@render anteButtons()}</div>{/if}
					</div>
					{#if row && !tight}<div class="blurb">{T.cards.ANTE.blurb}</div>{/if}
					<!-- THE THREE STOP SLIDER: a native range input (keyboard and screen reader for free) over three tappable stop labels -->
					<div class="slider" style:--stops={ANTE_KEYS.length} style:--at={stop}>
						<input type="range" min="0" max={ANTE_KEYS.length - 1} step="1" value={stop} oninput={(e) => setStop(Number((e.currentTarget as HTMLInputElement).value))} aria-label={T.cards.ANTE.slider} aria-valuetext={multText(anteKey)} />
						<div class="stops">
							{#each ANTE_KEYS as key, i (key)}
								<button class="slot-btn stop" class:at={i === stop} class:live={anteOn === key} onclick={() => setStop(i)} tabindex="-1">{multText(key)}</button>
							{/each}
						</div>
					</div>
					{@render odds(anteRows)}
					{#if row}{@render anteButtons()}{/if}
				</div>
			</div>

			{#if ODDS_ARE_DUMMY}<div class="dummy" data-dummy-odds>{T.dummyNote}</div>{/if}
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
		padding: 8px;
		box-sizing: border-box;
	}
	.panel {
		--ink: var(--ui-ink);
		--pad: 14px;
		--gap: 10px;
		--fs: 13px;
		pointer-events: auto;
		box-sizing: border-box;
		width: min(100%, 420px);
		max-height: 100%;
		border-radius: 16px;
		padding: var(--pad);
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		font-family: var(--ui-font);
		font-size: var(--fs);
		overflow: hidden;
	}
	.panel.row {
		width: min(100%, 980px);
	}
	.panel.tight {
		--pad: 10px;
		--gap: 7px;
		--fs: 11.5px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.title {
		flex: 1;
		font-size: 1.55em;
		line-height: 1;
		white-space: nowrap;
	}
	.bet {
		flex: none;
	}
	/* upright: the house bet control (ui/BetAdjuster.svelte) on its own line under the title */
	.bet.line {
		display: flex;
		justify-content: center;
	}
	.card-top {
		display: flex;
		align-items: stretch;
		gap: 10px;
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35em;
	}
	.act {
		flex: none;
		display: flex;
		width: 34%;
		min-width: 104px;
	}
	.act .go,
	.act .pair {
		flex: 1;
		margin-top: 0;
	}
	.act .pair {
		flex-direction: column;
		gap: 5px;
	}
	.act .pair .go {
		min-height: 0;
		font-size: 0.85em;
	}
	/* upright: tighter cards, the multiple beside the name */
	.panel:not(.row) {
		--fs: 12.5px;
		--gap: 7px;
	}
	.panel:not(.row) .card {
		padding: 0.6em 0.8em 0.45em;
		gap: 0.3em;
	}
	.panel:not(.row) .card-head {
		justify-content: flex-start;
	}
	.panel:not(.row) .odd {
		padding: 0.24em 0;
	}
	.panel.tiny {
		--fs: 11.5px;
		--gap: 5px;
		--pad: 8px;
	}
	.panel.tiny .slider input {
		height: 22px;
	}
	/* the very smallest upright screens (320 x 568) */
	@media (max-height: 600px) and (orientation: portrait) {
		.panel.tiny {
			--fs: 10.5px;
			--gap: 4px;
			--pad: 6px;
		}
		.panel.tiny .bet.line {
			transform: scale(0.84);
			margin: -5px 0;
		}
		.panel.tiny .stop {
			min-height: 22px;
		}
	}
	.x {
		flex: none;
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--ui-glass-well);
		color: var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.x:hover {
		background: var(--ui-glass-well-2);
	}
	.cards {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		min-height: 0;
	}
	.row .cards {
		flex-direction: row;
		align-items: stretch;
	}
	.card {
		position: relative;
		flex: 1 1 0;
		min-width: 0;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0.5em;
		padding: 0.85em 0.95em;
		border-radius: 12px;
		background: var(--ui-glass-well);
		border: 1px solid var(--ui-rule);
		border-top: 3px solid var(--accent);
	}
	.card.on {
		border-color: var(--accent);
		background: var(--ui-glass-well-2);
	}
	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.card-title {
		font-family: var(--ui-font-display);
		font-weight: var(--ui-display-weight);
		letter-spacing: 0.03em;
		font-size: 1.3em;
		line-height: 1.05;
		color: var(--accent);
	}
	.mult {
		font-size: 1.3em;
		font-weight: 800;
		color: var(--ink);
	}
	.price {
		display: flex;
		align-items: baseline;
		gap: 0.5em;
	}
	.price-v {
		font-size: 1.45em;
		font-weight: 800;
		color: var(--ink);
	}
	.price-u {
		font-size: 0.8em;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: var(--ui-ink-2);
	}
	.blurb {
		color: #c9ccd6;
		line-height: 1.3;
	}
	.odds {
		display: flex;
		flex-direction: column;
		margin: 0.1em 0;
	}
	.odd {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		padding: 0.32em 0;
		border-top: 1px solid var(--ui-rule);
	}
	.odd-k {
		color: #c9ccd6;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.odd-v {
		flex: none;
		font-weight: 700;
		color: var(--ink);
	}
	/* every button on glass sets its own background (house rule: the browser default is white) */
	.go {
		margin-top: auto;
		min-height: 40px;
		border-radius: 10px;
		background: var(--accent);
		color: #10131a;
		font-family: var(--ui-font);
		font-weight: 900;
		font-size: 1.1em;
		letter-spacing: 0.1em;
	}
	.tight .go {
		min-height: 34px;
	}
	.go.on,
	.go.off {
		background: var(--ui-glass-well-2);
		color: var(--ink);
		box-shadow: inset 0 0 0 1.5px var(--ui-rule-2);
	}
	.go:disabled {
		background: var(--ui-glass-well-2);
		color: var(--accent);
		box-shadow: inset 0 0 0 1.5px var(--accent);
		opacity: 1;
	}
	.pair {
		margin-top: auto;
		display: flex;
		gap: 8px;
	}
	.pair .go {
		flex: 1;
		margin-top: 0;
		font-size: 0.95em;
		letter-spacing: 0.06em;
	}
	.flag {
		position: absolute;
		top: -3px;
		right: 12px;
		padding: 2px 8px 3px;
		border-radius: 0 0 6px 6px;
		background: var(--accent);
		color: #10131a;
		font-weight: 900;
		font-size: 0.75em;
		letter-spacing: 0.12em;
	}

	/* ── the three stop slider ── */
	.slider {
		position: relative;
		padding: 0.2em 0 0;
	}
	.slider input {
		-webkit-appearance: none;
		appearance: none;
		display: block;
		width: 100%;
		height: 28px;
		margin: 0;
		background: transparent;
		cursor: pointer;
	}
	.slider input::-webkit-slider-runnable-track {
		height: 8px;
		border-radius: 4px;
		background: linear-gradient(90deg, var(--accent) calc(var(--at) / (var(--stops) - 1) * 100%), rgba(255, 255, 255, 0.14) calc(var(--at) / (var(--stops) - 1) * 100%));
	}
	.slider input::-moz-range-track {
		height: 8px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.14);
	}
	.slider input::-moz-range-progress {
		height: 8px;
		border-radius: 4px;
		background: var(--accent);
	}
	.slider input::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 26px;
		height: 26px;
		margin-top: -9px;
		border-radius: 50%;
		background: #10131a;
		border: 3px solid var(--accent);
		box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5);
	}
	.slider input::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #10131a;
		border: 3px solid var(--accent);
	}
	.slider input:focus-visible {
		outline: 2px solid var(--ui-amber);
		outline-offset: 2px;
		border-radius: 6px;
	}
	.stops {
		display: flex;
		justify-content: space-between;
		margin-top: 2px;
	}
	.stop {
		min-width: 44px;
		min-height: 26px;
		padding: 0 6px;
		border-radius: 7px;
		background: transparent;
		color: var(--ui-ink-2);
		font-family: var(--ui-font-num);
		font-weight: 800;
		font-size: 1.05em;
	}
	.stop.at {
		color: var(--accent);
		background: var(--ui-glass-well-2);
	}
	.stop.live {
		box-shadow: inset 0 0 0 1.5px var(--accent);
	}
	.dummy {
		text-align: center;
		font-size: 0.85em;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--ui-amber);
	}
</style>
