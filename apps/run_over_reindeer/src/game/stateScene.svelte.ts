// THE SCENE NOW SHOWING (scene pass 9): which preset of game/scenePresets.ts the scene is drawn with. setScenePreset is
// the one place the DOM side of the look is swapped: the top line's ink (ui/ClockStrip.svelte), the HUD theme's glass and
// readout ink (ui/hudTheme.ts applyHudScene) and the HUD beds (components/HudBeds.svelte) all follow `stateScene.preset`.
// THE SCENE SWAP (2026-11-17, game/scene/sceneSwap.ts): `want` is the scene the round's mode asks for (components/Board.svelte
// sets it from stateGame.bonusMode; the tune panel's Scene buttons set it by hand). The swap cross-fades the Pixi scene to
// it when its pieces are in and the LED back board's entry scene covers the change, and calls setScenePreset as the fade
// starts (the DOM side's CSS transitions run with it).
import { applyHudScene } from '../ui/hudTheme';
import { SCENE_PRESETS, type ScenePreset, type ScenePresetName } from './scenePresets';

export const stateScene = $state<{ preset: ScenePreset; want: ScenePresetName }>({ preset: SCENE_PRESETS.snowDay, want: 'snowDay' });

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

/** THE TUNE PANEL'S Scene buttons (staging too): ask for a preset by hand (the next change of the round's mode asks again) */
export const sceneDev = { show: (name: ScenePresetName) => (stateScene.want = name) };

// the boot's preset: the HUD tokens are written before the HUD first paints
setScenePreset('snowDay');
