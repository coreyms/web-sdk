<script lang="ts" module>
	export type BrandedPhase = 'enter' | 'idle' | 'exit';
	export type BrandedEntrance = 'slam' | 'flap';
</script>

<script lang="ts">
	// Title text set from Corey's branded (rusty-metal) glyph atlas, one sprite per letter, so the
	// whole word can move letter by letter. Chosen in the motion lab 2026-09-05:
	//   entrance  "slam and settle" — letters drop in left→right and land with a squash; a
	//             "flap" entrance (split-flap board) is what an upgraded tier flips in with
	//   idle      per-tier wave / rotation / pulse / shake bursts and a periodic glint sweep
	//   exit      split-flap: each letter folds to zero height in turn
	//   glow      (ON THE MENU) an additive warm copy of each letter pulsing with a per-letter
	//             ripple, plus a pre-blurred halo frame; a flash-off when the glow is cut
	// `tier` (0-4) scales every amplitude — BIG is gentle, MAX is barely contained. Everything here
	// is a container transform or a second sprite with blendMode 'add': no filters, no text raster.
	import { Container, Sprite, BaseSprite } from 'pixi-svelte';

	import { BR_GLYPHS, BR_CAP_H, BR_SET, BR_HALO_PAD } from '../game/brandedGlyphs';
	import { shadowTexture } from '../game/shadowTexture';

	type Props = {
		lines: string[];
		height: number; // cap height in master px
		maxWidth?: number; // shrink-to-fit
		lineGap?: number; // master px between lines (default 0.16 × height)
		x?: number;
		y?: number;
		tier?: number;
		phase?: BrandedPhase;
		entrance?: BrandedEntrance;
		enterDelay?: number;
		glint?: boolean;
		glow?: boolean;
		backdrop?: boolean; // soft dark blob behind the letters so they separate from busy art
		onsettled?: () => void;
		onexited?: () => void;
	};
	const {
		lines,
		height,
		maxWidth,
		lineGap,
		x = 0,
		y = 0,
		tier = 0,
		phase = 'idle',
		entrance = 'slam',
		enterDelay = 0,
		glint = false,
		glow = false,
		backdrop = false,
		onsettled,
		onexited,
	}: Props = $props();

	// ---- layout (atlas px → master px) ----
	type Cell = { ch: string; f: string; w: number; h: number; desc: number; cx: number; by: number; i: number; z: number; line: number };
	const layout = $derived.by(() => {
		const rows = lines.map((text) => {
			const items: { ch: string; x: number; g: (typeof BR_GLYPHS)[string] }[] = [];
			let cursor = 0;
			for (const ch of text) {
				if (ch === ' ') {
					cursor += BR_SET.gap;
					continue;
				}
				const g = BR_GLYPHS[ch];
				if (!g) continue;
				items.push({ ch, x: cursor, g });
				cursor += g.w - BR_SET.overlap;
			}
			const asc = Math.max(...items.map((i) => i.g.asc));
			const desc = Math.max(...items.map((i) => i.g.desc));
			const w = Math.max(...items.map((i) => i.x + i.g.w));
			return { items, asc, desc, w };
		});
		let s = height / BR_CAP_H;
		const widest = Math.max(...rows.map((r) => r.w)) * s;
		if (maxWidth && widest > maxWidth) s *= maxWidth / widest;
		const gap = lineGap ?? height * 0.16;
		const total = rows.reduce((acc, r) => acc + (r.asc + r.desc) * s, 0) + gap * (rows.length - 1);
		const cells: Cell[] = [];
		let top = -total / 2;
		let i = 0;
		rows.forEach((r, line) => {
			const left = -(r.w * s) / 2;
			const baseline = top + r.asc * s;
			r.items.forEach((it) => {
				cells.push({
					ch: it.ch,
					f: it.g.f,
					w: it.g.w * s,
					h: it.g.h * s,
					desc: it.g.desc * s,
					cx: left + (it.x + it.g.w / 2) * s,
					by: baseline,
					i: i++,
					// draw order = z: LEFT glyph on top, the comma above both neighbours
					z: (BR_SET.onTop as readonly string[]).includes(it.ch) ? 10_000 : 1000 - it.x,
					line,
				});
			});
			top += (r.asc + r.desc) * s + gap;
		});
		const w = Math.max(...rows.map((r) => r.w)) * s;
		return { cells: cells.sort((a, b) => a.z - b.z), s, w, h: total, count: i, pad: BR_HALO_PAD * s };
	});

	// ---- motion ----
	type G = { tx: number; ty: number; sx: number; sy: number; rot: number; alpha: number; glint: number; glow: number };
	const fresh = (): G => ({ tx: 0, ty: 0, sx: 1, sy: 1, rot: 0, alpha: phase === 'enter' ? 0 : 1, glint: 0, glow: 0 });
	let st = $state<G[]>([]);
	let shake = $state({ x: 0, y: 0 });
	$effect(() => {
		if (st.length !== layout.count) st = Array.from({ length: layout.count }, fresh);
	});
	const cfg = (k: number) => ({
		stagger: 70 - 10 * k,
		dropH: 260 + 70 * k,
		squash: 0.12 + 0.05 * k,
		wobble: k < 1 ? 0 : 2 + 1.5 * k,
		shake: k >= 2 ? 4 + 3 * (k - 2) : 0,
		sides: k >= 3,
		wave: [0, 4, 6, 8, 10][k] ?? 10,
		rotW: k >= 2 ? 1.5 : 0,
		pulse: k >= 3 ? 0.03 + 0.02 * (k - 3) : 0,
		bursts: k === 4,
		glintEvery: [2600, 2200, 1800, 1500, 1100][k] ?? 1100,
	});
	const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
	const easeOut = (t: number) => 1 - (1 - t) ** 3;
	const easeIn = (t: number) => t * t;
	const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
	const rnd = (a: number, b: number) => a + Math.random() * (b - a);
	const DEG = Math.PI / 180;

	// per-glyph timelines live outside $state (read every frame, written by the loop only)
	let mode: 'enter' | 'idle' | 'exit' = 'idle';
	let t0s: number[] = [];
	let landed: boolean[] = [];
	let settledAt = -1;
	let shakeAmp = 0;
	let shakeT0 = 0;
	let glintAt = -1;
	let lastGlint = 0;
	let glowT0 = -1;
	let glowEndT0 = -1;
	let raf = 0;
	const now = () => performance.now();

	const startEnter = () => {
		const c = cfg(tier);
		mode = 'enter';
		settledAt = -1;
		const t = now() + enterDelay;
		t0s = Array.from({ length: layout.count }, (_, i) => t + i * (entrance === 'flap' ? 40 : c.stagger));
		landed = Array.from({ length: layout.count }, () => false);
		st = Array.from({ length: layout.count }, () => ({ ...fresh(), alpha: 0 }));
		ensureLoop();
	};
	const startExit = () => {
		mode = 'exit';
		const t = now();
		t0s = Array.from({ length: layout.count }, (_, i) => t + i * 40);
		ensureLoop();
	};
	$effect(() => {
		phase; // tracked
		if (phase === 'enter') startEnter();
		else if (phase === 'exit') startExit();
		else {
			mode = 'idle';
			settledAt = now();
			ensureLoop();
		}
	});
	$effect(() => {
		if (glow) {
			if (glowT0 < 0) glowT0 = now();
			glowEndT0 = -1;
		} else if (glowT0 >= 0 && glowEndT0 < 0) glowEndT0 = now();
		ensureLoop();
	});

	const needsLoop = () => {
		const c = cfg(tier);
		if (mode !== 'idle') return true;
		if (glowT0 >= 0) return true;
		if (shakeAmp > 0 || glintAt >= 0) return true;
		return c.wave > 0 || c.rotW > 0 || c.pulse > 0 || c.bursts || glint;
	};
	const ensureLoop = () => {
		if (!raf && layout.count) raf = requestAnimationFrame(step);
	};
	const step = (t: number) => {
		raf = 0;
		const c = cfg(tier);
		const L = layout;
		const cells = L.cells;
		let allSettled = true;
		let allExited = true;
		for (const cell of cells) {
			const g = st[cell.i];
			if (!g) continue;
			const i = cell.i;
			if (mode === 'enter') {
				const tt = t - (t0s[i] ?? t);
				if (tt < 0) {
					g.alpha = 0;
					allSettled = false;
					continue;
				}
				g.alpha = 1;
				if (entrance === 'flap') {
					const p = clamp(tt / 160, 0, 1);
					g.sy = easeOutBack(p);
					g.sx = 1;
					g.tx = g.ty = g.rot = 0;
					if (p < 1) allSettled = false;
					continue;
				}
				const FALL = 380;
				const SETTLE = 240;
				const side = c.sides ? (i % 2 ? 1 : -1) : 0;
				if (tt < FALL) {
					const p = easeIn(tt / FALL);
					g.ty = -c.dropH * L.s * (1 - p);
					g.tx = side * 220 * L.s * (1 - p);
					g.rot = side * -10 * DEG * (1 - p);
					g.sx = g.sy = 1;
					allSettled = false;
					continue;
				}
				const q = clamp((tt - FALL) / SETTLE, 0, 1);
				const e = easeOut(q);
				g.tx = g.ty = 0;
				g.sy = 1 - c.squash * (1 - e);
				g.sx = 1 + c.squash * 0.8 * (1 - e);
				g.rot = c.wobble * DEG * Math.sin(q * Math.PI * 3) * Math.exp(-q * 3.5);
				if (!landed[i]) {
					landed[i] = true;
					if (c.shake) {
						shakeAmp = c.shake * L.s;
						shakeT0 = t;
					}
				}
				if (q < 1) allSettled = false;
			} else if (mode === 'idle') {
				const tt = t - settledAt;
				g.alpha = 1;
				g.ty = -c.wave * L.s * Math.sin(tt / 260 + i * 0.55);
				g.rot = c.rotW * DEG * Math.sin(tt / 300 + i * 0.55);
				g.sx = g.sy = 1 + c.pulse * Math.sin(tt / 220);
				g.tx = 0;
			} else {
				// exit: split-flap fold
				const tt = t - (t0s[i] ?? t);
				const p = clamp(tt / 140, 0, 1);
				g.sy = 1 - easeIn(p);
				if (p < 1) allExited = false;
			}
		}
		if (mode === 'enter' && allSettled) {
			mode = 'idle';
			settledAt = t;
			if (glint) glintAt = t + 150;
			onsettled?.();
		}
		if (mode === 'exit' && allExited) {
			onexited?.();
			mode = 'idle';
			return; // parent unmounts us
		}
		// title-level shake: landing impacts (MEGA+) and MAX's idle bursts
		let sx = 0;
		let sy = 0;
		if (shakeAmp > 0) {
			const p = clamp((t - shakeT0) / 300, 0, 1);
			if (p < 1) {
				const a = shakeAmp * (1 - p);
				sx = rnd(-a, a);
				sy = rnd(-a, a);
			} else shakeAmp = 0;
		}
		if (c.bursts && mode === 'idle' && (t - settledAt) % 900 < 150) {
			sx += rnd(-4, 4) * L.s;
			sy += rnd(-4, 4) * L.s;
		}
		shake = { x: sx, y: sy };
		// glint: an additive flash walking left → right, delayed by each glyph's x position
		if (glint && mode === 'idle') {
			if (glintAt < 0 && t - lastGlint > c.glintEvery) glintAt = t;
			if (glintAt >= 0) {
				let pending = false;
				for (const cell of cells) {
					const d = ((cell.cx + L.w / 2) / L.w) * 320;
					const p = (t - glintAt - d) / 420;
					const g = st[cell.i];
					if (!g) continue;
					if (p < 0) pending = true;
					g.glint = p >= 0 && p < 1 ? 0.55 * Math.sin(p * Math.PI) : 0;
					if (p >= 0 && p < 1) pending = true;
				}
				if (!pending) {
					glintAt = -1;
					lastGlint = t;
				}
			}
		} else for (const g of st) g.glint = 0;
		// glow (ON THE MENU): rise over 220 ms, per-letter ripple, flash + fade when cut
		if (glowT0 >= 0) {
			const tt = t - glowT0;
			const rise = clamp(tt / 220, 0, 1);
			let done = false;
			for (const cell of cells) {
				const g = st[cell.i];
				if (!g) continue;
				const ph = cell.i * 0.6;
				let a = rise * (0.5 + 0.35 * Math.sin(tt / 190 - ph));
				let sc = 1 + 0.012 * rise * Math.sin(tt / 190 - ph);
				if (glowEndT0 >= 0) {
					const e = t - glowEndT0;
					if (e < 90) a = 1;
					else {
						a = Math.max(0, 1 - (e - 90) / 260) * 0.9;
						sc = 1 + 0.02 * Math.max(0, 1 - (e - 90) / 260);
					}
					if (e > 360) done = true;
				}
				g.glow = a;
				if (mode === 'idle') g.sx = g.sy = sc;
			}
			if (done) {
				glowT0 = -1;
				glowEndT0 = -1;
				for (const g of st) g.glow = 0;
			}
		}
		if (needsLoop()) raf = requestAnimationFrame(step);
	};
	$effect(() => () => cancelAnimationFrame(raf));
</script>

<Container x={x + shake.x} y={y + shake.y}>
	{#if backdrop && layout.count}
		<!-- the shared radial blob stretched well past the block: a blurred shadow, no filter -->
		<BaseSprite texture={shadowTexture()} anchor={0.5} width={layout.w * 1.6 + 120} height={layout.h * 2.6 + 40} alpha={0.7} />
	{/if}
	{#each layout.cells as cell (cell.i)}
		{@const g = st[cell.i]}
		{#if g}
			<Container x={cell.cx + g.tx} y={cell.by + g.ty} scale={{ x: g.sx, y: g.sy }} rotation={g.rot} alpha={g.alpha}>
				{#if g.glow > 0}
					<Sprite key="{cell.f.replace('.png', '')}_halo.png" anchor={{ x: 0.5, y: 1 }} y={cell.desc + layout.pad} width={cell.w + layout.pad * 2} height={cell.h + layout.pad * 2} blendMode="add" alpha={g.glow * 0.9} />
				{/if}
				<Sprite key={cell.f} anchor={{ x: 0.5, y: 1 }} y={cell.desc} width={cell.w} height={cell.h} />
				{#if g.glow > 0}
					<Sprite key={cell.f} anchor={{ x: 0.5, y: 1 }} y={cell.desc} width={cell.w} height={cell.h} tint={0xffd27a} blendMode="add" alpha={g.glow} />
				{/if}
				{#if g.glint > 0}
					<Sprite key={cell.f} anchor={{ x: 0.5, y: 1 }} y={cell.desc} width={cell.w} height={cell.h} blendMode="add" alpha={g.glint} />
				{/if}
			</Container>
		{/if}
	{/each}
</Container>
