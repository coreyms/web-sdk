// THE STRIP'S ARBITER (Corey 2026-11-17, approved; constants LED_BOARD.stripOrder): one place decides what the LED strip under
// the reels shows. Every writer of the strip (the bonus round's cards, the big win tiers, the scatter count, the spin's win
// amount, the spins left, the Grandma line, the cartoons, the race) only says whether it is TRUE now; the strip shows the
// highest true one in the order. A higher item cuts a lower one at once, nothing queues, and when the higher one ends the strip
// shows whatever is highest and still true at that moment (a lower item keeps its own clock while it is hidden).
import { LED_BOARD } from '../constants';

export type StripItem = (typeof LED_BOARD.stripOrder)[number];
export type StripTruth = Record<StripItem, boolean>;

/** the highest true item in the order (the cartoons when nothing else is: they are always true) */
export const pickStrip = (truth: StripTruth): StripItem => {
	for (const item of LED_BOARD.stripOrder) if (truth[item]) return item;
	return 'cartoon';
};

/** the rank of an item (0 = the highest), for the probe and the log */
export const stripRank = (item: StripItem): number => LED_BOARD.stripOrder.indexOf(item);
