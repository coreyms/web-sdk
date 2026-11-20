<script lang="ts">
	import { soc } from '../game/social';
	import { betStepTarget } from './betStep';
	import type { Controls } from './controls.svelte';
	import HudIcon from './hud/HudIcon.svelte';
	import { numberToCurrencyString } from 'utils-shared/amount';

	// pressSound: the autoplay card voices its own buttons with the sub click; elsewhere the arrows
	// keep the general click (setBet's own)
	// glass: the HUD's round glass minus and plus keys (HUD round 6: the Autoplay menu's stepper matches the HUD's own);
	// the denomination card keeps its square paper keys
	// autoRun: the Autoplay menu's stepper shows what one spin of the run will use (ui/controls.svelte.ts autoSpinCost,
	// 2026-11-19): with a feature loaded, the base amount under SPIN / PLAY, since LOAD unloads the feature
	type Props = { controls: Controls; compact?: boolean; pressSound?: 'soundPressGeneral' | 'soundPressSub'; glass?: boolean; autoRun?: boolean };
	const { controls, compact = false, pressSound = 'soundPressGeneral', glass = false, autoRun = false }: Props = $props();
	const btn = $derived(compact ? 38 : 46);
	// Same label rule as the HUD readout (controls.betLabel): a bought feature names the mode, everything
	// else reads SPIN / PLAY. Ante is announced by this component's own tag above the number.
	const label = $derived(autoRun && controls.armedBuy() !== null ? soc('SPIN', 'PLAY') : controls.betLabel());
	const value = $derived(autoRun ? numberToCurrencyString(controls.autoSpinCost()) : controls.betText());

	// stepping rules (affordability clamp) live in betStep.ts, shared with the HUD's inline −/+
	const stepTarget = betStepTarget;
	const step = (dir: 1 | -1) => {
		const next = stepTarget(dir);
		if (next === undefined) return;
		controls.sound(pressSound);
		controls.setBet(next, { silent: true });
	};
</script>

<div class="adj" style:padding={compact ? '8px 14px' : '10px 18px'}>
	{#if glass}
		<button class="slot-btn sk" disabled={stepTarget(-1) === undefined} onclick={() => step(-1)} style:width="{btn}px" style:height="{btn}px" aria-label={soc('Decrease bet', 'Decrease play amount')}><HudIcon name="minus" /></button>
	{:else}
		<button class="slot-btn arrow" disabled={stepTarget(-1) === undefined} onclick={() => step(-1)} style:width="{btn}px" style:height="{btn}px" style:font-size="{compact ? 18 : 22}px" aria-label={soc('Decrease bet', 'Decrease play amount')}>−</button>
	{/if}
	<button class="slot-btn mid" onclick={() => controls.openDenom()} style:min-width="{compact ? 120 : 150}px">
		{#if controls.anteActive()}<span class="ante" style:font-size="{compact ? 9 : 10}px">{soc('ANTE BET', 'ANTE MODE')}</span>{/if}
		<span class="lbl" style:font-size="{compact ? 10 : 11}px">{label}</span>
		<span class="slot-num val" style:font-size="{compact ? 18 : 22}px">{value}</span>
	</button>
	{#if glass}
		<button class="slot-btn sk" disabled={stepTarget(1) === undefined} onclick={() => step(1)} style:width="{btn}px" style:height="{btn}px" aria-label={soc('Increase bet', 'Increase play amount')}><HudIcon name="plus" /></button>
	{:else}
		<button class="slot-btn arrow" disabled={stepTarget(1) === undefined} onclick={() => step(1)} style:width="{btn}px" style:height="{btn}px" style:font-size="{compact ? 18 : 22}px" aria-label={soc('Increase bet', 'Increase play amount')}>+</button>
	{/if}
</div>

<style>
	.adj {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		background: rgba(0, 0, 0, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 14px;
	}
	.arrow {
		border-radius: 10px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.04) 100%);
		box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.35), 0 3px 0 rgba(0, 0, 0, 0.4);
		color: #fff;
		font-weight: 900;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.arrow:disabled {
		background: rgba(255, 255, 255, 0.04);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
		color: rgba(255, 255, 255, 0.25);
		opacity: 1;
	}
	/* the HUD's round glass key (ui/hud/hud.css .gl.sk, the same tokens): painted fill, white top / gold bottom edge */
	.sk {
		display: grid;
		place-items: center;
		padding: 0;
		border-radius: 50%;
		border: 1px solid;
		border-color: rgba(var(--hud-key-rim-rgb), var(--hud-key-rim-a));
		background: radial-gradient(ellipse 90% 80% at 50% 0%, rgba(var(--hud-ink-rgb), 0.17), rgba(var(--hud-ink-rgb), 0.04) 72%), rgba(var(--hud-key-rgb), 0.38);
		color: rgba(var(--hud-ink-rgb), 0.94);
		box-shadow: inset 0 1px 0 rgba(var(--hud-ink-rgb), 0.1), 0 1px 3px rgba(var(--hud-shadow-rgb), 0.4);
		transition: border-color 0.16s, transform 0.12s, box-shadow 0.16s, opacity 0.2s, color 0.16s;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.sk :global(.ic) {
		display: block;
		width: 47%;
		height: 47%;
	}
	@media (hover: hover) and (pointer: fine) {
		.sk:hover:not(:disabled) {
			border-color: rgba(var(--hud-key-rim-rgb), 0.55);
			color: rgb(var(--hud-ink-rgb));
			box-shadow: inset 0 1px 0 rgba(var(--hud-ink-rgb), 0.18), 0 0 14px rgba(var(--hud-accent-rgb), 0.18), 0 1px 3px rgba(var(--hud-shadow-rgb), 0.4);
		}
	}
	.sk:active:not(:disabled) {
		transform: scale(0.94);
		box-shadow: inset 0 2px 6px rgba(var(--hud-shadow-rgb), 0.7);
	}
	.sk:focus-visible {
		outline: 1.5px solid rgb(var(--hud-accent-hi-rgb));
		outline-offset: 3px;
	}
	.sk:disabled {
		opacity: var(--hud-disabled-a);
		cursor: default;
	}
	.mid {
		background: transparent;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.ante {
		font-weight: 900;
		letter-spacing: 2px;
		color: #e8b04a;
		background: rgba(232, 176, 74, 0.15);
		padding: 2px 6px;
		border-radius: 4px;
		text-shadow: 0 0 8px rgba(232, 176, 74, 0.6);
		margin-bottom: 2px;
	}
	.lbl {
		font-weight: 900;
		letter-spacing: 2.5px;
		color: #ffdc4a;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
	}
	.val {
		font-weight: 700;
		color: #fff;
		text-shadow: 0 2px 3px rgba(0, 0, 0, 0.6);
	}
</style>
