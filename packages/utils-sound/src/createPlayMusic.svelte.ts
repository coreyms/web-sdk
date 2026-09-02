import type { Howl } from 'howler';

import type { PlayOptions, GetSound, GetSoundMap } from './types';

export function createPlayMusic<TSoundName extends string>(options: {
	howl: Howl;
	newSound: (value: TSoundName) => GetSound<TSoundName>;
	getSoundMap: () => GetSoundMap<TSoundName>;
	initSoundVolume: (soundName: TSoundName) => void;
}) {
	type Sound = GetSound<TSoundName>;

	const pauseAllMusic = () => {
		(Object.values(options.getSoundMap()) as Sound[]).forEach((existingSound) => {
			options.howl.pause(existingSound.soundId);
			options.getSoundMap()[existingSound.soundName] = {
				...existingSound,
				soundState: 'paused',
			};
		});
	};

	const newMusic = (sound: Sound) => {
		pauseAllMusic();
		const soundId = options.howl.play(sound.soundName);
		options.getSoundMap()[sound.soundName] = {
			...sound,
			soundId,
			soundState: 'playing',
		};
		options.initSoundVolume(sound.soundName);
	};

	const resumeMusic = (sound: Sound) => {
		pauseAllMusic();
		options.howl.play(sound.soundId);
		options.getSoundMap()[sound.soundName] = {
			...sound,
			soundState: 'playing',
		};
	};

	const soundPlayMap = {
		new: (sound: Sound) => newMusic(sound),
		paused: (sound: Sound) => resumeMusic(sound),
		playing: (_: Sound) => {
			// Do nothing
		},
	};

	// Music is the one sound that still matters when it's late: unlike sfx it has no moment to miss,
	// it's just "what should be playing right now". So instead of letting Howler queue every call
	// made before the sprite decoded (which fires them ALL at once on load — several tracks at
	// once), we remember only the LAST requested track and start it cleanly from the load event.
	let pendingName: TSoundName | null = null;

	const play = (playOptions: PlayOptions<TSoundName>) => {
		if (options.howl.state() !== 'loaded') {
			pendingName = playOptions.name;
			return;
		}
		const existingSound = options.getSoundMap()[playOptions.name];
		const sound = existingSound ?? options.newSound(playOptions.name);
		soundPlayMap[sound.soundState](sound);
	};

	if (options.howl.state() !== 'loaded') {
		options.howl.once('load', () => {
			const name = pendingName;
			pendingName = null;
			if (name) play({ name });
		});
	}

	return {
		play,
	};
}
