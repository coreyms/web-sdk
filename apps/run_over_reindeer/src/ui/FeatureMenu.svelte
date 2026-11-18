<script lang="ts">
	// THE FAST LANE: Run Over Reindeer's feature menu, the redesign of 2026-11-17 (Corey: "Yes build the fast lane menu
	// in the game"; the approved mock is ~/Desktop/Run Over Reindeer/fast_lane_menu_2026-11-17/mock/fast_lane_menu.html,
	// built on the structure of Manticore's Armoury). A full screen takeover over the tinted game:
	//   HERO     the chosen mode's picture over turning rays: the teal present (Free Spins), the red present (Super Free
	//            Spins, design E of scatter_present_red_r1), the Ante's sign with three lines ANTE / PLAY / 2X
	//   PLATE    a green highway guide sign: the mode's name, its line, the Ante's LEVEL stops, the odds rows as
	//            distance sign rows, the yellow amount plaque and the red ACTIVATE (SWITCH OFF / UNLOAD once it is on)
	//   TRAY     the tiles: ONE Ante tile (its level is picked on the plate, Corey 2026-11-09: one card with a slider,
	//            never three tiles), Free Spins, Super Free Spins
	//   CONFIRM  ACTIVATE (or CHANGE) opens a white regulatory sign card: the amounts, what happens, CONFIRM / Cancel
	//   HUD      BALANCE and PLAY AMOUNT with the real minus and plus rules (ui/betStep.ts), since the game's HUD fades
	//            under every modal
	//
	// What CONFIRM does is the house flow of the menu before it (ui/controls.svelte.ts), unchanged:
	//   a feature  controls.buyMode: loads it on the Spin button for ONE round. Nothing is charged and nothing plays
	//              until the player presses Spin; the round's end returns the game to the base game.
	//   the Ante   controls.activateMode: switches the chosen level on; it stays on until switched off here.
	// UNLOAD and SWITCH OFF (controls.cancelArmed) need no card. Prices are the RGS's cost multipliers
	// (game/betModeMeta.ts modeCost) times the current amount, never a number from a data file; every figure on the
	// plate is a row of game/featureMenuData.ts. The mock's volatility noses are not drawn: the game has no volatility
	// figure to show.
	//
	// LAYOUT. Three layouts, each authored in its own design px inside ONE box scaled by one transform:
	//   desk  a landscape screen at least 960 x 560: the mock's 1440 x 900 box, absolutely placed, fitted and centred,
	//         at most 1.2 (DESK_MAX_SCALE: the art's density is built for that)
	//   side  a phone held sideways (or any other short landscape): 390 design px tall, three columns
	//   up    an upright screen: 390 design px wide, one column; the hero is the piece that gives, and it is dropped
	//         when too little is left for it
	// Nothing scrolls. No filter, mask or backdrop: the rays are an inline SVG with a gradient fill, the tint a flat
	// colour layer.
	import { tick, untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateBet, stateConfig, stateModal } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import type { Controls } from './controls.svelte';
	import ModalShell from './ModalShell.svelte';
	import Icon from './Icon.svelte';
	import HudIcon from './hud/HudIcon.svelte';
	import { betStepTarget } from './betStep';
	import { ANTE_KEYS, modeCost } from '../game/betModeMeta';
	import { stamp } from '../game/assets';
	import { PHONE_TIER } from '../game/deviceTier';
	import { ANTE_ODDS, BUY_ODDS, FAST_LANE_TEXT as X, FEATURE_MENU_TEXT as T, MAX_WIN_NOTE, ODDS_ARE_PROVISIONAL, type OddsRow } from '../game/featureMenuData';

	type Props = { controls: Controls; master: { width: number; height: number }; scale: number; left: number; top: number; compact?: boolean };
	const { controls }: Props = $props();

	const open = $derived(stateModal.modal?.name === 'buyBonus');
	const close = () => (stateModal.modal = null);

	// ---- the box -------------------------------------------------------------------------------------------------
	const DESK = { w: 1440, h: 900 };
	const DESK_MAX_SCALE = 1.2;
	const SIDE = { w: 844, h: 390 };
	const SIDE_MAX_SCALE = 1.15;
	const UP_W = 390;
	const UP_MIN_H = 600;
	const UP_MAX_SCALE = 1.15;

	const vw = $derived(innerWidth.current ?? 1280);
	const vh = $derived(innerHeight.current ?? 720);
	type Lay = 'desk' | 'side' | 'up';
	const lay = $derived<Lay>(vw > vh ? (vw >= 960 && vh >= 560 ? 'desk' : 'side') : 'up');
	const box = $derived.by(() => {
		if (lay === 'desk') {
			const s = Math.min(vw / DESK.w, vh / DESK.h, DESK_MAX_SCALE);
			return { s, w: DESK.w, h: DESK.h, x: (vw - DESK.w * s) / 2, y: (vh - DESK.h * s) / 2 };
		}
		const s = lay === 'side' ? Math.min(vh / SIDE.h, vw / SIDE.w, SIDE_MAX_SCALE) : Math.min(vw / UP_W, vh / UP_MIN_H, UP_MAX_SCALE);
		return { s, w: vw / s, h: vh / s, x: 0, y: 0 };
	});
	/** a short upright screen (390 x 620 and the like): the plate's line gives way to the odds rows */
	const short = $derived(lay === 'up' && box.h < 700);
	// "three or four short odds rows": four where there is room, three on a short upright screen (the menu never scrolls)
	const oddsShown = $derived(lay === 'up' && box.h < 740 ? 3 : 4);

	const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// ---- the art (tools/build_fast_lane_art.py; the phone tier on the phone asset tier) ---------------------------------
	const TIER = PHONE_TIER ? 'phone' : 'full';
	const ART = {
		BONUS: stamp(`/assets/fastlane/present-teal-${TIER}.webp`),
		SUPER: stamp(`/assets/fastlane/present-red-${TIER}.webp`),
		ANTE: stamp(`/assets/fastlane/sign-blank-${TIER}.webp`),
	};
	// warm the three pictures once the game is up, so the first open draws them at once
	$effect(() => {
		const t = setTimeout(() => {
			for (const src of Object.values(ART)) {
				const im = new Image();
				im.decoding = 'async';
				im.src = src;
			}
		}, 3000);
		return () => clearTimeout(t);
	});

	// ---- the state ---------------------------------------------------------------------------------------------------
	type Pick = 'ANTE' | 'BONUS' | 'SUPER';
	const activeKey = $derived(stateBet.activeBetModeKey.toUpperCase());
	const armed = $derived(controls.armedBuy());
	const anteOn = $derived(ANTE_KEYS.includes(activeKey) ? activeKey : null);

	/** the tile chosen */
	let sel = $state<Pick>('BONUS');
	/** the Ante's level stop: it opens on the level that is on, else on the lowest one (2x; Corey 2026-11-17: "default to 2x not 4x") */
	let stop = $state(0);
	let confirmOpen = $state(false);
	/** the mode just switched off or unloaded here: its plate says so until another tile or level is picked */
	let note = $state<string | null>(null);
	$effect(() => {
		if (!open) return;
		untrack(() => {
			const i = anteOn ? ANTE_KEYS.indexOf(anteOn) : -1;
			stop = i >= 0 ? i : 0;
			sel = armed === 'BONUS' || armed === 'SUPER' ? armed : anteOn ? 'ANTE' : 'BONUS';
			confirmOpen = false;
			note = null;
		});
	});
	// the menu closes the card with it
	$effect(() => {
		if (!open) confirmOpen = false;
	});

	const anteKey = $derived(ANTE_KEYS[stop] ?? ANTE_KEYS[0]);
	const isAnte = $derived(sel === 'ANTE');
	/** the mode the hero and the plate show */
	const key = $derived(isAnte ? anteKey : sel);
	const on = $derived(isAnte ? anteOn === anteKey : armed === sel);
	const otherAnteOn = $derived(isAnte && anteOn !== null && anteOn !== anteKey);
	const cost = $derived(stateBet.betAmount * modeCost(key));
	const lowBal = $derived(!on && cost > stateBet.balanceAmount);
	const busy = $derived(controls.bonusDisabled());

	if (import.meta.env.DEV && typeof window !== 'undefined') {
		// house rule: extend __reindeer, never a new global (tools/fast_lane_probe.mjs checks every price against the
		// RGS's own cost multiplier, the authenticate answer in stateConfig.betModes, not modeCost's fallback)
		const rgsCost = (k: string) => stateConfig.betModes[k.toUpperCase()]?.costMultiplier;
		((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}).fastLane = {
			rgsCost,
			expect: (k: string) => numberToCurrencyString(stateBet.betAmount * (rgsCost(k) ?? Number.NaN)),
		};
	}

	const mult = (k: string) => `${modeCost(k)}x`;
	const money = (n: number) => numberToCurrencyString(n);
	const nameOf = (k: string) => (ANTE_KEYS.includes(k) ? `${X.ante} ${mult(k)}` : T.cards[k as 'BONUS' | 'SUPER'].title);
	const anteList = $derived.by(() => {
		const m = ANTE_KEYS.map(mult);
		return m.length > 1 ? `${m.slice(0, -1).join(', ')} or ${m[m.length - 1]}` : (m[0] ?? '');
	});
	const rowsOf = (k: string): OddsRow[] => (ANTE_KEYS.includes(k) ? (ANTE_ODDS[k] ?? []) : (BUY_ODDS[k as 'BONUS' | 'SUPER'] ?? []));

	// the mock's colours: an accent (rays, the plate's top rule, the chosen tile's bar) and the tint over the game
	const LOOK: Record<string, { accent: string; tint: string }> = {
		ANTE_2: { accent: '#f5b301', tint: '#2b2003' },
		ANTE_4: { accent: '#ff7a1a', tint: '#301704' },
		ANTE_10: { accent: '#ff3d8b', tint: '#330a1e' },
		BONUS: { accent: '#3d8bff', tint: '#061a3c' },
		SUPER: { accent: '#ff4a55', tint: '#36070c' },
	};
	const look = $derived(LOOK[key] ?? LOOK.ANTE_4);

	// ---- words with bold runs (** in the data) ------------------------------------------------------------------------
	type Run = { t: string; b: boolean };
	const runs = (s: string, fill: Record<string, string> = {}): Run[] =>
		s
			.replace(/\{(\w+)\}/g, (_, k: string) => fill[k] ?? '')
			.split('**')
			.map((t, i) => ({ t, b: i % 2 === 1 }))
			.filter((r) => r.t !== '');
	/** the line under the name: the mode's own, or what is on / what was just switched off */
	const status = $derived.by<Run[] | null>(() => {
		if (on) return runs(isAnte ? X.anteOn : X.loaded, { amount: money(cost) });
		if (note === key) return runs(isAnte ? X.anteOff : X.unloaded, { name: nameOf(key), amount: money(stateBet.betAmount) });
		return null;
	});
	const say = $derived(runs(X.say[key] ?? ''));

	// ---- presses -----------------------------------------------------------------------------------------------------
	let actBtn = $state<HTMLButtonElement>();
	let okBtn = $state<HTMLButtonElement>();
	const levelBtns: HTMLButtonElement[] = [];

	const pick = (p: Pick) => {
		if (p === sel) return;
		sel = p;
		note = null;
		controls.sound('soundPressSub');
	};
	const setStop = (i: number) => {
		if (i === stop || i < 0 || i >= ANTE_KEYS.length) return;
		stop = i;
		note = null;
		controls.sound('soundPressSub');
	};
	/** the level stops are one radio group: the arrows, Home and End move along it */
	const levelKey = (e: KeyboardEvent) => {
		const to = { ArrowLeft: stop - 1, ArrowDown: stop - 1, ArrowRight: stop + 1, ArrowUp: stop + 1, Home: 0, End: ANTE_KEYS.length - 1 }[e.key];
		if (to === undefined) return;
		e.preventDefault();
		const i = Math.max(0, Math.min(ANTE_KEYS.length - 1, to));
		setStop(i);
		levelBtns[i]?.focus();
	};
	const activate = () => {
		if (lowBal || busy) return;
		controls.sound('soundPressMinor');
		confirmOpen = true;
		tick().then(() => okBtn?.focus());
	};
	const cancel = () => {
		controls.sound('soundPressMinor');
		confirmOpen = false;
		tick().then(() => actBtn?.focus());
	};
	const confirmPress = () => {
		if (busy) return;
		confirmOpen = false;
		if (isAnte) {
			controls.sound('soundPressMinor');
			controls.activateMode(anteKey); // also closes the menu
		} else {
			controls.buyMode(sel); // arms it, closes the menu, voices the press
		}
	};
	const switchOff = () => {
		controls.sound('soundPressMinor');
		note = key;
		controls.cancelArmed();
		tick().then(() => actBtn?.focus());
	};
	/** a tap on the tinted game outside every piece closes the menu (as before); a tap on a piece never does */
	const stageClick = (e: MouseEvent) => {
		if ((e.target as Element | null)?.closest?.('[data-piece]')) e.stopPropagation();
	};

	// ---- fit: a long amount shrinks its type to its box, never overflows ---------------------------------------------
	const fit = (node: HTMLElement, _text: unknown) => {
		const run = () => {
			node.style.fontSize = '';
			const cw = node.clientWidth;
			const sw = node.scrollWidth;
			if (cw > 0 && sw > cw) {
				const base = parseFloat(getComputedStyle(node).fontSize);
				node.style.fontSize = `${Math.max(9, Math.floor(((base * cw) / sw) * 0.97))}px`;
			}
		};
		run();
		document.fonts?.ready.then(run);
		return { update: run };
	};

	// ---- motion: transform and opacity only ---------------------------------------------------------------------------
	const passIn = (_n: Element) => ({
		duration: reduced ? 0 : 300,
		delay: reduced ? 0 : 190,
		easing: cubicOut,
		css: (t: number, u: number) => `transform: translateX(${46 * u}%) scale(${0.86 + 0.14 * t}); opacity: ${t}`,
	});
	const passOut = (_n: Element) => ({
		duration: reduced ? 0 : 200,
		css: (t: number, u: number) => `transform: translateX(${-46 * u}%) scale(${1 + 0.12 * u}); opacity: ${t}`,
	});

	// the rays: 20 wedges of 5 degrees every 18, filled with a radial fade in the accent (the mock's conic rays and
	// their radial mask, drawn as one vector picture: no mask)
	const RAYS = Array.from({ length: 20 }, (_, i) => {
		const a0 = ((i * 18 - 90) * Math.PI) / 180;
		const a1 = ((i * 18 + 5 - 90) * Math.PI) / 180;
		const p = (a: number) => `${(100 * Math.cos(a)).toFixed(2)} ${(100 * Math.sin(a)).toFixed(2)}`;
		return `M0 0L${p(a0)}A100 100 0 0 1 ${p(a1)}Z`;
	}).join('');
</script>

{#snippet rich(rs: Run[])}{#each rs as r, i (i)}{#if r.b}<b>{r.t}</b>{:else}{r.t}{/if}{/each}{/snippet}

{#snippet sign(k: string)}
	<span class="sign"><img alt="" src={ART.ANTE} draggable="false" /><span class="num"><i>{X.signTop}</i><i>{X.signMid}</i><b class:wide={modeCost(k) >= 10}>{modeCost(k)}X</b></span></span>
{/snippet}

{#snippet art(p: Pick)}
	{#if p === 'ANTE'}{@render sign(anteKey)}{:else}<img class="pres" alt="" src={ART[p]} draggable="false" />{/if}
{/snippet}

{#snippet tile(p: Pick, i: number)}
	{@const tileOn = p === 'ANTE' ? anteOn !== null : armed === p}
	{@const label = p === 'ANTE' ? `${X.ante}, ${X.tileAnte}, ${anteList} ${X.timesAmount}${tileOn ? `, ${T.cards.ANTE.on.toLowerCase()}` : ''}` : `${T.cards[p].title}, ${X.tileFeature}, ${modeCost(p)} ${X.timesAmount}${tileOn ? `, ${T.armed.toLowerCase()}` : ''}`}
	<button class="tile" class:wide={p === 'ANTE'} class:sel={sel === p} style:--i={i} data-card={p} aria-label={label} aria-pressed={sel === p} onclick={() => pick(p)}>
		{#if tileOn}<span class="chip">{p === 'ANTE' ? T.cards.ANTE.on : T.armed}</span>{/if}
		<span class="face">
			<span class="thumb">{@render art(p)}</span>
			<span class="txt">
				<span class="nm">{p === 'ANTE' ? X.ante : p === 'SUPER' ? 'SUPER' : T.cards.BONUS.title}</span>
				{#if p === 'ANTE'}<span class="mult">{anteList} <small>{T.perSpin.toLowerCase()}</small></span>{:else}<span class="mult slot-num">{mult(p)}</span>{/if}
			</span>
		</span>
	</button>
{/snippet}

<ModalShell {open} onclose={close} master={{ width: 0, height: 0 }} scale={1} left={0} top={0} dim="rgba(0,0,0,0)" zIndex={2}>
	<div class="fl" class:reduced style:--accent={look.accent} data-feature-menu data-layout={lay}>
		<div class="tint" style:background-color={look.tint}></div>
		<!-- the box: one transform; the pieces take the pointer, the gaps between them close the menu as before -->
		<div class="stage {lay}" class:short inert={confirmOpen} style:width="{box.w}px" style:height="{box.h}px" style:transform="translate({box.x}px, {box.y}px) scale({box.s})" onclick={stageClick} role="presentation">
			<div class="road" aria-hidden="true"></div>

			<div class="title" data-piece><i></i><span>{T.name}</span><i></i></div>

			<div class="hud" data-piece>
				<div class="bal"><div class="lab">{X.balance}</div><div class="val slot-num" use:fit={controls.balanceText()} data-fl-balance>{controls.balanceText()}</div></div>
				<div class="amt-block">
					<div class="lab">{X.amount}</div>
					<div class="amt-row">
						<button class="step" disabled={betStepTarget(-1) === undefined || busy} aria-label={X.lower} onclick={() => {
							const v = betStepTarget(-1);
							if (v === undefined) return;
							controls.sound('soundPressGeneral');
							controls.setBet(v, { silent: true });
						}} data-fl-step="minus"><HudIcon name="minus" /></button>
						<div class="val slot-num" use:fit={stateBet.betAmount} data-fl-amount>{money(stateBet.betAmount)}</div>
						<button class="step" disabled={betStepTarget(1) === undefined || busy} aria-label={X.raise} onclick={() => {
							const v = betStepTarget(1);
							if (v === undefined) return;
							controls.sound('soundPressGeneral');
							controls.setBet(v, { silent: true });
						}} data-fl-step="plus"><HudIcon name="plus" /></button>
					</div>
				</div>
			</div>

			<button class="close" data-piece aria-label={T.close} onclick={(e) => (e.stopPropagation(), close())}><Icon name="close" s={lay === 'desk' ? 26 : 18} /></button>

			<div class="hero" data-piece aria-hidden="true">
				<div class="rays-box">
					<svg class="rays" viewBox="-100 -100 200 200">
						<defs>
							<radialGradient id="fl-rays-fade" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="100">
								<stop offset="0.34" style:stop-color="var(--accent)" stop-opacity="1" />
								<stop offset="0.96" style:stop-color="var(--accent)" stop-opacity="0" />
							</radialGradient>
						</defs>
						<path d={RAYS} fill="url(#fl-rays-fade)" />
					</svg>
				</div>
				{#key sel}
					<div class="slide" in:passIn out:passOut>
						<div class="obj" class:bob={sel !== 'ANTE'}>{@render art(sel)}</div>
					</div>
				{/key}
			</div>

			<div class="plate" data-piece data-plate={key}>
				<div class="top">
					<div class="kick">{isAnte ? T.perSpin + X.kickAnteTail : X.kickFeature}</div>
					<h2 use:fit={nameOf(key)}>{nameOf(key)}</h2>
				</div>
				{#if status}
					<div class="status" data-fl-status>{@render rich(status)}</div>
				{:else if !short}
					<div class="say">{@render rich(say)}</div>
				{/if}
				{#if isAnte}
					<div class="lvl" role="radiogroup" aria-label={X.levelGroup}>
						<span class="kick">{X.level}</span>
						{#each ANTE_KEYS as k, i (k)}
							<button bind:this={levelBtns[i]} role="radio" aria-checked={i === stop} tabindex={i === stop ? 0 : -1} data-lvl={k} onclick={() => setStop(i)} onkeydown={levelKey}><span class="slot-num">{mult(k)}</span>{#if anteOn === k}<em>{T.cards.ANTE.on}</em>{/if}</button>
						{/each}
					</div>
				{/if}
				<div class="miles">
					{#each rowsOf(key).slice(0, oddsShown) as r (r.label)}
						<div class="mk">{r.label}</div>
						<div class="mv slot-num">{r.value}</div>
					{/each}
				</div>
				<div class="act">
					<div class="price"><div class="amt slot-num" use:fit={money(cost)} data-fl-price>{money(cost)}</div><div class="lab">{isAnte ? T.perSpin : T.total}</div></div>
					{#if on}
						<button class="go off" bind:this={actBtn} data-act="off" onclick={switchOff}>{isAnte ? T.cards.ANTE.switchOff : T.unload}</button>
					{:else}
						<button class="go" bind:this={actBtn} data-act="activate" disabled={lowBal || busy} onclick={activate}>{otherAnteOn ? T.cards.ANTE.change : T.cards.ANTE.button}</button>
					{/if}
				</div>
				{#if lowBal}<div class="low" data-fl-low>{X.low}</div>{/if}
			</div>

			<div class="tray" data-piece>
				<div class="group-h"><span class="kick">{T.perSpin}</span><span>{X.perSpinNote}</span></div>
				<div class="row one">{@render tile('ANTE', 0)}</div>
				<div class="group-h"><span class="kick">{X.features}</span><span>{X.featuresNote}</span></div>
				<div class="row two">{@render tile('BONUS', 1)}{@render tile('SUPER', 2)}</div>
			</div>

			<div class="note" data-piece data-menu-foot><span>{MAX_WIN_NOTE.label}: <b>{MAX_WIN_NOTE.value}</b>.</span><span data-average-note>{' ' + T.averageNote}</span>{#if ODDS_ARE_PROVISIONAL}<span data-provisional-odds>{' ' + T.provisionalNote}</span>{/if}</div>
		</div>
	</div>
</ModalShell>

<!-- the confirm card: its own shell, so Escape and a tap beside it close the card alone -->
<ModalShell open={open && confirmOpen} onclose={cancel} master={{ width: 0, height: 0 }} scale={1} left={0} top={0} dim="rgba(4,8,14,0.62)" zIndex={4}>
	<div class="cwrap">
		<!-- the click handler only keeps a press on the card from reaching the shell (which would close it) -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="card c-{lay}" style:transform="scale({box.s})" role="dialog" aria-modal="true" aria-labelledby="fl-confirm-title" tabindex="-1" data-fl-confirm onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
			<h3 id="fl-confirm-title">{X.confirmTitle.replace('{name}', nameOf(key))}</h3>
			<div class="rows">
				<div>{X.amount}</div><div class="slot-num">{money(stateBet.betAmount)}</div>
				<div>{nameOf(key)}</div><div class="slot-num">{mult(key)}</div>
				<div class="tot">{isAnte ? X.everySpin : T.total}</div><div class="tot slot-num" use:fit={money(cost)} data-fl-confirm-total>{money(cost)}</div>
			</div>
			<p>{@render rich(runs(isAnte ? X.confirmAnte : X.confirmFeature, { name: nameOf(key), amount: money(cost) }))}</p>
			<div class="btns">
				<button class="no" data-act="cancel" onclick={cancel}>{X.cancel}</button>
				<button class="go ok" bind:this={okBtn} data-act="confirm" disabled={busy} onclick={confirmPress}>{X.confirm}</button>
			</div>
		</div>
	</div>
</ModalShell>

<style>
	/* ── the palette (the mock's) ── */
	.fl,
	.cwrap {
		--green: #0b6b46;
		--green-deep: #064a31;
		--sign-white: #f7f8f3;
		--sign-black: #14161a;
		--yellow: #ffd21f;
		--red: #d3202f;
		--disp: 'Overpass', var(--ui-font-display), sans-serif;
		--read: 'Outfit Text', 'Outfit', system-ui, sans-serif;
	}
	.fl {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		user-select: none;
		-webkit-user-select: none;
	}
	.tint {
		position: absolute;
		inset: 0;
		opacity: 0.86;
		transition: background-color 320ms ease;
	}
	.stage {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: 0 0;
		box-sizing: border-box;
		font-family: var(--read);
		color: #f2f5f9;
		pointer-events: auto;
	}
	.stage [data-piece] {
		pointer-events: auto;
	}
	.stage button,
	.cwrap button {
		font: inherit;
		cursor: pointer;
		border: 0;
		padding: 0;
		margin: 0;
		background: none;
		color: inherit;
		-webkit-tap-highlight-color: transparent;
	}
	.stage button:focus-visible,
	.cwrap button:focus-visible {
		outline: 3px solid var(--yellow);
		outline-offset: 2px;
	}
	.kick {
		font-family: var(--disp);
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.slot-num {
		font-family: var(--disp);
		font-variant-numeric: tabular-nums;
	}
	.road {
		position: absolute;
		left: 0;
		right: 0;
		height: 6px;
		background: repeating-linear-gradient(90deg, var(--yellow) 0 46px, transparent 46px 78px);
		opacity: 0.5;
		pointer-events: none;
	}

	/* ── the title ── */
	.title {
		font-family: var(--disp);
		font-weight: 900;
		letter-spacing: 0.08em;
		color: var(--sign-white);
		display: flex;
		align-items: center;
		gap: 10px;
		white-space: nowrap;
		/* the turned diamonds reach past their own box by a few px: room for them */
		padding: 0 6px;
	}
	.title i {
		display: block;
		width: 0.46em;
		height: 0.46em;
		background: var(--yellow);
		transform: rotate(45deg);
		border: 2px solid var(--sign-black);
		flex: none;
	}

	/* ── the HUD ── */
	.hud .lab {
		font-family: var(--disp);
		font-weight: 800;
		letter-spacing: 0.14em;
		color: var(--yellow);
		white-space: nowrap;
	}
	.hud .val {
		font-weight: 900;
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		line-height: 1.1;
	}
	.amt-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.amt-row .val {
		flex: 1 1 0;
		min-width: 0;
		text-align: center;
	}
	.step {
		flex: none;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: #262b35 !important;
		border: 2px solid #5b6577 !important;
		color: #fff !important;
	}
	.step :global(.ic) {
		width: 55%;
		height: 55%;
	}
	.step:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.close {
		display: grid;
		place-items: center;
		border-radius: 12px;
		background: var(--sign-black) !important;
		border: 3px solid var(--sign-white) !important;
		color: #fff !important;
	}

	/* ── the hero ── */
	.hero {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		container-type: size;
		pointer-events: none;
	}
	.rays-box {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 150cqh;
		height: 150cqh;
		margin: -75cqh 0 0 -75cqh;
		opacity: 0.4;
	}
	.rays {
		display: block;
		width: 100%;
		height: 100%;
		animation: fl-spin 60s linear infinite;
		will-change: transform;
	}
	@keyframes fl-spin {
		to {
			transform: rotate(360deg);
		}
	}
	.slide {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.obj {
		height: var(--art-h);
		display: flex;
		align-items: center;
		justify-content: center;
		transform-origin: 50% 100%;
		animation: fl-sway 4.6s ease-in-out infinite;
	}
	.obj.bob {
		animation: fl-bob 3.4s ease-in-out infinite;
	}
	@keyframes fl-sway {
		0%,
		100% {
			transform: rotate(-1.6deg);
		}
		50% {
			transform: rotate(1.6deg);
		}
	}
	@keyframes fl-bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-9px);
		}
	}
	.pres {
		height: 100%;
		width: auto;
		display: block;
	}
	/* the Ante's sign: the game's own 10 sign with its face blanked, the level's three lines set on it */
	.sign {
		position: relative;
		display: inline-block;
		height: 100%;
		aspect-ratio: 863 / 1188;
	}
	.sign img {
		width: 100%;
		height: 100%;
		display: block;
	}
	.sign .num {
		position: absolute;
		left: 9.5%;
		right: 9.5%;
		top: 17.5%;
		height: 68.5%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-family: var(--disp);
		font-weight: 900;
		color: #0b0b0b;
		line-height: 1;
		container-type: size;
	}
	.sign .num i {
		font-style: normal;
		font-size: 21cqh;
		letter-spacing: 0.02em;
		line-height: 0.98;
	}
	.sign .num b {
		font-size: 42cqh;
		letter-spacing: -0.03em;
		line-height: 0.95;
		margin-top: 2cqh;
	}
	.sign .num b.wide {
		font-size: 38cqh;
	}

	/* ── the plate: a green guide sign ── */
	.plate {
		position: relative;
		box-sizing: border-box;
		background: linear-gradient(180deg, var(--green), var(--green-deep));
		border: 4px solid var(--sign-white);
		box-shadow:
			0 0 0 3px var(--green-deep),
			0 14px 30px rgba(0, 0, 0, 0.45);
		color: #fff;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}
	.plate::before {
		content: '';
		position: absolute;
		left: 22px;
		right: 22px;
		top: -9px;
		height: 6px;
		background: var(--accent);
		border-radius: 3px;
		transition: background-color 320ms ease;
	}
	.plate .kick {
		color: var(--yellow);
	}
	.plate h2 {
		margin: 0;
		font-family: var(--disp);
		font-weight: 900;
		letter-spacing: 0.02em;
		line-height: 1;
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
	}
	.say {
		color: #f1fbf5;
		line-height: 1.3;
	}
	.say b,
	.status b {
		color: var(--yellow);
		font-weight: 700;
	}
	.status {
		color: #fff;
		background: rgba(0, 0, 0, 0.28);
		border-radius: 8px;
		line-height: 1.3;
	}
	.miles {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		column-gap: 16px;
		font-family: var(--disp);
	}
	.miles div {
		border-top: 2px solid rgba(255, 255, 255, 0.28);
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.miles .mv {
		text-align: right;
		font-weight: 900;
	}
	.lvl {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.lvl .kick {
		color: #d7efe3;
		margin-right: 4px;
	}
	.lvl button {
		flex: 1 1 0;
		min-width: 44px;
		border: 3px solid var(--sign-white) !important;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.28) !important;
		color: #fff !important;
		font-family: var(--disp);
		font-weight: 900;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		white-space: nowrap;
	}
	.lvl button[aria-checked='true'] {
		background: var(--sign-white) !important;
		color: var(--sign-black) !important;
		border-color: var(--sign-black) !important;
		box-shadow: 0 0 0 3px var(--sign-white);
	}
	.lvl button em {
		font-style: normal;
		font-size: 0.55em;
		background: var(--yellow);
		color: var(--sign-black);
		border: 2px solid var(--sign-black);
		border-radius: 4px;
		padding: 1px 4px 0;
		letter-spacing: 0.04em;
	}
	.act {
		display: flex;
		align-items: flex-start;
		margin-top: auto;
	}
	.price {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		flex: 1 1 0;
		min-width: 0;
	}
	.price .amt {
		box-sizing: border-box;
		width: 100%;
		background: var(--yellow);
		color: var(--sign-black);
		border: 4px solid var(--sign-black);
		outline: 3px solid var(--yellow);
		border-radius: 10px;
		font-weight: 900;
		text-align: center;
		line-height: 1;
		white-space: nowrap;
		overflow: hidden;
	}
	.price .lab {
		font-family: var(--disp);
		font-weight: 800;
		letter-spacing: 0.16em;
		color: #d7efe3;
		white-space: nowrap;
	}
	.go {
		flex: 1 1 0;
		min-width: 0;
		background: linear-gradient(180deg, #ee3344, #b9141f) !important;
		color: #fff !important;
		border: 4px solid var(--sign-white) !important;
		border-radius: 12px;
		font-family: var(--disp);
		font-weight: 900;
		letter-spacing: 0.1em;
		box-shadow: 0 5px 0 #6d0a12;
		transition:
			transform 90ms ease,
			box-shadow 90ms ease;
		white-space: nowrap;
	}
	.go:active:not(:disabled) {
		transform: translateY(3px);
		box-shadow: 0 2px 0 #6d0a12;
	}
	.go.off {
		background: linear-gradient(180deg, #3a4150, #232832) !important;
		box-shadow: 0 5px 0 #0c0e12;
	}
	.go:disabled {
		background: #46505f !important;
		color: #aab4c2 !important;
		box-shadow: none;
		cursor: default;
	}
	.low {
		color: #ffe3a6;
		font-weight: 600;
		text-align: center;
	}

	/* ── the tray ── */
	.tray {
		display: flex;
		flex-direction: column;
	}
	.group-h {
		display: flex;
		align-items: baseline;
		gap: 10px;
		color: var(--sign-white);
		white-space: nowrap;
		overflow: hidden;
	}
	.group-h span:last-child {
		color: #c8d2de;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.row {
		display: grid;
	}
	.row.one {
		grid-template-columns: minmax(0, 1fr);
	}
	.row.two {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.tile {
		position: relative;
		box-sizing: border-box;
		background: linear-gradient(180deg, #2b313c, #1a1e26) !important;
		border: 2px solid #4a5364 !important;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		min-width: 0;
	}
	.tile.sel {
		border-color: var(--sign-white) !important;
		box-shadow: 0 0 0 2px var(--sign-white);
	}
	.tile.sel::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 6px;
		background: var(--accent);
	}
	.tile .face {
		display: flex;
		align-items: center;
		justify-content: center;
		max-width: 100%;
		transition: transform 160ms ease;
		animation: fl-drop 420ms cubic-bezier(0.2, 1.3, 0.4, 1) both;
		animation-delay: calc(var(--i) * 60ms + 120ms);
	}
	.tile:hover .face {
		transform: translateY(-2px);
	}
	@keyframes fl-drop {
		from {
			transform: translateY(-34px);
			opacity: 0;
		}
		to {
			transform: none;
			opacity: 1;
		}
	}
	.thumb {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		flex: none;
	}
	.txt {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.nm {
		font-family: var(--disp);
		font-weight: 900;
		color: #fff;
		letter-spacing: 0.04em;
		line-height: 1.05;
		white-space: nowrap;
	}
	.mult {
		font-family: var(--disp);
		font-weight: 800;
		color: #c8d2de;
		white-space: nowrap;
	}
	.mult small {
		font-weight: 400;
		font-size: 0.8em;
	}
	.chip {
		position: absolute;
		background: var(--yellow);
		color: var(--sign-black);
		font-family: var(--disp);
		font-weight: 900;
		letter-spacing: 0.08em;
		border-radius: 4px;
		border: 2px solid var(--sign-black);
		z-index: 1;
	}
	.note {
		color: #b9c4d2;
		line-height: 1.3;
	}
	.note b {
		color: #f2f5f9;
	}

	/* ════════ desk: the mock's 1440 x 900 box, absolutely placed ════════ */
	.desk > * {
		position: absolute;
	}
	.desk .road {
		top: 878px;
	}
	.desk .title {
		left: 44px;
		top: 150px;
		font-size: 30px;
	}
	.desk .hud {
		left: 44px;
		top: 230px;
		width: 262px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.desk .hud .lab {
		font-size: 12px;
	}
	.desk .hud .val {
		font-size: 30px;
	}
	.desk .amt-row .val {
		font-size: 32px;
	}
	.desk .step {
		width: 48px;
		height: 48px;
	}
	.desk .close {
		right: 36px;
		top: 28px;
		width: 56px;
		height: 56px;
	}
	/* centred over the plate like the mock's (620 wide at 330), narrowed so it keeps clear of the title */
	.desk .hero {
		left: 370px;
		top: 30px;
		width: 540px;
		height: 400px;
		--art-h: 330px;
	}
	.desk .plate {
		left: 330px;
		top: 446px;
		width: 620px;
		height: 420px;
		padding: 20px 26px 18px;
		gap: 8px;
		border-radius: 18px;
	}
	.desk .plate .kick {
		font-size: 15px;
	}
	.desk .plate h2 {
		font-size: 50px;
	}
	.desk .say {
		font-size: 19px;
	}
	.desk .status {
		font-size: 15.5px;
		padding: 7px 10px;
	}
	.desk .lvl .kick {
		font-size: 12px;
	}
	.desk .lvl button {
		height: 48px;
		font-size: 22px;
	}
	.desk .miles {
		font-size: 16px;
	}
	.desk .miles div {
		padding: 5px 0 3px;
	}
	.desk .act {
		gap: 16px;
	}
	.desk .price .amt {
		font-size: 40px;
		padding: 12px 8px 8px;
		height: 68px;
	}
	.desk .price .lab {
		font-size: 13px;
	}
	.desk .go {
		height: 68px;
		font-size: 26px;
	}
	.desk .low {
		font-size: 13px;
	}
	.desk .tray {
		left: 1000px;
		top: 110px;
		width: 400px;
		gap: 10px;
	}
	.desk .group-h {
		margin-top: 8px;
	}
	.desk .group-h .kick {
		font-size: 15px;
	}
	.desk .group-h span:last-child {
		font-size: 13px;
	}
	.desk .row {
		gap: 10px;
	}
	.desk .tile.wide {
		height: 150px;
	}
	.desk .tile.wide .face {
		gap: 18px;
	}
	.desk .tile.wide .thumb {
		height: 118px;
	}
	.desk .tile.wide .nm {
		font-size: 26px;
	}
	.desk .row.two .tile {
		height: 196px;
		padding: 8px 6px 12px;
	}
	.desk .row.two .face {
		flex-direction: column;
	}
	.desk .row.two .thumb {
		height: 112px;
		margin-bottom: 6px;
	}
	.desk .row.two .txt {
		align-items: center;
	}
	.desk .nm {
		font-size: 17px;
	}
	.desk .mult {
		font-size: 15px;
		margin-top: 2px;
	}
	.desk .chip {
		top: 6px;
		right: 6px;
		font-size: 11px;
		padding: 2px 6px 1px;
	}
	.desk .note {
		left: 1000px;
		top: 640px;
		width: 400px;
		font-size: 11.5px;
	}

	/* ════════ up: an upright screen, one column 390 design px wide ════════ */
	.up {
		display: grid;
		grid-template-columns: minmax(0, 420px);
		justify-content: center;
		grid-template-rows: auto minmax(0, 1fr) auto auto auto auto;
		grid-template-areas: 'head' 'hero' 'tray' 'plate' 'note' 'hud';
		row-gap: 8px;
		padding: max(8px, env(safe-area-inset-top, 0px)) 12px max(8px, env(safe-area-inset-bottom, 0px));
	}
	.up .road {
		position: absolute;
		bottom: 2px;
	}
	.up .title {
		grid-area: head;
		justify-self: center;
		align-self: center;
		font-size: 19px;
	}
	.up .close {
		grid-area: head;
		justify-self: end;
		width: 44px;
		height: 44px;
		border-width: 2px !important;
		border-radius: 10px;
	}
	.up .hero {
		grid-area: hero;
		min-height: 0;
		--art-h: min(86cqh, 210px);
	}
	@container (max-height: 70px) {
		.up .obj,
		.up .rays-box {
			display: none;
		}
	}
	.up .tray {
		grid-area: tray;
		gap: 6px;
	}
	.up .plate {
		grid-area: plate;
		padding: 12px 14px 10px;
		gap: 7px;
		border-width: 3px;
		border-radius: 14px;
	}
	.up .note {
		grid-area: note;
		font-size: 10.5px;
		text-align: center;
	}
	.up .hud {
		grid-area: hud;
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 12px;
	}
	.up .hud .bal {
		min-width: 0;
		flex: 1 1 0;
	}
	.up .amt-block {
		flex: none;
		width: 196px;
	}
	.up .amt-block .lab {
		text-align: center;
	}
	.up .hud .lab {
		font-size: 10px;
	}
	.up .hud .val {
		font-size: 19px;
	}
	.up .step,
	.side .step {
		width: 44px;
		height: 44px;
	}
	.up .amt-row {
		gap: 6px;
	}

	/* the touch layouts share the small plate and the small tiles */
	.up .plate .kick,
	.side .plate .kick {
		font-size: 11px;
	}
	.up .plate h2,
	.side .plate h2 {
		font-size: 26px;
	}
	.up .say,
	.side .say {
		font-size: 13px;
		line-height: 1.22;
	}
	.up .status,
	.side .status {
		font-size: 12.5px;
		padding: 5px 8px;
	}
	.up .lvl .kick,
	.side .lvl .kick {
		font-size: 10px;
	}
	.up .lvl button,
	.side .lvl button {
		height: 44px;
		font-size: 17px;
		border-width: 2px !important;
	}
	.up .miles,
	.side .miles {
		font-size: 12.5px;
	}
	.up .miles div,
	.side .miles div {
		padding: 3px 0 1px;
		border-top-width: 1px;
	}
	.up .act,
	.side .act {
		gap: 10px;
	}
	.up .price .amt,
	.side .price .amt {
		font-size: 23px;
		padding: 8px 4px 4px;
		height: 46px;
		border-width: 3px;
		outline-width: 2px;
	}
	.up .price .lab,
	.side .price .lab {
		font-size: 10px;
	}
	.up .go,
	.side .go {
		height: 48px;
		font-size: 18px;
		border-width: 3px !important;
	}
	.up .low,
	.side .low {
		font-size: 11.5px;
	}
	.up .group-h .kick,
	.side .group-h .kick {
		font-size: 12px;
	}
	.up .group-h span:last-child,
	.side .group-h span:last-child {
		font-size: 11.5px;
	}
	.up .row,
	.side .row {
		gap: 6px;
	}
	.up .tile,
	.side .tile {
		height: 72px;
		padding: 6px;
		border-radius: 10px;
	}
	.up .tile .face,
	.side .tile .face {
		gap: 8px;
	}
	.up .thumb,
	.side .thumb {
		height: 58px;
	}
	.up .nm,
	.side .nm {
		font-size: 13px;
	}
	.up .mult,
	.side .mult {
		font-size: 13px;
	}
	.up .chip,
	.side .chip {
		top: 3px;
		right: 3px;
		font-size: 9px;
		padding: 1px 4px 0;
	}
	/* a short upright screen: smaller tiles, the plate's line gives way (see `short`) */
	.up.short {
		row-gap: 6px;
	}
	.up.short .tray {
		gap: 4px;
	}
	.up.short .tile {
		height: 56px;
	}
	.up.short .thumb {
		height: 46px;
	}
	.up.short .plate {
		gap: 5px;
		padding: 10px 14px 8px;
	}
	.up.short .miles div {
		padding: 2px 0 0;
	}
	/* the name says what it is: the small line over it gives way */
	.up.short .plate .top .kick {
		display: none;
	}
	.up.short .status {
		padding: 4px 8px;
	}

	/* ════════ side: a phone held sideways, 390 design px tall, three columns ════════ */
	.side {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 360px) 252px;
		grid-template-rows: auto minmax(0, 1fr) auto;
		grid-template-areas:
			'title plate close'
			'hero plate tray'
			'hud plate note';
		column-gap: 12px;
		row-gap: 6px;
		padding: 10px max(12px, env(safe-area-inset-right, 0px)) 10px max(12px, env(safe-area-inset-left, 0px));
	}
	.side .road {
		position: absolute;
		bottom: 2px;
	}
	.side .title {
		grid-area: title;
		align-self: center;
		font-size: 16px;
		gap: 7px;
	}
	.side .close {
		grid-area: close;
		justify-self: end;
		width: 44px;
		height: 44px;
		border-width: 2px !important;
		border-radius: 10px;
	}
	.side .hero {
		grid-area: hero;
		min-height: 0;
		--art-h: min(86cqh, 170px);
	}
	.side .hud {
		grid-area: hud;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.side .hud .lab {
		font-size: 10px;
	}
	.side .hud .val {
		font-size: 18px;
	}
	.side .amt-row {
		gap: 6px;
	}
	.side .plate {
		grid-area: plate;
		padding: 12px 14px 10px;
		gap: 7px;
		border-width: 3px;
		border-radius: 14px;
		margin-top: 6px;
	}
	.side .tray {
		grid-area: tray;
		gap: 5px;
		align-self: start;
	}
	.side .row.two .tile {
		height: 88px;
	}
	.side .row.two .face {
		flex-direction: column;
		gap: 2px;
	}
	.side .row.two .thumb {
		height: 46px;
	}
	.side .row.two .txt {
		align-items: center;
	}
	.side .tile.wide {
		height: 64px;
	}
	.side .tile.wide .thumb {
		height: 52px;
	}
	.side .note {
		grid-area: note;
		font-size: 10px;
		align-self: end;
	}

	/* ── the confirm card: a white regulatory sign ── */
	.cwrap {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.card {
		pointer-events: auto;
		box-sizing: border-box;
		flex: none;
		background: var(--sign-white);
		color: var(--sign-black);
		border: 5px solid var(--sign-black);
		outline: 4px solid var(--sign-white);
		border-radius: 16px;
		padding: 22px 24px 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		font-family: var(--read);
		width: 470px;
	}
	.card h3 {
		margin: 0;
		font-family: var(--disp);
		font-weight: 900;
		font-size: 26px;
		text-align: center;
		letter-spacing: 0.02em;
		line-height: 1.1;
	}
	.card .rows {
		font-size: 15px;
		font-family: var(--disp);
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
	}
	.card .rows div {
		padding: 7px 0 5px;
		border-top: 2px solid #c9cbc4;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
	}
	.card .rows div:nth-child(even) {
		text-align: right;
		font-weight: 900;
		padding-left: 12px;
	}
	.card .rows div.tot {
		border-top: 4px solid var(--sign-black);
		font-size: 20px;
		font-weight: 900;
	}
	.card p {
		margin: 0;
		font-size: 14.5px;
		line-height: 1.35;
		color: #2b2f36;
	}
	.card .btns {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.card .ok {
		flex: 2 1 0;
		height: 56px;
		font-size: 20px;
	}
	.card .no {
		font-size: 17px;
		flex: 1 1 0;
		height: 52px;
		border: 3px solid var(--sign-black) !important;
		border-radius: 10px;
		font-family: var(--disp);
		font-weight: 800;
		color: var(--sign-black) !important;
		background: #fff !important;
	}
	.card.c-up,
	.card.c-side {
		width: 340px;
		padding: 16px 16px 14px;
		gap: 9px;
	}
	.card.c-up h3,
	.card.c-side h3 {
		font-size: 21px;
	}
	.card.c-up p,
	.card.c-side p {
		font-size: 13px;
	}
	.card.c-up .ok,
	.card.c-side .ok {
		height: 48px;
		font-size: 17px;
	}
	.card.c-up .no,
	.card.c-side .no {
		height: 48px;
	}
	.card.c-side {
		width: 400px;
	}

	/* reduced motion: nothing turns, sways or drops */
	.reduced .rays,
	.reduced .obj,
	.reduced .tile .face {
		animation: none;
	}
	.reduced .tint,
	.reduced .plate::before,
	.reduced .go {
		transition: none;
	}
</style>
