<script lang="ts">
	// THE WAR STANDARD'S SUN (1.0.04; constants SUN_TEASE and ANTICIPATION_TEASE; images/anticipation_r2 NOTES.md r3, Corey
	// 2026-10-20 "Yes let's go with B", "the anticipation moves to the next row before the symbols actually drop on the
	// reel ... fixed that timing and also made the sun symbol drop like it does on the last reel on the miss"). A regular
	// spin's scatter tease, in place of the loose-symbol rain:
	//   the sun     behind the held column whose hold is running: the War Standard's twelve-ray disc rises in at the top
	//               of the well (riseMs) and builds through the hold (size, light, turn, the light's reach down the
	//               well); when the column is released it SINKS with the falling stack (its centre held at the stack's
	//               bottom edge) and fades by the landing. The next held column's sun only rises once this one has
	//               landed (the engine's plan: holdFrom 'landing').
	//   the threads thin lines of light from every landed War Standard to the sun, two beads travelling on each, faster
	//               as the build climbs; a new War Standard's thread draws in over drawInMs
	//   the halos   on the landed War Standards, on the pulse (which quickens through a hold)
	//   the flares  a War Standard beyond the third bursts with the sun on its cell (flareMs); a hit flashes every halo
	//               once after the last landing (hitFlashMs), then the trigger pulse and beat take over
	// Everything is read from game/teaseState.ts (the plan and the drop's clock): nothing here decides timing, and the
	// plaque's flag row can read the same state later.
	// House rules: raw Pixi ticked from the app ticker with an early out when no tease runs; every sprite pooled and built
	// at mount; four textures baked once (game/beamTexture.ts); additive sprites and tints only: no filters, masks
	// (the disc and its light sit in BoardCells' cut layer, cut by its one fall mask at the window, under the tiles) or
	// per-frame textures. The threads, beads, halos and flares sit over the cells (z 13.5, under the trigger beat's 14).
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { DROP, SUN_TEASE as S, SYMBOL_SIZE, GRID, reelOf, rowOf } from '../game/constants';
	import { revealTease } from '../game/stateGame.svelte';
	import { teaseNow } from '../game/teaseState';
	import { sunTexture, washTexture, threadTexture, haloTexture } from '../game/beamTexture';
	import { boardCutSlot } from '../game/boardPlateSlot';
	import { stagingSun, stagingBeams, stagingTeaseFall, stagingTeaseHoldMs } from '../game/staging';

	const context = getContext();
	const CELL = SYMBOL_SIZE;
	const H = GRID * CELL;
	const POOL = GRID; // one War Standard per column at most
	const sunK = stagingSun ?? S.sun;
	const beamsK = stagingBeams ?? S.beams;

	const smooth = (x: number) => {
		const v = x < 0 ? 0 : x > 1 ? 1 : x;
		return v * v * (3 - 2 * v);
	};
	const add = (tex: PIXI.Texture, parent: PIXI.Container, anchorX = 0.5, anchorY = 0.5, tint = 0xffffff) => {
		const s = new PIXI.Sprite(tex);
		s.anchor.set(anchorX, anchorY);
		s.blendMode = 'add';
		s.tint = tint;
		s.visible = false;
		parent.addChild(s);
		return s;
	};

	// ---- behind the tiles (in the cut layer's tease slot)
	const back = new PIXI.Container({ label: 'sunTease', zIndex: -0.9 });
	const glow = add(haloTexture(), back, 0.5, 0.5, S.haloTint);
	const wash = add(washTexture(), back, 0.5, 0, S.washTint);
	const ring = add(sunTexture(), back);
	const disc = add(sunTexture(), back, 0.5, 0.5, S.sunTint);
	// ---- over the tiles (the board container)
	const front = new PIXI.Container({ label: 'sunTeaseFront', zIndex: 13.5, visible: false });
	getContextParent().addToParent(front);
	const halos = Array.from({ length: POOL }, () => add(haloTexture(), front, 0.5, 0.5, S.haloTint));
	const threadGlows = Array.from({ length: POOL }, () => add(threadTexture(), front, 0, 0.5, S.threadTint));
	const threads = Array.from({ length: POOL }, () => add(threadTexture(), front, 0, 0.5, S.threadTint));
	const beads = Array.from({ length: POOL * 2 }, () => add(haloTexture(), front, 0.5, 0.5, S.threadTint));
	const flareHalos = Array.from({ length: POOL }, () => add(haloTexture(), front, 0.5, 0.5, S.haloTint));
	const flares = Array.from({ length: POOL }, () => add(sunTexture(), front));

	/** DEV probe (tools/manticore/sun_tease_probe.js): what was drawn last frame, board units */
	const drawn = { on: false, reel: -1, x: 0, y: 0, alpha: 0, size: 0, edge: -1, phase: 'none' as string, threads: 0, halos: 0, flares: 0, beads: 0, frames: 0, threadEnd: -1, floor: 0 };
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		Object.assign(((window as any).__manticore ??= {}), {
			sunTease: () => ({ drawn: { ...drawn }, state: { ...teaseNow() }, knobs: { sun: sunK, beams: beamsK, hold: stagingTeaseHoldMs, fall: stagingTeaseFall }, plan: revealTease.plan ? JSON.parse(JSON.stringify(revealTease.plan)) : null }),
		});
	}

	let shown = false;
	const hideAll = () => {
		for (const s of [glow, wash, ring, disc, ...halos, ...threadGlows, ...threads, ...beads, ...flareHalos, ...flares]) s.visible = false;
		front.visible = false;
		boardCutSlot.sun = false;
		drawn.on = false;
		drawn.reel = -1;
		drawn.phase = 'none';
		drawn.threads = drawn.halos = drawn.flares = drawn.beads = 0;
	};

	const tick = () => {
		const st = teaseNow();
		const plan = revealTease.plan;
		if (!st.active || !plan || context.stateGame.skipping) {
			if (shown) {
				shown = false;
				hideAll();
			}
			return;
		}
		if (!shown) {
			shown = true;
			const slot = boardCutSlot.current;
			if (slot && back.parent !== slot) slot.addChild(back);
			if (slot?.parent && !slot.parent.visible) slot.parent.visible = true;
			front.visible = true;
		}
		boardCutSlot.sun = true;
		drawn.frames += 1;
		drawn.phase = st.phase;
		const t = st.t;
		const sec = t / 1000;
		const triggerAfter = st.triggerAfter;
		// the rung: 1 with three War Standards down, +1 per landing after (eased over 250 ms), at most 3
		let rung = 1;
		for (let j = triggerAfter; j < plan.scatterLand.length; j += 1) rung += smooth((t - plan.scatterLand[j]) / 250);
		rung = Math.min(3, rung);
		const ri = Math.min(1, Math.floor(rung - 1));
		const ru = rung - 1 - ri;
		const lerp3 = (arr: readonly number[]) => arr[ri] + (arr[ri + 1] - arr[ri]) * ru;

		// ---- the sun on the column whose turn it is
		let e = 0;
		let x = 0;
		let y = 0;
		let D = 0;
		let lit = 1;
		let qq = 1;
		let build = 0;
		let holding = false;
		let edge = -1;
		const c = st.holdIndex >= 0 ? plan.columns[st.holdIndex] : null;
		if (c) {
			x = (c.reel + 0.5) * CELL;
			const yRest = S.restCells * CELL;
			if (st.phase === 'hold') {
				holding = true;
				qq = smooth(st.holdProgress);
				// a short hold (the Mystery's: 700 ms down to 317, divided by turbo) rises in half its hold at most
				const rise = smooth((t - c.show) / Math.max(1, Math.min(S.riseMs, (c.launch - c.show) * 0.5)));
				e = rise;
				y = S.fromCells * CELL + (yRest - S.fromCells * CELL) * rise - S.liftCells * CELL * qq;
				build = c.i + st.holdProgress;
			} else {
				// THE SINK (Corey: "made the sun symbol drop like it does on the last reel on the miss"): it falls with the
				// column, on the drop's own easing, from where its hold left it to under the window's bottom edge, and never
				// above the falling stack's bottom edge; it fades over the second half of the fall (sinkFadeFrom)
				const yHold = yRest - S.liftCells * CELL;
				const p = Math.min(1, Math.max(0, (t - c.launch) / c.fall));
				const bottom = c.fromY + (c.toY - c.fromY) * DROP.easing(p);
				edge = (bottom + 1) * CELL;
				y = Math.max(yHold + (H + S.sinkPastCells * CELL - yHold) * DROP.easing(p), edge);
				e = 1 - smooth((st.fallProgress - S.sinkFadeFrom) / (1 - S.sinkFadeFrom));
				build = c.i + 1;
			}
			const grow = S.holdGrowFrom + (S.holdGrowTo - S.holdGrowFrom) * qq;
			lit = S.litFrom + (1 - S.litFrom) * qq;
			D = lerp3(S.sizeCells) * CELL * grow;
		}
		const pulse = (sc: number, b: number, push: number) => 0.5 + 0.5 * Math.sin(Math.PI * 2 * (S.pulseHz * sc + S.pulsePerBuild * b + S.pulsePush * push));
		const beat = pulse(sec, build, holding ? qq * qq : 0);
		// while it sinks the disc keeps the pulse it had at the release, so it only ever fades
		const discBeat = c && !holding ? pulse(c.launch / 1000, c.i + 1, 1) : beat;
		const sunOn = e > 0.004 && sunK > 0;
		disc.visible = sunOn;
		ring.visible = false;
		glow.visible = sunOn;
		wash.visible = sunOn;
		if (sunOn) {
			const Db = D * (1 + 0.05 * discBeat * (0.4 + qq));
			disc.position.set(x, y);
			disc.setSize(Db, Db);
			disc.angle = -(sec * S.turnDegPerS + S.turnDegPerBuild * build);
			disc.alpha = Math.min(1, lerp3(S.alpha) * e * lit * (0.85 + 0.15 * discBeat) * sunK);
			const rr = Math.max(rung >= 2 ? Math.min(1, rung - 1) : 0, holding ? smooth((qq - S.ringFromHold) / (1 - S.ringFromHold)) * 0.6 : 0);
			ring.visible = rr > 0.01;
			if (ring.visible) {
				ring.position.set(x, y);
				ring.setSize(Db * S.ringScale, Db * S.ringScale);
				ring.angle = -disc.angle * 0.6 + 15;
				ring.alpha = Math.min(1, S.ringAlpha * e * lit * rr * sunK);
			}
			glow.position.set(x, y);
			glow.setSize(Db * 1.3, Db * 1.3);
			glow.alpha = Math.min(1, (0.25 + 0.2 * lit) * e * 0.6 * sunK);
			const reach = S.washFrom + (1 - S.washFrom) * qq;
			const top = Math.max(0, y);
			wash.position.set(x, top);
			wash.setSize(S.washWidthCells * CELL, Math.max(1, (H - top) * reach));
			wash.alpha = Math.min(1, S.washAlpha * e * lit * sunK);
		}
		drawn.on = sunOn;
		drawn.reel = c ? c.reel : -1;
		drawn.x = x;
		drawn.y = y;
		drawn.alpha = sunOn ? disc.alpha : 0;
		drawn.size = D;
		drawn.edge = edge;
		drawn.floor = Number.isFinite(boardCutSlot.bottom) ? boardCutSlot.bottom : H;

		// ---- over the tiles: halos, threads, beads, flares
		const last = plan.columns[plan.columns.length - 1];
		const hitFlash = plan.hit && t >= last.land && t < last.land + S.hitFlashMs ? Math.sin((Math.PI * (t - last.land)) / S.hitFlashMs) * 0.7 : 0;
		let nh = 0;
		let nt = 0;
		let nf = 0;
		let nb = 0;
		/** the lowest thread end drawn this frame, board px (DEV probe: never past the cut line) */
		let threadEnd = -1;
		for (let j = 0; j < POOL; j += 1) {
			const halo = halos[j];
			const th = threads[j];
			const tg = threadGlows[j];
			const fh = flareHalos[j];
			const fl = flares[j];
			const b0 = beads[j * 2];
			const b1 = beads[j * 2 + 1];
			const land = j < plan.scatterLand.length ? plan.scatterLand[j] : Infinity;
			if (t < land) {
				halo.visible = th.visible = tg.visible = fh.visible = fl.visible = b0.visible = b1.visible = false;
				continue;
			}
			const cell = plan.scatters[j];
			const sx = (reelOf(cell) + 0.5) * CELL;
			const sy = (rowOf(cell) + 0.5) * CELL;
			const g = smooth((t - land) / S.drawInMs);
			// the flare: a War Standard beyond the third bursts with the sun
			const f = j >= triggerAfter && t - land < S.flareMs ? 1 - (t - land) / S.flareMs : 0;
			fl.visible = fh.visible = f > 0 && sunK > 0;
			if (fl.visible) {
				const size = S.flareCells * CELL * (0.6 + 0.6 * (1 - f));
				fl.position.set(sx, sy);
				fl.setSize(size, size);
				fl.angle = -sec * 40;
				fl.alpha = Math.min(1, S.flareAlpha * Math.pow(f, 1.3) * sunK);
				fh.position.set(sx, sy);
				fh.setSize(size * 1.2, size * 1.2);
				fh.alpha = Math.min(1, 0.7 * f * sunK);
				nf += 1;
			}
			const ha = ((S.haloLow + (S.haloHigh - S.haloLow) * beat) * e * (0.6 + 0.4 * lit) + 0.5 * f + hitFlash) * g * beamsK;
			halo.visible = ha > 0.004;
			if (halo.visible) {
				halo.position.set(sx, sy);
				halo.setSize(S.haloCells * CELL, S.haloCells * CELL);
				halo.alpha = Math.min(1, ha);
				nh += 1;
			}
			const ta = e * g * (0.7 + 0.3 * lit) * beamsK;
			const on = sunOn && ta > 0.01;
			th.visible = tg.visible = b0.visible = b1.visible = on;
			if (!on) continue;
			// THE BOARD'S BOTTOM (1.0.04, Corey 2026-10-20: "On the anticipation reels, on a miss, the connecting lines drop
			// below the boards boundaries, they should stop at the bottom of the board"): while the sun sinks past the cut
			// line the falling symbols are cut at (BoardCells' fall mask, boardCutSlot.bottom), the thread and its beads end
			// where the line to it crosses that line. No mask: the geometry is shortened
			const floor = Number.isFinite(boardCutSlot.bottom) ? boardCutSlot.bottom : H;
			const ty = y > floor && floor > sy ? floor : y;
			const tx = ty === y ? x : sx + ((x - sx) * (floor - sy)) / (y - sy);
			const dx = tx - sx;
			const dy = ty - sy;
			const len = Math.hypot(dx, dy) * g;
			const rot = Math.atan2(dy, dx);
			for (const [s, hCells, a] of [
				[th, S.threadCells, S.threadAlpha],
				[tg, S.threadGlowCells, S.threadGlowAlpha],
			] as const) {
				s.position.set(sx, sy);
				s.rotation = rot;
				s.setSize(Math.max(1, len), hCells * CELL);
				s.alpha = Math.min(1, a * ta);
			}
			nt += 1;
			if (ty > threadEnd) threadEnd = ty;
			for (let k = 0; k < 2; k += 1) {
				const b = k === 0 ? b0 : b1;
				const u = (((sec * S.beadSpeed + S.beadPerBuild * build + j * 0.27 + k * 0.5) % 1) + 1) % 1;
				b.position.set(sx + dx * u * g, sy + dy * u * g);
				b.setSize(S.beadCells * CELL, S.beadCells * CELL);
				b.alpha = Math.min(1, ta);
				nb += 1;
			}
		}
		drawn.halos = nh;
		drawn.threadEnd = threadEnd;
		drawn.threads = nt;
		drawn.flares = nf;
		drawn.beads = nb;
	};

	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		ticker?.add(tick, undefined, PIXI.UPDATE_PRIORITY.HIGH);
		return () => {
			ticker?.remove(tick);
			boardCutSlot.sun = false;
			back.destroy({ children: true });
			// the parent's unmount destroys `front`; the baked textures are shared and stay
		};
	});
</script>
