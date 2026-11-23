// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{game/roamPaths.ts,game/road/roam.ts,game/road/roamFrames.ts,game/reindeerRoamSpec.ts,staging/tune/RoamEditor.svelte};
// WATCHES: ; __reindeer.roam, __reindeer.roamAreas, __reindeer.roamMemory, __reindeer.roamPicks, __reindeer.roamPlace, __reindeer.roamReseed
// WATCHES: ; __reindeer.roamStandAt, __reindeer.roamStrike, __reindeer.roamView, __reindeer.roamWalkIn, __reindeer.roamZones, __reindeer.roadBoard
// WATCHES: ; __reindeer.clock, __reindeer.atRest, __reindeer.hud, __reindeer.strike, __reindeer.turbo, __reindeer.runMemory, __reindeer.scene
// WATCHES: ; __reindeer.sceneSwap, __reindeer.sceneWant, __reindeer.step, STRIKE.roam, ROAM, ROAM_AREAS, data-roam-area, data-roam-json
// WATCHES: ; data-roam-overlay, data-roam-wp, data-roam-mouth, ROAM_TUNNELS, ROAM_TUNNEL_MOUTH, counts.corridor, counts.rounds
// WATCHES: apps/run_over_reindeer/src/game/forestLineSpec.ts; FOREST_LINE, TREE_PAD, roam.forest
// WATCHES: apps/run_over_reindeer/src/{game/road/superWheel.ts,game/bookEventHandlerMap.ts}; SUPER_WHEEL.roamBackMs, roamer, roam.away
// WATCHES: ; data-skip, roam zone skip, roam.back, held, EXIT_STAND_MS, EXIT_PREFER_MS, __reindeer.wheel, __reindeer.fixtures, tools/wheel_probe_books.json
// WATCHES: ; __reindeer.roamAway, __reindeer.roamBack, __reindeer.roadSounds
// WATCHES: apps/run_over_reindeer/src/game/road/{chargeWindup.ts,roadFeatures.ts,roadSounds.ts,lockSnort.ts}; ROAM.charge, REINDEER_SOUND.snort
// WATCHES: ; __reindeer.crosshairStrike, __reindeer.hurry, roam().windup, roam().box, snapshot().charge, lockSnort, snortAt
// WATCHES: ; charge.round1, charge.look, REINDEER_ROAM.fx.grounds, __reindeer.sceneWant, __reindeer.sceneSwap
// WATCHES: apps/run_over_reindeer/src/ui/sign/{signLayout.ts,SignHud.svelte}; PHONE_REFS, PHONE_PLACES, HUD_BAR, __reindeer.hud.bar, roam zone hud
// WATCHES: apps/run_over_reindeer/src/game/{roamGround.ts,scene/forestPlace.ts}; roamGround, ROAM_ROAD, ROAM_TREE_PAD, sceneFit, PHONE_R3, LAND_R3
// WATCHES: ; __reindeer.roamGround, __reindeer.sign.scene, __reindeer.sign.inputs, boardDy, treeDy
// WATCHES: ; ROAM_SHORT, roamShortOn, roamShortArea, roam().short, shortWayIn
// WATCHES: apps/run_over_reindeer/src/game/forestLineSpec.ts; FOREST_LINE, wayMeetsSign, underSign
// THE ROAM PROBE (the roaming reindeer, 2026-11-17; game/road/roam.ts, constants STRIKE.roam and ROAM, game/roamPaths.ts).
// Since round 3 (Corey: "an allowed to walk area where it randomly chooses where to go") he roams an AREA. Per size
// (1440x900 desktop, 844x390 phone held sideways, 390x844 upright phone; 1920x1080 desktop for the area checks only):
//   1  at rest one reindeer is on the screen; he picks spots, walks (start, walk, stop) and sniffs; the same seed walks
//      the same way; 45 s of his wander, every frame: his body clear of every keep-out zone and on the screen, every
//      stop's feet inside the area
//   5  the AREA: 300 seeded picks in a row and 60 walk in picks, each one's feet inside the area, his body clear of the
//      road (feet), the HUD, the LED strip, the logo and the top line (his head 8 CSS px or more under it) and on the
//      screen, the walk to it clear all the way; the walks' slopes (14 degrees at most unless relaxed) and lengths; no
//      counter plate zone (gone from the game); in every scene preset he is drawn
//   2  the first strike of a spin is his, from where he stands; he stands alert until his run sets off, then he is gone
//      (no frame shows both or neither); its impact never lands later than the strike from off the screen, at 60, 30 and
//      20 Hz and at both turbo levels (the table of both times is printed: STRIKE TIMING)
//   3  a later strike of the spin comes from off the screen, and he does not come back for it
//   4  after the spin's last strike a new one walks in level from past the screen's edge to a spot of the area
//   7  a new one sets off on his walk in on the first pick (2026-11-23: its own line, with what he has to stand on when
//      it fails; the clock is then stepped until he does set off); a strike while the new one is still past the edge
//      comes from off the screen (he gives way); a strike while he is
//      walking in on the screen is his, from where he is; in the live spins every strike lands on time
//   8  every fixture book (base and bonus): each spin (reveal to reveal) with strikes has exactly one first and one last
//   the editor: the staging panel's Reindeer area group shows the area, a corner drags (mouse; touch on the phones), one
//      is added and removed, and the read back is the live areas as JSON
//   the TUNNEL MOUTHS (2026-11-18, Corey): across every seeded walk (the 60 s of each sweep size, the 45 s wander, the
//      picks' walks, routed round a mouth by their corners) his body, head and shadow never touch a mouth's polygon
//      (game/roamPaths.ts ROAM_TUNNELS, all four corners); the TOP CORRIDOR: on a walk he may be partly above the screen's
//      top (feet and 40 % of him on it), never at rest, at most 5 % of the time (the share and the walks that used it
//      are printed per size)
//   STRIKE.roam false: no roaming reindeer, and a spin's first strike is frame for frame the strike from off the screen
//   THE SUPER WHEEL (2026-11-19, Corey: "the walker shouldn't stay for the wheel spin"; section `wheel`, desktop 1440x900
//      and upright 390x844): a real Super book (tools/wheel_probe_books.json) with him standing on the screen when the
//      entry card is pressed. As the wheel comes out he is kept away; he runs off (every frame of him drawn, the last one
//      partly past the screen's edge: no pop), gone before the wheel's reindeer runs in; not drawn on any frame from the
//      end of his run through every wheel phase (runin to leave) and the opening column's growing; back by a walk in from
//      past the edge after the column stands. His run's side, length and time are printed (WHEEL EXIT), on the board's
//      clock against the wheel's own (the shortest emergence: SUPER_WHEEL.emerge without the present's lid, a round
//      resumed at its opening, 1250 ms); then at 2560 x 1080 (the widest screen) he is sent off from where he stands
//      (roamAway): his run takes the time it planned (a slow headless frame late at most), and the worst case there (from the screen's middle, worked out
//      from its width) is within that 1250 too; away he stays away 7 s; roamBack: he walks in. SHOTS=<dir> saves a strip of stills from the emergence to
//      the first free spin (the board's clock held for each).
//   THE CHARGE WIND-UP (2026-11-20, Corey's "Slow Drag 1" and "B Snort at lock"; section `charge`, desktop 1440x900 and
//      upright 390x844; chargeSize below has the list): every case on and off frame for frame (the strike does not move),
//      the clip from the strike's first frame to the set off on its plan's frames, the hit on its hop (or, since
//      2026-11-21, earlier, at hitMarginMs before the set off, only where the stand has no room for it), the head down only
//      at Turbo 2 and in a slam stop's hurry, the snort once within 140 ms before the lock, the puff on the lock's frame,
//      the snow only on drag frames before the set off, nothing left after he sets off or the board's cut, his picture
//      inside his keep-out reach. ONLY=timing TIMING=<file> [SPOTS=<file>] writes the strike timing rows of any build.
//      ROUND 2 of the effects (contrastSize below): on all six grounds at 1440x900, 390x844 and 360x560, the puff and a
//      speck measured on screenshots against the ground around them, 3 to 1 at least (ONLY=contrast alone, CROPS, BEFORE).
//   HIS GROUND AT COREY'S ROUND 3 PHONE WINDOWS (2026-11-23, section `ground`; Corey: "remap the reindeers walking
//      area so it's below the tree lines, and above the board area for phones, where the baord and treeline where
//      moved"; game/roamGround.ts): at each of the seven windows and at 360x560 the scene as drawn agrees with the
//      layout's own rule to 1 CSS px (the tree line he stands under, the asphalt's top, the logo's keep-out against
//      the sign bar's own copy of it), his move of the board and of the tree line is printed, every seeded pick and
//      walk in has its feet under the tree line and above the asphalt and his body off every key, the logo, the LED
//      strip and the board, and A WALK IN IS FOUND at 440x742, 413x586, 375x530, 626x816, 832x376 and 360x560.
//      UNDER THE SIGN (Corey 2026-11-24: "Let him pass under the sign"): the Fast Lane and Menu signs are zones named
//      'sign'. He never stands under one. A walk IN may cross behind one, only where no way in is clear of every key
//      (the game marks that pick underSign, and since wip/reindeer-probefix only where its way does meet a sign: a
//      second try's way that passes none is not marked, roam.ts wayMeetsSign): at 360x560 every walk in is such a one (the builder's node model:
//      tools/roam_ground_test.mjs), at 440x742 and 832x376 none is.
//      THE SHORT UPRIGHT GROUND (2026-11-25, Corey on the annotated 413x586 still: "Look at my shape";
//      game/roamGround.ts ROAM_SHORT): at 413x586, 375x530 and 626x816 the tree line stands under the right tunnel
//      mouth's top, and his ground there is Corey's band in front of the trees (roam().short): its top edge is
//      roam().trees (so the scene's tree line there is read from the drawn forest and FOREST_LINE), the logo keeps his body off it (not his shadow: the logo is drawn over both), and every walk in
//      comes down from above the mouth's arch behind the Fast Lane sign (sign 'under' below). The builder's node
//      tools/roam_ground_test.mjs (section 5) holds the same with the game's own roamer.
//   a hidden tab: nothing moves; no page errors anywhere
//
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3015 [ONLY=desktop|sideways|upright]
//     [OUT=<file.json>] node tools/roam_probe.mjs
// Uses the dev server that is already running. One headless browser (muted). Wrap each run in tools/browser_lock.sh.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://localhost:3015';
const OUT = process.env.OUT || '';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const TIMING = process.env.TIMING || '';
const SPOTS = process.env.SPOTS || '';
const CROPS = process.env.CROPS || '';
const BEFORE = process.env.BEFORE === '1';
const CONTRAST = process.env.CONTRAST !== '0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, dpr: 1, q: '', touch: false },
	{ name: 'sideways', vp: { width: 844, height: 390 }, dpr: 2, q: '&tier=phone', touch: true },
	{ name: 'upright', vp: { width: 390, height: 844 }, dpr: 2, q: '&tier=phone', touch: true },
	// 1920 x 1080 desktop (16:9, the least snow above the rim): the zones and his head's clearance under the top line only
	{ name: 'desktop1080', vp: { width: 1920, height: 1080 }, dpr: 1, q: '', touch: false, areaOnly: true },
];
// ROUND 4: THE SIZE SWEEP (Corey's 2000 x 945 window shuffled in a corner): at each, his first drawn frame (body and
// shadow) is wholly off the screen; after the walk in, 60 s of his wander at the stepped board clock: he stops at 4 spots
// or more 12 % of the width apart (or as many as the area holds there: its `capacity`), his body never covers a keep-out
// zone and never leaves the screen. `ONLY=sweep` runs all of them, `ONLY=sweep:2000x945` one.
const SWEEP = ['2000x945', '1920x1080', '1440x900', '1280x720', '1366x768', '2560x1080', '1024x768', '844x390', '932x430', '390x844', '430x932', '390x620', '390x664', '360x640'].map((wh) => {
	const [width, height] = wh.split('x').map(Number);
	const phone = Math.min(width, height) <= 480;
	return { name: `sweep:${wh}`, vp: { width, height }, dpr: 1, q: phone ? '&tier=phone' : '', touch: phone, sweep: true };
});
const PRESETS = ['snowDay', 'snowNight', 'snowSuper', 'grassDay', 'grassNight', 'grassSuper'];
// HIS GROUND AT COREY'S ROUND 3 PHONE WINDOWS (ONLY=ground, ground:<size>): `walkIn`: a walk in must be found there (the
// three sizes measured on his phone); `tier`: a phone by the game's device tier (the phablet is not: its short side is
// over 500 CSS px)
const GROUND_SIZES = [
	['440x742', true, true],
	['413x586', true, true, 'under'],
	['375x530', true, true, 'under'],
	['626x816', true, false, 'under'],
	['832x376', true, true],
	['667x311', false, true],
	['890x552', false, false],
	// (not one of his: the short upright window where the Fast Lane sign alone closes his side: a walk in behind it)
	['360x560', true, true, 'under'],
].map(([wh, walkIn, tier, sign]) => {
	const [width, height] = wh.split('x').map(Number);
	return { name: `ground:${wh}`, vp: { width, height }, dpr: 1, q: tier ? '&tier=phone' : '', touch: true, walkIn, sign: sign ?? 'clear' };
});

let pass = 0;
let fail = 0;
const fails = [];
const report = { at: new Date().toISOString(), sizes: {} };
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else {
		fail += 1;
		fails.push(msg);
	}
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 600)) : ''}`);
};
/** THE AREA'S FLOOR this probe asks for (2026-11-18, Corey "Yes" to the probe host's two remaining fails): three well
 *  separated resting spots, spanning 24 % of the width, are accepted held sideways (the phone layout kind) and at 21:9 and
 *  wider; every other size keeps 4 spots and 30 %. */
const floorOf = (kind, vp) => (kind === 'phone' || (vp && vp.width / vp.height >= 2.2) ? { spots: 3, span: 0.24 } : { spots: 4, span: 0.3 });
const r1 = (v) => Math.round(v * 10) / 10;
const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

async function boot(browser, S, extra = '') {
	const ctx = await browser.newContext({ viewport: S.vp, deviceScaleFactor: S.dpr, isMobile: S.touch, hasTouch: S.touch });
	const p = await ctx.newPage();
	// his FIRST DRAWN FRAME, caught by the page itself on every animation frame from the start
	await p.addInitScript(() => {
		const tick = () => {
			try {
				const h = window.__reindeer;
				const r = h && h.roam ? h.roam() : null;
				if (r && r.drawn && !window.__roamFirst) {
					window.__roamFirst = { drawn: r.drawn, state: r.state, x: r.x, y: r.y, vw: innerWidth, vh: innerHeight };
					return;
				}
			} catch (e) {
				window.__roamFirstErr = String(e);
			}
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200));
	});
	await p.goto(`${APP}/?lang=en&sessionID=roam${S.name}${Date.now()}${S.q}${extra}`, { waitUntil: 'domcontentloaded' });
	let ready = false;
	for (let i = 0; i < 160; i++) {
		ready = await p
			.evaluate(() => {
				const h = window.__reindeer;
				return !!(h && h.atRest && h.atRest() && h.hud && document.querySelector('.hudp') && !document.querySelector('.landing') && h.roam && h.roam().ready && h.runMemory().loaded);
			})
			.catch(() => false);
		if (ready) break;
		if (i % 2 === 1) await p.mouse.click(S.vp.width / 2, S.vp.height / 2).catch(() => {});
		await sleep(600);
	}
	for (let i = 0; i < 40; i++) {
		const st = await p.evaluate(() => ({ g: window.__reindeer.hud.gates(), idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest() })).catch(() => null);
		if (st && st.g > 0) {
			await p.mouse.click(S.vp.width / 2, S.vp.height * 0.4).catch(() => {});
			await sleep(400);
			continue;
		}
		if (st && st.idle && st.rest) break;
		await sleep(250);
	}
	await sleep(800);
	return { ctx, p, errs, ready };
}

/** HIS BODY in CSS px at feet (x, y) road px (the widest of his clips, either facing), and his feet's strip */
const bodyOf = (geo) => {
	const { k, ox, oy } = geo.view;
	const s = geo.roam.scale;
	const side = geo.roam.reach.side * s;
	const up = geo.roam.reach.up * s;
	const body = (x, y) => ({ x0: ox + (x - side) * k, x1: ox + (x + side) * k, y0: oy + (y - up) * k, y1: oy + y * k });
	// (2026-11-18) his body AND his cast shadow: the shadow leans from his feet by the page's own castReach per road px of
	// his height (geo.roam.lean), so its box is his body's widened toward that side
	const lean = geo.roam.lean ?? { x: 0, y: 0 };
	const withShadow = (x, y) => {
		const b = body(x, y);
		return { x0: b.x0 - Math.max(0, -lean.x) * up * k, x1: b.x1 + Math.max(0, lean.x) * up * k, y0: Math.min(b.y0, oy + (y + Math.min(0, lean.y) * up) * k), y1: b.y1 };
	};
	const feet = (x, y) => {
		const b = body(x, y);
		return { x0: b.x0, x1: b.x1, y0: b.y1 - (b.y1 - b.y0) * 0.06, y1: b.y1 };
	};
	return { body, feet, withShadow, css: { w: r1(2 * side * k), h: r1(up * k) } };
};
/** (2026-11-18, the tunnel mouths, game/roamPaths.ts ROAM_TUNNELS) does a box (CSS px) overlap a polygon (CSS px) by
 *  more than a hair (the box shrunk 0.25 px a side): a polygon corner in the box, a box corner in the polygon, or two
 *  edges crossing */
const boxMeetsPoly = (b, P) => {
	const x0 = b.x0 + 0.25;
	const x1 = b.x1 - 0.25;
	const y0 = b.y0 + 0.25;
	const y1 = b.y1 - 0.25;
	if (x1 <= x0 || y1 <= y0) return false;
	if (P.some((p) => p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1)) return true;
	const corners = [
		{ x: x0, y: y0 },
		{ x: x1, y: y0 },
		{ x: x1, y: y1 },
		{ x: x0, y: y1 },
	];
	if (corners.some((c) => inPolyCss(c.x, c.y, P))) return true;
	const cross = (a, b2, c, d) => {
		const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
		return o(a, b2, c) * o(a, b2, d) < 0 && o(c, d, a) * o(c, d, b2) < 0;
	};
	for (let i = 0, j = P.length - 1; i < P.length; j = i++) for (let k = 0; k < 4; k++) if (cross(P[j], P[i], corners[k], corners[(k + 1) % 4])) return true;
	return false;
};
const inPolyCss = (x, y, P) => {
	let c = false;
	for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (P[i].y > y !== P[j].y > y && x < ((P[j].x - P[i].x) * (y - P[i].y)) / (P[j].y - P[i].y) + P[i].x) c = !c;
	return c;
};
/** the tunnel mouths in CSS px for this view */
const mouthsCss = (geo) => (geo.roam.tunnels ?? []).map((P) => P.map((p) => ({ x: geo.view.ox + p.x * geo.view.k, y: geo.view.oy + p.y * geo.view.k })));
/** what his body at (x, y) covers: zone names (the road by his feet), 'tunnel mouth' (body, head and shadow), and
 *  'screen' when it leaves the screen. `walking` (a frame of a walk, or a corner of a way round a mouth): the TOP
 *  CORRIDOR is allowed, him partly above the top edge with his feet and 40 % of his height still on the screen (Corey
 *  2026-11-18); a stop never */
const hitsAt = (geo, zones, x, y, walking = false) => {
	const B = bodyOf(geo);
	const out = [];
	// (the road at his feet; a stoplight by his body, his shadow may fall on it; on the short upright ground the logo by
	// his body too, it is drawn over him and his shadow; every other keep-out by body and shadow)
	const byBody = (z) => z.name === 'stoplight' || (z.name === 'logo' && !!geo.roam?.short);
	for (const z of zones) if ((z.name === 'road' ? inter(B.feet(x, y), z) : byBody(z) ? inter(B.body(x, y), z) : inter(B.withShadow(x, y), z)) > 0.5) out.push(z.name);
	if (mouthsCss(geo).some((P) => boxMeetsPoly(B.withShadow(x, y), P))) out.push('tunnel mouth');
	const b = B.body(x, y);
	const topLine = walking ? b.y1 - (b.y1 - b.y0) * 0.4 : b.y0;
	// (the top corridor passes behind the top line's text on a walk: counted as corridor time, never at a stop)
	if (walking) {
		const i = out.indexOf('top line');
		if (i >= 0) out.splice(i, 1);
		// (SKIP TO RESULT's button, 2026-11-19, a zone only while it is up: a walk may pass under it, never a stop)
		const k = out.indexOf('skip');
		if (k >= 0) out.splice(k, 1);
	}
	if (b.x0 < -0.5 || topLine < -0.5 || b.x1 > geo.vp.width + 0.5 || b.y1 > geo.vp.height + 0.5) out.push('screen');
	return out;
};
/** (2026-11-19, the forest behind the upright phone's snow) are his feet at (x, y) road px on the trees: above the game's
 *  tree line (roam().trees: column edges x, per column the highest his feet may stand y) */
const onTrees = (trees, x, y) => {
	if (!trees) return false;
	const X = trees.x;
	if (x < X[0] || x >= X[X.length - 1]) return false;
	let i = 0;
	while (i < trees.y.length - 1 && x >= X[i + 1]) i++;
	return y < trees.y[i] - 1e-6;
};
/** is he in the top corridor at (x, y): partly above the screen's top, or behind the top line's text (CSS) */
const offTopAt = (geo, x, y, zones = []) => {
	const B = bodyOf(geo);
	if (B.body(x, y).y0 < -0.5) return true;
	return zones.some((z) => z.name === 'top line' && inter(B.withShadow(x, y), z) > 0.5);
};
const inPoly = (x, y, P) => {
	let c = false;
	for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
		const a = P[i];
		const b = P[j];
		if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
	}
	return c;
};
/** his head's clearance under the top line's text (the zone is the text plus 8 CSS px), CSS px; Infinity when never under */
const headClear = (geo, zones, x, y) => {
	const b = bodyOf(geo).body(x, y);
	let worst = Infinity;
	for (const z of zones) if (z.name === 'top line' && b.x1 > z.x0 && b.x0 < z.x1) worst = Math.min(worst, b.y0 - (z.y1 - 8));
	return worst;
};

/** step the board clock frame by frame (frozen clock): the per frame log of the roamer and the runner */
/** (2026-11-23, the sign bar) WHAT HE HAS TO STAND ON NOW, for a fail message (runs in the page): the game bar in use,
 *  his state and place, the drawn area's own floor (spots 12 % of the width apart, the span) and how far the game widened
 *  it, the screen in road px, his body's box (road px) and every keep-out but the road, in road px. A key of the bar
 *  that stands on his snow shows here as a 'hud' zone inside the area. */
const ROAM_GROUND = () => {
	const h = window.__reindeer;
	const s = h.roam();
	const v = h.roamView();
	const r = (n) => Math.round(n);
	const zones = h
		.roamZones()
		.filter((z) => z.name !== 'road')
		.map((z) => `${z.name} ${r((z.x0 - v.ox) / v.k)},${r((z.y0 - v.oy) / v.k)} to ${r((z.x1 - v.ox) / v.k)},${r((z.y1 - v.oy) / v.k)}`);
	return { bar: h.hud?.bar ?? null, kind: s.kind, state: s.state, at: [r(s.x), r(s.y)], side: s.side, capacity: s.capacity, widen: s.widen, floor: s.floor, span: s.span, screenRoadPx: [r(v.rect.left), r(v.rect.top), r(v.rect.right), r(v.rect.bottom)], bodyRoadPx: [r(2 * s.reach.side * s.scale), r(s.reach.up * s.scale)], zonesRoadPx: zones };
};

const STEP_STRIKE = async (p, { cell, first, last, hz = 60, turbo = 0, roamOff = false, plain = false }) =>
	p.evaluate(
		async ({ cell, first, last, hz, turbo, roamOff, plain }) => {
			const h = window.__reindeer;
			const R = h.roadBoard();
			const F = R.features;
			h.turbo(turbo);
			h.clock(0);
			h.tune.strike.roam = !roamOff;
			const step = 1000 / hz;
			const rate = [1, 1.7, 2.5][turbo] ?? 1;
			// (the rate the dev hook steps with is the game's own: boardRate(); read it back from the road's features after a step)
			R.update(0.0001, 1, 1);
			const before = { state: F.roam.state, x: F.roam.x, y: F.roam.y, visible: F.roam.sprite.visible };
			let done = false;
			const pr = (plain ? h.strike(cell) : h.roamStrike(cell, { first, last })).then(() => (done = true));
			for (let i = 0; i < 50 && !F.snapshot().runner; i++) await new Promise((r) => setTimeout(r, 10));
			const rows = [];
			let t = 0;
			let impactAt = null;
			let firstRunner = null;
			for (let i = 0; i < 4000; i++) {
				h.step(step, 1);
				t += step;
				await Promise.resolve();
				const snap = F.snapshot();
				const r = snap.runner;
				const ro = snap.roam;
				const runVis = !!(r && r.phase !== 'wait' && F['runner'] && F['runner'].sprite.visible);
				rows.push({ t, phase: r ? r.phase : null, view: r ? r.view : null, stride: r ? r.stride : null, index: r ? r.index : null, x: r ? r.x : null, y: r ? r.y : null, mirrored: r ? r.mirrored : null, roamState: ro.state, roamVis: ro.visible, runVis, rx: ro.x, ry: ro.y });
				if (r && firstRunner === null) firstRunner = { roam: r.roam, pre: r.pre, todayMs: r.todayMs, waitMs: r.waitMs, impactMs: r.impactMs, startX: r.startX, startY: r.startY, poses: r.poses, elapsedMs: r.elapsedMs };
				if (r && r.phase === 'impact' && impactAt === null) impactAt = t;
				if (impactAt !== null && (!r || r.alpha <= 0)) break;
			}
			for (let i = 0; i < 20 && !done; i++) {
				h.step(50, 1);
				await new Promise((r) => setTimeout(r, 5));
			}
			await pr;
			const after = F.snapshot().roam;
			const rateNow = F.rate;
			h.turbo(0);
			return { rows, impactAt, firstRunner, before, after: { state: after.state, walkInAt: after.walkInAt }, rate: rateNow, rect: h.roamView()?.rect ?? null };
		},
		{ cell, first, last, hz, turbo, roamOff, plain },
	);

/** at least `want` of the stops `sep` apart (greedy, in order) */
const spread = (stops, sep) => {
	const kept = [];
	for (const s of stops) if (kept.every((k) => Math.hypot(k[0] - s[0], k[1] - s[1]) >= sep)) kept.push(s);
	return kept.length;
};

async function sweepSize(p, S, name, errs, out) {
	const H = (fn, arg) => p.evaluate(fn, arg);
	// his first appearance: he walks in, the first drawn frame wholly off the screen (body and shadow)
	let first = null;
	for (let i = 0; i < 80 && !first; i++) {
		first = await H(() => window.__roamFirst ?? null);
		if (!first) await sleep(250);
	}
	out.first = first;
	const outside = (b) => !b || b[2] <= 0.5 || b[0] >= first.vw - 0.5 || b[3] <= 0.5 || b[1] >= first.vh - 0.5;
	check(!!first && first.state === 'enter' && outside(first.drawn.sprite) && outside(first.drawn.shadow), `${name}: his first drawn frame is a walk in with him and his shadow wholly off the screen (${first ? `${first.state}, ${JSON.stringify(first.drawn)}` : 'never drawn'})`, first);
	// his arrival, then 60 s of his wander at the stepped board clock
	const run = await H(async () => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		const F = R.features;
		h.clock(0);
		for (let i = 0; i < 60 * 30 && F.roam.state !== 'idle'; i++) R.update(1000 / 60, 1, 1);
		const arrived = F.roam.state === 'idle';
		// (a fixed seed from here: the game's own is fresh each page, and the probe must repeat)
		h.roamReseed(4711);
		const pos = [];
		const stops = [];
		for (let i = 0; i < 60 * 60; i++) {
			R.update(1000 / 60, 1, 1);
			const ro = F.roam;
			if (i % 2 === 0) pos.push([Math.round(ro.x * 10) / 10, Math.round(ro.y * 10) / 10, ro.state]);
			if (ro.state === 'idle' && (!stops.length || Math.hypot(stops[stops.length - 1][0] - ro.x, stops[stops.length - 1][1] - ro.y) > 0.5)) stops.push([ro.x, ro.y]);
		}
		h.clock(1);
		const snap = h.roam();
		return { arrived, pos, stops, view: h.roamView(), zones: h.roamZones(), roam: snap, vp: { width: innerWidth, height: innerHeight } };
	});
	const geo = { view: run.view, roam: run.roam, vp: run.vp };
	const W = run.view.rect.right - run.view.rect.left;
	const got = spread(run.stops, 0.12 * W);
	// 4 spots 12 % of the width apart; an area that holds fewer, at least 2 or what it holds.
	// HELD SIDEWAYS (2026-11-17, the redrawn phone area, game/roamPaths.ts): the area now takes all the free snow, the top
	// snow rim included, but from his side (he walks in level from past the right edge) only the snow right of the right
	// tunnel can be reached: the Auto / Turbo capsule closes the rim's right end above it, the tunnel's end and the road
	// close it below, and he never pops in. That strip (about 264 x 500 road px at 844 x 390 and 932 x 430) holds 2 spots
	// 12 % of the width apart (one high, one low), so 2 is the honest bar there, whatever the floor's `capacity` (which
	// counts the rim) says.
	// ULTRAWIDE (2026-11-18, Corey "Yes", the probe host's "sweep:2560x1080 ... 3 of them 12 % of the width apart (wanted
	// 4)"): three well separated resting spots are accepted at 21:9 and wider (floorOf below); every other size keeps 4
	const want = run.roam.kind === 'phone' ? 2 : run.roam.capacity >= 4 ? floorOf(run.roam.kind, run.vp).spots : Math.min(2, run.roam.capacity);
	const hits = [];
	const walkingState = (st) => st === 'start' || st === 'walk' || st === 'stop';
	let offTop = 0;
	let restOffTop = 0;
	let mouthFrames = 0;
	for (let i = 0; i < run.pos.length; i++) {
		const [x, y, st] = run.pos[i];
		const hz = hitsAt(geo, run.zones, x, y, walkingState(st));
		if (hz.includes('tunnel mouth')) mouthFrames++;
		if (offTopAt(geo, x, y, run.zones)) {
			offTop++;
			if (!walkingState(st)) restOffTop++;
		}
		if (hz.length && hits.length < 5) hits.push(`${hz.join(', ')} at (${run.pos[i].join(', ')}), ${r1((i * 2) / 60)} s`);
	}
	// no shuffling: never straight back to the spot before while he has others
	let backs = 0;
	for (let i = 2; i < run.stops.length; i++) if (Math.hypot(run.stops[i][0] - run.stops[i - 2][0], run.stops[i][1] - run.stops[i - 2][1]) < 0.04 * W) backs++;
	out.sweep = { kind: run.roam.kind, capacity: run.roam.capacity, relaxed: run.roam.relaxed, widen: run.roam.widen, stops: run.stops.length, spread: got, backs, offTopShare: Math.round((offTop / Math.max(1, run.pos.length)) * 1000) / 10, rounds: run.roam.counts.rounds, corridor: run.roam.counts.corridor, walks: run.roam.counts.walks, at: run.stops.map((q) => [Math.round(q[0]), Math.round(q[1])]) };
	// THE TUNNEL MOUTHS AND THE TOP CORRIDOR (Corey 2026-11-18): never a frame of his body, head or shadow on a mouth;
	// never at rest partly off the screen; the corridor's share of the time kept small
	// (Corey "Yes", 2026-11-18: his head may pass behind the top line's text on a walk through the top corridor; that is
	// accepted as it is, counted in the corridor's share below, never at rest)
	// THE FOREST (Corey 2026-11-19: "the reindeer is walking on the trees"): never a foot on the trees, and the spot floor
	// (3 spots 12 % apart, his yes) where a forest is drawn
	const treeFrames = run.pos.filter(([x, y]) => onTrees(run.roam.trees, x, y)).length;
	out.sweep.forest = run.roam.trees ? { kit: run.roam.trees.forest?.kit, line: Math.round(Math.min(...run.roam.trees.y)) } : null;
	check(treeFrames === 0, `${name}: 60 s of his walk: his feet never on the trees (${run.roam.trees ? `the ${run.roam.trees.forest?.kit} forest's tree line at road y ${out.sweep.forest.line}` : 'no forest drawn here'})`, { treeFrames });
	if (run.roam.trees) check(run.roam.capacity >= 3, `${name}: below the trees the area holds ${run.roam.capacity} spots 12 % of the width apart (the floor: 3)`, out.sweep);
	check(mouthFrames === 0, `${name}: 60 s of his walk (${run.pos.length} frames): his body, head and shadow never on a tunnel mouth (${run.roam.counts.rounds} walks round one)`, out.sweep);
	check(restOffTop === 0, `${name}: never at rest with any part off the screen`, out.sweep);
	check(offTop / Math.max(1, run.pos.length) <= 0.05, `${name}: in the top corridor (partly above the screen's top, or behind the top line on a walk) ${out.sweep.offTopShare} % of the time (the top corridor, ${run.roam.counts.corridor} of ${run.roam.counts.walks} walks; at most 5 %)`, out.sweep);
	check(run.arrived, `${name}: he walks in and stops at a spot (${run.roam.kind}, area holds ${run.roam.capacity} spots 12 % apart${run.roam.relaxed ? ', widened to all the free snow' : ''})`);
	check(got >= want, `${name}: in 60 s he stops at ${run.stops.length} spots, ${got} of them 12 % of the width apart (wanted ${want})`, out.sweep);
	check(backs <= Math.max(1, Math.floor(run.stops.length / 4)), `${name}: no shuffling between two spots (${backs} straight returns in ${run.stops.length} stops)`, out.sweep);
	check(hits.length === 0, `${name}: every frame of the 60 s his body and shadow are clear of every keep-out zone (HUD, top line, logo, LED strip, road) and on the screen`, hits);
	// THE LED BOARD RAISED (2026-11-18: a capture at 1440 x 900 in free spins showed him over the strip's last digits): the
	// back board risen and seated (a Free Spins entry card, the scoreboard stepped by hand), then 20 s more of his wander:
	// the raised board is a keep-out (zone 'LED board') as the resting strip is ('LED strip'); if it rises over where he
	// stands he goes and a new one walks in; never a frame of his body or shadow over either
	const up = await H(async () => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		const F = R.features;
		h.scoreboardManual(true);
		h.scoreboardCard('fs');
		for (let i = 0; i < 200; i++) h.scoreboardStep(10);
		const seated = h.scoreboard().back;
		h.clock(0);
		const pos = [];
		for (let i = 0; i < 60 * 20; i++) {
			R.update(1000 / 60, 1, 1);
			if (i % 2 === 0 && F.roam.state !== 'none') pos.push([Math.round(F.roam.x * 10) / 10, Math.round(F.roam.y * 10) / 10, F.roam.state]);
		}
		const zones = h.roamZones();
		h.scoreboardCardEnd();
		h.scoreboardLower();
		for (let i = 0; i < 300; i++) h.scoreboardStep(10);
		h.scoreboardManual(false);
		h.clock(1);
		return { pos, zones, seated: { visible: seated.visible, offset: seated.offset } };
	});
	const zb = up.zones.filter((z) => z.name === 'LED board' || z.name === 'LED strip').map((z) => z.name);
	check(up.seated.visible && zb.includes('LED board') && zb.includes('LED strip'), `${name}: with the LED board raised both it and the strip are keep-outs (${zb.join(', ')})`, up);
	const upHits = [];
	for (let i = 0; i < up.pos.length && upHits.length < 5; i++) {
		// (a walk in starts past the screen's edge: off the screen is fine then, the zones are not)
		const hz = hitsAt(geo, up.zones, up.pos[i][0], up.pos[i][1], walkingState(up.pos[i][2])).filter((z) => !(z === 'screen' && up.pos[i][2] === 'enter'));
		if (hz.length) upHits.push(`${hz.join(', ')} at (${up.pos[i].join(', ')})`);
	}
	check(upHits.length === 0, `${name}: 20 s with the LED board raised, every frame his body and shadow clear of the board, the strip and every other keep-out (${up.pos.length} frames on the screen)`, upHits);
	check(errs.length === 0, `${name}: no page errors`, errs.slice(0, 5));
	console.log(`  INFO ${name}: ${JSON.stringify(out.sweep)}`);
}

async function runSize(browser, S) {
	const out = { name: S.name };
	report.sizes[S.name] = out;
	const name = `${S.name} ${S.vp.width}x${S.vp.height}`;
	const { ctx, p, errs, ready } = await boot(browser, S);
	check(ready, `${name}: the game and the roaming reindeer's frames are ready`);
	if (!ready) {
		await ctx.close();
		return;
	}
	const H = (fn, arg) => p.evaluate(fn, arg);
	if (S.sweep) {
		await sweepSize(p, S, name, errs, out);
		await ctx.close();
		return;
	}

	// ---- 1: at rest -------------------------------------------------------------------------------------------------
	// (he walks in first since round 4: wait for him to arrive)
	for (let i = 0; i < 60; i++) {
		const st = await H(() => window.__reindeer.roam().state);
		if (st !== 'enter' && st !== 'none') break;
		await sleep(500);
	}
	const rest = await H(() => window.__reindeer.roam());
	out.rest = { state: rest.state, x: rest.x, y: rest.y, kind: rest.kind, corners: rest.corners };
	check(rest.on && rest.visible && rest.onScreen && ['idle', 'start', 'walk', 'stop'].includes(rest.state), `${name}: at rest one reindeer stands on the screen (${rest.state} at road (${r1(rest.x)}, ${r1(rest.y)}))`, rest);
	const mem = await H(() => window.__reindeer.roamMemory());
	out.memory = mem;
	console.log(`  INFO ${name}: roam sheets ${mem.sheets.join(', ')} = ${mem.mb} MB (${mem.mipmapped ? `${mem.mbWithMips} MB with mips` : 'no mips'})`);

	// ---- 5: the area and the zones -----------------------------------------------------------------------------------
	const zones = await H(() => window.__reindeer.roamZones());
	const geo = await H(() => ({ view: window.__reindeer.roamView(), roam: window.__reindeer.roam(), vp: { width: innerWidth, height: innerHeight } }));
	out.zones = zones.map((z) => ({ name: z.name, box: [z.x0, z.y0, z.x1, z.y1].map(r1) }));
	out.body = bodyOf(geo).css;
	out.area = geo.roam.corners;
	const names = new Set(zones.map((z) => z.name));
	check(['road', 'hud', 'LED strip', 'logo', 'top line'].every((n) => names.has(n)) && !names.has('counter plate'), `${name}: the keep-out zones measured (${[...names].join(', ')}; no counter plate)`);
	const picks = await H(() => window.__reindeer.roamPicks(300, 60, 9090));
	const poly = geo.roam.corners;
	// THE AREA THE GAME USES (2026-11-18): the drawn polygon, or as the floor widened it at this window (the top snow
	// rim, or all the free snow): read from the game, and the widening itself checked against the drawn area's numbers
	const inAreaAll = async (list) => H((l) => l.map(([x, y]) => window.__reindeer.roamInArea(x, y)), list);
	const pickIn = await inAreaAll(picks.map((q) => [q.x, q.y]));
	const fl = geo.roam.floor;
	out.floor = { widen: geo.roam.widen, own: fl, capacity: geo.roam.capacity, span: geo.roam.span };
	// the floor this probe holds the drawn area to (floorOf: 3 spots and 24 % of the width held sideways and at 21:9 and
	// wider, Corey "Yes" 2026-11-18; 4 and 30 % everywhere else). The game's own FLOOR_SPOTS / FLOOR_SPAN (4, 30 %) only
	// decide whether it TRIES to widen the area, and a widening is kept only where it gives him more room: at 844 x 390
	// neither widening does (the drawn area stays, 3 spots over 24 %), so the game is left as it is.
	const FL = floorOf(geo.roam.kind, geo.vp);
	check(geo.roam.widen === 0 ? fl.spots >= FL.spots && fl.span >= FL.span - 0.005 : fl.spots < 4 || fl.span < 0.3, `${name}: the area ${geo.roam.widen ? `is widened (${geo.roam.widen === 1 ? 'the top snow rim' : 'all the free snow'}) because the drawn one holds ${fl.spots} spots 12 % apart spanning ${Math.round(fl.span * 100)} % of the width` : `is the drawn one: it holds ${fl.spots} spots 12 % apart spanning ${Math.round(fl.span * 100)} % of the width`} (the floor here: ${FL.spots} and ${Math.round(FL.span * 100)} %)`, out.floor);
	const bad = [];
	let level = 0;
	let relaxed = 0;
	let none = 0;
	let worstHead = Infinity;
	const lengths = [];
	const W = geo.view.rect.right - geo.view.rect.left;
	const tan = Math.tan((14 * Math.PI) / 180);
	for (const q of picks) {
		if (q.pass < 0) {
			none++;
			continue;
		}
		if (onTrees(geo.roam.trees, q.x, q.y)) bad.push(`${q.walkIn ? 'walk in' : 'pick'} (${r1(q.x)}, ${r1(q.y)}) on the trees`);
		if (!pickIn[picks.indexOf(q)]) bad.push(`${q.walkIn ? 'walk in' : 'pick'} (${r1(q.x)}, ${r1(q.y)}) outside the area the game uses`);
		const h0 = hitsAt(geo, zones, q.x, q.y);
		if (h0.length) bad.push(`${q.walkIn ? 'walk in' : 'pick'} (${r1(q.x)}, ${r1(q.y)}) covers ${h0.join(', ')}`);
		worstHead = Math.min(worstHead, headClear(geo, zones, q.x, q.y));
		// the walk there (from the spot before, or level from past the screen's edge; round a tunnel mouth by its way's
		// corners), every 4 road px; a walk's frames may use the top corridor
		const legs = q.route && q.route.length > 1 ? q.route : [{ x: q.fromX, y: q.fromY }, { x: q.x, y: q.y }];
		// (a walk in round a tunnel mouth: its first corner is past the screen's edge too)
		let broke = false;
		for (let L = 0; L + 1 < legs.length && !broke; L++) {
			const a = legs[L];
			const b = legs[L + 1];
			const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
			for (let i = L === 0 ? 1 : 0; i < n; i++) {
				const x = a.x + ((b.x - a.x) * i) / n;
				const y = a.y + ((b.y - a.y) * i) / n;
				// (a walk in that found no way clear of every key may cross behind the Fast Lane or Menu sign, Corey
				// 2026-11-24: "Let him pass under the sign"; the game marks such a pick underSign)
				const hw = hitsAt(geo, zones, x, y, true).filter((z) => !(q.walkIn && z === 'screen') && !(q.walkIn && q.underSign && z === 'sign'));
				if (onTrees(geo.roam.trees, x, y)) hw.push('the trees');
				if (hw.length) {
					bad.push(`the walk to (${r1(q.x)}, ${r1(q.y)}) covers ${hw.join(', ')} at (${r1(x)}, ${r1(y)})`);
					broke = true;
					break;
				}
				// (the 8 px under the top line holds everywhere but the top corridor, Corey 2026-11-18: there a walk passes
				// behind the text; counted as corridor time, never a stop: the spots' own clearance is checked above)
				if (!offTopAt(geo, x, y, zones)) worstHead = Math.min(worstHead, headClear(geo, zones, x, y));
			}
		}
		if (q.walkIn) {
			// level from past the edge, or (round a tunnel mouth, 2026-11-18) by its way's corners from there
			if (!q.route && Math.abs(q.y - q.fromY) > 1e-6) bad.push('a walk in that is not level');
			continue;
		}
		const dx = q.x - q.fromX;
		const dy = q.y - q.fromY;
		if (q.pass === 0) {
			level++;
			if (Math.abs(dy) > Math.abs(dx) * tan + 1) bad.push(`a walk steeper than 14 degrees on pass 0 (${r1(dx)}, ${r1(dy)})`);
			lengths.push(Math.hypot(dx, dy) / W);
		} else relaxed++;
	}
	const hopsOk = lengths.every((l) => l >= 0.04 - 1e-6 && l <= 0.18 + 1e-6);
	out.picks = { count: picks.length, level, relaxed, none, worstHeadPx: worstHead === Infinity ? null : r1(worstHead), minLen: lengths.length ? r1(Math.min(...lengths) * 1000) / 10 : null, maxLen: lengths.length ? r1(Math.max(...lengths) * 1000) / 10 : null };
	check(bad.length === 0, `${name}: ${picks.length} seeded picks (300 in a row, 60 walk ins): every spot's feet inside the area, his body clear of every keep-out zone and on the screen, every walk there clear all the way, the walks in level`, bad.slice(0, 8));
	check(level + relaxed + picks.filter((q) => q.walkIn && q.pass >= 0).length >= picks.length / 2, `${name}: he finds his next spot (${level} within 14 degrees, ${relaxed} with the rule relaxed, ${none} times none: he sniffs again)`, out.picks);
	check(hopsOk, `${name}: the walks' lengths are 4 to 18 % of the screen's width (${out.picks.minLen} to ${out.picks.maxLen} %)`, out.picks);
	check(worstHead >= 8 - 1e-6, `${name}: his head clears the top line by 8 CSS px or more at every spot and every walk (${worstHead === Infinity ? 'never under it' : `closest ${r1(worstHead)} px`})`, out.picks);
	console.log(`  INFO ${name}: his body ${out.body.w} x ${out.body.h} CSS px; area ${poly.length} corners; pace ${geo.roam.pace} (walk in ${geo.roam.paceIn}) x the rig's walk = ${r1(((geo.roam.pace * 4.8169 * 0.18465 * geo.roam.scale * 30) / W) * 1000) / 10} % (walk in ${r1(((geo.roam.paceIn * 4.8169 * 0.18465 * geo.roam.scale * 30) / W) * 1000) / 10} %) of the screen's width a second`);

	// ---- 1: the wander, seeded, every frame ---------------------------------------------------------------------------
	const spot0 = picks.find((q) => !q.walkIn && q.pass >= 0) ?? { x: geo.roam.x, y: geo.roam.y };
	const wander = async () =>
		H(async (s0) => {
			const h = window.__reindeer;
			const R = h.roadBoard();
			const F = R.features;
			h.clock(0);
			h.tune.strike.roam = true;
			h.roamReseed(4242);
			h.roamStandAt(s0.x, s0.y);
			const trace = [];
			const pos = [];
			const stops = [];
			const states = new Set();
			for (let i = 0; i < 60 * 45; i++) {
				R.update(1000 / 60, 1, 1);
				const ro = F.roam;
				states.add(ro.state);
				pos.push([Math.round(ro.x * 100) / 100, Math.round(ro.y * 100) / 100, ro.state]);
				if (ro.state === 'idle' && (!stops.length || Math.hypot(stops[stops.length - 1][0] - ro.x, stops[stops.length - 1][1] - ro.y) > 0.5)) stops.push([ro.x, ro.y]);
				if (i % 6 === 0) trace.push([ro.state, Math.round(ro.x * 100) / 100, Math.round(ro.y * 100) / 100, ro.clip, Math.round(ro.frame * 100) / 100]);
			}
			return { trace, pos, stops, states: [...states] };
		}, spot0);
	const w1 = await wander();
	const w2 = await wander();
	out.wander = { states: w1.states, stops: w1.stops.length };
	check(w1.states.includes('idle') && w1.states.includes('walk') && w1.states.includes('start') && w1.states.includes('stop'), `${name}: in 45 s he sniffs and walks (start, walk, stop) from spot to spot (${w1.states.join(', ')})`, w1.states);
	check(w1.stops.length >= 3, `${name}: he stops at ${w1.stops.length} different spots in 45 s`, w1.stops.length);
	const stopIn = await inAreaAll(w1.stops);
	const offArea = w1.stops.filter((_, i) => !stopIn[i]);
	check(offArea.length === 0, `${name}: every stop's feet are inside the area the game uses${geo.roam.widen ? ' (widened)' : ''}`, offArea.slice(0, 3));
	const frameHits = [];
	let wMouth = 0;
	for (let i = 0; i < w1.pos.length; i++) {
		const st = w1.pos[i][2];
		const hz = hitsAt(geo, zones, w1.pos[i][0], w1.pos[i][1], st === 'start' || st === 'walk' || st === 'stop');
		if (hz.includes('tunnel mouth')) wMouth++;
		if (hz.length && frameHits.length < 5) frameHits.push(`frame ${i}: ${hz.join(', ')} at (${w1.pos[i].join(', ')})`);
	}
	check(wMouth === 0, `${name}: 45 s of his seeded walk (${w1.pos.length} frames): his body, head and shadow never on a tunnel mouth`, wMouth);
	const wTrees = w1.pos.filter(([x, y]) => onTrees(geo.roam.trees, x, y)).length;
	check(wTrees === 0, `${name}: 45 s of his seeded walk: his feet never on the trees (${geo.roam.trees ? `the ${geo.roam.trees.forest?.kit} forest` : 'no forest drawn here'})`, wTrees);
	check(frameHits.length === 0, `${name}: every frame of the 45 s (${w1.pos.length}) his body is clear of every keep-out zone and on the screen`, frameHits);
	const same = w1.trace.length === w2.trace.length && w1.trace.every((t, i) => t[0] === w2.trace[i][0] && t[3] === w2.trace[i][3] && Math.abs(t[1] - w2.trace[i][1]) < 0.1 && Math.abs(t[2] - w2.trace[i][2]) < 0.1 && Math.abs(t[4] - w2.trace[i][4]) < 0.1);
	check(same, `${name}: the same seed walks the same way (seeded, no Math.random): ${w1.trace.length} samples match`);
	if (S.areaOnly) {
		await H(() => window.__reindeer.clock(1));
		check(errs.length === 0, `${name}: no page errors`, errs.slice(0, 5));
		await ctx.close();
		return;
	}

	// ---- 5: every scene preset ----------------------------------------------------------------------------------------
	const presets = [];
	for (const preset of PRESETS) {
		const r = await H(async (preset) => {
			const h = window.__reindeer;
			h.sceneWant(preset);
			for (let i = 0; i < 80; i++) {
				const s = h.sceneSwap();
				if (s && s.shown === preset && (!s.fade || s.fade.t === undefined || s.fade.done !== false)) break;
				await new Promise((r) => setTimeout(r, 100));
			}
			await new Promise((r) => setTimeout(r, 1500));
			const ro = h.roam();
			return { preset, shown: h.scene().preset, state: ro.state, visible: ro.visible, onScreen: ro.onScreen };
		}, preset);
		presets.push(r);
	}
	await H(() => window.__reindeer.sceneWant('snowDay'));
	out.presets = presets;
	check(presets.every((q) => q.visible && q.onScreen && q.state !== 'none'), `${name}: he is drawn on the screen in all six scene presets`, presets);

	// ---- 2 and 7: his strike against the one from off the screen, per rate --------------------------------------------
	const cells = [0, 8, 19];
	const timing = [];
	// his spots for these strikes: the seeded picks' (a different one per case)
	const spots = picks.filter((q) => !q.walkIn && q.pass >= 0);
	let si = 0;
	for (const cell of cells) {
		for (const [hz, turbo, label] of [
			[60, 0, '60 Hz'],
			[30, 0, '30 Hz'],
			[20, 0, '20 Hz'],
			[60, 1, '60 Hz turbo 1'],
			[60, 2, '60 Hz turbo 2'],
		]) {
			const at = spots[si++ % spots.length];
			await H((q) => window.__reindeer.roamStandAt(q.x, q.y), at);
			const today = await STEP_STRIKE(p, { cell, hz, turbo, plain: true });
			await H((q) => window.__reindeer.roamStandAt(q.x, q.y), at);
			const mine = await STEP_STRIKE(p, { cell, first: true, last: false, hz, turbo });
			const fr = mine.firstRunner;
			timing.push({ cell, rate: label, spot: [r1(at.x), r1(at.y)], todayMs: today.impactAt, roamMs: mine.impactAt, waitMs: fr?.waitMs, pre: fr?.pre, roam: fr?.roam });
			const tag = `${name}: cell ${cell} (reel ${Math.floor(cell / 4) + 1}) at ${label}, from road (${r1(at.x)}, ${r1(at.y)})`;
			if (!fr?.roam) {
				check(false, `${tag}: the first strike is his`, fr);
				continue;
			}
			check(mine.impactAt !== null && today.impactAt !== null && mine.impactAt <= today.impactAt + 1e-6, `${tag}: his impact (${r1(mine.impactAt)} ms) is not later than the strike from off the screen (${r1(today.impactAt)} ms)`, { mine: mine.impactAt, today: today.impactAt, waitMs: fr.waitMs });
			if (hz === 60 && turbo === 0) {
				// he starts where he stood; alert until the set off; never both or neither once the run is on
				check(Math.abs(fr.startX - mine.before.x) < 0.02 && Math.abs(fr.startY - mine.before.y) < 0.02, `${tag}: his run starts from where he stood`, { start: [fr.startX, fr.startY], stood: [mine.before.x, mine.before.y] });
				const runRows = mine.rows.filter((r) => r.phase && r.phase !== 'wait');
				const waitRows = mine.rows.filter((r) => r.phase === 'wait');
				check(waitRows.every((r) => r.roamVis && r.roamState === 'alert'), `${tag}: he stands alert on the screen until his run sets off (${waitRows.length} frames)`);
				check(runRows.every((r) => !r.roamVis && r.roamState === 'none'), `${tag}: from the set off he is gone (the runner is him) and he does not come back`, runRows.filter((r) => r.roamVis).slice(0, 2));
				const order = [];
				for (const r of runRows) if (r.view && r.view !== order[order.length - 1]) order.push(r.view);
				check(/^R+SQ*MC*Q+$/.test(order.join('')) || /^RSQMCQ$/.test(order.join('')), `${tag}: his run is the strike's (views ${order.join('')})`);
				const firstC = runRows.find((r) => r.view === 'C');
				check(!firstC || firstC.stride === 7, `${tag}: the run down starts on pose 7 (${firstC?.stride})`);
			}
		}
	}
	out.timing = timing;
	console.log(`  STRIKE TIMING ${name} (ms from the strike's start to the impact frame; off screen = today):`);
	for (const t of timing) console.log(`    cell ${String(t.cell).padStart(2)} ${t.rate.padEnd(14)} from ${JSON.stringify(t.spot).padEnd(16)} today ${r1(t.todayMs)}  roam ${r1(t.roamMs)}  diff ${r1(t.roamMs - t.todayMs)}  wait ${r1(t.waitMs)}${t.pre ? `  run back out ${t.pre} poses` : ''}`);

	// ---- 3 and 4: a second strike from off the screen; the walk in after the last ------------------------------------
	await H((q) => window.__reindeer.roamStandAt(q.x, q.y), spots[0]);
	const s1 = await STEP_STRIKE(p, { cell: 9, first: true, last: false });
	const s2 = await STEP_STRIKE(p, { cell: 14, first: false, last: true });
	const fr2 = s2.firstRunner;
	const rect = s2.rect;
	const offStart = fr2 && rect ? fr2.startX < rect.left || fr2.startX > rect.right : false;
	check(s1.firstRunner?.roam === true && fr2 && fr2.roam === false && offStart, `${name}: the spin's second strike comes from off the screen (starts at road x ${fr2 ? r1(fr2.startX) : '-'}, the screen is ${rect ? `${r1(rect.left)} to ${r1(rect.right)}` : '-'})`, fr2);
	check(s2.rows.every((r) => r.roamState === 'none' && !r.roamVis), `${name}: he does not come back during the second strike`);
	check(s2.after.walkInAt !== null, `${name}: after the spin's last strike a new one is due to walk in (in ${s2.after.walkInAt} ms)`, s2.after);
	const walkIn = await H(async () => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		const F = R.features;
		const rect = h.roamView().rect;
		const log = [];
		let t = 0;
		let entered = null;
		let onAt = null;
		let arrived = null;
		const n0 = F.roam.counts.arrived;
		const rounds0 = F.roam.counts.rounds;
		for (let i = 0; i < 60 * 40; i++) {
			R.update(1000 / 60, 1, 1);
			t += 1000 / 60;
			const ro = F.roam;
			if (ro.state === 'enter' && entered === null) entered = { t, x: ro.x, y: ro.y };
			if (ro.state === 'enter' && onAt === null && ro.standing()) onAt = t;
			if (ro.counts.arrived > n0) {
				arrived = { t, x: ro.x, y: ro.y, state: ro.state, enterY: entered ? entered.y : null, routed: ro.counts.rounds > rounds0 };
				break;
			}
			if (i % 30 === 0) log.push([Math.round(t), ro.state, Math.round(ro.x), Math.round(ro.y)]);
		}
		return { entered, onAt, arrived, rect, log: log.slice(0, 8) };
	});
	out.walkIn = walkIn;
	const enteredOff = walkIn.entered && (walkIn.entered.x < walkIn.rect.left || walkIn.entered.x > walkIn.rect.right);
	check(!!walkIn.entered && enteredOff, `${name}: the new one starts walking in from past the screen's edge (road x ${walkIn.entered ? r1(walkIn.entered.x) : '-'})`, walkIn);
	check(!!walkIn.arrived && walkIn.arrived.state === 'idle' && (await inAreaAll([[walkIn.arrived.x, walkIn.arrived.y]]))[0] && (walkIn.arrived.routed || Math.abs(walkIn.arrived.y - walkIn.arrived.enterY) < 0.01), `${name}: he walks in (level, or round a tunnel mouth: ${walkIn.arrived?.routed ? 'round one' : 'level'}) and stops at a spot of the area, sniffing (on the screen after ${walkIn.onAt ? r1(walkIn.onAt / 1000) : '-'} s, arrived after ${walkIn.arrived ? r1(walkIn.arrived.t / 1000) : '-'} s at the 1x board clock)`, walkIn);

	// ---- 7: a strike before he is on the screen, and one while he walks in on it ---------------------------------------
	const early = await H(async () => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		const F = R.features;
		const picks0 = F.roam.counts.picks;
		h.roamWalkIn(0);
		R.update(1000 / 60, 1, 1);
		R.update(1000 / 60, 1, 1);
		const atOnce = F.roam.state;
		// (2026-11-23, the sign bar at 844 x 390: state 'none' here, both runs the same) A walk in sets off only when a
		// pick finds a spot with a clear way in from his side; with none the game tries again every half second. Under the
		// glass dock the first pick always found one. So that the strike below still meets one who is past the edge, the
		// board's clock is stepped until he sets off (60 s at most); how long that took is its own line.
		let waitedMs = 0;
		while (F.roam.state !== 'enter' && waitedMs < 60000) {
			R.update(1000 / 60, 1, 1);
			waitedMs += 1000 / 60;
		}
		return { state: F.roam.state, standing: !!F.roam.standing(), x: F.roam.x, y: F.roam.y, atOnce, waitedMs: Math.round(waitedMs), picks: F.roam.counts.picks - picks0, to: { x: Math.round(F.roam.to.x), y: Math.round(F.roam.to.y) } };
	});
	const ground = early.atOnce === 'enter' ? null : await H(ROAM_GROUND);
	check(early.atOnce === 'enter', `${name}: a new one sets off on his walk in on the first pick (a spot with a clear way in from his side is found at once; here ${early.state === 'enter' ? `after ${early.waitedMs} ms and ${early.picks} picks, to road (${early.to.x}, ${early.to.y})` : `none in 60 s and ${early.picks} picks`})`, { early, ground });
	const e1 = await STEP_STRIKE(p, { cell: 4, first: true, last: false });
	check(early.state === 'enter' && !early.standing && e1.firstRunner && e1.firstRunner.roam === false && e1.rows.every((r) => r.roamState === 'none'), `${name}: a spin's first strike while the new one is still past the edge comes from off the screen, and he gives way`, { early, runner: e1.firstRunner });
	const mid = await H(async () => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		const F = R.features;
		h.roamWalkIn(0);
		for (let i = 0; i < 60 * 30 && !F.roam.standing(); i++) R.update(1000 / 60, 1, 1);
		for (let i = 0; i < 20; i++) R.update(1000 / 60, 1, 1);
		return { state: F.roam.state, standing: !!F.roam.standing(), x: F.roam.x, y: F.roam.y };
	});
	const e2 = await STEP_STRIKE(p, { cell: 4, first: true, last: false });
	check(mid.state === 'enter' && e2.firstRunner && e2.firstRunner.roam === true && Math.abs(e2.firstRunner.startX - mid.x) < 0.02, `${name}: a spin's first strike while he walks in on the screen is his, from where he is (road x ${r1(mid.x)})`, { mid, runner: e2.firstRunner });

	// ---- STRIKE.roam false: as before -------------------------------------------------------------------------------
	const off = await H(() => {
		const h = window.__reindeer;
		h.tune.strike.roam = false;
		h.roadBoard().update(1000 / 60, 1, 1);
		return h.roam();
	});
	check(off.state === 'none' && !off.visible, `${name}: STRIKE.roam false: no roaming reindeer on the screen`, off);
	const a = await STEP_STRIKE(p, { cell: 10, first: true, last: true, roamOff: true });
	const b = await STEP_STRIKE(p, { cell: 10, plain: true, roamOff: true });
	const strip = (rows) => rows.map((r) => [r.phase, r.view, r.stride, r.index, r.x, r.y, r.mirrored].join(','));
	check(JSON.stringify(strip(a.rows)) === JSON.stringify(strip(b.rows)) && a.impactAt === b.impactAt && a.firstRunner.roam === false, `${name}: STRIKE.roam false: a spin's first strike is frame for frame the strike from off the screen (${a.rows.length} frames, impact ${r1(a.impactAt)} ms)`);
	// (round 4: switched back on, he WALKS IN; the check steps the board clock until he stands on the screen)
	const stays = await H(() => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		for (let i = 0; i < 60 * 5; i++) R.update(1000 / 60, 1, 1);
		const r = h.roam();
		h.tune.strike.roam = true;
		let t = 0;
		let back = h.roam();
		for (let i = 0; i < 60 * 30; i++) {
			R.update(1000 / 60, 1, 1);
			t += 1000 / 60;
			const ro = R.features.roam;
			if (ro.state === 'idle' && ro.standing()) break;
		}
		back = h.roam();
		return { off: [r.state, r.visible], back: [back.state, back.visible, back.onScreen], ms: Math.round(t) };
	});
	check(stays.off[0] === 'none' && !stays.off[1], `${name}: STRIKE.roam false: no walk in after the last strike`, stays);
	check(stays.back[0] === 'idle' && stays.back[1] && stays.back[2], `${name}: STRIKE.roam back on: a new one walks in and stands on the screen (after ${r1(stays.ms / 1000)} s of the board clock)`, stays);

	// ---- HE ALWAYS COMES BACK (2026-11-18: the game is named after him): every way he leaves, and the time until a new
	// one stands on the screen (board clock; the LED board's own rise and fall in real time) --------------------------
	const comeBack = async (label, leave) => {
		const r = await H(async (leave) => {
			const h = window.__reindeer;
			const R = h.roadBoard();
			const F = R.features;
			h.clock(0);
			h.tune.strike.roam = true;
			const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
			const step = (ms) => {
				for (let t = 0; t < ms; t += 1000 / 60) R.update(1000 / 60, 1, 1);
			};
			const left0 = F.roam.counts.left;
			let gone = false;
			if (leave === 'strike, not marked last') {
				let done = false;
				h.roamStrike(8, { first: true, last: false }).then(() => (done = true));
				for (let i = 0; i < 400 && !done; i++) {
					step(50);
					await Promise.resolve();
				}
				step(400);
				gone = F.roam.state === 'none';
			} else if (leave === 'the LED board rises over him') {
				// stand him where the raised board will be, then raise it
				h.clock(1);
				h.scoreboardRaise();
				await sleep(2500);
				h.clock(0);
				step(100);
				gone = F.roam.state === 'none' || F.roam.counts.left > left0;
				h.clock(1);
				h.scoreboardLower();
				await sleep(2500);
				h.clock(0);
			} else if (leave === 'a scene swap (a bonus round)') {
				h.clock(1);
				h.sceneWant('snowNight');
				await sleep(2500);
				h.sceneWant('snowDay');
				await sleep(2500);
				h.clock(0);
				gone = F.roam.state === 'none';
			}
			let t = 0;
			for (let i = 0; i < 60 * 30; i++) {
				const ro = F.roam;
				if (ro.state === 'idle' && ro.standing()) break;
				R.update(1000 / 60, 1, 1);
				t += 1000 / 60;
			}
			const ro = h.roam();
			h.clock(1);
			return { gone, back: ro.state === 'idle' && ro.onScreen && ro.visible, ms: Math.round(t), state: ro.state, safetyNet: ro.counts.safetyNet, left: ro.counts.left - left0 };
		}, leave);
		out.comeBack = { ...(out.comeBack ?? {}), [label]: r };
		check(r.back, `${name}: he comes back after ${label}${r.gone ? '' : ' (he was not removed)'}: a reindeer stands on the screen ${r1(r.ms / 1000)} s (board clock) later`, r);
		return r;
	};
	await H(() => window.__reindeer.roamPlace());
	await comeBack('a strike that is not marked the spin\'s last (the safety net)', 'strike, not marked last');
	await comeBack('the LED board rising over him', 'the LED board rises over him');
	await comeBack('a scene swap (a bonus round)', 'a scene swap (a bonus round)');
	// a resize to another shape and back (a rotation on a phone)
	{
		const vp0 = p.viewportSize();
		await p.setViewportSize({ width: Math.round(vp0.height * 1.2), height: Math.round(vp0.width * 0.9) });
		await sleep(900);
		await p.setViewportSize(vp0);
		await sleep(900);
		const r = await H(() => {
			const h = window.__reindeer;
			const R = h.roadBoard();
			h.clock(0);
			let t = 0;
			for (let i = 0; i < 60 * 30; i++) {
				const ro = R.features.roam;
				if (ro.state === 'idle' && ro.standing()) break;
				R.update(1000 / 60, 1, 1);
				t += 1000 / 60;
			}
			const ro = h.roam();
			h.clock(1);
			return { back: ro.state === 'idle' && ro.onScreen && ro.visible, ms: Math.round(t), state: ro.state };
		});
		out.comeBack = { ...(out.comeBack ?? {}), resize: r };
		check(r.back, `${name}: he is on the screen after a resize to another shape and back (${r1(r.ms / 1000)} s of the board clock)`, r);
	}

	// ---- a hidden tab: nothing moves ---------------------------------------------------------------------------------
	const hidden = await H(() => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		const F = R.features;
		h.roamPlace();
		for (let i = 0; i < 30; i++) R.update(1000 / 60, 1, 1);
		const a = [F.roam.x, F.roam.y, F.roam.frame, F.roam.state];
		Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
		for (let i = 0; i < 120; i++) R.update(1000 / 60, 1, 1);
		const b = [F.roam.x, F.roam.y, F.roam.frame, F.roam.state];
		delete document.hidden;
		return { a, b };
	});
	check(JSON.stringify(hidden.a) === JSON.stringify(hidden.b), `${name}: with the tab hidden he does not move (pauses)`, hidden);
	await H(() => window.__reindeer.clock(1));

	// ---- 7, 2, 3, 4 end to end: real spins (the fixture rounds), with him and without -----------------------------------
	const spin = async (book, roamOn) =>
		H(
			async ({ book, roamOn }) => {
				const h = window.__reindeer;
				h.tune.strike.roam = roamOn;
				h.clock(1);
				const F = h.roadBoard().features;
				if (roamOn) h.roamPlace();
				await new Promise((r) => setTimeout(r, 300));
				h.fixtures.next(book);
				const seen = [];
				const t0 = performance.now();
				const c0 = F['clock'];
				h.hud.emit({ type: 'bet' });
				let last = null;
				let idle = false;
				for (let i = 0; i < 2400; i++) {
					await new Promise((r) => requestAnimationFrame(r));
					const r = F.runner;
					if (r && r !== last) {
						last = r;
						const end = r.times[r.times.length - 1];
						seen.push({ roam: r.roam, waitMs: Math.round(r.waitMs * 100) / 100, ownMs: Math.round(end * 100) / 100, todayMs: Math.round(r.todayMs * 100) / 100, at: Math.round(performance.now() - t0) });
					}
					if (i > 30 && h.hud.idle() && h.atRest()) {
						idle = true;
						break;
					}
				}
				const ms = Math.round(performance.now() - t0);
				// (the board clock too: a slow software renderer's frames longer than the ticker's cap run the game slower than
				// real time, so real time alone also measures the renderer)
				const boardMs = Math.round(F['clock'] - c0);
				// a moment more: the walk in begins (never waited on)
				await new Promise((r) => setTimeout(r, 1800));
				const ro = h.roam();
				h.tune.strike.roam = true;
				return { book, roamOn, ms, boardMs, idle, strikes: seen, roam: { state: ro.state, counts: ro.counts } };
			},
			{ book, roamOn },
		);
	const books = S.name === 'desktop' ? ['base_grandma_strike', 'base_two_columns'] : ['base_two_columns'];
	out.spins = [];
	for (const book of books) {
		// (one spin of the book first, not counted: it loads its column pictures, which makes the first spin longer)
		await spin(book, false);
		const on = await spin(book, true);
		const offS = await spin(book, false);
		out.spins.push(on, offS);
		check(on.idle && offS.idle, `${name}: ${book}: the round ends and the game is idle with him (${on.ms} ms) and without (${offS.ms} ms)`, { on, off: offS });
		check(on.strikes.length > 0 && on.strikes[0].roam === true && on.strikes.slice(1).every((q) => q.roam === false), `${name}: ${book}: the first of its ${on.strikes.length} strike(s) is his, the rest from off the screen`, on.strikes);
		// the strike is the only part he changes: its impact lands exactly when the strike from off the screen would (his wait
		// plus his own run equals its time from the set off); the whole spin's length is printed (real time on a software
		// renderer varies by seconds between two plays of the same book)
		check(on.strikes.every((q) => q.waitMs + q.ownMs <= q.todayMs + 0.01), `${name}: ${book}: in the live spin every strike lands no later than the strike from off the screen would (${on.strikes.map((q) => `${q.roam ? 'his' : 'off screen'} ${r1(q.waitMs + q.ownMs)} of ${r1(q.todayMs)} ms`).join(', ')})`, on.strikes);
		console.log(`  INFO ${name}: ${book}: the spin with him ${on.ms} ms (board clock ${on.boardMs}), without ${offS.ms} ms (board clock ${offS.boardMs})`);
		check(['enter', 'idle', 'start', 'walk', 'stop'].includes(on.roam.state), `${name}: ${book}: after the spin a new one walks in (${on.roam.state})`, on.roam);
	}

	// ---- 8: every fixture book, base and bonus: one first and one last strike per spin ---------------------------------
	if (S.name === 'desktop') {
		const order = await H(async () => {
			const { FIXTURE_ROUNDS } = await import('/src/fixtures/fixtureRgs.ts');
			const { strikePlace } = await import('/src/game/strikeOrder.ts');
			const bad = [];
			let spins = 0;
			let bonusSpins = 0;
			for (const r of FIXTURE_ROUNDS) {
				const ev = r.events;
				let seg = [];
				let free = false;
				const flush = () => {
					if (seg.length) {
						spins++;
						if (free) bonusSpins++;
						const places = seg.map((i) => strikePlace(ev, i));
						const firsts = places.filter((x) => x.first).length;
						const lasts = places.filter((x) => x.last).length;
						if (firsts !== 1 || lasts !== 1 || !places[0].first || !places[places.length - 1].last) bad.push(`${r.name}: ${JSON.stringify(places)}`);
					}
					seg = [];
				};
				ev.forEach((e, i) => {
					if (e.type === 'reveal') {
						flush();
						free = e.gameType === 'freegame';
					}
					if (e.type === 'strike') seg.push(i);
				});
				flush();
			}
			return { bad, spins, bonusSpins, books: FIXTURE_ROUNDS.length };
		});
		out.order = order;
		check(order.bad.length === 0 && order.bonusSpins > 0, `every fixture book (${order.books}): each of the ${order.spins} spins with strikes (${order.bonusSpins} of them free spins) has one first strike (his) and one last (the walk in after it)`, order.bad);
	}

	// ---- the editor (staging tune panel) ------------------------------------------------------------------------------
	await ctx.close();
	const ed = await boot(browser, S, '&tune=roam');
	const q = ed.p;
	const E = (fn, arg) => q.evaluate(fn, arg);
	// the panel docks on the side away from his area (it would cover the corners' handles)
	await E(() => {
		const side = window.__reindeer.roam().side;
		document.querySelector(`.ror-tune [aria-label="Dock ${side === 'right' ? 'left' : 'right'}"]`)?.click();
	});
	await sleep(200);
	await E(() => document.querySelector('[aria-label="Show the area over the game"]')?.click());
	await sleep(600);
	const ov = await E(() => ({ handles: [...document.querySelectorAll('[data-roam-wp]')].map((b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }), area: !!document.querySelector('[data-roam-area]'), zones: document.querySelectorAll('[data-roam-overlay] rect.zone').length, json: document.querySelector('[data-roam-json]')?.value ?? '', path: window.__reindeer.roam().corners }));
	check(ov.handles.length === ov.path.length && ov.area && ov.zones >= 4, `${name}: the editor shows the area over the game (${ov.handles.length} corners, the area and ${ov.zones} zones shaded)`, { handles: ov.handles.length, zones: ov.zones });
	let jsonOk = false;
	try {
		jsonOk = JSON.stringify(JSON.parse(ov.json)) === JSON.stringify(await E(() => window.__reindeer.roamAreas()));
	} catch {
		jsonOk = false;
	}
	check(jsonOk, `${name}: the read back is the live paths as JSON`);
	// drag corner 1 by (-24, +6) CSS px: mouse on the desktop, a finger on the phones; the panel hidden (the path stays)
	await E(() => document.querySelector('.ror-tune [aria-label="Collapse"]')?.click());
	await sleep(300);
	const h0 = await E(() => {
		const b = document.querySelector('[data-roam-wp="0"]')?.getBoundingClientRect();
		return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : { x: 0, y: 0 };
	});
	const before = await E(() => JSON.parse(JSON.stringify(window.__reindeer.roam().corners[0])));
	if (S.touch) {
		const cdp = await ed.ctx.newCDPSession(q);
		const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
		await t('touchStart', h0.x, h0.y);
		for (let i = 1; i <= 6; i++) await t('touchMove', h0.x - 4 * i, h0.y + i);
		await t('touchEnd', 0, 0);
	} else {
		await q.mouse.move(h0.x, h0.y);
		await q.mouse.down();
		for (let i = 1; i <= 6; i++) await q.mouse.move(h0.x - 4 * i, h0.y + i);
		await q.mouse.up();
	}
	await sleep(400);
	const moved = await E(() => ({ p: window.__reindeer.roam().corners[0], k: window.__reindeer.roamView().k, areas: window.__reindeer.roamAreas(), kind: window.__reindeer.roamView().kind }));
	// the panel back open: its read back
	await E(() => document.querySelector('.ror-tune [aria-label="Open the tuning panel"]')?.click());
	await sleep(500);
	moved.json = await E(() => document.querySelector('[data-roam-json]')?.value ?? '');
	const dx = (moved.p.x - before.x) * moved.k;
	const dy = (moved.p.y - before.y) * moved.k;
	check(Math.abs(dx + 24) < 3 && Math.abs(dy - 6) < 3, `${name}: corner 1 drags with the ${S.touch ? 'finger' : 'mouse'} (moved ${r1(dx)}, ${r1(dy)} CSS px for -24, 6)`, { dx, dy });
	let readBack = null;
	try {
		readBack = JSON.parse(moved.json);
	} catch {}
	check(!!readBack && JSON.stringify(readBack[moved.kind].corners[0]) === JSON.stringify(moved.areas[moved.kind].corners[0]), `${name}: the read back follows the drag (${JSON.stringify(readBack?.[moved.kind]?.points?.[0])})`);
	const n0 = moved.areas[moved.kind].corners.length;
	await E(() => [...document.querySelectorAll('.roam-ed button')].find((b) => b.textContent.startsWith('Add a corner'))?.click());
	await sleep(300);
	const n1 = await E(() => ({ live: window.__reindeer.roam().corners.length, handles: document.querySelectorAll('[data-roam-wp]').length }));
	await E(() => [...document.querySelectorAll('.roam-ed button')].find((b) => b.textContent.startsWith('Remove corner'))?.click());
	await sleep(300);
	const n2 = await E(() => ({ live: window.__reindeer.roam().corners.length, handles: document.querySelectorAll('[data-roam-wp]').length }));
	check(n1.live === n0 + 1 && n1.handles === n0 + 1 && n2.live === n0 && n2.handles === n0, `${name}: a corner is added (${n0} to ${n1.live}) and removed (back to ${n2.live}); he roams the new area`, { n0, n1, n2 });
	errs.push(...ed.errs);
	await ed.ctx.close();
	check(errs.length === 0, `${name}: no page errors`, errs.slice(0, 5));
}

// ---------------------------------------------------------------- the Super wheel
const WHEEL_SIZES = ['desktop', 'upright'];
const WHEEL_PHASES = ['runin', 'leap', 'drive', 'slow', 'slam', 'land', 'ringIn', 'ring', 'land2', 'leave'];
const SHOTS = process.env.SHOTS || '';

async function wheelSize(browser, S) {
	const name = `${S.name} wheel`;
	const book = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'wheel_probe_books.json'), 'utf8')).books[Number(process.env.WHEEL_BOOK || 0)];
	const { ctx, p, errs } = await boot(browser, S);
	const E = (fn, arg) => p.evaluate(fn, arg);
	const until = async (fn, ms, arg) => {
		const t0 = Date.now();
		while (Date.now() - t0 < ms) {
			const v = await p.evaluate(fn, arg).catch(() => null);
			if (v) return v;
			await sleep(60);
		}
		return null;
	};
	const shot = async (tag) => {
		if (!SHOTS) return;
		await E(() => window.__reindeer.clock(0));
		await sleep(60);
		await p.screenshot({ path: join(SHOTS, `${S.name}_${tag}.png`) });
		await E(() => window.__reindeer.clock(1));
	};
	if (SHOTS) mkdirSync(SHOTS, { recursive: true });
	try {
		await E(() => window.__reindeer.roadSounds(true));
		await E(([ev, pay]) => window.__reindeer.fixtures.queue(ev, pay), [book.events, book.payoutMultiplier / 100]);
		await p.click('.hudp button.spin');
		// to the Super entry card (any other card pressed on the way), then him standing on the screen
		let card = false;
		for (let t0 = Date.now(); Date.now() - t0 < 120000 && !card; ) {
			const st = await E(() => ({ ph: window.__reindeer.wheel().phase, card: !!document.querySelector('button.catch:not([data-wheel-gate])'), super: /super/i.test(document.querySelector('button.catch:not([data-wheel-gate])')?.closest('[class]')?.textContent ?? '') }));
			if (st.ph) break;
			if (st.card) card = true;
			else await sleep(150);
		}
		check(card, `${name}: the Super entry card is up`);
		let stand = await until(() => ['idle'].includes(window.__reindeer.roam().state) && window.__reindeer.roam().visible, 1500);
		if (!stand) {
			await E(() => window.__reindeer.roamWalkIn(0));
			stand = await until(() => window.__reindeer.roam().state === 'idle' && window.__reindeer.roam().visible, 30000);
		}
		check(!!stand, `${name}: he stands on the screen while the entry card waits`);
		// every animation frame from the press: the wheel's phase and him
		await E(() => {
			window.__rw = [];
			const tick = () => {
				const r = window.__reindeer.roam();
				const w = window.__reindeer.wheel();
				window.__rw.push({ t: performance.now(), ph: w.phase, played: w.played, st: r.state, vis: r.visible, held: r.held, x: r.x, y: r.y, drawn: r.drawn, walkIns: r.counts.walkIns, exits: r.counts.exits, exit: r.exit, fs: window.__reindeer.freeSpinNow() });
				if (window.__rwOn) requestAnimationFrame(tick);
			};
			window.__rwOn = true;
			requestAnimationFrame(tick);
		});
		const before = await E(() => window.__reindeer.roam().counts);
		// (a real press: the upright phone's card takes the pointer, not a scripted click)
		await p.locator('button.catch:not([data-wheel-gate])').first().click({ force: true, timeout: 5000 }).catch(() => E(() => document.querySelector('button.catch:not([data-wheel-gate])')?.click()));
		// (the entry on the LED board takes two presses when the first lands its scene before the press line, and a press in
		// the card's first 450 ms is not taken: so pressed again, as a player would, until the wheel comes out; 2026-11-19, he
		// now stands sooner on an upright phone (the skip button's keep-out is gone while it is down), so the first press
		// came inside the card's arming)
		for (let i = 0; i < 4 && !(await until(() => window.__reindeer.wheel().phase !== null, 2500)); i++) {
			const r = await E(() => document.querySelector('button.catch:not([data-wheel-gate])')?.getBoundingClientRect()?.toJSON() ?? null);
			if (r) await (S.touch ? p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2) : p.mouse.click(r.x + r.width / 2, r.y + r.height / 2));
		}
		if (SHOTS) {
			for (const [i, ms] of [0, 120, 300, 450, 600, 800, 1100].entries()) {
				await until((at) => window.__rw.length && window.__rw.find((f) => f.ph === 'emerge') && performance.now() - window.__rw.find((f) => f.ph === 'emerge').t >= at, 8000, ms);
				await shot(`01_emerge_${String(i).padStart(2, '0')}_${ms}ms`);
			}
		}
		const rested = await until(() => window.__reindeer.wheel().phase === 'rest', 60000);
		check(!!rested, `${name}: the wheel comes to rest`);
		await sleep(400);
		await shot('02_rest');
		await p.click('.hudp button.spin').catch(() => {});
		await until(() => window.__reindeer.wheel().phase === 'drive', 20000);
		await shot('03_drive');
		await until(() => window.__reindeer.wheel().phase === 'ring', 60000);
		await shot('04_ring');
		await until(() => window.__reindeer.wheel().phase === 'leave', 60000);
		await shot('05_leave');
		const gone = await until(() => window.__reindeer.wheel().phase === null && window.__reindeer.wheel().played >= 1, 60000);
		check(!!gone, `${name}: the wheel plays out and leaves`);
		await sleep(250);
		await shot('06_column');
		const landed = await until(() => window.__reindeer.roadSounds().some((e) => e.what === 'openingLanded'), 30000);
		await shot('07_column_stands');
		const back = await until(() => window.__reindeer.roam().state !== 'none' && window.__reindeer.roam().visible, 20000);
		await sleep(500);
		await shot('08_walks_back');
		await until(() => window.__reindeer.freeSpinNow() >= 1, 20000);
		await sleep(700);
		await shot('09_first_free_spin');
		await sleep(600);
		const out = await E(() => {
			window.__rwOn = false;
			return { log: window.__rw, sounds: window.__reindeer.roadSounds().filter((e) => e.what === 'openingLanded' || e.what === 'wheel').map((e) => ({ t: e.t, clock: e.clock, what: e.what, detail: e.detail })), vw: innerWidth, after: window.__reindeer.roam() };
		});
		const L = out.log;
		const iEm = L.findIndex((f) => f.ph === 'emerge');
		const iRun = L.findIndex((f) => f.ph === 'runin');
		const landT = out.sounds.find((e) => e.what === 'openingLanded')?.t ?? Infinity;
		check(iEm >= 0 && iRun > iEm, `${name}: the frames hold the emergence and the run in`, { iEm, iRun, n: L.length });
		check(L.slice(iEm).every((f) => f.held || f.t > landT), `${name}: from the emergence on he is kept away (held) until the opening column stands`);
		// his run off: every frame drawn, the last one partly past the screen's edge
		const ran = L.slice(iEm).filter((f) => f.st === 'exit');
		const lastDrawn = [...L.slice(iEm, iRun < 0 ? undefined : iRun)].reverse().find((f) => f.vis);
		const ex = out.after.exit;
		const edgeOut = lastDrawn?.drawn ? lastDrawn.drawn.sprite[0] < 0 || lastDrawn.drawn.sprite[2] > out.vw : false;
		check(ran.length > 0 && !!ex && ex.doneAt !== null, `${name}: standing when the wheel came out, he runs off`, { ran: ran.length, ex });
		check(edgeOut, `${name}: his last drawn frame is partly past the screen's edge (he ran off, no pop)`, lastDrawn);
		const doneIdx = L.findIndex((f, i) => i > iEm && f.st === 'none' && L[i - 1].st === 'exit');
		const runinT = iRun >= 0 ? L[iRun].t : Infinity;
		// (on the board's clock: the stills hold it, the page's time runs on)
		const clockOf = (ph) => out.sounds.find((e) => e.what === 'wheel' && e.detail === ph)?.clock ?? null;
		const emC = clockOf('emerge');
		const runC = clockOf('runin');
		const goneMs = ex && ex.doneAt !== null && emC !== null ? Math.round(ex.doneAt - emC) : null;
		const runinMs = runC !== null && emC !== null ? Math.round(runC - emC) : null;
		check(doneIdx > 0 && L[doneIdx].t <= runinT && goneMs !== null && runinMs !== null && goneMs <= runinMs && goneMs <= 1250, `${name}: gone before the wheel's reindeer runs in (${goneMs} board ms after the emergence; the run in at ${runinMs}; the shortest emergence 1250)`, { goneMs, runinMs });
		const away = L.slice(doneIdx > 0 ? doneIdx : iEm).filter((f) => f.t < landT);
		const seen = away.filter((f) => f.vis);
		check(away.length > 0 && seen.length === 0, `${name}: not drawn on any frame from his run's end through the wheel and the column's growing (${away.length} frames)`, seen.slice(0, 3));
		for (const ph of WHEEL_PHASES) {
			const fr = L.filter((f) => f.ph === ph);
			if (ph === 'slam' && !fr.length) continue;
			check(fr.length > 0 && fr.every((f) => !f.vis && f.st === 'none'), `${name}: not on the screen in the wheel's ${ph} (${fr.length} frames)`, fr.find((f) => f.vis));
		}
		const firstBack = L.find((f) => f.t > landT && f.vis);
		check(!!landed && !!back && !!firstBack && firstBack.st === 'enter' && out.after.counts.walkIns > before.walkIns, `${name}: back after the column stands, by a walk in (${firstBack ? Math.round(firstBack.t - landT) : '?'} ms after it)`, { landed: !!landed, back, firstBack });
		const fd = firstBack?.drawn?.sprite;
		check(!!fd && (fd[2] <= 1 || fd[0] >= out.vw - 1 || fd[0] < 0 || fd[2] > out.vw), `${name}: his walk in starts past the screen's edge`, fd);
		console.log(`  WHEEL EXIT ${S.name}: side ${ex?.side === -1 ? 'left' : 'right'} (nearest ${ex?.nearest === -1 ? 'left' : 'right'}, driver's side ${ex?.preferred ? 'taken' : 'not needed or too far'}), from x ${r1(ex?.fromX)} to ${r1(ex?.toX)}, planned ${ex?.ms} ms, gone ${goneMs} board ms after the emergence, run in at ${runinMs}; worst at this screen ${ex?.worstMs} ms; ${ex?.run ? 'the side run' : 'a walk'}`);
		report.sizes[name] = { exit: ex, goneMs, runinMs, backMs: firstBack ? Math.round(firstBack.t - landT) : null };
	} catch (e) {
		check(false, `${name}: ran without throwing`, String(e));
	}
	check(errs.length === 0, `${name}: no page errors`, errs.slice(0, 5));
	await ctx.close();
}

/** the widest screen: stood in the middle, sent off as the wheel would; gone within the shortest emergence */
async function wheelWide(browser) {
	const S = { name: 'wide', vp: { width: 2560, height: 1080 }, dpr: 1, q: '', touch: false };
	const name = 'wheel 2560x1080';
	const { ctx, p, errs } = await boot(browser, S);
	try {
		const st = await p.evaluate(() => window.__reindeer.roam());
		check(!!st.visible || st.state !== 'none', `${name}: he is on the screen`);
		await p.evaluate(() => window.__reindeer.roamAway(-1));
		const done = await (async () => {
			for (let i = 0; i < 100; i++) {
				const r = await p.evaluate(() => window.__reindeer.roam());
				if (r.exit && r.exit.doneAt !== null) return r;
				await sleep(100);
			}
			return null;
		})();
		const ex = done?.exit;
		check(!!ex && ex.worstMs <= 1250 && ex.doneAt - ex.startedAt <= ex.ms + 120, `${name}: off the screen in ${ex ? Math.round(ex.doneAt - ex.startedAt) : '?'} board ms (planned ${ex?.ms}); from the middle of the widest screen ${ex?.worstMs} ms, within the shortest emergence (1250)`, ex);
		await sleep(ROAM_BACK_WAIT);
		const held = await p.evaluate(() => window.__reindeer.roam());
		check(held.held && held.state === 'none' && !held.visible, `${name}: away, he stays away (no walk in, no safety net) after ${ROAM_BACK_WAIT} ms`, { st: held.state, held: held.held });
		await p.evaluate(() => window.__reindeer.roamBack(0));
		let back = null;
		for (let i = 0; i < 60 && !back; i++) {
			back = await p.evaluate(() => (window.__reindeer.roam().visible ? window.__reindeer.roam() : null));
			if (!back) await sleep(150);
		}
		check(!!back && back.state === 'enter', `${name}: back, he walks in`, back?.state);
		console.log(`  WHEEL EXIT wide: side ${ex?.side === -1 ? 'left' : 'right'}, screen ${ex?.screen?.map(r1).join(' to ')} road px, planned ${ex?.ms} ms, worst ${ex?.worstMs} ms`);
		report.sizes[name] = { exit: ex };
	} catch (e) {
		check(false, `${name}: ran without throwing`, String(e));
	}
	check(errs.length === 0, `${name}: no page errors`, errs.slice(0, 5));
	await ctx.close();
}
// ---- THE CHARGE WIND-UP (2026-11-20, Corey's "Slow Drag 1" and "B Snort at lock"; game/road/chargeWindup.ts, constants
// ROAM.charge, REINDEER_SOUND.snort.lockPeakMs; the rig's R3_GAME_SPEC.md section 9). `ONLY=charge` (or charge:desktop,
// charge:upright). Each case is a posed board (crosshairStrike poseOnly) and his strike from a seeded spot, stepped one
// frame at a time; each is run with the wind-up ON and OFF (ROAM.charge.on) and the two are compared frame for frame.
// Checks: nothing of the strike moves (the crosshair's legs, the lock, his set off, the impact frame, and every frame of the
// runner: phase, view, stride, feet); the clip starts on the strike's first frame and shows the frame its plan (worked
// out again here from the crosshair's legs, the spec's rule) has due on every frame until the set off, none at or after
// it; the hit (frame 9) lands on the chosen hop's frame (within one frame) or at 266.7 ms in the fallback, and always
// before the set off, never later than ROAM.charge.hitMarginMs (60) before it (2026-11-21, Corey's option (b): a stand
// without that room has the hit moved earlier to it, off the hop, or at the strike's start for a stand of 60 or less;
// a stand with the room keeps the hit where it was; tools/charge_hit_check.mjs sweeps it in node); the slow drag at Regular and Turbo 1, the head down only at Turbo 2 and in a slam stop's hurry
// running at the start (a hurry from the middle of it, a turbo change, change nothing); the snort starts on the first
// frame within 140 real ms of the lock (the strike's first frame for one target), once, never with charge off, and since
// 2026-11-21 on a strike from off the screen too (no wind-up, no effect sprite there: by design); THE SPINS (CHARGE_SPINS):
// several strikes in one spin stepped through, the second and later ones from off the screen right after an impact, one
// set with every lock at its strike's own instant (one target), at every turbo level, a turbo change and a slam stop's
// hurry mid spin: every strike has exactly one lockSnort, on the frame its rule has due (game/road/lockSnort.ts), the
// puff on his own strike's lock only; the breath puff only on the lock's frame, from the frame shown then (standing or running);
// the kicked snow only on drag frames 10 to 15 and the kick (17) that start before the set off; nothing of the clip or
// the effects is left when they are done or after the board is put up as it is (SKIP TO RESULT's and a resume's cut,
// clearAll); his drawn picture on every wind-up frame lies inside the reach his keep-outs are tested with, and 300 seeded
// spots with that reach meet no keep-out (the probe's own inside test). TIMING=<file> (with ONLY=timing) writes the
// strike timing rows only (any build: the before and after proof), SPOTS=<file> reads that file's spots.
const CHARGE_SIZES = ['desktop', 'upright'];
const FRC = 1000 / 30;
const THC = 8 * FRC;
/** ROAM.charge.hitMarginMs (constants.ts): the hit at least this long before his set off */
const HIT_MARGIN = 60;
const CHARGE_CASES = [
	{ id: 'regular', turbo: 0, cells: [1, 6, 11, 17], target: 11 },
	{ id: 'regular5', turbo: 0, cells: [2, 5, 8, 13, 19], target: 8 },
	{ id: 'regular30hz', turbo: 0, cells: [1, 6, 11, 17], target: 6, hz: 30 },
	{ id: 'turbo1', turbo: 1, cells: [1, 6, 11, 17], target: 11 },
	{ id: 'turbo2', turbo: 2, cells: [1, 6, 11, 17], target: 11, quick: true },
	{ id: 'single', turbo: 0, cells: [9], target: 9 },
	{ id: 'slam', turbo: 0, cells: [1, 6, 11, 17], target: 11, hurry: true, quick: true },
	{ id: 'slamMid', turbo: 0, cells: [1, 6, 11, 17], target: 17, hurryAt: 8 },
	{ id: 'turboMid', turbo: 0, cells: [1, 6, 11, 17], target: 1, turboAt: { i: 6, level: 2 } },
	{ id: 'skip', turbo: 0, cells: [2, 5, 8, 13, 19], target: 13, hurryAt: 10, clearAfterImpact: true },
	{ id: 'clearMid', turbo: 0, cells: [1, 6, 11, 17], target: 11, clearOnSnow: true },
	{ id: 'offscreen', turbo: 0, cells: [1, 6, 11, 17], target: 11, offscreen: true },
];

const CHARGE_STRIKE = async (p, o) =>
	p.evaluate(async (o) => {
		const h = window.__reindeer;
		const R = h.roadBoard();
		const F = R.features;
		const setHurry = async (lv) => {
			if (h.hurry) h.hurry(lv);
			else (await import('/src/game/stateGame.svelte.ts')).stateGame.hurryLevel = lv;
		};
		h.clock(0);
		h.turbo(o.turbo);
		await setHurry(0);
		const tune = h.tune.roam && h.tune.roam.charge;
		if (tune && o.on !== null) tune.on = o.on;
		await h.crosshairStrike({ cells: o.cells, target: o.target, poseOnly: true });
		if (o.offscreen) F.roam.leave();
		else h.roamStandAt(o.spot.x, o.spot.y);
		h.step(0.001, 1);
		if (o.hurry) await setHurry(1);
		// (a snort 1 s ago: the lock's snort is exempt from minGapMs and must still sound; the idle snort's gap then counts
		// from the lock's)
		const realStart = performance.now();
		F.sounds['snortAt'] = realStart - 1000;
		h.roadSounds(true);
		const step = 1000 / (o.hz || 60);
		let done = false;
		const pr = h.roamStrike(o.target, { first: true, last: false }).then(() => (done = true));
		for (let i = 0; i < 100 && !F['runner']; i++) await new Promise((r) => setTimeout(r, 10));
		const r0 = F['runner'];
		const tS = F['clock'];
		const xh = F['xh'];
		const plan = xh ? { lockAt: xh.plan.lockAt - tS, turnAt: xh.plan.turnAt - tS, legs: xh.plan.legs.map((l) => ({ kind: l.kind, t0: l.t0 - tS, t1: Number.isFinite(l.t1) ? l.t1 - tS : null, cell: l.kind === 'dwell' ? l.cell : l.to })) } : null;
		const s0 = F.snapshot();
		const at0 = { state: s0.roam.state, clip: s0.roam.clip, frame: s0.roam.frame, visible: s0.roam.visible, windup: s0.roam.windup ? { ...s0.roam.windup, at: s0.roam.windup.at.map((t) => t - tS), hop: s0.roam.windup.hop === null ? null : s0.roam.windup.hop - tS, hitAt: s0.roam.windup.hitAt === null ? null : s0.roam.windup.hitAt - tS, setOff: s0.roam.windup.setOff - tS } : null, x: s0.roam.x, y: s0.roam.y, facing: s0.roam.facing, scale: s0.roam.scale };
		const rows = [];
		let impactAt = null;
		let after = 0;
		let cleared = null;
		for (let i = 0; i < 3000; i++) {
			if (o.hurryAt === i) await setHurry(1);
			if (o.turboAt && o.turboAt.i === i) h.turbo(o.turboAt.level);
			if (o.clearOnSnow && cleared === null && rows.length && rows[rows.length - 1].fx && rows[rows.length - 1].fx.snow > 0) {
				F.clearAll();
				cleared = i;
			}
			if (o.clearAfterImpact && cleared === null && impactAt !== null) {
				F.clearAll();
				cleared = i;
			}
			h.step(step, 1);
			await Promise.resolve();
			const s = F.snapshot();
			const r = s.runner;
			const ro = s.roam;
			const rr = F['runner'];
			// his INK as drawn, road px: the sprite's trimmed picture (getBounds gives the clip's whole box)
			const sp = F.roam.sprite;
			const tx = sp.texture;
			const ink = sp.visible && tx.trim ? (() => {
				const ax = sp.anchor.x * tx.orig.width;
				const ay = sp.anchor.y * tx.orig.height;
				const xa = sp.x + (tx.trim.x - ax) * sp.scale.x;
				const xb = sp.x + (tx.trim.x + tx.trim.width - ax) * sp.scale.x;
				return [Math.min(xa, xb), sp.y + (tx.trim.y - ay) * sp.scale.y, Math.max(xa, xb), sp.y + (tx.trim.y + tx.trim.height - ay) * sp.scale.y];
			})() : null;
			// (`pre`: this frame is before his set off, by the game's own test, the board clock against the runner's t0 unrounded
			// (roam.ts alert: clock >= alertUntil, roadFeatures updateRunner: clock < t0). `c` is rounded to a thousandth of a
			// ms: a frame that lands on the set off itself (within 0.0005 ms) read as before it by `c`, and showed him gone)
			rows.push({ i, c: Math.round((F['clock'] - tS) * 1000) / 1000, pre: r0 ? F['clock'] < r0.t0 : null, rate: F.rate, roam: { state: ro.state, clip: ro.clip, frame: ro.frame, visible: ro.visible, x: ro.x, y: ro.y, drawn: ro.drawn ? ro.drawn.sprite : null, ink, windup: !!ro.windup }, run: r ? { phase: r.phase, view: r.view, stride: r.stride, x: r.x, y: r.y, vis: !!(rr && rr.sprite.visible), alpha: r.alpha, scale: r.scale, mirrored: r.mirrored } : null, fx: s.charge ? s.charge.up : null, xh: F['xh'] ? F['xh'].state : null });
			if (r && r.phase === 'impact' && impactAt === null) impactAt = Math.round((F['clock'] - tS) * 1000) / 1000;
			if (impactAt !== null && (after += step * F.rate) > (o.afterMs ?? 760)) break;
		}
		for (let i = 0; i < 40 && !done; i++) {
			h.step(50, 1);
			await new Promise((r) => setTimeout(r, 5));
		}
		const sounds = h.roadSounds().map((e) => ({ what: e.what, kind: e.kind, detail: e.detail, frame: e.frame, clock: Math.round((e.clock - tS) * 10) / 10 }));
		const end = F.snapshot();
		await setHurry(0);
		h.turbo(0);
		if (tune) tune.on = true;
		const ch = end.charge ? { snow: end.charge.snow.map((q) => ({ ...q, t: Math.round((q.t - tS) * 1000) / 1000 })), puff: end.charge.puff ? { ...end.charge.puff, t: Math.round((end.charge.puff.t - tS) * 1000) / 1000 } : null, up: end.charge.up } : null;
		return { snortAtMoved: F.sounds['snortAt'] > realStart, tS, t0: r0 ? r0.t0 - tS : null, roamStrike: r0 ? r0.roam : null, plan, impactAt, rows, at0, sounds, cleared, endWindup: end.roam.windup, ch, step, view: h.roamView(), reach: end.roam.reach, box: end.roam.box };
	}, o);

// THE SPINS (2026-11-21; game/road/lockSnort.ts, REINDEER_SOUND.snort.lockEveryStrike): one spin's strikes stepped one
// frame at a time on a posed board, his first (from the seeded spot), the next ones from off the screen gapMs board ms
// after the impact before (the probe host's 267), as a book's spin runs them. `single`: one target posed, so every lock is
// at its strike's own instant (the probe host's round B, target 5 twice). Every strike: exactly one lockSnort.
const CHARGE_SPINS = [
	{ id: 'spin3', turbo: 0, cells: [1, 6, 11, 17], targets: [11, 17, 6], gapMs: 267 },
	{ id: 'spin3single', turbo: 0, cells: [9], targets: [9, 9, 9], gapMs: 267 },
	{ id: 'spin3turbo1', turbo: 1, cells: [2, 5, 8, 13, 19], targets: [8, 19, 5], gapMs: 267 },
	{ id: 'spin3turbo2', turbo: 2, cells: [1, 6, 11, 17], targets: [1, 17, 11], gapMs: 267 },
	{ id: 'spin3turboMid', turbo: 0, cells: [1, 6, 11, 17], targets: [11, 1, 17], gapMs: 267, turboAt: { i: 40, level: 2 } },
	{ id: 'spin3slamMid', turbo: 0, cells: [2, 5, 8, 13, 19], targets: [13, 2, 19], gapMs: 267, hurryAt: 30 },
	{ id: 'spin2single30hz', turbo: 0, cells: [9], targets: [9, 9], gapMs: 267, hz: 30 },
];

const CHARGE_SPIN = async (p, o) =>
	p.evaluate(async (o) => {
		const h = window.__reindeer;
		const F = h.roadBoard().features;
		const setHurry = async (lv) => {
			if (h.hurry) h.hurry(lv);
			else (await import('/src/game/stateGame.svelte.ts')).stateGame.hurryLevel = lv;
		};
		h.clock(0);
		h.turbo(o.turbo);
		await setHurry(0);
		await h.crosshairStrike({ cells: o.cells, target: o.targets[0], poseOnly: true });
		h.roamStandAt(o.spot.x, o.spot.y);
		h.step(0.001, 1);
		const tS = F['clock'];
		h.roadSounds(true);
		const step = 1000 / (o.hz || 60);
		const strikes = [];
		const rows = [];
		let i = 0;
		const frame = async () => {
			if (o.hurryAt === i) await setHurry(1);
			if (o.turboAt && o.turboAt.i === i) h.turbo(o.turboAt.level);
			h.step(step, 1);
			await Promise.resolve();
			i++;
			const r = F['runner'];
			const fx = F.charge.state(F['clock']);
			rows.push({ i, c: Math.round((F['clock'] - tS) * 1000) / 1000, rate: F.rate, puff: fx.puff, shown: fx.shown, roamWindup: !!F.roam.windup, log: !!F.charge.log.puff });
			return r;
		};
		for (const [k, target] of o.targets.entries()) {
			const before = F['runner'];
			h.roamStrike(target, { first: k === 0, last: k === o.targets.length - 1 });
			for (let w = 0; w < 100 && F['runner'] === before; w++) await new Promise((r) => setTimeout(r, 10));
			const r = F['runner'];
			const xh = F['xh'];
			const s = { k, target, his: r ? r.roam : null, start: Math.round((F['clock'] - tS) * 1000) / 1000, lockAt: xh ? Math.round((xh.plan.lockAt - tS) * 1000) / 1000 : null, t0: r ? r.t0 - tS : null, impactAt: null, fromRow: rows.length, windup: !!F.roam.windup };
			strikes.push(s);
			for (let g = 0; g < 3000 && r && r.impactAt === null; g++) await frame();
			s.impactAt = r && r.impactAt !== null ? Math.round((r.impactAt - tS) * 1000) / 1000 : null;
			s.toRow = rows.length;
			// the next strike gapMs board ms after this one's impact (the book's next event)
			const until = (r?.impactAt ?? F['clock']) + o.gapMs;
			for (let g = 0; g < 600 && F['clock'] < until; g++) await frame();
		}
		for (let g = 0; g < 60; g++) await frame();
		const sounds = h.roadSounds().map((e) => ({ what: e.what, kind: e.kind, detail: e.detail, frame: e.frame, clock: Math.round((e.clock - tS) * 1000) / 1000 }));
		await setHurry(0);
		h.turbo(0);
		return { strikes, rows, sounds, step };
	}, o);

/** THE SPINS' checks: every strike exactly one lockSnort, on its due frame; the puff only on his own strike's lock */
function judgeSpin(tag, A) {
	const strikeMarks = A.sounds.filter((e) => e.kind === 'moment' && e.what === 'strike');
	const lockSnorts = A.sounds.filter((e) => e.kind === 'moment' && e.what === 'lockSnort');
	const plays = A.sounds.filter(snortPlay);
	check(strikeMarks.length === A.strikes.length && A.strikes.every((s) => s.impactAt !== null), `${tag}: ${A.strikes.length} strikes run to their impacts (${A.strikes.map((s) => `${s.target}${s.his ? ' his' : ' off screen'}`).join(', ')})`, { strikes: A.strikes.map(({ fromRow, toRow, ...s }) => s), marks: strikeMarks.length });
	check(A.strikes[0]?.his === true && A.strikes.slice(1).every((s) => s.his === false && !s.windup), `${tag}: the first is his (wind-up), the others from off the screen (no wind-up)`);
	let ok = 0;
	for (const [k, s] of A.strikes.entries()) {
		const from = strikeMarks[k];
		const next = strikeMarks[k + 1];
		if (!from) continue;
		const mine = lockSnorts.filter((e) => e.frame >= from.frame && (!next || e.frame < next.frame));
		const played = plays.filter((e) => mine.some((m) => m.frame === e.frame) && /^lock:/.test(e.detail || ''));
		const rows = A.rows.slice(s.fromRow, s.toRow);
		const due = s.lockAt === null ? null : rows.find((r) => (s.lockAt - r.c) / r.rate <= 140 + 1e-3);
		const atStart = s.lockAt !== null && s.lockAt - s.start <= 1e-6;
		const snort = mine[0];
		const onDue = !!snort && ((!!due && Math.abs(snort.clock - due.c) < 0.2) || (atStart && Math.abs(snort.clock - s.start) < 0.2));
		const prevImpact = k > 0 ? A.strikes[k - 1].impactAt : null;
		const shape = `${s.his ? 'his' : 'from off the screen'}${atStart ? ', the lock at its instant' : `, lock ${r1(s.lockAt - s.start)} ms in`}${prevImpact !== null ? `, ${r1(s.start - prevImpact)} ms after an impact` : ''}`;
		const good = mine.length === 1 && played.length === 1 && onDue;
		if (good) ok++;
		check(good, `${tag}: strike ${k + 1} (target ${s.target}; ${shape}): exactly one lock snort, on its due frame (${snort ? `${r1((s.lockAt - snort.clock) / (rows.find((r) => Math.abs(r.c - snort.clock) < 0.2)?.rate ?? 1))} real ms before the lock` : 'none'})`, { mine, played: played.length, due, lockAt: s.lockAt, start: s.start });
		// the puff: his strike's lock only (the wind-up's effect); none on a strike from off the screen
		const puffRows = rows.filter((r) => r.puff > 0);
		if (s.his) check(puffRows.length > 0 && puffRows[0].c >= (s.lockAt ?? 0) - 0.2, `${tag}: strike ${k + 1}: his breath puff shows from his lock (${puffRows.length ? r1(puffRows[0].c) : '-'} ms; lock ${r1(s.lockAt)})`);
		else check(rows.length > 0 && rows.every((r) => !r.log), `${tag}: strike ${k + 1}: no puff of its own (no wind-up from off the screen; his last puffs may still fade out)`);
	}
	check(ok === A.strikes.length, `${tag}: ${ok} of ${A.strikes.length} strikes with exactly one lockSnort at its lock`);
}

/** the spec's plan, worked out here from the crosshair's legs (R3_GAME_SPEC.md 3 and 4): frame i's start, ms from the strike's start */
/** the spec's plan from the strike's start (0): `setOff` his set off from it (THE ROOM, 2026-11-21: the hit no later
 *  than HIT_MARGIN before it; a hit without that room moved there, off the hop: `early` the ms it moved, 0 with room) */
const specPlan = (legs, quick, setOff = Infinity) => {
	if (quick) return { clip: 'chargeDown', k: 1, hop: null, early: 0, at: [0, 1, 2, 3].map((i) => i * FRC) };
	const hops = (legs || []).filter((l) => l.kind === 'glide').map((l) => l.t1).sort((a, b) => a - b);
	let h = hops.find((d) => d >= 0.85 * THC - 1e-6 && d <= 1.45 * THC + 1e-6) ?? null;
	let k = h === null ? 1 : h / THC;
	const latest = Math.max(0, setOff - HIT_MARGIN);
	let early = 0;
	if (THC * k > latest + 1e-6) {
		early = THC * k - latest;
		k = latest / THC;
		h = null;
	}
	const at = Array.from({ length: 21 }, (_, j) => (j + 1 <= 9 ? j * FRC * k : THC * k + (j + 1 - 9) * FRC));
	return { clip: 'charge', k, hop: h, early, at };
};
const frameDue = (at, c) => {
	let f = 1;
	for (let i = 1; i < at.length; i++) if (c >= at[i] - 1e-3) f = i + 1;
	return f;
};
/** the frames due on each row, the hit (frame 9 of the slow drag) never skipped: drawn on the first frame its time has
 *  come (a slam stop's hurry steps the board clock 50 ms a frame) */
const framesDue = (rows, want) => {
	let hit = false;
	return rows.map((r) => {
		let f = frameDue(want.at, r.c);
		if (want.clip === 'charge' && !hit && f >= 9) {
			f = 9;
			hit = true;
		}
		return f;
	});
};
/** a snort asked (not the fade of one still sounding, which a strike's alert does) */
const snortPlay = (e) => e.kind === 'sound' && e.what === 'sfx_reindeer_idle_snort' && !/^stop/.test(e.detail || '');
/** (rounded to a millionth of a ms: the times are read relative to the strike's start, and the board clock's size at the
 *  start leaves differences of 1e-12 ms in the subtraction) */
const r6 = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v);
const timingOf = (x) => JSON.parse(JSON.stringify(timingRaw(x), (k, v) => r6(v)));
const timingRaw = (x) => ({ lockAt: x.plan?.lockAt ?? null, turnAt: x.plan?.turnAt ?? null, legs: x.plan?.legs ?? null, t0: x.t0, impactAt: x.impactAt, runner: x.rows.map((r) => (r.run ? `${r.run.phase}|${r.run.view}|${r.run.stride}|${r.run.x}|${r.run.y}|${r.run.vis ? 1 : 0}|${r.run.mirrored ? 1 : 0}` : '-')) });

async function chargeSize(browser, S, spotsFrom) {
	const name = `charge ${S.name} ${S.vp.width}x${S.vp.height}`;
	const out = { name, cases: {} };
	(report.charge ??= {})[S.name] = out;
	const { ctx, p, errs, ready } = await boot(browser, S);
	check(ready, `${name}: the game and the roaming reindeer's frames are ready`);
	if (!ready) return void (await ctx.close());
	const H = (fn, arg) => p.evaluate(fn, arg);
	try {
		// the charge sheets come after the roam's: wait for them (the TIMING mode runs on any build)
		const timing = ONLY.includes('timing');
		if (!timing) {
			let mem = null;
			for (let i = 0; i < 60; i++) {
				mem = await H(() => window.__reindeer.roamMemory());
				if (mem.charge?.loaded) break;
				await sleep(250);
			}
			out.memory = mem;
			check(!!mem?.charge?.loaded, `${name}: the charge sheets are in after the roam's (${mem?.charge?.sheets?.join(', ')} = ${mem?.charge?.mb} MB${mem?.charge?.mipmapped ? `, ${mem.charge.mbWithMips} MB with mips` : ''})`, mem);
		}
		// (he walks in first: the picks start from where he is)
		for (let i = 0; i < 60; i++) {
			const st = await H(() => window.__reindeer.roam().state);
			if (st !== 'enter' && st !== 'none') break;
			await sleep(500);
		}
		const zones = await H(() => window.__reindeer.roamZones());
		const geo = await H(() => ({ view: window.__reindeer.roamView(), roam: window.__reindeer.roam(), vp: { width: innerWidth, height: innerHeight } }));
		const picks = await H(() => window.__reindeer.roamPicks(300, 0, 7171));
		let spots = picks.filter((q) => q.pass >= 0);
		if (spotsFrom && spotsFrom[S.name]) spots = spotsFrom[S.name];
		out.spots = spots.slice(0, CHARGE_CASES.length).map((q) => ({ x: q.x, y: q.y }));
		if (!timing) {
			// his reach: the four roam clips by their boxes (the rig's manifests), the two charge clips by their solid ink
			// (read from the art by tools/build_roam.py ink_reach: 1076 frame px up, the bulbs' glow to 1148)
			const K = 0.18465;
			const B = geo.roam.box;
			const old = ['walk', 'start', 'stop', 'sniff'].map((c) => B[c]);
			const up = Math.max(...old.map((b) => b.anchorY * b.height), 1076 * K);
			check(!!B.charge && !!B.chargeDown && Math.abs(geo.roam.reach.up - up) < 1e-6 && Math.abs(geo.roam.reach.glowUp - (1148 * K - up)) < 1e-6, `${name}: his reach counts the charge clips' solid ink (up ${r1(geo.roam.reach.up)} road px = ${r1(geo.roam.reach.up / K)} frame px; their bulbs' glow up to ${r1(geo.roam.reach.glowUp)} road px past it; side ${r1(geo.roam.reach.side)})`, { reach: geo.roam.reach, box: B });
			const bad = [];
			for (const q of picks) if (q.pass >= 0) {
				const hz = hitsAt(geo, zones, q.x, q.y);
				if (hz.length) bad.push(`(${r1(q.x)}, ${r1(q.y)}) covers ${hz.join(', ')}`);
			}
			check(bad.length === 0 && spots.length >= 100, `${name}: ${picks.filter((q) => q.pass >= 0).length} seeded spots with that reach: his body and shadow meet no keep-out zone, tunnel mouth (polygon inside test) or the screen's edge`, bad.slice(0, 6));
		}
		const timingRows = {};
		let si = 0;
		for (const C of CHARGE_CASES) {
			const spot = spots[si++ % spots.length];
			const base = { ...C, spot, hz: C.hz || 60 };
			if (timing) {
				const T = await CHARGE_STRIKE(p, { ...base, on: null });
				timingRows[C.id] = timingOf(T);
				continue;
			}
			const A = await CHARGE_STRIKE(p, { ...base, on: true });
			const B = await CHARGE_STRIKE(p, { ...base, on: false });
			const tag = `${name} ${C.id}`;
			const ta = timingOf(A);
			const tb = timingOf(B);
			timingRows[C.id] = ta;
			const sameRun = ta.runner.length === tb.runner.length && ta.runner.every((v, i) => v === tb.runner[i]);
			check(JSON.stringify(ta.legs) === JSON.stringify(tb.legs) && ta.lockAt === tb.lockAt && ta.turnAt === tb.turnAt && ta.t0 === tb.t0 && ta.impactAt === tb.impactAt && sameRun, `${tag}: nothing of the strike moves with the wind-up (hops ${(ta.legs || []).filter((l) => l.kind === 'glide').length}, lock ${r1(ta.lockAt)}, set off ${r1(ta.t0)}, turn ${r1(ta.turnAt)}, impact ${r1(ta.impactAt)} ms; ${ta.runner.length} runner frames identical)`, { a: { ...ta, runner: ta.runner.length }, b: { ...tb, runner: tb.runner.length }, firstDiff: ta.runner.findIndex((v, i) => v !== tb.runner[i]) });
			const cs = { tS: A.tS, t0: A.t0, lockAt: A.plan?.lockAt ?? null, impactAt: A.impactAt, windup: A.at0.windup ? { clip: A.at0.windup.clip, k: A.at0.windup.k, hop: A.at0.windup.hop, hitAt: A.at0.windup.hitAt } : null };
			out.cases[C.id] = cs;
			const lockSnorts = A.sounds.filter((e) => e.kind === 'moment' && (e.what === 'lockSnort' || e.what === 'lockSnortQuiet'));
			if (C.offscreen) {
				check(A.roamStrike === false && !A.at0.windup && A.rows.every((r) => !r.roam.windup && !(r.fx && r.fx.shown)) && !(A.ch && (A.ch.snow.length || A.ch.puff)), `${tag}: a strike from off the screen has no wind-up and no effect sprite (by design: no reindeer stands on the screen to wind up)`, { roam: A.roamStrike, windupRows: A.rows.filter((r) => r.roam.windup).length, fxRows: A.rows.filter((r) => r.fx && r.fx.shown).length, ch: A.ch });
				// (2026-11-21, REINDEER_SOUND.snort.lockEveryStrike; game/road/lockSnort.ts) its lock's snort: once, at its lock
				const played = A.sounds.filter(snortPlay);
				const snort = lockSnorts[0];
				const row = snort ? A.rows.find((r) => Math.abs(r.c - snort.clock) < 0.2) : null;
				const left = row && A.plan ? (A.plan.lockAt - row.c) / row.rate : null;
				const prev = row ? A.rows[A.rows.indexOf(row) - 1] : null;
				const leftPrev = prev && A.plan ? (A.plan.lockAt - prev.c) / prev.rate : Infinity;
				const firstOk = !!A.plan && (A.plan.lockAt <= 1e-6 ? !!snort && (row === A.rows[0] || Math.abs(snort.clock) < 0.2) : left !== null && left <= 140 + 1e-3 && leftPrev > 140 - 1e-3);
				check(lockSnorts.length === 1 && snort.what === 'lockSnort' && /from off the screen/.test(snort.detail || '') && firstOk && played.length === 1 && /^lock:/.test(played[0].detail || ''), `${tag}: a strike from off the screen snorts once at its lock too (${left === null ? '-' : r1(left)} ms before it)`, { lockSnorts, played, lockAt: A.plan?.lockAt, row, leftPrev });
				check(!B.sounds.some((e) => snortPlay(e) || e.what === 'lockSnort'), `${tag}: with the wind-up off, no snort`, B.sounds.filter((e) => /snort/i.test(e.what)));
				continue;
			}
			check(A.roamStrike === true, `${tag}: the strike is his`);
			const W = A.at0.windup;
			const quick = !!C.quick;
			const want = specPlan(A.plan?.legs, quick, A.t0);
			check(!!W && W.clip === want.clip && Math.abs(W.k - want.k) < 1e-3 && Math.abs((W.early ?? 0) - want.early) < 0.06 && W.at.every((t, i) => Math.abs(t - want.at[i]) < 0.01), `${tag}: the plan is the spec's from the crosshair's legs (${W?.clip}, k ${W?.k}${want.early > 0 ? `, no room for its hit: moved ${r1(want.early)} ms earlier, to ${HIT_MARGIN} ms before the set off` : want.hop !== null ? `, the hit on the hop at ${r1(want.hop)} ms` : ', no hop in reach: its own pace'})`, { game: W, spec: want });
			// (THE ROOM: a stand of HIT_MARGIN or less has the hit at the start, his first frame)
			const first = want.clip === 'charge' && want.at[8] <= 1e-6 ? 9 : 1;
			check(A.at0.clip === want.clip && A.at0.frame === first && A.at0.visible && A.at0.state === 'alert', `${tag}: at the strike's start he shows ${want.clip} frame ${first}${first === 9 ? ' (no room for frames 1 to 8: the hit)' : ' (the stand)'}`, A.at0);
			// (split by the game's own test of the set off, unrounded: `pre`)
			const before = A.rows.filter((r) => r.pre === true);
			const from = A.rows.filter((r) => r.pre === false);
			const dues = framesDue(before, want);
			const wrong = before.filter((r, i) => !(r.roam.state === 'alert' && r.roam.visible && r.roam.clip === want.clip && r.roam.frame === dues[i]));
			check(before.length > 0 && wrong.length === 0, `${tag}: from the strike's first frame to the set off (${before.length} frames) every frame shows the ${want.clip} frame its plan has due (the hit never skipped)`, wrong.slice(0, 3).map((r) => ({ c: r.c, roam: r.roam, due: dues[before.indexOf(r)] })));
			check(from.length > 0 && from.every((r) => !r.roam.visible && r.roam.state === 'none' && !r.roam.windup), `${tag}: no wind-up frame at or after the set off (${r1(A.t0)} ms); the run cuts in there`, from.filter((r) => r.roam.visible).slice(0, 2));
			const cut = from[0];
			// (in a slam stop's hurry the board clock can step past his short side run to the turn: S, as before the wind-up)
			check(!!cut && !!cut.run && cut.run.vis && (cut.run.view === 'R' || (cut.rate > 2 && cut.run.view === 'S')), `${tag}: on the set off's frame the runner shows (view ${cut?.run?.view}, stride ${cut?.run?.stride}); he set off on ${want.clip} frame ${before.length ? before[before.length - 1].roam.frame : '-'}`);
			const stepB = (r) => A.step * r.rate;
			if (!quick) {
				const hitAt = want.at[8];
				const r9 = A.rows.find((r) => r.roam.visible && r.roam.clip === 'charge' && r.roam.frame >= 9);
				check(hitAt < A.t0 && !!r9 && r9.roam.frame === 9 && r9.c >= hitAt - 1e-3 && r9.c - hitAt < stepB(r9) + 1e-3 && r9.c < A.t0, `${tag}: the hit (frame 9) shows within one frame of ${want.early > 0 ? `its time (moved ${r1(want.early)} ms earlier for the room)` : want.hop !== null ? 'its hop' : 'its own time'} (${r1(hitAt)} ms; on the frame at ${r9 ? r1(r9.c) : '-'} ms), before the set off at ${r1(A.t0)}`, { hitAt, r9, t0: A.t0 });
				// (2026-11-21, THE ROOM: never later than HIT_MARGIN before the set off; moved only when it had no room)
				const own = specPlan(A.plan?.legs, false).at[8];
				check(hitAt <= Math.max(0, A.t0 - HIT_MARGIN) + 1e-3 && (want.early > 0) === (own > Math.max(0, A.t0 - HIT_MARGIN) + 1e-6), `${tag}: the hit at ${r1(hitAt)} ms, ${r1(A.t0 - hitAt)} ms before the set off (${HIT_MARGIN} at least)${want.early > 0 ? `; moved from ${r1(own)} ms, the stand had no room` : '; where it was, the stand had room'}`, { hitAt, own, t0: A.t0, early: want.early });
				if (want.hop !== null) {
					const hop = A.sounds.find((e) => e.kind === 'moment' && e.what === 'hop' && Math.abs(e.clock - want.hop) < stepB(r9 ?? { rate: 1 }) + 0.2);
					check(!!hop && !!r9 && Math.abs(hop.clock - r9.c) < 0.2, `${tag}: the hit is on the hop sound's own frame (hop at ${hop ? r1(hop.clock) : '-'}, hit at ${r9 ? r1(r9.c) : '-'} ms)`);
				}
			}
			// the snort at the lock
			if (A.plan && !C.clearOnSnow) {
				const lockMark = A.sounds.find((e) => e.kind === 'moment' && e.what === 'lock');
				const snort = lockSnorts[0];
				const row = snort ? A.rows.find((r) => Math.abs(r.c - snort.clock) < 0.2) : null;
				const left = row ? (A.plan.lockAt - row.c) / row.rate : null;
				const prev = row ? A.rows[A.rows.indexOf(row) - 1] : null;
				const leftPrev = prev ? (A.plan.lockAt - prev.c) / prev.rate : Infinity;
				// (the strike's first frame can be a ticker frame of the frozen clock before the first step: at 0 ms)
				const firstOk = A.plan.lockAt <= 1e-6 ? !!snort && (row === A.rows[0] || Math.abs(snort.clock) < 0.2) : left !== null && left <= 140 + 1e-3 && leftPrev > 140 - 1e-3;
				const played = A.sounds.filter(snortPlay);
				check(lockSnorts.length === 1 && snort.what === 'lockSnort' && firstOk && played.length === 1 && /^lock:/.test(played[0].detail || '') && Math.abs(played[0].clock - snort.clock) < 0.2, `${tag}: the snort once, on the first frame within 140 real ms of the lock (${left === null ? '-' : r1(left)} ms before it${A.plan.lockAt <= 1e-6 ? ': the lock is the start, its first frame' : ''})`, { lockSnorts, played, lockAt: A.plan.lockAt, row, leftPrev });
				check(A.snortAtMoved && !A.sounds.some((e) => e.what === 'lockSnortQuiet'), `${tag}: the lock's snort sounds with another snort 1 s before it (exempt from minGapMs), and the idle snort's gap counts from it`);
				check(!B.sounds.some((e) => snortPlay(e) || e.what === 'lockSnort'), `${tag}: with the wind-up off, no snort (as today)`, B.sounds.filter((e) => /snort/i.test(e.what)));
				const P = A.ch?.puff;
				const lockRow = lockMark ? A.rows.find((r) => Math.abs(r.c - lockMark.clock) < 0.2) : null;
				check(!!P && !!lockMark && Math.abs(P.t - A.plan.lockAt) < 0.01 && P.running === (A.plan.lockAt >= A.t0 - 1e-6) && ((!!lockRow && lockRow.fx.puff > 0) || (Math.abs(lockMark.clock) < 0.2 && A.rows[0].fx.puff > 0)), `${tag}: the breath puff from the lock's moment (${r1(A.plan.lockAt)} ms; shown from its frame at ${lockMark ? r1(lockMark.clock) : '-'}), from the ${P?.running ? `running stride ${P.stride}'s` : `${P?.clip} frame ${P?.frame}'s`} nose`, { P, lockMark, t0: A.t0, lockRow });
				const early = A.rows.filter((r) => r.fx && r.fx.puff > 0 && lockMark && r.c < lockMark.clock - 0.2);
				check(early.length === 0, `${tag}: no puff before the lock`, early.slice(0, 2));
			}
			// the kicked snow
			const snow = A.ch?.snow ?? [];
			if (quick) check(snow.length === 0 && A.rows.every((r) => !r.fx || r.fx.snow === 0), `${tag}: no kicked snow with the head down only`, snow);
			else {
				const due = [10, 11, 12, 13, 14, 15, 17].filter((f) => want.at[f - 1] < A.t0 - 1e-6);
				const okSnow = snow.length === due.length && snow.every((q, i) => q.frame === due[i] && Math.abs(q.t - want.at[q.frame - 1]) < 0.01 && q.t < A.t0 && q.n === (q.frame === 17 ? 8 : 2));
				check(C.clearOnSnow ? snow.every((q) => q.t < A.t0) : okSnow, `${tag}: kicked snow only on the drag frames and the kick that start before the set off (${snow.map((q) => `${q.frame}:${q.n}`).join(' ') || 'none'}; due ${due.join(' ') || 'none'})`, { snow, due, t0: A.t0 });
				const firstSnow = snow.length ? snow[0].t : Infinity;
				check(A.rows.every((r) => !r.fx || r.fx.snow === 0 || r.c >= firstSnow - 1e-3), `${tag}: no speck before its frame`);
			}
			// THE EFFECTS' SIZE (2026-11-20, "Make them read": drawn the export's size times drawScale, packed at 3 physical px
			// per CSS px of that): the widest puff and speck drawn, against 2 x the export's largest radius x drawScale
			if (!C.clearOnSnow) {
				const K2 = 0.18465;
				const kf = K2 * A.at0.scale;
				const pw = Math.max(0, ...A.rows.map((r) => (r.fx ? r.fx.puffW : 0)));
				const sw = Math.max(0, ...A.rows.map((r) => (r.fx ? r.fx.snowW : 0)));
				const ptw = Math.max(0, ...A.rows.map((r) => (r.fx ? r.fx.puffTexW : 0)));
				const stw = Math.max(0, ...A.rows.map((r) => (r.fx ? r.fx.snowTexW : 0)));
				// (round 2: never under 22 and 5 CSS px at their largest, whatever the screen)
				const pMax = Math.max(2 * 75 * kf * 2, 22 / A.view.k);
				const sMax = Math.max(2 * 9.5 * kf * 2, 5 / A.view.k);
				const cssK = A.view.k * (S.dpr || 1);
				check(pw <= pMax + 0.5 && pw >= pMax * 0.75 && ptw >= Math.floor(pMax * A.view.k * 3) - 1, `${tag}: the puff drawn up to ${r1(pw)} road px (2 x the export's, ${r1(pMax)} at most), its picture ${ptw} px for ${r1(pMax * A.view.k)} CSS px (3 a CSS px)`, { pw, pMax, ptw, cssK });
				if (!quick) check(sw <= sMax + 0.5 && sw >= Math.min(2 * 3.8 * kf * 2, 5 / A.view.k) - 0.5 && stw >= Math.floor(sMax * A.view.k * 3) - 1, `${tag}: the specks drawn up to ${r1(sw)} road px (2 x the export's, ${r1(sMax)} at most), their picture ${stw} px for ${r1(sMax * A.view.k)} CSS px`, { sw, sMax, stw });
			}
			// nothing left
			const last = A.rows[A.rows.length - 1];
			check(!A.endWindup && last.fx && last.fx.shown === 0 && !last.fx.visible && last.fx.pending === 0, `${tag}: nothing of the wind-up is left at the end (${r1(last.c)} ms: ${JSON.stringify(last.fx)})`);
			if (A.cleared !== null) {
				const afterClear = A.rows.filter((r) => r.i >= A.cleared);
				check(afterClear.length > 0 && afterClear.every((r) => r.fx && r.fx.shown === 0 && r.fx.snow === 0 && r.fx.pending === 0 && r.fx.puff === 0), `${tag}: the board put up as it is (clearAll, the cut of SKIP TO RESULT and a resume) leaves no effect sprite from that frame on`, afterClear.filter((r) => r.fx && r.fx.shown).slice(0, 2));
			}
			if (C.hurryAt !== undefined || C.turboAt) check(W.clip === 'charge' && A.rows.filter((r) => r.roam.visible).every((r) => r.roam.clip === 'charge'), `${tag}: a ${C.turboAt ? 'turbo change' : 'slam stop'} during the wind-up keeps the slow drag (it only speeds the board clock)`);
			// his drawn ink inside his reach (his keep-outs' box) on every wind-up frame, road px: the solid ink is the reach,
			// the bulbs' soft glow may lie up to reach.glowUp over its top (both read from the art by tools/build_roam.py)
			const sc = A.at0.scale;
			const outInk = before.filter((r) => {
				const q = r.roam.ink;
				const top = r.roam.y - (A.reach.up + (A.reach.glowUp || 0)) * sc;
				// (the hooves' ink reaches 4 frame px under the anchor, as every clip's does: a road px allowed there)
				return !q || q[1] < top - 0.5 || q[0] < r.roam.x - A.reach.side * sc - 0.5 || q[2] > r.roam.x + A.reach.side * sc + 0.5 || q[3] > r.roam.y + 1;
			});
			const over = Math.max(0, ...before.filter((r) => r.roam.ink).map((r) => (r.roam.y - A.reach.up * sc - r.roam.ink[1]) * A.view.k));
			check(outInk.length === 0, `${tag}: on every wind-up frame his ink lies inside the reach his keep-outs are tested with (the bulbs' glow over its top by ${r1(over)} CSS px at most, ${r1((A.reach.glowUp || 0) * sc * A.view.k)} allowed)`, outInk.slice(0, 2).map((r) => ({ c: r.c, ink: r.roam.ink, x: r.roam.x, y: r.roam.y, reach: A.reach, sc })));
			const kick = want.at[16];
			console.log(`  INFO ${tag}: ${want.clip}, k ${r1(want.k * 1000) / 1000}${want.hop !== null ? `, hit on the hop at ${r1(want.hop)}` : quick ? '' : ', hit at its own 266.7'} ms; lock ${A.plan ? r1(A.plan.lockAt) : '-'}, set off ${r1(A.t0)}, impact ${r1(A.impactAt)} ms (board); cut on frame ${before.length ? before[before.length - 1].roam.frame : '-'}${!quick ? `; kick ${kick < A.t0 ? 'shown' : 'cut'}` : ''}; snort ${lockSnorts.map((e) => e.what).join(',') || 'none'}`);
		}
		if (!timing)
			for (const C of CHARGE_SPINS) {
				const spot = spots[si++ % spots.length];
				const A = await CHARGE_SPIN(p, { ...C, spot });
				judgeSpin(`${name} ${C.id}`, A);
				out.cases[C.id] = { strikes: A.strikes.map(({ fromRow, toRow, ...s }) => s), lockSnorts: A.sounds.filter((e) => e.what === 'lockSnort').map((e) => ({ clock: e.clock, detail: e.detail })) };
			}
		out.timing = timingRows;
		if (TIMING) {
			const all = (() => {
				try {
					return JSON.parse(readFileSync(TIMING, 'utf8'));
				} catch {
					return {};
				}
			})();
			all[S.name] = { rows: timingRows, spots: out.spots };
			writeFileSync(TIMING, JSON.stringify(all, null, 1));
		}
	} catch (e) {
		check(false, `${name}: ran without throwing`, String(e && e.stack ? e.stack : e).slice(0, 800));
	}
	check(errs.length === 0, `${name}: no page errors`, errs.slice(0, 5));
	await ctx.close();
}

// ---- THE EFFECTS' CONTRAST (2026-11-20, round 2 of "Make them read"): on every ground he can stand on (the six scene
// presets; his spots are on their snow or grass, never the road) and at each size, the breath puff at its largest while
// still at its full opacity (the oldest puff, past the hold: u >= hold + 0.06) and a kicked speck in mid flight (u 0.45
// to 0.6), measured on a screenshot: the WCAG contrast of the sprite's body (its middle) and of its rim (the outer band)
// against the ground right around it (a ring 1.15 to 1.7 of its radius, on the same frame with the effects hidden).
// Target: 3 to 1 or more for the body or the rim. `ONLY=contrast` runs it alone; CROPS=<dir> also saves the crops (real
// size, device px) and BEFORE=1 measures round 1's look too (the dev knob charge.round1). CONTRAST=0 skips it in the
// charge section.
const CONTRAST_TARGET = 3;
const CONTRAST_PRESETS = ['snowDay', 'snowNight', 'snowSuper', 'grassDay', 'grassNight', 'grassSuper'];
const CONTRAST_SIZES = [
	{ name: 'desktop', vp: { width: 1440, height: 900 }, dpr: 1, q: '', touch: false },
	{ name: 'upright', vp: { width: 390, height: 844 }, dpr: 2, q: '&tier=phone', touch: true },
	{ name: 'small', vp: { width: 360, height: 560 }, dpr: 2, q: '&tier=phone', touch: true },
];
const readPng = (buf) => {
	let o = 8;
	let w = 0;
	let h = 0;
	let ct = 0;
	const idat = [];
	while (o < buf.length) {
		const len = buf.readUInt32BE(o);
		const type = buf.toString('ascii', o + 4, o + 8);
		const data = buf.subarray(o + 8, o + 8 + len);
		if (type === 'IHDR') {
			w = data.readUInt32BE(0);
			h = data.readUInt32BE(4);
			ct = data[9];
		} else if (type === 'IDAT') idat.push(data);
		else if (type === 'IEND') break;
		o += 12 + len;
	}
	const bpp = ct === 6 ? 4 : 3;
	const raw = zlib.inflateSync(Buffer.concat(idat));
	const stride = w * bpp;
	const px = Buffer.alloc(h * stride);
	for (let y = 0; y < h; y++) {
		const f = raw[y * (stride + 1)];
		const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? px[y * stride + x - bpp] : 0;
			const b = y > 0 ? px[(y - 1) * stride + x] : 0;
			const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
			let v = line[x];
			if (f === 1) v += a;
			else if (f === 2) v += b;
			else if (f === 3) v += (a + b) >> 1;
			else if (f === 4) {
				const p0 = a + b - c;
				const pa = Math.abs(p0 - a);
				const pb = Math.abs(p0 - b);
				const pc = Math.abs(p0 - c);
				v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
			}
			px[y * stride + x] = v & 255;
		}
	}
	return { w, h, bpp, px };
};
const linC = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lumAt = (img, x, y) => {
	const i = (y * img.w + x) * img.bpp;
	return 0.2126 * linC(img.px[i]) + 0.7152 * linC(img.px[i + 1]) + 0.0722 * linC(img.px[i + 2]);
};
const median = (a) => {
	if (!a.length) return NaN;
	const s = [...a].sort((p, q) => p - q);
	return s[Math.floor(s.length / 2)];
};
const wcag = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
/** the luminances in a band of a crop (its centre at cx, cy device px; radii in device px) */
const band = (img, cx, cy, r0, r1) => {
	const out = [];
	for (let y = Math.max(0, Math.floor(cy - r1)); y <= Math.min(img.h - 1, Math.ceil(cy + r1)); y++)
		for (let x = Math.max(0, Math.floor(cx - r1)); x <= Math.min(img.w - 1, Math.ceil(cx + r1)); x++) {
			const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
			if (d >= r0 && d <= r1) out.push(lumAt(img, x, y));
		}
	return out;
};

/** one strike on `preset` from `spot`: the puff and a speck, each measured; crops saved when `crops` */
/** ROUND 3 (2026-11-20, candidates for Corey): the look drawn on light ground (ROAM.charge.lightGroundLook: ring, A, B,
 *  C) and `before` (round 1's, the staging look: charge.round1). Each is held to the measure it reads by, honestly:
 *  the ring by its rim or body at 3 to 1, A by its outline and C by its stroke at 2 to 1 (`edge`: the most standing out
 *  tenth of its pixels), B by its tone at 1.5 to 1 (`tone`: its middle's median), the white look on dark ground by its body or rim; `before`
 *  is reported only. LOOKS=before,ring,A,B,C measures each on day and night snow (night grass: before and the white
 *  look); LIFE=1 saves the puff at four moments of its life per look (day snow, the first size). */
const CONTRAST_RULE = {
	ring: { key: 'best', min: 3, what: 'rim or body' },
	// (A's and C's lines are about 1 CSS px on the desktop and soften there: held to 2 to 1, what a 1 px dark line on
	// snow can honestly give; B reads by tone alone: 1.5 to 1)
	A: { key: 'edge', min: 2, what: 'outline' },
	B: { key: 'tone', min: 1.5, what: 'tone' },
	C: { key: 'edge', min: 2, what: 'stroke' },
	light: { key: 'best', min: 3, what: 'rim or body' },
};
const LOOKS = (process.env.LOOKS || '').split(',').filter(Boolean);
const LIFE = process.env.LIFE === '1';

async function setScene(p, preset) {
	await p.evaluate(async (preset) => {
		const h = window.__reindeer;
		h.sceneWant(preset);
		for (let i = 0; i < 100; i++) {
			const s = h.sceneSwap();
			if (s && s.shown === preset && (!s.fade || s.fade.done !== false)) break;
			await new Promise((r) => setTimeout(r, 100));
		}
		await new Promise((r) => setTimeout(r, 900));
	}, preset);
}

/** start his single target strike from `spot` with `variant` drawn ('before', a candidate, or null: as shipped) */
async function startVariantStrike(p, spot, variant) {
	return p.evaluate(
		async ({ spot, variant }) => {
			const h = window.__reindeer;
			const F = h.roadBoard().features;
			const C = h.tune.roam.charge;
			window.__lookShipped ??= C.lightGroundLook;
			C.lightGroundLook = variant && variant !== 'before' && variant !== 'shipped' ? variant : window.__lookShipped;
			h.clock(0);
			h.turbo(0);
			F.charge.round1 = variant === 'before';
			await h.crosshairStrike({ cells: [9], target: 9, poseOnly: true });
			h.roamStandAt(spot.x, spot.y);
			h.step(0.001, 1);
			h.roamStrike(9, { first: true, last: false });
			for (let i = 0; i < 100 && !F['runner']; i++) await new Promise((r) => setTimeout(r, 10));
			return { look: F.charge.look(), roam: F['runner'] ? F['runner'].roam : false, shipped: window.__lookShipped };
		},
		{ spot, variant },
	);
}

async function resetVariant(p) {
	await p.evaluate(() => {
		const h = window.__reindeer;
		h.roadBoard().features.charge.round1 = false;
		if (window.__lookShipped) h.tune.roam.charge.lightGroundLook = window.__lookShipped;
	});
}

/** the puff at four moments of its life (u 0.05, 0.4, 0.75, 0.97: spawn, grown, fading, gone), the window held on the
 *  first puff's spawn point */
async function lifeStrip(p, S, spot, variant, crops) {
	await startVariantStrike(p, spot, variant);
	let first = null;
	for (const [k, target] of [[1, 0.05], [2, 0.4], [3, 0.75], [4, 0.97]]) {
		const got = await p.evaluate(
			async ({ target }) => {
				const h = window.__reindeer;
				const F = h.roadBoard().features;
				for (let i = 0; i < 240; i++) {
					const up = F.charge.state(F['clock']).up.filter((q) => q.kind === 'puff').sort((a, b) => b.u - a.u);
					if (up.length && up[0].u >= target) {
						await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
						return { pick: up[0], view: h.roamView(), log: F.charge.log.puff };
					}
					h.step(1000 / 60, 1);
				}
				return null;
			},
			{ target },
		);
		if (!got) break;
		first ??= got;
		const v = got.view;
		const cx = v.ox + (first.log ? first.log.x : got.pick.x) * v.k;
		const cy = v.oy + (first.log ? first.log.y : got.pick.y) * v.k;
		const half = 34;
		const clip = { x: Math.max(0, cx - half), y: Math.max(0, cy - half * 1.2), width: 2 * half, height: 2 * half };
		mkdirSync(crops, { recursive: true });
		writeFileSync(join(crops, `life_${S.name}_${variant}_${k}.png`), await p.screenshot({ clip }));
		writeFileSync(join(crops, `life_${S.name}_${variant}_${k}.json`), JSON.stringify({ u: got.pick.u, alpha: got.pick.alpha, css: (got.pick.w * v.k).toFixed(1), dpr: S.dpr }));
	}
	await resetVariant(p);
}

async function contrastOne(p, S, preset, spot, round1, crops, variant = null) {
	await setScene(p, preset);
	if (round1) variant = 'before';
	const start = await startVariantStrike(p, spot, variant);
	// the drawn variant: round 1's, or on light ground the candidate in force, or the white look on dark ground
	const drawn = variant === 'before' ? 'before' : start.look === 'dark' ? variant || start.shipped : 'light';
	const out = { preset, look: drawn, his: start.roam };
	for (const which of ['puff', 'snow']) {
		const got = await p.evaluate(
			async ({ which }) => {
				const h = window.__reindeer;
				const F = h.roadBoard().features;
				for (let i = 0; i < 240; i++) {
					h.step(1000 / 60, 1);
					const up = F.charge.state(F['clock']).up.filter((q) => q.kind === which);
					const pick = which === 'puff' ? up.filter((q) => q.u >= 0.66 && q.u <= 0.8).sort((a, b) => b.w - a.w)[0] : up.filter((q) => q.u >= 0.45 && q.u <= 0.6).sort((a, b) => b.w - a.w)[0];
					if (pick) {
						await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
						return { pick, view: h.roamView() };
					}
				}
				return null;
			},
			{ which },
		);
		if (!got) {
			out[which] = null;
			continue;
		}
		const { pick, view } = got;
		const cx = view.ox + pick.x * view.k;
		const cy = view.oy + pick.y * view.k;
		const rc = (pick.w * view.k) / 2;
		const half = Math.max(rc * 2.2, which === 'puff' ? 40 : 18);
		const clip = { x: Math.max(0, cx - half), y: Math.max(0, cy - half), width: 2 * half, height: 2 * half };
		const shot = await p.screenshot({ clip });
		await p.evaluate(async () => {
			window.__reindeer.roadBoard().features.charge.root.alpha = 0;
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		});
		const bare = await p.screenshot({ clip });
		await p.evaluate(() => (window.__reindeer.roadBoard().features.charge.root.alpha = 1));
		const A = readPng(shot);
		const B = readPng(bare);
		const dpr = A.w / clip.width;
		const px = (cx - clip.x) * dpr;
		const py = (cy - clip.y) * dpr;
		const r = rc * dpr;
		const ground = median(band(B, px, py, r * 1.15, r * 1.7));
		// (each band's value: its pixel that stands 80 % of the way out from the ground in its own order: most of the band
		// is at least that far from the ground; a 5 CSS px speck is only a few device px, a plain median of its middle
		// caught its own edge)
		const away = (list) => {
			const s = [...list].sort((p, q) => Math.abs(p - ground) - Math.abs(q - ground));
			return s.length ? s[Math.floor(s.length * 0.2)] : NaN;
		};
		const body = away(band(A, px, py, 0, r * 0.4));
		const rim = away(band(A, px, py, r * (which === 'puff' ? 0.62 : 0.66), r * (which === 'puff' ? 0.78 : 0.9)));
		// (round 3: shapes that are not discs; `edge` the most standing out tenth of the sprite's box, `tone` its middle's
		// median)
		const inBox = band(A, px, py, 0, r * 0.95).sort((p0, q0) => Math.abs(p0 - ground) - Math.abs(q0 - ground));
		const edge = inBox.length ? inBox[Math.floor(inBox.length * 0.9)] : NaN;
		const tone = median(band(A, px, py, 0, r * 0.6));
		const r2c = (v) => Math.round(wcag(v, ground) * 100) / 100;
		const c = { css: Math.round(rc * 2 * 10) / 10, alpha: pick.alpha, u: pick.u, ground: Math.round(ground * 1000) / 1000, body: r2c(body), rim: r2c(rim), edge: r2c(edge), tone: r2c(tone) };
		c.best = Math.max(c.body, c.rim);
		out[which] = c;
		if (crops) {
			mkdirSync(crops, { recursive: true });
			const tag = `${S.name}_${preset}_${which}_${out.look === 'before' ? 'before' : variant ? out.look : 'after'}`;
			writeFileSync(join(crops, `${tag}.png`), shot);
			writeFileSync(join(crops, `${tag}.json`), JSON.stringify({ ...c, dpr, look: out.look }));
		}
	}
	await resetVariant(p);
	await p.evaluate(() => window.__reindeer.sceneWant('snowDay'));
	return out;
}

async function contrastSize(browser, S) {
	const name = `contrast ${S.name} ${S.vp.width}x${S.vp.height}`;
	const { ctx, p, errs, ready } = await boot(browser, S);
	check(ready, `${name}: the game is ready`);
	if (!ready) return void (await ctx.close());
	const rows = [];
	try {
		for (let i = 0; i < 60; i++) {
			const mem = await p.evaluate(() => window.__reindeer.roamMemory());
			if (mem.charge?.loaded) break;
			await sleep(250);
		}
		for (let i = 0; i < 60; i++) {
			const st = await p.evaluate(() => window.__reindeer.roam().state);
			if (st !== 'enter' && st !== 'none') break;
			await sleep(500);
		}
		const picks = await p.evaluate(() => window.__reindeer.roamPicks(40, 20, 5151));
		const spots = picks.filter((q) => q.pass >= 0);
		// (2026-11-23, the sign bar at 360 x 560: no pick found a spot, and the section threw reading spots[0].x) With
		// nowhere for him to stand there is no strike of his to measure: one line that says so, with what he has to stand
		// on (ROAM_GROUND), and the section ends.
		if (!spots.length) {
			const ground = await p.evaluate(ROAM_GROUND);
			check(false, `${name}: he has a spot to strike from at this window (${picks.filter((q) => !q.walkIn && q.pass >= 0).length} of 40 seeded picks and ${picks.filter((q) => q.walkIn && q.pass >= 0).length} of 20 walk in picks found one); no puff could be measured`, ground);
			check(errs.length === 0, `${name}: no page errors`, errs.slice(0, 5));
			return void (await ctx.close());
		}
		let si = 0;
		// (LOOKS: the candidates on the light grounds, night grass for the white look; else every ground as shipped)
		const plan = LOOKS.length
			? [['snowDay', LOOKS], ['snowNight', LOOKS], ['grassNight', LOOKS.filter((v) => v === 'before').concat([null])]]
			: CONTRAST_PRESETS.map((pr) => [pr, BEFORE ? ['before', null] : [null]]);
		for (const [preset, variants] of plan) {
			for (const variant of variants) {
				const R = await contrastOne(p, S, preset, spots[si++ % spots.length], false, CROPS, variant);
				rows.push({ size: S.name, ...R });
				if (R.look === 'before') continue;
				const rule = CONTRAST_RULE[R.look] ?? CONTRAST_RULE.ring;
				const tag = `${name} ${preset} (${R.look} look, held to its ${rule.what} at ${rule.min} to 1)`;
				const v = (q) => (q ? q[rule.key] : null);
				check(R.his && !!R.puff && v(R.puff) >= rule.min, `${tag}: the puff at its largest at full opacity (${R.puff?.css} CSS px) stands out ${v(R.puff)}:1 (body ${R.puff?.body}, rim ${R.puff?.rim}, edge ${R.puff?.edge}, tone ${R.puff?.tone}; ground ${R.puff?.ground})`, R.puff);
				// (Corey 2026-11-21, shown the A look's 5 px specks on night snow reading 1.34 to 1.83 to 1: "Leave it". The
				// speck there is his accepted look, so on night snow it is held to being there and above 1.2 to 1; the puff's
				// own line above and every other ground keep the look's full rule.)
				const speckMin = R.look === 'A' && preset === 'snowNight' ? 1.2 : rule.min;
				check(R.his && !!R.snow && v(R.snow) >= speckMin, `${tag}${speckMin !== rule.min ? ` (the speck here at ${speckMin} to 1, his accepted look)` : ''}: a speck in mid flight (${R.snow?.css} CSS px) stands out ${v(R.snow)}:1 (body ${R.snow?.body}, rim ${R.snow?.rim}, edge ${R.snow?.edge}, tone ${R.snow?.tone}; ground ${R.snow?.ground})`, R.snow);
				check(!!R.puff && R.puff.css >= 0.74 * 22 - 0.5 && !!R.snow && R.snow.css >= 4.5, `${tag}: their size on the screen: the puff ${R.puff?.css} CSS px here (22 at its largest at least), the speck ${R.snow?.css}`);
			}
		}
		if (LIFE && CROPS && S === CONTRAST_SIZES[0]) {
			await setScene(p, 'snowDay');
			for (const variant of LOOKS.length ? LOOKS : [null]) await lifeStrip(p, S, spots[si++ % spots.length], variant || 'shipped', CROPS);
			await p.evaluate(() => window.__reindeer.sceneWant('snowDay'));
		}
	} catch (e) {
		check(false, `${name}: ran without throwing`, String(e && e.stack ? e.stack : e).slice(0, 600));
	}
	(report.contrast ??= []).push(...rows);
	const f = (q) => (q ? `rim/body ${q.best} edge ${q.edge} tone ${q.tone} (${q.css} css)` : '-');
	for (const R of rows) console.log(`  CONTRAST ${R.size.padEnd(8)} ${R.preset.padEnd(11)} ${String(R.look).padEnd(7)} puff ${f(R.puff)}  speck ${f(R.snow)}`);
	check(errs.length === 0, `${name}: no page errors`, errs.slice(0, 5));
	await ctx.close();
}

async function groundSize(browser, S) {
	const name = `${S.name}`;
	const { ctx, p, errs, ready } = await boot(browser, S);
	check(ready, `${name}: the game and the roaming reindeer's frames are ready`);
	if (!ready) {
		await ctx.close();
		return;
	}
	const d = await p.evaluate(async () => {
		const h = window.__reindeer;
		const roam = h.roam();
		// (the drawn forest's own tree line, game/forestLineSpec.ts: on the short upright ground roam().trees.y is Corey's
		// band top edge, not the tree line)
		const kit = roam.trees?.forest?.kit;
		const forestLine = kit ? ((await import('/src/game/forestLineSpec.ts')).FOREST_LINE[kit]?.line ?? null) : null;
		return { G: h.roamGround(), view: h.roamView(), roam, forestLine, zones: h.roamZones(), scene: h.sign?.scene?.() ?? null, signZones: h.sign?.inputs?.().zones ?? null, board: h.boardLayout().css, vp: { width: innerWidth, height: innerHeight } };
	});
	const out = { name: S.name };
	report.sizes[S.name] = out;
	const v = d.view;
	const css = (y) => v.oy + y * v.k;
	// the tree line as drawn: the lowest of the forest's columns the window shows (road px). Off the short ground from
	// roam().trees (each column's tree row plus the 6 road px pad). On the short upright ground (roam().short, since
	// d66617c8) roam().trees.y is Corey's band top edge in finer columns (its lowest point is the band's left end, road y
	// 49.6 at the 413x586 forest, 7 to 11 CSS px under the tree line), so the tree line there is read from the drawn forest
	// box (roam().trees.forest) and its kit's FOREST_LINE columns, the rule's own sum; the band edge is printed beside it
	let live = null;
	if (d.roam.trees) {
		const T = d.roam.trees;
		let low = -Infinity;
		if (d.roam.short) {
			const F = T.forest;
			const L = d.forestLine ?? [];
			for (let i = 0; i < L.length; i++) {
				const a = F.x + (F.width * i) / L.length;
				const b = F.x + (F.width * (i + 1)) / L.length;
				if (b > v.rect.left && a < v.rect.right) low = Math.max(low, F.y + F.height * L[i] + 6);
			}
			let band = -Infinity;
			for (let i = 0; i < T.y.length; i++) if (T.x[i + 1] > v.rect.left && T.x[i] < v.rect.right) band = Math.max(band, T.y[i]);
			live = { feet: css(low), line: css(low - 6), bandLow: css(band) };
		} else {
			for (let i = 0; i < T.y.length; i++) if (T.x[i + 1] > v.rect.left && T.x[i] < v.rect.right) low = Math.max(low, T.y[i]);
			live = { feet: css(low), line: css(low - 6) };
		}
	}
	const road = d.zones.find((z) => z.name === 'road');
	const logo = d.zones.find((z) => z.name === 'logo');
	out.ground = { kind: v.kind, rule: { treeY: d.G?.treeY ?? null, top: d.G?.top, bottom: d.G?.bottom, roadY: d.G?.roadY }, live, road: road ? road.y0 : null, his: d.scene ? { boardDy: d.scene.boardDy, treeDy: d.scene.treeDy, share: d.scene.share, tree: d.scene.tree } : null, columns: d.board.y };
	console.log(`  INFO ${name}: ${JSON.stringify(out.ground, (k, x) => (typeof x === 'number' ? r1(x) : x))}`);
	check(!!d.G && (d.G.treeY === null) === (live === null) && (live === null || Math.abs(live.line - d.G.treeY) <= 1) && !!road && Math.abs(road.y0 - d.G.roadY) <= 1, `${name}: the scene as drawn is the layout's own rule to 1 px: ${live ? `the tree line at ${r1(live.line)} (rule ${r1(d.G?.treeY)})` : 'no tree line (the rule: none)'}, the asphalt's top at ${road ? r1(road.y0) : '?'} (rule ${r1(d.G?.roadY)})`, out.ground);
	if (live) check(live.feet < d.G.bottom && d.G.bottom < d.G.roadY && d.G.roadY <= d.board.y + 1, `${name}: his ground is a strip under the tree line and above the board: feet from ${r1(live.feet)} to ${r1(d.G.bottom)} (${r1(d.G.bottom - live.feet)} px), the asphalt at ${r1(d.G.roadY)}, the columns at ${r1(d.board.y)}`, out.ground);
	else check(d.G.bottom <= d.G.roadY && d.G.roadY <= d.board.y + 1, `${name}: no tree line here: his ground runs from the window's top edge (his whole body on the screen, under the top line) down the snow rim to the asphalt at ${r1(d.G.roadY)}, above the columns at ${r1(d.board.y)}`, out.ground);
	// (at his own windows, where his logo box stands whole; a window with a part share of it also takes the game's own
	// drop to the tree line, which the sign bar's copy of the box leaves out)
	if (logo && d.signZones?.logo && (d.scene?.share ?? 0) >= 1) {
		const L = d.signZones.logo;
		check(Math.abs(logo.x0 - L.x) <= 1.5 && Math.abs(logo.y0 - L.y) <= 1.5 && Math.abs(logo.x1 - L.x - L.w) <= 1.5 && Math.abs(logo.y1 - L.y - L.h) <= 1.5, `${name}: the logo's keep-out is the sign where it is drawn (his own box here), the same box the sign bar keeps off`, { roam: [logo.x0, logo.y0, logo.x1, logo.y1].map(r1), bar: [L.x, L.y, L.x + L.w, L.y + L.h].map(r1) });
	}
	// the seeded picks and walk ins: feet under the trees and off the road, his body off every keep-out
	const geo = { view: d.view, roam: d.roam, vp: d.vp };
	const picks = await p.evaluate(() => window.__reindeer.roamPicks(120, 40, 2323));
	const bad = [];
	let found = 0;
	let ins = 0;
	let under = 0;
	for (const q of picks) {
		if (q.pass < 0) continue;
		if (q.walkIn) ins++;
		else found++;
		if (q.walkIn && q.underSign) under++;
		if (onTrees(d.roam.trees, q.x, q.y)) bad.push(`${q.walkIn ? 'walk in' : 'pick'} (${r1(q.x)}, ${r1(q.y)}) on the trees`);
		// (where he stops: off every keep-out, the signs too: he never stands under a key)
		const h0 = hitsAt(geo, d.zones, q.x, q.y);
		if (h0.length) bad.push(`${q.walkIn ? 'walk in' : 'pick'} (${r1(q.x)}, ${r1(q.y)}) covers ${h0.join(', ')}`);
		// (a walk in's way from past the edge, every 4 road px: off everything but, where the game says the way is
		// under the sign, the Fast Lane and Menu signs)
		if (q.walkIn) {
			const legs = q.route && q.route.length > 1 ? q.route : [{ x: q.fromX, y: q.fromY }, { x: q.x, y: q.y }];
			let broke = false;
			for (let L = 0; L + 1 < legs.length && !broke; L++) {
				const a = legs[L];
				const b = legs[L + 1];
				const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
				for (let i = L === 0 ? 1 : 0; i < n && !broke; i++) {
					const x = a.x + ((b.x - a.x) * i) / n;
					const y = a.y + ((b.y - a.y) * i) / n;
					const hw = hitsAt(geo, d.zones, x, y, true).filter((z) => z !== 'screen' && !(q.underSign && z === 'sign'));
					if (onTrees(d.roam.trees, x, y)) hw.push('the trees');
					if (hw.length) {
						bad.push(`the walk in to (${r1(q.x)}, ${r1(q.y)})${q.underSign ? ' (under the sign)' : ''} covers ${hw.join(', ')} at (${r1(x)}, ${r1(y)})`);
						broke = true;
					}
				}
			}
		}
		if (css(q.y) > d.G.roadY + 0.5 && q.x > 0 && q.x < 1536 && v.kind === 'portrait') bad.push(`${q.walkIn ? 'walk in' : 'pick'} (${r1(q.x)}, ${r1(q.y)}) on or under the asphalt's top`);
	}
	out.ground.picks = { found, of: 120, walkIns: ins, underSign: under, ofWalkIns: 40, capacity: d.roam.capacity };
	const signs = d.zones.filter((z) => z.name === 'sign').length;
	check(signs >= 1, `${name}: the Fast Lane and Menu signs are zones of their own (${signs} 'sign' zones): he never stands under one, a walk in may cross behind one where no other way is clear`, d.zones.map((z) => z.name));
	if (S.walkIn) check(S.sign === 'under' ? ins > 0 && under === ins : under === 0, S.sign === 'under' ? `${name}: no way in clear of every key here (the Fast Lane sign, and on the short ground the arch's lane under it): every walk in found (${ins}) crosses behind the sign (${under} marked underSign)` : `${name}: a way in clear of every key exists here, so no walk in goes behind a sign (${under} of ${ins})`, out.ground.picks);
	check(bad.length === 0, `${name}: ${found} of 120 seeded picks and ${ins} of 40 walk ins (${under} behind a sign): every one's feet under the tree line and above the asphalt, where he stops his body off every key, sign, the logo, the LED strip and the top line, and every walk in's way off all of them but a sign it is marked to pass (the area holds ${d.roam.capacity} spots 12 % of the width apart)`, bad.slice(0, 6));
	if (S.walkIn) check(ins > 0, `${name}: he can walk in here (${ins} of 40 seeded walk ins found a spot with a clear way in from past the edge)`, out.ground);
	else console.log(`  INFO ${name}: walk ins found ${ins} of 40 (listed: not asked at this size)`);
	check(errs.length === 0, `${name}: no page errors`, errs.slice(0, 5));
	await ctx.close();
}

const ROAM_BACK_WAIT = 7000;

const main = async () => {
	const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	try {
		for (const S of [...SIZES, ...SWEEP]) {
			const pick = !ONLY.length ? !S.sweep : ONLY.includes(S.name) || (S.sweep && ONLY.includes('sweep'));
			if (!pick) continue;
			await runSize(browser, S);
		}
		for (const S of GROUND_SIZES) if (!ONLY.length || ONLY.includes('ground') || ONLY.includes(S.name)) await groundSize(browser, S);
		for (const S of SIZES.filter((s) => WHEEL_SIZES.includes(s.name))) {
			if (ONLY.length && !ONLY.includes('wheel') && !ONLY.includes(`wheel:${S.name}`)) continue;
			await wheelSize(browser, S);
		}
		if (!ONLY.length || ONLY.includes('wheel') || ONLY.includes('wheel:wide')) await wheelWide(browser);
		// THE CHARGE WIND-UP (ONLY=charge, charge:<size>; ONLY=timing with TIMING=<file>: the timing rows only, any build)
		const spotsFrom = SPOTS ? Object.fromEntries(Object.entries(JSON.parse(readFileSync(SPOTS, 'utf8'))).map(([k, v]) => [k, v.spots])) : null;
		for (const S of SIZES.filter((s) => CHARGE_SIZES.includes(s.name))) {
			const want = !ONLY.length || ONLY.includes('charge') || ONLY.includes(`charge:${S.name}`) || ONLY.includes('timing') || ONLY.includes(`timing:${S.name}`);
			if (want) await chargeSize(browser, S, spotsFrom);
		}
		// THE EFFECTS' CONTRAST (round 2): with the charge section (CONTRAST=0 skips it), or alone (ONLY=contrast)
		const contrast = ONLY.includes('contrast') || (CONTRAST && (!ONLY.length || ONLY.includes('charge')));
		const csizes = (process.env.CSIZES || '').split(',').filter(Boolean);
		if (contrast) for (const S of CONTRAST_SIZES) if (!csizes.length || csizes.includes(S.name)) await contrastSize(browser, S);
	} finally {
		await browser.close();
	}
	report.pass = pass;
	report.fail = fail;
	report.fails = fails;
	if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 1));
	console.log(`\nroam_probe: ${pass} pass, ${fail} fail`);
	for (const f of fails) console.log(`  FAIL ${f}`);
	process.exitCode = fail ? 1 : 0;
};
main();
