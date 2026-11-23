// THE FAST LANE'S BOX (ui/FeatureMenu.svelte, its header's LAYOUT): which of the menu's three layouts a window takes and
// the one scale its box (and its confirm card) is drawn at, before the upright layout's own squeeze (fitK). Pure
// numbers, so tools/sign_panel_test.mjs can hold the confirm card's keys to the 44 CSS px press rule in every window.
//   desk  a landscape window at least 960 x 560: the mock's 1440 x 900 box, fitted, at most 1.2
//   side  a phone held sideways (or any other short landscape window): 390 design px tall, at most 1.15
//   up    an upright window: 390 design px wide and at least 600 tall, at most 1.15
export const FL_BOX = {
	desk: { w: 1440, h: 900, max: 1.2, minW: 960, minH: 560 },
	side: { w: 844, h: 390, max: 1.15 },
	up: { w: 390, minH: 600, max: 1.15 },
} as const;
export type FlLay = 'desk' | 'side' | 'up';
export const flLay = (vw: number, vh: number): FlLay => (vw > vh ? (vw >= FL_BOX.desk.minW && vh >= FL_BOX.desk.minH ? 'desk' : 'side') : 'up');
export const flScale = (lay: FlLay, vw: number, vh: number) =>
	lay === 'desk' ? Math.min(vw / FL_BOX.desk.w, vh / FL_BOX.desk.h, FL_BOX.desk.max) : lay === 'side' ? Math.min(vh / FL_BOX.side.h, vw / FL_BOX.side.w, FL_BOX.side.max) : Math.min(vw / FL_BOX.up.w, vh / FL_BOX.up.minH, FL_BOX.up.max);

// THE HERO ON AN UPRIGHT SCREEN (2026-11-23, Corey's iPhone: "the ANTE Sign doesn't show above like the presents").
// The hero's row is whatever the upright column leaves (ui/FeatureMenu.svelte measures it). Its art is 86 % of the row,
// at most 210 px, and is dropped where the row is 70 px or less (the style block's rule, the same for every mode).
// The Ante's sign carries three lines of words, so it has a floor of its own: it is drawn no smaller than 63 CSS px
// tall, where its ANTE and PLAY lines (0.21 of the 68.5 % face) are 9 CSS px; under that it is dropped too.
export const FL_HERO = { share: 0.86, max: 210, dropAt: 70, signFloorCss: 63, signRatio: 863 / 1188, signFace: 0.685, signSmallLine: 0.21 } as const;
/** the art's height in the menu's own px for a hero row `heroH` tall at the box's scale `s`; null: dropped */
export const flUpHeroArt = (o: { heroH: number; s: number; ante: boolean }): number | null => {
	if (o.heroH <= FL_HERO.dropAt) return null;
	const art = Math.min(FL_HERO.share * o.heroH, FL_HERO.max);
	return o.ante && art * o.s < FL_HERO.signFloorCss ? null : art;
};
