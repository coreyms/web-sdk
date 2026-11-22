// THE AMOUNT FIT FOR HTML BOXES (2026-11-21, wip/pricefit). The house rule (big numbers fit): an amount shrinks its type
// to its box, never clips, never wraps, and no text is measured per frame (slot-house-rules R1, R7). The bar's readouts
// do this with HudReadout's fitted() over game/textFit.ts; this is the same rule for a box whose width only the page's
// layout knows (THE FAST LANE's price plate, its BALANCE and PLAY AMOUNT, the confirm card's rows and total, the replay
// card's rows, Game Info's paytable).
//
// Why a new action (the Fast Lane's old `fit` clipped "100.000000 BTC" on Decimus, 2026-11-21, tip dba8b786): it read
// the element's OWN text through scrollWidth inside the action's update, and Svelte 5 runs an action's update before the
// template writes the new text (svelte/internal actions.js: the update is a render effect made ahead of the text's
// template effect). So every fit was one change behind: ANTE 10x "10.000000 BTC" fitted, then FREE SPINS "100.000000
// BTC" drawn at that size, one digit too wide (desktop 290 > 260 px). It also never ran again when the box changed (an
// orientation flip, the upright menu's squeeze) or when the face landed.
//
// Now:
//   - the TEXT is the action's argument, never the DOM's, measured on one offscreen canvas in the element's own face,
//     weight and letter spacing (measureFitText: digits as '0', a safe bound on the tabular cell), cached by its shape;
//   - the BOX (content width) and the NOMINAL size (the CSS size with the fit's own size taken off) are read on mount,
//     on a ResizeObserver change of the element and when a font lands, never per frame;
//   - one check a frame later against the drawn text (scrollWidth > clientWidth, the text the template has written by
//     then) shrinks the size again by the measured ratio, for a face the canvas did not have yet or a currency sign
//     drawn from a fallback face (the rouble, rupee, won, dong, naira and shekel signs: no game face carries them);
//   - the element keeps `white-space: nowrap` (its CSS): an amount is never broken, and game/currency.ts writes the space
//     before a trailing code as a no-break space for the running text around it.
// THE FLOOR. `floor` (CSS px of the element's own font-size, so design px inside the Fast Lane's scaled box) is the size
// the worst-case table (tools/amount_fit_test.mjs, docs in the notes) keeps every real amount above. If an amount ever
// needs less (a ladder far beyond Stake's), the fit still never clips: it keeps shrinking to fit and marks the element
// data-fit="under" (probes read it; a DEV build logs it once per text shape). Clipping a price is never the answer.
import { measureFitText } from '../game/textFit';

export type Measure = (text: string, px: number, weight: number, letterSpacingPx: number, face: string) => number;
export type AmountFace = { face: string; weight: number; /** letter spacing at the nominal size, px */ trackPx?: number };

/** headroom under the box: the canvas has no kerning and rounds differently from the page's text */
export const FIT_HEADROOM = 0.98;
/** the size a fitted amount steps by (0.1 px: no visible jump between shapes) */
const STEP = 10;

/** THE FIT, pure: the nominal size when `text` fits `box` at it, else the largest size (0.1 px steps) at which it does */
export const fitAmountPx = (text: string, nominal: number, box: number, face: AmountFace, measure: Measure = measureFitText): number => {
	if (!text || !(box > 0) || !(nominal > 0)) return nominal;
	const w = measure(text, nominal, face.weight, face.trackPx ?? 0, face.face);
	if (w <= box) return nominal;
	return Math.floor(nominal * (box / w) * FIT_HEADROOM * STEP) / STEP;
};

const cache = new Map<string, number>();
const shapeKey = (text: string, nominal: number, box: number, f: AmountFace) => `${f.face}|${f.weight}|${f.trackPx ?? 0}|${nominal}|${Math.round(box * 10)}|${text.replace(/\d/g, '0')}`;
/** the fit, cached by the string's shape (a count or a step re-measures once per shape, never per frame) */
export const fittedAmountPx = (text: string, nominal: number, box: number, face: AmountFace): number => {
	const k = shapeKey(text, nominal, box, face);
	let v = cache.get(k);
	if (v === undefined) {
		v = fitAmountPx(text, nominal, box, face);
		if (cache.size > 400) cache.clear();
		cache.set(k, v);
	}
	return v;
};

/** `off`: the element is sized by its text in this state (Game Info's pays beside the name), so the fit stands aside */
export type FitAmountArg = string | { text: string; floor?: number; off?: boolean };
const argOf = (a: FitAmountArg) => (typeof a === 'string' ? { text: a, floor: 0, off: false } : { text: a.text, floor: a.floor ?? 0, off: !!a.off });

const warned = new Set<string>();

/**
 * use:fitAmount={text} (or {{ text, floor }}): the element's amount at its CSS size, shrunk to its content box when it
 * would not fit. The element's width must not depend on its own text (a flex 1 1 0 / min-width 0 cell, a grid track
 * of minmax(0, 1fr), a width: 100% block), and it keeps white-space: nowrap and overflow: hidden in its CSS.
 * Sets data-fit: "nominal", "fit" (shrunk) or "under" (shrunk below `floor`).
 */
export const fitAmount = (node: HTMLElement, arg: FitAmountArg) => {
	let { text, floor, off } = argOf(arg);
	let nominal = 0;
	let box = 0;
	let face: AmountFace = { face: 'sans-serif', weight: 400 };
	let raf = 0;
	let gone = false;

	/** the layout's part: the box and the CSS size, the fit's own size taken off (mount, a resize, a font landing) */
	const read = () => {
		const own = node.style.fontSize;
		if (own) node.style.fontSize = '';
		const cs = getComputedStyle(node);
		nominal = parseFloat(cs.fontSize) || 0;
		box = node.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
		const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0;
		face = { face: cs.fontFamily, weight: parseInt(cs.fontWeight, 10) || 400, trackPx: ls };
		if (own) node.style.fontSize = own;
	};
	const set = (px: number) => {
		const want = px >= nominal ? '' : `${px}px`;
		if (node.style.fontSize !== want) node.style.fontSize = want;
		const state = px >= nominal ? 'nominal' : floor > 0 && px < floor ? 'under' : 'fit';
		if (node.dataset.fit !== state) node.dataset.fit = state;
		if (state === 'under' && import.meta.env.DEV) {
			const k = `${floor}|${text.replace(/\d/g, '0')}`;
			if (!warned.has(k)) {
				warned.add(k);
				console.info(`[fitAmount] "${text}" needs ${px} px, under its floor ${floor} px (fitted, never clipped)`);
			}
		}
	};
	/** the drawn text, a frame on: a canvas that measured a fallback face narrower than the page's gets corrected */
	const check = () => {
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => {
			raf = 0;
			if (gone || off || !(nominal > 0)) return;
			const cw = node.clientWidth;
			const sw = node.scrollWidth;
			if (cw > 0 && sw > cw + 0.5) {
				const now = parseFloat(node.style.fontSize) || nominal;
				set(Math.floor(now * (cw / sw) * FIT_HEADROOM * STEP) / STEP);
			}
		});
	};
	const run = () => {
		if (gone) return;
		if (off) {
			if (node.style.fontSize) node.style.fontSize = '';
			delete node.dataset.fit;
			return;
		}
		if (!(box > 0) || !(nominal > 0)) read();
		if (!(box > 0) || !(nominal > 0)) return;
		set(fittedAmountPx(text, nominal, box, face));
		check();
	};
	const relayout = () => {
		if (gone) return;
		if (!off) read();
		run();
	};

	relayout();
	let lastW = node.clientWidth;
	const ro =
		typeof ResizeObserver === 'undefined'
			? null
			: new ResizeObserver(() => {
					// (only the box's width matters: a height change from the fit's own size is not a new box)
					const w = node.clientWidth;
					if (Math.abs(w - lastW) < 0.5) return;
					lastW = w;
					relayout();
				});
	ro?.observe(node);
	const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
	fonts?.ready.then(relayout);
	fonts?.addEventListener?.('loadingdone', relayout);

	return {
		update(next: FitAmountArg) {
			({ text, floor, off } = argOf(next));
			// the fit itself is from the new text at once; the layout (a class the same flush changes after this update
			// runs) is read again once the flush is done, before the frame paints
			run();
			queueMicrotask(relayout);
		},
		destroy() {
			gone = true;
			cancelAnimationFrame(raf);
			ro?.disconnect();
			fonts?.removeEventListener?.('loadingdone', relayout);
		},
	};
};
