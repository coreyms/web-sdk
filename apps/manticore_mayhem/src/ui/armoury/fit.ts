// THE ARMOURY'S FIT RULES (spec 6.4): thin wrappers over game/textFit.ts. Reusable: no game names; the floors and
// pads come in as arguments (constants.ts ARMOURY.fit), the face too (the menu's display face). Node runs it with a
// measure of its own (tools/manticore/armoury_parts_check.mjs).
//
// Tiles always show the multiple, so the long amount problem is on the plate and the confirm card only. Every
// amount is the FULL string (no K, M, B, T: Stake review 2026-09-20): it is shrunk to fit, never cut. Boxes are read
// with bind:clientWidth, which gives layout px, which are design px here (the menu is scaled by a transform). Run the
// fits again when the fonts finish loading, when the bet changes and when the layout changes. Never per frame.
import { fitFont, measureFitText } from '../../game/textFit';

/** width of `text` at `px` (the default is textFit's canvas measure: digits as '0', the tabular bound) */
export type Measure = (text: string, px: number) => number;

/** the face the text is drawn in; letterSpacing in em (CSS letter-spacing: 0.16em is 0.16) */
export type FitFace = { face: string; weight: number; letterSpacing?: number };
const measurer = (f: FitFace): Measure => (text, px) => measureFitText(text, px, f.weight, (f.letterSpacing ?? 0) * px, f.face);

export type PriceRules = { floor: number; floorTouch: number; floorStacked: number; pad: number; padTouch: number };
export type TileRules = { floor: number; floorTouch: number; pad: number; padTouch: number; padTwoWide: number };
export type ConfirmRules = { total: number; row: number; totalTouch: number; rowTouch: number; gap: number };

/** the size to draw `text` at in `room`: nominal if it fits, else shrunk, never under `floor`; `fits` says whether it
 *  really fits at that size */
export const fitIn = (text: string, nominal: number, room: number, floor: number, measure: Measure): { size: number; fits: boolean } => {
	if (!text || room <= 0) return { size: floor, fits: false };
	const at = measure(text, nominal);
	if (at <= room) return { size: nominal, fits: true };
	// textFit's own shrink (one decimal, floored), with the measure passed through
	const size = Math.max(floor, Math.floor(nominal * (room / at) * 10) / 10);
	return { size, fits: measure(text, size) <= room + 0.01 };
};

/**
 * The plate's price. Room: the plaque less `pad` (desktop) or `padTouch`. Floor 18 desktop, 15 on touch. On the touch
 * layouts only, a price that still does not fit at its floor takes the whole row and the button goes under it
 * (`stacked`), floor 13, room the whole row less padTouch; the hero gives up the height.
 */
export const fitPrice = (
	o: { text: string; nominal: number; plaqueW: number; rowW: number; touch: boolean; rules: PriceRules; face?: FitFace },
	measure: Measure = measurer(o.face ?? { face: "'Cinzel', 'Outfit', serif", weight: 700 }),
): { size: number; stacked: boolean; fits: boolean } => {
	const R = o.rules;
	const first = fitIn(o.text, o.nominal, o.plaqueW - (o.touch ? R.padTouch : R.pad), o.touch ? R.floorTouch : R.floor, measure);
	if (first.fits || !o.touch) return { ...first, stacked: false };
	const stacked = fitIn(o.text, o.nominal, o.rowW - R.padTouch, R.floorStacked, measure);
	return { ...stacked, stacked: true };
};

/** a tile's multiple ("500x", "3x / spin"). Room: the tile less pad (desktop), padTouch, or padTwoWide (the phone's
 *  two wide PER SPIN tiles, picture beside the text). Cannot overflow with a multiple; kept in case the RGS reprices */
export const fitTileMultiple = (
	o: { text: string; nominal: number; tileW: number; kind: 'desktop' | 'touch' | 'twoWide'; rules: TileRules; face?: FitFace },
	measure: Measure = measurer(o.face ?? { face: "'Cinzel', 'Outfit', serif", weight: 700 }),
): { size: number; fits: boolean } => {
	const R = o.rules;
	const pad = o.kind === 'desktop' ? R.pad : o.kind === 'twoWide' ? R.padTwoWide : R.padTouch;
	return fitIn(o.text, o.nominal, o.tileW - pad, o.kind === 'desktop' ? R.floor : R.floorTouch, measure);
};

/** an amount in a confirm row. Room: the row less its label less `gap`. Floors: the TOTAL row 16 desktop / 13 touch,
 *  the others 13 / 11. The floor holds; `fits` false is an overflow (the probe fails it) */
export const fitConfirmAmount = (
	o: { text: string; nominal: number; rowW: number; labelW: number; total: boolean; touch: boolean; rules: ConfirmRules; face?: FitFace },
	measure: Measure = measurer(o.face ?? { face: "'Cinzel', 'Outfit', serif", weight: 700 }),
): { size: number; fits: boolean } => {
	const R = o.rules;
	const floor = o.total ? (o.touch ? R.totalTouch : R.total) : o.touch ? R.rowTouch : R.row;
	return fitIn(o.text, o.nominal, o.rowW - o.labelW - R.gap, floor, measure);
};

/** textFit's own shrink-then-hide, for anything else the menu fits (the same function the HUD uses) */
export { fitFont };
