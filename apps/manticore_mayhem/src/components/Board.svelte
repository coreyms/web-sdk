<script lang="ts" module>
	import type { StingKind } from '../game/typesBookEvent';

	export type FeatureBeat = 'swipe' | 'roar';

	export type EmitterEventBoard =
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		/** a manticore set piece is playing; milestone 1 uses it for the board-side flash only */
		| { type: 'featureBeat'; beat: FeatureBeat; rows: number[] }
		/** one beat of a sting, for the rig slot (components/Sting.svelte). `phase` is the beat
		 *  itself — `wait` the scatter sting's disappointment hold, `charge` the big / super
		 *  wind-up, `strike` the hit — and `kind` is the book's, never re-derived. */
		| { type: 'stingBeat'; phase: 'charge' | 'wait' | 'strike'; kind: StingKind; center: number; cells: number[] };
</script>

<script lang="ts">
	// The 8x8 cluster-drop board. Every tile here is a position in stateGame.cells, and every move
	// those cells make was written by a book event (game/bookEventHandlerMap.ts). This component
	// draws; it decides nothing.
	import { Sprite, Rectangle } from 'pixi-svelte';
	import { stateBet } from 'state-shared';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, CELL_FILL, GRID, TILE, reelOf, rowOf } from '../game/constants';
	import { playBookEvents } from '../game/utils';
	import type { BookEvent } from '../game/typesBookEvent';
	import BoardContainer from './BoardContainer.svelte';
	import ArtAmount from './ArtAmount.svelte';
	import Anticipation from './Anticipation.svelte';
	import Sting from './Sting.svelte';

	const context = getContext();
	const stateGame = context.stateGame;

	let show = $state(true);

	context.eventEmitter.subscribeOnMount({
		boardShow: () => (show = true),
		boardHide: () => (show = false),
		featureBeat: () => {},
		stingBeat: () => {},
	});

	/** blend white towards a flash colour by `k` — cheaper than a filter and batches with the rest */
	const lerpTint = (color: number, k: number) => {
		if (k <= 0) return 0xffffff;
		const r = Math.round(255 + (((color >> 16) & 0xff) - 255) * k);
		const g = Math.round(255 + (((color >> 8) & 0xff) - 255) * k);
		const b = Math.round(255 + ((color & 0xff) - 255) * k);
		return (r << 16) | (g << 8) | b;
	};

	const layout = $derived(context.stateGameDerived.boardLayout());

	// DEV ONLY: the Playwright gates read the game through this, never through Pixi canvas text.
	// Merged, not assigned — game/deviceTier.ts writes assetTier onto the same object and mount
	// order is not guaranteed. A production bundle must not carry a hook on window.
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		Object.assign(((window as any).__manticore ??= {}), {
			/** the round's choreography has finished and the board is standing still */
			atRest: () => !stateGame.busy && !stateGame.readouts.length,
			/** the game actor is back at idle — i.e. no round is in flight at all. A harness must
			 *  wait for this as well as atRest: atRest is true in the gap between pressing spin and
			 *  the first reveal landing, which is not the same thing as a finished round. */
			idle: () => context.stateXstateDerived.isIdle(),
			gameType: () => stateGame.gameType,
			bonusMode: () => stateGame.bonusMode,
			/** board[reel][row] of symbol names, exactly how the book addresses it */
			board: () => context.stateGameDerived.boardRaw(),
			/** the live multiplier grid, cellIndex -> value */
			tiles: () => context.stateGameDerived.tilesRaw(),
			/** THE AT-REST INVARIANT: one sprite per occupied cell, every sprite on its grid
			 *  position, no orphans, no leftovers mid-animation. { ok, count, problems[] } */
			invariant: () => context.stateGameDerived.boardInvariant(),
			/** every sprite, for diagnosing a broken board */
			cells: () => stateGame.cells.map((c) => ({ id: c.id, name: c.name, reel: c.reel, row: c.row, y: Number(c.y.toFixed(3)), a: Number(c.alpha.toFixed(2)), s: c.state })),
			/** > 0 while a press-to-continue gate is up, so a harness can press through */
			pressGates: () => stateGame.pressGates,
			fs: () => ({ current: stateGame.fs, total: stateGame.totalFs }),
			spinWin: () => stateGame.spinWin,
			winShowing: () => stateGame.winShowing,
			turbo: () => ({ level: stateGame.turboLevel, base: stateGame.baseTurboLevel }),
			emit: (event: any) => context.eventEmitter.broadcast(event),
			/** arm a bet mode by its RGS key (BASE / ANTE / SUPER_ANTE / BONUS / SUPER / EPIC / MYSTERY) */
			setMode: (key: string) => (stateBet.activeBetModeKey = key),
			mode: () => stateBet.activeBetModeKey,
			/** the round's win as the frontend has it, in book units (100 = 1x bet) */
			winAmount: () => stateBet.winBookEventAmount,
			assetKeys: () => Object.keys(context.stateApp.loadedAssets ?? {}),
			/** scatters counted this spin, the stung-in ones included */
			scatters: () => [...stateGame.scatterCells],
			/** the per-column Mystery tease, as the board engine has it */
			anticipation: () => stateGame.anticipation.map((a) => ({ on: a.on, q: Number(a.q.toFixed(2)) })),
			/** the Mystery outcome of the round being played, null outside a Mystery book */
			mysteryOutcome: () => stateGame.mysteryOutcome,
			/** PLAY A SYNTHETIC BOOK: run an array of book events through the same handler map the
			 *  RGS's own books go through (game/utils.ts playBookEvents), so a sequence the mock RGS
			 *  cannot serve yet can still be rehearsed end to end. Resolves when the last event has
			 *  finished and the board is back at rest. */
			playEvents: async (bookEvents: BookEvent[]) => {
				stateGame.busy = true;
				try {
					await playBookEvents(bookEvents);
				} finally {
					context.stateGameDerived.settleBoard();
					stateGame.busy = false;
				}
				return context.stateGameDerived.boardInvariant();
			},
		});
	}
	const size = SYMBOL_SIZE * CELL_FILL;
	const tileSize = SYMBOL_SIZE * TILE.size;
</script>

{#if show}
	<BoardContainer>
		<!-- the board window: a tile falling in from above is clipped until it enters the grid -->
		<Rectangle isMask width={layout.width} height={layout.height} />
		<Sprite key="boardBackdrop" zIndex={-2} width={layout.width} height={layout.height} />

		{#each stateGame.cells as cell (cell.id)}
			<Sprite
				key="{cell.name}.png"
				x={(cell.reel + 0.5) * SYMBOL_SIZE}
				y={(cell.y + 0.5) * SYMBOL_SIZE}
				anchor={0.5}
				width={size * cell.scaleX}
				height={size * cell.scaleY}
				alpha={cell.alpha}
				tint={lerpTint(cell.flashColor, cell.flash)}
				zIndex={cell.state === 'win' ? 10 : cell.state === 'removing' ? 8 : 0}
			/>
		{/each}

		<!-- multiplier tiles: they belong to the CELL, not to the symbol, so they never move -->
		{#each stateGame.tiles as tile, index (index)}
			{#if tile.value}
				<Sprite
					key="x{tile.value}.png"
					x={(reelOf(index) + 0.5 + TILE.offset.x) * SYMBOL_SIZE}
					y={(rowOf(index) + 0.5 + TILE.offset.y) * SYMBOL_SIZE}
					anchor={0.5}
					width={tileSize * tile.scale}
					height={tileSize * tile.scale}
					zIndex={20}
				/>
			{/if}
		{/each}

		<!-- the Mystery column tease and the sting rig slot: both always mounted, both board-space -->
		<Anticipation />
		<Sting />

		<!-- the pay-times-sum readout of the cluster being presented -->
		{#each stateGame.readouts as readout (readout.id)}
			<ArtAmount
				text={readout.text}
				height={SYMBOL_SIZE * 0.42 * readout.scale}
				x={readout.x}
				y={readout.y}
				maxWidth={SYMBOL_SIZE * (GRID - 0.5)}
				alpha={readout.alpha}
				shadow={{ dx: 0.05, dy: 0.06, tint: 0x0a0b0d }}
			/>
		{/each}
	</BoardContainer>
{/if}
