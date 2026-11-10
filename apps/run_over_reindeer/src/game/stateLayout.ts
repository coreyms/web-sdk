import { createLayout } from 'utils-layout';

import { MASTER, setLandscapeViewportSource, setPortraitViewportSource } from './layoutSpec';

// Main layout sizes are the design masters (see layoutSpec.ts). Square-ish canvases use the portrait master.
export const { stateLayout, stateLayoutDerived } = createLayout({
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

// THE PORTRAIT ROAD (layoutSpec roadPlacement) reads the live viewport through this, in master units: the width a
// tablet shows past the 412 master and the height a tall phone shows past the 760 (layoutSpec cannot import this
// module: it is imported by it)
setPortraitViewportSource(() => {
	const scale = stateLayoutDerived.mainLayout().scale;
	const canvas = stateLayoutDerived.canvasSizes();
	return { masterWidth: canvas.width / scale, masterHeight: canvas.height / scale };
});

// THE TALLER DESKTOP SCREENS (layoutSpec LANDSCAPE_TALL): the HUD's bottom row reads the master height the screen
// shows; any other layout reads as the plain 720
setLandscapeViewportSource(() => {
	if (stateLayoutDerived.layoutType() !== 'desktop') return MASTER.landscape.height;
	return stateLayoutDerived.canvasSizes().height / stateLayoutDerived.mainLayout().scale;
});
