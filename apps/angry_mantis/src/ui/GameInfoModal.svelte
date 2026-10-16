<script lang="ts">
	// Game Info: sticky tab strip + scroll-spied sections. Stake Engine requires full feature
	// disclosure here — paytable, modes, Feast floor/max-win odds, max win, RTP, volatility, and the
	// verbatim rules disclaimer (gameInfoText.ts). All numbers come from config / the math run.
	//
	// READABILITY (1.0.13, the standard since Manticore's Build B2 of 2026-10-14): body copy (paragraphs, list items,
	// card text, notes) in the real variable Outfit at 400 ('Outfit Text', ui/fontFaces.ts) with bold keywords at 700;
	// headings, names and labels keep the HUD's heavy Outfit. Layout, sizes and colours are unchanged. The HUD is untouched.
	import type { ComponentProps } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateBet, stateModal, stateUrlDerived, stateConfig } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import Icon from './Icon.svelte';
	import config from '../game/config';
	import { soc } from '../game/social';
	import { stamp } from '../game/assets';
	import { DISCLAIMER, rulesSections, guideRowShown, andList, type GuideId } from '../game/gameInfoText';
	import { modeCost } from '../game/betModeMeta';
	import { measureFitText, UI_TEXT_FACE } from '../game/textFit';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { master, scale, left, top, compact = false }: Props = $props();
	// `compact` is the LAYOUT KIND (any non-landscape chrome). That was the wrong gate for type
	// size (Stake review 2026-09-20, FIX 6): Stake's Popout S is a 400x225 iframe that resolves to
	// the phone kind, so it took the phone's compact sizes — and, before FIX 5, saw them scaled by
	// 0.27 on top. The shell is the viewport now, so gate on the REAL window instead: `narrow` is
	// what the reading column can afford, `short` is a viewport with no vertical room. Minimum
	// sizes below are CSS px and never drop under 10.
	const vw = $derived(innerWidth.current ?? 1280);
	const vh = $derived(innerHeight.current ?? 720);
	const narrow = $derived(vw < 720);
	const short = $derived(vh < 340);
	const dense = $derived(narrow || short);

	const open = $derived(stateModal.modal?.name === 'gameRules' || stateModal.modal?.name === 'payTable');
	const close = () => (stateModal.modal = null);

	const SECTIONS = [
		{ id: 'paytable', label: soc('Paytable', 'Symbols') },
		{ id: 'guide', label: 'UI Guide' },
		{ id: 'ways', label: 'Ways' },
		{ id: 'modes', label: 'Game Modes' },
		{ id: 'mystery', label: 'Mystery Disclosure' },
		{ id: 'eating', label: 'Eating Mechanic' },
		{ id: 'maxwin', label: 'Max Win' },
		{ id: 'rtp', label: 'RTP' },
		{ id: 'volatility', label: 'Volatility' },
		{ id: 'rules', label: 'Rules' },
		{ id: 'version', label: 'Version' },
	];

	const SYMBOL_META: Record<string, { name: string; color: string; kind: 'premium' | 'mid' | 'low' }> = {
		H1: { name: 'Marty', color: '#ffdc4a', kind: 'premium' },
		M1: { name: 'Beetle', color: '#ff8a70', kind: 'mid' },
		M2: { name: 'Spider', color: '#9cd92f', kind: 'mid' },
		M3: { name: 'Scorpion', color: '#7fb6ff', kind: 'mid' },
		L1: { name: 'Lightning Bug', color: '#eef0f6', kind: 'low' },
		L2: { name: 'Fly', color: '#eef0f6', kind: 'low' },
		L3: { name: 'Moth', color: '#eef0f6', kind: 'low' },
		L4: { name: 'Caterpillar', color: '#eef0f6', kind: 'low' },
	};
	const paying = [...config.eatOrder].reverse();
	// real symbol art thumbnails (static/assets/tiles/, emitted by make_placeholders.py)
	const tileSrc = (code: string) => stamp(`/assets/tiles/${code.toLowerCase()}.webp`);
	const pays = (sym: string) => {
		const table = config.symbols[sym as keyof typeof config.symbols].paytable as readonly Record<string, number>[] | null;
		const map: Record<string, number> = {};
		table?.forEach((entry) => Object.entries(entry).forEach(([k, v]) => (map[k] = v)));
		return ['3', '4', '5'].map((k) => map[k] ?? 0);
	};
	const social = $derived(stateUrlDerived.social());
	const payText = (mult: number) => (social ? `${mult}×` : numberToCurrencyString(mult * stateBet.betAmount));

	// the operator's switches (authenticate's jurisdiction block, the flags the controls read): the rules name no
	// control the operator turned off (gameInfoText.ts RulesFlags)
	const J = $derived(stateConfig.jurisdiction);
	const RULES_SECTIONS = $derived(rulesSections(J));

	const SPECIALS = [
		{ glyph: 'W', name: 'Wild', color: '#ffdc4a', note: soc('Substitutes for every paying symbol. Never lands on reel 1. Does not substitute for Marky scatters or Service Bells.', 'Substitutes for every menu symbol. Never lands on reel 1. Does not substitute for Marky scatters or Service Bells.') },
		{ glyph: 'S', name: 'Marky Scatter', color: '#ff8a70', note: `3 / 4 / 5 anywhere trigger Free Spins / Super Free Spins / Mantis Feast. In free spins each scatter adds +1 spin (up to +${config.freeSpins.maxRetrigger} per session); once the cap is reached scatters stop appearing.` },
		{ glyph: 'GL', name: 'Service Bell', color: '#e0b860', note: soc('Free spins only. Each Service Bell that lands rings for a Mantis Strike: the lowest-paying symbol still on the menu is served up and eaten.', 'Free spins only. Each Service Bell that lands rings for a Mantis Strike: the lowest-value symbol still on the menu is served up and eaten.') },
	];

	// the cap is a base-bet multiple in every mode; a mode's ceiling against its own price is what a
	// player (and a reviewer) needs to see — 20,000x of a 300x Mystery Spin is 66.7x the price
	const capPerPrice = (cost: number) => {
		const x = config.maxWin / cost;
		return Number.isInteger(x) ? x.toLocaleString() : x.toFixed(1).replace(/\.0$/, '');
	};
	const MODES = [
		{ id: 'base', label: 'Base Game', accent: '#eef0f6', cost: `${modeCost('BASE')}×`, costNum: modeCost('BASE'), enter: 'Default play.', spins: 'One spin per play.', mech: 'Standard 1,024 ways evaluation. 3, 4 or 5 Marky scatters trigger Free Spins, Super Free Spins or Mantis Feast.' },
		{ id: 'ante', label: 'Ante', accent: '#ffdc4a', cost: `${modeCost('ANTE')}×`, costNum: modeCost('ANTE'), enter: soc('Switch on from the Bonus Buy menu; stays on until switched off.', 'Switch on from the Feature Menu; stays on until switched off.'), spins: 'One spin per play.', mech: soc('Triples the cost of each spin. A Marky scatter is locked onto reel 1 every spin, so only two more are needed for a feature; features land about four times as often as in the base game. Cannot be combined with a direct bonus buy.', 'Triples the play amount for each spin. A Marky scatter is locked onto reel 1 every spin, so only two more are needed for a feature; features land about four times as often as in the base game. Cannot be combined with an instantly triggered feature.') },
		{ id: 'bonus', label: 'Free Spins', accent: '#9cd92f', cost: `${modeCost('BONUS')}×`, costNum: modeCost('BONUS'), enter: soc('Land 3 Marky scatters, or buy directly.', 'Land 3 Marky scatters, or trigger it instantly from the feature menu.'), spins: `${config.freeSpins.free} Free Spins.`, mech: soc('Marty hosts. An opening bite eats the lowest-paying symbol for the rest of the session; every Service Bell that lands rings for another strike.', 'Marty hosts. An opening bite eats the lowest-value symbol for the rest of the session; every Service Bell that lands rings for another strike.') },
		{ id: 'super', label: 'Super Free Spins', accent: '#ff8a70', cost: `${modeCost('SUPER')}×`, costNum: modeCost('SUPER'), enter: soc('Land 4 Marky scatters, or buy directly.', 'Land 4 Marky scatters, or trigger it instantly from the feature menu.'), spins: `${config.freeSpins.super} Free Spins.`, mech: 'Marky hosts on reels with more Service Bells, so symbols are eaten faster and wins escalate sooner.' },
		{ id: 'feast', label: 'Mantis Feast', accent: '#ffdc4a', cost: 'Not offered directly', costNum: 0, enter: soc('Land 5 Marky scatters, or win it inside a Mystery Spin.', 'Land 5 Marky scatters, or win it inside a Mystery spin.'), spins: `${config.freeSpins.feast} Free Spins.`, mech: soc(`Marty AND Marky feed: two opening bites, and both mantises strike. Every Mantis Feast session pays at least ${config.feastMinWin}× the bet.`, `Marty AND Marky feed: two opening bites, and both mantises strike. Every Mantis Feast session wins at least ${config.feastMinWin}× the play amount.`) },
		{ id: 'mystery', label: 'Mystery Spin', accent: '#7fb6ff', cost: `${modeCost('MYSTERY')}×`, costNum: modeCost('MYSTERY'), enter: soc('Buy from the bonus menu.', 'Trigger from the feature menu.'), spins: 'One spin, then whatever it serves.', mech: `The reels spin once. ${config.mystery.nothing * 100}% of Mystery Spins land nothing, ${config.mystery.super * 100}% land 4 Marky scatters for Super Free Spins and ${config.mystery.feast * 100}% land 5 for the Mantis Feast. The split is fixed in the published math.` },
	];

	// UI guide (submission checklist "User interaction guide is included in the game information"):
	// one control per row — the same icon the chrome draws, the name, what a press does
	type IconName = ComponentProps<typeof Icon>['name'];
	type GuideRow = { id: GuideId; icon: IconName | null; art?: string; color: string; name: string; text: string };
	// every sentence that names a control the operator can switch off is said only where it is on (gameInfoText.ts
	// RulesFlags; Manticore 2026-10-15). STOP lands the result at once only with the slam stop AND turbo allowed
	// (under disabledTurbo the press lands nothing sooner: ui/controls.svelte.ts stopButtonClick).
	const GUIDE_ALL = $derived<GuideRow[]>([
		{
			id: 'spin',
			icon: 'play',
			color: '#ffdc4a',
			name: 'Spin',
			text: [
				'Plays one round at the SPIN amount.',
				!J.disabledSlamstop && !J.disabledTurbo ? 'While the reels drop the button turns into STOP, which lands the result at once.' : '',
				((x) => (x ? `With ${x} loaded, the button shows what the next press starts.` : ''))([!J.disabledAutoplay ? 'Autoplay' : '', !J.disabledBuyFeature ? 'a feature' : ''].filter(Boolean).join(' or ')),
			]
				.filter(Boolean)
				.join(' '),
		},
		{
			id: 'turbo',
			icon: 'turbo',
			color: '#ffdc4a',
			name: 'Turbo',
			// disabledSuperTurbo: no Instant level (ui/controls.svelte.ts maxTurboLevel)
			text: J.disabledSuperTurbo
				? 'Switches between Off and Turbo. Turbo shortens the reel drop and the win presentation. The turbo setting and the sound settings are remembered on this device.'
				: 'Cycles through Off, Turbo and Instant. Turbo shortens the reel drop and the win presentation; Instant (lightning icon) lands each result immediately. The turbo setting and the sound settings are remembered on this device.',
		},
		{ id: 'autoplay', icon: 'auto', color: '#ffdc4a', name: 'Autoplay', text: 'Opens the Autoplay ticket: number of spins, plus an ADVANCED fold with a stop-on-loss limit, a stop-on-single-win limit, Stop on Free Games (autoplay ends when a feature triggers; the feature still plays out) and Autoplay Bonuses (feature screens continue on their own). LOAD parks the run on the Spin button; pressing Spin starts it and pressing again stops it. While a run is active the Spin button turns green with the spins left and this button turns red with an X.' },
		{ id: 'feature', icon: 'polymath', color: '#ffdc4a', name: soc('Bonus Buy', 'Feature Menu'), text: soc('Opens the Chow Line: switch Ante Bet on, or buy Free Spins, Super Free Spins or a Mystery Spin directly. A loaded feature is shown on the Spin button and on this button by name (ANTE, BONUS, SUPER or MYSTERY); tap the button again to cancel it.', 'Opens the Chow Line: switch Ante Mode on, or trigger Free Spins, Super Free Spins or a Mystery spin instantly. A loaded feature is shown on the Spin button and on this button by name (ANTE, BONUS, SUPER or MYSTERY); tap the button again to cancel it.') },
		{ id: 'menu', icon: 'menu', color: '#ffdc4a', name: 'Menu', text: 'Game Info (this screen) plus separate music and sound-effect volume sliders with mute buttons.' },
		{ id: 'readouts', icon: 'info', color: '#ffdc4a', name: 'Readouts', text: soc('BALANCE is your current balance. WIN is the running total of the current round. SPIN is the full cost of one press in the active mode (base bet × the mode multiplier). The − and + beside it step through the bet menu, and tapping the readout opens the full bet picker. The plaque on the reel frame names the active mode and its price.', 'BALANCE is your current balance. WIN is the running total of the current round. SPIN is the full play amount of one press in the active mode (base amount × the mode multiplier). The − and + beside it step through the play amount menu, and tapping the readout opens the full picker. The plaque on the reel frame names the active mode and its play amount.') },
		{
			id: 'keyboard',
			icon: 'chevronRight',
			color: '#ffdc4a',
			name: 'Keyboard',
			// disabledSpacebar: the Space bar plays nothing (ui/Chrome.svelte), so only Escape is left
			text: [
				J.disabledSpacebar
					? ''
					: ((x) => (x ? `Space bar plays a round; hold it to keep playing (${x} ${x.includes(' and ') ? 'are' : 'is'} locked while it is held).` : 'Space bar plays a round; hold it to keep playing.'))(
							andList([!J.disabledTurbo ? 'Turbo' : '', !J.disabledAutoplay ? 'Autoplay' : ''].filter(Boolean)),
						),
				'Escape closes any open window.',
			]
				.filter(Boolean)
				.join(' '),
		},
		// THE SKIP BUTTON (1.0.13, Manticore's wording with this game's feature names). The row is left out where the
		// operator disables the slam stop or turbo (stateGame skipAllowed; guideRowShown)
		{ id: 'skip', icon: 'skip', color: '#ffdc4a', name: 'Skip to Result', text: 'Shown during Free Spins, Super Free Spins and Mantis Feast once the first free spin has started. Pressing it asks "Skip to result?". Yes ends the presentation of the remaining spins and shows the final total of the round. No closes the question and the spins play on. It never changes the result.' },
		// Autoplay Bonuses is a setting of the Autoplay ticket: not named under disabledAutoplay
		{ id: 'screens', icon: 'stop', color: '#ffdc4a', name: 'Feature screens', text: J.disabledAutoplay ? 'Feature intros and wrap-ups wait for a press anywhere.' : 'Feature intros and wrap-ups wait for a press anywhere. Autoplay Bonuses in the Autoplay ticket lets those screens continue on their own.' },
	]);
	// Stake's jurisdiction switches: a control the operator turns off has no row (gameInfoText.ts guideRowShown)
	const GUIDE = $derived(GUIDE_ALL.filter((g) => guideRowShown(g.id, J)));

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
	const tabSize = $derived(short ? 10 : dense ? 10.5 : 11);
	const tileSize = $derived(short ? 40 : dense ? 48 : 64);
	const iconBox = $derived(short ? 34 : dense ? 40 : 48);

	// PAYTABLE FIT (Manticore's fix of 2026-10-09, Engine self-check [24], ported for 1.0.13). Three pays beside the
	// symbol name did not fit everywhere: in MXN ("MX$" and the thousands) the "5 of a kind" column sat off the
	// right edge at 400 / 425 px and in the two-column grid at 800 px. So the row is MEASURED (game/textFit.ts, one
	// metrics call per bet / currency / size change, never per frame): the two-column grid is kept only where every
	// row still fits its pays beside the name; otherwise the rows take the whole column, and where even that leaves
	// no room the pays move to their own line under the symbol (`stack`) in three equal columns. The type shrinks
	// only as a last resort and never under PAY_FLOOR. Nothing is clipped, abbreviated or scrolled sideways. The
	// geometry mirrors the CSS below (.row padding / gap, .pays gap, section max-width, .pay-grid gap).
	const PAY_FONT = 16; // .pay-v nominal
	const PAY_FLOOR = 9;
	const PAY_GAP = 14; // .pays gap beside the name
	const PAY_STACK_GAP = 8; // .row.stack .pays column gap
	const PAY_MIN = 44; // .pay min-width
	const PAY_BANDS = 3; // 3, 4 and 5 of a kind
	// widest pay string of the whole table at the nominal size, plus 4% for the canvas / DOM difference
	const widestPay = $derived(Math.max(...paying.flatMap((sym) => pays(sym).map((p) => measureFitText(payText(p), PAY_FONT, 700)))) * 1.04);
	// the name may wrap between words, never inside one: the room it needs is its longest word (.row-name)
	const nameSize = $derived(dense ? 12.5 : 14);
	const nameMin = $derived(Math.max(...paying.flatMap((sym) => SYMBOL_META[sym].name.toUpperCase().split(' ').map((w) => measureFitText(w, nameSize, 800, 1.5, UI_TEXT_FACE)))) * 1.04);
	// inside one .row with `cols` grid columns: the reading column (section max-width 880) less the scrollbar, the
	// grid gap, the row's padding and border
	const rowInner = (cols: number) => (Math.min(880, vw - 2 * pad - 12) - (cols - 1) * 8) / cols - 2 * 12 - 2;
	const fits = (cols: number) => PAY_BANDS * Math.max(PAY_MIN, widestPay) + (PAY_BANDS - 1) * PAY_GAP <= rowInner(cols) - tileSize - 14 - nameMin - 14;
	const payCols = $derived(!narrow && fits(2) ? 2 : 1);
	const stack = $derived(payCols === 1 && !fits(1));
	const stackFont = $derived(Math.min(PAY_FONT, (PAY_FONT * ((rowInner(1) - (PAY_BANDS - 1) * PAY_STACK_GAP) / PAY_BANDS - 2)) / widestPay));
	const payFont = $derived(stack ? Math.max(PAY_FLOOR, Math.floor(stackFont * 10) / 10) : PAY_FONT);
</script>

<ModalShell {open} onclose={close} {master} {scale} {left} {top} dim="rgba(6,4,10,0.72)" zIndex={5}>
	<!-- full screen: no margin, no radius — the glass IS the page (Black Glass Panels, 2026-09-09) -->
	<div class="panel" onclick={(e) => e.stopPropagation()} role="presentation">
		<div class="head" style:padding="{short ? 8 : dense ? 12 : 14}px {pad}px">
			<div class="h-title am-stencil" style:font-size="{short ? 14 : dense ? 17 : 22}px">GAME INFO</div>
			<button class="slot-btn x" onclick={close} style:width="{short ? 30 : 40}px" style:height="{short ? 30 : 40}px" aria-label="Close"><Icon name="close" s={short ? 14 : dense ? 16 : 18} /></button>
		</div>

		<div class="tabs" bind:this={navEl} style:padding="4px {pad - 8}px">
			{#each SECTIONS as s (s.id)}
				<button class="slot-btn tab" class:on={active === s.id} data-tab={s.id} onclick={() => jump(s.id)} style:padding={short ? '7px 8px 6px' : dense ? '9px 9px 8px' : '10px 12px 9px'} style:font-size="{tabSize}px">{s.label}</button>
			{/each}
		</div>

		<div class="content" bind:this={contentEl} onscroll={onScroll} style:padding="{short ? 12 : dense ? 16 : 22}px {pad}px 40px" style:gap="{short ? 16 : dense ? 22 : 30}px" style:font-size="{bodySize}px">
			<section bind:this={sectionEls.paytable}>
				<h2>{soc('Paytable', 'Symbols')}</h2>
				<p>{soc('Pays per way for 3, 4 and 5 of a kind, multiplied by the number of matching ways. Wins pay left to right on adjacent reels starting from reel 1.', 'Wins per way for 3, 4 and 5 of a kind, multiplied by the number of matching ways. Wins form left to right on adjacent reels starting from reel 1.')} {soc('Only the highest win per symbol is paid. Base game wins are capped at 250× the bet per spin.', 'Only the highest win per symbol counts. A single base game spin never wins more than 250× the play amount.')}</p>
				<div class="pay-grid" style:grid-template-columns={payCols === 1 ? '1fr' : 'repeat(2, minmax(0,1fr))'}>
					{#each paying as sym (sym)}
						{@const meta = SYMBOL_META[sym]}
						<div class="row" class:stack>
							<img class="tile" src={tileSrc(sym)} alt={meta.name} style:width="{tileSize}px" style:height="{tileSize}px" />
							<div class="row-main">
								<div class="row-name" style:color={meta.color} style:font-size="{dense ? 12.5 : 14}px">{meta.name}</div>
								<div class="row-kind">{meta.kind === 'premium' ? 'Premium' : meta.kind === 'mid' ? 'Mid' : 'Low'}</div>
							</div>
							<div class="pays" style:grid-template-columns={stack ? `repeat(${PAY_BANDS}, minmax(0, 1fr))` : null}>
								{#each pays(sym) as p, i}
									<div class="pay"><div class="pay-k">{3 + i} of a kind</div><div class="slot-num pay-v" style:font-size="{payFont}px">{payText(p)}</div></div>
								{/each}
							</div>
						</div>
					{/each}
					<!-- Wild sits in the paytable grid per convention: its own tile, no pay values —
					     it has no paytable of its own, only the substitution rule as its caption -->
					<div class="row">
						<img class="tile" src={tileSrc('W')} alt="Wild" style:width="{tileSize}px" style:height="{tileSize}px" />
						<div class="row-main">
							<div class="row-name" style:color="#ffdc4a">Wild</div>
							<div class="row-kind">Substitutes for all menu symbols</div>
						</div>
					</div>
				</div>
				<div class="tear"></div>
				<div class="subhead">Special Symbols</div>
				<div class="pay-grid" style:grid-template-columns="1fr">
					{#each SPECIALS as s (s.glyph)}
						<div class="row top">
							<img class="tile" src={tileSrc(s.glyph)} alt={s.name} style:width="{tileSize}px" style:height="{tileSize}px" />
							<div class="row-main">
								<div class="row-name" style:color={s.color}>{s.name}</div>
								<div class="note">{s.note}</div>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section bind:this={sectionEls.guide}>
				<h2>User Interface Guide</h2>
				<p>{soc('Every control on the screen, what it does, and how the readouts are calculated. Controls are the same on desktop and phone; on portrait phones they sit under the reels.', 'Every control on the screen, what it does, and how the readouts are calculated. Controls are the same on desktop and phone; on portrait phones they sit under the reels.')}</p>
				<div class="guide">
					{#each GUIDE as g (g.name)}
						<div class="guide-row">
							<div class="guide-icon" style:color={g.color} style:width="{iconBox}px" style:height="{iconBox}px">
								{#if g.art}<img src={stamp(g.art)} alt="" style:width="{iconBox * 0.75}px" draggable="false" />{:else if g.icon}<Icon name={g.icon} s={iconBox * 0.46} />{/if}
							</div>
							<div class="guide-text">
								<div class="guide-name" style:font-size="{dense ? 13 : 15}px">{g.name}</div>
								<div class="v">{g.text}</div>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section bind:this={sectionEls.ways}>
				<h2>Ways Structure</h2>
				<p><strong>1,024 ways.</strong> 5 reels × 4 rows. Wins evaluate left to right from reel 1 on any row. Matching symbol counts on each consecutive reel multiply together; different symbols' wins add up within a spin.</p>
				<p>{soc('Example: 3 matching symbols on reel 1, 2 on reel 2 and 4 on reel 3 = 3 × 2 × 4 = 24 ways paying the 3-of-a-kind prize.', 'Example: 3 matching symbols on reel 1, 2 on reel 2 and 4 on reel 3 = 3 × 2 × 4 = 24 ways winning the 3-of-a-kind prize.')}</p>
			</section>

			<section bind:this={sectionEls.modes}>
				<h2>All Game Modes</h2>
				<p>{soc('Six modes. Base and Ante are bet-by-bet; the features are entered by Marky scatters, a direct bonus buy, or the Mystery Spin.', 'Six modes. Base and Ante run spin by spin; the features are entered by Marky scatters, triggered instantly from the feature menu, or served by a Mystery spin.')}</p>
				<div class="modes">
					{#each MODES as m (m.id)}
						<div class="mode" style:border-left-color={m.accent}>
							<div class="mode-head">
								<div class="mode-name" style:color={m.accent} style:font-size="{dense ? 14 : 16}px">{m.label}</div>
								<div class="mode-meta"><span>{soc('COST', 'PLAY AMOUNT')} <b class="slot-num" style:color={m.accent}>{m.cost}</b></span><span>RTP <b class="slot-num">{(config.rtp * 100).toFixed(2)}%</b></span><span>MAX WIN <b class="slot-num">{config.maxWin.toLocaleString()}× {soc('bet', 'play amount')}</b>{#if m.costNum > 1}<span class="dim">&nbsp;= {capPerPrice(m.costNum)}× {soc('the mode price', 'the play amount for this mode')}</span>{/if}</span></div>
							</div>
							<div class="kv-grid" style:grid-template-columns={narrow ? '1fr' : '1fr 1fr'}>
								<div><div class="k">Enter</div><div class="v">{m.enter}</div></div>
								<div><div class="k">Spins</div><div class="v">{m.spins}</div></div>
							</div>
							<div><div class="k">Mechanics</div><div class="v">{m.mech}</div></div>
						</div>
					{/each}
				</div>
			</section>

			<section bind:this={sectionEls.mystery}>
				<h2>Mystery Spin Disclosure</h2>
				<div class="callout gold">
					<p><strong>What a Mystery Spin serves:</strong> exactly <span class="slot-num mono">{config.mystery.nothing * 100}%</span> nothing (the round {soc('pays', 'wins')} 0), <span class="slot-num mono">{config.mystery.super * 100}%</span> Super Free Spins and <span class="slot-num mono">{config.mystery.feast * 100}%</span> Mantis Feast, for {modeCost('MYSTERY')}× {soc('the bet', 'the play amount')}. These shares are fixed in the published math.</p>
					<p><strong>Feast floor:</strong> every Mantis Feast session, whether {soc('bought as a Mystery Spin', 'served by a Mystery spin')} or triggered by 5 Marky scatters, {soc('pays at least', 'wins at least')} <span class="slot-num mono">{soc(`${config.feastMinWin}× bet`, `${config.feastMinWin}× play amount`)}</span>, {(config.feastMinWin / modeCost('MYSTERY')).toFixed(2)}× the Mystery price, so a Mystery Feast is always a net {soc('profit', 'gain')} on that spin. Super Free Spins have no floor.</p>
					<p><strong>Max win probability:</strong> approximately <span class="slot-num mono">1 in 200</span> Mystery Feast sessions and between <span class="slot-num mono">1 in 100</span> (base game) and <span class="slot-num mono">1 in 120</span> (Ante) scatter-triggered Feast sessions reach the {config.maxWin.toLocaleString()}× max win cap ({capPerPrice(modeCost('MYSTERY'))}× the Mystery price). Other Feast sessions land between the {config.feastMinWin}× floor and the cap, with the {soc('payout', 'win')} distribution skewed toward the floor. Counting the Super Free Spins it can serve as well, about <span class="slot-num mono">1 in 1,510</span> Mystery Spins reach the cap overall.</p>
					<p class="dim">These figures are fixed in the published math and disclosed here in full.</p>
				</div>
			</section>

			<section bind:this={sectionEls.eating}>
				<h2>Free Games Eating Mechanic</h2>
				<p>During Free Spins, Super Free Spins and Mantis Feast, <strong>Marty</strong> (green mantis) and/or <strong>Marky</strong> (red mantis) strike the reels.</p>
				<ul>
					<li>When a session starts the host takes an opening bite (Mantis Feast: both mantises bite).</li>
					<li>Each bite <strong>{soc('eats the lowest-paying symbol', 'eats the lowest-value symbol')}</strong> still on the menu, removing it from the reels for the rest of the session.</li>
					<li>Each <strong style="color:#e0b860">Service Bell</strong> that lands rings for <strong>one additional strike</strong>. When several bells land on one spin, they ring one after another, each serving the next course.</li>
					<li>Fewer symbols on the reels means the remaining symbols land more often, so wins escalate as the session goes on.</li>
					<li>{soc(`If all eight paying symbols are eaten, the round pays the ${config.maxWin.toLocaleString()}× max win immediately and the session ends.`, `If all eight menu symbols are eaten, the round wins the ${config.maxWin.toLocaleString()}× max win immediately and the session ends.`)}</li>
					<li>{soc(`The cap is also reached whenever wins in a session add up to ${config.maxWin.toLocaleString()}× the bet. Either way the round ends and the cap is paid.`, `The cap is also reached whenever wins in a session add up to ${config.maxWin.toLocaleString()}× the play amount. Either way the round ends and the cap is won.`)}</li>
				</ul>
				<div class="subhead">The menu, eaten in this order</div>
				<div class="menu-strip">
					{#each config.eatOrder as sym, i (sym)}
						<div class="menu-item">
							<img class="tile" src={tileSrc(sym)} alt={SYMBOL_META[sym].name} />
							<div class="menu-num">{i + 1}</div>
						</div>
						{#if i < config.eatOrder.length - 1}<div class="menu-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg></div>{/if}
					{/each}
				</div>
				<div class="row">
					<div class="leaf-stack">
						<img src={tileSrc('GL')} alt="Service Bell" />
						<img src={tileSrc('L4')} alt="Caterpillar on its tray" />
					</div>
					<div class="row-main">
						<div class="row-name" style:color="#e0b860">Serving example</div>
						<div class="note">A Service Bell lands and rings. The Caterpillar, the lowest symbol still on the menu, is served up and the host strikes to eat it. Its plate stays empty on the reels for the rest of the session.</div>
					</div>
				</div>
			</section>

			<section bind:this={sectionEls.maxwin}>
				<h2>Max Win</h2>
				<div class="callout red">
					<div class="maxwin-line"><span class="slot-num maxwin" style:font-size="{short ? 20 : dense ? 22 : 36}px">{config.maxWin.toLocaleString()}×</span><span class="dim">{soc('bet (hard cap)', 'play amount (hard cap)')}</span></div>
					<p>{soc(`The total payout of any round is capped at ${config.maxWin.toLocaleString()}× the bet. The cap is reached either by eating all eight symbols or by wins adding up to it. Once reached, the round ends immediately and the cap is paid.`, `The total win of any round is capped at ${config.maxWin.toLocaleString()}× the play amount. The cap is reached either by eating all eight symbols or by wins adding up to it. Once reached, the round ends immediately and the cap is won.`)}</p>
				</div>
			</section>

			<section bind:this={sectionEls.rtp}>
				<h2>Return to Player (RTP)</h2>
				<div class="rtp-grid" style:grid-template-columns={narrow ? '1fr 1fr' : 'repeat(5, 1fr)'}>
					{#each MODES.filter((m) => m.costNum > 0) as m (m.id)}
						<div class="rtp-cell">
							<div class="rtp-k" style:color={m.accent}>{m.label}</div>
							<div class="slot-num rtp-v" style:font-size="{dense ? 18 : 22}px">{(config.rtp * 100).toFixed(2)}%</div>
						</div>
					{/each}
				</div>
				<p>Every game mode has a theoretical return to player of <span class="slot-num mono">{(config.rtp * 100).toFixed(2)}%</span>, calculated over hundreds of thousands of simulated rounds per mode.</p>
				<p class="dim">RTP describes long-run behaviour across all players. Individual sessions may return significantly above or below this figure.</p>
			</section>

			<section bind:this={sectionEls.volatility}>
				<h2>Volatility</h2>
				<div class="vol"><span class="slot-num vol-label" style:font-size="{dense ? 16 : 20}px">EXTREME</span><div class="meter">{#each [1, 2, 3, 4, 5] as i}<div class="seg on"></div>{/each}</div></div>
				<p>Wins are infrequent but can be very large. Most spins return nothing; the free spin sessions carry the long-run RTP, with the Mantis Feast, reached only by 5 Marky scatters or through a Mystery Spin, at the top of the range.</p>
			</section>

			<section bind:this={sectionEls.rules}>
				<h2>Game Rules</h2>
				{#each RULES_SECTIONS as s (s.title)}
					<div class="subhead">{s.title}</div>
					{#each s.paragraphs as p}<p>{p}</p>{/each}
				{/each}
				<div class="callout muted"><p class="dim">{DISCLAIMER}</p></div>
			</section>

			<section bind:this={sectionEls.version}>
				<h2>Version</h2>
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
		--body: var(--ui-ink-2);
		--muted: var(--ui-ink-2);
		--faint: var(--ui-ink-3);
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
		color: var(--body);
		font-family: var(--gi-body);
		font-weight: 400;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: var(--rule-2) transparent;
	}
	/* the reading column: capped and centred on wide masters */
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		max-width: 880px;
		margin: 0 auto;
	}
	h2 {
		margin: 0;
		font-family: var(--ui-font);
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 3px;
		color: var(--gold);
		text-transform: uppercase;
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
	.menu-strip {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin-top: 4px;
	}
	.menu-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.menu-item .tile {
		width: 40px;
		height: 40px;
		border-radius: 8px;
	}
	.menu-num {
		font-family: var(--ui-font);
		font-size: 10px;
		font-weight: 800;
		color: var(--faint);
	}
	.menu-arrow {
		color: var(--faint);
		font-weight: 800;
		margin-bottom: 12px;
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
		font-size: 11.5px;
		color: var(--faint);
		letter-spacing: 1px;
		text-transform: uppercase;
		margin-top: 2px;
	}
	/* floors (Stake review FIX 6): no line in Game Info renders under 10 CSS px at any size */
	.note {
		color: var(--body);
		font-size: 12px;
		line-height: 1.45;
	}
	.pays {
		display: flex;
		gap: 14px;
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
		color: var(--faint);
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
	.mode-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		flex-wrap: wrap;
	}
	.mode-name {
		font-family: var(--ui-font);
		font-weight: 900;
		letter-spacing: 2px;
		text-transform: uppercase;
	}
	.mode-meta {
		font-family: var(--ui-font);
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 1.4px;
		color: var(--faint);
		text-transform: uppercase;
	}
	.mode-meta b {
		color: var(--ink);
		font-weight: 600;
		letter-spacing: 0;
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
		color: var(--faint);
		text-transform: uppercase;
	}
	.v {
		color: var(--body);
		margin-top: 2px;
	}
	.kv {
		font-family: var(--ui-font);
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
		font-size: 10.5px;
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
