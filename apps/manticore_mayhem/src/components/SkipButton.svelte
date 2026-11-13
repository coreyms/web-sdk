<script lang="ts">
	// THE SKIP BUTTON AND ITS PROMPT (Corey 2026-10-12: "like a half height Play Button with two arrows, like a fast
	// forward button. It doesn't need the text on it, but should show a prompt to confirm"). It replaces the Pixi
	// SKIP TO RESULT plate. HTML, in its own fixed layer over the canvas and over the HUD (mounted beside the chrome in
	// components/Game.svelte), so nothing drawn in the canvas, the creature included, can cover it. Top right in every
	// view: layoutSpec SKIP has the rule, constants SKIP_HUD the look.
	//
	// Up only while a feature's spins are playing, exactly as the plate was: gameType 'freegame', the first free spin's
	// reveal has begun (fs >= 1, bonusStart zeroes it), no plaque, no press gate, no win screen, not already skipping.
	//
	// A press does NOT skip. It opens the prompt "Skip to result?" beside the button. Yes is
	// stateGameDerived.requestSkip() and the press sound, and nothing else; No, a tap anywhere else, SKIP_HUD.promptMs
	// with no answer, or the button going down closes it. All of that is this component's own state and one timer: the
	// board's event flow is not touched and nothing waits on the prompt, so the feature plays on underneath.
	// THE SOUNDS (Corey 2026-10-13: "use the same sound as the hamburger menu"): every press of the button itself, the
	// one that opens the prompt and the one that closes it again, broadcasts what the HUD's menu button broadcasts on
	// each of its presses (ui/controls.svelte.ts menuPress: 'soundPressMinor'). Yes has the same event, as before. No
	// is silent, like CANCEL on the HUD's other confirm prompt (the Armoury's confirm card), and so are a tap elsewhere
	// and the timeout, like a tap beside the menu's popover.
	// NOT WHERE THE OPERATOR FORBIDS IT: jurisdiction.disabledSlamstop or disabledTurbo (see `allowed` below).
	// Touch and pointer only, no hotkey (the button is disabled while it is down, so a held Space never reaches it).
	//
	// House rules: no backdrop-filter, no mask, no filter; the fades are opacity; the place is ui/hud/hudLayout.ts, the look the
	// HUD glass (ui/hud/HudStyles.svelte, ui/hudTheme.ts).
	import { onDestroy } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';

	import { getContext } from '../game/context';
	import { featureSpinsLive, skipAllowed } from '../game/stateGame.svelte';
	import { isPhoneSizeType, layoutKind, SKIP, type CssRect } from '../game/layoutSpec';
	import { SKIP_HUD } from '../game/constants';
	import { hudSkipRect, readSafeInsets } from '../ui/hud/hudLayout';
	import '../ui/hudTheme';
	import HudIcon from '../ui/hud/HudIcon.svelte';

	const context = getContext();
	const sg = context.stateGame;

	// STAKE'S JURISDICTION SWITCHES (stateGame.svelte.ts skipAllowed): with disabledSlamstop or disabledTurbo there is no
	// SKIP, and nothing of it is rendered at all (not a hidden button)
	const allowed = $derived(skipAllowed());
	const up = $derived(allowed && featureSpinsLive() && !sg.skipping && sg.fs >= 1 && !sg.plaque && sg.pressGates === 0 && !sg.winShowing);

	// ---- where (HUD round 5, "Drop 6", 2026-11-12): the HUD's own rule (ui/hud/hudLayout.ts hudSkipRect): a small glass
	// capsule. Desktop, wide, tablet: right of the plaque, just over the dock; portrait phone: top right under the clock
	// row; landscape phone: squared under the Auto and Turbo capsule, its width. Its prompt opens UNDER it where there is
	// room (the phones) and over it otherwise (the big screens: under it is the dock). ----
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const phone = $derived(isPhoneSizeType(context.stateLayoutDerived.canvasSizeType()));
	const view = $derived({ width: innerWidth.current ?? 1, height: innerHeight.current ?? 1 });
	const safe = $derived.by(() => {
		void view;
		return readSafeInsets();
	});
	const hb = $derived(hudSkipRect({ kind, phone, vw: view.width, vh: view.height, safe }));
	const box = $derived({ x: hb.x, y: hb.y, width: hb.width, height: hb.height });
	/** the size the prompt is drawn at: the old rule took shares of the Play button (78..116 master px); here a 92 px Spin's */
	const play = $derived(92 * hb.u);
	const hit = $derived(Math.max(0, (SKIP_HUD.minHitCss - box.height) / 2));
	const P = SKIP_HUD.prompt;
	const ask = $derived.by(() => {
		const buttonW = Math.max(P.button.minW, play * P.button.w);
		const buttonH = Math.max(P.button.minH, play * P.button.h);
		const font = Math.max(P.font.min, play * P.font.share);
		const pad = Math.max(P.pad.min, play * P.pad.share);
		const gap = Math.max(P.gap.min, play * P.gap.share);
		const size = { width: buttonW * 2 + gap + pad * 2, height: pad * 2 + font * P.line + gap + buttonH };
		return { buttonW, buttonH, font, pad, gap, rect: promptRect(box, size, P.gapCss) };
	});
	const promptRect = (b: CssRect, size: { width: number; height: number }, g: number): CssRect => {
		const E = SKIP.edgeCss;
		const below = hb.variant === 'portrait' || hb.variant === 'landscape';
		const fits = b.y + b.height + g + size.height <= view.height - E;
		const y = below && fits ? b.y + b.height + g : b.y - g - size.height;
		const x = b.x + b.width - size.width;
		const hold = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
		return { x: hold(x, E, view.width - E - size.width), y: hold(y, E, view.height - E - size.height), ...size };
	};

	// ---- the prompt ----
	let open = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let root: HTMLDivElement | undefined = $state();
	const close = () => {
		clearTimeout(timer);
		open = false;
	};
	const press = () => {
		if (!up) return;
		context.eventEmitter.broadcast({ type: 'soundPressMinor' });
		if (open) return close();
		open = true;
		clearTimeout(timer);
		timer = setTimeout(close, SKIP_HUD.promptMs);
	};
	const yes = () => {
		close();
		if (!up) return;
		if (context.stateGameDerived.requestSkip()) context.eventEmitter.broadcast({ type: 'soundPressMinor' });
	};
	// the button went down under an open prompt (the feature ended, a plaque or a win screen came up)
	$effect(() => {
		if (!up) close();
	});
	// a tap anywhere else closes it; the tap itself is left alone
	$effect(() => {
		if (!open) return;
		const away = (event: PointerEvent) => {
			if (!root?.contains(event.target as Node)) close();
		};
		window.addEventListener('pointerdown', away, true);
		return () => window.removeEventListener('pointerdown', away, true);
	});
	onDestroy(() => clearTimeout(timer));

	if (import.meta.env.DEV && typeof window !== 'undefined') {
		// house rule: extend __manticore, never a new global (tools/manticore/skip_probe.js reads the constants)
		((window as any).__manticore ??= {}).skipHud = () => ({ promptMs: SKIP_HUD.promptMs, minHitCss: SKIP_HUD.minHitCss, open, up, allowed });
	}
</script>

{#if allowed}
<div class="am-ui skip-layer" bind:this={root} style:--in="{SKIP_HUD.inMs}ms" style:--out="{SKIP_HUD.outMs}ms">
	<div class="hudp skiproot v-{hb.variant}" style:transform="scale({hb.u})" style:width="{box.width / hb.u}px" style:height="{box.height / hb.u}px" style:left="{box.x}px" style:top="{box.y}px">
	<button
		class="slot-btn hg gl fs pill skip"
		class:up
		data-skip="button"
		disabled={!up}
		onclick={press}
		aria-label="Skip to result"
		aria-expanded={open}
		style:--hit="-{hit / hb.u}px"
	>
		<HudIcon name="skip" /><span>SKIP</span>
	</button>
	</div>
	{#if open && up}
		<div
			class="ask"
			data-skip="prompt"
			role="dialog"
			aria-label="Skip to result?"
			style:left="{ask.rect.x}px"
			style:top="{ask.rect.y}px"
			style:width="{ask.rect.width}px"
			style:height="{ask.rect.height}px"
			style:padding="{ask.pad}px"
			style:gap="{ask.gap}px"
			style:font-size="{ask.font}px"
		>
			<span class="q" style:line-height={P.line}>Skip to result?</span>
			<div class="row" style:gap="{ask.gap}px" style:height="{ask.buttonH}px">
				<button class="slot-btn hg yes" data-skip="yes" onclick={yes}>Yes</button>
				<button class="slot-btn hg no" data-skip="no" onclick={close}>No</button>
			</div>
		</div>
	{/if}
</div>
{/if}

<style>
	/* over the HUD (Chrome.svelte's layer is 20), under the modals (60) */
	.skip-layer {
		position: fixed;
		inset: 0;
		z-index: 21;
		pointer-events: none;
		overflow: hidden;
	}
	.skiproot {
		position: absolute;
		transform-origin: 0 0;
	}
	.skiproot .skip {
		position: absolute;
		left: 0;
		top: 0;
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--out) ease, transform 0.12s ease;
	}
	.skiproot .skip.up {
		opacity: 1;
		pointer-events: auto;
		transition: opacity var(--in) ease, transform 0.12s ease;
	}
	/* down (disabled): gone, whatever the HUD glass's own disabled look says */
	.skiproot .skip:not(.up),
	.skiproot .skip:disabled {
		opacity: 0 !important;
		pointer-events: none;
		cursor: default;
	}
	/* the touch target, grown to SKIP_HUD.minHitCss without moving a pixel */
	.skip::after {
		content: '';
		position: absolute;
		inset: var(--hit, 0px) 0;
	}
	/* the HUD's panel glass (ChromeStyles .am-glass, ui/hudTheme.ts tokens), no backdrop-filter */
	.ask {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		background: linear-gradient(180deg, rgba(var(--hud-glass-top-rgb), 0.96), rgba(var(--hud-glass-bottom-rgb), 0.97));
		border-radius: 14px;
		/* the 1 px edge drawn as inset shadows (white top, gold bottom), so Yes and No keep the whole height */
		box-shadow: inset 0 1px 0 rgba(var(--hud-edge-top-rgb), 0.44), inset 0 -1px 0 rgba(var(--hud-edge-bottom-rgb), 0.72), inset 1px 0 0 rgba(var(--hud-ink-rgb), 0.12), inset -1px 0 0 rgba(var(--hud-ink-rgb), 0.12), 0 14px 30px rgba(var(--hud-shadow-rgb), 0.55);
		color: rgb(var(--hud-ink-rgb));
		font-family: var(--hud-font);
		pointer-events: auto;
	}
	.q {
		display: block;
		text-align: center;
		font-weight: 800;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
	.row {
		display: flex;
	}
	.yes,
	.no {
		flex: 1 1 0;
		min-width: 0;
		height: 100%;
		border-radius: 8px;
		font-size: 1em;
		font-family: var(--hud-font);
		font-weight: 900;
		letter-spacing: 0.08em;
		transition: transform 0.08s ease;
	}
	.yes {
		border-radius: 999px;
		border: 1px solid;
		border-color: var(--hud-spin-rim-top) var(--hud-spin-rim-side) var(--hud-spin-rim-bottom);
		background: radial-gradient(ellipse 70% 120% at 50% 0%, rgba(var(--hud-accent-cream-rgb), 0.3), rgba(var(--hud-accent-cream-rgb), 0) 62%), linear-gradient(180deg, rgba(var(--hud-spin-core-rgb), 0.94), rgba(var(--hud-spin-deep-rgb), 0.95));
		color: rgb(var(--hud-accent-hi-rgb));
		box-shadow: inset 0 1px 0 rgba(var(--hud-accent-cream-rgb), 0.5), 0 0 14px rgba(var(--hud-accent-rgb), 0.2);
	}
	.no {
		border-radius: 999px;
		border: 1px solid;
		border-color: rgba(var(--hud-ink-rgb), 0.38) rgba(var(--hud-ink-rgb), 0.12) rgba(var(--hud-accent-rgb), 0.44);
		background: rgba(var(--hud-key-rgb), 0.5);
		color: rgb(var(--hud-ink-rgb));
	}
	.yes:active,
	.no:active {
		transform: translateY(1px);
	}
</style>
