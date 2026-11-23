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
//   - the War Standard's run back (2 links, at a feature's first free spin and at its return to the base game): a real
//     run of the chain that the gears follow with the frame's wheels, with no jump when it is folded off
//   - the switch: desktop windows get the gear bar, the two popouts and every phone keep the dock, one constant rolls back
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
	// the windows the mock solved, by the one rule
	for (const [key, S] of Object.entries(STILLS)) {
		const [vw, vh] = key.split('x').map(Number);
		const G = up(vw, vh);
		check(`upright ${key}: the train fits`, !!G);
		if (!G) continue;
		const bad = faults(G);
		const scene = Object.entries(S).map(([n, b]) => [n, { x: b[0], y: b[1], w: b[2], h: b[3] }]);
		for (const id of L.PIECES) for (const [n, b] of scene) if (meet(G.box[id], b) || meet(G.press[id], b)) bad.push(`${id} on the ${n}`);
		check(`upright ${key}: meshed, on the window, < and > clear of the Play, nothing on the board, the plaque or the logo`, bad.length === 0, bad.slice(0, 4).join('; ') || `scale ${G.k.toFixed(3)}, Play ${f1(2 * G.gears.play.R)} (${G.gears.play.teeth} teeth), small ${f1(2 * G.gears.auto.R)}, the Armoury at ${G.gears.arm.deg}; Win ${G.where.win}, Balance ${G.where.bal}, the amount ${G.where.amt}`);
		check(`upright ${key}: the band's top is the plaque's shadow in the still`, near(G.band.plate, S.plaque[1] + S.plaque[3], 0.15), `${f1(G.band.plate)} against ${f1(S.plaque[1] + S.plaque[3])}`);
	}
	// the bottom safe area: a full screen web view on his phone
	const SA = up(402, 874, 34);
	check('upright 402 x 874 with a 34 px bottom safe area: the train stands on its edge, shrunk to 0.86 (a lift alone would put the Play on the plaque)', !!SA && near(SA.k, 0.863, 0.005) && faults(SA, 34).length === 0 && SA.gears.play.cy - SA.gears.play.R >= SA.band.top - 0.21, SA ? `scale ${SA.k.toFixed(3)}; ${faults(SA, 34).slice(0, 3).join('; ')}` : 'no fit');
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
		check(`upright sweep: ${n} phone windows solved (${dock} keep the dock), every one meshed, on the window, out of the safe area, < and > 8 px clear of the Play`, bad.length === 0 && n > 800, bad.slice(0, 4).join('; '));
	}
	// the switch
	const bk = (vw, vh, phoneFlag = true, mode) => (phone(vw, vh), L.barKind({ kind: 'portrait', vw, vh, phone: phoneFlag }, mode));
	check('upright switch: phones from 360 wide get the gear bar', ['402x874', '402x700', '390x844', '375x667', '425x812', '360x800'].every((s) => bk(...s.split('x').map(Number)) === 'gear'));
	check('upright switch: 320 x 568 keeps the dock (the chain does not fit), and so does a tablet held upright', bk(320, 568) === 'dock' && up(320, 568) === null && bk(820, 1180, false) === 'dock');
	check('upright switch: the rollback constant gives the dock', bk(402, 874, true, 'dock') === 'dock');
	const short = ['390x620', '360x740', '375x553'].filter((s) => bk(...s.split('x').map(Number)) === 'dock');
	console.log(`     note: phone windows that keep the dock because no arrangement fits: 320x568, ${short.join(', ')}`);
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
	const WANT = { '874x402': [106.7, 1], '852x393': [104.4, 1], '844x390': [103.6, 1], '812x425': [107.8, 1], '667x375': [86.4, 0.98] };
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
