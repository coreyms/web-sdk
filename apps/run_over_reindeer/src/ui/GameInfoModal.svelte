<script lang="ts">
	// GAME INFO, full screen on the house panel surface (the Manticore Mayhem page's shell and styles, with this
	// game's sections): the paytable with the real symbol pictures, the lines, how to play, the modes, the max win
	// and RTP, the legal block. The copy is game/gameInfoText.ts (a first draft from the spec).
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateBet, stateModal, stateUrlDerived } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import Icon from './Icon.svelte';
	import config from '../game/config';
	import { soc } from '../game/social';
	import { stamp } from '../game/assets';
	import { gameInfoText, runs, MODE_NAMES, pct } from '../game/gameInfoText';
	import { modeCost } from '../game/betModeMeta';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { master, scale, left, top }: Props = $props();
	const vw = $derived(innerWidth.current ?? 1280);
	const vh = $derived(innerHeight.current ?? 720);
	const narrow = $derived(vw < 720);
	const short = $derived(vh < 340);
	const dense = $derived(narrow || short);
	const lowHead = $derived(vh < 600);

	const open = $derived(stateModal.modal?.name === 'gameRules' || stateModal.modal?.name === 'payTable');
	const close = () => (stateModal.modal = null);

	const SECTIONS = [
		{ id: 'paytable', label: soc('Paytable', 'Symbols') },
		{ id: 'lines', label: 'Lines' },
		{ id: 'howto', label: 'How to Play' },
		{ id: 'modes', label: 'Game Modes' },
		{ id: 'maxwin', label: 'Max Win & RTP' },
		{ id: 'legal', label: 'Legal' },
	];

	const T = gameInfoText();

	// the symbols' own colors for their names (the spec's color hierarchy)
	const SYMBOL_COLOR: Record<string, string> = { H1: '#c58bff', H2: '#9fd17a', H3: '#7fc4ff', H4: '#eef0f6', L1: '#b6ff1a', L2: '#ff9a3c', L3: '#ff5fc0', L4: '#ffd400', L5: '#eef0f6' };
	const paying = [...config.payOrder];
	// the picture of a symbol: cars and the sleigh in their left to right pose (tools/build_assets.py, symbols/single)
	const pictureOf = (code: string) => stamp(`/assets/symbols/single/${(config.carSymbols as readonly string[]).includes(code) || code === 'W' ? `${code}_R` : code}.webp`);
	const pays = (sym: string) => [...(config.symbols[sym as keyof typeof config.symbols].paytable ?? [])] as number[];
	const social = $derived(stateUrlDerived.social());
	const payText = (mult: number) => (social ? `${mult}x` : numberToCurrencyString(mult * stateBet.betAmount));

	const SPECIALS = [
		{ glyph: 'W', name: config.symbols.W.name, color: '#ff5a6e', note: T.paytable.wild },
		{ glyph: 'S', name: config.symbols.S.name, color: '#19d3da', note: T.paytable.scatter },
	];

	const capPerPrice = (cost: number) => (config.maxWin / cost).toLocaleString('en-US', { maximumFractionDigits: 1 });
	const MAX_WIN = config.maxWin.toLocaleString('en-US');
	const MODE_STYLE: { id: keyof typeof config.betModes; accent: string }[] = [
		{ id: 'base', accent: '#eef0f6' },
		{ id: 'ante_2', accent: '#ffdc4a' },
		{ id: 'ante_4', accent: '#ffdc4a' },
		{ id: 'ante_10', accent: '#ffdc4a' },
		{ id: 'bonus', accent: '#19d3da' },
		{ id: 'super', accent: '#ff5a6e' },
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
	let navEl: HTMLDivElement | undefined = $state();
	const sectionEls: Record<string, HTMLElement> = {};

	// offsetTop is relative to the panel (the nearest positioned ancestor), so subtract the scroller's own offset
	const topOf = (el: HTMLElement) => el.offsetTop - (contentEl?.offsetTop ?? 0);
	const jump = (id: string) => {
		const el = sectionEls[id];
		if (el && contentEl) contentEl.scrollTo({ top: topOf(el) - 12, behavior: 'smooth' });
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
	// keep the active tab in view on phones, where the strip scrolls sideways
	$effect(() => {
		if (!navEl) return;
		const tab = navEl.querySelector(`[data-tab="${active}"]`) as HTMLElement | null;
		tab?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
	});

	const pad = $derived(short ? 10 : dense ? 14 : 28);
	const bodySize = $derived(dense ? 12.5 : 13.5);
	const tabSize = $derived(lowHead ? 10 : dense ? 10.5 : 11);
	const tileSize = $derived(short ? 40 : dense ? 48 : 64);
	const statSize = $derived(dense ? 15 : 17);
	const payFont = $derived(dense ? 13 : 16);
	// the 20 line pictures: how many to a row
	const lineCols = $derived(narrow ? 4 : 6);
</script>

{#snippet rich(text: string)}{#each runs(text) as r}{#if r.b}<strong>{r.t}</strong>{:else}{r.t}{/if}{/each}{/snippet}

<ModalShell {open} onclose={close} {master} {scale} {left} {top} dim="rgba(6,4,10,0.72)" zIndex={5}>
	<!-- full screen: no margin, no radius; the glass IS the page (Black Glass Panels, 2026-09-09) -->
	<div class="panel" data-gameinfo onclick={(e) => e.stopPropagation()} role="presentation">
		<div class="head" style:padding="{lowHead ? 8 : dense ? 12 : 14}px {pad}px">
			<div class="h-title am-stencil" style:font-size="{lowHead ? 14 : dense ? 17 : 22}px">GAME INFO</div>
			<button class="slot-btn x" onclick={close} style:width="{lowHead ? 30 : 40}px" style:height="{lowHead ? 30 : 40}px" aria-label="Close"><Icon name="close" s={lowHead ? 14 : dense ? 16 : 18} /></button>
		</div>

		<div class="tabs" bind:this={navEl} style:padding="4px {pad - 8}px">
			{#each SECTIONS as s (s.id)}
				<button class="slot-btn tab" class:on={active === s.id} data-tab={s.id} onclick={() => jump(s.id)} style:padding={lowHead ? '7px 8px 6px' : dense ? '9px 9px 8px' : '10px 12px 9px'} style:font-size="{tabSize}px">{s.label}</button>
			{/each}
		</div>

		<div class="content" class:dense bind:this={contentEl} onscroll={onScroll} style:padding="{short ? 12 : dense ? 16 : 22}px {pad}px 40px" style:gap="{short ? 24 : dense ? 36 : 52}px" style:font-size="{bodySize}px">
			<section bind:this={sectionEls.paytable}>
				<h2>{soc('Paytable', 'Symbols')}</h2>
				<p>{@render rich(T.paytable.intro)}</p>
				<div class="pay-grid" style:grid-template-columns={narrow ? '1fr' : '1fr 1fr'}>
					{#each paying as sym (sym)}
						<div class="row">
							<img class="tile" src={pictureOf(sym)} alt={config.symbols[sym].name} style:width="{tileSize}px" style:height="{tileSize}px" />
							<div class="row-main">
								<div class="row-name" style:color={SYMBOL_COLOR[sym]} style:font-size="{dense ? 12.5 : 14}px">{config.symbols[sym].name}</div>
								<div class="row-kind">{config.symbols[sym].tier === 'PREMIUM' ? 'Premium' : config.symbols[sym].tier === 'HIGH' ? 'High' : 'Low'}</div>
							</div>
							<div class="pays">
								{#each pays(sym) as p, i}
									<div class="pay"><div class="pay-k">{T.paytable.kinds[config.payKinds[i]]}</div><div class="slot-num pay-v" style:font-size="{payFont}px">{payText(p)}</div></div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				<div class="tear"></div>
				<div class="subhead">{T.paytable.specials}</div>
				<div class="pay-grid" style:grid-template-columns="1fr">
					{#each SPECIALS as s (s.glyph)}
						<div class="row top">
							<img class="tile" src={pictureOf(s.glyph)} alt={s.name} style:width="{tileSize}px" style:height="{tileSize}px" />
							<div class="row-main">
								<div class="row-name" style:color={s.color}>{s.name}</div>
								<div class="note">{@render rich(s.note)}</div>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section bind:this={sectionEls.lines}>
				<h2>Lines</h2>
				<p>{T.lines.intro}</p>
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
							<div class="slot-num line-n">{i + 1}</div>
						</div>
					{/each}
				</div>
			</section>

			<section bind:this={sectionEls.howto}>
				<h2>How to Play</h2>
				{#each T.howTo as p}<p>{@render rich(p)}</p>{/each}
			</section>

			<section bind:this={sectionEls.modes}>
				<h2>Game Modes</h2>
				{#each T.modes.intro as p}<p>{@render rich(p)}</p>{/each}
				<div class="modes">
					{#each MODES as m (m.id)}
						<div class="mode" class:narrow data-mode={m.id} style:border-left-color={m.accent}>
							<div class="mode-head">
								<div class="mode-name" style:color={m.accent} style:font-size="{dense ? 16.5 : 20}px">{m.label}</div>
								<div class="stats">
									<div class="stat price" data-stat="price">
										<div class="stat-k">{T.modes.stats.price}</div>
										<div class="slot-num stat-v" style:color={m.accent} style:font-size="{statSize}px">{m.cost}</div>
										<div class="stat-sub">{T.modes.stats.priceUnit}</div>
									</div>
									<div class="stat rtp" data-stat="rtp">
										<div class="stat-k">{T.modes.stats.rtp}</div>
										<div class="slot-num stat-v" style:font-size="{statSize}px">{m.rtp}</div>
									</div>
									<div class="stat max" data-stat="max">
										<div class="stat-k">{T.modes.stats.maxWin}</div>
										<div class="slot-num stat-v" style:font-size="{statSize}px">{MAX_WIN}x</div>
										{#if m.costNum > 1}<div class="stat-sub">({capPerPrice(m.costNum)}x {T.modes.stats.thisMode})</div>{/if}
									</div>
								</div>
							</div>
							<div class="kv-grid" style:grid-template-columns={narrow ? '1fr' : '1fr 1fr'}>
								<div><div class="k">{T.modes.labels.enter}</div><div class="v">{@render rich(m.enter)}</div></div>
								<div><div class="k">{T.modes.labels.spins}</div><div class="v">{@render rich(m.spins)}</div></div>
							</div>
							<div>
								<div class="k">{T.modes.labels.mech}</div>
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
				<div class="callout red">
					<div class="maxwin-line"><span class="slot-num maxwin" style:font-size="{short ? 20 : dense ? 22 : 36}px">{MAX_WIN}x</span><span class="dim">{T.maxWin.unit}</span></div>
					<p>{@render rich(T.maxWin.text)}</p>
				</div>
				<div class="subhead">{T.maxWin.rtpHead}</div>
				<div class="rtp-grid" style:grid-template-columns={narrow ? '1fr 1fr' : 'repeat(6, 1fr)'}>
					{#each MODES as m (m.id)}
						<div class="rtp-cell">
							<div class="rtp-k" style:color={m.accent}>{m.label}</div>
							<div class="slot-num rtp-v" style:font-size="{dense ? 18 : 22}px">{m.rtp}</div>
						</div>
					{/each}
				</div>
				<p>{@render rich(T.maxWin.rtp)}</p>
			</section>

			<section bind:this={sectionEls.legal}>
				<h2>Legal</h2>
				<div class="callout muted"><p class="dim">{T.legal.disclaimer}</p></div>
				<div class="subhead">{T.legal.versionHead}</div>
				<div class="kv-grid" style:grid-template-columns={narrow ? '1fr' : '1fr 1fr'}>
					{#each [['Game version', __APP_VERSION__], ['Math version', config.mathVersion], ['Provider', 'Polymath Games'], ['Replay mode', 'Supported']] as [k, v]}
						<div class="kv"><span class="dim">{k}</span><span class="slot-num">{v}</span></div>
					{/each}
				</div>
			</section>
			<div style:height="12px"></div>
		</div>
	</div>
</ModalShell>

<style>
	/* ── black glass, full screen (surface tokens from ChromeStyles; the paper tokens are gone) ── */
	.panel {
		--ink: var(--ui-ink);
		/* the panel's OWN greys, lifted for reading (COMPARISON.md fix 2: body #a5a8b6 was 8.1:1, faint #6d707d 3.9:1 on
		   the glass); the HUD's --ui-ink-2 / --ui-ink-3 are untouched */
		--body: #c9ccd6;
		--muted: #c9ccd6;
		--faint: #969aa8;
		/* the spaced capital labels (HOW TO ENTER, SPINS, the stat tiles' labels, the pay bands, the symbol kind): smaller
		   and quieter than the text they name (Corey 2026-10-15); about 5:1 on the glass */
		--label: #80848f;
		/* the reading face (ui/fontFaces.ts): real variable Outfit, drawn at 400 with bold keywords at 700. Headings,
		   names and labels name --ui-font (the HUD's black Outfit) themselves */
		--gi-body: 'Outfit Text', var(--ui-font);
		--rule: var(--ui-rule);
		--rule-2: var(--ui-rule-2);
		--well: var(--ui-glass-well);
		--gold: #ffdc4a;
		--red: #ff8a70;
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		color: var(--body);
		background: var(--ui-glass);
		box-shadow: inset 0 1px 0 var(--ui-glass-hi);
		overflow: hidden;
		pointer-events: auto;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--rule);
	}
	.h-title {
		/* the display face (ChromeStyles --ui-font-display, review D10): Cinzel 700 with the wide tracking */
		font-weight: var(--ui-display-weight);
		letter-spacing: var(--ui-display-track-wide);
		color: var(--ink);
	}
	.x {
		border-radius: 9px;
		background: var(--well);
		color: var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.x:hover {
		background: var(--ui-glass-well-2);
	}
	/* tab strip: underlined text, gold on the active one: eleven fit in one row on desktop, scroll on portrait */
	.tabs {
		display: flex;
		gap: 2px;
		flex: 0 0 auto;
		overflow-x: auto;
		overflow-y: hidden;
		border-bottom: 1px solid var(--rule);
		scrollbar-width: none;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tab {
		flex: 0 0 auto;
		background: transparent;
		border-bottom: 2px solid transparent;
		color: var(--body);
		font-weight: 800;
		letter-spacing: 1.8px;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.tab.on {
		color: var(--gold);
		border-bottom-color: var(--gold);
	}
	.content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		line-height: 1.55;
		/* body text bright (Corey 2026-10-15): the reading copy in --ink, emphasis by weight */
		color: var(--ink);
		font-family: var(--gi-body);
		font-weight: 400;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: var(--rule-2) transparent;
	}
	/* the reading column: capped and centred on wide masters. Running text (paragraphs, lists, notes, callouts) fills it
	   to the cards' right edge (Corey 2026-10-15: the 72 character measure is gone) */
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		max-width: 880px;
		margin: 0 auto;
	}
	/* section headings above the body size (COMPARISON.md fix 5: 13 px read smaller than the 13.5 px body) */
	h2 {
		margin: 0;
		font-family: var(--ui-font);
		font-size: 20px;
		font-weight: 900;
		letter-spacing: 3px;
		color: var(--gold);
		text-transform: uppercase;
	}
	.content.dense h2 {
		font-size: 18px;
	}
	p {
		margin: 0;
	}
	strong {
		color: var(--ink);
		font-weight: 700;
	}
	.dim {
		color: var(--faint);
	}
	ul {
		margin: 4px 0 0 18px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.subhead {
		font-family: var(--ui-font);
		font-size: 11.5px;
		letter-spacing: 2px;
		font-weight: 800;
		color: var(--ink);
		text-transform: uppercase;
		margin-top: 6px;
	}
	.tear {
		height: 0;
		border-top: 1px solid var(--rule);
		margin: 8px 0;
	}
	.pay-grid {
		display: grid;
		gap: 8px;
		margin-top: 4px;
	}
	/* rows / cards: hairline boxes on the glass */
	/* cells sized up 2026-09-15 (Corey): 64px tiles, larger names and pays: the 44px thumbnails
	   read as coloured squares in the approval review */
	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--rule);
	}
	.row.top {
		align-items: flex-start;
	}
	.tile {
		flex-shrink: 0;
		display: block;
		object-fit: contain; /* the symbols are not square: each is shown whole in its box */
	}
	.row-main {
		flex: 1;
		min-width: 0;
	}
	.row-name {
		font-family: var(--ui-font);
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 1.5px;
		text-transform: uppercase;
	}
	.row-kind {
		font-family: var(--ui-font);
		font-size: 10.5px;
		color: var(--label);
		letter-spacing: 1px;
		text-transform: uppercase;
		margin-top: 2px;
	}
	/* floors (Stake review FIX 6): no line in Game Info renders under 10 CSS px at any size */
	.note {
		color: var(--ink);
		font-size: 12px;
		line-height: 1.45;
	}
	.pays {
		display: flex;
		gap: 14px;
		flex-shrink: 0;
	}
	.pay {
		text-align: right;
		min-width: 44px;
	}
	.pay-k {
		font-family: var(--ui-font);
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 0.5px;
		color: var(--label);
		text-transform: uppercase;
	}
	.pay-v {
		font-size: 16px;
		color: var(--ink);
		font-weight: 700;
		white-space: nowrap;
	}
	/* mode cards: the per-mode colour is a 3px left rail and the name only */
	.modes {
		display: grid;
		gap: 8px;
		margin-top: 4px;
	}
	.mode {
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--rule);
		border-left: 3px solid var(--ink);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	/* the name left, the three stat tiles right; on a narrow window (or whenever they do not fit beside the name) the
	   tiles take their own line and share it, wrapping again rather than overflowing */
	.mode-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
		flex-wrap: wrap;
	}
	.mode-name {
		font-family: var(--ui-font);
		font-weight: 900;
		letter-spacing: 2px;
		text-transform: uppercase;
		line-height: 1.2;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		min-width: 0;
		max-width: 100%;
	}
	.mode.narrow .stats {
		flex: 1 1 100%;
	}
	.stat {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		padding: 6px 10px 7px;
		border-radius: 8px;
		border: 1px solid var(--rule-2);
		font-family: var(--ui-font);
	}
	/* desktop: fixed tile widths so the tiles line up from card to card */
	.mode:not(.narrow) .stat.price {
		width: 164px;
	}
	.mode:not(.narrow) .stat.rtp {
		width: 92px;
	}
	.mode:not(.narrow) .stat.max {
		width: 178px;
	}
	.mode.narrow .stat {
		flex: 1 1 auto;
	}
	.stat-k {
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 1.6px;
		color: var(--label);
		text-transform: uppercase;
		line-height: 1.3;
	}
	.stat-v {
		font-weight: 700;
		color: var(--ink);
		line-height: 1.2;
		white-space: nowrap;
	}
	.stat-sub {
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 1px;
		color: var(--label);
		text-transform: uppercase;
		line-height: 1.3;
	}
	/* WHAT'S DIFFERENT: the mechanics sentences as bullets */
	.mode ul.mech {
		margin: 2px 0 0 18px;
		gap: 3px;
	}
	.kv-grid {
		display: grid;
		gap: 8px;
		font-size: 12.5px;
	}
	.k {
		font-family: var(--ui-font);
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 1.6px;
		color: var(--label);
		text-transform: uppercase;
	}
	.v {
		color: var(--ink);
		margin-top: 2px;
	}
	.kv {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 0;
		border-bottom: 1px solid var(--rule);
		color: var(--ink);
		font-weight: 600;
	}
	.callout {
		padding: 14px 16px;
		border-radius: 12px;
		border: 1px solid var(--rule-2);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.callout.red {
		border-color: rgba(197, 60, 36, 0.55);
		background: rgba(197, 60, 36, 0.1);
	}
	.callout.muted {
		border-style: dashed;
	}
	.maxwin-line {
		display: flex;
		align-items: baseline;
		gap: 12px;
		flex-wrap: wrap;
	}
	.maxwin {
		font-weight: 700;
		color: var(--ink);
	}
	.rtp-grid {
		display: grid;
		gap: 8px;
	}
	.rtp-cell {
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		text-align: center;
	}
	.rtp-k {
		font-family: var(--ui-font);
		font-size: 12px;
		letter-spacing: 1.4px;
		font-weight: 800;
		text-transform: uppercase;
	}
	.rtp-v {
		font-weight: 700;
		color: var(--ink);
	}
	/* the 20 line pictures */
	.lines {
		display: grid;
		gap: 10px 8px;
		margin-top: 10px;
	}
	.line {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
	}
	.line svg {
		display: block;
		width: 100%;
		max-width: 86px;
		height: auto;
	}
	.line rect {
		fill: rgba(255, 255, 255, 0.1);
	}
	.line rect.hit {
		fill: var(--ui-gold);
	}
	.line-n {
		font-size: 11px;
		color: var(--faint);
	}
</style>
