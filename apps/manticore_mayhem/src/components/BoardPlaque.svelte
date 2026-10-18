<script lang="ts" module>
	export type EmitterEventSpinWin =
		/** the step is over: SNAP to the book's cascade.spinWin (the running steps already got here) */
		| { type: 'spinWinShow'; amount: number }
		/** a cluster's count-up landed: the running number jumps to `amount` and bumps */
		| { type: 'spinWinStep'; amount: number }
		/** the last refill of the spin is down: the final presentation (SPIN_TOTAL), awaited */
		| { type: 'spinWinFinal'; amount: number }
		| { type: 'spinWinHide' };
</script>

<script lang="ts">
	// THE SPIN AMOUNT PLAQUE (Corey 2026-10-13, images/spin_amount_final/SPEC.md; constants BOARD_PLAQUE): the running
	// total of the spin being cascaded (cascade.spinWin; the HUD's WIN readout owns the round total), drawn as inlaid brass
	// figures on a bronze plaque that leans 35 degrees under the board (the lion crest on the empty plaque is not drawn since r3 of the explainer lines, PLAQUE_TIPS.crest). It replaces
	// SpinWin.svelte's stencil readout ("SPIN $x" in the MainContainer).
	//
	// Everything lives in BoardFrame's `under` (game/boardPlateSlot.ts boardPlaqueSlot, after the fire gears), in master
	// units through the frame's own registration, so it takes the frame's kick with no extra code. Bottom to top: the
	// shadow (a white cut-out tinted with the frame shadow's colour), the day plaque (FRAME_ART.tint), the night plaque
	// (opacity = the scene's night, the frame's night tint), the fire plaque (added, the frame's fire tint), the crest
	// (its own day / night / fire, faded as a container), then the figures: ONE mesh of four-vertex quads on the plaque
	// numerals atlas, each glyph corner put through the layout's homography (boardPlaqueSpec H, the HALVED lean), then
	// the registration. The light is the frame's own (frameLight, written by BoardFrame's applyLight). The mesh's buffers
	// are rewritten only when the text or the layout changes; nothing allocates in the tick; no text, no filter.
	//
	// Timing (style ms, 0 while a skip runs): on the first figures of a spin the crest fades out over crestOutMs, then the
	// figures fade in over figuresInMs; each step bumps them to SPIN_TOTAL.bumpScale about the block's centre; on the
	// clear the figures fade out over TIMINGS.winClearMs and the crest comes back over crestBackMs. The figures hide
	// while the mode plaque is up (as the old readout did); the plaque and the crest stay.
	//
	// Every currency is drawn from the atlas. EGP's mark is right to left: the tokenizer draws left to right, so the
	// run of Arabic letters (with the point inside it) is reversed first, the way a browser shows it ("م.ج" then the
	// number). Lower-case letters the set lacks fall back to its small capitals' upper-case twin.
	//
	// THE EXPLAINER LINES (Corey 2026-10-16 17:41; r4 2026-10-17 11:28, game/plaqueTips.ts): while the board is idle in the
	// base game (game/boardIdle.ts, the symbol pay popup's own rule) and the plaque has no figures, one line at a time
	// crosses the plaque's text box as a plain MARQUEE: it enters from fully outside the box's right edge, moves left at
	// one constant speed (a short ease in, none at the end) and goes on until its last letter has left the box's left
	// edge. It never pauses, and it is never shown whole. Since r5 (Corey 12:38) the left and right cut is the dark
	// field's two SLANTED inner edges (PLAQUE_TIPS.edges, measured from the art), so a letter is cut on the slant as it
	// enters and leaves. Between lines the box is empty (no crest since r3, PLAQUE_TIPS.crest);
	// PLAQUE_TIPS.gapMs runs from one line gone to the next one entering. Line 1 first, then all twelve in turn, going on
	// across idle spells where the last one stopped (2026-10-17 20:43). A line hides as soon as the board stops being idle, and never shows while the figures do (the
	// figures, the win readout, always win). r2 and r3's gold particles are gone (Corey 11:28).
	//
	// Each line is drawn ONCE, when it comes up, into its own canvas texture (the Cinzel face the intro cards use, at the
	// renderer's resolution, clear pixels padding the text) and that texture is destroyed when the line ends. It shows
	// on a small grid mesh whose four outer corners are the slanted window, put through the figures' homography so it
	// leans with the plaque; the mesh's positions change only with the layout. The marquee scrolls the line through
	// the window by the mesh's UVs each frame (a small buffer update, never a texture or an upload); outside the text
	// the clamped texture is clear, so nothing repeats. No text object, filter, mask or shader; the plaque takes no
	// press (eventMode none).
	//
	// THE DESKTOP PRESS ANYWHERE TO CONTINUE (Corey 2026-10-17 15:32, constants PLAQUE_PROMPT, game/plaquePrompt.svelte.ts):
	// while the desktop's feature intro or wrap up waits for a press, the prompt is drawn here, on the text field,
	// centred in the slanted window, at about the explainer lines' size and fitted inside the window with a margin. It
	// is the game's one prompt texture (game/pressPrompt.ts: Cinzel 700, the off-white ink, the soft shadow baked in),
	// taken from the shared cache at this screen's density when the prompt comes up or the layout changes, on a small
	// grid mesh put through the figures' homography so it leans with the plaque. Its layer sits between the crest and
	// the figures (over the tips). While it is up the plaque is clear: no explainer line, no figures, no crest. It
	// blinks with PressToContinue's own blink (an alpha, nothing drawn per frame).
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { layoutKind, portraitShippedK } from '../game/layoutSpec';
	import { boardRegistration } from '../game/boardArt';
	import { BOARD_PLAQUE, FRAME_ART, SPIN_TOTAL, TIMINGS } from '../game/constants';
	import { BOARD_PLAQUE_SPEC } from '../game/boardPlaqueSpec';
	import { PLAQUE_DIGIT_H, PLAQUE_GLYPHS, PLAQUE_GLYPH_PREFIX } from '../game/plaqueNumeralGlyphs';
	import { tokenizeNumerals } from '../game/numeralTokens';
	import { boardPlaqueSlot, frameLight } from '../game/boardPlateSlot';
	import { enableMipmaps } from '../game/mipmaps';
	import { boardIdle } from '../game/boardIdle';
	import { PLAQUE_TIPS as TIPS, edgeAt, marqueeAt, marqueeSpan, pointerIsMouse, slantEdges, tipAt, tipFont, tipLines } from '../game/plaqueTips';
	import { PLAQUE_PROMPT, PRESS_PROMPT } from '../game/constants';
	import { pressPromptFace, pressPromptRelease, pressPromptTake, type PressPromptRaster } from '../game/pressPrompt';
	import { plaquePrompt, plaquePromptReady } from '../game/plaquePrompt.svelte';

	const context = getContext();

	// ---- the scene graph (built once) -----------------------------------------------------------------------------
	const root = new PIXI.Container({ label: 'plaque-root' });
	const shadow = new PIXI.Sprite(PIXI.Texture.EMPTY);
	const day = new PIXI.Sprite(PIXI.Texture.EMPTY);
	const night = new PIXI.Sprite(PIXI.Texture.EMPTY);
	const fire = new PIXI.Sprite(PIXI.Texture.EMPTY);
	fire.blendMode = 'add';
	const crest = new PIXI.Container({ label: 'plaque-crest' });
	const crestDay = new PIXI.Sprite(PIXI.Texture.EMPTY);
	const crestNight = new PIXI.Sprite(PIXI.Texture.EMPTY);
	const crestFire = new PIXI.Sprite(PIXI.Texture.EMPTY);
	crestFire.blendMode = 'add';
	crest.addChild(crestDay, crestNight, crestFire);
	day.tint = crestDay.tint = FRAME_ART.tint;
	const figures = new PIXI.Container({ label: 'plaque-figures' });
	const MAXG = BOARD_PLAQUE.maxGlyphs;
	const positions = new Float32Array(MAXG * 8);
	const uvs = new Float32Array(MAXG * 8);
	const indices = new Uint32Array(MAXG * 6);
	for (let i = 0; i < MAXG; i += 1) indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
	const mesh = new PIXI.MeshSimple({ texture: PIXI.Texture.WHITE, vertices: positions, uvs, indices });
	mesh.autoUpdate = false;
	figures.addChild(mesh);
	// the explainer lines: the line's texture on a (gridX x gridY) mesh of quads through the homography; the mesh is the
	// slanted window (r5) and the line scrolls through it by its UVs
	const tips = new PIXI.Container({ label: 'plaque-tips' });
	const TX = TIPS.gridX;
	const TY = TIPS.gridY;
	const tipPos = new Float32Array((TX + 1) * (TY + 1) * 2);
	const tipUv = new Float32Array((TX + 1) * (TY + 1) * 2);
	/** each vertex's layout x (the UVs are worked out from it every frame) */
	const tipX = new Float32Array((TX + 1) * (TY + 1));
	const tipIdx = new Uint32Array(TX * TY * 6);
	for (let j = 0; j <= TY; j += 1) for (let i = 0; i <= TX; i += 1) tipUv.set([i / TX, j / TY], (j * (TX + 1) + i) * 2);
	for (let j = 0; j < TY; j += 1)
		for (let i = 0; i < TX; i += 1) {
			const a = j * (TX + 1) + i;
			const b = a + TX + 1;
			tipIdx.set([a, a + 1, b + 1, a, b + 1, b], (j * TX + i) * 6);
		}
	/** a 1 x 1 canvas only for measuring the words (never a texture) */
	const measureCanvas = document.createElement('canvas');
	measureCanvas.width = measureCanvas.height = 1;
	const tipCtx = measureCanvas.getContext('2d') as CanvasRenderingContext2D;
	/** the line on show's own canvas and texture: made when the line starts, destroyed when it ends (null between) */
	const lineTex = { canvas: null as HTMLCanvasElement | null, texture: null as PIXI.Texture | null, made: 0, freed: 0 };
	const freeLineTexture = () => {
		tipMesh.texture = PIXI.Texture.EMPTY;
		if (lineTex.texture) {
			lineTex.texture.destroy(true);
			lineTex.freed += 1;
		}
		if (lineTex.canvas) lineTex.canvas.width = lineTex.canvas.height = 0;
		lineTex.texture = null;
		lineTex.canvas = null;
	};
	const tipMesh = new PIXI.MeshSimple({ texture: PIXI.Texture.EMPTY, vertices: tipPos, uvs: tipUv, indices: tipIdx });
	tipMesh.autoUpdate = false;
	// nothing in the box until a line enters
	tipMesh.visible = false;
	tips.addChild(tipMesh);
	// a tap on the plaque is a tap on whatever was there before: the lines take no press
	tips.eventMode = 'none';
	tips.interactiveChildren = false;
	// the desktop's PRESS ANYWHERE (PLAQUE_PROMPT): the prompt's texture on a (gridX x gridY) mesh of quads over the
	// texture's own rectangle in layout units, through the homography
	const promptLayer = new PIXI.Container({ label: 'plaque-prompt' });
	const PGX = PLAQUE_PROMPT.gridX;
	const PGY = PLAQUE_PROMPT.gridY;
	const promptPos = new Float32Array((PGX + 1) * (PGY + 1) * 2);
	const promptUv = new Float32Array((PGX + 1) * (PGY + 1) * 2);
	const promptIdx = new Uint32Array(PGX * PGY * 6);
	for (let j = 0; j <= PGY; j += 1) for (let i = 0; i <= PGX; i += 1) promptUv.set([i / PGX, j / PGY], (j * (PGX + 1) + i) * 2);
	for (let j = 0; j < PGY; j += 1)
		for (let i = 0; i < PGX; i += 1) {
			const a = j * (PGX + 1) + i;
			const b = a + PGX + 1;
			promptIdx.set([a, a + 1, b + 1, a, b + 1, b], (j * PGX + i) * 6);
		}
	const promptMesh = new PIXI.MeshSimple({ texture: PIXI.Texture.EMPTY, vertices: promptPos, uvs: promptUv, indices: promptIdx });
	promptMesh.autoUpdate = false;
	// the texture is white letters over the soft shadow: the ink is the tint, the same as PressPromptText's
	promptMesh.tint = PRESS_PROMPT.ink;
	promptLayer.addChild(promptMesh);
	promptLayer.eventMode = 'none';
	promptLayer.interactiveChildren = false;
	promptLayer.visible = false;
	/** the prompt's mesh must be placed again (a new layout, a new density) before it is next drawn */
	const promptNeed = { v: true };
	root.addChild(shadow, day, night, fire, crest, tips, promptLayer, figures);
	for (const s of [shadow, day, night, fire, crestDay, crestNight, crestFire]) s.visible = false;
	figures.alpha = 0;
	tips.alpha = 0;
	tips.visible = false;

	// ---- the layout's numbers --------------------------------------------------------------------------------------
	type SpecKey = 'landscape' | 'portrait' | 'portraitTablet' | 'phone';
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const vw = $derived(context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale);
	/** the spec's layout: the portrait TABLET numbers whenever the SHIPPED rule grows the portrait frame (k above 1, SPEC
	 *  "Portrait, tablet"). The phone's bigger board (game/boardSizeVariant.ts) grows it on every phone; it keeps the
	 *  plaque that phone had (layoutSpec portraitShippedK) */
	const specKey = $derived<SpecKey>(kind === 'portrait' && portraitShippedK(vw) > 1 ? 'portraitTablet' : kind);
	const reg = $derived(boardRegistration(kind, vw));
	const textures = $derived.by(() => {
		const a = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		const k = kind;
		return {
			day: a?.[`boardPlaque_${k}`],
			shadow: a?.[`boardPlaqueShadow_${k}`],
			crest: a?.[`boardPlaqueCrest_${k}`],
			night: a?.[`boardPlaqueNight_${k}`],
			fire: a?.[`boardPlaqueFire_${k}`],
			crestNight: a?.[`boardPlaqueCrestNight_${k}`],
			crestFire: a?.[`boardPlaqueCrestFire_${k}`],
			glyph0: a?.[`${PLAQUE_GLYPH_PREFIX}0.png`],
			all: a,
		};
	});

	/** plain copies the tick and the mesh builder read (no reactive reads per frame) */
	let H: readonly number[] = BOARD_PLAQUE_SPEC.layouts.landscape.render.H_halved;
	let map: (u: number, v: number) => { x: number; y: number } = (u, v) => ({ x: u, y: v });
	/** map(u, v) = (regX + regM u, regY + regM v) */
	let regX = 0;
	let regY = 0;
	let regM = 1;
	let atlas: Record<string, PIXI.Texture> | undefined;
	let atlasTexture: PIXI.Texture | null = null;
	let nightIn = false;
	/** the block's centre, master px: the bump's pivot */
	const centre = { x: 0, y: 0 };

	/** a sprite over a box [x, y, w, h] of the render, whatever its texture's size */
	const cover = (sprite: PIXI.Sprite, tex: PIXI.Texture | undefined, box: readonly number[]) => {
		if (!tex) {
			sprite.texture = PIXI.Texture.EMPTY;
			return;
		}
		sprite.texture = tex;
		const at = map(box[0], box[1]);
		sprite.position.set(at.x, at.y);
		sprite.scale.set((reg.m * box[2]) / tex.width, (reg.m * box[3]) / tex.height);
	};

	/** what the layout was last placed for: a new loadedAssets object (every deferred group publishes one) with the same
	 *  textures and the same registration changes nothing */
	let placedFor = '';
	$effect(() => {
		const L = BOARD_PLAQUE_SPEC.layouts[specKey];
		const r = reg;
		const t = textures;
		const sig = [specKey, r.m, r.cell.x, r.cell.y, ...[t.day, t.shadow, t.crest, t.night, t.fire, t.crestNight, t.crestFire, t.glyph0].map((x) => x?.source.uid ?? 0)].join('|');
		if (sig === placedFor) return;
		placedFor = sig;
		map = r.map;
		// the registration is a scale and a shift (layoutSpec registrationOf): kept as numbers for the per-frame marquee
		const a0 = r.map(0, 0);
		regX = a0.x;
		regY = a0.y;
		regM = r.m;
		H = BOARD_PLAQUE.lean === 'full' ? L.render.H_full : L.render.H_halved;
		cover(shadow, t.shadow, L.render.shadowBox);
		cover(day, t.day, L.render.plaqueBox);
		cover(night, t.night, L.render.plaqueBox);
		cover(fire, t.fire, L.render.plaqueBox);
		cover(crestDay, t.crest, L.render.crestBox);
		cover(crestNight, t.crestNight, L.render.crestBox);
		cover(crestFire, t.crestFire, L.render.crestBox);
		nightIn = !!(t.night && t.fire && t.crestNight && t.crestFire);
		// the block's centre: the mean of its four corners
		const q = BOARD_PLAQUE.lean === 'full' ? L.render.figureQuadFull : L.render.figureQuadHalved;
		const c = map((q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4);
		centre.x = c.x;
		centre.y = c.y;
		figures.pivot.set(c.x, c.y);
		figures.position.set(c.x, c.y);
		// the figures' atlas: one whole-source texture for the mesh (made once per source), mipmapped like the stencil's
		if (t.glyph0 && t.glyph0.source !== atlasTexture?.source) {
			enableMipmaps(t.glyph0.source, context.stateApp.pixiApplication?.renderer as PIXI.Renderer | undefined);
			atlasTexture = new PIXI.Texture({ source: t.glyph0.source });
			mesh.texture = atlasTexture;
		}
		atlas = t.all;
		shown.relayout = true; // lay the figures out again for this layout
		lit.seq = -1;
		// the explainer lines: this layout's box and slanted window (the art this layout draws); a line on show is let go
		// (game/plaqueTips.ts)
		tipBox = TIPS.box[specKey] ?? TIPS.box.landscape;
		const art = TIPS.edges[kind] ?? TIPS.edges.landscape;
		Object.assign(win, slantEdges(art, L.render.plaqueBox, H, tipBox[1], tipBox[2]));
		win.built = false;
		tipNeed.layout = true;
		promptNeed.v = true;
	});

	// ---- the figures' layout (layout units at height PLAQUE_DIGIT_H, x from the row's centre, y from its optical centre) --
	const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
	const DIGIT_CELL = Math.max(...DIGITS.map((d) => PLAQUE_GLYPHS[d].w));
	const SEP_CELL = Math.max(PLAQUE_GLYPHS.comma.w, PLAQUE_GLYPHS.period.w);
	const RTL_RUN = /[֐-ࣿ](?:[.֐-ࣿ]*[֐-ࣿ])?/g;
	/** the order the tokenizer must draw: a right-to-left run reversed (EGP's "ج.م" shows as "م.ج") */
	const visualOrder = (text: string) => text.replace(RTL_RUN, (run) => [...run].reverse().join(''));
	type Cell = { key: string; cellW: number; w: number; h: number; d: number };
	const cellsOf = (text: string): Cell[] | null => {
		const tokens = tokenizeNumerals(visualOrder(text));
		if (!tokens) return null;
		const out: Cell[] = [];
		for (const name of tokens) {
			if (name === null) {
				out.push({ key: '', cellW: PLAQUE_DIGIT_H * BOARD_PLAQUE.space, w: 0, h: 0, d: 0 });
				continue;
			}
			const key = PLAQUE_GLYPHS[name] ? name : PLAQUE_GLYPHS[name.toUpperCase()] ? name.toUpperCase() : null;
			if (!key) continue; // not in the set: left out, never a partial stencil fallback
			const g = PLAQUE_GLYPHS[key];
			const isDigit = DIGITS.includes(key);
			const isSep = key === 'comma' || key === 'period';
			out.push({ key, cellW: isDigit ? DIGIT_CELL : isSep ? SEP_CELL : g.w, w: g.w, h: g.h, d: g.d });
		}
		return out;
	};
	type Placed = { key: string; x: number; y: number; w: number; h: number };
	const placed: Placed[] = Array.from({ length: MAXG }, () => ({ key: '', x: 0, y: 0, w: 0, h: 0 }));
	/** lay `text` out (the SPEC's fit rule: a longer string shrinks uniformly and is centred on the figure line);
	 *  `reserve` (a count-up's final string) fixes the box and the fit so the live string right-aligns in it */
	const layout = (text: string, reserve: string | null): { n: number; fit: number } => {
		const cells = cellsOf(text);
		if (!cells) return { n: 0, fit: 1 };
		const height = PLAQUE_DIGIT_H;
		const gap = height * BOARD_PLAQUE.gap;
		const rowW = (cs: Cell[]) => cs.reduce((sum, c) => sum + c.cellW, 0) + gap * Math.max(0, cs.length - 1);
		const total = rowW(cells);
		const rc = reserve ? cellsOf(reserve) : null;
		const reserved = rc ? Math.max(rowW(rc), total) : total;
		const maxW = BOARD_PLAQUE.maxWidthPerHeight * height;
		const fit = reserved > maxW ? maxW / reserved : 1;
		let cx = (reserved / 2 - total) * fit;
		let n = 0;
		for (const c of cells) {
			if (n >= MAXG) break;
			if (c.key) {
				const p = placed[n];
				p.key = c.key;
				p.w = c.w * fit;
				p.h = c.h * fit;
				p.x = cx + (c.cellW * fit - p.w) / 2;
				p.y = height / 2 - p.h + c.d * fit - ((1 - fit) * height) / 2;
				n += 1;
			}
			cx += (c.cellW + gap) * fit;
		}
		return { n, fit };
	};
	/** a layout-unit point through the homography H and the registration: master px into P (allocates nothing) */
	const P = { x: 0, y: 0 };
	const through = (x: number, y: number) => {
		const w = H[6] * x + H[7] * y + 1;
		P.x = regX + regM * ((H[0] * x + H[1] * y + H[2]) / w);
		P.y = regY + regM * ((H[3] * x + H[4] * y + H[5]) / w);
		return P;
	};
	// ---- the explainer lines: the mesh, the size, the drawing -----------------------------------------------------------
	let tipBox: readonly [number, number, number] = TIPS.box.landscape;
	const tipNeed = { layout: true };
	/** THE SLANTED WINDOW (r5), layout units: each slanted edge's x at the box's top row and its bottom row (left top,
	 *  left bottom, right top, right bottom; game/plaqueTips.ts slantEdges); built: the mesh's positions are on it; uvAt:
	 *  the strip offset the UVs were last worked out for */
	const win = { lt: -TIPS.box.landscape[0], lb: -TIPS.box.landscape[0], rt: TIPS.box.landscape[0], rb: TIPS.box.landscape[0], built: false, uvAt: NaN, uvW: NaN };
	/** a slanted edge's x at layout row y */
	const leftAt = (y: number) => edgeAt(win.lt, win.lb, tipBox[1], tipBox[2], y);
	const rightAt = (y: number) => edgeAt(win.rt, win.rb, tipBox[1], tipBox[2], y);
	/** the window's outermost points (its widest span) and its width at its narrowest row */
	const outL = () => Math.min(win.lt, win.lb);
	const outR = () => Math.max(win.rt, win.rb);
	const narrowW = () => Math.min(win.rt - win.lt, win.rb - win.lb);
	/** the mesh's positions: rows from the box's top to its bottom, each row from the left slanted edge to the right one
	 *  (only when the layout changes) */
	const buildTipWindow = () => {
		const [, top, bot] = tipBox;
		for (let j = 0; j <= TY; j += 1) {
			const y = top + ((bot - top) * j) / TY;
			const x0 = leftAt(y);
			const x1 = rightAt(y);
			for (let i = 0; i <= TX; i += 1) {
				const x = x0 + ((x1 - x0) * i) / TX;
				const p = through(x, y);
				const k = j * (TX + 1) + i;
				tipPos[k * 2] = p.x;
				tipPos[k * 2 + 1] = p.y;
				tipX[k] = x;
				tipUv[k * 2 + 1] = j / TY;
			}
		}
		tipMesh.geometry.getBuffer('aPosition').update();
		win.built = true;
		win.uvAt = NaN;
	};
	/** the scroll: every vertex's u is where its layout x falls on the line's strip (off: the strip's left edge, W: its
	 *  width). Outside 0..1 the clamped texture is clear. A small buffer update, no texture work */
	const scrollTipUvs = (off: number, W: number) => {
		if (!win.built) buildTipWindow();
		if (off === win.uvAt && W === win.uvW) return;
		win.uvAt = off;
		win.uvW = W;
		const n = (TX + 1) * (TY + 1);
		for (let k = 0; k < n; k += 1) tipUv[k * 2] = (tipX[k] - off) / W;
		tipMesh.geometry.getBuffer('aUV').update();
	};
	const fontAt = (px: number) => TIPS.font.replace('{px}', String(px));
	/** the face: loading, ready (Cinzel in, or given up on it and drawing in the fallback) */
	const face = { asked: false, ready: false };
	/** the words on this screen (Tap or Click), the size every line is drawn at (layout units, game/plaqueTips.ts
	 *  tipFont), the cap height (x the font size) the row is centred on, and the CSS px per layout unit it was made at */
	let tipTexts: string[] = [];
	let tipFontU = 0;
	let capK = 0.7;
	let planK = 0;
	const REF = 100;
	const widthAt1 = (s: string) => {
		tipCtx.font = fontAt(REF);
		return tipCtx.measureText(s).width / REF;
	};
	/** screen (CSS) px per layout unit across the box (its wider bottom edge) and down it */
	const cssPerUnit = () => {
		const [hw, top, bot] = tipBox;
		const span = (ax: number, ay: number, bx: number, by: number) => {
			const a = through(ax, ay);
			const ga = root.toGlobal({ x: a.x, y: a.y });
			const b = through(bx, by);
			const gb = root.toGlobal({ x: b.x, y: b.y });
			return Math.hypot(gb.x - ga.x, gb.y - ga.y);
		};
		return { ku: span(-hw, bot, hw, bot) / (2 * hw), kv: span(0, top, 0, bot) / (bot - top) };
	};
	const computePlans = () => {
		tipTexts = tipLines(pointerIsMouse());
		tipCtx.font = fontAt(REF);
		capK = (tipCtx.measureText('H').actualBoundingBoxAscent || REF * 0.7) / REF;
		planK = cssPerUnit().ku;
		// "never show the full sentence": the narrowest line never fits the slanted window at its narrowest row (r5)
		tipFontU = tipFont(tipBox, planK, capK, Math.min(...tipTexts.map(widthAt1)), narrowW());
	};
	/** the line on show: its index and words, its size, the texture's size, the strip it is drawn on (layout units: x 0
	 *  to stripW; its x on the box is the strip's x plus the marquee's offset, offset0 as it enters, offset1 once it is
	 *  gone), its ink in the strip, and the slanted edges at the ink's top and bottom rows (the innermost and the
	 *  outermost x of each edge over the rows the ink covers) */
	const tipShown = {
		index: -1,
		text: '',
		font: 0,
		cw: 0,
		ch: 0,
		kCss: 0,
		stripW: 0,
		offset0: 0,
		offset1: 0,
		ink: { x0: 0, x1: 0, y0: 0, y1: 0 },
		edge: { inL: 0, inR: 0, outL: 0, outR: 0 },
	};
	/** draw line `index` into its OWN canvas at the screen's own density and make its texture (once per line, never per
	 *  frame; freeLineTexture destroys it when the line ends). `fontCss`: DEV, a size on screen to draw it at instead */
	const drawTip = (index: number, fontCss: number | null = null): boolean => {
		const text = tipTexts[index];
		if (text === undefined) return false;
		const [, top, bot] = tipBox;
		const Hh = bot - top;
		const font = fontCss !== null && planK > 0 ? fontCss / planK : tipFontU;
		const pad = TIPS.stripPad;
		const W = widthAt1(text) * font + 2 * pad;
		tipShown.stripW = W;
		// the marquee (r5): the strip's left edge on the window's outermost right point as it enters (all of it outside
		// the right slanted edge), its right edge on the window's outermost left point once it is gone (all of it past
		// the left slanted edge)
		tipShown.offset0 = outR();
		tipShown.offset1 = outL() - W;
		// screen px per layout unit across the box and down it, at the renderer's resolution
		const res = (context.stateApp.pixiApplication?.renderer?.resolution ?? 1) * TIPS.texScale;
		const { ku, kv } = cssPerUnit();
		const cw = Math.max(2, Math.min(TIPS.texMax, Math.ceil(W * ku * res)));
		const ch = Math.max(2, Math.min(TIPS.texMax, Math.ceil(Hh * kv * res)));
		freeLineTexture();
		const canvas = document.createElement('canvas');
		canvas.width = cw;
		canvas.height = ch;
		tipShown.cw = cw;
		tipShown.ch = ch;
		const g = canvas.getContext('2d') as CanvasRenderingContext2D;
		g.clearRect(0, 0, cw, ch);
		// strip units -> canvas px: x from the strip's left, y from the box's top
		g.setTransform(cw / W, 0, 0, ch / Hh, 0, (-top * ch) / Hh);
		g.font = fontAt(font);
		g.textAlign = 'left';
		g.textBaseline = 'alphabetic';
		const base = (top + bot) / 2 + (capK * font) / 2;
		const cap = capK * font;
		g.fillStyle = TIPS.lipColor;
		g.fillText(text, pad, base + TIPS.lipOffset);
		g.fillStyle = TIPS.lightColor;
		g.fillText(text, pad, base + TIPS.lightOffset);
		const brass = g.createLinearGradient(0, base - cap, 0, base);
		brass.addColorStop(0, TIPS.brassTop);
		brass.addColorStop(1, TIPS.brassBottom);
		g.fillStyle = brass;
		g.fillText(text, pad, base);
		const mt = g.measureText(text);
		tipShown.ink = { x0: pad - mt.actualBoundingBoxLeft, x1: pad + mt.actualBoundingBoxRight, y0: base - mt.actualBoundingBoxAscent + Math.min(0, TIPS.lipOffset), y1: base + mt.actualBoundingBoxDescent + Math.max(0, TIPS.lightOffset) };
		const e0 = leftAt(tipShown.ink.y0);
		const e1 = leftAt(tipShown.ink.y1);
		const f0 = rightAt(tipShown.ink.y0);
		const f1 = rightAt(tipShown.ink.y1);
		tipShown.edge = { inL: Math.max(e0, e1), outL: Math.min(e0, e1), inR: Math.min(f0, f1), outR: Math.max(f0, f1) };
		// the line's texture: the canvas as it is (one upload), clamped, so past the clear padding at either end of the
		// text the window samples nothing (no repeat)
		const source = new PIXI.CanvasSource({ resource: canvas as unknown as PIXI.ICanvas, resolution: 1, addressMode: 'clamp-to-edge', scaleMode: 'linear', label: 'plaque-tips-line' });
		lineTex.canvas = canvas;
		lineTex.texture = new PIXI.Texture({ source, label: 'plaque-tips-line' });
		lineTex.made += 1;
		tipMesh.texture = lineTex.texture;
		win.uvAt = NaN;
		tipShown.index = index;
		tipShown.text = text;
		tipShown.font = font;
		tipShown.kCss = ku;
		return true;
	};

	// ---- the desktop's PRESS ANYWHERE on the text field (PLAQUE_PROMPT) -------------------------------------------------
	/** the prompt on show: the shared texture it holds, the line's centre x, baseline, advance width and cap height
	 *  (layout units, after the fit), the texture's rectangle (layout units), the density it was drawn at (device px
	 *  per layout unit), the size it was asked for and the width it was fitted to */
	const promptShown = { raster: null as PressPromptRaster | null, cx: 0, base: 0, w: 0, cap: 0, x0: 0, y0: 0, tw: 0, th: 0, px: 0, capAsked: 0, maxW: 0, placed: 0 };
	/** Cinzel is in (pressPromptFace said yes); until then, or if it never is, the plaque does not draw the prompt */
	let promptFaceOk = false;
	/** take the prompt's texture at this screen's density and lay its mesh over the window (when it comes up, or the
	 *  layout or the density changed; never per frame) */
	const placePrompt = () => {
		computePlans();
		const [, top, bot] = tipBox;
		const mid = (top + bot) / 2;
		// about the explainer lines' size (the same face, so the same cap height per font size)
		const capAsked = capK * tipFontU * PLAQUE_PROMPT.sizeOfTip;
		// centred in the slanted window at the row's middle, fitted to the window's width at the capitals' top row
		// (the window is a trapezoid, narrower at the top) less the margin
		const capTop = mid - capAsked / 2;
		const cx = (leftAt(mid) + rightAt(mid)) / 2;
		const half = Math.min(cx - leftAt(capTop), rightAt(capTop) - cx);
		const maxW = 2 * half * PLAQUE_PROMPT.fill;
		const px = planK * (context.stateApp.pixiApplication?.renderer?.resolution ?? 1);
		if (!(px > 0)) return false;
		// take the new one before letting the old one go, so the same size keeps its texture
		const raster = pressPromptTake(capAsked, maxW, px);
		if (promptShown.raster) pressPromptRelease(promptShown.raster);
		promptShown.raster = raster;
		const cap = raster.info.capUnits;
		const base = mid + cap / 2;
		const tw = raster.info.size[0] / px;
		const th = raster.info.size[1] / px;
		const x0 = cx - raster.anchor.x * tw;
		const y0 = base - raster.anchor.y * th;
		for (let j = 0; j <= PGY; j += 1)
			for (let i = 0; i <= PGX; i += 1) {
				const p = through(x0 + (tw * i) / PGX, y0 + (th * j) / PGY);
				const k = (j * (PGX + 1) + i) * 2;
				promptPos[k] = p.x;
				promptPos[k + 1] = p.y;
			}
		promptMesh.geometry.getBuffer('aPosition').update();
		promptMesh.texture = raster.texture;
		Object.assign(promptShown, { cx, base, w: raster.info.widthUnits, cap, x0, y0, tw, th, px, capAsked, maxW });
		promptShown.placed += 1;
		return true;
	};
	const unplacePrompt = () => {
		promptMesh.texture = PIXI.Texture.EMPTY;
		if (promptShown.raster) pressPromptRelease(promptShown.raster);
		promptShown.raster = null;
		promptNeed.v = true;
	};
	/** a desktop prompt waiting for a press (PressToContinue's count), read once a frame */
	let promptUpNow = false;
	/** the prompt's frame: can the plaque draw it (published for PressToContinue), is one up, is it drawn, its blink */
	const promptTick = () => {
		promptUpNow = plaquePrompt.count > 0;
		const ready = promptFaceOk && day.texture !== PIXI.Texture.EMPTY && !!root.parent;
		if (plaquePromptReady.ready !== ready) plaquePromptReady.ready = ready;
		if (promptUpNow && ready) {
			if (promptNeed.v || !promptShown.raster) promptNeed.v = !placePrompt();
			const on = !!promptShown.raster;
			if (promptLayer.alpha !== plaquePrompt.alpha) promptLayer.alpha = plaquePrompt.alpha;
			if (promptLayer.visible !== on) promptLayer.visible = on;
		} else if (promptShown.raster || promptLayer.visible) {
			promptLayer.visible = false;
			unplacePrompt();
		}
	};

	/** what the mesh holds now */
	const shown = { text: null as string | null, reserve: null as string | null, n: 0, fit: 1, relayout: true };
	const build = (text: string, reserve: string | null) => {
		const { n, fit } = layout(text, reserve);
		const src = atlasTexture?.source;
		const sw = src?.width || 1;
		const sh = src?.height || 1;
		for (let i = 0; i < MAXG; i += 1) {
			const o = i * 8;
			if (i >= n || !atlas) {
				positions.fill(0, o, o + 8);
				uvs.fill(0, o, o + 8);
				continue;
			}
			const g = placed[i];
			const tex = atlas[`${PLAQUE_GLYPH_PREFIX}${g.key}.png`];
			if (!tex) {
				positions.fill(0, o, o + 8);
				continue;
			}
			// TL, TR, BR, BL
			const corners = [g.x, g.y, g.x + g.w, g.y, g.x + g.w, g.y + g.h, g.x, g.y + g.h];
			for (let k = 0; k < 4; k += 1) {
				const p = through(corners[k * 2], corners[k * 2 + 1]);
				positions[o + k * 2] = p.x;
				positions[o + k * 2 + 1] = p.y;
			}
			const f = tex.frame;
			const u0 = f.x / sw;
			const v0 = f.y / sh;
			const u1 = (f.x + f.width) / sw;
			const v1 = (f.y + f.height) / sh;
			uvs.set([u0, v0, u1, v0, u1, v1, u0, v1], o);
		}
		mesh.geometry.getBuffer('aPosition').update();
		mesh.geometry.getBuffer('aUV').update();
		shown.text = text;
		shown.reserve = reserve;
		shown.n = n;
		shown.fit = fit;
		shown.relayout = false;
	};

	// ---- the running total: amount, fades, bump, final -------------------------------------------------------------
	/** a style duration in real ms; 0 while SKIP TO RESULT runs */
	const real = (ms: number) => (context.stateGame.skipping ? 0 : ms / Math.max(0.2, context.stateGameDerived.timeScale()));
	type Fade = { from: number; to: number; t0: number; ms: number; v: number };
	const fade = (v: number): Fade => ({ from: v, to: v, t0: 0, ms: 0, v });
	const figFade = fade(0);
	const crestFade = fade(1);
	const fadeTo = (f: Fade, to: number, ms: number, delay = 0, at = performance.now()) => {
		f.from = f.v;
		f.to = to;
		f.t0 = at + delay;
		f.ms = ms;
		if (ms <= 0 && delay <= 0) f.v = to;
	};
	const stepFade = (f: Fade, now: number) => {
		if (f.v === f.to) return f.v;
		if (now < f.t0) return f.v;
		const u = f.ms <= 0 ? 1 : Math.min(1, (now - f.t0) / f.ms);
		f.v = f.from + (f.to - f.from) * cubicOut(u);
		if (u >= 1) f.v = f.to;
		return f.v;
	};
	let amount = 0;
	let showing = false;
	/** the count of the final presentation (SPIN_TOTAL.finalCountMs): from, to, t0, ms; the reserve string */
	const count = { on: false, from: 0, to: 0, t0: 0, ms: 0, reserve: null as string | null };
	const bump = { t0: -1, ms: 1 };
	const rise = { t0: -1, ms: 1, scale: 1 };
	let finalRun = 0;
	const show = () => {
		if (showing) return;
		showing = true;
		const out = real(BOARD_PLAQUE.crestOutMs);
		fadeTo(crestFade, 0, out);
		fadeTo(figFade, 1, real(BOARD_PLAQUE.figuresInMs), out);
	};
	context.eventEmitter.subscribeOnMount({
		spinWinStep: ({ amount: value }) => {
			show();
			count.on = false;
			amount = value;
			bump.t0 = performance.now();
			bump.ms = Math.max(1, real(SPIN_TOTAL.bumpMs));
		},
		spinWinShow: ({ amount: value }) => {
			show();
			count.on = false;
			amount = value;
		},
		spinWinFinal: async ({ amount: value }) => {
			const run = ++finalRun;
			await waitForTimeout(Math.max(1, real(SPIN_TOTAL.finalDelayMs)));
			if (run !== finalRun) return;
			show();
			rise.scale = SPIN_TOTAL.finalScale;
			rise.t0 = performance.now();
			rise.ms = Math.max(1, real(SPIN_TOTAL.finalRiseMs));
			if (SPIN_TOTAL.finalCountMs > 0) {
				count.on = true;
				count.from = 0;
				count.to = value;
				count.t0 = performance.now() + real(SPIN_TOTAL.finalRiseMs);
				count.ms = Math.max(1, real(SPIN_TOTAL.finalCountMs));
				count.reserve = bookEventAmountToCurrencyString(Math.round(value));
			} else {
				count.on = false;
				amount = value;
			}
			await waitForTimeout(Math.max(1, real(SPIN_TOTAL.finalRiseMs + SPIN_TOTAL.finalCountMs + SPIN_TOTAL.finalHoldMs)));
		},
		spinWinHide: () => {
			finalRun += 1;
			count.on = false;
			bump.t0 = -1;
			rise.t0 = -1;
			rise.scale = 1;
			if (!showing) return;
			showing = false;
			fadeTo(figFade, 0, TIMINGS.winClearMs);
			fadeTo(crestFade, 1, real(BOARD_PLAQUE.crestBackMs));
		},
	});

	/** DEV (symbols_plaque review stills, tools/manticore/plaque_probe.js): a forced figure string, shown at once over
	 *  the mode plaque too; null hands the plaque back to the game */
	let forced: string | null = null;

	// ---- the explainer lines' run: idle, the order, the cadence, the marquee -------------------------------------------
	/** the shared idle rule (game/boardIdle.ts), copied for the tick by an effect (no reactive reads per frame) */
	let idleNow = false;
	$effect(() => {
		idleNow = boardIdle();
	});
	const tipFade = fade(0);
	/** off: nothing; wait: the board settled, the cadence starts at t; gap: the box is empty, the next line enters at t
	 *  (counted from base); run: a line is crossing the box. slot: lines shown in this idle spell; other: the other
	 *  lines shown so far (kept across spells) */
	type Phase = 'off' | 'wait' | 'gap' | 'run';
	const tipRun = { phase: 'off' as Phase, t: 0, base: 0, slot: 0, other: 0, index: -1 };
	/** the line crossing the box: when it entered (the tips' clock, ms), its path (dist layout units at v a ms, ms long,
	 *  easing in over ease), where it is (offset), and whether it is drawn at all (live: also through a hide's fade).
	 *  DEV: hold keeps it up whatever the board does; freezeMs (0 or more) stops it that far along, for a still */
	const msg = { index: -1, t0: 0, ms: 0, ease: 0, dist: 0, v: 0, offset: 0, live: false, hold: false, freezeMs: -1 };
	/** DEV (feedback/plaque_tips_r4/plaque_tips_probe.js): a line asked for now (shown at once; `hold` keeps it up
	 *  whatever the board does, `holdAt` 0..1 stops it that far along its path for a still); the cadence's two waits; the
	 *  tips' clock slowed or sped up */
	let tipPending: { index: number; hold: boolean; holdAt: number | null; fontCss: number | null } | null = null;
	let devHold = false;
	const pace = { gapMs: TIPS.gapMs, firstMs: TIPS.firstMs };
	let slow = 1;
	const tipLog: { at: number; what: string; index: number }[] = [];
	const tipNote = (what: string, index: number) => {
		if (!import.meta.env.DEV) return;
		tipLog.push({ at: clock.now, what, index });
		if (tipLog.length > 160) tipLog.splice(0, 80);
	};
	/** THE TIPS' CLOCK (ms): performance.now, or slower / faster under the DEV clock (every time below is on it) */
	const clock = { now: 0, real: 0 };
	/** the part of the strip within the window's widest span (layout x; the slanted edges cut inside it) */
	const visibleStrip = () => {
		const off = msg.offset;
		return { x0: Math.max(outL(), off), x1: Math.min(outR(), off + tipShown.stripW) };
	};
	/** the cut along the slanted edges (r5): the mesh is the window and the line scrolls through it by its UVs; while
	 *  none of the strip is within the window's widest span the mesh is not drawn */
	const placeLine = () => {
		const v = visibleStrip();
		const inside = v.x1 > v.x0 && !!lineTex.texture;
		tipMesh.visible = inside;
		if (inside) scrollTipUvs(msg.offset, tipShown.stripW);
		return inside;
	};

	/** DEV: every frame of a line's crossing, checked in the page (the probe reads it): frames, frames it did not move
	 *  left (holds), frames its whole ink was inside the slanted window (whole), its ink at the entry and at the end, the speed
	 *  after the ease in as a share of the constant speed, and why it ended */
	const runStat = {
		index: -1,
		t0: 0,
		end: '' as string,
		frames: 0,
		drawn: 0,
		holds: 0,
		frozen: 0,
		whole: 0,
		maxShownFrac: 0,
		firstDrawnU: -1,
		enterInkLeftU: 0,
		endInkRightU: NaN,
		endOffset: NaN,
		offset1: 0,
		minRatio: Infinity,
		maxRatio: 0,
		exitRatio: NaN,
		v: 0,
		ms: 0,
		ease: 0,
		fontCss: 0,
		prevOff: NaN,
		prevNow: 0,
		prevRatio: NaN,
		texAtStart: 0,
		texChanges: 0,
		texUid: -1,
	};
	const runs: Record<string, unknown>[] = [];
	const statStart = (now: number) => {
		if (!import.meta.env.DEV) return;
		Object.assign(runStat, { index: msg.index, t0: now, end: '', frames: 0, drawn: 0, holds: 0, frozen: 0, whole: 0, maxShownFrac: 0, firstDrawnU: -1, endInkRightU: NaN, endOffset: NaN, minRatio: Infinity, maxRatio: 0, exitRatio: NaN, prevRatio: NaN, prevOff: NaN, prevNow: now, texAtStart: lineTex.made, texChanges: 0, texUid: lineTex.texture?.source.uid ?? -1 });
		// from fully outside the RIGHT slanted edge: the ink's left end against the right edge's outermost x over the
		// ink's rows (0 or more: no ink inside the window)
		runStat.enterInkLeftU = tipShown.offset0 + tipShown.ink.x0 - tipShown.edge.outR;
		runStat.offset1 = tipShown.offset1;
		runStat.v = msg.v;
		runStat.ms = msg.ms;
		runStat.ease = msg.ease;
		runStat.fontCss = tipShown.font * tipShown.kCss;
	};
	const statFrame = (now: number, tau: number, frozen: boolean) => {
		if (!import.meta.env.DEV) return;
		const off = msg.offset;
		const e = tipShown.edge;
		runStat.frames += 1;
		const inkL = tipShown.ink.x0 + off;
		const inkR = tipShown.ink.x1 + off;
		// the most of the ink's width the window can show on any of the ink's rows (its widest rows)
		const shown = Math.max(0, Math.min(e.outR, inkR) - Math.max(e.outL, inkL));
		if (shown > 0) {
			runStat.drawn += 1;
			// how much ink came into the window on the first frame any did (at most one frame's travel)
			if (runStat.firstDrawnU < 0) runStat.firstDrawnU = shown;
		}
		runStat.maxShownFrac = Math.max(runStat.maxShownFrac, shown / Math.max(1e-6, inkR - inkL));
		// whole: the ink's box inside the trapezoid, i.e. inside both slanted edges at every row it covers
		if (inkL >= e.inL - 1e-6 && inkR <= e.inR + 1e-6) runStat.whole += 1;
		// one texture for the whole line: never a new one, never a swap
		if ((lineTex.texture?.source.uid ?? -1) !== runStat.texUid || lineTex.made !== runStat.texAtStart) runStat.texChanges += 1;
		if (frozen) runStat.frozen += 1;
		else if (!Number.isNaN(runStat.prevOff)) {
			const step = runStat.prevOff - off;
			const dt = now - runStat.prevNow;
			if (!(step > 0)) runStat.holds += 1;
			// the constant speed after the ease in (the very last frame is cut short at the end of the path)
			if (dt > 0 && tau - dt >= msg.ease && tau < msg.ms) {
				const r = step / (dt * msg.v);
				runStat.minRatio = Math.min(runStat.minRatio, r);
				runStat.maxRatio = Math.max(runStat.maxRatio, r);
				runStat.prevRatio = r;
			}
		}
		runStat.prevOff = off;
		runStat.prevNow = now;
	};
	const statEnd = (why: string) => {
		if (!import.meta.env.DEV || runStat.end) return;
		runStat.end = why;
		runStat.endOffset = msg.offset;
		// fully past the LEFT slanted edge: the ink's right end against the left edge's outermost x (0 or less)
		runStat.endInkRightU = tipShown.ink.x1 + msg.offset - tipShown.edge.outL;
		runStat.exitRatio = runStat.prevRatio;
		const { prevOff, prevNow, prevRatio, ...rest } = runStat;
		runs.push({ ...rest });
		if (runs.length > 60) runs.splice(0, 30);
	};

	const startLine = (now: number, index: number, hold: boolean, holdAt: number | null, fontCss: number | null = null): boolean => {
		computePlans();
		if (!drawTip(index, fontCss)) return false;
		msg.index = index;
		msg.t0 = now;
		msg.dist = tipShown.offset0 - tipShown.offset1;
		msg.v = (TIPS.scrollEmPerSec * tipShown.font) / 1000;
		const span = marqueeSpan(msg.dist, msg.v);
		msg.ms = span.ms;
		msg.ease = span.ease;
		msg.offset = tipShown.offset0;
		msg.hold = hold;
		msg.freezeMs = holdAt === null ? -1 : Math.max(0, Math.min(1, holdAt)) * msg.ms;
		msg.live = true;
		placeLine();
		// no fade in: the line enters from outside the box, at its full opacity
		fadeTo(tipFade, 1, 0, 0, now);
		tipRun.phase = 'run';
		tipRun.index = index;
		statStart(now);
		tipNote('enter', index);
		return true;
	};
	/** a line on show cut short at once (a new layout, a DEV ask): it just goes, and its texture with it */
	const cutLine = (now: number) => {
		fadeTo(tipFade, 0, 0, 0, now);
		tips.alpha = 0;
		tips.visible = false;
		tipMesh.visible = false;
		msg.live = false;
		msg.hold = false;
		freeLineTexture();
	};
	/** the marquee's step: the line's place now (always further left than the frame before, except a DEV still).
	 *  Returns true once its strip is wholly past the box's left edge */
	const stepLine = (now: number, count: boolean): boolean => {
		let tau = now - msg.t0;
		const frozen = msg.freezeMs >= 0 && tau >= msg.freezeMs;
		if (frozen) tau = msg.freezeMs;
		msg.offset = tipShown.offset0 - marqueeAt(tau, msg.dist, msg.v, msg.ms, msg.ease);
		placeLine();
		if (count) statFrame(now, tau, frozen);
		return !frozen && tau >= msg.ms;
	};
	const tipTick = (realNow: number) => {
		// the tips' clock
		clock.now = clock.real ? clock.now + (realNow - clock.real) / slow : realNow;
		clock.real = realNow;
		const now = clock.now;
		if (!face.asked && typeof document !== 'undefined' && document.fonts) {
			face.asked = true;
			const done = () => {
				face.ready = true;
			};
			document.fonts.load(TIPS.fontCheck).then(done, done);
		} else if (!face.asked) face.ready = true;
		const ready = face.ready && day.texture !== PIXI.Texture.EMPTY && !!root.parent;
		// the figures first: not while they are up or still fading out (the start delay counts from them gone)
		const want = ready && (idleNow || devHold || tipPending !== null) && !showing && figFade.v <= 0.001 && forced === null && !promptUpNow;
		if (ready && tipNeed.layout) {
			// a new layout: a line on show is let go, the next one comes firstMs later
			tipNeed.layout = false;
			if (tipRun.phase === 'run') {
				cutLine(now);
				statEnd('relayout');
				devHold = false;
				tipRun.phase = 'gap';
				tipRun.base = now;
				tipRun.t = now + pace.firstMs;
				tipNote('relayout', msg.index);
			}
		}
		if (!want) {
			if (tipRun.phase !== 'off') {
				// "hidden as soon as a spin starts": a line on show just goes (a quick fade, still moving); the next
				// idle stretch goes on in turn, and a line cut before it finished comes back first (2026-10-17 20:43)
				tipNote(tipRun.phase === 'wait' ? 'cancel' : 'hide', tipRun.index);
				if (tipRun.phase === 'run') {
					statEnd('hide');
					if (tipRun.slot > 0) tipRun.slot -= 1;
				}
				tipRun.phase = 'off';
				fadeTo(tipFade, 0, TIPS.hideMs, 0, now);
				msg.hold = false;
			}
		} else if (tipRun.phase === 'off') {
			tipRun.phase = 'wait';
			tipRun.t = now + (tipPending !== null ? 0 : TIPS.startDelayMs);
			tipNote('wait', -1);
		} else if (tipRun.phase === 'wait') {
			if (now >= tipRun.t) {
				// the board has settled: the first line of the spell firstMs after
				tipRun.phase = 'gap';
				tipRun.base = now;
				tipRun.t = now + pace.firstMs;
				tipNote('settled', -1);
			}
		} else if (tipPending !== null) {
			const ask = tipPending;
			tipPending = null;
			if (tipRun.phase === 'run') {
				cutLine(now);
				statEnd('cut');
			}
			devHold = ask.hold;
			if (!startLine(now, ask.index, ask.hold, ask.holdAt, ask.fontCss)) {
				tipRun.phase = 'gap';
				tipRun.base = now;
				tipRun.t = now + pace.gapMs;
			}
		} else if (tipRun.phase === 'gap') {
			if (now >= tipRun.t) {
				const at = tipAt(tipRun.slot, tipRun.other);
				if (startLine(now, at.index, false, null)) {
					if (at.usesOther) tipRun.other += 1;
					tipRun.slot += 1;
				} else tipRun.t = now + 250;
			}
		} else if (tipRun.phase === 'run') {
			if (stepLine(now, true)) {
				// "On exit they have to exit all the way to the left edge, not stop": the last letter has left the box's
				// left edge; the box is empty and the gap counts from now
				msg.live = false;
				tipMesh.visible = false;
				fadeTo(tipFade, 0, 0, 0, now);
				statEnd('gone');
				freeLineTexture();
				devHold = false;
				tipRun.phase = 'gap';
				tipRun.base = now;
				tipRun.t = now + pace.gapMs;
				tipNote('gone', msg.index);
			}
		}
		// a line hidden on its way keeps moving while it fades out (it never stops on the plaque)
		if (tipRun.phase !== 'run' && msg.live) stepLine(now, false);
		const ta = stepFade(tipFade, now) * TIPS.alpha;
		if (msg.live && tipRun.phase !== 'run' && ta <= 0.001) {
			// a hidden line is let go: the box is empty again, its texture destroyed
			msg.live = false;
			tipMesh.visible = false;
			freeLineTexture();
		}
		if (tips.alpha !== ta) tips.alpha = ta;
		tips.visible = msg.live && ta > 0.001;
	};

	// ---- the light (the frame's own) and the tick --------------------------------------------------------------------
	const lit = { seq: -1, tint: -1 };
	const mixTint = (a: number, b: number, t: number) => {
		const ch = (sh: number) => Math.round(((a >> sh) & 0xff) + (((b >> sh) & 0xff) - ((a >> sh) & 0xff)) * t);
		return (ch(16) << 16) | (ch(8) << 8) | ch(0);
	};
	const tick = () => {
		const slot = boardPlaqueSlot.current;
		if (slot && root.parent !== slot) slot.addChild(root);
		const now = performance.now();
		// the light: the frame's last write
		if (frameLight.seq !== lit.seq) {
			lit.seq = frameLight.seq;
			const n = nightIn && frameLight.nightSet ? frameLight.night : 0;
			const f = nightIn && frameLight.nightSet ? frameLight.fire : 0;
			const hasDay = day.texture !== PIXI.Texture.EMPTY;
			shadow.visible = shadow.texture !== PIXI.Texture.EMPTY;
			shadow.tint = frameLight.shadowTint;
			day.visible = hasDay && n < 1;
			crestDay.visible = crestDay.texture !== PIXI.Texture.EMPTY && n < 1;
			night.visible = crestNight.visible = hasDay && n > 0;
			fire.visible = crestFire.visible = hasDay && n > 0 && f > 0;
			night.alpha = crestNight.alpha = n;
			night.tint = crestNight.tint = frameLight.nightTint;
			fire.tint = crestFire.tint = frameLight.fireTint;
		}
		// the figures' tint: the mode's night tint, lerped with the scene's night
		const mode = context.stateGame.bonusMode;
		const nightNow = nightIn && frameLight.nightSet ? frameLight.night : 0;
		const tint = mixTint(BOARD_PLAQUE.tintDay, mode === 'epic' ? BOARD_PLAQUE.tintEpic : mode === 'super' ? BOARD_PLAQUE.tintSuper : BOARD_PLAQUE.tintDay, nightNow);
		if (tint !== lit.tint) {
			lit.tint = tint;
			mesh.tint = tint;
		}
		// the text: the forced one (DEV), the final count, or the running amount
		let value = amount;
		let reserve: string | null = null;
		if (count.on) {
			const u = now < count.t0 ? 0 : Math.min(1, (now - count.t0) / count.ms);
			value = count.from + (count.to - count.from) * cubicOut(u);
			reserve = count.reserve;
			if (u >= 1) {
				count.on = false;
				amount = count.to;
			}
		}
		const text = forced ?? bookEventAmountToCurrencyString(Math.round(value));
		if (atlasTexture && (shown.relayout || ((text !== shown.text || reserve !== shown.reserve) && (showing || forced !== null)))) build(text, reserve);
		// the desktop's prompt first (the lines and the figures stand aside for it), then the explainer lines
		promptTick();
		tipTick(now);
		// the plaque is clear while the prompt is up: a line on its way out is not drawn either
		if (promptUpNow && tips.visible) tips.visible = false;
		if (tips.visible && mesh.tint !== tipMesh.tint) tipMesh.tint = mesh.tint;
		// the fades, the bump and the final rise
		const fa = forced !== null ? 1 : stepFade(figFade, now);
		const ca = forced !== null ? 0 : stepFade(crestFade, now);
		const hidden = forced === null && (!!context.stateGame.plaque || promptUpNow);
		const alpha = hidden ? 0 : fa;
		if (figures.alpha !== alpha) figures.alpha = alpha;
		figures.visible = alpha > 0.001;
		if (crest.alpha !== ca) crest.alpha = ca;
		// "Remove the icon in the middle of that board" (r3, 10:17): PLAQUE_TIPS.crest false, never drawn
		crest.visible = TIPS.crest && ca > 0.001 && !promptUpNow;
		let s = 1;
		if (bump.t0 >= 0) {
			const u = (now - bump.t0) / bump.ms;
			if (u >= 1) bump.t0 = -1;
			else s = Math.max(s, 1 + (SPIN_TOTAL.bumpScale - 1) * Math.sin(Math.PI * Math.max(0, u)));
		}
		if (rise.t0 >= 0 && rise.scale !== 1) {
			const u = Math.min(1, (now - rise.t0) / rise.ms);
			s = Math.max(s, 1 + (rise.scale - 1) * SPIN_TOTAL.finalEasing(u));
		}
		if (figures.scale.x !== s) figures.scale.set(s);
	};

	// a new density places the prompt again: the layout's scale here, the renderer's resolution by its 'resize' event
	// (Game.svelte applyResolution calls app.resize(); the renderer is an EventEmitter at run time)
	$effect(() => {
		void context.stateLayoutDerived.mainLayout().scale;
		void context.stateLayoutDerived.canvasSizes();
		promptNeed.v = true;
	});
	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		ticker?.add(tick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
		let mounted = true;
		void pressPromptFace().then((ok) => {
			if (mounted) promptFaceOk = ok;
		});
		const emitter = context.stateApp.pixiApplication?.renderer as unknown as { on(e: 'resize', f: () => void): void; off(e: 'resize', f: () => void): void } | undefined;
		const onResize = () => (promptNeed.v = true);
		emitter?.on('resize', onResize);
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			const g = (node: PIXI.Container, x: number, y: number) => {
				const p = node.toGlobal({ x, y });
				return { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) };
			};
			const rect = (s: PIXI.Container) => (({ x, y, width, height }) => ({ x: +x.toFixed(2), y: +y.toFixed(2), w: +width.toFixed(2), h: +height.toFixed(2) }))(s.getBounds());
			Object.assign(((window as any).__manticore ??= {}), {
				/** THE SPIN AMOUNT PLAQUE (tools/manticore/plaque_probe.js): the layout, every layer as drawn (screen px), the
				 *  figures (text, glyphs, fit, each quad's four corners in screen px), the fades, the light, the tint */
				plaque: () => ({
					kind,
					specKey,
					parent: root.parent?.label ?? null,
					order: root.children.map((c) => c.label || (c === shadow ? 'shadow' : c === day ? 'day' : c === night ? 'night' : c === fire ? 'fire' : 'other')),
					layers: { shadow: { visible: shadow.visible, ...rect(shadow), tint: shadow.tint as number }, day: { visible: day.visible, ...rect(day), tint: day.tint as number }, night: { visible: night.visible, alpha: night.alpha, tint: night.tint as number }, fire: { visible: fire.visible, blend: fire.blendMode, tint: fire.tint as number }, crest: { visible: crest.visible, alpha: crest.alpha, ...rect(crestDay), night: crestNight.visible, fire: crestFire.visible } },
					figures: {
						text: shown.text,
						visual: shown.text === null ? null : visualOrder(shown.text),
						glyphs: shown.n,
						keys: placed.slice(0, shown.n).map((p) => p.key),
						fit: shown.fit,
						alpha: figures.alpha,
						visible: figures.visible,
						scale: figures.scale.x,
						tint: mesh.tint as number,
						atlas: atlasTexture ? { w: atlasTexture.source.pixelWidth, h: atlasTexture.source.pixelHeight, mips: atlasTexture.source.mipLevelCount } : null,
						quads: Array.from({ length: shown.n }, (_, i) => [0, 1, 2, 3].map((k) => g(figures, positions[i * 8 + k * 2], positions[i * 8 + k * 2 + 1]))),
					},
					/** the figure block's four corners on screen (the SPEC's halved quad) */
					block: (() => {
						const L = BOARD_PLAQUE_SPEC.layouts[specKey];
						const q = BOARD_PLAQUE.lean === 'full' ? L.render.figureQuadFull : L.render.figureQuadHalved;
						return q.map(([u, v]) => {
							const m = map(u, v);
							return g(root, m.x, m.y);
						});
					})(),
					light: { ...frameLight, nightIn },
					/** THE DESKTOP PRESS ANYWHERE (PLAQUE_PROMPT): up, drawn, its blink, its size against the explainer lines'
					 *  (CSS px), its ink box on screen (four corners), its margins to the slanted window at the capitals' top
					 *  row and at the baseline (layout units and CSS px; the ink is inside when all four are 0 or more) */
					prompt: (() => {
						const r = promptShown.raster;
						const ps = promptShown;
						const pt = (x: number, y: number) => {
							const m = through(x, y);
							return g(root, m.x, m.y);
						};
						const xl = ps.cx - ps.w / 2;
						const xr = ps.cx + ps.w / 2;
						const yt = ps.base - ps.cap;
						const margins = r ? { topLeft: xl - leftAt(yt), topRight: rightAt(yt) - xr, baseLeft: xl - leftAt(ps.base), baseRight: rightAt(ps.base) - xr } : null;
						return {
							count: plaquePrompt.count,
							up: promptUpNow,
							ready: plaquePromptReady.ready,
							drawn: promptLayer.visible && !!r && !!root.parent,
							layerAlpha: +promptLayer.alpha.toFixed(3),
							tint: promptMesh.tint as number,
							key: r?.key ?? null,
							placed: ps.placed,
							capCss: r ? +(ps.cap * planK).toFixed(2) : null,
							capAskedCss: r ? +(ps.capAsked * planK).toFixed(2) : null,
							tipFontCss: +(tipFontU * planK).toFixed(2),
							tipCapCss: +(tipFontU * capK * planK).toFixed(2),
							fitted: r ? +(ps.cap / ps.capAsked).toFixed(3) : null,
							widthU: r ? +ps.w.toFixed(2) : null,
							maxWU: r ? +ps.maxW.toFixed(2) : null,
							ink: r ? [pt(xl, yt), pt(xr, yt), pt(xr, ps.base), pt(xl, ps.base)] : null,
							window: [pt(win.lt, tipBox[1]), pt(win.rt, tipBox[1]), pt(win.rb, tipBox[2]), pt(win.lb, tipBox[2])],
							margins: margins && Object.fromEntries(Object.entries(margins).map(([k2, v]) => [k2, { u: +v.toFixed(2), css: +(v * planK).toFixed(2) }])),
							inside: !!margins && Object.values(margins).every((v) => v >= 0),
							texture: r ? { w: r.info.size[0], h: r.info.size[1], px: +ps.px.toFixed(4), fontPx: r.info.fontPx } : null,
						};
					})(),
					constants: { ...BOARD_PLAQUE, bumpScale: SPIN_TOTAL.bumpScale },
					memory: [day, night, fire, shadow, crestDay, crestNight, crestFire]
						.map((s) => s.texture)
						.concat(atlasTexture ? [atlasTexture] : [])
						.filter((t) => t && t !== PIXI.Texture.EMPTY)
						.map((t) => ({ label: t.label ?? null, w: t.source.pixelWidth, h: t.source.pixelHeight, mips: t.source.mipLevelCount })),
				}),
				/** a forced figure string (null: the game's own again) */
				plaqueForce: (text: string | null) => {
					forced = text;
					shown.relayout = true;
				},
				/** the visual (drawing) order a string is laid out in */
				plaqueVisual: (text: string) => visualOrder(text),
				/** THE EXPLAINER LINES (feedback/plaque_tips_r5/plaque_tips_probe.js): the run, the line on show (its size,
				 *  its place on the marquee), the text box, the slanted window and the ink on screen (CSS px, four corners
				 *  each: clipped to the window, and whole), points along each slanted edge with their outward normals, the
				 *  line's texture and the renderer's texture count, every line's width against the window on this screen,
				 *  the in-page frame checks of the line crossing now and of the last ones, the log */
				plaqueTips: () => {
					const [hw, top, bot] = tipBox;
					const pt = (x: number, y: number) => {
						const m = through(x, y);
						return g(root, m.x, m.y);
					};
					/** points along a slanted edge, top to bottom, each with its outward unit normal on screen */
					const along = (x0: number, x1: number, side: -1 | 1) => {
						const a = pt(x0, top);
						const b = pt(x1, bot);
						const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
						const nx = (side * (b.y - a.y)) / len;
						const ny = (-side * (b.x - a.x)) / len;
						return [0.08, 0.25, 0.42, 0.5, 0.58, 0.75, 0.92].map((t) => ({ t, ...pt(x0 + (x1 - x0) * t, top + (bot - top) * t), nx: +nx.toFixed(4), ny: +ny.toFixed(4) }));
					};
					const renderer = context.stateApp.pixiApplication?.renderer as unknown as { texture?: { managedTextures?: unknown[] } } | undefined;
					const corners = (x0: number, y0: number, x1: number, y1: number) =>
						[
							[x0, y0],
							[x1, y0],
							[x1, y1],
							[x0, y1],
						].map(([x, y]) => {
							const m = through(x, y);
							return g(root, m.x, m.y);
						});
					if (root.parent) computePlans();
					const on = tipRun.phase === 'run';
					const off = msg.offset;
					const v = visibleStrip();
					const k = tipShown.ink;
					const pad = TIPS.stripPad;
					const { prevOff, prevNow, prevRatio, ...run } = runStat;
					return {
						phase: tipRun.phase,
						index: on ? msg.index : -1,
						lastIndex: tipRun.index,
						slot: tipRun.slot,
						other: tipRun.other,
						text: on ? tipShown.text : null,
						font: on ? tipShown.font : null,
						/** the font size and the cap height on screen, CSS px */
						fontCss: on ? +(tipShown.font * tipShown.kCss).toFixed(2) : null,
						capCss: on ? +(tipShown.font * capK * tipShown.kCss).toFixed(2) : null,
						alpha: +tips.alpha.toFixed(3),
						visible: tips.visible,
						meshVisible: tipMesh.visible,
						live: msg.live,
						idle: idleNow,
						showing,
						crestAlpha: +crest.alpha.toFixed(3),
						crestVisible: crest.visible,
						faceReady: face.ready,
						faceLoaded: typeof document !== 'undefined' ? document.fonts.check(TIPS.fontCheck) : null,
						order: root.children.map((c) => c.label || 'Sprite'),
						eventMode: tips.eventMode,
						tint: tipMesh.tint as number,
						texture: { w: tipShown.cw, h: tipShown.ch, res: context.stateApp.pixiApplication?.renderer?.resolution ?? 1 },
						box: corners(-hw, top, hw, bot),
						field: (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(day.getBounds()),
						/** THE SLANTED WINDOW (r5), four corners on screen (top left, top right, bottom right, bottom left): the
						 *  mesh's own outline, where the line is cut */
						window: [pt(win.lt, top), pt(win.rt, top), pt(win.rb, bot), pt(win.lb, bot)],
						/** the slanted edges in layout units (x at the box's top and bottom rows) and the art's numbers */
						slant: { lt: +win.lt.toFixed(2), lb: +win.lb.toFixed(2), rt: +win.rt.toFixed(2), rb: +win.rb.toFixed(2), narrowU: +narrowW().toFixed(2), widestU: +(outR() - outL()).toFixed(2), art: TIPS.edges[kind] ?? null, kind },
						/** points along each slanted edge (top to bottom) on screen, with the outward normal */
						edges: { left: along(win.lt, win.lb, -1), right: along(win.rt, win.rb, 1) },
						/** the part of the strip within the window's widest span; null when none of it is */
						strip: msg.live && v.x1 > v.x0 ? corners(v.x0, top, v.x1, bot) : null,
						/** the ink inside the window (clipped by both slanted edges at its top and bottom rows), and the whole ink
						 *  wherever it is (outside the window too) */
						ink: (() => {
							if (!msg.live) return [];
							const l0 = Math.max(k.x0 + off, leftAt(k.y0));
							const r0 = Math.min(k.x1 + off, rightAt(k.y0));
							const l1 = Math.max(k.x0 + off, leftAt(k.y1));
							const r1 = Math.min(k.x1 + off, rightAt(k.y1));
							return r0 > l0 && r1 > l1 ? [[pt(l0, k.y0), pt(r0, k.y0), pt(r1, k.y1), pt(l1, k.y1)]] : [];
						})(),
						inkWhole: msg.live ? corners(k.x0 + off, k.y0, k.x1 + off, k.y1) : null,
						/** the line's own texture (one per line, destroyed when it ends) and the renderer's texture count */
						lineTexture: { alive: !!lineTex.texture, uid: lineTex.texture?.source.uid ?? null, label: lineTex.texture?.source.label ?? null, w: lineTex.texture?.source.pixelWidth ?? 0, h: lineTex.texture?.source.pixelHeight ?? 0, addressMode: lineTex.texture?.source.style.addressMode ?? null, made: lineTex.made, freed: lineTex.freed, meshHasIt: !!lineTex.texture && tipMesh.texture === lineTex.texture },
						textureCount: renderer?.texture?.managedTextures?.length ?? null,
						marquee: msg.live
							? {
									offset: +off.toFixed(3),
									offset0: +tipShown.offset0.toFixed(2),
									offset1: +tipShown.offset1.toFixed(2),
									dist: +msg.dist.toFixed(2),
									ms: Math.round(msg.ms),
									ease: msg.ease,
									/** the window's outermost left and right x (its widest span, the path's two ends) */
									winOutL: +outL().toFixed(2),
									winOutR: +outR().toFixed(2),
									/** each slanted edge's innermost and outermost x over the rows the ink covers: the line is whole
									 *  only with inkLeft >= inL and inkRight <= inR; fully outside with inkLeft >= outR, fully past
									 *  with inkRight <= outL */
									inL: +tipShown.edge.inL.toFixed(2),
									inR: +tipShown.edge.inR.toFixed(2),
									outL: +tipShown.edge.outL.toFixed(2),
									outR: +tipShown.edge.outR.toFixed(2),
									stripW: +tipShown.stripW.toFixed(2),
									inkLeft: +(k.x0 + off).toFixed(2),
									inkRight: +(k.x1 + off).toFixed(2),
									emPerSec: TIPS.scrollEmPerSec,
									unitsPerSec: +(msg.v * 1000).toFixed(1),
									cssPerSec: +(msg.v * 1000 * tipShown.kCss).toFixed(1),
									frozen: msg.freezeMs >= 0,
								}
							: null,
						times: on ? { t0: msg.t0, end: msg.t0 + msg.ms, hold: msg.hold } : null,
						next: tipRun.phase === 'gap' || tipRun.phase === 'wait' ? Math.round(tipRun.t - clock.now) : null,
						/** the tips' clock (ms; performance.now unless slowed or sped up) */
						clock: clock.now,
						slow,
						lines: tipTexts.slice(),
						kCss: +planK.toFixed(4),
						/** every line on this screen: its size on screen, its width against the slanted window's narrowest
						 *  row (r5) and against r4's box (layout units) */
						sizes: tipTexts.map((t) => {
							const w = widthAt1(t) * tipFontU;
							return { text: t, fontCss: +(tipFontU * planK).toFixed(2), widthU: +w.toFixed(1), winU: +narrowW().toFixed(1), wider: w > narrowW(), overWin: +(w / narrowW()).toFixed(3), boxU: 2 * hw, stripW: +(w + 2 * pad).toFixed(1) };
						}),
						boxUnits: [...tipBox],
						constants: { ...TIPS },
						pace: { ...pace },
						/** the line crossing now (or the last one), checked every frame in the page */
						run: { ...run },
						runs: runs.map((r) => ({ ...r })),
						log: tipLog.map((e) => ({ ...e })),
					};
				},
				/** show line `i` (0 is line 1) now, entering at the right edge. `hold` keeps it up whatever the board does;
				 *  with `holdAt` (0..1) it stops that far along its path, for a still, until plaqueTipsForce(null);
				 *  `fontCss` draws it at another size on screen */
				plaqueTipsShow: (i: number, opts: { hold?: boolean; holdAt?: number; fontCss?: number } = {}) => {
					tipPending = { index: i, hold: !!opts.hold, holdAt: opts.holdAt ?? null, fontCss: opts.fontCss ?? null };
				},
				/** r1's: line `i` up and held (it crosses whatever the board does); null lets a stopped line go on from where
				 *  it stands and hands the plaque back to the cadence */
				plaqueTipsForce: (i: number | null) => {
					if (i === null) {
						if (msg.freezeMs >= 0) {
							// on along its path from its stop, at full speed (its ease in was before the stop)
							msg.t0 = clock.now - msg.freezeMs;
							msg.freezeMs = -1;
						}
						msg.hold = false;
						devHold = false;
						return;
					}
					tipPending = { index: i, hold: true, holdAt: null, fontCss: null };
				},
				/** the cadence's waits (ms); null puts the constants back */
				plaqueTipsPace: (p: { gapMs?: number; firstMs?: number } | null) => {
					pace.gapMs = p?.gapMs ?? TIPS.gapMs;
					pace.firstMs = p?.firstMs ?? TIPS.firstMs;
					// a wait under way is counted again from its start with the new numbers
					if (tipRun.phase === 'gap') tipRun.t = tipRun.base + (tipRun.slot === 0 ? pace.firstMs : pace.gapMs);
				},
				/** the tips' clock runs `k` times slower (4: quarter speed; 0.25: four times faster, for a quick check of
				 *  every line); 1 is real time */
				plaqueTipsSlow: (k: number) => {
					slow = Math.max(0.1, k);
				},
			});
		}
		return () => {
			mounted = false;
			ticker?.remove(tick);
			emitter?.off('resize', onResize);
			unplacePrompt();
			plaquePromptReady.ready = false;
			root.removeFromParent();
			freeLineTexture();
			root.destroy({ children: true });
		};
	});
</script>
