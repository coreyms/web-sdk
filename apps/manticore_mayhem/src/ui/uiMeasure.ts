// Width of a string in the HTML chrome's number face (Sora, --ui-font-num), measured on an
// offscreen 2D canvas. Used to pre-size the SPIN readout's slot (betStep.ts) and to shrink an
// amount that would overflow its column (TrioStat). Nothing is rasterised to the page: the
// measurement is a metrics call. Before the bundled font has loaded the browser measures the
// fallback face, so callers keep a length-based estimate for that window.
let ctx: CanvasRenderingContext2D | null = null;
export const UI_NUM_FONT = "'Sora', system-ui, sans-serif";
export const measureUiText = (text: string, fontPx: number, weight = 800): number | null => {
	if (typeof document === 'undefined') return null;
	if (!ctx) ctx = document.createElement('canvas').getContext('2d');
	if (!ctx) return null;
	ctx.font = `${weight} ${fontPx}px ${UI_NUM_FONT}`;
	// tabular figures: every digit takes the widest digit's advance (matches .slot-num's
	// font-variant-numeric so the measured width is the rendered width)
	ctx.fontKerning = 'none';
	return ctx.measureText(text).width;
};
// The HUD still sizes amounts by the old stencil digit height. Sora reads bigger than the stencil
// did at an equal cap height (wider, heavier digits), so the font size is only 1.1× that number
// (Corey 2026-09-08: the cap-matched 1.39× "is too big under BALANCE / WIN / SPIN").
export const AMOUNT_FONT_SCALE = 1.1;
export const fontPxForCap = (digitPx: number) => digitPx * AMOUNT_FONT_SCALE;
