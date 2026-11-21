// THE SNORT AT THE LOCK, WHEN (pure; constants REINDEER_SOUND.snort: lockPeakMs, lockEveryStrike; ROAM.charge; the
// sound itself is game/road/roadSounds.ts lockSnort, the frames that ask are game/road/roadFeatures.ts updateRunner).
// Corey 2026-11-20 picked "B Snort at lock" and said "yes" to exempting it from the snorts' 10 s gap: it sounds on EVERY
// strike. Until 2026-11-21 it was asked only on the roaming reindeer's own strike (the first strike of a spin while he
// stands on the screen), so every other strike (a spin's second and later strikes, and a first strike while he is
// still walking in) had none. The rule now, made true here by construction:
//   ONE PER STRIKE    asked once for each strike (the runner's own flag), never twice, never skipped
//   WHICH STRIKES     every strike while ROAM.charge is on: his own (with the wind-up) and, with lockEveryStrike, the
//                     strikes that run in from off the screen (no wind-up by design: there is no reindeer standing on
//                     the screen to wind up)
//   AT THE LOCK       its loudest point (peakMs real ms into the clip) on the crosshair's lock: asked on the first frame
//                     with peakMs real ms or less left to the lock (left = board ms to the lock / the board's rate now,
//                     so turbo and a slam stop's hurry, even one that starts mid strike, keep it on the lock); a lock at
//                     the strike's own instant (one target) is already due on the strike's first frame, so it is asked
//                     there, on the lock's own frame
//   NEVER MISSED      a strike that reaches its impact with the snort not yet asked (no crosshair under SKIP TO RESULT,
//                     or a frame that jumps from before the lock's window past the impact) asks it on the impact's
//                     frame, before the crash: still one, still on that strike
// Nothing here plays, waits or moves anything.

/** does this strike get the lock's snort at all? `charge` ROAM.charge.on, `his` the roaming reindeer's own strike,
 *  `every` REINDEER_SOUND.snort.lockEveryStrike */
export const lockSnortOn = (charge: boolean, his: boolean, every: boolean): boolean => charge && (his || every);

/** real ms from now to the lock (negative: the lock has passed), or null without a lock */
export const lockSnortLeft = (lockAt: number | null, clock: number, rate: number): number | null => (lockAt === null || !Number.isFinite(lockAt) ? null : (lockAt - clock) / Math.max(0.001, rate));

/** is the lock's snort due on this frame? `asked` it has been asked for this strike already; `lockAt` the crosshair's
 *  lock (board ms; null: no crosshair); `impact` this frame is the strike's impact */
export const lockSnortDue = (asked: boolean, lockAt: number | null, clock: number, rate: number, peakMs: number, impact: boolean): boolean => {
	if (asked) return false;
	if (impact) return true;
	const left = lockSnortLeft(lockAt, clock, rate);
	return left !== null && left <= peakMs;
};
