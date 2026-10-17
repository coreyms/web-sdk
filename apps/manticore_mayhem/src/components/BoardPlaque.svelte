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
	// figures on a bronze plaque that leans 35 degrees under the board, with the lion crest on the empty plaque. It replaces
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
	// THE EXPLAINER LINES (Corey 2026-10-16 17:41; r2 particle text 2026-10-17 08:52 / 08:59 / 09:12, game/plaqueTips.ts,
	// game/plaqueMotes.ts): while the board is idle in the base game (game/boardIdle.ts, the symbol pay popup's own rule)
	// and the plaque has no figures, gold motes drift in its text box; every PLAQUE_TIPS.gapMs one line forms out of
	// them (the crest fades out, the motes stream into the line's glyph points, the crisp text fades in as they land),
	// holds, and bursts back into them (the crest comes back). A line too small to read on this screen side scrolls
	// instead: its beginning forms, it scrolls right to left (letters crumble into motes at the left end, the swarm
	// feeds the next ones at the right) and its end bursts. Line 1 first, then the others in turn, line 1 back every
	// third line. Motes and text hide as soon as the board stops being idle, and never show while the figures do (the
	// figures, the win readout, always win).
	//
	// Each line is drawn ONCE into a canvas (the Cinzel face the intro cards use) when it comes up, uploaded, and its
	// glyph points read back from that same canvas (getImageData, once); it shows on a small grid mesh whose corners go
	// through the figures' homography, so it leans with the plaque (a scroll moves the mesh's window over the texture:
	// a vertex update, never a texture upload). The motes are one ParticleContainer on one small texture made once,
	// put through the same homography each frame they show. No text object, filter, mask or shader; the plaque takes no
	// press (eventMode none).
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
	import { PLAQUE_TIPS as TIPS, planTips, fitTips, pointerIsMouse, scrollAt, scrollSpan, tipAt, tipLines, type TipPlan } from '../game/plaqueTips';
	import { PlaqueMotes, PLAQUE_MOTES as MOTES } from '../game/plaqueMotes';
	import { moteTexture } from '../game/fxTexture';
	import { PHONE_TIER } from '../game/deviceTier';

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
	// the explainer lines: one canvas texture on a (gridX x gridY) mesh of quads through the homography; the mesh spans
	// the part of the line inside the text box (all of it when it is formed in place, a moving window when it scrolls)
	const tips = new PIXI.Container({ label: 'plaque-tips' });
	const TX = TIPS.gridX;
	const TY = TIPS.gridY;
	const tipPos = new Float32Array((TX + 1) * (TY + 1) * 2);
	const tipUv = new Float32Array((TX + 1) * (TY + 1) * 2);
	const tipIdx = new Uint32Array(TX * TY * 6);
	for (let j = 0; j <= TY; j += 1) for (let i = 0; i <= TX; i += 1) tipUv.set([i / TX, j / TY], (j * (TX + 1) + i) * 2);
	for (let j = 0; j < TY; j += 1)
		for (let i = 0; i < TX; i += 1) {
			const a = j * (TX + 1) + i;
			const b = a + TX + 1;
			tipIdx.set([a, a + 1, b + 1, a, b + 1, b], (j * TX + i) * 6);
		}
	const tipCanvas = document.createElement('canvas');
	tipCanvas.width = tipCanvas.height = 1;
	// read back once per line for its glyph points: a canvas the CPU keeps (no GPU read back, no browser warning)
	const tipCtx = tipCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
	const tipSource = new PIXI.CanvasSource({ resource: tipCanvas as unknown as PIXI.ICanvas, resolution: 1 });
	const tipTexture = new PIXI.Texture({ source: tipSource, label: 'plaque-tips' });
	const tipMesh = new PIXI.MeshSimple({ texture: tipTexture, vertices: tipPos, uvs: tipUv, indices: tipIdx });
	tipMesh.autoUpdate = false;
	tips.addChild(tipMesh);
	// a tap on the plaque is a tap on whatever was there before: the lines take no press
	tips.eventMode = 'none';
	tips.interactiveChildren = false;
	// the motes (game/plaqueMotes.ts): one ParticleContainer of sprites on one small texture made once
	// (game/fxTexture.ts moteTexture), added light. Their positions and colours go up each frame they show; their
	// sizes (static) only when the layout changes. The phone tier draws fewer (PLAQUE_MOTES.countPhone)
	const MOTE_N = PHONE_TIER ? MOTES.countPhone : MOTES.count;
	const moteSim = new PlaqueMotes(MOTE_N);
	const moteTex = moteTexture(MOTES.texPx);
	const moteLayer = new PIXI.ParticleContainer({
		label: 'plaque-motes',
		texture: moteTex,
		dynamicProperties: { position: true, color: true, vertex: false, rotation: false, uvs: false },
	});
	moteLayer.blendMode = 'add';
	moteLayer.eventMode = 'none';
	moteLayer.interactiveChildren = false;
	/** a Particle takes a number tint as BGR */
	const bgr = (c: number) => ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff);
	const moteParts: PIXI.Particle[] = [];
	for (let i = 0; i < MOTE_N; i += 1) {
		const p = new PIXI.Particle({ texture: moteTex, anchorX: 0.5, anchorY: 0.5, alpha: 0, tint: bgr(moteSim.tint[i]) });
		moteParts.push(p);
		moteLayer.addParticle(p);
	}
	root.addChild(shadow, day, night, fire, crest, tips, moteLayer, figures);
	for (const s of [shadow, day, night, fire, crestDay, crestNight, crestFire]) s.visible = false;
	figures.alpha = 0;
	tips.alpha = 0;
	tips.visible = false;
	moteLayer.alpha = 0;
	moteLayer.visible = false;

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
		// the registration is a scale and a shift (layoutSpec registrationOf): kept as numbers for the per-frame motes
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
		// the explainer lines and the motes: this layout's box; a line on show is let go (game/plaqueTips.ts), the motes
		// kept inside the new box and sized for it
		tipBox = TIPS.box[specKey] ?? TIPS.box.landscape;
		moteSim.setBox(tipBox[0], tipBox[1], tipBox[2]);
		meshAt.x0 = NaN;
		tipNeed.layout = true;
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
	// ---- the explainer lines: the mesh, the plan, the drawing, the glyph points ----------------------------------------
	let tipBox: readonly [number, number, number] = TIPS.box.landscape;
	const tipNeed = { layout: true };
	/** what the mesh spans now: layout x0 to x1 across the box's height, the texture's u0 to u1 across it */
	const meshAt = { x0: NaN, x1: NaN, u0: NaN, u1: NaN };
	const buildTipMesh = (x0: number, x1: number, u0: number, u1: number) => {
		if (x0 === meshAt.x0 && x1 === meshAt.x1 && u0 === meshAt.u0 && u1 === meshAt.u1) return;
		meshAt.x0 = x0;
		meshAt.x1 = x1;
		meshAt.u0 = u0;
		meshAt.u1 = u1;
		const [, top, bot] = tipBox;
		for (let j = 0; j <= TY; j += 1)
			for (let i = 0; i <= TX; i += 1) {
				const f = i / TX;
				const p = through(x0 + (x1 - x0) * f, top + ((bot - top) * j) / TY);
				const o = (j * (TX + 1) + i) * 2;
				tipPos[o] = p.x;
				tipPos[o + 1] = p.y;
				tipUv[o] = u0 + (u1 - u0) * f;
				tipUv[o + 1] = j / TY;
			}
		tipMesh.geometry.getBuffer('aPosition').update();
		tipMesh.geometry.getBuffer('aUV').update();
	};
	const fontAt = (px: number) => TIPS.font.replace('{px}', String(px));
	/** the face: loading, ready (Cinzel in, or given up on it and drawing in the fallback) */
	const face = { asked: false, ready: false };
	/** the plan of every line on this screen (game/plaqueTips.ts planTips), the words it was made for, the cap height
	 *  (x the font size) the rows are centred on, and the CSS px per layout unit it was made at */
	let tipPlans: TipPlan[] = [];
	let tipTexts: string[] = [];
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
		tipPlans = planTips(tipTexts, widthAt1, tipBox, planK, capK);
	};
	/** the line on show: its index, how it shows, its size, its rows, the texture's size, the strip it is drawn on
	 *  (layout units: x 0 to stripW, the screen x is the strip's x plus the offset, offset0 at the start, offset1 at the
	 *  scroll's end) and its rows' ink boxes in the strip */
	const tipShown = {
		index: -1,
		mode: 'fit' as 'fit' | 'scroll',
		font: 0,
		rows: [] as string[],
		cw: 0,
		ch: 0,
		kCss: 0,
		stripW: 0,
		offset0: 0,
		offset1: 0,
		points: 0,
		ink: [] as { x0: number; x1: number; y0: number; y1: number }[],
	};
	/** the glyph points read off the canvas (strip units), sorted along x into sortX / sortY */
	const sampX = new Float32Array(MOTES.maxPoints);
	const sampY = new Float32Array(MOTES.maxPoints);
	const sortX = new Float32Array(MOTES.maxPoints);
	const sortY = new Float32Array(MOTES.maxPoints);
	const sortI = new Int32Array(MOTES.maxPoints);
	/** a small seeded random (the same line takes the same points) */
	const seeded = (seed: number) => {
		let s = seed >>> 0 || 1;
		return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
	};
	/** THE GLYPH POINTS: the brass pixels of the canvas just drawn (getImageData, once per line), on a grid of about
	 *  pointGridUnits, `want` of them picked evenly at random (a reservoir), sorted along x */
	const samplePoints = (cw: number, ch: number, want: number, seed: number) => {
		const [, top, bot] = tipBox;
		const Hh = bot - top;
		const data = tipCtx.getImageData(0, 0, cw, ch).data;
		const step = Math.max(1, Math.round((TIPS.pointGridUnits * cw) / tipShown.stripW));
		const k = Math.min(want, MOTES.maxPoints);
		const rnd = seeded(seed);
		let seen = 0;
		const ux = tipShown.stripW / cw;
		const uy = Hh / ch;
		for (let y = Math.floor(step / 2); y < ch; y += step)
			for (let x = Math.floor(step / 2); x < cw; x += step) {
				const o = (y * cw + x) * 4;
				if ((data[o] * data[o + 3]) / 255 < TIPS.pointInk) continue;
				const sx = (x + 0.5) * ux;
				const sy = top + (y + 0.5) * uy;
				if (seen < k) {
					sampX[seen] = sx;
					sampY[seen] = sy;
				} else {
					const j = Math.floor(rnd() * (seen + 1));
					if (j < k) {
						sampX[j] = sx;
						sampY[j] = sy;
					}
				}
				seen += 1;
			}
		const n = Math.min(seen, k);
		for (let i = 0; i < n; i += 1) sortI[i] = i;
		sortI.subarray(0, n).sort((a, b) => sampX[a] - sampX[b]);
		for (let i = 0; i < n; i += 1) {
			sortX[i] = sampX[sortI[i]];
			sortY[i] = sampY[sortI[i]];
		}
		return n;
	};
	/** the scroll's font for this screen (a DEV forced scroll of a line that would fit) */
	const scrollFontNow = () => planTips(['W'], () => 1e9, tipBox, planK, capK)[0].font;
	/** draw line `index` into the canvas at the screen's own density, upload it and read its glyph points (once per
	 *  line, never per frame). `mode` null: the line's plan; 'fit' / 'scroll': DEV, forced (`fontCss`: a forced scroll's
	 *  size on screen, so a desktop review can show a scroll) */
	const drawTip = (index: number, mode: 'fit' | 'scroll' | null, fontCss: number | null = null): boolean => {
		const plan = tipPlans[index];
		const text = tipTexts[index];
		if (!plan || text === undefined) return false;
		const [hw, top, bot] = tipBox;
		const Hh = bot - top;
		const m = mode ?? plan.mode;
		let font = plan.font;
		let rows = plan.rows.map((r) => r.join(' '));
		if (m !== plan.mode) {
			if (m === 'scroll') {
				font = fontCss !== null && planK > 0 ? fontCss / planK : scrollFontNow();
				rows = [text];
			} else {
				const f = fitTips(tipTexts, widthAt1, tipBox)[index];
				font = f.font;
				rows = f.rows.map((r) => r.join(' '));
			}
		}
		// the strip: the box itself for a line formed in place; the line's own width (and a margin for the engraving)
		// for a scroll, which starts at the box's left end and ends at its right
		const pad = 4;
		if (m === 'fit') {
			tipShown.stripW = 2 * hw;
			tipShown.offset0 = tipShown.offset1 = -hw;
		} else {
			const tw = widthAt1(text) * font;
			tipShown.stripW = tw + 2 * pad;
			tipShown.offset0 = -hw + TIPS.scrollPad - pad;
			tipShown.offset1 = Math.min(tipShown.offset0, hw - TIPS.scrollPad - pad - tw);
		}
		const W = tipShown.stripW;
		// screen px per layout unit across the box and down it, at the renderer's resolution
		const res = (context.stateApp.pixiApplication?.renderer?.resolution ?? 1) * TIPS.texScale;
		const { ku, kv } = cssPerUnit();
		const cw = Math.max(2, Math.min(TIPS.texMax, Math.ceil(W * ku * res)));
		const ch = Math.max(2, Math.min(TIPS.texMax, Math.ceil(Hh * kv * res)));
		if (cw !== tipShown.cw || ch !== tipShown.ch) {
			tipSource.resize(cw, ch, 1);
			tipShown.cw = cw;
			tipShown.ch = ch;
		}
		const g = tipCtx;
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.clearRect(0, 0, cw, ch);
		// strip units -> canvas px: x from the strip's left, y from the box's top
		g.setTransform(cw / W, 0, 0, ch / Hh, 0, (-top * ch) / Hh);
		g.font = fontAt(font);
		g.textAlign = m === 'fit' ? 'center' : 'left';
		g.textBaseline = 'alphabetic';
		const ax = m === 'fit' ? hw : pad;
		const n = rows.length;
		const mid = (top + bot) / 2;
		const lh = font * TIPS.lineHeight;
		const cap = capK * font;
		tipShown.ink.length = 0;
		for (let r = 0; r < n; r += 1) {
			const row = rows[r];
			const base = mid + (r - (n - 1) / 2) * lh + cap / 2;
			g.fillStyle = TIPS.lipColor;
			g.fillText(row, ax, base + TIPS.lipOffset);
			g.fillStyle = TIPS.lightColor;
			g.fillText(row, ax, base + TIPS.lightOffset);
			const brass = g.createLinearGradient(0, base - cap, 0, base);
			brass.addColorStop(0, TIPS.brassTop);
			brass.addColorStop(1, TIPS.brassBottom);
			g.fillStyle = brass;
			g.fillText(row, ax, base);
			const mt = g.measureText(row);
			tipShown.ink.push({ x0: ax - mt.actualBoundingBoxLeft, x1: ax + mt.actualBoundingBoxRight, y0: base - mt.actualBoundingBoxAscent + Math.min(0, TIPS.lipOffset), y1: base + mt.actualBoundingBoxDescent + Math.max(0, TIPS.lightOffset) });
		}
		tipSource.update();
		tipShown.index = index;
		tipShown.mode = m;
		tipShown.font = font;
		tipShown.rows = rows;
		tipShown.kCss = ku;
		// the glyph points: a fitted line gets formShare of the motes; a scrolling one that many on the part inside the box
		const form = MOTE_N * MOTES.formShare;
		const want = Math.round(m === 'fit' ? form : (form * W) / (2 * hw));
		tipShown.points = samplePoints(cw, ch, want, 1 + index * 7919);
		return true;
	};

	// ---- the motes: sizes, and each frame's positions --------------------------------------------------------------
	/** size the motes for this screen (static sprite data: uploaded once, here) */
	const placeMotes = () => {
		const ku = cssPerUnit().ku;
		if (!(ku > 0)) return;
		const a = through(0, 0);
		const ax = a.x;
		const ay = a.y;
		const b = through(1, 0);
		const mPerU = Math.hypot(b.x - ax, b.y - ay);
		const [s0, s1] = MOTES.sizeCss;
		for (let i = 0; i < MOTE_N; i += 1) {
			const css = s0 + (s1 - s0) * moteSim.size[i];
			const s = ((css / ku) * mPerU) / MOTES.texPx;
			moteParts[i].scaleX = moteParts[i].scaleY = s;
		}
		moteLayer.update();
	};
	/** every mote through the homography onto its sprite (position and brightness) */
	const drawMotes = () => {
		const h0 = H[0];
		const h1 = H[1];
		const h2 = H[2];
		const h3 = H[3];
		const h4 = H[4];
		const h5 = H[5];
		const h6 = H[6];
		const h7 = H[7];
		const xs = moteSim.x;
		const ys = moteSim.y;
		const al = moteSim.alpha;
		for (let i = 0; i < MOTE_N; i += 1) {
			const x = xs[i];
			const y = ys[i];
			const w = h6 * x + h7 * y + 1;
			const p = moteParts[i];
			p.x = regX + regM * ((h0 * x + h1 * y + h2) / w);
			p.y = regY + regM * ((h3 * x + h4 * y + h5) / w);
			p.alpha = al[i];
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
	const fadeTo = (f: Fade, to: number, ms: number, delay = 0) => {
		f.from = f.v;
		f.to = to;
		f.t0 = performance.now() + delay;
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

	// ---- the explainer lines' run: idle, the order, the cadence, the fades -------------------------------------------
	/** the shared idle rule (game/boardIdle.ts), copied for the tick by an effect (no reactive reads per frame) */
	let idleNow = false;
	$effect(() => {
		idleNow = boardIdle();
	});
	const tipFade = fade(0);
	const moteFade = fade(0);
	/** off: nothing; wait: the board settled, the motes come at t; drift: the motes drift, the next line comes at t;
	 *  form: a line is forming, up or scrolling (msg); burst: it is bursting until t. slot: lines shown in this idle
	 *  spell; other: the other lines shown so far (kept across spells); crestOut: the lines faded the crest out */
	type Phase = 'off' | 'wait' | 'drift' | 'form' | 'burst';
	const tipRun = { phase: 'off' as Phase, t: 0, base: 0, slot: 0, other: 0, index: -1, crestOut: false };
	/** the line on show: its times (performance.now ms) and, for a scroll, its path */
	const msg = { index: -1, mode: 'fit' as 'fit' | 'scroll', t0: 0, tLand: 0, tScroll0: 0, scrollMs: 0, ramp: 0, dist: 0, v: 0, tBurst: 0, nextIn: 0, hold: false, freezeMs: -1, landed: false, scrolling: false, scrollDone: false };
	/** DEV (feedback/plaque_tips_r2/plaque_tips_probe.js): a line asked for now (shown at once, `hold` keeps it up and,
	 *  for a scroll, `holdAt` stops it that far along its scroll), whatever the board does while one is held; the
	 *  cadence's two waits; the motes off (the cost A / B) */
	let tipPending: { index: number; mode: 'fit' | 'scroll' | null; hold: boolean; holdAt: number | null; fontCss: number | null } | null = null;
	let devHold = false;
	const pace = { gapMs: TIPS.gapMs, firstMs: TIPS.firstMs };
	let motesOn = true;
	const moteStat = { frames: 0, ms: 0, worst: 0, last: { frames: 0, avgMs: 0, worstMs: 0 } };
	const tipLog: { at: number; what: string; index: number; mode?: string }[] = [];
	const tipNote = (what: string, index: number, mode?: string) => {
		if (!import.meta.env.DEV) return;
		tipLog.push({ at: performance.now(), what, index, ...(mode ? { mode } : {}) });
		if (tipLog.length > 160) tipLog.splice(0, 80);
	};
	/** the screen x of the part of the line inside the box, and its texture's u there */
	const visibleStrip = () => {
		const hw = tipBox[0];
		const off = moteSim.offset;
		const x0 = Math.max(-hw, off);
		const x1 = Math.min(hw, off + tipShown.stripW);
		return { x0, x1, u0: (x0 - off) / tipShown.stripW, u1: (x1 - off) / tipShown.stripW };
	};
	const startLine = (now: number, index: number, mode: 'fit' | 'scroll' | null, hold: boolean, holdAt: number | null, fontCss: number | null = null): boolean => {
		computePlans();
		if (!drawTip(index, mode, fontCss)) return false;
		const hw = tipBox[0];
		moteSim.releaseAll();
		moteSim.setPoints(sortX, sortY, tipShown.points);
		moteSim.offset = tipShown.offset0;
		msg.index = index;
		msg.mode = tipShown.mode;
		msg.t0 = now;
		msg.tLand = now + TIPS.gatherMs;
		// "come together to form the sentence": every point inside the box takes a mote from anywhere in the swarm
		let k = 0;
		for (; k < moteSim.points; k += 1) {
			const sx = moteSim.px[k] + moteSim.offset;
			if (sx > hw) break;
			if (sx >= -hw) moteSim.bind(k, now, TIPS.gatherMs * (1 - TIPS.gatherJitter * Math.random()), false);
		}
		msg.nextIn = k;
		if (msg.mode === 'scroll') {
			msg.dist = tipShown.offset0 - tipShown.offset1;
			msg.v = (TIPS.scrollEmPerSec * tipShown.font) / 1000;
			const span = scrollSpan(msg.dist, msg.v);
			msg.scrollMs = span.ms;
			msg.ramp = span.ramp;
			msg.tScroll0 = msg.tLand + TIPS.scrollStartReadMs;
			const endRead = Math.max(TIPS.scrollEndReadMs, TIPS.scrollMinUpMs - TIPS.scrollStartReadMs - msg.scrollMs);
			msg.tBurst = msg.tScroll0 + msg.scrollMs + endRead;
		} else msg.tBurst = msg.tLand + TIPS.holdMs;
		msg.hold = hold;
		msg.freezeMs = holdAt === null ? -1 : Math.max(0, Math.min(1, holdAt)) * msg.scrollMs;
		msg.landed = false;
		msg.scrolling = false;
		msg.scrollDone = false;
		const v = visibleStrip();
		buildTipMesh(v.x0, v.x1, v.u0, v.u1);
		// "the crisp text fades in as they land"; the crest goes while a line is up
		fadeTo(tipFade, 1, TIPS.textInMs, TIPS.textInStartMs);
		if (!tipRun.crestOut) {
			tipRun.crestOut = true;
			fadeTo(crestFade, 0, BOARD_PLAQUE.crestOutMs);
		}
		moteSim.dimTo = MOTES.textDim;
		tipRun.phase = 'form';
		tipRun.index = index;
		tipNote('gather', index, msg.mode);
		return true;
	};
	/** "explode back into particles": the motes on the line fly out, the text goes, the crest comes back */
	const burstLine = (now: number) => {
		const [, top, bot] = tipBox;
		const v = visibleStrip();
		moteSim.burst((v.x0 + v.x1) / 2, (top + bot) / 2);
		fadeTo(tipFade, 0, TIPS.burstTextMs);
		// the crest comes back once the text is gone ("the crest fades only while text is up"), under the flying motes
		if (tipRun.crestOut) {
			tipRun.crestOut = false;
			fadeTo(crestFade, 1, BOARD_PLAQUE.crestBackMs, TIPS.burstTextMs);
		}
		moteSim.dimTo = 1;
		msg.hold = false;
		tipRun.phase = 'burst';
		tipRun.t = now + TIPS.burstMs;
		tipNote('burst', msg.index, msg.mode);
	};
	/** a line on show cut short (a new layout, a DEV ask): the motes let go, the text out at once */
	const cutLine = () => {
		moteSim.releaseAll();
		fadeTo(tipFade, 0, 0);
		tips.alpha = 0;
		tips.visible = false;
		msg.hold = false;
	};
	/** a scrolling line: where it is, the next letters fed from the swarm at the right end, its mesh window */
	const stepScroll = (now: number) => {
		const hw = tipBox[0];
		let tau = now - msg.tScroll0;
		if (msg.freezeMs >= 0) tau = Math.min(tau, msg.freezeMs);
		moteSim.offset = tipShown.offset0 - scrollAt(tau, msg.dist, msg.v, msg.scrollMs, msg.ramp);
		if (tau > 0 && !msg.scrolling) {
			msg.scrolling = true;
			tipNote('scroll', msg.index);
		}
		if (tau >= msg.scrollMs && !msg.scrollDone) {
			msg.scrollDone = true;
			tipNote('scrollEnd', msg.index);
		}
		// a point that will be inside the box feedMs from now takes the free mote nearest it
		let tauF = tau + TIPS.feedMs;
		if (msg.freezeMs >= 0) tauF = Math.min(tauF, msg.freezeMs);
		const offF = tipShown.offset0 - scrollAt(tauF, msg.dist, msg.v, msg.scrollMs, msg.ramp);
		while (msg.nextIn < moteSim.points && moteSim.px[msg.nextIn] + offF <= hw) {
			moteSim.bind(msg.nextIn, now, TIPS.feedMs, true);
			msg.nextIn += 1;
		}
		const v = visibleStrip();
		buildTipMesh(v.x0, v.x1, v.u0, v.u1);
	};
	let lastTipNow = 0;
	const tipTick = (now: number) => {
		if (!face.asked && typeof document !== 'undefined' && document.fonts) {
			face.asked = true;
			const done = () => {
				face.ready = true;
			};
			document.fonts.load(TIPS.fontCheck).then(done, done);
		} else if (!face.asked) face.ready = true;
		const ready = face.ready && day.texture !== PIXI.Texture.EMPTY && !!root.parent;
		// the figures first: not while they are up or still fading out (the start delay counts from them gone)
		const want = ready && (idleNow || devHold || tipPending !== null) && !showing && figFade.v <= 0.001 && forced === null;
		if (ready && tipNeed.layout) {
			// a new layout: a line on show is let go (the motes stay, inside the new box), the motes sized for it
			tipNeed.layout = false;
			placeMotes();
			if (tipRun.phase === 'form' || tipRun.phase === 'burst') {
				cutLine();
				if (tipRun.crestOut) {
					tipRun.crestOut = false;
					fadeTo(crestFade, 1, BOARD_PLAQUE.crestBackMs);
				}
				moteSim.dimTo = 1;
				tipRun.phase = 'drift';
				tipRun.base = now;
				tipRun.t = now + pace.firstMs;
				tipNote('relayout', msg.index);
			}
		}
		if (!want) {
			if (tipRun.phase !== 'off') {
				tipNote(tipRun.phase === 'wait' ? 'cancel' : 'hide', tipRun.index);
				tipRun.phase = 'off';
				tipRun.slot = 0;
				fadeTo(tipFade, 0, TIPS.hideMs);
				fadeTo(moteFade, 0, TIPS.hideMs);
				moteSim.dimTo = 1;
				msg.hold = false;
				if (tipRun.crestOut) {
					tipRun.crestOut = false;
					if (!showing && forced === null) fadeTo(crestFade, 1, BOARD_PLAQUE.crestBackMs);
				}
			}
		} else if (tipRun.phase === 'off') {
			tipRun.phase = 'wait';
			tipRun.t = now + (tipPending !== null ? 0 : TIPS.startDelayMs);
			tipNote('wait', -1);
		} else if (tipRun.phase === 'wait') {
			if (now >= tipRun.t) {
				// the motes come in, fresh in the box; the first line of the spell firstMs after
				moteSim.scatter();
				placeMotes();
				fadeTo(moteFade, 1, TIPS.motesInMs);
				tipRun.phase = 'drift';
				tipRun.base = now;
				tipRun.t = now + TIPS.motesInMs + pace.firstMs;
				tipNote('motes', -1);
			}
		} else if (tipPending !== null) {
			const ask = tipPending;
			tipPending = null;
			if (tipRun.phase === 'form' || tipRun.phase === 'burst') cutLine();
			devHold = ask.hold;
			if (!startLine(now, ask.index, ask.mode, ask.hold, ask.holdAt, ask.fontCss)) tipRun.phase = 'drift';
		} else if (tipRun.phase === 'drift') {
			if (now >= tipRun.t) {
				const at = tipAt(tipRun.slot, tipRun.other);
				if (startLine(now, at.index, null, false, null)) {
					if (at.usesOther) tipRun.other += 1;
					tipRun.slot += 1;
				} else tipRun.t = now + 250;
			}
		} else if (tipRun.phase === 'form') {
			if (msg.mode === 'scroll') stepScroll(now);
			if (!msg.hold && now >= msg.tBurst) burstLine(now);
			else if (!msg.landed && now >= msg.tLand) {
				msg.landed = true;
				tipNote('land', msg.index, msg.mode);
			}
		} else if (tipRun.phase === 'burst') {
			if (now >= tipRun.t) {
				// "every 10 s, measured from the end of the previous message"
				tipRun.phase = 'drift';
				tipRun.base = now;
				tipRun.t = now + pace.gapMs;
				devHold = false;
				tipNote('end', msg.index, msg.mode);
			}
		}
		const ta = stepFade(tipFade, now) * TIPS.alpha;
		if (tips.alpha !== ta) tips.alpha = ta;
		tips.visible = ta > 0.001;
		const ma = stepFade(moteFade, now);
		if (moteLayer.alpha !== ma) moteLayer.alpha = ma;
		moteLayer.visible = motesOn && ma > 0.001;
		// the motes move only while they show
		const dt = lastTipNow ? Math.min(0.05, (now - lastTipNow) / 1000) : 0;
		lastTipNow = now;
		if (moteLayer.visible) {
			const c0 = import.meta.env.DEV ? performance.now() : 0;
			moteSim.step(dt, now, tipRun.phase === 'form' && msg.mode === 'scroll' && msg.scrolling);
			drawMotes();
			if (import.meta.env.DEV) {
				const d = performance.now() - c0;
				moteStat.frames += 1;
				moteStat.ms += d;
				if (d > moteStat.worst) moteStat.worst = d;
				if (moteStat.frames >= 240) {
					moteStat.last = { frames: moteStat.frames, avgMs: moteStat.ms / moteStat.frames, worstMs: moteStat.worst };
					moteStat.frames = 0;
					moteStat.ms = 0;
					moteStat.worst = 0;
				}
			}
		}
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
		// the explainer lines (they move the crest's fade, so before it is read)
		tipTick(now);
		if (tips.visible && mesh.tint !== tipMesh.tint) tipMesh.tint = mesh.tint;
		if (moteLayer.visible && mesh.tint !== moteLayer.tint) moteLayer.tint = mesh.tint;
		// the fades, the bump and the final rise
		const fa = forced !== null ? 1 : stepFade(figFade, now);
		const ca = forced !== null ? 0 : stepFade(crestFade, now);
		const hidden = forced === null && !!context.stateGame.plaque;
		const alpha = hidden ? 0 : fa;
		if (figures.alpha !== alpha) figures.alpha = alpha;
		figures.visible = alpha > 0.001;
		if (crest.alpha !== ca) crest.alpha = ca;
		crest.visible = ca > 0.001;
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

	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		ticker?.add(tick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
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
				/** THE EXPLAINER LINES (feedback/plaque_tips_r2/plaque_tips_probe.js): the run, the line on show (how it shows,
				 *  its rows and size, its scroll), the text box, the mesh's window and every row's ink on screen (CSS px, four
				 *  corners each, the ink clipped to the box), the motes (how many, how bright, any outside the box), their
				 *  cost, every line's plan on this screen, the log */
				plaqueTips: () => {
					const [hw, top, bot] = tipBox;
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
					const on = tipRun.phase === 'form' || tipRun.phase === 'burst';
					const off = moteSim.offset;
					const v = visibleStrip();
					const boxQ = corners(-hw, top, hw, bot);
					// the motes on screen: lit ones, and any outside the box's quad (0.75 px tolerance)
					const inQuad = (pt: { x: number; y: number }, q: { x: number; y: number }[], tol = 0.75) => {
						let sign = 0;
						for (let i = 0; i < 4; i += 1) {
							const a = q[i];
							const b = q[(i + 1) % 4];
							const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
							const cr = ((b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x)) / len;
							if (Math.abs(cr) <= tol) continue;
							const s = Math.sign(cr);
							if (sign === 0) sign = s;
							else if (s !== sign) return false;
						}
						return true;
					};
					let lit = 0;
					let outside = 0;
					let sumA = 0;
					const la = moteLayer.visible ? moteLayer.alpha : 0;
					for (let i = 0; i < MOTE_N; i += 1) {
						const a = moteSim.alpha[i] * la;
						if (a <= 0.02) continue;
						lit += 1;
						sumA += a;
						const pt = g(root, moteParts[i].x, moteParts[i].y);
						if (!inQuad(pt, boxQ)) outside += 1;
					}
					return {
						phase: tipRun.phase,
						index: on ? msg.index : -1,
						lastIndex: tipRun.index,
						slot: tipRun.slot,
						other: tipRun.other,
						mode: on ? tipShown.mode : null,
						text: on ? (tipTexts[msg.index] ?? null) : null,
						rows: on ? tipShown.rows.slice() : [],
						font: on ? tipShown.font : null,
						/** the font size and the cap height on screen, CSS px */
						fontCss: on ? +(tipShown.font * tipShown.kCss).toFixed(2) : null,
						capCss: on ? +(tipShown.font * capK * tipShown.kCss).toFixed(2) : null,
						alpha: +tips.alpha.toFixed(3),
						visible: tips.visible,
						idle: idleNow,
						showing,
						crestAlpha: +crest.alpha.toFixed(3),
						faceReady: face.ready,
						faceLoaded: typeof document !== 'undefined' ? document.fonts.check(TIPS.fontCheck) : null,
						order: root.children.map((c) => c.label || 'Sprite'),
						eventMode: tips.eventMode,
						moteEventMode: moteLayer.eventMode,
						tint: tipMesh.tint as number,
						texture: { w: tipShown.cw, h: tipShown.ch, res: context.stateApp.pixiApplication?.renderer?.resolution ?? 1 },
						box: boxQ,
						field: (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(day.getBounds()),
						/** the mesh's window (what of the line can draw), four corners on screen */
						window: on ? corners(v.x0, top, v.x1, bot) : null,
						ink: on
							? tipShown.ink
									.map((k) => ({ x0: Math.max(-hw, k.x0 + off), x1: Math.min(hw, k.x1 + off), y0: k.y0, y1: k.y1 }))
									.filter((k) => k.x1 > k.x0)
									.map((k) => corners(k.x0, k.y0, k.x1, k.y1))
							: [],
						scroll: on && tipShown.mode === 'scroll' ? { offset: +off.toFixed(2), offset0: +tipShown.offset0.toFixed(2), offset1: +tipShown.offset1.toFixed(2), dist: +msg.dist.toFixed(2), ms: Math.round(msg.scrollMs), emPerSec: TIPS.scrollEmPerSec, cssPerSec: +(msg.v * 1000 * tipShown.kCss).toFixed(1), scrolling: msg.scrolling, done: msg.scrollDone } : null,
						times: on ? { t0: msg.t0, tLand: msg.tLand, tScroll0: msg.mode === 'scroll' ? msg.tScroll0 : null, tBurst: msg.tBurst, hold: msg.hold } : null,
						next: tipRun.phase === 'drift' || tipRun.phase === 'wait' ? Math.round(tipRun.t - performance.now()) : null,
						motes: {
							n: MOTE_N,
							phoneTier: PHONE_TIER,
							on: motesOn,
							visible: moteLayer.visible,
							alpha: +moteLayer.alpha.toFixed(3),
							lit,
							meanAlpha: lit ? +(sumA / lit).toFixed(3) : 0,
							outside,
							bound: moteSim.bound(),
							free: moteSim.freeCount,
							points: moteSim.points,
							dim: +moteSim.dim.toFixed(3),
							blend: moteLayer.blendMode,
							texture: { label: moteTex.label ?? null, w: moteTex.source.pixelWidth, h: moteTex.source.pixelHeight, uid: moteTex.source.uid },
							perf: { ...moteStat.last },
						},
						lines: tipTexts.slice(),
						kCss: +planK.toFixed(4),
						plans: tipPlans.map((p, i) => ({ mode: p.mode, font: +p.font.toFixed(2), fontCss: +(p.font * planK).toFixed(2), rows: p.rows.map((r) => r.join(' ')), widths: p.rows.map((r) => +(widthAt1(r.join(' ')) * p.font).toFixed(2)), text: tipTexts[i] })),
						boxUnits: [...tipBox],
						constants: { ...TIPS, motes: { ...MOTES } },
						pace: { ...pace },
						log: tipLog.map((e) => ({ ...e })),
					};
				},
				/** show line `i` (0 is line 1) now. `mode` forces 'fit' or 'scroll' (`fontCss` the forced scroll's size);
				 *  `hold` keeps it up (formed, or for a scroll stopped `holdAt` 0..1 along it) whatever the board does, until
				 *  plaqueTipsForce(null) */
				plaqueTipsShow: (i: number, opts: { mode?: 'fit' | 'scroll'; hold?: boolean; holdAt?: number; fontCss?: number } = {}) => {
					tipPending = { index: i, mode: opts.mode ?? null, hold: !!opts.hold, holdAt: opts.holdAt ?? null, fontCss: opts.fontCss ?? null };
				},
				/** r1's: hold line `i` up for a still; null lets a held line burst and hands the plaque back to the cadence */
				plaqueTipsForce: (i: number | null) => {
					if (i === null) {
						if (msg.hold) {
							msg.hold = false;
							msg.freezeMs = -1;
							msg.tBurst = Math.min(msg.tBurst, performance.now());
						}
						return;
					}
					tipPending = { index: i, mode: null, hold: true, holdAt: null, fontCss: null };
				},
				/** the cadence's waits (ms); null puts the constants back */
				plaqueTipsPace: (p: { gapMs?: number; firstMs?: number } | null) => {
					pace.gapMs = p?.gapMs ?? TIPS.gapMs;
					pace.firstMs = p?.firstMs ?? TIPS.firstMs;
					// a wait under way is counted again from its start with the new numbers
					if (tipRun.phase === 'drift') tipRun.t = tipRun.base + (tipRun.slot === 0 ? TIPS.motesInMs + pace.firstMs : pace.gapMs);
				},
				/** the motes drawn (true) or not (false), for the cost A / B */
				plaqueMotes: (on: boolean) => {
					motesOn = on;
				},
			});
		}
		return () => {
			ticker?.remove(tick);
			root.removeFromParent();
			root.destroy({ children: true });
			tipTexture.destroy(true);
		};
	});
</script>
