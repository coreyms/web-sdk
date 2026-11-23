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
				const u = Math.max(0, Math.min(1, (t - p.t0) / p.ms));
				if (u >= 1) {
					const m = (((base + p.links) % 2) + 2) % 2;
					wound += base + p.links - m;
					base = m;
					live.splice(i, 1);
				} else moving += p.links * backOut(u);
			}
			F.frameGearsAt(wound + base + moving);
		}
		off();
		let back = 0;
		for (let i = 1; i < seen.length; i++) back = Math.min(back, seen[i] - seen[i - 1]);
		return { travel: F.frameGears.links - start, back, calls: seen.length };
	};
	for (const [tag, ms] of [['turbo 0', 1280], ['turbo 1', 1280 / 2.2], ['turbo 2', 1280 / 4]]) {
		const r = play([{ t0: 80, ms, links: 4 }], 1000 / 60);
		check(`the haul: a Spin press at ${tag} turns the HTML gears 4 links, and never back by a tile`, near(r.travel, 4, 1e-9) && r.back > -0.5, `travel ${r.travel.toFixed(4)}, largest step back ${r.back.toFixed(3)} (the overshoot's return)`);
	}
	const two = play([{ t0: 0, ms: 320, links: 4 }, { t0: 150, ms: 320, links: 4 }, { t0: 700, ms: 900, links: 1.4 }], 250);
	check('the haul: two presses on top of each other and a War Standard run of 1.4 links, at 4 frames a second (a hitch): 9.4 links', near(two.travel, 9.4, 1e-9) && two.back > -0.5, `travel ${two.travel.toFixed(4)}`);
}

// ---- 5. the switch ----
{
	const k = (kind, vw, vh, mode) => L.barKind({ kind, vw, vh }, mode);
	check('switch: desktop and laptop windows get the gear bar', ['1920x1080', '1200x675', '1024x576', '1280x720', '1366x768', '1440x900', '2560x1440', '2560x1080', '3440x1440'].every((s) => k('landscape', ...s.split('x').map(Number)) === 'gear'));
	check('switch: the two popouts keep the dock', k('landscape', 800, 450) === 'dock' && k('landscape', 400, 225) === 'dock');
	check('switch: a small window near 4:3 (an iPad held sideways) keeps the dock: its gears would be under 55 percent', k('landscape', 1024, 768) === 'dock' && k('landscape', 1180, 820) === 'dock', `1024 x 768 would draw them at ${L.desktopLayout(1024, 768).scale.gears.toFixed(2)}, 1180 x 820 at ${L.desktopLayout(1180, 820).scale.gears.toFixed(2)}`);
	check('switch: phones keep the dock until their tables are filled', L.TABLES.sideways === null && L.TABLES.upright === null && k('phone', 844, 390) === 'dock' && k('portrait', 390, 844) === 'dock' && k('portrait', 425, 812) === 'dock' && k('portrait', 320, 568) === 'dock');
	check('switch: one constant rolls every screen back to the dock', k('landscape', 1920, 1080, 'dock') === 'dock' && L.gearBarLayout({ kind: 'landscape', vw: 1920, vh: 1080 }, 'dock') === null && L.GAME_BAR === 'gear');
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
