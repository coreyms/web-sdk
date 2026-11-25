// THE SCENE NOW SHOWING (scene pass 9): which preset of game/scenePresets.ts the scene is drawn with. setScenePreset is
// the one place the DOM side of the look is swapped: the top line's ink (ui/ClockStrip.svelte), the HUD theme's glass and
// readout ink (ui/hudTheme.ts applyHudScene) and the HUD beds (components/HudBeds.svelte) all follow `stateScene.preset`.
// THE SCENE SWAP (2026-11-17, game/scene/sceneSwap.ts): `want` is the scene the round's mode asks for (components/Board.svelte
// sets it from stateGame.bonusMode; the tune panel's Scene buttons set it by hand). The swap cross-fades the Pixi scene to
// it when its pieces are in and the LED back board's entry scene covers the change, and calls setScenePreset as the fade
// starts (the DOM side's CSS transitions run with it).
// THE SCENE SETTING (dark mode, 2026-11-17; game/sceneChoice.ts): `choice` is the player's (Auto, Snow, Dark), `dark` the
// device's light or dark setting as it is now, `set` the set in use (snow or grass). The set changes only with the board at
// rest (components/Board.svelte applies `setFor(choice, dark)` then: at once at rest, at the end of a round that is running,
// never during a bonus round, its entry or its Total Win); `want` is then the new set's base scene and the swap cross-fades
// to it. Both are $state, so the switch (ui/hud/SceneSwitch.svelte) shows the choice at once.
import { applyHudScene } from '../ui/hudTheme';
import { SCENE_PRESETS, homePreset, type ScenePreset, type ScenePresetName } from './scenePresets';
import { BOOT_SCENE_SET, onSystemScheme, readSceneChoice, systemDark, writeSceneChoice, type SceneChoice, type SceneSet } from './sceneChoice';

const BOOT = homePreset(BOOT_SCENE_SET);
export const stateScene = $state<{ preset: ScenePreset; want: ScenePresetName; choice: SceneChoice; dark: boolean; set: SceneSet }>({
	preset: SCENE_PRESETS[BOOT],
	want: BOOT,
	choice: readSceneChoice(),
	dark: systemDark(),
	set: BOOT_SCENE_SET,
});

/** THE SWITCH: the player picks Auto, Snow or Dark (remembered on the device; applied by components/Board.svelte) */
export const setSceneChoice = (choice: SceneChoice) => {
	stateScene.choice = choice;
	writeSceneChoice(choice);
};

// Auto follows the device: its light or dark setting, read again whenever it changes (applied between rounds)
onSystemScheme((dark) => (stateScene.dark = dark));

/** swap the DOM side of the scene to a named preset (the Pixi side is game/scene/sceneSwap.ts's). `fadeMs`: the top line's
 *  and the upright readouts' ink change over that long (a CSS transition of color and text-shadow, switched on by
 *  `data-scene-fade` on the root only while a swap runs, so a lit WIN still changes at once the rest of the time) */
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
export const setScenePreset = (name: ScenePresetName, fadeMs = 0) => {
	const preset = SCENE_PRESETS[name];
	const root = typeof document !== 'undefined' ? document.documentElement : null;
	if (root && fadeMs > 0) {
		root.style.setProperty('--scene-fade-ms', `${Math.round(fadeMs)}ms`);
		root.dataset.sceneFade = '1';
		if (fadeTimer) clearTimeout(fadeTimer);
		fadeTimer = setTimeout(() => {
			fadeTimer = null;
			delete root.dataset.sceneFade;
		}, fadeMs + 120);
	}
	stateScene.preset = preset;
	applyHudScene(preset.hudGlass, preset.readoutInk);
};

/** the scene swap's ways in that are not state (components/Board.svelte fills them): start loading a preset's pieces now
 *  (the book's trigger, game/bookEventHandlerMap.ts) */
export const sceneHooks: { prefetch: (name: ScenePresetName) => void } = { prefetch: () => {} };

/** THE SCENE SETTING DURING AUTOPLAY (2026-11-24, Corey: "the Light Dark Mode Options are offered during auto-play, but it
 *  doesn't take effect until autoplay stops. Can we make it happen after the next spin and continue auto-play?"). An
 *  autoplay run is never at rest, so a change of set asked during one used to wait for the run's end. The run now holds
 *  its next spin for the change (game/bonusStockRules.ts autoSpinPause, rule 5): `open` is true while it holds, and
 *  components/Board.svelte takes the set up then as it does at rest (every other condition of its own still stands);
 *  `settled` is the board's "the scene wanted is on screen, whole" (it fills it). */
export const sceneGap: { open: boolean; settled: () => boolean } = { open: false, settled: () => true };

/** THE TUNE PANEL'S Scene buttons (staging too): ask for a preset by hand (the next change of the round's mode asks again) */
export const sceneDev = { show: (name: ScenePresetName) => (stateScene.want = name) };

// the boot's preset: the HUD tokens are written before the HUD first paints
setScenePreset(BOOT);
