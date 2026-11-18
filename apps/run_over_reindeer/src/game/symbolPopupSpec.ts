// THE SYMBOL PAY POPUP's numbers (Corey 2026-11-17: "we need the ability to click on tiles to show their value/payouts
// during idle, the same way it's set up for manticore mayhem"). Carried over from Manticore Mayhem's
// game/symbolPopupSpec.ts (its timing, its pop, its placement margins, its first tap window); the sizes are this game's
// (five reels of four lanes: far bigger cells than Manticore's eight by eight). Read by components/SymbolPopup.svelte
// and game/symbolPopup.ts only. A file of its own (not constants.ts) so the branches that edit constants.ts never meet
// this one.
//
// Sizes are CSS px at k = 1, where k follows the tapped cell's height on screen (cell height / refCellCss), clamped to
// [minK, maxK]; every text size then has its own floor so a phone never goes under it.
export const SYMBOL_POPUP = {
	/** the popup closes by itself after this long with no other action (Manticore's) */
	timeoutMs: 4000,
	/** fade and pop in / fade out (opacity and a small scale only; Manticore's) */
	inMs: 140,
	outMs: 110,
	/** the pop's starting scale */
	popFrom: 0.94,
	/** the cell height on screen that k = 1 is drawn for, and the clamp on k */
	refCellCss: 120,
	minK: 0.86,
	maxK: 1.2,
	/** the panel: a green guide sign (the Fast Lane plate's palette, ui/FeatureMenu.svelte) */
	width: 236,
	pad: 12,
	radius: 10,
	/** the sign's white border */
	border: 3,
	/** the symbol's picture beside its name */
	tile: 52,
	/** text sizes and their floors (CSS px) */
	nameFont: 17,
	nameFloor: 14.5,
	kindFont: 11,
	kindFloor: 10.5,
	rowFont: 16,
	rowFloor: 14,
	headFont: 10.5,
	headFloor: 10,
	/** a special symbol's line, and the muted note under it */
	lineFont: 13.5,
	lineFloor: 12.5,
	noteFont: 11.5,
	noteFloor: 11,
	/** a pay row's line box, in ems */
	rowLine: 1.45,
	/** the gap between the popup and the tapped cell, and the margin it keeps from the board / screen edge */
	gapCss: 8,
	edgeCss: 6,
	/** a standing column with no room clear of it at those margins (components/SymbolPopup.svelte): tried again with
	 *  these before the popup settles for keeping clear of the tapped cell only (2026-11-17, the 390 x 620 phone) */
	tight: { gapCss: 4, edgeCss: 2 },
	/** the rim on the tapped cell (or the standing column): its stroke and glow (CSS px), how far it sits inside the box */
	rim: { stroke: 3, glow: 10, inset: 3, radius: 10 },
} as const;

/** THE FIRST TAP (Manticore's FIRST_TAP, its harsh review of 2026-10-20 gameplay 10; 2000 ms since 2026-10-21): a tap on
 *  the board within this long of PRESS ANYWHERE opens no popup (a fast tapper's presses through the press screen) */
export const FIRST_TAP = { ignoreMs: 2000 };

/** THE COLUMN CHARACTERS' PICTURES: a square crop of each one's head and shoulders from the landing board's still sheet
 *  (columns/landing-stills.webp, its full tier, game/columnClipSpec.ts COLUMN_CLIPS.landing; sheet px). The sheet is
 *  already in the build and in the browser's cache; no new art. */
export const COLUMN_FACES = {
	reindeer: { x: 262, y: 6, size: 286 },
	santa: { x: 572, y: 0, size: 300 },
	grandma: { x: 900, y: 0, size: 296 },
} as const;
