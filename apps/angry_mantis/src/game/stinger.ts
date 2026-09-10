// Big-win STINGER plates (Corey's art, 2026-09-09): one riveted metal sign per tier, the tier's
// insect on the left and the lettering top-right, with a blank panel under the lettering where the
// count-up sits. The ladder is the paytable in reverse — caterpillar, moth, fly, lightning bug,
// then the three high symbols crowding the MAX plate. Picked in the "Win Stingers" preview
// (chow-line shove between tiers, cream stencil amount with a rust shadow).
//
// Every plate is alpha-cropped, so the amount box is a fraction of the CROPPED plate — the same
// numbers Corey tuned on the preview's sliders. Four plates share one box; MAX's lettering sits
// further right, so its box does too, and the number rides in with that plate.
import type { WinLevelAlias } from './winLevelMap';

export type StingerTier = Extract<WinLevelAlias, 'big' | 'superwin' | 'mega' | 'epic' | 'max'>;
export const STINGER_TIERS: readonly StingerTier[] = ['big', 'superwin', 'mega', 'epic', 'max'];

/** asset key + source aspect (width / height of the cropped plate) */
export const STINGER_PLATE: Record<StingerTier, { key: string; aspect: number }> = {
	big: { key: 'stingerBig', aspect: 1855 / 651 },
	superwin: { key: 'stingerSuper', aspect: 1887 / 647 },
	mega: { key: 'stingerMega', aspect: 1876 / 632 },
	epic: { key: 'stingerEpic', aspect: 1902 / 677 },
	max: { key: 'stingerMax', aspect: 1835 / 658 },
};

/** amount box, % of the plate: left, top, width, height (preview readouts, Corey 2026-09-09) */
export const STINGER_BOX: Record<StingerTier, { x: number; y: number; w: number; h: number }> = {
	big: { x: 41, y: 52, w: 50, h: 24 },
	superwin: { x: 41, y: 52, w: 50, h: 24 },
	mega: { x: 41, y: 52, w: 50, h: 24 },
	epic: { x: 41, y: 52, w: 50, h: 24 },
	max: { x: 49, y: 52, w: 44, h: 24 },
};

/** cream stencil (hint of yellow) over a hard down-right rust shadow — "Cream stencil, rust shadow" */
export const STINGER_AMOUNT = {
	tint: 0xf7e8b2,
	// shadow offset as fractions of the digit height (11 / 205, 12 / 205 in the preview)
	shadow: { dx: 0.054, dy: 0.059, tint: 0x6a2f10 },
	/** glyph height / box height, width fit / box width */
	fillH: 0.92,
	fillW: 0.96,
} as const;

export const STINGER_MOTION = {
	enter: 420, // plate drops in from above, overshoots, settles
	shove: 420, // chow-line shove: next plate slides in from the right...
	shoveLag: 40, // ...and the old one is pushed out the left a beat later
	exit: 480, // final drop off the bottom
	kick: 220, // container kick on a landing
	kickEnter: 6, // master px
	kickShove: 3,
} as const;
