// THE CREATURE'S FILES (game/creature.ts draws them, game/creatureLoad.ts fetches them; built by
// tools/build_creature_assets.py from the rig drop into static/assets/sprites/creature). One atlas per clip and look,
// a full tier (640 px canvas) and a phone tier twin (432 px), and two atlases every look shares (the shadows of every
// clip, the glow of the charge and of the lit strike). GENERATED LIST, literal URLs on purpose (game/assets.ts says why).
// NONE OF THIS IS IN game/assets.ts: the shared loader would fetch every look in its last batch, and only ONE look
// may be resident at a time (constants CREATURE). The night look of the rig drop is not shipped: no mode shows it.
import { stamp } from './assets';
import { PHONE_TIER } from './deviceTier';

const tiered = (full: string, phone: string): string => (PHONE_TIER ? phone : full);

export const CREATURE_LOOKS = ['day', 'super', 'epic'] as const;
export type CreatureLook = (typeof CREATURE_LOOKS)[number];
// (the glow overlays of creatureSpec.ts, charge_glow / sting_hit_glow / sting_recrouch_glow, are NOT clips here: every
// body-clip table walks this list, and the shadow atlas has no frames for them)
export const CREATURE_CLIPS = ['idle', 'swipe', 'roar', 'sting_hit', 'sting_recrouch', 'charge_in', 'charge_loop', 'snarl', 'growl'] as const;
export type CreatureClip = (typeof CREATURE_CLIPS)[number];

export const CREATURE_FILES: Record<CreatureLook, Record<CreatureClip, string>> = {
	day: {
		idle: tiered(stamp(new URL('../../assets/sprites/creature/day/creature-day-idle.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/day/creature-day-idle-phone.json', import.meta.url).href)),
		swipe: tiered(stamp(new URL('../../assets/sprites/creature/day/creature-day-swipe.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/day/creature-day-swipe-phone.json', import.meta.url).href)),
		roar: tiered(stamp(new URL('../../assets/sprites/creature/day/creature-day-roar.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/day/creature-day-roar-phone.json', import.meta.url).href)),
		sting_hit: tiered(stamp(new URL('../../assets/sprites/creature/day/creature-day-sting_hit.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/day/creature-day-sting_hit-phone.json', import.meta.url).href)),
		sting_recrouch: tiered(stamp(new URL('../../assets/sprites/creature/day/creature-day-sting_recrouch.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/day/creature-day-sting_recrouch-phone.json', import.meta.url).href)),
		charge_in: tiered(stamp(new URL('../../assets/sprites/creature/day/creature-day-charge_in.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/day/creature-day-charge_in-phone.json', import.meta.url).href)),
		charge_loop: tiered(stamp(new URL('../../assets/sprites/creature/day/creature-day-charge_loop.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/day/creature-day-charge_loop-phone.json', import.meta.url).href)),
		snarl: tiered(stamp(new URL('../../assets/sprites/creature/day/creature-day-snarl.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/day/creature-day-snarl-phone.json', import.meta.url).href)),
		growl: tiered(stamp(new URL('../../assets/sprites/creature/day/creature-day-growl.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/day/creature-day-growl-phone.json', import.meta.url).href)),
	},
	super: {
		idle: tiered(stamp(new URL('../../assets/sprites/creature/super/creature-super-idle.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/super/creature-super-idle-phone.json', import.meta.url).href)),
		swipe: tiered(stamp(new URL('../../assets/sprites/creature/super/creature-super-swipe.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/super/creature-super-swipe-phone.json', import.meta.url).href)),
		roar: tiered(stamp(new URL('../../assets/sprites/creature/super/creature-super-roar.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/super/creature-super-roar-phone.json', import.meta.url).href)),
		sting_hit: tiered(stamp(new URL('../../assets/sprites/creature/super/creature-super-sting_hit.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/super/creature-super-sting_hit-phone.json', import.meta.url).href)),
		sting_recrouch: tiered(stamp(new URL('../../assets/sprites/creature/super/creature-super-sting_recrouch.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/super/creature-super-sting_recrouch-phone.json', import.meta.url).href)),
		charge_in: tiered(stamp(new URL('../../assets/sprites/creature/super/creature-super-charge_in.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/super/creature-super-charge_in-phone.json', import.meta.url).href)),
		charge_loop: tiered(stamp(new URL('../../assets/sprites/creature/super/creature-super-charge_loop.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/super/creature-super-charge_loop-phone.json', import.meta.url).href)),
		snarl: tiered(stamp(new URL('../../assets/sprites/creature/super/creature-super-snarl.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/super/creature-super-snarl-phone.json', import.meta.url).href)),
		growl: tiered(stamp(new URL('../../assets/sprites/creature/super/creature-super-growl.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/super/creature-super-growl-phone.json', import.meta.url).href)),
	},
	epic: {
		idle: tiered(stamp(new URL('../../assets/sprites/creature/epic/creature-epic-idle.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/epic/creature-epic-idle-phone.json', import.meta.url).href)),
		swipe: tiered(stamp(new URL('../../assets/sprites/creature/epic/creature-epic-swipe.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/epic/creature-epic-swipe-phone.json', import.meta.url).href)),
		roar: tiered(stamp(new URL('../../assets/sprites/creature/epic/creature-epic-roar.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/epic/creature-epic-roar-phone.json', import.meta.url).href)),
		sting_hit: tiered(stamp(new URL('../../assets/sprites/creature/epic/creature-epic-sting_hit.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/epic/creature-epic-sting_hit-phone.json', import.meta.url).href)),
		sting_recrouch: tiered(stamp(new URL('../../assets/sprites/creature/epic/creature-epic-sting_recrouch.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/epic/creature-epic-sting_recrouch-phone.json', import.meta.url).href)),
		charge_in: tiered(stamp(new URL('../../assets/sprites/creature/epic/creature-epic-charge_in.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/epic/creature-epic-charge_in-phone.json', import.meta.url).href)),
		charge_loop: tiered(stamp(new URL('../../assets/sprites/creature/epic/creature-epic-charge_loop.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/epic/creature-epic-charge_loop-phone.json', import.meta.url).href)),
		snarl: tiered(stamp(new URL('../../assets/sprites/creature/epic/creature-epic-snarl.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/epic/creature-epic-snarl-phone.json', import.meta.url).href)),
		growl: tiered(stamp(new URL('../../assets/sprites/creature/epic/creature-epic-growl.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/epic/creature-epic-growl-phone.json', import.meta.url).href)),
	},
};
/** shared by every look, loaded once: every clip's shadow frames, and the glow (the charge's, and the lit strike's over
 *  sting_hit and sting_recrouch, one atlas) */
export const CREATURE_SHARED = {
	shadow: tiered(stamp(new URL('../../assets/sprites/creature/shared/creature-shadow.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/shared/creature-shadow-phone.json', import.meta.url).href)),
	glow: tiered(stamp(new URL('../../assets/sprites/creature/shared/creature-glow.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/shared/creature-glow-phone.json', import.meta.url).href)),
};
