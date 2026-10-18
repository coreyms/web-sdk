<script lang="ts">
	import { OnHotkey } from 'components-shared';
	import { MainContainer, OnPressFullScreen } from 'components-layout';
	import { Tween } from 'svelte/motion';
	import { onMount, untrack } from 'svelte';

	import { getContext } from '../game/context';
	import { HUD, HUD_BAND_PROMPT_Y, PROMPT_BOARD_ROW, PROMPT_IN_ROW, boardRowRect, boardRowShift, layoutKind } from '../game/layoutSpec';
	import { plaquePrompt, plaquePromptReady } from '../game/plaquePrompt.svelte';
	import PressPromptText from './PressPromptText.svelte';

	// `active` (default true — conditionally-mounted gates need nothing): consumers whose
	// PressToContinue stays ALWAYS mounted under a persistent FadeContainer (BonusIntro) pass
	// their `show` here so the gate follows visibility, not mount.
	// `atHudBand`: put the prompt in the layout's band UNDER the board (layoutSpec HUD_BAND_PROMPT_Y) instead of its HUD
	// slot. On the desktop the slot is over the board's bottom row since the board grew (2026-10-16); the max win
	// screen hides the board, and its own lines run down to y 0.77 of the screen, so its prompt keeps the band.
	type Props = { onpress: () => void; showText?: boolean; active?: boolean; atHudBand?: boolean };
	const props: Props = $props();
	const context = getContext();
	const active = $derived(props.active ?? true);
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const slot = $derived.by(() => {
		const s = HUD[kind].pressToContinue;
		if (props.atHudBand) return { ...s, y: HUD_BAND_PROMPT_Y[kind] };
		// the desktop slot is over the bottom row: on a taller desktop screen the bigger board's (layoutSpec LANDSCAPE_TALL)
		const dy = boardRowShift(kind, PROMPT_BOARD_ROW);
		return dy ? { ...s, y: s.y + dy } : s;
	});
	// ON THE DESKTOP (landscape, not the max win's band) the prompt is drawn ON THE BOARD PLAQUE (Corey 2026-10-17 15:32,
	// "2. Yes, that's a great idea!"): components/BoardPlaque.svelte draws it on the plaque's text field, centred in its
	// slanted window, in the plaque's own layer stack, with this component's blink (game/plaquePrompt.svelte.ts). The
	// dark veil over the board's bottom row (2026-10-16, PROMPT_VEIL) is gone (Corey 15:31: "on desktop does it really
	// hold a tinted background over the board?"). Phone and portrait (and the max win's band) are drawn as before.
	// THE FACE (fonts r2, Corey 2026-10-17 14:01): Cinzel 700, drawn once into a texture (PressPromptText,
	// game/pressPrompt.ts) where the Black Ops One atlas line (ArtAmount) was: the same slot, cap height, centring and
	// maxWidth fit.
	// THE FALLBACK: until the plaque can draw it (its art not in yet, or Cinzel never loading: then it stays the atlas
	// line) the desktop's line is drawn where it was, over the board's bottom row, fitted inside it (layoutSpec
	// PROMPT_BOARD_ROW, PROMPT_IN_ROW) with the hard drop shadow the board's readouts use, and no veil.
	const PROMPT_SHADOW = { dx: 0.05, dy: 0.06, tint: 0x0a0b0d };
	const overBoard = $derived(kind === 'landscape' && !props.atHudBand);
	const onPlaque = $derived(overBoard && plaquePromptReady.ready);
	const shadow = $derived(overBoard ? PROMPT_SHADOW : undefined);
	const rowRect = $derived(overBoard ? boardRowRect(kind, PROMPT_BOARD_ROW) : null);
	const fitWidth = $derived(rowRect ? Math.min(slot.width, rowRect.width * PROMPT_IN_ROW) : slot.width);
	// the plaque's count of desktop prompts up (a counter: gates can overlap during transitions; the cleanup keeps it
	// balanced on hide, unmount and a change of layout)
	$effect(() => {
		if (!props.showText || !overBoard) return;
		plaquePrompt.count += 1;
		return () => {
			plaquePrompt.count -= 1;
		};
	});

	// Press-gate registration: the emitter fans the Space hotKey out to EVERY OnHotkey, so without
	// this a "continue" press also reached Chrome's Space→controls.spin, whose stopButtonClick
	// subscriber force-enables turbo (non-persistently) and rushes the reels. While any gate is
	// active, stateGame.pressGates > 0 disables Chrome's spin/stop hotkey (its `disabled` expr);
	// this component's own hotkey keeps working. A counter, not a boolean — gates can overlap
	// during transitions; the effect cleanup keeps it balanced on hide/unmount.
	$effect(() => {
		if (!active) return;
		// untrack: `+= 1` READS pressGates, and an effect that reads what it writes re-runs
		// itself forever (live-caught: the intro's gate pinned the main thread at 100%)
		untrack(() => (context.stateGame.pressGates += 1));
		return () => {
			untrack(() => (context.stateGame.pressGates -= 1));
		};
	});

	// DEV: how many PRESS ANYWHERE TO CONTINUE texts are on screen right now (`__manticore.pressPrompts()`; the
	// probes assert the win plaque never shows one and the feature intro / wrap up do)
	$effect(() => {
		if (!import.meta.env.DEV || typeof window === 'undefined' || !props.showText) return;
		const m = ((window as any).__manticore ??= {});
		m.__prompts = (m.__prompts ?? 0) + 1;
		m.pressPrompts ??= () => m.__prompts ?? 0;
		return () => (m.__prompts -= 1);
	});

	const blink = new Tween(1, { duration: 700 });
	// the blink, handed to the plaque while the line is there (a plain number its tick reads)
	$effect(() => {
		const a = blink.current;
		if (props.showText && overBoard) plaquePrompt.alpha = a;
	});
	let alive = true;
	onMount(() => {
		(async () => {
			while (alive) {
				await blink.set(0.45);
				await blink.set(1);
			}
		})();
		return () => (alive = false);
	});
</script>

{#if props.showText && !onPlaque}
<MainContainer>
	<PressPromptText
		height={slot.height * 0.42}
		x={context.stateLayoutDerived.mainLayout().width * 0.5}
		y={slot.y - slot.height * 0.5}
		alpha={blink.current}
		maxWidth={fitWidth}
		{shadow}
	/>
</MainContainer>
{/if}
<OnHotkey hotkey="Space" disabled={!active} onpress={() => props.onpress()} />
<OnPressFullScreen onpress={() => props.onpress()} />
