// FILES FETCHED AHEAD INTO THE HTTP CACHE (game/epicLoad.ts; constants EPIC_LOAD). A file is fetched and read to its end,
// nothing is kept, nothing decoded: the system that draws it then asks for it by the very same URL and the cache answers
// (a sheet's picture is asked for by the URL pixi.js's spritesheet loader builds, game/stripUpload.ts imageOfSheet).
// WHILE A FILE IS ON ITS WAY here, a system that wants it waits for it (warmWait) instead of starting a second download
// beside it: game/creatureLoad.ts fetchSheet and components/WarBanner.svelte's cloth and glyph loads ask first.
// Each file has `retries` more tries, `retryMs` apart. Never rejects.
import { imageOfSheet } from './stripUpload';

/** every file on its way, by URL (a sheet's json is listed until its picture is in too) */
const inFlight = new Map<string, Promise<boolean>>();
/** the files this session has in the cache already (one download per session) */
const warmed = new Set<string>();

/** resolves when a file this module is fetching is in (or failed), at once when it is not fetching it */
export const warmWait = (url: string): Promise<unknown> => inFlight.get(url) ?? Promise.resolve();
export const isWarm = (url: string): boolean => warmed.has(url);

export type WarmOptions = { retries: number; retryMs: readonly number[]; priority?: 'high' | 'low' | 'auto'; onTry?: (url: string, ok: boolean, bytes: number) => void };
const later = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** one try: the body read to its end (text: as text, for a sheet's json) */
const tryOnce = async (url: string, text: boolean, priority: WarmOptions['priority']): Promise<{ ok: boolean; body: string; bytes: number }> => {
	try {
		const res = await fetch(url, { priority: priority ?? 'auto' } as RequestInit);
		if (!res.ok) return { ok: false, body: '', bytes: 0 };
		if (text) {
			const body = await res.text();
			return { ok: true, body, bytes: body.length };
		}
		let bytes = 0;
		if (res.body) {
			const reader = res.body.getReader();
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				bytes += value.byteLength;
			}
		} else bytes = (await res.arrayBuffer()).byteLength;
		return { ok: true, body: '', bytes };
	} catch {
		return { ok: false, body: '', bytes: 0 };
	}
};

const withTries = async (url: string, text: boolean, o: WarmOptions): Promise<{ ok: boolean; body: string }> => {
	for (let i = 0; ; i += 1) {
		const r = await tryOnce(url, text, o.priority);
		o.onTry?.(url, r.ok, r.bytes);
		if (r.ok) return r;
		if (i >= o.retries) return r;
		await later(o.retryMs[Math.min(i, o.retryMs.length - 1)] ?? 0);
	}
};

/** one file into the cache (true: it is in) */
export const warmFile = (url: string, o: WarmOptions): Promise<boolean> => {
	if (warmed.has(url)) return Promise.resolve(true);
	const have = inFlight.get(url);
	if (have) return have;
	const p = withTries(url, false, o).then((r) => {
		if (r.ok) warmed.add(url);
		return r.ok;
	});
	inFlight.set(url, p);
	void p.finally(() => inFlight.delete(url));
	return p;
};

/** a sheet into the cache: its json, then its picture (true: both are in). Its json's URL is listed as on its way until
 *  the picture is in as well, so a loader that waits for the json waits for the whole sheet */
export const warmSheet = (jsonUrl: string, o: WarmOptions): Promise<boolean> => {
	if (warmed.has(jsonUrl)) return Promise.resolve(true);
	const have = inFlight.get(jsonUrl);
	if (have) return have;
	const p = (async () => {
		const r = await withTries(jsonUrl, true, o);
		if (!r.ok) return false;
		let image = '';
		try {
			image = String((JSON.parse(r.body) as { meta?: { image?: string } }).meta?.image ?? '');
		} catch {
			return false;
		}
		if (image && !(await warmFile(imageOfSheet(jsonUrl, image), o))) return false;
		warmed.add(jsonUrl);
		return true;
	})();
	inFlight.set(jsonUrl, p);
	void p.finally(() => inFlight.delete(jsonUrl));
	return p;
};
