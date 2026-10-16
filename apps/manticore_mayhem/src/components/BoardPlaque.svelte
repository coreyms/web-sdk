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
	root.addChild(shadow, day, night, fire, crest, figures);
	for (const s of [shadow, day, night, fire, crestDay, crestNight, crestFire]) s.visible = false;
	figures.alpha = 0;

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
	/** a layout-unit point through the homography H and the registration: master px into `out` */
	const P = { x: 0, y: 0 };
	const through = (x: number, y: number) => {
		const w = H[6] * x + H[7] * y + 1;
		const m = map((H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w);
		P.x = m.x;
		P.y = m.y;
		return P;
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
			});
		}
		return () => {
			ticker?.remove(tick);
			root.removeFromParent();
			root.destroy({ children: true });
		};
	});
</script>
