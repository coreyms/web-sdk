import type { Howl } from 'howler';

import type { PlayOptions, GetSound, GetSoundMap } from './types';

export function createPlayOnce<TSoundName extends string>(options: {
	howl: Howl;
	newSound: (value: TSoundName) => GetSound<TSoundName>;
	getSoundMap: () => GetSoundMap<TSoundName>;
	initSoundVolume: (soundName: TSoundName) => void;
}) {
	type Sound = GetSound<TSoundName>;

	const playOnce = (sound: Sound) => {
		const soundId = options.howl.play(sound.soundName);
		options.getSoundMap()[sound.soundName] = {
			...sound,
			soundId,
			soundState: 'playing',
		};

		options.initSoundVolume(sound.soundName);

		// once + soundId, NOT on: `on('end', …)` piled one permanent listener onto the shared Howl
		// per play (never removed — thousands over a session, every one run on every sfx end).
		// Howler's id-scoped `once` fires only for this play id and removes itself; a sound stopped
		// early instead of ending is cleaned up by createPlayer.stop's matching off('end', id).
		options.howl.once(
			'end',
			() => {
				options.howl.stop(soundId);
				delete options.getSoundMap()[sound.soundName];
			},
			soundId,
		);
	};

	const soundPlayMap = {
		new: (sound: Sound) => playOnce(sound),
		paused: (sound: Sound) => playOnce(sound),
		playing: (sound: Sound, options: { forcePlay?: boolean }) => {
			if (options.forcePlay) playOnce(sound);
		},
	};

	const play = (playOptions: PlayOptions<TSoundName> & { forcePlay?: boolean }) => {
		// Drop, never queue. Howler buffers play() calls made before the sprite decodes and fires
		// them all in the same millisecond on 'load' — on a slow link that meant a spin's worth of
		// stale sfx exploding minutes later. A one-shot that missed its moment is just gone.
		if (options.howl.state() !== 'loaded') return;
		const existingSound = options.getSoundMap()[playOptions.name];
		const sound = existingSound ?? options.newSound(playOptions.name);
		soundPlayMap[sound.soundState](sound, { forcePlay: playOptions.forcePlay });
	};

	return {
		play,
	};
}
