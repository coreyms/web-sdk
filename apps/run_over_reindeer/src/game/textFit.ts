// Fit-a-price-string-to-a-box helpers for the HTML chrome.
//
// Stake's review (2026-09-20, FIX 4) forbids K/M/B abbreviation anywhere a bet level or a play
// amount is shown: the full amount and its currency marker must always be legible. Every button
// face that used to abbreviate now MEASURES the full string and either fits it, shrinks it, or
// (where a second readout carries the same number) drops the line entirely. Nothing is ever
// truncated or ellipsised.
//
// The measurement is a metrics call on one offscreen 2D canvas — nothing is rasterised to the
// page, and callers compute it reactively from the string + the layout, never per frame.
// Digits are normalised to '0' first: the chrome's number face renders with
// font-variant-numeric: tabular-nums (every digit on the widest advance) but canvas measureText
// has no way to ask for that face, so a proportional "1" measured ~9 px narrow per glyph and
// every price containing a 1 ellipsised on the phone grid (live-caught 2026-09-03). '0' is a safe
// upper bound on the tabular advance, so the fit stays conservative.
export const UI_NUM_FACE = "'Sora', system-ui, sans-serif";
/** the chrome's label face (--ui-font), for measuring words rather than amounts */
export const UI_TEXT_FACE = "'Outfit', system-ui, sans-serif";

const CHAR_W = 0.58; // per-glyph estimate, used only when no canvas exists (SSR / unit tests)
let ctx: CanvasRenderingContext2D | null | undefined;

/** rendered width of `text` in the chrome's number face, including letter-spacing */
export const measureFitText = (text: string, fontPx: number, weight = 800, letterSpacing = 0, face = UI_NUM_FACE): number => {
	if (ctx === undefined) ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
	if (!ctx) return text.length * CHAR_W * fontPx;
	ctx.font = `${weight} ${fontPx}px ${face}`;
	ctx.fontKerning = 'none';
	return ctx.measureText(text.replace(/\d/g, '0')).width + letterSpacing * text.length;
};

export type FitOptions = {
	text: string;
	/** font size the label is drawn at when the whole string fits */
	nominal: number;
	/** inner width of the label box, in CSS px */
	box: number;
	/** below this fraction of `nominal` the caller is told to hide the line (0 = never hide) */
	minScale?: number;
	/** hard lower bound in px — a shrink-only caller's readability floor */
	floor?: number;
	weight?: number;
	letterSpacing?: number;
	face?: string;
};

/**
 * Shrink-then-hide fit. Returns the font size to draw the FULL string at, or `null` when it
 * cannot be drawn at or above `minScale` — the caller then drops the line rather than
 * abbreviating it. `floor` clamps the result from below for shrink-only callers.
 */
export const fitFont = ({ text, nominal, box, minScale = 0, floor = 0, weight = 800, letterSpacing = 0, face = UI_NUM_FACE }: FitOptions): number | null => {
	if (!text || box <= 0 || nominal <= 0) return null;
	const atNominal = measureFitText(text, nominal, weight, letterSpacing, face);
	if (atNominal <= box) return nominal;
	const scale = box / atNominal;
	if (minScale > 0 && scale < minScale) return null;
	return Math.max(floor, Math.floor(nominal * scale * 10) / 10);
};
