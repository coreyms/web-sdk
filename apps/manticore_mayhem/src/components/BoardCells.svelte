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
	// gives it back the first frame it is gone, so a refill never allocates.
	//
	// THE MULTIPLIER PLATES (MULT_PLATE, Corey 2026-10-07 13:25; the top-right badge is retired): a plate
	// belongs to the CELL (cellIndex), never to the symbol, and is drawn UNDER the symbols. One plate per
	// cell, built the first frame that cell has a value and kept: one Graphics drawn ONCE in white (the fill
	// and the border; the colour, the count-over's colour lerp and the dim are its tint, so it is never
	// redrawn), a soft glow (the shared aura texture, tinted) and two rows of plate-atlas glyphs (the old
	// and the new value for the count-over), each a white face over a slightly larger copy of every glyph
	// tinted the plate colour (the playground's white fill with a coloured stroke). The glyphs are Barlow
	// Condensed 700 (game/plateGlyphs.ts, the playground's face), set like canvas fillText: advances +
	// kerning, centred on the advance box, the 'middle' line on the plate centre, font size
	// MULT_PLATE.numberSizeCells of a cell. Rows re-layout only when their text changes. No text, no
	// texture, no filter.
	//
	// THE DIM RULE (Corey 2026-10-07 10:18): every dim (Cell.dim) is a DARKENING, the sprite tint
	// multiplied toward black, never alpha, and the plate under a dimmed symbol darkens by the same factor.
	//
	// MOTION PASS 1 adds three more pooled layers, all sized ONCE at mount, never allocated per frame:
	//   · the AURA: an additive halo sprite behind every pooled tile (one per slot), alpha = Cell.glow
	//   · the SPARKLES: one ParticleContainer of SPARKLE.count x SPARKLE.maxCells dots on one baked dot
	//     texture, additive, tinted the cleared tile's colour, driven from game/sparkles.ts bursts
	//     (a fresh seeded pattern per burst; dead dots are zeroed, never removed)
	//   · the CELL FLASH: 64 fixed white additive squares, one per cellIndex, that flash at a burst
	// (the sparkles and the flash are the 'old' win look, DEV ?winfx=old). THE WIN EFFECT (WIN_FX, 2026-10-16, the
	// default) replaces them with three pooled layers of its own, below: the SHINE (the symbol's frame in strips, one
	// additive layer over the tiles), the BURST (a ray sprite and a soft round glow per popping cell) and the EMBERS
	// (one ParticleContainer of streaks), all driven from game/winFx.ts.
	//
	// SYMBOL SHEETS (tools/SYMBOL_SHEETS.md): once the deferred drop / idle sheets are in, a cell
	// plays its symbol's drop sheet from the landing contact (Cell.landAt, stamped by the engine) at
	// SHEET_FPS in STYLE time (x timeScale), then loops its idle sheet (in REAL time at every turbo level, constants
	// SHEET_IDLE_TURBO: a resting piece glints at the regular speed whatever the turbo); a cell at rest shows an idle
	// frame (idle 0 = the drop's last frame), so the static-to-animation cut never shimmers. A cell
	// that leaves its place for any other reason (a fall, the roar's rattle, the swipe's exit, a
	// removal) shows the static atlas frame until it lands again; a scale-only beat in place (a win
	// pulse, a sting pop) freezes on its current frame and the clip resumes after. A cell entering
	// idle without a landing starts at a per-position phase (idleOffset). Before the sheets
	// load every cell shows the static atlas frame. Only the pooled sprite's texture is switched
	// between already-parsed sheet frames: no texture is ever created here.
	//
	// THE SYMBOL OVERHAUL (Corey 2026-10-13 12:06, Symbol Fit Playground v7, constants SYMBOL_PLACE): every symbol on
	// the TRUE centre of its lattice opening (game/symbolPlace.ts), at its own size and dx / dy; drawn over the bars and
	// never cut by the board window. DRAW ORDER inside this layer (zIndex): the auras (-1) under every tile, then the
	// RESTING band and over it the POP band (a symbol pulsing or popping: scale up both ways, or a removal in place),
	// each sorted by the symbol's "on top" number, then lower rows on top, then the cell (the playground's sort). A
	// tile still coming in over the top edge, or leaving under the bottom edge, is moved to the FALL LAYER (just under
	// this one), the only thing cut at the board window; it comes back when it is wholly inside. The dark rim round
	// each symbol is baked into its sheets (SYMBOL_RIM, tools/pack_symbol_sheets.py).
	// The flashes (11) and sparkles (12) sit over the tiles, under the sting (15) and the badges (20). The multiplier
	// TILES are not in the board container any more: they draw UNDER the frame (BoardFrame's plate slot).
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { quadOut, quadIn, backOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, CELL_FILL, SYMBOL_FIT, CELL_COUNT, GRID, MULT_PLATE, PLAYGROUND_PX, plateColor, SPARKLE, AURA_COLOR, SHEET_FPS, SHEET_IDLE_TURBO, SYMBOL_IDLE_REST, SYMBOL_PLACE, SYMBOL_POPS, SYMBOL_RIM, BOARD_SIZES, reelOf, rowOf, symbolAnim, symbolScale } from '../game/constants';
	import { openingsFor, offsetAt, latticeEdges, type Openings } from '../game/symbolPlace';
	import { boardPlateSlot, boardCutSlot } from '../game/boardPlateSlot';
	import { layoutKind, type LayoutKind } from '../game/layoutSpec';
	import { PLATE_GLYPHS, PLATE_GLYPH_PREFIX, PLATE_GLYPH_MIDDLE, PLATE_KERN } from '../game/plateGlyphs';
	import { PHONE_TIER } from '../game/deviceTier';
	import { dotTexture, glowTexture, innerGlowTexture, DOT_PX, GLOW_PX, raysTexture, coreTexture, emberTexture, RAYS_PX, CORE_PX, EMBER_W } from '../game/fxTexture';
	import { takeSparkles, seeded, sparkleStats, motionLog, type Burst } from '../game/sparkles';
	import { winFx, shineCells, takeWinBursts, winFxStats, type ShineCell, type WinBurst } from '../game/winFx';
	import { enableMipmaps, mipLevels } from '../game/mipmaps';
	import { boardExit, boardExitPressing, plateGhosts, type Cell } from '../game/stateGame.svelte';
	import { BOARD_EXIT, ANTICIPATION_TEASE, CLUSTER, STING, SCATTER_STING, GRAVITY_DROP, FALL_CUT, WIN_FX } from '../game/constants';
	import { createWells } from '../game/wells';
	import { cueWellTile } from '../game/wellsFx';
	const ANTICIPATION_TEASE_PULSE = ANTICIPATION_TEASE.landedPulse;

	const context = getContext();
	const stateGame = context.stateGame;

	// SYMBOL_FIT: the symbols sit inside the lattice's clear openings (constants.ts)
	const SIZE = SYMBOL_SIZE * CELL_FILL * SYMBOL_FIT;
	const GLOW_SIZE = SIZE * 1.45;

	// the multiplier tiles: UNDER the frame art, in BoardFrame's plate slot (game/boardPlateSlot.ts), not in the board
	// container; put there in sync() as soon as the slot exists
	const plateLayer = new PIXI.Container({ label: 'mult-tiles' });
	const cellLayer = new PIXI.Container({ zIndex: 0, sortableChildren: true });
	// THE CUT LAYER (FALL_CUT, Corey 2026-10-15 10:08): everything crossing the board window's top or bottom edge, cut
	// at the INNER WINDOW EDGE where the black lattice ends (this layout's own registration, setCutLines; a pitch of
	// slack either side so a wide symbol's sides are never cut) by its ONE mask: the tiles on their way in or out
	// (`fallTiles`) over the anticipation reels (`teaseSlot`, Anticipation.svelte moves its tree in, game/boardPlateSlot.ts
	// boardCutSlot). Just under the resting tiles, over the roar's cell flashes (-0.5). Hidden (no mask work) while
	// neither has anything to show. The mask's rect is redrawn only when the layout changes.
	const fallLayer = new PIXI.Container({ zIndex: -0.25, visible: false, label: 'cutLayer' });
	const fallMask = new PIXI.Graphics();
	const teaseSlot = new PIXI.Container({ label: 'cutTease' });
	const fallTiles = new PIXI.Container({ label: 'cutTiles' });
	fallLayer.addChild(fallMask, teaseSlot, fallTiles);
	fallLayer.mask = fallMask;
	boardCutSlot.current = teaseSlot;
	const flashLayer = new PIXI.Container({ zIndex: 11, visible: false });
	const parent = getContextParent();
	parent.addToParent(fallLayer);
	parent.addToParent(cellLayer);
	parent.addToParent(flashLayer);

	// ---- THE TRUE OPENINGS (game/symbolPlace.ts): recomputed when the layout or the portrait growth changes; the
	// ticker reads the plain `op` -------------------------------------------------------------------------------
	const layoutK = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const viewW = $derived(context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale);
	let op: Openings = openingsFor('landscape');
	/** board px per desktop master px of SYMBOL_PLACE's dx / dy (they scale with the pitch in every layout) */
	const PER_MASTER = SYMBOL_SIZE / SYMBOL_PLACE.refPitch;
	const off = { x: 0, y: 0 };

	// ---- THE CUT LINES (FALL_CUT), board px: the cut layer's mask runs from cutTop to cutBottom, the lattice's outer
	// bars' chosen edge (game/symbolPlace.ts latticeEdges) in this layout, moved outward by FALL_CUT.offsetPx
	let cutTop = 0;
	let cutBottom = BOARD_SIZES.height;
	const setCutLines = (kind: LayoutKind, vw?: number) => {
		const e = latticeEdges(kind, vw);
		cutTop = e.top[FALL_CUT.edge] - FALL_CUT.offsetPx;
		cutBottom = e.bottom[FALL_CUT.edge] + FALL_CUT.offsetPx;
		fallMask.clear().rect(-SYMBOL_SIZE, cutTop, BOARD_SIZES.width + 2 * SYMBOL_SIZE, cutBottom - cutTop).fill(0xffffff);
	};
	setCutLines('landscape');

	const assets = () => context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
	const rendererOf = () => context.stateApp.pixiApplication?.renderer as PIXI.Renderer | undefined;
	// THE BOARD WELLS and their reactive veins (game/wells.ts, constants WELLS / WELLS_FX): in the frame's plate slot
	const wells = createWells(rendererOf);

	/** blend white towards a flash colour by `k` — cheaper than a filter and batches with the rest */
	const lerpTint = (color: number, k: number) => {
		if (k <= 0) return 0xffffff;
		const r = Math.round(255 + (((color >> 16) & 0xff) - 255) * k);
		const g = Math.round(255 + (((color >> 8) & 0xff) - 255) * k);
		const b = Math.round(255 + ((color & 0xff) - 255) * k);
		return (r << 16) | (g << 8) | b;
	};
	/** THE DIM RULE: a tint multiplied toward black by `dim` (1 = unchanged) */
	const darken = (color: number, dim: number) => {
		if (dim >= 1) return color;
		const d = dim <= 0 ? 0 : dim;
		return (Math.round(((color >> 16) & 0xff) * d) << 16) | (Math.round(((color >> 8) & 0xff) * d) << 8) | Math.round((color & 0xff) * d);
	};
	/** a colour between two, per channel */
	const mixColor = (a: number, b: number, t: number) => {
		const ch = (sh: number) => Math.round(((a >> sh) & 0xff) + (((b >> sh) & 0xff) - ((a >> sh) & 0xff)) * t);
		return (ch(16) << 16) | (ch(8) << 8) | ch(0);
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
	/** symbols whose idle loop is expected but was not in when the sheet was built: the deferred phase
	 *  publishes the drop sheets before the idle loops (game/deferredLoad.ts), so the idle is ADDED to the
	 *  sheet the frame it arrives (until then the cell rests on its drop's last frame) */
	const idleOwed = new Set<string>();
	const sheetFor = (name: string, tex: Record<string, PIXI.Texture> | undefined): Sheet | null => {
		const hit = sheets.get(name);
		if (hit) {
			if (idleOwed.has(name) && tex?.[`${name.toLowerCase()}-idle-000`]) {
				const idle = framesOf(tex, `${name.toLowerCase()}-idle`);
				idleOwed.delete(name);
				if (idle.length > 1) {
					hit.idle = idle;
					enableMipmaps(idle[0].source, rendererOf());
					// its source joins the GPU warm-up queue like the others
					if (uploadQueue && !queuedSources.has(idle[0].source)) {
						queuedSources.add(idle[0].source);
						uploadQueue.push(idle[0].source);
					}
				}
			}
			return hit;
		}
		if (!tex) return null;
		const code = name.toLowerCase();
		if (!tex[`${code}-drop-000`]) return null; // not in yet (the deferred phase lands all at once)
		const anim = symbolAnim(name);
		const drop = framesOf(tex, `${code}-drop`);
		const idle = anim.idle ? framesOf(tex, `${code}-idle`) : [];
		const sheet: Sheet = { drop, idle: idle.length > 1 ? idle : null, from: Math.min(anim.dropFrom, drop.length - 1) };
		if (anim.idle && !idle.length) idleOwed.add(name);
		// MIPMAPS (game/mipmaps.ts): once per sheet source, here, before any sprite draws a frame of it
		// and before the warm-up queue uploads it, so the chain is built with that one upload
		enableMipmaps(drop[0]?.source, rendererOf());
		if (sheet.idle) enableMipmaps(sheet.idle[0].source, rendererOf());
		sheets.set(name, sheet);
		return sheet;
	};
	// GPU warm-up: each sheet's source is uploaded the first time a frame of it is drawn, and a 2048 px
	// upload mid-cascade is a hitch. Once the sheets are parsed, upload every source up front, ONE per
	// tick (no textures are created: these are the sources the sheets already own).
	const SYMBOLS = ['L1', 'L2', 'L3', 'L4', 'M1', 'M2', 'M3', 'H1', 'W', 'S'];
	let uploadQueue: PIXI.TextureSource[] | null = null;
	const queuedSources = new Set<PIXI.TextureSource>();
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
			for (const src of set) queuedSources.add(src);
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
		s: PIXI.Sprite; g: PIXI.Sprite; gen: number; name: string; tex: PIXI.Texture | null; y: number; sx: number; sy: number; a: number; tint: number; z: number; glow: number; gc: number; rot: number;
		/** the symbol's own size (SYMBOL_PLACE) and offset in board px, set when the name changes; in the fall layer */
		k: number; pdx: number; pdy: number; top: number; fall: boolean; pop: boolean; rowZ: number;
		/** sheet playback: mode, style ms into the clip, the last Cell.landAt seen, still in the landing beat, the frame shown */
		mode: number; clock: number; landAt: number; landing: boolean; frame: number;
		/** WIN_FX: the shine group this tile holds while it shines (null otherwise) */
		sh: Shine | null;
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
		return { s, g, gen: -1, name: '', tex: null, y: NaN, sx: NaN, sy: NaN, a: NaN, tint: -1, z: -1, glow: 0, gc: AURA_COLOR, rot: 0, k: 1, pdx: 0, pdy: 0, top: 0, fall: false, pop: false, rowZ: 0, mode: MODE_STATIC, clock: 0, landAt: 0, landing: false, frame: -1, sh: null };
	};
	const live = new Map<number, Slot>(); // cell id -> its sprite
	const free: Slot[] = [];
	// the steady state is 64 on the board plus a refill's worth in the air, and through a reveal the
	// previous board's 64 falling off as well (BOARD_EXIT): pre-warm so neither allocates
	for (let i = 0; i < 2 * CELL_COUNT + 16; i += 1) free.push(slot());

	let gen = 0;
	let glowing = 0;
	/** set once a tick by sync(): real ms since the last tick and the style rate; dtIdle is what an idle loop's
	 *  clock takes (the real ms, or the style ms with SHEET_IDLE_TURBO) */
	let now = 0;
	let dtStyle = 0;
	let dtIdle = 0;
	let rate = 1;

	/** which texture a cell shows this tick (static atlas frame, or a sheet frame), advancing its clip */
	// the static atlas frame per symbol name, cached per loadedAssets object (no string built per frame)
	let staticOf = new Map<string, PIXI.Texture | null>();
	let staticFor: Record<string, PIXI.Texture> | undefined;
	const staticTexture = (name: string, tex: Record<string, PIXI.Texture> | undefined): PIXI.Texture | null => {
		if (tex !== staticFor) {
			staticFor = tex;
			staticOf = new Map();
			// MIPMAPS for the symbol atlas (statics, x2..x128 badges, cell well: one source), before the
			// board's first draw of it; a no-op for a source already done
			enableMipmaps(tex?.['L1.png']?.source, rendererOf());
			// and the numerals atlas (the readouts draw it at ~0.42 of a cell): flagged here so its first
			// upload, whenever the first amount draws, already carries the chain (ArtAmount does the same)
			enableMipmaps(tex?.['num_0.png']?.source, rendererOf());
			// and the plate glyphs (160 px em drawn at ~0.48 of a cell)
			enableMipmaps(tex?.[`${PLATE_GLYPH_PREFIX}0.png`]?.source, rendererOf());
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
	/** a cell's rest between idle loops (SYMBOL_IDLE_REST): fixed per board position, spread over min..max */
	let idleRestOn = true; // DEV: __manticore.setIdleRest(false) gives the old back to back loops (sheet_probe's 30 fps check)
	const idleRest = (reel: number, row: number) =>
		!idleRestOn ? 0 : SYMBOL_IDLE_REST.minMs + (((reel * 37 + row * 61) % 64) / 63) * (SYMBOL_IDLE_REST.maxMs - SYMBOL_IDLE_REST.minMs);
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
			// with SYMBOL_IDLE_REST the phase is spread over the cell's whole rest + loop cycle, so a fresh board
			// already has a few cells mid-glint instead of every cell resting for its first 7 s
			sl.clock = sheet.idle
				? (((c.reel * 29 + c.row * 47) % 60) / 60) * (idleRest(c.reel, c.row) + sheet.idle.length * FRAME_MS)
				: idleOffset(c.reel, c.row);
		} else if (!fresh && !frozen) {
			// the landing's drop sheet keeps its turbo speed; the idle loop of a resting piece does not take it
			sl.clock += sl.mode === MODE_IDLE ? dtIdle : dtStyle;
		}
		if (sl.mode === MODE_DROP) {
			const span = (sheet.drop.length - sheet.from) * FRAME_MS;
			if (sl.clock < span) {
				sl.frame = sheet.from + Math.floor(sl.clock / FRAME_MS);
				return sheet.drop[sl.frame];
			}
			sl.mode = MODE_IDLE;
			sl.clock -= span;
			// SYMBOL_IDLE_REST: a landed cell joins its rest part way through (per position), so the first glints
			// after a landing come at staggered times instead of the whole board holding still for the shortest rest
			if (sheet.idle) sl.clock += (((c.reel * 41 + c.row * 23) % 60) / 60) * idleRest(c.reel, c.row);
		}
		// idle: loop the idle sheet, or rest on the drop's last frame when there is none
		if (!sheet.idle) {
			sl.frame = sheet.drop.length - 1;
			return sheet.drop[sl.frame];
		}
		// each cycle: the cell's rest on idle frame 0 (the rest pose), then one loop of the sheet (SYMBOL_IDLE_REST)
		const n = sheet.idle.length;
		const rest = idleRest(c.reel, c.row);
		const t = sl.clock % (rest + n * FRAME_MS);
		sl.frame = t < rest ? 0 : Math.floor((t - rest) / FRAME_MS) % n;
		return sheet.idle[sl.frame];
	};

	// ---- THE WIN SHINE (WIN_FX.shine): the logo's Shine on a symbol. A group per shining tile: the tile's OWN current
	// frame (the frozen sheet frame while it wins, the atlas frame while it pops) cut into cols x rows strips, each an
	// additive copy whose opacity is the band; the heat (the pop) is one more additive copy of the whole frame. The
	// strips' textures are the group's own, made once with the group and only re-pointed (source + frame,
	// Texture.update) when the tile's frame changes: no texture is ever created per frame. Groups are pooled (grown one
	// per tick at rest up to SHINE_PREWARM, more only if a win set needs them), taken when a win set starts and given
	// back when it ends. All of them sit in ONE additive layer just over the tiles (not interleaved with the tiles, so
	// the strips batch together instead of breaking the tiles' batch twice per winner). NO VISIBILITY TOGGLES inside a
	// held group: the stage is one render group and every `visible` flip rebuilds its whole instruction set, so a strip
	// is lit and dimmed by its alpha only (0 = drawn as nothing), and the group's transform follows its tile only while
	// it shows anything. No mask, no filter.
	const SH_COLS = PHONE_TIER ? WIN_FX.shine.colsPhone : WIN_FX.shine.cols;
	const SH_ROWS = PHONE_TIER ? WIN_FX.shine.rowsPhone : WIN_FX.shine.rows;
	const SH_N = SH_COLS * SH_ROWS;
	const SHINE_PREWARM = winFx.style === 'new' ? (PHONE_TIER ? 20 : 28) : 0;
	const shineLayer = new PIXI.Container({ zIndex: 0.5, label: 'winShine' });
	if (SHINE_PREWARM > 0) parent.addToParent(shineLayer);
	type Shine = { root: PIXI.Container; full: PIXI.Sprite; strips: PIXI.Sprite[]; texs: PIXI.Texture[]; alpha: Float32Array; src: PIXI.Texture | null; lit: boolean };
	const shinePool: Shine[] = [];
	const shineAll: Shine[] = [];
	let shineInUse = 0;
	const makeShine = (): Shine => {
		const root = new PIXI.Container({ label: 'winShine' });
		root.visible = false;
		const strips: PIXI.Sprite[] = [];
		const texs: PIXI.Texture[] = [];
		const full = new PIXI.Sprite(PIXI.Texture.EMPTY);
		full.anchor.set(0.5);
		full.blendMode = 'add';
		full.tint = WIN_FX.shine.tint;
		full.alpha = 0;
		root.addChild(full);
		for (let k = 0; k < SH_N; k += 1) {
			const t = new PIXI.Texture({ source: PIXI.Texture.WHITE.source, frame: new PIXI.Rectangle(0, 0, 1, 1), dynamic: true });
			const st = new PIXI.Sprite(t);
			st.blendMode = 'add';
			st.tint = WIN_FX.shine.tint;
			st.alpha = 0;
			root.addChild(st);
			strips.push(st);
			texs.push(t);
		}
		shineLayer.addChild(root);
		const g = { root, full, strips, texs, alpha: new Float32Array(SH_N), src: null, lit: false };
		shineAll.push(g);
		winFxStats.shinePool = shineAll.length;
		return g;
	};
	/** point a group's strips at `tex` (the tile's frame), laid out over its orig box about the centre (anchor 0.5) */
	const aimShine = (g: Shine, tex: PIXI.Texture) => {
		g.src = tex;
		g.full.texture = tex;
		const F = tex.frame;
		const O = tex.orig;
		for (let j = 0; j < SH_ROWS; j += 1) {
			for (let i = 0; i < SH_COLS; i += 1) {
				const k = j * SH_COLS + i;
				const t = g.texs[k];
				if (t.source !== tex.source) t.source = tex.source;
				t.frame.x = F.x + (i * F.width) / SH_COLS;
				t.frame.y = F.y + (j * F.height) / SH_ROWS;
				t.frame.width = F.width / SH_COLS;
				t.frame.height = F.height / SH_ROWS;
				t.update();
				g.strips[k].position.set(-O.width / 2 + (i * O.width) / SH_COLS, -O.height / 2 + (j * O.height) / SH_ROWS);
			}
		}
	};
	const dropShine = (sl: Slot) => {
		const g = sl.sh;
		if (!g) return;
		sl.sh = null;
		g.root.visible = false;
		// handed back dark (every strip and the heat at 0), so the next owner starts from nothing lit
		if (g.lit) {
			for (let k = 0; k < SH_N; k += 1) {
				if (g.alpha[k] !== 0) {
					g.alpha[k] = 0;
					g.strips[k].alpha = 0;
				}
			}
			g.full.alpha = 0;
			g.lit = false;
		}
		shinePool.push(g);
		shineInUse -= 1;
	};
	/** draw tile `sl`'s shine this tick (`fx` from the engine, `alpha` the tile's own) */
	const drawShine = (sl: Slot, fx: ShineCell, alpha: number) => {
		const tex = sl.tex;
		if (!tex || tex.rotate) return;
		let g = sl.sh;
		if (!g) {
			g = shinePool.pop() ?? makeShine();
			sl.sh = g;
			g.root.visible = true;
			shineInUse += 1;
		}
		const on = fx.a > 0 || fx.heat > 0;
		// dark and staying dark: nothing to move or write. A group is aimed at its tile's frame only when it first
		// lights (the sweeps start staggered, so a big win set's aims spread over several frames, not its first one)
		if (!on && !g.lit) return;
		if (g.src !== tex) aimShine(g, tex);
		g.lit = on;
		const s = sl.s;
		g.root.position.set(s.x, s.y);
		g.root.rotation = s.rotation;
		g.root.scale.set(s.scale.x, s.scale.y);
		// the heat: the whole frame once; a strip adds only what the band has over it (additive: heat + strip = band)
		let heat = fx.heat * alpha;
		if (heat < 0.004) heat = 0;
		if (g.full.alpha !== heat) g.full.alpha = heat;
		const S = WIN_FX.shine;
		const half = S.band / 2;
		for (let j = 0; j < SH_ROWS; j += 1) {
			// the band leans: its centre on this row of strips
			const centre = fx.band + S.slant * ((j + 0.5) / SH_ROWS - 0.5);
			for (let i = 0; i < SH_COLS; i += 1) {
				const d = Math.abs((i + 0.5) / SH_COLS - centre);
				const band = fx.a > 0 && d < half ? fx.a * (1 - d / half) : 0;
				let a = band > fx.heat ? (band - fx.heat) * alpha : 0;
				if (a < 0.004) a = 0;
				const k = j * SH_COLS + i;
				if (g.alpha[k] === a) continue;
				g.alpha[k] = a;
				g.strips[k].alpha = a;
			}
		}
	};

	/** the symbol's place numbers into the slot (on a name change only) */
	const placeOf = (sl: Slot, name: string) => {
		const p = SYMBOL_PLACE.symbols[name];
		sl.k = symbolScale(name);
		sl.pdx = (p?.dx ?? 0) * PER_MASTER;
		sl.pdy = (p?.dy ?? 0) * PER_MASTER;
		sl.top = p?.top ?? 0;
	};
	let inFall = 0;
	/** set once a tick by sync(): the board's own cells are falling off (a press exit not yet handed to `leaving`) */
	let exitPressing = false;
	/** `leaving`: one of the previous board's tiles falling off (BOARD_EXIT) */
	const syncCell = (c: Cell, tex: Record<string, PIXI.Texture> | undefined, leaving = false) => {
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
			sl.s.x = NaN;
			sl.pop = false;
			if (sl.fall) {
				sl.fall = false;
				cellLayer.addChild(sl.s);
			}
			sl.s.visible = true;
			live.set(c.id, sl);
		}
		sl.gen = gen;
		const s = sl.s;
		if (sl.name !== c.name) {
			// a new symbol (the sting's flip): its own clip, from rest
			if (sl.name && sl.mode !== MODE_STATIC) sl.mode = MODE_STATIC;
			sl.name = c.name;
			placeOf(sl, c.name);
			sl.sx = sl.sy = NaN; // its own size
			sl.z = -1;
		}
		const t = pickTexture(c, sl, tex);
		if (t !== sl.tex) {
			// sheet frames and atlas frames share one cell size per tier, so a frame switch keeps the
			// sprite's size; only a change of texture SIZE (or the first texture) re-applies it
			if (!sl.tex || !t || t.orig.width !== sl.tex.orig.width) sl.sx = sl.sy = NaN;
			s.texture = t ?? PIXI.Texture.EMPTY;
			sl.tex = t;
		}
		// THE TRUE OPENING of the row it is at (interpolated in the air) plus the symbol's own dx / dy; c.dx / rot: the
		// roar's rattle and fall (0 at rest)
		offsetAt(op, c.reel, c.y, off);
		const x = (c.reel + 0.5 + c.dx) * SYMBOL_SIZE + off.x + sl.pdx;
		const y = (c.y + 0.5) * SYMBOL_SIZE + off.y + sl.pdy;
		if (s.x !== x) {
			s.x = x;
			sl.g.x = x;
		}
		if (s.y !== y) {
			sl.y = c.y;
			s.y = y;
			sl.g.y = y;
		}
		// WIN_FX: the shine bus for this tile (a winner's band / heat / breath), read once
		const fx = shineCells.size ? shineCells.get(c.id) : undefined;
		const pulse = fx ? fx.pulse : 1;
		if (c.scaleX * pulse !== sl.sx || c.scaleY * pulse !== sl.sy) {
			sl.sx = c.scaleX * pulse;
			sl.sy = c.scaleY * pulse;
			s.setSize(SIZE * sl.k * sl.sx, SIZE * sl.k * sl.sy);
		}
		// THE CUT LAYER: in the air on the way in (above its row, not in its landing beat, no rattle) with its sprite
		// over the top cut line, or on the way out (the board exit from the press on, the roar's fall) over the bottom
		// cut line. `reach`: how far the sprite runs up / down from its centre, tipped (a tipping tile's corner); the
		// mask cuts the pixels past the line, and a tile not yet past it draws whole, so nothing shows past the line. A
		// resting tile (y on its row) is never in it: its overhang shows whole until it starts to fall
		const half = (SIZE * sl.k * Math.max(c.scaleX, c.scaleY, 1)) / 2;
		const reach = c.rot === 0 ? half : half * (Math.abs(Math.cos(c.rot)) + Math.abs(Math.sin(c.rot)));
		const entering = c.y < c.row - 1e-4 && !sl.landing && c.dx === 0 && c.rot === 0 && c.state !== 'removing';
		const outgoing = (leaving || exitPressing || c.state === 'removing') && c.y > c.row + 1e-4;
		const fall = (entering && y - reach < cutTop) || (outgoing && y + reach > cutBottom);
		if (fall !== sl.fall) {
			sl.fall = fall;
			(fall ? fallTiles : cellLayer).addChild(s);
			sl.z = -1;
		}
		if (fall) inFall += 1;
		if (c.rot !== sl.rot) {
			sl.rot = c.rot;
			s.rotation = c.rot;
		}
		if (c.alpha !== sl.a) {
			sl.a = c.alpha;
			s.alpha = c.alpha;
		}
		const tint = darken(lerpTint(c.flashColor, c.flash), c.dim);
		if (tint !== sl.tint) {
			sl.tint = tint;
			s.tint = tint;
		}
		// THE DRAW ORDER (the playground's sort): the pop band over the resting band; inside each, the "on top" number,
		// then lower rows on top, then the cell
		const placed = Math.abs(c.y - c.row) < 1e-4;
		const pop = (c.scaleX > 1 + 1e-4 && c.scaleY > 1 + 1e-4) || (c.state === 'removing' && placed);
		sl.pop = pop;
		const rowNow = c.y <= 0 ? 0 : c.y >= GRID - 1 ? GRID - 1 : Math.round(c.y);
		sl.rowZ = rowNow;
		const z = (pop ? 1000 : 0) + sl.top * 100 + rowNow * 10 + c.reel / 10;
		if (z !== sl.z) {
			sl.z = z;
			s.zIndex = z;
		}
		if (c.glow !== sl.glow) {
			sl.glow = c.glow;
			sl.g.visible = c.glow > 0;
			if (c.glow > 0) sl.g.alpha = c.glow;
		}
		if (c.glowColor !== sl.gc) {
			sl.gc = c.glowColor;
			sl.g.tint = c.glowColor;
		}
		if (c.glow > 0) glowing += 1;
		// WIN_FX: the shine over this tile while the engine has one for it (game/winFx.ts shineCells)
		if (fx && !sl.fall) drawShine(sl, fx, c.alpha);
		else if (sl.sh) dropShine(sl);
		// the plate this cell stands on: covered while the symbol sits on it (the playground's rule: within
		// half a row, still opaque), darkened with it
		if (c.alpha > 0.5 && c.scaleX > 0.05) {
			const row = Math.round(c.y);
			if (row >= 0 && row < 8 && Math.abs(c.y - row) < 0.5) {
				const k = c.reel * 8 + row;
				coverDim[k] = Math.min(coverDim[k], c.dim);
				covered[k] = 1;
			}
		}
	};

	// ---- the multiplier TILES (MULT_PLATE.style 'cell', Corey 2026-10-13 12:06) --------------------------------
	// Each cell's own whole-cell box (bar centre line to bar centre line, from op.box), under the frame: the fill
	// (MULT_PLATE.fillAlpha) and the border (borderAlpha, borderMasterPx in from the bar centre line, cornerPx inner
	// radius) are drawn only when their alpha is over 0 (both 0 today), the INNER GLOW (one baked white square, bright
	// at its edge: fxTexture innerGlowTexture) tinted the level colour at innerGlowAlpha and stretched to the box, and
	// the number in the box's middle. A layout change re-places them (relayoutPlates); nothing is redrawn per frame.
	/** the number's font size (canvas px of the playground: the em, not the digit height) */
	const NUM_EM = SYMBOL_SIZE * MULT_PLATE.numberSizeCells;
	/** the coloured copy under the white face reaches this far past each glyph (board px). The
	 *  playground strokes 0.06 em centred on the outline; the copy shows only the outer part, so it is
	 *  drawn a little wider than that stroke's outer half to keep the coloured rim readable */
	const OUTLINE = NUM_EM * 0.05;
	/** the border's width in board px (desktop master px at the playground's pitch) */
	const TILE_BORDER = MULT_PLATE.borderMasterPx * PER_MASTER;
	/** the widest the number's ink (outline included) may run: inside the narrowest tile's visible border. Wider than
	 *  this the TRACKING closes up, never the height. Set per layout (relayoutPlates). */
	let NUM_MAX_W = SYMBOL_SIZE - 2 * OUTLINE;
	const PLATE_KEY_0 = `${PLATE_GLYPH_PREFIX}0.png`;
	type PlateGlyphRect = { key: string; x: number; y: number; w: number; h: number };
	/** canvas fillText's layout of `text` at NUM_EM with textAlign centre and textBaseline middle, as
	 *  rects about (0, 0); null when a character is not in the atlas */
	const layoutPlate = (text: string): { glyphs: PlateGlyphRect[]; track: number } | null => {
		const gs: (typeof PLATE_GLYPHS)[string][] = [];
		for (const ch of text) {
			const g = PLATE_GLYPHS[ch];
			if (!g) return null;
			gs.push(g);
		}
		if (!gs.length) return null;
		const lay = (track: number) => {
			let pen = 0;
			let prev = '';
			const out: PlateGlyphRect[] = [];
			let i = 0;
			for (const ch of text) {
				const g = gs[i];
				if (i > 0) pen += (PLATE_KERN[prev + ch] ?? 0) * NUM_EM + track;
				out.push({ key: `${PLATE_GLYPH_PREFIX}${g.key}.png`, x: pen + g.x * NUM_EM, y: g.y * NUM_EM, w: g.w * NUM_EM, h: g.h * NUM_EM });
				pen += g.adv * NUM_EM;
				prev = ch;
				i += 1;
			}
			// centred on the advance box, baseline PLATE_GLYPH_MIDDLE em below the middle line
			const dx = -pen / 2;
			const dy = PLATE_GLYPH_MIDDLE * NUM_EM;
			for (const r of out) {
				r.x += dx;
				r.y += dy;
			}
			return out;
		};
		const inkW = (rs: PlateGlyphRect[]) => rs[rs.length - 1].x + rs[rs.length - 1].w - rs[0].x;
		let glyphs = lay(0);
		let track = 0;
		const over = inkW(glyphs) - NUM_MAX_W;
		if (over > 0 && glyphs.length > 1) {
			track = -over / (glyphs.length - 1);
			glyphs = lay(track);
		}
		return { glyphs, track };
	};
	const GLOW = MULT_PLATE.numberGlowPx * PLAYGROUND_PX;
	const covered = new Uint8Array(CELL_COUNT);
	const coverDim = new Float32Array(CELL_COUNT);

	type Row = { c: PIXI.Container; out: PIXI.Container; face: PIXI.Container; text: string; w: number; h: number; track: number; scale: number; alpha: number; tint: number; ftint: number };
	type Plate = { root: PIXI.Container; g: PIXI.Graphics; inner: PIXI.Sprite; glow: PIXI.Sprite; old: Row; cur: Row; value: number; from: number; tint: number; glowTint: number; numAlpha: number; shown: boolean; ghost: boolean };
	const plates: (Plate | null)[] = Array(CELL_COUNT).fill(null);
	const glyphPool: PIXI.Sprite[] = [];
	const row = (): Row => {
		const c = new PIXI.Container();
		const out = new PIXI.Container();
		const face = new PIXI.Container();
		c.addChild(out, face);
		return { c, out, face, text: '', w: 0, h: 0, track: 0, scale: NaN, alpha: NaN, tint: -1, ftint: -1 };
	};
	/** one tile's geometry for its cell's box (op.box): the root on the box centre, the fill / border drawn white
	 *  (the colour is the tint) only when their alphas are over 0, the inner glow stretched to the box */
	const placePlate = (p: Plate, index: number) => {
		const b = op.box;
		const k = index * 4;
		const w = b[k + 2] - b[k];
		const h = b[k + 3] - b[k + 1];
		p.root.position.set((b[k] + b[k + 2]) / 2, (b[k + 1] + b[k + 3]) / 2);
		p.g.clear();
		if (MULT_PLATE.fillAlpha > 0) p.g.rect(-w / 2, -h / 2, w, h).fill({ color: 0xffffff, alpha: MULT_PLATE.fillAlpha });
		if (MULT_PLATE.borderAlpha > 0 && TILE_BORDER > 0) {
			const W = Math.min(TILE_BORDER, w / 2 - 0.5);
			const R = MULT_PLATE.cornerPx * PER_MASTER;
			p.g.rect(-w / 2, -h / 2, w, h).fill({ color: 0xffffff, alpha: MULT_PLATE.borderAlpha });
			p.g.roundRect(-w / 2 + W, -h / 2 + W, w - 2 * W, h - 2 * W, R).cut();
		}
		p.g.visible = MULT_PLATE.fillAlpha > 0 || MULT_PLATE.borderAlpha > 0;
		p.inner.setSize(w, h);
	};
	const plateAt = (index: number): Plate => {
		let p = plates[index];
		if (p) return p;
		const root = new PIXI.Container();
		const g = new PIXI.Graphics();
		// THE INNER GLOW: the baked white square (bright at its edge, clear in the middle), tinted the level colour
		const inner = new PIXI.Sprite(innerGlowTexture());
		inner.anchor.set(0.5);
		inner.alpha = MULT_PLATE.innerGlowAlpha;
		inner.visible = MULT_PLATE.innerGlowAlpha > 0;
		const glow = new PIXI.Sprite(glowTexture());
		glow.anchor.set(0.5);
		const old = row();
		const cur = row();
		root.addChild(g, inner, glow, old.c, cur.c);
		plateLayer.addChild(root);
		p = { root, g, inner, glow, old, cur, value: -1, from: -1, tint: -1, glowTint: -1, numAlpha: NaN, shown: true, ghost: false };
		placePlate(p, index);
		plates[index] = p;
		return p;
	};
	/** a layout change: every tile on its cell's new box, the number's width limit for the narrowest box, the
	 *  flashes on the openings */
	const relayoutPlates = () => {
		let narrowest = Infinity;
		for (let i = 0; i < CELL_COUNT; i += 1) narrowest = Math.min(narrowest, op.box[i * 4 + 2] - op.box[i * 4]);
		const border = MULT_PLATE.borderAlpha > 0 ? Math.max(0, TILE_BORDER - op.bar / 2) : 0;
		const maxW = narrowest - op.bar - 2 * border - 2 * OUTLINE;
		if (Math.abs(maxW - NUM_MAX_W) > 1e-6) {
			NUM_MAX_W = maxW;
			// the rows lay out again at the next frame
			for (const p of plates) if (p) p.cur.text = p.old.text = '';
		}
		plates.forEach((p, i) => p && placePlate(p, i));
		flashes.forEach((f, i) => f.position.set((reelOf(i) + 0.5) * SYMBOL_SIZE + op.ox[i], (rowOf(i) + 0.5) * SYMBOL_SIZE + op.oy[i]));
	};
	/** lay a row's glyphs out for `text` (only when it changes): the white face and the coloured copy */
	const setRow = (r: Row, text: string, tex: Record<string, PIXI.Texture> | undefined) => {
		if (r.text === text) return true;
		const laid = layoutPlate(text);
		if (!laid || !tex?.[PLATE_KEY_0]) return false;
		const glyphs = laid.glyphs;
		const fill = (layer: PIXI.Container, grow: number) => {
			while (layer.children.length < glyphs.length) layer.addChild(glyphPool.pop() ?? new PIXI.Sprite(PIXI.Texture.EMPTY));
			while (layer.children.length > glyphs.length) glyphPool.push(layer.removeChildAt(layer.children.length - 1) as PIXI.Sprite);
			layer.children.forEach((child, i) => {
				const s = child as PIXI.Sprite;
				const gl = glyphs[i];
				s.texture = tex[gl.key] ?? PIXI.Texture.EMPTY;
				s.position.set(gl.x - grow, gl.y - grow);
				s.setSize(gl.w + 2 * grow, gl.h + 2 * grow);
				s.visible = true;
			});
		};
		// the coloured copy: every glyph grown by OUTLINE on each side about its own centre
		fill(r.out, OUTLINE);
		fill(r.face, 0);
		let x0 = Infinity;
		let x1 = -Infinity;
		let y0 = Infinity;
		let y1 = -Infinity;
		for (const gl of glyphs) {
			x0 = Math.min(x0, gl.x);
			x1 = Math.max(x1, gl.x + gl.w);
			y0 = Math.min(y0, gl.y);
			y1 = Math.max(y1, gl.y + gl.h);
		}
		r.w = x1 - x0;
		r.h = y1 - y0;
		r.track = laid.track;
		r.text = text;
		// glyph sprites come out of a pool shared by the faces and the coloured copies, so one added
		// here still wears its last owner's tint: showRow must re-tint the whole row
		r.tint = -1;
		r.ftint = -1;
		return true;
	};
	const showRow = (r: Row, scale: number, alpha: number, color: number, dim: number) => {
		const on = alpha > 0.001 && scale > 0.001;
		if (r.c.visible !== on) r.c.visible = on;
		if (!on) return;
		if (scale !== r.scale) {
			r.scale = scale;
			r.c.scale.set(scale);
		}
		if (alpha !== r.alpha) {
			r.alpha = alpha;
			r.c.alpha = alpha;
		}
		const t = darken(color, dim);
		if (t !== r.tint) {
			r.tint = t;
			for (const s of r.out.children) (s as PIXI.Sprite).tint = t;
		}
		const ft = darken(0xffffff, dim);
		if (ft !== r.ftint) {
			r.ftint = ft;
			for (const s of r.face.children) (s as PIXI.Sprite).tint = ft;
		}
	};
	const syncPlates = (tex: Record<string, PIXI.Texture> | undefined) => {
		const tiles = stateGame.tiles;
		for (let i = 0; i < CELL_COUNT; i += 1) {
			const tile = tiles[i];
			const value = tile?.value ?? 0;
			let p = plates[i];
			if (!value) {
				// a plate a reset just cleared (BOARD_EXIT.plateOutMs): the picture shrinks away, the value
				// is already gone. `shown` stays the book's truth (false); `ghost` is only the picture.
				const gh = plateGhosts[i];
				const u = gh && p ? ((now - gh.t0) * gh.rate) / Math.max(BOARD_EXIT.plateOutMs, 1) : 1;
				if (p && u < 1) {
					p.shown = false;
					p.ghost = true;
					p.root.visible = true;
					p.root.scale.set(1 - quadIn(Math.max(0, u)));
				} else {
					if (gh) plateGhosts[i] = null;
					if (p && (p.shown || p.ghost)) {
						p.shown = false;
						p.ghost = false;
						p.root.visible = false;
						p.root.scale.set(1);
					}
				}
				continue;
			}
			p ??= plateAt(i);
			if (!p.shown || p.ghost) {
				p.shown = true;
				p.ghost = false;
				p.root.visible = true;
				p.root.scale.set(1);
			}
			const chg = tile.chg;
			const from = chg < 1 ? tile.from : 0;
			if (!setRow(p.cur, `x${value}`, tex)) continue; // the atlas is not in yet: next frame
			if (from && !setRow(p.old, `x${from}`, tex)) continue;
			const dim = covered[i] ? coverDim[i] : 1;
			// the colour lerps old -> new over the count (quadOut); the reveal pop scales the number
			const col = from ? mixColor(plateColor(from), plateColor(value), quadOut(chg)) : plateColor(value);
			const tint = darken(col, dim);
			if (tint !== p.tint) {
				p.tint = tint;
				p.g.tint = tint;
				p.inner.tint = tint;
			}
			const pop = tile.pop < 1 ? 1 + (MULT_PLATE.revealPopScale - 1) * Math.sin(Math.PI * tile.pop) : 1;
			const numA = covered[i] ? MULT_PLATE.numberAlphaUnderSymbol : MULT_PLATE.numberAlphaEmpty;
			// COUNT: the old number shrinks away over the first 45 % (quadIn), the new one grows in (backOut)
			let oldScale = 0;
			let curScale = pop;
			if (chg < 1) {
				if (chg < 0.45 && from) {
					oldScale = (1 - quadIn(chg / 0.45)) * pop;
					curScale = 0;
				} else curScale = Math.max(0.01, backOut(Math.max(0, (chg - 0.45) / 0.55))) * pop;
			}
			showRow(p.old, oldScale, oldScale > 0 ? numA * Math.min(1, oldScale / pop) : 0, col, dim);
			showRow(p.cur, curScale, numA, col, dim);
			// the glow hugs whichever number is showing
			const shown = oldScale > 0 ? p.old : p.cur;
			const gs = oldScale > 0 ? oldScale : curScale;
			p.glow.visible = MULT_PLATE.numberGlowPx > 0 && gs > 0.01;
			if (p.glow.visible) {
				p.glow.setSize((shown.w + 2 * GLOW) * gs, (shown.h + 2 * GLOW) * gs);
				if (tint !== p.glowTint) {
					p.glowTint = tint;
					p.glow.tint = tint;
				}
				if (numA !== p.numAlpha) {
					p.numAlpha = numA;
					p.glow.alpha = 0.8 * numA;
				}
			}
		}
	};

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
	// (the 'old' look's dots only: WIN_FX has its own embers below)
	const POOL = winFx.style === 'old' ? PER_CELL * SPARKLE.maxCells : 0;
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
		const bi = b.reel * GRID + b.row;
		const ox = (b.reel + 0.5) * SYMBOL_SIZE + (bi >= 0 && bi < CELL_COUNT ? op.ox[bi] : 0);
		const oy = (b.row + 0.5) * SYMBOL_SIZE + (bi >= 0 && bi < CELL_COUNT ? op.oy[bi] : 0);
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

	// ---- THE WIN BURST AND THE EMBERS (WIN_FX.burst / WIN_FX.embers), the 'new' look only. Pools sized once at
	// mount: per burst a ray sprite and a soft round glow (one container, additive, over the tiles where the flashes
	// were), and one particle container of embers on one baked streak texture. Zero allocation per burst. ----------
	const NEW_FX = winFx.style === 'new';
	const BR = WIN_FX.burst;
	const EM = WIN_FX.embers;
	type BurstSlot = { rays: PIXI.Sprite; core: PIXI.Sprite; on: boolean; t0: number; rl: number; cl: number; rot0: number; spin: number };
	const burstLayer = new PIXI.Container({ zIndex: 11, label: 'winBurst' });
	burstLayer.visible = false;
	const burstSlots: BurstSlot[] = [];
	const RAYS_K = SYMBOL_SIZE / RAYS_PX;
	const CORE_K = SYMBOL_SIZE / CORE_PX;
	const EM_PER = PHONE_TIER ? EM.countPhone : EM.count;
	const EM_POOL = NEW_FX ? EM_PER * EM.maxCells : 0;
	type Ember = { p: PIXI.Particle; alive: boolean; ox: number; oy: number; cx: number; cy: number; lift: number; t0: number; ms: number; roll: number; fl: number };
	const emberLayer = new PIXI.ParticleContainer({
		zIndex: 12,
		visible: false,
		texture: emberTexture(),
		dynamicProperties: { position: true, scale: true, rotation: true, color: true },
	});
	emberLayer.blendMode = 'add';
	const embers: Ember[] = [];
	const freeEmbers: Ember[] = [];
	if (NEW_FX) {
		parent.addToParent(burstLayer);
		parent.addToParent(emberLayer);
		for (let i = 0; i < BR.maxCells; i += 1) {
			const rays = new PIXI.Sprite(raysTexture());
			const core = new PIXI.Sprite(coreTexture());
			for (const sp of [rays, core]) {
				sp.anchor.set(0.5);
				sp.blendMode = 'add';
				sp.alpha = 0;
				sp.scale.set(0);
				burstLayer.addChild(sp);
			}
			burstSlots.push({ rays, core, on: false, t0: 0, rl: 1, cl: 1, rot0: 0, spin: 0 });
		}
		for (let i = 0; i < EM_POOL; i += 1) {
			const p = new PIXI.Particle({ texture: emberTexture(), x: 0, y: 0, scaleX: 0, scaleY: 0, anchorX: 0.5, anchorY: 0.5, alpha: 0 });
			emberLayer.addParticle(p);
			const e: Ember = { p, alive: false, ox: 0, oy: 0, cx: 0, cy: 0, lift: 0, t0: 0, ms: 1, roll: 1, fl: 0 };
			embers.push(e);
			freeEmbers.push(e);
		}
		sparkleStats.poolSize = EM_POOL;
	}
	let aliveEmbers = 0;
	let burstsOn = 0;
	const EM_SPREAD = EM.spreadCells * SYMBOL_SIZE;
	const EM_GRAV = EM.gravity * SYMBOL_SIZE;
	const EM_LIFT = EM.lift * SYMBOL_SIZE;
	const EM_SCALE = EM.sizePx / EMBER_W;
	/** an ease out that lands hard (the burst's growth) */
	const cubicOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

	const spawnWin = (b: WinBurst) => {
		const rnd = seeded(b.seed);
		const bi = b.reel * GRID + b.row;
		const ox = (b.reel + 0.5) * SYMBOL_SIZE + (bi >= 0 && bi < CELL_COUNT ? op.ox[bi] : 0);
		const oy = (b.row + 0.5) * SYMBOL_SIZE + (bi >= 0 && bi < CELL_COUNT ? op.oy[bi] : 0);
		// the burst: a free slot, or (never more than maxCells in flight) the oldest one is taken over
		let slotB: BurstSlot | null = null;
		for (const bs of burstSlots) {
			if (!bs.on) {
				slotB = bs;
				break;
			}
		}
		if (!slotB) {
			winFxStats.burstDropped += 1;
			slotB = burstSlots[0];
			for (const bs of burstSlots) if (bs.t0 < slotB.t0) slotB = bs;
		} else burstsOn += 1;
		slotB.on = true;
		slotB.t0 = b.t0;
		slotB.rl = b.rays;
		slotB.cl = b.core;
		slotB.rot0 = rnd() * Math.PI * 2;
		slotB.spin = (rnd() < 0.5 ? -1 : 1) * BR.rays.spin;
		slotB.rays.position.set(ox, oy);
		slotB.core.position.set(ox, oy);
		slotB.rays.tint = b.tint;
		slotB.core.tint = mixColor(b.tint, 0xffffff, BR.core.whiten);
		// the embers: spread evenly round the cell with a jitter, so a handful never bunches up
		const tint = mixColor(b.tint, 0xffffff, EM.whiten);
		for (let i = 0; i < EM_PER; i += 1) {
			const a = ((i + rnd() * 0.7) / EM_PER) * Math.PI * 2;
			const sp = (0.6 + rnd() * 0.8) * EM_SPREAD;
			const e = freeEmbers.pop();
			if (!e) {
				sparkleStats.dropped += 1;
				continue;
			}
			e.alive = true;
			e.ox = ox;
			e.oy = oy;
			e.cx = Math.cos(a) * sp;
			e.cy = Math.sin(a) * sp;
			e.lift = EM_LIFT * (0.6 + rnd() * 0.8);
			e.t0 = b.t0;
			e.ms = b.embers * (0.7 + rnd() * 0.3);
			e.roll = 0.75 + rnd() * 0.5;
			e.fl = rnd() * Math.PI * 2;
			e.p.tint = tint;
			aliveEmbers += 1;
		}
	};

	/** a fade in over `inShare`, then a falloff to nothing (squared, so it lets go quickly) */
	const envelope = (v: number, inShare: number) => (v < inShare ? v / inShare : (1 - (v - inShare) / (1 - inShare)) ** 2);
	let emberWarm = 3;
	const tickWinFx = (now: number) => {
		const fresh = takeWinBursts();
		for (let i = 0; i < fresh.length; i += 1) spawnWin(fresh[i]);
		// the particle pipe compiles on its first render: at mount, not at the first pop (as the sparkles do)
		if (emberWarm > 0) {
			emberWarm -= 1;
			emberLayer.visible = true;
			burstLayer.visible = true;
			emberLayer.update();
			if (emberWarm === 0 && aliveEmbers === 0 && burstsOn === 0) {
				emberLayer.visible = false;
				burstLayer.visible = false;
			}
			if (aliveEmbers === 0 && burstsOn === 0) return;
		}
		if (aliveEmbers === 0 && burstsOn === 0) {
			if (emberLayer.visible) emberLayer.visible = false;
			if (burstLayer.visible) burstLayer.visible = false;
			sparkleStats.inUse = 0;
			winFxStats.burstsInUse = 0;
			return;
		}
		// the bursts: the rays grow and turn, the glow grows; each fades in, then out
		for (const bs of burstSlots) {
			if (!bs.on) continue;
			const el = now - bs.t0;
			const vr = el / bs.rl;
			const vc = el / bs.cl;
			// (no visibility flips: a finished sprite is alpha 0 at scale 0, see the shine's note on render groups)
			if (vr >= 1 && vc >= 1) {
				bs.on = false;
				bs.rays.alpha = bs.core.alpha = 0;
				bs.rays.scale.set(0);
				bs.core.scale.set(0);
				burstsOn -= 1;
				continue;
			}
			if (vr < 1 && vr >= 0) {
				bs.rays.scale.set(RAYS_K * (BR.rays.fromCells + (BR.rays.toCells - BR.rays.fromCells) * cubicOut(vr)));
				bs.rays.rotation = bs.rot0 + bs.spin * vr;
				bs.rays.alpha = BR.rays.peak * envelope(vr, BR.rays.inShare);
			} else if (bs.rays.alpha !== 0) {
				bs.rays.alpha = 0;
				bs.rays.scale.set(0);
			}
			if (vc < 1 && vc >= 0) {
				bs.core.scale.set(CORE_K * (BR.core.fromCells + (BR.core.toCells - BR.core.fromCells) * cubicOut(vc)));
				bs.core.alpha = BR.core.peak * envelope(vc, BR.core.inShare);
			} else if (bs.core.alpha !== 0) {
				bs.core.alpha = 0;
				bs.core.scale.set(0);
			}
		}
		burstLayer.visible = burstsOn > 0;
		// the embers: out on a quadOut, lifted, then gravity; turned along the path; shrinking, flickering, fading
		for (let i = 0; i < embers.length; i += 1) {
			const e = embers[i];
			if (!e.alive) continue;
			const u = (now - e.t0) / e.ms;
			const p = e.p;
			if (u >= 1) {
				e.alive = false;
				aliveEmbers -= 1;
				p.alpha = 0;
				p.scaleX = p.scaleY = 0;
				freeEmbers.push(e);
				continue;
			}
			const uu = u < 0 ? 0 : u;
			const out = uu * (2 - uu);
			const dOut = 2 * (1 - uu);
			p.x = e.ox + e.cx * out;
			p.y = e.oy + e.cy * out - e.lift * out + EM_GRAV * uu * uu;
			p.rotation = Math.atan2(e.cy * dOut - e.lift * dOut + 2 * EM_GRAV * uu, e.cx * dOut);
			const sc = EM_SCALE * e.roll * (1 - 0.55 * uu);
			p.scaleX = sc;
			p.scaleY = sc;
			p.alpha = (1 - uu * uu) * (1 - EM.flicker * 0.5 * (1 + Math.sin(uu * 28 + e.fl)));
		}
		emberLayer.visible = aliveEmbers > 0;
		if (aliveEmbers > 0) emberLayer.update();
		sparkleStats.inUse = aliveEmbers;
		if (aliveEmbers > sparkleStats.peak) sparkleStats.peak = aliveEmbers;
		winFxStats.burstsInUse = burstsOn;
		if (burstsOn > winFxStats.burstPeak) winFxStats.burstPeak = burstsOn;
	};

	let lastFrame = 0;
	const sync = () => {
		now = performance.now();
		rate = Math.max(0.2, context.stateGameDerived.timeScale());
		dtStyle = lastFrame ? Math.min(now - lastFrame, 1000) * rate : 0;
		dtIdle = SHEET_IDLE_TURBO ? dtStyle : lastFrame ? Math.min(now - lastFrame, 1000) : 0;
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
		inFall = 0;
		// the tiles' layer into the frame's plate slot (BoardFrame mounts first; this is a no-op once there)
		const slotNow = boardPlateSlot.current;
		if (slotNow && plateLayer.parent !== slotNow) slotNow.addChild(plateLayer);
		wells.mount(slotNow);
		covered.fill(0);
		coverDim.fill(1);
		const tex = assets();
		// plain reads outside any effect: no dependency tracking, no flush
		const cells = stateGame.cells;
		exitPressing = boardExitPressing();
		for (let i = 0; i < cells.length; i += 1) syncCell(cells[i], tex);
		// THE BOARD EXIT: the previous board's tiles still falling off (plain objects the engine moves; same
		// pooled sprites, same mask). Their ids are the ones they had on the board, so a tile keeps its sprite
		// through the hand-over.
		const leaving = boardExit.leaving;
		for (let i = 0; i < leaving.length; i += 1) syncCell(leaving[i], tex, true);
		const cutOn = inFall > 0 || boardCutSlot.tease;
		if (fallLayer.visible !== cutOn) fallLayer.visible = cutOn;
		for (const [id, sl] of live) {
			if (sl.gen === gen) continue;
			sl.s.visible = false;
			sl.g.visible = false;
			sl.glow = 0;
			if (sl.sh) dropShine(sl);
			live.delete(id);
			free.push(sl);
		}
		motionLog.glowInUse = glowing;
		if (glowing > motionLog.glowPeak) motionLog.glowPeak = glowing;
		// THE WELLS: the light and the dim on the wells, the light-up cues (game/wellsFx.ts), the flares, the board power
		wells.tick(now, { tex, tiles: stateGame.tiles, cover: coverDim, skipping: stateGame.skipping, freegame: stateGame.gameType === 'freegame' });
		syncPlates(tex);
		tickSparkles(now);
		if (NEW_FX) {
			tickWinFx(now);
			winFxStats.shineInUse = shineInUse;
			if (shineInUse > winFxStats.shinePeak) winFxStats.shinePeak = shineInUse;
			// the shine pool grows one group a tick while the board is at rest, up to SHINE_PREWARM
			if (shineAll.length < SHINE_PREWARM && shineCells.size === 0) shinePool.push(makeShine());
		}
		if (uploadQueue === null || uploadQueue.length) warmSheets(tex);
	};

	// the openings for this layout (and the portrait growth): plain copies for the ticker, the tiles re-placed
	$effect(() => {
		op = openingsFor(layoutK, viewW);
		setCutLines(layoutK, viewW);
		relayoutPlates();
		wells.place(op);
	});

	sync();
	onMount(() => {
		// runs before the renderer's own ticker entry (UPDATE_PRIORITY.LOW), so the frame that is
		// drawn is the frame the board engine just wrote
		const ticker = context.stateApp.pixiApplication?.ticker;
		ticker?.add(sync, undefined, PIXI.UPDATE_PRIORITY.HIGH);
		if (import.meta.env.DEV) {
			// THE WELLS' DEV hook (tools/manticore probes, the wells_r1 / r2 captures): show / hide, read the state and the
			// cost, a flare by hand, and STAGE a look for a still
			// (the scene's mode and lit tiles written straight into the state; a capture aid, never a real round)
			const sg = context.stateGame as any;
			(((window as any).__manticore ??= {}) as any).wells = {
				show: (on: boolean) => wells.show(on),
				state: () => wells.state(),
				flare: (cell: number, kind: 'light' | 'double' | 'win' | 'swipe' | 'sting', delayMs?: number) => wells.flare(cell, kind, delayMs),
				cost: () => wells.cost(),
				log: () => wells.log(),
				stage: (o: { mode?: 'base' | 'bonus' | 'super' | 'epic'; tiles?: Record<number, number>; animate?: boolean }) => {
					if (o.mode) {
						sg.gameType = o.mode === 'base' ? 'basegame' : 'freegame';
						sg.bonusMode = o.mode === 'base' ? null : o.mode;
					}
					if (o.tiles && o.animate) {
						// a staged count-over per listed cell (old value -> new), the plate's own look, cueing the wells as the
						// plate job does
						const t0 = performance.now();
						const cellsOn = Object.entries(o.tiles).map(([k, v]) => [Number(k), v] as const);
						for (const [k, v] of cellsOn) {
							const t = sg.tiles[k];
							cueWellTile(k, t.value, v, 1);
							t.from = t.value;
							t.value = v;
							t.chg = 0;
							t.pop = 0;
						}
						const step = () => {
							const u = Math.min(1, (performance.now() - t0) / 600);
							for (const [k] of cellsOn) {
								sg.tiles[k].chg = u;
								sg.tiles[k].pop = Math.min(1, u * 10);
							}
							if (u < 1) requestAnimationFrame(step);
						};
						requestAnimationFrame(step);
					} else if (o.tiles) {
						const next = sg.tiles.map(() => ({ value: 0, scale: 1, from: 0, chg: 1, pop: 1 }));
						for (const [k, v] of Object.entries(o.tiles)) next[Number(k)] = { value: v, scale: 1, from: v, chg: 1, pop: 1 };
						sg.tiles = next;
					}
				},
			};
		}
		if (import.meta.env.DEV) {
			// SHEETS probe (tools/manticore/sheet_probe.js): which symbols' sheets are parsed, and per
			// live cell its clip mode, frame index within that clip, clip clock and texture size
			const renderer = context.stateApp.pixiApplication?.renderer as any;
			((window as any).__manticore ??= {}).setIdleRest = (on: boolean) => (idleRestOn = !!on);
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
								return [n, { drop: sh.drop.length, idle: sh.idle?.length ?? 0, from: sh.from, squash: symbolAnim(n).squash, sheetPx: src.pixelWidth, resolution: src.resolution, mips: mipLevels(src), idleMips: sh.idle ? mipLevels(sh.idle[0].source) : 0 }];
							}),
						),
						/** the renderer's last tick time and style rate: the clip clocks are as of this instant */
						tick: now,
						rate,
						gpuTextures: renderer?.texture?.managedTextures?.length ?? null,
						/** mip levels per symbol texture source (1 = no chain): the atlas and every drop / idle sheet */
						mips: (() => {
							const per = loaded.flatMap((n) => {
								const sh = sheets.get(n)!;
								return [mipLevels(sh.drop[0].source), ...(sh.idle ? [mipLevels(sh.idle[0].source)] : [])];
							});
							return { atlas: mipLevels(tex?.['L1.png']?.source), numerals: mipLevels(tex?.['num_0.png']?.source), plateNumerals: mipLevels(tex?.[PLATE_KEY_0]?.source), sheets: per.length, sheetsMipped: per.filter((m) => m > 1).length, minLevels: per.length ? Math.min(...per) : 0, webgl: renderer?.context?.webGLVersion ?? null };
						})(),
						assetKeys: tex ? Object.keys(tex).length : 0,
						cells: stateGame.cells.map((c) => {
							const sl = live.get(c.id);
							return {
								id: c.id, name: c.name, reel: c.reel, row: c.row, y: c.y, sx: c.scaleX, sy: c.scaleY, landAt: c.landAt, state: c.state,
								mode: sl ? ['static', 'drop', 'idle'][sl.mode] : 'none', frame: sl?.frame ?? -1, clock: sl?.clock ?? 0,
								texW: sl?.tex?.orig.width ?? 0, texLabel: sl?.tex?.label ?? null,
								/** the drawn tile sprite's screen rect (frame_probe: the art inside the lattice openings) */
								bounds: sl ? (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(sl.s.getBounds()) : null,
							};
						}),
						/** the old multiplier badges are retired (the plates replace them): always empty */
						badges: [] as { i: number; x: number; y: number; w: number; h: number }[],
						fit: SYMBOL_FIT,
					};
				},
				configurable: true,
				enumerable: true,
			});
			// WIN_FX probe: which look runs (DEV ?winfx=old|new), the pools and their peaks, the shines on the bus now
			Object.defineProperty((window as any).__manticore, 'winfx', {
				get: () => ({
					style: winFx.style,
					...winFxStats,
					shineCells: shineCells.size,
					shineStrips: SH_N,
					embers: { inUse: aliveEmbers, pool: EM_POOL, perCell: EM_PER },
					burstPool: { inUse: burstsOn, pool: burstSlots.length },
				}),
				configurable: true,
				enumerable: true,
			});
			// PLATES + DIM probe (tools/manticore/plate_probe.js): each plate as drawn (value, the rows'
			// texts / scales / alphas, the plate and number tints, covered or not) and every live tile
			// sprite's tint and alpha (the dim rule: a dim is a tint, never alpha)
			Object.assign((window as any).__manticore, {
				plates: () =>
					plates.flatMap((p, i) =>
						p && p.shown
							? [{ i, scale: p.root.scale.x, tint: p.g.tint, glowTint: p.glow.tint, glowAlpha: p.glow.alpha, covered: !!covered[i], coverDim: coverDim[i], cur: { text: p.cur.text, scale: p.cur.c.visible ? p.cur.scale : 0, alpha: p.cur.alpha, tint: p.cur.tint, face: p.cur.ftint, /* every glyph sprite's OWN tint (boardfix_probe: a pooled sprite must not keep its last owner's) */ faces: (p.cur.face.children as PIXI.Sprite[]).filter((s) => s.visible).map((s) => s.tint as number), outs: (p.cur.out.children as PIXI.Sprite[]).filter((s) => s.visible).map((s) => s.tint as number), inkW: p.cur.w, inkH: p.cur.h, track: p.cur.track, maxW: NUM_MAX_W, em: NUM_EM }, old: { text: p.old.text, scale: p.old.c.visible ? p.old.scale : 0 }, bounds: (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(p.g.getBounds()) }]
							: [],
					),
				cellTints: () => stateGame.cells.flatMap((c) => {
					const sl = live.get(c.id);
					return sl ? [{ i: c.reel * 8 + c.row, name: c.name, dim: c.dim, tint: sl.s.tint, alpha: sl.s.alpha, state: c.state }] : [];
				}),
				plateObjects: () => ({ plates: plates.filter(Boolean).length, glyphPool: glyphPool.length }),
				/** plates a reset cleared that are still shrinking away (BOARD_EXIT.plateOutMs): cell and drawn scale */
				plateGhosts: () => plates.flatMap((p, i) => (p && p.ghost ? [{ i, scale: p.root.scale.x }] : [])),
				/** THE CUT LINES probe (tools/manticore/exitcut_probe.js): the fall layer's lines (board px and screen px), the
				 *  window's inner edges on screen, and every live tile's sprite (and its halo, when shown) as drawn last
				 *  frame: screen rect, in the fall layer or not, the cell it belongs to */
				fallCut: () => {
					const g0 = fallLayer.toGlobal({ x: 0, y: cutTop });
					const g1 = fallLayer.toGlobal({ x: 0, y: cutBottom });
					const e0 = fallLayer.toGlobal({ x: 0, y: 0 });
					const e1 = fallLayer.toGlobal({ x: BOARD_SIZES.width, y: BOARD_SIZES.height });
					const rect = (o: PIXI.Container) => (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(o.getBounds());
					const tiles = [...live.entries()].filter(([, sl]) => sl.s.visible).map(([id, sl]) => {
						const c = stateGame.cells.find((x) => x.id === id);
						const l = c ? null : boardExit.leaving.find((x) => x.id === id);
						const cc = c ?? l;
						return { id, name: sl.name, reel: cc?.reel ?? -1, row: cc?.row ?? -1, y: cc?.y ?? NaN, rot: cc?.rot ?? 0, dx: cc?.dx ?? 0, sx: cc?.scaleX ?? 1, sy: cc?.scaleY ?? 1, state: cc?.state ?? null, leaving: !!l, landing: sl.landing, fall: sl.fall, inFallLayer: sl.s.parent === fallTiles, screen: rect(sl.s), glow: sl.g.visible ? rect(sl.g) : null };
					});
					// every candidate edge of the lattice's outer bars, board px and screen px (the setting picks one)
					const le = latticeEdges(op.kind, op.vw);
					const sy = (v: number) => fallLayer.toGlobal({ x: 0, y: v }).y;
					const edges = { top: Object.fromEntries(Object.entries(le.top).map(([k, v]) => [k, { board: v, screen: sy(v) }])), bottom: Object.fromEntries(Object.entries(le.bottom).map(([k, v]) => [k, { board: v, screen: sy(v) }])) };
					// the anticipation reels: in the cut layer's tease slot, and their shown sprites' screen rects
					const teaseRoot = teaseSlot.children[0] as PIXI.Container | undefined;
					const teaseRects: { x: number; y: number; w: number; h: number }[] = [];
					if (teaseRoot)
						for (const col of teaseRoot.children)
							if (col.visible) for (const ch of (col as PIXI.Container).children[0]?.children ?? []) if (ch.visible && (ch as PIXI.Sprite).texture !== PIXI.Texture.EMPTY) teaseRects.push(rect(ch as PIXI.Container));
					return { layout: op.kind, setting: { edge: FALL_CUT.edge, offsetPx: FALL_CUT.offsetPx }, cut: { top: cutTop, bottom: cutBottom }, edges, screen: { cutTop: g0.y, cutBottom: g1.y, innerTop: e0.y, innerBottom: e1.y, left: e0.x, right: e1.x, scale: fallLayer.worldTransform.d }, mask: { on: fallLayer.mask === fallMask, visible: fallLayer.visible, top: fallLayer.toGlobal({ x: 0, y: fallMask.bounds.minY }).y, bottom: fallLayer.toGlobal({ x: 0, y: fallMask.bounds.maxY }).y }, pressing: exitPressing, tease: { inSlot: !!teaseRoot, on: boardCutSlot.tease, cols: teaseRoot ? teaseRoot.children.filter((c) => c.visible).length : 0, rain: teaseRects }, tiles };
				},
				/** THE SYMBOL OVERHAUL probe (tools/manticore/symbols_probe.js): the constants, this layout's openings, every
				 *  live tile as drawn (board px and screen px, its size multiple, its zIndex, pop band, fall layer) in the
				 *  order the renderer draws them, the multiplier tiles as drawn, and every display object with a filter */
				symbolFit: () => {
					const byId = new Map<PIXI.Sprite, number>();
					for (const [id, sl] of live) byId.set(sl.s, id);
					const tiles = [...live.entries()].filter(([, sl]) => sl.s.visible).map(([id, sl]) => {
						const c = stateGame.cells.find((x) => x.id === id) ?? boardExit.leaving.find((x) => x.id === id);
						const b = sl.s.getBounds();
						return { id, name: sl.name, reel: c?.reel ?? -1, row: c?.row ?? -1, y: c?.y ?? NaN, state: c?.state ?? null, sx: c?.scaleX ?? NaN, sy: c?.scaleY ?? NaN, x: sl.s.x, yDraw: sl.s.y, w: sl.s.width, h: sl.s.height, k: sl.k, top: sl.top, rowZ: sl.rowZ, z: sl.s.zIndex, pop: sl.pop, fall: sl.fall, screen: { x: b.x, y: b.y, w: b.width, h: b.height } };
					});
					// the draw order: the layer's children as the renderer sorts them (stable, by zIndex), tiles only
					const order = (cellLayer.children as PIXI.Sprite[]).map((ch, i) => ({ ch, i })).filter(({ ch }) => byId.has(ch as PIXI.Sprite) && ch.visible).sort((a, b) => a.ch.zIndex - b.ch.zIndex || a.i - b.i).map(({ ch }) => byId.get(ch as PIXI.Sprite)!);
					const filtered: string[] = [];
					const walk = (n: PIXI.Container, path: string) => {
						if (n.filters && (Array.isArray(n.filters) ? n.filters.length : true)) filtered.push(path + (n.label ? ':' + n.label : ''));
						n.children?.forEach((ch, i) => walk(ch as PIXI.Container, path + '/' + i));
					};
					const stage = context.stateApp.pixiApplication?.stage;
					if (stage) walk(stage, 'stage');
					const boardNode = cellLayer.parent;
					return {
						constants: { place: SYMBOL_PLACE, pops: SYMBOL_POPS, rim: SYMBOL_RIM, size: SIZE, teasePulse: 1 + ANTICIPATION_TEASE_PULSE, engine: { winScale: CLUSTER.winScale, triggerScale: SCATTER_STING.triggerScale, popScale: STING.popScale, bigPopScale: STING.bigPopScale, squash: GRAVITY_DROP.squash }, plate: { style: MULT_PLATE.style, fillAlpha: MULT_PLATE.fillAlpha, borderAlpha: MULT_PLATE.borderAlpha, borderMasterPx: MULT_PLATE.borderMasterPx, cornerPx: MULT_PLATE.cornerPx, numberSizeCells: MULT_PLATE.numberSizeCells, numberAlphaUnderSymbol: MULT_PLATE.numberAlphaUnderSymbol, numberAlphaEmpty: MULT_PLATE.numberAlphaEmpty, innerGlowAlpha: MULT_PLATE.innerGlowAlpha } },
						layout: op.kind,
						openings: Array.from({ length: CELL_COUNT }, (_, i) => ({ i, ox: op.ox[i], oy: op.oy[i], box: Array.from(op.box.slice(i * 4, i * 4 + 4)) })),
						bar: op.bar,
						tiles,
						order,
						/** the board container: world scale (screen px per board px) and its mask (none: the window clip is off) */
						board: boardNode ? { scale: boardNode.worldTransform.a, masked: !!boardNode.mask, label: boardNode.label } : null,
						fall: { visible: fallLayer.visible, count: inFall, masked: fallLayer.mask === fallMask, children: fallTiles.children.length },
						plates: plates.flatMap((p, i) => (p && p.shown ? [{ i, value: stateGame.tiles[i]?.value ?? 0, x: p.root.x, y: p.root.y, box: Array.from(op.box.slice(i * 4, i * 4 + 4)), parent: plateLayer.parent?.label ?? null, inner: { visible: p.inner.visible, alpha: p.inner.alpha, tint: p.inner.tint as number, w: p.inner.width, h: p.inner.height, tex: p.inner.texture.width }, fillShown: p.g.visible, covered: !!covered[i], numAlpha: p.cur.alpha, em: NUM_EM, screen: (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(p.inner.getBounds()) }] : [])),
						filtered,
					};
				},
			});
		}
		return () => {
			ticker?.remove(sync);
			if (boardCutSlot.current === teaseSlot) boardCutSlot.current = null;
			// the parent's unmount destroys the layers; the pooled sprites and particles go with them
			for (const sl of free) {
				sl.s.destroy();
				sl.g.destroy();
			}
			for (const sl of live.values()) {
				sl.s.destroy();
				sl.g.destroy();
			}
			for (const p of plates) p?.root.destroy({ children: true });
			plateLayer.removeFromParent();
			plateLayer.destroy();
			for (const s of glyphPool) s.destroy();
			for (const f of flashes) f.destroy();
			sparkLayer.destroy();
			for (const g of shineAll) {
				for (const t of g.texs) t.destroy(false);
				g.root.destroy({ children: true });
			}
			shineLayer.destroy();
			for (const bs of burstSlots) {
				bs.rays.destroy();
				bs.core.destroy();
			}
			burstLayer.destroy();
			emberLayer.destroy();
		};
	});
</script>
