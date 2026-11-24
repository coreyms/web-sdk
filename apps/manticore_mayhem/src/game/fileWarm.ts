// FILES FETCHED AHEAD INTO THE HTTP CACHE (game/epicLoad.ts; constants EPIC_LOAD). A file is fetched and read to its end,
// nothing is kept, nothing decoded: the system that draws it then asks for it by the very same URL and the cache answers
// (a sheet's picture is asked for by the URL pixi.js's spritesheet loader builds, game/stripUpload.ts imageOfSheet).
// WHILE A FILE IS ON ITS WAY here, a system that wants it waits for it (warmWait) instead of starting a second download
// beside it: game/creatureLoad.ts fetchSheet and components/WarBanner.svelte's cloth and glyph loads ask first.
// Each file has `retries` more tries, `retryMs` apart. Never rejects.
// THE METER (THE HOLD's forecast, game/epicLoad.ts): every chunk read here is a sample (its time and size), and each file's
// bytes in so far are kept by URL (a sheet's picture under its json's URL as well), so the hold can say how many bytes
// are left and at what rate they come.
import { imageOfSheet } from './stripUpload';

/** every chunk read, oldest first (performance.now(), bytes); the last 400 */
export const warmSamples: { t: number; bytes: number }[] = [];
/** bytes in so far per URL, this try (a sheet's json URL: its json and its picture together) */
const received = new Map<string, number>();
export const warmReceived = (url: string): number => received.get(url) ?? 0;
const tally = (keys: readonly string[], bytes: number) => {
	for (const k of keys) received.set(k, (received.get(k) ?? 0) + bytes);
	warmSamples.push({ t: performance.now(), bytes });
	if (warmSamples.length > 400) warmSamples.splice(0, 200);
};

/** every file on its way, by URL (a sheet's json is listed until its picture is in too) */
const inFlight = new Map<string, Promise<boolean>>();
/** the files this session has in the cache already (one download per session) */
const warmed = new Set<string>();

/** resolves when a file this module is fetching is in (or failed), at once when it is not fetching it */
export const warmWait = (url: string): Promise<unknown> => inFlight.get(url) ?? Promise.resolve();
export const isWarm = (url: string): boolean => warmed.has(url);

type Priority = 'high' | 'low' | 'auto';
/** `priority`: a value, or asked at each try (a background file a round takes over goes on at normal priority) */
export type WarmOptions = { retries: number; retryMs: readonly number[]; priority?: Priority | (() => Priority); onTry?: (url: string, ok: boolean, bytes: number, priority: Priority) => void };
const later = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** one try: the body read to its end (text: as text, for a sheet's json) */
const tryOnce = async (url: string, text: boolean, priority: WarmOptions['priority'], keys: readonly string[]): Promise<{ ok: boolean; body: string; bytes: number }> => {
	// (a new try counts from 0: what an earlier try of this URL read is taken off every tally it went into)
	const mine = `try#${url}`;
	const before = received.get(mine) ?? 0;
	for (const k of keys) received.set(k, Math.max(0, (received.get(k) ?? 0) - before));
	received.set(mine, 0);
	const own = [...keys, mine];
	try {
		const res = await fetch(url, { priority: priority ?? 'auto' } as RequestInit);
		if (!res.ok) return { ok: false, body: '', bytes: 0 };
		if (text) {
			const body = await res.text();
			tally(own, body.length);
			return { ok: true, body, bytes: body.length };
		}
		let bytes = 0;
		if (res.body) {
			const reader = res.body.getReader();
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				bytes += value.byteLength;
				tally(own, value.byteLength);
			}
		} else {
			bytes = (await res.arrayBuffer()).byteLength;
			tally(own, bytes);
		}
		return { ok: true, body: '', bytes };
	} catch {
		return { ok: false, body: '', bytes: 0 };
	}
};

const withTries = async (url: string, text: boolean, o: WarmOptions, keys: readonly string[] = [url]): Promise<{ ok: boolean; body: string }> => {
	for (let i = 0; ; i += 1) {
		// (the priority this try was ASKED at: a record made at the try's end must not read a flag that changed meanwhile)
		const asked = (typeof o.priority === 'function' ? o.priority() : o.priority) ?? 'auto';
		const r = await tryOnce(url, text, asked, keys);
		o.onTry?.(url, r.ok, r.bytes, asked);
		if (r.ok) return r;
		if (i >= o.retries) return r;
		await later(o.retryMs[Math.min(i, o.retryMs.length - 1)] ?? 0);
	}
};

/** one file into the cache (true: it is in). `sheet`: the json URL whose picture this is (its bytes count there too) */
export const warmFile = (url: string, o: WarmOptions, sheet?: string): Promise<boolean> => {
	if (warmed.has(url)) return Promise.resolve(true);
	const have = inFlight.get(url);
	if (have) return have;
	const p = withTries(url, false, o, sheet ? [url, sheet] : [url]).then((r) => {
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
		if (image && !(await warmFile(imageOfSheet(jsonUrl, image), o, jsonUrl))) return false;
		warmed.add(jsonUrl);
		return true;
	})();
	inFlight.set(jsonUrl, p);
	void p.finally(() => inFlight.delete(jsonUrl));
	return p;
};
