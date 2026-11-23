// WHERE THE LOGO SITS: one rule per layout, in master units, for the box of the logo's ART (the tablet's own
// picture, game/logo/still.ts). The HTML chrome sizes its <img> to this box (ui/Chrome*.svelte) and the canvas
// draws the still in it (components/Logo.svelte), so the two are the same picture in the same place. Numbers in
// constants LOGO.
// THE TABLET (2026-11-17): each rule still makes the old stacked logo's box (LOGO.boxAspect, 2380 x 940), and the
// tablet fills that box by width, centred in its height (`fit`). Where a rule is set by its centre the two agree.
import { CREATURE, LOGO, LOGO_KEY } from '../constants';
import { CREATURE_SPEC } from '../creatureSpec';
import { SCENE_SPEC_PORTRAIT } from '../sceneSpec';
import { frameArtRect, frameFor, landscapeExtraY, MASTER, portraitSceneNow, portraitViewportNow, registrationOf, SKIP, type LayoutKind } from '../layoutSpec';
import { portraitOptions } from '../portraitOptions.svelte';
import { safeInsetLeftCss } from '../safeInset';

export type LogoRect = { x: number; y: number; width: number; height: number };

const ASPECT = LOGO.art.width / LOGO.art.height;
const BOX_ASPECT = LOGO.boxAspect;
/** the tablet in a rule's box: its width, centred in the box's height */
const fit = (x: number, y: number, width: number): LogoRect => {
	const height = width / ASPECT;
	return { x, y: y + (width / BOX_ASPECT - height) / 2, width, height };
};

/**
 * The art box for a layout. Portrait: `viewportMasterWidth` is the real viewport's width in master units (the frame
 * grows with it) and `phone` says the screen is a phone (layoutSpec isPhoneSizeType), which has the owner's own box;
 * every other portrait screen has the band rule. The box is the same in the base game and in a feature.
 * Portrait x is relative to the 412 master's centre line; the chrome puts that line on its own (wider) fit frame's.
 */
export const logoArtRect = (kind: LayoutKind, viewportMasterWidth?: number, phone = false): LogoRect => {
	if (kind === 'landscape') {
		const extra = landscapeExtraY();
		// THE C1 FRAME, LARGER (constants LOGO_KEY.grow.landscape): the whole column between the screen's edge and the board
		// frame art's left edge
		const G = LOGO_KEY.grow.landscape;
		if (G) {
			const width = Math.max(frameArtRect('landscape').x - 2 * G.gap, 1);
			return { x: G.gap, y: G.top - extra, width, height: width / ASPECT };
		}
		if (extra > 0) {
			// a desktop screen narrower than 16:9: the bigger board's post sets the width, and the box rides up with the
			// clock strip (constants LOGO.landscapeTall)
			const T = LOGO.landscapeTall;
			const post = registrationOf(frameFor('landscape')).map(T.postRender, 0).x;
			const width = Math.max(post - 2 * T.gap, 1);
			return fit(T.gap, T.top - extra, width);
		}
		const { cx, cy, width } = LOGO.landscape;
		const height = width / ASPECT;
		return { x: cx - width / 2, y: cy - height / 2, width, height };
	}
	if (kind === 'phone') {
		const { left, top, width } = LOGO.phone;
		return fit(left, top, width);
	}
	if (phone) {
		const { cx } = LOGO.portraitPhone;
		const GP = LOGO_KEY.grow.portraitPhone;
		// THE GEAR TRAIN'S SCENE (ui/gear/uprightScene.ts through layoutSpec portraitSceneNow): where an upright phone draws
		// the train the board stands higher, so the logo's bottom edge rides up with the frame art, and under the clock
		// line it is drawn smaller; its left edge rule is unchanged. null: the shipped box.
		const scene = portraitSceneNow(viewportMasterWidth);
		const width = (portraitOptions.logoWidth ?? GP?.width ?? LOGO.portraitPhone.width) * (scene?.logo.scale ?? 1);
		const height = width / ASPECT;
		// the frame's bottom edge held (constants LOGO_KEY.grow.portraitPhone): a wider frame grows up, not down onto him
		const cy = scene ? scene.logo.bottom - height / 2 : GP ? GP.bottom - height / 2 : LOGO.portraitPhone.cy;
		const view = portraitViewportNow();
		if (portraitOptions.logo === 'edge' && view) {
			// THE LEFT EDGE OPTION (constants LOGO.portraitPhoneEdge): the art's leftmost drawn column edgeCss CSS px (plus the safe area)
			// in from the screen's left edge. The screen's left edge is half the viewport's width left of the master's centre.
			const E = LOGO.portraitPhoneEdge;
			const vw = Math.max(viewportMasterWidth ?? MASTER.portrait.width, 1);
			const tip = (E.leftEdgeArt * width) / LOGO.art.width;
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
	let width = Math.max(Math.min(LOGO_KEY.grow.portrait?.maxWidth ?? P.maxWidth, band * BOX_ASPECT, clear), 1);
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
