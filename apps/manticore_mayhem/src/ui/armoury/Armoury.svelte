<script lang="ts">
	// THE ARMOURY: the feature menu (spec ~/Desktop/Manticore Mayhem/feedback/armoury_build_r1/SPEC.md; the approved
	// prototype images/feature_menu_r2/, page.css and page.js). Spec commit 4: the DESKTOP layout; commit 5: its MOTION
	// (spec 5: the staggered open, the swap, activate to confirm, cancel, close, reduced motion, every interruption of
	// 5.6); commit 6: THE HERO (HeroView.svelte: follow, tilt, the angle grids and their load queue, breathing, the idle
	// turn) and the warm pass, with the desktop keyboard, focus trap, `inert` and labels (spec 7.3, 7.4); portrait,
	// tablet, sideways and the small 16:9 frames are commits 7 and 8 (the old menu stays there until then).
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
	import type { MenuFrame } from './menuFrame';
	import { armouryView } from './armouryView.svelte';
	import HeroView from './HeroView.svelte';
	import { fitConfirmAmount, fitPrice } from './fit';
	import { createMover, entranceEnd, entrancePlan, moveDurations, pickEase, prefersReducedMotion, swapPlan, type Mover, type MoveOptions, type Step } from './motion';
	import { ARMOURY } from '../../game/constants';
	import config from '../../game/config';
	import { modeCost } from '../../game/betModeMeta';
	import { stamp } from '../../game/assets';
	import { PHONE_TIER } from '../../game/deviceTier';
	import { INTRO_CARD_ASSETS } from '../../game/introCards';
	import { ARMOURY_ART_ORDER, ARMOURY_ASSETS, ARMOURY_MODES, armouryMode, type ArmouryMode, type ArmouryModeId } from '../../game/armouryData';
	import { ARMOURY_TEXT as TX, afterTag, anteConfirm, armouryName, boldRuns, fill } from '../../game/armouryText';
	import { armouryDecoded, whenArmouryCore, heroGridReady, heroGridsInfo, loadArmouryCore, onHeroGrids, pauseHeroGrids, selectHeroGrid, startHeroGrids } from '../../game/armouryLoad';

	type Props = { controls: Controls; frame: MenuFrame; takes: boolean };
	const { controls, frame, takes }: Props = $props();

	const M = ARMOURY.motion;
	const reduced = prefersReducedMotion();
	armouryView.reduced = reduced;
	const ease = pickEase(M);
	const durs = moveDurations(M, reduced);
	/** a CSS duration or delay: 0 under reduced motion (not 1 ms, spec 5.5) */
	const cssMs = (n: number) => `${reduced ? 0 : n}ms`;

	// ---- open / close ----------------------------------------------------------------------------------------------
	const wantOpen = $derived(takes && stateModal.modal?.name === 'buyBonus');
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
	const mv = { tiles: createMover(reduced), hero: createMover(reduced), plate: createMover(reduced), head: createMover(reduced) };
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
		if (!coreIn || !takes || warmed || phase !== 'closed' || stateModal.modal != null || !controls.isIdle() || document.hidden) return;
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
		for (const s of entrancePlan(M, { tiles: order.length, touch: false, reduced })) {
			if (s.piece === 'tile') mv.tiles.move(tileMv[order[s.index ?? 0].id], opts(s));
			else if (s.piece === 'hero') mv.hero.move(heroMv, opts(s));
			else if (s.piece === 'plate') {
				mv.plate.move(panelMv, opts(s));
				pinCta(mv.plate, s);
			} else if (s.piece === 'head') mv.plate.move(dHeadEl, opts(s));
			else if (s.piece === 'vol') mv.plate.move(volEl, opts(s));
			else if (s.piece === 'body') mv.plate.move(dBodyEl, opts(s));
			else if (s.piece === 'buy') mv.plate.move(buyEl, opts(s));
			else mv.head.move(s.piece === 'tray' ? trayEl : s.piece === 'header' ? hdrInEl : closeEl, opts(s));
		}
	};
	/** a swap's way in: the new hero rises, the new text rises a beat later. `from`: the plate's own entrance was cut
	 *  part way (a tile tapped during the open), so the whole plate carries on from where it was instead */
	const swapIn = (from: { y: number; o: number } | null) => {
		const plan = swapPlan(M, { touch: false, reduced });
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
		view = sel;
		swapOut = false;
		if (!animate) return;
		const seq = openSeq;
		tick().then(() => {
			if (phase === 'open' && !confirm && seq === openSeq && view === sel) swapIn(from);
		});
	};
	/** a layout change while moving (rotation, resize): every animation stops, everything lands in the new layout */
	const snapAll = () => {
		stopMotion();
		if (swapTimer) land(false);
		plateEase = false;
		snapping = true;
		armouryView.snap += 1;
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				snapping = false;
				plateEase = phase === 'open';
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
		const seq = openSeq;
		tick().then(() => {
			if (phase !== 'open' || seq !== openSeq) return;
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
		stopMotion();
		const a = document.activeElement;
		const hadFocus = (!!rootEl && rootEl.contains(a)) || a === document.body || a == null || hudSteppers().includes(a as HTMLButtonElement);
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
			frameKey = k;
		});
	});
	onMount(() => () => {
		clearTimeout(closeTimer);
		clearTimeout(swapTimer);
		clearTimeout(gridTimer);
		stopMotion();
		armouryView.shown = armouryView.open = armouryView.confirm = armouryView.closing = false;
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
	/** the HUD's two bet steppers, lit above the tint and live: the minus and the plus (never the bet readout, which
	 *  would open the bet picker in the menu's place) */
	const hudSteppers = (): HTMLButtonElement[] => {
		const cell = document.querySelector(`${HUD_FIT} .trio > .cell.right`);
		return cell ? [...cell.querySelectorAll<HTMLButtonElement>('button')].filter((b) => !b.closest('.spin-slot')) : [];
	};
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
		const keep: Element[] = how === 'open' ? [...hudSteppers(), ...document.querySelectorAll(`${HUD_FIT} .trio > .cell.left`)] : [];
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
	const pitchAmt = $derived(money(config.epicMinWin * stateBet.betAmount));
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
	const priceFit = $derived.by(() => {
		void fontTick;
		return fitPrice({ text: priceText, nominal: 38, plaqueW: 330, rowW: 0, touch: false, rules: ARMOURY.fit.price, face: { ...DISPLAY, letterSpacing: 0.02 } });
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
			const fit = fitConfirmAmount({ text: r.value, nominal: r.total ? 34 : 18, rowW, labelW: labelW[i], total: r.total, touch: false, rules: ARMOURY.fit.confirm, face });
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

	/** every animation now running on the menu, its tint or the lit HUD cells (spec 5.6: zero after any interruption).
	 *  The hero's breathing is the one deliberate endless motion (spec 5.4) and is not counted */
	const running = () => {
		try {
			return document.getAnimations().filter((a) => {
				const t = (a.effect as KeyframeEffect | null)?.target;
				return a.playState !== 'finished' && a.playState !== 'idle' && t instanceof Element && !!t.closest('.arm, .armoury-tint, .trio > .cell') && !t.classList.contains('hero-breathe');
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
				takes,
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
				balance: stateBet.balanceAmount,
				bet: stateBet.betAmount,
				mode: stateBet.activeBetModeKey,
			}),
			/** the HUD button's own function with no check in front of it (a probe proves its guards) */
			pressHud: () => controls.bonusPress(),
			open: () => {
				if (!takes || controls.bonusDisabled()) return false;
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
				const steps = entrancePlan(M, { tiles: ARMOURY_MODES.length, touch: false, reduced });
				return { entrance: steps, end: entranceEnd(steps), swap: swapPlan(M, { touch: false, reduced }), ease };
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
			class="arm"
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

			<div class="hdr" inert={confirm}>
				<span class="hdr-in" bind:this={hdrInEl}>
					<i class="hdr-crest pic" class:ready={pics[PIC.crest] != null} style:background-image={url(PIC.crest)} aria-hidden="true"></i>
					<span id="arm-name">{TX.name}</span>
				</span>
			</div>
			<button type="button" class="close lift" aria-label={TX.close} bind:this={closeEl} onclick={() => close()}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>
			</button>

			<!-- the hero (HeroView.svelte): flat art, then its angle grid once decoded; rays and a ground shadow. Still box
			     (the confirm's fade), the swap's fade out, then the moving wrapper (the open's rise, a swap's rise) -->
			<div class="hero" aria-hidden="true">
				<div class="hero-fade" ontransitionend={onFadeEnd}>
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
								active={phase === 'open' && !confirm && !warm}
								{calm}
								frame={{ left: frame.left, top: frame.top, u: frame.u }}
								{reduced}
								rules={ARMOURY.hero}
								raysId="arm-burst"
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- the buy plate: one fill that stretches and two brass rules. Still box (the confirm's fade), the moving
			     plate (the open's rise), the text's fade out and its moving wrapper (a swap's rise) -->
			<div class="panel" inert={confirm}>
				<div class="panel-mv" bind:this={panelMv}>
					<div class="plate" style:transform="translateY({detailTop}px)" aria-hidden="true">
						<div class="plate-fill" style:transform="scaleY({(detailH / 100).toFixed(4)})"></div>
						<div class="plate-top"></div>
						<div class="plate-bot" style:transform="translateY({Math.max(0, detailH - 2)}px)"></div>
					</div>
					<div class="detail" style:top="{detailTop}px" bind:offsetHeight={detailH}>
						<div class="detail-mv" bind:this={detailMv}>
							<div class="d-head" bind:this={dHeadEl}>
								<div class="kicker">{TX.kicker[mode.group]}</div>
								<div class="name">{armouryName(mode.id)}</div>
							</div>
							<div class="d-body" bind:this={dBodyEl}>
								<div class="desc">{@render rich(TX.pitch[mode.id], pitchAmt)}</div>
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
							<div class="buy" bind:this={buyEl}>
								<div class="plaque" class:ready={pics[PIC.plaque] != null} style:background-image={url(PIC.plaque)}>
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

			<!-- the tray: two per spin modes, four buys. Still box (the confirm's fade), the slab (the open's fade) -->
			<div class="tray-box" inert={confirm}>
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

			<!-- the confirm card: the intro cards' own frame, centred; the rest steps back. The card is a still box; its
			     picture and text rise in a moving wrapper; its two buttons stay put while their faces follow the card -->
			<div class="card" role="alertdialog" aria-label={fill(TX.confirmTitle, { name: armouryName(mode.id) })} aria-hidden={!confirm} inert={!confirm} tabindex="-1" bind:this={cardEl}>
				<div class="card-mv" class:ready={pics[cardPic] != null} style:background-image={url(cardPic)}>
					<div class="c-art" aria-hidden="true"><div class="c-in">{@render burst('')}{@render thumb(mode, 'c-pic')}</div></div>
					<div class="c-body">
						<div class="name">{armouryName(mode.id)}</div>
						<div class="c-gets">{@render rich(TX.gets[mode.id], pitchAmt)}</div>
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
	.hdr-crest {
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
	.panel-mv {
		position: absolute;
		left: 0;
		top: 0;
		width: 700px;
		height: 0;
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
