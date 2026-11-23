<script lang="ts">
	// THE SIGN BAR (2026-11-22; Corey's approved mocks desktop_hud_r8 to r10 and phone_layout_r2): the game bar of every
	// layout, in place of the glass dock (ui/hud/, still selectable: ui/hudTheme.ts HUD_BAR). It is the same controls
	// over the same state and handlers (ui/controls.svelte.ts, ui/hud/hudState.ts), re-drawn and re-placed:
	//   the Play (a diamond with an LED border), Auto and Turbo (road sign diamonds), Menu (a highway sign), Fast Lane (a
	//   hexagon with the etched PolyMath mark and its own LED border), BALANCE and the amount as outlined numbers under
	//   sign plate headers, a bare red < and green > either side of the amount, and the Win box (glass: a pill on the
	//   desktop, a rectangle on a phone), shown only while a win shows and all through free spins.
	// Every place and size is ui/sign/signLayout.ts's (his own windows, and the rule between them); one plane in bar px
	// spans the window, scaled as a whole. The help menu is the dock's panel (ui/hud/HudMenuPanel.svelte), by the Menu key.
	import { untrack } from 'svelte';
	import { stateBet, stateUi } from 'state-shared';
	import { getContext } from '../../game/context';
	import { isPhoneSizeType, type LayoutKind } from '../../game/layoutSpec';
	import { measureFitText } from '../../game/textFit';
	import type { Controls } from '../controls.svelte';
	import { betWidestEm } from '../betStep';
	import { chromeFit, type Insets } from '../hud/hudLayout';
	import { createHudState } from '../hud/hudState';
	import HudReadout from '../hud/HudReadout.svelte';
	import HudMenuPanel from '../hud/HudMenuPanel.svelte';
	import { HEAD_LS, headWidth } from './signDraw';
	import { DESKTOP, KEY_V, PHONE_REFS, PLAY_V, READOUT_TYPE, TEXT_MIN, amountLimits, pressRegions, seatAmount, signLayout, signProblems, stepBox, winGlass, type Box, type PieceId } from './signLayout';
	import { signZones } from './signZones';
	import SignPlay from './SignPlay.svelte';
	import SignKey from './SignKey.svelte';
	import SignFastLane from './SignFastLane.svelte';
	import SignStep from './SignStep.svelte';

	type Props = { controls: Controls; kind: LayoutKind; vw: number; vh: number; safe: Insets };
	const { controls, kind, vw, vh, safe }: Props = $props();
	const context = getContext();
	const hs = createHudState(controls);
	const replay = $derived(controls.isReplay());
	const rh = $derived(hs.replay());
	const phone = $derived(isPhoneSizeType(context.stateLayoutDerived.canvasSizeType()));

	// ---- the layout ----
	const zones = $derived(signZones(kind, vw, vh, phone));
	const geo = $derived(signLayout({ kind, vw, vh, safe, zones }));
	const u = $derived(geo.u);
	const fit = $derived(chromeFit(kind, vw, vh));
	// the plane's top left is the window's; inside .fit (master px, origin at fitLeft / top) that is -fitLeft / scale
	const plane = $derived(`width:${vw / u}px;height:${vh / u}px;transform:translate(${-fit.fitLeft / fit.scale}px, ${-fit.top / fit.scale}px) scale(${u / fit.scale});--hit:${44 / u}px`);
	/** a box in bar px */
	const bar = (b: Box) => ({ x: b.x / u, y: b.y / u, w: b.w / u, h: b.h / u });
	const B = $derived(Object.fromEntries((Object.keys(geo.box) as PieceId[]).map((id) => [id, bar(geo.box[id])])) as Record<PieceId, Box>);

	// ---- the type: Overpass 900; measured again once the face has loaded ----
	const OVER = "'Overpass', sans-serif";
	let faceReady = $state(0);
	$effect(() => {
		if (typeof document === 'undefined' || !document.fonts) return;
		let live = true;
		document.fonts.load(`900 20px ${OVER}`).then(() => live && (faceReady += 1), () => {});
		return () => {
			live = false;
		};
	});
	const em = (t: string, ls = 0) => measureFitText(t, 100, 900, 0, OVER) / 100 + (t.length - 1) * ls;
	/** a header plate's letters, bar px: the readout's scale, never under 10 CSS px */
	const headFs = (rs: number) => Math.max(READOUT_TYPE.head * rs, TEXT_MIN / u);

	// ---- the amount: the widest amount rule (ui/betStep.ts betWidestEm, ui/sign/signLayout.ts seatAmount) ----
	const amtLabel = $derived(rh ? rh.label : hs.amtLabel());
	const amtValue = $derived(rh ? rh.total : controls.betText());
	const widest = $derived.by(() => {
		void faceReady;
		return betWidestEm((t) => em(t));
	});
	const seat = $derived.by(() => {
		void faceReady;
		return seatAmount(geo, widest.em, headWidth(em(amtLabel, HEAD_LS), headFs(geo.rs.amt)) * u, amountLimits(geo, zones, safe));
	});
	const SB = $derived(stepBox(geo.step, u));

	// ---- the Win box: there while a win shows and all through free spins; it leaves holding the amount it had ----
	const lit = $derived(hs.winLit());
	const winOn = $derived(lit || controls.freeSpin() !== null);
	let winHeld = $state('');
	$effect(() => {
		if (!winOn) return;
		const t = controls.winText();
		untrack(() => (winHeld = t));
	});
	const winValue = $derived(winOn ? controls.winText() : winHeld || controls.winText());
	const WG = $derived(winGlass(geo));
	/** THE WIN BOX IS ONE SIZE (2026-11-22): its header is WIN, and FREE SPINS WIN all through free spins. The plate's
	 *  letters are the readout's (never under 10 CSS px), but never so large that the longer plate would pass the glass:
	 *  then the letters come down until the plate is the glass's width less 2 bar px a side */
	const winHead = $derived.by(() => {
		void faceReady;
		const fs = headFs(geo.rs.win);
		const word = `${hs.winPre() ? hs.winPre() + ' ' : ''}WIN`;
		const room = WG.w / u - 4;
		const w = headWidth(em(word, HEAD_LS), fs);
		return w > room ? Math.max(4, (fs * room) / w) : fs;
	});

	// ---- THE PRESS PADS: a key whose drawn shape holds less than a 44 CSS px circle gets a 44 px round pad on its
	// center, drawn first so it lies under every control: where a pad meets a neighbour, the neighbour's own shape takes
	// the press (the dock's .hit::after rule; an element of its own here, because a turned button's ::after cannot lie
	// under its neighbours). The pad calls the key's own handler under the key's own disabled rule.
	const pads = $derived.by(() => {
		const out: { id: string; x: number; y: number; d: number; press: () => void }[] = [];
		const d = 44 / u;
		const add = (id: PieceId, drawn: number, press: () => void) => {
			if (drawn * u >= 44) return;
			const b = B[id];
			out.push({ id, x: b.x + b.w / 2 - d / 2, y: b.y + b.h / 2 - d / 2, d, press });
		};
		if (!replay && !controls.jurisdiction().disabledAutoplay) add('auto', (B.auto.w * KEY_V) / Math.SQRT2, () => !controls.autoDisabled() && controls.autoPress());
		if (!controls.jurisdiction().disabledTurbo) add('turbo', (B.turbo.w * KEY_V) / Math.SQRT2, () => !stateBet.isSpaceHold && controls.turboPress());
		if (!replay && !controls.jurisdiction().disabledBuyFeature) add('bonus', B.bonus.h, () => !controls.bonusDisabled() && controls.bonusPress());
		return out;
	});

	// ---- the help menu's panel: over the Menu key on the desktop and sideways, under it upright (the key is at the top) ----
	const panel = $derived.by(() => {
		const m = B.menu;
		const W = vw / u;
		if (kind === 'portrait') return { x: Math.max(8, Math.min(m.x + m.w - 272, W - 272 - 8)), y: m.y + m.h + 8, w: 272, h: 176, up: true, cls: '' };
		if (kind === 'phone') return { x: Math.max(4, m.x), y: Math.max(50, m.y - 6 - 107), w: 138, h: 107, up: false, cls: 'pls' };
		return { x: Math.max(8, m.x), y: m.y - 8 - 176, w: 272, h: 176, up: false, cls: '' };
	});

	// ---- DEV: the bar's places for the probes (tools/hud_probe.mjs section `signhud`), never in a production build ----
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const hook = ((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {});
		hook.sign = {
			bar: 'sign',
			/** the rule's inputs: the layout kind, the window, the safe insets, the scene's keep-outs */
			inputs: () => ({ kind, vw, vh, safe: { ...safe }, phone, zones: JSON.parse(JSON.stringify(zones)) }),
			/** every piece's box (CSS px), the scale, the blend's weights, what the guards moved */
			geo: () => JSON.parse(JSON.stringify({ ...geo, winGlass: WG })),
			/** the amount's seat: its type, the reserved width, the two symbols' press boxes, the widest amount */
			seat: () => JSON.parse(JSON.stringify({ ...seat, widest: widest.text })),
			/** each press region's largest circle, CSS px */
			press: () => pressRegions({ play: geo.box.play, auto: geo.box.auto, turbo: geo.box.turbo, menu: geo.box.menu, bonus: geo.box.bonus, down: seat.down, up: seat.up }),
			/** what is wrong by real shape (a piece on the board, the strip or the logo, a symbol on the Play, a press under 44) */
			problems: () => {
				// BALANCE and the amount by what they draw: the header plate and the number, CSS px
				const drawn: Partial<Record<'amt' | 'bal', Box>> = {};
				for (const [id, name] of [['amt', 'amount'], ['bal', 'balance']] as const) {
					const parts = [...document.querySelectorAll(`.hudp.sg [data-hud="${name}"] .lbw, .hudp.sg [data-hud="${name}"] .value`)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
					if (!parts.length) continue;
					const x0 = Math.min(...parts.map((r) => r.left));
					const y0 = Math.min(...parts.map((r) => r.top));
					drawn[id] = { x: x0, y: y0, w: Math.max(...parts.map((r) => r.right)) - x0, h: Math.max(...parts.map((r) => r.bottom)) - y0 };
				}
				return signProblems(geo, zones, seat, { win: winOn, drawn });
			},
			winOn: () => winOn,
			/** his own places, as the layout file holds them (the probe reads them here, never a copy) */
			his: () => JSON.parse(JSON.stringify({ phone: PHONE_REFS, desktop: DESKTOP })),
			/** the drawn diamonds as shares of their boxes (the Play's button and Auto's and Turbo's are the diamonds) */
			diamond: () => ({ play: PLAY_V, auto: KEY_V, turbo: KEY_V }),
		};
	}
</script>

<div class="hudp hud-group sg v-{kind === 'landscape' ? 'desktop' : kind === 'portrait' ? 'portrait' : 'landscape'}" class:menu-open={stateUi.menuOpen} data-plane="base" data-bar="sign" style={plane}>
	{#each pads as pd (pd.id)}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<span class="sgpad" data-pad={pd.id} style:left="{pd.x}px" style:top="{pd.y}px" style:width="{pd.d}px" style:height="{pd.d}px" onclick={pd.press}></span>
	{/each}
	<!-- the Win box (kept through a presentation, as the dock's WIN readout was) -->
	<div class="sgw keep" class:on={winOn} data-hud="win-box" data-shape={geo.winShape} style:--rs={geo.rs.win} style:--hf="{winHead}px">
		<i class="s-glass" style:left="{WG.x / u}px" style:top="{WG.y / u}px" style:width="{WG.w / u}px" style:height="{WG.h / u}px" style:border-radius="{WG.r / u}px"></i>
		<HudReadout
			label="WIN"
			pre={hs.winPre()}
			value={winValue}
			odo={controls.winOdoText()}
			x={B.win.x}
			y={B.win.y}
			w={B.win.w}
			h={B.win.h}
			nominal={READOUT_TYPE.win * geo.rs.win}
			pad={8}
			cls="sgr win {lit ? 'is-lit' : ''} {hs.winBig() ? 'is-big' : ''}"
			hud="win"
			face={OVER}
			burstOff
			tabular
		/>
	</div>
	{#if !replay && !controls.jurisdiction().disabledBuyFeature}<SignFastLane {controls} x={B.bonus.x} y={B.bonus.y} w={B.bonus.w} h={B.bonus.h} {u} />{/if}
	<button
		type="button"
		class="slot-btn hg sgb sgm"
		class:is-active={stateUi.menuOpen}
		data-hud="menu-key"
		style:left="{B.menu.x}px"
		style:top="{B.menu.y}px"
		style:width="{B.menu.w}px"
		style:height="{B.menu.h}px"
		style:--s="{B.menu.h / 0.8}px"
		onclick={controls.menuPress}
		aria-label="Menu"
		aria-expanded={stateUi.menuOpen}
	>
		<svg class="s-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /></svg><span class="kl">MENU</span>
	</button>
	{#if !replay && !controls.jurisdiction().disabledAutoplay}<SignKey kind="auto" {controls} x={B.auto.x} y={B.auto.y} w={B.auto.w} />{/if}
	{#if !controls.jurisdiction().disabledTurbo}<SignKey kind="turbo" {controls} x={B.turbo.x} y={B.turbo.y} w={B.turbo.w} word={geo.turboWord} />{/if}
	<SignPlay {controls} x={B.play.x} y={B.play.y} d={B.play.w} css={geo.box.play.w} />
	<div class="dc" style:--rs={geo.rs.bal} style:--hf="{headFs(geo.rs.bal)}px">
		{#if !replay}
			<HudReadout label="BALANCE" value={controls.balanceText()} x={B.bal.x} y={B.bal.y} w={B.bal.w} h={B.bal.h} nominal={READOUT_TYPE.bal * geo.rs.bal} pad={8} cls="sgr bal {geo.just.bal === 'left' ? 'al-left' : ''}" hud="balance" lit face={OVER} />
		{:else if rh && !rh.isBase}
			<HudReadout label="BASE AMOUNT" value={rh.base} x={B.bal.x} y={B.bal.y} w={B.bal.w} h={B.bal.h} nominal={READOUT_TYPE.bal * geo.rs.bal} pad={8} cls="sgr bal {geo.just.bal === 'left' ? 'al-left' : ''}" hud="balance" lit face={OVER} />
		{/if}
	</div>
	<div class="dc" style:--rs={geo.rs.amt} style:--hf="{headFs(geo.rs.amt)}px">
		{#if !replay}<SignStep dir={-1} {controls} x={seat.down.x / u} y={seat.down.y / u} w={SB.w} h={SB.h} size={geo.step} cx={(seat.downC[0] - seat.down.x) / u} cy={(seat.downC[1] - seat.down.y) / u} />{/if}
		{#if !replay || rh}
			<HudReadout
				label={amtLabel}
				value={amtValue}
				x={seat.amt.x / u}
				y={seat.amt.y / u}
				w={seat.amt.w / u}
				h={seat.amt.h / u}
				nominal={seat.px / u}
				fontPx={seat.px / u}
				pad={0}
				cls="sgr amt {!replay && hs.modeOn() ? 'ante' : ''} {!replay && controls.betDisabled() ? 'is-locked' : ''}"
				onclick={replay ? undefined : controls.openDenom}
				disabled={replay || controls.betDisabled()}
				hud="amount"
				lit
				face={OVER}
			/>
		{/if}
		{#if !replay}<SignStep dir={1} {controls} x={seat.up.x / u} y={seat.up.y / u} w={SB.w} h={SB.h} size={geo.step} cx={(seat.upC[0] - seat.up.x) / u} cy={(seat.upC[1] - seat.up.y) / u} />{/if}
	</div>
	<HudMenuPanel {controls} x={panel.x} y={panel.y} W={panel.w} H={panel.h} tip={0} up={panel.up} T={0} cls={panel.cls} />
</div>
