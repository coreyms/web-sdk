<script lang="ts">
	// The scene background: TEMPORARY, the citadel courtyard (tile-bg, tools/build_board_layers.py) for
	// every mode family until the per-mode scenes land. One texture per layout (landscape / phone /
	// portrait crops), cover-fitted to the canvas and centred, plus the scene wash so the board and the
	// chrome read on top (darker in the features). A feature scene that is still in the deferred load
	// phase falls back to the base scene of the same layout, then to the flat sky colour, so nothing
	// here ever mounts conditionally (house rule: always-mounted z order).
	import * as PIXI from 'pixi.js';
	import { BaseSprite, Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { layoutKind } from '../game/layoutSpec';
	import { BACKGROUND_WASH, zIndexes } from '../game/constants';

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));

	const family = $derived(
		context.stateGame.gameType !== 'freegame'
			? 'base'
			: context.stateGame.bonusMode === 'epic'
				? 'epic'
				: context.stateGame.bonusMode === 'super'
					? 'super'
					: 'bonus',
	);
	const texture = $derived.by(() => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		return assets?.[`bg_${family}_${kind}`] ?? assets?.[`bg_base_${kind}`] ?? PIXI.Texture.EMPTY;
	});
	/** cover fit: the texture fills the canvas, centred, the overflow cropped by the canvas edge. A scale,
	 *  never width / height: those are relative to whichever texture the sprite holds when they land */
	const fit = $derived.by(() => {
		const tw = texture.width || 1;
		const th = texture.height || 1;
		const s = Math.max(canvas.width / tw, canvas.height / th);
		return { x: (canvas.width - tw * s) / 2, y: (canvas.height - th * s) / 2, s };
	});
	const wash = $derived(context.stateGame.gameType === 'freegame' ? BACKGROUND_WASH.freegame : BACKGROUND_WASH.base);
</script>

<!-- the flat sky stays under the art: it is what shows before the texture is in -->
<Rectangle zIndex={zIndexes.background.backdrop} width={canvas.width} height={canvas.height} backgroundColor={0x2a2230} />
<BaseSprite
	zIndex={zIndexes.background.normal}
	{texture}
	visible={texture !== PIXI.Texture.EMPTY}
	x={fit.x}
	y={fit.y}
	scale={fit.s}
/>
<Rectangle zIndex={zIndexes.background.feature} width={canvas.width} height={canvas.height} backgroundColor={0x05060a} alpha={wash} />
