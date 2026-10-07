// THE BOARD ART REGISTRATION: where the frame render (board_v4e, 2048 x 1863) and its chains land in
// master units for a layout. The lattice's outer bar axes (BOARD_ART.lattice, render px) enclose the
// 8x8 cell area, so one uniform scale maps that rectangle onto the layout's cell area (FRAME minus its
// inset). The render is tilted (v4e, 4 degrees down through a mild perspective lens), so the width is
// measured at the lattice's MID-HEIGHT; the lattice is about 3 percent wider than tall while the cell
// area is square, so the scale fits the WIDTH and the art is centred vertically: `mismatch` is the
// cell-area height the lattice does NOT cover (split evenly above and below). The math itself lives in
// layoutSpec.registrationOf, which frameArtRect shares.
//
// Everything here is plain arithmetic on layoutSpec.frameFor(), so the portrait growth (frameFor's k)
// and an orientation flip re-register the art with no cached state.
import { frameFor, registrationOf, type LayoutKind } from './layoutSpec';

export type BoardRegistration = ReturnType<typeof registrationOf> & {
	/** the backing rectangle: the cell area plus the inset (the frame's inner opening), master units */
	opening: { x: number; y: number; width: number; height: number };
};

export const boardRegistration = (kind: LayoutKind, viewportMasterWidth?: number): BoardRegistration => {
	const f = frameFor(kind, viewportMasterWidth);
	return { ...registrationOf(f), opening: { x: f.x, y: f.y, width: f.width, height: f.height } };
};

/** bow(s) = sin(pi s) (1 - s) + bottom s: 0 at the top pivot (and above it), the peak at s ~0.36,
 *  `bottom` at the bottom anchor (CHAIN_BOW) */
export const chainBow = (s: number, bottom: number) => {
	if (s <= 0) return 0;
	const t = Math.min(s, 1);
	return Math.sin(Math.PI * t) * (1 - t) + bottom * t;
};
