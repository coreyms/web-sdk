import { loadTextures } from 'pixi.js';
import stamps, { fileBytes } from './assetStamp';
import { PHONE_TIER } from './deviceTier';

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

// TWO LOAD PHASES (pixi-svelte AssetsLoader). `preload: true` gates the landing screen: everything
// the base game draws in its first seconds. `preload: false` keeps downloading behind the game.
//
// Milestone 1 ships placeholder art only (apps/manticore_mayhem/tools/make_placeholders.py), so the
// whole manifest is small enough to preload; the deferred phase exists and is wired
// (game/assetGate.ts) ready for the real backdrops, frame art and manticore sheets.
const assets = {
	// flat coloured plates carrying the symbol id + tier, the wild, the scatter, the x2..x128
	// multiplier overlays and one empty cell well
	mmSymbols: {
		type: 'sprites',
		src: tiered(
			stamp(new URL('../../assets/sprites/mmSymbols/mmSymbols.json', import.meta.url).href),
			stamp(new URL('../../assets/sprites/mmSymbols/mmSymbols-half.json', import.meta.url).href),
		),
		preload: true,
	},
	// the 8x8 grid of cell wells behind the tiles: shows in the seams, in the drop and in every
	// emptied cell during a cascade
	boardBackdrop: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-backdrop.webp', import.meta.url).href), preload: true },
	// stencil numerals: every amount glyph in one atlas, so amounts render as batched sprites with
	// ZERO per-frame rasterization (components/ArtAmount.svelte)
	numeralsAtlas: {
		type: 'sprites',
		src: stamp(new URL('../../assets/ui/numerals/numerals.json', import.meta.url).href),
		preload: true,
	},
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

export default assets;
