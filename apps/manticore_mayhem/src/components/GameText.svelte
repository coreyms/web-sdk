<script lang="ts" module>
	import * as PIXI from 'pixi.js';

	// Temporary decorated text styles (Outfit/Sora, bundled in static/assets/fonts/ui) standing in for the
	// Sigmar bitmap font + Honk image headers until those assets exist. Gradient per spec §13.5 is provisional.
	export type GameTextPreset = 'gold' | 'silver' | 'green' | 'red';

	const PRESETS: Record<GameTextPreset, { fill: PIXI.FillInput; stroke: number; shadow: number }> = {
		gold: { fill: { fill: new PIXI.FillGradient({ end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: 0xffe600 }, { offset: 1, color: 0xf4ad2a }] }) }, stroke: 0x3a2000, shadow: 0x000000 },
		silver: { fill: 0xffffff, stroke: 0x1a1a22, shadow: 0x000000 },
		green: { fill: 0x9cd92f, stroke: 0x143300, shadow: 0x000000 },
		red: { fill: 0xff6a4a, stroke: 0x3a0a00, shadow: 0x000000 },
	};

	export const gameTextStyle = (preset: GameTextPreset, fontSize: number, extra: Partial<PIXI.TextStyleOptions> = {}): PIXI.TextStyleOptions => {
		const p = PRESETS[preset];
		return {
			fontFamily: 'Outfit, Sora, system-ui, sans-serif',
			fontWeight: '900',
			fontSize,
			fill: p.fill,
			stroke: { color: p.stroke, width: Math.max(2, fontSize * 0.09), join: 'round' },
			dropShadow: { color: p.shadow, alpha: 0.6, blur: fontSize * 0.08, distance: fontSize * 0.07, angle: Math.PI / 2 },
			letterSpacing: fontSize * 0.03,
			align: 'center',
			...extra,
		};
	};
</script>

<script lang="ts">
	import { Text } from 'pixi-svelte';

	type Props = {
		text: string | number;
		preset?: GameTextPreset;
		size?: number;
		x?: number;
		y?: number;
		anchor?: number | { x: number; y: number };
		maxWidth?: number;
		alpha?: number;
		extra?: Partial<PIXI.TextStyleOptions>;
	};
	const { text, preset = 'gold', size = 40, x = 0, y = 0, anchor = 0.5, maxWidth, alpha = 1, extra = {} }: Props = $props();

	let measured = $state({ width: 0, height: 0 });
	const scale = $derived(maxWidth && measured.width > maxWidth ? maxWidth / measured.width : 1);
	const style = $derived(gameTextStyle(preset, size, extra));
	// Big decorative text rasterizes to a power-of-two canvas and uploads it on first render — traced at
	// 100–150ms per title on a 4×-throttled phone at the renderer's 1.5× resolution. Large sizes render at
	// resolution 1 (≈55% fewer pixels); the softening is invisible at these font sizes on device.
	const resolution = $derived(size >= 56 ? 1 : undefined);
</script>

<Text text={`${text}`} {style} {x} {y} {anchor} {alpha} {scale} {resolution} onresize={(s) => (measured = s)} />
