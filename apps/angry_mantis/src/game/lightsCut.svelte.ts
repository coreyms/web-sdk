// The "lamps out, lamps on" mode transition (LIGHTS_CUT in constants.ts). This module owns the
// backdrop layer alphas and plays the sequence; Background.svelte only draws what it says and
// LightsCut.svelte wires the book-event handlers' emitter events to the three calls here.
//
// Every scene has up to TWO renders of the same room from the same camera: the lit one and the
// lamps-off one (tools/build_lights_off.py, which also copies the lit render's pane alpha onto the
// off render so the live sky shows through both identically). The whole transition is crossfades
// between those renders — the canvas is never covered.
//
// THE ONE RULE THE FADES FOLLOW: the layer underneath is always fully opaque and only the layer on
// TOP animates. A pair of complementary alphas (one 1->0 while the other 0->1) leaves a hole —
// at the half-way point a quarter of the black behind shows through, which is exactly the "looks
// like a glitch" flash. So lamps-out drops the LIT layer over an off layer already at 1, the world
// switch raises the incoming off layer over the outgoing one, and the restrike stutters the LIT
// layer over the off render. Background.svelte's zIndex ladder keeps that order (the scene the game
// is switching TO sits above the one it is leaving; within a scene the lit render sits above its
// off render).
//
// The sky (AmbientSky) takes the SUM of a scene's two alphas, so it holds dead still through
// lamps-out and the restrike (the two renders share a sky) and crossfades only during the world
// switch — which is the invariant the art depends on: each render's window bars are lit for its own
// sky, so a sky that leads or lags shows rims that do not match the glass.
import { stateBetDerived } from 'state-shared';

import assets from './assets';
import { LIGHTS_CUT } from './constants';
import { stateGame } from './stateGame.svelte';
import type { Scene } from './types';

export const SCENES = ['base', 'super', 'feast'] as const;

export const LIT_KEY: Record<Scene, string> = {
	base: 'bgCafeteriaBase',
	super: 'bgCafeteriaSuper',
	feast: 'bgCafeteriaFeast',
};

// The lamps-off renders. base is delivered; super and feast are Corey's to render (2026-09-11), so
// their keys are simply NOT in game/assets.ts yet and offKeyOf() returns undefined for them. The
// drop-in is: build the render with tools/build_lights_off.py and add the one line to assets.ts —
// nothing here or in Background.svelte changes.
const OFF_KEY: Record<Scene, string> = {
	base: 'bgCafeteriaBaseOff',
	super: 'bgCafeteriaSuperOff',
	feast: 'bgCafeteriaFeastOff',
};

/** the scene's lamps-off asset key, or undefined while that render has not been delivered */
export const offKeyOf = (scene: Scene): string | undefined =>
	OFF_KEY[scene] in (assets as Record<string, unknown>) ? OFF_KEY[scene] : undefined;

/** which room stands in for `scene` with the lamps out: its own render, else the base one.
 *  Interim look while super/feast have no off render: the world switch has nothing to cross to, so
 *  it stays on the base room in the dark and the new room's tubes restrike over it. The sky then
 *  follows the LIT layer's alpha (it is the only alpha moving), so the rims still match the glass. */
export const darkSceneOf = (scene: Scene): Scene => (offKeyOf(scene) ? scene : 'base');

export const lightsState = $state({
	/** per scene: alpha of the lit render */
	lit: { base: 1, super: 0, feast: 0 } as Record<Scene, number>,
	/** per scene: alpha of the lamps-off render (0 for scenes that have none) */
	dark: { base: 0, super: 0, feast: 0 } as Record<Scene, number>,
	/** a cut is running: layers stay mounted across the restrike's zero steps */
	active: false,
});

/** the sky carries a scene's total alpha, so it never leads or lags the room */
export const skyAlpha = (scene: Scene) => Math.min(1, lightsState.lit[scene] + lightsState.dark[scene]);

/** extra wash while the lamps are out, derived from the brightest room on screen: it deepens with
 *  the lamps, holds through the dark, and lifts on every restrike pop for free */
export const washExtra = () =>
	LIGHTS_CUT.washExtra * (1 - Math.max(lightsState.lit.base, lightsState.lit.super, lightsState.lit.feast));

// ---- the player ----
// One rAF at a time. A superseded run RESOLVES rather than hanging: the handlers await these calls,
// and a promise that never settles parks the round forever (the same trap as an aborted Tween.set).
let raf = 0;
let settlePending: (() => void) | null = null;
/** the scene whose off render is the one currently holding the room (null = none on screen) */
let darkShown: Scene | null = null;

const ts = () => stateBetDerived.timeScale();

/** stop whatever is playing, settling its promise, and register this run's resolver */
const takeOver = (resolve: () => void) => {
	cancelAnimationFrame(raf);
	raf = 0;
	const superseded = settlePending;
	settlePending = resolve;
	superseded?.();
};
const finish = (resolve: () => void) => {
	raf = 0;
	if (settlePending === resolve) settlePending = null;
	resolve();
};

const ramp = (ms: number, apply: (q: number) => void) =>
	new Promise<void>((resolve) => {
		takeOver(resolve);
		const dur = ms / ts();
		if (dur <= 0) {
			apply(1);
			return finish(resolve);
		}
		const t0 = performance.now();
		const frame = (now: number) => {
			if (settlePending !== resolve) return; // superseded; it settled us already
			// clamp both ends: a rAF timestamp can land BEFORE the t0 taken just outside the frame
			// (seen in headless at ~11 fps), and a negative q overshoots the alpha past 1
			const q = Math.min(1, Math.max(0, (now - t0) / dur));
			apply(q);
			if (q >= 1) return finish(resolve);
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
	});

const hold = (ms: number) => ramp(ms, () => {});

/** play [level, ms] steps on one scene's lit alpha, each step ramping from the previous level */
const playSteps = (scene: Scene, steps: [number, number][], from: number) =>
	new Promise<void>((resolve) => {
		takeOver(resolve);
		const scale = ts();
		let i = 0;
		let level = from;
		let t0 = performance.now();
		const frame = (now: number) => {
			if (settlePending !== resolve) return;
			let dur = steps[i][1] / scale;
			let q = dur > 0 ? Math.max(0, (now - t0) / dur) : 1;
			while (q >= 1) {
				level = steps[i][0];
				i += 1;
				if (i >= steps.length) {
					lightsState.lit[scene] = level;
					return finish(resolve);
				}
				t0 += dur;
				dur = steps[i][1] / scale;
				q = dur > 0 ? Math.max(0, (now - t0) / dur) : 1;
			}
			lightsState.lit[scene] = level + (steps[i][0] - level) * q;
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
	});

// DEV probe for the harnesses (window.__angryMantis is the game's one test surface): the layer
// alphas frame by frame, which is the only way to see the restrike stutter — a screen recording
// samples far too coarsely for 20-60 ms steps.
if (import.meta.env.DEV && typeof window !== 'undefined') {
	const am = ((window as unknown as { __angryMantis?: Record<string, unknown> }).__angryMantis ??= {});
	am.lights = () => ({
		lit: { ...lightsState.lit },
		dark: { ...lightsState.dark },
		active: lightsState.active,
		sky: Object.fromEntries(SCENES.map((s) => [s, skyAlpha(s)])),
	});
}

const trace = (event: string) => {
	if (!import.meta.env.DEV || typeof window === 'undefined') return;
	const am = ((window as unknown as { __angryMantis?: Record<string, unknown> }).__angryMantis ??= {});
	((am.lightsTrace ??= []) as { t: number; event: string }[]).push({ t: Math.round(performance.now()), event });
};

// ---- the sequence (awaited by the book event handlers, in this order) ----

/** lamps out on the room the game is in, then a beat in the dim room */
export const lightsOut = async () => {
	const scene = stateGame.scene;
	const dark = darkSceneOf(scene);
	lightsState.active = true;
	trace('out');
	// the off render goes to full UNDER the lit one first: it is hidden by an opaque room, so
	// nothing moves on screen, and the fade below can then be a single alpha with no hole in it
	lightsState.dark[dark] = 1;
	darkShown = dark;
	await ramp(LIGHTS_CUT.offMs, (q) => (lightsState.lit[scene] = 1 - q));
	lightsState.lit[scene] = 0;
	stateGame.lightsDark = true;
	trace('dark');
	await hold(LIGHTS_CUT.holdOutMs);
};

/** the world changes in the dark: off render -> off render with the sky in lockstep, then a beat.
 *  The handlers flip gameType / scene / the rigs in the same flush that calls this. */
export const lightsSwitch = async () => {
	const dark = darkSceneOf(stateGame.scene);
	trace('switch');
	if (dark !== darkShown) {
		const leaving = darkShown;
		// incoming on top (Background's zIndex follows stateGame.scene), outgoing held at 1 under it
		await ramp(LIGHTS_CUT.switchMs, (q) => (lightsState.dark[dark] = q));
		lightsState.dark[dark] = 1;
		if (leaving) lightsState.dark[leaving] = 0;
		darkShown = dark;
	}
	await hold(LIGHTS_CUT.holdSwitchMs);
};

/** the new room's tubes restrike: the LIT layer stutters in over the off render and warms to full */
export const lightsOn = async () => {
	const scene = stateGame.scene;
	stateGame.lightsDark = false;
	trace('restrike');
	await playSteps(scene, [...LIGHTS_CUT.restrike, [1, LIGHTS_CUT.onMs]], 0);
	lightsState.lit[scene] = 1;
	// the lit room is opaque again, so dropping the off render under it costs nothing on screen
	for (const s of SCENES) if (s !== scene) lightsState.lit[s] = 0;
	if (darkShown) lightsState.dark[darkShown] = 0;
	darkShown = null;
	lightsState.active = false;
	trace('lit');
};

/** safety net for any path that changes the scene WITHOUT a cut (a replay or resume dropping the
 *  player straight into a room): put that room up, no animation, rather than leave a stale one. */
export const lightsSyncScene = (scene: Scene) => {
	if (lightsState.active || lightsState.lit[scene] === 1) return;
	for (const s of SCENES) {
		lightsState.lit[s] = s === scene ? 1 : 0;
		lightsState.dark[s] = 0;
	}
	darkShown = null;
};
