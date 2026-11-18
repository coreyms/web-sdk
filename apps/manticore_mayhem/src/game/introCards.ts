// The opening primer (ui/LandingScreen.svelte): three ANIMATED explainer cards over the backdrop
// while the audio lands: CLUSTERS, SCATTERS, MANTICORE (approved 2026-10-12, review page
// "intro_cards_r3"; they replace milestone 1's placeholder posters card-1..3.webp, whose files left
// static/ on 2026-10-14 and are archived on the Desktop). Their slate since intro cards round 3 (2026-11-18): image
// lettering and one plain line, the block centered between the frame's two engraved points (INTRO_SLATE below).
//
// A card is: a muted looping clip in the frame's glass window, the frame picture on top of it, and
// the slate under it: the header, the lettering and pictures (game/introSlateSpec.ts) and the plain line. The strings are
// in game/introCardText.ts; every number is here.
//
// Where the screen has room for three cards they stand in a row; where it has not, ONE card shows at
// a time and the cards rotate (Corey: "these framed explainers will need to rotate on smaller
// viewports"). introPlacement() below decides, from the real viewport.
import { LOGO } from './constants';
import { MASTER, type LayoutKind } from './layoutSpec';
import type { IntroCardKey } from './introCardText';

/** static/assets/ui/intro: the frame (768 x 1152, re-encoded from the approved 1024 x 1536 card_frame.webp),
 *  the slate's lettering atlas (tools/build_intro_slate.py, game/introSlateSpec.ts), and per card a 640 x 260 H.264 clip
 *  (30 fps, no audio track) and its poster */
export const INTRO_CARD_ASSETS = {
	frame: '/assets/ui/intro/card-frame.webp',
	slate: '/assets/ui/intro/intro-slate.webp',
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
	/** THE CARDS LOAD ON THE POLYMATH SPLASH (2026-10-20, Corey: "the explainer card videos need to load on the Polymath
	 *  splash screen, so they are ready when the landing screen drops"). The frame, the posters, the Cinzel title face and
	 *  the three clips (about 2.0 MB, the clips 1.68 MB of it) load while the splash is up, as part of its bytes
	 *  (game/boot.svelte.ts startCards, from when the logo and the two faces are in, beside the Pixi preload); the splash
	 *  waits for them, and the cards are up and their clips start the moment the splash starts to fade.
	 *  THE CAP: once everything else the splash waits on is in, it waits at most this long more for the cards, ms. Past it
	 *  the splash moves on and the cards fall back to the rules below (armAfter, holdClipsUntilLoaded), their files still
	 *  coming in. A clip that fails leaves its poster and counts as in. */
	splashCapMs: 3000,
	/** THE FALLBACK (the cards missed the splash's cap). WHEN THE CARDS MAY ASK FOR THEIR FILES. They are decoration and must never make PRESS ANYWHERE later.
	 *  'loaded': nothing of the cards (frame, posters, title face, clips) is asked for until the loading bar is
	 *  done, so nothing of theirs shares the link or the processor with what the gate waits on.
	 *  'preload': the frame, the posters and the text come in as soon as the Pixi preload is in, so the cards can
	 *  be read while the audio is still loading (289 KB beside the audio's 2.0 MB).
	 *  Measured 2026-10-12 (tools/manticore/landing_probe.js `timing`, seven cold loads, dev server, headless, median
	 *  ms to PRESS ANYWHERE at 1440x900 / 390x844): before the cards 1497 / 1029; 'loaded' 1484 / 950; 'preload'
	 *  1546 / 1017. On a link the download fills, 'preload' also costs the time 289 KB take.
	 *  'audio' (first-minute plan D, 2026-10-16; the default since): once the audio is in. PRESS ANYWHERE then waits for
	 *  THE GATE (constants LOAD_GATE) for up to 10 s more, and the cards are what the player reads meanwhile; they never
	 *  share the link with the audio, only with the gate's files (289 KB beside its 4 to 11 MB). */
	armAfter: 'audio' as 'loaded' | 'preload' | 'audio',
	/** (the fallback too) true: with armAfter 'preload' or 'audio', the CLIPS still wait for the loading bar (posters until then). false: they
	 *  start as soon as the cards are up (three clips decoding beside the audio: 1839 / 1089 ms, the slowest). */
	holdClipsUntilLoaded: true,
} as const;

/** THE SLATE (intro cards round 3, header H1, Corey 2026-11-18). Sizes and positions in CARD-WIDTH UNITS (1 = 1 % of the
 *  card's width, --u in ui/LandingScreen.svelte); the card is 150 tall.
 *
 *  THE BLOCK IS CENTERED BETWEEN THE FRAME'S TWO ENGRAVED POINTS (Corey 2026-11-18: "There are two points on the line work
 *  in the black area that should be considered the top and bottom of the display areas, and the entire content just needs
 *  to be moved up so it's centered between the two points"). `points` are measured on static/assets/ui/intro/card-frame.webp
 *  (768 x 1152) on its center column x 383: `top` the tip of the engraved V notch at the top of the dark slate (the
 *  center line of the outer V's gold line where it turns, rows 456 to 459 lit, brightest 458), `bottom` the tip of the
 *  small engraved chevron at its foot (the outer chevron's line where it turns, rows 1000 to 1002, brightest 1001). They
 *  are frame px, so the centering follows the frame picture wherever and however large it is drawn.
 *
 *  The block is everything from the header's cap top to the bottom of the plain line's last line box: the mock's own
 *  spacing inside it (game/introSlateSpec.ts INTRO_SLATE_ZONES and the pieces' places), moved as one. It is centered by
 *  layout (a flex column between the two points), so it holds at every size. A block taller than the span less `margin`
 *  at each end is scaled down about its center to fit (ui/LandingScreen.svelte fitSlates), never let to overlap a point. */
export const INTRO_SLATE = {
	frame: { w: 768, h: 1152 },
	points: { top: 457.5, bottom: 1001 },
	/** card-width units kept clear between the block and each point, at the least (only a block that would come closer is scaled) */
	margin: 1.5,
	/** the plain line: the mock's .one */
	line: { size: 4.0, weight: 500, lineHeight: 1.28, color: '#ddd3bb', font: "'Sora', system-ui, sans-serif", side: 14 },
	/** the two rules (the mock's .rule): inset from the card's sides, thickness (at least 1 px), color */
	rule: { side: 16, height: 0.28, color: 'rgba(233,196,106,.8)' },
	/** a lifted tile (INTRO_TILE_LIFT): its transform and how fast it goes up and down, ms */
	tileLift: { transform: 'translateY(-12%) scale(1.1)', ms: 180 },
} as const;
/** THE MAX WIN LINE CANDIDATES (2026-11-18, Corey "yes" to the max win back on the intro; not chosen yet). One line of image
 *  lettering OUTSIDE the cards (tools/build_intro_slate.py, game/introMaxlineSpec.ts; the words: introCardText
 *  INTRO_MAX_WIN), shown only with the DEV / staging switch ?maxline=1|2|3 (game/staging.ts MAXLINE_CANDIDATE); without it
 *  nothing here is used and the landing is the approved one.
 *   1  under the cards, over the gate: "WIN UP TO 10,000x" in the H1 gold, the rest smaller in ivory (art m1)
 *   2  the same place, the whole phrase in the ivory headline face, smaller (art m2)
 *   3  between the logo and the cards, art m1: it reads as the logo's own promise, and the strip over the gate stays the
 *      loading bar's and PRESS ANYWHERE's alone
 *  The line takes its height from the cards' band (they shrink a little and keep their slate exactly as approved); in the
 *  side layout it stands in the logo's column (under the logo for 3, midway to the gate for 1 and 2). `cap`: the line's
 *  reference cap height per LayoutKind, master px (m1 the gold cap, m2 the ivory cap); `gap`: master px between the line
 *  and the cards; a line wider than its room is drawn smaller to fit. `maxCapCss`: the cap is never drawn taller than this
 *  many CSS px (the tool bakes at 3 px per CSS px of it; keep it in this one-line form, the tool reads it). */
export const INTRO_MAXLINE = {
	maxCapCss: { m1: 27, m2: 18 },
	gap: 10,
	candidates: {
		1: { art: 'm1', where: 'below', cap: { landscape: 18, portrait: 14, phone: 26 } },
		2: { art: 'm2', where: 'below', cap: { landscape: 12, portrait: 10, phone: 18 } },
		3: { art: 'm1', where: 'above', cap: { landscape: 18, portrait: 14, phone: 26 } },
	},
} as const satisfies { maxCapCss: Record<'m1' | 'm2', number>; gap: number; candidates: Record<1 | 2 | 3, { art: 'm1' | 'm2'; where: 'below' | 'above'; cap: Record<LayoutKind, number> }> };
export type IntroMaxlineCandidate = 1 | 2 | 3;

/** a point's height in card-width units from the card's top (the card is the frame picture, 100 units wide) */
export const introSlatePointY = (which: 'top' | 'bottom') => (INTRO_SLATE.points[which] / INTRO_SLATE.frame.w) * 100;

/** the gate along the bottom (loading bar, then PRESS ANYWHERE): per-kind sizes, master px. `barH` is the bar's drawn
 *  height: since the bar is the splash's segmented bar (2026-10-21, LANDING_BAR) it is the splash's, 1.8 x its 10 px
 *  base (src/app.html .gbar), on the desktop and the portrait phone (was 10); the sideways phone keeps its 14 so its
 *  landing layout stays as it is (Corey 2026-10-21) */
/** The max win line that stood over the gate (2026-10-21) is gone: its row took height from the cards and turned
 *  mid-size desktop windows into the one-card side layout. The max win is stated in the CLUSTERS clip's last scene
 *  instead (Corey 2026-10-23), and left the intro with the scene lines in round 3 (2026-11-18) */
export const INTRO_GATE: Record<LayoutKind, { tag: number; barW: number; barH: number; press: number; pad: number }> = {
	landscape: { tag: 14, barW: 420, barH: 18, press: 18, pad: 16 },
	portrait: { tag: 13, barW: 280, barH: 18, press: 17, pad: 16 },
	phone: { tag: 22, barW: 520, barH: 14, press: 30, pad: 26 },
};

/** THE LANDING SCREEN'S LOADING BAR IS THE SPLASH'S (Corey 2026-10-21: "We should update the Landing Screen Statusbar to
 *  have the same look as the splash screen"). The splash's segmented game bar (src/app.html .gbar, the PolyMath splash
 *  of 2026-10-21): `segments` skewed segments lit whole (100 / segments points each), a big jump lighting them
 *  `staggerMs` apart, the lit ones in the splash's red, a shine sweeping the lit part, a spark at the leading edge, the
 *  readout "LOADING · N%". The percent carries on from where the splash's bar stood (game/boot.svelte.ts splashShare: the
 *  splash's bar climbs to that share and stops), and the segments the splash had lit are lit from the first frame, so
 *  the handoff reads as one bar. Transforms and opacity only; reduced motion: no shine, no spark, no pop. */
export const LANDING_BAR = {
	segments: 20,
	staggerMs: 45,
	/** the bar's skew, degrees (the splash's -14) */
	skewDeg: -14,
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

/** logo width + centre (master px): the tablet, centred above the cards (constants LOGO.landing) */
export const INTRO_LOGO: Record<LayoutKind, { w: number; cx: number; cy: number }> = {
	landscape: { w: LOGO.landing.landscape.width, cx: LOGO.landing.landscape.cx, cy: LOGO.landing.landscape.cy },
	phone: { w: LOGO.landing.phone.width, cx: LOGO.landing.phone.cx, cy: LOGO.landing.phone.cy },
	portrait: { w: LOGO.landing.portrait.width, cx: LOGO.landing.portrait.cx, cy: LOGO.landing.portrait.cy },
};
/** the tablet's height per px of width (static/assets/ui/logo-tablet.webp, LOGO.art): the cards' band starts under its
 *  own bottom edge (since 2026-11-17: the old stacked logo's box was 17 % taller, and the band followed that) */
const LOGO_ASPECT = LOGO.art.height / LOGO.art.width;
/** THE LANDING LOGO'S CAP (constants LOGO.landingMaxCss): no wider than that many CSS px, same centre and aspect. The
 *  cards' band keeps the uncapped box (they do not move); only the drawn logo is held. */
const capLogo = (logo: { w: number; cx: number; cy: number }, scale: number) => (logo.w * scale > LOGO.landingMaxCss ? { ...logo, w: LOGO.landingMaxCss / scale } : logo);

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
	/** the max win line candidate's box (center and size, master px), only when one is asked for (INTRO_MAXLINE) */
	maxline: { cx: number; cy: number; w: number; h: number } | null;
};
/** a max win line to make room for: where it stands and its natural size, master px */
export type IntroLineAsk = { where: 'below' | 'above'; w: number; h: number };

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
export const introPlacement = (kind: LayoutKind, viewportWidth: number, viewportHeight: number, line: IntroLineAsk | null = null): IntroPlacement => {
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
	const fullTop = logo.cy + (logo.w * LOGO_ASPECT) / 2 + C.clearance;
	const fullBottom = introGateTop(kind) - C.clearance;
	const bandW = Math.max(visW - 2 * C.sideMargin, 0);
	// THE MAX WIN LINE (a candidate, INTRO_MAXLINE): its height and a gap come off the cards' band, at the bottom (over the
	// gate) or at the top (under the logo); drawn smaller where it is wider than the band
	const lk = line ? Math.min(1, bandW / line.w) : 1;
	const lineH = line ? line.h * lk : 0;
	const reserve = line ? lineH + INTRO_MAXLINE.gap : 0;
	const bandTop = fullTop + (line?.where === 'above' ? reserve : 0);
	const bandBottom = fullBottom - (line?.where === 'below' ? reserve : 0);
	const bandH = Math.max(bandBottom - bandTop, 0);
	const bandCy = (bandTop + bandBottom) / 2;
	const bandLine = line ? { cx, cy: line.where === 'above' ? fullTop + lineH / 2 : fullBottom - lineH / 2, w: line.w * lk, h: lineH } : null;

	const w3 = Math.min((bandW - 2 * C.rowGap) / 3, bandH * C.aspect, maxW);
	if (w3 * scale >= C.minThreeUpCssWidth) {
		return {
			mode: 'row', scale, left, top, cardW: w3, cardH: w3 / C.aspect,
			slots: [-1, 0, 1].map((k) => ({ x: cx + k * (w3 + C.rowGap), y: bandCy })),
			logo: capLogo(logo, scale), gateCx: cx, dots: null, maxline: bandLine,
		};
	}

	if (kind === 'portrait') {
		const w1 = Math.max(Math.min(bandW, (bandH - C.dotsStrip) * C.aspect, maxW), 0);
		const h1 = w1 / C.aspect;
		const y = bandCy - C.dotsStrip / 2;
		return {
			mode: 'stack', scale, left, top, cardW: w1, cardH: h1,
			slots: [0, 1, 2].map(() => ({ x: cx, y })),
			logo: capLogo(logo, scale), gateCx: cx, dots: { x: cx, y: y + h1 / 2 + C.dotsStrip / 2, vertical: false }, maxline: bandLine,
		};
	}

	const S = C.side[kind];
	const roomW = visW - 2 * C.sideMargin - S.column - S.gap - S.dots;
	const w1 = Math.max(Math.min((visH - 2 * S.edge) * C.aspect, roomW, maxW), 0);
	const x0 = cx - (S.column + S.gap + w1 + S.dots) / 2;
	const cardCx = x0 + S.column + S.gap + w1 / 2;
	const columnCx = x0 + S.column / 2;
	// the line in the logo's column: under the logo (above), or midway between the logo and the gate (below)
	let sideLine: IntroPlacement['maxline'] = null;
	if (line) {
		const k = Math.min(1, (S.column - 2 * C.sideMargin) / line.w);
		const h = line.h * k;
		const logoBottom = S.logoCy + (S.logoWidth * LOGO_ASPECT) / 2;
		const y = line.where === 'above' ? logoBottom + C.clearance + h / 2 : (logoBottom + introGateTop(kind)) / 2;
		sideLine = { cx: columnCx, cy: y, w: line.w * k, h };
	}
	return {
		mode: 'side', scale, left, top, cardW: w1, cardH: w1 / C.aspect,
		slots: [0, 1, 2].map(() => ({ x: cardCx, y: cy })),
		logo: capLogo({ w: S.logoWidth, cx: columnCx, cy: S.logoCy }, scale),
		gateCx: columnCx,
		dots: { x: cardCx + w1 / 2 + S.dots / 2, y: cy, vertical: true },
		maxline: sideLine,
	};
};
