<script lang="ts">
	// Game Info: sticky tab strip + scroll-spied sections. Stake Engine requires full feature
	// disclosure here — paytable, modes, Feast floor/max-win odds, max win, RTP, volatility, and the
	// verbatim rules disclaimer (gameInfoText.ts). All numbers come from config / the math run.
	import type { ComponentProps } from 'svelte';
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

	const open = $derived(stateModal.modal?.name === 'gameRules' || stateModal.modal?.name === 'payTable');
	const close = () => (stateModal.modal = null);

	const SECTIONS = [
		{ id: 'paytable', label: 'Paytable' },
		{ id: 'guide', label: 'UI Guide' },
		{ id: 'ways', label: 'Ways' },
		{ id: 'modes', label: 'Game Modes' },
		{ id: 'feast', label: 'Feast Disclosure' },
		{ id: 'eating', label: 'Eating Mechanic' },
		{ id: 'maxwin', label: 'Max Win' },
		{ id: 'rtp', label: 'RTP' },
		{ id: 'volatility', label: 'Volatility' },
		{ id: 'rules', label: 'Rules' },
		{ id: 'version', label: 'Version' },
	];

	const SYMBOL_META: Record<string, { name: string; color: string; kind: 'premium' | 'mid' | 'low' }> = {
		H1: { name: 'Marty', color: '#b07a12', kind: 'premium' },
		M1: { name: 'Beetle', color: '#b8371e', kind: 'mid' },
		M2: { name: 'Spider', color: '#4e7d15', kind: 'mid' },
		M3: { name: 'Scorpion', color: '#2b6fb3', kind: 'mid' },
		L1: { name: 'Lightning Bug', color: '#2a241a', kind: 'low' },
		L2: { name: 'Fly', color: '#2a241a', kind: 'low' },
		L3: { name: 'Moth', color: '#2a241a', kind: 'low' },
		L4: { name: 'Caterpillar', color: '#2a241a', kind: 'low' },
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

	const RULES_SECTIONS = rulesSections();

	const SPECIALS = [
		{ glyph: 'W', name: 'Wild', color: '#b07a12', note: soc('Substitutes for every paying symbol. Never lands on reel 1. Does not substitute for Marky scatters or Dinner Leaves.', 'Substitutes for every menu symbol. Never lands on reel 1. Does not substitute for Marky scatters or Dinner Leaves.') },
		{ glyph: 'S', name: 'Marky Scatter', color: '#c4501e', note: `3 / 4 / 5 anywhere trigger Free Spins / Super Free Spins / Mantis Feast. In free spins each scatter adds +1 spin (up to +${config.freeSpins.maxRetrigger} per session); once the cap is reached scatters stop appearing.` },
		{ glyph: 'GL', name: 'Dinner Leaf', color: '#4e7d15', note: soc('Free spins only. Each Dinner Leaf that lands is a Mantis Strike: the lowest-paying symbol still on the menu is eaten. The leaf cascades in carrying the insect it is about to serve.', 'Free spins only. Each Dinner Leaf that lands is a Mantis Strike: the lowest-value symbol still on the menu is eaten. The leaf cascades in carrying the insect it is about to serve.') },
	];

	// the cap is a base-bet multiple in every mode; a mode's ceiling against its own price is what a
	// player (and a reviewer) needs to see — 20,000x of a 1,000x Feast is 20x the price
	const capPerPrice = (cost: number) => {
		const x = config.maxWin / cost;
		return Number.isInteger(x) ? x.toLocaleString() : x.toFixed(1).replace(/\.0$/, '');
	};
	const MODES = [
		{ id: 'base', label: 'Base Game', accent: '#2a241a', cost: `${modeCost('BASE')}×`, costNum: modeCost('BASE'), enter: 'Default play.', spins: 'One spin per play.', mech: 'Standard 1,024 ways evaluation. 3, 4 or 5 Marky scatters trigger Free Spins, Super Free Spins or Mantis Feast.' },
		{ id: 'ante', label: 'Ante', accent: '#b07a12', cost: `${modeCost('ANTE')}×`, costNum: modeCost('ANTE'), enter: 'Activate from the bonus menu; stays on until switched off.', spins: 'One spin per play.', mech: soc('Doubles the cost of each spin. A Marky scatter is locked onto reel 1 every spin, so only two more are needed for a feature. Cannot be combined with a direct bonus buy.', 'Doubles the play amount for each spin. A Marky scatter is locked onto reel 1 every spin, so only two more are needed for a feature. Cannot be combined with an instantly triggered feature.') },
		{ id: 'bonus', label: 'Free Spins', accent: '#4e7d15', cost: `${modeCost('BONUS')}×`, costNum: modeCost('BONUS'), enter: soc('Land 3 Marky scatters, or buy directly.', 'Land 3 Marky scatters, or trigger it instantly from the feature menu.'), spins: `${config.freeSpins.free} Free Spins.`, mech: soc('Marty hosts. An opening bite eats the lowest-paying symbol for the rest of the session; every Dinner Leaf that lands is another strike.', 'Marty hosts. An opening bite eats the lowest-value symbol for the rest of the session; every Dinner Leaf that lands is another strike.') },
		{ id: 'super', label: 'Super Free Spins', accent: '#b8371e', cost: `${modeCost('SUPER')}×`, costNum: modeCost('SUPER'), enter: soc('Land 4 Marky scatters, or buy directly.', 'Land 4 Marky scatters, or trigger it instantly from the feature menu.'), spins: `${config.freeSpins.super} Free Spins.`, mech: 'Marky hosts on reels with more Dinner Leaves, so symbols are eaten faster and wins escalate sooner.' },
		{ id: 'feast', label: 'Mantis Feast', accent: '#b07a12', cost: `${modeCost('FEAST').toLocaleString()}×`, costNum: modeCost('FEAST'), enter: soc('Land 5 Marky scatters, or buy directly.', 'Land 5 Marky scatters, or trigger it instantly from the feature menu.'), spins: `${config.freeSpins.feast} Free Spins.`, mech: 'Marty AND Marky feed: two opening bites, and both mantises strike.' },
	];

	// UI guide (submission checklist "User interaction guide is included in the game information"):
	// one control per row — the same icon the chrome draws, the name, what a press does
	type IconName = ComponentProps<typeof Icon>['name'];
	type GuideRow = { icon: IconName | null; art?: string; color: string; name: string; text: string };
	const GUIDE: GuideRow[] = [
		{ icon: 'play', color: '#2a241a', name: 'Spin', text: soc('Plays one round at the SPIN amount. While the reels drop the button turns into STOP, which lands the result at once. With Autoplay or a feature loaded, the button shows what the next press starts.', 'Plays one round at the SPIN amount. While the reels drop the button turns into STOP, which lands the result at once. With Autoplay or a feature loaded, the button shows what the next press starts.') },
		{ icon: 'turbo', color: '#b07a12', name: 'Turbo', text: 'Cycles Off → Turbo → Instant. Turbo shortens the reel drop and the win presentation; Instant (lightning icon) lands each result immediately. Turbo is remembered between sessions.' },
		{ icon: 'auto', color: '#4e7d15', name: 'Autoplay', text: 'Opens the Autoplay ticket: number of spins, a stop-on-loss limit and a stop-on-single-win limit. LOAD parks the run on the Spin button; pressing Spin starts it and pressing again stops it. The button turns red while a run is active.' },
		{ icon: null, art: '/assets/ui/mantis-head.png', color: '#4e7d15', name: soc('Bonus Buy', 'Feature Menu'), text: soc('Opens the Chow Line: switch Ante Bet on, or buy Free Spins, Super Free Spins or Mantis Feast directly. A loaded feature is shown on the Spin button and on this button as "<MODE> ON"; tap the button again to cancel it.', 'Opens the Chow Line: switch Ante Mode on, or trigger Free Spins, Super Free Spins or Mantis Feast instantly. A loaded feature is shown on the Spin button and on this button as "<MODE> ON"; tap the button again to cancel it.') },
		{ icon: 'coins', color: '#b07a12', name: soc('Bet Amount', 'Play Amount'), text: soc('Opens the bet picker. The SPIN readout does the same when tapped. The Ante and feature tickets also carry a − / + stepper for the base amount.', 'Opens the play amount picker. The SPIN readout does the same when tapped. The Ante and feature tickets also carry a − / + stepper for the base amount.') },
		{ icon: 'menu', color: '#2a241a', name: 'Menu', text: 'Game Info (this screen) plus separate music and sound-effect volume sliders with mute buttons.' },
		{ icon: 'info', color: '#2b6fb3', name: 'Readouts', text: soc('BALANCE is your current balance. WIN is the running total of the current round. SPIN is the full cost of one press in the active mode (base bet × the mode multiplier). The plaque on the reel frame names the active mode and its price.', 'BALANCE is your current balance. WIN is the running total of the current round. SPIN is the full play amount of one press in the active mode (base amount × the mode multiplier). The plaque on the reel frame names the active mode and its play amount.') },
		{ icon: 'chevronRight', color: '#2a241a', name: 'Keyboard', text: 'Space bar plays a round; hold it to keep playing (Turbo and Autoplay are locked while it is held). Escape closes any open window.' },
		{ icon: 'stop', color: '#b8371e', name: 'Feature screens', text: 'Feature intros and wrap-ups wait for a press anywhere. Autoplay Bonuses in the Autoplay ticket lets those screens continue on their own.' },
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

	const pad = $derived(compact ? 14 : 28);
	const bodySize = $derived(compact ? 12 : 14);
</script>

<ModalShell {open} onclose={close} {master} {scale} {left} {top} dim="rgba(8,4,16,0.62)" blur={14} zIndex={5}>
	<div class="panel" onclick={(e) => e.stopPropagation()} role="presentation" style:margin="{compact ? 14 : 24}px" style:border-radius="{compact ? 12 : 18}px">
		<div class="head" style:padding="{compact ? 12 : 18}px {pad}px">
			<div class="h-title" style:font-size="{compact ? 18 : 28}px">GAME INFO</div>
			<button class="slot-btn x" onclick={close} style:width="{compact ? 36 : 44}px" style:height="{compact ? 36 : 44}px" aria-label="Close"><Icon name="close" s={compact ? 16 : 20} /></button>
		</div>

		<div class="tabs" bind:this={navEl} style:padding="8px {pad}px">
			{#each SECTIONS as s (s.id)}
				<button class="slot-btn tab" class:on={active === s.id} data-tab={s.id} onclick={() => jump(s.id)} style:padding={compact ? '6px 10px' : '8px 14px'} style:font-size="{compact ? 11 : 13}px">{s.label}</button>
			{/each}
		</div>

		<div class="content" bind:this={contentEl} onscroll={onScroll} style:padding="{pad}px" style:gap="{compact ? 18 : 28}px" style:font-size="{bodySize}px">
			<section bind:this={sectionEls.paytable}>
				<h2>Paytable</h2>
				<p>{soc('Pays per way for 3, 4 and 5 of a kind, multiplied by the number of matching ways. Wins pay left to right on adjacent reels starting from reel 1.', 'Wins per way for 3, 4 and 5 of a kind, multiplied by the number of matching ways. Wins form left to right on adjacent reels starting from reel 1.')} {soc('Only the highest win per symbol is paid. Base game wins are capped at 250× the bet per spin.', 'Only the highest win per symbol counts. Base game wins are capped at 250× the play amount per spin.')}</p>
				<div class="pay-grid" style:grid-template-columns={compact ? '1fr' : 'repeat(2, minmax(0,1fr))'}>
					{#each paying as sym (sym)}
						{@const meta = SYMBOL_META[sym]}
						<div class="row">
							<img class="tile" src={tileSrc(sym)} alt={meta.name} style:width="{compact ? 36 : 44}px" style:height="{compact ? 36 : 44}px" />
							<div class="row-main">
								<div class="row-name" style:color={meta.color}>{meta.name}</div>
								<div class="row-kind">{meta.kind === 'premium' ? 'Premium' : meta.kind === 'mid' ? 'Mid' : 'Low'}</div>
							</div>
							<div class="pays">
								{#each pays(sym) as p, i}
									<div class="pay"><div class="pay-k">{3 + i}×</div><div class="slot-num pay-v">{payText(p)}</div></div>
								{/each}
							</div>
						</div>
					{/each}
					<!-- Wild sits in the paytable grid per convention: its own tile, no pay values —
					     it has no paytable of its own, only the substitution rule as its caption -->
					<div class="row">
						<img class="tile" src={tileSrc('W')} alt="Wild" style:width="{compact ? 36 : 44}px" style:height="{compact ? 36 : 44}px" />
						<div class="row-main">
							<div class="row-name" style:color="#b07a12">Wild</div>
							<div class="row-kind">Substitutes for all menu symbols</div>
						</div>
					</div>
				</div>
				<div class="tear"></div>
				<div class="subhead">Special Symbols</div>
				<div class="pay-grid" style:grid-template-columns="1fr">
					{#each SPECIALS as s (s.glyph)}
						<div class="row top">
							<img class="tile" src={tileSrc(s.glyph)} alt={s.name} style:width="{compact ? 36 : 44}px" style:height="{compact ? 36 : 44}px" />
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
							<div class="guide-icon" style:color={g.color} style:width="{compact ? 40 : 48}px" style:height="{compact ? 40 : 48}px">
								{#if g.art}<img src={stamp(g.art)} alt="" style:width="{compact ? 30 : 36}px" draggable="false" />{:else if g.icon}<Icon name={g.icon} s={compact ? 18 : 22} />{/if}
							</div>
							<div class="guide-text">
								<div class="guide-name" style:font-size="{compact ? 13 : 15}px">{g.name}</div>
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
				<p>{soc('Five modes. Base and Ante are bet-by-bet; the features are entered by Marky scatters or a direct bonus buy.', 'Five modes. Base and Ante run spin by spin; the features are entered by Marky scatters or triggered instantly from the feature menu.')}</p>
				<div class="modes">
					{#each MODES as m (m.id)}
						<div class="mode" style:border-color="{m.accent}66">
							<div class="mode-head">
								<div class="mode-name" style:color={m.accent} style:font-size="{compact ? 14 : 16}px">{m.label}</div>
								<div class="mode-meta"><span>{soc('COST', 'PLAY AMOUNT')} <b class="slot-num" style:color={m.accent}>{m.cost}</b></span><span>RTP <b class="slot-num">{(config.rtp * 100).toFixed(2)}%</b></span><span>MAX WIN <b class="slot-num">{config.maxWin.toLocaleString()}× {soc('bet', 'play amount')}</b>{#if m.costNum !== 1}<span class="dim">&nbsp;= {capPerPrice(m.costNum)}× {soc('the mode price', 'the play amount for this mode')}</span>{/if}</span></div>
							</div>
							<div class="kv-grid" style:grid-template-columns={compact ? '1fr' : '1fr 1fr'}>
								<div><div class="k">Enter</div><div class="v">{m.enter}</div></div>
								<div><div class="k">Spins</div><div class="v">{m.spins}</div></div>
							</div>
							<div><div class="k">Mechanics</div><div class="v">{m.mech}</div></div>
						</div>
					{/each}
				</div>
			</section>

			<section bind:this={sectionEls.feast}>
				<h2>Mantis Feast Disclosure</h2>
				<div class="callout gold">
					<p><strong>Minimum guaranteed return:</strong> every Mantis Feast session {soc('pays at least', 'wins at least')} <span class="slot-num mono">{soc('300× bet', '300× play amount')}</span> — {(300 / modeCost('FEAST')).toFixed(1)}× {soc('the Feast price', 'the Feast play amount')}. {soc('This floor is paid out of the', 'This floor comes out of the')} {modeCost('FEAST').toLocaleString()}× {soc('purchase price', 'play amount')}.</p>
					<p><strong>Max win probability:</strong> approximately <span class="slot-num mono">1 in 150</span> Mantis Feast sessions reaches the {config.maxWin.toLocaleString()}× max win cap ({capPerPrice(modeCost('FEAST'))}× {soc('the Feast price', 'the Feast play amount')}). Other sessions land between the 300× floor and the cap, with the {soc('payout', 'win')} distribution skewed toward the floor.</p>
					<p class="dim">These figures are disclosed openly per Stake Engine approval requirements.</p>
				</div>
			</section>

			<section bind:this={sectionEls.eating}>
				<h2>Free Games Eating Mechanic</h2>
				<p>During Free Spins, Super Free Spins and Mantis Feast, <strong>Marty</strong> (green mantis) and/or <strong>Marky</strong> (red mantis) strike the reels.</p>
				<ul>
					<li>When a session starts the host takes an opening bite (Mantis Feast: both mantises bite).</li>
					<li>Each bite <strong>{soc('eats the lowest-paying symbol', 'eats the lowest-value symbol')}</strong> still on the menu, removing it from the reels for the rest of the session.</li>
					<li>Each <strong style="color:#4e7d15">Dinner Leaf</strong> that lands triggers <strong>one additional strike</strong>. Every leaf cascades in carrying the insect it will serve — when several leaves land on one spin, each shows its own course, in serving order.</li>
					<li>Fewer symbols on the reels means the remaining symbols land more often, so wins escalate as the session goes on.</li>
					<li>{soc(`If all eight paying symbols are eaten, the round pays the ${config.maxWin.toLocaleString()}× max win immediately and the session ends.`, `If all eight menu symbols are eaten, the round wins the ${config.maxWin.toLocaleString()}× max win immediately and the session ends.`)}</li>
					<li>{soc(`The cap is also reached whenever wins in a session add up to ${config.maxWin.toLocaleString()}× the bet. Either way the round ends and the cap is paid.`, `The cap is also reached whenever wins in a session add up to ${config.maxWin.toLocaleString()}× the play amount. Either way the round ends and the cap is won.`)}</li>
				</ul>
				<div class="subhead">The menu — eaten in this order</div>
				<div class="menu-strip">
					{#each config.eatOrder as sym, i (sym)}
						<div class="menu-item">
							<img class="tile" src={tileSrc(sym)} alt={SYMBOL_META[sym].name} />
							<div class="menu-num">{i + 1}</div>
						</div>
						{#if i < config.eatOrder.length - 1}<div class="menu-arrow">→</div>{/if}
					{/each}
				</div>
				<div class="row">
					<div class="leaf-stack">
						<img src={tileSrc('GL')} alt="Dinner Leaf" />
						<img src={stamp('/assets/tiles/l4_insect.webp')} alt="Caterpillar riding the leaf" />
					</div>
					<div class="row-main">
						<div class="row-name" style:color="#4e7d15">Serving example</div>
						<div class="note">A Dinner Leaf lands carrying the Caterpillar — the lowest symbol still on the menu — and the host strikes to eat it, leaving an empty plate on the reels.</div>
					</div>
				</div>
			</section>

			<section bind:this={sectionEls.maxwin}>
				<h2>Max Win</h2>
				<div class="callout red">
					<div class="maxwin-line"><span class="slot-num maxwin" style:font-size="{compact ? 22 : 36}px">{config.maxWin.toLocaleString()}×</span><span class="dim">{soc('bet — hard cap', 'play amount — hard cap')}</span></div>
					<p>{soc(`The total payout of any round is capped at ${config.maxWin.toLocaleString()}× the bet. The cap is reached either by eating all eight symbols or by wins adding up to it. Once reached, the round ends immediately and the cap is paid.`, `The total win of any round is capped at ${config.maxWin.toLocaleString()}× the play amount. The cap is reached either by eating all eight symbols or by wins adding up to it. Once reached, the round ends immediately and the cap is won.`)}</p>
				</div>
			</section>

			<section bind:this={sectionEls.rtp}>
				<h2>Return to Player (RTP)</h2>
				<div class="rtp-grid" style:grid-template-columns={compact ? '1fr 1fr' : 'repeat(5, 1fr)'}>
					{#each MODES as m (m.id)}
						<div class="rtp-cell" style:border-color="{m.accent}66">
							<div class="rtp-k" style:color={m.accent}>{m.label.split(' ')[0]}</div>
							<div class="slot-num rtp-v" style:font-size="{compact ? 18 : 22}px">{(config.rtp * 100).toFixed(2)}%</div>
						</div>
					{/each}
				</div>
				<p>Every game mode has a theoretical return to player of <span class="slot-num mono">{(config.rtp * 100).toFixed(2)}%</span>, calculated over many millions of simulated plays.</p>
				<p class="dim">RTP describes long-run behaviour across all players. Individual sessions may return significantly above or below this figure.</p>
			</section>

			<section bind:this={sectionEls.volatility}>
				<h2>Volatility</h2>
				<div class="vol"><span class="slot-num vol-label" style:font-size="{compact ? 16 : 20}px">VERY HIGH</span><div class="meter">{#each [1, 2, 3, 4, 5] as i}<div class="seg on"></div>{/each}</div></div>
				<p>Wins are infrequent but can be very large. Most spins return nothing; free-spin sessions and the Mantis Feast carry the long-run RTP.</p>
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
				<div class="kv-grid" style:grid-template-columns={compact ? '1fr' : '1fr 1fr'}>
					{#each [['Game version', '0.1.0'], ['Math version', '2026.08.23'], ['Provider', 'Polymath Games'], ['Replay mode', 'Supported']] as [k, v]}
						<div class="kv"><span class="dim">{k}</span><span class="slot-num">{v}</span></div>
					{/each}
				</div>
			</section>
			<div style:height="12px"></div>
		</div>
	</div>
</ModalShell>

<style>
	/* ── the paper card (same stock + tokens as AutoplayModal / BonusBuyModal / ReplayModal) ── */
	.panel {
		--ink: #1b1204;
		--body: #2a241a;
		--muted: #6b6250;
		--faint: #8a8069;
		--rule: #a99c7d;
		--green: #4e7d15;
		--green-bg: rgba(166, 228, 87, 0.28);
		--gold: #b07a12;
		--gold-bg: rgba(242, 193, 78, 0.22);
		--red: #b8371e;
		--red-bg: rgba(255, 138, 112, 0.22);
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		color: var(--body);
		background: linear-gradient(180deg, #ebe3cf, #d9cfb4);
		box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7), inset 0 0 0 2px rgba(0, 0, 0, 0.08);
		overflow: hidden;
		pointer-events: auto;
	}
	/* paper grain — a pseudo element, so the scrolling content never has to carry it */
	.panel::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.035) 0 1px, transparent 1px 3px);
		pointer-events: none;
		z-index: 0;
	}
	.panel > * {
		position: relative;
		z-index: 1;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.h-title {
		font-weight: 900;
		letter-spacing: 5px;
		color: var(--ink);
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
	}
	.x {
		border-radius: 10px;
		background: var(--body);
		color: #ebe3cf;
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.x:active {
		transform: translateY(2px);
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
	}
	/* tab strip: a dashed tear line above and below, like the ticket's perforations */
	.tabs {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		overflow-y: hidden;
		border-top: 3px dashed var(--rule);
		border-bottom: 3px dashed var(--rule);
		scrollbar-width: none;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tab {
		flex: 0 0 auto;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.06);
		border: 2px solid rgba(0, 0, 0, 0.14);
		color: var(--muted);
		font-weight: 800;
		letter-spacing: 1.5px;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.tab.on {
		background: var(--body);
		border-color: var(--body);
		color: #f2c14e;
	}
	.content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		line-height: 1.6;
		color: var(--body);
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: var(--rule) transparent;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 900;
		letter-spacing: 3px;
		color: var(--ink);
		text-transform: uppercase;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
	}
	p {
		margin: 0;
	}
	strong {
		color: var(--ink);
		font-weight: 800;
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
		font-size: 12px;
		letter-spacing: 3px;
		font-weight: 800;
		color: var(--muted);
		text-transform: uppercase;
		margin-top: 6px;
	}
	.tear {
		height: 0;
		border-top: 3px dashed var(--rule);
		margin: 8px 0;
	}
	.pay-grid {
		display: grid;
		gap: 8px;
		margin-top: 8px;
	}
	/* rows / cards: the dashed .block of the other tickets, at list scale */
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 12px;
		border: 2px dashed var(--rule);
		background: rgba(255, 255, 255, 0.12);
	}
	.row.top {
		align-items: flex-start;
	}
	.tile {
		border-radius: 10px;
		flex-shrink: 0;
		display: block;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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
		font-size: 9px;
		font-weight: 800;
		color: var(--muted);
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
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 1.5px;
		text-transform: uppercase;
	}
	.row-kind {
		font-size: 10px;
		color: var(--muted);
		letter-spacing: 0.5px;
		margin-top: 2px;
	}
	.note {
		color: var(--body);
	}
	.pays {
		display: flex;
		gap: 10px;
	}
	.pay {
		text-align: right;
		min-width: 36px;
	}
	.pay-k {
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 1px;
		color: var(--muted);
	}
	.pay-v {
		font-size: 13px;
		color: var(--ink);
		font-weight: 800;
		white-space: nowrap;
	}
	.modes {
		display: grid;
		gap: 10px;
		margin-top: 8px;
	}
	.mode {
		padding: 14px;
		border-radius: 12px;
		border: 2px solid var(--rule);
		background: rgba(255, 255, 255, 0.12);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.mode-head {
		display: flex;
		align-items: center;
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
		gap: 4px 12px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 1px;
		color: var(--muted);
	}
	.mode-meta b {
		color: var(--ink);
		font-weight: 800;
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
		gap: 14px;
		padding: 10px 14px;
		border-radius: 12px;
		border: 2px dashed var(--rule);
		background: rgba(255, 255, 255, 0.12);
	}
	.guide-icon {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.06);
		box-shadow: inset 0 0 0 3px currentColor;
	}
	.guide-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.guide-name {
		font-weight: 900;
		letter-spacing: 2px;
		color: var(--ink);
		text-transform: uppercase;
	}
	.kv-grid {
		display: grid;
		gap: 8px;
		font-size: 12px;
	}
	.k {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 2px;
		color: var(--muted);
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
		padding: 10px 14px;
		border-radius: 10px;
		border: 2px dashed var(--rule);
		color: var(--ink);
		font-weight: 700;
	}
	.callout {
		padding: 14px;
		border-radius: 12px;
		border: 3px solid var(--rule);
		background: rgba(0, 0, 0, 0.04);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.callout.gold {
		border-color: var(--gold);
		background: var(--gold-bg);
	}
	.callout.red {
		border-color: var(--red);
		background: var(--red-bg);
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
		font-weight: 800;
		color: var(--red);
	}
	.rtp-grid {
		display: grid;
		gap: 8px;
	}
	.rtp-cell {
		padding: 10px 12px;
		border-radius: 10px;
		border: 2px solid var(--rule);
		background: rgba(255, 255, 255, 0.12);
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.rtp-k {
		font-size: 10px;
		letter-spacing: 2px;
		font-weight: 800;
		text-transform: uppercase;
	}
	.rtp-v {
		font-weight: 800;
		color: var(--ink);
	}
	.vol {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}
	.vol-label {
		font-weight: 800;
		letter-spacing: 2px;
		color: var(--red);
	}
	.meter {
		display: flex;
		gap: 3px;
	}
	.seg {
		width: 22px;
		height: 8px;
		border-radius: 2px;
		background: rgba(0, 0, 0, 0.1);
	}
	.seg.on {
		background: var(--red);
	}
</style>
