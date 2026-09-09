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

// Sky behind the windows (Corey 2026-09-08): the room art has its panes cut to alpha, and a sky
// sprite per scene sits UNDER it (Background.svelte → AmbientSky.svelte). Each sky was painted on
// the room's own 1920×1080 canvas and cropped to its opaque band by tools/build_clouds.py, so the
// offset here puts it back exactly where it was painted. Only the base sky rides the preload.
export const SKY = {
	base: { key: 'skyBase', x: 0, y: 0 },
	super: { key: 'skySuper', x: 96, y: 0 },
	feast: { key: 'skyFeast', x: 44, y: 0 },
} as const;

// Clouds drift behind the panes during the super and feast bonuses only, cut from Corey's cloud
// sheets into per-scene atlases (cloud_<mode>_<k>.png). Every cloud rolls one depth t in 0..1 and
// takes size, speed and opacity from it, plus jitter so no two match; y is anywhere across the
// window band. Backdrop px and px/s. Values are Corey's from the Cafeteria Windows artifact (2026-09-08).
export const CLOUDS = {
	count: 17,
	band: { y0: 87, y1: 275 }, // the windows sit at y 0..245
	scale: { near: 1.5, far: 1.12 },
	speed: { near: 19, far: 30 }, // px/s (Corey's pick: the far layer drifts faster)
	alpha: { near: 1, far: 0.86 },
	jitter: 0.6, // ± share applied to speed and scale
	direction: -1, // −1 = right to left
	spread: 2400, // x range the clouds start across (wider than the canvas so the band is full at once)
};

// Birds cross the DAY sky only (base scene): flocks of flock.min..flock.max in a loose V, every
// everyMs ± 30%, from either side. Each bird flaps through one of the sheet's three big rows (far
// flocks use the small fourth row) at its own phase, with a slight bob. Sizes are the bird's height
// in backdrop px; the atlas is tools/build_clouds.py's birds.{json,webp} (bird_<row>_<frame>.png).
export const BIRDS = {
	everyMs: 12000,
	flock: { min: 3, max: 6 },
	size: { near: 17, far: 21 },
	speed: 70, // px/s, scaled 0.6..1.1 by depth
	flapFps: 9,
	bob: 4,
	band: { y0: 33, y1: 190 },
	farBelow: 0.35, // depth under which a flock uses the small-bird row
	rows: 4,
	framesPerRow: 8,
};

// Cockroaches on the cafeteria floor, base scene only (AmbientRoaches.svelte; Corey's values from
// the Cafeteria Roach artifact, 2026-09-08). Backdrop px / px/s / seconds. Each roach runs a burst
// of run..[0..1] s (a dash of dash.len with dash.chance), then freezes for pause[0..1] s, turning
// up to turnDeg each burst and reversing with reverse chance. Travel is squashed vertically by
// `slope` (the floor is seen at a shallow angle); size and speed shrink toward the back wall
// (backScale at floor.y0). The sprite is tilted tiltDeg about its feet, mirrored when facing left,
// plus `lean` of its heading's screen slope. Atlas: tools/build_clouds.py roach.{json,webp}.
export const ROACH = {
	count: 5,
	height: 30, // px at the front edge of the floor
	backScale: 0.2,
	tiltDeg: 25,
	lean: 0.82,
	legFps: 14,
	speed: 250,
	run: [0.29, 1.2],
	pause: [0.4, 2.55],
	dash: { chance: 0.2, len: [2, 3] },
	turnDeg: 50,
	reverse: 0.15,
	floor: { y0: 650, y1: 1060 },
	slope: 0.6,
	margin: 40, // px kept from the left/right edges
	frames: 8,
	cell: { w: 91, h: 62 },
	anchor: { x: 35, y: 45 }, // body centre / feet inside every cell
	shadow: { alpha: 0.3, rx: 0.42, ry: 0.16 }, // contact ellipse, as shares of the cell
};

// One housefly, base scene only (AmbientFly.svelte; Corey's values from the Cafeteria Fly artifact, 2026-09-08). Roams the
// room for roam[0..1] s (new target every `retarget` s, buzz jitter on top), flies to the BETTER
// FOOD OUTSIDE graffiti and traces a figure of eight for hover.len s, then climbs to the window
// pane above it: inside the window rect it drops BEHIND the room (only the glass shows it) and
// fades out; after `away` s it fades back in through the pane and roams again. Backdrop px.
export const FLY = {
	height: 25,
	depthScale: 0.25, // bigger toward the front of the room
	wingFps: 35,
	jitter: 4,
	speed: 377,
	retarget: 1.1,
	hoverChance: 0.05,
	roam: [120, 180],
	air: { y0: 120, y1: 900, x0: 60, x1: 1860 },
	graffiti: { x: 1786, y: 366 },
	hover: { width: 40, loop: 4.85, len: [6, 12] },
	window: { x: 1810, y: 90, left: 1720, top: 0, bottom: 178 },
	away: 60,
	awayJitter: 0.25,
	fadePerSec: 2.5,
	frames: 8,
	cell: { w: 75, h: 80 },
	anchor: { x: 39, y: 40 },
};
