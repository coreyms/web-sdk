<script lang="ts">
	// The mugshot's camera flash (SCATTER_LAND.bulb*): on every third-or-later scatter hit the
	// whole board window blows out white and is gone in bulbMs. One always-mounted rectangle
	// inside Board's masked container, alpha only — restamped by stateGame.scatterBulbAt.
	import { Rectangle } from 'pixi-svelte';
	import { stateBetDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { SCATTER_LAND } from '../game/constants';

	const context = getContext();
	let alpha = $state(0);
	let raf = 0;
	const step = (now: number) => {
		const q = (now - context.stateGame.scatterBulbAt) / (SCATTER_LAND.bulbMs / stateBetDerived.timeScale());
		if (q >= 1) {
			alpha = 0;
			raf = 0;
			return;
		}
		alpha = SCATTER_LAND.bulbAlpha * (1 - Math.max(0, q)) ** 2;
		raf = requestAnimationFrame(step);
	};
	$effect(() => {
		if (!context.stateGame.scatterBulbAt) return;
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(step);
	});
	$effect(() => () => cancelAnimationFrame(raf));
</script>

<Rectangle
	zIndex={40}
	visible={alpha > 0}
	{alpha}
	backgroundColor={0xfffaeb}
	width={context.stateGameDerived.boardLayout().width}
	height={context.stateGameDerived.boardLayout().height}
/>
