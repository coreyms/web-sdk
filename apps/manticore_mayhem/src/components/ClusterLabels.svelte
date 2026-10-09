<script lang="ts">
	// THE CLUSTER LABELS IN THE PLAQUE'S FORGED FONT (CLUSTER_LABEL, Corey 2026-10-09): the per-cluster
	// readouts ("amount  xmult" apart, slammed together, the merged total counting up) set from the win
	// plaque's glyph atlas with the plaque's own layout and sprite row (game/stinger/text.ts,
	// game/stinger/plaqueText.ts: imported, not changed). The amount keeps the atlas's cream, the multiplier
	// is tinted the title's teal: sprite tints only, no filter, no text raster, no texture made here.
	//
	// Same shape as BoardCells: raw Pixi in ONE always-mounted layer of the board container (the z-order
	// trap), synced from the app ticker with plain reads of stateGame.readouts, labels POOLED by readout id.
	// The board engine (stateGame.presentWinSet) decides everything: the strings (the book's numbers), the
	// positions and the size (game/labelPlacement.ts) and whether a win set is forged at all. A readout with
	// `forged` false is the stencil fallback and is drawn by Board.svelte, not here.
	//
	// The atlas and stinger.json are DEFERRED assets: this component fetches the json through the plaque's
	// own cached loader (one fetch, shared) and flags the font ready once the atlas textures are in.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, GRID, CLUSTER_LABEL } from '../game/constants';
	import { STINGER_DATA_URLS } from '../game/assets';
	import { loadStingerData } from '../game/stinger/data';
	import { PlaqueText } from '../game/stinger/plaqueText';
	import { labelFont, setLabelFont, forgedEm } from '../game/clusterLabel';
	import { labelLog } from '../game/stateGame.svelte';

	const context = getContext();
	const stateGame = context.stateGame;

	// over the tiles (0..10), the flashes (11), the sparkles (12), the sting (15) and the swipe (21)
	const layer = new PIXI.Container({ zIndex: 30, label: 'clusterLabels' });
	getContextParent().addToParent(layer);

	const CAP = SYMBOL_SIZE * CLUSTER_LABEL.capCells;
	const MAX_W = SYMBOL_SIZE * (GRID - 0.5);
	const SH = CLUSTER_LABEL.shadow;

	/** one string: a dark rim (four copies a hair off the face, CLUSTER_LABEL.rimCells) and the hard drop shadow
	 *  under the forged face, so the number reads over any symbol; all rows of pooled glyph sprites */
	type Part = { box: PIXI.Container; under: PlaqueText[]; shadow: PlaqueText; face: PlaqueText; x: number; scale: number; on: boolean };
	const RIM = SYMBOL_SIZE * CLUSTER_LABEL.rimCells;
	type Label = { root: PIXI.Container; amount: Part; mult: Part; merged: Part; y: number; alpha: number; gen: number };
	const live = new Map<number, Label>();
	const free: Label[] = [];
	let gen = 0;
	let made = 0;

	const atlas = () => context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;

	const part = (root: PIXI.Container, tint: number): Part => {
		const font = labelFont.font!;
		const tex = atlas()!;
		const box = new PIXI.Container();
		const shadow = new PlaqueText(font, tex);
		const face = new PlaqueText(font, tex);
		shadow.view.tint = SH.tint;
		shadow.view.alpha = SH.alpha;
		shadow.view.position.set(SH.dx * CAP, SH.dy * CAP);
		face.view.tint = tint;
		const under: PlaqueText[] = [shadow];
		box.addChild(shadow.view);
		if (RIM > 0) {
			for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
				const rim = new PlaqueText(font, tex);
				rim.view.tint = SH.tint;
				rim.view.position.set(dx * RIM, dy * RIM);
				box.addChild(rim.view);
				under.push(rim);
			}
		}
		box.addChild(face.view);
		box.visible = false;
		root.addChild(box);
		return { box, under, shadow, face, x: NaN, scale: NaN, on: false };
	};
	const make = (): Label => {
		const root = new PIXI.Container();
		root.visible = false;
		layer.addChild(root);
		made += 1;
		return { root, amount: part(root, CLUSTER_LABEL.amountTint), mult: part(root, CLUSTER_LABEL.multTint), merged: part(root, CLUSTER_LABEL.amountTint), y: NaN, alpha: NaN, gen: -1 };
	};
	const show = (p: Part, on: boolean, text: string, x: number, scale: number, tabular: boolean) => {
		if (p.on !== on) {
			p.on = on;
			p.box.visible = on;
		}
		if (!on) return;
		// a no-op unless the string changed (PlaqueText keeps the last one): a count-up re-lays a few sprites
		const opts = tabular ? { tabular: true, maxWidth: MAX_W } : { maxWidth: MAX_W };
		for (let i = 0; i < p.under.length; i += 1) p.under[i].set(text, forgedEm(CAP), opts);
		p.face.set(text, forgedEm(CAP), opts);
		if (x !== p.x) {
			p.x = x;
			p.box.x = x;
		}
		if (scale !== p.scale) {
			p.scale = scale;
			p.box.scale.set(scale);
		}
	};

	const sync = () => {
		// the font is ready once the metrics AND the atlas textures are in (the engine reads this flag)
		if (!labelFont.atlasIn && labelFont.font) {
			const tex = atlas();
			if (tex && labelFont.font.frames.length && tex[labelFont.font.frames[0]]) labelFont.atlasIn = true;
		}
		const readouts = stateGame.readouts;
		if (!readouts.length && !live.size) return;
		gen += 1;
		for (let i = 0; i < readouts.length; i += 1) {
			const r = readouts[i];
			if (!r.forged || !labelFont.atlasIn) continue;
			let l = live.get(r.id);
			if (!l) {
				l = free.pop() ?? make();
				l.root.visible = true;
				live.set(r.id, l);
			}
			l.gen = gen;
			if (r.y !== l.y) {
				l.y = r.y;
				l.root.y = r.y;
			}
			if (r.alpha !== l.alpha) {
				l.alpha = r.alpha;
				l.root.alpha = r.alpha;
			}
			const raw = r.mode === 'raw';
			show(l.amount, raw, r.amount, r.amountX, r.size, false);
			show(l.mult, raw, r.mult, r.multX, r.size, false);
			show(l.merged, !raw, r.text, r.x, r.scale * r.size, true);
		}
		for (const [id, l] of live) {
			if (l.gen === gen) continue;
			l.root.visible = false;
			l.y = l.alpha = NaN;
			live.delete(id);
			free.push(l);
		}
	};

	onMount(() => {
		let gone = false;
		let retry: ReturnType<typeof setTimeout> | undefined;
		const load = () => {
			loadStingerData(STINGER_DATA_URLS)
				.then((data) => !gone && setLabelFont(data.json))
				.catch(() => {
					// the plaque's loader forgets a failed fetch: ask again, slowly (the stencil readout draws meanwhile)
					if (!gone) retry = setTimeout(load, 5000);
				});
		};
		load();
		const ticker = context.stateApp.pixiApplication?.ticker;
		// after the board engine's writes, before the render (BoardCells does the same)
		ticker?.add(sync, undefined, PIXI.UPDATE_PRIORITY.HIGH);
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			// LABELS probe (tools/manticore/boardfix_probe.js): the font state, the last win set's placement and
			// every label drawn right now with its screen rect, its mode, its strings and its tints
			const rect = (c: PIXI.Container) => (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(c.getBounds());
			Object.defineProperty(((window as any).__manticore ??= {}), 'labels', {
				get: () => ({
					font: { metrics: !!labelFont.font, atlas: labelFont.atlasIn, forceStencil: labelFont.forceStencil },
					pool: { made, live: live.size, free: free.length },
					last: labelLog.last,
					constants: { capCells: CLUSTER_LABEL.capCells, amountTint: CLUSTER_LABEL.amountTint, multTint: CLUSTER_LABEL.multTint, teal: CLUSTER_LABEL.teal },
					readouts: stateGame.readouts.map((r) => ({ id: r.id, forged: r.forged, size: r.size, mode: r.mode, x: r.x, y: r.y, alpha: r.alpha, scale: r.scale, amount: r.amount, mult: r.mult, text: r.text })),
					drawn: [...live.entries()].map(([id, l]) => {
						const raw = l.amount.on;
						return {
							id,
							mode: raw ? 'raw' : 'merged',
							alpha: l.root.alpha,
							/** the whole label's ink on screen (the visible faces only: the shadow is a hair larger) */
							rect: raw ? rect(l.root) : rect(l.merged.face.view),
							amount: raw ? { text: l.amount.face.text, tint: l.amount.face.view.tint, rect: rect(l.amount.face.view), missing: l.amount.face.missing } : null,
							mult: raw ? { text: l.mult.face.text, tint: l.mult.face.view.tint, rect: rect(l.mult.face.view), missing: l.mult.face.missing } : null,
							merged: raw ? null : { text: l.merged.face.text, tint: l.merged.face.view.tint, rect: rect(l.merged.face.view), missing: l.merged.face.missing },
						};
					}),
				}),
				configurable: true,
				enumerable: true,
			});
			Object.assign((window as any).__manticore, {
				/** draw the stencil fallback even with the forged font in (the probe's A / B) */
				labelStencil: (on: boolean) => (labelFont.forceStencil = !!on),
			});
		}
		return () => {
			gone = true;
			if (retry) clearTimeout(retry);
			ticker?.remove(sync);
			// the parent's unmount destroys the layer; the pooled glyph sprites go with their containers
			for (const l of [...free, ...live.values()]) l.root.destroy({ children: true });
		};
	});
</script>
