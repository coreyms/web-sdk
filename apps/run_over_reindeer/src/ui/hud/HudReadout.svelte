<script lang="ts" module>
	import { fitFont, UI_TEXT_FACE } from '../../game/textFit';
	// THE LAST-RESORT FIT. Every field is sized for the longest US amounts at one fixed type size (BALANCE $9,999,999.99,
	// WIN $1,250,000.00, the amount $1,000.00), so for them this always answers the nominal size. A longer string (another
	// currency, a trillion-coin GC balance) is shrunk to fit by the game's own helper (game/textFit.ts), never abbreviated.
	// Cached by the string's SHAPE (digits as 0, as the helper measures them), so a WIN count-up measures once per shape,
	// not per frame.
	const cache = new Map<string, number>();
	const fitted = (text: string, nominal: number, box: number, face: string = UI_TEXT_FACE) => {
		const key = `${face}|${nominal}|${box}|${text.replace(/\d/g, '0')}`;
		let v = cache.get(key);
		if (v === undefined) {
			v = fitFont({ text, nominal, box, weight: 900, face }) ?? nominal;
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
	import { scoreboardDev } from '../../game/scoreboard/scoreboard';
	import { odoDev, odoDigits, odoFace, odoPos, odoSeed, odoTransform, planOdometer, type OdoPlan } from './winOdometer';
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
		onclick?: (ev: MouseEvent) => void;
		disabled?: boolean;
		ariaLabel?: string;
		hud?: string;
		lit?: boolean;
		keep?: boolean;
		/** the room the fit leaves beside the number (mock px; the round 6 portrait boxes are sized to the number itself) */
		pad?: number;
		/** THE WIN ODOMETER (hud="win" only; controls.winOdoText): the total the readout rolls to and lands on with the Total
		 *  Win card's own count, null or absent: today's readout */
		odo?: string | null;
		/** THE SIGN BAR (ui/sign/, 2026-11-22; the glass dock passes none of these): the face the number is fitted in (the
		 *  dock's is the label face); a type size set by the caller, taking the fit's place (the amount, sized by the widest
		 *  amount rule); no sunburst behind WIN (the sign bar's Win box is its own glass) */
		face?: string;
		fontPx?: number;
		burstOff?: boolean;
		/** DIGITS IN CELLS (2026-11-22, the probe host's cards section: the sign bar's WIN changed width by 5 % between the
		 *  roll and the landing). The sign bar's face, Overpass, has no tabular figures (its 1 is 0.416 em, its 0 0.667), so
		 *  `font-variant-numeric: tabular-nums` does nothing there: the odometer's windows are a 0 wide and the landed digits
		 *  were their own widths. With this, every digit of the number stands in a cell one 0 wide (CSS 1ch: hud.css .tg), in
		 *  every state: the plain number and its 550 ms count, the odometer's zeros, its roll and its landing. The fit already
		 *  measures digits as zeros, so nothing is clipped. The dock's face has tabular figures and passes nothing. */
		tabular?: boolean;
	};
	const { label, value, pre = '', x, y, w, h, cls = '', nominal, onclick, disabled = false, ariaLabel, hud, lit = false, keep = false, pad = 12, odo = null, face, fontPx, burstOff = false, tabular = false }: Props = $props();
	const interactive = $derived(!!onclick && !disabled);
	const odoOn = $derived(hud === 'win' && !!odo);
	/** the text the readout is fitted to: the odometer's total while it plays (its zeros, its windows and its landing all
	 *  have the total's shape, so one fit and one width throughout) */
	const fitText = $derived(odoOn ? (odo as string) : value);
	const font = $derived(fontPx ?? fitted(fitText, nominal, w - pad, face));

	// ---- the WIN readout's sunburst (only hud="win"; the chromes' own classes say which screen and when a win shows) ----
	const burst = $derived(hud === 'win' && !burstOff);
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
	// (while the odometer plays, the odometer drives the count and the landing below; when the card leaves with WIN on the
	// same number it landed on, the landing is not played a second time)
	let odoAfter: string | null = null;
	$effect(() => {
		if (!burst) return;
		const on = winLit;
		const v = value;
		const odoing = odoOn;
		clear();
		const was = untrack(() => phase);
		if (!on) {
			if (was !== 'off') {
				phase = 'out';
				later = window.setTimeout(() => (phase = 'off'), 420);
			}
			return;
		}
		if (odoing) {
			odoAfter = v;
			if (was === 'off' || was === 'out') phase = 'cnt';
			return;
		}
		if (odoAfter !== null) {
			const same = v === odoAfter;
			odoAfter = null;
			if (same && (was === 'land' || was === 'hold')) return;
		}
		landByOdo = false;
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
		void odoOn;
		void odoMode;
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

	// ---- THE WIN ODOMETER (ui/hud/winOdometer.ts; Corey's pick from the mock bar_win_count_r1, its defaults) ----
	// While the Total Win card counts, each digit of WIN rolls in a window of its own (the tabular digit's width, its own
	// overflow clip, no mask) and the digits lock from the left, the last as the card's count ends; the separators and the
	// currency marker stand still. DRIVEN BY THE CARD'S OWN COUNT: every frame reads the scoreboard's Total Win show
	// (Scoreboard.totalCount: its clock, its count's start and end), never a timer of its own, so a slow frame, a turbo
	// rate or a press that lands the card (its countEnd moves to the press) lands the readout with it. At the count's end
	// (or the press) the windows go and the total is plain characters of the same widths, with the landing's pop on the
	// whole WIN cell (the mock's: 7.5 %, the upright readout from its left) and the sunburst's flare, once a show. Reduced
	// motion: no roll, the total's zeros until the count ends, then the total, no pop. One transform per digit a frame, no
	// text measured. The readout's name for assistive tech is the total itself throughout.
	const STRIP = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
	/** wait: the card is up, its count not read yet; roll; still: reduced motion; done: the total */
	let odoMode = $state<'wait' | 'roll' | 'still' | 'done'>('wait');
	/** the landing's pop on the WIN cell (odo-pop) and whether the sunburst's landing came from the odometer (the number's
	 *  own wb-land pop then stays off: one pop) */
	let odoPop = $state(false);
	let landByOdo = $state(false);
	const odoChars = $derived(odoOn ? [...(odo as string)].map((c) => ({ c, d: c >= '0' && c <= '9' })) : []);
	/** how long the card's count is looked for before the readout gives up and shows the total (the board starts the
	 *  show in the same broadcast that puts the card up, so this is a safety net only) */
	const ODO_FIND_MS = 1500;
	const ODO_POP_MS = 460;
	let odoRaf = 0;
	let odoPopTimer = 0;
	let odoHoldTimer = 0;
	$effect(() => {
		if (!odoOn) {
			untrack(() => {
				odoMode = 'wait';
				if (hud === 'win') odoDev.mode = 'off';
			});
			return;
		}
		const total = odo as string;
		untrack(() => runOdo(total));
		return () => {
			cancelAnimationFrame(odoRaf);
			odoRaf = 0;
		};
	});
	const runOdo = (total: string) => {
		cancelAnimationFrame(odoRaf);
		odoRaf = 0;
		const digits = odoDigits(total);
		const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
		const started = performance.now();
		let plan: OdoPlan | null = null;
		let planId = -1;
		let els: HTMLElement[] = [];
		let last: number[] = [];
		odoMode = 'wait';
		Object.assign(odoDev, { mode: 'wait', text: total, reduced, doneT: null, skipped: false, plan: null, showId: -1, t: 0, countEnd: 0 });
		const finish = (s: { id: number; t: number; skipped: boolean } | null, popOk: boolean) => {
			cancelAnimationFrame(odoRaf);
			odoRaf = 0;
			odoMode = 'done';
			odoDev.mode = 'done';
			odoDev.doneT = s ? s.t : null;
			odoDev.skipped = !!s?.skipped;
			if (s) odoDev.t = s.t;
			if (popOk && s && !reduced && odoDev.poppedId !== s.id) {
				odoDev.poppedId = s.id;
				odoDev.pops++;
				odoPop = false;
				clearTimeout(odoPopTimer);
				// (a frame apart, so a pop class still on from a landing just before restarts its animation)
				requestAnimationFrame(() => {
					odoPop = true;
					odoPopTimer = window.setTimeout(() => (odoPop = false), ODO_POP_MS + 40);
				});
				if (burst && winLit) {
					clear();
					landByOdo = true;
					phase = 'land';
					clearTimeout(odoHoldTimer);
					odoHoldTimer = window.setTimeout(() => {
						if (phase === 'land') phase = 'hold';
					}, 720);
				}
			} else if (burst && winLit && phase === 'cnt') phase = 'hold';
		};
		const step = () => {
			odoRaf = 0;
			const b = scoreboardDev.board?.totalCount() ?? null;
			const s = b && b.t < b.exitAt ? b : null;
			if (!s) {
				// no Total Win on the board (yet): the zeros for a moment, then the total (never stuck on the windows)
				if (plan || performance.now() - started > ODO_FIND_MS) return finish(null, false);
				odoRaf = requestAnimationFrame(step);
				return;
			}
			if (plan && s.id !== planId) return finish(null, false);
			if (s.t >= s.countEnd) return finish(s, !!plan);
			if (!plan) {
				// a count of no length shows the total at once (no roll, no pop)
				if (s.countEnd - s.countStart <= 0) return finish(s, false);
				plan = planOdometer(digits, s.countStart, s.countEnd, odoSeed(s.amount, digits.length));
				planId = s.id;
				odoDev.plans++;
				odoDev.plan = plan;
				odoDev.showId = s.id;
				odoMode = reduced ? 'still' : 'roll';
				odoDev.mode = odoMode;
				if (burst && winLit) {
					landByOdo = false;
					phase = 'cnt';
				}
			}
			odoDev.t = s.t;
			odoDev.countEnd = s.countEnd;
			if (!reduced) {
				// the windows' strips (in the readout once the roll is drawn: looked up again only while they are not)
				if (els.length !== plan.cols.length || !els[0]?.isConnected) {
					els = valEl ? [...valEl.querySelectorAll<HTMLElement>('.ods')] : [];
					last = [];
				}
				if (els.length === plan.cols.length)
					for (let i = 0; i < els.length; i++) {
						const f = odoFace(odoPos(plan, plan.cols[i], s.t));
						if (f !== last[i]) {
							els[i].style.transform = odoTransform(f);
							last[i] = f;
						}
					}
			}
			odoRaf = requestAnimationFrame(step);
		};
		step();
	};
	/** the readout's name while the odometer plays: the total, never the rolling digits */
	const odoAria = $derived(odoOn ? `${pre ? pre + ' ' : ''}${label} ${odo}` : undefined);
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
	class:wb-land={burst && phase === 'land' && !landByOdo}
	class:odo-pop={odoPop}
	class:slot-btn={interactive}
	class:hg={interactive}
	class:press={interactive}
	class:keep
	data-hud={hud}
	data-hud-lit={lit ? '' : undefined}
	disabled={!interactive}
	{onclick}
	aria-label={odoAria ?? ariaLabel}
	style:left="{x}px"
	style:top="{y}px"
	style:width="{w}px"
	style:height={h ? `${h}px` : undefined}
	style:--wb-pop={burst ? pop : undefined}
>
	<span class="lbw">{#if pre}<span class="pre">{pre}</span>{/if}<span class="label">{label}</span></span>
	<!-- (the odometer's markup is one line: a space between its boxes would widen the number) -->
	<span class="value" class:odo={odoOn} bind:this={valEl} style:font-size={font !== nominal || face ? `${font}px` : undefined} aria-hidden={odoOn ? 'true' : undefined} data-odo={odoOn ? odoMode : undefined}>{#if !odoOn}{#if tabular}{#each [...value] as c}{#if c >= '0' && c <= '9'}<span class="tg">{c}</span>{:else}{c}{/if}{/each}{:else}{value}{/if}{:else if odoMode === 'roll'}{#each odoChars as ch}{#if ch.d}<span class="od"><span class="odz">0</span><span class="ods">{#each STRIP as dd}<i>{dd}</i>{/each}</span></span>{:else}<span class="oc">{ch.c}</span>{/if}{/each}{:else}{#each odoChars as ch}<span class="oc" class:tg={tabular && ch.d}>{ch.d && odoMode !== 'done' ? '0' : ch.c}</span>{/each}{/if}</span>
</button>
