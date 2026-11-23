<script lang="ts">
	// AUTO AND TURBO AS GEARS (gear bar 2026-11-22; the approved mock desktop_r6_2026-11-22). Corey: "The Auto and Turbo
	// Buttons as gears was also a good idea, but they should just fill the gear center with no spokes". Solid iron gears
	// with the Play gear's own teeth, meshed with it and turning the other way (ui/gear/GearBar.svelte turns the one
	// layer marked data-turn). What each does, its sounds and its disabled rules are ui/hud/HudKey.svelte's, unchanged:
	//   Auto   lit while a run is loaded on the Spin or running; its press opens the Autoplay menu, or stops a live run
	//   Turbo  three level pips (0, 1, 2); two under the operator's disabledSuperTurbo; lit at levels 1 and 2
	// Disabled: at rest (a held round, nothing to play a run with) the gear is steel, the mock's disabled drawing; while a
	// round plays (Auto is disabled through every hand-played round) it only dims under a veil, so the gear does not
	// flip between iron and steel on every spin.
	// The press box is the whole gear (the square round its tips) and never changes size; a press sinks the drawing.
	import { stateBet } from 'state-shared';
	import type { Controls } from '../controls.svelte';
	import { GEAR_PAD, smallGearArt } from './gearArt';
	import { DESKTOP, DESKTOP_GEARS, type Box } from './gearLayout';

	type Props = { kind: 'auto' | 'turbo'; controls: Controls; box: Box };
	const { kind, controls, box }: Props = $props();

	const level = $derived(controls.turboLevel());
	const bars = $derived(controls.jurisdiction().disabledSuperTurbo ? 2 : 3);
	const running = $derived(controls.autoRunning());
	const loaded = $derived(controls.autoLoadout() !== null);
	// the drawing: the table's own px (it scales to the box), made again only if the pip count changes
	const G = DESKTOP_GEARS[kind];
	const art = $derived(smallGearArt(kind, G.R, G.teeth, DESKTOP.text.word, bars));
	const pad = $derived((GEAR_PAD * box.w) / (2 * G.R));
</script>

<button
	type="button"
	class="slot-btn hg gk {kind} hit"
	class:is-on={kind === 'auto' && (running || loaded)}
	class:is-run={kind === 'auto' && running}
	class:is-busy={!controls.isIdle()}
	data-l={kind === 'turbo' ? level : undefined}
	data-piece={kind}
	style:left="{box.x}px"
	style:top="{box.y}px"
	style:width="{box.w}px"
	style:height="{box.h}px"
	style:--pad="{pad}px"
	style:--nudge="{-0.25 * art.period}deg"
	disabled={kind === 'auto' ? controls.autoDisabled() : stateBet.isSpaceHold}
	onclick={kind === 'auto' ? controls.autoPress : controls.turboPress}
	aria-label={kind === 'auto' ? 'Autoplay' : level === 2 ? 'Turbo: instant' : level === 1 ? 'Turbo: on' : 'Turbo'}
>
	<span class="ga">
		<span class="gl under">{@html art.under}</span>
		<span class="gn"><span class="gl turn" data-turn={kind}>{@html art.teeth}</span></span>
		<span class="gl">{@html art.face}</span>
		<span class="gl">{@html art.mark}</span>
	</span>
</button>
