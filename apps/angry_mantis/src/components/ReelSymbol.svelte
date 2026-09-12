<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { BaseSprite, Container, Graphics, Sprite } from 'pixi-svelte';
	import { stateBetDerived } from 'state-shared';

	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { SYMBOL_SIZE, CELL_FILL, BOARD_DIMENSIONS, HIGH_LAND, GRAVITY_DROP, SCATTER_LAND, TIMINGS } from '../game/constants';
	import { glintTexture, GLINT_TEX_W, GLINT_CORE } from '../game/glintTexture';
	import { dustFrames, DUST_SHEET } from '../game/dustTexture';
	import { getContext } from '../game/context';
	import { isAnteLockedSymbol, stateGame, stateGameDerived, type ReelSymbol } from '../game/stateGame.svelte';
	import { bellPose } from '../game/bell';
	import { BELL_GLOW, bellGlowPose, bellHaloTexture, bellRaysTexture } from '../game/bellGlow';
	import SymbolPose from './SymbolPose.svelte';
	import { playPose, poseKey, poseRuns } from '../game/symbolPoses.svelte';

	type Props = {
		reelIndex: number;
		reelSymbol: ReelSymbol;
	};

	const props: Props = $props();
	const context = getContext();
	const symbolInfo = $derived(
		getSymbolInfo({ rawSymbol: props.reelSymbol.rawSymbol, state: props.reelSymbol.symbolState }),
	);

	// Service Bell ring: the bell a strike is answering rings IN PLACE while Mantis.svelte brings
	// the tray in (pendingStrikePos is board-space, set at the strike event and cleared at the eat).
	// Frames play once over TIMINGS.ring, unscaled — Mantis waits the same raw span (game/bell.ts).
	const ringing = $derived(
		props.reelSymbol.rawSymbol.name === 'GL' &&
			stateGame.pendingStrikePos !== null &&
			stateGame.pendingStrikePos.reel === props.reelIndex &&
			stateGame.pendingStrikePos.row === props.reelSymbol.symbolIndexOfBoard,
	);
	let ring = $state<number | null>(null);
	let ringRaf = 0;
	$effect(() => {
		if (!ringing) return;
		const t0 = performance.now();
		cancelAnimationFrame(ringRaf);
		const step = (now: number) => {
			const p = (now - t0) / TIMINGS.ring;
			if (p >= 1) {
				ring = null;
				ringRaf = 0;
				return;
			}
			ring = p;
			ringRaf = requestAnimationFrame(step);
		};
		ringRaf = requestAnimationFrame(step);
		return () => {
			cancelAnimationFrame(ringRaf);
			ringRaf = 0;
			ring = null;
		};
	});

	// Service Bell tile glow: the hero's halo + ray wheel (bellGlow.ts) live under a resting bell
	// tile, additive, breathing and slowly turning. One rAF per bell on the board.
	const isBellTile = $derived(props.reelSymbol.rawSymbol.name === 'GL' && props.reelSymbol.symbolIndexOfBoard >= 0 && props.reelSymbol.symbolIndexOfBoard < BOARD_DIMENSIONS.y);
	let glowT = $state(0);
	let glowRaf = 0;
	$effect(() => {
		if (!isBellTile) {
			cancelAnimationFrame(glowRaf);
			glowRaf = 0;
			glowT = 0;
			return;
		}
		const t0 = performance.now() - Math.random() * 3000; // bells on one board don't breathe in lockstep
		const step = (now: number) => {
			glowT = now - t0;
			glowRaf = requestAnimationFrame(step);
		};
		glowRaf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(glowRaf);
	});
	const tileGlow = $derived(bellGlowPose(glowT, null));

	// winFocus rows are in symbols[] index space (padding included): symbolIndexOfBoard = row - 1
	// a lit scatter never dims — a triggering spin can carry line wins whose focus dim would
	// otherwise grey the set between the wrap-up sweep and the trigger's grow
	const litScatter = $derived(stateGame.scatterSet !== null && props.reelSymbol.rawSymbol.name === 'S');
	const dim = $derived(
		(stateGame.winFocus !== null &&
			!litScatter &&
			!stateGame.winFocus.some(
				(p) => p.reel === props.reelIndex && p.row - 1 === props.reelSymbol.symbolIndexOfBoard,
			)) ||
			// lights down (SCATTER_LAND): from the third scatter until the trigger's grow, every
			// non-scatter tile sits at the win-focus dim so the scatters are the only lit things
			(stateGame.scatterSet !== null && props.reelSymbol.rawSymbol.name !== 'S'),
	);

	// Scatter arrival (SCATTER_LAND): the strip lands with this cell EMPTY — the reel's own tile
	// hides while ScatterDrop.svelte slaps the card down above the frame — and the scatter's real
	// landing beat starts on the frame the drop is done (scatterDropDone → scatterContact).
	const isVisibleRow = $derived(props.reelSymbol.symbolIndexOfBoard >= 0 && props.reelSymbol.symbolIndexOfBoard < BOARD_DIMENSIONS.y);
	const presenting = $derived(
		stateGame.scatterDrops.some((p) => p.reel === props.reelIndex && p.row === props.reelSymbol.symbolIndexOfBoard),
	);
	// the reel's scatter tile is never seen in the strip: hidden from the fall-in through the slap
	// (it rode the strip down, vanished at contact and slapped back in — Corey 2026-09-11). The
	// ante-held scatter is exempt: its reel's other rows fall while it stays put.
	const hiddenForSlap = $derived(
		props.reelSymbol.rawSymbol.name === 'S' &&
			isVisibleRow &&
			!isAnteLockedSymbol(props.reelIndex, props.reelSymbol.symbolIndexOfBoard) &&
			(presenting || stateGame.board[props.reelIndex].reelState.motion === 'fallingIn'),
	);
	let wasPresenting = false;
	$effect(() => {
		const now = presenting;
		if (wasPresenting && !now && props.reelSymbol.rawSymbol.name === 'S') startLandBeat(true);
		wasPresenting = now;
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
	let beat = $state<{ name: string; gs: number; dust: number; sq: number; gl: number; sc: boolean; fl: number } | null>(null);
	let beatRaf = 0;
	// scatter = the card has just been slapped down (no settle wait: the drop IS the contact;
	// heavier slam, white card flash, wider dust — SCATTER_LAND)
	const startLandBeat = (scatter = false) => {
		const row = props.reelSymbol.symbolIndexOfBoard;
		if (row < 0 || row >= BOARD_DIMENSIONS.y) return;
		const name = props.reelSymbol.rawSymbol.name;
		const high = HIGH_LAND.symbols.includes(name);
		if (high) devCount('highLandings');
		// per-insect landing pose (SYMBOL_POSES): a short burst of the symbol's land clip on the same
		// beat as the squash. No-ops for an insect without a sheet, or before the sheet is in.
		playPose(props.reelIndex, row, name, 'land');
		const opts = stateGame.board[props.reelIndex].reelState.spinOptions();
		const settleMs = scatter ? 0 : (SYMBOL_SIZE * opts.symbolFallInBounceSizeMulti) / opts.symbolFallInBounceSpeed;
		const ts = stateBetDerived.timeScale();
		const gsMs = (GRAVITY_DROP.squashMs + GRAVITY_DROP.settleMs) / ts;
		const dustMs = GRAVITY_DROP.dustMs / ts;
		const sqMs = TIMINGS.highLandSquash / ts;
		const glMs = TIMINGS.highLandGlint / ts;
		const flMs = scatter ? TIMINGS.scatterFlash / ts : 0;
		const highMs = high ? gsMs + Math.max(sqMs, glMs) : 0;
		const t0 = performance.now() + settleMs;
		cancelAnimationFrame(beatRaf);
		const step = (now: number) => {
			const t = now - t0;
			if (t >= Math.max(gsMs, dustMs, highMs, flMs)) {
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
					sc: scatter,
					fl: scatter ? Math.min(1, t / flMs) : 1,
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
		const lift = fx.lift * grow;
		if (!beat) return { x: lift, y: lift };
		const g = beat.gs < 1 ? gravitySquash(beat.gs) : 0;
		const h = beat.sq < 1 ? 1 - easeOut(beat.sq) : 0;
		// the scatter slam rides the gravity bump: same curve, SCATTER_LAND.squash* on top
		const gx = beat.sc ? g * (1 + SCATTER_LAND.squashX / GRAVITY_DROP.squash) : g;
		const gy = beat.sc ? g * (1 + SCATTER_LAND.squashY / GRAVITY_DROP.squash) : g;
		return { x: (1 + gx) * (1 + HIGH_LAND.squashX * h) * lift, y: (1 - gy) * (1 - HIGH_LAND.squashY * h) * lift };
	});
	// dust: one frame of Corey's sheet per sixth of dustMs, bottom-centre on the tile's lower edge
	// (the frame's own transparent margin hangs below it), fading through the last third
	const dust = $derived.by(() => {
		if (!beat || beat.dust >= 1) return null;
		const frames = dustFrames(context.stateApp.loadedAssets?.dustPoof as PIXI.Texture | undefined);
		if (!frames.length) return null;
		const age = beat.dust;
		const w = tileSize * (beat.sc ? SCATTER_LAND.dustWidth : GRAVITY_DROP.dustWidth);
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
	// a pose running in this cell (SYMBOL_POSES): SymbolPose draws plate + shadow + the moving
	// insect, so the baked tile hides and the tray glint sits this landing out (its overlay is the
	// STILL cutout, which would freeze over a bug that is moving). Only high symbols glint, and
	// none of them has a pose sheet yet.
	const posing = $derived(Boolean(poseRuns[poseKey(props.reelIndex, props.reelSymbol.symbolIndexOfBoard)]));
	const showGlint = $derived(beat !== null && beat.gl < 1 && !posing);

	// ---- the lit set (SCATTER_LAND, 3rd scatter and up) ----
	// One rAF per member cell while stateGame.scatterSet is up: the hot rim (breathing from the
	// first hit until the sweep reaches this card), the lift + warm wash on a card that landed as a
	// 3rd+, the card flash on every hit, the link flash that puts the card out, and the accent.
	// All of it is alpha/scale on always-mounted nodes; nothing is redrawn per frame.
	let fx = $state({ rim: 0, lit: 0, flash: 0, lift: 1 });
	let fxRaf = 0;
	let rimFrom = 0; // when this card joined the set (its own first hit)
	const member = $derived.by(() => {
		const set = stateGame.scatterSet;
		if (!set) return null;
		const i = set.order.findIndex((p) => p.reel === props.reelIndex && p.row === props.reelSymbol.symbolIndexOfBoard);
		return i < 0 ? null : { i, lift: set.order[i].lift, set };
	});
	$effect(() => {
		const m = member;
		cancelAnimationFrame(fxRaf);
		fxRaf = 0;
		if (!m || props.reelSymbol.rawSymbol.name !== 'S') {
			fx = { rim: 0, lit: 0, flash: 0, lift: 1 };
			rimFrom = 0;
			return;
		}
		const ts = stateBetDerived.timeScale();
		const flashMs = TIMINGS.scatterFlash / ts;
		const sweepFlashMs = SCATTER_LAND.sweepFlashMs / ts;
		const step = (now: number) => {
			const set = m.set;
			if (!rimFrom) rimFrom = set.hitAt;
			const off = set.sweepAt === null ? Infinity : set.sweepAt + (m.i * SCATTER_LAND.sweepStaggerMs) / ts;
			const breath = Math.sin((now - rimFrom) / (SCATTER_LAND.rimPeriodMs / ts));
			const out = now >= off;
			const ramp = Math.min(1, (now - rimFrom) / (SCATTER_LAND.rimRampMs / ts));
			const rim = out ? 0 : ramp * (0.55 + 0.35 * breath);
			let lift = 1;
			let lit = 0;
			if (m.lift && !out) {
				const q = Math.min(1, Math.max(0, (now - rimFrom - SCATTER_LAND.holdDelayMs / ts) / (SCATTER_LAND.holdMs / ts)));
				lift = 1 + (SCATTER_LAND.holdScale - 1) * easeOut(q);
				lit = SCATTER_LAND.litAlpha + 0.08 * breath;
			}
			let flash = 0;
			const hit = (now - set.hitAt) / flashMs;
			if (hit >= 0 && hit < 1) flash = SCATTER_LAND.flashAlpha * (1 - hit);
			const link = (now - off) / sweepFlashMs;
			if (link >= 0 && link < 1) flash = Math.max(flash, 0.6 * (1 - link));
			const accent = set.accentAt === null ? -1 : (now - set.accentAt) / sweepFlashMs;
			if (accent >= 0 && accent < 1) flash = Math.max(flash, SCATTER_LAND.flashAlpha * (1 - accent));
			fx = { rim, lit, flash, lift };
			// everything is out and the accent has faded: nothing left to animate until the set clears
			if (out && accent >= 1) {
				fxRaf = 0;
				return;
			}
			fxRaf = requestAnimationFrame(step);
		};
		fxRaf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(fxRaf);
	});
	// the trigger's grow (SCATTER_LAND.grow*): up to growScale over growMs, then a slow breath
	// around it until the door has closed (stateGame.scatterGrowAt is cleared with the set)
	let grow = $state(1);
	let growRaf = 0;
	$effect(() => {
		const at = stateGame.scatterGrowAt;
		cancelAnimationFrame(growRaf);
		growRaf = 0;
		if (!at || props.reelSymbol.rawSymbol.name !== 'S' || !isVisibleRow) {
			grow = 1;
			return;
		}
		const ts = stateBetDerived.timeScale();
		const upMs = SCATTER_LAND.growMs / ts;
		const step = (now: number) => {
			const t = now - at;
			const up = easeOut(Math.min(1, Math.max(0, t / upMs)));
			const breath = t > upMs ? Math.sin(((t - upMs) / 1000) * 2 * Math.PI * SCATTER_LAND.breathHz) : 0;
			grow = 1 + (SCATTER_LAND.growScale - 1) * up + SCATTER_LAND.breathAmp * breath;
			growRaf = requestAnimationFrame(step);
		};
		growRaf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(growRaf);
	});
	// the card flash: the landing beat's own (beat.fl) or the set's (hits, link, accent)
	const flashAlpha = $derived(Math.max(beat && beat.sc && beat.fl < 1 ? SCATTER_LAND.flashAlpha * (1 - beat.fl) : 0, fx.flash));
	const cardRadius = tileSize * 0.06;
	// the well darkens from wellAlphaFrom to wellAlphaTo across the slap (the presenting window)
	let wellAlpha = $state(SCATTER_LAND.wellAlphaFrom);
	let wellRaf = 0;
	$effect(() => {
		cancelAnimationFrame(wellRaf);
		wellRaf = 0;
		if (!presenting) {
			wellAlpha = SCATTER_LAND.wellAlphaFrom;
			return;
		}
		const t0 = performance.now();
		const total = (SCATTER_LAND.slapDelayMs + SCATTER_LAND.slapMs) / stateBetDerived.timeScale();
		const step = (now: number) => {
			const q = Math.min(1, (now - t0) / total);
			wellAlpha = SCATTER_LAND.wellAlphaFrom + (SCATTER_LAND.wellAlphaTo - SCATTER_LAND.wellAlphaFrom) * q * q;
			if (q < 1) wellRaf = requestAnimationFrame(step);
		};
		wellRaf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(wellRaf);
	});
	const drawFlash = (g: PIXI.Graphics) => g.roundRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, cardRadius).fill({ color: 0xfff8e6 });
	const drawLit = (g: PIXI.Graphics) => g.roundRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, cardRadius).fill({ color: SCATTER_LAND.litColor });
	// three concentric strokes stand in for a glow (no filters): wide + faint, mid, hot core
	const drawRim = (g: PIXI.Graphics) => {
		for (const [w, a] of [[14, 0.12], [8, 0.25], [3, 0.9]] as const) {
			g.roundRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, cardRadius).stroke({ width: w, color: SCATTER_LAND.rimColor, alpha: a });
		}
	};
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
>
	<!-- the scatter's shadow: its own card shape tinted black rides the strip down in its cell and
	     darkens as the slap closes in (SCATTER_LAND.well*) -->
	<Sprite anchor={0.5} key="S.png" tint={0x000000} width={tileSize} height={tileSize} alpha={wellAlpha} visible={hiddenForSlap} />
	{#if isBellTile}
		{@const gw = tileSize * BELL_GLOW.tile.size}
		<!-- bell glow under the tile (bellGlow.ts tile): rides the cell, over the neighbours it spills onto -->
		<BaseSprite texture={bellRaysTexture()} anchor={0.5} width={gw} height={gw} rotation={tileGlow.raysRotation} tint={BELL_GLOW.color} alpha={tileGlow.raysAlpha * BELL_GLOW.tile.strength} blendMode="add" />
		<BaseSprite texture={bellHaloTexture()} anchor={0.5} width={gw * BELL_GLOW.haloScale} height={gw * BELL_GLOW.haloScale} tint={BELL_GLOW.color} alpha={tileGlow.haloAlpha * BELL_GLOW.tile.strength} blendMode="add" />
	{/if}
	<Container scale={squash} rotation={props.reelSymbol.symbolRot.current}>
		<!-- the resting tile hides while the bell rings: the press frames squash and rock, and the
		     still frame 1 underneath showed around their edges (Corey 2026-09-10) -->
		<Container visible={ring === null && !hiddenForSlap && !posing}>
			<Symbol
				state={props.reelSymbol.symbolState}
				rawSymbol={props.reelSymbol.rawSymbol}
				holdGrow={props.reelSymbol.rawSymbol.name === 'S' && stateGame.scatterGrowHold}
				oncomplete={() => {
					if (props.reelSymbol.symbolState === 'win') props.reelSymbol.oncomplete();
					if (props.reelSymbol.symbolState === 'land') {
						props.reelSymbol.symbolState = 'static';
						// a visible scatter's landing is its slap (ScatterDrop), not the strip contact
						if (props.reelSymbol.rawSymbol.name === 'S' && isVisibleRow) {
							stateGameDerived.scatterDropStart({ reel: props.reelIndex, row: props.reelSymbol.symbolIndexOfBoard });
						} else startLandBeat();
					}
				}}
			/>
		</Container>
		<!-- per-insect pose layer (SYMBOL_POSES): ALWAYS mounted and invisible until a pose runs, so
		     it can never re-stack over the overlays below it. Sized off the same symbolInfo the
		     baked tile uses, so it grows with the win state and rides the squash/lift/rotation. -->
		<SymbolPose
			reelIndex={props.reelIndex}
			reelSymbol={props.reelSymbol}
			width={SYMBOL_SIZE * symbolInfo.sizeRatios.width}
			height={SYMBOL_SIZE * symbolInfo.sizeRatios.height}
		/>
		{#if showGlint}
			<!-- glint clipped to the tray shape, then the bug redrawn over it so the light never crosses it -->
			<Graphics draw={drawGlint} />
			<Sprite anchor={0.5} key="{beat?.name}_insect.png" width={tileSize} height={tileSize} />
		{/if}
		<!-- scatter card light (SCATTER_LAND): warm wash while lifted, white flash, additive hot rim;
		     always mounted, alpha-driven, drawn once -->
		<Graphics draw={drawLit} alpha={fx.lit} visible={fx.lit > 0} />
		<Graphics draw={drawFlash} alpha={flashAlpha} visible={flashAlpha > 0} />
		<Graphics draw={drawRim} alpha={fx.rim} visible={fx.rim > 0} blendMode="add" />
		{#if ring !== null}
			{@const pose = bellPose(ring, TIMINGS.ring)}
			<!-- Service Bell press frames over the resting tile (same size, fully covers it), squashing
			     and rocking on the bell's base -->
			<Sprite anchor={{ x: 0.5, y: 1 }} y={tileSize / 2} key={pose.key} width={tileSize * pose.scaleX} height={tileSize * pose.scaleY} rotation={pose.rotation} />
		{/if}
	</Container>
	{#if dust}
		<!-- landing dust, outside the squash container so it blooms while the tile compresses -->
		<BaseSprite texture={dust.texture} anchor={{ x: 0.5, y: 1 }} y={dust.y} width={dust.w} height={dust.h} alpha={dust.alpha} />
	{/if}
</SymbolWrap>
