// THE WIN ODOMETER (Manticore port 2026-11-21 of Run Over Reindeer's, Corey: "Yes" once Reindeer's was proven clean; his
// pick from the mock bar_win_count_r1: "Odomoter roll defaults works for me"): while the bonus round's TOTAL WIN banner
// (components/WarBanner.svelte, the war standard) counts its amount, the bar's WIN readout does not show the total. Each
// digit rolls in a fixed-width window like a car's mileage counter (a strip of 0 to 9 and 0 moved by translateY), then the
// digits lock onto the total one at a time from the left, the last one landing as the banner's count finishes. The
// separators and the currency marker stay plain. Pure functions of the banner's own clock (WarBanner's `clock`, real ms
// since the screen showed, and its count's start and end on that clock: WarBannerFlow.totalCount): ui/hud/HudReadout.svelte
// draws it, tools/win_odometer_test.mjs tests it. This file is Reindeer's src/ui/hud/winOdometer.ts with the same math and
// the same defaults; only the clock it reads and the cell's own numbers (WIN_ODOMETER_CELL, which Reindeer kept inline in
// its HudReadout.svelte and hud.css) differ.
//
// The mock's defaults and math, unchanged: a roll of 16 digits a second (the left digits slower: 62 % of it at the left
// to 100 % at the right, each 92 % to 108 % of that by a seeded random), a 260 ms spin-up from rest as the count
// starts, each lock an easeOutBack (c1 0.6) of 260 ms that takes over at the roll's own speed, the locks 70 ms apart
// (less when the count is too short for it: the room is the count less the spin-up, one lock and 120 ms). Each digit's
// roll speed is picked at the start so that its lock ends exactly on its digit.
// One change from the mock (Reindeer's too): when the nearest whole number of turns would leave a digit no roll at all (a
// 0 on a short count), it takes one more turn, so every lock lands on its digit (the mock's floor of 2 digits a second
// could land a short count's lock one digit off before the readout went plain).

export const WIN_ODOMETER = {
	/** digits a second, the rightmost digit's speed (the mock's "roll", default 16) */
	rollPerS: 16,
	/** ms between two digits' locks (the mock's "lock stagger", default 70) */
	staggerMs: 70,
	/** ms of each digit's lock (the mock's "lock", default 260) */
	lockMs: 260,
	/** the spin-up from rest as the count starts, ms */
	spinUpMs: 260,
	/** easeOutBack's c1 (the lock's overshoot) */
	back: 0.6,
	/** the count's room kept free of locks besides the spin-up and one lock, ms */
	spareMs: 120,
} as const;
export type OdometerOptions = { [K in keyof typeof WIN_ODOMETER]: number };

/** THE WIN CELL's own numbers around the roll (ui/hud/HudReadout.svelte, ui/hud/hud.css; Reindeer's values) */
export const WIN_ODOMETER_CELL = {
	/** the landing's pop on the whole WIN cell: its peak scale (the mock's 7.5 %) and its length, ms (hud.css wb-pop-cell
	 *  reads both through --odo-pop-scale and --odo-pop-ms, set on the cell from here) */
	popScale: 1.075,
	popMs: 460,
	/** the sunburst's landing flare before it settles to its hold, ms (the readout's own landing uses the same 720) */
	landHoldMs: 720,
	/** how long the banner's count is looked for before the readout gives up and shows the total plain (the banner starts
	 *  its count 400 ms into its screen, BANNER.timing.countStartMs; a safety net only) */
	findMs: 1500,
	/** the strip's pitch, em: one digit to the next on the strip (hud.css .ods i height; odoTransform below) */
	pitchEm: 1.6,
} as const;

/** one digit's window: its roll speed (digits a second), the roll's offset, the lock's start and end (show ms), the
 *  lock's travel (digits), the position at the lock's start and at its end, and the digit it lands on */
export type OdoColumn = { v: number; A: number; Ls: number; E: number; d: number; pL: number; T: number; digit: number };
export type OdoPlan = { C0: number; CE: number; stag: number; spinUpMs: number; back: number; cols: OdoColumn[] };

/** the mock's seeded random (a replay of the same total is the same run) */
export const odoRandom = (seed: number) => {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
};

/** the digits of a formatted amount, left to right (ASCII digits only: the separators and the currency never roll) */
export const odoDigits = (text: string): number[] => [...text].filter((c) => c >= '0' && c <= '9').map(Number);

/** the seed the mock used: the amount in cents and the digit count */
export const odoSeed = (amount: number, n: number) => Math.round(amount * 100) + n * 7;

/** THE PLAN, once per count: `digits` the total's, `C0` and `CE` the banner's count start and end (its clock, ms) */
export const planOdometer = (digits: number[], C0: number, CE: number, seed: number, o: OdometerOptions = WIN_ODOMETER): OdoPlan => {
	const n = digits.length;
	const R = o.spinUpMs;
	const k = 3 + o.back; // easeOutBack's slope at its start, so the lock takes over at the roll's own speed
	const lockMs = o.lockMs;
	const room = CE - C0 - R - lockMs - o.spareMs;
	const stag = n > 1 ? Math.max(0, Math.min(o.staggerMs, room / (n - 1))) : 0;
	const rr = odoRandom(seed);
	const cols = digits.map((digit, i) => {
		const target = o.rollPerS * (0.62 + 0.38 * (n > 1 ? i / (n - 1) : 1)) * (0.92 + 0.16 * rr()); // the right ones fastest
		const E = CE - (n - 1 - i) * stag; // this digit's lock ends here: the last one as the banner's count finishes
		const W = (E - C0 - R / 2 - ((k - 1) / k) * lockMs) / 1000;
		// a roll speed near the target that lands this digit exactly, with the lock's own length
		// (T: where the strip ends, unwrapped: its digit plus whole turns; a count too short to plan snaps to the digit)
		let v = target;
		let T = digit;
		if (W > 0.05) {
			let m = Math.round((target * W - digit) / 10);
			if (digit + 10 * m <= 0) m += 1;
			T = digit + 10 * m;
			v = T / W;
		}
		const A = (-v * (C0 + R / 2)) / 1000;
		const d = (v * lockMs) / 1000 / k;
		const Ls = E - lockMs;
		const pL = A + (v * Ls) / 1000;
		return { v, A, Ls, E, d, pL, T, digit };
	});
	return { C0, CE, stag, spinUpMs: R, back: o.back, cols };
};

/** a digit's strip position at show ms `t` (in digits, unwrapped): 0 before the count, the spin-up, the roll, the lock,
 *  then its digit (T, its face the digit) */
export const odoPos = (P: OdoPlan, o: OdoColumn, t: number): number => {
	if (t <= P.C0) return 0;
	if (t >= o.E) return o.T;
	if (t >= o.Ls) {
		const u = (t - o.Ls) / (o.E - o.Ls);
		const c1 = P.back;
		const c3 = c1 + 1;
		return o.pL + o.d * (1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2));
	}
	const s = t - P.C0;
	const R = P.spinUpMs;
	if (s < R) return (o.v * s * s) / (2 * R) / 1000;
	return o.A + (o.v * t) / 1000;
};

/** the strip's face for a position: 0 to 10 (10 is the strip's last 0), to a thousandth of a digit */
export const odoFace = (pos: number): number => {
	let p = pos % 10;
	if (p < 0) p += 10;
	return Math.round(p * 1000) / 1000;
};

/** the strip's transform for a face (the digits are WIN_ODOMETER_CELL.pitchEm, 1.6 em, apart on the strip) */
export const odoTransform = (face: number) => `translate3d(0, ${Math.round(-face * WIN_ODOMETER_CELL.pitchEm * 100000) / 100000}em, 0)`;

/** a digit is SHOWN once its lock has ended (before that it is moving, a roll or the lock's ease) */
export const odoLocked = (o: OdoColumn, t: number) => t >= o.E;

/** what the readout reads at show ms `t`, for the probes: each locked digit, '#' for a moving one, the separators */
export const odoReading = (text: string, P: OdoPlan, t: number): string => {
	let i = 0;
	let out = '';
	for (const c of text) {
		if (c >= '0' && c <= '9') {
			const o = P.cols[i++];
			out += o && odoLocked(o, t) ? String(o.digit) : '#';
		} else out += c;
	}
	return out;
};

/** THE DEV READ (__manticore.winOdometer, parent tools/manticore/hud_probe.js section `cards`): the readout's state,
 *  written by HudReadout as it draws (plain fields, a few assignments a frame) */
export const odoDev = {
	/** off: today's readout; wait: the banner is up, its count not started yet (zeros); roll; still: reduced motion (zeros);
	 *  done: the total, plain */
	mode: 'off' as 'off' | 'wait' | 'roll' | 'still' | 'done',
	text: '',
	showId: -1,
	/** the show ms the readout last drew at, and the count's end it read */
	t: 0,
	countEnd: 0,
	/** the show ms at which it went plain, and whether that was the count's end or a skip's landing */
	doneT: null as number | null,
	skipped: false,
	plan: null as OdoPlan | null,
	/** landing pops played, and the show whose landing popped last (a pop plays once a show, a rebuilt HUD too) */
	pops: 0,
	poppedId: -1,
	plans: 0,
	reduced: false,
};
export const readOdoDev = () => {
	const D = odoDev;
	const reading = D.mode === 'done' ? D.text : D.mode === 'roll' && D.plan ? odoReading(D.text, D.plan, D.t) : D.mode === 'off' ? null : D.text.replace(/[0-9]/g, '0');
	return { mode: D.mode, text: D.text, reading, showId: D.showId, t: Math.round(D.t), countEnd: Math.round(D.countEnd), doneT: D.doneT === null ? null : Math.round(D.doneT), skipped: D.skipped, pops: D.pops, plans: D.plans, reduced: D.reduced, stagger: D.plan ? Math.round(D.plan.stag) : null };
};
