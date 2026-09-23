<script lang="ts">
	// THE MYSTERY SCATTER TEASE (RULE_PASS_2 section D), Angry Mantis's Anticipation.svelte adapted
	// from five spinning reels to the 8x8 drop.
	//
	// The board engine (stateGame.revealBoard) holds a teased COLUMN above the board before it falls
	// and then drops it slower; this component draws what the player sees while it waits: a
	// searchlight swinging through the empty column over a faint rain of loose symbols, with a warm
	// light spill growing in from the column's edges as the hold runs out. It reads
	// stateGame.anticipation and decides nothing — which columns tease comes from the BOOK's array,
	// and only in Mystery.
	//
	// House rules: mounted INSIDE Board's masked container (the tease never leaves the board), all
	// eight columns always mounted with `visible` toggled (the conditional-mount z-order trap), the
	// beam and spill are baked textures built once (game/beamTexture.ts) on additive sprites — no
	// filters, no per-frame textures — and the loose symbols are not board cells, so they never
	// reach stateGame.cells or the at-rest invariant.
	import { BaseSprite, Container, Rectangle, Sprite } from 'pixi-svelte';
	import { stateBetDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, CELL_FILL, GRID, ANTICIPATION } from '../game/constants';
	import { beamTexture, spillTexture } from '../game/beamTexture';

	const context = getContext();
	const stateGame = context.stateGame;

	const COLUMN_H = SYMBOL_SIZE * GRID;
	const tile = SYMBOL_SIZE * CELL_FILL;

	// paying symbols and the wild; never a War Standard (the rain must not fake the scatter count)
	const POOL = ['L1', 'L2', 'L3', 'L4', 'M1', 'M2', 'M3', 'H1', 'W'];
	const roll = () => POOL[Math.floor(Math.random() * POOL.length)];
	const GHOSTS = Array.from({ length: ANTICIPATION.rainGhosts * 2 + 1 }, (_, i) => i - ANTICIPATION.rainGhosts);

	const N = GRID + 2; // one loose symbol per row plus one entering and one leaving
	const LOOP = N * SYMBOL_SIZE;

	let names = $state(Array.from({ length: N }, roll));
	let dist = $state(0); // board px the rain has travelled, in style time
	let styleMs = $state(0); // ms of style time since mount: the beam swings on this
	const cycles = Array(N).fill(0);
	let raf = 0;
	let last = performance.now();
	const step = (now: number) => {
		const ts = Math.max(0.2, stateBetDerived.timeScale());
		dist += (now - last) * ts * ANTICIPATION.rainSpeed * (SYMBOL_SIZE / 110);
		styleMs += (now - last) * ts;
		last = now;
		for (let k = 0; k < N; k += 1) {
			const cycle = Math.floor((k * SYMBOL_SIZE + dist) / LOOP);
			if (cycle !== cycles[k]) {
				cycles[k] = cycle;
				names[k] = roll();
			}
		}
		raf = requestAnimationFrame(step);
	};
	raf = requestAnimationFrame(step);
	$effect(() => () => cancelAnimationFrame(raf));

	// column-local y of loose symbol k: enters above the window, leaves below it
	const ys = $derived(Array.from({ length: N }, (_, k) => ((k * SYMBOL_SIZE + dist) % LOOP) - SYMBOL_SIZE / 2));

	const strength = $derived(ANTICIPATION.strength[stateGame.turboLevel] ?? ANTICIPATION.strength[0]);
	const beamLen = COLUMN_H * ANTICIPATION.beamLength;
	const beamW = 2 * ANTICIPATION.beamHalfWidth * beamLen;
	const beamAngle = $derived(Math.sin((styleMs / ANTICIPATION.beamPeriodMs) * Math.PI * 2) * ANTICIPATION.beamSwing);
</script>

{#each stateGame.anticipation as column, reel (reel)}
	<!-- one column, at a FIXED board z (above the backdrop, below the symbols): the tease is a
	     light effect behind the tiles, never a layer that can end up over them -->
	<Container visible={column.on} x={reel * SYMBOL_SIZE} zIndex={-1}>
		<!-- rain, under the falling symbols -->
		<Container x={SYMBOL_SIZE / 2} alpha={ANTICIPATION.rainAlpha * column.fade}>
			{#each names as name, k (k)}
				{#each GHOSTS as ghost (ghost)}
					<Sprite
						anchor={0.5}
						key="{name}.png"
						y={ys[k] + ghost * ANTICIPATION.rainGhostOffset * SYMBOL_SIZE}
						width={tile}
						height={tile * ANTICIPATION.rainStretch}
					/>
				{/each}
			{/each}
		</Container>

		<!-- searchlight, masked to its own column so it never lights the neighbours -->
		<Container alpha={strength * column.fade}>
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

		<!-- light spill from both edges, growing over the hold -->
		<Container
			alpha={(ANTICIPATION.spillAlpha + ANTICIPATION.spillAlphaGrow * column.q) * strength * column.fade}
		>
			{@const spillW = SYMBOL_SIZE * CELL_FILL * (ANTICIPATION.spillWidth + ANTICIPATION.spillGrow * column.q)}
			<BaseSprite texture={spillTexture('left')} width={spillW} height={COLUMN_H} blendMode="add" />
			<BaseSprite texture={spillTexture('right')} x={SYMBOL_SIZE - spillW} width={spillW} height={COLUMN_H} blendMode="add" />
		</Container>
	</Container>
{/each}
