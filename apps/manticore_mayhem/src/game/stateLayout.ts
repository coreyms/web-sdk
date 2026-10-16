import { createLayout } from 'utils-layout';

import { MASTER, isPhoneSizeType, setPortraitViewportSource } from './layoutSpec';

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

// THE PHONE'S BIGGER BOARD (layoutSpec frameFor): the portrait frame's growth reads the live viewport height and size
// class through this (layoutSpec cannot import this module: it is imported by it)
setPortraitViewportSource(() => {
	const scale = stateLayoutDerived.mainLayout().scale;
	return { masterHeight: stateLayoutDerived.canvasSizes().height / scale, cssPerMaster: scale, phone: isPhoneSizeType(stateLayoutDerived.canvasSizeType()) };
});
