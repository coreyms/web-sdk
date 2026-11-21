<script lang="ts">
	// THE COLUMN TEASE, Angry Mantis's Anticipation.svelte adapted from five spinning reels to the 8x8 drop. It was
	// built for the Mystery's scatter tease (RULE_PASS_2 section D: the BOOK's array, a searchlight, a rain of loose
	// symbols and a growing edge spill), whose own look left with the Mystery mode on 2026-11-21 (Corey: "You can get rid
	// of the Mystery Source."). It reads stateGame.anticipation and decides nothing.
	//
	// THE DERIVED TEASE (ANTICIPATION_TEASE, every mode, Corey 2026-10-06 18:52) uses this tree with its own
	// numbers: the rain (rainAlpha, positioned by the engine: its own speed through the
	// hold, then locked to the incoming stack, fading over the fall) and a faint fixed edge spill. Since
	// Corey 2026-10-16 17:32 there is NO beam on a regular spin ("the difference is the spotlight, it should
	// be removed"): ANTICIPATION_TEASE.beam false hides the light, and the rain is one symbol with a single
	// trail copy above it instead of three equal exposures.
	//
	// THE CUT (FALL_CUT, Corey 2026-10-15 10:06: the cut line "also controls the anticipation reels"): the tree lives in
	// BoardCells' cut layer (game/boardPlateSlot.ts boardCutSlot), so the rain entering above the window and leaving below
	// it is cut at the inner window edge by that layer's one mask, like the tiles coming in and going out.
	//
	// House rules: mounted INSIDE the board container (the tease never leaves the board), all
	// eight columns always built with `visible` toggled (the conditional-mount z-order trap), the
	// beam and spill are baked textures built once (game/beamTexture.ts) on additive sprites — no
	// filters, no per-frame textures — and the loose symbols are not board cells, so they never
	// reach stateGame.cells or the at-rest invariant.
	//
	// PHONE PASS (2026-09-23): raw Pixi, ticked from the app ticker ONLY while a column is teasing.
	// The pixi-svelte version kept 264 always-mounted <Sprite>s whose y came from a rAF loop that
	// never stopped, so every frame of the whole session re-ran 240 props-sync effects for a layer
	// that is invisible outside a tease. Same tree, same numbers, no Svelte in the frame.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, CELL_FILL, GRID, ANTICIPATION, ANTICIPATION_TEASE } from '../game/constants';
	import { beamTexture, spillTexture } from '../game/beamTexture';
	import { boardCutSlot } from '../game/boardPlateSlot';

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
	const beamLen = COLUMN_H * ANTICIPATION.beamLength;
	const beamW = 2 * ANTICIPATION.beamHalfWidth * beamLen;
	// the derived tease's beam is the playground's: 2 x 0.48 of a cell wide at its far end (hw = 0.24 x cell x 2),
	// so it reads as a searchlight sweeping through the column rather than a wash filling it
	const teaseBeamW = 2 * 0.48 * SYMBOL_SIZE;

	const assets = () => context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;

	// ---- the tree: one column per reel, at a FIXED board z (above the backdrop, below the
	// symbols): the tease is a light effect behind the tiles, never a layer that can end up over them
	const root = new PIXI.Container({ zIndex: -1 });
	// into the cut layer's tease slot (BoardCells mounts first); the board container only until the slot exists
	if (boardCutSlot.current) boardCutSlot.current.addChild(root);
	else getContextParent().addToParent(root);

	type Column = {
		c: PIXI.Container;
		rain: PIXI.Container;
		loose: PIXI.Sprite[][]; // [k][ghost]
		light: PIXI.Container;
		beam: PIXI.Sprite;
		spill: PIXI.Container;
		left: PIXI.Sprite;
		right: PIXI.Sprite;
		names: string[]; // what each loose row currently shows
		/** the derived tease: this column's own roll per loose row (its rain runs on its own clock) */
		own: string[];
		ownCycle: number[];
		/** the beam is sized for the derived tease */
		teaseBeam: boolean;
	};
	const columns: Column[] = Array.from({ length: GRID }, (_, reel) => {
		const c = new PIXI.Container({ x: reel * SYMBOL_SIZE, visible: false });
		// rain, under the falling symbols
		const rain = new PIXI.Container({ x: SYMBOL_SIZE / 2 });
		const loose = Array.from({ length: N }, () =>
			GHOSTS.map(() => {
				const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
				s.anchor.set(0.5);
				rain.addChild(s);
				return s;
			}),
		);
		// searchlight, masked to its own column so it never lights the neighbours
		const light = new PIXI.Container();
		const mask = new PIXI.Graphics().rect(0, 0, SYMBOL_SIZE, COLUMN_H).fill(0xffffff);
		light.addChild(mask);
		light.mask = mask;
		const beam = new PIXI.Sprite(beamTexture());
		beam.anchor.set(0.5, 0);
		beam.position.set(SYMBOL_SIZE / 2, COLUMN_H * ANTICIPATION.beamOriginY);
		beam.setSize(beamW, beamLen);
		beam.blendMode = 'add';
		light.addChild(beam);
		// light spill from both edges, growing over the hold
		const spill = new PIXI.Container();
		const left = new PIXI.Sprite(spillTexture('left'));
		const right = new PIXI.Sprite(spillTexture('right'));
		left.blendMode = right.blendMode = 'add';
		spill.addChild(left, right);
		c.addChild(rain, light, spill);
		root.addChild(c);
		return { c, rain, loose, light, beam, spill, left, right, names: Array(N).fill(''), own: Array.from({ length: N }, roll), ownCycle: Array(N).fill(0), teaseBeam: false };
	});

	let running = false;

	const tick = () => {
		// cheap early out: nothing is teasing and nothing is still fading
		let any = false;
		for (let reel = 0; reel < GRID; reel += 1) if (stateGame.anticipation[reel].on) any = true;
		if (!any) {
			if (running) {
				running = false;
				boardCutSlot.tease = false;
				for (const col of columns) col.c.visible = false;
			}
			return;
		}
		if (!running) {
			running = true;
			// the cut layer shows from this frame on (BoardCells keeps it shown while `tease` is set)
			const slot = boardCutSlot.current;
			if (slot && root.parent !== slot) slot.addChild(root);
			boardCutSlot.tease = true;
			if (slot?.parent && !slot.parent.visible) slot.parent.visible = true;
		}
		const tex = assets();
		for (let reel = 0; reel < GRID; reel += 1) {
			const a = stateGame.anticipation[reel];
			const col = columns[reel];
			col.c.visible = a.on;
			if (!a.on) continue;
			if (a.tease) {
				// a regular spin: the War Standard's sun (SunTease.svelte) since 1.0.04; the rain only with ANTICIPATION_TEASE.rain
				if (!ANTICIPATION_TEASE.rain) {
					col.c.visible = false;
					continue;
				}
				teaseColumn(col, a, tex);
				continue;
			}
			// not the derived tease: nothing draws it (the Mystery's own column look left on 2026-11-21)
			col.c.visible = false;
		}
	};

	/** one column of the derived tease: everything comes from the engine's numbers (a.el, a.rain, a.fade,
	 *  a.rainFade), so the column draws exactly the frame the drop is on */
	const teaseColumn = (col: Column, a: { el: number; q: number; rain: number; fade: number; rainFade: number }, tex: Record<string, PIXI.Texture> | undefined) => {
		const T = ANTICIPATION_TEASE;
		if (!col.teaseBeam) {
			col.teaseBeam = true;
			col.beam.setSize(teaseBeamW, beamLen);
			// NO SPOTLIGHT ON A REGULAR SPIN (Corey 2026-10-16 17:32): the light (and its mask) is not drawn at all.
			// THE RAIN'S TRAIL: the copy above each loose symbol at rainTrailAlpha, the one below hidden
			col.light.visible = T.beam;
			for (const row of col.loose)
				for (let g = 0; g < GHOSTS.length; g += 1) row[g].alpha = GHOSTS[g] === 0 ? 1 : GHOSTS[g] < 0 ? T.rainTrailAlpha : 0;
		}
		// the warm edge strips (the Mystery's, faint and fixed: no growth over the hold), fading with the beam's fade
		col.spill.visible = T.spillAlpha > 0;
		if (col.spill.visible) {
			col.spill.alpha = T.spillAlpha * a.fade;
			const spillW = SYMBOL_SIZE * CELL_FILL * T.spillWidth;
			col.left.setSize(spillW, COLUMN_H);
			col.right.setSize(spillW, COLUMN_H);
			col.right.x = SYMBOL_SIZE - spillW;
		}
		col.rain.alpha = T.rainAlpha * a.rainFade;
		const shift = a.rain * SYMBOL_SIZE;
		for (let k = 0; k < N; k += 1) {
			const cycle = Math.floor((k * SYMBOL_SIZE + shift) / LOOP);
			if (cycle !== col.ownCycle[k]) {
				col.ownCycle[k] = cycle;
				col.own[k] = roll();
			}
			const y = ((k * SYMBOL_SIZE + shift) % LOOP) - SYMBOL_SIZE / 2;
			const swap = col.names[k] !== col.own[k];
			const t = swap ? tex?.[`${col.own[k]}.png`] : undefined;
			if (swap && t) col.names[k] = col.own[k];
			const row = col.loose[k];
			for (let g = 0; g < GHOSTS.length; g += 1) {
				const s = row[g];
				if (t) {
					s.texture = t;
					s.setSize(tile, tile * T.rainStretch);
				}
				s.y = y + GHOSTS[g] * T.rainGhostOffset * SYMBOL_SIZE;
			}
		}
		if (!T.beam) return;
		col.light.alpha = T.beamAlpha * a.fade;
		if (col.beam.tint !== T.beamColor) col.beam.tint = T.beamColor;
		col.beam.rotation = Math.sin((a.el / T.beamPeriodMs) * Math.PI * 2) * T.beamSwing;
	};

	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		ticker?.add(tick, undefined, PIXI.UPDATE_PRIORITY.HIGH);
		return () => {
			ticker?.remove(tick);
			boardCutSlot.tease = false;
			// the parent's unmount destroys root; the baked textures are shared and stay
			root.destroy({ children: true });
		};
	});
</script>
