<script lang="ts">
	// The mantises' shadow on the board frame (Corey 2026-09-08): each mounted rig registers its
	// soft body-shadow render texture (game/mantisShadow.ts); this draws it again UPRIGHT on the
	// frame's post beside the mantis — the right post for Marty, the left for mirrored Marky —
	// clipped to that post with a rectangle mask (stencil, no filter). Lives in the frame's
	// MainContainer right after the frame art, under the reflections and the reels. Raw Pixi on
	// the app ticker: the sprites follow the rigs' toe lines through walks and layout changes.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { frameFor, layoutKind } from '../game/layoutSpec';
	import { MANTIS_SHADOW as MS, mantisShadowSources } from '../game/mantisShadow';

	const context = getContext();
	const root = new PIXI.Container();
	getContextParent().addToParent(root);
	const parent = getContextParent().parent;

	type Entry = { holder: PIXI.Container; sprite: PIXI.Sprite; mask: PIXI.Graphics };
	const entries = new Map<string, Entry>();

	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		const tick = () => {
			const vw = context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale;
			const frame = frameFor(layoutKind(context.stateLayoutDerived.layoutType()), vw);
			const sources = mantisShadowSources();
			// drop entries whose rig unmounted
			for (const [name, e] of entries) {
				if (!sources.has(name)) {
					root.removeChild(e.holder);
					e.holder.destroy({ children: true });
					entries.delete(name);
				}
			}
			for (const [name, src] of sources) {
				let e = entries.get(name);
				if (!e) {
					const holder = new PIXI.Container();
					const sprite = new PIXI.Sprite(src.texture);
					sprite.tint = 0x000000;
					sprite.alpha = MS.frame.alpha;
					const mask = new PIXI.Graphics();
					holder.addChild(mask);
					holder.addChild(sprite);
					holder.mask = mask;
					root.addChild(holder);
					e = { holder, sprite, mask };
					entries.set(name, e);
				}
				if (e.sprite.texture !== src.texture) e.sprite.texture = src.texture;
				// the post this mantis stands beside: the frame's rail plus its overhang
				const x0 = src.mirror ? frame.x - frame.inset * 1.5 : frame.x + frame.width - frame.inset;
				e.mask.clear().rect(x0, frame.y - frame.inset, frame.inset * 2.5, frame.height + frame.inset * 2).fill(0xffffff);
				const toe = parent.toLocal(src.toeWorld());
				const dir = src.mirror ? -1 : 1;
				e.sprite.anchor.set(src.anchor.x, src.anchor.y);
				e.sprite.scale.set(src.k * MS.frame.scale * dir, src.k * MS.frame.scale);
				e.sprite.position.set(toe.x + MS.frame.dx * src.H * dir, toe.y + MS.frame.dy * src.H);
			}
		};
		ticker?.add(tick);
		if (import.meta.env.DEV && typeof window !== 'undefined') ((window as any).__angryMantis ??= {}).frameShadow = (on: boolean) => (root.visible = on);
		return () => {
			ticker?.remove(tick);
			root.destroy({ children: true });
		};
	});
</script>
