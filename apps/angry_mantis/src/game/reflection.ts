import type * as PIXI from 'pixi.js';

// The Pixi container the frame reflections mirror (the MainContainer that holds the reels).
// Plain module state, not $state: a Pixi object must never be wrapped in a reactive proxy, and
// the consumer (FrameReflections) reads it from a ticker callback, not a reactive scope.
let source: PIXI.Container | null = null;

export const setReflectSource = (container: PIXI.Container | null) => {
	source = container;
};
export const getReflectSource = () => source;
