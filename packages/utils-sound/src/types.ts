export type SoundId = number;
export type SoundState = 'new' | 'playing' | 'paused';
export type SoundConfig = { volume: number };
export type SoundVolume = number;

export type GetSound<TSoundName> = {
	soundId: SoundId;
	soundName: TSoundName;
	soundState: SoundState;
	soundConfig: SoundConfig;
	soundVolume: SoundVolume;
};

export type GetSoundMap<TSoundName extends string> = Record<TSoundName, GetSound<TSoundName>>;

export type PlayOptions<TSoundName extends string> = {
	name: TSoundName;
	/** MUSIC ONLY (createMusic.svelte.ts): overrides the manifest's `loop` for this start. The
	 *  sfx players ignore it. Used by one-shot scored moments (Angry Mantis's max-win track) that
	 *  have to END so the presentation can gate on it. */
	loop?: boolean;
};
export type StopOptions<TSoundName extends string> = { name: TSoundName };
export type FadeOptions<TSoundName extends string> = {
	name: TSoundName;
	from: number;
	to: number;
	duration: number;
};
export type RateOptions<TSoundName extends string> = {
	name: TSoundName;
	rate: number;
};
