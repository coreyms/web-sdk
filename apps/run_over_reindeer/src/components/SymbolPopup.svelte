<script lang="ts">
	// THE SYMBOL PAY POPUP (Corey 2026-11-17: "we need the ability to click on tiles to show their value/payouts during
	// idle, the same way it's set up for manticore mayhem"). Manticore Mayhem's components/SymbolPopup.svelte carried over:
	// HTML in its own fixed layer over the canvas (mounted after the chrome in components/Game.svelte), so its text is real
	// text. Numbers: game/symbolPopupSpec.ts. Words, amounts and placement: game/symbolPopup.ts. The look is this game's:
	// a green guide sign with a white border (the Fast Lane plate's palette, ui/FeatureMenu.svelte), white amounts, the
	// sign yellow for accents.
	//
	// WHEN (Manticore's rule, Corey 2026-11-17 "We can use the same 'when' rules as Manticore"): a tap or click on the
	// board's tap area (components/Board.svelte, the same area whose tap hurries a live spin) is handed here after its own
	// routing. It opens only on an IDLE board (game/boardIdle.ts) with the road at rest and the LED back board down, and
	// never within FIRST_TAP.ignoreMs of PRESS ANYWHERE. Anywhere else the tap does what it always did (hurry a live
	// spin, or nothing). A tap at rest never started a round, so nothing here can start one.
	//
	// IT TAKES NO PRESS: the layer and the popup are pointer-events none, so a press anywhere, the HUD's Spin button under
	// a popup included, goes where it always went. The popup closes on: any pointer press that is not on the board's tap
	// area (every HUD button, the menu, empty space, the snow), a tap on the same symbol again, any key (Escape included,
	// and the Space bar that spins), a resize or rotation, the page going hidden, the play amount, mode or turbo changing,
	// the board stopping being idle (a spin starting, autoplay, a round resuming, a modal or the menu opening, a card
	// coming up), and SYMBOL_POPUP.timeoutMs. A tap on another symbol moves it there.
	//
	// House rules: no backdrop-filter, no filter, no mask; the pop is opacity and a small scale; DEV hooks only on
	// window.__reindeer; fonts the chrome already loads (Overpass for the sign's words and numbers, Outfit Text to read).
	import { onMount, untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	import { stateBet } from 'state-shared';
	import { numberToCurrencyString } from '../game/currency';

	import { getContext } from '../game/context';
	import config from '../game/config';
	import { stamp } from '../game/assets';
	import { runs } from '../game/gameInfoText';
	import { COLUMN_CLIPS } from '../game/columnClipSpec';
	import { boardIdle, landing } from '../game/boardIdle';
	import { COLUMN_FACES, FIRST_TAP, SYMBOL_POPUP as P } from '../game/symbolPopupSpec';
	import { placePopup, popupContent, symbolPopupBoard as B, symbolPopupHook, type Box, type PopupCode } from '../game/symbolPopup';
	import type { ColumnTier } from '../game/typesBookEvent';

	const context = getContext();
	const sg = context.stateGame;

	/** THE IDLE BOARD: the one place the popup may open (and the moment it stops being true, it closes) */
	const idle = boardIdle;

	/** cell: the box the popup keeps clear of and rims (a standing column: its whole reel); tapped: the tapped cell itself */
	type View = { id: number; code: PopupCode; reel: number; row: number; column: boolean; cell: Box; tapped: Box; board: Box; k: number };
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

	// ---- geometry: Pixi global units -> CSS px of the page --------------------------------------------------------
	const canvasBox = () => {
		const app = context.stateApp.pixiApplication;
		const canvas = app?.canvas as HTMLCanvasElement | undefined;
		if (!canvas || !app) return null;
		const r = canvas.getBoundingClientRect();
		// Pixi's global units are the renderer's screen units; with autoDensity they are the canvas's CSS px
		return { r, sx: r.width / (app.screen.width || r.width), sy: r.height / (app.screen.height || r.height) };
	};
	const toCss = (b: Box | null): Box | null => {
		const cb = canvasBox();
		if (!b || !cb) return null;
		return { x: cb.r.left + b.x * cb.sx, y: cb.r.top + b.y * cb.sy, width: b.width * cb.sx, height: b.height * cb.sy };
	};

	/** was the board idle when the press that ends in this tap went DOWN? (the window's capture phase sees it before
	 *  anything else does: a press that closes the menu's popover, or the last press of a round, must not then open a
	 *  popup on its pointerup) */
	let downIdle = false;

	const tap = (gx: number, gy: number) => {
		if (!idle() || !downIdle) return close('not idle');
		// THE FIRST TAP (FIRST_TAP): a fast tapper's taps right after PRESS ANYWHERE open nothing
		if (performance.now() - landing.pressedAt < FIRST_TAP.ignoreMs) return close('first tap window');
		// Reindeer's own: the road at rest, the LED back board down
		if (!B.quiet()) return close('not quiet');
		const at = B.cellAt(gx, gy);
		if (!at) return close('off grid');
		const code = B.what(at.reel, at.row);
		const column = !!code?.startsWith('CW_');
		// the same symbol again (a standing column: anywhere in its reel): the tap closes it
		if (open && view && view.reel === at.reel && (column ? view.column : view.row === at.row)) return close('same symbol');
		if (!code) return close('no symbol');
		const tapped = toCss(B.cellBox(at.reel, at.row));
		const cell = column ? toCss(B.reelBox(at.reel)) : tapped;
		const board = toCss(B.boardBox());
		if (!cell || !tapped || !board) return;
		const k = Math.min(P.maxK, Math.max(P.minK, (column ? cell.height / 4 : cell.height) / P.refCellCss));
		view = { id: ++seq, code, reel: at.reel, row: at.row, column, cell, tapped, board, k };
		open = true;
		note('open', 'tap', code);
		clearTimeout(timer);
		timer = setTimeout(() => close('timeout'), P.timeoutMs);
	};

	// ---- what it says: AMOUNTS at the CURRENT play amount, the HUD's own formatter (Corey 2026-11-17: "Amounts like
	// Manticore."): in a social session that is the session's coin (GC / SC) exactly as the HUD writes it, as Manticore's
	// popup does. Game Info's paytable keeps its own rule (multiples in social); standard sessions are unchanged.
	const payText = (mult: number) => numberToCurrencyString(mult * stateBet.betAmount);
	const content = $derived(view ? popupContent(view.code, payText) : null);

	// ---- where: beside the cell, inside the board when it fits (game/symbolPopup.ts placePopup) ---------------------
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
			line: s(P.lineFont, P.lineFloor),
			note: s(P.noteFont, P.noteFloor),
		};
	});
	const overlaps = (p: { x: number; y: number }, w: number, h: number, b: Box) => p.x < b.x + b.width - 0.5 && p.x + w > b.x + 0.5 && p.y < b.y + b.height - 0.5 && p.y + h > b.y + 0.5;
	const place = $derived.by(() => {
		if (!view) return null;
		const w = popW || dims.width;
		// before the first measure: the tile and the rows (or about four lines) at their line height
		const h = popH || dims.pad * 2 + dims.tile + dims.row * P.rowLine * ((content?.rows.length ?? 3) + 1);
		const screen = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
		const placed = placePopup(view.cell, w, h, view.board, screen, P.gapCss, P.edgeCss);
		if (!view.column || !overlaps(placed, w, h, view.cell)) return placed;
		// a standing column with no room beside, above or below it at the usual margins (the middle reel on a small upright
		// phone, 390 x 620: above the column it lacks 1 px): first the same places with the tight margins
		// (SYMBOL_POPUP.tight), so the whole column, its character and its multiplier, stays in view
		const tight = placePopup(view.cell, w, h, view.board, screen, P.tight.gapCss, P.tight.edgeCss);
		if (!overlaps(tight, w, h, view.cell)) return tight;
		// still none: keep clear of the tapped cell instead, so the popup may lie over another part of that column but
		// never the tapped one
		return placePopup(view.tapped, w, h, view.board, screen, P.gapCss, P.edgeCss);
	});

	// ---- what closes it ----------------------------------------------------------------------------------------------
	// the board stops being idle: a spin starts (Spin, Space, autoplay), a round resumes, a modal or the menu opens, a
	// card comes up
	$effect(() => {
		if (open && !idle()) untrack(() => close('not idle'));
	});
	// the play amount, the mode or the turbo level changes (a button press already closed it; this also covers a hotkey)
	$effect(() => {
		void stateBet.betAmount;
		void stateBet.activeBetModeKey;
		void sg.turboLevel;
		untrack(() => close('bet / mode / turbo'));
	});
	// every press: note whether the board was idle as it went down (the tap above asks), and while the popup is up,
	// close it unless the press is on the board's tap area (the board's own tap: another symbol moves it, the same one
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
				if (B.cellAt(x, y)) return;
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

	// ---- the pictures: Game Info's own symbol pictures; the column characters' faces and the Grandma Wild's smoke are
	// crops of sheets the game already has (symbolPopupSpec COLUMN_FACES) ---------------------------------------------
	const pictureOf = (code: string) => stamp(`/assets/symbols/single/${(config.carSymbols as readonly string[]).includes(code) || code === 'W' ? `${code}_R` : code}.webp`);
	const STILLS = COLUMN_CLIPS.landing.tiers.full;
	const stillsUrl = stamp(`/assets/${STILLS.file}`);
	const cloudUrl = stamp('/assets/columns/cloud-backdrop.webp');
	/** a square crop of a sheet as a CSS background, drawn `t` px wide */
	const crop = (url: string, sheetW: number, sheetH: number, x: number, y: number, size: number, t: number) => {
		const s = t / size;
		return `background-image: url("${url}"); background-size: ${sheetW * s}px ${sheetH * s}px; background-position: ${-x * s}px ${-y * s}px;`;
	};
	const faceStyle = (code: PopupCode, t: number): string | null => {
		if (code.startsWith('CW_')) {
			const f = COLUMN_FACES[code.slice(3) as ColumnTier];
			return crop(stillsUrl, STILLS.width, STILLS.height, f.x, f.y, f.size, t);
		}
		// the smoke's middle (the backdrop is 250 x 684: a 250 square from its middle)
		if (code === 'GW') return crop(cloudUrl, 250, 684, 0, 217, 250, t);
		return null;
	};
	// the pictures are fetched once everything else has loaded, so a first popup never waits for its picture
	let picturesAsked = false;
	$effect(() => {
		if (picturesAsked || !context.stateApp.loaded) return;
		picturesAsked = true;
		for (const src of [...config.payOrder.map(pictureOf), pictureOf('W'), pictureOf('S'), stillsUrl, cloudUrl]) {
			const img = new Image();
			img.decoding = 'async';
			img.src = src;
		}
	});

	/** the page point (CSS px) at the middle of a cell, for a real click or touch */
	const cellPoint = (reel: number, row: number) => {
		const b = toCss(B.cellBox(reel, row));
		return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
	};

	onMount(() => {
		symbolPopupHook.tap = tap;
		if (import.meta.env.DEV) {
			// tools for the popup probe (tools/symbol_popup_probe.mjs); house rule: only on __reindeer
			((window as any).__reindeer ??= {}).symbolPopup = {
				spec: () => ({ ...P }),
				idle: () => idle(),
				quiet: () => B.quiet(),
				state: () => ({
					open,
					code: view?.code ?? null,
					reel: view?.reel ?? null,
					row: view?.row ?? null,
					column: view?.column ?? null,
					name: content?.name ?? null,
					kind: content?.kind ?? null,
					head: content?.head ?? null,
					rows: content?.rows.map((r) => ({ ...r })) ?? [],
					lines: content ? [...content.lines] : [],
					note: content?.note ?? null,
					place: place ? { ...place, width: popW, height: popH } : null,
					cell: view ? { ...view.cell } : null,
					tapped: view ? { ...view.tapped } : null,
					board: view ? { ...view.board } : null,
					k: view?.k ?? null,
				}),
				log: () => log.map((e) => ({ ...e })),
				/** THE FIRST TAP: when PRESS ANYWHERE was pressed (performance.now) and the window */
				firstTap: () => ({ pressedAt: landing.pressedAt, ignoreMs: FIRST_TAP.ignoreMs }),
				cellPoint,
				/** what each cell shows now, [reel][row] (a standing column: CW_<tier> in each of its cells) */
				board: () => Array.from({ length: config.numReels }, (_, reel) => Array.from({ length: config.numRows[reel] }, (_, row) => B.what(reel, row))),
				/** the board's box and a cell's, in CSS px */
				boardCss: () => toCss(B.boardBox()),
				cellCss: (reel: number, row: number) => toCss(B.cellBox(reel, row)),
				/** the play amount the amounts are drawn at, the HUD's own formatter, and Game Info's rule, for the probe */
				bet: () => stateBet.betAmount,
				fmt: (x: number) => numberToCurrencyString(x),
				payText: (mult: number) => payText(mult),
			};
		}
		return () => {
			clearTimeout(timer);
			symbolPopupHook.tap = () => {};
			if (import.meta.env.DEV) delete (window as any).__reindeer?.symbolPopup;
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
					style:border-width="{P.border}px"
					style:transform-origin={place.side === 'right' ? 'left center' : place.side === 'left' ? 'right center' : place.side === 'above' ? 'center bottom' : 'center top'}
				>
					<div class="sp-head">
						{#if faceStyle(content.code, dims.tile)}
							<div class="sp-tile sp-face" class:sp-smoke={content.code === 'GW'} style="{faceStyle(content.code, dims.tile)} width: {dims.tile}px; height: {dims.tile}px;">
								{#if content.code === 'GW'}<span class="sp-wild" style:font-size="{dims.tile * 0.3}px">WILD</span>{/if}
							</div>
						{:else}
							<img class="sp-tile" src={pictureOf(content.code)} alt="" width={dims.tile} height={dims.tile} style:width="{dims.tile}px" style:height="{dims.tile}px" />
						{/if}
						<div class="sp-title">
							<div class="sp-name" style:font-size="{dims.name}px">{content.name}</div>
							<div class="sp-kind" style:font-size="{dims.kind}px">{content.kind}</div>
						</div>
					</div>
					{#each content.lines as line, i (i)}
						<p class="sp-line" style:font-size="{dims.line}px">{#each runs(line) as r, j (j)}{#if r.b}<b>{r.t}</b>{:else}{r.t}{/if}{/each}</p>
					{/each}
					{#if content.head}
						<div class="sp-rows" style:font-size="{dims.row}px" style:line-height={P.rowLine}>
							<div class="sp-row sp-colhead" style:font-size="{dims.head}px"><span>{content.head[0]}</span><span>{content.head[1]}</span></div>
							{#each content.rows as r (r.k)}
								<div class="sp-row" class:top={r.top}><span class="sp-k">{r.k}</span><span class="sp-v">{r.v}</span></div>
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
	/* over the canvas and the HUD (Chrome.svelte's layer is 20), under the bonus round's cards (40), the menu's popover
	   (50) and the modals (60). Takes no pointer at all: every press goes through to what is under it. */
	.sp-layer {
		position: fixed;
		inset: 0;
		z-index: 21;
		pointer-events: none;
		overflow: hidden;
		--sp-green: #0b6b46;
		--sp-green-deep: #064a31;
		--sp-white: #f7f8f3;
		--sp-yellow: #ffd21f;
		--sp-disp: 'Overpass', var(--ui-font-display), sans-serif;
		--sp-read: 'Outfit Text', 'Outfit', system-ui, sans-serif;
	}
	.sp-layer * {
		pointer-events: none;
	}
	/* the rim on the tapped cell: the sign yellow with a soft glow either side, no filter */
	.sp-rim {
		position: absolute;
		box-sizing: border-box;
		border-style: solid;
		border-color: rgba(255, 210, 31, 0.95);
		box-shadow:
			0 0 var(--glow) rgba(255, 210, 31, 0.5),
			inset 0 0 var(--glow) rgba(255, 210, 31, 0.3);
	}
	.sp-pos {
		position: absolute;
	}
	/* THE GREEN GUIDE SIGN (the Fast Lane plate, ui/FeatureMenu.svelte .plate): the green face, the white border, the
	   dark green edge around it and a soft drop shadow */
	.sp-pop {
		box-sizing: border-box;
		width: 100%;
		color: #fff;
		font-family: var(--sp-read);
		background: linear-gradient(180deg, var(--sp-green), var(--sp-green-deep));
		border-style: solid;
		border-color: var(--sp-white);
		box-shadow:
			0 0 0 2px var(--sp-green-deep),
			0 10px 24px rgba(0, 0, 0, 0.5);
	}
	.sp-head {
		display: flex;
		align-items: center;
		gap: 0.65em;
	}
	.sp-tile {
		flex: none;
		display: block;
		object-fit: contain;
	}
	.sp-face {
		position: relative;
		border-radius: 8px;
		background-color: rgba(0, 0, 0, 0.22);
		background-repeat: no-repeat;
		box-shadow: inset 0 0 0 2px rgba(247, 248, 243, 0.85);
	}
	.sp-smoke {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	/* the board's crash cloud says WILD on its smoke: the same word in the sign's face */
	.sp-wild {
		font-family: var(--sp-disp);
		font-weight: 900;
		letter-spacing: 0.02em;
		color: #d3202f;
		text-shadow:
			0 0 2px #fff,
			0 0 4px #fff;
	}
	.sp-title {
		min-width: 0;
	}
	.sp-name {
		font-family: var(--sp-disp);
		font-weight: 900;
		line-height: 1.05;
		letter-spacing: 0.02em;
		color: #fff;
		overflow-wrap: break-word;
	}
	.sp-kind {
		margin-top: 0.3em;
		font-family: var(--sp-disp);
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--sp-yellow);
	}
	.sp-line {
		margin: 0.65em 0 0;
		line-height: 1.32;
		font-weight: 400;
		color: #f1fbf5;
	}
	.sp-line b {
		font-weight: 700;
		color: var(--sp-yellow);
	}
	/* the muted line at the foot: smaller than the lines, wraps inside the sign */
	.sp-note {
		margin: 0.7em 0 0;
		line-height: 1.3;
		font-weight: 400;
		color: #bfe0cf;
		overflow-wrap: break-word;
	}
	.sp-rows {
		margin-top: 0.45em;
		font-family: var(--sp-disp);
	}
	/* the rows as the Fast Lane plate's distance rows: a white rule over each, the word left, the number right */
	.sp-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.8em;
		border-top: 2px solid rgba(255, 255, 255, 0.28);
	}
	.sp-colhead {
		border-top: 0;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #d7efe3;
	}
	.sp-k {
		font-weight: 700;
		color: #f1fbf5;
		white-space: nowrap;
	}
	.sp-v {
		font-weight: 900;
		white-space: nowrap;
		text-align: right;
		color: #fff;
		font-variant-numeric: tabular-nums;
	}
	.sp-row.top .sp-v,
	.sp-row.top .sp-k {
		color: var(--sp-yellow);
	}
</style>
