// The opening primer (ui/LandingScreen.svelte): three ANIMATED explainer cards over the backdrop
// while the audio lands: CLUSTERS, SCATTERS, THE MANTICORE (approved 2026-10-12, review page
// "intro_cards_r3"; they replace milestone 1's placeholder posters card-1..3.webp, whose files left
// static/ on 2026-10-14 and are archived on the Desktop).
//
// A card is: a muted looping clip in the frame's glass window, the frame picture on top of it, and
// live text on the slate in fixed zones (title, copy, a divider, and under it a gold scene line that
// follows the clip's time). The strings are in game/introCardText.ts; every number is here.
//
// Where the screen has room for three cards they stand in a row; where it has not, ONE card shows at
// a time and the cards rotate (Corey: "these framed explainers will need to rotate on smaller
// viewports"). introPlacement() below decides, from the real viewport.
import { LOGO } from './constants';
import { MASTER, type LayoutKind } from './layoutSpec';
import type { IntroCardKey } from './introCardText';

/** static/assets/ui/intro: the frame (768 x 1152, re-encoded from the approved 1024 x 1536 card_frame.webp),
 *  and per card a 640 x 260 H.264 clip (30 fps, no audio track) and its poster */
export const INTRO_CARD_ASSETS = {
	frame: '/assets/ui/intro/card-frame.webp',
	clip: (key: IntroCardKey) => `/assets/ui/intro/card-${key}.mp4`,
	poster: (key: IntroCardKey) => `/assets/ui/intro/card-${key}-poster.jpg`,
};

export const INTRO_CARD = {
	/** width / height of the frame picture */
	aspect: 2 / 3,
	/** the glass window the clip plays in, % of the card (left and width of its width, top and height of its height) */
	window: { left: 11.1, top: 9.9, width: 78, height: 21.4 },
	/** THE BREAKPOINT: three in a row only where each card would draw at least this wide in CSS px (the text
	 *  was approved down to a 230 px card: body copy 9.5 px). Under it: one card at a time. */
	minThreeUpCssWidth: 250,
	/** no card draws wider than this in CSS px: the frame picture is 768 px wide, 2 device px per CSS px */
	maxCssWidth: 384,
	/** master px kept clear between the cards and the logo above / the loading bar below them */
	clearance: 12,
	/** master px between a card and the screen's side edges */
	sideMargin: 12,
	/** master px between cards in the row */
	rowGap: 22,
	/** one card at a time, upright screens: the strip under the card that holds the dots (master px) */
	dotsStrip: 30,
	/** one card at a time, sideways screens: the logo and the bar share a column on the left, the card stands on
	 *  the right as tall as the screen allows. Column width per master (the widest thing in it is the PRESS
	 *  ANYWHERE line), the logo's width and centre height in it, the gap to the card, the room the dots take to
	 *  the card's right, and the card's margin from the screen's top and bottom edges. All master px. */
	side: {
		landscape: { column: 420, logoWidth: 380, logoCy: 280, gap: 40, dots: 44, edge: 12 },
		phone: { column: 640, logoWidth: 460, logoCy: 290, gap: 40, dots: 60, edge: 12 },
		portrait: { column: 0, logoWidth: 0, logoCy: 0, gap: 0, dots: 0, edge: 0 }, // never sideways
	} satisfies Record<LayoutKind, { column: number; logoWidth: number; logoCy: number; gap: number; dots: number; edge: number }>,
	/** a card appears over this long once its frame picture is decoded, ms */
	fadeInMs: 350,
	/** one card at a time: the change from one card to the next, ms, and how far the incoming one slides (master px) */
	swapMs: 350,
	swapSlide: 18,
	/** the scene line's cross-fade, ms */
	sceneFadeMs: 180,
	/** a clip counts as "played once" this close to its end, seconds (or when its time wraps) */
	endSlackSeconds: 0.12,
	/** one card at a time, the visible card's clip NOT running (reduced motion, autoplay refused, a slow or failed
	 *  file): move on after this long, ms */
	stillDwellMs: 7000,
	/** ...and a clip that started but never reaches its end is given its length plus this, ms */
	stallGraceMs: 8000,
	/** a drag at least this long (CSS px), more sideways than up or down, changes the card; anything less is the continue press */
	swipeMinPx: 36,
	/** the dots: drawn size and the touch target around each, master px per LayoutKind (the phone master is drawn at about half size) */
	dot: {
		landscape: { size: 10, hit: 30 },
		portrait: { size: 9, hit: 28 },
		phone: { size: 18, hit: 56 },
	} satisfies Record<LayoutKind, { size: number; hit: number }>,
	/** WHEN THE CARDS MAY ASK FOR THEIR FILES. They are decoration and must never make PRESS ANYWHERE later.
	 *  'loaded': nothing of the cards (frame, posters, title face, clips) is asked for until the loading bar is
	 *  done, so nothing of theirs shares the link or the processor with what the gate waits on.
	 *  'preload': the frame, the posters and the text come in as soon as the Pixi preload is in, so the cards can
	 *  be read while the audio is still loading (289 KB beside the audio's 2.0 MB).
	 *  Measured 2026-10-12 (tools/manticore/landing_probe.js `timing`, seven cold loads, dev server, headless, median
	 *  ms to PRESS ANYWHERE at 1440x900 / 390x844): before the cards 1497 / 1029; 'loaded' 1484 / 950; 'preload'
	 *  1546 / 1017. On a link the download fills, 'preload' also costs the time 289 KB take. */
	armAfter: 'loaded' as 'loaded' | 'preload',
	/** true: with armAfter 'preload', the CLIPS still wait for the loading bar (posters until then). false: they
	 *  start as soon as the cards are up (three clips decoding beside the audio: 1839 / 1089 ms, the slowest). */
	holdClipsUntilLoaded: true,
} as const;

/** the slate's text, style D "Engraved brass" (card_text_final.json). Sizes and positions are in CARD-WIDTH
 *  UNITS: 1 = 1% of the card's width; positions are from the card's top edge; the card is 150 tall. */
export const INTRO_CARD_STYLE = {
	side: 14,
	title: { top: 65.5, height: 11, size: 7.3, weight: 700, letterSpacingEm: 0.05, color: '#c2a063', font: "'Cinzel', 'Times New Roman', serif" },
	/** the title's cut edge and lower highlight: y offsets in card-width units */
	titleEdge: { darkY: -0.22, dark: 'rgba(0,0,0,.9)', lightY: 0.2, light: 'rgba(255,236,190,.28)' },
	body: { top: 77.5, height: 26, size: 4.15, weight: 400, lineHeight: 1.38, color: '#ddd3bb', font: "'Sora', system-ui, sans-serif" },
	highlight: { color: '#e0b860', weight: 600 },
	rule: { top: 105.5, side: 16, height: 0.28, color: 'rgba(233,196,106,.8)' },
	scene: { top: 107.5, height: 17, size: 3.7, weight: 600, lineHeight: 1.3, color: '#e0b860', font: "'Sora', system-ui, sans-serif" },
} as const;

/** the gate along the bottom (loading bar, then PRESS ANYWHERE): per-kind sizes, master px */
export const INTRO_GATE: Record<LayoutKind, { tag: number; barW: number; barH: number; press: number; pad: number }> = {
	landscape: { tag: 14, barW: 420, barH: 10, press: 18, pad: 16 },
	portrait: { tag: 13, barW: 280, barH: 10, press: 17, pad: 16 },
	phone: { tag: 22, barW: 520, barH: 14, press: 30, pad: 26 },
};
/** the gap between the bar and its readout (ui/LandingScreen.svelte .gate) and a text line's height per px of font size */
const GATE_ROW_GAP = 8;
const GATE_LINE = 1.3;
/** the readout's font size under the bar */
export const introGatePctSize = (kind: LayoutKind) => Math.max(10, INTRO_GATE[kind].tag * 0.8);
/** the highest y (master px) anything of the gate reaches: the bar with its readout, or the press line */
export const introGateTop = (kind: LayoutKind) => {
	const g = INTRO_GATE[kind];
	const tall = Math.max(g.barH + GATE_ROW_GAP + introGatePctSize(kind) * GATE_LINE, g.press * GATE_LINE);
	return MASTER[kind].height - g.pad - tall;
};

/** logo width + centre (master px): the stacked logo, centred above the cards (constants LOGO.landing) */
export const INTRO_LOGO: Record<LayoutKind, { w: number; cx: number; cy: number }> = {
	landscape: { w: LOGO.landing.landscape.width, cx: LOGO.landing.landscape.cx, cy: LOGO.landing.landscape.cy },
	phone: { w: LOGO.landing.phone.width, cx: LOGO.landing.phone.cx, cy: LOGO.landing.phone.cy },
	portrait: { w: LOGO.landing.portrait.width, cx: LOGO.landing.portrait.cx, cy: LOGO.landing.portrait.cy },
};
export const INTRO_LOGO_SHINE_MS = 4500; // the sweep's idle period (Corey: shine, 4.5 s)
/** the stacked logo picture's height per px of width (static/assets/ui/logo-stacked.webp is 1190 x 470, the art box of LOGO.art) */
const LOGO_ASPECT = LOGO.art.height / LOGO.art.width;

/** how the cards stand: `row` three across; `stack` one at a time under the logo (upright screens);
 *  `side` one at a time beside the logo (sideways screens too low for a row) */
export type IntroMode = 'row' | 'stack' | 'side';

export type IntroPlacement = {
	mode: IntroMode;
	/** master px per CSS px is 1 / scale; the master's offset in the viewport, CSS px */
	scale: number;
	left: number;
	top: number;
	/** the card's size, master px */
	cardW: number;
	cardH: number;
	/** each card's centre, master px (one at a time: the three share one place) */
	slots: { x: number; y: number }[];
	logo: { w: number; cx: number; cy: number };
	/** the gate's centre x, master px */
	gateCx: number;
	/** the dots' centre and direction, master px; null in the row */
	dots: { x: number; y: number; vertical: boolean } | null;
};

/** WHERE EVERYTHING ON THE LANDING SCREEN STANDS, for a LayoutKind and the real viewport (CSS px).
 *
 *  The master (MASTER[kind]) is fitted into the viewport as everywhere else; the logo and the gate keep their
 *  master places, and the cards take the band between them:
 *   1. three in a row, each as large as the band allows (never over maxCssWidth). Used where a card then draws
 *      at least minThreeUpCssWidth wide: 1440x900 and 1280x720 (and a large tablet held upright).
 *   2. else, upright screens (kind portrait): one card in the same band with the dots under it
 *      (390x844, 360x640, 768x1024).
 *   3. else, sideways screens (kind phone, or a low desktop window): the band under the logo is too low for a
 *      readable card, so the logo and the gate move into a column on the left and one card stands on the right
 *      as tall as the screen, dots to its right (844x390, 667x375). */
export const introPlacement = (kind: LayoutKind, viewportWidth: number, viewportHeight: number): IntroPlacement => {
	const master = MASTER[kind];
	const C = INTRO_CARD;
	const scale = Math.min(viewportWidth / master.width, viewportHeight / master.height) || 1;
	const left = (viewportWidth - master.width * scale) / 2;
	const top = (viewportHeight - master.height * scale) / 2;
	// the viewport in master px (wider or taller than the master on the axis that did not bind the fit)
	const visW = viewportWidth / scale;
	const visH = viewportHeight / scale;
	const cx = master.width / 2;
	const cy = master.height / 2;
	const maxW = C.maxCssWidth / scale;

	const logo = INTRO_LOGO[kind];
	const bandTop = logo.cy + (logo.w * LOGO_ASPECT) / 2 + C.clearance;
	const bandBottom = introGateTop(kind) - C.clearance;
	const bandH = Math.max(bandBottom - bandTop, 0);
	const bandW = Math.max(visW - 2 * C.sideMargin, 0);
	const bandCy = (bandTop + bandBottom) / 2;

	const w3 = Math.min((bandW - 2 * C.rowGap) / 3, bandH * C.aspect, maxW);
	if (w3 * scale >= C.minThreeUpCssWidth) {
		return {
			mode: 'row', scale, left, top, cardW: w3, cardH: w3 / C.aspect,
			slots: [-1, 0, 1].map((k) => ({ x: cx + k * (w3 + C.rowGap), y: bandCy })),
			logo, gateCx: cx, dots: null,
		};
	}

	if (kind === 'portrait') {
		const w1 = Math.max(Math.min(bandW, (bandH - C.dotsStrip) * C.aspect, maxW), 0);
		const h1 = w1 / C.aspect;
		const y = bandCy - C.dotsStrip / 2;
		return {
			mode: 'stack', scale, left, top, cardW: w1, cardH: h1,
			slots: [0, 1, 2].map(() => ({ x: cx, y })),
			logo, gateCx: cx, dots: { x: cx, y: y + h1 / 2 + C.dotsStrip / 2, vertical: false },
		};
	}

	const S = C.side[kind];
	const roomW = visW - 2 * C.sideMargin - S.column - S.gap - S.dots;
	const w1 = Math.max(Math.min((visH - 2 * S.edge) * C.aspect, roomW, maxW), 0);
	const x0 = cx - (S.column + S.gap + w1 + S.dots) / 2;
	const cardCx = x0 + S.column + S.gap + w1 / 2;
	const columnCx = x0 + S.column / 2;
	return {
		mode: 'side', scale, left, top, cardW: w1, cardH: w1 / C.aspect,
		slots: [0, 1, 2].map(() => ({ x: cardCx, y: cy })),
		logo: { w: S.logoWidth, cx: columnCx, cy: S.logoCy },
		gateCx: columnCx,
		dots: { x: cardCx + w1 / 2 + S.dots / 2, y: cy, vertical: true },
	};
};
