// WHICH ARMOURY LAYOUT SHOWS, AND AT WHAT SCALE (spec section 4). Reusable: no game names, colours or copy, and no
// imports, so node runs it as it is (tools/manticore/armoury_parts_check.mjs). The numbers come in as arguments
// (constants.ts ARMOURY.layout).
//
// THE MENU FOLLOWS THE CHROME. The layout is decided by the chrome on screen (the game's layoutKind plus its phone
// size test), never by a window rule of the menu's own:
//   landscape chrome (desktop)                         -> desktop: the 1440 x 810 design box over the master rect
//   phone sideways chrome, frame ratio >= scaledUnder  -> sideways: three columns, the HUD's own column lit on the left
//   phone sideways chrome, frame ratio <  scaledUnder  -> desktop SCALED (owner 2026-10-13 22:18): the desktop box fitted
//                                                         to the window, with the menu's own copies of the bet controls
//                                                         (the 400 x 225 mini player, 800 x 450 popouts, 16:9 phones)
//   portrait chrome, a phone (short side <= 480)       -> portrait phone
//   portrait chrome, not a phone, frame >= minFrame    -> tablet portrait (six tiles in a row)
//   portrait chrome, not a phone, narrower             -> portrait phone stacking
//
// UNITS. "design px" are the prototype's own pixel numbers; the menu is authored in them inside one wrapper scaled by
// one transform. `u` is CSS px per design px. Frame `left` / `top` are CSS px from the viewport's top left.

export type ChromeKind = 'landscape' | 'phone' | 'portrait';
export type ArmouryLayout = 'desktop' | 'portrait' | 'tablet' | 'sideways';

export type FrameRules = {
	desktop: { w: number; h: number; master: number; scaledUnderRatio: number };
	portrait: { w: number; gapToHud: number; underClock: number; nameBandMin: number; minHitCss: number; nameGap: number };
	tablet: { w: number; minFrame: number; maxContent: number; nameTop: number; contentTop: number };
	sideways: { w: number; h: number; minLeft: number; hudGap: number; nameAbove: number };
};

export type FrameInput = {
	kind: ChromeKind;
	/** the portrait chrome's phone size test (layoutSpec.ts isPhoneSizeType) */
	phone: boolean;
	/** viewport, CSS px */
	vw: number;
	vh: number;
	/** the chrome's fit scale (Chrome.svelte `scale`) and its master */
	scale: number;
	master: { width: number; height: number };
	/** the chrome's fit frame width in master px (Chrome.svelte `fitWidth`: the portrait frame spans the viewport) */
	fitWidth: number;
};

export type MenuFrame = {
	layout: ArmouryLayout;
	/** CSS px per design px */
	u: number;
	/** the frame's top left in the viewport, CSS px */
	left: number;
	top: number;
	/** the frame's size in design px */
	width: number;
	height: number;
	/** the desktop box on a phone sideways chrome: the menu draws its own copies of the bet controls */
	hudCopies: boolean;
	/** tablet: the content column (capped at maxContent and centred), design px; elsewhere the whole width */
	contentLeft: number;
	contentWidth: number;
};

/** which layout, from the chrome alone */
export const pickLayout = (inp: FrameInput, rules: FrameRules): { layout: ArmouryLayout; hudCopies: boolean } => {
	if (inp.kind === 'landscape') return { layout: 'desktop', hudCopies: false };
	if (inp.kind === 'phone') {
		const ratio = inp.vw / Math.max(1, inp.vh);
		return ratio < rules.desktop.scaledUnderRatio ? { layout: 'desktop', hudCopies: true } : { layout: 'sideways', hudCopies: false };
	}
	if (!inp.phone && inp.fitWidth >= rules.tablet.minFrame) return { layout: 'tablet', hudCopies: false };
	return { layout: 'portrait', hudCopies: false };
};

/** the layout, the scale and the frame (spec 4.2) */
export const menuFrame = (inp: FrameInput, rules: FrameRules): MenuFrame => {
	const { layout, hudCopies } = pickLayout(inp, rules);
	const vw = Math.max(1, inp.vw);
	const vh = Math.max(1, inp.vh);
	const whole = (u: number, l = 'portrait' as ArmouryLayout): MenuFrame => {
		const width = vw / u;
		const contentWidth = l === 'tablet' ? Math.min(width, rules.tablet.maxContent) : width;
		return { layout: l, u, left: 0, top: 0, width, height: vh / u, hudCopies: false, contentLeft: (width - contentWidth) / 2, contentWidth };
	};
	if (layout === 'desktop') {
		const D = rules.desktop;
		if (hudCopies) {
			// the desktop box fitted to the window and centred in it
			const u = Math.min(vw / D.w, vh / D.h);
			return { layout, u, left: (vw - D.w * u) / 2, top: (vh - D.h * u) / 2, width: D.w, height: D.h, hudCopies, contentLeft: 0, contentWidth: D.w };
		}
		// exactly the chrome's master rectangle (1280 x 720 master px = 1440 x 810 design px)
		const u = (inp.scale * D.master) / D.w;
		const mw = inp.master.width * inp.scale;
		const mh = inp.master.height * inp.scale;
		return { layout, u, left: (vw - mw) / 2, top: (vh - mh) / 2, width: D.w, height: D.h, hudCopies, contentLeft: 0, contentWidth: D.w };
	}
	if (layout === 'sideways') return { ...whole(Math.min(vh / rules.sideways.h, vw / rules.sideways.w)), layout };
	if (layout === 'tablet') return whole(inp.scale * Math.min(1, inp.fitWidth / rules.tablet.w), 'tablet');
	return whole(vw / rules.portrait.w, 'portrait');
};

/** what the game measures when the menu opens and on every resize (never per frame), CSS px in the viewport */
export type Anchors = {
	/** portrait: the top of the HUD's BALANCE / bet row */
	hudTop?: number;
	/** portrait: the top and the bottom of the clock strip */
	clockTop?: number;
	clockBottom?: number;
	/** sideways: the right edge of the HUD's column (readouts and the plus stepper) */
	hudRight?: number;
	/** sideways: the top left of the HUD's BALANCE readout (the menu's name sits above it) */
	balance?: { x: number; y: number };
	/** env(safe-area-inset-*) */
	safe: { top: number; right: number; bottom: number; left: number };
};

export type DesignAnchors = {
	/** design px from the frame's top: where content may start and must end */
	contentTop: number;
	contentBottom: number;
	/** sideways: where the middle column starts, design px from the frame's left */
	midLeft: number;
	/** where the name goes. Portrait phone: centred in the band above the clock strip ('band', y its centre), or, when
	 *  that band is under nameBandMin design px high, under the strip ('under', y its top) with the content nameGap
	 *  lower (the tablet's place). Sideways: 'above' the HUD's BALANCE, x its left, y nameAbove over its top */
	name: { place: 'band' | 'under' | 'above'; y: number; x?: number };
	/** the safe area insets, design px */
	safe: { top: number; right: number; bottom: number; left: number };
	/** design px a control must be to reach the CSS minimum hit size */
	minHit: number;
};

/** the measured anchors in the frame's design px (spec 4.2 "Measured anchors, not constants") */
export const designAnchors = (f: MenuFrame, a: Anchors, rules: FrameRules): DesignAnchors => {
	const u = f.u;
	const y = (css: number) => (css - f.top) / u;
	const safe = { top: a.safe.top / u, right: a.safe.right / u, bottom: a.safe.bottom / u, left: a.safe.left / u };
	let contentTop = safe.top;
	let contentBottom = f.height - safe.bottom;
	let midLeft = 0;
	let name: DesignAnchors['name'] = { place: 'band', y: safe.top };
	if (f.layout === 'portrait') {
		if (a.clockBottom != null) contentTop = Math.max(contentTop, y(a.clockBottom) + rules.portrait.underClock);
		if (a.hudTop != null) contentBottom = Math.min(contentBottom, y(a.hudTop) - rules.portrait.gapToHud);
		const bandTop = safe.top;
		const bandBottom = a.clockTop != null ? y(a.clockTop) : bandTop;
		if (bandBottom - bandTop >= rules.portrait.nameBandMin) name = { place: 'band', y: (bandTop + bandBottom) / 2 };
		else {
			name = { place: 'under', y: contentTop };
			contentTop += rules.portrait.nameGap;
		}
	} else if (f.layout === 'tablet') {
		contentTop = Math.max(contentTop, rules.tablet.contentTop);
		if (a.hudTop != null) contentBottom = Math.min(contentBottom, y(a.hudTop) - rules.portrait.gapToHud);
		name = { place: 'under', y: Math.max(safe.top, rules.tablet.nameTop) };
	} else if (f.layout === 'sideways') {
		midLeft = Math.max(rules.sideways.minLeft, a.hudRight != null ? (a.hudRight - f.left) / u + rules.sideways.hudGap : 0, safe.left);
		contentTop = Math.max(safe.top, 0);
		if (a.balance) name = { place: 'above', x: (a.balance.x - f.left) / u, y: y(a.balance.y) - rules.sideways.nameAbove };
	} else {
		contentTop = 0;
		contentBottom = f.height;
	}
	return { contentTop, contentBottom, midLeft, name, safe, minHit: rules.portrait.minHitCss / u };
};
