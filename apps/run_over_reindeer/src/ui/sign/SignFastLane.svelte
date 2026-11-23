<script lang="ts">
	// THE FAST LANE KEY on the sign bar (desktop_hud_r8, with round 9's change): a hexagon road sign. Its press is
	// controls.bonusPress, unchanged (ui/hud/HudFeature.svelte's: it opens THE FAST LANE; with a mode on, on that mode).
	// Layers, bottom to top: his glass (green at rest, red with a mode on); the engraved PolyMath mark, the game's own
	// drawing at the game's own settings (ui/hud/engrave.ts, HUD_CONFIG.featureMark), etched at rest AND with a mode on
	// (round 9: no gold inlay), in steel while the key is disabled, cut to the hexagon; the words (FAST LANE at rest, the
	// mode's short name when on: 2X ANTE, BONUS, SUPER); and the Play's border: the frosted band over an LED strip, the
	// navy keyline outside it and the black line inside it drawn again over the light.
	// The lights (ui/sign/ledBand.ts): the Play's idle twinkle at rest; two opposite runners over a steady glow of every
	// LED for as long as a mode is on; dark while the key cannot be pressed. Nothing on the key scales or dips. Its press
	// region is its box (the hexagon and its four corner slivers; no other control stands in them).
	import { onDestroy, onMount, untrack } from 'svelte';
	import { stateBet } from 'state-shared';
	import type { Controls } from '../controls.svelte';
	import { soc } from '../../game/social';
	import { modeCost, modeShortLabel } from '../../game/betModeMeta';
	import { FEATURE_MENU_TEXT } from '../../game/featureMenuData';
	import { measureFitText } from '../../game/textFit';
	import { HUD_CONFIG, SIGN } from '../hudTheme';
	import { engraving } from '../hud/engrave';
	import { LedBand, type LightMode } from './ledBand';
	import { TEXT_MIN } from './signLayout';
	import { WORD_LS, bonusBand, bonusEtchClip, bonusFace, bonusGeo, bonusLights, bonusWordBox, fitWords, glassInk } from './signDraw';

	type Props = { controls: Controls; x: number; y: number; w: number; h: number; u: number; press?: (ev: MouseEvent) => void };
	/** x, y, w, h: the key's box, bar px; u: CSS px per bar px */
	const { controls, x, y, w, h, u, press }: Props = $props();

	// (the dock's own words: an Ante level says its level, the number the mode's own cost)
	const anteWord = (key: string) => `${modeCost(key)}X ${modeShortLabel(key)}`;
	const onLabel = $derived(controls.anteActive() ? anteWord(stateBet.activeBetModeKey) : controls.armedLabel());
	const on = $derived(onLabel !== null);
	const disabled = $derived(controls.bonusDisabled());
	const G = $derived(bonusGeo(w, h));
	const faceHtml = $derived(bonusFace(G));
	const bandHtml = $derived(bonusBand(G));
	const M = HUD_CONFIG.featureMark;
	const restMark = $derived(M ? engraving(w - 2, h - 2, M.rest) : '');
	const offMark = $derived(M?.off ? engraving(w - 2, h - 2, M.off) : '');
	const ink = $derived(glassInk(on ? SIGN.red : SIGN.green));
	const OVER = "'Overpass', sans-serif";
	const em = (t: string) => measureFitText(t, 100, 900, 0, OVER) / 100 + (t.length - 1) * WORD_LS;
	/** one line, or two where one would be under 10 CSS px (the sizes page's nudge) */
	const words = $derived.by(() => {
		const word = onLabel ?? HUD_CONFIG.featureName;
		const B = bonusWordBox(G);
		let ft = fitWords([word], B.poly, B.cx, B.cy, h * 0.3, em);
		if (word.includes(' ') && ft.fs * u < TEXT_MIN) ft = fitWords(word.split(' '), B.poly, B.cx, B.cy, h * 0.34, em);
		return { ...ft, cx: B.cx };
	});
	const lights = $derived<LightMode>(on ? 'run' : disabled ? 'off' : 'idle');

	let cv: HTMLCanvasElement | undefined = $state();
	let band: LedBand | null = null;
	const setLights = (m: LightMode) => band?.set(m, { lapMs: (SIGN.led.lapS * 1000) / SIGN.bonus.speed, floor: m === 'run' ? SIGN.bonus.base : SIGN.led.floor });
	onMount(() => {
		if (!cv) return;
		band = new LedBand(cv, bonusLights(G));
		band.resize(w * u, h * u);
		setLights(lights);
		if (import.meta.env.DEV) {
			const hook = ((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {});
			hook.signFastLane = () => ({ on, lights, word: onLabel ?? HUD_CONFIG.featureName, fs: words.fs * u, lines: words.rows.length, frames: band?.frames ?? 0 });
		}
	});
	$effect(() => {
		const g = G;
		const s = u;
		untrack(() => band?.resize(g.w * s, g.h * s, bonusLights(g)));
	});
	$effect(() => {
		const m = lights;
		untrack(() => setLights(m));
	});
	onDestroy(() => band?.destroy());
</script>

<button
	type="button"
	class="slot-btn hg sgb sgf fb"
	class:ante={on}
	data-l={lights}
	data-hud="fast-lane"
	style:left="{x}px"
	style:top="{y}px"
	style:width="{w}px"
	style:height="{h}px"
	{disabled}
	onclick={press ?? controls.bonusPress}
	aria-label={on ? `${FEATURE_MENU_TEXT.name}: ${onLabel ?? ''} is on` : soc('Buy bonus', 'Get bonus')}
>
	<svg viewBox="0 0 {w} {h}" aria-hidden="true">{@html faceHtml}</svg>
	{#if M}
		<span class="s-etch" style:clip-path="polygon({bonusEtchClip(G)})" style:opacity={SIGN.bonus.etch}>
			<span class="em em-rest">{@html restMark}</span>{#if offMark}<span class="em em-off">{@html offMark}</span>{/if}
		</span>
	{/if}
	<!-- the words: one .lb whose text is the word (two lines: "10X ANTE" still reads as one string), as the dock's key had it -->
	<span class="s-l s-ink">
		<span class="lb" class:two={words.rows.length > 1} style:left="{words.cx}px" style:top="{h / 2}px" style:font-size="{words.fs}px" style:color={ink.ink} style:--ol="{Math.max(0.6, words.fs * 0.07)}px" style:--oc={ink.halo === '#ffffff' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(5, 8, 13, 0.8)'}
			>{#each words.rows as r, i (i)}{#if i}{' '}{/if}<b>{r.t}</b>{/each}</span
		>
	</span>
	<svg viewBox="0 0 {w} {h}" aria-hidden="true">{@html bandHtml.under}</svg>
	<canvas bind:this={cv} aria-hidden="true"></canvas>
	<svg viewBox="0 0 {w} {h}" aria-hidden="true">{@html bandHtml.over}</svg>
</button>
