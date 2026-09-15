// What is painted on the steel door right now (see game/doorPaint.ts). Set by the book event
// handlers around the door rolls (bonusStart / bonusEnd) and by the wrap-up's count-up
// (FreeSpinOutro), read by DoorPaint.svelte inside DoorSteel — so the paint is on the door from
// the first frame of its roll-down, not laid on after it lands.
import type { StingerPlateName } from './stinger';
import type { BonusMode } from './types';

export type DoorPaintScreen = 'intro' | 'outro';
export type DoorPaintState = {
	screen: DoorPaintScreen | null;
	mode: BonusMode;
	/** intro: the awarded count (8 or 10) */
	spins: 8 | 10;
	/** outro: the FINAL TIER's stinger plate, painted when the round total made a big-tier level
	 *  (null = no plate at all, the amount sits on bare steel) */
	plate: StingerPlateName | null;
	/** outro: the amount as its currency string, '' while nothing counts yet */
	amountText: string;
	/** outro: the count-up's final string (the odometer reserve) */
	amountReserve: string;
	/** DEV probes: blank one painted layer (Board.svelte's __angryMantis.paintHide) */
	debugHide: null | 'header' | 'stars' | 'count' | 'amount';
};

export const doorPaintState: DoorPaintState = $state({
	screen: null,
	mode: 'free',
	spins: 8,
	plate: null,
	amountText: '',
	amountReserve: '',
	debugHide: null,
});

export const doorPaintIntro = (mode: BonusMode, spins: number) => {
	doorPaintState.screen = 'intro';
	doorPaintState.mode = mode;
	doorPaintState.spins = spins === 8 ? 8 : 10;
};
export const doorPaintOutro = (mode: BonusMode) => {
	doorPaintState.screen = 'outro';
	doorPaintState.mode = mode;
	doorPaintState.plate = null;
	doorPaintState.amountText = '';
	doorPaintState.amountReserve = '';
};
export const doorPaintClear = () => {
	doorPaintState.screen = null;
	doorPaintState.amountText = '';
	doorPaintState.amountReserve = '';
};
