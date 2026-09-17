import { Howler } from 'howler';

/** iPhone / iPad: every browser there is WebKit, and HTMLMediaElement.volume is ignored outright
 *  (only `muted` is honoured). The music streams through media elements, and the effects sprite
 *  can land on the same path (createSound's HTML5 fallback), so on these devices a slider moved
 *  nothing until it hit zero (Corey, iPhone Safari + Chrome, 2026-09-17). */
export const isAppleTouch = (): boolean =>
	typeof navigator !== 'undefined' &&
	(/iP(hone|ad|od)/.test(navigator.platform) ||
		/iP(hone|ad|od)/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const gains = new WeakMap<HTMLMediaElement, GainNode>();

/** Route a media element through a Web Audio GainNode so its level can be set where the element's
 *  own volume is ignored. A MediaElementSource is permanent and its output only exists while the
 *  context runs, so this attaches only to a RUNNING context (a suspended one would silence the
 *  element outright) and never more than once per element. Returns the gain, or undefined when it
 *  could not (yet) be attached — callers fall back to the element's volume, which is what they did
 *  before. */
export const elementGain = (node: HTMLMediaElement): GainNode | undefined => {
	const existing = gains.get(node);
	if (existing) return existing;
	const ctx = Howler.ctx;
	if (!Howler.usingWebAudio || !ctx || ctx.state !== 'running') return undefined;
	try {
		const source = ctx.createMediaElementSource(node);
		const gain = ctx.createGain();
		source.connect(gain);
		gain.connect(ctx.destination);
		gains.set(node, gain);
		return gain;
	} catch {
		return undefined;
	}
};

export const gainOf = (node: HTMLMediaElement | undefined): GainNode | undefined => (node ? gains.get(node) : undefined);
