<script lang="ts">
	// Reflections of the reels on the frame's inner steel lips (Corey 2026-09-02). The reels'
	// MainContainer (tagged by ReflectSource) is drawn a second time into a SMALL offscreen
	// RenderTexture — a third of master resolution, which is the blur — and four mirrored, squashed,
	// blue-tinted additive sprites of that texture lie along the window edges. Corey's reflectivity
	// mask (the frame art painted white where the chrome lip is, alpha = strength) clips them to the
	// actual steel, so the bands need no geometry of their own.
	//
	// Cost: one extra pass of the reel sprites into a ~180×140 px target, only while the reels move
	// or the game is mid-presentation; at rest it refreshes a couple of times a second so idle
	// symbol animations still shimmer. The texture is allocated once and resized only on a layout
	// change (no per-frame texture churn — house rule 6). Hidden while the steel door is down: the
	// door covers the window, and mirroring reels that nobody can see would read as a glitch.
	import * as PIXI from 'pixi.js';
	import { Container, Sprite, BaseSprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { frameFor, layoutKind, FRAME_ART } from '../game/layoutSpec';
	import { getReflectSource } from '../game/reflection';

	const context = getContext();
	const vw = $derived(
		context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale,
	);
	const frame = $derived(frameFor(layoutKind(context.stateLayoutDerived.layoutType()), vw));
	const win = $derived({
		x: frame.x + frame.inset,
		y: frame.y + frame.inset,
		w: frame.width - frame.inset * 2,
		h: frame.height - frame.inset * 2,
	});
	// the mask rides the frame art's rect exactly as BoardFrame places the art
	const sx = $derived(win.w / FRAME_ART.winW);
	const sy = $derived(win.h / FRAME_ART.winH);

	// ---- look ----
	const TINT = 0x9fd2ff; // cool steel-blue sheen (Corey's draft)
	const ALPHA = 0.45;
	const SQUASH_Y = 0.45; // bottom / top lips: how much of the edge rows they mirror
	const SQUASH_X = 0.4; // side lips
	const RES = 0.3; // capture resolution vs master — the blur
	const IDLE_REFRESH_MS = 400;

	// logical size = the window in master units, so the mirrored sprites use unit scale
	const rt = PIXI.RenderTexture.create({ width: 600, height: 480, resolution: RES });
	$effect(() => {
		rt.resize(Math.max(2, Math.round(win.w)), Math.max(2, Math.round(win.h)), RES);
	});

	let visible = $state(true);
	context.eventEmitter.subscribeOnMount({
		doorClose: () => (visible = false),
		doorSnap: ({ closed }) => (visible = !closed),
		doorOpen: () => (visible = true),
	});

	// capture loop: rides the app ticker ahead of the stage render (default priority > LOW)
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		let last = 0;
		const transform = new PIXI.Matrix();
		const tick = () => {
			const src = getReflectSource();
			if (!visible || !src || !app.renderer || context.stateLayout.showLoadingScreen) return;
			const busy =
				!context.stateXstateDerived.isIdle() ||
				context.stateGame.board.some((reel) => reel.reelState.motion !== 'stopped');
			const now = performance.now();
			if (!busy && now - last < IDLE_REFRESH_MS) return;
			last = now;
			// children of the source are authored in master units; map the window's top-left onto
			// the texture origin (the source's own master→canvas transform is bypassed)
			transform.set(1, 0, 0, 1, -win.x, -win.y);
			app.renderer.render({ container: src, target: rt, clear: true, transform });
		};
		app.ticker.add(tick);
		return () => app.ticker.remove(tick);
	});
</script>

<Container {visible}>
	<Sprite
		key="frameReflectMask"
		isMask
		x={win.x - FRAME_ART.winX * sx}
		y={win.y - FRAME_ART.winY * sy}
		width={FRAME_ART.w * sx}
		height={FRAME_ART.h * sy}
	/>
	<!-- bottom rail: the bottom rows mirrored downward -->
	<BaseSprite texture={rt} anchor={{ x: 0, y: 1 }} x={win.x} y={win.y + win.h} scale={{ x: 1, y: -SQUASH_Y }} tint={TINT} alpha={ALPHA} blendMode="add" />
	<!-- top lip: the top rows mirrored upward -->
	<BaseSprite texture={rt} anchor={{ x: 0, y: 0 }} x={win.x} y={win.y} scale={{ x: 1, y: -SQUASH_Y }} tint={TINT} alpha={ALPHA} blendMode="add" />
	<!-- left lip: the first column mirrored leftward -->
	<BaseSprite texture={rt} anchor={{ x: 0, y: 0 }} x={win.x} y={win.y} scale={{ x: -SQUASH_X, y: 1 }} tint={TINT} alpha={ALPHA} blendMode="add" />
	<!-- right lip: the last column mirrored rightward -->
	<BaseSprite texture={rt} anchor={{ x: 1, y: 0 }} x={win.x + win.w} y={win.y} scale={{ x: -SQUASH_X, y: 1 }} tint={TINT} alpha={ALPHA} blendMode="add" />
</Container>
