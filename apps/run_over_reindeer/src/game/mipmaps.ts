import type * as PIXI from 'pixi.js';

// MIPMAPS FOR THE SYMBOL ATLAS (house rule: a mip chain on every sheet drawn well under its source size).
//
// The desktop symbol atlas carries 3.2 px per road px (tools/build_assets.py), sized for a large desktop screen. On a
// small window a symbol is drawn at a third of that or less, and without a mip chain linear sampling aliases into
// grain. Pixi v8.8.1 leaves TextureSource.autoGenerateMipmaps false; with it true the GL texture system builds the
// chain once after the level 0 upload (these sources never change after load, so never per frame).
//
// Call this for a source BEFORE its first GPU upload (components/Board.svelte does, on mount). A source that somehow
// got uploaded first is uploaded once more here, with its chain. WebGL1 cannot mipmap sheets that are not a power
// of two in size: there the source is left as it is and DEV logs it once.
// (Taken from Manticore Mayhem as it is.)

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
			console.info('[reindeer] WebGL1: NPOT symbol sheets are not mipmapped');
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
