<script lang="ts">
	// THE BOARD FRAME, THE BLACK BACKING AND THE CHAINS (board_v4e renders, tools/build_board_layers.py).
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
	import { BOARD_BACKING, BOARD_SIZES, CHAIN_BOW, FRAME_ART, PLAYGROUND_PX, SYMBOL_SIZE } from '../game/constants';
	import { boardKick } from '../game/featureFx';

	const context = getContext();
	const parent = getContextParent();

	// ---- the scene graph (built once) -----------------------------------------------------------
	const under = new PIXI.Container({ zIndex: -1 });
	const frameSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
	frameSprite.visible = false;
	// FRAME_ART: the art is too bright on screen; a tint until the darker re-render (constants.ts)
	frameSprite.tint = FRAME_ART.tint;
	const backing = new PIXI.Graphics();
	// the black first, then the frame: the lattice and the rails draw OVER the backing, the tiles over both
	under.addChild(backing, frameSprite);

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
	type Strip = { mesh: PIXI.MeshSimple; rest: Float32Array; s: Float32Array; bow: Float32Array };
	const strips = {} as Record<Side, Strip>;
	for (const side of SIDES) {
		const mesh = new PIXI.MeshSimple({
			texture: PIXI.Texture.WHITE,
			vertices: new Float32Array(ROWS * 2 * 2),
			uvs: new Float32Array(ROWS * 2 * 2),
			indices: indices.slice(),
		});
		mesh.autoUpdate = false;
		mesh.visible = false;
		mesh.tint = FRAME_ART.chainTint;
		chains.addChild(mesh);
		strips[side] = { mesh, rest: new Float32Array(ROWS * 2 * 2), s: new Float32Array(ROWS), bow: new Float32Array(ROWS) };
	}

	parent.addToParent(under);
	parent.addToParent(chains);

	// ---- layout -------------------------------------------------------------------------------
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const vw = $derived(context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale);
	const reg = $derived(boardRegistration(kind, vw));
	const boardScale = $derived(context.stateGameDerived.boardLayout().scale);
	const textures = $derived.by(() => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		return { frame: assets?.[`boardFrame_${kind}`], chains: assets?.[`boardChains_${kind}`] };
	});

	/** plain copies the ticker reads (no reactive reads in the frame) */
	let scale = 1;
	/** master px per playground px for this layout (the chain spring runs in playground px) */
	let pg = 1;
	let chainsReady = false;

	/** lay the chain strips out for a layout: rest vertices in master units and the uvs */
	const layoutStrips = (k: LayoutKind, map: (u: number, v: number) => { x: number; y: number }, tex: PIXI.Texture) => {
		const spec = BOARD_ART.chains[k];
		const [TW, TH] = spec.tex;
		for (const side of SIDES) {
			const part = spec[side];
			const anchor = BOARD_ART.anchors[side];
			const top = anchor.top[1];
			const run = anchor.bottom[1] - top;
			const [cx, cy] = part.crop;
			const [bw, bh] = part.size;
			const st = strips[side];
			const uvs = st.mesh.geometry.getBuffer('aUV').data as Float32Array;
			for (let r = 0; r < ROWS; r += 1) {
				// source y of the row: the texture's top, then the pivot rows, then the texture's bottom
				const v = r === 0 ? cy : r === ROWS - 1 ? cy + bh : Math.max(cy, top + (run * (r - 1)) / CHAIN_BOW.segments);
				const s = (v - top) / run;
				st.s[r] = s;
				st.bow[r] = chainBow(s, CHAIN_BOW.bottomAllowance);
				const p0 = map(cx, v);
				const p1 = map(cx + bw, v);
				st.rest.set([p0.x, p0.y, p1.x, p1.y], r * 4);
				const tv = ((v - cy) / bh) * (part.tex[1] / TH);
				uvs.set([part.texX / TW, tv, (part.texX + part.tex[0]) / TW, tv], r * 4);
			}
			st.mesh.texture = tex;
			st.mesh.geometry.getBuffer('aUV').update();
			(st.mesh.vertices as Float32Array).set(st.rest);
			st.mesh.geometry.getBuffer('aPosition').update();
			st.mesh.visible = true;
		}
	};

	$effect(() => {
		const r = reg;
		const k = kind;
		const t = textures;
		scale = boardScale;
		pg = boardScale * PLAYGROUND_PX;
		// the backing: the frame's inner opening (cell area plus the inset)
		backing.clear().rect(r.opening.x, r.opening.y, r.opening.width, r.opening.height).fill(BOARD_BACKING.color);
		// the frame: its crop origin in render px through the registration, texture px -> master
		const fs = BOARD_ART.frame[k];
		if (t.frame) {
			frameSprite.texture = t.frame;
			const o = r.map(fs.crop[0], fs.crop[1]);
			frameSprite.position.set(o.x, o.y);
			frameSprite.scale.set((r.m * fs.size[0]) / fs.tex[0], (r.m * fs.size[1]) / fs.tex[1]);
			frameSprite.visible = true;
		} else frameSprite.visible = false;
		if (t.chains) {
			layoutStrips(k, r.map, t.chains);
			chainsReady = true;
			dirty = true;
		} else {
			chainsReady = false;
			for (const side of SIDES) strips[side].mesh.visible = false;
		}
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
	const tick = (ticker: PIXI.Ticker) => {
		const kx = boardKick.x * scale;
		const ky = boardKick.y * scale;
		if (kx !== ukx || ky !== uky) {
			ukx = kx;
			uky = ky;
			under.position.set(kx, ky);
			dirty = true;
		}
		if (!chainsReady) return;
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
		if (!dirty) return;
		dirty = false;
		// point(s) = anchor(s) + kick + (D - kick) bow(s), D = (0.6 d, vertical d), all master px. With
		// endsFollowFrame the anchors ride the kick; otherwise they stay put and only D bends the run.
		const follow = CHAIN_BOW.endsFollowFrame ? 1 : 0;
		const Dx = 0.6 * bow.d * pg;
		const Dy = CHAIN_BOW.vertical * bow.d * pg;
		const ex = kx * follow;
		const ey = ky * follow;
		for (const side of SIDES) {
			const st = strips[side];
			const v = st.mesh.vertices as Float32Array;
			for (let r = 0; r < ROWS; r += 1) {
				const b = st.bow[r];
				const o = r * 4;
				const ox = ex + (Dx - ex) * b;
				const oy = ey + (Dy - ey) * b;
				v[o] = st.rest[o] + ox;
				v[o + 1] = st.rest[o + 1] + oy;
				v[o + 2] = st.rest[o + 2] + ox;
				v[o + 3] = st.rest[o + 3] + oy;
			}
			st.mesh.geometry.getBuffer('aPosition').update();
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
						visible: st.mesh.visible && chains.visible,
					};
				}
				return {
					kind: k,
					ready: { frame: frameSprite.visible, chains: chainsReady },
					/** the art container's children, bottom to top */
					underOrder: under.children.map((c) => (c === backing ? 'backing' : c === frameSprite ? 'frame' : 'other')),
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
					/** the spring, master px: low-passed kick, displacement, velocity per style ms */
					/** the spring in playground px (k, lagged k, d, d' per s); pg = master px per playground px */
					bow: { ...bow, atRest, pg },
					chains: chainOut,
					zOrder: parent.parent.children.map((c) => (c === under ? 'frame+backing' : c === chains ? 'chains' : c === boardNode ? 'board' : c.label || 'other') + '@' + c.zIndex),
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
