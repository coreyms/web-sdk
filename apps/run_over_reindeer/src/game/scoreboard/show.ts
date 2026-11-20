// THE SCOREBOARD'S SHOWS (bigwin_led_r3_2026-11-16, Corey's r3b; constants LED_BOARD): a win as the strip and the back
// board play it, as a pure function of its own clock (ms since it started). Nothing here decides an outcome: the amount is
// the book's, the tier only names it (the ladder below, in multiples of the play amount), and the count is the house pacer.
//
//   THE LADDER (the mock's, Manticore's): Big 15x, Super 30x, Mega 60x, Epic 150x, Max 7,777x (the cap). A win under the Big
//   bar is a SMALL win: WIN and the amount count on the strip in 1 s, then the reindeer hops across (decoration, not waited).
//   Big and Super count on the strip; Mega, Epic and Max bring the BACK BOARD up (it rises from behind the strip and seats on
//   it) and the strip keeps its own line (the tier and the counting amount). The book's final amount is known at the start,
//   so the whole ladder plays on the board the final tier needs.
//   THE HOUSE PACER (the Angry Mantis rule, game/stinger/count.ts in Manticore): the whole count lasts countMs of the FINAL
//   tier (3, 4, 5, 6, 7 s) at normal speed, divided by the turbo level's rate; every bar it crosses gets min(15 % of it,
//   0.9 s) ending on the bar, the final tier the rest, at least 40 %; linear, no pause at a bar. Then the hold (1.2 s, 0.4 s
//   in autoplay) and the board powers down and lowers.
//   THE SKIP (the house rule, Manticore's Win.svelte): a press while it counts lands the amount and the final tier at once
//   (one beat); a press during the hold ends the hold. No prompt, no press gate.
import { LED_BOARD } from '../constants';
import config from '../config';

export type Seg = { to: number; ms: number };
/** win: a Big win and up; small: under the Big bar; fs, sfs: the Free Spins and the Super entries; total: the bonus round's
 *  Total Win (part B: the three bonus round cards on the back board, they wait for a press) */
/** (2026-11-17) press: the press screen after the studio splash on the expanded back board (newPressShow below) */
export type ShowKind = 'win' | 'small' | 'fs' | 'sfs' | 'total' | 'press';
export type Show = {
	id: number;
	kind: ShowKind;
	/** the final tier (0 Big .. 4 Max) for a win, -1 for a small win */
	final: number;
	/** the back board plays it (Mega and up) */
	arrive: boolean;
	/** ms since it started (real ms) */
	t: number;
	/** the amount in the play currency's units, and its LED string at the end */
	amount: number;
	finalStr: string;
	fmt: (v: number) => string;
	/** the ladder's upgrade bars (Super, Mega, Epic, Max) in the currency's units */
	bars: number[];
	segs: Seg[];
	contentAt: number;
	countStart: number;
	countEnd: number;
	events: { tier: number; at: number }[];
	finalTier: number;
	exitAt: number;
	end: number;
	/** the house slide: when the row widens it starts where the old digits were and slides to the centre */
	widen: { at: number; from: string; to: string }[];
	skipped: boolean;
	hold: number;
	/** the back board's offset when this show took it over (a rise that starts while the last one still lowers) */
	fromD: number | null;
	/** the tiers whose moment has been played (onTier: each once, a skip's final tier too) */
	fired: Set<number>;
	/** PART B, the cards: the scene's own clock starts here (show ms; a press before the press line moves it on to the
	 *  READY beat), the strip's press line from pressLineAt (null: none), the spins the entry awards */
	sceneAt: number;
	pressLineAt: number | null;
	spins: number;
	/** a Total Win's own title (MAX WIN on a capped round) and the line the strip scrolls once it waits (a top-up, the cap;
	 *  the HTML card's lines, 2026-11-17), null: TOTAL WIN, none */
	title: string | null;
	line: string | null;
	/** (2026-11-19, LED_BOARD.ideas) the round's win in play multiples (0: not known) and whether the round hit the cap: the
	 *  Total Win's ladder and its size class read them (a win's tier reads `final`) */
	x: number;
	capped: boolean;
	/** (2026-11-20) an entry's trigger scatter count, the book's freeSpinTrigger cells (0: not known) */
	presents: number;
};
/** the three bonus round cards on the back board */
export const isCard = (s: Show | null): boolean => !!s && (s.kind === 'fs' || s.kind === 'sfs' || s.kind === 'total');

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** the tier a win of `x` times the play amount names: -1 under the Big bar */
export const tierOf = (x: number): number => {
	const T = LED_BOARD.tiers;
	let k = -1;
	for (let i = 0; i < T.length; i++) if (x >= T[i].bar) k = i;
	return k;
};

/** the house pacer's segments: each bar crossed, then the final tier's remainder */
export const segmentsFor = (amount: number, total: number, bars: number[]): Seg[] => {
	const P = LED_BOARD.pace;
	const crossed = bars.filter((b) => b < amount);
	const pre = Math.min(total * P.barShare, P.barMaxMs);
	return [...crossed.map((to) => ({ to, ms: pre })), { to: amount, ms: Math.max(total - crossed.length * pre, total * P.finalMinShare) }];
};
export const amountAtCount = (segs: Seg[], ms: number): number => {
	if (ms <= 0) return 0;
	let from = 0;
	let t = ms;
	for (const s of segs) {
		if (t < s.ms) return from + ((s.to - from) * t) / s.ms;
		t -= s.ms;
		from = s.to;
	}
	return from;
};

let SHOW_ID = 0;

/** a new show. `x` the win in play multiples (the tier), `amount` and `bet` in the currency's units, `rate` the turbo
 *  level's clock rate (the count only), `auto` an autoplay run (the short hold) */
export const newShow = (o: { x: number; amount: number; bet: number; fmt: (v: number) => string; rate: number; auto: boolean; small?: boolean; countMs?: number }): Show => {
	const L = LED_BOARD;
	const tier = tierOf(o.x);
	const small = o.small || tier < 0;
	const final = small ? -1 : tier;
	const arrive = !small && final >= L.backFromTier;
	const contentAt = arrive ? L.rise.backAtMs + L.rise.riseMs : L.strip.switchMs;
	const s: Show = {
		id: ++SHOW_ID,
		kind: small ? 'small' : 'win',
		final,
		arrive,
		t: 0,
		amount: o.amount,
		finalStr: o.fmt(o.amount),
		fmt: o.fmt,
		bars: L.tiers.slice(1).map((x) => x.bar * o.bet),
		segs: [],
		contentAt,
		countStart: contentAt,
		countEnd: contentAt,
		events: [],
		finalTier: final,
		exitAt: 0,
		end: 0,
		widen: [],
		skipped: false,
		hold: o.auto ? L.pace.holdAutoMs : L.pace.holdMs,
		fromD: null,
		fired: new Set(),
		sceneAt: contentAt,
		pressLineAt: null,
		spins: 0,
		title: null,
		line: null,
		x: o.x,
		capped: false,
		presents: 0,
	};
	if (small) {
		// (2026-11-17: a line win's strip total counts over its own time, LINE_WIN.slam stripCountMs at the turbo level's pace)
		s.countEnd = s.countStart + (o.countMs ?? L.small.countMs);
		s.exitAt = s.countEnd + L.small.holdMs;
		s.end = s.exitAt;
		return s;
	}
	const total = L.pace.countMs[final] / Math.max(0.2, o.rate);
	s.segs = segmentsFor(o.amount, total, s.bars);
	const countMs = s.segs.reduce((a, g) => a + g.ms, 0);
	s.countEnd = s.countStart + countMs;
	s.events.push({ tier: 0, at: s.countStart });
	let acc = s.countStart;
	for (let i = 0; i < s.segs.length - 1; i++) {
		acc += s.segs[i].ms;
		s.events.push({ tier: i + 1, at: acc });
	}
	if (o.amount >= s.bars[s.bars.length - 1]) s.events.push({ tier: 4, at: s.countEnd });
	s.finalTier = s.events[s.events.length - 1].tier;
	s.exitAt = s.countEnd + s.hold;
	s.end = s.exitAt + (arrive ? L.rise.powerDownMs + L.rise.lowerMs : L.strip.dimOutMs);
	let prev = o.fmt(0).length;
	for (let ms = 0; ms <= countMs; ms += 4) {
		const n = o.fmt(amountAtCount(s.segs, ms)).length;
		if (n > prev) {
			s.widen.push({ at: s.countStart + ms, from: o.fmt(amountAtCount(s.segs, Math.max(0, ms - 4))), to: o.fmt(amountAtCount(s.segs, ms)) });
			prev = n;
		}
	}
	return s;
};

/** THE TOTAL WIN'S SIZE CLASS (2026-11-19, LED_BOARD.ideas): small under the Big bar, big under the Epic bar, huge from it,
 *  max on a capped round (the bars are LED_BOARD.tiers', never thresholds of its own) */
export type WinSize = 'small' | 'big' | 'huge' | 'max';
export const winSizeOf = (x: number, capped: boolean): WinSize => {
	if (capped) return 'max';
	const t = tierOf(x);
	return t < 0 ? 'small' : t < 3 ? 'big' : 'huge';
};
/** THE LADDER'S RUNGS (tw-ladder) in play multiples: LED_BOARD.tiers' bars, the top one the math's cap (config.maxWin) */
export const ladderBars = (): number[] => LED_BOARD.tiers.map((x, i, a) => (i === a.length - 1 ? config.maxWin : x.bar));

/** A BONUS ROUND CARD on the back board (part B): the Free Spins entry, the Super entry (`spins` awarded) or the Total Win
 *  (`amount`, counted over LED_BOARD.scenes.totalCountMs divided by the turbo level's rate). It rises as a Mega win does
 *  and waits: the card's own press ends it (endShow), never a timer of its own. (2026-11-19, LED_BOARD.ideas) `x` the
 *  round's win in play multiples, `capped` the cap: with the ladder the count runs on the house pacer (each rung crossed
 *  gets its moment; the count's length is the same), the length by size and the cap page's hold are switches left off. */
export const newCardShow = (o: { kind: 'fs' | 'sfs' | 'total'; spins: number; amount: number; fmt: (v: number) => string; rate: number; title?: string | null; line?: string | null; x?: number; capped?: boolean; auto?: boolean; presents?: number }): Show => {
	const L = LED_BOARD;
	const S = L.scenes;
	const I = L.ideas;
	const contentAt = L.rise.backAtMs + L.rise.riseMs;
	const s: Show = {
		id: ++SHOW_ID,
		kind: o.kind,
		final: -1,
		arrive: true,
		t: 0,
		amount: o.amount,
		finalStr: o.fmt(o.amount),
		fmt: o.fmt,
		bars: [],
		segs: [],
		contentAt,
		countStart: contentAt,
		countEnd: contentAt,
		events: [],
		finalTier: -1,
		exitAt: 1e12,
		end: 1e12,
		widen: [],
		skipped: false,
		hold: 0,
		fromD: null,
		fired: new Set(),
		sceneAt: contentAt,
		pressLineAt: null,
		spins: o.spins,
		title: o.title ?? null,
		line: o.line ?? null,
		x: o.x ?? 0,
		capped: !!o.capped,
		presents: Math.max(0, Math.round(o.presents ?? 0)),
	};
	if (o.kind === 'total') {
		// (the count's length: today's flat totalCountMs, or by the round's size when that switch is on; a turbo level divides it)
		const base = I.totalBySize.on && s.x > 0 ? I.totalBySize.ms[winSizeOf(s.x, s.capped)] : S.totalCountMs;
		const total = base / Math.max(0.2, o.rate);
		s.countEnd = contentAt + total;
		// THE LADDER'S COUNT: the house pacer over the rungs (LED_BOARD.pace: each bar crossed min(barShare, barMaxMs), the rest
		// to the final stretch, at least finalMinShare): the board's amount and the strip's are this one count
		if (I.total === 'ladder' && s.x > 0 && o.amount > 0) {
			const play = o.amount / s.x;
			// (a rung at the amount itself, the cap's, is not crossed: float noise never makes it one)
			s.bars = ladderBars()
				.map((b) => b * play)
				.filter((b) => b < o.amount * (1 - 1e-9));
			s.segs = segmentsFor(o.amount, total, s.bars);
		}
		// (a wrap-up with its own line, a top-up or the cap: the line and the press line come as the amount lands; a capped
		// round's page after capPageHold when that switch is on)
		// (not when Autoplay Bonuses continues the wrap-up by itself, ROUND.wrapAutoHoldMs after the landing: the cap's line
		// then wipes in at the landing as before, so it is still seen)
		const capHold = s.capped && I.capPageHold.on && !o.auto ? I.capPageHold.ms : 0;
		s.pressLineAt = s.countEnd + (s.line ? capHold : S.totalPressAfterMs);
	} else s.pressLineAt = contentAt + (o.kind === 'sfs' ? S.sfsPressMs : S.fsPressMs);
	return s;
};
/** A PRESS ON A CARD (part B; the house skip, as a win's): before the press line it LANDS the scene (an entry jumps to its
 *  READY beat with the press line up, the Total Win's count lands), and returns true; once landed it returns false (the
 *  press continues: the card is dismissed). */
export const landCard = (s: Show): boolean => {
	if (!isCard(s) || s.t >= s.exitAt) return false;
	const S = LED_BOARD.scenes;
	if (s.kind === 'total') {
		if (s.t >= s.countEnd) return false;
		const at = Math.max(s.t, s.countStart);
		s.skipped = true;
		s.countEnd = at;
		s.pressLineAt = at + S.totalPressAfterMs;
		return true;
	}
	if (s.pressLineAt === null || s.t >= s.pressLineAt) return false;
	const ready = s.kind === 'sfs' ? S.sfsReadyMs : S.fsReadyMs;
	s.skipped = true;
	s.sceneAt = Math.min(s.sceneAt, s.t - ready);
	s.pressLineAt = s.t;
	return true;
};

/** THE SHAKE now (CSS px, the mock's shakeAt): Mega, Epic and Max shake as their tier is reached (a skip's final tier too),
 *  every tier change after Big jolts, the Super entry shakes as its scene starts. `sc` is the board's size factor. */
export const shakeAt = (s: Show | null, sc: number): number => {
	const K = LED_BOARD.shake;
	if (!s || !K.on) return 0;
	let dy = 0;
	const hit = (at: number, amp: number) => {
		const dt = s.t - at;
		if (dt >= 0 && dt < K.ms) dy += amp * K.px * sc * Math.sin((dt / K.periodMs) * Math.PI * 2) * Math.exp(-dt / K.decayMs);
	};
	for (const e of s.events) {
		if (e.tier >= 2) hit(e.at, K.amp[e.tier] ?? 0);
		const dt = s.t - e.at;
		if (e.tier > 0 && dt >= 0 && dt < K.joltMs) dy += K.joltPx * sc * Math.sin((dt / K.joltMs) * Math.PI);
	}
	if (s.kind === 'sfs') hit(s.contentAt, K.superEntryAmp);
	return dy;
};

/** the amount shown now */
export const amountNow = (s: Show): number => {
	if (s.t >= s.countEnd) return s.amount;
	if (s.kind === 'fs' || s.kind === 'sfs') return 0;
	// (the ladder's Total Win runs on its pacer: its segments end on the count's end)
	if (s.kind === 'total' && s.segs.length) return Math.min(s.amount, amountAtCount(s.segs, s.t - s.countStart));
	if (s.kind === 'small' || s.kind === 'total') return s.amount * clamp((s.t - s.countStart) / Math.max(1, s.countEnd - s.countStart), 0, 1);
	return amountAtCount(s.segs, s.t - s.countStart);
};
/** the tier shown now (-1 before the count) */
export const tierNow = (s: Show): number => {
	let k = -1;
	for (const e of s.events) if (s.t >= e.at) k = e.tier;
	return k;
};

/** THE SKIP: while it counts, the amount and the final tier land at once (one beat); during the hold, the hold ends.
 *  Returns whether it took. */
export const skipShow = (s: Show): boolean => {
	if (s.kind !== 'win') return false;
	const L = LED_BOARD;
	const tail = s.arrive ? L.rise.powerDownMs + L.rise.lowerMs : L.strip.dimOutMs;
	if (s.t < s.countEnd) {
		const at = Math.max(s.t, s.countStart);
		s.skipped = true;
		s.events = s.events.filter((e) => e.at <= s.t);
		const last = s.events.length ? s.events[s.events.length - 1].tier : -1;
		if (last < s.finalTier) s.events.push({ tier: s.finalTier, at });
		s.widen = s.widen.filter((w) => w.at <= s.t);
		s.countEnd = at;
		s.exitAt = at + s.hold;
		s.end = s.exitAt + tail;
		return true;
	}
	if (s.t < s.exitAt) {
		s.exitAt = s.t;
		s.end = s.t + tail;
		return true;
	}
	return false;
};

/** cut it now (a new show takes the strip, a new spin's press for a small win) */
export const endShow = (s: Show) => {
	const L = LED_BOARD;
	if (s.t < s.exitAt) {
		s.exitAt = s.t;
		if (s.countEnd > s.t) s.countEnd = s.t;
		s.end = s.t + (s.arrive ? L.rise.powerDownMs + L.rise.lowerMs : 0);
	}
};

/** the phase, for the dev hook and the probe */
export const phaseOf = (s: Show | null): string => {
	if (!s) return 'idle';
	if (s.t < s.contentAt) return s.arrive ? 'rising' : 'switching';
	if (isCard(s)) {
		if (s.t >= s.exitAt) return s.t < s.end ? 'lowering' : 'gone';
		if (s.t < s.countEnd) return 'count';
		return s.pressLineAt !== null && s.t >= s.pressLineAt ? 'waits' : 'show';
	}
	if (s.t < s.countEnd) return 'count';
	if (s.t < s.exitAt) return 'hold';
	if (s.t < s.end) return s.arrive ? 'lowering' : 'leaving';
	return 'gone';
};

/** THE BACK BOARD'S RISE AND LOWERING, style C (Corey's r3b pick): it rises past its seat (an overshoot) and drops back
 *  into place with one small bounce; lowering starts with a little hop up, then it drops. Returns how far below its seat
 *  the board is (CSS px; 0 = seated, D = fully down behind the strip). `sc` scales the bounce and the hop with the board. */
export const backOffset = (s: Show | null, D: number, sc: number): number => {
	if (!s || !s.arrive) return D;
	const R = LED_BOARD.rise;
	const from = s.fromD ?? D;
	const u = clamp((s.t - R.backAtMs) / R.riseMs, 0, 1);
	const after = s.t - (R.backAtMs + R.riseMs);
	const back = R.overshoot;
	const e = u <= 0 ? 0 : 1 + (back + 1) * Math.pow(u - 1, 3) + back * Math.pow(u - 1, 2);
	let y = from * (1 - e);
	if (u >= 1 && after < R.bounceMs) y += R.bouncePx * sc * Math.abs(Math.sin((after / R.bounceMs) * Math.PI));
	let down = 0;
	if (s.t > s.exitAt + R.powerDownMs) down = clamp((s.t - s.exitAt - R.powerDownMs) / R.lowerMs, 0, 1);
	if (down > 0) {
		// a lowering that starts before the board has seated starts from where it is
		const start = Math.max(0, Math.min(D, y));
		const hop = down < 0.25 ? -R.hopPx * sc * Math.sin((down / 0.25) * Math.PI) : 0;
		y = start + (D - start) * Math.pow(clamp((down - 0.2) / 0.8, 0, 1), 2) + hop;
	}
	return y;
};

/** the moment the board is seated (show ms): the rise and its bounce are over */
export const seatedAt = () => LED_BOARD.rise.backAtMs + LED_BOARD.rise.riseMs + LED_BOARD.rise.bounceMs;

/** the back board's face brightness while it powers down (a flicker, then it dims) */
export const brightOf = (s: Show | null): number => {
	if (!s || !s.arrive) return 1;
	const dt = s.t - s.exitAt;
	if (dt < 0) return 1;
	if (dt < 120) return [1, 0.3, 1][Math.floor(dt / 40)] ?? 0.3;
	return 1 - 0.6 * clamp((dt - 120) / 130, 0, 1);
};

/** the scene's dim while the back board is up (its alpha) */
export const dimAlpha = (s: Show | null): number => {
	if (!s || !s.arrive) return 0;
	const D = LED_BOARD.dim;
	let v = D.alpha * clamp(s.t / D.inMs, 0, 1);
	if (s.t > s.exitAt) v *= 1 - clamp((s.t - s.exitAt) / D.outMs, 0, 1);
	return v;
};

/** THE PRESS SCREEN (2026-11-17, Corey approved: the press screen uses the game's own expanded LED board): the back board
 *  rises as a card's does and stays up with the dim; the explainer screens cycle on it (game/scoreboard/stripDraw.ts
 *  showPressScreens) and the strip says PRESS ANYWHERE TO CONTINUE once the press gate is open. The press ends it (endShow):
 *  the board powers down and lowers with the game's own motion and the dim lifts. Never a timer of its own. */
export const newPressShow = (fmt: (v: number) => string): Show => {
	const s = newCardShow({ kind: 'fs', spins: 0, amount: 0, fmt, rate: 1 });
	s.kind = 'press';
	s.pressLineAt = null;
	return s;
};
