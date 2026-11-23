// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// THE GEAR BAR'S LAYOUT RULE, A PURE TEST (no browser): src/ui/gear/gearLayout.ts, the file the game bar draws from.
//   node --experimental-strip-types --no-warnings tools/gear_layout_test.mjs
// Checked:
//   - at 1920 x 1080 every piece is within 1 CSS px of Corey's place (corey_desktop_r6_2026-11-22.json and the mock's
//     groups.json: the Play gear's center 1622, 179, 280 across, 46 teeth; Auto and Turbo 22 teeth at 120.3 and 80.6 deg)
//   - the sizes the mock's sizes page checked: the gears' scale against the mock's own (check/report.json), so 9 percent
//     smaller at 1440 x 900 and 13 percent at 1200 x 675 and 1024 x 576, none at the 16:9 sizes from 1280 x 720 up
//   - a sweep of desktop windows (every width from 900 to 3840 in steps, shapes from 4:3 to 32:9): no piece off the
//     window, no press box under 44 CSS px, the three gears meshed (pitch circles the table's play apart, Auto and Turbo
//     as far from each other as in his layout), the bottom row's three groups apart, the small word under the hub's count
//   - the turning rule: at any travel of the haul each small gear's tooth sits in the Play gear's gap on the line of
//     centers (the pitch point), and the folded angle a layer is drawn at is the same picture as the true angle
//   - the haul as BoardFrame reports it: a Spin press turns the HTML gears its 4 links at every turbo level and never
//     turns them back by a tile when the press is folded into the haul's base
//   - the upright phone (UPRIGHT, uprightLayout): his five gears exact at 402 x 874, each move from his places, the
//     windows the mock solved (meshed, on the window, < and > clear of the Play, nothing on the board, the plaque or the
//     logo by the stills' boxes), a 34 px bottom safe area, a sweep of phone windows, the chain's turning, its switch
//   - the sideways phone (SIDEWAYS, sidewaysLayout): his chain from the frame's wheel at 874 x 402, the moves from his
//     export, the Play's size at 852 x 393, 844 x 390, 812 x 425 and 667 x 375, the stills' boxes, safe areas, a sweep
//   - the upright phone's scene under the train (src/ui/gear/uprightScene.ts, 2026-11-23): a short window stands its
//     board higher and draws the board and the train at one share of their full-width sizes; Win and Balance always in
//     the band; and THE PHONE SIZE SURVEY: every frame a phone browser gives the game (73 captures and Corey's 832 x 376),
//     the bar each draws, a table of the Play's and the small gears' sizes before and after, and in every gear frame:
//     the pieces in the frame, 44 px press boxes, no press region on another, the text floor, and sideways nothing in
//     the bottom 20 px (the home indicator strip)
//   - the War Standard's run back (2 links, at a feature's first free spin and at its return to the base game): a real
//     run of the chain that the gears follow with the frame's wheels, with no jump when it is folded off
//   - the switch: desktop windows and phones get the gear bar where it fits, Popout S and narrow phones keep the dock,
//     one constant rolls back
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// the app's own modules import each other without an extension (Vite resolves them; node does not)
registerHooks({
	resolve(specifier, context, next) {
		if (/^constants-shared\/[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
		if (/^\.\.?\//.test(specifier) && !/\.(ts|js|mjs|json)$/.test(specifier) && context.parentURL) {
			for (const ext of ['.ts', '.svelte.ts', '/index.ts']) {
				const u = new URL(specifier + ext, context.parentURL);
				if (existsSync(fileURLToPath(u))) return next(u.href, context);
			}
		}
		return next(specifier, context);
	},
});

const L = await import('../src/ui/gear/gearLayout.ts');
const { FRAME_WHEEL } = await import('../src/game/frameGears.ts');

let failed = 0;
const check = (name, ok, detail = '') => {
	if (!ok) failed += 1;
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`);
};
const f1 = (v) => Math.round(v * 10) / 10;
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- 1. Corey's places at 1920 x 1080 ----
{
	const G = L.desktopLayout(1920, 1080);
	const P = G.gears;
	check('1920 x 1080: the Play gear at 1622, 179, 280 across, 46 teeth', near(P.play.cx, 1622, 0.01) && near(P.play.cy, 179, 0.01) && near(2 * P.play.R, 280.36, 0.05) && P.play.teeth === 46, `${f1(P.play.cx)}, ${f1(P.play.cy)}, ${f1(2 * P.play.R)} across, ${P.play.teeth} teeth`);
	// the mock's own numbers (desktop_r7_sizes_2026-11-22/build/groups.json)
	const want = { auto: [1794.852, 280.006, 69.732], turbo: [1819.512, 146.302, 69.732] };
	for (const id of ['auto', 'turbo']) check(`1920 x 1080: ${id} at the mock's snapped place, 22 teeth`, near(P[id].cx, want[id][0], 0.05) && near(P[id].cy, want[id][1], 0.05) && near(P[id].R, want[id][2], 0.01) && P[id].teeth === 22, `${f1(P[id].cx)}, ${f1(P[id].cy)}, R ${f1(P[id].R)}`);
	const box = { menu: [48.033, 222.232, 151.467, 168], arm: [207.5, 222.232, 151.467, 168], down: [1466.933, 1002.533, 66.667, 66.667], up: [1767.6, 1002.267, 66.667, 66.667], amt: [1536.933, 998.133, 206.667, 66.667], bal: [10.667, 998.133, 317.44, 68.267], win: [795.333, 999.2, 329.333, 72.8] };
	for (const [id, w] of Object.entries(box)) {
		const b = G.box[id];
		check(`1920 x 1080: ${id} within 1 px of his place`, near(b.x, w[0], 1) && near(b.y, w[1], 1) && near(b.w, w[2], 1) && near(b.h, w[3], 1), `${f1(b.x)}, ${f1(b.y)}, ${f1(b.w)} x ${f1(b.h)}`);
	}
	check('1920 x 1080: nothing nudged', near(G.scale.gears, 1, 1e-9) && near(G.scale.bet, 1, 1e-9) && !G.text.subBig && near(G.h, 1, 1e-9));
	check('1920 x 1080: the hub is 0.66 of the gear', near(G.hubR / P.play.R, 0.66, 1e-9));
	check('1920 x 1080: the tooth pitch and height are the frame wheel\'s', near((2 * Math.PI * P.play.pitchR) / P.play.teeth, 18.443, 1e-6) && near((2 * Math.PI * P.auto.pitchR) / P.auto.teeth, 18.443, 1e-6) && near(2 * (P.play.R - P.play.pitchR), 10.311, 1e-6));
}

// ---- 2. the sizes the mock checked: the gears' scale and what was nudged ----
{
	// desktop_r7_sizes_2026-11-22/check/report.json: gear.k (the gears' scale against 1920 x 1080) per window
	const MOCK = { '1920x1080': [1, 0], '1200x675': [0.6647, 13], '1024x576': [0.5648, 13], '1280x720': [0.6667, 0], '1366x768': [0.7111, 0], '1440x900': [0.684, 9], '2560x1440': [1.3333, 0], '2560x1080': [1, 0], '3440x1440': [1.3333, 0] };
	for (const [key, [k, pct]] of Object.entries(MOCK)) {
		const [vw, vh] = key.split('x').map(Number);
		const G = L.desktopLayout(vw, vh);
		const got = Math.round((1 - G.scale.gears / G.h) * 100);
		check(`${key}: the gears ${pct} percent smaller, scale ${k}`, got === pct && near(G.scale.gears, k, 0.012), `${got} percent, scale ${G.scale.gears.toFixed(4)}, HUD ${G.h.toFixed(4)}, the Play gear ${f1(G.mesh.off)} px off a true mesh with the frame's wheel`);
	}
	const small = L.desktopLayout(1024, 576);
	check('1024 x 576: the amount 1 percent larger, < and > 44 px', near(small.box.down.w, 44, 0.01) && Math.round((small.scale.bet / small.h - 1) * 100) === 1, `${f1(small.box.down.w)} px`);
	for (const [key, big] of [['1920x1080', false], ['2560x1440', false], ['1280x720', true], ['1366x768', true], ['1440x900', true], ['1200x675', true], ['1024x576', true]]) {
		const [vw, vh] = key.split('x').map(Number);
		const G = L.desktopLayout(vw, vh);
		check(`${key}: the small word under the hub's count ${big ? 'raised (17)' : 'as drawn (14)'}`, G.text.subBig === big, `${f1(G.text.sub)} px`);
	}
	const wide = L.desktopLayout(3440, 1440);
	check('3440 x 1440: the controls stay with the 16:9 game area', near(wide.area.x, 440, 0.01) && wide.box.bal.x > 440 && wide.box.up.x + wide.box.up.w < 3000 && near(wide.box.win.x + wide.box.win.w / 2, 1720, 0.01));
}

// ---- 3. the sweep ----
{
	const SHAPES = [4 / 3, 1.5, 1.6, 16 / 9, 1.9, 21 / 9, 2.39, 32 / 9];
	let n = 0;
	const bad = { off: [], press: [], mesh: [], rows: [], text: [], clear: [] };
	for (let vw = 900; vw <= 3840; vw += 20) {
		for (const a of SHAPES) {
			const vh = Math.round(vw / a);
			if (L.barKind({ kind: 'landscape', vw, vh }) !== 'gear') continue;
			n += 1;
			const G = L.desktopLayout(vw, vh);
			const tag = `${vw}x${vh}`;
			for (const id of L.PIECES) {
				const b = G.box[id];
				if (b.x < -0.5 || b.y < -0.5 || b.x + b.w > vw + 0.5 || b.y + b.h > vh + 0.5) bad.off.push(`${tag} ${id}`);
			}
			for (const id of ['play', 'auto', 'turbo', 'down', 'up', 'menu', 'arm']) if (Math.min(G.box[id].w, G.box[id].h) < L.MIN_PRESS - 0.01) bad.press.push(`${tag} ${id} ${f1(Math.min(G.box[id].w, G.box[id].h))}`);
			const { play, auto, turbo } = G.gears;
			for (const s of [auto, turbo]) {
				const d = Math.hypot(s.cx - play.cx, s.cy - play.cy);
				if (!near(d, play.pitchR + s.pitchR + L.DESKTOP.small.clear * G.scale.gears, 0.01)) bad.mesh.push(`${tag} ${f1(d)}`);
			}
			// his places (120.3 and 80.6 degrees): the two small gears' tip circles cross by 3.5 px x the scale, as in the mock
			if (!near(Math.hypot(auto.cx - turbo.cx, auto.cy - turbo.cy) - auto.R - turbo.R, -3.504 * G.scale.gears, 0.02)) bad.clear.push(tag);
			if (!(G.box.bal.x + G.box.bal.w < G.box.win.x && G.box.win.x + G.box.win.w < G.box.down.x && G.box.down.x + G.box.down.w <= G.box.amt.x + 1 && G.box.amt.x + G.box.amt.w <= G.box.up.x + 1)) bad.rows.push(tag);
			if (G.text.sub < 8.5 || G.text.word < 9.5) bad.text.push(`${tag} ${f1(G.text.sub)} ${f1(G.text.word)}`);
		}
	}
	check(`sweep of ${n} desktop windows: no piece off the window`, bad.off.length === 0, bad.off.slice(0, 4).join('; '));
	check('sweep: no press box under 44 CSS px', bad.press.length === 0, bad.press.slice(0, 4).join('; '));
	check('sweep: Auto and Turbo meshed with the Play gear (pitch circles the table\'s play apart)', bad.mesh.length === 0, bad.mesh.slice(0, 4).join('; '));
	check('sweep: Auto and Turbo keep his places against each other (tip circles crossing by 3.5 px at 1920 x 1080, as in the mock)', bad.clear.length === 0, bad.clear.slice(0, 4).join('; '));
	check('sweep: Balance, Win and the amount row apart, in order', bad.rows.length === 0, bad.rows.slice(0, 4).join('; '));
	check('sweep: the hub\'s small word at least 8.5 px, the small gears\' word at least 9.5 px', bad.text.length === 0, bad.text.slice(0, 4).join('; '));
}

// ---- 4. the turning rule ----
{
	const { play, auto } = L.DESKTOP_GEARS;
	const pp = 360 / play.teeth;
	const ps = 360 / auto.teeth;
	let worst = 0;
	let foldWorst = 0;
	for (const at of [L.DESKTOP.small.autoDeg, L.DESKTOP.small.turboDeg]) {
		for (let links = -3; links <= 9; links += 0.0371) {
			const a = L.playAngle(links, play.teeth);
			const s = L.smallAngle(a, at, play.teeth, auto.teeth);
			// on the line of centers: how far the Play gear's nearest GAP is from it, and the small gear's nearest TOOTH,
			// as arc along each pitch circle; meshed, the two are the same point
			const gapP = L.fold(at - a - pp / 2, pp) * (Math.PI / 180) * play.pitchR;
			const toothS = L.fold(at + 180 - s, ps) * (Math.PI / 180) * auto.pitchR;
			worst = Math.max(worst, Math.abs(gapP + toothS));
			foldWorst = Math.max(foldWorst, Math.abs(L.fold(L.fold(a, pp) - a, pp)), Math.abs(L.fold(L.fold(s, ps) - s, ps)));
		}
	}
	check('turning: a small gear\'s tooth sits in the Play gear\'s gap at the pitch point, at every travel', worst < 0.01, `worst ${worst.toFixed(5)} px`);
	check('turning: a folded angle is the true angle less whole teeth', foldWorst < 1e-6);
	check('turning: the Play gear turns two teeth a link, against the frame wheel (which turns clockwise)', near(L.playAngle(1, 46), -2 * (360 / 46), 1e-9) && FRAME_WHEEL.teethPerLink === 2);
	check('turning: the small gears turn the other way from the Play gear', L.smallAngle(L.playAngle(1, 46), 80.6, 46, 22) > L.smallAngle(0, 80.6, 46, 22));
}

// ---- 4b. the haul as BoardFrame reports it (its offset: base modulo 2 plus what the live presses have run) ----
{
	const F = await import('../src/game/frameGears.ts');
	const backOut = (t) => --t * t * ((1.2 + 1) * t + 1.2) + 1;
	/** play presses the way components/BoardFrame.svelte tickHaul does: each `links` over `ms` with the overshoot, folded
	 *  into the base (modulo 2, the whole tiles kept in `wound`) when done; frames `dt` ms apart; returns the travel the
	 *  HTML gears were told */
	const play = (presses, dt) => {
		const start = F.frameGears.links;
		let base = 0.37;
		let wound = start - base;
		F.frameGearsAt(wound + base);
		const live = presses.map((p) => ({ ...p }));
		let seen = [];
		const off = F.onFrameGears((l) => seen.push(l));
		for (let t = 0; live.length; t += dt) {
			let moving = 0;
			for (let i = live.length - 1; i >= 0; i--) {
				const p = live[i];
				if (t < p.t0) continue;
				const u = Math.max(0, Math.min(1, (t - p.t0) / p.ms));
				if (u >= 1) {
					const m = (((base + p.links) % 2) + 2) % 2;
					wound += base + p.links - m;
					base = m;
					live.splice(i, 1);
				} else moving += p.links * (p.ease === 'inOut' ? 0.5 - 0.5 * Math.cos(Math.PI * u) : backOut(u));
			}
			F.frameGearsAt(wound + base + moving);
		}
		off();
		let back = 0;
		let jump = 0;
		for (let i = 1; i < seen.length; i++) {
			back = Math.min(back, seen[i] - seen[i - 1]);
			jump = Math.max(jump, Math.abs(seen[i] - seen[i - 1]));
		}
		return { travel: F.frameGears.links - start, back, jump, calls: seen.length, seen };
	};
	for (const [tag, ms] of [['turbo 0', 1280], ['turbo 1', 1280 / 2.2], ['turbo 2', 1280 / 4]]) {
		const r = play([{ t0: 80, ms, links: 4 }], 1000 / 60);
		check(`the haul: a Spin press at ${tag} turns the HTML gears 4 links, and never back by a tile`, near(r.travel, 4, 1e-9) && r.back > -0.5, `travel ${r.travel.toFixed(4)}, largest step back ${r.back.toFixed(3)} (the overshoot's return)`);
	}
	const two = play([{ t0: 0, ms: 320, links: 4 }, { t0: 150, ms: 320, links: 4 }, { t0: 700, ms: 900, links: 1.4 }], 250);
	check('the haul: two presses on top of each other and a War Standard run of 1.4 links, at 4 frames a second (a hitch): 9.4 links', near(two.travel, 9.4, 1e-9) && two.back > -0.5, `travel ${two.travel.toFixed(4)}`);
}

// ---- 4b2. the War Standard's run back (components/WarBanner.svelte hide(): BANNER.chains.backLinks -2 over backMs 500,
// a sine in and out), at a feature's first free spin and at its return to the base game: a real run of the chain, so
// the gears turn back its 2 links with the frame's wheels, smoothly, and the fold at its end moves nothing ----
{
	const F = await import('../src/game/frameGears.ts');
	const backOut = (t) => --t * t * ((1.2 + 1) * t + 1.2) + 1;
	const play = (runs, dt) => {
		const start = F.frameGears.links;
		let base = 1.0;
		let wound = start - base;
		F.frameGearsAt(wound + base);
		const live = runs.map((p) => ({ ...p }));
		const seen = [];
		const off = F.onFrameGears((l) => seen.push(l - start));
		for (let t = 0; live.length; t += dt) {
			let moving = 0;
			for (let i = live.length - 1; i >= 0; i--) {
				const p = live[i];
				if (t < p.t0) continue;
				const u = Math.max(0, Math.min(1, (t - p.t0) / p.ms));
				if (u >= 1) {
					const m = (((base + p.links) % 2) + 2) % 2;
					wound += base + p.links - m;
					base = m;
					live.splice(i, 1);
				} else moving += p.links * (p.ease === 'inOut' ? 0.5 - 0.5 * Math.cos(Math.PI * u) : backOut(u));
			}
			F.frameGearsAt(wound + base + moving);
		}
		off();
		let jump = 0;
		for (let i = 1; i < seen.length; i++) jump = Math.max(jump, Math.abs(seen[i] - seen[i - 1]));
		return { travel: F.frameGears.links - start, jump, seen };
	};
	const back = play([{ t0: 0, ms: 500, links: -2, ease: 'inOut' }], 1000 / 60);
	check('the haul: the War Standard\'s run back turns the gears back its 2 links, a sine in and out over 500 ms, never more than 0.11 link a frame, and nothing moves when it is folded off', near(back.travel, -2, 1e-9) && back.jump < 0.11 && back.seen.every((v) => v <= 1e-9 && v >= -2 - 1e-9), `travel ${back.travel.toFixed(4)}, largest step ${back.jump.toFixed(3)}`);
	// a feature as the haul sees it: the trigger's press, the banner's run in, its run back at the first free spin, eight
	// reveals, the banner's second run back at the return to the base game, the next press
	const feature = [{ t0: 0, ms: 1280, links: 4 }, { t0: 1500, ms: 950, links: 3, ease: 'inOut' }, { t0: 3000, ms: 500, links: -2, ease: 'inOut' }];
	for (let i = 0; i < 8; i++) feature.push({ t0: 4000 + i * 1500, ms: 1280, links: 4 });
	feature.push({ t0: 16500, ms: 500, links: -2, ease: 'inOut' }, { t0: 17500, ms: 1280, links: 4 });
	const fr = play(feature, 1000 / 60);
	check('the haul: through a whole feature (the press, the banner\'s run, its two runs back, eight reveals) the travel is the sum of the runs, 39 links, and its only backward runs are the banner\'s two, 2 links each', near(fr.travel, 4 + 3 - 2 + 32 - 2 + 4, 1e-9) && (() => {
		// the backward runs: each fall of the travel under its own high, until it is past that high again, deeper than
		// a press's own overshoot coming back (0.23 link)
		const runs = [];
		let top = fr.seen[0];
		let deep = 0;
		for (const v of fr.seen) {
			if (v >= top) {
				if (deep > 0.25) runs.push(deep);
				top = v;
				deep = 0;
			} else deep = Math.max(deep, top - v);
		}
		if (deep > 0.25) runs.push(deep);
		// (a run back that starts from a press's overshoot is that much deeper: up to 0.23 link)
		return runs.length === 2 && runs.every((r) => r > 1.98 && r < 2.3);
	})(), `travel ${fr.travel.toFixed(3)}`);
}

// ---- 4c. THE UPRIGHT PHONE (src/ui/gear/gearLayout.ts UPRIGHT, uprightLayout) ----
{
	const LS = await import('../src/game/layoutSpec.ts');
	/** the game's own live viewport for an upright phone window (game/stateLayout.ts sets this in the game) */
	const phone = (vw, vh) => {
		const scale = Math.min(vw / 412, vh / 760);
		LS.setPortraitViewportSource(() => ({ masterHeight: vh / scale, cssPerMaster: scale, phone: true }));
	};
	const up = (vw, vh, safe = 0) => (phone(vw, vh), L.uprightLayout(vw, vh, safe));
	const toBox = (c, b) => {
		const nx = Math.max(b.x, Math.min(c.cx, b.x + b.w));
		const ny = Math.max(b.y, Math.min(c.cy, b.y + b.h));
		return c.cx > b.x && c.cx < b.x + b.w && c.cy > b.y && c.cy < b.y + b.h ? -c.R : Math.hypot(c.cx - nx, c.cy - ny) - c.R;
	};
	const meet = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
	const GEARS = ['play', 'turbo', 'auto', 'menu', 'arm'];
	// COPY OF Desktop "Manticore Mayhem/phone_stills_2026-11-22/layout.json" (the running game, CSS px): the board frame's
	// plate, the spin amount plaque, the logo's art
	const STILLS = {
		'402x874': { frame: [-28.7, 296.8, 459.4, 384.8], plaque: [52.7, 657.8, 296.5, 58], logo: [1.1, 96.9, 249.8, 90.3] },
		'402x700': { frame: [-28.7, 204.7, 459.4, 384.8], plaque: [100.1, 566.9, 201.6, 39.4], logo: [1.1, 28.9, 235.8, 85.3] },
		'390x844': { frame: [-27.8, 283.3, 445.7, 373.4], plaque: [51.1, 633.5, 287.6, 56.3], logo: [1.1, 92, 242.3, 87.6] },
		'375x667': { frame: [-26.8, 197.8, 428.6, 359], plaque: [93.4, 535.7, 188.1, 36.8], logo: [1.2, 27.6, 224.7, 81.2] },
		'425x812': { frame: [-30.3, 251.9, 485.7, 406.9], plaque: [55.7, 633.6, 313.4, 61.3], logo: [1, 46.4, 264.1, 95.5] },
	};
	/** everything that must hold of a solved window; returns the faults */
	const faults = (G, safe = 0) => {
		const bad = [];
		const g = G.gears;
		for (const id of GEARS.slice(1)) {
			const c = g[id];
			const p = g[c.parent];
			if (!near(Math.hypot(c.cx - p.cx, c.cy - p.cy), c.pitchR + p.pitchR + L.UPRIGHT.small.clear, 1e-6)) bad.push(`${id} not meshed with ${c.parent}`);
			if (!near((2 * Math.PI * c.pitchR) / c.teeth, G.tooth.pitch, 1e-9)) bad.push(`${id} tooth`);
			if (2 * c.R < L.MIN_PRESS - 0.01) bad.push(`${id} ${f1(2 * c.R)} px`);
		}
		for (const [a, b] of [['menu', 'play'], ['arm', 'play'], ['arm', 'auto'], ['turbo', 'auto'], ['turbo', 'menu'], ['turbo', 'arm']]) if (Math.hypot(g[a].cx - g[b].cx, g[a].cy - g[b].cy) < g[a].R + g[b].R + 0.99) bad.push(`${a} crosses ${b}`);
		if (!near(g.play.cx, G.vw / 2, 1e-9)) bad.push('Play off the center line');
		for (const id of L.PIECES) {
			for (const b of [G.box[id], G.press[id]]) if (b.x < -0.01 || b.y < -0.01 || b.x + b.w > G.vw + 0.01 || b.y + b.h > G.vh + 0.01) bad.push(`${id} off the window`);
		}
		for (const id of [...GEARS, 'down', 'up']) if (G.press[id].y + G.press[id].h > G.vh - safe + 0.01) bad.push(`${id} in the bottom safe area`);
		for (const id of ['down', 'up']) {
			const t = G.press[id];
			if (Math.min(t.w, t.h) < L.MIN_PRESS - 0.01) bad.push(`${id} press ${f1(Math.min(t.w, t.h))}`);
			if (toBox(g.play, t) < L.UPRIGHT.gapSpin - 0.01) bad.push(`${id} ${f1(toBox(g.play, t))} px from the Play's press region`);
			for (const k of GEARS) if (toBox(g[k], t) < 0.99) bad.push(`${id} press box on ${k}`);
		}
		if (meet(G.press.down, G.press.up)) bad.push('< and > press boxes meet');
		for (const id of ['bal', 'amt']) for (const k of GEARS) if (toBox(g[k], G.box[id]) < 0.99) bad.push(`${id} on ${k}`);
		return bad;
	};
	// his phone
	const H = up(402, 874);
	const HIS = { play: [201, 788.3], auto: [106.39, 804.98], turbo: [295.91, 803.16], menu: [51.53, 817.14], arm: [44.1, 761.45] };
	check('upright 402 x 874: the five gears within 0.1 px of his centers; 56 and 23 teeth; 139.6 and 59.8 across', !!H && GEARS.every((id) => near(H.gears[id].cx, HIS[id][0], 0.1) && near(H.gears[id].cy, HIS[id][1], 0.1)) && H.gears.play.teeth === 56 && GEARS.slice(1).every((id) => H.gears[id].teeth === 23) && near(2 * H.gears.play.R, 139.6, 0.1) && near(2 * H.gears.auto.R, 59.84, 0.1), H ? GEARS.map((id) => `${id} ${f1(H.gears[id].cx)}, ${f1(H.gears[id].cy)}`).join('; ') : 'no fit');
	if (H) {
		check('upright 402 x 874: his angles kept (Turbo 98.9, Auto 260, Menu 257.5, Armoury 352.4), scale 1', near(H.k, 1, 1e-5) && H.gears.turbo.deg === 98.9 && H.gears.auto.deg === 260 && H.gears.menu.deg === 257.5 && H.gears.arm.deg === 352.4);
		const mv = { down: H.box.down.x - 273.5, up: H.box.up.x - 372, amt: H.box.amt.x + H.box.amt.w / 2 - 336.77, win: H.box.win.x + H.box.win.w / 2 - 103.55, bal: H.box.bal.y - 825 };
		check('upright 402 x 874: the moves from his places: < 9.7 right, > 5.3 left, the amount 1.5 right, Win 4.2 right, Balance 10.1 down', near(mv.down, 9.7, 0.3) && near(mv.up, -5.33, 0.05) && near(mv.amt, 1.5, 0.3) && near(mv.win, 4.2, 0.3) && near(mv.bal, 10.1, 0.2) && near(H.box.down.y, 727.5, 0.05) && near(H.box.up.y, 726.5, 0.05) && near(H.box.win.y + 13, 731.33, 0.05), JSON.stringify(Object.fromEntries(Object.entries(mv).map(([k, v]) => [k, f1(v)]))));
		check('upright 402 x 874: < is 8 px clear of the Play\'s press region (it was 1.1 px in)', H.gapSpin >= 8 && H.gapSpin < 8.5, `${f1(H.gapSpin)} px`);
		check('upright 402 x 874: his arrangement (Win by the Armoury, the amount upper right, Balance under Turbo)', H.where.win.startsWith('between') && H.where.amt === 'upper right' && H.where.bal === 'under Turbo', JSON.stringify(H.where));
		check('upright 402 x 874: real text: a 9 px word, a 15 px number; the longest US amounts fit Balance and the amount at 15 px, Win is fitted to the 78 px between the gears', H.text.label === 9 && H.text.number === 15 && H.fitW.bal >= 6.83 * 15 - 0.5 && H.fitW.amt >= 4.77 * 15 && near(H.fitW.win, 77.7, 0.5), JSON.stringify(H.fitW));
	}
	// the windows the mock solved. 2026-11-23: the scene under the train is the rule's own now (ui/gear/uprightScene.ts):
	// a window tall enough for the shipped scene and his full band is not touched (his 402 x 874, 390 x 844: the stills'
	// boxes still hold there); a shorter one stands its board higher, so the stills of 402 x 700, 375 x 667 and 425 x 812
	// are of the old scene and the train is judged against the rule's own boxes (the frame plate's top, the plaque's
	// plate, the logo's bottom edge)
	for (const [key, S] of Object.entries(STILLS)) {
		const [vw, vh] = key.split('x').map(Number);
		const G = up(vw, vh);
		check(`upright ${key}: the train fits`, !!G);
		if (!G) continue;
		const bad = faults(G);
		const still = G.scene.lift < 0.5 && near(G.scene.u, 1, 1e-9);
		if (still) {
			const scene = Object.entries(S).map(([n, b]) => [n, { x: b[0], y: b[1], w: b[2], h: b[3] }]);
			for (const id of L.PIECES) for (const [n, b] of scene) if (meet(G.box[id], b) || meet(G.press[id], b)) bad.push(`${id} on the ${n}`);
			check(`upright ${key}: the band's top is the plaque's shadow in the still`, near(G.band.plate, S.plaque[1] + S.plaque[3], 0.15), `${f1(G.band.plate)} against ${f1(S.plaque[1] + S.plaque[3])}`);
		} else {
			for (const id of L.PIECES) for (const b of [G.box[id], G.press[id]]) if (b.y < G.band.plate + 0.99) bad.push(`${id} on the plaque or the board`);
			check(`upright ${key}: the scene moved up ${f1(G.scene.lift)} px for the train (the old still no longer holds)`, G.scene.lift > 20 && G.scene.logo.bottom <= G.scene.artTop - 1.99, `lift ${f1(G.scene.lift)}, share ${G.scene.u.toFixed(3)}, the logo's bottom ${f1(G.scene.logo.bottom)} over the art's top ${f1(G.scene.artTop)}`);
		}
		check(`upright ${key}: meshed, on the window, < and > clear of the Play, nothing on the board, the plaque or the logo`, bad.length === 0, bad.slice(0, 4).join('; ') || `scale ${G.k.toFixed(3)}, Play ${f1(2 * G.gears.play.R)} (${G.gears.play.teeth} teeth), small ${f1(2 * G.gears.auto.R)}, the Armoury at ${G.gears.arm.deg}; Win ${G.where.win}, Balance ${G.where.bal}, the amount ${G.where.amt}`);
	}
	// the bottom safe area: a full screen web view on his phone. 2026-11-23: the scene moves up by the safe area (there is
	// room over the logo on his phone), so the train keeps his size and stands on the safe area's edge (it was shrunk to 0.86)
	const SA = up(402, 874, 34);
	check('upright 402 x 874 with a 34 px bottom safe area: the scene moves up 34 px and the train keeps his size, on the safe area\'s edge', !!SA && near(SA.k, 1, 0.005) && near(SA.scene.lift, 34, 0.5) && faults(SA, 34).length === 0 && SA.gears.play.cy - SA.gears.play.R >= SA.band.top - 0.21, SA ? `scale ${SA.k.toFixed(3)}, lift ${f1(SA.scene.lift)}; ${faults(SA, 34).slice(0, 3).join('; ')}` : 'no fit');
	// the sweep: every phone window from 360 to 440 wide
	{
		let n = 0;
		let dock = 0;
		const bad = [];
		for (let vw = 360; vw <= 440; vw += 4) {
			for (let vh = 600; vh <= 960; vh += 12) {
				for (const safe of [0, 34]) {
					const G = up(vw, vh, safe);
					if (!G) {
						dock += 1;
						continue;
					}
					n += 1;
					const f = faults(G, safe);
					if (f.length) bad.push(`${vw}x${vh} safe ${safe}: ${f[0]}`);
				}
			}
		}
		check(`upright sweep: ${n} phone windows solved (${dock} keep the dock), every one meshed, on the window, out of the safe area, < and > 8 px clear of the Play`, bad.length === 0 && n > 1200 && dock === 0, bad.slice(0, 4).join('; '));
	}
	// the switch
	const bk = (vw, vh, phoneFlag = true, mode) => (phone(vw, vh), L.barKind({ kind: 'portrait', vw, vh, phone: phoneFlag }, mode));
	check('upright switch: phones from 360 wide get the gear bar', ['402x874', '402x700', '390x844', '375x667', '425x812', '360x800'].every((s) => bk(...s.split('x').map(Number)) === 'gear'));
	check('upright switch: 320 x 568 keeps the dock (the chain does not fit), and so does a tablet held upright', bk(320, 568) === 'dock' && up(320, 568) === null && bk(820, 1180, false) === 'dock');
	check('upright switch: the rollback constant gives the dock', bk(402, 874, true, 'dock') === 'dock');
	check('upright switch: the short windows that kept the dock on 2026-11-22 draw the train now (390 x 620, 360 x 740, 375 x 553)', ['390x620', '360x740', '375x553'].every((s) => bk(...s.split('x').map(Number)) === 'gear'));
	// the train's turning: each gear from the gear it meshes with
	{
		const g = H.gears;
		let worst = 0;
		for (let links = 0; links < 6; links += 0.0713) {
			const a = { play: L.playAngle(links, g.play.teeth) };
			for (const id of ['turbo', 'auto', 'menu', 'arm']) {
				const c = g[id];
				const p = g[c.parent];
				a[id] = L.smallAngle(a[c.parent], c.deg, p.teeth, c.teeth);
				const gapP = L.fold(c.deg - a[c.parent] - 180 / p.teeth, 360 / p.teeth) * (Math.PI / 180) * p.pitchR;
				const toothC = L.fold(c.deg + 180 - a[id], 360 / c.teeth) * (Math.PI / 180) * c.pitchR;
				worst = Math.max(worst, Math.abs(gapP + toothC));
			}
		}
		check('upright turning: along the whole chain each gear\'s tooth sits in its parent\'s gap at the pitch point', worst < 0.01, `worst ${worst.toFixed(5)} px`);
	}
}

// ---- 4d. THE SIDEWAYS PHONE (src/ui/gear/gearLayout.ts SIDEWAYS, sidewaysLayout) ----
{
	const side = (vw, vh, safe) => L.sidewaysLayout(vw, vh, safe);
	const toBox = (c, b) => {
		const nx = Math.max(b.x, Math.min(c.cx, b.x + b.w));
		const ny = Math.max(b.y, Math.min(c.cy, b.y + b.h));
		return c.cx > b.x && c.cx < b.x + b.w && c.cy > b.y && c.cy < b.y + b.h ? -c.R : Math.hypot(c.cx - nx, c.cy - ny) - c.R;
	};
	const meet = (a, b) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
	// COPY OF Desktop "Manticore Mayhem/phone_stills_2026-11-22/layout.json" (the running game, CSS px): the board frame's
	// plate and the logo's art on the sideways windows
	const STILLS = {
		'874x402': { frame: [194.1, -10.9, 485.9, 407], logo: [43.7, 27.5, 148.8, 53.8] },
		'844x390': { frame: [186.3, -10.6, 471.4, 394.9], logo: [40.4, 26.6, 144.4, 52.2] },
		'812x425': { frame: [160.7, -1.5, 490.7, 411], logo: [8.8, 37.2, 150.3, 54.4] },
		'667x375': { frame: [132, 11.7, 403.1, 337.6], logo: [7.2, 43.5, 123.5, 44.6] },
	};
	const faults = (G, safe = { t: 0, r: 0, b: 0, l: 0 }) => {
		const bad = [];
		const g = G.gears;
		const chain = [['auto', G.wheel], ['turbo', g.auto], ['play', g.turbo]];
		for (const [id, p] of chain) if (!near(Math.hypot(g[id].cx - p.cx, g[id].cy - p.cy), g[id].pitchR + p.pitchR + L.SIDEWAYS.small.clear, 1e-6)) bad.push(`${id} not meshed`);
		for (const id of ['play', 'auto', 'turbo']) {
			const c = g[id];
			if (c.cx + c.R > G.vw - safe.r - 1.99 || c.cy - c.R < 1.99 || c.cy + c.R > G.vh - 1.99) bad.push(`${id} off the window or in the safe area`);
			if (2 * c.R < L.MIN_PRESS - 0.01) bad.push(`${id} ${f1(2 * c.R)} px`);
			if (!near((2 * Math.PI * c.pitchR) / c.teeth, G.tooth.pitch, 1e-9)) bad.push(`${id} tooth`);
		}
		if (g.play.cx - g.play.R < G.scene.plate.x1 + 1.99 || g.play.cx <= g.turbo.cx) bad.push('the Play not right of the plate and of Turbo');
		for (const [a, b] of [[g.turbo, G.wheel], [g.play, G.wheel], [g.play, g.auto]]) if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.R + b.R + 0.99) bad.push('a gear crosses one it does not mesh with');
		for (const id of L.PIECES) for (const b of [G.box[id], G.press[id]]) if (b.x < safe.l - 0.01 || b.y < -0.01 || b.x + b.w > G.vw - safe.r + 0.01 || b.y + b.h > G.vh - safe.b + 0.01) bad.push(`${id} off the window or in a safe area`);
		for (const id of ['down', 'up', 'menu', 'arm']) if (Math.min(G.press[id].w, G.press[id].h) < L.MIN_PRESS - 0.01) bad.push(`${id} press ${f1(Math.min(G.press[id].w, G.press[id].h))}`);
		if (meet(G.press.down, G.press.up)) bad.push('< and > press boxes overlap');
		for (const id of ['down', 'up', 'amt']) for (const k of ['play', 'auto', 'turbo']) if (toBox(g[k], G.press[id]) < 1) bad.push(`${id} on ${k}`);
		for (const id of ['menu', 'arm', 'win', 'bal']) if (G.box[id].x + G.box[id].w > G.scene.plate.x0 - 5.99) bad.push(`${id} on the board frame`);
		for (const id of ['down', 'up', 'amt']) if (G.press[id].x < G.scene.plate.x1 + 3.99) bad.push(`${id} on the board frame`);
		if (meet(G.box.menu, G.box.arm) || meet(G.box.win, G.box.bal) || G.box.win.y < G.box.menu.y + G.box.menu.h) bad.push('left column pieces meet');
		if (G.coverPx / G.scene.boardK > L.SIDEWAYS.cover + 0.51) bad.push(`the Play ${f1(G.coverPx)} px under his top edge`);
		return bad;
	};
	// his phone: corey_phone_sideways_r3_2026-11-22.json
	const H = side(874, 402);
	const HIS = { auto: [698.44, 27.85], turbo: [736.48, 50.07], play: [809.71, 55.71] };
	check('sideways 874 x 402: his chain (the wheel, Auto 90.4, Turbo 120.3, the Play 94.4), every gear within 0.5 px of his place; 40 and 17 teeth; 106.7 and 47.9 across', !!H && ['auto', 'turbo', 'play'].every((id) => Math.hypot(H.gears[id].cx - HIS[id][0], H.gears[id].cy - HIS[id][1]) < 0.5) && H.gears.auto.deg === 90.4 && H.gears.turbo.deg === 120.3 && H.gears.play.deg === 94.4 && H.gears.play.teeth === 40 && H.gears.auto.teeth === 17 && near(2 * H.gears.play.R, 106.73, 0.05) && near(2 * H.gears.auto.R, 47.94, 0.05) && H.playScale === 1, H ? ['auto', 'turbo', 'play'].map((id) => `${id} ${f1(H.gears[id].cx)}, ${f1(H.gears[id].cy)}`).join('; ') : 'no fit');
	if (H) {
		const mv = { upX: H.box.up.x - 838.67, upY: H.box.up.y - 368.33, downX: H.box.down.x - 704.13, downY: H.box.down.y - 368.33, amtX: H.box.amt.x - 736.47, amtY: H.box.amt.y - 367 };
		check('sideways 874 x 402: the moves from his export: > 1.3 px left, < and > 3 px up, the amount with them', near(mv.upX, -1.33, 0.05) && near(mv.upY, -3, 0.05) && near(mv.downX, 0, 0.05) && near(mv.downY, -3, 0.05) && near(mv.amtX, -0.67, 0.1) && near(mv.amtY, -3, 0.05), JSON.stringify(Object.fromEntries(Object.entries(mv).map(([k, v]) => [k, f1(v)]))));
		const st = { menu: [19.35, 94.9, 72.7, 80.6], arm: [102.05, 94.9, 72.7, 80.6], bal: [6, 361.44, 174.6, 37.5], win: [6, 319.4, 181.1, 40] };
		check('sideways 874 x 402: the standards, Win and Balance within 1.1 px of his places', Object.entries(st).every(([id, b]) => near(H.box[id].x, b[0], 1.1) && near(H.box[id].y, b[1], 1.1) && near(H.box[id].w, b[2], 1.1) && near(H.box[id].h, b[3], 1.1)), Object.keys(st).map((id) => `${id} ${f1(H.box[id].x)}, ${f1(H.box[id].y)}, ${f1(H.box[id].w)} x ${f1(H.box[id].h)}`).join('; '));
		check('sideways 874 x 402: real text: 9 px words; Balance 19.8 px, Win 23 px, the amount 16.8 px; the longest US amounts fit', H.text.label === 9 && near(H.text.bal, 19.8, 0.1) && near(H.text.win, 23, 0.1) && H.fitW.bal >= 6.83 * H.text.bal && H.fitW.win >= 6.83 * H.text.win && H.fitW.amt >= 4.77 * H.text.number, JSON.stringify(H.fitW));
		// THE TOP LINE: the studio name as the dock draws it (ui/ClockStrip.svelte: right 14, top 10, 12 px type, 133.8 wide,
		// master px) is under his Play gear, which is why ui/ChromePhone.svelte draws it at the left under the clock line
		const fit = H.fit;
		const strip = { x: (874 - 1480 * fit) / 2 + (1480 - 14 - 133.8) * fit, y: (402 - 740 * fit) / 2 + 10 * fit, w: 133.8 * fit, h: 15 * fit };
		check('sideways 874 x 402: his Play gear stands on the top right studio name (so that line is drawn at the left instead)', toBox(H.gears.play, strip) < -5, `${f1(-toBox(H.gears.play, strip))} px in`);
	}
	// the sizes: his proportion wherever his own cover of the tail allows, no jump between near phones
	const WANT = { '874x402': [106.7, 1], '852x393': [104.4, 1], '844x390': [103.6, 1], '812x425': [100.1, 0.94], '667x375': [86.4, 0.98] };
	// (2026-11-23, 812 x 425: 107.8 until Turbo was kept under Auto wherever that costs the Play 0.06 of its size or less)
	for (const [key, [across, scale]] of Object.entries(WANT)) {
		const [vw, vh] = key.split('x').map(Number);
		const G = side(vw, vh);
		check(`sideways ${key}: the Play ${across} px across (${scale} of his proportion)`, !!G && near(2 * G.gears.play.R, across, 0.15) && near(G.playScale, scale, 0.001), G ? `${f1(2 * G.gears.play.R)} px, ${(2 * G.gears.play.R / vh).toFixed(3)} of the height, angles ${G.gears.auto.deg}, ${G.gears.turbo.deg}, ${G.gears.play.deg}, ${f1(G.coverPx)} px under his top edge, the amount ${G.how}` : 'no fit');
		if (!G) continue;
		const bad = faults(G);
		const S = STILLS[key];
		if (S) {
			const fr = { x: S.frame[0], y: S.frame[1], w: S.frame[2], h: S.frame[3] };
			const lg = { x: S.logo[0], y: S.logo[1], w: S.logo[2], h: S.logo[3] };
			for (const id of ['menu', 'arm', 'win', 'bal', 'down', 'up', 'amt']) if (meet(G.press[id], fr) || meet(G.box[id], fr)) bad.push(`${id} on the board frame in the still`);
			for (const id of L.PIECES) if (meet(G.box[id], lg)) bad.push(`${id} on the logo`);
			if (G.gears.play.cx - G.gears.play.R < fr.x + fr.w + 1.5) bad.push('the Play on the plate in the still');
		}
		check(`sideways ${key}: meshed from the frame's wheel, on the window, nothing on the board frame or the logo, < and > apart`, bad.length === 0, bad.slice(0, 4).join('; '));
	}
	check('sideways: 874 x 402, 852 x 393 and 844 x 390 draw his chain at his proportion (no jump)', [[874, 402], [852, 393], [844, 390]].every(([vw, vh]) => { const G = side(vw, vh); return G.playScale === 1 && G.gears.auto.deg === 90.4 && near((2 * G.gears.play.R) / vh, 0.2655, 0.002); }));
	// (checked once against the mock's own shapes of him per window, build/creature_dist.json, 2026-11-22: the Play reaches
	// 11.4 px into his tallest pose at 874 x 402 as built here (his export's own place: 9.4), 5.8 at 844 x 390, and is
	// clear of every shape at 812 x 425 and 667 x 375; Auto and Turbo are clear everywhere)
	// the side safe areas, and a sweep
	const R59 = side(874, 402, { t: 0, r: 59, b: 21, l: 59 });
	check('sideways 874 x 402 with 59 px side safe areas and 21 px at the bottom: the chain bends and the Play is 0.9 of his', !!R59 && near(R59.playScale, 0.9, 0.021) && faults(R59, { t: 0, r: 59, b: 21, l: 59 }).length === 0, R59 ? `${f1(2 * R59.gears.play.R)} px, the amount ${R59.how}; ${faults(R59, { t: 0, r: 59, b: 21, l: 59 }).slice(0, 3).join('; ')}` : 'no fit');
	{
		let n = 0;
		let dock = 0;
		const bad = [];
		for (let vw = 640; vw <= 960; vw += 8) {
			for (let vh = 340; vh <= 440; vh += 10) {
				for (const safe of [{ t: 0, r: 0, b: 0, l: 0 }, { t: 0, r: 47, b: 21, l: 47 }, { t: 0, r: 59, b: 21, l: 0 }]) {
					const G = side(vw, vh, safe);
					if (!G) {
						dock += 1;
						continue;
					}
					n += 1;
					const f = faults(G, safe);
					if (f.length) bad.push(`${vw}x${vh} r${safe.r}: ${f[0]}`);
				}
			}
		}
		check(`sideways sweep: ${n} windows solved (${dock} keep the dock), every one meshed, inside the safe areas, < and > never overlapping`, bad.length === 0 && n > 800, bad.slice(0, 4).join('; '));
	}
	const bk = (vw, vh, mode) => L.barKind({ kind: 'phone', vw, vh, phone: true }, mode);
	check('sideways switch: 874 x 402, 844 x 390, 812 x 425 and 667 x 375 get the gear bar; 568 x 320 keeps the dock; the rollback gives the dock', ['874x402', '844x390', '812x425', '667x375'].every((s2) => bk(...s2.split('x').map(Number)) === 'gear') && bk(568, 320) === 'dock' && side(568, 320) === null && bk(874, 402, 'dock') === 'dock');
	const PL = side(800, 450);
	check('sideways switch: Stake\'s Popout L, 800 x 450 (the game lays it out as a sideways phone), fits the chain with every press at 44 px; Popout S, 400 x 225, keeps the dock', !!PL && faults(PL).length === 0 && PL.text.label === 9 && PL.text.word >= 8 && bk(800, 450) === 'gear' && side(400, 225) === null && bk(400, 225) === 'dock', PL ? `Play ${f1(2 * PL.gears.play.R)} px, small gears ${f1(2 * PL.gears.auto.R)} px, the amount ${PL.how}, standards ${f1(PL.box.menu.w)} px wide` : 'no fit');
	check('sideways switch: 667 x 375 with a 59 px right safe area keeps the dock (no chain fits; the mock overlapped < and > there)', side(667, 375, { t: 0, r: 59, b: 0, l: 59 }) === null);
	// the chain's turning from the frame's wheel
	{
		const g = H.gears;
		let worst = 0;
		for (let links = 0; links < 6; links += 0.0713) {
			const a = { wheel: L.wheelAngle(links) };
			for (const [id, pid, p] of [['auto', 'wheel', H.wheel], ['turbo', 'auto', g.auto], ['play', 'turbo', g.turbo]]) {
				const c = g[id];
				a[id] = L.smallAngle(a[pid], c.deg, p.teeth, c.teeth);
				const gapP = L.fold(c.deg - a[pid] - 180 / p.teeth, 360 / p.teeth) * (Math.PI / 180) * p.pitchR;
				const toothC = L.fold(c.deg + 180 - a[id], 360 / c.teeth) * (Math.PI / 180) * c.pitchR;
				worst = Math.max(worst, Math.abs(gapP + toothC));
			}
		}
		// (0.03 px: the frame wheel's own tooth pitch is half a percent over the gears', so its tooth and Auto's gap part by
		// 0.02 px at the edges of a tooth's travel)
		check('sideways turning: from the frame wheel\'s own tooth (20.6 degrees at rest, 45 a link) each gear\'s tooth sits in its parent\'s gap', worst < 0.03 && near(L.wheelAngle(0), 20.578, 1e-9) && near(L.wheelAngle(1) - L.wheelAngle(0), 45, 1e-9), `worst ${worst.toFixed(5)} px`);
	}
}

// ---- 4f. THE PHONE SIZE SURVEY (2026-11-23): every frame a phone browser gives the game ----
// COPY OF Desktop "Competitor Assets/_layout_survey/phone_browser_sizes_2026-11-23": sizes.json `captures` (the frame
// the game gets, CSS px; MEAS = measured off Corey's screenshots of his 440 x 956 iPhone, DERI = his bar heights on a
// published screen, ESTI = default bar heights) and, from measures.json, what web-sdk d5cb3dad drew there before this
// rule (the bar, the Play or Spin's diameter and the Auto key's, CSS px) and the layout the game chose.
// [w, h, upright or sideways, mark, phone, host, bar before, Play before, small before, layout]
// One row more than the survey's: 832 x 376, Stake full screen sideways on his phone (Corey 2026-11-23, off a ruler).
{
	const FRAMES = [
	[333, 487, 'u', 'ESTI', 's26', 'stkFrame', 'dock', 49.8, 26.5, 'portrait'],
	[333, 547, 'u', 'ESTI', 'zfold7', 'stkFrame', 'dock', 55, 29.1, 'portrait'],
	[348, 373, 'u', 'DERI', 'iphonese', 'stkFrame', 'dock', 43.5, 23.1, 'portrait'],
	[348, 397, 'u', 'DERI', 'iphonese', 'stkFrame', 'dock', 43.5, 23.1, 'portrait'],
	[348, 470, 'u', 'ESTI', 'iphonese', 'stkFrame', 'dock', 48.1, 25.6, 'portrait'],
	[348, 490, 'u', 'ESTI', 'iphonese', 'stkFrame', 'dock', 50.4, 26.8, 'portrait'],
	[360, 780, 'u', 'ESTI', 's26', 'stkFull', 'gear', 125, 53.5, 'portrait'],
	[360, 840, 'u', 'ESTI', 'zfold7', 'stkFull', 'gear', 125, 53.5, 'portrait'],
	[375, 442, 'u', 'DERI', 'iphonese', 'stgBoth', 'dock', 45.2, 24, 'portrait'],
	[375, 466, 'u', 'DERI', 'iphonese', 'stgBoth', 'dock', 47.8, 25.4, 'portrait'],
	[375, 488, 'u', 'DERI', 'iphonese', 'stgNoTop', 'dock', 50, 26.6, 'portrait'],
	[375, 504, 'u', 'DERI', 'iphone17pro', 'stkFrame', 'dock', 51.6, 27.4, 'portrait'],
	[375, 512, 'u', 'DERI', 'iphonese', 'stgNoTop', 'dock', 52.6, 27.9, 'portrait'],
	[375, 528, 'u', 'DERI', 'iphone17pro+iphonese', 'stkFrame+stkFull', 'dock', 54.2, 28.8, 'portrait'],
	[375, 539, 'u', 'ESTI', 'iphonese', 'stgBoth', 'dock', 55.1, 29.3, 'portrait'],
	[375, 554, 'u', 'DERI', 'iphonese', 'stkFull', 'dock', 56.7, 30.1, 'portrait'],
	[375, 559, 'u', 'ESTI', 'iphonese', 'stgBoth', 'dock', 57.4, 30.5, 'portrait'],
	[375, 585, 'u', 'ESTI', 'iphonese', 'stgNoTop', 'dock', 60.3, 32, 'portrait'],
	[375, 605, 'u', 'ESTI', 'iphonese', 'stgNoTop', 'dock', 62, 32.7, 'portrait'],
	[375, 627, 'u', 'ESTI', 'iphonese', 'stkFull', 'gear', 64.8, 46.8, 'portrait'],
	[375, 635, 'u', 'ESTI', 'iphone17pro', 'stkFrame', 'gear', 67, 46.8, 'portrait'],
	[375, 647, 'u', 'ESTI', 'iphonese', 'stkFull', 'gear', 73.8, 46.8, 'portrait'],
	[375, 717, 'u', 'DERI', 'iphone17pro', 'stkFrame', 'gear', 89.6, 46.8, 'portrait'],
	[385, 598, 'u', 'ESTI', 's26ultra', 'stkFrame', 'dock', 61.3, 32.5, 'portrait'],
	[402, 573, 'u', 'DERI', 'iphone17pro', 'stgBoth', 'dock', 58.9, 31.3, 'portrait'],
	[402, 597, 'u', 'DERI', 'iphone17pro', 'stgBoth', 'dock', 61.2, 32.5, 'portrait'],
	[402, 619, 'u', 'DERI', 'iphone17pro', 'stgNoTop', 'dock', 63.4, 33.7, 'portrait'],
	[402, 643, 'u', 'DERI', 'iphone17pro', 'stgNoTop', 'dock', 66.4, 35.1, 'portrait'],
	[402, 661, 'u', 'DERI', 'iphone17pro', 'stkFull', 'gear', 64.6, 45.3, 'portrait'],
	[402, 685, 'u', 'DERI', 'iphone17pro', 'stkFull', 'gear', 74.3, 45.3, 'portrait'],
	[402, 704, 'u', 'ESTI', 'iphone17pro', 'stgBoth', 'gear', 84, 45.3, 'portrait'],
	[402, 750, 'u', 'ESTI', 'iphone17pro', 'stgNoTop', 'gear', 88.8, 45.3, 'portrait'],
	[402, 786, 'u', 'DERI', 'iphone17pro', 'stgBoth', 'gear', 103.3, 45.3, 'portrait'],
	[402, 792, 'u', 'ESTI', 'iphone17pro', 'stkFull', 'gear', 105.7, 45.3, 'portrait'],
	[402, 832, 'u', 'DERI', 'iphone17pro', 'stgNoTop', 'gear', 125, 55, 'portrait'],
	[402, 874, 'u', 'DERI', 'iphone17pro', 'stkFull', 'gear', 139.5, 59.8, 'portrait'],
	[412, 891, 'u', 'ESTI', 's26ultra', 'stkFull', 'gear', 140.5, 61.3, 'portrait'],
	[413, 586, 'u', 'MEAS', 'iphone17promax', 'stkFrame', 'dock', 60.1, 31.9, 'portrait'],
	[439, 308, 'u', 'ESTI', 'iphoneduo', 'stkFrame', 'dock', 43.9, 18, 'phone'],
	[440, 655, 'u', 'MEAS', 'iphone17promax', 'stgBoth', 'dock', 67.1, 35.6, 'portrait'],
	[440, 679, 'u', 'MEAS', 'iphone17promax', 'stgBoth', 'dock', 69.6, 37, 'portrait'],
	[440, 701, 'u', 'MEAS', 'iphone17promax', 'stgNoTop', 'dock', 72.7, 38.4, 'portrait'],
	[440, 725, 'u', 'MEAS', 'iphone17promax', 'stgNoTop', 'gear', 70.8, 46.9, 'portrait'],
	[440, 742, 'u', 'MEAS', 'iphone17promax', 'stkFull', 'gear', 78.7, 46.9, 'portrait'],
	[440, 868, 'u', 'MEAS', 'iphone17promax', 'stgBoth', 'gear', 118.3, 49.6, 'portrait'],
	[440, 956, 'u', 'DERI', 'iphone17promax', 'stkFull', 'gear', 150.1, 65.5, 'portrait'],
	[466, 678, 'u', 'ESTI', 'iphoneduo', 'stkFull', 'dock', 69.4, 36.9, 'portrait'],
	[626, 688, 'u', 'ESTI', 'iphoneduo', 'stgBoth', 'dock', 68.8, 28.8, 'portrait'],
	[626, 890, 'u', 'ESTI', 'iphoneduo', 'stkFull', 'dock', 78.3, 32.8, 'portrait'],
	[750, 568, 'u', 'ESTI', 'zfold7', 'stgBoth', 'dock', 49.6, 31.8, 'landscape'],
	[750, 832, 'u', 'ESTI', 'zfold7', 'stkFull', 'dock', 72.6, 30.4, 'portrait'],
	[667, 311, 's', 'DERI', 'iphonese', 'stgBoth+stgNoTop+stkFull', 'dock', 62.2, 25.5, 'phone'],
	[667, 325, 's', 'ESTI', 'iphonese', 'stgBoth+stgNoTop+stkFull', 'dock', 65, 26.7, 'phone'],
	[667, 355, 's', 'ESTI', 'iphonese', 'stgBoth+stgNoTop+stkFull', 'gear', 84.3, 48.3, 'phone'],
	[667, 375, 's', 'DERI', 'iphonese', 'stgBoth+stgNoTop+stkFull', 'gear', 86.4, 48.3, 'phone'],
	[678, 402, 's', 'ESTI', 'iphoneduo', 'stgBoth+stgNoTop+stkFull', 'gear', 90, 49, 'phone'],
	[678, 466, 's', 'ESTI', 'iphoneduo', 'stgBoth+stgNoTop+stkFull', 'gear', 90, 49, 'phone'],
	[748, 256, 's', 'ESTI', 's26', 'stgBoth+stgNoTop+stkFull', 'dock', 51.2, 21, 'phone'],
	[780, 360, 's', 'ESTI', 's26', 'stkFull', 'gear', 93.3, 47.5, 'phone'],
	[808, 256, 's', 'ESTI', 'zfold7', 'stgBoth+stgNoTop+stkFull', 'dock', 51.2, 21, 'phone'],
	[832, 574, 's', 'ESTI', 'zfold7', 'stgBoth+stgNoTop+stkFull', 'dock', 55, 35.3, 'landscape'],
	[832, 750, 's', 'ESTI', 'zfold7', 'stkFull', 'dock', 68.8, 28.8, 'portrait'],
	[840, 360, 's', 'ESTI', 'zfold7', 'stkFull', 'gear', 95.6, 47.5, 'phone'],
	[859, 308, 's', 'ESTI', 's26ultra', 'stgBoth+stgNoTop+stkFull', 'dock', 61.6, 25.3, 'phone'],
	[874, 338, 's', 'DERI', 'iphone17pro', 'stgBoth+stgNoTop+stkFull', 'dock', 67.6, 27.7, 'phone'],
	[874, 352, 's', 'ESTI', 'iphone17pro', 'stgBoth+stgNoTop+stkFull', 'gear', 93.5, 48.7, 'phone'],
	[874, 382, 's', 'ESTI', 'iphone17pro', 'stgBoth+stgNoTop+stkFull', 'gear', 101.4, 48, 'phone'],
	[874, 402, 's', 'DERI', 'iphone17pro', 'stgBoth+stgNoTop+stkFull', 'gear', 106.7, 47.9, 'phone'],
	[890, 512, 's', 'ESTI', 'iphoneduo', 'stgBoth+stgNoTop+stkFull', 'dock', 58.8, 37.7, 'landscape'],
	[890, 626, 's', 'ESTI', 'iphoneduo', 'stgBoth+stgNoTop+stkFull', 'dock', 58.8, 37.7, 'landscape'],
	[891, 412, 's', 'ESTI', 's26ultra', 'stkFull', 'gear', 109.4, 49.1, 'phone'],
	[956, 376, 's', 'MEAS', 'iphone17promax', 'stgBoth+stgNoTop+stkFull', 'gear', 99.8, 47.2, 'phone'],
	[956, 440, 's', 'DERI', 'iphone17promax', 'stgBoth+stgNoTop+stkFull', 'gear', 116.8, 52.5, 'phone'],
		[832, 376, 's', 'MEAS', 'iphone17promax', 'stkFull', null, null, null, 'phone'],
	];
	const LS = await import('../src/game/layoutSpec.ts');
	const US = await import('../src/ui/gear/uprightScene.ts');
	const MF = await import('../src/ui/armoury/menuFrame.ts');
	const ARM = (await import('../src/game/constants.ts')).ARMOURY.layout;
	const toBox = (c, b) => {
		const nx = Math.max(b.x, Math.min(c.cx, b.x + b.w));
		const ny = Math.max(b.y, Math.min(c.cy, b.y + b.h));
		return c.cx > b.x && c.cx < b.x + b.w && c.cy > b.y && c.cy < b.y + b.h ? -c.R : Math.hypot(c.cx - nx, c.cy - ny) - c.R;
	};
	const meet = (a, b) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
	const pad = (v, n) => String(v).padEnd(n);
	const armFit = [];
	const armMin = [];
	const folded = [];
	const table = [];
	const dock = [];
	const bad = [];
	let gearN = 0;
	for (const [vw, vh, o, mark, phoneId, host, barWas, playWas, smallWas, kind] of FRAMES) {
		const key = `${vw}x${vh}`;
		const isPhone = Math.min(vw, vh) <= 480;
		const fail = (why) => bad.push(`${key}: ${why}`);
		if (kind === 'portrait') {
			const scale = Math.min(vw / 412, vh / 760);
			LS.setPortraitViewportSource(() => ({ masterHeight: vh / scale, cssPerMaster: scale, phone: isPhone }));
			const bar = L.barKind({ kind: 'portrait', vw, vh, phone: isPhone, safeBottom: 0 });
			const G = bar === 'gear' ? L.uprightLayout(vw, vh, 0) : null;
			if (!G) {
				const why = !isPhone ? 'a tablet held upright (an unfolded folding phone): the dock, as every tablet' : vw < L.UPRIGHT_MIN_VW ? `under ${L.UPRIGHT_MIN_VW} px wide: the chain of five gears does not fit the width` : (L.uprightLayout(vw, vh, 0), L.uprightWhy.last);
				dock.push([key, why]);
				table.push(`${pad(key, 9)} ${pad(mark, 5)} dock  ${pad(barWas === 'gear' ? `gear ${playWas}` : `dock ${playWas}`, 11)}  ${why}`);
				// the brief's floor: every phone frame from 360 wide draws the train
				// the brief's floor: every phone frame from 360 wide and 480 tall draws the train (375 x 442 and 375 x 466, an
				// iPhone SE under both staging bars: a 97 to 103 px band has no row for Win beside the train with its long label)
				if (isPhone && vw >= L.UPRIGHT_MIN_VW && vh >= 480) fail(`a phone frame from ${L.UPRIGHT_MIN_VW} wide keeps the dock (${why})`);
				continue;
			}
			gearN += 1;
			const S = US.uprightScene(vw, vh, 0);
			const g = G.gears;
			const GEARS = ['play', 'turbo', 'auto', 'menu', 'arm'];
			// in the frame; press boxes of 44 px; the arrows clear of every gear and 8 px clear of the Play; the readouts in the band
			for (const id of L.PIECES) for (const b of [G.box[id], G.press[id]]) if (b.x < -0.01 || b.y < -0.01 || b.x + b.w > vw + 0.01 || b.y + b.h > vh + 0.01) fail(`${id} outside the frame`);
			for (const id of [...GEARS.slice(1), 'down', 'up']) if (Math.min(G.press[id].w, G.press[id].h) < L.MIN_PRESS - 0.01) fail(`${id} press box ${f1(Math.min(G.press[id].w, G.press[id].h))} px`);
			for (const id of GEARS.slice(1)) {
				const c = g[id];
				const q = g[c.parent];
				if (!near(Math.hypot(c.cx - q.cx, c.cy - q.cy), c.pitchR + q.pitchR + L.UPRIGHT.small.clear, 1e-6)) fail(`${id} not meshed with ${c.parent}`);
			}
			for (const [a, b] of [['menu', 'play'], ['arm', 'play'], ['arm', 'auto'], ['turbo', 'auto'], ['turbo', 'menu'], ['turbo', 'arm']]) if (Math.hypot(g[a].cx - g[b].cx, g[a].cy - g[b].cy) < g[a].R + g[b].R + 0.99) fail(`${a} crosses ${b}`);
			if (!near(g.play.cx, vw / 2, 1e-9)) fail('the Play off the center line');
			for (const id of ['down', 'up']) {
				if (toBox(g.play, G.press[id]) < L.UPRIGHT.gapSpin - 0.01) fail(`${id} ${f1(toBox(g.play, G.press[id]))} px from the Play's press region`);
				for (const k of GEARS) if (toBox(g[k], G.press[id]) < 0.99) fail(`${id}'s press box on ${k}`);
				for (const r of ['win', 'bal']) if (meet(G.press[id], G.box[r])) fail(`${id}'s press box on ${r}`);
			}
			if (meet(G.press.down, G.press.up)) fail('the two arrows\' press boxes overlap');
			for (const id of ['bal', 'amt']) for (const k of GEARS) if (toBox(g[k], G.box[id]) < 0.99) fail(`${id} on ${k}`);
			for (const [a, b] of [['win', 'bal'], ['win', 'amt'], ['bal', 'amt']]) if (meet(G.box[a], G.box[b])) fail(`${a} on ${b}`);
			for (const id of ['win', 'bal', 'amt', 'down', 'up']) if (G.press[id].y < G.band.plate + 0.99) fail(`${id} is not in the bottom section (over the plaque's plate)`);
			if (!(G.where.win !== 'under the logo' && G.where.bal !== 'under the logo')) fail('a readout under the logo');
			// the text floor: 9 px words; each number's fit holds its longest US amount at 9 px or more; SPIN and the hub's count
			if (G.text.label < L.TEXT_FLOOR || G.fitW.win < 6.83 * L.TEXT_FLOOR - 0.5 || G.fitW.bal < 6.83 * L.TEXT_FLOOR - 0.5 || G.fitW.amt < 4.77 * L.TEXT_FLOOR || G.text.spin < L.TEXT_FLOOR || G.text.count < L.TEXT_FLOOR || G.text.sub < L.TEXT_FLOOR) fail(`text under ${L.TEXT_FLOOR} px (${JSON.stringify(G.fitW)}, SPIN ${f1(G.text.spin)})`);
			// (1) every readout's box inside the frame by UPRIGHT.readEdge: its number's ink 4 px clear of the bottom edge
			for (const id of ['win', 'bal', 'amt']) {
				const b = G.box[id];
				if (b.y + b.h > vh - L.UPRIGHT.readEdge.bottom + 0.01 || b.x < L.UPRIGHT.readEdge.side - 0.01 || b.x + b.w > vw - L.UPRIGHT.readEdge.side + 0.01) fail(`${id}'s box ${f1(vh - b.y - b.h)} px from the bottom edge, ${f1(Math.min(b.x, vw - b.x - b.w))} from a side`);
			}
			// (3) the longest labels (FREE SPINS WIN in a feature, BASE AMOUNT in a replay), as tracked here: under no gear,
			// inside the frame, on no arrow's press box and not on the other readout
			for (const id of ['win', 'bal']) {
				const lb = G.label[id];
				if (lb.track < L.UPRIGHT.label.trackMin - 1e-9 || lb.track > L.UPRIGHT.label.track + 1e-9) fail(`${id}'s long label tracked ${lb.track.toFixed(3)} em`);
				if (lb.box.x < 2 || lb.box.x + lb.box.w > vw - 2) fail(`${id}'s long label outside the frame`);
				for (const k of GEARS) if (toBox(g[k], lb.box) < 0.49) fail(`${id}'s long label under ${k} (${f1(toBox(g[k], lb.box))} px)`);
				for (const o of ['down', 'up']) if (meet(lb.box, G.press[o])) fail(`${id}'s long label on ${o}'s press box`);
				if (meet(lb.box, G.box[id === 'win' ? 'bal' : 'win'])) fail(`${id}'s long label on the other readout`);
			}
			// (2) THE ARMOURY open: whatever its tray and plate need between 380 and 470 design px (the room at 440 x 742,
			// where it fits, is 458), the menu ends above the bar's top (ui/armoury/menuFrame.ts fitPortrait), every lit
			// piece (the amount, its two arrows, Balance) is at or under that top, and the menu is never under fitMin
			{
				const anchors = { hudTop: G.hudTop, clockTop: S.top0 + 10 * S.fit, clockBottom: S.top0 + 25 * S.fit, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
				const F0 = MF.menuFrame({ kind: 'portrait', phone: true, vw, vh, scale: S.fit, master: { width: 412, height: 760 }, fitWidth: Math.max(412, vw / S.fit) }, ARM);
				let k460 = 1;
				for (const need of [380, 420, 460, 470]) {
					const F = MF.fitPortrait(F0, anchors, need, ARM);
					const d = MF.designAnchors(F, anchors, ARM);
					const k = F.u / F0.u;
					if (need === 460) k460 = k;
					if (k > ARM.portrait.fitMin + 1e-6 && d.contentBottom - d.contentTop - MF.closeRoom(d, ARM) < need - 0.5) fail(`the Armoury's ${need} px of tray and plate and the close key's room do not fit over the bar (room ${f1(d.contentBottom - d.contentTop)} at ${k.toFixed(2)})`);
					if (d.contentBottom * F.u > G.hudTop - ARM.portrait.gapToHud * F.u + 0.01) fail('the Armoury ends under the bar\'s top');
					if (Math.abs(F.contentLeft * 2 + F.contentWidth - F.width) > 0.01 || Math.abs(F.contentWidth - F0.contentWidth) > 0.01) fail('the Armoury\'s column is not centered at its own width');
				}
				for (const id of ['amt', 'bal']) if (G.box[id].y < G.hudTop - 0.01) fail(`the lit ${id} is over the bar's top`);
				for (const id of ['down', 'up']) if (G.press[id].y < G.hudTop - 0.01) fail(`the lit ${id} is over the bar's top`);
				armFit.push(`${key} ${k460.toFixed(2)}`);
				if (k460 <= ARM.portrait.fitMin + 1e-6) armMin.push(key);
			}
			// the scene: the board's plaque over the band, the logo over the frame art, the tail barely past the top edge
			if (S.creature.tailOver > US.UPRIGHT_SCENE.tailOver + 0.01) fail(`the idle tail tip ${f1(S.creature.tailOver)} px past the top edge`);
			if (S.logo.bottom > S.artTop - US.UPRIGHT_SCENE.logoGap + 0.01 && S.lift > 0.5) fail('the logo on the frame art');
			if (S.board > 1 + 1e-9 || S.creature.scale > 1 + 1e-9) fail('the scene drawn larger than shipped');
			table.push(`${pad(key, 9)} ${pad(mark, 5)} train ${pad(barWas === 'gear' ? `gear ${playWas}` : `dock ${playWas}`, 11)} Play ${pad(f1(2 * g.play.R), 6)} small ${pad(f1(2 * g.auto.R), 5)} (was ${pad(smallWas, 5)}) board ${S.board.toFixed(2)} Manticore ${S.creature.scale.toFixed(2)} tail ${pad(f1(S.creature.tailOver), 4)} up ${pad(f1(S.lift), 5)} Win ${G.where.win === 'between the Armoury and the Play gear' ? 'his place' : G.where.win}, Balance ${G.where.bal}, amount ${G.where.amt}`);
		} else if (kind === 'phone') {
			const view = { kind: 'phone', vw, vh, safe: { t: 0, r: 0, b: 0, l: 0 }, touch: true };
			const G = L.sidewaysBarLayout(view);
			if (!G) {
				L.sidewaysLayout(vw, vh, L.sidewaysSafe(view));
				dock.push([key, L.sidewaysWhy.last]);
				table.push(`${pad(key, 9)} ${pad(mark, 5)} dock  ${pad(barWas === 'gear' ? `gear ${playWas}` : `dock ${playWas}`, 11)}  ${L.sidewaysWhy.last}`);
				if (vw >= L.SIDEWAYS_MIN.vw && vh >= 330) fail(`a sideways frame from 330 tall keeps the dock (${L.sidewaysWhy.last})`);
				continue;
			}
			gearN += 1;
			const g = G.gears;
			const strip = L.SIDEWAYS.homeStrip;
			for (const id of L.PIECES) for (const b of [G.box[id], G.press[id]]) if (b.x < -0.01 || b.y < -0.01 || b.x + b.w > vw + 0.01 || b.y + b.h > vh + 0.01) fail(`${id} outside the frame`);
			// THE HOME INDICATOR STRIP: nothing pressed or read in the bottom 20 px
			for (const id of L.PIECES) for (const b of [G.box[id], G.press[id]]) if (b.y + b.h > vh - strip + 0.01) fail(`${id} in the bottom ${strip} px`);
			for (const id of ['auto', 'turbo', 'menu', 'arm', 'down', 'up']) if (Math.min(G.press[id].w, G.press[id].h) < L.MIN_PRESS - 0.01) fail(`${id} press box ${f1(Math.min(G.press[id].w, G.press[id].h))} px`);
			if (meet(G.press.down, G.press.up)) fail('the two arrows\' press boxes overlap');
			if (Math.hypot(g.play.cx - g.auto.cx, g.play.cy - g.auto.cy) < g.play.R + g.auto.R + 0.99) fail('the Play crosses Auto');
			for (const id of ['auto', 'turbo', 'play']) for (const r of ['down', 'up', 'amt', 'win', 'bal', 'menu', 'arm']) if (toBox(g[id], G.press[r]) < 0.99) fail(`${r} on ${id}`);
			for (const [a, b] of [['menu', 'arm'], ['win', 'bal'], ['win', 'menu'], ['win', 'arm'], ['bal', 'menu'], ['down', 'win'], ['down', 'bal'], ['amt', 'win'], ['amt', 'bal']]) if (meet(G.press[a], G.press[b])) fail(`${a} on ${b}`);
			// (4) the amount and its arrows in one row on the home indicator strip's edge: over his feet, never his body
			if (G.how !== 'row' || Math.min(G.box.amt.y, G.press.down.y, G.press.up.y) < vh - strip - L.MIN_PRESS - 0.01) fail(`the amount ${G.how}, reaching ${f1(vh - Math.min(G.box.amt.y, G.press.down.y, G.press.up.y))} px up from the bottom edge`);
			// (5) Win's number keeps SIDEWAYS.readGap to Balance's box, and both hold a seven-figure amount (6.83 em) and a
			// long coin amount (0.00012345 BTC, 8.2 em) at the text floor or more
			if (G.winToBal < L.SIDEWAYS.readGap - 0.01) fail(`Win's number ${f1(G.winToBal)} px over Balance's box`);
			if (Math.min(G.fitW.win, G.fitW.bal) < 8.2 * L.TEXT_FLOOR) fail(`a long amount would be under ${L.TEXT_FLOOR} px (${f1(Math.min(G.fitW.win, G.fitW.bal))} px of room)`);
			// (6) Auto left of Turbo left of the Play on every frame; Turbo under Auto wherever the chain is not folded
			if (!(g.auto.cx <= g.turbo.cx + 0.5 && g.turbo.cx < g.play.cx)) fail('the chain is not Auto, Turbo, Play from the left');
			if (g.turbo.cy < g.auto.cy - 0.5) folded.push(`${key} (Play ${f1(2 * g.play.R)})`);
			// the text floor: 9 px words on the gears, the readouts and the hub; numbers their own sizes, the longest amounts fitting at 9 px or more
			if (G.text.word < L.TEXT_FLOOR || G.text.label < L.TEXT_FLOOR || G.text.sub < L.TEXT_FLOOR || G.text.spin < L.TEXT_FLOOR || G.text.bal < L.TEXT_FLOOR || G.text.win < L.TEXT_FLOOR || G.fitW.bal < 6.83 * L.TEXT_FLOOR - 0.5 || G.fitW.win < 6.83 * L.TEXT_FLOOR - 0.5 || G.fitW.amt < 4.77 * L.TEXT_FLOOR) fail(`text under ${L.TEXT_FLOOR} px (${JSON.stringify(G.text)}, ${JSON.stringify(G.fitW)})`);
			table.push(`${pad(key, 9)} ${pad(mark, 5)} chain ${pad(barWas === 'gear' ? `gear ${playWas}` : barWas ? `dock ${playWas}` : 'not taken', 11)} Play ${pad(f1(2 * g.play.R), 6)} small ${pad(f1(2 * g.auto.R), 5)} (was ${pad(smallWas, 5)}) the amount ${G.how}; standards ${f1(G.box.menu.w)} px (their word ${f1(Math.max(9, (G.box.menu.w / 113.6) * 12.58))} px); the bottom row ${strip} px up; Play ${f1(G.coverPx)} px over the tail`);
		} else {
			// an unfolded folding phone held sideways: a tablet, the desktop layout and the desktop table's own floor
			const bar = L.barKind({ kind: 'landscape', vw, vh });
			if (bar === 'gear') gearN += 1;
			else dock.push([key, `a tablet window (the desktop layout) under ${L.DESKTOP_MIN.vw} x ${L.DESKTOP_MIN.vh} or with gears under ${L.DESKTOP_MIN.gears} of their desktop size`]);
			table.push(`${pad(key, 9)} ${pad(mark, 5)} ${bar === 'gear' ? 'desk ' : 'dock '} ${pad(`${barWas} ${playWas}`, 11)}  the desktop rule (a tablet window)`);
		}
	}
	LS.setPortraitViewportSource(() => ({ masterHeight: 760, cssPerMaster: 1, phone: true }));
	console.log('     THE SURVEY, frame by frame (CSS px; "was" = web-sdk d5cb3dad, measured in the survey):');
	for (const row of table) console.log(`       ${row}`);
	console.log(`     THE ARMOURY on each upright frame, were its tray and plate 460 design px: the menu's scale against the chrome's: ${armFit.join(', ')}`);
	check(`survey: the open Armoury ends above the bar's lit amount row on every upright frame (drawn smaller where the room is short, never under ${ARM.portrait.fitMin})`, armMin.length === 0, armMin.length ? `at the floor (a 460 px menu would still run on): ${armMin.join(', ')}` : '');
	check('survey: sideways, Turbo stands under Auto except where the chain must fold (667 and 678 wide: the room right of the board is 131 to 134 px, and an ordered chain leaves a 52 to 60 px Play)', folded.every((s) => /^(667|678)x/.test(s)), folded.join(', '));
	check(`survey: ${FRAMES.length} frames, ${gearN} draw the gear bar; in every one the pieces are in the frame, press boxes are 44 px, < and > are clear of the Play and of every gear, the readouts are in the bottom section, texts hold ${L.TEXT_FLOOR} px, and sideways nothing is in the bottom ${L.SIDEWAYS.homeStrip} px`, bad.length === 0, bad.slice(0, 6).join('; '));
	check(`survey: the dock stays only on frames under ${L.UPRIGHT_MIN_VW} wide or 480 tall upright, under ${L.SIDEWAYS_MIN.vh} tall sideways, the mini player and unfolded folding screens (${dock.length} frames)`, dock.every(([key]) => { const [w, h] = key.split('x').map(Number); return w < L.UPRIGHT_MIN_VW || (w > h && h < L.SIDEWAYS_MIN.vh) || Math.min(w, h) > 480 || (w > h && w < L.SIDEWAYS_MIN.vw) || (w < h && h < 480); }), dock.map(([k, w]) => `${k}: ${w}`).join(' | '));
	// the named frames of the brief
	for (const [vw, vh] of [[413, 586], [440, 742], [402, 661], [375, 504], [375, 554], [375, 627]]) {
		const scale = Math.min(vw / 412, vh / 760);
		LS.setPortraitViewportSource(() => ({ masterHeight: vh / scale, cssPerMaster: scale, phone: true }));
		const G = L.uprightLayout(vw, vh, 0);
		check(`survey: ${vw} x ${vh} upright draws the train, the Play at least 95 px`, !!G && 2 * G.gears.play.R >= 95, G ? `Play ${f1(2 * G.gears.play.R)}, small ${f1(2 * G.gears.auto.R)}` : L.uprightWhy.last);
	}
	for (const [vw, vh] of [[832, 376], [874, 338], [667, 331], [667, 325]]) {
		const G = L.sidewaysBarLayout({ kind: 'phone', vw, vh, safe: { t: 0, r: 0, b: 0, l: 0 }, touch: true });
		check(`survey: ${vw} x ${vh} sideways draws the chain with the bottom row ${L.SIDEWAYS.homeStrip} px up`, !!G && G.press.up.y + G.press.up.h <= vh - L.SIDEWAYS.homeStrip + 0.01 && G.box.bal.y + G.box.bal.h <= vh - L.SIDEWAYS.homeStrip + 0.01, G ? `Play ${f1(2 * G.gears.play.R)}, small ${f1(2 * G.gears.auto.R)}, the amount ${G.how}` : L.sidewaysWhy.last);
	}
	LS.setPortraitViewportSource(() => ({ masterHeight: 760, cssPerMaster: 1, phone: true }));
}

// ---- 4e. THE ARMOURY over the gear bar (ui/armoury/menuFrame.ts `copies`, uprightLayout hudTop) ----
{
	const MF = await import('../src/ui/armoury/menuFrame.ts');
	const { ARMOURY } = await import('../src/game/constants.ts');
	const inp = (vw, vh, touchSideways) => ({ kind: 'phone', phone: true, vw, vh, scale: Math.min(vw / 1480, vh / 740), master: { width: 1480, height: 740 }, fitWidth: 1480, touchSideways });
	const pick = (vw, vh, t) => MF.pickLayout(inp(vw, vh, t), ARMOURY.layout);
	check('the Armoury on a sideways phone: with the gear bar on a touch phone its own sideways layout at every ratio; otherwise the ratio rule as before (sideways from 1.9, the desktop box with its own bet controls under it: 16:9 phones on the dock, the popouts)', pick(844, 390, true).layout === 'sideways' && pick(667, 375, true).layout === 'sideways' && !pick(667, 375, true).hudCopies && pick(844, 390, false).layout === 'sideways' && pick(844, 390).layout === 'sideways' && pick(800, 450, false).hudCopies && pick(667, 375, false).hudCopies && pick(568, 320, false).hudCopies && pick(400, 225).hudCopies);
	// THE SIDEWAYS MENU OVER THE GEAR BAR, without a browser: the frame, and the anchors ui/armoury/Armoury.svelte measure()
	// reads off the bar (the left column's right edge, Win's top left for the name, the top of the lit amount and its
	// arrows' press boxes less 4 px for the rail), through menuFrame.ts designAnchors
	const S = ARMOURY.layout.sideways;
	const rows = [];
	for (const [vw, vh] of [[844, 390], [874, 402], [667, 375]]) {
		const G = L.sidewaysLayout(vw, vh);
		const f = MF.menuFrame(inp(vw, vh, true), ARMOURY.layout);
		const left = ['bal', 'win', 'menu', 'arm'].map((id) => G.box[id]);
		const anchors = { safe: { top: 0, right: 0, bottom: 0, left: 0 }, hudRight: Math.max(...left.map((b) => b.x + b.w)), balance: { x: G.box.win.x, y: G.box.win.y }, railTop: Math.min(G.press.down.y, G.press.up.y, G.box.amt.y) - 4 };
		const da = MF.designAnchors(f, anchors, ARMOURY.layout);
		const u = f.u;
		const mid = f.width - da.midLeft - (S.rail + S.hudGap);
		const railH = f.height - da.railBottom;
		const bad = [];
		if (f.layout !== 'sideways' || f.hudCopies) bad.push('not the sideways layout');
		if (f.left < -0.01 || f.top < -0.01 || f.left + f.width * u > vw + 0.01 || f.top + f.height * u > vh + 0.01) bad.push('the frame is off the window');
		if (mid * u < 200) bad.push(`the middle column (the plate, Activate) ${f1(mid * u)} px wide`);
		if (da.midLeft * u < anchors.hudRight) bad.push('the middle column on the bar\'s left column');
		if ((f.width - S.rail) * u < da.midLeft * u + 200) bad.push('the rail on the middle column');
		// the rail's content: 14 top, PER SPIN's heading 44 and its tiles 112, a 6 gap, FEATURE BUYS' heading 16 and tiles 112, 8 between
		if (railH < 14 + 44 + 112 + 6 + 16 + 112 + 8) bad.push(`the rail ${f1(railH)} design px high`);
		if (railH * u > Math.min(G.press.down.y, G.press.up.y, G.box.amt.y) - 3.9) bad.push('the rail over the lit amount or its arrows');
		if (G.box.amt.x < (f.width - S.rail) * u - 0.01 && G.press.down.x < (f.width - S.rail) * u - 60) bad.push('the amount group far left of the rail');
		const nameY = da.name.y * u;
		if (da.name.place !== 'above' || nameY < G.box.menu.y + G.box.menu.h || nameY + 14 * u > G.box.win.y) bad.push(`the name at ${f1(nameY)} not between the standards and Win`);
		if (!near(da.minHit * u, 44, 1e-6)) bad.push('touch boxes under 44 px');
		if (12 * u < 9) bad.push(`12 design px text is ${f1(12 * u)} px`);
		rows.push(`${vw}x${vh}: scale ${u.toFixed(3)}, the middle column ${f1(da.midLeft * u)} to ${f1((f.width - S.rail - S.hudGap) * u)} (${f1(mid * u)} px), the rail from ${f1((f.width - S.rail) * u)} down to ${f1(railH * u)}, the amount's row from ${f1(Math.min(G.press.down.y, G.press.up.y))}, the name at ${f1(nameY)}, 12 px text ${f1(12 * u)} px${bad.length ? '; ' + bad.join('; ') : ''}`);
		check(`the Armoury's sideways menu over the gear bar at ${vw} x ${vh}: inside the window, every column wide, the rail above the lit amount and arrows, the name between the standards and Win, 44 px touch boxes, text 9 px or more`, bad.length === 0, rows[rows.length - 1]);
	}
	check('the Armoury at 568 x 320: the gear bar is not drawn there (the dock), so the menu is the dock\'s own (the box by the ratio rule), unchanged', L.sidewaysLayout(568, 320) === null && pick(568, 320, false).hudCopies);
	// upright: the bar's top for the menu is the band under the plaque, also where Win and Balance stand under the logo
	const LS = await import('../src/game/layoutSpec.ts');
	const tops = [];
	for (const [vw, vh] of [[402, 874], [390, 844], [360, 640], [390, 664], [402, 700], [375, 667]]) {
		const scale = Math.min(vw / 412, vh / 760);
		LS.setPortraitViewportSource(() => ({ masterHeight: vh / scale, cssPerMaster: scale, phone: true }));
		const G = L.uprightLayout(vw, vh, 0);
		tops.push([`${vw}x${vh}`, G.hudTop, G.band.plate, Math.min(G.box.win.y, G.box.bal.y)]);
	}
	check('the Armoury on an upright phone: the gear bar\'s top is in its band under the plaque (within 3 px of the plaque\'s plate), never the readouts under the logo', tops.every(([, t, plate]) => t >= plate && t <= plate + 3), tops.map(([k, t, plate, ro]) => `${k}: ${f1(t)} (plate ${f1(plate)}, highest of Win and Balance ${f1(ro)})`).join('; '));
}

// ---- 4f2. THE OPEN ARMOURY ON EVERY UPRIGHT FRAME (ui/armoury/menuFrame.ts fitPortrait, closeTop, closeRoom, portraitCard) ----
// The menu's pieces by the game's own rules: the name's row, the close key, the tray and the plate at the column's
// foot (the hero dropped), the lit row of the bar under them, and the confirm card with Cancel on its corner diamond.
// The tray's and the plate's heights are measured in the page, never known here, so the sweep takes what they may
// need together (380 to 470 design px: the tray is 169, a plate 230 to 300) and holds the rules for each.
{
	const LS = await import('../src/game/layoutSpec.ts');
	const US = await import('../src/ui/gear/uprightScene.ts');
	const MF = await import('../src/ui/armoury/menuFrame.ts');
	const ARM = (await import('../src/game/constants.ts')).ARMOURY.layout;
	// COPY OF ui/armoury/Armoury.svelte: the card's corner diamond (CARD_DIAMOND), the close key's right inset (8), the
	// tile's height and the gap between the two rows of tiles (the second group's word and gaps), design px
	const DIAMOND = { x: 725.6 / 768, y: 50.5 / 1152 };
	const TILE = { h: 54, between: 26 };
	// (the card's foot ornament: CARD_ORNAMENT; CONFIRM's bottom stays `gap` card px over its apex)
	const ORNAMENT = { top: 1000 / 1152, gap: 10 };
	const onCancel = new Set();
	const FRAMES = [[360, 640], [390, 664], [360, 780], [375, 504], [375, 512], [375, 528], [375, 554], [375, 585], [375, 627], [375, 717], [385, 598], [402, 573], [402, 597], [402, 643], [402, 661], [402, 704], [402, 786], [402, 874], [412, 891], [413, 586], [440, 655], [440, 679], [440, 701], [440, 742], [440, 868], [440, 956], [466, 678]];
	const bad = [];
	const floor = [];
	const rows = [];
	for (const [vw, vh] of FRAMES) {
		const scale = Math.min(vw / 412, vh / 760);
		LS.setPortraitViewportSource(() => ({ masterHeight: vh / scale, cssPerMaster: scale, phone: true }));
		const G = L.uprightLayout(vw, vh, 0);
		if (!G) { bad.push(`${vw}x${vh}: no train`); continue; }
		const S = US.uprightScene(vw, vh, 0);
		const anchors = { hudTop: G.hudTop, clockTop: S.top0 + 10 * S.fit, clockBottom: S.top0 + 25 * S.fit, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
		const F0 = MF.menuFrame({ kind: 'portrait', phone: true, vw, vh, scale: S.fit, master: { width: 412, height: 760 }, fitWidth: Math.max(412, vw / S.fit) }, ARM);
		for (const need of [380, 420, 450, 470]) {
			const F = MF.fitPortrait(F0, anchors, need, ARM);
			const d = MF.designAnchors(F, anchors, ARM);
			const u = F.u;
			const k = u / F0.u;
			const fail = (why) => bad.push(`${vw}x${vh}, ${need} px of tray and plate (menu at ${k.toFixed(2)}): ${why}`);
			const css = (y) => F.top + y * u;
			const room = d.contentBottom - d.contentTop;
			const atFloor = k <= ARM.portrait.fitMin + 1e-6 && room - MF.closeRoom(d, ARM) < need - 0.5;
			if (atFloor) { floor.push(`${vw}x${vh} at ${need}`); continue; }
			// the hero is dropped where its room is under its minimum (Armoury.svelte heroRoom: 9 over the plate, 6 under the hero)
			const noHero = room - need - 6 < ARM.portrait.minHero;
			const trayTop = noHero ? d.contentBottom - need : d.contentTop + (room - need);
			// the plate ends over the bar's lit row; the lit pieces are at or under the bar's top
			if (css(d.contentBottom) > G.hudTop - ARM.portrait.gapToHud * u + 0.01) fail('the plate runs on over the bar\'s lit row');
			for (const id of ['amt', 'bal']) if (G.box[id].y < G.hudTop - 0.01) fail(`the lit ${id} is over the bar's top`);
			// the close key: its drawn box and its 44 CSS px press square clear of the tray (and so of every tile), of the
			// lit row, in the window, under the clock line
			const ct = MF.closeTop(d, noHero, ARM);
			const key = { x0: (F.width - F.contentLeft - 8 - ARM.portrait.closeKey) * u, x1: (F.width - F.contentLeft - 8) * u, y0: css(ct), y1: css(ct + ARM.portrait.closeKey) };
			const half = Math.max((ARM.portrait.closeKey * u) / 2, ARM.portrait.minHitCss / 2);
			const cx = (key.x0 + key.x1) / 2, cy = (key.y0 + key.y1) / 2;
			const press = { x0: cx - half, x1: cx + half, y0: cy - half, y1: cy + half };
			if (2 * half < 44 - 0.01) fail(`the close key's press area ${f1(2 * half)} px`);
			if (noHero && (key.y1 > css(trayTop) - 0.01 || press.y1 > css(trayTop) + 0.01)) fail(`the close key on the tray (its box to ${f1(key.y1)}, its press area to ${f1(press.y1)}, the tray from ${f1(css(trayTop))})`);
			if (press.x0 < -0.01 || press.x1 > vw + 0.01 || press.y0 < -0.01 || press.y1 > G.hudTop) fail('the close key\'s press area leaves the window or reaches the bar');
			if (key.y0 < anchors.clockBottom - 0.01) fail('the close key on the clock line');
			// the tiles: 44 CSS px of press area each, the two rows' areas apart
			const tileHit = Math.max(TILE.h * u, 44);
			if ((tileHit - TILE.h * u) / 2 > (TILE.between * u) / 2 + 0.01) fail(`the two rows of tiles' press areas meet (${f1(tileHit)} px each, ${f1(TILE.between * u)} between the rows)`);
			// the confirm card: in the window over the bar, Cancel's and CONFIRM's press areas 44 px, Cancel's whole in the window
			const C = MF.portraitCard(F, d, d.contentTop + ARM.portrait.cardGap, DIAMOND.y, ARM);
			const cardW = ARM.portrait.card.w * C.k * u, cardH = ARM.portrait.card.h * C.k * u;
			const cardX = (vw - cardW) / 2, cardY = css(C.top);
			const xc = { x: cardX + DIAMOND.x * cardW, y: cardY + DIAMOND.y * cardH };
			if (cardY < -0.01 || cardY + cardH > G.hudTop - ARM.portrait.gapToHud * u + 0.5 || cardX < -0.01) fail(`the confirm card leaves its room (${f1(cardY)} to ${f1(cardY + cardH)})`);
			if (xc.y - 22 < -0.01 || xc.x + 22 > vw + 0.01 || xc.x - 22 < -0.01) fail(`Cancel's press area is cut by the window (its middle ${f1(xc.x)}, ${f1(xc.y)})`);
			if (C.k < 0.55) fail(`the confirm card at ${C.k.toFixed(2)}`);
			// THE CONFIRM STATE (2026-11-24): Cancel and CONFIRM are the only pressable things besides the card. The menu's
			// close key stands in the card's top right corner upright (its press box on Cancel's on most frames: counted),
			// so it must be out under the card (menuFrame.ts closeUnderCard); the bar's lit minus and plus take nothing
			// under the card (Chrome.svelte's armoury-confirm rule) and stand under it besides. CONFIRM stands somewhere
			// between the card's text and its foot ornament (measured in the page): its zone here is the card's lower
			// three quarters, 52 card px in from each side, widened to 44 CSS px
			const ck = C.k * u;
			const cHalf = Math.max((0.0929 * cardW) / 2, 22);
			const cancelP = { x0: xc.x - cHalf, x1: xc.x + cHalf, y0: xc.y - cHalf, y1: xc.y + cHalf };
			const keysP = { x0: cardX + 52 * ck, x1: cardX + cardW - 52 * ck, y0: cardY + 0.25 * cardH, y1: cardY + ORNAMENT.top * cardH - ORNAMENT.gap * ck };
			const meet = (a, b) => a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.y0 < b.y1 - 0.01 && b.y0 < a.y1 - 0.01;
			if (meet(cancelP, keysP)) fail('Cancel\'s press area reaches CONFIRM\'s');
			if (keysP.x1 - keysP.x0 < 44 || (48 * ck < 44 && keysP.y1 - keysP.y0 < 44)) fail('no room for CONFIRM\'s 44 px press area on the card');
			if (meet(press, cancelP)) onCancel.add(`${vw}x${vh}`);
			const liveUnder = [];
			if (MF.closeUnderCard('portrait')) liveUnder.push(['the menu\'s close key', press]);
			for (const id of ['down', 'up']) if (G.press[id]) liveUnder.push([`the bar's lit ${id}`, { x0: G.press[id].x, x1: G.press[id].x + G.press[id].w, y0: G.press[id].y, y1: G.press[id].y + G.press[id].h }]);
			for (const [name, b] of liveUnder) for (const [what, k] of [['Cancel', cancelP], ['CONFIRM', keysP]]) if (meet(b, k)) fail(`under the confirm card ${name} lies on ${what}'s press area`);
			if (need === 450) rows.push(`${vw}x${vh} menu ${k.toFixed(2)} (${f1(12 * u)} px text)${noHero ? `, close key ${f1(ARM.portrait.closeKey * u)} px in the name's row, ${f1(css(trayTop) - press.y1)} px over the tray` : ', hero kept'}; card ${C.k.toFixed(2)}`);
		}
	}
	LS.setPortraitViewportSource(() => ({ masterHeight: 760, cssPerMaster: 1, phone: true }));
	console.log('     THE OPEN ARMOURY on every upright frame, were its tray and plate 450 design px:');
	for (const row of rows) console.log(`       ${row}`);
	check(`armoury: on ${FRAMES.length} upright frames, for 380 to 470 px of tray and plate: the plate ends over the bar's lit row, the close key and its 44 px press area are clear of the tray, in the window and under the clock line, the tiles' press areas are 44 px and apart, and the confirm card's Cancel is whole in the window`, bad.length === 0, bad.slice(0, 5).join(' | '));
	console.log(`     note: at the menu's floor (${ARM.portrait.fitMin} of its size) the plate would still run on: ${floor.join(', ') || 'nowhere'}`);
	check(`armoury, the confirm card up, ${FRAMES.length} upright frames: the menu's close key is out (its press box would lie on Cancel's on ${onCancel.size} of them), so nothing pressable lies on Cancel's or CONFIRM's 44 px press areas, and the two are apart`, !MF.closeUnderCard('portrait') && !MF.closeUnderCard('tablet') && onCancel.size > 0 && bad.length === 0, bad.slice(0, 5).join(' | '));
}

// ---- 4f3. THE CONFIRM CARD ON EVERY SIDEWAYS FRAME (ui/armoury/menuFrame.ts closeUnderCard; Armoury.svelte's slab) ----
// Sideways the card is the tray's own slab in the middle and the menu's close key stays live in the rail's top right
// corner (it closes the whole menu, as on the desktop box): Cancel in the slab's corner and CONFIRM at its foot must be
// clear of it and of the bar's lit minus and plus, with 44 px press areas in the window.
{
	const MF = await import('../src/ui/armoury/menuFrame.ts');
	const ARM = (await import('../src/game/constants.ts')).ARMOURY.layout;
	// COPY OF ui/armoury/Armoury.svelte: the slab's Cancel (34 px, 8 in from its top and right), CONFIRM (28 in from each
	// side, 44 high, 4 over the slab's foot), the close key (44 px, SIDE_TOP 14 down, `edge` in from the right), design px
	const X = { size: 34, inset: 8 };
	const KEYS = { side: 28, h: 44 };
	const CLOSE = { size: 44, top: 14 };
	const SIDE = [[640, 320], [667, 325], [667, 355], [678, 402], [780, 360], [832, 376], [840, 360], [874, 338], [874, 402], [891, 412], [956, 376], [956, 440]];
	const bad = [];
	const meet = (a, b) => a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.y0 < b.y1 - 0.01 && b.y0 < a.y1 - 0.01;
	let least = Infinity;
	for (const [vw, vh] of SIDE) {
		for (const safe of [{ t: 0, r: 0, b: 0, l: 0 }, { t: 0, r: 47, b: 21, l: 47 }]) {
			const fail = (why) => bad.push(`${vw}x${vh}${safe.r ? ' with safe areas' : ''}: ${why}`);
			const F = MF.menuFrame({ kind: 'phone', phone: true, vw, vh, scale: 1, master: { width: 844, height: 390 }, fitWidth: vw, touchSideways: true }, ARM);
			if (F.layout !== 'sideways') { fail(`the menu's layout is ${F.layout}`); continue; }
			const u = F.u;
			const d = MF.designAnchors(F, { safe: { top: safe.t, right: safe.r, bottom: safe.b, left: safe.l } }, ARM);
			const slab = { x0: ((F.width - ARM.sideways.slab) / 2) * u, x1: ((F.width + ARM.sideways.slab) / 2) * u, y0: (d.safe.top + ARM.sideways.slabTop) * u };
			const xm = { x: slab.x1 - (X.inset + X.size / 2) * u, y: slab.y0 + (X.inset + X.size / 2) * u };
			const xh = Math.max((X.size * u) / 2, 22);
			const cancelP = { x0: xm.x - xh, x1: xm.x + xh, y0: xm.y - xh, y1: xm.y + xh };
			// CONFIRM: at the slab's foot, wherever that is (the slab's height follows its text): its column, 44 CSS px high
			const kh = Math.max(KEYS.h * u, 44);
			const keysCol = { x0: slab.x0 + KEYS.side * u, x1: slab.x1 - KEYS.side * u, y0: cancelP.y1, y1: vh };
			if (keysCol.x1 - keysCol.x0 < 44 || kh > vh - cancelP.y1) fail('no room for CONFIRM\'s 44 px press area under Cancel\'s');
			if (cancelP.x0 < -0.01 || cancelP.x1 > vw + 0.01 || cancelP.y0 < -0.01) fail(`Cancel's press area is cut by the window (${f1(cancelP.x0)} to ${f1(cancelP.x1)}, from ${f1(cancelP.y0)})`);
			const live = [];
			if (MF.closeUnderCard('sideways')) {
				const cm = { x: (F.width - d.safe.right - ARM.sideways.edge - CLOSE.size / 2) * u, y: (CLOSE.top + CLOSE.size / 2) * u };
				const ch = Math.max((CLOSE.size * u) / 2, 22);
				live.push(['the menu\'s close key', { x0: cm.x - ch, x1: cm.x + ch, y0: cm.y - ch, y1: cm.y + ch }]);
			}
			// the whole slab's width is the card: nothing live may stand in its column or on Cancel's press area
			const card = { x0: Math.min(slab.x0, cancelP.x0), x1: Math.max(slab.x1, cancelP.x1), y0: Math.min(slab.y0, cancelP.y0), y1: vh };
			for (const [name, b] of live) {
				if (meet(b, card)) fail(`under the confirm card ${name} lies on the slab or on Cancel's press area`);
				least = Math.min(least, b.x0 - card.x1);
			}
		}
	}
	check(`armoury, the confirm card up, ${SIDE.length} sideways frames (with and without safe areas): Cancel's 44 px press area is in the window, CONFIRM has its own under it, and the menu's close key (kept live there) is at least ${f1(least)} px right of the slab and of Cancel's area`, MF.closeUnderCard('sideways') && MF.closeUnderCard('desktop') && bad.length === 0, bad.slice(0, 5).join(' | '));
}

// ---- 4g. THE FIVE RINGS (game/frameGears.ts FRAME_PINION, pinionRing; components/BoardFrame.svelte) ----
{
	const FG = await import('../src/game/frameGears.ts');
	const { BOARD_ART } = await import('../src/game/boardArtSpec.ts');
	const { readFileSync } = await import('node:fs');
	check('rings: four on the frame (two wheels, two pinions) beside the hub\'s, lit by the one ringAt() the hub reads', FG.FRAME_RINGS.join() === 'wheel-L,wheel-R,pinion-L,pinion-R' && typeof FG.ringAt === 'function');
	for (const kind of ['landscape', 'portrait', 'phone']) {
		const G = BOARD_ART.relight.layouts[kind].gears;
		const art = BOARD_ART.art;
		const mid = (FG.FRAME_WHEEL.center.L[0] + FG.FRAME_WHEEL.center.R[0]) / 2;
		const q = { L: FG.pinionRing('L', G.pinion_L.box), R: FG.pinionRing('R', G.pinion_R.box) };
		const inBox = (c, b) => c.x - c.r > b[0] && c.x + c.r < b[0] + b[2] && c.y - c.r > b[1] && c.y + c.r < b[1] + b[3];
		// each ring inside its own loop's box; the two mirrored about the art's center line; inside the wheel, toward the
		// board, on the top rail; 27 px of the loop's cell
		check(`rings ${kind}: each pinion's ring is inside its own gear's box, the two mirrored about the board's center line (${f1(q.L.x)}, ${f1(q.L.y)} and ${f1(q.R.x)}, ${f1(q.R.y)}, radius ${f1(q.R.r)})`, inBox(q.L, G.pinion_L.box) && inBox(q.R, G.pinion_R.box) && near(q.L.x + q.R.x, 2 * mid, 3) && near(q.L.y, q.R.y, 1.5) && near(q.L.r, q.R.r, 0.6) && near(q.R.r, 27, 1.2), `center line ${f1(mid)}`);
		check(`rings ${kind}: the pinion stands inside its wheel toward the board (clear of the wheel's own ring), on the art`, q.R.x < FG.FRAME_WHEEL.center.R[0] - FG.FRAME_WHEEL.ringR - q.R.r && q.L.x > FG.FRAME_WHEEL.center.L[0] + FG.FRAME_WHEEL.ringR + q.L.r && q.L.x - q.L.r > art[0] && q.R.x + q.R.r < art[2]);
	}
	// the small ring's art: a 256 px PNG (its middle line FRAME_PINION.texR from the center), beside the wheels' 512 px one
	const png = (f) => { const b = readFileSync(new URL(`../static/assets/ui/${f}`, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
	const small = png('gear-ring-small.png');
	const big = png('gear-ring.png');
	// 3 px per CSS px at the largest draw: the board's scale on a 3840 x 2160 screen is the wheel's 73 CSS px over its 65
	const css4k = (FG.FRAME_PINION.ringR * 73) / 65;
	check(`rings: the small ring's art is 256 px square with its middle line ${FG.FRAME_PINION.texR} px out (${f1(FG.FRAME_PINION.texR / css4k)} px per CSS px on a 3840 x 2160 screen), the wheels' 512 px`, small.join() === '256,256' && big.join() === '512,512' && FG.FRAME_PINION.texR / css4k >= 2.95 && FG.FRAME_PINION.texR + 5 * (FG.FRAME_PINION.texR / FG.FRAME_PINION.ringR) + 1 < 128);
}

// ---- 4h. THE KEYS A PAGE DRAWS (gearLayout.ts seatBar, presentKeys): the eight sets, every frame ----
// An operator's switches (disabledAutoplay, disabledTurbo, disabledBuyFeature) and a replay (Auto and the Armoury) take
// keys away; the rest slide toward the Play gear in their order and stay meshed. Corey 2026-11-24: "yes".
{
	const LS = await import('../src/game/layoutSpec.ts');
	const SETS = [];
	for (const auto of [true, false]) for (const turbo of [true, false]) for (const arm of [true, false]) SETS.push({ auto, turbo, arm });
	const nameOf = (P) => ['auto', 'turbo', 'arm'].filter((k) => !P[k]).map((k) => ({ auto: 'Auto', turbo: 'Turbo', arm: 'the Armoury' })[k]).join(' and ') || 'nothing';
	const toBox = (c, b) => {
		const nx = Math.max(b.x, Math.min(c.cx, b.x + b.w));
		const ny = Math.max(b.y, Math.min(c.cy, b.y + b.h));
		return c.cx > b.x && c.cx < b.x + b.w && c.cy > b.y && c.cy < b.y + b.h ? -c.R : Math.hypot(c.cx - nx, c.cy - ny) - c.R;
	};
	const dist = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
	// the frames: every upright and sideways gear frame of the survey (their own lists above are private to 4f), the desktop sizes
	const UP = [[360, 780], [375, 504], [375, 554], [375, 627], [385, 598], [402, 573], [402, 661], [402, 750], [402, 874], [413, 586], [440, 655], [440, 742], [440, 956], [466, 678]];
	const SIDE = [[667, 325], [667, 355], [678, 402], [780, 360], [832, 376], [840, 360], [874, 338], [874, 402], [891, 412], [956, 376], [956, 440]];
	const DESK = [[1920, 1080], [1440, 900], [1280, 720], [1024, 576], [1366, 768], [2560, 1440]];
	const bad = [];
	const rows = [];
	let n = 0;
	/** everything that must hold of a seated bar; `clear`: the play between meshed pitch circles; `wheel`: the frame's wheel (sideways) */
	const judge = (key, P, L, full, clear, wheel) => {
		n += 1;
		const fail = (why) => bad.push(`${key}, without ${nameOf(P)}: ${why}`);
		const g = L.gears;
		const small = Object.keys(g).filter((id) => id !== 'play');
		const want = (L.table === 'upright' ? ['auto', 'menu', 'arm', 'turbo'] : ['auto', 'turbo']).filter((id) => id === 'menu' || P[id]);
		if (small.slice().sort().join() !== want.slice().sort().join()) fail(`draws ${small.join(', ') || 'no small gear'} (wants ${want.join(', ')})`);
		// each drawn gear meshes with what it says, by the solved tooth rule (pitch circles `clear` apart); all reach the Play
		const reach = new Set(['play']);
		for (let pass = 0; pass < 5; pass += 1) for (const id of small) if ((L.seat.mesh[id] || []).some((m) => reach.has(m))) reach.add(id);
		for (const id of small) {
			const c = g[id];
			if (!(L.seat.mesh[id] || []).length) fail(`${id} meshes with nothing`);
			for (const m of L.seat.mesh[id] || []) {
				const o = m === 'wheel' ? wheel : g[m];
				if (!o) { fail(`${id} is said to mesh with ${m}, which is not drawn`); continue; }
				if (!near(dist(c, o), c.pitchR + o.pitchR + clear, 1e-6)) fail(`${id} is not meshed with ${m} (${f1(dist(c, o))} against ${f1(c.pitchR + o.pitchR + clear)})`);
			}
			if (!reach.has(id)) fail(`${id} is not connected to the Play gear`);
			// the slot it turns as is a gear of the full train of its own size, and its neighbor toward the Play sits in that slot's own neighbor
			const sl = L.seat.as[id];
			if (!sl || !full.train[sl] || !near(full.train[sl].R, c.R, 1e-9) || full.train[sl].teeth !== c.teeth || !near(full.train[sl].cx, c.cx, 1e-9) || !near(full.train[sl].cy, c.cy, 1e-9)) fail(`${id} is not its slot's gear`);
			if (2 * c.R < L.MIN - 0.01) fail(`${id} ${f1(2 * c.R)} px`);
		}
		// no two drawn gears cross unless they mesh
		const all = ['play', ...small];
		for (let i = 0; i < all.length; i += 1) for (let j = i + 1; j < all.length; j += 1) {
			const a = all[i], b = all[j];
			const meshed = (L.seat.mesh[a] || []).includes(b) || (L.seat.mesh[b] || []).includes(a);
			// (desktop: Auto and Turbo stand tooth to tooth round the Play gear in his own layout, section 3 holds their distance)
			if (!meshed && !(L.table === 'desktop' && a !== 'play' && b !== 'play') && dist(g[a], g[b]) < g[a].R + g[b].R + 0.99) fail(`${a} crosses ${b}`);
		}
		// sizes and the Play, the amount, the arrows, Win and Balance: exactly the full bar's
		if (!near(g.play.cx, full.gears.play.cx, 1e-9) || !near(g.play.cy, full.gears.play.cy, 1e-9) || !near(g.play.R, full.gears.play.R, 1e-9)) fail('the Play gear moved or changed size');
		for (const id of ['amt', 'down', 'up', 'win', 'bal']) for (const set of ['box', 'press']) if (L[set] && JSON.stringify(L[set][id]) !== JSON.stringify(full[set][id])) fail(`${id} moved`);
		// every drawn piece in the frame; no absent piece left with a box; press boxes; the arrows clear of every drawn gear
		for (const set of ['box', 'press']) for (const [id, b] of Object.entries(L[set] || {})) if (b.x < -0.01 || b.y < -0.01 || b.x + b.w > L.vw + 0.01 || b.y + b.h > L.vh + 0.01) fail(`${id} outside the frame`);
		for (const id of ['auto', 'turbo', 'arm']) if (!P[id] && (L.box[id] || (L.press && L.press[id]) || g[id])) fail(`${id} is not drawn and still has a box`);
		if (L.press) for (const id of ['down', 'up']) for (const k of all) if (toBox(g[k], L.press[id]) < 0.99) fail(`${id}'s press box on ${k}`);
		if (L.press) for (const id of ['win', 'bal', 'amt']) for (const k of small) if (id !== 'win' && toBox(g[k], L.box[id]) < 0.99) fail(`${id} on ${k}`);
	};
	// ---- upright ----
	for (const [vw, vh] of UP) {
		const scale = Math.min(vw / 412, vh / 760);
		LS.setPortraitViewportSource(() => ({ masterHeight: vh / scale, cssPerMaster: scale, phone: true }));
		const full = L.uprightLayout(vw, vh, 0);
		if (!full) { bad.push(`${vw}x${vh}: no train`); continue; }
		for (const P of SETS) {
			const G = L.uprightBarLayout({ kind: 'portrait', vw, vh, phone: true, safeBottom: 0, present: P });
			judge(`upright ${vw}x${vh}`, P, { ...G, MIN: L.MIN_PRESS }, full, L.UPRIGHT.small.clear, null);
			// the order from the left never changes: the Armoury, Menu, Auto, the Play, Turbo, whichever are drawn. Left
			// of the Play they fill Auto's, Menu's and the Armoury's slots in that order
			const left = ['auto', 'menu', 'arm'].filter((id) => id === 'menu' || P[id]);
			if (left.map((id) => G.seat.as[id]).join() !== ['auto', 'menu', 'arm'].slice(0, left.length).join()) bad.push(`upright ${vw}x${vh}, without ${nameOf(P)}: the left chain is not seated from the Play outward (${left.map((id) => `${id} in ${G.seat.as[id]}`).join(', ')})`);
			if (G.hudTop !== full.hudTop) bad.push(`upright ${vw}x${vh}, without ${nameOf(P)}: the bar's top (THE ARMOURY's anchor) moved`);
			if (vw === 440 && vh === 742) rows.push(`upright  440x742   without ${nameOf(P).padEnd(34)} left of the Play: ${left.slice().reverse().join(' - ') || 'none'}${P.turbo ? '; right: turbo' : ''}; ${left.map((id) => `${id} at ${f1(G.gears[id].cx)}, ${f1(G.gears[id].cy)}`).join('; ')}`);
		}
	}
	LS.setPortraitViewportSource(() => ({ masterHeight: 760, cssPerMaster: 1, phone: true }));
	// ---- sideways ----
	for (const [vw, vh] of SIDE) {
		const view = { kind: 'phone', vw, vh, safe: { t: 0, r: 0, b: 0, l: 0 }, touch: true };
		const full = L.sidewaysBarLayout(view);
		if (!full) { bad.push(`${vw}x${vh}: no chain`); continue; }
		for (const P of SETS) {
			const G = L.sidewaysBarLayout({ ...view, present: P });
			judge(`sideways ${vw}x${vh}`, P, { ...G, MIN: L.MIN_PRESS }, full, L.SIDEWAYS.small.clear, full.wheel && { cx: full.wheel.cx, cy: full.wheel.cy, R: full.wheel.R, pitchR: full.wheel.pitchR });
			// one small gear alone stands in Turbo's slot, on the Play gear; the standards: Menu alone is centered where the pair was
			const drawn = ['turbo', 'auto'].filter((id) => P[id]);
			if (drawn.length === 1 && (G.seat.as[drawn[0]] !== 'turbo' || !G.seat.mesh[drawn[0]].includes('play'))) bad.push(`sideways ${vw}x${vh}, without ${nameOf(P)}: ${drawn[0]} is not on the Play gear`);
			const mid = (full.box.menu.x + full.box.arm.x + full.box.arm.w) / 2;
			if (P.arm ? JSON.stringify(G.box.menu) !== JSON.stringify(full.box.menu) || JSON.stringify(G.box.arm) !== JSON.stringify(full.box.arm) : !near(G.box.menu.x + G.box.menu.w / 2, mid, 1e-6) || G.box.arm || G.seat.hangers.join() !== 'menu') bad.push(`sideways ${vw}x${vh}, without ${nameOf(P)}: the standards`);
			for (const id of L.PIECES) for (const b of [G.box[id], G.press[id]]) if (b && b.y + b.h > vh - L.SIDEWAYS.homeStrip + 0.01) bad.push(`sideways ${vw}x${vh}, without ${nameOf(P)}: ${id} in the bottom strip`);
			if (vw === 832 && vh === 376) rows.push(`sideways 832x376   without ${nameOf(P).padEnd(34)} from the wheel: ${['auto', 'turbo'].filter((id) => P[id]).map((id) => `${id} (${G.seat.as[id]}'s slot${G.seat.mesh[id].includes('wheel') ? ', on the wheel' : ''})`).join(' - ') || 'no small gear'} - play; standards: ${G.seat.hangers.join(', ')}`);
		}
	}
	// ---- desktop ----
	for (const [vw, vh] of DESK) {
		const full = L.gearBarLayout({ kind: 'landscape', vw, vh });
		if (!full) { bad.push(`${vw}x${vh}: no desktop bar`); continue; }
		for (const P of SETS) {
			const G = L.gearBarLayout({ kind: 'landscape', vw, vh, present: P });
			judge(`desktop ${vw}x${vh}`, P, { ...G, MIN: L.MIN_PRESS, press: null }, { ...full, press: null }, full.mesh.d * 0 + L.DESKTOP.small.clear * full.scale.gears, null);
			// the standards hang from the logo: Menu alone is centered where the pair was centered, on the window
			const mid = (full.box.menu.x + full.box.arm.x + full.box.arm.w) / 2;
			if (P.arm ? JSON.stringify(G.box.menu) !== JSON.stringify(full.box.menu) : !near(G.box.menu.x + G.box.menu.w / 2, mid, 1e-6) || G.box.arm || G.seat.hangers.join() !== 'menu' || G.box.menu.x < 0) bad.push(`desktop ${vw}x${vh}, without ${nameOf(P)}: the standards`);
			if (vw === 1920) rows.push(`desktop  1920x1080 without ${nameOf(P).padEnd(34)} on the Play: ${['auto', 'turbo'].filter((id) => P[id]).join(', ') || 'no small gear'}; standards: ${G.seat.hangers.join(', ')}${P.arm ? '' : ` (Menu centered at x ${f1(G.box.menu.x + G.box.menu.w / 2)}, was ${f1(full.box.menu.x + full.box.menu.w / 2)})`}`);
		}
	}
	console.log('     THE KEYS A PAGE DRAWS: the eight sets (a replay is "without Auto and the Armoury"):');
	for (const row of rows) console.log(`       ${row}`);
	check(`keys: ${n} bars (8 sets x ${UP.length} upright, ${SIDE.length} sideways and ${DESK.length} desktop frames): every drawn gear meshes with a drawn neighbor back to the Play gear by the solved tooth rule, sits in a slot of the full train at that slot's size and turning, nothing crosses, everything is in the frame, and the Play, the amount, its arrows, Win and Balance do not move`, bad.length === 0, bad.slice(0, 6).join(' | '));
	// the switches and a replay
	const pk = L.presentKeys;
	check('keys: the operator\'s switches and a replay give the set (disabledAutoplay: Auto; disabledTurbo: Turbo; disabledBuyFeature: the Armoury; a replay: Auto and the Armoury)', JSON.stringify(pk({}, false)) === JSON.stringify(L.ALL_PRESENT) && !pk({ disabledAutoplay: true }, false).auto && !pk({ disabledTurbo: true }, false).turbo && !pk({ disabledBuyFeature: true }, false).arm && JSON.stringify(pk({}, true)) === JSON.stringify({ auto: false, turbo: true, arm: false }) && JSON.stringify(pk(null, false)) === JSON.stringify(L.ALL_PRESENT));
	// all keys drawn: the layout itself, untouched
	{
		const full = L.sidewaysLayout(874, 402);
		check('keys: with every key drawn the bar is the solved layout itself', L.seatBar(full, L.ALL_PRESENT) === full && L.seatBar(full) === full);
	}
}

// ---- 5. the switch ----
{
	const k = (kind, vw, vh, mode) => L.barKind({ kind, vw, vh }, mode);
	check('switch: desktop and laptop windows get the gear bar', ['1920x1080', '1200x675', '1024x576', '1280x720', '1366x768', '1440x900', '2560x1440', '2560x1080', '3440x1440'].every((s) => k('landscape', ...s.split('x').map(Number)) === 'gear'));
	check('switch: the two popouts keep the dock', k('landscape', 800, 450) === 'dock' && k('landscape', 400, 225) === 'dock');
	check('switch: a small window near 4:3 (an iPad held sideways) keeps the dock: its gears would be under 55 percent', k('landscape', 1024, 768) === 'dock' && k('landscape', 1180, 820) === 'dock', `1024 x 768 would draw them at ${L.desktopLayout(1024, 768).scale.gears.toFixed(2)}, 1180 x 820 at ${L.desktopLayout(1180, 820).scale.gears.toFixed(2)}`);
	check('switch: every table is filled (desktop, upright, sideways)', !!L.TABLES.desktop && !!L.TABLES.upright && !!L.TABLES.sideways);
	check('switch: one constant rolls every screen back to the dock', k('landscape', 1920, 1080, 'dock') === 'dock' && L.gearBarLayout({ kind: 'landscape', vw: 1920, vh: 1080 }, 'dock') === null && L.GAME_BAR === 'gear');
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
