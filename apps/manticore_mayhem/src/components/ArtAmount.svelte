<script lang="ts" module>
	import { tokenizeNumerals as tokenize } from '../game/numeralTokens';

	/** Can every character of this formatted amount be drawn from the glyph atlas?
	 *  (Spaces are layout-only.) Callers whose text changes per frame must use this guard
	 *  and provide their own throttled styled-text fallback (see CountUpText); anyone else
	 *  who skips it still renders whole via the internal GameText fallback below. */
	export const artAmountSupports = (text: string) => tokenize(text) !== null;
</script>

<script lang="ts">
	// Amounts drawn from the prison-stencil glyph atlas (tools/build_stencil_atlas.py): batched sprites
	// off one resident texture, so changing the value costs a few transforms — no canvas raster, no
	// texture upload. The row layout (tabular cells, odometer reserve) is game/numeralLayout.ts,
	// shared with the painted door (DoorPaint.svelte).
	// VERTICAL ANCHOR: prop `y` is the BASELINE — full-height glyphs span [y - height, y].
	//
	// PHONE PASS (2026-09-23): the glyphs are raw Pixi sprites in ONE container this component owns,
	// not a pixi-svelte <Sprite> per glyph. Each of those ran its own props-sync effect (every prop
	// re-enumerated through Svelte's spread proxies and re-assigned on ANY change), so a count-up or
	// a fading readout re-ran ~2 x glyphs effects a frame. Now there are three small effects: the
	// glyph layout (text / size / tint), the position, and the alpha — a fade touches one number.
	// The sprites are pooled per instance (a longer string adds sprites, a shorter one hides them).
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { layoutNumerals } from '../game/numeralLayout';
	import GameText from './GameText.svelte';

	type Props = {
		text: string;
		/** count-up anchor: the FINAL string of the count. Its width defines the centred box and
		 *  the maxWidth fit, and `text` right-aligns inside it — so a growing value ticks in place
		 *  like an odometer (new digits appear on the left) instead of re-centring on every added
		 *  digit or comma. Omit for static amounts. */
		reserve?: string;
		height?: number;
		x?: number;
		y?: number;
		maxWidth?: number;
		alpha?: number;
		/** multiply tint on the white sheet (the stencil takes tint cleanly: cream, dark, rust) */
		tint?: number;
		/** a second, tinted run drawn FIRST and offset (fractions of `height`) — a hard drop shadow */
		shadow?: { dx: number; dy: number; tint: number };
		/** a uniform scale about the row's optical centre (a punch or a bump): a transform on the
		 *  row's container, so it costs no relayout and no texture work while it animates */
		scale?: number;
	};
	const { text, reserve, height = 72, x = 0, y = 0, maxWidth, alpha = 1, tint = 0xffffff, shadow, scale = 1 }: Props = $props();

	const context = getContext();
	const tokens = $derived(tokenize(text));

	// shadow run first, ink run over it: the same order the per-glyph sprites were drawn in
	const root = new PIXI.Container();
	const shadowRow = new PIXI.Container();
	const inkRow = new PIXI.Container();
	root.addChild(shadowRow, inkRow);
	getContextParent().addToParent(root);
	const pool: PIXI.Sprite[] = [];

	const place = (row: PIXI.Container, n: number) => {
		while (row.children.length < n) {
			const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
			pool.push(s);
			row.addChild(s);
		}
		return row.children as PIXI.Sprite[];
	};

	// the glyph layout: runs when the string, its size or its colours change, never for a fade
	$effect(() => {
		const glyphs = tokens ? (layoutNumerals(text, height, { reserve, maxWidth }) ?? []) : [];
		const atlas = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		const sh = shadow;
		const draw = (row: PIXI.Container, dx: number, dy: number, colour: number, on: boolean) => {
			const sprites = place(row, on ? glyphs.length : 0);
			for (let i = 0; i < sprites.length; i += 1) {
				const s = sprites[i];
				const g = on ? glyphs[i] : undefined;
				if (!g || !g.key) {
					s.visible = false;
					continue;
				}
				s.texture = atlas?.[`num_${g.key}.png`] ?? PIXI.Texture.EMPTY;
				s.position.set(g.x + dx, g.y + dy);
				s.setSize(g.w, g.h);
				s.tint = colour;
				s.visible = true;
			}
		};
		draw(shadowRow, sh ? sh.dx * height : 0, sh ? sh.dy * height : 0, sh?.tint ?? 0, !!sh);
		draw(inkRow, 0, 0, tint, true);
		root.visible = !!tokens;
	});
	// glyph y is relative to the row's optical centre; the row's baseline is prop y
	$effect(() => {
		root.position.set(x, y - height / 2);
	});
	$effect(() => {
		root.alpha = alpha;
	});
	$effect(() => {
		root.scale.set(scale);
	});

	onMount(() => () => {
		// the parent's unmount destroys root without its children: the pooled glyphs go here
		for (const s of pool) s.destroy();
	});
</script>

{#if !tokens}
	<!-- Safety net for unguarded callers (a character outside the stencil set, e.g. an operator code in another script):
	     the WHOLE string as styled text — never a partial art render with glyphs dropped.
	     The art path's baseline sits at prop y (optical centre y - height/2); GameText anchors
	     its centre, so shift up by height/2 so both paths land on the same optical centre.
	     Not for per-frame text: this re-rasterizes on every change (house rule 1) — count-ups
	     must keep guarding with artAmountSupports and throttling their own fallback. -->
	<GameText {text} size={height} {x} y={y - height / 2} {maxWidth} {alpha} />
{/if}
