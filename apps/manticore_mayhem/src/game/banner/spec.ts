// THE WAR STANDARD BANNER (approved mockup images/war_banner_2026-11-13, game build 2026-11-14): the feature intro
// (Free Spins, Super Free Spins, Epic Free Spins) and the TOTAL WIN wrap up as a cloth banner that unrolls from the
// board frame's own gear pole. Numbers here; the drawing is game/banner/view.ts, the flow components/WarBanner.svelte,
// the bake tools/war_banner/ (NOTES: the mockup's NOTES.md and game_build/WIRING_NOTES.md).
//
// UNITS: DESIGN px = the mockup's desktop CSS px at 1440 x 810, x from the banner's centre line, y down from the pole's
// line. The frame's own render px (BOARD_ART: the plate's crop 42, 148 .. 2007, 1794) carry them onto any layout:
// one design px is BANNER.renderPerDesign render px, and the pole's centre line is at render (poleX, poleY).
import type { StingerMode } from '../stinger/types';
import { stamp } from '../assets';

export type BannerTier = 'fs' | 'super' | 'epic';
export type BannerContent = 'intro' | 'total';
export type BannerClass = 'D' | 'P';

export const bannerTierOf = (mode: StingerMode): BannerTier => (mode === 'epic' ? 'epic' : mode === 'super' ? 'super' : 'fs');

export const BANNER = {
	/** the pole: the shaft in the top rail between the gold brackets, in the frame's render px (measured on the
	 *  screenshots and registered onto the plate: mockup geom_reg.json, desktop 247.6, portrait 248.0) */
	poleX: 1024.5,
	poleY: 247.8,
	/** render px per design px (the plate is 1965 render px and 833.6 desktop CSS px wide) */
	renderPerDesign: 1965 / 833.6,
	/** the cloth's width (= the reel window), design px */
	width: 596,
	/** a banner drawn narrower than this (CSS px) takes the phone texture (P), else the desktop one (D) */
	phoneBelowCss: 420,
	/** the scene light under the banner (the old plaque's scene_dim): in over 300 ms from the roll's swap over the rail,
	 *  out over 300 ms from the end of the roll up */
	dim: 0.28,
	dimInMs: 300,
	dimOutMs: 300,
	timing: {
		/** the roll's path over the rail, then the unroll starts on the frame it lands on the pole */
		entryMs: 300,
		/** the press gate opens (the press line fades in from here, mockup 1100 .. 1350) */
		introGateMs: 1100,
		/** the TOTAL WIN amount starts counting (the old plaque's: its 250 ms impact + amountDelayMs 150) */
		countStartMs: 400,
		/** the IN n ... line after the count lands: the old plaque's end pulse, then its fade */
		lineDelayMs: 260,
		lineFadeMs: 200,
	},
	/** the board frame's chains and gears (BoardFrame's haul, featureFx.chainRun): the trigger run with the entry, the
	 *  run back on the exit, and the scatter nudges (bookEventHandlerMap scatterLand, base game, scatters 1 to 3) */
	chains: {
		/** desktop CSS px of one link (the tile is two: BOARD_ART.chains periodPx 125.85 render px) */
		linkDesign: 26.69,
		nudgePx: [3, 6, 10] as const,
		nudgeDelayMs: 40,
		nudgeMs: 420,
		/** at least this many links, then on to the next whole link (the gears' rest picture is frame 0) */
		runMinLinks: 2,
		runMs: 950,
		runRampMs: 150,
		runEaseMs: 200,
		backLinks: -2,
		backMs: 500,
	},
	/** the roll's shading (one canvas gradient made once, 1 x 64): dark at its top and bottom edges, a highlight above
	 *  its middle where the key light (upper left) catches it */
	roll: { shadeTop: 0.55, shadeBottom: 0.5, highlight: 0.22, highlightAt: 0.32, strip: 10 },
	/** the baked copy's tile caps (tools/war_banner: the mockup's RULES): a book with another cap keeps the plain plate */
	tileCap: { bonus: 64, super: 128, epic: 128 } as Record<StingerMode, number>,
	/** THE LIVE TEXT (the game's glyph atlas, stinger-glyphs: Rakkas, cap 128 of em 192), material px of the cloth (u across
	 *  from its left edge, v down from its top edge on the core); cy = the cap's centre. tools/war_banner/cfg_game.py LIVE. */
	live: {
		D: { count: { cy: 172, cap: 105, maxWidth: 230 }, amount: { cy: 322, cap: 84, maxWidth: 512 }, line: { cy: 432, cap: 22, maxWidth: 520 } },
		P: { count: { cy: 164.7, cap: 100.9, maxWidth: 230 }, amount: { cy: 310.5, cap: 87.9, maxWidth: 507 }, line: { cy: 422.6, cap: 23.4, maxWidth: 522 } },
	},
	/** what each tier's light makes of the baked letters (compose.py letter_tint): the live glyphs take the same. Super
	 *  (oxblood, gold, 2026-11-15) takes a warm ivory 0xf2ede6, as in the stills Corey picked (its letter_tint ratio read
	 *  blue gray); the blue's was 0x95b0e5 */
	glyphTint: { fs: 0xfffcf9, super: 0xf2ede6, epic: 0xefebef } as Record<BannerTier, number>,
} as const;

// the files (literal URLs: Vite rewrites only `new URL('...', import.meta.url)` written out)
const D = {
	fs: { intro: stamp(new URL('../../../assets/ui/banner/banner-D-fs-intro.webp', import.meta.url).href), total: stamp(new URL('../../../assets/ui/banner/banner-D-fs-total.webp', import.meta.url).href) },
	super: { intro: stamp(new URL('../../../assets/ui/banner/banner-D-super-intro.webp', import.meta.url).href), total: stamp(new URL('../../../assets/ui/banner/banner-D-super-total.webp', import.meta.url).href) },
	epic: { intro: stamp(new URL('../../../assets/ui/banner/banner-D-epic-intro.webp', import.meta.url).href), total: stamp(new URL('../../../assets/ui/banner/banner-D-epic-total.webp', import.meta.url).href) },
};
const P = {
	fs: { intro: stamp(new URL('../../../assets/ui/banner/banner-P-fs-intro.webp', import.meta.url).href), total: stamp(new URL('../../../assets/ui/banner/banner-P-fs-total.webp', import.meta.url).href) },
	super: { intro: stamp(new URL('../../../assets/ui/banner/banner-P-super-intro.webp', import.meta.url).href), total: stamp(new URL('../../../assets/ui/banner/banner-P-super-total.webp', import.meta.url).href) },
	epic: { intro: stamp(new URL('../../../assets/ui/banner/banner-P-epic-intro.webp', import.meta.url).href), total: stamp(new URL('../../../assets/ui/banner/banner-P-epic-total.webp', import.meta.url).href) },
};
export const BANNER_TEXTURES: Record<BannerClass, Record<BannerTier, Record<BannerContent, string>>> = { D, P };
/** THE BANNER'S OWN COUNT AND AMOUNT GLYPHS (Fix 2, 2026-11-15; tools/war_banner/build_banner_glyphs.py): the plaque's
 *  glyphs under their own frame names at the density of the banner's largest draw, per texture class (D digits cap 280,
 *  the rest 224: 2 px per CSS px on a 1920 x 1080 desktop; P 214 / 186: the largest P draw at resolution 3, the cloth
 *  just under 420 CSS px wide; was 174 / 151 until 2026-11-15, which a 440 wide iPhone upscaled 1.05x). Loaded with
 *  each screen's cloth and unloaded with it. Mipmaps on D (a tablet draws it at 0.7 and a long amount shrinks to 0.67);
 *  none on P (a mip blend would soften the count at 0.76, its 390 portrait draw). */
export const BANNER_GLYPHS: Record<BannerClass, { url: string; mips: boolean }> = {
	D: { url: stamp(new URL('../../../assets/ui/banner/banner-glyphs-D.json', import.meta.url).href), mips: true },
	P: { url: stamp(new URL('../../../assets/ui/banner/banner-glyphs-P.json', import.meta.url).href), mips: false },
};
export const BANNER_MOTION_URLS = {
	json: stamp(new URL('../../../assets/ui/banner/banner-motion.json', import.meta.url).href),
	bin: stamp(new URL('../../../assets/ui/banner/banner-motion.bin', import.meta.url).href),
};
