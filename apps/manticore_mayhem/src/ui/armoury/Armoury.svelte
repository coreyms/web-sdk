<script lang="ts">
	// THE ARMOURY: the feature menu (spec ~/Desktop/Manticore Mayhem/feedback/armoury_build_r1/SPEC.md; the approved
	// prototype images/feature_menu_r2/, page.css and page.js). Spec commit 4: the DESKTOP layout; commit 5: its MOTION
	// (spec 5: the staggered open, the swap, activate to confirm, cancel, close, reduced motion, every interruption of
	// 5.6); commit 6: THE HERO (HeroView.svelte: follow, tilt, the angle grids and their load queue, breathing, the idle
	// turn) and the warm pass, with the desktop keyboard, focus trap, `inert` and labels (spec 7.3, 7.4); commits 7 and 8
	// (part C): the TOUCH LAYOUTS, portrait phone P1b, tablet portrait and phone sideways (spec 4.4, 4.5; page.css
	// 276-482), with their measured anchors, the plate's eased moves on a mode change, the swipe (portrait phone and
	// tablet), the idle turn, the phone confirm card (no "what you get" line, answer 6), the sideways slab, and the small
	// 16:9 frames: the desktop box scaled, with the menu's own copies of the bet controls (answer 2).
	//
	// THE TOUCH LAYOUTS are one flex column in the frame (portrait, tablet: hero, tray, plate, top to bottom; sideways:
	// hero over the plate in the middle column, the tray a rail on the right). Their edges are MEASURED (menuFrame.ts
	// designAnchors): the clock strip, the HUD's BALANCE / bet row, the sideways HUD column, the safe areas, read on open
	// and on every layout change, never per frame. The hero is the piece that gives, and is dropped when too little is
	// left for it.
	//
	// MOTION. Transform and opacity only, every number from constants.ts ARMOURY.motion, the ease from motion.ts. The
	// one shot moves of the open and of a swap are motion.ts movers (element.animate, one mover per group so a group can
	// be cut alone: tiles, hero, plate, the header pieces); every state move (swap out, confirm, cancel, the plate's
	// height, close) is a CSS transition keyed by a class. No element carries both kinds on one property. HIT BOXES DO
	// NOT MOVE: every moving piece is a still box with a moving inner wrapper (a tile is a still button with a moving
	// face; ACTIVATE rides its plate by a counter move on the button and the same move on its face; the confirm card's
	// two buttons are still boxes whose faces follow the card about the card's own centre). Reduced motion: every
	// duration and delay is 0 (not 1 ms), read once at mount; the plans are empty and the swap and the close are at once.
	//
	// HTML, like the HUD and every other menu: the canvas is not touched. Authored in the prototype's own design px
	// inside ONE box scaled by one transform (menuFrame.ts: on desktop exactly the chrome's master rectangle, 1440 x 810
	// design px over 1280 x 720 master px). The box takes no pointer; its parts do. The tint is ArmouryTint.svelte inside
	// the HUD layer, and the BALANCE and bet row stay lit above it: they are the real HUD's own elements, raised by
	// Chrome.svelte's .armoury-open rules, so the steppers here are the real ones (real rules, sounds, disabled states).
	//
	// THE GAME NEVER COMPUTES AN OUTCOME: confirming only sets stateBet.activeBetModeKey, through the same calls the old
	// menu uses (controls.activateMode for the two per spin modes, controls.buyMode for the four buys). Nothing reaches
	// the wallet until the player presses Spin. Every amount is the RGS's cost multiplier times the live bet, formatted
	// by the one formatter (numberToCurrencyString), never abbreviated. Copy: game/armouryText.ts only.
	//
	// Open: the HUD's feature button (controls.bonusPress) sets the shared `buyBonus` modal, so everything that keys on
	// an open modal (Space never spins, a board tap does nothing) holds as it did. With a mode on, the button opens the
	// menu on that mode (owner's answer 1); switching it off happens here (SWITCH OFF / UNLOAD, no card).
	// Close: the X, Escape. A tap on the dimmed game does nothing (the tint takes it). Closed at once, no fade, if the
	// modal slot is taken by anything else (an RGS notice), if the game stops being idle, or under disabledBuyFeature or
	// the resume hold (spec 7.1).
	import { onMount, tick, untrack } from 'svelte';
	import { stateBet, stateModal } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import type { Controls } from '../controls.svelte';
	import { designAnchors, type Anchors, type MenuFrame } from './menuFrame';
	import { armouryView } from './armouryView.svelte';
	import HeroView from './HeroView.svelte';
	import { fitConfirmAmount, fitPrice } from './fit';
	import { createMover, entranceEnd, entrancePlan, moveDurations, pickEase, prefersReducedMotion, swapPlan, type Mover, type MoveOptions, type Step } from './motion';
	import { ARMOURY } from '../../game/constants';
	import { modeCost } from '../../game/betModeMeta';
	import { stamp } from '../../game/assets';
	import { PHONE_TIER } from '../../game/deviceTier';
	import { INTRO_CARD_ASSETS } from '../../game/introCards';
	import { landscapeTrioSpan } from '../../game/layoutSpec';
	import TrioStat from '../TrioStat.svelte';
	import StepButton from '../StepButton.svelte';
	import { ARMOURY_ART_ORDER, ARMOURY_ASSETS, ARMOURY_MODES, armouryMode, type ArmouryMode, type ArmouryModeId } from '../../game/armouryData';
	import { ARMOURY_TEXT as TX, afterTag, anteConfirm, armouryName, boldRuns, fill } from '../../game/armouryText';
	import { armouryDecoded, whenArmouryCore, heroGridReady, heroGridsInfo, loadArmouryCore, onHeroGrids, pauseHeroGrids, selectHeroGrid, startHeroGrids } from '../../game/armouryLoad';

	type Props = { controls: Controls; frame: MenuFrame };
	const { controls, frame }: Props = $props();

	const M = ARMOURY.motion;
	const SW = ARMOURY.swipe;
	const LAY = ARMOURY.layout;
	/** the touch layouts (portrait phone, tablet, sideways): their own sizes, the touch slide distances */
	const touch = $derived(frame.layout !== 'desktop');
	/** where a swipe changes the mode: portrait phone and tablet only (spec 4.5: no swipe sideways) */
	const swipeLay = $derived(frame.layout === 'portrait' || frame.layout === 'tablet');
	const reduced = prefersReducedMotion();
	armouryView.reduced = reduced;
	const ease = pickEase(M);
	const durs = moveDurations(M, reduced);
	/** a CSS duration or delay: 0 under reduced motion (not 1 ms, spec 5.5) */
	const cssMs = (n: number) => `${reduced ? 0 : n}ms`;

	// ---- open / close ----------------------------------------------------------------------------------------------
	const wantOpen = $derived(stateModal.modal?.name === 'buyBonus');
	let phase = $state<'closed' | 'open' | 'closing'>('closed');
	/** this menu asked for the close (the X, Escape, CONFIRM): it fades; any other close is at once */
	let byUs = false;
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	let rootEl = $state<HTMLDivElement>();
	/** every open is a fresh mount ({#key}): an open during a close finishes the close and starts from the beginning */
	let openSeq = $state(0);

	/** the tile chosen (the tint follows it at once) */
	let sel = $state<ArmouryModeId>('BONUS');
	/** the mode the hero and the plate show: it follows `sel` once the old content has faded out (a swap) */
	let view = $state<ArmouryModeId>('BONUS');
	let confirm = $state(false);
	let confirmAt = 0;
	let confirming = false;
	let flash = $state(false);
	/** the line after a switch off (SWITCH OFF / UNLOAD): which mode it was */
	let note = $state<ArmouryModeId | null>(null);

	const mode = $derived(armouryMode(view)!);
	/** the mode that is on (an ante active or a buy loaded on Spin), if it is one of the six */
	const activeId = $derived.by(() => {
		const k = (stateBet.activeBetModeKey ?? '').toUpperCase();
		return armouryMode(k) ? (k as ArmouryModeId) : null;
	});

	// ---- motion (spec 5) ---------------------------------------------------------------------------------------------
	// one mover per group, so a group can be cut alone (spec 5.6: a tile tapped during the open cuts the hero's and the
	// plate's entrance, the other tiles finish theirs)
	const mv = {
		tiles: createMover(reduced),
		hero: createMover(reduced),
		plate: createMover(reduced),
		head: createMover(reduced),
		/** touch layouts: the tray, the plate's fill, its top rule and the diamond easing to their new places (FLIP) */
		flip: createMover(reduced),
		/** the swipe's carry out, its entry and its spring back */
		swipe: createMover(reduced),
	};
	const movers: Mover[] = Object.values(mv);
	const stopMotion = () => {
		for (const g of movers) g.stopAll();
	};
	/** the old hero and text are on their way out (a swap); the timer lands the newest selection */
	let swapOut = $state(false);
	let swapTimer: ReturnType<typeof setTimeout> | undefined;
	/** the plate's height eases to a new mode's (off for the first frames of an open and on a layout snap) */
	let plateEase = $state(false);
	/** a layout change while moving: every transition off for two frames, so everything simply lands */
	let snapping = $state(false);
	/** the confirm card's buttons are still boxes; their faces turn about the card's centre (design px, per face) */
	let faceOrigin = $state({ confirm: '0px 0px', cancel: '0px 0px' });

	let trayEl = $state<HTMLDivElement>();
	let hdrInEl = $state<HTMLElement>();
	let closeEl = $state<HTMLButtonElement>();
	let heroMv = $state<HTMLDivElement>();
	let panelMv = $state<HTMLDivElement>();
	let detailMv = $state<HTMLDivElement>();
	let dHeadEl = $state<HTMLDivElement>();
	let dBodyEl = $state<HTMLDivElement>();
	let volEl = $state<HTMLDivElement>();
	let buyEl = $state<HTMLDivElement>();
	let statusEl = $state<HTMLDivElement>();
	let ctaFace = $state<HTMLSpanElement>();
	let cardEl = $state<HTMLDivElement>();
	let confirmBtn = $state<HTMLButtonElement>();
	let cancelBtn = $state<HTMLButtonElement>();
	let tileEls = $state<Record<string, HTMLButtonElement | undefined>>({});
	let tileMv = $state<Record<string, HTMLSpanElement | undefined>>({});
	let ctaEl = $state<HTMLButtonElement>();
	let heroSw = $state<HTMLDivElement>();
	let panelSw = $state<HTMLDivElement>();
	let panelEl = $state<HTMLDivElement>();
	let trayBoxEl = $state<HTMLDivElement>();
	let heroBoxEl = $state<HTMLDivElement>();
	let caretEl = $state<HTMLElement>();
	let copyEl = $state<HTMLDivElement>();
	let safeEl = $state<HTMLDivElement>();

	// ---- the hero (spec 5.4; HeroView.svelte) and its angle grids (spec 3.3; game/armouryLoad.ts) ------------------
	let heroView = $state<ReturnType<typeof HeroView>>();
	/** bumped whenever a grid's state changes (a decode landed, one was let go) */
	let gridTick = $state(0);
	const heroGrid = $derived.by(() => {
		void gridTick;
		const h = heroGridReady(mode.art);
		return h ? { view: h.view, url: h.url } : null;
	});
	/** no entrance or swap moves the hero now: a decoded grid may take over from the flat art */
	const calm = () => phase === 'open' && !confirm && !swapOut && !swapTimer && mv.hero.running() === 0;
	let gridTimer: ReturnType<typeof setTimeout> | undefined;
	/** the first open has asked for the grids (after its entrance, ARMOURY.hero.gridAfterOpenMs) */
	let gridsAsked = false;
	onMount(() => onHeroGrids(() => (gridTick += 1)));
	// the hero on show goes to the front of the load queue
	$effect(() => {
		const art = mode.art;
		untrack(() => selectHeroGrid(art));
	});
	// the queue holds while a round is in flight and carries on at idle (spec 3.3 point 5)
	$effect(() => {
		const idle = controls.isIdle();
		untrack(() => pauseHeroGrids(!idle));
	});

	// ---- the warm pass (spec 3.3 point 6): once the menu core is decoded and the game is idle with no modal up, the menu
	// is mounted ONCE at 1 % opacity for two frames and unmounted (the cure for "first open is weird"). Never in a
	// round, never once the menu has been opened. It takes no pointer, no focus and is hidden from screen readers.
	let warm = $state(false);
	let warmed = false;
	let coreIn = $state(false);
	// waits for the deferred phase's last group; never asks for it (that would pull it into the loading screen)
	onMount(() => void whenArmouryCore().then(() => (coreIn = true)));
	$effect(() => {
		if (!coreIn || warmed || phase !== 'closed' || stateModal.modal != null || !controls.isIdle() || document.hidden) return;
		untrack(() => {
			warmed = true;
			warm = true;
			for (const url of allPics()) want(url);
			requestAnimationFrame(() =>
				requestAnimationFrame(() =>
					requestAnimationFrame(() => {
						warm = false;
					}),
				),
			);
		});
	});

	const opts = (s: Step, extra: Partial<MoveOptions> = {}): MoveOptions => ({
		from: s.fromY ? `translateY(${s.fromY}px)` : undefined,
		fade: true,
		duration: s.duration,
		delay: s.delay,
		ease: s.ease === 'linear' ? 'linear' : ease,
		...extra,
	});
	/** ACTIVATE rides its plate but its hit box stays put: the button takes the opposite move, its face the same move */
	const pinCta = (g: Mover, s: Step) => {
		if (!s.fromY) return;
		const o = { duration: s.duration, delay: s.delay, ease: s.ease === 'linear' ? 'linear' : ease };
		g.move(ctaEl, { ...o, from: `translateY(${-s.fromY}px)` });
		g.move(ctaFace, { ...o, from: `translateY(${s.fromY}px)` });
	};
	/** THE OPEN (spec 5.2): tray, name and close fade; the tiles in a stagger; the hero; the plate and its contents */
	const wave = () => {
		stopMotion();
		const order = trayGroups.flatMap((g) => g.modes);
		for (const s of entrancePlan(M, { tiles: order.length, touch, reduced })) {
			if (s.piece === 'tile') mv.tiles.move(tileMv[order[s.index ?? 0].id], opts(s));
			else if (s.piece === 'hero') mv.hero.move(heroMv, opts(s));
			else if (s.piece === 'plate') {
				mv.plate.move(panelMv, opts(s));
				pinCta(mv.plate, s);
			} else if (s.piece === 'head') mv.plate.move(dHeadEl, opts(s));
			else if (s.piece === 'vol') mv.plate.move(volEl, opts(s));
			else if (s.piece === 'body') mv.plate.move(dBodyEl, opts(s));
			else if (s.piece === 'buy') mv.plate.move(buyEl, opts(s));
			else {
				mv.head.move(s.piece === 'tray' ? trayEl : s.piece === 'header' ? hdrInEl : closeEl, opts(s));
				if (s.piece === 'tray') mv.head.move(copyEl, opts(s)); // the small 16:9 frames' bet controls come with the tray
			}
		}
	};
	/** a swap's way in: the new hero rises, the new text rises a beat later. `from`: the plate's own entrance was cut
	 *  part way (a tile tapped during the open), so the whole plate carries on from where it was instead */
	const swapIn = (from: { y: number; o: number } | null) => {
		const plan = swapPlan(M, { touch, reduced });
		if (!plan) return;
		mv.hero.move(heroMv, opts(plan.hero));
		if (from && from.o > 0.01) {
			const s: Step = { ...plan.text, delay: 0, fromY: from.y };
			mv.plate.move(panelMv, opts(s, { fadeFrom: from.o }));
			pinCta(mv.plate, s);
		} else if (from) {
			mv.plate.move(panelMv, opts(plan.text));
			pinCta(mv.plate, plan.text);
		} else {
			mv.plate.move(detailMv, opts(plan.text));
			pinCta(mv.plate, plan.text);
		}
	};
	/** the old content is out: show the newest selection (the hero's and the plate's moves so far give way) */
	const land = (animate: boolean) => {
		clearTimeout(swapTimer);
		swapTimer = undefined;
		let from: { y: number; o: number } | null = null;
		if (animate && panelMv && panelMv.getAnimations().length > 0) {
			const cs = getComputedStyle(panelMv);
			let y = 0;
			try {
				y = cs.transform && cs.transform !== 'none' ? new DOMMatrixReadOnly(cs.transform).m42 : 0;
			} catch {
				y = 0;
			}
			from = { y: Math.round(y * 10) / 10, o: Number(cs.opacity) || 0 };
		}
		mv.hero.stopAll();
		mv.plate.stopAll();
		mv.swipe.stopAll();
		mv.flip.stopAll();
		const before = animate && touch ? snapshot() : null;
		view = sel;
		swapOut = false;
		const seq = openSeq;
		if (!animate) {
			tick().then(() => seq === openSeq && afterLayout());
			return;
		}
		tick().then(() => {
			if (seq !== openSeq) return;
			if (phase === 'open' && !confirm && view === sel) {
				flip(before);
				swapIn(from);
			} else afterLayout();
		});
	};

	// ---- the touch layouts' eased places (spec 5.2 "Touch layouts": the tray, the plate's fill, its top rule and the
	// diamond ease from where they were to where they now belong, 520 ms). From layout offsets in the frame, never
	// screen rects (the plate may be mid slide). ---------------------------------------------------------------------
	/** where `el` is in the menu box, design px (layout offsets: a transform anywhere above does not count) */
	const offIn = (el: HTMLElement | null | undefined): { x: number; y: number } => {
		let x = 0;
		let y = 0;
		for (let e: HTMLElement | null = el ?? null; e && e !== rootEl; e = e.offsetParent as HTMLElement | null) {
			x += e.offsetLeft;
			y += e.offsetTop;
		}
		return { x, y };
	};
	/** the diamond's x on the plate's top rule: under the shown mode's tile */
	let caretX = $state(0);
	/** the hero's centre in the box, design px (a fine pointer follows it in every layout) */
	let heroCentre = $state<{ x: number; y: number } | null>(null);
	/** from the still boxes' rects (the tile button and the plate's still box never move; offsetLeft would round each
	 *  step to a whole px), in design px */
	const caretFor = (id: string) => {
		const t = tileEls[id];
		if (!t || !panelEl || !(frame.u > 0)) return caretX;
		const a = t.getBoundingClientRect();
		const b = panelEl.getBoundingClientRect();
		return Math.round(((a.left + a.width / 2 - b.left) / frame.u) * 10) / 10;
	};
	/** what depends on the layout once it has settled: the diamond, the hero's pointer centre */
	const afterLayout = () => {
		if (!rootEl) return;
		caretX = caretFor(view);
		if (touch && heroBoxEl && heroBoxEl.offsetHeight > 0) {
			const o = offIn(heroBoxEl);
			heroCentre = { x: o.x + heroBoxEl.offsetWidth / 2, y: o.y + heroBoxEl.offsetHeight / 2 };
		} else heroCentre = null;
	};
	type Snap = { tray: number; top: number; h: number; cx: number };
	const snapshot = (): Snap | null => (touch && trayBoxEl && panelEl ? { tray: offIn(trayBoxEl).y, top: offIn(panelEl).y, h: panelEl.offsetHeight, cx: caretX } : null);
	const flip = (a: Snap | null) => {
		const b = snapshot();
		afterLayout();
		if (!a || !b || reduced) return;
		const o = { duration: durs.small, ease };
		if (Math.abs(a.tray - b.tray) > 0.5) mv.flip.play(trayEl, [{ transform: `translateY(${(a.tray - b.tray).toFixed(1)}px)` }, { transform: 'none' }], o);
		const dy = a.top - b.top;
		const fill = rootEl?.querySelector<HTMLElement>('.plate-fill');
		const top = rootEl?.querySelector<HTMLElement>('.plate-top');
		if (Math.abs(dy) > 0.5 && a.h > 0 && b.h > 0) {
			mv.flip.play(fill, [{ transform: `scaleY(${(a.h / b.h).toFixed(4)})` }, { transform: 'none' }], o);
			mv.flip.play(top, [{ transform: `translateY(${dy.toFixed(1)}px)` }, { transform: 'none' }], o);
		}
		if (swipeLay && (Math.abs(dy) > 0.5 || Math.abs(a.cx - caretX) > 0.5))
			mv.flip.play(caretEl, [{ transform: `translate(${a.cx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(45deg)` }, { transform: `translate(${caretX.toFixed(1)}px, 0px) rotate(45deg)` }], o);
	};
	/** a layout change while moving (rotation, resize): every animation stops, everything lands in the new layout */
	const snapAll = () => {
		stopMotion();
		if (swapTimer) land(false);
		plateEase = false;
		cancelDrag();
		snapping = true;
		armouryView.snapping = true;
		armouryView.snap += 1;
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				snapping = false;
				armouryView.snapping = false;
				plateEase = phase === 'open';
				measure();
				tick().then(afterLayout);
			}),
		);
	};

	const beginOpen = () => {
		if (phase === 'closing') finishClose();
		clearTimeout(closeTimer);
		stopMotion();
		byUs = false;
		confirming = false;
		flash = false;
		confirm = false;
		note = null;
		swapOut = false;
		plateEase = false;
		snapping = false;
		if (activeId) sel = activeId; // with a mode on, the menu opens on it
		view = sel;
		phase = 'open';
		openSeq += 1;
		armouryView.tint = mode.tint;
		armouryView.confirm = false;
		armouryView.closing = false;
		armouryView.open = true;
		armouryView.shown = true;
		warm = false;
		warmed = true;
		loadArmouryCore(); // the deferred group may not have landed yet: it is asked for now (the menu never waits)
		for (const url of allPics()) want(url);
		if (frame.layout === 'desktop') want(PIC.cardLg); // the large confirm card frame: with the menu, never at boot
		// the angle grids: nothing before the first open; then heroes.json and the atlases one at a time once its entrance
		// is over (spec 3.3 point 4). A close before then does not cancel it: the player has shown the menu is wanted
		if (!gridsAsked) {
			gridsAsked = true;
			gridTimer = setTimeout(() => void startHeroGrids(mode.art), reduced ? 0 : ARMOURY.hero.gridAfterOpenMs);
		}
		void loadFonts();
		measure();
		const seq = openSeq;
		tick().then(() => {
			if (phase !== 'open' || seq !== openSeq) return;
			afterLayout();
			wave();
			tileEls[sel]?.focus({ preventScroll: true });
			// the plate takes its first size at once (one piece at its final size from its first frame); later changes ease
			requestAnimationFrame(() =>
				requestAnimationFrame(() => {
					if (phase === 'open' && seq === openSeq && !snapping) plateEase = true;
				}),
			);
		});
	};
	const beginClose = () => {
		// one quick fade, no movement: every move is cut where it is (the .closing rule stops every transition)
		cancelDrag();
		stopMotion();
		clearTimeout(swapTimer);
		swapTimer = undefined;
		phase = 'closing';
		armouryView.open = false;
		armouryView.confirm = false;
		armouryView.closing = true;
		if (reduced) finishClose();
		else closeTimer = setTimeout(finishClose, M.closeDoneMs);
	};
	const finishClose = () => {
		clearTimeout(closeTimer);
		clearTimeout(swapTimer);
		swapTimer = undefined;
		cancelDrag();
		stopMotion();
		const a = document.activeElement;
		const hadFocus = (!!rootEl && rootEl.contains(a)) || a === document.body || a == null || litParts().steppers.includes(a as HTMLButtonElement);
		setHudInert('off'); // before the focus goes back to the HUD's feature button
		phase = 'closed';
		confirm = false;
		flash = false;
		note = null;
		swapOut = false;
		plateEase = false;
		armouryView.shown = false;
		armouryView.open = false;
		armouryView.confirm = false;
		armouryView.closing = false;
		// focus goes back to the HUD's feature button (spec 7.3)
		if (hadFocus) document.querySelector<HTMLElement>('.am-ui.layer:not(.modals) .fb')?.focus({ preventScroll: true });
	};
	$effect(() => {
		const want = wantOpen;
		untrack(() => {
			if (want && phase !== 'open') beginOpen();
			else if (!want && phase === 'open') {
				if (byUs) beginClose();
				else finishClose();
			}
		});
	});
	// spec 7.1: closed at once if the game stops being idle, or under disabledBuyFeature or the resume hold
	$effect(() => {
		if (phase === 'open' && controls.bonusDisabled()) untrack(() => (stateModal.modal = null));
	});
	// a bet step clears the "is off" line (its amount was the old bet's)
	$effect(() => {
		void stateBet.betAmount;
		untrack(() => (note = null));
	});
	// spec 5.6: a layout change while open (rotation, resize): everything snaps to its rest state, no entrance replay
	let frameKey = '';
	$effect(() => {
		const k = `${frame.layout} ${frame.u} ${frame.left} ${frame.top} ${frame.width} ${frame.height}`;
		untrack(() => {
			if (k !== frameKey && frameKey && phase === 'open') snapAll();
			else if (k !== frameKey && phase !== 'closed') requestAnimationFrame(() => measure());
			frameKey = k;
		});
	});
	onMount(() => () => {
		clearTimeout(closeTimer);
		clearTimeout(swapTimer);
		clearTimeout(gridTimer);
		stopMotion();
		armouryView.shown = armouryView.open = armouryView.confirm = armouryView.closing = armouryView.snapping = false;
	});

	// ---- the actions (the buttons, the keys and the DEV hook all call these, with the same guards) ------------------
	const close = (silent = false) => {
		if (phase !== 'open' || confirming) return false;
		if (!silent) controls.sound('soundPressSub');
		byUs = true;
		stateModal.modal = null;
		return true;
	};
	const select = (id: string) => {
		const m = armouryMode(id);
		if (phase !== 'open' || confirm || !m) return false;
		if (m.id === sel) return true;
		sel = m.id;
		note = null;
		armouryView.tint = m.tint;
		controls.sound('soundPressSub'); // choosing a tile: the small click (owner, answer 4)
		// the tapped tile lands at once if its own entrance is still to come; the others finish theirs (spec 5.6)
		for (const a of tileMv[m.id]?.getAnimations() ?? []) a.cancel();
		if (reduced) {
			land(false);
			return true;
		}
		if (swapTimer) return true; // already on its way out: it lands on the newest selection
		swapOut = true;
		// it lands when the old hero has finished fading out (its own transitionend: the fade starts on the next frame,
		// so a 120 ms timer from the tap would land with the old content still part visible); the timer is a fallback
		swapTimer = setTimeout(() => land(true), M.swapOutMs * 2);
		return true;
	};
	/** the swap's fade out has ended: show the newest selection */
	const onFadeEnd = (e: TransitionEvent) => {
		if (e.target === e.currentTarget && e.propertyName === 'opacity' && swapOut && swapTimer) land(true);
	};
	const step = (dir: 1 | -1) => {
		const i = ARMOURY_MODES.findIndex((m) => m.id === sel);
		const n = ARMOURY_MODES[Math.max(0, Math.min(ARMOURY_MODES.length - 1, i + dir))];
		const onTile = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('tile');
		select(n.id);
		if (onTile) tileEls[n.id]?.focus({ preventScroll: true });
	};
	/** where the confirm card's centre is, from each of its two buttons' faces (design px; layout offsets, so a
	 *  transform anywhere above does not matter) */
	const measureFaces = () => {
		const card = cardEl;
		const fc = confirmBtn?.querySelector<HTMLElement>('.face');
		const fx = cancelBtn?.querySelector<HTMLElement>('.face');
		if (!card || !fc || !fx) return;
		const at = (f: HTMLElement) => {
			let x = 0;
			let y = 0;
			for (let e: HTMLElement | null = f; e && e !== card; e = e.offsetParent as HTMLElement | null) {
				x += e.offsetLeft;
				y += e.offsetTop;
			}
			return `${(card.offsetWidth / 2 - x).toFixed(1)}px ${(card.offsetHeight / 2 - y).toFixed(1)}px`;
		};
		faceOrigin = { confirm: at(fc), cancel: at(fx) };
	};
	const activate = () => {
		if (phase !== 'open' || confirm) return false;
		// allowed during the open and during a swap: every piece lands where it belongs first (spec 5.6)
		cancelDrag();
		stopMotion();
		if (swapTimer) land(false);
		const id = sel;
		if (activeId === id) {
			// SWITCH OFF / UNLOAD needs no card: it lowers the spend, so it happens at once and says so; the menu stays open
			controls.sound('soundPressMinor');
			controls.cancelArmed(); // also unloads a parked autoplay run, as the HUD button always did
			note = id;
			tick().then(() => {
				ctaEl?.focus({ preventScroll: true });
				mv.plate.move(statusEl, { fade: true, duration: M.contentFadeMs, ease: 'linear' });
			});
			return true;
		}
		const p = price(id);
		if (!(p > 0) || p > stateBet.balanceAmount) return false;
		controls.sound('soundPressMinor');
		measureFaces();
		confirm = true;
		confirmAt = performance.now();
		armouryView.confirm = true;
		tick().then(() => cardEl?.focus({ preventScroll: true }));
		return true;
	};
	const cancel = () => {
		if (!confirm || confirming) return false;
		confirm = false; // silent, as today
		armouryView.confirm = false;
		tick().then(() => ctaEl?.focus({ preventScroll: true }));
		return true;
	};
	const doConfirm = () => {
		// the wrong click guard: CONFIRM is not live until it has faded in (kept under reduced motion: it is a guard)
		if (!confirm || confirming || phase !== 'open' || performance.now() - confirmAt < M.confirmGuardMs) return false;
		const m = mode;
		confirming = true;
		flash = true; // a brass line for a frame or two, then the close
		setTimeout(() => {
			confirming = false;
			if (phase !== 'open') return;
			byUs = true;
			if (m.group === 'spin') {
				controls.sound('soundPressGeneral'); // the antes click the same as the buys (spec 7.5)
				controls.activateMode(m.id);
			} else controls.buyMode(m.id); // its own soundPressGeneral
			if (stateModal.modal?.name === 'buyBonus') byUs = false; // refused: still open
		}, M.flashMs);
		return true;
	};

	// ---- access (spec 7.3, 7.4): the Tab order, the focus trap, `inert` on the HUD under the menu ------------------
	const HUD_FIT = '.am-ui.layer:not(.modals) .fit';
	/** the HUD pieces lit above the tint in this layout (Chrome.svelte's .armoury-lit rules), and the two bet steppers
	 *  (minus, plus) Tab reaches: the real HUD's own in every layout but the desktop box on a small 16:9 frame, where they
	 *  are the menu's own copies (and nothing of the HUD is lit). Never the bet readout, which would open the bet picker
	 *  in the menu's place. Per chrome: landscape the trio's BALANCE cell and its bet cell; portrait (phone, tablet) the
	 *  .stats row's BALANCE and the grid's minus and plus; phone sideways the column's BALANCE and its .spin-row */
	const litParts = (): { steppers: HTMLButtonElement[]; keep: Element[] } => {
		if (typeof document === 'undefined') return { steppers: [], keep: [] };
		if (frame.hudCopies) return { steppers: copyEl ? [...copyEl.querySelectorAll<HTMLButtonElement>('button.slot-btn')].filter((b) => !b.classList.contains('stat')) : [], keep: [] };
		const fit = document.querySelector(HUD_FIT);
		if (!fit) return { steppers: [], keep: [] };
		const btn = (e: Element | null): HTMLButtonElement | null => (!e ? null : e instanceof HTMLButtonElement ? e : e.querySelector('button'));
		let steppers: HTMLButtonElement[] = [];
		let readouts: Element[] = [];
		if (frame.layout === 'desktop') {
			const cell = fit.querySelector('.trio > .cell.right');
			steppers = cell ? [...cell.querySelectorAll<HTMLButtonElement>('button')].filter((b) => !b.closest('.spin-slot')) : [];
			readouts = [...fit.querySelectorAll('.trio > .cell.left')];
		} else if (frame.layout === 'sideways') {
			const row = fit.querySelector('.stats > .spin-row');
			steppers = row ? [...row.querySelectorAll<HTMLButtonElement>('button')].filter((b) => !b.classList.contains('stat')) : [];
			readouts = [fit.querySelector('.stats > :first-child')].filter((e): e is Element => !!e);
		} else {
			steppers = [btn(fit.querySelector('.bar .grid > :nth-child(4)')), btn(fit.querySelector('.bar .grid > :nth-child(2)'))].filter((b): b is HTMLButtonElement => !!b);
			readouts = [fit.querySelector('.stats > :first-child')].filter((e): e is Element => !!e);
		}
		return { steppers, keep: [...steppers, ...readouts] };
	};
	/** the HUD's two bet steppers, or the menu's copies of them: the minus and the plus */
	const hudSteppers = (): HTMLButtonElement[] => litParts().steppers;
	/** what Tab walks, in order: the six tiles in reading order, ACTIVATE, close, then the HUD's minus and plus. In
	 *  confirm: CONFIRM (once its guard is over and it shows) and Cancel */
	const tabStops = (): HTMLElement[] => {
		const usable = (el: HTMLElement | undefined | null): el is HTMLElement =>
			!!el && !(el as HTMLButtonElement).disabled && !el.closest('[inert]') && getComputedStyle(el).visibility !== 'hidden';
		if (confirm) return ([confirmBtn, cancelBtn] as (HTMLElement | undefined)[]).filter(usable);
		const tiles: (HTMLElement | undefined)[] = trayGroups.flatMap((g) => g.modes).map((m) => tileEls[m.id]);
		return [...tiles, ctaEl, closeEl, ...hudSteppers()].filter(usable);
	};
	const moveFocus = (dir: 1 | -1) => {
		const stops = tabStops();
		if (!stops.length) return;
		const i = stops.indexOf(document.activeElement as HTMLElement);
		const next = i < 0 ? (dir > 0 ? 0 : stops.length - 1) : (i + dir + stops.length) % stops.length;
		stops[next].focus({ preventScroll: true });
	};
	/** `inert` set by this menu on the HUD (only these are taken off again) */
	let inerted: Element[] = [];
	/** everything in the HUD layer is inert under the open menu but the lit BALANCE, the two steppers and the tint (the
	 *  tint is over the rest anyway; this keeps the keyboard and screen readers off it too). In confirm the whole HUD
	 *  is, the tint still not */
	const setHudInert = (how: 'off' | 'open' | 'confirm') => {
		for (const el of inerted) el.removeAttribute('inert');
		inerted = [];
		if (how === 'off' || typeof document === 'undefined') return;
		const fit = document.querySelector(HUD_FIT);
		if (!fit) return;
		const keep: Element[] = how === 'open' ? litParts().keep : [];
		const path = new Set<Element>();
		for (const k of keep) for (let e: Element | null = k; e && e !== fit; e = e.parentElement) path.add(e);
		const walk = (parent: Element) => {
			for (const c of parent.children) {
				// the tint stays out: an inert element is skipped by hit testing, and the tint must take every press
				if (keep.includes(c) || c.classList.contains('armoury-tint')) continue;
				if (path.has(c)) walk(c);
				else if (!c.hasAttribute('inert')) {
					c.setAttribute('inert', '');
					inerted.push(c);
				}
			}
		};
		walk(fit);
	};
	$effect(() => {
		const how = phase === 'open' ? (confirm ? 'confirm' : 'open') : 'off';
		void frame.layout;
		void armouryView.snap;
		untrack(() => {
			if (how === 'off') setHudInert('off');
			// after the DOM settles (a remounted chrome after a layout change has new elements)
			else tick().then(() => phase !== 'closed' && setHudInert(phase === 'open' ? (confirm ? 'confirm' : 'open') : 'off'));
		});
	});
	onMount(() => () => setHudInert('off'));

	// ---- keys (spec 7.3) -------------------------------------------------------------------------------------------
	const onKey = (e: KeyboardEvent) => {
		if (phase !== 'open') return;
		if (e.key === 'Tab') {
			// the focus trap: Tab and Shift+Tab walk the menu's stops (and the lit steppers) and wrap
			e.preventDefault();
			moveFocus(e.shiftKey ? -1 : 1);
			return;
		}
		if (e.key === 'Escape') {
			e.preventDefault();
			if (confirm) cancel();
			else close(true);
			return;
		}
		if (confirm) {
			if (e.key === 'Enter') {
				const a = document.activeElement;
				if (a instanceof HTMLButtonElement) return; // a focused button keeps its own Enter
				e.preventDefault();
				doConfirm();
			}
			return;
		}
		if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
			e.preventDefault();
			step(e.key === 'ArrowLeft' ? -1 : 1);
		} else if (e.key === 'Enter') {
			const a = document.activeElement;
			if (a instanceof HTMLButtonElement && !a.classList.contains('tile')) return;
			e.preventDefault();
			activate();
		}
	};

	// ---- money -----------------------------------------------------------------------------------------------------
	/** an amount is ONE word: the space inside "100.00 ARS" or "GC 1,000" is a no-break space */
	const money = (n: number) => numberToCurrencyString(n).replace(/ /g, ' ');
	const price = (id: string) => stateBet.betAmount * modeCost(id);
	const isOn = $derived(activeId === sel);
	const short = $derived(!isOn && price(sel) > stateBet.balanceAmount);
	const priceText = $derived(money(price(sel)));

	/** a template's sentence: {name} filled, {amt} left for the amount span */
	const named = (t: string, id: ArmouryModeId) => fill(t, { name: armouryName(id) });
	const status = $derived.by((): { tag: string | null; text: string; amt: string } | null => {
		if (isOn) {
			const tag = TX.onTag[mode.group];
			return { tag, text: afterTag(mode.group === 'spin' ? TX.status.anteOn : TX.status.buyLoaded, tag), amt: priceText };
		}
		if (note === sel) return { tag: null, text: named(mode.group === 'spin' ? TX.status.anteOff : TX.status.buyUnloaded, sel), amt: money(stateBet.betAmount) };
		return null;
	});

	// ---- fits (spec 6.4): the price on its plaque, the confirm rows. Again when the fonts land and the bet changes ----
	let fontTick = $state(0);
	const loadFonts = async () => {
		try {
			await Promise.all([document.fonts.load("700 38px 'Cinzel'"), document.fonts.load("400 20px 'Outfit Text'"), document.fonts.load("700 20px 'Outfit Text'")]);
		} catch {
			/* the fallback face measures */
		}
		fontTick += 1;
	};
	const DISPLAY = { face: "'Cinzel', 'Outfit Text', serif", weight: 700 };
	/** touch layouts: the buy row's width (the plaque is half of it less the 10 px gap; a price still too long at its
	 *  floor takes the whole row and the button goes under it) */
	let buyW = $state(0);
	const BUY_GAP = 10;
	const priceFit = $derived.by(() => {
		void fontTick;
		const face = { ...DISPLAY, letterSpacing: 0.02 };
		if (!touch) return fitPrice({ text: priceText, nominal: 38, plaqueW: 330, rowW: 0, touch: false, rules: ARMOURY.fit.price, face });
		if (!(buyW > 0)) return { size: frame.layout === 'sideways' ? 22 : 24, stacked: false, fits: true };
		return fitPrice({ text: priceText, nominal: frame.layout === 'sideways' ? 22 : 24, plaqueW: (buyW - BUY_GAP) / 2, rowW: buyW, touch: true, rules: ARMOURY.fit.price, face });
	});
	let rowW = $state(348);
	let labelW = $state<number[]>([0, 0, 0]);
	const confirmRows = $derived.by(() => {
		void fontTick;
		const x = modeCost(mode.id);
		const rows = [
			{ label: TX.confirmRow.base, value: money(stateBet.betAmount), total: false },
			{ label: armouryName(mode.id), value: fill(TX.confirmRow.multiple, { x }), total: false },
			{ label: mode.group === 'spin' ? TX.confirmRow.everySpin : TX.confirmRow.total, value: priceText, total: true },
		];
		return rows.map((r, i) => {
			const face = r.total ? DISPLAY : { face: "'Outfit Text', 'Outfit', sans-serif", weight: 600 };
			const fit = fitConfirmAmount({ text: r.value, nominal: touch ? (r.total ? 26 : 15) : r.total ? 34 : 18, rowW, labelW: labelW[i], total: r.total, touch, rules: ARMOURY.fit.confirm, face });
			return { ...r, size: fit.size, fits: fit.fits };
		});
	});

	// ---- pictures: fetched by a normal URL, decoded, faded in when ready (never a blob: URL) -------------------------
	const PIC = {
		thumbs: stamp(ARMOURY_ASSETS.thumbs),
		plaque: stamp(ARMOURY_ASSETS.plaque),
		crest: stamp(ARMOURY_ASSETS.crest),
		card: stamp(INTRO_CARD_ASSETS.frame),
		cardLg: stamp(ARMOURY_ASSETS.cardLg),
		hero: (m: ArmouryMode) => stamp(ARMOURY_ASSETS.hero(m.art, PHONE_TIER)),
	};
	const allPics = () => [PIC.thumbs, PIC.plaque, PIC.crest, PIC.card, ...ARMOURY_MODES.map(PIC.hero)];
	/** url -> its aspect ratio, once decoded */
	const pics = $state<Record<string, number>>({});
	/** the confirm card's frame: on desktop the large one once it is decoded (spec 3.1, decided in the spec) */
	const cardPic = $derived(frame.layout === 'desktop' && pics[PIC.cardLg] != null ? PIC.cardLg : PIC.card);
	const asked = new Set<string>();
	const want = (url: string) => {
		if (asked.has(url) || typeof window === 'undefined') return;
		asked.add(url);
		const have = armouryDecoded.get(url);
		if (have?.naturalHeight) {
			pics[url] = have.naturalWidth / have.naturalHeight;
			return;
		}
		const img = new Image();
		img.decoding = 'async';
		img.src = url;
		img.decode().then(
			() => (pics[url] = img.naturalWidth / Math.max(1, img.naturalHeight)),
			() => asked.delete(url), // asked again on the next open
		);
	};
	const thumbPos = (m: ArmouryMode) => `${(ARMOURY_ART_ORDER.indexOf(m.art) / Math.max(1, ARMOURY_ART_ORDER.length - 1)) * 100}% 0%`;
	const url = (u: string) => `url("${u}")`;

	// the rays behind every picture: 24 triangles and two circles, defined once (a <symbol>), in the mode colour
	const RAYS = Array.from({ length: 24 }, (_, i) => {
		const a = (i * 15 * Math.PI) / 180;
		const w = 0.045;
		const r0 = 0.56;
		const r1 = i % 2 ? 0.8 : 0.98;
		const p = (ang: number, r: number) => `${(50 + 50 * r * Math.cos(ang)).toFixed(2)},${(50 + 50 * r * Math.sin(ang)).toFixed(2)}`;
		return `${p(a - w, r0)} ${p(a, r1)} ${p(a + w, r0)}`;
	});

	// ---- the plate: one fill and two rules; its height follows the content by transform only ------------------------
	let detailH = $state(0);
	const detailTop = $derived(mode.odds ? 92 : 96);

	const tileLabel = (m: ArmouryMode) =>
		fill(TX.aria.tile, { name: armouryName(m.id), kind: TX.aria.kind[m.group], x: modeCost(m.id) }) + (activeId === m.id ? TX.aria.on : '');
	const tileMultiple = (m: ArmouryMode) => {
		const x = modeCost(m.id);
		const full = fill(TX.tileMultiple[m.group], { x });
		const head = `${x}x`;
		return full.startsWith(head) ? { head, tail: full.slice(head.length) } : { head: full, tail: '' };
	};
	const trayGroups = (['spin', 'buy'] as const).map((g) => ({ g, modes: ARMOURY_MODES.filter((m) => m.group === g) }));

	// ---- the touch layouts' measured edges (spec 4.2 "Measured anchors, not constants"): read when the menu opens and on
	// every layout change, never per frame. CSS px in the viewport; menuFrame.ts turns them into design px ------------
	const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };
	let anchors = $state<Anchors>({ safe: ZERO });
	/** env(safe-area-inset-*), read off a hidden probe element's padding */
	const readSafe = () => {
		if (!safeEl) return ZERO;
		const cs = getComputedStyle(safeEl);
		return { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
	};
	const measure = () => {
		if (typeof document === 'undefined') return;
		const a: Anchors = { safe: readSafe() };
		const fit = document.querySelector(HUD_FIT);
		if (fit && !frame.hudCopies && frame.layout !== 'desktop') {
			const r = (e: Element | null) => (e ? e.getBoundingClientRect() : null);
			if (frame.layout === 'sideways') {
				const parts = [...fit.querySelectorAll('.stats > *, .stats > .spin-row > *, .stats > .spin-row .minus > *')].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0);
				if (parts.length) a.hudRight = Math.max(...parts.map((b) => b.right));
				const bal = r(fit.querySelector('.stats > :first-child'));
				if (bal && bal.width > 0) a.balance = { x: bal.left, y: bal.top };
			} else {
				const stats = r(fit.querySelector('.stats'));
				if (stats && stats.height > 0) a.hudTop = stats.top;
				const strips = [...fit.querySelectorAll('.strip')].map((e) => e.getBoundingClientRect()).filter((b) => b.height > 0);
				if (strips.length) {
					a.clockTop = Math.min(...strips.map((b) => b.top));
					a.clockBottom = Math.max(...strips.map((b) => b.bottom));
				}
			}
		}
		anchors = a;
	};
	const da = $derived(designAnchors(frame, anchors, LAY));

	// ---- the hero gives (spec 4.4, 4.5): it takes what the tray and the plate leave, and is dropped under its minimum
	// (portrait and tablet minHero, sideways heroDropUnder). From the tray's and the plate's own heights, so dropping it
	// cannot change the sum ------------------------------------------------------------------------------------------
	let trayH = $state(0);
	let panelH = $state(0);
	let heroBoxH = $state(0);
	const PANEL_MARGIN_TOP = 9; // portrait / tablet plate margin (page.css: margin 9 8 0)
	const HERO_GAP = 6; // under the hero
	const SIDE_TOP = 14; // sideways: the middle column's top padding
	const heroRoom = $derived.by(() => {
		if (!touch) return Infinity;
		if (frame.layout === 'sideways') return da.contentBottom - SIDE_TOP - panelH - HERO_GAP;
		return da.contentBottom - da.contentTop - trayH - panelH - PANEL_MARGIN_TOP - HERO_GAP;
	});
	const noHero = $derived(touch && heroRoom < (frame.layout === 'sideways' ? LAY.sideways.heroDropUnder : LAY.portrait.minHero));
	/** the rays behind the touch hero: min(height x 1.22, 300) (page.js sizeHero) */
	const heroRays = $derived(Math.round(Math.min(heroBoxH * LAY.portrait.rays.perH, LAY.portrait.rays.max)));

	// ---- where the touch pieces sit (design px in the frame) ---------------------------------------------------------
	const sideEdge = $derived(da.safe.right + LAY.sideways.edge);
	const hdrStyle = $derived.by(() => {
		if (!touch) return '';
		const n = da.name;
		if (frame.layout === 'sideways') return n.place === 'above' ? `left:${(n.x ?? 0).toFixed(1)}px;top:${n.y.toFixed(1)}px` : `left:40px;top:92px`;
		// portrait in the band above the clock strip: centred on the band's middle (the 18 px crest is the line's height)
		return `left:${frame.contentLeft.toFixed(1)}px;width:${frame.contentWidth.toFixed(1)}px;top:${(n.place === 'band' ? n.y - 9 : n.y).toFixed(1)}px`;
	});
	const closeStyle = $derived.by(() => {
		if (!touch) return '';
		if (frame.layout === 'sideways') return `right:${sideEdge.toFixed(1)}px;top:${SIDE_TOP}px`;
		return `right:${(frame.contentLeft + 8).toFixed(1)}px;top:${da.contentTop.toFixed(1)}px`;
	});
	/** the confirm: the intro card's frame (portrait, tablet), centred, cardGap under the first content line. On a phone
	 *  too short for it (spec risk 4), it first rises (the name it would sit under has stepped back in confirm; never
	 *  above the safe area), and only then is scaled down to the room above the HUD row. Sideways: the tray's own slab */
	const cardPlace = $derived.by(() => {
		const C = LAY.portrait.card;
		const want = frame.layout === 'tablet' ? Math.max(da.safe.top, LAY.tablet.cardTop) : da.contentTop + LAY.portrait.cardGap;
		const top = Math.max(da.safe.top, Math.min(want, da.contentBottom - C.h));
		return { top, k: Math.min(1, (da.contentBottom - top) / C.h) };
	});
	const cardScale = $derived(!touch || frame.layout === 'sideways' ? 1 : cardPlace.k);
	const cardStyle = $derived.by(() => {
		if (!touch) return '';
		if (frame.layout === 'sideways') return `left:${((frame.width - LAY.sideways.slab) / 2).toFixed(1)}px;top:${(da.safe.top + LAY.sideways.slabTop).toFixed(1)}px;width:${LAY.sideways.slab}px`;
		const C = LAY.portrait.card;
		const { top, k } = cardPlace;
		// a scaled card scales its hit boxes too: CONFIRM's and Cancel's minimum grows to stay 44 CSS px
		return `left:${((frame.width - C.w) / 2).toFixed(1)}px;top:${top.toFixed(1)}px;width:${C.w}px;height:${C.h}px${k < 1 ? `;transform:scale(${k.toFixed(4)});transform-origin:50% 0;--hit:${(da.minHit / k).toFixed(1)}px` : ''}`;
	});
	/** the small 16:9 frames: the menu's own BALANCE, bet readout and steppers, where the landscape HUD's trio would sit
	 *  under the desktop box (the trio's master rectangle at the box's 1440 / 1280) */
	const ART = landscapeTrioSpan(true);
	const K = LAY.desktop.w / LAY.desktop.master;
	const COPY = { left: ART.x * K, top: (720 - 18 - 92) * K, width: ART.width, height: 92, k: K };

	// ---- THE SWIPE (portrait phone, tablet; spec 5.2): on the hero and the plate. While dragging, the hero and the plate
	// follow the finger 1 to 1 and the hero turns (yawPerPx, at most yawMax); past the first or the last mode the pull
	// goes soft (endPull). Let go past goPx, or a flick past flickPx faster than flickSpeed: the old content carries on
	// carryPx and fades (swapOutMs), the new enters slideTouch from the other side (hero 650, plate 520). Under that it
	// springs back (backMs), no overshoot. The click that follows a drag is swallowed for clickBlockMs. Ignored during a
	// swap and in confirm; a layout change, a close, ACTIVATE or a mode switched on or off drops it at rest. Design px.
	const drag = { id: null as number | null, on: false, el: null as HTMLElement | null, x0: 0, y0: 0, raw: 0, dx: 0, t0: 0, block: -1e9 };
	let dragging = $state(false);
	const canSwipe = () => swipeLay && phase === 'open' && !confirm && !confirming && !swapTimer;
	const setX = (x: number) => {
		const v = x ? `translateX(${x.toFixed(1)}px)` : '';
		if (heroSw) heroSw.style.transform = v;
		if (panelSw) panelSw.style.transform = v;
	};
	function cancelDrag() {
		const was = drag.on;
		drag.id = null;
		drag.on = false;
		drag.dx = 0;
		dragging = false;
		if (was) {
			setX(0);
			heroView?.setDragYaw(0);
		}
	}
	const modeIndex = (id: string) => ARMOURY_MODES.findIndex((m) => m.id === id);
	const onSwipeDown = (e: PointerEvent) => {
		if (!canSwipe() || drag.id !== null) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		// the flick's speed is timed by the events' own times (when the finger moved, not when the page got round to it)
		Object.assign(drag, { id: e.pointerId, on: false, el: e.currentTarget as HTMLElement, x0: e.clientX, y0: e.clientY, raw: 0, dx: 0, t0: e.timeStamp });
	};
	const onSwipeMove = (e: PointerEvent) => {
		if (drag.id !== e.pointerId) return;
		const dx = (e.clientX - drag.x0) / frame.u;
		const dy = (e.clientY - drag.y0) / frame.u;
		if (!drag.on) {
			if (Math.abs(dx) < SW.startPx || Math.abs(dx) < Math.abs(dy)) return;
			if (!canSwipe()) {
				drag.id = null;
				return;
			}
			drag.on = true;
			dragging = true;
			try {
				drag.el?.setPointerCapture(e.pointerId);
			} catch {
				/* a synthetic pointer */
			}
			// the finger takes over: the hero's and the plate's moves (an entrance, an entry) land where they belong
			mv.hero.stopAll();
			mv.plate.stopAll();
			mv.swipe.stopAll();
			mv.flip.stopAll();
		}
		const i = modeIndex(sel);
		const atEnd = (dx > 0 && i === 0) || (dx < 0 && i === ARMOURY_MODES.length - 1);
		drag.raw = dx;
		drag.dx = atEnd ? dx * SW.endPull : dx;
		if (!reduced) setX(drag.dx);
		heroView?.setDragYaw(Math.max(-SW.yawMax, Math.min(SW.yawMax, drag.dx * SW.yawPerPx)));
	};
	const onSwipeEnd = (e: PointerEvent) => {
		if (drag.id !== e.pointerId) return;
		drag.id = null;
		if (!drag.on) return;
		drag.on = false;
		dragging = false;
		drag.block = performance.now(); // the click that follows a drag is not a tap
		const dx = drag.raw;
		const from = drag.dx;
		drag.dx = 0;
		const v = Math.abs(dx) / Math.max(1, e.timeStamp - drag.t0);
		heroView?.setDragYaw(0);
		const n = modeIndex(sel) + (dx < 0 ? 1 : -1);
		const go = e.type !== 'pointercancel' && canSwipe() && n >= 0 && n < ARMOURY_MODES.length && (Math.abs(dx) > SW.goPx || (Math.abs(dx) > SW.flickPx && v > SW.flickSpeed));
		setX(0);
		if (!go) {
			// springs back, no overshoot
			for (const el of [heroSw, panelSw]) mv.swipe.play(el, [{ transform: `translateX(${from.toFixed(1)}px)` }, { transform: 'none' }], { duration: reduced ? 0 : SW.backMs, ease });
			return;
		}
		swipeTo(ARMOURY_MODES[n].id, dx < 0 ? -1 : 1, from);
	};
	/** a swipe past the threshold: the old content carries on and fades, the newest selection lands and enters */
	const swipeTo = (id: ArmouryModeId, sign: 1 | -1, from: number) => {
		const m = armouryMode(id)!;
		sel = m.id;
		note = null;
		armouryView.tint = m.tint;
		controls.sound('soundPressSub'); // swiping to a mode clicks as a tap does (answer 4)
		if (reduced) {
			land(false);
			return;
		}
		mv.swipe.stopAll();
		for (const el of [heroSw, panelSw])
			mv.swipe.play(
				el,
				[
					{ transform: `translateX(${from.toFixed(1)}px)`, opacity: 1 },
					{ transform: `translateX(${(from + sign * SW.carryPx).toFixed(1)}px)`, opacity: 0 },
				],
				{ duration: M.swapOutMs, ease: 'linear', fill: 'forwards' },
			);
		swapTimer = setTimeout(() => landSwipe(sign), M.swapOutMs);
	};
	const landSwipe = (sign: 1 | -1) => {
		clearTimeout(swapTimer);
		swapTimer = undefined;
		mv.hero.stopAll();
		mv.plate.stopAll();
		mv.flip.stopAll();
		const before = snapshot();
		view = sel;
		swapOut = false;
		const seq = openSeq;
		tick().then(() => {
			mv.swipe.stopAll(); // the carried out content is gone; the new takes its place in the same frame
			if (seq !== openSeq) return;
			if (phase !== 'open' || confirm) return afterLayout();
			flip(before);
			const D = M.slideTouch;
			const enter = (el: HTMLElement | undefined, duration: number) =>
				mv.swipe.play(
					el,
					[
						{ transform: `translateX(${-sign * D}px)`, opacity: 0 },
						{ transform: 'none', opacity: 1 },
					],
					{ duration, ease, fill: 'backwards' },
				);
			enter(heroSw, durs.small * M.heroSwapRun);
			enter(panelSw, durs.small);
		});
	};
	onMount(() => {
		addEventListener('pointermove', onSwipeMove, { passive: true });
		addEventListener('pointerup', onSwipeEnd);
		addEventListener('pointercancel', onSwipeEnd);
		// the click that follows a drag is swallowed before any handler under the menu sees it
		const swallow = (e: MouseEvent) => {
			if (performance.now() - drag.block < SW.clickBlockMs && e.target instanceof Element && !!e.target.closest('.arm')) {
				e.stopPropagation();
				e.preventDefault();
			}
		};
		addEventListener('click', swallow, true);
		return () => {
			removeEventListener('pointermove', onSwipeMove);
			removeEventListener('pointerup', onSwipeEnd);
			removeEventListener('pointercancel', onSwipeEnd);
			removeEventListener('click', swallow, true);
		};
	});
	// a mode switched on or off under a drag (spec 7.2): the drag is dropped, everything back at rest
	$effect(() => {
		void activeId;
		untrack(cancelDrag);
	});

	/** every animation now running on the menu, its tint or the lit HUD cells (spec 5.6: zero after any interruption).
	 *  The hero's breathing is the one deliberate endless motion (spec 5.4) and is not counted */
	/** the menu, its tint and every lit HUD piece of every chrome (Chrome.svelte's .armoury-lit rules) */
	const MOTION_SCOPE = '.arm, .armoury-tint, .trio > .cell, .armoury-lit .stats, .armoury-lit .stats > *, .armoury-lit .bar .grid > *';
	const running = () => {
		try {
			return document.getAnimations().filter((a) => {
				const t = (a.effect as KeyframeEffect | null)?.target;
				return a.playState !== 'finished' && a.playState !== 'idle' && t instanceof Element && !!t.closest(MOTION_SCOPE) && !t.classList.contains('hero-breathe');
			}).length;
		} catch {
			return 0;
		}
	};

	// ---- DEV hook (house rule: window.__manticore only; removed on unmount) -----------------------------------------
	onMount(() => {
		if (!import.meta.env.DEV) return;
		const box = (el: Element | null | undefined) => {
			if (!el) return null;
			const r = el.getBoundingClientRect();
			return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1) };
		};
		const hook = {
			state: () => ({
				phase,
				open: phase === 'open',
				layout: frame.layout,
				u: frame.u,
				frame: { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
				selection: sel,
				/** the mode the hero and the plate show (it follows the selection once a swap has faded the old out) */
				shown: view,
				swapping: swapTimer != null,
				confirm,
				active: activeId,
				short,
				price: priceText,
				priceFit,
				confirmRows: confirmRows.map((r) => ({ label: r.label, value: r.value, size: r.size, fits: r.fits })),
				status: status ? { tag: status.tag, text: status.text } : null,
				tint: armouryView.tint,
				decoded: Object.keys(pics).length,
				/** the hero on show: 'grid' or 'flat', its frame, the loop (HeroView.svelte debug()) */
				hero: heroView?.debug()?.mode ?? 'flat',
				heroView: heroView?.debug() ?? null,
				/** each hero's grid: unasked, none, waiting, loading, ready, released, failed; what is held decoded */
				grids: heroGridsInfo(),
				cardFrame: cardPic === PIC.cardLg ? 'lg' : 'intro',
				warm,
				warmed,
				reduced,
				/** animations running now on the menu, its tint and the lit HUD cells (CSS transitions included) */
				running: running(),
				/** the moves this menu started that are still running, per group */
				moves: Object.fromEntries(Object.entries(mv).map(([k, g]) => [k, g.running()])),
				/** the hero's requestAnimationFrame loop is running now (spec 5.4: only while something moves) */
				loop: heroView?.debug()?.loop ?? false,
				/** the touch layouts: the measured edges in design px, the hero's room and whether it is dropped, the diamond,
				 *  the swipe, the confirm card's scale, the menu's own bet controls (the small 16:9 frames) */
				touch,
				hudCopies: frame.hudCopies,
				anchors: da,
				measured: anchors,
				heroRoom: Number.isFinite(heroRoom) ? Math.round(heroRoom * 10) / 10 : null,
				noHero,
				caretX,
				heroCentre,
				dragging,
				dragDx: drag.dx,
				cardScale,
				balance: stateBet.balanceAmount,
				bet: stateBet.betAmount,
				mode: stateBet.activeBetModeKey,
			}),
			/** the HUD button's own function with no check in front of it (a probe proves its guards) */
			pressHud: () => controls.bonusPress(),
			open: () => {
				if (controls.bonusDisabled()) return false;
				controls.bonusPress();
				return true;
			},
			close: () => close(),
			select,
			activate,
			confirm: doConfirm,
			cancel,
			rects: () => {
				const q = (s: string) => box(rootEl?.querySelector(s));
				return {
					box: box(rootEl),
					header: q('.hdr'),
					close: q('.close'),
					hero: q('.hero'),
					plate: q('.plate-fill'),
					detail: q('.detail'),
					cta: q('.cta'),
					tray: q('.tray'),
					tiles: Object.fromEntries(ARMOURY_MODES.map((m) => [m.id, box(tileEls[m.id])])),
					/** the moving faces (the hit boxes above stay put) */
					tileFaces: Object.fromEntries(ARMOURY_MODES.map((m) => [m.id, box(tileMv[m.id])])),
					ctaFace: box(ctaFace),
					caret: q('.caret'),
					plaque: q('.plaque'),
					hudCopy: frame.hudCopies ? box(copyEl) : null,
					heroBox: box(heroBoxEl),
					panel: box(panelEl),
					trayBox: box(trayBoxEl),
					card: confirm ? q('.card') : null,
					cardFace: confirm ? q('.card-mv') : null,
					confirmBtn: confirm ? q('.c-confirm') : null,
					confirmFace: confirm ? q('.c-confirm .face') : null,
					cancel: confirm ? q('.cancel') : null,
					cancelFace: confirm ? q('.cancel .face') : null,
				};
			},
			constants: () => ARMOURY,
			/** hold the hero's pointer at design px from its pointer centre (null: the real pointer again) */
			setPointer: (x: number | null, y?: number) => heroView?.setPointer(x, y),
			/** hold the idle motion still (the touch turn and the breathing) */
			freezeIdle: (on: boolean) => heroView?.freezeIdle(on),
			/** a probe's own clock for the hero (deterministic clips): heroClock(true), then heroTick(ms) per frame */
			heroClock: (on: boolean) => heroView?.manualClock(on),
			heroTick: (ms: number) => heroView?.tickBy(ms),
			/** the stops Tab walks now, as labels */
			tabStops: () => tabStops().map((el) => el.getAttribute('aria-label') || el.textContent?.trim() || el.className),
			/** the open's and a swap's plans as built (spec 5.2), and when the open is settled */
			timeline: () => {
				const steps = entrancePlan(M, { tiles: ARMOURY_MODES.length, touch, reduced });
				return { entrance: steps, end: entranceEnd(steps), swap: swapPlan(M, { touch, reduced }), ease };
			},
		};
		const m = ((window as any).__manticore ??= {});
		m.armoury = hook;
		return () => {
			if (m.armoury === hook) delete m.armoury;
		};
	});
</script>

<svelte:window onkeydown={onKey} />

{#snippet amtRun(t: string, amt: string)}{#each t.split('{amt}') as part, i}{#if i > 0}<span class="amt" dir="ltr">{amt}</span>{/if}{part}{/each}{/snippet}
{#snippet rich(text: string, amt: string)}{#each boldRuns(text) as run}{#if run.b}<b>{@render amtRun(run.t, amt)}</b>{:else}{@render amtRun(run.t, amt)}{/if}{/each}{/snippet}
{#snippet burst(cls: string)}<svg class="burst {cls}" viewBox="0 0 100 100" aria-hidden="true"><use href="#arm-burst" width="100" height="100" /></svg>{/snippet}
{#snippet thumb(m: ArmouryMode, cls: string)}<span class="tpic {cls}" class:ready={pics[PIC.thumbs] != null} style:background-image={url(PIC.thumbs)} style:background-position={thumbPos(m)}></span>{/snippet}

{#if phase !== 'closed' || warm}
	{#key openSeq}
		<div
			class="arm lay-{frame.layout}"
			class:touch
			class:swipe={swipeLay}
			class:copies={frame.hudCopies}
			class:nohero={noHero}
			class:dragging
			class:open={phase === 'open'}
			class:warm={warm && phase === 'closed'}
			inert={warm && phase === 'closed'}
			aria-hidden={warm && phase === 'closed' ? 'true' : undefined}
			class:closing={phase === 'closing'}
			class:confirm
			class:has-odds={!!mode.odds}
			class:reduced
			class:swap-out={swapOut}
			class:plate-ease={plateEase}
			class:snap={snapping}
			bind:this={rootEl}
			style:left="{frame.left}px"
			style:top="{frame.top}px"
			style:width="{frame.width}px"
			style:height="{frame.height}px"
			style:transform="scale({frame.u})"
			style:--acc={mode.accent}
			style:--ease={ease}
			style:--dur="{durs.small}ms"
			style:--dur-l="{durs.large}ms"
			style:--close-ms={cssMs(M.closeMs)}
			style:--confirm-ms={cssMs(ARMOURY.tint.confirmMs)}
			style:--back-ms={cssMs(M.backMs)}
			style:--out-ms={cssMs(M.swapOutMs)}
			style:--veil-ms={cssMs(M.veilMs)}
			style:--card-out-ms={cssMs(M.cardOutMs)}
			style:--card-delay={cssMs(M.confirmDelayMs)}
			style:--card-y="{M.cardFrom.y}px"
			style:--card-s={M.cardFrom.scale}
			style:--sink="{M.sinkPx}px"
			style:--guard-ms={cssMs(M.confirmGuardMs)}
			style:--guard-fade-ms={cssMs(M.confirmFadeMs)}
			style:--dim={1 - ARMOURY.tint.confirmAdd - ARMOURY.tint.opacity}
			style:--ct={touch ? `${da.contentTop.toFixed(1)}px` : null}
			style:--cbot={touch ? `${Math.max(0, frame.height - da.contentBottom).toFixed(1)}px` : null}
			style:--cx={touch ? `${frame.contentLeft.toFixed(1)}px` : null}
			style:--ml={touch ? `${da.midLeft.toFixed(1)}px` : null}
			style:--rail="{LAY.sideways.rail}px"
			style:--side-r={touch ? `${(LAY.sideways.rail + LAY.sideways.hudGap).toFixed(1)}px` : null}
			style:--side-edge={touch ? `${sideEdge.toFixed(1)}px` : null}
			style:--side-top={touch ? `${(da.safe.top + SIDE_TOP).toFixed(1)}px` : null}
			style:--hit={touch ? `${da.minHit.toFixed(1)}px` : null}
			role="dialog"
			aria-modal="true"
			aria-labelledby="arm-name"
		>
			<svg class="defs" width="0" height="0" aria-hidden="true">
				<symbol id="arm-burst" viewBox="0 0 100 100">
					<g fill="currentColor">{#each RAYS as pts}<polygon points={pts} />{/each}</g>
					<circle cx="50" cy="50" r="25.5" fill="none" stroke="currentColor" stroke-width="0.7" />
					<circle cx="50" cy="50" r="23" fill="currentColor" opacity=".35" />
				</symbol>
			</svg>
			<!-- env(safe-area-inset-*), read by measure() -->
			<div class="safe-probe" aria-hidden="true" bind:this={safeEl}></div>

			<div class="hdr" inert={confirm} style={hdrStyle}>
				<span class="hdr-in" bind:this={hdrInEl}>
					<i class="hdr-crest pic" class:ready={pics[PIC.crest] != null} style:background-image={url(PIC.crest)} aria-hidden="true"></i>
					<span id="arm-name">{TX.name}</span>
				</span>
			</div>
			<button type="button" class="close lift" aria-label={TX.close} bind:this={closeEl} onclick={() => close()} style={closeStyle}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>
			</button>

			<!-- the hero (HeroView.svelte): flat art, then its angle grid once decoded; rays and a ground shadow. Still box
			     (the confirm's fade; on the portrait phone and the tablet also the swipe surface), the swap's fade out, the
			     swipe's moving wrapper, then the moving wrapper of the open's rise and a swap's rise -->
			<div class="hero" aria-hidden="true" bind:this={heroBoxEl} bind:clientHeight={heroBoxH} style:--bs={touch ? `${heroRays}px` : null} onpointerdown={onSwipeDown}>
				<div class="hero-fade" ontransitionend={onFadeEnd}>
					<div class="hero-sw" bind:this={heroSw}>
						<div class="hero-mv" bind:this={heroMv}>
							<div class="hero-in">
								<HeroView
									bind:this={heroView}
									art={mode.art}
									flatUrl={PIC.hero(mode)}
									flatAr={pics[PIC.hero(mode)]}
									flatReady={pics[PIC.hero(mode)] != null}
									heroH={mode.heroH}
									grid={heroGrid}
									active={phase === 'open' && !confirm && !warm && !noHero}
									{calm}
									frame={{ left: frame.left, top: frame.top, u: frame.u }}
									{reduced}
									rules={ARMOURY.hero}
									raysId="arm-burst"
									centre={heroCentre}
								bounds={{ w: frame.width, h: frame.height }}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- the buy plate: one fill that stretches and two brass rules (on the touch layouts the top rule is in the mode's
			     colour and, portrait and tablet, carries a diamond under the chosen tile). Still box (the confirm's fade), the
			     swipe's moving wrapper, the moving plate (the open's rise), the text's fade out and its moving wrapper -->
			<div class="panel" inert={confirm} bind:this={panelEl} bind:offsetHeight={panelH} onpointerdown={onSwipeDown}>
				<div class="panel-sw" bind:this={panelSw}>
					<div class="panel-mv" bind:this={panelMv}>
						<div class="plate" style:transform={touch ? null : `translateY(${detailTop}px)`} aria-hidden="true">
							<div class="plate-fill" style:transform={touch ? null : `scaleY(${(detailH / 100).toFixed(4)})`}></div>
							<div class="plate-top"></div>
							<div class="plate-bot" style:transform={touch ? null : `translateY(${Math.max(0, detailH - 2)}px)`}></div>
						</div>
						{#if swipeLay}<i class="caret" aria-hidden="true" bind:this={caretEl} style:transform="translateX({caretX.toFixed(1)}px) rotate(45deg)"></i>{/if}
						<div class="detail" style:top={touch ? null : `${detailTop}px`} bind:offsetHeight={detailH}>
							<div class="detail-mv" bind:this={detailMv}>
								<div class="d-head" bind:this={dHeadEl}>
									<div class="kicker">{TX.kicker[mode.group]}</div>
									<div class="name">{armouryName(mode.id)}</div>
								</div>
								<div class="d-body" bind:this={dBodyEl}>
									<div class="desc">{@render rich(TX.pitch[mode.id], '')}</div>
									{#if mode.odds}
										<div class="odds">
											{#each mode.odds as o (o.text)}
												{@const n = Math.round(o.share * 100)}
												<div class="orow">
													<span class="opct">{fill(TX.oddsShare, { n })}</span>
													<span class="obar" aria-hidden="true"><i style:width="{n}%" style:background={o.color}></i></span>
													<span class="oname">{TX.odds[o.text]}</span>
												</div>
											{/each}
										</div>
									{/if}
									{#if status}
										<div class="status" bind:this={statusEl}>{#if status.tag}<span class="on-tag">{status.tag}</span>{/if}{@render rich(status.text, status.amt)}</div>
									{/if}
								</div>
								<div class="vol" role="img" aria-label={fill(TX.aria.volatility, { n: mode.volatility })} bind:this={volEl}>
									<span class="vol-l" aria-hidden="true">{TX.volatility}</span>
									<span class="pips" aria-hidden="true">{#each [1, 2, 3, 4] as i}<i class:on={i <= mode.volatility}></i>{/each}</span>
								</div>
								<div class="buy" class:stack={touch && priceFit.stacked} bind:this={buyEl} bind:clientWidth={buyW}>
									<!-- desktop: the picture stretched in its box; touch: three slices (the ends never squash) -->
									<div class="plaque" class:ready={pics[PIC.plaque] != null} style:background-image={touch ? null : url(PIC.plaque)} style:--plq={url(PIC.plaque)}>
										{#if touch}<i class="pl" aria-hidden="true"></i><i class="pm" aria-hidden="true"><i></i></i><i class="pr" aria-hidden="true"></i>{/if}
										<span class="fig" dir="ltr" aria-live="polite" style:font-size="{priceFit.size}px">{priceText}</span>
									</div>
									<div class="per">{TX.priceLabel[mode.group]}</div>
									<button
										type="button"
										class="btn lift cta"
										class:off={isOn}
										bind:this={ctaEl}
										disabled={short}
										aria-describedby={short ? 'arm-why' : undefined}
										onclick={activate}
									>
										<span class="face" bind:this={ctaFace}>{isOn ? (mode.group === 'spin' ? TX.button.switchOff : TX.button.unload) : TX.button.activate}</span>
									</button>
									{#if short}<div class="why" id="arm-why">{TX.balanceShort}</div>{/if}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- the tray: two per spin modes, four buys. Still box (the confirm's fade), the slab (the open's fade) -->
			<div class="tray-box" inert={confirm} bind:this={trayBoxEl} bind:offsetHeight={trayH}>
				<div class="tray" bind:this={trayEl}>
					{#each trayGroups as grp (grp.g)}
						<div class="grp grp-{grp.g}">
							<div class="gh"><b>{TX.group[grp.g].head}</b><span>{TX.group[grp.g].sub}</span></div>
							<div class="tiles">
								{#each grp.modes as m (m.id)}
									{@const mult = tileMultiple(m)}
									<!-- a still button (its hit box never moves); the moving wrapper (the open); the face (the confirm's sink) -->
									<button
										type="button"
										class="tile"
										data-mode={m.id}
										class:sel={m.id === sel}
										class:on={activeId === m.id}
										style:--m={m.accent}
										aria-pressed={m.id === sel}
										aria-label={tileLabel(m)}
										bind:this={tileEls[m.id]}
										onclick={() => select(m.id)}
									>
										<span class="tmv" bind:this={tileMv[m.id]}>
											<span class="tf">
												<span class="thumb" aria-hidden="true">{@render burst('')}{@render thumb(m, '')}</span>
												<span class="tn" aria-hidden="true">{armouryName(m.id)}</span>
												<span class="tp" aria-hidden="true">{mult.head}{#if mult.tail}<small>{mult.tail}</small>{/if}</span>
												{#if activeId === m.id}<span class="on-tag" aria-hidden="true">{TX.onTag[m.group]}</span>{/if}
											</span>
										</span>
									</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- the small 16:9 frames (the desktop box on the phone sideways chrome; answer 2): the menu's own BALANCE, bet
			     readout and steppers, where the landscape HUD's row would be. The real HUD's components and rules, the
			     readout taking no press (it would open the bet picker in the menu's place) -->
			{#if frame.hudCopies}
				<div class="hud-copy" bind:this={copyEl} style:left="{COPY.left}px" style:top="{COPY.top}px" style:width="{COPY.width * COPY.k}px" style:height="{COPY.height * COPY.k}px">
					<div class="hc-in" style:width="{COPY.width}px" style:height="{COPY.height}px" style:transform="scale({COPY.k})">
						<div class="hc-cell left"><TrioStat label="BALANCE" value={controls.balanceText()} accent="#ffdc4a" size="lg" align="left" maxWidth={205} /></div>
						<div class="hc-cell right">
							<StepButton dir={-1} size={28} {controls} />
							<div class="hc-slot"><TrioStat label={controls.betLabel()} value={controls.betText()} accent="#ffdc4a" size="lg" align="right" maxWidth={205} /></div>
							<StepButton dir={1} size={28} {controls} />
						</div>
					</div>
				</div>
			{/if}

			<!-- the confirm card: the intro cards' own frame, centred; the rest steps back. The card is a still box; its
			     picture and text rise in a moving wrapper; its two buttons stay put while their faces follow the card.
			     Sideways it is the tray's own slab (no picture, no art box). Touch layouts drop the "what you get" line -->
			<div class="card" role="alertdialog" aria-label={fill(TX.confirmTitle, { name: armouryName(mode.id) })} aria-hidden={!confirm} inert={!confirm} tabindex="-1" bind:this={cardEl} style={cardStyle}>
				<div class="card-mv" class:ready={pics[cardPic] != null} style:background-image={frame.layout === 'sideways' ? null : url(cardPic)}>
					<div class="c-art" aria-hidden="true"><div class="c-in">{@render burst('')}{@render thumb(mode, 'c-pic')}</div></div>
					<div class="c-body">
						<div class="name">{armouryName(mode.id)}</div>
						{#if !touch}<div class="c-gets">{@render rich(TX.gets[mode.id], '')}</div>{/if}
						<div class="crows" bind:clientWidth={rowW}>
							{#each confirmRows as r, i (i)}
								<div class="crow" class:total={r.total}>
									<span bind:offsetWidth={labelW[i]}>{r.label}</span>
									<b dir="ltr" style:font-size="{r.size}px">{r.value}</b>
								</div>
							{/each}
						</div>
						<div class="c-what">{@render rich(mode.group === 'spin' ? anteConfirm(mode.id as 'ANTE' | 'SUPER_ANTE') : named(TX.confirmBuy, mode.id), '')}</div>
					</div>
					<div class="c-flash" class:on={flash}></div>
				</div>
				<div class="c-keys">
					<button type="button" class="btn lift c-confirm" bind:this={confirmBtn} onclick={doConfirm}><span class="face cf" style:transform-origin={faceOrigin.confirm}>{TX.button.confirm}</span></button>
					<button type="button" class="cancel" bind:this={cancelBtn} onclick={cancel}><span class="face cf" style:transform-origin={faceOrigin.cancel}>{TX.button.cancel}</span></button>
				</div>
			</div>
		</div>
	{/key}
{/if}

<style>
	/* the palette and faces: what a future game changes (spec 10). Colours are the prototype's (page.css :root) */
	.arm {
		--brass: #c2a063;
		--brass-hi: #ecd092;
		--brass-lo: #a8823c;
		--brass-deep: #5d4720;
		--brass-dark: #6d5a36;
		--gold: #e2bf72;
		--gold-hi: #f3d68a;
		--fig: #e6c47c;
		--cream: #ddd3bb;
		--cream-2: #b9ad92;
		--muted: #8f856e;
		--iron-hi: #211c17;
		--iron-lo: #14110e;
		--iron-deep: #0b0907;
		--tray-hi: #1c1814;
		--tray-lo: #100d0b;
		--ink: #241707;
		--white: #fff;
		--black: #000;
		--veil: #090705;
		--plate: #0a0806;
		--edge: #2a1c0c;
		--btn-1: #f3d892;
		--btn-2: #d9ae58;
		--btn-3: #bd8d36;
		--btn-4: #cfa24c;
		--btn-lip: #8a6220;
		--btn-line: #4d340e;
		--btn-shine: #fff3cf;
		--dis-1: #4a4132;
		--dis-2: #3a3226;
		--dis-text: #8a7c62;
		--dis-line: #2a241a;
		--hud-btn: #17181c;
		--hud-line: #e8e8e8;
		--warn: #f0a070;
		--shade-90: rgba(0, 0, 0, 0.9);
		--shade-55: rgba(0, 0, 0, 0.55);
		--shade-45: rgba(0, 0, 0, 0.45);
		--shade-30: rgba(0, 0, 0, 0.3);
		--shine-30: rgba(255, 236, 190, 0.3);
		--shine-45: rgba(236, 208, 146, 0.45);
		--rule: rgba(194, 160, 99, 0.25);
		/* body copy: the real variable Outfit (Build B2); the display face Cinzel, with Outfit second so a currency
		   symbol Cinzel lacks is borrowed from the menu's own face (spec 6.3) */
		--ui: 'Outfit Text', 'Outfit', system-ui, sans-serif;
		--display: 'Cinzel', 'Outfit Text', serif;

		position: absolute;
		width: 1440px;
		height: 810px;
		transform-origin: 0 0;
		pointer-events: none;
		font-family: var(--ui);
		font-weight: 400;
		color: var(--cream);
		user-select: none;
		-webkit-user-select: none;
	}
	/* the warm pass: mounted once at 1 % for two frames, taking nothing (spec 3.3 point 6) */
	.arm.warm {
		opacity: 0.01;
	}
	.arm.warm :global(*) {
		pointer-events: none !important;
	}
	/* the close: one fade of the whole menu, no movement. Every other transition stops where it is (spec 5.6) */
	.arm.closing {
		opacity: 0;
		transition: opacity var(--close-ms) linear;
	}
	/* a layout change while moving: two frames with no transition, so everything simply lands in the new layout */
	.arm.closing :global(*),
	.arm.closing :global(*::before),
	.arm.closing :global(*::after),
	.arm.snap :global(*),
	.arm.snap :global(*::before),
	.arm.snap :global(*::after) {
		transition: none !important;
	}
	.arm > :global(*) {
		position: absolute;
		box-sizing: border-box;
	}
	.arm :global(b) {
		font-weight: 700;
	}
	.defs {
		width: 0;
		height: 0;
		overflow: hidden;
	}
	/* :where, so the buttons' own rules (.btn's face, CONFIRM's margin-top: auto) win over this base */
	.arm :where(button) {
		margin: 0;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.arm :where(button:disabled) {
		cursor: default;
	}
	.arm :focus-visible {
		outline: 2px solid var(--brass-hi);
		outline-offset: 2px;
	}
	.card:focus-visible {
		outline: none;
	}
	/* the parts take the pointer, the box does not (the lit HUD row sits under its lower edge) */
	.arm.open .tray,
	.arm.open .detail,
	.arm.open .close {
		pointer-events: auto;
	}
	.amt {
		white-space: nowrap;
		unicode-bidi: isolate;
	}
	/* a picture fades in when it is decoded (the landing cards' pattern) */
	.pic,
	.tpic {
		opacity: 0;
		transition: opacity 150ms linear;
	}
	.pic.ready,
	.tpic.ready {
		opacity: 1;
	}

	/* the button lift: a flat white veil, opacity only (no filter). A button's face carries the veil (the face is what
	   moves); the press nudge is the `translate` property, so it never meets a move's `transform` */
	.lift {
		position: relative;
		transition: translate 60ms linear;
	}
	.close::before,
	.btn > .face::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: var(--white);
		opacity: 0;
		transition: opacity 100ms linear;
		pointer-events: none;
	}
	@media (hover: hover) and (pointer: fine) {
		.close:hover::before,
		.btn:not(:disabled):hover > .face::before {
			opacity: 0.16;
		}
		.close:active::before,
		.btn:not(:disabled):active > .face::before {
			opacity: 0.34;
			transition-duration: 30ms;
		}
		.lift:not(:disabled):active {
			translate: 0 2px;
		}
		.cancel:hover {
			opacity: 1;
		}
		.cancel:active {
			opacity: 1;
			translate: 0 2px;
		}
		.tray:has(.tile:hover) .tf::after {
			opacity: 0.45;
		}
		.tray .tile:hover .tf::after {
			opacity: 0;
		}
	}

	/* ── header, close ── */
	.hdr {
		left: 48px;
		top: 38px;
		display: flex;
		align-items: center;
		gap: 10px;
		font: 700 20px/1 var(--display);
		letter-spacing: 0.3em;
		color: var(--brass);
		text-shadow:
			0 -1px 0 var(--shade-90),
			0 1px 0 var(--shine-30);
		white-space: nowrap;
	}
	/* the name and its crest on one line (the crest is an <i>: without this it was an inline box with no size, and the
	   crest never showed, desktop included, until part C) */
	.hdr-in {
		display: flex;
		align-items: center;
		gap: inherit;
	}
	.hdr-crest {
		display: block;
		flex: none;
		width: 37px;
		height: 34px;
		background: center / contain no-repeat;
	}
	.close {
		right: 40px;
		top: 36px;
		width: 46px;
		height: 46px;
		border-radius: 10px;
		background: var(--hud-btn);
		border: 2px solid var(--hud-line);
		color: var(--white);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		position: absolute !important;
	}
	.close svg {
		width: 22px;
		height: 22px;
	}

	/* ── hero ── */
	.hero {
		left: 130px;
		top: 66px;
		width: 470px;
		height: 410px;
		--bs: 500px;
		pointer-events: none;
	}
	.hero-fade,
	.hero-sw,
	.hero-mv {
		position: absolute;
		inset: 0;
	}
	.hero-in,
	.c-in {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.burst {
		position: absolute;
		left: 50%;
		top: 50%;
		width: var(--bs, 400px);
		height: var(--bs, 400px);
		margin: calc(var(--bs, 400px) / -2) 0 0 calc(var(--bs, 400px) / -2);
		color: var(--acc);
		opacity: 0.5;
	}

	/* ── the plate ── */
	.panel {
		left: 690px;
		top: 0;
		width: 700px;
		height: 0;
	}
	.panel-sw,
	.panel-mv {
		position: absolute;
		left: 0;
		top: 0;
		width: 700px;
		height: 0;
	}
	.safe-probe {
		position: fixed;
		left: 0;
		top: 0;
		width: 0;
		height: 0;
		box-sizing: content-box !important;
		padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
		visibility: hidden;
		pointer-events: none;
	}
	/* the diamond on the plate's top rule, under the chosen tile (portrait phone, tablet) */
	.caret {
		display: block;
		position: absolute;
		left: -6px;
		top: -5px;
		width: 12px;
		height: 12px;
		background: var(--acc);
		border: 1px solid var(--brass-hi);
		box-sizing: border-box;
		transform-origin: 50% 50%;
		z-index: 1;
	}
	/* the touch plaque: three slices of the one picture (27 px ends, the middle stretched), so it can be any width */
	.plaque > i {
		display: block;
		position: absolute;
		top: 0;
		height: 100%;
		background-repeat: no-repeat;
	}
	.plaque:not(.ready) > i {
		visibility: hidden;
	}
	.plaque .pl {
		left: 0;
		width: 27px;
		background-image: var(--plq);
		background-position: 0 0;
		background-size: 242px 48px;
	}
	.plaque .pr {
		right: 0;
		width: 27px;
		background-image: var(--plq);
		background-position: 100% 0;
		background-size: 242px 48px;
	}
	.plaque .pm {
		left: 27px;
		right: 27px;
		overflow: hidden;
	}
	.plaque .pm i {
		position: absolute;
		top: 0;
		height: 100%;
		left: -14.4%;
		width: 128.8%;
		background: var(--plq) 0 0 / 100% 100% no-repeat;
	}
	/* the small 16:9 frames: the menu's own bet controls, the landscape HUD's row in its own master px */
	.hud-copy {
		pointer-events: none;
		transition: opacity var(--back-ms) var(--ease);
	}
	.arm.open .hud-copy {
		pointer-events: auto;
	}
	.arm.confirm .hud-copy {
		opacity: var(--dim);
		pointer-events: none;
		transition: opacity var(--confirm-ms) var(--ease);
	}
	.arm.confirm .hud-copy :global(*) {
		pointer-events: none !important;
	}
	.hc-in {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: 0 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: end;
		box-sizing: border-box;
		padding-bottom: 4px;
	}
	.hc-cell {
		display: flex;
		align-items: flex-end;
	}
	.hc-cell.right {
		justify-content: flex-end;
		gap: 12px;
	}
	.hc-cell.right :global(.slot-btn.chunky) {
		margin-bottom: 2px;
	}
	.hc-slot {
		margin-left: 6px;
	}
	.hc-cell :global(.stat) {
		pointer-events: none !important;
	}
	.plate {
		position: absolute;
		left: 0;
		top: 0;
		width: 700px;
		height: 0;
		pointer-events: none;
	}
	.plate > div {
		position: absolute;
		left: 0;
		width: 700px;
		transform-origin: 0 0;
	}
	.plate-fill {
		top: 0;
		height: 100px;
		background: var(--plate);
		opacity: 0.6;
	}
	.plate-top,
	.plate-bot {
		top: 0;
		height: 2px;
		background: var(--brass-lo);
	}
	/* a new mode's or bet's plate height eases (the open and a layout snap take it at once) */
	.plate-ease .plate,
	.plate-ease .plate > div {
		transition: transform var(--dur) var(--ease);
	}
	.detail {
		position: absolute;
		box-sizing: border-box;
		left: 0;
		width: 700px;
		border-top: 2px solid transparent;
		border-bottom: 2px solid transparent;
	}
	/* the moving wrapper holds the padding, so the volatility row (absolute) keeps the box it always had */
	.detail-mv {
		position: relative;
		padding: 20px 32px 26px;
	}
	.has-odds .detail-mv {
		padding-top: 14px;
		padding-bottom: 16px;
	}
	.kicker {
		font-weight: 700;
		font-size: 16px;
		line-height: 22px;
		letter-spacing: 0.24em;
		color: var(--acc);
	}
	.name {
		font: 700 60px/66px var(--display);
		letter-spacing: 0.03em;
		color: var(--gold);
		white-space: nowrap;
		text-shadow:
			0 -1px 0 var(--shade-90),
			0 1px 0 var(--shine-30),
			0 4px 0 var(--shade-45);
	}
	.desc {
		margin-top: 8px;
		font-weight: 400;
		font-size: 20px;
		line-height: 29px;
		color: var(--cream);
		text-wrap: pretty;
		text-shadow: 0 1px 0 var(--shade-55);
	}
	.desc :global(b),
	.c-what :global(b),
	.c-gets :global(b),
	.status :global(b) {
		color: var(--gold-hi);
	}
	.vol {
		position: absolute;
		right: 32px;
		top: 19px;
		display: flex;
		align-items: center;
		gap: 16px;
		height: 24px;
	}
	.has-odds .vol {
		top: 13px;
	}
	.vol-l {
		font-weight: 600;
		font-size: 16px;
		letter-spacing: 0.2em;
		color: var(--cream-2);
	}
	.pips {
		display: flex;
		gap: 12px;
		padding-left: 4px;
	}
	.pips i {
		width: 13px;
		height: 13px;
		transform: rotate(45deg);
		border: 2px solid var(--brass-dark);
		background: var(--iron-lo);
		box-sizing: border-box;
	}
	.pips i.on {
		background: var(--acc);
		border-color: var(--brass-hi);
	}
	.odds {
		margin-top: 12px;
		display: grid;
		gap: 4px;
	}
	.orow {
		display: grid;
		grid-template-columns: 58px 190px 1fr;
		align-items: center;
		gap: 12px;
		height: 26px;
		font-size: 17px;
	}
	.opct {
		font: 700 20px/1 var(--display);
		color: var(--gold);
		text-align: right;
	}
	.obar {
		height: 12px;
		background: var(--iron-deep);
		border: 1px solid var(--brass-dark);
		box-sizing: border-box;
	}
	.obar i {
		display: block;
		height: 100%;
	}
	.oname {
		color: var(--cream);
	}
	.status {
		margin-top: 14px;
		font-size: 17px;
		line-height: 25px;
		color: var(--cream);
	}
	.on-tag {
		display: inline-block;
		font-weight: 800;
		font-size: 14px;
		line-height: 1;
		letter-spacing: 0.14em;
		padding: 5px 8px 5px 10px;
		background: var(--acc);
		color: var(--ink);
		margin-right: 10px;
		vertical-align: 2px;
	}
	.buy {
		margin-top: 18px;
		display: grid;
		grid-template-columns: 330px auto;
		grid-template-areas: 'plaque btn' 'per why';
		column-gap: 22px;
		row-gap: 8px;
		align-items: center;
		justify-content: start;
	}
	.has-odds .buy {
		margin-top: 12px;
	}
	.per {
		grid-area: per;
		text-align: center;
		font-weight: 600;
		font-size: 16px;
		line-height: 20px;
		letter-spacing: 0.24em;
		color: var(--cream-2);
	}
	.why {
		grid-area: why;
		font-size: 16px;
		line-height: 20px;
		font-weight: 500;
		color: var(--warn);
		white-space: nowrap;
	}
	.plaque {
		grid-area: plaque;
		width: 330px;
		height: 66px;
		background: 0 0 / 100% 100% no-repeat;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	/* the plaque's picture shows when it is decoded; its price never waits for it */
	.plaque:not(.ready) {
		background-image: none !important;
	}
	.fig {
		font: 700 38px/1 var(--display);
		color: var(--fig);
		letter-spacing: 0.02em;
		text-shadow:
			0 -1px 0 var(--shade-90),
			0 1px 0 var(--shine-30);
		padding-top: 3px;
		white-space: nowrap;
		unicode-bidi: isolate;
	}
	.btn {
		display: block;
		height: 64px;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
	}
	.btn > .face {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		height: 100%;
		padding: 0 34px;
		border: 1px solid var(--btn-line);
		border-radius: 3px;
		color: var(--ink);
		font: 700 24px/1 var(--display);
		letter-spacing: 0.16em;
		text-shadow: 0 1px 0 var(--shine-45);
		white-space: nowrap;
		background: linear-gradient(180deg, var(--btn-1) 0%, var(--btn-2) 46%, var(--btn-3) 54%, var(--btn-4) 100%);
		box-shadow:
			inset 0 1px 0 var(--btn-shine),
			inset 0 -4px 0 var(--btn-lip),
			inset 0 0 0 2px var(--shine-30),
			0 5px 0 var(--shade-45);
	}
	.buy .btn {
		grid-area: btn;
		min-width: 250px;
	}
	.btn.off > .face {
		background: linear-gradient(180deg, var(--iron-hi), var(--iron-lo));
		color: var(--gold);
		text-shadow: 0 -1px 0 var(--black);
		border: 2px solid var(--brass-lo);
		box-shadow:
			inset 0 0 0 2px var(--iron-deep),
			0 5px 0 var(--shade-45);
	}
	.btn:disabled > .face {
		background: linear-gradient(180deg, var(--dis-1), var(--dis-2));
		color: var(--dis-text);
		text-shadow: none;
		border-color: var(--dis-line);
		box-shadow:
			inset 0 -4px 0 var(--dis-line),
			0 5px 0 var(--shade-30);
	}

	/* ── tray ── */
	.tray-box {
		left: 0;
		top: 500px;
		width: 1440px;
		height: 232px;
	}
	.tray {
		position: absolute;
		inset: 0;
		box-sizing: border-box;
		padding: 14px 60px 0;
		display: flex;
		gap: 44px;
		background: linear-gradient(180deg, var(--tray-hi), var(--tray-lo));
		border-top: 2px solid var(--brass-lo);
		border-bottom: 2px solid var(--brass-deep);
		box-shadow:
			inset 0 3px 0 var(--iron-deep),
			inset 0 4px 0 var(--shine-30);
	}
	.grp-spin {
		flex: 2;
	}
	.grp-buy {
		flex: 4;
	}
	.gh {
		display: flex;
		align-items: baseline;
		gap: 14px;
		height: 28px;
	}
	.gh b {
		font: 700 18px/1 var(--display);
		letter-spacing: 0.24em;
		color: var(--brass);
	}
	.gh span {
		font-size: 16px;
		color: var(--muted);
	}
	.tiles {
		display: flex;
		gap: 14px;
		margin-top: 8px;
	}
	/* a tile: a still button (its hit box never moves), a moving wrapper (the open), the face (the confirm's sink) */
	.tile {
		position: relative;
		flex: 1;
		min-width: 0;
		height: 160px;
		display: block;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		appearance: none;
		-webkit-appearance: none;
		border-radius: 0;
	}
	.tmv {
		display: block;
		width: 100%;
		height: 100%;
	}
	.tf {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 9px;
		padding: 0 0 6px;
		box-sizing: border-box;
		background: linear-gradient(180deg, var(--iron-hi) 0%, var(--iron-lo) 100%);
		border: 2px solid var(--brass-lo);
		box-shadow:
			inset 0 0 0 2px var(--iron-deep),
			inset 0 0 0 3px var(--shine-30),
			0 0 0 1px var(--edge),
			0 6px 0 var(--shade-30);
	}
	.thumb {
		position: relative;
		--bs: 96px;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 74px;
		width: 100%;
	}
	.thumb .burst {
		color: var(--m);
	}
	.tpic {
		position: relative;
		display: block;
		height: 74px;
		width: 74px;
		flex: none;
		background-size: 600% 100%;
		background-repeat: no-repeat;
	}
	.tn {
		font: 700 22px/1 var(--display);
		letter-spacing: 0.05em;
		color: var(--gold);
		white-space: nowrap;
		text-shadow: 0 -1px 0 var(--shade-90);
	}
	.tp {
		font-weight: 600;
		font-size: 18px;
		line-height: 1;
		color: var(--cream);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.tp small {
		font-size: 16px;
		font-weight: 400;
		color: var(--cream-2);
	}
	/* focus is brightness only: a flat dark veil whose opacity changes; nothing moves */
	.tf::after {
		content: '';
		position: absolute;
		inset: -2px;
		background: var(--veil);
		opacity: 0.4;
		transition: opacity var(--veil-ms) linear;
		pointer-events: none;
	}
	.tile.sel .tf::after {
		opacity: 0 !important;
	}
	.tile.sel .tf {
		border-color: var(--brass-hi);
		box-shadow:
			inset 0 0 0 2px var(--iron-deep),
			inset 0 0 0 3px var(--shine-45),
			inset 0 -6px 0 var(--m),
			0 0 0 1px var(--edge),
			0 6px 0 var(--shade-30);
	}
	.tile .on-tag {
		position: absolute;
		top: 8px;
		right: 8px;
		margin: 0;
		z-index: 1;
		background: var(--m);
	}

	/* ── a swap: the old hero and text fade out (120 ms linear), the new come back on the ease ── */
	.hero-fade,
	.detail {
		transition: opacity var(--back-ms) var(--ease);
	}
	.arm.swap-out .hero-fade,
	.arm.swap-out .detail {
		opacity: 0;
		transition: opacity var(--out-ms) linear;
	}

	/* ── confirm: the tray, the hero, the plate and the name step back, the tiles not chosen sink; the card rises from
	   lower and smaller on the large ease; cancel drops it back fast and the rest returns over 330 ms ── */
	.hdr,
	.hero,
	.panel,
	.tray-box {
		transition: opacity var(--back-ms) var(--ease);
	}
	.arm.confirm .hdr,
	.arm.confirm .hero,
	.arm.confirm .panel,
	.arm.confirm .tray-box {
		opacity: 0;
		transition: opacity var(--confirm-ms) var(--ease);
		pointer-events: none;
	}
	.tf {
		transition: transform var(--back-ms) var(--ease);
	}
	.arm.confirm .tile:not(.sel) .tf {
		transform: translateY(var(--sink));
		transition: transform var(--confirm-ms) var(--ease);
	}
	.card {
		left: 470px;
		top: 28px;
		width: 500px;
		height: 750px;
		pointer-events: none;
	}
	.arm.confirm .card {
		pointer-events: auto;
	}
	.card-mv {
		position: absolute;
		inset: 0;
		background: 0 0 / 100% 100% no-repeat;
	}
	.card-mv:not(.ready) {
		background-image: none !important;
	}
	/* the card and its buttons' faces move as one (the faces turn about the card's centre: faceOrigin) */
	.card-mv,
	.cf {
		opacity: 0;
		transform: translateY(var(--card-y)) scale(var(--card-s));
		transition:
			opacity var(--card-out-ms) linear,
			transform var(--card-out-ms) linear;
	}
	.arm.confirm .card-mv,
	.arm.confirm .cf {
		opacity: 1;
		transform: none;
		transition:
			opacity var(--dur-l) var(--ease) var(--card-delay),
			transform var(--dur-l) var(--ease) var(--card-delay);
	}
	.c-art {
		position: absolute;
		left: 56px;
		top: 66px;
		width: 388px;
		height: 176px;
		--bs: 250px;
	}
	.c-art :global(.c-pic) {
		width: 138px;
		height: 138px;
	}
	.c-body {
		position: absolute;
		left: 76px;
		right: 76px;
		top: 266px;
		bottom: 84px;
		display: flex;
		flex-direction: column;
		text-align: center;
		gap: 6px;
	}
	/* the two buttons: still boxes at the foot of the card body */
	.c-keys {
		position: absolute;
		left: 76px;
		right: 76px;
		bottom: 84px;
		display: flex;
		flex-direction: column;
		text-align: center;
		gap: 6px;
	}
	.c-body .name {
		font-size: 46px;
		line-height: 50px;
	}
	.c-gets {
		font-size: 16px;
		line-height: 21px;
		font-weight: 500;
		color: var(--cream);
		text-wrap: balance;
	}
	.crows {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0;
	}
	.crow {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		height: 28px;
		font-size: 17px;
		color: var(--cream-2);
		border-bottom: 1px solid var(--rule);
	}
	.crow span {
		letter-spacing: 0.18em;
		font-weight: 600;
		font-size: 16px;
		white-space: nowrap;
	}
	.crow b {
		font-weight: 600;
		color: var(--cream);
		font-size: 18px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		unicode-bidi: isolate;
	}
	.crow.total {
		height: 42px;
		border-bottom: 0;
		align-items: center;
	}
	.crow.total span {
		color: var(--brass-hi);
	}
	.crow.total b {
		font-family: var(--display);
		font-weight: 700;
		line-height: 1;
		color: var(--fig);
		text-shadow:
			0 -1px 0 var(--black),
			0 1px 0 var(--shine-30);
	}
	.c-what {
		font-size: 16px;
		line-height: 22px;
		color: var(--cream-2);
		text-wrap: pretty;
	}
	/* CONFIRM is not live before the guard (350 ms), then appears in 80 ms */
	.c-confirm {
		flex: none;
		height: 60px;
		opacity: 0;
		visibility: hidden;
		transition:
			opacity var(--guard-fade-ms) linear,
			visibility 0s,
			translate 60ms linear;
	}
	.arm.confirm .c-confirm {
		opacity: 1;
		visibility: visible;
		transition:
			opacity var(--guard-fade-ms) linear var(--guard-ms),
			visibility 0s linear var(--guard-ms),
			translate 60ms linear;
	}
	.cancel {
		margin: 2px auto 0;
		padding: 2px 10px;
		border: 0;
		background: none;
		font-family: var(--ui);
		font-size: 18px;
		font-weight: 500;
		color: var(--cream);
		text-decoration: underline;
		text-underline-offset: 4px;
		opacity: 0.85;
		transition:
			opacity 100ms linear,
			translate 60ms linear;
	}
	.cancel .face {
		display: block;
	}
	.c-flash {
		position: absolute;
		inset: 4px;
		border: 3px solid var(--brass-hi);
		opacity: 0;
		pointer-events: none;
	}
	.c-flash.on {
		opacity: 1;
	}

	/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
	   THE TOUCH LAYOUTS (part C; the prototype's page.css 276-482, sizes and positions only: every colour, gradient,
	   border and face above is unchanged). One flex column in the frame between the measured edges (--ct: the first
	   content line under the clock strip; --cbot: from the bottom up to 6 above the HUD's BALANCE / bet row).
	   PORTRAIT PHONE P1b: the hero (the piece that gives; the swipe surface), the tray, the buy plate lowest.
	   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
	.arm.touch {
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		padding: var(--ct) var(--cx) var(--cbot);
	}
	.arm.touch > .hero,
	.arm.touch > .panel,
	.arm.touch > .tray-box {
		position: relative;
		left: auto;
		top: auto;
		right: auto;
		width: auto;
		height: auto;
		flex: none;
	}
	/* header: the menu's name, small, centred in the band above the clock strip (or under it); top from the anchors */
	.arm.touch .hdr {
		justify-content: center;
		gap: 7px;
		font-size: 12px;
		letter-spacing: 0.3em;
		height: 18px;
	}
	.arm.touch .hdr-crest {
		width: 20px;
		height: 18px;
	}
	.arm.touch .close {
		width: 44px;
		height: 44px;
		border-radius: 10px;
		z-index: 3;
	}
	.arm.touch .close svg {
		width: 20px;
		height: 20px;
	}
	/* the card would sit on it: Cancel is the way back (portrait phone, tablet) */
	.arm.confirm.lay-portrait .close,
	.arm.confirm.lay-tablet .close {
		opacity: 0;
		pointer-events: none;
	}
	/* touch hit boxes: at least 44 CSS px (--hit is that in design px), grown by a clear ::after, nothing moves */
	.arm.touch .close::after,
	.arm.touch .cta::after,
	.arm.touch .c-confirm::after,
	.arm.touch .cancel::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: max(100%, var(--hit));
		height: max(100%, var(--hit));
		transform: translate(-50%, -50%);
	}
	/* hero: what is left; dropped when that is under its minimum (.nohero) */
	.arm.touch > .hero {
		order: 0;
		flex: 1 1 0;
		min-height: 0;
		margin-bottom: 6px;
	}
	.arm.nohero > .hero {
		display: none;
	}
	.arm.touch :global(.hv-shadow) {
		bottom: 0;
		height: 8%;
		left: 30%;
		right: 30%;
	}
	.arm.open.swipe:not(.confirm) > .hero,
	.arm.open.swipe:not(.confirm) > .panel {
		pointer-events: auto;
		touch-action: pan-y;
	}
	@media (hover: hover) and (pointer: fine) {
		.arm.open.swipe:not(.confirm) > .hero {
			cursor: grab;
		}
	}
	/* the tray: PER SPIN as two wide tiles, FEATURE BUYS as four small ones, directly above the plate */
	.arm.touch > .tray-box {
		order: 1;
	}
	.arm.nohero.swipe > .tray-box {
		margin-top: auto;
	}
	.arm.touch .tray {
		position: relative;
		inset: auto;
		padding: 6px 12px 9px;
		gap: 6px;
		flex-direction: column;
	}
	.arm.touch .grp {
		flex: none;
	}
	.arm.touch .gh {
		height: 16px;
		gap: 8px;
	}
	.arm.touch .gh b {
		font-size: 12px;
		letter-spacing: 0.2em;
	}
	.arm.touch .gh span {
		font-size: 12px;
	}
	.arm.touch .tiles {
		gap: 6px;
		margin-top: 4px;
	}
	.arm.touch .tf {
		gap: 2px;
		padding: 0 0 4px;
		box-shadow:
			inset 0 0 0 2px var(--iron-deep),
			inset 0 0 0 3px var(--shine-30),
			0 0 0 1px var(--edge),
			0 3px 0 var(--shade-30);
	}
	.arm.touch .tile.sel .tf {
		box-shadow:
			inset 0 0 0 2px var(--iron-deep),
			inset 0 0 0 3px var(--shine-45),
			inset 0 -5px 0 var(--m),
			0 0 0 1px var(--edge),
			0 3px 0 var(--shade-30);
	}
	.arm.touch .tn {
		font-size: 14px;
		letter-spacing: 0.02em;
	}
	.arm.touch .tp {
		font-size: 14px;
	}
	.arm.touch .tp small {
		font-size: 12px;
	}
	.arm.touch .tile .on-tag {
		top: 5px;
		right: 5px;
		font-size: 10px;
		padding: 2px 4px 2px 5px;
	}
	.arm.touch .tpic {
		height: 100%;
		width: auto;
		aspect-ratio: 1;
	}
	.arm.lay-portrait .grp-spin .tile {
		height: 54px;
	}
	.arm.lay-portrait .grp-spin .tf {
		display: grid;
		grid-template-columns: 46px auto;
		grid-template-rows: auto auto;
		column-gap: 9px;
		row-gap: 3px;
		align-content: center;
		justify-content: center;
		justify-items: start;
		padding: 0 6px 3px;
	}
	.arm.lay-portrait .grp-spin .thumb {
		grid-row: 1 / 3;
		align-self: center;
		height: 42px;
		--bs: 56px;
	}
	.arm.lay-portrait .grp-spin .tn {
		font-size: 15px;
	}
	.arm.lay-portrait .grp-buy .tile {
		height: 76px;
	}
	.arm.lay-portrait .grp-buy .thumb {
		height: 33px;
		--bs: 46px;
	}
	.arm.lay-portrait .grp-buy .tn {
		font-size: 13px;
	}
	/* the buy plate: lowest, right over the bet row; its height from its content; its top rule in the mode's colour */
	.arm.touch > .panel {
		order: 2;
		margin: 9px 8px 0;
	}
	.arm.touch .panel-sw,
	.arm.touch .panel-mv {
		position: relative;
		width: auto;
		height: auto;
	}
	.arm.touch .plate {
		position: absolute;
		inset: 0;
		width: auto;
		height: auto;
	}
	.arm.touch .plate > div {
		left: 0;
		width: 100%;
	}
	.arm.touch .plate-fill {
		top: 0;
		height: 100%;
		transform-origin: 0 100%;
	}
	.arm.touch .plate-bot {
		top: auto;
		bottom: 0;
	}
	.arm.touch .plate-top {
		background: var(--acc);
	}
	.arm.touch .detail {
		position: relative;
		left: auto;
		top: auto;
		width: auto;
	}
	.arm.touch .detail-mv,
	.arm.touch.has-odds .detail-mv {
		padding: 8px 14px 9px;
	}
	.arm.touch .kicker {
		font-size: 12px;
		line-height: 16px;
		letter-spacing: 0.22em;
	}
	.arm.touch .name {
		font-size: 34px;
		line-height: 37px;
		text-shadow:
			0 -1px 0 var(--shade-90),
			0 1px 0 var(--shine-30),
			0 3px 0 var(--shade-45);
	}
	.arm.touch .desc {
		margin-top: 3px;
		font-size: 14px;
		line-height: 20px;
	}
	.arm.touch .vol,
	.arm.touch.has-odds .vol {
		right: 14px;
		top: 10px;
		gap: 8px;
		height: 16px;
	}
	.arm.touch .vol-l {
		font-size: 11px;
		letter-spacing: 0.18em;
	}
	.arm.touch .pips {
		gap: 7px;
		padding-left: 2px;
	}
	.arm.touch .pips i {
		width: 9px;
		height: 9px;
		border-width: 1.5px;
	}
	.arm.touch .odds {
		margin-top: 6px;
		gap: 2px;
	}
	.arm.touch .orow {
		grid-template-columns: 40px 104px 1fr;
		gap: 9px;
		height: 21px;
		font-size: 14px;
	}
	.arm.touch .opct {
		font-size: 16px;
	}
	.arm.touch .obar {
		height: 9px;
	}
	.arm.touch .status {
		margin-top: 6px;
		font-size: 14px;
		line-height: 20px;
	}
	.arm.touch .on-tag {
		font-size: 11px;
		padding: 3px 6px 3px 7px;
		margin-right: 7px;
		vertical-align: 1px;
	}
	.arm.touch .buy,
	.arm.touch.has-odds .buy {
		margin-top: 10px;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		column-gap: 10px;
		row-gap: 3px;
		justify-content: stretch;
	}
	/* a price still too long at its floor takes the whole row; the button goes under it (spec 6.4) */
	.arm.touch .buy.stack {
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: 'plaque' 'per' 'btn' 'why';
	}
	.arm.touch .per {
		font-size: 11px;
		line-height: 14px;
		letter-spacing: 0.22em;
	}
	.arm.touch .why {
		font-size: 12px;
		line-height: 14px;
		white-space: normal;
	}
	.arm.touch .plaque {
		position: relative;
		width: auto;
		height: 48px;
		background: none;
	}
	.arm.touch .fig {
		position: relative;
		font-size: 24px;
		padding-top: 2px;
	}
	.arm.touch .btn {
		height: 48px;
	}
	.arm.touch .btn > .face {
		padding: 0 8px;
		font-size: 17px;
		letter-spacing: 0.14em;
		box-shadow:
			inset 0 1px 0 var(--btn-shine),
			inset 0 -3px 0 var(--btn-lip),
			inset 0 0 0 2px var(--shine-30),
			0 4px 0 var(--shade-45);
	}
	.arm.touch .btn.off > .face {
		font-size: 16px;
		box-shadow:
			inset 0 0 0 2px var(--iron-deep),
			0 4px 0 var(--shade-45);
	}
	.arm.touch .btn:disabled > .face {
		box-shadow:
			inset 0 -3px 0 var(--dis-line),
			0 4px 0 var(--shade-30);
	}
	.arm.touch .buy .btn {
		min-width: 0;
	}
	/* confirm: the intro card's own frame at 366 x 549 (its 2:3 kept), centred; place and scale from cardStyle */
	.arm.touch .c-art {
		left: 40px;
		top: 48px;
		width: 286px;
		height: 126px;
		--bs: 178px;
		overflow: hidden;
	}
	.arm.touch .c-art :global(.c-pic) {
		width: 100px;
		height: 100px;
	}
	.arm.touch .c-body {
		left: 52px;
		right: 52px;
		top: 196px;
		bottom: 62px;
		gap: 5px;
	}
	.arm.touch .c-keys {
		left: 52px;
		right: 52px;
		bottom: 62px;
		gap: 5px;
	}
	.arm.touch .c-body .name {
		font-size: 30px;
		line-height: 33px;
	}
	.arm.touch .crow {
		height: 25px;
		font-size: 14px;
	}
	.arm.touch .crow span {
		font-size: 12px;
		letter-spacing: 0.16em;
	}
	.arm.touch .crow.total {
		height: 38px;
	}
	.arm.touch .c-what {
		font-size: 14px;
		line-height: 19px;
	}
	/* Cancel: 16 px text in a 44 px tall hit box that reaches down into the frame's foot */
	.arm.touch .cancel {
		position: relative;
		margin: 0 auto -12px;
		padding: 12px 28px;
		font-size: 16px;
		line-height: 20px;
	}

	/* ── TABLET PORTRAIT (page.css 399-420): the phone's pieces; the tray one row (PER SPIN 190 wide), all six tiles 76
	   high with the picture on top, the group sub lines dropped; the name under the clock strip; content capped at 720 ── */
	.arm.lay-tablet .tray {
		flex-direction: row;
		gap: 14px;
	}
	.arm.lay-tablet .grp-spin {
		flex: 0 0 190px;
	}
	.arm.lay-tablet .grp-buy {
		flex: 1 1 0;
		min-width: 0;
	}
	.arm.lay-tablet .gh span,
	.arm.lay-sideways .gh span {
		display: none;
	}
	.arm.lay-tablet .tile,
	.arm.lay-sideways .tile {
		height: 76px;
	}
	.arm.lay-tablet .thumb {
		height: 33px;
		--bs: 46px;
	}
	.arm.lay-tablet .tn {
		font-size: 12px;
	}

	/* ── PHONE SIDEWAYS (page.css 427-482): three columns. The HUD's own lit column on the left; hero over the plate in
	   the middle (from 8 right of the HUD column, never under 180); the tray a rail 324 wide on the right ── */
	.arm.lay-sideways {
		padding: var(--side-top) var(--side-r) var(--cbot) var(--ml);
	}
	.arm.lay-sideways .hdr {
		justify-content: flex-start;
		gap: 0;
		letter-spacing: 0.1em;
	}
	.arm.lay-sideways .hdr-crest {
		display: none;
	}
	.arm.lay-sideways > .panel {
		margin: 0;
	}
	.arm.lay-sideways.nohero > .panel {
		margin-top: auto;
	}
	.arm.lay-sideways .detail-mv,
	.arm.lay-sideways.has-odds .detail-mv {
		padding: 7px 14px 8px;
	}
	.arm.lay-sideways .name {
		font-size: 28px;
		line-height: 31px;
	}
	.arm.lay-sideways .buy,
	.arm.lay-sideways.has-odds .buy {
		margin-top: 8px;
	}
	.arm.lay-sideways .plaque {
		height: 44px;
	}
	.arm.lay-sideways .plaque .pl,
	.arm.lay-sideways .plaque .pr {
		width: 25px;
		background-size: 222px 44px;
	}
	.arm.lay-sideways .plaque .pm {
		left: 25px;
		right: 25px;
	}
	.arm.lay-sideways .fig {
		font-size: 22px;
	}
	.arm.lay-sideways .btn {
		height: 44px;
	}
	.arm.lay-sideways .btn > .face {
		font-size: 16px;
	}
	/* the rail: the six modes two wide, PER SPIN on top; the close in its top right corner, level with PER SPIN */
	.arm.lay-sideways > .tray-box {
		position: absolute;
		left: auto;
		right: 0;
		top: 0;
		width: var(--rail);
		height: 100%;
	}
	.arm.lay-sideways .tray {
		position: absolute;
		inset: 0;
		margin: 0;
		padding: var(--side-top) var(--side-edge) var(--cbot) 12px;
		flex-direction: column;
		gap: 6px;
		border-top: 0;
		border-bottom: 0;
		border-left: 2px solid var(--brass-lo);
		box-shadow:
			inset 3px 0 0 var(--iron-deep),
			inset 4px 0 0 var(--shine-30);
	}
	.arm.lay-sideways .grp-spin .gh {
		height: 44px;
		align-items: center;
	}
	.arm.lay-sideways .grp-buy .tiles {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	}
	.arm.lay-sideways .tile {
		height: 86px;
	}
	.arm.lay-sideways .tf {
		gap: 3px;
	}
	.arm.lay-sideways .thumb {
		height: 40px;
		--bs: 54px;
	}
	.arm.lay-sideways .tn {
		font-size: 15px;
	}
	/* confirm: the intro card's upright frame cannot hold 14 px copy at this height, so the card is the tray's own slab */
	.arm.lay-sideways .card {
		height: auto;
	}
	.arm.lay-sideways .card-mv {
		position: relative;
		inset: auto;
		/* room for CONFIRM (6 over it, 44) and Cancel (5 over it, 44) and the 2 under: 101 */
		padding-bottom: 101px;
		background: linear-gradient(180deg, var(--tray-hi), var(--tray-lo));
		border-top: 2px solid var(--brass-lo);
		border-bottom: 2px solid var(--brass-lo);
		box-shadow:
			inset 0 3px 0 var(--iron-deep),
			inset 0 4px 0 var(--shine-30),
			0 6px 0 var(--shade-30);
	}
	.arm.lay-sideways .c-art {
		display: none;
	}
	.arm.lay-sideways .c-body {
		position: static;
		padding: 12px 28px 2px;
		gap: 5px;
	}
	.arm.lay-sideways .c-body .name {
		font-size: 28px;
		line-height: 31px;
	}
	.arm.lay-sideways .c-keys {
		left: 28px;
		right: 28px;
		bottom: 4px;
	}
	.arm.lay-sideways .c-confirm {
		height: 44px;
	}
	.arm.lay-sideways .cancel {
		margin: 0 auto;
	}
	.arm.lay-sideways .c-flash {
		inset: -3px;
	}

	/* reduced motion: every duration and delay is 0 (not 1 ms: spec 5.5) */
	.arm.reduced,
	.arm.reduced :global(*),
	.arm.reduced :global(*::before),
	.arm.reduced :global(*::after) {
		transition-duration: 0s !important;
		transition-delay: 0s !important;
		animation: none !important;
	}
</style>
