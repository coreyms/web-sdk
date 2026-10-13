// WHERE THE LOGO SITS: one rule per layout, in master units, for the box of the logo's ART (the still's own
// box, wing tip to wing tip). The HTML chrome sizes its <img> to this box (ui/Chrome*.svelte) and the canvas
// logo maps the same art box of its frame onto it (components/Logo.svelte), so the two are the same picture
// in the same place. Numbers in constants LOGO.
import { LOGO } from '../constants';
import { frameArtRect, MASTER, SKIP, type LayoutKind } from '../layoutSpec';

export type LogoRect = { x: number; y: number; width: number; height: number };

const ASPECT = LOGO.art.width / LOGO.art.height;

/**
 * The art box for a layout. Portrait: `viewportMasterWidth` is the real viewport's width in master units (the frame
 * grows with it) and `phone` says the screen is a phone (layoutSpec isPhoneSizeType), which has the owner's own box;
 * every other portrait screen has the band rule. The box is the same in the base game and in a feature.
 * Portrait x is relative to the 412 master's centre line; the chrome puts that line on its own (wider) fit frame's.
 */
export const logoArtRect = (kind: LayoutKind, viewportMasterWidth?: number, phone = false): LogoRect => {
	if (kind === 'landscape') {
		const { cx, cy, width } = LOGO.landscape;
		const height = width / ASPECT;
		return { x: cx - width / 2, y: cy - height / 2, width, height };
	}
	if (kind === 'phone') {
		const { left, top, width } = LOGO.phone;
		return { x: left, y: top, width, height: width / ASPECT };
	}
	if (phone) {
		const { cx, cy, width } = LOGO.portraitPhone;
		const height = width / ASPECT;
		return { x: cx - width / 2, y: cy - height / 2, width, height };
	}
	const P = LOGO.portrait;
	const band = Math.max(frameArtRect('portrait', viewportMasterWidth).y - P.gapAbove - P.top, 1);
	// centred on the screen, so its right edge is half its width from the centre line: clear of the SKIP button
	const T = SKIP.slots.portraitTablet;
	const clear = 2 * (Math.max(viewportMasterWidth ?? MASTER.portrait.width, MASTER.portrait.width) / 2 - T.right - T.play - P.skipGap);
	const width = Math.max(Math.min(P.maxWidth, band * ASPECT, clear), 1);
	const height = width / ASPECT;
	return { x: (MASTER.portrait.width - width) / 2, y: P.top + (band - height) / 2, width, height };
};

/** the canvas logo's frame for an art box: where the frame's origin goes and master units per ship px */
export const logoFramePlacement = (art: readonly number[], rect: LogoRect) => {
	const scale = rect.width / art[2];
	return { x: rect.x - art[0] * scale, y: rect.y - art[1] * scale, scale };
};
