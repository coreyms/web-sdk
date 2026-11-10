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
	// the symbol atlas (tools/build_assets.py): the four cars in both directions, the five signs, the sleigh Wild,
	// the placeholder present and the placeholder reindeer
	symbols: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/symbols/symbols.json', import.meta.url).href),
			stamp(new URL('../../assets/symbols/symbols-phone.json', import.meta.url).href),
		),
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
