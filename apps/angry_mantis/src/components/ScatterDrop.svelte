<script lang="ts">
	// The scatter's own entrance (SCATTER_LAND, constants.ts). The reel strip refills with the
	// scatter's cell empty; once it has settled the card is slapped down from the front: it scales
	// from slapFrom to 1.0 on a quad-in, fades in over the first slapFadeMs, and its contact shadow
	// closes under it. Lives in a layer ABOVE the board frame (Game.svelte), in board space, so the
	// oversized card is never clipped by the window mask; ReelSymbol hides the reel's own tile for
	// exactly as long as a drop is listed in stateGame.scatterDrops and shows it again on the frame
	// the card hits (scatterDropDone), so the hand-over never pops. The reel engine still owns the
	// tile's position: nothing here moves a reel symbol, so the drift gate is untouched.
	// One rAF drives every live drop into one $state; always-mounted (no per-drop mount churn).
	import { Container, Sprite } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { stateBetDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, CELL_FILL, SCATTER_LAND } from '../game/constants';
	import { getSymbolX, getSymbolY } from '../game/utils';
	import type { Position } from '../game/types';

	const context = getContext();
	const tileSize = SYMBOL_SIZE * CELL_FILL;
	const quadIn = (t: number) => t * t;

	type Live = { reel: number; row: number; t0: number; p: number; a: number };
	let live = $state<Live[]>([]);
	let raf = 0;
	const key = (p: Position) => `${p.reel}:${p.row}`;
	const starts = new Map<string, number>();

	const step = (now: number) => {
		const ts = stateBetDerived.timeScale();
		const slapMs = SCATTER_LAND.slapMs / ts;
		const fadeMs = SCATTER_LAND.slapFadeMs / ts;
		const next: Live[] = [];
		for (const d of context.stateGame.scatterDrops) {
			const k = key(d);
			let t0 = starts.get(k);
			if (t0 === undefined) {
				t0 = now + SCATTER_LAND.slapDelayMs / ts;
				starts.set(k, t0);
				context.stateGameDerived.scatterTrace('slap', { reel: d.reel, row: d.row });
			}
			const t = now - t0;
			if (t < 0) continue; // the breath after the strip settles: nothing drawn yet
			if (t >= slapMs) {
				starts.delete(k);
				context.stateGameDerived.scatterDropDone(d);
				continue;
			}
			next.push({ reel: d.reel, row: d.row, t0, p: quadIn(t / slapMs), a: Math.min(1, t / fadeMs) });
		}
		for (const k of [...starts.keys()]) {
			if (!context.stateGame.scatterDrops.some((d) => key(d) === k)) starts.delete(k);
		}
		live = next;
		raf = context.stateGame.scatterDrops.length ? requestAnimationFrame(step) : 0;
	};
	$effect(() => {
		if (context.stateGame.scatterDrops.length && !raf) raf = requestAnimationFrame(step);
	});
	$effect(() => () => cancelAnimationFrame(raf));
</script>

<MainContainer>
	<Container
		x={context.stateGameDerived.boardLayout().x}
		y={context.stateGameDerived.boardLayout().y}
		pivot={context.stateGameDerived.boardLayout().pivot}
		scale={context.stateGameDerived.boardLayout().scale}
		interactiveChildren={false}
	>
		{#each live as d (`${d.reel}:${d.row}`)}
			{@const s = SCATTER_LAND.slapFrom - (SCATTER_LAND.slapFrom - 1) * d.p}
			{@const x = getSymbolX(d.reel)}
			{@const y = getSymbolY(d.row)}
			{@const sh = tileSize * s * (1 + SCATTER_LAND.dropShadowGrow * (1 - d.p))}
			<!-- contact shadow: the card's own silhouette, sized to the flying card and thrown below it
			     while it is high (so it spills onto the neighbours and the frame), closing onto the
			     well (ReelSymbol) underneath as it lands -->
			<Sprite {x} y={y + tileSize * SCATTER_LAND.dropShadowDrop * (1 - d.p)} anchor={0.5} key="S.png" tint={0x000000} width={sh} height={sh} alpha={SCATTER_LAND.dropShadowAlpha * d.a} />
			<Sprite {x} y={y - (1 - d.p) * 6} anchor={0.5} key="S.png" width={tileSize * s} height={tileSize * s} alpha={d.a} />
		{/each}
	</Container>
</MainContainer>
