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
	// eight columns always built with `visible` toggled (the conditional-mount z-order trap), the
	// beam and spill are baked textures built once (game/beamTexture.ts) on additive sprites — no
	// filters, no per-frame textures — and the loose symbols are not board cells, so they never
	// reach stateGame.cells or the at-rest invariant.
	//
	// PHONE PASS (2026-09-23): raw Pixi, ticked from the app ticker ONLY while a column is teasing.
	// The pixi-svelte version kept 264 always-mounted <Sprite>s whose y came from a rAF loop that
	// never stopped, so every frame of the whole session re-ran 240 props-sync effects for a layer
	// that is invisible outside a Mystery reveal. Same tree, same numbers, no Svelte in the frame.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
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
	const beamLen = COLUMN_H * ANTICIPATION.beamLength;
	const beamW = 2 * ANTICIPATION.beamHalfWidth * beamLen;

	const assets = () => context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;

	// ---- the tree: one column per reel, at a FIXED board z (above the backdrop, below the
	// symbols): the tease is a light effect behind the tiles, never a layer that can end up over them
	const root = new PIXI.Container({ zIndex: -1 });
	getContextParent().addToParent(root);

	// the rain's loose symbols are shared by every column (they all read the same `names` / `dist`),
	// so each column owns its own sprites but they are driven from one set of numbers
	const names = Array.from({ length: N }, roll);
	const cycles = Array(N).fill(0);

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
		return { c, rain, loose, light, beam, spill, left, right, names: Array(N).fill('') };
	});

	let dist = 0; // board px the rain has travelled, in style time
	let styleMs = 0; // ms of style time the tease has run: the beam swings on this
	let running = false;
	let last = 0;

	const tick = () => {
		// cheap early out: nothing is teasing and nothing is still fading
		let any = false;
		for (let reel = 0; reel < GRID; reel += 1) if (stateGame.anticipation[reel].on) any = true;
		if (!any) {
			if (running) {
				running = false;
				for (const col of columns) col.c.visible = false;
			}
			return;
		}
		const now = performance.now();
		if (!running) {
			running = true;
			last = now; // the clock only runs while the tease shows: no jump on the first frame
		}
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
		const tex = assets();
		const strength = ANTICIPATION.strength[stateGame.turboLevel] ?? ANTICIPATION.strength[0];
		const angle = Math.sin((styleMs / ANTICIPATION.beamPeriodMs) * Math.PI * 2) * ANTICIPATION.beamSwing;
		for (let reel = 0; reel < GRID; reel += 1) {
			const a = stateGame.anticipation[reel];
			const col = columns[reel];
			col.c.visible = a.on;
			if (!a.on) continue;
			col.rain.alpha = ANTICIPATION.rainAlpha * a.fade;
			for (let k = 0; k < N; k += 1) {
				// column-local y of loose symbol k: enters above the window, leaves below it
				const y = ((k * SYMBOL_SIZE + dist) % LOOP) - SYMBOL_SIZE / 2;
				const swap = col.names[k] !== names[k];
				const t = swap ? tex?.[`${names[k]}.png`] : undefined;
				if (swap && t) col.names[k] = names[k];
				const row = col.loose[k];
				for (let g = 0; g < GHOSTS.length; g += 1) {
					const s = row[g];
					if (t) {
						s.texture = t;
						s.setSize(tile, tile * ANTICIPATION.rainStretch);
					}
					s.y = y + GHOSTS[g] * ANTICIPATION.rainGhostOffset * SYMBOL_SIZE;
				}
			}
			col.light.alpha = strength * a.fade;
			col.beam.rotation = angle;
			col.spill.alpha = (ANTICIPATION.spillAlpha + ANTICIPATION.spillAlphaGrow * a.q) * strength * a.fade;
			const spillW = SYMBOL_SIZE * CELL_FILL * (ANTICIPATION.spillWidth + ANTICIPATION.spillGrow * a.q);
			col.left.setSize(spillW, COLUMN_H);
			col.right.setSize(spillW, COLUMN_H);
			col.right.x = SYMBOL_SIZE - spillW;
		}
	};

	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		ticker?.add(tick, undefined, PIXI.UPDATE_PRIORITY.HIGH);
		return () => {
			ticker?.remove(tick);
			// the parent's unmount destroys root; the baked textures are shared and stay
			root.destroy({ children: true });
		};
	});
</script>
