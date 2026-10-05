import { linear } from 'svelte/easing';

// A numeric tween with the same surface the components use from svelte/motion's `Tween`
// (`current`, `target`, `set(value, { duration, easing, delay })`), minus two traps.
//
// 1. LEAK (phone perf pass, 2026-09-23): Svelte 5.20's `Tween.set()` captures the task it replaces
//    as `previous_task` inside the new task's closure and never lets go of it, so every call chains
//    one more task (closure + context + never-settling promise) behind the live one for as long as
//    the component lives. SpinWin sets its two tweens on every cascade: a heap-snapshot diff over
//    90 instant spins showed ~1,700 retained `abort` closures and ~8 KB a spin of unbounded growth.
// 2. HANGING AWAITS (house rule, Svelte traps 3): an aborted Tween task's promise never settles.
//    Here a superseded `set()` RESOLVES the moment it is superseded, so awaiting one is safe.
//
// One rAF per running tween, nothing retained once it lands.
type Options = { duration?: number; easing?: (t: number) => number; delay?: number };

// the reactive cell lives in a closure: this app's TS settings lower class fields into the
// constructor, where Svelte refuses a `$state` field
const cell = (v: number) => {
	let value = $state(v);
	return {
		get v() {
			return value;
		},
		set v(next: number) {
			value = next;
		},
	};
};

export class SteadyTween {
	#cell = cell(0);
	#target = 0;
	#defaults: Options;
	#raf = 0;
	#resolve: (() => void) | null = null;

	constructor(value: number, defaults: Options = {}) {
		this.#cell.v = value;
		this.#target = value;
		this.#defaults = defaults;
	}

	get current() {
		return this.#cell.v;
	}
	set current(v: number) {
		this.#cell.v = v;
	}

	get target() {
		return this.#target;
	}

	set(value: number, options: Options = {}): Promise<void> {
		const { duration = 400, easing = linear, delay = 0 } = { ...this.#defaults, ...options };
		this.#stop();
		this.#target = value;
		if (duration <= 0 && delay <= 0) {
			this.current = value;
			return Promise.resolve();
		}
		const from = this.current;
		const start = performance.now() + delay;
		return new Promise<void>((resolve) => {
			this.#resolve = resolve;
			const step = () => {
				const t = duration > 0 ? Math.min(1, Math.max(0, (performance.now() - start) / duration)) : 1;
				if (performance.now() >= start) this.current = from + (value - from) * easing(t);
				if (t < 1 || performance.now() < start) {
					this.#raf = requestAnimationFrame(step);
					return;
				}
				this.#raf = 0;
				this.#resolve = null;
				resolve();
			};
			this.#raf = requestAnimationFrame(step);
		});
	}

	/** cancel the running tween where it stands; a pending `set()` promise resolves */
	#stop() {
		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.#raf = 0;
		const r = this.#resolve;
		this.#resolve = null;
		r?.();
	}
}
