<script lang="ts">
	// THE BOARD FRAME, THE BLACK BACKING AND THE CHAINS (board_v5j renders since 2026-10-11, tools/build_board_layers.py).
	//
	// Mounted in the MainContainer BEFORE Board, always mounted, raw Pixi, two roots:
	//
	// 1. `under` (zIndex -1, under the board container): the flat backing over the frame's inner
	//    opening (BOARD_BACKING; a texture replaces it later), then the frame sprite over it, so the
	//    steel lattice reads on black and IS the cell grid (Board.svelte hides the old cell-well
	//    backdrop once the frame art is in; it stays only as the pre-load fallback). The board container is
	//    masked to its 8 x 8 pitch, which is smaller than the opening and far smaller than the frame,
	//    so neither can live inside it: `under` MIRRORS its kick instead. ClawSwipe.svelte offsets the
	//    board container's pivot by featureFx.boardKick (board px); `under` is offset by the same kick
	//    times the board's layout scale, read on the same tick, so frame, backing, wells and tiles move
	//    as one piece and come back to rest together.
	// 2. `chains` (zIndex 1, above the frame, beside the board): each run is a 24-vertex strip
	//    (MeshSimple) from the top pivot to the bottom anchor in N = CHAIN_BOW.segments segments, plus
	//    one row at the texture's top (above the pivot, rides the frame) and one at its bottom. The
	//    ends ride the kicked frame (CHAIN_BOW.endsFollowFrame) and the middle lags: a lagged kick
	//    drives an under-damped spring that keeps swinging after the board stops (constants.ts says
	//    how), and each row sits at anchor + kick + (D - kick) bow(s) (game/boardArt.ts chainBow).
	//
	// THE HAUL (CHAIN_BOW.haul*, LOCKED Corey 2026-10-07 13:25): the chains are a continuous loop into the cap
	// and the plinth. Each strip repeats a SEAMLESS two-link tile (BOARD_ART.chains[layout]: L and R side by
	// side in one power-of-two texture, wrap 'repeat'), so the strip's v runs (render y - phase) / period and
	// a haul only moves the uvs: every spin press (game/actor.ts -> featureFx.chainFx), after haulDelayMs,
	// scrolls the texture DOWN by haulLinks links (half a tile each) over haulMs with haulEasing; the offset
	// accumulates modulo the tile. The bow (the vertices) is independent of it. The leaned top link is gone
	// from the frame art (tools/build_board_layers.py erase_leaned_links): the loop runs straight up to the
	// bracket's underside (clip[0]) and down to the plinth's shackle (clip[1]), where the strip is cut.
	//
	// THE GUSTS (CHAIN_GUST, Corey 2026-10-10): the air of a drop-in (the win plaque's slam, a count-up passing a tier,
	// the logo's entrance) leans the runs away from where it landed. A second scalar spring (`gust`) beside the kick's,
	// with the same CHAIN_BOW constants and step so the chain's own weight reads the same, but in REAL time (it is air)
	// and driven by the sum of the gusts' half-sine pulses (game/featureFx.ts gustFx, read through a cursor like the
	// haul's presses). It moves the vertices only, sideways and opposite on the two runs, never the frame or the ends.
	//
	// THE RELIGHT AND THE GEARS (constants FRAME_RELIGHT, approved Corey 2026-10-11; tools/board_relight.py). `under`,
	// bottom to top: the contact SHADOW, the black backing, the DAY plate (the frame without its six turning parts),
	// the six day gear loops, the NIGHT plate, the FIRE plate (additive), the six night loops, the six fire loops
	// (additive). The night layers fade in over the day ones and the fire layers take their tint from the scene's own
	// night, fire level, flicker and mode tints (game/scene.ts sceneLight, read once a tick); a layout whose night set
	// is not in yet keeps its day light and fades when it lands. Each chain run is three strips over the same
	// vertices (day, night, fire: one tile sheet). The gears' frame comes from the haul's own offset, as drawn this
	// frame: one link is one loop, so at rest they are on frame 0, the locked picture. A frame change swaps textures
	// of an atlas that is already on the GPU. No filter, no mask, nothing allocated in the tick.
	//
	// Registration: game/boardArt.ts maps the lattice's outer bar rectangle onto the layout's cell
	// area (re-derived from frameFor() on every layout change, so the portrait growth and a flip
	// re-register). House rules: no filters, no texture per frame (the strips rewrite 48 floats in
	// place), always mounted, every time divided by stateGameDerived.timeScale().
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { layoutKind, type LayoutKind } from '../game/layoutSpec';
	import { BOARD_ART } from '../game/boardArtSpec';
	import { boardRegistration, chainBow } from '../game/boardArt';
	import { BOARD_BACKING, BOARD_SIZES, CHAIN_BOW, CHAIN_GUST, FRAME_ART, FRAME_RELIGHT, PLAYGROUND_PX, SCENE, SYMBOL_SIZE } from '../game/constants';
	import { boardKick, chainFx, gustFx, gustPulse, gustStart, shoveForeground, type ChainGust } from '../game/featureFx';
	import { sceneLight } from '../game/scene';
	import { loadFrameNightLate } from '../game/deferredLoad';

	const context = getContext();
	const parent = getContextParent();

	// ---- the scene graph (built once) -----------------------------------------------------------
	const under = new PIXI.Container({ zIndex: -1 });
	const frameSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
	frameSprite.visible = false;
	// FRAME_ART: the art is too bright on screen; a tint until the darker re-render (constants.ts)
	frameSprite.tint = FRAME_ART.tint;
	const backing = new PIXI.Graphics();
	// THE RELIGHT'S LAYERS (constants FRAME_RELIGHT). The shadow is the floor's, so it is under everything of the frame.
	const RL = BOARD_ART.relight;
	const GEAR_SETS = ['day', 'night', 'fire'] as const;
	type GearSet = (typeof GEAR_SETS)[number];
	/** frames in the gears' loop (the end gear's own loop is half of it: RL.loop) */
	const GEAR_N = RL.frames;
	const shadowSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
	/** THE DAY SHADOW'S SECOND LAYER (FRAME_RELIGHT.shadow.dayDouble): the same cut-out straight over the first, by day only */
	const shadowDaySprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
	shadowSprite.label = 'board-shadow';
	shadowDaySprite.label = 'board-shadow-day2';
	const nightSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
	const fireSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
	fireSprite.blendMode = 'add';
	/** per set, one container (its tint and opacity are the set's) of six sprites in the tool's draw order */
	const gearBox = {} as Record<GearSet, PIXI.Container>;
	const gearSprites = {} as Record<GearSet, PIXI.Sprite[]>;
	for (const set of GEAR_SETS) {
		gearBox[set] = new PIXI.Container();
		gearBox[set].visible = false;
		gearSprites[set] = RL.parts.map(() => {
			const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
			if (set === 'fire') sprite.blendMode = 'add';
			gearBox[set].addChild(sprite);
			return sprite;
		});
	}
	for (const s of [shadowSprite, shadowDaySprite, nightSprite, fireSprite]) s.visible = false;
	gearBox.day.tint = FRAME_ART.tint;
	// the black first, then the frame: the lattice and the rails draw OVER the backing, the tiles over both. The night
	// gears come AFTER the fire plate, so they cover its light where they sit, and the fire gears add theirs last
	under.addChild(shadowSprite, shadowDaySprite, backing, frameSprite, gearBox.day, nightSprite, fireSprite, gearBox.night, gearBox.fire);
	const UNDER_NAMES = new Map<PIXI.Container, string>([[shadowSprite, 'shadow'], [shadowDaySprite, 'shadow-day2'], [backing, 'backing'], [frameSprite, 'frame'], [gearBox.day, 'gears-day'], [nightSprite, 'frame-night'], [fireSprite, 'frame-fire'], [gearBox.night, 'gears-night'], [gearBox.fire, 'gears-fire']]);

	const chains = new PIXI.Container({ zIndex: 1 });
	const SIDES = ['L', 'R'] as const;
	type Side = (typeof SIDES)[number];
	/** rows: the texture top, the pivot at s = 0 .. (N - 1) / N, the texture bottom */
	const ROWS = CHAIN_BOW.segments + 2;
	const indices = new Uint32Array((ROWS - 1) * 6);
	for (let r = 0; r < ROWS - 1; r += 1) {
		const a = r * 2;
		indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], r * 6);
	}
	/** rest: vertices at rest (master); s / bow per row; v: each row's tile coordinate before the haul (render y
	 *  less the tile phase, in periods); u0 / u1 the run's tile columns in the sheet */
	/** `lit`: the run's three strips over the same vertices, day (= `mesh`), night and fire (additive), each on its own
	 *  columns of the one tile sheet (`u`: per strip u0, u1) */
	type Strip = { mesh: PIXI.MeshSimple; lit: PIXI.MeshSimple[]; u: Float32Array; rest: Float32Array; s: Float32Array; bow: Float32Array; v: Float32Array; u0: number; u1: number };
	const strips = {} as Record<Side, Strip>;
	for (const side of SIDES) {
		const lit = GEAR_SETS.map((set) => {
			const mesh = new PIXI.MeshSimple({
				texture: PIXI.Texture.WHITE,
				vertices: new Float32Array(ROWS * 2 * 2),
				uvs: new Float32Array(ROWS * 2 * 2),
				indices: indices.slice(),
			});
			mesh.autoUpdate = false;
			mesh.visible = false;
			if (set === 'fire') mesh.blendMode = 'add';
			chains.addChild(mesh);
			return mesh;
		});
		lit[0].tint = FRAME_ART.chainTint;
		strips[side] = { mesh: lit[0], lit, u: new Float32Array(GEAR_SETS.length * 2), rest: new Float32Array(ROWS * 2 * 2), s: new Float32Array(ROWS), bow: new Float32Array(ROWS), v: new Float32Array(ROWS), u0: 0, u1: 1 };
	}

	parent.addToParent(under);
	parent.addToParent(chains);

	// ---- layout -------------------------------------------------------------------------------
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const vw = $derived(context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale);
	const reg = $derived(boardRegistration(kind, vw));
	const boardScale = $derived(context.stateGameDerived.boardLayout().scale);
	/** canvas px per master px (the MainContainer's scale): the foreground's shove is handed over in canvas px */
	const masterScale = $derived(context.stateLayoutDerived.mainLayout().scale);
	const textures = $derived.by(() => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		return {
			frame: assets?.[`boardFrame_${kind}`],
			chains: assets?.[`boardChains_${kind}`],
			shadow: assets?.[`boardShadow_${kind}`],
			night: assets?.[`boardFrameNight_${kind}`],
			fire: assets?.[`boardFrameFire_${kind}`],
			gears: { day: gearTable(assets, kind, 'day'), night: gearTable(assets, kind, 'night'), fire: gearTable(assets, kind, 'fire') },
		};
	});
	// the other layouts' night sets are not registered at boot: this layout's is fetched the first time it shows
	$effect(() => {
		void loadFrameNightLate(context.stateApp, kind);
	});

	/** a set's loops for a layout: per part (the tool's draw order) its frames in order, from the atlas's frame names;
	 *  null until that atlas is in. Built once per layout and set, then kept. */
	const gearTables: Record<string, PIXI.Texture[][]> = {};
	function gearTable(assets: Record<string, PIXI.Texture> | undefined, k: LayoutKind, set: GearSet): PIXI.Texture[][] | null {
		const id = `${k}_${set}`;
		if (gearTables[id]) return gearTables[id];
		if (!assets?.[`boardGear_${id}_${RL.parts[0]}_00`]) return null;
		const table: PIXI.Texture[][] = [];
		for (const part of RL.parts) {
			const row: PIXI.Texture[] = [];
			for (let i = 0; i < RL.loop[part]; i += 1) {
				const tex = assets[`boardGear_${id}_${part}_${i < 10 ? '0' : ''}${i}`];
				if (!tex) return null;
				row.push(tex);
			}
			table.push(row);
		}
		gearTables[id] = table;
		return table;
	}
	/** what the tick draws from (plain copies, no reactive reads in the frame): each set's loops for this layout, the
	 *  frame the gears are on, and whether this layout's night set (night plate, fire plate, both loops) is whole */
	const gear = { tables: { day: null, night: null, fire: null } as Record<GearSet, PIXI.Texture[][] | null>, frame: 0, shown: -1, swaps: 0 };
	let nightSet = false;
	/** the night set landed while the scene was already in its night: its own fade in from then (SCENE.crossfadeMs) */
	let nightInAt = -1;
	/** the light as last written to the layers (NaN: write it again) */
	const lit = { night: NaN, fire: 0, nightTint: 0, fireTint: 0, chainNightTint: 0, shadowTint: 0, shadowAlpha: 0, shadowDayAlpha: 0 };

	/** each run's top pivot in master units (the gust's direction is taken from it when a gust starts) */
	const anchorTop = { L: new PIXI.Point(), R: new PIXI.Point() };
	/** plain copies the ticker reads (no reactive reads in the frame) */
	let lastKind: LayoutKind | null = null;
	let scale = 1;
	let toCanvas = 1;
	/** master px per playground px for this layout (the chain spring runs in playground px) */
	let pg = 1;
	let chainsReady = false;

	/** lay the chain strips out for a layout: rest vertices in master units along each run's centreline
	 *  (the pivot -> anchor line, so the tile, de-slanted by the tool, follows the tilted run), from the
	 *  bracket's underside to the plinth, and each row's tile coordinate (the uvs are written by setUvs) */
	const layoutStrips = (k: LayoutKind, map: (u: number, v: number) => { x: number; y: number }, tex: PIXI.Texture) => {
		const spec = BOARD_ART.chains[k];
		const [TW] = spec.tex;
		const [clipTop, clipBottom] = spec.clip;
		// the tile repeats: wrap, not clamp (the sheet is power-of-two for WebGL 1)
		if (tex.source.addressMode !== 'repeat') tex.source.addressMode = 'repeat';
		for (const side of SIDES) {
			const part = spec[side];
			const anchor = BOARD_ART.anchors[side];
			const [tx, top] = anchor.top;
			const [bx, bottom] = anchor.bottom;
			const run = bottom - top;
			const st = strips[side];
			for (let r = 0; r < ROWS; r += 1) {
				// render y of the row: the clip top, the pivot rows, the clip bottom
				const v = r === 0 ? clipTop : r === ROWS - 1 ? clipBottom : Math.min(clipBottom, Math.max(clipTop, top + (run * (r - 1)) / CHAIN_BOW.segments));
				const s = (v - top) / run;
				st.s[r] = s;
				st.bow[r] = chainBow(s, CHAIN_BOW.bottomAllowance);
				const cx = tx + ((bx - tx) * (v - top)) / run;
				const p0 = map(cx - spec.halfWidthPx, v);
				const p1 = map(cx + spec.halfWidthPx, v);
				st.rest.set([p0.x, p0.y, p1.x, p1.y], r * 4);
				st.v[r] = (v - spec.phasePx) / spec.periodPx;
			}
			st.u0 = part.texX / TW;
			st.u1 = (part.texX + part.texW) / TW;
			// the three strips: the same vertices, each on its own columns of the sheet (day, night, fire)
			const cols = [part, spec.night[side], spec.fire[side]];
			for (let i = 0; i < st.lit.length; i += 1) {
				st.u[i * 2] = cols[i].texX / TW;
				st.u[i * 2 + 1] = (cols[i].texX + cols[i].texW) / TW;
				st.lit[i].texture = tex;
				(st.lit[i].vertices as Float32Array).set(st.rest);
				st.lit[i].geometry.getBuffer('aPosition').update();
			}
		}
		setUvs();
	};
	/** the haul offset in LINKS (accumulated, modulo one tile = 2 links) and the presses still hauling */
	const haul = { base: 0, offset: 0, live: [] as { t0: number; rate: number }[], seen: 0, last: NaN };
	/** the uvs for the current haul offset: v - offset / 2 (one link is half the two-link tile), so the chain
	 *  moves DOWN the screen as the offset grows */
	const setUvs = () => {
		const shift = haul.offset / 2;
		for (const side of SIDES) {
			const st = strips[side];
			for (let i = 0; i < st.lit.length; i += 1) {
				const buffer = st.lit[i].geometry.getBuffer('aUV');
				const uvs = buffer.data as Float32Array;
				const u0 = st.u[i * 2];
				const u1 = st.u[i * 2 + 1];
				for (let r = 0; r < ROWS; r += 1) {
					const tv = st.v[r] - shift;
					const o = r * 4;
					uvs[o] = u0;
					uvs[o + 1] = tv;
					uvs[o + 2] = u1;
					uvs[o + 3] = tv;
				}
				buffer.update();
			}
		}
		haul.last = haul.offset;
	};
	/** THE GEARS' FRAME from the haul's offset as drawn (links; the backOut overshoot is in it): one link is
	 *  FRAME_RELIGHT.gears.loopsPerLink loops of GEAR_N frames, so a chain at rest (a whole number of links) is frame 0 */
	const gearFrameFor = (links: number) => {
		const f = Math.round(links * FRAME_RELIGHT.gears.loopsPerLink * GEAR_N) % GEAR_N;
		return f < 0 ? f + GEAR_N : f;
	};
	/** every loop of every set that is in to frame `f` (the end gear's loop is shorter: f modulo its own length): a
	 *  texture swap per sprite, all six parts of a set always on the same frame */
	const setGears = (f: number) => {
		for (const set of GEAR_SETS) {
			const table = gear.tables[set];
			if (!table) continue;
			const sprites = gearSprites[set];
			for (let i = 0; i < sprites.length; i += 1) sprites[i].texture = table[i][f % table[i].length];
		}
		gear.shown = f;
		gear.swaps += 1;
	};
	const tintOf = (base: number, r: number, g: number, b: number) =>
		(Math.round(Math.min(255, ((base >> 16) & 255) * r)) << 16) | (Math.round(Math.min(255, ((base >> 8) & 255) * g)) << 8) | Math.round(Math.min(255, (base & 255) * b));
	/** THE LIGHT: the scene's night and fire onto the layers (visibility, opacity and tints only). Called every tick;
	 *  it writes only when a value changed. Day layers are drawn until night covers them, night layers once it starts. */
	const applyLight = (now: number) => {
		const L = sceneLight;
		let fadeIn = 1;
		if (nightInAt >= 0) {
			fadeIn = clamp01((now - nightInAt) / Math.max(SCENE.crossfadeMs, 1));
			if (fadeIn >= 1) nightInAt = -1;
		}
		const night = nightSet ? clamp01(L.night * fadeIn) : 0;
		const fire = Math.min(1, Math.max(0, L.fire * FRAME_RELIGHT.fireGain)) * night;
		const nightTint = tintOf(FRAME_ART.tint, L.foreR, L.foreG, L.foreB);
		const chainNightTint = tintOf(FRAME_ART.chainTint, L.foreR, L.foreG, L.foreB);
		const fireTint = tintOf(0xffffff, fire * L.fireR, fire * L.fireG, fire * L.fireB);
		const S = FRAME_RELIGHT.shadow;
		const shadowTint = tintOf(0xffffff, (S.day.color[0] + (S.night.color[0] - S.day.color[0]) * night) / 255, (S.day.color[1] + (S.night.color[1] - S.day.color[1]) * night) / 255, (S.day.color[2] + (S.night.color[2] - S.day.color[2]) * night) / 255);
		const shadowAlpha = S.day.alpha + (S.night.alpha - S.day.alpha) * night;
		// the day's second layer leaves with the same fade: none of it is left at night
		const shadowDayAlpha = S.day.alpha * S.dayDouble * (1 - night);
		if (night === lit.night && fire === lit.fire && nightTint === lit.nightTint && fireTint === lit.fireTint && shadowTint === lit.shadowTint && shadowAlpha === lit.shadowAlpha && shadowDayAlpha === lit.shadowDayAlpha) return;
		lit.night = night;
		lit.fire = fire;
		lit.nightTint = nightTint;
		lit.chainNightTint = chainNightTint;
		lit.fireTint = fireTint;
		lit.shadowTint = shadowTint;
		lit.shadowAlpha = shadowAlpha;
		lit.shadowDayAlpha = shadowDayAlpha;
		const day = night < 1;
		const dark = night > 0;
		const hasFrame = frameSprite.texture !== PIXI.Texture.EMPTY;
		frameSprite.visible = hasFrame && day;
		gearBox.day.visible = hasFrame && day && !!gear.tables.day;
		nightSprite.visible = fireSprite.visible = gearBox.night.visible = gearBox.fire.visible = hasFrame && dark;
		nightSprite.alpha = gearBox.night.alpha = night;
		nightSprite.tint = gearBox.night.tint = nightTint;
		fireSprite.tint = gearBox.fire.tint = fireTint;
		shadowSprite.tint = shadowDaySprite.tint = shadowTint;
		shadowSprite.alpha = shadowAlpha;
		shadowDaySprite.alpha = shadowDayAlpha;
		shadowDaySprite.visible = shadowSprite.visible && shadowDayAlpha > 0;
		for (const side of SIDES) {
			const meshes = strips[side].lit;
			meshes[0].visible = chainsReady && day;
			meshes[1].visible = meshes[2].visible = chainsReady && dark;
			meshes[1].alpha = night;
			meshes[1].tint = chainNightTint;
			meshes[2].tint = fireTint;
		}
	};
	const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
	/** the haul at `now`: each press runs haulDelayMs, then haulLinks over haulMs with haulEasing, in style
	 *  time at the rate it was pressed at; a finished press folds into the base (modulo the tile) */
	const tickHaul = (now: number) => {
		const presses = chainFx.presses;
		if (haul.seen > presses.length) haul.seen = presses.length; // the bus trimmed its head
		while (haul.seen < presses.length) haul.live.push(presses[haul.seen++]);
		let moving = 0;
		for (let i = haul.live.length - 1; i >= 0; i -= 1) {
			const p = haul.live[i];
			const u = clamp01(((now - p.t0) * p.rate - CHAIN_BOW.haulDelayMs) / Math.max(CHAIN_BOW.haulMs, 1));
			if (u >= 1) {
				haul.base = (haul.base + CHAIN_BOW.haulLinks) % 2;
				haul.live.splice(i, 1);
				continue;
			}
			moving += CHAIN_BOW.haulLinks * CHAIN_BOW.haulEasing(u);
		}
		haul.offset = haul.base + moving;
		return haul.offset !== haul.last;
	};

	$effect(() => {
		const r = reg;
		const k = kind;
		const t = textures;
		scale = boardScale;
		toCanvas = masterScale;
		pg = boardScale * PLAYGROUND_PX;
		for (const side of SIDES) {
			const a = r.map(BOARD_ART.anchors[side].top[0], BOARD_ART.anchors[side].top[1]);
			anchorTop[side].set(a.x, a.y);
		}
		// the backing: the frame's inner opening (cell area plus the inset)
		backing.clear().rect(r.opening.x, r.opening.y, r.opening.width, r.opening.height).fill(BOARD_BACKING.color);
		// the frame: its crop origin in render px through the registration, texture px -> master
		const fs = BOARD_ART.frame[k];
		const o = r.map(fs.crop[0], fs.crop[1]);
		/** a layer that covers the frame's own crop of the render, whatever its texture's size (the fire plate is half) */
		const cover = (sprite: PIXI.Sprite, tex: PIXI.Texture) => {
			sprite.texture = tex;
			sprite.position.set(o.x, o.y);
			sprite.scale.set((r.m * fs.size[0]) / tex.width, (r.m * fs.size[1]) / tex.height);
		};
		if (t.frame) cover(frameSprite, t.frame);
		else frameSprite.texture = PIXI.Texture.EMPTY;
		// THE RELIGHT: this layout's night set is whole or it is not used (the night plate has no gears in it)
		const spec = RL.layouts[k];
		const wasNight = nightSet;
		nightSet = !!(t.frame && t.night && t.fire && t.gears.day && t.gears.night && t.gears.fire);
		if (nightSet) {
			cover(nightSprite, t.night!);
			cover(fireSprite, t.fire!);
			// it landed with the scene already in its night: fade it in from here. A layout that was turned to with its
			// set already in takes the scene's night at once.
			if (!wasNight && lastKind === k && sceneLight.night > 0) nightInAt = performance.now();
			else if (lastKind !== k) nightInAt = -1;
			// one upload when the set lands (sources already on the GPU are only bound again), never at a first draw
			if (!wasNight || lastKind !== k) void context.stateApp.pixiApplication?.renderer?.prepare?.upload([t.night!.source, t.fire!.source, t.gears.night![0][0].source]);
		}
		lastKind = k;
		for (const set of GEAR_SETS) {
			const table = set === 'day' || nightSet ? t.gears[set] : null;
			gear.tables[set] = table;
			if (!table) continue;
			// each loop's own box of the render (a whole number of the plate's texture px), through the registration
			RL.parts.forEach((part, i) => {
				const box = spec.gears[part].box;
				const tex = table[i][0];
				const at = r.map(box[0], box[1]);
				gearSprites[set][i].position.set(at.x, at.y);
				gearSprites[set][i].scale.set((r.m * box[2]) / tex.width, (r.m * box[3]) / tex.height);
			});
		}
		setGears(gear.frame);
		if (t.shadow && t.frame) {
			const box = spec.shadow.box;
			const at = r.map(box[0], box[1]);
			for (const sprite of [shadowSprite, shadowDaySprite]) {
				sprite.texture = t.shadow;
				sprite.position.set(at.x, at.y);
				sprite.scale.set((r.m * box[2]) / t.shadow.width, (r.m * box[3]) / t.shadow.height);
			}
			shadowSprite.visible = true;
			// (0 until the light is first applied; applyLight then shows it)
			shadowDaySprite.visible = lit.shadowDayAlpha > 0;
		} else shadowSprite.visible = shadowDaySprite.visible = false;
		if (t.chains) {
			layoutStrips(k, r.map, t.chains);
			chainsReady = true;
			dirty = true;
		} else chainsReady = false;
		// the layers' visibility, opacity and tints for the light as it is now
		lit.night = NaN;
		applyLight(performance.now());
	});

	context.eventEmitter.subscribeOnMount({
		boardShow: () => {
			under.visible = true;
			chains.visible = true;
		},
		boardHide: () => {
			under.visible = false;
			chains.visible = false;
		},
	});

	// ---- the tick: mirror the kick, run the chain spring, bend the strips ---------------------
	/** the spring, in PLAYGROUND px (CHAIN_BOW): the kick scalar k, its lagged copy, the displacement d
	 *  and its velocity (px per s); `acc` is the style ms not yet integrated (fixed 2 ms steps) */
	const bow = { k: 0, kl: 0, d: 0, v: 0, acc: 0 };
	/** the swing's amplitude below which it is snapped to rest (playground px of d) */
	const REST_AMP = 0.4;
	const STEP_MS = 2;
	let ukx = NaN;
	let uky = NaN;
	let dirty = true;
	let atRest = true;

	/** THE GUST SPRING, the same model as `bow` in REAL time: k = the live gusts' pulses (playground px). dirL / dirR:
	 *  each run's lean (-1 left, +1 right), taken when a gust starts; `at` the clock the pulses were last read at,
	 *  `startAt` when the latest gust started here, `upTo` that gust's own start (DEV hook + probe) */
	const gust = { k: 0, kl: 0, d: 0, v: 0, acc: 0, dirL: -1, dirR: 1, at: 0, startAt: -1, upTo: -Infinity, seen: 0 };
	const gustLive: ChainGust[] = [];
	let gustAtRest = true;
	/** a run's sideways travel per px of the gust spring: the kick's own travel per px of `bow` (D = (0.6 d, vertical d)) */
	const GUST_TRAVEL = Math.hypot(0.6, CHAIN_BOW.vertical);
	const gp = new PIXI.Point();
	/** each run leans away from the landing: from the board's centre (null), or from a canvas x (the logo) */
	const aim = (sourceX: number | null) => {
		if (sourceX === null) {
			gust.dirL = -1;
			gust.dirR = 1;
			return;
		}
		gust.dirL = chains.toGlobal(anchorTop.L, gp).x >= sourceX ? 1 : -1;
		gust.dirR = chains.toGlobal(anchorTop.R, gp).x >= sourceX ? 1 : -1;
	};
	/** the gusts at `now`: new ones from the bus, finished ones dropped (nothing allocated) */
	const tickGust = (now: number) => {
		const list = gustFx.gusts;
		const fresh = Math.min(gustFx.count - gust.seen, list.length);
		for (let i = list.length - fresh; i < list.length; i += 1) gustLive.push(list[i]);
		gust.seen = gustFx.count;
		let k = 0;
		for (let i = gustLive.length - 1; i >= 0; i -= 1) {
			const g = gustLive[i];
			const start = gustStart(g, 0);
			if (now < start) continue;
			if (now >= start + CHAIN_GUST.ms) {
				gustLive[i] = gustLive[gustLive.length - 1];
				gustLive.length -= 1;
				continue;
			}
			if (start > gust.upTo) {
				gust.upTo = start;
				gust.startAt = now;
				aim(g.sourceX);
			}
			k += gustPulse(g, 0, CHAIN_GUST.unitPx.board, now);
		}
		gust.k = k;
		gust.at = now;
	};

	const tick = (ticker: PIXI.Ticker) => {
		const kx = boardKick.x * scale;
		const ky = boardKick.y * scale;
		if (kx !== ukx || ky !== uky) {
			ukx = kx;
			uky = ky;
			under.position.set(kx, ky);
			dirty = true;
		}
		// THE FOREGROUND KICK: the courtyard's foreground takes this same read, in canvas px, inside this call
		// (featureFx.shoveForeground; it returns at once while nothing has changed)
		shoveForeground(kx * toCanvas, ky * toCanvas);
		// the light first: it needs no chains (the scene's night, fire level and tints onto the layers)
		applyLight(performance.now());
		if (!chainsReady) return;
		if (tickHaul(performance.now())) setUvs();
		// the gears follow the chain's own travel, this frame's (the overshoot too): a texture swap when the frame changes
		gear.frame = gearFrameFor(haul.offset);
		if (gear.frame !== gear.shown) setGears(gear.frame);
		// the kick's scalar: boardKick is (0.6 k, k); fall back to x / 0.6 for a purely sideways kick
		const kpx = boardKick.y / PLAYGROUND_PX;
		const kxpx = boardKick.x / PLAYGROUND_PX / 0.6;
		bow.k = Math.abs(kpx) >= Math.abs(kxpx) ? kpx : kxpx;
		if (bow.k !== 0 || !atRest) {
			// style ms: the real frame time times the turbo scale (every time constant divided by it)
			const ts = Math.max(0.2, context.stateGameDerived.timeScale());
			bow.acc += Math.min(ticker.deltaMS, 100) * ts;
			const w = 2 * Math.PI * CHAIN_BOW.settleHz;
			const kicking = Math.abs(bow.k) > 0.05;
			const zeta = kicking ? CHAIN_BOW.damping : Math.min(CHAIN_BOW.damping, 3 / ((w * CHAIN_BOW.settleAfterMs) / 1000));
			const a = 1 - Math.exp(-STEP_MS / Math.max(CHAIN_BOW.lagMs, 1));
			const h = STEP_MS / 1000;
			while (bow.acc >= STEP_MS) {
				bow.acc -= STEP_MS;
				bow.kl += (bow.k - bow.kl) * a;
				bow.v += (w * w * (CHAIN_BOW.gain * bow.kl - bow.d) - 2 * zeta * w * bow.v) * h;
				bow.d += bow.v * h;
			}
			const amp = Math.hypot(bow.d, bow.v / w);
			atRest = !kicking && Math.abs(bow.kl) < 0.01 && amp < REST_AMP;
			if (atRest) bow.k = bow.kl = bow.d = bow.v = bow.acc = 0;
			dirty = true;
		}
		// the gusts: the same spring in real time (never turbo-scaled), driven by the pulses
		const now = performance.now();
		if (gustLive.length || gustFx.count !== gust.seen) tickGust(now);
		if (gust.k !== 0 || !gustAtRest) {
			gust.acc += Math.min(ticker.deltaMS, 100);
			const w = 2 * Math.PI * CHAIN_BOW.settleHz;
			const pushing = Math.abs(gust.k) > 0.05;
			const zeta = pushing ? CHAIN_BOW.damping : Math.min(CHAIN_BOW.damping, 3 / ((w * CHAIN_BOW.settleAfterMs) / 1000));
			const a = 1 - Math.exp(-STEP_MS / Math.max(CHAIN_BOW.lagMs, 1));
			const h = STEP_MS / 1000;
			while (gust.acc >= STEP_MS) {
				gust.acc -= STEP_MS;
				gust.kl += (gust.k - gust.kl) * a;
				gust.v += (w * w * (CHAIN_BOW.gain * gust.kl - gust.d) - 2 * zeta * w * gust.v) * h;
				gust.d += gust.v * h;
			}
			const amp = Math.hypot(gust.d, gust.v / w);
			// never snapped while a pulse runs (a weak gust's first frames are under the kick's 0.05 px threshold)
			gustAtRest = gust.k === 0 && Math.abs(gust.kl) < 0.01 && amp < REST_AMP;
			if (gustAtRest) gust.k = gust.kl = gust.d = gust.v = gust.acc = 0;
			dirty = true;
		}
		if (!dirty) return;
		dirty = false;
		// point(s) = anchor(s) + kick + (D - kick) bow(s), D = (0.6 d, vertical d), all master px. With
		// endsFollowFrame the anchors ride the kick; otherwise they stay put and only D bends the run.
		// The gust adds (dir GUST_TRAVEL g, CHAIN_GUST.vertical g) to D: the ends never move for it.
		const follow = CHAIN_BOW.endsFollowFrame ? 1 : 0;
		const Dx = 0.6 * bow.d * pg;
		const Dy = CHAIN_BOW.vertical * bow.d * pg + CHAIN_GUST.vertical * gust.d * pg;
		const Gx = GUST_TRAVEL * gust.d * pg;
		const ex = kx * follow;
		const ey = ky * follow;
		for (const side of SIDES) {
			const st = strips[side];
			const v = st.mesh.vertices as Float32Array;
			const Sx = Dx + (side === 'L' ? gust.dirL : gust.dirR) * Gx;
			for (let r = 0; r < ROWS; r += 1) {
				const b = st.bow[r];
				const o = r * 4;
				const ox = ex + (Sx - ex) * b;
				const oy = ey + (Dy - ey) * b;
				v[o] = st.rest[o] + ox;
				v[o + 1] = st.rest[o + 1] + oy;
				v[o + 2] = st.rest[o + 2] + ox;
				v[o + 3] = st.rest[o + 3] + oy;
			}
			st.mesh.geometry.getBuffer('aPosition').update();
			// the night and fire strips ride the same vertices
			for (let i = 1; i < st.lit.length; i += 1) {
				(st.lit[i].vertices as Float32Array).set(v);
				st.lit[i].geometry.getBuffer('aPosition').update();
			}
		}
	};

	// ---- DEV hook: __manticore.frame (not .board: that name is the symbol grid, Board.svelte) ----
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const W = BOARD_SIZES.width;
		const H = BOARD_SIZES.height;
		const g = (node: PIXI.Container, x: number, y: number) => {
			const p = node.toGlobal({ x, y });
			return { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) };
		};
		const clippedBy = (node: PIXI.Container) => {
			const out: string[] = [];
			for (let n: PIXI.Container | null = node; n; n = n.parent) if (n.mask) out.push(n.label || n.constructor.name);
			return out;
		};
		/** the relight's whole state: the light, every layer of the art container, every gear sprite, the shadow, the
		 *  chains' three strips, and each texture source the frame draws from with its size and whether it is on the GPU */
		const relightState = () => {
			const glTable = (context.stateApp.pixiApplication?.renderer as any)?.texture?._glTextures ?? {};
			const sources = new Map<PIXI.TextureSource, string>();
			const add = (name: string, tex: PIXI.Texture | null | undefined) => {
				if (tex && tex !== PIXI.Texture.EMPTY && tex !== PIXI.Texture.WHITE && !sources.has(tex.source)) sources.set(tex.source, name);
			};
			add('plate-day', frameSprite.texture);
			add('gears-day + shadow', gear.tables.day?.[0][0]);
			add('chains day + night + fire', strips.L.mesh.texture);
			add('plate-night', nightSet ? nightSprite.texture : null);
			add('plate-fire', nightSet ? fireSprite.texture : null);
			add('gears-night + fire', gear.tables.night?.[0][0]);
			const rect = (s: PIXI.Sprite) => {
				const a = g(s, 0, 0);
				const b = g(s, s.texture.width, s.texture.height);
				return { x: a.x, y: a.y, right: b.x, bottom: b.y };
			};
			const look = (c: PIXI.Container) => ({ visible: c.visible, alpha: Number(c.alpha.toFixed(4)), tint: c.tint as number, blend: c.blendMode as string });
			return {
				constants: FRAME_RELIGHT,
				frames: GEAR_N,
				loop: RL.loop,
				parts: RL.parts,
				/** the scene's light as the frame last read it, and what the frame made of it */
				scene: { ...sceneLight },
				night: lit.night,
				fire: lit.fire,
				nightSet,
				fadingIn: nightInAt >= 0,
				tints: { day: FRAME_ART.tint, night: lit.nightTint, fire: lit.fireTint, chainNight: lit.chainNightTint, shadow: lit.shadowTint, shadowAlpha: lit.shadowAlpha, shadowDayAlpha: lit.shadowDayAlpha },
				/** the art container's children, bottom to top */
				plateScreen: rect(frameSprite),
				layers: under.children.map((c) => ({ name: UNDER_NAMES.get(c) ?? 'other', ...look(c), tex: c instanceof PIXI.Sprite ? [c.texture.width, c.texture.height] : null })),
				gears: {
					frame: gear.frame,
					shown: gear.shown,
					swaps: gear.swaps,
					sets: Object.fromEntries(
						GEAR_SETS.map((set) => [
							set,
							gearSprites[set].map((sprite, i) => ({ part: RL.parts[i], frame: gear.tables[set] ? gear.tables[set]![i].indexOf(sprite.texture) : -1, name: sprite.texture.label ?? null, blend: sprite.blendMode as string, screen: gear.tables[set] ? rect(sprite) : null, tex: [sprite.texture.width, sprite.texture.height] })),
						]),
					),
				},
				shadow: { ...look(shadowSprite), screen: shadowSprite.visible ? rect(shadowSprite) : null, under: under.children.indexOf(shadowSprite), /** the day's second layer: straight over the first, on its box */ day2: { ...look(shadowDaySprite), screen: shadowDaySprite.visible ? rect(shadowDaySprite) : null, under: under.children.indexOf(shadowDaySprite) } },
				chains: Object.fromEntries(SIDES.map((side) => [side, strips[side].lit.map((mesh, i) => ({ set: GEAR_SETS[i], ...look(mesh), u: [Number(strips[side].u[i * 2].toFixed(5)), Number(strips[side].u[i * 2 + 1].toFixed(5))] }))])),
				/** every source the frame draws from in this layout: resident MB as RGBA8 (no mipmaps), and on the GPU or not */
				memory: [...sources].map(([source, name]) => ({ name, w: source.pixelWidth, h: source.pixelHeight, MB: Number(((source.pixelWidth * source.pixelHeight * 4) / 2 ** 20).toFixed(2)), onGpu: !!glTable[source.uid] })),
			};
		};
		Object.defineProperty(((window as any).__manticore ??= {}), 'frame', {
			get: () => {
				const k = kind;
				const r = reg;
				const fs = BOARD_ART.frame[k];
				const L = BOARD_ART.lattice;
				// the lattice corners through the frame sprite's own transform (texture px), so this
				// checks what Pixi draws, not the arithmetic that placed it
				const tx = (u: number) => ((u - fs.crop[0]) * fs.tex[0]) / fs.size[0];
				const ty = (v: number) => ((v - fs.crop[1]) * fs.tex[1]) / fs.size[1];
				const lat0 = g(frameSprite, tx(L.x0), ty(L.y0));
				const lat1 = g(frameSprite, tx(L.x1), ty(L.y1));
				const corners = BOARD_ART.corners.map(([u, v]) => g(frameSprite, tx(u), ty(v)));
				const art0 = r.map(BOARD_ART.art[0], BOARD_ART.art[1]);
				const art1 = r.map(BOARD_ART.art[2], BOARD_ART.art[3]);
				// the cell area as the board places it, through the parent (master -> screen)
				const c0 = g(parent.parent, r.cell.x, r.cell.y);
				const c1 = g(parent.parent, r.cell.x + r.cell.size, r.cell.y + r.cell.size);
				const boardNode = parent.parent.children.find((c) => c !== under && c !== chains && c.mask) as PIXI.Container | undefined;
				const masterToScreen = parent.parent.worldTransform.a;
				const chainOut = {} as Record<Side, unknown>;
				for (const side of SIDES) {
					const st = strips[side];
					const v = st.mesh.vertices as Float32Array;
					const a = BOARD_ART.anchors[side];
					const top = r.map(a.top[0], a.top[1]);
					const bottom = r.map(a.bottom[0], a.bottom[1]);
					chainOut[side] = {
						top: g(parent.parent, top.x, top.y),
						bottom: g(parent.parent, bottom.x, bottom.y),
						/** per row: s, the displacement in screen px (x, y), rows above the pivot have s < 0 */
						rows: Array.from({ length: ROWS }, (_, i) => ({
							s: Number(st.s[i].toFixed(4)),
							dx: Number(((v[i * 4] - st.rest[i * 4]) * masterToScreen).toFixed(3)),
							dy: Number(((v[i * 4 + 1] - st.rest[i * 4 + 1]) * masterToScreen).toFixed(3)),
							/** the lag: displacement from the KICKED anchor line (rest + the frame's kick), screen px */
							lx: Number(((v[i * 4] - st.rest[i * 4] - under.position.x) * masterToScreen).toFixed(3)),
							ly: Number(((v[i * 4 + 1] - st.rest[i * 4 + 1] - under.position.y) * masterToScreen).toFixed(3)),
						})),
						visible: st.lit.some((mesh) => mesh.visible) && chains.visible,
					};
				}
				return {
					kind: k,
					ready: { frame: frameSprite.texture !== PIXI.Texture.EMPTY, chains: chainsReady, gears: !!gear.tables.day, night: nightSet, shadow: shadowSprite.visible },
					/** every ancestor of the art that clips: a mask would cut the gear teeth and finials that stand
					 *  outside the housing outline (board_v5j and v5l); the art is to be clipped by the screen alone */
					clippedBy: { frame: clippedBy(frameSprite), chains: clippedBy(strips.L.mesh) },
					/** the frame texture as loaded, against the tool's spec (a stale file would be drawn stretched) */
					frameTexture: { width: frameSprite.texture.width, height: frameSprite.texture.height, spec: fs.tex },
					/** the art container's children, bottom to top */
					underOrder: under.children.map((c) => UNDER_NAMES.get(c) ?? 'other'),
					/** THE RELIGHT AND THE GEARS (constants FRAME_RELIGHT; tools/manticore/gear_probe.js) */
					relight: relightState(),
					/** the tool's numbers for this layout: the plate's crop and sizes, each loop's box, the shadow's, the checks */
					relightSpec: { frame: fs, layout: RL.layouts[k], checks: RL.checks },
					/** the old cell-well sprite in the board container: hidden once the frame art is loaded */
					backdropVisible: (() => {
						const bd = boardNode?.children.find((c) => c.label === 'boardBackdrop');
						return bd ? bd.visible && bd.alpha > 0 : null;
					})(),
					/** master px per render px, the lattice and cell area in master and screen px */
					registration: {
						m: r.m,
						masterToScreen,
						cellMaster: r.cell,
						latticeMaster: r.lattice,
						mismatchMaster: r.mismatch,
						tiltDeg: BOARD_ART.tiltDeg,
						/** every bar crossing (9 x 9, rows top to bottom) through the frame sprite, screen px, and the
						 *  bar / rivet radii in screen px; the bars' tile gaps: the board container's c x SYMBOL_SIZE */
						crossingsScreen: BOARD_ART.crossings.map((row) => row.map(([u, v]) => g(frameSprite, tx(u), ty(v)))),
						barsScreen: { x: BOARD_ART.bars.x.map((u) => g(frameSprite, tx(u), ty(L.y0)).x), y: BOARD_ART.bars.y.map((v) => g(frameSprite, tx(L.x0), ty(v)).y) },
						barRadiusScreen: BOARD_ART.bars.barRadius * (fs.tex[0] / fs.size[0]) * frameSprite.worldTransform.a,
						rivetRadiusScreen: BOARD_ART.bars.rivetRadius * (fs.tex[0] / fs.size[0]) * frameSprite.worldTransform.a,
						tileGapsScreen: boardNode ? { x: Array.from({ length: 9 }, (_, c) => g(boardNode, c * SYMBOL_SIZE, 0).x), y: Array.from({ length: 9 }, (_, r) => g(boardNode, 0, r * SYMBOL_SIZE).y) } : null,
						symbolArt: BOARD_ART.symbolArt,
						outerRivets: BOARD_ART.outerRivets,
						/** v4h: square opening, rows 0 / 7 held to the top / bottom outer bars, every crossing a rivet */
						holdRows: BOARD_ART.holdRows,
						/** mid-height lattice width (x0..x1) and its centre line (y0..y1), screen px */
						latticeScreen: { x0: lat0.x, y0: lat0.y, x1: lat1.x, y1: lat1.y },
						/** the outer bar crossings TL, TR, BL, BR in screen px (the tilt makes the top a hair wider) */
						cornersScreen: corners,
						/** the frame art (frame + chains alpha bbox) in master units and in screen px */
						artMaster: { x: art0.x, y: art0.y, right: art1.x, bottom: art1.y },
						artScreen: { ...g(parent.parent, art0.x, art0.y), ...(() => { const b = g(parent.parent, art1.x, art1.y); return { right: b.x, bottom: b.y }; })() },
						cellScreen: { x0: c0.x, y0: c0.y, x1: c1.x, y1: c1.y },
						frameSprite: { x: frameSprite.x, y: frameSprite.y, sx: frameSprite.scale.x, sy: frameSprite.scale.y, w: frameSprite.width, h: frameSprite.height },
						opening: r.opening,
					},
					/** the kick as each layer has it, master px: the frame / backing root and the board container */
					kick: {
						frame: { x: under.position.x, y: under.position.y },
						board: boardNode ? { x: (W / 2 - boardNode.pivot.x) * boardNode.scale.x, y: (H / 2 - boardNode.pivot.y) * boardNode.scale.y } : null,
						source: { x: boardKick.x * scale, y: boardKick.y * scale },
					},
					/** the spring in playground px (k, lagged k, d, d' per s); pg = master px per playground px */
					bow: { ...bow, atRest, pg },
					/** THE GUST SPRING (CHAIN_GUST), playground px like `bow`: k the pulses' sum, kl lagged, d, d' per s; dirL /
					 *  dirR each run's lean; `live` gusts held here (running or still to start); `travel` the run's sideways
					 *  master px per playground px of d per pg */
					gust: { k: gust.k, kl: gust.kl, d: gust.d, v: gust.v, atRest: gustAtRest, dirL: gust.dirL, dirR: gust.dirR, at: gust.at, startAt: gust.startAt, live: gustLive.length, travel: GUST_TRAVEL },
					/** THE HAUL: the offset in links (base = finished presses modulo the 2-link tile), the presses
					 *  still hauling, the tile, and each strip's first-row v (uv) as the GPU has it */
					haul: {
						offset: haul.offset,
						base: haul.base,
						live: haul.live.length,
						pressAt: chainFx.presses.map((p) => p.t0),
						now: performance.now(),
						tile: { tex: BOARD_ART.chains[k].tex, periodPx: BOARD_ART.chains[k].periodPx, phasePx: BOARD_ART.chains[k].phasePx, clip: BOARD_ART.chains[k].clip },
						addressMode: strips.L.mesh.texture?.source?.addressMode ?? null,
						uv0: SIDES.map((side) => Number((strips[side].mesh.geometry.getBuffer('aUV').data as Float32Array)[1].toFixed(4))),
						constants: { links: CHAIN_BOW.haulLinks, delayMs: CHAIN_BOW.haulDelayMs, ms: CHAIN_BOW.haulMs, on: CHAIN_BOW.haulOnSpin },
					},
					chains: chainOut,
					zOrder: parent.parent.children.map((c) => (c === under ? 'frame+backing' : c === chains ? 'chains' : c === boardNode ? 'board' : c.label || 'other') + '@' + c.zIndex),
				};
			},
			configurable: true,
			enumerable: true,
		});
		// the per-frame read of tools/manticore/gear_probe.js: the haul, the frame it asks for and the frame every one
		// of the 18 gear sprites really holds (found in its own loop), and the light as last written
		Object.defineProperty((window as any).__manticore, 'frameGears', {
			get: () => {
				const shown = {} as Record<GearSet, number[]>;
				let inStep = true;
				for (const set of GEAR_SETS) {
					const table = gear.tables[set];
					shown[set] = table ? gearSprites[set].map((sprite, i) => table[i].indexOf(sprite.texture)) : [];
					shown[set].forEach((f, i) => {
						if (f !== gear.frame % table![i].length) inStep = false;
					});
				}
				return { t: performance.now(), offset: haul.offset, base: haul.base, live: haul.live.length, presses: chainFx.presses.length, uv0: (strips.L.mesh.geometry.getBuffer('aUV').data as Float32Array)[1], frame: gear.frame, drawn: gear.shown, shown, inStep, swaps: gear.swaps, night: lit.night, fire: lit.fire, fireTint: lit.fireTint, nightTint: lit.nightTint, nightSet, sn: sceneLight.night, sf: sceneLight.fire, kick: boardKick.y };
			},
			configurable: true,
			enumerable: true,
		});
		// the per-frame read of tools/manticore/chain_gust_probe.js: `frame` above computes the whole registration, far
		// too much to read every frame; this is only the springs, the kick as each layer has it and each run's widest row
		Object.defineProperty((window as any).__manticore, 'frameGust', {
			get: () => {
				const masterToScreen = parent.parent.worldTransform.a;
				const boardNode = parent.parent.children.find((c) => c !== under && c !== chains && c.mask) as PIXI.Container | undefined;
				const row = (side: Side) => {
					const st = strips[side];
					let m = 0;
					for (let r = 1; r < ROWS; r += 1) if (st.bow[r] > st.bow[m]) m = r;
					const v = st.mesh.vertices as Float32Array;
					return { r: m, b: st.bow[m], dx: (v[m * 4] - st.rest[m * 4]) * masterToScreen, dy: (v[m * 4 + 1] - st.rest[m * 4 + 1]) * masterToScreen, top: (v[4] - st.rest[4]) * masterToScreen, bottom: (v[(ROWS - 1) * 4] - st.rest[(ROWS - 1) * 4]) * masterToScreen };
				};
				return {
					t: performance.now(),
					ready: chainsReady,
					pg,
					masterToScreen,
					bow: { k: bow.k, kl: bow.kl, d: bow.d, atRest },
					gust: { k: gust.k, kl: gust.kl, d: gust.d, atRest: gustAtRest, dirL: gust.dirL, dirR: gust.dirR, at: gust.at, startAt: gust.startAt, live: gustLive.length, travel: GUST_TRAVEL },
					kick: {
						source: { x: boardKick.x * scale, y: boardKick.y * scale },
						frame: { x: under.position.x, y: under.position.y },
						/** canvas px per master px as handed to the foreground's shove */
						toCanvas,
						board: boardNode ? { x: (BOARD_SIZES.width / 2 - boardNode.pivot.x) * boardNode.scale.x, y: (BOARD_SIZES.height / 2 - boardNode.pivot.y) * boardNode.scale.y } : null,
					},
					/** the haul (uvs only): offset in links, the last press, each run's first-row v */
					haul: { offset: haul.offset, base: haul.base, live: haul.live.length, pressAt: chainFx.presses.length ? chainFx.presses[chainFx.presses.length - 1].t0 : null, uv0: (strips.L.mesh.geometry.getBuffer('aUV').data as Float32Array)[1] },
					L: row('L'),
					R: row('R'),
				};
			},
			configurable: true,
			enumerable: true,
		});
	}

	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		// NORMAL like ClawSwipe's pivot write (both read the same boardKick this frame), before the
		// render (LOW)
		ticker?.add(tick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
		return () => {
			ticker?.remove(tick);
		};
	});
</script>
