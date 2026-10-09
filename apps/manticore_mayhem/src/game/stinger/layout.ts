// WHERE THE PLAQUE SITS, in master units, derived from the board frame (game/layoutSpec.ts) so it follows
// the board through every layout, the portrait growth and a rotation.
//
//   centre   the PANEL's centre (the slab the text is set on) sits on the grid centre. The panel is below the
//            frame's middle, so the 946 x 532 frame rides a little above the grid centre.
//   size     the frame is as wide as BOTH limits allow:
//              width    desktop: the plaque ART (its bind pose box, 900 of the frame's 946 px) runs exactly
//                       between the chains (layoutSpec.chainClearSpan), about 493 master px, frame 518.
//                       portrait: the frame spans the screen width.
//                       phone sideways: the plaque ART runs exactly between the HTML HUD's two side columns
//                       (layoutSpec.hudClearSpan: 800 master px, frame 840.9 x 472.9), so the logo, the
//                       readouts and the buttons never draw over a lion (Corey 2026-10-08; it was sized to
//                       the grid height, 1124.7 wide, under both columns).
//              height   the 532 px frame fits inside the grid (cell area) height. No layout hits it today.
// The plaque is never clipped to its frame: wing tips and embers leave it.
import { boardCenterX, chainClearSpan, frameFor, hudClearSpan, MASTER, type LayoutKind } from '../layoutSpec';
import type { StingerJson } from './types';

export type PlaquePlacement = {
	/** the panel centre in master units */
	x: number;
	y: number;
	/** master units per ship px */
	scale: number;
	/** which limit set the size */
	limit: 'chains' | 'hud' | 'screen' | 'grid';
};

export const plaquePlacement = (json: StingerJson, kind: LayoutKind, viewportMasterWidth?: number): PlaquePlacement => {
	const f = frameFor(kind, viewportMasterWidth);
	const [fw, fh] = json.frame;
	const grid = f.width - 2 * f.inset;
	const artWidth = json.art[2] - json.art[0];
	const hud = hudClearSpan(kind);
	const span = kind === 'landscape' ? chainClearSpan(kind, viewportMasterWidth) : hud ? hud.width : null;
	const byWidth = span === null ? (viewportMasterWidth ?? MASTER[kind].width) : (span * fw) / artWidth;
	const byHeight = (grid * fw) / fh;
	return {
		x: boardCenterX(kind, viewportMasterWidth),
		y: f.y + f.inset + grid / 2,
		scale: Math.min(byWidth, byHeight) / fw,
		limit: byWidth <= byHeight ? (kind === 'landscape' ? 'chains' : hud ? 'hud' : 'screen') : 'grid',
	};
};
