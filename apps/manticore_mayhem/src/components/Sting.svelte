<script lang="ts">
	// THE STING OVERLAYS, r1 (constants STING_FX, STING.look; RULE_PASS_2 section F; the timing LOCKED Corey 2026-10-06
	// 10:36 is untouched). Corey 2026-10-17 20:27, on the harsh re-review: "We should redoo this one".
	//
	// Everything the player sees of a sting that is not the board cells themselves. The board engine
	// (stateGame.stingHit / stingBig) owns the cells (pop, flip, dim) and stamps one stingFx entry per struck cell
	// (game/featureFx.ts: when the tail lands, how long its trail runs, when the cell flips); this layer draws them on
	// the app ticker, raw Pixi, no Svelte in the frame:
	//   THE STRIKE   FROM THE BARB AS DRAWN: game/creature.ts tailTip gives the tip of his tail on the frame on show
	//                (STING_FX.tail), carried through his node's transform into the board's px each frame, so it holds
	//                in every layout (desktop in front of the board, phones and tablets behind it) and follows the tail
	//                as it whips. A tapered ribbon (the look's baked texture on a mesh whose vertices are rewritten) runs
	//                along a quadratic curve bowed upward from the barb to the cell, a bright dart and its glow at the
	//                head, particles shed along the way. r2 (Corey 2026-10-17 22:03): it LEAVES the barb at the bottom
	//                of the strike (sting_hit f6) and flies STING_FX.flightMs: normal, landing on the flip; big / super,
	//                landing on the strike beat (the charge's end), into the shape's centre. Scatter: over the whole
	//                wind-up, landing on the flip (r1)
	//   THE IMPACT   when the tail lands: a soft flash, the look's mark (a burnt crack, a venom splash or a gold
	//                starburst), a ring and thrown particles. Big / super: on the centre at the strike, and a smaller one
	//                on every other cell of the shape at the flip
	//   THE REVEAL   at the flip: rays turning behind the new wild (not on a scatter, which has its own landing ring)
	//   THE CHARGE   big / super, while the board dims: a glow at the centre breathing STING.chargeBeats times and
	//                growing, motes drawn in to it; the Super's larger, with more motes and slow rays behind
	//   THE RINGS    the big / super ripples at the flip (stingFx.rings without a colour) in the look's ring; the
	//                scatter landing rings (with a colour, stateGame.scatterRing) as before, a stroked circle over
	//                its soft glow
	// Normal < big < super step up in trail width, impact size and the charge (STING_FX.step).
	// THREE LOOKS behind STING.look (ember the default, venom, gold); DEV `__manticore.stingLook(name)` switches.
	// A Spine rig can still replace this file alone: the handler and the engine speak in kinds.
	//
	// House rules: always mounted at one z in the sorted board container (the conditional-mount trap), no filters, no
	// shaders, no masks. Every texture is baked once at mount (game/fxTexture.ts stingTextures, every look); every
	// sprite and mesh is pooled and built at mount; a frame moves transforms, alphas and the ribbons' vertices only and
	// allocates nothing. Inside the layer a node that is out sits at alpha 0 (no `visible` toggles: ClawSwipe's
	// lesson); only the layer itself toggles.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { quadOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, STING, STING_FX, STING_LOOKS, PLAYGROUND_PX, reelOf, rowOf, type StingLook } from '../game/constants';
	import { stingFx, clearStingFx, type StingStrikeFx } from '../game/featureFx';
	import { stingTextures, stingRingTexture, coreTexture, CORE_PX, raysTexture, RAYS_PX, emberTexture, EMBER_W, EMBER_H, type StingTextures } from '../game/fxTexture';
	import { creature } from '../game/creature';

	const context = getContext();
	const CELL = SYMBOL_SIZE;
	const K = PLAYGROUND_PX;
	const F = STING_FX;
	const TEX = F.tex;
	const SEG = Math.max(2, Math.round(F.trail.segments));
	const SHED = Math.max(0, Math.round(F.shed.count));
	/** the most particles one impact throws (the step's share of impact.particles, rounded) */
	const PARTS = Math.max(1, Math.round(F.impact.particles * Math.max(...Object.values(F.step).map((s) => s.particles))));
	const MOTES = Math.max(F.charge.big.motes, F.charge.super.motes);

	// pool sizes: four trails (a normal's shed tail overlapping the next wind-up), twelve impacts (a super's nine at
	// once and the spares), four shape ripples, eight scatter landing rings (one per column; past the pool: dropped)
	const TRAIL_POOL = 4;
	const IMPACT_POOL = 12;
	const SHAPE_RING_POOL = 4;
	const SCATTER_RING_POOL = 8;
	/** the under-tile layer's z in the board container (the tiles are at 0 and up; the roar's well flashes at -0.5) */
	const UNDER_Z = -0.4;

	const root = new PIXI.Container({ zIndex: 15, visible: false, label: 'sting' });
	getContextParent().addToParent(root);
	/** THE REVEAL'S RAYS go UNDER the tiles, on the cell well (ClawSwipe's roar flashes are at -0.5, just under this),
	 *  so they shine out round the new wild and never wash over it */
	const under = new PIXI.Container({ zIndex: UNDER_Z, visible: false, label: 'sting-under' });
	getContextParent().addToParent(under);

	// ---- the looks' textures, baked once now --------------------------------------------------------
	const texOf = Object.fromEntries(STING_LOOKS.map((l) => [l, stingTextures(l)])) as Record<StingLook, StingTextures>;
	const ringTex = stingRingTexture();
	const coreTex = coreTexture();
	const raysTex = raysTexture();
	const dartTex = emberTexture();
	let look: StingLook = STING.look;
	let builtLook: StingLook | null = null;

	const sprite = (tex: PIXI.Texture, parent: PIXI.Container) => {
		const s = new PIXI.Sprite(tex);
		s.anchor.set(0.5);
		s.blendMode = 'add';
		s.alpha = 0;
		parent.addChild(s);
		return s;
	};

	// the layers, bottom to top: (the reveal rays, under the tiles) ripples, marks, the charge, trails, flashes and particles
	const ringLayer = new PIXI.Container();
	const revealLayer = under;
	const markLayer = new PIXI.Container();
	const chargeLayer = new PIXI.Container();
	const trailLayer = new PIXI.Container();
	const topLayer = new PIXI.Container();
	root.addChild(ringLayer, markLayer, chargeLayer, trailLayer, topLayer);

	// ---- the trails --------------------------------------------------------------------------------
	const NV = (SEG + 1) * 2;
	const ribbonUvs = new Float32Array(NV * 2);
	const ribbonIdx = new Uint32Array(SEG * 6);
	for (let i = 0; i <= SEG; i += 1) {
		ribbonUvs.set([i / SEG, 0, i / SEG, 1], i * 4);
		if (i < SEG) ribbonIdx.set([2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2], i * 6);
	}
	type Trail = {
		mesh: PIXI.MeshSimple;
		verts: Float32Array;
		buf: PIXI.Buffer;
		glow: PIXI.Sprite;
		dart: PIXI.Sprite;
		shed: PIXI.Sprite[];
		/** each shed particle: where and when (style ms of its strike) it was dropped, its drift angle */
		sx: Float32Array;
		sy: Float32Array;
		st: Float32Array;
		sa: Float32Array;
		shedN: number;
		owner: StingStrikeFx | null;
		seen: boolean;
	};
	const trails: Trail[] = Array.from({ length: TRAIL_POOL }, () => {
		const mesh = new PIXI.MeshSimple({ texture: texOf[look].ribbon, vertices: new Float32Array(NV * 2), uvs: ribbonUvs.slice(), indices: ribbonIdx.slice() });
		mesh.autoUpdate = false;
		mesh.blendMode = 'add';
		mesh.alpha = 0;
		trailLayer.addChild(mesh);
		const shed = Array.from({ length: SHED }, () => sprite(texOf[look].particle, trailLayer));
		const glow = sprite(coreTex, trailLayer);
		const dart = sprite(dartTex, trailLayer);
		return { mesh, verts: mesh.vertices as Float32Array, buf: mesh.geometry.getBuffer('aPosition'), glow, dart, shed, sx: new Float32Array(SHED), sy: new Float32Array(SHED), st: new Float32Array(SHED), sa: new Float32Array(SHED), shedN: 0, owner: null, seen: false };
	});

	// ---- the impacts -------------------------------------------------------------------------------
	type Impact = {
		rays: PIXI.Sprite;
		mark: PIXI.Sprite;
		ring: PIXI.Sprite;
		core: PIXI.Sprite;
		parts: PIXI.Sprite[];
		/** per particle: direction (unit), speed share, life share; the mark's turn */
		pa: Float32Array;
		ps: Float32Array;
		pl: Float32Array;
		markRot: number;
		/** the way the tail came in (unit), for the splash's lean */
		dx: number;
		dy: number;
		owner: StingStrikeFx | null;
		seen: boolean;
	};
	const impacts: Impact[] = Array.from({ length: IMPACT_POOL }, () => {
		const rays = sprite(raysTex, revealLayer);
		const mark = sprite(texOf[look].mark, markLayer);
		const ring = sprite(ringTex, markLayer);
		const core = sprite(coreTex, topLayer);
		const parts = Array.from({ length: PARTS }, () => sprite(texOf[look].particle, topLayer));
		return { rays, mark, ring, core, parts, pa: new Float32Array(PARTS), ps: new Float32Array(PARTS), pl: new Float32Array(PARTS), markRot: 0, dx: -1, dy: 0, owner: null, seen: false };
	});

	// ---- the charge and the ripples ----------------------------------------------------------------
	const chargeRays = sprite(raysTex, chargeLayer);
	const chargeGlow = sprite(coreTex, chargeLayer);
	const motes = Array.from({ length: MOTES }, () => sprite(texOf[look].particle, chargeLayer));
	const shapeRings = Array.from({ length: SHAPE_RING_POOL }, () => sprite(ringTex, ringLayer));
	const scatterRings = Array.from({ length: SCATTER_RING_POOL }, () => {
		const g = new PIXI.Graphics();
		g.alpha = 0;
		ringLayer.addChild(g);
		return g;
	});

	/** a look's textures onto every pooled node that shows them (at mount and on a DEV switch, never mid frame) */
	const applyLook = () => {
		if (builtLook === look) return;
		builtLook = look;
		const T = texOf[look];
		const L = F.looks[look];
		for (const t of trails) {
			t.mesh.texture = T.ribbon;
			for (const s of t.shed) {
				s.texture = T.particle;
				s.tint = L.shedTint;
			}
			t.glow.tint = L.headGlow;
			t.dart.tint = L.head;
		}
		for (const m of impacts) {
			m.mark.texture = T.mark;
			m.ring.tint = L.ring;
			m.core.tint = L.flash;
			m.rays.tint = L.rays;
			for (const s of m.parts) {
				s.texture = T.particle;
				s.tint = L.particleTint;
			}
		}
		for (const s of motes) {
			s.texture = T.particle;
			s.tint = L.particleTint;
		}
		chargeGlow.tint = L.charge;
		chargeRays.tint = L.rays;
		for (const s of shapeRings) s.tint = L.ring;
	};
	applyLook();

	const cx = (cell: number) => (reelOf(cell) + 0.5) * CELL;
	const cy = (cell: number) => (rowOf(cell) + 0.5) * CELL;
	const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
	/** a little overshoot on the way in (the mark's pop) */
	const backOut = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
	/** a hash in [0, 1) for a cell, a strike count and an index (the particles' spread, the same every replay) */
	const hash = (a: number, b: number) => {
		const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
		return x - Math.floor(x);
	};

	// ---- the barb, once a frame --------------------------------------------------------------------
	const tipLocal = new PIXI.Point();
	const tail = new PIXI.Point();
	/** the barb's tip in board px this frame: from his node when he is on screen, else the old fixed origin */
	const readTail = () => {
		if (creature.tailTip(tipLocal)) {
			root.toLocal(tipLocal, creature.bodyNode, tail);
			if (Number.isFinite(tail.x) && Number.isFinite(tail.y)) return true;
		}
		tail.set(F.tail.fallback.x * CELL, F.tail.fallback.y * CELL);
		return false;
	};

	/** the strike's curve from the barb (p0) to the cell (p2), bowed upward: its control point into c1 */
	let c1x = 0;
	let c1y = 0;
	const bow = (x0: number, y0: number, x2: number, y2: number) => {
		const dx = x2 - x0;
		const dy = y2 - y0;
		const len = Math.hypot(dx, dy) || 1;
		// the normal that points up the screen (on a level strike: up; straight down: to the right)
		let nx = -dy / len;
		let ny = dx / len;
		if (ny > 0 || (ny === 0 && nx < 0)) {
			nx = -nx;
			ny = -ny;
		}
		c1x = (x0 + x2) / 2 + nx * F.trail.bend * len;
		c1y = (y0 + y2) / 2 + ny * F.trail.bend * len;
	};
	const bz = (a: number, b: number, c: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
	const bzd = (a: number, b: number, c: number, t: number) => 2 * (1 - t) * (b - a) + 2 * t * (c - b);

	/** DEV probe counters: overlays drawn this frame and the most at once, the slowest frame */
	const stats = { flashes: 0, streaks: 0, rings: 0, shapeRings: 0, telegraph: 0, dropped: 0, trails: 0, impacts: 0, particles: 0, drawMs: 0, tail: 0, fallback: 0, look: look as string, trailsNow: 0, impactsNow: 0 };
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		Object.assign(((window as any).__manticore ??= {}), {
			stingOverlays: () => ({ ...stats, look }),
			/** DEV (sting r1): draw the strike in one of the three looks; returns the look in use */
			stingLook: (name?: StingLook) => {
				if (name && (STING_LOOKS as readonly string[]).includes(name)) look = name;
				return look;
			},
			/** DEV (sting r1): the barb's tip in board px this frame and whether it came from his drawn frame */
			stingTail: () => {
				const fromHim = readTail();
				return { x: +tail.x.toFixed(1), y: +tail.y.toFixed(1), fromHim, board: { w: CELL * 8, h: CELL * 8 } };
			},
		});
	}

	let shown = false;
	const hideAll = () => {
		for (const t of trails) {
			t.owner = null;
			t.mesh.alpha = t.glow.alpha = t.dart.alpha = 0;
			for (const s of t.shed) s.alpha = 0;
		}
		for (const m of impacts) {
			m.owner = null;
			m.rays.alpha = m.mark.alpha = m.ring.alpha = m.core.alpha = 0;
			for (const s of m.parts) s.alpha = 0;
		}
		chargeGlow.alpha = chargeRays.alpha = 0;
		for (const s of motes) s.alpha = 0;
		for (const s of shapeRings) s.alpha = 0;
		for (const g of scatterRings) g.alpha = 0;
		root.visible = false;
		under.visible = false;
		shown = false;
	};

	const trailFor = (st: StingStrikeFx) => {
		for (const t of trails) if (t.owner === st) return t;
		for (const t of trails) {
			if (!t.owner) {
				t.owner = st;
				t.shedN = 0;
				return t;
			}
		}
		return null;
	};
	let serial = 0;
	const impactFor = (st: StingStrikeFx) => {
		if (st.slot != null && impacts[st.slot]?.owner === st) return impacts[st.slot];
		for (let i = 0; i < IMPACT_POOL; i += 1) {
			const m = impacts[i];
			if (m.owner) continue;
			m.owner = st;
			st.slot = i;
			serial += 1;
			for (let j = 0; j < PARTS; j += 1) {
				const a = ((j + hash(st.cell, serial + j)) / PARTS) * Math.PI * 2;
				m.pa[j] = a;
				m.ps[j] = 0.55 + 0.45 * hash(serial, j + 17);
				m.pl[j] = 0.65 + 0.35 * hash(j + 5, serial);
			}
			m.markRot = hash(st.cell, serial) * Math.PI * 2;
			return m;
		}
		return null;
	};

	/** one particle's place after `age` style ms (s), thrown at speed v (cells / s) along (ux, uy): drag, then gravity */
	let px = 0;
	let py = 0;
	let pvx = 0;
	let pvy = 0;
	const fly = (ux: number, uy: number, v: number, s: number, g: number, k: number) => {
		const e = Math.exp(-k * s);
		const d = k > 0 ? (1 - e) / k : s;
		px = ux * v * d * CELL;
		py = (uy * v * d + 0.5 * g * s * s) * CELL;
		pvx = ux * v * e;
		pvy = uy * v * e + g * s;
	};

	const tick = () => {
		if (context.stateGame.skipping) {
			// SKIP TO RESULT: the engine applies the symbol change; the overlays have nothing to show
			clearStingFx();
			if (shown) hideAll();
			return;
		}
		const ch = stingFx.charge;
		if (!ch && !stingFx.strikes.length && !stingFx.rings.length) {
			stats.trailsNow = stats.impactsNow = 0;
			if (shown) hideAll();
			return;
		}
		const d0 = performance.now();
		applyLook();
		if (!shown) root.visible = under.visible = true;
		shown = true;
		const now = performance.now();
		const L = F.looks[look];
		const T = texOf[look];
		const fromHim = readTail();
		for (const t of trails) t.seen = false;
		for (const m of impacts) m.seen = false;
		let nTrails = 0;
		let nImpacts = 0;
		let nParts = 0;
		let telegraph = 0;

		// ---- the charge: the centre glow breathing and growing, the motes drawn in ----
		let chargeOn = false;
		if (ch && ch.kind !== 'scatter') {
			const el = (now - ch.t0) * ch.rate;
			if (el >= ch.dur) stingFx.charge = null;
			else if (el >= 0) {
				chargeOn = true;
				telegraph = 1;
				const C = F.charge[ch.kind];
				const u = el / ch.dur;
				const pulse = Math.max(0, Math.sin(u * Math.PI * STING.chargeBeats));
				const x = cx(ch.centre);
				const y = cy(ch.centre);
				const grow = 0.35 + 0.65 * u;
				chargeGlow.position.set(x, y);
				chargeGlow.scale.set(((C.glowCells * CELL) / CORE_PX) * grow * (0.85 + 0.15 * pulse));
				chargeGlow.alpha = F.charge.glowAlpha * grow * (0.6 + 0.4 * pulse);
				// the super's slow rays behind it
				if (ch.kind === 'super') {
					chargeRays.position.set(x, y);
					chargeRays.scale.set(((C.radiusCells * 2 * CELL) / RAYS_PX) * (0.6 + 0.4 * u));
					chargeRays.rotation = u * 1.4;
					chargeRays.alpha = 0.4 * u * (0.7 + 0.3 * pulse);
				} else chargeRays.alpha = 0;
				const fadeIn = clamp01(el / 220);
				for (let j = 0; j < MOTES; j += 1) {
					const s = motes[j];
					if (j >= C.motes) {
						s.alpha = 0;
						continue;
					}
					const age = (el / F.charge.moteMs + j / C.motes) % 1;
					const ang = j * 2.39996 + age * 0.9;
					const r = C.radiusCells * CELL * (1 - age * age) + 0.1 * CELL;
					s.position.set(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
					s.rotation = ang + Math.PI;
					const size = (F.charge.moteCells * CELL * (0.7 + 0.6 * u)) / T.particleW;
					s.scale.set(size);
					s.alpha = Math.sin(Math.PI * age) * fadeIn * (0.55 + 0.45 * u);
				}
			}
		}
		if (!chargeOn) {
			if (chargeGlow.alpha) chargeGlow.alpha = 0;
			if (chargeRays.alpha) chargeRays.alpha = 0;
			for (const s of motes) if (s.alpha) s.alpha = 0;
		}

		// ---- the struck cells ----
		for (let i = stingFx.strikes.length - 1; i >= 0; i -= 1) {
			const st = stingFx.strikes[i];
			const el = (now - st.t0) * st.rate;
			const flipMs = st.hitAt * st.dur;
			const strikeMs = st.strikeMs ?? flipMs;
			const trailMs = st.trailMs ?? (st.streak ? strikeMs : 0);
			const shape = st.kind === 'big' || st.kind === 'super';
			const step = F.step[st.kind];
			// the centre of a shape (and every single sting) takes the impact when the tail lands; the shape's other cells
			// take a smaller one at the flip
			const impactAt = shape && !st.centre ? flipMs : strikeMs;
			const imp = shape && !st.centre ? step.cell : step.impact;
			const rev = st.kind === 'scatter' ? 0 : shape && st.centre ? step.impact * 0.6 : step.cell;
			const end = Math.max(st.dur, impactAt + Math.max(F.impact.markMs, F.impact.particleMs, F.impact.ringMs), rev > 0 ? flipMs + F.reveal.revealMs : 0, trailMs > 0 ? strikeMs + F.shed.lifeMs + F.trail.collapseMs : 0);
			if (el >= end) {
				stingFx.strikes.splice(i, 1);
				continue;
			}
			if (el < strikeMs - trailMs) continue; // a big / super's shape, still charging
			const x2 = cx(st.cell);
			const y2 = cy(st.cell);

			// THE TRAIL: from the barb into the cell, landing on strikeMs
			if (trailMs > 0) {
				const t = trailFor(st);
				if (!t) stats.dropped += 1;
				else {
					t.seen = true;
					nTrails += 1;
					const x0 = tail.x;
					const y0 = tail.y;
					bow(x0, y0, x2, y2);
					const tw = step.trail;
					const v = (el - (strikeMs - trailMs)) / trailMs;
					let a: number;
					let b: number;
					let fade = 1;
					if (v < 1) {
						a = Math.pow(clamp01(v), F.trail.ease);
						b = Math.max(0, a - F.trail.length);
					} else {
						// landed: the ribbon draws itself into the cell and is gone
						const w = clamp01((el - strikeMs) / Math.max(F.trail.collapseMs, 1));
						a = 1;
						b = 1 - F.trail.length + F.trail.length * w;
						fade = 1 - w;
					}
					if (fade > 0 && a - b > 1e-3) {
						const W = (F.trail.widthCells * CELL * tw) / 2;
						const V = t.verts;
						for (let k = 0; k <= SEG; k += 1) {
							const s = k / SEG;
							const tt = b + (a - b) * s;
							const x = bz(x0, c1x, x2, tt);
							const y = bz(y0, c1y, y2, tt);
							let dx = bzd(x0, c1x, x2, tt);
							let dy = bzd(y0, c1y, y2, tt);
							const dl = Math.hypot(dx, dy) || 1;
							dx /= dl;
							dy /= dl;
							const hw = W * (F.trail.tailWidth + (1 - F.trail.tailWidth) * Math.pow(s, F.trail.taper));
							V[k * 4] = x - dy * hw;
							V[k * 4 + 1] = y + dx * hw;
							V[k * 4 + 2] = x + dy * hw;
							V[k * 4 + 3] = y - dx * hw;
						}
						t.buf.update();
						t.mesh.alpha = fade;
					} else t.mesh.alpha = 0;
					// the head: the dart along the curve and its glow, while it flies
					if (v < 1) {
						const hx = bz(x0, c1x, x2, a);
						const hy = bz(y0, c1y, y2, a);
						const ang = Math.atan2(bzd(y0, c1y, y2, a), bzd(x0, c1x, x2, a));
						const hs = (F.trail.headCells * CELL * tw) / EMBER_W;
						t.dart.position.set(hx, hy);
						t.dart.rotation = ang;
						t.dart.scale.set(hs, (hs * EMBER_W) / EMBER_H / 2.6);
						t.dart.alpha = F.trail.headAlpha * clamp01(v * 6);
						t.glow.position.set(hx, hy);
						t.glow.scale.set(((F.trail.headGlowCells * CELL * tw) / CORE_PX) * (0.7 + 0.3 * a));
						t.glow.alpha = 0.85 * clamp01(v * 4);
						// impact direction for the splash's lean
						if (st.slot != null && impacts[st.slot]?.owner === st) {
							impacts[st.slot].dx = Math.cos(ang);
							impacts[st.slot].dy = Math.sin(ang);
						}
						// shed particles as the head passes their place on the curve
						while (t.shedN < SHED && a >= ((t.shedN + 0.5) / SHED) * 0.95) {
							const tt = ((t.shedN + 0.5) / SHED) * 0.95;
							t.sx[t.shedN] = bz(x0, c1x, x2, tt);
							t.sy[t.shedN] = bz(y0, c1y, y2, tt);
							t.st[t.shedN] = el;
							t.sa[t.shedN] = hash(st.cell, t.shedN) * Math.PI * 2;
							t.shedN += 1;
						}
					} else {
						t.dart.alpha = 0;
						t.glow.alpha = 0;
					}
					// the shed particles: drift and fade
					for (let k = 0; k < SHED; k += 1) {
						const s = t.shed[k];
						const age = k < t.shedN ? el - t.st[k] : -1;
						if (age < 0 || age >= F.shed.lifeMs) {
							s.alpha = 0;
							continue;
						}
						const q = age / F.shed.lifeMs;
						const sec = age / 1000;
						const ux = Math.cos(t.sa[k]);
						const uy = Math.sin(t.sa[k]);
						fly(ux, uy, 0.45, sec, L.gravity * 0.5, L.drag);
						s.position.set(t.sx[k] + px, t.sy[k] + py + L.shedDrift * sec * CELL);
						const size = (F.shed.sizeCells * CELL * Math.sqrt(tw) * (1 - 0.5 * q)) / T.particleW;
						if (L.particle === 'glint') {
							s.rotation = t.sa[k] + q * 2;
							s.scale.set(size);
							s.alpha = (1 - q) * (0.55 + 0.45 * Math.sin(age * 0.05 + k));
						} else {
							s.rotation = Math.atan2(pvy + L.shedDrift, pvx);
							s.scale.set(size, L.particle === 'drop' ? size * 0.75 : size);
							s.alpha = Math.pow(1 - q, 1.3);
						}
						nParts += 1;
					}
				}
			}

			// THE IMPACT and THE REVEAL
			if (el < Math.min(impactAt, flipMs) && !(trailMs > 0 && el >= strikeMs - trailMs)) continue;
			const m = impactFor(st);
			if (!m) {
				stats.dropped += 1;
				continue;
			}
			m.seen = true;
			if (!(trailMs > 0) && shape) {
				// a shape's other cells: the shock comes out from the centre
				m.dx = 0;
				m.dy = 1;
			}
			const since = el - impactAt;
			let live = false;
			// the flash
			if (since >= 0 && since < F.impact.flashMs) {
				const v = since / F.impact.flashMs;
				m.core.position.set(x2, y2);
				const fk = shape && !st.centre ? F.impact.shapeFlash : 1;
				m.core.scale.set(((F.impact.flashCells * CELL * imp * fk) / CORE_PX) * (0.35 + 0.65 * quadOut(v)));
				m.core.alpha = F.impact.flashAlpha * Math.min(1, fk * 1.5) * Math.pow(1 - v, 1.5);
				live = true;
			} else m.core.alpha = 0;
			// the mark: pops in, holds, fades
			if (since >= 0 && since < F.impact.markMs) {
				const inV = clamp01(since / Math.max(F.impact.markInMs, 1));
				const out = since < F.impact.markInMs ? 0 : (since - F.impact.markInMs) / Math.max(F.impact.markMs - F.impact.markInMs, 1);
				m.mark.position.set(x2, y2);
				m.mark.scale.set(((F.impact.markCells * CELL * imp) / TEX.markPx) * (0.55 + 0.45 * backOut(inV)));
				m.mark.rotation = m.markRot + (L.mark === 'burst' ? 0.5 * (since / F.impact.markMs) : 0);
				m.mark.alpha = F.impact.markAlpha * (1 - Math.pow(out, 1.6));
				live = true;
			} else m.mark.alpha = 0;
			// the ring
			if (since >= 0 && since < F.impact.ringMs) {
				const v = since / F.impact.ringMs;
				m.ring.position.set(x2, y2);
				m.ring.scale.set(((F.impact.ringCells * CELL * imp) / TEX.ringPx) * (0.25 + 0.75 * quadOut(v)));
				m.ring.alpha = F.impact.ringAlpha * (1 - v);
				live = true;
			} else m.ring.alpha = 0;
			// the particles
			const np = Math.min(PARTS, Math.round(F.impact.particles * step.particles * (shape && !st.centre ? 0.5 : 1)));
			for (let j = 0; j < PARTS; j += 1) {
				const s = m.parts[j];
				const life = F.impact.particleMs * m.pl[j];
				if (j >= np || since < 0 || since >= life) {
					s.alpha = 0;
					continue;
				}
				const q = since / life;
				const ux = Math.cos(m.pa[j]);
				const uy = Math.sin(m.pa[j]);
				// the splash leans the way the tail came in
				const lean = 1 + 0.6 * Math.max(0, ux * m.dx + uy * m.dy);
				fly(ux, uy, F.impact.speedCells * m.ps[j] * lean * Math.sqrt(imp), since / 1000, L.gravity, L.drag);
				s.position.set(x2 + px, y2 + py);
				const size = (F.impact.particleCells * CELL * Math.sqrt(imp) * (1 - 0.4 * q)) / T.particleW;
				if (L.particle === 'glint') {
					s.rotation = m.pa[j] + q * 3;
					s.scale.set(size);
					s.alpha = (1 - q) * (0.6 + 0.4 * Math.sin(since * 0.04 + j * 1.7));
				} else {
					const sp = Math.hypot(pvx, pvy);
					s.rotation = Math.atan2(pvy, pvx);
					const stretch = L.particle === 'drop' ? 1 + Math.min(1.5, sp * 0.25) : 1;
					s.scale.set(size * stretch, L.particle === 'drop' ? size * 0.8 : size);
					s.alpha = Math.pow(1 - q, 1.2);
				}
				nParts += 1;
				live = true;
			}
			// the reveal: rays turning behind the new wild
			const sinceFlip = el - flipMs;
			if (rev > 0 && sinceFlip >= 0 && sinceFlip < F.reveal.revealMs) {
				const v = sinceFlip / F.reveal.revealMs;
				m.rays.position.set(x2, y2);
				m.rays.scale.set(((F.reveal.raysCells * CELL * rev) / RAYS_PX) * (0.5 + 0.6 * quadOut(v)));
				m.rays.rotation = m.markRot + F.reveal.spin * v;
				m.rays.alpha = F.reveal.raysAlpha * (v < 0.12 ? v / 0.12 : Math.pow(1 - (v - 0.12) / 0.88, 1.4));
				live = true;
			} else m.rays.alpha = 0;
			if (live) nImpacts += 1;
		}

		// ---- the ripples: a big / super shape's in the look's ring, a scatter's landing ring as before ----
		let nsr = 0;
		let ngr = 0;
		for (let i = stingFx.rings.length - 1; i >= 0; i -= 1) {
			const r = stingFx.rings[i];
			const el = (now - r.t0) * r.rate;
			if (el >= r.dur) {
				stingFx.rings.splice(i, 1);
				continue;
			}
			if (el < 0) continue;
			const u = el / r.dur;
			const r0 = r.from ?? 0.2;
			const rad = CELL * (r0 + (r.reach - r0) * quadOut(u));
			const x = cx(r.centre);
			const y = cy(r.centre);
			if (r.color == null) {
				if (nsr >= SHAPE_RING_POOL) {
					stats.dropped += 1;
					continue;
				}
				const s = shapeRings[nsr++];
				s.position.set(x, y);
				// the texture's band sits at 0.82 of its radius
				s.scale.set((2 * rad) / 0.82 / TEX.ringPx);
				s.alpha = F.shapeRingAlpha * (1 - u);
				continue;
			}
			if (ngr >= SCATTER_RING_POOL) {
				stats.dropped += 1;
				continue;
			}
			const g = scatterRings[ngr++];
			const w = (r.px * (1 - 0.6 * u) + 1) * K;
			// the playground's shapeRing: the ring in its colour over its soft glow (canvas shadowBlur 10, here a wider
			// faint stroke)
			g.clear()
				.circle(x, y, rad).stroke({ color: r.color, width: w + 10 * K, alpha: 0.3 })
				.circle(x, y, rad).stroke({ color: r.color, width: w });
			g.alpha = 1 - u;
		}
		for (let i = nsr; i < SHAPE_RING_POOL; i += 1) if (shapeRings[i].alpha) shapeRings[i].alpha = 0;
		for (let i = ngr; i < SCATTER_RING_POOL; i += 1) if (scatterRings[i].alpha) scatterRings[i].alpha = 0;

		// let go of what no strike drew this frame
		for (const t of trails) {
			if (t.seen || !t.owner) continue;
			t.owner = null;
			t.mesh.alpha = t.glow.alpha = t.dart.alpha = 0;
			for (const s of t.shed) s.alpha = 0;
		}
		for (const m of impacts) {
			if (m.seen || !m.owner) continue;
			if (stingFx.strikes.includes(m.owner)) {
				// still waiting for its beat (a shape cell before the flip): keep the slot, show nothing
				m.rays.alpha = m.mark.alpha = m.ring.alpha = m.core.alpha = 0;
				for (const s of m.parts) s.alpha = 0;
				continue;
			}
			m.owner = null;
			m.rays.alpha = m.mark.alpha = m.ring.alpha = m.core.alpha = 0;
			for (const s of m.parts) s.alpha = 0;
		}

		// (sting r2) this frame's own counts, for a probe timing the launch against his frames
		stats.trailsNow = nTrails;
		stats.impactsNow = nImpacts;
		stats.trails = Math.max(stats.trails, nTrails);
		stats.streaks = Math.max(stats.streaks, nTrails);
		stats.impacts = Math.max(stats.impacts, nImpacts);
		stats.flashes = Math.max(stats.flashes, nImpacts);
		stats.particles = Math.max(stats.particles, nParts);
		stats.rings = Math.max(stats.rings, ngr);
		stats.shapeRings = Math.max(stats.shapeRings, nsr);
		stats.telegraph = Math.max(stats.telegraph, telegraph);
		if (nTrails) {
			if (fromHim) stats.tail += 1;
			else stats.fallback += 1;
		}
		stats.drawMs = Math.max(stats.drawMs, performance.now() - d0);
	};

	onMount(() => {
		const app = context.stateApp.pixiApplication;
		const ticker = app?.ticker;
		// the baked textures' uploads now, not on the first strike's frame
		try {
			const r = (app?.renderer as any)?.texture;
			if (r?.initSource) for (const l of STING_LOOKS) for (const t of [texOf[l].ribbon, texOf[l].mark, texOf[l].particle]) r.initSource(t.source);
			if (r?.initSource) for (const t of [ringTex, coreTex, raysTex, dartTex]) r.initSource(t.source);
		} catch {
			/* first draw uploads them */
		}
		ticker?.add(tick);
		return () => {
			ticker?.remove(tick);
			if (import.meta.env.DEV && typeof window !== 'undefined') {
				delete (window as any).__manticore?.stingLook;
				delete (window as any).__manticore?.stingTail;
			}
			// the parent's unmount destroys root without its children; the baked textures are shared and kept
			root.destroy({ children: true });
			under.destroy({ children: true });
		};
	});
</script>
