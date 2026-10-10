<script lang="ts">
	// THE CLUSTER LABELS IN THE PLAQUE'S FORGED FONT (CLUSTER_LABEL, Corey 2026-10-09): the per-cluster
	// readouts ("amount  xmult" apart, slammed together, the merged total counting up), set in the win
	// plaque's forged Rakkas glyphs from the labels' OWN atlases (game/clusterLabel.ts says why: the plaque's
	// 64 texel glyphs drawn at 21 to 36 px looked pixellated). Each glyph is two sprites: the baked dark
	// outline + soft shadow UNDER (never tinted) and the forged FACE over it (cream as baked for an amount,
	// tinted the title's teal for a multiplier). Sprite tints only: no filter, no text raster, no texture
	// made here, no mipmaps needed.
	//
	// DRAWN AT ABOUT 1:1. The atlases are baked at five cap heights in CANVAS pixels. Every tick the layer
	// works out the labels' cap height on the canvas (CLUSTER_LABEL.capCells of a cell x the board's scale x
	// the renderer's resolution) and uses the loaded cap nearest to it, so a glyph is sampled within about
	// 0.9x to 1.12x of its texture on any screen; glyph positions are whole texels and a label at rest is put
	// on a whole canvas pixel (CLUSTER_LABEL.snapToPixels). A window resize or a rotation just moves to
	// another cap (the rows re-lay themselves out).
	//
	// Same shape as BoardCells: raw Pixi in ONE always-mounted layer of the board container (the z-order
	// trap), synced from the app ticker with plain reads of stateGame.readouts, labels POOLED by readout id.
	// The board engine (stateGame.presentWinSet) decides everything: the strings (the book's numbers), the
	// positions and the size (game/labelPlacement.ts) and whether a win set is forged at all. A readout with
	// `forged` false is the stencil fallback and is drawn by Board.svelte, not here.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, GRID, CLUSTER_LABEL } from '../game/constants';
	import { LABEL_CAPS } from '../game/labelGlyphs';
	import { labelFont, labelFrames, layoutLabel, pickLabelCap, LabelRun } from '../game/clusterLabel';
	import { labelLog } from '../game/stateGame.svelte';

	const context = getContext();
	const stateGame = context.stateGame;

	// over the tiles (0..10), the flashes (11), the sparkles (12), the sting (15) and the swipe (21)
	const layer = new PIXI.Container({ zIndex: 30, label: 'clusterLabels' });
	getContextParent().addToParent(layer);

	/** the labels' cap height in board units, and the widest a row may run */
	const CAP = SYMBOL_SIZE * CLUSTER_LABEL.capCells;
	const MAX_W = SYMBOL_SIZE * (GRID - 0.5);

	const atlas = () => context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;

	// ---- the cap in use -----------------------------------------------------------------------------
	/** per cap: character -> its two textures, looked up once */
	const texCache: Map<string, { face: PIXI.Texture; under: PIXI.Texture }>[] = LABEL_CAPS.map(() => new Map());
	const texturesOf = (ch: string, capIndex: number) => {
		let t = texCache[capIndex].get(ch);
		if (!t) {
			const names = labelFrames(ch, capIndex);
			const tex = atlas();
			t = { face: tex?.[names.face] ?? PIXI.Texture.EMPTY, under: tex?.[names.under] ?? PIXI.Texture.EMPTY };
			texCache[capIndex].set(ch, t);
		}
		return t;
	};
	/** board units per texel of the cap in use (a cap of LABEL_CAPS[i] texels is drawn CAP board units tall) */
	let unit = 1;
	/** canvas pixels per texel at label size 1: what the glyphs are sampled at (the probe's 0.8 .. 1.25) */
	let sampling = 0;
	let canvasCap = 0;
	/** bumped when the cap changes: every row re-lays itself out */
	let capGen = 0;
	const probeFor = '0';
	const pickCap = () => {
		const tex = atlas();
		if (tex) {
			for (let i = 0; i < LABEL_CAPS.length; i += 1) {
				if (!labelFont.loaded[i] && tex[labelFrames(probeFor, i).face]) labelFont.loaded[i] = true;
			}
		}
		// the board's scale on the canvas: its world scale (stage units = CSS px) x the renderer's resolution
		const wt = layer.worldTransform;
		const res = context.stateApp.pixiApplication?.renderer.resolution ?? 1;
		const worldScale = Math.abs(wt.a) || 1;
		canvasCap = CAP * worldScale * res;
		const idx = pickLabelCap(canvasCap);
		if (idx !== labelFont.cap) {
			labelFont.cap = idx;
			capGen += 1;
		}
		if (idx >= 0) {
			unit = CAP / LABEL_CAPS[idx];
			sampling = canvasCap / LABEL_CAPS[idx];
		}
	};

	// ---- the rows ------------------------------------------------------------------------------------
	/** one string: its under sprites, then its face sprites (so a glyph's outline never covers its
	 *  neighbour's face), in a box that carries the position and the scale */
	type Part = { box: PIXI.Container; under: PIXI.Container; face: PIXI.Container; run: LabelRun; text: string | null; tabular: boolean; gen: number; fit: number; x: number; scale: number; on: boolean };
	type Label = { root: PIXI.Container; amount: Part; mult: Part; merged: Part; y: number; alpha: number; gen: number };
	const live = new Map<number, Label>();
	const free: Label[] = [];
	let gen = 0;
	let made = 0;

	const part = (root: PIXI.Container, tint: number): Part => {
		const box = new PIXI.Container();
		const under = new PIXI.Container();
		const face = new PIXI.Container();
		face.tint = tint;
		box.addChild(under, face);
		box.visible = false;
		root.addChild(box);
		return { box, under, face, run: new LabelRun(), text: null, tabular: false, gen: -1, fit: 1, x: NaN, scale: NaN, on: false };
	};
	const make = (): Label => {
		const root = new PIXI.Container();
		root.visible = false;
		layer.addChild(root);
		made += 1;
		return { root, amount: part(root, CLUSTER_LABEL.amountTint), mult: part(root, CLUSTER_LABEL.multTint), merged: part(root, CLUSTER_LABEL.amountTint), y: NaN, alpha: NaN, gen: -1 };
	};
	/** lay the row out (only when its string or the cap changed): sprites at their NATURAL texel size, at
	 *  whole texel positions; the box scales texels to board units */
	const setText = (p: Part, text: string, tabular: boolean) => {
		if (p.text === text && p.tabular === tabular && p.gen === capGen) return;
		p.text = text;
		p.tabular = tabular;
		p.gen = capGen;
		const cap = labelFont.cap;
		const run = layoutLabel(text, cap, tabular, p.run);
		const fill = (row: PIXI.Container, xs: Int16Array, ys: Int16Array, which: 'face' | 'under') => {
			const kids = row.children as PIXI.Sprite[];
			while (kids.length < run.count) row.addChild(new PIXI.Sprite(PIXI.Texture.EMPTY));
			for (let i = 0; i < kids.length; i += 1) {
				const s = kids[i];
				if (i >= run.count) {
					s.visible = false;
					continue;
				}
				s.texture = texturesOf(run.chars[i], cap)[which];
				s.position.set(xs[i], ys[i]);
				s.visible = true;
			}
		};
		fill(p.under, run.underX, run.underY, 'under');
		fill(p.face, run.faceX, run.faceY, 'face');
		// a row wider than the opening shrinks to it (the stencil readout's maxWidth)
		p.fit = run.width * unit > MAX_W ? MAX_W / (run.width * unit) : 1;
	};
	/** a board coordinate moved onto the nearest whole canvas pixel (`a` scale and `t` offset of the layer's
	 *  world transform on that axis, `res` the renderer's resolution) */
	const snap = (v: number, a: number, t: number, res: number) => (a ? (Math.round((a * v + t) * res) / res - t) / a : v);
	const show = (p: Part, on: boolean, text: string, x: number, scale: number, tabular: boolean) => {
		if (p.on !== on) {
			p.on = on;
			p.box.visible = on;
		}
		if (!on) return;
		setText(p, text, tabular);
		const s = unit * scale * p.fit;
		if (x !== p.x) {
			p.x = x;
			p.box.x = x;
		}
		if (s !== p.scale) {
			p.scale = s;
			p.box.scale.set(s);
		}
	};

	const sync = () => {
		pickCap();
		const readouts = stateGame.readouts;
		if (!readouts.length && !live.size) return;
		gen += 1;
		const wt = layer.worldTransform;
		const res = context.stateApp.pixiApplication?.renderer.resolution ?? 1;
		for (let i = 0; i < readouts.length; i += 1) {
			const r = readouts[i];
			if (!r.forged || labelFont.cap < 0) continue;
			let l = live.get(r.id);
			if (!l) {
				l = free.pop() ?? make();
				l.root.visible = true;
				live.set(r.id, l);
			}
			l.gen = gen;
			const raw = r.mode === 'raw';
			// still = nothing about it moved since the last tick and it is not punching: put it on the pixel grid
			const still = CLUSTER_LABEL.snapToPixels && r.y === l.y && r.scale === 1 && (raw ? r.amountX === l.amount.x && r.multX === l.mult.x : r.x === l.merged.x);
			if (r.y !== l.y) {
				l.y = r.y;
				l.root.y = r.y;
			}
			if (r.alpha !== l.alpha) {
				l.alpha = r.alpha;
				l.root.alpha = r.alpha;
			}
			show(l.amount, raw, r.amount, r.amountX, r.size, false);
			show(l.mult, raw, r.mult, r.multX, r.size, false);
			show(l.merged, !raw, r.text, r.x, r.scale * r.size, true);
			if (still) {
				// the engine's own numbers stay in l.y / part.x (so `still` keeps comparing like with like);
				// only the drawn position moves, by less than a pixel
				l.root.y = snap(r.y, wt.d, wt.ty, res);
				if (raw) {
					l.amount.box.x = snap(r.amountX, wt.a, wt.tx, res);
					l.mult.box.x = snap(r.multX, wt.a, wt.tx, res);
				} else l.merged.box.x = snap(r.x, wt.a, wt.tx, res);
			} else {
				if (l.root.y !== r.y) l.root.y = r.y;
				if (raw) {
					if (l.amount.box.x !== r.amountX) l.amount.box.x = r.amountX;
					if (l.mult.box.x !== r.multX) l.mult.box.x = r.multX;
				} else if (l.merged.box.x !== r.x) l.merged.box.x = r.x;
			}
		}
		for (const [id, l] of live) {
			if (l.gen === gen) continue;
			l.root.visible = false;
			l.y = l.alpha = NaN;
			l.amount.x = l.mult.x = l.merged.x = NaN;
			live.delete(id);
			free.push(l);
		}
	};

	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		// after the board engine's writes, before the render (BoardCells does the same)
		ticker?.add(sync, undefined, PIXI.UPDATE_PRIORITY.HIGH);
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			// LABELS probe (tools/manticore/boardfix_probe.js, labelfix_shots.js): the font state, how the glyphs
			// are sampled, the last win set's placement and every label drawn right now with its screen rect, its
			// mode, its strings and its tints
			const rect = (c: PIXI.Container) => (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(c.getBounds());
			const shown = (c: PIXI.Container) => (c.children as PIXI.Sprite[]).filter((s) => s.visible);
			/** a row's glyph sprites: drawn size on the CANVAS over the texture's size (1 = texel on pixel) */
			const ratios = (p: Part) => {
				const res = context.stateApp.pixiApplication?.renderer.resolution ?? 1;
				return shown(p.face).map((s) => (s.getBounds().width * res) / s.texture.frame.width);
			};
			Object.defineProperty(((window as any).__manticore ??= {}), 'labels', {
				get: () => ({
					// `metrics` is kept for the probe's older check: the metrics are compiled in now
					font: { metrics: true, atlas: labelFont.cap >= 0, forceStencil: labelFont.forceStencil, caps: [...LABEL_CAPS], loaded: labelFont.loaded.slice(), cap: labelFont.cap < 0 ? null : LABEL_CAPS[labelFont.cap] },
					/** the labels' cap height in canvas pixels, the baked cap in use and canvas pixels per texel at label size 1 */
					sampling: { canvasCap, cap: labelFont.cap < 0 ? null : LABEL_CAPS[labelFont.cap], scale: sampling, resolution: context.stateApp.pixiApplication?.renderer.resolution ?? 1 },
					pool: { made, live: live.size, free: free.length },
					last: labelLog.last,
					constants: { capCells: CLUSTER_LABEL.capCells, amountTint: CLUSTER_LABEL.amountTint, multTint: CLUSTER_LABEL.multTint, teal: CLUSTER_LABEL.teal },
					readouts: stateGame.readouts.map((r) => ({ id: r.id, forged: r.forged, size: r.size, mode: r.mode, x: r.x, y: r.y, alpha: r.alpha, scale: r.scale, amount: r.amount, mult: r.mult, text: r.text })),
					drawn: [...live.entries()].map(([id, l]) => {
						const raw = l.amount.on;
						const one = (p: Part) => ({ text: p.text ?? '', tint: p.face.tint as number, underTint: p.under.tint as number, rect: rect(p.face), missing: '', glyphs: shown(p.face).length, unders: shown(p.under).length, ratios: ratios(p), fit: p.fit, origin: (({ x, y }) => ({ x, y }))(p.box.getGlobalPosition()) });
						return {
							id,
							mode: raw ? 'raw' : 'merged',
							alpha: l.root.alpha,
							/** the whole label's ink on screen (the faces only: the outline and shadow reach a little further) */
							rect: raw ? (() => { const a = rect(l.amount.face); const b = rect(l.mult.face); const x0 = Math.min(a.x, b.x); const y0 = Math.min(a.y, b.y); return { x: x0, y: y0, w: Math.max(a.x + a.w, b.x + b.w) - x0, h: Math.max(a.y + a.h, b.y + b.h) - y0 }; })() : rect(l.merged.face),
							/** the same with the baked outline and shadow (what must not overlap another label) */
							full: rect(l.root),
							amount: raw ? one(l.amount) : null,
							mult: raw ? one(l.mult) : null,
							merged: raw ? null : one(l.merged),
						};
					}),
				}),
				configurable: true,
				enumerable: true,
			});
			Object.assign((window as any).__manticore, {
				/** draw the stencil fallback even with the forged glyphs in (the probe's A / B) */
				labelStencil: (on: boolean) => (labelFont.forceStencil = !!on),
			});
		}
		return () => {
			ticker?.remove(sync);
			// the parent's unmount destroys the layer; the pooled glyph sprites go with their containers
			for (const l of [...free, ...live.values()]) l.root.destroy({ children: true });
		};
	});
</script>
