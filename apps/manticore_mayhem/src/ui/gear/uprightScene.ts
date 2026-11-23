// THE UPRIGHT PHONE'S SCENE UNDER THE GEAR TRAIN: one table and one rule (2026-11-23).
//
// WHY. The train was first fitted into whatever the shipped portrait scene left under the spin amount plaque. A phone
// browser gives the game far less height than the phone's screen (measured on Corey's iPhone, 440 x 956: Stake full
// screen 440 x 742, Stake's framed page 413 x 586), so on real frames the train drew at half size or the old dock came
// back. Corey 2026-11-23: "it's okay to move the manticore/board and logo upwards, but my intent yesterday was to have
// the Win AMount and Balance on the bottom section of the screen. I expect in some cases the Manticore will need to be
// made smaller or the tail go slightly off the screen at the top (which is fine if barely)."
//
// THE RULE, for an upright phone that draws the gear train (ui/gear/gearLayout.ts uprightLayout takes its band from
// here; game/layoutSpec.ts frameFor, game/logo/layout.ts and components/Background.svelte draw the scene from it):
//   1. THE TRAIN'S FULL BAND is his own at 402 x 874 (the plaque's shadow down to the bottom edge, 155.4 px) times the
//      window's width over 402.
//   2. LIFT. The shipped scene keeps its sizes and moves up until that band is free under the plaque. It stops where the
//      Manticore's idle tail tip is `tailOver` CSS px past the top edge (he stands on the frame's top bar, so he rides up
//      with the board), or where the logo, at its smallest, would meet the clock line.
//   3. SHRINK, only where the lift is not enough. The board and the train come down to the SAME share `u` of their
//      full-width sizes (the board as it is on his window against the window's width; a board the shipped rule already
//      draws smaller than that is left alone until the train is as small). The Manticore is never larger against the
//      board than on his window, so he comes down with it. u is the largest share at which the scene and the band fill
//      the window's height exactly.
//   4. THE LOGO keeps its left edge and moves up with its bottom edge `logoGap` over the frame art; where the clock line
//      is in the way it is drawn smaller, and smaller again until its box is `wingGap` clear of the Manticore's left
//      wing in the rows they now share (in the shipped scene the wing stands under the logo; moved up, beside it),
//      never under `logoMin` of its size.
// A window tall enough for the shipped scene and the full band (his 402 x 874) is not touched at all, and neither is
// one within `slack` of it (430 x 932, 440 x 956: the train takes the band the shipped scene leaves, as before).
//
// Pure: no DOM, no runes. tools/gear_layout_test.mjs sweeps it in node over every frame of the phone size survey.
import { MASTER, artRectOf, portraitFramePlaced, portraitFrameShipped, registrationOf, type PortraitScene } from '../../game/layoutSpec';
import { portraitBoardBottoms } from '../hud/hudLayout';
import { CREATURE, LOGO, LOGO_KEY } from '../../game/constants';
import { SCENE_SPEC_PORTRAIT } from '../../game/sceneSpec';
import { CREATURE_SPEC } from '../../game/creatureSpec';

export const UPRIGHT_SCENE = {
	/** his window (ui/gear/gearLayout.ts UPRIGHT.window) and the band his train stands in there (874 - UPRIGHT.bandTop) */
	window: { vw: 402, vh: 874 },
	band: 155.406,
	/** the Manticore's drawn shape, rows of his 1024 px rig canvas (read off the shipped atlases' trimmed frames, every
	 *  look the same rig): the top of the idle loop, and of his tallest pose (win_mega 80; the roar 88, the look 98) */
	creature: { idleTop: 112, tallTop: 80 },
	/** how far his idle tail tip may stand past the window's top edge, CSS px (Corey: "fine if barely") */
	tailOver: 6,
	/** the clock line's bottom edge, master px (ui/ClockStrip.svelte: top 10, 12 px type), the gap the logo keeps to it
	 *  and to the frame art (CSS px), and the least the logo is drawn at */
	clockBottom: 26,
	logoGap: 2,
	logoMin: 0.6,
	/** the clear gap the logo's box keeps to the Manticore's left edge in the rows they share, CSS px (the harsh review
	 *  of 2026-10-20: "the creature's left wing touches the logo's right wing"; tools/manticore/logo_probe.js holds 3 px
	 *  between their drawn pixels) */
	wingGap: 5,
	/** the search's floor for the common share u: under it nothing is solved (the train's own rule then says no) */
	uMin: 0.3,
	/** a window whose shipped band is within this share of the full band is left exactly as shipped (the train takes the
	 *  band it has, as before): the tall phones, where 1 or 2 px of lift would move a scene nobody asked to move */
	slack: 0.02,
} as const;

/** THE MANTICORE'S LEFT EDGE: [rig row, x] for every 16 rows of his 1024 px rig canvas, the leftmost drawn pixel (alpha
 *  over 96) of that band over every frame of the base game's clips (idle, idle_look, roar, swipe, snarl, growl), read
 *  off the shipped day atlases. His left wing is rows 384 to 672. In the shipped scene the wing stands just under the
 *  logo; moved up with the board it stands beside it, so the logo is drawn narrow enough to stay clear (rule 4). */
const LEFT_EDGE: readonly (readonly [number, number])[] = [[80,480],[96,403],[112,360],[128,328],[144,312],[160,291],[176,299],[192,310],[208,331],[224,441],[240,449],[256,457],[272,464],[288,470],[304,393],[320,350],[336,241],[352,184],[368,153],[384,129],[400,112],[416,102],[432,96],[448,94],[464,92],[480,84],[496,80],[512,78],[528,78],[544,80],[560,78],[576,78],[592,80],[608,83],[624,86],[640,88],[656,94],[672,123],[688,131],[704,137],[720,145],[736,187],[752,208],[768,222],[784,236],[800,236],[816,238],[832,241],[848,246],[864,212],[880,201],[896,195],[912,195],[928,198],[944,230]];
const LEFT_EDGE_BAND = 16;

type Shipped = ReturnType<typeof shippedAt>;
/** what the shipped portrait scene draws in a phone window (CSS px) */
const shippedAt = (vw: number, vh: number) => {
	const M = MASTER.portrait;
	const fit = Math.min(vw / M.width, vh / M.height);
	const top0 = (vh - M.height * fit) / 2;
	const frame = portraitFrameShipped(vw / fit, { masterHeight: vh / fit, cssPerMaster: fit, phone: true });
	const reg = registrationOf(frame);
	const art = artRectOf(frame);
	const B = portraitBoardBottoms(vw, vh, frame);
	const artTop = top0 + art.y * fit;
	const D = CREATURE.portraitDock;
	// the dock that ships (constants CREATURE.portraitDock.default, 'A': his claw on the frame's top bar at his own
	// size). The DEV options ('current', B, C: components/Background.svelte) are not followed here
	const dock = D.default === 'current' ? D.options.A : D.options[D.default];
	// the frame's top bar (the row his claw docks on) under the art's top edge
	const bar = (reg.map(0, D.edges[dock.edge]).y - art.y) * fit;
	// the Manticore: his spot's scale through the portrait scene's cover fit, CSS px per rig px
	const [fw, fh] = SCENE_SPEC_PORTRAIT.frame;
	const cover = Math.max(vw / fw, vh / fh);
	const creature = CREATURE.place.portraitPhone.scale * dock.size * cover;
	// his feet column on the screen (his spot's x through the cover fit; he is never moved sideways)
	const feetX = (vw - fw * cover) / 2 + CREATURE.place.portraitPhone.x * cover;
	// COPY OF game/logo/layout.ts logoArtRect (portrait phone): LOGO_KEY.grow.portraitPhone's width and bottom edge
	const G = LOGO_KEY.grow.portraitPhone;
	const lw = G?.width ?? LOGO.portraitPhone.width;
	const lh = lw / (LOGO.art.width / LOGO.art.height);
	const logoBottom = top0 + (G ? G.bottom : LOGO.portraitPhone.cy + lh / 2) * fit;
	return { fit, top0, frame, artTop, stack: B.shadow.y1 - artTop, shadowBottom: B.shadow.y1, boardK: reg.m * fit, bar, creature, feetX, logo: { w: lw * fit, h: lh * fit, bottom: logoBottom, bottomMaster: G ? G.bottom : LOGO.portraitPhone.cy + lh / 2 } };
};
let ref: { boardK: number; perBoard: number } | null = null;
/** his window's own numbers: the board's scale there and the Manticore's size against it */
const reference = () => {
	if (!ref) {
		const S = shippedAt(UPRIGHT_SCENE.window.vw, UPRIGHT_SCENE.window.vh);
		ref = { boardK: S.boardK, perBoard: S.creature / S.boardK };
	}
	return ref;
};

export type UprightScene = ReturnType<typeof uprightScene>;
export const uprightScene = (vw: number, vh: number, safeBottom = 0) => {
	const T = UPRIGHT_SCENE;
	const S: Shipped = shippedAt(vw, vh);
	const R = reference();
	const w = vw / T.window.vw;
	const band = T.band * w;
	const floor = vh - Math.max(0, safeBottom);
	const claw = CREATURE.portraitDock.claw.y;
	/** the shipped board against the full-width board */
	const beta = S.boardK / (R.boardK * w);
	const clock = S.top0 + T.clockBottom * S.fit;
	// (`cap`: the Manticore held to his own window's size against the board. Only where the scene has to come down: a
	// window with the height for everything keeps him exactly as shipped, whatever his size against the board there)
	const at = (u: number, cap = true) => {
		const board = Math.min(1, u / beta);
		const gears = Math.min(1, u);
		const creature = cap ? Math.min(S.creature, R.perBoard * S.boardK * board) : S.creature;
		// the art's top edge at its highest: his idle tail tip tailOver past the top edge; the logo at its smallest under the clock line
		const top = Math.max((claw - T.creature.idleTop) * creature - S.bar * board - T.tailOver, clock + 2 * T.logoGap + T.logoMin * S.logo.h);
		return { board, gears, creature, top, need: top + S.stack * board + band * gears };
	};
	let u = 1;
	let a = at(1, false);
	let fits = true;
	const asIs = floor - S.shadowBottom >= band * (1 - T.slack);
	if (!asIs && a.need > floor) {
		let lo: number = T.uMin;
		let hi = 1;
		fits = at(lo).need <= floor;
		for (let i = 0; i < 40 && fits; i++) {
			const mid = (lo + hi) / 2;
			if (at(mid).need <= floor) lo = mid;
			else hi = mid;
		}
		u = lo;
		a = at(u);
	}
	// the art's top edge: as high as the full band asks and no higher; never lower than the shipped scene has it unless
	// the Manticore's tail asks (a short window where the shipped scene already cuts him)
	const artTop = asIs ? S.artTop : u < 1 ? floor - S.stack * a.board - band * a.gears : Math.min(S.artTop, Math.max(a.top, floor - S.stack - band));
	const frame = portraitFramePlaced(S.frame, a.board, (artTop - S.top0) / S.fit);
	const bottoms = portraitBoardBottoms(vw, vh, frame);
	const row = (r: number) => artTop + S.bar * a.board - (claw - r) * a.creature;
	// the logo: its bottom edge logoGap over the frame art (never lower than shipped), drawn smaller only where the clock line is in the way
	const logoBottom = asIs ? S.logo.bottom : Math.min(S.logo.bottom, artTop - T.logoGap);
	let logoScale = asIs ? 1 : Math.max(T.logoMin, Math.min(1, (logoBottom - clock - T.logoGap) / S.logo.h));
	// ...and narrow enough to stand clear of his left edge in the rows they share (LEFT_EDGE; the logo's box is taken
	// whole, its left edge by the game's own rule: LOGO.portraitPhoneEdge, edgeCss in from the screen's edge)
	const E = LOGO.portraitPhoneEdge;
	for (; !asIs && logoScale > T.logoMin; logoScale = Math.max(T.logoMin, logoScale - 0.01)) {
		const top = logoBottom - S.logo.h * logoScale + 1;
		let edge = Infinity;
		for (const [r, x] of LEFT_EDGE) if (row(r + LEFT_EDGE_BAND) > top && row(r) < logoBottom - 1) edge = Math.min(edge, S.feetX + (x - CREATURE_SPEC.feetCol) * a.creature);
		const w = S.logo.w * logoScale;
		if (E.edgeCss - (E.leftEdgeArt * w) / LOGO.art.width + w <= edge - T.wingGap) break;
	}
	const master: PortraitScene = { board: a.board, artTop: (artTop - S.top0) / S.fit, creature: a.creature / S.creature, logo: { scale: logoScale, bottom: (logoBottom - S.top0) / S.fit } };
	return {
		vw, vh, fit: S.fit, top0: S.top0,
		/** did the rule find a share (false: the window is too short even at uMin) */
		fits,
		/** the common share of the full-width sizes (1: nothing is drawn smaller), the board against the shipped board, the
		 *  train against the window's width over 402 */
		u, board: a.board, gears: a.gears,
		/** how far the scene moved up from the shipped one (the art's top edge, CSS px) */
		lift: S.artTop - artTop,
		artTop,
		frame,
		bottoms,
		boardK: S.boardK * a.board,
		/** the Manticore: against his shipped size here, CSS px per rig px, where his idle top and his tallest pose's top
		 *  stand (under 0: past the top edge), and how far the idle tail tip is past the edge */
		creature: { scale: a.creature / S.creature, css: a.creature, idleTop: row(T.creature.idleTop), tallTop: row(T.creature.tallTop), tailOver: Math.max(0, -row(T.creature.idleTop)) },
		logo: { scale: logoScale, bottom: logoBottom, h: S.logo.h * logoScale, w: S.logo.w * logoScale },
		/** the band the train gets: from the plaque's shadow to the floor */
		band: { top: bottoms.shadow.y1, floor, full: band },
		shipped: { artTop: S.artTop, shadowBottom: S.shadowBottom, boardK: S.boardK, creature: S.creature, band: floor - S.shadowBottom },
		/** what the canvas draws from (game/layoutSpec.ts PortraitScene, master units) */
		master,
	};
};
