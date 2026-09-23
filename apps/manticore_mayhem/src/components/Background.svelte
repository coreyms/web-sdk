<script lang="ts">
	// Placeholder backdrop: the Persian palette as flat bands (sunset sky over sandstone) plus the
	// scene wash, so the board and the chrome read on top. The real 1920x1080 citadel render
	// replaces this whole component — nothing else depends on it.
	import { Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BACKGROUND_WASH, zIndexes } from '../game/constants';

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	/** the sky darkens as the modes escalate — a stand-in for the per-mode rooms */
	const sky = $derived(
		context.stateGame.gameType !== 'freegame'
			? 0x2a2230
			: context.stateGame.bonusMode === 'epic'
				? 0x33131a
				: context.stateGame.bonusMode === 'super'
					? 0x1b2436
					: 0x252035,
	);
	const wash = $derived(context.stateGame.gameType === 'freegame' ? BACKGROUND_WASH.freegame : BACKGROUND_WASH.base);
</script>

<Rectangle zIndex={zIndexes.background.backdrop} width={canvas.width} height={canvas.height} backgroundColor={sky} />
<!-- sandstone ground band -->
<Rectangle
	zIndex={zIndexes.background.normal}
	y={canvas.height * 0.72}
	width={canvas.width}
	height={canvas.height * 0.28}
	backgroundColor={0x4a3b2c}
/>
<Rectangle zIndex={zIndexes.background.feature} width={canvas.width} height={canvas.height} backgroundColor={0x05060a} alpha={wash} />
