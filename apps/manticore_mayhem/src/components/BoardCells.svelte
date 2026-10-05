<script lang="ts">
	// THE BOARD'S TILES AND MULTIPLIER BADGES, drawn as raw Pixi sprites synced from the app ticker.
	//
	// Why not one pixi-svelte <Sprite> per cell (the milestone-1 version): every pixi-svelte node
	// runs a props-sync effect that re-enumerates ALL its props through Svelte's spread/rest proxies
	// and re-assigns every one of them to the Pixi object whenever ANY prop changes. During a drop
	// that is 64 effects a frame, each walking ~10 keys through proxy ownKeys/getOwnPropertyDescriptor
	// — the phone pass (2026-09-23, tools/manticore/perf_probe.js) found Svelte's effect flush was
	// over half of all main-thread time through an Epic. Here the board engine (stateGame.cells /
	// stateGame.tiles) stays the single source of truth, untouched, and this layer READS it once a
	// frame outside any reactive context and writes only the Pixi fields that actually changed.
	//
	// Sprites are POOLED: a cell id takes a sprite from the free list the first frame it appears and
	// gives it back the first frame it is gone, so a refill never allocates. The badges are 64 fixed
	// sprites, one per cellIndex (a badge belongs to the CELL, not to the symbol, so it never moves).
	//
	// Z-order is unchanged in effect: this layer sits at the cells' old z (0) in Board's sorted
	// container, with the old per-cell ladder inside it (removing 8, win 10); the badges are their
	// own layer at the old badge z (20), over the sting (15).
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, CELL_FILL, CELL_COUNT, TILE, reelOf, rowOf } from '../game/constants';
	import type { Cell } from '../game/stateGame.svelte';

	const context = getContext();
	const stateGame = context.stateGame;

	const SIZE = SYMBOL_SIZE * CELL_FILL;
	const BADGE = SYMBOL_SIZE * TILE.size;

	const cellLayer = new PIXI.Container({ zIndex: 0, sortableChildren: true });
	const badgeLayer = new PIXI.Container({ zIndex: 20 });
	const parent = getContextParent();
	parent.addToParent(cellLayer);
	parent.addToParent(badgeLayer);

	const assets = () => context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;

	/** blend white towards a flash colour by `k` — cheaper than a filter and batches with the rest */
	const lerpTint = (color: number, k: number) => {
		if (k <= 0) return 0xffffff;
		const r = Math.round(255 + (((color >> 16) & 0xff) - 255) * k);
		const g = Math.round(255 + (((color >> 8) & 0xff) - 255) * k);
		const b = Math.round(255 + ((color & 0xff) - 255) * k);
		return (r << 16) | (g << 8) | b;
	};

	// what a sprite was last given, so an unchanged field is never re-assigned (a Pixi transform
	// setter marks the render group dirty even when the value is the same)
	type Slot = { s: PIXI.Sprite; gen: number; name: string; tex: PIXI.Texture | null; y: number; sx: number; sy: number; a: number; tint: number; z: number };
	const slot = (): Slot => {
		const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
		s.anchor.set(0.5);
		s.visible = false;
		cellLayer.addChild(s);
		return { s, gen: -1, name: '', tex: null, y: NaN, sx: NaN, sy: NaN, a: NaN, tint: -1, z: -1 };
	};
	const live = new Map<number, Slot>(); // cell id -> its sprite
	const free: Slot[] = [];
	// the steady state is 64 on the board plus a refill's worth in the air: pre-warm so the first
	// cascade does not allocate either
	for (let i = 0; i < CELL_COUNT + 16; i += 1) free.push(slot());

	let gen = 0;
	const syncCell = (c: Cell, tex: Record<string, PIXI.Texture> | undefined) => {
		let sl = live.get(c.id);
		if (!sl) {
			sl = free.pop() ?? slot();
			sl.name = '';
			sl.tex = null;
			sl.y = sl.sx = sl.sy = sl.a = NaN;
			sl.tint = -1;
			sl.z = -1;
			sl.s.x = (c.reel + 0.5) * SYMBOL_SIZE;
			sl.s.visible = true;
			live.set(c.id, sl);
		}
		sl.gen = gen;
		const s = sl.s;
		if (sl.name !== c.name || !sl.tex) {
			const t = tex?.[`${c.name}.png`] ?? null;
			if (t !== sl.tex) {
				s.texture = t ?? PIXI.Texture.EMPTY;
				sl.tex = t;
				sl.sx = sl.sy = NaN; // width/height are derived from the texture's size: reapply
			}
			sl.name = c.name;
		}
		const x = (c.reel + 0.5) * SYMBOL_SIZE;
		if (s.x !== x) s.x = x;
		if (c.y !== sl.y) {
			sl.y = c.y;
			s.y = (c.y + 0.5) * SYMBOL_SIZE;
		}
		if (c.scaleX !== sl.sx || c.scaleY !== sl.sy) {
			sl.sx = c.scaleX;
			sl.sy = c.scaleY;
			s.setSize(SIZE * c.scaleX, SIZE * c.scaleY);
		}
		if (c.alpha !== sl.a) {
			sl.a = c.alpha;
			s.alpha = c.alpha;
		}
		const tint = lerpTint(c.flashColor, c.flash);
		if (tint !== sl.tint) {
			sl.tint = tint;
			s.tint = tint;
		}
		const z = c.state === 'win' ? 10 : c.state === 'removing' ? 8 : 0;
		if (z !== sl.z) {
			sl.z = z;
			s.zIndex = z;
		}
	};

	type Badge = { s: PIXI.Sprite; value: number; scale: number };
	const badges: Badge[] = Array.from({ length: CELL_COUNT }, (_, index) => {
		const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
		s.anchor.set(0.5);
		s.position.set((reelOf(index) + 0.5 + TILE.offset.x) * SYMBOL_SIZE, (rowOf(index) + 0.5 + TILE.offset.y) * SYMBOL_SIZE);
		s.visible = false;
		badgeLayer.addChild(s);
		return { s, value: 0, scale: NaN };
	});

	const sync = () => {
		gen += 1;
		const tex = assets();
		// plain reads outside any effect: no dependency tracking, no flush
		const cells = stateGame.cells;
		for (let i = 0; i < cells.length; i += 1) syncCell(cells[i], tex);
		for (const [id, sl] of live) {
			if (sl.gen === gen) continue;
			sl.s.visible = false;
			live.delete(id);
			free.push(sl);
		}
		const tiles = stateGame.tiles;
		for (let i = 0; i < CELL_COUNT; i += 1) {
			const tile = tiles[i];
			const b = badges[i];
			const value = tile?.value ?? 0;
			if (value !== b.value) {
				const t = value ? tex?.[`x${value}.png`] : undefined;
				if (value && !t) continue; // texture not in yet: try again next frame
				b.value = value;
				b.s.visible = value > 0;
				if (t) b.s.texture = t;
				b.scale = NaN;
			}
			if (!value) continue;
			const scale = tile.scale;
			if (scale !== b.scale) {
				b.scale = scale;
				b.s.setSize(BADGE * scale, BADGE * scale);
			}
		}
	};

	sync();
	onMount(() => {
		// runs before the renderer's own ticker entry (UPDATE_PRIORITY.LOW), so the frame that is
		// drawn is the frame the board engine just wrote
		const ticker = context.stateApp.pixiApplication?.ticker;
		ticker?.add(sync, undefined, PIXI.UPDATE_PRIORITY.HIGH);
		return () => {
			ticker?.remove(sync);
			// the parent's unmount destroys the two layers; the pooled sprites go with them
			for (const sl of free) sl.s.destroy();
			for (const sl of live.values()) sl.s.destroy();
			for (const b of badges) b.s.destroy();
		};
	});
</script>
