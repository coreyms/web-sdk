/**
 * Build-time stand-in for '@esotericsoftware/spine-pixi-v8' (aliased in vite.config.js).
 *
 * Angry Mantis plays no Spine assets — characters use the bonerutter rig format —
 * but pixi-svelte's assetLoad.ts imports the Spine runtime at top level, which
 * defeats tree-shaking and puts ~Esoteric's code (and its Spine Editor licence
 * obligation, Spine Runtimes License §2(b)) into every game's bundle. The alias
 * keeps it out of THIS game only; sibling sample apps are untouched.
 *
 * Every export throws on use so an accidental Spine dependency fails loudly at
 * the exact call site instead of shipping a broken half-runtime.
 */
const boom = (name: string): never => {
	throw new Error(
		`Spine runtime is excluded from the Angry Mantis bundle (vite.config.js alias -> src/spineStub.ts); "${name}" was called. Remove the alias if this game genuinely needs Spine.`,
	);
};

class SpineStub {
	constructor() {
		boom('spine-pixi-v8 class');
	}
}

export const AtlasAttachmentLoader = SpineStub;
export const SkeletonBinary = SpineStub;
export const SkeletonJson = SpineStub;
export const Spine = SpineStub;
export const SpineTexture = SpineStub;
export const TextureAtlas = SpineStub;
export const SkeletonData = SpineStub;
export const AnimationState = SpineStub;
export const AnimationStateData = SpineStub;
export const Skeleton = SpineStub;
