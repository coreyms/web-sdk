<script lang="ts">
	// AUTO AND TURBO on the sign bar (the C road sign diamonds of auto_turbo_themes_r1, in his glass): one fixed diamond
	// each. Behaviour, sounds and disabled rules are ui/controls.svelte.ts's, unchanged (ui/hud/HudKey.svelte's).
	//   Auto   the circle arrow alone; green glass, red while a run is loaded on the Play or running (the arrow turns
	//          while it runs)
	//   Turbo  its bolt, its word and its level pips (bolt and pips only where the word would be under about 10 CSS px);
	//          green glass, the Q tile's yellow at Turbo, a hotter orange at Super Turbo (three pips, two under the
	//          operator's disabledSuperTurbo)
	// The press region is the drawn diamond (the button itself is that diamond: a square turned 45 degrees, its contents
	// turned back), and where that is under 44 CSS px a 44 px press pad on its center that lies under every other control
	// (ui/sign/SignHud.svelte: the dock's .hit::after rule, as an element of its own).
	import { stateBet } from 'state-shared';
	import type { Controls } from '../controls.svelte';
	import { SIGN } from '../hudTheme';
	import { AUTO_ARROW, BOLT, glassInk, keyFrame, keyIcon } from './signDraw';

	type Props = { kind: 'auto' | 'turbo'; controls: Controls; x: number; y: number; w: number; word?: boolean; press?: (ev: MouseEvent) => void };
	/** x, y, w: the key's box, bar px; word: Turbo shows its word; press: the bar's own press rule for a click this
	 *  key gets (ui/sign/SignHud.svelte barPress: whose press it is by where the pointer went down), else the key's own */
	const { kind, controls, x, y, w, word = true, press }: Props = $props();

	const level = $derived(controls.turboLevel());
	const bars = $derived(controls.jurisdiction().disabledSuperTurbo ? 2 : 3);
	const running = $derived(controls.autoRunning());
	const loaded = $derived(controls.autoLoadout() !== null);
	const t = $derived(kind === 'auto' ? (running || loaded ? 'on' : 'off') : level === 2 ? 'hot' : level === 1 ? 'on' : 'off');
	const tints: Record<string, string> = kind === 'auto' ? { off: SIGN.green, on: SIGN.red } : { off: SIGN.green, on: SIGN.yellow, hot: SIGN.hot };
	const frame = $derived(keyFrame(w, tints, kind === 'turbo' ? { on: [SIGN.key.glow, 0.55], hot: [SIGN.key.glowHot, 1] } : {}));
	const ink = $derived(glassInk(tints[t] ?? SIGN.green));
	const K = $derived(frame.K);
	const c = $derived(w / 2);
	/** the turned square's inset in the key's box */
	const off = $derived((w - frame.hit.side) / 2);
	const shadow = $derived(`0 0 ${K * 0.05}px ${ink.halo}, 0 0 ${K * 0.1}px ${ink.halo}`);
	/** the icon's place and size: Auto's arrow centered and larger; Turbo's bolt over its word, or over its pips alone */
	const icon = $derived(kind === 'auto' ? { y: c, z: K * 0.56 } : word ? { y: c - K * 0.215, z: K * 0.32 } : { y: c - K * 0.1, z: K * 0.42 });
</script>

<button
	type="button"
	class="slot-btn hg sgb sgk sgk-{kind}"
	class:is-on={kind === 'auto' && (running || loaded)}
	class:is-run={kind === 'auto' && running}
	data-t={t}
	data-l={kind === 'turbo' ? level : undefined}
	data-hud={kind}
	style:left="{x + off}px"
	style:top="{y + off}px"
	style:width="{frame.hit.side}px"
	style:height="{frame.hit.side}px"
	style:border-radius="{frame.hit.r}px"
	style:transform="rotate(45deg)"
	disabled={kind === 'auto' ? controls.autoDisabled() : stateBet.isSpaceHold}
	onclick={press ?? (kind === 'auto' ? controls.autoPress : controls.turboPress)}
	aria-label={kind === 'auto' ? 'Autoplay' : level === 2 ? 'Turbo: instant' : level === 1 ? 'Turbo: on' : 'Turbo'}
>
	<span class="s-up" data-hud="{kind}-box" style:left="{-off}px" style:top="{-off}px" style:width="{w}px" style:height="{w}px">
	<svg viewBox="0 0 {w} {w}" aria-hidden="true"><defs>{@html frame.defs}</defs>{@html frame.body}</svg>
	<span class="s-l s-in">
		<svg class="s-icon" viewBox="0 0 24 24" style:left="{c - icon.z / 2}px" style:top="{icon.y - icon.z / 2}px" style:width="{icon.z}px" style:height="{icon.z}px" aria-hidden="true">
			{#if kind === 'auto'}
				<!-- (the arrow's drawn box in its 24 unit view is centered at 11.9, 11.1: moved to sit on the middle) -->
				<g transform="translate(0.1 0.9)">{@html keyIcon(AUTO_ARROW, ink.ink, ink.halo)}</g>
			{:else}
				{@html keyIcon(`<path d="${BOLT}"/>`, ink.ink, ink.halo, level === 2)}
			{/if}
		</svg>
		{#if kind === 'turbo'}
			{#if word}<span class="kl" style:left="{c}px" style:top="{c + K * 0.075}px" style:font-size="{K * 0.18}px" style:color={ink.ink} style:text-shadow={shadow}>TURBO</span>{/if}
			<span class="s-lv" style:left="{c}px" style:top="{c + K * (word ? 0.262 : 0.2)}px" style:gap="{K * 0.042}px">
				{#each { length: bars } as _, i (i)}<i style:width="{K * 0.118}px" style:height="{K * 0.054}px" style:background={ink.ink} style:opacity={i < level + 1 ? 1 : 0.3} style:box-shadow="0 0 0 {K * 0.012}px {ink.halo}"></i>{/each}
			</span>
		{/if}
	</span>
	</span>
</button>
