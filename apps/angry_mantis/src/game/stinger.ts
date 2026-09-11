// Big-win STINGER plates (Corey's art, 2026-09-09): one riveted metal sign per tier, the tier's
// insect on the left and the lettering top-right, with a blank panel under the lettering where the
// count-up sits. The ladder is the paytable in reverse — caterpillar, moth, fly, lightning bug,
// then the three high symbols crowding the MAX plate. Picked in the "Win Stingers" preview
// (chow-line shove between tiers, cream stencil amount with a rust shadow).
//
// Every plate is alpha-cropped, so the amount box is a fraction of the CROPPED plate — the same
// numbers Corey tuned on the preview's sliders. Four plates share one box; MAX's lettering sits
// further right, so its box does too, and the number rides in with that plate.
import type { LayoutKind } from './layoutSpec';
import type { WinLevelAlias } from './winLevelMap';

export type StingerTier = Extract<WinLevelAlias, 'big' | 'superwin' | 'mega' | 'epic' | 'max'>;
export const STINGER_TIERS: readonly StingerTier[] = ['big', 'superwin', 'mega', 'epic', 'max'];
/** the tier plates plus the plain lettering-free plate (regular win pops, sub-big wrap-ups) */
export type StingerPlateName = StingerTier | 'normal';
/** the plate for a wrap-up / win level: a big tier's own plate, anything else the plain one */
export const stingerPlateFor = (alias: string | undefined): StingerPlateName =>
	(STINGER_TIERS as readonly string[]).includes(alias ?? '') ? (alias as StingerTier) : 'normal';

/** asset key + source aspect (width / height of the cropped plate) */
export const STINGER_PLATE: Record<StingerPlateName, { key: string; aspect: number }> = {
	normal: { key: 'stingerNormal', aspect: 1872 / 644 },
	big: { key: 'stingerBig', aspect: 1855 / 651 },
	superwin: { key: 'stingerSuper', aspect: 1887 / 647 },
	mega: { key: 'stingerMega', aspect: 1876 / 632 },
	epic: { key: 'stingerEpic', aspect: 1902 / 677 },
	max: { key: 'stingerMax', aspect: 1835 / 658 },
};

/** amount box, % of the plate: left, top, width, height (preview readouts, Corey 2026-09-09) */
export const STINGER_BOX: Record<StingerPlateName, { x: number; y: number; w: number; h: number }> = {
	// no lettering: the amount sits centred, same digit height as the tier plates (Corey 2026-09-09)
	normal: { x: 25, y: 38, w: 50, h: 24 },
	big: { x: 41, y: 52, w: 50, h: 24 },
	superwin: { x: 41, y: 52, w: 50, h: 24 },
	mega: { x: 41, y: 52, w: 50, h: 24 },
	epic: { x: 41, y: 52, w: 50, h: 24 },
	max: { x: 49, y: 52, w: 44, h: 24 },
};

/** the regular-win pop's amount box, % of the plain plate, per layout — from the tuning page
 *  readout (Corey 2026-09-09: digits 42 / 40 / 29 % of plate height, width caps 75 / 84 / 96 %),
 *  undone through fillH / fillW so the drawn glyphs land on exactly those numbers, centred */
export const STINGER_SMALL_BOX: Record<LayoutKind, { x: number; y: number; w: number; h: number }> = {
	landscape: { x: 10.9, y: 27.2, w: 78.1, h: 45.7 },
	phone: { x: 6.3, y: 28.3, w: 87.5, h: 43.5 },
	portrait: { x: 0, y: 34.2, w: 100, h: 31.5 },
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

/** soft halo behind every plate (game/shadowTexture.ts plateShadowTexture) */
export const STINGER_SHADOW_ALPHA = 0.6;

// one tin-metal clink per tier, fired as that tier's plate lands (Corey's win-*.ogg, 2026-09-11)
export const STINGER_SOUND = {
	big: 'sfx_win_big',
	superwin: 'sfx_win_super',
	mega: 'sfx_win_mega',
	epic: 'sfx_win_epic',
	max: 'sfx_win_max',
} as const satisfies Record<StingerTier, string>;

export const STINGER_MOTION = {
	enter: 420, // plate drops in from above, overshoots, settles
	shove: 420, // chow-line shove: next plate slides in from the right...
	shoveLag: 40, // ...and the old one is pushed out the left a beat later
	exit: 480, // final drop off the bottom
	kickEnter: 6, // screen kick on the BIG landing, master px (game/screenKick.ts, 220 ms)
	kickShove: 3, // lighter kick as a shoved plate hits home
} as const;
