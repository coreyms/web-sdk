<script lang="ts">
	// THE ROUND KEYS (Drop 6): Menu, Auto, Turbo. One fixed circle each, icon over a tiny word (icon only on the
	// landscape phone). Behaviour, sounds and disabled rules are controls.svelte.ts's, unchanged.
	//   Menu   gold while the help menu is open
	//   Auto   gold while a run is loaded on the Spin or running (and its arrow turns while it runs); its press opens the
	//          Autoplay menu, or stops a live run, as before
	//   Turbo  three level bars (0, 1, 2); two under the operator's disabledSuperTurbo
	import { stateBet, stateUi } from 'state-shared';
	import type { Controls } from '../controls.svelte';
	import HudIcon from './HudIcon.svelte';

	type Props = { kind: 'menu' | 'auto' | 'turbo'; controls: Controls; x: number; y: number; d: number; cls?: string };
	const { kind, controls, x, y, d, cls = '' }: Props = $props();

	const level = $derived(controls.turboLevel());
	const bars = $derived(controls.jurisdiction().disabledSuperTurbo ? 2 : 3);
	const running = $derived(controls.autoRunning());
	const loaded = $derived(controls.autoLoadout() !== null);
</script>

{#if kind === 'menu'}
	<button type="button" class="slot-btn hg gl key menuk hit {cls}" class:is-active={stateUi.menuOpen} data-hud="menu-key" style:left="{x}px" style:top="{y}px" style:--k="{d}px" onclick={controls.menuPress} aria-label="Menu" aria-expanded={stateUi.menuOpen}>
		<HudIcon name="menu" /><span class="kl">MENU</span>
	</button>
{:else if kind === 'auto'}
	<button type="button" class="slot-btn hg gl key auto hit {cls}" class:is-on={running || loaded} class:is-run={running} style:left="{x}px" style:top="{y}px" style:--k="{d}px" disabled={controls.autoDisabled()} onclick={controls.autoPress} aria-label="Autoplay">
		<HudIcon name="auto" /><span class="kl">AUTO</span>
	</button>
{:else}
	<button
		type="button"
		class="slot-btn hg gl key turbo hit {cls}"
		data-l={level}
		style:left="{x}px"
		style:top="{y}px"
		style:--k="{d}px"
		disabled={stateBet.isSpaceHold}
		onclick={controls.turboPress}
		aria-label={level === 2 ? 'Turbo: instant' : level === 1 ? 'Turbo: on' : 'Turbo'}
	>
		<HudIcon name="turbo" /><span class="kl">TURBO</span><span class="lv">{#each { length: bars } as _, i (i)}<i></i>{/each}</span>
	</button>
{/if}
