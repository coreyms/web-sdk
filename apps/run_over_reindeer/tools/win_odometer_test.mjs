// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// THE WIN ODOMETER, A PURE TEST (no browser): src/ui/hud/winOdometer.ts (the roll's timing, the same file the HUD's WIN
// readout runs) is planned for many totals and count lengths and walked millisecond by millisecond.
//   node --experimental-strip-types --no-warnings tools/win_odometer_test.mjs
// Checked:
//   - the mock's defaults (bar_win_count_r1: roll 16 digits a second, lock stagger 70 ms, lock 260 ms, spin-up 260 ms,
//     easeOutBack c1 0.6) and, where the mock's own math lands a digit, the same positions as the mock's code
//   - every digit's lock ends exactly on its digit, the last one at the count's end, the locks left to right, the stagger
//     at most 70 ms and cut down on a short count so every lock fits
//   - the reading (locked digits only) is never the total before the count's end and is the total at it
//   - the strip never jumps: the position is continuous from the count's start to each lock's end, and the lock takes
//     over at the roll's own speed
//   - every face is on the strip (0 to 10) and the transform is the strip's 1.6em pitch
//   - the same total and count plan the same roll (a rebuilt HUD continues it)
import { WIN_ODOMETER, odoDigits, odoFace, odoLocked, odoPos, odoReading, odoSeed, odoTransform, planOdometer, odoRandom } from '../src/ui/hud/winOdometer.ts';

let fails = 0;
let checks = 0;
const check = (ok, what, detail) => {
	checks++;
	if (!ok) {
		fails++;
		if (fails <= 40) console.log(`  FAIL ${what}${detail !== undefined ? ' ' + JSON.stringify(detail) : ''}`);
	}
};

// the mock's own code (bar_win_count_r1 index.html buildOdo and odoPos), for the parity check
function mockPlan(digits, C0, CE, amount) {
	const S = { roll: 16, stag: 70, lock: 260 };
	const n = digits.length;
	const R = 260;
	const k = 3 + 0.6;
	const lockMs = S.lock;
	const countMs = CE - C0;
	const room = countMs - R - lockMs - 120;
	const stag = n > 1 ? Math.max(0, Math.min(S.stag, room / (n - 1))) : 0;
	let s = (Math.round(amount * 100) + n * 7) >>> 0;
	const rr = () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 4294967296;
	};
	return digits.map((digit, i) => {
		const target = S.roll * (0.62 + 0.38 * (n > 1 ? i / (n - 1) : 1)) * (0.92 + 0.16 * rr());
		const E = CE - (n - 1 - i) * stag;
		const W = (E - C0 - R / 2 - ((k - 1) / k) * lockMs) / 1000;
		let v = target;
		if (W > 0.05) {
			const m = Math.round((target * W - digit) / 10);
			v = Math.max(2, (digit + 10 * m) / W);
		}
		const A = (-v * (C0 + R / 2)) / 1000;
		const d = (v * lockMs) / 1000 / k;
		const Ls = E - lockMs;
		const pL = A + (v * Ls) / 1000;
		return { v, A, Ls, E, d, pL, T: pL + d, digit, stag };
	});
}
function mockPos(o, t, C0) {
	const R = 260;
	if (t <= C0) return 0;
	if (t >= o.E) return o.T;
	if (t >= o.Ls) {
		const u = (t - o.Ls) / (o.E - o.Ls);
		const c1 = 0.6;
		const c3 = c1 + 1;
		return o.pL + o.d * (1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2));
	}
	const s = t - C0;
	if (s < R) return (o.v * s * s) / (2 * R) / 1000;
	return o.A + (o.v * t) / 1000;
}

// the defaults are the mock's
check(WIN_ODOMETER.rollPerS === 16 && WIN_ODOMETER.staggerMs === 70 && WIN_ODOMETER.lockMs === 260 && WIN_ODOMETER.spinUpMs === 260 && WIN_ODOMETER.back === 0.6 && WIN_ODOMETER.spareMs === 120, 'the mock defaults', WIN_ODOMETER);
// the random is the mock's
{
	const a = odoRandom(12345);
	let s = 12345 >>> 0;
	let same = true;
	for (let i = 0; i < 1000; i++) {
		s = (s * 1664525 + 1013904223) >>> 0;
		if (a() !== s / 4294967296) same = false;
	}
	check(same, 'the seeded random is the mock\'s');
}

const TOTALS = ['$12.40', '$248.50', '$1,234,567.89', '$0.10', '$0.20', '$1.00', '$10.00', '$100.00', '$9,999,999.99', 'SC 248.50', '$0.0025', '$7,777.00', '$45.70', '$3.05'];
// the count lengths (ms): the size classes 1.5 / 3 / 4 / 5 s, the mock's 5.75 s, turbo rates 2 and 3, and short ones
const LENGTHS = [1500, 3000, 4000, 5000, 5750, 750, 500, 1000, 1333, 2000, 600, 420, 300];
const C0 = 620;
let mockSame = 0;
let mockCompared = 0;
for (const text of TOTALS) {
	const digits = odoDigits(text);
	const amount = Number(text.replace(/[^0-9.]/g, ''));
	check(digits.join('') === text.replace(/[^0-9]/g, ''), `${text}: the digits`, digits);
	for (const L of LENGTHS) {
		const CE = C0 + L;
		const seed = odoSeed(amount, digits.length);
		const P = planOdometer(digits, C0, CE, seed);
		const tag = `${text} over ${L} ms`;
		const n = digits.length;
		check(P.cols.length === n, `${tag}: a window per digit`);
		check(P.stag >= 0 && P.stag <= 70 + 1e-9, `${tag}: the stagger at most 70 ms (${P.stag})`);
		if (n > 1 && L - 260 - 260 - 120 >= 70 * (n - 1)) check(Math.abs(P.stag - 70) < 1e-9, `${tag}: the full stagger when it fits (${P.stag})`);
		check(Math.abs(P.cols[n - 1].E - CE) < 1e-9, `${tag}: the last lock ends at the count's end`);
		for (let i = 1; i < n; i++) check(P.cols[i].E >= P.cols[i - 1].E - 1e-9, `${tag}: the locks left to right (${i})`);
		for (const o of P.cols) {
			check(odoFace(odoPos(P, o, o.E)) === o.digit && odoFace(odoPos(P, o, o.E + 500)) === o.digit, `${tag}: a lock ends on its digit ${o.digit}`);
			// a lock planned with room to roll lands on its digit by its own motion, not by a snap at its end
			if ((o.E - C0 - 130 - (2.6 / 3.6) * 260) / 1000 > 0.05) {
				const before = odoFace(odoPos(P, o, o.E - 0.001));
				const dist = Math.min(Math.abs(before - o.digit), Math.abs(before - o.digit - 10), Math.abs(before - o.digit + 10));
				check(dist < 0.01, `${tag}: the lock's own motion lands on ${o.digit} (${before})`);
				check(Math.abs(((o.T % 10) + 10) % 10 - o.digit) < 1e-6 || Math.abs(((o.T % 10) + 10) % 10 - o.digit - 10) < 1e-6 || Math.abs(((o.T % 10) + 10) % 10 - o.digit + 10) < 1e-6, `${tag}: the planned travel ends on ${o.digit} (${o.T})`);
				check(o.v > 0, `${tag}: it rolls forward (${o.v})`);
			}
		}
		// walk it
		let prev = P.cols.map((o) => odoPos(P, o, C0));
		let early = 0;
		let jumps = 0;
		for (let t = 0; t <= CE + 50; t += 1) {
			const reading = odoReading(text, P, t);
			if (t < CE && reading === text) early++;
			if (t >= CE) check(reading === text, `${tag}: the total at and after the count's end (${t}: ${reading})`);
			for (let i = 0; i < n; i++) {
				const o = P.cols[i];
				const p = odoPos(P, o, t);
				const f = odoFace(p);
				if (!(f >= 0 && f <= 10)) check(false, `${tag}: a face on the strip`, { t, f });
				// continuity: a 1 ms step never moves the strip by more than the fastest roll's ms and a little (only where the
				// lock starts after the spin-up: the mock's own short-count corner aside)
				if (t > C0 && t <= o.E && o.Ls >= C0 + 260 && (o.E - C0 - 130 - (2.6 / 3.6) * 260) / 1000 > 0.05) {
					const dv = Math.abs(p - prev[i]);
					if (dv > (o.v / 1000) * 1.6 + 1e-6) jumps++;
				}
				prev[i] = p;
			}
		}
		check(early === 0, `${tag}: never the total before the count's end (${early} ms)`);
		check(jumps === 0, `${tag}: no jump in any strip (${jumps})`);
		// the lock takes over at the roll's own speed
		for (const o of P.cols) {
			if (o.Ls < C0 + 260 + 1) continue;
			const before = (odoPos(P, o, o.Ls) - odoPos(P, o, o.Ls - 1)) * 1000;
			const after = (odoPos(P, o, o.Ls + 1) - odoPos(P, o, o.Ls)) * 1000;
			check(Math.abs(before - after) / Math.max(1, o.v) < 0.05, `${tag}: the lock starts at the roll's speed (${before.toFixed(2)} then ${after.toFixed(2)} digits a second)`);
		}
		// the mock's own positions, where its math lands the digit (its floor of 2 digits a second untouched)
		const M = mockPlan(digits, C0, CE, amount);
		for (let i = 0; i < n; i++) {
			const m = M[i];
			const o = P.cols[i];
			const W = (m.E - C0 - 130 - (2.6 / 3.6) * 260) / 1000;
			if (!(W > 0.05)) continue;
			if (Math.abs(m.v - o.v) > 1e-9) continue; // the one change: a digit the mock left on its floor speed
			mockCompared++;
			let same = Math.abs(m.E - o.E) < 1e-9;
			for (let t = 0; t < m.E; t += 7) if (Math.abs(mockPos(m, t, C0) - odoPos(P, o, t)) > 1e-9) same = false;
			if (same) mockSame++;
			else check(false, `${tag}: digit ${i} rolls as the mock's`);
		}
		// the same inputs, the same plan
		check(JSON.stringify(planOdometer(digits, C0, CE, seed)) === JSON.stringify(P), `${tag}: the same plan again`);
	}
}
check(mockCompared > 200 && mockSame === mockCompared, `the mock's positions (${mockSame} of ${mockCompared} windows the same)`);
// a reading's separators are the text's own, the moving digits '#'
{
	const P = planOdometer(odoDigits('$1,234,567.89'), C0, C0 + 5000, 1);
	check(odoReading('$1,234,567.89', P, C0 + 100) === '$#,###,###.##', 'the reading while it rolls', odoReading('$1,234,567.89', P, C0 + 100));
	check(odoLocked(P.cols[0], P.cols[0].E) && !odoLocked(P.cols[1], P.cols[0].E), 'the first lock before the second');
}
check(odoTransform(0) === 'translate3d(0, 0em, 0)' && odoTransform(3) === 'translate3d(0, -4.8em, 0)' && odoTransform(9.5) === 'translate3d(0, -15.2em, 0)', 'the strip transform', [odoTransform(0), odoTransform(3), odoTransform(9.5)]);
check(odoFace(-0.25) === 9.75 && odoFace(23.4567) === 3.457 && odoFace(10) === 0, 'the face wraps the strip', [odoFace(-0.25), odoFace(23.4567), odoFace(10)]);

console.log(`win odometer: ${checks - fails} of ${checks} checks pass (${mockSame} windows against the mock's code)`);
if (fails) {
	console.log(`FAIL ${fails}`);
	process.exit(1);
}
console.log('PASS');
