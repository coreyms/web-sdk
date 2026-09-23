import { createLayout } from 'utils-layout';

import { MASTER } from './layoutSpec';

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
