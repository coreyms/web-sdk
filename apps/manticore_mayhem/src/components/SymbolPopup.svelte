<script lang="ts">
	// THE SYMBOL PAY POPUP (Corey 2026-10-16 15:32: "clicking on a symbol or touching it on an idle board shows a popup of
	// its pay values. It doesn't respond when not idle, and the pop up goes away on any other player action, clicking
	// another tile, or UI button, or just times out after a few seconds."). HTML, in its own fixed layer over the canvas
	// (mounted beside the SKIP button in components/Game.svelte), so its text is real text and the creature never covers
	// it. Numbers: game/symbolPopupSpec.ts. Words, amounts and placement: game/symbolPopup.ts.
	//
	// WHEN: a tap or click on the board's opening reaches components/BoardTap.svelte, which hands it here
	// (symbolPopupHook.tap) after its own routing. It opens only on an IDLE board (`idle` below): no round in flight, no
	// autoplay run, no feature, no modal or menu, no press gate, plaque, win screen or max win screen, not loading, not
	// a replay, not a held open round, nothing being skipped, the board at rest. Anywhere else the tap does what it
	// always did (hurry a live spin, or nothing). A tap at rest never started a round, so nothing here can start one.
	//
	// IT TAKES NO PRESS: the layer and the popup are pointer-events none, so a press anywhere, the HUD's Spin button
	// under a popup included, goes where it always went. The popup closes on: any pointer press that is not on the
	// board's opening (every HUD button, the menu, empty space, the creature), a tap on the same symbol again, any key
	// (Escape included, and the Space bar that spins), a resize or rotation, the page going hidden, the bet, mode or
	// turbo changing, the board stopping being idle (a spin starting, a modal opening), and SYMBOL_POPUP.timeoutMs. A tap
	// on another symbol moves it there.
	//
	// House rules: no backdrop-filter, no filter, no mask; the pop is opacity and a small scale; DEV hooks only on
	// window.__manticore; fonts the HUD already loads (Black Ops One, Outfit, Sora).
	import { onMount, untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	import { stateBet, stateBetDerived, stateModal, stateUi } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';
	import type * as PIXI from 'pixi.js';

	import { getContext } from '../game/context';
	import { BOARD_SIZES, GRID, SYMBOL_SIZE } from '../game/constants';
	import config from '../game/config';
	import { layoutKind } from '../game/layoutSpec';
	import { openingsFor } from '../game/symbolPlace';
	import { boardOpening } from '../game/boardTap';
	import { stamp } from '../game/assets';
	import { maxWinState } from '../game/maxWin.svelte';
	import { armouryView } from '../ui/armoury/armouryView.svelte';
	import { SYMBOL_POPUP as P } from '../game/symbolPopupSpec';
	import { isPopupCode, placePopup, popupContent, symbolPopupHook, type Box, type PopupCode } from '../game/symbolPopup';

	const context = getContext();
	const sg = context.stateGame;

	/** THE IDLE BOARD: the one place the popup may open (and the moment it stops being true, it closes) */
	const idle = () =>
		context.stateXstateDerived.isIdle() &&
		!sg.resumeHold &&
		stateUi.config.mode !== 'replay' &&
		!context.stateLayout.showLoadingScreen &&
		stateModal.modal == null &&
		!stateUi.menuOpen &&
		!armouryView.shown &&
		!stateBetDerived.hasAutoBetCounter() &&
		!stateBet.isSpaceHold &&
		sg.gameType !== 'freegame' &&
		sg.pressGates === 0 &&
		!sg.winShowing &&
		sg.plaque === null &&
		!sg.skipping &&
		!sg.busy &&
		sg.readouts.length === 0 &&
		maxWinState.phase === 'idle';

	type View = { id: number; code: PopupCode; reel: number; row: number; cell: Box; board: Box; k: number };
	let view = $state<View | null>(null);
	let open = $state(false);
	let seq = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	/** DEV: why and when it last closed, and every open (bounded) */
	const log: { what: 'open' | 'close'; why: string; code?: string; at: number }[] = [];
	const note = (what: 'open' | 'close', why: string, code?: string) => {
		if (!import.meta.env.DEV) return;
		log.push({ what, why, code, at: performance.now() });
		if (log.length > 60) log.splice(0, 30);
	};

	const close = (why: string) => {
		clearTimeout(timer);
		if (!open) return;
		open = false;
		note('close', why);
	};

	// ---- geometry: board units -> CSS px of the page --------------------------------------------------------------
	const canvasBox = () => {
		const canvas = context.stateApp.pixiApplication?.canvas as HTMLCanvasElement | undefined;
		const app = context.stateApp.pixiApplication;
		if (!canvas || !app) return null;
		const r = canvas.getBoundingClientRect();
		// Pixi's global units are the renderer's screen units; with autoDensity they are the canvas's CSS px
		return { r, sx: r.width / (app.screen.width || r.width), sy: r.height / (app.screen.height || r.height) };
	};

	/** was the board idle when the press that ends in this tap went DOWN? (the window's capture phase sees it before
	 *  anything else does: a press that closes the menu's popover, which closes on pointerdown, must not then open a
	 *  popup on its pointerup) */
	let downIdle = false;

	const tap = (canvasX: number, canvasY: number, space: PIXI.Container) => {
		if (!idle() || !downIdle) return close('not idle');
		const b = context.stateGameDerived.boardLayout();
		const left = b.x - (BOARD_SIZES.width * b.scale) / 2;
		const top = b.y - (BOARD_SIZES.height * b.scale) / 2;
		const local = space.toLocal({ x: canvasX, y: canvasY });
		const reel = Math.floor((local.x - left) / b.scale / SYMBOL_SIZE);
		const row = Math.floor((local.y - top) / b.scale / SYMBOL_SIZE);
		if (reel < 0 || reel >= GRID || row < 0 || row >= GRID) return close('off grid');
		// the same symbol again: the tap closes it
		if (open && view && view.reel === reel && view.row === row) return close('same symbol');
		const code = context.stateGameDerived.boardRaw()[reel]?.[row];
		if (!code || !isPopupCode(code)) return close('no symbol');
		const cb = canvasBox();
		if (!cb) return;
		// board units -> CSS px: the board container is centred on boardLayout x / y at its scale, in the MainContainer
		// (the tap area's parent, identity transform), and the MainContainer maps to the canvas
		const toCss = (u: number, v: number) => {
			const g = space.toGlobal({ x: left + u * b.scale, y: top + v * b.scale });
			return { x: cb.r.left + g.x * cb.sx, y: cb.r.top + g.y * cb.sy };
		};
		const boxCss = (u0: number, v0: number, u1: number, v1: number): Box => {
			const a = toCss(u0, v0);
			const c = toCss(u1, v1);
			return { x: a.x, y: a.y, width: c.x - a.x, height: c.y - a.y };
		};
		// the cell's TRUE OPENING (game/symbolPlace.ts, what BoardCells draws the symbol into), for the rim and the anchor
		const ls = context.stateLayoutDerived;
		const op = openingsFor(layoutKind(ls.layoutType()), ls.canvasSizes().width / ls.mainLayout().scale);
		const i = (reel * GRID + row) * 4;
		const cell = boxCss(op.box[i], op.box[i + 1], op.box[i + 2], op.box[i + 3]);
		const board = boxCss(0, 0, BOARD_SIZES.width, BOARD_SIZES.height);
		const k = Math.min(P.maxK, Math.max(P.minK, cell.width / P.refCellCss));
		view = { id: ++seq, code, reel, row, cell, board, k };
		open = true;
		note('open', 'tap', code);
		clearTimeout(timer);
		timer = setTimeout(() => close('timeout'), P.timeoutMs);
	};

	// ---- what it says: amounts at the CURRENT bet, the HUD's formatter (SC / GC in social, as everywhere) ----------
	const content = $derived(
		view ? popupContent(view.code, (x) => numberToCurrencyString(x * stateBet.betAmount), stateBet.activeBetModeKey.toUpperCase() === 'SUPER_ANTE') : null,
	);

	// ---- where: beside the cell, inside the board's opening when it fits (game/symbolPopup.ts placePopup) ----------
	let popW = $state(0);
	let popH = $state(0);
	const dims = $derived.by(() => {
		const k = view?.k ?? 1;
		const s = (v: number, floor = 0) => Math.max(floor, v * k);
		return {
			width: s(P.width),
			pad: s(P.pad),
			radius: s(P.radius),
			tile: s(P.tile),
			name: s(P.nameFont, P.nameFloor),
			kind: s(P.kindFont, P.kindFloor),
			row: s(P.rowFont, P.rowFloor),
			head: s(P.headFont, P.headFloor),
			note: s(P.noteFont, P.noteFloor),
		};
	});
	const place = $derived.by(() => {
		if (!view) return null;
		const w = popW || dims.width;
		// before the first measure: the tile, the head and the rows at their line height
		const h = popH || dims.pad * 2 + dims.tile + dims.row * P.rowLine * ((content?.rows.length ?? 2) + 1);
		const screen = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
		return placePopup(view.cell, w, h, view.board, screen, P.gapCss, P.edgeCss);
	});

	// ---- what closes it ----------------------------------------------------------------------------------------------
	// the board stops being idle: a spin starts (Spin, Space, autoplay), a modal or the menu opens, a gate comes up
	$effect(() => {
		if (open && !idle()) untrack(() => close('not idle'));
	});
	// the bet, the mode or the turbo level changes (a button press already closed it; this also covers a hotkey)
	$effect(() => {
		void stateBet.betAmount;
		void stateBet.activeBetModeKey;
		void sg.turboLevel;
		untrack(() => close('bet / mode / turbo'));
	});
	// every press: note whether the board was idle as it went down (the tap above asks), and while the popup is up,
	// close it unless the press is on the board's opening (the board's own tap: another symbol moves it, the same one
	// closes it)
	$effect(() => {
		const down = (event: PointerEvent) => {
			downIdle = untrack(idle);
			if (!untrack(() => open)) return;
			const canvas = context.stateApp.pixiApplication?.canvas;
			const cb = canvasBox();
			if (canvas && cb && event.target === canvas) {
				const x = (event.clientX - cb.r.left) / cb.sx;
				const y = (event.clientY - cb.r.top) / cb.sy;
				if (boardOpening.contains(x, y)) return;
			}
			close('press');
		};
		window.addEventListener('pointerdown', down, true);
		return () => window.removeEventListener('pointerdown', down, true);
	});
	// any other player action while it is up
	$effect(() => {
		if (!open) return;
		const key = (event: KeyboardEvent) => close(event.key === 'Escape' ? 'escape' : 'key');
		const resize = () => close('resize');
		const hidden = () => {
			if (document.hidden) close('hidden');
		};
		window.addEventListener('keydown', key, true);
		window.addEventListener('resize', resize);
		window.addEventListener('orientationchange', resize);
		document.addEventListener('visibilitychange', hidden);
		return () => {
			window.removeEventListener('keydown', key, true);
			window.removeEventListener('resize', resize);
			window.removeEventListener('orientationchange', resize);
			document.removeEventListener('visibilitychange', hidden);
		};
	});

	/** the pop: opacity and a small scale, nothing else */
	const pop = (_node: Element) => ({
		duration: P.inMs,
		easing: cubicOut,
		css: (t: number) => `opacity: ${t}; transform: scale(${P.popFrom + (1 - P.popFrom) * t});`,
	});

	const tileSrc = (code: string) => stamp(`/assets/tiles/${code.toLowerCase()}.webp`);
	// the ten static tiles (the rules page's own, about 150 KB in all) are fetched once everything else has loaded, so a
	// first popup never waits for its picture
	let tilesAsked = false;
	$effect(() => {
		if (tilesAsked || !context.stateApp.loaded) return;
		tilesAsked = true;
		for (const code of [...config.payOrder, 'W', 'S']) {
			const img = new Image();
			img.decoding = 'async';
			img.src = tileSrc(code);
		}
	});

	onMount(() => {
		symbolPopupHook.tap = tap;
		if (import.meta.env.DEV) {
			// tools for the popup probe (feedback/symbol_popup_r1/symbol_popup_probe.js); house rule: only on __manticore
			((window as any).__manticore ??= {}).symbolPopup = {
				spec: () => ({ ...P }),
				idle: () => idle(),
				state: () => ({
					open,
					code: view?.code ?? null,
					reel: view?.reel ?? null,
					row: view?.row ?? null,
					name: content?.name ?? null,
					head: content?.head ?? null,
					rows: content?.rows.map((r) => ({ ...r })) ?? [],
					line: content?.line ?? null,
					note: content?.note ?? null,
					place: place ? { ...place, width: popW, height: popH } : null,
					cell: view ? { ...view.cell } : null,
					board: view ? { ...view.board } : null,
				}),
				log: () => log.map((e) => ({ ...e })),
				/** the page (CSS px) point at the middle of a cell, for a real click or touch */
				cellPoint: (reel: number, row: number) => {
					const cb = canvasBox();
					// the tap area's rect (components/BoardTap.svelte) is the board's opening in canvas px
					const rect = (window as any).__manticore?.boardTap?.rect?.();
					if (!cb || !rect) return null;
					const fx = (reel + 0.5) / GRID;
					const fy = (row + 0.5) / GRID;
					return { x: cb.r.left + (rect.x + fx * rect.width) * cb.sx, y: cb.r.top + (rect.y + fy * rect.height) * cb.sy };
				},
				board: () => context.stateGameDerived.boardRaw(),
				/** the bet the amounts are drawn at, and the HUD's own formatter, for the probe's comparison */
				bet: () => stateBet.betAmount,
				fmt: (x: number) => numberToCurrencyString(x),
			};
		}
		return () => {
			clearTimeout(timer);
			symbolPopupHook.tap = () => {};
			if (import.meta.env.DEV) delete (window as any).__manticore?.symbolPopup;
		};
	});
</script>

<div class="am-ui sp-layer" aria-live="polite">
	{#if open && view && content && place}
		{#key view.id}
			<div
				class="sp-rim"
				aria-hidden="true"
				in:fade={{ duration: P.inMs }}
				style:left="{view.cell.x + P.rim.inset}px"
				style:top="{view.cell.y + P.rim.inset}px"
				style:width="{view.cell.width - 2 * P.rim.inset}px"
				style:height="{view.cell.height - 2 * P.rim.inset}px"
				style:border-width="{P.rim.stroke}px"
				style:border-radius="{P.rim.radius * view.k}px"
				style:--glow="{P.rim.glow * view.k}px"
			></div>
		{/key}
		<div
			class="sp-pos"
			data-symbol-popup={view.code}
			data-side={place.side}
			out:fade={{ duration: P.outMs }}
			bind:offsetWidth={popW}
			bind:offsetHeight={popH}
			style:left="{place.x}px"
			style:top="{place.y}px"
			style:width="{dims.width}px"
		>
			{#key view.id}
				<div
					class="sp-pop"
					role="group"
					aria-label={content.name}
					in:pop
					style:padding="{dims.pad}px"
					style:border-radius="{dims.radius}px"
					style:--bz="{P.bezel}px"
					style:transform-origin={place.side === 'right' ? 'left center' : place.side === 'left' ? 'right center' : place.side === 'above' ? 'center bottom' : 'center top'}
				>
					<div class="sp-head">
						<img class="sp-tile" src={tileSrc(content.code)} alt="" width={dims.tile} height={dims.tile} style:width="{dims.tile}px" style:height="{dims.tile}px" />
						<div class="sp-title">
							<div class="sp-name am-stencil" style:font-size="{dims.name}px">{content.name}</div>
							<div class="sp-kind" style:font-size="{dims.kind}px">{content.kind}</div>
						</div>
					</div>
					{#if content.line}
						<p class="sp-line" style:font-size="{dims.row}px">{content.line}</p>
					{/if}
					{#if content.head}
						<div class="sp-rows" style:font-size="{dims.row}px" style:line-height={P.rowLine}>
							<div class="sp-row sp-colhead" style:font-size="{dims.head}px"><span>{content.head[0]}</span><span>{content.head[1]}</span></div>
							{#each content.rows as r (r.k)}
								<div class="sp-row" class:top={r.top}><span class="sp-k">{r.k}</span><span class="sp-v slot-num">{r.v}</span></div>
							{/each}
						</div>
					{/if}
					{#if content.note}
						<p class="sp-note" style:font-size="{dims.note}px">{content.note}</p>
					{/if}
				</div>
			{/key}
		</div>
	{/if}
</div>

<style>
	/* over the canvas and the HUD (Chrome.svelte's layer is 20, the SKIP layer 21), under the modals (60). Takes no
	   pointer at all: every press goes through to what is under it. */
	.sp-layer {
		position: fixed;
		inset: 0;
		z-index: 21;
		pointer-events: none;
		overflow: hidden;
	}
	.sp-layer * {
		pointer-events: none;
	}
	/* the soft rim on the tapped cell: a warm gold stroke with a glow either side, no filter */
	.sp-rim {
		position: absolute;
		box-sizing: border-box;
		border-style: solid;
		border-color: rgba(255, 222, 140, 0.9);
		box-shadow:
			0 0 var(--glow) rgba(255, 190, 70, 0.55),
			inset 0 0 var(--glow) rgba(255, 190, 70, 0.35);
	}
	.sp-pos {
		position: absolute;
	}
	/* THE BRONZE PLATE'S GLASS AND BEZEL, as the SKIP prompt draws it (components/SkipButton.svelte .ask; the HUD's
	   .am-plate in ui/ChromeStyles.svelte): smoked warm glass, the four bronze bands inset, a dark hairline inside them.
	   A shade more opaque than the prompt so the numbers read over a busy board. */
	.sp-pop {
		box-sizing: border-box;
		width: 100%;
		color: var(--plate-ink, #f7eedc);
		background: linear-gradient(180deg, rgba(40, 28, 17, 0.94), rgba(12, 9, 6, 0.96));
		box-shadow:
			0 10px 24px rgba(0, 0, 0, 0.55),
			inset 0 var(--bz) 0 var(--plate-bronze-1),
			inset calc(-1 * var(--bz)) 0 0 var(--plate-bronze-2),
			inset 0 calc(-1 * var(--bz)) 0 var(--plate-bronze-3),
			inset var(--bz) 0 0 var(--plate-bronze-4),
			inset 0 0 0 calc(var(--bz) + 1px) rgba(0, 0, 0, 0.6);
	}
	.sp-head {
		display: flex;
		align-items: center;
		gap: 0.6em;
	}
	.sp-tile {
		flex: none;
		display: block;
		object-fit: contain;
		border-radius: 6px;
	}
	.sp-title {
		min-width: 0;
	}
	.sp-name {
		line-height: 1.1;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		overflow-wrap: break-word;
	}
	.sp-kind {
		margin-top: 0.25em;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #c9b28a;
	}
	.sp-line {
		margin: 0.6em 0 0;
		line-height: 1.35;
		font-family: 'Outfit Text', var(--ui-font);
		font-weight: 400;
		color: var(--plate-ink, #f7eedc);
	}
	/* the base-amount note under the table: muted, smaller than the rows, wraps inside the panel */
	.sp-note {
		margin: 0.7em 0 0;
		line-height: 1.3;
		font-family: 'Outfit Text', var(--ui-font);
		font-weight: 400;
		color: #b3a184;
		overflow-wrap: break-word;
	}
	.sp-rows {
		margin-top: 0.5em;
	}
	.sp-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.8em;
		border-top: 1px solid rgba(255, 232, 190, 0.09);
	}
	.sp-colhead {
		border-top: 0;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: #b89c6c;
	}
	.sp-k {
		font-weight: 600;
		color: #e2d5bd;
		white-space: nowrap;
	}
	.sp-v {
		font-weight: 700;
		white-space: nowrap;
		text-align: right;
	}
	.sp-row.top .sp-v,
	.sp-row.top .sp-k {
		color: var(--ui-gold, #ffdc4a);
	}
</style>
