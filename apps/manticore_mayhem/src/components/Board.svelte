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
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { layoutKind } from '../game/layoutSpec';
	import { SYMBOL_SIZE, GRID, CLUSTER, READOUT } from '../game/constants';
	import { playBookEvents } from '../game/utils';
	import { sparkleStats, motionLog } from '../game/sparkles';
	import type { BookEvent } from '../game/typesBookEvent';
	import BoardContainer from './BoardContainer.svelte';
	import ArtAmount from './ArtAmount.svelte';
	import Anticipation from './Anticipation.svelte';
	import Sting from './Sting.svelte';
	import ClawSwipe from './ClawSwipe.svelte';
	import { fxLog, boardKick, swipeFx } from '../game/featureFx';
	import BoardCells from './BoardCells.svelte';
	import { revealTease, plateLog } from '../game/stateGame.svelte';

	const context = getContext();
	const stateGame = context.stateGame;

	let show = $state(true);

	// DEV probe log of every sting beat this page has played (bounded); plain JS, never rendered
	const stingLog: { phase: string; kind: StingKind; center: number; at: number }[] = [];

	context.eventEmitter.subscribeOnMount({
		boardShow: () => (show = true),
		boardHide: () => (show = false),
		featureBeat: () => {},
		stingBeat: ({ phase, kind, center }) => {
			if (!import.meta.env.DEV) return;
			stingLog.push({ phase, kind, center, at: performance.now() });
			if (stingLog.length > 400) stingLog.splice(0, stingLog.length - 400);
		},
	});

	const layout = $derived(context.stateGameDerived.boardLayout());
	/** this layout's frame art is loaded (BoardFrame.svelte draws it): the backdrop steps aside */
	const frameArtIn = $derived(
		!!(context.stateApp.loadedAssets as Record<string, unknown> | undefined)?.[`boardFrame_${layoutKind(context.stateLayoutDerived.layoutType())}`],
	);

	// DEV ONLY: the Playwright gates read the game through this, never through Pixi canvas text.
	// Merged, not assigned — game/deviceTier.ts writes assetTier onto the same object and mount
	// order is not guaranteed. A production bundle must not carry a hook on window.
	const beatLog: { t: number; type: string; detail?: string }[] = [];
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		// record every broadcast (type + a short detail) so a frame-time probe can say which beat a
		// hitch landed in; bounded ring, DEV only
		const broadcast = context.eventEmitter.broadcast;
		context.eventEmitter.broadcast = ((event: any) => {
			const detail = event?.name ?? event?.phase ?? event?.beat ?? undefined;
			beatLog.push({ t: performance.now(), type: event?.type, detail: detail ? String(detail) : undefined });
			if (beatLog.length > 200) beatLog.splice(0, 100);
			return broadcast(event);
		}) as typeof broadcast;
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
			cells: () => stateGame.cells.map((c) => ({ id: c.id, name: c.name, reel: c.reel, row: c.row, y: Number(c.y.toFixed(3)), a: Number(c.alpha.toFixed(2)), d: Number(c.dim.toFixed(3)), sx: Number(c.scaleX.toFixed(3)), g: Number(c.glow.toFixed(2)), s: c.state })),
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
			/** the per-column tease (the Mystery's or the derived one), as the board engine has it */
			anticipation: () => stateGame.anticipation.map((a) => ({ on: a.on, q: Number(a.q.toFixed(2)), tease: a.tease, fade: Number(a.fade.toFixed(3)), rainFade: Number(a.rainFade.toFixed(3)), rain: Number(a.rain.toFixed(3)), el: Math.round(a.el) })),
			/** the last reveal's derived scatter tease (ANTICIPATION_TEASE): plan in style ms, the drop's real-time origin and rate */
			tease: () => JSON.parse(JSON.stringify(revealTease)),
			/** the derived tease a board would get (presentation only, read off the board) */
			planTease: (board: any) => context.stateGameDerived.planTease(board),
			/** the plates' live state (value, the count-over's from / progress, the pop) and every plate change played */
			platesState: () => context.stateGameDerived.platesRaw(),
			plateLog: () => plateLog.slice(),
			/** every sting beat played on this page, oldest first: { phase, kind, center, at } */
			stings: () => stingLog.slice(),
			/** the Mystery outcome of the round being played, null outside a Mystery book */
			mysteryOutcome: () => stateGame.mysteryOutcome,
			/** press SKIP TO RESULT (stateGameDerived.requestSkip): true if the press took */
			skip: () => context.stateGameDerived.requestSkip(),
			/** the ONE way to set the live turbo level (0 / 1 / 2), for the motion probe's timeScale runs */
			setTurbo: (level: 0 | 1 | 2) => context.stateGameDerived.setTurboLevel(level),
			/** a book amount as the readouts print it, so a probe can compare canvas text it cannot read */
			fmt: (amount: number) => bookEventAmountToCurrencyString(Math.round(amount)),
			/** the Pixi application (perf probe: texture / renderer counters) */
			pixi: () => context.stateApp.pixiApplication,
			/** the last emitter events with their performance.now() stamps, newest last (perf probe
			 *  phase attribution: a hitch is tagged with the beat that was playing) */
			beats: (n = 8) => beatLog.slice(-n),
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
		// FEATURE FX probe (tools/manticore/fx_probe.js): every swipe / sting / roar's phase stamps
		// (performance.now()), the live kick offset and swipe state
		Object.defineProperty((window as any).__manticore, 'fx', {
			get: () => ({
				records: fxLog.records.map((r) => ({ kind: r.kind, at: { ...r.at }, info: r.info })),
				kick: { x: boardKick.x, y: boardKick.y },
				swipe: { active: swipeFx.active, el: swipeFx.el, alpha: swipeFx.alpha, rows: swipeFx.rows.slice() },
			}),
			configurable: true,
			enumerable: true,
		});
		Object.assign((window as any).__manticore, {
			/** end a skip a synthetic book started (playEvents has no bonusEnd to clear it) */
			endSkip: () => context.stateGameDerived.finishSkip(),
		});
		// a live getter (not a function like the rest): `__manticore.skipping` reads the flag itself
		Object.defineProperty((window as any).__manticore, 'skipping', {
			get: () => stateGame.skipping,
			configurable: true,
			enumerable: true,
		});
		// MOTION PASS 1 probe: the live counts (sparkle pool in use / bound / peak, frames over budget
		// since boot, the last cascade's removal bookkeeping, every readout up right now with its mode
		// and text, every cell's alpha / glow / state)
		Object.defineProperty((window as any).__manticore, 'motion', {
			get: () => ({
				sparkles: { ...sparkleStats },
				frames: motionLog.frames,
				framesOver50: motionLog.framesOver50,
				framesOver33: motionLog.framesOver33,
				worstMs: Math.round(motionLog.worstMs),
				glow: { inUse: motionLog.glowInUse, peak: motionLog.glowPeak },
				lastCascade: motionLog.lastCascade,
				cascadeIndex: motionLog.cascadeIndex,
				steps: motionLog.steps.slice(),
				readouts: stateGame.readouts.map((r) => ({ id: r.id, mode: r.mode, text: r.text, amount: r.amount, mult: r.mult, alpha: Number(r.alpha.toFixed(2)), scale: Number(r.scale.toFixed(3)), gap: Number((r.multX - r.amountX).toFixed(1)) })),
				cells: stateGame.cells.map((c) => ({ i: c.reel * 8 + c.row, a: Number(c.alpha.toFixed(2)), d: Number(c.dim.toFixed(3)), g: Number(c.glow.toFixed(2)), s: c.state, sx: Number(c.scaleX.toFixed(3)), y: Number(c.y.toFixed(3)) })),
				spinWin: stateGame.spinWin,
			}),
			configurable: true,
			enumerable: true,
		});
	}
</script>

{#if show}
	<BoardContainer>
		<!-- the board window: a tile falling in from above is clipped until it enters the grid -->
		<Rectangle isMask width={layout.width} height={layout.height} />
		<!-- the old cell wells: the PRE-LOAD FALLBACK only. Once this layout's frame art is in, its steel
		     lattice (BoardFrame.svelte, under this container, over the black backing) is the cell grid
		     and this must not paint over it -->
		<Sprite key="boardBackdrop" label="boardBackdrop" zIndex={-2} width={layout.width} height={layout.height} visible={!frameArtIn} />

		<!-- the 64 tiles and the multiplier badges: raw pooled Pixi sprites synced from the ticker
		     (BoardCells.svelte says why they are not one pixi-svelte <Sprite> each any more) -->
		<BoardCells />

		<!-- the Mystery column tease and the sting rig slot: both always mounted, both board-space -->
		<Anticipation />
		<Sting />
		<!-- the claw swipe's tears (z 21), the roar's cell flashes (z -0.5) and the board kick -->
		<ClawSwipe />

		<!-- the cluster readouts (several at once in sequence mode): the raw "amount  xmult" pair that
		     slams together, then the merged amount that punches and counts up in place. All three
		     rows of a readout stay mounted while it is up; the mode picks which are visible. -->
		{#each stateGame.readouts as readout (readout.id)}
			<ArtAmount
				text={readout.amount}
				height={SYMBOL_SIZE * CLUSTER.readoutHeight}
				x={readout.amountX}
				y={readout.y}
				alpha={readout.mode === 'raw' ? readout.alpha : 0}
				tint={READOUT.amountTint}
				shadow={{ dx: 0.05, dy: 0.06, tint: 0x0a0b0d }}
			/>
			<ArtAmount
				text={readout.mult}
				height={SYMBOL_SIZE * CLUSTER.readoutHeight}
				x={readout.multX}
				y={readout.y}
				alpha={readout.mode === 'raw' ? readout.alpha : 0}
				tint={READOUT.multTint}
				shadow={{ dx: 0.05, dy: 0.06, tint: 0x0a0b0d }}
			/>
			<ArtAmount
				text={readout.text}
				height={SYMBOL_SIZE * CLUSTER.readoutHeight}
				x={readout.x}
				y={readout.y}
				maxWidth={SYMBOL_SIZE * (GRID - 0.5)}
				alpha={readout.mode === 'merged' ? readout.alpha : 0}
				scale={readout.scale}
				tint={READOUT.amountTint}
				shadow={{ dx: 0.05, dy: 0.06, tint: 0x0a0b0d }}
			/>
		{/each}
	</BoardContainer>
{/if}
