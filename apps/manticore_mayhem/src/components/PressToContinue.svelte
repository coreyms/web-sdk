<script lang="ts">
	import { OnHotkey } from 'components-shared';
	import { MainContainer, OnPressFullScreen } from 'components-layout';
	import { Container, Rectangle } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { onMount, untrack } from 'svelte';

	import { getContext } from '../game/context';
	import { HUD, HUD_BAND_PROMPT_Y, PROMPT_IN_ROW, PROMPT_VEIL, boardRowRect, layoutKind } from '../game/layoutSpec';
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
		return props.atHudBand ? { ...s, y: HUD_BAND_PROMPT_Y[kind] } : s;
	});
	// OVER THE BOARD (the desktop slot, 2026-10-16) the prompt crosses the bottom row's symbols: that row is veiled
	// while it is up (layoutSpec PROMPT_VEIL) and the letters get the hard drop shadow the board's own readouts use
	// (components/Board.svelte), a second copy of them, no filter. Phone and portrait (and the max win's band) are drawn
	// as before, without either.
	// THE FACE (fonts r2, Corey 2026-10-17 14:01): Cinzel 700, drawn once into a texture (PressPromptText,
	// game/pressPrompt.ts) where the Black Ops One atlas line (ArtAmount) was: the same slot, cap height, centring and
	// maxWidth fit, and over the board also fitted inside the veiled row (layoutSpec PROMPT_IN_ROW).
	const PROMPT_SHADOW = { dx: 0.05, dy: 0.06, tint: 0x0a0b0d };
	const overBoard = $derived(kind === 'landscape' && !props.atHudBand);
	const shadow = $derived(overBoard ? PROMPT_SHADOW : undefined);
	const veilRect = $derived(overBoard ? boardRowRect(kind, PROMPT_VEIL.row) : null);
	// over the board the line also stays inside the veiled row (fonts r2: Cinzel is wider than the stencil was)
	const fitWidth = $derived(veilRect ? Math.min(slot.width, veilRect.width * PROMPT_IN_ROW) : slot.width);
	const veil = new Tween(0, { duration: PROMPT_VEIL.fadeMs });
	$effect(() => {
		const on = !!props.showText && overBoard;
		untrack(() => void veil.set(on ? 1 : 0, { duration: on ? PROMPT_VEIL.fadeMs : 0 }));
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

{#if props.showText}
<MainContainer>
	<!-- the veil's own container is always there, so the veil (mounted later) stays UNDER the glyphs -->
	<Container>
		{#if veilRect && veil.current > 0}
			<Rectangle x={veilRect.x} y={veilRect.y} width={veilRect.width} height={veilRect.height} backgroundColor={PROMPT_VEIL.color} alpha={PROMPT_VEIL.alpha * veil.current} />
		{/if}
	</Container>
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
