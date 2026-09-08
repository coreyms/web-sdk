import * as PIXI from 'pixi.js';

// Corey's dust_poof sheet (static/assets/ui/dust-poof.webp, asset key `dustPoof`): six 512×192
// frames stacked top to bottom, the puff sitting bottom-centre in the lower ~86% of each frame.
// ReelSymbol.svelte plays one frame per sixth of GRAVITY_DROP.dustMs on every landing. The frame
// textures are cut ONCE per loaded source and cached — house rule: no per-landing textures.
export const DUST_SHEET = {
	frameW: 512,
	frameH: 192,
	frames: 6,
	contentBottom: 0.86, // fraction of the frame height where the dust mass ends (rest is transparent)
};

let cachedSource: PIXI.TextureSource | null = null;
let cachedFrames: PIXI.Texture[] = [];
export const dustFrames = (sheet: PIXI.Texture | undefined): PIXI.Texture[] => {
	if (!sheet) return [];
	if (sheet.source === cachedSource) return cachedFrames;
	cachedSource = sheet.source;
	cachedFrames = Array.from(
		{ length: DUST_SHEET.frames },
		(_, k) =>
			new PIXI.Texture({
				source: sheet.source,
				frame: new PIXI.Rectangle(0, k * DUST_SHEET.frameH, DUST_SHEET.frameW, DUST_SHEET.frameH),
			}),
	);
	return cachedFrames;
};
