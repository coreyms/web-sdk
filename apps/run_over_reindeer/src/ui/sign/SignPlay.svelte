<script lang="ts">
	// THE PLAY (the sign bar; Corey's approved mocks play_button_r6 and desktop_hud_r10): a road sign diamond, one size
	// in every state, every count inside it. What it does is ui/controls.svelte.ts's, unchanged (spin, stop, slam stop,
	// stop a run, the balance notice); this is only its face, in place of ui/hud/HudSpin.svelte.
	//   ready          green glass, SPIN, the LED border's soft twinkle
	//   a round        red glass, STOP while the stop is available (dimmed once it is pressed), two lights chasing round
	//                  the border, faster at Turbo and Super Turbo
	//   autoplay run   red all through the run, AUTO over the spins left; the lights chase in each round
	//   free spins     red, SPIN n OF total inside a ring of LEDs, one per free spin, lit as played (a retrigger adds 3;
	//                  the ring is laid out again only then, and a spin changes only its own LED)
	// The faces the mock did not draw keep the same grammar (green = a press starts something):
	//   armed buy        green, the mode's name over its price    replay      green, REPLAY
	//   busy             (no slam stop allowed) red, no word
	//   the Super Wheel waiting for the key: green, SPIN, every LED breathing together
	// Its press region is the drawn diamond, not its square box: the button itself is that diamond (a square turned 45
	// degrees with the diamond's rounded corners, its contents turned back), 0.669 of the box across its faces.
	import { onDestroy, onMount, untrack } from 'svelte';
	import type { Controls } from '../controls.svelte';
	import { replayState } from '../replayState.svelte';
	import { SIGN } from '../hudTheme';
	import { LedBand, type LightMode } from './ledBand';
	import { LIGHTS, PLAY_HIT, PLAY_TEXT_DARK, PLAY_TEXT_LIMIT, playBand, playBody, playKeylines, ringLed, ringPlan, ringPoints } from './signDraw';

	type Props = { controls: Controls; x: number; y: number; d: number; css: number; press?: (ev: MouseEvent, own: () => void) => void };
	/** x, y, d: the key's box in bar px; css: its side on screen in CSS px (the light canvas's size) */
	const { controls, x, y, d, css, press }: Props = $props();
	// THE PRESS (2026-11-23): a round starts only from a press that went down inside this diamond. A browser hands a
	// touch on a neighbour's edge to this button (its upright box covers their ground and it is drawn after them), so
	// the bar's own rule judges the click by where the pointer went down (ui/sign/SignHud.svelte barPress).
	const act = () => (replay ? replayState.start?.() : controls.spin());

	// ---- the state: ui/hud/HudSpin.svelte's own reading of the controls, unchanged ----
	const replay = $derived(controls.isReplay());
	const replayAgain = $derived(replay && replayState.phase === 'done');
	const autoActive = $derived(controls.autoRunning());
	const showStop = $derived(controls.showStop());
	const fs = $derived(controls.freeSpin());
	const showFreeSpins = $derived(!replay || replayState.phase === 'playing');
	const armed = $derived(controls.armedBuy() !== null);
	const idle = $derived(controls.keyIdle());
	const disabled = $derived(replay ? !replayAgain : controls.spinDisabled());
	const wheelWait = $derived(controls.wheelWaits() && !replay);
	const mode = $derived(
		wheelWait ? 'idle' : fs && showFreeSpins ? 'feature' : replay ? 'replay' : showStop ? 'spinning' : autoActive ? 'auto' : !idle ? 'busy' : armed ? 'armed' : 'idle',
	);
	const flip = $derived(mode === 'idle' || mode === 'spinning' || mode === 'busy');
	const st = $derived(mode === 'spinning' ? (disabled ? 'halt' : 'run') : 'idle');
	const count = $derived(mode === 'auto' ? controls.autoCount() : 0);
	const action = $derived(replay ? 'Replay' : wheelWait ? 'Spin' : showStop ? 'Stop' : autoActive ? 'Stop autoplay' : 'Spin');
	const label = $derived(
		mode === 'feature' && fs ? `${action}. Free spins: ${fs.current} of ${fs.total}` : mode === 'auto' && count !== Infinity && count > 0 ? `${action}: ${count} left` : action,
	);
	const turbo = $derived(controls.turboLevel() as 0 | 1 | 2);

	// ---- the face ----
	const red = $derived(mode === 'spinning' || mode === 'busy' || mode === 'auto' || mode === 'feature');
	/** dimmed: a resting face that cannot be pressed (a held round, nothing to play) */
	const dim = $derived(disabled && (mode === 'idle' || mode === 'armed' || mode === 'replay') && !wheelWait);
	/** a round is playing on the board (the chase runs): a spin, and each round of a run or of the free spins */
	const live = $derived(mode === 'spinning' || mode === 'busy' || ((mode === 'auto' || mode === 'feature') && !idle));
	const lights = $derived<LightMode>(wheelWait ? 'wait' : live ? 'chase' : red || dim ? 'off' : 'idle');
	const T = SIGN.text;
	type Line = { t: string; size: number; font: string; ls: number; ol: number; inf?: boolean };
	const OVER = "'Overpass', sans-serif";
	const OUTFIT = "'Outfit', sans-serif";
	/** an open run's count: the infinity drawn as a path in a 34 x 16 view (the glass dock's own drawing), never a character */
	const INF_D = 'M17 8C14.2 4.4 11.9 2.6 9 2.6a5.4 5.4 0 0 0 0 10.8c2.9 0 5.2-1.8 8-5.4s5.1-5.4 8-5.4a5.4 5.4 0 0 1 0 10.8c-2.9 0-5.2-1.8-8-5.4z';
	const lines = $derived.by((): { rows: Line[]; x: number; oc: string; faint: boolean } => {
		const dark = PLAY_TEXT_DARK;
		if (mode === 'feature' && fs)
			return { rows: [{ t: 'SPIN', size: T.fs.label, font: OVER, ls: T.fs.ls, ol: T.fs.ol }, { t: String(fs.current), size: T.fs.num, font: OUTFIT, ls: T.fs.ls, ol: T.fs.ol }, { t: `OF ${fs.total}`, size: T.fs.sub, font: OVER, ls: T.fs.ls, ol: T.fs.ol }], x: 0, oc: '#0b0f15', faint: false };
		if (mode === 'auto')
			return { rows: [{ t: 'AUTO', size: T.auto.label, font: OVER, ls: T.auto.ls, ol: T.auto.ol }, { t: count === Infinity ? '' : String(count), size: T.auto.num, font: OUTFIT, ls: T.auto.ls, ol: T.auto.ol, inf: count === Infinity }], x: 0, oc: dark, faint: false };
		if (mode === 'armed') return { rows: [{ t: controls.armedLabel() ?? '', size: 24, font: OVER, ls: T.spin.ls, ol: 2 }, { t: controls.playCostText() ?? '', size: 30, font: OVER, ls: 0, ol: 2.2 }], x: 0, oc: dark, faint: false };
		if (mode === 'replay') return { rows: [{ t: 'REPLAY', size: 32, font: OVER, ls: T.spin.ls, ol: 2.2 }], x: 0, oc: dark, faint: false };
		if (mode === 'spinning') return { rows: [{ t: 'STOP', size: T.stop.size, font: OVER, ls: T.stop.ls, ol: T.stop.ol }], x: T.stop.x, oc: dark, faint: st === 'halt' };
		if (mode === 'busy') return { rows: [], x: 0, oc: dark, faint: false };
		return { rows: [{ t: 'SPIN', size: T.spin.size, font: OVER, ls: T.spin.ls, ol: T.spin.ol }], x: T.spin.x, oc: dark, faint: false };
	});
	/** the mock's stack: lines centered on 0, their centers apart by the mean of their sizes x 0.92; the outline scaled
	 *  with each line's size */
	const stacked = $derived.by(() => {
		const rows = lines.rows;
		if (!rows.length) return [];
		const big = Math.max(...rows.map((r) => r.size));
		const ys = [0];
		for (let i = 1; i < rows.length; i++) ys.push(ys[i - 1] + ((rows[i - 1].size + rows[i].size) / 2) * 0.92);
		const mid = (ys[0] - rows[0].size / 2 + ys[ys.length - 1] + rows[rows.length - 1].size / 2) / 2;
		return rows.map((r, i) => ({ ...r, y: ys[i] - mid, olw: (r.ol * r.size) / big }));
	});
	/** the text's key: a change of words (not of state alone) fits the group again */
	const wordsKey = $derived(stacked.map((r) => `${r.t}|${r.size}|${r.inf ? 1 : 0}`).join('/'));

	// ---- the free spins ring ----
	const ringTotal = $derived(mode === 'feature' && fs ? fs.total : 0);
	const ring = $derived(ringTotal ? ringPlan(ringTotal) : null);
	const ringPts = $derived(ring ? ringPoints(ring) : []);
	const ringLit = $derived(mode === 'feature' && fs ? Math.min(fs.current, fs.total) : 0);

	// ---- the static drawings (built once) ----
	const BAND = playBand();
	const bodyHtml = playBody();
	const lineHtml = playKeylines();
	/** the turned square the button is: its side, its corner radius and its inset in the key's box, bar px */
	const side = $derived(PLAY_HIT.side * d);
	const off = $derived((d - side) / 2);

	// ---- the lights (one canvas, ui/sign/ledBand.ts) ----
	let cv: HTMLCanvasElement | undefined = $state();
	let band: LedBand | null = null;
	onMount(() => {
		if (!cv) return;
		band = new LedBand(cv, BAND);
		band.resize(css, css);
		band.set(lights, { lapMs: (SIGN.led.lapS * 1000) / SIGN.led.rate[turbo] });
		if (import.meta.env.DEV) {
			const hook = ((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {});
			hook.signPlay = () => ({ mode, st, lights, red, ringTotal, ringLit, frames: band?.frames ?? 0, leds: BAND.leds.length });
		}
	});
	$effect(() => {
		const s = css;
		untrack(() => band?.resize(s, s));
	});
	$effect(() => {
		const m = lights;
		const tb = turbo;
		untrack(() => band?.set(m, { lapMs: (SIGN.led.lapS * 1000) / SIGN.led.rate[tb] }));
	});
	onDestroy(() => band?.destroy());

	// ---- the words stay inside the diamond (the mock's placeText): measured when the words change, never per frame ----
	let wordsEl: SVGGElement | undefined = $state();
	let fit = $state(1);
	$effect(() => {
		void wordsKey;
		const g = wordsEl;
		if (!g) return;
		untrack(() => {
			let b: DOMRect;
			try {
				b = g.getBBox();
			} catch {
				return;
			}
			if (!b.width) {
				fit = 1;
				return;
			}
			const ox = lines.x;
			const reach = Math.max(...[[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([px, py]) => Math.abs(px + ox) + Math.abs(py)));
			fit = reach > PLAY_TEXT_LIMIT ? Math.max(0.3, Math.floor((PLAY_TEXT_LIMIT / reach) * 100) / 100) : 1;
		});
	});
</script>

<button
	type="button"
	class="slot-btn spin hg sgb sgp m-{mode}"
	class:is-red={red}
	class:is-dim={dim}
	class:wheel-wait={wheelWait}
	data-wheel-wait={wheelWait ? '1' : undefined}
	data-st={flip ? st : mode}
	data-face="sign"
	data-run={live ? '1' : '0'}
	data-lights={lights}
	data-tb={turbo}
	data-hud="play"
	style:left="{x + off}px"
	style:top="{y + off}px"
	style:width="{side}px"
	style:height="{side}px"
	style:border-radius="{PLAY_HIT.r * d}px"
	style:transform="rotate(45deg)"
	{disabled}
	onclick={(ev) => (press ? press(ev, act) : act())}
	aria-label={label}
>
	<span class="s-up" data-hud="play-box" style:left="{-off}px" style:top="{-off}px" style:width="{d}px" style:height="{d}px">
	<svg viewBox="-120 -120 240 240" aria-hidden="true">{@html bodyHtml}</svg>
	<canvas bind:this={cv} aria-hidden="true"></canvas>
	<svg viewBox="-120 -120 240 240" aria-hidden="true">
		{@html lineHtml}
		{#if ring}
			<g class="s-ring" data-total={ringTotal}>
				{#each ringPts as p, j (j)}
					<g class="ib" class:lit={j < ringLit} style:transform="translate({p[0]}px, {p[1]}px)">{@html ringLed(ring.r, LIGHTS[j % LIGHTS.length])}</g>
				{/each}
			</g>
		{/if}
		<g class="s-words" class:s-faint={lines.faint}>
			<g transform="translate({lines.x} 0) scale({fit})">
				<g bind:this={wordsEl}>
					{#each stacked as r, i (i)}
						{#if r.inf}
							<g transform="translate(0 {r.y}) scale({(r.size * 0.62) / 16}) translate(-17 -8)" fill="none" stroke-linejoin="round" data-word={i}>
								<path d={INF_D} stroke={lines.oc} stroke-width={2.3 + (r.olw * 2 * 16) / (r.size * 0.62)} />
								<path d={INF_D} stroke="#ffffff" stroke-width="2.3" />
							</g>
						{:else}
						<text
							x={(r.size * r.ls) / 2}
							y={r.y}
							font-family={r.font}
							font-size={r.size}
							letter-spacing={r.size * r.ls}
							fill="#ffffff"
							stroke={lines.oc}
							stroke-width={r.olw * 2}
							text-anchor="middle"
							dominant-baseline="central"
							data-word={i}>{r.t}</text
						>
						{/if}
					{/each}
				</g>
			</g>
		</g>
	</svg>
	</span>
</button>
