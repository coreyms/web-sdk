// THE PLAYER'S SCENE SETTING (dark mode, 2026-11-17): "Scene" with three choices, Auto, Snow and Dark, in the game menu and
// on the press screen (ui/hud/SceneSwitch.svelte). Snow is the snow set (snowDay, snowNight, snowSuper), Dark the grass set
// (grassDay, grassNight, grassSuper); Auto follows the device's light or dark setting (prefers-color-scheme). The default is
// Snow. The choice is remembered on the device (localStorage, its own key: Sound.svelte rewrites its settings object
// whole); every storage call is wrapped, so the game runs the same without storage (a private window, blocked site data).
// Plain TS (no runes): game/assets.ts reads the set to boot with before any texture loads, so only that set's base scene
// is in the first load.

export type SceneChoice = 'auto' | 'snow' | 'dark';
export type SceneSet = 'snow' | 'grass';

export const SCENE_CHOICES: readonly SceneChoice[] = ['auto', 'snow', 'dark'];
export const DEFAULT_SCENE_CHOICE: SceneChoice = 'snow';
const STORE = 'run_over_reindeer.scene';

const isChoice = (v: unknown): v is SceneChoice => v === 'auto' || v === 'snow' || v === 'dark';

/** the choice remembered on this device, or the default */
export const readSceneChoice = (): SceneChoice => {
	try {
		const v = localStorage.getItem(STORE);
		if (isChoice(v)) return v;
	} catch {
		/* no storage: the default */
	}
	return DEFAULT_SCENE_CHOICE;
};

/** remember the choice on this device (best effort) */
export const writeSceneChoice = (choice: SceneChoice) => {
	try {
		localStorage.setItem(STORE, choice);
	} catch {
		/* no storage: the choice lasts this session only */
	}
};

const darkQuery = (): MediaQueryList | null => {
	try {
		return typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
	} catch {
		return null;
	}
};

/** the device asks for dark now */
export const systemDark = (): boolean => !!darkQuery()?.matches;

/** call `fn` when the device's light or dark setting changes; returns the unsubscribe */
export const onSystemScheme = (fn: (dark: boolean) => void): (() => void) => {
	const q = darkQuery();
	if (!q) return () => {};
	const handler = (e: MediaQueryListEvent) => fn(e.matches);
	try {
		q.addEventListener('change', handler);
		return () => q.removeEventListener('change', handler);
	} catch {
		return () => {};
	}
};

/** the set a choice means, with the device dark or not */
export const setFor = (choice: SceneChoice, dark: boolean): SceneSet => (choice === 'dark' || (choice === 'auto' && dark) ? 'grass' : 'snow');

/** the set the game boots with (the first load holds only its base scene) */
export const BOOT_SCENE_SET: SceneSet = setFor(readSceneChoice(), systemDark());
