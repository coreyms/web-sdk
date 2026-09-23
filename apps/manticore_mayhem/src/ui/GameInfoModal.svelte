<script lang="ts">
	// Game Info: sticky tab strip + scroll-spied sections. Stake Engine requires full feature
	// disclosure here — paytable, modes, the Mystery split and the Epic floor, max win, RTP,
	// volatility, and the verbatim rules disclaimer (gameInfoText.ts). Every NUMBER comes from
	// config.ts, which mirrors game_config.py, and from the RGS's own prices.
	//
	// MILESTONE 1: the numbers are the published math's, the WORDING is DRAFT (see gameInfoText.ts)
	// and has not been through Corey or a Stake review.
	import type { ComponentProps } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateBet, stateModal, stateUrlDerived } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import Icon from './Icon.svelte';
	import config from '../game/config';
	import { soc } from '../game/social';
	import { stamp } from '../game/assets';
	import { DISCLAIMER, rulesSections } from '../game/gameInfoText';
	import { modeCost } from '../game/betModeMeta';

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
		{ id: 'clusters', label: 'Clusters' },
		{ id: 'modes', label: 'Game Modes' },
		{ id: 'mystery', label: 'Mystery Disclosure' },
		{ id: 'tiles', label: 'Multiplier Tiles' },
		{ id: 'maxwin', label: 'Max Win' },
		{ id: 'rtp', label: 'RTP' },
		{ id: 'volatility', label: 'Volatility' },
		{ id: 'rules', label: 'Rules' },
		{ id: 'version', label: 'Version' },
	];

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

	const RULES_SECTIONS = rulesSections();

	const SPECIALS = [
		{ glyph: 'W', name: config.symbols.W.name, color: '#e2b648', note: soc('Substitutes for every paying symbol and has no pay of its own. The manticore\u2019s sting turns several cells wild before a board is evaluated.', 'Substitutes for every paying symbol and has no value of its own. The manticore\u2019s sting turns several cells wild before a board is evaluated.') },
		{ glyph: 'S', name: config.symbols.S.name, color: '#b02c2c', note: `4 / 5 / 6 anywhere award ${config.freeSpins.bonus} Free Spins / ${config.freeSpins.super} Super Free Spins / ${config.freeSpins.epic} Epic Free Spins. In Super Ante, 4 upgrade to a Super. No standards land during a feature and there are no retriggers.` },
	];

	// the cap is a base-bet multiple in every mode; a mode's ceiling against its own price is what a
	// player (and a reviewer) needs to see — 20,000x of a 300x Mystery Spin is 66.7x the price
	const capPerPrice = (cost: number) => {
		const x = config.maxWin / cost;
		return Number.isInteger(x) ? x.toLocaleString() : x.toFixed(1).replace(/\.0$/, '');
	};
	const MODES = [
		{ id: 'base', label: 'Base Game', accent: '#eef0f6', cost: `${modeCost('BASE')}\u00d7`, costNum: modeCost('BASE'), enter: 'Default play.', spins: 'One spin per play.', mech: `Clusters of ${config.minCluster}+ touching symbols pay and cascade. Multiplier tiles reset every spin. 4, 5 or 6 War Standards award Free Spins, Super Free Spins or Epic Free Spins.` },
		{ id: 'ante', label: 'Ante', accent: '#e0b64a', cost: `${modeCost('ANTE')}\u00d7`, costNum: modeCost('ANTE'), enter: soc('Switch on from the feature menu; stays on until switched off.', 'Switch on from the feature menu; stays on until switched off.'), spins: 'One spin per play.', mech: 'Free Spins and Super Free Spins land about five times as often as in the base game. Multiplier tiles still reset every spin.' },
		{ id: 'super_ante', label: 'Super Ante', accent: '#e08a3c', cost: `${modeCost('SUPER_ANTE')}\u00d7`, costNum: modeCost('SUPER_ANTE'), enter: 'Switch on from the feature menu; stays on until switched off.', spins: 'One spin per play.', mech: 'Regular Free Spins cannot trigger at all: only Super and Epic, and 4 War Standards upgrade to a Super.' },
		{ id: 'bonus', label: 'Free Spins', accent: '#2eb0a8', cost: `${modeCost('BONUS')}\u00d7`, costNum: modeCost('BONUS'), enter: soc('Land 4 War Standards, or buy directly.', 'Land 4 War Standards, or trigger it instantly from the feature menu.'), spins: `${config.freeSpins.bonus} free spins.`, mech: `Multiplier tiles PERSIST for the whole round and double up to ${config.tileCap.bonus}\u00d7.` },
		{ id: 'super', label: 'Super Free Spins', accent: '#7fb6ff', cost: `${modeCost('SUPER')}\u00d7`, costNum: modeCost('SUPER'), enter: soc('Land 5 War Standards, or buy directly.', 'Land 5 War Standards, or trigger it instantly from the feature menu.'), spins: `${config.freeSpins.super} free spins.`, mech: `Tiles persist and run to the ${config.tileCap.super}\u00d7 ladder. The roar clears the low symbols and a Super Sting is possible.` },
		{ id: 'epic', label: 'Epic Free Spins', accent: '#ff6a4a', cost: `${modeCost('EPIC')}\u00d7`, costNum: modeCost('EPIC'), enter: soc('Land 6 War Standards, or buy directly.', 'Land 6 War Standards, or trigger it instantly from the feature menu.'), spins: `${config.freeSpins.epic} free spins.`, mech: soc(`Tiles persist on the ${config.tileCap.epic}\u00d7 ladder, Super Stings are common, and every round pays at least ${config.epicMinWin}\u00d7 the bet.`, `Tiles persist on the ${config.tileCap.epic}\u00d7 ladder, Super Stings are common, and every round wins at least ${config.epicMinWin}\u00d7 the play amount.`) },
		{ id: 'mystery', label: 'Mystery', accent: '#b07fe0', cost: `${modeCost('MYSTERY')}\u00d7`, costNum: modeCost('MYSTERY'), enter: soc('Buy from the feature menu.', 'Trigger from the feature menu.'), spins: 'Whatever it awards, or nothing.', mech: `${config.mystery.nothing * 100}% award nothing at all, ${config.mystery.super * 100}% award Super Free Spins and ${config.mystery.epic * 100}% award Epic Free Spins. Never a regular Free Spins round. The split is fixed in the published math.` },
	];

	// UI guide (submission checklist "User interaction guide is included in the game information"):
	// one control per row — the same icon the chrome draws, the name, what a press does
	type IconName = ComponentProps<typeof Icon>['name'];
	type GuideRow = { icon: IconName | null; art?: string; color: string; name: string; text: string };
	const GUIDE: GuideRow[] = [
		{ icon: 'play', color: '#ffdc4a', name: 'Spin', text: soc('Plays one round at the SPIN amount. While the reels drop the button turns into STOP, which lands the result at once. With Autoplay or a feature loaded, the button shows what the next press starts.', 'Plays one round at the SPIN amount. While the reels drop the button turns into STOP, which lands the result at once. With Autoplay or a feature loaded, the button shows what the next press starts.') },
		{ icon: 'turbo', color: '#ffdc4a', name: 'Turbo', text: 'Cycles through Off, Turbo and Instant. Turbo shortens the reel drop and the win presentation; Instant (lightning icon) lands each result immediately. The turbo setting and the sound settings are remembered on this device.' },
		{ icon: 'auto', color: '#ffdc4a', name: 'Autoplay', text: 'Opens the Autoplay ticket: number of spins, plus an ADVANCED fold with a stop-on-loss limit, a stop-on-single-win limit, Stop on Free Games (autoplay ends when a feature triggers; the feature still plays out) and Autoplay Bonuses (feature screens continue on their own). LOAD parks the run on the Spin button; pressing Spin starts it and pressing again stops it. While a run is active the Spin button turns green with the spins left and this button turns red with an X.' },
		{ icon: 'polymath', color: '#ffdc4a', name: soc('Bonus Buy', 'Feature Menu'), text: soc('Opens the feature menu: switch Ante Bet or Super Ante Bet on, or buy Free Spins, Super Free Spins, Epic Free Spins or a Mystery directly. A loaded feature is shown on the Spin button and on this button by name; tap the button again to cancel it.', 'Opens the feature menu: switch Ante Mode or Super Ante Mode on, or trigger Free Spins, Super Free Spins, Epic Free Spins or a Mystery instantly. A loaded feature is shown on the Spin button and on this button by name; tap the button again to cancel it.') },
		{ icon: 'menu', color: '#ffdc4a', name: 'Menu', text: 'Game Info (this screen) plus separate music and sound-effect volume sliders with mute buttons.' },
		{ icon: 'info', color: '#ffdc4a', name: 'Readouts', text: soc('BALANCE is your current balance. WIN is the running total of the current round. SPIN is the full cost of one press in the active mode (base bet × the mode multiplier). The − and + beside it step through the bet menu, and tapping the readout opens the full bet picker. The plaque on the reel frame names the active mode and its price.', 'BALANCE is your current balance. WIN is the running total of the current round. SPIN is the full play amount of one press in the active mode (base amount × the mode multiplier). The − and + beside it step through the play amount menu, and tapping the readout opens the full picker. The plaque on the reel frame names the active mode and its play amount.') },
		{ icon: 'chevronRight', color: '#ffdc4a', name: 'Keyboard', text: 'Space bar plays a round; hold it to keep playing (Turbo and Autoplay are locked while it is held). Escape closes any open window.' },
		{ icon: 'stop', color: '#ffdc4a', name: 'Feature screens', text: 'Feature intros and wrap-ups wait for a press anywhere. Autoplay Bonuses in the Autoplay ticket lets those screens continue on their own.' },
	];

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
				<p>{soc(`Pays by CLUSTER SIZE: ${config.minCluster} or more matching symbols touching each other left, right, up or down. A cluster's pay is multiplied by the SUM of the multiplier tiles under it.`, `Wins by CLUSTER SIZE: ${config.minCluster} or more matching symbols touching each other left, right, up or down. A cluster's win is multiplied by the SUM of the multiplier tiles under it.`)}</p>
				<!-- ONE column, always: five cluster-size bands per row need the full reading width.
				     Angry Mantis fitted two columns because it only had three "of a kind" cells. -->
				<div class="pay-grid" style:grid-template-columns="1fr">
					{#each paying as sym (sym)}
						{@const meta = SYMBOL_META[sym]}
						<div class="row">
							<img class="tile" src={tileSrc(sym)} alt={meta.name} style:width="{tileSize}px" style:height="{tileSize}px" />
							<div class="row-main">
								<div class="row-name" style:color={meta.color} style:font-size="{dense ? 12.5 : 14}px">{meta.name}</div>
								<div class="row-kind">{meta.kind === 'premium' ? 'Premium' : meta.kind === 'mid' ? 'Mid' : 'Low'}</div>
							</div>
							<div class="pays">
								{#each pays(sym) as p, i}
									<div class="pay"><div class="pay-k">{config.paytableBands[i].label}</div><div class="slot-num pay-v">{payText(p)}</div></div>
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
							<div class="row-kind">Substitutes for every paying symbol</div>
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

			<section bind:this={sectionEls.clusters}>
				<h2>Clusters and Cascades</h2>
				<p><strong>8 × 8 grid, cluster pays.</strong> {config.minCluster} or more matching symbols touching each other left, right, up or down form one cluster. Position on the grid does not matter and there are no paylines.</p>
				<p>{soc('Every winning cluster is removed, the symbols above it fall down and new symbols drop in from the top. The board keeps paying and refilling until a spin has no clusters left.', 'Every winning cluster is removed, the symbols above it fall down and new symbols drop in from the top. The board keeps winning and refilling until a spin has no clusters left.')}</p>
				<p>{soc(`The larger the cluster, the higher the band it pays from: ${config.paytableBands.map((b) => b.label).join(', ')}.`, `The larger the cluster, the higher the band it wins from: ${config.paytableBands.map((b) => b.label).join(', ')}.`)}</p>
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
				<h2>Mystery Disclosure</h2>
				<div class="callout gold">
					<p><strong>What a Mystery awards:</strong> exactly <span class="slot-num mono">{config.mystery.nothing * 100}%</span> nothing (the round {soc('pays', 'wins')} 0), <span class="slot-num mono">{config.mystery.super * 100}%</span> Super Free Spins and <span class="slot-num mono">{config.mystery.epic * 100}%</span> Epic Free Spins, for {modeCost('MYSTERY')}× {soc('the bet', 'the play amount')}. It NEVER awards a regular Free Spins round. These shares are fixed in the published math.</p>
					<p><strong>A Mystery is a real spin:</strong> three War Standards always land in the first three columns and the rest of the board is played out. A Mystery that awards no feature still plays its spin, and any clusters on it {soc('pay', 'win')} normally.</p>
					<p><strong>Epic floor:</strong> an Epic Free Spins round reached through a Mystery {soc('pays at least', 'wins at least')} <span class="slot-num mono">{soc(`${config.mysteryEpicMinWin}× bet`, `${config.mysteryEpicMinWin}× play amount`)}</span>, {(config.mysteryEpicMinWin / modeCost('MYSTERY')).toFixed(2)}× the Mystery price. An Epic entered any other way {soc('pays at least', 'wins at least')} <span class="slot-num mono">{config.epicMinWin}×</span>. Super Free Spins have no floor.</p>
					<p class="dim">DRAFT: these figures come from the published math. The wording of this section has not been reviewed yet.</p>
				</div>
			</section>

			<section bind:this={sectionEls.tiles}>
				<h2>Multiplier Tiles</h2>
				<p>Every cell a winning cluster is removed from lights up as a <strong>2× multiplier tile</strong>. Each further cluster removed from that same cell <strong>doubles</strong> it.</p>
				<div class="menu-strip">
					{#each [2, 4, 8, 16, 32, 64, 128] as value, i (value)}
						<div class="menu-item">
							<img class="tile" src={stamp(`/assets/tiles/x${value}.webp`)} alt="{value} times" />
						</div>
						{#if i < 6}<div class="menu-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg></div>{/if}
					{/each}
				</div>
				<ul>
					<li>The tiles under a winning cluster are <strong>added together</strong>, and the cluster {soc('pays', 'wins')} its table value multiplied by that sum. A cluster with no tiles under it {soc('pays', 'wins')} its table value once.</li>
					<li>Tiles <strong>reset every spin</strong> in the Base Game, Ante and Super Ante.</li>
					<li>Tiles <strong>persist for the whole round</strong> in Free Spins, Super Free Spins and Epic Free Spins.</li>
					<li>The ladder stops at <strong>{config.tileCap.bonus}×</strong> in the Base Game, Ante, Super Ante and Free Spins, and at <strong>{config.tileCap.super}×</strong> in Super Free Spins and Epic Free Spins.</li>
				</ul>
				<div class="subhead">The manticore</div>
				<ul>
					<li><strong>Swipe.</strong> When a spin runs out of clusters the paw may clear rows {config.swipeRows.join(', ')} and double the multiplier tiles in them before the board refills. Play carries on from the new board.</li>
					<li><strong>Sting.</strong> The tail turns several cells wild before the board is evaluated. A <strong>Super Sting</strong> turns more cells wild and happens only in Super Free Spins and Epic Free Spins.</li>
					<li><strong>Roar.</strong> Every low symbol is blown off the board and replaced. Multiplier tiles under them are not affected. Super Free Spins and Epic Free Spins only.</li>
				</ul>
				<p class="dim">DRAFT: the wording of this section has not been reviewed yet.</p>
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
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 1.5px;
		text-transform: uppercase;
	}
	.row-kind {
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
		flex-shrink: 0;
	}
	.pay {
		text-align: right;
		min-width: 44px;
	}
	.pay-k {
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
		font-weight: 900;
		letter-spacing: 2px;
		text-transform: uppercase;
	}
	.mode-meta {
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
