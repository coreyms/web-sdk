<script lang="ts" module>
	/** DEV: the prompts on show (`__manticore.pressPromptSprites()`) */
	const live = new Set<() => Record<string, unknown>>();
</script>

<script lang="ts">
	// THE IN-GAME PRESS ANYWHERE TO CONTINUE in Cinzel 700 (fonts r2, Corey 2026-10-17 14:01; game/pressPrompt.ts has
	// the how and why). Drawn where ArtAmount drew it, with ArtAmount's props: `y` is the BASELINE, the capitals are
	// `height` tall and centred on `x`, shrunk with the line until it fits `maxWidth`. `shadow` is the hard drop shadow,
	// a second sprite of the same texture drawn first, offset (fractions of `height`) and tinted, no filter. The blink
	// is `alpha` on the pair's container, so it never draws anything.
	//
	// Until Cinzel is in nothing is drawn (it is nearly always in already: the landing screen draws it); if it can not
	// load, the prompt is the atlas line it was before (ArtAmount), never a fallback face.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { PRESS_PROMPT } from '../game/constants';
	import { pressPromptFace, pressPromptFaceReady, pressPromptRelease, pressPromptStats, pressPromptTake, type PressPromptRaster } from '../game/pressPrompt';
	import ArtAmount from './ArtAmount.svelte';

	type Props = { height: number; x: number; y: number; maxWidth?: number; alpha?: number; shadow?: { dx: number; dy: number; tint: number } };
	const { height, x, y, maxWidth, alpha = 1, shadow }: Props = $props();

	const context = getContext();

	/** 'wait' until the face answers, then 'cinzel', or 'atlas' when it can not load */
	let face = $state<'wait' | 'cinzel' | 'atlas'>(pressPromptFaceReady() ? 'cinzel' : 'wait');
	let alive = true;
	void pressPromptFace().then((ok) => {
		if (alive) face = ok ? 'cinzel' : 'atlas';
	});

	// the renderer's resolution is not reactive: its 'resize' event (Game.svelte applyResolution calls app.resize())
	// bumps this, so a resolution change draws the line again
	let resGen = $state(0);
	const renderer = $derived(context.stateApp.pixiApplication?.renderer as PIXI.Renderer | undefined);
	$effect(() => {
		// the renderer is an EventEmitter at run time (AbstractRenderer); 8.8.1's Renderer union type does not show it
		const r = renderer as unknown as { on(e: 'resize', f: () => void): void; off(e: 'resize', f: () => void): void } | undefined;
		if (!r) return;
		const bump = () => (resGen += 1);
		r.on('resize', bump);
		return () => void r.off('resize', bump);
	});

	// shadow first, ink over it, both the same texture
	const root = new PIXI.Container();
	const shadowSprite = new PIXI.Sprite({ texture: PIXI.Texture.EMPTY, roundPixels: true });
	const inkSprite = new PIXI.Sprite({ texture: PIXI.Texture.EMPTY, roundPixels: true });
	inkSprite.tint = PRESS_PROMPT.ink;
	root.addChild(shadowSprite, inkSprite);
	root.visible = false;
	getContextParent().addToParent(root);

	/** device px per master unit: the layout's scale (MainContainer) x the renderer's resolution */
	const px = $derived.by(() => {
		void resGen;
		return context.stateLayoutDerived.mainLayout().scale * (renderer?.resolution ?? 1);
	});

	let held: PressPromptRaster | null = null;
	// the texture: taken from the shared cache (drawn there the first time) when the size, the fit or px changes
	$effect(() => {
		if (face !== 'cinzel' || !(px > 0)) return;
		const raster = pressPromptTake(height, maxWidth, px);
		if (held) pressPromptRelease(held);
		held = raster;
		for (const s of [shadowSprite, inkSprite]) {
			s.texture = raster.texture;
			s.anchor.set(raster.anchor.x, raster.anchor.y);
			s.scale.set(1 / raster.px);
		}
		root.visible = true;
	});
	$effect(() => {
		const sh = shadow;
		shadowSprite.visible = !!sh;
		shadowSprite.position.set(sh ? sh.dx * height : 0, sh ? sh.dy * height : 0);
		shadowSprite.tint = sh?.tint ?? 0;
	});
	$effect(() => {
		root.position.set(x, y);
	});
	$effect(() => {
		root.alpha = alpha;
	});

	// DEV: the cache (`__manticore.pressPromptTex()`): how often the line was drawn, its size, the face
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const m = ((window as any).__manticore ??= {});
		m.pressPromptTex ??= () => ({
			...pressPromptStats(),
			faceLoaded: document.fonts.check(PRESS_PROMPT.fontCheck, PRESS_PROMPT.text),
		});
		m.pressPromptSprites ??= () => [...live].map((f) => f());
	}
	const report = () => {
		const b = inkSprite.getBounds();
		const res = renderer?.resolution ?? 1;
		return {
			face,
			visible: root.visible && !!root.parent,
			alpha: root.alpha,
			shadow: shadowSprite.visible,
			px,
			// the same from the drawn transform: equal to px when the stage adds no scale of its own
			worldPx: Math.abs(inkSprite.worldTransform.a) * res * (held?.px ?? 1),
			bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
			key: held?.key ?? null,
		};
	};
	if (import.meta.env.DEV) live.add(report);

	onMount(() => () => {
		live.delete(report);
		alive = false;
		if (held) pressPromptRelease(held);
		held = null;
		// the parent's unmount destroys root without its children: the sprites go here (never the shared texture)
		shadowSprite.destroy();
		inkSprite.destroy();
	});
</script>

{#if face === 'atlas'}
	<ArtAmount text={PRESS_PROMPT.text} {height} {x} {y} {alpha} {maxWidth} {shadow} />
{/if}
