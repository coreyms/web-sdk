// THE ROAD'S OWN SOUNDS (constants REINDEER_SOUND has the rules and the numbers): the reindeer's alert, run loop and
// turn, the crash, the crash cloud's loop, the Grandma Wild, the reindeer column's entrance and his idle snort; since
// round 2 also the spin (the traffic loop, the five reel stops, the stoplights), the target crosshair (hop, drop, lock,
// the red box), his dart, a column's multiplier stamp and the presents' pop (game/road/roadBoard.ts cues the spin's);
// since round 3 the column's growth, Santa's and Grandma's entrances, each character's win clip, a sticky column
// settling in, and the line show once per line as it lights (game/road/roadBoard.ts).
// game/road/roadFeatures.ts says WHEN, from the frame the animation reaches the moment (the road clock, so turbo and a
// slam stop move a sound with its picture); this file says WHAT plays and keeps the two loops honest: each is started
// once, stopped on the frame its picture ends, and never left running.
// The same pattern as Manticore Mayhem's creature (game/creature.ts env.play / env.stop): the game hands over how to
// play (components/Board.svelte, through the game's own sound events in components/Sound.svelte, so the effects volume,
// mute and SKIP TO RESULT apply), and nothing here waits on a sound. Nothing here runs per frame but two flag checks.
import { REINDEER_SOUND } from '../constants';

export type RoadSoundEnv = {
	/** a one-shot; `rate` its playback rate (1 = as recorded) */
	play: (name: string, rate?: number) => void;
	loop: (name: string) => void;
	fade: (name: string, from: number, to: number, ms: number) => void;
	stop: (name: string) => void;
	/** the round is being played (a base game cloud stands after it until the next press: its loop does not) */
	roundLive: () => boolean;
};

type Cue = 'alert' | 'turn' | 'crash' | 'grandmaWild' | 'columnIn' | 'snort' | 'dart' | 'present' | 'grow' | 'santaIn' | 'grandmaIn' | 'sticky';

/** DEV / probe (window.__reindeer.roadSounds): every animation moment and every sound asked, with the board's frame */
export type RoadSoundEntry = { t: number; frame: number; clock: number; kind: 'moment' | 'sound'; what: string; detail?: string };

const N = REINDEER_SOUND.names;

export class RoadSounds {
	env: RoadSoundEnv = { play: () => {}, loop: () => {}, fade: () => {}, stop: () => {}, roundLive: () => true };
	/** DEV: force the snort's roll ('always' or 'never'; null = the odds) */
	forceSnort: 'always' | 'never' | null = null;
	private frameNo = 0;
	private clock = 0;
	private runOn = false;
	private cloudOn = false;
	/** a stop waiting for its fade to end, per sprite name (a start in that time stops it at once first): due at `at`
	 *  (performance.now), done on the first board frame from then, or by the timer if no frame comes */
	private pending = new Map<string, { at: number; timer: ReturnType<typeof setTimeout> }>();
	private snortAt = -Infinity;
	private quietUntil = -Infinity;
	private snortOn = 0;
	private trafficOn = false;
	/** the crosshair's hops this strike (the hop's rate), and the frames a drop, a lock and a light change last sounded */
	private hops = 0;
	private dropFrame = -1;
	private lockFrame = -1;
	private lightFrame = -1;
	/** the last reel stop sound: when (performance.now) and which */
	private reelStopT = -Infinity;
	private reelStopName = '';
	/** the frame each tier's column win sound last played */
	private winFrame: Record<string, number> = {};
	private log: RoadSoundEntry[] = [];

	/** the board's frame begins (roadFeatures.update) */
	beginFrame(frameNo: number, clock: number) {
		this.frameNo = frameNo;
		this.clock = clock;
		// a fade that has run its length: stopped on this frame (a busy page's timer can be several frames late)
		if (this.pending.size) {
			const now = performance.now();
			for (const [name, p] of [...this.pending]) if (now >= p.at) this.finishStop(name);
		}
	}

	/** the frame's state, after the features have updated: the crash clouds standing now, those fading out (they keep a
	 *  loop that is on going until they are gone, and never start one), and whether a strike or a column's arrival is
	 *  under way */
	endFrame(standing: number, leaving: number, busy: boolean) {
		const now = performance.now();
		if (busy) this.quietUntil = now + REINDEER_SOUND.snort.quietMs;
		const clouds = standing + (this.cloudOn ? leaving : 0);
		const want = clouds > 0 && this.env.roundLive();
		if (want && !this.cloudOn) {
			this.cloudOn = true;
			this.startLoop(N.cloud);
		} else if (!want && this.cloudOn) {
			this.cloudOn = false;
			// the cloud cleared: on this frame. The round ended with a cloud still up: a slower fade.
			this.fadeStop(N.cloud, clouds > 0 ? REINDEER_SOUND.roundEndFadeMs : REINDEER_SOUND.stopFadeMs, clouds > 0 ? 'round end' : 'cloud cleared');
		}
	}

	/** an animation moment (logged for the probe) */
	mark(what: string, detail?: string) {
		this.note('moment', what, detail);
	}

	/** a one-shot on this frame */
	cue(what: Cue, detail?: string) {
		if (what === 'alert') {
			// a strike begins: the snort gives way, and nothing idle comes until it is over
			if (this.snortOn > performance.now()) this.fadeStop(N.snort, REINDEER_SOUND.stopFadeMs, 'strike');
			this.snortOn = 0;
			this.hops = 0;
		}
		this.note('sound', N[what], detail);
		this.env.play(N[what]);
	}

	/** a one-shot by its sprite name on this frame (a reel's stop, a multiplier stamp), at `rate` */
	playNamed(name: string, detail?: string, rate?: number) {
		this.note('sound', name, rate !== undefined && rate !== 1 ? `${detail ?? ''} rate ${rate.toFixed(4)}`.trim() : detail);
		this.env.play(name, rate);
	}

	/** A REEL'S STOP (roadBoard.updateReelStops), its own sound on this frame. At turbo 2 (`turbo2`) the five stops are one
	 *  moment: a stop within REINDEER_SOUND.reelStopTurbo2.gapMs of the last one sounded is silent, and the last one, if it
	 *  is still sounding (the spin before's), is stopped as this one starts: one at a time */
	reelStop(reel: number, turbo2: boolean) {
		const name = REINDEER_SOUND.reelStops[reel];
		const now = performance.now();
		if (turbo2) {
			if (now - this.reelStopT < REINDEER_SOUND.reelStopTurbo2.gapMs) return;
			// (a play that has already ended is gone from the player: stopping it does nothing)
			if (this.reelStopName) this.env.stop(this.reelStopName);
		}
		this.reelStopT = now;
		this.reelStopName = name;
		this.playNamed(name, `reel ${reel + 1}`);
	}

	/** THE TARGET CROSSHAIR'S BEATS (RoadFeatures.onCrosshair): each hop at its own rate, a drop once a frame and never on
	 *  the lock's frame, the lock, and the red box at the crash (the morph's first frame) */
	crosshair(beat: 'hop' | 'drop' | 'lock' | 'morph', cell: number) {
		this.mark(beat, `cell ${cell}`);
		if (beat === 'hop') {
			const semis = REINDEER_SOUND.hopSemitones;
			const st = semis[this.hops % semis.length];
			this.hops += 1;
			this.playNamed(N.hop, `hop ${this.hops} cell ${cell} ${st >= 0 ? '+' : ''}${st} st`, Math.pow(2, st / 12));
		} else if (beat === 'drop') {
			if (this.dropFrame === this.frameNo || this.lockFrame === this.frameNo) return;
			this.dropFrame = this.frameNo;
			this.playNamed(N.drop, `cell ${cell}`);
		} else if (beat === 'lock') {
			this.lockFrame = this.frameNo;
			this.playNamed(N.lock, `cell ${cell}`);
		} else this.playNamed(N.redbox, `cell ${cell}`);
	}

	/** a column character's win clip starts on this frame: its tier's win sound, once a frame per tier (two reindeer
	 *  columns in one win play one sound, not the same one twice at once) */
	columnWin(tier: 'reindeer' | 'santa' | 'grandma', reel: number) {
		this.mark('columnWin', `reel ${reel} ${tier}`);
		if (this.winFrame[tier] === this.frameNo) return;
		this.winFrame[tier] = this.frameNo;
		this.playNamed(REINDEER_SOUND.columnWin[tier], `reel ${reel}`);
	}

	/** a stoplight changed color on this frame (once a frame, however many changed) */
	stoplight(detail: string) {
		this.mark('stoplight', detail);
		if (this.lightFrame === this.frameNo) return;
		this.lightFrame = this.frameNo;
		this.playNamed(N.stoplight, detail);
	}

	/** THE TRAFFIC (the spin): on from the press; a second start while it is on does nothing */
	trafficStart(why: string) {
		this.mark('trafficStart', why);
		if (this.trafficOn) return;
		this.trafficOn = true;
		this.startLoop(N.traffic);
	}

	/** the traffic fades out over `ms` real ms and stops (the first reel's stop; or at once, 8 ms: a board put up as it
	 *  is, the board going). A fade already running is left to finish. */
	trafficStop(why: string, ms: number = REINDEER_SOUND.stopFadeMs) {
		if (!this.trafficOn) return;
		this.trafficOn = false;
		this.fadeStop(N.traffic, Math.max(REINDEER_SOUND.stopFadeMs, Math.round(ms)), why);
	}

	/** the last reel's stop: the traffic's fade (from the first reel's stop) ends about now and stops it; if no fade began
	 *  (a single reel stopping) it fades now */
	trafficDone(why: string) {
		this.trafficStop(why);
	}

	/** he sets off along the snow */
	runStart() {
		if (this.runOn) return;
		this.runOn = true;
		this.startLoop(N.run);
	}

	/** the turn, the impact, a strike replaced, the press: the run loop stops if it is on (never left running) */
	runStop(why: string) {
		if (!this.runOn) return;
		this.runOn = false;
		this.fadeStop(N.run, REINDEER_SOUND.stopFadeMs, why);
	}

	/** a reindeer column's idle loop restarted: maybe a snort (never in a strike, a column's arrival or just after) */
	idleWrap(reel: number) {
		const now = performance.now();
		const S = REINDEER_SOUND.snort;
		if (this.forceSnort === 'never' || now < this.quietUntil || now - this.snortAt < S.minGapMs) return;
		if (this.forceSnort !== 'always' && Math.random() >= S.odds) return;
		this.snortAt = now;
		this.snortOn = now + 600;
		this.cue('snort', `reel ${reel}`);
	}

	/** everything off now (the board goes) */
	stopAll() {
		this.runStop('board gone');
		this.trafficStop('board gone');
		if (this.cloudOn) {
			this.cloudOn = false;
			this.fadeStop(N.cloud, REINDEER_SOUND.stopFadeMs, 'board gone');
		}
	}

	private startLoop(name: string) {
		// its last stop is still fading: stop it now, so the start is a fresh play at full level
		if (this.pending.has(name)) this.finishStop(name);
		this.note('sound', name, 'loop start');
		this.env.loop(name);
	}

	private fadeStop(name: string, ms: number, why: string) {
		this.note('sound', name, `stop (${why}), ${ms} ms fade`);
		this.env.fade(name, 1, 0, ms);
		const old = this.pending.get(name);
		if (old) clearTimeout(old.timer);
		this.pending.set(name, { at: performance.now() + ms, timer: setTimeout(() => this.finishStop(name), ms + 2) });
	}

	private finishStop(name: string) {
		const p = this.pending.get(name);
		if (!p) return;
		clearTimeout(p.timer);
		this.pending.delete(name);
		this.env.stop(name);
	}

	private note(kind: RoadSoundEntry['kind'], what: string, detail?: string) {
		if (!import.meta.env.DEV) return;
		this.log.push({ t: performance.now(), frame: this.frameNo, clock: Math.round(this.clock * 10) / 10, kind, what, detail });
		if (this.log.length > 4000) this.log.splice(0, 2000);
	}

	/** DEV: the log since the last clear */
	trace(clear = false) {
		const out = this.log.slice();
		if (clear) this.log = [];
		return out;
	}

	/** DEV: which loops it holds on */
	state() {
		return { run: this.runOn, cloud: this.cloudOn, traffic: this.trafficOn, pending: [...this.pending.keys()] };
	}
}
