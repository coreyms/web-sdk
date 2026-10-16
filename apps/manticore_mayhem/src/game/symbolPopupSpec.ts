// THE SYMBOL PAY POPUP's numbers (Corey 2026-10-16 15:32: "clicking on a symbol or touching it on an idle board shows
// a popup of its pay values ... goes away on any other player action, clicking another tile, or UI button, or just
// times out after a few seconds"). Read by components/SymbolPopup.svelte and game/symbolPopup.ts only. A file of its
// own (not constants.ts) so the board and layout branches that edit constants.ts never meet this one.
//
// Sizes are CSS px at k = 1, where k follows the tapped cell's size on screen (cellCss / refCellCss), clamped to
// [minK, maxK]; every text size then has its own floor so a phone never goes under it.
export const SYMBOL_POPUP = {
	/** the popup closes by itself after this long with no other action */
	timeoutMs: 4000,
	/** fade and pop in / fade out (opacity and a small scale only) */
	inMs: 140,
	outMs: 110,
	/** the pop's starting scale */
	popFrom: 0.94,
	/** the cell size on screen that k = 1 is drawn for, and the clamp on k */
	refCellCss: 60,
	minK: 0.8,
	maxK: 1.25,
	/** the panel */
	width: 212,
	pad: 11,
	radius: 9,
	/** the bronze bezel's band (the SKIP prompt's inset bezel, components/SkipButton.svelte .ask) */
	bezel: 2,
	/** the symbol's static tile beside its name */
	tile: 46,
	/** text sizes and their floors (CSS px) */
	nameFont: 15,
	nameFloor: 13,
	kindFont: 11,
	kindFloor: 10.5,
	rowFont: 14,
	rowFloor: 12.5,
	headFont: 10.5,
	headFloor: 10,
	/** a band row's line box, in ems */
	rowLine: 1.5,
	/** the gap between the popup and the tapped cell, and the margin it keeps from the board / screen edge */
	gapCss: 8,
	edgeCss: 6,
	/** the soft rim on the tapped cell: its stroke and glow (CSS px) and how far it sits inside the cell's box */
	rim: { stroke: 2, glow: 10, inset: 1, radius: 7 },
} as const;
