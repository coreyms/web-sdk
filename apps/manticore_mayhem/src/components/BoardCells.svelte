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
	// SYMBOL SHEETS (tools/SYMBOL_SHEETS.md): once the deferred drop / idle sheets are in, a cell
	// plays its symbol's drop sheet from the landing contact (Cell.landAt, stamped by the engine) at
	// SHEET_FPS in STYLE time (x timeScale), then loops its idle sheet; a cell at rest shows an idle
	// frame (idle 0 = the drop's last frame), so the static-to-animation cut never shimmers. A cell
	// that leaves its place for any other reason (a fall, the roar's rattle, the swipe's exit, a
	// removal) shows the static atlas frame until it lands again; a scale-only beat in place (a win
	// pulse, a sting pop) freezes on its current frame and the clip resumes after. A cell entering
	// idle without a landing starts at a per-position phase (idleOffset). Before the sheets
	// load every cell shows the static atlas frame. Only the pooled sprite's texture is switched
	// between already-parsed sheet frames: no texture is ever created here.
	//
	// Z-order is unchanged in effect: this layer sits at the cells' old z (0) in Board's sorted
	// container, with the old per-cell ladder inside it (aura -1, static 0, removing 8, win 10); the
	// flashes (11) and sparkles (12) sit over the tiles, under the sting (15) and the badges (20).
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { quadOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, CELL_FILL, CELL_COUNT, TILE, SPARKLE, AURA_COLOR, SHEET_FPS, reelOf, rowOf, symbolAnim } from '../game/constants';
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

	// ---- the symbol sheets: per symbol name, the parsed drop / idle frames, built ONCE per name the
	// first frame that symbol's drop sheet is in (frame count from the sheet itself, never assumed) --
	type Sheet = { drop: PIXI.Texture[]; idle: PIXI.Texture[] | null; from: number };
	const sheets = new Map<string, Sheet | null>();
	const FRAME_MS = 1000 / SHEET_FPS;
	const pad3 = (i: number) => (i < 10 ? '00' : i < 100 ? '0' : '') + i;
	const framesOf = (tex: Record<string, PIXI.Texture>, prefix: string): PIXI.Texture[] => {
		const out: PIXI.Texture[] = [];
		for (let i = 0; ; i += 1) {
			const t = tex[`${prefix}-${pad3(i)}`];
			if (!t) return out;
			out.push(t);
		}
	};
	const sheetFor = (name: string, tex: Record<string, PIXI.Texture> | undefined): Sheet | null => {
		const hit = sheets.get(name);
		if (hit) return hit;
		if (!tex) return null;
		const code = name.toLowerCase();
		if (!tex[`${code}-drop-000`]) return null; // not in yet (the deferred phase lands all at once)
		const anim = symbolAnim(name);
		const drop = framesOf(tex, `${code}-drop`);
		const idle = anim.idle ? framesOf(tex, `${code}-idle`) : [];
		const sheet: Sheet = { drop, idle: idle.length > 1 ? idle : null, from: Math.min(anim.dropFrom, drop.length - 1) };
		sheets.set(name, sheet);
		return sheet;
	};
	// GPU warm-up: each sheet's source is uploaded the first time a frame of it is drawn, and a 2048 px
	// upload mid-cascade is a hitch. Once the sheets are parsed, upload every source up front, ONE per
	// tick (no textures are created: these are the sources the sheets already own).
	const SYMBOLS = ['L1', 'L2', 'L3', 'L4', 'M1', 'M2', 'M3', 'H1', 'W', 'S'];
	let uploadQueue: PIXI.TextureSource[] | null = null;
	let uploaded = 0;
	const warmSheets = (tex: Record<string, PIXI.Texture> | undefined) => {
		if (uploadQueue === null) {
			if (!SYMBOLS.every((n) => sheetFor(n, tex))) return;
			const set = new Set<PIXI.TextureSource>();
			for (const n of SYMBOLS) {
				const sh = sheets.get(n)!;
				set.add(sh.drop[0].source);
				if (sh.idle) set.add(sh.idle[0].source);
			}
			uploadQueue = [...set];
		}
		if (!uploadQueue.length) return;
		const src = uploadQueue.pop()!;
		const sys = (context.stateApp.pixiApplication?.renderer as any)?.texture;
		try {
			sys?.initSource?.(src);
			uploaded += 1;
		} catch {
			/* a renderer without initSource uploads on first draw instead */
		}
	};
	const MODE_STATIC = 0;
	const MODE_DROP = 1;
	const MODE_IDLE = 2;

	// what a sprite was last given, so an unchanged field is never re-assigned (a Pixi transform
	// setter marks the render group dirty even when the value is the same)
	type Slot = {
		s: PIXI.Sprite; g: PIXI.Sprite; gen: number; name: string; tex: PIXI.Texture | null; y: number; sx: number; sy: number; a: number; tint: number; z: number; glow: number; rot: number;
		/** sheet playback: mode, style ms into the clip, the last Cell.landAt seen, still in the landing beat, the frame shown */
		mode: number; clock: number; landAt: number; landing: boolean; frame: number;
	};
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
		return { s, g, gen: -1, name: '', tex: null, y: NaN, sx: NaN, sy: NaN, a: NaN, tint: -1, z: -1, glow: 0, rot: 0, mode: MODE_STATIC, clock: 0, landAt: 0, landing: false, frame: -1 };
	};
	const live = new Map<number, Slot>(); // cell id -> its sprite
	const free: Slot[] = [];
	// the steady state is 64 on the board plus a refill's worth in the air: pre-warm so the first
	// cascade does not allocate either
	for (let i = 0; i < CELL_COUNT + 16; i += 1) free.push(slot());

	let gen = 0;
	let glowing = 0;
	/** set once a tick by sync(): real ms since the last tick and the style rate */
	let now = 0;
	let dtStyle = 0;
	let rate = 1;

	/** which texture a cell shows this tick (static atlas frame, or a sheet frame), advancing its clip */
	// the static atlas frame per symbol name, cached per loadedAssets object (no string built per frame)
	let staticOf = new Map<string, PIXI.Texture | null>();
	let staticFor: Record<string, PIXI.Texture> | undefined;
	const staticTexture = (name: string, tex: Record<string, PIXI.Texture> | undefined): PIXI.Texture | null => {
		if (tex !== staticFor) {
			staticFor = tex;
			staticOf = new Map();
		}
		let t = staticOf.get(name);
		if (t === undefined) {
			t = tex?.[`${name}.png`] ?? null;
			if (t) staticOf.set(name, t);
		}
		return t;
	};
	/** a cell's idle phase when it enters idle without a landing: deterministic per board position,
	 *  57 distinct phases over the 64 cells (no two neighbours alike), no allocation */
	const idleOffset = (reel: number, row: number) => ((reel * 29 + row * 47) % 60) * FRAME_MS;
	const pickTexture = (c: Cell, sl: Slot, tex: Record<string, PIXI.Texture> | undefined): PIXI.Texture | null => {
		const fallback = staticTexture(c.name, tex);
		const sheet = sheetFor(c.name, tex);
		if (!sheet) {
			sl.mode = MODE_STATIC;
			sl.frame = -1;
			sl.landAt = c.landAt; // a landing before the sheets arrived is never replayed late
			return fallback;
		}
		let fresh = false;
		if (c.landAt !== sl.landAt) {
			// a new landing contact: the drop sheet starts on the contact frame
			sl.landAt = c.landAt;
			if (c.landAt > 0) {
				sl.mode = MODE_DROP;
				sl.clock = Math.max(0, (now - c.landAt) * rate);
				sl.landing = true;
				fresh = true;
			}
		}
		const placed = Math.abs(c.y - c.row) < 1e-4;
		const unscaled = Math.abs(c.scaleX - 1) < 1e-4 && Math.abs(c.scaleY - 1) < 1e-4;
		if (sl.landing && placed && unscaled) sl.landing = false; // the engine has put it down exactly
		// a cell that LEAVES its place (a fall, a removal, the rattle, the swipe's exit) shows the static
		// atlas frame until it lands again. In the landing beat the squash / bounce is the drop's own,
		// so only a NEW fall counts there.
		const moving = c.dx !== 0 || c.rot !== 0 || c.state === 'removing' || (sl.landing ? c.y < c.row - 0.25 : !placed);
		if (moving) {
			sl.landing = false;
			sl.mode = MODE_STATIC;
			sl.frame = -1;
			return fallback;
		}
		// scale-only motion in place (a win pulse, a sting pop): FREEZE on the frame it was on, the clip
		// clock resumes when the scale is back to 1
		const frozen = !sl.landing && !unscaled;
		if (sl.mode === MODE_STATIC) {
			// entering idle without a landing (the first board, a new symbol from the sting's flip, back
			// from the rattle): a per-cell phase so the board never breathes in unison
			sl.mode = MODE_IDLE;
			sl.clock = idleOffset(c.reel, c.row);
		} else if (!fresh && !frozen) {
			sl.clock += dtStyle;
		}
		if (sl.mode === MODE_DROP) {
			const span = (sheet.drop.length - sheet.from) * FRAME_MS;
			if (sl.clock < span) {
				sl.frame = sheet.from + Math.floor(sl.clock / FRAME_MS);
				return sheet.drop[sl.frame];
			}
			sl.mode = MODE_IDLE;
			sl.clock -= span;
		}
		// idle: loop the idle sheet, or rest on the drop's last frame when there is none
		if (!sheet.idle) {
			sl.frame = sheet.drop.length - 1;
			return sheet.drop[sl.frame];
		}
		const n = sheet.idle.length;
		sl.frame = Math.floor(sl.clock / FRAME_MS) % n;
		return sheet.idle[sl.frame];
	};

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
			sl.rot = 0;
			sl.s.rotation = 0;
			sl.mode = MODE_STATIC;
			sl.clock = 0;
			sl.landAt = c.landAt;
			sl.landing = false;
			sl.frame = -1;
			sl.s.x = (c.reel + 0.5) * SYMBOL_SIZE;
			sl.g.x = sl.s.x;
			sl.s.visible = true;
			live.set(c.id, sl);
		}
		sl.gen = gen;
		const s = sl.s;
		if (sl.name !== c.name) {
			// a new symbol (the sting's flip): its own clip, from rest
			if (sl.name && sl.mode !== MODE_STATIC) sl.mode = MODE_STATIC;
			sl.name = c.name;
		}
		const t = pickTexture(c, sl, tex);
		if (t !== sl.tex) {
			// sheet frames and atlas frames share one cell size per tier, so a frame switch keeps the
			// sprite's size; only a change of texture SIZE (or the first texture) re-applies it
			if (!sl.tex || !t || t.orig.width !== sl.tex.orig.width) sl.sx = sl.sy = NaN;
			s.texture = t ?? PIXI.Texture.EMPTY;
			sl.tex = t;
		}
		// dx / rot: the roar's rattle and fall (0 at rest)
		const x = (c.reel + 0.5 + c.dx) * SYMBOL_SIZE;
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
		if (c.rot !== sl.rot) {
			sl.rot = c.rot;
			s.rotation = c.rot;
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
		now = performance.now();
		rate = Math.max(0.2, context.stateGameDerived.timeScale());
		dtStyle = lastFrame ? Math.min(now - lastFrame, 1000) * rate : 0;
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
		if (uploadQueue === null || uploadQueue.length) warmSheets(tex);
	};

	sync();
	onMount(() => {
		// runs before the renderer's own ticker entry (UPDATE_PRIORITY.LOW), so the frame that is
		// drawn is the frame the board engine just wrote
		const ticker = context.stateApp.pixiApplication?.ticker;
		ticker?.add(sync, undefined, PIXI.UPDATE_PRIORITY.HIGH);
		if (import.meta.env.DEV) {
			// SHEETS probe (tools/manticore/sheet_probe.js): which symbols' sheets are parsed, and per
			// live cell its clip mode, frame index within that clip, clip clock and texture size
			const renderer = context.stateApp.pixiApplication?.renderer as any;
			Object.defineProperty(((window as any).__manticore ??= {}), 'sheets', {
				get: () => {
					const tex = assets();
					const loaded = SYMBOLS.filter((n) => sheetFor(n, tex));
					return {
						loaded: loaded.length === SYMBOLS.length,
						/** sheet sources pre-uploaded to the GPU / still queued */
						uploaded,
						uploadPending: uploadQueue?.length ?? null,
						symbols: Object.fromEntries(
							loaded.map((n) => {
								const sh = sheets.get(n)!;
								const src = sh.drop[0].source;
								return [n, { drop: sh.drop.length, idle: sh.idle?.length ?? 0, from: sh.from, squash: symbolAnim(n).squash, sheetPx: src.pixelWidth, resolution: src.resolution }];
							}),
						),
						/** the renderer's last tick time and style rate: the clip clocks are as of this instant */
						tick: now,
						rate,
						gpuTextures: renderer?.texture?.managedTextures?.length ?? null,
						assetKeys: tex ? Object.keys(tex).length : 0,
						cells: stateGame.cells.map((c) => {
							const sl = live.get(c.id);
							return {
								id: c.id, name: c.name, reel: c.reel, row: c.row, y: c.y, sx: c.scaleX, sy: c.scaleY, landAt: c.landAt, state: c.state,
								mode: sl ? ['static', 'drop', 'idle'][sl.mode] : 'none', frame: sl?.frame ?? -1, clock: sl?.clock ?? 0,
								texW: sl?.tex?.orig.width ?? 0, texLabel: sl?.tex?.label ?? null,
							};
						}),
					};
				},
				configurable: true,
				enumerable: true,
			});
		}
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
