// THE SCATTER TEASE, AS IT STANDS RIGHT NOW (1.0.04; ANTICIPATION_TEASE, SUN_TEASE). One pure reading of the last reveal's
// derived tease (stateGame revealTease: its plan in style ms and the drop's real-time clock) at this moment, for whatever
// draws it: components/SunTease.svelte today, and the plaque's War Standard flag row later (images/anticipation_r2 r6 B,
// waiting on Corey's one plan for the plaque). It reads; it never writes, so a new reader needs no change here or in
// the sun. Nothing allocates: `teaseNow()` fills and returns one shared object.
import { revealTease, stateGame } from './stateGame.svelte';
import { ANTICIPATION_TEASE, SUN_TEASE } from './constants';

export type TeasePhase = 'none' | 'hold' | 'fall' | 'after' | 'ended';
export type TeaseNow = {
	/** a regular spin's tease is on screen (or its hit flash still is) */
	active: boolean;
	/** style ms since the reveal began (the plan's clock); -1 when no tease */
	t: number;
	/** War Standards on the board so far (landed), 0 .. 8 */
	landed: number;
	/** 3 at the start of the tease: the next one is FS (4), then SUPER (5), then EPIC (6) */
	triggerAfter: number;
	/** the held column whose turn it is (0-based among the held columns), -1 before the first and after the last */
	holdIndex: number;
	/** its reel (board column), -1 when none */
	reel: number;
	/** 'hold': it waits above the board; 'fall': it is falling; 'after': every held column has landed (the hit flash may
	 *  still run); 'ended': over (or skipped, or a new reveal); 'none': no tease on this reveal */
	phase: TeasePhase;
	/** how far its hold has run (0 .. 1), 1 while it falls */
	holdProgress: number;
	/** how far its fall has run (0 .. 1), 0 while it holds */
	fallProgress: number;
	/** 'pending' until it is decided ON SCREEN: 'hit' once the fourth War Standard has landed, 'miss' once the last held
	 *  column has landed without one */
	outcome: 'pending' | 'hit' | 'miss';
	/** the tease is over (also true while skipping) */
	ended: boolean;
	/** held columns in this tease */
	held: number;
};

const now: TeaseNow = { active: false, t: -1, landed: 0, triggerAfter: ANTICIPATION_TEASE.triggerAfter, holdIndex: -1, reel: -1, phase: 'none', holdProgress: 0, fallProgress: 0, outcome: 'pending', ended: true, held: 0 };

/** the style ms of the drop right now (the plan's clock), -1 before its first frame */
export const teaseClock = (): number => (revealTease.origin > 0 ? (performance.now() - revealTease.origin) * revealTease.rate : -1);

/** the tease's last moment (style ms): the last held column's landing, plus the hit flash on a hit */
export const teaseEnd = (): number => {
	const plan = revealTease.plan;
	if (!plan || !plan.columns.length) return 0;
	return plan.columns[plan.columns.length - 1].land + (plan.hit ? SUN_TEASE.hitFlashMs : 0);
};

export const teaseNow = (): TeaseNow => {
	const plan = revealTease.plan;
	now.triggerAfter = ANTICIPATION_TEASE.triggerAfter;
	if (!revealTease.teased || !plan || !plan.columns.length) {
		Object.assign(now, { active: false, t: -1, landed: 0, holdIndex: -1, reel: -1, phase: 'none', holdProgress: 0, fallProgress: 0, outcome: 'pending', ended: true, held: 0 });
		return now;
	}
	const t = teaseClock();
	now.t = t;
	now.held = plan.columns.length;
	let landed = 0;
	for (const at of plan.scatterLand) if (t >= at) landed += 1;
	now.landed = landed;
	const last = plan.columns[plan.columns.length - 1];
	const over = t < 0 || t >= teaseEnd() || stateGame.skipping;
	now.outcome = landed > ANTICIPATION_TEASE.triggerAfter ? 'hit' : t >= last.land ? 'miss' : 'pending';
	now.holdIndex = -1;
	now.reel = -1;
	now.holdProgress = 0;
	now.fallProgress = 0;
	if (over || t < plan.columns[0].show) {
		now.phase = t >= 0 && t < plan.columns[0].show && !stateGame.skipping ? 'none' : 'ended';
		now.active = false;
		now.ended = now.phase === 'ended';
		return now;
	}
	now.active = true;
	now.ended = false;
	now.phase = 'after';
	for (const c of plan.columns) {
		if (t < c.show || t >= c.land) continue;
		now.holdIndex = c.i;
		now.reel = c.reel;
		if (t < c.launch) {
			now.phase = 'hold';
			now.holdProgress = Math.min(1, (t - c.show) / Math.max(1, c.launch - c.show));
		} else {
			now.phase = 'fall';
			now.holdProgress = 1;
			now.fallProgress = Math.min(1, (t - c.launch) / Math.max(1, c.land - c.launch));
		}
		break;
	}
	return now;
};
