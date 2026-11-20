// THE SCOREBOARD'S PLACE (bigwin_led_r3_2026-11-16 NOTES section 1; constants LED_BOARD.strip): one centred rule per layout
// class for the strip, the back board above it with the strip's width, frame, dot pitch and bezel, the scene's dim while the
// back board is up, and the rectangle the foreground snow covers. All CSS px of the canvas (= the window), derived from the
// window on every layout pass (never cached: the house rule that keeps rotation working).
import { LED_BOARD, LED_SIGN, type StripRule } from '../constants';
import { boardRect, landscapeExtraY, type LayoutKind } from '../layoutSpec';
import { desktopGeo, hudFrame, landscapeGeo, portraitGeo, readSafeInsets } from '../../ui/hud/hudLayout';

export type Rect = { x: number; y: number; w: number; h: number };
export type FaceRect = Rect & { dotsW: number; dotsH: number };
export type ScoreboardClass = 'desktop' | 'tablet' | 'portrait' | 'phone';
export type ScoreboardGeo = {
	cls: ScoreboardClass;
	W: number;
	H: number;
	/** the dot pitch (CSS px) and the housing's frame, outline and snow cap */
	pitch: number;
	f: number;
	ol: number;
	strip: { box: Rect; face: FaceRect; housing: Rect; cap: number };
	back: { face: FaceRect; housing: Rect; cap: number; backH: number; sc: number };
	/** the scene's dim while the back board is up (the HUD's own areas left out) */
	dim: Rect;
	/** the HUD's top edge (the dim's bottom), the band the strip stands in */
	hudTop: number;
	/** the road picture's place: its corner (CSS px) and CSS px per road px */
	road: { ox: number; oy: number; k: number };
};

type Main = { x: number; y: number; width: number; height: number; scale: number };
type Place = { scale: number; x: number; y: number };

/** the strip's frame by its height (the mock's 9 / 8 / 7 / 6 at 90 / 71 / 58 / 53 CSS px tall) */
const frameFor = (h: number) => Math.max(6, Math.min(9, 6 + ((h - 53) * 3) / 37));

export const scoreboardGeometry = (kind: LayoutKind, vw: number, vh: number, main: Main, place: Place, phoneSize: boolean): ScoreboardGeo => {
	const masterLeft = main.x - (main.width * main.scale) / 2;
	const masterTop = main.y - (main.height * main.scale) / 2;
	const k = place.scale * main.scale;
	const ox = masterLeft + place.x * main.scale;
	const oy = masterTop + place.y * main.scale;
	const br = boardRect(kind);
	const boardTop = masterTop + br.y * main.scale;
	const f0 = hudFrame({ kind, phone: phoneSize, vw, vh, safe: readSafeInsets() });
	let cls: ScoreboardClass;
	let R: StripRule;
	let x: number;
	let y: number;
	let w: number;
	let h: number;
	let hudTop: number;
	let backRoom: number;
	let dim: Rect;
	if (kind === 'landscape') {
		cls = f0.variant === 'tablet' ? 'tablet' : 'desktop';
		R = LED_BOARD.strip.desktop;
		const dockTop = desktopGeo(f0, 0).y0 * f0.u;
		w = R.width * R.lanesW * k;
		x = vw / 2 - w / 2;
		const lane = oy + R.roadY * k;
		const band = dockTop - lane;
		y = lane + R.topShare * band;
		h = Math.min(R.heightRoad * k, R.heightShare * band);
		hudTop = dockTop;
		backRoom = y - boardTop;
		const extra = landscapeExtraY(vh / main.scale);
		const top = masterTop + (36 - extra) * main.scale;
		dim = { x: 0, y: top, w: vw, h: dockTop - top };
	} else if (kind === 'portrait') {
		cls = 'portrait';
		R = LED_BOARD.strip.portrait;
		const G = portraitGeo(f0, 0);
		hudTop = Math.min(G.win.y, G.amt.y, G.spin.y, G.bar.y0) * f0.u;
		w = R.width * vw;
		x = (vw - w) / 2;
		y = oy + R.roadY * k + R.pad;
		h = R.heightShare * (hudTop - y);
		// the top line's bottom edge (the clock strip: 28 master units under the fit's top)
		const topLine = f0.fit.top + 28 * f0.fit.scale;
		backRoom = y - topLine;
		dim = { x: 0, y: topLine, w: vw, h: hudTop - topLine };
	} else {
		cls = 'phone';
		R = LED_BOARD.strip.phone;
		const G = landscapeGeo(f0);
		w = R.width * R.lanesW * k;
		x = ox + 768 * k - w / 2;
		y = oy + R.roadY * k + R.pad;
		h = R.heightShare * (vh - y);
		hudTop = vh;
		backRoom = y - boardTop;
		const left = G.cap.x1 * f0.u;
		const right = G.kc.x0 * f0.u;
		dim = { x: left, y: 0, w: right - left, h: vh };
	}
	// THE DIM COVERS THE WHOLE SCREEN (2026-11-17, Corey: "the background fading is cut off, not covering the entire
	// screen"; this replaces the mock's rule above, which left the top line, the dock and the HUD columns out): edge to
	// edge, past each edge by a few px. It is the scoreboard's lowest piece, so the back board and the strip stay over it;
	// the HUD's readouts and keys are HTML over the canvas and are never under it.
	dim = { x: -4, y: -4, w: vw + 8, h: vh + 8 };
	// the dot pitch: the press screen's billboard's (its layout's base pitch over LED_SIGN.density)
	const LL = LED_SIGN.layout[kind];
	const pitch0 = (LL.pitch * (LL.unit === 'master' ? main.scale : 1)) / LED_SIGN.density;
	const f = frameFor(h);
	const ol = f / 3;
	const cap = (f * 4) / 3;
	// BOARD SIZE d ON DESKTOP AND TABLET (2026-11-20, constants LED_BOARD.size): the faces span the reel board (its rect from
	// layoutSpec boardRect, the same the road draws), the strip as wide, the back board from the board's top to the strip
	let backTop: number | null = null;
	if (kind === 'landscape' && LED_BOARD.size === 'd') {
		const rbx = masterLeft + br.x * main.scale;
		const rbw = br.width * main.scale;
		x = rbx - f;
		w = rbw + 2 * f;
		backTop = boardTop - 1.7 * f;
	}
	// THE STRIP (the mock's geomStrip)
	const faceW = w - 2 * f;
	const dotsW = Math.max(20, Math.floor(faceW / pitch0));
	const p = faceW / dotsW;
	const dotsH = Math.max(7, Math.floor((h - 2.7 * f) / p));
	const faceH = dotsH * p;
	const stripFace = { x: x + f, y: y + 1.7 * f, w: faceW, h: faceH, dotsW, dotsH };
	const stripHousing = { x, y, w, h: faceH + 2.7 * f };
	// THE BACK BOARD (the mock's geomBack): its bottom rail tucks under the strip's snow cap
	const backH = backTop !== null ? Math.max(40, y + 0.5 * f - backTop) : Math.max(40, R.backShare * backRoom);
	const bDotsH = Math.max(10, Math.floor((backH - 2.7 * f) / p));
	const bFaceH = bDotsH * p;
	const hh = bFaceH + 2.7 * f;
	const by = y - hh + f * 0.5;
	const back = {
		face: { x: x + f, y: by + 1.7 * f, w: faceW, h: bFaceH, dotsW, dotsH: bDotsH },
		housing: { x, y: by, w, h: hh },
		cap: Math.round(cap * 1.5),
		backH,
		sc: backH / 420,
	};
	return { cls, W: vw, H: vh, pitch: p, f, ol, strip: { box: { x, y, w, h }, face: stripFace, housing: stripHousing, cap }, back, dim, hudTop, road: { ox, oy, k } };
};
