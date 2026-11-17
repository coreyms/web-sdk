// THE TUNING PANEL'S MEMORY (2026-11-17, Corey: values marked for a reload came back at their defaults after the reload,
// so they could not be tried at all). STAGING ONLY: routes/+layout.svelte calls applyRememberedTune behind STAGING_TOOLS (a
// build-time constant, so a production build drops the call and this module), and only on a page opened with `?tune=`.
// The values that differ from game/constants.ts's defaults are kept in localStorage under one key, as { "a.b.c": value };
// they are written into TUNE before the board and the scene are built, so a value read once at build time takes effect.
// Every storage access is wrapped: a private window, blocked storage or a stale key (a value since renamed or removed
// from the constants, or of another type now) is ignored, never an error. Side effect free until a function is called.

export const TUNE_STORE_KEY = 'ror-tune-remembered-v1';

type Branch = Record<string, unknown>;
const isBranch = (v: unknown): v is Branch => v !== null && typeof v === 'object';
const clone = (v: unknown): unknown => (Array.isArray(v) ? v.map(clone) : isBranch(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);
const getAt = (root: unknown, path: string[]) => path.reduce<unknown>((o, k) => (isBranch(o) ? o[k] : undefined), root);

/** the defaults as the page loaded them, taken before any remembered value is applied (the panel compares with these) */
let defaults: Branch | null = null;
export const tuneDefaults = (): Branch | null => defaults;
/** how many remembered values were applied at this page's start */
let applied = 0;
export const rememberedApplied = () => applied;

export const readRemembered = (): Record<string, unknown> => {
	try {
		const raw = globalThis.localStorage?.getItem(TUNE_STORE_KEY);
		const o = raw ? JSON.parse(raw) : null;
		return isBranch(o) && !Array.isArray(o) ? o : {};
	} catch {
		return {};
	}
};

/** keep exactly these changed values (id = the dotted path below TUNE); an empty map clears the store */
export const writeRemembered = (changed: Record<string, unknown>) => {
	try {
		if (Object.keys(changed).length) globalThis.localStorage?.setItem(TUNE_STORE_KEY, JSON.stringify(changed));
		else globalThis.localStorage?.removeItem(TUNE_STORE_KEY);
	} catch {
		// (storage blocked: the panel works for this page only)
	}
};

/** the same kind of value as the default: a stored value of another kind (the constant changed since) is stale */
const sameKind = (def: unknown, v: unknown) => (def === null ? v === null || typeof v === 'number' : typeof def === typeof v && !isBranch(v));

/** write the remembered values into `tune` (game/constants.ts TUNE); returns how many took. Stale ones are dropped from
 *  the store. Call once, before the board and the scene are built. */
export const applyRememberedTune = (tune: Branch): number => {
	if (defaults) return applied;
	defaults = clone(tune) as Branch;
	const stored = readRemembered();
	const kept: Record<string, unknown> = {};
	for (const [id, v] of Object.entries(stored)) {
		const path = id.split('.');
		const parent = getAt(tune, path.slice(0, -1));
		const key = path[path.length - 1];
		if (!isBranch(parent) || !(key in parent) || !sameKind(parent[key], v)) continue;
		parent[key] = v;
		kept[id] = v;
	}
	if (Object.keys(kept).length !== Object.keys(stored).length) writeRemembered(kept);
	applied = Object.keys(kept).length;
	return applied;
};
