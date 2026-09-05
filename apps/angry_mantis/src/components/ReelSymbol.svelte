<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { Container, Graphics, Sprite } from 'pixi-svelte';
	import { stateBetDerived } from 'state-shared';

	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { SYMBOL_SIZE, CELL_FILL, BOARD_DIMENSIONS, HIGH_LAND, TIMINGS } from '../game/constants';
	import { glintTexture, GLINT_TEX_W, GLINT_CORE } from '../game/glintTexture';
	import { isAnteLockedSymbol, upcomingEats, stateGame, type ReelSymbol } from '../game/stateGame.svelte';

	type Props = {
		reelIndex: number;
		reelSymbol: ReelSymbol;
	};

	const props: Props = $props();
	const symbolInfo = $derived(
		getSymbolInfo({ rawSymbol: props.reelSymbol.rawSymbol, state: props.reelSymbol.symbolState }),
	);

	// strike-targeted leaf grows while the strike winds up (pendingStrikePos is board-space,
	// set at the strike event and cleared when the eat flight picks the insect up)
	const lift = $derived(
		stateGame.pendingStrikePos !== null &&
			stateGame.pendingStrikePos.reel === props.reelIndex &&
			stateGame.pendingStrikePos.row === props.reelSymbol.symbolIndexOfBoard,
	);

	// winFocus rows are in symbols[] index space (padding included): symbolIndexOfBoard = row - 1
	const dim = $derived(
		stateGame.winFocus !== null &&
			!stateGame.winFocus.some(
				(p) => p.reel === props.reelIndex && p.row - 1 === props.reelSymbol.symbolIndexOfBoard,
			),
	);

	// dinner leaf carries the insect ITS strike will eat (cascades in with it). Leaves are struck in
	// reel-major order, so the k-th unstruck leaf of this board shows the k-th symbol still in the eat
	// order — two leaves never preview the same meal. Hidden again once this leaf's strike has fed
	// the mantis (the struck cell goes back to a bare leaf).
	const insectOnLeaf = $derived.by(() => {
		if (props.reelSymbol.rawSymbol.name !== 'GL' || stateGame.gameType === 'basegame') return null;
		const unstruck = stateGame.leafOrder.filter(
			(pos) => !stateGame.consumedLeaves.some((c) => c.reel === pos.reel && c.row === pos.row),
		);
		const index = unstruck.findIndex(
			(pos) => pos.reel === props.reelIndex && pos.row === props.reelSymbol.symbolIndexOfBoard,
		);
		return index === -1 ? null : (upcomingEats()[index] ?? null);
	});

	// High-symbol landing beat (see HIGH_LAND in constants). Kicked from the 'land' → 'static'
	// hand-off below, which fires exactly once per landing, at first contact; the beat itself
	// waits out the landing bounce (same maths as createReelForCascading) so it plays on a tile
	// at rest. Progress is driven by rAF into one $state so the squash container and the glint
	// Graphics redraw together; nothing here touches the symbol's position, so the drift gate
	// still sees the cell exactly where the reel put it.
	const tileSize = SYMBOL_SIZE * CELL_FILL;
	let beat = $state<{ sq: number; gl: number } | null>(null);
	let beatRaf = 0;
	const startLandBeat = () => {
		const row = props.reelSymbol.symbolIndexOfBoard;
		if (!HIGH_LAND.symbols.includes(props.reelSymbol.rawSymbol.name) || row < 0 || row >= BOARD_DIMENSIONS.y) return;
		const opts = stateGame.board[props.reelIndex].reelState.spinOptions();
		const settleMs = (SYMBOL_SIZE * opts.symbolFallInBounceSizeMulti) / opts.symbolFallInBounceSpeed;
		const ts = stateBetDerived.timeScale();
		const sqMs = TIMINGS.highLandSquash / ts;
		const glMs = TIMINGS.highLandGlint / ts;
		const t0 = performance.now() + settleMs;
		cancelAnimationFrame(beatRaf);
		const step = (now: number) => {
			const t = now - t0;
			if (t >= Math.max(sqMs, glMs)) {
				beat = null;
				beatRaf = 0;
				return;
			}
			if (t >= 0) beat = { sq: Math.min(1, t / sqMs), gl: Math.min(1, t / glMs) };
			beatRaf = requestAnimationFrame(step);
		};
		beatRaf = requestAnimationFrame(step);
	};
	$effect(() => () => cancelAnimationFrame(beatRaf));
	const easeOut = (p: number) => 1 - (1 - p) ** 3;
	const squash = $derived(
		beat
			? { x: 1 + HIGH_LAND.squashX * (1 - easeOut(beat.sq)), y: 1 - HIGH_LAND.squashY * (1 - easeOut(beat.sq)) }
			: { x: 1, y: 1 },
	);
	// the tray silhouette, filled with the shared gradient strip. 'global' texture space: the
	// fill matrix maps TEXELS to local pixels, so it centres the strip's bright core on the
	// origin, scales it to glintWidth of the tile, tilts it, and slides it from beyond the left
	// edge to beyond the right (verified on the live stage 2026-09-05; the default 'local' space
	// first fits the texture to the shape's bounds and the sweep never lands where expected)
	const drawGlint = (g: PIXI.Graphics) => {
		if (!beat) return;
		// fresh context per frame: a clear()+redraw on the same context leaves the texture fill's
		// UVs at the first build in the live scene (verified 2026-09-05; the strip never moved
		// on-screen while an extract of the node alone showed it sweeping). Replacing the context
		// forces the batch to rebuild. The Graphics destroys the context it owned.
		g.context = new PIXI.GraphicsContext();
		const p = beat.gl;
		const h = tileSize * HIGH_LAND.trayHeight;
		const r = tileSize * HIGH_LAND.trayRadius;
		const cy = tileSize * HIGH_LAND.trayCenterY;
		const s = (tileSize * HIGH_LAND.glintWidth) / GLINT_CORE; // px per texel
		const xc = -tileSize * 0.75 + tileSize * 1.5 * p;
		const m = new PIXI.Matrix().translate(-GLINT_TEX_W / 2, -1).scale(s, s).rotate(HIGH_LAND.glintAngle).translate(xc, cy);
		g.roundRect(-tileSize / 2, -h / 2 + cy, tileSize, h, r).fill({
			texture: glintTexture(),
			matrix: m,
			textureSpace: 'global',
			alpha: HIGH_LAND.glintAlpha * Math.sin(p * Math.PI),
		});
	};
</script>

<!-- the ante-locked scatter draws above its reel's cascading symbols (they fall behind it) -->
<SymbolWrap
	x={getSymbolX(props.reelIndex)}
	y={props.reelSymbol.symbolY.current}
	zIndex={isAnteLockedSymbol(props.reelIndex, props.reelSymbol.symbolIndexOfBoard) ? 10 : 0}
	animating={props.reelSymbol.symbolState === 'win'}
	{dim}
	{lift}
>
	<Container scale={squash}>
		<Symbol
			state={props.reelSymbol.symbolState}
			rawSymbol={props.reelSymbol.rawSymbol}
			oncomplete={() => {
				if (props.reelSymbol.symbolState === 'win') props.reelSymbol.oncomplete();
				if (props.reelSymbol.symbolState === 'land') {
					props.reelSymbol.symbolState = 'static';
					startLandBeat();
				}
			}}
		/>
		{#if beat}
			<!-- glint clipped to the tray shape, then the bug redrawn over it so the light never crosses it -->
			<Graphics draw={drawGlint} />
			<Sprite anchor={0.5} key="{props.reelSymbol.rawSymbol.name}_insect.png" width={tileSize} height={tileSize} />
		{/if}
	</Container>
	{#if insectOnLeaf}
		<Sprite anchor={0.5} key="{insectOnLeaf}_insect.png" width={SYMBOL_SIZE * CELL_FILL} height={SYMBOL_SIZE * CELL_FILL} />
	{/if}
</SymbolWrap>
