// Ambient background layer (docs/superpowers/plans/2026-09-06-cafeteria-ambient-layer.md): everything
// here is authored in BACKDROP PIXELS of the 1920×1080 base scene, the space the art was cut from.
// Background.svelte maps that space onto the cover-fitted backdrop sprite, so an effect lands on the
// same brick on every layout without per-kind coordinates.
export const BACKDROP = { w: 1920, h: 1080 };

// Exhaust fan on the back wall. Tuned by Corey in the preview artifact (0d0d8c5e…, 2026-09-06).
// Two layers cut from the un-squashed fan: a seven-blade ring that spins and a hub cap that never
// turns, both 372² at 4K scale (hence cutoutScale 0.25 here). The perspective is one affine map,
// A = R(tilt) · S(k, 1): the blade ring gets A · R(alpha), the cap gets A only. Ghost copies spread
// over each frame's sweep stand in for motion blur (no filters — house rules). The ellipse clip keeps
// blade tips off the housing rim.
export const FAN = {
	hub: { x: 852.5, y: 193.5 },
	cutoutScale: 0.25,
	pivot: { x: 185.5, y: 185.5 }, // hub in the 372² sources (their centre)
	squashK: 0.78,
	tiltDeg: 15,
	revPerSec: 1.45,
	blurSamples: 4,
	clip: { rx: 38, ry: 49 },
};
