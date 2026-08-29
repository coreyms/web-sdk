/**
 * Event-marker crossing (RUNTIME-EXPORT §2.4), as a pure function so the
 * contract is unit-testable without Pixi: markers inside `(prev, cur]` in
 * unwrapped sample time fire exactly once per pass — including across a
 * looping clip's `frames-1 → 0` seam. `inclusive` is the initialization
 * detail for the first advance after `play()`: a marker sitting exactly on
 * the start frame fires then, and only then. Reverse motion fires nothing.
 */

import type { ClipEvent } from './solve';

export function eventsCrossed(
  events: readonly ClipEvent[] | undefined,
  loop: boolean,
  dur: number,
  prev: number,
  cur: number,
  inclusive: boolean,
): ClipEvent[] {
  const fired: ClipEvent[] = [];
  if (!events?.length || cur < prev) return fired;

  for (const e of events) {
    if (!loop || dur <= 0) {
      if ((e.frame > prev || (inclusive && e.frame === prev)) && e.frame <= cur) {
        fired.push(e);
      }
    } else {
      // Occurrences of e.frame + k·dur inside (prev, cur] (closed at prev
      // when inclusive) — a span longer than one pass fires once per pass.
      let k = inclusive
        ? Math.ceil((prev - e.frame) / dur)
        : Math.floor((prev - e.frame) / dur) + 1;
      for (let m = e.frame + k * dur; m <= cur; k++, m = e.frame + k * dur) {
        fired.push(e);
      }
    }
  }
  return fired;
}
