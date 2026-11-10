// THE CREATURE'S FILES (game/creature.ts draws them, game/creatureLoad.ts fetches them; built by
// tools/build_creature_assets.py from the rig drop into static/assets/sprites/creature). One atlas per clip and look,
// a full tier (640 px canvas) and a phone tier twin (432 px), and three atlases every look shares (the shadows of every
// clip, the glow of the charge and of the lit strike, the back-feet shade). GENERATED LIST, literal URLs on purpose (game/assets.ts says why).
// NONE OF THIS IS IN game/assets.ts: the shared loader would fetch every look in its last batch, and only ONE look
// may be resident at a time (constants CREATURE). The night look of the rig drop is not shipped: no mode shows it.
import { stamp } from './assets';
import { CREATURE } from './constants';
import { PHONE_TIER } from './deviceTier';

const tiered = <T>(full: T, phone: T): T => (PHONE_TIER ? phone : full);
/** THE IDLE SHEETS (constants CREATURE.phoneFullIdle, creature-sharp option C, Corey 2026-10-17 13:02 "Option C Sounds
 *  fine"): the phone tier takes the full tier's 640 px idle as well; every other clip keeps its phone twin. Both URLs
 *  stay literal, so the build keeps both files and the rollback (the constant false) is the phone file again. */
const tieredIdle = <T>(full: T, phone: T): T => (PHONE_TIER && !CREATURE.phoneFullIdle ? phone : full);

export const CREATURE_LOOKS = ['day', 'super', 'epic'] as const;
export type CreatureLook = (typeof CREATURE_LOOKS)[number];
// (the glow overlays of creatureSpec.ts, charge_glow / sting_hit_glow / sting_recrouch_glow, are NOT clips here: every
// body-clip table walks this list, and the shadow atlas has no frames for them)
export const CREATURE_CLIPS = ['idle', 'idle_look', 'swipe', 'roar', 'snarl', 'growl', 'charge_in', 'charge_loop', 'sting_hit', 'sting_recrouch', 'win_big', 'win_mega', 'win_super', 'win_epic_in', 'win_epic_loop', 'win_epic_out'] as const;
export type CreatureClip = (typeof CREATURE_CLIPS)[number];
/** THE WIN CLIPS (drop 8): his move per win plaque tier, their own load group (game/creatureLoad.ts creatureWins; constants
 *  CREATURE.wins: on demand, or up front with the rest of the look) */
export const CREATURE_WIN_CLIPS = ['win_big', 'win_mega', 'win_super', 'win_epic_in', 'win_epic_loop', 'win_epic_out'] as const satisfies readonly CreatureClip[];
export type CreatureWinClip = (typeof CREATURE_WIN_CLIPS)[number];

// EVERY CLIP IS A LIST OF PAGES (drop 8): a clip too big for one 4096 sheet is built as standalone pages
// (tools/build_creature_assets.py --pages-standalone; only win_mega at 640 so far), each a sheet of its own, so each takes
// the worker decode and the strip upload (game/stripUpload.ts). game/creatureLoad.ts loads every page and joins their frames.
export const CREATURE_FILES: Record<CreatureLook, Record<CreatureClip, readonly string[]>> = {
	day: {
		idle: tieredIdle([stamp(new URL('../../assets/sprites/creature/day/creature-day-idle.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-idle-phone.json', import.meta.url).href)]),
		idle_look: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-idle_look.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-idle_look-phone.json', import.meta.url).href)]),
		swipe: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-swipe.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-swipe-phone.json', import.meta.url).href)]),
		roar: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-roar.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-roar-phone.json', import.meta.url).href)]),
		snarl: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-snarl.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-snarl-phone.json', import.meta.url).href)]),
		growl: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-growl.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-growl-phone.json', import.meta.url).href)]),
		charge_in: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-charge_in.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-charge_in-phone.json', import.meta.url).href)]),
		charge_loop: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-charge_loop.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-charge_loop-phone.json', import.meta.url).href)]),
		sting_hit: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-sting_hit.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-sting_hit-phone.json', import.meta.url).href)]),
		sting_recrouch: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-sting_recrouch.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-sting_recrouch-phone.json', import.meta.url).href)]),
		win_big: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-win_big.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-win_big-phone.json', import.meta.url).href)]),
		win_mega: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-win_mega-1.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/day/creature-day-win_mega-2.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-win_mega-phone.json', import.meta.url).href)]),
		win_super: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-win_super.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-win_super-phone.json', import.meta.url).href)]),
		win_epic_in: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-win_epic_in.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-win_epic_in-phone.json', import.meta.url).href)]),
		win_epic_loop: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-win_epic_loop.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-win_epic_loop-phone.json', import.meta.url).href)]),
		win_epic_out: tiered([stamp(new URL('../../assets/sprites/creature/day/creature-day-win_epic_out.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/day/creature-day-win_epic_out-phone.json', import.meta.url).href)]),
	},
	super: {
		idle: tieredIdle([stamp(new URL('../../assets/sprites/creature/super/creature-super-idle.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-idle-phone.json', import.meta.url).href)]),
		idle_look: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-idle_look.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-idle_look-phone.json', import.meta.url).href)]),
		swipe: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-swipe.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-swipe-phone.json', import.meta.url).href)]),
		roar: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-roar.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-roar-phone.json', import.meta.url).href)]),
		snarl: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-snarl.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-snarl-phone.json', import.meta.url).href)]),
		growl: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-growl.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-growl-phone.json', import.meta.url).href)]),
		charge_in: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-charge_in.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-charge_in-phone.json', import.meta.url).href)]),
		charge_loop: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-charge_loop.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-charge_loop-phone.json', import.meta.url).href)]),
		sting_hit: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-sting_hit.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-sting_hit-phone.json', import.meta.url).href)]),
		sting_recrouch: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-sting_recrouch.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-sting_recrouch-phone.json', import.meta.url).href)]),
		win_big: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-win_big.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-win_big-phone.json', import.meta.url).href)]),
		win_mega: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-win_mega-1.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/super/creature-super-win_mega-2.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-win_mega-phone.json', import.meta.url).href)]),
		win_super: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-win_super.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-win_super-phone.json', import.meta.url).href)]),
		win_epic_in: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-win_epic_in.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-win_epic_in-phone.json', import.meta.url).href)]),
		win_epic_loop: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-win_epic_loop.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-win_epic_loop-phone.json', import.meta.url).href)]),
		win_epic_out: tiered([stamp(new URL('../../assets/sprites/creature/super/creature-super-win_epic_out.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/super/creature-super-win_epic_out-phone.json', import.meta.url).href)]),
	},
	epic: {
		idle: tieredIdle([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-idle.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-idle-phone.json', import.meta.url).href)]),
		idle_look: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-idle_look.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-idle_look-phone.json', import.meta.url).href)]),
		swipe: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-swipe.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-swipe-phone.json', import.meta.url).href)]),
		roar: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-roar.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-roar-phone.json', import.meta.url).href)]),
		snarl: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-snarl.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-snarl-phone.json', import.meta.url).href)]),
		growl: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-growl.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-growl-phone.json', import.meta.url).href)]),
		charge_in: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-charge_in.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-charge_in-phone.json', import.meta.url).href)]),
		charge_loop: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-charge_loop.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-charge_loop-phone.json', import.meta.url).href)]),
		sting_hit: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-sting_hit.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-sting_hit-phone.json', import.meta.url).href)]),
		sting_recrouch: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-sting_recrouch.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-sting_recrouch-phone.json', import.meta.url).href)]),
		win_big: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_big.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_big-phone.json', import.meta.url).href)]),
		win_mega: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_mega-1.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_mega-2.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_mega-phone.json', import.meta.url).href)]),
		win_super: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_super.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_super-phone.json', import.meta.url).href)]),
		win_epic_in: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_epic_in.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_epic_in-phone.json', import.meta.url).href)]),
		win_epic_loop: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_epic_loop.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_epic_loop-phone.json', import.meta.url).href)]),
		win_epic_out: tiered([stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_epic_out.json', import.meta.url).href)], [stamp(new URL('../../assets/sprites/creature/epic/creature-epic-win_epic_out-phone.json', import.meta.url).href)]),
	},
};
/** shared by every look, loaded once: every clip's shadow frames, the glow (the charge's, and the lit strike's over
 *  sting_hit and sting_recrouch, one atlas), the back-feet shade (option B of constants CREATURE_SHADE; fetched in
 *  his idle group only while that option is on, game/creatureLoad.ts), and THE EPIC WIN'S TAIL GLOW (drop 8, Corey
 *  2026-11-09 "Epic win keeps tail glow": win_epic_in f20..40, win_epic_loop, win_epic_out f1..6, its own atlas so it
 *  loads and goes with the win clips) */
export const CREATURE_SHARED = {
	glow: tiered(stamp(new URL('../../assets/sprites/creature/shared/creature-glow.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/shared/creature-glow-phone.json', import.meta.url).href)),
	glowWins: tiered(stamp(new URL('../../assets/sprites/creature/shared/creature-glow-wins.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/shared/creature-glow-wins-phone.json', import.meta.url).href)),
	shadow: tiered(stamp(new URL('../../assets/sprites/creature/shared/creature-shadow.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/shared/creature-shadow-phone.json', import.meta.url).href)),
	shade: tiered(stamp(new URL('../../assets/sprites/creature/shared/creature-shade.json', import.meta.url).href), stamp(new URL('../../assets/sprites/creature/shared/creature-shade-phone.json', import.meta.url).href)),
};
