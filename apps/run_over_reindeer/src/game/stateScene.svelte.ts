// THE SCENE NOW SHOWING (scene pass 9): which preset of game/scenePresets.ts the scene is drawn with. setScenePreset is
// the one place the look is swapped: the Pixi scene (components/Board.svelte rebuilds its layers from `stateScene.preset`),
// the top line's ink (ui/ClockStrip.svelte), the HUD theme's glass and readout ink (ui/hudTheme.ts applyHudScene) and the
// HUD beds (components/HudBeds.svelte) all follow it. Only snowDay exists now; nothing switches it yet.
import { applyHudScene } from '../ui/hudTheme';
import { SCENE_PRESETS, type ScenePreset, type ScenePresetName } from './scenePresets';

export const stateScene = $state<{ preset: ScenePreset }>({ preset: SCENE_PRESETS.snowDay });

/** swap the whole scene to a named preset (the Pixi layers follow on their next layout pass) */
export const setScenePreset = (name: ScenePresetName) => {
	const preset = SCENE_PRESETS[name];
	stateScene.preset = preset;
	applyHudScene(preset.hudGlass, preset.readoutInk);
};

// the boot's preset: the HUD tokens are written before the HUD first paints
setScenePreset('snowDay');
