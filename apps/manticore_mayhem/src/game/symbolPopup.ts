// THE SYMBOL PAY POPUP: the parts that need no component (Corey 2026-10-16 15:32). components/SymbolPopup.svelte draws
// it and owns its state; this file has the hook the board's tap area calls, what the popup says, and where it goes.
//
// PRESENTATION ONLY. The amounts are the paytable's band multipliers times the current bet, exactly as the rules
// page's paytable computes them (ui/GameInfoModal.svelte payText), through the HUD's own currency formatter. Nothing
// here reads, computes or changes an outcome.
import type * as PIXI from 'pixi.js';

import config from './config';
import { soc } from './social';
import { gameInfoText, MODE_NAMES } from './gameInfoText';

/** components/BoardTap.svelte calls `tap` with every tap or click on the board's opening (canvas px, and its own area
 *  container, which sits in the MainContainer's master units). components/SymbolPopup.svelte sets it while mounted;
 *  until then a tap goes nowhere. It decides for itself whether the board is idle. */
export const symbolPopupHook = {
	tap: (_canvasX: number, _canvasY: number, _space: PIXI.Container): void => {},
};

export type PayingCode = (typeof config.payOrder)[number];
export type PopupCode = PayingCode | 'W' | 'S';
export type PopupRow = { k: string; v: string; top?: boolean };
export type PopupContent = {
	code: PopupCode;
	name: string;
	/** the line under the name: the rules page's own tier words */
	kind: string;
	/** the two column heads over the rows, or null (the Wild has one line instead) */
	head: [string, string] | null;
	rows: PopupRow[];
	/** the Wild's line */
	line: string | null;
	/** the small muted line under a paying symbol's table: the bands are the BASE amounts, the tiles multiply them
	 *  (Corey 2026-10-16 16:47: "15+ ... $100.00" must not read as what 15 or more always pays) */
	note: string | null;
};

const PAYING = new Set<string>(config.payOrder);
export const isPopupCode = (code: string): code is PopupCode => PAYING.has(code) || code === 'W' || code === 'S';

/** the rules page's tier words (ui/GameInfoModal.svelte SYMBOL_META kind: Premium, Mid, Low; the Wild and the scatter
 *  are its Special Symbols) */
const KIND: Record<string, string> = { PREMIUM: 'Premium', HIGH: 'Mid', LOW: 'Low', WILD: 'Special Symbol', SCATTER: 'Special Symbol' };

/** the Wild's line: the rules page's own sentence (gameInfoText paytable.wild), up to and including the scatter's
 *  name, so the two never drift apart: "Stands in for every symbol except the War Standard Scatter." */
export const wildLine = (): string => {
	const full = gameInfoText(() => '').paytable.wild;
	const name = config.symbols.S.name;
	const at = full.indexOf(name);
	return at < 0 ? full : `${full.slice(0, at + name.length)}.`;
};

/**
 * What the popup says for one symbol. `amount(x)`: x times the current bet in the session's currency (the caller
 * passes numberToCurrencyString(x * stateBet.betAmount), as the rules page does). `superAnte`: Super Ante is armed,
 * where 4 scatters award Super Free Spins (the rules page's scatter text says so too).
 */
export const popupContent = (code: PopupCode, amount: (x: number) => string, superAnte = false): PopupContent => {
	const sym = config.symbols[code];
	const base = { code, name: sym.name, kind: KIND[sym.tier] ?? '' };
	if (code === 'W') return { ...base, head: null, rows: [], line: wildLine(), note: null };
	if (code === 'S') {
		const fs = config.freeSpins;
		return {
			...base,
			head: ['SCATTERS', 'AWARD'],
			rows: [
				superAnte ? { k: '4', v: `${fs.super} ${MODE_NAMES.super}` } : { k: '4', v: `${fs.bonus} ${MODE_NAMES.bonus}` },
				{ k: '5', v: `${fs.super} ${MODE_NAMES.super}` },
				{ k: '6+', v: `${fs.epic} ${MODE_NAMES.epic}`, top: true },
			],
			line: null,
			note: null,
		};
	}
	const pays = (sym.paytable ?? []) as readonly number[];
	return {
		...base,
		head: ['CLUSTER', soc('BASE PAY', 'BASE WIN')],
		rows: config.paytableBands.map((band, i) => ({ k: band.label, v: amount(pays[i] ?? 0), top: i === config.paytableBands.length - 1 })),
		line: null,
		note: soc('Lit Multiplier Tiles under a cluster multiply its pay', 'Lit Multiplier Tiles under a cluster multiply its win'),
	};
};

export type Box = { x: number; y: number; width: number; height: number };
export type Placed = { x: number; y: number; side: 'right' | 'left' | 'above' | 'below' };

/**
 * WHERE THE POPUP GOES (CSS px): beside the tapped cell, on the side towards the board's middle first, then the other
 * side, then above, then below; the first that fits inside the board's opening without covering the cell, else the
 * first that fits the screen, else the first clamped onto the screen. `edge` is the margin kept from either box's
 * edge, `gap` the space between the popup and the cell.
 */
export const placePopup = (cell: Box, w: number, h: number, board: Box, screen: Box, gap: number, edge: number): Placed => {
	const cx = cell.x + cell.width / 2;
	const cy = cell.y + cell.height / 2;
	const boardMid = board.x + board.width / 2;
	const sides: Placed['side'][] = cx <= boardMid ? ['right', 'left', 'above', 'below'] : ['left', 'right', 'above', 'below'];
	if (cy < board.y + board.height / 2) [sides[2], sides[3]] = ['below', 'above'];
	const clamp = (v: number, lo: number, hi: number) => (hi < lo ? lo : Math.min(hi, Math.max(lo, v)));
	const at = (side: Placed['side'], b: Box): Placed => {
		const lo = { x: b.x + edge, y: b.y + edge };
		const hi = { x: b.x + b.width - edge - w, y: b.y + b.height - edge - h };
		if (side === 'right') return { side, x: cell.x + cell.width + gap, y: clamp(cy - h / 2, lo.y, hi.y) };
		if (side === 'left') return { side, x: cell.x - gap - w, y: clamp(cy - h / 2, lo.y, hi.y) };
		if (side === 'above') return { side, x: clamp(cx - w / 2, lo.x, hi.x), y: cell.y - gap - h };
		return { side, x: clamp(cx - w / 2, lo.x, hi.x), y: cell.y + cell.height + gap };
	};
	const inside = (p: Placed, b: Box) => p.x >= b.x + edge - 0.5 && p.y >= b.y + edge - 0.5 && p.x + w <= b.x + b.width - edge + 0.5 && p.y + h <= b.y + b.height - edge + 0.5;
	for (const b of [board, screen]) {
		for (const side of sides) {
			const p = at(side, b);
			if (inside(p, b)) return p;
		}
	}
	const p = at(sides[0], screen);
	return { side: p.side, x: clamp(p.x, screen.x + edge, screen.x + screen.width - edge - w), y: clamp(p.y, screen.y + edge, screen.y + screen.height - edge - h) };
};
