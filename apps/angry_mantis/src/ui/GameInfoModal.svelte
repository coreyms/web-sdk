<script lang="ts">
	// Game Info: sticky tab strip + scroll-spied sections. Stake Engine requires full feature
	// disclosure here — paytable, modes, Feast floor/max-win odds, max win, RTP, volatility, and the
	// verbatim rules disclaimer (gameInfoText.ts). All numbers come from config / the math run.
	import { stateBet, stateModal, stateUrlDerived } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import Icon from './Icon.svelte';
	import config from '../game/config';
	import { DISCLAIMER, RULES_SECTIONS } from '../game/gameInfoText';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { master, scale, left, top, compact = false }: Props = $props();

	const open = $derived(stateModal.modal?.name === 'gameRules' || stateModal.modal?.name === 'payTable');
	const close = () => (stateModal.modal = null);

	const SECTIONS = [
		{ id: 'paytable', label: 'Paytable' },
		{ id: 'ways', label: 'Ways' },
		{ id: 'modes', label: 'Bet Modes' },
		{ id: 'feast', label: 'Feast Disclosure' },
		{ id: 'eating', label: 'Eating Mechanic' },
		{ id: 'maxwin', label: 'Max Win' },
		{ id: 'rtp', label: 'RTP' },
		{ id: 'volatility', label: 'Volatility' },
		{ id: 'rules', label: 'Rules' },
		{ id: 'version', label: 'Version' },
	];

	const SYMBOL_META: Record<string, { name: string; color: string; kind: 'premium' | 'mid' | 'low' }> = {
		H1: { name: 'Marty', color: '#ffdc4a', kind: 'premium' },
		M1: { name: 'Beetle', color: '#C53C24', kind: 'mid' },
		M2: { name: 'Spider', color: '#9CD92F', kind: 'mid' },
		M3: { name: 'Scorpion', color: '#5AB6FF', kind: 'mid' },
		L1: { name: 'Fly', color: '#fff', kind: 'low' },
		L2: { name: 'Caterpillar', color: '#fff', kind: 'low' },
		L3: { name: 'Lightning Bug', color: '#fff', kind: 'low' },
		L4: { name: 'Moth', color: '#fff', kind: 'low' },
	};
	const paying = [...config.eatOrder].reverse();
	const pays = (sym: string) => {
		const table = config.symbols[sym as keyof typeof config.symbols].paytable as readonly Record<string, number>[] | null;
		const map: Record<string, number> = {};
		table?.forEach((entry) => Object.entries(entry).forEach(([k, v]) => (map[k] = v)));
		return ['3', '4', '5'].map((k) => map[k] ?? 0);
	};
	const social = $derived(stateUrlDerived.social());
	const payText = (mult: number) => (social ? `${mult}×` : numberToCurrencyString(mult * stateBet.betAmount));

	const SPECIALS = [
		{ glyph: 'W', name: 'Wild', color: '#ffdc4a', note: 'Substitutes for every paying symbol. Never lands on reel 1. Does not substitute for Marky scatters or Glowing Leaves.' },
		{ glyph: 'S', name: 'Marky Scatter', color: '#ff5a2c', note: `3 / 4 / 5 anywhere trigger Free Spins / Super Free Spins / Mantis Feast. In free spins each scatter adds +1 spin (up to +${config.freeSpins.maxRetrigger} per session); once the cap is reached scatters stop appearing.` },
		{ glyph: 'GL', name: 'Glowing Leaf', color: '#9CD92F', note: 'Free spins only. Each Glowing Leaf that lands is a Mantis Strike: the lowest-paying symbol still on the menu is eaten.' },
	];

	const MODES = [
		{ id: 'base', label: 'Base Game', accent: '#fff', cost: '1×', enter: 'Default play.', spins: 'One spin per stake.', mech: 'Standard 1,024 ways evaluation. 3, 4 or 5 Marky scatters trigger Free Spins, Super Free Spins or Mantis Feast.' },
		{ id: 'ante', label: 'Ante', accent: '#e8b04a', cost: `${config.betModes.ante.cost}×`, enter: 'Activate from the bonus menu; stays on until switched off.', spins: 'One spin per stake.', mech: 'Doubles the cost of each spin. A Marky scatter is locked onto reel 1 every spin, so only two more are needed for a feature. Cannot be combined with a direct bonus buy.' },
		{ id: 'bonus', label: 'Free Spins', accent: '#9CD92F', cost: `${config.betModes.bonus.cost}×`, enter: 'Land 3 Marky scatters, or buy directly.', spins: `${config.freeSpins.free} Free Spins.`, mech: 'Marty hosts. An opening bite eats the lowest-paying symbol for the rest of the session; every Glowing Leaf that lands is another strike.' },
		{ id: 'super', label: 'Super Free Spins', accent: '#C53C24', cost: `${config.betModes.super.cost}×`, enter: 'Land 4 Marky scatters, or buy directly.', spins: `${config.freeSpins.super} Free Spins.`, mech: 'Marky hosts on reels with more Glowing Leaves, so symbols are eaten faster and wins escalate sooner.' },
		{ id: 'feast', label: 'Mantis Feast', accent: '#ffdc4a', cost: `${config.betModes.feast.cost.toLocaleString()}×`, enter: 'Land 5 Marky scatters, or buy directly.', spins: `${config.freeSpins.feast} Free Spins.`, mech: 'Marty AND Marky feed: two opening bites, both mantises strike, and the session pays at least 300× the bet.' },
	];

	let active = $state('paytable');
	let contentEl: HTMLDivElement | undefined = $state();
	let navEl: HTMLDivElement | undefined = $state();
	const sectionEls: Record<string, HTMLElement> = {};

	const jump = (id: string) => {
		const el = sectionEls[id];
		if (el && contentEl) contentEl.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
		active = id;
	};
	const onScroll = () => {
		if (!contentEl) return;
		const y = contentEl.scrollTop;
		let current = SECTIONS[0].id;
		for (const s of SECTIONS) {
			const el = sectionEls[s.id];
			if (el && el.offsetTop <= y + 60) current = s.id;
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
				<p>Pays per way for 3, 4 and 5 of a kind, multiplied by the number of matching ways. Wins pay left to right on adjacent reels starting from reel 1. Only the highest win per symbol is paid. Base game wins are capped at 250× the bet per spin.</p>
				<div class="pay-grid" style:grid-template-columns={compact ? '1fr' : 'repeat(2, minmax(0,1fr))'}>
					{#each paying as sym (sym)}
						{@const meta = SYMBOL_META[sym]}
						<div class="row">
							<div class="glyph" style:color={meta.color} style:background="radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.4) 0%, transparent 50%), linear-gradient(180deg, {meta.color}33, {meta.color}11)" style:box-shadow="inset 0 0 0 1.5px {meta.color}77, 0 0 18px {meta.color}33" style:width="{compact ? 36 : 44}px" style:height="{compact ? 36 : 44}px">{sym}</div>
							<div class="row-main">
								<div class="row-name" style:color={meta.kind === 'low' ? 'rgba(255,255,255,.8)' : meta.color}>{meta.name}</div>
								<div class="row-kind">{meta.kind === 'premium' ? 'Premium' : meta.kind === 'mid' ? 'Mid' : 'Low'}</div>
							</div>
							<div class="pays">
								{#each pays(sym) as p, i}
									<div class="pay"><div class="pay-k">{3 + i}×</div><div class="slot-num pay-v">{payText(p)}</div></div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				<div class="divider"></div>
				<div class="subhead">Special Symbols</div>
				<div class="pay-grid" style:grid-template-columns="1fr">
					{#each SPECIALS as s (s.glyph)}
						<div class="row top">
							<div class="glyph" style:color={s.color} style:background="radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.4) 0%, transparent 50%), linear-gradient(180deg, {s.color}33, {s.color}11)" style:box-shadow="inset 0 0 0 1.5px {s.color}77, 0 0 18px {s.color}33" style:width="{compact ? 36 : 44}px" style:height="{compact ? 36 : 44}px">{s.glyph}</div>
							<div class="row-main">
								<div class="row-name" style:color={s.color}>{s.name}</div>
								<div class="note">{s.note}</div>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section bind:this={sectionEls.ways}>
				<h2>Ways Structure</h2>
				<p><strong>1,024 ways.</strong> 5 reels × 4 rows. Wins evaluate left to right from reel 1 on any row. Matching symbol counts on each consecutive reel multiply together; different symbols' wins add up within a spin.</p>
				<p>Example: 3 matching symbols on reel 1, 2 on reel 2 and 4 on reel 3 = 3 × 2 × 4 = 24 ways paying the 3-of-a-kind prize.</p>
			</section>

			<section bind:this={sectionEls.modes}>
				<h2>All Bet Modes</h2>
				<p>Five modes. Base and Ante are bet-by-bet; the features are entered by Marky scatters or a direct bonus buy.</p>
				<div class="modes">
					{#each MODES as m (m.id)}
						<div class="mode" style:box-shadow="inset 0 0 0 1px {m.accent}33, inset 0 1px 0 rgba(255,255,255,.05)">
							<div class="mode-head">
								<div class="mode-name" style:color={m.accent} style:font-size="{compact ? 14 : 16}px">{m.label}</div>
								<div class="mode-meta"><span>COST <b class="slot-num" style:color={m.accent}>{m.cost}</b></span><span>RTP <b class="slot-num">{(config.rtp * 100).toFixed(2)}%</b></span></div>
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
				<div class="callout" style:border-color="#ffdc4a55" style:box-shadow="inset 0 1px 0 rgba(255,255,255,.05), 0 0 22px #ffdc4a22">
					<p><strong>Minimum guaranteed return:</strong> every Mantis Feast session pays at least <span class="slot-num mono">300× bet</span>. This floor is paid out of the {config.betModes.feast.cost.toLocaleString()}× purchase price.</p>
					<p><strong>Max win probability:</strong> approximately <span class="slot-num mono">1 in 50</span> Mantis Feast sessions reaches the {config.maxWin.toLocaleString()}× max win cap. Other sessions land between the 300× floor and the cap, with the payout distribution skewed toward the floor.</p>
					<p class="dim">These figures are disclosed openly per Stake Engine approval requirements.</p>
				</div>
			</section>

			<section bind:this={sectionEls.eating}>
				<h2>Free Games Eating Mechanic</h2>
				<p>During Free Spins, Super Free Spins and Mantis Feast, <strong>Marty</strong> (green mantis) and/or <strong>Marky</strong> (red mantis) strike the reels.</p>
				<ul>
					<li>When a session starts the host takes an opening bite (Mantis Feast: both mantises bite).</li>
					<li>Each bite <strong>eats the lowest-paying symbol</strong> still on the menu, removing it from the reels for the rest of the session.</li>
					<li>Each <strong style="color:#9CD92F">Glowing Leaf</strong> that lands triggers <strong>one additional strike</strong>.</li>
					<li>Fewer symbols on the reels means the remaining symbols land more often, so wins escalate as the session goes on.</li>
					<li>If all eight paying symbols are eaten, the round pays the {config.maxWin.toLocaleString()}× max win immediately and the session ends.</li>
				</ul>
			</section>

			<section bind:this={sectionEls.maxwin}>
				<h2>Max Win</h2>
				<div class="callout" style:border-color="#ff5a2c55" style:box-shadow="inset 0 1px 0 rgba(255,255,255,.05), 0 0 22px #ff5a2c22">
					<div class="maxwin-line"><span class="slot-num maxwin" style:font-size="{compact ? 22 : 36}px">{config.maxWin.toLocaleString()}×</span><span class="dim">bet — hard cap</span></div>
					<p>The total payout of any round is capped at {config.maxWin.toLocaleString()}× the bet. Once the cap is reached the round ends immediately and the cap is paid.</p>
				</div>
			</section>

			<section bind:this={sectionEls.rtp}>
				<h2>Return to Player (RTP)</h2>
				<div class="rtp-grid" style:grid-template-columns={compact ? '1fr 1fr' : 'repeat(5, 1fr)'}>
					{#each MODES as m (m.id)}
						<div class="rtp-cell" style:box-shadow="inset 0 0 0 1px {m.accent}33">
							<div class="rtp-k" style:color={m.accent}>{m.label.split(' ')[0]}</div>
							<div class="slot-num rtp-v" style:font-size="{compact ? 18 : 22}px">{(config.rtp * 100).toFixed(2)}%</div>
						</div>
					{/each}
				</div>
				<p>Every bet mode has a theoretical return to player of <span class="slot-num mono">{(config.rtp * 100).toFixed(2)}%</span>, calculated over many millions of simulated plays.</p>
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
	.panel {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		background: linear-gradient(180deg, rgba(28, 18, 40, 0.88) 0%, rgba(10, 6, 18, 0.92) 100%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.06);
		overflow: hidden;
		pointer-events: auto;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 100%);
	}
	.h-title {
		font-weight: 900;
		letter-spacing: 2.5px;
		color: #fff;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
	}
	.x {
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.4);
		box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.7);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tabs {
		display: flex;
		gap: 4px;
		overflow-x: auto;
		overflow-y: hidden;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(0, 0, 0, 0.25);
		scrollbar-width: thin;
	}
	.tab {
		flex: 0 0 auto;
		border-radius: 8px;
		background: transparent;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.65);
		font-weight: 800;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.tab.on {
		background: linear-gradient(180deg, rgba(255, 220, 74, 0.22) 0%, rgba(255, 170, 60, 0.1) 100%);
		box-shadow: inset 0 0 0 1px rgba(255, 220, 74, 0.55), inset 0 -2px 0 rgba(255, 220, 74, 0.35);
		color: #ffdc4a;
	}
	.content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		line-height: 1.6;
		color: rgba(238, 240, 246, 0.85);
		overscroll-behavior: contain;
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
		letter-spacing: 2px;
		color: #ffdc4a;
		text-transform: uppercase;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
	}
	p {
		margin: 0;
	}
	strong {
		color: #fff;
		font-weight: 800;
	}
	.mono {
		color: #fff;
		font-weight: 700;
	}
	.dim {
		color: rgba(238, 240, 246, 0.6);
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
		letter-spacing: 2px;
		font-weight: 800;
		color: rgba(238, 240, 246, 0.55);
		text-transform: uppercase;
		margin-top: 6px;
	}
	.divider {
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12), transparent);
		margin: 8px 0;
	}
	.pay-grid {
		display: grid;
		gap: 8px;
		margin-top: 8px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.03);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
	}
	.row.top {
		align-items: flex-start;
	}
	.glyph {
		border-radius: 10px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 900;
		font-size: 16px;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
	}
	.row-main {
		flex: 1;
		min-width: 0;
	}
	.row-name {
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 1px;
		text-transform: uppercase;
	}
	.row-kind {
		font-size: 10px;
		color: rgba(238, 240, 246, 0.45);
		letter-spacing: 0.5px;
		margin-top: 2px;
	}
	.note {
		color: rgba(238, 240, 246, 0.7);
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
		color: rgba(238, 240, 246, 0.4);
	}
	.pay-v {
		font-size: 13px;
		color: #fff;
		font-weight: 700;
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
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(0, 0, 0, 0.4) 100%);
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
		letter-spacing: 1.5px;
		text-transform: uppercase;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
	}
	.mode-meta {
		display: flex;
		gap: 12px;
		font-size: 12px;
		color: rgba(238, 240, 246, 0.55);
	}
	.mode-meta b {
		color: #fff;
		font-weight: 700;
	}
	.kv-grid {
		display: grid;
		gap: 8px;
		font-size: 12px;
	}
	.k {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 1.5px;
		color: rgba(238, 240, 246, 0.45);
		text-transform: uppercase;
	}
	.v {
		color: rgba(238, 240, 246, 0.85);
		margin-top: 2px;
	}
	.kv {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.04);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
		color: #fff;
	}
	.callout {
		padding: 14px;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid transparent;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.callout.muted {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.08);
	}
	.maxwin-line {
		display: flex;
		align-items: baseline;
		gap: 12px;
		flex-wrap: wrap;
	}
	.maxwin {
		font-weight: 800;
		color: #fff;
	}
	.rtp-grid {
		display: grid;
		gap: 8px;
	}
	.rtp-cell {
		padding: 10px 12px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.03);
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.rtp-k {
		font-size: 10px;
		letter-spacing: 1.5px;
		font-weight: 800;
		text-transform: uppercase;
	}
	.rtp-v {
		font-weight: 700;
		color: #fff;
	}
	.vol {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}
	.vol-label {
		font-weight: 800;
		color: #ff5a2c;
	}
	.meter {
		display: flex;
		gap: 3px;
	}
	.seg {
		width: 22px;
		height: 8px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.1);
	}
	.seg.on {
		background: #ff5a2c;
		box-shadow: 0 0 8px rgba(255, 90, 44, 0.55);
	}
</style>
