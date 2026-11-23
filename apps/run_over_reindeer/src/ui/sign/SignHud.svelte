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
	import { DESKTOP, KEY_V, OWNER_ORDER, PHONE_PLACES, PHONE_REFS, PLAY_V, READOUT_TYPE, TEXT_MIN, amountLimits, padCircle, padPlaces, padShapes, readoutFit, pressOwner, pressRegions, pressShape, pressVerdict, seatAmount, signLayout, signProblems, stepBox, winGlass, type Box, type OwnerId, type PieceId } from './signLayout';
	import { signZones } from './signZones';
	import { holdLights } from './ledBand';
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

	// ---- BALANCE AND WIN ALWAYS FIT (2026-11-22; ui/sign/signLayout.ts readoutRoom, fitSteps): each number stands in the
	// part of its box that is inside the window and clear of its row's neighbors, at the largest of its nominal size,
	// 95 %, 90 % ... 50 % that fits there (smaller still for a longer string: never clipped, never abbreviated). The
	// width is the string's with every digit a 0 wide, so the size changes only when the number gains a figure.
	// THE BOX NEVER CHANGES (2026-11-22, the probe host at 1920 x 1080 on e5db525d: Balance's element had become its room,
	// 5.6 px narrower where the LED strip's left end stands in its row). Each readout's element is his box, as before the
	// rooms; only the number's size answers to the room, and only when the number is too long for it (readoutFit).
	const fitIn = (id: 'bal' | 'win', text: string) => {
		void faceReady;
		const f = readoutFit(geo, id, zones, safe, em(text));
		return { px: f.px / u, k: f.k, under: f.under, room: f.room };
	};
	const balText = $derived(replay ? (rh && !rh.isBase ? rh.base : '') : controls.balanceText());
	const balFit = $derived(fitIn('bal', balText));
	const winFit = $derived(fitIn('win', controls.winOdoText() ?? winValue));
	const balRoom = $derived(balFit.room);
	const winRoom = $derived(winFit.room);

	// ---- THE PRESS PADS: a key whose drawn shape holds less than a 44 CSS px circle gets a 44 px round pad on its
	// center, drawn first so it lies under every control: where a pad meets a neighbour, the neighbour's own shape takes
	// the press (the dock's .hit::after rule; an element of its own here, because a turned button's ::after cannot lie
	// under its neighbours). The pad calls the key's own handler under the key's own disabled rule.
	// (2026-11-23) AUTO'S AND TURBO'S PADS STAND APART where his two keys are closer than 44 px (568 x 320: 37 px; the
	// house rule's 44 px touch area): the drawn keys stay, the unseen pads move the least it takes to hold a whole 44 px
	// circle each, 2 px clear of each other, the Play's diamond and the bet symbols' press boxes (signLayout.ts
	// padPlaces); where there is no room for that they share their ground down the middle line (padShapes).
	// THE PADS ARE EXACT SHAPES (2026-11-23, the probe host at 667 x 375: a press 21 px from Auto's pad's middle landed
	// on Turbo's): each is an outline in one unseen svg, in CSS px, so a press is tested against the outline itself. A
	// round HTML box is tested as whole px against a box snapped to whole px, about 1.5 px loose.
	const pressBoxes = $derived({ play: geo.box.play, auto: geo.box.auto, turbo: geo.box.turbo, menu: geo.box.menu, bonus: geo.box.bonus, down: seat.down, up: seat.up });
	const padAt = $derived(padPlaces(pressBoxes, vw, vh));
	const padShape = $derived(padShapes(pressBoxes, vw, vh));
	// WHOSE PRESS IS IT (2026-11-23, signLayout.ts pressOwner). A browser gives a TOUCH to a nearby button by the
	// buttons' upright boxes and paint order, and reports the click inside the button it chose. The diamonds' boxes
	// overlap (the Play's covers half of Turbo's ground), so on the probe host a tap 2 px inside Turbo's edge nearest the
	// Play started a round, and a tap in the bare ground between Auto and Turbo turned Turbo on; a mouse did neither.
	// So EVERY click a control of this bar gets is judged by where the pointer went DOWN (kept here from the window's
	// pointerdown: that place is the finger's own), by the drawn shapes:
	//   the place is in this control's own drawing or pad   it acts
	//   it is in another control's                          that control takes the press, under its own rule (a click
	//                                                       sent to it with no place); NEVER the Play: a round starts
	//                                                       only from a press that went down inside the Play's diamond
	//                                                       and that the Play itself got
	//   it is in nobody's                                   nothing happens
	// A keyboard's or a script's press carries no place (detail 0): the control that got it takes it. The Play has one
	// way in, this click (no hold to spin: the shared EnableSpaceHold is not mounted, ui/Chrome.svelte).
	let root = $state<HTMLDivElement | undefined>();
	let pressDown: { x: number; y: number; t: number } | null = null;
	$effect(() => {
		const down = (e: PointerEvent) => {
			pressDown = { x: e.clientX, y: e.clientY, t: e.timeStamp };
		};
		window.addEventListener('pointerdown', down, true);
		return () => window.removeEventListener('pointerdown', down, true);
	});
	const bonusPad = $derived(!replay && !controls.jurisdiction().disabledBuyFeature && geo.box.bonus.h < 44);
	// (only the controls that are on the screen own ground: a key an operator switches off, or a replay leaves out, owns none)
	const ownerBoxes = $derived.by(() => {
		const J = controls.jurisdiction();
		const out: Partial<Record<OwnerId, Box>> = { play: geo.box.play, menu: geo.box.menu };
		if (!replay && !J.disabledAutoplay) out.auto = geo.box.auto;
		if (!J.disabledTurbo) out.turbo = geo.box.turbo;
		if (!replay && !J.disabledBuyFeature) out.bonus = geo.box.bonus;
		if (!replay) {
			out.down = seat.down;
			out.up = seat.up;
			out.amt = seat.amt;
		}
		return out;
	});
	const ownerPads = $derived({ ...padShape, ...(bonusPad ? { bonus: { poly: padCircle([geo.box.bonus.x + geo.box.bonus.w / 2, geo.box.bonus.y + geo.box.bonus.h / 2]) } } : {}) });
	const OWNER_SEL: Record<OwnerId, string> = { play: 'button.sgp', auto: 'button.sgk-auto', turbo: 'button.sgk-turbo', menu: '[data-hud="menu-key"]', bonus: 'button.sgf', down: '[data-hud-step="minus"]', up: '[data-hud-step="plus"]', amt: 'button[data-hud="amount"]' };
	// THE CATCH OUTLINES (2026-11-23, the probe host: this rule named ground a key's that no element covered, so a press
	// there did nothing). Every control's own press shape (signLayout.ts pressShape: what pressOwner calls its ground)
	// is drawn once more as an unseen outline in the pads' svg, under every control. The real key above takes its
	// presses, its pointer and its looks as before; where the browser's own test of the key's box misses a place by a
	// px (a round corner, an edge), the outline under it takes the press and it is judged by the same rule: the key
	// acts through its own click, under its own disabled rule. An outline is its control's ground and no more, so it
	// blocks nothing outside it, and the Play's is the Play's own diamond.
	const outline = (poly: [number, number][]) => `M${poly.map((q) => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join('L')}Z`;
	const catches = $derived(OWNER_ORDER.filter((id) => ownerBoxes[id]).map((id) => ({ id, d: outline(pressShape(id, ownerBoxes[id] as Box)) })));
	const viaKey = (id: OwnerId) => () => root?.querySelector<HTMLElement>(OWNER_SEL[id])?.click();
	const barPress = (ev: MouseEvent, got: OwnerId, own: () => void) => {
		if (ev.detail === 0) return void own();
		// (this click's own pointerdown is the last one the window saw; a browser with no pointer events gives the click's place)
		const at: [number, number] = pressDown && pressDown.t <= ev.timeStamp ? [pressDown.x, pressDown.y] : [ev.clientX, ev.clientY];
		const who = pressOwner(ownerBoxes, ownerPads, at);
		const verdict = pressVerdict(got, who);
		if (verdict === 'own') own();
		else if (verdict === 'pass' && who) root?.querySelector<HTMLElement>(OWNER_SEL[who])?.click();
	};
	const autoOwn = () => {
		if (!replay && !controls.jurisdiction().disabledAutoplay && !controls.autoDisabled()) controls.autoPress();
	};
	const turboOwn = () => {
		if (!controls.jurisdiction().disabledTurbo && !stateBet.isSpaceHold) controls.turboPress();
	};
	const bonusOwn = () => {
		if (!controls.bonusDisabled()) controls.bonusPress();
	};
	const pads = $derived.by(() => {
		const out: { id: string; d: string; press: (ev: MouseEvent) => void }[] = [];
		const path = outline;
		const add = (id: PieceId, drawn: number, press: (ev: MouseEvent) => void) => {
			if (drawn * u >= 44) return;
			const b = geo.box[id];
			const shape = id === 'auto' || id === 'turbo' ? padShape[id]?.poly : undefined;
			out.push({ id, d: path(shape ?? padCircle([b.x + b.w / 2, b.y + b.h / 2])), press });
		};
		if (!replay && !controls.jurisdiction().disabledAutoplay) add('auto', (B.auto.w * KEY_V) / Math.SQRT2, (ev) => barPress(ev, 'auto', autoOwn));
		if (!controls.jurisdiction().disabledTurbo) add('turbo', (B.turbo.w * KEY_V) / Math.SQRT2, (ev) => barPress(ev, 'turbo', turboOwn));
		if (!replay && !controls.jurisdiction().disabledBuyFeature) add('bonus', B.bonus.h, (ev) => barPress(ev, 'bonus', bonusOwn));
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
			press: () => pressRegions(pressBoxes, padAt),
			/** whose press a place is ('play', 'auto', 'turbo', 'menu', 'bonus', 'down', 'up', 'amt' or null: nobody's), by
			 *  the drawn shapes and the pads (pressOwner) */
			owner: (x: number, y: number) => pressOwner(ownerBoxes, ownerPads, [x, y]),
			/** each control's own press shape (its outline's corners, CSS px): its ground by the rule, and its catch outline */
			shapes: () => Object.fromEntries(OWNER_ORDER.filter((id) => ownerBoxes[id]).map((id) => [id, pressShape(id, ownerBoxes[id] as Box)])),
			/** Auto's and Turbo's press pads: where the rule puts each one's center (CSS px), each one's real shape (its
			 *  outline's corners, CSS px, and whether the two share their ground down the middle line), the keys' centers */
			pads: () => JSON.parse(JSON.stringify({ at: padAt, shapes: padShape, keys: { auto: [geo.box.auto.x + geo.box.auto.w / 2, geo.box.auto.y + geo.box.auto.h / 2], turbo: [geo.box.turbo.x + geo.box.turbo.w / 2, geo.box.turbo.y + geo.box.turbo.h / 2] } })),
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
			/** Balance's and Win's rooms (CSS px: x and width), the type each number is drawn at (CSS px), its share of the
			 *  nominal size and whether it is past the floor */
			readouts: () => ({ bal: { room: { ...balRoom }, px: balFit.px * u, k: balFit.k, under: balFit.under, text: balText }, win: { room: { ...winRoom }, px: winFit.px * u, k: winFit.k, under: winFit.under } }),
			/** DEV: show another balance (the probe's long balances); answers the one it replaced, to put back */
			tryBalance: (amount: number) => {
				const was = stateBet.balanceAmount;
				stateBet.balanceAmount = amount;
				return was;
			},
			/** the LED borders' light: false holds every key's light on the frame it shows, true lets it run again (a probe
			 *  that reads the pixels that differ between two captures holds it: tools/wheel_probe.mjs) */
			lights: (on: boolean) => !holdLights(!on),
			/** the places the bar is laid out from, as the layout file holds them (the probe reads them here, never a copy):
			 *  his own, with Balance and the amount enlarged on phones (signLayout.ts BOOST); `raw` is his copy untouched */
			his: () => JSON.parse(JSON.stringify({ phone: PHONE_PLACES, raw: PHONE_REFS, desktop: DESKTOP })),
			/** the drawn diamonds as shares of their boxes (the Play's button and Auto's and Turbo's are the diamonds) */
			diamond: () => ({ play: PLAY_V, auto: KEY_V, turbo: KEY_V }),
		};
	}
</script>

<div bind:this={root} class="hudp hud-group sg v-{kind === 'landscape' ? 'desktop' : kind === 'portrait' ? 'portrait' : 'landscape'}" class:menu-open={stateUi.menuOpen} data-plane="base" data-bar="sign" style={plane}>
	<svg class="sgpads" viewBox="0 0 {vw} {vh}" style:width="{vw / u}px" style:height="{vh / u}px" aria-hidden="true">
		{#each catches as c (c.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<path class="sgcatch" data-catch={c.id} d={c.d} onclick={(ev) => barPress(ev, c.id, viaKey(c.id))} />
		{/each}
		{#each pads as pd (pd.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<path class="sgpad" data-pad={pd.id} d={pd.d} onclick={pd.press} />
		{/each}
	</svg>
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
			fontPx={winFit.px}
			pad={0}
			cls="sgr win {lit ? 'is-lit' : ''} {hs.winBig() ? 'is-big' : ''}"
			hud="win"
			face={OVER}
			burstOff
			tabular
		/>
	</div>
	{#if !replay && !controls.jurisdiction().disabledBuyFeature}<SignFastLane {controls} x={B.bonus.x} y={B.bonus.y} w={B.bonus.w} h={B.bonus.h} {u} press={(ev) => barPress(ev, 'bonus', controls.bonusPress)} />{/if}
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
		onclick={(ev) => barPress(ev, 'menu', controls.menuPress)}
		aria-label="Menu"
		aria-expanded={stateUi.menuOpen}
	>
		<svg class="s-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /></svg><span class="kl">MENU</span>
	</button>
	{#if !replay && !controls.jurisdiction().disabledAutoplay}<SignKey kind="auto" {controls} x={B.auto.x} y={B.auto.y} w={B.auto.w} press={(ev) => barPress(ev, 'auto', controls.autoPress)} />{/if}
	{#if !controls.jurisdiction().disabledTurbo}<SignKey kind="turbo" {controls} x={B.turbo.x} y={B.turbo.y} w={B.turbo.w} word={geo.turboWord} press={(ev) => barPress(ev, 'turbo', controls.turboPress)} />{/if}
	<SignPlay {controls} x={B.play.x} y={B.play.y} d={B.play.w} css={geo.box.play.w} press={(ev, own) => barPress(ev, 'play', own)} />
	<div class="dc" style:--rs={geo.rs.bal} style:--hf="{headFs(geo.rs.bal)}px">
		{#if !replay}
			<HudReadout label="BALANCE" value={controls.balanceText()} x={B.bal.x} y={B.bal.y} w={B.bal.w} h={B.bal.h} nominal={READOUT_TYPE.bal * geo.rs.bal} fontPx={balFit.px} pad={0} cls="sgr bal {geo.just.bal === 'left' ? 'al-left' : ''}" hud="balance" lit face={OVER} />
		{:else if rh && !rh.isBase}
			<HudReadout label="BASE AMOUNT" value={rh.base} x={B.bal.x} y={B.bal.y} w={B.bal.w} h={B.bal.h} nominal={READOUT_TYPE.bal * geo.rs.bal} fontPx={balFit.px} pad={0} cls="sgr bal {geo.just.bal === 'left' ? 'al-left' : ''}" hud="balance" lit face={OVER} />
		{/if}
	</div>
	<div class="dc" style:--rs={geo.rs.amt} style:--hf="{headFs(geo.rs.amt)}px">
		{#if !replay}<SignStep dir={-1} {controls} x={seat.down.x / u} y={seat.down.y / u} w={SB.w} h={SB.h} size={geo.step} cx={(seat.downC[0] - seat.down.x) / u} cy={(seat.downC[1] - seat.down.y) / u} press={(ev, own) => barPress(ev, 'down', own)} />{/if}
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
				onclick={replay ? undefined : (ev) => barPress(ev, 'amt', controls.openDenom)}
				disabled={replay || controls.betDisabled()}
				hud="amount"
				lit
				face={OVER}
			/>
		{/if}
		{#if !replay}<SignStep dir={1} {controls} x={seat.up.x / u} y={seat.up.y / u} w={SB.w} h={SB.h} size={geo.step} cx={(seat.upC[0] - seat.up.x) / u} cy={(seat.upC[1] - seat.up.y) / u} press={(ev, own) => barPress(ev, 'up', own)} />{/if}
	</div>
	<HudMenuPanel {controls} x={panel.x} y={panel.y} W={panel.w} H={panel.h} tip={0} up={panel.up} T={0} cls={panel.cls} />
</div>
