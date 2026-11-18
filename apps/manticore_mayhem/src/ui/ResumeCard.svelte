<script lang="ts">
	// THE RESUME CARD (2026-11-18, a stock rule for every game; Corey: "Skip the landing screen, it should automatically give
	// a card that gives players the option to resume Skip to Result, or Play Round. This should exist for both games.").
	// A load with an unfinished round (authenticate's round is active; never in a replay, components/Game.svelte decides)
	// shows this card in place of the landing screen: PLAY ROUND (the default focus) replays the round as before, SKIP TO
	// RESULT plays its remaining events with every wait collapsed and shows the final board and total (game/resumeChoice.ts,
	// components/ResumeBet.svelte). The round is settled by its one end-round either way. SKIP TO RESULT is offered only
	// where the operator allows the skip (stateGame skipAllowed); otherwise the card has the one choice.
	//
	// It is the landing screen's stand-in, so it does what that screen does for the handoff: it releases the shell splash
	// once the Pixi preload is in, it waits for the same gate before a choice can be pressed (the preload, the faces, the
	// audio, the load gate up to its cap, the splash gone), and its press is the first user gesture: the sound starts with
	// it, never before. The HUD is hidden and takes nothing under it (Chrome's layer is hidden while the loading screen is
	// up). The look (Corey 2026-11-18 on the first sheet: "I don't like the intro card being used for the round in
	// progress, we should use the plain version, but I'd like skip to result to be on the left"): THE ARMOURY's plain
	// tray slab at every layout, a small MANTICORE UNLEASHED line, the gold Cinzel UNFINISHED ROUND, the sentence, then
	// SKIP TO RESULT (left, the iron key) and PLAY ROUND (right, the gold key, the default focus). On upright phones the slab
	// spans the width and the keys stack, SKIP TO RESULT first (side by side they would be under a comfortable tap size).
	// One press, one action (Enter or Space on the focused choice; a key's auto-repeat does nothing); the arrows follow the
	// visual order (left / up: SKIP TO RESULT; right / down: PLAY ROUND), Tab moves to the other key.
	import { onMount, untrack } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';

	import { getContext } from '../game/context';
	import { boot, dropCardHolder, releaseSplash } from '../game/boot.svelte';
	import { loadGate } from '../game/loadGate.svelte';
	import { sound } from '../game/sound';
	import { LOAD_GATE } from '../game/constants';
	import { skipAllowed } from '../game/stateGame.svelte';
	import { resumeChoice } from '../game/resumeChoice';

	type Choice = 'play' | 'skip';
	type Props = { onchoose: (choice: Choice) => void };
	const props: Props = $props();
	const context = getContext();

	const TX = {
		// the same title and sentence as Run Over Reindeer's card (Corey 2026-11-18: "Yes" to one title in both games, and
		// Reindeer's sentence "It's good."), in this game's lettering
		title: 'UNFINISHED ROUND',
		text: 'Your last round did not finish. Play it on from where it stopped, or skip straight to its result. Either way it ends exactly as it was decided.',
		textOne: 'Your last round did not finish. It plays on from where it stopped and ends exactly as it was decided.',
		play: 'PLAY ROUND',
		skip: 'SKIP TO RESULT',
		loading: 'LOADING',
		failed: 'Some game files did not load.',
		retry: 'TRY AGAIN',
	};
	const canSkip = skipAllowed();

	// ---- the handoff and the gate (ui/LandingScreen.svelte's rules) ----------------------------------------------------
	let fontsReady = $state(false);
	onMount(async () => {
		boot.landingMounted = true;
		resumeChoice.shown = true;
		try {
			await Promise.all([document.fonts.load('900 40px Outfit'), document.fonts.load("700 40px 'Cinzel'")]);
		} catch {
			/* best effort */
		}
		fontsReady = true;
	});
	const assetsFailed = $derived(context.stateApp.failedAssets.length > 0);
	$effect(() => {
		if (!boot.landingReady) return;
		if (!(context.stateApp.preLoaded || assetsFailed)) return;
		const id = setTimeout(releaseSplash, 350);
		return () => clearTimeout(id);
	});
	const audioReady = $derived(sound.isReady);
	let capped = $state(false);
	$effect(() => {
		if (!audioReady || capped) return;
		if (LOAD_GATE.capMs === null) void loadGate.filesDone;
		const ms = LOAD_GATE.capMs ?? LOAD_GATE.stallMs;
		const id = setTimeout(() => (capped = true), ms);
		return () => clearTimeout(id);
	});
	const ready = $derived(context.stateApp.preLoaded && fontsReady && audioReady && (loadGate.settled || capped) && boot.splashOut);

	// ---- the press ------------------------------------------------------------------------------------------------------
	let chosen = $state<Choice | null>(null);
	let focusKey = $state<Choice>('play');
	let playEl: HTMLButtonElement | undefined = $state();
	let skipEl: HTMLButtonElement | undefined = $state();
	const choose = (c: Choice) => {
		if (!ready || chosen) return;
		chosen = c;
		resumeChoice.choice = c;
		resumeChoice.chosenAt = performance.now();
		dropCardHolder();
		// the press's own voice, as the landing screen's (the sprite is one of the things the gate waited for)
		sound.players.once.play({ name: 'sfx_ui_minor' });
		props.onchoose(c);
	};
	// the default focus: PLAY ROUND, once a choice can be pressed
	$effect(() => {
		if (!ready || chosen) return;
		untrack(() => (focusKey === 'skip' ? skipEl : playEl)?.focus({ preventScroll: true }));
	});
	const onKey = (e: KeyboardEvent) => {
		if (chosen) return;
		const k = e.key;
		if (k === 'Enter' || k === ' ') {
			e.preventDefault();
			e.stopPropagation();
			if (e.repeat || !ready) return;
			choose(document.activeElement === skipEl && canSkip ? 'skip' : focusKey === 'skip' && canSkip ? 'skip' : 'play');
			return;
		}
		if (canSkip && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown' || k === 'Tab')) {
			e.preventDefault();
			e.stopPropagation();
			// the visual order: SKIP TO RESULT first (left, or above when stacked), PLAY ROUND second
			focusKey = k === 'ArrowLeft' || k === 'ArrowUp' ? 'skip' : k === 'ArrowRight' || k === 'ArrowDown' ? 'play' : focusKey === 'play' ? 'skip' : 'play';
			(focusKey === 'skip' ? skipEl : playEl)?.focus({ preventScroll: true });
		}
	};

	// ---- the layout: one slab. Wide windows: a 520 x 230 design scaled to at most 680 wide (1.31x; 832 on big desktops)
	// and to the window (92 % of its width, 90 % of its height: a 400 x 225 popout takes 0.72x). Upright phones (narrower
	// than 600 and taller than wide): the window's width less 16 px a side at 1x, the keys stacked
	const vw = $derived(innerWidth.current ?? 1280);
	const vh = $derived(innerHeight.current ?? 720);
	const upright = $derived(vw < 600 && vh > vw);
	// (big desktops: up to 48 % of the window's width, at most 832 px: 1.6x on a 1920 x 1080, so it is not lost in the room)
	const maxW = $derived(vw >= 1200 ? Math.min(832, Math.max(680, vw * 0.48)) : 680);
	const slabK = $derived(upright ? 1 : Math.min(maxW / 520, (vw * 0.92) / 520, (vh * 0.9) / 230));
	const slabW = $derived(upright ? vw - 32 : 520 * slabK);
</script>

<svelte:window onkeydowncapture={onKey} />

<div class="resume" class:chosen={!!chosen} role="dialog" aria-modal="true" aria-labelledby="resume-title" data-resume-card>
	<div class="dim"></div>
	<div class="slab" class:upright style:--k={slabK} style:width="{slabW}px">
		<div class="slab-in">
			<div class="kicker">MANTICORE UNLEASHED</div>
			<h2 class="name" id="resume-title">{TX.title}</h2>
			<p class="text">{canSkip ? TX.text : TX.textOne}</p>
			{@render keys()}
		</div>
	</div>
</div>

{#snippet keys()}
	{#if assetsFailed}
		<p class="note">{TX.failed}</p>
		<div class="keys one">
			<button type="button" class="btn" onclick={() => context.stateApp.retryFailedAssets?.()}><span class="face">{TX.retry}</span></button>
		</div>
	{:else}
		<!-- SKIP TO RESULT first (left, or on top when stacked), PLAY ROUND second (Corey 2026-11-18); PLAY ROUND is the default focus -->
		<div class="keys" class:one={!canSkip}>
			{#if canSkip}
				<button type="button" class="btn alt" data-choice="skip" bind:this={skipEl} disabled={!ready || !!chosen} onclick={() => choose('skip')} onfocus={() => (focusKey = 'skip')}>
					<span class="face">{ready ? TX.skip : TX.loading}</span>
				</button>
			{/if}
			<button type="button" class="btn" data-choice="play" bind:this={playEl} disabled={!ready || !!chosen} aria-disabled={!ready} onclick={() => choose('play')} onfocus={() => (focusKey = 'play')}>
				<span class="face">{ready ? TX.play : TX.loading}</span>
			</button>
		</div>
	{/if}
{/snippet}

<style>
	.resume {
		--gold: #e2bf72;
		--gold-hi: #f3d68a;
		--cream: #ddd3bb;
		--cream-2: #b9ad92;
		--brass: #c2a063;
		--brass-lo: #a8823c;
		--iron-hi: #211c17;
		--iron-lo: #14110e;
		--iron-deep: #0b0907;
		--tray-hi: #1c1814;
		--tray-lo: #100d0b;
		--ink: #241707;
		--btn-1: #f3d892;
		--btn-2: #d9ae58;
		--btn-3: #bd8d36;
		--btn-4: #cfa24c;
		--btn-lip: #8a6220;
		--btn-line: #4d340e;
		--btn-shine: #fff3cf;
		--shade-90: rgba(0, 0, 0, 0.9);
		--shade-45: rgba(0, 0, 0, 0.45);
		--shine-30: rgba(255, 236, 190, 0.3);
		--shine-45: rgba(236, 208, 146, 0.45);
		--display: 'Cinzel', 'Outfit Text', serif;
		--ui: 'Outfit Text', 'Outfit', system-ui, sans-serif;
		position: fixed;
		inset: 0;
		z-index: 80;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--ui);
		color: var(--cream);
		user-select: none;
		-webkit-user-select: none;
		transition: opacity 0.3s ease;
	}
	.resume.chosen {
		opacity: 0;
		pointer-events: none;
	}
	.dim {
		position: absolute;
		inset: 0;
		background: rgba(6, 4, 10, 0.62);
	}
	.kicker {
		font-weight: 700;
		font-size: calc(var(--k) * 11px);
		line-height: 1.3;
		letter-spacing: 0.22em;
		color: var(--brass);
	}
	.name {
		margin: 0;
		font: 700 calc(var(--k) * 25px) / 1.12 var(--display);
		letter-spacing: 0.03em;
		color: var(--gold);
		text-shadow:
			0 -1px 0 var(--shade-90),
			0 1px 0 var(--shine-30),
			0 3px 0 var(--shade-45);
	}
	.text {
		margin: 0;
		font-size: calc(var(--k) * 14px);
		line-height: 1.4;
		color: var(--cream);
		text-wrap: pretty;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.55);
	}
	.note {
		margin: 0;
		font-size: calc(var(--k) * 13px);
		color: var(--cream-2);
	}
	.keys {
		margin-top: auto;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: calc(var(--k) * 10px);
	}
	.btn {
		display: block;
		width: 100%;
		height: calc(var(--k) * 50px);
		min-height: 44px;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
		border-radius: 4px;
		outline: none;
	}
	.btn > .face {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		height: 100%;
		padding: 0 calc(var(--k) * 12px);
		border: 1px solid var(--btn-line);
		border-radius: 3px;
		color: var(--ink);
		font: 700 calc(var(--k) * 17px) / 1 var(--display);
		letter-spacing: 0.14em;
		text-shadow: 0 1px 0 var(--shine-45);
		white-space: nowrap;
		background: linear-gradient(180deg, var(--btn-1) 0%, var(--btn-2) 46%, var(--btn-3) 54%, var(--btn-4) 100%);
		box-shadow:
			inset 0 1px 0 var(--btn-shine),
			inset 0 -4px 0 var(--btn-lip),
			inset 0 0 0 2px var(--shine-30),
			0 4px 0 var(--shade-45);
	}
	/* SKIP TO RESULT: THE ARMOURY's switched-off key (iron with a brass rim, gold letters) */
	.btn.alt > .face {
		background: linear-gradient(180deg, var(--iron-hi), var(--iron-lo));
		color: var(--gold);
		text-shadow: 0 -1px 0 #000;
		border: 2px solid var(--brass-lo);
		box-shadow:
			inset 0 1px 0 var(--shine-30),
			0 4px 0 var(--shade-45);
	}
	/* the focused choice: a cream ring round the key (keyboard and pointer alike) */
	.btn:focus-visible > .face,
	.btn:focus > .face {
		box-shadow:
			inset 0 1px 0 var(--btn-shine),
			inset 0 -4px 0 var(--btn-lip),
			0 0 0 2px var(--iron-deep),
			0 0 0 4px var(--gold-hi);
	}
	.btn.alt:focus > .face {
		box-shadow:
			inset 0 1px 0 var(--shine-30),
			0 0 0 2px var(--iron-deep),
			0 0 0 4px var(--gold-hi);
	}
	.btn:disabled {
		cursor: default;
	}
	.btn:disabled > .face {
		opacity: 0.6;
	}
	.btn:active:not(:disabled) > .face {
		transform: translateY(1px);
	}
	/* the slab: the tray's own (sideways), 520 x 230 at --k 1 */
	.slab {
		position: relative;
		box-sizing: border-box;
		background: linear-gradient(180deg, var(--tray-hi), var(--tray-lo));
		border-top: 2px solid var(--brass-lo);
		border-bottom: 2px solid var(--brass-lo);
		box-shadow:
			inset 0 3px 0 var(--iron-deep),
			inset 0 4px 0 var(--shine-30),
			0 6px 0 rgba(0, 0, 0, 0.3);
	}
	.slab-in {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: calc(var(--k) * 6px);
		padding: calc(var(--k) * 16px) calc(var(--k) * 26px) calc(var(--k) * 18px);
	}
	.slab .kicker {
		font-size: calc(var(--k) * 11px);
	}
	.slab .name {
		font-size: calc(var(--k) * 26px);
	}
	.slab .text {
		font-size: calc(var(--k) * 14px);
		max-width: calc(var(--k) * 440px);
	}
	.slab .keys {
		margin-top: calc(var(--k) * 6px);
		flex-direction: row;
		gap: calc(var(--k) * 14px);
	}
	.slab .btn {
		flex: 1 1 0;
		height: calc(var(--k) * 46px);
		min-height: 32px;
	}
	.slab .btn > .face {
		font-size: calc(var(--k) * 16px);
	}
	/* upright phones: the keys stacked, full width, SKIP TO RESULT on top, a comfortable tap size */
	.slab.upright .keys {
		flex-direction: column;
		gap: 12px;
	}
	.slab.upright .btn {
		flex: none;
		height: 50px;
	}
	.slab.upright .text {
		max-width: none;
	}
	.keys.one .btn {
		flex: 0 1 auto;
		min-width: 60%;
		margin: 0 auto;
	}
</style>
