<script lang="ts">
	// HTML twin of components/ArtAmount.svelte: an amount drawn from Corey's prison-stencil numeral
	// atlas as background-image glyph spans (one resident image, no text rasterization), so the HUD's
	// BALANCE / WIN / SPIN read in the same face the game celebrates with (Stake review 2026-09-02:
	// "the HUD ignores the game's own numeral atlas"). Same tokenizer, same cell/gap/fit math and the
	// same normalisation to digit height (the sheet draws the currency symbols taller) as the Pixi
	// renderer, so the two never disagree about a string. Unsupported currencies fall back to the
	// whole string in the number font, exactly like ArtAmount's GameText fallback.
	import type * as PIXI from 'pixi.js';
	import { NUMERAL_GLYPHS, NUMERAL_DIGIT_H } from '../game/numeralGlyphs';
	import { tokenizeNumerals } from '../game/numeralTokens';
	import { stamp } from '../game/assets';
	import { getContext } from '../game/context';

	type Props = { text: string; height: number; maxWidth?: number; align?: 'left' | 'center' | 'right' };
	const { text, height, maxWidth, align = 'left' }: Props = $props();

	// Frame rectangles come from the spritesheet Pixi has ALREADY loaded (assets.ts numeralsAtlas,
	// preloaded before the landing opens): each 'num_X.png' key is a Texture whose .frame is the
	// crop in the shared image. No second fetch of the JSON, and the static folder is never imported
	// as a module (vite refuses that with a 403).
	const context = getContext();
	const SHEET_URL = stamp('/assets/ui/numerals/numerals.webp');
	const frameOf = (key: string) => {
		const tex = context.stateApp.loadedAssets?.[`num_${key}.png`] as PIXI.Texture | undefined;
		if (!tex) return null;
		const { x, y, width, height } = tex.frame;
		return { x, y, w: width, h: height, sw: tex.source.width, sh: tex.source.height };
	};
	const GAP = 0.05;
	const SPACE = 0.32;
	const COMMA_HANG = 21 / NUMERAL_DIGIT_H;
	const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
	const DIGIT_CELL = Math.max(...DIGITS.map((d) => NUMERAL_GLYPHS[d].w));
	const SEP_CELL = Math.max(NUMERAL_GLYPHS.comma.w, NUMERAL_GLYPHS.period.w);

	// the sheet is preloaded, but a stat can mount before loadedAssets is populated in a story or a
	// resume edge: treat "no frames yet" like an unsupported string and fall back to text
	const tokens = $derived(tokenizeNumerals(text));
	const ready = $derived(!!tokens && tokens.every((t) => t === null || frameOf(t) !== null));
	const layout = $derived.by(() => {
		if (!tokens || !ready) return { glyphs: [], width: 0, rowH: 0 };
		const s = height / NUMERAL_DIGIT_H;
		const gap = height * GAP;
		const cells = tokens.map((name) => {
			if (name === null) return { key: '', cellW: height * SPACE, w: 0, h: 0, va: 'base' };
			const g = NUMERAL_GLYPHS[name];
			const isDigit = DIGITS.includes(name);
			const isSep = name === 'comma' || name === 'period';
			const w = g.w * s;
			return { key: name, cellW: isDigit ? DIGIT_CELL * s : isSep ? SEP_CELL * s : w, w, h: g.h * s, va: g.va };
		});
		const total = cells.reduce((sum, c) => sum + c.cellW, 0) + gap * Math.max(0, cells.length - 1);
		const fit = maxWidth && total > maxWidth ? maxWidth / total : 1;
		let cx = 0;
		const glyphs = cells.map((c) => {
			const cellW = c.cellW * fit;
			const w = c.w * fit;
			const h = c.h * fit;
			let y = height * fit - h; // baseline at the row's bottom
			if (c.va === 'hang') y += COMMA_HANG * height * fit;
			else if (c.va === 'mid') y -= (height * fit - h) / 2;
			const f = c.key ? frameOf(c.key) : null;
			const out = { key: c.key, x: cx + (cellW - w) / 2, y, w, h, f };
			cx += cellW + gap * fit;
			return out;
		});
		return { glyphs, width: total * fit, rowH: height * fit };
	});
</script>

{#if tokens && ready}
	<span class="row" style:width="{layout.width}px" style:height="{layout.rowH}px" style:margin-left={align === 'right' ? 'auto' : align === 'center' ? 'auto' : '0'} style:margin-right={align === 'left' ? 'auto' : align === 'center' ? 'auto' : '0'} aria-label={text}>
		{#each layout.glyphs as g, i (i)}
			{#if g.f}
				<span
					class="g"
					style:left="{g.x}px"
					style:top="{g.y}px"
					style:width="{g.w}px"
					style:height="{g.h}px"
					style:background-image="url({SHEET_URL})"
					style:background-size="{(g.f.sw * g.w) / g.f.w}px {(g.f.sh * g.h) / g.f.h}px"
					style:background-position="{(-g.f.x * g.w) / g.f.w}px {(-g.f.y * g.h) / g.f.h}px"
				></span>
			{/if}
		{/each}
	</span>
{:else}
	<span class="slot-num fallback" style:font-size="{height * 1.25}px">{text}</span>
{/if}

<style>
	.row {
		position: relative;
		display: block;
		filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.65));
		pointer-events: none;
	}
	.g {
		position: absolute;
		background-repeat: no-repeat;
	}
	.fallback {
		font-weight: 700;
		color: #fff;
		text-shadow: 0 2px 3px rgba(0, 0, 0, 0.7);
		white-space: nowrap;
	}
</style>
