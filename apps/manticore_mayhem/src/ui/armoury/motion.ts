// THE ARMOURY'S MOTION HELPERS (spec 2.5 and 5). Reusable: no game names, no imports, node runs it as it is
// (tools/manticore/armoury_parts_check.mjs). The numbers come in as arguments (constants.ts ARMOURY.motion).
//
// THE EASE is a true exponential approach, value = 1 - exp(-t / T), run for `run` T and normalised to land on 1. In
// CSS it is a linear() function of `points` points, built once; where linear() is not supported the fallback is a
// close cubic-bezier. With T = 80 ms and run 6.5 a small move takes 520 ms (95 % at 240 ms); large moves (hero,
// confirm card) use T * large.
//
// MOST MOTION IS CSS (keyframes and transitions, durations passed in as custom properties). The few moves whose start
// is only known at run time (the touch layouts' plate and tray easing to a new place, the swipe's release and spring
// back) use `createMover().move`: element.animate inside try / catch, landing at once if it throws, every running
// animation counted (the DEV hook reports the count; after any interruption it must be zero).
//
// REDUCED MOTION (prefers-reduced-motion: reduce): every duration and delay is 0, not 1 ms (the prototype found a
// forced 1 ms transition makes a measurement taken right after a size change read the old size). A move then does not
// animate at all: the element is simply at its rest state.

export type MotionRules = { tauMs: number; run: number; large: number; easePoints: number };

/** the normalised exponential approach at time t (ms) of a move of time constant tauMs run for `run` tau: 0..1 */
export const expProgress = (t: number, tauMs: number, run: number): number => {
	if (t <= 0) return 0;
	const end = run * tauMs;
	if (t >= end) return 1;
	return (1 - Math.exp(-t / tauMs)) / (1 - Math.exp(-run));
};

/** the CSS linear() ease: `points` samples of the normalised approach, 4 decimals */
export const expEaseCss = (run: number, points: number): string => {
	const n = Math.max(2, Math.round(points)) - 1;
	const pts: string[] = [];
	for (let i = 0; i <= n; i++) pts.push(((1 - Math.exp((-run * i) / n)) / (1 - Math.exp(-run))).toFixed(4));
	return `linear(${pts.join(', ')})`;
};

/** where linear() is not supported */
export const EASE_FALLBACK = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** does this browser take a linear() timing function? (false outside a browser) */
export const supportsLinearEase = (): boolean => {
	try {
		const css = (globalThis as { CSS?: { supports?: (p: string, v: string) => boolean } }).CSS;
		return !!css?.supports?.('transition-timing-function', 'linear(0, 1)');
	} catch {
		return false;
	}
};

/** the ease string to use: linear() where supported, else the fallback */
export const pickEase = (rules: MotionRules, linearOk = supportsLinearEase()): string => (linearOk ? expEaseCss(rules.run, rules.easePoints) : EASE_FALLBACK);

/** reduced motion, read ONCE at mount (as LandingScreen.svelte does) */
export const prefersReducedMotion = (): boolean => {
	try {
		const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
		return !!mm?.('(prefers-reduced-motion: reduce)').matches;
	} catch {
		return false;
	}
};

/** the two move lengths, ms: small (run * tau, 520) and large (run * tau * large, 863); both 0 under reduced motion */
export const moveDurations = (rules: MotionRules, reduced: boolean): { small: number; large: number } =>
	reduced ? { small: 0, large: 0 } : { small: rules.run * rules.tauMs, large: rules.run * rules.tauMs * rules.large };

/** a duration or delay as it applies: 0 under reduced motion */
export const ms = (value: number, reduced: boolean): number => (reduced ? 0 : Math.max(0, value));

/** the bits of an element the mover uses (an HTMLElement in the game; a stand-in in the node check) */
export type Animatable = {
	animate?: (keyframes: Keyframe[] | PropertyIndexedKeyframes, options: KeyframeAnimationOptions) => AnimationLike;
};
export type AnimationLike = { cancel: () => void; finish?: () => void; onfinish: ((e?: unknown) => void) | null; oncancel: ((e?: unknown) => void) | null };

export type MoveOptions = {
	/** the transform it starts from; it ends at the element's own transform (none in the keyframe) */
	from?: string;
	/** fade in from 0 as well */
	fade?: boolean;
	duration: number;
	delay?: number;
	ease: string;
};

export type Mover = {
	/** run one move; returns false when nothing animates (reduced motion, zero length, or no Web Animations) */
	move: (el: Animatable | null | undefined, opts: MoveOptions) => boolean;
	/** how many moves are running now */
	running: () => number;
	/** cancel every running move: each element lands at its rest state */
	stopAll: () => void;
};

/** one mover per menu instance */
export const createMover = (reduced: boolean): Mover => {
	const live = new Set<AnimationLike>();
	const move: Mover['move'] = (el, opts) => {
		if (!el || reduced || opts.duration <= 0 || (!opts.from && !opts.fade)) return false;
		try {
			const start: Keyframe = {};
			const end: Keyframe = {};
			// no transform keyframes unless the piece really slides: an animated 'none' would override the element's own transform
			if (opts.from) {
				start.transform = opts.from;
				end.transform = 'none';
			}
			if (opts.fade) {
				start.opacity = 0;
				end.opacity = 1;
			}
			const a = el.animate!([start, end], { duration: opts.duration, delay: Math.max(0, opts.delay ?? 0), easing: opts.ease, fill: 'backwards' });
			live.add(a);
			a.onfinish = a.oncancel = () => {
				live.delete(a);
			};
			return true;
		} catch {
			// no Web Animations (or it threw): the piece simply lands at its rest state
			return false;
		}
	};
	const stopAll = () => {
		for (const a of [...live]) {
			try {
				a.cancel();
			} catch {
				/* already gone */
			}
			live.delete(a);
		}
	};
	return { move, running: () => live.size, stopAll };
};
