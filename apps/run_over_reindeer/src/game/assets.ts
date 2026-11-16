// The asset manifest pixi-svelte's loader works through, and the cache-busting stamp every asset URL goes through.
//
// Everything here is PRELOADED (the base game draws all of it in its first seconds, and the whole set is small).
// When feature art lands (the column Wild characters, the crash cloud) it goes in as `preload: false` with its own
// gate, as the house rule says: nothing a feature alone needs may hold up PRESS ANYWHERE.
import { loadTextures } from 'pixi.js';
import stamps from './assetStamp';
import { PHONE_TIER } from './deviceTier';

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
	// the locked board background and the two tunnel portals cut from it (drawn over the traffic)
	road: {
		type: 'sprite',
		src: stamp(new URL('../../assets/road/road.webp', import.meta.url).href),
		preload: true,
	},
	tunnelLeft: {
		type: 'sprite',
		src: stamp(new URL('../../assets/road/tunnel-left.webp', import.meta.url).href),
		preload: true,
	},
	tunnelRight: {
		type: 'sprite',
		src: stamp(new URL('../../assets/road/tunnel-right.webp', import.meta.url).href),
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
