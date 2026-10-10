// WHERE THE LOGO SITS: one rule per layout, in master units, for the box of the logo's ART (the still's own
// box, wing tip to wing tip). The HTML chrome sizes its <img> to this box (ui/Chrome*.svelte) and the canvas
// logo maps the same art box of its frame onto it (components/Logo.svelte), so the two are the same picture
// in the same place. Numbers in constants LOGO.
import { LOGO } from '../constants';
import { frameArtRect, HUD, MASTER, type LayoutKind } from '../layoutSpec';

export type LogoRect = { x: number; y: number; width: number; height: number };

const ASPECT = LOGO.art.width / LOGO.art.height;

/**
 * The art box for a layout. `viewportMasterWidth` (portrait: the real viewport's width in master units, the
 * frame grows with it) and `compact` (portrait, in a feature: the SKIP TO RESULT plate has the lower band).
 * Portrait x is relative to the 412 master; the chrome centres the box on its own (wider) fit frame instead.
 */
export const logoArtRect = (kind: LayoutKind, viewportMasterWidth?: number, compact = false): LogoRect => {
	if (kind === 'landscape') {
		const { cx, cy, width } = LOGO.landscape;
		const height = width / ASPECT;
		return { x: cx - width / 2, y: cy - height / 2, width, height };
	}
	if (kind === 'phone') {
		const { left, top, width } = LOGO.phone;
		return { x: left, y: top, width, height: width / ASPECT };
	}
	const P = LOGO.portrait;
	const floor = compact ? HUD.portrait.skipButton.y - P.compactGap : frameArtRect('portrait', viewportMasterWidth).y - P.gapAbove;
	const band = Math.max(floor - P.top, 1);
	const width = Math.min(P.maxWidth, band * ASPECT);
	const height = width / ASPECT;
	return { x: (MASTER.portrait.width - width) / 2, y: P.top + (band - height) / 2, width, height };
};

/** the canvas logo's frame for an art box: where the frame's origin goes and master units per ship px */
export const logoFramePlacement = (art: readonly number[], rect: LogoRect) => {
	const scale = rect.width / art[2];
	return { x: rect.x - art[0] * scale, y: rect.y - art[1] * scale, scale };
};
