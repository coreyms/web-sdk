// THE SCENE PRESETS (scene pass 9, Corey 2026-11-16): one named set of everything the scene around the road is made of,
// so the game can swap the whole look in one call (game/stateScene.svelte.ts setScenePreset). One preset now, the day
// snow; the Free Spins and Super night snow and a grass set are planned and will be presets beside it, built the same way.
//
// A preset names:
//   field         the tile that repeats under everything, edge to edge on every layout (asset key)
//   bands         the strips laid over the road picture's own plain margins at its top and bottom, so its straight
//                 edges vanish into the field (asset keys), or null
//   ends          the painted pieces on the two tunnels, and the layouts that show them (an upright phone has no room)
//   forest        the layer behind and above the billboard on an upright phone (asset key), or null
//   topText       the top line's ink and halo (the clock, the game's name, POLYMATH GAMES: DOM text, CSS) on the scene,
//                 and on an upright phone over the forest
//   hudGlass      the HUD theme's glass (ui/hudTheme.ts HUD_GLASS: 'ice' the pale glass made for a dark scene, 'deep'
//                 the darker, more opaque glass that reads on white snow)
//   readoutInk    the upright phone's plain-text readouts (WIN, BALANCE, the amount: ui/hudTheme.ts HUD_READOUT_INK),
//                 'light' over a dark scene or 'dark' over snow
//   hudBeds       the flat dark beds under the HUD (components/HudBeds.svelte): off where the scene reads on its own
//   boardCover    THE LED SCOREBOARD'S FOREGROUND SNOW (game/scoreboard/scoreboard.ts): the scene's pieces the cover that
//                 hides the lowered back board is cut from, where they lie (the field tile, the road picture under it, the
//                 bottom band over it), so it matches the scene pixel for pixel; null = no cover (the board then shows
//                 under the strip when it is down)
// The asset keys are game/assets.ts keys; their road px places are tools/build_scene.py's (game/sceneArtSpec.ts).
import type { LayoutKind } from './layoutSpec';

export type TopText = { ink: string; halo: string };
export type ScenePreset = {
	name: string;
	field: string;
	bands: { top: string; bottom: string } | null;
	ends: { left: string; right: string; layouts: LayoutKind[] } | null;
	forest: string | null;
	topText: { scene: TopText; forest: TopText };
	hudGlass: 'ice' | 'deep';
	readoutInk: 'light' | 'dark';
	hudBeds: boolean;
	boardCover: { field: string; band: string | null } | null;
};

export const SCENE_PRESETS = {
	/** THE DAY SNOW (the snow scene kit r1, the forest candidate A, the black top line and the deeper glass) */
	snowDay: {
		name: 'snowDay',
		field: 'sceneField',
		bands: { top: 'sceneBandTop', bottom: 'sceneBandBottom' },
		ends: { left: 'sceneEndLeft', right: 'sceneEndRight', layouts: ['landscape', 'phone'] },
		forest: 'sceneForest',
		topText: {
			// the near black of the picture's own ink, a 1 px white under-glow (wider_scene_r2)
			scene: { ink: '#181a21', halo: '0 1px 0 rgba(255, 255, 255, 0.55)' },
			// over the forest: white with a soft dark halo (treeline_r2's "white" composite)
			forest: { ink: '#ffffff', halo: '0 1px 2px rgba(4, 10, 8, 0.95), 0 0 4px rgba(4, 10, 8, 0.85), 0 0 1px rgba(4, 10, 8, 0.9)' },
		},
		hudGlass: 'deep',
		readoutInk: 'dark',
		hudBeds: false,
		boardCover: { field: 'sceneField', band: 'sceneBandBottom' },
	},
} satisfies Record<string, ScenePreset>;

export type ScenePresetName = keyof typeof SCENE_PRESETS;
