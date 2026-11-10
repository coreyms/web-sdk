// THE FIXTURE RGS (dev only): answers the game's own RGS requests inside the page from the hand-written rounds
// (fixtureRounds.ts), so the first pass plays end to end with no server: Authenticate, /wallet/play, the book
// events through game/bookEventHandlerMap.ts, /wallet/end-round. It is the SAME path the real game uses; only
// the far end of the request is here instead of on a server.
//
// When it applies: the dev server, and the address has no rgs_url or rgs_url=fixture. With a real rgs_url (the
// mock RGS serving this game's books, once the math has some) nothing here runs.
// A production build never includes this file (routes/+layout.svelte calls it under import.meta.env.DEV).
//
// The wallet here is bookkeeping for the demo only (debit the price, credit the book's payout). It decides
// nothing about a round: which round comes next is the fixed order below, or the one named through the dev
// hook (window.__reindeer.fixtures).
import config from '../game/config';
import { FIXTURE_ORDER, FIXTURE_ROUNDS, type FixtureRound } from './fixtureRounds';

const MULT = 1_000_000; // API amounts are millionths of a unit
const HOST = 'fixture';
const START_BALANCE = 1_000 * MULT;
// the house's 32 level bet ladder, in units (the same one tools/mock_rgs.py serves)
const BET_LEVELS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 30, 40, 50, 75, 100].map((d) => Math.round(d * MULT));
/** the wait before each answer, ms (window.__reindeer.fixtures.latency) */
let latencyMs = 120;

type Json = Record<string, unknown>;

const state = {
	balance: START_BALANCE,
	next: 0,
	forced: null as string | null,
	sticky: false,
	/** a book handed over through the dev hook, played once on the next spin */
	custom: null as FixtureRound | null,
	round: null as Json | null,
	plays: [] as { name: string; mode: string; amount: number; payout: number }[],
};

const byName = (name: string): FixtureRound | undefined => FIXTURE_ROUNDS.find((r) => r.name === name);

const pick = (): FixtureRound => {
	if (state.custom) {
		const round = state.custom;
		state.custom = null;
		return round;
	}
	if (state.forced) {
		const round = byName(state.forced);
		if (!state.sticky) state.forced = null;
		if (round) return round;
	}
	const round = byName(FIXTURE_ORDER[state.next % FIXTURE_ORDER.length]) ?? FIXTURE_ROUNDS[0];
	state.next += 1;
	return round;
};

const costOf = (mode: string): number => (config.betModes as Record<string, { cost: number }>)[mode.toLowerCase()]?.cost ?? 1;

const handle = (path: string, body: Json): { status: number; data: Json } => {
	const balance = () => ({ amount: state.balance, currency: 'USD' });
	if (path === '/wallet/authenticate') {
		return {
			status: 200,
			data: {
				balance: balance(),
				config: {
					gameID: config.gameID,
					minBet: BET_LEVELS[0],
					maxBet: BET_LEVELS[BET_LEVELS.length - 1],
					stepBet: BET_LEVELS[0],
					defaultBetLevel: MULT,
					betLevels: BET_LEVELS,
					// Stake's documented shape: a map of mode -> { mode, costMultiplier, feature }
					betModes: Object.fromEntries(Object.entries(config.betModes).map(([key, mode]) => [key.toUpperCase(), { mode: key.toUpperCase(), costMultiplier: mode.cost, feature: key !== 'base' }])),
					jurisdiction: {
						socialCasino: false,
						disabledFullscreen: false,
						disabledTurbo: false,
						disabledSuperTurbo: false,
						disabledAutoplay: false,
						disabledSlamstop: false,
						disabledSpacebar: false,
						disabledBuyFeature: false,
						displayNetPosition: false,
						displayRTP: false,
						displaySessionTimer: false,
						minimumRoundDuration: 0,
					},
				},
				round: null,
			},
		};
	}
	if (path === '/wallet/play') {
		const mode = String(body.mode ?? 'BASE').toUpperCase();
		const amount = Number(body.amount) || 0;
		const cost = Math.round(amount * costOf(mode));
		if (cost > state.balance) return { status: 400, data: { error: 'ERR_IPB', message: 'insufficient balance' } };
		state.balance -= cost;
		// every fixture is a base game round: whatever mode was asked for, the picture is one of the hand-written
		// spins (the bought rounds and the Ante levels have no books yet)
		const fixture = pick();
		const payout = Math.round(fixture.payoutMultiplier * amount);
		state.round = { betID: state.plays.length + 1, amount, payout, payoutMultiplier: fixture.payoutMultiplier, active: true, state: fixture.events, mode, event: null };
		state.plays.push({ name: fixture.name, mode, amount: amount / MULT, payout: payout / MULT });
		// a round that pays nothing is closed by the play itself (no end-round follows), as on the real RGS
		if (payout === 0) (state.round as Json).active = false;
		return { status: 200, data: { balance: balance(), round: state.round } };
	}
	if (path === '/wallet/end-round') {
		if (state.round && state.round.active) {
			state.balance += Number(state.round.payout) || 0;
			state.round.active = false;
		}
		return { status: 200, data: { balance: balance() } };
	}
	if (path === '/wallet/balance') return { status: 200, data: { balance: balance() } };
	if (path === '/bet/event') return { status: 200, data: { event: String(body.event ?? '') } };
	return { status: 404, data: { error: 'ERR_GEN', message: `the fixture RGS has no ${path}` } };
};

/** the request is one of the game's RGS calls with no real server behind it */
const fixturePath = (url: string): string | null => {
	const m = /^https:\/\/([^/]*)(\/(?:wallet|bet)\/.*)$/.exec(url);
	if (!m) return null;
	return m[1] === '' || m[1] === HOST ? m[2] : null;
};

let installed = false;

/** route the game's RGS requests to the fixtures when the address names no real RGS. Idempotent. */
export const installFixtureRgs = () => {
	if (installed || typeof window === 'undefined') return;
	const params = new URLSearchParams(window.location.search);
	const rgs = params.get('rgs_url');
	if (rgs && rgs !== HOST) return; // a real RGS was named: leave every request alone
	if (params.get('replay') === 'true') return; // a replay needs a real RGS
	installed = true;

	const realFetch = window.fetch.bind(window);
	window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
		const path = fixturePath(url);
		if (path === null) return realFetch(input, init);
		let body: Json = {};
		try {
			body = init?.body ? (JSON.parse(String(init.body)) as Json) : {};
		} catch {
			/* a body that is not JSON reads as empty */
		}
		const { status, data } = handle(path, body);
		// a real round trip is never instant: a short wait keeps the press, the drive out and the book's arrival in
		// their real order (window.__reindeer.fixtures.latency(ms) changes it, to see the waiting traffic)
		await new Promise((resolve) => setTimeout(resolve, latencyMs));
		return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
	};

	// house rule: one dev hook object per game, extended and never replaced
	Object.assign(((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}), {
		fixtures: {
			/** the hand-written rounds by name, with what each one shows */
			list: () => FIXTURE_ROUNDS.map((r) => ({ name: r.name, pays: r.payoutMultiplier, note: r.note })),
			/** play this round on the next spin (sticky: on every spin until fixtures.clear()) */
			next: (name: string, sticky = false) => {
				if (!byName(name)) return `no fixture round named "${name}"`;
				state.forced = name;
				state.sticky = sticky;
				return `next spin: ${name}${sticky ? ' (every spin)' : ''}`;
			},
			clear: () => {
				state.forced = null;
				state.sticky = false;
				state.custom = null;
			},
			/** play ANY book on the next spin: its events as the math writes them (a book copied out of the math's
			 *  own output, say) and what it pays in bet multiples. The way to try a real book before a mock RGS is up. */
			queue: (events: FixtureRound['events'], payoutMultiplier = 0) => {
				state.custom = { name: 'custom', note: 'handed over through the dev hook', payoutMultiplier, events };
				return `next spin: a custom book of ${events.length} events paying ${payoutMultiplier}x`;
			},
			/** the wait before each answer, ms (default 120) */
			latency: (ms: number) => {
				latencyMs = Math.max(0, Number(ms) || 0);
				return latencyMs;
			},
			/** what has been played, and the demo wallet */
			log: () => ({ balance: state.balance / MULT, plays: [...state.plays] }),
		},
	});
};
