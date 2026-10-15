// THE TRUE OPENINGS (Corey 2026-10-13 12:06, Symbol Fit Playground v7: "placement true openings").
//
// The engine steps its tiles on a uniform grid (cell + gap), but the lattice's bars are the frame ART, a 4 degree
// perspective render: the bar pitch is gap / 8 smaller than the tile pitch and the side bars lean in (keystone), so
// the outer cells' symbols sat up to 2.1 master px off their openings (images/symbol_fit_r1/NOTES.md). Here every
// cell's opening comes from its four BOARD_ART.crossings (render px), mapped through the layout's registration into
// BOARD units (the board container's own space: a tile centre is ((reel + 0.5) x SYMBOL_SIZE, (row + 0.5) x SYMBOL_SIZE)).
//   centre: the middle of the four crossings, where the symbol sits
//   box:    bar centre line to bar centre line (the crossing quad's mean edges), the whole-cell multiplier tile
// Plain arithmetic on layoutSpec, recomputed only when the layout (or the portrait growth) changes. The Cell model,
// the engine and every probe hook keep their logical grid: this is the DRAW step only.
import { BOARD_ART } from './boardArtSpec';
import { boardPlacement, frameFor, registrationOf, type LayoutKind } from './layoutSpec';
import { BOARD_SIZES, GRID, SYMBOL_SIZE } from './constants';

export type Openings = {
	kind: LayoutKind;
	vw: number | undefined;
	/** per cell (reel * 8 + row): the opening centre less the uniform tile centre, board units */
	ox: Float64Array;
	oy: Float64Array;
	/** per cell: the whole-cell box (bar centre lines), board units: x0, y0, x1, y1 */
	box: Float64Array;
	/** the bar's width in board units (2 x barRadius through the registration) */
	bar: number;
};

export const openingsFor = (kind: LayoutKind, vw?: number): Openings => {
	const f = frameFor(kind, vw);
	const reg = registrationOf(f);
	const pl = boardPlacement(kind, vw);
	const px = BOARD_SIZES.width / 2;
	const py = BOARD_SIZES.height / 2;
	/** render px -> board units */
	const toBoard = (u: number, v: number) => {
		const m = reg.map(u, v);
		return { x: (m.x - pl.x) / pl.scale + px, y: (m.y - pl.y) / pl.scale + py };
	};
	const C = BOARD_ART.crossings;
	const ox = new Float64Array(GRID * GRID);
	const oy = new Float64Array(GRID * GRID);
	const box = new Float64Array(GRID * GRID * 4);
	for (let reel = 0; reel < GRID; reel += 1) {
		for (let row = 0; row < GRID; row += 1) {
			const tl = toBoard(C[row][reel][0], C[row][reel][1]);
			const tr = toBoard(C[row][reel + 1][0], C[row][reel + 1][1]);
			const bl = toBoard(C[row + 1][reel][0], C[row + 1][reel][1]);
			const br = toBoard(C[row + 1][reel + 1][0], C[row + 1][reel + 1][1]);
			const i = reel * GRID + row;
			const x0 = (tl.x + bl.x) / 2;
			const x1 = (tr.x + br.x) / 2;
			const y0 = (tl.y + tr.y) / 2;
			const y1 = (bl.y + br.y) / 2;
			box.set([x0, y0, x1, y1], i * 4);
			ox[i] = (tl.x + tr.x + bl.x + br.x) / 4 - (reel + 0.5) * SYMBOL_SIZE;
			oy[i] = (tl.y + tr.y + bl.y + br.y) / 4 - (row + 0.5) * SYMBOL_SIZE;
		}
	}
	return { kind, vw, ox, oy, box, bar: (2 * BOARD_ART.bars.barRadius * reg.m) / pl.scale };
};

/** THE LATTICE'S OUTER EDGES in board units (y), this layout's own registration: the top and bottom outer bars of
 *  BOARD_ART.lattice at their inner face (`opening`, the window's clear edge), their centre line (`centre`) and their
 *  outer face (`outer`: where the black lattice ends and the bronze rail begins). The frame's art is registered with
 *  a uniform scale, so a horizontal render line stays horizontal: read at the lattice's mid x. BoardCells' cut lines
 *  (FALL_CUT) come from here. */
export type LatticeEdge = 'opening' | 'centre' | 'outer';
export const latticeEdges = (kind: LayoutKind, vw?: number): { top: Record<LatticeEdge, number>; bottom: Record<LatticeEdge, number> } => {
	const reg = registrationOf(frameFor(kind, vw));
	const pl = boardPlacement(kind, vw);
	const L = BOARD_ART.lattice;
	const r = BOARD_ART.bars.barRadius;
	const xm = (L.x0 + L.x1) / 2;
	const y = (v: number) => (reg.map(xm, v).y - pl.y) / pl.scale + BOARD_SIZES.height / 2;
	return {
		top: { opening: y(L.y0 + r), centre: y(L.y0), outer: y(L.y0 - r) },
		bottom: { opening: y(L.y1 - r), centre: y(L.y1), outer: y(L.y1 + r) },
	};
};

/** the draw offset of a tile in column `reel` at the (fractional, possibly off-board) row-space y: the openings of
 *  the two rows it is between, interpolated; above row 0 / below row 7 it keeps that row's offset. Written into
 *  `out` (no allocation). */
export const offsetAt = (o: Openings, reel: number, y: number, out: { x: number; y: number }) => {
	const r = reel < 0 ? 0 : reel > GRID - 1 ? GRID - 1 : reel;
	if (y <= 0 || y >= GRID - 1) {
		const k = r * GRID + (y <= 0 ? 0 : GRID - 1);
		out.x = o.ox[k];
		out.y = o.oy[k];
		return out;
	}
	const a = Math.floor(y);
	const t = y - a;
	const k = r * GRID + a;
	out.x = o.ox[k] + (o.ox[k + 1] - o.ox[k]) * t;
	out.y = o.oy[k] + (o.oy[k + 1] - o.oy[k]) * t;
	return out;
};
