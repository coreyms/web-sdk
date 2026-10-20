// THE PLAQUE'S ONE PERSPECTIVE (Corey 2026-10-20: "we should be using this perspective for all text on the plaque";
// images/plaque_r6_storyboard/STORYBOARD.md section 2). Every layer on the spin amount plaque (the figures, the cluster
// rows, the spin total, the explainer marquee, the desktop press prompt, the War Standard flag row and its badge) goes
// through ONE homography per layout: the plaque FACE, a flat rectangle W x faceH face units, onto the dark field's four
// inner corners (PLAQUE_TIPS.edges, art px, through the layout's drawn plaque box, render px). So every vertical on
// the plaque runs to the field's own vanishing point, as the field's slanted gold edges do.
//
// The face's height is the one free choice of such a mapping; it is taken from the plaque's own 35 degree lean
// (images/anticipation_r2 r5): the face's mean vertical scale is cos(tilt) of its mean horizontal scale.
//
// The plaque's layers keep their own LAYOUT UNITS (boardPlaqueSpec figureBlock: the figure row 638 x 64 of them centred
// on (0, -1.25)); one scale `k` takes them to face units, chosen so a glyph at the plaque's centre keeps the on-screen
// height it had through the spec's halved-lean homography (H_halved). So every size that was tuned on screen (the
// explainer lines, the prompt, the numerals) stays the same size where it matters, and only the lean changes.
//
// Pure numbers: no Pixi, no state. Returns the 8 numbers BoardPlaque.svelte's `through()` reads (layout units to
// render px, h8 = 1), like the spec's own H tables.
import { PLAQUE_FIELD } from './constants';
import type { PlaqueEdgeArt } from './plaqueTips';

export type PlaqueFieldMap = {
	/** layout units -> render px, 8 numbers (h8 = 1) */
	H: number[];
	/** layout units -> face units */
	k: number;
	/** the face's width in face units (its height is PLAQUE_FIELD.faceH) */
	faceW: number;
	/** the dark field's four corners in render px: TL, TR, BR, BL */
	quad: [number, number][];
	/** the layout point that maps to the face's centre */
	centreY: number;
};

/** solve the 8 unknowns of the homography taking 4 points `src` onto 4 points `dst` (h8 = 1) */
export const homography8 = (src: readonly (readonly [number, number])[], dst: readonly (readonly [number, number])[]): number[] => {
	const A: number[][] = [];
	for (let i = 0; i < 4; i += 1) {
		const [x, y] = src[i];
		const [X, Y] = dst[i];
		A.push([x, y, 1, 0, 0, 0, -X * x, -X * y, X]);
		A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y, Y]);
	}
	// Gaussian elimination with partial pivoting on the 8 x 9 augmented matrix
	for (let c = 0; c < 8; c += 1) {
		let p = c;
		for (let r = c + 1; r < 8; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
		[A[c], A[p]] = [A[p], A[c]];
		for (let r = 0; r < 8; r += 1) {
			if (r === c) continue;
			const f = A[r][c] / A[c][c];
			for (let k = c; k < 9; k += 1) A[r][k] -= f * A[c][k];
		}
	}
	return A.map((row, i) => row[8] / row[i]);
};

/** a point through an 8-number homography */
export const applyH = (H: readonly number[], x: number, y: number): [number, number] => {
	const w = H[6] * x + H[7] * y + 1;
	return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
};

/** THE FIELD MAP of one layout. `art`: the plaque art's inner edges (PLAQUE_TIPS.edges); `plaqueBox`: where the art is
 *  drawn, render px [x, y, w, h] (boardPlaqueSpec render.plaqueBox); `Hhalved`: the spec's halved-lean homography, only
 *  to size `k` (layout units keep their on-screen height at the centre) */
export const plaqueField = (art: PlaqueEdgeArt, plaqueBox: readonly number[], Hhalved: readonly number[]): PlaqueFieldMap => {
	const toRender = (ax: number, ay: number): [number, number] => [plaqueBox[0] + (ax / art.tex[0]) * plaqueBox[2], plaqueBox[1] + (ay / art.tex[1]) * plaqueBox[3]];
	const quad: [number, number][] = [toRender(art.left[0], art.top), toRender(art.right[0], art.top), toRender(art.right[1], art.bottom), toRender(art.left[1], art.bottom)];
	const [tl, tr, br, bl] = quad;
	const wt = tr[0] - tl[0];
	const wb = br[0] - bl[0];
	const h = bl[1] - tl[1];
	const faceH = PLAQUE_FIELD.faceH;
	// the face's true height in bottom-edge px: its mean vertical scale is cos(tilt) of its mean horizontal scale
	const hTrue = h / (Math.cos((PLAQUE_FIELD.tiltDeg * Math.PI) / 180) * ((wt + wb) / 2 / wb));
	const faceW = (faceH * wb) / hTrue;
	const face: [number, number][] = [
		[-faceW / 2, -faceH / 2],
		[faceW / 2, -faceH / 2],
		[faceW / 2, faceH / 2],
		[-faceW / 2, faceH / 2],
	];
	const Hf = homography8(face, quad);
	// k: render px per layout unit down the plaque's centre through H_halved, over render px per face unit through Hf
	const centreY = PLAQUE_FIELD.layoutCentreY;
	const dHalved = applyH(Hhalved, 0, centreY + 1)[1] - applyH(Hhalved, 0, centreY - 1)[1];
	const dFace = applyH(Hf, 0, 1)[1] - applyH(Hf, 0, -1)[1];
	const k = dHalved / dFace;
	// layout (x, y) -> face (k x, k (y - centreY)) -> render
	const layout: [number, number][] = face.map(([u, v]) => [u / k, v / k + centreY]);
	return { H: homography8(layout, quad), k, faceW, quad, centreY };
};
