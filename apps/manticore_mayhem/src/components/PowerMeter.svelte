<script lang="ts">
	// THE BOARD POWER METER, MOCKUP r1 (DEV only, ?meter=A|B|C|D; game/powerMeter.svelte.ts says what the number is).
	// This component runs the driver (meterTick) for every placement, and draws the two canvas placements of its own:
	//   B  a tally plate centred on the frame's top rail: "BOARD x349" in the cluster labels' forged face
	//   D  the left post: the word and the number on the post's black panel, and a gauge of eight segments up the
	//      post's inner face (one per 8 lit cells of 64, so the gauge has a fixed top while the sum has none)
	// (A lives in BoardPlaque.svelte, C in the HTML chrome.) Both are drawn in BoardFrame's plaque slot, in master units
	// through the frame's own registration, so they take the frame's kick and grow with the frame. Sprites from the
	// label atlas, two Graphics redrawn only when the width or the lit count changes; no text raster, no filter.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import { layoutKind } from '../game/layoutSpec';
	import { boardRegistration } from '../game/boardArt';
	import { POWER_METER } from '../game/constants';
	import { LABEL_CAPS } from '../game/labelGlyphs';
	import { labelFont, labelFrames, layoutLabel, pickLabelCap, LabelRun } from '../game/clusterLabel';
	import { boardPlaqueSlot } from '../game/boardPlateSlot';
	import { METER_VARIANT, meterLive, meterTick, meterNumber, meterProbe } from '../game/powerMeter.svelte';

	const context = getContext();
	const variant = METER_VARIANT;

	const root = new PIXI.Container({ label: 'power-meter' });
	root.visible = false;

	// ---- a row of label glyphs (under layer then face), laid out in texels, scaled to render px by its box ----
	type Part = { box: PIXI.Container; under: PIXI.Container; face: PIXI.Container; run: LabelRun; text: string | null; cap: number; tabular: boolean };
	const part = (parent: PIXI.Container, tint: number, tabular: boolean): Part => {
		const box = new PIXI.Container();
		const under = new PIXI.Container();
		const face = new PIXI.Container();
		face.tint = tint;
		box.addChild(under, face);
		parent.addChild(box);
		return { box, under, face, run: new LabelRun(16), text: null, cap: -1, tabular };
	};
	const atlas = () => context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
	const tex = (ch: string, cap: number, which: 'face' | 'under') => atlas()?.[labelFrames(ch, cap)[which]] ?? PIXI.Texture.EMPTY;
	/** lay `text` out at `cap` (only when either changed); returns the row's advance width in texels */
	const setText = (p: Part, text: string, cap: number) => {
		if (p.text === text && p.cap === cap) return p.run.width;
		p.text = text;
		p.cap = cap;
		const run = layoutLabel(text, cap, p.tabular, p.run);
		const fill = (row: PIXI.Container, xs: Int16Array, ys: Int16Array, which: 'face' | 'under') => {
			const kids = row.children as PIXI.Sprite[];
			while (kids.length < run.count) row.addChild(new PIXI.Sprite(PIXI.Texture.EMPTY));
			for (let i = 0; i < kids.length; i += 1) {
				const s = kids[i];
				s.visible = i < run.count;
				if (!s.visible) continue;
				s.texture = tex(run.chars[i], cap, which);
				s.position.set(xs[i], ys[i]);
			}
		};
		fill(p.under, run.underX, run.underY, 'under');
		fill(p.face, run.faceX, run.faceY, 'face');
		return run.width;
	};

	// ---- B: the rail tally ----
	const rail = new PIXI.Container({ label: 'meter-rail' });
	const railPlate = new PIXI.Graphics();
	const railBody = new PIXI.Container();
	rail.addChild(railPlate, railBody);
	const railWord = part(railBody, POWER_METER.wordTint, false);
	const railNum = part(railBody, POWER_METER.numTint, true);
	// ---- D: the post ----
	const post = new PIXI.Container({ label: 'meter-post' });
	const gauge = new PIXI.Graphics();
	const postPlate = new PIXI.Graphics();
	const postWordBox = new PIXI.Container();
	const postNumBox = new PIXI.Container();
	post.addChild(gauge, postPlate, postWordBox, postNumBox);
	const postWord = part(postWordBox, POWER_METER.wordTint, false);
	const postNum = part(postNumBox, POWER_METER.numTint, true);
	if (variant === 'B') root.addChild(rail);
	if (variant === 'D') root.addChild(post);

	// ---- the layout ----
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const vw = $derived(context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale);
	const reg = $derived(boardRegistration(kind, vw));
	/** plain copies for the tick */
	let map: (u: number, v: number) => { x: number; y: number } = (u, v) => ({ x: u, y: v });
	let m = 1;
	$effect(() => {
		map = reg.map;
		m = reg.m;
		laid.width = -1;
		laid.lit = -1;
	});
	const laid = { width: -1, lit: -1, cap: -1 };

	/** the loaded label cap nearest to `renderPx` of the frame art on the canvas */
	const capFor = (renderPx: number) => {
		const tx = atlas();
		if (tx) for (let i = 0; i < LABEL_CAPS.length; i += 1) if (!labelFont.loaded[i] && tx[labelFrames('0', i).face]) labelFont.loaded[i] = true;
		const res = context.stateApp.pixiApplication?.renderer.resolution ?? 1;
		const world = Math.abs(root.parent?.worldTransform.a ?? 1) || 1;
		return pickLabelCap(renderPx * m * world * res);
	};

	const drawRail = () => {
		const R = POWER_METER.rail;
		const cap = capFor(R.cap);
		if (cap < 0) return;
		const k = (R.cap * m) / LABEL_CAPS[cap]; // master px per texel
		const ww = setText(railWord, POWER_METER.word, cap);
		const nw = setText(railNum, meterNumber(meterLive.shown), cap);
		const gap = LABEL_CAPS[cap] * R.gap;
		const total = ww + gap + nw;
		railWord.box.x = -total / 2 + ww / 2;
		railNum.box.x = -total / 2 + ww + gap + nw / 2;
		railBody.scale.set(k);
		// the plate: redrawn only when the row's width (the digit count) or the cap changes
		if (total !== laid.width || cap !== laid.cap) {
			laid.width = total;
			laid.cap = cap;
			const w = (total + LABEL_CAPS[cap] * R.padX * 2) * k;
			const h = LABEL_CAPS[cap] * (1 + R.padY * 2) * k;
			railPlate.clear();
			railPlate.roundRect(-w / 2, -h / 2, w, h, h * 0.22).fill({ color: R.plate, alpha: R.plateAlpha }).stroke({ color: R.rim, width: R.rimPx * m });
		}
		const c = map(R.u, R.v);
		rail.position.set(c.x, c.y);
		rail.scale.set(meterLive.pop);
	};

	const drawPost = () => {
		const P = POWER_METER.post;
		const capW = capFor(P.wordCap);
		const capN = capFor(P.numCap);
		if (capW < 0 || capN < 0) return;
		setText(postWord, POWER_METER.word, capW);
		const nw = setText(postNum, meterNumber(meterLive.shown), capN);
		// a number wider than the panel shrinks to it
		const fitN = Math.min(1, P.numMaxW / ((nw * P.numCap) / LABEL_CAPS[capN]));
		postWordBox.scale.set((P.wordCap * m) / LABEL_CAPS[capW]);
		const w = map(P.u, P.wordV);
		postWordBox.position.set(w.x, w.y);
		const n = map(P.u, P.numV);
		postNumBox.position.set(n.x, n.y);
		postNumBox.scale.set(((P.numCap * m) / LABEL_CAPS[capN]) * fitN * meterLive.pop);
		// the gauge: eight segments bottom up, one per 8 lit cells; redrawn only when the lit count changes
		const segs = Math.min(8, Math.floor(meterLive.lit / 8));
		if (segs !== laid.lit) {
			laid.lit = segs;
			// the panel's plate (over the sun emblem), drawn with the gauge
			const pa = map(P.u - P.plateW / 2, P.plateV - P.plateH / 2);
			const pb = map(P.u + P.plateW / 2, P.plateV + P.plateH / 2);
			postPlate.clear();
			postPlate.roundRect(pa.x, pa.y, pb.x - pa.x, pb.y - pa.y, (pb.x - pa.x) * 0.08).fill({ color: P.plate, alpha: P.plateAlpha }).stroke({ color: P.rim, width: 4 * m });
			gauge.clear();
			const top = map(P.gaugeU - P.gaugeW / 2, P.gaugeTop);
			const bot = map(P.gaugeU + P.gaugeW / 2, P.gaugeBottom);
			const gw = bot.x - top.x;
			const gapPx = P.segGap * m;
			const sh = (bot.y - top.y - gapPx * 7) / 8;
			for (let i = 0; i < 8; i += 1) {
				const y = bot.y - (i + 1) * sh - i * gapPx;
				gauge.roundRect(top.x, y, gw, sh, gw * 0.3).fill({ color: i < segs ? P.lit : P.unlit, alpha: i < segs ? 1 : 0.85 }).stroke({ color: P.rim, width: 4 * m });
			}
		}
	};

	const tick = () => {
		meterTick(performance.now());
		if (variant !== 'B' && variant !== 'D') return;
		const slot = boardPlaqueSlot.current;
		if (slot && root.parent !== slot) slot.addChild(root);
		const a = meterLive.alpha;
		root.visible = a > 0.001 && !context.stateGame.plaque;
		if (!root.visible) return;
		root.alpha = a;
		if (variant === 'B') drawRail();
		else drawPost();
	};

	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		ticker?.add(tick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			Object.assign(((window as any).__manticore ??= {}), {
				/** THE POWER METER MOCKUP: placement, on, the board's sum and lit count, what is drawn, alpha, pop */
				meter: () => ({ ...meterProbe(), bounds: root.visible ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(root.getBounds()) : null }),
			});
		}
		return () => {
			ticker?.remove(tick);
			root.removeFromParent();
			root.destroy({ children: true });
		};
	});
</script>
