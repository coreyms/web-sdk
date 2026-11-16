<script lang="ts" module>
	import { sound, type MusicName, type SoundEffectName, type SoundName } from '../game/sound';

	export type EmitterEventSound =
		// `loop`: overrides the manifest's loop flag for this start. bgm_maxwin is authored as a
		// loop in music.json but the max-win screen plays it ONCE and gates its press on the end
		// (utils-sound createMusic: a looping media element never fires 'ended').
		| { type: 'soundMusic'; name: MusicName; loop?: boolean }
		// UI voices (Corey 2026-09-02): minor click = turbo / autoplay / denomination / menu / the
		// ACTIVATE-LOAD buttons / the landing continue; sub = every other button inside the autoplay
		// card; bonus = the bonus head button. Everything else keeps the general click.
		| { type: 'soundPressMinor' }
		| { type: 'soundPressSub' }
		| { type: 'soundPressBonus' }
		// volume: this one play's own level (0..1, times the effects mixer level), outside the player's per-name bookkeeping so
		// it never carries over to the next play of the same name (the tile flare's ring, constants TILE_FLARE)
		| { type: 'soundOnce'; name: SoundEffectName; forcePlay?: boolean; rate?: number; volume?: number } // rate: playback rate of this one play
		| { type: 'soundLoop'; name: SoundEffectName }
		| { type: 'soundStop'; name: SoundName }
		| { type: 'soundFade'; name: SoundName; from: number; to: number; duration: number }
		// a playing loop's rate (the scatter tease's step at three seen, game/road/roadSounds.ts)
		| { type: 'soundRate'; name: SoundEffectName; rate: number }
		| { type: 'soundScatterCounterIncrease' }
		| { type: 'soundScatterCounterClear' }
		| { type: 'soundDuck'; level: number }; // music multiplier 0..1 (win presentations)
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';

	import { getContext } from '../game/context';
	import { REINDEER_SOUND } from '../game/constants';
	import { stateSound, stateSoundDerived } from 'state-shared';

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
		soundMusic: ({ name, loop }) => sound.players.music.play({ name, loop }),
		// SKIP TO RESULT: the music carries on, the per-spin effects (cluster lands, bells, stings,
		// scatters) do not. The handlers still broadcast them; this is the one place they are dropped,
		// and bonusEnd / wincap clear `skipping` before anything the player must hear.
		soundLoop: ({ name }) => {
			if (!context.stateGame.skipping) sound.players.loop.play({ name });
		},
		soundOnce: ({ name, forcePlay, rate, volume }) => {
			if (context.stateGame.skipping) return;
			if (volume !== undefined) {
				// a play at its own level: straight on the sprite Howl (the same one the once player uses, so mute applies), its
				// level set on this play id only. Dropped, never queued, before the sprite is in (the once player's rule).
				const howl = sound.players?.once?.howl;
				if (!howl || howl.state() !== 'loaded') return;
				const id = howl.play(name);
				if (typeof id === 'number') howl.volume(Math.max(0, Math.min(1, volume)) * stateSoundDerived.volumeSoundEffect(), id);
				return;
			}
			sound.players.once.play({ name, forcePlay });
			// the sprite player's own rate(): it sets the rate of the play it has just started under this name
			if (rate !== undefined) sound.players.once.rate({ name, rate });
		},
		soundStop: ({ name }) => sound.stop({ name }),
		soundRate: ({ name, rate }) => sound.players.loop.rate({ name, rate }),
		soundFade: async ({ name, duration, from, to }) => await sound.fade({ name, duration, from, to }), // prettier-ignore
		soundDuck: ({ level }) => sound.players?.music?.volume(stateSoundDerived.volumeMusic() * level),
	});

	// Persist mixer + turbo level per browser.
	const STORE = 'run_over_reindeer.settings';
	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORE) ?? '{}');
			if (typeof saved.music === 'number') stateSound.volumeValueMusic = saved.music;
			if (typeof saved.sfx === 'number') stateSound.volumeValueSoundEffect = saved.sfx;
			if (typeof saved.master === 'number') stateSound.volumeValueMaster = saved.master;
			// the saved level is the BASE level; a resumed bonus keeps its normal speed (the live level
			// follows only outside a bonus — bonusStart zeroes it either way, whichever runs first)
			if ([0, 1, 2].includes(saved.turbo)) {
				context.stateGame.baseTurboLevel = saved.turbo;
				if (context.stateGame.gameType !== 'freegame') context.stateGameDerived.setTurboLevel(saved.turbo);
			}
		} catch {}
	});
	$effect(() => {
		const data = {
			music: stateSound.volumeValueMusic,
			sfx: stateSound.volumeValueSoundEffect,
			master: stateSound.volumeValueMaster,
			turbo: context.stateGame.baseTurboLevel,
		};
		try {
			localStorage.setItem(STORE, JSON.stringify(data));
		} catch {}
	});

	// THE ROAD'S AMBIENCE (constants REINDEER_SOUND ambience, round 3): amb_road, a 10 s loop in the effects sprite, quiet
	// under the base game. On from the moment the sprite is in (a loop asked before that is dropped, never queued), faded
	// in; when a feature's music takes over from the base music (stateGame.bonusMode) it fades out and stops, and it comes
	// back with the base music after the wrap-up card. One play at a time: a start while it is on does nothing.
	const AMB = REINDEER_SOUND.ambience;
	let ambOn = false;
	/** DEV: held off (the music loop probe measures the music alone at Howler's master) */
	let ambHeld = $state(false);
	let ambStop: ReturnType<typeof setTimeout> | null = null;
	const ambience = (want: boolean) => {
		if (want === ambOn) return;
		ambOn = want;
		const name = AMB.name as SoundEffectName;
		// DEV: the moment, for the sound probe (window.__reindeer.markMoment, components/Board.svelte)
		if (import.meta.env.DEV) (window as unknown as { __reindeer?: { markMoment?: (what: string, detail?: string) => void } }).__reindeer?.markMoment?.('ambience', want ? 'on' : 'off');
		if (want) {
			if (ambStop) {
				clearTimeout(ambStop);
				ambStop = null;
				sound.stop({ name });
			}
			sound.players.loop.play({ name });
			void sound.fade({ name, from: 0, to: 1, duration: AMB.inMs });
		} else {
			void sound.fade({ name, from: 1, to: 0, duration: AMB.outMs });
			ambStop = setTimeout(() => {
				ambStop = null;
				sound.stop({ name });
			}, AMB.outMs + 20);
		}
	};
	$effect(() => {
		const want = !ambHeld && sound.loadStatus === 'loaded' && context.stateGame.bonusMode === null;
		untrack(() => ambience(want));
	});
	onMount(() => () => {
		if (ambStop) clearTimeout(ambStop);
		sound.stop({ name: AMB.name as SoundEffectName });
	});
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		Object.assign(((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}), {
			/** DEV / the sound probe: whether the road's ambience is meant to be on */
			ambienceHold: (held: boolean) => (ambHeld = held),
			ambience: () => {
				const howl = sound.players?.loop?.howl as unknown as { _sounds?: { _sprite: string; _paused: boolean }[] } | undefined;
				return { on: ambOn, stopping: ambStop !== null, playing: !!howl?._sounds?.some((sd) => sd._sprite === AMB.name && !sd._paused) };
			},
		});
	}

	// The base loop starts with the game. BORROWED: every track and effect is Manticore Mayhem's, as a stand-in.
	onMount(() => {
		// the restored mixer level goes to the music player BEFORE the first play: the effect that normally hands it
		// over runs after this mount, so a session restored as muted started its track audible for a moment
		sound.players.music.volume(stateSoundDerived.volumeMusic());
		// (the bonus rounds are not presented yet; a resumed one would go to its own loop here)
		sound.players.music.play({ name: 'bgm_base' });
	});
</script>
