import type * as PIXI from 'pixi.js';

// MIPMAPS FOR THE SYMBOL TEXTURES (tools/SYMBOL_SHEETS.md "Mipmaps").
//
// The symbol atlas and the drop / idle sheets are 256 px cells (128 on the phone tier) drawn at
// ~38 CSS px on the desktop landscape board (~58 device px at the 1.5 DPR cap), so every on-screen
// pixel skips ~4..7 texels: without a mip chain linear sampling aliases into grain. Pixi v8.8.1
// leaves TextureSource.autoGenerateMipmaps false; with it true the GL texture system sets
// mipLevelCount in _initSource and calls gl.generateMipmap after the level-0 upload (and only then:
// these sources never change after load, so the chain is built ONCE per source, never per frame).
//
// Call this for a source BEFORE its first GPU upload (BoardCells does: the atlas the first tick the
// loaded assets are seen, each sheet when it is first parsed, both before any sprite draws it). A
// source that somehow got uploaded first is re-uploaded once here, with its chain.
//
// WebGL1 cannot mipmap the non-power-of-two sheets (2048 x 768 and the like): there the sources are
// left as they are and DEV logs it once.
//
// Also the numerals atlas (components/ArtAmount.svelte): 206 px glyphs drawn at ~15..65 px. Not the
// board frame, chains, backdrop or backgrounds: those are built per layout and draw near 1:1.

const done = new WeakSet<PIXI.TextureSource>();
let warned = false;

export const enableMipmaps = (source: PIXI.TextureSource | undefined, renderer: PIXI.Renderer | undefined): void => {
	if (!source || !renderer || done.has(source)) return;
	done.add(source);
	const gl = renderer as any;
	const webgl2 = gl.context?.webGLVersion === 2 || gl.context?.supports?.nonPowOf2mipmaps === true;
	if (!webgl2 && !source.isPowerOfTwo) {
		if (import.meta.env.DEV && !warned) {
			warned = true;
			console.info('[manticore] WebGL1: NPOT symbol sheets are not mipmapped');
		}
		return;
	}
	source.scaleMode = 'linear'; // min / mag / mipmap filter all linear: trilinear
	source.autoGenerateMipmaps = true;
	source.mipLevelCount = Math.floor(Math.log2(Math.max(source.pixelWidth, source.pixelHeight))) + 1;
	// already on the GPU (drawn before this ran): one re-upload builds the chain, and the style
	// change switches the min filter to LINEAR_MIPMAP_LINEAR
	if (gl.texture?.managedTextures?.includes(source)) {
		source.update();
		source.style.update();
	}
};

/** DEV probe: a source's mip level count (1 = no chain) */
export const mipLevels = (source: PIXI.TextureSource | undefined): number => (source && source.autoGenerateMipmaps ? source.mipLevelCount : 1);
