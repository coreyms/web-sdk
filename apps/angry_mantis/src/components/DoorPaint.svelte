<script lang="ts">
	// The painted-on door (game/doorPaint.ts): ONE raw Pixi mesh the exact size of the steel door,
	// mounted INSIDE DoorSteel's masked container right after the door sprite, so it rolls, clips and
	// hides with the door. Its fragment shader multiplies every painted pixel by the door's groove
	// map, so headers, counts, strokes, stars and the wrap-up plate + amount all sit IN the metal.
	// Nothing here rasterises per frame: the ticker only rewrites a few uniforms (star angles, the
	// strokes' push, the amount's glyph boxes while it counts) — house rules 1 and 6.
	import * as PIXI from 'pixi.js';
	import { getContextParent } from 'pixi-svelte';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import { doorPaintState } from '../game/doorPaint.svelte';
	import { DOOR_ASPECT, DOOR_PAINT, DOOR_PAINT_FRAGMENT, DOOR_PAINT_VERTEX, MAX_PAINTED_GLYPHS } from '../game/doorPaint';
	import { layoutNumerals } from '../game/numeralLayout';
	import { STINGER_PLATE } from '../game/stinger';

	type Props = { x: number; y: number; w: number; h: number };
	const props: Props = $props();
	const context = getContext();

	const root = new PIXI.Container();
	getContextParent().addToParent(root);

	const HEADER_KEY = { free: 'paintHeaderBonus', super: 'paintHeaderSuper', feast: 'paintHeaderFeast' } as const;
	const textureFor = (key: string): PIXI.Texture | undefined => {
		const fromAssets = context.stateApp.loadedAssets?.[key];
		if (fromAssets instanceof PIXI.Texture) return fromAssets;
		const cached = PIXI.Assets.cache.get(key);
		return cached instanceof PIXI.Texture ? cached : undefined;
	};

	// ---- mesh, built once every texture it samples is resident (all deferred, bonusStart awaits them) ----
	let mesh: PIXI.Mesh<PIXI.MeshGeometry, PIXI.Shader> | null = null;
	let uniforms: Record<string, any> | null = null;
	let built = $state(false);
	const f32 = (n: number) => new Float32Array(n);
	const build = () => {
		const door = textureFor('doorSteel');
		const groove = textureFor('doorGroove');
		const header = textureFor('paintHeaderBonus');
		const star = textureFor('paintStar');
		const count = textureFor('paintSpins8');
		const rays = textureFor('paintRay');
		const numerals = textureFor('num_0.png');
		if (!door || !groove || !header || !star || !count || !rays || !numerals) return false;
		const geometry = new PIXI.MeshGeometry({
			positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
			uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
			indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
		});
		const shader = PIXI.Shader.from({
			gl: { vertex: DOOR_PAINT_VERTEX, fragment: DOOR_PAINT_FRAGMENT, name: 'door-paint' },
			resources: {
				uDoor: door.source,
				uGroove: groove.source,
				uHeader: header.source,
				uStar: star.source,
				uCount: count.source,
				uRays: rays.source,
				uNumerals: numerals.source,
				paint: {
					uAspect: { value: new Float32Array([1, DOOR_ASPECT]), type: 'vec2<f32>' },
					uYellow: { value: rgb(DOOR_PAINT.yellow), type: 'vec3<f32>' },
					uCream: { value: rgb(DOOR_PAINT.cream), type: 'vec3<f32>' },
					uAmtColor: { value: rgb(DOOR_PAINT.outro.amountColor), type: 'vec3<f32>' },
					uShadowColor: { value: rgb(DOOR_PAINT.outro.amountShadow), type: 'vec3<f32>' },
					uMetal: {
						value: new Float32Array([DOOR_PAINT.metal.opacity, DOOR_PAINT.metal.wear, DOOR_PAINT.metal.grooveStrength, DOOR_PAINT.metal.grooveFloor]),
						type: 'vec4<f32>',
					},
					uLip: { value: DOOR_PAINT.metal.lipHighlight, type: 'f32' },
					uHeaderBox: { value: f32(4), type: 'vec4<f32>' },
					uStarPos: { value: f32(4), type: 'vec2<f32>', size: 2 },
					uStarAng: { value: f32(2), type: 'f32', size: 2 },
					uStarSize: { value: 0, type: 'f32' },
					uCountBox: { value: f32(4), type: 'vec4<f32>' },
					uCountRGB: { value: 0, type: 'f32' },
					uRayPos: { value: f32(12), type: 'vec2<f32>', size: 6 },
					uRayAng: { value: f32(6), type: 'f32', size: 6 },
					uRayStretch: { value: f32(6), type: 'f32', size: 6 },
					uRayDims: { value: f32(3), type: 'vec3<f32>' },
					uGlyphUV: { value: f32(4 * MAX_PAINTED_GLYPHS), type: 'vec4<f32>', size: MAX_PAINTED_GLYPHS },
					uGlyphBox: { value: f32(4 * MAX_PAINTED_GLYPHS), type: 'vec4<f32>', size: MAX_PAINTED_GLYPHS },
					uGlyphCount: { value: 0, type: 'f32' },
					uShadowOff: { value: f32(2), type: 'vec2<f32>' },
				},
			},
		});
		mesh = new PIXI.Mesh({ geometry, shader });
		uniforms = shader.resources.paint.uniforms;
		root.addChild(mesh);
		built = true;
		return true;
	};
	const rgb = (hex: number) => new Float32Array([((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]);

	// swap the per-mode / per-count textures by replacing the shader's sampler resources
	const bindTexture = (name: 'uHeader' | 'uCount', key: string) => {
		const t = textureFor(key);
		if (mesh && t && mesh.shader!.resources[name] !== t.source) mesh.shader!.resources[name] = t.source;
	};

	// the door rect in the parent's units: the unit quad is scaled to it
	$effect(() => {
		root.position.set(props.x, props.y);
		root.scale.set(props.w, props.h);
	});

	// ---- static layout for the current screen (recomputed when the paint state changes) ----
	const texAspect = (key: string) => {
		const t = textureFor(key);
		return t ? t.height / t.width : 1;
	};
	$effect(() => {
		const st = doorPaintState;
		const screen = st.screen;
		const mode = st.mode;
		const spins = st.spins;
		const plate = st.plate;
		if (!built && !build()) return;
		if (!uniforms) return;
		root.visible = screen !== null;
		if (!screen) return;
		const U = uniforms;
		// header + stars
		const hd = DOOR_PAINT.header[mode];
		bindTexture('uHeader', HEADER_KEY[mode]);
		const hy = screen === 'intro' ? hd.introY : hd.outroY;
		U.uHeaderBox.set([0.5, hy, hd.w, hd.w * texAspect(HEADER_KEY[mode])]);
		const stars = DOOR_PAINT.stars[mode];
		const sy = hy + stars.dy / DOOR_ASPECT;
		U.uStarPos.set([0.5 - stars.x, sy, 0.5 + stars.x, sy]);
		U.uStarSize = stars.size;
		// count (intro) / plate (outro)
		if (screen === 'intro') {
			const key = spins === 8 ? 'paintSpins8' : 'paintSpins10';
			bindTexture('uCount', key);
			U.uCountBox.set([0.5, DOOR_PAINT.count.y, DOOR_PAINT.count.w, DOOR_PAINT.count.w * texAspect(key)]);
			U.uCountRGB = 0;
			U.uRayDims.set([DOOR_PAINT.rayMotion.strokeLen, DOOR_PAINT.rayMotion.strokeLen, 1]);
			U.uGlyphCount = 0;
		} else {
			if (plate) {
				bindTexture('uCount', STINGER_PLATE.big.key);
				const p = DOOR_PAINT.outro.plate;
				U.uCountBox.set([0.5, p.y, p.w, p.w / STINGER_PLATE.big.aspect]);
				U.uCountRGB = 1;
			} else {
				U.uCountBox.set([0, 0, 0, 0]);
			}
			U.uRayDims.set([0, 0, 0]);
		}
		shader()?.update();
	});
	const shader = () => mesh?.shader?.resources.paint as PIXI.UniformGroup | undefined;

	// ---- the amount (outro): glyph boxes rebuilt whenever the counting string changes ----
	$effect(() => {
		const st = doorPaintState;
		const text = st.amountText;
		const reserve = st.amountReserve;
		const plate = st.plate;
		if (!uniforms || st.screen !== 'outro') return;
		const U = uniforms;
		const o = DOOR_PAINT.outro;
		// the row's centre and digit height, in door-width units (y converted to uv where used)
		let cx = 0.5;
		let cy = o.amountOnDoor.y;
		let h = o.amountOnDoor.h;
		if (plate) {
			const plateH = o.plate.w / STINGER_PLATE.big.aspect;
			cx = 0.5 + o.amountInPlate.dx * o.plate.w;
			cy = o.plate.y + (o.amountInPlate.dy * plateH) / DOOR_ASPECT;
			h = o.amountInPlate.h * plateH;
		}
		const glyphs = text ? layoutNumerals(text, h, { reserve: reserve || undefined }) : null;
		const inked = glyphs?.filter((g) => g.key) ?? [];
		if (!glyphs || inked.length > MAX_PAINTED_GLYPHS) {
			U.uGlyphCount = 0; // FreeSpinOutro shows the sprite count-up instead (paintedAmountSupported)
			shader()?.update();
			return;
		}
		inked.forEach((g, i) => {
			const t = textureFor(`num_${g.key}.png`);
			const uv = t?.uvs;
			if (!t || !uv) return;
			U.uGlyphUV.set([uv.x0, uv.y0, uv.x2, uv.y2], i * 4);
			U.uGlyphBox.set([cx + g.x, cy + g.y / DOOR_ASPECT, cx + g.x + g.w, cy + (g.y + g.h) / DOOR_ASPECT], i * 4);
		});
		U.uGlyphCount = inked.length;
		U.uShadowOff.set([o.shadowOffset.dx * h, (o.shadowOffset.dy * h) / DOOR_ASPECT]);
		shader()?.update();
	});

	// ---- motion: star turn + the strokes' push, on the app ticker while anything is painted ----
	onMount(() => {
		const ticker = context.stateApp.pixiApplication?.ticker;
		const t0 = performance.now();
		const tick = () => {
			const st = doorPaintState;
			if (!uniforms || !st.screen) return;
			const U = uniforms;
			const t = (performance.now() - t0) / 1000;
			const a = ((t * DOOR_PAINT.starDegPerSec) % 360) * (Math.PI / 180);
			U.uStarAng.set([-a, a]);
			if (st.screen === 'intro') {
				const r = DOOR_PAINT.rays[st.mode];
				const m = DOOR_PAINT.rayMotion;
				const fan = (r.fanDeg * Math.PI) / 180;
				const pos = U.uRayPos as Float32Array;
				const ang = U.uRayAng as Float32Array;
				const str = U.uRayStretch as Float32Array;
				for (let side = 0; side < 2; side++) {
					for (let k = -1; k <= 1; k++) {
						const i = side * 3 + (k + 1);
						const step = r.layout === 'up' ? k + 1 : k;
						// axis points FROM the numeral outward: left side = pi, right side = 0
						const angle = (side ? 0 : Math.PI) - step * fan * (side ? 1 : -1);
						const phase = m.stagger * (k + 1) * (Math.PI / 3) + (side ? 0 : Math.PI * m.sideOffset);
						const push = m.push * Math.sin(t * m.pushHz * Math.PI * 2 + phase);
						const dd = r.dist + push;
						pos[i * 2] = 0.5 + Math.cos(angle) * dd;
						pos[i * 2 + 1] = r.y + (Math.sin(angle) * dd) / DOOR_ASPECT;
						ang[i] = angle;
						str[i] = 1 + m.stretch * Math.sin(t * m.pushHz * Math.PI * 2 + phase);
					}
				}
			}
			shader()?.update();
		};
		ticker?.add(tick);
		return () => {
			ticker?.remove(tick);
			root.removeFromParent();
			mesh?.destroy();
		};
	});
</script>
