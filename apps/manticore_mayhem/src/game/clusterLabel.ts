// THE CLUSTER LABELS' FONT: the win plaque's forged glyph atlas (tools/build_plaque_text.py, Rakkas), reused
// for the per-cluster readouts over the board (CLUSTER_LABEL, Corey 2026-10-09). This file only HOLDS the
// plaque's own layout class (game/stinger/text.ts PlaqueFont, imported and never changed) so the board engine
// can measure a label before it places it, and components/ClusterLabels.svelte can draw it.
//
// The atlas (`stingerGlyphs`) and its metrics (stinger.json) are DEFERRED: nothing here is ready in the game's
// first seconds. Until both are in, and for any string with a character the atlas lacks, the engine keeps the
// stencil readout (forgedSupports() is false) and nothing draws half a label.
import { GlyphRun, PlaqueFont } from './stinger/text';
import type { StingerJson } from './stinger/types';

export const labelFont = {
	/** the plaque's metrics, once stinger.json is in (ClusterLabels.svelte fetches it through the plaque's own cached loader) */
	font: null as PlaqueFont | null,
	/** the glyph atlas's textures are in stateApp.loadedAssets (written by ClusterLabels.svelte's tick) */
	atlasIn: false,
	/** DEV / probe: draw the stencil fallback even though the forged font is ready */
	forceStencil: false,
};

export const setLabelFont = (json: StingerJson) => {
	labelFont.font ??= new PlaqueFont(json);
};

const scratch = new GlyphRun(64);

export const forgedReady = () => !!labelFont.font && labelFont.atlasIn && !labelFont.forceStencil;

/** can this string be set whole from the forged atlas, right now? */
export const forgedSupports = (text: string) => forgedReady() && labelFont.font!.missing(text) === '';

/** the em size that gives a cap height of `capPx` */
export const forgedEm = (capPx: number) => (labelFont.font ? (capPx * labelFont.font.em) / labelFont.font.cap : capPx);

/** the laid out width of `text` at cap height `capPx` (tabular: every digit takes the widest digit's advance) */
export const forgedWidth = (text: string, capPx: number, tabular = false) =>
	labelFont.font ? labelFont.font.layout(text, forgedEm(capPx), scratch, { tabular }).width : 0;
