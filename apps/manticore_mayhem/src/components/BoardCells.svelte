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
	// MOTION PASS 1 adds three more pooled layers, all sized ONCE at mount, never allocated per frame:
	//   · the AURA: an additive halo sprite behind every pooled tile (one per slot), alpha = Cell.glow
	//   · the SPARKLES: one ParticleContainer of SPARKLE.count x SPARKLE.maxCells dots on one baked dot
	//     texture, additive, tinted the cleared tile's colour, driven from game/sparkles.ts bursts
	//     (a fresh seeded pattern per burst; dead dots are zeroed, never removed)
	//   · the CELL FLASH: 64 fixed white additive squares, one per cellIndex, that flash at a burst
	//
	// Z-order is unchanged in effect: this layer sits at the cells' old z (0) in Board's sorted
	// container, with the old per-cell ladder inside it (aura -1, static 0, removing 8, win 10); the
	// flashes (11) and sparkles (12) sit over the tiles, under the sting (15) and the badges (20).
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { quadOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, CELL_FILL, CELL_COUNT, TILE, SPARKLE, AURA_COLOR, reelOf, rowOf } from '../game/constants';
	import { PHONE_TIER } from '../game/deviceTier';
	import { dotTexture, glowTexture, DOT_PX, GLOW_PX } from '../game/fxTexture';
	import { takeSparkles, seeded, sparkleStats, motionLog, type Burst } from '../game/sparkles';
	import type { Cell } from '../game/stateGame.svelte';

	const context = getContext();
	const stateGame = context.stateGame;

	const SIZE = SYMBOL_SIZE * CELL_FILL;
	const BADGE = SYMBOL_SIZE * TILE.size;
	const GLOW_SIZE = SIZE * 1.45;

	const cellLayer = new PIXI.Container({ zIndex: 0, sortableChildren: true });
	const flashLayer = new PIXI.Container({ zIndex: 11, visible: false });
	const badgeLayer = new PIXI.Container({ zIndex: 20 });
	const parent = getContextParent();
	parent.addToParent(cellLayer);
	parent.addToParent(flashLayer);
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
	type Slot = { s: PIXI.Sprite; g: PIXI.Sprite; gen: number; name: string; tex: PIXI.Texture | null; y: number; sx: number; sy: number; a: number; tint: number; z: number; glow: number };
	const slot = (): Slot => {
		const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
		s.anchor.set(0.5);
		s.visible = false;
		cellLayer.addChild(s);
		// the aura halo: behind every tile, additive, hidden until the cell glows
		const g = new PIXI.Sprite(glowTexture());
		g.anchor.set(0.5);
		g.setSize(GLOW_SIZE, GLOW_SIZE);
		g.tint = AURA_COLOR;
		g.blendMode = 'add';
		g.zIndex = -1;
		g.visible = false;
		cellLayer.addChild(g);
		return { s, g, gen: -1, name: '', tex: null, y: NaN, sx: NaN, sy: NaN, a: NaN, tint: -1, z: -1, glow: 0 };
	};
	const live = new Map<number, Slot>(); // cell id -> its sprite
	const free: Slot[] = [];
	// the steady state is 64 on the board plus a refill's worth in the air: pre-warm so the first
	// cascade does not allocate either
	for (let i = 0; i < CELL_COUNT + 16; i += 1) free.push(slot());

	let gen = 0;
	let glowing = 0;
	const syncCell = (c: Cell, tex: Record<string, PIXI.Texture> | undefined) => {
		let sl = live.get(c.id);
		if (!sl) {
			sl = free.pop() ?? slot();
			sl.name = '';
			sl.tex = null;
			sl.y = sl.sx = sl.sy = sl.a = NaN;
			sl.tint = -1;
			sl.z = -1;
			sl.glow = 0;
			sl.s.x = (c.reel + 0.5) * SYMBOL_SIZE;
			sl.g.x = sl.s.x;
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
		if (s.x !== x) {
			s.x = x;
			sl.g.x = x;
		}
		if (c.y !== sl.y) {
			sl.y = c.y;
			s.y = (c.y + 0.5) * SYMBOL_SIZE;
			sl.g.y = s.y;
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
		if (c.glow !== sl.glow) {
			sl.glow = c.glow;
			sl.g.visible = c.glow > 0;
			if (c.glow > 0) sl.g.alpha = c.glow;
		}
		if (c.glow > 0) glowing += 1;
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

	// ---- the cell flash: one fixed white square per cellIndex, lit by a burst's first 30% ----------
	const flashes: PIXI.Sprite[] = Array.from({ length: CELL_COUNT }, (_, index) => {
		const s = new PIXI.Sprite(PIXI.Texture.WHITE);
		s.anchor.set(0.5);
		s.position.set((reelOf(index) + 0.5) * SYMBOL_SIZE, (rowOf(index) + 0.5) * SYMBOL_SIZE);
		s.setSize(SIZE, SIZE);
		s.blendMode = 'add';
		s.visible = false;
		flashLayer.addChild(s);
		return s;
	});
	const flashAlpha = new Float32Array(CELL_COUNT);

	// ---- the sparkles: one particle container, bounded pool, zero allocation per burst ------------
	const PER_CELL = PHONE_TIER ? SPARKLE.countPhone : SPARKLE.count;
	const POOL = PER_CELL * SPARKLE.maxCells;
	type Dot = { p: PIXI.Particle; alive: boolean; ox: number; oy: number; a: number; sp: number; life: number; roll: number; t0: number; ms: number };
	const sparkLayer = new PIXI.ParticleContainer({
		zIndex: 12,
		visible: false,
		texture: dotTexture(),
		dynamicProperties: { position: true, scale: true, rotation: false, color: true },
	});
	sparkLayer.blendMode = 'add';
	parent.addToParent(sparkLayer);
	const dots: Dot[] = [];
	const freeDots: Dot[] = [];
	for (let i = 0; i < POOL; i += 1) {
		const p = new PIXI.Particle({ texture: dotTexture(), x: 0, y: 0, scaleX: 0, scaleY: 0, anchorX: 0.5, anchorY: 0.5, alpha: 0 });
		sparkLayer.addParticle(p);
		const d: Dot = { p, alive: false, ox: 0, oy: 0, a: 0, sp: 0, life: 1, roll: 1, t0: 0, ms: 1 };
		dots.push(d);
		freeDots.push(d);
	}
	sparkleStats.poolSize = POOL;
	let aliveDots = 0;
	const bursts: Burst[] = []; // bursts still flashing their cell
	const SPREAD = SPARKLE.spreadCells * SYMBOL_SIZE;
	const GRAV = SPARKLE.gravity * SYMBOL_SIZE;
	const DOT_SCALE = (SPARKLE.sizePx * 2) / DOT_PX; // sizePx is a radius in board px; the texture is DOT_PX across

	const spawn = (b: Burst) => {
		const rnd = seeded(b.seed);
		const ox = (b.reel + 0.5) * SYMBOL_SIZE;
		const oy = (b.row + 0.5) * SYMBOL_SIZE;
		for (let i = 0; i < PER_CELL; i += 1) {
			// the same three rolls per dot as the playground, in the same order, so a seed draws alike
			const a = rnd() * Math.PI * 2;
			const sp = (0.5 + rnd()) * SPREAD;
			const life = 0.6 + rnd() * 0.4;
			const roll = 0.6 + rnd() * 0.8;
			const d = freeDots.pop();
			if (!d) {
				sparkleStats.dropped += 1;
				continue;
			}
			d.alive = true;
			d.ox = ox;
			d.oy = oy;
			d.a = a;
			d.sp = sp;
			d.life = life;
			d.roll = roll;
			d.t0 = b.t0;
			d.ms = b.life;
			d.p.tint = b.tint;
			aliveDots += 1;
		}
		bursts.push(b);
	};

	// the particle pipe compiles its own shader and builds its buffers on its FIRST render: let that
	// happen at mount (every dot at alpha 0), not on the first cluster's removal (a 99 ms hitch on the
	// cold first spin at CPU 4x when it was left to then)
	let warmFrames = 3;
	const tickSparkles = (now: number) => {
		const fresh = takeSparkles();
		for (let i = 0; i < fresh.length; i += 1) spawn(fresh[i]);
		if (warmFrames > 0) {
			warmFrames -= 1;
			sparkLayer.visible = true;
			sparkLayer.update();
			flashLayer.visible = true;
			if (warmFrames === 0 && aliveDots === 0) {
				sparkLayer.visible = false;
				flashLayer.visible = false;
			}
			if (aliveDots === 0) return;
		}
		if (aliveDots === 0 && bursts.length === 0) {
			if (sparkLayer.visible) sparkLayer.visible = false;
			if (flashLayer.visible) flashLayer.visible = false;
			sparkleStats.inUse = 0;
			return;
		}
		// the dots
		for (let i = 0; i < dots.length; i += 1) {
			const d = dots[i];
			if (!d.alive) continue;
			const u = (now - d.t0) / d.ms;
			const uu = u / d.life;
			const p = d.p;
			if (uu >= 1) {
				d.alive = false;
				aliveDots -= 1;
				p.alpha = 0;
				p.scaleX = p.scaleY = 0;
				freeDots.push(d);
				continue;
			}
			const e = quadOut(uu < 0 ? 0 : uu);
			p.x = d.ox + Math.cos(d.a) * d.sp * e;
			p.y = d.oy + Math.sin(d.a) * d.sp * e + GRAV * uu * uu;
			const sc = DOT_SCALE * (1 - uu) * d.roll;
			p.scaleX = p.scaleY = sc;
			p.alpha = 1 - uu;
		}
		sparkLayer.visible = aliveDots > 0;
		if (aliveDots > 0) sparkLayer.update();
		// the cell flashes: the first 30% of a burst's life
		flashAlpha.fill(0);
		for (let i = bursts.length - 1; i >= 0; i -= 1) {
			const b = bursts[i];
			const u = (now - b.t0) / b.life;
			if (u >= 0.3) {
				bursts.splice(i, 1);
				continue;
			}
			const k = b.reel * 8 + b.row;
			if (k >= 0 && k < CELL_COUNT) flashAlpha[k] = Math.max(flashAlpha[k], SPARKLE.cellFlashAlpha * (1 - u / 0.3));
		}
		let anyFlash = false;
		for (let k = 0; k < CELL_COUNT; k += 1) {
			const a = flashAlpha[k];
			const f = flashes[k];
			if (a > 0) {
				anyFlash = true;
				f.visible = true;
				f.alpha = a;
			} else if (f.visible) {
				f.visible = false;
			}
		}
		flashLayer.visible = anyFlash;
		sparkleStats.inUse = aliveDots;
		if (aliveDots > sparkleStats.peak) sparkleStats.peak = aliveDots;
	};

	let lastFrame = 0;
	const sync = () => {
		const now = performance.now();
		if (lastFrame) {
			const d = now - lastFrame;
			motionLog.frames += 1;
			if (d > 50) motionLog.framesOver50 += 1;
			if (d > 33.4) motionLog.framesOver33 += 1;
			if (d > motionLog.worstMs) motionLog.worstMs = d;
		}
		lastFrame = now;
		gen += 1;
		glowing = 0;
		const tex = assets();
		// plain reads outside any effect: no dependency tracking, no flush
		const cells = stateGame.cells;
		for (let i = 0; i < cells.length; i += 1) syncCell(cells[i], tex);
		for (const [id, sl] of live) {
			if (sl.gen === gen) continue;
			sl.s.visible = false;
			sl.g.visible = false;
			sl.glow = 0;
			live.delete(id);
			free.push(sl);
		}
		motionLog.glowInUse = glowing;
		if (glowing > motionLog.glowPeak) motionLog.glowPeak = glowing;
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
		tickSparkles(now);
	};

	sync();
	onMount(() => {
		// runs before the renderer's own ticker entry (UPDATE_PRIORITY.LOW), so the frame that is
		// drawn is the frame the board engine just wrote
		const ticker = context.stateApp.pixiApplication?.ticker;
		ticker?.add(sync, undefined, PIXI.UPDATE_PRIORITY.HIGH);
		return () => {
			ticker?.remove(sync);
			// the parent's unmount destroys the layers; the pooled sprites and particles go with them
			for (const sl of free) {
				sl.s.destroy();
				sl.g.destroy();
			}
			for (const sl of live.values()) {
				sl.s.destroy();
				sl.g.destroy();
			}
			for (const b of badges) b.s.destroy();
			for (const f of flashes) f.destroy();
			sparkLayer.destroy();
		};
	});
</script>
