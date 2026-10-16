import { loadTextures } from 'pixi.js';
import stamps, { fileBytes } from './assetStamp';
import { PHONE_TIER, renderResolutionFor } from './deviceTier';
import { LABEL_CAPS } from './labelGlyphs';
import { pickLabelCap } from './clusterLabel';

// Pixi's texture loader fetches through a Worker it builds from a blob: URL, and its support probe
// waits for that worker's first message with no error path. Behind a CSP whose worker-src has no
// blob: (engine.io serves games under a blob-less policy) the probe never answers and the preload
// sits at ~40% forever. Main-thread fetch + createImageBitmap costs nothing measurable here.
if (loadTextures.config) loadTextures.config.preferWorkers = false;

// Every /assets/* URL carries ?v=<content hash> (scripts/stamp-assets.mjs) because production
// serves static assets with Cache-Control: immutable. Root-absolute `/assets/...` inputs come back
// PAGE-RELATIVE: on Stake's CDN the game is served under a versioned path, so a leading slash
// resolves against the CDN root and 404s.
export const stamp = (href: string): string => {
	const rel = href.split('/assets/').pop() ?? '';
	const v = (stamps as Record<string, string>)[rel];
	const base = href.startsWith('/assets/') ? href.slice(1) : href;
	return v ? `${base}?v=${v}` : base;
};

// PHONE ASSET TIER (game/deviceTier.ts): the symbol atlas ships a half-resolution twin. BOTH
// candidates must be written as literal `new URL(..., import.meta.url)` calls — Vite rewrites those
// at build time and cannot follow a computed path.
const tiered = (full: string, half: string): string => (PHONE_TIER ? half : full);

/** Which of the cluster labels' atlases to PRELOAD: the baked cap nearest the cap height the labels will
 *  have on this screen, in canvas pixels (0.40 of a cell x the renderer's effective resolution,
 *  game/deviceTier.ts renderResolutionFor: the cap, 1.5 on the phone tier and 2 on desktop and on an allowlisted
 *  iPhone, and off the phone tier the pixel ceiling of a very large window). Only a
 *  guess from the window at boot (the cell is about 53.4 px per 1280 x 720 of a desktop window, 0.107 of a
 *  sideways phone's height, 0.097 of a portrait's width): it decides nothing but the download ORDER. The
 *  component measures the real size every frame and uses the nearest cap that is loaded, and all five are
 *  in a moment later. */
const LABEL_BOOT_CAP: number = (() => {
	if (typeof window === 'undefined') return LABEL_CAPS[0];
	const w = window.innerWidth || 1280;
	const h = window.innerHeight || 720;
	const cell = w < h ? Math.min(w * 0.097, h * 0.05) : PHONE_TIER ? h * 0.1074 : Math.min(w / 1280, h / 720) * 53.44;
	const pick = pickLabelCap(cell * 0.4 * renderResolutionFor(w, h), LABEL_CAPS.map(() => true));
	return LABEL_CAPS[pick < 0 ? 0 : pick];
})();

// THE LAYOUT AT BOOT, for the per-layout board art and backgrounds: the same breakpoints as
// utils-layout createLayout (ratio >= 1.3 wide: short side <= 480 is the phone master, else
// landscape; anything narrower is portrait). Only the boot layout's copy gates the landing screen;
// the other two ride the deferred phase, so a rotation before they land shows the flat fallback
// for a moment and never a wrong-scale texture (components/BoardFrame.svelte, Background.svelte).
/** utils-layout createLayout: a wide window (ratio >= 1.3) is the desktop landscape master only when its
 *  short side is over this many CSS px; at or under it, it is the phone master */
const LANDSCAPE_MASTER_MIN_SHORT_SIDE = 480;
const bootLayout = ((): 'landscape' | 'phone' | 'portrait' => {
	if (typeof window === 'undefined') return 'landscape';
	const w = window.innerWidth || 1;
	const h = window.innerHeight || 1;
	if (w / h >= 1.3) return Math.min(w, h) <= LANDSCAPE_MASTER_MIN_SHORT_SIDE ? 'phone' : 'landscape';
	return 'portrait';
})();
const atBoot = (kind: 'landscape' | 'phone' | 'portrait') => bootLayout === kind;
/** which of the two courtyard scenes the boot layout draws: the 16:9 one (landscape and phone sideways) or the 9:16
 *  one (portrait). Only that one gates the landing screen; the other is not registered at all (SCENE_LATE). */
const sceneAtBoot = bootLayout !== 'portrait';
const portraitSceneAtBoot = !sceneAtBoot;
/** THE AMBIENT SKY's wisp and fog atlas and the birds are drawn by BOTH scenes' skies (2026-10-12: the portrait scene has
 *  the sky too), so they preload with whichever scene the boot layout draws: always. Written as a sum of the two so
 *  scripts/stamp-assets.mjs keeps counting none of the scenes' files into the loading bar's weights. */
const skyAtBoot = sceneAtBoot || portraitSceneAtBoot;

// TWO LOAD PHASES (pixi-svelte AssetsLoader). `preload: true` gates the landing screen: everything
// the base game draws in its first seconds. `preload: false` keeps downloading behind the game.
//
// The static symbol atlas, the backdrop, numerals and audio manifests preload; the symbol drop and
// idle sheets (4.4 MB phone tier, 13.6 MB full) ride the deferred phase (game/assetGate.ts).
const assets = {
	// the ten static symbol tiles (the approved handoff art, lossless), the x2..x128 multiplier
	// overlays and one empty cell well (tools/pack_symbol_sheets.py rebuilds it)
	mmSymbols: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/mmSymbols.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/mmSymbols-half.json', import.meta.url).href),
		),
		preload: true,
	},
	// THE SYMBOL SHEETS (tools/pack_symbol_sheets.py, tools/SYMBOL_SHEETS.md): per symbol a drop
	// sheet (plays from the landing contact) and an idle loop, 256 px cells with a 128 px phone twin.
	// DEFERRED: they never gate the landing screen. Until they are in, every cell shows its static
	// atlas frame (components/BoardCells.svelte). L2's idle is a single still and L3 has none, so
	// neither is loaded (constants SYMBOL_ANIM). Frame names <code>-drop-000 / <code>-idle-000.
	mmDrop_l1: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/l1-drop.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/l1-drop-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmIdle_l1: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/l1-idle.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/l1-idle-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmDrop_l2: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/l2-drop.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/l2-drop-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmDrop_l3: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/l3-drop.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/l3-drop-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmDrop_l4: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/l4-drop.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/l4-drop-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmIdle_l4: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/l4-idle.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/l4-idle-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmDrop_m1: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/m1-drop.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/m1-drop-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmIdle_m1: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/m1-idle.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/m1-idle-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmDrop_m2: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/m2-drop.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/m2-drop-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmIdle_m2: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/m2-idle.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/m2-idle-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmDrop_m3: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/m3-drop.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/m3-drop-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmIdle_m3: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/m3-idle.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/m3-idle-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmDrop_h1: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/h1-drop.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/h1-drop-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmIdle_h1: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/h1-idle.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/h1-idle-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmDrop_w: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/w-drop.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/w-drop-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmIdle_w: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/w-idle.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/w-idle-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmDrop_s: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/s-drop.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/s-drop-half.json', import.meta.url).href),
		),
		preload: false,
	},
	mmIdle_s: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/s-idle.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/s-idle-half.json', import.meta.url).href),
		),
		preload: false,
	},
	// the 8x8 grid of cell wells behind the tiles: shows in the seams, in the drop and in every
	// emptied cell during a cascade
	boardBackdrop: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-backdrop.webp', import.meta.url).href), preload: true },
	// THE BOARD WELLS (game/wells.ts, constants WELLS / WELLS_FX; tools/build_board_wells.py): the 64 cells' marble
	// (four variants in one atlas) and the same veins as light for the reactive light-ups (greyscale, drawn additive).
	// Both at boot: the wells are under every cell from the first board, and the first win can light the veins.
	// The phone tier takes the half atlases (128 px cells).
	boardWells: { type: 'sprite', src: tiered(stamp(new URL('../../assets/ui/board-wells.webp', import.meta.url).href), stamp(new URL('../../assets/ui/board-wells-half.webp', import.meta.url).href)), preload: true },
	boardWellsGlow: { type: 'sprite', src: tiered(stamp(new URL('../../assets/ui/board-wells-glow.webp', import.meta.url).href), stamp(new URL('../../assets/ui/board-wells-glow-half.webp', import.meta.url).href)), preload: true },
	// THE BOARD FRAME and its chain loop tiles (tools/build_board_layers.py from the board_v5j renders;
	// registration in game/boardArt.ts), one scale per layout: the boot layout's preloads. boardChains_* is
	// the seamless two-link tile pair (L, R) the strips repeat (CHAIN_BOW haul, 2026-10-07)
	boardFrame_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-landscape.webp', import.meta.url).href), preload: atBoot('landscape') },
	boardFrame_phone: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-phone.webp', import.meta.url).href), preload: atBoot('phone') },
	boardFrame_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-portrait.webp', import.meta.url).href), preload: atBoot('portrait') },
	boardChains_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-chain-tile-landscape.webp', import.meta.url).href), preload: atBoot('landscape') },
	boardChains_phone: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-chain-tile-phone.webp', import.meta.url).href), preload: atBoot('phone') },
	boardChains_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-chain-tile-portrait.webp', import.meta.url).href), preload: atBoot('portrait') },
	// THE FRAME'S RELIGHT AND ITS TURNING GEARS (constants FRAME_RELIGHT; tools/board_relight.py; Corey 2026-10-11).
	// boardFrame_* above is now the D1 PLATE: the frame lit for the day WITHOUT its six turning parts, and the chain
	// tile sheet holds the day, night and fire chains side by side.
	//   boardGears_<layout>        one atlas: the six day gear loops (100 cells) and the contact shadow. The base game
	//                              draws it from the first frame, so it rides with the plate: the boot layout's
	//                              preloads, the other two in the deferred phase.
	//   boardFrameNight_<layout>, boardFrameFire_<layout>, boardGearsNight_<layout>
	//                              the NIGHT set (SUPER and EPIC): the night plate, the fire plate (half size, added)
	//                              and one atlas with the six night loops and the six fire loops. Never at boot: the
	//                              boot layout's set is its own deferred group after the scene's night (DEFERRED_ORDER
	//                              frameNight), and the other two layouts' sets are not registered at all
	//                              (FRAME_NIGHT_LATE): game/deferredLoad.ts loadFrameNightLate fetches a layout's set
	//                              the first time the game is turned to it. Until a set is in, that layout's frame
	//                              keeps its day light in every mode, as it always did, and fades to night when it lands.
	// The PHONE master's new layers have a half size twin for the phone tier (game/deviceTier.ts): its textures are 2
	// texture px per master px, and a phone tier screen draws at most 1.01 canvas px per master px (short side <= 500
	// CSS px over the 740 master, at the 1.5 resolution cap), so the twin is still 1 : 1 there at a quarter of the memory.
	boardGears_landscape: { type: 'sprites', src: stamp(new URL('../../assets/ui/board-gears-landscape.json', import.meta.url).href), preload: atBoot('landscape') },
	boardGears_phone: { type: 'sprites', src: tiered(stamp(new URL('../../assets/ui/board-gears-phone.json', import.meta.url).href), stamp(new URL('../../assets/ui/board-gears-phone-half.json', import.meta.url).href)), preload: atBoot('phone') },
	boardGears_portrait: { type: 'sprites', src: stamp(new URL('../../assets/ui/board-gears-portrait.json', import.meta.url).href), preload: atBoot('portrait') },
	// THE SPIN AMOUNT PLAQUE (images/spin_amount_final/SPEC.md, components/BoardPlaque.svelte): per layout the day plaque, its
	// shadow and the crest ride with the frame (the boot layout's preload); the night, fire and crest night / fire join the
	// frame's night set (FRAME_NIGHT_KEYS: the boot layout's deferred group, the other layouts' late load). The figures'
	// atlas (Cinzel Bold in inlaid brass, plaque-numerals; the half for the phone tier) preloads: a win can come on the first spin.
	boardPlaque_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-landscape.webp', import.meta.url).href), preload: atBoot('landscape') },
	boardPlaqueShadow_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-shadow-landscape.webp', import.meta.url).href), preload: atBoot('landscape') },
	boardPlaqueCrest_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-crest-landscape.webp', import.meta.url).href), preload: atBoot('landscape') },
	boardPlaque_phone: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-phone.webp', import.meta.url).href), preload: atBoot('phone') },
	boardPlaqueShadow_phone: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-shadow-phone.webp', import.meta.url).href), preload: atBoot('phone') },
	boardPlaqueCrest_phone: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-crest-phone.webp', import.meta.url).href), preload: atBoot('phone') },
	boardPlaque_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-portrait.webp', import.meta.url).href), preload: atBoot('portrait') },
	boardPlaqueShadow_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-shadow-portrait.webp', import.meta.url).href), preload: atBoot('portrait') },
	boardPlaqueCrest_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-crest-portrait.webp', import.meta.url).href), preload: atBoot('portrait') },
	boardPlaqueNight_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-night-landscape.webp', import.meta.url).href), preload: false },
	boardPlaqueFire_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-fire-landscape.webp', import.meta.url).href), preload: false },
	boardPlaqueCrestNight_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-crest-night-landscape.webp', import.meta.url).href), preload: false },
	boardPlaqueCrestFire_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-crest-fire-landscape.webp', import.meta.url).href), preload: false },
	boardPlaqueNight_phone: { type: 'sprite', src: tiered(stamp(new URL('../../assets/ui/board-plaque-night-phone.webp', import.meta.url).href), stamp(new URL('../../assets/ui/board-plaque-night-phone-half.webp', import.meta.url).href)), preload: false },
	boardPlaqueFire_phone: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-fire-phone.webp', import.meta.url).href), preload: false },
	boardPlaqueCrestNight_phone: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-crest-night-phone.webp', import.meta.url).href), preload: false },
	boardPlaqueCrestFire_phone: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-crest-fire-phone.webp', import.meta.url).href), preload: false },
	boardPlaqueNight_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-night-portrait.webp', import.meta.url).href), preload: false },
	boardPlaqueFire_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-fire-portrait.webp', import.meta.url).href), preload: false },
	boardPlaqueCrestNight_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-crest-night-portrait.webp', import.meta.url).href), preload: false },
	boardPlaqueCrestFire_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-plaque-crest-fire-portrait.webp', import.meta.url).href), preload: false },
	plaqueNumerals: { type: 'sprites', src: tiered(stamp(new URL('../../assets/ui/plaque-numerals/plaque-numerals.json', import.meta.url).href), stamp(new URL('../../assets/ui/plaque-numerals/plaque-numerals-half.json', import.meta.url).href)), preload: true },
	boardFrameNight_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-night-landscape.webp', import.meta.url).href), preload: false },
	boardFrameNight_phone: { type: 'sprite', src: tiered(stamp(new URL('../../assets/ui/board-frame-night-phone.webp', import.meta.url).href), stamp(new URL('../../assets/ui/board-frame-night-phone-half.webp', import.meta.url).href)), preload: false },
	boardFrameNight_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-night-portrait.webp', import.meta.url).href), preload: false },
	boardFrameFire_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-fire-landscape.webp', import.meta.url).href), preload: false },
	boardFrameFire_phone: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-fire-phone.webp', import.meta.url).href), preload: false },
	boardFrameFire_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-fire-portrait.webp', import.meta.url).href), preload: false },
	boardGearsNight_landscape: { type: 'sprites', src: stamp(new URL('../../assets/ui/board-gears-night-landscape.json', import.meta.url).href), preload: false },
	boardGearsNight_phone: { type: 'sprites', src: tiered(stamp(new URL('../../assets/ui/board-gears-night-phone.json', import.meta.url).href), stamp(new URL('../../assets/ui/board-gears-night-phone-half.json', import.meta.url).href)), preload: false },
	boardGearsNight_portrait: { type: 'sprites', src: stamp(new URL('../../assets/ui/board-gears-night-portrait.json', import.meta.url).href), preload: false },
	// THE PLACEHOLDER BACKGROUND (the citadel courtyard painting for every mode). Every layout now draws a courtyard
	// scene (below) and only falls back to this while that scene's files are on their way or if they failed: a game
	// that was turned loads the other layout's scene then (SCENE_LATE). So NONE of these entries stays registered
	// (see "by boot layout" below): the boot layout never draws its crop, and the other layouts' crops are fetched
	// with their scene, at the turn (PLACEHOLDER_LATE), not on every session that never turns.
	bg_base_landscape: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-landscape.webp', import.meta.url).href), preload: atBoot('landscape') },
	bg_base_phone: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-phone.webp', import.meta.url).href), preload: atBoot('phone') },
	bg_base_portrait: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-portrait.webp', import.meta.url).href), preload: atBoot('portrait') },
	// PLACEHOLDER ALIASES (2026-10-09): bonus-*, super-* and epic-*.webp are byte for byte the base file of
	// the same layout today (md5 checked), so the nine feature keys point AT the base file: one download
	// and one texture per layout instead of four (Pixi's loader caches by URL). The keys stay, so
	// components/Background.svelte and everything else is unchanged. THIS ENDS WHEN THE REAL FEATURE SCENES
	// ARRIVE: point each key back at its own file. The nine copies left the shipped build on 2026-10-15 (download
	// analysis S1): they are in ~/Desktop/Manticore Mayhem/_archive/shipped-build-removed-2026-10-15/static/assets/backgrounds/.
	bg_bonus_landscape: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-landscape.webp', import.meta.url).href), preload: false },
	bg_bonus_phone: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-phone.webp', import.meta.url).href), preload: false },
	bg_bonus_portrait: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-portrait.webp', import.meta.url).href), preload: false },
	bg_super_landscape: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-landscape.webp', import.meta.url).href), preload: false },
	bg_super_phone: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-phone.webp', import.meta.url).href), preload: false },
	bg_super_portrait: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-portrait.webp', import.meta.url).href), preload: false },
	bg_epic_landscape: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-landscape.webp', import.meta.url).href), preload: false },
	bg_epic_phone: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-phone.webp', import.meta.url).href), preload: false },
	bg_epic_portrait: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-portrait.webp', import.meta.url).href), preload: false },
	// THE COURTYARD SCENE (components/Background.svelte, game/scene.ts, tools/build_scene_assets.py; constants SCENE):
	// the LANDSCAPE and PHONE SIDEWAYS background, one set for both (they share the scene's camera), 2560 wide with a
	// 1600 wide phone tier twin. The DAY set (backdrop, foreground, the fire pass and the chains' one atlas, which
	// holds the night chains too: 75 KB) is what the first screen draws, so it preloads when the game boots in one of
	// those layouts; the NIGHT backdrop and foreground (Super and Epic) ride the deferred phase, after the plaque
	// (DEFERRED_ORDER). A game that boots in PORTRAIT registers none of it (SCENE_LATE below): it has its own scene.
	scene_backdrop_day: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/backdrop-day.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/backdrop-day-phone.webp', import.meta.url).href)), preload: sceneAtBoot },
	scene_fore_day: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/fore-day.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/fore-day-phone.webp', import.meta.url).href)), preload: sceneAtBoot },
	scene_fire: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/fire.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/fire-phone.webp', import.meta.url).href)), preload: sceneAtBoot },
	sceneChains: { type: 'sprites', src: tiered(stamp(new URL('../../assets/backgrounds/scene/chains.json', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/chains-phone.json', import.meta.url).href)), preload: sceneAtBoot },
	// THE AMBIENT SKY of that scene (game/sky.ts, constants SKY; tools/build_scene_assets.py --sky): the day ridge cut-out,
	// the wisp and fog atlas and the birds ride with the day set, the night cut-out and the BATS' own small sheet
	// (sceneBats: the birds' canvas and rectangles, frames bat_<row>_<frame>.png, one file for both tiers like the
	// birds) with the night set (SCENE_KEYS), so they follow the scene's own boot order. The atlas, the birds and the bats
	// are SHARED with the portrait scene's sky (same keys, same files, one copy on the GPU); only the cut-outs are per scene.
	// A portrait boot registers neither landscape cut-out.
	scene_ridge_day: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/ridge-day.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/ridge-day-phone.webp', import.meta.url).href)), preload: sceneAtBoot },
	sceneSky: { type: 'sprites', src: tiered(stamp(new URL('../../assets/backgrounds/scene/sky.json', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/sky-phone.json', import.meta.url).href)), preload: skyAtBoot },
	sceneBirds: { type: 'sprites', src: stamp(new URL('../../assets/backgrounds/scene/birds.json', import.meta.url).href), preload: skyAtBoot },
	// THE BRAZIER FLAMES of that scene (game/flames.ts, constants FLAMES; tools/build_flame_assets.py): one atlas per clip
	// and a small one with the rim occluders and the ember dot. The BASE clip and the cuts ride with the day set (the
	// braziers burn from the first frame); the SUPER and EPIC clips ride the deferred phase, one group each after the
	// night set (DEFERRED_ORDER), and until one is in its mode keeps the base clip burning. A portrait boot registers
	// none of them (SCENE_LATE).
	sceneFlameBase: { type: 'sprites', src: tiered(stamp(new URL('../../assets/backgrounds/scene/flame-base.json', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/flame-base-phone.json', import.meta.url).href)), preload: sceneAtBoot },
	sceneFlameFx: { type: 'sprites', src: tiered(stamp(new URL('../../assets/backgrounds/scene/flame-fx.json', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/flame-fx-phone.json', import.meta.url).href)), preload: sceneAtBoot },
	sceneFlameSuper: { type: 'sprites', src: tiered(stamp(new URL('../../assets/backgrounds/scene/flame-super.json', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/flame-super-phone.json', import.meta.url).href)), preload: false },
	sceneFlameEpic: { type: 'sprites', src: tiered(stamp(new URL('../../assets/backgrounds/scene/flame-epic.json', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/flame-epic-phone.json', import.meta.url).href)), preload: false },
	sceneBats: { type: 'sprites', src: stamp(new URL('../../assets/backgrounds/scene/bats.json', import.meta.url).href), preload: false },
	scene_ridge_night: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/ridge-night.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/ridge-night-phone.webp', import.meta.url).href)), preload: false },
	scene_backdrop_night: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/backdrop-night.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/backdrop-night-phone.webp', import.meta.url).href)), preload: false },
	scene_fore_night: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/fore-night.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/fore-night-phone.webp', import.meta.url).href)), preload: false },
	// THE PORTRAIT COURTYARD SCENE (the same components and tool, --portrait): its own 9:16 frame, 1440 x 2560 with a
	// 900 x 1600 phone tier twin. Backdrop, foreground and fire pass; no atlas (nothing moves in portrait). The day set
	// preloads when the game boots in PORTRAIT and the night set rides the deferred phase; booted in another layout,
	// none of it is registered (SCENE_LATE).
	scenep_backdrop_day: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/portrait-backdrop-day.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/portrait-backdrop-day-phone.webp', import.meta.url).href)), preload: portraitSceneAtBoot },
	scenep_fore_day: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/portrait-fore-day.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/portrait-fore-day-phone.webp', import.meta.url).href)), preload: portraitSceneAtBoot },
	scenep_fire: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/portrait-fire.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/portrait-fire-phone.webp', import.meta.url).href)), preload: portraitSceneAtBoot },
	scenep_backdrop_night: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/portrait-backdrop-night.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/portrait-backdrop-night-phone.webp', import.meta.url).href)), preload: false },
	scenep_fore_night: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/portrait-fore-night.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/portrait-fore-night-phone.webp', import.meta.url).href)), preload: false },
	// THE PORTRAIT SKY's own files (2026-10-12; game/sky.ts, constants SKY.portrait; tools/build_scene_assets.py
	// --portrait-sky): only the skyline cut-outs of the portrait backdrops, day with the portrait day set, night with its
	// night set. Its clouds, fog, aurora, birds and bats draw the landscape sky's sceneSky, sceneBirds and sceneBats.
	scenep_ridge_day: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/portrait-ridge-day.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/portrait-ridge-day-phone.webp', import.meta.url).href)), preload: portraitSceneAtBoot },
	scenep_ridge_night: { type: 'sprite', src: tiered(stamp(new URL('../../assets/backgrounds/scene/portrait-ridge-night.webp', import.meta.url).href), stamp(new URL('../../assets/backgrounds/scene/portrait-ridge-night-phone.webp', import.meta.url).href)), preload: false },
	// THE CLUSTER LABELS' GLYPHS (components/ClusterLabels.svelte, game/clusterLabel.ts; built by
	// tools/build_plaque_text.py --labels): the forged Rakkas face baked at five cap heights in canvas
	// pixels, one small atlas each (60 to 180 KB), so a label is drawn at about 1:1 on any screen. ONE is
	// preloaded, the cap this screen needs at boot (labelCapForBoot), so the first cluster win already
	// draws from it; the rest ride the deferred phase and the component moves to the nearest loaded cap
	// when the window or the orientation changes.
	labelGlyphs24: { type: 'sprites', src: stamp(new URL('../../assets/ui/labels/label-glyphs-24.json', import.meta.url).href), preload: LABEL_BOOT_CAP === 24 },
	labelGlyphs30: { type: 'sprites', src: stamp(new URL('../../assets/ui/labels/label-glyphs-30.json', import.meta.url).href), preload: LABEL_BOOT_CAP === 30 },
	labelGlyphs38: { type: 'sprites', src: stamp(new URL('../../assets/ui/labels/label-glyphs-38.json', import.meta.url).href), preload: LABEL_BOOT_CAP === 38 },
	labelGlyphs48: { type: 'sprites', src: stamp(new URL('../../assets/ui/labels/label-glyphs-48.json', import.meta.url).href), preload: LABEL_BOOT_CAP === 48 },
	labelGlyphs60: { type: 'sprites', src: stamp(new URL('../../assets/ui/labels/label-glyphs-60.json', import.meta.url).href), preload: LABEL_BOOT_CAP === 60 },
	// stencil numerals: every amount glyph in one atlas, so amounts render as batched sprites with
	// ZERO per-frame rasterization (components/ArtAmount.svelte)
	numeralsAtlas: {
		type: 'sprites',
		src: stamp(new URL('../../assets/ui/numerals/numerals.json', import.meta.url).href),
		preload: true,
	},
	// the multiplier plates' numbers (components/BoardCells.svelte): Barlow Condensed 700, plain white
	// glyphs (the plate tints them), 0-9 x and the multiplication sign, one 512 x 256 sheet with mipmaps
	// (tools/build_stencil_atlas.py --font, metrics in game/plateGlyphs.ts)
	plateNumeralsAtlas: {
		type: 'sprites',
		src: stamp(new URL('../../assets/ui/numerals/plate-numerals.json', import.meta.url).href),
		preload: true,
	},
	// THE ANIMATED WIN PLAQUE (components/StingerPlaque.svelte, tools/build_stinger_assets.py): the 15 layered
	// cut-outs, the overlay sprites, the 14 glint slices, the baked titles and the forged glyphs, each with a
	// phone tier twin. DEFERRED: a big win or a feature intro is never in the game's first seconds.
	stingerPlaque: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/ui/stinger/stinger-plaque.json', import.meta.url).href),
			stamp(new URL('../../assets/ui/stinger/stinger-plaque-half.json', import.meta.url).href),
		),
		preload: false,
	},
	stingerFx: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/ui/stinger/stinger-fx.json', import.meta.url).href),
			stamp(new URL('../../assets/ui/stinger/stinger-fx-half.json', import.meta.url).href),
		),
		preload: false,
	},
	stingerGlint: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/ui/stinger/stinger-glint.json', import.meta.url).href),
			stamp(new URL('../../assets/ui/stinger/stinger-glint-half.json', import.meta.url).href),
		),
		preload: false,
	},
	stingerTitles: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/ui/stinger/stinger-titles.json', import.meta.url).href),
			stamp(new URL('../../assets/ui/stinger/stinger-titles-half.json', import.meta.url).href),
		),
		preload: false,
	},
	stingerGlyphs: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/ui/stinger/stinger-glyphs.json', import.meta.url).href),
			stamp(new URL('../../assets/ui/stinger/stinger-glyphs-half.json', import.meta.url).href),
		),
		preload: false,
	},
	// THE CANVAS LOGO (components/Logo.svelte, tools/build_logo_assets.py): one atlas with the wings, the letters,
	// both shadows and the 18 glint slices. Desktop tier only (the phone tier's logo is the chrome's <img>: the
	// entry is removed below). Never gates the landing screen: it starts when the preload ends (game/deferredLoad.ts
	// loadLogoEarly) and the still stands in until it lands (game/logo/state.svelte.ts).
	// THE LOGO'S STILL, DRAWN IN THE CANVAS (game/logo/still.ts; 2026-10-13: the logo is under the creature in every
	// layout, so it can no longer be the chrome's <img>). Every tier, at boot: the landing screen has already fetched
	// both files (the same stamped URLs), so this is a cache hit and one decode. The glint is the Shine's letter mask.
	logoStill: { type: 'sprite', src: stamp(new URL('../../assets/ui/logo-stacked.webp', import.meta.url).href), preload: true },
	logoGlint: { type: 'sprite', src: stamp(new URL('../../assets/ui/logo-stacked-glint.webp', import.meta.url).href), preload: true },
	logoAtlas: { type: 'sprites', src: stamp(new URL('../../assets/ui/logo/logo.json', import.meta.url).href), preload: false },
	sound: {
		type: 'audio',
		src: stamp(new URL('../../assets/audio/sounds.json', import.meta.url).href),
		preload: true,
	},
	// music manifest: the tracks stream one file at a time, so only this small JSON is fetched here
	music: {
		type: 'audio',
		src: stamp(new URL('../../assets/audio/music.json', import.meta.url).href),
		preload: true,
	},
} as const;

// the win plaque's runtime data (game/stinger/data.ts fetches both itself: recipes + int16 vertex tracks)
export const STINGER_DATA_URLS = {
	json: stamp(new URL('../../assets/ui/stinger/stinger.json', import.meta.url).href),
	bin: stamp(new URL('../../assets/ui/stinger/stinger-motion.bin', import.meta.url).href),
};

// the canvas logo's runtime data (game/logo/data.ts fetches both itself: topology + int16 vertex tracks)
export const LOGO_DATA_URLS = {
	json: stamp(new URL('../../assets/ui/logo/logo-data.json', import.meta.url).href),
	bin: stamp(new URL('../../assets/ui/logo/logo-motion.bin', import.meta.url).href),
};
// the phone tier never draws the canvas logo: nothing downloads or decodes its atlas there
if (PHONE_TIER) delete (assets as unknown as Record<string, unknown>).logoAtlas;

// Every asset carries its download size (scripts/stamp-assets.mjs fileBytes) so pixi-svelte's
// AssetsLoader can weight the preload's progress by bytes rather than by file count.
const bytesFor = (src: unknown): number | undefined => {
	if (typeof src !== 'string') return undefined;
	const m = /\/assets\/([^?#]+)/.exec(src);
	return m ? (fileBytes as Record<string, number>)[m[1]] : undefined;
};
for (const entry of Object.values(assets) as { src: unknown; bytes?: number }[]) {
	const bytes = bytesFor(entry.src);
	if (bytes) entry.bytes = bytes;
}

// (The DEV symbol style trial, `?symbols=<style>` over static/assets/sprites/mmSymbols-trial/, was removed with that
// folder on 2026-10-14: the folder must not ship. Folder archived at ~/Desktop/Manticore Mayhem/_archive/
// shipped-build-removed-2026-10-14/; the hook is in git history before that date.)

// ART NO SCREEN OF THIS DEVICE CAN SHOW (2026-10-09). The desktop landscape master needs a wide window whose
// SHORT side is over 480 CSS px (utils-layout createLayout, the breakpoints `bootLayout` above repeats). A
// phone tier device (game/deviceTier.ts: coarse pointer, screen short side <= 500) whose screen short side
// is at most 480 can never open such a window, in either orientation, so the landscape frame, chain tile
// and backgrounds are never registered there: nothing downloads them and nothing decodes them. The reverse
// is NOT true (a desktop shows the phone master in Stake's Popout S, 400 x 225), so every other device keeps
// all three layouts, and a rotation never waits on a download. The entries are kept in UNREACHABLE_ASSETS:
// if such a device ever does report a landscape window (a browser's "desktop site" mode can), game/
// deferredLoad.ts fetches them then, so the worst case is the old flat fallback for one download.
export const UNREACHABLE_ASSETS: Record<string, { type: string; src: string }> = {};
const LANDSCAPE_ONLY_KEYS = ['boardFrame_landscape', 'boardGears_landscape', 'boardChains_landscape', 'bg_base_landscape', 'bg_bonus_landscape', 'bg_super_landscape', 'bg_epic_landscape'] as const;
const phoneOnlyScreen = (): boolean => {
	if (!PHONE_TIER || typeof window === 'undefined') return false;
	const short = Math.min(window.screen?.width ?? Infinity, window.screen?.height ?? Infinity);
	return short <= LANDSCAPE_MASTER_MIN_SHORT_SIDE && bootLayout !== 'landscape';
};
// THE SCENES AND THE PLACEHOLDER, BY BOOT LAYOUT (2026-10-10). Before the unreachable art is taken out below:
//   booted in landscape or phone sideways   the 16:9 scene is the background from the first frame, and NONE of the
//                                           portrait scene's files is registered.
//   booted in portrait                      the mirror: the 9:16 scene from the first frame, none of the 16:9
//                                           scene's files registered.
// (2026-10-12: but for the three files both scenes' skies draw, SCENE_SHARED_KEYS, which every boot registers.)
// The scene that is not registered waits in SCENE_LATE. The first time the layout becomes one of its own,
// game/deferredLoad.ts loadSceneLate fetches its day set, then its night set.
// THE PLACEHOLDER'S CROPS are registered in NO boot (2026-10-10; until then the other layouts' crops rode the
// deferred phase, so a desktop that never turns still fetched base-portrait.webp). The boot layout's crop is never
// drawn. The other layouts' crops wait in PLACEHOLDER_LATE (the base key per layout: the feature keys were aliases of
// the same file); loadPlaceholderLate fetches the one for the layout the game was turned to, beside that layout's
// scene, and it stands in until the scene fades in over it, or for good if the scene's files fail.
export const SCENE_KEYS = {
	landscape: { day: ['scene_backdrop_day', 'scene_fore_day', 'scene_fire', 'sceneChains', 'scene_ridge_day', 'sceneSky', 'sceneBirds', 'sceneFlameBase', 'sceneFlameFx'], night: ['scene_backdrop_night', 'scene_fore_night', 'scene_ridge_night', 'sceneBats'], flames: ['sceneFlameSuper', 'sceneFlameEpic'] },
	portrait: { day: ['scenep_backdrop_day', 'scenep_fore_day', 'scenep_fire', 'scenep_ridge_day', 'sceneSky', 'sceneBirds'], night: ['scenep_backdrop_night', 'scenep_fore_night', 'scenep_ridge_night', 'sceneBats'], flames: [] },
} as const;
/** the keys BOTH scenes list (the sky's atlas, the birds, the bats): registered in every boot, fetched once, never late */
export const SCENE_SHARED_KEYS: readonly string[] = [...SCENE_KEYS.portrait.day, ...SCENE_KEYS.portrait.night].filter((key) => ([...SCENE_KEYS.landscape.day, ...SCENE_KEYS.landscape.night] as string[]).includes(key));
/** the scene the boot layout draws, and the one that waits */
export const SCENE_AT_BOOT: keyof typeof SCENE_KEYS = sceneAtBoot ? 'landscape' : 'portrait';
export const SCENE_LATE: Record<string, { type: string; src: string }> = {};
export const PLACEHOLDER_LATE: Record<string, { type: string; src: string }> = {};
{
	const table = assets as unknown as Record<string, { type: string; src: string }>;
	for (const key of Object.keys(table)) {
		if (!/^bg_[a-z]+_(landscape|phone|portrait)$/.test(key)) continue;
		if (key.startsWith('bg_base_') && key !== `bg_base_${bootLayout}`) PLACEHOLDER_LATE[key] = table[key];
		delete table[key];
	}
	const late = SCENE_KEYS[sceneAtBoot ? 'portrait' : 'landscape'];
	for (const key of [...late.day, ...late.night, ...late.flames]) {
		// what the boot layout's scene draws too stays registered (it loads with that scene)
		if (SCENE_SHARED_KEYS.includes(key)) continue;
		SCENE_LATE[key] = table[key];
		delete table[key];
	}
}

// THE FRAME'S NIGHT SET, BY BOOT LAYOUT (2026-10-11): the boot layout's three files stay registered (deferred, their
// own group below); the other two layouts' wait here, keyed by layout, and are fetched the first time the game is
// turned to that layout (game/deferredLoad.ts loadFrameNightLate, asked by components/BoardFrame.svelte). A desktop
// that is never resized into the phone master never downloads or decodes that master's 30 MB night set.
export const FRAME_NIGHT_KEYS = (kind: 'landscape' | 'phone' | 'portrait'): string[] => [`boardFrameNight_${kind}`, `boardFrameFire_${kind}`, `boardGearsNight_${kind}`, `boardPlaqueNight_${kind}`, `boardPlaqueFire_${kind}`, `boardPlaqueCrestNight_${kind}`, `boardPlaqueCrestFire_${kind}`];
export const FRAME_NIGHT_LATE: Record<string, Record<string, { type: string; src: string }>> = {};
{
	const table = assets as unknown as Record<string, { type: string; src: string }>;
	for (const kind of ['landscape', 'phone', 'portrait'] as const) {
		if (kind === bootLayout) continue;
		FRAME_NIGHT_LATE[kind] = {};
		for (const key of FRAME_NIGHT_KEYS(kind)) {
			FRAME_NIGHT_LATE[kind][key] = table[key];
			delete table[key];
		}
	}
}

if (phoneOnlyScreen()) {
	const table = assets as unknown as Record<string, { type: string; src: string }>;
	for (const key of LANDSCAPE_ONLY_KEYS) {
		if (!table[key]) continue; // the placeholder's landscape crop is already out when the scene is in
		UNREACHABLE_ASSETS[key] = table[key];
		delete table[key];
	}
}

// THE DEFERRED PHASE'S ORDER (game/deferredLoad.ts loads these groups one after another and publishes each
// as it lands; pixi-svelte's AssetsLoader then finishes with whatever is left: the other layouts' art).
//   plaque  the win plaque's five atlases: a Big Win or a feature intro can come on the first spin, and
//           used to wait behind every symbol sheet
//   night   the boot layout's courtyard scene's night backdrop and foreground (Super and Epic; landscape 0.87 MB,
//           0.45 MB on the phone tier; portrait 0.34 MB, 0.16 MB):
//           a Super or Epic feature can be bought on the first spin, and until these are in it plays over the day
//           scene (components/Background.svelte).
//   frameNight   the boot layout's board frame night set (constants FRAME_RELIGHT: the night plate, the fire plate and
//           the night + fire gear atlas; landscape 0.77 MB, portrait 0.63 MB, phone 1.28 MB or 0.57 MB on the phone
//           tier), right after the scene's own night: until it is in, a Super or Epic keeps the frame in its day light.
//   flameSuper, flameEpic   the landscape scene's SUPER and EPIC flame clips (game/flames.ts; 0.68 and 1.14 MB, 0.50 and
//           0.89 MB on the phone tier; none when the game booted in portrait), one group each so each is uploaded by
//           itself when it lands: until then that mode's braziers keep the base clip burning.
//   logo    the canvas logo's atlas, with its tracks (desktop tier only, 0.35 MB). Normally in before this
//           phase starts (deferredLoad.ts loadLogoEarly); here it is the fallback, after the plaque
//   labels  the cluster label caps that were not preloaded (the one this screen needs already is; these
//           are for a resize or a rotation, so they follow the plaque rather than hold it up: 0.5 MB)
//   drop    the symbols' drop sheets (a landing plays one on every spin)
//   idle    the symbols' idle loops
const deferredKeys = (prefix: string) =>
	Object.entries(assets as unknown as Record<string, { preload?: boolean }>)
		.filter(([key, entry]) => key.startsWith(prefix) && !entry.preload)
		.map(([key]) => key);
export const DEFERRED_ORDER: { name: 'plaque' | 'night' | 'frameNight' | 'flameSuper' | 'flameEpic' | 'logo' | 'labels' | 'drop' | 'idle'; keys: string[] }[] = [
	{ name: 'plaque', keys: deferredKeys('stinger') },
	{ name: 'night', keys: [...SCENE_KEYS[SCENE_AT_BOOT].night] },
	{ name: 'frameNight', keys: FRAME_NIGHT_KEYS(bootLayout) },
	{ name: 'flameSuper', keys: SCENE_KEYS[SCENE_AT_BOOT].flames.slice(0, 1) },
	{ name: 'flameEpic', keys: SCENE_KEYS[SCENE_AT_BOOT].flames.slice(1) },
	{ name: 'logo', keys: deferredKeys('logoAtlas') },
	{ name: 'labels', keys: deferredKeys('labelGlyphs') },
	{ name: 'drop', keys: deferredKeys('mmDrop_') },
	{ name: 'idle', keys: deferredKeys('mmIdle_') },
];
/** the plaque cannot build without ALL of these (they publish together or not at all) */
export const PLAQUE_ATLAS_KEYS = deferredKeys('stinger');

export default assets;
