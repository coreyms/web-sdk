// Mipmaps for a loaded sheet, once. The symbol sheet is cut at 256 px per tile and the ON THE MENU
// tray draws it at ~44 px on desktop (a 6× minification; the wrap-up's eaten row and the
// portrait pool are close behind) — without mipmaps WebGL point-samples the full-size sheet and
// every tray reads as grain (Corey 2026-09-09; the plaque text had the same failure on the
// numerals sheet). Mipmaps on the source fix every consumer of the sheet at once; the board, which
// draws the tiles near 1:1, keeps sampling level 0. WebGL2 takes non-power-of-two sizes.
import type * as PIXI from 'pixi.js';

const done = new WeakSet<object>();

export const ensureMipmaps = (loadedAssets: Record<string, unknown> | undefined, key: string) => {
	const src = (loadedAssets?.[key] as PIXI.Texture | undefined)?.source;
	if (!src || done.has(src)) return false;
	done.add(src);
	src.autoGenerateMipmaps = true;
	src.scaleMode = 'linear';
	src.update();
	return true;
};

/** every sheet or sprite that is drawn well under its source size (Corey 2026-09-09) — one frame
 *  key per sheet reaches the shared source; single sprites go by their asset key. Backgrounds,
 *  the door, the frame, the board tiles and the ambient sheets draw near native and stay out. */
export const MIPMAP_KEYS = [
	'L1.png', // symbol sheet: ON THE MENU trays (6x), wrap-up eaten row
	'br_Q.png', // branded glyphs: ON THE MENU title (9x), small tier lines
	'num_0.png', // stencil numerals: recap line (8x), score pops, max-win counters
	'Right Bicep-4.png', // mantis rig atlas: half size on phones
	'stingerNormal', 'stingerBig', 'stingerSuper', 'stingerMega', 'stingerEpic', 'stingerMax', // plates, ~2.4-3.3x
	'martyHeadshot', 'markyHeadshot', // 512 px drawn at 90 (intro mugshots)
	'headerBonus', 'headerSuper', 'headerFeast', 'freeSpins8', 'freeSpins10', 'inmateChalk1', 'inmateChalk2', // intro art
] as const;

/** arm every MIPMAP_KEYS source that has loaded so far; safe to call repeatedly */
export const armMipmaps = (loadedAssets: Record<string, unknown> | undefined) => {
	for (const key of MIPMAP_KEYS) ensureMipmaps(loadedAssets, key);
};
