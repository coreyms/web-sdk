<script lang="ts">
	// THE ARMOURY: the feature menu (spec ~/Desktop/Manticore Mayhem/feedback/armoury_build_r1/SPEC.md; the approved
	// prototype images/feature_menu_r2/, page.css and page.js). Spec commit 4: the DESKTOP layout, static. Plain fades
	// only (the staggered entrance, the swap and the confirm card's rise are commit 5); flat hero art with no tilt or
	// follow (commit 6); portrait, tablet, sideways and the small 16:9 frames are commits 7 and 8 (the old menu stays
	// there until then). Mounted only behind the DEV switch (game/armourySwitch.ts, `?armoury=1`).
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
	import { fitConfirmAmount, fitPrice } from './fit';
	import { moveDurations, pickEase, prefersReducedMotion } from './motion';
	import { ARMOURY } from '../../game/constants';
	import config from '../../game/config';
	import { modeCost } from '../../game/betModeMeta';
	import { stamp } from '../../game/assets';
	import { PHONE_TIER } from '../../game/deviceTier';
	import { INTRO_CARD_ASSETS } from '../../game/introCards';
	import { ARMOURY_ART_ORDER, ARMOURY_ASSETS, ARMOURY_MODES, armouryMode, type ArmouryMode, type ArmouryModeId } from '../../game/armouryData';
	import { ARMOURY_TEXT as TX, afterTag, anteConfirm, armouryName, boldRuns, fill } from '../../game/armouryText';
	import { armouryDecoded, loadArmouryCore } from '../../game/armouryLoad';

	type Props = { controls: Controls; frame: MenuFrame; takes: boolean };
	const { controls, frame, takes }: Props = $props();

	const M = ARMOURY.motion;
	const reduced = prefersReducedMotion();
	const ease = pickEase(M);
	const durs = moveDurations(M, reduced);

	// ---- open / close ----------------------------------------------------------------------------------------------
	const wantOpen = $derived(takes && stateModal.modal?.name === 'buyBonus');
	let phase = $state<'closed' | 'open' | 'closing'>('closed');
	/** this menu asked for the close (the X, Escape, CONFIRM): it fades; any other close is at once */
	let byUs = false;
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	let rootEl = $state<HTMLDivElement>();

	let sel = $state<ArmouryModeId>('BONUS');
	let confirm = $state(false);
	let confirmAt = 0;
	let confirming = false;
	let flash = $state(false);
	/** the line after a switch off (SWITCH OFF / UNLOAD): which mode it was */
	let note = $state<ArmouryModeId | null>(null);

	const mode = $derived(armouryMode(sel)!);
	/** the mode that is on (an ante active or a buy loaded on Spin), if it is one of the six */
	const activeId = $derived.by(() => {
		const k = (stateBet.activeBetModeKey ?? '').toUpperCase();
		return armouryMode(k) ? (k as ArmouryModeId) : null;
	});

	const beginOpen = () => {
		if (phase === 'closing') finishClose();
		clearTimeout(closeTimer);
		byUs = false;
		confirming = false;
		flash = false;
		confirm = false;
		note = null;
		if (activeId) sel = activeId; // with a mode on, the menu opens on it
		phase = 'open';
		armouryView.tint = mode.tint;
		armouryView.confirm = false;
		armouryView.closing = false;
		armouryView.open = true;
		armouryView.shown = true;
		loadArmouryCore(); // the deferred group may not have landed yet: it is asked for now (the menu never waits)
		for (const url of allPics()) want(url);
		void loadFonts();
		tick().then(() => tileEls[sel]?.focus({ preventScroll: true }));
	};
	const beginClose = () => {
		phase = 'closing';
		armouryView.open = false;
		armouryView.confirm = false;
		armouryView.closing = true;
		closeTimer = setTimeout(finishClose, reduced ? 0 : M.closeDoneMs);
	};
	const finishClose = () => {
		clearTimeout(closeTimer);
		const hadFocus = !!rootEl && rootEl.contains(document.activeElement);
		phase = 'closed';
		confirm = false;
		flash = false;
		note = null;
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
	onMount(() => () => {
		clearTimeout(closeTimer);
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
		return true;
	};
	const step = (dir: 1 | -1) => {
		const i = ARMOURY_MODES.findIndex((m) => m.id === sel);
		const n = ARMOURY_MODES[Math.max(0, Math.min(ARMOURY_MODES.length - 1, i + dir))];
		const onTile = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('tile');
		select(n.id);
		if (onTile) tileEls[n.id]?.focus({ preventScroll: true });
	};
	const activate = () => {
		if (phase !== 'open' || confirm) return false;
		const id = sel;
		if (activeId === id) {
			// SWITCH OFF / UNLOAD needs no card: it lowers the spend, so it happens at once and says so; the menu stays open
			controls.sound('soundPressMinor');
			controls.cancelArmed(); // also unloads a parked autoplay run, as the HUD button always did
			note = id;
			tick().then(() => ctaEl?.focus({ preventScroll: true }));
			return true;
		}
		const p = price(id);
		if (!(p > 0) || p > stateBet.balanceAmount) return false;
		controls.sound('soundPressMinor');
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
		// the wrong click guard: CONFIRM is not live until it has faded in
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

	// ---- keys (spec 7.3) -------------------------------------------------------------------------------------------
	const onKey = (e: KeyboardEvent) => {
		if (phase !== 'open') return;
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
		const x = modeCost(sel);
		const rows = [
			{ label: TX.confirmRow.base, value: money(stateBet.betAmount), total: false },
			{ label: armouryName(sel), value: fill(TX.confirmRow.multiple, { x }), total: false },
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
		hero: (m: ArmouryMode) => stamp(ARMOURY_ASSETS.hero(m.art, PHONE_TIER)),
	};
	const allPics = () => [PIC.thumbs, PIC.plaque, PIC.crest, PIC.card, ...ARMOURY_MODES.map(PIC.hero)];
	/** url -> its aspect ratio, once decoded */
	const pics = $state<Record<string, number>>({});
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

	let tileEls = $state<Record<string, HTMLButtonElement | undefined>>({});
	let ctaEl = $state<HTMLButtonElement>();
	let cardEl = $state<HTMLDivElement>();

	const tileLabel = (m: ArmouryMode) =>
		fill(TX.aria.tile, { name: armouryName(m.id), kind: TX.aria.kind[m.group], x: modeCost(m.id) }) + (activeId === m.id ? TX.aria.on : '');
	const tileMultiple = (m: ArmouryMode) => {
		const x = modeCost(m.id);
		const full = fill(TX.tileMultiple[m.group], { x });
		const head = `${x}x`;
		return full.startsWith(head) ? { head, tail: full.slice(head.length) } : { head: full, tail: '' };
	};
	const groups = (['spin', 'buy'] as const).map((g) => ({ g, modes: ARMOURY_MODES.filter((m) => m.group === g) }));

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
				confirm,
				active: activeId,
				short,
				price: priceText,
				priceFit,
				confirmRows: confirmRows.map((r) => ({ label: r.label, value: r.value, size: r.size, fits: r.fits })),
				status: status ? { tag: status.tag, text: status.text } : null,
				tint: armouryView.tint,
				decoded: Object.keys(pics).length,
				hero: 'flat',
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
					card: confirm ? q('.card') : null,
					confirmBtn: confirm ? q('.c-confirm') : null,
				};
			},
			constants: () => ARMOURY,
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

{#if phase !== 'closed'}
	<div
		class="arm"
		class:open={phase === 'open'}
		class:closing={phase === 'closing'}
		class:confirm
		class:has-odds={!!mode.odds}
		class:reduced
		bind:this={rootEl}
		style:left="{frame.left}px"
		style:top="{frame.top}px"
		style:transform="scale({frame.u})"
		style:--acc={mode.accent}
		style:--ease={ease}
		style:--dur="{durs.small}ms"
		style:--dur-l="{durs.large}ms"
		style:--close-ms="{M.closeMs}ms"
		style:--confirm-ms="{ARMOURY.tint.confirmMs}ms"
		style:--back-ms="{M.backMs}ms"
		style:--card-out-ms="{M.cardOutMs}ms"
		style:--card-delay="{M.confirmDelayMs}ms"
		style:--guard-ms="{M.confirmGuardMs}ms"
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
			<i class="hdr-crest pic" class:ready={pics[PIC.crest] != null} style:background-image={url(PIC.crest)} aria-hidden="true"></i>
			<span id="arm-name">{TX.name}</span>
		</div>
		<button type="button" class="close lift" aria-label={TX.close} onclick={() => close()}>
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>
		</button>

		<!-- the hero: flat art in this commit (the grid's straight-on frame), rays and a ground shadow -->
		<div class="hero" aria-hidden="true">
			<div class="hero-in">
				{@render burst('')}
				<div class="shadow"></div>
				{#key mode.id}
					<div
						class="hero-img pic"
						class:ready={pics[PIC.hero(mode)] != null}
						style:background-image={url(PIC.hero(mode))}
						style:height="{mode.heroH * 100}%"
						style:aspect-ratio={pics[PIC.hero(mode)] ?? 1}
					></div>
				{/key}
			</div>
		</div>

		<!-- the buy plate: one fill that stretches and two brass rules -->
		<div class="panel" inert={confirm}>
			<div class="plate" style:transform="translateY({detailTop}px)" aria-hidden="true">
				<div class="plate-fill" style:transform="scaleY({(detailH / 100).toFixed(4)})"></div>
				<div class="plate-top"></div>
				<div class="plate-bot" style:transform="translateY({Math.max(0, detailH - 2)}px)"></div>
			</div>
			<div class="detail" style:top="{detailTop}px" bind:offsetHeight={detailH}>
				<div class="d-head">
					<div class="kicker">{TX.kicker[mode.group]}</div>
					<div class="name">{armouryName(mode.id)}</div>
				</div>
				<div class="d-body">
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
						<div class="status">{#if status.tag}<span class="on-tag">{status.tag}</span>{/if}{@render rich(status.text, status.amt)}</div>
					{/if}
				</div>
				<div class="vol" role="img" aria-label={fill(TX.aria.volatility, { n: mode.volatility })}>
					<span class="vol-l" aria-hidden="true">{TX.volatility}</span>
					<span class="pips" aria-hidden="true">{#each [1, 2, 3, 4] as i}<i class:on={i <= mode.volatility}></i>{/each}</span>
				</div>
				<div class="buy">
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
						{isOn ? (mode.group === 'spin' ? TX.button.switchOff : TX.button.unload) : TX.button.activate}
					</button>
					{#if short}<div class="why" id="arm-why">{TX.balanceShort}</div>{/if}
				</div>
			</div>
		</div>

		<!-- the tray: two per spin modes, four buys -->
		<div class="tray" inert={confirm}>
			{#each groups as grp (grp.g)}
				<div class="grp grp-{grp.g}">
					<div class="gh"><b>{TX.group[grp.g].head}</b><span>{TX.group[grp.g].sub}</span></div>
					<div class="tiles">
						{#each grp.modes as m (m.id)}
							{@const mult = tileMultiple(m)}
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
								<span class="thumb" aria-hidden="true">{@render burst('')}{@render thumb(m, '')}</span>
								<span class="tn" aria-hidden="true">{armouryName(m.id)}</span>
								<span class="tp" aria-hidden="true">{mult.head}{#if mult.tail}<small>{mult.tail}</small>{/if}</span>
								{#if activeId === m.id}<span class="on-tag" aria-hidden="true">{TX.onTag[m.group]}</span>{/if}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<!-- the confirm card: the intro cards' own frame, centred; the rest steps back -->
		<div
			class="card"
			class:ready={pics[PIC.card] != null}
			style:background-image={url(PIC.card)}
			role="alertdialog"
			aria-label={fill(TX.confirmTitle, { name: armouryName(mode.id) })}
			aria-hidden={!confirm}
			inert={!confirm}
			tabindex="-1"
			bind:this={cardEl}
		>
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
				<button type="button" class="btn lift c-confirm" onclick={doConfirm}>{TX.button.confirm}</button>
				<button type="button" class="cancel" onclick={cancel}>{TX.button.cancel}</button>
			</div>
			<div class="c-flash" class:on={flash}></div>
		</div>
	</div>
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
		/* the open is a plain fade in this commit (the staggered entrance is commit 5); the close one 150 ms fade */
		animation: arm-in 120ms linear backwards;
	}
	.arm.closing {
		opacity: 0;
		transition: opacity var(--close-ms) linear;
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

	/* the button lift: a flat white veil, opacity only (no filter) */
	.lift {
		position: relative;
		transition: transform 60ms linear;
	}
	.lift::before {
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
		.lift:not(:disabled):hover::before {
			opacity: 0.16;
		}
		.lift:not(:disabled):active::before {
			opacity: 0.34;
			transition-duration: 30ms;
		}
		.lift:not(:disabled):active {
			transform: translateY(2px);
		}
		.cancel:hover {
			opacity: 1;
		}
		.cancel:active {
			opacity: 1;
			transform: translateY(2px);
		}
		.tray:has(.tile:hover) .tile::after {
			opacity: 0.45;
		}
		.tray .tile:hover::after {
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
	.hero-img {
		position: relative;
		display: block;
		flex: none;
		background: center / contain no-repeat;
	}
	.shadow {
		position: absolute;
		left: 22%;
		right: 22%;
		bottom: 1%;
		height: 7%;
		border-radius: 50%;
		background: radial-gradient(closest-side, var(--shade-55), transparent);
	}

	/* ── the plate ── */
	.panel {
		left: 690px;
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
	.detail {
		position: absolute;
		box-sizing: border-box;
		left: 0;
		width: 700px;
		padding: 20px 32px 26px;
		border-top: 2px solid transparent;
		border-bottom: 2px solid transparent;
	}
	.has-odds .detail {
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
		height: 64px;
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
	.btn.off {
		background: linear-gradient(180deg, var(--iron-hi), var(--iron-lo));
		color: var(--gold);
		text-shadow: 0 -1px 0 var(--black);
		border: 2px solid var(--brass-lo);
		box-shadow:
			inset 0 0 0 2px var(--iron-deep),
			0 5px 0 var(--shade-45);
	}
	.btn:disabled {
		background: linear-gradient(180deg, var(--dis-1), var(--dis-2));
		color: var(--dis-text);
		text-shadow: none;
		border-color: var(--dis-line);
		box-shadow:
			inset 0 -4px 0 var(--dis-line),
			0 5px 0 var(--shade-30);
	}

	/* ── tray ── */
	.tray {
		left: 0;
		top: 500px;
		width: 1440px;
		height: 232px;
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
	.tile {
		position: relative;
		flex: 1;
		min-width: 0;
		height: 160px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 9px;
		padding: 0 0 6px;
		box-sizing: border-box;
		font: inherit;
		color: inherit;
		appearance: none;
		-webkit-appearance: none;
		border-radius: 0;
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
	.tile::after {
		content: '';
		position: absolute;
		inset: -2px;
		background: var(--veil);
		opacity: 0.4;
		transition: opacity 100ms linear;
		pointer-events: none;
	}
	.tile.sel::after {
		opacity: 0 !important;
	}
	.tile.sel {
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

	/* ── confirm: the tray, the hero, the plate and the name step back; the card fades in (its rise is commit 5) ── */
	.hdr,
	.hero,
	.panel,
	.tray {
		transition: opacity var(--back-ms) var(--ease);
	}
	.arm.confirm .hdr,
	.arm.confirm .hero,
	.arm.confirm .panel,
	.arm.confirm .tray {
		opacity: 0;
		transition: opacity var(--confirm-ms) var(--ease);
		pointer-events: none;
	}
	.card {
		left: 470px;
		top: 28px;
		width: 500px;
		height: 750px;
		background: 0 0 / 100% 100% no-repeat;
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--card-out-ms) linear;
	}
	.card:not(.ready) {
		background-image: none !important;
	}
	.arm.confirm .card {
		opacity: 1;
		pointer-events: auto;
		transition: opacity var(--dur-l) var(--ease) var(--card-delay);
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
	.c-confirm {
		margin-top: auto;
		flex: none;
		height: 60px;
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 80ms linear,
			visibility 0s,
			transform 60ms linear;
	}
	.arm.confirm .c-confirm {
		opacity: 1;
		visibility: visible;
		transition:
			opacity 80ms linear var(--guard-ms),
			visibility 0s linear var(--guard-ms),
			transform 60ms linear;
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
			transform 60ms linear;
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
	@keyframes arm-in {
		from {
			opacity: 0;
		}
	}
</style>
