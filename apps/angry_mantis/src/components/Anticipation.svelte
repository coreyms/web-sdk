<script lang="ts">
	// Scatter anticipation for one reel (Corey 2026-09-08, from the reel-motion artifact): a
	// prison-yard searchlight swings through the column that is still to drop, over a faint rain
	// of loose symbols, while a warm light spill grows in from the column's edges as the hold runs
	// out. Everything keeps going behind the real symbols as they fall and fades out as they land.
	// Mounted by Anticipations.svelte while reel.reelState.anticipating: from the moment the reel's
	// hold begins (it arms the flag itself in createReelForCascading's fallIn, or the previous reel
	// sets it when its bottom row lands, whichever is first) until this reel's motion is 'stopped'.
	// Lives in BOARD space inside the masked BoardContainer (Board.svelte); the beam is further
	// masked to its own column so it never lights the neighbours.
	//
	// Loose symbols are NOT reel symbols: they never enter reelState.symbols, so the drift gate
	// (boardGrid.ts) never measures them. A fixed set of sprites cycles down the column and each
	// one re-rolls its face every time it wraps; three ghost copies per symbol, slightly stretched,
	// stand in for motion blur (house rule: no filters). The beam and spill are baked textures
	// (game/beamTexture.ts) on additive sprites: no per-frame geometry, no filters.
	import { BaseSprite, Container, Rectangle, Sprite } from 'pixi-svelte';
	import { stateBetDerived } from 'state-shared';

	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { SYMBOL_SIZE, CELL_FILL, BOARD_DIMENSIONS, ANTICIPATION } from '../game/constants';
	import { beamTexture, spillTexture } from '../game/beamTexture';
	import { stateGame, type Reel } from '../game/stateGame.svelte';
	import type { RawSymbol } from '../game/types';

	type Props = { reel: Reel; oncomplete: () => void };
	const props: Props = $props();

	const COLUMN_H = SYMBOL_SIZE * BOARD_DIMENSIONS.y;
	const tile = SYMBOL_SIZE * CELL_FILL;
	const x = getSymbolX(props.reel.reelIndex); // column centre
	const GHOSTS = [-1, 0, 1];

	// paying symbols and wild; never a scatter (the rain must not fake the count) and never the
	// Service Bell — the rain only plays in base/ante/mystery, where a bell can't land (Corey 2026-09-10)
	const POOL = ['L1', 'L2', 'L3', 'L4', 'M1', 'M2', 'M3', 'H1', 'W'];
	const roll = () => POOL[Math.floor(Math.random() * POOL.length)];
	const assetKey = (name: string) => getSymbolInfo({ rawSymbol: { name } as RawSymbol, state: 'static' }).assetKey;

	const N = BOARD_DIMENSIONS.y + 2; // one loose symbol per row plus one entering and one leaving
	const LOOP = N * SYMBOL_SIZE;

	let names = $state(Array.from({ length: N }, roll));
	let dist = $state(0); // px the rain has travelled, in style time (turbo runs it faster)
	let styleMs = $state(0); // ms of style time since mount: the beam swings on this
	let q = $state(0); // share of the hold used (0 until the hold starts)
	let fade = $state(1);
	const cycles = Array(N).fill(0);
	let raf = 0;
	let last = performance.now();
	let fallStart: number | null = null;
	const step = (now: number) => {
		const ts = stateBetDerived.timeScale();
		dist += (now - last) * ts * ANTICIPATION.rainSpeed;
		styleMs += (now - last) * ts;
		last = now;
		for (let k = 0; k < N; k += 1) {
			const cycle = Math.floor((k * SYMBOL_SIZE + dist) / LOOP);
			if (cycle !== cycles[k]) {
				cycles[k] = cycle;
				names[k] = roll();
			}
		}
		const { holdStart, holdMs } = props.reel.reelState;
		q = holdStart > 0 && holdMs > 0 ? Math.min(1, (now - holdStart) / holdMs) : 0;
		if (props.reel.reelState.motion === 'fallingIn') {
			// the real symbols are on their way: fade over the fall so the hand-over is a cross-fade,
			// never a dark column (the fall is 5.5 cells at the reel's fall-in speed)
			if (fallStart === null) fallStart = now;
			const fallMs = (SYMBOL_SIZE * 5.5) / props.reel.reelState.spinOptions().symbolFallInSpeed;
			fade = Math.max(0, 1 - (now - fallStart) / fallMs);
		}
		raf = requestAnimationFrame(step);
	};
	raf = requestAnimationFrame(step);
	$effect(() => () => cancelAnimationFrame(raf));

	$effect(() => {
		if (props.reel.reelState.motion === 'stopped') props.oncomplete();
	});

	// column-local y of loose symbol k: enters above the window, leaves below it
	const ys = $derived(Array.from({ length: N }, (_, k) => ((k * SYMBOL_SIZE + dist) % LOOP) - SYMBOL_SIZE / 2));

	const strength = $derived(ANTICIPATION.strength[stateGame.turboLevel] ?? ANTICIPATION.strength[0]);
	// searchlight: pivot above the column, swinging either side of straight down
	const beamLen = COLUMN_H * ANTICIPATION.beamLength;
	const beamW = 2 * ANTICIPATION.beamHalfWidth * beamLen;
	const beamAngle = $derived(Math.sin((styleMs / ANTICIPATION.beamPeriodMs) * Math.PI * 2) * ANTICIPATION.beamSwing);
	// light spill: grows in from both edges over the hold
	const spillW = $derived(tile * (ANTICIPATION.spillWidth + ANTICIPATION.spillGrow * q));
	const spillAlpha = $derived((ANTICIPATION.spillAlpha + ANTICIPATION.spillAlphaGrow * q) * strength * fade);
</script>

<!-- rain, under the reel's symbols -->
<Container {x} zIndex={-1} alpha={ANTICIPATION.rainAlpha * fade}>
	{#each names as name, k (k)}
		{#each GHOSTS as ghost (ghost)}
			<Sprite anchor={0.5} key={assetKey(name)} y={ys[k] + ghost * ANTICIPATION.rainGhostOffset} width={tile} height={tile * ANTICIPATION.rainStretch} />
		{/each}
	{/each}
</Container>

<!-- searchlight, over the rain and under the symbols, masked to its own column -->
<Container x={x - SYMBOL_SIZE / 2} zIndex={-1} alpha={strength * fade}>
	<Rectangle isMask width={SYMBOL_SIZE} height={COLUMN_H} />
	<BaseSprite
		texture={beamTexture()}
		anchor={{ x: 0.5, y: 0 }}
		x={SYMBOL_SIZE / 2}
		y={COLUMN_H * ANTICIPATION.beamOriginY}
		rotation={beamAngle}
		width={beamW}
		height={beamLen}
		blendMode="add"
	/>
</Container>

<!-- light spill from both edges, over the symbols -->
<Container x={x - SYMBOL_SIZE / 2} zIndex={30} alpha={spillAlpha}>
	<BaseSprite texture={spillTexture('left')} width={spillW} height={COLUMN_H} blendMode="add" />
	<BaseSprite texture={spillTexture('right')} x={SYMBOL_SIZE - spillW} width={spillW} height={COLUMN_H} blendMode="add" />
</Container>
