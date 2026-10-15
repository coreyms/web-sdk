<script lang="ts">
	// Game Info: sticky tab strip + scroll-spied sections. Stake Engine requires full feature
	// disclosure here: paytable, modes, the Mystery split and the Epic floor, max win, RTP per mode,
	// volatility, and the verbatim rules disclaimer. Every NUMBER comes from config.ts, which mirrors
	// game_config.py, and from the RGS's own prices.
	//
	// The wording (game/gameInfoText.ts) is the trimmed page Corey approved on 2026-10-13 (Desktop review folder
	// feedback/rules_trim_r1): it has been through the owner's review, not yet through a Stake review. Eight sections;
	// the old Game Rules block is gone, each of its facts now lives once in the section it belongs to.
	//
	// READABILITY (Build B2, 2026-10-14; images/rules_menu_ref_r1/COMPARISON.md fixes 1 to 6, approved): body copy
	// (paragraphs, list items, card text, notes) in the real variable Outfit at 400 ('Outfit Text', ui/fontFaces.ts)
	// with bold keywords at 700; headings, names and labels keep the HUD's heavy Outfit; the panel's own greys lifted;
	// labels 12 px; the reading measure held to about 72 characters (cards and pay rows stay 880 px); section headings
	// 20 px with more air between sections; the compact header up to 600 px of window height. The HUD is untouched.
	//
	// LAYOUT ROUND 1 (Corey 2026-10-15, feedback/rules_layout_r1): each mode card's one meta line became three boxed
	// stat tiles (COST / EACH ROUND, RTP, MAX WIN with the per-mode bracket); the card body is HOW TO ENTER and SPINS
	// side by side, then WHAT'S DIFFERENT as bullets; type scale: mode name, then stat values, labels 10.5 px and
	// quieter (--label), body text in --ink; the 72 character measure is gone, running text fills the 880 px column to
	// the cards' right edge. This supersedes "labels 12 px" and the measure above.
	import type { ComponentProps } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateBet, stateModal, stateUrlDerived } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import Icon from './Icon.svelte';
	import config from '../game/config';
	import { soc } from '../game/social';
	import { skipAllowed } from '../game/stateGame.svelte';
	import { stamp } from '../game/assets';
	import { gameInfoText, runs, MODE_NAMES, pct, type GuideId } from '../game/gameInfoText';
	import { modeCost } from '../game/betModeMeta';
	import { measureFitText } from '../game/textFit';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { master, scale, left, top, compact = false }: Props = $props();
	// `compact` is the LAYOUT KIND (any non-landscape chrome). That was the wrong gate for type
	// size (Stake review 2026-09-20, FIX 6): Stake's Popout S is a 400x225 iframe that resolves to
	// the phone kind, so it took the phone's compact sizes and, before FIX 5, saw them scaled by
	// 0.27 on top. The shell is the viewport now, so gate on the REAL window instead: `narrow` is
	// what the reading column can afford, `short` is a viewport with no vertical room. Minimum
	// sizes below are CSS px and never drop under 10.
	const vw = $derived(innerWidth.current ?? 1280);
	const vh = $derived(innerHeight.current ?? 720);
	const narrow = $derived(vw < 720);
	const short = $derived(vh < 340);
	const dense = $derived(narrow || short);
	// the fixed header (title row + tabs) goes compact on any window under 600 px high (COMPARISON.md fix 6: at
	// 800 x 450 the full header took a quarter of the window); the reading sizes below still follow `short` / `dense`
	const lowHead = $derived(vh < 600);

	const open = $derived(stateModal.modal?.name === 'gameRules' || stateModal.modal?.name === 'payTable');
	const close = () => (stateModal.modal = null);

	const SECTIONS = [
		{ id: 'paytable', label: soc('Paytable', 'Symbols') },
		{ id: 'guide', label: 'UI Guide' },
		{ id: 'howto', label: 'How to Play' },
		{ id: 'modes', label: 'Game Modes' },
		{ id: 'mystery', label: 'Mystery Disclosure' },
		{ id: 'tiles', label: 'Multiplier Tiles' },
		{ id: 'maxwin', label: 'Max Win & RTP' },
		{ id: 'legal', label: 'Legal' },
	];

	// every string of the page; the Epic floor shows its live amount at the current bet
	const T = $derived(gameInfoText((x) => numberToCurrencyString(x * stateBet.betAmount)));

	const SYMBOL_META: Record<string, { name: string; color: string; kind: 'premium' | 'mid' | 'low' }> = {
		H1: { name: config.symbols.H1.name, color: '#e2b648', kind: 'premium' },
		M3: { name: config.symbols.M3.name, color: '#c49e4a', kind: 'mid' },
		M2: { name: config.symbols.M2.name, color: '#967884', kind: 'mid' },
		M1: { name: config.symbols.M1.name, color: '#7692b0', kind: 'mid' },
		L4: { name: config.symbols.L4.name, color: '#2eb0a8', kind: 'low' },
		L3: { name: config.symbols.L3.name, color: '#6c8a7a', kind: 'low' },
		L2: { name: config.symbols.L2.name, color: '#c4bcaa', kind: 'low' },
		L1: { name: config.symbols.L1.name, color: '#8d939a', kind: 'low' },
	};
	// worst-paying first in the config, best first on screen
	const paying = [...config.payOrder];
	// symbol art thumbnails (static/assets/tiles/, emitted by tools/make_placeholders.py)
	const tileSrc = (code: string) => stamp(`/assets/tiles/${code.toLowerCase()}.webp`);
	/** the five cluster-size bands, in base-bet multiples (config.paytableBands) */
	const pays = (sym: string) => [...(config.symbols[sym as keyof typeof config.symbols].paytable ?? [])] as number[];
	const social = $derived(stateUrlDerived.social());
	const payText = (mult: number) => (social ? `${mult}×` : numberToCurrencyString(mult * stateBet.betAmount));

	// the Wild and the scatter, described once under Special Symbols (the Wild row at the foot of the pay grid is gone:
	// the same symbol was shown twice, eight lines apart; rules trim, Corey 2026-10-13)
	const SPECIALS = $derived([
		{ glyph: 'W', name: config.symbols.W.name, color: '#e2b648', note: T.paytable.wild },
		{ glyph: 'S', name: config.symbols.S.name, color: '#b02c2c', note: T.paytable.scatter },
	]);

	// the cap is a base-bet multiple in every mode; a mode's ceiling against its own price is what a
	// player (and a reviewer) needs to see: 10,000x of a 3x Ante spin is 3,333.3x the price. One decimal at most,
	// thousands separated like the cap itself ("3,333.3", "1,000")
	const capPerPrice = (cost: number) => (config.maxWin / cost).toLocaleString('en-US', { maximumFractionDigits: 1 });
	const MAX_WIN = config.maxWin.toLocaleString('en-US');
	const MODE_STYLE: { id: keyof typeof config.betModes; accent: string; rgs: string }[] = [
		{ id: 'base', accent: '#eef0f6', rgs: 'BASE' },
		{ id: 'ante', accent: '#e0b64a', rgs: 'ANTE' },
		{ id: 'super_ante', accent: '#e08a3c', rgs: 'SUPER_ANTE' },
		{ id: 'bonus', accent: '#2eb0a8', rgs: 'BONUS' },
		{ id: 'super', accent: '#7fb6ff', rgs: 'SUPER' },
		{ id: 'epic', accent: '#ff6a4a', rgs: 'EPIC' },
		{ id: 'mystery', accent: '#b07fe0', rgs: 'MYSTERY' },
	];
	// RTP per mode from the published math (Stake wants it per mode, the seven cell grid stays: Corey 2026-10-13)
	const MODES = $derived(
		MODE_STYLE.map((m) => ({
			...m,
			label: MODE_NAMES[m.id],
			costNum: modeCost(m.rgs),
			cost: `${modeCost(m.rgs)}\u00d7`,
			rtp: pct(config.betModes[m.id].rtp),
			...T.modes.cards[m.id],
		})),
	);

	// UI guide (submission checklist "User interaction guide is included in the game information"):
	// one control per row: the same icon the chrome draws, the name, what a press does (text: gameInfoText.ts)
	type IconName = ComponentProps<typeof Icon>['name'];
	const GUIDE_ICONS: { id: GuideId; icon: IconName }[] = [
		{ id: 'spin', icon: 'play' },
		{ id: 'turbo', icon: 'turbo' },
		{ id: 'autoplay', icon: 'auto' },
		{ id: 'feature', icon: 'polymath' },
		{ id: 'menu', icon: 'menu' },
		{ id: 'readouts', icon: 'info' },
		{ id: 'keyboard', icon: 'chevronRight' },
		// the SKIP button's own glyph (components/SkipButton.svelte, 2026-10-13: the press opens a prompt first)
		{ id: 'skip', icon: 'skip' },
		{ id: 'screens', icon: 'stop' },
	];
	// Stake's jurisdiction switches: where the operator disables the slam stop or turbo there is no SKIP (stateGame
	// skipAllowed), so the guide does not describe one
	const GUIDE = $derived(GUIDE_ICONS.filter((g) => g.id !== 'skip' || skipAllowed()).map((g) => ({ ...g, color: '#ffdc4a', ...T.guide.rows[g.id] })));

	let active = $state('paytable');
	let contentEl: HTMLDivElement | undefined = $state();
	let navEl: HTMLDivElement | undefined = $state();
	const sectionEls: Record<string, HTMLElement> = {};

	// section offsets are measured against the scrolling content box, not the panel — the
	// panel is the offsetParent, so a raw offsetTop carries the head + tab strip and every jump
	// overshot the section heading by that much (caught on the UI Guide tab, 2026-09-02)
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
	$effect(() => {
		if (!navEl) return;
		const tab = navEl.querySelector(`[data-tab="${active}"]`) as HTMLElement | null;
		tab?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
	});

	const pad = $derived(short ? 10 : dense ? 14 : 28);
	// body copy never goes under 12 CSS px, tabs never under 10, tiles never under 40
	const bodySize = $derived(dense ? 12.5 : 13.5);
	const tabSize = $derived(lowHead ? 10 : dense ? 10.5 : 11);
	const tileSize = $derived(short ? 40 : dense ? 48 : 64);
	const iconBox = $derived(short ? 34 : dense ? 40 : 48);
	// TYPE SCALE of a mode card (Corey 2026-10-15): the mode name biggest (20 / 16.5), then the stat values, the body at
	// its size, the labels small and quiet (10.5 px, --label)
	const statSize = $derived(dense ? 15 : 17);

	// PAYTABLE FIT (Engine self-check [24], 2026-10-09). Five pays beside the symbol name do not fit a
	// narrow window: at 400 / 425 px the "15+" column sat off the right edge at a $1 bet, and "MX$" or
	// a top bet pushed it off wider ones. So the row is MEASURED (game/textFit.ts, one metrics call per
	// bet / currency / size change, never per frame): when the widest pay of the table at the nominal
	// size leaves no room for the name, the pays move to their own line under the symbol (`stack`), in
	// five equal columns; if five would take the type under PAY_COMFORT they fold to three (3 + 2). The
	// type shrinks only as a last resort and never under PAY_FLOOR. Nothing is clipped, abbreviated or
	// scrolled sideways. The geometry mirrors the CSS below (.row padding / gap, section max-width).
	const PAY_FONT = 16; // .pay-v nominal
	const PAY_COMFORT = 12;
	const PAY_FLOOR = 9;
	const PAY_GAP = 14; // .pays gap beside the name
	const PAY_STACK_GAP = 8; // .row.stack .pays column gap
	const PAY_MIN = 44; // .pay min-width
	const ROW_NAME_MIN = 150; // what the symbol name needs beside the pays ("PERSIAN HELMET")
	// widest pay string of the whole table at the nominal size, plus 4% for the canvas / DOM difference
	const widestPay = $derived(Math.max(...paying.flatMap((sym) => pays(sym).map((p) => measureFitText(payText(p), PAY_FONT, 700)))) * 1.04);
	// inside one .row: the reading column (section max-width 880) less the scrollbar, the row's padding and border
	const rowInner = $derived(Math.min(880, vw - 2 * pad - 12) - 2 * 12 - 2);
	// THE MULTIPLIER TILE LADDER (Corey 2026-10-15 10:09: the tiles as the game draws them, tools/manticore/
	// rules_tiles_capture.js, 192 px = 64 CSS px at 3x). Seven square tiles with an arrow after each but the last; one row
	// when it fits the reading column, else 4 + 3 (the 4th arrow ends the first row). Mirrors .ladder's CSS (step gap 6).
	const LADDER_STEP = 14 + 2 * 6; // .ladder-arrow width + the gaps either side of it
	const ladderTile = $derived(short ? 40 : dense ? 56 : 64);
	const ladderSplit = $derived(7 * ladderTile + 6 * LADDER_STEP > Math.min(880, vw - 2 * pad - 12));
	const payBands = config.paytableBands.length;
	const stack = $derived(payBands * Math.max(PAY_MIN, widestPay) + (payBands - 1) * PAY_GAP > rowInner - tileSize - 14 - ROW_NAME_MIN - 14);
	const stackFont = (cols: number) => Math.min(PAY_FONT, (PAY_FONT * ((rowInner - (cols - 1) * PAY_STACK_GAP) / cols - 2)) / widestPay);
	const payCols = $derived(stackFont(payBands) >= PAY_COMFORT ? payBands : 3);
	const payFont = $derived(stack ? Math.max(PAY_FLOOR, Math.floor(stackFont(payCols) * 10) / 10) : PAY_FONT);
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
				<!-- ONE column, always: five cluster-size bands per row need the full reading width.
				     Angry Mantis fitted two columns because it only had three "of a kind" cells. -->
				<div class="pay-grid" style:grid-template-columns="1fr">
					{#each paying as sym (sym)}
						{@const meta = SYMBOL_META[sym]}
						<div class="row" class:stack>
							<img class="tile" src={tileSrc(sym)} alt={meta.name} style:width="{tileSize}px" style:height="{tileSize}px" />
							<div class="row-main">
								<div class="row-name" style:color={meta.color} style:font-size="{dense ? 12.5 : 14}px">{meta.name}</div>
								<div class="row-kind">{meta.kind === 'premium' ? 'Premium' : meta.kind === 'mid' ? 'Mid' : 'Low'}</div>
							</div>
							<div class="pays" style:grid-template-columns={stack ? `repeat(${payCols}, minmax(0, 1fr))` : null}>
								{#each pays(sym) as p, i}
									<div class="pay"><div class="pay-k">{config.paytableBands[i].label}</div><div class="slot-num pay-v" style:font-size="{payFont}px">{payText(p)}</div></div>
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
							<img class="tile" src={tileSrc(s.glyph)} alt={s.name} style:width="{tileSize}px" style:height="{tileSize}px" />
							<div class="row-main">
								<div class="row-name" style:color={s.color}>{s.name}</div>
								<div class="note">{@render rich(s.note)}</div>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section bind:this={sectionEls.guide}>
				<h2>User Interface Guide</h2>
				<p>{T.guide.intro}</p>
				<div class="guide">
					{#each GUIDE as g (g.id)}
						<div class="guide-row">
							<div class="guide-icon" style:color={g.color} style:width="{iconBox}px" style:height="{iconBox}px">
								<Icon name={g.icon} s={iconBox * 0.46} />
							</div>
							<div class="guide-text">
								<div class="guide-name" style:font-size="{dense ? 13 : 15}px">{g.name}</div>
								<div class="v">{@render rich(g.text)}</div>
							</div>
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
								<!-- the three stat tiles (Corey 2026-10-15): a quiet label, the value big, a small line under it -->
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
										<div class="slot-num stat-v" style:font-size="{statSize}px">{MAX_WIN}×</div>
										{#if m.costNum > 1}<div class="stat-sub">({capPerPrice(m.costNum)}× {T.modes.stats.thisMode})</div>{/if}
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

			<section bind:this={sectionEls.mystery}>
				<h2>Mystery Disclosure</h2>
				<div class="callout gold">
					{#each T.mystery as p}<p>{@render rich(p)}</p>{/each}
				</div>
			</section>

			<section bind:this={sectionEls.tiles}>
				<h2>Multiplier Tiles</h2>
				<p>{@render rich(T.tiles.intro)}</p>
				<div class="ladder" style:--ladder-tile="{ladderTile}px">
					{#each [2, 4, 8, 16, 32, 64, 128] as value, i (value)}
						<div class="ladder-step">
							<img class="tile" src={stamp(`/assets/tiles/x${value}.webp`)} alt="{value} times" />
							{#if i < 6}<div class="ladder-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg></div>{/if}
						</div>
						{#if i === 3 && ladderSplit}<div class="ladder-break" aria-hidden="true"></div>{/if}
					{/each}
				</div>
				<ul>
					{#each T.tiles.rules as li}<li>{@render rich(li)}</li>{/each}
				</ul>
				<div class="subhead">{T.tiles.manticore}</div>
				<ul>
					{#each T.tiles.creature as li}<li>{@render rich(li)}</li>{/each}
				</ul>
			</section>

			<section bind:this={sectionEls.maxwin}>
				<h2>Max Win and RTP</h2>
				<div class="callout red">
					<div class="maxwin-line"><span class="slot-num maxwin" style:font-size="{short ? 20 : dense ? 22 : 36}px">{config.maxWin.toLocaleString()}×</span><span class="dim">{T.maxWin.unit}</span></div>
					<p>{@render rich(T.maxWin.text)}</p>
				</div>
				<div class="subhead">{T.maxWin.rtpHead}</div>
				<div class="rtp-grid" style:grid-template-columns={narrow ? '1fr 1fr' : 'repeat(5, 1fr)'}>
					{#each MODES as m (m.id)}
						<div class="rtp-cell">
							<div class="rtp-k" style:color={m.accent}>{m.label}</div>
							<div class="slot-num rtp-v" style:font-size="{dense ? 18 : 22}px">{m.rtp}</div>
						</div>
					{/each}
				</div>
				<p>{@render rich(T.maxWin.rtp)}</p>
				<div class="subhead">{T.maxWin.volHead}</div>
				<div class="vol"><span class="slot-num vol-label" style:font-size="{dense ? 16 : 20}px">EXTREME</span><div class="meter">{#each [1, 2, 3, 4, 5] as i}<div class="seg on"></div>{/each}</div></div>
				<p>{@render rich(T.maxWin.volatility)}</p>
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
		--green: #9cd92f;
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
		font-weight: 900;
		letter-spacing: 5px;
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
	/* tab strip: underlined text, gold on the active one — eleven fit in one row on desktop, scroll on portrait */
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
	.mono {
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
	/* cells sized up 2026-09-15 (Corey): 64px tiles, larger names and pays — the 44px thumbnails
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
		border-radius: 9px;
		flex-shrink: 0;
		display: block;
	}
	/* the multiplier tile ladder: square whole-cell tiles as on the board (half a frame bar round each), arrows centred */
	.ladder {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px 6px;
		margin-top: 4px;
	}
	.ladder-step {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.ladder .tile {
		width: var(--ladder-tile);
		height: var(--ladder-tile);
		border-radius: 3px;
	}
	.ladder-arrow {
		display: flex;
		width: 14px;
		color: var(--faint);
	}
	.ladder-break {
		flex-basis: 100%;
		height: 0;
	}
	.leaf-stack {
		position: relative;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
	}
	.leaf-stack img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border-radius: 10px;
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
	/* PAYTABLE FIT: the pays on their own line under the symbol, in equal columns (see `stack` above) */
	.row.stack {
		flex-wrap: wrap;
		row-gap: 8px;
	}
	.row.stack .pays {
		flex: 1 1 100%;
		display: grid;
		gap: 6px 8px;
	}
	.row.stack .pay {
		min-width: 0;
		text-align: center;
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
	.guide {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.guide-row {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid var(--rule);
	}
	.guide-icon {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9px;
		background: var(--well);
	}
	.guide-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.guide-name {
		font-family: var(--ui-font);
		font-weight: 800;
		letter-spacing: 1.5px;
		color: var(--ink);
		text-transform: uppercase;
		margin-top: 3px;
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
	.callout.gold {
		border-color: rgba(255, 220, 74, 0.45);
		background: rgba(255, 220, 74, 0.06);
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
	.vol {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 8px;
	}
	.vol-label {
		font-weight: 700;
		letter-spacing: 2px;
		color: var(--ui-red);
	}
	.meter {
		display: flex;
		gap: 4px;
	}
	.seg {
		width: 30px;
		height: 10px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.1);
	}
	.seg.on {
		background: var(--ui-red);
	}
</style>
