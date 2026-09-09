<script lang="ts">
	// Sky + clouds behind the cafeteria windows (game/ambientSpec.ts SKY / CLOUDS). The room art has
	// its panes cut to alpha, so this whole layer sits UNDER the room sprites and shows only through
	// the glass: no masks, no geometry, the art's own alpha does the clipping. Raw Pixi driven from
	// the app ticker like AmbientFan — no per-frame Svelte props, no filters, no new textures.
	// Tree (authored in backdrop px, the parent maps that space onto the cover-fitted room):
	//   root
	//   ├ scene[base|super|feast]  alpha = that scene's crossfade (same Tweens as the rooms)
	//   │  ├ sky sprite at its painted offset
	//   │  ├ clouds (super / feast only): N sprites drifting (CLOUDS.direction), wrapping with fresh rolls
	//   │  └ birds (base only): flocks spawned on a timer, dropped once they leave the wall
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SKY, CLOUDS, BIRDS, BACKDROP } from '../game/ambientSpec';

	type Mode = keyof typeof SKY;
	type Props = {
		/** canvas position of the backdrop's top-left corner */
		x: number;
		y: number;
		/** backdrop px → canvas px */
		scale: number;
		/** crossfade alpha per scene, in SKY key order (base, super, feast) */
		alphas: number[];
		zIndex?: number;
	};
	const { x, y, scale, alphas, zIndex = 0 }: Props = $props();
	const context = getContext();

	const MODES = Object.keys(SKY) as Mode[];
	const root = new PIXI.Container();
	getContextParent().addToParent(root); // unmount cleanup destroys the subtree
	const scenes = MODES.map(() => {
		const c = new PIXI.Container();
		root.addChild(c);
		return c;
	});
	const skyDone = MODES.map(() => false);
	const cloudsDone = MODES.map(() => false);
	type Cloud = { s: PIXI.Sprite; v: number };
	const clouds: Record<string, Cloud[]> = { super: [], feast: [] };

	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	const jit = () => 1 + (Math.random() * 2 - 1) * CLOUDS.jitter;
	// (re)roll one cloud: depth drives size, speed and opacity together; y anywhere in the band
	const roll = (c: Cloud, atStart: boolean) => {
		const t = Math.random();
		c.s.scale.set(lerp(CLOUDS.scale.far, CLOUDS.scale.near, t) * jit());
		c.s.alpha = lerp(CLOUDS.alpha.far, CLOUDS.alpha.near, t);
		c.v = lerp(CLOUDS.speed.far, CLOUDS.speed.near, t) * jit();
		c.s.y = lerp(CLOUDS.band.y0, CLOUDS.band.y1, Math.random());
		const half = c.s.width / 2;
		// fresh clouds enter from the upwind edge; the first fill spreads them across the whole run
		c.s.x = atStart
			? CLOUDS.direction > 0 ? -half - Math.random() * 300 : BACKDROP.w + half + Math.random() * 300
			: -half + Math.random() * CLOUDS.spread - 300;
		c.s.zIndex = t; // nearer clouds draw over farther ones
	};
	// textures arrive on the deferred phase: build each scene's layer the first time it is both
	// visible and loaded, never earlier (a bonus scene can start fading in before its atlas landed;
	// the next tick picks it up)
	// The sky and the cloud atlas are separate deferred assets and can land seconds apart, so each
	// has its own done flag and the tick keeps trying the other until it is there.
	const build = (mode: Mode, i: number) => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		if (!assets) return;
		const sky = assets[SKY[mode].key];
		if (sky && !skyDone[i]) {
			const sp = new PIXI.Sprite(sky);
			sp.position.set(SKY[mode].x, SKY[mode].y);
			scenes[i].addChildAt(sp, 0);
			skyDone[i] = true;
		}
		if (mode === 'base' || cloudsDone[i]) return;
		const frames: PIXI.Texture[] = [];
		for (let k = 0; ; k++) {
			const t = assets[`cloud_${mode}_${k}.png`];
			if (!t) break;
			frames.push(t);
		}
		if (!frames.length) return;
		cloudsDone[i] = true;
		const layer = new PIXI.Container();
		layer.sortableChildren = true;
		scenes[i].addChild(layer);
		for (let n = 0; n < CLOUDS.count; n++) {
			const s = new PIXI.Sprite(frames[n % frames.length]);
			s.anchor.set(0.5);
			const c = { s, v: 0 };
			roll(c, false);
			layer.addChild(s);
			clouds[mode].push(c);
		}
	};

	// ---- birds (base scene) ----
	type Bird = { s: PIXI.Sprite; dir: number; row: number; frames: PIXI.Texture[]; v: number; y0: number; ph: number; size: number };
	let birds: Bird[] = [];
	let birdLayer: PIXI.Container | null = null;
	let birdFrames: PIXI.Texture[][] = [];
	let nextFlock = 2; // s until the first flock
	let clock = 0;
	const loadBirdFrames = () => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		if (!assets || birdFrames.length) return birdFrames.length > 0;
		const rows: PIXI.Texture[][] = [];
		for (let r = 0; r < BIRDS.rows; r++) {
			const row: PIXI.Texture[] = [];
			for (let k = 0; k < BIRDS.framesPerRow; k++) {
				const t = assets[`bird_${r}_${k}.png`];
				if (t) row.push(t);
			}
			if (row.length) rows.push(row);
		}
		birdFrames = rows;
		return rows.length > 0;
	};
	const spawnFlock = () => {
		if (!birdLayer || !loadBirdFrames()) return;
		const dir = Math.random() < 0.5 ? 1 : -1;
		const t = Math.random(); // depth of the whole flock
		const size = lerp(BIRDS.size.far, BIRDS.size.near, t);
		const bigRows = Math.max(1, birdFrames.length - 1);
		const row = t < BIRDS.farBelow && birdFrames.length > 1 ? birdFrames.length - 1 : Math.floor(Math.random() * bigRows);
		const v = BIRDS.speed * lerp(0.6, 1.1, t) * jit();
		const y0 = lerp(BIRDS.band.y0, BIRDS.band.y1, Math.random());
		const x0 = dir > 0 ? -60 : BACKDROP.w + 60;
		const n = Math.round(lerp(BIRDS.flock.min, BIRDS.flock.max, Math.random()));
		for (let i = 0; i < n; i++) {
			const frames = birdFrames[row];
			const s = new PIXI.Sprite(frames[0]);
			s.anchor.set(0.5);
			const bsize = size * lerp(0.85, 1.15, Math.random());
			s.x = x0 - dir * i * size * 1.6;
			s.alpha = lerp(0.75, 1, t);
			birdLayer.addChild(s);
			birds.push({ s, dir, row, frames, v, y0: y0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * size * 0.7, ph: Math.random() * 100, size: bsize });
		}
	};
	const tickBirds = (dt: number) => {
		if (!birdLayer) {
			birdLayer = new PIXI.Container();
			scenes[0].addChild(birdLayer);
		}
		clock += dt;
		nextFlock -= dt;
		if (nextFlock <= 0) {
			spawnFlock();
			nextFlock = (BIRDS.everyMs / 1000) * lerp(0.7, 1.3, Math.random());
		}
		for (let i = birds.length - 1; i >= 0; i--) {
			const b = birds[i];
			b.s.x += b.dir * b.v * dt;
			if (b.dir > 0 ? b.s.x > BACKDROP.w + 80 : b.s.x < -80) {
				birdLayer.removeChild(b.s);
				b.s.destroy();
				birds.splice(i, 1);
				continue;
			}
			b.s.y = b.y0 + Math.sin(clock * 2.2 + b.ph) * BIRDS.bob;
			const k = Math.floor(clock * BIRDS.flapFps + b.ph) % b.frames.length;
			const tex = b.frames[k];
			if (b.s.texture !== tex) b.s.texture = tex; // a swap between resident frames, never a new texture
			const sc = b.size / tex.height;
			b.s.scale.set(b.dir > 0 ? sc : -sc, sc);
		}
	};

	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		const tick = () => {
			if (!root.visible) return;
			const dt = Math.min(0.05, (ticker?.deltaMS ?? 16) / 1000);
			MODES.forEach((mode, i) => {
				if (scenes[i].alpha <= 0) return;
				if (!skyDone[i] || (mode !== 'base' && !cloudsDone[i])) build(mode, i);
				if (mode === 'base') tickBirds(dt);
				const list = clouds[mode];
				if (!list) return;
				for (const c of list) {
					c.s.x += CLOUDS.direction * c.v * dt;
					const half = c.s.width / 2;
					if ((CLOUDS.direction > 0 && c.s.x - half > BACKDROP.w) || (CLOUDS.direction < 0 && c.s.x + half < 0)) roll(c, true);
				}
			});
		};
		ticker?.add(tick);
		return () => ticker?.remove(tick);
	});

	$effect(() => {
		root.position.set(x, y);
		root.scale.set(scale);
		root.zIndex = zIndex;
		MODES.forEach((_, i) => {
			scenes[i].alpha = alphas[i] ?? 0;
			scenes[i].visible = (alphas[i] ?? 0) > 0;
		});
	});
</script>
