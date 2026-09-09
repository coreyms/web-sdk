<script lang="ts">
	// The cafeteria housefly (game/ambientSpec.ts FLY), base scene only. One sprite on the app
	// ticker: roam → toWall → hover → exit → away → enter → roam. Above the room while it is in the
	// air (zFront); while it is inside the window rect it moves BEHIND the room (zBehind, between
	// the sky and the room sprite) so the bars and wall occlude it and only the glass shows it.
	// Authored in backdrop px; the parent maps that space onto the cover-fitted room.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { FLY, BACKDROP } from '../game/ambientSpec';

	type Props = { x: number; y: number; scale: number; alpha?: number; visible?: boolean; zFront: number; zBehind: number };
	const { x, y, scale, alpha = 1, visible = true, zFront, zBehind }: Props = $props();
	const context = getContext();

	const root = new PIXI.Container();
	getContextParent().addToParent(root);
	const sprite = new PIXI.Sprite();
	sprite.anchor.set(FLY.anchor.x / FLY.cell.w, FLY.anchor.y / FLY.cell.h);
	root.addChild(sprite);

	type State = 'roam' | 'toWall' | 'hover' | 'exit' | 'away' | 'enter';
	const rnd = (a: number, b: number) => a + Math.random() * (b - a);
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	const F = { x: 900, y: 500, tx: 900, ty: 500, state: 'roam' as State, t: 0, face: 1, alpha: 1, behind: false, wing: 0, clock: 0, retarget: 0, hoverAt: 0 };
	let frames: PIXI.Texture[] = [];

	const restart = () => {
		Object.assign(F, { x: rnd(300, 1500), y: rnd(300, 700), state: 'roam', t: rnd(FLY.roam[0], FLY.roam[1]), alpha: 1, behind: false, retarget: 0, face: 1 });
		F.tx = F.x;
		F.ty = F.y;
	};
	const inWindow = () => F.x >= FLY.window.left && F.y >= FLY.window.top && F.y <= FLY.window.bottom;
	const seekTo = (tx: number, ty: number, dt: number, speed: number) => {
		const dx = tx - F.x;
		const dy = ty - F.y;
		const dist = Math.hypot(dx, dy);
		if (dist < 1) return true;
		const step = Math.min(dist, speed * dt);
		F.x += (dx / dist) * step;
		F.y += (dy / dist) * step;
		if (Math.abs(dx) > 8) F.face = dx > 0 ? 1 : -1;
		return dist - step < 2;
	};
	const step = (dt: number) => {
		F.clock += dt;
		F.wing += dt * FLY.wingFps;
		F.t -= dt;
		if (F.state === 'roam') {
			F.retarget -= dt;
			if (F.retarget <= 0) {
				F.retarget = rnd(0.5, 1) * FLY.retarget;
				if (Math.random() < FLY.hoverChance) {
					F.tx = F.x;
					F.ty = F.y;
				} else {
					F.tx = rnd(FLY.air.x0, FLY.air.x1);
					F.ty = rnd(FLY.air.y0, FLY.air.y1);
				}
			}
			seekTo(F.tx, F.ty, dt, FLY.speed * 0.8);
			if (F.t <= 0) F.state = 'toWall';
		} else if (F.state === 'toWall') {
			if (seekTo(FLY.graffiti.x, FLY.graffiti.y, dt, FLY.speed)) {
				F.state = 'hover';
				F.t = rnd(FLY.hover.len[0], FLY.hover.len[1]);
				F.hoverAt = F.clock;
			}
		} else if (F.state === 'hover') {
			const u = ((F.clock - F.hoverAt) / FLY.hover.loop) * Math.PI * 2;
			const hx = FLY.graffiti.x + (Math.sin(u) * FLY.hover.width) / 2;
			const hy = FLY.graffiti.y + Math.sin(2 * u) * FLY.hover.width * 0.2;
			if (Math.abs(hx - F.x) > 6) F.face = hx > F.x ? 1 : -1;
			F.x += (hx - F.x) * Math.min(1, dt * 10);
			F.y += (hy - F.y) * Math.min(1, dt * 10);
			if (F.t <= 0) F.state = 'exit';
		} else if (F.state === 'exit') {
			const arrived = seekTo(FLY.window.x, FLY.window.y, dt, FLY.speed * 0.9);
			F.behind = inWindow();
			if (F.behind) F.alpha = Math.max(0, F.alpha - dt * FLY.fadePerSec);
			if (arrived || F.alpha <= 0) {
				F.state = 'away';
				F.t = FLY.away * rnd(1 - FLY.awayJitter, 1 + FLY.awayJitter);
				F.alpha = 0;
			}
		} else if (F.state === 'away') {
			if (F.t <= 0) {
				F.state = 'enter';
				F.x = FLY.window.x;
				F.y = FLY.window.y;
				F.behind = true;
				F.tx = rnd(1200, 1700);
				F.ty = rnd(350, 600);
			}
		} else if (F.state === 'enter') {
			F.alpha = Math.min(1, F.alpha + dt * FLY.fadePerSec);
			F.behind = inWindow();
			if (seekTo(F.tx, F.ty, dt, FLY.speed * 0.9)) {
				F.state = 'roam';
				F.t = rnd(FLY.roam[0], FLY.roam[1]);
				F.retarget = 0;
			}
		}
	};
	const place = () => {
		const jx = Math.sin(F.clock * 37) * FLY.jitter;
		const jy = Math.cos(F.clock * 29) * FLY.jitter;
		const s = (FLY.height / FLY.cell.h) * lerp(1 - FLY.depthScale, 1 + FLY.depthScale, F.y / BACKDROP.h);
		sprite.position.set(F.x + jx, F.y + jy);
		sprite.scale.set(F.face * s, s);
		sprite.alpha = F.alpha;
		sprite.visible = F.alpha > 0;
		const tex = frames[Math.floor(F.wing) % frames.length];
		if (sprite.texture !== tex) sprite.texture = tex; // swap between resident frames only
		const z = F.behind ? zBehind : zFront;
		if (root.zIndex !== z) root.zIndex = z;
	};

	onMount(() => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		frames = [];
		for (let k = 0; k < FLY.frames; k++) {
			const t = assets?.[`fly_${k}.png`];
			if (t) frames.push(t);
		}
		if (!frames.length) return;
		sprite.texture = frames[0];
		restart();
		const ticker = context.stateApp.pixiApplication?.ticker;
		const tick = () => {
			if (!root.visible || root.alpha <= 0) return;
			const dt = Math.min(0.05, (ticker?.deltaMS ?? 16) / 1000);
			step(dt);
			place();
		};
		ticker?.add(tick);
		// QA hooks (house rules: extend __angryMantis, never a new global)
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			const am = ((window as any).__angryMantis ??= {});
			(am.ambient ??= {}).fly = { state: () => F.state, skip: () => (F.t = 0), pos: () => ({ x: F.x, y: F.y, behind: F.behind, alpha: F.alpha }) };
		}
		return () => ticker?.remove(tick);
	});

	$effect(() => {
		root.position.set(x, y);
		root.scale.set(scale);
		root.alpha = alpha;
		root.visible = visible;
	});
</script>
