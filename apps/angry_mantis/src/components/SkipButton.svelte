<script lang="ts">
	// THE SKIP BUTTON AND ITS PROMPT, ported from Manticore Mayhem (web-sdk 991c8e3, before its bronze HUD) for
	// Angry Mantis 1.0.13 (Corey 2026-10-15). Manticore's brief (Corey 2026-10-12): "like a half height Play Button
	// with two arrows, like a fast forward button. It doesn't need the text on it, but should show a prompt to
	// confirm". HTML, in its own fixed layer over the canvas and over the HUD (mounted beside the chrome in
	// components/Game.svelte), so nothing drawn in the canvas, the hosts included, can cover it. Where it sits per
	// layout: layoutSpec SKIP; its look: constants SKIP_HUD (this game's Play button plate, ui/SquareSpin.svelte).
	//
	// Up only while a feature's spins are playing: gameType 'freegame', the first free spin's reveal has begun
	// (stateGame.freeSpinsBegun, cleared by bonusStart, so the intro and the opening bites are never skippable),
	// not on the max-win spin (stateGame.capSpin), no press gate (the bonus intro and wrap-up, a big win screen),
	// no big win screen, not already skipping. It stays up over a regular win's plain plate (that plate's own
	// press gate is the one gate it ignores): a Yes there cuts the plate short (Win.svelte).
	//
	// A press does NOT skip. It opens the prompt "Skip to result?" beside the button. Yes is
	// stateGameDerived.requestSkip() and the press sound, and nothing else; No, a tap anywhere else, SKIP_HUD.promptMs
	// with no answer, or the button going down closes it. All of that is this component's own state and one timer: the
	// board's event flow is not touched and nothing waits on the prompt, so the feature plays on underneath.
	// THE SOUNDS (Manticore, Corey 2026-10-13: "use the same sound as the hamburger menu"): every press of the button
	// itself, the one that opens the prompt and the one that closes it again, broadcasts what the HUD's menu button
	// broadcasts on each of its presses (ui/controls.svelte.ts menuPress: 'soundPressMinor'). Yes has the same event.
	// No is silent, like CANCEL on the HUD's other confirm prompt, and so are a tap elsewhere and the timeout.
	// NOT WHERE THE OPERATOR FORBIDS IT: jurisdiction.disabledSlamstop or disabledTurbo (see `allowed` below).
	// Touch and pointer only, no hotkey (the button is disabled while it is down, so a held Space never reaches it).
	//
	// House rules: no backdrop-filter, no mask; the fades are opacity; every number from layoutSpec / constants. (The one
	// CSS filter on it is the HUD's shared mouse hover lift, ui/ChromeStyles.svelte.)
	import { onDestroy } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';

	import { getContext } from '../game/context';
	import { featureSpinsLive, skipAllowed } from '../game/stateGame.svelte';
	import { SKIP, layoutKind, skipButtonRect, skipPromptRect, skipSpot } from '../game/layoutSpec';
	import { SKIP_HUD } from '../game/constants';
	import Icon from '../ui/Icon.svelte';

	const context = getContext();
	const sg = context.stateGame;

	// STAKE'S JURISDICTION SWITCHES (stateGame.svelte.ts skipAllowed): with disabledSlamstop or disabledTurbo there is no
	// SKIP, and nothing of it is rendered at all (not a hidden button)
	const allowed = $derived(skipAllowed());
	// a regular win's plain plate holds one press gate of its own (Win.svelte's PressToContinue, for as long as
	// stateGame.winPlate says 'plain'); a big win screen, the intro and the wrap-up take the button down
	const up = $derived(
		allowed && featureSpinsLive() && sg.freeSpinsBegun && !sg.capSpin && !sg.skipping && !(sg.winPlate === 'big' && (sg.winShowing || sg.pressGates > 0)) && sg.pressGates <= (sg.winPlate === 'plain' ? 1 : 0),
	);

	// ---- where: the button's box by the layout rule, the prompt's box beside it ----
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const view = $derived({ width: innerWidth.current ?? 1, height: innerHeight.current ?? 1 });
	const spot = $derived(skipSpot(kind, view));
	const box = $derived(skipButtonRect(kind, spot, view));
	/** the Play button's size on this screen, CSS px (the button is that wide), and CSS px per master px */
	const play = $derived(box.width);
	const playMaster = $derived(SKIP.play[kind]);
	const scale = $derived(play / playMaster);
	// the Play button's own ring and radius (ui/SquareSpin.svelte works them out in master px; the chrome scales them)
	const ring = $derived(Math.max(SKIP_HUD.ring.min, playMaster * SKIP_HUD.ring.share) * scale);
	const radius = $derived(Math.min(Math.round(Math.min(playMaster * SKIP_HUD.radius.share, SKIP_HUD.radius.base + playMaster * SKIP_HUD.radius.grow)) * scale, box.height / 2));
	const hit = $derived(Math.max(0, (SKIP_HUD.minHitCss - box.height) / 2));
	const P = SKIP_HUD.prompt;
	const ask = $derived.by(() => {
		const buttonW = Math.max(P.button.minW, play * P.button.w);
		const buttonH = Math.max(P.button.minH, play * P.button.h);
		const font = Math.max(P.font.min, play * P.font.share);
		const pad = Math.max(P.pad.min, play * P.pad.share);
		const gap = Math.max(P.gap.min, play * P.gap.share);
		const size = { width: buttonW * 2 + gap + pad * 2, height: pad * 2 + font * P.line + gap + buttonH };
		return { buttonW, buttonH, font, pad, gap, rect: skipPromptRect(kind, box, size, P.gapCss, view) };
	});

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
	// the button went down under an open prompt (the feature ended, a big win or the max-win spin came up)
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
		// house rule: extend __angryMantis, never a new global (the 1.0.13 skip probe reads these)
		Object.assign(((window as any).__angryMantis ??= {}), {
			skipHud: () => ({ promptMs: SKIP_HUD.promptMs, minHitCss: SKIP_HUD.minHitCss, open, up, allowed, spot, box }),
			/** press Yes without the prompt (stateGameDerived.requestSkip): true if the skip took */
			skip: () => context.stateGameDerived.requestSkip(),
			skipping: () => sg.skipping,
			/** what a skipped and an unskipped run of one book must agree on at the wrap-up */
			skipState: () => ({
				skipping: sg.skipping,
				begun: sg.freeSpinsBegun,
				capSpin: sg.capSpin,
				gameType: sg.gameType,
				pool: [...sg.symbolPool],
				eaten: [...sg.eatenSymbols],
				totalFs: sg.totalFs,
				spinsPlayed: sg.spinsPlayed,
				consumed: sg.consumedLeaves.length,
				recap: sg.sessionRecap ? { ...sg.sessionRecap, eatenList: [...sg.sessionRecap.eatenList] } : null,
				board: sg.board.map((reel) => reel.reelState.symbols.map((s) => `${s.rawSymbol?.name}:${s.symbolState}`)),
				servingSymbol: sg.servingSymbol,
				winPlate: sg.winPlate,
			}),
		});
	}
</script>

{#if allowed}
<div class="am-ui skip-layer" bind:this={root} style:--in="{SKIP_HUD.inMs}ms" style:--out="{SKIP_HUD.outMs}ms">
	<button
		class="slot-btn skip"
		class:up
		data-skip="button"
		disabled={!up}
		onclick={press}
		aria-label="Skip to result"
		aria-expanded={open}
		style:left="{box.x}px"
		style:top="{box.y}px"
		style:width="{box.width}px"
		style:height="{box.height}px"
		style:border-radius="{radius}px"
		style:background={SKIP_HUD.plate}
		style:box-shadow="inset 0 0 0 {ring}px {SKIP_HUD.ring.color}, 0 4px 12px rgba(0,0,0,.45)"
		style:--hit="-{hit}px"
	>
		<Icon name="skip" s={box.height * SKIP_HUD.glyphShare} />
	</button>
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
				<button class="slot-btn yes" data-skip="yes" onclick={yes}>Yes</button>
				<button class="slot-btn no" data-skip="no" onclick={close}>No</button>
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
	.skip {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--out) ease, transform 0.08s ease, filter var(--ui-hover-ms) ease;
	}
	.skip.up {
		opacity: 1;
		pointer-events: auto;
		transition: opacity var(--in) ease, transform 0.08s ease, filter var(--ui-hover-ms) ease;
	}
	.skip:disabled {
		opacity: 0;
		cursor: default;
	}
	.skip:active:not(:disabled) {
		transform: translateY(1px);
	}
	/* the touch target, grown to SKIP_HUD.minHitCss without moving a pixel */
	.skip::after {
		content: '';
		position: absolute;
		inset: var(--hit, 0px) 0;
	}
	/* the black glass of the menu and the modals (ChromeStyles.svelte), with no backdrop-filter */
	.ask {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		background: var(--ui-glass);
		/* (the hairline edge is drawn inside the box, so Yes and No keep their whole size) */
		border-radius: 10px;
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.55), inset 0 0 0 1px var(--ui-glass-edge), inset 0 1px 0 var(--ui-glass-hi);
		color: var(--ui-ink);
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
		font-weight: 800;
		letter-spacing: 0.04em;
		transition: transform 0.08s ease, filter var(--ui-hover-ms) ease;
	}
	.yes {
		background: var(--ui-gold);
		color: var(--ui-gold-ink);
	}
	.no {
		background: var(--ui-glass-well-2);
		color: var(--ui-ink);
		box-shadow: inset 0 0 0 1px var(--ui-rule-2);
	}
	.yes:active,
	.no:active {
		transform: translateY(1px);
	}
</style>
