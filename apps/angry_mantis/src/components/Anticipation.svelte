<script lang="ts">
	// Scatter anticipation for one reel (Corey 2026-09-08, from the reel-motion artifact): the reel
	// that is still to drop "rains" loose symbols through its empty column under a gold rim for its
	// hold, keeps raining behind its real symbols while they fall, and fades out as they land.
	// Mounted by Anticipations.svelte while reel.reelState.anticipating: from the moment the reel's
	// hold begins (it arms the flag itself in createReelForCascading's fallIn, or the previous reel
	// sets it when its bottom row lands, whichever is first) until this reel's motion is 'stopped'. Lives in BOARD space inside the masked BoardContainer (Board.svelte), so the rain is
	// clipped to the window and sits under the symbols (zIndex -1); the rim draws over them.
	//
	// Loose symbols are NOT reel symbols: they never enter reelState.symbols, so the drift gate
	// (boardGrid.ts) never measures them. A fixed set of sprites cycles down the column and each
	// one re-rolls its face every time it wraps; three ghost copies per symbol, slightly stretched,
	// stand in for motion blur (house rule: no filters).
	import { BaseSprite, Container, Sprite } from 'pixi-svelte';
	import { stateBetDerived } from 'state-shared';

	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { SYMBOL_SIZE, CELL_FILL, BOARD_DIMENSIONS, ANTICIPATION } from '../game/constants';
	import { rimTexture, RIM_PAD } from '../game/rimTexture';
	import type { Reel } from '../game/stateGame.svelte';
	import type { RawSymbol } from '../game/types';

	type Props = { reel: Reel; oncomplete: () => void };
	const props: Props = $props();

	const COLUMN_H = SYMBOL_SIZE * BOARD_DIMENSIONS.y;
	const tile = SYMBOL_SIZE * CELL_FILL;
	const x = getSymbolX(props.reel.reelIndex);
	const GHOSTS = [-1, 0, 1];

	// paying symbols, wild and leaf; never a scatter — the rain must not fake the count
	const POOL = ['L1', 'L2', 'L3', 'L4', 'M1', 'M2', 'M3', 'H1', 'W', 'GL'];
	const roll = () => POOL[Math.floor(Math.random() * POOL.length)];
	const assetKey = (name: string) => getSymbolInfo({ rawSymbol: { name } as RawSymbol, state: 'static' }).assetKey;

	const N = BOARD_DIMENSIONS.y + 2; // one loose symbol per row plus one entering and one leaving
	const LOOP = N * SYMBOL_SIZE;

	let names = $state(Array.from({ length: N }, roll));
	let dist = $state(0); // px the rain has travelled, in style time (turbo runs it faster)
	let fade = $state(1);
	const cycles = Array(N).fill(0);
	let raf = 0;
	let last = performance.now();
	let fallStart: number | null = null;
	const step = (now: number) => {
		const ts = stateBetDerived.timeScale();
		dist += (now - last) * ts * ANTICIPATION.rainSpeed;
		last = now;
		for (let k = 0; k < N; k += 1) {
			const cycle = Math.floor((k * SYMBOL_SIZE + dist) / LOOP);
			if (cycle !== cycles[k]) {
				cycles[k] = cycle;
				names[k] = roll();
			}
		}
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

	const pulse = $derived(0.55 + 0.45 * Math.sin((dist / ANTICIPATION.rainSpeed / ANTICIPATION.rimPulseMs) * Math.PI * 2));
	// the rim is one baked texture (rimTexture.ts) whose alpha pulses: no per-frame geometry
	const RIM_W = SYMBOL_SIZE + 10 + RIM_PAD * 2;
	const RIM_H = COLUMN_H + 10 + RIM_PAD * 2;
</script>

<!-- rain, under the reel's symbols -->
<Container {x} zIndex={-1} alpha={ANTICIPATION.rainAlpha * fade}>
	{#each names as name, k (k)}
		{#each GHOSTS as ghost (ghost)}
			<Sprite anchor={0.5} key={assetKey(name)} y={ys[k] + ghost * ANTICIPATION.rainGhostOffset} width={tile} height={tile * ANTICIPATION.rainStretch} />
		{/each}
	{/each}
</Container>

<!-- gold rim, over them -->
<Container {x} zIndex={30}>
	<BaseSprite texture={rimTexture()} anchor={0.5} y={COLUMN_H / 2} width={RIM_W} height={RIM_H} alpha={(0.6 + 0.4 * pulse) * fade} />
</Container>
