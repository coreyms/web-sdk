<script lang="ts">
	// Cockroaches scurrying on the cafeteria floor (game/ambientSpec.ts ROACH), base scene only.
	// Raw Pixi on the app ticker like AmbientFan: per roach one sprite whose texture swaps between
	// the eight resident walk frames, one Graphics contact shadow, and a run / stop state machine.
	// Authored in backdrop px; the parent maps that space onto the cover-fitted room. Sits between
	// the room and the dark wash (Background.svelte) so the wash dims the bugs with the floor; the
	// board frame and the characters draw over them in their own containers.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { ROACH, BACKDROP } from '../game/ambientSpec';

	type Props = { x: number; y: number; scale: number; alpha?: number; visible?: boolean; zIndex?: number };
	const { x, y, scale, alpha = 1, visible = true, zIndex = 0 }: Props = $props();
	const context = getContext();

	const root = new PIXI.Container();
	root.sortableChildren = true;
	getContextParent().addToParent(root);

	type Roach = { s: PIXI.Sprite; sh: PIXI.Graphics; x: number; y: number; h: number; state: 'run' | 'dash' | 'stop'; t: number; leg: number; v: number };
	const roaches: Roach[] = [];
	let frames: PIXI.Texture[] = [];
	const rnd = (a: number, b: number) => a + Math.random() * (b - a);
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	const depth = (yy: number) => (yy - ROACH.floor.y0) / Math.max(1, ROACH.floor.y1 - ROACH.floor.y0);

	const spawn = (): Roach => {
		const s = new PIXI.Sprite(frames[0]);
		s.anchor.set(ROACH.anchor.x / ROACH.cell.w, ROACH.anchor.y / ROACH.cell.h);
		const sh = new PIXI.Graphics().ellipse(0, 0, ROACH.cell.w * ROACH.shadow.rx, ROACH.cell.h * ROACH.shadow.ry).fill({ color: 0x000000, alpha: ROACH.shadow.alpha });
		root.addChild(sh);
		root.addChild(s);
		return { s, sh, x: rnd(100, BACKDROP.w - 100), y: rnd(ROACH.floor.y0, ROACH.floor.y1), h: rnd(0, Math.PI * 2), state: 'stop', t: rnd(0.2, 1), leg: 0, v: 0 };
	};
	const newBurst = (r: Roach) => {
		if (Math.random() < ROACH.reverse) r.h += Math.PI;
		r.h += rnd(-1, 1) * ((ROACH.turnDeg * Math.PI) / 180);
		const dash = Math.random() < ROACH.dash.chance;
		r.t = dash ? rnd(ROACH.dash.len[0], ROACH.dash.len[1]) : rnd(ROACH.run[0], ROACH.run[1]);
		r.state = dash ? 'dash' : 'run';
		r.v = ROACH.speed * rnd(0.8, 1.2) * (dash ? 1.15 : 1);
	};
	const step = (r: Roach, dt: number) => {
		r.t -= dt;
		if (r.state === 'stop') {
			if (r.t <= 0) newBurst(r);
			return;
		}
		const d = lerp(ROACH.backScale, 1, depth(r.y));
		r.x += Math.cos(r.h) * r.v * d * dt;
		r.y += Math.sin(r.h) * ROACH.slope * r.v * d * dt;
		if (r.y < ROACH.floor.y0) { r.y = ROACH.floor.y0; r.h = -r.h; }
		if (r.y > ROACH.floor.y1) { r.y = ROACH.floor.y1; r.h = -r.h; }
		if (r.x < ROACH.margin) { r.x = ROACH.margin; r.h = Math.PI - r.h; }
		if (r.x > BACKDROP.w - ROACH.margin) { r.x = BACKDROP.w - ROACH.margin; r.h = Math.PI - r.h; }
		r.leg += dt * ROACH.legFps * (r.v / ROACH.speed);
		if (r.t <= 0) { r.state = 'stop'; r.t = rnd(ROACH.pause[0], ROACH.pause[1]); }
	};
	const place = (r: Roach) => {
		const d = lerp(ROACH.backScale, 1, depth(r.y));
		const s = (ROACH.height / ROACH.cell.h) * d;
		const right = Math.cos(r.h) >= 0;
		// the sheet faces right; facing left mirrors scale.x, and a mirror commutes with the
		// rotation by flipping its sign, so the tilt + lean keep one sign here (matches the artifact)
		const lean = Math.atan2(Math.sin(r.h) * ROACH.slope, Math.abs(Math.cos(r.h))) * ROACH.lean;
		r.s.position.set(r.x, r.y);
		r.s.scale.set(right ? s : -s, s);
		r.s.rotation = (ROACH.tiltDeg * Math.PI) / 180 + lean;
		r.s.zIndex = r.y;
		const tex = frames[Math.floor(r.leg) % frames.length];
		if (r.s.texture !== tex) r.s.texture = tex; // swap between resident frames, never a new texture
		r.sh.position.set(r.x, r.y + 2 * d);
		r.sh.scale.set(s);
		r.sh.zIndex = r.y - 0.5;
	};

	onMount(() => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		frames = [];
		for (let k = 0; k < ROACH.frames; k++) { const t = assets?.[`roach_${k}.png`]; if (t) frames.push(t); }
		if (!frames.length) return;
		for (let i = 0; i < ROACH.count; i++) roaches.push(spawn());
		const ticker = context.stateApp.pixiApplication?.ticker;
		const tick = () => {
			if (!root.visible || root.alpha <= 0) return;
			const dt = Math.min(0.05, (ticker?.deltaMS ?? 16) / 1000);
			for (const r of roaches) { step(r, dt); place(r); }
		};
		ticker?.add(tick);
		return () => ticker?.remove(tick);
	});

	$effect(() => {
		root.position.set(x, y);
		root.scale.set(scale);
		root.alpha = alpha;
		root.visible = visible;
		root.zIndex = zIndex;
	});
</script>
