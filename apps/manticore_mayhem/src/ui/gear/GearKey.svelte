<script lang="ts">
	// THE SMALL GEARS (gear bar 2026-11-22). On desktop: Auto and Turbo, solid iron gears with the Play gear's own teeth,
	// meshed with it (the approved mock desktop_r6_2026-11-22; Corey: "they should just fill the gear center with no
	// spokes"). On the upright phone (his export corey_phone_upright_r3_2026-11-22.json): Turbo, Auto, Menu and the
	// Armoury, icon only, a chain of gears (ui/gear/gearLayout.ts UPRIGHT); the Armoury's icon is the game's PolyMath mark.
	// The bar turns the one layer marked data-turn. What each does, its sounds and its disabled rules are the dock's
	// keys', unchanged (ui/hud/HudKey.svelte, ui/hud/HudArmoury.svelte):
	//   Auto     lit while a run is loaded on the Spin or running; its press opens the Autoplay menu, or stops a live run
	//   Turbo    three level pips (0, 1, 2); two under the operator's disabledSuperTurbo; lit at levels 1 and 2
	//   Menu     lit while the help menu is open (controls.menuPress)
	//   Armoury  controls.bonusPress; disabled whenever controls.bonusDisabled() says. With a mode on (Ante, Super Ante,
	//            an armed feature) the gear is lit gold like a small gear that is on, its mark dark on the gold; there is
	//            no room for the mode's name on it: the amount's own word says it (ui/hud/hudState.ts amtLabel), and the
	//            key's label for a screen reader names it, as on the dock
	// Disabled: at rest (a held round, nothing to play a run with) the gear is steel, the mock's disabled drawing; while a
	// round plays (Auto and the Armoury are disabled through every hand-played round) it only dims under a veil, so the
	// gear does not flip between iron and steel on every spin. The Armoury takes no veil while a round plays (Corey
	// 2026-11-23: "the change should be much smaller so it's not distracting"): only its mark steps a little dimmer.
	// The press box is the whole gear (the square round its tips) and never changes size; a press sinks the drawing.
	// CLASS NAMES: the kind is gk-auto, gk-turbo, gk-menu, gk-arm, never the dock's own auto / turbo / menuk (ui/hud/hud.css
	// paints those as glass keys wherever they stand under .hudp).
	import { stateBet, stateUi } from 'state-shared';
	import type { Controls } from '../controls.svelte';
	import { soc } from '../../game/social';
	import { modeShortLabel } from '../../game/betModeMeta';
	import { ARMOURY_TEXT, fill } from '../../game/armouryText';
	import { GEAR_PAD, smallGearArt } from './gearArt';
	import { DESKTOP, DESKTOP_GEARS, TOOTH, type Box } from './gearLayout';

	type Kind = 'auto' | 'turbo' | 'menu' | 'arm';
	/** geo: the gear as drawn, in the px its box is in (the phone's); absent: the desktop table's Auto and Turbo */
	type Props = { kind: Kind; controls: Controls; box: Box; geo?: { R: number; teeth: number; dep: number; word: number } };
	const { kind, controls, box, geo }: Props = $props();

	const level = $derived(controls.turboLevel());
	const bars = $derived(controls.jurisdiction().disabledSuperTurbo ? 2 : 3);
	const running = $derived(controls.autoRunning());
	const loaded = $derived(controls.autoLoadout() !== null);
	const onLabel = $derived(kind === 'arm' ? (controls.anteActive() ? modeShortLabel(stateBet.activeBetModeKey) : controls.armedLabel()) : null);
	const on = $derived(kind === 'auto' ? running || loaded : kind === 'menu' ? stateUi.menuOpen : kind === 'arm' ? onLabel !== null : false);
	// the drawing: made again only if its size, its teeth or the pip count changes
	const G = $derived(geo ?? { R: DESKTOP_GEARS[kind === 'turbo' ? 'turbo' : 'auto'].R, teeth: DESKTOP_GEARS.auto.teeth, dep: TOOTH.height, word: DESKTOP.text.word });
	const art = $derived(smallGearArt(kind, G.R, G.teeth, G.word, bars, G.dep));
	const pad = $derived((GEAR_PAD * box.w) / (2 * G.R));
	const disabled = $derived(kind === 'auto' ? controls.autoDisabled() : kind === 'turbo' ? stateBet.isSpaceHold : kind === 'arm' ? controls.bonusDisabled() : false);
	const press = $derived(kind === 'auto' ? controls.autoPress : kind === 'turbo' ? controls.turboPress : kind === 'menu' ? controls.menuPress : controls.bonusPress);
	const label = $derived(
		kind === 'auto' ? 'Autoplay' : kind === 'turbo' ? (level === 2 ? 'Turbo: instant' : level === 1 ? 'Turbo: on' : 'Turbo') : kind === 'menu' ? 'Menu' : on ? fill(ARMOURY_TEXT.aria.hudButtonOn, { name: onLabel ?? '' }) : soc('Buy bonus', 'Get bonus'),
	);
</script>

<button
	type="button"
	class="slot-btn hg gk gk-{kind} hit"
	class:fb={kind === 'arm'}
	class:is-on={on}
	class:ante={kind === 'arm' && on}
	class:is-run={kind === 'auto' && running}
	class:is-busy={!controls.isIdle()}
	data-l={kind === 'turbo' ? level : undefined}
	data-hud={kind === 'menu' ? 'menu-key' : undefined}
	data-piece={kind}
	style:left="{box.x}px"
	style:top="{box.y}px"
	style:width="{box.w}px"
	style:height="{box.h}px"
	style:--pad="{pad}px"
	style:--nudge="{-0.25 * art.period}deg"
	{disabled}
	onclick={press}
	aria-label={label}
	aria-expanded={kind === 'menu' ? on : undefined}
>
	<span class="ga">
		<span class="glayer under">{@html art.under}</span>
		<span class="gn"><span class="glayer turn" data-turn={kind}>{@html art.teeth}</span></span>
		<span class="glayer">{@html art.face}</span>
		<span class="glayer">{@html art.mark}</span>
	</span>
	{#if kind === 'arm' && on}<span class="lb">{onLabel}</span>{/if}
</button>
