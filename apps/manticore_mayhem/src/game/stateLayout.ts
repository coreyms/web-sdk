import { createLayout } from 'utils-layout';

import { MASTER, gameLayoutType, isPhoneSizeType, layoutKind, setLandscapeViewportSource, setPortraitViewportSource, sharedLayoutType } from './layoutSpec';

// Main layout sizes are the design masters (see layoutSpec.ts). Square-ish canvases use the portrait master.
const shared = createLayout({
	backgroundRatio: {
		normal: 1536 / 1024,
		portrait: 1536 / 1024,
	},
	mainSizesMap: {
		desktop: MASTER.landscape,
		landscape: MASTER.phone, // phone held sideways gets its own wide master (see layoutSpec.ts)
		tablet: MASTER.portrait,
		portrait: MASTER.portrait,
	},
});

// THE MIDDLE WINDOWS (layoutSpec MID, 2026-11-26): every window whose short side is over 480 CSS px is the DESKTOP layout
// at every shape (the shared rule drew a window under ratio 1.3 as an upright phone with the old dock). The shared
// layout's own layoutType and the master fit that follows it are replaced here, once, for the whole game: everything
// that reads the layout (the canvas's MainContainer through the context, the chrome, the components) reads these.
// A phone's window (short side 480 or less) is the shared rule's exactly.
const canvasSizes = shared.stateLayoutDerived.canvasSizes;
const layoutType = () => gameLayoutType(canvasSizes().width, canvasSizes().height);
const mainSizesMap = { desktop: MASTER.landscape, landscape: MASTER.phone, tablet: MASTER.portrait, portrait: MASTER.portrait };
const mainLayout = () => {
	const c = canvasSizes();
	const m = mainSizesMap[layoutType()];
	return { x: c.width * 0.5, y: c.height * 0.5, scale: Math.min(c.width / m.width, c.height / m.height), width: m.width, height: m.height, anchor: 0.5 };
};
export const stateLayout = shared.stateLayout;
export const stateLayoutDerived = {
	...shared.stateLayoutDerived,
	layoutType,
	// (the shared isStacked compares with 'almostSquare', which is no layout type: it is true for 'portrait' alone)
	isStacked: () => layoutType() === 'portrait',
	mainLayout,
	/** THE LAYOUT THE SHARED RULE WOULD GIVE (the old layout of a middle window): the HTML modals, THE ARMOURY and the
	 *  landing screen keep it, so they are what they were on every window (ui/Chrome.svelte) */
	legacyKind: () => layoutKind(sharedLayoutType(canvasSizes().width, canvasSizes().height)),
};

// THE PHONE'S BIGGER BOARD (layoutSpec frameFor): the portrait frame's growth reads the live viewport height and size
// class through this (layoutSpec cannot import this module: it is imported by it)
setPortraitViewportSource(() => {
	const scale = stateLayoutDerived.mainLayout().scale;
	return { masterHeight: stateLayoutDerived.canvasSizes().height / scale, cssPerMaster: scale, phone: isPhoneSizeType(stateLayoutDerived.canvasSizeType()) };
});

// THE TALLER DESKTOP SCREENS (layoutSpec LANDSCAPE_TALL): the desktop board's growth reads the master height the screen
// shows; any other layout reads as the plain 720 (no growth). THE MIDDLE WINDOWS (layoutSpec MID) read the window itself.
setLandscapeViewportSource(
	() => {
		if (stateLayoutDerived.layoutType() !== 'desktop') return MASTER.landscape.height;
		return stateLayoutDerived.canvasSizes().height / stateLayoutDerived.mainLayout().scale;
	},
	() => (stateLayoutDerived.layoutType() === 'desktop' ? { vw: stateLayoutDerived.canvasSizes().width, vh: stateLayoutDerived.canvasSizes().height } : null),
);
