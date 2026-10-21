<script lang="ts">
	// THE RECAP BOX (1.0.04; images/plaque_r6_storyboard STORYBOARD.md section 6; Corey 2026-10-20: the recap is in 1.0.04;
	// constants PLAQUE_RECAP, game/recap.svelte.ts). HTML, in its own fixed layer over the canvas (mounted beside the symbol
	// pay popup in components/Game.svelte), in the pay popup's bronze plate style, just above the plaque.
	//
	// WHEN: a tap or click on the plaque's dark field (game/plaqueTap.ts, through the plaque's one perspective) on an idle
	// board (game/recap.svelte.ts recapIdle: the pay popup's rule, a finished replay round included) opens:
	//   - the FEATURE recap while the plaque offers it (after a feature's wrap-up, until the next spin): one row per free
	//     spin with its total; a tapped row opens to its clears; it scrolls;
	//   - else the LAST SPIN, if it cleared anything (a spin with no clears opens nothing: Corey): its clears per cascade.
	// It never opens during a spin, during autoplay or while a press gate is up; a tap on the plaque during a spin keeps
	// its meaning (nothing: the plaque is outside the board's tap area). It closes on a press outside the box, any key
	// (Escape included), a resize or rotation, the page going hidden, and the board stopping being idle.
	//
	// Every figure is the book's as received (game/recap.svelte.ts), only formatted: a row's amount as the plaque prints it
	// (the currency mark off), the totals with it. The book carries no wild count (a cluster's size includes its wilds),
	// so none is shown. House rules: no backdrop-filter, no filter, no mask; the pop is opacity and a small scale; DEV hooks
	// only on window.__manticore; fonts the chrome already loads (Cinzel, Sora, Outfit Text).
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { stamp } from '../game/assets';
	import { BONUS_MODE_LABEL, PLAQUE_RECAP as R } from '../game/constants';
	import { recap, recapIdle, recapTarget, type RecapClear } from '../game/recap.svelte';
	import { onPlaque, plaqueBox } from '../game/plaqueTap';

	const context = getContext();

	/** the box's place: centred on the plaque, its bottom gapPx above it; k by the plaque's width on screen */
	let place = $state<{ cx: number; bottom: number; maxH: number; k: number } | null>(null);
	/** the feature recap's open row (one at a time), -1 none */
	let openRow = $state(-1);
	let box = $state<HTMLDivElement | null>(null);
	const tileSrc = (code: string) => stamp(`/assets/tiles/${code.toLowerCase()}.webp`);
	/** a row's amount: the plaque's formatting with the currency mark off (Corey's "8 x [icon] 2.40") */
	const digits = (amount: number) => {
		const t = bookEventAmountToCurrencyString(Math.round(amount));
		const a = t.search(/[0-9]/);
		let b = -1;
		for (let i = t.length - 1; i >= 0; i -= 1)
			if (t[i] >= '0' && t[i] <= '9') {
				b = i;
				break;
			}
		return a >= 0 && b >= a ? t.slice(a, b + 1) : t;
	};
	const money = (amount: number) => bookEventAmountToCurrencyString(Math.round(amount));
	const sz = (font: number, floor: number, k: number) => Math.max(floor, font * k);
	const modeTitle = (mode: string) => (BONUS_MODE_LABEL as Record<string, string>)[mode] ?? BONUS_MODE_LABEL.bonus;

	/** DEV: every open and close (bounded) */
	const log: { what: 'open' | 'close'; why: string; kind?: string; at: number }[] = [];
	const note = (what: 'open' | 'close', why: string, kind?: string) => {
		if (!import.meta.env.DEV) return;
		log.push({ what, why, kind, at: performance.now() });
		if (log.length > 60) log.splice(0, 30);
	};
	const openBox = (kind: 'last' | 'feature', why: string) => {
		const b = plaqueBox();
		if (!b) return false;
		const k = Math.min(R.maxK, Math.max(R.minK, (b.right - b.left) / R.refPlaqueCss));
		place = { cx: (b.left + b.right) / 2, bottom: window.innerHeight - b.top + R.gapPx, maxH: Math.max(120, b.top - R.gapPx - 12), k };
		openRow = -1;
		recap.open = kind;
		note('open', why, kind);
		return true;
	};
	const close = (why: string) => {
		if (recap.open === null) return;
		recap.open = null;
		note('close', why);
	};

	// the board stopping being idle closes it (a spin starting, a modal opening, autoplay)
	$effect(() => {
		if (recap.open !== null && !recapIdle()) close('not idle');
	});

	onMount(() => {
		let down: { x: number; y: number; t: number; inBox: boolean } | null = null;
		const canvasOf = () => context.stateApp.pixiApplication?.canvas as HTMLCanvasElement | undefined;
		const onDown = (e: PointerEvent) => {
			const inBox = !!box && box.contains(e.target as Node);
			down = { x: e.clientX, y: e.clientY, t: performance.now(), inBox };
			if (recap.open !== null && !inBox) close('outside');
		};
		const onUp = (e: PointerEvent) => {
			const d = down;
			down = null;
			if (!d || recap.open !== null || d.inBox) return;
			if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > R.tapSlopPx || performance.now() - d.t > R.tapMs) return;
			// a tap on the canvas (no HTML control took it), on the plaque's dark field
			if (e.target !== canvasOf() || !onPlaque(e.clientX, e.clientY)) return;
			if (!recapIdle()) return;
			const kind = recapTarget();
			if (kind) openBox(kind, 'tap');
		};
		const onKey = () => close('key');
		const onResize = () => close('resize');
		const onHidden = () => {
			if (document.hidden) close('hidden');
		};
		window.addEventListener('pointerdown', onDown, true);
		window.addEventListener('pointerup', onUp, true);
		window.addEventListener('keydown', onKey, true);
		window.addEventListener('resize', onResize);
		window.addEventListener('orientationchange', onResize);
		document.addEventListener('visibilitychange', onHidden);
		if (import.meta.env.DEV) {
			((window as any).__manticore ??= {}).recap = {
				state: () => JSON.parse(JSON.stringify({ last: recap.last, feature: recap.feature, offer: recap.offer, open: recap.open, openRow, place })),
				idle: () => recapIdle(),
				target: () => recapTarget(),
				/** the page point (CSS px) at the plaque's centre, for a real click or tap */
				tapPoint: () => {
					const b = plaqueBox();
					return b ? { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 } : null;
				},
				/** the box on the page (CSS px), its rows as text */
				box: () => {
					if (!box) return null;
					const r = box.getBoundingClientRect();
					return { x: r.left, y: r.top, w: r.width, h: r.height, rows: [...box.querySelectorAll('[data-recap-row]')].map((el) => (el as HTMLElement).dataset.recapRow), title: box.querySelector('.rc-title')?.textContent ?? null, total: box.querySelector('.rc-total-v')?.textContent ?? null };
				},
				openRow: (i: number) => (openRow = i),
				/** an autoplay count loaded on the Spin button (the controls' own loadAutoplay shape), or null: the "tap the
				 *  plaque" line's skip rule is checked with it */
				loadAuto: (count: number | null) => {
					context.stateGame.autoLoadout = count === null ? null : { count, lossMult: null, winMult: null, stopFree: false, autoBonuses: false };
				},
				log: () => log.map((e) => ({ ...e })),
			};
		}
		return () => {
			window.removeEventListener('pointerdown', onDown, true);
			window.removeEventListener('pointerup', onUp, true);
			window.removeEventListener('keydown', onKey, true);
			window.removeEventListener('resize', onResize);
			window.removeEventListener('orientationchange', onResize);
			document.removeEventListener('visibilitychange', onHidden);
			recap.open = null;
			if (import.meta.env.DEV) delete (window as any).__manticore?.recap;
		};
	});

	const pop = (_node: Element) => ({ duration: R.inMs, easing: cubicOut, css: (t: number) => `opacity: ${t}; transform: scale(${0.94 + 0.06 * t})` });
	const rowText = (c: RecapClear) => `${c.n} x ${c.s} ${c.m ? `${digits(c.p)} x ${c.m} = ` : ''}${digits(c.w)}`;
</script>

<div class="am-ui rc-layer">
	{#if recap.open !== null && place}
		{@const k = place.k}
		<div
			class="rc-pos"
			out:fade={{ duration: R.outMs }}
			style:left="{place.cx}px"
			style:bottom="{place.bottom}px"
			style:width="{R.width * k}px"
		>
			<div
				class="rc-box"
				bind:this={box}
				role="dialog"
				aria-label={recap.open === 'feature' && recap.feature ? modeTitle(recap.feature.mode) : R.titleLast}
				in:pop
				style:padding="{R.pad * k}px"
				style:border-radius="{R.radius * k}px"
				style:--bz="{R.bezel}px"
				style:max-height="{place.maxH}px"
			>
				{#if recap.open === 'last' && recap.last}
					<div class="rc-title" style:font-size="{sz(R.titleFont, R.titleFloor, k)}px">{R.titleLast}</div>
					<div class="rc-scroll">
						{#each recap.last.cascades as cascade, ci (ci)}
							{#if cascade.length}
								<div class="rc-head" style:font-size="{sz(R.headFont, R.headFloor, k)}px">{R.cascade} {ci + 1}</div>
								{#each cascade as c, i (i)}
									<div class="rc-row" data-recap-row={rowText(c)} style:height="{R.rowH * k}px" style:font-size="{sz(R.rowFont, R.rowFloor, k)}px">
										<span class="rc-n slot-num">{c.n} ×</span>
										<img class="rc-tile" src={tileSrc(c.s)} alt={c.s} style:width="{R.rowH * k * 0.92}px" style:height="{R.rowH * k * 0.92}px" />
										<span class="rc-v slot-num">
											{#if c.m}<span class="rc-p">{digits(c.p)}</span> <span class="rc-m">× {c.m}</span> <span class="rc-eq">=</span> {/if}{digits(c.w)}
										</span>
									</div>
								{/each}
							{/if}
						{/each}
					</div>
					<div class="rc-total">
						<span class="rc-total-k" style:font-size="{sz(13, 11, k)}px">{R.spinTotal}</span>
						<span class="rc-total-v slot-num" style:font-size="{sz(R.totalFont, R.totalFloor, k)}px">{money(recap.last.total)}</span>
					</div>
				{:else if recap.open === 'feature' && recap.feature}
					<div class="rc-title" style:font-size="{sz(R.titleFont, R.titleFloor, k)}px">{modeTitle(recap.feature.mode)}</div>
					<div class="rc-scroll">
						{#each recap.feature.spins as spin, si (si)}
							<!-- a spin with no clusters has nothing to open: no arrow, not a button one can press (harsh review
							     2026-10-20 gameplay 9, "an expand arrow on spins that paid 0.00") -->
							{@const clears = spin.cascades.flat().length > 0}
							<button
								type="button"
								class="rc-spin"
								class:open={openRow === si}
								class:zero={spin.total <= 0}
								class:none={!clears}
								disabled={!clears}
								data-recap-row="{R.spin} {si + 1} {digits(spin.total)}"
								style:height="{R.rowH * k}px"
								style:font-size="{sz(R.rowFont, R.rowFloor, k)}px"
								onclick={() => clears && (openRow = openRow === si ? -1 : si)}
							>
								<span class="rc-caret" aria-hidden="true">{clears ? (openRow === si ? '▾' : '▸') : ''}</span>
								<span class="rc-spin-k">{R.spin} {si + 1}</span>
								<span class="rc-v slot-num">{digits(spin.total)}</span>
							</button>
							{#if openRow === si}
								{#each spin.cascades.flat() as c, i (i)}
									<div class="rc-row rc-sub" data-recap-row={rowText(c)} style:height="{R.rowH * k * 0.85}px" style:font-size="{sz(R.headFont, R.headFloor, k)}px">
										<span class="rc-n slot-num">{c.n} ×</span>
										<img class="rc-tile" src={tileSrc(c.s)} alt={c.s} style:width="{R.rowH * k * 0.75}px" style:height="{R.rowH * k * 0.75}px" />
										<span class="rc-v slot-num">{c.m ? `${digits(c.p)} × ${c.m} = ${digits(c.w)}` : digits(c.w)}</span>
									</div>
								{/each}
							{/if}
						{/each}
					</div>
					<div class="rc-total">
						<span class="rc-total-k" style:font-size="{sz(13, 11, k)}px">{R.featureTotal}</span>
						<span class="rc-total-v slot-num" style:font-size="{sz(R.totalFont, R.totalFloor, k)}px">{money(recap.feature.total ?? 0)}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* over the canvas and the HUD (Chrome 20, SKIP 21), under the modals (60). The layer takes no press; the box does */
	.rc-layer {
		position: fixed;
		inset: 0;
		z-index: 21;
		pointer-events: none;
		overflow: hidden;
	}
	.rc-pos {
		position: absolute;
		transform: translateX(-50%);
	}
	/* THE BRONZE PLATE'S GLASS AND BEZEL, as the symbol pay popup draws it (components/SymbolPopup.svelte .sp-pop) */
	.rc-box {
		pointer-events: auto;
		box-sizing: border-box;
		width: 100%;
		display: flex;
		flex-direction: column;
		color: var(--plate-ink, #f7eedc);
		background: linear-gradient(180deg, rgba(40, 28, 17, 0.94), rgba(12, 9, 6, 0.96));
		box-shadow:
			0 10px 24px rgba(0, 0, 0, 0.55),
			inset 0 var(--bz) 0 var(--plate-bronze-1, #e6c993),
			inset calc(-1 * var(--bz)) 0 0 var(--plate-bronze-2, #8f6636),
			inset 0 calc(-1 * var(--bz)) 0 var(--plate-bronze-3, #5a3e1f),
			inset var(--bz) 0 0 var(--plate-bronze-4, #bd8f52),
			inset 0 0 0 calc(var(--bz) + 1px) rgba(0, 0, 0, 0.6);
		transform-origin: center bottom;
	}
	.rc-title {
		font-family: 'Cinzel', var(--ui-font);
		font-weight: 700;
		letter-spacing: 0.04em;
		text-align: center;
		margin-bottom: 0.35em;
	}
	.rc-scroll {
		overflow-y: auto;
		min-height: 0;
		flex: 1 1 auto;
		scrollbar-width: thin;
		scrollbar-color: #bd8f52 rgba(90, 62, 31, 0.6);
	}
	.rc-head {
		font-family: 'Outfit Text', var(--ui-font);
		font-weight: 600;
		letter-spacing: 0.08em;
		color: #c9b28a;
		margin-top: 0.4em;
		border-top: 1px solid rgba(189, 143, 82, 0.35);
		padding-top: 0.35em;
	}
	.rc-head:first-child {
		border-top: none;
		margin-top: 0;
		padding-top: 0;
	}
	.rc-row,
	.rc-spin {
		display: flex;
		align-items: center;
		gap: 0.45em;
		font-family: 'Sora', var(--ui-font);
		font-weight: 600;
	}
	.rc-sub {
		padding-left: 1.6em;
		font-weight: 500;
	}
	.rc-tile {
		object-fit: contain;
		flex: none;
	}
	.rc-v {
		margin-left: auto;
		white-space: nowrap;
	}
	.rc-p,
	.rc-eq {
		color: #c9b28a;
	}
	.rc-m {
		color: #2eb0a8;
	}
	.rc-spin {
		width: 100%;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0 0.3em;
		border-radius: 4px;
	}
	.rc-spin.open {
		background: rgba(189, 143, 82, 0.2);
	}
	.rc-spin.zero {
		color: #c9b28a;
	}
	.rc-spin.none {
		cursor: default;
	}
	.rc-spin:not(.zero) .rc-v {
		color: #ffd678;
	}
	.rc-caret {
		width: 1em;
		flex: none;
		font-size: 0.8em;
	}
	.rc-total {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-top: 0.5em;
		padding-top: 0.45em;
		border-top: 1px solid rgba(189, 143, 82, 0.35);
	}
	.rc-total-k {
		font-family: 'Cinzel', var(--ui-font);
		font-weight: 700;
		color: #c9b28a;
	}
	.rc-total-v {
		font-family: 'Sora', var(--ui-font);
		font-weight: 700;
		color: #ffd678;
	}
</style>
