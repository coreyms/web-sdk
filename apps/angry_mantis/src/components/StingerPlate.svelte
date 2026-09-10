<script lang="ts">
	// A STATIC stinger plate with the cream count-up in its panel: the free-spin wrap-up (the
	// final tier's plate, or the plain plate when the total is not a big win) and the backing of
	// every regular win pop. No entrance or hand-off of its own — the caller's group moves it
	// (the wrap-up rides the door, the win pop scales in). WinStinger is the animated big-win one.
	import { BaseSprite, Sprite } from 'pixi-svelte';

	import { PLATE_SHADOW, plateShadowTexture } from '../game/shadowTexture';

	import { STINGER_AMOUNT, STINGER_BOX, STINGER_PLATE, STINGER_SHADOW_ALPHA, type StingerPlateName } from '../game/stinger';
	import CountUpText from './CountUpText.svelte';

	type Props = {
		plate: StingerPlateName;
		/** plate width in the caller's units; height follows the art's aspect */
		width: number;
		x?: number;
		y?: number;
		amount: number;
		target: number;
		settled?: boolean;
		/** amount box override, % of the plate (default: the plate's own STINGER_BOX) */
		box?: { x: number; y: number; w: number; h: number };
	};
	const { plate, width, x = 0, y = 0, amount, target, settled = false, box: boxOverride }: Props = $props();

	const height = $derived(width / STINGER_PLATE[plate].aspect);
	const box = $derived.by(() => {
		const b = boxOverride ?? STINGER_BOX[plate];
		return {
			cx: ((b.x + b.w / 2) / 100 - 0.5) * width,
			cy: ((b.y + b.h / 2) / 100 - 0.5) * height,
			w: (b.w / 100) * width * STINGER_AMOUNT.fillW,
			h: (b.h / 100) * height * STINGER_AMOUNT.fillH,
		};
	});
</script>

<!-- soft halo all round the plate (Corey 2026-09-09) -->
<BaseSprite texture={plateShadowTexture()} anchor={0.5} {x} {y} width={width * PLATE_SHADOW.scaleX} height={height * PLATE_SHADOW.scaleY} alpha={STINGER_SHADOW_ALPHA} />
<Sprite key={STINGER_PLATE[plate].key} anchor={0.5} {x} {y} {width} {height} />
<!-- CountUpText's y is the digit BASELINE; centre the digit box on the panel -->
<CountUpText
	{amount}
	{target}
	{settled}
	preset="gold"
	size={box.h}
	x={x + box.cx}
	y={y + box.cy + box.h / 2}
	maxWidth={box.w}
	tint={STINGER_AMOUNT.tint}
	shadow={STINGER_AMOUNT.shadow}
/>
