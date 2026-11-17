// THE SCENE PRESETS (scene pass 9, Corey 2026-11-16): one named set of everything the scene around the road is made of,
// so the game can swap the whole look in one call (game/stateScene.svelte.ts setScenePreset). Three presets (scene swap,
// 2026-11-17): the day snow of the base game, the moonlit night snow of Free Spins, the deep night of Super Free Spins
// (the night kits S2 and S1 r2, tools/build_scene.py); the scene follows the round's mode (game/scene/sceneSwap.ts).
// THE DARK SET (dark mode, 2026-11-17): three more, the grass kits G1, B2 and G2 r2 (grassDay, grassNight, grassSuper), the
// set the player's Scene setting picks with Dark (game/sceneChoice.ts). Two sets of three: the round's mode picks the scene
// inside the set in use (presetForMode), the same swap in either.
//
// A preset names:
//   kit           its section of game/sceneArtSpec.ts (the pieces' files, sizes and road px places)
//   picture       the road picture and its two tunnel portal strips (asset keys): the night kits re-colour them too
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
//                 'light' over a dark scene, 'night' over the night snow (light, a lit WIN held darker) or 'dark' over snow
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
	kit: 'snowDay' | 'snowNight' | 'snowSuper' | 'grassDay' | 'grassNight' | 'grassSuper';
	picture: { road: string; tunnelLeft: string; tunnelRight: string };
	field: string;
	bands: { top: string; bottom: string } | null;
	ends: { left: string; right: string; layouts: LayoutKind[] } | null;
	forest: string | null;
	topText: { scene: TopText; forest: TopText };
	hudGlass: 'ice' | 'deep';
	readoutInk: 'light' | 'night' | 'dark';
	hudBeds: boolean;
	boardCover: { field: string; band: string | null } | null;
};

/** the night scenes' top line halo: the day forest's soft dark halo (white ink reads on the blue snow through it) */
const NIGHT_HALO = '0 1px 2px rgba(4, 10, 8, 0.95), 0 0 4px rgba(4, 10, 8, 0.85), 0 0 1px rgba(4, 10, 8, 0.9)';

export const SCENE_PRESETS = {
	/** THE DAY SNOW (the snow scene kit r1, the forest candidate A, the black top line and the deeper glass) */
	snowDay: {
		name: 'snowDay',
		kit: 'snowDay',
		picture: { road: 'road', tunnelLeft: 'tunnelLeft', tunnelRight: 'tunnelRight' },
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
	/** THE FREE SPINS NIGHT (night kit S2 r2: moonlit blue snow, amber light at the tunnel mouths). Its pieces load lazily
	 *  (game/assets.ts SCENE_LAZY_URLS). The top line is white with a dark halo (the kit's windows); the HUD keeps the
	 *  deeper glass (dark enough on the blue snow; the pale 'ice' glass would leave the white ink at about 2.6:1 there);
	 *  the upright readouts take the night ink (the light ink with the dark halo, a lit WIN held darker). */
	snowNight: {
		name: 'snowNight',
		kit: 'snowNight',
		picture: { road: 'nightRoad', tunnelLeft: 'nightTunnelLeft', tunnelRight: 'nightTunnelRight' },
		field: 'nightField',
		bands: { top: 'nightBandTop', bottom: 'nightBandBottom' },
		ends: { left: 'nightEndLeft', right: 'nightEndRight', layouts: ['landscape', 'phone'] },
		forest: 'nightForest',
		topText: {
			scene: { ink: '#ffffff', halo: NIGHT_HALO },
			forest: { ink: '#ffffff', halo: NIGHT_HALO },
		},
		hudGlass: 'deep',
		readoutInk: 'night',
		hudBeds: false,
		boardCover: { field: 'nightField', band: 'nightBandBottom' },
	},
	/** THE SUPER FREE SPINS NIGHT (night kit S1 r2: the deeper night, warm light pooled along the walls). As snowNight. */
	snowSuper: {
		name: 'snowSuper',
		kit: 'snowSuper',
		picture: { road: 'superRoad', tunnelLeft: 'superTunnelLeft', tunnelRight: 'superTunnelRight' },
		field: 'superField',
		bands: { top: 'superBandTop', bottom: 'superBandBottom' },
		ends: { left: 'superEndLeft', right: 'superEndRight', layouts: ['landscape', 'phone'] },
		forest: 'superForest',
		topText: {
			scene: { ink: '#ffffff', halo: NIGHT_HALO },
			forest: { ink: '#ffffff', halo: NIGHT_HALO },
		},
		hudGlass: 'deep',
		readoutInk: 'night',
		hudBeds: false,
		boardCover: { field: 'superField', band: 'superBandBottom' },
	},
	/** THE DARK SET'S BASE GAME (grass kit G1 r2: dark green grass with leftover snow on the verges and wall caps, the night
	 *  road picture). The grass is dark everywhere, so the top line and the upright readouts take the night's light ink with
	 *  the dark halo; the HUD keeps the deeper glass (the leftover snow patches under the dock are as white as the day's, and
	 *  the pale glass would leave the white ink low over them). Its pieces are in the first load only on a Dark boot. */
	grassDay: {
		name: 'grassDay',
		kit: 'grassDay',
		picture: { road: 'grassRoad', tunnelLeft: 'grassTunnelLeft', tunnelRight: 'grassTunnelRight' },
		field: 'grassField',
		bands: { top: 'grassBandTop', bottom: 'grassBandBottom' },
		ends: { left: 'grassEndLeft', right: 'grassEndRight', layouts: ['landscape', 'phone'] },
		forest: 'grassForest',
		topText: {
			scene: { ink: '#ffffff', halo: NIGHT_HALO },
			forest: { ink: '#ffffff', halo: NIGHT_HALO },
		},
		hudGlass: 'deep',
		readoutInk: 'night',
		hudBeds: false,
		boardCover: { field: 'grassField', band: 'grassBandBottom' },
	},
	/** THE DARK SET'S FREE SPINS (grass kit B2 r2: the bonus grass, a warm glow at the tunnel mouths). As grassDay. */
	grassNight: {
		name: 'grassNight',
		kit: 'grassNight',
		picture: { road: 'grassNightRoad', tunnelLeft: 'grassNightTunnelLeft', tunnelRight: 'grassNightTunnelRight' },
		field: 'grassNightField',
		bands: { top: 'grassNightBandTop', bottom: 'grassNightBandBottom' },
		ends: { left: 'grassNightEndLeft', right: 'grassNightEndRight', layouts: ['landscape', 'phone'] },
		forest: 'grassNightForest',
		topText: {
			scene: { ink: '#ffffff', halo: NIGHT_HALO },
			forest: { ink: '#ffffff', halo: NIGHT_HALO },
		},
		hudGlass: 'deep',
		readoutInk: 'night',
		hudBeds: false,
		boardCover: { field: 'grassNightField', band: 'grassNightBandBottom' },
	},
	/** THE DARK SET'S SUPER FREE SPINS (grass kit G2 r2: the deepest night, amber pools along the walls). As grassDay. */
	grassSuper: {
		name: 'grassSuper',
		kit: 'grassSuper',
		picture: { road: 'grassSuperRoad', tunnelLeft: 'grassSuperTunnelLeft', tunnelRight: 'grassSuperTunnelRight' },
		field: 'grassSuperField',
		bands: { top: 'grassSuperBandTop', bottom: 'grassSuperBandBottom' },
		ends: { left: 'grassSuperEndLeft', right: 'grassSuperEndRight', layouts: ['landscape', 'phone'] },
		forest: 'grassSuperForest',
		topText: {
			scene: { ink: '#ffffff', halo: NIGHT_HALO },
			forest: { ink: '#ffffff', halo: NIGHT_HALO },
		},
		hudGlass: 'deep',
		readoutInk: 'night',
		hudBeds: false,
		boardCover: { field: 'grassSuperField', band: 'grassSuperBandBottom' },
	},
} satisfies Record<string, ScenePreset>;

export type ScenePresetName = keyof typeof SCENE_PRESETS;
export type SceneSetName = 'snow' | 'grass';

/** THE TWO SETS: each set's scene for the base game, Free Spins and Super Free Spins */
export const SCENE_SETS: Record<SceneSetName, { base: ScenePresetName; bonus: ScenePresetName; super: ScenePresetName }> = {
	snow: { base: 'snowDay', bonus: 'snowNight', super: 'snowSuper' },
	grass: { base: 'grassDay', bonus: 'grassNight', super: 'grassSuper' },
};

/** the scene of a round's mode in a set: the base game's, the Free Spins', the Super's */
export const presetForMode = (mode: 'bonus' | 'super' | null | undefined, set: SceneSetName = 'snow'): ScenePresetName => SCENE_SETS[set][mode === 'super' ? 'super' : mode === 'bonus' ? 'bonus' : 'base'];

/** a set's base game scene (the one a set is shown with at rest, kept through its bonus rounds) */
export const homePreset = (set: SceneSetName): ScenePresetName => SCENE_SETS[set].base;

/** the set a preset belongs to */
export const setOfPreset = (name: ScenePresetName): SceneSetName => (name.startsWith('grass') ? 'grass' : 'snow');

/** every asset key a preset draws with (its picture, field, bands, ends and forest) */
export const presetKeys = (P: ScenePreset): string[] => [P.picture.road, P.picture.tunnelLeft, P.picture.tunnelRight, P.field, ...(P.bands ? [P.bands.top, P.bands.bottom] : []), ...(P.ends ? [P.ends.left, P.ends.right] : []), ...(P.forest ? [P.forest] : [])];
