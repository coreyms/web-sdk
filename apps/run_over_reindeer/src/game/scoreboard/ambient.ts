// THE STRIP'S NEW IDLE CARTOONS AND THE PRESS SCREEN'S LIGHT STRING, round 1 picks (Corey 2026-11-19, led_anim_ideas_r1_2026-11-19:
// amb-tree, amb-chew, amb-takeoff, amb-signroll, amb-stack, press-lights; constants LED_BOARD.ideas). The mock's drawing code
// (its ambient.ts), ported. The cartoons are idle cartoons like the five before them: each a pure function of its own time,
// lowest in the strip's priority order (anything higher cuts them at once, nothing waits for them), never in a bonus round,
// joined into the rotation in LED_BOARD.ideas.cartoons' order. The light string plays on the expanded board over the press
// screen's own three screens. No sounds (none were in the mock; see the notes for the ones that might want one).
//   tree      the wagon hits a bump and its tree slides off the back; brake lights, it backs up (white reversing lights)
//             and the tree hops back on upside down; away it goes
//   chew      the reindeer chews the light string: the bulbs go dark outward with sparks, he gets zapped, every bulb pops
//             back on bright, he leaves smoking
//   takeoff   Santa's sleigh (Santa in it) runs along, lifts off and climbs out of the top; the trail drifts down as glitter
//   signroll  the J sign's plate pops off its post when he bumps it and rolls away a quarter turn at a time; he chases it;
//             it rolls back in from the other side and hops back on
//   stack     presents stack into a pyramid; he runs INTO it (Corey 2026-11-19: "the reineer actually isn't bumping into
//             the presents, but if it did with the knock down, it would look good"): nothing moves until his front meets
//             the stack, then the presents topple and scatter from the point of the hit in the way he is running, tumbling a
//             quarter turn at a time, and clear off the strip; he skids to a stop where it stood and the top (red) present,
//             knocked high, comes down on his antlers
import { LED_BOARD, LED_SIGN } from '../constants';
import type { LedText } from '../landing/ledScreens';
import { BULBS, CARTOONS as TODAY, RUN_FH, RUN_FW, art, burst, gallop, snowDots, sprite, vehicleOf, artSize, type ArtName, type Cartoon, type CartoonState, type Face } from './scoreboardDraw';
import { dotAt, fillP, kOf, ledN } from './ledGrid';
import { showPressScreens } from './stripDraw';
import { clamp, ease, easeIn, easeOut, hash, lerp, litBox, noteIdea, pic, picC, picTurned, picW, type Ctx } from './ideasKit';

const dot = dotAt;
type Draw = Cartoon['draw'];

// ==== THE WAGON LOSES ITS TREE (tree, 5.6 s) ======================================================================================
const tree: Draw = (g, W, H, t) => {
	snowDots(g, W, H, t, Math.round((W * H) / 120));
	const h = Math.round(H * 0.66);
	const w = picW('H2', h);
	const [tw, th] = artSize('tree', null);
	const treeH = Math.max(4, Math.round(((w * 1.3 * th) / tw) * 1.25));
	const treeW = picW('tree', treeH);
	// the wagon's x: in from the right, a bump at 1100, on to a stop at 2600, backs up to the tree, then away with it
	const xIn = W + 4;
	const xBump = W * 0.6;
	const xStop = W * 0.22;
	let x: number;
	if (t < 1100) x = lerp(xIn, xBump, t / 1100);
	else if (t < 2600) x = lerp(xBump, xStop, easeOut((t - 1100) / 1500));
	else if (t < 2900) x = xStop;
	else if (t < 3700) x = lerp(xStop, xBump + 2, ease((t - 2900) / 800));
	else if (t < 4300) x = xBump + 2;
	else x = lerp(xBump + 2, -w - treeW, easeIn((t - 4300) / 1300));
	const hop = t > 1100 && t < 1260 ? Math.round(Math.sin(((t - 1100) / 160) * Math.PI) * 3) : 0;
	const yB = H - 1 - hop;
	const roof = yB - h * 0.8;
	// the tree: on the roof, slides off the back after the bump, lies on the road, hops back on (upside down) at 3700
	const offX = xBump + w * 0.55;
	if (t < 1150) pic(g, 'tree', x + (w - treeW) / 2, roof + 1, treeH);
	else if (t < 1500) {
		const u = (t - 1150) / 350;
		const tx = lerp(xBump + (w - treeW) / 2, offX, u);
		const ty = lerp(roof + 1, H - 1, easeIn(u)) - Math.sin(u * Math.PI) * 4;
		pic(g, 'tree', tx, ty, treeH);
	} else if (t < 3700) pic(g, 'tree', offX, H - 1, treeH);
	else {
		const u = clamp((t - 3700) / 450, 0, 1);
		const tx = lerp(offX, x + (w - treeW) / 2, u);
		const ty = lerp(H - 1, roof + 1, u) - Math.sin(u * Math.PI) * H * 0.4;
		picTurned(g, 'tree', tx, ty, treeH, u > 0.5 ? 2 : 0);
	}
	pic(g, 'H2', x, yB, h);
	// the brake lights (its back is its right side), and the white reversing lights as it backs up
	const bl = (t >= 1800 && t < 2650) || (t >= 3550 && t < 3720);
	const rev = t >= 2850 && t < 3700;
	if (bl || rev) {
		g.fillStyle = rev ? '#ffffff' : '#ff2a1e';
		const q = kOf(g);
		const u = ledN(q, 2);
		fillP(g, Math.round((x + w - 2) * q), Math.round((yB - h * 0.5) * q), u, u);
	}
	if (t > 1100 && t < 1400) for (let i = 0; i < 4; i++) dot(g, xBump + w * 0.3 + i * 2, H - 2 - hash(i + Math.floor(t / 70)) * 3, '#c8d2de');
};

// ==== THE CHEWED LIGHT STRING (chew, 5.4 s) =======================================================================================
function stringY(x: number, W: number, H: number, sway: number) {
	const sp = W / 3;
	const u = (x % sp) / sp;
	return 1 + 4 * u * (1 - u) * Math.max(2, H * 0.16) * (1 + sway);
}
function lightString(g: Ctx, W: number, H: number, t: number, darkFrom: number | null, r: number, pop: number) {
	g.globalAlpha = 0.55;
	for (let x = 0; x < W; x += 2) dot(g, x, stringY(x, W, H, 0), '#3a4250');
	g.globalAlpha = 1;
	const q = kOf(g);
	const u = ledN(q, 1);
	let i = 0;
	for (let x = 3; x < W; x += 7, i++) {
		const y = stringY(x, W, H, 0) + 1;
		const dark = darkFrom !== null && Math.abs(x - darkFrom) < r;
		const tw = 0.65 + 0.35 * Math.sin(t / 260 + i * 1.7);
		g.globalAlpha = dark ? 0.12 : Math.min(1, tw + pop);
		g.fillStyle = BULBS[i % 4];
		fillP(g, Math.round(x * q), Math.round(y * q), u, 2 * u);
		if (pop > 0 && !dark) {
			g.fillStyle = '#ffffff';
			fillP(g, Math.round(x * q), Math.round(y * q), u, u);
		}
	}
	g.globalAlpha = 1;
}
const chew: Draw = (g, W, H, t) => {
	const xc = W * 0.46;
	const r = t < 1500 ? 0 : t < 2900 ? (t - 1500) * 0.09 : W;
	const pop = t >= 3150 && t < 3500 ? 1 - (t - 3150) / 350 : 0;
	lightString(g, W, H, t, t >= 1500 && t < 3150 ? xc : null, r, pop);
	const rh = Math.round(H * 0.8);
	const rw = Math.round((rh * RUN_FW) / RUN_FH);
	if (t < 1300) gallop(g, lerp(-rw, xc - rw * 0.7, easeOut(t / 1300)), H - 1, rh, t);
	else if (t < 3300) {
		const ch = Math.round(H * 0.98);
		const bite = t >= 1300 && t < 2900 ? Math.floor(t / 120) % 2 : 0;
		const zap = t >= 2900 && t < 3250 && Math.floor(t / 60) % 2 === 0;
		const w = picW('reindeer_col', ch);
		picTurned(g, 'reindeer_col', xc - w / 2, H - 1 - 2 - bite, ch, 0, false, zap ? '#ffffff' : null, zap ? 0.9 : 0);
		if (t >= 1500 && t < 2900) for (let i = 0; i < 3; i++) dot(g, xc + (hash(i + Math.floor(t / 50)) - 0.5) * 6, stringY(xc, W, H, 0) + hash(i * 7 + Math.floor(t / 50)) * 4, i % 2 ? '#ffe95a' : '#ffffff');
		if (t >= 2900 && t < 3300) burst(g, xc, H * 0.25, (t - 2900) / 400, Math.round(H * 0.7));
	} else {
		const p = (t - 3300) / 2100;
		const x = lerp(xc - rw * 0.4, W + rw, easeIn(p));
		gallop(g, x, H - 1, rh, t);
		// singed: a puff of smoke from the antlers
		for (let i = 0; i < 6; i++) {
			g.globalAlpha = 0.6 * (1 - i / 6);
			dot(g, x + rw * 0.6 - i * 3, H - 1 - rh - 1 - i * 0.6 + Math.sin(t / 100 + i), '#9aa6b3');
		}
		g.globalAlpha = 1;
	}
};

// ==== SANTA'S SLEIGH TAKES OFF (takeoff, 4.8 s) ===================================================================================
function takeoffPath(t: number, W: number, H: number, sh: number, sw: number, rw: number) {
	const p = clamp(t / 3000, 0, 1);
	const x = lerp(-sw - rw - 6, W * 1.02, Math.pow(p, 1.4));
	const lift = W * 0.4;
	const climb = x > lift ? Math.pow((x - lift) / (W * 0.4), 1.6) * (H + sh) : 0;
	return { x, yB: H - 1 - climb };
}
const takeoff: Draw = (g, W, H, t) => {
	snowDots(g, W, H, t, Math.round((W * H) / 150));
	// (the sleigh WITH Santa, the riders' picture: `sh` the whole picture's height, as the mock's; sized by its vehicle)
	const sh = Math.round(H * 0.8);
	const v = vehicleOf('sleigh_r');
	const [pw0, ph0] = artSize('sleigh_r', null);
	const vh = v ? (sh * v.h) / ph0 : sh;
	const sw = v ? Math.round((vh * v.w) / v.h) : Math.round((sh * pw0) / ph0);
	const rh = Math.round(sh * 0.85);
	const rw = Math.round((rh * RUN_FW) / RUN_FH);
	// the trail: where the sleigh was over the last 1.2 s, gold and white, lingering, then falling as glitter
	for (let i = 1; i < 34; i++) {
		const tt = t - i * 40;
		if (tt < 0) break;
		const p = takeoffPath(Math.min(tt, 3000), W, H, sh, sw, rw);
		const age = Math.max(0, t - Math.max(tt, 2000));
		const fallY = t > 3000 ? ((t - 3000) / 1800) * H * 0.7 * (0.4 + hash(i)) : 0;
		const air = p.yB < H - 2;
		if (!air && i > 6) continue;
		g.globalAlpha = clamp(1 - i / 34 - age / 4000, 0, 1) * (air ? 1 : 0.6);
		dot(g, p.x + sw * 0.2, p.yB - sh * 0.15 + fallY + Math.sin(i + t / 90), i % 2 ? '#ffd23a' : '#ffffff');
	}
	g.globalAlpha = 1;
	if (t < 3300) {
		const p = takeoffPath(t, W, H, sh, sw, rw);
		const yR = p.yB - (p.yB < H - 1 ? 2 : 0);
		gallop(g, p.x + sw + 1, yR, rh, t);
		// (the sleigh's RIGHT facing picture, sleigh_r: its WILD reads left to right; never the left one mirrored)
		sprite(g, 'sleigh_r', p.x, p.yB, vh);
		if (p.yB >= H - 1.5) for (let i = 0; i < 4; i++) dot(g, p.x - 1 - i * 2, H - 2 - hash(i + Math.floor(t / 70)) * 3, '#ffffff');
	}
};

// ==== THE ROLLING SIGN (signroll, 5.6 s) ==========================================================================================
/** the J post's height against the whole J sign's (the mock's sheet: 142 of 240) */
const POST_OF_SIGN = 142 / 240;
const signroll: Draw = (g, W, H, t) => {
	const sh = Math.round(H * 0.95);
	const xs = [W * 0.12, W * 0.32, W * 0.55, W * 0.78];
	pic(g, 'sign_a', xs[0], H - 1, sh);
	pic(g, 'sign_k', xs[1], H - 1, sh);
	pic(g, 'sign_q', xs[3], H - 1, sh);
	// the J sign: its post stays; its plate pops off when the reindeer bumps it, rolls away, comes round again and hops back on
	const postH = Math.round(sh * POST_OF_SIGN * 1.05);
	const postW = picW('sign_j_post', postH);
	const jx = xs[2];
	const jW = picW('sign_j', sh);
	const plateH = Math.round(sh * 0.66);
	const plateW = picW('sign_j_plate', plateH);
	const bumpAt = 1050;
	const rh = Math.round(H * 0.78);
	const rw = Math.round((rh * RUN_FW) / RUN_FH);
	if (t < bumpAt) pic(g, 'sign_j', jx, H - 1, sh);
	else {
		pic(g, 'sign_j_post', jx + jW / 2 - postW / 2, H - 1, postH);
		let px: number;
		let yB = H - 1;
		let rolled: number;
		if (t < 3400) {
			const u = (t - bumpAt) / 1000;
			px = jx + jW / 2 - plateW / 2 + u * W * 0.33;
			if (t < bumpAt + 300) yB = H - 1 - postH * 0.7 + easeIn((t - bumpAt) / 300) * postH * 0.7;
			rolled = px - jx;
		} else if (t < 5000) {
			const u = (t - 3400) / 1600;
			px = lerp(-plateW, jx + jW / 2 - plateW / 2, easeOut(u));
			rolled = px + plateW;
			if (t > 4650) yB = H - 1 - Math.sin(((t - 4650) / 350) * Math.PI) * postH * 0.9;
		} else {
			px = jx + jW / 2 - plateW / 2;
			yB = H - 1 - postH * 0.68;
			rolled = 0;
		}
		const q = t >= 5000 ? 0 : Math.floor(rolled / (plateH * 0.78)) % 4;
		const wob = t >= 5000 && t < 5300 ? Math.round(Math.sin((t - 5000) / 35)) : 0;
		if (px < W + 2) picTurned(g, 'sign_j_plate', px + wob, yB, plateH, q);
	}
	// the reindeer: in from the left, bumps the sign, chases the plate off to the right
	if (t < 3600) {
		const x = t < bumpAt ? lerp(-rw, jx - rw * 0.6, t / bumpAt) : lerp(jx - rw * 0.6, W + rw * 2, (t - bumpAt) / 2400);
		gallop(g, x, H - 1, rh, t);
		if (t >= bumpAt && t < bumpAt + 300) burst(g, jx + jW * 0.5, H * 0.35, (t - bumpAt) / 300, Math.round(H * 0.5));
	}
};

// ==== THE PRESENT STACK, KNOCKED DOWN (stack, 5.6 s) ==============================================================================
/** the pyramid's places: [column offset in present widths, level] */
const SPOTS: [number, number][] = [
	[-1, 0],
	[0, 0],
	[1, 0],
	[-0.5, 1],
	[0.5, 1],
	[0, 2],
];
const STACK = { buildAt: 200, buildStepMs: 320, fallMs: 380, runFrom: 2200, hitAt: 3150, skidMs: 380, clearBy: 4250, antlersAt: 4300, antlersMs: 350 };
/** the run frame's lit front (its rightmost lit LED + 1, a share of the frame's width), measured on a bake */
function runFront(g: Ctx, rh: number, t: number): number {
	const k = kOf(g);
	const w = Math.round((rh * RUN_FW) / RUN_FH);
	const fi = Math.floor(t / 66) % 8;
	const a = art('run_strip', [fi * RUN_FW, 0, RUN_FW, RUN_FH], w, rh, k);
	const b = litBox(a);
	return (b[0] + b[2]) / a.width;
}
const stack: Draw = (g, W, H, t) => {
	const k = kOf(g);
	const ph = Math.max(5, Math.round(H * 0.34));
	const pw = picW('present', ph);
	const cx = W * 0.55;
	const S = STACK;
	// the pyramid at rest: each present's box (dots) and its picture
	const rest = SPOTS.map(([dx, lv], i) => ({ i, lv, name: (i % 2 ? 'present_red' : 'present') as ArtName, x: cx + dx * (pw + 1) - pw / 2, yB: H - 1 - lv * (ph - 1) }));
	const stackL = Math.min(...rest.map((p) => p.x));
	const stackR = Math.max(...rest.map((p) => p.x + pw));
	// THE REINDEER: in at a run, his front reaching the stack's left edge exactly at hitAt (a constant speed so the contact is
	// at that moment on every layout), then a skid to a stop where the stack stood
	const rh = Math.round(H * 0.8);
	const rw = Math.round((rh * RUN_FW) / RUN_FH);
	// (his lit front, measured on the run frame's bake: the frames are drawn with room round the deer)
	const front = runFront(g, rh, t) * rw;
	const xHit = stackL - front;
	const x0 = -rw;
	const v = (xHit - x0) / (S.hitAt - S.runFrom);
	const skidTo = xHit + rw * 0.9;
	let deerX: number | null = null;
	if (t >= S.runFrom && t < S.hitAt) deerX = xHit - (S.hitAt - t) * v;
	else if (t >= S.hitAt && t < S.hitAt + S.skidMs) {
		// (decelerating from his run speed to a stop at skidTo: a quadratic ease out matched to the speed at the hit)
		const u = (t - S.hitAt) / S.skidMs;
		deerX = xHit + (skidTo - xHit) * (1 - (1 - u) * (1 - u));
	}
	const standX = skidTo + rw * 0.5;
	// THE PRESENTS: built one by one; after the hit each one moves from the moment the shock reaches it (its distance from the
	// hit point), away from the hit point and on in his direction (right), tumbling a quarter turn at a time, bouncing on the
	// road and clearing off the strip; the top one (red) is knocked high, off the top, and comes down on his antlers
	const hx = stackL;
	const hy = H - 1 - rh * 0.45;
	let moved = false;
	const boxes: [number, number, number, number][] = [];
	for (const p of rest) {
		const at = S.buildAt + p.i * S.buildStepMs;
		const lt = t - at;
		if (lt < 0) continue;
		// (the shock's distance: from the hit point to the present's nearest edge, so the present he hits moves first, at once)
		const dist = Math.hypot(Math.max(0, p.x - hx), Math.max(0, p.yB - ph - hy, hy - p.yB));
		const delay = dist * 2.2;
		const tt = (t - S.hitAt - delay) / 1000;
		if (t < S.hitAt || tt < 0) {
			// building, or at rest until the shock reaches it
			let yB = p.yB;
			if (lt < S.fallMs) yB = lerp(-1, p.yB, easeIn(lt / S.fallMs));
			else if (lt < S.fallMs + 120) yB -= Math.round(Math.sin(((lt - S.fallMs) / 120) * Math.PI) * 2);
			const r = picTurned(g, p.name, p.x, yB, ph, 0);
			boxes.push(r.led);
			continue;
		}
		moved = true;
		if (p.i === 5) continue; // (the top one: off the top, see below)
		// away from the hit, mostly in his direction: the bottom row skids and hops along the road, the higher ones fly
		// higher and further; the nearer the hit, the harder the kick (so they scatter, not move as one block)
		const near = 1 - clamp(dist / Math.max(1, stackR - stackL + ph), 0, 1);
		// (and fast enough to be off the strip by the clear: across what is left of it in at most the clear's time)
		const vx = Math.max(W * (0.2 + 0.11 * p.lv + 0.2 * near + 0.1 * hash(p.i * 3.1)), (W + 2 - p.x) / ((S.clearBy - S.hitAt - 100) / 1000));
		const vy = H * (0.7 + 1.3 * p.lv + 0.9 * near + 0.3 * hash(p.i * 1.7));
		const grav = H * 9;
		let x = p.x + vx * tt;
		let yB = p.yB - vy * tt + 0.5 * grav * tt * tt;
		if (yB > H - 1) {
			// a bounce off the road, smaller each time
			const t1 = (vy + Math.sqrt(vy * vy + 2 * grav * (H - 1 - p.yB))) / grav;
			const tb = tt - t1;
			const vb = vy * 0.4;
			yB = H - 1 - Math.max(0, vb * tb - 0.5 * grav * tb * tb);
			x = p.x + vx * tt;
		}
		if (x > W + 1) continue;
		const r = picTurned(g, p.name, x, yB, ph, Math.floor((x - p.x) / (ph * 0.8)) + 1);
		boxes.push(r.led);
	}
	// his picture: running in and skidding; then standing (dazed) where the stack stood
	let deerBox: [number, number, number, number] | null = null;
	if (deerX !== null) {
		gallop(g, deerX, H - 1, rh, t);
		const a = art('run_strip', [(Math.floor(t / 66) % 8) * RUN_FW, 0, RUN_FW, RUN_FH], rw, rh, k);
		const b = litBox(a);
		deerBox = [Math.round(deerX * k) + b[0], Math.round((H - 1 - rh) * k) + b[1], b[2], b[3]];
		if (t >= S.hitAt) burst(g, hx, hy, (t - S.hitAt) / 380, Math.round(H * 0.6));
	} else if (t >= S.hitAt + S.skidMs) {
		const ch = Math.round(H * 0.95);
		const w = picC(g, 'reindeer_col', standX, H - 1, ch);
		// the red present lands on his antlers
		if (t > S.antlersAt) {
			const u = clamp((t - S.antlersAt) / S.antlersMs, 0, 1);
			const sh = Math.round(ph * 0.8);
			const yB = lerp(-2, H - 1 - ch + 3, easeIn(u));
			pic(g, 'present_red', standX - picW('present_red', sh) / 2, yB, sh);
			if (u >= 1 && t - S.antlersAt - S.antlersMs < 300) for (let i = 0; i < 4; i++) dot(g, standX + (i - 1.5) * w * 0.25, H - 1 - ch - 1 - hash(i + Math.floor(t / 80)) * 3, '#ffe95a');
		}
	}
	// the top present knocked high: up and out of the top of the strip
	if (t >= S.hitAt) {
		const p = rest[5];
		const tt = (t - S.hitAt - Math.hypot(Math.max(0, p.x - hx), Math.max(0, p.yB - ph - hy, hy - p.yB)) * 2.2) / 1000;
		if (tt >= 0) {
			const yB = p.yB - H * 3 * tt;
			if (yB > 0) picTurned(g, p.name, p.x + W * 0.08 * tt, yB, ph, Math.floor(tt * 10) + 1);
		}
	}
	noteIdea(g.canvas, 'stack', { deer: deerBox, stack: [Math.round(stackL * k), Math.round((H - 1 - 3 * (ph - 1) - 1) * k), Math.round((stackR - stackL) * k), Math.round((3 * (ph - 1) + 1) * k)], moved, presents: boxes, hitAt: S.hitAt, t: Math.round(t) });
};

// ==== THE ROTATION (LED_BOARD.ideas.cartoons) ======================================================================================
const NEW: Cartoon[] = [
	{ key: 'tree', name: 'The wagon hits a bump and loses its tree, backs up and the tree hops back on upside down', ms: () => 5600, draw: tree },
	{ key: 'chew', name: 'The reindeer chews the light string, gets zapped, every bulb pops back on', ms: () => 5400, draw: chew },
	{ key: 'takeoff', name: "Santa's sleigh runs, lifts off and climbs out of the top, the trail falls as glitter", ms: () => 4800, draw: takeoff },
	{ key: 'signroll', name: "The J sign's plate pops off, rolls away and back, and hops back on", ms: () => 5600, draw: signroll },
	{ key: 'stack', name: 'Presents stack up; the reindeer runs into the stack and knocks it down', ms: () => 5600, draw: stack },
];
let rotKey = '';
let rot: Cartoon[] = [];
/** the strip's idle cartoons in their order now (LED_BOARD.ideas.cartoons; an unknown name is left out, the race always in) */
export function cartoons(): Cartoon[] {
	const want = LED_BOARD.ideas.cartoons;
	const key = want.join(',');
	if (key !== rotKey) {
		const all = [...TODAY, ...NEW];
		rot = want.map((k) => all.find((c) => c.key === k)).filter((c): c is Cartoon => !!c);
		if (!rot.some((c) => c.key === 'race')) rot.push(TODAY.find((c) => c.key === 'race')!);
		if (rot.length < 2) rot = [...TODAY];
		rotKey = key;
	}
	return rot;
}
export function showCartoonNow(F: Face, idx: number, t: number, st: CartoonState, at: number) {
	const g = F.out.ctx;
	g.clearRect(0, 0, F.dotsW, F.dotsH);
	const list = cartoons();
	list[((idx % list.length) + list.length) % list.length].draw(g, F.dotsW, F.dotsH, t, st, at);
}

// ==== THE LIGHT STRING ON THE PRESS SCREEN (press-lights) ========================================================================
/** The reindeer's own antler lights strung in loops along the top of the press screen, twinkling; at each change of screen
 *  he runs along the top tugging it, and the loops swing. Drawn over the three screens (stripDraw.ts showPressScreens). */
export function pressScreensLit(F: Face, T: number, text: LedText) {
	showPressScreens(F, T, text);
	if (!LED_BOARD.ideas.pressLights) return;
	const W = F.dotsW;
	const H = F.dotsH;
	const g = F.out.ctx;
	const period = LED_SIGN.holdS + LED_SIGN.transS;
	const tau = T % period;
	const ms = T * 1000;
	const tug = tau < 1.1 && T > period * 0.5 ? tau / 1.1 : -1;
	const sway = tug >= 0 ? Math.sin(tug * Math.PI * 3) * 0.6 * (1 - tug) : 0;
	const spans = 5;
	const sp = W / spans;
	const sag = Math.max(3, H * 0.05);
	const yOf = (x: number) => {
		const u = (x % sp) / sp;
		return 2 + 4 * u * (1 - u) * sag * (1 + sway);
	};
	g.globalAlpha = 0.6;
	for (let x = 0; x < W; x += 2) dot(g, x, yOf(x), '#3a4250');
	g.globalAlpha = 1;
	const q = F.k;
	const u1 = ledN(q, 1);
	let i = 0;
	for (let x = 4; x < W; x += 9, i++) {
		const y = yOf(x) + 1;
		g.globalAlpha = 0.6 + 0.4 * Math.sin(ms / 240 + i * 1.9);
		g.fillStyle = BULBS[i % 4];
		fillP(g, Math.round(x * q), Math.round(y * q), 2 * u1, 2 * u1);
	}
	g.globalAlpha = 1;
	if (tug >= 0) {
		const rh = Math.max(8, Math.round(H * 0.12));
		gallop(g, lerp(-rh * 2, W + rh, tug), yOf(0) + rh + 1, rh, ms);
	}
	noteIdea(g.canvas, 'pressLights', { bulbs: i, tug: tug >= 0 ? Math.round(tug * 100) / 100 : null });
}
