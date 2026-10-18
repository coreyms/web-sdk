// WHERE THE LOGO SITS: one rule per layout, in master units, for the box of the logo's ART (the still's own
// box, wing tip to wing tip). The HTML chrome sizes its <img> to this box (ui/Chrome*.svelte) and the canvas
// logo maps the same art box of its frame onto it (components/Logo.svelte), so the two are the same picture
// in the same place. Numbers in constants LOGO.
import { CREATURE, LOGO } from '../constants';
import { CREATURE_SPEC } from '../creatureSpec';
import { SCENE_SPEC_PORTRAIT } from '../sceneSpec';
import { frameArtRect, frameFor, landscapeExtraY, MASTER, portraitViewportNow, registrationOf, SKIP, type LayoutKind } from '../layoutSpec';
import { portraitOptions } from '../portraitOptions.svelte';
import { safeInsetLeftCss } from '../safeInset';

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
		const extra = landscapeExtraY();
		if (extra > 0) {
			// a desktop screen narrower than 16:9: the bigger board's post sets the width, and the box rides up with the
			// clock strip (constants LOGO.landscapeTall)
			const T = LOGO.landscapeTall;
			const post = registrationOf(frameFor('landscape')).map(T.postRender, 0).x;
			const width = Math.max(post - 2 * T.gap, 1);
			return { x: T.gap, y: T.top - extra, width, height: width / ASPECT };
		}
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
		const view = portraitViewportNow();
		if (portraitOptions.logo === 'edge' && view) {
			// THE LEFT EDGE OPTION (constants LOGO.portraitPhoneEdge): the left wing's tip edgeCss CSS px (plus the safe area)
			// in from the screen's left edge. The screen's left edge is half the viewport's width left of the master's centre.
			const E = LOGO.portraitPhoneEdge;
			const vw = Math.max(viewportMasterWidth ?? MASTER.portrait.width, 1);
			const tip = (E.wingTipArt * width) / LOGO.art.width;
			const x = MASTER.portrait.width / 2 - vw / 2 + (E.edgeCss + safeInsetLeftCss()) / view.cssPerMaster - tip;
			return { x, y: cy - height / 2, width, height };
		}
		return { x: cx - width / 2, y: cy - height / 2, width, height };
	}
	const P = LOGO.portrait;
	const band = Math.max(frameArtRect('portrait', viewportMasterWidth).y - P.gapAbove - P.top, 1);
	// centred on the screen, so its right edge is half its width from the centre line: clear of the SKIP button
	const T = SKIP.slots.portraitTablet;
	const clear = 2 * (Math.max(viewportMasterWidth ?? MASTER.portrait.width, MASTER.portrait.width) / 2 - T.right - T.play - P.skipGap);
	let width = Math.max(Math.min(P.maxWidth, band * ASPECT, clear), 1);
	let x = (MASTER.portrait.width - width) / 2;
	// clear of the creature (constants LOGO.portraitTabletClear): his leftmost drawn point on this screen, through his
	// spot and the portrait scene's cover fit, in this rule's x (master units from the 412 master's left edge)
	const view = portraitViewportNow();
	if (view) {
		const K = LOGO.portraitTabletClear;
		const vw = Math.max(viewportMasterWidth ?? MASTER.portrait.width, 1);
		const [fw, fh] = SCENE_SPEC_PORTRAIT.frame;
		const s = Math.max(vw / fw, view.masterHeight / fh);
		const spot = CREATURE.place.portraitTablet;
		const him = MASTER.portrait.width / 2 - (fw * s) / 2 + (spot.x + (K.leftRig - CREATURE_SPEC.feetCol) * spot.scale) * s;
		const right = him - K.gapCss / view.cssPerMaster;
		const left = MASTER.portrait.width / 2 - vw / 2 + K.edgeCss / view.cssPerMaster;
		if (x + width > right) {
			width = Math.max(Math.min(width, right - left), 1);
			x = right - width;
		}
	}
	const height = width / ASPECT;
	return { x, y: P.top + (band - height) / 2, width, height };
};

/** the canvas logo's frame for an art box: where the frame's origin goes and master units per ship px */
export const logoFramePlacement = (art: readonly number[], rect: LogoRect) => {
	const scale = rect.width / art[2];
	return { x: rect.x - art[0] * scale, y: rect.y - art[1] * scale, scale };
};
