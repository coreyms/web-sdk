// WHICH ARMOURY LAYOUT SHOWS, AND AT WHAT SCALE (spec section 4). Reusable: no game names, colours or copy, and no
// imports, so node runs it as it is (tools/manticore/armoury_parts_check.mjs). The numbers come in as arguments
// (constants.ts ARMOURY.layout).
//
// THE MENU FOLLOWS THE CHROME. The layout is decided by the chrome on screen (the game's layoutKind plus its phone
// size test), never by a window rule of the menu's own:
//   landscape chrome (desktop)                         -> desktop: the 1440 x 810 design box over the master rect
//   phone sideways chrome, frame ratio >= scaledUnder  -> sideways: three columns, the HUD's own column lit on the left
//   phone sideways chrome, the gear bar on a touch     -> sideways at every ratio (2026-11-23: the desktop box at half
//   phone (touchSideways)                                 scale is 7 px text and 22 px keys on a phone); its middle column
//                                                         starts right of the gear bar's left column and its rail ends
//                                                         above the bar's lit amount and arrows (Anchors.railTop)
//   phone sideways chrome, frame ratio <  scaledUnder  -> desktop SCALED (owner 2026-10-13 22:18): the desktop box fitted
//                                                         to the window, with the menu's own copies of the bet controls
//                                                         (the 400 x 225 mini player, 800 x 450 popouts, 16:9 phones)
//   portrait chrome, a phone (short side <= 480)       -> portrait phone
//   portrait chrome, not a phone, frame >= minFrame    -> tablet portrait (four tiles in a row; six until 2026-11-21)
//   portrait chrome, not a phone, narrower             -> portrait phone stacking
//
// UNITS. "design px" are the prototype's own pixel numbers; the menu is authored in them inside one wrapper scaled by
// one transform. `u` is CSS px per design px. Frame `left` / `top` are CSS px from the viewport's top left.

export type ChromeKind = 'landscape' | 'phone' | 'portrait';
export type ArmouryLayout = 'desktop' | 'portrait' | 'tablet' | 'sideways';

export type FrameRules = {
	desktop: { w: number; h: number; master: number; scaledUnderRatio: number };
	portrait: { w: number; gapToHud: number; underClock: number; nameBandMin: number; minHitCss: number; nameGap: number; fitMin: number; closeKey: number; closeGap: number; card: { w: number; h: number }; cardGap: number };
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
	/** phone sideways chrome only: the gear bar is drawn and the phone is a touch phone: the sideways layout at every
	 *  ratio (a 16:9 phone too), never the desktop box scaled down to it */
	touchSideways?: boolean;
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
		return !inp.touchSideways && ratio < rules.desktop.scaledUnderRatio ? { layout: 'desktop', hudCopies: true } : { layout: 'sideways', hudCopies: false };
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

/** THE UPRIGHT PHONE'S MENU ON A SHORT WINDOW (2026-11-23). The portrait layout is one column between the clock line
 *  and the HUD's top; its tray and plate have their own heights (`need`, design px, as measured: the hero has already
 *  given). The gear bar's band is taller than the dock's row, so on a phone browser's real frames (413 x 586, 375 x
 *  504) the room is under what they need and the plate ran on over the bar's lit amount row. Then the whole menu is
 *  drawn smaller: the same column (its own width) centred in a wider frame, at the largest scale that ends the plate
 *  above the HUD's top, never under rules.portrait.fitMin of the frame's own. A window with the room keeps the frame
 *  exactly. Pure (ui/armoury/Armoury.svelte measures `need` and the anchors; tools/gear_layout_test.mjs sweeps it). */
export const fitPortrait = (f: MenuFrame, a: Anchors, need: number, rules: FrameRules): MenuFrame => {
	if (f.layout !== 'portrait' || !(need > 0) || a.hudTop == null) return f;
	// (2026-11-24) THE CLOSE KEY'S ROW. With the hero dropped the tray and the plate stand at the bottom of the column,
	// and the close key (a `closeKey` px square, top right) needs its own room over the tray's corner: fitted to
	// `need` alone, the whole menu drawn smaller left none, and the key sat on the SUPER ANTE tile's edge. The room
	// kept over the tray is the key and `closeGap`; where the name stands under the clock line (its own `nameGap`
	// row, over the content) the key stands in that row with it (closeTop), so only the rest is kept.
	const room = (g: MenuFrame) => {
		const d = designAnchors(g, a, rules);
		return d.contentBottom - d.contentTop - closeRoom(d, rules);
	};
	if (room(f) >= need) return f;
	const at = (k: number): MenuFrame => {
		const width = f.width / k;
		return { ...f, u: f.u * k, width, height: f.height / k, contentWidth: f.contentWidth, contentLeft: (width - f.contentWidth) / 2 };
	};
	let lo = rules.portrait.fitMin;
	let hi = 1;
	if (room(at(lo)) < need) return at(lo);
	for (let i = 0; i < 30; i++) {
		const mid = (lo + hi) / 2;
		if (room(at(mid)) >= need) lo = mid;
		else hi = mid;
	}
	return at(lo);
};

/** the room kept over the tray for the close key with the hero dropped, design px: the lower half of its press area
 *  (the key itself, or the 44 CSS px square round its middle where the menu is drawn small), the key's upper half,
 *  closeGap, less the name's row where the key stands in it */
export const closeRoom = (d: DesignAnchors, rules: FrameRules): number =>
	Math.max(rules.portrait.closeKey, d.minHit) / 2 + rules.portrait.closeKey / 2 + rules.portrait.closeGap - (d.name.place === 'under' ? rules.portrait.nameGap : 0);

/** THE CONFIRM CARD on an upright phone or a tablet (design px): `want` its top, cardGap under the first content line.
 *  On a window too short for it, it first rises (never above the safe area), and only then is scaled down to the room
 *  above the HUD row. 2026-11-24: and never so high that Cancel's press area (the round key on the frame art's corner
 *  diamond, `diamondY` of the card's height down) is cut by the window's top: on a menu drawn small the diamond stood
 *  under 22 CSS px from the edge, and a press on the key's upper part missed it. */
export const portraitCard = (f: MenuFrame, d: DesignAnchors, want: number, diamondY: number, rules: FrameRules): { top: number; k: number } => {
	const C = rules.portrait.card;
	let top = Math.max(d.safe.top, Math.min(want, d.contentBottom - C.h));
	// the diamond's center, top + diamondY x (the card's drawn height), at least half a press area under the edge
	const centre = (t: number) => t + diamondY * Math.min(C.h, d.contentBottom - t);
	const half = d.minHit / 2 + 0.5 / f.u;
	if (centre(top) < half && d.contentBottom - top < C.h) top = Math.max(top, (half - diamondY * d.contentBottom) / (1 - diamondY));
	else if (centre(top) < half) top = half - diamondY * C.h;
	return { top, k: Math.min(1, (d.contentBottom - top) / C.h) };
};

/** THE CLOSE KEY'S TOP on an upright phone, design px: on the content's first line beside the hero; with the hero
 *  dropped and the name in its own row under the clock line, in that row (the key is taller than the row and runs
 *  `closeKey - nameGap` px on under it, over the room fitPortrait keeps clear of the tray) */
export const closeTop = (d: DesignAnchors, noHero: boolean, rules: FrameRules): number => (noHero && d.name.place === 'under' ? d.contentTop - rules.portrait.nameGap : d.contentTop);

/** THE MENU'S CLOSE KEY UNDER THE CONFIRM CARD (2026-11-24). Upright (the phone and the tablet) the card stands where
 *  the key is, its Cancel on the frame art's corner diamond at the top right: there the key is out for as long as the
 *  card is up (not drawn, inert, no place in the stacking order over the card) and Cancel is the way back. The desktop
 *  box keeps it (its top right corner, 384 design px from the card) and so does the sideways layout (the rail's corner,
 *  the slab in the middle): there it closes the whole menu, as it always has. One rule: ui/armoury/Armoury.svelte
 *  reads it for the key, tools/gear_layout_test.mjs sweeps it. */
export const closeUnderCard = (layout: ArmouryLayout): boolean => layout === 'desktop' || layout === 'sideways';

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
	/** sideways, the gear bar: the top of its lit amount and arrows at the bottom right (their press boxes): the rail
	 *  of mode tiles ends above it, so the bar's own + and - stay lit and live under the rail */
	railTop?: number;
	/** env(safe-area-inset-*) */
	safe: { top: number; right: number; bottom: number; left: number };
};

export type DesignAnchors = {
	/** design px from the frame's top: where content may start and must end */
	contentTop: number;
	contentBottom: number;
	/** sideways: where the middle column starts, design px from the frame's left */
	midLeft: number;
	/** sideways: design px kept clear under the rail, from the frame's bottom (0: the rail is the frame's whole height) */
	railBottom: number;
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
	let railBottom = 0;
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
		if (a.railTop != null) railBottom = Math.max(0, f.height - y(a.railTop));
	} else {
		contentTop = 0;
		contentBottom = f.height;
	}
	return { contentTop, contentBottom, midLeft, railBottom, name, safe, minHit: rules.portrait.minHitCss / u };
};
