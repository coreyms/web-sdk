// THE BACK-FEET SHADE'S SWITCH (constants CREATURE_SHADE; game/creature.ts draws it; Corey 2026-10-17 13:21, B locked in
// at 14:47). Option B's baked atlas (shared/creature-shade[-phone], built by tools/build_creature_assets.py --only-shade)
// is one of his shared sheets: game/creatureLoad.ts fetches it in his idle group, beside the shadow atlas, on the tier's
// twin, while B is the option drawn. 'off' and option A download nothing new.
// DEV: __manticore.creatureShade('off' | 'A' | 'B') (components/Background.svelte), which fetches B's atlas at once if
// it is not in yet; `?creatureshade=off|A|B` at boot.
import { CREATURE_SHADE, type CreatureShadeMode } from './constants';
import { creature } from './creature';
import { loadCreatureShared } from './creatureLoad';

const MODES: readonly CreatureShadeMode[] = ['off', 'A', 'B'];

/** DEV: switch the option by hand (B fetches its atlas first if it is not in; until it is, nothing of B is drawn). B
 *  shows at once, without the fade in */
export const setCreatureShade = async (mode: CreatureShadeMode): Promise<{ mode: CreatureShadeMode; loaded: boolean }> => {
	if (!MODES.includes(mode)) return { mode: creature.shadeOption, loaded: false };
	const loaded = mode === 'B' ? await loadCreatureShared('shade') : true;
	creature.setShadeMode(mode, true);
	return { mode: creature.shadeOption, loaded };
};

/** at boot, before his loader starts: the production default, or in DEV the `?creatureshade=` of the page (his idle
 *  group then fetches B's atlas only if B is on) */
export const bootCreatureShade = (): void => {
	let mode: CreatureShadeMode = CREATURE_SHADE.mode;
	if (import.meta.env.DEV && typeof location !== 'undefined') {
		const q = new URLSearchParams(location.search).get('creatureshade') as CreatureShadeMode | null;
		if (q && MODES.includes(q)) mode = q;
	}
	creature.setShadeMode(mode);
};
