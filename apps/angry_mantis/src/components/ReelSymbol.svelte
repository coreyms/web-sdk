<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { BaseSprite, Container, Graphics, Sprite } from 'pixi-svelte';
	import { stateBetDerived } from 'state-shared';

	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { SYMBOL_SIZE, CELL_FILL, BOARD_DIMENSIONS, HIGH_LAND, GRAVITY_DROP, TIMINGS } from '../game/constants';
	import { glintTexture, GLINT_TEX_W, GLINT_CORE } from '../game/glintTexture';
	import { dustFrames, DUST_SHEET } from '../game/dustTexture';
	import { getContext } from '../game/context';
	import { isAnteLockedSymbol, upcomingEats, stateGame, type ReelSymbol } from '../game/stateGame.svelte';

	type Props = {
		reelIndex: number;
		reelSymbol: ReelSymbol;
	};

	const props: Props = $props();
	const context = getContext();
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

	// Landing beat, kicked from the 'land' → 'static' hand-off below, which fires exactly once per
	// landing, at first contact. Every visible cell gets the gravity-drop beat (GRAVITY_DROP): a
	// wide-and-short squash on contact, a smaller overshoot the other way, and a dust puff from the
	// tile's bottom edge. High symbols then add their tray thump + glint (HIGH_LAND) once the
	// gravity settle is over. Progress is driven by rAF into one $state so the squash container,
	// the dust sprites and the glint Graphics redraw together; nothing here touches the symbol's
	// position, so the drift gate still sees the cell exactly where the reel put it.
	const tileSize = SYMBOL_SIZE * CELL_FILL;
	// `name` is the symbol that LANDED: BoardBase's symbol list is unkeyed, so on the next spin this
	// component is reused for whatever tile fills the cell, and a beat still running would otherwise
	// glint with the new name (a W/GL there asked for W_insect.png — no such frame, console error
	// on every fast free spin that followed a high-symbol landing; found 2026-09-09).
	let beat = $state<{ name: string; gs: number; dust: number; sq: number; gl: number } | null>(null);
	let beatRaf = 0;
	const startLandBeat = () => {
		const row = props.reelSymbol.symbolIndexOfBoard;
		if (row < 0 || row >= BOARD_DIMENSIONS.y) return;
		const name = props.reelSymbol.rawSymbol.name;
		const high = HIGH_LAND.symbols.includes(name);
		if (high) devCount('highLandings');
		const opts = stateGame.board[props.reelIndex].reelState.spinOptions();
		const settleMs = (SYMBOL_SIZE * opts.symbolFallInBounceSizeMulti) / opts.symbolFallInBounceSpeed;
		const ts = stateBetDerived.timeScale();
		const gsMs = (GRAVITY_DROP.squashMs + GRAVITY_DROP.settleMs) / ts;
		const dustMs = GRAVITY_DROP.dustMs / ts;
		const sqMs = TIMINGS.highLandSquash / ts;
		const glMs = TIMINGS.highLandGlint / ts;
		const highMs = high ? gsMs + Math.max(sqMs, glMs) : 0;
		const t0 = performance.now() + settleMs;
		cancelAnimationFrame(beatRaf);
		const step = (now: number) => {
			const t = now - t0;
			if (t >= Math.max(gsMs, dustMs, highMs)) {
				beat = null;
				beatRaf = 0;
				return;
			}
			if (t >= 0) {
				const th = t - gsMs;
				beat = {
					name,
					gs: Math.min(1, t / gsMs),
					dust: Math.min(1, t / dustMs),
					sq: high && th >= 0 ? Math.min(1, th / sqMs) : 1,
					gl: high && th >= 0 ? Math.min(1, th / glMs) : 1,
				};
			}
			beatRaf = requestAnimationFrame(step);
		};
		beatRaf = requestAnimationFrame(step);
	};
	$effect(() => () => cancelAnimationFrame(beatRaf));
	// a new symbol object in this cell (the next spin's board) ends any beat the old one left running
	$effect(() => {
		void props.reelSymbol;
		return () => {
			cancelAnimationFrame(beatRaf);
			beatRaf = 0;
			beat = null;
		};
	});
	const easeOut = (p: number) => 1 - (1 - p) ** 3;
	// gravity squash: sin bump of `squash` over the first squashMs, then a smaller inverse bump
	const gravitySquash = (gs: number) => {
		const split = GRAVITY_DROP.squashMs / (GRAVITY_DROP.squashMs + GRAVITY_DROP.settleMs);
		if (gs < split) return Math.sin(Math.PI * (gs / split)) * GRAVITY_DROP.squash;
		return -Math.sin(Math.PI * ((gs - split) / (1 - split))) * GRAVITY_DROP.squash * GRAVITY_DROP.settleRatio;
	};
	const squash = $derived.by(() => {
		if (!beat) return { x: 1, y: 1 };
		const g = beat.gs < 1 ? gravitySquash(beat.gs) : 0;
		const h = beat.sq < 1 ? 1 - easeOut(beat.sq) : 0;
		return { x: (1 + g) * (1 + HIGH_LAND.squashX * h), y: (1 - g) * (1 - HIGH_LAND.squashY * h) };
	});
	// dust: one frame of Corey's sheet per sixth of dustMs, bottom-centre on the tile's lower edge
	// (the frame's own transparent margin hangs below it), fading through the last third
	const dust = $derived.by(() => {
		if (!beat || beat.dust >= 1) return null;
		const frames = dustFrames(context.stateApp.loadedAssets?.dustPoof as PIXI.Texture | undefined);
		if (!frames.length) return null;
		const age = beat.dust;
		const w = tileSize * GRAVITY_DROP.dustWidth;
		const h = (w * DUST_SHEET.frameH) / DUST_SHEET.frameW;
		const fade = age < GRAVITY_DROP.dustFadeFrom ? 1 : (1 - age) / (1 - GRAVITY_DROP.dustFadeFrom);
		return {
			texture: frames[Math.min(frames.length - 1, Math.floor(age * frames.length))],
			w,
			h,
			y: tileSize / 2 + h * (1 - DUST_SHEET.contentBottom) + tileSize * GRAVITY_DROP.dustY,
			alpha: fade * GRAVITY_DROP.dustAlpha,
		};
	});
	const showGlint = $derived(beat !== null && beat.gl < 1);
	// DEV: __angryMantis.landBeat counts high-symbol landings vs glint frames actually drawn, so a
	// harness can prove the beat still fires (screenshots cannot catch a 320 ms sweep headless)
	const devCount = (key: 'highLandings' | 'glintFrames') => {
		if (!import.meta.env.DEV || typeof window === 'undefined') return;
		const am = ((window as any).__angryMantis ??= {});
		am.landBeat ??= { highLandings: 0, glintFrames: 0 };
		am.landBeat[key] += 1;
	};
	// the tray silhouette, filled with the shared gradient strip. 'global' texture space: the
	// fill matrix maps TEXELS to local pixels, so it centres the strip's bright core on the
	// origin, scales it to glintWidth of the tile, tilts it, and slides it from beyond the left
	// edge to beyond the right (verified on the live stage 2026-09-05; the default 'local' space
	// first fits the texture to the shape's bounds and the sweep never lands where expected)
	// Two contexts, alternated per frame: a clear()+redraw on ONE context leaves the texture
	// fill's UVs at the first build in the live scene (verified 2026-09-05: the strip never moved
	// on-screen while an extract of the node alone showed it sweeping); swapping the context
	// forces the batch to rebuild. Pixi's `context` setter does NOT destroy the previous context,
	// so allocating a new one per frame leaked ~20 contexts (and their GPU batches) per landing
	// (chaos soak heap +23 MB, review 2026-09-05) — hence the pair, destroyed with the component.
	const glintCtx = [new PIXI.GraphicsContext(), new PIXI.GraphicsContext()];
	let glintFlip = 0;
	$effect(() => () => glintCtx.forEach((c) => c.destroy()));
	const drawGlint = (g: PIXI.Graphics) => {
		devCount('glintFrames');
		if (!beat || beat.gl >= 1) return;
		glintFlip ^= 1;
		g.context = glintCtx[glintFlip];
		g.clear();
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
	<Container scale={squash} rotation={props.reelSymbol.symbolRot.current}>
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
		{#if showGlint}
			<!-- glint clipped to the tray shape, then the bug redrawn over it so the light never crosses it -->
			<Graphics draw={drawGlint} />
			<Sprite anchor={0.5} key="{beat?.name}_insect.png" width={tileSize} height={tileSize} />
		{/if}
	</Container>
	{#if dust}
		<!-- landing dust, outside the squash container so it blooms while the tile compresses -->
		<BaseSprite texture={dust.texture} anchor={{ x: 0.5, y: 1 }} y={dust.y} width={dust.w} height={dust.h} alpha={dust.alpha} />
	{/if}
	{#if insectOnLeaf}
		<Sprite anchor={0.5} key="{insectOnLeaf}_insect.png" width={SYMBOL_SIZE * CELL_FILL} height={SYMBOL_SIZE * CELL_FILL} />
	{/if}
</SymbolWrap>
