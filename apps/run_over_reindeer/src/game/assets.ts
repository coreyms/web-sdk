// The asset manifest pixi-svelte's loader works through, and the cache-busting stamp every asset URL goes through.
//
// Everything here is PRELOADED (the base game draws all of it in its first seconds, and the whole set is small).
// When feature art lands (the column Wild characters, the crash cloud) it goes in as `preload: false` with its own
// gate, as the house rule says: nothing a feature alone needs may hold up PRESS ANYWHERE.
import { loadTextures } from 'pixi.js';
import stamps from './assetStamp';
import { PHONE_TIER } from './deviceTier';
import { BOOT_SCENE_SET } from './sceneChoice';

// The texture loader's worker must be off: it builds the worker from an object URL, and the platform's content
// security policy has no `blob:` source (house rule; the preload sits at about 40 percent forever otherwise).
if (loadTextures.config) loadTextures.config.preferWorkers = false;

/** `?v=<content hash>` on an asset URL (production serves assets as immutable). Never reference a static asset bare. */
export const stamp = (href: string): string => {
	const rel = href.split('/assets/').pop() ?? '';
	const v = (stamps as Record<string, string>)[rel];
	// never a root-absolute URL: the game is served from a versioned subfolder
	const base = href.startsWith('/assets/') ? href.slice(1) : href;
	return v ? `${base}?v=${v}` : base;
};

/** the upright phone's forest (game/scenePresets.ts snowDay forest) */
export const FOREST_URL = stamp(new URL('../../assets/scene/snow-day-forest.webp', import.meta.url).href);

/** THE SCENE'S PIECES BY ASSET KEY (scene swap 2026-11-17, dark mode 2026-11-17; game/scene/sceneSwap.ts loads, uploads and
 *  lets go of them). Only the base scene of the set the player's Scene setting asks for is in the first load (game/
 *  sceneChoice.ts BOOT_SCENE_SET: the snow set's day snow by default, the grass set's grassDay with Dark); every other scene
 *  is never asked for before the first press. A bonus round's scene of the set in use loads when a round's book holds a
 *  trigger (or a resumed round is inside a bonus), goes to the GPU as the cross-fade starts and is let go after the swap
 *  back; a change of the Scene setting loads the other set's base scene and lets go of the old one after its cross-fade.
 *  The upright forest off the phone tier loads the first time an upright phone layout shows. */
export const SCENE_LAZY_URLS: Record<string, string> = {
	// the snow set's base scene (in the first load on a Snow boot: the manifest below)
	road: stamp(new URL('../../assets/road/road.webp', import.meta.url).href),
	tunnelLeft: stamp(new URL('../../assets/road/tunnel-left.webp', import.meta.url).href),
	tunnelRight: stamp(new URL('../../assets/road/tunnel-right.webp', import.meta.url).href),
	sceneField: stamp(new URL('../../assets/scene/snow-day-field.webp', import.meta.url).href),
	sceneBandTop: stamp(new URL('../../assets/scene/snow-day-band-top.webp', import.meta.url).href),
	sceneBandBottom: stamp(new URL('../../assets/scene/snow-day-band-bottom.webp', import.meta.url).href),
	sceneEndLeft: stamp(new URL('../../assets/scene/snow-day-end-left.webp', import.meta.url).href),
	sceneEndRight: stamp(new URL('../../assets/scene/snow-day-end-right.webp', import.meta.url).href),
	sceneForest: FOREST_URL,
	nightField: stamp(new URL('../../assets/scene/snow-night-field.webp', import.meta.url).href),
	nightBandTop: stamp(new URL('../../assets/scene/snow-night-band-top.webp', import.meta.url).href),
	nightBandBottom: stamp(new URL('../../assets/scene/snow-night-band-bottom.webp', import.meta.url).href),
	nightEndLeft: stamp(new URL('../../assets/scene/snow-night-end-left.webp', import.meta.url).href),
	nightEndRight: stamp(new URL('../../assets/scene/snow-night-end-right.webp', import.meta.url).href),
	nightForest: stamp(new URL('../../assets/scene/snow-night-forest.webp', import.meta.url).href),
	nightRoad: stamp(new URL('../../assets/scene/snow-night-road.webp', import.meta.url).href),
	nightTunnelLeft: stamp(new URL('../../assets/scene/snow-night-tunnel-left.webp', import.meta.url).href),
	nightTunnelRight: stamp(new URL('../../assets/scene/snow-night-tunnel-right.webp', import.meta.url).href),
	superField: stamp(new URL('../../assets/scene/snow-super-field.webp', import.meta.url).href),
	superBandTop: stamp(new URL('../../assets/scene/snow-super-band-top.webp', import.meta.url).href),
	superBandBottom: stamp(new URL('../../assets/scene/snow-super-band-bottom.webp', import.meta.url).href),
	superEndLeft: stamp(new URL('../../assets/scene/snow-super-end-left.webp', import.meta.url).href),
	superEndRight: stamp(new URL('../../assets/scene/snow-super-end-right.webp', import.meta.url).href),
	superForest: stamp(new URL('../../assets/scene/snow-super-forest.webp', import.meta.url).href),
	superRoad: stamp(new URL('../../assets/scene/snow-super-road.webp', import.meta.url).href),
	superTunnelLeft: stamp(new URL('../../assets/scene/snow-super-tunnel-left.webp', import.meta.url).href),
	superTunnelRight: stamp(new URL('../../assets/scene/snow-super-tunnel-right.webp', import.meta.url).href),
	// THE GRASS SET (the Scene setting's Dark; tools/build_scene.py, the grass kits G1, B2 and G2 r2)
	grassField: stamp(new URL('../../assets/scene/grass-day-field.webp', import.meta.url).href),
	grassBandTop: stamp(new URL('../../assets/scene/grass-day-band-top.webp', import.meta.url).href),
	grassBandBottom: stamp(new URL('../../assets/scene/grass-day-band-bottom.webp', import.meta.url).href),
	grassEndLeft: stamp(new URL('../../assets/scene/grass-day-end-left.webp', import.meta.url).href),
	grassEndRight: stamp(new URL('../../assets/scene/grass-day-end-right.webp', import.meta.url).href),
	grassForest: stamp(new URL('../../assets/scene/grass-day-forest.webp', import.meta.url).href),
	grassRoad: stamp(new URL('../../assets/scene/grass-day-road.webp', import.meta.url).href),
	grassTunnelLeft: stamp(new URL('../../assets/scene/grass-day-tunnel-left.webp', import.meta.url).href),
	grassTunnelRight: stamp(new URL('../../assets/scene/grass-day-tunnel-right.webp', import.meta.url).href),
	grassNightField: stamp(new URL('../../assets/scene/grass-night-field.webp', import.meta.url).href),
	grassNightBandTop: stamp(new URL('../../assets/scene/grass-night-band-top.webp', import.meta.url).href),
	grassNightBandBottom: stamp(new URL('../../assets/scene/grass-night-band-bottom.webp', import.meta.url).href),
	grassNightEndLeft: stamp(new URL('../../assets/scene/grass-night-end-left.webp', import.meta.url).href),
	grassNightEndRight: stamp(new URL('../../assets/scene/grass-night-end-right.webp', import.meta.url).href),
	grassNightForest: stamp(new URL('../../assets/scene/grass-night-forest.webp', import.meta.url).href),
	grassNightRoad: stamp(new URL('../../assets/scene/grass-night-road.webp', import.meta.url).href),
	grassNightTunnelLeft: stamp(new URL('../../assets/scene/grass-night-tunnel-left.webp', import.meta.url).href),
	grassNightTunnelRight: stamp(new URL('../../assets/scene/grass-night-tunnel-right.webp', import.meta.url).href),
	grassSuperField: stamp(new URL('../../assets/scene/grass-super-field.webp', import.meta.url).href),
	grassSuperBandTop: stamp(new URL('../../assets/scene/grass-super-band-top.webp', import.meta.url).href),
	grassSuperBandBottom: stamp(new URL('../../assets/scene/grass-super-band-bottom.webp', import.meta.url).href),
	grassSuperEndLeft: stamp(new URL('../../assets/scene/grass-super-end-left.webp', import.meta.url).href),
	grassSuperEndRight: stamp(new URL('../../assets/scene/grass-super-end-right.webp', import.meta.url).href),
	grassSuperForest: stamp(new URL('../../assets/scene/grass-super-forest.webp', import.meta.url).href),
	grassSuperRoad: stamp(new URL('../../assets/scene/grass-super-road.webp', import.meta.url).href),
	grassSuperTunnelLeft: stamp(new URL('../../assets/scene/grass-super-tunnel-left.webp', import.meta.url).href),
	grassSuperTunnelRight: stamp(new URL('../../assets/scene/grass-super-tunnel-right.webp', import.meta.url).href),
};

/** the grass set's base scene as first-load entries (a Dark boot): the pieces the snow set's entries below name, the grass
 *  kit's (the upright forest only on the phone tier, as the snow's). Built from SCENE_LAZY_URLS, so the stamp script's
 *  preload weight (scripts/stamp-assets.mjs) counts the snow set's: the two weigh about the same. */
const grassBase = () => {
	const keys = ['grassRoad', 'grassTunnelLeft', 'grassTunnelRight', 'grassField', 'grassBandTop', 'grassBandBottom', 'grassEndLeft', 'grassEndRight', ...(PHONE_TIER ? ['grassForest'] : [])];
	return Object.fromEntries(keys.map((k) => [k, { type: 'sprite' as const, src: SCENE_LAZY_URLS[k], preload: true as const }]));
};

/** the phone asset tier's twin of a file (game/deviceTier.ts PHONE_TIER: a constant, chosen once before any texture loads) */
const tiered = (full: string, phone: string): string => (PHONE_TIER ? phone : full);

const assets = {
	// the symbol atlas (tools/build_assets.py): the four cars in both directions, the five signs, the sleigh Wild and
	// the placeholder reindeer
	symbols: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/symbols/symbols.json', import.meta.url).href),
			stamp(new URL('../../assets/symbols/symbols-phone.json', import.meta.url).href),
		),
		preload: true,
	},
	// THE PRESENT, closed and still (the scatter; tools/build_present.py): its own small sheet at the density and anchor of
	// its animation frames (game/road/present.ts), so the still and the first frame of a peek are one picture. The peek's
	// and the open's sheets are not here: they load after the board is up and for a book with a trigger.
	presentStill: {
		type: 'sprite',
		src: tiered(
			stamp(new URL('../../assets/present/present-full-still.webp', import.meta.url).href),
			stamp(new URL('../../assets/present/present-phone-still.webp', import.meta.url).href),
		),
		preload: true,
	},
	// THE RED PRESENT's still (the 4th and 5th present of a base spin, the Super scatter; tools/build_present.py): in the
	// preload beside the teal one (0.67 MB desktop, 0.12 MB phone), so a red present is red from its first frame
	presentStillRed: {
		type: 'sprite',
		src: tiered(
			stamp(new URL('../../assets/present/present-full-still-red.webp', import.meta.url).href),
			stamp(new URL('../../assets/present/present-phone-still-red.webp', import.meta.url).href),
		),
		preload: true,
	},
	// (THE CAST SHADOWS, game/road/shadows.ts, have no texture of their own since round 2: each is a twin of its owner's
	// picture. Round 1's ellipse, road/shadow.webp and shadow-phone.webp from tools/build_shadows.py, is no longer loaded.)
	// THE WAGON'S CHRISTMAS TREE (tools/build_wagon_tree.py, game/road/wagonTree.ts): the tree, the front rail and the ropes
	// per direction, and their shadow silhouette (desktop about 1.7 MB on the GPU, phone 0.25)
	wagonTree: {
		type: 'sprites',
		src: tiered(stamp(new URL('../../assets/riders/wagon-tree.json', import.meta.url).href), stamp(new URL('../../assets/riders/wagon-tree-phone.json', import.meta.url).href)),
		preload: true,
	},
	// THE SEATED DRIVERS (tools/build_seated.py, game/road/seated.ts): Grandma and Santa, the vehicles' front layers and the
	// drivers' shadow silhouettes (desktop about 2.1 MB on the GPU, phone 0.3)
	seated: {
		type: 'sprites',
		src: tiered(stamp(new URL('../../assets/riders/seated.json', import.meta.url).href), stamp(new URL('../../assets/riders/seated-phone.json', import.meta.url).href)),
		preload: true,
	},
	// THE VAN'S BACKFIRE PUFF (tools/build_van_win.py, game/road/vanWin.ts): one small cartoon smoke puff, a few KB
	vanPuff: {
		type: 'sprite',
		src: tiered(stamp(new URL('../../assets/road/van-puff.webp', import.meta.url).href), stamp(new URL('../../assets/road/van-puff-phone.webp', import.meta.url).href)),
		preload: true,
	},
	// THE CHRISTMAS LIGHTS WIN LINES (tools/build_win_lights.py, game/road/winLights.ts): one white bulb and one soft glow
	// on one small sheet, tinted per line in the game, a few KB
	winLights: {
		type: 'sprite',
		src: tiered(stamp(new URL('../../assets/road/win-lights.webp', import.meta.url).href), stamp(new URL('../../assets/road/win-lights-phone.webp', import.meta.url).href)),
		preload: true,
	},
	// THE SCENE'S FIRST LOAD: the base scene of the set the Scene setting asks for (game/sceneChoice.ts BOOT_SCENE_SET), the
	// other set never. The snow set: the locked board background and the two tunnel portals cut from it (drawn over the
	// traffic), and (scene pass 9: tools/build_scene.py, game/scenePresets.ts snowDay, game/scene/sceneLayers.ts) the snow
	// scene kit's field tile (repeated under everything), its two bands over the picture's top and bottom margins, and the
	// two painted tunnel ends (at their source density, 1.41 px per road px). The grass set: the same pieces of grassDay.
	...(BOOT_SCENE_SET === 'grass'
		? grassBase()
		: {
				road: {
					type: 'sprite' as const,
					src: stamp(new URL('../../assets/road/road.webp', import.meta.url).href),
					preload: true as const,
				},
				tunnelLeft: {
					type: 'sprite' as const,
					src: stamp(new URL('../../assets/road/tunnel-left.webp', import.meta.url).href),
					preload: true as const,
				},
				tunnelRight: {
					type: 'sprite' as const,
					src: stamp(new URL('../../assets/road/tunnel-right.webp', import.meta.url).href),
					preload: true as const,
				},
				sceneField: { type: 'sprite' as const, src: stamp(new URL('../../assets/scene/snow-day-field.webp', import.meta.url).href), preload: true as const },
				sceneBandTop: { type: 'sprite' as const, src: stamp(new URL('../../assets/scene/snow-day-band-top.webp', import.meta.url).href), preload: true as const },
				sceneBandBottom: { type: 'sprite' as const, src: stamp(new URL('../../assets/scene/snow-day-band-bottom.webp', import.meta.url).href), preload: true as const },
				sceneEndLeft: { type: 'sprite' as const, src: stamp(new URL('../../assets/scene/snow-day-end-left.webp', import.meta.url).href), preload: true as const },
				sceneEndRight: { type: 'sprite' as const, src: stamp(new URL('../../assets/scene/snow-day-end-right.webp', import.meta.url).href), preload: true as const },
				// (THE FOREST, upright phones only, is in the preload on the phone tier only. Elsewhere it loads the first time
				// an upright phone layout shows, game/scene/sceneSwap.ts layoutChanged.)
				...(PHONE_TIER ? { sceneForest: { type: 'sprite' as const, src: FOREST_URL, preload: true as const } } : {}),
			}),
	// THE BILLBOARD LOGO (game/scene/logoSign.ts): the sign with its lamps dark, the lamps' lit glass, a glow; one sheet
	logoSign: {
		type: 'sprite',
		src: tiered(stamp(new URL('../../assets/scene/logo-sign.webp', import.meta.url).href), stamp(new URL('../../assets/scene/logo-sign-phone.webp', import.meta.url).href)),
		preload: true,
	},
	// THE LANDING SCREEN'S POSED COLUMNS (ui/LandingScreen.svelte, game/landingBoard.ts): one small sheet with the cloud
	// still and one picked idle frame of each column character (tools/build_columns.py --landing), so the landing board
	// stands without the idle clips (those still load only when a book calls for a tier)
	landingStills: {
		type: 'sprite',
		src: tiered(
			stamp(new URL('../../assets/columns/landing-stills.webp', import.meta.url).href),
			stamp(new URL('../../assets/columns/landing-stills-phone.webp', import.meta.url).href),
		),
		preload: true,
	},
	// THE LED BILLBOARD'S PICTURES (tools/build_led_art.py, game/landing/ledSign.ts): one small sheet the press screen's
	// screens are drawn from on a 2D canvas (never drawn by Pixi itself, so never sent to the GPU); unloaded once the game
	// is entered
	ledArt: {
		type: 'sprite',
		src: stamp(new URL('../../assets/landing/led-art.webp', import.meta.url).href),
		preload: true,
	},
	// THE LED SCOREBOARD'S PICTURES (tools/build_scoreboard_art.py, game/scoreboard/): one small sheet the strip's cartoons and
	// the back board are drawn from on 2D canvases at one pixel per dot (never drawn by Pixi itself, so never sent to the GPU).
	// The strip is always on, so it is in the main load (about 115 KB).
	scoreboardArt: {
		type: 'sprite',
		src: stamp(new URL('../../assets/scoreboard/scoreboard-art.webp', import.meta.url).href),
		preload: true,
	},
	// BORROWED from Manticore Mayhem as stand-ins (the sprite and the music are its files, byte for byte)
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

export default assets;

/** THE SEATED DRIVERS' ANIMATIONS (tools/build_seated_clips.py, game/road/seatedClips.ts): not in the manifest (never
 *  preloaded); each sheet loads when it is needed and is let go after */
const SEAT_CLIP_URLS = {
	'grandma:idle:full': new URL('../../assets/riders/clips/grandma-idle.json', import.meta.url).href,
	'grandma:idle:phone': new URL('../../assets/riders/clips/grandma-idle-phone.json', import.meta.url).href,
	'grandma:win:full': new URL('../../assets/riders/clips/grandma-win.json', import.meta.url).href,
	'grandma:win:phone': new URL('../../assets/riders/clips/grandma-win-phone.json', import.meta.url).href,
	'santa:idle:full': new URL('../../assets/riders/clips/santa-idle.json', import.meta.url).href,
	'santa:idle:phone': new URL('../../assets/riders/clips/santa-idle-phone.json', import.meta.url).href,
	'santa:win:full': new URL('../../assets/riders/clips/santa-win.json', import.meta.url).href,
	'santa:win:phone': new URL('../../assets/riders/clips/santa-win-phone.json', import.meta.url).href,
} as Record<string, string>;
export const seatedClipUrl = (character: string, clip: string, tier: 'full' | 'phone'): string => stamp(SEAT_CLIP_URLS[`${character}:${clip}:${tier}`]);
