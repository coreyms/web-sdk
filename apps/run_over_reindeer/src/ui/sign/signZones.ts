// THE SCENE'S KEEP-OUTS FOR THE SIGN BAR (2026-11-22): where the game draws the board's five columns, the LED strip and
// the logo sign at a window, CSS px, from the game's own layout rules (game/layoutSpec.ts, game/scoreboard/layout.ts):
// the same functions components/Board.svelte lays the canvas out with, so the bar's guards and its checks read what is
// on screen. Pure (no canvas, no state): tools/sign_layout_test.mjs sweeps it in node.
//   board  lane 1's top line to lane 4's bottom line, the columns' width (boardRect)
//   strip  the LED strip from its snow cap's top to its housing's bottom (the roaming reindeer's own keep-out)
//   logo   the billboard sign's box by its class's rule (logoBox). On an upright phone the game may lower the sign
//          toward the trees after this rule (components/Board.svelte logoTreeDrop): the box here is the rule's.
import { MASTER, boardRect, landscapeExtraY, logoBox, logoClass, roadPlacement, type LayoutKind } from '../../game/layoutSpec';
import { scoreboardGeometry } from '../../game/scoreboard/layout';
import { fitBox, sceneFit, type Zones } from './signLayout';

export const signZones = (kind: LayoutKind, vw: number, vh: number, phoneSize: boolean): Zones => {
	const M = MASTER[kind];
	const scale = Math.min(vw / M.width, vh / M.height);
	const main = { x: vw / 2, y: vh / 2, width: M.width, height: M.height, scale };
	// (the window on every layout: the road's place carries his round 3 move of the board, layoutSpec roadPlacement)
	const view = { masterWidth: vw / scale, masterHeight: vh / scale, vw, vh };
	const place = roadPlacement(kind, view);
	const br = boardRect(kind, view);
	const left = vw / 2 - (M.width * scale) / 2;
	const top = vh / 2 - (M.height * scale) / 2;
	const g = scoreboardGeometry(kind, vw, vh, main, place, phoneSize);
	const capTop = g.strip.housing.y - g.strip.cap * 1.3;
	const k = place.scale * scale;
	const lb = logoBox(logoClass(kind, vw, vh), place, scale, left, kind === 'landscape' ? landscapeExtraY(vh / scale) : 0);
	// THE LOGO: the rule's box (at the road's own place: the sign does not ride with his move of the board), and at his
	// round 3 windows his own box, by the share it has here (signLayout.ts sceneFit)
	const own = roadPlacement(kind, view, false, true);
	const fit = sceneFit(kind, vw, vh);
	const lbo = logoBox(logoClass(kind, vw, vh), own, scale, left, kind === 'landscape' ? landscapeExtraY(vh / scale) : 0);
	void lb;
	return {
		board: { x: left + br.x * scale, y: top + br.y * scale, w: br.width * scale, h: br.height * scale },
		strip: { x: g.strip.housing.x, y: capTop, w: g.strip.housing.w, h: g.strip.housing.y + g.strip.housing.h - capTop },
		logo: fitBox({ x: left + own.x * scale + lbo.x * k, y: top + own.y * scale + lbo.y * k, w: lbo.width * k, h: lbo.height * k }, fit.logo, fit.share),
	};
};
