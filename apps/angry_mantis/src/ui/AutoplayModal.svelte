<script lang="ts">
	// Autoplay Loadout (design approved 2026-08-26): configure a run, preview its TRUE total, then
	// LOAD it onto the spin button — pressing Spin is what starts it. Loss/win stops are multiples of
	// one spin's play amount; "stop on free games" only exists outside armed feature modes.
	import { stateModal } from 'state-shared';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import Icon from './Icon.svelte';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls, master, scale, left, top, compact = false }: Props = $props();

	const open = $derived(stateModal.modal?.name === 'autoSpin');
	const close = () => (stateModal.modal = null);

	const COUNT_ROWS: number[][] = [
		[10, 25, 50, 100],
		[250, 500, 1000, Infinity],
	];
	const LIMITS: (number | null)[] = [null, 5, 10, 25, 100, 500]; // null = OFF

	let count = $state(25);
	let lossMult = $state<number | null>(null);
	let winMult = $state<number | null>(null);
	let stopFree = $state(true);

	const armed = $derived(controls.armedBuy() !== null);
	const perSpin = $derived(controls.playCost());
	const pill = $derived(controls.modeChip() ?? { label: 'BASE GAME', cost: controls.abbrev(perSpin, 100_000) });
	const countText = (c: number) => (c === Infinity ? '∞' : `${c}`);
	const totalText = $derived(count === Infinity ? '∞' : controls.abbrev(count * perSpin));

	const load = () => {
		controls.loadAutoplay({ count, lossMult, winMult, stopFree: armed ? false : stopFree });
	};
	// reopening while a loadout waits: allow clearing it
	const hasLoadout = $derived(controls.autoLoadout() !== null);
</script>

<ModalShell {open} onclose={close} {master} {scale} {left} {top} zIndex={3}>
	<button class="slot-btn x" onclick={(e) => (e.stopPropagation(), close())} style:top="{compact ? 14 : 22}px" style:right="{compact ? 14 : 24}px" style:width="{compact ? 38 : 46}px" style:height="{compact ? 38 : 46}px" aria-label="Close">
		<Icon name="close" s={compact ? 16 : 20} />
	</button>
	<div class="center">
		<div class="panel" onclick={(e) => e.stopPropagation()} role="presentation" style:padding={compact ? '18px 14px' : '24px 26px'} style:gap="{compact ? 12 : 15}px" style:max-height="{0.92 * master.height}px">
			<div class="head">
				<div class="title" style:font-size="{compact ? 16 : 20}px">AUTOPLAY</div>
				<div class="pill" style:font-size="{compact ? 10.5 : 12}px"><b>{pill.label}</b><span class="dot">·</span><span class="slot-num cost">{pill.cost}</span><span class="per">/ SPIN</span></div>
			</div>

			<div class="sec">
				<div class="sec-label"><h3 style:font-size="{compact ? 10 : 11}px">Number of spins</h3><span class="hint">selecting only previews — nothing starts</span></div>
				{#each COUNT_ROWS as row, r (r)}
					<div class="chips">
						{#each row as c (c)}
							<button class="slot-btn chip gold" class:on={count === c} onclick={() => (count = c)} style:padding="{compact ? '6px 4px 5px' : '8px 6px 6px'}">
								<span class="slot-num big" style:font-size="{compact ? 14 : 16}px">{countText(c)}</span>
								<span class="slot-num sub">{c === Infinity ? 'until stopped' : controls.abbrev(c * perSpin)}</span>
							</button>
						{/each}
					</div>
				{/each}
				<div class="total">
					<span class="k" style:font-size="{compact ? 10 : 11}px">TOTAL PLAY AMOUNT</span>
					<span class="slot-num v" style:font-size="{compact ? 17 : 21}px">{totalText}{#if count !== Infinity}<small>{count} × {controls.abbrev(perSpin)}</small>{/if}</span>
				</div>
			</div>

			<div class="sec">
				<div class="sec-label"><h3 style:font-size="{compact ? 10 : 11}px">Stop on loss</h3><span class="hint">run stops if net loss since the start reaches this</span></div>
				<div class="chips">
					{#each LIMITS as m (m)}
						<button class="slot-btn chip ember" class:on={lossMult === m} onclick={() => (lossMult = m)} style:padding="{compact ? '6px 4px 5px' : '8px 6px 6px'}">
							<span class="slot-num big" style:font-size="{compact ? 13 : 15}px">{m === null ? 'OFF' : `${m}×`}</span>
							<span class="slot-num sub">{m === null ? 'no loss stop' : controls.abbrev(m * perSpin)}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="sec">
				<div class="sec-label"><h3 style:font-size="{compact ? 10 : 11}px">Stop on single win</h3><span class="hint">run stops if one spin wins this much</span></div>
				<div class="chips">
					{#each LIMITS as m (m)}
						<button class="slot-btn chip leaf" class:on={winMult === m} onclick={() => (winMult = m)} style:padding="{compact ? '6px 4px 5px' : '8px 6px 6px'}">
							<span class="slot-num big" style:font-size="{compact ? 13 : 15}px">{m === null ? 'OFF' : `${m}×`}</span>
							<span class="slot-num sub">{m === null ? 'no win stop' : controls.abbrev(m * perSpin)}</span>
						</button>
					{/each}
				</div>
			</div>

			<button class="slot-btn toggle" class:on={!armed && stopFree} disabled={armed} onclick={() => (stopFree = !stopFree)}>
				<span class="t-text">
					<span class="t-main" style:font-size="{compact ? 12 : 13.5}px">Stop on Free Games</span>
					<span class="t-sub" class:warn={armed}>{armed ? 'Unavailable — every spin already plays the loaded feature' : 'Autoplay ends when a feature triggers naturally (it still plays out)'}</span>
				</span>
				<span class="knob"></span>
			</button>

			<button class="slot-btn go" onclick={load} style:font-size="{compact ? 13 : 15}px">
				LOAD {countText(count)} AUTO SPINS{#if count !== Infinity}&nbsp;—&nbsp;<span class="slot-num">{totalText}</span>{/if}
			</button>
			<div class="cap">Loads to the Spin button. Pressing Spin starts the run; pressing it again stops.</div>
			{#if hasLoadout}
				<button class="slot-btn unload" onclick={() => { controls.clearAutoplay(); close(); }}>UNLOAD CURRENT AUTO SPINS</button>
			{/if}
		</div>
	</div>
</ModalShell>

<style>
	.x {
		position: absolute;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.4);
		box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.7);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
	}
	.center {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.panel {
		width: min(660px, 96%);
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		background: linear-gradient(180deg, #171106 0%, #0c1207 100%);
		border: 1px solid rgba(232, 176, 74, 0.28);
		border-radius: 18px;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.title {
		font-weight: 900;
		letter-spacing: 2.5px;
		color: #fff;
		text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6);
	}
	.pill {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		border-radius: 999px;
		padding: 4px 13px;
		background: rgba(10, 6, 2, 0.7);
		box-shadow: inset 0 0 0 1px rgba(232, 176, 74, 0.55);
		color: #e8b04a;
		font-weight: 900;
		letter-spacing: 1.4px;
		white-space: nowrap;
	}
	.pill .dot { opacity: 0.6; }
	.pill .cost { color: #fff; font-weight: 700; }
	.pill .per { font-size: 0.75em; opacity: 0.7; }
	.sec { display: flex; flex-direction: column; gap: 7px; }
	.sec-label { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
	.sec-label h3 {
		margin: 0;
		font-weight: 900;
		letter-spacing: 2px;
		color: rgba(238, 240, 230, 0.55);
		text-transform: uppercase;
	}
	.hint { font-size: 10.5px; color: rgba(238, 240, 230, 0.35); }
	.chips { display: flex; gap: 7px; }
	.chip {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		border-radius: 11px;
		background: rgba(255, 255, 255, 0.035);
		box-shadow: inset 0 0 0 1.5px rgba(238, 240, 230, 0.12);
		color: #fff;
	}
	.chip .big { font-weight: 800; }
	.chip .sub { font-size: 9.5px; color: rgba(238, 240, 230, 0.35); white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
	.chip.gold.on { box-shadow: inset 0 0 0 1.5px #ffdc4a, 0 0 16px rgba(255, 220, 74, 0.15); background: linear-gradient(180deg, rgba(255, 220, 74, 0.16), rgba(255, 220, 74, 0.05)); }
	.chip.gold.on .sub { color: #e8b04a; }
	.chip.ember.on { box-shadow: inset 0 0 0 1.5px #c53c24, 0 0 16px rgba(197, 60, 36, 0.18); background: linear-gradient(180deg, rgba(197, 60, 36, 0.2), rgba(197, 60, 36, 0.06)); }
	.chip.ember.on .sub { color: #e08a70; }
	.chip.leaf.on { box-shadow: inset 0 0 0 1.5px #9cd92f, 0 0 16px rgba(156, 217, 47, 0.16); background: linear-gradient(180deg, rgba(156, 217, 47, 0.16), rgba(156, 217, 47, 0.05)); }
	.chip.leaf.on .sub { color: #b9e567; }
	.total {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		border: 1px dashed rgba(232, 176, 74, 0.4);
		border-radius: 11px;
		padding: 7px 14px;
		background: rgba(232, 176, 74, 0.05);
	}
	.total .k { font-weight: 900; letter-spacing: 2px; color: #e8b04a; }
	.total .v { font-weight: 800; color: #fff; }
	.total .v small { font-size: 11px; color: rgba(238, 240, 230, 0.4); font-weight: 400; margin-left: 8px; }
	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-radius: 11px;
		padding: 9px 13px;
		background: rgba(255, 255, 255, 0.03);
		box-shadow: inset 0 0 0 1.5px rgba(238, 240, 230, 0.12);
		color: #fff;
		text-align: left;
		width: 100%;
	}
	.toggle.on { box-shadow: inset 0 0 0 1.5px #9cd92f; }
	.toggle:disabled { opacity: 0.5; }
	.t-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
	.t-main { font-weight: 700; letter-spacing: 0.6px; }
	.t-sub { font-size: 10.5px; color: rgba(238, 240, 230, 0.4); }
	.t-sub.warn { color: #e08a70; }
	.knob { flex: 0 0 auto; width: 40px; height: 22px; border-radius: 999px; background: rgba(255, 255, 255, 0.12); position: relative; }
	.knob::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left 0.15s; }
	.toggle.on .knob { background: #9cd92f; }
	.toggle.on .knob::after { left: 21px; }
	.go {
		border-radius: 13px;
		padding: 13px 16px;
		font-weight: 900;
		letter-spacing: 1.5px;
		color: #14100a;
		background: linear-gradient(180deg, #ffdc4a 0%, #dfb02c 100%);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 3px 0 #6b4c00, 0 8px 20px rgba(0, 0, 0, 0.5);
	}
	.cap { text-align: center; font-size: 10.5px; color: rgba(238, 240, 230, 0.35); margin-top: -6px; }
	.unload {
		align-self: center;
		border-radius: 9px;
		padding: 7px 14px;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 1.5px;
		color: rgba(255, 255, 255, 0.75);
		background: rgba(255, 255, 255, 0.05);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
	}
</style>
