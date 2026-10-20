<script lang="ts" module>
	export type EmitterEventSpinWin =
		/** the step is over: SNAP to the book's cascade.spinWin (the running steps already got here) */
		| { type: 'spinWinShow'; amount: number }
		/** a cluster's count-up landed: `amount` is the running spin total after it; `clear` the book's cluster (size,
		 *  symbol, its win as presented) for the plaque's row, `together` how many clusters its step clears (1.0.04) */
		| { type: 'spinWinStep'; amount: number; clear?: { n: number; s: string; w: number }; together?: number }
		/** a cascade with no cascade straight after it is down, awaited. `toHud` (1.0.04, PLAQUE_STREAK): it was the
		 *  spin's last clear, so the total flies to the HUD's WIN and this resolves as it arrives */
		| { type: 'spinWinFinal'; amount: number; toHud?: boolean }
		| { type: 'spinWinHide' }
		/** THE WAR STANDARD FLAG ROW (1.0.04, STORYBOARD.md S3 to S7): the tease missed (dim, fade); the trigger pulse (the
		 *  row becomes the badge); the feature's trigger beat (the badge flares); the beat is over (the badge goes) */
		| { type: 'plaqueTease'; what: 'miss' | 'trigger' | 'beat' | 'out' };
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
	// Each line is drawn ONCE, when it comes up, into the lines' one kept canvas texture (the Cinzel face the intro cards
	// use, at the renderer's resolution, clear pixels padding the text; made with the first line, destroyed only with the
	// plaque, 2026-10-18, so an idle board makes no texture). It shows
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
	import { cubicOut, quadOut, sineInOut } from 'svelte/easing';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { layoutKind, portraitShippedK } from '../game/layoutSpec';
	import { boardRegistration } from '../game/boardArt';
	import { BOARD_PLAQUE, FRAME_ART, PLAQUE_BADGE, PLAQUE_CLEARS, PLAQUE_FIELD, PLAQUE_FLAGS, PLAQUE_RECAP, PLAQUE_STREAK, SPIN_TOTAL, TIMINGS, type PlaqueClearsLayout } from '../game/constants';
	import { plaqueGlowTexture } from '../game/plaqueGlow';
	import { teaseNow } from '../game/teaseState';
	import { recap, recapLineOn } from '../game/recap.svelte';
	import { plaqueTap } from '../game/plaqueTap';
	import { stateBet } from 'state-shared';
	import { plaqueField, type PlaqueFieldMap } from '../game/plaqueField';
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
	/** the lines' ONE canvas and texture (2026-10-18, Corey "b"): made with the first line, redrawn (and resized) for
	 *  each line after, destroyed only with the plaque, so an idle board makes and frees no texture (it used to make one
	 *  per line and destroy it at the line's end). `on`: a line is drawn in it now. made / freed count lines. */
	const lineTex = { canvas: null as HTMLCanvasElement | null, texture: null as PIXI.Texture | null, on: false, made: 0, freed: 0 };
	/** the line on show ends: the mesh lets go of the texture, which is kept for the next line */
	const freeLineTexture = () => {
		tipMesh.texture = PIXI.Texture.EMPTY;
		if (lineTex.on) lineTex.freed += 1;
		lineTex.on = false;
	};
	/** the plaque goes: the kept texture and its canvas with it */
	const destroyLineTexture = () => {
		freeLineTexture();
		lineTex.texture?.destroy(true);
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
	/** this layout's rows and total (PLAQUE_CLEARS) */
	let CL: PlaqueClearsLayout = PLAQUE_CLEARS.layouts.landscape;
	/** this layout's key in the per-layout size sets (PLAQUE_CLEARS, PLAQUE_FLAGS.scale, PLAQUE_BADGE.scale) */
	let clKey: 'landscape' | 'portrait' | 'phone' = 'landscape';
	/** this layout's field map (game/plaqueField.ts): its H, its k, the field's corners */
	let field: PlaqueFieldMap = plaqueField(TIPS.edges.landscape, BOARD_PLAQUE_SPEC.layouts.landscape.render.plaqueBox, BOARD_PLAQUE_SPEC.layouts.landscape.render.H_halved);
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
		// THE ONE PERSPECTIVE (game/plaqueField.ts): every layer below goes through this H
		field = plaqueField(TIPS.edges[kind] ?? TIPS.edges.landscape, L.render.plaqueBox, L.render.H_halved);
		H = BOARD_PLAQUE.lean === 'field' ? field.H : BOARD_PLAQUE.lean === 'full' ? L.render.H_full : L.render.H_halved;
		cover(shadow, t.shadow, L.render.shadowBox);
		cover(day, t.day, L.render.plaqueBox);
		cover(night, t.night, L.render.plaqueBox);
		cover(fire, t.fire, L.render.plaqueBox);
		cover(crestDay, t.crest, L.render.crestBox);
		cover(crestNight, t.crestNight, L.render.crestBox);
		cover(crestFire, t.crestFire, L.render.crestBox);
		nightIn = !!(t.night && t.fire && t.crestNight && t.crestFire);
		// this layout's rows and total (PLAQUE_CLEARS; the portrait tablet takes the upright phone's numbers)
		clKey = kind === 'landscape' ? 'landscape' : kind === 'phone' ? 'phone' : 'portrait';
		CL = PLAQUE_CLEARS.layouts[clKey];
		for (const sl of slots) sl.sig = '';
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
		offerTex.placed = false;
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
	/** THE SPIN TOTAL's layout (1.0.04, PLAQUE_CLEARS: the total on the RIGHT of the plaque, right aligned at totalX, at
	 *  totalSize of the figure height, centred on the face's centre row). The SPEC's fit rule: a longer string shrinks
	 *  uniformly, here to stay right of totalMinX (and inside the dark field); `reserve` (a count-up's final string) fixes
	 *  the fit so the live string does not change size as it counts. The DEV forced strings go through it too */
	const totalBox = { x0: 0, x1: 0 };
	const layout = (text: string, reserve: string | null): { n: number; fit: number } => {
		const cells = cellsOf(text);
		if (!cells) return { n: 0, fit: 1 };
		const height = PLAQUE_DIGIT_H;
		const gap = height * BOARD_PLAQUE.gap;
		const rowW = (cs: Cell[]) => cs.reduce((sum, c) => sum + c.cellW, 0) + gap * Math.max(0, cs.length - 1);
		const total = rowW(cells);
		const rc = reserve ? cellsOf(reserve) : null;
		const reserved = rc ? Math.max(rowW(rc), total) : total;
		const size = CL.totalSize;
		// the row never runs past totalMinX nor the dark field (the one perspective: the field is faceW / k layout units wide)
		const fieldHalf = BOARD_PLAQUE.lean === 'field' ? ((field.faceW / field.k) * BOARD_PLAQUE.fieldFill) / 2 : Infinity;
		const maxW = Math.min(CL.totalX - CL.totalMinX, CL.totalX + fieldHalf);
		const fit = reserved * size > maxW ? maxW / (reserved * size) : 1;
		const k = size * fit;
		const cy = PLAQUE_FIELD.layoutCentreY;
		let cx = CL.totalX - total * k;
		totalBox.x0 = cx;
		totalBox.x1 = CL.totalX;
		let n = 0;
		for (const c of cells) {
			if (n >= MAXG) break;
			if (c.key) {
				const p = placed[n];
				p.key = c.key;
				p.w = c.w * k;
				p.h = c.h * k;
				p.x = cx + (c.cellW * k - p.w) / 2;
				p.y = cy + (height / 2 - c.h + c.d) * k;
				n += 1;
			}
			cx += (c.cellW + gap) * k;
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
		tipTexts = tipLines(pointerIsMouse(), stateBet.activeBetModeKey === 'SUPER_ANTE', recapLineOn());
		tipCtx.font = fontAt(REF);
		capK = (tipCtx.measureText('H').actualBoundingBoxAscent || REF * 0.7) / REF;
		planK = cssPerUnit().ku;
		// "never show the full sentence": the narrowest line never fits the slanted window at its narrowest row (r5). Only
		// the lines with words: an empty one (the recap's line 2 with nothing to show, Super Ante's line 6) is never shown,
		// and its width 0 turned the rule off (1.0.04, found 2026-10-20 by tools/manticore/plaque_tips_probe.js: on the
		// desktop "A win on a lit tile doubles it" fitted the window whole)
		const worded = tipTexts.filter((t) => t !== '');
		tipFontU = tipFont(tipBox, planK, capK, worded.length ? Math.min(...worded.map(widthAt1)) : 0, narrowW());
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
		if (text === undefined || text === '') return false;
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
		// the kept canvas, made once (its texture below), resized to this line
		const canvas = lineTex.canvas ?? document.createElement('canvas');
		if (lineTex.texture) lineTex.texture.source.resize(cw, ch, 1);
		else {
			canvas.width = cw;
			canvas.height = ch;
		}
		tipShown.cw = cw;
		tipShown.ch = ch;
		const g = canvas.getContext('2d') as CanvasRenderingContext2D;
		// the kept canvas still carries the last line's transform (and its pixels when the size did not change)
		g.setTransform(1, 0, 0, 1, 0, 0);
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
		// the lines' texture: the canvas as it is (one upload per line), clamped, so past the clear padding at either end
		// of the text the window samples nothing (no repeat). Made with the first line; later lines re-upload into it
		if (lineTex.texture) lineTex.texture.source.update();
		else {
			const source = new PIXI.CanvasSource({ resource: canvas as unknown as PIXI.ICanvas, resolution: 1, addressMode: 'clamp-to-edge', scaleMode: 'linear', label: 'plaque-tips-line' });
			lineTex.canvas = canvas;
			lineTex.texture = new PIXI.Texture({ source, label: 'plaque-tips-line' });
		}
		lineTex.on = true;
		lineTex.made += 1;
		tipMesh.texture = lineTex.texture;
		win.uvAt = NaN;
		tipShown.index = index;
		tipShown.text = text;
		tipShown.font = font;
		tipShown.kCss = ku;
		return true;
	};

	// ---- THE FEATURE RECAP OFFER (1.0.04, PLAQUE_RECAP; STORYBOARD.md section 6) ---------------------------------------
	// After a feature's wrap-up, while the base game is idle and until the next spin, the plaque offers the recap: one still
	// line in the explainer lines' brass, centred and fitted to the dark field. Drawn ONCE into its own canvas when it
	// comes up (or the layout or the density changes), on a small grid mesh through the plaque's H; destroyed when the
	// offer ends. The explainer lines skip while it is up.
	const offerLayer = new PIXI.Container({ label: 'plaque-offer' });
	offerLayer.eventMode = 'none';
	offerLayer.interactiveChildren = false;
	offerLayer.visible = false;
	const OGX = 8;
	const OGY = 2;
	const offerPos = new Float32Array((OGX + 1) * (OGY + 1) * 2);
	const offerUv = new Float32Array((OGX + 1) * (OGY + 1) * 2);
	const offerIdx = new Uint32Array(OGX * OGY * 6);
	for (let j = 0; j <= OGY; j += 1) for (let i = 0; i <= OGX; i += 1) offerUv.set([i / OGX, j / OGY], (j * (OGX + 1) + i) * 2);
	for (let j = 0; j < OGY; j += 1)
		for (let i = 0; i < OGX; i += 1) {
			const a = j * (OGX + 1) + i;
			const b = a + OGX + 1;
			offerIdx.set([a, a + 1, b + 1, a, b + 1, b], (j * OGX + i) * 6);
		}
	const offerMesh = new PIXI.MeshSimple({ texture: PIXI.Texture.EMPTY, vertices: offerPos, uvs: offerUv, indices: offerIdx });
	offerMesh.autoUpdate = false;
	offerLayer.addChild(offerMesh);
	const offerTex = { canvas: null as HTMLCanvasElement | null, texture: null as PIXI.Texture | null, placed: false, t0: -1, text: '', made: 0 };
	// over the explainer lines and the prompt, under the figures
	root.addChildAt(offerLayer, root.getChildIndex(promptLayer) + 1);
	const placeOffer = () => {
		computePlans();
		const text = pointerIsMouse() ? PLAQUE_RECAP.offerMouse : PLAQUE_RECAP.offerTouch;
		const [, top, bot] = tipBox;
		const Hh = bot - top;
		let font = tipFontU * PLAQUE_RECAP.offerSizeOfTip;
		const maxW = narrowW() * PLAQUE_RECAP.offerFill;
		if (widthAt1(text) * font > maxW) font = maxW / widthAt1(text);
		const pad = TIPS.stripPad;
		const W = widthAt1(text) * font + 2 * pad;
		const res = (context.stateApp.pixiApplication?.renderer?.resolution ?? 1) * TIPS.texScale;
		const { ku, kv } = cssPerUnit();
		if (!(ku > 0)) return false;
		const cw = Math.max(2, Math.min(TIPS.texMax, Math.ceil(W * ku * res)));
		const ch = Math.max(2, Math.min(TIPS.texMax, Math.ceil(Hh * kv * res)));
		const canvas = offerTex.canvas ?? document.createElement('canvas');
		if (offerTex.texture) offerTex.texture.source.resize(cw, ch, 1);
		else {
			canvas.width = cw;
			canvas.height = ch;
		}
		const g = canvas.getContext('2d') as CanvasRenderingContext2D;
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.clearRect(0, 0, cw, ch);
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
		if (offerTex.texture) offerTex.texture.source.update();
		else {
			const source = new PIXI.CanvasSource({ resource: canvas as unknown as PIXI.ICanvas, resolution: 1, addressMode: 'clamp-to-edge', scaleMode: 'linear', label: 'plaque-offer' });
			offerTex.canvas = canvas;
			offerTex.texture = new PIXI.Texture({ source, label: 'plaque-offer' });
			offerTex.made += 1;
		}
		// the mesh over the strip, centred on the field
		for (let j = 0; j <= OGY; j += 1)
			for (let i = 0; i <= OGX; i += 1) {
				const p = through(-W / 2 + (W * i) / OGX, top + (Hh * j) / OGY);
				const k = (j * (OGX + 1) + i) * 2;
				offerPos[k] = p.x;
				offerPos[k + 1] = p.y;
			}
		offerMesh.geometry.getBuffer('aPosition').update();
		offerMesh.texture = offerTex.texture as PIXI.Texture;
		offerTex.placed = true;
		offerTex.text = text;
		return true;
	};
	const freeOffer = () => {
		offerMesh.texture = PIXI.Texture.EMPTY;
		offerTex.texture?.destroy(true);
		if (offerTex.canvas) offerTex.canvas.width = offerTex.canvas.height = 0;
		offerTex.texture = null;
		offerTex.canvas = null;
		offerTex.placed = false;
		offerTex.t0 = -1;
	};
	const offerTick = (now: number) => {
		const up = offerOn && idleNow && !showing && figFade.v <= 0.001 && !promptUpNow && forced === null && !context.stateGame.plaque && day.texture !== PIXI.Texture.EMPTY && !!root.parent && face.ready;
		if (up) {
			if (!offerTex.placed && !placeOffer()) return;
			if (offerTex.t0 < 0) offerTex.t0 = now;
			const a = Math.min(1, Math.max(0, (now - offerTex.t0) / Math.max(1, PLAQUE_RECAP.offerInMs)));
			offerLayer.alpha = a * TIPS.alpha;
			offerLayer.visible = true;
			if (offerMesh.tint !== mesh.tint) offerMesh.tint = mesh.tint;
		} else {
			if (offerLayer.visible) offerLayer.visible = false;
			offerTex.t0 = -1;
			if (!offerOn && offerTex.texture) freeOffer();
		}
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
		// the bump and the lift scale the total about its own centre
		const c = through((totalBox.x0 + totalBox.x1) / 2, PLAQUE_FIELD.layoutCentreY);
		figures.pivot.set(c.x, c.y);
		figures.position.set(c.x, c.y);
		centre.x = c.x;
		centre.y = c.y;
	};

	// ---- THE CLUSTER ROWS (1.0.04, PLAQUE_CLEARS; STORYBOARD.md S2, layout C) ------------------------------------------
	// Three row slots (the newest, the one before it, an older one leaving), each ONE mesh of numeral quads on the plaque
	// atlas plus ONE four-vertex mesh for the symbol's icon (the mmSymbols tile, its art trimmed), every corner through the
	// plaque's H. A slot's buffers are rewritten only when its row, size, place or alpha changed (every frame only while a
	// row comes in: 220 ms). No text object, no filter, no texture made per frame.
	type RowSlot = { box: PIXI.Container; glyphs: PIXI.MeshSimple; pos: Float32Array; uv: Float32Array; icon: PIXI.MeshSimple; ipos: Float32Array; iuv: Float32Array; sig: string; quads: number };
	const RG = PLAQUE_CLEARS.rowGlyphs;
	const rowsLayer = new PIXI.Container({ label: 'plaque-rows' });
	const makeSlot = (): RowSlot => {
		const pos = new Float32Array(RG * 8);
		const uv = new Float32Array(RG * 8);
		const idx = new Uint32Array(RG * 6);
		for (let i = 0; i < RG; i += 1) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
		const glyphs = new PIXI.MeshSimple({ texture: PIXI.Texture.WHITE, vertices: pos, uvs: uv, indices: idx });
		glyphs.autoUpdate = false;
		const ipos = new Float32Array(8);
		const iuv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
		const icon = new PIXI.MeshSimple({ texture: PIXI.Texture.EMPTY, vertices: ipos, uvs: iuv, indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });
		icon.autoUpdate = false;
		const box = new PIXI.Container({ label: 'plaque-row' });
		box.addChild(icon, glyphs);
		box.visible = false;
		rowsLayer.addChild(box);
		return { box, glyphs, pos, uv, icon, ipos, iuv, sig: '', quads: 0 };
	};
	const slots: RowSlot[] = [makeSlot(), makeSlot(), makeSlot()];
	root.addChild(rowsLayer);
	// the War Standard flag row and the hit badge (PLAQUE_FLAGS, PLAQUE_BADGE): over the rows, under the streak
	const flagsLayer = new PIXI.Container({ label: 'plaque-flags' });
	const badgeLayer = new PIXI.Container({ label: 'plaque-badge' });
	for (const l of [flagsLayer, badgeLayer]) {
		l.eventMode = 'none';
		l.interactiveChildren = false;
		l.visible = false;
	}
	root.addChild(flagsLayer, badgeLayer);
	/** the whole-source texture of a symbol tile's atlas (made once per source, never per frame) */
	const iconSources = new Map<number, PIXI.Texture>();
	const iconSource = (t: PIXI.Texture) => {
		let w = iconSources.get(t.source.uid);
		if (!w) {
			w = new PIXI.Texture({ source: t.source });
			iconSources.set(t.source.uid, w);
		}
		return w;
	};
	/** a row's amount: the plaque's own formatting of the book's win, the currency mark taken off (Corey's "8 x [icon]
	 *  2.40"): the run from its first digit to its last */
	const rowAmount = (amount: number) => {
		const t = bookEventAmountToCurrencyString(Math.round(amount));
		if (!PLAQUE_CLEARS.dropCurrency) return t;
		const a = t.search(/[0-9]/);
		let b = -1;
		for (let i = t.length - 1; i >= 0; i -= 1) if (t[i] >= '0' && t[i] <= '9') { b = i; break; }
		return a >= 0 && b >= a ? t.slice(a, b + 1) : t;
	};
	/** lay one row into a slot: `${n} ×`, the icon, the amount; left edge at CL.rowX, centre row y, `size` of the figure
	 *  height, the icon `iconH` x the digit height; never past `maxX` (shrinks about its left edge) */
	const buildRow = (sl: RowSlot, n: number, code: string, amountText: string, size: number, iconH: number, y: number, maxX: number) => {
		const head = cellsOf(`${n} ×`) ?? [];
		const tail = cellsOf(amountText) ?? [];
		const height = PLAQUE_DIGIT_H;
		const gap = height * BOARD_PLAQUE.gap;
		const sp = height * BOARD_PLAQUE.space;
		const tex = (context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined)?.[`${code}.png`];
		const trim = PLAQUE_CLEARS.iconTrim[code] ?? [0, 0, 1, 1];
		const iconHU = height * iconH;
		const iconWU = tex ? (iconHU * (trim[2] - trim[0])) / (trim[3] - trim[1]) : 0;
		const rowW = (cs: Cell[]) => cs.reduce((sum, c) => sum + c.cellW, 0) + gap * Math.max(0, cs.length - 1);
		const wHead = rowW(head);
		const wTail = rowW(tail);
		const widthU = wHead + sp + iconWU + sp + wTail;
		const fit = CL.rowX + widthU * size > maxX ? Math.max(0.2, (maxX - CL.rowX) / (widthU * size)) : 1;
		const k = size * fit;
		const src = atlasTexture?.source;
		const sw = src?.width || 1;
		const sh = src?.height || 1;
		let q = 0;
		const put = (c: Cell, x: number) => {
			if (!c.key || !atlas || q >= RG) return;
			const g = atlas[`${PLAQUE_GLYPH_PREFIX}${c.key}.png`];
			if (!g) return;
			const w = c.w * k;
			const h = c.h * k;
			const x0 = x + (c.cellW * k - w) / 2;
			const y0 = y + (height / 2 - c.h + c.d) * k;
			const corners = [x0, y0, x0 + w, y0, x0 + w, y0 + h, x0, y0 + h];
			const o = q * 8;
			for (let j = 0; j < 4; j += 1) {
				const p = through(corners[j * 2], corners[j * 2 + 1]);
				sl.pos[o + j * 2] = p.x;
				sl.pos[o + j * 2 + 1] = p.y;
			}
			const f = g.frame;
			sl.uv.set([f.x / sw, f.y / sh, (f.x + f.width) / sw, f.y / sh, (f.x + f.width) / sw, (f.y + f.height) / sh, f.x / sw, (f.y + f.height) / sh], o);
			q += 1;
		};
		let x = CL.rowX;
		for (const c of head) {
			put(c, x);
			x += (c.cellW + gap) * k;
		}
		x += (sp - gap) * k;
		if (tex) {
			const ih = iconHU * k;
			const iw = iconWU * k;
			const y0 = y - ih / 2;
			const corners = [x, y0, x + iw, y0, x + iw, y0 + ih, x, y0 + ih];
			for (let j = 0; j < 4; j += 1) {
				const p = through(corners[j * 2], corners[j * 2 + 1]);
				sl.ipos[j * 2] = p.x;
				sl.ipos[j * 2 + 1] = p.y;
			}
			const whole = iconSource(tex);
			const f = tex.frame;
			const W = tex.source.width || 1;
			const Hh = tex.source.height || 1;
			const u0 = (f.x + f.width * trim[0]) / W;
			const u1 = (f.x + f.width * trim[2]) / W;
			const v0 = (f.y + f.height * trim[1]) / Hh;
			const v1 = (f.y + f.height * trim[3]) / Hh;
			sl.iuv.set([u0, v0, u1, v0, u1, v1, u0, v1]);
			if (sl.icon.texture !== whole) sl.icon.texture = whole;
			sl.icon.visible = true;
			sl.icon.geometry.getBuffer('aPosition').update();
			sl.icon.geometry.getBuffer('aUV').update();
			x += iw + sp * k;
		} else {
			sl.icon.visible = false;
			x += sp * k;
		}
		for (const c of tail) {
			put(c, x);
			x += (c.cellW + gap) * k;
		}
		for (let i = q; i < sl.quads; i += 1) {
			sl.pos.fill(0, i * 8, i * 8 + 8);
			sl.uv.fill(0, i * 8, i * 8 + 8);
		}
		sl.quads = q;
		if (atlasTexture && sl.glyphs.texture !== atlasTexture) sl.glyphs.texture = atlasTexture;
		sl.glyphs.geometry.getBuffer('aPosition').update();
		sl.glyphs.geometry.getBuffer('aUV').update();
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
	/** THE ROWS AND THE COUNT (PLAQUE_CLEARS). One record per cluster, newest last: it starts coming in at `start`,
	 *  lands at `land` (real ms, performance.now) and then the total counts to its `amount` (the book's running spin
	 *  total after it) over `countMs` real */
	type RowRec = { n: number; code: string; text: string; amount: number; start: number; land: number; landed: boolean; countMs: number };
	const rows: RowRec[] = [];
	/** the total: what it shows now, its count (from, to, t0, ms), whether it is up at all, the count's reserve string,
	 *  and the book's step total (spinWinShow) it settles on once every row has landed */
	const total = { value: 0, from: 0, to: 0, t0: 0, ms: 1, on: false, shown: false, reserve: null as string | null, step: -1 };
	const bump = { t0: -1, ms: 1 };
	/** THE MOVE TO THE HUD (PLAQUE_STREAK): lift, flight, pulse (real ms from t0); from / to in the root's units; r: the
	 *  dark field's height there (the streak's sizes are shares of it); hud: the WIN readout's box */
	const move = { phase: 'none' as 'none' | 'lift' | 'fly', t0: 0, lift: 1, fly: 1, from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, has: false, r: 1, pulseT0: -1, pulseMs: 1, hud: { w: 0, h: 0 } };
	const rowsFade = fade(1);
	let finalRun = 0;
	/** DEV: every row and every move to the HUD (tools/manticore/plaque_clear_probe.js) */
	const clearLog: { at: number; n: number; code: string; text: string; amount: number; together: number; start: number; land: number; countMs: number; countAt: number; countEnd: number }[] = [];
	/** DEV: the row whose count is running (its countEnd is stamped when the count lands) */
	let countLog: (typeof clearLog)[number] | null = null;
	const moveLog: { at: number; queueMs: number; liftAt: number; flyAt: number; arriveAt: number; from: { x: number; y: number } | null; to: { x: number; y: number } | null; amount: number; skipped: boolean }[] = [];
	const show = () => {
		if (showing) return;
		// a new spin's first figures: whatever the last one left (fading out) goes
		rows.length = 0;
		total.shown = false;
		total.on = false;
		total.step = -1;
		total.value = 0;
		showing = true;
		const out = real(BOARD_PLAQUE.crestOutMs);
		fadeTo(crestFade, 0, out);
		fadeTo(figFade, 1, real(BOARD_PLAQUE.figuresInMs), out);
		fadeTo(rowsFade, 1, 0);
	};
	/** the plaque empty at once (a skip, the arrival) */
	const clearNow = () => {
		rows.length = 0;
		total.on = false;
		total.shown = false;
		total.step = -1;
		total.value = 0;
		bump.t0 = -1;
		move.phase = 'none';
		showing = false;
		fadeTo(figFade, 0, 0);
		fadeTo(rowsFade, 1, 0);
		fadeTo(crestFade, 1, 0);
	};
	/** the HUD's WIN amount on screen, in the root's units (one DOM read per move; null when it is not there) */
	const hudWin = (): { x: number; y: number; w: number; h: number } | null => {
		if (typeof document === 'undefined' || !root.parent) return null;
		const stat = [...document.querySelectorAll('.stat')].find((el) => el.querySelector('.label')?.textContent?.trim() === 'WIN');
		const v = stat?.querySelector('.value') as HTMLElement | null | undefined;
		const app = context.stateApp.pixiApplication;
		const canvas = app?.canvas as HTMLCanvasElement | undefined;
		if (!v || !app || !canvas) return null;
		const r = v.getBoundingClientRect();
		const c = canvas.getBoundingClientRect();
		if (!(r.width > 0) || !(c.width > 0)) return null;
		const sx = app.screen.width / c.width;
		const sy = app.screen.height / c.height;
		const a = root.toLocal({ x: (r.left - c.left) * sx, y: (r.top - c.top) * sy });
		const b = root.toLocal({ x: (r.right - c.left) * sx, y: (r.bottom - c.top) * sy });
		return { x: (a.x + b.x) / 2, y: a.y + (b.y - a.y) * 0.55, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
	};
	context.eventEmitter.subscribeOnMount({
		spinWinStep: ({ amount: value, clear, together }) => {
			show();
			const now = performance.now();
			if (!clear) {
				// no cluster detail: the plain step of before (the total jumps to it and bumps)
				total.shown = true;
				total.on = false;
				total.value = value;
				bump.t0 = now;
				bump.ms = Math.max(1, real(SPIN_TOTAL.bumpMs));
				return;
			}
			// THE ONE OWNER (STORYBOARD.md section 3): the flag row hands the plaque over first (a miss's leftovers go in
			// handoverOutMs; a hit's row finishes shrinking into the badge), and the first row comes in after it
			let free = now;
			if (fl.on) {
				if (fl.shrinkT0 >= 0) free = fl.shrinkT0 + fl.shrinkMs;
				else {
					if (fl.outT0 < 0) {
						fl.outT0 = now;
						fnote('handover');
					}
					free = fl.outT0 + real(PLAQUE_FLAGS.handoverOutMs);
				}
			}
			const k = Math.min(3, Math.max(1, together ?? 1)) - 1;
			const prev = rows[rows.length - 1];
			const start = Math.max(now, free, prev ? prev.start + real(PLAQUE_CLEARS.rowStaggerMs[k]) : now);
			const land = start + real(PLAQUE_CLEARS.rowInMs);
			const rec: RowRec = { n: clear.n, code: clear.s, text: rowAmount(clear.w), amount: value, start, land, landed: false, countMs: real(PLAQUE_CLEARS.countMs[k]) };
			rows.push(rec);
			if (rows.length > 4) rows.shift();
			if (import.meta.env.DEV) {
				clearLog.push({ at: now, n: rec.n, code: rec.code, text: rec.text, amount: value, together: together ?? 1, start, land, countMs: rec.countMs, countAt: -1, countEnd: -1 });
				if (clearLog.length > 200) clearLog.splice(0, 100);
			}
		},
		spinWinShow: ({ amount: value }) => {
			show();
			// the book's step total: the counts settle there once every row of the step has landed
			total.step = value;
			if (!rows.length) {
				total.shown = true;
				total.value = value;
			}
		},
		spinWinFinal: async ({ amount: value, toHud }) => {
			const run = ++finalRun;
			if (!toHud) {
				// more of the spin to come (a swipe and its cascades): the total stays; the plain hold of before
				await waitForTimeout(Math.max(1, real(SPIN_TOTAL.finalDelayMs + SPIN_TOTAL.finalHoldMs)));
				return;
			}
			const log = import.meta.env.DEV ? { at: performance.now(), queueMs: 0, liftAt: -1, flyAt: -1, arriveAt: -1, from: null as { x: number; y: number } | null, to: null as { x: number; y: number } | null, amount: value, skipped: false } : null;
			if (log) {
				moveLog.push(log);
				if (moveLog.length > 60) moveLog.splice(0, 30);
			}
			if (context.stateGame.skipping) {
				// SKIP TO RESULT: none of it; the HUD is written at once by the handler
				clearNow();
				if (log) log.skipped = true;
				return;
			}
			// the counts first (every row landed and counted), at most queueWaitMaxMs
			const now = performance.now();
			const last = rows[rows.length - 1];
			const rest = Math.max(last ? last.land + last.countMs - now : 0, total.on ? total.t0 + total.ms - now : 0);
			const wait = Math.min(real(PLAQUE_STREAK.queueWaitMaxMs), Math.max(0, rest));
			if (log) log.queueMs = Math.round(wait);
			if (wait > 0) await waitForTimeout(wait);
			if (run !== finalRun) return;
			for (const r of rows) r.landed = true;
			total.on = false;
			total.shown = true;
			total.value = value;
			await waitForTimeout(Math.max(1, real(PLAQUE_STREAK.toHudDelayMs)));
			if (run !== finalRun) return;
			if (context.stateGame.skipping) {
				clearNow();
				return;
			}
			// the lift and the flight (the tick draws them from move.t0)
			const hud = hudWin();
			move.has = !!hud;
			move.from.x = centre.x;
			move.from.y = centre.y;
			if (hud) {
				move.to.x = hud.x;
				move.to.y = hud.y;
				move.hud.w = hud.w;
				move.hud.h = hud.h;
			}
			const q = field.quad;
			move.r = Math.abs(map(q[3][0], q[3][1]).y - map(q[0][0], q[0][1]).y) || 1;
			move.t0 = performance.now();
			move.lift = Math.max(1, real(PLAQUE_STREAK.liftMs));
			move.fly = hud ? Math.max(PLAQUE_STREAK.flightMinRealMs, real(PLAQUE_STREAK.flightMs)) : 0;
			move.phase = 'lift';
			fadeTo(rowsFade, 0, real(PLAQUE_CLEARS.rowsOutMs));
			if (log) {
				log.liftAt = move.t0;
				log.flyAt = move.t0 + move.lift;
				log.from = { ...move.from };
				log.to = hud ? { x: hud.x, y: hud.y } : null;
			}
			await waitForTimeout(move.lift + move.fly);
			if (run !== finalRun) return;
			// arrival: the pulse behind the HUD's WIN; the plaque is empty (the handler writes the HUD now)
			if (log) log.arriveAt = performance.now();
			if (hud) {
				move.pulseT0 = performance.now();
				move.pulseMs = Math.max(1, real(PLAQUE_STREAK.pulseMs));
			}
			clearNow();
		},
		plaqueTease: ({ what }) => {
			const now = performance.now();
			fnote(`event ${what}${fl.on ? '' : ' (no row)'}`);
			if (what === 'miss') {
				if (fl.on && fl.missT0 < 0 && fl.shrinkT0 < 0) fl.missT0 = now;
			} else if (what === 'trigger') toBadge(now, PLAQUE_BADGE.shrinkAfterMs);
			else if (what === 'beat') {
				// a hit with no pulse of its own (a Mystery's) becomes the badge here, at once
				if (fl.on || context.stateGame.scatterCells.length >= 3) toBadge(now, 0);
				bd.flareT0 = now;
			} else if (what === 'out') {
				if (bd.on && bd.outT0 < 0) bd.outT0 = now;
				if (fl.on && fl.outT0 < 0) fl.outT0 = now;
			}
		},
		spinWinHide: () => {
			finalRun += 1;
			// a new reveal (or the round's end): the flag row and the badge of the spin before go
			flagsReset();
			bump.t0 = -1;
			move.phase = 'none';
			total.on = false;
			if (!showing) {
				rows.length = 0;
				total.shown = false;
				total.step = -1;
				return;
			}
			showing = false;
			fadeTo(figFade, 0, TIMINGS.winClearMs);
			fadeTo(rowsFade, 0, TIMINGS.winClearMs);
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
	/** the recap's state for the tick (no reactive reads per frame): the plaque offers the feature recap; a box is open */
	let offerOn = false;
	let recapOpenNow = false;
	$effect(() => {
		offerOn = recap.offer;
		recapOpenNow = recap.open !== null;
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
		const inside = v.x1 > v.x0 && lineTex.on;
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
		// (1.0.04) the recap: the feature offer has the plaque instead, and the lines pause while the box is open
		const want = ready && (idleNow || devHold || tipPending !== null) && !showing && figFade.v <= 0.001 && forced === null && !promptUpNow && (devHold || tipPending !== null || (!offerOn && !recapOpenNow));
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
			// the first line of the spell enters idleResumeMs after the board went idle (this wait, then firstMs)
			tipRun.t = now + (tipPending !== null ? 0 : Math.max(0, TIPS.idleResumeMs - pace.firstMs));
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
				} else if (tipTexts[at.index] === '') {
					// a line this mode skips (Super Ante's line 6): straight on to the next
					tipRun.slot += 1;
					tipNote('skip', at.index);
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
	// ---- the rows each frame (roles: the newest big, the one before small, an older one leaving) ----------------------
	const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
	const setSlot = (sl: RowSlot, r: RowRec | undefined, size: number, iconH: number, y: number, a: number, maxX: number, tint: number) => {
		if (!r || a <= 0.003) {
			if (sl.box.visible) sl.box.visible = false;
			return;
		}
		const sig = `${r.start}|${r.text}|${size.toFixed(4)}|${iconH.toFixed(3)}|${y.toFixed(2)}|${maxX}|${field.k}`;
		if (sig !== sl.sig) {
			buildRow(sl, r.n, r.code, r.text, size, iconH, y, maxX);
			sl.sig = sig;
		}
		if (sl.box.alpha !== a) sl.box.alpha = a;
		if (sl.glyphs.tint !== tint) sl.glyphs.tint = sl.icon.tint = tint;
		sl.box.visible = true;
	};
	/** the rows' right limit now (the hit badge, centred, keeps them left of it: PLAQUE_CLEARS badgeRowMaxX) */
	let rowsMaxX = () => CL.rowMaxX;
	const rowsTick = (now: number, alpha: number) => {
		let n = 0;
		for (let i = 0; i < rows.length; i += 1) if (rows[i].start <= now) n = i + 1;
		if (!n || alpha <= 0.001 || !atlasTexture) {
			for (const sl of slots) if (sl.box.visible) sl.box.visible = false;
			return;
		}
		const nw = rows[n - 1];
		const u = clamp01((now - nw.start) / Math.max(1, nw.land - nw.start));
		const e = sineInOut(u);
		const maxX = rowsMaxX();
		const tint = mesh.tint as number;
		setSlot(slots[0], nw, CL.big, CL.bigIcon, CL.yBig + PLAQUE_CLEARS.enterRise * (1 - e), alpha * (u < 1 ? clamp01((u - 0.15) / 0.65) : 1), maxX, tint);
		const pv = n >= 2 ? rows[n - 2] : undefined;
		setSlot(slots[1], pv, CL.big + (CL.small - CL.big) * e, CL.bigIcon + (CL.smallIcon - CL.bigIcon) * e, CL.yBig + (CL.ySmall - CL.yBig) * e, alpha * (1 + (CL.smallAlpha - 1) * e), maxX, tint);
		const od = n >= 3 && u < 1 ? rows[n - 3] : undefined;
		setSlot(slots[2], od, CL.small, CL.smallIcon, CL.ySmall - PLAQUE_CLEARS.leaveRise * e, alpha * CL.smallAlpha * (1 - clamp01(e / 0.7)), maxX, tint);
	};

	// ---- THE WAR STANDARD FLAG ROW AND THE HIT BADGE (PLAQUE_FLAGS, PLAQUE_BADGE; STORYBOARD.md S3 to S7) --------------
	// Every element is one four-vertex mesh on the flags atlas (tools/build_plaque_flags.py), its corners through the
	// plaque's H; glows are the same with the additive blend. Laid out in FACE units (r6 B's) and taken to layout units by
	// the field map's k. It reads the board (stateGame.scatterCells: every War Standard on it, landed or stung in) and the
	// tease (game/teaseState.ts, read only: the hold that is running lights the flag at stake); the handler's plaqueTease
	// events say miss, trigger, beat and out. Nothing here allocates per frame once the meshes exist.
	type Quad = { mesh: PIXI.MeshSimple; pos: Float32Array; uv: Float32Array };
	const makeQuad = (parent: PIXI.Container, add = false): Quad => {
		const pos = new Float32Array(8);
		const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
		const mesh = new PIXI.MeshSimple({ texture: PIXI.Texture.EMPTY, vertices: pos, uvs: uv, indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });
		mesh.autoUpdate = false;
		if (add) mesh.blendMode = 'add';
		mesh.visible = false;
		parent.addChild(mesh);
		return { mesh, pos, uv };
	};
	const flagTex = (name: string) => (context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined)?.[`plqf_${name}.png`];
	/** a quad of the flags atlas `name`, centred on layout (cx, cy), w x h layout units */
	const placeQuad = (q: Quad, name: string, cx: number, cy: number, w: number, h: number, alpha: number, tint = 0xffffff) => {
		const tex = flagTex(name);
		if (!tex || alpha <= 0.003 || w <= 0 || h <= 0) {
			if (q.mesh.visible) q.mesh.visible = false;
			return;
		}
		const x0 = cx - w / 2;
		const y0 = cy - h / 2;
		const corners = [x0, y0, x0 + w, y0, x0 + w, y0 + h, x0, y0 + h];
		for (let j = 0; j < 4; j += 1) {
			const p = through(corners[j * 2], corners[j * 2 + 1]);
			q.pos[j * 2] = p.x;
			q.pos[j * 2 + 1] = p.y;
		}
		const f = tex.frame;
		const W = tex.source.width || 1;
		const Hh = tex.source.height || 1;
		q.uv.set([f.x / W, f.y / Hh, (f.x + f.width) / W, f.y / Hh, (f.x + f.width) / W, (f.y + f.height) / Hh, f.x / W, (f.y + f.height) / Hh]);
		const whole = iconSource(tex);
		if (q.mesh.texture !== whole) q.mesh.texture = whole;
		q.mesh.geometry.getBuffer('aPosition').update();
		q.mesh.geometry.getBuffer('aUV').update();
		q.mesh.alpha = Math.min(1, alpha);
		if (q.mesh.tint !== tint) q.mesh.tint = tint;
		q.mesh.visible = true;
	};
	// the row's quads: glows first (added), then the flags; per landed flag (glow, flag), per level flag (glow, empty,
	// full, flash), per separator (bar, lozenge)
	const landedQ = [0, 1, 2].map(() => ({ glow: makeQuad(flagsLayer, true), flag: makeQuad(flagsLayer), flash: makeQuad(flagsLayer, true) }));
	const levelQ = [0, 1, 2].map(() => ({ glow: makeQuad(flagsLayer, true), empty: makeQuad(flagsLayer), full: makeQuad(flagsLayer), flash: makeQuad(flagsLayer, true) }));
	const sepQ = [0, 1, 2].map(() => ({ bar: makeQuad(flagsLayer), loz: makeQuad(flagsLayer) }));
	const badgeQ = { glow: makeQuad(badgeLayer, true), flag: makeQuad(badgeLayer) };
	// the badge's count: two numeral quads on the plaque atlas
	const BGQ = 2;
	const bPos = new Float32Array(BGQ * 8);
	const bUv = new Float32Array(BGQ * 8);
	const badgeDigits = new PIXI.MeshSimple({ texture: PIXI.Texture.WHITE, vertices: bPos, uvs: bUv, indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]) });
	badgeDigits.autoUpdate = false;
	badgeLayer.addChild(badgeDigits);
	/** the row: on, Super Ante's, when it came in, when each slot filled (real ms; -1 = empty), the War Standards on the
	 *  board last frame, the miss / handover / shrink starts and the EPIC re-strike */
	const fl = { on: false, spent: false, sa: false, t0: 0, fillAt: [-1, -1, -1, -1, -1, -1], prevN: 0, missT0: -1, outT0: -1, shrinkT0: -1, shrinkMs: 1, restrikeT0: -1, triggerT0: -1 };
	/** the badge: on, its pop-in start, its count, its flares and its exit */
	const bd = { on: false, t0: 0, count: 0, flareT0: -1, countT0: -1, outT0: -1 };
	const flagsReset = () => {
		fl.on = false;
		fl.spent = false;
		fl.fillAt.fill(-1);
		fl.prevN = 0;
		fl.missT0 = fl.outT0 = fl.shrinkT0 = fl.restrikeT0 = fl.triggerT0 = -1;
		bd.on = false;
		bd.flareT0 = bd.countT0 = bd.outT0 = -1;
		bd.count = 0;
	};
	/** the trigger pulse (or a feature's trigger beat with no pulse of its own): every filled flag flashes now, and after
	 *  `delay` style ms the row shrinks into the badge as the badge pops in */
	const toBadge = (now: number, delay: number) => {
		const at = now + real(delay);
		if (fl.on && fl.triggerT0 < 0) fl.triggerT0 = now;
		if (!bd.on) {
			bd.on = true;
			bd.t0 = at;
			bd.count = Math.min(8, context.stateGame.scatterCells.length);
		}
		if (fl.on && fl.shrinkT0 < 0) {
			fl.shrinkT0 = at;
			fl.shrinkMs = Math.max(context.stateGame.skipping ? 1 : PLAQUE_BADGE.shrinkMinRealMs, real(PLAQUE_BADGE.shrinkMs));
		}
	};
	rowsMaxX = () => (bd.on && bd.outT0 < 0 ? CL.badgeRowMaxX : CL.rowMaxX);
	/** who has the plaque now (STORYBOARD.md section 3; DEV read: __manticore.plaque().owner) */
	let owner: 'prompt' | 'mode' | 'tease' | 'count' | 'offer' | 'lines' | 'none' = 'none';
	/** DEV: every beat of the row and the badge (what, when, the War Standards on the board then) */
	const flagLog: { at: number; what: string; n: number; slot?: number }[] = [];
	const fnote = (what: string, slot?: number) => {
		if (!import.meta.env.DEV) return;
		flagLog.push({ at: performance.now(), what, n: context.stateGame.scatterCells.length, slot });
		if (flagLog.length > 200) flagLog.splice(0, 100);
	};
	/** DEV: the row's and the badge's last frame (tools/manticore/plaque_owner_probe.js) */
	const flagState = { rowAlpha: 0, filled: 0, nextSlot: -1, nextGlow: 0, badgeAlpha: 0, labels: '' };
	const flagsTick = (now: number, hidden: boolean) => {
		const sg = context.stateGame;
		const n = Math.min(8, sg.scatterCells.length);
		const base = sg.gameType === 'basegame';
		const F = PLAQUE_FLAGS;
		// THE ROW COMES IN at the third War Standard on the board (before the spin's rows: the tease always comes first)
		if (!fl.on && !fl.spent && !bd.on && base && sg.busy && n >= 3 && !rows.length && !sg.skipping) {
			// once per spin (spent until the next reveal's spinWinHide)
			fl.on = true;
			fl.spent = true;
			fl.t0 = now;
			fl.sa = stateBet.activeBetModeKey === 'SUPER_ANTE';
			fl.prevN = 3;
			fl.missT0 = fl.outT0 = fl.shrinkT0 = fl.restrikeT0 = fl.triggerT0 = -1;
			fl.fillAt.fill(-1);
			for (let i = 0; i < 3; i += 1) fl.fillAt[i] = now + real(F.popInStaggerMs) * i;
			fnote(fl.sa ? 'row superAnte' : 'row');
		}
		if (fl.on) {
			for (let i = 3; i < 6; i += 1)
				if (n > i && fl.fillAt[i] < 0) {
					fl.fillAt[i] = now;
					fnote('fill', i);
				}
			if (n > fl.prevN && n >= 7) fl.restrikeT0 = now;
			fl.prevN = Math.max(fl.prevN, n);
		}
		if (bd.on && n > bd.count) {
			bd.count = n;
			bd.countT0 = now;
			fnote('badge count');
		}
		// the row's alpha: the miss (dim, then fade), the handover, the shrink into the badge
		let rowA = 1;
		let dimK = 1;
		let shrink = 0;
		if (fl.on) {
			if (fl.missT0 >= 0) {
				const el = now - fl.missT0;
				const dimMs = Math.max(1, real(F.missDimMs));
				dimK = 1 - (1 - F.missDimTo) * clamp01(el / dimMs);
				rowA *= 1 - clamp01((el - dimMs) / Math.max(1, real(F.missFadeMs)));
			}
			if (fl.outT0 >= 0) rowA *= 1 - clamp01((now - fl.outT0) / Math.max(1, real(F.handoverOutMs)));
			if (fl.shrinkT0 >= 0 && now >= fl.shrinkT0) {
				shrink = clamp01((now - fl.shrinkT0) / fl.shrinkMs);
				rowA *= 1 - shrink;
			}
			if (rowA <= 0.001) {
				fl.on = false;
				fnote('row gone');
			}
		}
		const showRow = fl.on && !hidden;
		flagsLayer.visible = showRow;
		flagState.rowAlpha = showRow ? +rowA.toFixed(3) : 0;
		flagState.filled = fl.on ? fl.fillAt.filter((t) => t >= 0 && t <= now).length : 0;
		if (showRow) {
			// face units to layout units (the field map's k), at this layout's own size (PLAQUE_FLAGS.scale)
			const k = field.k / (PLAQUE_FLAGS.scale[clKey] ?? 1);
			const sc = 1 - 0.7 * cubicOut(shrink);
			const cy = PLAQUE_FIELD.layoutCentreY;
			const tl = flagTex('landed');
			const te = flagTex('lvl_FS_empty');
			const fw = tl ? (F.filledH * tl.frame.width) / tl.frame.height : F.filledH;
			const lw = te ? (F.levelH * te.frame.width) / te.frame.height : F.levelH * F.levelStretch;
			const totalW = 3 * fw + 2 * F.gap + 3 * (F.gap + F.sep + F.gap + lw);
			const L = (fx: number) => ((fx - totalW / 2) * sc) / k;
			const U = (fu: number) => (fu * sc) / k;
			const labels = fl.sa ? ['SA_SUPER', 'BLANK', 'EPIC'] : ['FS', 'SUPER', 'EPIC'];
			flagState.labels = labels.join(',');
			// the slot at stake: the next one to fill, lit while its column holds (the tease, read only)
			const next = n < 6 ? n : -1;
			const t = teaseNow();
			const holding = t.active && t.phase === 'hold';
			const hp = holding ? t.holdProgress : 0;
			const hz = F.nextHz[0] + (F.nextHz[1] - F.nextHz[0]) * hp;
			const nextGlow = holding && next >= 3 && fl.missT0 < 0 ? (F.nextBase + (1 - F.nextBase) * hp) * (0.75 + 0.25 * Math.sin((now / 1000) * Math.PI * 2 * hz)) : 0;
			flagState.nextSlot = next;
			flagState.nextGlow = +nextGlow.toFixed(3);
			let x = 0;
			for (let i = 0; i < 6; i += 1) {
				if (i >= 3) {
					x += F.gap;
					const sq = sepQ[i - 3];
					placeQuad(sq.bar, 'sep', L(x + F.sep / 2), cy, U(F.sepBarW), U(F.levelH * F.sepBarH), rowA * 0.9);
					placeQuad(sq.loz, 'lozenge', L(x + F.sep / 2), cy, U(F.lozenge), U(F.lozenge), rowA);
					x += F.sep + F.gap;
				} else if (i > 0) x += F.gap;
				const w = i < 3 ? fw : lw;
				const h = i < 3 ? F.filledH : F.levelH;
				const cx = L(x + w / 2);
				x += w;
				const at = fl.fillAt[i];
				const filled = at >= 0 && now >= at;
				// the pop: the landed flags pop in; a level flag pops on filling (EPIC again on a 7th / 8th)
				let pop = 1;
				let flash = 0;
				if (filled) {
					const el = now - at;
					if (i < 3) {
						const u = clamp01(el / Math.max(1, real(F.popInMs)));
						pop = 0.6 + 0.4 * cubicOut(u);
					} else {
						const u = el / Math.max(1, real(F.fillPopMs));
						if (u < 1) pop = 1 + (F.fillPop - 1) * Math.sin(Math.PI * u);
						flash = 1 - clamp01(el / Math.max(1, real(F.flashMs)));
					}
				}
				// the trigger pulse: every filled flag flashes together
				if (filled && fl.triggerT0 >= 0) flash = Math.max(flash, 1 - clamp01((now - fl.triggerT0) / Math.max(1, real(F.flashMs))));
				if (i === 5 && fl.restrikeT0 >= 0) {
					const el = now - fl.restrikeT0;
					const u = el / Math.max(1, real(F.fillPopMs));
					if (u < 1) pop = Math.max(pop, 1 + (F.restrikePop - 1) * Math.sin(Math.PI * u));
					flash = Math.max(flash, 1 - clamp01(el / Math.max(1, real(F.flashMs))));
				}
				const pw = U(w * pop);
				const ph = U(h * pop);
				if (i < 3) {
					const q = landedQ[i];
					const a = filled ? rowA * clamp01((now - at) / Math.max(1, real(F.popInMs))) : 0;
					placeQuad(q.glow, 'landedGlow', cx, cy, pw * 2, ph * 2, rowA * flash * 0.8, F.glowTint);
					placeQuad(q.flag, 'landed', cx, cy, pw, ph, a);
					placeQuad(q.flash, 'landed', cx, cy, pw, ph, a * flash * 0.5);
				} else {
					const q = levelQ[i - 3];
					const lab = labels[i - 3];
					const isNext = i === next;
					const g = Math.max(flash, isNext ? nextGlow * 0.5 : 0);
					const tint = fl.sa && lab === 'SA_SUPER' ? F.superAnteAccent : F.glowTint;
					placeQuad(q.glow, 'lvlGlow', cx, cy, pw * 2, ph * 2, rowA * g, tint);
					const ea = filled ? 0 : rowA * (0.3 + 0.7 * dimK) * (1 + (isNext ? 0.3 * nextGlow : 0));
					placeQuad(q.empty, `lvl_${lab}_empty`, cx, cy, U(w), U(h), ea);
					placeQuad(q.full, `lvl_${lab}_full`, cx, cy, pw, ph, filled ? rowA : 0);
					placeQuad(q.flash, `lvl_${lab}_full`, cx, cy, pw, ph, filled ? rowA * flash * 0.5 : 0);
				}
			}
		}
		// THE BADGE (centred): pops in as the row shrinks, counts on, flares with the trigger beat, goes before the intro
		let ba = 0;
		if (bd.on) {
			const shrinkMs = fl.shrinkT0 >= 0 ? fl.shrinkMs : Math.max(PLAQUE_BADGE.shrinkMinRealMs, real(PLAQUE_BADGE.shrinkMs));
			const u = now < bd.t0 ? 0 : clamp01((now - bd.t0) / shrinkMs);
			ba = u;
			if (bd.outT0 >= 0) {
				ba *= 1 - clamp01((now - bd.outT0) / Math.max(1, real(PLAQUE_BADGE.outMs)));
				if (ba <= 0.001) {
					bd.on = false;
					fnote('badge gone');
				}
			}
			const sc = (PLAQUE_BADGE.inScale + (1 - PLAQUE_BADGE.inScale) * cubicOut(u)) * (PLAQUE_BADGE.scale[clKey] ?? 1);
			const fh = PLAQUE_BADGE.flagH * sc;
			const tl = flagTex('landed');
			const fw = tl ? (fh * tl.frame.width) / tl.frame.height : fh;
			const text = String(bd.count);
			const cells = cellsOf(text) ?? [];
			const dk = PLAQUE_BADGE.countSize * sc;
			const gap = PLAQUE_DIGIT_H * BOARD_PLAQUE.gap;
			const cw = cells.reduce((sum, c) => sum + (c.cellW + gap) * dk, 0) - gap * dk;
			const totalW = fw + PLAQUE_BADGE.gap * sc + cw;
			const x0 = -totalW / 2;
			const cy = PLAQUE_FIELD.layoutCentreY;
			const flare = Math.max(bd.flareT0 >= 0 ? 1 - clamp01((now - bd.flareT0) / Math.max(1, real(PLAQUE_BADGE.flareMs))) : 0, bd.countT0 >= 0 ? 1 - clamp01((now - bd.countT0) / Math.max(1, real(PLAQUE_BADGE.countFlareMs))) : 0);
			const show = !hidden && ba > 0.001;
			badgeLayer.visible = show;
			if (show) {
				placeQuad(badgeQ.glow, 'landedGlow', x0 + fw / 2, cy, fw * 2.2, fh * 2.2, ba * Math.min(1, PLAQUE_BADGE.glow + flare * 0.65), PLAQUE_FLAGS.glowTint);
				placeQuad(badgeQ.flag, 'landed', x0 + fw / 2, cy, fw, fh, ba);
				// the count, in the plaque's numerals
				const src = atlasTexture?.source;
				const sw = src?.width || 1;
				const sh = src?.height || 1;
				let x = x0 + fw + PLAQUE_BADGE.gap * sc;
				let q = 0;
				for (const c of cells) {
					const g = c.key && atlas ? atlas[`${PLAQUE_GLYPH_PREFIX}${c.key}.png`] : undefined;
					if (g && q < BGQ) {
						const w = c.w * dk;
						const h = c.h * dk;
						const gx = x + (c.cellW * dk - w) / 2;
						const gy = cy + (PLAQUE_DIGIT_H / 2 - c.h + c.d) * dk;
						const corners = [gx, gy, gx + w, gy, gx + w, gy + h, gx, gy + h];
						for (let j = 0; j < 4; j += 1) {
							const p = through(corners[j * 2], corners[j * 2 + 1]);
							bPos[q * 8 + j * 2] = p.x;
							bPos[q * 8 + j * 2 + 1] = p.y;
						}
						const f = g.frame;
						bUv.set([f.x / sw, f.y / sh, (f.x + f.width) / sw, f.y / sh, (f.x + f.width) / sw, (f.y + f.height) / sh, f.x / sw, (f.y + f.height) / sh], q * 8);
						q += 1;
					}
					x += (c.cellW + gap) * dk;
				}
				for (let i = q; i < BGQ; i += 1) {
					bPos.fill(0, i * 8, i * 8 + 8);
					bUv.fill(0, i * 8, i * 8 + 8);
				}
				if (atlasTexture && badgeDigits.texture !== atlasTexture) badgeDigits.texture = atlasTexture;
				badgeDigits.geometry.getBuffer('aPosition').update();
				badgeDigits.geometry.getBuffer('aUV').update();
				badgeDigits.alpha = ba;
				badgeDigits.tint = PLAQUE_BADGE.countTint;
			}
		} else badgeLayer.visible = false;
		flagState.badgeAlpha = +ba.toFixed(3);
	};

	// ---- THE STREAK TO THE HUD and the pulse behind the HUD's WIN (PLAQUE_STREAK): pooled additive sprites on one baked
	// dot texture, made on the first move (never per frame) -------------------------------------------------------------
	const streakLayer = new PIXI.Container({ label: 'plaque-streak' });
	streakLayer.eventMode = 'none';
	streakLayer.interactiveChildren = false;
	root.addChild(streakLayer);
	type Dot = { core: PIXI.Sprite; halo: PIXI.Sprite };
	const dots: Dot[] = [];
	let pulse: PIXI.Sprite | null = null;
	const dotSprite = (tint: number) => {
		const sp = new PIXI.Sprite(plaqueGlowTexture());
		sp.anchor.set(0.5);
		sp.blendMode = 'add';
		sp.tint = tint;
		sp.visible = false;
		streakLayer.addChild(sp);
		return sp;
	};
	const ensureDots = () => {
		if (dots.length) return;
		for (let i = 0; i <= PLAQUE_STREAK.trail; i += 1) dots.push({ halo: dotSprite(PLAQUE_STREAK.haloColor), core: dotSprite(PLAQUE_STREAK.headColor) });
		pulse = dotSprite(PLAQUE_STREAK.pulseColor);
	};
	/** a soft dot of radius r (root units) at (x, y), strength a (the texture spans 2 radii each side) */
	const putDot = (sp: PIXI.Sprite, x: number, y: number, r: number, a: number) => {
		if (a <= 0.003 || r <= 0.01) {
			if (sp.visible) sp.visible = false;
			return;
		}
		sp.position.set(x, y);
		sp.width = sp.height = 4 * r;
		sp.alpha = Math.min(1, a);
		sp.visible = true;
	};
	const B = { x: 0, y: 0 };
	const bezier = (u: number) => {
		const { from: P0, to: P1 } = move;
		const dx = P1.x - P0.x;
		const dy = P1.y - P0.y;
		const L = Math.hypot(dx, dy) || 1;
		const cx = (P0.x + P1.x) / 2 + (dy / L) * PLAQUE_STREAK.arc * L;
		const cy = (P0.y + P1.y) / 2 - (dx / L) * PLAQUE_STREAK.arc * L - PLAQUE_STREAK.rise * L;
		const v = 1 - u;
		B.x = v * v * P0.x + 2 * v * u * cx + u * u * P1.x;
		B.y = v * v * P0.y + 2 * v * u * cy + u * u * P1.y;
		return B;
	};
	const streakTick = (now: number) => {
		if (move.phase === 'none' && move.pulseT0 < 0) {
			if (streakLayer.visible) streakLayer.visible = false;
			return;
		}
		ensureDots();
		streakLayer.visible = true;
		const head = move.r * PLAQUE_STREAK.headR;
		const halo = move.r * PLAQUE_STREAK.haloR;
		const el = now - move.t0;
		for (let j = 0; j < dots.length; j += 1) {
			const d = dots[j];
			if (move.phase === 'lift' && move.has) {
				const u = clamp01(el / move.lift);
				if (j === 0) {
					putDot(d.halo, move.from.x, move.from.y, halo * (0.4 + 0.6 * u), 0.9 * u);
					putDot(d.core, move.from.x, move.from.y, head * u, u);
					continue;
				}
			} else if (move.phase === 'fly') {
				const uj = (el - move.lift - (j * PLAQUE_STREAK.trailStepMs * move.fly) / PLAQUE_STREAK.flightMs) / move.fly;
				if (uj >= 0 && uj <= 1) {
					const p = bezier(sineInOut(uj));
					const f = Math.pow(PLAQUE_STREAK.trailFade, j);
					putDot(d.halo, p.x, p.y, halo * (0.55 + 0.45 * f), 0.55 * f);
					putDot(d.core, p.x, p.y, head * (0.5 + 0.5 * f), 0.9 * f);
					continue;
				}
			}
			if (d.halo.visible) d.halo.visible = false;
			if (d.core.visible) d.core.visible = false;
		}
		if (pulse) {
			if (move.pulseT0 >= 0) {
				const u = (now - move.pulseT0) / move.pulseMs;
				if (u >= 1) {
					move.pulseT0 = -1;
					pulse.visible = false;
				} else {
					const e = cubicOut(u);
					pulse.position.set(move.to.x, move.to.y);
					pulse.width = 4 * move.hud.w * (0.55 + 0.3 * e);
					pulse.height = 4 * move.hud.h * (0.7 + 0.35 * e);
					pulse.alpha = PLAQUE_STREAK.pulseAlpha * Math.pow(1 - u, 1.5);
					pulse.visible = true;
				}
			} else pulse.visible = false;
		}
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
		// THE COUNT (PLAQUE_CLEARS): a row that has landed starts the total's count to its amount (from the value on show:
		// a row landing while the total still counts restarts the count from there)
		for (const r of rows) {
			if (r.landed || now < r.land) continue;
			r.landed = true;
			total.shown = true;
			total.from = total.value;
			total.to = r.amount;
			total.t0 = now;
			total.ms = Math.max(1, r.countMs);
			total.on = true;
			total.reserve = bookEventAmountToCurrencyString(Math.round(Math.max(r.amount, total.step)));
			if (import.meta.env.DEV) {
				const e = clearLog.find((x) => x.start === r.start && x.amount === r.amount);
				if (e) e.countAt = now;
				countLog = e ?? null;
			}
		}
		if (total.on) {
			const u = Math.min(1, (now - total.t0) / total.ms);
			total.value = total.from + (total.to - total.from) * quadOut(u);
			if (u >= 1) {
				total.on = false;
				total.value = total.to;
				bump.t0 = now;
				bump.ms = Math.max(1, real(SPIN_TOTAL.bumpMs));
				if (import.meta.env.DEV && countLog) countLog.countEnd = now;
			}
		} else if (total.step >= 0 && total.shown && rows.every((r) => r.landed) && total.value !== total.step && move.phase === 'none') {
			// the step's own total once every row has counted (the book's cascade.spinWin; normally already there)
			total.value = total.step;
		}
		// the text: the forced one (DEV), or the total
		const value = total.value;
		const reserve = total.on ? total.reserve : null;
		const text = forced ?? bookEventAmountToCurrencyString(Math.round(value));
		if (atlasTexture && (shown.relayout || ((text !== shown.text || reserve !== shown.reserve) && (showing || forced !== null)))) build(text, reserve);
		// the desktop's prompt first (the lines and the figures stand aside for it), then the explainer lines
		promptTick();
		tipTick(now);
		offerTick(now);
		// the plaque is clear while the prompt is up: a line on its way out is not drawn either
		if (promptUpNow && tips.visible) tips.visible = false;
		if (tips.visible && mesh.tint !== tipMesh.tint) tipMesh.tint = mesh.tint;
		// the fades, the bump and the lift
		const fa = forced !== null ? 1 : stepFade(figFade, now);
		const ca = forced !== null ? 0 : stepFade(crestFade, now);
		const ra = stepFade(rowsFade, now);
		const hidden = forced === null && (!!context.stateGame.plaque || promptUpNow);
		// the move to the HUD: the total lifts (grows, fades), then the streak flies
		let lift = 0;
		if (move.phase !== 'none') {
			const el = now - move.t0;
			lift = Math.min(1, el / move.lift);
			move.phase = el < move.lift || move.fly <= 0 ? 'lift' : 'fly';
		}
		const totalAlpha = hidden ? 0 : fa * (forced !== null || total.shown ? 1 : 0) * (move.phase !== 'none' ? 1 - lift * lift : 1);
		if (figures.alpha !== totalAlpha) figures.alpha = totalAlpha;
		figures.visible = totalAlpha > 0.001;
		if (crest.alpha !== ca) crest.alpha = ca;
		// "Remove the icon in the middle of that board" (r3, 10:17): PLAQUE_TIPS.crest false, never drawn
		crest.visible = TIPS.crest && ca > 0.001 && !promptUpNow;
		let s = 1;
		if (bump.t0 >= 0) {
			const u = (now - bump.t0) / bump.ms;
			if (u >= 1) bump.t0 = -1;
			else s = Math.max(s, 1 + (SPIN_TOTAL.bumpScale - 1) * Math.sin(Math.PI * Math.max(0, u)));
		}
		if (move.phase !== 'none') s = Math.max(s, 1 + (PLAQUE_STREAK.liftScale - 1) * cubicOut(lift));
		if (figures.scale.x !== s) figures.scale.set(s);
		rowsTick(now, hidden || forced !== null ? 0 : fa * ra);
		flagsTick(now, hidden || forced !== null);
		// THE ONE OWNER (STORYBOARD.md section 3), for the DEV read: the prompt, the mode plaque, the tease's flag row, the
		// count-up (the rows and the total, with the badge beside them), the explainer lines. Each layer's own rule above
		// keeps them apart; this names who has the plaque now
		owner = promptUpNow ? 'prompt' : context.stateGame.plaque ? 'mode' : flagsLayer.visible ? 'tease' : figures.visible || slots[0].box.visible || slots[1].box.visible || slots[2].box.visible || badgeLayer.visible ? 'count' : offerLayer.visible ? 'offer' : tips.visible ? 'lines' : 'none';
		streakTick(now);
		if (!showing && fa <= 0.001 && rows.length && move.phase === 'none') {
			// faded out: the rows go
			rows.length = 0;
			total.shown = false;
		}
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
		// THE PLAQUE AS A TAP TARGET for the recap (game/plaqueTap.ts): the dark field's corners on the page, CSS px
		plaqueTap.quad = () => {
			const app = context.stateApp.pixiApplication;
			const canvas = app?.canvas as HTMLCanvasElement | undefined;
			if (!root.parent || !app || !canvas) return null;
			const r = canvas.getBoundingClientRect();
			const sx = r.width / (app.screen.width || r.width);
			const sy = r.height / (app.screen.height || r.height);
			return field.quad.map(([u, v]) => {
				const m = map(u, v);
				const gp = root.toGlobal({ x: m.x, y: m.y });
				return { x: r.left + gp.x * sx, y: r.top + gp.y * sy };
			});
		};
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
						const [x0, y0, x1, y1] = BOARD_PLAQUE_SPEC.figureBlock.rectInLayoutUnits;
						return [
							[x0, y0],
							[x1, y0],
							[x1, y1],
							[x0, y1],
						].map(([u, v]) => {
							const m = through(u, v);
							return g(root, m.x, m.y);
						});
					})(),
					/** THE ONE PERSPECTIVE (game/plaqueField.ts): the dark field's corners on screen (TL TR BR BL), k, the face's
					 *  width, which H the layers use */
					field: { lean: BOARD_PLAQUE.lean, k: +field.k.toFixed(4), faceW: +field.faceW.toFixed(2), quad: field.quad.map(([u, v]) => { const m = map(u, v); return g(root, m.x, m.y); }) },
					light: { ...frameLight, nightIn },
					/** who has the plaque now (STORYBOARD.md section 3) */
					owner,
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
				/** THE ROWS AND THE COUNT (PLAQUE_CLEARS; tools/manticore/plaque_clear_probe.js): every row (its book numbers,
				 *  start, landing, count time), the total now, the slots as drawn (text, alpha, the glyph quads and the
				 *  icon's corners on screen), the layout's constants */
				plaqueClears: () => ({
					log: clearLog.map((e) => ({ ...e })),
					total: { value: total.value, to: total.to, on: total.on, shown: total.shown, step: total.step, text: shown.text, alpha: +figures.alpha.toFixed(3), scale: +figures.scale.x.toFixed(4) },
					slots: slots.map((sl) => ({
						visible: sl.box.visible,
						alpha: +sl.box.alpha.toFixed(3),
						quads: Array.from({ length: sl.quads }, (_, i) => [0, 1, 2, 3].map((k) => g(rowsLayer, sl.pos[i * 8 + k * 2], sl.pos[i * 8 + k * 2 + 1]))),
						icon: sl.icon.visible ? [0, 1, 2, 3].map((k) => g(rowsLayer, sl.ipos[k * 2], sl.ipos[k * 2 + 1])) : null,
					})),
					rows: rows.map((r) => ({ ...r })),
					layout: { ...CL },
					constants: { rowInMs: PLAQUE_CLEARS.rowInMs, rowStaggerMs: PLAQUE_CLEARS.rowStaggerMs, countMs: PLAQUE_CLEARS.countMs },
				}),
				/** THE WAR STANDARD FLAG ROW AND THE BADGE (PLAQUE_FLAGS, PLAQUE_BADGE): on, Super Ante's labels, the War
				 *  Standards on the board, the filled slots, the slot at stake and its glow, the badge and its count, alphas */
				plaqueFlags: () => ({
					on: fl.on,
					sa: fl.sa,
					n: context.stateGame.scatterCells.length,
					...flagState,
					miss: fl.missT0 >= 0,
					handedOver: fl.outT0 >= 0,
					shrinking: fl.shrinkT0 >= 0,
					badge: { on: bd.on, count: bd.count, out: bd.outT0 >= 0, flare: bd.flareT0 >= 0 },
					drawn: { row: flagsLayer.visible, badge: badgeLayer.visible },
					log: flagLog.map((e) => ({ ...e })),
				}),
				/** THE MOVE TO THE HUD (PLAQUE_STREAK): every move (queue wait, lift, flight, arrival times; from and to in
				 *  the plaque's units), the phase now, the streak's sprites drawn now */
				plaqueStreak: () => ({
					log: moveLog.map((e) => ({ ...e })),
					phase: move.phase,
					pulse: move.pulseT0 >= 0,
					drawn: dots.filter((d) => d.core.visible).length,
					constants: { ...PLAQUE_STREAK },
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
						lineTexture: { alive: lineTex.on, kept: !!lineTex.texture, uid: lineTex.texture?.source.uid ?? null, label: lineTex.texture?.source.label ?? null, w: lineTex.texture?.source.pixelWidth ?? 0, h: lineTex.texture?.source.pixelHeight ?? 0, addressMode: lineTex.texture?.source.style.addressMode ?? null, made: lineTex.made, freed: lineTex.freed, meshHasIt: !!lineTex.texture && tipMesh.texture === lineTex.texture },
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
			plaqueTap.quad = () => null;
			freeOffer();
			unplacePrompt();
			plaquePromptReady.ready = false;
			root.removeFromParent();
			destroyLineTexture();
			root.destroy({ children: true });
		};
	});
</script>
