import { createSound } from 'utils-sound';

// Names match tools/build_audiosprite.py (static/assets/audio/sounds.json).
export type MusicName = 'bgm_base' | 'bgm_free' | 'bgm_super' | 'bgm_feast' | 'bgm_maxwin';

export type SoundEffectName =
	| 'sfx_reel_spin'
	| 'sfx_reel_stop'
	| 'sfx_scatter_land_1'
	| 'sfx_scatter_land_2'
	| 'sfx_scatter_land_3'
	| 'sfx_scatter_land_4'
	| 'sfx_scatter_land_5'
	| 'sfx_leaf_land'
	| 'sfx_door_close'
	| 'sfx_door_open'
	| 'sfx_marty_strike'
	| 'sfx_marty_eat'
	| 'sfx_marty_angry'
	| 'sfx_marty_happy'
	| 'sfx_marty_poke'
	| 'sfx_win_big'
	| 'sfx_money_counter'
	| 'sfx_ui_button'
	| 'sfx_ui_spin'
	| 'sfx_ui_bonus';

export type SoundName = MusicName | SoundEffectName;

const sound = createSound<SoundName>();

export { sound };
