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

// THE LAYOUT AT BOOT, for the per-layout board art and backgrounds: the same breakpoints as
// utils-layout createLayout (ratio >= 1.3 wide: short side <= 480 is the phone master, else
// landscape; anything narrower is portrait). Only the boot layout's copy gates the landing screen;
// the other two ride the deferred phase, so a rotation before they land shows the flat fallback
// for a moment and never a wrong-scale texture (components/BoardFrame.svelte, Background.svelte).
const bootLayout = ((): 'landscape' | 'phone' | 'portrait' => {
	if (typeof window === 'undefined') return 'landscape';
	const w = window.innerWidth || 1;
	const h = window.innerHeight || 1;
	if (w / h >= 1.3) return Math.min(w, h) <= 480 ? 'phone' : 'landscape';
	return 'portrait';
})();
const atBoot = (kind: 'landscape' | 'phone' | 'portrait') => bootLayout === kind;

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
	// THE BOARD FRAME and its chain loop tiles (tools/build_board_layers.py from the board_v4i renders;
	// registration in game/boardArt.ts), one scale per layout: the boot layout's preloads. boardChains_* is
	// the seamless two-link tile pair (L, R) the strips repeat (CHAIN_BOW haul, 2026-10-07)
	boardFrame_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-landscape.webp', import.meta.url).href), preload: atBoot('landscape') },
	boardFrame_phone: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-phone.webp', import.meta.url).href), preload: atBoot('phone') },
	boardFrame_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-portrait.webp', import.meta.url).href), preload: atBoot('portrait') },
	boardChains_landscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-chain-tile-landscape.webp', import.meta.url).href), preload: atBoot('landscape') },
	boardChains_phone: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-chain-tile-phone.webp', import.meta.url).href), preload: atBoot('phone') },
	boardChains_portrait: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-chain-tile-portrait.webp', import.meta.url).href), preload: atBoot('portrait') },
	// THE SCENE BACKGROUND (temporary: the citadel courtyard for every mode until the per-mode scenes
	// land). Angry Mantis's split: the base scene preloads, the feature scenes are deferred; here the
	// base scene of the boot layout only.
	bg_base_landscape: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-landscape.webp', import.meta.url).href), preload: atBoot('landscape') },
	bg_base_phone: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-phone.webp', import.meta.url).href), preload: atBoot('phone') },
	bg_base_portrait: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/base-portrait.webp', import.meta.url).href), preload: atBoot('portrait') },
	bg_bonus_landscape: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/bonus-landscape.webp', import.meta.url).href), preload: false },
	bg_bonus_phone: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/bonus-phone.webp', import.meta.url).href), preload: false },
	bg_bonus_portrait: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/bonus-portrait.webp', import.meta.url).href), preload: false },
	bg_super_landscape: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/super-landscape.webp', import.meta.url).href), preload: false },
	bg_super_phone: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/super-phone.webp', import.meta.url).href), preload: false },
	bg_super_portrait: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/super-portrait.webp', import.meta.url).href), preload: false },
	bg_epic_landscape: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/epic-landscape.webp', import.meta.url).href), preload: false },
	bg_epic_phone: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/epic-phone.webp', import.meta.url).href), preload: false },
	bg_epic_portrait: { type: 'sprite', src: stamp(new URL('../../assets/backgrounds/epic-portrait.webp', import.meta.url).href), preload: false },
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

// DEV ONLY, SYMBOL STYLE TRIAL (2026-10-07): `?symbols=<style>` (or localStorage `mm.symbols`) points the
// static atlas and every drop / idle sheet at static/assets/sprites/mmSymbols-trial/<style>/ (built by
// tools/pack_symbol_sheets.py --style; same file names). A/B/C alias outline / outline-pop / outline-pop-rim.
// The trial files have no assetStamp key, so their URLs go out bare (no ?v=); nothing here runs in a build.
if (import.meta.env.DEV && typeof window !== 'undefined') {
	const alias: Record<string, string> = { A: 'outline', B: 'outline-pop', C: 'outline-pop-rim' };
	let pick: string | null = null;
	try {
		pick = new URLSearchParams(window.location.search).get('symbols') ?? window.localStorage.getItem('mm.symbols');
	} catch {}
	const style = pick ? (alias[pick] ?? pick) : null;
	if (style && /^[a-z-]+$/.test(style) && style !== 'current') {
		for (const entry of Object.values(assets) as { src: unknown; bytes?: number }[]) {
			if (typeof entry.src !== 'string' || !entry.src.includes('/sprites/mmSymbols/')) continue;
			entry.src = entry.src.replace('/sprites/mmSymbols/', `/sprites/mmSymbols-trial/${style}/`).replace(/\?v=[^&#]*/, '');
			delete entry.bytes;
		}
		console.info(`[manticore] DEV symbol style trial: ${style}`);
	}
}

export default assets;
