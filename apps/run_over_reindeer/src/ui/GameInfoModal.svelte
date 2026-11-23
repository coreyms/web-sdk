<script lang="ts">
	// GAME INFO: the paytable with the real symbol pictures, the UI guide, the lines, how to play, the modes, the max win
	// and RTP, the legal block. The copy is game/gameInfoText.ts.
	// THE GUIDE SIGN (2026-11-23, Corey's pick from the mock game_info_sign_r1_2026-11-23, candidate A "One guide
	// sign"): one green sign standing over the dimmed game, the Menu pop-out's own plate (ui/sign/signPanel.css .sp-plate,
	// the --sp-* tokens of ui/hudTheme.ts SIGN_PANEL), 1000 px wide at most so the road shows at its sides (above 1440 wide the whole sign grows, gs below). Each section
	// is a plaque with a white line and its name on a green header plate set across that line (the bar's BALANCE plate);
	// the tabs are the Menu's dark plates (.sp-well) and the chosen one turns white. Bold words in the Turbo yellow.
	// Sizes come in four tiers (TIERS below): the smallest text is 11 px at every size and the close key and every tab
	// take a press of 44 px or more. At 400 x 225 the title gives way and the close key ends the first of two tab rows.
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateBet, stateConfig, stateModal, stateUrlDerived } from 'state-shared';
	import { numberToCurrencyString } from '../game/currency';
	import { measureFitText } from '../game/textFit';
	import { fitAmount } from './fitAmount';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import Icon from './Icon.svelte';
	import HudIcon, { type HudIconName } from './hud/HudIcon.svelte';
	import { POLYMATH_MARK } from './hud/polymathMark';
	import { HUD_CONFIG, signPanelTokens } from './hudTheme';
	import './sign/signPanel.css';
	import config from '../game/config';
	import { soc } from '../game/social';
	import { stamp } from '../game/assets';
	import { gameInfoText, guideRowShown, runs, MODE_NAMES, pct, type GuideId } from '../game/gameInfoText';
	import { modeCost } from '../game/betModeMeta';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { master, scale, left, top }: Props = $props();
	const vw = $derived(innerWidth.current ?? 1280);
	const vh = $derived(innerHeight.current ?? 720);
	const narrow = $derived(vw < 720);
	const short = $derived(vh < 340);
	const lowHead = $derived(vh < 600);

	// THE FOUR TIERS (the mock's): wide, low (a window under 600 tall), dense (under 720 wide) and short (under 340 tall,
	// Stake's 400 x 225 popout). Every size of the sign is here, in CSS px, and reaches the style block as a --gi-* value.
	//   m: the sign's margin to the window (8 more from 1600 wide), p: its inside padding, sp: a plaque's padding,
	//   sg: the room between plaques, cp: the room over the first plaque, body / note: the reading text, lab: the small
	//   spaced labels, tabf: the tabs' words, ttl: the title, h2: a header plate's words, name: a symbol's or a control's
	//   name, pv: a pay, tile: a symbol picture, icb / icn: a guide glyph's well and the glyph, mname: a mode's name,
	//   stat: a mode's numbers, maxw: the max win, rtpv: an RTP, xk: the close key
	const TIERS = {
		wide: { m: 24, p: 22, sp: 18, sg: 34, cp: 22, body: 14.5, note: 14, lab: 11, tabf: 12.5, ttl: 24, h2: 15, name: 14.5, pv: 17, tile: 64, icb: 44, icn: 22, mname: 19, stat: 17, maxw: 44, rtpv: 20, xk: 48 },
		low: { m: 12, p: 16, sp: 16, sg: 30, cp: 20, body: 14, note: 13.5, lab: 11, tabf: 12, ttl: 19, h2: 14, name: 14, pv: 16, tile: 56, icb: 40, icn: 21, mname: 17, stat: 16, maxw: 36, rtpv: 18, xk: 44 },
		dense: { m: 6, p: 10, sp: 12, sg: 28, cp: 18, body: 13.5, note: 13, lab: 11, tabf: 11, ttl: 17, h2: 13, name: 13, pv: 15, tile: 50, icb: 38, icn: 20, mname: 16, stat: 15, maxw: 30, rtpv: 17, xk: 44 },
		short: { m: 4, p: 6, sp: 10, sg: 24, cp: 16, body: 12.5, note: 12, lab: 11, tabf: 11.5, ttl: 13, h2: 12, name: 12, pv: 14, tile: 40, icb: 34, icn: 18, mname: 14, stat: 14, maxw: 24, rtpv: 15, xk: 44 },
	} as const;
	type Tier = keyof typeof TIERS;
	const tier: Tier = $derived(short ? 'short' : narrow ? 'dense' : lowHead ? 'low' : 'wide');
	// THE LARGE SCREEN SCALE (Corey 2026-11-23: "Let the sign grow wider and its text larger above 1440 wide"). Above 1440
	// CSS px of window width the whole sign grows by one factor, gs: its width cap, every --gi-* size, every px in the style
	// block (each a calc(N px * var(--gi-s, 1))), the plate's band, lines and corners (the --sp-* size tokens) and the close
	// key's glyph, so the approved design keeps its proportions. gs runs 1 at 1440, 1.35 at 1920, 1.6 from 2560, and never
	// more than the window's height gives (vh / 800: 1.35 at 1080 tall) or than leaves the sign 88 % of the window's width;
	// as it grows the sign's top and bottom margins grow too, to 6 % of the height each (the sign 88 % of it) by 1.35.
	// AT 1440 WIDE AND UNDER NOTHING CHANGES: gs is exactly 1 there, no --gi-s, --gi-mv or --sp-* value is written (so every
	// calc falls back to 1 px times its number), and every number the script sizes with is the tier's own.
	const gs = $derived.by(() => {
		if (vw <= 1440) return 1;
		const curve = vw <= 1920 ? 1 + (0.35 * (vw - 1440)) / 480 : Math.min(1.6, 1.35 + (0.25 * (vw - 1920)) / 640);
		return Math.round(Math.max(1, Math.min(curve, vh / 800, (0.88 * vw) / 1000)) * 1000) / 1000;
	});
	const r2 = (v: number) => Math.round(v * 100) / 100;
	/** the tier's sizes at the scale (the tier's own numbers at 1: no rounding, no copy) */
	const Z = $derived.by(() => {
		const t = TIERS[tier];
		if (gs === 1) return t;
		return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, k === 'm' ? v : r2(v * gs)])) as unknown as (typeof TIERS)[Tier];
	});
	const margin = $derived(Z.m + (tier === 'wide' && vw >= 1600 ? 8 : 0));
	/** the top and bottom margins once the sign grows: from the margin at 1 to 6 % of the height at 1.35 and over */
	const marginV = $derived(gs === 1 ? margin : Math.max(margin, Math.round(vh * 0.06 * Math.min(1, (gs - 1) / 0.35))));
	/** the plate's own sizes (ui/hudTheme.ts signPanelTokens: the band, its lines, the corners), scaled with the sign */
	const SP_SIZES = ['bw', 'ko', 'ki', 'rad', 'wrad', 'wl'] as const;
	const signVars = $derived(
		[
			...Object.entries({ ...Z, m: margin }).map(([k, v]) => `--gi-${k}:${v}px`),
			...(gs === 1 ? [] : [`--gi-s:${gs}`, `--gi-mv:${marginV}px`, ...SP_SIZES.map((k) => `--sp-${k}:${r2(parseFloat(signPanelTokens()[k]) * gs)}px`)]),
		].join(';'),
	);
	/** the sign's band (SIGN_PANEL thickness) and a plaque's line, for the paytable's room before it is measured */
	const BAND = $derived(4 * gs);
	const PLAQUE_LINE = $derived(2 * gs);
	/** the faces: the bar's Overpass for every word but the reading text */
	const DISP_FACE = "'Overpass', 'Outfit', sans-serif";

	const open = $derived(stateModal.modal?.name === 'gameRules' || stateModal.modal?.name === 'payTable');
	const close = () => (stateModal.modal = null);

	const SECTIONS = [
		{ id: 'paytable', label: soc('Paytable', 'Symbols') },
		{ id: 'guide', label: 'UI Guide' },
		{ id: 'lines', label: 'Lines' },
		{ id: 'howto', label: 'How to Play' },
		{ id: 'modes', label: 'Game Modes' },
		{ id: 'maxwin', label: 'Max Win & RTP' },
		{ id: 'legal', label: 'Legal' },
	];

	// the page's words under the operator's switches (read when the page opens: the jurisdiction block has landed by then)
	const T = $derived(gameInfoText(stateConfig.jurisdiction ?? {}));

	// THE UI GUIDE (2026-11-18; Manticore Mayhem's section, this game's controls): one control per row, the HUD's own
	// glyph (ui/hud/HudIcon.svelte, the same line icons the bar draws; Icon.svelte for the few the bar has no key for), its
	// name and what a press does (game/gameInfoText.ts guide). A control the operator turns off has no row.
	// The feature key's row (2026-11-19): the key shows the PolyMath mark (HUD_CONFIG.featureMark), so its row draws the
	// mark's silhouette (ui/hud/polymathMark.ts); with no mark the HUD glyph as before.
	type GuideIcon = { id: GuideId; hud?: HudIconName; ui?: 'play' | 'instant' | 'coins' | 'chevronRight' | 'info'; mark?: boolean };
	const GUIDE_ICONS: GuideIcon[] = [
		HUD_CONFIG.featureMark ? { id: 'feature', mark: true } : { id: 'feature', hud: 'arm' },
		{ id: 'spin', ui: 'play' },
		{ id: 'boardTap', ui: 'instant' },
		{ id: 'skip', hud: 'skip' },
		{ id: 'autoplay', hud: 'auto' },
		{ id: 'turbo', hud: 'turbo' },
		{ id: 'menu', hud: 'menu' },
		{ id: 'sound', hud: 'sound' },
		{ id: 'amount', hud: 'plus' },
		{ id: 'readouts', hud: 'info' },
		{ id: 'symbols', ui: 'coins' },
		{ id: 'keyboard', ui: 'chevronRight' },
		{ id: 'replay', ui: 'play' },
	];
	const GUIDE = $derived(GUIDE_ICONS.filter((g) => guideRowShown(g.id, stateConfig.jurisdiction ?? {})).map((g) => ({ ...g, ...T.guide.rows[g.id] })));

	const paying = [...config.payOrder];
	// the picture of a symbol: cars and the sleigh in their left to right pose (tools/build_assets.py, symbols/single)
	const pictureOf = (code: string) => stamp(`/assets/symbols/single/${(config.carSymbols as readonly string[]).includes(code) || code === 'W' ? `${code}_R` : code}.webp`);
	const pays = (sym: string) => [...(config.symbols[sym as keyof typeof config.symbols].paytable ?? [])] as number[];
	const social = $derived(stateUrlDerived.social());
	const payText = (mult: number) => (social ? `${mult}x` : numberToCurrencyString(mult * stateBet.betAmount));
	const kindOf = (sym: string) => {
		const t = config.symbols[sym as keyof typeof config.symbols].tier;
		return t === 'PREMIUM' ? 'Premium' : t === 'HIGH' ? 'High' : 'Low';
	};

	const SPECIALS = $derived([
		{ glyph: 'W', name: config.symbols.W.name, note: T.paytable.wild },
		// the red present beside the teal one: the 4th and 5th present of a spin, the ones that start Super (tools/build_present.py)
		{ glyph: 'S', also: 'S-red', alsoName: `${config.symbols.S.name}, red`, name: config.symbols.S.name, note: T.paytable.scatter },
	]);

	const capPerPrice = (cost: number) => (config.maxWin / cost).toLocaleString('en-US', { maximumFractionDigits: 1 });
	const MAX_WIN = config.maxWin.toLocaleString('en-US');
	// each mode card's rail: the game's own colors (white, the Turbo yellow, the present's teal, the sign red)
	const MODE_STYLE: { id: keyof typeof config.betModes; rail: string }[] = [
		{ id: 'base', rail: '#f4f8fc' },
		{ id: 'ante_2', rail: '#fccd02' },
		{ id: 'ante_4', rail: '#fccd02' },
		{ id: 'ante_10', rail: '#fccd02' },
		{ id: 'bonus', rail: '#19d3da' },
		{ id: 'super', rail: '#c8102e' },
	];
	const MODES = $derived(
		MODE_STYLE.map((m) => ({
			...m,
			label: MODE_NAMES[m.id],
			costNum: modeCost(m.id),
			cost: `${modeCost(m.id)}x`,
			rtp: pct(config.betModes[m.id].rtp),
			...T.modes.cards[m.id],
		})),
	);

	let active = $state('paytable');
	let contentEl: HTMLDivElement | undefined = $state();
	const sectionEls: Record<string, HTMLElement> = {};

	// offsetTop is relative to the sign (the nearest positioned ancestor), so subtract the scroller's own offset; a
	// section lands 18 px under the scroller's top, room for the half of its header plate that stands above its line
	const topOf = (el: HTMLElement) => el.offsetTop - (contentEl?.offsetTop ?? 0);
	const jump = (id: string) => {
		const el = sectionEls[id];
		if (el && contentEl) contentEl.scrollTo({ top: topOf(el) - 18, behavior: 'smooth' });
		active = id;
	};
	const onScroll = () => {
		if (!contentEl) return;
		const y = contentEl.scrollTop;
		let current = SECTIONS[0].id;
		for (const s of SECTIONS) {
			const el = sectionEls[s.id];
			if (el && topOf(el) <= y + 60) current = s.id;
		}
		active = current;
	};
	// THE TAB STRIP (the strip rule of 2026-11-22, Corey "AO Yes": every tab whole, nothing slides sideways, at most two
	// rows). One row of plates that grow to fill it where the seven fit (measured in their own face at the tier's size:
	// 746 px of tabs at the wide size, so a window from 846 wide, 698 at the low size, from 762 wide); else two rows, the
	// first four and the last three, each plate an equal share of its row (under 720 wide its words free to take two
	// lines); at 400 x 225 the first row is the first three and the close key.
	/** a font landing re-measures (the canvas measures a fallback face until it has the game's own) */
	let fontTick = $state(0);
	$effect(() => {
		const f = typeof document !== 'undefined' ? document.fonts : undefined;
		if (!f) return;
		let live = true;
		const h = () => live && fontTick++;
		f.ready.then(h);
		f.addEventListener?.('loadingdone', h);
		return () => {
			live = false;
			f.removeEventListener?.('loadingdone', h);
		};
	});
	/** the sign's inside: the window less its margins, capped at 1000, less the band and the padding */
	const signInner = $derived(Math.min(1000 * gs, vw - 2 * margin) - 2 * BAND - 2 * Z.p);
	/** the seven plates in one row: each word, its plate's padding (12 a side, 10 at the low size) and line, the gaps */
	const stripNeed = $derived.by(() => {
		void fontTick;
		const padX = (tier === 'low' ? 10 : 12) * gs;
		return SECTIONS.reduce((w, s) => w + measureFitText(s.label.toUpperCase(), Z.tabf, 900, 0.08 * Z.tabf, DISP_FACE) + 2 * padX + 2 * 1.6 * gs, 0) + 6 * 6 * gs;
	});
	const twoRows = $derived(!short && (narrow || stripNeed + 4 > signInner));

	// THE PAYS' ROOM (2026-11-21, wip/pricefit; in the sign's numbers 2026-11-23). One column of rows. A row is the
	// picture, the name and three pays to its right while the row has 430 px (the mock's rule) and the widest row's three
	// pays, measured in their own face (canvas metrics, on a currency, amount or width change, never per frame), leave the
	// name its longest word; else every row stacks its pays under it: three cells across, or, when the widest single
	// pay would not fit a cell at its size (a long currency, "2,500.000000 BTC"), one per line, the count left and the
	// amount right, fitted to the row (ui/fitAmount.ts). USD at usual amounts on a phone takes the three cells.
	const PAY_GAP = $derived(12 * gs);
	/** the paytable grid's own width (bind:clientWidth, a ResizeObserver: read on a resize, never per frame); before it is
	 *  known, the CSS's own numbers (the sign capped at 1000, the plaque at 880) */
	let gridW = $state(0);
	const gridWidth = $derived(gridW > 0 ? gridW : Math.min(880 * gs, signInner) - 2 * Z.sp - 2 * PLAQUE_LINE);
	/** the inside of one row: less its padding (12 a side) and its line (1.5 a side) */
	const rowInner = $derived(gridWidth - 2 * 12 * gs - 3 * gs);
	/** the name's least room: its longest word at the name's size and tracking (.row-name: Overpass 900, 0.06 em) */
	const nameMin = $derived.by(() => {
		void fontTick;
		return paying.reduce((m, sym) => Math.max(m, ...config.symbols[sym as keyof typeof config.symbols].name.toUpperCase().split(' ').map((w) => measureFitText(w, Z.name, 900, 0.06 * Z.name, DISP_FACE))), 0);
	});
	const payW = (p: number) => measureFitText(payText(p), Z.pv, 900, 0, DISP_FACE);
	/** the widest row's three pays side by side (each at least the .pay cell's 44) */
	const paysWidest = $derived.by(() => {
		void fontTick;
		return paying.reduce((m, sym) => Math.max(m, pays(sym).reduce((w, p) => w + Math.max(44 * gs, payW(p)), 0)), 0);
	});
	/** the widest single pay */
	const payWidest = $derived.by(() => {
		void fontTick;
		return paying.reduce((m, sym) => Math.max(m, ...pays(sym).map(payW)), 0);
	});
	const stackPays = $derived(gridWidth < 430 * gs || Z.tile + 12 * gs + nameMin + 12 * gs + paysWidest + 2 * PAY_GAP > rowInner + 0.5);
	/** stacked: one cell's inside, three across with 6 px between, each with 2 px of padding a side */
	const cellInner = $derived((rowInner - 2 * 6 * gs) / 3 - 4 * gs);
	const payCells = $derived(stackPays && payWidest <= cellInner * 0.98);
	// the 12 line pictures: how many to a row
	const lineCols = $derived(narrow ? 4 : 6);
</script>

{#snippet rich(text: string)}{#each runs(text) as r}{#if r.b}<strong>{r.t}</strong>{:else}{r.t}{/if}{/each}{/snippet}

{#snippet closeKey()}
	<button type="button" class="x" onclick={close} aria-label="Close" data-gi-close><span class="x-face"><Icon name="close" s={(tier === 'wide' ? 22 : 20) * gs} /></span></button>
{/snippet}

<ModalShell {open} onclose={close} {master} {scale} {left} {top} dim="rgba(6,4,10,0.72)" zIndex={5}>
	<!-- the sign: the Menu pop-out's plate (.sp-plate), centered over the dimmed game; a press beside it closes the page -->
	<div class="sp sp-plate gi" data-gameinfo data-gi-tier={tier} class:narrow class:short class:two={twoRows} class:low={tier === 'low'} style={signVars} onclick={(e) => e.stopPropagation()} role="presentation">
		{#if !short}
			<div class="hd">
				<div class="ttl"><i aria-hidden="true"></i><span>GAME INFO</span><i aria-hidden="true"></i></div>
				{@render closeKey()}
			</div>
		{/if}

		<div class="tabs">
			{#each SECTIONS as s, i (s.id)}
				{#if short && i === 3}{@render closeKey()}<i class="brk" aria-hidden="true"></i>{/if}
				{#if twoRows && i === 4}<i class="brk" aria-hidden="true"></i>{/if}
				<button type="button" class="tab" class:on={active === s.id} data-tab={s.id} onclick={() => jump(s.id)}><span class="sp-well face" class:on={active === s.id}><span>{s.label}</span></span></button>
			{/each}
		</div>

		<div class="content" bind:this={contentEl} onscroll={onScroll}>
			<section bind:this={sectionEls.paytable}>
				<h2>{soc('Paytable', 'Symbols')}</h2>
				<p>{@render rich(T.paytable.intro)}</p>
				<div class="pay-grid" bind:clientWidth={gridW}>
					{#each paying as sym (sym)}
						<div class="row" class:stack={stackPays} class:cells={payCells} data-pays-stacked={stackPays ? '' : undefined}>
							<img class="tile" src={pictureOf(sym)} alt={config.symbols[sym].name} />
							<div class="row-main">
								<div class="row-name">{config.symbols[sym].name}</div>
								<span class="lab">{kindOf(sym)}</span>
							</div>
							<div class="pays">
								{#each pays(sym) as p, i}
									<div class="pay"><span class="lab">{T.paytable.kinds[config.payKinds[i]]}</span><span class="num pay-v" use:fitAmount={{ text: payText(p), floor: 11 * gs, off: !stackPays }} data-gi-pay>{payText(p)}</span></div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				<div class="subhead">{T.paytable.specials}</div>
				<div class="pay-grid">
					{#each SPECIALS as s (s.glyph)}
						<div class="row top">
							<img class="tile" src={pictureOf(s.glyph)} alt={s.name} />
							{#if 'also' in s && s.also}
								<img class="tile also" src={pictureOf(s.also)} alt={s.alsoName} />
							{/if}
							<div class="row-main">
								<div class="row-name">{s.name}</div>
								<div class="note">{@render rich(s.note)}</div>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section bind:this={sectionEls.guide} data-guide>
				<h2>User Interface Guide</h2>
				<p>{@render rich(T.guide.intro)}</p>
				<div class="guide">
					{#each GUIDE as g (g.id)}
						<div class="guide-row" data-guide-row={g.id}>
							<div class="guide-icon">
								{#if g.mark}<svg class="ic" viewBox="{POLYMATH_MARK.bbox[0]} {POLYMATH_MARK.bbox[1]} {POLYMATH_MARK.bbox[2] - POLYMATH_MARK.bbox[0]} {POLYMATH_MARK.bbox[3] - POLYMATH_MARK.bbox[1]}" aria-hidden="true"><path d={POLYMATH_MARK.d} fill="currentColor" /></svg>{:else if g.hud}<HudIcon name={g.hud} />{:else if g.ui}<Icon name={g.ui} s={Z.icn} />{/if}
							</div>
							<div class="guide-text">
								<div class="guide-name">{g.name}</div>
								<div class="v">{@render rich(g.text)}</div>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section bind:this={sectionEls.lines}>
				<h2>Lines</h2>
				<p>{@render rich(T.lines.intro)}</p>
				<!-- one small picture per line: five columns by four lanes, the line's cells lit -->
				<div class="lines" style:grid-template-columns="repeat({lineCols}, minmax(0, 1fr))">
					{#each config.paylines as rows, i (i)}
						<div class="line">
							<svg viewBox="0 0 50 40" aria-label="Line {i + 1}">
								{#each rows as row, reel}
									{#each [0, 1, 2, 3] as r}
										<rect x={reel * 10 + 1} y={r * 10 + 1} width="8" height="8" rx="1.5" class:hit={r === row} />
									{/each}
								{/each}
							</svg>
							<div class="num line-n">{i + 1}</div>
						</div>
					{/each}
				</div>
			</section>

			<section bind:this={sectionEls.howto}>
				<h2>How to Play</h2>
				{#each T.howTo.filter(Boolean) as p}<p>{@render rich(p)}</p>{/each}
			</section>

			<section bind:this={sectionEls.modes}>
				<h2>Game Modes</h2>
				{#each T.modes.intro as p}<p>{@render rich(p)}</p>{/each}
				<div class="modes">
					{#each MODES as m (m.id)}
						<div class="mode" data-mode={m.id} style:--gi-rail={m.rail}>
							<div class="mode-head">
								<div class="mode-name">{m.label}</div>
								<div class="stats">
									<div class="stat price" data-stat="price">
										<span class="lab">{T.modes.stats.price}</span>
										<span class="num stat-v acc">{m.cost}</span>
										<span class="lab">{T.modes.stats.priceUnit}</span>
									</div>
									<div class="stat rtp" data-stat="rtp">
										<span class="lab">{T.modes.stats.rtp}</span>
										<span class="num stat-v">{m.rtp}</span>
									</div>
									<div class="stat max" data-stat="max">
										<span class="lab">{T.modes.stats.maxWin}</span>
										<span class="num stat-v">{MAX_WIN}x</span>
										{#if m.costNum > 1}<span class="lab sub">({capPerPrice(m.costNum)}x {T.modes.stats.thisMode})</span>{/if}
									</div>
								</div>
							</div>
							<div class="kv-grid">
								<div><span class="lab">{T.modes.labels.enter}</span><div class="v">{@render rich(m.enter)}</div></div>
								<div><span class="lab">{T.modes.labels.spins}</span><div class="v">{@render rich(m.spins)}</div></div>
							</div>
							<div>
								<span class="lab">{T.modes.labels.mech}</span>
								<ul class="mech">
									{#each m.mech as s}<li>{@render rich(s)}</li>{/each}
								</ul>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section bind:this={sectionEls.maxwin}>
				<h2>Max Win and RTP</h2>
				<div class="callout">
					<div class="maxwin-line"><span class="num maxwin">{MAX_WIN}x</span><span class="lab">{T.maxWin.unit}</span></div>
					<p>{@render rich(T.maxWin.text)}</p>
				</div>
				<div class="subhead">{T.maxWin.rtpHead}</div>
				<div class="rtp-grid">
					{#each MODES as m (m.id)}
						<div class="rtp-cell">
							<span class="lab">{m.label}</span>
							<span class="num rtp-v">{m.rtp}</span>
						</div>
					{/each}
				</div>
				<p>{@render rich(T.maxWin.rtp)}</p>
			</section>

			<section bind:this={sectionEls.legal}>
				<h2>Legal</h2>
				<div class="disc">{T.legal.disclaimer}</div>
				<div class="subhead">{T.legal.versionHead}</div>
				<div class="kvs">
					{#each [['Game version', __APP_VERSION__], ['Math version', config.mathVersion], ['Provider', 'Polymath Games'], ['Replay mode', 'Supported']] as [k, v]}
						<div class="kv"><span>{k}</span><span class="num">{v}</span></div>
					{/each}
				</div>
			</section>
			<div class="foot" aria-hidden="true"></div>
		</div>
	</div>
</ModalShell>

<style>
	/* THE GUIDE SIGN (the mock's candidate A). The plate, its band and lines, the tab plates and the chosen plate are
	   ui/sign/signPanel.css (.sp-plate, .sp-well); every color here is a --sp-* token but the header plates' green (the
	   bar's BALANCE plate, as .sp-tag), the guide's yellow and the mode rails. Every size is a --gi-* value (TIERS in the
	   script). No backdrop-filter, no CSS filter, no mask; motion is transform and color only. */
	.gi {
		--gi-disp: 'Overpass', 'Outfit', sans-serif;
		--gi-read: 'Outfit Text', 'Outfit', sans-serif;
		position: absolute;
		top: var(--gi-mv, var(--gi-m));
		bottom: var(--gi-mv, var(--gi-m));
		left: 0;
		right: 0;
		margin: 0 auto;
		width: min(calc(1000px * var(--gi-s, 1)), calc(100% - 2 * var(--gi-m)));
		display: flex;
		flex-direction: column;
		overflow: hidden;
		pointer-events: auto;
	}

	/* the head: the title between the bar's two diamonds, and the close key (the Fast Lane's: a black sign with the
	   panels' white band) */
	.hd {
		display: flex;
		align-items: center;
		gap: calc(12px * var(--gi-s, 1));
		padding: var(--gi-p) var(--gi-p) 0;
		flex: none;
	}
	.ttl {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.42em;
		font: 900 var(--gi-ttl) / 1 var(--gi-disp);
		letter-spacing: 0.1em;
		white-space: nowrap;
		text-transform: uppercase;
		color: var(--sp-ink);
	}
	.ttl > span {
		display: inline-block;
		transform: translateY(0.06em);
	}
	.ttl i {
		display: block;
		flex: none;
		width: 0.46em;
		height: 0.46em;
		background: var(--sp-acc);
		transform: rotate(45deg);
		border: calc(2px * var(--gi-s, 1)) solid var(--sp-acc-ink);
	}
	.x {
		flex: none;
		width: var(--gi-xk);
		height: var(--gi-xk);
		display: grid;
		place-items: center;
	}
	.x-face {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		border-radius: calc(12px * var(--gi-s, 1));
		background: var(--sp-ki-c);
		border: calc(3px * var(--gi-s, 1)) solid var(--sp-band);
		color: var(--sp-ink);
		box-shadow: 0 0 0 var(--sp-ko) var(--sp-ko-c);
		transition: transform 0.1s ease;
	}
	.x:active .x-face {
		transform: scale(0.94);
	}

	/* the tabs: each press box is the whole button (44 px tall or more); the drawn plate is the .face inside it */
	.tabs {
		display: flex;
		flex-wrap: wrap;
		column-gap: calc(6px * var(--gi-s, 1));
		padding: calc(8px * var(--gi-s, 1)) var(--gi-p) 0;
		flex: none;
	}
	.tab {
		flex: 1 1 auto;
		min-height: calc(44px * var(--gi-s, 1));
		min-width: min-content;
		display: flex;
		align-items: center;
		font: 900 var(--gi-tabf) / 1.05 var(--gi-disp);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
		text-align: center;
	}
	.tab .face {
		width: 100%;
		min-height: calc(38px * var(--gi-s, 1));
		display: flex;
		align-items: center;
		justify-content: center;
		padding: calc(4px * var(--gi-s, 1)) calc(12px * var(--gi-s, 1)) calc(2px * var(--gi-s, 1));
	}
	.low .tab .face {
		padding-left: calc(10px * var(--gi-s, 1));
		padding-right: calc(10px * var(--gi-s, 1));
	}
	.brk {
		display: block;
		flex-basis: 100%;
		height: 0;
	}
	.two .tab,
	.short .tab {
		flex: 1 1 0;
	}
	.narrow .tab {
		white-space: normal;
		letter-spacing: 0.05em;
	}
	.narrow .tab .face {
		min-height: calc(36px * var(--gi-s, 1));
		padding: calc(3px * var(--gi-s, 1)) calc(5px * var(--gi-s, 1)) calc(1px * var(--gi-s, 1));
	}
	.short .tabs {
		padding-top: var(--gi-p);
		align-items: center;
	}
	.short .tab {
		letter-spacing: 0.06em;
	}
	.short .tab .face {
		padding: calc(3px * var(--gi-s, 1)) calc(8px * var(--gi-s, 1)) calc(1px * var(--gi-s, 1));
		min-height: calc(38px * var(--gi-s, 1));
	}

	/* the page: it scrolls inside the sign, the window never does */
	.content {
		flex: 1 1 auto;
		min-height: 0;
		overflow-x: hidden;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--gi-sg);
		padding: var(--gi-cp) var(--gi-p) calc(28px * var(--gi-s, 1));
		font: 400 var(--gi-body) / 1.5 var(--gi-read);
		color: var(--sp-ink);
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.55) transparent;
	}
	.foot {
		flex: none;
		height: calc(1px * var(--gi-s, 1));
	}
	/* a section: a plaque on the sign, its white line, its name on a header plate set across the line (the bar's
	   BALANCE plate, as ui/sign/signPanel.css .sp-tag) */
	section {
		position: relative;
		flex: none;
		width: 100%;
		max-width: calc(880px * var(--gi-s, 1));
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: calc(10px * var(--gi-s, 1));
		border: calc(2px * var(--gi-s, 1)) solid var(--sp-band);
		border-radius: calc(12px * var(--gi-s, 1));
		background: rgba(0, 0, 0, 0.1);
		padding: calc(var(--gi-sp) + calc(8px * var(--gi-s, 1))) var(--gi-sp) var(--gi-sp);
	}
	h2 {
		position: absolute;
		left: calc(12px * var(--gi-s, 1));
		top: 0;
		transform: translateY(-50%);
		margin: 0;
		display: inline-flex;
		align-items: center;
		max-width: calc(100% - calc(24px * var(--gi-s, 1)));
		padding: 0.42em 0.62em 0.3em;
		font: 900 var(--gi-h2) / 1 var(--gi-disp);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		white-space: nowrap;
		color: #fff;
		background: linear-gradient(180deg, #288a58, #09673a);
		border: calc(2px * var(--gi-s, 1)) solid #fff;
		border-radius: calc(7px * var(--gi-s, 1));
		box-shadow:
			0 0 0 calc(1px * var(--gi-s, 1)) var(--sp-ko-c),
			inset 0 0 0 calc(0.8px * var(--gi-s, 1)) var(--sp-ki-c);
	}
	p {
		margin: 0;
	}
	strong {
		color: var(--sp-acc);
		font-weight: 700;
	}
	ul {
		margin: calc(4px * var(--gi-s, 1)) 0 0 calc(18px * var(--gi-s, 1));
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: calc(6px * var(--gi-s, 1));
	}
	/* the small spaced words: the 3, 4 and 5 over the pays, a symbol's kind, PRICE, RTP, MAX WIN, the modes' heads */
	.lab {
		display: block;
		font: 900 var(--gi-lab) / 1.15 var(--gi-disp);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--sp-ink2);
	}
	.subhead {
		font: 900 calc(12px * var(--gi-s, 1)) / 1.2 var(--gi-disp);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		margin-top: calc(6px * var(--gi-s, 1));
		color: var(--sp-ink);
	}
	.num {
		font-family: var(--gi-disp);
		font-weight: 900;
		font-variant-numeric: tabular-nums;
	}

	/* the paytable */
	.pay-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: calc(8px * var(--gi-s, 1));
	}
	.row {
		display: flex;
		align-items: center;
		gap: calc(12px * var(--gi-s, 1));
		padding: calc(8px * var(--gi-s, 1)) calc(12px * var(--gi-s, 1));
		border-radius: var(--sp-wrad);
		background: var(--sp-well);
		border: calc(1.5px * var(--gi-s, 1)) solid var(--sp-rule);
		min-width: 0;
	}
	.row.top {
		align-items: flex-start;
	}
	.tile {
		flex: none;
		display: block;
		width: var(--gi-tile);
		height: var(--gi-tile);
		object-fit: contain; /* the symbols are not square: each is shown whole in its box */
	}
	/* the red present right beside the teal one (one pair, not two rows) */
	.tile.also {
		margin-left: calc(-10px * var(--gi-s, 1));
	}
	.row-main {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: calc(3px * var(--gi-s, 1));
	}
	.row-name {
		font: 900 var(--gi-name) / 1.15 var(--gi-disp);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.note {
		font-size: var(--gi-note);
		line-height: 1.45;
	}
	.pays {
		flex: none;
		display: flex;
		gap: calc(12px * var(--gi-s, 1));
	}
	.pay {
		text-align: right;
		min-width: calc(44px * var(--gi-s, 1));
		display: flex;
		flex-direction: column;
		gap: calc(2px * var(--gi-s, 1));
	}
	.pay-v {
		font-size: var(--gi-pv);
		line-height: 1.1;
		white-space: nowrap;
	}
	/* stacked: the pays under the picture and the name. Three cells across, or one per line (a long currency), the
	   count left and the amount right, fitted to what is left of the line */
	.row.stack {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		row-gap: calc(8px * var(--gi-s, 1));
	}
	.row.stack .pays {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: calc(2px * var(--gi-s, 1));
		min-width: 0;
	}
	.row.stack .pay {
		flex-direction: row;
		align-items: baseline;
		justify-content: space-between;
		gap: calc(12px * var(--gi-s, 1));
		min-width: 0;
	}
	.row.stack .pay-v {
		display: block;
		flex: 1 1 0;
		min-width: 0;
		overflow: hidden;
		text-align: right;
	}
	.row.stack.cells .pays {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: calc(6px * var(--gi-s, 1));
	}
	.row.stack.cells .pay {
		flex-direction: column;
		align-items: stretch;
		gap: calc(2px * var(--gi-s, 1));
		text-align: center;
		padding: calc(5px * var(--gi-s, 1)) calc(2px * var(--gi-s, 1)) calc(4px * var(--gi-s, 1));
		border-radius: calc(7px * var(--gi-s, 1));
		background: rgba(0, 0, 0, 0.22);
	}
	.row.stack.cells .pay-v {
		flex: none;
		width: 100%;
		text-align: center;
	}

	/* the guide: the control's glyph in a dark plate, its name, what a press does */
	.guide {
		display: flex;
		flex-direction: column;
		gap: calc(8px * var(--gi-s, 1));
	}
	.guide-row {
		display: flex;
		align-items: flex-start;
		gap: calc(12px * var(--gi-s, 1));
		padding: calc(9px * var(--gi-s, 1)) calc(10px * var(--gi-s, 1));
		border-radius: var(--sp-wrad);
		background: var(--sp-well);
		border: calc(1.5px * var(--gi-s, 1)) solid var(--sp-rule);
		min-width: 0;
	}
	.guide-icon {
		flex: none;
		width: var(--gi-icb);
		height: var(--gi-icb);
		display: grid;
		place-items: center;
		border-radius: var(--sp-wrad);
		background: var(--sp-well);
		border: var(--sp-wl) solid var(--sp-band);
		color: var(--sp-ink);
	}
	.guide-icon :global(svg) {
		display: block;
		width: var(--gi-icn);
		height: var(--gi-icn);
	}
	.guide-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: calc(3px * var(--gi-s, 1));
	}
	.guide-name {
		font: 900 calc(var(--gi-name) + calc(0.5px * var(--gi-s, 1))) / 1.15 var(--gi-disp);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		margin-top: calc(2px * var(--gi-s, 1));
	}

	/* the lines */
	.lines {
		display: grid;
		gap: calc(10px * var(--gi-s, 1)) calc(8px * var(--gi-s, 1));
	}
	.line {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: calc(4px * var(--gi-s, 1));
		min-width: 0;
	}
	.line svg {
		display: block;
		width: 100%;
		max-width: calc(86px * var(--gi-s, 1));
		height: auto;
		border-radius: calc(6px * var(--gi-s, 1));
		background: var(--sp-well);
		border: calc(1.5px * var(--gi-s, 1)) solid var(--sp-rule);
	}
	.line rect {
		fill: rgba(255, 255, 255, 0.16);
	}
	.line rect.hit {
		fill: var(--sp-acc);
	}
	.line-n {
		font-size: calc(11.5px * var(--gi-s, 1));
		line-height: 1;
	}

	/* the modes: each a dark plate with its color as a rail down its left edge */
	.modes {
		display: grid;
		gap: calc(10px * var(--gi-s, 1));
	}
	.mode {
		position: relative;
		padding: calc(10px * var(--gi-s, 1)) calc(12px * var(--gi-s, 1)) calc(11px * var(--gi-s, 1)) calc(16px * var(--gi-s, 1));
		border-radius: var(--sp-wrad);
		background: var(--sp-well);
		border: calc(1.5px * var(--gi-s, 1)) solid var(--sp-rule);
		display: flex;
		flex-direction: column;
		gap: calc(8px * var(--gi-s, 1));
		min-width: 0;
	}
	.mode::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: calc(6px * var(--gi-s, 1));
		border-radius: calc(8px * var(--gi-s, 1)) 0 0 calc(8px * var(--gi-s, 1));
		background: var(--gi-rail);
	}
	.mode-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: calc(8px * var(--gi-s, 1)) calc(16px * var(--gi-s, 1));
	}
	.mode-name {
		font: 900 var(--gi-mname) / 1.15 var(--gi-disp);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: calc(6px * var(--gi-s, 1));
		min-width: 0;
	}
	.narrow .stats,
	.short .stats {
		flex: 1 1 100%;
	}
	.stat {
		display: flex;
		flex-direction: column;
		gap: calc(3px * var(--gi-s, 1));
		min-width: 0;
		padding: calc(6px * var(--gi-s, 1)) calc(10px * var(--gi-s, 1));
		border-radius: calc(7px * var(--gi-s, 1));
		flex: 1 1 auto;
		background: rgba(0, 0, 0, 0.24);
		border: calc(1.5px * var(--gi-s, 1)) solid var(--sp-rule);
	}
	/* from 720 wide: fixed tile widths so the tiles line up from card to card */
	.gi:not(.narrow):not(.short) .stat.price {
		width: calc(150px * var(--gi-s, 1));
		flex: none;
	}
	.gi:not(.narrow):not(.short) .stat.rtp {
		width: calc(84px * var(--gi-s, 1));
		flex: none;
	}
	.gi:not(.narrow):not(.short) .stat.max {
		width: calc(196px * var(--gi-s, 1));
		flex: none;
	}
	.stat .lab.sub {
		white-space: normal;
		letter-spacing: 0.06em;
	}
	.stat-v {
		font-size: var(--gi-stat);
		line-height: 1.1;
		white-space: nowrap;
	}
	.stat-v.acc {
		color: var(--sp-acc);
	}
	.kv-grid {
		display: grid;
		gap: calc(8px * var(--gi-s, 1));
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.narrow .kv-grid,
	.short .kv-grid {
		grid-template-columns: minmax(0, 1fr);
	}
	.v {
		margin-top: calc(2px * var(--gi-s, 1));
	}
	.mode ul.mech {
		margin: calc(3px * var(--gi-s, 1)) 0 0 calc(18px * var(--gi-s, 1));
		gap: calc(3px * var(--gi-s, 1));
	}

	/* the max win and the RTPs */
	.callout {
		display: flex;
		flex-direction: column;
		gap: calc(8px * var(--gi-s, 1));
		padding: calc(14px * var(--gi-s, 1)) calc(16px * var(--gi-s, 1));
		border-radius: var(--sp-wrad);
		background: var(--sp-well);
		border: calc(2px * var(--gi-s, 1)) solid var(--sp-acc);
	}
	.maxwin-line {
		display: flex;
		align-items: baseline;
		gap: calc(12px * var(--gi-s, 1));
		flex-wrap: wrap;
	}
	.maxwin {
		font-size: var(--gi-maxw);
		line-height: 1;
		letter-spacing: 0.02em;
		color: var(--sp-acc);
	}
	.rtp-grid {
		display: grid;
		gap: calc(8px * var(--gi-s, 1));
		grid-template-columns: repeat(6, minmax(0, 1fr));
	}
	.narrow .rtp-grid,
	.short .rtp-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.rtp-cell {
		display: flex;
		flex-direction: column;
		gap: calc(5px * var(--gi-s, 1));
		align-items: center;
		text-align: center;
		padding: calc(9px * var(--gi-s, 1)) calc(6px * var(--gi-s, 1)) calc(8px * var(--gi-s, 1));
		border-radius: var(--sp-wrad);
		background: var(--sp-well);
		border: calc(1.5px * var(--gi-s, 1)) solid var(--sp-rule);
		min-width: 0;
	}
	.rtp-cell .lab {
		white-space: normal;
		line-height: 1.2;
	}
	.rtp-v {
		font-size: var(--gi-rtpv);
		line-height: 1;
	}

	/* legal */
	.disc {
		padding: calc(12px * var(--gi-s, 1)) calc(14px * var(--gi-s, 1));
		border-radius: var(--sp-wrad);
		font-size: var(--gi-note);
		line-height: 1.5;
		border: calc(1.6px * var(--gi-s, 1)) dashed rgba(255, 255, 255, 0.55);
		color: var(--sp-ink2);
	}
	.kvs {
		display: grid;
		gap: 0 calc(18px * var(--gi-s, 1));
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.narrow .kvs,
	.short .kvs {
		grid-template-columns: minmax(0, 1fr);
	}
	.kv {
		display: flex;
		justify-content: space-between;
		gap: calc(12px * var(--gi-s, 1));
		padding: calc(7px * var(--gi-s, 1)) 0 calc(6px * var(--gi-s, 1));
		font-weight: 600;
		font-size: var(--gi-note);
		border-bottom: calc(1.5px * var(--gi-s, 1)) solid var(--sp-rule);
	}
	.kv .num {
		font-weight: 800;
	}
	@media (prefers-reduced-motion: reduce) {
		.x-face {
			transition: none;
		}
	}
</style>
