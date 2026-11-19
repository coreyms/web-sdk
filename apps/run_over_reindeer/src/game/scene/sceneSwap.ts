// THE SCENE SWAP (2026-11-17): the scene follows the round's mode, the day snow in the base game, the Free Spins night,
// the Super night (game/scenePresets.ts presetForMode; components/Board.svelte sets stateScene.want from the mode).
//
//   LOAD     a night scene's pieces are never in the first load before the first press (game/assets.ts SCENE_LAZY_URLS):
//            they start loading when a round's book holds a trigger (game/bookEventHandlerMap.ts reveal, through
//            sceneHooks.prefetch), or when the mode turns to a bonus without that (a resumed round), decoded on the CPU
//            side only. Only the pieces the layout draws are loaded (no forest off an upright phone, no ends on one); a
//            rotation during the bonus loads the rest then.
//   GATE     the swap in waits behind the entry scene on the LED back board: it starts once the back board is seated over
//            the dimmed scene (the env's gate), so the change happens under the board and the dim. The swap back starts
//            as soon as the mode is the base game again (after the Total Win is dismissed, while the board lowers).
//   UPLOAD   the incoming pieces go to the GPU (the renderer's prepare queue) just before the fade's first frame, never on
//            it
//   FADE     (2026-11-19, Corey: "There are these weird lines and shading that happen while switching back and fourth from
//            Light and Dark Mode") ONE picture of the outgoing screen fades out over the incoming scene as a unit
//            (game/scene/sceneSnapshot.ts): on the fade's first frame the road and the board's snow cover as shown are drawn
//            into one render texture, the incoming scene goes in at once, whole, and the picture fades out over it over
//            SCENE.swap.fadeMs, smoothed. Every pixel is the plain mix of the two screens at the same point of the fade (the
//            old layer-by-layer fade put each soft edged piece at its own point of it: the lighter or darker rectangles at
//            the pieces' straight edges, and the outgoing hills left whole until a late tail). The DOM side (the top line,
//            the HUD tokens) swaps at the fade's start with a CSS transition of fadeMs
//   RELEASE  the outgoing skin is hidden at the fade's first frame and let go two frames later (the picture holds what it
//            showed), then every scene texture no scene on screen (or wanted next) uses and that is not the base scene of
//            the set in use is unloaded (SCENE.swap.unload): the GPU holds the set's base scene alone again after a bonus;
//            the picture is destroyed two frames after the fade's end
//   SETS     (dark mode, 2026-11-17) two sets of three scenes, snow and grass (game/scenePresets.ts SCENE_SETS); the player's
//            Scene setting picks one (game/sceneChoice.ts). Only the set in use is loaded: the first load holds its base scene
//            (game/assets.ts), and a change of set (components/Board.svelte, only with the base scene settled on screen) is a
//            swap from one base scene to the other, after which the old base scene is unloaded too, the first load's pieces
//            included (they are released by their URL and dropped from the loaded list, so they load again if asked for)
// Nothing here waits on a round or can hold one: a swap whose pieces are late simply starts later.
import * as PIXI from 'pixi.js';

import { SCENE } from '../constants';
import { SCENE_LAZY_URLS } from '../assets';
import { SCENE_PRESETS, homePreset, presetKeys, setOfPreset, type ScenePresetName } from '../scenePresets';
import { setScenePreset, stateScene } from '../stateScene.svelte';
import { keysFor, type SceneLayers, type SceneView } from './sceneLayers';
import { SceneSnapshot } from './sceneSnapshot';

/** smooth 0..1 */
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const nextFrames = (fn: () => void) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => requestAnimationFrame(fn)) : fn());

export type SwapEnv = {
	/** the manifest's textures (the day snow, the road picture, the portal strips) */
	loaded: Record<string, PIXI.Texture | undefined>;
	layers: SceneLayers;
	/** the screen as the last layout saw it (which pieces it draws) */
	view: () => Pick<SceneView, 'kind' | 'uprightPhone'> | null;
	/** to the GPU now (the renderer's prepare queue); null where there is no renderer */
	upload: ((t: PIXI.Texture) => Promise<unknown> | void) | null;
	/** true when a swap to `to` may start now (the LED back board's entry scene is seated, or none is rising) */
	gate: (to: ScenePresetName) => boolean;
	/** the scene pieces on screen changed (a swap went in): the LED scoreboard re-cuts its snow cover */
	onPieces: () => void;
	/** THE PICTURE of the screen as it is now (the road and the snow cover), laid over it at alpha 1; null where there is no
	 *  renderer (the swap is then a cut) */
	snapshot: () => SceneSnapshot | null;
};

export class SceneSwap {
	/** the lazy textures in (by asset key) */
	private readonly lazy: Record<string, PIXI.Texture> = {};
	private readonly loading = new Map<string, Promise<PIXI.Texture | null>>();
	/** the preset fully on screen (the outgoing one during a fade): the base scene of the set the game boots with */
	shown: ScenePresetName = homePreset(stateScene.set);
	private fade: { from: ScenePresetName; to: ScenePresetName; t: number; ms: number; snap: SceneSnapshot | null; view: string } | null = null;
	/** the screen as the last layout saw it (a fade whose picture no longer lines up with it ends at once) */
	private viewKey = '';
	/** the largest picture a fade held (MB), for the probe */
	private snapPeakMB = 0;
	/** a swap whose pieces are going to the GPU */
	private starting: ScenePresetName | null = null;
	private nextTry = 0;
	/** what happened when, for the probe (performance.now() ms) */
	readonly log: { at: number; what: string; detail?: string }[] = [];

	constructor(private readonly env: SwapEnv) {
		env.layers.setPreset(SCENE_PRESETS[this.shown], this.tex);
		setScenePreset(this.shown);
	}

	/** a scene piece by asset key: the manifest's, or a lazy one that is in */
	readonly tex = (key: string): PIXI.Texture | null => this.env.loaded[key] ?? this.lazy[key] ?? null;

	private mark(what: string, detail?: string) {
		this.log.push({ at: Math.round(now()), what, detail });
		if (this.log.length > 120) this.log.splice(0, this.log.length - 120);
	}

	/** load one lazy piece (decoded, not uploaded); null when it is not a lazy piece or it failed */
	private load(key: string): Promise<PIXI.Texture | null> {
		const have = this.tex(key);
		if (have) return Promise.resolve(have);
		const url = SCENE_LAZY_URLS[key];
		if (!url) return Promise.resolve(null);
		let p = this.loading.get(key);
		if (!p) {
			p = PIXI.Assets.load<PIXI.Texture>(url)
				.then((t) => {
					this.lazy[key] = t;
					return t;
				})
				.catch(() => null)
				.finally(() => this.loading.delete(key));
			this.loading.set(key, p);
		}
		return p;
	}

	/** start loading a preset's pieces for the screen as it is (the book's trigger, the panel); resolves when they are in */
	prefetch(name: ScenePresetName): Promise<boolean> {
		const keys = keysFor(SCENE_PRESETS[name], this.env.view()).filter((k) => !this.tex(k));
		if (!keys.length) return Promise.resolve(true);
		if (!keys.some((k) => this.loading.has(k))) this.mark('load', `${name}: ${keys.length} pieces`);
		const t0 = now();
		return Promise.all(keys.map((k) => this.load(k))).then((ts) => {
			const ok = ts.every(Boolean);
			if (ok && keys.every((k) => this.tex(k))) this.mark('loaded', `${name} in ${Math.round(now() - t0)} ms`);
			return ok;
		});
	}

	/** a lazy piece the layout needs now (a rotation during a bonus, the day forest on a narrowed desktop browser); `key`
	 *  names the screen as laid out (its size and the road's place on it): a fade's picture taken on another one is let go
	 *  at once (it would no longer line up) */
	layoutChanged(key = '') {
		if (key) {
			this.viewKey = key;
			if (this.fade && this.fade.view !== key) this.finish();
		}
		const view = this.env.view();
		const need = new Set<string>();
		for (const P of this.env.layers.presets()) for (const k of keysFor(P, view)) need.add(k);
		const missing = [...need].filter((k) => !this.tex(k) && SCENE_LAZY_URLS[k]);
		if (!missing.length) return;
		void Promise.all(missing.map((k) => this.load(k))).then(() => {
			this.env.layers.refresh();
			this.env.onPieces();
		});
	}

	/** the scene on screen is the one wanted, whole: no fade, nothing going up (a change of set may start only then) */
	settled(): boolean {
		return !this.fade && !this.starting && stateScene.want === this.shown;
	}

	/** DEV / probe: a fade that has started stays where it is until step() moves it (the probe's frame by frame look) */
	hold = false;
	/** DEV / probe: move a fade by `ms` */
	step(ms: number) {
		if (this.fade) this.advance(ms);
	}
	private advance(ms: number) {
		const f = this.fade!;
		f.t += ms;
		f.snap?.alpha(1 - (f.ms > 0 ? smooth(f.t / f.ms) : 1));
		if (f.t >= f.ms) this.finish();
	}

	/** one frame (real ms) */
	update(deltaMs: number) {
		if (this.fade) {
			if (!this.hold) this.advance(deltaMs);
			return;
		}
		if (this.starting) return;
		const want = stateScene.want;
		if (want === this.shown) return;
		const keys = keysFor(SCENE_PRESETS[want], this.env.view());
		if (!keys.every((k) => this.tex(k))) {
			// (once a second at most: a piece that failed is asked again, never every frame)
			if (!keys.some((k) => this.loading.has(k)) && now() >= this.nextTry) {
				this.nextTry = now() + 1000;
				void this.prefetch(want);
			}
			return;
		}
		if (!this.env.gate(want)) return;
		void this.start(want, keys);
	}

	private async start(name: ScenePresetName, keys: string[]) {
		this.starting = name;
		const t0 = now();
		const up = this.env.upload;
		if (up) await Promise.all(keys.map((k) => up(this.tex(k)!))).catch(() => {});
		this.starting = null;
		// the mode changed again while the pieces went up: the next update decides afresh
		if (stateScene.want !== name || this.fade) return;
		this.mark('upload', `${name} in ${Math.round(now() - t0)} ms`);
		const from = this.shown;
		const fadeMs = Math.max(0, SCENE.swap.fadeMs);
		// THE PICTURE of the screen as it is (the outgoing scene), then the incoming scene in at once under it, whole
		const snap = fadeMs > 0 ? this.env.snapshot() : null;
		this.env.layers.setPreset(SCENE_PRESETS[name], this.tex);
		this.shown = name;
		this.env.onPieces();
		if (snap) this.snapPeakMB = Math.max(this.snapPeakMB, Math.round(snap.mb() * 100) / 100);
		this.fade = { from, to: name, t: 0, ms: fadeMs, snap, view: this.viewKey };
		// the DOM side (the top line, the HUD tokens: CSS transitions of the same length) swaps with the fade's start
		setScenePreset(name, snap ? fadeMs : 0);
		this.mark('fade', `${from} to ${name} over ${snap ? fadeMs : 0} ms${snap ? `, picture ${Math.round(snap.mb() * 10) / 10} MB` : ''}`);
		// the outgoing scene's textures go now (the picture holds what they showed; its skin is destroyed two frames on)
		// a change of set always lets the old set go (only the set in use is loaded), whatever SCENE.swap.unload says
		if (SCENE.swap.unload || setOfPreset(from) !== setOfPreset(name)) this.release();
		if (!snap) this.finish();
	}

	private finish() {
		const f = this.fade;
		if (!f) return;
		this.fade = null;
		f.snap?.end();
		this.mark('end', `${f.from} to ${f.to}`);
	}

	/** every scene texture no scene on screen (or wanted next) uses goes, two frames after it was last drawn, except the base
	 *  scene of the set in use (kept through its bonus rounds: it comes straight back after them). A lazy one is dropped from
	 *  the lazy list; one of the first load (the boot set's base scene, after a change of set) from the loaded list. */
	private release() {
		const keep = new Set<string>([...presetKeys(SCENE_PRESETS[this.shown]), ...presetKeys(SCENE_PRESETS[stateScene.want]), ...presetKeys(SCENE_PRESETS[homePreset(stateScene.set)])]);
		const gone: string[] = [];
		const drop = (key: string) => {
			const url = SCENE_LAZY_URLS[key];
			gone.push(key);
			nextFrames(() => void PIXI.Assets.unload(url).catch(() => {}));
		};
		for (const key of Object.keys(this.lazy)) {
			if (keep.has(key)) continue;
			delete this.lazy[key];
			drop(key);
		}
		for (const key of Object.keys(this.env.loaded)) {
			if (keep.has(key) || !SCENE_LAZY_URLS[key] || !this.env.loaded[key]) continue;
			delete this.env.loaded[key];
			drop(key);
		}
		if (gone.length) this.mark('unload', gone.join(' '));
	}

	/** DEV / probe: the swap's state and the scene textures it holds (loaded, on the GPU, MB) */
	snapshot(gpuHas: (s: PIXI.TextureSource) => boolean) {
		const mb = (t: PIXI.Texture) => (t.source.pixelWidth * t.source.pixelHeight * 4) / 1048576;
		const pieces: Record<string, { mb: number; gpu: boolean; lazy: boolean; preset: ScenePresetName }> = {};
		for (const name of Object.keys(SCENE_PRESETS) as ScenePresetName[])
			for (const k of presetKeys(SCENE_PRESETS[name])) {
				const t = this.tex(k);
				if (t) pieces[k] = { mb: Math.round(mb(t) * 100) / 100, gpu: gpuHas(t.source), lazy: !!this.lazy[k], preset: name };
			}
		const sum = (f: (p: { mb: number; gpu: boolean; lazy: boolean }) => boolean) => Math.round(Object.values(pieces).filter(f).reduce((a, p) => a + p.mb, 0) * 100) / 100;
		return {
			shown: this.shown,
			want: stateScene.want,
			dom: stateScene.preset.name,
			set: stateScene.set,
			choice: stateScene.choice,
			dark: stateScene.dark,
			fade: this.fade ? { from: this.fade.from, to: this.fade.to, t: Math.round(this.fade.t), ms: this.fade.ms, tail: 0, alpha: Math.round((this.fade.ms > 0 ? smooth(this.fade.t / this.fade.ms) : 1) * 1000) / 1000, snapMB: this.fade.snap ? Math.round(this.fade.snap.mb() * 100) / 100 : 0 } : null,
			snapPeakMB: this.snapPeakMB,
			snapLive: SceneSnapshot.live,
			hold: this.hold,
			starting: this.starting,
			loading: [...this.loading.keys()],
			skins: this.env.layers.presets().map((p) => p.name),
			pieces,
			sceneGpuMB: sum((p) => p.gpu),
			lazyGpuMB: sum((p) => p.gpu && p.lazy),
			log: this.log.slice(-40),
		};
	}
}
