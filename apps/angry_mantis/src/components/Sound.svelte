<script lang="ts" module>
	import { sound, type MusicName, type SoundEffectName, type SoundName } from '../game/sound';

	export type EmitterEventSound =
		| { type: 'soundMusic'; name: MusicName }
		// UI voices (Corey 2026-09-02): minor click = turbo / autoplay / denomination / menu / the
		// ACTIVATE-LOAD buttons / the landing continue; sub = every other button inside the autoplay
		// card; bonus = the bonus head button. Everything else keeps the general click.
		| { type: 'soundPressMinor' }
		| { type: 'soundPressSub' }
		| { type: 'soundPressBonus' }
		| { type: 'soundOnce'; name: SoundEffectName; forcePlay?: boolean }
		| { type: 'soundLoop'; name: SoundEffectName }
		| { type: 'soundStop'; name: SoundName }
		| { type: 'soundFade'; name: SoundName; from: number; to: number; duration: number }
		| { type: 'soundScatterCounterIncrease' }
		| { type: 'soundScatterCounterClear' }
		| { type: 'soundDuck'; level: number }; // music multiplier 0..1 (win presentations)
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import { stateSound, stateSoundDerived, stateBetDerived } from 'state-shared';

	const context = getContext();

	context.eventEmitter.subscribeOnMount({
		// ui
		soundBetMode: () => {},
		soundPressGeneral: () => sound.players.once.play({ name: 'sfx_ui_button' }),
		soundPressBet: () => sound.players.once.play({ name: 'sfx_ui_spin' }),
		soundPressMinor: () => sound.players.once.play({ name: 'sfx_ui_minor' }),
		soundPressSub: () => sound.players.once.play({ name: 'sfx_ui_sub' }),
		soundPressBonus: () => sound.players.once.play({ name: 'sfx_ui_bonus' }),
		// scatterCounter
		soundScatterCounterIncrease: () => (context.stateGame.scatterCounter = context.stateGame.scatterCounter + 1), // prettier-ignore
		soundScatterCounterClear: () => (context.stateGame.scatterCounter = 0),
		// game
		soundMusic: ({ name }) => sound.players.music.play({ name }),
		soundLoop: ({ name }) => sound.players.loop.play({ name }),
		soundOnce: ({ name, forcePlay }) => sound.players.once.play({ name, forcePlay }),
		soundStop: ({ name }) => sound.stop({ name }),
		soundFade: async ({ name, duration, from, to }) => await sound.fade({ name, duration, from, to }), // prettier-ignore
		soundDuck: ({ level }) => sound.players?.music?.volume(stateSoundDerived.volumeMusic() * level),
	});

	// Persist mixer + turbo level per browser.
	const STORE = 'angry_mantis.settings';
	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORE) ?? '{}');
			if (typeof saved.music === 'number') stateSound.volumeValueMusic = saved.music;
			if (typeof saved.sfx === 'number') stateSound.volumeValueSoundEffect = saved.sfx;
			if (typeof saved.master === 'number') stateSound.volumeValueMaster = saved.master;
			if ([0, 1, 2].includes(saved.turbo)) {
				context.stateGame.turboLevel = saved.turbo;
				stateBetDerived.updateIsTurbo(saved.turbo > 0, { persistent: true });
			}
		} catch {}
	});
	$effect(() => {
		const data = {
			music: stateSound.volumeValueMusic,
			sfx: stateSound.volumeValueSoundEffect,
			master: stateSound.volumeValueMaster,
			turbo: context.stateGame.turboLevel,
		};
		try {
			localStorage.setItem(STORE, JSON.stringify(data));
		} catch {}
	});

	// base-loop.ogg is self-contained (Corey 2026-09-01) — it just loops from the start, no intro
	// stinger to sequence behind. A bonus in progress (resume) goes straight to its own loop.
	onMount(() => {
		if (context.stateGame.gameType === 'freegame') {
			const mode = context.stateGame.bonusMode;
			sound.players.music.play({ name: mode === 'feast' ? 'bgm_feast' : mode === 'super' ? 'bgm_super' : 'bgm_free' });
			return;
		}
		sound.players.music.play({ name: 'bgm_base' });
	});
</script>
