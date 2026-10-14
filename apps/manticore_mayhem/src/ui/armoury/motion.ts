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
// the handlers are typed loosely so a real DOM Animation (whose handlers take `this: Animation` and an event) fits
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = ((this: any, e: any) => any) | null;
export type AnimationLike = { cancel: () => void; finish?: () => void; onfinish: Handler; oncancel: Handler };

export type MoveOptions = {
	/** the transform it starts from; it ends at the element's own transform (none in the keyframe) */
	from?: string;
	/** fade in from 0 as well */
	fade?: boolean;
	/** with `fade`: the opacity it fades in from (default 0); a move that takes over from a cut one starts where that was */
	fadeFrom?: number;
	duration: number;
	delay?: number;
	ease: string;
};

export type Mover = {
	/** run one move; returns false when nothing animates (reduced motion, zero length, or no Web Animations) */
	move: (el: Animatable | null | undefined, opts: MoveOptions) => boolean;
	/** run any keyframes (the touch layouts' run time moves: the plate's and the tray's eased places, the swipe's carry,
	 *  entry and spring back); returns the animation, or null when nothing animates (reduced motion, zero length, or no
	 *  Web Animations: the element is then simply at its rest state) */
	play: (el: Animatable | null | undefined, keyframes: Keyframe[], opts: { duration: number; delay?: number; ease: string; fill?: FillMode }) => AnimationLike | null;
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
				start.opacity = Math.max(0, Math.min(1, opts.fadeFrom ?? 0));
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
	const play: Mover['play'] = (el, keyframes, opts) => {
		if (!el || reduced || opts.duration <= 0) return null;
		try {
			const a = el.animate!(keyframes, { duration: opts.duration, delay: Math.max(0, opts.delay ?? 0), easing: opts.ease, fill: opts.fill ?? 'none' });
			live.add(a);
			a.onfinish = a.oncancel = () => {
				live.delete(a);
			};
			return a;
		} catch {
			return null;
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
	return { move, play, running: () => live.size, stopAll };
};

// ---- THE TIMELINES (spec 5.2). Plain data: which piece moves, when, how far, how long, on which ease. The menu maps
// the piece names to its elements and hands each step to a mover; node checks the numbers as they are. ------------

export type TimelineRules = MotionRules & {
	staggerMs: number;
	firstTileMs: number;
	heroAtMs: number;
	plateAtMs: number;
	/** the plate's contents: heading and volatility, text, price and button */
	contentAtMs: readonly number[];
	contentFadeMs: number;
	trayFadeMs: number;
	headFadeMs: number;
	slide: number;
	slideTouch: number;
	heroSwapSlide: number;
	textSwapSlide: number;
	textSwapDelayMs: number;
	heroSwapRun: number;
};

export type Piece = 'tray' | 'header' | 'close' | 'tile' | 'hero' | 'plate' | 'head' | 'vol' | 'body' | 'buy';

export type Step = {
	piece: Piece;
	/** tiles: the tile's place in reading order */
	index?: number;
	delay: number;
	duration: number;
	/** px it rises from (positive: starts lower; negative: starts higher); 0: a fade only */
	fromY: number;
	/** 'move': the exponential ease; 'linear': a plain fade */
	ease: 'move' | 'linear';
};

/**
 * THE OPEN (spec 5.2): the tray slab, the name and the close fade; tile i starts at firstTile + i * stagger and rises
 * `slide` px as it fades in (desktop: even tiles from below, odd from above; touch layouts: all from below, slideTouch);
 * the hero rises on the large ease from heroAt; the plate is ONE piece at its final size that rises and fades from
 * plateAt; its contents only fade, a beat apart. Under reduced motion: nothing (every piece is simply at rest).
 */
export const entrancePlan = (r: TimelineRules, o: { tiles: number; touch: boolean; reduced: boolean }): Step[] => {
	if (o.reduced) return [];
	const small = r.run * r.tauMs;
	const large = small * r.large;
	const D = o.touch ? r.slideTouch : r.slide;
	const fade = Math.min(r.contentFadeMs, small * 0.4);
	const steps: Step[] = [
		{ piece: 'tray', delay: 0, duration: r.trayFadeMs, fromY: 0, ease: 'linear' },
		{ piece: 'header', delay: 0, duration: r.headFadeMs, fromY: 0, ease: 'linear' },
		{ piece: 'close', delay: 0, duration: r.headFadeMs, fromY: 0, ease: 'linear' },
	];
	for (let i = 0; i < o.tiles; i++) steps.push({ piece: 'tile', index: i, delay: r.firstTileMs + r.staggerMs * i, duration: small, fromY: !o.touch && i % 2 ? -D : D, ease: 'move' });
	steps.push({ piece: 'hero', delay: r.heroAtMs, duration: large, fromY: D, ease: 'move' });
	steps.push({ piece: 'plate', delay: r.plateAtMs, duration: small, fromY: D, ease: 'move' });
	const [a, b, c] = r.contentAtMs;
	steps.push({ piece: 'head', delay: a, duration: fade, fromY: 0, ease: 'linear' });
	steps.push({ piece: 'vol', delay: a, duration: fade, fromY: 0, ease: 'linear' });
	steps.push({ piece: 'body', delay: b, duration: fade, fromY: 0, ease: 'linear' });
	steps.push({ piece: 'buy', delay: c, duration: fade, fromY: 0, ease: 'linear' });
	return steps;
};

/** when the open is settled: the latest end of any step (0 under reduced motion) */
export const entranceEnd = (steps: Step[]): number => steps.reduce((m, s) => Math.max(m, s.delay + s.duration), 0);

/**
 * A CHANGE OF MODE BY TAP, the way in (spec 5.2): after the old hero and text have faded out, the new hero rises
 * slide * heroSwapSlide px over heroSwapRun small moves, the new text slide * textSwapSlide px, textSwapDelay later.
 */
export const swapPlan = (r: TimelineRules, o: { touch: boolean; reduced: boolean }): { hero: Step; text: Step } | null => {
	if (o.reduced) return null;
	const small = r.run * r.tauMs;
	const D = o.touch ? r.slideTouch : r.slide;
	return {
		hero: { piece: 'hero', delay: 0, duration: small * r.heroSwapRun, fromY: Math.round(D * r.heroSwapSlide), ease: 'move' },
		text: { piece: 'plate', delay: r.textSwapDelayMs, duration: small, fromY: Math.round(D * r.textSwapSlide), ease: 'move' },
	};
};
