// THE CHARGE WIND-UP (Corey 2026-11-20; constants ROAM.charge, REINDEER_SOUND.snort.lockPeakMs; the rig's
// animation/export_2026-11-20_charge/reindeer and its R3_GAME_SPEC.md). He picked R3, "he lowers his antlers, scrapes a
// front hoof ... and snorts on the lock", then, of the second mock round, "Slow Drag 1" and "B Snort at lock I think is
// better", and "I don't want to slow the spin pace down". So, on the roaming reindeer's own strike only:
//   THE CLIP     from the strike's first frame (the crosshair's first frame, roam.alert) to his set off: the slow drag
//                (charge, 21 frames: head down 1-5, reach 5-8, the hit 9, the drag 9-15, the kick 17, back by 21, then
//                holding 21), or at Turbo 2 and in a slam stop's hurry already running at the strike's start the head
//                going down and holding (chargeDown, 4 frames). Decided once, at the start (a slam stop during it only
//                hurries the board clock). His run cuts in at the set off from whatever frame shows, exactly as it did
//                from the stand: nothing here waits or moves the strike, the crosshair or the run.
//   THE HIT      the slow drag's frames 1 to its hit are time scaled by k so the hit lands on the FIRST crosshair hop
//                landing (a glide's end, the hop sound's frame) within hitWindow of the hit's own time; no such hop (one
//                target among them): k = 1, the hit at its own pace (266.7 ms). The frames after the hit at the rig's
//                30 fps. All on the board clock. The shortest stand is CROSSHAIR.leadMs (420 ms) and the latest hit
//                1.45 x 266.7 = 386.7 ms, so the hit always shows.
//   THE EFFECTS  plain sprites (no filter, mask, shader or blend mode), drawn over him in the runner's layer: two kicked
//                specks of snow on each drag frame and eight on the kick, from that frame's near front hoof (a frame his
//                set off cuts spawns none; specks in the air finish); and at the crosshair's lock four breath puffs from
//                the nose of whatever frame shows then (a charge frame standing, the side run's stride running), the
//                running ones carrying his speed and easing off. Their motion is the export's fx.json, copied into
//                game/reindeerRoamSpec.ts by tools/build_roam.py.
// planWindup is pure (the probes check it); ChargeFx holds a fixed pool of sprites made once, no allocation per frame.
import * as PIXI from 'pixi.js';

import { ROAM } from '../constants';
import { REINDEER_ROAM } from '../reindeerRoamSpec';
import { seeded } from './crosshair';
import { chargeFx, type ChargeClip } from './roamFrames';

const FR = 1000 / REINDEER_ROAM.fps;
const C = REINDEER_ROAM.clips;
const FX = REINDEER_ROAM.fx;
/** the slow drag's hit frame (the rig's beats) and its own time from the start */
export const CHARGE_HIT = C.charge.beats.hit;
const TH = (CHARGE_HIT - 1) * FR;

export type WindupPlan = {
	clip: ChargeClip;
	/** the strike's start and his set off, board clock */
	start: number;
	setOff: number;
	/** frames 1 .. hit run k times their pace; the hop the hit lands on (board clock), or null (k = 1) */
	k: number;
	hop: number | null;
	/** when the hit frame shows (board clock; the slow drag only) */
	hitAt: number | null;
	/** when each frame starts showing (index 0 = frame 1), board clock */
	at: number[];
};

/** THE PLAN (pure): `hops` are the crosshair's hop landings (board clock, any order), `quick` Turbo 2 or a slam stop's
 *  hurry running now */
export const planWindup = (start: number, setOff: number, hops: readonly number[], quick: boolean): WindupPlan => {
	if (quick) {
		const n = C.chargeDown.rigFrames;
		return { clip: 'chargeDown', start, setOff, k: 1, hop: null, hitAt: null, at: Array.from({ length: n }, (_, i) => start + i * FR) };
	}
	const [lo, hi] = ROAM.charge.hitWindow;
	const sorted = [...hops].map((h) => h - start).sort((a, b) => a - b);
	const h = sorted.find((d) => d >= lo * TH - 1e-6 && d <= hi * TH + 1e-6) ?? null;
	const k = h === null ? 1 : h / TH;
	const n = C.charge.rigFrames;
	const at = Array.from({ length: n }, (_, j) => {
		const i = j + 1;
		return i <= CHARGE_HIT ? start + (i - 1) * FR * k : start + TH * k + (i - CHARGE_HIT) * FR;
	});
	return { clip: 'charge', start, setOff, k, hop: h === null ? null : start + h, hitAt: at[CHARGE_HIT - 1], at };
};

/** the frame (1 based) the plan shows at board clock `clock` (frame 1 before the start; the last one held) */
export const windupFrame = (plan: WindupPlan, clock: number): number => {
	let f = 1;
	for (let i = 1; i < plan.at.length; i++) if (clock >= plan.at[i] - 1e-6) f = i + 1;
	return f;
};

type Kind = 'puff' | 'snow';
type Particle = { sprite: PIXI.Sprite; kind: Kind; on: boolean; t: number; life: number; x: number; y: number; vx: number; vy: number; g: number; r0: number; r1: number; a0: number; kf: number; cx: number; cy: number; tau: number };

const SNOW_MAX = FX.snow.drag.frames.length * FX.snow.drag.per_frame + FX.snow.kick.count;
const PUFF_MAX = FX.puff.count;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** where he is drawn now, for the effects: his feet (road px), road px per rig frame px, the way he faces */
export type Pose = { x: number; y: number; kf: number; facing: 1 | -1 };

export class ChargeFx {
	readonly root = new PIXI.Container();
	private readonly pool: Particle[] = [];
	/** the strike's own schedule (snow, from the plan) is spawned while his wind-up shows */
	private live = 0;
	/** DEV / probes: what was spawned, per strike (cleared at each begin) */
	readonly log = { snow: [] as { t: number; frame: number; n: number }[], puff: null as null | { t: number; x: number; y: number; running: boolean; stride: number | null; frame: number | null; clip: string | null } };

	constructor() {
		this.root.visible = false;
		this.root.eventMode = 'none';
		for (let i = 0; i < SNOW_MAX + PUFF_MAX; i++) {
			const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
			sprite.anchor.set(0.5);
			sprite.visible = false;
			this.root.addChild(sprite);
			this.pool.push({ sprite, kind: i < SNOW_MAX ? 'snow' : 'puff', on: false, t: 0, life: 1, x: 0, y: 0, vx: 0, vy: 0, g: 0, r0: 0, r1: 0, a0: 1, kf: 1, cx: 0, cy: 0, tau: 1 });
		}
	}

	/** HIS STRIKE STARTS (standing at `pose`): the kicked snow of the slow drag, each frame's specks from its time (only
	 *  the frames that start before his set off) */
	begin(plan: WindupPlan, pose: Pose, seed: number) {
		this.clear();
		this.log.snow.length = 0;
		this.log.puff = null;
		const tex = chargeFx('snow');
		if (plan.clip !== 'charge' || !tex) return;
		const rnd = seeded(seed);
		const S = FX.snow;
		const hoof = C.charge.hoof;
		const spray = (frame: number, n: number, power: number) => {
			const t = plan.at[frame - 1];
			if (t >= plan.setOff) return;
			const hx = hoof[frame - 1][0];
			const hy = hoof[frame - 1][1];
			let made = 0;
			for (const p of this.pool) {
				if (made >= n) break;
				if (p.kind !== 'snow' || p.on) continue;
				made++;
				p.on = true;
				p.t = t;
				p.life = lerp(S.life_ms[0], S.life_ms[1], rnd());
				p.x = pose.x + pose.facing * hx * pose.kf;
				p.y = pose.y + hy * pose.kf;
				p.vx = pose.facing * lerp(S.vx_frame_px_per_ms[0], S.vx_frame_px_per_ms[1], rnd()) * power;
				p.vy = lerp(S.vy_frame_px_per_ms[0], S.vy_frame_px_per_ms[1], rnd()) * power;
				p.g = S.gravity_frame_px_per_ms2;
				const r = lerp(S.radius_frame_px[0], S.radius_frame_px[1], rnd());
				p.r0 = r;
				p.r1 = r;
				p.a0 = S.alpha[0];
				p.kf = pose.kf;
				p.cx = 0;
				p.cy = 0;
				p.tau = 1;
				p.sprite.texture = tex.texture;
			}
			this.log.snow.push({ t, frame, n: made });
		};
		for (const f of S.drag.frames) spray(f, S.drag.per_frame, S.drag.power);
		spray(S.kick.frame, S.kick.count, S.kick.power);
		this.live = 1;
	}

	/** THE LOCK (the crosshair's lock frame, `now`): four puffs from the nose at `nose` (frame px from his feet, the way he
	 *  faces), carried at `vx`, `vy` road px per board ms (his ground speed; 0 standing) */
	puff(now: number, pose: Pose, nose: readonly number[], vx: number, vy: number, seed: number, what: { running: boolean; stride: number | null; frame: number | null; clip: string | null }) {
		const tex = chargeFx('puff');
		if (!tex) return;
		const rnd = seeded(seed ^ 0x9e3779b9);
		const P = FX.puff;
		const range = what.running ? P.vx_frame_px_per_ms.running : P.vx_frame_px_per_ms.standing;
		const nx = pose.x + pose.facing * nose[0] * pose.kf;
		const ny = pose.y + nose[1] * pose.kf;
		let i = 0;
		for (const p of this.pool) {
			if (i >= P.count) break;
			if (p.kind !== 'puff') continue;
			p.on = true;
			p.t = now + P.spawn_offsets_ms[i];
			p.life = P.life_ms;
			p.x = nx + pose.facing * P.offset_frame_px[0] * i * pose.kf;
			p.y = ny + P.offset_frame_px[1] * i * pose.kf;
			p.vx = pose.facing * lerp(range[0], range[1], rnd());
			p.vy = lerp(P.vy_frame_px_per_ms[0], P.vy_frame_px_per_ms[1], rnd());
			p.g = 0;
			p.r0 = P.radius_frame_px[0];
			p.r1 = P.radius_frame_px[1];
			p.a0 = P.alpha[0];
			p.kf = pose.kf;
			p.cx = vx;
			p.cy = vy;
			p.tau = P.carry_tau_ms;
			p.sprite.texture = tex.texture;
			i++;
		}
		this.log.puff = { t: now, x: nx, y: ny, ...what };
		this.live = 1;
	}

	/** the frame: every particle at its age. `windup`: his wind-up still shows (when it is over before its time, the
	 *  specks not yet spawned are dropped: nothing of it spawns without its clip) */
	update(clock: number, windup: boolean) {
		if (!this.live) return;
		let any = false;
		for (const p of this.pool) {
			if (!p.on) continue;
			const age = clock - p.t;
			if (age < 0) {
				if (p.kind === 'snow' && !windup) p.on = false;
				else any = true;
				p.sprite.visible = false;
				continue;
			}
			if (age >= p.life) {
				p.on = false;
				p.sprite.visible = false;
				continue;
			}
			any = true;
			const u = age / p.life;
			const s = p.sprite;
			// (the mock's motion: x + vx age; y + vy age + g age^2; a running puff carried v tau (1 - e^-age/tau))
			const carry = p.cx || p.cy ? p.tau * (1 - Math.exp(-age / p.tau)) : 0;
			s.position.set(p.x + p.vx * age * p.kf + p.cx * carry, p.y + (p.vy * age + p.g * age * age) * p.kf + p.cy * carry);
			const d = 2 * lerp(p.r0, p.r1, u) * p.kf;
			s.width = d;
			s.height = d;
			s.alpha = p.a0 * (1 - u);
			s.visible = true;
		}
		this.root.visible = any;
		if (!any) this.live = 0;
	}

	/** DEV / probes: a strike that is not his starts (its log is empty; specks still in the air finish) */
	forget() {
		this.log.snow.length = 0;
		this.log.puff = null;
	}

	/** everything gone now (a new spin, the board put up as it is, the board going) */
	clear() {
		for (const p of this.pool) {
			p.on = false;
			p.sprite.visible = false;
		}
		this.root.visible = false;
		this.live = 0;
	}

	/** DEV / probes: the particles up now (spawned, not done) by kind, and the root's state */
	state(clock: number) {
		let snow = 0;
		let puff = 0;
		let pending = 0;
		for (const p of this.pool) {
			if (!p.on) continue;
			if (clock < p.t) pending++;
			else if (p.kind === 'snow') snow++;
			else puff++;
		}
		const shown = this.pool.filter((p) => p.sprite.visible).length;
		return { snow, puff, pending, shown, visible: this.root.visible, pool: this.pool.length };
	}

	destroy() {
		this.root.destroy({ children: true });
	}
}
