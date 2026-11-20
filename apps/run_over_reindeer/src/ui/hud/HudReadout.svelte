<script lang="ts" module>
	import { fitFont, UI_TEXT_FACE } from '../../game/textFit';
	// THE LAST-RESORT FIT. Every field is sized for the longest US amounts at one fixed type size (BALANCE $9,999,999.99,
	// WIN $1,250,000.00, the amount $1,000.00), so for them this always answers the nominal size. A longer string (another
	// currency, a trillion-coin GC balance) is shrunk to fit by the game's own helper (game/textFit.ts), never abbreviated.
	// Cached by the string's SHAPE (digits as 0, as the helper measures them), so a WIN count-up measures once per shape,
	// not per frame.
	const cache = new Map<string, number>();
	const fitted = (text: string, nominal: number, box: number) => {
		const key = `${nominal}|${box}|${text.replace(/\d/g, '0')}`;
		let v = cache.get(key);
		if (v === undefined) {
			v = fitFont({ text, nominal, box, weight: 900, face: UI_TEXT_FACE }) ?? nominal;
			if (cache.size > 400) cache.clear();
			cache.set(key, v);
		}
		return v;
	};

	// THE WIN'S SUNBURST (2026-11-20, Corey's pick "10 sunburst for both games" from the mock win_readout_r1, its default
	// strength, spread, pulse rate and color): soft rays turn behind the WIN amount, flattened to the bar, with a warm core;
	// they open out as the win lights, run brighter through the count, flare on the landing and pulse slowly in the hold,
	// and fade when the next spin clears WIN. It replaces the desktop pill (hud.css .stat.win.sb). Per screen, as the mock
	// draws it: the rays' reach is half the amount's width plus `add`, at least `min`, at most the cell (the desktop
	// dividers, the sideways capsule, 95 upright); `h` is the flattened height (the bar's own); `dy` lowers the center.
	const BURST = {
		desktop: { add: 60, min: 60, h: 60, dy: 0 },
		portrait: { add: 34, min: 40, h: 52, dy: 0 },
		landscape: { add: 14, min: 36, h: 30, dy: 1 },
	} as const;
	type BurstView = keyof typeof BURST;
	const r2 = (v: number) => Math.round(v * 100) / 100;
	/** 14 thin wedges round the center, radius R (each `half` radians either side of its angle) */
	const wedges = (R: number, half: number) => {
		let s = '';
		for (let i = 0; i < 14; i++) {
			const a = (i / 14) * 2 * Math.PI;
			s += `M0 0L${r2(R * Math.cos(a - half))} ${r2(R * Math.sin(a - half))}L${r2(R * Math.cos(a + half))} ${r2(R * Math.sin(a + half))}Z`;
		}
		return s;
	};
	let uid = 0;
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	// A READOUT (BALANCE, WIN, the amount per spin): a fixed box (contain: layout, so a changing number never reflows the
	// HUD), a small spaced word over a tabular number. The probes' contract is kept: a .stat (a button, disabled unless it
	// opens something) holding a .label whose text is the word and a .value.
	type Props = {
		label: string;
		value: string;
		/** words drawn before the label (FREE SPINS before WIN), outside .label */
		pre?: string;
		x: number;
		y: number;
		w: number;
		h?: number;
		cls?: string;
		/** the number's type size (mock px) and the room it has: the fit's inputs */
		nominal: number;
		onclick?: () => void;
		disabled?: boolean;
		ariaLabel?: string;
		hud?: string;
		lit?: boolean;
		keep?: boolean;
		/** the room the fit leaves beside the number (mock px; the round 6 portrait boxes are sized to the number itself) */
		pad?: number;
	};
	const { label, value, pre = '', x, y, w, h, cls = '', nominal, onclick, disabled = false, ariaLabel, hud, lit = false, keep = false, pad = 12 }: Props = $props();
	const interactive = $derived(!!onclick && !disabled);
	const font = $derived(fitted(value, nominal, w - pad));

	// ---- the WIN readout's sunburst (only hud="win"; the chromes' own classes say which screen and when a win shows) ----
	const burst = $derived(hud === 'win');
	const classes = $derived(cls.split(/\s+/));
	const view = $derived<BurstView>(classes.includes('pt') ? 'portrait' : classes.includes('lc') ? 'landscape' : 'desktop');
	const winLit = $derived(classes.includes('is-lit'));
	const id = `wb${++uid}`;
	let statEl: HTMLButtonElement | undefined = $state();
	let valEl: HTMLSpanElement | undefined = $state();
	/** the amount's own box inside the readout (mock px): its left, width and middle line */
	let vm = $state({ x: 0, w: 0, cy: 0 });
	let tablet = $state(false);
	/** off, cnt (the count runs), land (it landed: the flare and the pop), hold, out (the fade as WIN clears) */
	let phase = $state<'off' | 'cnt' | 'land' | 'hold' | 'out'>('off');
	let quiet = 0;
	let later = 0;
	const clear = () => {
		clearTimeout(quiet);
		clearTimeout(later);
	};
	// light up, count, land, hold, fade: from the readout's own lit class and its number (the count itself is the HUD's
	// 550 ms tween, untouched: the number standing still for 120 ms is the landing)
	$effect(() => {
		if (!burst) return;
		const on = winLit;
		void value;
		clear();
		const was = untrack(() => phase);
		if (!on) {
			if (was !== 'off') {
				phase = 'out';
				later = window.setTimeout(() => (phase = 'off'), 420);
			}
			return;
		}
		if (was !== 'cnt') phase = 'cnt';
		quiet = window.setTimeout(() => {
			phase = 'land';
			later = window.setTimeout(() => (phase = 'hold'), 720);
		}, 120);
		return clear;
	});
	// the amount's box, read when its text or size changes (a few times a count, not per frame)
	$effect(() => {
		if (!burst || !valEl || !statEl) return;
		void value;
		void font;
		tablet = !!statEl.closest('.v-tablet');
		const vx = valEl.offsetLeft;
		const vw = valEl.offsetWidth;
		const cy = valEl.offsetTop + font * 0.49;
		if (Math.abs(vx - vm.x) > 0.25 || Math.abs(vw - vm.w) > 0.25 || Math.abs(cy - vm.cy) > 0.25) vm = { x: vx, w: vw, cy };
	});
	const B = $derived(BURST[view]);
	/** the farthest the rays may reach: the dividers either side of the desktop WIN cell (38 mock px out on the desktop, 24
	 *  on the tablet, less their own width), the sideways capsule's inside, 95 upright */
	const R0 = $derived(view === 'desktop' ? w / 2 + (tablet ? 20.5 : 34.5) : view === 'landscape' ? (w + 2) / 2 : 95);
	const R = $derived(Math.max(B.min, Math.min(R0, vm.w / 2 + B.add)));
	/** the rays are drawn once at R0 and drawn in to R by scaleX (a transform, not a redraw) */
	const k = $derived(R / R0);
	const dx = $derived(vm.x + vm.w / 2 - w / 2);
	const flat = $derived(B.h / 2 / R0);
	const rays = $derived({ wide: wedges(R0, 0.13), thin: wedges(R0, 0.055) });
	/** the landing's pop: 7.5 % at most, never past the readout's box (it paints inside it) */
	const pop = $derived(vm.w > 0 ? Math.max(1, Math.min(1.075, (w - 1) / vm.w)) : 1);
</script>

{#if burst}
	<!-- the sunburst sits behind the readout, a layer of its own (the readout keeps its fixed box and its paint containment) -->
	<div class="wburst wb-{phase} wb-{view}" class:on={phase !== 'off' && phase !== 'out'} aria-hidden="true" style:left="{x + w / 2 - R0}px" style:top="{y + vm.cy + B.dy - B.h / 2}px" style:width="{R0 * 2}px" style:height="{B.h}px">
		<div class="wbi" style:transform="translateX({r2(dx)}px) scaleX({r2(k * 1000) / 1000})">
			<svg width={R0 * 2} height={B.h} viewBox="{-R0} {-B.h / 2} {R0 * 2} {B.h}">
				<defs>
					<radialGradient id="{id}r" gradientUnits="userSpaceOnUse" cx="0" cy="0" r={R0}>
						<stop offset="0" style="stop-color:rgb(var(--hud-burst-face-rgb));stop-opacity:.9" />
						<stop offset=".3" style="stop-color:rgb(var(--wb-hi));stop-opacity:.5" />
						<stop offset=".7" style="stop-color:rgb(var(--wb-c));stop-opacity:.14" />
						<stop offset="1" style="stop-color:rgb(var(--wb-c));stop-opacity:0" />
					</radialGradient>
					<radialGradient id="{id}k" cx=".5" cy=".5" r=".5">
						<stop offset="0" style="stop-color:rgb(var(--wb-hi));stop-opacity:.6" />
						<stop offset=".55" style="stop-color:rgb(var(--wb-c));stop-opacity:.22" />
						<stop offset="1" style="stop-color:rgb(var(--wb-c));stop-opacity:0" />
					</radialGradient>
				</defs>
				<g transform="scale(1 {r2(flat * 10000) / 10000})"><g class="pp"><g class="ry">
					<path d={rays.wide} fill="url(#{id}r)" opacity=".4" />
					<path d={rays.thin} fill="url(#{id}r)" opacity=".7" />
				</g></g></g>
				<ellipse class="pl" cx="0" cy="0" rx={r2((vm.w * 0.62 + 10) / k)} ry={Math.min(B.h / 2, 20)} fill="url(#{id}k)" />
				<ellipse class="fl" cx="0" cy="0" rx={r2(R0 * 0.8)} ry={r2(B.h / 2 * 0.8)} fill="url(#{id}k)" />
			</svg>
		</div>
	</div>
{/if}
<button
	bind:this={statEl}
	type="button"
	class="stat {cls}"
	class:sb={burst}
	class:wb-land={burst && phase === 'land'}
	class:slot-btn={interactive}
	class:hg={interactive}
	class:press={interactive}
	class:keep
	data-hud={hud}
	data-hud-lit={lit ? '' : undefined}
	disabled={!interactive}
	{onclick}
	aria-label={ariaLabel}
	style:left="{x}px"
	style:top="{y}px"
	style:width="{w}px"
	style:height={h ? `${h}px` : undefined}
	style:--wb-pop={burst ? pop : undefined}
>
	<span class="lbw">{#if pre}<span class="pre">{pre}</span>{/if}<span class="label">{label}</span></span>
	<span class="value" bind:this={valEl} style:font-size={font !== nominal ? `${font}px` : undefined}>{value}</span>
</button>
