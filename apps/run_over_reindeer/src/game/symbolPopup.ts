// THE SYMBOL PAY POPUP: the parts that need no component (Corey 2026-11-17: "we need the ability to click on tiles to
// show their value/payouts during idle, the same way it's set up for manticore mayhem"). components/SymbolPopup.svelte
// draws it and owns its state; this file has the hook the board's tap calls, the board's answers about its cells, what
// the popup says, and where it goes. Carried over from Manticore Mayhem's game/symbolPopup.ts (the hook, the placement,
// the shape of the content); the content is this game's: line pays for 3, 4 and 5 in a row, and the Wilds' and the
// Present's own sentences from Game Info (game/gameInfoText.ts).
//
// PRESENTATION ONLY. The amounts are the paytable's multipliers times the current play amount in the HUD's currency
// formatter, in a social session too (its GC / SC amounts, as Manticore's popup shows them; Corey 2026-11-17).
// Nothing here reads, computes or changes an outcome.
import config from './config';
import { soc } from './social';
import { gameInfoText } from './gameInfoText';
import type { ColumnTier } from './typesBookEvent';

export type Box = { x: number; y: number; width: number; height: number };

/** components/Board.svelte calls `tap` with every tap or click on the board's tap area (Pixi global units, which are
 *  the canvas's CSS px). components/SymbolPopup.svelte sets it while mounted; until then a tap goes nowhere. It decides
 *  for itself whether the board is idle. */
export const symbolPopupHook = {
	tap: (_globalX: number, _globalY: number): void => {},
};

export type PayingCode = (typeof config.payOrder)[number];
/** what a cell shows: a paying symbol, the sleigh (W), the Present (S), a Grandma crash Wild's cloud (GW), or a standing
 *  column Wild by its character */
export type PopupCode = PayingCode | 'W' | 'S' | 'GW' | `CW_${ColumnTier}`;

/** THE BOARD'S ANSWERS (components/Board.svelte sets these from the road board; Pixi global units). Until the board is
 *  mounted every answer is "nothing". */
export const symbolPopupBoard = {
	/** the reel and lane under a global point, or null off the board */
	cellAt: (_x: number, _y: number): { reel: number; row: number } | null => null,
	/** what a cell shows now (a standing column covers its reel's four cells), or null (nothing parked there) */
	what: (_reel: number, _row: number): PopupCode | null => null,
	/** a cell's box, a reel's whole box (a standing column's), the board's box */
	cellBox: (_reel: number, _row: number): Box | null => null,
	reelBox: (_reel: number): Box | null => null,
	boardBox: (): Box | null => null,
	/** Reindeer's additions to the idle rule (game/boardIdle.ts): every car parked, the LED back board down */
	quiet: (): boolean => false,
};

const PAYING = new Set<string>(config.payOrder);
export const isPaying = (code: string): code is PayingCode => PAYING.has(code);

export type PopupRow = { k: string; v: string; top?: boolean };
export type PopupContent = {
	code: PopupCode;
	name: string;
	/** the line under the name: Game Info's tier word, or what kind of special symbol it is */
	kind: string;
	/** the two column heads over the pay rows, or null (the specials have lines instead) */
	head: [string, string] | null;
	rows: PopupRow[];
	/** the specials' sentences (Game Info's own; `**text**` marks bold runs, as there) */
	lines: string[];
	/** the small muted line at the foot, or null */
	note: string | null;
};

/** Game Info's tier words (ui/GameInfoModal.svelte: Premium, High, Low) */
const TIER: Record<string, string> = { PREMIUM: 'Premium', HIGH: 'High', LOW: 'Low' };

/** the column characters by tier, as Game Info names them (gameInfoText howTo "Column Wilds") */
export const COLUMN_NAMES: Record<ColumnTier, string> = { reindeer: 'Reindeer', santa: 'Santa', grandma: 'Grandma' };

const T = gameInfoText();
/** the sentences of one Game Info paragraph */
const sentences = (text: string): string[] => text.match(/.+?[.!?](?:\*\*)?(?=\s|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
const plain = (s: string) => s.replace(/\*\*/g, '');
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** the "Reindeer strikes." paragraph's sentence that names `what` (Grandma's Car, Santa's Sleigh). Its subject there is
 *  "it" (the reindeer of the sentence before): said by name here, where that sentence is not. */
const strikeSentence = (what: string): string | null => {
	const s = sentences(T.howTo[1]).find((x) => plain(x).startsWith(`If it hits ${what}`));
	return s ? s.replace(/^If it hits/, 'If the reindeer hits') : null;
};
/** the "Column Wilds." paragraph: the clause about one character ("Santa is in the middle (10x to 20x)"), and its
 *  closing sentence (how long a column lasts in the base game) */
const columnParagraph = sentences(T.howTo[2]);
const columnClause = (tier: ColumnTier): string | null => {
	const who = columnParagraph.find((s) => s.includes(':'));
	if (!who) return null;
	const list = who.slice(who.indexOf(':') + 1).replace(/\.$/, '');
	const name = COLUMN_NAMES[tier];
	const clause = list
		.split(/,\s+(?:and\s+)?|\s+and\s+/)
		.map((c) => c.trim())
		.find((c) => new RegExp(`^(the\\s+)?${name}\\b`).test(c));
	return clause ? `${capital(clause)}.` : null;
};
const columnLasts = columnParagraph.find((s) => /^In the base game/.test(s)) ?? null;

/** the Wild's line: Game Info's own (gameInfoText paytable.wild) */
export const wildLines = (): string[] => [T.paytable.wild];
/** the Present's lines: Game Info's first two sentences (what it is, what 3 and 4 or more award) */
export const scatterLines = (): string[] => sentences(T.paytable.scatter).slice(0, 2);
/** the Grandma crash Wild: the strike sentence about Grandma's Car */
export const grandmaWildLines = (): string[] => [strikeSentence("Grandma's Car")].filter((s): s is string => !!s);
/** a column Wild: the strike sentence about Santa's Sleigh, and its character's clause */
export const columnLines = (tier: ColumnTier): string[] => [strikeSentence("Santa's Sleigh"), columnClause(tier)].filter((s): s is string => !!s);

/**
 * What the popup says for one cell. `amount(x)`: x times the current play amount in the HUD's formatter (the caller
 * passes it; components/SymbolPopup.svelte payText).
 */
export const popupContent = (code: PopupCode, amount: (x: number) => string): PopupContent => {
	if (code.startsWith('CW_')) {
		const tier = code.slice(3) as ColumnTier;
		return { code, name: COLUMN_NAMES[tier], kind: 'Column Wild', head: null, rows: [], lines: columnLines(tier), note: columnLasts };
	}
	if (code === 'GW') return { code, name: config.symbols.GW.name, kind: 'Wild', head: null, rows: [], lines: grandmaWildLines(), note: null };
	if (code === 'W') return { code, name: config.symbols.W.name, kind: 'Wild', head: null, rows: [], lines: wildLines(), note: null };
	if (code === 'S') return { code, name: config.symbols.S.name, kind: 'Scatter', head: null, rows: [], lines: scatterLines(), note: null };
	const sym = config.symbols[code as PayingCode];
	const pays = (sym.paytable ?? []) as readonly number[];
	const last = config.payKinds.length - 1;
	return {
		code,
		name: sym.name,
		kind: TIER[sym.tier] ?? '',
		head: ['IN A ROW', soc('PAYS', 'WINS')],
		// 3, 4, 5 in a row, as Game Info lists them; the best (5) in the accent
		rows: config.payKinds.map((n, i) => ({ k: T.paytable.kinds[n] ?? String(n), v: amount(pays[i] ?? 0), top: i === last })),
		lines: [],
		note: null,
	};
};

export type Placed = { x: number; y: number; side: 'right' | 'left' | 'above' | 'below' };

/**
 * WHERE THE POPUP GOES (CSS px; Manticore's placePopup, unchanged): beside the tapped cell, on the side towards the
 * board's middle first, then the other side, then above, then below; the first that fits inside the board without
 * covering the cell, else the first that fits the screen, else the first clamped onto the screen. `edge` is the margin
 * kept from either box's edge, `gap` the space between the popup and the cell.
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
